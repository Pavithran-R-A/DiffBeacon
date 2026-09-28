/**
 * Stage 8 closure, Finding A (PHASES 1 and 4): the Action's reviewed repository has to be
 * `GITHUB_WORKSPACE`, but `packages/cli/src/git.ts` handed every Git process the inherited
 * `process.env`, so an ambient repository selector could take the Action away from the workspace
 * it was given. Stage 8's own `stage8.git-boundary` file proved that for `collectGitDiffAsync()`
 * called directly; this file proves it at the committed boundary, because a workspace contract is
 * an environment contract and cannot be shown in-process.
 *
 * Every case runs the shipped bundle in a child process with `GITHUB_WORKSPACE` naming a valid,
 * reviewable repository (A) and one ambient selector naming an unrelated one (B). The acceptance
 * is the same in each: the same valid invocation still reviews A. `stage8/probe-git-selectors.log`,
 * `stage8/probe-git-sequence.log` (Windows Git 2.55.0 and Linux Git 2.39.5) and
 * `stage8/probe-git-config-injection.log` recorded which variables Git really treats as repository
 * selectors, so each case below asserts one deterministic outcome instead of a guess.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  createFixtureRepository,
  gitIn,
  removeFixtureRepository,
  writeRepositoryFile,
  type FixtureRepository,
} from './git-repository-fixture.js';

vi.setConfig({ testTimeout: 90_000, hookTimeout: 90_000 });

const repository = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const bundle = path.join(repository, 'packages/action/dist/index.js');
const temporary: string[] = [];

/** The only two file names that decide which repository the Action actually read. */
const WORKSPACE_FILE = 'workspace-change.ts';
const FOREIGN_FILE = 'foreign-change.ts';

/**
 * The variables this suite exercises. They are stripped from the inherited host environment so a
 * case sets exactly one of them, the way a runner would, rather than inheriting a developer's Git
 * setup. Nothing else is removed: `PATH`, locale and ordinary runtime variables are passed through.
 */
const SELECTORS = [
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_COMMON_DIR',
  'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_INDEX_FILE',
  'GIT_NAMESPACE',
  'GIT_CONFIG_COUNT',
  'GIT_CONFIG_KEY_0',
  'GIT_CONFIG_VALUE_0',
  'GIT_CONFIG_GLOBAL',
  'GIT_CONFIG_PARAMETERS',
];

beforeAll(() => {
  const built = spawnSync(process.execPath, ['scripts/build-action.mjs'], {
    cwd: repository,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  });
  expect(built.status, built.stderr).toBe(0);
});

afterEach(() => {
  for (const root of temporary.splice(0)) removeFixtureRepository(root);
});

afterAll(() => {
  // The shared pair is deliberately outside the per-case list: `afterEach` must not delete the
  // repositories the whole file compares against.
  removeFixtureRepository(workspace.repo.root);
  removeFixtureRepository(foreign.repo.root);
});

function scratch(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'diffbeacon-stage8c-iso-'));
  temporary.push(dir);
  return dir;
}

interface Reviewable {
  repo: FixtureRepository;
  base: string;
  head: string;
}

/**
 * A two-commit repository whose head commit changes exactly `fileName`. The caller decides whether
 * the fixture is cleaned per case (`temporary.push`) or for the whole file (`afterAll`).
 */
function reviewable(name: string, fileName: string, nestedPath?: string): Reviewable {
  const repo = createFixtureRepository({
    prefix: `diffbeacon-stage8c-${name}-`,
    identity: name,
    ...(nestedPath === undefined ? {} : { nestedPath }),
  });
  writeRepositoryFile(repo.cwd, fileName, 'export const v = 1;\n');
  repo.commit('base');
  const base = gitIn(repo.cwd, ['rev-parse', 'HEAD']);
  writeRepositoryFile(repo.cwd, fileName, 'export const v = 2;\n');
  repo.commit('head');
  return { repo, base, head: gitIn(repo.cwd, ['rev-parse', 'HEAD']) };
}

interface Run {
  status: number | null;
  stdout: string;
  stderr: string;
  summary: string | null;
}

/**
 * Run the Action the way a runner does: `GITHUB_WORKSPACE` names `workspace`, the event carries
 * `base`/`head` as full object IDs, and `git` holds the ambient selector variables for this case.
 */
function runAction(options: {
  workspace: string;
  base: string;
  head: string;
  git?: Record<string, string>;
}): Run {
  const dir = scratch();
  const eventPath = path.join(dir, 'event.json');
  writeFileSync(
    eventPath,
    JSON.stringify({ pull_request: { base: { sha: options.base }, head: { sha: options.head } } }),
  );
  const summaryPath = path.join(dir, 'step-summary.md');
  const inherited = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => !key.startsWith('GITHUB_') && !SELECTORS.includes(key),
    ),
  );
  const result = spawnSync(process.execPath, [bundle], {
    cwd: dir,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
    env: {
      ...inherited,
      ...(options.git ?? {}),
      GITHUB_EVENT_NAME: 'pull_request',
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_WORKSPACE: options.workspace,
      GITHUB_STEP_SUMMARY: summaryPath,
    },
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    summary: existsSync(summaryPath)
      ? readFileSync(summaryPath, { encoding: 'utf8', flag: 'r' })
      : null,
  };
}

/** The one acceptance every redirected case has to meet: the workspace was reviewed, normally. */
function expectReviewsWorkspace(run: Run, fileName = WORKSPACE_FILE): void {
  expect(run.stderr).toBe('');
  expect(run.status, run.stderr).toBe(0);
  const summary = run.summary ?? '';
  expect(summary).toContain(fileName);
  expect(summary).not.toContain(FOREIGN_FILE);
}

let workspace!: Reviewable;
let foreign!: Reviewable;

beforeAll(() => {
  workspace = reviewable('workspace', WORKSPACE_FILE);
  foreign = reviewable('foreign', FOREIGN_FILE);
});

/** An ambient value naming the foreign repository's own `.git` directory. */
const foreignGitDir = () => path.join(foreign.repo.cwd, '.git');

describe('an ambient Git repository selector cannot take the Action off GITHUB_WORKSPACE', () => {
  it('reviews the workspace when the environment names nothing else', () => {
    // The control: the same fixture, the same event, no selector. Every redirected case below is
    // compared against this outcome.
    expectReviewsWorkspace(
      runAction({
        workspace: workspace.repo.cwd,
        base: workspace.base,
        head: workspace.head,
      }),
    );
  });

  it('reviews the workspace when an ambient GIT_DIR names another repository', () => {
    expectReviewsWorkspace(
      runAction({
        workspace: workspace.repo.cwd,
        base: workspace.base,
        head: workspace.head,
        git: { GIT_DIR: foreignGitDir() },
      }),
    );
  });

  it('reviews the workspace when an ambient GIT_WORK_TREE names another repository', () => {
    expectReviewsWorkspace(
      runAction({
        workspace: workspace.repo.cwd,
        base: workspace.base,
        head: workspace.head,
        git: { GIT_WORK_TREE: foreign.repo.cwd },
      }),
    );
  });

  it('reviews the workspace when an ambient GIT_COMMON_DIR names another repository', () => {
    expectReviewsWorkspace(
      runAction({
        workspace: workspace.repo.cwd,
        base: workspace.base,
        head: workspace.head,
        git: { GIT_COMMON_DIR: foreignGitDir() },
      }),
    );
  });

  it('reviews the workspace when an ambient GIT_OBJECT_DIRECTORY names another repository', () => {
    expectReviewsWorkspace(
      runAction({
        workspace: workspace.repo.cwd,
        base: workspace.base,
        head: workspace.head,
        git: { GIT_OBJECT_DIRECTORY: path.join(foreignGitDir(), 'objects') },
      }),
    );
  });
});

describe('another repository objects cannot be read through the workspace', () => {
  it('refuses a foreign range instead of reviewing it through an ambient alternate object store', () => {
    // Measured (probe round 2, both platforms): an alternate store makes a foreign repository's
    // content reachable from the workspace, so the review of a range the workspace does not hold
    // completes with the foreign report. Under the workspace contract it has to fail closed.
    const run = runAction({
      workspace: workspace.repo.cwd,
      base: foreign.base,
      head: foreign.head,
      git: { GIT_ALTERNATE_OBJECT_DIRECTORIES: path.join(foreignGitDir(), 'objects') },
    });
    expect(run.summary).toBeNull();
    expect(run.status).not.toBe(0);
    expect(run.stderr).toMatch(/cannot resolve revision/);
    expect(run.stderr).not.toContain(FOREIGN_FILE);
  });

  it('still reviews the workspace when an alternate object store is present', () => {
    expectReviewsWorkspace(
      runAction({
        workspace: workspace.repo.cwd,
        base: workspace.base,
        head: workspace.head,
        git: { GIT_ALTERNATE_OBJECT_DIRECTORIES: path.join(foreignGitDir(), 'objects') },
      }),
    );
  });
});

describe('core.worktree cannot move the Action off the workspace', () => {
  it('reviews the workspace when its own repository configuration points core.worktree elsewhere', () => {
    // Measured (probe round 2, both platforms): `rev-parse --show-toplevel` reports the directory
    // named by core.worktree, so the repository root DiffBeacon spawns at is no longer the
    // workspace. This is the configuration channel an environment denylist alone cannot close.
    const configured = reviewable('local-config', 'config-change.ts');
    const target = reviewable('local-target', FOREIGN_FILE);
    temporary.push(configured.repo.root, target.repo.root);
    gitIn(configured.repo.cwd, ['config', 'core.worktree', target.repo.cwd]);
    expectReviewsWorkspace(
      runAction({
        workspace: configured.repo.cwd,
        base: configured.base,
        head: configured.head,
      }),
      'config-change.ts',
    );
  });

  it('reviews the workspace when an ambient GIT_CONFIG_COUNT injects core.worktree', () => {
    expectReviewsWorkspace(
      runAction({
        workspace: workspace.repo.cwd,
        base: workspace.base,
        head: workspace.head,
        git: {
          GIT_CONFIG_COUNT: '1',
          GIT_CONFIG_KEY_0: 'core.worktree',
          GIT_CONFIG_VALUE_0: foreign.repo.cwd,
        },
      }),
    );
  });

  it('reviews the workspace when an ambient global configuration file sets core.worktree', () => {
    const file = path.join(scratch(), 'injected-gitconfig');
    writeFileSync(file, `[core]\n\tworktree = ${foreign.repo.cwd.replaceAll('\\', '/')}\n`);
    expectReviewsWorkspace(
      runAction({
        workspace: workspace.repo.cwd,
        base: workspace.base,
        head: workspace.head,
        git: { GIT_CONFIG_GLOBAL: file },
      }),
    );
  });
});

describe('selectors that cannot redirect a full-object-ID review stay available to Git', () => {
  it('leaves GIT_NAMESPACE alone because the event can only name object IDs', () => {
    // Measured (probe round 2, both platforms): a namespace prefixes ref lookups, and Stage 6
    // requires base/head to be full object IDs, so no reviewed fact depends on it. It is therefore
    // not in the denylist, and this case records that the Action does not remove it.
    expectReviewsWorkspace(
      runAction({
        workspace: workspace.repo.cwd,
        base: workspace.base,
        head: workspace.head,
        git: { GIT_NAMESPACE: 'foreign' },
      }),
    );
  });

  it('leaves an ambient GIT_INDEX_FILE alone because a commit-to-commit diff reads no index', () => {
    // Measured (probe round 2, both platforms): the range diff never consults the index, so an
    // ambient index file cannot change what the Action reviews.
    expectReviewsWorkspace(
      runAction({
        workspace: workspace.repo.cwd,
        base: workspace.base,
        head: workspace.head,
        git: { GIT_INDEX_FILE: path.join(foreignGitDir(), 'index') },
      }),
    );
  });
});

describe('the workspace contract survives the workspace layouts runners really produce', () => {
  it('reviews a workspace whose path contains spaces while GIT_DIR names another repository', () => {
    const spaced = reviewable('spaces', WORKSPACE_FILE, 'reviewed repo with spaces');
    temporary.push(spaced.repo.root);
    expectReviewsWorkspace(
      runAction({
        workspace: spaced.repo.cwd,
        base: spaced.base,
        head: spaced.head,
        git: { GIT_DIR: foreignGitDir() },
      }),
    );
  });

  it('reviews a workspace whose path contains non-ASCII characters while GIT_DIR names another repository', () => {
    const unicode = reviewable('unicode', WORKSPACE_FILE, '评审 unicodé');
    temporary.push(unicode.repo.root);
    expectReviewsWorkspace(
      runAction({
        workspace: unicode.repo.cwd,
        base: unicode.base,
        head: unicode.head,
        git: { GIT_DIR: foreignGitDir() },
      }),
    );
  });

  it('reviews a workspace that is a linked Git worktree, whose .git is a file', () => {
    // `git worktree add` writes a `.git` *file* pointing at the real repository, so any Git
    // environment the Action sets has to leave repository discovery working. Guard for the repair:
    // this passes before it and must keep passing after.
    const source = reviewable('worktree-source', WORKSPACE_FILE);
    temporary.push(source.repo.root);
    const linked = path.join(scratch(), 'linked-worktree');
    gitIn(source.repo.cwd, ['worktree', 'add', '-q', '--detach', linked, source.head]);
    expect(readFileSync(path.join(linked, '.git'), 'utf8')).toMatch(/^gitdir:/);
    expectReviewsWorkspace(runAction({ workspace: linked, base: source.base, head: source.head }));
  });

  it('still runs nothing from the reviewed repository once its environment is rebuilt', () => {
    // Control 6: the pinned workspace and the filtered selectors must not weaken the pinned diff
    // controls. `diff.external` here would create the sentinel if Git were allowed to use it;
    // `stage6.action-security-boundary.test.ts` holds the live control that this same fixture form
    // really does execute the program, so an inert sentinel here is not a silent pass.
    const hostile = reviewable('external', WORKSPACE_FILE);
    temporary.push(hostile.repo.root);
    const sentinel = path.join(hostile.repo.cwd, 'SENTINEL-external-diff');
    gitIn(hostile.repo.cwd, [
      'config',
      'diff.external',
      `touch "${sentinel.replaceAll('\\', '/')}"`,
    ]);
    expectReviewsWorkspace(
      runAction({
        workspace: hostile.repo.cwd,
        base: hostile.base,
        head: hostile.head,
        git: { GIT_DIR: foreignGitDir() },
      }),
    );
    expect(existsSync(sentinel)).toBe(false);
  });

  it('refuses a workspace that is not a repository even when GIT_DIR names one that is', () => {
    // Fail-closed half of the contract: removing the selectors must not turn a plain directory into
    // a reviewable repository by falling back to an ambient Git directory.
    const plain = path.join(scratch(), 'plain-directory');
    mkdirSync(plain, { recursive: true });
    const run = runAction({
      workspace: plain,
      base: workspace.base,
      head: workspace.head,
      git: { GIT_DIR: foreignGitDir() },
    });
    expect(run.summary).toBeNull();
    expect(run.status).not.toBe(0);
    expect(run.stderr).toMatch(/not a Git repository/);
  });
});
