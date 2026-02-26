import React, { useState, useCallback } from 'react';
import { View, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { DrawerActions } from '@react-navigation/native';
import { SearchX } from 'lucide-react-native';
import { GenderAccess, Lactario } from '../types';
import { getLactarios } from '../services/api';
import LactarioCard from '../components/LactarioCard';
import { AppHeader, SearchBar, Chip, EmptyState } from '../components/ui';
import { colors, spacing } from '../theme';

const FILTER_OPTIONS = [
  { key: 'all', label: 'Todos' },
  { key: GenderAccess.WOMEN, label: GenderAccess.WOMEN },
  { key: GenderAccess.MEN, label: GenderAccess.MEN },
  { key: GenderAccess.NEUTRAL, label: GenderAccess.NEUTRAL },
  { key: 'verified', label: 'Verificado' },
];

export default function ExploreScreen() {
  const navigation = useNavigation<any>();

  const [lactarios, setLactarios] = useState<Lactario[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

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
    // Search filter
    const matchesSearch =
      searchQuery.length === 0 ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.address && item.address.toLowerCase().includes(searchQuery.toLowerCase()));

    // Category filter
    let matchesFilter = true;
    if (activeFilter === 'verified') {
      matchesFilter = !!item.isVerified;
    } else if (activeFilter !== 'all') {
      matchesFilter = item.access === activeFilter;
    }

    return matchesSearch && matchesFilter;
  });

  const handleOpenDrawer = () => {
    navigation.getParent()?.dispatch(DrawerActions.openDrawer());
  };

  const handleCardPress = (room: Lactario) => {
    navigation.navigate('RoomDetail', { room });
  };

  const renderItem = ({ item }: { item: Lactario }) => (
    <LactarioCard lactario={item} onPress={() => handleCardPress(item)} />
  );

  return (
    <View style={styles.container}>
      <AppHeader title="Explorar" onMenuPress={handleOpenDrawer} />

      <View style={styles.searchWrapper}>
        <SearchBar onSearch={setSearchQuery} placeholder="Buscar por nombre o direccion..." />
      </View>

      <View style={styles.filtersWrapper}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={FILTER_OPTIONS}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.filtersContent}
          renderItem={({ item }) => (
            <Chip
              label={item.label}
              selected={activeFilter === item.key}
              onPress={() => setActiveFilter(item.key)}
            />
          )}
        />
      </View>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      ) : (
        <FlatList
          data={filteredLactarios}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
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
              subtitle="No se encontraron lactarios con los filtros seleccionados."
              actionLabel="Limpiar filtros"
              onAction={() => {
                setSearchQuery('');
                setActiveFilter('all');
              }}
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
    paddingBottom: spacing.sm,
  },
  filtersContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
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
});
