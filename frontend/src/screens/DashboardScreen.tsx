import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Linking, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, DrawerActions } from '@react-navigation/native';
import {
  Menu, MapPin, Timer, BookOpen, Phone, ChevronRight,
  Baby, Heart, Star, Shield,
  ToolCaseIcon,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { getLactarios } from '../services/api';
import { Lactario } from '../types';
import { colors, spacing, typography, radii, shadows } from '../theme';

export default function DashboardScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [nearbyCount, setNearbyCount] = useState(0);
  const [recentLactarios, setRecentLactarios] = useState<Lactario[]>([]);

  const fullName = user?.name || user?.email?.split('@')[0] || 'Visitante';
  const firstName = fullName.split(' ')[0];

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const data = await getLactarios();
          setNearbyCount(data.length);
          setRecentLactarios(data.slice(0, 3));
        } catch (_) {}
      })();
    }, [])
  );

  const tools = [
    {
      icon: MapPin,
      title: 'Encontrar Lactario',
      subtitle: `${nearbyCount} espacios disponibles`,
      color: colors.primary[500],
      bg: colors.primary[50],
      onPress: () => navigation.navigate('HomeTabs', { screen: 'Mapa' }),
    },
    {
      icon: Timer,
      title: 'Sesiones',
      subtitle: 'Cronometro de lactancia',
      color: colors.info,
      bg: colors.infoLight,
      onPress: () => navigation.navigate('NursingTimer'),
    },
    {
      icon: ToolCaseIcon,
      title: 'Recursos',
      subtitle: 'Guias y acompañamiento',
      color: colors.success,
      bg: colors.successLight,
      onPress: () => navigation.navigate('Resources'),
    },
    {
      icon: Phone,
      title: 'Emergencia',
      subtitle: 'Llamar al 911',
      color: colors.error,
      bg: colors.errorLight,
      onPress: () => {
        const url = Platform.OS === 'web' ? 'tel:911' : 'tel:911';
        Linking.openURL(url).catch(() => {});
      },
    },
  ];

  const announcements = [
    {
      icon: Heart,
      title: 'Bienvenida a LactaMap',
      body: 'Encuentra espacios seguros y comodos para ti y tu bebe. Tu comunidad te respalda.',
      color: colors.primary[500],
    },
    {
      icon: Star,
      title: 'Contribuye y gana puntos',
      body: 'Califica lactarios, sube fotos y responde preguntas para subir de rango.',
      color: colors.warning,
    },
    {
      icon: Shield,
      title: 'Tu privacidad es primero',
      body: 'Tus datos de lactancia se guardan localmente. La sincronizacion es opcional.',
      color: colors.success,
    },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <TouchableOpacity
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Menu size={24} color={colors.white} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Baby size={20} color={colors.white} />
          <Text style={styles.headerTitle}>LactaMap</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome */}
        <View style={styles.welcomeSection}>
          <Text style={styles.greeting}>Hola, {firstName}</Text>
          <Text style={styles.welcomeText}>
            Bienvenida a LactaMap. Descubre los diferentes espacios que hay para ti y tu bebé. 
          </Text>
        </View>

        {/* Quick Tools Grid */}
        <View style={styles.toolsGrid}>
          {tools.map((tool, i) => (
            <TouchableOpacity
              key={i}
              style={styles.toolCard}
              onPress={tool.onPress}
              activeOpacity={0.7}
            >
              <View style={[styles.toolIcon, { backgroundColor: tool.bg }]}>
                <tool.icon size={24} color={tool.color} />
              </View>
              <Text style={styles.toolTitle}>{tool.title}</Text>
              <Text style={styles.toolSubtitle}>{tool.subtitle}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Nearby Lactarios Preview */}
        {recentLactarios.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Lactarios recientes</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('HomeTabs', { screen: 'Explorar' })}
              >
                <Text style={styles.seeAll}>Ver todos</Text>
              </TouchableOpacity>
            </View>
            {recentLactarios.map((l) => (
              <TouchableOpacity
                key={l.id}
                style={styles.lactarioRow}
                onPress={() => navigation.navigate('RoomDetail', { room: l })}
                activeOpacity={0.7}
              >
                <View style={styles.lactarioPin}>
                  <MapPin size={16} color={colors.primary[500]} />
                </View>
                <View style={styles.lactarioInfo}>
                  <Text style={styles.lactarioName} numberOfLines={1}>{l.name}</Text>
                  <Text style={styles.lactarioAddress} numberOfLines={1}>
                    {l.address || 'Sin direccion'}
                  </Text>
                </View>
                <View style={styles.lactarioRating}>
                  <Star size={12} color={colors.starFilled} fill={colors.starFilled} />
                  <Text style={styles.ratingText}>{(l.rating || 0).toFixed(1)}</Text>
                </View>
                <ChevronRight size={16} color={colors.slate[400]} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Announcements */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informacion</Text>
          {announcements.map((a, i) => (
            <View key={i} style={styles.announcementCard}>
              <View style={[styles.announcementIcon, { backgroundColor: a.color + '15' }]}>
                <a.icon size={20} color={a.color} />
              </View>
              <View style={styles.announcementContent}>
                <Text style={styles.announcementTitle}>{a.title}</Text>
                <Text style={styles.announcementBody}>{a.body}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ height: spacing.xxxl }} />
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
    paddingBottom: spacing.lg,
    backgroundColor: colors.primary[500],
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerTitle: {
    ...typography.h4,
    color: colors.white,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  welcomeSection: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    backgroundColor: colors.primary[500],
    borderBottomLeftRadius: radii.xxl,
    borderBottomRightRadius: radii.xxl,
  },
  greeting: {
    ...typography.h2,
    color: colors.white,
    marginBottom: spacing.xs,
  },
  welcomeText: {
    ...typography.body,
    color: colors.primary[200],
  },
  toolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  toolCard: {
    width: '48%',
    flexBasis: '48%',
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.md,
  },
  toolIcon: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolTitle: {
    ...typography.bodyBold,
    color: colors.slate[800],
  },
  toolSubtitle: {
    ...typography.caption,
    color: colors.slate[500],
  },
  section: {
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.slate[800],
    marginBottom: spacing.md,
  },
  seeAll: {
    ...typography.smallBold,
    color: colors.primary[500],
    marginBottom: spacing.md,
  },
  lactarioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
    ...shadows.sm,
  },
  lactarioPin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  lactarioInfo: {
    flex: 1,
    gap: 2,
  },
  lactarioName: {
    ...typography.smallBold,
    color: colors.slate[800],
  },
  lactarioAddress: {
    ...typography.caption,
    color: colors.slate[500],
  },
  lactarioRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  ratingText: {
    ...typography.captionBold,
    color: colors.starText,
  },
  announcementCard: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    gap: spacing.md,
    ...shadows.sm,
  },
  announcementIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  announcementContent: {
    flex: 1,
    gap: spacing.xs,
  },
  announcementTitle: {
    ...typography.smallBold,
    color: colors.slate[800],
  },
  announcementBody: {
    ...typography.caption,
    color: colors.slate[500],
    lineHeight: 18,
  },
});
