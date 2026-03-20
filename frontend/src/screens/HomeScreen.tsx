import React, { useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect, useNavigation, DrawerActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Menu, MapPinOff } from 'lucide-react-native';
import { getLactarios } from '../services/api';
import { Lactario } from '../types';
import { colors, spacing, shadows, radii, typography } from '../theme';
import MapComponent from '../components/MapComponent';
import type { ZoomTarget } from '../components/MapComponent';
import MarkerPreviewSheet from '../components/map/MarkerPreviewSheet';
import { SearchBar } from '../components/ui';

export default function HomeScreen() {
  const [lactarios, setLactarios] = useState<Lactario[]>([]);
  const [filtered, setFiltered] = useState<Lactario[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<Lactario | null>(null);
  const [zoomTarget, setZoomTarget] = useState<ZoomTarget | null>(null);
  const [noResultsMsg, setNoResultsMsg] = useState<string | null>(null);
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const loadLactarios = useCallback(async () => {
    try {
      const data = await getLactarios();
      setLactarios(data);
      setFiltered(data);
    } catch (err) {
      console.error('Error loading lactarios:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadLactarios();
      setSelectedRoom(null);
    }, [loadLactarios])
  );

  const handleSearch = useCallback(async (query: string) => {
    setNoResultsMsg(null);
    if (!query.trim()) {
      setFiltered(lactarios);
      setZoomTarget(null);
      return;
    }

    const q = query.toLowerCase();

    // 1. Filter by name, address, tags
    const nameMatches = lactarios.filter((l) =>
      l.name.toLowerCase().includes(q) ||
      l.address?.toLowerCase().includes(q) ||
      l.tags?.some((t) => t.toLowerCase().includes(q))
    );

    if (nameMatches.length > 0) {
      setFiltered(nameMatches);
      setZoomTarget(null);
      return;
    }

    // 2. No local matches → geocode with Nominatim
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
        { headers: { 'Accept-Language': 'es' } }
      );
      const data = await res.json();

      if (data && data.length > 0) {
        const { lat, lon, boundingbox } = data[0];
        const [minLat, maxLat, minLon, maxLon] = (boundingbox as string[]).map(Number);
        const geoLat = Number(lat);
        const geoLng = Number(lon);

        // Find lactarios within the bounding box
        const inBounds = lactarios.filter((l) => {
          const la = Number(l.latitude);
          const lo = Number(l.longitude);
          return la >= minLat && la <= maxLat && lo >= minLon && lo <= maxLon;
        });

        setZoomTarget({ lat: geoLat, lng: geoLng, zoom: 13 });

        if (inBounds.length > 0) {
          setFiltered(inBounds);
        } else {
          setFiltered([]);
          setNoResultsMsg(`No hay lactarios registrados en "${query}".`);
        }
      } else {
        setFiltered([]);
        setNoResultsMsg(`No se encontraron resultados para "${query}".`);
      }
    } catch {
      // Network error — fall back to empty
      setFiltered([]);
      setNoResultsMsg('No se encontraron resultados.');
    }
  }, [lactarios]);

  const handleSelectRoom = (room: Lactario) => setSelectedRoom(room);

  const handleViewDetail = (room: Lactario) => {
    setSelectedRoom(null);
    navigation.navigate('RoomDetail', { room });
  };

  return (
    <View style={styles.container}>
      <MapComponent
        lactarios={filtered}
        onSelectRoom={handleSelectRoom}
        zoomTarget={zoomTarget}
      />

      {/* Top overlay: hamburger + search */}
      <View style={[styles.topOverlay, { top: insets.top + spacing.sm }]}>
        <View style={styles.searchContainer}>
          <SearchBar placeholder="Buscar lactarios o zona..." onSearch={handleSearch} debounceMs={600} />
        </View>
        <TouchableOpacity
          style={styles.menuBtn}
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
          activeOpacity={0.8}
        >
          <Menu size={22} color={colors.slate[700]} />
        </TouchableOpacity>
      </View>

      {/* No results banner */}
      {noResultsMsg && (
        <View style={[styles.noResultsBanner, { top: insets.top + spacing.sm + 54 }]}>
          <MapPinOff size={14} color={colors.warning} />
          <Text style={styles.noResultsText}>{noResultsMsg}</Text>
        </View>
      )}

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      )}

      <MarkerPreviewSheet
        lactario={selectedRoom}
        onViewDetail={handleViewDetail}
        onDismiss={() => setSelectedRoom(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topOverlay: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    zIndex: 20,
  },
  searchContainer: { flex: 1 },
  menuBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  noResultsBanner: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.warningLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    zIndex: 18,
    ...shadows.sm,
  },
  noResultsText: {
    ...typography.caption,
    color: colors.warning,
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: '50%',
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: radii.md,
    padding: spacing.lg,
    ...shadows.md,
  },
});
