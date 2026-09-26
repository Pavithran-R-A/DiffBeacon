/**
 * DiffBeacon revision boundary: validate only opaque Git revision tokens and
 * two-endpoint ranges before any trusted Git process invocation. A lone
 * revision is rejected on purpose — accepting it would make `git diff <rev>`
 * compare against the working tree, i.e. analyse uncommitted state the user
 * never asked about.
 */

import { UsageError, echo } from './errors.js';

const INVALID_REVISION = /[\u0000-\u001f\u007f\s$;|&<>`]/;
const MAX_REVISION_CHARS = 240;

function isUsableRevision(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= MAX_REVISION_CHARS &&
    !value.startsWith('-') &&
    !INVALID_REVISION.test(value)
  );
}

export function validateRevision(value: string): string {
  if (!isUsableRevision(value))
    throw new UsageError(
      `Invalid revision input: ${echo(value)}. A revision is one opaque Git name with no whitespace, no shell metacharacters, and no leading dash.`,
    );
  return value;
}

function rangeOperator(range: string): '...' | '..' | null {
  if (range.includes('...')) return '...';
  if (range.includes('..')) return '..';
  return null;
}

export function validateRange(value: string): string {
  const range = validateRevision(value);
  const operator = rangeOperator(range);
  if (operator === null)
    throw new UsageError(
      `Invalid revision range: ${echo(range)}. DiffBeacon needs a two-endpoint range such as <rev>...<rev> or <rev>..<rev>; a single revision is not accepted because comparing it with the working tree would analyse uncommitted state.`,
    );
  const parts = range.split(operator);
  if (parts.length !== 2 || !parts.every((part) => isUsableRevision(part ?? '')))
    throw new UsageError(
      `Invalid revision range: ${echo(range)}. Expected exactly one "${operator}" operator with a usable revision on each side.`,
    );
  return range;
}
