import { randomBytes } from 'node:crypto';
import { readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyzeDiff } from '../packages/core/src/index.js';
import { collectGitDiffAsync } from '../packages/cli/src/index.js';
import {
  createFixtureRepository,
  gitIn,
  removeFixtureRepository,
  writeRepositoryFile,
  type FixtureRepository,
} from './git-repository-fixture.js';

const fixtures: FixtureRepository[] = [];

function repository(nestedPath?: string): FixtureRepository {
  const fixture = createFixtureRepository({
    prefix: 'diffbeacon-stage5-git-',
    identity: 'diffbeacon-stage5',
    ...(nestedPath ? { nestedPath } : {}),
  });
  fixtures.push(fixture);
  return fixture;
}

afterEach(() => {
  for (const fixture of fixtures.splice(0)) removeFixtureRepository(fixture.root);
});

// Measured on Windows with host Git hooks isolated: the multi-repository cases here need
// 5-15 s versus Vitest's 5 s default, and the same case that took 14.9 s when this file ran
// alone took over 20 s inside the Action bundle verification run, where another Vitest process
// competes for the same disk. The budget is per file; pure unit suites keep the default.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 30_000 });

/** Command vectors a document tells a reader to run: fenced blocks and the table row. */
function prescribedGitVector(doc: string): string {
  const collected: string[] = [];
  let inFence = false;
  for (const line of doc.split('\n')) {
    if (line.trim().startsWith('```')) {
      inFence = !inFence;
      continue;
    }
    if (inFence || line.startsWith('| Git behavior')) collected.push(line);
  }
  return collected.join(' ');
}

describe('Git diff determinism boundary', () => {
  it('owns structural flags and omits full binary patch generation', () => {
    const source = readFileSync('packages/cli/src/git.ts', 'utf8');
    expect(source).toContain("'--src-prefix=a/'");
    expect(source).toContain("'--dst-prefix=b/'");
    expect(source).not.toContain("'--default-prefix'");
    expect(source).toContain("'--diff-algorithm=myers'");
    expect(source).toContain("'--find-renames=50%'");
    expect(source).toContain("'-l1000'");
    expect(source).not.toContain("'--binary'");
    expect(source).toContain("'--no-ext-diff'");
    expect(source).toContain("'--no-textconv'");
    expect(source).toContain("'--no-color'");
    expect(source).toContain("'--'");
    expect(source).toContain("'--ignore-submodules=none'");
    expect(source).toContain("'--submodule=short'");
  });

  it('documents only runnable Action and CLI references', () => {
    const rootReadme = readFileSync('README.md', 'utf8');
    const actionReadme = readFileSync('packages/action/README.md', 'utf8');
    const manifest = JSON.parse(readFileSync('packages/cli/package.json', 'utf8')) as {
      repository: { type: string; url: string };
      homepage: string;
      bugs: { url: string };
      keywords: string[];
    };
    expect(rootReadme).not.toContain('OWNER/diffbeacon');
    expect(actionReadme).not.toContain('OWNER/diffbeacon');
    // A tag-style reference is only valid after a public release exists. Stage 6 keeps that
    // rule and adds one exception it can still prove: the documented placeholder, which no
    // runner can resolve.
    for (const readme of [rootReadme, actionReadme]) {
      const ownerReferences = readme.match(/uses:\s*\S*diffbeacon@\S*/gi) ?? [];
      for (const reference of ownerReferences)
        expect(reference).toBe('uses: Pavithran-R-A/DiffBeacon@<REVIEWED_FULL_COMMIT_SHA>');
      expect(readme).toContain('uses: ./');
    }
    expect(rootReadme).toContain('not published to the npm registry yet');
    expect(rootReadme).toContain('node packages/cli/dist/index.js review');
    expect(manifest.repository).toEqual({
      type: 'git',
      url: 'git+https://github.com/Pavithran-R-A/DiffBeacon.git',
    });
    expect(manifest.homepage).toBe('https://github.com/Pavithran-R-A/DiffBeacon#readme');
    expect(manifest.bugs.url).toBe('https://github.com/Pavithran-R-A/DiffBeacon/issues');
    expect(manifest.keywords).toEqual([
      'git',
      'github-actions',
      'pull-request',
      'code-review',
      'diff',
      'developer-tools',
    ]);
  });

  it('keeps the documented Git argument set equal to the shipped vector', () => {
    const gitSource = readFileSync('packages/cli/src/git.ts', 'utf8');
    const securityDoc = readFileSync('docs/architecture/security.md', 'utf8');
    const prescribed = prescribedGitVector(securityDoc);
    const diffVector = gitSource.slice(
      gitSource.indexOf('function gitArgs'),
      gitSource.indexOf('function gitSmall'),
    );
    const shippedFlags = [...diffVector.matchAll(/'(-{1,2}[a-z0-9=-][a-z0-9=/%.,-]*)'/gi)].map(
      (match) => match[1] as string,
    );
    expect(shippedFlags.length).toBeGreaterThan(8);
    for (const flag of shippedFlags) expect(prescribed).toContain(flag);
    expect(prescribed).toContain('--src-prefix=a/');
    expect(prescribed).toContain('--dst-prefix=b/');
    // Prose may explain why the newer flag was dropped; prescribed commands may not.
    expect(prescribed).not.toContain('--default-prefix');
  });

  it('normalizes hostile repository diff configuration to the same report', async () => {
    const repo = repository();
    const oldText = Array.from({ length: 20 }, (_, index) => `line ${index}\n`).join('');
    writeRepositoryFile(repo.cwd, 'old.ts', oldText);
    writeRepositoryFile(repo.cwd, 'dir b/image.bin', Buffer.from([0, 1, 2, 3, 4]));
    repo.commit('base');

    repo.git(['mv', '--', 'old.ts', 'new.ts']);
    writeRepositoryFile(repo.cwd, 'new.ts', oldText.replace('line 4', 'changed 4'));
    writeRepositoryFile(repo.cwd, 'dir b/image.bin', Buffer.from([0, 1, 2, 3, 255]));
    writeRepositoryFile(repo.cwd, 'unicode-文件.bin', Buffer.from([0, 5, 6, 7, 8]));
    repo.commit('head');

    const canonical = analyzeDiff(await collectGitDiffAsync('HEAD~1...HEAD', repo.cwd));
    const configs: Array<[string, string]> = [
      ['diff.noprefix', 'true'],
      ['diff.srcPrefix', 'OLD/'],
      ['diff.dstPrefix', 'NEW/'],
      ['diff.mnemonicPrefix', 'true'],
      ['diff.renames', 'false'],
      ['diff.renameLimit', '1'],
      ['diff.algorithm', 'histogram'],
    ];
    for (const [key, value] of configs) repo.git(['config', key, value]);
    const hostileDiff = await collectGitDiffAsync('HEAD~1...HEAD', repo.cwd);
    const hostile = analyzeDiff(hostileDiff);

    expect(hostileDiff).not.toContain('GIT binary patch');
    expect(hostileDiff).toContain('diff --git a/old.ts b/new.ts');
    expect(hostileDiff).not.toMatch(/^diff --git (?!"?(?:[ab])\/)/m);
    expect(hostile).toEqual(canonical);
    expect(hostile.files.map((file) => file.displayPath)).toEqual([
      'dir b/image.bin',
      'new.ts',
      'unicode-文件.bin',
    ]);
    expect(hostile.files.find((file) => file.displayPath === 'new.ts')).toMatchObject({
      status: 'renamed',
      oldPath: 'old.ts',
      newPath: 'new.ts',
    });
    expect(hostile.files.find((file) => file.displayPath === 'dir b/image.bin')).toMatchObject({
      status: 'modified',
      oldPath: 'dir b/image.bin',
      newPath: 'dir b/image.bin',
      binary: true,
    });
    expect(hostile.files.find((file) => file.displayPath === 'unicode-文件.bin')).toMatchObject({
      status: 'added',
      oldPath: null,
      newPath: 'unicode-文件.bin',
      binary: true,
    });
  });

  it('keeps binary path/status fields exact without --binary for all required states', async () => {
    const modified = repository();
    writeRepositoryFile(modified.cwd, 'literal b/image.bin', Buffer.from([0, 1, 2, 3]));
    modified.commit('base binary');
    writeRepositoryFile(modified.cwd, 'literal b/image.bin', Buffer.from([0, 1, 2, 255]));
    modified.commit('modify binary');
    const modifiedDiff = await collectGitDiffAsync('HEAD~1...HEAD', modified.cwd);
    const modifiedFile = analyzeDiff(modifiedDiff).files[0];
    expect(modifiedDiff).not.toContain('GIT binary patch');
    expect(modifiedFile).toMatchObject({
      oldPath: 'literal b/image.bin',
      newPath: 'literal b/image.bin',
      displayPath: 'literal b/image.bin',
      status: 'modified',
      binary: true,
    });

    const added = repository();
    added.git(['commit', '--allow-empty', '-qm', 'base']);
    writeRepositoryFile(added.cwd, 'added.bin', Buffer.from([0, 8, 9, 10, 11]));
    added.commit('add binary');
    const addedFile = analyzeDiff(await collectGitDiffAsync('HEAD~1...HEAD', added.cwd)).files[0];
    expect(addedFile).toMatchObject({
      oldPath: null,
      newPath: 'added.bin',
      displayPath: 'added.bin',
      status: 'added',
      binary: true,
    });

    const deleted = repository();
    writeRepositoryFile(deleted.cwd, 'deleted.bin', Buffer.from([0, 12, 13, 14, 15]));
    deleted.commit('base delete');
    rmSync(path.join(deleted.cwd, 'deleted.bin'));
    deleted.commit('delete binary');
    const deletedFile = analyzeDiff(await collectGitDiffAsync('HEAD~1...HEAD', deleted.cwd))
      .files[0];
    expect(deletedFile).toMatchObject({
      oldPath: 'deleted.bin',
      newPath: null,
      displayPath: 'deleted.bin',
      status: 'deleted',
      binary: true,
    });

    const renamed = repository();
    const binary = Buffer.alloc(4096, 0);
    writeRepositoryFile(renamed.cwd, 'old.bin', binary);
    renamed.commit('base rename');
    renamed.git(['mv', '--', 'old.bin', 'new.bin']);
    binary[128] = 255;
    writeRepositoryFile(renamed.cwd, 'new.bin', binary);
    renamed.commit('rename binary');
    const renamedDiff = await collectGitDiffAsync('HEAD~1...HEAD', renamed.cwd);
    const renamedFile = analyzeDiff(renamedDiff).files[0];
    expect(renamedDiff).not.toContain('GIT binary patch');
    expect(renamedFile).toMatchObject({
      oldPath: 'old.bin',
      newPath: 'new.bin',
      displayPath: 'new.bin',
      status: 'renamed',
      binary: true,
    });
  });

  it('analyzes a repository whose working directory contains spaces', async () => {
    const repo = repository('nested repo with spaces');
    writeRepositoryFile(repo.cwd, 'src.ts', 'export const value = 1;\n');
    repo.commit('base');
    writeRepositoryFile(repo.cwd, 'src.ts', 'export const value = 2;\n');
    repo.commit('head');
    const report = analyzeDiff(await collectGitDiffAsync('HEAD~1...HEAD', repo.cwd));
    expect(report.summary.changedFiles).toBe(1);
    expect(report.files[0]).toMatchObject({ displayPath: 'src.ts', status: 'modified' });
  });

  it('keeps a large incompressible binary change structural and bounded', async () => {
    const repo = repository();
    writeRepositoryFile(repo.cwd, 'large.bin', randomBytes(1_048_576));
    repo.commit('base large binary');
    writeRepositoryFile(repo.cwd, 'large.bin', randomBytes(1_048_576));
    repo.commit('modify large binary');

    const diff = await collectGitDiffAsync('HEAD~1...HEAD', repo.cwd);
    const report = analyzeDiff(diff);
    expect(Buffer.byteLength(diff, 'utf8')).toBeLessThan(64 * 1024);
    expect(diff).not.toContain('GIT binary patch');
    expect(report.files).toHaveLength(1);
    expect(report.files[0]).toMatchObject({
      displayPath: 'large.bin',
      status: 'modified',
      binary: true,
    });
  });

  it('keeps local submodule pointer changes visible and short under hostile config', async () => {
    const submodule = repository();
    writeRepositoryFile(submodule.cwd, 'README.md', 'submodule one\n');
    submodule.commit('submodule one');
    const firstCommit = submodule.git(['rev-parse', 'HEAD']);
    writeRepositoryFile(submodule.cwd, 'README.md', 'submodule two\n');
    submodule.commit('submodule two');
    const secondCommit = submodule.git(['rev-parse', 'HEAD']);

    const parent = repository();
    parent.git([
      '-c',
      'protocol.file.allow=always',
      '-c',
      `core.hooksPath=${parent.hooksPath}`,
      'submodule',
      'add',
      '-q',
      submodule.cwd,
      'modules/sub',
    ]);
    const inSubmodule = (args: string[]) =>
      gitIn(path.join(parent.cwd, 'modules/sub'), [
        '-c',
        `core.hooksPath=${parent.hooksPath}`,
        ...args,
      ]);
    inSubmodule(['checkout', '-q', firstCommit]);
    parent.commit('submodule one pointer');
    inSubmodule(['checkout', '-q', secondCommit]);
    parent.commit('submodule two pointer');

    const canonicalDiff = await collectGitDiffAsync('HEAD~1...HEAD', parent.cwd);
    const canonical = analyzeDiff(canonicalDiff);
    expect(canonical.files.map((file) => file.displayPath)).toEqual(['modules/sub']);
    expect(canonicalDiff).toContain('Subproject commit');
    expect(canonicalDiff).not.toMatch(/diff --git a\/modules\/sub\//);

    parent.git(['config', 'diff.submodule', 'diff']);
    parent.git(['config', 'diff.ignoreSubmodules', 'all']);
    const hostileDiff = await collectGitDiffAsync('HEAD~1...HEAD', parent.cwd);
    const hostile = analyzeDiff(hostileDiff);
    expect(hostile).toEqual(canonical);
    expect(hostile.files).toHaveLength(1);
    expect(hostile.files[0]).toMatchObject({
      displayPath: 'modules/sub',
      oldPath: 'modules/sub',
      newPath: 'modules/sub',
      status: 'modified',
    });
    expect(hostileDiff).toContain('Subproject commit');
    expect(hostileDiff).not.toMatch(/diff --git a\/modules\/sub\//);
  });
});
