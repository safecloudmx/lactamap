import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Trophy } from 'lucide-react-native';
import { getLeaderboard } from '../services/api';
import { AppHeader, AvatarInitials, EmptyState } from '../components/ui';
import { colors, spacing, typography, radii, shadows } from '../theme';

interface LeaderboardUser {
  id: string;
  name?: string;
  email: string;
  points: number;
}

const MEDAL_COLORS = [
  colors.starFilled,      // Gold
  '#94a3b8',              // Silver
  '#b45309',              // Bronze
];

const MEDAL_BG = [
  '#fef9c3',   // Gold bg
  '#f1f5f9',   // Silver bg
  '#fef3c7',   // Bronze bg
];

const MEDAL_EMOJI = ['1st', '2nd', '3rd'];

export default function LeaderboardScreen() {
  const navigation = useNavigation<any>();

  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const data = await getLeaderboard();
      setUsers(data);
    } catch (error) {
      console.warn('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchLeaderboard();
    }, [fetchLeaderboard])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchLeaderboard();
  };

  const top3 = users.slice(0, 3);
  const rest = users.slice(3);

  const renderTopUser = (user: LeaderboardUser, index: number) => {
    const displayName = user.name || user.email.split('@')[0];
    return (
      <View
        key={user.id}
        style={[
          styles.topCard,
          { backgroundColor: MEDAL_BG[index] },
          index === 0 && styles.topCardFirst,
        ]}
      >
        <View style={styles.topRankCircle}>
          <Text style={[styles.topRankText, { color: MEDAL_COLORS[index] }]}>
            {MEDAL_EMOJI[index]}
          </Text>
        </View>
        <AvatarInitials
          name={displayName}
          size={index === 0 ? 'lg' : 'md'}
          color={MEDAL_COLORS[index]}
        />
        <Text style={styles.topName} numberOfLines={1}>
          {displayName}
        </Text>
        <View style={styles.pointsBadge}>
          <Text style={styles.pointsValue}>{user.points.toLocaleString()}</Text>
          <Text style={styles.pointsLabel}>pts</Text>
        </View>
      </View>
    );
  };

  const renderRow = ({ item, index }: { item: LeaderboardUser; index: number }) => {
    const rank = index + 4;
    const displayName = item.name || item.email.split('@')[0];
    return (
      <View style={styles.row}>
        <Text style={styles.rankNumber}>{rank}</Text>
        <AvatarInitials name={displayName} size="sm" />
        <View style={styles.rowInfo}>
          <Text style={styles.rowName} numberOfLines={1}>
            {displayName}
          </Text>
        </View>
        <Text style={styles.rowPoints}>
          {item.points.toLocaleString()} pts
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <AppHeader
        title="Tabla de Posiciones"
        onBack={() => navigation.goBack()}
      />

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      ) : users.length === 0 ? (
        <EmptyState
          icon={<Trophy size={32} color={colors.primary[500]} />}
          title="Sin datos aun"
          subtitle="La tabla de posiciones se mostrara cuando haya usuarios con puntos."
        />
      ) : (
        <FlatList
          data={rest}
          keyExtractor={(item) => item.id}
          renderItem={renderRow}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={styles.topSection}>
              <View style={styles.topRow}>
                {top3.map((user, idx) => renderTopUser(user, idx))}
              </View>
            </View>
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
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
    paddingBottom: spacing.xxxl,
  },
  topSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
  },
  topCard: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: radii.lg,
    gap: spacing.sm,
    ...shadows.md,
  },
  topCardFirst: {
    transform: [{ scale: 1.05 }],
  },
  topRankCircle: {
    marginBottom: spacing.xs,
  },
  topRankText: {
    ...typography.captionBold,
    fontSize: 14,
  },
  topName: {
    ...typography.smallBold,
    color: colors.slate[800],
    textAlign: 'center',
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  pointsValue: {
    ...typography.h4,
    color: colors.primary[600],
  },
  pointsLabel: {
    ...typography.caption,
    color: colors.slate[400],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.white,
  },
  rankNumber: {
    ...typography.bodyBold,
    color: colors.slate[400],
    width: 28,
    textAlign: 'center',
  },
  rowInfo: {
    flex: 1,
  },
  rowName: {
    ...typography.body,
    color: colors.slate[800],
  },
  rowPoints: {
    ...typography.smallBold,
    color: colors.primary[600],
  },
  separator: {
    height: 1,
    backgroundColor: colors.slate[100],
    marginLeft: spacing.lg + 28 + spacing.md,
  },
});
