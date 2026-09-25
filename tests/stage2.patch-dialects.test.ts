import { describe, expect, it } from 'vitest';
import { parseUnifiedDiff } from '../packages/core/src/index.js';
import type { ParsedDiff } from '../packages/core/src/model.js';

// Stage 2 (Phase 10): copy detection and combined merge diffs are outside the
// supported patch vector, which runs `git diff <base>...<head>` and therefore only
// ever produces ordinary two-parent unified diffs. The parser has to name that
// limitation instead of quietly reading these forms as something it does support.

const codes = (parsed: ParsedDiff) => parsed.diagnostics.map((diagnostic) => diagnostic.code);

// Captured from `git log -1 -p --cc` on a conflicted merge (probe3 evidence).
const REAL_COMBINED_CC = [
  'diff --cc both.txt',
  'index abd82df,846f043..e683dac',
  '--- a/both.txt',
  '+++ b/both.txt',
  '@@@ -1,1 -1,1 +1,5 @@@',
  '++<<<<<<< HEAD',
  ' +main version',
  '++=======',
  '+ side version',
  '++>>>>>>> 506af10d5ad401ceaf6758c883b230239e8ebd6a',
].join('\n');

// Captured from `git log -1 -p --diff-merges=combined` on the same merge.
const REAL_COMBINED_FULL = [
  'diff --combined both.txt',
  'index abd82df,846f043..e683dac',
  '--- a/both.txt',
  '+++ b/both.txt',
  '@@@ -1,1 -1,1 +1,5 @@@',
  '++<<<<<<< HEAD',
  ' +main version',
  '++=======',
  '+ side version',
  '++>>>>>>> 506af10d5ad401ceaf6758c883b230239e8ebd6a',
].join('\n');

describe('combined merge diffs', () => {
  it('names the limitation instead of reporting a combined diff as empty', () => {
    for (const input of [REAL_COMBINED_CC, REAL_COMBINED_FULL]) {
      const parsed = parseUnifiedDiff(input);
      expect(codes(parsed)).toEqual(['unsupported-dialect']);
      expect(parsed.diagnostics[0]).toMatchObject({ line: 1 });
      expect(parsed.files).toEqual([]);
    }
  });

  it('resumes normal parsing at the next diff --git block', () => {
    const parsed = parseUnifiedDiff(
      `${REAL_COMBINED_CC}\ndiff --git a/later.ts b/later.ts\n--- a/later.ts\n+++ b/later.ts\n@@ -1 +1 @@\n-a\n+b`,
    );
    expect(codes(parsed)).toEqual(['unsupported-dialect']);
    expect(parsed.files).toHaveLength(1);
    expect(parsed.files[0]).toMatchObject({
      displayPath: 'later.ts',
      status: 'modified',
      additions: 1,
      deletions: 1,
    });
  });

  it('keeps a diff --cc line inside a hunk as content', () => {
    const parsed = parseUnifiedDiff(
      [
        'diff --git a/notes.md b/notes.md',
        '--- a/notes.md',
        '+++ b/notes.md',
        '@@ -1,2 +1,3 @@',
        ' keep',
        '+diff --cc not-a-real-file',
        ' also keep',
      ].join('\n'),
    );
    expect(codes(parsed)).toEqual([]);
    expect(parsed.files[0]).toMatchObject({
      displayPath: 'notes.md',
      additions: 1,
      deletions: 0,
    });
  });

  it('parses a merge resolved to an ordinary range diff without a diagnostic', () => {
    // Captured from `git diff <merge-base> <merge>` — what the shipped vector sees.
    const parsed = parseUnifiedDiff(
      [
        'diff --git a/both.txt b/both.txt',
        'index abd82df..e683dac 100644',
        '--- a/both.txt',
        '+++ b/both.txt',
        '@@ -1 +1,5 @@',
        '+<<<<<<< HEAD',
        ' main version',
        '+=======',
        '+side version',
        '+>>>>>>> 506af10d5ad401ceaf6758c883b230239e8ebd6a',
      ].join('\n'),
    );
    expect(codes(parsed)).toEqual([]);
    expect(parsed.files[0]).toMatchObject({
      status: 'modified',
      additions: 4,
      deletions: 0,
    });
  });
});

describe('copy detection diffs', () => {
  const COPY_BLOCK = [
    'diff --git a/copy-src.txt b/copy-dst.txt',
    'similarity index 95%',
    'copy from copy-src.txt',
    'copy to copy-dst.txt',
    '--- a/copy-src.txt',
    '+++ b/copy-dst.txt',
    '@@ -1 +1 @@',
    '-source',
    '+destination',
  ].join('\n');

  it('does not reinterpret a copied file as a rename', () => {
    const parsed = parseUnifiedDiff(COPY_BLOCK);
    expect(codes(parsed)).toEqual(['unsupported-dialect']);
    expect(parsed.diagnostics[0]).toMatchObject({ line: 3 });
    expect(parsed.files[0]).toMatchObject({
      status: 'added',
      oldPath: null,
      newPath: 'copy-dst.txt',
      displayPath: 'copy-dst.txt',
      similarity: 95,
    });
  });

  it('keeps rename metadata working as the supported same-path dialect', () => {
    const parsed = parseUnifiedDiff(
      [
        'diff --git a/rename-src.txt b/rename-dst.txt',
        'similarity index 95%',
        'rename from rename-src.txt',
        'rename to rename-dst.txt',
        '--- a/rename-src.txt',
        '+++ b/rename-dst.txt',
        '@@ -1 +1 @@',
        '-source',
        '+destination',
      ].join('\n'),
    );
    expect(codes(parsed)).toEqual([]);
    expect(parsed.files[0]).toMatchObject({
      status: 'renamed',
      oldPath: 'rename-src.txt',
      newPath: 'rename-dst.txt',
      similarity: 95,
      additions: 1,
      deletions: 1,
    });
  });
});
