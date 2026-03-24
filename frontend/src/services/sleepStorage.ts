import AsyncStorage from '@react-native-async-storage/async-storage';
import { SleepSession, Baby } from '../types';
import * as nursingStorage from './nursingStorage';

const KEYS = {
  sessions: '@Sleep:sessions',
};

// Reuse baby management from nursingStorage
export const getBabies = nursingStorage.getBabies;
export const getActiveBabyId = nursingStorage.getActiveBabyId;
export const setActiveBabyId = nursingStorage.setActiveBabyId;

// === Sleep Sessions (local-only for now) ===

export async function getSessions(): Promise<SleepSession[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.sessions);
    if (!raw) return [];
    const sessions: SleepSession[] = JSON.parse(raw);
    return sessions.sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
  } catch (e) {
    console.warn('sleepStorage.getSessions error:', e);
    return [];
  }
}

export async function saveSession(session: SleepSession): Promise<void> {
  try {
    const sessions = await getSessions();
    sessions.unshift(session);
    await AsyncStorage.setItem(KEYS.sessions, JSON.stringify(sessions));
  } catch (e) {
    console.warn('sleepStorage.saveSession error:', e);
  }
}

export async function updateSession(id: string, updates: Partial<SleepSession>): Promise<void> {
  try {
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
