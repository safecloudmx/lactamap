import React from 'react';
import { Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { colors, radii, spacing, typography } from '../../theme';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
  style?: ViewStyle;
}

export default function Chip({ label, selected, onPress, size = 'md', icon, style }: ChipProps) {
  return (
    <TouchableOpacity
      style={[
        styles.base,
        size === 'sm' && styles.sm,
        selected ? styles.selected : styles.unselected,
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
    >
      {icon}
      <Text style={[
        styles.label,
        size === 'sm' && styles.labelSm,
        selected ? styles.labelSelected : styles.labelUnselected,
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    borderWidth: 1.5,
  },
  sm: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  selected: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
  },
  unselected: {
    backgroundColor: colors.white,
    borderColor: colors.slate[200],
  },
  label: {
    ...typography.small,
    fontWeight: '600',
  },
  labelSm: {
    ...typography.caption,
  },
  labelSelected: {
    color: colors.white,
  },
  labelUnselected: {
    color: colors.slate[600],
  },
});
