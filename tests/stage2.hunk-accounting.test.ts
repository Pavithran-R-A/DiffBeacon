import { describe, expect, it } from 'vitest';
import { parseUnifiedDiff } from '../packages/core/src/index.js';
import type { ParsedDiff } from '../packages/core/src/model.js';

// Stage 2 (Phases 4 and 5): the parser must account for every hunk it claims to
// have read. A `@@` header declares how many old and new lines follow, so a hunk
// that arrives short, long, or unparseable has to be reported instead of being
// presented as an authoritative tally of the change.

const fileWith = (hunkHeader: string, body: string[]) =>
  ['diff --git a/f.ts b/f.ts', '--- a/f.ts', '+++ b/f.ts', hunkHeader, ...body].join('\n');

const codes = (parsed: ParsedDiff) => parsed.diagnostics.map((diagnostic) => diagnostic.code);

describe('hunk accounting on well-formed input', () => {
  it('accepts a hunk whose declared counts are satisfied exactly', () => {
    const parsed = parseUnifiedDiff(fileWith('@@ -1,3 +1,4 @@', [' a', '-b', '+c', '+d', ' e']));
    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.files[0]).toMatchObject({ status: 'modified', additions: 2, deletions: 1 });
  });

  it('treats an omitted hunk count as one line', () => {
    expect(parseUnifiedDiff(fileWith('@@ -1 +1 @@', ['-a', '+b'])).diagnostics).toEqual([]);
    expect(parseUnifiedDiff(fileWith('@@ -1,2 +1 @@', [' a', '-b'])).diagnostics).toEqual([]);
  });

  it('accepts zero-count and added-file hunk header forms', () => {
    const added = parseUnifiedDiff(
      [
        'diff --git a/n.ts b/n.ts',
        'new file mode 100644',
        '--- /dev/null',
        '+++ b/n.ts',
        '@@ -0,0 +1,3 @@',
        '+a',
        '+b',
        '+c',
      ].join('\n'),
    );
    expect(added.diagnostics).toEqual([]);
    expect(added.files[0]).toMatchObject({ status: 'added', additions: 3, deletions: 0 });

    const deleted = parseUnifiedDiff(
      [
        'diff --git a/g.ts b/g.ts',
        'deleted file mode 100644',
        '--- a/g.ts',
        '+++ /dev/null',
        '@@ -1,2 +0,0 @@',
        '-a',
        '-b',
      ].join('\n'),
    );
    expect(deleted.diagnostics).toEqual([]);
    expect(deleted.files[0]).toMatchObject({ status: 'deleted', additions: 0, deletions: 2 });
  });

  it('keeps the trailing section heading of a hunk header', () => {
    const parsed = parseUnifiedDiff(
      fileWith('@@ -1,2 +1,2 @@ function compute(value: number) {', [' a', '-b', '+c']),
    );
    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.files[0]).toMatchObject({ additions: 1, deletions: 1 });
  });

  it('does not let the no-newline marker consume either side', () => {
    const parsed = parseUnifiedDiff(
      fileWith('@@ -1,2 +1,2 @@', [
        ' a',
        '-b',
        '\\ No newline at end of file',
        '+c',
        '\\ No newline at end of file',
      ]),
    );
    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.files[0]).toMatchObject({ additions: 1, deletions: 1 });
  });

  it('never counts hunk header lines as changed lines', () => {
    const parsed = parseUnifiedDiff(
      [
        'diff --git a/f.ts b/f.ts',
        '--- a/f.ts',
        '+++ b/f.ts',
        '@@ -1,1 +1,1 @@',
        '-a',
        '+b',
        '@@ -20,1 +20,1 @@',
        '-c',
        '+d',
      ].join('\n'),
    );
    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.files[0]).toMatchObject({ additions: 2, deletions: 2 });
  });

  it('keeps metadata-looking hunk content inert and correctly accounted', () => {
    const parsed = parseUnifiedDiff(
      fileWith('@@ -1,2 +1,2 @@', ['-a', '--- b/fake.ts', '+++ b/fake.ts', '+b']),
    );
    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.files[0]).toMatchObject({
      status: 'modified',
      oldPath: 'f.ts',
      newPath: 'f.ts',
      binary: false,
      modeOnly: false,
      similarity: null,
      additions: 2,
      deletions: 2,
    });
  });
});

describe('hunk accounting on truncated and mismatched input', () => {
  it('reports a hunk whose declared old side never arrives before end of input', () => {
    const parsed = parseUnifiedDiff(fileWith('@@ -1,3 +1,3 @@', [' a', '-b']));
    expect(codes(parsed)).toEqual(['truncated-hunk']);
    expect(parsed.diagnostics[0]).toMatchObject({ line: 4 });
    expect(parsed.files[0]).toMatchObject({ additions: 0, deletions: 1 });
  });

  it('reports a hunk whose declared new side is short', () => {
    const parsed = parseUnifiedDiff(fileWith('@@ -1,1 +1,3 @@', ['-a', '+b']));
    expect(codes(parsed)).toEqual(['truncated-hunk']);
    expect(parsed.files[0]).toMatchObject({ additions: 1, deletions: 1 });
  });

  it('reports extra body lines beyond the declared counts', () => {
    const parsed = parseUnifiedDiff(fileWith('@@ -1,1 +1,1 @@', ['-a', '+b', '+c', '+d']));
    expect(codes(parsed)).toEqual(['hunk-count-mismatch']);
    expect(parsed.files[0]).toMatchObject({ additions: 3, deletions: 1 });
  });

  it('closes a hunk at the next header and reports the earlier truncation', () => {
    const parsed = parseUnifiedDiff(
      [
        'diff --git a/f.ts b/f.ts',
        '--- a/f.ts',
        '+++ b/f.ts',
        '@@ -1,9 +1,9 @@',
        '-a',
        '@@ -20,1 +20,1 @@',
        '-c',
        '+d',
      ].join('\n'),
    );
    expect(codes(parsed)).toEqual(['truncated-hunk']);
    expect(parsed.diagnostics[0]).toMatchObject({ line: 4 });
    expect(parsed.files[0]).toMatchObject({ additions: 1, deletions: 2 });
  });

  it('closes a hunk when a new file starts before counts are satisfied', () => {
    const parsed = parseUnifiedDiff(
      [
        'diff --git a/f.ts b/f.ts',
        '--- a/f.ts',
        '+++ b/f.ts',
        '@@ -1,9 +1,9 @@',
        '-a',
        'diff --git a/g.ts b/g.ts',
        '--- a/g.ts',
        '+++ b/g.ts',
        '@@ -1,1 +1,1 @@',
        '-x',
        '+y',
      ].join('\n'),
    );
    expect(codes(parsed)).toEqual(['truncated-hunk']);
    expect(parsed.files.map((file) => file.displayPath)).toEqual(['f.ts', 'g.ts']);
    expect(parsed.files.map((file) => [file.additions, file.deletions])).toEqual([
      [0, 1],
      [1, 1],
    ]);
  });

  it('reports an absurd declared count without consuming extra work', () => {
    const parsed = parseUnifiedDiff(fileWith('@@ -1,999999999 +1,999999999 @@', ['-a', '+b']));
    expect(codes(parsed)).toEqual(['truncated-hunk']);
    expect(parsed.files[0]).toMatchObject({ additions: 1, deletions: 1 });
  });

  it('keeps a fully truncated hunk reportable as an uncertain file, not a clean one', () => {
    const parsed = parseUnifiedDiff(fileWith('@@ -5,4 +5,4 @@', []));
    expect(codes(parsed)).toEqual(['truncated-hunk']);
    expect(parsed.files[0]).toMatchObject({ status: 'modified', additions: 0, deletions: 0 });
  });
});

describe('malformed hunk headers', () => {
  it('reports a hunk header without a new-side position', () => {
    const parsed = parseUnifiedDiff(fileWith('@@ -1,3 @@', ['-a', '+b']));
    expect(codes(parsed)).toEqual(['malformed-hunk']);
    expect(parsed.diagnostics[0]).toMatchObject({ line: 4 });
    expect(parsed.files[0]).toMatchObject({ status: 'modified' });
  });

  it('reports a hunk header with non-numeric counts', () => {
    const parsed = parseUnifiedDiff(fileWith('@@ -a,1 +b,1 @@', ['-a', '+b']));
    expect(codes(parsed)).toEqual(['malformed-hunk']);
  });

  it('reports a hunk header with a negative declared count', () => {
    const parsed = parseUnifiedDiff(fileWith('@@ -1,-2 +1,2 @@', ['-a', '+b']));
    expect(codes(parsed)).toEqual(['malformed-hunk']);
  });

  it('reports an @@ line that carries no positions at all', () => {
    const parsed = parseUnifiedDiff(fileWith('@@ not a header @@', ['-a', '+b']));
    expect(codes(parsed)).toEqual(['malformed-hunk']);
  });

  it('treats an invalid @@ line inside a hunk as content rather than a new header', () => {
    const parsed = parseUnifiedDiff(
      fileWith('@@ -1,2 +1,2 @@', [' ctx', '@@ still inside the hunk', ' tail']),
    );
    expect(codes(parsed)).toEqual([]);
    expect(parsed.files[0]).toMatchObject({ additions: 0, deletions: 0 });
  });

  it('reports a hunk that never closes because its last lines were stripped', () => {
    const parsed = parseUnifiedDiff(
      fileWith('@@ -1,3 +1,3 @@', [' ctx', 'bare line without a prefix']),
    );
    expect(codes(parsed)).toEqual(['truncated-hunk']);
    expect(parsed.files[0]).toMatchObject({ additions: 0, deletions: 0 });
  });

  it('reports an orphan hunk header that has no file behind it', () => {
    const parsed = parseUnifiedDiff(['@@ -1,1 +1,1 @@', '-a', '+b'].join('\n'));
    expect(parsed.files).toEqual([]);
    expect(codes(parsed)).toEqual(['unrecognized-hunk-header']);
  });

  it('is deterministic across repeated parses of the same malformed input', () => {
    const inputs = [
      fileWith('@@ -1,3 +1,3 @@', [' a', '-b']),
      fileWith('@@ -1,-2 +1,2 @@', ['-a']),
      fileWith('@@ -1,1 +1,1 @@', ['-a', '+b', '+c']),
      fileWith('@@ broken @@', ['-a', '+b']),
    ];
    for (const input of inputs) {
      expect(JSON.stringify(parseUnifiedDiff(input))).toBe(JSON.stringify(parseUnifiedDiff(input)));
    }
  });
});
