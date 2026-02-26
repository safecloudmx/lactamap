import React, { useState, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect, useNavigation, DrawerActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Menu } from 'lucide-react-native';
import { getLactarios } from '../services/api';
import { Lactario } from '../types';
import { colors, spacing, shadows, radii } from '../theme';
import MapComponent from '../components/MapComponent';
import MarkerPreviewSheet from '../components/map/MarkerPreviewSheet';
import { SearchBar } from '../components/ui';

export default function HomeScreen() {
  const [lactarios, setLactarios] = useState<Lactario[]>([]);
  const [filtered, setFiltered] = useState<Lactario[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<Lactario | null>(null);
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

  const handleSearch = (query: string) => {
    if (!query.trim()) {
      setFiltered(lactarios);
      return;
    }
    const q = query.toLowerCase();
    setFiltered(lactarios.filter((l) =>
      l.name.toLowerCase().includes(q) ||
      l.address?.toLowerCase().includes(q)
    ));
  };

  const handleSelectRoom = (room: Lactario) => {
    setSelectedRoom(room);
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
      />

      {/* Top overlay: hamburger + search */}
      <View style={[styles.topOverlay, { top: insets.top + spacing.sm }]}>
        <TouchableOpacity
          style={styles.menuBtn}
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
          activeOpacity={0.8}
        >
          <Menu size={22} color={colors.slate[700]} />
        </TouchableOpacity>
        <View style={styles.searchContainer}>
          <SearchBar placeholder="Buscar lactarios..." onSearch={handleSearch} />
        </View>
      </View>

      {/* Loading indicator */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      )}

      {/* Marker preview */}
      <MarkerPreviewSheet
        lactario={selectedRoom}
        onViewDetail={handleViewDetail}
        onDismiss={() => setSelectedRoom(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topOverlay: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    zIndex: 20,
  },
  menuBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  searchContainer: {
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
