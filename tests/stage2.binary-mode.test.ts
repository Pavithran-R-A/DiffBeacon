import { describe, expect, it } from 'vitest';
import { parseUnifiedDiff } from '../packages/core/src/index.js';
import type { ParsedDiff } from '../packages/core/src/model.js';

// Stage 2 (Phase 7): `binary` and `modeOnly` are orthogonal to status, and a mode
// change only earns the mode-only label when the patch shows nothing else. A
// binary payload is never countable as changed lines, so its tallies stay null.

const codes = (parsed: ParsedDiff) => parsed.diagnostics.map((diagnostic) => diagnostic.code);

describe('mode changes', () => {
  it('reports mode-only only when nothing else changed', () => {
    const parsed = parseUnifiedDiff(
      'diff --git a/run.sh b/run.sh\nold mode 100644\nnew mode 100755',
    );
    expect(codes(parsed)).toEqual([]);
    expect(parsed.files[0]).toMatchObject({
      status: 'mode-only',
      modeOnly: true,
      binary: false,
      oldMode: '100644',
      newMode: '100755',
      additions: null,
      deletions: null,
    });
  });

  it('keeps a mode change that also changes text bytes labelled modified', () => {
    const parsed = parseUnifiedDiff(
      [
        'diff --git a/run.sh b/run.sh',
        'old mode 100644',
        'new mode 100755',
        '--- a/run.sh',
        '+++ b/run.sh',
        '@@ -1 +1 @@',
        '-echo one',
        '+echo two',
      ].join('\n'),
    );
    expect(codes(parsed)).toEqual([]);
    expect(parsed.files[0]).toMatchObject({
      status: 'modified',
      modeOnly: false,
      oldMode: '100644',
      newMode: '100755',
      additions: 1,
      deletions: 1,
    });
  });

  it('does not call a mode change on a binary payload mode-only', () => {
    const parsed = parseUnifiedDiff(
      [
        'diff --git a/tool.bin b/tool.bin',
        'old mode 100644',
        'new mode 100755',
        'Binary files a/tool.bin and b/tool.bin differ',
      ].join('\n'),
    );
    expect(codes(parsed)).toEqual([]);
    expect(parsed.files[0]).toMatchObject({
      status: 'modified',
      modeOnly: false,
      binary: true,
      oldMode: '100644',
      newMode: '100755',
      additions: null,
      deletions: null,
    });
  });

  it('keeps a renamed binary mode change labelled renamed', () => {
    const parsed = parseUnifiedDiff(
      [
        'diff --git a/old.bin b/new.bin',
        'old mode 100644',
        'new mode 100755',
        'similarity index 100%',
        'rename from old.bin',
        'rename to new.bin',
        'Binary files a/old.bin and b/new.bin differ',
      ].join('\n'),
    );
    expect(codes(parsed)).toEqual([]);
    expect(parsed.files[0]).toMatchObject({
      status: 'renamed',
      modeOnly: false,
      binary: true,
      oldPath: 'old.bin',
      newPath: 'new.bin',
      additions: null,
      deletions: null,
    });
  });
});

describe('binary payloads', () => {
  it('keeps line tallies null even when text hunks follow the binary marker', () => {
    const parsed = parseUnifiedDiff(
      [
        'diff --git a/mixed.bin b/mixed.bin',
        '--- a/mixed.bin',
        '+++ b/mixed.bin',
        'Binary files a/mixed.bin and b/mixed.bin differ',
        '@@ -1 +1 @@',
        '-one',
        '+two',
      ].join('\n'),
    );
    expect(codes(parsed)).toEqual([]);
    expect(parsed.files[0]).toMatchObject({
      status: 'modified',
      binary: true,
      modeOnly: false,
      additions: null,
      deletions: null,
    });
  });

  it('marks a GIT binary patch payload binary without a path line', () => {
    const parsed = parseUnifiedDiff(
      [
        'diff --git a/pic.png b/pic.png',
        'index 0dfa3c9..6ba9ec4 100644',
        'GIT binary patch',
        'literal 0',
        'HcmV?d00001',
        '',
        'literal 104',
        'zc$}7dR|7z^17A0{1;L=41$Cqf3^<l60pQ+01!C-R6F=Kb',
      ].join('\n'),
    );
    expect(codes(parsed)).toEqual([]);
    expect(parsed.files[0]).toMatchObject({
      status: 'modified',
      binary: true,
      oldPath: 'pic.png',
      newPath: 'pic.png',
      additions: null,
      deletions: null,
    });
  });
});
