import { describe, expect, it } from 'vitest';
import { pullRequestRange, requireEventName } from '../packages/action/src/logic.js';

// Stage 6, PHASE 3 and PHASE 4: the Action must state which workflow event it supports and
// which commit identifier it accepts. A GitHub pull-request event carries full object IDs,
// so anything shorter is either a hand-edited event file or a different tool's payload.

const BASE = 'a'.repeat(40);
const HEAD = 'b'.repeat(40);

/**
 * Control characters, collected by code point. The assertions below are about the absence
 * of control characters, so they must not depend on a control-character regex literal.
 */
function controlCharacters(value: string): string[] {
  return [...value].filter((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code < 0x20 || code === 0x7f;
  });
}

const escapeCharacter = String.fromCharCode(0x1b);
const nullCharacter = String.fromCharCode(0x00);
const bellCharacter = String.fromCharCode(0x07);

const event = (base: unknown = BASE, head: unknown = HEAD) => ({
  pull_request: { base: { sha: base }, head: { sha: head } },
});

describe('the supported event name contract', () => {
  it('accepts the ordinary pull_request event', () => {
    expect(() => requireEventName('pull_request')).not.toThrow();
  });

  it('rejects a missing event name instead of trusting the payload shape', () => {
    expect(() => requireEventName(undefined)).toThrow(/GITHUB_EVENT_NAME is required/);
  });

  it('rejects an empty event name', () => {
    expect(() => requireEventName('')).toThrow(/GITHUB_EVENT_NAME is required/);
  });

  it('rejects push, which has no pull-request diff to review', () => {
    expect(() => requireEventName('push')).toThrow(/Unsupported GITHUB_EVENT_NAME "push"/);
  });

  it('rejects workflow_dispatch', () => {
    expect(() => requireEventName('workflow_dispatch')).toThrow(
      /Unsupported GITHUB_EVENT_NAME "workflow_dispatch"/,
    );
  });

  it('rejects a mixed-case event name rather than normalizing it', () => {
    expect(() => requireEventName('Pull_Request')).toThrow(/Unsupported GITHUB_EVENT_NAME/);
  });

  it('refuses pull_request_target with the reason, without overclaiming', () => {
    let message = '';
    try {
      requireEventName('pull_request_target');
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/pull_request_target/);
    expect(message).toMatch(/only the pull_request event/);
    expect(message).not.toMatch(/compromis|vulnerab|malicious/i);
  });

  it('bounds an oversized hostile event name in its own message', () => {
    let message = '';
    try {
      requireEventName(`${escapeCharacter}31m${'x'.repeat(500)}`);
    } catch (error) {
      message = (error as Error).message;
    }
    // The name is replaced, not merely JSON-escaped, so the control byte never reaches a
    // terminal as an escape sequence or as its own escaped spelling.
    expect(message).toContain('Unsupported GITHUB_EVENT_NAME " 31m');
    expect(message).toContain('...(truncated)');
    expect(message).not.toContain('\\u001b');
    expect(message.length).toBeLessThan(300);
  });

  it('escapes control characters from an event name instead of printing them raw', () => {
    let message = '';
    try {
      requireEventName(`push${nullCharacter}bell${bellCharacter}`);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('Unsupported GITHUB_EVENT_NAME "push bell "');
    expect(message).not.toContain('\\u0000');
    expect(message).not.toContain('\\u0007');
    expect(controlCharacters(message)).toEqual([]);
  });
});

describe('the event object ID contract', () => {
  it('accepts a 40-character SHA-1 object ID for both endpoints', () => {
    expect(pullRequestRange(event())).toEqual({ base: BASE, head: HEAD });
  });

  it('accepts a 64-character SHA-256 object ID for both endpoints', () => {
    const sha256Base = 'c'.repeat(64);
    const sha256Head = 'd'.repeat(64);
    expect(pullRequestRange(event(sha256Base, sha256Head))).toEqual({
      base: sha256Base,
      head: sha256Head,
    });
  });

  it.each([
    ['7', 7],
    ['39', 39],
    ['41', 41],
    ['63', 63],
    ['65', 65],
    ['128', 128],
  ])('rejects a %s-character hexadecimal value', (_label, length) => {
    expect(() => pullRequestRange(event('a'.repeat(length), HEAD))).toThrow(
      /base\.sha is not a full commit object ID/,
    );
  });

  it('rejects an uppercase object ID because GitHub emits lowercase', () => {
    expect(() => pullRequestRange(event(BASE.toUpperCase(), HEAD))).toThrow(
      /base\.sha is not a full commit object ID/,
    );
  });

  it('rejects whitespace padding around an otherwise valid object ID', () => {
    expect(() => pullRequestRange(event(` ${BASE} `, HEAD))).toThrow(
      /base\.sha is not a full commit object ID/,
    );
  });

  it('names the failing endpoint so the operator can act', () => {
    expect(() => pullRequestRange(event(BASE, 'short'))).toThrow(
      /head\.sha is not a full commit object ID/,
    );
  });

  it('rejects shell text, refs, and non-string values', () => {
    expect(() => pullRequestRange(event('$(touch PWNED)', HEAD))).toThrow(/base\.sha/);
    expect(() => pullRequestRange(event(BASE, 'refs/heads/main'))).toThrow(/head\.sha/);
    expect(() => pullRequestRange(event(BASE, 42))).toThrow(/head\.sha/);
    expect(() => pullRequestRange({})).toThrow(/base\.sha/);
  });

  it('refuses to echo a hostile object-ID value into its own message', () => {
    const hostile = `${'z'.repeat(400)}${escapeCharacter}]8;;evil${bellCharacter}`;
    let message = '';
    try {
      pullRequestRange(event(hostile, HEAD));
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('base.sha is not a full commit object ID');
    expect(message).not.toContain('zzzz');
    expect(message).not.toContain(']8;;evil');
    expect(controlCharacters(message)).toEqual([]);
  });
});
