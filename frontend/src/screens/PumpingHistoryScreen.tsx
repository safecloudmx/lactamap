import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SectionList,
  ActivityIndicator, Image,
} from 'react-native';
import { confirmAlert } from '../services/crossPlatformAlert';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft, Plus, Trash2, Droplets, Pencil, ImageIcon, CalendarDays,
} from 'lucide-react-native';
import { colors, spacing, typography, radii, shadows } from '../theme';
import { PumpingSession, Baby } from '../types';
import { getPumpingSessions, deletePumpingSession } from '../services/api';
import { EmptyState } from '../components/ui';
import * as nursingStorage from '../services/nursingStorage';

type Section = { title: string; totalMl: number; data: PumpingSession[] };
type DateFilter = 'all' | 'today' | 'week' | 'month';

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

function groupByDate(sessions: PumpingSession[]): Section[] {
  const groups: Record<string, PumpingSession[]> = {};
  for (const s of sessions) {
    const key = new Date(s.pumpedAt).toISOString().slice(0, 10);
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  }
  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([, data]) => ({
      title: getRelativeDateLabel(data[0].pumpedAt),
      totalMl: data.reduce((sum, s) => sum + s.amountMl, 0),
      data,
    }));
}

function formatTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function getSideLabel(side: string): string {
  if (side === 'LEFT') return 'Izq';
  if (side === 'RIGHT') return 'Der';
  return 'Ambos';
}

function getSideColor(side: string): string {
  if (side === 'LEFT') return colors.info;
  if (side === 'RIGHT') return '#8b5cf6';
  return colors.success;
}

export default function PumpingHistoryScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [sessions, setSessions] = useState<PumpingSession[]>([]);
  const [babies, setBabies] = useState<Baby[]>([]);
  const [filterBabyId, setFilterBabyId] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [data, babiesData] = await Promise.all([
        getPumpingSessions(),
        nursingStorage.getBabies(),
      ]);
      setSessions(data);
      setBabies(babiesData);
    } catch (err) {
      console.error('Error loading pumping sessions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const filteredSessions = useMemo(() => {
    let result = sessions;

    // Baby filter
    if (filterBabyId) {
      result = result.filter((s) => s.babyId === filterBabyId);
    }

    // Date filter
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
      result = result.filter((s) => new Date(s.pumpedAt) >= cutoff);
    }

    return result;
  }, [sessions, filterBabyId, dateFilter]);

  const handleDelete = (session: PumpingSession) => {
    confirmAlert(
      'Eliminar registro',
      '¿Estás segura de que quieres eliminar esta sesión de extracción?',
      async () => {
        try {
          await deletePumpingSession(session.id);
          setSessions((prev) => prev.filter((s) => s.id !== session.id));
        } catch (err) {
          console.error('Error deleting session:', err);
        }
      },
    );
  };

  const sections = groupByDate(filteredSessions);
  const totalAll = filteredSessions.reduce((sum, s) => sum + s.amountMl, 0);

  const getBabyName = (babyId?: string | null) => {
    if (!babyId) return null;
    return babies.find((b) => b.id === babyId)?.name ?? null;
  };

  const renderSession = ({ item }: { item: PumpingSession }) => {
    const sideColor = getSideColor(item.side);
    const babyName = getBabyName(item.babyId);
    return (
      <TouchableOpacity
        style={styles.sessionCard}
        onPress={() => navigation.navigate('PumpingLog', { session: item })}
        activeOpacity={0.7}
      >
        <View style={[styles.sideIcon, { backgroundColor: sideColor + '18' }]}>
          <Droplets size={16} color={sideColor} />
        </View>
        <View style={styles.sessionContent}>
          <View style={styles.sessionTopRow}>
            <Text style={styles.sessionTime}>{formatTime(item.pumpedAt)}</Text>
            <View style={[styles.sideBadge, { backgroundColor: sideColor + '18' }]}>
              <Text style={[styles.sideBadgeText, { color: sideColor }]}>
                {getSideLabel(item.side)}
              </Text>
            </View>
            <Text style={styles.sessionAmount}>{item.amountMl} ml</Text>
          </View>
          {babyName && (
            <Text style={styles.sessionBabyName}>{babyName}</Text>
          )}
          {item.notes && (
            <Text style={styles.sessionNotes} numberOfLines={1}>{item.notes}</Text>
          )}
          {item.photos?.length > 0 && (
            <View style={styles.sessionPhotosRow}>
              <ImageIcon size={12} color={colors.slate[400]} />
              <Text style={styles.sessionPhotosText}>{item.photos.length} foto{item.photos.length > 1 ? 's' : ''}</Text>
            </View>
          )}
        </View>
        <View style={styles.sessionActions}>
          <TouchableOpacity
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => navigation.navigate('PumpingLog', { session: item })}
          >
            <Pencil size={16} color={colors.slate[400]} />
          </TouchableOpacity>
          <TouchableOpacity
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => handleDelete(item)}
          >
            <Trash2 size={16} color={colors.error} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = ({ section }: { section: Section }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      <Text style={styles.sectionTotal}>{Math.round(section.totalMl * 10) / 10} ml</Text>
    </View>
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
        <Text style={styles.headerTitle}>Historial de Extracción</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('PumpingLog')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Plus size={24} color={colors.info} />
        </TouchableOpacity>
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

      {/* Summary bar */}
      {filteredSessions.length > 0 && (
        <View style={styles.summaryBar}>
          <View style={styles.summaryItem}>
            <Droplets size={18} color={colors.info} />
            <Text style={styles.summaryValue}>{filteredSessions.length}</Text>
            <Text style={styles.summaryLabel}>sesiones</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{Math.round(totalAll * 10) / 10}</Text>
            <Text style={styles.summaryLabel}>ml total</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>
              {filteredSessions.length > 0 ? Math.round((totalAll / filteredSessions.length) * 10) / 10 : 0}
            </Text>
            <Text style={styles.summaryLabel}>ml prom.</Text>
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.info} />
        </View>
      ) : filteredSessions.length === 0 ? (
        <EmptyState
          icon={<Droplets size={32} color={colors.info} />}
          title="Sin registros"
          subtitle="Aún no has registrado ninguna sesión de extracción."
          actionLabel="Registrar extracción"
          onAction={() => navigation.navigate('PumpingLog')}
        />
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

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: Math.max(insets.bottom, spacing.lg) + spacing.lg }]}
        onPress={() => navigation.navigate('PumpingLog')}
        activeOpacity={0.8}
      >
        <Plus size={28} color={colors.white} />
      </TouchableOpacity>
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
    backgroundColor: colors.info,
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
    backgroundColor: colors.info + '15',
    borderColor: colors.info,
  },
  dateChipText: {
    ...typography.caption,
    color: colors.slate[500],
    fontWeight: '500',
  },
  dateChipTextSelected: {
    color: colors.info,
    fontWeight: '600',
  },
  filterChipText: {
    ...typography.smallBold,
    color: colors.slate[600],
  },
  filterChipTextSelected: {
    color: colors.white,
  },
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
    gap: spacing.lg,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  summaryValue: {
    ...typography.bodyBold,
    color: colors.slate[800],
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.slate[400],
  },
  summaryDivider: {
    width: 1,
    height: 20,
    backgroundColor: colors.slate[200],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    ...typography.smallBold,
    color: colors.slate[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionTotal: {
    ...typography.smallBold,
    color: colors.info,
  },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
    ...shadows.sm,
  },
  sideIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionContent: {
    flex: 1,
    gap: 2,
  },
  sessionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sessionTime: {
    ...typography.smallBold,
    color: colors.slate[700],
  },
  sideBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    borderRadius: radii.sm,
  },
  sideBadgeText: {
    ...typography.caption,
    fontWeight: '600',
  },
  sessionAmount: {
    ...typography.bodyBold,
    color: colors.slate[800],
    marginLeft: 'auto',
  },
  sessionBabyName: {
    ...typography.caption,
    color: colors.info,
    marginTop: 2,
  },
  sessionNotes: {
    ...typography.caption,
    color: colors.slate[400],
    marginTop: 2,
  },
  sessionPhotosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  sessionPhotosText: {
    ...typography.caption,
    color: colors.slate[400],
  },
  sessionActions: {
    gap: spacing.md,
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    right: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.info,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
  },
});
