import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import RefreshableSectionList from '../components/ui/RefreshableSectionList';
import { confirmAlert } from '../services/crossPlatformAlert';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft, Trash2, CalendarDays, Baby as BabyIcon,
} from 'lucide-react-native';
import { colors, spacing, typography, radii, shadows } from '../theme';
import { DiaperRecord, DiaperType, Baby } from '../types';
import { EmptyState } from '../components/ui';
import * as diaperStorage from '../services/diaperStorage';

const diaperColors = {
  main: '#0d9488',
  light: '#f0fdfa',
  medium: '#ccfbf1',
  accent: '#5eead4',
};

type Section = { title: string; data: DiaperRecord[] };
type DateFilter = 'all' | 'today' | 'week' | 'month';

const DIAPER_TYPE_LABELS: Record<DiaperType, string> = {
  wet: 'Mojado',
  dirty: 'Sucio',
  both: 'Ambos',
};

function formatRecordTime(isoString: string): string {
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

function groupByDate(records: DiaperRecord[]): Section[] {
  const groups: Record<string, DiaperRecord[]> = {};
  for (const r of records) {
    const key = new Date(r.changedAt).toISOString().slice(0, 10);
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  }
  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dateStr, data]) => ({
      title: getRelativeDateLabel(dateStr),
      data,
    }));
}

export default function DiaperHistoryScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [records, setRecords] = useState<DiaperRecord[]>([]);
  const [babies, setBabies] = useState<Baby[]>([]);
  const [filterBabyId, setFilterBabyId] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [recordsData, babiesData] = await Promise.all([
        diaperStorage.getRecords(),
        diaperStorage.getBabies(),
      ]);
      setRecords(recordsData);
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

  const filteredRecords = useMemo(() => {
    let result = records;

    if (filterBabyId) {
      result = result.filter((r) => r.babyId === filterBabyId);
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
      result = result.filter((r) => new Date(r.changedAt) >= cutoff);
    }

    return result;
  }, [records, filterBabyId, dateFilter]);

  const sections = useMemo(() => groupByDate(filteredRecords), [filteredRecords]);

  const getBabyName = (babyId?: string) => {
    if (!babyId) return null;
    return babies.find((b) => b.id === babyId)?.name ?? null;
  };

  const handleDelete = (record: DiaperRecord) => {
    confirmAlert(
      'Eliminar registro',
      `¿Eliminar el registro de ${formatRecordTime(record.changedAt)}?`,
      async () => {
        await diaperStorage.deleteRecord(record.id);
        setRecords((prev) => prev.filter((r) => r.id !== record.id));
      }
    );
  };

  const renderRecord = ({ item }: { item: DiaperRecord }) => {
    const babyName = getBabyName(item.babyId);
    return (
      <TouchableOpacity
        style={styles.recordCard}
        onPress={() => navigation.navigate('DiaperRecordDetail', { recordId: item.id })}
        onLongPress={() => handleDelete(item)}
        activeOpacity={0.7}
      >
        <View style={styles.recordHeader}>
          <View style={styles.recordTimeRow}>
            <View style={styles.recordIcon}>
              <BabyIcon size={16} color={diaperColors.main} />
            </View>
            <View>
              <Text style={styles.recordTime}>
                {formatRecordTime(item.changedAt)}
              </Text>
              <Text style={styles.recordType}>{DIAPER_TYPE_LABELS[item.type]}</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => handleDelete(item)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Trash2 size={16} color={colors.slate[400]} />
          </TouchableOpacity>
        </View>

        {(babyName || item.notes.length > 0) && (
          <View style={styles.recordDetails}>
            {babyName && (
              <Text style={styles.recordBaby}>{babyName}</Text>
            )}
            {item.notes.length > 0 && (
              <Text style={styles.recordNotes} numberOfLines={2}>
                {item.notes}
              </Text>
            )}
          </View>
        )}
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
        <Text style={styles.headerTitle}>Historial de Pañales</Text>
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

      {/* Records List */}
      {!loading && filteredRecords.length === 0 ? (
        <View style={styles.emptyContainer}>
          <EmptyState
            icon={<BabyIcon size={48} color={colors.slate[300]} />}
            title="Sin registros"
            subtitle="Los cambios de pañal que registres aparecerán aquí."
          />
        </View>
      ) : (
        <RefreshableSectionList
          onRefresh={loadData}
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderRecord}
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
    backgroundColor: diaperColors.main,
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
    backgroundColor: diaperColors.main + '15',
    borderColor: diaperColors.main,
  },
  dateChipText: {
    ...typography.caption,
    color: colors.slate[500],
    fontWeight: '500',
  },
  dateChipTextSelected: {
    color: diaperColors.main,
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
  recordCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  recordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recordTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  recordIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: diaperColors.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordTime: {
    ...typography.bodyBold,
    color: colors.slate[800],
  },
  recordType: {
    ...typography.caption,
    color: diaperColors.main,
    marginTop: 2,
  },
  recordDetails: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  recordBaby: {
    ...typography.smallBold,
    color: colors.slate[600],
  },
  recordNotes: {
    ...typography.caption,
    color: colors.slate[500],
    fontStyle: 'italic',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
  },
});
