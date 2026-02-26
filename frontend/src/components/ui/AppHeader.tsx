import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Menu, ArrowLeft } from 'lucide-react-native';
import { colors, typography, spacing, shadows } from '../../theme';

interface AppHeaderProps {
  title: string;
  onMenuPress?: () => void;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  transparent?: boolean;
}

export default function AppHeader({ title, onMenuPress, onBack, rightAction, transparent }: AppHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[
      styles.container,
      { paddingTop: insets.top + spacing.sm },
      transparent ? styles.transparent : styles.solid,
    ]}>
      <View style={styles.content}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.iconBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <ArrowLeft size={24} color={transparent ? colors.white : colors.slate[800]} />
          </TouchableOpacity>
        ) : onMenuPress ? (
          <TouchableOpacity onPress={onMenuPress} style={styles.iconBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Menu size={24} color={transparent ? colors.white : colors.slate[800]} />
          </TouchableOpacity>
        ) : (
          <View style={styles.iconBtn} />
        )}

        <Text style={[styles.title, transparent && styles.titleTransparent]} numberOfLines={1}>
          {title}
        </Text>

        <View style={styles.iconBtn}>
          {rightAction || null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    zIndex: 10,
  },
  solid: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
    ...shadows.sm,
  },
  transparent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    ...typography.h4,
    color: colors.slate[800],
  },
  titleTransparent: {
    color: colors.white,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
