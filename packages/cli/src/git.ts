/**
 * DiffBeacon Git boundary: fixed argument arrays, shell=false, no hooks or
 * target-code execution, and a bounded streaming diff collector shared by CLI
 * and Action. The explicit diff controls make the structural input independent
 * of user/repository diff prefixes, algorithms, and rename settings. Myers is
 * selected for reproducibility, not because it is objectively superior; the
 * fixed 50% rename threshold and limit 1000 bound rename work. Binary payloads
 * are intentionally omitted because DiffBeacon classifies, never applies, patches.
 */

import { execFileSync, spawn } from 'node:child_process';
import process from 'node:process';
import { StringDecoder } from 'node:string_decoder';
import { MAX_DIFF_BYTES } from '../../core/src/model.js';
import { DiffUnavailableError, boundedSingleLine, echo } from './errors.js';
import { validateRange, validateRevision } from './revisions.js';

export class DiffSizeLimitError extends DiffUnavailableError {
  constructor(public readonly limitBytes = MAX_DIFF_BYTES) {
    super(
      `No diff available: the diff is larger than the ${limitBytes} byte analysis limit. Narrow the range, or use --stdin with a bounded diff.`,
    );
    this.name = 'DiffSizeLimitError';
  }
}

function stderrOf(error: unknown): string {
  if (error instanceof Error) {
    const captured = (error as { stderr?: string | Buffer }).stderr;
    return captured === undefined ? '' : captured.toString();
  }
  return '';
}

/** Turn a raw Git process failure into one stable, bounded operational message. */
function gitFailure(error: unknown, command: string): DiffUnavailableError {
  const stderr = stderrOf(error);
  if (/not a git repository/i.test(stderr))
    return new DiffUnavailableError(
      'No diff available: the working directory is not a Git repository. Run DiffBeacon inside a repository, or read a prepared diff with --stdin.',
    );
  return new DiffUnavailableError(
    `No diff available: git ${command} failed: ${boundedSingleLine(stderr) || boundedSingleLine(String(error))}`,
  );
}

function gitArgs(range: string): string[] {
  return [
    'diff',
    '--no-ext-diff',
    '--no-textconv',
    '--no-color',
    '--src-prefix=a/',
    '--dst-prefix=b/',
    '--ignore-submodules=none',
    '--submodule=short',
    '--diff-algorithm=myers',
    '--find-renames=50%',
    '-l1000',
    '--unified=3',
    range,
    '--',
  ];
}

function gitSmall(args: string[], cwd: string): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    shell: false,
    maxBuffer: 256 * 1024,
  });
}

function repositoryRoot(cwd: string): string {
  try {
    return gitSmall(['rev-parse', '--show-toplevel'], cwd).trim();
  } catch (error) {
    throw gitFailure(error, 'rev-parse --show-toplevel');
  }
}

function resolveRevision(revision: string, cwd: string): string {
  validateRevision(revision);
  try {
    return gitSmall(
      ['rev-parse', '--verify', '--quiet', '--end-of-options', `${revision}^{commit}`],
      cwd,
    ).trim();
  } catch {
    throw new DiffUnavailableError(
      `No diff available: git cannot resolve revision ${echo(revision)}. The ref may not exist, or history may be incomplete, as in a shallow or partial clone. Read a prepared diff with --stdin.`,
    );
  }
}

function rangeParts(range: string): string[] {
  const safeRange = validateRange(range);
  if (safeRange.includes('...')) return safeRange.split('...');
  if (safeRange.includes('..')) return safeRange.split('..');
  return [safeRange];
}

function validateRepositoryRange(range: string, cwd: string): { root: string; range: string } {
  const root = repositoryRoot(cwd);
  const safeRange = validateRange(range);
  for (const part of rangeParts(safeRange)) resolveRevision(part ?? '', root);
  return { root, range: safeRange };
}

export async function collectGitDiffAsync(range: string, cwd = process.cwd()): Promise<string> {
  const { root, range: safeRange } = validateRepositoryRange(range, cwd);
  const child = spawn('git', gitArgs(safeRange), {
    cwd: root,
    shell: false,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const stdout: string[] = [];
  const stderr: string[] = [];
  let bytes = 0;
  let exceeded = false;
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    if (exceeded) return;
    bytes += Buffer.byteLength(chunk, 'utf8');
    if (bytes > MAX_DIFF_BYTES) {
      exceeded = true;
      child.kill();
      return;
    }
    stdout.push(chunk);
  });
  child.stderr.on('data', (chunk: string) => {
    if (stderr.join('').length < 64 * 1024) stderr.push(chunk);
  });
  return await new Promise<string>((resolve, reject) => {
    child.once('error', () => {
      reject(new DiffUnavailableError('No diff available: the git process could not be started.'));
    });
    child.once('close', (code, signal) => {
      if (exceeded) {
        reject(new DiffSizeLimitError());
        return;
      }
      if (code !== 0) {
        reject(
          new DiffUnavailableError(
            `No diff available: git diff exited ${code === null ? `on signal ${signal}` : `with code ${code}`}: ${boundedSingleLine(stderr.join('')) || 'no detail from git'}`,
          ),
        );
        return;
      }
      resolve(stdout.join(''));
    });
  });
}

/** Compatibility helper for existing synchronous integrations. The CLI and
 * Action use the async streaming function for bounded large-diff behavior. */
export function collectGitDiff(range: string, cwd = process.cwd()): string {
  const { root, range: safeRange } = validateRepositoryRange(range, cwd);
  try {
    return execFileSync('git', gitArgs(safeRange), {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      shell: false,
      maxBuffer: MAX_DIFF_BYTES,
    });
  } catch (error) {
    if (error instanceof Error && /ENOBUFS|maxBuffer/i.test(error.message))
      throw new DiffSizeLimitError();
    throw gitFailure(error, 'diff');
  }
}

function toBuffer(chunk: unknown): Buffer {
  if (Buffer.isBuffer(chunk)) return chunk;
  if (chunk instanceof Uint8Array) return Buffer.from(chunk);
  return Buffer.from(typeof chunk === 'string' ? chunk : String(chunk), 'utf8');
}

export async function readStdinDiff(
  source: AsyncIterable<unknown> = process.stdin,
): Promise<string> {
  // One decoder for the whole stream: a pipe can cut a multi-byte UTF-8 sequence
  // at any byte, and decoding each chunk separately turns both halves into
  // U+FFFD. The limit counts bytes actually read, not bytes re-encoded from text.
  const decoder = new StringDecoder('utf8');
  let text = '';
  let bytes = 0;
  for await (const chunk of source) {
    const buffer = toBuffer(chunk);
    bytes += buffer.length;
    if (bytes > MAX_DIFF_BYTES) throw new DiffSizeLimitError();
    text += decoder.write(buffer);
  }
  return text + decoder.end();
}
