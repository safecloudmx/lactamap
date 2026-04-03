import React, { useState, useCallback, useEffect } from 'react';
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
  ToolCaseIcon, Moon, Pause, Play, Square,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useSleepTimerContext } from '../context/SleepTimerContext';
import { useNursingTimerContext } from '../context/NursingTimerContext';
import {
  getLactarios, getPartnerActiveTimers,
  pushPartnerActiveTimer, clearPartnerActiveTimer,
} from '../services/api';
import { Lactario, ActiveTimerState } from '../types';
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

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function computePartnerElapsed(t: ActiveTimerState): number {
  if (t.type === 'sleep') {
    if (t.pausedAt) {
      return Math.max(0, Math.floor(
        (new Date(t.pausedAt).getTime() - new Date(t.startedAt).getTime() - t.totalPausedMs) / 1000
      ));
    }
    return Math.max(0, Math.floor(
      (Date.now() - new Date(t.startedAt).getTime() - t.totalPausedMs) / 1000
    ));
  }
  // nursing: accumulate from leftMs/rightMs + running time since last server update
  let leftMs = t.leftMs;
  let rightMs = t.rightMs;
  if (!t.pausedAt && t.activeSide) {
    const sinceUpdate = Date.now() - new Date(t.updatedAt).getTime();
    if (t.activeSide === 'left') leftMs += sinceUpdate;
    else rightMs += sinceUpdate;
  }
  return Math.max(0, Math.floor((leftMs + rightMs) / 1000));
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const sleepTimer = useSleepTimerContext();
  const nursingTimer = useNursingTimerContext();
  const [nearbyCount, setNearbyCount] = useState(0);
  const [nearbyPlaces, setNearbyPlaces] = useState<PlaceWithDistance[]>([]);
  const [partnerTimers, setPartnerTimers] = useState<ActiveTimerState[]>([]);
  const [partnerElapsed, setPartnerElapsed] = useState<Record<string, number>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fullName = user?.name || user?.email?.split('@')[0] || 'Visitante';
  const firstName = fullName.split(' ')[0];
  const isMale = user?.sex === 'M';

  const loadPartnerTimers = useCallback(async () => {
    try {
      const timers: ActiveTimerState[] = await getPartnerActiveTimers();
      setPartnerTimers(timers);
      const elapsed: Record<string, number> = {};
      for (const t of timers) elapsed[t.id] = computePartnerElapsed(t);
      setPartnerElapsed(elapsed);
    } catch (_) {
      setPartnerTimers([]);
    }
  }, []);

  // Tick elapsed for running partner timers
  useEffect(() => {
    const hasRunning = partnerTimers.some(t => !t.pausedAt);
    if (!hasRunning) return;
    const id = setInterval(() => {
      setPartnerElapsed(() => {
        const next: Record<string, number> = {};
        for (const t of partnerTimers) next[t.id] = computePartnerElapsed(t);
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [partnerTimers]);

  const handlePartnerPause = useCallback(async (t: ActiveTimerState) => {
    setActionLoading(`${t.id}-pause`);
    try {
      const now = Date.now();
      let leftMs = t.leftMs;
      let rightMs = t.rightMs;
      if (t.type === 'nursing' && !t.pausedAt && t.activeSide) {
        const sinceUpdate = now - new Date(t.updatedAt).getTime();
        if (t.activeSide === 'left') leftMs += sinceUpdate;
        else rightMs += sinceUpdate;
      }
      await pushPartnerActiveTimer({
        type: t.type as 'nursing' | 'sleep',
        startedAt: t.startedAt,
        leftMs,
        rightMs,
        activeSide: t.activeSide,
        pausedAt: new Date(now).toISOString(),
        totalPausedMs: t.totalPausedMs,
        babyId: t.babyId,
        babyName: t.babyName,
      });
      await loadPartnerTimers();
    } catch (_) {} finally {
      setActionLoading(null);
    }
  }, [loadPartnerTimers]);

  const handlePartnerResume = useCallback(async (t: ActiveTimerState) => {
    setActionLoading(`${t.id}-resume`);
    try {
      const now = Date.now();
      const addedPause = t.pausedAt ? now - new Date(t.pausedAt).getTime() : 0;
      await pushPartnerActiveTimer({
        type: t.type as 'nursing' | 'sleep',
        startedAt: t.startedAt,
        leftMs: t.leftMs,
        rightMs: t.rightMs,
        activeSide: t.activeSide,
        pausedAt: null,
        totalPausedMs: t.totalPausedMs + addedPause,
        babyId: t.babyId,
        babyName: t.babyName,
      });
      await loadPartnerTimers();
    } catch (_) {} finally {
      setActionLoading(null);
    }
  }, [loadPartnerTimers]);

  const handlePartnerStop = useCallback(async (t: ActiveTimerState) => {
    setActionLoading(`${t.id}-stop`);
    try {
      // Backend handles session creation for the timer owner
      await clearPartnerActiveTimer(t.type as 'nursing' | 'sleep');
      setPartnerTimers(prev => prev.filter(x => x.id !== t.id));
    } catch (_) {} finally {
      setActionLoading(null);
    }
  }, []);

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
    useCallback(() => {
      loadData();
      loadPartnerTimers();
    }, [loadData, loadPartnerTimers])
  );

  // Refresh partner banners in real-time via socket
  useEffect(() => {
    if (!socket) return;
    const refresh = () => loadPartnerTimers();
    socket.on('timer:updated', refresh);
    socket.on('timer:cleared', refresh);
    return () => {
      socket.off('timer:updated', refresh);
      socket.off('timer:cleared', refresh);
    };
  }, [socket, loadPartnerTimers]);

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
        onRefresh={() => { loadData(); loadPartnerTimers(); }}
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

        {/* Partner Active Timer Banners */}
        {partnerTimers.map(t => {
          const elapsed = partnerElapsed[t.id] ?? computePartnerElapsed(t);
          const isPaused = !!t.pausedAt;
          const isNursing = t.type === 'nursing';
          const label = isNursing
            ? `Lactancia de tu pareja${t.babyName ? ` · ${t.babyName}` : ''}`
            : `Sueño de tu pareja${t.babyName ? ` · ${t.babyName}` : ''}`;
          const timeLabel = isNursing && t.activeSide
            ? `${formatElapsed(elapsed)} · ${t.activeSide === 'left' ? 'Izq' : 'Der'}`
            : formatElapsed(elapsed);
          return (
            <View key={t.id} style={styles.partnerBanner}>
              <View style={styles.sleepBannerLeft}>
                {isNursing
                  ? <Baby size={18} color="#7c3aed" />
                  : <Moon size={18} color="#7c3aed" />}
                <View style={{ flex: 1 }}>
                  <Text style={styles.partnerBannerTitle}>{label}</Text>
                  <Text style={styles.partnerBannerTime}>
                    {isPaused ? 'En pausa · ' : 'En curso · '}{timeLabel}
                  </Text>
                </View>
              </View>
              <View style={styles.partnerBannerActions}>
                {isPaused ? (
                  <TouchableOpacity
                    style={[styles.partnerActionBtn, styles.partnerResumeBtn]}
                    onPress={() => handlePartnerResume(t)}
                    disabled={actionLoading !== null}
                  >
                    <Play size={13} color="#fff" />
                    <Text style={styles.partnerActionText}>Reanudar</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.partnerActionBtn, styles.partnerPauseBtn]}
                    onPress={() => handlePartnerPause(t)}
                    disabled={actionLoading !== null}
                  >
                    <Pause size={13} color="#7c3aed" />
                    <Text style={[styles.partnerActionText, { color: '#7c3aed' }]}>Pausar</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.partnerActionBtn, styles.partnerStopBtn]}
                  onPress={() => handlePartnerStop(t)}
                  disabled={actionLoading !== null}
                >
                  <Square size={13} color="#fff" />
                  <Text style={styles.partnerActionText}>Detener</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {/* Active Nursing Timer Banner */}
        {nursingTimer.totalTime > 0 && (
          <TouchableOpacity
            style={[styles.sleepBanner, styles.nursingBanner]}
            onPress={() => navigation.navigate('NursingTimer')}
            activeOpacity={0.8}
          >
            <View style={styles.sleepBannerLeft}>
              <Baby size={18} color={colors.primary[600]} />
              <View>
                <Text style={[styles.sleepBannerTitle, styles.nursingBannerTitle]}>
                  Lactancia {nursingTimer.isPaused ? 'en pausa' : 'en curso'}
                  {nursingTimer.babyName ? ` · ${nursingTimer.babyName}` : ''}
                </Text>
                <Text style={[styles.sleepBannerTime, styles.nursingBannerTime]}>
                  {formatElapsed(nursingTimer.totalTime)}
                  {nursingTimer.activeSide ? ` · ${nursingTimer.activeSide === 'left' ? 'Izq' : 'Der'}` : ''}
                </Text>
              </View>
            </View>
            <ChevronRight size={16} color={colors.primary[600]} />
          </TouchableOpacity>
        )}

        {/* Active Sleep Timer Banner */}
        {sleepTimer.hasStarted && (
          <TouchableOpacity
            style={styles.sleepBanner}
            onPress={() => navigation.navigate('SleepTimer')}
            activeOpacity={0.8}
          >
            <View style={styles.sleepBannerLeft}>
              <Moon size={18} color="#7c3aed" />
              <View>
                <Text style={styles.sleepBannerTitle}>
                  Sueño {sleepTimer.isPaused ? 'en pausa' : 'en curso'}
                  {sleepTimer.babyName ? ` · ${sleepTimer.babyName}` : ''}
                </Text>
                <Text style={styles.sleepBannerTime}>{formatElapsed(sleepTimer.elapsedTime)}</Text>
              </View>
            </View>
            <ChevronRight size={16} color="#7c3aed" />
          </TouchableOpacity>
        )}

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
  nursingBanner: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[300],
  },
  nursingBannerTitle: {
    color: colors.primary[700],
  },
  nursingBannerTime: {
    color: colors.primary[500],
  },
  sleepBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f5f3ff',
    borderWidth: 1,
    borderColor: '#a78bfa',
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  sleepBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  sleepBannerTitle: {
    ...typography.smallBold,
    color: '#6d28d9',
  },
  sleepBannerTime: {
    ...typography.caption,
    color: '#7c3aed',
  },
  partnerBanner: {
    backgroundColor: '#faf5ff',
    borderWidth: 1,
    borderColor: '#a78bfa',
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  partnerBannerTitle: {
    ...typography.smallBold,
    color: '#6d28d9',
  },
  partnerBannerTime: {
    ...typography.caption,
    color: '#7c3aed',
  },
  partnerBannerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  partnerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    gap: spacing.xs,
  },
  partnerPauseBtn: {
    backgroundColor: '#ede9fe',
    borderWidth: 1,
    borderColor: '#a78bfa',
  },
  partnerResumeBtn: {
    backgroundColor: '#7c3aed',
  },
  partnerStopBtn: {
    backgroundColor: '#ef4444',
  },
  partnerActionText: {
    ...typography.caption,
    fontWeight: '600' as const,
    color: '#fff',
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
