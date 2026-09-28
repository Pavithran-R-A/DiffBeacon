/**
 * DiffBeacon CLI design reminder: exit codes state whether a usable diff and a
 * writable report existed, never how severe an observation looked. Untrusted
 * revision text is always echoed through `echo`/`boundedSingleLine` so a hostile
 * argument cannot smuggle control sequences or an unbounded blob into a terminal.
 */

import { neutralizeDisplayControls } from '../../core/src/display.js';

export const EXIT_CODES = {
  ok: 0,
  unexpected: 1,
  usage: 2,
  diffUnavailable: 3,
  outputUnwritable: 4,
} as const;

const MAX_ECHO_CHARS = 120;
const MAX_DETAIL_CHARS = 512;

/** A CLI message is one line of prose, so a neutralised control reads as a space. */
const MESSAGE_MARKER = ' ';

/** Quote untrusted text for a one-line message, bounded so echoes stay small. */
export function echo(value: string): string {
  const printable = neutralizeDisplayControls(value, MESSAGE_MARKER);
  return printable.length <= MAX_ECHO_CHARS
    ? JSON.stringify(printable)
    : `${JSON.stringify(printable.slice(0, MAX_ECHO_CHARS))} ...(truncated)`;
}

/** Collapse untrusted process output into one bounded printable line. */
export function boundedSingleLine(value: string, limit = MAX_DETAIL_CHARS): string {
  const line = neutralizeDisplayControls(value, MESSAGE_MARKER).trim();
  return line.length <= limit ? line : `${line.slice(0, limit)} ...(truncated)`;
}

export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UsageError';
  }
}

export class DiffUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiffUnavailableError';
  }
}

export class OutputWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OutputWriteError';
  }
}
