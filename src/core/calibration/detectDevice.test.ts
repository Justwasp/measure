import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DESKTOP_PX_PER_MM,
  detectDeviceCalibration,
  pxPerMmFromPhysicalWidth,
  pxPerMmFromReference,
} from './detectDevice';

describe('calibration & device detection engine', () => {
  it('accurately detects iPhone 15 Pro from screen dimensions and DPR', () => {
    const result = detectDeviceCalibration({
      screenWidth: 393,
      screenHeight: 852,
      devicePixelRatio: 3,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15',
    });

    expect(result.platform).toBe('ios');
    expect(result.confidence).toBe('auto');
    expect(result.matchedDevices).toHaveLength(1);
    expect(result.matchedDevices[0].id).toBe('iphone-14-pro-15-16');
    // 393 / 65.10 mm ≈ 6.037 px/mm
    expect(result.pxPerMm).toBeCloseTo(6.037, 2);
  });

  it('flags ambiguous iOS footprint (375x812 @3x: mini vs X/XS/11 Pro)', () => {
    const result = detectDeviceCalibration({
      screenWidth: 375,
      screenHeight: 812,
      devicePixelRatio: 3,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)',
    });

    expect(result.confidence).toBe('ambiguous');
    expect(result.warning).toBe('ambiguous_model');
    expect(result.matchedDevices.length).toBeGreaterThanOrEqual(2);
  });

  it('accurately detects Android model via Client Hints regardless of DPI scaling', () => {
    const defaultScale = detectDeviceCalibration({
      screenWidth: 412,
      screenHeight: 915,
      devicePixelRatio: 3.5,
      userAgent: 'Mozilla/5.0 (Linux; Android 15; K) AppleWebKit/537.36 Chrome/135.0.0.0 Mobile',
      modelHint: 'SM-S928B',
    });

    const zoomedScale = detectDeviceCalibration({
      screenWidth: 360,
      screenHeight: 800,
      devicePixelRatio: 4,
      userAgent: 'Mozilla/5.0 (Linux; Android 15; K) AppleWebKit/537.36 Chrome/135.0.0.0 Mobile',
      modelHint: 'SM-S928B',
    });

    expect(defaultScale.confidence).toBe('auto');
    expect(defaultScale.detectedLabel).toContain('Galaxy S24 Ultra');
    // Both scales derive exact physical width (72.3 mm)
    expect(412 / defaultScale.pxPerMm).toBeCloseTo(72.3, 1);
    expect(360 / zoomedScale.pxPerMm).toBeCloseTo(72.3, 1);
  });

  it('warns about possible Display Zoom on unrecognized iOS screen size', () => {
    const result = detectDeviceCalibration({
      screenWidth: 320,
      screenHeight: 693,
      devicePixelRatio: 3,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X)',
    });

    expect(result.confidence).toBe('estimated');
    expect(result.warning).toBe('display_zoom_possible');
  });

  it('falls back cleanly to 96 DPI reference on desktop browsers', () => {
    const result = detectDeviceCalibration({
      screenWidth: 1440,
      screenHeight: 900,
      devicePixelRatio: 2,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 Chrome/135.0',
    });

    expect(result.platform).toBe('desktop');
    expect(result.confidence).toBe('estimated');
    expect(result.pxPerMm).toBeCloseTo(DEFAULT_DESKTOP_PX_PER_MM, 4);
  });

  it('computes calibration from a known physical reference (ISO bank card)', () => {
    // Bank card = 85.6 mm rendered at 516.7 CSS px -> ~6.036 px/mm
    const pxPerMm = pxPerMmFromReference(516.7, 85.6);
    expect(pxPerMm).toBeCloseTo(6.0362, 3);
    expect(() => pxPerMmFromReference(0, 85.6)).toThrow();
    expect(pxPerMmFromPhysicalWidth(393, 852, 65.1)).toBeCloseTo(6.0369, 3);
  });
});
