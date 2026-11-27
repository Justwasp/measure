import { useCallback, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  BookmarkPlus,
  CornerUpLeft,
  Lock,
  Plus,
  RotateCw,
  SlidersHorizontal,
  Unlock,
} from 'lucide-react';
import {
  addChainStep,
  computeCenterZeroScrollMm,
  convertMmToUnit,
  convertUnitToMm,
  formatLength,
  getTotalBaseOffsetMm,
  pxToReadingMm,
  resetOffsets,
  undoChainStep,
  type LabelRotation,
  type LengthUnit,
  type RulerAxisState,
  type RulerCorner,
  type RulerEdgeMode,
  type RulerOffsetState,
} from '../../core/ruler/rulerMath';
import { useI18n } from '../../i18n/I18nContext';
import type { ResolvedColorScheme } from '../../core/theme/useColorScheme';
import { RulerCanvas } from './RulerCanvas';

interface RulerViewProps {
  pxPerMm: number;
  colorScheme: ResolvedColorScheme;
  onSaveMeasurement: (valueText: string, detailText?: string) => void;
}

const CORNERS: RulerCorner[] = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];

function oppositeHudQuadrant(corner: RulerCorner): string {
  switch (corner) {
    case 'top-left':
      return 'quad-bottom-right';
    case 'top-right':
      return 'quad-bottom-left';
    case 'bottom-right':
      return 'quad-top-left';
    case 'bottom-left':
      return 'quad-top-right';
  }
}

export function RulerView({ pxPerMm, colorScheme, onSaveMeasurement }: RulerViewProps) {
  const { t } = useI18n();
  const [unit, setUnit] = useState<LengthUnit>('mm');
  const [corner, setCorner] = useState<RulerCorner>('top-left');
  const [edgeMode, setEdgeMode] = useState<RulerEdgeMode>('L');
  const [labelRotation, setLabelRotation] = useState<LabelRotation>(0);
  const [locked, setLocked] = useState(false);
  const [showCalipers, setShowCalipers] = useState(true);

  const [viewport, setViewport] = useState({ w: 390, h: 720 });
  const [longAxis, setLongAxis] = useState<RulerAxisState>({ scrollOffsetMm: 0, direction: 1 });
  const [shortAxis, setShortAxis] = useState<RulerAxisState>({ scrollOffsetMm: 0, direction: 1 });
  const [offsetState, setOffsetState] = useState<RulerOffsetState>({
    manualBaseMm: 0,
    chainStepsMm: [],
  });
  const [baseInput, setBaseInput] = useState('');

  const [cursorAPx, setCursorAPx] = useState(110);
  const [cursorBPx, setCursorBPx] = useState(290);

  const handleViewportMeasure = useCallback((w: number, h: number) => {
    setViewport((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
  }, []);

  const longEdgePx = Math.max(viewport.w, viewport.h);
  const shortEdgePx = Math.min(viewport.w, viewport.h);
  const longEdgeMm = longEdgePx / pxPerMm;
  const shortEdgeMm = shortEdgePx / pxPerMm;
  const totalBaseOffsetMm = useMemo(() => getTotalBaseOffsetMm(offsetState), [offsetState]);

  const readingAMm = pxToReadingMm(cursorAPx, longEdgePx, pxPerMm, longAxis, totalBaseOffsetMm);
  const readingBMm = pxToReadingMm(cursorBPx, longEdgePx, pxPerMm, longAxis, totalBaseOffsetMm);
  const deltaMm = Math.abs(cursorBPx - cursorAPx) / pxPerMm;

  const handleBaseInputChange = (raw: string) => {
    setBaseInput(raw);
    const parsed = Number.parseFloat(raw.replace(',', '.'));
    if (Number.isFinite(parsed) && parsed >= 0) {
      setOffsetState((prev) => ({
        ...prev,
        manualBaseMm: convertUnitToMm(parsed, unit),
      }));
    } else if (raw.trim() === '') {
      setOffsetState((prev) => ({ ...prev, manualBaseMm: 0 }));
    }
  };

  const handleUnitChange = (nextUnit: LengthUnit) => {
    setUnit(nextUnit);
    if (offsetState.manualBaseMm > 0) {
      const converted = convertMmToUnit(offsetState.manualBaseMm, nextUnit);
      setBaseInput(converted.toFixed(nextUnit === 'mm' ? 1 : 2));
    }
  };

  const handleZeroEdge = () => {
    setLongAxis((prev) => ({ ...prev, scrollOffsetMm: 0 }));
    setShortAxis((prev) => ({ ...prev, scrollOffsetMm: 0 }));
  };

  const handleZeroCenter = () => {
    setLongAxis((prev) => ({
      ...prev,
      scrollOffsetMm: computeCenterZeroScrollMm(longEdgePx, pxPerMm),
    }));
    setShortAxis((prev) => ({
      ...prev,
      scrollOffsetMm: computeCenterZeroScrollMm(shortEdgePx, pxPerMm),
    }));
  };

  const handleFlip = () => {
    setLongAxis((prev) => ({ ...prev, direction: prev.direction === 1 ? -1 : 1 }));
    setShortAxis((prev) => ({ ...prev, direction: prev.direction === 1 ? -1 : 1 }));
  };

  const handleCycleCorner = () => {
    setCorner((prev) => CORNERS[(CORNERS.indexOf(prev) + 1) % CORNERS.length]);
  };

  const handleRotateLabels = () => {
    setLabelRotation((prev) => (((prev + 90) % 360) as LabelRotation));
  };

  const handleAddScreenStep = () => {
    setOffsetState((prev) => addChainStep(prev, longEdgeMm));
  };

  const handleUndoStep = () => {
    setOffsetState((prev) => undoChainStep(prev));
  };

  const handleResetOffsets = () => {
    setOffsetState(resetOffsets());
    setBaseInput('');
  };

  const handleSave = () => {
    const primaryValue = showCalipers
      ? formatLength(deltaMm, unit)
      : formatLength(totalBaseOffsetMm + longEdgeMm, unit);
    const details = showCalipers
      ? `A: ${formatLength(readingAMm, unit)} · B: ${formatLength(readingBMm, unit)} · Base: +${formatLength(totalBaseOffsetMm, unit)}`
      : `${t.ruler.longAxis}: ${formatLength(longEdgeMm, unit)} · Base: +${formatLength(totalBaseOffsetMm, unit)}`;
    onSaveMeasurement(primaryValue, details);
  };

  return (
    <section className="ruler-stage" aria-label={t.tabs.ruler}>
      <RulerCanvas
        pxPerMm={pxPerMm}
        colorScheme={colorScheme}
        unit={unit}
        corner={corner}
        edgeMode={edgeMode}
        labelRotation={labelRotation}
        longAxis={longAxis}
        shortAxis={shortAxis}
        baseOffsetMm={totalBaseOffsetMm}
        locked={locked}
        showCalipers={showCalipers}
        cursorAPx={cursorAPx}
        cursorBPx={cursorBPx}
        onScrollLongChange={(scrollOffsetMm) =>
          setLongAxis((prev) => ({ ...prev, scrollOffsetMm }))
        }
        onScrollShortChange={(scrollOffsetMm) =>
          setShortAxis((prev) => ({ ...prev, scrollOffsetMm }))
        }
        onCursorAChange={setCursorAPx}
        onCursorBChange={setCursorBPx}
        onViewportMeasure={handleViewportMeasure}
      />

      <aside className={`ruler-hud ${oppositeHudQuadrant(corner)}`} aria-label="Ruler controls">
        {/* Live Readouts */}
        <div className="readout-grid">
          {showCalipers ? (
            <>
              <div className="readout-box span-2">
                <div className="readout-label">{t.ruler.delta}</div>
                <div className="readout-value mono" data-testid="ruler-delta-readout">
                  {formatLength(deltaMm, unit)}
                </div>
              </div>
              <div className="readout-box">
                <div className="readout-label">{t.ruler.totalAtA}</div>
                <div className="readout-value small mono">{formatLength(readingAMm, unit)}</div>
              </div>
              <div className="readout-box">
                <div className="readout-label">{t.ruler.totalAtB}</div>
                <div className="readout-value small mono">{formatLength(readingBMm, unit)}</div>
              </div>
            </>
          ) : (
            <>
              <div className="readout-box">
                <div className="readout-label">{t.ruler.longAxis}</div>
                <div className="readout-value small mono">{formatLength(longEdgeMm, unit)}</div>
              </div>
              <div className="readout-box">
                <div className="readout-label">{t.ruler.shortAxis}</div>
                <div className="readout-value small mono">{formatLength(shortEdgeMm, unit)}</div>
              </div>
            </>
          )}
        </div>

        {/* Unit & Edge Mode */}
        <div className="hud-row">
          <div className="segmented" role="group" aria-label="Units">
            {(['mm', 'cm', 'in'] as const).map((u) => (
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

          <div className="segmented" role="group" aria-label="Edge mode">
            <button
              type="button"
              aria-pressed={edgeMode === 'L'}
              onClick={() => setEdgeMode('L')}
            >
              {t.ruler.edgeL}
            </button>
            <button
              type="button"
              aria-pressed={edgeMode === 'long'}
              onClick={() => setEdgeMode('long')}
            >
              {t.ruler.edgeLong}
            </button>
            <button
              type="button"
              aria-pressed={edgeMode === 'short'}
              onClick={() => setEdgeMode('short')}
            >
              {t.ruler.edgeShort}
            </button>
          </div>
        </div>

        {/* Zero & Rotation Controls */}
        <div className="hud-row">
          <button type="button" className="btn" onClick={handleZeroEdge}>
            {t.ruler.zeroEdge}
          </button>
          <button type="button" className="btn" onClick={handleZeroCenter}>
            {t.ruler.zeroCenter}
          </button>
          <button type="button" className="btn" onClick={handleFlip}>
            <ArrowLeftRight size={14} aria-hidden="true" />
            {t.ruler.flip}
          </button>
          <button type="button" className="btn" onClick={handleCycleCorner}>
            {t.ruler.rotateCorner}
          </button>
          <button type="button" className="btn" onClick={handleRotateLabels}>
            <RotateCw size={14} aria-hidden="true" />
            {labelRotation}°
          </button>
          <button
            type="button"
            className={`btn ${locked ? 'active' : ''}`}
            onClick={() => setLocked((prev) => !prev)}
          >
            {locked ? <Lock size={14} aria-hidden="true" /> : <Unlock size={14} aria-hidden="true" />}
            {locked ? t.ruler.unlock : t.ruler.lock}
          </button>
          <button
            type="button"
            className={`btn ${showCalipers ? 'secondary' : ''}`}
            onClick={() => setShowCalipers((prev) => !prev)}
          >
            <SlidersHorizontal size={14} aria-hidden="true" />
            {t.ruler.showCalipers}
          </button>
        </div>

        {/* Known Object Base Offset & Screen Chaining */}
        <div className="readout-box">
          <div className="hud-row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
            <label htmlFor="base-offset-input" className="readout-label">
              {t.ruler.baseOffset} ({unit})
            </label>
            <span className="readout-label mono">
              +{formatLength(totalBaseOffsetMm, unit)}
              {offsetState.chainStepsMm.length > 0 &&
                ` (${offsetState.chainStepsMm.length} ${t.ruler.stepsCount})`}
            </span>
          </div>
          <div className="hud-row">
            <input
              id="base-offset-input"
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              className="field-input mono"
              style={{ flex: 1, minWidth: 80 }}
              placeholder={t.ruler.basePlaceholder}
              value={baseInput}
              onChange={(e) => handleBaseInputChange(e.target.value)}
            />
            <button
              type="button"
              className="btn secondary"
              onClick={handleAddScreenStep}
              title={`+${formatLength(longEdgeMm, unit)}`}
            >
              <Plus size={14} aria-hidden="true" />
              {t.ruler.addStep}
            </button>
            {offsetState.chainStepsMm.length > 0 && (
              <button
                type="button"
                className="icon-btn"
                onClick={handleUndoStep}
                aria-label={t.ruler.undoStep}
              >
                <CornerUpLeft size={14} aria-hidden="true" />
              </button>
            )}
            {totalBaseOffsetMm > 0 && (
              <button type="button" className="btn danger" onClick={handleResetOffsets}>
                {t.ruler.resetOffset}
              </button>
            )}
          </div>
        </div>

        {/* Hint & Save */}
        <div className="hud-row" style={{ justifyContent: 'space-between' }}>
          <p className="hud-hint">{locked ? t.ruler.lockedHint : t.ruler.dragHint}</p>
          <button type="button" className="btn primary" onClick={handleSave}>
            <BookmarkPlus size={15} aria-hidden="true" />
            {t.ruler.saveLog}
          </button>
        </div>
      </aside>
    </section>
  );
}
