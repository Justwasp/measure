# Project Context — Measure PWA

## Overview
Offline-first Progressive Web App turning iOS/Android screens & sensors into a precision measurement suite (L-Edge Scrollable Ruler, Gyroscope Protractor & Spirit Level, Camera Reference-Object + Trigonometric + WebXR AR suite).

## Key Rules & Standards
- Branch policy: Never commit directly to `main` or `master`. Work on feature branch `feat/measure-pwa`.
- Verification commands:
  - `npm run test` (Vitest)
  - `npm run typecheck` (`tsc --noEmit`)
  - `npm run lint` (`eslint .`)
  - `npm run build` (`vite build` + PWA manifest/SW generation)

## Error Log & Lessons Learned
<!-- Format: [DATE] Problem: X → Solution: Y -->
- [2026-11-27] Problem: `tsc -b --noEmit` reported `TS2307: Cannot find module './styles/index.css'` because `tsconfig.app.json` overrode `types` without `vite/client` → Solution: Add `src/vite-env.d.ts` with `/// <reference types="vite/client" />` and `/// <reference types="vite-plugin-pwa/client" />` so CSS and virtual PWA module imports always typecheck cleanly.
- [2026-11-27] Problem: Canvas 2D `fillStyle`/`strokeStyle` ignored CSS custom properties containing `light-dark(...)` from `getComputedStyle`, rendering Ruler and Angle canvases solid black → Solution: Resolve concrete hex colors per active `ResolvedColorScheme` via `getCanvasPalette(colorScheme)` and pass `colorScheme` into `RulerCanvas` and `LevelCanvas` so both Dark and Light themes draw crisply.
- [2026-11-27] Problem: `vite.config.ts` referencing `process.env` failed `tsc -b --noEmit` without `@types/node` → Solution: Use Vite's built-in `defineConfig(({ mode }) => ...)` with `loadEnv(mode, '.', 'VITE_')` so `VITE_BASE_PATH` works with zero extra Node type dependencies.
- [2026-11-27] Problem: jsdom Canvas 2D mock lacked `quadraticCurveTo`/`toDataURL` and didn't fire `Image.onload` synchronously → Solution: Extend `src/test/setup.ts` Canvas mock with curve/transform/`toDataURL` methods and store explicit `width`/`height` on `PhotoDemoPreset` for immediate dimension updates.
