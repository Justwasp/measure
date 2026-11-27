import type { Point2D } from '../../core/camera/cameraMath';
import {
  MEASUREMENT_PALETTE,
  type PhotoCalibrationMode,
  type PhotoMeasurementItem,
  type PhotoQuad,
  type PhotoUnit,
} from '../../core/photo/photoMeasureMath';

export interface PhotoDemoPreset {
  dataUrl: string;
  width: number;
  height: number;
  mode: PhotoCalibrationMode;
  unit: PhotoUnit;
  presetId: string;
  refStart: Point2D;
  refEnd: Point2D;
  refLengthMm: number;
  refQuad: PhotoQuad;
  refQuadWidthMm: number;
  refQuadHeightMm: number;
  measurements: PhotoMeasurementItem[];
}

/**
 * Generates a true-scale 1:1 CAD side-profile car blueprint (1200x600, 0.2 px/mm):
 * - Wheel tire OD = 660 mm (132 px)
 * - Overall length = 4520 mm (904 px), height = 1460 mm (292 px), wheelbase = 2720 mm (544 px)
 */
export function createCarBlueprintDemo(): PhotoDemoPreset {
  const w = 1200;
  const h = 600;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');

  // 0.2 px/mm -> ground at y = 470, car left bumper x = 148, right bumper x = 1052 (904 px = 4520 mm)
  // roof top y = 470 - 292 = 178 (292 px = 1460 mm)
  // front wheel center x = 328, rear wheel center x = 872 (distance = 544 px = 2720 mm), radius = 66 px (diameter 132 px = 660 mm)
  if (ctx) {
    ctx.fillStyle = '#0d1824';
    ctx.fillRect(0, 0, w, h);

    // Blueprint grid (500 mm = 100 px major, 100 mm = 20 px minor)
    ctx.strokeStyle = 'rgba(77, 171, 247, 0.12)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= w; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y <= h; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(77, 171, 247, 0.28)';
    for (let x = 0; x <= w; x += 100) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y <= h; y += 100) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Ground datum line
    ctx.strokeStyle = 'rgba(238, 242, 246, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(60, 470);
    ctx.lineTo(1140, 470);
    ctx.stroke();

    // Sedan silhouette body (x: 148..1052, y: 178..470)
    ctx.fillStyle = 'rgba(77, 171, 247, 0.14)';
    ctx.strokeStyle = '#d0e8ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(148, 412);
    ctx.lineTo(154, 340);
    ctx.quadraticCurveTo(185, 315, 290, 295);
    ctx.lineTo(420, 282);
    ctx.quadraticCurveTo(500, 185, 585, 178);
    ctx.lineTo(790, 178);
    ctx.quadraticCurveTo(885, 190, 965, 276);
    ctx.lineTo(1038, 292);
    ctx.lineTo(1052, 360);
    ctx.lineTo(1044, 412);
    ctx.lineTo(946, 412);
    ctx.arc(872, 404, 74, 0, Math.PI, true);
    ctx.lineTo(402, 412);
    ctx.arc(328, 404, 74, 0, Math.PI, true);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Windows
    ctx.fillStyle = 'rgba(13, 24, 36, 0.72)';
    ctx.strokeStyle = '#74c0fc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(445, 280);
    ctx.quadraticCurveTo(518, 200, 588, 194);
    ctx.lineTo(778, 194);
    ctx.quadraticCurveTo(855, 204, 922, 278);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(645, 194);
    ctx.lineTo(638, 280);
    ctx.stroke();

    // Wheels (radius 66 px -> diameter 132 px = 660 mm)
    for (const cx of [328, 872]) {
      const cy = 404;
      ctx.fillStyle = '#11161c';
      ctx.strokeStyle = '#eef2f6';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, 66, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Alloy rim (17" = 432 mm -> r ≈ 43 px)
      ctx.strokeStyle = '#74c0fc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 43, 0, Math.PI * 2);
      ctx.stroke();

      for (let i = 0; i < 5; i++) {
        const a = (i * Math.PI * 2) / 5;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * 43, cy + Math.sin(a) * 43);
        ctx.stroke();
      }
      ctx.fillStyle = '#d0e8ff';
      ctx.beginPath();
      ctx.arc(cx, cy, 10, 0, Math.PI * 2);
      ctx.fill();
    }

    // Blueprint title block
    ctx.fillStyle = 'rgba(208, 232, 255, 0.75)';
    ctx.font = '600 15px "IBM Plex Mono", monospace';
    ctx.fillText('DEMO BLUEPRINT // SPORTS SEDAN PROFILE (SCALE 1:1)', 32, 38);
    ctx.font = '400 12px "IBM Plex Mono", monospace';
    ctx.fillText('KNOWN TIRE OD = 660 mm -> LENGTH 4.52 m · HEIGHT 1.46 m · WHEELBASE 2.72 m', 32, 58);
  }

  return {
    dataUrl: c.toDataURL('image/png'),
    width: w,
    height: h,
    mode: 'line',
    unit: 'm',
    presetId: 'car-tire',
    refStart: { x: (328 - 66) / w, y: 404 / h },
    refEnd: { x: (328 + 66) / w, y: 404 / h },
    refLengthMm: 660,
    refQuad: {
      tl: { x: 0.25, y: 0.25 },
      tr: { x: 0.75, y: 0.25 },
      br: { x: 0.75, y: 0.75 },
      bl: { x: 0.25, y: 0.75 },
    },
    refQuadWidthMm: 800,
    refQuadHeightMm: 2000,
    measurements: [
      {
        id: 'car-box',
        label: 'Overall L × H',
        kind: 'box',
        start: { x: 148 / w, y: 178 / h },
        end: { x: 1052 / w, y: 470 / h },
        color: MEASUREMENT_PALETTE[0],
      },
      {
        id: 'car-wb',
        label: 'Wheelbase',
        kind: 'line',
        start: { x: 328 / w, y: 506 / h },
        end: { x: 872 / w, y: 506 / h },
        color: MEASUREMENT_PALETTE[1],
      },
    ],
  };
}

/**
 * Generates a synthetically projected 3D angled interior room wall (1000x700)
 * with a known 0.80 x 2.00 m doorway and a 2.50 m wall section receding in perspective.
 */
export function createPerspectiveWallDemo(): PhotoDemoPreset {
  const w = 1000;
  const h = 700;
  const focal = 900;
  const project = (X: number, Y: number): Point2D => {
    const Z = 3400 + 0.45 * X;
    const u = 130 + (focal * (X * 0.92)) / Z;
    const v = 90 + (focal * Y) / Z;
    return { x: u / w, y: v / h };
  };

  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');

  if (ctx) {
    ctx.fillStyle = '#0e1116';
    ctx.fillRect(0, 0, w, h);

    // Wall polygon: X in [-300..4200 mm], Y in [0..2700 mm]
    const wallPts = [
      project(-300, 0),
      project(4200, 0),
      project(4200, 2700),
      project(-300, 2700),
    ];
    ctx.fillStyle = '#1c2430';
    ctx.strokeStyle = '#526173';
    ctx.lineWidth = 2;
    ctx.beginPath();
    wallPts.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.x * w, p.y * h);
      else ctx.lineTo(p.x * w, p.y * h);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Perspective vertical & horizontal tile lines every 500 mm
    ctx.strokeStyle = 'rgba(130, 160, 195, 0.18)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= 4000; x += 500) {
      const top = project(x, 0);
      const bot = project(x, 2700);
      ctx.beginPath();
      ctx.moveTo(top.x * w, top.y * h);
      ctx.lineTo(bot.x * w, bot.y * h);
      ctx.stroke();
    }
    for (let y = 0; y <= 2700; y += 500) {
      const left = project(-300, y);
      const right = project(4200, y);
      ctx.beginPath();
      ctx.moveTo(left.x * w, left.y * h);
      ctx.lineTo(right.x * w, right.y * h);
      ctx.stroke();
    }

    // Reference Doorway: X in [0..800], Y in [700..2700] -> 0.80 m x 2.00 m
    const door = [project(0, 700), project(800, 700), project(800, 2700), project(0, 2700)];
    ctx.fillStyle = '#2b2019';
    ctx.strokeStyle = '#00d4aa';
    ctx.lineWidth = 3;
    ctx.beginPath();
    door.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.x * w, p.y * h);
      else ctx.lineTo(p.x * w, p.y * h);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Wall cabinet / window receding on same wall: X in [1400..3900] (2.50 m wide!), Y in [900..1900] (1.00 m high!)
    const windowPts = [
      project(1400, 900),
      project(3900, 900),
      project(3900, 1900),
      project(1400, 1900),
    ];
    ctx.fillStyle = 'rgba(255, 107, 26, 0.16)';
    ctx.strokeStyle = '#ffb085';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    windowPts.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.x * w, p.y * h);
      else ctx.lineTo(p.x * w, p.y * h);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#d0e8ff';
    ctx.font = '600 15px "IBM Plex Mono", monospace';
    ctx.fillText('DEMO 3D PERSPECTIVE WALL (4-POINT HOMOGRAPHY)', 28, 36);
    ctx.font = '400 12px "IBM Plex Mono", monospace';
    ctx.fillText('DOOR = 0.80 x 2.00 m -> RECESSED WINDOW = 2.50 x 1.00 m · CEILING = 2.70 m', 28, 56);
  }

  const refQuad: PhotoQuad = {
    tl: project(0, 700),
    tr: project(800, 700),
    br: project(800, 2700),
    bl: project(0, 2700),
  };

  return {
    dataUrl: c.toDataURL('image/png'),
    width: w,
    height: h,
    mode: 'perspective',
    unit: 'm',
    presetId: 'door',
    refStart: refQuad.tl,
    refEnd: refQuad.bl,
    refLengthMm: 2000,
    refQuad,
    refQuadWidthMm: 800,
    refQuadHeightMm: 2000,
    measurements: [
      {
        id: 'wall-window',
        label: 'Window Width',
        kind: 'line',
        start: project(1400, 900),
        end: project(3900, 900),
        color: MEASUREMENT_PALETTE[0],
      },
      {
        id: 'wall-ceiling',
        label: 'Ceiling Height',
        kind: 'line',
        start: project(1400, 0),
        end: project(1400, 2700),
        color: MEASUREMENT_PALETTE[1],
      },
    ],
  };
}
