import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft, Play, Pause, Volume2, VolumeX, Minus, Plus, Timer, X,
} from 'lucide-react-native';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { colors, spacing, typography, radii, shadows } from '../theme';

const soundColors = {
  main: '#d97706',
  light: '#fef3c7',
  medium: '#fde68a',
  dark: '#b45309',
  accent: '#fbbf24',
};

interface SoundItem {
  id: string;
  name: string;
  emoji: string;
  file: any;
}

const SOUNDS: SoundItem[] = [
  { id: 'white-noise', name: 'Ruido Blanco', emoji: '🌫️', file: require('../../assets/sounds/white-noise.m4a') },
  { id: 'white-noise2', name: 'Ruido Blanco II', emoji: '☁️', file: require('../../assets/sounds/white-noise2.m4a') },
  { id: 'pink-noise', name: 'Ruido Rosa', emoji: '🌸', file: require('../../assets/sounds/pink-noise.m4a') },
  { id: 'brown-noise', name: 'Ruido Café', emoji: '🍂', file: require('../../assets/sounds/brown-noise.m4a') },
  { id: 'soft-rain', name: 'Lluvia Suave', emoji: '🌧️', file: require('../../assets/sounds/soft-rain.m4a') },
  { id: 'ocean-waves', name: 'Olas del Mar', emoji: '🌊', file: require('../../assets/sounds/ocean-waves.m4a') },
  { id: 'fan-hum', name: 'Ventilador', emoji: '🌀', file: require('../../assets/sounds/fan-hum.m4a') },
  { id: 'heart-beat', name: 'Latido de Corazón', emoji: '💓', file: require('../../assets/sounds/heart-beat.m4a') },
  { id: 'slow-piano', name: 'Piano Suave', emoji: '🎹', file: require('../../assets/sounds/slow-piano.m4a') },
  { id: 'harp-acoustic', name: 'Arpa Acústica', emoji: '🎵', file: require('../../assets/sounds/harp-acoustic.m4a') },
  { id: 'vintage-music-box', name: 'Caja de Música', emoji: '🎶', file: require('../../assets/sounds/vintage-music-box.m4a') },
  { id: 'soft-rain2', name: 'Ventilador + Lluvia', emoji: '🌬️', file: require('../../assets/sounds/soft-rain.m4a') },
];

const TIMER_OPTIONS = [
  { label: 'Sin límite', minutes: 0 },
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '45 min', minutes: 45 },
  { label: '60 min', minutes: 60 },
];

// Crossfade config
const CROSSFADE_MS = 300; // overlap duration in ms
const FADE_STEPS = 15;    // number of volume steps during fade
const FADE_INTERVAL = CROSSFADE_MS / FADE_STEPS;
const POLL_INTERVAL = 100; // how often to check position (ms)

export default function RelaxingSoundsScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [currentSoundId, setCurrentSoundId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [timerMinutes, setTimerMinutes] = useState(0);
  const [timerRemaining, setTimerRemaining] = useState<number | null>(null);
  const [showTimer, setShowTimer] = useState(false);

  // Double-buffer refs for crossfade looping
  const soundA = useRef<Audio.Sound | null>(null);
  const soundB = useRef<Audio.Sound | null>(null);
  const activeBuffer = useRef<'A' | 'B'>('A');
  const currentFileRef = useRef<any>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const crossfadingRef = useRef(false);
  const stoppedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const volumeRef = useRef(0.8);
  const mutedRef = useRef(false);

  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
    });

    return () => {
      stopSound();
      clearTimerInterval();
    };
  }, []);

  const getEffectiveVolume = () => mutedRef.current ? 0 : volumeRef.current;

  const clearPollInterval = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const clearTimerInterval = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const unloadSound = async (ref: React.MutableRefObject<Audio.Sound | null>) => {
    if (ref.current) {
      try {
        await ref.current.stopAsync();
        await ref.current.unloadAsync();
      } catch (_) {}
      ref.current = null;
    }
  };

  const stopSound = async () => {
    stoppedRef.current = true;
    clearPollInterval();
    crossfadingRef.current = false;
    await Promise.all([unloadSound(soundA), unloadSound(soundB)]);
    currentFileRef.current = null;
    setIsPlaying(false);
    setCurrentSoundId(null);
    clearTimerInterval();
    setTimerRemaining(null);
  };

  // Fade volume from startVol to endVol on a Sound instance
  const fadeVolume = (sound: Audio.Sound, startVol: number, endVol: number) => {
    let step = 0;
    const delta = (endVol - startVol) / FADE_STEPS;
    const interval = setInterval(async () => {
      step++;
      const vol = startVol + delta * step;
      try { await sound.setVolumeAsync(Math.max(0, Math.min(1, vol))); } catch (_) {}
      if (step >= FADE_STEPS) clearInterval(interval);
    }, FADE_INTERVAL);
  };

  // Create and start a new Sound instance
  const createBuffer = async (file: any, vol: number): Promise<Audio.Sound> => {
    const { sound } = await Audio.Sound.createAsync(file, {
      shouldPlay: true,
      isLooping: false,
      volume: vol,
    });
    return sound;
  };

  // Perform crossfade: fade out current buffer, start next buffer with fade in
  const doCrossfade = async () => {
    if (crossfadingRef.current || stoppedRef.current) return;
    crossfadingRef.current = true;

    const file = currentFileRef.current;
    if (!file) { crossfadingRef.current = false; return; }

    const outgoing = activeBuffer.current === 'A' ? soundA : soundB;
    const incoming = activeBuffer.current === 'A' ? soundB : soundA;
    const nextLabel: 'A' | 'B' = activeBuffer.current === 'A' ? 'B' : 'A';

    const effectiveVol = getEffectiveVolume();

    try {
      // Start the incoming buffer at volume 0, then fade in
      const newSound = await createBuffer(file, 0);
      incoming.current = newSound;

      // Fade out the old, fade in the new simultaneously
      if (outgoing.current) {
        fadeVolume(outgoing.current, effectiveVol, 0);
      }
      fadeVolume(newSound, 0, effectiveVol);

      // After crossfade completes, clean up old buffer
      setTimeout(async () => {
        await unloadSound(outgoing);
        activeBuffer.current = nextLabel;
        crossfadingRef.current = false;
      }, CROSSFADE_MS + 50);
    } catch (_) {
      crossfadingRef.current = false;
    }
  };

  // Poll the active sound's position to trigger crossfade near the end
  const startPolling = () => {
    clearPollInterval();
    pollRef.current = setInterval(async () => {
      if (stoppedRef.current || crossfadingRef.current) return;
      const active = activeBuffer.current === 'A' ? soundA.current : soundB.current;
      if (!active) return;

      try {
        const status = await active.getStatusAsync();
        if (!status.isLoaded) return;
        const { positionMillis, durationMillis } = status;
        if (durationMillis && positionMillis >= durationMillis - CROSSFADE_MS - POLL_INTERVAL) {
          doCrossfade();
        }
      } catch (_) {}
    }, POLL_INTERVAL);
  };

  const playSound = async (item: SoundItem) => {
    // If same sound is playing, toggle pause/play
    if (currentSoundId === item.id) {
      const active = activeBuffer.current === 'A' ? soundA.current : soundB.current;
      if (active) {
        if (isPlaying) {
          await active.pauseAsync();
          clearPollInterval();
          setIsPlaying(false);
        } else {
          stoppedRef.current = false;
          await active.playAsync();
          startPolling();
          setIsPlaying(true);
        }
        return;
      }
    }

    // Stop everything and start fresh
    stoppedRef.current = true;
    clearPollInterval();
    crossfadingRef.current = false;
    await Promise.all([unloadSound(soundA), unloadSound(soundB)]);

    stoppedRef.current = false;
    currentFileRef.current = item.file;
    activeBuffer.current = 'A';

    const effectiveVol = getEffectiveVolume();
    soundA.current = await createBuffer(item.file, effectiveVol);

    setCurrentSoundId(item.id);
    setIsPlaying(true);
    startPolling();

    // Start timer if configured
    if (timerMinutes > 0) {
      startTimer(timerMinutes);
    }
  };

  const startTimer = (minutes: number) => {
    clearTimerInterval();
    const totalSeconds = minutes * 60;
    setTimerRemaining(totalSeconds);

    timerRef.current = setInterval(() => {
      setTimerRemaining((prev) => {
        if (prev === null || prev <= 1) {
          stopSound();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const adjustVolume = async (delta: number) => {
    const newVol = Math.max(0, Math.min(1, volume + delta));
    setVolume(newVol);
    volumeRef.current = newVol;
    setIsMuted(false);
    mutedRef.current = false;
    const active = activeBuffer.current === 'A' ? soundA.current : soundB.current;
    if (active) {
      try { await active.setVolumeAsync(newVol); } catch (_) {}
    }
  };

  const toggleMute = async () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    mutedRef.current = newMuted;
    const active = activeBuffer.current === 'A' ? soundA.current : soundB.current;
    if (active) {
      try { await active.setVolumeAsync(newMuted ? 0 : volume); } catch (_) {}
    }
  };

  const selectTimer = (minutes: number) => {
    setTimerMinutes(minutes);
    setShowTimer(false);
    if (minutes === 0) {
      clearTimerInterval();
      setTimerRemaining(null);
    } else if (isPlaying) {
      startTimer(minutes);
    }
  };

  const formatTimerDisplay = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const currentSound = SOUNDS.find((s) => s.id === currentSoundId);

  const renderSoundCard = ({ item }: { item: SoundItem }) => {
    const isActive = currentSoundId === item.id;
    const isCurrentPlaying = isActive && isPlaying;

    return (
      <TouchableOpacity
        style={[styles.soundCard, isActive && styles.soundCardActive]}
        onPress={() => playSound(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.soundEmoji, isActive && styles.soundEmojiActive]}>
          <Text style={styles.emojiText}>{item.emoji}</Text>
        </View>
        <Text
          style={[styles.soundName, isActive && styles.soundNameActive]}
          numberOfLines={2}
        >
          {item.name}
        </Text>
        {isCurrentPlaying && (
          <View style={styles.playingIndicator}>
            <View style={[styles.bar, styles.bar1]} />
            <View style={[styles.bar, styles.bar2]} />
            <View style={[styles.bar, styles.bar3]} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            stopSound();
            navigation.goBack();
          }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ArrowLeft size={24} color={colors.slate[800]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sonidos Relajantes</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Subtitle */}
      <View style={styles.subtitleContainer}>
        <Text style={styles.subtitle}>
          Selecciona un sonido para acompañar la lactancia o el descanso de tu bebé.
        </Text>
      </View>

      {/* Sound Grid */}
      <FlatList
        data={SOUNDS}
        renderItem={renderSoundCard}
        keyExtractor={(item) => item.id}
        numColumns={3}
        contentContainerStyle={styles.gridContent}
        columnWrapperStyle={styles.gridRow}
        showsVerticalScrollIndicator={false}
      />

      {/* Timer Selector Overlay */}
      {showTimer && (
        <View style={styles.timerOverlay}>
          <View style={styles.timerPanel}>
            <View style={styles.timerHeader}>
              <Text style={styles.timerTitle}>Apagar en...</Text>
              <TouchableOpacity onPress={() => setShowTimer(false)}>
                <X size={20} color={colors.slate[500]} />
              </TouchableOpacity>
            </View>
            {TIMER_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.minutes}
                style={[
                  styles.timerOption,
                  timerMinutes === opt.minutes && styles.timerOptionActive,
                ]}
                onPress={() => selectTimer(opt.minutes)}
              >
                <Text
                  style={[
                    styles.timerOptionText,
                    timerMinutes === opt.minutes && styles.timerOptionTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Player Bar */}
      {currentSoundId && (
        <View style={[styles.playerBar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          {/* Timer remaining */}
          {timerRemaining !== null && (
            <View style={styles.timerRemainingRow}>
              <Timer size={12} color={soundColors.main} />
              <Text style={styles.timerRemainingText}>
                Se apagará en {formatTimerDisplay(timerRemaining)}
              </Text>
            </View>
          )}

          <View style={styles.playerControls}>
            {/* Sound info */}
            <View style={styles.playerInfo}>
              <Text style={styles.playerEmoji}>{currentSound?.emoji}</Text>
              <Text style={styles.playerName} numberOfLines={1}>
                {currentSound?.name}
              </Text>
            </View>

            {/* Controls */}
            <View style={styles.playerButtons}>
              {/* Timer */}
              <TouchableOpacity
                onPress={() => setShowTimer(!showTimer)}
                style={styles.controlButton}
              >
                <Timer
                  size={20}
                  color={timerMinutes > 0 ? soundColors.main : colors.slate[400]}
                />
              </TouchableOpacity>

              {/* Volume down */}
              <TouchableOpacity
                onPress={() => adjustVolume(-0.2)}
                style={styles.controlButton}
              >
                <Minus size={18} color={colors.slate[400]} />
              </TouchableOpacity>

              {/* Volume indicator */}
              <TouchableOpacity onPress={toggleMute} style={styles.controlButton}>
                {isMuted || volume === 0 ? (
                  <VolumeX size={20} color={colors.slate[300]} />
                ) : (
                  <Volume2 size={20} color={soundColors.main} />
                )}
              </TouchableOpacity>

              {/* Volume up */}
              <TouchableOpacity
                onPress={() => adjustVolume(0.2)}
                style={styles.controlButton}
              >
                <Plus size={18} color={colors.slate[400]} />
              </TouchableOpacity>

              {/* Play/Pause */}
              <TouchableOpacity
                onPress={() => playSound(currentSound!)}
                style={styles.playButton}
              >
                {isPlaying ? (
                  <Pause size={22} color={colors.white} />
                ) : (
                  <Play size={22} color={colors.white} />
                )}
              </TouchableOpacity>

              {/* Stop */}
              <TouchableOpacity onPress={stopSound} style={styles.controlButton}>
                <X size={20} color={colors.slate[400]} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Volume bar */}
          <View style={styles.volumeBarContainer}>
            <View style={styles.volumeBarBg}>
              <View
                style={[
                  styles.volumeBarFill,
                  { width: `${(isMuted ? 0 : volume) * 100}%` },
                ]}
              />
            </View>
          </View>
        </View>
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
  subtitleContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  subtitle: {
    ...typography.small,
    color: colors.slate[500],
    lineHeight: 22,
  },
  gridContent: {
    padding: spacing.md,
    paddingBottom: 180,
  },
  gridRow: {
    justifyContent: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  soundCard: {
    flex: 1,
    maxWidth: '31%',
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
    ...shadows.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  soundCardActive: {
    borderColor: soundColors.main,
    backgroundColor: soundColors.light,
  },
  soundEmoji: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.slate[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  soundEmojiActive: {
    backgroundColor: soundColors.medium,
  },
  emojiText: {
    fontSize: 24,
  },
  soundName: {
    ...typography.caption,
    color: colors.slate[600],
    textAlign: 'center',
    fontWeight: '500',
  },
  soundNameActive: {
    color: soundColors.dark,
    fontWeight: '600',
  },
  playingIndicator: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 14,
  },
  bar: {
    width: 3,
    borderRadius: 1.5,
    backgroundColor: soundColors.main,
  },
  bar1: { height: 8 },
  bar2: { height: 14 },
  bar3: { height: 10 },
  // Player bar
  playerBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    ...shadows.lg,
  },
  timerRemainingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  timerRemainingText: {
    ...typography.caption,
    color: soundColors.main,
    fontWeight: '500',
  },
  playerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  playerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  playerEmoji: {
    fontSize: 20,
  },
  playerName: {
    ...typography.smallBold,
    color: colors.slate[800],
    flex: 1,
  },
  playerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  controlButton: {
    padding: spacing.sm,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: soundColors.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
  volumeBarContainer: {
    paddingVertical: spacing.sm,
  },
  volumeBarBg: {
    height: 4,
    backgroundColor: colors.slate[100],
    borderRadius: 2,
    overflow: 'hidden',
  },
  volumeBarFill: {
    height: '100%',
    backgroundColor: soundColors.main,
    borderRadius: 2,
  },
  // Timer overlay
  timerOverlay: {
    position: 'absolute',
    bottom: 120,
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 10,
  },
  timerPanel: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.lg,
    ...shadows.lg,
  },
  timerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  timerTitle: {
    ...typography.bodyBold,
    color: colors.slate[800],
  },
  timerOption: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    marginBottom: spacing.xs,
  },
  timerOptionActive: {
    backgroundColor: soundColors.light,
  },
  timerOptionText: {
    ...typography.body,
    color: colors.slate[600],
  },
  timerOptionTextActive: {
    color: soundColors.dark,
    fontWeight: '600',
  },
});
