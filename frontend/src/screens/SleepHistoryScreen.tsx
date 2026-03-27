import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import RefreshableSectionList from '../components/ui/RefreshableSectionList';
import { confirmAlert } from '../services/crossPlatformAlert';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft, Moon, Trash2, CalendarDays, Clock,
} from 'lucide-react-native';
import { colors, spacing, typography, radii, shadows } from '../theme';
import { SleepSession, Baby } from '../types';
import { formatDuration } from '../hooks/useSleepTimer';
import { EmptyState } from '../components/ui';
import * as sleepStorage from '../services/sleepStorage';

const sleepColors = {
  main: '#7c3aed',
  light: '#f5f3ff',
  medium: '#ede9fe',
  accent: '#a78bfa',
};

type Section = { title: string; data: SleepSession[] };
type DateFilter = 'all' | 'today' | 'week' | 'month';

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
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
}

function groupByDate(sessions: SleepSession[]): Section[] {
  const groups: Record<string, SleepSession[]> = {};
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

export default function SleepHistoryScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [sessions, setSessions] = useState<SleepSession[]>([]);
  const [babies, setBabies] = useState<Baby[]>([]);
  const [filterBabyId, setFilterBabyId] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sessionsData, babiesData] = await Promise.all([
        sleepStorage.getSessions(),
        sleepStorage.getBabies(),
      ]);
      setSessions(sessionsData);
      setBabies(babiesData);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const filteredSessions = useMemo(() => {
    let result = sessions;

    if (filterBabyId) {
      result = result.filter((s) => s.babyId === filterBabyId);
    }

    if (dateFilter !== 'all') {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      let cutoff: Date;
      if (dateFilter === 'today') {
        cutoff = startOfToday;
      } else if (dateFilter === 'week') {
        cutoff = new Date(startOfToday);
        cutoff.setDate(cutoff.getDate() - 7);
      } else {
        cutoff = new Date(startOfToday);
        cutoff.setMonth(cutoff.getMonth() - 1);
      }
      result = result.filter((s) => new Date(s.startedAt) >= cutoff);
    }

    return result;
  }, [sessions, filterBabyId, dateFilter]);

  const sections = useMemo(() => groupByDate(filteredSessions), [filteredSessions]);

  const getBabyName = (babyId?: string) => {
    if (!babyId) return null;
    return babies.find((b) => b.id === babyId)?.name ?? null;
  };

  const handleDelete = (session: SleepSession) => {
    confirmAlert(
      'Eliminar sesión',
      `¿Eliminar la sesión de ${formatSessionTime(session.startedAt)}?`,
      async () => {
        await sleepStorage.deleteSession(session.id);
        setSessions((prev) => prev.filter((s) => s.id !== session.id));
      }
    );
  };

  const renderSession = ({ item }: { item: SleepSession }) => {
    const babyName = getBabyName(item.babyId);
    return (
      <TouchableOpacity
        style={styles.sessionCard}
        onPress={() => navigation.navigate('SleepSessionDetail', { sessionId: item.id })}
        onLongPress={() => handleDelete(item)}
        activeOpacity={0.7}
      >
        <View style={styles.sessionHeader}>
          <View style={styles.sessionTimeRow}>
            <View style={styles.sessionIcon}>
              <Moon size={16} color={sleepColors.main} />
            </View>
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
            <Text style={styles.detailLabel}>Duración</Text>
            <Text style={styles.detailValue}>{formatDuration(item.totalDuration)}</Text>
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
        <Text style={styles.headerTitle}>Historial de Sueño</Text>
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

      {/* Date Filter */}
      <View style={styles.dateFilterRow}>
        <CalendarDays size={16} color={colors.slate[400]} />
        {([
          { key: 'all', label: 'Todo' },
          { key: 'today', label: 'Hoy' },
          { key: 'week', label: '7 días' },
          { key: 'month', label: '30 días' },
        ] as { key: DateFilter; label: string }[]).map((opt) => (
          <TouchableOpacity
            key={opt.key}
            style={[styles.dateChip, dateFilter === opt.key && styles.dateChipSelected]}
            onPress={() => setDateFilter(opt.key)}
          >
            <Text style={[styles.dateChipText, dateFilter === opt.key && styles.dateChipTextSelected]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Sessions List */}
      {!loading && filteredSessions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <EmptyState
            icon={<Moon size={48} color={colors.slate[300]} />}
            title="Sin sesiones registradas"
            subtitle="Las sesiones que registres en el temporizador aparecerán aquí."
          />
        </View>
      ) : (
        <RefreshableSectionList
          onRefresh={loadData}
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
    backgroundColor: sleepColors.main,
  },
  filterChipText: {
    ...typography.smallBold,
    color: colors.slate[600],
  },
  filterChipTextSelected: {
    color: colors.white,
  },
  dateFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  dateChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    backgroundColor: colors.slate[50],
    borderWidth: 1,
    borderColor: colors.slate[200],
  },
  dateChipSelected: {
    backgroundColor: sleepColors.main + '15',
    borderColor: sleepColors.main,
  },
  dateChipText: {
    ...typography.caption,
    color: colors.slate[500],
    fontWeight: '500',
  },
  dateChipTextSelected: {
    color: sleepColors.main,
    fontWeight: '600',
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
  sessionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: sleepColors.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionTimeRange: {
    ...typography.bodyBold,
    color: colors.slate[800],
  },
  sessionBaby: {
    ...typography.caption,
    color: sleepColors.main,
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
