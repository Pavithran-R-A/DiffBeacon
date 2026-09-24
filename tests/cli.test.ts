import { describe, expect, it } from 'vitest';
import { validateRange, validateRevision } from '../packages/cli/src/index.js';

describe('CLI input validation', () => {
  it('accepts ordinary revisions and ranges', () => {
    expect(validateRevision('main')).toBe('main');
    expect(validateRange('main...HEAD')).toBe('main...HEAD');
    expect(validateRange('abc1234')).toBe('abc1234');
  });

  it('rejects shell metacharacters, whitespace, and option-like revisions', () => {
    for (const value of ['$(touch PWNED)', '; echo hacked', '--help', 'foo bar.ts', 'a\n b']) {
      expect(() => validateRevision(value)).toThrow();
    }
  });
});
