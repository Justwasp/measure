import { useMemo, useState } from 'react';
import { Check, RotateCcw, Search } from 'lucide-react';
import {
  CALIBRATION_REFERENCES,
  DEVICE_DATABASE,
  type DeviceProfile,
} from '../../core/calibration/deviceDatabase';
import {
  clampPxPerMm,
  pxPerMmFromPhysicalWidth,
  type DetectionResult,
} from '../../core/calibration/detectDevice';
import { ModalDialog } from '../../components/ModalDialog';
import { useI18n } from '../../i18n/I18nContext';

interface CalibrationDialogProps {
  open: boolean;
  onClose: () => void;
  currentPxPerMm: number;
  currentLabel: string;
  detection: DetectionResult;
  onApplyManual: (pxPerMm: number, label: string, deviceId?: string) => void;
  onResetAuto: () => void;
}

export function CalibrationDialog({
  open,
  onClose,
  currentPxPerMm,
  currentLabel,
  detection,
  onApplyManual,
  onResetAuto,
}: CalibrationDialogProps) {
  const { t, locale } = useI18n();
  const [tab, setTab] = useState<'visual' | 'device'>('visual');
  const [refId, setRefId] = useState<string>(CALIBRATION_REFERENCES[0].id);
  const [draftPxPerMm, setDraftPxPerMm] = useState<number>(currentPxPerMm);
  const [search, setSearch] = useState('');

  const activeRef =
    CALIBRATION_REFERENCES.find((r) => r.id === refId) ?? CALIBRATION_REFERENCES[0];

  const filteredDevices = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return DEVICE_DATABASE;
    return DEVICE_DATABASE.filter(
      (d) => d.name.toLowerCase().includes(q) || d.brand.toLowerCase().includes(q),
    );
  }, [search]);

  const handleSelectDevice = (device: DeviceProfile) => {
    const computed = clampPxPerMm(
      pxPerMmFromPhysicalWidth(window.screen.width, window.screen.height, device.physicalWidthMm),
    );
    setDraftPxPerMm(computed);
    onApplyManual(computed, device.name, device.id);
    onClose();
  };

  const handleSaveVisual = () => {
    const label = `${activeRef.labelEn} (${draftPxPerMm.toFixed(2)} px/mm)`;
    onApplyManual(clampPxPerMm(draftPxPerMm), label);
    onClose();
  };

  const previewWidthPx = Math.round(activeRef.widthMm * draftPxPerMm);
  const previewHeightPx = Math.round((activeRef.heightMm ?? activeRef.widthMm) * draftPxPerMm);

  return (
    <ModalDialog open={open} onClose={onClose} title={t.calibration.title} closeLabel={t.calibration.close}>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
        {t.calibration.subtitle}
      </p>

      {detection.warning === 'ambiguous_model' && (
        <div className="callout warn">{t.calibration.ambiguousWarning}</div>
      )}
      {detection.warning === 'display_zoom_possible' && (
        <div className="callout warn">{t.calibration.zoomWarning}</div>
      )}

      <div className="readout-grid">
        <div className="readout-box">
          <div className="readout-label">{t.calibration.detectedDevice}</div>
          <div className="readout-value small">{currentLabel}</div>
        </div>
        <div className="readout-box">
          <div className="readout-label">{t.calibration.currentScale}</div>
          <div className="readout-value small mono">
            {draftPxPerMm.toFixed(3)} px/mm ({Math.round(draftPxPerMm * 25.4)} CSS DPI)
          </div>
        </div>
      </div>

      <div className="segmented" role="group" aria-label="Calibration method">
        <button type="button" aria-pressed={tab === 'visual'} onClick={() => setTab('visual')}>
          {t.calibration.tabVisual}
        </button>
        <button type="button" aria-pressed={tab === 'device'} onClick={() => setTab('device')}>
          {t.calibration.tabDevice}
        </button>
      </div>

      {tab === 'visual' ? (
        <>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
            <span>{t.calibration.referenceLabel}</span>
            <select
              className="field-input"
              value={refId}
              onChange={(e) => setRefId(e.target.value)}
            >
              {CALIBRATION_REFERENCES.map((r) => (
                <option key={r.id} value={r.id}>
                  {locale === 'ru' ? r.labelRu : r.labelEn}
                </option>
              ))}
            </select>
          </label>

          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
            {t.calibration.visualInstruction}
          </p>

          <div className="calibration-preview-box">
            {activeRef.shape === 'card' && (
              <div
                style={{
                  width: previewWidthPx,
                  height: previewHeightPx,
                  border: '2px solid var(--accent-primary)',
                  borderRadius: 10,
                  background: 'var(--accent-primary-soft)',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                <span className="mono" style={{ fontSize: 12, fontWeight: 700 }}>
                  {activeRef.widthMm.toFixed(1)} × {activeRef.heightMm?.toFixed(1)} mm
                </span>
              </div>
            )}
            {activeRef.shape === 'circle' && (
              <div
                style={{
                  width: previewWidthPx,
                  height: previewWidthPx,
                  borderRadius: '50%',
                  border: '2px solid var(--accent-primary)',
                  background: 'var(--accent-primary-soft)',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                <span className="mono" style={{ fontSize: 11, fontWeight: 700 }}>
                  ⌀ {activeRef.widthMm}
                </span>
              </div>
            )}
            {activeRef.shape === 'bar' && (
              <div
                style={{
                  width: previewWidthPx,
                  height: 28,
                  borderLeft: '3px solid var(--accent-primary)',
                  borderRight: '3px solid var(--accent-primary)',
                  borderBottom: '2px solid var(--accent-primary)',
                  background: 'var(--accent-primary-soft)',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                <span className="mono" style={{ fontSize: 12, fontWeight: 700 }}>
                  {activeRef.widthMm} mm
                </span>
              </div>
            )}
          </div>

          <div className="hud-row">
            <button
              type="button"
              className="btn mono"
              onClick={() => setDraftPxPerMm((v) => clampPxPerMm(v - 0.05))}
            >
              −0.05
            </button>
            <input
              type="range"
              aria-label="Scale pixels per millimeter"
              min={2.5}
              max={10.5}
              step={0.01}
              value={draftPxPerMm}
              onChange={(e) => setDraftPxPerMm(Number(e.target.value))}
              style={{ flex: 1 }}
            />
            <button
              type="button"
              className="btn mono"
              onClick={() => setDraftPxPerMm((v) => clampPxPerMm(v + 0.05))}
            >
              +0.05
            </button>
          </div>

          <div className="hud-row" style={{ justifyContent: 'space-between' }}>
            <button
              type="button"
              className="btn"
              onClick={() => {
                onResetAuto();
                setDraftPxPerMm(detection.pxPerMm);
              }}
            >
              <RotateCcw size={14} aria-hidden="true" />
              {t.calibration.resetAuto}
            </button>
            <button type="button" className="btn primary" onClick={handleSaveVisual}>
              <Check size={15} aria-hidden="true" />
              {t.calibration.applyCalibration}
            </button>
          </div>
        </>
      ) : (
        <>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search
              size={16}
              aria-hidden="true"
              style={{ position: 'absolute', left: 10, color: 'var(--text-muted)' }}
            />
            <input
              type="search"
              className="field-input"
              style={{ paddingLeft: 34 }}
              placeholder={t.calibration.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="device-list">
            {filteredDevices.map((device) => (
              <button
                key={device.id}
                type="button"
                className="device-item"
                onClick={() => handleSelectDevice(device)}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{device.name}</div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    {device.physicalWidthMm} × {device.physicalHeightMm} mm · {device.diagonalInches}&quot;
                  </div>
                </div>
                <span className="mono" style={{ fontSize: 12, color: 'var(--accent-secondary)' }}>
                  {device.ppi} PPI
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </ModalDialog>
  );
}
