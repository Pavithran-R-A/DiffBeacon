/**
 * Stage 8, PHASE 29: the CLI's own no-execution boundary. Stage 6 already proved it for the
 * GitHub Action against a repository whose every plausible execution surface was booby-trapped;
 * this file asks the same question of the path a reviewer takes on their own machine —
 * `packages/cli/src/git.ts` running Git inside a directory the operator pointed at. Nothing here
 * repeats a Stage 6 case: the entry point, the working directory, and the process that could be
 * started are all different.
 *
 * Every "nothing ran" assertion is paired with a control on the *same* fixture, so a scan pointed
 * at the wrong directory, or a sentinel program that cannot actually write, fails the control
 * instead of passing vacuously. Sentinels are written only inside a disposable temporary
 * directory; no install command is ever run, and the control that proves a package script is
 * capable of writing its sentinel is the test itself running that script's own Node command.
 */

import { chmodSync, existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyzeDiff } from '../packages/core/src/index.js';
import { main } from '../packages/cli/src/index.js';
import { collectGitDiffAsync } from '../packages/cli/src/git.js';
import {
  createFixtureRepository,
  gitIn,
  removeFixtureRepository,
  writeRepositoryFile,
  type FixtureRepository,
} from './git-repository-fixture.js';

// Five real repositories, each with two commits, on a host whose antivirus holds object files.
vi.setConfig({ testTimeout: 180_000 });

const forward = (value: string): string => value.split('\\').join('/');

/** The lifecycle hooks npm would run, and the Git hook the fixture installs. */
const LIFECYCLE = ['preinstall', 'install', 'postinstall', 'prepare'] as const;

interface Trap {
  repo: FixtureRepository;
  base: string;
  head: string;
  range: string;
}

const traps: string[] = [];

/** Every file named `SENTINEL*` under `root`, as sorted forward-slash relative paths. */
function sentinels(root: string): string[] {
  const found: string[] = [];
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.startsWith('SENTINEL')) found.push(forward(path.relative(root, full)));
    }
  };
  walk(root);
  return found.sort();
}

function clearSentinels(root: string): void {
  for (const relative of sentinels(root)) rmSync(path.join(root, relative), { force: true });
}

/** The command a package script holds, reduced to the Node call npm would make. */
const nodeSentinel = (name: string) => `-e require('node:fs').writeFileSync('${name}','')`;

/** Every recorded sentinel whose path ends in `name`, wherever in the fixture it landed. */
const hasSentinel = (root: string, name: string): boolean =>
  sentinels(root).some((relative) => relative.endsWith(name));

/**
 * A repository that would run something if it were installed, committed into, or diffed without
 * the pinned controls: npm lifecycle scripts, an `.npmrc` with registry credentials, a
 * repository-configured external diff and a `.gitattributes`-routed textconv driver, an
 * executable file with a mode change, and a hook in the `core.hooksPath` Git is configured to use.
 */
function boobyTrappedRepository(identity: string): Trap {
  // The repository lives in a subdirectory so the fixture's own scaffolding (the hook directory
  // and every sentinel) is outside the reviewed working tree and can never be mistaken for dirt
  // the review made.
  const repo = createFixtureRepository({
    prefix: `diffbeacon-stage8-noexec-${identity}-`,
    identity,
    nestedPath: 'reviewed',
  });
  traps.push(repo.root);

  writeRepositoryFile(repo.cwd, 'src/app.ts', 'export const value = 1;\n');
  writeRepositoryFile(
    repo.cwd,
    'package.json',
    `${JSON.stringify(
      {
        name: 'reviewed-project',
        version: '1.0.0',
        scripts: Object.fromEntries(
          LIFECYCLE.map((script) => [script, nodeSentinel(`SENTINEL-${script}`)]),
        ),
      },
      null,
      2,
    )}\n`,
  );
  writeRepositoryFile(repo.cwd, '.npmrc', 'ignore-scripts=false\n');
  writeRepositoryFile(repo.cwd, 'src/hostile.ts', 'export const before = 1;\n');
  writeRepositoryFile(repo.cwd, '.gitattributes', '*.ts diff=hostile\n');
  repo.commit('base');
  const base = gitIn(repo.cwd, ['rev-parse', 'HEAD']);

  writeRepositoryFile(repo.cwd, 'src/app.ts', 'export const value = 2;\n');
  writeRepositoryFile(repo.cwd, 'src/hostile.ts', 'export const after = 2;\n');
  writeRepositoryFile(repo.cwd, 'bin/launch-me.sh', '#!/bin/sh\ntouch SENTINEL-mode-change\n');
  chmodSync(path.join(repo.cwd, 'bin/launch-me.sh'), 0o755);
  // `update-index --chmod` only speaks about paths already in the index, so the new file is
  // staged before its mode is recorded; doing only one of the two left the change invisible.
  gitIn(repo.cwd, ['add', '--', 'bin/launch-me.sh']);
  gitIn(repo.cwd, ['update-index', '--chmod=+x', '--', 'bin/launch-me.sh']);
  repo.commit('head');
  const head = gitIn(repo.cwd, ['rev-parse', 'HEAD']);

  // Hooks live in the path Git was configured to use, so a real commit in this fixture does fire.
  const hook = path.join(repo.hooksPath, 'pre-commit');
  writeFileSync(
    hook,
    `#!/bin/sh\ntouch "${forward(path.join(repo.root, 'SENTINEL-pre-commit'))}"\n`,
  );
  chmodSync(hook, 0o755);

  // The two diff-time programs, configured the way a reviewed repository can configure itself.
  // Their sentinels land outside the working tree, so the review cases still read a clean tree.
  gitIn(repo.cwd, [
    'config',
    'diff.external',
    `touch "${forward(path.join(repo.root, 'SENTINEL-external'))}"`,
  ]);
  gitIn(repo.cwd, [
    'config',
    'diff.hostile.textconv',
    `touch "${forward(path.join(repo.root, 'SENTINEL-textconv'))}"`,
  ]);

  return { repo, base, head, range: `${base}...${head}` };
}

/** Run the shipped CLI inside `cwd`, the way a reviewer standing in that repository would. */
async function review(
  cwd: string,
  args: string[],
): Promise<{ code: number; stdout: string; stderr: string }> {
  const previous = process.cwd();
  let stdout = '';
  let stderr = '';
  const out = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    stdout += String(chunk);
    return true;
  });
  const err = vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
    stderr += String(chunk);
    return true;
  });
  try {
    process.chdir(cwd);
    return { code: await main(['review', ...args]), stdout, stderr };
  } finally {
    process.chdir(previous);
    out.mockRestore();
    err.mockRestore();
  }
}

afterEach(() => {
  for (const root of traps.splice(0)) removeFixtureRepository(root);
});

describe('the reviewed repository stays data for the CLI too', () => {
  it('live control: a real commit in the fixture does run its hook', () => {
    const trap = boobyTrappedRepository('hook');
    expect(sentinels(trap.repo.root)).toEqual([]);
    writeRepositoryFile(trap.repo.cwd, 'trigger.txt', 'a commit that runs the hook\n');
    gitIn(trap.repo.cwd, ['add', '--', 'trigger.txt']);
    gitIn(trap.repo.cwd, ['commit', '-qm', 'trigger the hook']);
    expect(sentinels(trap.repo.root), sentinels(trap.repo.root).join(', ')).toContain(
      'SENTINEL-pre-commit',
    );
  });

  it('live control: the package script the fixture declares really can write its sentinel', () => {
    const trap = boobyTrappedRepository('script');
    const manifest = JSON.parse(readFileSync(path.join(trap.repo.cwd, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(Object.keys(manifest.scripts).sort()).toEqual([...LIFECYCLE].sort());
    const command = manifest.scripts.postinstall as string;
    const [, name] = /writeFileSync\('([^']+)'/u.exec(command) ?? [];
    expect(name).toBe('SENTINEL-postinstall');
    // The same program line npm would hand to a shell, started here by the test — never by
    // DiffBeacon, which is what the two review cases below then assert against.
    execFileSync(process.execPath, command.split(' '), {
      cwd: trap.repo.cwd,
      shell: false,
      windowsHide: true,
    });
    expect(
      hasSentinel(trap.repo.root, 'SENTINEL-postinstall'),
      sentinels(trap.repo.root).join(', '),
    ).toBe(true);
  });

  it('collecting the diff runs no hook, no diff driver, and no installer', async () => {
    const trap = boobyTrappedRepository('collect');
    const before = readFileSync(path.join(trap.repo.cwd, 'package.json'), 'utf8');
    const diff = await collectGitDiffAsync(trap.range, trap.repo.cwd);
    expect(diff).toContain('diff --git a/src/app.ts b/src/app.ts');
    expect(analyzeDiff(diff).summary.changedFiles).toBeGreaterThan(0);
    expect(sentinels(trap.repo.root), sentinels(trap.repo.root).join(', ')).toEqual([]);
    expect(existsSync(path.join(trap.repo.cwd, 'node_modules'))).toBe(false);
    expect(existsSync(path.join(trap.repo.cwd, 'package-lock.json'))).toBe(false);
    expect(readFileSync(path.join(trap.repo.cwd, 'package.json'), 'utf8')).toBe(before);
    expect(gitIn(trap.repo.cwd, ['status', '--porcelain'])).toBe('');
  });

  it('the whole CLI review leaves the booby-trapped repository untouched', async () => {
    const trap = boobyTrappedRepository('review');
    const run = await review(trap.repo.cwd, [trap.range, '--format', 'json']);
    expect(run.code, run.stderr).toBe(0);
    expect(run.stderr).toBe('');
    expect(JSON.parse(run.stdout).summary.changedFiles).toBeGreaterThan(0);
    expect(sentinels(trap.repo.root), sentinels(trap.repo.root).join(', ')).toEqual([]);
    expect(existsSync(path.join(trap.repo.cwd, 'node_modules'))).toBe(false);
    expect(gitIn(trap.repo.cwd, ['status', '--porcelain'])).toBe('');
    // The executable bit is reported as data, never honoured as a program to run.
    expect(run.stdout).toContain('100755');
  });

  it('an unprotected diff on the same fixture does run the configured external program', () => {
    // The paired control for the case above: without the pinned `--no-ext-diff` the repository's
    // own `diff.external` is started by Git, so "nothing ran" is a property of the pin, not of
    // this host's Git refusing to run anything.
    const trap = boobyTrappedRepository('unprotected');
    execFileSync('git', ['diff', trap.base, trap.head, '--', 'src/app.ts'], {
      cwd: trap.repo.cwd,
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    expect(sentinels(trap.repo.root), sentinels(trap.repo.root).join(', ')).toContain(
      'SENTINEL-external',
    );
    clearSentinels(trap.repo.root);
    expect(sentinels(trap.repo.root)).toEqual([]);
  });
});
