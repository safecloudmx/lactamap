import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Map, Compass, Stethoscope, User } from 'lucide-react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { colors, spacing, typography, shadows } from '../theme';

const TAB_CONFIG: Record<string, { icon: any; label: string }> = {
  Inicio: { icon: Home, label: 'Inicio' },
  Mapa: { icon: Map, label: 'Mapa' },
  Explorar: { icon: Compass, label: 'Explorar' },
  Recursos: { icon: Stethoscope, label: 'Recursos' },
  Perfil: { icon: User, label: 'Perfil' },
};

export default function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      {state.routes.map((route, index) => {
        const config = TAB_CONFIG[route.name];
        if (!config) return null;

        const isFocused = state.index === index;
        const Icon = config.icon;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <TouchableOpacity
            key={route.key}
            style={styles.tab}
            onPress={onPress}
            activeOpacity={0.7}
          >
            <Icon
              size={22}
              color={isFocused ? colors.primary[500] : colors.slate[400]}
            />
            <Text style={[
              styles.label,
              { color: isFocused ? colors.primary[500] : colors.slate[400] },
              isFocused && styles.labelActive,
            ]}>
              {config.label}
            </Text>
            {isFocused && <View style={styles.indicator} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
    paddingTop: spacing.sm,
    ...shadows.lg,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    position: 'relative',
  },
  label: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  labelActive: {
    fontWeight: '700',
  },
  indicator: {
    position: 'absolute',
    top: -spacing.sm,
    width: 20,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.primary[500],
  },
});
