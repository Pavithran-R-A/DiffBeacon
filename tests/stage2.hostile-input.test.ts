import { describe, expect, it } from 'vitest';
import {
  analyzeDiff,
  parseUnifiedDiff,
  renderJson,
  renderMarkdown,
  renderPretty,
} from '../packages/core/src/index.js';
import { FILE_STATUSES, SURFACE_IDS } from '../packages/core/src/model.js';
import type { ParsedDiff, ParseDiagnosticCode } from '../packages/core/src/model.js';

// Stage 2 (Phase 9): hostile, malformed input must stay hostile data. The parser is
// handed to a browser and a CI action, so garbage has to produce either facts it
// observed or a diagnostic naming what it could not establish — never a crash, never
// a stall, never a different answer on the second pass, and never a write to shared
// JavaScript prototypes.

const KNOWN_CODES: ParseDiagnosticCode[] = [
  'malformed-header',
  'ambiguous-path',
  'unrecognized-file-header',
  'malformed-hunk',
  'truncated-hunk',
  'hunk-count-mismatch',
  'unrecognized-hunk-header',
  'unsupported-dialect',
  'input-too-large',
];

const CANARIES = ['diffbeaconPolluted', 'calledOnPrototype', 'joinedArray'];

const hostileInputs: Array<[string, string]> = [
  [
    'prototype name as a path',
    'diff --git a/__proto__ b/__proto__\n--- a/__proto__\n+++ b/__proto__\n@@ -1 +1 @@\n-old\n+new',
  ],
  [
    'constructor chain as a path',
    'diff --git a/constructor.prototype/x b/constructor.prototype/x\n--- a/constructor.prototype/x\n+++ b/constructor.prototype/x\n@@ -1 +1 @@\n-old\n+new',
  ],
  [
    'JSON object literal as a path',
    'diff --git a/{"__proto__":{"diffbeaconPolluted":1}} b/{"__proto__":{"diffbeaconPolluted":1}}\n@@ -1 +1 @@\n-old\n+new',
  ],
  ['bare diff marker', 'diff --git'],
  ['unclosed quoted path', 'diff --git "a/spaced file.ts b/spaced file.ts\n--- a/x\n+++ b/x'],
  ['mismatched quote pair', 'diff --git "a/one.ts" "b/two.ts\n@@ -1 +1 @@'],
  ['no paths at all', 'diff --git a/ b/\n--- \n+++ \n@@'],
  ['lone hunk header', '@@ -1,2 +1,2 @@\n-a\n+b'],
  ['hunk body without any header', '--- a/f.ts\n+++ b/f.ts\n-not counted\n+counted'],
  [
    'absurd declared counts',
    'diff --git a/f.ts b/f.ts\n@@ -1,999999999999 +1,999999999999 @@\n-a\n+b',
  ],
  [
    'exponential notation counts',
    'diff --git a/f.ts b/f.ts\n--- a/f.ts\n+++ b/f.ts\n@@ -1,1e999 +1,1 @@\n-a\n+b',
  ],
  [
    'negative and fractional counts',
    'diff --git a/f.ts b/f.ts\n--- a/f.ts\n+++ b/f.ts\n@@ -1,-1 +1,2.5 @@\n-a\n+b',
  ],
  ['non-numeric modes', 'diff --git a/f.ts b/f.ts\nold mode octal\nnew mode 99999999999999999999'],
  [
    'unterminated rename metadata',
    'diff --git a/a.ts b/b.ts\nsimilarity index not-a-number\nrename from a.ts',
  ],
  [
    'binary payload followed by garbage',
    'diff --git a/f.bin b/f.bin\nBinary files a/f.bin and b/f.bin differ\nZm9vYmFy\n\x00\x01\x02garbage',
  ],
  [
    'NUL and control bytes',
    'diff --git a/be\x00tween b/be\x00tween\n\x01\x02\x03@@ -1 +1 @@\n-a\x04\n+b\x1b[31m',
  ],
  [
    'lone surrogate',
    'diff --git a/broken\ud800.ts b/broken\ud800.ts\n--- a/broken\ud800.ts\n+++ b/broken\ud800.ts\n@@ -1 +1 @@\n-\udbff\n+\udffe',
  ],
  ['no-newline marker alone', '\\ No newline at end of file'],
  ['only new-side markers', '+++ b/f.ts\n@@@ nested\n++ double'],
  ['truncated after old header', 'diff --git a/f.ts b/f.ts\n--- a/f.ts'],
  ['truncated mid-hunk', 'diff --git a/f.ts b/f.ts\n--- a/f.ts\n+++ b/f.ts\n@@ -1,50 +1,50 @@\n-a'],
  ['repeated headers with no body', 'diff --git a/f.ts b/f.ts\n'.repeat(200)],
  ['one enormous single line', `+${'x'.repeat(1024 * 1024)}`],
  ['hunk header flood', Array.from({ length: 5_000 }, () => '@@ -1 +1 @@').join('\n')],
  [
    'interleaved dialect markers',
    'diff --cc f.ts\n@@@ -1,2 -1,2 +1,2 @@@\n--a\n++b\n copy from x\ncopy to y\nrename to z\nsimilarity index 0%',
  ],
];

function expectInert(input: string): ParsedDiff {
  const parsed = parseUnifiedDiff(input);

  expect(Array.isArray(parsed.files)).toBe(true);
  expect(Array.isArray(parsed.diagnostics)).toBe(true);
  for (const file of parsed.files) {
    expect(Object.getPrototypeOf(file)).toBe(Object.prototype);
    expect(FILE_STATUSES).toContain(file.status);
    expect(typeof file.displayPath).toBe('string');
    expect(Number.isInteger(file.additions) || file.additions === null).toBe(true);
    expect(Number.isInteger(file.deletions) || file.deletions === null).toBe(true);
    if (file.additions !== null) expect(file.additions).toBeGreaterThanOrEqual(0);
    if (file.deletions !== null) expect(file.deletions).toBeGreaterThanOrEqual(0);
    expect(file.surfaces.every((surface) => SURFACE_IDS.includes(surface))).toBe(true);
  }
  for (const diagnostic of parsed.diagnostics) {
    expect(KNOWN_CODES).toContain(diagnostic.code);
    expect(diagnostic.message.length).toBeGreaterThan(0);
    expect(Number.isSafeInteger(diagnostic.line)).toBe(true);
    expect(diagnostic.line).toBeGreaterThanOrEqual(1);
  }
  return parsed;
}

describe('hostile malformed input stays data', () => {
  it.each(hostileInputs)(
    'parses %s to a stable, self-describing result',
    (label, input) => {
      expect(() => parseUnifiedDiff(input)).not.toThrow();
      const first = expectInert(input);
      const second = expectInert(input);
      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
      expect(() => analyzeDiff(input)).not.toThrow();
    },
    20_000,
  );

  it('never writes to shared prototypes while parsing the corpus', () => {
    for (const [, input] of hostileInputs) {
      parseUnifiedDiff(input);
    }
    for (const canary of CANARIES) {
      expect((Object.prototype as Record<string, unknown>)[canary]).toBeUndefined();
      expect((Array.prototype as unknown as Record<string, unknown>)[canary]).toBeUndefined();
      expect((String.prototype as unknown as Record<string, unknown>)[canary]).toBeUndefined();
    }
    expect(({} as Record<string, unknown>)['diffbeaconPolluted']).toBeUndefined();
    expect(([] as unknown as Record<string, unknown>)['calledOnPrototype']).toBeUndefined();
    expect(('x' as unknown as Record<string, unknown>)['joinedArray']).toBeUndefined();
    expect(JSON.parse('{"a":1}').a).toBe(1);
  });

  it('keeps a `__proto__` filename a literal path instead of an inherited lookup', () => {
    const parsed = expectInert(
      'diff --git a/__proto__ b/__proto__\n--- a/__proto__\n+++ b/__proto__\n@@ -1 +1 @@\n-old\n+new',
    );
    expect(parsed.files).toHaveLength(1);
    expect(parsed.files[0]?.displayPath).toBe('__proto__');
    expect(parsed.files[0]?.status).toBe('modified');
  });

  it('keeps hostile text inert through every renderer', () => {
    for (const [, input] of hostileInputs) {
      const report = analyzeDiff(input);
      expect(() => renderJson(report)).not.toThrow();
      expect(() => renderMarkdown(report)).not.toThrow();
      expect(renderPretty(report)).not.toContain('\u001b');
      expect(JSON.parse(renderJson(report)).schemaVersion).toBe('1');
    }
  });

  it('refuses oversized hostile input before touching it', () => {
    const parsed = expectInert(`diff --git a/f.ts b/f.ts\n${'x'.repeat(9 * 1024 * 1024)}`);
    expect(parsed.files).toEqual([]);
    expect(parsed.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(['input-too-large']);
  });
});
