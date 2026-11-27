import type { Point2D } from '../../core/camera/cameraMath';
import {
  computePhotoMeasurement,
  formatPhotoLength,
  normalizedToCanvas,
  type ImageViewportTransform,
  type PhotoCalibrationMode,
  type PhotoMeasurementItem,
  type PhotoQuad,
  type PhotoUnit,
  type PlaneProjector,
} from '../../core/photo/photoMeasureMath';

export interface RenderPhotoOverlayOptions {
  ctx: CanvasRenderingContext2D;
  canvasW: number;
  canvasH: number;
  img: HTMLImageElement | null;
  vp: ImageViewportTransform;
  mode: PhotoCalibrationMode;
  unit: PhotoUnit;
  refStart: Point2D;
  refEnd: Point2D;
  refLengthMm: number;
  refQuad: PhotoQuad;
  refQuadWidthMm: number;
  refQuadHeightMm: number;
  measurements: PhotoMeasurementItem[];
  projector: PlaneProjector | null;
  selectedId: string | null;
  activeLoupePoint?: { point: Point2D; color: string } | null;
  forExport?: boolean;
}

function drawBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  color: string,
  fontSize = 12,
) {
  ctx.save();
  ctx.font = `700 ${fontSize}px "IBM Plex Mono", monospace`;
  const padX = Math.round(fontSize * 0.55);
  const h = Math.round(fontSize * 1.75);
  const w = ctx.measureText(text).width + padX * 2;
  ctx.fillStyle = 'rgba(11, 14, 17, 0.88)';
  ctx.fillRect(x - w / 2, y - h / 2, w, h);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.25;
  ctx.strokeRect(x - w / 2, y - h / 2, w, h);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawPin(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  tag?: string,
  radius = 10,
) {
  ctx.save();
  ctx.fillStyle = 'rgba(11, 14, 17, 0.92)';
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  if (tag) {
    ctx.fillStyle = color;
    ctx.font = `700 ${Math.max(9, Math.round(radius * 0.85))}px "IBM Plex Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tag, x, y + 0.5);
  } else {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(3, radius * 0.35), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function renderPhotoOverlay({
  ctx,
  canvasW,
  canvasH,
  img,
  vp,
  mode,
  unit,
  refStart,
  refEnd,
  refLengthMm,
  refQuad,
  refQuadWidthMm,
  refQuadHeightMm,
  measurements,
  projector,
  selectedId,
  activeLoupePoint,
  forExport = false,
}: RenderPhotoOverlayOptions): void {
  ctx.clearRect(0, 0, canvasW, canvasH);
  ctx.fillStyle = '#090c10';
  ctx.fillRect(0, 0, canvasW, canvasH);

  if (img) {
    ctx.drawImage(img, vp.drawX, vp.drawY, vp.drawW, vp.drawH);
  }

  const fontScale = forExport ? Math.max(12, Math.round(canvasW / 68)) : 12;
  const pinRadius = forExport ? Math.max(6, Math.round(canvasW / 120)) : 11;
  const lineWidth = forExport ? Math.max(2.5, canvasW / 320) : 2.5;

  // 1. Draw reference calibration overlay (cyan)
  const refColor = '#00d4aa';
  if (mode === 'line') {
    const a = normalizedToCanvas(refStart, vp);
    const b = normalizedToCanvas(refEnd, vp);
    ctx.save();
    ctx.strokeStyle = refColor;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();

    if (!forExport) {
      drawPin(ctx, a.x, a.y, refColor, 'R1', pinRadius);
      drawPin(ctx, b.x, b.y, refColor, 'R2', pinRadius);
    }
    drawBadge(
      ctx,
      (a.x + b.x) / 2,
      (a.y + b.y) / 2 - fontScale * 1.4,
      `REF ${formatPhotoLength(refLengthMm, unit)}`,
      refColor,
      fontScale,
    );
  } else {
    const tl = normalizedToCanvas(refQuad.tl, vp);
    const tr = normalizedToCanvas(refQuad.tr, vp);
    const br = normalizedToCanvas(refQuad.br, vp);
    const bl = normalizedToCanvas(refQuad.bl, vp);

    ctx.save();
    ctx.fillStyle = 'rgba(0, 212, 170, 0.12)';
    ctx.strokeStyle = refColor;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(tl.x, tl.y);
    ctx.lineTo(tr.x, tr.y);
    ctx.lineTo(br.x, br.y);
    ctx.lineTo(bl.x, bl.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Subtle internal perspective verification lines
    ctx.strokeStyle = 'rgba(0, 212, 170, 0.35)';
    ctx.lineWidth = 1;
    for (const t of [0.25, 0.5, 0.75]) {
      const topX = tl.x + (tr.x - tl.x) * t;
      const topY = tl.y + (tr.y - tl.y) * t;
      const botX = bl.x + (br.x - bl.x) * t;
      const botY = bl.y + (br.y - bl.y) * t;
      ctx.beginPath();
      ctx.moveTo(topX, topY);
      ctx.lineTo(botX, botY);
      ctx.stroke();

      const leftX = tl.x + (bl.x - tl.x) * t;
      const leftY = tl.y + (bl.y - tl.y) * t;
      const rightX = tr.x + (br.x - tr.x) * t;
      const rightY = tr.y + (br.y - tr.y) * t;
      ctx.beginPath();
      ctx.moveTo(leftX, leftY);
      ctx.lineTo(rightX, rightY);
      ctx.stroke();
    }
    ctx.restore();

    if (!forExport) {
      drawPin(ctx, tl.x, tl.y, refColor, '1', pinRadius);
      drawPin(ctx, tr.x, tr.y, refColor, '2', pinRadius);
      drawPin(ctx, br.x, br.y, refColor, '3', pinRadius);
      drawPin(ctx, bl.x, bl.y, refColor, '4', pinRadius);
    }

    const cx = (tl.x + tr.x + br.x + bl.x) / 4;
    const cy = (tl.y + tr.y + br.y + bl.y) / 4;
    drawBadge(
      ctx,
      cx,
      cy,
      `REF ${formatPhotoLength(refQuadWidthMm, unit)} × ${formatPhotoLength(refQuadHeightMm, unit)}`,
      refColor,
      fontScale,
    );
  }

  // 2. Draw all measurement items (lines & bounding boxes)
  for (const item of measurements) {
    const a = normalizedToCanvas(item.start, vp);
    const b = normalizedToCanvas(item.end, vp);
    const metrics = computePhotoMeasurement(item, projector);
    const isSelected = item.id === selectedId && !forExport;

    if (item.kind === 'line') {
      ctx.save();
      ctx.strokeStyle = item.color;
      ctx.lineWidth = isSelected ? lineWidth + 1.2 : lineWidth;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.restore();

      if (!forExport) {
        drawPin(ctx, a.x, a.y, item.color, undefined, pinRadius);
        drawPin(ctx, b.x, b.y, item.color, undefined, pinRadius);
      }

      const text =
        metrics && metrics.kind === 'line'
          ? `${item.label}: ${formatPhotoLength(metrics.lengthMm, unit)}`
          : item.label;
      drawBadge(
        ctx,
        (a.x + b.x) / 2,
        (a.y + b.y) / 2 - fontScale * 1.4,
        text,
        item.color,
        fontScale,
      );
    } else {
      const minX = Math.min(a.x, b.x);
      const minY = Math.min(a.y, b.y);
      const boxW = Math.abs(b.x - a.x);
      const boxH = Math.abs(b.y - a.y);

      ctx.save();
      ctx.fillStyle = item.color;
      ctx.globalAlpha = isSelected ? 0.14 : 0.08;
      ctx.fillRect(minX, minY, boxW, boxH);
      ctx.globalAlpha = 1;

      ctx.strokeStyle = item.color;
      ctx.lineWidth = isSelected ? lineWidth + 1.2 : lineWidth;
      ctx.strokeRect(minX, minY, boxW, boxH);

      // Dashed diagonal inside bounding box
      ctx.setLineDash([6, 5]);
      ctx.globalAlpha = 0.65;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.restore();

      if (!forExport) {
        drawPin(ctx, a.x, a.y, item.color, 'A', pinRadius);
        drawPin(ctx, b.x, b.y, item.color, 'B', pinRadius);
      }

      if (metrics && metrics.kind === 'box') {
        drawBadge(
          ctx,
          minX + boxW / 2,
          minY - fontScale * 1.15,
          `W ${formatPhotoLength(metrics.widthMm, unit)}`,
          item.color,
          fontScale,
        );
        drawBadge(
          ctx,
          minX + boxW + fontScale * 3.6,
          minY + boxH / 2,
          `H ${formatPhotoLength(metrics.heightMm, unit)}`,
          item.color,
          fontScale,
        );
        drawBadge(
          ctx,
          minX + boxW / 2,
          minY + boxH / 2,
          `⌀ ${formatPhotoLength(metrics.diagonalMm, unit)}`,
          item.color,
          fontScale,
        );
      }
    }
  }

  // 3. Draw 3x precision loupe while dragging a pin
  if (activeLoupePoint && img && !forExport) {
    const pin = activeLoupePoint.point;
    const loupeSize = 104;
    const lx = pin.x > 0.5 ? 14 : canvasW - loupeSize - 14;
    const ly = 14;
    const zoom = 3;

    ctx.save();
    ctx.beginPath();
    ctx.arc(lx + loupeSize / 2, ly + loupeSize / 2, loupeSize / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#090c10';
    ctx.fillRect(lx, ly, loupeSize, loupeSize);

    const sx = pin.x * img.naturalWidth - loupeSize / (2 * zoom);
    const sy = pin.y * img.naturalHeight - loupeSize / (2 * zoom);
    ctx.drawImage(
      img,
      sx,
      sy,
      loupeSize / zoom,
      loupeSize / zoom,
      lx,
      ly,
      loupeSize,
      loupeSize,
    );

    // Crosshair inside loupe
    ctx.strokeStyle = activeLoupePoint.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(lx, ly + loupeSize / 2);
    ctx.lineTo(lx + loupeSize, ly + loupeSize / 2);
    ctx.moveTo(lx + loupeSize / 2, ly);
    ctx.lineTo(lx + loupeSize / 2, ly + loupeSize);
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(lx + loupeSize / 2, ly + loupeSize / 2, loupeSize / 2, 0, Math.PI * 2);
    ctx.stroke();
  }
}
