import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { MapPin, Baby, Star, Users } from 'lucide-react-native';
import { Lactario } from '../types';
import { ZoomTarget } from './MapComponent.web';
import { colors, spacing, shadows, radii } from '../theme';
import PulsingLocationMarker from './map/PulsingLocationMarker';

let Location: any = null;
try {
  Location = require('expo-location');
} catch (_) {}

interface MapComponentProps {
  lactarios?: Lactario[];
  onSelectRoom?: (lactario: Lactario) => void;
  zoomTarget?: ZoomTarget | null;
}

type FilterKey = 'LACTARIO' | 'CAMBIADOR' | 'BANO_FAMILIAR' | 'PUNTO_INTERES';

const FILTER_ITEMS: { key: FilterKey; emoji: string; color: string }[] = [
  { key: 'LACTARIO',      emoji: '🤱', color: '#f43f5e' },
  { key: 'CAMBIADOR',     emoji: '🚼', color: '#8b5cf6' },
  { key: 'BANO_FAMILIAR', emoji: '🚻', color: '#0d9488' },
  { key: 'PUNTO_INTERES', emoji: '⭐', color: '#f59e0b' },
];

const DEFAULT_REGION: Region = {
  latitude: 25.6866,
  longitude: -100.3161,
  latitudeDelta: 0.0922,
  longitudeDelta: 0.0421,
};

const PIN_COLORS: Record<string, string> = {
  LACTARIO: '#f43f5e',
  CAMBIADOR: '#8b5cf6',
  BANO_FAMILIAR: '#0d9488',
  PUNTO_INTERES: '#f59e0b',
};

const SPREAD_RADIUS = 0.00008; // ~9m — separates exact-duplicate markers

const PinIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'CAMBIADOR':     return <Baby size={14} color={colors.white} />;
    case 'BANO_FAMILIAR': return <Users size={14} color={colors.white} />;
    case 'PUNTO_INTERES': return <Star size={14} color={colors.white} />;
    default:              return <MapPin size={14} color={colors.white} />;
  }
};

export default function MapComponent({ lactarios = [], onSelectRoom, zoomTarget }: MapComponentProps) {
  const mapRef = useRef<MapView | null>(null);
  const [initialRegion, setInitialRegion] = useState<Region>(DEFAULT_REGION);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [activeFilters, setActiveFilters] = useState<Record<FilterKey, boolean>>({
    LACTARIO: true, CAMBIADOR: true, BANO_FAMILIAR: true, PUNTO_INTERES: true,
  });

  useEffect(() => {
    if (!zoomTarget || !mapRef.current) return;
    mapRef.current.animateToRegion({
      latitude: zoomTarget.lat,
      longitude: zoomTarget.lng,
      latitudeDelta: zoomTarget.zoom ? 0.01 / zoomTarget.zoom * 13 : 0.05,
      longitudeDelta: zoomTarget.zoom ? 0.01 / zoomTarget.zoom * 13 : 0.05,
    }, 800);
  }, [zoomTarget]);

  useEffect(() => {
    if (!Location) return;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setUserLocation(coords);
      setInitialRegion({ ...coords, latitudeDelta: 0.01, longitudeDelta: 0.01 });
      mapRef.current?.animateToRegion({ ...coords, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 1000);
    })();
  }, []);

  const handleFilterToggle = useCallback((key: FilterKey) => {
    setActiveFilters(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // Spread markers at identical coordinates so all are visible
  const displayMarkers = useMemo(() => {
    const coordMap = new Map<string, Lactario[]>();
    lactarios.forEach(l => {
      if (!l.latitude || !l.longitude) return;
      const key = `${l.latitude},${l.longitude}`;
      if (!coordMap.has(key)) coordMap.set(key, []);
      coordMap.get(key)!.push(l);
    });

    const result: Array<{ lactario: Lactario; lat: number; lng: number }> = [];
    coordMap.forEach((group) => {
      if (group.length === 1) {
        result.push({ lactario: group[0], lat: Number(group[0].latitude), lng: Number(group[0].longitude) });
      } else {
        group.forEach((l, i) => {
          const angle = (2 * Math.PI * i) / group.length - Math.PI / 2;
          result.push({
            lactario: l,
            lat: Number(l.latitude) + SPREAD_RADIUS * Math.cos(angle),
            lng: Number(l.longitude) + SPREAD_RADIUS * Math.sin(angle),
          });
        });
      }
    });
    return result;
  }, [lactarios]);

  // Visible counts based on active filters
  const visibleCounts = useMemo(() => {
    const counts = { LACTARIO: 0, CAMBIADOR: 0, BANO_FAMILIAR: 0, PUNTO_INTERES: 0 } as Record<FilterKey, number>;
    lactarios.forEach(l => {
      const t = (l.placeType || 'LACTARIO') as FilterKey;
      counts[t] = (counts[t] || 0) + 1;
    });
    return counts;
  }, [lactarios]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation={false}
        showsMyLocationButton={false}
        onPress={() => onSelectRoom && onSelectRoom(null as any)}
      >
        {userLocation && <PulsingLocationMarker coordinate={userLocation} />}

        {displayMarkers
          .filter(({ lactario }) => activeFilters[(lactario.placeType || 'LACTARIO') as FilterKey])
          .map(({ lactario, lat, lng }) => {
            const pt = lactario.placeType || 'LACTARIO';
            const pinColor = PIN_COLORS[pt] || PIN_COLORS.LACTARIO;
            return (
              <Marker
                key={lactario.id}
                coordinate={{ latitude: lat, longitude: lng }}
                onPress={() => onSelectRoom && onSelectRoom(lactario)}
                anchor={{ x: 0.5, y: 1 }}
              >
                <View style={styles.customPin}>
                  <View style={[styles.pinHead, { backgroundColor: pinColor }, lactario.isPrivate && styles.pinHeadPrivate]}>
                    <PinIcon type={pt} />
                  </View>
                  <View style={[styles.pinTail, { borderTopColor: pinColor }]} />
                </View>
              </Marker>
            );
          })}
      </MapView>

      {/* Filter bar overlay */}
      <View pointerEvents="box-none" style={styles.filterBarWrapper}>
        <View style={styles.filterBar}>
          {FILTER_ITEMS.map((item, i, arr) => (
            <React.Fragment key={item.key}>
              <TouchableOpacity
                style={styles.filterChip}
                onPress={() => handleFilterToggle(item.key)}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.filterCheckbox,
                  activeFilters[item.key] && { backgroundColor: item.color, borderColor: item.color },
                ]}>
                  {activeFilters[item.key] && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={[styles.chipEmoji, !activeFilters[item.key] && styles.dimmed]}>
                  {item.emoji}
                </Text>
                <Text style={[styles.chipCount, { color: activeFilters[item.key] ? item.color : colors.slate[300] }]}>
                  {visibleCounts[item.key] || 0}
                </Text>
              </TouchableOpacity>
              {i < arr.length - 1 && <View style={styles.separator} />}
            </React.Fragment>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, position: 'relative' },
  map: { width: '100%', height: '100%' },
  customPin: { alignItems: 'center' },
  pinHead: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  pinHeadPrivate: {
    borderStyle: 'dotted',
    borderColor: '#000000',
    borderWidth: 2.5,
  },
  pinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -2,
  },
  filterBarWrapper: {
    position: 'absolute',
    bottom: spacing.lg,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.97)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.full,
    ...shadows.md,
    gap: spacing.xs,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 3,
    borderRadius: radii.sm,
  },
  filterCheckbox: {
    width: 15,
    height: 15,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.slate[300],
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 12,
  },
  dimmed: { opacity: 0.35 },
  chipEmoji: { fontSize: 13 },
  chipCount: { fontSize: 13, fontWeight: '700' },
  separator: {
    width: 1,
    height: 16,
    backgroundColor: colors.slate[200],
  },
});
