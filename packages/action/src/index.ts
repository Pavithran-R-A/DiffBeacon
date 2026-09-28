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
  // fixed argument vector, and nothing from the reviewed tree is imported or executed.
  const diff = await collectGitDiffAsync(`${base}...${head}`, workspace);
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
