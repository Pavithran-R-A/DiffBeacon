/**
 * DiffBeacon CLI design reminder: exit codes state whether a usable diff and a
 * writable report existed, never how severe an observation looked. Untrusted
 * revision text is always echoed through `echo`/`boundedSingleLine` so a hostile
 * argument cannot smuggle control sequences or an unbounded blob into a terminal.
 */

export const EXIT_CODES = {
  ok: 0,
  unexpected: 1,
  usage: 2,
  diffUnavailable: 3,
  outputUnwritable: 4,
} as const;

const MAX_ECHO_CHARS = 120;
const MAX_DETAIL_CHARS = 512;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

/** Quote untrusted text for a one-line message, bounded so echoes stay small. */
export function echo(value: string): string {
  const printable = value.replace(CONTROL_CHARS, ' ');
  return printable.length <= MAX_ECHO_CHARS
    ? JSON.stringify(printable)
    : `${JSON.stringify(printable.slice(0, MAX_ECHO_CHARS))} ...(truncated)`;
}

/** Collapse untrusted process output into one bounded printable line. */
export function boundedSingleLine(value: string, limit = MAX_DETAIL_CHARS): string {
  const line = value.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();
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
