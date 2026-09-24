import { rmSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseUnifiedDiff } from '../packages/core/src/parser.js';
import type { ChangedFile } from '../packages/core/src/model.js';
import {
  createFixtureRepository,
  removeFixtureRepository,
  writeRepositoryFile,
  type FixtureRepository,
} from './git-repository-fixture.js';

const fixtures: FixtureRepository[] = [];

function repository(): FixtureRepository {
  const fixture = createFixtureRepository({
    prefix: 'diffbeacon-stage3b-git-',
    identity: 'diffbeacon-stage3b',
  });
  fixtures.push(fixture);
  return fixture;
}

afterEach(() => {
  for (const fixture of fixtures.splice(0)) removeFixtureRepository(fixture.root);
});

// Measured on Windows Node 24 with host Git hooks isolated: the three-repository
// cases here need about 6 s, versus Vitest's 5 s default.
vi.setConfig({ testTimeout: 20_000, hookTimeout: 30_000 });

function changed(repo: FixtureRepository, findRenames = false, renameScore = '-M'): ChangedFile {
  const args = [
    'diff',
    '--no-ext-diff',
    '--no-textconv',
    '--no-color',
    '--binary',
    ...(findRenames ? [renameScore] : []),
    '--unified=3',
    'HEAD~1..HEAD',
    '--',
  ];
  const files = parseUnifiedDiff(repo.git(args)).files;
  expect(files).toHaveLength(1);
  return files[0] as ChangedFile;
}

describe('real Git file-state metadata', () => {
  it('recognizes an empty file add without /dev/null headers', () => {
    const repo = repository();
    repo.git(['commit', '--allow-empty', '-qm', 'base']);
    writeRepositoryFile(repo.cwd, 'empty.txt', '');
    repo.commit('add empty');
    expect(changed(repo)).toMatchObject({
      status: 'added',
      oldPath: null,
      newPath: 'empty.txt',
      binary: false,
      additions: 0,
      deletions: 0,
    });
  });

  it('recognizes an empty file delete without /dev/null headers', () => {
    const repo = repository();
    writeRepositoryFile(repo.cwd, 'empty.txt', '');
    repo.commit('base empty');
    rmSync(path.join(repo.cwd, 'empty.txt'));
    repo.commit('delete empty');
    expect(changed(repo)).toMatchObject({
      status: 'deleted',
      oldPath: 'empty.txt',
      newPath: null,
      binary: false,
      additions: 0,
      deletions: 0,
    });
  });

  it('recognizes nonempty text additions and deletions with line counts', () => {
    const added = repository();
    added.git(['commit', '--allow-empty', '-qm', 'base']);
    writeRepositoryFile(added.cwd, 'new.txt', 'one\ntwo\n');
    added.commit('add text');
    expect(changed(added)).toMatchObject({
      status: 'added',
      oldPath: null,
      newPath: 'new.txt',
      binary: false,
      additions: 2,
      deletions: 0,
    });

    const deleted = repository();
    writeRepositoryFile(deleted.cwd, 'old.txt', 'one\ntwo\n');
    deleted.commit('base text');
    rmSync(path.join(deleted.cwd, 'old.txt'));
    deleted.commit('delete text');
    expect(changed(deleted)).toMatchObject({
      status: 'deleted',
      oldPath: 'old.txt',
      newPath: null,
      binary: false,
      additions: 0,
      deletions: 2,
    });
  });

  it('recognizes real Git binary add, delete, and modification patches', () => {
    const added = repository();
    added.git(['commit', '--allow-empty', '-qm', 'base']);
    writeRepositoryFile(added.cwd, 'new.bin', Buffer.from([0, 1, 2, 3]));
    added.commit('add binary');
    expect(changed(added)).toMatchObject({
      status: 'added',
      oldPath: null,
      newPath: 'new.bin',
      binary: true,
      additions: null,
      deletions: null,
    });

    const deleted = repository();
    writeRepositoryFile(deleted.cwd, 'old.bin', Buffer.from([0, 1, 2, 3]));
    deleted.commit('base binary');
    rmSync(path.join(deleted.cwd, 'old.bin'));
    deleted.commit('delete binary');
    expect(changed(deleted)).toMatchObject({
      status: 'deleted',
      oldPath: 'old.bin',
      newPath: null,
      binary: true,
      additions: null,
      deletions: null,
    });

    const modified = repository();
    writeRepositoryFile(modified.cwd, 'changed.bin', Buffer.from([0, 1, 2, 3]));
    modified.commit('base binary');
    writeRepositoryFile(modified.cwd, 'changed.bin', Buffer.from([0, 1, 2, 255]));
    modified.commit('modify binary');
    expect(changed(modified)).toMatchObject({
      status: 'modified',
      oldPath: 'changed.bin',
      newPath: 'changed.bin',
      binary: true,
      additions: null,
      deletions: null,
    });
  });
});

describe('real Git rename metadata', () => {
  function renameRepository(
    repo: FixtureRepository,
    oldPath: string,
    newPath: string,
    modify = false,
  ): FixtureRepository {
    const original = Array.from({ length: 12 }, (_, index) => `line ${index}\n`).join('');
    writeRepositoryFile(repo.cwd, oldPath, original);
    repo.commit('base rename');
    repo.git(['mv', '--', oldPath, newPath]);
    if (modify) writeRepositoryFile(repo.cwd, newPath, original.replace('line 4', 'changed 4'));
    repo.commit('rename');
    return repo;
  }

  it('keeps rename-only status and paths', () => {
    const file = changed(renameRepository(repository(), 'old.ts', 'new.ts'), true);
    expect(file).toMatchObject({
      status: 'renamed',
      oldPath: 'old.ts',
      newPath: 'new.ts',
      binary: false,
      additions: 0,
      deletions: 0,
    });
  });

  it('keeps renamed status when content also changes', () => {
    const file = changed(renameRepository(repository(), 'old.ts', 'new.ts', true), true);
    expect(file.status).toBe('renamed');
    expect(file.oldPath).toBe('old.ts');
    expect(file.newPath).toBe('new.ts');
    expect(file.additions).toBeGreaterThan(0);
    expect(file.deletions).toBeGreaterThan(0);
  });

  it('recognizes a binary rename with content changes', () => {
    const repo = repository();
    const original = Buffer.alloc(4096, 0);
    writeRepositoryFile(repo.cwd, 'old.bin', original);
    repo.commit('base binary rename');
    repo.git(['mv', '--', 'old.bin', 'new.bin']);
    original[128] = 255;
    writeRepositoryFile(repo.cwd, 'new.bin', original);
    repo.commit('binary rename');
    expect(changed(repo, true, '-M0')).toMatchObject({
      status: 'renamed',
      oldPath: 'old.bin',
      newPath: 'new.bin',
      binary: true,
      additions: null,
      deletions: null,
    });
  });

  it('decodes a Unicode rename path emitted by real Git', () => {
    const file = changed(renameRepository(repository(), 'old-文件.ts', 'new-文件.ts'), true);
    expect(file).toMatchObject({
      status: 'renamed',
      oldPath: 'old-文件.ts',
      newPath: 'new-文件.ts',
    });
  });
});
