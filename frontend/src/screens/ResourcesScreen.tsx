import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft, Timer, Baby, Moon, BookOpen,
  Heart, Music, ClipboardList, Lock,
} from 'lucide-react-native';
import { colors, spacing, typography, radii, shadows } from '../theme';

interface ResourceItem {
  icon: any;
  title: string;
  description: string;
  color: string;
  bg: string;
  available: boolean;
  route?: string;
}

export default function ResourcesScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const resources: ResourceItem[] = [
    {
      icon: Timer,
      title: 'Cronómetro de Lactancia',
      description: 'Mide el tiempo de toma para cada pecho de forma independiente.',
      color: colors.primary[500],
      bg: colors.primary[50],
      available: true,
      route: 'NursingTimer',
    },
    {
      icon: ClipboardList,
      title: 'Registro de Extracción',
      description: 'Lleva un historial de mililitros por sesión y seguimiento diario.',
      color: colors.info,
      bg: colors.infoLight,
      available: true,
      route: 'PumpingHistory',
    },
    {
      icon: Moon,
      title: 'Temporizador de Sueño',
      description: 'Controla las horas de descanso de tu bebé con alertas suaves.',
      color: '#7c3aed',
      bg: '#f5f3ff',
      available: true,
      route: 'SleepTimer',
    },
    {
      icon: Baby,
      title: 'Registro de Pañales',
      description: 'Anota los cambios de pañal para llevar un control diario.',
      color: '#0d9488',
      bg: '#f0fdfa',
      available: true,
      route: 'DiaperLog',
    },
    {
      icon: Music,
      title: 'Sonidos Relajantes',
      description: 'Música suave y ruido blanco para acompañar la lactancia.',
      color: colors.warning,
      bg: colors.warningLight,
      available: true,
      route: 'RelaxingSounds',
    },
    {
      icon: BookOpen,
      title: 'Cápsulas Informativas',
      description: 'Guías y consejos sobre lactancia, nutrición y bienestar.',
      color: '#0891b2',
      bg: '#ecfeff',
      available: false,
    },
    {
      icon: Heart,
      title: 'Bienestar Emocional',
      description: 'Recursos de apoyo emocional y directorio de profesionales.',
      color: colors.error,
      bg: colors.errorLight,
      available: false,
    },
  ];

  const handlePress = (resource: ResourceItem) => {
    if (resource.available && resource.route) {
      navigation.navigate(resource.route);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ArrowLeft size={24} color={colors.slate[800]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Recursos</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.subtitle}>
          Herramientas de acompañamiento para ti y tu bebé. Nuevos recursos se irán agregando.
        </Text>

        {resources.map((resource, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.card, !resource.available && styles.cardDisabled]}
            onPress={() => handlePress(resource)}
            activeOpacity={resource.available ? 0.7 : 1}
          >
            <View style={[styles.cardIcon, { backgroundColor: resource.bg }]}>
              <resource.icon size={24} color={resource.available ? resource.color : colors.slate[400]} />
            </View>
            <View style={styles.cardContent}>
              <View style={styles.cardTitleRow}>
                <Text style={[styles.cardTitle, !resource.available && styles.cardTitleDisabled]}>
                  {resource.title}
                </Text>
                {!resource.available && (
                  <View style={styles.comingSoonBadge}>
                    <Lock size={10} color={colors.slate[500]} />
                    <Text style={styles.comingSoonText}>Próximamente</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.cardDescription, !resource.available && styles.cardDescDisabled]}>
                {resource.description}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.slate[50],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  headerTitle: {
    ...typography.h4,
    color: colors.slate[800],
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  subtitle: {
    ...typography.small,
    color: colors.slate[500],
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    gap: spacing.md,
    ...shadows.sm,
  },
  cardDisabled: {
    opacity: 0.65,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardContent: {
    flex: 1,
    gap: spacing.xs,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardTitle: {
    ...typography.bodyBold,
    color: colors.slate[800],
  },
  cardTitleDisabled: {
    color: colors.slate[500],
  },
  comingSoonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.slate[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  comingSoonText: {
    ...typography.caption,
    color: colors.slate[500],
    fontSize: 10,
  },
  cardDescription: {
    ...typography.small,
    color: colors.slate[500],
    lineHeight: 20,
  },
  cardDescDisabled: {
    color: colors.slate[400],
  },
});
