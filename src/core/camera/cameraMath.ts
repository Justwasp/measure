export interface Point2D {
  /** Normalized image coordinate X in [0, 1]. */
  x: number;
  /** Normalized image coordinate Y in [0, 1]. */
  y: number;
}

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface ReferenceMeasurementResult {
  pxPerMm: number;
  targetLengthMm: number;
  referenceLengthPx: number;
  targetLengthPx: number;
}

/**
 * Computes pixel Euclidean distance between two normalized points on an image of size (width, height).
 */
export function normalizedDistancePx(
  p1: Point2D,
  p2: Point2D,
  imageWidth: number,
  imageHeight: number,
): number {
  const dx = (p2.x - p1.x) * imageWidth;
  const dy = (p2.y - p1.y) * imageHeight;
  return Math.hypot(dx, dy);
}

/**
 * Computes real-world length of a target segment from a known coplanar reference segment.
 */
export function computeReferenceMeasurement(
  refStart: Point2D,
  refEnd: Point2D,
  refLengthMm: number,
  targetStart: Point2D,
  targetEnd: Point2D,
  imageWidth: number,
  imageHeight: number,
): ReferenceMeasurementResult | null {
  if (refLengthMm <= 0 || imageWidth <= 0 || imageHeight <= 0) return null;

  const referenceLengthPx = normalizedDistancePx(refStart, refEnd, imageWidth, imageHeight);
  if (referenceLengthPx < 1) return null;

  const targetLengthPx = normalizedDistancePx(targetStart, targetEnd, imageWidth, imageHeight);
  const pxPerMm = referenceLengthPx / refLengthMm;
  const targetLengthMm = targetLengthPx / pxPerMm;

  return {
    pxPerMm,
    targetLengthMm,
    referenceLengthPx,
    targetLengthPx,
  };
}

/**
 * Converts portrait DeviceOrientation `beta` (90° = vertical camera pointing straight ahead)
 * into optical elevation angle in degrees (negative = aiming down at floor, positive = aiming up).
 */
export function betaToCameraElevationDeg(betaDeg: number): number {
  return betaDeg - 90;
}

/**
 * Computes horizontal distance on a flat floor from camera height and downward elevation angle.
 * Requires elevationDeg in [-85°, -1°] (looking downward toward the ground).
 */
export function computeTrigoDistanceMeters(
  cameraHeightM: number,
  baseElevationDeg: number,
): number | null {
  if (!Number.isFinite(cameraHeightM) || cameraHeightM <= 0) return null;
  const depressionDeg = -baseElevationDeg;
  if (depressionDeg < 1 || depressionDeg > 85) return null;

  const rad = (depressionDeg * Math.PI) / 180;
  return cameraHeightM / Math.tan(rad);
}

/**
 * Computes object height standing on the same ground plane given horizontal distance,
 * camera height, and elevation angle to the top of the object (negative, zero, or positive).
 */
export function computeTrigoHeightMeters(
  cameraHeightM: number,
  distanceM: number,
  topElevationDeg: number,
): number | null {
  if (
    !Number.isFinite(cameraHeightM) ||
    !Number.isFinite(distanceM) ||
    cameraHeightM <= 0 ||
    distanceM <= 0
  ) {
    return null;
  }
  if (topElevationDeg <= -85 || topElevationDeg >= 85) return null;

  const rad = (topElevationDeg * Math.PI) / 180;
  const heightM = cameraHeightM + distanceM * Math.tan(rad);
  return heightM > 0 ? heightM : 0;
}

/**
 * 3D Euclidean distance in meters for WebXR Hit-Test world coordinates.
 */
export function distance3DMeters(a: Point3D, b: Point3D): number {
  return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
}
