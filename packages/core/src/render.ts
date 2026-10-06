/**
 * DiffBeacon core design reminder: render with the calm precision of a field
 * manual. Escape untrusted paths and observations in Markdown and terminals.
 */

import type { ReviewAttentionMap } from './model.js';
import { neutralizeDisplayControls } from './display.js';

function number(value: number | null): string {
  return value === null ? '—' : new Intl.NumberFormat('en-US').format(value);
}

/** A count that names its unit in the grammar the count actually calls for. */
function countNoun(value: number | null, singular: string): string {
  return value === null ? '—' : `${number(value)} ${value === 1 ? singular : `${singular}s`}`;
}

/**
 * Paint repository text for a human surface. The terminal report and the Markdown report are the
 * same kind of surface — a reader's line editor acts on what they print — so both run names,
 * messages and evidence through the shared display policy. This is presentation only: the parsed
 * model keeps its raw name, and `renderJson()` prints that raw factual record instead.
 */
function paintedText(value: string): string {
  return neutralizeDisplayControls(value, '\uFFFD');
}

export function escapeMarkdown(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('|', '\\|')
    .replaceAll('`', '\\`')
    .replaceAll('*', '\\*')
    .replaceAll('_', '\\_')
    .replaceAll('[', '\\[')
    .replaceAll(']', '\\]')
    .replaceAll('(', '\\(')
    .replaceAll(')', '\\)')
    .replaceAll('#', '\\#')
    .replaceAll('!', '\\!')
    .replaceAll('>', '\\>')
    .replaceAll('~', '\\~')
    .replaceAll('<', '&lt;')
    .replaceAll('\n', ' ');
}

function markdownCode(value: string): string {
  return `\`${value.replaceAll('\r', ' ').replaceAll('\n', ' ').replaceAll('`', '&#96;')}\``;
}

/**
 * A GFM table row splits on every pipe, including one inside a code span, so a pipe
 * in a path has to reach the cell as `\|` (spec Example 200). A backslash is doubled
 * only when the same name also holds a pipe: a lone backslash cannot open a cell, and
 * doubling one would print `\\` in every Windows-style path.
 */
function markdownTableCellCode(value: string): string {
  const escapedBackslashes = value.includes('|') ? value.replaceAll('\\', '\\\\') : value;
  return markdownCode(escapedBackslashes.replaceAll('|', '\\|'));
}

function level(level: string, color: boolean): string {
  if (!color) return level;
  const colors: Record<string, string> = {
    FOCUS: '\u001b[38;5;208m',
    CHECK: '\u001b[38;5;67m',
    NOTE: '\u001b[38;5;102m',
  };
  return `${colors[level] ?? ''}${level}\u001b[0m`;
}

const orderIndent = '   ';
const orderWidth = 80;

function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(' ')) {
    if (current === '') current = word;
    else if (current.length + 1 + word.length <= width) current = `${current} ${word}`;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current !== '') lines.push(current);
  return lines;
}

/**
 * JSON remains the raw factual data model after parsing, but its text form can safely encode
 * display-control code points as `\\uXXXX`. That keeps a JSON report valid and byte-stable while
 * preventing C1 terminal controls and Unicode bidi/line-format controls from acting on a reader who
 * prints the JSON directly. JSON.parse restores the exact original strings.
 */
const JSON_DISPLAY_CONTROL = /[\u007f-\u009f\u061c\u200e\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069]/g;

function jsonUnicodeEscape(character: string): string {
  return `\\u${character.codePointAt(0)?.toString(16).padStart(4, '0') ?? 'fffd'}`;
}

export function renderJson(report: ReviewAttentionMap): string {
  return JSON.stringify(report, null, 2).replace(JSON_DISPLAY_CONTROL, jsonUnicodeEscape);
}

export function renderMarkdown(report: ReviewAttentionMap): string {
  const lines = [
    '# DiffBeacon review',
    '',
    '> DiffBeacon maps review attention from observable diff evidence. It does not determine whether a pull request is safe to merge.',
    '',
    '## Summary',
    '',
    '| Metric | Value |',
    '| --- | ---: |',
    `| Changed files | ${number(report.summary.changedFiles)} |`,
    `| Additions | +${number(report.summary.additions)} |`,
    `| Deletions | -${number(report.summary.deletions)} |`,
    `| Binary files | ${number(report.summary.binaryFiles)} |`,
    `| Mode-only files | ${number(report.summary.modeOnlyFiles)} |`,
    '',
    '## Review attention',
    '',
    '| Level | Surface | Observation | Files |',
    '| --- | --- | --- | ---: |',
    ...report.attention.map(
      (item) =>
        `| ${escapeMarkdown(item.level)} | ${escapeMarkdown(item.title)} | ${escapeMarkdown(item.description)} | ${number(item.fileCount)} |`,
    ),
    ...(report.attention.length === 0
      ? [
          '| NOTE | No mapped surfaces | No changed-file surfaces were recognized in this diff. | 0 |',
        ]
      : []),
    '',
    '## Evidence observed',
    '',
    ...(report.evidence.length === 0
      ? ['No evidence relationships were triggered by this diff.']
      : report.evidence.flatMap((item) => [
          `### ${markdownCode(item.title)}`,
          '',
          escapeMarkdown(item.message),
          '',
          `Observed in: ${item.relatedFiles.map((file) => markdownCode(paintedText(file))).join(', ')}`,
          '',
        ])),
    '## Review order',
    '',
    ...(report.reviewOrder.length === 0
      ? [
          'No review order was produced because the diff was empty or contained no recognized files.',
        ]
      : report.reviewOrder.map(
          (item) =>
            `${item.position}. **${escapeMarkdown(item.title)}** — ${escapeMarkdown(item.reason)}`,
        )),
    '',
    '## Changed files',
    '',
    '| Status | Path | Additions | Deletions | Surfaces |',
    '| --- | --- | ---: | ---: | --- |',
    ...(report.files.length === 0
      ? ['| — | No files observed | — | — | — |']
      : report.files.map(
          (file) =>
            `| ${escapeMarkdown(file.status)} | ${markdownTableCellCode(paintedText(file.displayPath))} | ${number(file.additions)} | ${number(file.deletions)} | ${file.surfaces.map(escapeMarkdown).join(', ') || 'unclassified'} |`,
        )),
    '',
  ];
  return lines.join('\n');
}

export function renderPretty(
  report: ReviewAttentionMap,
  options: { color?: boolean } = {},
): string {
  const color = options.color === true;
  const lines = [
    'DiffBeacon',
    '──────────',
    '',
    `${countNoun(report.summary.changedFiles, 'file')} changed    +${number(report.summary.additions)}  -${number(report.summary.deletions)}`,
    report.summary.binaryFiles > 0 ? countNoun(report.summary.binaryFiles, 'binary file') : '',
    '',
    'REVIEW ATTENTION',
    '────────────────',
    ...(report.attention.length === 0
      ? ['NOTE   No mapped surfaces observed.']
      : report.attention.flatMap((item) => [
          `${level(item.level, color)}  ${paintedText(item.title)}`,
          `       ${countNoun(item.fileCount, 'file')} · +${number(item.additions)}  -${number(item.deletions)}`,
        ])),
    '',
    'EVIDENCE',
    '────────',
    ...(report.evidence.length === 0
      ? ['No evidence relationships were triggered by this diff.']
      : report.evidence.flatMap((item) => [
          paintedText(item.message),
          `Observed in: ${item.relatedFiles.map(paintedText).join(', ')}`,
        ])),
    '',
    'REVIEW ORDER',
    '────────────',
    ...(report.reviewOrder.length === 0
      ? ['No review order produced.']
      : report.reviewOrder.flatMap((item) => [
          `${item.position}. ${paintedText(item.title)}`,
          ...wrap(paintedText(item.reason), orderWidth - orderIndent.length).map(
            (line) => `${orderIndent}${line}`,
          ),
        ])),
    '',
    'CHANGED FILES',
    '─────────────',
    ...(report.files.length === 0
      ? ['No files observed.']
      : report.files.map(
          (file) =>
            `${file.status.padEnd(9)} ${paintedText(file.displayPath)}  +${number(file.additions)} -${number(file.deletions)}`,
        )),
  ];
  return lines.filter((line, index) => !(line === '' && lines[index - 1] === '')).join('\n');
}
