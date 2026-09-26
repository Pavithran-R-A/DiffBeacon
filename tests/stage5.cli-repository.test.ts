import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { main } from '../packages/cli/src/index.js';
import {
  createFixtureRepository,
  gitIn,
  writeRepositoryFile,
  type FixtureRepository,
} from './git-repository-fixture.js';

// Stage 5, PHASE 7 and 8: the Git boundary is qualified against real repositories, not
// simulated ones. Each case builds the history it claims, and the shallow case first
// proves with Git itself that the revision really is missing before blaming DiffBeacon.

interface Run {
  code: number;
  stdout: string;
  stderr: string;
}

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

/** Run the shipped CLI from `cwd`, exactly as a reviewer in that directory would. */
async function review(cwd: string, args: string[]): Promise<Run> {
  const previous = process.cwd();
  let stdout = '';
  let stderr = '';
  const out = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    stdout += String(chunk);
    return true;
  });
  const err = vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
    stderr += String(chunk);
    return true;
  });
  try {
    process.chdir(cwd);
    return { code: await main(['review', ...args]), stdout, stderr };
  } finally {
    process.chdir(previous);
    out.mockRestore();
    err.mockRestore();
  }
}

function committedRepository(commitCount: number): FixtureRepository {
  const repo = createFixtureRepository({
    prefix: 'diffbeacon-stage5-repo-',
    identity: 'diffbeacon-stage5-repo',
  });
  roots.push(repo.root);
  for (let index = 1; index <= commitCount; index += 1) {
    writeRepositoryFile(repo.cwd, 'src/app.ts', `export const value = ${index};\n`);
    writeRepositoryFile(repo.cwd, 'src/util.ts', `export const helper = ${index};\n`);
    repo.commit(`commit ${index}`);
  }
  return repo;
}

/**
 * A real shallow or complete clone made by Git. The `file:///` URL matters: measured on
 * this machine, `git clone --depth 1 <native local path>` copies every object and so is
 * not shallow at all, while the same depth against a `file:///` URL gives one commit.
 */
function cloneOf(source: FixtureRepository, depth: number | null): string {
  const parent = mkdtempSync(path.join(tmpdir(), 'diffbeacon-stage5-clone-'));
  roots.push(parent);
  const target = path.join(parent, 'clone');
  const args = ['clone', '-q'];
  if (depth !== null) args.push('--depth', String(depth));
  execFileSync('git', [...args, `file:///${source.cwd.replaceAll('\\', '/')}`, target], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    windowsHide: true,
  });
  return target;
}

describe('shallow history is reported as missing history', () => {
  it('names the missing revision and the --stdin way round for a one-commit shallow clone', async () => {
    const source = committedRepository(3);
    const shallow = cloneOf(source, 1);
    // Prove the premise with Git itself: this clone genuinely has no HEAD~1.
    expect(() => gitIn(shallow, ['rev-parse', '--verify', 'HEAD~1^{commit}'])).toThrow();

    const result = await review(shallow, ['HEAD~1...HEAD']);
    expect(result.code).toBe(3);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('HEAD~1');
    expect(result.stderr).toContain('shallow');
    expect(result.stderr).toContain('--stdin');
  }, 40_000);

  it('reviews a shallow clone whose requested depth really is present', async () => {
    const source = committedRepository(3);
    const shallow = cloneOf(source, 2);

    const result = await review(shallow, ['HEAD~1...HEAD']);
    expect(result.code, result.stderr).toBe(0);
    expect(result.stdout).toContain('2 files changed');
  }, 40_000);

  it('reviews the same range in a complete clone of the same source', async () => {
    const source = committedRepository(3);
    const complete = cloneOf(source, null);
    expect(gitIn(complete, ['rev-list', '--all', '--count'])).toBe('3');

    const result = await review(complete, ['HEAD~1...HEAD']);
    expect(result.code, result.stderr).toBe(0);
    expect(result.stdout).toContain('2 files changed');
  }, 40_000);
});

describe('where the command is run decides which repository is read', () => {
  it('reads the enclosing repository from a subdirectory, with root-relative paths', async () => {
    const repo = committedRepository(2);
    const nested = path.join(repo.cwd, 'packages', 'deep');
    mkdirSync(nested, { recursive: true });

    const result = await review(nested, ['HEAD~1...HEAD']);
    expect(result.code, result.stderr).toBe(0);
    expect(result.stdout).toContain('src/app.ts');
  }, 40_000);

  it('reads the inner repository when one repository lives inside another', async () => {
    const outer = committedRepository(2);
    const inner = path.join(outer.cwd, 'inner');
    roots.push(inner);
    for (const args of [
      ['init', '-q', inner],
      ['-C', inner, 'config', 'user.email', 'inner@example.invalid'],
      ['-C', inner, 'config', 'user.name', 'DiffBeacon inner'],
      ['-C', inner, 'config', 'core.hooksPath', outer.hooksPath],
    ])
      execFileSync('git', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
        windowsHide: true,
      });
    for (const index of [1, 2]) {
      writeRepositoryFile(inner, 'inner-only.ts', `export const inner = ${index};\n`);
      gitIn(inner, ['add', '--all']);
      gitIn(inner, ['commit', '-qm', `inner ${index}`]);
    }

    const result = await review(inner, ['HEAD~1...HEAD']);
    expect(result.code, result.stderr).toBe(0);
    expect(result.stdout).toContain('inner-only.ts');
    expect(result.stdout).not.toContain('src/app.ts');
  }, 60_000);

  it('reviews a detached head as long as both endpoints exist', async () => {
    const repo = committedRepository(2);
    gitIn(repo.cwd, ['checkout', '-q', '--detach', 'HEAD']);
    expect(gitIn(repo.cwd, ['rev-parse', '--abbrev-ref', 'HEAD'])).toBe('HEAD');

    const result = await review(repo.cwd, ['HEAD~1...HEAD']);
    expect(result.code, result.stderr).toBe(0);
    expect(result.stdout).toContain('2 files changed');
  }, 40_000);

  it('reports a repository without any commit as unresolvable history', async () => {
    const repo = createFixtureRepository({
      prefix: 'diffbeacon-stage5-empty-',
      identity: 'diffbeacon-stage5-empty',
    });
    roots.push(repo.root);

    const result = await review(repo.cwd, ['HEAD~1...HEAD']);
    expect(result.code).toBe(3);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('cannot resolve revision');
  }, 40_000);
});
