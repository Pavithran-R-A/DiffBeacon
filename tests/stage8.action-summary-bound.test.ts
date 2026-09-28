/**
 * Stage 8, PHASES 14 and 35: the Action's one output file has a size the runner defines.
 * The cases here first measure that a diff inside DiffBeacon's own 8 MiB input bound can
 * really outgrow it, then run the shipped bundle against that boundary and require the
 * Action to stop rather than hand the runner a summary it would cut off.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { analyzeDiff, renderMarkdown } from '../packages/core/src/index.js';
import {
  createFixtureRepository,
  gitIn,
  removeFixtureRepository,
  writeRepositoryFile,
} from './git-repository-fixture.js';

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bundle = path.join(repository, 'packages/action/dist/index.js');
const temporary: string[] = [];

/** The limit GitHub documents for a step summary, stated here rather than imported. */
const STEP_SUMMARY_LIMIT = 1048576;

function scratch(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'diffbeacon-stage8-summary-'));
  temporary.push(dir);
  return dir;
}

beforeAll(() => {
  const built = spawnSync(process.execPath, ['scripts/build-action.mjs'], {
    cwd: repository,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  });
  expect(built.status, built.stderr).toBe(0);
});

afterAll(() => {
  for (const root of temporary.splice(0)) removeFixtureRepository(root);
});

interface Run {
  status: number | null;
  stdout: string;
  stderr: string;
  summaryBytes: number;
}

/** Run the shipped bundle with only the GITHUB_* variables a case specifies. */
function runAction(options: {
  workspace: string;
  base: string;
  head: string;
  summaryPath: string;
  seedBytes?: number;
}): Run {
  const dir = scratch();
  const eventPath = path.join(dir, 'event.json');
  writeFileSync(
    eventPath,
    JSON.stringify({ pull_request: { base: { sha: options.base }, head: { sha: options.head } } }),
  );
  if (options.seedBytes !== undefined)
    writeFileSync(options.summaryPath, 'x'.repeat(options.seedBytes));
  const env: NodeJS.ProcessEnv = {
    ...Object.fromEntries(
      Object.entries(process.env).filter(([key]) => !key.startsWith('GITHUB_')),
    ),
    GITHUB_EVENT_NAME: 'pull_request',
    GITHUB_EVENT_PATH: eventPath,
    GITHUB_WORKSPACE: options.workspace,
    GITHUB_STEP_SUMMARY: options.summaryPath,
  };
  const result = spawnSync(process.execPath, [bundle], {
    cwd: dir,
    env,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    summaryBytes: existsSync(options.summaryPath) ? statSync(options.summaryPath).size : 0,
  };
}

const fileBlock = (index: number): string =>
  [
    `diff --git a/src/f${index}.ts b/src/f${index}.ts`,
    'index 1111111..2222222 100644',
    `--- a/src/f${index}.ts`,
    `+++ b/src/f${index}.ts`,
    '@@ -0,0 +1,1 @@',
    `+export const v${index} = ${index};`,
  ].join('\n') + '\n';

describe('a summary can outgrow the limit the runner gives it', () => {
  it('measures a report over the step-summary limit from input inside the 8 MiB bound', () => {
    const blocks: string[] = [];
    let size = 0;
    for (let index = 0; index < 30_000; index += 1) {
      const block = fileBlock(index);
      if (size + block.length > 8 * 1024 * 1024) break;
      blocks.push(block);
      size += block.length;
    }
    const markdown = renderMarkdown(analyzeDiff(blocks.join('')));
    const markdownBytes = Buffer.byteLength(markdown, 'utf8');
    console.log(`measured: ${blocks.length} files, ${size} bytes in, ${markdownBytes} summary`);
    expect(size).toBeLessThanOrEqual(8 * 1024 * 1024);
    expect(markdownBytes).toBeGreaterThan(STEP_SUMMARY_LIMIT);
  });
});

describe('the Action stops instead of overflowing the summary file', () => {
  let fixture: { workspace: string; base: string; head: string } | null = null;

  /** One two-commit repository for the whole boundary matrix, built on first use. */
  function reviewedRepository(): { workspace: string; base: string; head: string } {
    if (fixture !== null) return fixture;
    const repo = createFixtureRepository({
      prefix: 'diffbeacon-stage8-summary-',
      identity: 'summary',
    });
    temporary.push(repo.root);
    writeRepositoryFile(repo.cwd, 'src/a.ts', 'export const a = 1;\n');
    repo.commit('base');
    const base = gitIn(repo.cwd, ['rev-parse', 'HEAD']);
    writeRepositoryFile(repo.cwd, 'src/a.ts', 'export const a = 2;\n');
    repo.commit('head');
    fixture = { workspace: repo.cwd, base, head: gitIn(repo.cwd, ['rev-parse', 'HEAD']) };
    return fixture;
  }

  function review(): Run {
    return runAction({ ...reviewedRepository(), summaryPath: path.join(scratch(), 'size.md') });
  }

  it('appends a normal review, and counts a second append of the same review', () => {
    const target = path.join(scratch(), 'twice.md');
    const once = runAction({ ...reviewedRepository(), summaryPath: target });
    expect(once.status, once.stderr).toBe(0);
    expect(once.summaryBytes).toBeGreaterThan(0);
    const again = runAction({ ...reviewedRepository(), summaryPath: target });
    expect(again.status, again.stderr).toBe(0);
    expect(again.summaryBytes).toBe(once.summaryBytes * 2);
  });

  it('takes the summary up to the exact limit and no further', () => {
    const reviewBytes = review().summaryBytes;
    const fits = STEP_SUMMARY_LIMIT - reviewBytes;

    const atLimit = path.join(scratch(), 'at-limit.md');
    const ok = runAction({ ...reviewedRepository(), summaryPath: atLimit, seedBytes: fits });
    expect(ok.status, ok.stderr).toBe(0);
    expect(ok.summaryBytes).toBe(STEP_SUMMARY_LIMIT);

    const oneOver = path.join(scratch(), 'one-over.md');
    const over = runAction({ ...reviewedRepository(), summaryPath: oneOver, seedBytes: fits + 1 });
    expect(over.status).not.toBe(0);
    expect(over.summaryBytes).toBe(fits + 1);
    expect(readFileSync(oneOver, 'utf8')).toBe('x'.repeat(fits + 1));
    expect(over.stderr).toContain(String(STEP_SUMMARY_LIMIT));
  });

  it('names the arithmetic it used instead of truncating silently', () => {
    const huge = path.join(scratch(), 'huge.md');
    const run = runAction({
      ...reviewedRepository(),
      summaryPath: huge,
      seedBytes: STEP_SUMMARY_LIMIT,
    });
    expect(run.status).not.toBe(0);
    expect(run.summaryBytes).toBe(STEP_SUMMARY_LIMIT);
    expect(run.stderr).not.toContain('xxxx');
    expect(run.stdout).toBe('');
  });
});
