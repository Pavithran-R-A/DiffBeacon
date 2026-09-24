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
import { MAX_DIFF_BYTES } from '../../core/src/model.js';
import { validateRange, validateRevision } from './revisions.js';

export class DiffSizeLimitError extends Error {
  constructor(public readonly limitBytes = MAX_DIFF_BYTES) {
    super(`DiffBeacon analysis limit exceeded: the diff is larger than ${limitBytes} bytes.`);
    this.name = 'DiffSizeLimitError';
  }
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
  return gitSmall(['rev-parse', '--show-toplevel'], cwd).trim();
}

function resolveRevision(revision: string, cwd: string): string {
  validateRevision(revision);
  return gitSmall(
    ['rev-parse', '--verify', '--quiet', '--end-of-options', `${revision}^{commit}`],
    cwd,
  ).trim();
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
    child.once('error', reject);
    child.once('close', (code, signal) => {
      if (exceeded) {
        reject(new DiffSizeLimitError());
        return;
      }
      if (code !== 0) {
        reject(
          new Error(`git diff failed${signal ? ` with ${signal}` : ''}: ${stderr.join('').trim()}`),
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
    throw error;
  }
}

export async function readStdinDiff(): Promise<string> {
  const chunks: string[] = [];
  let bytes = 0;
  for await (const chunk of process.stdin) {
    const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    bytes += Buffer.byteLength(text, 'utf8');
    if (bytes > MAX_DIFF_BYTES) throw new DiffSizeLimitError();
    chunks.push(text);
  }
  return chunks.join('');
}
