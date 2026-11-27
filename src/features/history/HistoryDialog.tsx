import { useState } from 'react';
import { Check, Copy, Trash2 } from 'lucide-react';
import type { MeasurementCategory, MeasurementRecord } from '../../core/history/historyStore';
import { ModalDialog } from '../../components/ModalDialog';
import { useI18n } from '../../i18n/I18nContext';

interface HistoryDialogProps {
  open: boolean;
  onClose: () => void;
  records: MeasurementRecord[];
  onDelete: (id: string) => void;
  onClearAll: () => void;
}

export function HistoryDialog({
  open,
  onClose,
  records,
  onDelete,
  onClearAll,
}: HistoryDialogProps) {
  const { t } = useI18n();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const categoryLabel = (cat: MeasurementCategory): string => {
    switch (cat) {
      case 'ruler':
        return t.history.catRuler;
      case 'angle':
        return t.history.catAngle;
      case 'camera-ref':
        return t.history.catCameraRef;
      case 'camera-trigo':
        return t.history.catCameraTrigo;
      case 'camera-ar':
        return t.history.catCameraAr;
    }
  };

  const handleCopy = async (record: MeasurementRecord) => {
    const text = record.detailText
      ? `${record.valueText} (${record.detailText})`
      : record.valueText;
    try {
      await navigator.clipboard?.writeText(text);
      setCopiedId(record.id);
      window.setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // Clipboard may be unavailable in insecure contexts
    }
  };

  return (
    <ModalDialog open={open} onClose={onClose} title={t.history.title} closeLabel={t.history.close}>
      {records.length === 0 ? (
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>
          {t.history.empty}
        </p>
      ) : (
        <>
          <div className="history-list">
            {records.map((rec) => (
              <div key={rec.id} className="history-item">
                <div style={{ minWidth: 0 }}>
                  <div className="hud-row" style={{ gap: 8 }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        color: 'var(--accent-secondary)',
                      }}
                    >
                      {categoryLabel(rec.category)}
                    </span>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {new Date(rec.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="mono" style={{ fontSize: 16, fontWeight: 700 }}>
                    {rec.valueText}
                  </div>
                  {rec.detailText && (
                    <div className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      {rec.detailText}
                    </div>
                  )}
                </div>

                <div className="hud-row" style={{ flexWrap: 'nowrap' }}>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => void handleCopy(rec)}
                    aria-label={t.history.copy}
                  >
                    {copiedId === rec.id ? (
                      <Check size={15} aria-hidden="true" />
                    ) : (
                      <Copy size={15} aria-hidden="true" />
                    )}
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => onDelete(rec.id)}
                    aria-label={t.history.delete}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" className="btn danger" onClick={onClearAll}>
              {t.history.clearAll}
            </button>
          </div>
        </>
      )}
    </ModalDialog>
  );
}
