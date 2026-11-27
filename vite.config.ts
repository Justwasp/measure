import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  const base = env.VITE_BASE_PATH || '/';

  return {
    base,
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'],
        manifest: {
          name: 'Measure — Precision Pocket Instrument',
          short_name: 'Measure',
          description:
            'Offline precision screen ruler with scrollable zero & chaining, gyroscope protractor & spirit level, and camera measurement suite.',
          theme_color: '#0c0f12',
          background_color: '#0c0f12',
          display: 'standalone',
          orientation: 'any',
          start_url: base,
          scope: base,
          categories: ['utilities', 'productivity'],
          icons: [
            {
              src: 'icon-192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'icon-512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: 'icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
            {
              src: 'icon.svg',
              sizes: 'any',
              type: 'image/svg+xml',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
        },
      }),
    ],
  };
});
