export interface OrientationSample {
  /** Compass yaw 0..360 (degrees). */
  alpha: number;
  /** Front-to-back tilt -180..180 (degrees). 0 flat on table, 90 upright portrait. */
  beta: number;
  /** Left-to-right tilt -90..90 (degrees). */
  gamma: number;
}

export interface BullseyeReading {
  /** Normalized bubble X coordinate in [-1, 1]. */
  x: number;
  /** Normalized bubble Y coordinate in [-1, 1]. */
  y: number;
  /** Combined tilt magnitude in degrees. */
  totalTiltDeg: number;
  /** True when surface is level within tolerance (default 0.3°). */
  isLevel: boolean;
}

/**
 * Wraps any angle in degrees into the canonical (-180, 180] interval.
 */
export function normalizeAngle180(deg: number): number {
  let a = ((deg % 360) + 360) % 360;
  if (a > 180) a -= 360;
  return Object.is(a, -0) ? 0 : a;
}

/**
 * Circular exponential moving average (EMA) smoothing for angles in degrees.
 * Safely crosses the ±180° / 0° boundary without discontinuity spikes.
 */
export function smoothAngleDeg(prevDeg: number, nextDeg: number, alpha = 0.22): number {
  const clampedAlpha = Math.min(1, Math.max(0.01, alpha));
  const delta = normalizeAngle180(nextDeg - prevDeg);
  return normalizeAngle180(prevDeg + delta * clampedAlpha);
}

/**
 * Signed relative angle from a tared reference surface to the current surface, in (-180, 180].
 */
export function relativeAngleDeg(currentDeg: number, tareDeg: number): number {
  return normalizeAngle180(currentDeg - tareDeg);
}

/**
 * Computes slope grade as a percentage (rise/run × 100).
 * Returns null near vertical (±89.5° or steeper).
 */
export function angleToSlopePercent(deg: number): number | null {
  const normalized = Math.abs(normalizeAngle180(deg));
  const acute = normalized > 90 ? 180 - normalized : normalized;
  if (acute >= 89.5) return null;
  return Math.tan((acute * Math.PI) / 180) * 100;
}

/**
 * Computes architectural pitch ratio `1 : N` (run per 1 unit rise).
 * Returns null when effectively flat (< 0.1°) or vertical (>= 89.5°).
 */
export function angleToPitchRatio(deg: number): number | null {
  const normalized = Math.abs(normalizeAngle180(deg));
  const acute = normalized > 90 ? 180 - normalized : normalized;
  if (acute < 0.1 || acute >= 89.5) return null;
  return 1 / Math.tan((acute * Math.PI) / 180);
}

/**
 * Projects 2D flat-table tilt (beta, gamma) onto a clamped unit circle for the bullseye spirit level.
 */
export function computeBullseye(
  betaDeg: number,
  gammaDeg: number,
  maxTiltDeg = 15,
  levelToleranceDeg = 0.3,
): BullseyeReading {
  const totalTiltDeg = Math.hypot(betaDeg, gammaDeg);
  const scale = maxTiltDeg > 0 ? 1 / maxTiltDeg : 1 / 15;

  // Bubble floats opposite to tilt direction (towards the higher side, like a real spirit level)
  let x = -gammaDeg * scale;
  let y = -betaDeg * scale;

  const mag = Math.hypot(x, y);
  if (mag > 1) {
    x /= mag;
    y /= mag;
  }

  return {
    x: Object.is(x, -0) ? 0 : x,
    y: Object.is(y, -0) ? 0 : y,
    totalTiltDeg,
    isLevel: totalTiltDeg <= levelToleranceDeg,
  };
}
