import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { isEntrypointUrl } from '../packages/action/src/entry.js';
import { pullRequestRange } from '../packages/action/src/logic.js';

const absolute = (target: string) => path.resolve(target);

describe('Action entrypoint guard', () => {
  it('fires when Node reports the bundle itself as the script path', () => {
    const script = absolute('packages/action/dist/index.js');
    expect(isEntrypointUrl(pathToFileURL(script).href, script, process.cwd())).toBe(true);
  });

  it('fires for a spaced relative script path resolved against the working directory', () => {
    const moduleUrl = pathToFileURL(absolute('nested repo with spaces/dist/index.js')).href;
    expect(
      isEntrypointUrl(
        moduleUrl,
        path.join('nested repo with spaces', 'dist', 'index.js'),
        process.cwd(),
      ),
    ).toBe(true);
  });

  it('stays silent when the bundle is imported by a different entrypoint', () => {
    const moduleUrl = pathToFileURL(absolute('packages/action/dist/index.js')).href;
    expect(isEntrypointUrl(moduleUrl, absolute('other/tool.js'), process.cwd())).toBe(false);
    expect(isEntrypointUrl(moduleUrl, undefined, process.cwd())).toBe(false);
  });

  it('matches path case only on Windows, where the filesystem is case-insensitive', () => {
    const moduleUrl = pathToFileURL('/Runner/Dist/Index.js').href;
    const argvPath = '/runner/dist/index.js';
    expect(isEntrypointUrl(moduleUrl, argvPath, '/', 'win32')).toBe(true);
    expect(isEntrypointUrl(moduleUrl, argvPath, '/', 'linux')).toBe(false);
  });
});

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
