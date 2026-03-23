import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Modal } from 'react-native';
import { useFocusEffect, useNavigation, DrawerActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Menu, MapPinOff, Lock, Info } from 'lucide-react-native';
import { getLactarios } from '../services/api';
import { Lactario } from '../types';
import { colors, spacing, shadows, radii, typography } from '../theme';
import MapComponent from '../components/MapComponent';
import type { ZoomTarget } from '../components/MapComponent';
import MarkerPreviewSheet from '../components/map/MarkerPreviewSheet';
import { SearchBar } from '../components/ui';

const PRIVATE_MODAL_DISMISSED_KEY = '@LactaMap:privateModalDismissed';

export default function HomeScreen() {
  const [lactarios, setLactarios] = useState<Lactario[]>([]);
  const [filtered, setFiltered] = useState<Lactario[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<Lactario | null>(null);
  const [zoomTarget, setZoomTarget] = useState<ZoomTarget | null>(null);
  const [noResultsMsg, setNoResultsMsg] = useState<string | null>(null);
  const [showPrivateModal, setShowPrivateModal] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [privateModalDismissed, setPrivateModalDismissed] = useState(false);
  const pendingPrivateRoom = useRef<Lactario | null>(null);
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    AsyncStorage.getItem(PRIVATE_MODAL_DISMISSED_KEY).then((val) => {
      if (val === 'true') setPrivateModalDismissed(true);
    });
  }, []);

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

  const handleSelectRoom = (room: Lactario) => {
    if (room.isPrivate && !privateModalDismissed) {
      pendingPrivateRoom.current = room;
      setShowPrivateModal(true);
    } else {
      setSelectedRoom(room);
    }
  };

  const handlePrivateModalContinue = () => {
    if (dontShowAgain) {
      setPrivateModalDismissed(true);
      AsyncStorage.setItem(PRIVATE_MODAL_DISMISSED_KEY, 'true');
    }
    setShowPrivateModal(false);
    if (pendingPrivateRoom.current) {
      setSelectedRoom(pendingPrivateRoom.current);
      pendingPrivateRoom.current = null;
    }
    setDontShowAgain(false);
  };

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

      {/* Private Location Info Modal */}
      <Modal visible={showPrivateModal} transparent animationType="fade" onRequestClose={() => setShowPrivateModal(false)}>
        <View style={styles.privateModalBackdrop}>
          <View style={styles.privateModalCard}>
            <View style={styles.privateModalIconRow}>
              <Lock size={28} color="#6366f1" />
            </View>
            <Text style={styles.privateModalTitle}>Ubicación con Acceso Restringido</Text>
            <Text style={styles.privateModalDesc}>
              Esta ubicación se encuentra dentro de una <Text style={styles.privateModalBold}>institución privada</Text> (empresa, escuela, club, etc.) y su acceso puede estar controlado o limitado al público en general.
            </Text>
            <View style={styles.privateModalNote}>
              <Info size={16} color="#6366f1" />
              <Text style={styles.privateModalNoteText}>
                Te recomendamos verificar si puedes acceder antes de trasladarte.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.privateModalCheckRow}
              onPress={() => setDontShowAgain(!dontShowAgain)}
              activeOpacity={0.7}
            >
              <View style={[styles.privateModalCheckbox, dontShowAgain && styles.privateModalCheckboxActive]}>
                {dontShowAgain && <Text style={styles.privateModalCheckmark}>✓</Text>}
              </View>
              <Text style={styles.privateModalCheckLabel}>No mostrar otra vez</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.privateModalBtn} onPress={handlePrivateModalContinue}>
              <Text style={styles.privateModalBtnText}>Entendido</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
  // Private modal
  privateModalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: spacing.xxl },
  privateModalCard: { backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing.xxl, width: '100%', ...shadows.lg },
  privateModalIconRow: { alignItems: 'center', marginBottom: spacing.md },
  privateModalTitle: { ...typography.h3, color: colors.slate[800], textAlign: 'center', marginBottom: spacing.md },
  privateModalDesc: { ...typography.small, color: colors.slate[600], lineHeight: 22, marginBottom: spacing.md, textAlign: 'center' },
  privateModalBold: { fontWeight: '700', color: colors.slate[800] },
  privateModalNote: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: '#eef2ff', padding: spacing.md, borderRadius: radii.md, marginBottom: spacing.lg },
  privateModalNoteText: { ...typography.small, color: '#4338ca', flex: 1, lineHeight: 20 },
  privateModalCheckRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  privateModalCheckbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: colors.slate[300], alignItems: 'center', justifyContent: 'center' },
  privateModalCheckboxActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  privateModalCheckmark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  privateModalCheckLabel: { ...typography.small, color: colors.slate[600] },
  privateModalBtn: { backgroundColor: '#6366f1', paddingVertical: spacing.md, borderRadius: radii.md, alignItems: 'center' },
  privateModalBtnText: { ...typography.bodyBold, color: colors.white },
});
