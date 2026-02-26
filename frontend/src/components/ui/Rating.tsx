import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Star } from 'lucide-react-native';
import { colors, spacing } from '../../theme';

interface RatingProps {
  value: number;
  size?: number;
  onChange?: (value: number) => void;
  readonly?: boolean;
}

export default function Rating({ value, size = 18, onChange, readonly = true }: RatingProps) {
  return (
    <View style={styles.container}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= Math.round(value);
        const StarView = (
          <Star
            key={star}
            size={size}
            color={filled ? colors.starFilled : colors.starEmpty}
            fill={filled ? colors.starFilled : 'transparent'}
          />
        );

        if (!readonly && onChange) {
          return (
            <TouchableOpacity key={star} onPress={() => onChange(star)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
              {StarView}
            </TouchableOpacity>
          );
        }
        return <View key={star}>{StarView}</View>;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
  },
});
