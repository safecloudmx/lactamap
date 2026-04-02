import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { MapPin, Lock } from 'lucide-react-native';
import { Lactario } from '../types';
import { AMENITY_LABELS } from '../constants';
import { colors, spacing, typography, radii } from '../theme';
import { Card, Rating, StatusBadge } from './ui';

interface LactarioCardProps {
  lactario: Lactario;
  onPress: () => void;
  showStatus?: boolean;
}

export default function LactarioCard({ lactario, onPress, showStatus }: LactarioCardProps) {
  const amenities = lactario.amenities || [];

  return (
    <Card onPress={onPress} style={styles.card}>
      {lactario.imageUrl ? (
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: lactario.imageUrl }}
            style={styles.image}
          />
          {showStatus && (
            <View style={styles.statusOverlay}>
              <StatusBadge status={lactario.status} />
            </View>
          )}
          {lactario.isVerified && (
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedText}>Verificado</Text>
            </View>
          )}
          {lactario.isPrivate && (
            <View style={styles.privateBadge}>
              <Lock size={10} color="#fff" />
              <Text style={styles.privateText}>Acceso Restringido</Text>
            </View>
          )}
        </View>
      ) : null}

      <View style={styles.content}>
        {/* Inline badges when no image */}
        {!lactario.imageUrl && (showStatus || lactario.isVerified || lactario.isPrivate) && (
          <View style={styles.inlineBadgesRow}>
            {showStatus && <StatusBadge status={lactario.status} />}
            {lactario.isVerified && (
              <View style={styles.inlineVerifiedBadge}>
                <Text style={styles.verifiedText}>Verificado</Text>
              </View>
            )}
            {lactario.isPrivate && (
              <View style={styles.inlinePrivateBadge}>
                <Lock size={10} color="#fff" />
                <Text style={styles.privateText}>Acceso Restringido</Text>
              </View>
            )}
          </View>
        )}
        <Text style={styles.name} numberOfLines={1}>{lactario.name}</Text>

        <View style={styles.row}>
          <MapPin size={14} color={colors.slate[400]} />
          <Text style={styles.address} numberOfLines={1}>
            {lactario.address || 'Ubicación no disponible'}
          </Text>
        </View>

        <View style={styles.row}>
          <Rating value={lactario.rating || 0} size={14} />
          <Text style={styles.ratingText}>{(lactario.rating || 0).toFixed(1)}</Text>
          <Text style={styles.reviewCount}>({lactario.reviews?.length || 0})</Text>
        </View>

        {amenities.length > 0 && (
          <View style={styles.amenitiesRow}>
            {amenities.slice(0, 3).map((a, i) => (
              <View key={i} style={styles.amenityChip}>
                <Text style={styles.amenityText}>{AMENITY_LABELS[a as keyof typeof AMENITY_LABELS] || a}</Text>
              </View>
            ))}
            {amenities.length > 3 && (
              <Text style={styles.moreText}>+{amenities.length - 3}</Text>
            )}
          </View>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.lg,
  },
  imageContainer: {
    position: 'relative',
  },
  image: {
    width: '100%',
    height: 160,
    backgroundColor: colors.slate[200],
  },
  statusOverlay: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
  },
  verifiedBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: colors.success,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
  },
  verifiedText: {
    ...typography.captionBold,
    color: colors.white,
  },
  privateBadge: {
    position: 'absolute',
    bottom: spacing.sm,
    left: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#6366f1',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
  },
  privateText: {
    ...typography.captionBold,
    color: colors.white,
    fontSize: 10,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  name: {
    ...typography.h4,
    color: colors.slate[800],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  address: {
    ...typography.small,
    color: colors.slate[500],
    flex: 1,
  },
  ratingText: {
    ...typography.smallBold,
    color: colors.slate[800],
    marginLeft: spacing.xs,
  },
  reviewCount: {
    ...typography.caption,
    color: colors.slate[400],
  },
  amenitiesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  amenityChip: {
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
  },
  amenityText: {
    ...typography.caption,
    color: colors.primary[700],
  },
  moreText: {
    ...typography.captionBold,
    color: colors.slate[400],
    alignSelf: 'center',
  },
  inlineBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  inlineVerifiedBadge: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
  },
  inlinePrivateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#6366f1',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
  },
});
