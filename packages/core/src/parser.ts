/**
 * DiffBeacon parser: explicit unified-diff state machine. Metadata is parsed
 * only outside hunks; hunk content is always treated as content, even when it
 * resembles Git headers such as `---`, `+++`, `diff --git`, or `index`.
 */

import type { ChangedFile, FileStatus, Hunk, ParsedDiff, ParseDiagnostic } from './model.js';

const NULL_PATH = '/dev/null';

function decodeGitQuoted(value: string): string {
  const trimmed = value.trim();
  if (!(trimmed.startsWith('"') && trimmed.endsWith('"'))) return trimmed;
  const inner = trimmed.slice(1, -1);
  const bytes: number[] = [];
  const encoder = new TextEncoder();
  for (let index = 0; index < inner.length; index += 1) {
    const character = inner[index] ?? '';
    if (character !== '\\') {
      bytes.push(...encoder.encode(character));
      continue;
    }
    const octal = inner.slice(index + 1, index + 4);
    if (/^[0-7]{3}$/.test(octal)) {
      bytes.push(Number.parseInt(octal, 8));
      index += 3;
      continue;
    }
    const next = inner[index + 1] ?? '';
    const escapes: Record<string, number> = {
      '\\': 0x5c,
      '"': 0x22,
      a: 0x07,
      b: 0x08,
      f: 0x0c,
      n: 0x0a,
      r: 0x0d,
      t: 0x09,
      v: 0x0b,
    };
    if (escapes[next] !== undefined) {
      bytes.push(escapes[next] as number);
      index += 1;
      continue;
    }
    bytes.push(...encoder.encode('\\'));
  }
  return new TextDecoder().decode(Uint8Array.from(bytes));
}

export function decodeGitPath(value: string): string {
  return decodeGitQuoted(value);
}

function stripDiffPrefix(value: string): string | null {
  const withoutTimestamp = value.split('\t', 1)[0] ?? value;
  const path = decodeGitQuoted(withoutTimestamp.trim());
  if (path === NULL_PATH) return null;
  if (path.startsWith('a/') || path.startsWith('b/')) return path.slice(2);
  return path;
}

function parseQuotedPair(value: string): [string | null, string | null] | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith('"')) return null;
  const tokens: string[] = [];
  let cursor = 0;
  while (cursor < trimmed.length && tokens.length < 2) {
    while (trimmed[cursor] === ' ') cursor += 1;
    if (trimmed[cursor] !== '"') return null;
    const start = cursor;
    cursor += 1;
    let escaped = false;
    while (cursor < trimmed.length) {
      const character = trimmed[cursor] ?? '';
      if (!escaped && character === '"') {
        cursor += 1;
        break;
      }
      escaped = !escaped && character === '\\';
      if (character !== '\\') escaped = false;
      cursor += 1;
    }
    tokens.push(trimmed.slice(start, cursor));
  }
  return tokens.length === 2
    ? [stripDiffPrefix(tokens[0] as string), stripDiffPrefix(tokens[1] as string)]
    : null;
}

function parseGitPair(value: string): [string | null, string | null] | null {
  const trimmed = value.trim();
  const quoted = parseQuotedPair(trimmed);
  if (quoted !== null) return quoted;

  // Git's unquoted `diff --git` form is ambiguous when a path itself contains
  // ` b/`. Select the candidate whose old/new basenames agree, which is the
  // invariant Git uses for ordinary modify/copy/rename pairs.
  const candidates: Array<{ oldPath: string; newPath: string; score: number; index: number }> = [];
  let offset = 0;
  while (offset < trimmed.length) {
    const index = trimmed.indexOf(' b/', offset);
    if (index < 0) break;
    const oldPath = trimmed.slice(0, index);
    const newPath = trimmed.slice(index + 1);
    if (oldPath.startsWith('a/') && newPath.startsWith('b/')) {
      const oldBase = oldPath.slice(2).split('/').at(-1);
      const newBase = newPath.slice(2).split('/').at(-1);
      candidates.push({
        oldPath,
        newPath,
        score: oldPath.slice(2) === newPath.slice(2) ? 3 : oldBase === newBase ? 2 : 1,
        index,
      });
    }
    offset = index + 1;
  }
  const selected = candidates.sort(
    (left, right) => right.score - left.score || left.index - right.index,
  )[0];
  return selected === undefined
    ? null
    : [stripDiffPrefix(selected.oldPath), stripDiffPrefix(selected.newPath)];
}

function parseBinaryPair(value: string): [string | null, string | null] | null {
  const candidates: Array<[string, string]> = [];
  let offset = 0;
  while (offset < value.length) {
    const index = value.indexOf(' and ', offset);
    if (index < 0) break;
    const left = value.slice(0, index);
    const right = value.slice(index + 5).replace(/ differ$/, '');
    if (left === NULL_PATH || left.startsWith('a/') || right.startsWith('b/'))
      candidates.push([left, right]);
    offset = index + 1;
  }
  const selected = candidates.at(-1);
  return selected === undefined
    ? null
    : [stripDiffPrefix(selected[0]), stripDiffPrefix(selected[1])];
}

function parseHunkHeader(line: string): Hunk | null {
  if (!/^@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@/.test(line)) return null;
  return { header: line, additions: 0, deletions: 0 };
}

function inferStatus(file: {
  oldPath: string | null;
  newPath: string | null;
  oldMode: string | null;
  newMode: string | null;
  similarity: number | null;
  hunks: Hunk[];
  renameFrom: string | null;
  renameTo: string | null;
  isNewFile: boolean;
  isDeletedFile: boolean;
}): FileStatus {
  if (file.isNewFile) return 'added';
  if (file.isDeletedFile) return 'deleted';
  if (file.oldPath === null && file.newPath !== null) return 'added';
  if (file.newPath === null && file.oldPath !== null) return 'deleted';
  if (file.renameFrom !== null || file.renameTo !== null || file.similarity !== null)
    return 'renamed';
  if (file.hunks.length === 0 && file.oldMode !== null && file.newMode !== null) return 'mode-only';
  return 'modified';
}

function finalize(current: Omit<CurrentFile, 'activeHunk'>): ChangedFile {
  const status = inferStatus(current);
  const modeOnly = status === 'mode-only';
  const additions =
    current.binary || modeOnly
      ? null
      : current.hunks.reduce((sum, hunk) => sum + hunk.additions, 0);
  const deletions =
    current.binary || modeOnly
      ? null
      : current.hunks.reduce((sum, hunk) => sum + hunk.deletions, 0);
  const oldPath = current.isNewFile ? null : (current.renameFrom ?? current.oldPath);
  const newPath = current.isDeletedFile ? null : (current.renameTo ?? current.newPath);
  return {
    oldPath,
    newPath,
    displayPath: newPath ?? oldPath ?? '<unknown path>',
    status,
    additions,
    deletions,
    binary: current.binary,
    modeOnly,
    oldMode: current.oldMode,
    newMode: current.newMode,
    similarity: current.similarity,
    surfaces: [],
    generated: false,
  };
}

type CurrentFile = {
  oldPath: string | null;
  newPath: string | null;
  oldMode: string | null;
  newMode: string | null;
  similarity: number | null;
  binary: boolean;
  hunks: Hunk[];
  renameFrom: string | null;
  renameTo: string | null;
  isNewFile: boolean;
  isDeletedFile: boolean;
  activeHunk: Hunk | null;
};

export function parseUnifiedDiff(input: string): ParsedDiff {
  const lines = input.replaceAll('\r\n', '\n').replaceAll('\r', '\n').split('\n');
  const files: ChangedFile[] = [];
  const diagnostics: ParseDiagnostic[] = [];
  let current: CurrentFile | null = null;
  const flush = () => {
    if (current !== null) files.push(finalize(current));
    current = null;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const lineNumber = index + 1;
    if (line.startsWith('diff --git ')) {
      flush();
      const pair = parseGitPair(line.slice('diff --git '.length));
      current = {
        oldPath: pair?.[0] ?? null,
        newPath: pair?.[1] ?? null,
        oldMode: null,
        newMode: null,
        similarity: null,
        binary: false,
        hunks: [],
        renameFrom: null,
        renameTo: null,
        isNewFile: false,
        isDeletedFile: false,
        activeHunk: null,
      };
      if (pair === null)
        diagnostics.push({
          code: 'malformed-header',
          message: 'Could not parse diff --git paths.',
          line: lineNumber,
        });
      continue;
    }
    if (current === null) {
      if (line.startsWith('--- ') || line.startsWith('+++ '))
        diagnostics.push({
          code: 'unrecognized-file-header',
          message: 'File header appeared without diff --git.',
          line: lineNumber,
        });
      continue;
    }

    // Once a hunk exists, every line is hunk content. This is the critical
    // state boundary that prevents SQL/YAML/front-matter from corrupting paths.
    if (current.activeHunk !== null) {
      if (line.startsWith('@@ ')) {
        const hunk = parseHunkHeader(line);
        if (hunk !== null) {
          current.hunks.push(hunk);
          current.activeHunk = hunk;
        }
      } else if (line !== '\\ No newline at end of file') {
        if (line.startsWith('+')) current.activeHunk.additions += 1;
        else if (line.startsWith('-')) current.activeHunk.deletions += 1;
      }
      continue;
    }

    if (line.startsWith('new file mode ')) {
      current.isNewFile = true;
      current.oldMode = null;
      current.newMode = line.slice('new file mode '.length).trim();
    } else if (line.startsWith('deleted file mode ')) {
      current.isDeletedFile = true;
      current.oldMode = line.slice('deleted file mode '.length).trim();
      current.newMode = null;
    } else if (line.startsWith('old mode '))
      current.oldMode = line.slice('old mode '.length).trim();
    else if (line.startsWith('new mode ')) current.newMode = line.slice('new mode '.length).trim();
    else if (line.startsWith('similarity index ')) {
      const value = Number.parseInt(line.slice('similarity index '.length), 10);
      current.similarity = Number.isFinite(value) ? value : null;
    } else if (line.startsWith('rename from '))
      current.renameFrom = decodeGitQuoted(line.slice('rename from '.length));
    else if (line.startsWith('rename to '))
      current.renameTo = decodeGitQuoted(line.slice('rename to '.length));
    else if (line.startsWith('Binary files ')) {
      current.binary = true;
      const pair = parseBinaryPair(line.slice('Binary files '.length));
      if (pair !== null) {
        current.oldPath = pair[0];
        current.newPath = pair[1];
      }
    } else if (line === 'GIT binary patch') current.binary = true;
    else if (line.startsWith('--- ')) current.oldPath = stripDiffPrefix(line.slice(4));
    else if (line.startsWith('+++ ')) current.newPath = stripDiffPrefix(line.slice(4));
    else if (line.startsWith('@@ ')) {
      const hunk = parseHunkHeader(line);
      if (hunk !== null) {
        current.hunks.push(hunk);
        current.activeHunk = hunk;
      }
    }
  }
  flush();
  return { files, diagnostics };
}
