import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Image, StyleSheet, Platform, KeyboardAvoidingView,
} from 'react-native';
import { confirmAlert, infoAlert } from '../services/crossPlatformAlert';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft, Play, Square, RotateCcw, Pause, Clock, Trash2,
  Moon, StickyNote, Paperclip, Camera, ImagePlus, X,
  Baby as BabyIcon,
} from 'lucide-react-native';
import { colors, spacing, typography, radii, shadows } from '../theme';
import { useSleepTimer, formatTime, formatDuration } from '../hooks/useSleepTimer';
import { SleepSession, Baby } from '../types';
import * as sleepStorage from '../services/sleepStorage';

let ImagePicker: any = null;
try { ImagePicker = require('expo-image-picker'); } catch (_) {}

// Sleep timer theme colors (violet)
const sleepColors = {
  main: '#7c3aed',
  light: '#f5f3ff',
  medium: '#ede9fe',
  dark: '#6d28d9',
  accent: '#a78bfa',
};

const MAX_NOTES = 3000;

function formatSessionTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDateShort(d: Date): string {
  const day = d.getDate();
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${day} ${months[d.getMonth()]}`;
}

function formatTimeShort(d: Date): string {
  return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export default function SleepTimerScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const timer = useSleepTimer();

  const [selectedBabyId, setSelectedBabyId] = useState<string | null>(null);
  const [babies, setBabies] = useState<Baby[]>([]);
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<{ uri: string }[]>([]);
  const [todaySessions, setTodaySessions] = useState<SleepSession[]>([]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadData = useCallback(async () => {
    const [babiesList, sessions] = await Promise.all([
      sleepStorage.getBabies(),
      sleepStorage.getTodaySessions(),
    ]);
    setBabies(babiesList);
    setTodaySessions(sessions);
    const activeId = await sleepStorage.getActiveBabyId();
    if (activeId) setSelectedBabyId(activeId);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleStart = () => {
    timer.start();
  };

  const handleStop = async () => {
    const result = timer.finish();
    if (!result) return;

    const session: SleepSession = {
      ...result,
      babyId: selectedBabyId ?? undefined,
      notes,
      photos: photos.map((p) => p.uri),
    };

    await sleepStorage.saveSession(session);
    await loadData();

    setNotes('');
    setPhotos([]);

    infoAlert(
      'Sesión de sueño guardada',
      `Duración: ${formatDuration(session.totalDuration)}` +
      (session.totalPauseTime > 0 ? `\nPausa: ${formatDuration(session.totalPauseTime)}` : '')
    );
  };

  const handleDelete = (session: SleepSession) => {
    confirmAlert(
      'Eliminar registro',
      `¿Eliminar la sesión de ${formatSessionTime(session.startedAt)}?`,
      async () => {
        await sleepStorage.deleteSession(session.id);
        setTodaySessions((prev) => prev.filter((s) => s.id !== session.id));
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
  const statusLabel = timer.isRunning
    ? 'En progreso...'
    : timer.isPaused
    ? 'En pausa'
    : timer.hasStarted
    ? 'Finalizado'
    : babies.length > 0 && selectedBabyId
    ? `Último: ${todaySessions.length > 0 ? getLastSleepLabel(todaySessions[0]) : 'Sin registros'}`
    : todaySessions.length > 0
    ? `Último: ${getLastSleepLabel(todaySessions[0])}`
    : 'Sin registros';

  function getLastSleepLabel(s: SleepSession): string {
    const diff = Date.now() - new Date(s.endedAt).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `hace ${days}d ${hours % 24}h`;
    if (hours > 0) return `hace ${hours}h ${mins % 60}m`;
    if (mins > 0) return `hace ${mins}m`;
    return 'hace <1min';
  }

  const getStatusText = () => {
    if (timer.isRunning) return 'En progreso...';
    if (timer.isPaused) return 'En pausa';
    if (todaySessions.length > 0) return `Último: ${getLastSleepLabel(todaySessions[0])}`;
    return 'Sin registros';
  };

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
        <Text style={styles.headerTitle}>Temporizador de Sueño</Text>
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
            <View style={[styles.mainIcon, timer.isRunning && styles.mainIconActive]}>
              <Moon size={48} color={timer.isRunning ? sleepColors.main : sleepColors.accent} />
              {timer.isRunning && (
                <View style={styles.clockOverlay}>
                  <Clock size={20} color={sleepColors.main} />
                </View>
              )}
            </View>
          </View>

          {/* Title + Status */}
          <View style={styles.titleSection}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Sueño</Text>
              {timer.hasStarted && (
                <TouchableOpacity
                  onPress={() => {
                    confirmAlert(
                      'Descartar sesión',
                      '¿Descartar la sesión actual?',
                      () => timer.reset()
                    );
                  }}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Trash2 size={20} color={colors.slate[400]} />
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.statusText}>{getStatusText()}</Text>
          </View>

          {/* Main Button */}
          <View style={styles.mainBtnSection}>
            {!timer.hasStarted ? (
              <TouchableOpacity
                style={styles.startBtn}
                onPress={handleStart}
                activeOpacity={0.8}
              >
                <Play size={20} color={sleepColors.dark} />
                <Text style={styles.startBtnText}>Iniciar</Text>
              </TouchableOpacity>
            ) : timer.isRunning ? (
              <TouchableOpacity
                style={styles.stopBtn}
                onPress={handleStop}
                activeOpacity={0.8}
              >
                <Square size={18} color={colors.white} fill={colors.white} />
                <Text style={styles.stopBtnText}>Detener</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.resumeBtn}
                onPress={() => timer.resume()}
                activeOpacity={0.8}
              >
                <Play size={20} color={sleepColors.dark} />
                <Text style={styles.resumeBtnText}>Reanudar</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Details Card */}
          <View style={styles.detailsCard}>
            {/* Duration */}
            {timer.hasStarted && (
              <>
                <View style={styles.fieldRow}>
                  <View style={styles.fieldLeft}>
                    <Clock size={20} color={colors.slate[400]} />
                    <Text style={styles.fieldLabel}>Duración</Text>
                  </View>
                  <Text style={styles.fieldValueLarge}>{formatDuration(timer.elapsedTime)}</Text>
                </View>
                <View style={styles.divider} />
              </>
            )}

            {/* Pause */}
            {timer.hasStarted && timer.pauseTime > 0 && (
              <>
                <View style={styles.fieldRow}>
                  <View style={styles.fieldLeft}>
                    <Pause size={20} color={colors.slate[400]} />
                    <Text style={styles.fieldLabel}>Pausa</Text>
                  </View>
                  <Text style={styles.fieldValue}>{formatDuration(timer.pauseTime)}</Text>
                </View>
                <View style={styles.divider} />
              </>
            )}

            {/* Started */}
            {timer.sessionStartedAt && (
              <>
                <View style={styles.fieldRow}>
                  <View style={styles.fieldLeft}>
                    <Clock size={20} color={colors.slate[400]} />
                    <Text style={styles.fieldLabel}>Inicio</Text>
                  </View>
                  <View style={styles.dateTimeRow}>
                    <View style={styles.dateBadge}>
                      <Text style={styles.dateBadgeText}>{formatDateShort(timer.sessionStartedAt)}</Text>
                    </View>
                    <View style={styles.dateBadge}>
                      <Text style={styles.dateBadgeText}>{formatTimeShort(timer.sessionStartedAt)}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.divider} />
              </>
            )}

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
                          sleepStorage.setActiveBabyId(newId);
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

          {/* Save button (when paused/stopped) */}
          {timer.isPaused && (
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleStop}
              activeOpacity={0.8}
            >
              <Text style={styles.saveBtnText}>Guardar</Text>
            </TouchableOpacity>
          )}

          {/* Today's Sessions */}
          {todaySessions.length > 0 && (
            <View style={styles.todaySection}>
              <Text style={styles.todaySectionTitle}>Sesiones de hoy</Text>
              {todaySessions.map((session) => {
                const babyName = session.babyId
                  ? babies.find((b) => b.id === session.babyId)?.name
                  : null;
                return (
                  <TouchableOpacity
                    key={session.id}
                    style={styles.todayCard}
                    onPress={() => navigation.navigate('SleepSessionDetail', { sessionId: session.id })}
                    onLongPress={() => handleDelete(session)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.todayCardLeft}>
                      <View style={styles.todayIcon}>
                        <Moon size={16} color={sleepColors.main} />
                      </View>
                      <View style={styles.todayInfo}>
                        <Text style={styles.todayTimeRange}>
                          {formatSessionTime(session.startedAt)} - {formatSessionTime(session.endedAt)}
                        </Text>
                        <Text style={styles.todayDuration}>
                          {formatDuration(session.totalDuration)}
                          {babyName ? ` · ${babyName}` : ''}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleDelete(session)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Trash2 size={14} color={colors.slate[400]} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* History Link */}
          <TouchableOpacity
            style={styles.historyLink}
            onPress={() => navigation.navigate('SleepHistory')}
            activeOpacity={0.7}
          >
            <Clock size={18} color={sleepColors.main} />
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

  // Icon section
  iconSection: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  mainIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.slate[200],
    position: 'relative',
  },
  mainIconActive: {
    borderColor: sleepColors.accent,
    backgroundColor: sleepColors.light,
  },
  clockOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: sleepColors.light,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },

  // Title
  titleSection: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  title: {
    ...typography.h2,
    color: colors.slate[800],
  },
  statusText: {
    ...typography.small,
    color: colors.slate[500],
  },

  // Main button
  mainBtnSection: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: sleepColors.light,
    borderWidth: 2,
    borderColor: sleepColors.accent,
    paddingHorizontal: spacing.xxxl,
    paddingVertical: spacing.lg,
    borderRadius: radii.full,
  },
  startBtnText: {
    ...typography.button,
    color: sleepColors.dark,
  },
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: sleepColors.main,
    paddingHorizontal: spacing.xxxl,
    paddingVertical: spacing.lg,
    borderRadius: radii.full,
  },
  stopBtnText: {
    ...typography.button,
    color: colors.white,
  },
  resumeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: sleepColors.light,
    borderWidth: 2,
    borderColor: sleepColors.accent,
    paddingHorizontal: spacing.xxxl,
    paddingVertical: spacing.lg,
    borderRadius: radii.full,
  },
  resumeBtnText: {
    ...typography.button,
    color: sleepColors.dark,
  },

  // Details card
  detailsCard: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing.xl,
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
    color: colors.slate[600],
  },
  fieldValue: {
    ...typography.body,
    color: colors.slate[800],
  },
  fieldValueLarge: {
    ...typography.h3,
    color: colors.slate[800],
  },
  fieldValueLink: {
    ...typography.body,
    color: colors.slate[400],
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

  // Baby chips
  babyChipsRow: {
    paddingVertical: spacing.sm,
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

  // Notes
  notesInput: {
    ...typography.small,
    color: colors.slate[800],
    backgroundColor: colors.slate[50],
    borderRadius: radii.sm,
    padding: spacing.md,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  charCount: {
    ...typography.caption,
    color: colors.slate[400],
    textAlign: 'right',
    marginTop: spacing.xs,
  },

  // Photos
  photoActions: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  photoRow: {
    marginTop: spacing.sm,
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

  // Save button
  saveBtn: {
    backgroundColor: sleepColors.main,
    paddingVertical: spacing.lg,
    borderRadius: radii.lg,
    alignItems: 'center',
    marginTop: spacing.xl,
    ...shadows.md,
  },
  saveBtnText: {
    ...typography.button,
    color: colors.white,
  },

  // Today's sessions
  todaySection: {
    marginTop: spacing.xxl,
    gap: spacing.sm,
  },
  todaySectionTitle: {
    ...typography.h4,
    color: colors.slate[800],
    marginBottom: spacing.xs,
  },
  todayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: radii.md,
    ...shadows.sm,
  },
  todayCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  todayIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: sleepColors.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayInfo: {
    gap: 2,
  },
  todayTimeRange: {
    ...typography.bodyBold,
    color: colors.slate[800],
  },
  todayDuration: {
    ...typography.caption,
    color: colors.slate[500],
  },

  // History link
  historyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
    marginTop: spacing.md,
  },
  historyLinkText: {
    ...typography.bodyBold,
    color: sleepColors.main,
  },
});
