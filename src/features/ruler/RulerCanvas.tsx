import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import {
  applyScrollDragMm,
  generateVisibleTicks,
  type LabelRotation,
  type LengthUnit,
  type RulerAxisState,
  type RulerCorner,
  type RulerEdgeMode,
} from '../../core/ruler/rulerMath';
import { getCanvasPalette } from '../../core/theme/canvasPalette';
import type { ResolvedColorScheme } from '../../core/theme/useColorScheme';

interface RulerCanvasProps {
  pxPerMm: number;
  colorScheme: ResolvedColorScheme;
  unit: LengthUnit;
  corner: RulerCorner;
  edgeMode: RulerEdgeMode;
  labelRotation: LabelRotation;
  longAxis: RulerAxisState;
  shortAxis: RulerAxisState;
  baseOffsetMm: number;
  locked: boolean;
  showCalipers: boolean;
  cursorAPx: number;
  cursorBPx: number;
  onScrollLongChange: (nextScrollMm: number) => void;
  onScrollShortChange: (nextScrollMm: number) => void;
  onCursorAChange: (px: number) => void;
  onCursorBChange: (px: number) => void;
  onViewportMeasure: (widthPx: number, heightPx: number) => void;
}

const RULER_BAND_PX = 68;
const CALIPER_HIT_PX = 24;

type DragMode =
  | { kind: 'none' }
  | { kind: 'scroll-long'; startPos: number; startScrollMm: number }
  | { kind: 'scroll-short'; startPos: number; startScrollMm: number }
  | { kind: 'cursor-a' }
  | { kind: 'cursor-b' };

export function RulerCanvas({
  pxPerMm,
  colorScheme,
  unit,
  corner,
  edgeMode,
  labelRotation,
  longAxis,
  shortAxis,
  baseOffsetMm,
  locked,
  showCalipers,
  cursorAPx,
  cursorBPx,
  onScrollLongChange,
  onScrollShortChange,
  onCursorAChange,
  onCursorBChange,
  onViewportMeasure,
}: RulerCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<DragMode>({ kind: 'none' });
  const sizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const updateSize = () => {
      const rect = parent.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      sizeRef.current = { w, h };
      onViewportMeasure(w, h);
    };

    updateSize();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(updateSize);
      observer.observe(parent);
      return () => observer.disconnect();
    }
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [onViewportMeasure]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { w, h } = sizeRef.current;
    if (w <= 0 || h <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform?.(dpr, 0, 0, dpr, 0, 0);
    if (!ctx.setTransform) {
      ctx.scale(dpr, dpr);
    }

    const {
      bg,
      bandBg,
      textPrimary,
      textMuted,
      border: borderColor,
      accentPrimary,
      accentSecondary,
    } = getCanvasPalette(colorScheme);

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Subtle precision millimeter background grid
    const majorGridPx = (unit === 'in' ? 25.4 : 10) * pxPerMm;
    if (majorGridPx >= 12) {
      ctx.save();
      ctx.strokeStyle = borderColor;
      ctx.globalAlpha = 0.25;
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += majorGridPx) {
        ctx.beginPath();
        ctx.moveTo(Math.round(x) + 0.5, 0);
        ctx.lineTo(Math.round(x) + 0.5, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += majorGridPx) {
        ctx.beginPath();
        ctx.moveTo(0, Math.round(y) + 0.5);
        ctx.lineTo(w, Math.round(y) + 0.5);
        ctx.stroke();
      }
      ctx.restore();
    }

    const isPortrait = h >= w;
    const isLeft = corner === 'top-left' || corner === 'bottom-left';
    const isTop = corner === 'top-left' || corner === 'top-right';

    const showVertical = edgeMode === 'L' || (isPortrait ? edgeMode === 'long' : edgeMode === 'short');
    const showHorizontal = edgeMode === 'L' || (isPortrait ? edgeMode === 'short' : edgeMode === 'long');

    const vAxis = isPortrait ? longAxis : shortAxis;
    const hAxis = isPortrait ? shortAxis : longAxis;

    // Draw vertical ruler band
    if (showVertical) {
      const bandX = isLeft ? 0 : w - RULER_BAND_PX;
      ctx.fillStyle = bandBg;
      ctx.fillRect(bandX, 0, RULER_BAND_PX, h);

      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1;
      const borderX = isLeft ? RULER_BAND_PX - 0.5 : w - RULER_BAND_PX + 0.5;
      ctx.beginPath();
      ctx.moveTo(borderX, 0);
      ctx.lineTo(borderX, h);
      ctx.stroke();

      const ticks = generateVisibleTicks(h, pxPerMm, vAxis, baseOffsetMm, unit);
      ctx.font = '600 11px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      for (const tick of ticks) {
        const y = Math.round(tick.px) + 0.5;
        const isZero = Math.abs(tick.valueMm) < 0.001;
        const len = tick.level === 'major' ? 28 : tick.level === 'medium' ? 19 : 11;

        ctx.strokeStyle = isZero
          ? accentPrimary
          : tick.level === 'major'
            ? textPrimary
            : textMuted;
        ctx.lineWidth = isZero ? 2.5 : tick.level === 'major' ? 1.5 : 1;

        ctx.beginPath();
        if (isLeft) {
          ctx.moveTo(0, y);
          ctx.lineTo(len, y);
        } else {
          ctx.moveTo(w, y);
          ctx.lineTo(w - len, y);
        }
        ctx.stroke();

        if (tick.label) {
          ctx.save();
          const labelX = isLeft ? 46 : w - 46;
          ctx.translate(labelX, y);
          ctx.rotate((labelRotation * Math.PI) / 180);
          ctx.fillStyle = isZero ? accentPrimary : textPrimary;
          ctx.fillText(tick.label, 0, 0);
          ctx.restore();
        }
      }
    }

    // Draw horizontal ruler band
    if (showHorizontal) {
      const bandY = isTop ? 0 : h - RULER_BAND_PX;
      ctx.fillStyle = bandBg;
      ctx.fillRect(0, bandY, w, RULER_BAND_PX);

      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1;
      const borderY = isTop ? RULER_BAND_PX - 0.5 : h - RULER_BAND_PX + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, borderY);
      ctx.lineTo(w, borderY);
      ctx.stroke();

      const ticks = generateVisibleTicks(w, pxPerMm, hAxis, baseOffsetMm, unit);
      ctx.font = '600 11px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      for (const tick of ticks) {
        const x = Math.round(tick.px) + 0.5;
        const isZero = Math.abs(tick.valueMm) < 0.001;
        const len = tick.level === 'major' ? 28 : tick.level === 'medium' ? 19 : 11;

        ctx.strokeStyle = isZero
          ? accentPrimary
          : tick.level === 'major'
            ? textPrimary
            : textMuted;
        ctx.lineWidth = isZero ? 2.5 : tick.level === 'major' ? 1.5 : 1;

        ctx.beginPath();
        if (isTop) {
          ctx.moveTo(x, 0);
          ctx.lineTo(x, len);
        } else {
          ctx.moveTo(x, h);
          ctx.lineTo(x, h - len);
        }
        ctx.stroke();

        if (tick.label) {
          ctx.save();
          const labelY = isTop ? 46 : h - 46;
          ctx.translate(x, labelY);
          ctx.rotate((labelRotation * Math.PI) / 180);
          ctx.fillStyle = isZero ? accentPrimary : textPrimary;
          ctx.fillText(tick.label, 0, 0);
          ctx.restore();
        }
      }
    }

    // Corner origin medallion in L-mode
    if (showVertical && showHorizontal) {
      const cx = isLeft ? 0 : w - RULER_BAND_PX;
      const cy = isTop ? 0 : h - RULER_BAND_PX;
      ctx.fillStyle = bandBg;
      ctx.fillRect(cx, cy, RULER_BAND_PX, RULER_BAND_PX);
      ctx.strokeStyle = borderColor;
      ctx.strokeRect(cx + 0.5, cy + 0.5, RULER_BAND_PX - 1, RULER_BAND_PX - 1);

      ctx.fillStyle = accentPrimary;
      ctx.font = '700 12px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(unit.toUpperCase(), cx + RULER_BAND_PX / 2, cy + RULER_BAND_PX / 2);
    }

    // Caliper cursors along primary (long) axis
    if (showCalipers) {
      const drawCaliper = (posPx: number, color: string, tag: string) => {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;

        if (isPortrait) {
          const y = Math.round(posPx) + 0.5;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();

          // Handle pill
          const pillX = isLeft ? RULER_BAND_PX + 10 : w - RULER_BAND_PX - 46;
          ctx.fillStyle = color;
          ctx.fillRect(pillX, y - 12, 36, 24);
          ctx.fillStyle = '#090c10';
          ctx.font = '700 11px "IBM Plex Mono", monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(tag, pillX + 18, y);
        } else {
          const x = Math.round(posPx) + 0.5;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
          ctx.stroke();

          const pillY = isTop ? RULER_BAND_PX + 10 : h - RULER_BAND_PX - 34;
          ctx.fillStyle = color;
          ctx.fillRect(x - 18, pillY, 36, 24);
          ctx.fillStyle = '#090c10';
          ctx.font = '700 11px "IBM Plex Mono", monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(tag, x, pillY + 12);
        }
        ctx.restore();
      };

      // Highlight span between A and B
      ctx.save();
      ctx.fillStyle = accentSecondary;
      ctx.globalAlpha = 0.08;
      if (isPortrait) {
        const y1 = Math.min(cursorAPx, cursorBPx);
        ctx.fillRect(0, y1, w, Math.abs(cursorBPx - cursorAPx));
      } else {
        const x1 = Math.min(cursorAPx, cursorBPx);
        ctx.fillRect(x1, 0, Math.abs(cursorBPx - cursorAPx), h);
      }
      ctx.restore();

      drawCaliper(cursorAPx, accentPrimary, 'A');
      drawCaliper(cursorBPx, accentSecondary, 'B');
    }
  });

  const handlePointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const { w, h } = sizeRef.current;
    const isPortrait = h >= w;
    const isLeft = corner === 'top-left' || corner === 'bottom-left';
    const isTop = corner === 'top-left' || corner === 'top-right';

    canvas.setPointerCapture?.(e.pointerId);

    // 1. Check caliper handles first
    if (showCalipers) {
      const primaryCoord = isPortrait ? y : x;
      const distA = Math.abs(primaryCoord - cursorAPx);
      const distB = Math.abs(primaryCoord - cursorBPx);
      if (distA <= CALIPER_HIT_PX && distA <= distB) {
        dragRef.current = { kind: 'cursor-a' };
        return;
      }
      if (distB <= CALIPER_HIT_PX) {
        dragRef.current = { kind: 'cursor-b' };
        return;
      }
    }

    if (locked) {
      dragRef.current = { kind: 'none' };
      return;
    }

    // 2. Determine whether user touched horizontal band or vertical band (or open area -> scrolls primary long axis)
    const inHorizBand = isTop ? y <= RULER_BAND_PX : y >= h - RULER_BAND_PX;
    const inVertBand = isLeft ? x <= RULER_BAND_PX : x >= w - RULER_BAND_PX;

    if (inHorizBand && !inVertBand) {
      dragRef.current = isPortrait
        ? { kind: 'scroll-short', startPos: x, startScrollMm: shortAxis.scrollOffsetMm }
        : { kind: 'scroll-long', startPos: x, startScrollMm: longAxis.scrollOffsetMm };
      return;
    }

    // Vertical band or main surface scrolls vertical axis (long axis in portrait, short axis in landscape)
    dragRef.current = isPortrait
      ? { kind: 'scroll-long', startPos: y, startScrollMm: longAxis.scrollOffsetMm }
      : { kind: 'scroll-short', startPos: y, startScrollMm: shortAxis.scrollOffsetMm };
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (drag.kind === 'none') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const { w, h } = sizeRef.current;
    const isPortrait = h >= w;
    const primaryLimit = isPortrait ? h : w;

    if (drag.kind === 'cursor-a') {
      const next = Math.max(0, Math.min(primaryLimit, isPortrait ? y : x));
      onCursorAChange(next);
      return;
    }
    if (drag.kind === 'cursor-b') {
      const next = Math.max(0, Math.min(primaryLimit, isPortrait ? y : x));
      onCursorBChange(next);
      return;
    }
    if (drag.kind === 'scroll-long') {
      const deltaPx = (isPortrait ? y : x) - drag.startPos;
      onScrollLongChange(
        applyScrollDragMm(drag.startScrollMm, deltaPx, pxPerMm, longAxis.direction),
      );
      return;
    }
    if (drag.kind === 'scroll-short') {
      const deltaPx = (isPortrait ? x : y) - drag.startPos;
      onScrollShortChange(
        applyScrollDragMm(drag.startScrollMm, deltaPx, pxPerMm, shortAxis.direction),
      );
    }
  };

  const handlePointerUp = () => {
    dragRef.current = { kind: 'none' };
  };

  return (
    <canvas
      ref={canvasRef}
      className="ruler-canvas"
      aria-label="Interactive calibrated screen ruler"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    />
  );
}
