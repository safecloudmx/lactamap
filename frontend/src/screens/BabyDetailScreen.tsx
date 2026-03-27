import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Platform, Modal, Dimensions,
} from 'react-native';
import RefreshableScroll from '../components/ui/RefreshableScroll';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import {
  ArrowLeft, Camera, Timer, ClipboardList, Moon, Baby as BabyIcon,
  Pencil, Ruler, Weight, ChevronRight, Plus, Trash2, Calendar, X,
} from 'lucide-react-native';
import { colors, spacing, typography, radii, shadows } from '../theme';
import { Baby, GrowthRecord } from '../types';
import { uploadBabyAvatar, getGrowthRecords, deleteGrowthRecord } from '../services/api';
import * as nursingStorage from '../services/nursingStorage';
import { confirmAlert, infoAlert } from '../services/crossPlatformAlert';

function getAge(birthDate: string): string {
  const birth = new Date(birthDate);
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  let days = now.getDate() - birth.getDate();
  if (days < 0) {
    months--;
    const prev = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    days += prev;
  }
  if (months < 0) { years--; months += 12; }
  const parts: string[] = [];
  if (years > 0) parts.push(`${years}a`);
  if (months > 0) parts.push(`${months}m`);
  if (days > 0 || parts.length === 0) parts.push(`${days}d`);
  return parts.join(' ');
}

function getWeeks(birthDate: string): number {
  const birth = new Date(birthDate);
  const now = new Date();
  return Math.floor((now.getTime() - birth.getTime()) / (7 * 24 * 60 * 60 * 1000));
}

export default function BabyDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { babyId } = route.params;

  const [baby, setBaby] = useState<Baby | null>(null);
  const [growthRecords, setGrowthRecords] = useState<GrowthRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [growthFilter, setGrowthFilter] = useState<'all' | '1m' | '6m' | '12m'>('all');

  const filteredGrowthRecords = useMemo(() => {
    if (growthFilter === 'all') return growthRecords;
    const now = new Date();
    const cutoff = new Date(now);
    if (growthFilter === '1m') {
      cutoff.setMonth(cutoff.getMonth() - 1);
    } else if (growthFilter === '6m') {
      cutoff.setMonth(cutoff.getMonth() - 6);
    } else {
      cutoff.setMonth(cutoff.getMonth() - 12);
    }
    return growthRecords.filter((r) => new Date(r.measuredAt) >= cutoff);
  }, [growthRecords, growthFilter]);

  const loadData = useCallback(async () => {
    try {
      const babies = await nursingStorage.getBabies();
      const found = babies.find((b) => b.id === babyId);
      if (found) setBaby(found);
      const records = await getGrowthRecords(babyId);
      setGrowthRecords(records);
    } catch (e) {
      console.warn('BabyDetailScreen loadData error:', e);
    } finally {
      setLoading(false);
    }
  }, [babyId]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handlePickAvatar = async () => {
    try {
      const ImagePicker = require('expo-image-picker');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]) return;
      setUploadingAvatar(true);
      const updated = await uploadBabyAvatar(babyId, result.assets[0].uri);
      setBaby((prev) => prev ? { ...prev, avatarUrl: updated.avatarUrl } : prev);
    } catch (e) {
      console.warn('Avatar upload error:', e);
      infoAlert('Error', 'No se pudo subir la foto');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleDeleteGrowth = (record: GrowthRecord) => {
    confirmAlert('Eliminar registro', '¿Eliminar este registro de crecimiento?', async () => {
      try {
        await deleteGrowthRecord(record.id);
        setGrowthRecords((prev) => prev.filter((r) => r.id !== record.id));
      } catch {
        infoAlert('Error', 'No se pudo eliminar el registro');
      }
    });
  };

  const latest = growthRecords[0] || null;

  const resourceCards = [
    { icon: Timer, title: 'Lactancia', color: colors.primary[500], bg: colors.primary[50], route: 'FeedingHistory' },
    { icon: ClipboardList, title: 'Extracción', color: colors.info, bg: colors.infoLight, route: 'PumpingHistory' },
    { icon: Moon, title: 'Sueño', color: '#7c3aed', bg: '#f5f3ff', route: 'SleepHistory' },
    { icon: BabyIcon, title: 'Pañales', color: '#0d9488', bg: '#f0fdfa', route: 'DiaperHistory' },
  ];

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
      </View>
    );
  }

  if (!baby) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={{ textAlign: 'center', marginTop: 40 }}>Bebé no encontrado</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate('Main', { screen: 'HomeTabs', params: { screen: 'Perfil' } });
            }
          }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ArrowLeft size={24} color={colors.slate[800]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{baby.name}</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('BabyEdit', { babyId: baby.id })}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Pencil size={20} color={colors.slate[600]} />
        </TouchableOpacity>
      </View>

      <RefreshableScroll onRefresh={loadData} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} nestedScrollEnabled>
        {/* Avatar & Info */}
        <View style={styles.profileCard}>
          <TouchableOpacity onPress={handlePickAvatar} style={styles.avatarContainer} activeOpacity={0.7}>
            {baby.avatarUrl ? (
              <Image source={{ uri: baby.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <BabyIcon size={40} color={colors.primary[300]} />
              </View>
            )}
            <View style={styles.cameraBadge}>
              {uploadingAvatar ? (
                <ActivityIndicator size={12} color={colors.white} />
              ) : (
                <Camera size={14} color={colors.white} />
              )}
            </View>
          </TouchableOpacity>
          <Text style={styles.profileName}>{baby.name}</Text>
          {baby.birthDate && (
            <View style={styles.ageRow}>
              <Calendar size={14} color={colors.slate[500]} />
              <Text style={styles.ageText}>
                {getAge(baby.birthDate)} (Semana {getWeeks(baby.birthDate)})
              </Text>
            </View>
          )}
          {!baby.birthDate && (
            <Text style={styles.noBirthDate}>Sin fecha de nacimiento registrada</Text>
          )}
        </View>

        {/* Growth Summary */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Crecimiento</Text>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => navigation.navigate('GrowthAdd', { babyId: baby.id, birthDate: baby.birthDate })}
            activeOpacity={0.7}
          >
            <Plus size={16} color={colors.white} />
            <Text style={styles.addBtnText}>Registrar</Text>
          </TouchableOpacity>
        </View>

        {latest ? (
          <View style={styles.growthSummaryRow}>
            {latest.weightKg !== null && (
              <View style={styles.growthCard}>
                <Weight size={20} color={colors.primary[500]} />
                <Text style={styles.growthValue}>{latest.weightKg} kg</Text>
                <Text style={styles.growthLabel}>Peso</Text>
              </View>
            )}
            {latest.heightCm !== null && (
              <View style={styles.growthCard}>
                <Ruler size={20} color={colors.info} />
                <Text style={styles.growthValue}>{latest.heightCm} cm</Text>
                <Text style={styles.growthLabel}>Estatura</Text>
              </View>
            )}
            {latest.headCircumferenceCm !== null && (
              <View style={styles.growthCard}>
                <View style={styles.headIcon}>
                  <Text style={{ fontSize: 16 }}>🧠</Text>
                </View>
                <Text style={styles.growthValue}>{latest.headCircumferenceCm} cm</Text>
                <Text style={styles.growthLabel}>Cabeza</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Ruler size={28} color={colors.slate[300]} />
            <Text style={styles.emptyText}>
              Sin registros de crecimiento.{'\n'}Agrega el primero para dar seguimiento.
            </Text>
          </View>
        )}

        {/* Growth History */}
        {growthRecords.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: spacing.xl, marginBottom: spacing.sm }]}>Historial de Crecimiento</Text>
            <View style={styles.dateFilterRow}>
              {([
                { key: 'all', label: 'Todos' },
                { key: '1m', label: '1 mes' },
                { key: '6m', label: '6 meses' },
                { key: '12m', label: '12 meses' },
              ] as { key: typeof growthFilter; label: string }[]).map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.dateChip, growthFilter === opt.key && styles.dateChipSelected]}
                  onPress={() => setGrowthFilter(opt.key)}
                >
                  <Text style={[styles.dateChipText, growthFilter === opt.key && styles.dateChipTextSelected]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.growthHistoryContainer}>
              <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
                {filteredGrowthRecords.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyText}>Sin registros en este período.</Text>
                  </View>
                ) : filteredGrowthRecords.map((record) => (
                  <View key={record.id} style={styles.historyCard}>
                    <View style={styles.historyLeft}>
                      <Text style={styles.historyDate}>
                        {new Date(record.measuredAt).toLocaleDateString('es-MX', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })}
                      </Text>
                      {baby.birthDate && (
                        <Text style={styles.historyAge}>
                          Edad: {getAge(baby.birthDate)}
                        </Text>
                      )}
                      <View style={styles.historyMetrics}>
                        {record.weightKg !== null && <Text style={styles.historyMetric}>⚖️ {record.weightKg}kg</Text>}
                        {record.heightCm !== null && <Text style={styles.historyMetric}>📏 {record.heightCm}cm</Text>}
                        {record.headCircumferenceCm !== null && <Text style={styles.historyMetric}>🧠 {record.headCircumferenceCm}cm</Text>}
                      </View>
                      {record.photos?.length > 0 && (
                        <View style={styles.historyPhotos}>
                          {record.photos.map((photo) => (
                            <TouchableOpacity
                              key={photo.id}
                              onPress={() => setFullscreenImage(photo.url)}
                              activeOpacity={0.8}
                            >
                              <Image source={{ uri: photo.url }} style={styles.historyPhotoThumb} />
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                      {record.notes && <Text style={styles.historyNotes}>{record.notes}</Text>}
                    </View>
                    <TouchableOpacity
                      onPress={() => handleDeleteGrowth(record)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Trash2 size={16} color={colors.slate[400]} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          </>
        )}

        {/* Resource Cards */}
        <Text style={[styles.sectionTitle, { marginTop: spacing.xxl }]}>Registros</Text>
        <View style={styles.resourceGrid}>
          {resourceCards.map((card) => (
            <TouchableOpacity
              key={card.route}
              style={styles.resourceCard}
              onPress={() => navigation.navigate(card.route, { filterBabyId: babyId })}
              activeOpacity={0.7}
            >
              <View style={[styles.resourceIcon, { backgroundColor: card.bg }]}>
                <card.icon size={22} color={card.color} />
              </View>
              <Text style={styles.resourceTitle}>{card.title}</Text>
              <ChevronRight size={16} color={colors.slate[400]} />
            </TouchableOpacity>
          ))}
        </View>
      </RefreshableScroll>

      {/* Fullscreen Image Viewer */}
      <Modal visible={!!fullscreenImage} transparent animationType="fade">
        <View style={styles.fullscreenOverlay}>
          <TouchableOpacity
            style={styles.fullscreenClose}
            onPress={() => setFullscreenImage(null)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <X size={28} color={colors.white} />
          </TouchableOpacity>
          {fullscreenImage && (
            <Image
              source={{ uri: fullscreenImage }}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  profileCard: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing.xxl,
    alignItems: 'center',
    ...shadows.md,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarPlaceholder: {
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.white,
  },
  profileName: {
    ...typography.h3,
    color: colors.slate[800],
    marginTop: spacing.md,
  },
  ageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  ageText: {
    ...typography.small,
    color: colors.slate[500],
  },
  noBirthDate: {
    ...typography.caption,
    color: colors.slate[400],
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.slate[800],
    marginBottom: spacing.md,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary[500],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
  },
  addBtnText: {
    ...typography.captionBold,
    color: colors.white,
  },
  growthSummaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  growthCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
    ...shadows.sm,
  },
  growthValue: {
    ...typography.h4,
    color: colors.slate[800],
  },
  growthLabel: {
    ...typography.caption,
    color: colors.slate[500],
  },
  headIcon: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.xxl,
    alignItems: 'center',
    gap: spacing.md,
    ...shadows.sm,
  },
  emptyText: {
    ...typography.small,
    color: colors.slate[500],
    textAlign: 'center',
    lineHeight: 22,
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  historyLeft: {
    flex: 1,
    gap: spacing.xs,
  },
  historyDate: {
    ...typography.bodyBold,
    color: colors.slate[800],
  },
  historyAge: {
    ...typography.caption,
    color: colors.slate[400],
  },
  historyMetrics: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  historyMetric: {
    ...typography.small,
    color: colors.slate[600],
  },
  historyPhotos: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  historyPhotoThumb: {
    width: 56,
    height: 56,
    borderRadius: radii.sm,
  },
  growthHistoryContainer: {
    maxHeight: SCREEN_HEIGHT * 0.45,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  dateFilterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  dateChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate[200],
  },
  dateChipSelected: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
  },
  dateChipText: {
    ...typography.caption,
    color: colors.slate[600],
  },
  dateChipTextSelected: {
    color: colors.white,
    fontWeight: '600',
  },
  historyNotes: {
    ...typography.caption,
    color: colors.slate[400],
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  fullscreenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: spacing.sm,
  },
  fullscreenImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.75,
  },
  resourceGrid: {
    gap: spacing.sm,
  },
  resourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.sm,
  },
  resourceIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resourceTitle: {
    ...typography.bodyBold,
    color: colors.slate[800],
    flex: 1,
  },
});
