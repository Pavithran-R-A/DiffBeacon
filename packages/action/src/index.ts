/**
 * DiffBeacon Action design reminder: the job summary is an evidence brief, not
 * a merge gate. No comments, repository writes, PR code execution, or network APIs.
 */

import { appendFileSync, readFileSync } from 'node:fs';
import process from 'node:process';
import { analyzeDiff, renderMarkdown } from '../../core/src/index.js';
import { collectGitDiffAsync } from '../../cli/src/git.js';
import { echo } from '../../cli/src/errors.js';
import { isEntrypointUrl } from './entry.js';
import { pullRequestRange, requireEventName, type PullRequestEvent } from './logic.js';

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
  try {
    return JSON.parse(raw) as PullRequestEvent;
  } catch {
    throw new Error('GITHUB_EVENT_PATH is not valid JSON for a workflow event.');
  }
}

function writeSummary(summaryPath: string, markdown: string): void {
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
