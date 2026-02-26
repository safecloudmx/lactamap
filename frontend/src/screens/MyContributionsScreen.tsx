import React, { useState, useCallback } from 'react';
import { View, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { FolderHeart } from 'lucide-react-native';
import { Lactario } from '../types';
import { getLactarios } from '../services/api';
import LactarioCard from '../components/LactarioCard';
import { AppHeader, EmptyState } from '../components/ui';
import { colors, spacing } from '../theme';

export default function MyContributionsScreen() {
  const navigation = useNavigation<any>();

  const [lactarios, setLactarios] = useState<Lactario[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchContributions = useCallback(async () => {
    try {
      const data = await getLactarios({ mine: true });
      setLactarios(data);
    } catch (error) {
      console.warn('Error fetching contributions:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchContributions();
    }, [fetchContributions])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchContributions();
  };

  const handleCardPress = (room: Lactario) => {
    navigation.navigate('RoomDetail', { room });
  };

  const renderItem = ({ item }: { item: Lactario }) => (
    <LactarioCard
      lactario={item}
      onPress={() => handleCardPress(item)}
      showStatus
    />
  );

  return (
    <View style={styles.container}>
      <AppHeader
        title="Mis Aportes"
        onBack={() => navigation.goBack()}
      />

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      ) : (
        <FlatList
          data={lactarios}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listContent,
            lactarios.length === 0 && styles.emptyList,
          ]}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          ListEmptyComponent={
            <EmptyState
              icon={<FolderHeart size={32} color={colors.primary[500]} />}
              title="Aun no has agregado lactarios"
              subtitle="Cuando agregues un lactario, aparecera aqui."
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
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  emptyList: {
    flexGrow: 1,
  },
});
