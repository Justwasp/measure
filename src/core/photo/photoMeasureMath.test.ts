import { describe, expect, it } from 'vitest';
import {
  applyOrthoSnap,
  canvasToNormalized,
  computeImageViewport,
  computePhotoMeasurement,
  computePlaneHomography,
  createPlaneProjector,
  formatPhotoArea,
  formatPhotoLength,
  normalizedToCanvas,
  photoUnitToMm,
  projectPointHomography,
  type PhotoQuad,
} from './photoMeasureMath';

describe('Photo / Blueprint Studio math & 4-point homography', () => {
  it('preserves image aspect ratio cleanly across canvas <-> normalized transforms with zoom and pan', () => {
    // Wide 16:9 image inside a 400x400 square canvas
    const vp = computeImageViewport(1600, 900, 400, 400, 2, 20, -10);
    expect(vp.drawW / vp.drawH).toBeCloseTo(16 / 9, 5);

    const pt = { x: 0.25, y: 0.75 };
    const canvasPt = normalizedToCanvas(pt, vp);
    const roundTrip = canvasToNormalized(canvasPt, vp);
    expect(roundTrip.x).toBeCloseTo(pt.x, 6);
    expect(roundTrip.y).toBeCloseTo(pt.y, 6);
  });

  it('measures car dimensions accurately from a wheel diameter reference (2D line mode)', () => {
    // 1000x500 blueprint: scale = 0.2 px/mm (1 meter = 200 px)
    // Wheel diameter = 660 mm -> 132 px
    // Car overall bounding box = 4520 mm x 1460 mm -> 904 px x 292 px
    const projector = createPlaneProjector({
      mode: 'line',
      imgW: 1000,
      imgH: 500,
      refStart: { x: 0.2, y: 0.7 },
      refEnd: { x: 0.332, y: 0.7 },
      refLengthMm: 660,
      refQuad: {
        tl: { x: 0, y: 0 },
        tr: { x: 1, y: 0 },
        br: { x: 1, y: 1 },
        bl: { x: 0, y: 1 },
      },
      refQuadWidthMm: 1000,
      refQuadHeightMm: 1000,
    });

    expect(projector).not.toBeNull();
    const box = computePhotoMeasurement(
      {
        kind: 'box',
        start: { x: 0.05, y: 0.1 },
        end: { x: 0.954, y: 0.684 },
      },
      projector,
    );

    expect(box).not.toBeNull();
    expect(box?.kind).toBe('box');
    if (box && box.kind === 'box') {
      expect(box.widthMm).toBeCloseTo(4520, 1);
      expect(box.heightMm).toBeCloseTo(1460, 1);
      expect(box.diagonalMm).toBeCloseTo(Math.hypot(4520, 1460), 1);
    }
  });

  it('recovers true physical lengths on a perspective-foreshortened wall via 4-point homography', () => {
    // Synthetic pinhole perspective projection of a 3D wall (X along wall in mm, Y down in mm)
    // Camera sits at angle so X foreshortens with depth Z = 3500 + 0.45 * X
    const imgW = 1000;
    const imgH = 700;
    const focal = 900;
    const projectWallToNormalized = (X: number, Y: number) => {
      const Z = 3500 + 0.45 * X;
      const u = 180 + (focal * (X * 0.9)) / Z;
      const v = 120 + (focal * Y) / Z;
      return { x: u / imgW, y: v / imgH };
    };

    // Reference object on the angled wall: standard door 800 mm x 2000 mm at X in [0..800], Y in [0..2000]
    const doorQuad: PhotoQuad = {
      tl: projectWallToNormalized(0, 0),
      tr: projectWallToNormalized(800, 0),
      br: projectWallToNormalized(800, 2000),
      bl: projectWallToNormalized(0, 2000),
    };

    const H = computePlaneHomography(doorQuad, 800, 2000, imgW, imgH);
    expect(H).not.toBeNull();

    // Verify all 4 corners map back to exact door dimensions
    const brWorld = projectPointHomography(doorQuad.br, H!, imgW, imgH);
    expect(brWorld!.x).toBeCloseTo(800, 2);
    expect(brWorld!.y).toBeCloseTo(2000, 2);

    // Measure a wall segment FAR down the angled perspective wall: X from 1200 mm to 3700 mm (= 2500 mm wide!)
    const projector = createPlaneProjector({
      mode: 'perspective',
      imgW,
      imgH,
      refStart: doorQuad.tl,
      refEnd: doorQuad.tr,
      refLengthMm: 800,
      refQuad: doorQuad,
      refQuadWidthMm: 800,
      refQuadHeightMm: 2000,
    });

    const wallStart = projectWallToNormalized(1200, 500);
    const wallEnd = projectWallToNormalized(3700, 500);
    const wallLine = computePhotoMeasurement(
      { kind: 'line', start: wallStart, end: wallEnd },
      projector,
    );

    expect(wallLine).not.toBeNull();
    expect(wallLine?.kind).toBe('line');
    if (wallLine && wallLine.kind === 'line') {
      // Exact recovery of 2500 mm despite heavy perspective foreshortening!
      expect(wallLine.lengthMm).toBeCloseTo(2500, 1);
    }
  });

  it('rejects degenerate collinear homography quads cleanly', () => {
    const degenerate: PhotoQuad = {
      tl: { x: 0.1, y: 0.5 },
      tr: { x: 0.3, y: 0.5 },
      br: { x: 0.6, y: 0.5 },
      bl: { x: 0.9, y: 0.5 },
    };
    expect(computePlaneHomography(degenerate, 800, 2000, 1000, 700)).toBeNull();
  });

  it('snaps endpoints cleanly to horizontal or vertical in ortho mode', () => {
    const snappedH = applyOrthoSnap({ x: 0.2, y: 0.4 }, { x: 0.7, y: 0.43 }, 1000, 1000);
    expect(snappedH).toEqual({ x: 0.7, y: 0.4 });

    const snappedV = applyOrthoSnap({ x: 0.2, y: 0.4 }, { x: 0.22, y: 0.85 }, 1000, 1000);
    expect(snappedV).toEqual({ x: 0.2, y: 0.85 });
  });

  it('converts and formats mm / cm / m / in and areas cleanly', () => {
    expect(photoUnitToMm(2.7, 'm')).toBe(2700);
    expect(photoUnitToMm(27, 'in')).toBeCloseTo(685.8, 2);
    expect(formatPhotoLength(4520, 'm')).toBe('4.52 m');
    expect(formatPhotoLength(660, 'cm')).toBe('66.0 cm');
    expect(formatPhotoLength(85.6, 'mm')).toBe('85.6 mm');
    expect(formatPhotoArea(1_600_000, 'm')).toBe('1.60 m²');
    expect(formatPhotoArea(4620, 'mm')).toBe('46.2 cm²');
  });
});
