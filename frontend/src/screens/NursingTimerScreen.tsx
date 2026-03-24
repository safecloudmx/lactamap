import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';
import { confirmAlert, infoAlert } from '../services/crossPlatformAlert';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft, Play, Pause, RotateCcw, Baby, Clock, Trash2,
} from 'lucide-react-native';
import { colors, spacing, typography, radii, shadows } from '../theme';
import { useNursingTimer, formatTime, formatDuration } from '../hooks/useNursingTimer';
import { FeedingSession } from '../types';
import * as nursingStorage from '../services/nursingStorage';
import BabySelector from '../components/BabySelector';

function formatSessionTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export default function NursingTimerScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const timer = useNursingTimer();

  const [selectedBabyId, setSelectedBabyId] = useState<string | null>(null);
  const [todaySessions, setTodaySessions] = useState<FeedingSession[]>([]);

  // Load last selected baby
  useEffect(() => {
    nursingStorage.getActiveBabyId().then((id) => {
      if (id) setSelectedBabyId(id);
    });
  }, []);

  // Load today's sessions on focus
  const loadTodaySessions = useCallback(async () => {
    const sessions = await nursingStorage.getTodaySessions();
    setTodaySessions(sessions);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTodaySessions();
    }, [loadTodaySessions])
  );

  const handleFinish = async () => {
    const result = timer.finish();
    if (!result) return;

    const session: FeedingSession = {
      ...result,
      babyId: selectedBabyId ?? undefined,
      notes: '',
    };

    await nursingStorage.saveSession(session);
    await loadTodaySessions();

    infoAlert(
      'Sesión guardada',
      `Duración total: ${formatDuration(session.totalDuration)}\n` +
      `Izquierdo: ${formatDuration(session.leftDuration)}\n` +
      `Derecho: ${formatDuration(session.rightDuration)}` +
      (session.totalPauseTime > 0 ? `\nPausa: ${formatDuration(session.totalPauseTime)}` : '')
    );
  };

  const handleDeleteSession = (session: FeedingSession) => {
    confirmAlert(
      'Eliminar registro',
      `¿Eliminar la sesión de ${formatSessionTime(session.startedAt)}?`,
      async () => {
        await nursingStorage.deleteSession(session.id);
        setTodaySessions((prev) => prev.filter((s) => s.id !== session.id));
      }
    );
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
        <Text style={styles.headerTitle}>Cronómetro de Lactancia</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Baby Selector */}
        <View style={styles.section}>
          <BabySelector
            selectedBabyId={selectedBabyId}
            onSelectBaby={setSelectedBabyId}
          />
        </View>

        {/* Main Timer Display */}
        <View style={styles.timerSection}>
          <View style={styles.babyIcon}>
            <Baby size={32} color={colors.primary[500]} />
          </View>
          <Text style={styles.totalTime}>{formatTime(timer.totalTime)}</Text>
          <Text style={styles.totalLabel}>Tiempo total</Text>
          {timer.isPaused && (
            <View style={styles.pauseIndicator}>
              <Pause size={14} color={colors.warning} />
              <Text style={styles.pauseText}>
                En pausa · {formatTime(timer.pauseTime)}
              </Text>
            </View>
          )}
        </View>

        {/* Side Buttons */}
        <View style={styles.sidesRow}>
          <TouchableOpacity
            style={[
              styles.sideButton,
              timer.activeSide === 'left' && timer.isRunning && styles.sideButtonActive,
              timer.activeSide === 'left' && !timer.isRunning && timer.leftTime > 0 && styles.sideButtonPaused,
            ]}
            onPress={() => timer.selectSide('left')}
            activeOpacity={0.7}
          >
            <Text style={styles.sideEmoji}>🤱</Text>
            <Text style={[
              styles.sideLabel,
              timer.activeSide === 'left' && timer.isRunning && styles.sideLabelActive,
            ]}>
              Izquierdo
            </Text>
            <Text style={[
              styles.sideTime,
              timer.activeSide === 'left' && timer.isRunning && styles.sideTimeActive,
            ]}>
              {formatTime(timer.leftTime)}
            </Text>
            {timer.activeSide === 'left' && timer.isRunning && (
              <View style={styles.activeDot} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.sideButton,
              timer.activeSide === 'right' && timer.isRunning && styles.sideButtonActive,
              timer.activeSide === 'right' && !timer.isRunning && timer.rightTime > 0 && styles.sideButtonPaused,
            ]}
            onPress={() => timer.selectSide('right')}
            activeOpacity={0.7}
          >
            <Text style={styles.sideEmoji}>🤱</Text>
            <Text style={[
              styles.sideLabel,
              timer.activeSide === 'right' && timer.isRunning && styles.sideLabelActive,
            ]}>
              Derecho
            </Text>
            <Text style={[
              styles.sideTime,
              timer.activeSide === 'right' && timer.isRunning && styles.sideTimeActive,
            ]}>
              {formatTime(timer.rightTime)}
            </Text>
            {timer.activeSide === 'right' && timer.isRunning && (
              <View style={styles.activeDot} />
            )}
          </TouchableOpacity>
        </View>

        {/* Controls */}
        <View style={styles.controlsRow}>
          {timer.totalTime > 0 && (
            <TouchableOpacity
              style={styles.controlBtn}
              onPress={timer.reset}
              activeOpacity={0.7}
            >
              <RotateCcw size={20} color={colors.slate[600]} />
              <Text style={styles.controlLabel}>Reiniciar</Text>
            </TouchableOpacity>
          )}

          {timer.activeSide && (
            <TouchableOpacity
              style={[styles.mainControlBtn, timer.isRunning ? styles.pauseBtn : styles.playBtn]}
              onPress={timer.pauseResume}
              activeOpacity={0.8}
            >
              {timer.isRunning ? (
                <Pause size={28} color={colors.white} />
              ) : (
                <Play size={28} color={colors.white} />
              )}
            </TouchableOpacity>
          )}

          {timer.totalTime > 0 && (
            <TouchableOpacity
              style={styles.finishBtn}
              onPress={handleFinish}
              activeOpacity={0.7}
            >
              <Text style={styles.finishBtnText}>Finalizar</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Instructions when idle */}
        {!timer.activeSide && timer.totalTime === 0 && todaySessions.length === 0 && (
          <View style={styles.instructions}>
            <Text style={styles.instructionTitle}>Como usar</Text>
            <Text style={styles.instructionText}>
              1. Selecciona "Izquierdo" o "Derecho" para iniciar{'\n'}
              2. Toca el otro lado para cambiar{'\n'}
              3. Presiona "Finalizar" al terminar
            </Text>
          </View>
        )}

        {/* Today's Sessions */}
        {todaySessions.length > 0 && (
          <View style={styles.todaySection}>
            <Text style={styles.todaySectionTitle}>Sesiones de hoy</Text>
            {todaySessions.map((session) => (
              <TouchableOpacity
                key={session.id}
                style={styles.todayCard}
                onPress={() => navigation.navigate('FeedingSessionDetail', { sessionId: session.id })}
                activeOpacity={0.7}
              >
                <View style={styles.todayCardLeft}>
                  <View style={styles.todayDot} />
                  <View style={styles.todayInfo}>
                    <Text style={styles.todayTimeRange}>
                      {formatSessionTime(session.startedAt)} - {formatSessionTime(session.endedAt)}
                    </Text>
                    <Text style={styles.todayDuration}>
                      {formatDuration(session.totalDuration)}
                    </Text>
                  </View>
                </View>
                <View style={styles.todayCardRight}>
                  <Text style={styles.todaySide}>
                    {session.lastSide === 'left' ? 'Izq' : session.lastSide === 'right' ? 'Der' : 'Ambos'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => handleDeleteSession(session)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Trash2 size={14} color={colors.slate[400]} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* History Link */}
        <TouchableOpacity
          style={styles.historyLink}
          onPress={() => navigation.navigate('FeedingHistory')}
          activeOpacity={0.7}
        >
          <Clock size={18} color={colors.primary[500]} />
          <Text style={styles.historyLinkText}>Ver historial completo</Text>
        </TouchableOpacity>
      </ScrollView>
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
  section: {
    marginBottom: spacing.lg,
  },
  timerSection: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  babyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  totalTime: {
    fontSize: 48,
    fontWeight: '200',
    color: colors.slate[800],
    fontVariant: ['tabular-nums'],
  },
  totalLabel: {
    ...typography.small,
    color: colors.slate[500],
  },
  pauseIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    backgroundColor: colors.warningLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
  },
  pauseText: {
    ...typography.caption,
    color: colors.warning,
    fontWeight: '600',
  },
  sidesRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xxl,
  },
  sideButton: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 2,
    borderColor: colors.slate[200],
    ...shadows.sm,
    position: 'relative',
    overflow: 'hidden',
  },
  sideButtonActive: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  sideButtonPaused: {
    borderColor: colors.warning,
    backgroundColor: colors.warningLight,
  },
  sideEmoji: {
    fontSize: 32,
  },
  sideLabel: {
    ...typography.bodyBold,
    color: colors.slate[700],
  },
  sideLabelActive: {
    color: colors.primary[700],
  },
  sideTime: {
    fontSize: 24,
    fontWeight: '300',
    color: colors.slate[600],
    fontVariant: ['tabular-nums'],
  },
  sideTimeActive: {
    color: colors.primary[600],
    fontWeight: '600',
  },
  activeDot: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary[500],
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    marginBottom: spacing.xxl,
  },
  controlBtn: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  controlLabel: {
    ...typography.caption,
    color: colors.slate[600],
  },
  mainControlBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  playBtn: {
    backgroundColor: colors.primary[500],
  },
  pauseBtn: {
    backgroundColor: colors.warning,
  },
  finishBtn: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
  },
  finishBtnText: {
    ...typography.button,
    color: colors.white,
  },
  instructions: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.xl,
    gap: spacing.md,
    ...shadows.sm,
  },
  instructionTitle: {
    ...typography.bodyBold,
    color: colors.slate[800],
  },
  instructionText: {
    ...typography.small,
    color: colors.slate[600],
    lineHeight: 24,
  },
  todaySection: {
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
  todayDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary[500],
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
  todayCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  todaySide: {
    ...typography.captionBold,
    color: colors.primary[500],
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
  },
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
    color: colors.primary[500],
  },
});
