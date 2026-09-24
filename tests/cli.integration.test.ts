import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyzeDiff } from '../packages/core/src/index.js';
import {
  collectGitDiff,
  collectGitDiffAsync,
  DiffSizeLimitError,
} from '../packages/cli/src/index.js';

function git(cwd: string, args: string[]) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  });
}

describe('CLI Git integration', () => {
  it('reviews a temporary repository located in a path with spaces', () => {
    const parent = mkdtempSync(path.join(tmpdir(), 'diffbeacon cli path '));
    const repo = path.join(parent, 'repository with spaces');
    mkdirSync(repo, { recursive: true });
    try {
      git(repo, ['init', '-q']);
      git(repo, ['config', 'user.email', 'diffbeacon-test@example.invalid']);
      git(repo, ['config', 'user.name', 'DiffBeacon test']);
      writeFileSync(path.join(repo, '$(touch PWNED).ts'), 'export const before = 1;\n');
      git(repo, ['add', '--', '$(touch PWNED).ts']);
      git(repo, ['commit', '-qm', 'base']);
      writeFileSync(path.join(repo, '$(touch PWNED).ts'), 'export const after = 2;\n');
      git(repo, ['add', '--', '$(touch PWNED).ts']);
      git(repo, ['commit', '-qm', 'head']);

      const diff = collectGitDiff('HEAD~1...HEAD', repo);
      expect(diff).toContain('$(touch PWNED).ts');
      expect(existsSync(path.join(repo, 'PWNED'))).toBe(false);
      expect(() => collectGitDiff('$(touch PWNED)', repo)).toThrow('Invalid revision input');
      expect(existsSync(path.join(repo, 'PWNED'))).toBe(false);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('keeps real binary paths containing spaces and Unicode intact', async () => {
    const parent = mkdtempSync(path.join(tmpdir(), 'diffbeacon binary path '));
    const repo = path.join(parent, 'repository with spaces');
    mkdirSync(path.join(repo, 'dir b'), { recursive: true });
    try {
      git(repo, ['init', '-q']);
      git(repo, ['config', 'user.email', 'diffbeacon-test@example.invalid']);
      git(repo, ['config', 'user.name', 'DiffBeacon test']);
      writeFileSync(path.join(repo, 'dir b', 'image.bin'), Buffer.from([0, 1, 2, 3, 4]));
      writeFileSync(path.join(repo, 'unicodé-文件.ts'), 'export const before = 1;\n');
      git(repo, ['add', '--', '.']);
      git(repo, ['commit', '-qm', 'base']);
      writeFileSync(path.join(repo, 'dir b', 'image.bin'), Buffer.from([0, 1, 2, 3, 255]));
      writeFileSync(path.join(repo, 'unicodé-文件.ts'), 'export const after = 2;\n');
      git(repo, ['add', '--', '.']);
      git(repo, ['commit', '-qm', 'head']);
      const report = analyzeDiff(await collectGitDiffAsync('HEAD~1...HEAD', repo));
      expect(report.files.map((file) => file.displayPath)).toEqual([
        'dir b/image.bin',
        'unicodé-文件.ts',
      ]);
      expect(report.files.find((file) => file.displayPath === 'dir b/image.bin')).toMatchObject({
        status: 'modified',
        binary: true,
        additions: null,
        deletions: null,
      });
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('rejects a real Git range above the bounded analysis limit without ENOBUFS', async () => {
    const parent = mkdtempSync(path.join(tmpdir(), 'diffbeacon large diff '));
    const repo = path.join(parent, 'repository');
    mkdirSync(repo, { recursive: true });
    try {
      git(repo, ['init', '-q']);
      git(repo, ['config', 'user.email', 'diffbeacon-test@example.invalid']);
      git(repo, ['config', 'user.name', 'DiffBeacon test']);
      const before = `${Array.from({ length: 100_000 }, (_, index) => `before-${index.toString().padStart(6, '0')}-${'x'.repeat(90)}`).join('\n')}\n`;
      const after = before.replaceAll('before-', 'after-');
      writeFileSync(path.join(repo, 'large.txt'), before);
      git(repo, ['add', '--', 'large.txt']);
      git(repo, ['commit', '-qm', 'base']);
      writeFileSync(path.join(repo, 'large.txt'), after);
      git(repo, ['add', '--', 'large.txt']);
      git(repo, ['commit', '-qm', 'head']);
      await expect(collectGitDiffAsync('HEAD~1...HEAD', repo)).rejects.toBeInstanceOf(
        DiffSizeLimitError,
      );
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  }, 30_000);
});
