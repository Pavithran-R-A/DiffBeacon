import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyzeDiff } from '../packages/core/src/index.js';
import {
  collectGitDiff,
  collectGitDiffAsync,
  DiffSizeLimitError,
} from '../packages/cli/src/index.js';
import {
  createFixtureRepository,
  removeFixtureRepository,
  writeRepositoryFile,
  type FixtureRepository,
} from './git-repository-fixture.js';

const fixtures: FixtureRepository[] = [];

function repository(prefix: string, nestedPath: string): FixtureRepository {
  const fixture = createFixtureRepository({
    prefix,
    identity: 'diffbeacon-cli',
    nestedPath,
  });
  fixtures.push(fixture);
  return fixture;
}

afterEach(() => {
  for (const fixture of fixtures.splice(0)) removeFixtureRepository(fixture.root);
});

// Measured on Windows Node 24 with host Git hooks isolated: each repository here
// costs about 4 s of Git process startup, versus Vitest's 5 s default.
vi.setConfig({ testTimeout: 20_000, hookTimeout: 30_000 });

describe('CLI Git integration', () => {
  it('reviews a temporary repository located in a path with spaces', () => {
    const repo = repository('diffbeacon cli path ', 'repository with spaces');
    writeFileSync(path.join(repo.cwd, '$(touch PWNED).ts'), 'export const before = 1;\n');
    repo.git(['add', '--', '$(touch PWNED).ts']);
    repo.git(['commit', '-qm', 'base']);
    writeFileSync(path.join(repo.cwd, '$(touch PWNED).ts'), 'export const after = 2;\n');
    repo.git(['add', '--', '$(touch PWNED).ts']);
    repo.git(['commit', '-qm', 'head']);

    const diff = collectGitDiff('HEAD~1...HEAD', repo.cwd);
    expect(diff).toContain('$(touch PWNED).ts');
    expect(existsSync(path.join(repo.cwd, 'PWNED'))).toBe(false);
    expect(() => collectGitDiff('$(touch PWNED)', repo.cwd)).toThrow('Invalid revision input');
    expect(existsSync(path.join(repo.root, 'PWNED'))).toBe(false);
  });

  it('keeps real binary paths containing spaces and Unicode intact', async () => {
    const repo = repository('diffbeacon binary path ', 'repository with spaces');
    writeRepositoryFile(repo.cwd, 'dir b/image.bin', Buffer.from([0, 1, 2, 3, 4]));
    writeRepositoryFile(repo.cwd, 'unicodé-文件.ts', 'export const before = 1;\n');
    repo.git(['add', '--', '.']);
    repo.git(['commit', '-qm', 'base']);
    writeRepositoryFile(repo.cwd, 'dir b/image.bin', Buffer.from([0, 1, 2, 3, 255]));
    writeRepositoryFile(repo.cwd, 'unicodé-文件.ts', 'export const after = 2;\n');
    repo.git(['add', '--', '.']);
    repo.git(['commit', '-qm', 'head']);
    const report = analyzeDiff(await collectGitDiffAsync('HEAD~1...HEAD', repo.cwd));
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
  });

  it('rejects a real Git range above the bounded analysis limit without ENOBUFS', async () => {
    const repo = repository('diffbeacon large diff ', 'repository');
    const before = `${Array.from({ length: 100_000 }, (_, index) => `before-${index.toString().padStart(6, '0')}-${'x'.repeat(90)}`).join('\n')}\n`;
    writeRepositoryFile(repo.cwd, 'large.txt', before);
    repo.git(['add', '--', 'large.txt']);
    repo.git(['commit', '-qm', 'base']);
    writeRepositoryFile(repo.cwd, 'large.txt', before.replaceAll('before-', 'after-'));
    repo.git(['add', '--', 'large.txt']);
    repo.git(['commit', '-qm', 'head']);
    await expect(collectGitDiffAsync('HEAD~1...HEAD', repo.cwd)).rejects.toBeInstanceOf(
      DiffSizeLimitError,
    );
  }, 30_000);
});
