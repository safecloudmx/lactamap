import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getExpirationInfo, formatDaysRemaining } from '../utils/expiration';
import { typography, radii, spacing } from '../theme';

interface Props {
  expirationDate?: string | null;
  storageStatus: string;
  compact?: boolean;
}

export default function ExpirationBadge({ expirationDate, storageStatus, compact }: Props) {
  const info = getExpirationInfo(expirationDate, storageStatus);
  if (!info) return null;

  return (
    <View style={[styles.badge, { backgroundColor: info.color + '15' }]}>
      <View style={[styles.dot, { backgroundColor: info.color }]} />
      <Text style={[styles.label, { color: info.color }]}>
        {info.label}
      </Text>
      {!compact && (
        <Text style={[styles.days, { color: info.color }]}>
          {formatDaysRemaining(info.daysRemaining)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    ...typography.caption,
    fontWeight: '600',
    fontSize: 10,
  },
  days: {
    ...typography.caption,
    fontSize: 10,
  },
});
