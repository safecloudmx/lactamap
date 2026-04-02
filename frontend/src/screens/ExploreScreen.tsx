import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  TouchableOpacity, Image,
} from 'react-native';
import { useFocusEffect, useNavigation, DrawerActions } from '@react-navigation/native';
import { SearchX, LayoutGrid, List, MapPin, Star, BadgeCheck } from 'lucide-react-native';
import { Lactario } from '../types';
import { getLactarios } from '../services/api';
import LactarioCard from '../components/LactarioCard';
import { AppHeader, SearchBar, Chip, EmptyState } from '../components/ui';
import { colors, spacing, typography, radii, shadows } from '../theme';

const PLACE_TYPE_FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'LACTARIO', label: '🤱 Lactarios' },
  { key: 'CAMBIADOR', label: '🚼 Cambiadores' },
  { key: 'BANO_FAMILIAR', label: '🚻 Baños Familiares' },
  { key: 'PUNTO_INTERES', label: '⭐ Puntos de Interés' },
];

type ViewMode = 'card' | 'list';

export default function ExploreScreen() {
  const navigation = useNavigation<any>();

  const [lactarios, setLactarios] = useState<Lactario[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTypeFilter, setActiveTypeFilter] = useState('all');
  const [viewMode, setViewMode] = useState<ViewMode>('card');

  const fetchLactarios = useCallback(async () => {
    try {
      const data = await getLactarios();
      setLactarios(data);
    } catch (error) {
      console.warn('Error fetching lactarios:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchLactarios();
    }, [fetchLactarios])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchLactarios();
  };

  const filteredLactarios = lactarios.filter((item) => {
    const matchesSearch =
      searchQuery.length === 0 ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.address && item.address.toLowerCase().includes(searchQuery.toLowerCase()));

    // Place type filter
    let matchesType = true;
    if (activeTypeFilter !== 'all') {
      matchesType = (item.placeType || 'LACTARIO') === activeTypeFilter;
    }

    return matchesSearch && matchesType;
  });

  const handleOpenDrawer = () => {
    navigation.getParent()?.dispatch(DrawerActions.openDrawer());
  };

  const handleCardPress = (room: Lactario) => {
    navigation.navigate('RoomDetail', { room });
  };

  const clearFilters = () => {
    setSearchQuery('');
    setActiveTypeFilter('all');
  };

  const renderCardItem = ({ item }: { item: Lactario }) => (
    <LactarioCard lactario={item} onPress={() => handleCardPress(item)} />
  );

  const renderListItem = ({ item }: { item: Lactario }) => (
    <TouchableOpacity
      style={styles.listItem}
      onPress={() => handleCardPress(item)}
      activeOpacity={0.7}
    >
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.listThumb} />
      ) : null}
      <View style={styles.listInfo}>
        <Text style={styles.listName} numberOfLines={1}>{item.name}</Text>
        {item.address ? (
          <View style={styles.listAddrRow}>
            <MapPin size={12} color={colors.slate[400]} />
            <Text style={styles.listAddr} numberOfLines={1}>{item.address}</Text>
          </View>
        ) : null}
        <View style={styles.listBottomRow}>
          {item.rating > 0 && (
            <View style={styles.listRatingRow}>
              <Star size={12} color={colors.warning} fill={colors.warning} />
              <Text style={styles.listRating}>{item.rating.toFixed(1)}</Text>
            </View>
          )}
          {item.isVerified && (
            <View style={styles.listVerified}>
              <BadgeCheck size={12} color={colors.success} />
              <Text style={styles.listVerifiedText}>Verificado</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <AppHeader
        title="Explorar"
        onMenuPress={handleOpenDrawer}
        rightAction={
          <View style={styles.viewToggle}>
            <TouchableOpacity
              style={[styles.viewBtn, viewMode === 'card' && styles.viewBtnActive]}
              onPress={() => setViewMode('card')}
            >
              <LayoutGrid size={18} color={viewMode === 'card' ? colors.primary[500] : colors.slate[400]} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewBtn, viewMode === 'list' && styles.viewBtnActive]}
              onPress={() => setViewMode('list')}
            >
              <List size={18} color={viewMode === 'list' ? colors.primary[500] : colors.slate[400]} />
            </TouchableOpacity>
          </View>
        }
      />

      <View style={styles.searchWrapper}>
        <SearchBar onSearch={setSearchQuery} placeholder="Buscar por nombre o dirección..." />
      </View>

      {/* Place type filters */}
      <View style={styles.filtersWrapper}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={PLACE_TYPE_FILTERS}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.filtersContent}
          renderItem={({ item }) => (
            <Chip
              label={item.label}
              selected={activeTypeFilter === item.key}
              onPress={() => setActiveTypeFilter(item.key)}
            />
          )}
        />
      </View>

      {/* Results count */}
      {!loading && (
        <View style={styles.resultsBar}>
          <Text style={styles.resultsText}>
            {filteredLactarios.length} ubicación{filteredLactarios.length !== 1 ? 'es' : ''}
          </Text>
        </View>
      )}

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      ) : (
        <FlatList
          data={filteredLactarios}
          keyExtractor={(item) => item.id}
          renderItem={viewMode === 'card' ? renderCardItem : renderListItem}
          contentContainerStyle={[
            styles.listContent,
            filteredLactarios.length === 0 && styles.emptyList,
          ]}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          ListEmptyComponent={
            <EmptyState
              icon={<SearchX size={32} color={colors.primary[500]} />}
              title="Sin resultados"
              subtitle="No se encontraron ubicaciones con los filtros seleccionados."
              actionLabel="Limpiar filtros"
              onAction={clearFilters}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.slate[50],
  },
  searchWrapper: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  filtersWrapper: {
    paddingBottom: spacing.xs,
  },
  filtersContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  resultsBar: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  resultsText: {
    ...typography.caption,
    color: colors.slate[400],
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxxl,
  },
  emptyList: {
    flexGrow: 1,
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: colors.slate[100],
    borderRadius: radii.md,
    padding: 2,
  },
  viewBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  viewBtnActive: {
    backgroundColor: colors.white,
    ...shadows.sm,
  },
  // List view styles
  listItem: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: radii.md,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    ...shadows.sm,
  },
  listThumb: {
    width: 80,
    height: 80,
  },
  listInfo: {
    flex: 1,
    padding: spacing.sm,
    justifyContent: 'center',
    gap: 3,
  },
  listName: {
    ...typography.bodyBold,
    color: colors.slate[800],
  },
  listAddrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  listAddr: {
    ...typography.caption,
    color: colors.slate[500],
    flex: 1,
  },
  listBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 2,
  },
  listRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  listRating: {
    ...typography.captionBold,
    color: colors.slate[600],
  },
  listVerified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  listVerifiedText: {
    ...typography.caption,
    color: colors.success,
  },
});
