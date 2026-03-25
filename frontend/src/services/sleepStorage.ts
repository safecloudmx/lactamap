import AsyncStorage from '@react-native-async-storage/async-storage';
import { SleepSession } from '../types';
import * as nursingStorage from './nursingStorage';
import {
  getSleepSessionsFromServer,
  createSleepSessionOnServer,
  updateSleepSessionOnServer,
  deleteSleepSessionFromServer,
} from './api';

const KEYS = {
  sessions: '@Sleep:sessions',
};

async function hasToken(): Promise<boolean> {
  const token = await AsyncStorage.getItem('@Auth:token');
  return !!token;
}

function mapServerSession(s: any): SleepSession {
  return {
    id: s.id,
    babyId: s.babyId ?? undefined,
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    totalDuration: s.totalDuration ?? 0,
    totalPauseTime: s.totalPauseTime ?? 0,
    notes: s.notes ?? '',
    photos: [],
    createdAt: s.createdAt,
    updatedAt: s.updatedAt ?? s.createdAt,
  };
}

// Reuse baby management from nursingStorage
export const getBabies = nursingStorage.getBabies;
export const getActiveBabyId = nursingStorage.getActiveBabyId;
export const setActiveBabyId = nursingStorage.setActiveBabyId;

export async function getSessions(): Promise<SleepSession[]> {
  try {
    if (await hasToken()) {
      const serverSessions = await getSleepSessionsFromServer();
      const sessions: SleepSession[] = serverSessions.map(mapServerSession);
      await AsyncStorage.setItem(KEYS.sessions, JSON.stringify(sessions));
      return sessions.sort(
        (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      );
    }
    const raw = await AsyncStorage.getItem(KEYS.sessions);
    if (!raw) return [];
    const sessions: SleepSession[] = JSON.parse(raw);
    return sessions.sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
  } catch (e) {
    console.warn('sleepStorage.getSessions error:', e);
    try {
      const raw = await AsyncStorage.getItem(KEYS.sessions);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
}

export async function saveSession(session: SleepSession): Promise<void> {
  try {
    if (await hasToken()) {
      await createSleepSessionOnServer({
        babyId: session.babyId,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        totalDuration: session.totalDuration,
        totalPauseTime: session.totalPauseTime,
        notes: session.notes,
      });
      const serverSessions = await getSleepSessionsFromServer();
      await AsyncStorage.setItem(KEYS.sessions, JSON.stringify(serverSessions.map(mapServerSession)));
      return;
    }
    const sessions = await getSessions();
    sessions.unshift(session);
    await AsyncStorage.setItem(KEYS.sessions, JSON.stringify(sessions));
  } catch (e) {
    console.warn('sleepStorage.saveSession error:', e);
    try {
      const raw = await AsyncStorage.getItem(KEYS.sessions);
      const sessions: SleepSession[] = raw ? JSON.parse(raw) : [];
      sessions.unshift(session);
      await AsyncStorage.setItem(KEYS.sessions, JSON.stringify(sessions));
    } catch {}
  }
}

export async function updateSession(id: string, updates: Partial<SleepSession>): Promise<void> {
  try {
    if (await hasToken()) {
      await updateSleepSessionOnServer(id, {
        babyId: updates.babyId,
        startedAt: updates.startedAt,
        endedAt: updates.endedAt,
        totalDuration: updates.totalDuration,
        totalPauseTime: updates.totalPauseTime,
        notes: updates.notes,
      });
      const raw = await AsyncStorage.getItem(KEYS.sessions);
      if (raw) {
        const sessions: SleepSession[] = JSON.parse(raw);
        const idx = sessions.findIndex((s) => s.id === id);
        if (idx !== -1) {
          sessions[idx] = { ...sessions[idx], ...updates, updatedAt: new Date().toISOString() };
          await AsyncStorage.setItem(KEYS.sessions, JSON.stringify(sessions));
        }
      }
      return;
    }
    const sessions = await getSessions();
    const idx = sessions.findIndex((s) => s.id === id);
    if (idx === -1) return;
    sessions[idx] = { ...sessions[idx], ...updates, updatedAt: new Date().toISOString() };
    await AsyncStorage.setItem(KEYS.sessions, JSON.stringify(sessions));
  } catch (e) {
    console.warn('sleepStorage.updateSession error:', e);
  }
}

export async function deleteSession(id: string): Promise<void> {
  try {
    if (await hasToken()) {
      await deleteSleepSessionFromServer(id);
      const raw = await AsyncStorage.getItem(KEYS.sessions);
      if (raw) {
        const sessions: SleepSession[] = JSON.parse(raw);
        await AsyncStorage.setItem(KEYS.sessions, JSON.stringify(sessions.filter((s) => s.id !== id)));
      }
      return;
    }
    const sessions = await getSessions();
    await AsyncStorage.setItem(KEYS.sessions, JSON.stringify(sessions.filter((s) => s.id !== id)));
  } catch (e) {
    console.warn('sleepStorage.deleteSession error:', e);
  }
}

export async function getTodaySessions(): Promise<SleepSession[]> {
  try {
    const sessions = await getSessions();
    const todayStr = new Date().toISOString().slice(0, 10);
    return sessions.filter((s) => s.startedAt.slice(0, 10) === todayStr);
  } catch (e) {
    console.warn('sleepStorage.getTodaySessions error:', e);
    return [];
  }
}
