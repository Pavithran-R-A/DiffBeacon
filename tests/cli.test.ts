import { describe, expect, it } from 'vitest';
import { validateRange, validateRevision } from '../packages/cli/src/index.js';

describe('CLI input validation', () => {
  it('accepts ordinary revisions and two-endpoint ranges', () => {
    expect(validateRevision('main')).toBe('main');
    expect(validateRange('main...HEAD')).toBe('main...HEAD');
    expect(validateRange('main..HEAD')).toBe('main..HEAD');
  });

  // Stage 5: a lone revision used to be accepted and silently compared against
  // the working tree, so the contract is now an explicit rejection.
  it('rejects a single revision instead of comparing it with the working tree', () => {
    expect(() => validateRange('abc1234')).toThrow('two-endpoint');
    expect(() => validateRange('HEAD')).toThrow(/Invalid revision range: "HEAD"/);
  });

  it('names the whole range when an endpoint is missing', () => {
    for (const value of ['...', 'HEAD~1...', '...HEAD', 'HEAD~1..', '..HEAD']) {
      expect(() => validateRange(value)).toThrow(
        `Invalid revision range: ${JSON.stringify(value)}`,
      );
    }
  });

  it('rejects shell metacharacters, whitespace, and option-like revisions', () => {
    for (const value of ['$(touch PWNED)', '; echo hacked', '--help', 'foo bar.ts', 'a\n b']) {
      expect(() => validateRevision(value)).toThrow();
    }
  });
});
