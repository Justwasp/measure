import { DEVICE_DATABASE, type DeviceProfile } from './deviceDatabase';

export type CalibrationConfidence = 'calibrated' | 'auto' | 'ambiguous' | 'estimated';

export interface DeviceEnvironment {
  screenWidth: number;
  screenHeight: number;
  devicePixelRatio: number;
  userAgent: string;
  modelHint?: string;
}

export interface DetectionResult {
  pxPerMm: number;
  confidence: CalibrationConfidence;
  matchedDevices: DeviceProfile[];
  detectedLabel: string;
  platform: 'ios' | 'android' | 'desktop';
  warning?: 'ambiguous_model' | 'display_zoom_possible' | 'estimated_dpi';
}

export const MM_PER_INCH = 25.4;
/** Fallback CSS reference pixel density (96 CSS px / inch = 3.7795 px/mm). */
export const DEFAULT_DESKTOP_PX_PER_MM = 96 / MM_PER_INCH;
/** Typical modern smartphone fallback (~156 CSS px / inch = ~6.14 px/mm). */
export const DEFAULT_MOBILE_PX_PER_MM = 156 / MM_PER_INCH;

export function pxPerMmFromPhysicalWidth(
  screenWidth: number,
  screenHeight: number,
  physicalWidthMm: number,
): number {
  const shortEdge = Math.min(screenWidth, screenHeight);
  if (shortEdge <= 0 || physicalWidthMm <= 0) {
    return DEFAULT_MOBILE_PX_PER_MM;
  }
  return shortEdge / physicalWidthMm;
}

export function pxPerMmFromReference(measuredCssPx: number, referenceMm: number): number {
  if (measuredCssPx <= 0 || referenceMm <= 0) {
    throw new Error('Calibration dimensions must be positive numbers');
  }
  return measuredCssPx / referenceMm;
}

export function clampPxPerMm(pxPerMm: number): number {
  if (!Number.isFinite(pxPerMm)) return DEFAULT_MOBILE_PX_PER_MM;
  return Math.min(18, Math.max(2, pxPerMm));
}

export function detectPlatform(userAgent: string): 'ios' | 'android' | 'desktop' {
  const ua = userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'desktop';
}

/**
 * Resolves physical CSS pixels/mm from browser hardware hints and screen geometry.
 */
export function detectDeviceCalibration(env: DeviceEnvironment): DetectionResult {
  const platform = detectPlatform(env.userAgent);
  const shortEdge = Math.round(Math.min(env.screenWidth, env.screenHeight));
  const longEdge = Math.round(Math.max(env.screenWidth, env.screenHeight));
  const dpr = env.devicePixelRatio || 1;

  // 1. Exact Android Client Hints model code match (highest automatic accuracy)
  if (env.modelHint && env.modelHint.trim().length > 0) {
    const normalizedHint = env.modelHint.trim().toLowerCase();
    const match = DEVICE_DATABASE.find((d) =>
      d.modelCodes?.some((code) => code.toLowerCase() === normalizedHint),
    );
    if (match) {
      return {
        pxPerMm: pxPerMmFromPhysicalWidth(shortEdge, longEdge, match.physicalWidthMm),
        confidence: 'auto',
        matchedDevices: [match],
        detectedLabel: match.name,
        platform,
      };
    }
  }

  // 2. iOS logical screen + DPR matrix match
  if (platform === 'ios') {
    const matches = DEVICE_DATABASE.filter(
      (d) =>
        d.brand === 'Apple' &&
        d.logicalViewport &&
        d.logicalViewport[0] === shortEdge &&
        d.logicalViewport[1] === longEdge &&
        d.dpr === Math.round(dpr),
    );

    if (matches.length === 1) {
      const device = matches[0];
      return {
        pxPerMm: pxPerMmFromPhysicalWidth(shortEdge, longEdge, device.physicalWidthMm),
        confidence: 'auto',
        matchedDevices: matches,
        detectedLabel: device.name,
        platform,
      };
    }

    if (matches.length > 1) {
      // Example: 375x812 @3x matches both iPhone 12/13 mini (476 PPI) and iPhone X/XS/11 Pro (458 PPI)
      // Pick the first as initial estimate and explicitly warn user to disambiguate or calibrate.
      const primary = matches[0];
      return {
        pxPerMm: pxPerMmFromPhysicalWidth(shortEdge, longEdge, primary.physicalWidthMm),
        confidence: 'ambiguous',
        matchedDevices: matches,
        detectedLabel: matches.map((m) => m.name).join(' / '),
        platform,
        warning: 'ambiguous_model',
      };
    }

    // Unrecognized iOS viewport (often caused by Display Zoom or iPad)
    const fallbackPpi = dpr >= 3 ? 460 : dpr >= 2 ? 326 : 163;
    return {
      pxPerMm: fallbackPpi / dpr / MM_PER_INCH,
      confidence: 'estimated',
      matchedDevices: [],
      detectedLabel: `iOS (${shortEdge}×${longEdge} @${dpr}x)`,
      platform,
      warning: 'display_zoom_possible',
    };
  }

  // 3. Android fallback without matched model code
  if (platform === 'android') {
    return {
      pxPerMm: DEFAULT_MOBILE_PX_PER_MM,
      confidence: 'estimated',
      matchedDevices: [],
      detectedLabel: env.modelHint
        ? `Android (${env.modelHint})`
        : `Android (${shortEdge}×${longEdge} @${dpr.toFixed(2)}x)`,
      platform,
      warning: 'estimated_dpi',
    };
  }

  // 4. Desktop browser fallback (96 CSS DPI reference)
  return {
    pxPerMm: DEFAULT_DESKTOP_PX_PER_MM,
    confidence: 'estimated',
    matchedDevices: [],
    detectedLabel: `Desktop (${shortEdge}×${longEdge} @${dpr.toFixed(1)}x)`,
    platform,
    warning: 'estimated_dpi',
  };
}

interface NavigatorUAData {
  getHighEntropyValues?: (hints: string[]) => Promise<{ model?: string }>;
}

/**
 * Reads browser environment including Chromium User-Agent Client Hints `model` when available.
 */
export async function probeBrowserEnvironment(): Promise<DeviceEnvironment> {
  let modelHint: string | undefined;
  try {
    const nav = navigator as Navigator & { userAgentData?: NavigatorUAData };
    if (nav.userAgentData?.getHighEntropyValues) {
      const hints = await nav.userAgentData.getHighEntropyValues(['model']);
      if (hints.model) {
        modelHint = hints.model;
      }
    }
  } catch {
    // Ignore privacy/permission errors and proceed with screen heuristics
  }

  return {
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    devicePixelRatio: window.devicePixelRatio || 1,
    userAgent: navigator.userAgent,
    modelHint,
  };
}
