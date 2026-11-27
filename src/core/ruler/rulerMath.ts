import { MM_PER_INCH } from '../calibration/detectDevice';

export type LengthUnit = 'mm' | 'cm' | 'in';
export type RulerCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export type RulerEdgeMode = 'L' | 'long' | 'short';
export type LabelRotation = 0 | 90 | 180 | 270;

export interface RulerAxisState {
  /** Scale shift in mm (0 means 0 starts at origin edge; negative puts 0 inside screen; positive scrolls 0 off-screen). */
  scrollOffsetMm: number;
  /** +1 increases along pixel axis; -1 flips scale direction. */
  direction: 1 | -1;
}

export interface RulerOffsetState {
  /** Known object base length in mm entered manually (e.g., 150 mm). */
  manualBaseMm: number;
  /** History of chained screen-length increments in mm for Undo support. */
  chainStepsMm: number[];
}

export function getTotalBaseOffsetMm(offset: RulerOffsetState): number {
  const chainSum = offset.chainStepsMm.reduce((acc, step) => acc + step, 0);
  return offset.manualBaseMm + chainSum;
}

export function addChainStep(offset: RulerOffsetState, stepMm: number): RulerOffsetState {
  if (!Number.isFinite(stepMm) || stepMm <= 0) return offset;
  return {
    ...offset,
    chainStepsMm: [...offset.chainStepsMm, roundTo(stepMm, 2)],
  };
}

export function undoChainStep(offset: RulerOffsetState): RulerOffsetState {
  if (offset.chainStepsMm.length === 0) return offset;
  return {
    ...offset,
    chainStepsMm: offset.chainStepsMm.slice(0, -1),
  };
}

export function resetOffsets(): RulerOffsetState {
  return { manualBaseMm: 0, chainStepsMm: [] };
}

/**
 * Converts a pixel coordinate along a ruler edge into its physical reading in mm,
 * accounting for direction, scroll offset, and known-object base/chained offsets.
 */
export function pxToReadingMm(
  px: number,
  edgeLengthPx: number,
  pxPerMm: number,
  axis: RulerAxisState,
  baseOffsetMm: number,
): number {
  const distanceFromOriginMm =
    axis.direction === 1 ? px / pxPerMm : (edgeLengthPx - px) / pxPerMm;
  return baseOffsetMm + axis.scrollOffsetMm + distanceFromOriginMm;
}

/**
 * Inverse of pxToReadingMm: converts a physical reading in mm to pixel position along the edge.
 */
export function readingMmToPx(
  readingMm: number,
  edgeLengthPx: number,
  pxPerMm: number,
  axis: RulerAxisState,
  baseOffsetMm: number,
): number {
  const distanceFromOriginMm = readingMm - baseOffsetMm - axis.scrollOffsetMm;
  return axis.direction === 1
    ? distanceFromOriginMm * pxPerMm
    : edgeLengthPx - distanceFromOriginMm * pxPerMm;
}

/**
 * Computes scrollOffsetMm so that `0` (plus any baseOffsetMm) sits right at the middle of the edge.
 */
export function computeCenterZeroScrollMm(edgeLengthPx: number, pxPerMm: number): number {
  return -(edgeLengthPx / pxPerMm) / 2;
}

/**
 * Applies a pointer drag delta (in pixels) along the ruler track so the scale moves
 * naturally underneath the user's finger.
 */
export function applyScrollDragMm(
  currentScrollMm: number,
  deltaPx: number,
  pxPerMm: number,
  direction: 1 | -1,
): number {
  // Dragging in the +px direction shifts visible scale numbers downward if direction is +1
  const deltaMm = deltaPx / pxPerMm;
  return direction === 1 ? currentScrollMm - deltaMm : currentScrollMm + deltaMm;
}

export function convertMmToUnit(mm: number, unit: LengthUnit): number {
  switch (unit) {
    case 'mm':
      return mm;
    case 'cm':
      return mm / 10;
    case 'in':
      return mm / MM_PER_INCH;
  }
}

export function convertUnitToMm(value: number, unit: LengthUnit): number {
  switch (unit) {
    case 'mm':
      return value;
    case 'cm':
      return value * 10;
    case 'in':
      return value * MM_PER_INCH;
  }
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

/**
 * Formats an inch measurement as a reduced fraction to the nearest 1/16".
 * Example: 1.375 -> `1 3/8"`, -0.25 -> `-1/4"`.
 */
export function formatFractionalInches(inches: number): string {
  const sign = inches < 0 ? '-' : '';
  const abs = Math.abs(inches);
  const sixteenths = Math.round(abs * 16);
  const whole = Math.floor(sixteenths / 16);
  const rem = sixteenths % 16;

  if (rem === 0) {
    return `${sign}${whole}"`;
  }
  const divisor = gcd(rem, 16);
  const num = rem / divisor;
  const den = 16 / divisor;
  return whole > 0 ? `${sign}${whole} ${num}/${den}"` : `${sign}${num}/${den}"`;
}

export function formatLength(mm: number, unit: LengthUnit): string {
  if (!Number.isFinite(mm)) return '—';
  switch (unit) {
    case 'mm':
      return `${mm.toFixed(1)} mm`;
    case 'cm':
      return `${(mm / 10).toFixed(2)} cm`;
    case 'in': {
      const inches = mm / MM_PER_INCH;
      return `${inches.toFixed(2)}" (${formatFractionalInches(inches)})`;
    }
  }
}

export interface RulerTick {
  px: number;
  valueMm: number;
  level: 'major' | 'medium' | 'minor';
  label?: string;
}

/**
 * Generates crisp visible ticks along an edge for either metric (1mm / 5mm / 10mm)
 * or imperial (1/16" / 1/4" / 1/2" / 1") scales.
 */
export function generateVisibleTicks(
  edgeLengthPx: number,
  pxPerMm: number,
  axis: RulerAxisState,
  baseOffsetMm: number,
  unit: LengthUnit,
): RulerTick[] {
  if (edgeLengthPx <= 0 || pxPerMm <= 0) return [];

  const startVal = pxToReadingMm(0, edgeLengthPx, pxPerMm, axis, baseOffsetMm);
  const endVal = pxToReadingMm(edgeLengthPx, edgeLengthPx, pxPerMm, axis, baseOffsetMm);
  const minMm = Math.min(startVal, endVal);
  const maxMm = Math.max(startVal, endVal);

  const ticks: RulerTick[] = [];

  if (unit === 'in') {
    const stepMm = MM_PER_INCH / 16; // 1/16 inch
    const firstIndex = Math.floor(minMm / stepMm);
    const lastIndex = Math.ceil(maxMm / stepMm);

    for (let idx = firstIndex; idx <= lastIndex; idx++) {
      const valueMm = idx * stepMm;
      const px = readingMmToPx(valueMm, edgeLengthPx, pxPerMm, axis, baseOffsetMm);
      if (px < -1 || px > edgeLengthPx + 1) continue;

      const mod = ((idx % 16) + 16) % 16;
      let level: RulerTick['level'] = 'minor';
      let label: string | undefined;

      if (mod === 0) {
        level = 'major';
        label = `${idx / 16}"`;
      } else if (mod === 8) {
        level = 'medium';
        label = '½';
      } else if (mod % 4 === 0) {
        level = 'medium';
      }

      ticks.push({ px, valueMm, level, label });
    }
    return ticks;
  }

  // Metric (mm / cm): 1 mm minor, 5 mm medium, 10 mm major
  const firstMm = Math.floor(minMm);
  const lastMm = Math.ceil(maxMm);

  for (let mm = firstMm; mm <= lastMm; mm++) {
    const px = readingMmToPx(mm, edgeLengthPx, pxPerMm, axis, baseOffsetMm);
    if (px < -1 || px > edgeLengthPx + 1) continue;

    const mod10 = ((mm % 10) + 10) % 10;
    let level: RulerTick['level'] = 'minor';
    let label: string | undefined;

    if (mod10 === 0) {
      level = 'major';
      label = unit === 'cm' ? `${mm / 10}` : `${mm}`;
    } else if (mod10 === 5) {
      level = 'medium';
    }

    ticks.push({ px, valueMm: mm, level, label });
  }

  return ticks;
}

export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
