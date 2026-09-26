import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  createFixtureRepository,
  gitIn,
  removeFixtureRepository,
  writeRepositoryFile,
} from './git-repository-fixture.js';

// Stage 6, PHASES 5-8 and 19-20: the Action must inspect the workspace GitHub names, write
// its report through the Job Summary file the runner provides, and select the pull-request
// range from the event rather than from whatever happens to be checked out. Every case runs
// the real shipped bundle in a child process, because environment binding cannot be proved
// by calling the function in-process. The generous timeout is for real `git clone`, `merge`
// and `commit` calls measured at a few hundred milliseconds each on the Windows cell.

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const repository = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const bundle = path.join(repository, 'packages/action/dist/index.js');
const temporary: string[] = [];

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

/** A fresh parent directory that exists, so a child path under it is free to be created. */
function scratch(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'diffbeacon-stage6-run-'));
  temporary.push(dir);
  return dir;
}

/** A directory that exists and is deliberately not a repository. */
function plainDirectory(name: string): string {
  const dir = path.join(scratch(), name);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function eventFor(base: string, head: string): unknown {
  return { pull_request: { base: { sha: base }, head: { sha: head } } };
}

interface RunOptions {
  cwd?: string;
  eventName?: string | undefined;
  event?: unknown;
  eventRaw?: string;
  eventPath?: string;
  workspace?: string | null | undefined;
  summary?: string | null | undefined;
  seedSummary?: string;
}

/** Run the bundle with only the GITHUB_* variables a case actually specifies. */
function runAction(options: RunOptions) {
  const dir = scratch();
  const hostEnv = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('GITHUB_')),
  );
  const eventPath = options.eventPath ?? path.join(dir, 'event.json');
  if (options.eventRaw !== undefined) writeFileSync(eventPath, options.eventRaw);
  else if (options.event !== undefined) writeFileSync(eventPath, JSON.stringify(options.event));
  const summaryPath = options.summary ?? path.join(dir, 'step-summary.md');
  if (options.seedSummary !== undefined) writeFileSync(summaryPath, options.seedSummary);
  const env: NodeJS.ProcessEnv = {
    ...hostEnv,
    ...(options.eventName === undefined ? {} : { GITHUB_EVENT_NAME: options.eventName }),
    ...(options.event === undefined && options.eventRaw === undefined && !options.eventPath
      ? {}
      : { GITHUB_EVENT_PATH: eventPath }),
    ...(options.workspace === undefined || options.workspace === null
      ? {}
      : { GITHUB_WORKSPACE: options.workspace }),
    ...(options.summary === null ? {} : { GITHUB_STEP_SUMMARY: summaryPath }),
  };
  const result = spawnSync(process.execPath, [bundle], {
    cwd: options.cwd ?? dir,
    env,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    summary: existsSync(summaryPath) ? readSummary(summaryPath) : null,
  };
}

function readSummary(file: string): string | null {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

/** Two commits on one branch: enough for the range and history cases. */
function linearRepository(prefix: string, fileName = 'a.ts') {
  const repo = createFixtureRepository({
    prefix: `diffbeacon-stage6-${prefix}-`,
    identity: prefix,
  });
  temporary.push(repo.root);
  writeRepositoryFile(repo.cwd, fileName, 'export const a = 1;\n');
  repo.commit('base');
  const base = gitIn(repo.cwd, ['rev-parse', 'HEAD']);
  writeRepositoryFile(repo.cwd, fileName, 'export const a = 2;\n');
  repo.commit('head');
  const head = gitIn(repo.cwd, ['rev-parse', 'HEAD']);
  return { repo, base, head };
}

describe('the Action workspace boundary', () => {
  it('reviews GITHUB_WORKSPACE even when the process working directory is another repository', () => {
    const { repo: target, base, head } = linearRepository('target', 'target-change.ts');
    // A repository with no commits at all: analyzing the working directory instead of the
    // named workspace cannot quietly produce the same report.
    const elsewhere = createFixtureRepository({
      prefix: 'diffbeacon-stage6-elsewhere-',
      identity: 'e',
    });
    temporary.push(elsewhere.root);

    const run = runAction({
      cwd: elsewhere.cwd,
      eventName: 'pull_request',
      event: eventFor(base, head),
      workspace: target.cwd,
    });
    expect(run.stderr).toBe('');
    expect(run.status, run.stderr).toBe(0);
    expect(run.summary).toContain('target-change.ts');
  });

  it('refuses a workspace that is not a repository even when the working directory is one', () => {
    const { repo, base, head } = linearRepository('inrepo');
    const run = runAction({
      cwd: repo.cwd,
      eventName: 'pull_request',
      event: eventFor(base, head),
      workspace: plainDirectory('plain-directory'),
    });
    expect(run.status).not.toBe(0);
    expect(run.summary).toBeNull();
    expect(run.stderr).toMatch(/not a Git repository/);
    expect(run.stderr).not.toMatch(/at .*\(.*:\d+:\d+\)/);
  });

  it('requires GITHUB_WORKSPACE instead of guessing from the process', () => {
    const { base, head } = linearRepository('missingws');
    const run = runAction({
      cwd: repository,
      eventName: 'pull_request',
      event: eventFor(base, head),
      workspace: null,
    });
    expect(run.status).not.toBe(0);
    expect(run.stderr).toMatch(/GITHUB_WORKSPACE is required/);
    expect(run.summary).toBeNull();
  });

  it('reviews a workspace whose path contains spaces', () => {
    const repo = createFixtureRepository({
      prefix: 'diffbeacon-stage6-spaces-',
      nestedPath: 'reviewed repo with spaces',
      identity: 's',
    });
    temporary.push(repo.root);
    writeRepositoryFile(repo.cwd, 'spaced.ts', 'export const a = 1;\n');
    repo.commit('base');
    const base = gitIn(repo.cwd, ['rev-parse', 'HEAD']);
    writeRepositoryFile(repo.cwd, 'spaced.ts', 'export const a = 2;\n');
    repo.commit('head');
    const run = runAction({
      eventName: 'pull_request',
      event: eventFor(base, gitIn(repo.cwd, ['rev-parse', 'HEAD'])),
      workspace: repo.cwd,
    });
    expect(run.status, run.stderr).toBe(0);
    expect(run.summary).toContain('spaced.ts');
  });

  it('reviews a workspace whose path contains non-ASCII characters', () => {
    const repo = createFixtureRepository({
      prefix: 'diffbeacon-stage6-unicode-',
      nestedPath: '评审 unicodé',
      identity: 'u',
    });
    temporary.push(repo.root);
    writeRepositoryFile(repo.cwd, 'unicode.ts', 'export const a = 1;\n');
    repo.commit('base');
    const base = gitIn(repo.cwd, ['rev-parse', 'HEAD']);
    writeRepositoryFile(repo.cwd, 'unicode.ts', 'export const a = 2;\n');
    repo.commit('head');
    const run = runAction({
      eventName: 'pull_request',
      event: eventFor(base, gitIn(repo.cwd, ['rev-parse', 'HEAD'])),
      workspace: repo.cwd,
    });
    expect(run.status, run.stderr).toBe(0);
    expect(run.summary).toContain('unicode.ts');
  });
});

describe('the Job Summary contract', () => {
  it('requires GITHUB_STEP_SUMMARY instead of succeeding silently with no report', () => {
    const { repo, base, head } = linearRepository('nosummary');
    const run = runAction({
      eventName: 'pull_request',
      event: eventFor(base, head),
      workspace: repo.cwd,
      summary: null,
    });
    expect(run.status).not.toBe(0);
    expect(run.stderr).toMatch(/GITHUB_STEP_SUMMARY is required/);
    expect(run.stdout).toBe('');
  });

  it('reports a summary target that cannot be written as an Action failure', () => {
    const { repo, base, head } = linearRepository('badsummary');
    const run = runAction({
      eventName: 'pull_request',
      event: eventFor(base, head),
      workspace: repo.cwd,
      summary: repo.root,
    });
    expect(run.status).not.toBe(0);
    expect(run.stderr).toMatch(/GITHUB_STEP_SUMMARY/);
    expect(run.stderr).not.toMatch(/\bEISDIR\b/);
    expect(run.stderr).not.toMatch(/at .*\(.*:\d+:\d+\)/);
  });

  it('appends exactly one newline-terminated report to an existing summary', () => {
    const { repo, base, head } = linearRepository('append');
    const run = runAction({
      eventName: 'pull_request',
      event: eventFor(base, head),
      workspace: repo.cwd,
      seedSummary: '## earlier step\n\nkept text\n',
    });
    expect(run.status, run.stderr).toBe(0);
    const summary = run.summary ?? '';
    expect(summary.startsWith('## earlier step\n\nkept text\n')).toBe(true);
    expect((summary.match(/# DiffBeacon review/g) ?? []).length).toBe(1);
    expect(summary.endsWith('\n')).toBe(true);
    expect(summary.endsWith('\n\n')).toBe(false);
  });

  it('writes the report and nothing else on success', () => {
    const { repo, base, head } = linearRepository('clean');
    const run = runAction({
      eventName: 'pull_request',
      event: eventFor(base, head),
      workspace: repo.cwd,
    });
    expect(run.status, run.stderr).toBe(0);
    expect(run.stdout).toBe('');
    expect(run.stderr).toBe('');
    expect(run.summary).toContain('# DiffBeacon review');
    expect(run.summary).toContain('## Changed files');
  });
});

describe('pull-request topology selection', () => {
  it('reports the head-side change and excludes the base-only change from a merge-result checkout', () => {
    const repo = createFixtureRepository({ prefix: 'diffbeacon-stage6-topology-', identity: 'p' });
    temporary.push(repo.root);
    writeRepositoryFile(repo.cwd, 'shared.ts', 'export const value = 1;\n');
    repo.commit('root');
    const branchPoint = gitIn(repo.cwd, ['rev-parse', 'HEAD']);
    gitIn(repo.cwd, ['checkout', '-q', '-b', 'pr-head']);
    writeRepositoryFile(repo.cwd, 'head-only.ts', 'export const addedByHead = 2;\n');
    repo.commit('head side');
    const head = gitIn(repo.cwd, ['rev-parse', 'HEAD']);
    gitIn(repo.cwd, ['checkout', '-q', branchPoint]);
    gitIn(repo.cwd, ['checkout', '-q', '-b', 'base']);
    writeRepositoryFile(repo.cwd, 'base-only.ts', 'export const mergedIntoBase = 3;\n');
    repo.commit('base side moved on');
    const base = gitIn(repo.cwd, ['rev-parse', 'HEAD']);
    gitIn(repo.cwd, ['merge', '-q', '--no-ff', '--no-edit', head]);
    const mergeResult = gitIn(repo.cwd, ['rev-parse', 'HEAD']);
    expect(mergeResult).not.toBe(head);
    expect(mergeResult).not.toBe(base);

    const run = runAction({
      cwd: repo.cwd,
      eventName: 'pull_request',
      event: eventFor(base, head),
      workspace: repo.cwd,
    });
    expect(run.status, run.stderr).toBe(0);
    const summary = run.summary ?? '';
    expect(summary).toContain('head-only.ts');
    expect(summary).not.toContain('base-only.ts');
    // Both branches moved after the branch point: one commit on each side.
    expect(gitIn(repo.cwd, ['rev-list', '--count', `${base}..${head}`])).toBe('1');
    expect(gitIn(repo.cwd, ['rev-list', '--count', `${head}..${base}`])).toBe('1');
  });

  it('uses the event SHAs rather than the checked-out revision when they differ', () => {
    const repo = createFixtureRepository({ prefix: 'diffbeacon-stage6-checkout-', identity: 'k' });
    temporary.push(repo.root);
    writeRepositoryFile(repo.cwd, 'first.ts', 'export const a = 1;\n');
    repo.commit('base');
    const base = gitIn(repo.cwd, ['rev-parse', 'HEAD']);
    writeRepositoryFile(repo.cwd, 'pr-change.ts', 'export const b = 2;\n');
    repo.commit('head');
    const head = gitIn(repo.cwd, ['rev-parse', 'HEAD']);
    writeRepositoryFile(repo.cwd, 'later-unrelated.ts', 'export const c = 3;\n');
    repo.commit('a later commit nobody reviewed');

    const run = runAction({
      eventName: 'pull_request',
      event: eventFor(base, head),
      workspace: repo.cwd,
    });
    expect(run.status, run.stderr).toBe(0);
    expect(run.summary).toContain('pr-change.ts');
    expect(run.summary).not.toContain('later-unrelated.ts');
  });
});

describe('missing history and event failures', () => {
  function fileUrl(directory: string): string {
    return `file:///${directory.replace(/\\/g, '/')}`;
  }

  it('fails without writing a summary when the base commit is absent from a shallow checkout', () => {
    const { repo, base, head } = linearRepository('shallowsrc');
    const clone = path.join(scratch(), 'shallow-clone');
    gitIn(repo.root, ['clone', '-q', '--depth', '1', fileUrl(repo.root), clone]);
    expect(gitIn(clone, ['rev-parse', '--is-shallow-repository'])).toBe('true');
    expect(() => gitIn(clone, ['rev-parse', '--verify', `${base}^{commit}`])).toThrow();

    const run = runAction({
      eventName: 'pull_request',
      event: eventFor(base, head),
      workspace: clone,
    });
    expect(run.status).not.toBe(0);
    expect(run.summary).toBeNull();
    expect(run.stderr).toMatch(/cannot resolve revision/);
    expect(run.stderr).toMatch(/shallow or partial clone/);
  });

  it('succeeds on a shallow checkout that really contains both endpoints', () => {
    const { repo, base, head } = linearRepository('shallow2src');
    const clone = path.join(scratch(), 'shallow2-clone');
    gitIn(repo.root, ['clone', '-q', '--depth', '2', fileUrl(repo.root), clone]);
    expect(gitIn(clone, ['rev-parse', '--verify', `${base}^{commit}`])).toBe(base);

    const run = runAction({
      eventName: 'pull_request',
      event: eventFor(base, head),
      workspace: clone,
    });
    expect(run.status, run.stderr).toBe(0);
    expect(run.summary).toContain('a.ts');
  });

  it('rejects a missing event file without leaking a raw filesystem error', () => {
    const run = runAction({
      eventName: 'pull_request',
      eventPath: path.join(scratch(), 'absent-event.json'),
      workspace: repository,
    });
    expect(run.status).not.toBe(0);
    expect(run.stderr).toMatch(/GITHUB_EVENT_PATH/);
    expect(run.stderr).not.toMatch(/ENOENT/);
    expect(run.stderr).not.toMatch(/at .*\(.*:\d+:\d+\)/);
  });

  it('rejects malformed event JSON with a stable message', () => {
    const run = runAction({
      eventName: 'pull_request',
      eventRaw: '{ "pull_request": ',
      workspace: repository,
    });
    expect(run.status).not.toBe(0);
    expect(run.stderr).toMatch(/GITHUB_EVENT_PATH is not valid JSON/);
    expect(run.stderr).not.toMatch(/SyntaxError/);
  });

  it('rejects an event payload without pull_request metadata', () => {
    const run = runAction({
      eventName: 'pull_request',
      event: { repository: { id: 1 } },
      workspace: repository,
    });
    expect(run.status).not.toBe(0);
    expect(run.stderr).toMatch(/base\.sha is not a full commit object ID/);
    expect(run.summary).toBeNull();
  });

  it('refuses pull_request_target before touching Git, proven by a non-repository workspace', () => {
    const run = runAction({
      eventName: 'pull_request_target',
      event: eventFor('a'.repeat(40), 'b'.repeat(40)),
      workspace: plainDirectory('privileged-workspace'),
    });
    expect(run.status).not.toBe(0);
    expect(run.stderr).toMatch(/pull_request_target/);
    expect(run.stderr).toMatch(/only the pull_request event/);
    expect(run.stderr).not.toMatch(/Git repository|cannot resolve/);
    expect(run.summary).toBeNull();
  });
});
