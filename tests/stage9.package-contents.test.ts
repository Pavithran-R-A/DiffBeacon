import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

type Manifest = {
  name: string;
  version: string;
  private?: boolean;
  license?: string;
  type?: string;
  files?: string[];
  bin?: Record<string, string>;
  engines?: Record<string, string>;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  repository?: { type: string; url: string };
  homepage?: string;
  bugs?: { url: string };
};

const read = (file: string): Manifest => JSON.parse(readFileSync(file, 'utf8')) as Manifest;

const CANONICAL = 'Pavithran-R-A/DiffBeacon';
const cli = () => read('packages/cli/package.json');
const root = () => read('package.json');

/** Lifecycle hooks are the scripts npm runs on its own; a shipped CLI must own none of them. */
const installLifecycleScripts = ['preinstall', 'install', 'postinstall', 'prepare', 'prepublish'];

describe('Stage 9 published-package contract', () => {
  it('carries the MIT license text inside the package directory that npm packs', () => {
    expect(existsSync('packages/cli/LICENSE')).toBe(true);
  });

  it('keeps the packaged license byte-identical to the repository license', () => {
    expect(readFileSync('packages/cli/LICENSE', 'utf8')).toBe(readFileSync('LICENSE', 'utf8'));
  });

  it('names the license in the package file whitelist', () => {
    expect(cli().files).toContain('LICENSE');
  });

  it('points every release URL at the canonical repository casing', () => {
    expect(cli().repository).toEqual({
      type: 'git',
      url: `git+https://github.com/${CANONICAL}.git`,
    });
    expect(cli().homepage).toBe(`https://github.com/${CANONICAL}#readme`);
    expect(cli().bugs).toEqual({ url: `https://github.com/${CANONICAL}/issues` });
  });

  it('makes the private workspace agree with the package on repository identity', () => {
    expect(root().private).toBe(true);
    expect(root().repository).toEqual({
      type: 'git',
      url: `git+https://github.com/${CANONICAL}.git`,
    });
    expect(cli().name).toBe('diffbeacon');
    expect(cli().version).toBe(root().version);
  });

  it('declares no runtime dependency and no install-time script', () => {
    expect(cli().dependencies ?? {}).toEqual({});
    for (const script of installLifecycleScripts) expect(cli().scripts?.[script]).toBeUndefined();
  });

  it('refuses an installed artifact that was tampered with after installation', () => {
    // Each clause here answers one negative control that measured silent success: a bundle without a
    // shebang, a `bin` field pointing at a file the package does not ship, a `file:` runtime
    // dependency, and a rewritten installed version. The smoke used to report those numbers instead
    // of gating on them, so the tampered install printed a healthy summary and exited zero.
    const smoke = readFileSync('scripts/package-smoke.mjs', 'utf8');
    expect(smoke).toContain('does not point at a shipped file');
    expect(smoke).toContain('shebang');
    expect(smoke).toContain('runtime dependencies');
    expect(smoke).toContain('packed from');
  });

  it('publishes the qualified runtime contract instead of an untested claim', () => {
    expect(cli().engines).toEqual({ node: '>=22' });
    expect(root().engines).toEqual({ node: '>=22' });
    expect(readFileSync('README.md', 'utf8')).toContain('qualified on Node 22.x and Node 24.x');
    expect(readFileSync('packages/cli/README.md', 'utf8')).toContain(
      'qualified on Node 22.x and Node 24.x',
    );
  });

  it('states the published version and the install path that was consumer-smoke-tested', () => {
    const readme = readFileSync('packages/cli/README.md', 'utf8');
    expect(readme).toContain('diffbeacon@0.1.1');
    expect(readme).toContain('npm install diffbeacon@0.1.1');
    expect(readme).not.toContain('not published to the npm registry yet');
    // A global install has never been qualified here, so the README must not invent it.
    expect(readme).not.toContain('npm install -g diffbeacon');
  });
});
