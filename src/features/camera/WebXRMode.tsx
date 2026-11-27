import { useEffect, useRef, useState } from 'react';
import { BookmarkPlus, Box, Info } from 'lucide-react';
import { distance3DMeters, type Point3D } from '../../core/camera/cameraMath';
import { detectPlatform } from '../../core/calibration/detectDevice';
import { useI18n } from '../../i18n/I18nContext';

interface WebXRModeProps {
  onSaveMeasurement: (valueText: string, detailText?: string) => void;
  onSwitchMode: (mode: 'ref' | 'trigo') => void;
}

interface XRSystemLike {
  isSessionSupported: (mode: string) => Promise<boolean>;
  requestSession: (mode: string, options?: Record<string, unknown>) => Promise<XRSessionLike>;
}

interface XRSessionLike {
  end: () => Promise<void>;
  addEventListener: (type: string, listener: () => void) => void;
  requestReferenceSpace: (type: string) => Promise<unknown>;
  requestHitTestSource?: (options: { space: unknown }) => Promise<XRHitTestSourceLike>;
  requestAnimationFrame: (cb: (time: number, frame: XRFrameLike) => void) => number;
}

interface XRHitTestSourceLike {
  cancel: () => void;
}

interface XRFrameLike {
  getHitTestResults: (source: XRHitTestSourceLike) => Array<{
    getPose: (space: unknown) => { transform: { position: Point3D } } | null;
  }>;
}

export function WebXRMode({ onSaveMeasurement, onSwitchMode }: WebXRModeProps) {
  const { t } = useI18n();
  const [supported, setSupported] = useState<boolean | null>(null);
  const [active, setActive] = useState(false);
  const [points, setPoints] = useState<Point3D[]>([]);
  const [lastHit, setLastHit] = useState<Point3D | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const sessionRef = useRef<XRSessionLike | null>(null);

  const platform = detectPlatform(typeof navigator !== 'undefined' ? navigator.userAgent : '');

  useEffect(() => {
    let cancelled = false;
    const xr = (navigator as Navigator & { xr?: XRSystemLike }).xr;
    if (!xr?.isSessionSupported) {
      setSupported(false);
      return;
    }
    xr.isSessionSupported('immersive-ar')
      .then((ok) => {
        if (!cancelled) setSupported(ok);
      })
      .catch(() => {
        if (!cancelled) setSupported(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const measuredM = points.length >= 2 ? distance3DMeters(points[0], points[1]) : null;

  const startArSession = async () => {
    setErrorMsg(null);
    const xr = (navigator as Navigator & { xr?: XRSystemLike }).xr;
    if (!xr) return;

    try {
      const session = await xr.requestSession('immersive-ar', {
        requiredFeatures: ['hit-test'],
        optionalFeatures: ['dom-overlay'],
      });
      sessionRef.current = session;
      setActive(true);
      setPoints([]);

      const viewerSpace = await session.requestReferenceSpace('viewer');
      const refSpace = await session.requestReferenceSpace('local');
      const hitTestSource = await session.requestHitTestSource?.({ space: viewerSpace });

      session.addEventListener('end', () => {
        hitTestSource?.cancel();
        sessionRef.current = null;
        setActive(false);
      });

      const onFrame = (_time: number, frame: XRFrameLike) => {
        if (hitTestSource) {
          const hits = frame.getHitTestResults(hitTestSource);
          if (hits.length > 0) {
            const pose = hits[0].getPose(refSpace);
            if (pose) {
              setLastHit({
                x: pose.transform.position.x,
                y: pose.transform.position.y,
                z: pose.transform.position.z,
              });
            }
          }
        }
        session.requestAnimationFrame(onFrame);
      };
      session.requestAnimationFrame(onFrame);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to start WebXR AR session');
      setActive(false);
    }
  };

  const stopArSession = async () => {
    await sessionRef.current?.end();
    sessionRef.current = null;
    setActive(false);
  };

  const placeHitPoint = () => {
    if (!lastHit) return;
    setPoints((prev) => (prev.length >= 2 ? [lastHit] : [...prev, lastHit]));
  };

  return (
    <div className="card-panel">
      <div className="hud-row">
        <Box size={18} aria-hidden="true" style={{ color: 'var(--accent-secondary)' }} />
        <h2 style={{ fontSize: 16 }}>{t.camera.arTitle}</h2>
      </div>

      {supported === true ? (
        <>
          <div className="callout info">{t.camera.arSupported}</div>
          <div className="hud-row">
            {active ? (
              <>
                <button type="button" className="btn primary" onClick={placeHitPoint}>
                  {t.camera.arTapPoint}
                </button>
                <button type="button" className="btn danger" onClick={() => void stopArSession()}>
                  {t.camera.arStop}
                </button>
              </>
            ) : (
              <button type="button" className="btn primary" onClick={() => void startArSession()}>
                {t.camera.arStart}
              </button>
            )}
          </div>
          {errorMsg && <div className="callout warn">{errorMsg}</div>}
          {measuredM !== null && (
            <div className="readout-box">
              <div className="readout-label">{t.camera.measuredResult}</div>
              <div className="hud-row" style={{ justifyContent: 'space-between' }}>
                <span className="readout-value mono">{(measuredM * 100).toFixed(1)} cm</span>
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => onSaveMeasurement(`${(measuredM * 100).toFixed(1)} cm`, 'WebXR AR 3D')}
                >
                  <BookmarkPlus size={15} aria-hidden="true" />
                  {t.camera.saveLog}
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="callout warn" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Info size={18} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              {platform === 'ios' ? t.camera.arIosNotice : t.camera.arUnsupportedNotice}
            </span>
          </div>

          <div className="hud-row">
            <button type="button" className="btn primary" onClick={() => onSwitchMode('ref')}>
              {t.camera.modeRef}
            </button>
            <button type="button" className="btn secondary" onClick={() => onSwitchMode('trigo')}>
              {t.camera.modeTrigo}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
