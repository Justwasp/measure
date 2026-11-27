import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import {
  BookmarkPlus,
  Camera,
  Car,
  Download,
  Hand,
  Layers,
  Magnet,
  Maximize2,
  Minimize2,
  Plus,
  Square,
  Trash2,
  Upload,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { Point2D } from '../../core/camera/cameraMath';
import {
  applyOrthoSnap,
  canvasToNormalized,
  computeImageViewport,
  computePhotoMeasurement,
  createPlaneProjector,
  formatPhotoArea,
  formatPhotoLength,
  MEASUREMENT_PALETTE,
  mmToPhotoUnit,
  normalizedToCanvas,
  PHOTO_STUDIO_PRESETS,
  photoUnitToMm,
  type PhotoCalibrationMode,
  type PhotoMeasurementItem,
  type PhotoMeasurementKind,
  type PhotoQuad,
  type PhotoUnit,
} from '../../core/photo/photoMeasureMath';
import { useI18n } from '../../i18n/I18nContext';
import { createCarBlueprintDemo, createPerspectiveWallDemo } from './demoBlueprints';
import { renderPhotoOverlay } from './renderPhotoOverlay';

interface PhotoMeasureViewProps {
  onSaveMeasurement: (valueText: string, detailText?: string) => void;
}

type DragTarget =
  | { kind: 'none' }
  | { kind: 'pan'; startClientX: number; startClientY: number; startPanX: number; startPanY: number }
  | { kind: 'ref-line'; end: 'start' | 'end' }
  | { kind: 'ref-quad'; corner: keyof PhotoQuad }
  | { kind: 'item'; itemId: string; end: 'start' | 'end' };

const PIN_HIT_PX = 24;

export function PhotoMeasureView({ onSaveMeasurement }: PhotoMeasureViewProps) {
  const { t, locale } = useI18n();

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imgSize, setImgSize] = useState({ w: 1200, h: 600 });
  const [liveCamera, setLiveCamera] = useState(false);
  const [cameraErr, setCameraErr] = useState<string | null>(null);

  const [mode, setMode] = useState<PhotoCalibrationMode>('line');
  const [unit, setUnit] = useState<PhotoUnit>('m');
  const [presetId, setPresetId] = useState<string>('car-tire');
  const [orthoSnap, setOrthoSnap] = useState(false);
  const [panMode, setPanMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [stageSize, setStageSize] = useState({ w: 600, h: 380 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Reference geometry
  const [refStart, setRefStart] = useState<Point2D>({ x: 0.2, y: 0.7 });
  const [refEnd, setRefEnd] = useState<Point2D>({ x: 0.35, y: 0.7 });
  const [refLengthMm, setRefLengthMm] = useState<number>(660);
  const [refLengthInput, setRefLengthInput] = useState<string>('0.66');

  const [refQuad, setRefQuad] = useState<PhotoQuad>({
    tl: { x: 0.25, y: 0.25 },
    tr: { x: 0.5, y: 0.25 },
    br: { x: 0.5, y: 0.75 },
    bl: { x: 0.25, y: 0.75 },
  });
  const [refQuadWidthMm, setRefQuadWidthMm] = useState<number>(800);
  const [refQuadHeightMm, setRefQuadHeightMm] = useState<number>(2000);
  const [quadWidthInput, setQuadWidthInput] = useState<string>('0.80');
  const [quadHeightInput, setQuadHeightInput] = useState<string>('2.00');

  // Unlimited simultaneous measurements
  const [measurements, setMeasurements] = useState<PhotoMeasurementItem[]>([
    {
      id: 'm-1',
      label: 'M1',
      kind: 'line',
      start: { x: 0.15, y: 0.35 },
      end: { x: 0.85, y: 0.35 },
      color: MEASUREMENT_PALETTE[0],
    },
  ]);
  const [selectedId, setSelectedId] = useState<string | null>('m-1');
  const [dragTarget, setDragTarget] = useState<DragTarget>({ kind: 'none' });

  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const loadedImageRef = useRef<HTMLImageElement | null>(null);
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStartRef = useRef<{
    dist: number;
    zoom: number;
    midX: number;
    midY: number;
    panX: number;
    panY: number;
  } | null>(null);

  const formatInputValue = useCallback((mm: number, u: PhotoUnit) => {
    const val = mmToPhotoUnit(mm, u);
    return val.toFixed(u === 'mm' ? 1 : 2);
  }, []);

  // Cleanup live camera on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
    };
  }, []);

  // Track canvas container size across fullscreen toggles and phone portrait/landscape rotation
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      const w = Math.max(240, Math.round(rect.width || 600));
      const h = Math.max(220, Math.round(rect.height || 380));
      setStageSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [isFullscreen]);

  // Allow Escape key to close fullscreen overlay cleanly
  useEffect(() => {
    if (!isFullscreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFullscreen]);

  // Load uploaded/captured image into HTMLImageElement
  useEffect(() => {
    if (!imageUrl) {
      loadedImageRef.current = null;
      return;
    }
    const img = new Image();
    img.onload = () => {
      loadedImageRef.current = img;
      setImgSize({ w: img.naturalWidth || 1200, h: img.naturalHeight || 600 });
    };
    img.src = imageUrl;
  }, [imageUrl]);

  const projector = useMemo(
    () =>
      createPlaneProjector({
        mode,
        imgW: imgSize.w,
        imgH: imgSize.h,
        refStart,
        refEnd,
        refLengthMm,
        refQuad,
        refQuadWidthMm,
        refQuadHeightMm,
      }),
    [mode, imgSize, refStart, refEnd, refLengthMm, refQuad, refQuadWidthMm, refQuadHeightMm],
  );

  const activeLoupePoint = useMemo(() => {
    if (dragTarget.kind === 'ref-line') {
      return { point: dragTarget.end === 'start' ? refStart : refEnd, color: '#00d4aa' };
    }
    if (dragTarget.kind === 'ref-quad') {
      return { point: refQuad[dragTarget.corner], color: '#00d4aa' };
    }
    if (dragTarget.kind === 'item') {
      const item = measurements.find((m) => m.id === dragTarget.itemId);
      if (item) {
        return {
          point: dragTarget.end === 'start' ? item.start : item.end,
          color: item.color,
        };
      }
    }
    return null;
  }, [dragTarget, refStart, refEnd, refQuad, measurements]);

  // Draw interactive canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || liveCamera) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { w, h } = stageSize;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform?.(dpr, 0, 0, dpr, 0, 0);
    if (!ctx.setTransform) ctx.scale(dpr, dpr);

    const vp = computeImageViewport(imgSize.w, imgSize.h, w, h, zoom, pan.x, pan.y);
    renderPhotoOverlay({
      ctx,
      canvasW: w,
      canvasH: h,
      img: loadedImageRef.current,
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
    });
  }, [
    imageUrl,
    imgSize,
    stageSize,
    zoom,
    pan,
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
    liveCamera,
  ]);

  const handleUnitChange = (nextUnit: PhotoUnit) => {
    setUnit(nextUnit);
    setRefLengthInput(formatInputValue(refLengthMm, nextUnit));
    setQuadWidthInput(formatInputValue(refQuadWidthMm, nextUnit));
    setQuadHeightInput(formatInputValue(refQuadHeightMm, nextUnit));
  };

  const handlePresetChange = (nextId: string) => {
    setPresetId(nextId);
    const preset = PHOTO_STUDIO_PRESETS.find((p) => p.id === nextId);
    if (!preset || nextId === 'custom') return;
    setUnit(preset.defaultUnit);
    setRefLengthMm(preset.lengthMm);
    setRefLengthInput(formatInputValue(preset.lengthMm, preset.defaultUnit));
    if (preset.heightMm) {
      setRefQuadWidthMm(preset.lengthMm);
      setRefQuadHeightMm(preset.heightMm);
      setQuadWidthInput(formatInputValue(preset.lengthMm, preset.defaultUnit));
      setQuadHeightInput(formatInputValue(preset.heightMm, preset.defaultUnit));
    }
  };

  const handleUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        streamRef.current?.getTracks().forEach((tr) => tr.stop());
        streamRef.current = null;
        setLiveCamera(false);
        setZoom(1);
        setPan({ x: 0, y: 0 });
        setImageUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

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

  const captureCameraFrame = () => {
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
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setImageUrl(url);
  };

  const loadDemo = (kind: 'car' | 'wall') => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    setLiveCamera(false);
    setZoom(1);
    setPan({ x: 0, y: 0 });

    const demo = kind === 'car' ? createCarBlueprintDemo() : createPerspectiveWallDemo();
    setImgSize({ w: demo.width, h: demo.height });
    setImageUrl(demo.dataUrl);
    setMode(demo.mode);
    setUnit(demo.unit);
    setPresetId(demo.presetId);
    setRefStart(demo.refStart);
    setRefEnd(demo.refEnd);
    setRefLengthMm(demo.refLengthMm);
    setRefLengthInput(formatInputValue(demo.refLengthMm, demo.unit));
    setRefQuad(demo.refQuad);
    setRefQuadWidthMm(demo.refQuadWidthMm);
    setRefQuadHeightMm(demo.refQuadHeightMm);
    setQuadWidthInput(formatInputValue(demo.refQuadWidthMm, demo.unit));
    setQuadHeightInput(formatInputValue(demo.refQuadHeightMm, demo.unit));
    setMeasurements(demo.measurements);
    setSelectedId(demo.measurements[0]?.id ?? null);
  };

  const addMeasurement = (kind: PhotoMeasurementKind) => {
    const idx = measurements.length + 1;
    const color = MEASUREMENT_PALETTE[(idx - 1) % MEASUREMENT_PALETTE.length];
    const offset = ((idx - 1) % 4) * 0.06;
    const next: PhotoMeasurementItem = {
      id: `m-${Date.now()}-${idx}`,
      label: kind === 'box' ? `Box ${idx}` : `L${idx}`,
      kind,
      start: { x: 0.2 + offset, y: 0.25 + offset },
      end: { x: 0.65 + offset * 0.5, y: kind === 'box' ? 0.65 + offset * 0.5 : 0.25 + offset },
      color,
    };
    setMeasurements((prev) => [...prev, next]);
    setSelectedId(next.id);
  };

  const handleExportPng = () => {
    const img = loadedImageRef.current;
    if (!img) return;
    const out = document.createElement('canvas');
    out.width = img.naturalWidth || imgSize.w;
    out.height = img.naturalHeight || imgSize.h;
    const ctx = out.getContext('2d');
    if (!ctx) return;

    const vp = computeImageViewport(out.width, out.height, out.width, out.height, 1, 0, 0);
    renderPhotoOverlay({
      ctx,
      canvasW: out.width,
      canvasH: out.height,
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
      selectedId: null,
      forExport: true,
    });

    const link = document.createElement('a');
    link.download = `measure-photo-${Date.now()}.png`;
    link.href = out.toDataURL('image/png');
    link.click();
  };

  const handleSaveAll = () => {
    if (!projector || measurements.length === 0) return;
    const summaries = measurements
      .map((item) => {
        const res = computePhotoMeasurement(item, projector);
        if (!res) return null;
        if (res.kind === 'line') {
          return `${item.label}: ${formatPhotoLength(res.lengthMm, unit)}`;
        }
        return `${item.label}: ${formatPhotoLength(res.widthMm, unit)} × ${formatPhotoLength(res.heightMm, unit)}`;
      })
      .filter((s): s is string => s !== null);

    if (summaries.length === 0) return;
    onSaveMeasurement(summaries[0], summaries.slice(1).join(' · ') || `Mode: ${mode}`);
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!imageUrl || liveCamera) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const { w, h } = stageSize;
    const vp = computeImageViewport(imgSize.w, imgSize.h, w, h, zoom, pan.x, pan.y);

    canvas.setPointerCapture?.(e.pointerId);
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Two-finger pinch-zoom & pan on mobile touch screens
    if (activePointersRef.current.size === 2) {
      const pts = Array.from(activePointersRef.current.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      pinchStartRef.current = {
        dist: Math.max(10, dist),
        zoom,
        midX: (pts[0].x + pts[1].x) / 2,
        midY: (pts[0].y + pts[1].y) / 2,
        panX: pan.x,
        panY: pan.y,
      };
      setDragTarget({ kind: 'none' });
      return;
    }

    if (panMode) {
      setDragTarget({
        kind: 'pan',
        startClientX: e.clientX,
        startClientY: e.clientY,
        startPanX: pan.x,
        startPanY: pan.y,
      });
      return;
    }

    // Hit-test pins in canvas pixel space (closest wins)
    const candidates: Array<{ target: DragTarget; pt: Point2D; itemId?: string }> = [];

    for (const item of measurements) {
      candidates.push({ target: { kind: 'item', itemId: item.id, end: 'start' }, pt: item.start, itemId: item.id });
      candidates.push({ target: { kind: 'item', itemId: item.id, end: 'end' }, pt: item.end, itemId: item.id });
    }

    if (mode === 'line') {
      candidates.push({ target: { kind: 'ref-line', end: 'start' }, pt: refStart });
      candidates.push({ target: { kind: 'ref-line', end: 'end' }, pt: refEnd });
    } else {
      (['tl', 'tr', 'br', 'bl'] as const).forEach((corner) => {
        candidates.push({ target: { kind: 'ref-quad', corner }, pt: refQuad[corner] });
      });
    }

    let best: { target: DragTarget; itemId?: string } | null = null;
    let bestDist = PIN_HIT_PX;
    for (const cand of candidates) {
      const p = normalizedToCanvas(cand.pt, vp);
      const d = Math.hypot(p.x - cx, p.y - cy);
      if (d < bestDist) {
        bestDist = d;
        best = { target: cand.target, itemId: cand.itemId };
      }
    }

    if (best) {
      setDragTarget(best.target);
      if (best.itemId) setSelectedId(best.itemId);
      return;
    }

    // Dragging empty space when zoomed > 1x smoothly pans the blueprint
    if (zoom > 1) {
      setDragTarget({
        kind: 'pan',
        startClientX: e.clientX,
        startClientY: e.clientY,
        startPanX: pan.x,
        startPanY: pan.y,
      });
    }
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (activePointersRef.current.has(e.pointerId)) {
      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    // Handle active 2-finger pinch-zoom + pan
    if (activePointersRef.current.size === 2 && pinchStartRef.current) {
      const pts = Array.from(activePointersRef.current.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      const nextZoom = Math.max(
        1,
        Math.min(6, Number((pinchStartRef.current.zoom * (dist / pinchStartRef.current.dist)).toFixed(2))),
      );
      setZoom(nextZoom);
      setPan({
        x: pinchStartRef.current.panX + (midX - pinchStartRef.current.midX),
        y: pinchStartRef.current.panY + (midY - pinchStartRef.current.midY),
      });
      return;
    }

    if (dragTarget.kind === 'none' || !canvasRef.current) return;

    if (dragTarget.kind === 'pan') {
      setPan({
        x: dragTarget.startPanX + (e.clientX - dragTarget.startClientX),
        y: dragTarget.startPanY + (e.clientY - dragTarget.startClientY),
      });
      return;
    }

    const rect = canvasRef.current.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const { w, h } = stageSize;
    const vp = computeImageViewport(imgSize.w, imgSize.h, w, h, zoom, pan.x, pan.y);
    const raw = canvasToNormalized({ x: cx, y: cy }, vp);
    const clamped: Point2D = {
      x: Math.min(1, Math.max(0, raw.x)),
      y: Math.min(1, Math.max(0, raw.y)),
    };

    if (dragTarget.kind === 'ref-line') {
      if (dragTarget.end === 'start') {
        const next = orthoSnap ? applyOrthoSnap(refEnd, clamped, imgSize.w, imgSize.h) : clamped;
        setRefStart(next);
      } else {
        const next = orthoSnap ? applyOrthoSnap(refStart, clamped, imgSize.w, imgSize.h) : clamped;
        setRefEnd(next);
      }
      return;
    }

    if (dragTarget.kind === 'ref-quad') {
      setRefQuad((prev) => ({ ...prev, [dragTarget.corner]: clamped }));
      return;
    }

    if (dragTarget.kind === 'item') {
      setMeasurements((prev) =>
        prev.map((item) => {
          if (item.id !== dragTarget.itemId) return item;
          if (dragTarget.end === 'start') {
            const next =
              orthoSnap && item.kind === 'line'
                ? applyOrthoSnap(item.end, clamped, imgSize.w, imgSize.h)
                : clamped;
            return { ...item, start: next };
          }
          const next =
            orthoSnap && item.kind === 'line'
              ? applyOrthoSnap(item.start, clamped, imgSize.w, imgSize.h)
              : clamped;
          return { ...item, end: next };
        }),
      );
    }
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    activePointersRef.current.delete(e.pointerId);
    if (activePointersRef.current.size < 2) {
      pinchStartRef.current = null;
    }
    setDragTarget({ kind: 'none' });
  };

  const selectedItem = measurements.find((m) => m.id === selectedId) ?? measurements[0] ?? null;
  const selectedMetrics = selectedItem ? computePhotoMeasurement(selectedItem, projector) : null;
  const activeReadoutText = (() => {
    if (!selectedItem || !selectedMetrics) return null;
    if (selectedMetrics.kind === 'line') {
      return `${selectedItem.label}: ${formatPhotoLength(selectedMetrics.lengthMm, unit)}`;
    }
    return `${selectedItem.label}: ${formatPhotoLength(selectedMetrics.widthMm, unit)} × ${formatPhotoLength(selectedMetrics.heightMm, unit)} (⌀ ${formatPhotoLength(selectedMetrics.diagonalMm, unit)})`;
  })();

  const handleWheel = (e: ReactWheelEvent<HTMLCanvasElement>) => {
    if (!imageUrl || liveCamera) return;
    const delta = e.deltaY < 0 ? 0.25 : -0.25;
    setZoom((z) => Math.max(1, Math.min(6, Number((z + delta).toFixed(2)))));
  };

  return (
    <section className="feature-panel photo-studio" aria-label={t.tabs.photo}>
      <div className="card-panel">
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>{t.photo.intro}</p>

        {/* Source Loader Row */}
        <div className="hud-row">
          <label className="btn primary" style={{ cursor: 'pointer' }}>
            <Upload size={15} aria-hidden="true" />
            {t.photo.uploadPhoto}
            <input
              type="file"
              accept="image/*"
              onChange={handleUpload}
              style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
            />
          </label>

          {liveCamera ? (
            <button type="button" className="btn primary" onClick={captureCameraFrame}>
              <Camera size={15} aria-hidden="true" />
              {t.camera.takePhoto}
            </button>
          ) : (
            <button type="button" className="btn" onClick={() => void openCamera()}>
              <Camera size={15} aria-hidden="true" />
              {t.camera.captureCamera}
            </button>
          )}

          <button type="button" className="btn secondary" onClick={() => loadDemo('car')}>
            <Car size={15} aria-hidden="true" />
            {t.photo.demoCar}
          </button>

          <button type="button" className="btn secondary" onClick={() => loadDemo('wall')}>
            <Layers size={15} aria-hidden="true" />
            {t.photo.demoWall}
          </button>
        </div>

        {cameraErr && <div className="callout warn">{cameraErr}</div>}

        {/* Calibration Mode & Reference Dimension Bar */}
        <div className="hud-row" style={{ justifyContent: 'space-between' }}>
          <div className="segmented" role="group" aria-label="Calibration mode">
            <button type="button" aria-pressed={mode === 'line'} onClick={() => setMode('line')}>
              {t.photo.mode2d}
            </button>
            <button
              type="button"
              aria-pressed={mode === 'perspective'}
              onClick={() => setMode('perspective')}
            >
              {t.photo.modePerspective}
            </button>
          </div>

          <div className="segmented" role="group" aria-label="Units">
            {(['mm', 'cm', 'm', 'in'] as const).map((u) => (
              <button
                key={u}
                type="button"
                aria-pressed={unit === u}
                onClick={() => handleUnitChange(u)}
              >
                {u}
              </button>
            ))}
          </div>
        </div>

        <div className="hud-row">
          <label style={{ flex: 2, minWidth: 165, fontSize: 12 }}>
            <span className="readout-label">{t.photo.presetLabel}</span>
            <select
              className="field-input"
              value={presetId}
              onChange={(e) => handlePresetChange(e.target.value)}
            >
              {PHOTO_STUDIO_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {locale === 'ru' ? p.labelRu : p.labelEn}
                </option>
              ))}
            </select>
          </label>

          {mode === 'line' ? (
            <label style={{ flex: 1, minWidth: 110, fontSize: 12 }}>
              <span className="readout-label">
                {t.photo.knownLength} ({unit})
              </span>
              <input
                type="number"
                inputMode="decimal"
                min="0.01"
                step="any"
                className="field-input mono"
                value={refLengthInput}
                onChange={(e) => {
                  setRefLengthInput(e.target.value);
                  setPresetId('custom');
                  const parsed = Number.parseFloat(e.target.value.replace(',', '.'));
                  if (Number.isFinite(parsed) && parsed > 0) {
                    setRefLengthMm(photoUnitToMm(parsed, unit));
                  }
                }}
              />
            </label>
          ) : (
            <>
              <label style={{ flex: 1, minWidth: 92, fontSize: 12 }}>
                <span className="readout-label">
                  {t.photo.knownWidth} ({unit})
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="any"
                  className="field-input mono"
                  value={quadWidthInput}
                  onChange={(e) => {
                    setQuadWidthInput(e.target.value);
                    setPresetId('custom');
                    const parsed = Number.parseFloat(e.target.value.replace(',', '.'));
                    if (Number.isFinite(parsed) && parsed > 0) {
                      setRefQuadWidthMm(photoUnitToMm(parsed, unit));
                    }
                  }}
                />
              </label>
              <label style={{ flex: 1, minWidth: 92, fontSize: 12 }}>
                <span className="readout-label">
                  {t.photo.knownHeight} ({unit})
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="any"
                  className="field-input mono"
                  value={quadHeightInput}
                  onChange={(e) => {
                    setQuadHeightInput(e.target.value);
                    setPresetId('custom');
                    const parsed = Number.parseFloat(e.target.value.replace(',', '.'));
                    if (Number.isFinite(parsed) && parsed > 0) {
                      setRefQuadHeightMm(photoUnitToMm(parsed, unit));
                    }
                  }}
                />
              </label>
            </>
          )}
        </div>

        {/* Interactive Photo / Blueprint Canvas (supports edge-to-edge Fullscreen on iOS/Android) */}
        <div
          ref={stageRef}
          className={`photo-canvas-stage ${isFullscreen ? 'fullscreen' : ''}`}
          data-testid="photo-canvas-stage"
        >
          {liveCamera ? (
            <video ref={videoRef} playsInline muted />
          ) : (
            <>
              <canvas
                ref={canvasRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onWheel={handleWheel}
                aria-label="Interactive photo and blueprint measurement workspace"
              />
              {!imageUrl && (
                <div className="photo-empty-overlay">
                  <p style={{ margin: 0, maxWidth: 320 }}>{t.photo.emptyPrompt}</p>
                </div>
              )}

              {/* Quick Fullscreen expand button on inline canvas */}
              {!isFullscreen && imageUrl && (
                <button
                  type="button"
                  className="photo-fs-fab"
                  onClick={() => setIsFullscreen(true)}
                  aria-label={t.photo.fullscreen}
                  data-testid="photo-fullscreen-btn"
                >
                  <Maximize2 size={16} aria-hidden="true" />
                  <span>{t.photo.fullscreen}</span>
                </button>
              )}

              {/* Edge-to-edge Fullscreen Floating HUD */}
              {isFullscreen && (
                <>
                  <div className="photo-fs-topbar">
                    <div className="photo-fs-readout mono" data-testid="photo-fs-readout">
                      {activeReadoutText ?? `REF ${formatPhotoLength(refLengthMm, unit)}`}
                    </div>
                    <button
                      type="button"
                      className="btn primary"
                      onClick={() => setIsFullscreen(false)}
                      data-testid="photo-exit-fullscreen-btn"
                    >
                      <Minimize2 size={15} aria-hidden="true" />
                      {t.photo.exitFullscreen}
                    </button>
                  </div>

                  <div className="photo-fs-bottombar">
                    <button
                      type="button"
                      className="btn primary"
                      onClick={() => addMeasurement('line')}
                    >
                      <Plus size={14} aria-hidden="true" />
                      {t.photo.addLine}
                    </button>
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={() => addMeasurement('box')}
                    >
                      <Square size={14} aria-hidden="true" />
                      {t.photo.addBox}
                    </button>
                    <button
                      type="button"
                      className={`btn ${orthoSnap ? 'active' : ''}`}
                      onClick={() => setOrthoSnap((prev) => !prev)}
                    >
                      <Magnet size={14} aria-hidden="true" />
                      0°/90°
                    </button>
                    <button
                      type="button"
                      className={`icon-btn ${panMode ? 'active' : ''}`}
                      aria-label={t.photo.panMode}
                      onClick={() => setPanMode((prev) => !prev)}
                    >
                      <Hand size={15} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label="Zoom out"
                      onClick={() =>
                        setZoom((z) => {
                          const next = Math.max(1, Number((z - 0.5).toFixed(2)));
                          if (next === 1) setPan({ x: 0, y: 0 });
                          return next;
                        })
                      }
                    >
                      <ZoomOut size={15} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="btn mono"
                      onClick={() => {
                        setZoom(1);
                        setPan({ x: 0, y: 0 });
                      }}
                    >
                      {Math.round(zoom * 100)}%
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label="Zoom in"
                      onClick={() => setZoom((z) => Math.min(6, Number((z + 0.5).toFixed(2))))}
                    >
                      <ZoomIn size={15} aria-hidden="true" />
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Canvas Tools Row */}
        <div className="hud-row" style={{ justifyContent: 'space-between' }}>
          <div className="hud-row">
            <button type="button" className="btn primary" onClick={() => addMeasurement('line')}>
              <Plus size={14} aria-hidden="true" />
              {t.photo.addLine}
            </button>
            <button type="button" className="btn secondary" onClick={() => addMeasurement('box')}>
              <Square size={14} aria-hidden="true" />
              {t.photo.addBox}
            </button>
            <button
              type="button"
              className={`btn ${orthoSnap ? 'active' : ''}`}
              onClick={() => setOrthoSnap((prev) => !prev)}
            >
              <Magnet size={14} aria-hidden="true" />
              0°/90°
            </button>
          </div>

          <div className="hud-row">
            <button
              type="button"
              className={`icon-btn ${panMode ? 'active' : ''}`}
              aria-label={t.photo.panMode}
              onClick={() => setPanMode((prev) => !prev)}
            >
              <Hand size={15} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label="Zoom out"
              onClick={() =>
                setZoom((z) => {
                  const next = Math.max(1, Number((z - 0.5).toFixed(2)));
                  if (next === 1) setPan({ x: 0, y: 0 });
                  return next;
                })
              }
            >
              <ZoomOut size={15} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="btn mono"
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label="Zoom in"
              onClick={() => setZoom((z) => Math.min(6, Number((z + 0.5).toFixed(2))))}
            >
              <ZoomIn size={15} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="btn secondary"
              disabled={!imageUrl || liveCamera}
              onClick={() => setIsFullscreen(true)}
            >
              <Maximize2 size={14} aria-hidden="true" />
              {t.photo.fullscreen}
            </button>
          </div>
        </div>

        {/* Measurements Breakdown List */}
        {imageUrl && (
          <div className="photo-measurements-list" data-testid="photo-measurements-list">
            {measurements.map((item) => {
              const res = computePhotoMeasurement(item, projector);
              const isSelected = item.id === selectedId;
              return (
                <div
                  key={item.id}
                  className={`photo-measure-row ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedId(item.id)}
                >
                  <span
                    className="color-chip"
                    style={{ background: item.color }}
                    aria-hidden="true"
                  />
                  <input
                    type="text"
                    aria-label="Measurement label"
                    className="measure-label-input"
                    value={item.label}
                    onChange={(e) =>
                      setMeasurements((prev) =>
                        prev.map((m) => (m.id === item.id ? { ...m, label: e.target.value } : m)),
                      )
                    }
                  />
                  <div className="mono measure-result-cell">
                    {!res ? (
                      '—'
                    ) : res.kind === 'line' ? (
                      <strong>{formatPhotoLength(res.lengthMm, unit)}</strong>
                    ) : (
                      <span>
                        <strong>
                          {formatPhotoLength(res.widthMm, unit)} ×{' '}
                          {formatPhotoLength(res.heightMm, unit)}
                        </strong>
                        <span className="measure-sub">
                          {' '}
                          · ⌀ {formatPhotoLength(res.diagonalMm, unit)} (
                          {(res.diagonalMm / 25.4).toFixed(1)}&quot;) ·{' '}
                          {formatPhotoArea(res.areaMm2, unit)}
                        </span>
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={t.history.delete}
                    onClick={(e) => {
                      e.stopPropagation();
                      setMeasurements((prev) => prev.filter((m) => m.id !== item.id));
                    }}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer Actions: Export PNG & Save to Log */}
        <div className="hud-row" style={{ justifyContent: 'space-between' }}>
          <p className="hud-hint">
            {mode === 'line' ? t.photo.hint2d : t.photo.hintPerspective}
          </p>
          <div className="hud-row">
            <button
              type="button"
              className="btn"
              disabled={!imageUrl}
              onClick={handleExportPng}
            >
              <Download size={14} aria-hidden="true" />
              {t.photo.exportPng}
            </button>
            <button
              type="button"
              className="btn primary"
              disabled={!imageUrl || !projector || measurements.length === 0}
              onClick={handleSaveAll}
            >
              <BookmarkPlus size={14} aria-hidden="true" />
              {t.photo.saveLog}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
