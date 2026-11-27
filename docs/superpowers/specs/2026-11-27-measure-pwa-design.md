# Measure PWA — Precision Pocket Instrument Design Spec

**Date:** 2026-11-27  
**Branch:** `feat/measure-pwa`  
**Stack:** React 19 + TypeScript + Vite + `vite-plugin-pwa` + HTML5 Canvas (60fps) + Vitest

## 1. Goal & Scope

Build an offline-capable Progressive Web App (**Measure PWA**) that turns any iOS or Android smartphone screen and sensors into an engineering-grade precision measurement instrument:

1. **Calibration & Device Detection (`src/core/calibration`)** — Auto-detects phone PPI via Client Hints (`navigator.userAgentData.getHighEntropyValues(['model'])`) on Android and `(screen.width, screen.height, devicePixelRatio)` matrix on iOS, transparently reports calibration confidence (`calibrated`, `auto`, `ambiguous`, `estimated`), warns about Display Zoom or browser pinch-zoom (`visualViewport.scale`), and provides a 5-second visual calibration modal (ISO 7810 ID-1 bank card `85.60 × 53.98 mm`, coins, A4 width, or searchable device picker).
2. **L-Edge Scrollable Screen Ruler (`src/features/ruler`)** — 60fps DPR-aware Canvas ruler supporting:
   - Simultaneous **long + short side** measurement (L-mode across all 4 screen corners) or single-edge mode, plus label rotation (`0° / 90° / 180° / 270°`).
   - Direct touch/pointer **scale scrolling** to place `0` at the edge, center (`- ... 0 ... +`), flip direction, or scroll `0` completely off-screen.
   - **Known-length base offset** (`+ Offset` in mm/cm/in) so users can butt the phone against a known-length object and read total length directly.
   - **Multi-step chaining** (`+ Step`) to measure objects longer than the screen, with step history and `Undo`.
   - **Dual movable caliper cursors** showing absolute positions (with offset) and delta `Δ`, `±0.1 mm` fine nudging, `Lock Scale` toggle, and `mm` / `cm` / `in (1/16")` units.
3. **Gyroscope Protractor & Spirit Level (`src/features/angle`)** — `DeviceOrientationEvent` with explicit iOS `requestPermission()`, HTTPS verification, low-pass EMA smoothing, desktop simulator toggle for testing/demo, and 3 sub-modes:
   - **1D Inclinometer (Edge Angle)**: degrees (`0.0°`), slope (`%`), ratio (`1:N`), `Hold`.
   - **2D Surface Bullseye Level**: pitch & roll axes with horizon lock indicator (`±0.2°`).
   - **Relative Angle (`Zero / Tare`) + Camera Protractor**: wrap-safe delta angle between two surfaces and optional live camera reticle overlay.
4. **Camera Measurement Suite (`src/features/camera`)** — Honest capability-adaptive suite:
   - **Reference-Object Photo Measure (iOS & Android)**: Capture live camera frame or upload image, place loupe-assisted markers on a known reference object (`85.6 mm` bank card, `210 mm` A4, coin, or custom mm), then measure target segments in the same plane.
   - **Trigonometric Rangefinder & Height Estimator (iOS & Android)**: Live rear camera crosshair + gyroscope pitch + user camera height → point 1 (base on ground) computes horizontal distance $d$, point 2 (top) computes object height $H$.
   - **WebXR AR 3D Hit-Test (Android Chrome w/ ARCore)**: Detects `navigator.xr.isSessionSupported('immersive-ar')`, runs interactive hit-test point-to-point 3D measurement. Explicitly explains iOS Safari's WebXR/LiDAR restriction and routes iOS users straight to the universal modes.
5. **PWA, Localization, Theme & History** — English default UI with instant `EN / RU` toggle, high-contrast dark instrument theme + daylight light theme, measurement history drawer (save/copy/delete), and full offline PWA support (`manifest.webmanifest`, `sw.js`, icons, safe-area insets).

## 2. Architecture & Module Boundaries

Pure math and state engines live in `src/core/` with **zero React or DOM dependencies** (100% unit-testable in isolation):
- `src/core/calibration/`: `deviceDatabase.ts`, `detectDevice.ts`, `calibrationMath.ts`, `storage.ts`
- `src/core/ruler/`: `rulerMath.ts` (pixel ↔ physical conversion, offset/scroll/flip, chaining steps, unit formatting including `1/16"` fractions, tick generation)
- `src/core/angle/`: `angleMath.ts` (EMA filter, wrap-safe angular delta `-180..+180`, slope `%`, ratio `1:N`, 2D bullseye vector clamping)
- `src/core/camera/`: `cameraMath.ts` (reference-object Euclidean scale projection, trigonometric distance & height solver with validation guards)
- `src/core/history/`: `historyStore.ts` (typed measurement snapshots persisted in `localStorage`)
- `src/i18n/`: `translations.ts` (`en` default + `ru`), `I18nContext.tsx`

Feature UI components live in `src/features/`:
- `src/features/ruler/`: `RulerView.tsx`, `RulerCanvas.tsx`, `OffsetControls.tsx`
- `src/features/angle/`: `AngleView.tsx`, `LevelCanvas.tsx`
- `src/features/camera/`: `CameraView.tsx`, `PhotoReferenceMode.tsx`, `TrigoRangefinderMode.tsx`, `WebXRMode.tsx`
- `src/features/calibration/`: `CalibrationDialog.tsx`
- `src/features/history/`: `HistoryDialog.tsx`

## 3. Aesthetic Direction

**Swiss Precision Instrument (Mitutoyo / Leica Disto inspired)**:
- Typography: `JetBrains Mono` / `IBM Plex Mono` (`font-variant-numeric: tabular-nums`) for all live readouts, scales, and coordinates; `Space Grotesk` or `Outfit` / `Plus Jakarta Sans`? Let's use **`Barlow Condensed`** / **`Chakra Petch`** + **`IBM Plex Mono`** (industrial metrology typography — crisp, legible, unmistakably instrument-grade, zero generic SaaS look).
- Palette:
  - **Dark Instrument Mode (default)**: Obsidian anodized aluminum `#0c0f12`, machined bezel `#161b22`, laser amber-orange accent `#ff6b1a`, precision cyan secondary `#00d4aa`, crisp hairline ticks `#e6edf3`.
  - **Daylight High-Contrast Mode**: Drafting vellum `#f4f1ea`, ink charcoal `#121518`, vermilion caliper `#d9480f`, forest teal `#0b7285`.
- Layout: Full-bleed viewport (`100dvh`, `viewport-fit=cover`) so the ruler touches physical screen edges; compact floating instrument HUD in the center/free quadrant so ticks are never obstructed.

## 4. Verification Criteria

1. `npm run test` (Vitest): All unit & component tests pass.
2. `npm run typecheck`: `tsc --noEmit` exits 0.
3. `npm run lint`: ESLint exits 0 with zero errors/warnings.
4. `npm run build`: Vite + `vite-plugin-pwa` exits 0 and emits `dist/manifest.webmanifest` and `dist/sw.js`.
5. Live browser check: Launch preview server and verify Ruler, Angle, Camera, Calibration, History, EN/RU toggle, and Theme toggle with zero console errors.
