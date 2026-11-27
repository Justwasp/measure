import { describe, expect, it } from 'vitest';
import {
  addChainStep,
  applyScrollDragMm,
  computeCenterZeroScrollMm,
  formatFractionalInches,
  formatLength,
  generateVisibleTicks,
  getTotalBaseOffsetMm,
  pxToReadingMm,
  readingMmToPx,
  undoChainStep,
  type RulerAxisState,
} from './rulerMath';

describe('ruler math engine', () => {
  const pxPerMm = 6;
  const edgeLengthPx = 600; // 100 mm edge

  it('maps pixels to mm and back cleanly with 0 at edge, center, or off-screen', () => {
    const edgeZero: RulerAxisState = { scrollOffsetMm: 0, direction: 1 };
    expect(pxToReadingMm(0, edgeLengthPx, pxPerMm, edgeZero, 0)).toBe(0);
    expect(pxToReadingMm(300, edgeLengthPx, pxPerMm, edgeZero, 0)).toBe(50);

    // Center zero: -50 mm at top, 0 mm in middle, +50 mm at bottom
    const centerScroll = computeCenterZeroScrollMm(edgeLengthPx, pxPerMm);
    const centerAxis: RulerAxisState = { scrollOffsetMm: centerScroll, direction: 1 };
    expect(pxToReadingMm(0, edgeLengthPx, pxPerMm, centerAxis, 0)).toBeCloseTo(-50, 5);
    expect(pxToReadingMm(300, edgeLengthPx, pxPerMm, centerAxis, 0)).toBeCloseTo(0, 5);
    expect(pxToReadingMm(600, edgeLengthPx, pxPerMm, centerAxis, 0)).toBeCloseTo(50, 5);

    // Scroll 0 off-screen (+35 mm) + known object base offset (+150 mm)
    const offscreenAxis: RulerAxisState = { scrollOffsetMm: 35, direction: 1 };
    const val = pxToReadingMm(60, edgeLengthPx, pxPerMm, offscreenAxis, 150);
    expect(val).toBeCloseTo(195, 5);
    expect(readingMmToPx(val, edgeLengthPx, pxPerMm, offscreenAxis, 150)).toBeCloseTo(60, 5);
  });

  it('supports flipped scale direction', () => {
    const flipped: RulerAxisState = { scrollOffsetMm: 0, direction: -1 };
    expect(pxToReadingMm(600, edgeLengthPx, pxPerMm, flipped, 0)).toBe(0);
    expect(pxToReadingMm(0, edgeLengthPx, pxPerMm, flipped, 0)).toBe(100);
    expect(readingMmToPx(25, edgeLengthPx, pxPerMm, flipped, 0)).toBe(450);
  });

  it('applies pointer drag smoothly in both directions', () => {
    // Dragging +60px (+10mm) down shifts 0 down by 10mm -> top reads -10mm
    expect(applyScrollDragMm(0, 60, pxPerMm, 1)).toBeCloseTo(-10, 5);
    expect(applyScrollDragMm(0, 60, pxPerMm, -1)).toBeCloseTo(10, 5);
  });

  it('chains known base length + multiple screen steps with undo', () => {
    let offset = { manualBaseMm: 150, chainStepsMm: [] as number[] };
    expect(getTotalBaseOffsetMm(offset)).toBe(150);

    offset = addChainStep(offset, 141.13);
    offset = addChainStep(offset, 141.13);
    expect(getTotalBaseOffsetMm(offset)).toBeCloseTo(432.26, 2);

    offset = undoChainStep(offset);
    expect(getTotalBaseOffsetMm(offset)).toBeCloseTo(291.13, 2);
  });

  it('formats imperial fractions to nearest 1/16 inch accurately', () => {
    expect(formatFractionalInches(0)).toBe('0"');
    expect(formatFractionalInches(1.375)).toBe('1 3/8"');
    expect(formatFractionalInches(0.5)).toBe('1/2"');
    expect(formatFractionalInches(-0.25)).toBe('-1/4"');
    expect(formatLength(25.4, 'in')).toBe('1.00" (1")');
    expect(formatLength(125.4, 'cm')).toBe('12.54 cm');
  });

  it('generates visible ticks with base offset shifted off zero', () => {
    const axis: RulerAxisState = { scrollOffsetMm: 0, direction: 1 };
    const ticks = generateVisibleTicks(120, pxPerMm, axis, 150, 'mm');
    // 120 px / 6 px/mm = 20 mm window -> 150..170 mm inclusive = 21 ticks
    expect(ticks).toHaveLength(21);
    expect(ticks[0].valueMm).toBe(150);
    expect(ticks[0].level).toBe('major');
    expect(ticks[0].label).toBe('150');
    expect(ticks[5].level).toBe('medium');
    expect(ticks[20].valueMm).toBe(170);
  });
});
