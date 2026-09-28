/**
 * Stage 8, PHASES 21 and 22: the two files the Action is handed by the runner. Every case
 * here runs the shipped bundle, because these boundaries are environment binding rather than
 * library behaviour. The observed shapes come from `stage8/probe-action-paths.log` on this
 * host: the summary-path failures and the event-shape rejections already behaved, and one
 * shape did not — an event file holding JSON `null` printed the engine's own property-access
 * message instead of a DiffBeacon message.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  createFixtureRepository,
  gitIn,
  removeFixtureRepository,
  writeRepositoryFile,
} from './git-repository-fixture.js';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bundle = path.join(repository, 'packages/action/dist/index.js');
const temporary: string[] = [];

beforeAll(() => {
  const built = spawnSync(process.execPath, ['scripts/build-action.mjs'], {
    cwd: repository,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  });
  expect(built.status, built.stderr).toBe(0);
});

// One repository is reviewed by every case, so cleanup happens once at the end: removing it
// between cases would leave the cached path pointing at a directory Git can no longer enter.
afterAll(() => {
  for (const root of temporary.splice(0)) removeFixtureRepository(root);
});

function scratch(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'diffbeacon-stage8-paths-'));
  temporary.push(dir);
  return dir;
}

let reviewed: { workspace: string; base: string; head: string } | null = null;
function reviewedRepository() {
  if (reviewed !== null) return reviewed;
  const repo = createFixtureRepository({ prefix: 'diffbeacon-stage8-paths-', identity: 'paths' });
  temporary.push(repo.root);
  writeRepositoryFile(repo.cwd, 'src/a.ts', 'export const a = 1;\n');
  repo.commit('base');
  const base = gitIn(repo.cwd, ['rev-parse', 'HEAD']);
  writeRepositoryFile(repo.cwd, 'src/a.ts', 'export const a = 2;\n');
  repo.commit('head');
  reviewed = { workspace: repo.cwd, base, head: gitIn(repo.cwd, ['rev-parse', 'HEAD']) };
  return reviewed;
}

interface Run {
  status: number | null;
  stdout: string;
  stderr: string;
  summaryPath: string;
}

/** Run the bundle with the reviewed repository and one deliberately shaped pair of files. */
function runAction(eventContents: string | null, summaryPath: string): Run {
  const { workspace, base, head } = reviewedRepository();
  const dir = scratch();
  const eventFile = path.join(dir, 'event.json');
  writeFileSync(
    eventFile,
    eventContents ?? JSON.stringify({ pull_request: { base: { sha: base }, head: { sha: head } } }),
  );
  const result = spawnSync(process.execPath, [bundle], {
    cwd: dir,
    env: {
      ...Object.fromEntries(
        Object.entries(process.env).filter(([key]) => !key.startsWith('GITHUB_')),
      ),
      GITHUB_EVENT_NAME: 'pull_request',
      GITHUB_EVENT_PATH: eventFile,
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
    summaryPath,
  };
}

const summaryIn = () => path.join(scratch(), 'step-summary.md');
const bytesLeft = (run: Run) =>
  existsSync(run.summaryPath) && !statSync(run.summaryPath).isDirectory()
    ? statSync(run.summaryPath).size
    : null;

/** A message that names the variable and the contract, never the engine's own words. */
function expectStableFailure(run: Run, variable: string) {
  expect(run.status, run.stderr).not.toBe(0);
  expect(run.stderr).toContain(variable);
  expect(run.stderr).not.toMatch(/Cannot read propert|is not a function|undefined is not/);
  expect(run.stderr).not.toMatch(/\b(?:ENOENT|EISDIR|ENOTDIR|EPERM|EACCES|ERR_(?:STRING_|MAX_))/);
  expect(run.stderr).not.toContain('    at ');
  expect(run.stdout).toBe('');
}

describe('the event file the runner points at', () => {
  it('answers a JSON null event with a DiffBeacon message, not the engine property-access error', () => {
    const run = runAction('null', summaryIn());
    expectStableFailure(run, 'GITHUB_EVENT_PATH');
  });

  it('refuses every other non-object event shape before Git is consulted', () => {
    for (const contents of ['[1,2,3]', '"../../../../etc/passwd"', '42', 'true']) {
      const run = runAction(contents, summaryIn());
      expect(run.status, `${contents}: ${run.stderr}`).not.toBe(0);
      expect(bytesLeft(run)).toBeNull();
    }
  });

  it('survives a deeply nested event file and still rejects it on the object-ID contract', () => {
    // Measured on this host: JSON.parse does not overflow its stack at this depth, so the
    // event is rejected for its content rather than crashing the process.
    const run = runAction(`${'{"a":'.repeat(100_000)}1${'}'.repeat(100_000)}`, summaryIn());
    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain('not a full commit object ID');
    expect(run.stderr).not.toContain('Maximum call stack');
    expect(bytesLeft(run)).toBeNull();
  });

  it('reads a large event file instead of inventing a smaller limit than the runner gives', () => {
    // PHASE 21 records the decision: no arbitrary event-size cap was added, because GitHub
    // sizes this file and the Action only reads literal paths from it. This case holds that
    // decision honest — the review still completes.
    const { base, head } = reviewedRepository();
    const run = runAction(
      JSON.stringify({
        pull_request: { base: { sha: base }, head: { sha: head } },
        blob: 'y'.repeat(8 * 1024 * 1024),
      }),
      summaryIn(),
    );
    expect(run.status, run.stderr).toBe(0);
    expect(bytesLeft(run)).not.toBe(0);
  });

  it('treats an event file that cannot be read as a missing event, naming only the variable', () => {
    // A directory is the shape that cannot be read at all, and whose failure would otherwise
    // print the engine's `EISDIR` text.
    const unreadable = path.join(scratch(), 'event-dir');
    mkdirSync(unreadable);
    const retry = runAt(unreadable, summaryIn());
    expectStableFailure(retry, 'GITHUB_EVENT_PATH');
  });
});

function runAt(eventPath: string, summaryPath: string): Run {
  const { workspace } = reviewedRepository();
  const dir = scratch();
  const result = spawnSync(process.execPath, [bundle], {
    cwd: dir,
    env: {
      ...Object.fromEntries(
        Object.entries(process.env).filter(([key]) => !key.startsWith('GITHUB_')),
      ),
      GITHUB_EVENT_NAME: 'pull_request',
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_WORKSPACE: workspace,
      GITHUB_STEP_SUMMARY: summaryPath,
    },
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr, summaryPath };
}

describe('the summary path the runner names', () => {
  it('fails on a missing parent directory without creating anything on the way', () => {
    const run = runAction(null, path.join(scratch(), 'absent-parent', 'step-summary.md'));
    expectStableFailure(run, 'GITHUB_STEP_SUMMARY');
    expect(existsSync(path.dirname(run.summaryPath))).toBe(false);
  });

  it('fails on a summary path that is an existing directory and leaves the directory alone', () => {
    const dir = path.join(scratch(), 'summary-is-dir');
    mkdirSync(dir);
    const nested = path.join(dir, 'keep.txt');
    writeFileSync(nested, 'kept');
    const run = runAction(null, dir);
    expectStableFailure(run, 'GITHUB_STEP_SUMMARY');
    expect(readFileSync(nested, 'utf8')).toBe('kept');
  });

  it('fails when the summary path runs through a file, without touching the file', () => {
    const file = path.join(scratch(), 'plain-file');
    writeFileSync(file, 'untouched');
    const run = runAction(null, path.join(file, 'step-summary.md'));
    expectStableFailure(run, 'GITHUB_STEP_SUMMARY');
    expect(readFileSync(file, 'utf8')).toBe('untouched');
  });

  it('writes the report when the runner names a path with spaces and non-ASCII characters', () => {
    const dir = path.join(scratch(), 'with space café');
    mkdirSync(dir);
    const run = runAction(null, path.join(dir, 'step summary.md'));
    expect(run.status, run.stderr).toBe(0);
    expect(bytesLeft(run)).not.toBe(0);
  });

  it('keeps the byte guard message free of the summary it refused to write', () => {
    const target = summaryIn();
    writeFileSync(target, 'x'.repeat(1048576));
    const run = runAction(null, target);
    expectStableFailure(run, 'GITHUB_STEP_SUMMARY');
    expect(run.stderr).not.toContain('xxxx');
    expect(readFileSync(target, 'utf8')).toBe('x'.repeat(1048576));
  });
});
