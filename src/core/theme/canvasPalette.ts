import type { ResolvedColorScheme } from './useColorScheme';

export interface CanvasPalette {
  bg: string;
  bandBg: string;
  textPrimary: string;
  textMuted: string;
  border: string;
  accentPrimary: string;
  accentSecondary: string;
  ok: string;
}

const DARK_PALETTE: CanvasPalette = {
  bg: '#0b0e11',
  bandBg: '#141920',
  textPrimary: '#eef2f6',
  textMuted: '#7a8a9c',
  border: '#2d3744',
  accentPrimary: '#ff6b1a',
  accentSecondary: '#00d4aa',
  ok: '#2fd674',
};

const LIGHT_PALETTE: CanvasPalette = {
  bg: '#f4f1ea',
  bandBg: '#ffffff',
  textPrimary: '#11151a',
  textMuted: '#6c757d',
  border: '#cfc7b8',
  accentPrimary: '#d9480f',
  accentSecondary: '#0b7285',
  ok: '#2b8a3e',
};

/**
 * Returns concrete hex colors for Canvas 2D contexts because Canvas `fillStyle`/`strokeStyle`
 * cannot evaluate CSS `light-dark()` expressions returned by `getComputedStyle`.
 */
export function getCanvasPalette(scheme: ResolvedColorScheme): CanvasPalette {
  return scheme === 'light' ? LIGHT_PALETTE : DARK_PALETTE;
}
