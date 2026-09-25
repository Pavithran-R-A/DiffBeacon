import { describe, expect, it } from 'vitest';
import { analyzeDiff, parseUnifiedDiff, MAX_DIFF_BYTES } from '../packages/core/src/index.js';
import type { ParsedDiff } from '../packages/core/src/model.js';

// Stage 2 (Phase 8): the CLI and the browser page both check MAX_DIFF_BYTES before
// handing text to the core, but the exported parser itself has to refuse oversized
// input on its own — before it splits the string into lines, which is where the
// memory actually goes. The limit is measured in UTF-8 bytes, the same unit every
// ingress already uses, and never as a second magic number.

const PREFIX = 'diff --git a/f.ts b/f.ts\n--- a/f.ts\n+++ b/f.ts\n@@ -1 +1 @@\n-a\n+b';
const prefixBytes = new TextEncoder().encode(PREFIX).length;
const filler = (bytes: number) => 'x'.repeat(bytes);
const sizedTo = (bytes: number) => PREFIX + filler(bytes - prefixBytes);

const codes = (parsed: ParsedDiff) => parsed.diagnostics.map((diagnostic) => diagnostic.code);

describe('the bounded core parser', () => {
  it('parses input one byte below the shared limit', () => {
    const parsed = parseUnifiedDiff(sizedTo(MAX_DIFF_BYTES - 1));
    expect(codes(parsed)).toEqual([]);
    expect(parsed.files).toHaveLength(1);
  });

  it('parses input exactly at the shared limit', () => {
    const input = sizedTo(MAX_DIFF_BYTES);
    expect(new TextEncoder().encode(input).length).toBe(MAX_DIFF_BYTES);
    const parsed = parseUnifiedDiff(input);
    expect(codes(parsed)).toEqual([]);
    expect(parsed.files).toHaveLength(1);
  });

  it('refuses input one byte above the shared limit without parsing it', () => {
    const input = sizedTo(MAX_DIFF_BYTES + 1);
    const parsed = parseUnifiedDiff(input);
    expect(parsed.files).toEqual([]);
    expect(codes(parsed)).toEqual(['input-too-large']);
    expect(parsed.diagnostics[0]).toMatchObject({ line: 1 });
  });

  it('bounds a huge many-file input by bytes rather than by file count', () => {
    const block = `${PREFIX}\ndiff --git a/g.ts b/g.ts\n--- a/g.ts\n+++ b/g.ts\n@@ -1 +1 @@\n-c\n+d\n`;
    const parsed = parseUnifiedDiff(block.repeat(80_000));
    expect(codes(parsed)).toEqual(['input-too-large']);
    expect(parsed.files).toEqual([]);
  });

  it('keeps a wide but bounded input fully parseable', () => {
    const block = `${PREFIX}\n`;
    const parsed = parseUnifiedDiff(block.repeat(5_000));
    expect(codes(parsed)).toEqual([]);
    expect(parsed.files).toHaveLength(5_000);
    expect(parsed.files.every((file) => file.additions === 1 && file.deletions === 1)).toBe(true);
  });

  it('counts encoded bytes instead of UTF-16 code units', () => {
    // 2.7M multi-byte characters stay under the limit at three bytes each while
    // 2.9M of them cross it, even though both are far below it as code units.
    const header = 'diff --git a/f.ts b/f.ts\n--- a/f.ts\n+++ b/f.ts\n@@ -1 +1,2 @@\n-a\n+b';
    const within = parseUnifiedDiff(`${header}\n+${'世'.repeat(2_700_000)}`);
    expect(codes(within)).toEqual([]);
    const over = parseUnifiedDiff(`${header}\n+${'世'.repeat(2_900_000)}`);
    expect(codes(over)).toEqual(['input-too-large']);
  });

  it('lets analyzeDiff report the refusal as a diagnostic instead of a crash', () => {
    const report = analyzeDiff(sizedTo(MAX_DIFF_BYTES + 1));
    expect(report.summary.changedFiles).toBe(0);
    expect(report.summary.diagnostics).toBe(1);
    expect(report.files).toEqual([]);
  });

  it('states the shared limit in its own refusal', () => {
    const parsed = parseUnifiedDiff(sizedTo(MAX_DIFF_BYTES + 1));
    expect(parsed.diagnostics[0]?.message).toContain(String(MAX_DIFF_BYTES));
  });
});
