/**
 * Stage 8 closure, Finding B (PHASES 5 and 6): Markdown is a human presentation surface, the same
 * kind of surface as the terminal report and the browser names, and Stage 8 gave both of those the
 * shared display-control policy. `renderMarkdown()` did not apply it to path presentation, so a
 * bidi override or a C1 control could still reach a reader through the GitHub Job Summary, while
 * JSON stayed, as it must, the raw factual record.
 *
 * These cases assert the presentation contract only: what Markdown is allowed to paint. The raw
 * path is asserted unchanged in `renderJson()` as well, because a presentation fix must not become
 * a data-model change.
 */

import { describe, expect, it } from 'vitest';
import {
  analyzeDiff,
  renderJson,
  renderMarkdown,
  renderPretty,
} from '../packages/core/src/index.js';
import {
  BIDI_CONTROL_PATHS,
  CONTROL_CHAR_PATHS,
  HOSTILE_PATHS,
  PIPE_PATHS,
  diffForPath,
  diffForPaths,
} from './stage8.hostile-corpus.js';
import {
  paintAsHumanSurface,
  representsUtf8Text,
  survivingControls,
} from './stage8.display-policy-oracle.js';

/** The presentation the shared policy owes a human surface, from the test-only oracle. */
function expectPainted(markdown: string, path: string): void {
  expect(markdown).toContain(paintAsHumanSurface(path, '\uFFFD'));
}

const markdownFor = (paths: readonly string[]): string =>
  renderMarkdown(analyzeDiff(diffForPaths(paths)));

/** The Changed-files row a single-path diff produced. */
function changedFileRow(markdown: string): string {
  const rows = markdown.split('\n').filter((line) => line.startsWith('| modified |'));
  expect(rows).toHaveLength(1);
  return rows[0] as string;
}

/**
 * The two human surfaces encode a name differently — Markdown escapes backtick, pipe and
 * backslash for GFM, the terminal prints them raw — so a parity check compares the letters and
 * the markers, which is exactly what the shared control policy decides. The exact encoding has
 * its own dedicated cases below.
 */
function paintedShape(value: string): string {
  return value.replaceAll('&#96;', '').replace(/[`|\\]/g, '');
}

describe('Markdown paints no explicit display control', () => {
  it('drops a right-to-left override from a Changed-files path', () => {
    const path = 'src/\u202ERLO.ts';
    const markdown = markdownFor([path]);
    expect(markdown).not.toContain('\u202E');
    expectPainted(markdown, path);
  });

  it('drops a C1 CSI introducer from a Changed-files path', () => {
    const path = 'src/\u009B[31mC1csi.ts';
    const markdown = markdownFor([path]);
    expect(markdown).not.toContain('\u009B');
    expectPainted(markdown, path);
  });

  it('drops a C1 OSC sequence and its terminator from a Changed-files path', () => {
    const path = 'src/\u009D0;http://example.invalid\u0007C1osc.ts';
    const markdown = markdownFor([path]);
    expect(markdown).not.toContain('\u009D');
    expect(markdown).not.toContain('\u0007');
    expectPainted(markdown, path);
  });

  it('does not let U+2028 paint a line break inside a Changed-files path', () => {
    const path = 'src/\u2028line.ts';
    const markdown = markdownFor([path]);
    expect(markdown).not.toContain('\u2028');
    expectPainted(markdown, path);
    // One row of the document: a separator that survived would split the row for a reader.
    expect(changedFileRow(markdown)).not.toContain('\u2028');
  });

  it('drops a bidi isolate pair from a Changed-files path', () => {
    const path = 'src/\u2066LRI\u2069.ts';
    const markdown = markdownFor([path]);
    expect(markdown).not.toContain('\u2066');
    expect(markdown).not.toContain('\u2069');
    expectPainted(markdown, path);
  });

  it('paints the same marker the terminal report paints where a control stood', () => {
    const path = 'src/\u007Fdel.ts';
    expect(changedFileRow(markdownFor([path]))).toContain('src/\uFFFDdel.ts');
    expect(renderPretty(analyzeDiff(diffForPath(path)))).toContain('src/\uFFFDdel.ts');
  });

  it('neutralises a control inside an evidence related-file name as well', () => {
    // `Observed in:` is built by a different call site than the table, so it needs its own proof.
    const path = 'src/\u202Ehidden-order.ts';
    const markdown = markdownFor([path]);
    const observed = markdown.split('\n').filter((line) => line.startsWith('Observed in: '));
    expect(observed.length).toBeGreaterThan(0);
    for (const line of observed) expect(line).not.toContain('\u202E');
  });

  it('keeps every display control out of the document across the hostile corpus', () => {
    const offenders: string[] = [];
    for (const path of HOSTILE_PATHS) {
      const findings = survivingControls(markdownFor([path]));
      if (findings.length > 0) offenders.push(`${JSON.stringify(path)} -> ${findings.join(', ')}`);
    }
    expect(offenders).toEqual([]);
  });

  it('agrees with the terminal renderer about the painted name for every corpus path', () => {
    const offenders: string[] = [];
    // The lone surrogate in this corpus is not a name either surface can print back, so the
    // parity it could check is already decided by the parser; see `representsUtf8Text` above.
    for (const path of HOSTILE_PATHS.filter(representsUtf8Text)) {
      const report = analyzeDiff(diffForPath(path));
      const neutralised = paintedShape(paintAsHumanSurface(path, '\uFFFD'));
      const markdown = paintedShape(markdownFor([path]));
      const pretty = paintedShape(renderPretty(report));
      if (!markdown.includes(neutralised) || !pretty.includes(neutralised))
        offenders.push(
          `${JSON.stringify(path)} -> markdown=${markdown.includes(neutralised)} terminal=${pretty.includes(
            neutralised,
          )}`,
        );
    }
    expect(offenders).toEqual([]);
  });
});

describe('ordinary text keeps its measured treatment', () => {
  it('keeps Arabic and Hebrew file names exactly as they are', () => {
    expect(markdownFor(['src/\u0627\u0644\u0633\u0644\u0627\u0645.ts'])).toContain(
      'src/\u0627\u0644\u0633\u0644\u0627\u0645.ts',
    );
    expect(markdownFor(['src/\u05E9\u05DC\u05D5\u05DD.ts'])).toContain(
      'src/\u05E9\u05DC\u05D5\u05DD.ts',
    );
  });

  it('keeps zero-width joiners, which the Stage 8 policy left alone on every surface', () => {
    const path = 'src/\u200B\u200C\u200Dzero.ts';
    expect(markdownFor([path])).toContain(path);
    expect(renderPretty(analyzeDiff(diffForPath(path)))).toContain(path);
  });
});

describe('JSON stays factual while Markdown paints', () => {
  it('keeps the original raw path in the machine-readable report', () => {
    const path = 'src/\u202ERLO \u009B\u2028.ts';
    const report = analyzeDiff(diffForPath(path));
    expect(report.files[0]?.displayPath).toBe(path);
    expect(JSON.parse(renderJson(report)).files[0].displayPath).toBe(path);
    expect(survivingControls(markdownFor([path]))).toEqual([]);
  });

  it('keeps every raw corpus path byte-for-byte in JSON while its Markdown is neutralised', () => {
    const offenders: string[] = [];
    const paths = [...HOSTILE_PATHS, ...PIPE_PATHS, ...BIDI_CONTROL_PATHS, ...CONTROL_CHAR_PATHS];
    for (const path of paths.filter(representsUtf8Text)) {
      const report = analyzeDiff(diffForPath(path));
      const rawBefore = JSON.stringify(report);
      const markdown = renderMarkdown(report);
      const pretty = renderPretty(report);
      // A presentation repair that edited the model would show up here as JSON text that
      // changed after rendering, or as a Markdown name the factual record no longer matches.
      if (JSON.stringify(report) !== rawBefore)
        offenders.push(`${JSON.stringify(path)} -> rendering mutated the report`);
      const raw = JSON.parse(renderJson(report)).files[0].displayPath;
      if (raw !== path) offenders.push(`${JSON.stringify(path)} -> ${JSON.stringify(raw)}`);
      if (survivingControls(markdown).length > 0)
        offenders.push(`${JSON.stringify(path)} -> control survived in Markdown`);
      if (survivingControls(pretty).length > 0)
        offenders.push(`${JSON.stringify(path)} -> control survived in the terminal`);
    }
    expect(offenders).toEqual([]);
  });
});

describe('the Stage 8 GFM pipe repair still holds', () => {
  it('escapes the pipe in a path that also carried a bidi override', () => {
    const path = 'src/\u202ERLO|pipe.ts';
    const row = changedFileRow(markdownFor([path]));
    expect(row).not.toContain('\u202E');
    expect(row).toContain('`src/RLO\\|pipe.ts`');
  });

  it('keeps the ordinary pipe, backslash, backtick and markup cases unchanged', () => {
    expect(changedFileRow(markdownFor(['src/a|b.ts']))).toContain('`src/a\\|b.ts`');
    expect(changedFileRow(markdownFor(['x\\|y.ts']))).toContain('`x\\\\\\|y.ts`');
    expect(changedFileRow(markdownFor(['a|b`c.ts']))).toContain('`a\\|b&#96;c.ts`');
    expect(changedFileRow(markdownFor(['<script>|x.ts']))).toContain('`<script>\\|x.ts`');
  });
});
