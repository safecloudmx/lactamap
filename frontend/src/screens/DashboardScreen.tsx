import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Linking, Platform,
} from 'react-native';
import RefreshableScroll from '../components/ui/RefreshableScroll';
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

let Location: any = null;
try { Location = require('expo-location'); } catch (_) {}

// Haversine distance calculator (km)
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const PLACE_TYPE_INFO: Record<string, { emoji: string; color: string; label: string }> = {
  LACTARIO: { emoji: '🤱', color: '#f43f5e', label: 'Lactario' },
  CAMBIADOR: { emoji: '🚼', color: '#8b5cf6', label: 'Cambiador' },
  BANO_FAMILIAR: { emoji: '🚻', color: '#0d9488', label: 'Baño Familiar' },
  PUNTO_INTERES: { emoji: '⭐', color: '#f59e0b', label: 'Punto de Interés' },
};

interface PlaceWithDistance extends Lactario {
  distance: number;
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [nearbyCount, setNearbyCount] = useState(0);
  const [nearbyPlaces, setNearbyPlaces] = useState<PlaceWithDistance[]>([]);

  const fullName = user?.name || user?.email?.split('@')[0] || 'Visitante';
  const firstName = fullName.split(' ')[0];
  const isMale = user?.sex === 'M';

  const loadData = useCallback(async () => {
    try {
      // Get user location
      let userLat = 25.6866, userLng = -100.3161; // Default Monterrey
      if (Location) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          userLat = loc.coords.latitude;
          userLng = loc.coords.longitude;
        }
      }

      // Get all places and filter by distance (5km, expand to 10km if needed)
      const data = await getLactarios();
      const withDistance = data.map((place: Lactario) => ({
        ...place,
        distance: getDistance(userLat, userLng, place.latitude || 0, place.longitude || 0),
      }));

      // Try 5km first, expand to 10km if no results
      let nearby = withDistance
        .filter((place: PlaceWithDistance) => place.distance <= 5)
        .sort((a: PlaceWithDistance, b: PlaceWithDistance) => a.distance - b.distance)
        .slice(0, 3);

      if (nearby.length === 0) {
        nearby = withDistance
          .filter((place: PlaceWithDistance) => place.distance <= 10)
          .sort((a: PlaceWithDistance, b: PlaceWithDistance) => a.distance - b.distance)
          .slice(0, 3);
      }

      setNearbyCount(nearby.length);
      setNearbyPlaces(nearby);
    } catch (_) {}
  }, []);

  useFocusEffect(
    useCallback(() => { loadData(); }, [loadData])
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
      subtitle: 'Cronómetro de lactancia',
      color: colors.info,
      bg: colors.infoLight,
      onPress: () => navigation.navigate('NursingTimer'),
    },
    {
      icon: ToolCaseIcon,
      title: 'Recursos',
      subtitle: 'Guías y acompañamiento',
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
      title: isMale ? 'Bienvenido a LactaMap' : 'Bienvenida a LactaMap',
      body: 'Encuentra espacios seguros y cómodos para ti y tu bebé. Tu comunidad te respalda.',
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
      body: 'Tus datos de lactancia se guardan localmente. La sincronización es opcional.',
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

      <RefreshableScroll
        onRefresh={loadData}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome */}
        <View style={styles.welcomeSection}>
          <Text style={styles.greeting}>Hola, {firstName}</Text>
          <Text style={styles.welcomeText}>
            {isMale ? 'Bienvenido' : 'Bienvenida'} a LactaMap. Descubre los diferentes espacios que hay para ti y tu bebé.
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

        {/* Nearby Places Preview */}
        {nearbyPlaces.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Puntos Cercanos</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('HomeTabs', { screen: 'Mapa' })}
              >
                <Text style={styles.seeAll}>Ver en mapa</Text>
              </TouchableOpacity>
            </View>
            {nearbyPlaces.map((place: PlaceWithDistance) => {
              const placeType = place.placeType || 'LACTARIO';
              const typeInfo = PLACE_TYPE_INFO[placeType];
              return (
                <TouchableOpacity
                  key={place.id}
                  style={styles.lactarioRow}
                  onPress={() => navigation.navigate('RoomDetail', { room: place })}
                  activeOpacity={0.7}
                >
                  <View style={[styles.lactarioPin, { backgroundColor: typeInfo.color + '20' }]}>
                    <Text style={styles.placeEmoji}>{typeInfo.emoji}</Text>
                  </View>
                  <View style={styles.lactarioInfo}>
                    <Text style={styles.lactarioName} numberOfLines={1}>{place.name}</Text>
                    <Text style={styles.lactarioAddress} numberOfLines={1}>
                      {place.distance.toFixed(1)} km • {place.address || 'Sin dirección'}
                    </Text>
                  </View>
                  <View style={styles.lactarioRating}>
                    <Star size={12} color={colors.starFilled} fill={colors.starFilled} />
                    <Text style={styles.ratingText}>{(place.rating || 0).toFixed(1)}</Text>
                  </View>
                  <ChevronRight size={16} color={colors.slate[400]} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Announcements */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información</Text>
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
      </RefreshableScroll>
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
  placeEmoji: {
    fontSize: 18,
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
