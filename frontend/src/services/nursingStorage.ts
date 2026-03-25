import AsyncStorage from '@react-native-async-storage/async-storage';
import { Baby, FeedingSession } from '../types';
import {
  getBabiesFromServer,
  createBabyOnServer,
  updateBabyOnServer,
  deleteBabyFromServer,
  getNursingSessionsFromServer,
  createNursingSessionOnServer,
  deleteNursingSessionFromServer,
} from './api';

const KEYS = {
  sessions: '@Nursing:sessions',
  babies: '@Nursing:babies',
  activeBaby: '@Nursing:activeBaby',
};

async function hasToken(): Promise<boolean> {
  const token = await AsyncStorage.getItem('@Auth:token');
  return !!token;
}

// Maps a server baby (may have different date format) to frontend Baby type
function mapServerBaby(b: any): Baby {
  return {
    id: b.id,
    name: b.name,
    birthDate: b.birthDate ?? null,
    avatarUrl: b.avatarUrl ?? null,
    notes: b.notes ?? null,
    createdAt: b.createdAt,
  };
}

// Maps a server nursing session to frontend FeedingSession type
function mapServerSession(s: any): FeedingSession {
  return {
    id: s.id,
    babyId: s.babyId ?? undefined,
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    leftDuration: s.leftDuration ?? 0,
    rightDuration: s.rightDuration ?? 0,
    totalDuration: s.totalDuration ?? 0,
    totalPauseTime: s.totalPauseTime ?? 0,
    lastSide: s.lastSide ?? 'both',
    notes: s.notes ?? '',
    createdAt: s.createdAt,
    updatedAt: s.updatedAt ?? s.createdAt,
  };
}

// === Sessions ===

export async function getSessions(): Promise<FeedingSession[]> {
  try {
    if (await hasToken()) {
      const serverSessions = await getNursingSessionsFromServer();
      const sessions: FeedingSession[] = serverSessions.map(mapServerSession);
      // Update local cache
      await AsyncStorage.setItem(KEYS.sessions, JSON.stringify(sessions));
      return sessions.sort(
        (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      );
    }
    const raw = await AsyncStorage.getItem(KEYS.sessions);
    if (!raw) return [];
    const sessions: FeedingSession[] = JSON.parse(raw);
    return sessions.sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
  } catch (e) {
    console.warn('nursingStorage.getSessions error:', e);
    // Fallback to local cache on network error
    try {
      const raw = await AsyncStorage.getItem(KEYS.sessions);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
}

export async function getSessionById(id: string): Promise<FeedingSession | null> {
  const sessions = await getSessions();
  return sessions.find((s) => s.id === id) ?? null;
}

export async function saveSession(session: FeedingSession): Promise<void> {
  try {
    if (await hasToken()) {
      await createNursingSessionOnServer({
        babyId: session.babyId,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        leftDuration: session.leftDuration,
        rightDuration: session.rightDuration,
        totalDuration: session.totalDuration,
        totalPauseTime: session.totalPauseTime,
        lastSide: session.lastSide,
        notes: session.notes,
      });
      // Refresh cache
      const serverSessions = await getNursingSessionsFromServer();
      await AsyncStorage.setItem(KEYS.sessions, JSON.stringify(serverSessions.map(mapServerSession)));
      return;
    }
    const sessions = await getSessions();
    sessions.unshift(session);
    await AsyncStorage.setItem(KEYS.sessions, JSON.stringify(sessions));
  } catch (e) {
    console.warn('nursingStorage.saveSession error:', e);
    // Fallback to local on network error
    try {
      const raw = await AsyncStorage.getItem(KEYS.sessions);
      const sessions: FeedingSession[] = raw ? JSON.parse(raw) : [];
      sessions.unshift(session);
      await AsyncStorage.setItem(KEYS.sessions, JSON.stringify(sessions));
    } catch {}
  }
}

export async function updateSession(id: string, updates: Partial<FeedingSession>): Promise<void> {
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
    if (await hasToken()) {
      await deleteNursingSessionFromServer(id);
      const raw = await AsyncStorage.getItem(KEYS.sessions);
      if (raw) {
        const sessions: FeedingSession[] = JSON.parse(raw);
        await AsyncStorage.setItem(KEYS.sessions, JSON.stringify(sessions.filter((s) => s.id !== id)));
      }
      return;
    }
    const sessions = await getSessions();
    await AsyncStorage.setItem(KEYS.sessions, JSON.stringify(sessions.filter((s) => s.id !== id)));
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
    if (await hasToken()) {
      const serverBabies = await getBabiesFromServer();
      const babies: Baby[] = serverBabies.map(mapServerBaby);
      await AsyncStorage.setItem(KEYS.babies, JSON.stringify(babies));
      return babies;
    }
    const raw = await AsyncStorage.getItem(KEYS.babies);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.warn('nursingStorage.getBabies error:', e);
    try {
      const raw = await AsyncStorage.getItem(KEYS.babies);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
}

export async function saveBaby(baby: Baby): Promise<Baby> {
  if (await hasToken()) {
    const serverBaby = await createBabyOnServer({
      name: baby.name,
      birthDate: baby.birthDate || undefined,
      notes: baby.notes || undefined,
    });
    const mapped = mapServerBaby(serverBaby);
    // Update local cache
    const raw = await AsyncStorage.getItem(KEYS.babies);
    const babies: Baby[] = raw ? JSON.parse(raw) : [];
    babies.push(mapped);
    await AsyncStorage.setItem(KEYS.babies, JSON.stringify(babies));
    return mapped;
  }
  const babies = await getBabies();
  babies.push(baby);
  await AsyncStorage.setItem(KEYS.babies, JSON.stringify(babies));
  return baby;
}

export async function updateBaby(id: string, updates: Partial<Baby>): Promise<void> {
  try {
    if (await hasToken()) {
      await updateBabyOnServer(id, {
        name: updates.name,
        birthDate: updates.birthDate || undefined,
        notes: updates.notes || undefined,
      });
      const raw = await AsyncStorage.getItem(KEYS.babies);
      if (raw) {
        const babies: Baby[] = JSON.parse(raw);
        const idx = babies.findIndex((b) => b.id === id);
        if (idx !== -1) {
          babies[idx] = { ...babies[idx], ...updates };
          await AsyncStorage.setItem(KEYS.babies, JSON.stringify(babies));
        }
      }
      return;
    }
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
    if (await hasToken()) {
      await deleteBabyFromServer(id);
      const raw = await AsyncStorage.getItem(KEYS.babies);
      if (raw) {
        const babies: Baby[] = JSON.parse(raw);
        await AsyncStorage.setItem(KEYS.babies, JSON.stringify(babies.filter((b) => b.id !== id)));
      }
      return;
    }
    const babies = await getBabies();
    await AsyncStorage.setItem(KEYS.babies, JSON.stringify(babies.filter((b) => b.id !== id)));
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
