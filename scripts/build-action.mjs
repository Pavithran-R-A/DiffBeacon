import { mkdirSync } from 'node:fs';
import { build } from 'esbuild';

mkdirSync('packages/action/dist', { recursive: true });
await build({
  entryPoints: ['packages/action/src/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  outfile: 'packages/action/dist/index.js',
});
