import { useEffect, useRef, useState } from 'react';
import {
  BookmarkPlus,
  Camera,
  Compass,
  Pause,
  Play,
  RotateCcw,
  Sliders,
  VideoOff,
} from 'lucide-react';
import {
  angleToPitchRatio,
  angleToSlopePercent,
  computeBullseye,
  normalizeAngle180,
  relativeAngleDeg,
} from '../../core/angle/angleMath';
import { detectPlatform } from '../../core/calibration/detectDevice';
import type { ResolvedColorScheme } from '../../core/theme/useColorScheme';
import { useI18n } from '../../i18n/I18nContext';
import { LevelCanvas } from './LevelCanvas';
import { useOrientationSensor } from './useOrientationSensor';

interface AngleViewProps {
  colorScheme: ResolvedColorScheme;
  onSaveMeasurement: (valueText: string, detailText?: string) => void;
}

type AngleSubMode = 'edge' | 'bullseye' | 'camera';

interface LockableScreenOrientation {
  lock?: (orientation: string) => Promise<void>;
  unlock?: () => void;
}

export function AngleView({ colorScheme, onSaveMeasurement }: AngleViewProps) {
  const { t } = useI18n();
  const [subMode, setSubMode] = useState<AngleSubMode>('edge');
  const [held, setHeld] = useState(false);
  const [tareDeg, setTareDeg] = useState<number | null>(null);
  const [reticleDeg, setReticleDeg] = useState(0);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isShortLandscape, setIsShortLandscape] = useState(() =>
    typeof window !== 'undefined'
      ? window.innerWidth > window.innerHeight && window.innerHeight <= 540
      : false,
  );

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const sensor = useOrientationSensor(held);
  const platform = detectPlatform(typeof navigator !== 'undefined' ? navigator.userAgent : '');

  // Attempt native portrait orientation lock while measuring angles (works on Android PWA;
  // gracefully ignored on iOS Safari where WebKit blocks screen.orientation.lock).
  useEffect(() => {
    const orientation = (
      typeof screen !== 'undefined' ? screen.orientation : undefined
    ) as LockableScreenOrientation | undefined;

    let lockedByUs = false;
    if (orientation?.lock) {
      Promise.resolve(orientation.lock('portrait'))
        .then(() => {
          lockedByUs = true;
        })
        .catch(() => {
          // Expected on iOS Safari and desktop browsers without fullscreen orientation lock
        });
    }

    return () => {
      if (lockedByUs && orientation?.unlock) {
        try {
          orientation.unlock();
        } catch {
          // Ignore unlock errors
        }
      }
    };
  }, []);

  // Track short mobile landscape viewport (for iOS orientation-lock tip)
  useEffect(() => {
    const onResize = () => {
      setIsShortLandscape(window.innerWidth > window.innerHeight && window.innerHeight <= 540);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Stop camera stream cleanly when leaving camera sub-mode or unmounting
  useEffect(() => {
    if (subMode !== 'camera' && streamRef.current) {
      streamRef.current.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
      setCameraActive(false);
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((tr) => tr.stop());
        streamRef.current = null;
      }
    };
  }, [subMode]);

  const startCameraOverlay = async () => {
    setCameraError(null);
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
      setCameraError(t.angle.cameraUnavailable);
      setCameraActive(false);
    }
  };

  const stopCameraOverlay = () => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  };

  const rawEdgeDeg = normalizeAngle180(sensor.sample.gamma);
  const displayedEdgeDeg =
    tareDeg !== null ? relativeAngleDeg(rawEdgeDeg, tareDeg) : rawEdgeDeg;

  const slopePct = angleToSlopePercent(displayedEdgeDeg);
  const pitchRatio = angleToPitchRatio(displayedEdgeDeg);
  const bullseye = computeBullseye(sensor.sample.beta, sensor.sample.gamma, 15, 0.35);

  const isEdgeLevel =
    Math.abs(displayedEdgeDeg) <= 0.3 || Math.abs(Math.abs(displayedEdgeDeg) - 90) <= 0.3;

  const handleSave = () => {
    if (subMode === 'edge') {
      const val = `${displayedEdgeDeg.toFixed(1)}°`;
      const details = [
        tareDeg !== null ? `${t.angle.relative} (Tare ${tareDeg.toFixed(1)}°)` : t.angle.absolute,
        slopePct !== null ? `${t.angle.slope}: ${slopePct.toFixed(1)}%` : null,
        pitchRatio !== null ? `${t.angle.ratio}: 1:${pitchRatio.toFixed(1)}` : null,
      ]
        .filter(Boolean)
        .join(' · ');
      onSaveMeasurement(val, details);
    } else if (subMode === 'bullseye') {
      onSaveMeasurement(
        `${bullseye.totalTiltDeg.toFixed(1)}°`,
        `${t.angle.pitch}: ${sensor.sample.beta.toFixed(1)}° · ${t.angle.roll}: ${sensor.sample.gamma.toFixed(1)}°`,
      );
    } else {
      onSaveMeasurement(`${reticleDeg.toFixed(1)}°`, t.angle.modeCamera);
    }
  };

  return (
    <section className="feature-panel angle-panel" aria-label={t.tabs.angle}>
      {/* Sub-mode switcher & simulator toggle */}
      <div className="hud-row angle-toolbar" style={{ justifyContent: 'space-between' }}>
        <div className="segmented" role="group" aria-label="Angle mode">
          <button
            type="button"
            aria-pressed={subMode === 'edge'}
            onClick={() => setSubMode('edge')}
          >
            {t.angle.modeEdge}
          </button>
          <button
            type="button"
            aria-pressed={subMode === 'bullseye'}
            onClick={() => setSubMode('bullseye')}
          >
            {t.angle.modeBullseye}
          </button>
          <button
            type="button"
            aria-pressed={subMode === 'camera'}
            onClick={() => setSubMode('camera')}
          >
            {t.angle.modeCamera}
          </button>
        </div>

        <button
          type="button"
          className={`btn ${sensor.simulatorEnabled ? 'secondary' : ''}`}
          onClick={() => sensor.setSimulatorEnabled((prev) => !prev)}
          data-testid="angle-simulator-toggle"
        >
          <Sliders size={14} aria-hidden="true" />
          {sensor.simulatorEnabled ? t.angle.simulatorActive : t.angle.simulatorMode}
        </button>
      </div>

      {/* Sensor permission & HTTPS notices */}
      {!sensor.isSecureContext && (
        <div className="callout warn">{t.angle.httpsNote}</div>
      )}
      {sensor.needsPermissionPrompt && !sensor.simulatorEnabled && (
        <div className="callout info">
          <div className="hud-row" style={{ justifyContent: 'space-between' }}>
            <span>{t.angle.iosPermissionNote}</span>
            <button
              type="button"
              className="btn primary"
              onClick={() => void sensor.requestPermission()}
            >
              <Compass size={15} aria-hidden="true" />
              {t.angle.requestSensor}
            </button>
          </div>
        </div>
      )}

      {/* Main Instrument Panel */}
      <div className="card-panel angle-card">
        {subMode === 'camera' ? (
          <>
            <div className="camera-stage">
              <video ref={videoRef} playsInline muted />
              <svg
                viewBox="0 0 400 300"
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none',
                }}
                aria-hidden="true"
              >
                <line
                  x1="20"
                  y1="150"
                  x2="380"
                  y2="150"
                  stroke="#00d4aa"
                  strokeWidth="1.5"
                  strokeDasharray="6 4"
                />
                <circle
                  cx="200"
                  cy="150"
                  r="95"
                  fill="none"
                  stroke="rgba(255,255,255,0.45)"
                  strokeWidth="1.5"
                />
                <g transform={`rotate(${-reticleDeg} 200 150)`}>
                  <line x1="60" y1="150" x2="340" y2="150" stroke="#ff6b1a" strokeWidth="3" />
                  <circle cx="200" cy="150" r="6" fill="#ff6b1a" />
                </g>
              </svg>
            </div>

            {cameraError && <div className="callout warn">{cameraError}</div>}

            <div className="hud-row" style={{ justifyContent: 'space-between' }}>
              <div>
                <div className="readout-label">{t.angle.rotateReticle}</div>
                <div className="big-angle-readout mono">{reticleDeg.toFixed(1)}°</div>
              </div>
              <div className="hud-row">
                {cameraActive ? (
                  <button type="button" className="btn danger" onClick={stopCameraOverlay}>
                    <VideoOff size={15} aria-hidden="true" />
                    {t.angle.stopCamera}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn primary"
                    onClick={() => void startCameraOverlay()}
                  >
                    <Camera size={15} aria-hidden="true" />
                    {t.angle.enableCamera}
                  </button>
                )}
                <button type="button" className="btn primary" onClick={handleSave}>
                  <BookmarkPlus size={15} aria-hidden="true" />
                  {t.angle.saveLog}
                </button>
              </div>
            </div>

            <input
              type="range"
              aria-label={t.angle.rotateReticle}
              min={-90}
              max={90}
              step={0.5}
              value={reticleDeg}
              onChange={(e) => setReticleDeg(Number(e.target.value))}
            />
          </>
        ) : (
          <div className="angle-cockpit">
            {/* Dial / Bullseye Visual Column */}
            <div className="gauge-stage angle-visual-col">
              <LevelCanvas
                mode={subMode}
                colorScheme={colorScheme}
                angleDeg={displayedEdgeDeg}
                tareDeg={tareDeg}
                betaDeg={sensor.sample.beta}
                gammaDeg={sensor.sample.gamma}
              />
            </div>

            {/* Readouts & Controls Column */}
            <div className="angle-info-col">
              <div
                className="hud-row"
                style={{ justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div>
                  <div className="readout-label">
                    {subMode === 'edge'
                      ? tareDeg !== null
                        ? t.angle.relative
                        : t.angle.absolute
                      : t.angle.modeBullseye}
                  </div>
                  <div className="big-angle-readout mono" data-testid="angle-readout">
                    {subMode === 'edge'
                      ? `${displayedEdgeDeg.toFixed(1)}°`
                      : `${bullseye.totalTiltDeg.toFixed(1)}°`}
                  </div>
                </div>
                {((subMode === 'edge' && isEdgeLevel) ||
                  (subMode === 'bullseye' && bullseye.isLevel)) && (
                  <span className="level-badge">{t.angle.levelLocked}</span>
                )}
              </div>

              <div className="readout-grid">
                {subMode === 'edge' ? (
                  <>
                    <div className="readout-box">
                      <div className="readout-label">{t.angle.slope}</div>
                      <div className="readout-value small mono">
                        {slopePct !== null ? `${slopePct.toFixed(1)}%` : '∞'}
                      </div>
                    </div>
                    <div className="readout-box">
                      <div className="readout-label">{t.angle.ratio}</div>
                      <div className="readout-value small mono">
                        {pitchRatio !== null ? `1 : ${pitchRatio.toFixed(1)}` : '—'}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="readout-box">
                      <div className="readout-label">{t.angle.pitch} (X)</div>
                      <div className="readout-value small mono">
                        {sensor.sample.beta.toFixed(1)}°
                      </div>
                    </div>
                    <div className="readout-box">
                      <div className="readout-label">{t.angle.roll} (Y)</div>
                      <div className="readout-value small mono">
                        {sensor.sample.gamma.toFixed(1)}°
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="hud-row" style={{ justifyContent: 'space-between' }}>
                <div className="hud-row">
                  {subMode === 'edge' && (
                    <>
                      <button
                        type="button"
                        className={`btn ${tareDeg !== null ? 'secondary' : ''}`}
                        onClick={() => setTareDeg(rawEdgeDeg)}
                      >
                        {t.angle.tare}
                      </button>
                      {tareDeg !== null && (
                        <button type="button" className="btn" onClick={() => setTareDeg(null)}>
                          <RotateCcw size={14} aria-hidden="true" />
                          {t.angle.clearTare}
                        </button>
                      )}
                    </>
                  )}
                  <button
                    type="button"
                    className={`btn ${held ? 'active' : ''}`}
                    onClick={() => setHeld((prev) => !prev)}
                  >
                    {held ? (
                      <Play size={14} aria-hidden="true" />
                    ) : (
                      <Pause size={14} aria-hidden="true" />
                    )}
                    {held ? t.angle.resume : t.angle.hold}
                  </button>
                </div>
                <button type="button" className="btn primary" onClick={handleSave}>
                  <BookmarkPlus size={15} aria-hidden="true" />
                  {t.angle.saveLog}
                </button>
              </div>

              {platform === 'ios' && isShortLandscape && (
                <p className="hud-hint">{t.angle.iosOrientationTip}</p>
              )}
            </div>
          </div>
        )}

        {/* Desktop Simulator Controls (only shown when explicitly toggled on) */}
        {sensor.simulatorEnabled && subMode !== 'camera' && (
          <div className="callout">
            <div className="readout-label" style={{ marginBottom: 6 }}>
              {t.angle.simulatorMode}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                <span className="mono" style={{ width: 92 }}>
                  {t.angle.roll}: {sensor.sample.gamma.toFixed(1)}°
                </span>
                <input
                  type="range"
                  aria-label="Simulated roll angle"
                  min={-90}
                  max={90}
                  step={0.5}
                  value={sensor.sample.gamma}
                  onChange={(e) => sensor.setSimulatedSample({ gamma: Number(e.target.value) })}
                  style={{ flex: 1 }}
                />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                <span className="mono" style={{ width: 92 }}>
                  {t.angle.pitch}: {sensor.sample.beta.toFixed(1)}°
                </span>
                <input
                  type="range"
                  aria-label="Simulated pitch angle"
                  min={-90}
                  max={90}
                  step={0.5}
                  value={sensor.sample.beta}
                  onChange={(e) => sensor.setSimulatedSample({ beta: Number(e.target.value) })}
                  style={{ flex: 1 }}
                />
              </label>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
