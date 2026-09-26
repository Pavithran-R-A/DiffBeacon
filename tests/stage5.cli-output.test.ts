import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { main } from '../packages/cli/src/index.js';

// Stage 5, PHASE 13 and 14: `--output` is a destination, not an echo, and colour belongs
// to a terminal rather than to a file. stdout is forced to report itself as a TTY so the
// contract is proved under the only conditions where getting it wrong is visible.

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

/** Any ANSI escape sequence; none may appear in a file or in NO_COLOR output. */
const ESCAPE = String.fromCharCode(27) + '[';

const temporary: string[] = [];
const undo: (() => void)[] = [];

function reportDirectory(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'diffbeacon-stage5-output-'));
  temporary.push(root);
  return root;
}

afterEach(() => {
  for (const restore of undo.splice(0)) restore();
  for (const root of temporary.splice(0))
    rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

/** Claim `isTTY` on the real stdout stream for the duration of one test. */
function pretendTerminal(): void {
  const previous = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');
  Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });
  undo.push(() => {
    if (previous) Object.defineProperty(process.stdout, 'isTTY', previous);
    else delete (process.stdout as { isTTY?: boolean }).isTTY;
  });
}

interface Run {
  code: number;
  stdout: string;
  stderr: string;
}

/** Drive the shipped `main()` with `diff` piped on stdin, exactly as a shell would. */
async function run(args: string[], diff: string): Promise<Run> {
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
      yield Buffer.from(diff, 'utf8');
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

describe('--output writes the report to the file instead of stdout', () => {
  it('leaves stdout empty when a report file is named', async () => {
    const target = path.join(reportDirectory(), 'report.txt');
    const result = await run(['--output', target], ONE_FILE);
    expect(result.code).toBe(0);
    expect(result.stdout).toBe('');
    expect(readFileSync(target, 'utf8')).toContain('1 file changed');
  });

  it('ends the report file with exactly one newline', async () => {
    const target = path.join(reportDirectory(), 'report.txt');
    await run(['--output', target], ONE_FILE);
    const written = readFileSync(target, 'utf8');
    expect(written.endsWith('\n')).toBe(true);
    expect(written.endsWith('\n\n')).toBe(false);
  });

  it('keeps stdout empty for json and markdown reports too', async () => {
    for (const format of ['json', 'markdown'] as const) {
      const target = path.join(reportDirectory(), `${format}.txt`);
      const result = await run(['--format', format, '--output', target], ONE_FILE);
      expect(result.code, format).toBe(0);
      expect(result.stdout, format).toBe('');
      expect(readFileSync(target, 'utf8'), format).toContain('app.ts');
    }
  });
});

describe('colour follows the destination, not the count', () => {
  it('writes no escape sequence to the report file even when stdout is a terminal', async () => {
    pretendTerminal();
    const target = path.join(reportDirectory(), 'report.txt');
    const result = await run(['--output', target], ONE_FILE);
    expect(result.code).toBe(0);
    expect(readFileSync(target, 'utf8')).not.toContain(ESCAPE);
  });

  it('colours the terminal report when stdout is a terminal and no file is named', async () => {
    pretendTerminal();
    const result = await run([], ONE_FILE);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain(ESCAPE);
  });

  it('stays plain on a terminal when NO_COLOR is set', async () => {
    pretendTerminal();
    const previous = process.env.NO_COLOR;
    process.env.NO_COLOR = '1';
    undo.push(() => {
      if (previous === undefined) delete process.env.NO_COLOR;
      else process.env.NO_COLOR = previous;
    });
    const result = await run([], ONE_FILE);
    expect(result.code).toBe(0);
    expect(result.stdout).not.toContain(ESCAPE);
    expect(result.stdout).toContain('CHECK');
  });

  it('stays plain when stdout is not a terminal', async () => {
    const result = await run([], ONE_FILE);
    expect(result.code).toBe(0);
    expect(result.stdout).not.toContain(ESCAPE);
  });
});

describe('an unwritable report target is exit 4', () => {
  it('names the target, writes nothing to stdout and leaves no report behind', async () => {
    const target = path.join(reportDirectory(), 'missing', 'report.txt');
    const result = await run(['--output', target], ONE_FILE);
    expect(result.code).toBe(4);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('report.txt');
    expect(result.stderr).toContain('Could not write');
    expect(result.stderr).not.toContain(ESCAPE);
  });
});
