import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.resolve(root, 'client'),
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(root, 'client/src'),
      '@core': path.resolve(root, 'packages/core/src'),
    },
  },
  build: {
    outDir: path.resolve(root, 'dist'),
    emptyOutDir: true,
    sourcemap: true,
  },
  server: {
    port: 3000,
  },
});
