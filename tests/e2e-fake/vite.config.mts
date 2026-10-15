// Vite config for the LOCAL signed-in test harness only: swaps firebase/* for HTTP shims that talk to
// tests/helpers/e2e-server.ts. Not used by `npm run dev` or any build.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const fake = (n: string) => path.join(here, n);

export default defineConfig({
  root,
  plugins: [react(), tailwindcss()],
  define: {
    'import.meta.env.VITE_FIREBASE_PROJECT_ID': JSON.stringify('e2e-harness'),
    'import.meta.env.VITE_ADMIN_EMAIL': JSON.stringify('admin@e2e.test'),
  },
  resolve: {
    alias: [
      { find: 'firebase/app', replacement: fake('firebase-app.ts') },
      { find: 'firebase/auth', replacement: fake('firebase-auth.ts') },
      { find: 'firebase/firestore', replacement: fake('firebase-firestore.ts') },
      { find: '@', replacement: root },
    ],
  },
  server: {
    port: Number(process.env.E2E_PORT ?? 5176),
    strictPort: true,
    hmr: false,
    fs: { allow: [root] },
    proxy: {
      '/__fs': 'http://localhost:3100',
      '/__auth': 'http://localhost:3100',
      '/__debug': 'http://localhost:3100',
      '/__reset': 'http://localhost:3100',
      '/api': { target: 'http://localhost:3100', bypass: (req) => (req.url?.startsWith('/api/_lib/') ? req.url : undefined) },
    },
  },
});
