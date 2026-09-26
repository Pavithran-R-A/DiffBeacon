import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { main } from '../packages/cli/src/index.js';
import {
  createFixtureRepository,
  gitIn,
  removeFixtureRepository,
  writeRepositoryFile,
  type FixtureRepository,
} from './git-repository-fixture';

// Stage 5, PHASE 17: a revision is opaque text a hostile repository or caller controls.
// DiffBeacon must refuse the shapes that carry shell syntax without ever starting Git,
// must keep accepting ordinary revision punctuation, and must prove that the one place
// it does run Git uses an argument vector with the shell switched off.

const EXIT = { ok: 0, usage: 2 } as const;
const BACKTICK = String.fromCharCode(96);

async function run(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
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
    return { code: await main(args), stdout, stderr };
  } finally {
    out.mockRestore();
    err.mockRestore();
  }
}

/** A fresh directory so a shell that did run would leave a visible marker. */
function emptyWorkingDirectory(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'diffbeacon-stage5-refs-'));
  return root;
}

const SHELL_BEARING_REVISIONS: [string, string][] = [
  ['command substitution', '$(touch pwned-substitution)..HEAD'],
  ['backtick substitution', BACKTICK + 'touch pwned-backtick' + BACKTICK + '..HEAD'],
  ['semicolon chaining', '; touch pwned-semicolon..HEAD'],
  ['pipe', '| tee pwned-pipe..HEAD'],
  ['redirection', '> pwned-redirection..HEAD'],
  ['background job', '& touch pwned-background..HEAD'],
  ['inner whitespace', 'HEAD~1..HEAD main'],
  ['newline', 'HEAD~1..HEAD\nmain'],
  ['option injection', '--out=stdout..HEAD'],
  ['excessive length', 'x'.repeat(4000) + '..HEAD'],
];

describe('a revision that carries shell syntax is refused before Git is asked', () => {
  for (const [label, range] of SHELL_BEARING_REVISIONS) {
    it(`rejects ${label} with exit 2 and leaves no marker file behind`, async () => {
      const previous = process.cwd();
      const work = emptyWorkingDirectory();
      process.chdir(work);
      try {
        const result = await run(['review', range]);
        expect(result.code).toBe(EXIT.usage);
        expect(result.stdout).toBe('');
        expect(result.stderr).toMatch(/^DiffBeacon: /);
        expect(readdirSync(work)).toEqual([]);
      } finally {
        process.chdir(previous);
        rmSync(work, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
      }
    });
  }

  it('proves the marker check can see a file at all', () => {
    const work = emptyWorkingDirectory();
    expect(readdirSync(work)).toEqual([]);
    writeRepositoryFile(work, 'pwned-control', 'x');
    expect(existsSync(path.join(work, 'pwned-control'))).toBe(true);
    rmSync(work, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  });
});
describe('ordinary Git revision punctuation is not refused for punctuation', () => {
  let repo: FixtureRepository;
  let base: string;
  const previous = process.cwd();

  beforeAll(() => {
    repo = createFixtureRepository({ prefix: 'diffbeacon-stage5-refs-ok-', identity: 'refs-ok' });
    writeRepositoryFile(repo.cwd, 'src/app.ts', 'export const one = 1;\n');
    repo.commit('base');
    base = gitIn(repo.cwd, ['rev-parse', 'HEAD']);
    repo.git(['branch', 'release/1.2']);
    repo.git(['tag', 'v1.2']);
    writeRepositoryFile(repo.cwd, 'src/app.ts', 'export const one = 2;\n');
    writeRepositoryFile(repo.cwd, 'src/util.ts', 'export const two = 2;\n');
    repo.commit('head');
    process.chdir(repo.cwd);
  });

  afterAll(() => {
    process.chdir(previous);
    removeFixtureRepository(repo.root);
  });

  // `BASE` stands for the full object id, which only exists once the fixture has run.
  for (const shape of [
    'release/1.2..HEAD',
    'release/1.2...HEAD',
    'v1.2..HEAD',
    'HEAD~1..HEAD',
    'HEAD~1...HEAD',
    'HEAD^..HEAD',
    'BASE..HEAD',
    'BASE...HEAD',
    'release/1.2..HEAD^{}',
  ]) {
    it(`reviews ${shape} as a real two-endpoint comparison`, async () => {
      const result = await run(['review', shape.replace('BASE', base)]);
      expect(result.stderr).toBe('');
      expect(result.code).toBe(EXIT.ok);
      expect(result.stdout).toContain('2 files changed');
    });
  }
});
describe('the Git boundary stays an argument vector with the shell off', () => {
  const gitSource = readFileSync('packages/cli/src/git.ts', 'utf8');
  const revisionSource = readFileSync('packages/cli/src/revisions.ts', 'utf8');

  it('disables the shell on every child-process call', () => {
    expect(gitSource.match(/shell: false/g)?.length).toBeGreaterThanOrEqual(3);
    expect(gitSource).not.toMatch(/shell:\s*true/);
  });

  it('never reaches for the shell-flavoured process APIs', () => {
    expect(gitSource).not.toMatch(/\bexecSync\(/);
    expect(gitSource).not.toMatch(/\bspawnSync\(/);
    expect(gitSource).toContain("execFileSync('git',");
    expect(gitSource).toMatch(/spawn\('git',\s*gitArgs\(safeRange\)/);
  });

  it('hands the revision over as one guarded argv entry', () => {
    expect(gitSource).toContain("'--end-of-options'");
    expect(revisionSource).toContain('$;|&<>');
  });
});
// CASES
