import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { BookmarkPlus, Camera, Grid, Upload } from 'lucide-react';
import { computeReferenceMeasurement, type Point2D } from '../../core/camera/cameraMath';
import { formatLength, type LengthUnit } from '../../core/ruler/rulerMath';
import { useI18n } from '../../i18n/I18nContext';

interface PhotoReferenceModeProps {
  onSaveMeasurement: (valueText: string, detailText?: string) => void;
}

const PHOTO_REFERENCES = [
  { id: 'card', labelEn: 'Bank Card (85.6 mm)', labelRu: 'Банковская карта (85.6 мм)', mm: 85.6 },
  { id: 'a4', labelEn: 'A4 Sheet Width (210 mm)', labelRu: 'Ширина листа A4 (210 мм)', mm: 210 },
  { id: 'eur', labelEn: '1 Euro Coin (23.25 mm)', labelRu: 'Монета 1 Евро (23.25 мм)', mm: 23.25 },
  { id: 'quarter', labelEn: 'US Quarter (24.26 mm)', labelRu: '25 центов США (24.26 мм)', mm: 24.26 },
  { id: 'rub', labelEn: '10 RUB Coin (22.0 mm)', labelRu: 'Монета 10 ₽ (22.0 мм)', mm: 22.0 },
  { id: 'custom', labelEn: 'Custom (mm)', labelRu: 'Свой размер (мм)', mm: 100 },
] as const;

type PinId = 'refStart' | 'refEnd' | 'targetStart' | 'targetEnd';

interface PinsState {
  refStart: Point2D;
  refEnd: Point2D;
  targetStart: Point2D;
  targetEnd: Point2D;
}

function createDemoGridDataUrl(): string {
  const c = document.createElement('canvas');
  c.width = 800;
  c.height = 600;
  const ctx = c.getContext('2d');
  if (!ctx) return '';

  // Dark workbench background with 10mm grid (4px per mm -> 40px per cm)
  ctx.fillStyle = '#121820';
  ctx.fillRect(0, 0, 800, 600);
  ctx.strokeStyle = '#232e3b';
  ctx.lineWidth = 1;
  for (let x = 0; x <= 800; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 600);
    ctx.stroke();
  }
  for (let y = 0; y <= 600; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(800, y);
    ctx.stroke();
  }

  // Reference ISO Bank Card: 85.6 mm * 3 px/mm = 256.8 px wide
  const cardX = 100;
  const cardY = 340;
  const cardW = 85.6 * 3;
  const cardH = 53.98 * 3;
  ctx.fillStyle = '#1a3a4a';
  ctx.strokeStyle = '#00d4aa';
  ctx.lineWidth = 3;
  ctx.fillRect(cardX, cardY, cardW, cardH);
  ctx.strokeRect(cardX, cardY, cardW, cardH);
  ctx.fillStyle = '#e6edf3';
  ctx.font = '600 16px "IBM Plex Mono", monospace';
  ctx.fillText('ISO CARD 85.6 mm', cardX + 24, cardY + 86);

  // Target object: machined bar 140 mm * 3 px/mm = 420 px wide
  const barX = 160;
  const barY = 140;
  const barW = 140 * 3;
  const barH = 52;
  ctx.fillStyle = '#3b2416';
  ctx.strokeStyle = '#ff6b1a';
  ctx.lineWidth = 3;
  ctx.fillRect(barX, barY, barW, barH);
  ctx.strokeRect(barX, barY, barW, barH);
  ctx.fillStyle = '#ffd8c2';
  ctx.fillText('SAMPLE PART (140.0 mm)', barX + 95, barY + 32);

  return c.toDataURL('image/png');
}

export function PhotoReferenceMode({ onSaveMeasurement }: PhotoReferenceModeProps) {
  const { t, locale } = useI18n();
  const [unit, setUnit] = useState<LengthUnit>('mm');
  const [refPreset, setRefPreset] = useState<string>('card');
  const [customRefMm, setCustomRefMm] = useState('100');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imgSize, setImgSize] = useState({ w: 800, h: 600 });
  const [liveCamera, setLiveCamera] = useState(false);
  const [cameraErr, setCameraErr] = useState<string | null>(null);
  const [activePin, setActivePin] = useState<PinId | null>(null);

  const [pins, setPins] = useState<PinsState>({
    refStart: { x: 100 / 800, y: 340 / 600 },
    refEnd: { x: (100 + 85.6 * 3) / 800, y: 340 / 600 },
    targetStart: { x: 160 / 800, y: 166 / 600 },
    targetEnd: { x: (160 + 140 * 3) / 800, y: 166 / 600 },
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loadedImageRef = useRef<HTMLImageElement | null>(null);

  const refLengthMm =
    refPreset === 'custom'
      ? Math.max(1, Number.parseFloat(customRefMm) || 100)
      : (PHOTO_REFERENCES.find((r) => r.id === refPreset)?.mm ?? 85.6);

  const measurement = computeReferenceMeasurement(
    pins.refStart,
    pins.refEnd,
    refLengthMm,
    pins.targetStart,
    pins.targetEnd,
    imgSize.w,
    imgSize.h,
  );

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
    };
  }, []);

  // Load image into HTMLImageElement and draw canvas whenever image or pins change
  useEffect(() => {
    if (!imageUrl) {
      loadedImageRef.current = null;
      return;
    }
    const img = new Image();
    img.onload = () => {
      loadedImageRef.current = img;
      setImgSize({ w: img.naturalWidth || 800, h: img.naturalHeight || 600 });
    };
    img.src = imageUrl;
  }, [imageUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || liveCamera) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const w = Math.max(240, Math.round(rect.width || 400));
    const h = Math.max(180, Math.round(rect.height || 300));
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform?.(dpr, 0, 0, dpr, 0, 0);
    if (!ctx.setTransform) ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#090c10';
    ctx.fillRect(0, 0, w, h);

    const img = loadedImageRef.current;
    if (img) {
      ctx.drawImage(img, 0, 0, w, h);
    }

    const drawSegment = (p1: Point2D, p2: Point2D, color: string, label: string) => {
      const x1 = p1.x * w;
      const y1 = p1.y * h;
      const x2 = p2.x * w;
      const y2 = p2.y * h;

      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      for (const [px, py] of [
        [x1, y1],
        [x2, y2],
      ]) {
        ctx.fillStyle = '#0b0e11';
        ctx.beginPath();
        ctx.arc(px, py, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(px, py, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }

      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2 - 14;
      ctx.font = '700 12px "IBM Plex Mono", monospace';
      const tw = ctx.measureText(label).width + 12;
      ctx.fillStyle = 'rgba(11, 14, 17, 0.85)';
      ctx.fillRect(mx - tw / 2, my - 10, tw, 20);
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, mx, my);
    };

    if (imageUrl) {
      drawSegment(pins.refStart, pins.refEnd, '#00d4aa', `REF ${refLengthMm.toFixed(1)} mm`);
      drawSegment(
        pins.targetStart,
        pins.targetEnd,
        '#ff6b1a',
        measurement ? formatLength(measurement.targetLengthMm, unit) : 'TARGET',
      );

      // Precision magnifier loupe while dragging a pin
      if (activePin && img) {
        const pin = pins[activePin];
        const loupeSize = 92;
        const lx = pin.x > 0.5 ? 14 : w - loupeSize - 14;
        const ly = 14;
        const zoom = 2.5;

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
        // Loupe crosshair
        ctx.strokeStyle = activePin.startsWith('ref') ? '#00d4aa' : '#ff6b1a';
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
  }, [imageUrl, imgSize, pins, refLengthMm, measurement, unit, liveCamera, activePin]);

  const openCamera = async () => {
    setCameraErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      setLiveCamera(true);
      window.setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      }, 30);
    } catch {
      setCameraErr(t.angle.cameraUnavailable);
    }
  };

  const freezeFrame = () => {
    const video = videoRef.current;
    if (!video) return;
    const capture = document.createElement('canvas');
    capture.width = video.videoWidth || 1280;
    capture.height = video.videoHeight || 720;
    const ctx = capture.getContext('2d');
    ctx?.drawImage(video, 0, 0, capture.width, capture.height);
    const url = capture.toDataURL('image/jpeg', 0.92);
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    setLiveCamera(false);
    setImageUrl(url);
  };

  const handleUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setLiveCamera(false);
        setImageUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const loadDemoBoard = () => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    setLiveCamera(false);
    setRefPreset('card');
    setImageUrl(createDemoGridDataUrl());
    setPins({
      refStart: { x: 100 / 800, y: 340 / 600 },
      refEnd: { x: (100 + 85.6 * 3) / 800, y: 340 / 600 },
      targetStart: { x: 160 / 800, y: 166 / 600 },
      targetEnd: { x: (160 + 140 * 3) / 800, y: 166 / 600 },
    });
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!imageUrl || liveCamera) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;

    const entries: [PinId, Point2D][] = [
      ['refStart', pins.refStart],
      ['refEnd', pins.refEnd],
      ['targetStart', pins.targetStart],
      ['targetEnd', pins.targetEnd],
    ];

    let closest: PinId | null = null;
    let minDist = 0.08;
    for (const [id, pt] of entries) {
      const dist = Math.hypot(pt.x - nx, pt.y - ny);
      if (dist < minDist) {
        minDist = dist;
        closest = id;
      }
    }

    if (closest) {
      canvas.setPointerCapture?.(e.pointerId);
      setActivePin(closest);
    }
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!activePin || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const nx = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const ny = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    setPins((prev) => ({ ...prev, [activePin]: { x: nx, y: ny } }));
  };

  const handlePointerUp = () => setActivePin(null);

  return (
    <div className="card-panel">
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
        {t.camera.refIntro}
      </p>

      <div className="hud-row">
        {liveCamera ? (
          <button type="button" className="btn primary" onClick={freezeFrame}>
            <Camera size={15} aria-hidden="true" />
            {t.camera.takePhoto}
          </button>
        ) : (
          <button type="button" className="btn primary" onClick={() => void openCamera()}>
            <Camera size={15} aria-hidden="true" />
            {t.camera.captureCamera}
          </button>
        )}

        <label className="btn" style={{ cursor: 'pointer' }}>
          <Upload size={15} aria-hidden="true" />
          {t.camera.uploadPhoto}
          <input
            type="file"
            accept="image/*"
            onChange={handleUpload}
            style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
          />
        </label>

        <button type="button" className="btn secondary" onClick={loadDemoBoard}>
          <Grid size={15} aria-hidden="true" />
          {t.camera.useDemoBoard}
        </button>
      </div>

      {cameraErr && <div className="callout warn">{cameraErr}</div>}

      <div className="camera-stage">
        {liveCamera ? (
          <video ref={videoRef} playsInline muted />
        ) : (
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            aria-label="Reference object photo measurement canvas"
          />
        )}
      </div>

      <div className="hud-row">
        <label style={{ flex: 1, minWidth: 160, fontSize: 12 }}>
          <span className="readout-label">{t.camera.refObjectLabel}</span>
          <select
            className="field-input"
            value={refPreset}
            onChange={(e) => setRefPreset(e.target.value)}
          >
            {PHOTO_REFERENCES.map((r) => (
              <option key={r.id} value={r.id}>
                {locale === 'ru' ? r.labelRu : r.labelEn}
              </option>
            ))}
          </select>
        </label>

        {refPreset === 'custom' && (
          <label style={{ width: 120, fontSize: 12 }}>
            <span className="readout-label">{t.camera.customMm}</span>
            <input
              type="number"
              className="field-input mono"
              min="1"
              step="any"
              value={customRefMm}
              onChange={(e) => setCustomRefMm(e.target.value)}
            />
          </label>
        )}

        <div className="segmented" role="group" aria-label="Units">
          {(['mm', 'cm', 'in'] as const).map((u) => (
            <button key={u} type="button" aria-pressed={unit === u} onClick={() => setUnit(u)}>
              {u}
            </button>
          ))}
        </div>
      </div>

      {imageUrl && (
        <div className="readout-grid">
          <div className="readout-box span-2">
            <div className="readout-label">{t.camera.measuredResult}</div>
            <div className="readout-value mono" data-testid="photo-ref-result">
              {measurement ? formatLength(measurement.targetLengthMm, unit) : '—'}
            </div>
          </div>
          <div className="readout-box">
            <div className="readout-label">{t.camera.scaleLabel}</div>
            <div className="readout-value small mono">
              {measurement ? `${measurement.pxPerMm.toFixed(2)} px/mm` : '—'}
            </div>
          </div>
          <div className="readout-box" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn primary"
              disabled={!measurement}
              onClick={() => {
                if (!measurement) return;
                onSaveMeasurement(
                  formatLength(measurement.targetLengthMm, unit),
                  `Ref: ${refLengthMm.toFixed(1)} mm`,
                );
              }}
            >
              <BookmarkPlus size={15} aria-hidden="true" />
              {t.camera.saveLog}
            </button>
          </div>
        </div>
      )}

      <p className="hud-hint">
        {t.camera.refStep1} · {t.camera.refStep2}
      </p>
    </div>
  );
}
