import AsyncStorage from '@react-native-async-storage/async-storage';
import { Baby, FeedingSession } from '../types';

const KEYS = {
  sessions: '@Nursing:sessions',
  babies: '@Nursing:babies',
  activeBaby: '@Nursing:activeBaby',
};

// === Sessions ===

export async function getSessions(): Promise<FeedingSession[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.sessions);
    if (!raw) return [];
    const sessions: FeedingSession[] = JSON.parse(raw);
    return sessions.sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
  } catch (e) {
    console.warn('nursingStorage.getSessions error:', e);
    return [];
  }
}

export async function getSessionById(id: string): Promise<FeedingSession | null> {
  const sessions = await getSessions();
  return sessions.find((s) => s.id === id) ?? null;
}

export async function saveSession(session: FeedingSession): Promise<void> {
  try {
    const sessions = await getSessions();
    sessions.unshift(session);
    await AsyncStorage.setItem(KEYS.sessions, JSON.stringify(sessions));
  } catch (e) {
    console.warn('nursingStorage.saveSession error:', e);
  }
}

export async function updateSession(
  id: string,
  updates: Partial<FeedingSession>
): Promise<void> {
  try {
    const sessions = await getSessions();
    const idx = sessions.findIndex((s) => s.id === id);
    if (idx === -1) return;
    sessions[idx] = { ...sessions[idx], ...updates, updatedAt: new Date().toISOString() };
    await AsyncStorage.setItem(KEYS.sessions, JSON.stringify(sessions));
  } catch (e) {
    console.warn('nursingStorage.updateSession error:', e);
  }
}

export async function deleteSession(id: string): Promise<void> {
  try {
    const sessions = await getSessions();
    const filtered = sessions.filter((s) => s.id !== id);
    await AsyncStorage.setItem(KEYS.sessions, JSON.stringify(filtered));
  } catch (e) {
    console.warn('nursingStorage.deleteSession error:', e);
  }
}

export async function deleteSessionsByBabyId(babyId: string): Promise<number> {
  try {
    const sessions = await getSessions();
    const filtered = sessions.filter((s) => s.babyId !== babyId);
    const deletedCount = sessions.length - filtered.length;
    await AsyncStorage.setItem(KEYS.sessions, JSON.stringify(filtered));
    return deletedCount;
  } catch (e) {
    console.warn('nursingStorage.deleteSessionsByBabyId error:', e);
    return 0;
  }
}

export async function getSessionsCountByBabyId(babyId: string): Promise<number> {
  try {
    const sessions = await getSessions();
    return sessions.filter((s) => s.babyId === babyId).length;
  } catch (e) {
    return 0;
  }
}

export async function getTodaySessions(): Promise<FeedingSession[]> {
  try {
    const sessions = await getSessions();
    const todayStr = new Date().toISOString().slice(0, 10);
    return sessions.filter((s) => s.startedAt.slice(0, 10) === todayStr);
  } catch (e) {
    console.warn('nursingStorage.getTodaySessions error:', e);
    return [];
  }
}

// === Babies ===

export async function getBabies(): Promise<Baby[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.babies);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.warn('nursingStorage.getBabies error:', e);
    return [];
  }
}

export async function saveBaby(baby: Baby): Promise<void> {
  try {
    const babies = await getBabies();
    babies.push(baby);
    await AsyncStorage.setItem(KEYS.babies, JSON.stringify(babies));
  } catch (e) {
    console.warn('nursingStorage.saveBaby error:', e);
  }
}

export async function updateBaby(id: string, updates: Partial<Baby>): Promise<void> {
  try {
    const babies = await getBabies();
    const idx = babies.findIndex((b) => b.id === id);
    if (idx === -1) return;
    babies[idx] = { ...babies[idx], ...updates };
    await AsyncStorage.setItem(KEYS.babies, JSON.stringify(babies));
  } catch (e) {
    console.warn('nursingStorage.updateBaby error:', e);
  }
}

export async function deleteBaby(id: string): Promise<void> {
  try {
    const babies = await getBabies();
    const filtered = babies.filter((b) => b.id !== id);
    await AsyncStorage.setItem(KEYS.babies, JSON.stringify(filtered));
  } catch (e) {
    console.warn('nursingStorage.deleteBaby error:', e);
  }
}

// === Active Baby Preference ===

export async function getActiveBabyId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEYS.activeBaby);
  } catch (e) {
    console.warn('nursingStorage.getActiveBabyId error:', e);
    return null;
  }
}

export async function setActiveBabyId(id: string | null): Promise<void> {
  try {
    if (id) {
      await AsyncStorage.setItem(KEYS.activeBaby, id);
    } else {
      await AsyncStorage.removeItem(KEYS.activeBaby);
    }
  } catch (e) {
    console.warn('nursingStorage.setActiveBabyId error:', e);
  }
}
