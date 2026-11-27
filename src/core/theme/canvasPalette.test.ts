import { describe, expect, it } from 'vitest';
import { getCanvasPalette } from './canvasPalette';

describe('canvas palette resolution', () => {
  it('returns concrete hex colors (never light-dark) for both dark and light schemes', () => {
    for (const scheme of ['dark', 'light'] as const) {
      const palette = getCanvasPalette(scheme);
      for (const value of Object.values(palette)) {
        expect(value).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(value).not.toContain('light-dark');
      }
    }
  });
});
