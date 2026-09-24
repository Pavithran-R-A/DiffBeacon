/**
 * DiffBeacon core design reminder: render with the calm precision of a field
 * manual. Escape untrusted paths and observations in Markdown and terminals.
 */

import type { ReviewAttentionMap } from './model.js';

function number(value: number | null): string {
  return value === null ? '—' : new Intl.NumberFormat('en-US').format(value);
}

function terminalText(value: string): string {
  return value
    .replace(/[\u0000-\u001f\u007f\u001b]/g, (character) => (character === '\t' ? ' ' : '�'))
    .replaceAll('\n', ' ');
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

function level(level: string, color: boolean): string {
  if (!color) return level;
  const colors: Record<string, string> = {
    FOCUS: '\u001b[38;5;208m',
    CHECK: '\u001b[38;5;67m',
    NOTE: '\u001b[38;5;102m',
  };
  return `${colors[level] ?? ''}${level}\u001b[0m`;
}

export function renderJson(report: ReviewAttentionMap): string {
  return JSON.stringify(report, null, 2);
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
          `Observed in: ${item.relatedFiles.map(markdownCode).join(', ')}`,
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
            `| ${escapeMarkdown(file.status)} | ${markdownCode(file.displayPath)} | ${number(file.additions)} | ${number(file.deletions)} | ${file.surfaces.map(escapeMarkdown).join(', ') || 'unclassified'} |`,
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
    `${number(report.summary.changedFiles)} files changed    +${number(report.summary.additions)}  -${number(report.summary.deletions)}`,
    report.summary.binaryFiles > 0 ? `${number(report.summary.binaryFiles)} binary files` : '',
    '',
    'REVIEW ATTENTION',
    '────────────────',
    ...(report.attention.length === 0
      ? ['NOTE   No mapped surfaces observed.']
      : report.attention.flatMap((item) => [
          `${level(item.level, color)}  ${terminalText(item.title)}`,
          `       ${number(item.fileCount)} files · +${number(item.additions)}  -${number(item.deletions)}`,
        ])),
    '',
    'EVIDENCE',
    '────────',
    ...(report.evidence.length === 0
      ? ['No evidence relationships were triggered by this diff.']
      : report.evidence.flatMap((item) => [
          terminalText(item.message),
          `Observed in: ${item.relatedFiles.map(terminalText).join(', ')}`,
        ])),
    '',
    'REVIEW ORDER',
    '────────────',
    ...(report.reviewOrder.length === 0
      ? ['No review order produced.']
      : report.reviewOrder.map((item) => `${item.position}. ${terminalText(item.title)}`)),
    '',
    'CHANGED FILES',
    '─────────────',
    ...(report.files.length === 0
      ? ['No files observed.']
      : report.files.map(
          (file) =>
            `${file.status.padEnd(9)} ${terminalText(file.displayPath)}  +${number(file.additions)} -${number(file.deletions)}`,
        )),
  ];
  return lines.filter((line, index) => !(line === '' && lines[index - 1] === '')).join('\n');
}
