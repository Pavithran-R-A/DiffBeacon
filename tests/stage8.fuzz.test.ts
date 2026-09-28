/**
 * Stage 8, PHASE 39: a seeded, deterministic fuzz of the parser and the three renderers. The
 * seed is recorded here so any failing input can be regenerated, and `Math.random()` is never
 * called, so the case list cannot change between runs. There is no timing assertion on purpose:
 * PHASE 16 measures resource behaviour, and Stage 8 refuses to invent a millisecond SLA the
 * product does not promise.
 */

import { describe, expect, it } from 'vitest';
import {
  analyzeDiff,
  renderJson,
  renderMarkdown,
  renderPretty,
} from '../packages/core/src/index.js';
import {
  BIDI_CONTROL_PATHS,
  CONTROL_CHAR_PATHS,
  CONTROL_PATH,
  MARKUP_LOOKING_PATHS,
  SHELL_LOOKING_PATHS,
  TRAVERSAL_LOOKING_PATHS,
  diffForPath,
  diffForPaths,
} from './stage8.hostile-corpus.js';

/** Recorded so a failure below can be regenerated from this seed alone. */
const SEED = 0x5eed1a11;
const CASES = 1_500;

/** mulberry32: small, deterministic, and free of platform-dependent behaviour. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fragments chosen because they imitate diff structure, markup, or terminal control. */
const FRAGMENTS: [string, ...string[]] = [
  '@@ -1,99999999999999999999 +1,0 @@',
  'diff --git a/ b/',
  '--- /dev/null',
  '+++ /dev/null',
  'index 0000000..1111111',
  'GIT binary patch',
  'Binary files a/x and b/x differ',
  'similarity index not-a-number%',
  'old mode 100755',
  'deleted file mode 999999',
  '<script>alert(1)</script>',
  ']|\r\n\t\x00\x1b[31m',
  BIDI_CONTROL_PATHS[0],
  MARKUP_LOOKING_PATHS[1],
  'x'.repeat(4_096),
];

const SEED_DIFFS: [string, ...string[]] = [
  diffForPath(CONTROL_PATH),
  diffForPath(SHELL_LOOKING_PATHS[0]),
  diffForPath(MARKUP_LOOKING_PATHS[0]),
  diffForPath(TRAVERSAL_LOOKING_PATHS[1]),
  diffForPath(CONTROL_CHAR_PATHS[0]),
  diffForPath(BIDI_CONTROL_PATHS[0]),
  diffForPaths([CONTROL_PATH, MARKUP_LOOKING_PATHS[3], TRAVERSAL_LOOKING_PATHS[4]]),
  `${diffForPath('src/a.ts', '+added line')}${diffForPath('src/b.ts', '-removed line')}`,
  diffForPath(
    'src/rename.ts',
    'similarity index 90%\nrename from src/old.ts\nrename to src/rename.ts',
  ),
];

function pick<T>(next: () => number, values: readonly [T, ...T[]]): T {
  return values[Math.floor(next() * values.length)] ?? values[0];
}

/** One mutation of one seed diff. Each kind targets a different part of the parser's state. */
function mutate(next: () => number): string {
  const source = pick(next, SEED_DIFFS);
  const fragment = pick(next, FRAGMENTS);
  const lines = source.split('\n');
  const at = Math.floor(next() * (lines.length + 1));
  switch (Math.floor(next() * 6)) {
    case 0:
      return lines.slice(0, at).join('\n') + fragment + lines.slice(at).join('\n');
    case 1:
      return source.slice(0, Math.floor(next() * source.length));
    case 2:
      return lines.filter((_, index) => index !== at).join('\n');
    case 3: {
      const copy = [...lines];
      const other = Math.floor(next() * lines.length);
      [copy[at], copy[other]] = [lines[other] ?? '', lines[at] ?? ''];
      return copy.join('\n');
    }
    case 4:
      return source + fragment;
    default: {
      const cut = Math.floor(next() * source.length);
      return source.slice(0, cut) + pick(next, FRAGMENTS) + source.slice(cut);
    }
  }
}

const inputs = (() => {
  const next = random(SEED);
  return Array.from({ length: CASES }, () => mutate(next));
})();

const countedNumbers = (value: unknown, found: number[]): number[] => {
  if (typeof value === 'number') {
    found.push(value);
    return found;
  }
  if (Array.isArray(value)) for (const item of value) countedNumbers(item, found);
  else if (value !== null && typeof value === 'object')
    for (const item of Object.values(value)) countedNumbers(item, found);
  return found;
};

describe('the parser and renderers hold their contract under seeded fuzzing', () => {
  // Each case walks CASES inputs through analysis and rendering, so it needs far more than the
  // default five seconds; the budget is wall-clock only and asserts nothing about the product.
  const slow = { timeout: 300_000 };

  it(`never throws, with the seed recorded as ${SEED.toString(16)}`, slow, () => {
    let analyzed = 0;
    for (const input of inputs) {
      expect(
        () => {
          const report = analyzeDiff(input);
          renderJson(report);
          renderMarkdown(report);
          renderPretty(report);
          analyzed += 1;
        },
        `seed ${SEED.toString(16)} input ${JSON.stringify(input.slice(0, 120))}`,
      ).not.toThrow();
    }
    expect(analyzed).toBe(CASES);
  });

  it('produces only finite numbers, and no Infinity or NaN in the JSON', slow, () => {
    for (const input of inputs) {
      const report = analyzeDiff(input);
      const text = renderJson(report);
      expect(text).not.toContain('Infinity');
      expect(text).not.toContain('NaN');
      for (const value of countedNumbers(report, []))
        expect(Number.isFinite(value), JSON.stringify(value)).toBe(true);
    }
  });

  /**
   * `additions: number | null` is the published shape (model.ts:47): a file whose content Git
   * did not describe in lines reports null rather than a number. The fuzz question is whether
   * anything else can produce null, and whether a number, when present, is a count.
   */
  it('keeps every count null or a whole non-negative number', slow, () => {
    for (const input of inputs) {
      const report = analyzeDiff(input);
      for (const file of report.files) {
        for (const [field, count] of [
          ['additions', file.additions],
          ['deletions', file.deletions],
        ] as const) {
          expect(count, `${field} of ${file.displayPath}`).toSatisfy(
            (value) => value === null || (Number.isInteger(value) && value >= 0),
          );
        }
        expect(typeof file.displayPath).toBe('string');
      }
      expect(Number.isInteger(report.summary.additions)).toBe(true);
      expect(Number.isInteger(report.summary.deletions)).toBe(true);
      expect(report.summary.additions).toBeGreaterThanOrEqual(0);
      expect(report.summary.changedFiles).toBe(report.files.length);
    }
  });

  it('leaves a count null only where Git reports no line content', slow, () => {
    for (const input of inputs) {
      for (const file of analyzeDiff(input).files) {
        if (file.additions === null || file.deletions === null) {
          expect(
            { binary: file.binary, modeOnly: file.modeOnly },
            `null counts on a content-bearing file: ${file.displayPath}`,
          ).toSatisfy(
            (state: { binary: boolean; modeOnly: boolean }) => state.binary || state.modeOnly,
          );
        }
      }
    }
  });

  it('never lets a fuzzed path become a control character in terminal output', slow, () => {
    const EXECUTABLE = /[\p{Cc}\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u;
    for (const input of inputs) {
      const pretty = renderPretty(analyzeDiff(input));
      // The renderer's own line breaks are structure; nothing else in the output may be a
      // control character, so the check runs on each printed line separately.
      for (const line of pretty.split('\n')) expect(line).not.toMatch(EXECUTABLE);
    }
  });

  it('is deterministic: the same fuzzed input always gives the same report', slow, () => {
    for (const input of inputs.slice(0, 300))
      expect(renderJson(analyzeDiff(input))).toBe(renderJson(analyzeDiff(input)));
  });

  it('round-trips every fuzzed report through JSON without changing it', slow, () => {
    for (const input of inputs) {
      const report = analyzeDiff(input);
      expect(JSON.parse(renderJson(report))).toEqual(report);
    }
  });
});
