import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme';

const SIZES = { sm: 32, md: 48, lg: 64, xl: 80 };

interface AvatarInitialsProps {
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: string;
}

export default function AvatarInitials({ name, size = 'md', color }: AvatarInitialsProps) {
  const s = SIZES[size];
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

  return (
    <View style={[styles.circle, { width: s, height: s, borderRadius: s / 2, backgroundColor: color || colors.primary[500] }]}>
      <Text style={[styles.text, { fontSize: s * 0.38 }]}>{initials || '?'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: colors.white,
    fontWeight: '700',
  },
});
