import process from 'node:process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyzeDiff, renderJson, renderPretty } from '../packages/core/src/index.js';
import { boundedSingleLine, echo } from '../packages/cli/src/errors.js';
import { main } from '../packages/cli/src/index.js';
import {
  BIDI_CONTROL_PATHS,
  CONTROL_CHAR_PATHS,
  MIXED_UNICODE_PATHS,
  diffForPath,
} from './stage8.hostile-corpus.js';

const CONTROL_CODES = [
  ...range(0x00, 0x08),
  ...range(0x0b, 0x1f),
  ...range(0x7f, 0x9f),
  0x2028,
  0x2029,
  0x200e,
  0x200f,
  0x061c,
  ...range(0x202a, 0x202e),
  ...range(0x2066, 0x2069),
];

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, index) => from + index);
}

const isDisplayControl = (character: string): boolean =>
  CONTROL_CODES.includes(character.codePointAt(0) as number);

const containsDisplayControl = (value: string): boolean => [...value].some(isDisplayControl);

// Stage 5 qualified C0 and DEL. The classes above are the remaining gap: 8-bit C1 controls
// (U+009B CSI and U+009D OSC are the 8-bit forms of the escape sequences a terminal
// executes), the separators that a line reader can break on, and the bidi formatting
// controls that reorder the trusted text printed beside a path.

const ESC = String.fromCharCode(0x1b) + '[';
const HOSTILE_NAMES: readonly string[] = [...CONTROL_CHAR_PATHS, ...BIDI_CONTROL_PATHS];

const prettyFor = (path: string): string => renderPretty(analyzeDiff(diffForPath(path)));

/** The name a CHANGED FILES line prints, with its trusted status and counts removed. */
function prettyName(line: string | undefined): string {
  expect(line, 'a modified file should be listed').toBeDefined();
  const row = line as string;
  expect(row).toMatch(/ {2}\+1 -1$/);
  return row.slice(row.indexOf('  ', 'modified'.length) + 2, -'  +1 -1'.length);
}

async function runCli(
  args: string[],
  input: AsyncIterable<string> = (async function* () {
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

afterEach(() => {
  vi.restoreAllMocks();
});

describe('pretty output keeps display controls out of the terminal', () => {
  it('prints no C1, separator, or bidi formatting control for any hostile name', () => {
    const offenders: string[] = [];
    for (const path of HOSTILE_NAMES) {
      const pretty = prettyFor(path);
      if (containsDisplayControl(pretty))
        offenders.push(
          `${JSON.stringify(path)} -> ${JSON.stringify(
            [...pretty].filter(isDisplayControl).join(''),
          )}`,
        );
    }
    expect(offenders).toEqual([]);
  });

  it('never lets a name carry a sequence a terminal would execute', () => {
    for (const path of HOSTILE_NAMES) {
      const pretty = prettyFor(path);
      expect(pretty, path).not.toContain(ESC);
      expect(pretty, path).not.toContain('\u009b');
      expect(pretty, path).not.toContain('\u009d');
    }
  });

  it('keeps a hostile name from reordering the trusted text around it', () => {
    for (const path of HOSTILE_NAMES) {
      const row = prettyFor(path)
        .split('\n')
        .find((line) => line.startsWith('modified'));
      // The counts after the name are the trusted part of the line; nothing inside the
      // name may move them out of sight or claim their position.
      expect(prettyName(row), path).not.toMatch(/[\u202a-\u202e\u2066-\u2069\u061c\u200e\u200f]/);
    }
  });

  it('leaves ordinary Arabic, Hebrew, emoji, and combining text untouched', () => {
    const offenders: string[] = [];
    for (const path of MIXED_UNICODE_PATHS) {
      if (containsDisplayControl(path) || path.includes(ESC)) continue;
      const factual = analyzeDiff(diffForPath(path)).files[0]?.displayPath ?? '';
      const printed = prettyName(
        prettyFor(path)
          .split('\n')
          .find((line) => line.startsWith('modified')),
      );
      if (printed !== factual)
        offenders.push(`${JSON.stringify(path)} -> ${JSON.stringify(printed)}`);
    }
    expect(offenders).toEqual([]);
  });

  it('keeps JSON factual while escaping controls in the serialized text', () => {
    for (const path of [
      'src/\u009b[31mC1csi.ts',
      'src/\u202eRLO.ts',
      'src/\u2066isolate.ts',
      'src/\u200emark.ts',
    ]) {
      const report = analyzeDiff(diffForPath(path));
      const json = renderJson(report);
      expect(report.files[0]?.displayPath, path).toBe(path);
      expect(JSON.parse(json).files[0].displayPath, path).toBe(path);
      expect(containsDisplayControl(json), path).toBe(false);
    }
    expect(renderJson(analyzeDiff(diffForPath('src/\u009b[31mC1csi.ts')))).toContain('\\u009b');
    expect(renderJson(analyzeDiff(diffForPath('src/\u202eRLO.ts')))).toContain('\\u202e');
    expect(prettyFor('src/\u009b[31mC1csi.ts')).not.toContain('\u009b');
  });
});

describe('the CLI message surface keeps one bounded line', () => {
  it('quotes a C1 control so it cannot reach a terminal raw', () => {
    expect(echo(`a${'\u009b'}b`)).toBe('"a b"');
    expect(echo(`a${'\u0085'}b`)).toBe('"a b"');
    expect(echo(`rev${'\u001b'}[31mx`)).toBe('"rev [31mx"');
  });

  it('quotes a bidi formatting control and a line separator', () => {
    expect(echo(`src/${'\u202e'}RLO.ts`)).toBe('"src/RLO.ts"');
    expect(echo(`a${'\u2028'}b`)).toBe('"a b"');
    expect(echo(`a${'\u2029'}b`)).toBe('"a b"');
    // An isolate has no width of its own, so dropping it leaves the name whole; a
    // separator is where a reader could break the line, so it leaves a space.
    expect(echo(`a${'\u2066'}b`)).toBe('"ab"');
  });

  it('collapses multi-line process output containing C1 into one line', () => {
    const line = boundedSingleLine(
      `fatal: bad object ${'\u009b'}[31m\nsecond line${'\u0085'}third`,
    );
    expect(line.split('\n')).toHaveLength(1);
    expect(containsDisplayControl(line)).toBe(false);
  });

  it('refuses a C1-bearing range in one clean stderr line', async () => {
    const result = await runCli(['review', `..\u009b[31mevil\u009b[0m`]);
    expect(result.code).toBe(2);
    expect(result.stderr.trim().split('\n')).toHaveLength(1);
    expect(containsDisplayControl(result.stderr.trim())).toBe(false);
    expect(result.stderr).toContain('DiffBeacon: ');
  });

  it('refuses a bidi-overridden range in one clean stderr line', async () => {
    const result = await runCli(['review', `..\u202e\u009d;http://example.invalid\u0007evil`]);
    expect(result.code).toBe(2);
    expect(result.stderr.trim().split('\n')).toHaveLength(1);
    expect(containsDisplayControl(result.stderr.trim())).toBe(false);
  });

  it('names an unwritable output path without releasing its formatting controls', async () => {
    const result = await runCli(['review', '--stdin', '--output', `missing-\u202edir/report.md`]);
    expect(result.code).toBe(4);
    expect(result.stderr.trim().split('\n')).toHaveLength(1);
    expect(result.stderr).toContain('Could not write');
    expect(containsDisplayControl(result.stderr.trim())).toBe(false);
  });

  it('prints a hostile stdin report to stdout without display controls', async () => {
    async function* feed(): AsyncGenerator<string> {
      yield diffForPath(`src/${'\u202e'}RLO.ts`);
      yield diffForPath(`src/${'\u009b'}[31mC1csi.ts`);
    }
    const result = await runCli(['review', '--stdin'], feed());
    expect(result.code).toBe(0);
    expect(containsDisplayControl(result.stdout.trim())).toBe(false);
    expect(result.stdout).not.toContain(ESC);
    expect(result.stderr).toBe('');
  });

  it('prints hostile JSON to stdout as safe JSON escapes that round-trip to the raw names', async () => {
    const paths = [`src/${'\u202e'}RLO.ts`, `src/${'\u009b'}[31mC1csi.ts`];
    async function* feed(): AsyncGenerator<string> {
      for (const path of paths) yield diffForPath(path);
    }
    const result = await runCli(['review', '--stdin', '--format', 'json'], feed());
    expect(result.code).toBe(0);
    expect(result.stderr).toBe('');
    expect(containsDisplayControl(result.stdout.trim())).toBe(false);
    expect(result.stdout).toContain('\\u202e');
    expect(result.stdout).toContain('\\u009b');
    const parsed = JSON.parse(result.stdout) as { files: Array<{ displayPath: string }> };
    expect(parsed.files.map((file) => file.displayPath).toSorted()).toEqual(paths.toSorted());
  });
});
