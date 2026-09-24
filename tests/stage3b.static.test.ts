import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sourceFiles = [
  'vite.config.ts',
  'client/index.html',
  'client/src/index.css',
  'client/src/main.tsx',
  'client/src/App.tsx',
  'client/src/pages/Home.tsx',
];

describe('Stage 3B static web boundary', () => {
  it('contains no Manus, Forge, storage proxy, or telemetry references in production source', () => {
    const source = sourceFiles.map((file) => readFileSync(file, 'utf8')).join('\n');
    expect(source).not.toMatch(/manus-storage|manus-storage-proxy|BUILT_IN_FORGE/i);
    expect(source).not.toMatch(/debug-collector|sendBeacon|XMLHttpRequest|WebSocket/i);
  });

  it('uses a root local default and explicit repository base in the Pages workflow', () => {
    expect(readFileSync('vite.config.ts', 'utf8')).toContain("process.env.BASE_PATH ?? '/'");
    expect(readFileSync('.github/workflows/pages.yml', 'utf8')).toContain(
      'BASE_PATH="/${{ github.event.repository.name }}/"',
    );
  });

  it('keeps the browser app free of upload/network analysis APIs', () => {
    const browserSource = sourceFiles
      .filter((file) => file.startsWith('client/'))
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');
    expect(browserSource).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/i);
  });
});
