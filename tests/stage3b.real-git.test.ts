import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parseUnifiedDiff } from '../packages/core/src/parser.js';
import type { ChangedFile } from '../packages/core/src/model.js';

const repositories: string[] = [];

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    windowsHide: true,
  }).trim();
}

function repository(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'diffbeacon-stage3b-git-'));
  repositories.push(cwd);
  git(cwd, ['init', '-q']);
  git(cwd, ['config', 'user.email', 'diffbeacon-stage3b@example.invalid']);
  git(cwd, ['config', 'user.name', 'DiffBeacon Stage 3B']);
  return cwd;
}

function commit(cwd: string, message: string): void {
  git(cwd, ['add', '--all']);
  git(cwd, ['commit', '-qm', message]);
}

function changed(cwd: string, findRenames = false, renameScore = '-M'): ChangedFile {
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
  const files = parseUnifiedDiff(git(cwd, args)).files;
  expect(files).toHaveLength(1);
  return files[0] as ChangedFile;
}

afterEach(() => {
  for (const cwd of repositories.splice(0)) rmSync(cwd, { recursive: true, force: true });
});

describe('real Git file-state metadata', () => {
  it('recognizes an empty file add without /dev/null headers', () => {
    const cwd = repository();
    git(cwd, ['commit', '--allow-empty', '-qm', 'base']);
    writeFileSync(path.join(cwd, 'empty.txt'), '');
    commit(cwd, 'add empty');
    const file = changed(cwd);
    expect(file).toMatchObject({
      status: 'added',
      oldPath: null,
      newPath: 'empty.txt',
      binary: false,
      additions: 0,
      deletions: 0,
    });
  });

  it('recognizes an empty file delete without /dev/null headers', () => {
    const cwd = repository();
    writeFileSync(path.join(cwd, 'empty.txt'), '');
    commit(cwd, 'base empty');
    rmSync(path.join(cwd, 'empty.txt'));
    commit(cwd, 'delete empty');
    const file = changed(cwd);
    expect(file).toMatchObject({
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
    git(added, ['commit', '--allow-empty', '-qm', 'base']);
    writeFileSync(path.join(added, 'new.txt'), 'one\ntwo\n');
    commit(added, 'add text');
    expect(changed(added)).toMatchObject({
      status: 'added',
      oldPath: null,
      newPath: 'new.txt',
      binary: false,
      additions: 2,
      deletions: 0,
    });

    const deleted = repository();
    writeFileSync(path.join(deleted, 'old.txt'), 'one\ntwo\n');
    commit(deleted, 'base text');
    rmSync(path.join(deleted, 'old.txt'));
    commit(deleted, 'delete text');
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
    git(added, ['commit', '--allow-empty', '-qm', 'base']);
    writeFileSync(path.join(added, 'new.bin'), Buffer.from([0, 1, 2, 3]));
    commit(added, 'add binary');
    expect(changed(added)).toMatchObject({
      status: 'added',
      oldPath: null,
      newPath: 'new.bin',
      binary: true,
      additions: null,
      deletions: null,
    });

    const deleted = repository();
    writeFileSync(path.join(deleted, 'old.bin'), Buffer.from([0, 1, 2, 3]));
    commit(deleted, 'base binary');
    rmSync(path.join(deleted, 'old.bin'));
    commit(deleted, 'delete binary');
    expect(changed(deleted)).toMatchObject({
      status: 'deleted',
      oldPath: 'old.bin',
      newPath: null,
      binary: true,
      additions: null,
      deletions: null,
    });

    const modified = repository();
    writeFileSync(path.join(modified, 'changed.bin'), Buffer.from([0, 1, 2, 3]));
    commit(modified, 'base binary');
    writeFileSync(path.join(modified, 'changed.bin'), Buffer.from([0, 1, 2, 255]));
    commit(modified, 'modify binary');
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
  function renameRepository(oldPath: string, newPath: string, modify = false): string {
    const cwd = repository();
    const original = Array.from({ length: 12 }, (_, index) => `line ${index}\n`).join('');
    writeFileSync(path.join(cwd, oldPath), original);
    commit(cwd, 'base rename');
    git(cwd, ['mv', '--', oldPath, newPath]);
    if (modify) writeFileSync(path.join(cwd, newPath), original.replace('line 4', 'changed 4'));
    commit(cwd, 'rename');
    return cwd;
  }

  it('keeps rename-only status and paths', () => {
    const file = changed(renameRepository('old.ts', 'new.ts'), true);
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
    const file = changed(renameRepository('old.ts', 'new.ts', true), true);
    expect(file.status).toBe('renamed');
    expect(file.oldPath).toBe('old.ts');
    expect(file.newPath).toBe('new.ts');
    expect(file.additions).toBeGreaterThan(0);
    expect(file.deletions).toBeGreaterThan(0);
  });

  it('recognizes a binary rename with content changes', () => {
    const cwd = repository();
    const original = Buffer.alloc(4096, 0);
    writeFileSync(path.join(cwd, 'old.bin'), original);
    commit(cwd, 'base binary rename');
    git(cwd, ['mv', '--', 'old.bin', 'new.bin']);
    original[128] = 255;
    writeFileSync(path.join(cwd, 'new.bin'), original);
    commit(cwd, 'binary rename');
    expect(changed(cwd, true, '-M0')).toMatchObject({
      status: 'renamed',
      oldPath: 'old.bin',
      newPath: 'new.bin',
      binary: true,
      additions: null,
      deletions: null,
    });
  });

  it('decodes a Unicode rename path emitted by real Git', () => {
    const file = changed(renameRepository('old-文件.ts', 'new-文件.ts'), true);
    expect(file).toMatchObject({
      status: 'renamed',
      oldPath: 'old-文件.ts',
      newPath: 'new-文件.ts',
    });
  });
});
