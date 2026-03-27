import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput,
  KeyboardAvoidingView, Platform, Modal, Image,
} from 'react-native';
import RefreshableScroll from '../components/ui/RefreshableScroll';
import { confirmAlert, infoAlert } from '../services/crossPlatformAlert';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft, Trash2, Clock, Calendar, Pencil, Check, X,
  Baby as BabyIcon, StickyNote, Paperclip,
  Camera, ImagePlus,
} from 'lucide-react-native';
import { colors, spacing, typography, radii, shadows } from '../theme';
import { DiaperRecord, DiaperType, Baby } from '../types';
import * as diaperStorage from '../services/diaperStorage';

let ImagePicker: any = null;
try { ImagePicker = require('expo-image-picker'); } catch (_) {}

const diaperColors = {
  main: '#0d9488',
  light: '#f0fdfa',
  medium: '#ccfbf1',
  accent: '#5eead4',
};

const MAX_NOTES = 3000;

const DIAPER_TYPES: { key: DiaperType; label: string; emoji: string; color: string }[] = [
  { key: 'wet', label: 'Mojado', emoji: '💧', color: '#06b6d4' },
  { key: 'dirty', label: 'Sucio', emoji: '💩', color: '#a16207' },
  { key: 'both', label: 'Ambos', emoji: '🩲', color: diaperColors.main },
];

function formatDateTime(isoString: string): { date: string; time: string } {
  const d = new Date(isoString);
  const date = d.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const time = d.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  return { date, time };
}

function parseHHMM(timeStr: string): { hours: number; minutes: number } | null {
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return { hours, minutes };
}

export default function DiaperRecordDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { recordId } = route.params;

  const [record, setRecord] = useState<DiaperRecord | null>(null);
  const [babies, setBabies] = useState<Baby[]>([]);
  const [selectedBabyId, setSelectedBabyId] = useState<string | null>(null);
  const [diaperType, setDiaperType] = useState<DiaperType>('wet');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<{ uri: string }[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Edit modal
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editTimeStr, setEditTimeStr] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadData = useCallback(async () => {
    const [allRecords, babiesData] = await Promise.all([
      diaperStorage.getRecords(),
      diaperStorage.getBabies(),
    ]);
    setBabies(babiesData);
    const found = allRecords.find((r) => r.id === recordId);
    if (found) {
      setRecord(found);
      setSelectedBabyId(found.babyId || null);
      setDiaperType(found.type);
      setNotes(found.notes);
      setPhotos(found.photos.map((uri) => ({ uri })));
    }
  }, [recordId]);

  useFocusEffect(
    useCallback(() => { loadData(); }, [loadData])
  );

  const handleSave = async () => {
    if (!record) return;
    const updatedRecord: DiaperRecord = {
      ...record,
      babyId: selectedBabyId || undefined,
      type: diaperType,
      notes: notes.trim(),
      photos: photos.map((p) => p.uri),
      updatedAt: new Date().toISOString(),
    };
    await diaperStorage.updateRecord(record.id, updatedRecord);
    setRecord(updatedRecord);
    setHasChanges(false);
    infoAlert('Guardado', 'El registro ha sido actualizado.');
  };

  const handleDelete = () => {
    if (!record) return;
    confirmAlert(
      'Eliminar registro',
      '¿Estás segura de que quieres eliminar este registro?',
      async () => {
        await diaperStorage.deleteRecord(record.id);
        navigation.goBack();
      }
    );
  };

  const openEditModal = () => {
    if (!record) return;
    const d = new Date(record.changedAt);
    setEditTimeStr(
      `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    );
    setEditModalVisible(true);
  };

  const handleSaveTimeEdit = () => {
    if (!record) return;
    const parsed = parseHHMM(editTimeStr);
    if (!parsed) {
      infoAlert('Error', 'Formato de hora inválido. Usa HH:MM (24h).');
      return;
    }
    const newDate = new Date(record.changedAt);
    newDate.setHours(parsed.hours, parsed.minutes, 0, 0);
    const updatedRecord: DiaperRecord = {
      ...record,
      changedAt: newDate.toISOString(),
      updatedAt: new Date().toISOString(),
    };
    diaperStorage.updateRecord(record.id, updatedRecord);
    setRecord(updatedRecord);
    setEditModalVisible(false);
    infoAlert('Actualizado', 'La hora del registro ha sido actualizada.');
  };

  // Photo handlers
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
      setHasChanges(true);
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
      setHasChanges(true);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  if (!record) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <ArrowLeft size={24} color={colors.slate[800]} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Detalle del Registro</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando...</Text>
        </View>
      </View>
    );
  }

  const { date, time } = formatDateTime(record.changedAt);
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color={colors.slate[800]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalle del Registro</Text>
        <TouchableOpacity onPress={handleDelete}>
          <Trash2 size={20} color={colors.error} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <RefreshableScroll
          onRefresh={loadData}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Date/Time Info */}
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={styles.infoLeft}>
                <Calendar size={16} color={colors.slate[400]} />
                <Text style={styles.infoLabel}>Fecha</Text>
              </View>
              <Text style={styles.infoValue}>{date}</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoRow}>
              <View style={styles.infoLeft}>
                <Clock size={16} color={colors.slate[400]} />
                <Text style={styles.infoLabel}>Hora</Text>
              </View>
              <View style={styles.infoRight}>
                <Text style={styles.infoValue}>{time}</Text>
                <TouchableOpacity style={styles.editBtn} onPress={openEditModal}>
                  <Pencil size={14} color={diaperColors.main} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Diaper Status Selector */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <BabyIcon size={16} color={colors.slate[400]} />
              <Text style={styles.sectionLabel}>Estatus del pañal</Text>
            </View>
            <View style={styles.typeChipsRow}>
              {DIAPER_TYPES.map((opt) => {
                const isSelected = diaperType === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.typeChip, isSelected && { backgroundColor: opt.color }]}
                    onPress={() => {
                      setDiaperType(opt.key);
                      setHasChanges(true);
                    }}
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
          </View>

          {/* Baby Selector */}
          {babies.length > 0 && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <BabyIcon size={16} color={colors.slate[400]} />
                <Text style={styles.sectionLabel}>Bebé</Text>
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
                        setSelectedBabyId(isSelected ? null : baby.id);
                        setHasChanges(true);
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
            </View>
          )}

          {/* Notes */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <StickyNote size={16} color={colors.slate[400]} />
              <Text style={styles.sectionLabel}>Notas</Text>
            </View>
            <TextInput
              style={styles.notesInput}
              placeholder="Agregar notas sobre este registro..."
              placeholderTextColor={colors.slate[400]}
              value={notes}
              onChangeText={(t) => {
                setNotes(t.slice(0, MAX_NOTES));
                setHasChanges(true);
              }}
              multiline
              maxLength={MAX_NOTES}
            />
            <Text style={styles.charCount}>{notes.length}/{MAX_NOTES}</Text>
          </View>

          {/* Photos */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Paperclip size={16} color={colors.slate[400]} />
              <Text style={styles.sectionLabel}>Adjuntos</Text>
              <View style={{ flex: 1 }} />
              <View style={styles.photoActions}>
                <TouchableOpacity onPress={handlePickImage}>
                  <ImagePlus size={20} color={colors.slate[500]} />
                </TouchableOpacity>
                {Platform.OS !== 'web' && (
                  <TouchableOpacity onPress={handleTakePhoto}>
                    <Camera size={20} color={colors.slate[500]} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {photos.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
                {photos.map((photo, i) => (
                  <View key={i} style={styles.photoThumb}>
                    <Image source={{ uri: photo.uri }} style={styles.photoImg} />
                    <TouchableOpacity style={styles.photoRemove} onPress={() => removePhoto(i)}>
                      <X size={12} color={colors.white} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}

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
                    setHasChanges(true);
                  }
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              />
            )}
          </View>

          {/* Save */}
          {hasChanges && (
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSave}
              activeOpacity={0.8}
            >
              <Check size={20} color={colors.white} />
              <Text style={styles.saveBtnText}>Guardar cambios</Text>
            </TouchableOpacity>
          )}
        </RefreshableScroll>
      </KeyboardAvoidingView>

      {/* Edit Time Modal */}
      <Modal visible={editModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Editar hora</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <X size={24} color={colors.slate[500]} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Hora del cambio (HH:MM, 24h)</Text>
            <TextInput
              style={styles.modalInput}
              value={editTimeStr}
              onChangeText={setEditTimeStr}
              placeholder="14:30"
              placeholderTextColor={colors.slate[400]}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleSaveTimeEdit}
              >
                <Text style={styles.modalSaveText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.slate[500],
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  editBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: diaperColors.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCard: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  infoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  infoLabel: {
    ...typography.small,
    color: colors.slate[500],
  },
  infoValue: {
    ...typography.smallBold,
    color: colors.slate[800],
  },
  infoRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  infoDivider: {
    height: 1,
    backgroundColor: colors.slate[100],
  },
  sectionCard: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  sectionLabel: {
    ...typography.bodyBold,
    color: colors.slate[700],
  },
  typeChipsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: diaperColors.main,
    borderRadius: radii.full,
    paddingVertical: spacing.lg,
    marginTop: spacing.md,
    ...shadows.sm,
  },
  saveBtnText: {
    ...typography.button,
    color: colors.white,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalContent: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  modalTitle: {
    ...typography.h4,
    color: colors.slate[800],
  },
  modalLabel: {
    ...typography.smallBold,
    color: colors.slate[600],
    marginBottom: spacing.sm,
  },
  modalInput: {
    ...typography.body,
    color: colors.slate[800],
    backgroundColor: colors.slate[50],
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.slate[200],
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.slate[100],
    alignItems: 'center',
  },
  modalCancelText: {
    ...typography.button,
    color: colors.slate[600],
  },
  modalSaveBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: diaperColors.main,
    alignItems: 'center',
  },
  modalSaveText: {
    ...typography.button,
    color: colors.white,
  },
});
