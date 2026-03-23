import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { ImageOff } from 'lucide-react-native';
import { colors, typography } from '../../theme';

interface PlaceholderImageProps {
  style?: ViewStyle;
  message?: string;
}

export default function PlaceholderImage({ style, message = 'Sin imagen disponible' }: PlaceholderImageProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconCircle}>
        <ImageOff size={28} color={colors.slate[400]} />
      </View>
      <Text style={styles.brand}>LactaMap</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.slate[100],
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    ...typography.captionBold,
    color: colors.primary[500],
    letterSpacing: 1,
  },
  message: {
    ...typography.caption,
    color: colors.slate[400],
  },
});
