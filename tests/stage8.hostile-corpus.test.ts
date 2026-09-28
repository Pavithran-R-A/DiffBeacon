/**
 * Stage 8, PHASE 2: one hostile corpus, reused by every later phase. The cases here guard
 * the corpus itself — an emptied class, an entry that outgrows its bound, a host that is not
 * a reserved one, or a name the parser cannot carry would silently weaken every phase that
 * reads from it, so the material is checked before it is trusted.
 */

import { describe, expect, it } from 'vitest';
import { MAX_DIFF_BYTES, analyzeDiff, parseUnifiedDiff } from '../packages/core/src/index.js';
import {
  BIDI_CONTROL_PATHS,
  CONTROL_CHAR_PATHS,
  HOSTILE_PATHS,
  MARKUP_LOOKING_PATHS,
  MIXED_UNICODE_PATHS,
  OBJECT_SHAPE_PATHS,
  PIPE_PATHS,
  SHELL_LOOKING_PATHS,
  TRAVERSAL_LOOKING_PATHS,
  diffForPath,
} from './stage8.hostile-corpus.js';

/** Each class exists to exercise one trust boundary; an empty class would exercise none. */
const classes: [string, readonly string[]][] = [
  ['shell-looking', SHELL_LOOKING_PATHS],
  ['markup-looking', MARKUP_LOOKING_PATHS],
  ['traversal-looking', TRAVERSAL_LOOKING_PATHS],
  ['object-shape', OBJECT_SHAPE_PATHS],
  ['terminal-control', CONTROL_CHAR_PATHS],
  ['bidi-control', BIDI_CONTROL_PATHS],
  ['mixed-unicode', MIXED_UNICODE_PATHS],
  ['pipe', PIPE_PATHS],
];

/** Bounded on purpose: a hostile name still has to fit in the fixtures a human reads. */
const MAX_ENTRY_BYTES = 200;

const bytes = (value: string): number => new TextEncoder().encode(value).length;

/** True when `value` can be named by a real Git path, which must be encodable in UTF-8. */
const representsUtf8Text = (value: string): boolean =>
  new TextDecoder().decode(new TextEncoder().encode(value)) === value;

const reservedHostSuffixes = ['.example', '.invalid', '.test', '.localhost'];

describe('the shared hostile corpus', () => {
  it('keeps every documented class populated', () => {
    for (const [name, entries] of classes) expect(entries.length, name).toBeGreaterThan(0);
    expect(HOSTILE_PATHS.length).toBe(
      SHELL_LOOKING_PATHS.length +
        MARKUP_LOOKING_PATHS.length +
        TRAVERSAL_LOOKING_PATHS.length +
        OBJECT_SHAPE_PATHS.length +
        CONTROL_CHAR_PATHS.length +
        BIDI_CONTROL_PATHS.length +
        MIXED_UNICODE_PATHS.length,
    );
  });

  it('keeps every entry bounded', () => {
    for (const [, entries] of classes)
      for (const entry of entries) {
        expect(bytes(entry), JSON.stringify(entry)).toBeLessThanOrEqual(MAX_ENTRY_BYTES);
        expect(entry.length, JSON.stringify(entry)).toBeGreaterThan(0);
      }
  });

  it('points only at hosts that can never resolve to a real service', () => {
    const hostPattern = /https?:\/\/([^/?#\p{Cc}]+)/gu;
    for (const [, entries] of classes)
      for (const entry of entries)
        for (const match of entry.matchAll(hostPattern)) {
          const host = match[1] as string;
          expect(
            reservedHostSuffixes.some((suffix) => host.endsWith(suffix)),
            `${entry} uses ${host}`,
          ).toBe(true);
        }
  });

  it('carries every hostile name through the parser as display data', () => {
    for (const entry of HOSTILE_PATHS.filter(representsUtf8Text)) {
      const parsed = parseUnifiedDiff(diffForPath(entry));
      expect(parsed.files, JSON.stringify(entry)).toHaveLength(1);
      const file = parsed.files[0] as (typeof parsed.files)[number];
      expect(file.newPath, JSON.stringify(entry)).toBe(entry);
      expect(file.displayPath, JSON.stringify(entry)).toBe(entry);
      expect(parsed.diagnostics, JSON.stringify(entry)).toEqual([]);
    }
  });

  it('shows the replacement character a lone surrogate cannot escape', () => {
    const lone = MIXED_UNICODE_PATHS.find((entry) => !representsUtf8Text(entry));
    expect(lone, 'the corpus keeps one unrepresentable name on purpose').toBeTypeOf('string');
    const parsed = parseUnifiedDiff(diffForPath(lone as string));
    // No UTF-8 byte sequence can hold a lone UTF-16 surrogate, so Git's own encoder turns it
    // into U+FFFD before DiffBeacon ever sees the name. The parser repeats what it was shown.
    expect((parsed.files[0] as (typeof parsed.files)[number]).displayPath).not.toBe(lone);
    expect((parsed.files[0] as (typeof parsed.files)[number]).displayPath).toContain('\ufffd');
  });

  it('analyzes the whole corpus in one bounded, deterministic pass', () => {
    const diff = HOSTILE_PATHS.map((entry) => diffForPath(entry)).join('');
    expect(bytes(diff)).toBeLessThan(MAX_DIFF_BYTES);
    const once = JSON.stringify(analyzeDiff(diff));
    expect(analyzeDiff(diff).files).toHaveLength(HOSTILE_PATHS.length);
    expect(JSON.stringify(analyzeDiff(diff))).toBe(once);
  });
});
