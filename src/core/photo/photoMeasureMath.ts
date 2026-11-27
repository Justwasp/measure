import { MM_PER_INCH } from '../calibration/detectDevice';
import type { Point2D } from '../camera/cameraMath';

export type PhotoUnit = 'mm' | 'cm' | 'm' | 'in';
export type PhotoCalibrationMode = 'line' | 'perspective';
export type PhotoMeasurementKind = 'line' | 'box';

export interface PhotoQuad {
  tl: Point2D;
  tr: Point2D;
  br: Point2D;
  bl: Point2D;
}

export interface PhotoMeasurementItem {
  id: string;
  label: string;
  kind: PhotoMeasurementKind;
  start: Point2D;
  end: Point2D;
  color: string;
}

export interface ImageViewportTransform {
  drawX: number;
  drawY: number;
  drawW: number;
  drawH: number;
  scale: number;
}

export interface ComputedLineMetrics {
  kind: 'line';
  lengthMm: number;
  dxMm: number;
  dyMm: number;
  angleDeg: number;
}

export interface ComputedBoxMetrics {
  kind: 'box';
  widthMm: number;
  heightMm: number;
  diagonalMm: number;
  areaMm2: number;
}

export type ComputedPhotoMetrics = ComputedLineMetrics | ComputedBoxMetrics;

export interface PhotoReferencePreset {
  id: string;
  labelEn: string;
  labelRu: string;
  lengthMm: number;
  heightMm?: number;
  defaultUnit: PhotoUnit;
}

export const PHOTO_STUDIO_PRESETS: readonly PhotoReferencePreset[] = [
  {
    id: 'car-tire',
    labelEn: 'Car Wheel / Tire OD (660 mm)',
    labelRu: 'Колесо авто в сборе (660 мм)',
    lengthMm: 660,
    defaultUnit: 'm',
  },
  {
    id: 'car-rim-17',
    labelEn: '17" Wheel Rim (431.8 mm)',
    labelRu: 'Диск колеса R17 (431.8 мм)',
    lengthMm: 431.8,
    defaultUnit: 'm',
  },
  {
    id: 'ceiling',
    labelEn: 'Room Ceiling Height (2.70 m)',
    labelRu: 'Высота потолка (2.70 м)',
    lengthMm: 2700,
    defaultUnit: 'm',
  },
  {
    id: 'door',
    labelEn: 'Standard Door (0.80 × 2.00 m)',
    labelRu: 'Дверной проём (0.80 × 2.00 м)',
    lengthMm: 800,
    heightMm: 2000,
    defaultUnit: 'm',
  },
  {
    id: 'monitor-27',
    labelEn: '27" Monitor 16:9 (597 × 336 mm)',
    labelRu: 'Монитор 27" 16:9 (597 × 336 мм)',
    lengthMm: 597,
    heightMm: 336,
    defaultUnit: 'cm',
  },
  {
    id: 'a4',
    labelEn: 'A4 Sheet (210 × 297 mm)',
    labelRu: 'Лист A4 (210 × 297 мм)',
    lengthMm: 210,
    heightMm: 297,
    defaultUnit: 'mm',
  },
  {
    id: 'iso-card',
    labelEn: 'Bank Card (85.6 × 54.0 mm)',
    labelRu: 'Банковская карта (85.6 × 54.0 мм)',
    lengthMm: 85.6,
    heightMm: 53.98,
    defaultUnit: 'mm',
  },
  {
    id: 'custom',
    labelEn: 'Custom Known Dimension',
    labelRu: 'Свой известный размер',
    lengthMm: 1000,
    heightMm: 1000,
    defaultUnit: 'cm',
  },
];

export const MEASUREMENT_PALETTE = [
  '#ff6b1a',
  '#f5b726',
  '#4dabf7',
  '#c084fc',
  '#2fd674',
  '#ff5c8a',
] as const;

/**
 * Computes exact aspect-ratio-preserving (`contain`) image draw bounds inside a canvas,
 * factoring in user zoom and pan offsets.
 */
export function computeImageViewport(
  imgW: number,
  imgH: number,
  canvasW: number,
  canvasH: number,
  zoom = 1,
  panX = 0,
  panY = 0,
): ImageViewportTransform {
  if (imgW <= 0 || imgH <= 0 || canvasW <= 0 || canvasH <= 0) {
    return { drawX: 0, drawY: 0, drawW: 0, drawH: 0, scale: 1 };
  }
  const safeZoom = Math.max(0.5, Math.min(8, zoom));
  const baseScale = Math.min(canvasW / imgW, canvasH / imgH);
  const scale = baseScale * safeZoom;
  const drawW = imgW * scale;
  const drawH = imgH * scale;
  const drawX = (canvasW - drawW) / 2 + panX;
  const drawY = (canvasH - drawH) / 2 + panY;

  return { drawX, drawY, drawW, drawH, scale };
}

export function normalizedToCanvas(p: Point2D, vp: ImageViewportTransform): Point2D {
  return {
    x: vp.drawX + p.x * vp.drawW,
    y: vp.drawY + p.y * vp.drawH,
  };
}

export function canvasToNormalized(p: Point2D, vp: ImageViewportTransform): Point2D {
  if (vp.drawW <= 0 || vp.drawH <= 0) return { x: 0.5, y: 0.5 };
  return {
    x: (p.x - vp.drawX) / vp.drawW,
    y: (p.y - vp.drawY) / vp.drawH,
  };
}

/**
 * Snaps `moving` point to pure horizontal (0°) or vertical (90°) relative to `anchor`
 * in native image pixel space.
 */
export function applyOrthoSnap(
  anchor: Point2D,
  moving: Point2D,
  imgW: number,
  imgH: number,
): Point2D {
  const dxPx = Math.abs((moving.x - anchor.x) * imgW);
  const dyPx = Math.abs((moving.y - anchor.y) * imgH);
  if (dxPx >= dyPx) {
    return { x: moving.x, y: anchor.y };
  }
  return { x: anchor.x, y: moving.y };
}

export function photoUnitToMm(value: number, unit: PhotoUnit): number {
  switch (unit) {
    case 'mm':
      return value;
    case 'cm':
      return value * 10;
    case 'm':
      return value * 1000;
    case 'in':
      return value * MM_PER_INCH;
  }
}

export function mmToPhotoUnit(mm: number, unit: PhotoUnit): number {
  switch (unit) {
    case 'mm':
      return mm;
    case 'cm':
      return mm / 10;
    case 'm':
      return mm / 1000;
    case 'in':
      return mm / MM_PER_INCH;
  }
}

export function formatPhotoLength(mm: number, unit: PhotoUnit): string {
  if (!Number.isFinite(mm)) return '—';
  switch (unit) {
    case 'mm':
      return `${mm.toFixed(1)} mm`;
    case 'cm':
      return `${(mm / 10).toFixed(1)} cm`;
    case 'm':
      return `${(mm / 1000).toFixed(2)} m`;
    case 'in':
      return `${(mm / MM_PER_INCH).toFixed(2)}"`;
  }
}

export function formatPhotoArea(areaMm2: number, unit: PhotoUnit): string {
  if (!Number.isFinite(areaMm2) || areaMm2 < 0) return '—';
  if (unit === 'm' || areaMm2 >= 100_000) {
    return `${(areaMm2 / 1_000_000).toFixed(2)} m²`;
  }
  if (unit === 'in') {
    return `${(areaMm2 / (MM_PER_INCH * MM_PER_INCH)).toFixed(1)} in²`;
  }
  return `${(areaMm2 / 100).toFixed(1)} cm²`;
}

/**
 * 3x3 Projective Homography matrix stored row-major as 9 numbers:
 * [h0, h1, h2, h3, h4, h5, h6, h7, 1]
 */
export type HomographyMatrix = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

function solveLinearSystem8x8(A: number[][], b: number[]): number[] | null {
  const n = 8;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    // Partial pivoting
    let pivotRow = col;
    let maxAbs = Math.abs(M[col][col]);
    for (let r = col + 1; r < n; r++) {
      const v = Math.abs(M[r][col]);
      if (v > maxAbs) {
        maxAbs = v;
        pivotRow = r;
      }
    }
    if (maxAbs < 1e-10) return null;

    if (pivotRow !== col) {
      const tmp = M[col];
      M[col] = M[pivotRow];
      M[pivotRow] = tmp;
    }

    const pivot = M[col][col];
    for (let c = col; c <= n; c++) {
      M[col][c] /= pivot;
    }

    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r][col];
      if (factor === 0) continue;
      for (let c = col; c <= n; c++) {
        M[r][c] -= factor * M[col][c];
      }
    }
  }

  return M.map((row) => row[n]);
}

/**
 * Computes a 3x3 projective homography mapping native image pixels (u, v)
 * from the 4 reference quad corners (tl, tr, br, bl) onto metric plane coordinates:
 * tl -> (0, 0), tr -> (refWidthMm, 0), br -> (refWidthMm, refHeightMm), bl -> (0, refHeightMm).
 */
export function computePlaneHomography(
  quad: PhotoQuad,
  refWidthMm: number,
  refHeightMm: number,
  imgW: number,
  imgH: number,
): HomographyMatrix | null {
  if (refWidthMm <= 0 || refHeightMm <= 0 || imgW <= 0 || imgH <= 0) return null;

  const src: [number, number][] = [
    [quad.tl.x * imgW, quad.tl.y * imgH],
    [quad.tr.x * imgW, quad.tr.y * imgH],
    [quad.br.x * imgW, quad.br.y * imgH],
    [quad.bl.x * imgW, quad.bl.y * imgH],
  ];
  const dst: [number, number][] = [
    [0, 0],
    [refWidthMm, 0],
    [refWidthMm, refHeightMm],
    [0, refHeightMm],
  ];

  const A: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i++) {
    const [u, v] = src[i];
    const [X, Y] = dst[i];
    A.push([u, v, 1, 0, 0, 0, -u * X, -v * X]);
    b.push(X);
    A.push([0, 0, 0, u, v, 1, -u * Y, -v * Y]);
    b.push(Y);
  }

  const sol = solveLinearSystem8x8(A, b);
  if (!sol || sol.some((v) => !Number.isFinite(v))) return null;

  return [sol[0], sol[1], sol[2], sol[3], sol[4], sol[5], sol[6], sol[7], 1];
}

/**
 * Projects a normalized image coordinate onto metric plane coordinates (mm) via homography.
 */
export function projectPointHomography(
  p: Point2D,
  H: HomographyMatrix,
  imgW: number,
  imgH: number,
): Point2D | null {
  const u = p.x * imgW;
  const v = p.y * imgH;
  const w = H[6] * u + H[7] * v + H[8];
  if (!Number.isFinite(w) || Math.abs(w) < 1e-6) return null;
  const x = (H[0] * u + H[1] * v + H[2]) / w;
  const y = (H[3] * u + H[4] * v + H[5]) / w;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

export interface PhotoPlaneCalibration {
  mode: PhotoCalibrationMode;
  imgW: number;
  imgH: number;
  /** Used when mode === 'line' */
  refStart: Point2D;
  refEnd: Point2D;
  refLengthMm: number;
  /** Used when mode === 'perspective' */
  refQuad: PhotoQuad;
  refQuadWidthMm: number;
  refQuadHeightMm: number;
}

export interface PlaneProjector {
  pxPerMm: number | null;
  toWorldMm: (p: Point2D) => Point2D | null;
}

/**
 * Builds a unified metric plane projector for either 2D single-line scaling or 4-point homography.
 */
export function createPlaneProjector(cal: PhotoPlaneCalibration): PlaneProjector | null {
  if (cal.imgW <= 0 || cal.imgH <= 0) return null;

  if (cal.mode === 'line') {
    if (cal.refLengthMm <= 0) return null;
    const refPx = Math.hypot(
      (cal.refEnd.x - cal.refStart.x) * cal.imgW,
      (cal.refEnd.y - cal.refStart.y) * cal.imgH,
    );
    if (refPx < 1) return null;
    const pxPerMm = refPx / cal.refLengthMm;
    return {
      pxPerMm,
      toWorldMm: (p: Point2D) => ({
        x: (p.x * cal.imgW) / pxPerMm,
        y: (p.y * cal.imgH) / pxPerMm,
      }),
    };
  }

  const H = computePlaneHomography(
    cal.refQuad,
    cal.refQuadWidthMm,
    cal.refQuadHeightMm,
    cal.imgW,
    cal.imgH,
  );
  if (!H) return null;

  return {
    pxPerMm: null,
    toWorldMm: (p: Point2D) => projectPointHomography(p, H, cal.imgW, cal.imgH),
  };
}

/**
 * Computes real-world metric dimensions for either a Line or a Bounding Box measurement.
 */
export function computePhotoMeasurement(
  item: Pick<PhotoMeasurementItem, 'kind' | 'start' | 'end'>,
  projector: PlaneProjector | null,
): ComputedPhotoMetrics | null {
  if (!projector) return null;
  const a = projector.toWorldMm(item.start);
  const b = projector.toWorldMm(item.end);
  if (!a || !b) return null;

  const dxMm = b.x - a.x;
  const dyMm = b.y - a.y;

  if (item.kind === 'line') {
    const lengthMm = Math.hypot(dxMm, dyMm);
    const angleDeg = (Math.atan2(dyMm, dxMm) * 180) / Math.PI;
    return {
      kind: 'line',
      lengthMm,
      dxMm,
      dyMm,
      angleDeg,
    };
  }

  const widthMm = Math.abs(dxMm);
  const heightMm = Math.abs(dyMm);
  const diagonalMm = Math.hypot(widthMm, heightMm);
  return {
    kind: 'box',
    widthMm,
    heightMm,
    diagonalMm,
    areaMm2: widthMm * heightMm,
  };
}
