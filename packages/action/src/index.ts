/**
 * DiffBeacon Action design reminder: the job summary is an evidence brief, not
 * a merge gate. No comments, repository writes, PR code execution, or network APIs.
 */

import { appendFileSync, readFileSync } from 'node:fs';
import process from 'node:process';
import { analyzeDiff, renderMarkdown } from '../../core/src/index.js';
import { collectGitDiffAsync } from '../../cli/src/git.js';
import { pullRequestRange } from './logic.js';

export async function runAction(env: NodeJS.ProcessEnv = process.env): Promise<string> {
  if (!env.GITHUB_EVENT_PATH) throw new Error('GITHUB_EVENT_PATH is required.');
  const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8')) as unknown;
  const range = pullRequestRange(
    event as ReturnType<typeof pullRequestRange> extends never
      ? never
      : Parameters<typeof pullRequestRange>[0],
  );
  const diff = await collectGitDiffAsync(`${range.base}...${range.head}`);
  const report = analyzeDiff(diff);
  const markdown = renderMarkdown(report);
  if (env.GITHUB_STEP_SUMMARY)
    appendFileSync(env.GITHUB_STEP_SUMMARY, `${markdown}\n`, { encoding: 'utf8' });
  return markdown;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    await runAction();
  } catch (error) {
    process.stderr.write(
      `DiffBeacon Action error: ${error instanceof Error ? error.message : 'Unknown failure.'}\n`,
    );
    process.exitCode = 1;
  }
}
