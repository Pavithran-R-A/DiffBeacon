import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { boundedSingleLine, echo } from '../packages/cli/src/errors.js';
import { main } from '../packages/cli/src/index.js';

// Stage 5 qualifies what a terminal receives when the CLI refuses something. A
// user-visible error may carry context but never a stack trace, a raw Error dump,
// an unbounded payload, or an escape sequence from an argument or from Git.

const EXIT = {
  ok: 0,
  unexpected: 1,
  usage: 2,
  diffUnavailable: 3,
  outputUnwritable: 4,
} as const;
const ESC = String.fromCharCode(27) + '[';
const STACK = /^\s+at\s+/m;

async function run(
  args: string[],
  input: AsyncIterable<unknown> = (async function* () {
    yield 'diff --git a/src/app.ts b/src/app.ts\n';
  })(),
): Promise<{ code: number; stdout: string; stderr: string }> {
  const previousStdin = process.stdin;
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
  Object.defineProperty(process, 'stdin', { value: input, configurable: true, writable: true });
  try {
    return { code: await main(args), stdout, stderr };
  } finally {
    Object.defineProperty(process, 'stdin', {
      value: previousStdin,
      configurable: true,
      writable: true,
    });
    out.mockRestore();
    err.mockRestore();
  }
}

const temporary: string[] = [];

/** A directory outside any repository, so Git-backed failures are reached honestly. */
function outsideRepository(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'diffbeacon-stage5-errors-'));
  temporary.push(root);
  return root;
}

afterEach(() => {
  for (const root of temporary.splice(0))
    rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

const RED_REVISION = '\u001b[31mevil\u001b[0m..HEAD';
const RED_DIR = 'missing-\u001b[31mdir';
describe('a hostile argument never reaches the terminal unfiltered', () => {
  it('prints an escape-sequence revision as one plain line and exits 2', async () => {
    const result = await run(['review', RED_REVISION]);
    expect(result.code).toBe(EXIT.usage);
    expect(result.stderr).not.toContain(ESC);
    expect(result.stderr.trim().split('\n')).toHaveLength(1);
    expect(result.stderr).not.toMatch(STACK);
  });

  it('keeps a four-thousand-character output name inside one bounded line', async () => {
    const result = await run(['review', '--stdin', '--output', 'p'.repeat(4000)]);
    expect(result.code).toBe(EXIT.outputUnwritable);
    expect(result.stderr).toContain('Could not write');
    expect(result.stderr).not.toContain(ESC);
    expect(result.stderr).not.toMatch(STACK);
    expect(result.stderr.trim().split('\n')).toHaveLength(1);
    expect(result.stderr.length).toBeLessThan(900);
  });
});
describe('an unexpected internal failure stays one bounded line', () => {
  it('collapses a stdin failure into exit 1 with no stack trace', async () => {
    const boom = new Error('secret plumbing failed\n\u001b[31mred\u001b[0m\n' + 'x'.repeat(3000));
    boom.stack =
      'Error: secret plumbing failed\n    at explain (file:///C:/secret/plumbing.ts:42:11)';
    async function* failing(): AsyncGenerator<string> {
      yield 'diff --git a/src/app.ts b/src/app.ts\n';
      throw boom;
    }
    const result = await run(['review', '--stdin'], failing());
    expect(result.code).toBe(EXIT.unexpected);
    expect(result.stderr).toContain('unexpected internal failure');
    expect(result.stderr).not.toContain(ESC);
    expect(result.stderr).not.toMatch(STACK);
    expect(result.stderr).not.toContain('plumbing.ts');
    expect(result.stderr.trim().split('\n')).toHaveLength(1);
    expect(result.stderr.length).toBeLessThan(700);
  });
});
describe('every refusal mode prints one clean line', () => {
  it('covers usage, no-diff and unwritable-output without dumps or escapes', async () => {
    const previous = process.cwd();
    process.chdir(outsideRepository());
    try {
      const unwritable = path.join(outsideRepository(), RED_DIR, 'report.txt');
      const cases = [
        { args: ['review', 'HEAD'], code: EXIT.usage },
        { args: ['review', 'HEAD~1...HEAD'], code: EXIT.diffUnavailable },
        { args: ['review', '--stdin', '--output', unwritable], code: EXIT.outputUnwritable },
      ];
      for (const item of cases) {
        const label = item.args.join(' ');
        const result = await run(item.args);
        expect(result.code, label).toBe(item.code);
        expect(result.stdout, label).toBe('');
        expect(result.stderr, label).toMatch(/^DiffBeacon: /);
        expect(result.stderr, label).not.toContain(ESC);
        expect(result.stderr, label).not.toMatch(STACK);
        expect(result.stderr.trim().split('\n'), label).toHaveLength(1);
      }
    } finally {
      process.chdir(previous);
    }
  });
});
describe('the message sanitiser the Git boundary uses', () => {
  it('collapses coloured multi-line stderr into one bounded printable line', () => {
    const gitStderr =
      'error: unable to read \u001b[31mtree\u001b[0m\nfatal: bad object\n' + 'y'.repeat(20000);
    const line = boundedSingleLine(gitStderr);
    expect(line).not.toContain(ESC);
    expect(line.split('\n')).toHaveLength(1);
    expect(line).toContain('...(truncated)');
    expect(line.length).toBeLessThanOrEqual(512 + ' ...(truncated)'.length);
  });

  it('quotes an untrusted value so it cannot break out of its line', () => {
    const quoted = echo('a\u001bb\ncd');
    expect(quoted).not.toContain('\u001b');
    expect(quoted.split('\n')).toHaveLength(1);
    expect(quoted).toBe('"a b cd"');
  });
});
