import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { describe, expect, it } from 'vitest';
import { renderSourceManifest, trackedSourceFiles } from '../scripts/source-manifest.mjs';

const files = trackedSourceFiles();

describe('Source manifest governance', () => {
  it('lists tracked product source and omits forensic material', () => {
    expect(files).toContain('packages/action/dist/index.js');
    expect(files).toContain('action.yml');
    expect(files).toContain('.github/workflows/ci.yml');
    expect(files).toContain('packages/cli/src/git.ts');
    expect(files).toContain('tests/stage5.git-determinism.test.ts');
    expect(files).toContain('scripts/generate-source-manifest.mjs');
    for (const excluded of [
      'SOURCE_MANIFEST.txt',
      'RECOVERY_STAGE0.md',
      '.bootstrap/chunk00',
      '.bootstrap2/payload.tar.xz',
      'docs/recovery/README.md',
      'docs/audits/stage1-rebaseline.md',
    ])
      expect(files).not.toContain(excluded);
    expect(files.some((file) => file.startsWith('node_modules/'))).toBe(false);
    expect(files.some((file) => file.endsWith('.tgz'))).toBe(false);
  });

  it('renders a timeless header and byte-consistent entries', () => {
    const manifest = renderSourceManifest();
    const lines = manifest.split('\n');
    expect(lines[0]).toBe('# DiffBeacon source manifest');
    expect(manifest).toBe(renderSourceManifest());
    expect(manifest).not.toMatch(/\r/);
    expect(manifest).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    const entries = lines.filter((line) => /^[0-9a-f]{64} {2}\S/.test(line));
    expect(entries).toHaveLength(files.length);
    for (const line of entries) {
      const digest = line.slice(0, 64);
      const file = line.slice(66);
      expect(files).toContain(file);
      expect(createHash('sha256').update(readFileSync(file)).digest('hex')).toBe(digest);
    }
  });

  it('cannot be changed by an untracked scratch file', () => {
    const scratch = path.join(process.cwd(), 'untracked-manifest-probe.txt');
    const before = renderSourceManifest();
    try {
      writeFileSync(scratch, 'untracked probe\n', 'utf8');
      expect(renderSourceManifest()).toBe(before);
    } finally {
      rmSync(scratch, { force: true });
    }
  });

  it('orders paths by UTF-8 bytes so platforms agree', () => {
    const asBytes = files.map((file) => Buffer.from(file, 'utf8'));
    const sorted = [...asBytes].sort(Buffer.compare);
    expect(asBytes.map((entry) => entry.toString('utf8'))).toEqual(
      sorted.map((entry) => entry.toString('utf8')),
    );
  });
});

describe.runIf(process.platform !== 'win32')('Source manifest symbolic-link boundary', () => {
  it('hashes the tracked link blob instead of bytes outside the repository', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'diffbeacon-manifest-link-'));
    const checkout = path.join(root, 'repo');
    const outside = path.join(root, 'outside.txt');
    const link = path.join(checkout, 'link.txt');
    try {
      execFileSync('git', ['init', '-q', checkout], { shell: false, windowsHide: true });
      writeFileSync(outside, 'outside secret one\n', 'utf8');
      symlinkSync('../outside.txt', link);
      execFileSync('git', ['-C', checkout, 'add', '--', 'link.txt'], {
        shell: false,
        windowsHide: true,
      });
      expect(
        execFileSync('git', ['-C', checkout, 'ls-files', '-s', '--', 'link.txt'], {
          encoding: 'utf8',
          shell: false,
          windowsHide: true,
        }),
      ).toMatch(/^120000 /);

      const expected = createHash('sha256').update('../outside.txt').digest('hex');
      const before = renderSourceManifest(checkout);
      expect(before).toContain(`${expected}  link.txt`);
      expect(before).not.toContain(
        createHash('sha256').update('outside secret one\n').digest('hex'),
      );

      writeFileSync(outside, 'outside secret two\n', 'utf8');
      expect(renderSourceManifest(checkout)).toBe(before);
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    }
  });
});

