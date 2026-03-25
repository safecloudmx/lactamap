import AsyncStorage from '@react-native-async-storage/async-storage';
import { DiaperRecord } from '../types';
import * as nursingStorage from './nursingStorage';
import {
  getDiaperRecordsFromServer,
  createDiaperRecordOnServer,
  updateDiaperRecordOnServer,
  deleteDiaperRecordFromServer,
} from './api';

const KEYS = {
  records: '@Diaper:records',
};

async function hasToken(): Promise<boolean> {
  const token = await AsyncStorage.getItem('@Auth:token');
  return !!token;
}

function mapServerRecord(r: any): DiaperRecord {
  return {
    id: r.id,
    babyId: r.babyId ?? undefined,
    type: r.type,
    changedAt: r.changedAt,
    notes: r.notes ?? '',
    photos: [],
    createdAt: r.createdAt,
    updatedAt: r.updatedAt ?? r.createdAt,
  };
}

// Reuse baby management from nursingStorage
export const getBabies = nursingStorage.getBabies;
export const getActiveBabyId = nursingStorage.getActiveBabyId;
export const setActiveBabyId = nursingStorage.setActiveBabyId;

export async function getRecords(): Promise<DiaperRecord[]> {
  try {
    if (await hasToken()) {
      const serverRecords = await getDiaperRecordsFromServer();
      const records: DiaperRecord[] = serverRecords.map(mapServerRecord);
      await AsyncStorage.setItem(KEYS.records, JSON.stringify(records));
      return records.sort(
        (a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()
      );
    }
    const raw = await AsyncStorage.getItem(KEYS.records);
    if (!raw) return [];
    const records: DiaperRecord[] = JSON.parse(raw);
    return records.sort(
      (a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()
    );
  } catch (e) {
    console.warn('diaperStorage.getRecords error:', e);
    try {
      const raw = await AsyncStorage.getItem(KEYS.records);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
}

export async function saveRecord(record: DiaperRecord): Promise<void> {
  try {
    if (await hasToken()) {
      await createDiaperRecordOnServer({
        babyId: record.babyId,
        type: record.type,
        changedAt: record.changedAt,
        notes: record.notes,
      });
      const serverRecords = await getDiaperRecordsFromServer();
      await AsyncStorage.setItem(KEYS.records, JSON.stringify(serverRecords.map(mapServerRecord)));
      return;
    }
    const records = await getRecords();
    records.unshift(record);
    await AsyncStorage.setItem(KEYS.records, JSON.stringify(records));
  } catch (e) {
    console.warn('diaperStorage.saveRecord error:', e);
    try {
      const raw = await AsyncStorage.getItem(KEYS.records);
      const records: DiaperRecord[] = raw ? JSON.parse(raw) : [];
      records.unshift(record);
      await AsyncStorage.setItem(KEYS.records, JSON.stringify(records));
    } catch {}
  }
}

export async function updateRecord(id: string, updates: Partial<DiaperRecord>): Promise<void> {
  try {
    if (await hasToken()) {
      await updateDiaperRecordOnServer(id, {
        babyId: updates.babyId,
        type: updates.type,
        changedAt: updates.changedAt,
        notes: updates.notes,
      });
      const raw = await AsyncStorage.getItem(KEYS.records);
      if (raw) {
        const records: DiaperRecord[] = JSON.parse(raw);
        const idx = records.findIndex((r) => r.id === id);
        if (idx !== -1) {
          records[idx] = { ...records[idx], ...updates, updatedAt: new Date().toISOString() };
          await AsyncStorage.setItem(KEYS.records, JSON.stringify(records));
        }
      }
      return;
    }
    const records = await getRecords();
    const idx = records.findIndex((r) => r.id === id);
    if (idx === -1) return;
    records[idx] = { ...records[idx], ...updates, updatedAt: new Date().toISOString() };
    await AsyncStorage.setItem(KEYS.records, JSON.stringify(records));
  } catch (e) {
    console.warn('diaperStorage.updateRecord error:', e);
  }
}

export async function deleteRecord(id: string): Promise<void> {
  try {
    if (await hasToken()) {
      await deleteDiaperRecordFromServer(id);
      const raw = await AsyncStorage.getItem(KEYS.records);
      if (raw) {
        const records: DiaperRecord[] = JSON.parse(raw);
        await AsyncStorage.setItem(KEYS.records, JSON.stringify(records.filter((r) => r.id !== id)));
      }
      return;
    }
    const records = await getRecords();
    await AsyncStorage.setItem(KEYS.records, JSON.stringify(records.filter((r) => r.id !== id)));
  } catch (e) {
    console.warn('diaperStorage.deleteRecord error:', e);
  }
}

export async function getTodayRecords(): Promise<DiaperRecord[]> {
  try {
    const records = await getRecords();
    const todayStr = new Date().toISOString().slice(0, 10);
    return records.filter((r) => r.changedAt.slice(0, 10) === todayStr);
  } catch (e) {
    console.warn('diaperStorage.getTodayRecords error:', e);
    return [];
  }
}
