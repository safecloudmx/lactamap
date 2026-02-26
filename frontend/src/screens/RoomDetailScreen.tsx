import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  MapPin,
  BadgeCheck,
  Baby,
  Armchair,
  Droplets,
  Zap,
  Plug,
  Lock,
  Snowflake,
  Wind,
  MessageSquare,
  Send,
  LogIn,
} from 'lucide-react-native';
import { Lactario, Review } from '../types';
import { getLactarioById, getReviews, createReview } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Rating, StatusBadge, Card, AvatarInitials } from '../components/ui';
import { colors, spacing, typography, radii, shadows } from '../theme';

const AMENITY_ICONS: Record<string, React.ComponentType<any>> = {
  'Cambiador': Baby,
  'Sillon Lactancia': Armchair,
  'Sillon\u0301 Lactancia': Armchair,
  'Lavabo': Droplets,
  'Microondas': Zap,
  'Enchufe': Plug,
  'Sala Privada': Lock,
  'Refrigerador': Snowflake,
  'Congelador': Snowflake,
  'Clima (A/C)': Wind,
};

export default function RoomDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const initialRoom: Lactario = route.params?.room;

  const [room, setRoom] = useState<Lactario>(initialRoom);
  const [reviews, setReviews] = useState<Review[]>(initialRoom.reviews || []);
  const [loading, setLoading] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchDetails = useCallback(async () => {
    try {
      const [roomData, reviewsData] = await Promise.all([
        getLactarioById(room.id),
        getReviews(room.id),
      ]);
      setRoom(roomData);
      setReviews(reviewsData);
    } catch (error) {
      console.warn('Error loading room details:', error);
    }
  }, [room.id]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const handleSubmitReview = async () => {
    if (reviewRating === 0) {
      Alert.alert('Error', 'Por favor selecciona una calificacion.');
      return;
    }
    if (reviewComment.trim().length === 0) {
      Alert.alert('Error', 'Por favor escribe un comentario.');
      return;
    }

    setSubmitting(true);
    try {
      await createReview(room.id, {
        rating: reviewRating,
        comment: reviewComment.trim(),
      });
      Alert.alert('Listo', 'Tu resena fue publicada.');
      setShowReviewForm(false);
      setReviewRating(0);
      setReviewComment('');
      fetchDetails();
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.message || 'No se pudo enviar la resena.');
    } finally {
      setSubmitting(false);
    }
  };

  const isGuest = !user || user.isGuest;
  const amenities = room.amenities || [];
  const imageUri = room.imageUrl || `https://picsum.photos/seed/${room.id}/800/500`;

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} bounces={false}>
        {/* Hero Image */}
        <View style={styles.heroContainer}>
          <Image source={{ uri: imageUri }} style={styles.heroImage} />
          <LinearGradient
            colors={['rgba(0,0,0,0.55)', 'transparent']}
            style={styles.heroGradient}
          />
          <TouchableOpacity
            style={[styles.backButton, { top: insets.top + spacing.sm }]}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <ArrowLeft size={24} color={colors.white} />
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          {/* Title + Rating */}
          <View style={styles.titleRow}>
            <Text style={styles.roomName}>{room.name}</Text>
            <View style={styles.ratingBadge}>
              <Rating value={room.rating || 0} size={16} />
              <Text style={styles.ratingValue}>{(room.rating || 0).toFixed(1)}</Text>
            </View>
          </View>

          {/* Address */}
          {room.address && (
            <View style={styles.addressRow}>
              <MapPin size={16} color={colors.slate[400]} />
              <Text style={styles.addressText}>{room.address}</Text>
            </View>
          )}

          {/* Status + Verified */}
          <View style={styles.badgeRow}>
            <StatusBadge status={room.status} />
            {room.isVerified && (
              <View style={styles.verifiedTag}>
                <BadgeCheck size={14} color={colors.success} />
                <Text style={styles.verifiedText}>Verificado</Text>
              </View>
            )}
          </View>

          {/* Description */}
          {room.description && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Descripcion</Text>
              <Text style={styles.description}>{room.description}</Text>
            </View>
          )}

          {/* Amenities */}
          {amenities.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Comodidades</Text>
              <View style={styles.amenitiesGrid}>
                {amenities.map((amenity, idx) => {
                  const IconComponent = AMENITY_ICONS[amenity] || Zap;
                  return (
                    <View key={idx} style={styles.amenityItem}>
                      <View style={styles.amenityIconCircle}>
                        <IconComponent size={20} color={colors.primary[600]} />
                      </View>
                      <Text style={styles.amenityLabel} numberOfLines={1}>
                        {amenity}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Reviews Section */}
          <View style={styles.section}>
            <View style={styles.reviewsHeader}>
              <Text style={styles.sectionTitle}>
                Resenas ({reviews.length})
              </Text>
              {!isGuest && !showReviewForm && (
                <TouchableOpacity
                  style={styles.addReviewBtn}
                  onPress={() => setShowReviewForm(true)}
                >
                  <MessageSquare size={16} color={colors.primary[500]} />
                  <Text style={styles.addReviewText}>Escribir resena</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Guest message */}
            {isGuest && (
              <Card style={styles.guestCard}>
                <View style={styles.guestContent}>
                  <LogIn size={20} color={colors.slate[400]} />
                  <Text style={styles.guestText}>
                    Inicia sesion para dejar una resena
                  </Text>
                </View>
              </Card>
            )}

            {/* Review Form */}
            {showReviewForm && (
              <Card style={styles.reviewFormCard}>
                <View style={styles.reviewFormContent}>
                  <Text style={styles.reviewFormTitle}>Tu calificacion</Text>
                  <Rating
                    value={reviewRating}
                    size={28}
                    readonly={false}
                    onChange={setReviewRating}
                  />
                  <TextInput
                    style={styles.reviewInput}
                    placeholder="Escribe tu comentario..."
                    placeholderTextColor={colors.slate[400]}
                    value={reviewComment}
                    onChangeText={setReviewComment}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                  <View style={styles.reviewFormActions}>
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      onPress={() => {
                        setShowReviewForm(false);
                        setReviewRating(0);
                        setReviewComment('');
                      }}
                    >
                      <Text style={styles.cancelBtnText}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.submitBtn,
                        submitting && styles.submitBtnDisabled,
                      ]}
                      onPress={handleSubmitReview}
                      disabled={submitting}
                    >
                      {submitting ? (
                        <ActivityIndicator size="small" color={colors.white} />
                      ) : (
                        <>
                          <Send size={16} color={colors.white} />
                          <Text style={styles.submitBtnText}>Publicar</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </Card>
            )}

            {/* Review List */}
            {reviews.length === 0 && !showReviewForm && !isGuest && (
              <Text style={styles.noReviews}>
                Aun no hay resenas. Se el primero en opinar.
              </Text>
            )}

            {reviews.map((review) => (
              <Card key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewCardContent}>
                  <View style={styles.reviewCardHeader}>
                    <AvatarInitials
                      name={review.userName || 'Usuario'}
                      size="sm"
                    />
                    <View style={styles.reviewMeta}>
                      <Text style={styles.reviewerName}>
                        {review.userName || 'Usuario'}
                      </Text>
                      <Text style={styles.reviewDate}>
                        {formatDate(review.date)}
                      </Text>
                    </View>
                    <Rating value={review.rating} size={14} />
                  </View>
                  {review.comment ? (
                    <Text style={styles.reviewComment}>{review.comment}</Text>
                  ) : null}
                </View>
              </Card>
            ))}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: colors.slate[50],
  },
  heroContainer: {
    position: 'relative',
    height: 250,
  },
  heroImage: {
    width: '100%',
    height: 250,
    backgroundColor: colors.slate[200],
  },
  heroGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  backButton: {
    position: 'absolute',
    left: spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  titleRow: {
    gap: spacing.sm,
  },
  roomName: {
    ...typography.h2,
    color: colors.slate[900],
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  ratingValue: {
    ...typography.bodyBold,
    color: colors.slate[700],
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  addressText: {
    ...typography.body,
    color: colors.slate[500],
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  verifiedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.successLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
  },
  verifiedText: {
    ...typography.captionBold,
    color: colors.success,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.slate[800],
  },
  description: {
    ...typography.body,
    color: colors.slate[600],
    lineHeight: 24,
  },
  amenitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  amenityItem: {
    alignItems: 'center',
    width: 80,
    gap: spacing.xs,
  },
  amenityIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  amenityLabel: {
    ...typography.caption,
    color: colors.slate[600],
    textAlign: 'center',
  },
  reviewsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addReviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: colors.primary[500],
  },
  addReviewText: {
    ...typography.smallBold,
    color: colors.primary[500],
  },
  guestCard: {
    padding: spacing.lg,
  },
  guestContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  guestText: {
    ...typography.small,
    color: colors.slate[500],
  },
  reviewFormCard: {
    overflow: 'visible',
  },
  reviewFormContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  reviewFormTitle: {
    ...typography.smallBold,
    color: colors.slate[700],
  },
  reviewInput: {
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: radii.md,
    padding: spacing.md,
    minHeight: 80,
    color: colors.slate[800],
    backgroundColor: colors.slate[50],
  },
  reviewFormActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
  },
  cancelBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
  },
  cancelBtnText: {
    ...typography.smallBold,
    color: colors.slate[500],
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary[500],
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    ...shadows.primary,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    ...typography.button,
    color: colors.white,
  },
  noReviews: {
    ...typography.small,
    color: colors.slate[400],
    textAlign: 'center',
    paddingVertical: spacing.xxl,
  },
  reviewCard: {
    marginBottom: spacing.md,
  },
  reviewCardContent: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  reviewCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  reviewMeta: {
    flex: 1,
    gap: 2,
  },
  reviewerName: {
    ...typography.smallBold,
    color: colors.slate[800],
  },
  reviewDate: {
    ...typography.caption,
    color: colors.slate[400],
  },
  reviewComment: {
    ...typography.body,
    color: colors.slate[600],
    marginTop: spacing.xs,
  },
});
