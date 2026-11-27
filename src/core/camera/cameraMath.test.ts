import { describe, expect, it } from 'vitest';
import {
  betaToCameraElevationDeg,
  computeReferenceMeasurement,
  computeTrigoDistanceMeters,
  computeTrigoHeightMeters,
  distance3DMeters,
} from './cameraMath';

describe('camera measurement math engine', () => {
  it('computes target length accurately from a coplanar reference object', () => {
    // 1000x1000 image. Reference credit card (85.6 mm) spans 200 px horizontally.
    // Target spans 400 px vertically -> should be exactly 171.2 mm.
    const res = computeReferenceMeasurement(
      { x: 0.1, y: 0.5 },
      { x: 0.3, y: 0.5 },
      85.6,
      { x: 0.5, y: 0.2 },
      { x: 0.5, y: 0.6 },
      1000,
      1000,
    );

    expect(res).not.toBeNull();
    expect(res!.targetLengthMm).toBeCloseTo(171.2, 3);
    expect(res!.pxPerMm).toBeCloseTo(200 / 85.6, 4);
  });

  it('rejects degenerate reference segments', () => {
    expect(
      computeReferenceMeasurement(
        { x: 0.5, y: 0.5 },
        { x: 0.5, y: 0.5 },
        85.6,
        { x: 0.1, y: 0.1 },
        { x: 0.9, y: 0.1 },
        1000,
        1000,
      ),
    ).toBeNull();
  });

  it('solves trigonometric floor distance and object height (shorter & taller than camera)', () => {
    // Phone at 1.5 m eye height aiming 45° down (beta = 45°) -> distance = 1.5 m
    const baseElev = betaToCameraElevationDeg(45);
    expect(baseElev).toBe(-45);
    const dist = computeTrigoDistanceMeters(1.5, baseElev);
    expect(dist).toBeCloseTo(1.5, 4);

    // Tall object: aiming 45° up (beta = 135°) at 1.5 m away -> height = 1.5 + 1.5*tan(45°) = 3.0 m
    const tallHeight = computeTrigoHeightMeters(1.5, dist!, betaToCameraElevationDeg(135));
    expect(tallHeight).toBeCloseTo(3.0, 4);

    // Eye-level object: aiming horizontal (beta = 90°) -> height = 1.5 m
    const eyeHeight = computeTrigoHeightMeters(1.5, dist!, betaToCameraElevationDeg(90));
    expect(eyeHeight).toBeCloseTo(1.5, 4);

    // Shorter object: aiming down -26.565° (tan = -0.5) at 1.5 m away -> height = 1.5 - 0.75 = 0.75 m
    const shortHeight = computeTrigoHeightMeters(1.5, dist!, -Math.atan(0.5) * (180 / Math.PI));
    expect(shortHeight).toBeCloseTo(0.75, 3);
  });

  it('rejects invalid upward angles for floor distance', () => {
    expect(computeTrigoDistanceMeters(1.5, 5)).toBeNull();
    expect(computeTrigoDistanceMeters(1.5, 0)).toBeNull();
    expect(computeTrigoDistanceMeters(1.5, -88)).toBeNull();
  });

  it('computes 3D Euclidean distance for WebXR points', () => {
    expect(distance3DMeters({ x: 0, y: 0, z: 0 }, { x: 0.3, y: 0.4, z: 0 })).toBeCloseTo(0.5, 5);
  });
});
