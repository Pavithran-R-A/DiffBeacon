import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { trustedNpmInvocation } from '../scripts/npm-cli.mjs';

describe('trusted npm invocation', () => {
  it('uses the current Node executable and npm_execpath as argv, never npm.cmd', () => {
    const invocation = trustedNpmInvocation(['run', 'lint'], { npm_execpath: '/safe/npm-cli.js' });
    expect(invocation.command).toBe(process.execPath);
    expect(invocation.args).toEqual(['/safe/npm-cli.js', 'run', 'lint']);
  });

  it('fails clearly when npm_execpath is unavailable', () => {
    expect(() => trustedNpmInvocation(['run', 'lint'], {})).toThrow('npm_execpath');
  });

  it('keeps project-owned npm scripts off direct npm.cmd and unsafe shell paths', () => {
    for (const file of ['scripts/build.mjs', 'scripts/verify.mjs', 'scripts/package-smoke.mjs']) {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toContain('npm.cmd');
      expect(source).not.toContain('npx.cmd');
      expect(source).not.toContain('shell: true');
    }
  });
});
