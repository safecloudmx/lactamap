import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SectionList,
} from 'react-native';
import { confirmAlert } from '../services/crossPlatformAlert';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Clock, Trash2 } from 'lucide-react-native';
import { colors, spacing, typography, radii, shadows } from '../theme';
import { FeedingSession, Baby } from '../types';
import { formatDuration } from '../hooks/useNursingTimer';
import * as nursingStorage from '../services/nursingStorage';
import { EmptyState } from '../components/ui';

type Section = { title: string; data: FeedingSession[] };

function formatSessionTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function getRelativeDateLabel(dateStr: string): string {
  const today = new Date();
  const date = new Date(dateStr);

  const todayStr = today.toISOString().slice(0, 10);
  const dateOnlyStr = date.toISOString().slice(0, 10);

  if (dateOnlyStr === todayStr) return 'Hoy';

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateOnlyStr === yesterday.toISOString().slice(0, 10)) return 'Ayer';

  const days = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
}

function groupByDate(sessions: FeedingSession[]): Section[] {
  const groups: Record<string, FeedingSession[]> = {};
  for (const s of sessions) {
    const key = new Date(s.startedAt).toISOString().slice(0, 10);
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  }
  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dateStr, data]) => ({
      title: getRelativeDateLabel(dateStr),
      data,
    }));
}

function getSideLabel(side: string): string {
  if (side === 'left') return 'Izq';
  if (side === 'right') return 'Der';
  return 'Ambos';
}

export default function FeedingHistoryScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [sessions, setSessions] = useState<FeedingSession[]>([]);
  const [babies, setBabies] = useState<Baby[]>([]);
  const [filterBabyId, setFilterBabyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [sessionsData, babiesData] = await Promise.all([
      nursingStorage.getSessions(),
      nursingStorage.getBabies(),
    ]);
    setSessions(sessionsData);
    setBabies(babiesData);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const filteredSessions = useMemo(() => {
    if (!filterBabyId) return sessions;
    return sessions.filter((s) => s.babyId === filterBabyId);
  }, [sessions, filterBabyId]);

  const sections = useMemo(() => groupByDate(filteredSessions), [filteredSessions]);

  const getBabyName = (babyId?: string) => {
    if (!babyId) return null;
    return babies.find((b) => b.id === babyId)?.name ?? null;
  };

  const handleDelete = (session: FeedingSession) => {
    confirmAlert(
      'Eliminar sesion',
      `¿Eliminar la sesion de ${formatSessionTime(session.startedAt)}?`,
      async () => {
        await nursingStorage.deleteSession(session.id);
        setSessions((prev) => prev.filter((s) => s.id !== session.id));
      }
    );
  };

  const renderSession = ({ item }: { item: FeedingSession }) => {
    const babyName = getBabyName(item.babyId);
    return (
      <TouchableOpacity
        style={styles.sessionCard}
        onPress={() => navigation.navigate('FeedingSessionDetail', { sessionId: item.id })}
        onLongPress={() => handleDelete(item)}
        activeOpacity={0.7}
      >
        <View style={styles.sessionHeader}>
          <View style={styles.sessionTimeRow}>
            <Text style={styles.sessionEmoji}>🤱</Text>
            <View>
              <Text style={styles.sessionTimeRange}>
                {formatSessionTime(item.startedAt)} - {formatSessionTime(item.endedAt)}
              </Text>
              {babyName && (
                <Text style={styles.sessionBaby}>{babyName}</Text>
              )}
            </View>
          </View>
          <TouchableOpacity
            onPress={() => handleDelete(item)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Trash2 size={16} color={colors.slate[400]} />
          </TouchableOpacity>
        </View>

        <View style={styles.sessionDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Duracion</Text>
            <Text style={styles.detailValue}>{formatDuration(item.totalDuration)}</Text>
          </View>
          <View style={styles.sidesRow}>
            <View style={[styles.sideBadge, item.leftDuration > 0 && styles.sideBadgeActive]}>
              <Text style={[styles.sideBadgeText, item.leftDuration > 0 && styles.sideBadgeTextActive]}>
                Izq: {formatDuration(item.leftDuration)}
              </Text>
            </View>
            <View style={[styles.sideBadge, item.rightDuration > 0 && styles.sideBadgeActive]}>
              <Text style={[styles.sideBadgeText, item.rightDuration > 0 && styles.sideBadgeTextActive]}>
                Der: {formatDuration(item.rightDuration)}
              </Text>
            </View>
          </View>
          {item.totalPauseTime > 0 && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Pausa</Text>
              <Text style={styles.detailValueMuted}>{formatDuration(item.totalPauseTime)}</Text>
            </View>
          )}
          {item.notes.length > 0 && (
            <Text style={styles.sessionNotes} numberOfLines={2}>
              {item.notes}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = ({ section }: { section: Section }) => (
    <Text style={styles.sectionHeader}>{section.title}</Text>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ArrowLeft size={24} color={colors.slate[800]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Historial de Lactancia</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Baby Filter */}
      {babies.length > 0 && (
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterChip, !filterBabyId && styles.filterChipSelected]}
            onPress={() => setFilterBabyId(null)}
          >
            <Text style={[styles.filterChipText, !filterBabyId && styles.filterChipTextSelected]}>
              Todos
            </Text>
          </TouchableOpacity>
          {babies.map((baby) => (
            <TouchableOpacity
              key={baby.id}
              style={[styles.filterChip, filterBabyId === baby.id && styles.filterChipSelected]}
              onPress={() => setFilterBabyId(filterBabyId === baby.id ? null : baby.id)}
            >
              <Text style={[
                styles.filterChipText,
                filterBabyId === baby.id && styles.filterChipTextSelected,
              ]}>
                {baby.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Sessions List */}
      {!loading && filteredSessions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <EmptyState
            icon={<Clock size={48} color={colors.slate[300]} />}
            title="Sin sesiones registradas"
            subtitle="Las sesiones que registres en el cronometro apareceran aqui."
          />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderSession}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  headerTitle: {
    ...typography.h4,
    color: colors.slate[800],
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  filterChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.slate[100],
  },
  filterChipSelected: {
    backgroundColor: colors.primary[500],
  },
  filterChipText: {
    ...typography.smallBold,
    color: colors.slate[600],
  },
  filterChipTextSelected: {
    color: colors.white,
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  sectionHeader: {
    ...typography.bodyBold,
    color: colors.slate[800],
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sessionCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sessionTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  sessionEmoji: {
    fontSize: 24,
  },
  sessionTimeRange: {
    ...typography.bodyBold,
    color: colors.slate[800],
  },
  sessionBaby: {
    ...typography.caption,
    color: colors.primary[500],
    marginTop: 2,
  },
  sessionDetails: {
    gap: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    ...typography.small,
    color: colors.slate[500],
  },
  detailValue: {
    ...typography.smallBold,
    color: colors.slate[800],
  },
  detailValueMuted: {
    ...typography.small,
    color: colors.slate[500],
  },
  sidesRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sideBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    backgroundColor: colors.slate[100],
  },
  sideBadgeActive: {
    backgroundColor: colors.primary[50],
  },
  sideBadgeText: {
    ...typography.captionBold,
    color: colors.slate[400],
  },
  sideBadgeTextActive: {
    color: colors.primary[500],
  },
  sessionNotes: {
    ...typography.caption,
    color: colors.slate[500],
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
  },
});
