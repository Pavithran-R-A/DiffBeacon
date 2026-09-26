import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  createFixtureRepository,
  gitIn,
  removeFixtureRepository,
  writeRepositoryFile,
} from './git-repository-fixture.js';

// Stage 6, PHASES 9 and 15-18: the reviewed repository is data. Every "nothing ran" claim in
// this file is paired with a live control proving the same fixture DOES execute a program
// when an ordinary Git command is allowed to use it, so an inert fixture can never be mistaken
// for evidence. The trusted bundle always runs from its own build directory while
// GITHUB_WORKSPACE names the hostile target, which is the separation Stage 6 requires.

vi.setConfig({ testTimeout: 90_000, hookTimeout: 90_000 });

const repository = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const bundle = path.join(repository, 'packages/action/dist/index.js');
const temporary: string[] = [];
const hostEnv = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !key.startsWith('GITHUB_')),
);

beforeAll(() => {
  const built = spawnSync(process.execPath, ['scripts/build-action.mjs'], {
    cwd: repository,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  });
  expect(built.status, built.stderr).toBe(0);
});

afterEach(() => {
  for (const root of temporary.splice(0)) removeFixtureRepository(root);
});

function scratch(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'diffbeacon-stage6-sec-'));
  temporary.push(dir);
  return dir;
}

const forwardSlashes = (value: string) => value.split(path.sep).join('/');

/** Run the trusted bundle with the process working directory outside the reviewed repo. */
function reviewWorkspace(workspace: string, base: string, head: string) {
  const dir = scratch();
  const eventPath = path.join(dir, 'event.json');
  const summaryPath = path.join(dir, 'step-summary.md');
  writeFileSync(
    eventPath,
    JSON.stringify({ pull_request: { base: { sha: base }, head: { sha: head } } }),
  );
  const result = spawnSync(process.execPath, [bundle], {
    cwd: dir,
    env: {
      ...hostEnv,
      GITHUB_EVENT_NAME: 'pull_request',
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_WORKSPACE: workspace,
      GITHUB_STEP_SUMMARY: summaryPath,
    },
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    summary: existsSync(summaryPath) ? readFileSync(summaryPath, 'utf8') : null,
  };
}

/** Every file in the tree whose name starts with SENTINEL, as repository-relative paths. */
function sentinels(root: string): string[] {
  const found: string[] = [];
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.startsWith('SENTINEL'))
        found.push(forwardSlashes(path.relative(root, full)));
    }
  };
  walk(root);
  return found.sort();
}

function clearSentinels(root: string): void {
  for (const found of sentinels(root)) rmSync(path.join(root, found), { force: true });
}

const nodeSentinel = (name: string) =>
  `${forwardSlashes(process.execPath)} -e "require('node:fs').writeFileSync('${name}','')"`;

/**
 * A repository whose every plausible execution surface is booby-trapped: package lifecycle
 * scripts, `.npmrc`, Git hooks, an external diff program, a textconv driver routed through
 * `.gitattributes`, executable files, and a pull-request-controlled `action.yml` plus Action
 * bundle that write a sentinel the moment they run.
 */
function hostileRepository() {
  // The repository lives in a subdirectory so the fixture's own scaffolding (empty hook
  // directory, sentinels) can never be mistaken for untracked files the review dirtied.
  const repo = createFixtureRepository({
    prefix: 'diffbeacon-stage6-hostile-',
    identity: 'x',
    nestedPath: 'reviewed',
  });
  temporary.push(repo.root);

  writeRepositoryFile(repo.cwd, 'reviewed.ts', 'export const value = 1;\n');
  writeRepositoryFile(repo.cwd, 'renamed-before.ts', 'export const moved = 1;\n');
  writeRepositoryFile(repo.cwd, 'bin/launch-me.sh', '#!/bin/sh\ntouch SENTINEL-mode-change\n');
  writeRepositoryFile(
    repo.cwd,
    'package.json',
    `${JSON.stringify(
      {
        name: 'reviewed-project',
        version: '1.0.0',
        scripts: {
          preinstall: nodeSentinel('SENTINEL-preinstall'),
          install: nodeSentinel('SENTINEL-install'),
          postinstall: nodeSentinel('SENTINEL-postinstall'),
          prepare: nodeSentinel('SENTINEL-prepare'),
          build: nodeSentinel('SENTINEL-build'),
          test: nodeSentinel('SENTINEL-test'),
        },
      },
      null,
      2,
    )}\n`,
  );
  writeRepositoryFile(
    repo.cwd,
    '.npmrc',
    'ignore-scripts=false\n//registry.npmjs.org/:_authToken=not-a-real-token\n',
  );
  // A pull-request-controlled Action implementation. A workflow that runs it is executing the
  // change it is supposed to read, which is the pattern Stage 6 refuses to document.
  writeRepositoryFile(
    repo.cwd,
    'action.yml',
    'name: Pwned\nruns:\n  using: node24\n  pre: node ./packages/action/dist/index.js\n  main: ./packages/action/dist/index.js\n',
  );
  writeRepositoryFile(
    repo.cwd,
    'packages/action/dist/index.js',
    "import('node:fs').then((fs) => fs.writeFileSync('SENTINEL-target-bundle', ''));\n",
  );
  writeRepositoryFile(
    repo.cwd,
    'scripts/evil.js',
    "import('node:fs').then((fs) => fs.writeFileSync('SENTINEL-repo-script', ''));\n",
  );
  writeRepositoryFile(repo.cwd, 'evil.sh', '#!/bin/sh\ntouch SENTINEL-shell\n');
  writeRepositoryFile(repo.cwd, 'evil.ps1', 'Set-Content -Path SENTINEL-powershell -Value ""\n');
  writeRepositoryFile(repo.cwd, '.gitattributes', '*.ts diff=hostile\n');
  repo.commit('base');
  const base = gitIn(repo.cwd, ['rev-parse', 'HEAD']);

  writeRepositoryFile(repo.cwd, 'reviewed.ts', 'export const value = 2;\n');
  writeRepositoryFile(repo.cwd, '$(touch PWNED).ts', 'export const shell = 1;\n');
  writeRepositoryFile(repo.cwd, 'back`tick-angle.ts', 'export const markup = 1;\n');
  writeRepositoryFile(repo.cwd, 'semi;colon.ts', 'export const separator = 1;\n');
  writeRepositoryFile(repo.cwd, '[link](example.invalid).ts', 'export const md = 1;\n');
  writeRepositoryFile(repo.cwd, '#hash-tilde~wave.ts', 'export const punctuation = 1;\n');
  writeRepositoryFile(repo.cwd, 'unicodé-文件.ts', 'export const unicode = 1;\n');
  writeRepositoryFile(repo.cwd, 'emoji-\u{1f600}.ts', 'export const pictograph = 1;\n');
  mkdirSync(path.join(repo.cwd, 'dir with spaces'), { recursive: true });
  writeFileSync(
    path.join(repo.cwd, 'dir with spaces/payload.bin'),
    Buffer.from([0, 1, 2, 255, 0, 1]),
  );
  gitIn(repo.cwd, ['mv', 'renamed-before.ts', 'renamed-after.ts']);
  // A mode-only change has to survive the fixture's own `git add --all`. Windows has no
  // usable executable bit, so the mode is recorded directly in the index; Linux reads the
  // filesystem back, so the file is chmod'ed too. Doing only one of the two produced a
  // repository with no mode change at all on the other platform.
  chmodSync(path.join(repo.cwd, 'bin/launch-me.sh'), 0o755);
  gitIn(repo.cwd, ['update-index', '--chmod=+x', '--', 'bin/launch-me.sh']);
  repo.commit('head with adversarial paths');
  const head = gitIn(repo.cwd, ['rev-parse', 'HEAD']);

  // Adversarial hooks, installed once the fixture's own history exists.
  // The fixture redirects core.hooksPath away from .git/hooks so host hooks never run;
  // a repository can only fire its own hooks through the path Git is actually configured to use.
  for (const hook of ['pre-commit', 'post-checkout']) {
    const file = path.join(repo.hooksPath, hook);
    writeFileSync(
      file,
      `#!/bin/sh\ntouch "${forwardSlashes(path.join(repo.root, `SENTINEL-${hook}`))}"\n`,
    );
    chmodSync(file, 0o755);
  }
  return { repo, base, head };
}

/** The diff-shaping configuration a hostile repository can set for itself. */
function applyHostileDiffShape(workspace: string): void {
  gitIn(workspace, ['config', 'diff.noprefix', 'true']);
  gitIn(workspace, ['config', 'diff.mnemonicPrefix', 'true']);
  gitIn(workspace, ['config', 'diff.srcPrefix', 'zzz/']);
  gitIn(workspace, ['config', 'diff.dstPrefix', 'yyy/']);
  gitIn(workspace, ['config', 'diff.renameLimit', '1']);
  gitIn(workspace, ['config', 'diff.algorithm', 'histogram']);
}

/**
 * Point Git at a program stored inside the reviewed repository. A `.gitattributes` file in the
 * change routes `*.ts` to the textconv driver; `diff.external` is the repository-wide form.
 */
function applyHostileDiffProgram(workspace: string, kind: 'textconv' | 'external'): void {
  const program = `touch "${forwardSlashes(path.join(workspace, `SENTINEL-${kind}`))}"`;
  if (kind === 'textconv') {
    gitIn(workspace, ['config', 'diff.hostile.textconv', program]);
    return;
  }
  gitIn(workspace, ['config', 'diff.external', program]);
}

/** Both diff-time programs at once, which is what the review under test has to survive. */
function applyHostileDiffConfiguration(workspace: string): void {
  applyHostileDiffShape(workspace);
  applyHostileDiffProgram(workspace, 'textconv');
  applyHostileDiffProgram(workspace, 'external');
}

describe('the reviewed repository is never executed', () => {
  it('live control: an unprotected git diff really does run the configured textconv', () => {
    const { repo, base, head } = hostileRepository();
    applyHostileDiffShape(repo.cwd);
    applyHostileDiffProgram(repo.cwd, 'textconv');
    const plain = gitIn(repo.cwd, ['diff', base, head, '--', 'reviewed.ts']);
    expect(sentinels(repo.root), `sentinels: ${sentinels(repo.root).join(', ')}`).toContain(
      'reviewed/SENTINEL-textconv',
    );
    // The driver replaced both versions with an empty file, so the unprotected diff reports
    // nothing at all: running the repository's program is not even the worst part.
    expect(plain).toBe('');
    expect(
      gitIn(repo.cwd, ['diff', '--no-ext-diff', '--no-textconv', base, head, '--', 'reviewed.ts']),
    ).toContain('reviewed.ts');
  });

  it('live control: an unprotected git diff really does run the configured external diff', () => {
    const { repo, base, head } = hostileRepository();
    applyHostileDiffShape(repo.cwd);
    applyHostileDiffProgram(repo.cwd, 'external');
    gitIn(repo.cwd, ['diff', base, head, '--', 'reviewed.ts']);
    expect(sentinels(repo.root), `sentinels: ${sentinels(repo.root).join(', ')}`).toContain(
      'reviewed/SENTINEL-external',
    );
  });

  it('live control: a real git commit really does run repository hooks', () => {
    const { repo } = hostileRepository();
    writeRepositoryFile(repo.cwd, 'hook-trigger.txt', 'commit that runs the hook\n');
    gitIn(repo.cwd, ['add', '--', 'hook-trigger.txt']);
    gitIn(repo.cwd, ['commit', '-qm', 'trigger hooks']);
    expect(sentinels(repo.root), `sentinels: ${sentinels(repo.root).join(', ')}`).toContain(
      'SENTINEL-pre-commit',
    );
  });

  it('reviewing a booby-trapped repository creates no sentinel anywhere in it', () => {
    const { repo, base, head } = hostileRepository();
    applyHostileDiffConfiguration(repo.cwd);
    clearSentinels(repo.root);
    const targetBundle = readFileSync(path.join(repo.cwd, 'packages/action/dist/index.js'), 'utf8');

    const run = reviewWorkspace(repo.cwd, base, head);
    expect(run.status, run.stderr).toBe(0);
    expect(run.stdout).toBe('');
    expect(run.stderr).toBe('');
    expect(run.summary).toContain('# DiffBeacon review');
    expect(sentinels(repo.root), `sentinels: ${sentinels(repo.root).join(', ')}`).toEqual([]);
    expect(existsSync(path.join(repo.cwd, 'node_modules'))).toBe(false);
    expect(existsSync(path.join(repo.cwd, 'PWNED'))).toBe(false);
    expect(readFileSync(path.join(repo.cwd, 'packages/action/dist/index.js'), 'utf8')).toBe(
      targetBundle,
    );
    expect(gitIn(repo.cwd, ['status', '--porcelain'])).toBe('');
  });

  it('the code that runs is the trusted bundle, resolved outside the reviewed repository', () => {
    const { repo, base, head } = hostileRepository();
    applyHostileDiffConfiguration(repo.cwd);
    clearSentinels(repo.root);
    const run = reviewWorkspace(repo.cwd, base, head);
    expect(run.status, run.stderr).toBe(0);
    expect(run.summary).toContain('## Changed files');
    expect(sentinels(repo.root)).toEqual([]);
    // The hostile action.yml names its own bundle as the entrypoint. Nothing in the reviewed
    // tree is ever a candidate for execution, so the two roots must stay disjoint.
    expect(forwardSlashes(path.resolve(bundle))).not.toContain(forwardSlashes(repo.root));
  });
});

describe('repository diff configuration cannot change what is collected', () => {
  it('the report is identical with and without hostile diff configuration', () => {
    const { repo, base, head } = hostileRepository();
    const clean = reviewWorkspace(repo.cwd, base, head);
    expect(clean.status, clean.stderr).toBe(0);
    applyHostileDiffConfiguration(repo.cwd);
    clearSentinels(repo.root);
    const hostile = reviewWorkspace(repo.cwd, base, head);
    expect(hostile.status, hostile.stderr).toBe(0);
    expect(hostile.summary).toBe(clean.summary);
    expect(sentinels(repo.root), `sentinels: ${sentinels(repo.root).join(', ')}`).toEqual([]);
  });

  it('paths that look like shell commands, markup, or code spans are reported as data', () => {
    const { repo, base, head } = hostileRepository();
    applyHostileDiffConfiguration(repo.cwd);
    clearSentinels(repo.root);
    const run = reviewWorkspace(repo.cwd, base, head);
    expect(run.status, run.stderr).toBe(0);
    const summary = run.summary ?? '';
    for (const hostilePath of [
      '$(touch PWNED).ts',
      '[link](example.invalid).ts',
      '#hash-tilde~wave.ts',
      'unicodé-文件.ts',
      'emoji-\u{1f600}.ts',
      'semi;colon.ts',
      'dir with spaces/payload.bin',
      'bin/launch-me.sh',
    ]) {
      expect(summary, `missing ${hostilePath}`).toContain(`\`${hostilePath}\``);
    }
    // A backtick inside a path cannot open a code span.
    expect(summary).toContain('`back&#96;tick-angle.ts`');
    // A link-shaped path stays literal text: no Markdown target is reachable from it.
    expect(summary).not.toContain('[link](example.invalid).ts](');
    expect(existsSync(path.join(repo.cwd, 'PWNED'))).toBe(false);
    expect(sentinels(repo.root)).toEqual([]);
  });

  it('binary, mode-only and rename changes are reported through the bundle', () => {
    const { repo, base, head } = hostileRepository();
    applyHostileDiffConfiguration(repo.cwd);
    clearSentinels(repo.root);
    const run = reviewWorkspace(repo.cwd, base, head);
    expect(run.status, run.stderr).toBe(0);
    const summary = run.summary ?? '';
    expect(summary).toMatch(/^\| Binary files \| 1 \|$/m);
    expect(summary).toMatch(/^\| Mode-only files \| 1 \|$/m);
    expect(summary).toMatch(/^\| Changed files \| 11 \|$/m);
    expect(summary).toContain('| renamed | `renamed-after.ts` |');
    expect(summary).toContain('| mode-only | `bin/launch-me.sh` |');
  });
});
