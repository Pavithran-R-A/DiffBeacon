/**
 * DiffBeacon revision boundary: validate only opaque Git revision tokens and
 * ranges before any trusted Git process invocation.
 */

const INVALID_REVISION = /[\u0000-\u001f\u007f\s$;|&<>`]/;

export function validateRevision(value: string): string {
  if (
    value.length === 0 ||
    value.length > 240 ||
    value.startsWith('-') ||
    INVALID_REVISION.test(value)
  ) {
    throw new Error(`Invalid revision input: ${JSON.stringify(value)}`);
  }
  return value;
}

export function validateRange(value: string): string {
  const range = validateRevision(value);
  const parts = range.split('...');
  if (parts.length === 2) {
    validateRevision(parts[0] ?? '');
    validateRevision(parts[1] ?? '');
  } else if (range.includes('..')) {
    const doubleDot = range.split('..');
    if (doubleDot.length !== 2) throw new Error(`Invalid revision range: ${JSON.stringify(value)}`);
    validateRevision(doubleDot[0] ?? '');
    validateRevision(doubleDot[1] ?? '');
  }
  return range;
}
