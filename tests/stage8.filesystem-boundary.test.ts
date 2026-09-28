/**
 * Stage 8, PHASES 9, 30 and 38: paths that look like traversal, a shell command, or a
 * Windows target are display data for DiffBeacon. The cases here inventory what the
 * program actually touches, keep the one place a path IS honoured — the user's own
 * `--output` — distinct from the names a report carries, and scan the shipped source for
 * the sinks no part of the program has a use for.
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyzeDiff } from '../packages/core/src/index.js';
import { main } from '../packages/cli/src/index.js';
import {
  SHELL_LOOKING_PATHS,
  TRAVERSAL_LOOKING_PATHS,
  diffForPaths,
} from './stage8.hostile-corpus.js';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const temporary: string[] = [];
const undo: (() => void)[] = [];

function sandbox(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'diffbeacon-stage8-fs-'));
  temporary.push(root);
  return root;
}

afterEach(() => {
  for (const restore of undo.splice(0)) restore();
  for (const root of temporary.splice(0))
    rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

/** Every path under `root`, so a side effect cannot hide in an unlisted subdirectory. */
function snapshot(root: string): string[] {
  const walk = (directory: string, prefix: string): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const relative = `${prefix}/${entry.name}`;
      if (!entry.isDirectory()) return [relative];
      return [`${relative}/`, ...walk(path.join(directory, entry.name), relative)];
    });
  return walk(root, '').sort();
}

async function runStdin(diff: string, args: string[], cwd: string): Promise<number> {
  const out = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  const err = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  const previousStdin = Object.getOwnPropertyDescriptor(process, 'stdin');
  const previousCwd = process.cwd();
  process.chdir(cwd);
  Object.defineProperty(process, 'stdin', {
    value: (async function* () {
      yield Buffer.from(diff, 'utf8');
    })(),
    configurable: true,
  });
  undo.push(() => {
    process.chdir(previousCwd);
    if (previousStdin) Object.defineProperty(process, 'stdin', previousStdin);
    out.mockRestore();
    err.mockRestore();
  });
  return await main(['review', '--stdin', ...args]);
}

const HOSTILE_PATHS = [...TRAVERSAL_LOOKING_PATHS, ...SHELL_LOOKING_PATHS];
const HOSTILE_DIFF = diffForPaths(HOSTILE_PATHS);

/** Every non-test `.ts`/`.tsx` path under `directory`, relative to the repository. */
function sourceFiles(directory: string): string[] {
  return readdirSync(path.join(repository, directory), { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(file);
    return /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.test.ts') ? [file] : [];
  });
}

describe('a hostile name never becomes a target', () => {
  it('writes nothing of its own while reporting traversal and shell-looking names', async () => {
    const root = sandbox();
    expect(await runStdin(HOSTILE_DIFF, ['--format', 'json'], root)).toBe(0);
    expect(snapshot(root)).toEqual([]);
    expect(existsSync(path.join(root, 'PWNED'))).toBe(false);
  });

  it('keeps the core analysis free of filesystem side effects', () => {
    const root = sandbox();
    const report = analyzeDiff(HOSTILE_DIFF);
    expect(report.files).toHaveLength(HOSTILE_PATHS.length);
    expect(snapshot(root)).toEqual([]);
  });

  it('reports each hostile name as text that is not a live path', () => {
    for (const file of analyzeDiff(HOSTILE_DIFF).files) {
      expect(typeof file.displayPath).toBe('string');
      expect(existsSync(file.displayPath)).toBe(false);
    }
  });
});

describe('the explicit --output path stays a user-selected destination', () => {
  it('honours an output name that contains a traversal-looking segment', async () => {
    const root = sandbox();
    mkdirSync(path.join(root, 'reports'), { recursive: true });
    mkdirSync(path.join(root, 'outside'), { recursive: true });
    // The `..` segment is kept as written rather than normalised away, because the only
    // thing being proved is that a destination the user named is not refused for its shape.
    const target = [root, 'reports', '..', 'outside', 'report.json'].join(path.sep);
    expect(await runStdin(HOSTILE_DIFF, ['--output', target, '--format', 'json'], root)).toBe(0);
    const written = readFileSync(path.join(root, 'outside', 'report.json'), 'utf8');
    expect(JSON.parse(written).schemaVersion).toBe('1');
  });

  it('still refuses a destination the operating system will not accept', async () => {
    const root = sandbox();
    const target = path.join(root, 'missing-parent', 'report.json');
    expect(await runStdin(HOSTILE_DIFF, ['--output', target], root)).toBe(4);
    expect(existsSync(target)).toBe(false);
  });
});

describe('the read-only surfaces hold no execution or network sink', () => {
  const scanned = ['packages/core/src', 'client/src'] as const;

  const forbidden = [
    'node:fs',
    'node:path',
    'node:child_process',
    'child_process',
    'fs/promises',
    'fetch(',
    'XMLHttpRequest',
    'dangerouslySetInnerHTML',
    'document.write',
  ];

  it('keeps every forbidden sink out of the parser and the browser client', () => {
    for (const directory of scanned) {
      const files = sourceFiles(directory);
      expect(files.length, directory).toBeGreaterThan(0);
      for (const file of files) {
        const text = readFileSync(path.join(repository, file), 'utf8');
        for (const sink of forbidden)
          expect(text.includes(sink), `${file} contains ${sink}`).toBe(false);
      }
    }
  });
});

/**
 * Stage 8, PHASE 38: the same question over the whole shipped tree. The CLI and the Action do
 * need a filesystem and a Git process, so the names below are only the ones no part of
 * DiffBeacon has any use for — an evaluator, a shell, a markup sink, or browser storage. The
 * browser bundle and the built packages are checked for network sinks separately by
 * `npm run verify`, which reads the artifacts rather than the source they came from.
 */
describe('no shipped source reaches for an evaluator, a shell, or markup', () => {
  const shipped = [
    'packages/core/src',
    'packages/cli/src',
    'packages/action/src',
    'client/src',
  ] as const;

  const neverNeeded = [
    'eval(',
    'new Function(',
    'execSync(',
    'shell: true',
    'innerHTML',
    'outerHTML',
    'insertAdjacentHTML',
    'document.write',
    'dangerouslySetInnerHTML',
    'document.cookie',
    'sendBeacon',
    'localStorage',
    'indexedDB',
  ];

  it('keeps every one of those names out of every published source directory', () => {
    const seen: string[] = [];
    for (const directory of shipped) {
      const files = sourceFiles(directory);
      expect(files.length, directory).toBeGreaterThan(0);
      for (const file of files) {
        seen.push(file);
        const text = readFileSync(path.join(repository, file), 'utf8');
        for (const name of neverNeeded)
          expect(text.includes(name), `${file} contains ${name}`).toBe(false);
      }
    }
    // Walking "every shipped file" is only worth something if the walk cannot quietly skip a
    // subtree, so the entry points that a published artifact is built from are named here.
    // The measured inventory is 18 source files across the four directories above.
    for (const critical of [
      'packages/core/src/parser.ts',
      'packages/core/src/render.ts',
      'packages/core/src/display.ts',
      'packages/cli/src/git.ts',
      'packages/cli/src/index.ts',
      'packages/action/src/index.ts',
    ])
      expect(
        seen.map((file) => file.split(path.sep).join('/')),
        `the scan skipped ${critical}`,
      ).toContain(critical);
  });
});
