import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Image, StyleSheet, Platform, KeyboardAvoidingView,
} from 'react-native';
import { confirmAlert, infoAlert } from '../services/crossPlatformAlert';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft, Clock, StickyNote, Paperclip, Trash2,
  ImagePlus, Camera, X, Baby as BabyIcon, Droplets,
} from 'lucide-react-native';
import { colors, spacing, typography, radii, shadows } from '../theme';
import { DiaperRecord, DiaperType, Baby } from '../types';
import * as diaperStorage from '../services/diaperStorage';

let ImagePicker: any = null;
try { ImagePicker = require('expo-image-picker'); } catch (_) {}

const MAX_NOTES = 3000;

const diaperColors = {
  main: '#0d9488',
  light: '#f0fdfa',
  medium: '#ccfbf1',
  accent: '#5eead4',
  dark: '#115e59',
};

const DIAPER_TYPES: { key: DiaperType; label: string; emoji: string; color: string }[] = [
  { key: 'wet', label: 'Mojado', emoji: '💧', color: '#06b6d4' },
  { key: 'dirty', label: 'Sucio', emoji: '💩', color: '#a16207' },
  { key: 'both', label: 'Ambos', emoji: '🩲', color: diaperColors.main },
];

function formatTimeShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  const day = d.getDate();
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${day} ${months[d.getMonth()]}`;
}

function getLastChangeLabel(r: DiaperRecord): string {
  const diff = Date.now() - new Date(r.changedAt).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `hace ${days}d ${hours % 24}h`;
  if (hours > 0) return `hace ${hours}h ${mins % 60}m`;
  if (mins > 0) return `hace ${mins}m`;
  return 'hace <1min';
}

function getDiaperTypeLabel(type: DiaperType): string {
  return DIAPER_TYPES.find((t) => t.key === type)?.label ?? type;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export default function DiaperLogScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [babies, setBabies] = useState<Baby[]>([]);
  const [selectedBabyId, setSelectedBabyId] = useState<string | null>(null);
  const [diaperType, setDiaperType] = useState<DiaperType>('wet');
  const [changedAt, setChangedAt] = useState<Date>(new Date());
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<{ uri: string }[]>([]);
  const [todayRecords, setTodayRecords] = useState<DiaperRecord[]>([]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadData = useCallback(async () => {
    const [babiesData, activeId, todayData] = await Promise.all([
      diaperStorage.getBabies(),
      diaperStorage.getActiveBabyId(),
      diaperStorage.getTodayRecords(),
    ]);
    setBabies(babiesData);
    if (activeId) setSelectedBabyId(activeId);
    setTodayRecords(todayData);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleSave = async () => {
    const now = new Date().toISOString();
    const record: DiaperRecord = {
      id: generateId(),
      babyId: selectedBabyId || undefined,
      type: diaperType,
      changedAt: changedAt.toISOString(),
      notes: notes.trim(),
      photos: photos.map((p) => p.uri),
      createdAt: now,
      updatedAt: now,
    };
    await diaperStorage.saveRecord(record);
    const todayData = await diaperStorage.getTodayRecords();
    setTodayRecords(todayData);

    // Reset form
    setDiaperType('wet');
    setChangedAt(new Date());
    setNotes('');
    setPhotos([]);

    infoAlert(
      'Registro guardado',
      `Pañal: ${getDiaperTypeLabel(record.type)}`
    );
  };

  const handleDelete = (record: DiaperRecord) => {
    confirmAlert(
      'Eliminar registro',
      `¿Eliminar el registro de ${formatTimeShort(record.changedAt)}?`,
      async () => {
        await diaperStorage.deleteRecord(record.id);
        setTodayRecords((prev) => prev.filter((r) => r.id !== record.id));
      }
    );
  };

  const handlePickImage = async () => {
    if (Platform.OS === 'web') {
      if (fileInputRef.current) fileInputRef.current.click();
      return;
    }
    if (!ImagePicker) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.[0]) {
      setPhotos((prev) => [...prev, { uri: result.assets[0].uri }]);
    }
  };

  const handleTakePhoto = async () => {
    if (!ImagePicker) return;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.[0]) {
      setPhotos((prev) => [...prev, { uri: result.assets[0].uri }]);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  // Status label
  const statusLabel = todayRecords.length > 0
    ? `Último: ${getLastChangeLabel(todayRecords[0])}`
    : 'Sin registros';

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
        <Text style={styles.headerTitle}>Registro de Pañales</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Main Icon */}
          <View style={styles.iconSection}>
            <View style={styles.mainIcon}>
              <Text style={styles.diaperEmoji}>🩲</Text>
            </View>
          </View>

          {/* Title + Status */}
          <View style={styles.titleSection}>
            <Text style={styles.title}>Pañal</Text>
            <Text style={styles.statusText}>{statusLabel}</Text>
          </View>

          {/* Details Card */}
          <View style={styles.detailsCard}>
            {/* Time */}
            <View style={styles.fieldRow}>
              <View style={styles.fieldLeft}>
                <Clock size={20} color={colors.slate[400]} />
                <Text style={styles.fieldLabel}>Hora</Text>
              </View>
              <View style={styles.dateTimeRow}>
                <View style={styles.dateBadge}>
                  <Text style={styles.dateBadgeText}>{formatDateShort(changedAt.toISOString())}</Text>
                </View>
                <View style={styles.dateBadge}>
                  <Text style={styles.dateBadgeText}>{formatTimeShort(changedAt.toISOString())}</Text>
                </View>
              </View>
            </View>
            <View style={styles.divider} />

            {/* Diaper Status */}
            <View style={styles.fieldRow}>
              <View style={styles.fieldLeft}>
                <BabyIcon size={20} color={colors.slate[400]} />
                <Text style={styles.fieldLabel}>Estatus</Text>
              </View>
            </View>
            <View style={styles.typeChipsRow}>
              {DIAPER_TYPES.map((opt) => {
                const isSelected = diaperType === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.typeChip, isSelected && { backgroundColor: opt.color }]}
                    onPress={() => setDiaperType(opt.key)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.typeChipEmoji}>{opt.emoji}</Text>
                    <Text style={[styles.typeChipText, isSelected && styles.typeChipTextSelected]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.divider} />

            {/* Baby */}
            {babies.length > 0 && (
              <>
                <View style={styles.fieldRow}>
                  <View style={styles.fieldLeft}>
                    <BabyIcon size={20} color={colors.slate[400]} />
                    <Text style={styles.fieldLabel}>Bebé</Text>
                  </View>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.babyChipsRow}
                >
                  {babies.map((baby) => {
                    const isSelected = selectedBabyId === baby.id;
                    return (
                      <TouchableOpacity
                        key={baby.id}
                        style={[styles.babyChip, isSelected && styles.babyChipSelected]}
                        onPress={() => {
                          const newId = isSelected ? null : baby.id;
                          setSelectedBabyId(newId);
                          diaperStorage.setActiveBabyId(newId);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.babyChipText, isSelected && styles.babyChipTextSelected]}>
                          {baby.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <View style={styles.divider} />
              </>
            )}

            {/* Notes */}
            <View style={styles.fieldRow}>
              <View style={styles.fieldLeft}>
                <StickyNote size={20} color={colors.slate[400]} />
                <Text style={styles.fieldLabel}>Notas</Text>
              </View>
            </View>
            <TextInput
              style={styles.notesInput}
              placeholder="Agregar notas..."
              placeholderTextColor={colors.slate[400]}
              value={notes}
              onChangeText={(t) => setNotes(t.slice(0, MAX_NOTES))}
              multiline
              maxLength={MAX_NOTES}
            />
            <Text style={styles.charCount}>{notes.length}/{MAX_NOTES}</Text>
            <View style={styles.divider} />

            {/* Attachments */}
            <View style={styles.fieldRow}>
              <View style={styles.fieldLeft}>
                <Paperclip size={20} color={colors.slate[400]} />
                <Text style={styles.fieldLabel}>Adjuntos</Text>
              </View>
              <View style={styles.photoActions}>
                <TouchableOpacity onPress={handlePickImage}>
                  <ImagePlus size={22} color={colors.slate[500]} />
                </TouchableOpacity>
                {Platform.OS !== 'web' && (
                  <TouchableOpacity onPress={handleTakePhoto}>
                    <Camera size={22} color={colors.slate[500]} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {photos.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
                {photos.map((photo, i) => (
                  <View key={i} style={styles.photoThumb}>
                    <Image source={{ uri: photo.uri }} style={styles.photoImg} />
                    <TouchableOpacity
                      style={styles.photoRemove}
                      onPress={() => removePhoto(i)}
                    >
                      <X size={12} color={colors.white} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}

            {/* Web file input */}
            {Platform.OS === 'web' && (
              <input
                ref={fileInputRef as any}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e: any) => {
                  const file = e.target?.files?.[0];
                  if (file) {
                    const uri = URL.createObjectURL(file);
                    setPhotos((prev) => [...prev, { uri }]);
                  }
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              />
            )}
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSave}
            activeOpacity={0.8}
          >
            <Text style={styles.saveBtnText}>Guardar</Text>
          </TouchableOpacity>

          {/* Today's Records */}
          {todayRecords.length > 0 && (
            <View style={styles.todaySection}>
              <Text style={styles.todaySectionTitle}>Registros de hoy</Text>
              {todayRecords.map((record) => {
                const babyName = record.babyId
                  ? babies.find((b) => b.id === record.babyId)?.name
                  : null;
                return (
                  <TouchableOpacity
                    key={record.id}
                    style={styles.todayCard}
                    onPress={() => navigation.navigate('DiaperRecordDetail', { recordId: record.id })}
                    activeOpacity={0.7}
                  >
                    <View style={styles.todayCardLeft}>
                      <View style={styles.todayIcon}>
                        <BabyIcon size={14} color={diaperColors.main} />
                      </View>
                      <View>
                        <Text style={styles.todayTime}>
                          {formatTimeShort(record.changedAt)} · {getDiaperTypeLabel(record.type)}
                        </Text>
                        {babyName && (
                          <Text style={styles.todayBaby}>{babyName}</Text>
                        )}
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleDelete(record)}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    >
                      <Trash2 size={16} color={colors.slate[400]} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* History Link */}
          <TouchableOpacity
            style={styles.historyLink}
            onPress={() => navigation.navigate('DiaperHistory')}
            activeOpacity={0.7}
          >
            <Clock size={16} color={diaperColors.main} />
            <Text style={styles.historyLinkText}>Ver historial completo</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  iconSection: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  mainIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: diaperColors.light,
    borderWidth: 2,
    borderColor: colors.slate[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  diaperEmoji: {
    fontSize: 44,
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.h3,
    color: colors.slate[800],
    marginBottom: spacing.xs,
  },
  statusText: {
    ...typography.small,
    color: colors.slate[500],
  },
  detailsCard: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  fieldLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  fieldLabel: {
    ...typography.body,
    color: colors.slate[500],
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dateBadge: {
    backgroundColor: colors.slate[100],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
  },
  dateBadgeText: {
    ...typography.smallBold,
    color: colors.slate[700],
  },
  divider: {
    height: 1,
    backgroundColor: colors.slate[100],
    marginVertical: spacing.sm,
  },
  typeChipsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.slate[100],
  },
  typeChipEmoji: {
    fontSize: 14,
  },
  typeChipText: {
    ...typography.smallBold,
    color: colors.slate[600],
  },
  typeChipTextSelected: {
    color: colors.white,
  },
  babyChipsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  babyChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.slate[100],
    borderWidth: 1,
    borderColor: colors.slate[200],
  },
  babyChipSelected: {
    backgroundColor: diaperColors.main,
    borderColor: diaperColors.main,
  },
  babyChipText: {
    ...typography.smallBold,
    color: colors.slate[600],
  },
  babyChipTextSelected: {
    color: colors.white,
  },
  notesInput: {
    ...typography.small,
    color: colors.slate[800],
    backgroundColor: colors.slate[50],
    borderRadius: radii.md,
    padding: spacing.md,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    ...typography.caption,
    color: colors.slate[400],
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  photoActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  photoRow: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  photoThumb: {
    width: 64,
    height: 64,
    borderRadius: radii.sm,
    overflow: 'hidden',
    marginRight: spacing.sm,
  },
  photoImg: {
    width: '100%',
    height: '100%',
  },
  photoRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtn: {
    backgroundColor: diaperColors.main,
    borderRadius: radii.full,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.xl,
    ...shadows.sm,
  },
  saveBtnText: {
    ...typography.button,
    color: colors.white,
  },
  todaySection: {
    marginTop: spacing.xxl,
  },
  todaySectionTitle: {
    ...typography.bodyBold,
    color: colors.slate[800],
    marginBottom: spacing.md,
  },
  todayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  todayCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  todayIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: diaperColors.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayTime: {
    ...typography.smallBold,
    color: colors.slate[800],
  },
  todayBaby: {
    ...typography.caption,
    color: diaperColors.main,
    marginTop: 2,
  },
  historyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
  },
  historyLinkText: {
    ...typography.smallBold,
    color: diaperColors.main,
  },
});
