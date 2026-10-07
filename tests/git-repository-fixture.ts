import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Test-only Git fixture. Each repository points core.hooksPath at an empty
// directory: without that, a temporary repository inherits the machine's global
// core.hooksPath and runs unrelated host hook programs during `git commit`, so
// Windows timings and failure counts depend on developer tooling, not DiffBeacon.

export interface FixtureRepository {
  root: string;
  cwd: string;
  hooksPath: string;
  git(args: string[]): string;
  gitRaw(args: string[]): string;
  commit(message: string): void;
}

export interface FixtureOptions {
  /** `mkdtemp` prefix; keep the `diffbeacon-` prefix so leaks stay identifiable. */
  prefix: string;
  /** Repository-local commit identity, so host Git config is not required. */
  identity: string;
  /** Optional repository subdirectory name, used to force paths containing spaces. */
  nestedPath?: string;
}

export function gitRawIn(cwd: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    windowsHide: true,
  });
}

export function gitIn(cwd: string, args: string[]): string {
  return gitRawIn(cwd, args).trim();
}

export function createFixtureRepository(options: FixtureOptions): FixtureRepository {
  const root = mkdtempSync(path.join(tmpdir(), options.prefix));
  const hooksPath = path.join(root, 'isolated-empty-hooks');
  mkdirSync(hooksPath, { recursive: true });
  const cwd = options.nestedPath ? path.join(root, options.nestedPath) : root;
  if (options.nestedPath) mkdirSync(cwd, { recursive: true });
  const git = (args: string[]) => gitIn(cwd, args);
  const gitRaw = (args: string[]) => gitRawIn(cwd, args);
  git(['init', '-q']);
  git(['config', 'user.email', `${options.identity}@example.invalid`]);
  git(['config', 'user.name', `DiffBeacon ${options.identity}`]);
  git(['config', 'core.hooksPath', hooksPath]);
  return {
    root,
    cwd,
    hooksPath,
    git,
    gitRaw,
    commit(message: string) {
      git(['add', '--all']);
      git(['commit', '-qm', message]);
    },
  };
}

// Bounded retries only: antivirus and just-exited Git processes can hold a
// freshly written object file for a few hundred milliseconds on Windows.
export function removeFixtureRepository(root: string): void {
  rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}

export function writeRepositoryFile(
  cwd: string,
  relativePath: string,
  content: string | Buffer,
): void {
  const target = path.join(cwd, relativePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content);
}
