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

  it('rejects malformed and out-of-range similarity percentages', () => {
    const malformed = [
      extreme[3] as string,
      extreme[4] as string,
      [
        'diff --git a/src/old.ts b/src/new.ts',
        'similarity index -1%',
        'rename from src/old.ts',
        'rename to src/new.ts',
        '',
      ].join('\n'),
      [
        'diff --git a/src/old.ts b/src/new.ts',
        'similarity index 101%',
        'rename from src/old.ts',
        'rename to src/new.ts',
        '',
      ].join('\n'),
      [
        'diff --git a/src/old.ts b/src/new.ts',
        'similarity index 92% trailing',
        'rename from src/old.ts',
        'rename to src/new.ts',
        '',
      ].join('\n'),
    ];
    for (const diff of malformed) {
      const parsed = parseUnifiedDiff(diff);
      expect(parsed.files[0]?.similarity, diff).toBeNull();
      expect(
        parsed.diagnostics.map((entry) => entry.code),
        diff,
      ).toContain('malformed-header');
      expect(analyzeDiff(diff).summary.diagnostics, diff).toBeGreaterThan(0);
    }
  });

  it('keeps the valid similarity boundaries inside the schema range', () => {
    for (const value of [0, 1, 99, 100]) {
      const diff = [
        'diff --git a/src/old.ts b/src/new.ts',
        `similarity index ${value}%`,
        'rename from src/old.ts',
        'rename to src/new.ts',
        '',
      ].join('\n');
      const parsed = parseUnifiedDiff(diff);
      expect(parsed.diagnostics, diff).toEqual([]);
      expect(parsed.files[0]?.similarity).toBe(value);
    }
  });

  it('does not infer a rename from similarity metadata alone', () => {
    const parsed = parseUnifiedDiff(
      ['diff --git a/src/app.ts b/src/app.ts', 'similarity index 95%', ''].join('\n'),
    );
    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.files[0]).toMatchObject({
      status: 'modified',
      oldPath: 'src/app.ts',
      newPath: 'src/app.ts',
      similarity: 95,
    });
  });

  it('rejects malformed mode metadata instead of deriving file status from it', () => {
    const cases = [
      ['old mode octal', 'new mode 100755'],
      ['old mode 100644', 'new mode 999999'],
      ['old mode 100644', 'new mode 777777'],
      ['new file mode 10064'],
      ['new file mode 040000'],
      ['deleted file mode 100888'],
    ];
    for (const lines of cases) {
      const parsed = parseUnifiedDiff(
        ['diff --git a/src/app.ts b/src/app.ts', ...lines, ''].join('\n'),
      );
      expect(
        parsed.diagnostics.map((entry) => entry.code),
        lines.join(' / '),
      ).toContain('malformed-header');
      expect(parsed.files[0]?.status, lines.join(' / ')).toBe('modified');
    }
  });

  it('keeps all six-digit octal Git modes, including symlink and gitlink modes', () => {
    for (const [oldMode, newMode] of [
      ['100644', '100755'],
      ['120000', '100644'],
      ['160000', '100644'],
    ]) {
      const parsed = parseUnifiedDiff(
        [
          'diff --git a/src/app.ts b/src/app.ts',
          `old mode ${oldMode}`,
          `new mode ${newMode}`,
          '',
        ].join('\n'),
      );
      expect(parsed.diagnostics, `${oldMode} -> ${newMode}`).toEqual([]);
      expect(parsed.files[0]).toMatchObject({
        status: 'mode-only',
        oldMode,
        newMode,
      });
    }
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
