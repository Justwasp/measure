import type { CalibrationConfidence } from './detectDevice';

export interface StoredCalibration {
  pxPerMm: number;
  confidence: CalibrationConfidence;
  label: string;
  deviceId?: string;
  updatedAt: string;
}

const STORAGE_KEY = 'measure.calibration.v1';

export function loadStoredCalibration(): StoredCalibration | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredCalibration>;
    if (
      typeof parsed.pxPerMm === 'number' &&
      Number.isFinite(parsed.pxPerMm) &&
      parsed.pxPerMm >= 2 &&
      parsed.pxPerMm <= 18 &&
      typeof parsed.label === 'string'
    ) {
      return {
        pxPerMm: parsed.pxPerMm,
        confidence: parsed.confidence ?? 'calibrated',
        label: parsed.label,
        deviceId: parsed.deviceId,
        updatedAt: parsed.updatedAt ?? new Date().toISOString(),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveStoredCalibration(calibration: StoredCalibration): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(calibration));
  } catch {
    // Storage may be blocked in private browsing; keep in-memory state working
  }
}

export function clearStoredCalibration(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}
