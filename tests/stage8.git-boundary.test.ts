/**
 * Stage 8, PHASES 10-12: the Git process boundary. DiffBeacon hands Git an argument vector and
 * inherits the operator's environment, so two different questions have to be answered separately:
 * which repository does an ambient `GIT_*` variable make Git read, and can anything in the
 * environment or in the reviewed repository make Git run a program. Every "no program ran" case
 * is paired with a live control on the same fixture, and the evidence for the dispositions here
 * is `stage8/probe-git-env.log` and `stage8/probe-pager-control.log` measured on this host.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { analyzeDiff } from '../packages/core/src/index.js';
import { collectGitDiffAsync } from '../packages/cli/src/git.js';
import {
  createFixtureRepository,
  gitIn,
  removeFixtureRepository,
  writeRepositoryFile,
  type FixtureRepository,
} from './git-repository-fixture.js';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

interface TwoCommits {
  repo: FixtureRepository;
  base: string;
  head: string;
  range: string;
}

function build(marker: string, identity: string): TwoCommits {
  const repo = createFixtureRepository({ prefix: `diffbeacon-stage8-git-${identity}-`, identity });
  writeRepositoryFile(repo.cwd, `src/${marker}-one.ts`, 'export const v = 1;\n');
  repo.commit('base');
  const base = gitIn(repo.cwd, ['rev-parse', 'HEAD']);
  writeRepositoryFile(repo.cwd, `src/${marker}-one.ts`, 'export const v = 2;\n');
  writeRepositoryFile(repo.cwd, `src/${marker}-two.ts`, 'export const w = 1;\n');
  repo.commit('head');
  return { repo, base, head: gitIn(repo.cwd, ['rev-parse', 'HEAD']), range: '' };
}

let reviewed!: TwoCommits;
let foreign!: TwoCommits;
let scratch!: string;

beforeAll(() => {
  reviewed = finalize(build('alpha', 'reviewed'));
  foreign = finalize(build('beta', 'foreign'));
  scratch = mkdtempSync(path.join(tmpdir(), 'diffbeacon-stage8-gitenv-'));
});

function finalize(commit: TwoCommits): TwoCommits {
  return { ...commit, range: `${commit.base}...${commit.head}` };
}

afterAll(() => {
  removeFixtureRepository(reviewed.repo.root);
  removeFixtureRepository(foreign.repo.root);
  rmSync(scratch, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

/** Set environment variables for one call, then restore exactly what was there before. */
async function withEnv<T>(overrides: Record<string, string | undefined>, work: () => Promise<T>) {
  const names = Object.keys(overrides);
  const before = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  for (const [name, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  try {
    return await work();
  } finally {
    for (const name of names) {
      if (before[name] === undefined) delete process.env[name];
      else process.env[name] = before[name];
    }
  }
}

/** A program that leaves a file behind if Git ever runs it. */
function sentinelProgram(name: string): { program: string; marker: string } {
  const marker = path.join(scratch, `SENTINEL-${name}`);
  return {
    program: `touch "${marker.replaceAll('\\', '/')}"`,
    marker,
  };
}

function rawGitDiff(cwd: string, range: string, env: Record<string, string>): void {
  try {
    execFileSync('git', ['diff', range], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      windowsHide: true,
      env: { ...process.env, ...env },
    });
  } catch {
    // The control is the sentinel the program leaves behind, not Git's exit code: an external
    // diff that fails on a later file still proves the program was started.
  }
}

describe('the operator environment still chooses the repository, as Git does', () => {
  it('reads the workspace it is pointed at when the environment names nothing else', async () => {
    const diff = await collectGitDiffAsync(reviewed.range, reviewed.repo.cwd);
    expect(diff).toContain('src/alpha-one.ts');
    expect(diff).not.toContain('src/beta-one.ts');
  });

  it('follows an ambient GIT_DIR instead of the working directory it is given', async () => {
    // Measured (probe A3): this is Git's own documented behaviour, and DiffBeacon deliberately
    // does not rewrite the operator's environment. PHASE 11 records the consequence for the
    // Action: the runner's environment, not a pull request, is what could set this.
    const diff = await withEnv({ GIT_DIR: path.join(foreign.repo.cwd, '.git') }, () =>
      collectGitDiffAsync(foreign.range, reviewed.repo.cwd),
    );
    expect(diff).toContain('src/beta-one.ts');
    expect(diff).not.toContain('src/alpha-one.ts');
  });

  it('fails with a bounded message when an ambient GIT_DIR hides the requested revision', async () => {
    await expect(
      withEnv({ GIT_DIR: path.join(foreign.repo.cwd, '.git') }, () =>
        collectGitDiffAsync(reviewed.range, reviewed.repo.cwd),
      ),
    ).rejects.toThrow(/cannot resolve revision/);
  });

  it('can reach another repository through GIT_ALTERNATE_OBJECT_DIRECTORIES', async () => {
    // Measured (probe A5): objects are read through the operator's alternate store, so a range
    // is only as trustworthy as the environment that resolves it.
    const diff = await withEnv(
      { GIT_ALTERNATE_OBJECT_DIRECTORIES: path.join(foreign.repo.cwd, '.git', 'objects') },
      () => collectGitDiffAsync(foreign.range, reviewed.repo.cwd),
    );
    expect(diff).toContain('src/beta-one.ts');
  });
});

describe('nothing the environment or the repository names is executed', () => {
  it('ignores an ambient GIT_EXTERNAL_DIFF, and the same fixture does run it without the pin', async () => {
    const external = sentinelProgram('ambient-external');
    const diff = await withEnv({ GIT_EXTERNAL_DIFF: external.program }, () =>
      collectGitDiffAsync(reviewed.range, reviewed.repo.cwd),
    );
    expect(diff).toContain('src/alpha-one.ts');
    expect(existsSync(external.marker)).toBe(false);

    rawGitDiff(reviewed.repo.cwd, reviewed.range, { GIT_EXTERNAL_DIFF: external.program });
    expect(existsSync(external.marker)).toBe(true);
    rmSync(external.marker, { force: true });
  });

  it('ignores diff.external injected through GIT_CONFIG_COUNT, and the same fixture runs it', async () => {
    const external = sentinelProgram('config-count-external');
    await withEnv(
      {
        GIT_CONFIG_COUNT: '1',
        GIT_CONFIG_KEY_0: 'diff.external',
        GIT_CONFIG_VALUE_0: external.program,
      },
      async () => {
        const diff = await collectGitDiffAsync(reviewed.range, reviewed.repo.cwd);
        expect(diff).toContain('src/alpha-one.ts');
        expect(existsSync(external.marker)).toBe(false);
        rawGitDiff(reviewed.repo.cwd, reviewed.range, {});
      },
    );
    expect(existsSync(external.marker)).toBe(true);
    rmSync(external.marker, { force: true });
  });

  it('ignores diff.external written inside the reviewed repository, and the same fixture runs it', async () => {
    const external = sentinelProgram('repository-external');
    gitIn(reviewed.repo.cwd, ['config', 'diff.external', external.program]);
    const diff = await collectGitDiffAsync(reviewed.range, reviewed.repo.cwd);
    expect(diff).toContain('src/alpha-one.ts');
    expect(existsSync(external.marker)).toBe(false);

    rawGitDiff(reviewed.repo.cwd, reviewed.range, {});
    expect(existsSync(external.marker)).toBe(true);
    rmSync(external.marker, { force: true });
    gitIn(reviewed.repo.cwd, ['config', '--unset-all', 'diff.external']);
  });

  it('reads a repository whose configuration breaks the command as a failure, not a crash', async () => {
    await expect(
      withEnv({ GIT_CONFIG_PARAMETERS: `'diff.noprefix' true` }, () =>
        collectGitDiffAsync(reviewed.range, reviewed.repo.cwd),
      ),
    ).rejects.toThrow(/No diff available/);
  });
});

describe('the pinned diff controls win over configuration', () => {
  function configured(key: string, value: string) {
    gitIn(reviewed.repo.cwd, ['config', key, value]);
  }

  it('keeps a/ and b/ when the repository turns diff.noprefix on', async () => {
    configured('diff.noprefix', 'true');
    const diff = await collectGitDiffAsync(reviewed.range, reviewed.repo.cwd);
    expect(diff).toContain('diff --git a/src/alpha-one.ts b/src/alpha-one.ts');
    expect(diff).toContain('--- a/src/alpha-one.ts');
    expect(diff).not.toMatch(/^diff --git src\//m);
    gitIn(reviewed.repo.cwd, ['config', '--unset-all', 'diff.noprefix']);
  });

  it('keeps a/ and b/ when the repository renames the source prefix', async () => {
    configured('diff.srcPrefix', 'zz/');
    configured('diff.mnemonicPrefix', 'true');
    const diff = await collectGitDiffAsync(reviewed.range, reviewed.repo.cwd);
    expect(diff).toContain('diff --git a/src/alpha-one.ts b/src/alpha-one.ts');
    expect(diff).not.toContain('zz/src/alpha-one.ts');
    gitIn(reviewed.repo.cwd, ['config', '--unset-all', 'diff.srcPrefix']);
    gitIn(reviewed.repo.cwd, ['config', '--unset-all', 'diff.mnemonicPrefix']);
  });

  it('pins Unicode path quoting even when repository configuration disables it', async () => {
    const unicodePath = 'src/anom-ünïcode-日本.ts';
    writeRepositoryFile(reviewed.repo.cwd, unicodePath, 'export const u = 1;\n');
    reviewed.repo.commit('unicode');
    const head = gitIn(reviewed.repo.cwd, ['rev-parse', 'HEAD']);
    const range = `${reviewed.head}...${head}`;

    const quoted = await collectGitDiffAsync(range, reviewed.repo.cwd);
    expect(quoted).toMatch(/^diff --git "a\/src\/anom-/m);
    expect(analyzeDiff(quoted).files.map((file) => file.displayPath)).toContain(unicodePath);

    gitIn(reviewed.repo.cwd, ['config', 'core.quotepath', 'false']);
    try {
      const stillQuoted = await collectGitDiffAsync(range, reviewed.repo.cwd);
      expect(stillQuoted).toMatch(/^diff --git "a\/src\/anom-/m);
      expect(stillQuoted).not.toContain(`diff --git a/${unicodePath} b/${unicodePath}`);
      expect(analyzeDiff(stillQuoted).files.map((file) => file.displayPath)).toContain(unicodePath);
    } finally {
      gitIn(reviewed.repo.cwd, ['config', '--unset-all', 'core.quotepath']);
    }
  });
});

describe('the Git boundary is argument vectors only', () => {
  const source = () =>
    readFileSync(path.join(repository, 'packages', 'cli', 'src', 'git.ts'), 'utf8');

  it('builds argv arrays with shell disabled and never a command string', () => {
    const text = source();
    expect(text).not.toMatch(/\bexecSync\s*\(/);
    expect(text).not.toMatch(/(^|[^A-Za-z])exec\s*\(/);
    expect(text).not.toMatch(/shell:\s*true/);
    expect(text.match(/shell: false/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('names the controls that make the reviewed repository stay data', () => {
    const text = source();
    for (const flag of [
      '--end-of-options',
      '--no-ext-diff',
      '--no-textconv',
      '--src-prefix=a/',
      '--dst-prefix=b/',
      '--ignore-submodules=none',
      '--submodule=short',
      '--diff-algorithm=myers',
      '--find-renames=50%',
      '-l1000',
      '--unified=3',
    ])
      expect(text, `missing ${flag}`).toContain(flag);
  });
});
