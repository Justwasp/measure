import { useEffect, useRef, useState } from 'react';
import { computeBullseye } from '../../core/angle/angleMath';
import { getCanvasPalette } from '../../core/theme/canvasPalette';
import type { ResolvedColorScheme } from '../../core/theme/useColorScheme';

interface LevelCanvasProps {
  mode: 'edge' | 'bullseye';
  colorScheme: ResolvedColorScheme;
  angleDeg: number;
  tareDeg: number | null;
  betaDeg: number;
  gammaDeg: number;
}

export function LevelCanvas({
  mode,
  colorScheme,
  angleDeg,
  tareDeg,
  betaDeg,
  gammaDeg,
}: LevelCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState(280);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const measure = () => {
      const rect = parent.getBoundingClientRect();
      const next = Math.max(150, Math.round(Math.min(rect.width || 280, rect.height || 280)));
      setSize((prev) => (prev === next ? prev : next));
    };

    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measure);
      ro.observe(parent);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    ctx.setTransform?.(dpr, 0, 0, dpr, 0, 0);
    if (!ctx.setTransform) {
      ctx.scale(dpr, dpr);
    }

    const {
      bg,
      textPrimary,
      textMuted,
      border,
      accentPrimary: accent,
      accentSecondary: cyan,
      ok,
    } = getCanvasPalette(colorScheme);

    const cx = size / 2;
    const cy = size / 2;
    const r = size * 0.43;

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);

    if (mode === 'edge') {
      const isLevel = Math.abs(angleDeg) <= 0.3 || Math.abs(Math.abs(angleDeg) - 90) <= 0.3;
      const activeColor = isLevel ? ok : accent;

      // Outer graduated protractor ring
      ctx.strokeStyle = border;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      for (let deg = 0; deg < 360; deg += 5) {
        const rad = (deg * Math.PI) / 180;
        const isMajor = deg % 30 === 0;
        const isMid = deg % 15 === 0;
        const tickLen = isMajor ? Math.max(10, r * 0.13) : isMid ? Math.max(7, r * 0.08) : 4;
        ctx.strokeStyle = isMajor ? textPrimary : textMuted;
        ctx.lineWidth = isMajor ? 1.6 : 1;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(rad) * (r - tickLen), cy + Math.sin(rad) * (r - tickLen));
        ctx.lineTo(cx + Math.cos(rad) * r, cy + Math.sin(rad) * r);
        ctx.stroke();

        if (deg % 90 === 0) {
          ctx.fillStyle = textMuted;
          ctx.font = `600 ${size < 200 ? 10 : 11}px "IBM Plex Mono", monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const label = deg === 0 || deg === 180 ? '0°' : '90°';
          const labelR = r - tickLen - 11;
          ctx.fillText(label, cx + Math.cos(rad) * labelR, cy + Math.sin(rad) * labelR);
        }
      }

      // Fixed horizontal reference crosshair
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = border;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.8, cy);
      ctx.lineTo(cx + r * 0.8, cy);
      ctx.stroke();
      ctx.restore();

      // Tare reference line if active
      if (tareDeg !== null) {
        const tareRad = (tareDeg * Math.PI) / 180;
        ctx.strokeStyle = cyan;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx - Math.cos(tareRad) * r * 0.72, cy - Math.sin(tareRad) * r * 0.72);
        ctx.lineTo(cx + Math.cos(tareRad) * r * 0.72, cy + Math.sin(tareRad) * r * 0.72);
        ctx.stroke();
      }

      // Swept angle sector
      const rad = (angleDeg * Math.PI) / 180;
      ctx.fillStyle = activeColor;
      ctx.globalAlpha = 0.14;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r * 0.78, 0, rad, angleDeg < 0);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;

      // Active inclinometer beam
      ctx.strokeStyle = activeColor;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(cx - Math.cos(rad) * r * 0.84, cy - Math.sin(rad) * r * 0.84);
      ctx.lineTo(cx + Math.cos(rad) * r * 0.84, cy + Math.sin(rad) * r * 0.84);
      ctx.stroke();

      // Center pivot
      ctx.fillStyle = activeColor;
      ctx.beginPath();
      ctx.arc(cx, cy, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(cx, cy, 2.8, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // 2D Surface Bullseye Spirit Level
      const bullseye = computeBullseye(betaDeg, gammaDeg, 15, 0.35);
      const activeColor = bullseye.isLevel ? ok : cyan;

      // Concentric rings (5°, 10°, 15°)
      [1, 0.66, 0.33, 0.16].forEach((ratio, idx) => {
        ctx.strokeStyle = idx === 3 && bullseye.isLevel ? ok : border;
        ctx.lineWidth = idx === 0 || idx === 3 ? 2 : 1;
        ctx.beginPath();
        ctx.arc(cx, cy, r * ratio, 0, Math.PI * 2);
        ctx.stroke();
      });

      // Crosshairs
      ctx.strokeStyle = border;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - r, cy);
      ctx.lineTo(cx + r, cy);
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx, cy + r);
      ctx.stroke();

      // Liquid bubble
      const bubbleR = Math.max(12, r * 0.14);
      const bx = cx + bullseye.x * (r - bubbleR - 4);
      const by = cy + bullseye.y * (r - bubbleR - 4);

      ctx.fillStyle = activeColor;
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.arc(bx, by, bubbleR * 1.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.fillStyle = activeColor;
      ctx.beginPath();
      ctx.arc(bx, by, bubbleR, 0, Math.PI * 2);
      ctx.fill();

      // Specular highlight on bubble
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.arc(bx - bubbleR * 0.3, by - bubbleR * 0.3, bubbleR * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }, [mode, colorScheme, size, angleDeg, tareDeg, betaDeg, gammaDeg]);

  return (
    <canvas
      ref={canvasRef}
      className="gauge-canvas"
      style={{ width: size, height: size }}
      aria-label={mode === 'edge' ? 'Digital inclinometer dial' : '2D bullseye spirit level'}
    />
  );
}
