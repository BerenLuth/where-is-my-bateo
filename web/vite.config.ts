import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Where Is My Bateo',
        short_name: 'Bateo',
        description: 'Posizione e ritardo in tempo reale di bus, tram e battelli ACTV.',
        lang: 'it',
        display: 'standalone',
        start_url: '/',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The shell is precached; the SPA fallback must never swallow API calls.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          // Live positions are never served from a cache: stale data must not look live.
          { urlPattern: /\/api\/snapshot$/, handler: 'NetworkOnly' },
          { urlPattern: /\/api\/shapes\//, handler: 'StaleWhileRevalidate', options: { cacheName: 'shapes' } },
          {
            // Keep it modest: the OSM tile policy forbids bulk or offline pre-fetching.
            urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'tiles',
              expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 3600 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: { proxy: { '/api': 'http://localhost:3001' } },
});
