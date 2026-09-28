/**
 * Stage 8, PHASES 18 and 19: counted quantities and line terminators. A header may claim
 * a number the machine cannot hold, and a content line may hold a code point that other
 * formats treat as a break; the report still has to carry only finite counts and count the
 * lines the unified-diff format actually defines.
 */

import { describe, expect, it } from 'vitest';
import { analyzeDiff, parseUnifiedDiff, renderJson } from '../packages/core/src/index.js';
import { diffForPath } from './stage8.hostile-corpus.js';

const LINE_SEPARATOR = '\u2028';
const PARAGRAPH_SEPARATOR = '\u2029';

/** Every number the report holds, so a bound can be asserted on each one. */
function numbersIn(value: unknown): number[] {
  if (typeof value === 'number') return [value];
  if (Array.isArray(value)) return value.flatMap(numbersIn);
  if (value !== null && typeof value === 'object') return Object.values(value).flatMap(numbersIn);
  return [];
}

const fileSection = (header: string, body: string[]): string =>
  [
    'diff --git a/src/a.ts b/src/a.ts',
    'index 1111111..2222222 100644',
    '--- a/src/a.ts',
    '+++ b/src/a.ts',
    header,
    ...body,
    '',
  ].join('\n');

describe('counted quantities under extreme headers', () => {
  const extreme = [
    fileSection('@@ -1,9999999999999999999999 +1,1 @@', ['-old', '+new']),
    fileSection('@@ -9999999999999999999999 +9999999999999999999999 @@', ['+new']),
    fileSection('@@ -1 +1,0 @@', ['-old']),
    [
      'diff --git a/src/old.ts b/src/new.ts',
      'similarity index 99999999999999999999%',
      'rename from src/old.ts',
      'rename to src/new.ts',
      '',
    ].join('\n'),
    [
      'diff --git a/src/old.ts b/src/new.ts',
      'similarity index not-a-number%',
      'rename from src/old.ts',
      'rename to src/new.ts',
      '',
    ].join('\n'),
    ['diff --git a/src/a.ts b/src/a.ts', 'old mode 99999999999999999999', ''].join('\n'),
  ];

  it('keeps every reported number finite and JSON-representable', () => {
    for (const diff of extreme) {
      const report = analyzeDiff(diff);
      for (const value of numbersIn(report))
        expect(Number.isFinite(value), JSON.stringify(diff)).toBe(true);
      const text = renderJson(report);
      expect(text.includes('Infinity'), text).toBe(false);
      expect(text.includes('NaN'), text).toBe(false);
      expect(JSON.parse(text)).toEqual(report);
    }
  });

  it('counts lines that exist rather than lines a header claims', () => {
    const report = analyzeDiff(
      fileSection('@@ -1,9999999999999999999999 +1,1 @@', ['-old', '+new']),
    );
    expect(report.summary.additions).toBe(1);
    expect(report.summary.deletions).toBe(1);
    expect(report.files[0]?.additions).toBe(1);
  });

  it('reports the accounting it could not prove instead of inventing a count', () => {
    const parsed = parseUnifiedDiff(
      fileSection('@@ -1,9999999999999999999999 +1,1 @@', ['-old', '+new']),
    );
    // A claimed old side larger than the patch can supply reads as a cut-off hunk, which is
    // what the parser says; the code is the measured one, not the hypothesised one.
    expect(parsed.diagnostics.map((entry) => entry.code)).toContain('truncated-hunk');
  });

  it('keeps a percentage out of the report when it is not a number at all', () => {
    const words = analyzeDiff(extreme[4] as string);
    expect(words.files[0]?.similarity).toBeNull();
    const huge = analyzeDiff(extreme[3] as string);
    // A claimed percentage beyond the double range stays finite and is reported as the patch
    // spelled it; the guard exists so no non-finite number can reach a report.
    expect(huge.files[0]?.similarity).toBe(1e20);
    expect(Number.isFinite(huge.files[0]?.similarity as number)).toBe(true);
  });
});

describe('line terminators the unified-diff format does not define', () => {
  it('keeps a paragraph or line separator inside one content line', () => {
    for (const separator of [LINE_SEPARATOR, PARAGRAPH_SEPARATOR]) {
      const parsed = parseUnifiedDiff(
        fileSection('@@ -1 +1 @@', ['-const text = "a";', `+const text = "a${separator}b";`]),
      );
      expect(parsed.diagnostics, JSON.stringify(parsed.diagnostics)).toEqual([]);
      expect(parsed.files[0]?.additions).toBe(1);
      expect(parsed.files[0]?.deletions).toBe(1);
    }
  });

  it('keeps a separator inside a quoted path as part of the name', () => {
    const name = `src/a${LINE_SEPARATOR}b.ts`;
    const parsed = parseUnifiedDiff(diffForPath(name, '-old\n+new'));
    expect(parsed.files[0]?.displayPath).toBe(name);
    expect(parsed.files[0]?.additions).toBe(1);
    expect(parsed.files[0]?.deletions).toBe(1);
    expect(parsed.diagnostics).toEqual([]);
  });

  it('still treats the byte the format does define as a break', () => {
    const parsed = parseUnifiedDiff(fileSection('@@ -1 +1,2 @@', ['-old', '+first', '+second']));
    expect(parsed.files[0]?.additions).toBe(2);
    expect(parsed.files[0]?.deletions).toBe(1);
    expect(parsed.diagnostics).toEqual([]);
  });
});
