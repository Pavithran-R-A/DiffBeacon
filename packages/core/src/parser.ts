/**
 * DiffBeacon parser: explicit unified-diff state machine. Metadata is parsed
 * only outside hunks; a hunk body line carries its unified-diff prefix, so content
 * that resembles Git headers such as `---`, `+++`, `diff --git`, or `index` stays
 * content, while a prefix-free line at a completed hunk boundary is reported.
 */

import type { ChangedFile, FileStatus, Hunk, ParsedDiff, ParseDiagnostic } from './model.js';
import { MAX_DIFF_BYTES, UNKNOWN_PATH_SENTINEL } from './model.js';

const NULL_PATH = '/dev/null';

function exceedsDiffLimit(value: string): boolean {
  // UTF-8 needs at least one byte per UTF-16 code unit and at most three, so the
  // exact count is only taken when those cheap bounds leave the answer open.
  if (value.length > MAX_DIFF_BYTES) return true;
  if (value.length * 3 <= MAX_DIFF_BYTES) return false;
  return new TextEncoder().encode(value).length > MAX_DIFF_BYTES;
}

type PathPair = { oldPath: string | null; newPath: string | null };

type PairResolution = {
  reason: 'proven' | 'ambiguous' | 'unprovable';
  pair: PathPair | null;
};

function decodeGitQuoted(value: string): string {
  if (!(value.startsWith('"') && value.endsWith('"'))) return value;
  const inner = value.slice(1, -1);
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
      const byte = Number.parseInt(octal, 8);
      // Git C-quotes bytes, so an octal escape cannot exceed 0xff. Keep impossible
      // escapes literal rather than letting Uint8Array wrap (for example \\777 -> 0xff).
      if (byte <= 0xff) {
        bytes.push(byte);
        index += 3;
        continue;
      }
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
  const path = decodeGitQuoted(withoutTimestamp);
  if (path === NULL_PATH) return null;
  if (path.startsWith('a/') || path.startsWith('b/')) return path.slice(2);
  return path;
}

function parseQuotedPair(value: string): [string | null, string | null] | null {
  const trimmed = value;
  if (!trimmed.startsWith('"')) return null;
  const tokens: string[] = [];
  let cursor = 0;
  while (cursor < trimmed.length && tokens.length < 2) {
    while (trimmed[cursor] === ' ') cursor += 1;
    if (trimmed[cursor] !== '"') return null;
    const start = cursor;
    cursor += 1;
    let escaped = false;
    let closed = false;
    while (cursor < trimmed.length) {
      const character = trimmed[cursor] ?? '';
      if (!escaped && character === '"') {
        cursor += 1;
        closed = true;
        break;
      }
      escaped = !escaped && character === '\\';
      if (character !== '\\') escaped = false;
      cursor += 1;
    }
    if (!closed) return null;
    tokens.push(trimmed.slice(start, cursor));
  }
  while (trimmed[cursor] === ' ') cursor += 1;
  if (tokens.length !== 2 || cursor !== trimmed.length) return null;
  const oldToken = decodeGitQuoted(tokens[0] as string);
  const newToken = decodeGitQuoted(tokens[1] as string);
  // The extended ---/+++ and Binary-files lines may use /dev/null, but Git's
  // leading diff --git header never does, even for an add/delete.
  if (!oldToken.startsWith('a/') || !newToken.startsWith('b/')) return null;
  const oldPath = stripDiffPrefix(tokens[0] as string);
  const newPath = stripDiffPrefix(tokens[1] as string);
  // A quoted `a/` or `b/` still names no file, so it is not a decodable pair.
  return oldPath === '' || newPath === '' ? null : [oldPath, newPath];
}
function parseGitPair(value: string): PairResolution {
  // `diff --git` contributes exactly one separator before the old-side token. Remove
  // that separator only; trailing spaces can be real filename bytes on POSIX filesystems.
  const pair = value.startsWith(' ') ? value.slice(1) : value;
  const quoted = parseQuotedPair(pair);
  if (quoted !== null)
    return {
      reason: 'proven',
      pair: { oldPath: quoted[0], newPath: quoted[1] },
    };
  // Git leaves spaces and literal `b/` segments unquoted, so an unquoted header
  // can decompose several ways. A split is only provable when one side of `a/`
  // and `b/` structure survives and, with competing splits left, when exactly
  // one of them keeps both paths identical.
  const resolution = resolvePair(pair, ' b/', 2);
  if (
    resolution.pair !== null &&
    (resolution.pair.oldPath === null || resolution.pair.newPath === null)
  )
    return { reason: 'unprovable', pair: null };
  return resolution;
}

function decodeWholeQuotedToken(value: string): string | null {
  if (!value.startsWith('"')) return null;
  let escaped = false;
  for (let index = 1; index < value.length; index += 1) {
    const character = value[index] ?? '';
    if (!escaped && character === '"')
      return index === value.length - 1 ? decodeGitQuoted(value) : null;
    escaped = !escaped && character === '\\';
    if (character !== '\\') escaped = false;
  }
  return null;
}

function binarySide(value: string, prefix: 'a/' | 'b/'): { valid: boolean; path: string | null } {
  const decoded = value.startsWith('"') ? decodeWholeQuotedToken(value) : value;
  if (decoded === null) return { valid: false, path: null };
  if (decoded === NULL_PATH) return { valid: true, path: null };
  if (!decoded.startsWith(prefix) || decoded.length === prefix.length)
    return { valid: false, path: null };
  return { valid: true, path: decoded.slice(prefix.length) };
}

function parseBinaryPair(value: string): PairResolution {
  // `Binary files` has an exact trailing ` differ` marker. Strip only that
  // delimiter; spaces before it may belong to the destination filename.
  if (!value.endsWith(' differ')) return { reason: 'unprovable', pair: null };
  const pair = value.slice(0, -' differ'.length);
  const accepted: PathPair[] = [];
  let offset = 0;
  while (offset < pair.length) {
    const index = pair.indexOf(' and ', offset);
    if (index < 0) break;
    const left = binarySide(pair.slice(0, index), 'a/');
    const right = binarySide(pair.slice(index + ' and '.length), 'b/');
    if (left.valid && right.valid) accepted.push({ oldPath: left.path, newPath: right.path });
    offset = index + 1;
  }
  if (accepted.length === 0) return { reason: 'unprovable', pair: null };
  if (accepted.length === 1) return { reason: 'proven', pair: accepted[0] as PathPair };
  const agreeing = accepted.filter(
    (candidate) => candidate.oldPath === candidate.newPath && candidate.oldPath !== null,
  );
  const distinct = new Set(agreeing.map((candidate) => candidate.oldPath as string));
  return distinct.size === 1
    ? { reason: 'proven', pair: agreeing[0] as PathPair }
    : { reason: 'ambiguous', pair: null };
}

const isOldSide = (value: string): boolean => value === NULL_PATH || value.startsWith('a/');
const isNewSide = (value: string): boolean => value === NULL_PATH || value.startsWith('b/');

// A header truncated to the bare token still opens a file block, so it is read like
// any other header and reported as a pair whose paths could not be proven.
const isGitHeader = (line: string): boolean =>
  line.startsWith('diff --git ') || line.trimEnd() === 'diff --git';

function resolvePair(value: string, marker: string, keep: number): PairResolution {
  const accepted: PathPair[] = [];
  let offset = 0;
  while (offset < value.length) {
    const index = value.indexOf(marker, offset);
    if (index < 0) break;
    const left = value.slice(0, index);
    const right = value.slice(index + marker.length - keep);
    if (isOldSide(left) && isNewSide(right)) {
      const oldPath = stripDiffPrefix(left);
      const newPath = stripDiffPrefix(right);
      // A bare `a/` or `b/` carries no filename, so it cannot make a provable pair.
      if (oldPath !== '' && newPath !== '') accepted.push({ oldPath, newPath });
    }
    offset = index + 1;
  }
  if (accepted.length === 0) return { reason: 'unprovable', pair: null };
  if (accepted.length === 1) return { reason: 'proven', pair: accepted[0] as PathPair };
  const agreeing = accepted.filter(
    (candidate) => candidate.oldPath === candidate.newPath && candidate.oldPath !== null,
  );
  const distinct = new Set(agreeing.map((candidate) => candidate.oldPath as string));
  return distinct.size === 1
    ? { reason: 'proven', pair: agreeing[0] as PathPair }
    : { reason: 'ambiguous', pair: null };
}

function parseHunkHeader(line: string): { oldCount: number; newCount: number } | null {
  // An omitted count means one line; a count of zero means the side is absent.
  const match = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
  if (match === null) return null;
  return {
    oldCount: Number.parseInt(match[2] ?? '1', 10),
    newCount: Number.parseInt(match[4] ?? '1', 10),
  };
}

function gitMode(value: string): string | null {
  const mode = value.trim();
  return /^[0-7]{6}$/.test(mode) ? mode : null;
}

function inferStatus(file: {
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
  isCopy: boolean;
  copyTo: string | null;
}): FileStatus {
  if (file.isNewFile) return 'added';
  if (file.isDeletedFile) return 'deleted';
  if (file.isCopy) return 'added';
  if (file.oldPath === null && file.newPath !== null) return 'added';
  if (file.newPath === null && file.oldPath !== null) return 'deleted';
  // Similarity is supporting metadata, not a status by itself. Git emits it with
  // rename/copy metadata; hostile pasted input must not turn a plain file into a rename.
  if (file.renameFrom !== null || file.renameTo !== null) return 'renamed';
  // A mode pair only stands alone as mode-only when the patch shows no content
  // change at all: neither counted hunks nor a binary payload.
  if (file.hunks.length === 0 && !file.binary && file.oldMode !== null && file.newMode !== null)
    return 'mode-only';
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
  const oldPath =
    current.isNewFile || current.isCopy ? null : (current.renameFrom ?? current.oldPath);
  const newPath = current.isDeletedFile
    ? null
    : (current.renameTo ?? current.copyTo ?? current.newPath);
  return {
    oldPath,
    newPath,
    displayPath: newPath ?? oldPath ?? UNKNOWN_PATH_SENTINEL,
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

type HunkAccount = {
  hunk: Hunk;
  headerLine: number;
  declaredOld: number;
  declaredNew: number;
  seenOld: number;
  seenNew: number;
};

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
  isCopy: boolean;
  copyTo: string | null;
  activeHunk: HunkAccount | null;
};

function openHunk(
  current: CurrentFile,
  line: string,
  lineNumber: number,
  counts: { oldCount: number; newCount: number },
): void {
  const hunk: Hunk = { header: line, additions: 0, deletions: 0 };
  current.hunks.push(hunk);
  current.activeHunk = {
    hunk,
    headerLine: lineNumber,
    declaredOld: counts.oldCount,
    declaredNew: counts.newCount,
    seenOld: 0,
    seenNew: 0,
  };
}

function closeHunk(current: CurrentFile, diagnostics: ParseDiagnostic[]): void {
  const account = current.activeHunk;
  if (account === null) return;
  if (account.seenOld < account.declaredOld || account.seenNew < account.declaredNew) {
    diagnostics.push({
      code: 'truncated-hunk',
      message:
        `Hunk declared ${account.declaredOld} old and ${account.declaredNew} new lines ` +
        `but only ${account.seenOld} and ${account.seenNew} arrived.`,
      line: account.headerLine,
    });
  } else if (account.seenOld > account.declaredOld || account.seenNew > account.declaredNew) {
    diagnostics.push({
      code: 'hunk-count-mismatch',
      message:
        `Hunk body exceeded its declared ${account.declaredOld} old and ` +
        `${account.declaredNew} new lines with ${account.seenOld} and ${account.seenNew}.`,
      line: account.headerLine,
    });
  }
  current.activeHunk = null;
}

const NO_NEWLINE_MARKER = '\\ No newline at end of file';

function consumeHunkLine(line: string, account: HunkAccount): void {
  // The no-newline marker annotates the previous line and a structural-looking line
  // is inert: neither side gains a line.
  if (line === NO_NEWLINE_MARKER) return;
  if (line.startsWith('+')) {
    account.hunk.additions += 1;
    account.seenNew += 1;
  } else if (line.startsWith('-')) {
    account.hunk.deletions += 1;
    account.seenOld += 1;
  } else if (line.startsWith(' ')) {
    account.seenOld += 1;
    account.seenNew += 1;
  }
}

// A real hunk body line always carries a unified-diff content prefix. The marker
// and the empty element a final newline leaves behind are the two recognized forms
// that do not change either side's count.
function isBodyLine(line: string): boolean {
  return (
    line.startsWith(' ') ||
    line.startsWith('+') ||
    line.startsWith('-') ||
    line === NO_NEWLINE_MARKER ||
    line === ''
  );
}

function hasSatisfiedCounts(account: HunkAccount): boolean {
  return account.seenOld === account.declaredOld && account.seenNew === account.declaredNew;
}

export function parseUnifiedDiff(input: string): ParsedDiff {
  if (exceedsDiffLimit(input))
    return {
      files: [],
      diagnostics: [
        {
          code: 'input-too-large',
          message: `Input is larger than the ${MAX_DIFF_BYTES} byte analysis limit, so nothing was parsed.`,
          line: 1,
        },
      ],
    };
  const lines = input.replaceAll('\r\n', '\n').replaceAll('\r', '\n').split('\n');
  const files: ChangedFile[] = [];
  const diagnostics: ParseDiagnostic[] = [];
  let current: CurrentFile | null = null;
  let skippingDialect = false;
  const flush = () => {
    if (current !== null) {
      closeHunk(current, diagnostics);
      files.push(finalize(current));
    }
    current = null;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const lineNumber = index + 1;
    if (isGitHeader(line)) {
      flush();
      skippingDialect = false;
      const resolution = parseGitPair(line.slice('diff --git'.length));
      current = {
        oldPath: resolution.pair?.oldPath ?? null,
        newPath: resolution.pair?.newPath ?? null,
        oldMode: null,
        newMode: null,
        similarity: null,
        binary: false,
        hunks: [],
        renameFrom: null,
        renameTo: null,
        isNewFile: false,
        isDeletedFile: false,
        isCopy: false,
        copyTo: null,
        activeHunk: null,
      };
      if (resolution.reason === 'ambiguous')
        diagnostics.push({
          code: 'ambiguous-path',
          message: 'Could not prove which paths the diff --git header names.',
          line: lineNumber,
        });
      else if (resolution.reason === 'unprovable')
        diagnostics.push({
          code: 'malformed-header',
          message: 'Could not parse diff --git paths.',
          line: lineNumber,
        });
      continue;
    }
    // A combined merge diff describes one file against several parents, which the
    // supported `base...head` vector never produces. Say so and skip the block
    // rather than emitting misleading file-header diagnostics for its lines. A
    // completed hunk must hand the stream over here, not swallow the header.
    if (line.startsWith('diff --cc ') || line.startsWith('diff --combined ')) {
      flush();
      skippingDialect = true;
      diagnostics.push({
        code: 'unsupported-dialect',
        message: 'Combined merge diffs are outside the supported patch vector.',
        line: lineNumber,
      });
      continue;
    }
    if (skippingDialect) continue;
    if (current === null) {
      if (line.startsWith('@@ '))
        diagnostics.push({
          code: 'unrecognized-hunk-header',
          message: 'Hunk header appeared without diff --git.',
          line: lineNumber,
        });
      else if (line.startsWith('--- ') || line.startsWith('+++ '))
        diagnostics.push({
          code: 'unrecognized-file-header',
          message: 'File header appeared without diff --git.',
          line: lineNumber,
        });
      continue;
    }

    // Once a hunk exists, prefixed lines are hunk content. This is the critical
    // state boundary that prevents SQL/YAML/front-matter from corrupting paths.
    const active = current.activeHunk;
    if (active !== null) {
      const counts = line.startsWith('@@ ') ? parseHunkHeader(line) : null;
      if (counts !== null) {
        closeHunk(current, diagnostics);
        openHunk(current, line, lineNumber, counts);
        continue;
      }
      if (!isBodyLine(line) && hasSatisfiedCounts(active)) {
        // The declared body already arrived in full, so a prefix-free line cannot be
        // its content. End the hunk and name the line instead of consuming it, which
        // is what keeps a finished file from absorbing what follows it.
        diagnostics.push({
          code: 'malformed-hunk',
          message: 'Line after a completed hunk is neither hunk content nor a known header.',
          line: lineNumber,
        });
        closeHunk(current, diagnostics);
        continue;
      }
      if (line.startsWith('@@ ')) {
        // Still inside the declared body, so this header-shaped line is inert for the
        // accounting, but it cannot pass for content either.
        diagnostics.push({
          code: 'malformed-hunk',
          message: 'Hunk-header line inside a hunk body could not be read as a header.',
          line: lineNumber,
        });
      }
      consumeHunkLine(line, active);
      continue;
    }

    if (line.startsWith('new file mode ')) {
      const mode = gitMode(line.slice('new file mode '.length));
      if (mode === null)
        diagnostics.push({
          code: 'malformed-header',
          message: 'new file mode must be a six-digit octal Git mode.',
          line: lineNumber,
        });
      else {
        current.isNewFile = true;
        current.oldMode = null;
        current.newMode = mode;
      }
    } else if (line.startsWith('deleted file mode ')) {
      const mode = gitMode(line.slice('deleted file mode '.length));
      if (mode === null)
        diagnostics.push({
          code: 'malformed-header',
          message: 'deleted file mode must be a six-digit octal Git mode.',
          line: lineNumber,
        });
      else {
        current.isDeletedFile = true;
        current.oldMode = mode;
        current.newMode = null;
      }
    } else if (line.startsWith('old mode ')) {
      const mode = gitMode(line.slice('old mode '.length));
      if (mode === null)
        diagnostics.push({
          code: 'malformed-header',
          message: 'old mode must be a six-digit octal Git mode.',
          line: lineNumber,
        });
      else current.oldMode = mode;
    } else if (line.startsWith('new mode ')) {
      const mode = gitMode(line.slice('new mode '.length));
      if (mode === null)
        diagnostics.push({
          code: 'malformed-header',
          message: 'new mode must be a six-digit octal Git mode.',
          line: lineNumber,
        });
      else current.newMode = mode;
    } else if (line.startsWith('similarity index ')) {
      const raw = line.slice('similarity index '.length).trim();
      const match = /^(\d+)%$/.exec(raw);
      const value = match === null ? null : Number(match[1]);
      if (value === null || !Number.isInteger(value) || value < 0 || value > 100) {
        current.similarity = null;
        diagnostics.push({
          code: 'malformed-header',
          message: 'Similarity index must be an integer percentage from 0% through 100%.',
          line: lineNumber,
        });
      } else current.similarity = value;
    } else if (line.startsWith('rename from '))
      current.renameFrom = decodeGitQuoted(line.slice('rename from '.length));
    else if (line.startsWith('rename to '))
      current.renameTo = decodeGitQuoted(line.slice('rename to '.length));
    else if (line.startsWith('copy from ') || line.startsWith('copy to ')) {
      // Git keeps the source file for a `C` entry, so a copy is not a rename, and
      // the supported vector never asks Git for copy detection. Record the
      // destination and name the dialect instead of relabelling it `renamed`.
      if (!current.isCopy) {
        current.isCopy = true;
        diagnostics.push({
          code: 'unsupported-dialect',
          message: 'Copy detection is outside the supported patch vector.',
          line: lineNumber,
        });
      }
      if (line.startsWith('copy to '))
        current.copyTo = decodeGitQuoted(line.slice('copy to '.length));
    } else if (line.startsWith('Binary files ')) {
      current.binary = true;
      const resolution = parseBinaryPair(line.slice('Binary files '.length));
      if (resolution.reason === 'proven' && resolution.pair !== null) {
        current.oldPath = resolution.pair.oldPath;
        current.newPath = resolution.pair.newPath;
      } else
        diagnostics.push({
          code: 'ambiguous-path',
          message: 'Could not prove which paths the Binary files line names.',
          line: lineNumber,
        });
    } else if (line === 'GIT binary patch') current.binary = true;
    else if (line.startsWith('--- ') || line.startsWith('+++ ')) {
      const path = stripDiffPrefix(line.slice(4));
      // An empty side names no file; keep any path the header already proved and
      // say that this line could not be read.
      if (path === '')
        diagnostics.push({
          code: 'malformed-header',
          message: 'File header named no path.',
          line: lineNumber,
        });
      else if (line.startsWith('--- ')) current.oldPath = path;
      else current.newPath = path;
    } else if (line.startsWith('@@ ')) {
      const counts = parseHunkHeader(line);
      if (counts === null)
        diagnostics.push({
          code: 'malformed-hunk',
          message: 'Could not parse hunk line counts.',
          line: lineNumber,
        });
      else openHunk(current, line, lineNumber, counts);
    }
  }
  flush();
  return { files, diagnostics };
}
