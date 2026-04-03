import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FeedingSide } from '../types';
import { pushActiveTimer, clearActiveTimer } from '../services/api';

const STORAGE_KEY = 'nursing_timer_active';

type Side = 'left' | 'right' | null;

interface PersistedTimer {
  startedAtMs: number;
  leftMs: number;
  rightMs: number;
  pauseMs: number;
  activeSide: Side;
  isRunning: boolean;
  lastSideStartMs: number | null;
  pausedAtMs: number | null;
  babyId: string | null;
  babyName: string | null;
}

export interface NursingTimerContextValue {
  activeSide: Side;
  isRunning: boolean;
  isPaused: boolean;
  leftTime: number;
  rightTime: number;
  totalTime: number;
  pauseTime: number;
  sessionStartedAt: Date | null;
  babyId: string | null;
  babyName: string | null;
  selectSide: (side: 'left' | 'right') => void;
  pauseResume: () => void;
  finish: () => { startedAt: string; endedAt: string; leftDuration: number; rightDuration: number; totalDuration: number; totalPauseTime: number; lastSide: FeedingSide } | null;
  reset: () => void;
  setBaby: (id: string | null, name: string | null) => void;
  // Called by partner's stop action — load partner state into own timer
  loadFromRemote: (remote: { startedAt: string; leftMs: number; rightMs: number; activeSide: Side; pausedAt: string | null; totalPausedMs: number; babyId: string | null; babyName: string | null }) => void;
}

const NursingTimerContext = createContext<NursingTimerContextValue | null>(null);

export function useNursingTimerContext(): NursingTimerContextValue {
  const ctx = useContext(NursingTimerContext);
  if (!ctx) throw new Error('useNursingTimerContext must be used inside NursingTimerProvider');
  return ctx;
}

export function NursingTimerProvider({ children }: { children: React.ReactNode }) {
  const [activeSide, setActiveSide] = useState<Side>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [leftTime, setLeftTime] = useState(0);
  const [rightTime, setRightTime] = useState(0);
  const [pauseTime, setPauseTime] = useState(0);
  const [sessionStartedAt, setSessionStartedAt] = useState<Date | null>(null);
  const [babyId, setBabyIdState] = useState<string | null>(null);
  const [babyName, setBabyNameState] = useState<string | null>(null);

  const startedAtMsRef = useRef<number | null>(null);
  const leftMsRef = useRef<number>(0);
  const rightMsRef = useRef<number>(0);
  const pauseMsRef = useRef<number>(0);
  const lastSideStartMsRef = useRef<number | null>(null);
  const pausedAtMsRef = useRef<number | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pauseIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeSideRef = useRef<Side>(null);
  const isRunningRef = useRef(false);
  const babyIdRef = useRef<string | null>(null);
  const babyNameRef = useRef<string | null>(null);

  activeSideRef.current = activeSide;
  isRunningRef.current = isRunning;
  babyIdRef.current = babyId;
  babyNameRef.current = babyName;

  const persistLocal = useCallback(async (data: PersistedTimer | null) => {
    try {
      if (data) {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } else {
        await AsyncStorage.removeItem(STORAGE_KEY);
      }
    } catch (_) {}
  }, []);

  const buildLocalPersist = useCallback((): PersistedTimer => ({
    startedAtMs: startedAtMsRef.current!,
    leftMs: leftMsRef.current,
    rightMs: rightMsRef.current,
    pauseMs: pauseMsRef.current,
    activeSide: activeSideRef.current,
    isRunning: isRunningRef.current,
    lastSideStartMs: lastSideStartMsRef.current,
    pausedAtMs: pausedAtMsRef.current,
    babyId: babyIdRef.current,
    babyName: babyNameRef.current,
  }), []);

  // Push event state to server (fire-and-forget)
  const syncServer = useCallback((overrides?: Partial<{
    activeSide: Side; pausedAt: number | null; totalPausedMs: number;
    leftMs: number; rightMs: number;
  }>) => {
    if (!startedAtMsRef.current) return;
    pushActiveTimer({
      type: 'nursing',
      startedAt: new Date(startedAtMsRef.current).toISOString(),
      leftMs: overrides?.leftMs ?? leftMsRef.current,
      rightMs: overrides?.rightMs ?? rightMsRef.current,
      activeSide: overrides?.activeSide !== undefined ? overrides.activeSide : activeSideRef.current,
      pausedAt: overrides?.pausedAt !== undefined
        ? (overrides.pausedAt ? new Date(overrides.pausedAt).toISOString() : null)
        : (pausedAtMsRef.current ? new Date(pausedAtMsRef.current).toISOString() : null),
      totalPausedMs: overrides?.totalPausedMs ?? pauseMsRef.current,
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
        pauseMsRef.current = saved.pauseMs;
        pausedAtMsRef.current = saved.pausedAtMs;
        setSessionStartedAt(new Date(saved.startedAtMs));
        setBabyIdState(saved.babyId);
        setBabyNameState(saved.babyName);
        babyIdRef.current = saved.babyId;
        babyNameRef.current = saved.babyName;

        if (saved.isRunning && saved.lastSideStartMs && saved.activeSide) {
          const addedMs = now - saved.lastSideStartMs;
          if (saved.activeSide === 'left') {
            leftMsRef.current = saved.leftMs + addedMs;
            rightMsRef.current = saved.rightMs;
          } else {
            rightMsRef.current = saved.rightMs + addedMs;
            leftMsRef.current = saved.leftMs;
          }
          lastSideStartMsRef.current = now;
          setLeftTime(Math.floor(leftMsRef.current / 1000));
          setRightTime(Math.floor(rightMsRef.current / 1000));
          setPauseTime(Math.floor(saved.pauseMs / 1000));
          setActiveSide(saved.activeSide);
          setIsRunning(true);
        } else {
          leftMsRef.current = saved.leftMs;
          rightMsRef.current = saved.rightMs;
          setLeftTime(Math.floor(saved.leftMs / 1000));
          setRightTime(Math.floor(saved.rightMs / 1000));
          setPauseTime(Math.floor(saved.pauseMs / 1000));
          setActiveSide(saved.activeSide);
          setIsRunning(false);
        }
      } catch (_) {}
    })();
  }, []);

  // Running tick
  useEffect(() => {
    if (isRunning && activeSide) {
      intervalRef.current = setInterval(() => {
        if (activeSide === 'left') {
          leftMsRef.current += 1000;
          setLeftTime((t) => t + 1);
        } else {
          rightMsRef.current += 1000;
          setRightTime((t) => t + 1);
        }
      }, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning, activeSide]);

  // Pause tick
  useEffect(() => {
    if (!isRunning && pausedAtMsRef.current) {
      pauseIntervalRef.current = setInterval(() => {
        pauseMsRef.current += 1000;
        setPauseTime((t) => t + 1);
      }, 1000);
    }
    return () => { if (pauseIntervalRef.current) clearInterval(pauseIntervalRef.current); };
  }, [isRunning]);

  const selectSide = useCallback((side: 'left' | 'right') => {
    const now = Date.now();

    if (!startedAtMsRef.current) {
      startedAtMsRef.current = now;
      setSessionStartedAt(new Date(now));
    }

    let newPausedAt: number | null = null;
    let newTotalPausedMs = pauseMsRef.current;

    if (isRunningRef.current && activeSideRef.current === side) {
      // Pause
      newPausedAt = now;
      pausedAtMsRef.current = now;
      lastSideStartMsRef.current = null;
      setIsRunning(false);
    } else if (isRunningRef.current && activeSideRef.current !== side) {
      // Switch sides
      lastSideStartMsRef.current = now;
      setActiveSide(side);
    } else {
      // Resume or start
      if (pausedAtMsRef.current) {
        newTotalPausedMs = pauseMsRef.current; // already accumulated via interval
        pauseMsRef.current = newTotalPausedMs;
        pausedAtMsRef.current = null;
      }
      lastSideStartMsRef.current = now;
      setActiveSide(side);
      setIsRunning(true);
    }

    setTimeout(() => {
      persistLocal(buildLocalPersist());
      syncServer({ activeSide: side, pausedAt: newPausedAt, totalPausedMs: newTotalPausedMs });
    }, 0);
  }, [persistLocal, buildLocalPersist, syncServer]);

  const pauseResume = useCallback(() => {
    if (!activeSideRef.current) return;
    const now = Date.now();

    let newPausedAt: number | null = null;

    if (isRunningRef.current) {
      newPausedAt = now;
      pausedAtMsRef.current = now;
      lastSideStartMsRef.current = null;
      setIsRunning(false);
    } else {
      if (pausedAtMsRef.current) pausedAtMsRef.current = null;
      lastSideStartMsRef.current = now;
      setIsRunning(true);
    }

    setTimeout(() => {
      persistLocal(buildLocalPersist());
      syncServer({ pausedAt: newPausedAt, totalPausedMs: pauseMsRef.current });
    }, 0);
  }, [persistLocal, buildLocalPersist, syncServer]);

  const finish = useCallback(() => {
    const total = Math.floor((leftMsRef.current + rightMsRef.current) / 1000);
    if (total === 0) return null;

    const now = new Date();
    const startedAt = sessionStartedAt ?? now;

    let side: FeedingSide = 'both';
    if (leftMsRef.current > 0 && rightMsRef.current === 0) side = 'left';
    else if (rightMsRef.current > 0 && leftMsRef.current === 0) side = 'right';

    const result = {
      startedAt: startedAt.toISOString(),
      endedAt: now.toISOString(),
      leftDuration: Math.floor(leftMsRef.current / 1000),
      rightDuration: Math.floor(rightMsRef.current / 1000),
      totalDuration: total,
      totalPauseTime: Math.floor(pauseMsRef.current / 1000),
      lastSide: side,
    };

    setIsRunning(false);
    setActiveSide(null);
    setLeftTime(0);
    setRightTime(0);
    setPauseTime(0);
    setSessionStartedAt(null);
    startedAtMsRef.current = null;
    leftMsRef.current = 0;
    rightMsRef.current = 0;
    pauseMsRef.current = 0;
    lastSideStartMsRef.current = null;
    pausedAtMsRef.current = null;

    persistLocal(null);
    clearActiveTimer('nursing').catch(() => {});

    return result;
  }, [sessionStartedAt, persistLocal]);

  const reset = useCallback(() => {
    setIsRunning(false);
    setActiveSide(null);
    setLeftTime(0);
    setRightTime(0);
    setPauseTime(0);
    setSessionStartedAt(null);
    startedAtMsRef.current = null;
    leftMsRef.current = 0;
    rightMsRef.current = 0;
    pauseMsRef.current = 0;
    lastSideStartMsRef.current = null;
    pausedAtMsRef.current = null;
    persistLocal(null);
    clearActiveTimer('nursing').catch(() => {});
  }, [persistLocal]);

  const setBaby = useCallback((id: string | null, name: string | null) => {
    setBabyIdState(id);
    setBabyNameState(name);
    babyIdRef.current = id;
    babyNameRef.current = name;
    if (startedAtMsRef.current) {
      persistLocal(buildLocalPersist());
      syncServer({});
    }
  }, [persistLocal, buildLocalPersist, syncServer]);

  // Load remote state (e.g. partner synced or partner stopped — caller computes correct ms)
  const loadFromRemote = useCallback((remote: {
    startedAt: string;
    leftMs: number;
    rightMs: number;
    activeSide: Side;
    pausedAt: string | null;
    totalPausedMs: number;
    babyId: string | null;
    babyName: string | null;
  }) => {
    const now = Date.now();
    const startMs = new Date(remote.startedAt).getTime();
    startedAtMsRef.current = startMs;
    setSessionStartedAt(new Date(startMs));

    leftMsRef.current = remote.leftMs;
    rightMsRef.current = remote.rightMs;
    pauseMsRef.current = remote.totalPausedMs;

    setLeftTime(Math.floor(remote.leftMs / 1000));
    setRightTime(Math.floor(remote.rightMs / 1000));
    setPauseTime(Math.floor(remote.totalPausedMs / 1000));

    setBabyIdState(remote.babyId);
    setBabyNameState(remote.babyName);
    babyIdRef.current = remote.babyId;
    babyNameRef.current = remote.babyName;

    if (remote.pausedAt) {
      pausedAtMsRef.current = new Date(remote.pausedAt).getTime();
      lastSideStartMsRef.current = null;
      setActiveSide(remote.activeSide);
      setIsRunning(false);
    } else {
      pausedAtMsRef.current = null;
      lastSideStartMsRef.current = now;
      setActiveSide(remote.activeSide);
      setIsRunning(!!remote.activeSide);
    }

    persistLocal({
      startedAtMs: startMs,
      leftMs: remote.leftMs,
      rightMs: remote.rightMs,
      pauseMs: remote.totalPausedMs,
      activeSide: remote.activeSide,
      isRunning: !remote.pausedAt && !!remote.activeSide,
      lastSideStartMs: remote.pausedAt ? null : now,
      pausedAtMs: remote.pausedAt ? new Date(remote.pausedAt).getTime() : null,
      babyId: remote.babyId,
      babyName: remote.babyName,
    });
  }, [persistLocal]);

  const totalTime = leftTime + rightTime;
  const isPaused = !isRunning && activeSide !== null && totalTime > 0;

  return (
    <NursingTimerContext.Provider value={{
      activeSide, isRunning, isPaused,
      leftTime, rightTime, totalTime, pauseTime,
      sessionStartedAt, babyId, babyName,
      selectSide, pauseResume, finish, reset, setBaby, loadFromRemote,
    }}>
      {children}
    </NursingTimerContext.Provider>
  );
}
