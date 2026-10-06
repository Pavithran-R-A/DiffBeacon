/**
 * Stage 8, PHASE 20: names that a Windows filesystem would refuse, rewrite, or treat as a
 * device. DiffBeacon reads change descriptions, so the only two questions these shapes can
 * raise are whether the name arrives intact as data and whether anything is ever opened at it.
 * The measured answers pin both, and no Windows-name special case is added: on a POSIX system
 * `NUL` and `CON.ts` are perfectly ordinary filenames, and refusing them would be a guess about
 * the platform the report travels through rather than a property of a diff.
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  analyzeDiff,
  parseUnifiedDiff,
  renderJson,
  renderMarkdown,
} from '../packages/core/src/index.js';
import { main } from '../packages/cli/src/index.js';
import { WINDOWS_INVALID_PATHS, diffForPath, diffForPaths } from './stage8.hostile-corpus.js';

const temporary: string[] = [];
const undo: (() => void)[] = [];

function sandbox(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'diffbeacon-stage8-shapes-'));
  temporary.push(root);
  return root;
}

afterEach(() => {
  for (const restore of undo.splice(0)) restore();
  for (const root of temporary.splice(0))
    rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

function snapshot(root: string): string[] {
  const walk = (directory: string, prefix: string): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const relative = `${prefix}/${entry.name}`;
      if (!entry.isDirectory()) return [relative];
      return [`${relative}/`, ...walk(path.join(directory, entry.name), relative)];
    });
  return walk(root, '').sort();
}

async function run(diff: string, args: string[], cwd: string): Promise<number> {
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
  return main(['review', '--stdin', ...args]);
}

/** The rows of the Changed-files table: every `|`-led line after the last heading. */
function changedFileRows(markdown: string): string[] {
  const lines = markdown.split('\n');
  const start = lines.lastIndexOf('## Changed files');
  expect(start).toBeGreaterThanOrEqual(0);
  return lines.slice(start).filter((line) => line.startsWith('|'));
}

describe('a Windows-invalid name stays display data', () => {
  it('reports one file per reserved or refused name, with the name unchanged', () => {
    const parsed = parseUnifiedDiff(diffForPaths(WINDOWS_INVALID_PATHS));
    expect(parsed.files).toHaveLength(WINDOWS_INVALID_PATHS.length);
    expect(parsed.files.map((file) => file.displayPath).sort()).toEqual(
      [...WINDOWS_INVALID_PATHS].sort(),
    );
    expect(parsed.diagnostics).toEqual([]);
  });

  it('keeps trailing dots and trailing spaces as distinct filename data', () => {
    expect(analyzeDiff(diffForPath('src/trailing-dot.')).files[0]?.displayPath).toBe(
      'src/trailing-dot.',
    );
    expect(analyzeDiff(diffForPath('src/trailing-space ')).files[0]?.displayPath).toBe(
      'src/trailing-space ',
    );
    expect(analyzeDiff(diffForPath('src/trailing-space ')).summary.changedFiles).toBe(1);
    expect(analyzeDiff(diffForPath('src/trailing-space')).files[0]?.displayPath).not.toBe(
      analyzeDiff(diffForPath('src/trailing-space ')).files[0]?.displayPath,
    );
  });

  it('gives the Markdown table exactly one row per name', () => {
    const rows = changedFileRows(renderMarkdown(analyzeDiff(diffForPaths(WINDOWS_INVALID_PATHS))));
    // header + delimiter + one row per file, so a name that broke the table shape is visible
    // as a row count that does not match the report it came from.
    expect(rows).toHaveLength(WINDOWS_INVALID_PATHS.length + 2);
  });

  it('keeps an embedded NUL byte as one name rather than a truncated one', () => {
    const name = 'src/a\u0000b.ts';
    const report = analyzeDiff(diffForPath(name));
    expect(report.summary.changedFiles).toBe(1);
    expect(report.files[0]?.displayPath).toBe(name);
    expect(JSON.parse(renderJson(report))).toEqual(report);
    expect(renderJson(report)).toContain('a\\u0000b');
  });
});

describe('an invalid-looking name is never opened', () => {
  it('leaves the working directory untouched while reporting all of them', async () => {
    const root = sandbox();
    expect(await run(diffForPaths(WINDOWS_INVALID_PATHS), ['--format', 'json'], root)).toBe(0);
    expect(snapshot(root)).toEqual([]);
  });

  it('honours a reserved-looking --output basename as the ordinary file the write created', async () => {
    // Measured on Windows: the write API DiffBeacon uses addresses the path directly, so a file
    // named `NUL` really appears and really holds the report — it is not swallowed by the device
    // namespace. On POSIX the same name is an ordinary file, so the assertion holds either way.
    const root = sandbox();
    const target = path.join(root, 'NUL');
    const args = ['--format', 'json', '--output', target];
    expect(await run(diffForPaths(WINDOWS_INVALID_PATHS), args, root)).toBe(0);
    expect(existsSync(target)).toBe(true);
    expect(reportOf(target).schemaVersion).toBe('1');
  });

  it('still refuses to invent a directory for a name the OS will not accept', async () => {
    const root = sandbox();
    mkdirSync(path.join(root, 'plain'), { recursive: true });
    const missing = path.join('missing', 'nested', 'report.json');
    const code = await run(diffForPaths(WINDOWS_INVALID_PATHS), ['--output', missing], root);
    expect(code).toBe(4);
    expect(snapshot(path.join(root, 'plain'))).toEqual([]);
    expect(existsSync(path.join(root, 'missing'))).toBe(false);
  });
});

function reportOf(file: string): { schemaVersion: string } {
  return JSON.parse(readFileSync(file, 'utf8')) as { schemaVersion: string };
}

