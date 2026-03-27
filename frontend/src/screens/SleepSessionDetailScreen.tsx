import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput,
  KeyboardAvoidingView, Platform, Modal, Image,
} from 'react-native';
import RefreshableScroll from '../components/ui/RefreshableScroll';
import { confirmAlert, infoAlert } from '../services/crossPlatformAlert';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft, Trash2, Clock, Pause as PauseIcon, Calendar,
  Pencil, Check, X, Moon, Baby as BabyIcon,
  StickyNote, Paperclip, Camera, ImagePlus,
} from 'lucide-react-native';
import { colors, spacing, typography, radii, shadows } from '../theme';
import { SleepSession, Baby } from '../types';
import { formatDuration } from '../hooks/useSleepTimer';
import * as sleepStorage from '../services/sleepStorage';

let ImagePicker: any = null;
try { ImagePicker = require('expo-image-picker'); } catch (_) {}

const sleepColors = {
  main: '#7c3aed',
  light: '#f5f3ff',
  medium: '#ede9fe',
  accent: '#a78bfa',
};

const MAX_NOTES = 3000;

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

export default function SleepSessionDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ params: { sessionId: string } }, 'params'>>();
  const insets = useSafeAreaInsets();

  const { sessionId } = route.params;

  const [session, setSession] = useState<SleepSession | null>(null);
  const [notes, setNotes] = useState('');
  const [selectedBabyId, setSelectedBabyId] = useState<string | null>(null);
  const [babies, setBabies] = useState<Baby[]>([]);
  const [photos, setPhotos] = useState<{ uri: string }[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editDurationMin, setEditDurationMin] = useState('');
  const [editDurationSec, setEditDurationSec] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [lastChanged, setLastChanged] = useState<'duration' | 'start' | 'end' | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadSession();
  }, [sessionId]);

  useFocusEffect(
    useCallback(() => {
      sleepStorage.getBabies().then(setBabies);
    }, [])
  );

  const loadSession = async () => {
    const all = await sleepStorage.getSessions();
    const s = all.find((x) => x.id === sessionId) ?? null;
    if (s) {
      setSession(s);
      setNotes(s.notes);
      setSelectedBabyId(s.babyId ?? null);
      setPhotos(s.photos.map((uri) => ({ uri })));
    }
  };

  const handleNotesChange = (text: string) => {
    setNotes(text.slice(0, MAX_NOTES));
    setHasChanges(true);
  };

  const handleBabyChange = (babyId: string | null) => {
    setSelectedBabyId(babyId);
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!session) return;
    setSaving(true);
    await sleepStorage.updateSession(session.id, {
      notes: notes.trim(),
      babyId: selectedBabyId ?? undefined,
      photos: photos.map((p) => p.uri),
    });
    setSaving(false);
    setHasChanges(false);
    infoAlert('Guardado', 'Los cambios fueron guardados.');
  };

  const handleDelete = () => {
    if (!session) return;
    confirmAlert(
      'Eliminar sesión',
      '¿Estás segura de que quieres eliminar esta sesión?',
      async () => {
        await sleepStorage.deleteSession(session.id);
        navigation.goBack();
      }
    );
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

  // === Edit Modal Logic ===
  const openEditModal = () => {
    if (!session) return;
    const totalMin = Math.floor(session.totalDuration / 60);
    const totalSec = session.totalDuration % 60;
    setEditDurationMin(String(totalMin));
    setEditDurationSec(String(totalSec));

    const startDate = new Date(session.startedAt);
    const endDate = new Date(session.endedAt);
    setEditStartTime(
      `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`
    );
    setEditEndTime(
      `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`
    );
    setLastChanged(null);
    setEditModalVisible(true);
  };

  const handleSaveEdit = () => {
    if (!session) return;

    const totalDurationSec = (parseInt(editDurationMin, 10) || 0) * 60 + (parseInt(editDurationSec, 10) || 0);

    if (totalDurationSec <= 0) {
      infoAlert('Error', 'La duración total debe ser mayor a 0.');
      return;
    }

    const parsedStart = parseHHMM(editStartTime);
    const parsedEnd = parseHHMM(editEndTime);

    if (!parsedStart) {
      infoAlert('Error', 'Formato de hora de inicio inválido. Usa HH:MM (24h).');
      return;
    }
    if (!parsedEnd) {
      infoAlert('Error', 'Formato de hora de fin inválido. Usa HH:MM (24h).');
      return;
    }

    const originalStart = new Date(session.startedAt);
    const originalEnd = new Date(session.endedAt);

    let newStart: Date;
    let newEnd: Date;

    if (lastChanged === 'end') {
      newEnd = new Date(originalEnd);
      newEnd.setHours(parsedEnd.hours, parsedEnd.minutes, 0, 0);
      newStart = new Date(newEnd.getTime() - totalDurationSec * 1000);
    } else {
      newStart = new Date(originalStart);
      newStart.setHours(parsedStart.hours, parsedStart.minutes, 0, 0);
      newEnd = new Date(newStart.getTime() + totalDurationSec * 1000);
    }

    const updatedSession: SleepSession = {
      ...session,
      totalDuration: totalDurationSec,
      startedAt: newStart.toISOString(),
      endedAt: newEnd.toISOString(),
      updatedAt: new Date().toISOString(),
    };

    sleepStorage.updateSession(session.id, {
      totalDuration: totalDurationSec,
      startedAt: newStart.toISOString(),
      endedAt: newEnd.toISOString(),
    });

    setSession(updatedSession);
    setEditModalVisible(false);
    infoAlert('Actualizado', 'Los tiempos de la sesión han sido actualizados.');
  };

  const getPreview = () => {
    if (!session) return { start: '--:--', end: '--:--', total: '0s' };

    const totalDurationSec = (parseInt(editDurationMin, 10) || 0) * 60 + (parseInt(editDurationSec, 10) || 0);
    const parsedStart = parseHHMM(editStartTime);
    const parsedEnd = parseHHMM(editEndTime);

    let previewStart = editStartTime;
    let previewEnd = editEndTime;

    if (parsedStart && parsedEnd && totalDurationSec > 0) {
      const originalStart = new Date(session.startedAt);
      const originalEnd = new Date(session.endedAt);

      if (lastChanged === 'end') {
        const endDate = new Date(originalEnd);
        endDate.setHours(parsedEnd.hours, parsedEnd.minutes, 0, 0);
        const startDate = new Date(endDate.getTime() - totalDurationSec * 1000);
        previewStart = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`;
      } else {
        const startDate = new Date(originalStart);
        startDate.setHours(parsedStart.hours, parsedStart.minutes, 0, 0);
        const endDate = new Date(startDate.getTime() + totalDurationSec * 1000);
        previewEnd = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;
      }
    }

    return { start: previewStart, end: previewEnd, total: formatDuration(totalDurationSec) };
  };

  if (!session) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <ArrowLeft size={24} color={colors.slate[800]} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Detalle de Sueño</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando...</Text>
        </View>
      </View>
    );
  }

  const start = formatDateTime(session.startedAt);
  const end = formatDateTime(session.endedAt);
  const preview = editModalVisible ? getPreview() : null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <ArrowLeft size={24} color={colors.slate[800]} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Detalle de Sueño</Text>
          <TouchableOpacity
            onPress={handleDelete}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Trash2 size={20} color={colors.error} />
          </TouchableOpacity>
        </View>

        <RefreshableScroll
          onRefresh={loadSession}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Duration Summary */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Moon size={20} color={sleepColors.main} />
              <Text style={styles.summaryTitle}>Duración</Text>
              <TouchableOpacity
                onPress={openEditModal}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.editIconBtn}
              >
                <Pencil size={16} color={sleepColors.main} />
              </TouchableOpacity>
            </View>
            <Text style={styles.totalDuration}>{formatDuration(session.totalDuration)}</Text>
          </View>

          {/* Pause */}
          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <PauseIcon size={16} color={colors.slate[500]} />
            </View>
            <Text style={styles.infoLabel}>Pausa</Text>
            <Text style={styles.infoValue}>
              {session.totalPauseTime > 0 ? formatDuration(session.totalPauseTime) : '0s'}
            </Text>
          </View>

          {/* Start Time */}
          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Clock size={16} color={colors.slate[500]} />
            </View>
            <Text style={styles.infoLabel}>Inicio</Text>
            <View style={styles.dateTimeRow}>
              <Text style={styles.infoValue}>{start.date}</Text>
              <Text style={styles.infoValueTime}>{start.time}</Text>
            </View>
          </View>

          {/* End Time */}
          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Calendar size={16} color={colors.slate[500]} />
            </View>
            <Text style={styles.infoLabel}>Fin</Text>
            <View style={styles.dateTimeRow}>
              <Text style={styles.infoValue}>{end.date}</Text>
              <Text style={styles.infoValueTime}>{end.time}</Text>
            </View>
          </View>

          {/* Baby Selector */}
          {babies.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionLabelRow}>
                <BabyIcon size={16} color={colors.slate[500]} />
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
                      onPress={() => handleBabyChange(isSelected ? null : baby.id)}
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
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Notas</Text>
            <View style={styles.notesContainer}>
              <TextInput
                style={styles.notesInput}
                placeholder="Agregar notas sobre esta sesión..."
                placeholderTextColor={colors.slate[400]}
                value={notes}
                onChangeText={handleNotesChange}
                multiline
                numberOfLines={4}
                maxLength={MAX_NOTES}
                textAlignVertical="top"
              />
              <Text style={styles.charCount}>{notes.length}/{MAX_NOTES}</Text>
            </View>
          </View>

          {/* Photos */}
          <View style={styles.section}>
            <View style={styles.sectionLabelRow}>
              <Paperclip size={16} color={colors.slate[500]} />
              <Text style={styles.sectionLabel}>Fotos</Text>
              <View style={{ flex: 1 }} />
              <TouchableOpacity onPress={handlePickImage} style={{ marginRight: spacing.md }}>
                <ImagePlus size={20} color={colors.slate[500]} />
              </TouchableOpacity>
              {Platform.OS !== 'web' && (
                <TouchableOpacity onPress={handleTakePhoto}>
                  <Camera size={20} color={colors.slate[500]} />
                </TouchableOpacity>
              )}
            </View>
            {photos.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.sm }}>
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
          </View>

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
                  setHasChanges(true);
                }
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
            />
          )}

          {/* Save Button */}
          {hasChanges && (
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              <Text style={styles.saveBtnText}>
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </Text>
            </TouchableOpacity>
          )}
        </RefreshableScroll>

        {/* Edit Duration Modal */}
        <Modal
          visible={editModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setEditModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Editar Sesion</Text>
                <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                  <X size={22} color={colors.slate[600]} />
                </TouchableOpacity>
              </View>

              {/* Duration Input */}
              <Text style={styles.modalSectionLabel}>Duración total</Text>
              <View style={styles.modalDurationRow}>
                <View style={styles.modalTimeField}>
                  <TextInput
                    style={styles.modalTimeInput}
                    value={editDurationMin}
                    onChangeText={(v) => {
                      setEditDurationMin(v.replace(/[^0-9]/g, ''));
                      setLastChanged('duration');
                    }}
                    keyboardType="number-pad"
                    maxLength={4}
                    selectTextOnFocus
                  />
                  <Text style={styles.modalTimeUnit}>min</Text>
                </View>
                <View style={styles.modalTimeField}>
                  <TextInput
                    style={styles.modalTimeInput}
                    value={editDurationSec}
                    onChangeText={(v) => {
                      setEditDurationSec(v.replace(/[^0-9]/g, ''));
                      setLastChanged('duration');
                    }}
                    keyboardType="number-pad"
                    maxLength={2}
                    selectTextOnFocus
                  />
                  <Text style={styles.modalTimeUnit}>seg</Text>
                </View>
              </View>

              {/* Total preview */}
              {preview && (
                <View style={styles.previewTotalRow}>
                  <Moon size={14} color={sleepColors.main} />
                  <Text style={styles.previewTotalLabel}>Total:</Text>
                  <Text style={styles.previewTotalValue}>{preview.total}</Text>
                </View>
              )}

              {/* Time Inputs */}
              <Text style={[styles.modalSectionLabel, { marginTop: spacing.lg }]}>
                Hora de inicio y fin (formato 24h)
              </Text>
              <View style={styles.modalTimesRow}>
                <View style={styles.modalTimeBox}>
                  <Text style={styles.modalTimeBoxLabel}>Inicio</Text>
                  <TextInput
                    style={styles.modalClockInput}
                    value={editStartTime}
                    onChangeText={(v) => { setEditStartTime(v); setLastChanged('start'); }}
                    placeholder="HH:MM"
                    placeholderTextColor={colors.slate[400]}
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                    selectTextOnFocus
                  />
                  {preview && lastChanged === 'end' && (
                    <Text style={styles.previewRecalc}>→ {preview.start}</Text>
                  )}
                </View>
                <View style={styles.modalTimeBox}>
                  <Text style={styles.modalTimeBoxLabel}>Fin</Text>
                  <TextInput
                    style={styles.modalClockInput}
                    value={editEndTime}
                    onChangeText={(v) => { setEditEndTime(v); setLastChanged('end'); }}
                    placeholder="HH:MM"
                    placeholderTextColor={colors.slate[400]}
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                    selectTextOnFocus
                  />
                  {preview && lastChanged !== 'end' && lastChanged !== null && (
                    <Text style={styles.previewRecalc}>→ {preview.end}</Text>
                  )}
                </View>
              </View>

              {/* Hint */}
              <View style={styles.hintBox}>
                <Text style={styles.hintText}>
                  Al cambiar la duracion, se recalcula la hora de fin.{'\n'}
                  Al cambiar la hora de fin, se recalcula la hora de inicio.
                </Text>
              </View>

              {/* Actions */}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setEditModalVisible(false)}
                >
                  <Text style={styles.modalCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalSaveBtn}
                  onPress={handleSaveEdit}
                >
                  <Check size={18} color={colors.white} />
                  <Text style={styles.modalSaveText}>Guardar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </KeyboardAvoidingView>
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
  summaryCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
    ...shadows.sm,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    width: '100%',
  },
  summaryTitle: {
    ...typography.bodyBold,
    color: colors.slate[700],
    flex: 1,
  },
  editIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: sleepColors.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalDuration: {
    fontSize: 36,
    fontWeight: '300',
    color: colors.slate[800],
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: radii.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.slate[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  infoLabel: {
    ...typography.body,
    color: colors.slate[600],
    flex: 1,
  },
  infoValue: {
    ...typography.bodyBold,
    color: colors.slate[800],
  },
  infoValueTime: {
    ...typography.small,
    color: colors.slate[500],
    marginLeft: spacing.sm,
  },
  dateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  section: {
    marginTop: spacing.lg,
  },
  sectionLabel: {
    ...typography.smallBold,
    color: colors.slate[700],
    marginBottom: spacing.sm,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  babyChipsRow: {
    gap: spacing.sm,
  },
  babyChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.slate[100],
  },
  babyChipSelected: {
    backgroundColor: sleepColors.main,
  },
  babyChipText: {
    ...typography.smallBold,
    color: colors.slate[600],
  },
  babyChipTextSelected: {
    color: colors.white,
  },
  notesContainer: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.lg,
    ...shadows.sm,
  },
  notesInput: {
    ...typography.small,
    color: colors.slate[800],
    minHeight: 100,
    textAlignVertical: 'top',
    padding: 0,
  },
  charCount: {
    ...typography.caption,
    color: colors.slate[400],
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  photoThumb: {
    width: 64,
    height: 64,
    borderRadius: radii.sm,
    marginRight: spacing.sm,
    position: 'relative',
  },
  photoImg: {
    width: 64,
    height: 64,
    borderRadius: radii.sm,
  },
  photoRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtn: {
    backgroundColor: sleepColors.main,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.xxl,
    ...shadows.md,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    ...typography.button,
    color: colors.white,
  },

  // === Edit Modal Styles ===
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    ...typography.h4,
    color: colors.slate[800],
  },
  modalSectionLabel: {
    ...typography.smallBold,
    color: colors.slate[600],
    marginBottom: spacing.sm,
  },
  modalDurationRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
    justifyContent: 'center',
  },
  modalTimeField: {
    alignItems: 'center',
    gap: 2,
  },
  modalTimeInput: {
    width: 64,
    height: 44,
    backgroundColor: colors.slate[50],
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.slate[200],
    textAlign: 'center',
    ...typography.bodyBold,
    color: colors.slate[800],
  },
  modalTimeUnit: {
    ...typography.caption,
    color: colors.slate[400],
  },
  previewTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: sleepColors.light,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  previewTotalLabel: {
    ...typography.small,
    color: sleepColors.main,
  },
  previewTotalValue: {
    ...typography.bodyBold,
    color: sleepColors.main,
  },
  modalTimesRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  modalTimeBox: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  modalTimeBoxLabel: {
    ...typography.captionBold,
    color: colors.slate[600],
  },
  modalClockInput: {
    width: '100%',
    height: 44,
    backgroundColor: colors.slate[50],
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.slate[200],
    textAlign: 'center',
    ...typography.bodyBold,
    color: colors.slate[800],
  },
  previewRecalc: {
    ...typography.captionBold,
    color: sleepColors.main,
  },
  hintBox: {
    backgroundColor: sleepColors.light,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  hintText: {
    ...typography.caption,
    color: sleepColors.main,
    lineHeight: 18,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: colors.slate[100],
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  modalCancelText: {
    ...typography.button,
    color: colors.slate[600],
  },
  modalSaveBtn: {
    flex: 1,
    backgroundColor: sleepColors.main,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  modalSaveText: {
    ...typography.button,
    color: colors.white,
  },
});
