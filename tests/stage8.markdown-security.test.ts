import { describe, expect, it } from 'vitest';
import { analyzeDiff, renderJson, renderMarkdown } from '../packages/core/src/index.js';
import { HOSTILE_PATHS, PIPE_PATHS, diffForPath, diffForPaths } from './stage8.hostile-corpus.js';

const SECTION_HEADINGS = [
  '## Summary',
  '## Review attention',
  '## Evidence observed',
  '## Review order',
  '## Changed files',
] as const;

const CHANGED_FILES_HEADER = ['Status', 'Path', 'Additions', 'Deletions', 'Surfaces'];

const READINGS = ['pipe', 'any'] as const;

/**
 * The GFM table extension splits a row on every pipe that is not escaped, before any
 * inline parsing happens, and shows an escaped pipe as a literal `|` even inside a
 * code span (spec Example 200). Readers differ on how much they treat as an escape:
 * `pipe` consumes only `\|`, `any` consumes any backslash pair. Both give the same
 * cell count for a hostile name, and that agreement is the property under test, so
 * these helpers encode the two readings instead of pulling in a Markdown parser.
 */
function rowCells(row: string, reading: 'pipe' | 'any' = 'pipe'): string[] {
  const cells: string[] = [];
  let current = '';
  for (let index = 0; index < row.length; index += 1) {
    const character = row[index] as string;
    const next = row[index + 1];
    if (character === '\\' && next !== undefined && (reading === 'any' || next === '|')) {
      current += next;
      index += 1;
      continue;
    }
    if (character === '|') {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += character;
  }
  cells.push(current.trim());
  // The outer delimiter pipes contribute the empty first and last entries.
  cells.shift();
  cells.pop();
  return cells;
}

/** Groups of consecutive `|` lines, i.e. the tables in the document. */
function tables(markdown: string): string[][] {
  const groups: string[][] = [];
  let current: string[] = [];
  for (const line of markdown.split('\n')) {
    if (line.startsWith('|')) {
      current.push(line);
      continue;
    }
    if (current.length > 0) groups.push(current);
    current = [];
  }
  if (current.length > 0) groups.push(current);
  return groups.filter((group) => group.length >= 2);
}

function lastTable(markdown: string): string[] {
  const groups = tables(markdown);
  expect(groups.length, 'the report ends with the Changed-files table').toBeGreaterThan(0);
  return groups[groups.length - 1] as string[];
}

const headings = (markdown: string): string[] =>
  markdown.split('\n').filter((line) => /^#{1,6} /.test(line));

/**
 * Everything the renderers place outside a code span. Markdown syntax here can act;
 * syntax inside a code span is inert text, which is the whole point of the boundary.
 */
function outsideCodeSpans(markdown: string): string {
  return markdown.replace(/`[^`\n]*`/g, '');
}

/** How a table cell presents a path: line endings become spaces, a backtick becomes
 * an entity, and a documented `\|` shows as a pipe. */
const presented = (path: string): string =>
  path.replaceAll('\r', ' ').replaceAll('\n', ' ').replaceAll('`', '&#96;').replaceAll('\\|', '|');

/** A name holding a backslash directly before a pipe reads differently depending on
 * whether the Markdown reader consumes `\\` as an escaped backslash first, so the
 * cell text for those names is not asserted beyond its structure. */
const pathHasEscapeAmbiguity = (path: string): boolean => path.includes('\\|');

const markdownFor = (paths: readonly string[]): string =>
  renderMarkdown(analyzeDiff(diffForPaths(paths)));

describe('Markdown table structure under pipe-bearing paths', () => {
  it('keeps the Changed-files row at five cells when a path contains a pipe', () => {
    expect(lastTable(markdownFor(['src/a|b.ts'])).map((row) => rowCells(row))).toEqual([
      CHANGED_FILES_HEADER,
      ['---', '---', '---:', '---:', '---'],
      ['modified', '`src/a|b.ts`', '1', '1', 'runtime'],
    ]);
  });

  it('gives every pipe-bearing path exactly one Changed-files cell', () => {
    const offenders: string[] = [];
    for (const path of PIPE_PATHS) {
      const row = lastTable(markdownFor([path]))[2] as string;
      for (const reading of READINGS) {
        const cells = rowCells(row, reading);
        if (cells.length !== CHANGED_FILES_HEADER.length)
          offenders.push(`${reading} ${JSON.stringify(path)} -> ${JSON.stringify(cells)}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('presents a pipe-bearing path in full inside its own cell', () => {
    const offenders: string[] = [];
    // A name holding a backslash directly before a pipe is the one case where a
    // Markdown reader must guess whether `\\` has consumed the escape, so those
    // paths are checked for structure above and for fidelity is left to the ones
    // where the two renderings agree.
    for (const path of PIPE_PATHS.filter((value) => !pathHasEscapeAmbiguity(value))) {
      const cells = rowCells(lastTable(markdownFor([path]))[2] as string);
      const expected = `\`${presented(path)}\``;
      if (cells[1] !== expected)
        offenders.push(`${JSON.stringify(path)} -> ${JSON.stringify(cells[1])}`);
    }
    expect(offenders).toEqual([]);
  });

  it('leaves no pipe that a reader checking only the previous character would split on', () => {
    // A third possible reading looks at the single character before each pipe rather
    // than at escape sequences. Every delimiter in the row must be a real one under
    // that reading too, and no cell content may supply an extra.
    const offenders: string[] = [];
    for (const path of PIPE_PATHS) {
      for (const row of lastTable(markdownFor([path]))) {
        const barePipes = (row.match(/(^|[^\\])\|/g) ?? []).length;
        if (barePipes !== CHANGED_FILES_HEADER.length + 1)
          offenders.push(`${JSON.stringify(path)} -> ${barePipes} in ${JSON.stringify(row)}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('keeps every table rectangular across the whole hostile corpus', () => {
    const offenders: string[] = [];
    for (const path of HOSTILE_PATHS) {
      for (const table of tables(markdownFor([path]))) {
        for (const reading of READINGS) {
          const widths = table.map((row) => rowCells(row, reading).length);
          if (widths.some((count) => count !== (widths[0] as number)))
            offenders.push(`${reading} ${JSON.stringify(path)} -> ${widths.join(',')}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('keeps one Changed-files row per file when a whole hostile diff is rendered', () => {
    const table = lastTable(markdownFor(PIPE_PATHS));
    expect(table).toHaveLength(PIPE_PATHS.length + 2);
    expect(table.map((row) => rowCells(row).length)).toEqual(
      table.map(() => CHANGED_FILES_HEADER.length),
    );
  });
});

describe('Markdown presentation boundary', () => {
  it('never lets a hostile path open a heading or a section', () => {
    const offenders: string[] = [];
    for (const path of HOSTILE_PATHS) {
      const markdown = markdownFor([path]);
      const sections = headings(markdown).filter((line) => line.startsWith('## '));
      const leaked = headings(markdown).filter((line) => line.includes(presented(path)));
      if (sections.join('\n') !== SECTION_HEADINGS.join('\n') || leaked.length > 0)
        offenders.push(`${JSON.stringify(path)} -> ${JSON.stringify(leaked)}`);
    }
    expect(offenders).toEqual([]);
  });

  it('keeps markup, links, and images inside code spans where they cannot act', () => {
    const offenders: string[] = [];
    for (const path of HOSTILE_PATHS) {
      const residue = outsideCodeSpans(markdownFor([path]));
      const findings: string[] = [];
      if (/<\/?[a-zA-Z]/.test(residue)) findings.push('raw HTML tag');
      if (/!\[/.test(residue)) findings.push('image syntax');
      if (/\]\(/.test(residue)) findings.push('link destination');
      if (/\]\(\s*(javascript|data|vbscript):/i.test(residue)) findings.push('scripted URL');
      if (findings.length > 0) offenders.push(`${JSON.stringify(path)} -> ${findings.join(', ')}`);
    }
    expect(offenders).toEqual([]);
  });

  it('keeps the raw path factual in JSON while presenting it in one Markdown cell', () => {
    const report = analyzeDiff(diffForPath('src/a|b.ts'));
    expect(report.files[0]?.displayPath).toBe('src/a|b.ts');
    expect(JSON.parse(renderJson(report)).files[0].displayPath).toBe('src/a|b.ts');
    expect(renderMarkdown(report)).toContain('| modified | `src/a\\|b.ts` | 1 | 1 | runtime |');
  });
});
