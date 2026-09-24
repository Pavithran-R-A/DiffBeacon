import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { analyzeDiff } from '../packages/core/src/index.js';
import { collectGitDiffAsync } from '../packages/cli/src/index.js';

const repositories: string[] = [];

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    windowsHide: true,
  });
}

function repository(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'diffbeacon-stage5-git-'));
  repositories.push(cwd);
  git(cwd, ['init', '-q']);
  git(cwd, ['config', 'user.email', 'diffbeacon-stage5@example.invalid']);
  git(cwd, ['config', 'user.name', 'DiffBeacon Stage 5']);
  return cwd;
}

function commit(cwd: string, message: string): void {
  git(cwd, ['add', '--all']);
  git(cwd, ['commit', '-qm', message]);
}

afterEach(() => {
  for (const cwd of repositories.splice(0)) rmSync(cwd, { recursive: true, force: true });
});

describe('Git diff determinism boundary', () => {
  it('owns structural flags and omits full binary patch generation', () => {
    const source = readFileSync('packages/cli/src/git.ts', 'utf8');
    expect(source).toContain("'--default-prefix'");
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

  it('uses the intended release repository without enabling publication', () => {
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
    expect(rootReadme).toContain('uses: Pavithran-R-A/diffbeacon@v1');
    expect(actionReadme).toContain('uses: Pavithran-R-A/diffbeacon@v1');
    expect(manifest.repository).toEqual({
      type: 'git',
      url: 'git+https://github.com/Pavithran-R-A/diffbeacon.git',
    });
    expect(manifest.homepage).toBe('https://github.com/Pavithran-R-A/diffbeacon#readme');
    expect(manifest.bugs.url).toBe('https://github.com/Pavithran-R-A/diffbeacon/issues');
    expect(manifest.keywords).toEqual([
      'git',
      'github-actions',
      'pull-request',
      'code-review',
      'diff',
      'developer-tools',
    ]);
  });

  it('normalizes hostile repository diff configuration to the same report', async () => {
    const cwd = repository();
    const oldText = Array.from({ length: 20 }, (_, index) => `line ${index}\n`).join('');
    writeFileSync(path.join(cwd, 'old.ts'), oldText);
    mkdirSync(path.join(cwd, 'dir b'), { recursive: true });
    writeFileSync(path.join(cwd, 'dir b', 'image.bin'), Buffer.from([0, 1, 2, 3, 4]));
    commit(cwd, 'base');

    git(cwd, ['mv', '--', 'old.ts', 'new.ts']);
    writeFileSync(path.join(cwd, 'new.ts'), oldText.replace('line 4', 'changed 4'));
    writeFileSync(path.join(cwd, 'dir b', 'image.bin'), Buffer.from([0, 1, 2, 3, 255]));
    writeFileSync(path.join(cwd, 'unicode-文件.bin'), Buffer.from([0, 5, 6, 7, 8]));
    commit(cwd, 'head');

    const canonical = analyzeDiff(await collectGitDiffAsync('HEAD~1...HEAD', cwd));
    const configs: Array<[string, string]> = [
      ['diff.noprefix', 'true'],
      ['diff.srcPrefix', 'OLD/'],
      ['diff.dstPrefix', 'NEW/'],
      ['diff.mnemonicPrefix', 'true'],
      ['diff.renames', 'false'],
      ['diff.renameLimit', '1'],
      ['diff.algorithm', 'histogram'],
    ];
    for (const [key, value] of configs) git(cwd, ['config', key, value]);
    const hostileDiff = await collectGitDiffAsync('HEAD~1...HEAD', cwd);
    const hostile = analyzeDiff(hostileDiff);

    expect(hostileDiff).not.toContain('GIT binary patch');
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
    mkdirSync(path.join(modified, 'literal b'), { recursive: true });
    writeFileSync(path.join(modified, 'literal b', 'image.bin'), Buffer.from([0, 1, 2, 3]));
    commit(modified, 'base binary');
    writeFileSync(path.join(modified, 'literal b', 'image.bin'), Buffer.from([0, 1, 2, 255]));
    commit(modified, 'modify binary');
    const modifiedDiff = await collectGitDiffAsync('HEAD~1...HEAD', modified);
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
    git(added, ['commit', '--allow-empty', '-qm', 'base']);
    writeFileSync(path.join(added, 'added.bin'), Buffer.from([0, 8, 9, 10, 11]));
    commit(added, 'add binary');
    const addedFile = analyzeDiff(await collectGitDiffAsync('HEAD~1...HEAD', added)).files[0];
    expect(addedFile).toMatchObject({
      oldPath: null,
      newPath: 'added.bin',
      displayPath: 'added.bin',
      status: 'added',
      binary: true,
    });

    const deleted = repository();
    writeFileSync(path.join(deleted, 'deleted.bin'), Buffer.from([0, 12, 13, 14, 15]));
    commit(deleted, 'base delete');
    rmSync(path.join(deleted, 'deleted.bin'));
    commit(deleted, 'delete binary');
    const deletedFile = analyzeDiff(await collectGitDiffAsync('HEAD~1...HEAD', deleted)).files[0];
    expect(deletedFile).toMatchObject({
      oldPath: 'deleted.bin',
      newPath: null,
      displayPath: 'deleted.bin',
      status: 'deleted',
      binary: true,
    });

    const renamed = repository();
    const binary = Buffer.alloc(4096, 0);
    writeFileSync(path.join(renamed, 'old.bin'), binary);
    commit(renamed, 'base rename');
    git(renamed, ['mv', '--', 'old.bin', 'new.bin']);
    binary[128] = 255;
    writeFileSync(path.join(renamed, 'new.bin'), binary);
    commit(renamed, 'rename binary');
    const renamedDiff = await collectGitDiffAsync('HEAD~1...HEAD', renamed);
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

  it('keeps a large incompressible binary change structural and bounded', async () => {
    const cwd = repository();
    const before = randomBytes(1_048_576);
    const after = randomBytes(1_048_576);
    writeFileSync(path.join(cwd, 'large.bin'), before);
    commit(cwd, 'base large binary');
    writeFileSync(path.join(cwd, 'large.bin'), after);
    commit(cwd, 'modify large binary');

    const diff = await collectGitDiffAsync('HEAD~1...HEAD', cwd);
    const report = analyzeDiff(diff);
    expect(Buffer.byteLength(diff, 'utf8')).toBeLessThan(64 * 1024);
    expect(diff).not.toContain('GIT binary patch');
    expect(report.files).toHaveLength(1);
    expect(report.files[0]).toMatchObject({
      displayPath: 'large.bin',
      status: 'modified',
      binary: true,
    });
  }, 30_000);

  it('keeps local submodule pointer changes visible and short under hostile config', async () => {
    const submodule = repository();
    writeFileSync(path.join(submodule, 'README.md'), 'submodule one\n');
    commit(submodule, 'submodule one');
    const firstCommit = git(submodule, ['rev-parse', 'HEAD']).trim();
    writeFileSync(path.join(submodule, 'README.md'), 'submodule two\n');
    commit(submodule, 'submodule two');
    const secondCommit = git(submodule, ['rev-parse', 'HEAD']).trim();

    const parent = repository();
    git(parent, [
      '-c',
      'protocol.file.allow=always',
      'submodule',
      'add',
      '-q',
      submodule,
      'modules/sub',
    ]);
    git(path.join(parent, 'modules/sub'), ['checkout', '-q', firstCommit]);
    commit(parent, 'submodule one pointer');
    git(path.join(parent, 'modules/sub'), ['checkout', '-q', secondCommit]);
    commit(parent, 'submodule two pointer');

    const canonicalDiff = await collectGitDiffAsync('HEAD~1...HEAD', parent);
    const canonical = analyzeDiff(canonicalDiff);
    expect(canonical.files.map((file) => file.displayPath)).toEqual(['modules/sub']);
    expect(canonicalDiff).toContain('Subproject commit');
    expect(canonicalDiff).not.toMatch(/diff --git a\/modules\/sub\//);

    git(parent, ['config', 'diff.submodule', 'diff']);
    git(parent, ['config', 'diff.ignoreSubmodules', 'all']);
    const hostileDiff = await collectGitDiffAsync('HEAD~1...HEAD', parent);
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
