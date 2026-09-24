/**
 * DiffBeacon Action design reminder: read-only workflow instrumentation. Event
 * values are validated before Git receives them; the PR checkout is never executed.
 */

export interface PullRequestEvent {
  pull_request?: {
    base?: { sha?: unknown };
    head?: { sha?: unknown };
  };
}

function sha(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{7,64}$/i.test(value))
    throw new Error('Pull request event did not contain a valid commit SHA.');
  return value;
}

export function pullRequestRange(event: PullRequestEvent): { base: string; head: string } {
  return { base: sha(event.pull_request?.base?.sha), head: sha(event.pull_request?.head?.sha) };
}
