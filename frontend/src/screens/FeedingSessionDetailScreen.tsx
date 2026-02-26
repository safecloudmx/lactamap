import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput,
  KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import { confirmAlert, infoAlert } from '../services/crossPlatformAlert';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft, Trash2, Clock, Pause as PauseIcon, Calendar, Timer,
  Pencil, Check, X,
} from 'lucide-react-native';
import { colors, spacing, typography, radii, shadows } from '../theme';
import { FeedingSession } from '../types';
import { formatDuration } from '../hooks/useNursingTimer';
import * as nursingStorage from '../services/nursingStorage';
import BabySelector from '../components/BabySelector';

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

function parseTimeToComponents(seconds: number): { h: number; m: number; s: number } {
  return {
    h: Math.floor(seconds / 3600),
    m: Math.floor((seconds % 3600) / 60),
    s: seconds % 60,
  };
}

function parseHHMM(timeStr: string): { hours: number; minutes: number } | null {
  // Accept HH:MM format (24h)
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return { hours, minutes };
}

export default function FeedingSessionDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ params: { sessionId: string } }, 'params'>>();
  const insets = useSafeAreaInsets();

  const { sessionId } = route.params;

  const [session, setSession] = useState<FeedingSession | null>(null);
  const [notes, setNotes] = useState('');
  const [selectedBabyId, setSelectedBabyId] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editLeftMin, setEditLeftMin] = useState('');
  const [editLeftSec, setEditLeftSec] = useState('');
  const [editRightMin, setEditRightMin] = useState('');
  const [editRightSec, setEditRightSec] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  // Track which field was last changed for auto-recalculation
  const [lastChanged, setLastChanged] = useState<'duration' | 'start' | 'end' | null>(null);

  useEffect(() => {
    loadSession();
  }, [sessionId]);

  const loadSession = async () => {
    const s = await nursingStorage.getSessionById(sessionId);
    if (s) {
      setSession(s);
      setNotes(s.notes);
      setSelectedBabyId(s.babyId ?? null);
    }
  };

  const handleNotesChange = (text: string) => {
    setNotes(text);
    setHasChanges(true);
  };

  const handleBabyChange = (babyId: string | null) => {
    setSelectedBabyId(babyId);
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!session) return;
    setSaving(true);
    await nursingStorage.updateSession(session.id, {
      notes: notes.trim(),
      babyId: selectedBabyId ?? undefined,
    });
    setSaving(false);
    setHasChanges(false);
    infoAlert('Guardado', 'Los cambios fueron guardados.');
  };

  const handleDelete = () => {
    if (!session) return;
    confirmAlert(
      'Eliminar sesion',
      '¿Estas segura de que quieres eliminar esta sesion?',
      async () => {
        await nursingStorage.deleteSession(session.id);
        navigation.goBack();
      }
    );
  };

  // === Edit Modal Logic ===

  const openEditModal = () => {
    if (!session) return;

    const leftParts = parseTimeToComponents(session.leftDuration);
    const rightParts = parseTimeToComponents(session.rightDuration);

    setEditLeftMin(String(leftParts.h * 60 + leftParts.m));
    setEditLeftSec(String(leftParts.s));
    setEditRightMin(String(rightParts.h * 60 + rightParts.m));
    setEditRightSec(String(rightParts.s));

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

  const computeTotalDurationSec = (): number => {
    const leftSec = (parseInt(editLeftMin, 10) || 0) * 60 + (parseInt(editLeftSec, 10) || 0);
    const rightSec = (parseInt(editRightMin, 10) || 0) * 60 + (parseInt(editRightSec, 10) || 0);
    return leftSec + rightSec;
  };

  const handleDurationChange = (field: 'leftMin' | 'leftSec' | 'rightMin' | 'rightSec', value: string) => {
    // Only allow numeric input
    const numericValue = value.replace(/[^0-9]/g, '');
    switch (field) {
      case 'leftMin': setEditLeftMin(numericValue); break;
      case 'leftSec': setEditLeftSec(numericValue); break;
      case 'rightMin': setEditRightMin(numericValue); break;
      case 'rightSec': setEditRightSec(numericValue); break;
    }
    setLastChanged('duration');
  };

  const handleStartTimeChange = (value: string) => {
    setEditStartTime(value);
    setLastChanged('start');
  };

  const handleEndTimeChange = (value: string) => {
    setEditEndTime(value);
    setLastChanged('end');
  };

  const handleSaveEdit = () => {
    if (!session) return;

    const leftTotalSec = (parseInt(editLeftMin, 10) || 0) * 60 + (parseInt(editLeftSec, 10) || 0);
    const rightTotalSec = (parseInt(editRightMin, 10) || 0) * 60 + (parseInt(editRightSec, 10) || 0);
    const totalDurationSec = leftTotalSec + rightTotalSec;

    if (totalDurationSec <= 0) {
      infoAlert('Error', 'La duracion total debe ser mayor a 0.');
      return;
    }

    const parsedStart = parseHHMM(editStartTime);
    const parsedEnd = parseHHMM(editEndTime);

    if (!parsedStart) {
      infoAlert('Error', 'Formato de hora de inicio invalido. Usa HH:MM (24h).');
      return;
    }
    if (!parsedEnd) {
      infoAlert('Error', 'Formato de hora de fin invalido. Usa HH:MM (24h).');
      return;
    }

    const originalStart = new Date(session.startedAt);
    const originalEnd = new Date(session.endedAt);

    let newStart: Date;
    let newEnd: Date;

    if (lastChanged === 'end') {
      // User changed end time -> recalculate start time based on end - totalDuration
      newEnd = new Date(originalEnd);
      newEnd.setHours(parsedEnd.hours, parsedEnd.minutes, 0, 0);
      newStart = new Date(newEnd.getTime() - totalDurationSec * 1000);
    } else if (lastChanged === 'start') {
      // User changed start time -> recalculate end time based on start + totalDuration
      newStart = new Date(originalStart);
      newStart.setHours(parsedStart.hours, parsedStart.minutes, 0, 0);
      newEnd = new Date(newStart.getTime() + totalDurationSec * 1000);
    } else {
      // Duration changed (or nothing specific) -> keep start, recalculate end
      newStart = new Date(originalStart);
      newStart.setHours(parsedStart.hours, parsedStart.minutes, 0, 0);
      newEnd = new Date(newStart.getTime() + totalDurationSec * 1000);
    }

    // Determine lastSide
    let lastSide: 'left' | 'right' | 'both' = 'both';
    if (leftTotalSec > 0 && rightTotalSec === 0) lastSide = 'left';
    else if (rightTotalSec > 0 && leftTotalSec === 0) lastSide = 'right';

    const updatedSession: FeedingSession = {
      ...session,
      leftDuration: leftTotalSec,
      rightDuration: rightTotalSec,
      totalDuration: totalDurationSec,
      startedAt: newStart.toISOString(),
      endedAt: newEnd.toISOString(),
      lastSide,
      updatedAt: new Date().toISOString(),
    };

    // Save to storage
    nursingStorage.updateSession(session.id, {
      leftDuration: leftTotalSec,
      rightDuration: rightTotalSec,
      totalDuration: totalDurationSec,
      startedAt: newStart.toISOString(),
      endedAt: newEnd.toISOString(),
      lastSide,
    });

    setSession(updatedSession);
    setEditModalVisible(false);
    infoAlert('Actualizado', 'Los tiempos de la sesion han sido actualizados.');
  };

  // Compute a preview of the recalculated times for the modal
  const getPreview = () => {
    if (!session) return { start: '--:--', end: '--:--', total: '0s' };

    const leftTotalSec = (parseInt(editLeftMin, 10) || 0) * 60 + (parseInt(editLeftSec, 10) || 0);
    const rightTotalSec = (parseInt(editRightMin, 10) || 0) * 60 + (parseInt(editRightSec, 10) || 0);
    const totalDurationSec = leftTotalSec + rightTotalSec;

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

    return {
      start: previewStart,
      end: previewEnd,
      total: formatDuration(totalDurationSec),
    };
  };

  if (!session) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <ArrowLeft size={24} color={colors.slate[800]} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Detalle de Sesion</Text>
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
          <Text style={styles.headerTitle}>Detalle de Sesion</Text>
          <TouchableOpacity
            onPress={handleDelete}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Trash2 size={20} color={colors.error} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Duration Summary */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Timer size={20} color={colors.primary[500]} />
              <Text style={styles.summaryTitle}>Duracion</Text>
              <TouchableOpacity
                onPress={openEditModal}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.editIconBtn}
              >
                <Pencil size={16} color={colors.primary[500]} />
              </TouchableOpacity>
            </View>
            <Text style={styles.totalDuration}>{formatDuration(session.totalDuration)}</Text>
            <View style={styles.sidesRow}>
              <View style={[styles.sideCard, session.leftDuration > 0 && styles.sideCardActive]}>
                <Text style={styles.sideCardLabel}>Izquierdo</Text>
                <Text style={[styles.sideCardValue, session.leftDuration > 0 && styles.sideCardValueActive]}>
                  {formatDuration(session.leftDuration)}
                </Text>
              </View>
              <View style={[styles.sideCard, session.rightDuration > 0 && styles.sideCardActive]}>
                <Text style={styles.sideCardLabel}>Derecho</Text>
                <Text style={[styles.sideCardValue, session.rightDuration > 0 && styles.sideCardValueActive]}>
                  {formatDuration(session.rightDuration)}
                </Text>
              </View>
            </View>
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
          <View style={styles.section}>
            <BabySelector
              selectedBabyId={selectedBabyId}
              onSelectBaby={handleBabyChange}
            />
          </View>

          {/* Notes */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Notas</Text>
            <View style={styles.notesContainer}>
              <TextInput
                style={styles.notesInput}
                placeholder="Agregar notas sobre esta sesion..."
                placeholderTextColor={colors.slate[400]}
                value={notes}
                onChangeText={handleNotesChange}
                multiline
                numberOfLines={4}
                maxLength={3000}
                textAlignVertical="top"
              />
              <Text style={styles.charCount}>{notes.length}/3000</Text>
            </View>
          </View>

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
        </ScrollView>

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

              {/* Duration Inputs */}
              <Text style={styles.modalSectionLabel}>Duracion por lado</Text>

              <View style={styles.modalSidesRow}>
                {/* Left Side */}
                <View style={styles.modalSideBox}>
                  <Text style={styles.modalSideLabel}>🤱 Izquierdo</Text>
                  <View style={styles.modalTimeInputRow}>
                    <View style={styles.modalTimeField}>
                      <TextInput
                        style={styles.modalTimeInput}
                        value={editLeftMin}
                        onChangeText={(v) => handleDurationChange('leftMin', v)}
                        keyboardType="number-pad"
                        maxLength={3}
                        selectTextOnFocus
                      />
                      <Text style={styles.modalTimeUnit}>min</Text>
                    </View>
                    <View style={styles.modalTimeField}>
                      <TextInput
                        style={styles.modalTimeInput}
                        value={editLeftSec}
                        onChangeText={(v) => handleDurationChange('leftSec', v)}
                        keyboardType="number-pad"
                        maxLength={2}
                        selectTextOnFocus
                      />
                      <Text style={styles.modalTimeUnit}>seg</Text>
                    </View>
                  </View>
                </View>

                {/* Right Side */}
                <View style={styles.modalSideBox}>
                  <Text style={styles.modalSideLabel}>🤱 Derecho</Text>
                  <View style={styles.modalTimeInputRow}>
                    <View style={styles.modalTimeField}>
                      <TextInput
                        style={styles.modalTimeInput}
                        value={editRightMin}
                        onChangeText={(v) => handleDurationChange('rightMin', v)}
                        keyboardType="number-pad"
                        maxLength={3}
                        selectTextOnFocus
                      />
                      <Text style={styles.modalTimeUnit}>min</Text>
                    </View>
                    <View style={styles.modalTimeField}>
                      <TextInput
                        style={styles.modalTimeInput}
                        value={editRightSec}
                        onChangeText={(v) => handleDurationChange('rightSec', v)}
                        keyboardType="number-pad"
                        maxLength={2}
                        selectTextOnFocus
                      />
                      <Text style={styles.modalTimeUnit}>seg</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Total preview */}
              {preview && (
                <View style={styles.previewTotalRow}>
                  <Timer size={14} color={colors.primary[500]} />
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
                    onChangeText={handleStartTimeChange}
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
                    onChangeText={handleEndTimeChange}
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

              {/* Explanation */}
              <View style={styles.hintBox}>
                <Text style={styles.hintText}>
                  💡 Al cambiar la duracion, se recalcula la hora de fin.{'\n'}
                  Al cambiar la hora de fin, se recalcula la hora de inicio.
                </Text>
              </View>

              {/* Action Buttons */}
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
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalDuration: {
    fontSize: 36,
    fontWeight: '300',
    color: colors.slate[800],
  },
  sidesRow: {
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%',
  },
  sideCard: {
    flex: 1,
    backgroundColor: colors.slate[50],
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  sideCardActive: {
    backgroundColor: colors.primary[50],
  },
  sideCardLabel: {
    ...typography.caption,
    color: colors.slate[500],
  },
  sideCardValue: {
    ...typography.bodyBold,
    color: colors.slate[400],
  },
  sideCardValueActive: {
    color: colors.primary[600],
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
  saveBtn: {
    backgroundColor: colors.primary[500],
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.xxl,
    ...shadows.primary,
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
  modalSidesRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  modalSideBox: {
    flex: 1,
    backgroundColor: colors.slate[50],
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
  },
  modalSideLabel: {
    ...typography.captionBold,
    color: colors.slate[700],
    textAlign: 'center',
  },
  modalTimeInputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalTimeField: {
    alignItems: 'center',
    gap: 2,
  },
  modalTimeInput: {
    width: 52,
    height: 40,
    backgroundColor: colors.white,
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
    backgroundColor: colors.primary[50],
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  previewTotalLabel: {
    ...typography.small,
    color: colors.primary[600],
  },
  previewTotalValue: {
    ...typography.bodyBold,
    color: colors.primary[600],
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
    color: colors.primary[500],
  },
  hintBox: {
    backgroundColor: colors.primary[50],
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  hintText: {
    ...typography.caption,
    color: colors.primary[700],
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
    backgroundColor: colors.primary[500],
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
