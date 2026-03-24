import AsyncStorage from '@react-native-async-storage/async-storage';
import { DiaperRecord, Baby } from '../types';
import * as nursingStorage from './nursingStorage';

const KEYS = {
  records: '@Diaper:records',
};

// Reuse baby management from nursingStorage
export const getBabies = nursingStorage.getBabies;
export const getActiveBabyId = nursingStorage.getActiveBabyId;
export const setActiveBabyId = nursingStorage.setActiveBabyId;

// === Diaper Records (local-only for now) ===

export async function getRecords(): Promise<DiaperRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.records);
    if (!raw) return [];
    const records: DiaperRecord[] = JSON.parse(raw);
    return records.sort(
      (a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()
    );
  } catch (e) {
    console.warn('diaperStorage.getRecords error:', e);
    return [];
  }
}

export async function saveRecord(record: DiaperRecord): Promise<void> {
  try {
    const records = await getRecords();
    records.unshift(record);
    await AsyncStorage.setItem(KEYS.records, JSON.stringify(records));
  } catch (e) {
    console.warn('diaperStorage.saveRecord error:', e);
  }
}

export async function updateRecord(id: string, updates: Partial<DiaperRecord>): Promise<void> {
  try {
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
