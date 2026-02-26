import { useState, useRef, useEffect, useCallback } from 'react';
import { FeedingSession, FeedingSide } from '../types';

type Side = 'left' | 'right' | null;

export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}min ${s}s`;
  if (m > 0) return `${m}min ${s}s`;
  return `${s}s`;
}

export function useNursingTimer() {
  const [activeSide, setActiveSide] = useState<Side>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [leftTime, setLeftTime] = useState(0);
  const [rightTime, setRightTime] = useState(0);
  const [pauseTime, setPauseTime] = useState(0);
  const [sessionStartedAt, setSessionStartedAt] = useState<Date | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPausedAtRef = useRef<Date | null>(null);
  const pauseIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tick active side timer
  useEffect(() => {
    if (isRunning && activeSide) {
      intervalRef.current = setInterval(() => {
        if (activeSide === 'left') {
          setLeftTime((t) => t + 1);
        } else {
          setRightTime((t) => t + 1);
        }
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, activeSide]);

  // Tick pause timer when paused with an active session
  useEffect(() => {
    if (!isRunning && lastPausedAtRef.current) {
      pauseIntervalRef.current = setInterval(() => {
        setPauseTime((t) => t + 1);
      }, 1000);
    }
    return () => {
      if (pauseIntervalRef.current) clearInterval(pauseIntervalRef.current);
    };
  }, [isRunning]);

  const selectSide = useCallback((side: 'left' | 'right') => {
    // First interaction — start the session
    if (!sessionStartedAt) {
      setSessionStartedAt(new Date());
    }

    if (isRunning && activeSide === side) {
      // Pause current side
      lastPausedAtRef.current = new Date();
      setIsRunning(false);
    } else if (isRunning && activeSide !== side) {
      // Switch sides (no pause)
      setActiveSide(side);
    } else {
      // Resume or start
      if (lastPausedAtRef.current) {
        // Was paused — accumulate pause time is already being tracked by interval
        lastPausedAtRef.current = null;
      }
      setActiveSide(side);
      setIsRunning(true);
    }
  }, [isRunning, activeSide, sessionStartedAt]);

  const pauseResume = useCallback(() => {
    if (!activeSide) return;
    if (isRunning) {
      // Pause
      lastPausedAtRef.current = new Date();
      setIsRunning(false);
    } else {
      // Resume
      if (lastPausedAtRef.current) {
        lastPausedAtRef.current = null;
      }
      setIsRunning(true);
    }
  }, [isRunning, activeSide]);

  const finish = useCallback((): Omit<FeedingSession, 'babyId' | 'notes'> | null => {
    setIsRunning(false);

    const total = leftTime + rightTime;
    if (total === 0) return null;

    const now = new Date();
    const startedAt = sessionStartedAt ?? now;

    let side: FeedingSide = 'both';
    if (leftTime > 0 && rightTime === 0) side = 'left';
    else if (rightTime > 0 && leftTime === 0) side = 'right';

    const session = {
      id: Date.now().toString(),
      startedAt: startedAt.toISOString(),
      endedAt: now.toISOString(),
      leftDuration: leftTime,
      rightDuration: rightTime,
      totalDuration: total,
      totalPauseTime: pauseTime,
      lastSide: side,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    // Reset state
    setLeftTime(0);
    setRightTime(0);
    setPauseTime(0);
    setActiveSide(null);
    setSessionStartedAt(null);
    lastPausedAtRef.current = null;

    return session;
  }, [leftTime, rightTime, pauseTime, sessionStartedAt]);

  const reset = useCallback(() => {
    setIsRunning(false);
    setLeftTime(0);
    setRightTime(0);
    setPauseTime(0);
    setActiveSide(null);
    setSessionStartedAt(null);
    lastPausedAtRef.current = null;
  }, []);

  const totalTime = leftTime + rightTime;
  const isPaused = !isRunning && activeSide !== null && totalTime > 0;

  return {
    activeSide,
    isRunning,
    leftTime,
    rightTime,
    pauseTime,
    totalTime,
    isPaused,
    sessionStartedAt,
    selectSide,
    pauseResume,
    finish,
    reset,
  };
}
