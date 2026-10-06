/**
 * DiffBeacon Git boundary: fixed argument arrays, shell=false, no hooks or
 * target-code execution, and a bounded streaming diff collector shared by CLI
 * and Action. The caller may hand one explicit child environment to every Git
 * process in a collection; leaving it unset keeps Git's own inheritance, which
 * is what a CLI operator in their own environment expects. The explicit diff
 * controls make the structural input independent of user/repository diff
 * prefixes, algorithms, and rename settings. Myers is
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

function gitSmall(args: string[], cwd: string, env?: NodeJS.ProcessEnv): string {
  return execFileSync('git', args, {
    cwd,
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    shell: false,
    maxBuffer: 256 * 1024,
  });
}

/**
 * The child environment every Git process in one collection uses. Callers that must pin a
 * repository boundary — the Action — supply it; `undefined` keeps Git's own inheritance, which is
 * what a CLI operator running DiffBeacon in their own environment expects.
 */
export interface GitProcessOptions {
  env?: NodeJS.ProcessEnv;
}

function repositoryRoot(cwd: string, env?: NodeJS.ProcessEnv): string {
  try {
    return gitSmall(['rev-parse', '--show-toplevel'], cwd, env).trim();
  } catch (error) {
    throw gitFailure(error, 'rev-parse --show-toplevel');
  }
}

function resolveRevision(revision: string, cwd: string, env?: NodeJS.ProcessEnv): string {
  validateRevision(revision);
  try {
    return gitSmall(
      ['rev-parse', '--verify', '--quiet', '--end-of-options', `${revision}^{commit}`],
      cwd,
      env,
    ).trim();
  } catch {
    throw new DiffUnavailableError(
      `No diff available: git cannot resolve revision ${echo(revision)}. The ref may not exist, or history may be incomplete, as in a shallow or partial clone. Read a prepared diff with --stdin.`,
    );
  }
}

function snapshotRange(range: string, cwd: string, env?: NodeJS.ProcessEnv): string {
  const safeRange = validateRange(range);
  const operator = safeRange.includes('...') ? '...' : '..';
  const [left, right] = safeRange.split(operator);
  let resolved: string[];
  try {
    resolved = gitSmall(
      [
        'rev-parse',
        '--revs-only',
        '--end-of-options',
        `${left ?? ''}^{commit}`,
        `${right ?? ''}^{commit}`,
      ],
      cwd,
      env,
    )
      .trim()
      .split(/\r?\n/)
      .filter((value) => value !== '');
  } catch (error) {
    throw gitFailure(error, 'rev-parse range');
  }
  const fullObjectId = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
  if (resolved.length !== 2 || !resolved.every((value) => fullObjectId.test(value))) {
    // Keep the established side-specific error when only one endpoint is missing.
    for (const part of [left, right]) resolveRevision(part ?? '', cwd, env);
    throw new DiffUnavailableError(
      'No diff available: git could not snapshot both range endpoints as commit object IDs.',
    );
  }
  return `${resolved[0]}${operator}${resolved[1]}`;
}

function validateRepositoryRange(
  range: string,
  cwd: string,
  options: GitProcessOptions,
): { root: string; range: string } {
  const root = repositoryRoot(cwd, options.env);
  return { root, range: snapshotRange(range, root, options.env) };
}

export async function collectGitDiffAsync(
  range: string,
  cwd = process.cwd(),
  options: GitProcessOptions = {},
): Promise<string> {
  const { root, range: safeRange } = validateRepositoryRange(range, cwd, options);
  const child = spawn('git', gitArgs(safeRange), {
    cwd: root,
    env: options.env,
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
export function collectGitDiff(
  range: string,
  cwd = process.cwd(),
  options: GitProcessOptions = {},
): string {
  const { root, range: safeRange } = validateRepositoryRange(range, cwd, options);
  try {
    return execFileSync('git', gitArgs(safeRange), {
      cwd: root,
      env: options.env,
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
