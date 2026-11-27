import { useCallback, useEffect, useState } from 'react';
import {
  Camera,
  Compass,
  History,
  Image as ImageIcon,
  Languages,
  Moon,
  Ruler,
  Sun,
} from 'lucide-react';
import {
  detectDeviceCalibration,
  probeBrowserEnvironment,
  type CalibrationConfidence,
  type DetectionResult,
} from './core/calibration/detectDevice';
import {
  clearStoredCalibration,
  loadStoredCalibration,
  saveStoredCalibration,
} from './core/calibration/storage';
import {
  createRecord,
  loadHistory,
  saveHistory,
  type MeasurementCategory,
  type MeasurementRecord,
} from './core/history/historyStore';
import { useColorScheme } from './core/theme/useColorScheme';
import { AngleView } from './features/angle/AngleView';
import { CalibrationDialog } from './features/calibration/CalibrationDialog';
import { CameraView } from './features/camera/CameraView';
import { HistoryDialog } from './features/history/HistoryDialog';
import { PhotoMeasureView } from './features/photo/PhotoMeasureView';
import { RulerView } from './features/ruler/RulerView';
import { useI18n } from './i18n/I18nContext';
import { I18nProvider } from './i18n/I18nProvider';

type ActiveTab = 'ruler' | 'angle' | 'photo' | 'camera';

function MeasureAppShell() {
  const { t, locale, toggleLocale } = useI18n();
  const { resolved: colorScheme, toggle: toggleColorScheme } = useColorScheme();
  const [activeTab, setActiveTab] = useState<ActiveTab>('ruler');
  const [calibrationOpen, setCalibrationOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [zoomWarning, setZoomWarning] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [detection, setDetection] = useState<DetectionResult>(() =>
    detectDeviceCalibration({
      screenWidth: typeof window !== 'undefined' ? window.screen.width : 390,
      screenHeight: typeof window !== 'undefined' ? window.screen.height : 844,
      devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 3,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    }),
  );

  const [calibration, setCalibration] = useState<{
    pxPerMm: number;
    confidence: CalibrationConfidence;
    label: string;
  }>(() => {
    const stored = loadStoredCalibration();
    if (stored) {
      return {
        pxPerMm: stored.pxPerMm,
        confidence: stored.confidence,
        label: stored.label,
      };
    }
    return {
      pxPerMm: detection.pxPerMm,
      confidence: detection.confidence,
      label: detection.detectedLabel,
    };
  });

  const [history, setHistory] = useState<MeasurementRecord[]>(loadHistory);

  // Async high-entropy Android Client Hints device model detection
  useEffect(() => {
    let active = true;
    void probeBrowserEnvironment().then((env) => {
      if (!active) return;
      const result = detectDeviceCalibration(env);
      setDetection(result);
      if (!loadStoredCalibration()) {
        setCalibration({
          pxPerMm: result.pxPerMm,
          confidence: result.confidence,
          label: result.detectedLabel,
        });
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // Warn user if browser pinch-zoom is active (corrupts physical ruler accuracy)
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const checkZoom = () => {
      setZoomWarning(Math.abs(vv.scale - 1) > 0.03);
    };
    checkZoom();
    vv.addEventListener('resize', checkZoom);
    return () => vv.removeEventListener('resize', checkZoom);
  }, []);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 1800);
  }, []);

  const handleSaveMeasurement = useCallback(
    (category: MeasurementCategory, valueText: string, detailText?: string) => {
      const next = [createRecord(category, valueText, detailText), ...history];
      setHistory(next);
      saveHistory(next);
      showToast(t.ruler.savedToast);
    },
    [history, showToast, t.ruler.savedToast],
  );

  const handleApplyManualCalibration = (pxPerMm: number, label: string, deviceId?: string) => {
    const next = {
      pxPerMm,
      confidence: 'calibrated' as const,
      label,
      deviceId,
      updatedAt: new Date().toISOString(),
    };
    saveStoredCalibration(next);
    setCalibration({ pxPerMm, confidence: 'calibrated', label });
  };

  const handleResetAutoCalibration = () => {
    clearStoredCalibration();
    setCalibration({
      pxPerMm: detection.pxPerMm,
      confidence: detection.confidence,
      label: detection.detectedLabel,
    });
  };

  const statusText = (() => {
    switch (calibration.confidence) {
      case 'calibrated':
        return t.header.statusCalibrated;
      case 'auto':
        return t.header.statusAuto;
      case 'ambiguous':
        return t.header.statusAmbiguous;
      case 'estimated':
        return t.header.statusEstimated;
    }
  })();

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">
            M
          </div>
          <span className="brand-title">{t.appName}</span>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="status-pill"
            onClick={() => setCalibrationOpen(true)}
            data-testid="open-calibration-btn"
          >
            <span className={`status-dot ${calibration.confidence}`} aria-hidden="true" />
            <span>{statusText}</span>
          </button>

          <button
            type="button"
            className="icon-btn"
            onClick={() => setHistoryOpen(true)}
            aria-label={t.header.history}
            data-testid="open-history-btn"
          >
            <History size={16} aria-hidden="true" />
            {history.length > 0 && <span className="mono">{history.length}</span>}
          </button>

          <button
            type="button"
            className="icon-btn mono"
            onClick={toggleLocale}
            aria-label={t.header.langToggle}
            data-testid="lang-toggle-btn"
          >
            <Languages size={15} aria-hidden="true" />
            <span>{locale.toUpperCase()}</span>
          </button>

          <button
            type="button"
            className="icon-btn"
            onClick={toggleColorScheme}
            aria-label={t.header.themeToggle}
            data-testid="theme-toggle-btn"
          >
            {colorScheme === 'dark' ? (
              <Sun size={16} aria-hidden="true" />
            ) : (
              <Moon size={16} aria-hidden="true" />
            )}
          </button>
        </div>
      </header>

      {zoomWarning && (
        <div className="zoom-banner" role="alert">
          {t.header.zoomWarning}
        </div>
      )}

      <main className={`app-main ${activeTab === 'ruler' ? 'ruler-mode' : ''}`}>
        {activeTab === 'ruler' && (
          <RulerView
            pxPerMm={calibration.pxPerMm}
            colorScheme={colorScheme}
            onSaveMeasurement={(val, detail) => handleSaveMeasurement('ruler', val, detail)}
          />
        )}
        {activeTab === 'angle' && (
          <AngleView
            colorScheme={colorScheme}
            onSaveMeasurement={(val, detail) => handleSaveMeasurement('angle', val, detail)}
          />
        )}
        {activeTab === 'photo' && (
          <PhotoMeasureView
            onSaveMeasurement={(val, detail) => handleSaveMeasurement('photo', val, detail)}
          />
        )}
        {activeTab === 'camera' && (
          <CameraView
            onSaveMeasurement={handleSaveMeasurement}
            onOpenPhotoStudio={() => setActiveTab('photo')}
          />
        )}
      </main>

      <nav className="bottom-nav" role="tablist" aria-label="Measurement instruments">
        <button
          type="button"
          role="tab"
          className="nav-tab"
          aria-selected={activeTab === 'ruler'}
          onClick={() => setActiveTab('ruler')}
        >
          <Ruler size={20} aria-hidden="true" />
          <span>{t.tabs.ruler}</span>
        </button>

        <button
          type="button"
          role="tab"
          className="nav-tab"
          aria-selected={activeTab === 'angle'}
          onClick={() => setActiveTab('angle')}
        >
          <Compass size={20} aria-hidden="true" />
          <span>{t.tabs.angle}</span>
        </button>

        <button
          type="button"
          role="tab"
          className="nav-tab"
          aria-selected={activeTab === 'photo'}
          onClick={() => setActiveTab('photo')}
        >
          <ImageIcon size={20} aria-hidden="true" />
          <span>{t.tabs.photo}</span>
        </button>

        <button
          type="button"
          role="tab"
          className="nav-tab"
          aria-selected={activeTab === 'camera'}
          onClick={() => setActiveTab('camera')}
        >
          <Camera size={20} aria-hidden="true" />
          <span>{t.tabs.camera}</span>
        </button>
      </nav>

      <CalibrationDialog
        open={calibrationOpen}
        onClose={() => setCalibrationOpen(false)}
        currentPxPerMm={calibration.pxPerMm}
        currentLabel={calibration.label}
        detection={detection}
        onApplyManual={handleApplyManualCalibration}
        onResetAuto={handleResetAutoCalibration}
      />

      <HistoryDialog
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        records={history}
        onDelete={(id) => {
          const next = history.filter((r) => r.id !== id);
          setHistory(next);
          saveHistory(next);
        }}
        onClearAll={() => {
          setHistory([]);
          saveHistory([]);
        }}
      />

      {toast && (
        <div className="toast-banner" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </div>
  );
}

export function App() {
  return (
    <I18nProvider>
      <MeasureAppShell />
    </I18nProvider>
  );
}

export default App;
