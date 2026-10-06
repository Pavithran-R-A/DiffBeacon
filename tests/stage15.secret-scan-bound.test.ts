import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MAX_SCANNABLE_BYTES, scanDirectory } from '../scripts/secret-scan.mjs';

describe('secret-scan resource bound', () => {
  it('fails closed instead of silently skipping an oversized file', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'diffbeacon-scan-bound-'));
    try {
      const oversized = path.join(dir, 'oversized.txt');
      writeFileSync(oversized, 'x'.repeat(MAX_SCANNABLE_BYTES + 1));
      expect(() => scanDirectory(dir)).toThrow(/exceeds the .*scan bound/i);
    } finally {
      rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    }
  });
});
