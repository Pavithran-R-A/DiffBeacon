import { describe, expect, it } from 'vitest';
import { pullRequestRange } from '../packages/action/src/logic.js';

describe('Action event handling', () => {
  it('accepts trusted-looking commit SHAs from event metadata', () => {
    expect(
      pullRequestRange({
        pull_request: { base: { sha: 'a'.repeat(40) }, head: { sha: 'b'.repeat(40) } },
      }),
    ).toEqual({ base: 'a'.repeat(40), head: 'b'.repeat(40) });
  });

  it('rejects refs, shell text, and missing event values', () => {
    expect(() =>
      pullRequestRange({ pull_request: { base: { sha: 'main' }, head: { sha: 'b'.repeat(40) } } }),
    ).toThrow();
    expect(() =>
      pullRequestRange({
        pull_request: { base: { sha: '$(touch PWNED)' }, head: { sha: 'b'.repeat(40) } },
      }),
    ).toThrow();
    expect(() => pullRequestRange({})).toThrow();
  });
});
