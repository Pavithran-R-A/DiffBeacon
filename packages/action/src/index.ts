/**
 * DiffBeacon Action design reminder: the job summary is an evidence brief, not
 * a merge gate. No comments, repository writes, PR code execution, or network APIs.
 */

import { appendFileSync, readFileSync, statSync } from 'node:fs';
import process from 'node:process';
import { analyzeDiff, renderMarkdown } from '../../core/src/index.js';
import { collectGitDiffAsync } from '../../cli/src/git.js';
import { echo } from '../../cli/src/errors.js';
import { isEntrypointUrl } from './entry.js';
import { pullRequestRange, requireEventName, type PullRequestEvent } from './logic.js';

/**
 * The size GitHub gives a step summary file. Measured on this host, 4,703,340 bytes of diff
 * over 30,000 changed files — inside DiffBeacon's own 8 MiB input bound — renders to
 * 1,958,803 summary bytes, so the limit is reachable from legal input and the append has to
 * be checked before it happens.
 */
const MAX_STEP_SUMMARY_BYTES = 1 * 1024 * 1024;

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (typeof value !== 'string' || value === '')
    throw new Error(
      `${name} is required: DiffBeacon runs as a workflow step and reads its boundaries from the environment the runner exports.`,
    );
  return value;
}

function readEvent(eventPath: string): PullRequestEvent {
  let raw: string;
  try {
    raw = readFileSync(eventPath, 'utf8');
  } catch {
    throw new Error(`GITHUB_EVENT_PATH could not be read: ${echo(eventPath)}.`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('GITHUB_EVENT_PATH is not valid JSON for a workflow event.');
  }
  // Well-formed JSON is not enough: reading `pull_request` off a bare `null` would print the
  // engine's own property-access text instead of a message that names the variable at fault.
  if (parsed === null || typeof parsed !== 'object')
    throw new Error(
      'GITHUB_EVENT_PATH does not hold a JSON object for a workflow event: DiffBeacon reads pull_request.base.sha and pull_request.head.sha from the object the runner wrote.',
    );
  return parsed as PullRequestEvent;
}

function summaryBytesBefore(summaryPath: string): number {
  try {
    return statSync(summaryPath).size;
  } catch {
    // The runner creates this file; a summary that does not exist yet holds nothing.
    return 0;
  }
}

/**
 * GITHUB_WORKSPACE is the reviewed-repository boundary, so Git is handed a copy of the runner's
 * environment with the repository-identity selectors taken out and the work tree set to the
 * workspace. Measured on Windows Git 2.55.0 and Linux Git 2.39.5: `GIT_DIR`, `GIT_COMMON_DIR` and
 * `GIT_OBJECT_DIRECTORY` make Git read another repository's object store, `GIT_WORK_TREE` moves the
 * reported repository root, and `GIT_ALTERNATE_OBJECT_DIRECTORIES` makes another repository's
 * content reachable through a range the workspace does not hold.
 *
 * Deliberately kept: `GIT_INDEX_FILE` and `GIT_NAMESPACE`. A commit-to-commit range consults no
 * index, and Stage 6 lets the event name only full object IDs, which a ref namespace cannot change;
 * removing a variable because its name starts with `GIT_` would be a guess, not a control. `PATH`,
 * locale and runtime variables reach Git exactly as the runner set them.
 *
 * Setting the work tree is also what closes the one channel a denylist cannot reach: a
 * `core.worktree` written in the reviewed repository's own configuration moves
 * `rev-parse --show-toplevel`, and the environment value outranks it.
 */
function workspaceGitEnv(env: NodeJS.ProcessEnv, workspace: string): NodeJS.ProcessEnv {
  const gitEnv: NodeJS.ProcessEnv = { ...env };
  for (const name of [
    'GIT_DIR',
    'GIT_COMMON_DIR',
    'GIT_OBJECT_DIRECTORY',
    'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  ])
    delete gitEnv[name];
  // Assigned rather than merely deleted: the workspace value outranks anything inherited.
  gitEnv.GIT_WORK_TREE = workspace;
  return gitEnv;
}

function writeSummary(summaryPath: string, markdown: string): void {
  const addition = Buffer.byteLength(markdown, 'utf8');
  const before = summaryBytesBefore(summaryPath);
  if (before + addition > MAX_STEP_SUMMARY_BYTES)
    throw new Error(
      `The step summary already holds ${before} bytes and this review needs ${addition}, which would pass the ${MAX_STEP_SUMMARY_BYTES} bytes GitHub gives GITHUB_STEP_SUMMARY. Nothing was appended, so the file is exactly as it was: narrow the reviewed range, or read the report from the CLI.`,
    );
  try {
    // The Markdown report already ends with exactly one newline, so appending it verbatim
    // produces one newline-terminated block instead of a trailing blank line.
    appendFileSync(summaryPath, markdown, { encoding: 'utf8' });
  } catch {
    throw new Error(
      'The review could not be appended to GITHUB_STEP_SUMMARY: it must name a writable file provided by the runner.',
    );
  }
}

export async function runAction(env: NodeJS.ProcessEnv = process.env): Promise<string> {
  requireEventName(env.GITHUB_EVENT_NAME);
  const event = readEvent(required(env, 'GITHUB_EVENT_PATH'));
  const { base, head } = pullRequestRange(event);
  const workspace = required(env, 'GITHUB_WORKSPACE');
  const summaryPath = required(env, 'GITHUB_STEP_SUMMARY');
  // The reviewed repository is only read: Git runs against the named workspace through a
  // fixed argument vector and an environment that cannot name a different repository, and nothing
  // from the reviewed tree is imported or executed.
  const diff = await collectGitDiffAsync(`${base}...${head}`, workspace, {
    env: workspaceGitEnv(env, workspace),
  });
  const markdown = renderMarkdown(analyzeDiff(diff));
  writeSummary(summaryPath, markdown);
  return markdown;
}

if (isEntrypointUrl(import.meta.url, process.argv[1], process.cwd())) {
  try {
    await runAction();
  } catch (error) {
    process.stderr.write(
      `DiffBeacon Action error: ${error instanceof Error ? error.message : 'Unknown failure.'}\n`,
    );
    process.exitCode = 1;
  }
}
