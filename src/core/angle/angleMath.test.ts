import { describe, expect, it } from 'vitest';
import {
  angleToPitchRatio,
  angleToSlopePercent,
  computeBullseye,
  normalizeAngle180,
  relativeAngleDeg,
  smoothAngleDeg,
} from './angleMath';

describe('gyroscope & angle math engine', () => {
  it('normalizes arbitrary degrees into (-180, 180]', () => {
    expect(normalizeAngle180(0)).toBe(0);
    expect(normalizeAngle180(180)).toBe(180);
    expect(normalizeAngle180(-180)).toBe(180);
    expect(normalizeAngle180(190)).toBe(-170);
    expect(normalizeAngle180(-190)).toBe(170);
    expect(normalizeAngle180(540)).toBe(180);
  });

  it('smooths angles across the ±180° wrap boundary without jumping', () => {
    const smoothed = smoothAngleDeg(178, -178, 0.5);
    // Midpoint between 178° and -178° is 180° (NOT 0°!)
    expect(Math.abs(smoothed)).toBeCloseTo(180, 4);
  });

  it('computes relative tared angle between two surfaces across wrap boundaries', () => {
    expect(relativeAngleDeg(45, 15)).toBe(30);
    expect(relativeAngleDeg(-175, 175)).toBe(10);
    expect(relativeAngleDeg(175, -175)).toBe(-10);
  });

  it('converts angle to slope percent and pitch ratio accurately', () => {
    expect(angleToSlopePercent(45)).toBeCloseTo(100, 3);
    expect(angleToSlopePercent(0)).toBeCloseTo(0, 5);
    expect(angleToSlopePercent(90)).toBeNull();

    expect(angleToPitchRatio(45)).toBeCloseTo(1, 3);
    expect(angleToPitchRatio(0)).toBeNull();
    expect(angleToPitchRatio(90)).toBeNull();
  });

  it('computes clamped 2D bullseye coordinates and level tolerance', () => {
    const level = computeBullseye(0.1, -0.1);
    expect(level.isLevel).toBe(true);
    expect(level.totalTiltDeg).toBeCloseTo(Math.hypot(0.1, 0.1), 5);

    const steep = computeBullseye(30, 40, 15);
    expect(steep.isLevel).toBe(false);
    expect(Math.hypot(steep.x, steep.y)).toBeCloseTo(1, 5);
  });
});
