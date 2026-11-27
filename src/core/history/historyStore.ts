export type MeasurementCategory = 'ruler' | 'angle' | 'camera-ref' | 'camera-trigo' | 'camera-ar';

export interface MeasurementRecord {
  id: string;
  category: MeasurementCategory;
  valueText: string;
  detailText?: string;
  note?: string;
  createdAt: string;
}

const HISTORY_STORAGE_KEY = 'measure.history.v1';
const MAX_RECORDS = 100;

export function loadHistory(): MeasurementRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is MeasurementRecord =>
        typeof item === 'object' &&
        item !== null &&
        typeof item.id === 'string' &&
        typeof item.category === 'string' &&
        typeof item.valueText === 'string' &&
        typeof item.createdAt === 'string',
    );
  } catch {
    return [];
  }
}

export function saveHistory(records: MeasurementRecord[]): void {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(records.slice(0, MAX_RECORDS)));
  } catch {
    // Ignore private-mode storage restrictions
  }
}

export function createRecord(
  category: MeasurementCategory,
  valueText: string,
  detailText?: string,
  note?: string,
): MeasurementRecord {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    category,
    valueText,
    detailText,
    note,
    createdAt: new Date().toISOString(),
  };
}
