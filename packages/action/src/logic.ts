/**
 * DiffBeacon Action design reminder: read-only workflow instrumentation. Event
 * values are validated before Git receives them; the PR checkout is never executed.
 */

import { echo } from '../../cli/src/errors.js';

export const SUPPORTED_EVENT_NAME = 'pull_request';

export interface PullRequestEvent {
  pull_request?: {
    base?: { sha?: unknown };
    head?: { sha?: unknown };
  };
}

/**
 * GitHub delivers the triggering event name in lower case, so an exact match is the
 * whole contract. `pull_request_target` is refused not because every workflow using it
 * is misconfigured but because DiffBeacon needs no base-repository privileges: the
 * ordinary `pull_request` event already carries the same pull-request payload.
 */
export function requireEventName(name: string | undefined): void {
  if (name === SUPPORTED_EVENT_NAME) return;
  if (name === undefined || name === '')
    throw new Error(
      'GITHUB_EVENT_NAME is required: DiffBeacon reviews the pull_request event and must know which event the runner delivered.',
    );
  if (name === 'pull_request_target')
    throw new Error(
      'Unsupported GITHUB_EVENT_NAME "pull_request_target": the pull_request event carries the same pull-request payload, so DiffBeacon reviews only the pull_request event and refuses to run under a base-privileged trigger.',
    );
  throw new Error(
    `Unsupported GITHUB_EVENT_NAME ${echo(name)}: DiffBeacon reviews only the pull_request event.`,
  );
}

/** A workflow event names commits by object ID, so abbreviations and refs are rejected. */
function objectId(value: unknown, endpoint: 'base' | 'head'): string {
  if (typeof value !== 'string' || !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(value))
    throw new Error(
      `Pull request event ${endpoint}.sha is not a full commit object ID: DiffBeacon needs the 40-character SHA-1 or 64-character SHA-256 hexadecimal ID from the event, not an abbreviation or a revision name.`,
    );
  return value;
}

export function pullRequestRange(event: PullRequestEvent): { base: string; head: string } {
  return {
    base: objectId(event.pull_request?.base?.sha, 'base'),
    head: objectId(event.pull_request?.head?.sha, 'head'),
  };
}
