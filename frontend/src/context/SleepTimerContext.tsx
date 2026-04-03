import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { pushActiveTimer, clearActiveTimer } from '../services/api';
import { useSocket } from './SocketContext';

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
  elapsedTime: number;
  pauseTime: number;
  sessionStartedAt: Date | null;
  babyId: string | null;
  babyName: string | null;
  start: () => void;
  pause: () => void;
  resume: () => void;
  finish: () => { startedAt: string; endedAt: string; totalDuration: number; totalPauseTime: number } | null;
  reset: () => void;
  setBaby: (id: string | null, name: string | null) => void;
  loadFromRemote: (remote: { startedAt: string; pausedAt: string | null; totalPausedMs: number; babyId: string | null; babyName: string | null }) => void;
}

const SleepTimerContext = createContext<SleepTimerContextValue | null>(null);

export function useSleepTimerContext(): SleepTimerContextValue {
  const ctx = useContext(SleepTimerContext);
  if (!ctx) throw new Error('useSleepTimerContext must be used inside SleepTimerProvider');
  return ctx;
}

export function SleepTimerProvider({ children }: { children: React.ReactNode }) {
  const { socket } = useSocket();
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [pauseTime, setPauseTime] = useState(0);
  const [sessionStartedAt, setSessionStartedAt] = useState<Date | null>(null);
  const [babyId, setBabyIdState] = useState<string | null>(null);
  const [babyName, setBabyNameState] = useState<string | null>(null);

  const startedAtMsRef = useRef<number | null>(null);
  const totalPausedMsRef = useRef<number>(0);
  const pausedAtMsRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pauseIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wasPausedRef = useRef(false);

  const babyIdRef = useRef<string | null>(null);
  const babyNameRef = useRef<string | null>(null);
  const isRunningRef = useRef(false);
  babyIdRef.current = babyId;
  babyNameRef.current = babyName;
  isRunningRef.current = isRunning;

  const persistLocal = useCallback(async (data: PersistedTimer | null) => {
    try {
      if (data) {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } else {
        await AsyncStorage.removeItem(STORAGE_KEY);
      }
    } catch (_) {}
  }, []);

  const syncServer = useCallback((overrides?: { pausedAt?: number | null; totalPausedMs?: number }) => {
    if (!startedAtMsRef.current) return;
    pushActiveTimer({
      type: 'sleep',
      startedAt: new Date(startedAtMsRef.current).toISOString(),
      pausedAt: overrides?.pausedAt !== undefined
        ? (overrides.pausedAt ? new Date(overrides.pausedAt).toISOString() : null)
        : (pausedAtMsRef.current ? new Date(pausedAtMsRef.current).toISOString() : null),
      totalPausedMs: overrides?.totalPausedMs ?? totalPausedMsRef.current,
      babyId: babyIdRef.current,
      babyName: babyNameRef.current,
    }).catch(() => {});
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
        babyIdRef.current = saved.babyId;
        babyNameRef.current = saved.babyName;

        if (saved.isRunning) {
          const elapsedMs = (now - saved.startedAtMs) - saved.totalPausedMs;
          setElapsedTime(Math.max(0, Math.floor(elapsedMs / 1000)));
          setIsRunning(true);
          wasPausedRef.current = false;
        } else if (saved.pausedAtMs) {
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
    const snap: PersistedTimer = {
      startedAtMs: startedAtMsRef.current!,
      isRunning: true,
      totalPausedMs: totalPausedMsRef.current,
      pausedAtMs: null,
      babyId: babyIdRef.current,
      babyName: babyNameRef.current,
    };
    persistLocal(snap);
    syncServer({ pausedAt: null, totalPausedMs: totalPausedMsRef.current });
  }, [persistLocal, syncServer]);

  const pause = useCallback(() => {
    if (!isRunningRef.current) return;
    const now = Date.now();
    pausedAtMsRef.current = now;
    wasPausedRef.current = true;
    setIsRunning(false);
    const snap: PersistedTimer = {
      startedAtMs: startedAtMsRef.current!,
      isRunning: false,
      totalPausedMs: totalPausedMsRef.current,
      pausedAtMs: now,
      babyId: babyIdRef.current,
      babyName: babyNameRef.current,
    };
    persistLocal(snap);
    syncServer({ pausedAt: now, totalPausedMs: totalPausedMsRef.current });
  }, [persistLocal, syncServer]);

  const resume = useCallback(() => {
    if (isRunningRef.current || !wasPausedRef.current) return;
    const now = Date.now();
    if (pausedAtMsRef.current) {
      totalPausedMsRef.current += now - pausedAtMsRef.current;
    }
    pausedAtMsRef.current = null;
    wasPausedRef.current = false;
    setIsRunning(true);
    const snap: PersistedTimer = {
      startedAtMs: startedAtMsRef.current!,
      isRunning: true,
      totalPausedMs: totalPausedMsRef.current,
      pausedAtMs: null,
      babyId: babyIdRef.current,
      babyName: babyNameRef.current,
    };
    persistLocal(snap);
    syncServer({ pausedAt: null, totalPausedMs: totalPausedMsRef.current });
  }, [persistLocal, syncServer]);

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
    persistLocal(null);
    clearActiveTimer('sleep').catch(() => {});
    return result;
  }, [elapsedTime, pauseTime, sessionStartedAt, persistLocal]);

  const reset = useCallback(() => {
    setIsRunning(false);
    setElapsedTime(0);
    setPauseTime(0);
    setSessionStartedAt(null);
    startedAtMsRef.current = null;
    totalPausedMsRef.current = 0;
    pausedAtMsRef.current = null;
    wasPausedRef.current = false;
    persistLocal(null);
    clearActiveTimer('sleep').catch(() => {});
  }, [persistLocal]);

  const setBaby = useCallback((id: string | null, name: string | null) => {
    setBabyIdState(id);
    setBabyNameState(name);
    babyIdRef.current = id;
    babyNameRef.current = name;
    if (startedAtMsRef.current) {
      persistLocal({
        startedAtMs: startedAtMsRef.current,
        isRunning: isRunningRef.current,
        totalPausedMs: totalPausedMsRef.current,
        pausedAtMs: pausedAtMsRef.current,
        babyId: id,
        babyName: name,
      });
      syncServer({});
    }
  }, [persistLocal, syncServer]);

  const loadFromRemote = useCallback((remote: {
    startedAt: string;
    pausedAt: string | null;
    totalPausedMs: number;
    babyId: string | null;
    babyName: string | null;
  }) => {
    const now = Date.now();
    const startMs = new Date(remote.startedAt).getTime();
    startedAtMsRef.current = startMs;
    totalPausedMsRef.current = remote.totalPausedMs;
    setSessionStartedAt(new Date(startMs));
    setBabyIdState(remote.babyId);
    setBabyNameState(remote.babyName);
    babyIdRef.current = remote.babyId;
    babyNameRef.current = remote.babyName;

    if (remote.pausedAt) {
      const pausedMs = new Date(remote.pausedAt).getTime();
      pausedAtMsRef.current = pausedMs;
      const elapsed = (pausedMs - startMs) - remote.totalPausedMs;
      setElapsedTime(Math.max(0, Math.floor(elapsed / 1000)));
      wasPausedRef.current = true;
      setIsRunning(false);
    } else {
      pausedAtMsRef.current = null;
      const elapsed = (now - startMs) - remote.totalPausedMs;
      setElapsedTime(Math.max(0, Math.floor(elapsed / 1000)));
      wasPausedRef.current = false;
      setIsRunning(true);
    }

    persistLocal({
      startedAtMs: startMs,
      isRunning: !remote.pausedAt,
      totalPausedMs: remote.totalPausedMs,
      pausedAtMs: remote.pausedAt ? new Date(remote.pausedAt).getTime() : null,
      babyId: remote.babyId,
      babyName: remote.babyName,
    });
  }, [persistLocal]);

  // Listen for partner socket events that affect this user's sleep timer
  useEffect(() => {
    if (!socket) return;

    const handleUpdated = (data: any) => {
      if (data.type !== 'sleep') return;
      loadFromRemote({
        startedAt: data.startedAt,
        pausedAt: data.pausedAt ?? null,
        totalPausedMs: data.totalPausedMs ?? 0,
        babyId: data.babyId ?? null,
        babyName: data.babyName ?? null,
      });
    };

    const handleCleared = (data: any) => {
      if (data.type !== 'sleep') return;
      reset();
    };

    socket.on('timer:updated', handleUpdated);
    socket.on('timer:cleared', handleCleared);
    return () => {
      socket.off('timer:updated', handleUpdated);
      socket.off('timer:cleared', handleCleared);
    };
  }, [socket, loadFromRemote, reset]);

  const hasStarted = sessionStartedAt !== null;
  const isPaused = !isRunning && hasStarted && elapsedTime > 0;

  return (
    <SleepTimerContext.Provider value={{
      isRunning, hasStarted, isPaused, elapsedTime, pauseTime,
      sessionStartedAt, babyId, babyName,
      start, pause, resume, finish, reset, setBaby, loadFromRemote,
    }}>
      {children}
    </SleepTimerContext.Provider>
  );
}
