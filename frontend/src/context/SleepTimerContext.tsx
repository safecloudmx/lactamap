import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'sleep_timer_active';

interface PersistedTimer {
  startedAtMs: number;
  isRunning: boolean;
  totalPausedMs: number;
  pausedAtMs: number | null;
  babyId: string | null;
  babyName: string | null;
}

export interface SleepTimerContextValue {
  isRunning: boolean;
  hasStarted: boolean;
  isPaused: boolean;
  elapsedTime: number;   // seconds
  pauseTime: number;     // seconds
  sessionStartedAt: Date | null;
  babyId: string | null;
  babyName: string | null;
  start: () => void;
  pause: () => void;
  resume: () => void;
  finish: () => { startedAt: string; endedAt: string; totalDuration: number; totalPauseTime: number } | null;
  reset: () => void;
  setBaby: (id: string | null, name: string | null) => void;
}

const SleepTimerContext = createContext<SleepTimerContextValue | null>(null);

export function useSleepTimerContext(): SleepTimerContextValue {
  const ctx = useContext(SleepTimerContext);
  if (!ctx) throw new Error('useSleepTimerContext must be used inside SleepTimerProvider');
  return ctx;
}

export function SleepTimerProvider({ children }: { children: React.ReactNode }) {
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [pauseTime, setPauseTime] = useState(0);
  const [sessionStartedAt, setSessionStartedAt] = useState<Date | null>(null);
  const [babyId, setBabyIdState] = useState<string | null>(null);
  const [babyName, setBabyNameState] = useState<string | null>(null);

  // Internal refs for persistence calculations
  const startedAtMsRef = useRef<number | null>(null);
  const totalPausedMsRef = useRef<number>(0);
  const pausedAtMsRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pauseIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wasPausedRef = useRef(false);

  const persist = useCallback(async (data: PersistedTimer | null) => {
    try {
      if (data) {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } else {
        await AsyncStorage.removeItem(STORAGE_KEY);
      }
    } catch (_) {}
  }, []);

  // Restore from AsyncStorage on mount
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const saved: PersistedTimer = JSON.parse(raw);
        const now = Date.now();

        startedAtMsRef.current = saved.startedAtMs;
        totalPausedMsRef.current = saved.totalPausedMs;
        pausedAtMsRef.current = saved.pausedAtMs;
        setSessionStartedAt(new Date(saved.startedAtMs));
        setBabyIdState(saved.babyId);
        setBabyNameState(saved.babyName);

        if (saved.isRunning) {
          const elapsedMs = (now - saved.startedAtMs) - saved.totalPausedMs;
          setElapsedTime(Math.max(0, Math.floor(elapsedMs / 1000)));
          setIsRunning(true);
          wasPausedRef.current = false;
        } else if (saved.pausedAtMs) {
          // Was paused: calculate elapsed up to when it was paused
          const elapsedMs = (saved.pausedAtMs - saved.startedAtMs) - saved.totalPausedMs;
          setElapsedTime(Math.max(0, Math.floor(elapsedMs / 1000)));
          wasPausedRef.current = true;
          setIsRunning(false);
        }
      } catch (_) {}
    })();
  }, []);

  // Running interval
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => setElapsedTime((t) => t + 1), 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning]);

  // Paused interval
  useEffect(() => {
    if (!isRunning && wasPausedRef.current) {
      pauseIntervalRef.current = setInterval(() => setPauseTime((t) => t + 1), 1000);
    }
    return () => { if (pauseIntervalRef.current) clearInterval(pauseIntervalRef.current); };
  }, [isRunning]);

  const start = useCallback(() => {
    const now = Date.now();
    if (!startedAtMsRef.current) {
      startedAtMsRef.current = now;
      setSessionStartedAt(new Date(now));
    }
    wasPausedRef.current = false;
    setIsRunning(true);
    persist({
      startedAtMs: startedAtMsRef.current!,
      isRunning: true,
      totalPausedMs: totalPausedMsRef.current,
      pausedAtMs: null,
      babyId,
      babyName,
    });
  }, [babyId, babyName, persist]);

  const pause = useCallback(() => {
    if (!isRunning) return;
    const now = Date.now();
    pausedAtMsRef.current = now;
    wasPausedRef.current = true;
    setIsRunning(false);
    persist({
      startedAtMs: startedAtMsRef.current!,
      isRunning: false,
      totalPausedMs: totalPausedMsRef.current,
      pausedAtMs: now,
      babyId,
      babyName,
    });
  }, [isRunning, babyId, babyName, persist]);

  const resume = useCallback(() => {
    if (isRunning || !wasPausedRef.current) return;
    const now = Date.now();
    if (pausedAtMsRef.current) {
      totalPausedMsRef.current += now - pausedAtMsRef.current;
    }
    pausedAtMsRef.current = null;
    wasPausedRef.current = false;
    setIsRunning(true);
    persist({
      startedAtMs: startedAtMsRef.current!,
      isRunning: true,
      totalPausedMs: totalPausedMsRef.current,
      pausedAtMs: null,
      babyId,
      babyName,
    });
  }, [isRunning, babyId, babyName, persist]);

  const finish = useCallback(() => {
    if (elapsedTime === 0) return null;
    const now = new Date();
    const startedAt = sessionStartedAt ?? now;
    const result = {
      startedAt: startedAt.toISOString(),
      endedAt: now.toISOString(),
      totalDuration: elapsedTime,
      totalPauseTime: pauseTime,
    };
    setIsRunning(false);
    setElapsedTime(0);
    setPauseTime(0);
    setSessionStartedAt(null);
    startedAtMsRef.current = null;
    totalPausedMsRef.current = 0;
    pausedAtMsRef.current = null;
    wasPausedRef.current = false;
    persist(null);
    return result;
  }, [elapsedTime, pauseTime, sessionStartedAt, persist]);

  const reset = useCallback(() => {
    setIsRunning(false);
    setElapsedTime(0);
    setPauseTime(0);
    setSessionStartedAt(null);
    startedAtMsRef.current = null;
    totalPausedMsRef.current = 0;
    pausedAtMsRef.current = null;
    wasPausedRef.current = false;
    persist(null);
  }, [persist]);

  const setBaby = useCallback((id: string | null, name: string | null) => {
    setBabyIdState(id);
    setBabyNameState(name);
    if (startedAtMsRef.current) {
      persist({
        startedAtMs: startedAtMsRef.current,
        isRunning,
        totalPausedMs: totalPausedMsRef.current,
        pausedAtMs: pausedAtMsRef.current,
        babyId: id,
        babyName: name,
      });
    }
  }, [isRunning, persist]);

  const hasStarted = sessionStartedAt !== null;
  const isPaused = !isRunning && hasStarted && elapsedTime > 0;

  return (
    <SleepTimerContext.Provider value={{
      isRunning, hasStarted, isPaused, elapsedTime, pauseTime,
      sessionStartedAt, babyId, babyName,
      start, pause, resume, finish, reset, setBaby,
    }}>
      {children}
    </SleepTimerContext.Provider>
  );
}
