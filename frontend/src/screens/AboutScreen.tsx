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
        <Text style={styles.appName}>LactaMap - Acerca de</Text>
        <Text style={styles.version}>v0.1-260324-2</Text>

        {/* Mission */}
        <Text style={styles.mission}>
          Nuestra misión es facilitar la vida de madres y familias ayudándolas a
          encontrar espacios seguros, cómodos y dignos para la lactancia y el
          cuidado de sus bebés, en cualquier lugar.
        </Text>

        {/* Credits */}
        <Text style={styles.credits}>
          Proyecto creado y dirigido por María Rodríguez.{'\n'}
          Desarrollo por Eduardo Mosqueda.
        </Text>

        {/* Love message */}
        <View style={styles.loveRow}>
          <Text style={styles.loveText}>Hecho con</Text>
          <Heart size={16} color={colors.primary[500]} fill={colors.primary[500]} />
          <Text style={styles.loveText}>para madres y familias</Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>WARI</Text>
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
    marginBottom: spacing.xl,
  },
  credits: {
    ...typography.small,
    color: colors.slate[500],
    textAlign: 'center',
    lineHeight: 22,
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
