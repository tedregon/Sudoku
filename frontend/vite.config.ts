import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
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
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
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
