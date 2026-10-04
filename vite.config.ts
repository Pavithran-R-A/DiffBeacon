import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const root = path.dirname(fileURLToPath(import.meta.url));

/**
 * Names every sourcemapped source relative to this project, so a built artifact describes the
 * repository instead of the directory it happened to be checked out into.
 */
function projectRelativeSource(relativeSourcePath: string, sourcemapPath: string): string {
  const absolute = path.resolve(path.dirname(sourcemapPath), relativeSourcePath);
  return path.relative(root, absolute).split(path.sep).join('/');
}

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
    rollupOptions: {
      output: {
        sourcemapPathTransform: projectRelativeSource,
      },
    },
  },
  server: {
    port: 3000,
  },
});
