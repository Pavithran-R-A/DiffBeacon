import { describe, expect, it } from 'vitest';
import { parseUnifiedDiff } from '../packages/core/src/index.js';
import type { ParsedDiff } from '../packages/core/src/model.js';

// Stage 2 (Phase 6): Git quotes a path in a `diff --git` / `Binary files` line only
// for control and non-ASCII characters, so spaces and literal `b/` segments stay
// unquoted and the line can be decomposed several ways. The parser may report a
// path only when exactly one decomposition is provable; otherwise it has to say
// so instead of publishing a guess.

const codes = (parsed: ParsedDiff) => parsed.diagnostics.map((diagnostic) => diagnostic.code);

const withBinaryPair = (pair: string) => `diff --git a/x.bin b/x.bin\nBinary files ${pair} differ`;

describe('diff --git path pairs', () => {
  it('accepts a single unquoted split even when the names differ', () => {
    const parsed = parseUnifiedDiff('diff --git a/old.txt b/new.txt');
    expect(codes(parsed)).toEqual([]);
    expect(parsed.files[0]).toMatchObject({
      oldPath: 'old.txt',
      newPath: 'new.txt',
      displayPath: 'new.txt',
    });
  });

  it('resolves a path that contains a literal b/ segment', () => {
    const parsed = parseUnifiedDiff('diff --git a/dir b/image.bin b/dir b/image.bin');
    expect(codes(parsed)).toEqual([]);
    expect(parsed.files[0]).toMatchObject({
      oldPath: 'dir b/image.bin',
      newPath: 'dir b/image.bin',
    });
  });

  it('resolves a spaced path that Git leaves unquoted', () => {
    const parsed = parseUnifiedDiff('diff --git a/rename src/one.txt b/rename src/two.txt');
    expect(codes(parsed)).toEqual([]);
    expect(parsed.files[0]).toMatchObject({
      oldPath: 'rename src/one.txt',
      newPath: 'rename src/two.txt',
    });
  });

  it('reports ambiguity instead of guessing when several splits stay possible', () => {
    const parsed = parseUnifiedDiff('diff --git a/one.txt b/two.txt b/three.txt');
    expect(codes(parsed)).toEqual(['ambiguous-path']);
    expect(parsed.files[0]).toMatchObject({
      oldPath: null,
      newPath: null,
      displayPath: '<unknown path>',
    });
  });

  it('prefers exact metadata paths while still reporting an ambiguous header', () => {
    const parsed = parseUnifiedDiff(
      [
        'diff --git a/one.txt b/two.txt b/three.txt',
        'similarity index 92%',
        'rename from one.txt',
        'rename to three.txt',
      ].join('\n'),
    );
    expect(codes(parsed)).toEqual(['ambiguous-path']);
    expect(parsed.diagnostics[0]).toMatchObject({ line: 1 });
    expect(parsed.files[0]).toMatchObject({
      status: 'renamed',
      oldPath: 'one.txt',
      newPath: 'three.txt',
      displayPath: 'three.txt',
    });
  });

  it('prefers exact --- and +++ paths while still reporting an ambiguous header', () => {
    const parsed = parseUnifiedDiff(
      'diff --git a/one.txt b/two.txt b/three.txt\n--- a/one.txt\n+++ b/three.txt',
    );
    expect(codes(parsed)).toEqual(['ambiguous-path']);
    expect(parsed.files[0]).toMatchObject({ oldPath: 'one.txt', newPath: 'three.txt' });
  });

  it('decodes a quoted pair that carries spaces', () => {
    const parsed = parseUnifiedDiff('diff --git "a/two words.ts" "b/two words.ts"');
    expect(codes(parsed)).toEqual([]);
    expect(parsed.files[0]).toMatchObject({ oldPath: 'two words.ts', newPath: 'two words.ts' });
  });

  it('rejects /dev/null in the leading diff --git pair', () => {
    for (const input of [
      'diff --git /dev/null b/new.ts',
      'diff --git a/old.ts /dev/null',
      'diff --git "/dev/null" "b/new.ts"',
      'diff --git "a/old.ts" "/dev/null"',
    ]) {
      const parsed = parseUnifiedDiff(input);
      expect(codes(parsed), input).toEqual(['malformed-header']);
      expect(parsed.files[0], input).toMatchObject({
        oldPath: null,
        newPath: null,
        displayPath: '<unknown path>',
      });
    }
  });

  it('keeps impossible C-style octal escapes literal instead of wrapping them to a byte', () => {
    const parsed = parseUnifiedDiff('diff --git "a/src/x\\777.ts" "b/src/x\\777.ts"');
    expect(codes(parsed)).toEqual([]);
    expect(parsed.files[0]?.displayPath).toBe('src/x\\777.ts');
    expect(parsed.files[0]?.displayPath).not.toContain('\uFFFD');
  });

  it('reports a malformed header when a quoted path is never closed', () => {
    const parsed = parseUnifiedDiff('diff --git "a/broken.ts b/broken.ts');
    expect(codes(parsed)).toEqual(['malformed-header']);
  });

  it('reports a malformed header when the second quoted path is never closed', () => {
    const parsed = parseUnifiedDiff('diff --git "a/one.ts" "b/two.ts');
    expect(codes(parsed)).toEqual(['malformed-header']);
    expect(parsed.files[0]?.displayPath).toBe('<unknown path>');
  });

  it('rejects trailing text after a complete quoted path pair', () => {
    const parsed = parseUnifiedDiff('diff --git "a/one.ts" "b/two.ts" trailing');
    expect(codes(parsed)).toEqual(['malformed-header']);
    expect(parsed.files[0]?.displayPath).toBe('<unknown path>');
  });

  it('requires quoted diff --git paths to identify their old and new sides', () => {
    const parsed = parseUnifiedDiff('diff --git "one.ts" "two.ts"');
    expect(codes(parsed)).toEqual(['malformed-header']);
    expect(parsed.files[0]?.displayPath).toBe('<unknown path>');
  });

  it('drops the trailing timestamp of a context-diff header', () => {
    const parsed = parseUnifiedDiff(
      [
        'diff --git a/f.ts b/f.ts',
        '--- a/f.ts\t2026-01-01 00:00:00.000000000 +0000',
        '+++ b/f.ts\t2026-01-02 00:00:00.000000000 +0000',
        '@@ -1 +1 @@',
        '-a',
        '+b',
      ].join('\n'),
    );
    expect(codes(parsed)).toEqual([]);
    expect(parsed.files[0]).toMatchObject({ oldPath: 'f.ts', newPath: 'f.ts' });
  });
});

describe('Binary files path pairs', () => {
  it('recovers a filename whose own text contains " and "', () => {
    const parsed = parseUnifiedDiff(
      'diff --git a/has and inside.bin b/has and inside.bin\n' +
        'Binary files a/has and inside.bin and b/has and inside.bin differ',
    );
    expect(codes(parsed)).toEqual([]);
    expect(parsed.files[0]).toMatchObject({
      oldPath: 'has and inside.bin',
      newPath: 'has and inside.bin',
      displayPath: 'has and inside.bin',
      binary: true,
    });
  });

  it('keeps the /dev/null side null for added and deleted binaries', () => {
    const added = parseUnifiedDiff(
      'diff --git a/new.bin b/new.bin\nnew file mode 100644\nBinary files /dev/null and b/new.bin differ',
    );
    expect(codes(added)).toEqual([]);
    expect(added.files[0]).toMatchObject({ oldPath: null, newPath: 'new.bin', status: 'added' });

    const deleted = parseUnifiedDiff(
      'diff --git a/old.bin b/old.bin\ndeleted file mode 100644\nBinary files a/old.bin and /dev/null differ',
    );
    expect(codes(deleted)).toEqual([]);
    expect(deleted.files[0]).toMatchObject({
      oldPath: 'old.bin',
      newPath: null,
      status: 'deleted',
    });
  });

  it('decodes quoted binary paths and quoted /dev/null companions without a false diagnostic', () => {
    const unicode = parseUnifiedDiff(
      'diff --git "a/\\303\\251.bin" "b/\\303\\251.bin"\n' +
        'Binary files "a/\\303\\251.bin" and "b/\\303\\251.bin" differ',
    );
    expect(codes(unicode)).toEqual([]);
    expect(unicode.files[0]).toMatchObject({
      oldPath: 'é.bin',
      newPath: 'é.bin',
      displayPath: 'é.bin',
      binary: true,
    });

    const added = parseUnifiedDiff(
      'diff --git "a/\\303\\251.bin" "b/\\303\\251.bin"\n' +
        'new file mode 100644\n' +
        'Binary files /dev/null and "b/\\303\\251.bin" differ',
    );
    expect(codes(added)).toEqual([]);
    expect(added.files[0]).toMatchObject({
      oldPath: null,
      newPath: 'é.bin',
      status: 'added',
      binary: true,
    });
  });

  it('does not treat trailing junk as part of a Binary files destination path', () => {
    const parsed = parseUnifiedDiff(
      'diff --git a/x.bin b/x.bin\nBinary files a/x.bin and b/x.bin not-differ',
    );
    expect(codes(parsed)).toEqual(['ambiguous-path']);
    expect(parsed.files[0]).toMatchObject({
      oldPath: 'x.bin',
      newPath: 'x.bin',
      displayPath: 'x.bin',
      binary: true,
    });
  });

  it('does not invent a path from an unprovable binary pair', () => {
    const parsed = parseUnifiedDiff(withBinaryPair('a/x.bin and y.bin'));
    expect(codes(parsed)).toEqual(['ambiguous-path']);
    expect(parsed.diagnostics[0]).toMatchObject({ line: 2 });
    expect(parsed.files[0]).toMatchObject({
      oldPath: 'x.bin',
      newPath: 'x.bin',
      binary: true,
    });
  });

  it('treats a Binary files line inside a hunk as content, not a path source', () => {
    const parsed = parseUnifiedDiff(
      [
        'diff --git a/notes.txt b/notes.txt',
        '--- a/notes.txt',
        '+++ b/notes.txt',
        '@@ -1,2 +1,3 @@',
        ' keep',
        '+Binary files a/fake.bin and b/fake.bin differ',
        ' also keep',
      ].join('\n'),
    );
    expect(codes(parsed)).toEqual([]);
    expect(parsed.files[0]).toMatchObject({
      oldPath: 'notes.txt',
      newPath: 'notes.txt',
      binary: false,
      additions: 1,
      deletions: 0,
    });
  });
});

// A bare `a/` or `b/` prefix names no file, and Git never emits one. Reporting the
// empty string as a proven path would publish a fact the header does not contain, so
// these forms have to land in the same bucket as any other unreadable header.
describe('file headers that name no path', () => {
  it('reports an unprovable header instead of a file at the empty path', () => {
    const parsed = parseUnifiedDiff('diff --git a/ b/');
    expect(codes(parsed)).toEqual(['malformed-header']);
    expect(parsed.files[0]).toMatchObject({
      oldPath: null,
      newPath: null,
      displayPath: '<unknown path>',
    });
  });

  it('reports an unprovable quoted header the same way', () => {
    const parsed = parseUnifiedDiff('diff --git "a/" "b/"');
    expect(codes(parsed)).toEqual(['malformed-header']);
    expect(parsed.files[0]?.displayPath).toBe('<unknown path>');
  });

  it('reports an unprovable binary pair that names only prefixes', () => {
    const parsed = parseUnifiedDiff(withBinaryPair('a/ and b/'));
    expect(codes(parsed)).toEqual(['ambiguous-path']);
    expect(parsed.files[0]?.displayPath).toBe('x.bin');
    expect(parsed.files[0]?.binary).toBe(true);
  });

  it('keeps a real path that only starts with a directory-like segment', () => {
    const parsed = parseUnifiedDiff('diff --git a/a.txt b/a.txt\n--- a/a.txt\n+++ b/a.txt');
    expect(codes(parsed)).toEqual([]);
    expect(parsed.files[0]).toMatchObject({ oldPath: 'a.txt', newPath: 'a.txt' });
  });

  it('keeps a /dev/null side honest rather than treating it as empty', () => {
    const parsed = parseUnifiedDiff(
      'diff --git a/n.ts b/n.ts\nnew file mode 100644\n--- /dev/null\n+++ b/n.ts\n@@ -0,0 +1 @@\n+a',
    );
    expect(codes(parsed)).toEqual([]);
    expect(parsed.files[0]).toMatchObject({ status: 'added', oldPath: null, newPath: 'n.ts' });
  });

  it('reports an empty --- header without erasing a path already proven', () => {
    const parsed = parseUnifiedDiff(
      'diff --git a/f.ts b/f.ts\n--- \n+++ b/f.ts\n@@ -1 +1 @@\n-a\n+b',
    );
    expect(codes(parsed)).toEqual(['malformed-header']);
    expect(parsed.diagnostics[0]).toMatchObject({ line: 2 });
    expect(parsed.files[0]).toMatchObject({
      status: 'modified',
      oldPath: 'f.ts',
      newPath: 'f.ts',
      additions: 1,
      deletions: 1,
    });
  });

  it('reports a diff --git line truncated to the bare token', () => {
    const parsed = parseUnifiedDiff('diff --git');
    expect(codes(parsed)).toEqual(['malformed-header']);
    expect(parsed.diagnostics[0]).toMatchObject({ line: 1 });
    expect(parsed.files[0]).toMatchObject({ displayPath: '<unknown path>' });
  });

  it('reports a truncated header that follows a complete file block', () => {
    const parsed = parseUnifiedDiff(
      'diff --git a/f.ts b/f.ts\n--- a/f.ts\n+++ b/f.ts\n@@ -1 +1 @@\n-a\n+b\ndiff --git',
    );
    expect(codes(parsed)).toEqual(['malformed-header']);
    expect(parsed.diagnostics[0]).toMatchObject({ line: 7 });
    expect(parsed.files.map((file) => file.displayPath)).toEqual(['f.ts', '<unknown path>']);
  });

  it('treats a diff --git hunk line as content, not a header', () => {
    const parsed = parseUnifiedDiff(
      'diff --git a/f.txt b/f.txt\n--- a/f.txt\n+++ b/f.txt\n@@ -0,0 +1,1 @@\n+diff --git',
    );
    expect(codes(parsed)).toEqual([]);
    expect(parsed.files).toHaveLength(1);
    expect(parsed.files[0]).toMatchObject({ additions: 1, deletions: 0 });
  });
});
