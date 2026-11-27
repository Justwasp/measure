import { useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import type { MeasurementCategory } from '../../core/history/historyStore';
import { useI18n } from '../../i18n/I18nContext';
import { TrigoRangefinderMode } from './TrigoRangefinderMode';
import { WebXRMode } from './WebXRMode';

interface CameraViewProps {
  onSaveMeasurement: (
    category: MeasurementCategory,
    valueText: string,
    detailText?: string,
  ) => void;
  onOpenPhotoStudio: () => void;
}

type CameraSubMode = 'trigo' | 'ar';

export function CameraView({ onSaveMeasurement, onOpenPhotoStudio }: CameraViewProps) {
  const { t } = useI18n();
  const [subMode, setSubMode] = useState<CameraSubMode>('trigo');

  return (
    <section className="feature-panel" aria-label={t.tabs.camera}>
      <div className="hud-row" style={{ justifyContent: 'space-between' }}>
        <div className="segmented" role="group" aria-label="Camera measurement mode">
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

        <button type="button" className="btn secondary" onClick={onOpenPhotoStudio}>
          <ImageIcon size={15} aria-hidden="true" />
          {t.tabs.photo}
        </button>
      </div>

      {subMode === 'trigo' && (
        <TrigoRangefinderMode
          onSaveMeasurement={(val, detail) => onSaveMeasurement('camera-trigo', val, detail)}
        />
      )}
      {subMode === 'ar' && (
        <WebXRMode
          onSaveMeasurement={(val, detail) => onSaveMeasurement('camera-ar', val, detail)}
          onSwitchMode={(next) => {
            if (next === 'ref') {
              onOpenPhotoStudio();
            } else {
              setSubMode('trigo');
            }
          }}
        />
      )}
    </section>
  );
}
