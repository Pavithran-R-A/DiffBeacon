/**
 * Stage 8, PHASES 7 and 8: the JSON report and the object shapes it is built from.
 * A hostile path is a value in DiffBeacon's output, never a key, so these cases prove
 * two things at once — the round-trip keeps the raw name byte-for-byte, and nothing in
 * the corpus can reach a prototype.
 */

import { describe, expect, it } from 'vitest';
import {
  SURFACE_IDS,
  analyzeDiff,
  parseUnifiedDiff,
  renderJson,
  renderMarkdown,
  renderPretty,
} from '../packages/core/src/index.js';
import {
  MIXED_UNICODE_PATHS,
  OBJECT_SHAPE_PATHS,
  diffForPath,
  diffForPaths,
} from './stage8.hostile-corpus.js';

/** A canary on each prototype a hostile key name claims to be able to reach. */
function plantCanaries(): () => void {
  const owned = [Object.prototype, Array.prototype, String.prototype] as const;
  const before = owned.map((prototype) => Object.getOwnPropertyNames(prototype));
  return () => {
    owned.forEach((prototype, index) => {
      expect(Object.getOwnPropertyNames(prototype)).toEqual(before[index] as string[]);
    });
  };
}

const reportFor = (paths: readonly string[]) => analyzeDiff(diffForPaths(paths));

describe('the JSON contract under hostile names', () => {
  it('round-trips every object-shape name without editing it', () => {
    const report = reportFor(OBJECT_SHAPE_PATHS);
    const text = renderJson(report);
    const reparsed = JSON.parse(text) as typeof report;
    expect(reparsed).toEqual(report);
    // The report orders files by the Stage 4 reading policy, so the claim to test here is
    // that the names survive, not that they keep the order the patch happened to use.
    expect(reparsed.files.map((file) => file.displayPath).sort()).toEqual(
      [...OBJECT_SHAPE_PATHS].sort(),
    );
  });

  it('keeps an owned __proto__ key from the event JSON off the prototype chain', () => {
    const polluted = JSON.parse('{"__proto__":{"canary":true},"pull_request":{}}') as Record<
      string,
      unknown
    >;
    expect(Object.prototype.hasOwnProperty.call(polluted, '__proto__')).toBe(true);
    expect(({} as Record<string, unknown>).canary).toBeUndefined();
    expect((polluted.pull_request as object) ?? null).not.toBe(Object.prototype);
  });

  it('leaves Object, Array and String prototypes untouched while analyzing the corpus', () => {
    const assertClean = plantCanaries();
    const report = reportFor([...OBJECT_SHAPE_PATHS, ...MIXED_UNICODE_PATHS]);
    renderJson(report);
    renderMarkdown(report);
    renderPretty(report, { color: false });
    parseUnifiedDiff(diffForPath('src/__proto__/polluted.ts'));
    assertClean();
  });

  it('names only surfaces the report vocabulary already fixes', () => {
    const known = new Set<string>(SURFACE_IDS);
    for (const path of [...OBJECT_SHAPE_PATHS, ...MIXED_UNICODE_PATHS])
      for (const file of reportFor([path]).files)
        for (const surface of file.surfaces)
          expect(known.has(surface), `${path} -> ${surface}`).toBe(true);
  });

  it('keeps the schema version the previous stages published', () => {
    expect(reportFor(OBJECT_SHAPE_PATHS).schemaVersion).toBe('1');
    expect(reportFor(MIXED_UNICODE_PATHS).schemaVersion).toBe('1');
  });
});
