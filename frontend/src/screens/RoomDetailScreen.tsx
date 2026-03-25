import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Dimensions,
  Modal,
  StatusBar,
  Linking,
} from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  MapPin,
  BadgeCheck,
  Lock,
  Baby,
  Armchair,
  Droplets,
  Zap,
  Plug,
  Snowflake,
  Wind,
  MessageSquare,
  Send,
  LogIn,
  Pencil,
  Trash2,
  Flag,
  Users,
  Tag,
  UserCircle,
  EyeOff,
  X,
  ShieldCheck,
  ShieldOff,
  Layers,
  Plus,
  ChevronRight,
  Building2,
} from 'lucide-react-native';
import { Lactario, LactarioFloor, Review } from '../types';
import { getLactarioById, getReviews, createReview, updateReview, deleteReview, reportReview, deleteLactario, verifyLactario, unverifyLactario } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Rating, Card, AvatarInitials, PlaceholderImage } from '../components/ui';
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

  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const photoScrollRef = useRef<ScrollView>(null);
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const lightboxScrollRef = useRef<ScrollView>(null);

  // Edit review state
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [editRating, setEditRating] = useState(0);
  const [editComment, setEditComment] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [verifying, setVerifying] = useState(false);

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

  // Refresh data when returning from EditRoom
  useFocusEffect(
    useCallback(() => {
      fetchDetails();
    }, [fetchDetails])
  );

  const handleSubmitReview = async () => {
    if (reviewRating === 0) {
      Alert.alert('Error', 'Por favor selecciona una calificación.');
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
      Alert.alert('Listo', 'Tu reseña fue publicada.');
      setShowReviewForm(false);
      setReviewRating(0);
      setReviewComment('');
      fetchDetails();
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.message || 'No se pudo enviar la reseña.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditReview = (review: Review) => {
    setEditingReviewId(review.id);
    setEditRating(review.rating);
    setEditComment(review.comment || '');
  };

  const handleSaveEditReview = async () => {
    if (!editingReviewId || editRating === 0) return;
    setEditSubmitting(true);
    try {
      await updateReview(editingReviewId, { rating: editRating, comment: editComment.trim() });
      setEditingReviewId(null);
      fetchDetails();
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.error || 'No se pudo actualizar la reseña.');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDeleteReview = (reviewId: string) => {
    Alert.alert('Eliminar reseña', '¿Estás seguro de que deseas eliminar esta reseña?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive',
        onPress: async () => {
          try {
            await deleteReview(reviewId);
            fetchDetails();
          } catch {
            Alert.alert('Error', 'No se pudo eliminar la reseña.');
          }
        },
      },
    ]);
  };

  const handleReportReview = (reviewId: string) => {
    Alert.alert('Reportar reseña', '¿Por qué quieres reportar esta reseña?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Contenido inapropiado', onPress: () => submitReport(reviewId, 'Contenido inapropiado') },
      { text: 'Información falsa', onPress: () => submitReport(reviewId, 'Información falsa') },
      { text: 'Spam', onPress: () => submitReport(reviewId, 'Spam') },
    ]);
  };

  const submitReport = async (reviewId: string, reason: string) => {
    try {
      await reportReview(reviewId, reason);
      Alert.alert('Reportado', 'Gracias, la reseña será revisada por un moderador.');
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.error || 'No se pudo enviar el reporte.');
    }
  };

  const isGuest = !user || user.isGuest;
  const isReviewer = ['ADMIN', 'ELITE'].includes(user?.role ?? '');
  const hasOwnReview = !isGuest && reviews.some((r) => r.userId === user?.id);
  const canEdit =
    !isGuest &&
    user?.role !== 'VISITOR' &&
    (
      ['ADMIN', 'ELITE', 'DISTINGUISHED'].includes(user?.role ?? '') ||
      (room.owner?.id !== undefined && room.owner.id === user?.id)
    );
  const isAdmin = user?.role === 'ADMIN';
  const amenities = room.amenities || [];
  const hasPhotos = room.photos && room.photos.length > 0;
  const photos = hasPhotos
    ? room.photos
    : [{ id: 'placeholder', url: '' }];

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxVisible(true);
    setTimeout(() => {
      lightboxScrollRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: false });
    }, 50);
  };

  const handleToggleVerify = async () => {
    setVerifying(true);
    try {
      if (room.isVerified) {
        await unverifyLactario(room.id);
        setRoom((prev) => ({ ...prev, isVerified: false }));
      } else {
        await verifyLactario(room.id);
        setRoom((prev) => ({ ...prev, isVerified: true }));
      }
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.error || 'No se pudo cambiar la verificación.');
    } finally {
      setVerifying(false);
    }
  };

  const handleDeleteLactario = async () => {
    setDeleting(true);
    try {
      await deleteLactario(room.id);
      setDeleteModalVisible(false);
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.error || 'No se pudo eliminar.');
    } finally {
      setDeleting(false);
    }
  };

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
      <ScrollView style={styles.container} contentContainerStyle={{flexGrow: 1}} bounces={false} scrollEnabled={true} nestedScrollEnabled={true} showsVerticalScrollIndicator={false}>
        {/* Photo Carousel */}
        <View style={styles.heroContainer}>
          <ScrollView
            ref={photoScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            scrollEnabled={true}
            onScroll={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
              setActivePhotoIndex(idx);
            }}
            style={styles.photoCarousel}
          >
            {photos.map((photo, idx) => (
              <TouchableOpacity
                key={photo.id}
                activeOpacity={0.92}
                onPress={() => photo.url ? openLightbox(idx) : undefined}
                style={styles.photoSlide}
              >
                {photo.url ? (
                  <Image
                    source={{ uri: photo.url }}
                    style={styles.heroImage}
                    resizeMode="cover"
                  />
                ) : (
                  <PlaceholderImage style={styles.heroImage} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
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
          <View style={[styles.heroActionsRight, { top: insets.top + spacing.sm }]}>
            {canEdit && (
              <TouchableOpacity
                style={styles.heroActionBtn}
                onPress={() => navigation.navigate('EditRoom', { room })}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Pencil size={20} color={colors.white} />
              </TouchableOpacity>
            )}
            {isAdmin && (
              <TouchableOpacity
                style={[styles.heroActionBtn, { backgroundColor: 'rgba(220,38,38,0.7)' }]}
                onPress={() => setDeleteModalVisible(true)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Trash2 size={20} color={colors.white} />
              </TouchableOpacity>
            )}
          </View>
          {photos.length > 1 && (
            <View style={styles.dotsContainer}>
              {photos.map((_, idx) => (
                <View key={idx} style={[styles.dot, idx === activePhotoIndex && styles.dotActive]} />
              ))}
            </View>
          )}
        </View>

        {/* Lightbox Modal */}
        <Modal
          visible={lightboxVisible}
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => setLightboxVisible(false)}
        >
          <View style={styles.lightboxContainer}>
            <StatusBar hidden />
            <ScrollView
              ref={lightboxScrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={16}
              scrollEnabled={true}
              onScroll={(e) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                setLightboxIndex(idx);
              }}
              style={styles.lightboxScroll}
            >
              {photos.map((photo) => (
                <View key={photo.id} style={styles.lightboxSlide}>
                  <Image
                    source={{ uri: photo.url }}
                    style={styles.lightboxImage}
                    resizeMode="contain"
                  />
                </View>
              ))}
            </ScrollView>
            {/* Counter */}
            {photos.length > 1 && (
              <View style={styles.lightboxCounter}>
                <Text style={styles.lightboxCounterText}>{lightboxIndex + 1} / {photos.length}</Text>
              </View>
            )}
            {/* Dots */}
            {photos.length > 1 && (
              <View style={styles.lightboxDots}>
                {photos.map((_, idx) => (
                  <View key={idx} style={[styles.dot, idx === lightboxIndex && styles.dotActive]} />
                ))}
              </View>
            )}
            {/* Close button */}
            <TouchableOpacity
              style={[styles.lightboxCloseBtn, { top: (StatusBar.currentHeight ?? 0) + spacing.lg }]}
              onPress={() => setLightboxVisible(false)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <X size={22} color={colors.white} />
            </TouchableOpacity>
          </View>
        </Modal>

        {/* Delete Confirmation Modal (ADMIN only) */}
        <Modal visible={deleteModalVisible} transparent animationType="fade">
          <View style={styles.deleteModalOverlay}>
            <View style={styles.deleteModalCard}>
              <View style={styles.deleteModalIconWrap}>
                <Trash2 size={28} color={colors.error} />
              </View>
              <Text style={styles.deleteModalTitle}>Eliminar aportación</Text>
              <Text style={styles.deleteModalMsg}>
                ¿Estás seguro de eliminar "{room.name}"? Se borrarán también sus reseñas, fotos y datos asociados. Esta acción no se puede deshacer.
              </Text>
              <View style={styles.deleteModalActions}>
                <TouchableOpacity
                  style={styles.deleteModalCancel}
                  onPress={() => setDeleteModalVisible(false)}
                  disabled={deleting}
                >
                  <Text style={styles.deleteModalCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteModalConfirm}
                  onPress={handleDeleteLactario}
                  disabled={deleting}
                >
                  {deleting ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Text style={styles.deleteModalConfirmText}>Eliminar</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <View style={styles.body}>
          {/* Title + Rating */}
          <View style={styles.titleRow}>
            <Text style={styles.roomName}>
              {room.floor ? `${room.name} — Piso ${room.floor}` : room.name}
            </Text>
            <View style={styles.ratingBadge}>
              <Rating value={room.rating || 0} size={16} />
              <Text style={styles.ratingValue}>{(room.rating || 0).toFixed(1)}</Text>
            </View>
          </View>

          {/* Address — tap to open directions */}
          {room.address && (
            <TouchableOpacity
              style={styles.addressRow}
              onPress={() => {
                const dest = room.latitude && room.longitude
                  ? `${room.latitude},${room.longitude}`
                  : encodeURIComponent(room.address!);
                Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${dest}`);
              }}
              activeOpacity={0.6}
            >
              <MapPin size={16} color={colors.primary[500]} />
              <Text style={[styles.addressText, { color: colors.primary[500] }]}>{room.address}</Text>
            </TouchableOpacity>
          )}

          {/* Type + Verified */}
          <View style={styles.badgeRow}>
            {/* Show "Edificio" badge if this is a building with floors */}
            {((room.floors && room.floors.length > 0) || (room.floorCount && room.floorCount > 0)) ? (
              <View style={styles.placeTypeBadgeEdificio}>
                <Text style={styles.placeTypeBadgeTextEdificio}>🏢 Edificio</Text>
              </View>
            ) : room.placeType ? (
              <View style={[
                styles.placeTypeBadge,
                room.placeType === 'CAMBIADOR' && styles.placeTypeBadgeCambiador,
                room.placeType === 'BANO_FAMILIAR' && styles.placeTypeBadgeBanoFamiliar,
                room.placeType === 'PUNTO_INTERES' && styles.placeTypeBadgePuntoInteres,
              ]}>
                <Text style={[
                  styles.placeTypeBadgeText,
                  room.placeType === 'CAMBIADOR' && styles.placeTypeBadgeTextCambiador,
                  room.placeType === 'BANO_FAMILIAR' && styles.placeTypeBadgeTextBanoFamiliar,
                  room.placeType === 'PUNTO_INTERES' && styles.placeTypeBadgeTextPuntoInteres,
                ]}>
                  {room.placeType === 'CAMBIADOR' ? '🚼 Cambiador'
                    : room.placeType === 'BANO_FAMILIAR' ? '🚻 Baño Familiar'
                    : room.placeType === 'PUNTO_INTERES' ? '⭐ Punto de Interés'
                    : '🤱 Lactario'}
                </Text>
              </View>
            ) : null}
            {room.isVerified && (
              <View style={styles.verifiedTag}>
                <BadgeCheck size={14} color={colors.success} />
                <Text style={styles.verifiedText}>Verificado</Text>
              </View>
            )}
            {room.isPrivate && (
              <View style={styles.privateTag}>
                <Lock size={14} color="#4338ca" />
                <Text style={styles.privateTagText}>Acceso Restringido</Text>
              </View>
            )}
            {isReviewer && (
              <TouchableOpacity
                style={[styles.verifyBtn, room.isVerified && styles.verifyBtnActive]}
                onPress={handleToggleVerify}
                disabled={verifying}
                activeOpacity={0.7}
              >
                {verifying ? (
                  <ActivityIndicator size="small" color={room.isVerified ? colors.success : colors.slate[500]} />
                ) : room.isVerified ? (
                  <>
                    <ShieldOff size={14} color={colors.success} />
                    <Text style={[styles.verifyBtnText, { color: colors.success }]}>Quitar verificación</Text>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={14} color={colors.slate[500]} />
                    <Text style={styles.verifyBtnText}>Verificar</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Access + Owner row */}
          <View style={styles.metaRow}>
            {room.access && (
              <View style={styles.metaItem}>
                <Users size={14} color={colors.slate[500]} />
                <Text style={styles.metaText}>{room.access}</Text>
              </View>
            )}
            {['ADMIN', 'ELITE'].includes(user?.role ?? '') && room.owner && (
              <View style={styles.metaItem}>
                <UserCircle size={14} color={colors.slate[500]} />
                <Text style={styles.metaText}>
                  {room.owner.name || room.owner.email}
                </Text>
              </View>
            )}
          </View>

          {/* Description */}
          {room.description && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Descripción</Text>
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

          {/* Tags */}
          {room.tags && room.tags.length > 0 && (
            <View style={styles.section}>
              <View style={styles.tagsHeader}>
                <Tag size={14} color={colors.slate[500]} />
                <Text style={styles.tagsTitle}>Etiquetas</Text>
              </View>
              <View style={styles.tagsRow}>
                {room.tags.map((tag, idx) => (
                  <View key={idx} style={styles.tagChip}>
                    <Text style={styles.tagChipText}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Parent link (for child/floor lactarios) */}
          {room.parent && (
            <TouchableOpacity
              style={styles.parentLink}
              onPress={() => navigation.push('RoomDetail', { room: { id: room.parent!.id, name: room.parent!.name, address: room.parent!.address, latitude: room.parent!.latitude, longitude: room.parent!.longitude, status: 'ACTIVE' } })}
              activeOpacity={0.6}
            >
              <Building2 size={16} color={colors.primary[500]} />
              <Text style={styles.parentLinkText}>Ver edificio: {room.parent.name}</Text>
              <ChevronRight size={16} color={colors.primary[500]} />
            </TouchableOpacity>
          )}

          {/* Floors / Spaces Section */}
          {room.floors && room.floors.length > 0 && (
            <View style={styles.section}>
              <View style={styles.floorsHeader}>
                <Layers size={18} color={colors.slate[700]} />
                <Text style={styles.sectionTitle}>Espacios ({room.floors.length})</Text>
              </View>
              {room.floors.map((floor: LactarioFloor) => {
                const floorTypeLabel =
                  floor.placeType === 'CAMBIADOR' ? '🚼 Cambiador'
                  : floor.placeType === 'BANO_FAMILIAR' ? '🚻 Baño Familiar'
                  : floor.placeType === 'PUNTO_INTERES' ? '⭐ Punto de Interés'
                  : '🤱 Lactario';
                return (
                  <TouchableOpacity
                    key={floor.id}
                    style={styles.floorCard}
                    onPress={() => navigation.push('RoomDetail', { room: { id: floor.id, name: room.name, floor: floor.floor, status: 'ACTIVE' } })}
                    activeOpacity={0.7}
                  >
                    {floor.imageUrl ? (
                      <Image source={{ uri: floor.imageUrl }} style={styles.floorThumb} />
                    ) : (
                      <View style={[styles.floorThumb, styles.floorThumbPlaceholder]}>
                        <Layers size={20} color={colors.slate[300]} />
                      </View>
                    )}
                    <View style={styles.floorInfo}>
                      <Text style={styles.floorName}>Piso {floor.floor} — {floorTypeLabel}</Text>
                      {floor.description && (
                        <Text style={styles.floorDesc} numberOfLines={1}>{floor.description}</Text>
                      )}
                      <View style={styles.floorMeta}>
                        {(floor.rating ?? 0) > 0 && (
                          <Text style={styles.floorMetaText}>⭐ {(floor.rating ?? 0).toFixed(1)}</Text>
                        )}
                        {(floor.reviewCount ?? 0) > 0 && (
                          <Text style={styles.floorMetaText}>{floor.reviewCount} reseña{floor.reviewCount !== 1 ? 's' : ''}</Text>
                        )}
                      </View>
                    </View>
                    <ChevronRight size={18} color={colors.slate[400]} />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Add Floor Button (for parent lactarios without parentId) */}
          {!room.parentId && !isGuest && (
            <TouchableOpacity
              style={styles.addFloorBtn}
              onPress={() => navigation.navigate('AddFloor', { parentId: room.id, parentName: room.name })}
              activeOpacity={0.7}
            >
              <Plus size={18} color={colors.primary[500]} />
              <Text style={styles.addFloorBtnText}>Agregar espacio</Text>
            </TouchableOpacity>
          )}

          {/* Reviews Section */}
          <View style={styles.section}>
            <View style={styles.reviewsHeader}>
              <Text style={styles.sectionTitle}>
                Resenas ({reviews.length})
              </Text>
              {!isGuest && !showReviewForm && !hasOwnReview && (
                <TouchableOpacity
                  style={styles.addReviewBtn}
                  onPress={() => setShowReviewForm(true)}
                >
                  <MessageSquare size={16} color={colors.primary[500]} />
                  <Text style={styles.addReviewText}>Escribir reseña</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Guest message */}
            {isGuest && (
              <Card style={styles.guestCard}>
                <View style={styles.guestContent}>
                  <LogIn size={20} color={colors.slate[400]} />
                  <Text style={styles.guestText}>
                    Inicia sesión para dejar una reseña
                  </Text>
                </View>
              </Card>
            )}

            {/* Review Form */}
            {showReviewForm && (
              <Card style={styles.reviewFormCard}>
                <View style={styles.reviewFormContent}>
                  <Text style={styles.reviewFormTitle}>Tu calificación</Text>
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
                Aún no hay reseñas. Sé el primero en opinar.
              </Text>
            )}

            {reviews.map((review) => {
              const isOwnReview = user?.id === review.userId;
              const isEditing = editingReviewId === review.id;
              return (
                <Card key={review.id} style={[styles.reviewCard, review.isHidden && styles.reviewCardHidden]}>
                  <View style={styles.reviewCardContent}>
                    {/* Hidden banner for admins */}
                    {review.isHidden && (
                      <View style={styles.hiddenBanner}>
                        <EyeOff size={13} color={colors.warning} />
                        <Text style={styles.hiddenBannerText}>
                          Oculto — {review.reportCount} reporte{review.reportCount !== 1 ? 's' : ''}
                        </Text>
                      </View>
                    )}

                    <View style={styles.reviewCardHeader}>
                      <AvatarInitials name={review.userName || 'Usuario'} size="sm" imageUrl={review.userAvatarUrl} />
                      <View style={styles.reviewMeta}>
                        <Text style={styles.reviewerName}>{review.userName || 'Usuario'}</Text>
                        <Text style={styles.reviewDate}>{formatDate(review.date)}</Text>
                      </View>
                      {!isEditing && <Rating value={review.rating} size={14} />}
                    </View>

                    {/* Inline edit form */}
                    {isEditing ? (
                      <View style={styles.editForm}>
                        <Rating value={editRating} size={22} readonly={false} onChange={setEditRating} />
                        <TextInput
                          style={styles.reviewInput}
                          value={editComment}
                          onChangeText={setEditComment}
                          multiline
                          numberOfLines={3}
                          textAlignVertical="top"
                          placeholderTextColor={colors.slate[400]}
                          placeholder="Edita tu comentario..."
                        />
                        <View style={styles.editActions}>
                          <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditingReviewId(null)}>
                            <Text style={styles.cancelBtnText}>Cancelar</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.submitBtn, editSubmitting && styles.submitBtnDisabled]}
                            onPress={handleSaveEditReview}
                            disabled={editSubmitting}
                          >
                            {editSubmitting
                              ? <ActivityIndicator size="small" color={colors.white} />
                              : <Text style={styles.submitBtnText}>Guardar</Text>
                            }
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      review.comment ? <Text style={styles.reviewComment}>{review.comment}</Text> : null
                    )}

                    {/* Action row */}
                    {!isEditing && (
                      <View style={styles.reviewActions}>
                        {isOwnReview ? (
                          <>
                            <TouchableOpacity style={styles.reviewActionBtn} onPress={() => handleEditReview(review)}>
                              <Pencil size={13} color={colors.slate[400]} />
                              <Text style={styles.reviewActionText}>Editar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.reviewActionBtn} onPress={() => handleDeleteReview(review.id)}>
                              <Trash2 size={13} color={colors.error} />
                              <Text style={[styles.reviewActionText, { color: colors.error }]}>Eliminar</Text>
                            </TouchableOpacity>
                          </>
                        ) : (
                          <>
                            {!isGuest && (
                              <TouchableOpacity style={styles.reviewActionBtn} onPress={() => handleReportReview(review.id)}>
                                <Flag size={13} color={colors.slate[400]} />
                                <Text style={styles.reviewActionText}>Reportar</Text>
                              </TouchableOpacity>
                            )}
                            {isReviewer && (
                              <TouchableOpacity style={styles.reviewActionBtn} onPress={() => handleDeleteReview(review.id)}>
                                <Trash2 size={13} color={colors.error} />
                                <Text style={[styles.reviewActionText, { color: colors.error }]}>Eliminar</Text>
                              </TouchableOpacity>
                            )}
                          </>
                        )}
                      </View>
                    )}
                  </View>
                </Card>
              );
            })}
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
    height: 320,
  },
  photoCarousel: {
    height: 320,
  },
  photoSlide: {
    width: SCREEN_WIDTH,
    height: 320,
  },
  heroImage: {
    width: SCREEN_WIDTH,
    height: 320,
  },
  lightboxContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
  },
  lightboxScroll: {
    height: Dimensions.get('window').height,
  },
  lightboxSlide: {
    width: SCREEN_WIDTH,
    height: Dimensions.get('window').height,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxImage: {
    width: SCREEN_WIDTH,
    height: Dimensions.get('window').height,
  },
  lightboxCloseBtn: {
    position: 'absolute',
    right: spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxCounter: {
    position: 'absolute',
    top: spacing.xxl,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  lightboxCounterText: {
    ...typography.smallBold,
    color: 'rgba(255,255,255,0.7)',
  },
  lightboxDots: {
    position: 'absolute',
    bottom: spacing.xxl,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  heroGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  dotsContainer: {
    position: 'absolute',
    bottom: spacing.sm,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  dotActive: {
    backgroundColor: colors.white,
    width: 18,
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
  heroActionsRight: {
    position: 'absolute',
    right: spacing.lg,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  heroActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  deleteModalCard: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing.xxl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
  },
  deleteModalIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.errorLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  deleteModalTitle: {
    ...typography.h4,
    color: colors.slate[800],
    marginBottom: spacing.sm,
  },
  deleteModalMsg: {
    ...typography.small,
    color: colors.slate[500],
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 20,
  },
  deleteModalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%',
  },
  deleteModalCancel: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.slate[100],
    alignItems: 'center',
  },
  deleteModalCancelText: {
    ...typography.bodyBold,
    color: colors.slate[600],
  },
  deleteModalConfirm: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.error,
    alignItems: 'center',
  },
  deleteModalConfirmText: {
    ...typography.bodyBold,
    color: colors.white,
  },
  placeTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    backgroundColor: '#fff1f2',
  },
  placeTypeBadgeCambiador: {
    backgroundColor: '#ede9fe',
  },
  placeTypeBadgeBanoFamiliar: {
    backgroundColor: '#ccfbf1',
  },
  placeTypeBadgePuntoInteres: {
    backgroundColor: '#fef3c7',
  },
  placeTypeBadgeEdificio: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    backgroundColor: '#1e293b',
  },
  placeTypeBadgeTextEdificio: {
    ...typography.captionBold,
    color: '#f8fafc',
  },
  placeTypeBadgeText: {
    ...typography.captionBold,
    color: '#e11d48',
  },
  placeTypeBadgeTextCambiador: {
    color: '#7c3aed',
  },
  placeTypeBadgeTextBanoFamiliar: {
    color: '#0f766e',
  },
  placeTypeBadgeTextPuntoInteres: {
    color: '#d97706',
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
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    flexWrap: 'wrap',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaText: {
    ...typography.small,
    color: colors.slate[500],
  },
  tagsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  tagsTitle: {
    ...typography.smallBold,
    color: colors.slate[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tagChip: {
    backgroundColor: colors.slate[100],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
  },
  tagChipText: {
    ...typography.caption,
    color: colors.slate[600],
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
  privateTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#eef2ff',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
  },
  privateTagText: {
    ...typography.captionBold,
    color: '#4338ca',
  },
  verifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.slate[300],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
  },
  verifyBtnActive: {
    borderColor: colors.success,
    backgroundColor: colors.successLight,
  },
  verifyBtnText: {
    ...typography.caption,
    color: colors.slate[500],
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
  reviewCardHidden: {
    borderWidth: 1,
    borderColor: colors.warning,
    opacity: 0.85,
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
  hiddenBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#fef3c7',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  hiddenBannerText: {
    ...typography.caption,
    color: colors.warning,
    fontWeight: '600',
  },
  reviewActions: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.xs,
  },
  reviewActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reviewActionText: {
    ...typography.caption,
    color: colors.slate[400],
  },
  editForm: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
  },
  parentLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
  },
  parentLinkText: {
    ...typography.smallBold,
    color: colors.primary[500],
    flex: 1,
  },
  floorsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  floorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.sm,
  },
  floorThumb: {
    width: 56,
    height: 56,
    borderRadius: radii.md,
  },
  floorThumbPlaceholder: {
    backgroundColor: colors.slate[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  floorInfo: {
    flex: 1,
    gap: 2,
  },
  floorName: {
    ...typography.bodyBold,
    color: colors.slate[800],
  },
  floorDesc: {
    ...typography.small,
    color: colors.slate[500],
  },
  floorMeta: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: 2,
  },
  floorMetaText: {
    ...typography.caption,
    color: colors.slate[500],
  },
  addFloorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.primary[500],
    borderStyle: 'dashed',
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
  },
  addFloorBtnText: {
    ...typography.bodyBold,
    color: colors.primary[500],
  },
});
