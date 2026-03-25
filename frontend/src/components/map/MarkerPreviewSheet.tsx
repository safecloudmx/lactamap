import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet, Dimensions } from 'react-native';
import { ChevronRight, X, Users, Lock } from 'lucide-react-native';
import { Lactario } from '../../types';
import { colors, spacing, typography, radii, shadows } from '../../theme';
import { Rating } from '../ui';
import { AMENITY_LABELS } from '../../constants';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface MarkerPreviewSheetProps {
  lactario: Lactario | null;
  onViewDetail: (lactario: Lactario) => void;
  onDismiss: () => void;
}

export default function MarkerPreviewSheet({ lactario, onViewDetail, onDismiss }: MarkerPreviewSheetProps) {
  const translateY = useRef(new Animated.Value(200)).current;

  useEffect(() => {
    if (lactario) {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 200,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: 200,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [lactario, translateY]);

  if (!lactario) return null;

  const amenities = lactario.amenities || [];
  const reviewCount = lactario.reviewCount ?? lactario.reviews?.length ?? 0;

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }] }]}>
      <View style={styles.sheet}>
        <TouchableOpacity style={styles.closeBtn} onPress={onDismiss}>
          <X size={18} color={colors.slate[400]} />
        </TouchableOpacity>

        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{lactario.name}</Text>
          {(lactario as any).floorCount > 0 ? (
            <View style={[styles.typeBadge, { backgroundColor: '#1e293b' }]}>
              <Text style={[styles.typeBadgeText, { color: '#f8fafc' }]}>🏢 Edificio</Text>
            </View>
          ) : lactario.placeType ? (
            <View style={[styles.typeBadge,
              lactario.placeType === 'CAMBIADOR' && styles.typeBadgeCambiador,
              lactario.placeType === 'BANO_FAMILIAR' && { backgroundColor: '#ccfbf1' },
              lactario.placeType === 'PUNTO_INTERES' && { backgroundColor: '#fef3c7' },
            ]}>
              <Text style={[styles.typeBadgeText,
                lactario.placeType === 'CAMBIADOR' && styles.typeBadgeTextCambiador,
                lactario.placeType === 'BANO_FAMILIAR' && { color: '#0f766e' },
                lactario.placeType === 'PUNTO_INTERES' && { color: '#d97706' },
              ]}>
                {lactario.placeType === 'CAMBIADOR' ? '🚼 Cambiador' : lactario.placeType === 'BANO_FAMILIAR' ? '🚻 Baño Familiar' : lactario.placeType === 'PUNTO_INTERES' ? '⭐ Punto de Interés' : '🤱 Lactario'}
              </Text>
            </View>
          ) : null}
        </View>

        {lactario.isPrivate && (
          <View style={styles.privateBadgeRow}>
            <Lock size={12} color="#4338ca" />
            <Text style={styles.privateBadgeText}>Acceso Restringido</Text>
          </View>
        )}

        <View style={styles.row}>
          <Rating value={lactario.rating || 0} size={14} />
          <Text style={styles.ratingText}>{(lactario.rating || 0).toFixed(1)}</Text>
          <Text style={styles.reviewCount}>({reviewCount} reseñas)</Text>
        </View>

        {lactario.description ? (
          <Text style={styles.description} numberOfLines={2}>
            {lactario.description}
          </Text>
        ) : null}

        {lactario.access && (
          <View style={styles.row}>
            <Users size={14} color={colors.slate[400]} />
            <Text style={styles.accessText}>{lactario.access}</Text>
          </View>
        )}

        {amenities.length > 0 && (
          <View style={styles.amenitiesRow}>
            {amenities.slice(0, 4).map((a, i) => (
              <View key={i} style={styles.amenityChip}>
                <Text style={styles.amenityText}>
                  {AMENITY_LABELS[a as keyof typeof AMENITY_LABELS] || a}
                </Text>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={styles.detailBtn}
          onPress={() => onViewDetail(lactario)}
          activeOpacity={0.8}
        >
          <Text style={styles.detailBtnText}>Ver detalles</Text>
          <ChevronRight size={18} color={colors.white} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 90,
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 50,
  },
  sheet: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.xl,
  },
  closeBtn: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    zIndex: 1,
    padding: spacing.xs,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingRight: spacing.xxl,
  },
  name: {
    ...typography.h4,
    color: colors.slate[800],
    flex: 1,
  },
  typeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
    backgroundColor: '#fff1f2',
  },
  typeBadgeCambiador: {
    backgroundColor: '#ede9fe',
  },
  typeBadgeText: {
    ...typography.caption,
    color: '#e11d48',
    fontWeight: '700',
  },
  typeBadgeTextCambiador: {
    color: '#7c3aed',
  },
  privateBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#eef2ff',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.full,
    alignSelf: 'flex-start',
  },
  privateBadgeText: {
    ...typography.caption,
    color: '#4338ca',
    fontWeight: '700',
    fontSize: 11,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
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
  description: {
    ...typography.small,
    color: colors.slate[500],
    lineHeight: 20,
  },
  accessText: {
    ...typography.small,
    color: colors.slate[500],
  },
  amenitiesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
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
  detailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[500],
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  detailBtnText: {
    ...typography.button,
    color: colors.white,
  },
});
