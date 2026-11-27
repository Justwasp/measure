import { useEffect, useRef, useState } from 'react';
import { BookmarkPlus, Camera, RotateCcw, VideoOff } from 'lucide-react';
import {
  betaToCameraElevationDeg,
  computeTrigoDistanceMeters,
  computeTrigoHeightMeters,
} from '../../core/camera/cameraMath';
import { useI18n } from '../../i18n/I18nContext';
import { useOrientationSensor } from '../angle/useOrientationSensor';

interface TrigoRangefinderModeProps {
  onSaveMeasurement: (valueText: string, detailText?: string) => void;
}

export function TrigoRangefinderMode({ onSaveMeasurement }: TrigoRangefinderModeProps) {
  const { t } = useI18n();
  const sensor = useOrientationSensor(false);
  const [cameraHeightCm, setCameraHeightCm] = useState(150);
  const [lockedDistanceM, setLockedDistanceM] = useState<number | null>(null);
  const [lockedHeightM, setLockedHeightM] = useState<number | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraErr, setCameraErr] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
    };
  }, []);

  // Default desktop simulator tilt to 65° beta (-25° downward) for immediate testing
  const effectiveBeta =
    sensor.hasLiveReading || sensor.simulatorEnabled ? sensor.sample.beta : 65;
  const elevationDeg = betaToCameraElevationDeg(effectiveBeta);
  const cameraHeightM = Math.max(0.1, cameraHeightCm / 100);

  const liveDistanceM = computeTrigoDistanceMeters(cameraHeightM, elevationDeg);
  const liveHeightM =
    lockedDistanceM !== null
      ? computeTrigoHeightMeters(cameraHeightM, lockedDistanceM, elevationDeg)
      : null;

  const startCamera = async () => {
    setCameraErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch {
      setCameraErr(t.angle.cameraUnavailable);
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  };

  const handleLockBase = () => {
    if (liveDistanceM !== null) {
      setLockedDistanceM(liveDistanceM);
      setLockedHeightM(null);
    }
  };

  const handleLockTop = () => {
    if (liveHeightM !== null) {
      setLockedHeightM(liveHeightM);
    }
  };

  const handleReset = () => {
    setLockedDistanceM(null);
    setLockedHeightM(null);
  };

  const handleSave = () => {
    const dist = lockedDistanceM ?? liveDistanceM;
    if (dist === null) return;
    const h = lockedHeightM ?? liveHeightM;
    const val = h !== null ? `D ${dist.toFixed(2)} m · H ${h.toFixed(2)} m` : `${dist.toFixed(2)} m`;
    onSaveMeasurement(val, `Camera H: ${cameraHeightCm} cm`);
  };

  return (
    <div className="card-panel">
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
        {t.camera.trigoIntro}
      </p>

      <div className="hud-row">
        {cameraActive ? (
          <button type="button" className="btn danger" onClick={stopCamera}>
            <VideoOff size={15} aria-hidden="true" />
            {t.angle.stopCamera}
          </button>
        ) : (
          <button type="button" className="btn primary" onClick={() => void startCamera()}>
            <Camera size={15} aria-hidden="true" />
            {t.camera.captureCamera}
          </button>
        )}
        {sensor.needsPermissionPrompt && (
          <button type="button" className="btn secondary" onClick={() => void sensor.requestPermission()}>
            {t.angle.requestSensor}
          </button>
        )}
      </div>

      {cameraErr && <div className="callout warn">{cameraErr}</div>}

      <div className="camera-stage">
        <video ref={videoRef} playsInline muted />
        {/* Rangefinder reticle */}
        <svg
          viewBox="0 0 400 300"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
          aria-hidden="true"
        >
          <circle cx="200" cy="150" r="36" fill="none" stroke="#ff6b1a" strokeWidth="2" />
          <line x1="140" y1="150" x2="188" y2="150" stroke="#ff6b1a" strokeWidth="2" />
          <line x1="212" y1="150" x2="260" y2="150" stroke="#ff6b1a" strokeWidth="2" />
          <line x1="200" y1="96" x2="200" y2="138" stroke="#ff6b1a" strokeWidth="2" />
          <line x1="200" y1="162" x2="200" y2="204" stroke="#ff6b1a" strokeWidth="2" />
          <circle cx="200" cy="150" r="3" fill="#00d4aa" />
        </svg>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
        <span style={{ flex: 1 }}>{t.camera.cameraHeightLabel}</span>
        <input
          type="number"
          className="field-input mono"
          style={{ width: 96 }}
          min={20}
          max={400}
          value={cameraHeightCm}
          onChange={(e) => setCameraHeightCm(Math.max(20, Number(e.target.value) || 150))}
        />
      </label>

      {!sensor.hasLiveReading && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
          <span className="mono" style={{ width: 130 }}>
            {t.camera.elevationLabel}: {elevationDeg.toFixed(1)}°
          </span>
          <input
            type="range"
            aria-label="Simulated camera pitch"
            min={15}
            max={160}
            step={0.5}
            value={effectiveBeta}
            onChange={(e) => sensor.setSimulatedSample({ beta: Number(e.target.value) })}
            style={{ flex: 1 }}
          />
        </label>
      )}

      <div className="readout-grid">
        <div className="readout-box">
          <div className="readout-label">{t.camera.distanceResult}</div>
          <div className="readout-value mono" data-testid="trigo-distance">
            {(lockedDistanceM ?? liveDistanceM) !== null
              ? `${(lockedDistanceM ?? liveDistanceM)!.toFixed(2)} m`
              : '—'}
          </div>
        </div>
        <div className="readout-box">
          <div className="readout-label">{t.camera.heightResult}</div>
          <div className="readout-value mono" data-testid="trigo-height">
            {(lockedHeightM ?? liveHeightM) !== null
              ? `${(lockedHeightM ?? liveHeightM)!.toFixed(2)} m`
              : '—'}
          </div>
        </div>
      </div>

      {liveDistanceM === null && lockedDistanceM === null && (
        <p className="hud-hint">{t.camera.aimDownHint}</p>
      )}

      <div className="hud-row" style={{ justifyContent: 'space-between' }}>
        <div className="hud-row">
          <button
            type="button"
            className="btn secondary"
            disabled={liveDistanceM === null}
            onClick={handleLockBase}
          >
            {t.camera.lockBase}
          </button>
          <button
            type="button"
            className="btn secondary"
            disabled={lockedDistanceM === null || liveHeightM === null}
            onClick={handleLockTop}
          >
            {t.camera.lockTop}
          </button>
          {lockedDistanceM !== null && (
            <button type="button" className="btn" onClick={handleReset}>
              <RotateCcw size={14} aria-hidden="true" />
              {t.camera.resetTrigo}
            </button>
          )}
        </div>
        <button
          type="button"
          className="btn primary"
          disabled={(lockedDistanceM ?? liveDistanceM) === null}
          onClick={handleSave}
        >
          <BookmarkPlus size={15} aria-hidden="true" />
          {t.camera.saveLog}
        </button>
      </div>
    </div>
  );
}
