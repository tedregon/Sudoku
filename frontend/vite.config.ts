import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const versionPath = join(__dirname, 'public', 'version.json');
const appVersion = existsSync(versionPath)
  ? JSON.parse(readFileSync(versionPath, 'utf-8')).version
  : 'dev';

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false,
      workbox: {
        // Hashed JS/CSS and icons are safe to precache. HTML stays network-first
        // so a refresh picks up a new deploy, with the last page cached for offline launch.
        globPatterns: ['**/*.{js,css,svg,png,webmanifest,woff2}'],
        globIgnores: ['**/version.json'],
        navigateFallback: undefined,
        runtimeCaching: [
          {
            urlPattern: ({ request, url }) =>
              request.mode === 'navigate' &&
              request.destination === 'document' &&
              !url.pathname.startsWith('/socket.io') &&
              !url.pathname.startsWith('/api') &&
              !/\.(?:png|ico|svg|webmanifest|json|webp|jpe?g|gif)$/i.test(url.pathname),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            urlPattern: /\/version\.json$/,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
      '/api': {
        target: 'http://localhost:3001',
      },
    },
  },
  preview: {
    port: process.env.PORT ? parseInt(process.env.PORT) : 8080,
    host: '0.0.0.0',
    allowedHosts: [
      'sudoku-frontend-production-e610.up.railway.app',
      '.up.railway.app', // Allow all Railway subdomains
    ],
  },
});
