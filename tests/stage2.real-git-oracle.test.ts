import { rmSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseUnifiedDiff } from '../packages/core/src/index.js';
import type { ChangedFile, FileStatus } from '../packages/core/src/model.js';
import {
  createFixtureRepository,
  removeFixtureRepository,
  writeRepositoryFile,
  type FixtureRepository,
} from './git-repository-fixture.js';

// Stage 2 (Phase 3): every field the parser publishes for a real repository has to
// match something Git itself establishes. `--name-status` settles status and path
// pair, `--numstat` settles line counts and the binary marker, `--summary` settles
// mode changes. The vector below is the shipped one, so these are the bytes
// DiffBeacon actually analyzes. Git is consulted only for what a command does state:
// a mode-only change is `M` to `--name-status` and `0 0` to `--numstat`, so that case
// is checked against `--summary` and the patch's own mode pair, not against the
// counts.

const VECTOR = [
  'diff',
  '--no-ext-diff',
  '--no-textconv',
  '--no-color',
  '--src-prefix=a/',
  '--dst-prefix=b/',
  '--ignore-submodules=none',
  '--submodule=short',
  '--diff-algorithm=myers',
  '--find-renames=50%',
  '-l1000',
  '--unified=3',
  'HEAD~1..HEAD',
  '--',
];

const fixtures: FixtureRepository[] = [];

function repository(): FixtureRepository {
  const fixture = createFixtureRepository({
    prefix: 'diffbeacon-stage2-oracle-',
    identity: 'diffbeacon-stage2-oracle',
  });
  fixtures.push(fixture);
  return fixture;
}

afterEach(() => {
  for (const fixture of fixtures.splice(0)) removeFixtureRepository(fixture.root);
});

// Three repositories per case plus four Git calls each: measured well past the
// Vitest default on Windows.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 30_000 });

const rows = (output: string): string[][] =>
  output === '' ? [] : output.split('\n').map((line) => line.split('\t'));

interface Observed {
  file: ChangedFile;
  nameStatus: string[];
  numstat: string[];
  summary: string;
}

function observe(repo: FixtureRepository): Observed {
  const parsed = parseUnifiedDiff(repo.git(VECTOR));
  // Real Git output from the shipped vector must never look malformed.
  expect(parsed.diagnostics).toEqual([]);
  expect(parsed.files).toHaveLength(1);
  const [nameStatus] = rows(repo.git(['diff', '--name-status', 'HEAD~1..HEAD', '--']));
  const [numstat] = rows(repo.git(['diff', '--numstat', 'HEAD~1..HEAD', '--']));
  expect(nameStatus).toBeDefined();
  expect(numstat).toBeDefined();
  return {
    file: parsed.files[0] as ChangedFile,
    nameStatus: nameStatus as string[],
    numstat: numstat as string[],
    summary: repo.git(['diff', '--summary', 'HEAD~1..HEAD', '--']),
  };
}

const STATUS_BY_LETTER: Record<string, FileStatus> = {
  A: 'added',
  M: 'modified',
  D: 'deleted',
};

function expectMatchesGit(observed: Observed): void {
  const { file, nameStatus, numstat } = observed;
  const letter = (nameStatus[0] ?? '').charAt(0);
  if (letter === 'R') {
    expect(file.status).toBe('renamed');
    expect(file.oldPath).toBe(nameStatus[1]);
    expect(file.newPath).toBe(nameStatus[2]);
  } else {
    expect(file.status).toBe(STATUS_BY_LETTER[letter]);
    if (letter === 'A') expect(file.oldPath).toBeNull();
    if (letter === 'D') expect(file.newPath).toBeNull();
  }
  const declaredBinary = numstat[0] === '-' && numstat[1] === '-';
  expect(file.binary).toBe(declaredBinary);
  if (declaredBinary) {
    expect(file.additions).toBeNull();
    expect(file.deletions).toBeNull();
  } else {
    expect(file.additions).toBe(Number(numstat[0]));
    expect(file.deletions).toBe(Number(numstat[1]));
  }
}

const textLines = (count: number) =>
  Array.from({ length: count }, (_, index) => `line ${index}`).join('\n') + '\n';

// Git decides "binary" by looking for a NUL byte, so a repeated non-zero filler byte
// still diffs as one long text line. These payloads carry real control bytes.
const binaryPayload = (seed: number) =>
  Buffer.from(Array.from({ length: 8192 }, (_, index) => (index + seed) % 256));

describe.runIf(process.platform !== 'win32')(
  'POSIX filenames with trailing spaces cross-checked against Git',
  () => {
    it('preserves trailing spaces in a real rename emitted by the shipped vector', () => {
      const repo = repository();
      writeRepositoryFile(repo.cwd, 'old ', textLines(4));
      repo.commit('base trailing-space name');
      repo.git(['mv', '--', 'old ', 'new ']);
      repo.commit('rename trailing-space name');

      const patch = repo.git(VECTOR);
      expect(patch).toContain('diff --git a/old  b/new ');
      expect(patch).toContain('rename from old ');
      expect(patch).toContain('rename to new ');

      const parsed = parseUnifiedDiff(patch);
      expect(parsed.diagnostics).toEqual([]);
      expect(parsed.files).toHaveLength(1);
      expect(parsed.files[0]).toMatchObject({
        status: 'renamed',
        oldPath: 'old ',
        newPath: 'new ',
        displayPath: 'new ',
        similarity: 100,
      });
    });
  },
);

describe('single-file states cross-checked against Git', () => {
  it('covers modification, addition, and deletion', () => {
    const modified = repository();
    writeRepositoryFile(modified.cwd, 'f.txt', textLines(10));
    modified.commit('base');
    writeRepositoryFile(modified.cwd, 'f.txt', textLines(10).replace('line 4', 'changed 4'));
    modified.commit('modify');
    expectMatchesGit(observe(modified));

    const added = repository();
    added.git(['commit', '--allow-empty', '-qm', 'base']);
    writeRepositoryFile(added.cwd, 'n.txt', textLines(3));
    added.commit('add');
    expectMatchesGit(observe(added));

    const deleted = repository();
    writeRepositoryFile(deleted.cwd, 'd.txt', textLines(3));
    deleted.commit('base');
    rmSync(path.join(deleted.cwd, 'd.txt'));
    deleted.commit('delete');
    expectMatchesGit(observe(deleted));
  });

  it('covers rename-only and rename with edits', () => {
    const moved = repository();
    writeRepositoryFile(moved.cwd, 'old.ts', textLines(20));
    moved.commit('base');
    moved.git(['mv', '--', 'old.ts', 'new.ts']);
    moved.commit('rename');
    const movedCase = observe(moved);
    expectMatchesGit(movedCase);
    expect(movedCase.file.similarity).not.toBeNull();
    expect(movedCase.summary).toContain('rename old.ts => new.ts');

    const edited = repository();
    writeRepositoryFile(edited.cwd, 'old.ts', textLines(20));
    edited.commit('base');
    edited.git(['mv', '--', 'old.ts', 'new.ts']);
    writeRepositoryFile(
      edited.cwd,
      'new.ts',
      textLines(20).replace('line 5', 'changed 5').replace('line 6', 'changed 6'),
    );
    edited.commit('rename with edits');
    expectMatchesGit(observe(edited));
  });

  it('reports a mode-only change from the patch mode pair, not from line counts', () => {
    const repo = repository();
    // The executable bit is staged in the index only. Windows hosts ignore worktree
    // mode bits by default and Linux hosts do not, so core.fileMode=false keeps this
    // fixture producing the same mode pair on both.
    repo.git(['config', 'core.fileMode', 'false']);
    writeRepositoryFile(repo.cwd, 'run.sh', '#!/bin/sh\necho hi\n');
    repo.commit('base');
    repo.git(['update-index', '--chmod=+x', '--', 'run.sh']);
    repo.commit('make executable');
    const { file, nameStatus, numstat, summary } = observe(repo);
    // What Git states here: a modified entry, no line change, a mode transition.
    expect(nameStatus).toEqual(['M', 'run.sh']);
    expect(numstat.slice(0, 2)).toEqual(['0', '0']);
    expect(summary).toMatch(/mode change 100644 => 100755/);
    // What the parser adds from the patch body: the mode-only status and its own
    // null counts, because no hunk arrived to count.
    expect(file).toMatchObject({
      status: 'mode-only',
      modeOnly: true,
      oldMode: '100644',
      newMode: '100755',
      additions: null,
      deletions: null,
      binary: false,
    });
  });

  it('keeps counts truthful when mode and content change together', () => {
    const repo = repository();
    repo.git(['config', 'core.fileMode', 'false']);
    writeRepositoryFile(repo.cwd, 'tool.sh', textLines(4));
    repo.commit('base');
    repo.git(['update-index', '--chmod=+x', '--', 'tool.sh']);
    writeRepositoryFile(repo.cwd, 'tool.sh', textLines(4).replace('line 2', 'changed 2'));
    repo.commit('mode and content');
    const both = observe(repo);
    expectMatchesGit(both);
    expect(both.file).toMatchObject({
      status: 'modified',
      modeOnly: false,
      oldMode: '100644',
      newMode: '100755',
      additions: 1,
      deletions: 1,
    });
  });

  it('covers binary add, modify, delete, and rename with content change', () => {
    const added = repository();
    added.git(['commit', '--allow-empty', '-qm', 'base']);
    writeRepositoryFile(added.cwd, 'new.bin', binaryPayload(1));
    added.commit('add binary');
    const addedCase = observe(added);
    expectMatchesGit(addedCase);
    expect(addedCase.file.binary).toBe(true);

    const modified = repository();
    writeRepositoryFile(modified.cwd, 'c.bin', binaryPayload(1));
    modified.commit('base');
    writeRepositoryFile(modified.cwd, 'c.bin', binaryPayload(2));
    modified.commit('modify binary');
    expectMatchesGit(observe(modified));

    const deleted = repository();
    writeRepositoryFile(deleted.cwd, 'd.bin', binaryPayload(1));
    deleted.commit('base');
    rmSync(path.join(deleted.cwd, 'd.bin'));
    deleted.commit('delete binary');
    expectMatchesGit(observe(deleted));

    const renamed = repository();
    writeRepositoryFile(renamed.cwd, 'old.bin', binaryPayload(1));
    renamed.commit('base');
    renamed.git(['mv', '--', 'old.bin', 'new.bin']);
    writeRepositoryFile(renamed.cwd, 'new.bin', binaryPayload(2));
    renamed.commit('binary rename');
    expectMatchesGit(observe(renamed));
  });

  it('documents that a pure binary rename carries no binary marker to parse', () => {
    const repo = repository();
    writeRepositoryFile(repo.cwd, 'pure.bin', binaryPayload(7));
    repo.commit('base');
    repo.git(['mv', '--', 'pure.bin', 'renamed.bin']);
    repo.commit('pure binary rename');
    const file = observe(repo).file;
    expect(file).toMatchObject({
      status: 'renamed',
      oldPath: 'pure.bin',
      newPath: 'renamed.bin',
      // This patch states only the rename, so nothing proves binary content and the
      // parser must not claim it.
      binary: false,
      additions: 0,
      deletions: 0,
    });
  });

  it('covers paths with spaces, a literal b/ segment, " and ", and Unicode', () => {
    for (const name of [
      'two words.txt',
      'dir b/image.bin.txt',
      'has and inside.txt',
      '文件-файл.txt',
    ]) {
      const repo = repository();
      writeRepositoryFile(repo.cwd, name, textLines(2));
      repo.commit('base');
      writeRepositoryFile(repo.cwd, name, textLines(3));
      repo.commit(`modify ${name}`);
      const observed = observe(repo);
      expectMatchesGit(observed);
      expect(observed.file).toMatchObject({
        displayPath: name,
        oldPath: name,
        newPath: name,
      });
    }
  });

  it('covers a file whose last line has no newline marker', () => {
    const repo = repository();
    writeRepositoryFile(repo.cwd, 'tail.txt', 'one\ntwo\n');
    repo.commit('base');
    writeRepositoryFile(repo.cwd, 'tail.txt', 'one\ntwo-changed');
    repo.commit('drop the final newline');
    const observed = observe(repo);
    expectMatchesGit(observed);
    expect(observed.file).toMatchObject({ status: 'modified', additions: 1, deletions: 1 });
  });
});

describe('multi-file commits cross-checked against Git', () => {
  it('keeps one truthful entry per file Git reports', () => {
    const repo = repository();
    writeRepositoryFile(repo.cwd, 'keep.txt', textLines(5));
    writeRepositoryFile(repo.cwd, 'drop.bin', binaryPayload(3));
    repo.commit('base');
    writeRepositoryFile(repo.cwd, 'keep.txt', textLines(5).replace('line 1', 'changed 1'));
    writeRepositoryFile(repo.cwd, 'added.txt', textLines(2));
    rmSync(path.join(repo.cwd, 'drop.bin'));
    repo.commit('three changes');

    const parsed = parseUnifiedDiff(repo.git(VECTOR));
    expect(parsed.diagnostics).toEqual([]);
    const nameStatus = rows(repo.git(['diff', '--name-status', 'HEAD~1..HEAD', '--']));
    expect(parsed.files.map((file) => file.displayPath).sort()).toEqual(
      nameStatus.map((row) => row[row.length - 1]).sort(),
    );
    expect(parsed.files.map((file) => file.status).sort()).toEqual(
      nameStatus
        .map((row) => {
          const letter = (row[0] ?? '').charAt(0);
          return letter === 'R' ? 'renamed' : (STATUS_BY_LETTER[letter] as FileStatus);
        })
        .sort(),
    );
    const stats = new Map(
      rows(repo.git(['diff', '--numstat', 'HEAD~1..HEAD', '--'])).map((row) => [
        row[row.length - 1] as string,
        row,
      ]),
    );
    for (const file of parsed.files) {
      const row = stats.get(file.displayPath) as string[];
      expect(row).toBeDefined();
      const binary = row[0] === '-';
      expect(file.binary).toBe(binary);
      expect(file.additions).toBe(binary ? null : Number(row[0]));
      expect(file.deletions).toBe(binary ? null : Number(row[1]));
    }
  });
});
