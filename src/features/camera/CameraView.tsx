import { useState } from 'react';
import type { MeasurementCategory } from '../../core/history/historyStore';
import { useI18n } from '../../i18n/I18nContext';
import { PhotoReferenceMode } from './PhotoReferenceMode';
import { TrigoRangefinderMode } from './TrigoRangefinderMode';
import { WebXRMode } from './WebXRMode';

interface CameraViewProps {
  onSaveMeasurement: (
    category: MeasurementCategory,
    valueText: string,
    detailText?: string,
  ) => void;
}

type CameraSubMode = 'ref' | 'trigo' | 'ar';

export function CameraView({ onSaveMeasurement }: CameraViewProps) {
  const { t } = useI18n();
  const [subMode, setSubMode] = useState<CameraSubMode>('ref');

  return (
    <section className="feature-panel" aria-label={t.tabs.camera}>
      <div className="segmented" role="group" aria-label="Camera measurement mode">
        <button type="button" aria-pressed={subMode === 'ref'} onClick={() => setSubMode('ref')}>
          {t.camera.modeRef}
        </button>
        <button
          type="button"
          aria-pressed={subMode === 'trigo'}
          onClick={() => setSubMode('trigo')}
        >
          {t.camera.modeTrigo}
        </button>
        <button type="button" aria-pressed={subMode === 'ar'} onClick={() => setSubMode('ar')}>
          {t.camera.modeAr}
        </button>
      </div>

      {subMode === 'ref' && (
        <PhotoReferenceMode
          onSaveMeasurement={(val, detail) => onSaveMeasurement('camera-ref', val, detail)}
        />
      )}
      {subMode === 'trigo' && (
        <TrigoRangefinderMode
          onSaveMeasurement={(val, detail) => onSaveMeasurement('camera-trigo', val, detail)}
        />
      )}
      {subMode === 'ar' && (
        <WebXRMode
          onSaveMeasurement={(val, detail) => onSaveMeasurement('camera-ar', val, detail)}
          onSwitchMode={(next) => setSubMode(next)}
        />
      )}
    </section>
  );
}
