import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { main } from '../packages/cli/src/index.js';

// Stage 5, PHASE 18: an `--output` path is user-selected local output, not a Git revision.
// It is therefore allowed to contain spaces and Unicode, and it must never be re-read as
// an option once consumed as the value - but a value really has to be supplied, and a
// destination the OS refuses has to come back as exit 4 rather than a stack trace.

const EXIT = { ok: 0, usage: 2, outputUnwritable: 4 } as const;

const ONE_FILE = [
  'diff --git a/src/app.ts b/src/app.ts',
  'index 1111111..2222222 100644',
  '--- a/src/app.ts',
  '+++ b/src/app.ts',
  '@@ -1 +1 @@',
  '-export const one = 1;',
  '+export const one = 2;',
  '',
].join('\n');

const temporary: string[] = [];
const undo: (() => void)[] = [];

function reportDirectory(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'diffbeacon-stage5-paths-'));
  temporary.push(root);
  return root;
}

afterEach(() => {
  for (const restore of undo.splice(0)) restore();
  for (const root of temporary.splice(0))
    rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

interface Run {
  code: number;
  stdout: string;
  stderr: string;
}

async function run(args: string[]): Promise<Run> {
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
  const previousStdin = Object.getOwnPropertyDescriptor(process, 'stdin');
  Object.defineProperty(process, 'stdin', {
    value: (async function* () {
      yield Buffer.from(ONE_FILE, 'utf8');
    })(),
    configurable: true,
  });
  undo.push(() => {
    if (previousStdin) Object.defineProperty(process, 'stdin', previousStdin);
    out.mockRestore();
    err.mockRestore();
  });
  return { code: await main(['review', '--stdin', ...args]), stdout, stderr };
}

describe('an output path is a local destination, not a revision', () => {
  it('writes a report whose name contains spaces and non-ASCII characters', async () => {
    const target = path.join(reportDirectory(), 'review notes - rapport été 報告.txt');
    const result = await run(['--output', target]);
    expect(result.code).toBe(EXIT.ok);
    expect(result.stdout).toBe('');
    const written = readFileSync(target, 'utf8');
    expect(written).toContain('DiffBeacon');
    expect(written.endsWith('\n\n')).toBe(false);
  });

  it('writes into a nested directory that already exists', async () => {
    const nested = path.join(reportDirectory(), 'runs', 'today');
    mkdirSync(nested, { recursive: true });
    const target = path.join(nested, 'report.md');
    const result = await run(['--output', target, '--format', 'markdown']);
    expect(result.code).toBe(EXIT.ok);
    expect(result.stdout).toBe('');
    expect(readFileSync(target, 'utf8')).toContain('# DiffBeacon');
  });

  it('refuses a nonexistent parent directory with exit 4 and writes no report', async () => {
    const target = path.join(reportDirectory(), 'missing-parent', 'report.txt');
    const result = await run(['--output', target]);
    expect(result.code).toBe(EXIT.outputUnwritable);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('Could not write');
    expect(existsSync(target)).toBe(false);
  });

  it('refuses a directory supplied as the file target with exit 4', async () => {
    const directory = reportDirectory();
    const result = await run(['--output', directory]);
    expect(result.code).toBe(EXIT.outputUnwritable);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('Could not write');
  });
});
describe('the --output value is consumed as a name and never as an option', () => {
  it('writes to a file whose name begins with a dash', async () => {
    const target = path.join(reportDirectory(), '-report.txt');
    const result = await run(['--output', target]);
    expect(result.code).toBe(EXIT.ok);
    expect(existsSync(target)).toBe(true);
  });

  it('reports a missing value instead of writing a file named after a later flag', async () => {
    const stealing = await run(['--output', '--format', 'json']);
    expect(stealing.code).toBe(EXIT.usage);
    expect(stealing.stderr).toContain('requires a value');
    const trailing = await run(['--output']);
    expect(trailing.code).toBe(EXIT.usage);
    expect(trailing.stderr).toContain('requires a value');
  });
});
