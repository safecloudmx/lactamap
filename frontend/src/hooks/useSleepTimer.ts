import { useState, useRef, useEffect, useCallback } from 'react';
import { SleepSession } from '../types';

export { formatTime, formatDuration } from './useNursingTimer';

export function useSleepTimer() {
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [pauseTime, setPauseTime] = useState(0);
  const [sessionStartedAt, setSessionStartedAt] = useState<Date | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pauseIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wasPausedRef = useRef(false);

  // Tick elapsed timer
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setElapsedTime((t) => t + 1);
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  // Tick pause timer
  useEffect(() => {
    if (!isRunning && wasPausedRef.current) {
      pauseIntervalRef.current = setInterval(() => {
        setPauseTime((t) => t + 1);
      }, 1000);
    }
    return () => {
      if (pauseIntervalRef.current) clearInterval(pauseIntervalRef.current);
    };
  }, [isRunning]);

  const start = useCallback(() => {
    if (!sessionStartedAt) {
      setSessionStartedAt(new Date());
    }
    if (wasPausedRef.current) {
      wasPausedRef.current = false;
    }
    setIsRunning(true);
  }, [sessionStartedAt]);

  const pause = useCallback(() => {
    if (!isRunning) return;
    wasPausedRef.current = true;
    setIsRunning(false);
  }, [isRunning]);

  const resume = useCallback(() => {
    if (isRunning) return;
    wasPausedRef.current = false;
    setIsRunning(true);
  }, [isRunning]);

  const finish = useCallback((): Omit<SleepSession, 'babyId' | 'notes' | 'photos'> | null => {
    setIsRunning(false);
    if (elapsedTime === 0) return null;

    const now = new Date();
    const startedAt = sessionStartedAt ?? now;

    const session = {
      id: Date.now().toString(),
      startedAt: startedAt.toISOString(),
      endedAt: now.toISOString(),
      totalDuration: elapsedTime,
      totalPauseTime: pauseTime,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    // Reset state
    setElapsedTime(0);
    setPauseTime(0);
    setIsRunning(false);
    setSessionStartedAt(null);
    wasPausedRef.current = false;

    return session;
  }, [elapsedTime, pauseTime, sessionStartedAt]);

  const reset = useCallback(() => {
    setIsRunning(false);
    setElapsedTime(0);
    setPauseTime(0);
    setSessionStartedAt(null);
    wasPausedRef.current = false;
  }, []);

  const hasStarted = sessionStartedAt !== null;
  const isPaused = !isRunning && hasStarted && elapsedTime > 0;

  return {
    isRunning,
    elapsedTime,
    pauseTime,
    sessionStartedAt,
    hasStarted,
    isPaused,
    start,
    pause,
    resume,
    finish,
    reset,
  };
}
