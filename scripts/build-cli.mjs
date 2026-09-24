import { chmodSync, mkdirSync } from 'node:fs';
import { build } from 'esbuild';

mkdirSync('packages/cli/dist', { recursive: true });
await build({
  entryPoints: ['packages/cli/src/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  outfile: 'packages/cli/dist/index.js',
  banner: { js: '#!/usr/bin/env node' },
});
chmodSync('packages/cli/dist/index.js', 0o755);
