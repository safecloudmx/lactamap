import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radii, spacing, typography } from '../../theme';

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  ACTIVE: { bg: colors.successLight, text: colors.success, label: 'Activo' },
  PENDING: { bg: colors.warningLight, text: colors.warning, label: 'Pendiente' },
  CLOSED: { bg: colors.errorLight, text: colors.error, label: 'Cerrado' },
  MAINTENANCE: { bg: colors.infoLight, text: colors.info, label: 'Mantenimiento' },
};

interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;
  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <View style={[styles.dot, { backgroundColor: config.text }]} />
      <Text style={[styles.label, { color: config.text }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    ...typography.captionBold,
  },
});
