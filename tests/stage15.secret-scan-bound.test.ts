import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { scanDirectory } from '../scripts/secret-scan.mjs';

describe('secret-scan resource bound', () => {
  it('fails closed instead of silently skipping an oversized file', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'diffbeacon-scan-bound-'));
    try {
      const oversized = path.join(dir, 'oversized.txt');
      // The committed scanner bound is 4 MiB. Make the fixture unambiguously larger without
      // importing a JavaScript-only implementation constant into the TypeScript test surface.
      writeFileSync(oversized, 'x'.repeat(5 * 1024 * 1024));
      expect(() => scanDirectory(dir)).toThrow(/exceeds the .*scan bound/i);
    } finally {
      rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    }
  });
});
