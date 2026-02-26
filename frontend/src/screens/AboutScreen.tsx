import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Baby, Heart } from 'lucide-react-native';
import { AppHeader } from '../components/ui';
import { colors, spacing, typography, radii } from '../theme';

export default function AboutScreen() {
  const navigation = useNavigation<any>();

  return (
    <View style={styles.container}>
      <AppHeader
        title="Acerca de"
        onBack={() => navigation.goBack()}
      />

      <View style={styles.content}>
        {/* Icon */}
        <View style={styles.iconCircle}>
          <Baby size={48} color={colors.primary[500]} />
        </View>

        {/* Title */}
        <Text style={styles.appName}>LactaMap</Text>
        <Text style={styles.version}>v1.0.0</Text>

        {/* Mission */}
        <Text style={styles.mission}>
          Nuestra mision es facilitar la vida de madres y familias ayudandolas a
          encontrar espacios seguros, comodos y dignos para la lactancia y el
          cuidado de sus bebes, en cualquier lugar.
        </Text>

        {/* Love message */}
        <View style={styles.loveRow}>
          <Text style={styles.loveText}>Hecho con</Text>
          <Heart size={16} color={colors.primary[500]} fill={colors.primary[500]} />
          <Text style={styles.loveText}>para madres y familias</Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Developed by WARI</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.slate[50],
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxxl,
    paddingBottom: spacing.xxxl,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  appName: {
    ...typography.h1,
    color: colors.primary[600],
    marginBottom: spacing.xs,
  },
  version: {
    ...typography.small,
    color: colors.slate[400],
    marginBottom: spacing.xxl,
  },
  mission: {
    ...typography.body,
    color: colors.slate[600],
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: spacing.xxl,
  },
  loveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xxxl,
  },
  loveText: {
    ...typography.small,
    color: colors.slate[500],
  },
  footer: {
    position: 'absolute',
    bottom: spacing.xxxl,
  },
  footerText: {
    ...typography.captionBold,
    color: colors.slate[300],
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
