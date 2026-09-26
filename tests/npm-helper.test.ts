import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { trustedNpmInvocation } from '../scripts/npm-cli.mjs';
import { npmReviewInvocation, windowsReviewInvocation } from '../scripts/npm-bin-shim.mjs';

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

// Stage 5, PHASE 15: the packaged `diffbeacon` command has to be able to run a review,
// not just print a version. That means the shim builder must carry a subcommand, a revision
// range and option values, which the flag-only builder deliberately refuses.
describe('installed-bin review invocation', () => {
  const comSpec = 'C:\\Windows\\System32\\cmd.exe';
  const shim = 'C:\\projects\\consumer\\node_modules\\.bin\\diffbeacon.cmd';

  it('carries the review command, range and option values to the shim', () => {
    const invocation = windowsReviewInvocation(comSpec, shim, [
      'review',
      'HEAD~1...HEAD',
      '--format',
      'json',
    ]);
    expect(invocation.file).toBe(comSpec);
    expect(invocation.args.slice(0, 3)).toEqual(['/d', '/s', '/c']);
    for (const token of ['review', 'HEAD~1...HEAD', '--format', 'json'])
      expect(invocation.args[3]).toContain(`"${token}"`);
    expect(invocation.windowsVerbatimArguments).toBe(true);
  });

  it('carries a stdin review and an output file to the shim', () => {
    const invocation = windowsReviewInvocation(comSpec, shim, [
      'review',
      '--stdin',
      '--output',
      'reports/out.json',
    ]);
    expect(invocation.args[3]).toContain('"--stdin"');
    expect(invocation.args[3]).toContain('"reports/out.json"');
  });

  it('refuses a review argument holding a character cmd.exe would reinterpret', () => {
    for (const args of [
      ['review', 'HEAD~1...HEAD;start calc.exe'],
      ['review', 'HEAD~1...HEAD&who'],
      ['review', '--format', 'js on'],
      ['review', '--output', 'a|b.json'],
      ['review', '--stdin>nul'],
    ])
      expect(() => windowsReviewInvocation(comSpec, shim, args), args.join(' ')).toThrow(
        /shell-inert/,
      );
  });

  it('refuses an argv that is not a review command', () => {
    expect(() => windowsReviewInvocation(comSpec, shim, ['--version'])).toThrow(/review/);
    expect(() => windowsReviewInvocation(comSpec, shim, ['analyze', 'HEAD~1...HEAD'])).toThrow(
      /review/,
    );
  });

  it('refuses a review with neither a range nor --stdin', () => {
    expect(() => windowsReviewInvocation(comSpec, shim, ['review'])).toThrow(
      /--stdin or a revision range/,
    );
  });

  it('refuses a review that names both a range and --stdin', () => {
    expect(() =>
      windowsReviewInvocation(comSpec, shim, ['review', 'HEAD~1...HEAD', '--stdin']),
    ).toThrow(/--stdin or a revision range/);
  });

  it('builds a runnable invocation for the platform it is running on', () => {
    const bin = process.platform === 'win32' ? shim : '/consumer/node_modules/.bin/diffbeacon';
    const invocation = npmReviewInvocation(bin, ['review', '--stdin', '--output', 'report.json'], {
      ComSpec: comSpec,
    });
    const carried = JSON.stringify(invocation.args);
    for (const token of ['review', '--stdin', 'report.json']) expect(carried).toContain(token);
    expect(invocation.file).toBe(process.platform === 'win32' ? comSpec : bin);
  });

  it('refuses a non-review argv on this platform too', () => {
    const bin = process.platform === 'win32' ? shim : '/consumer/node_modules/.bin/diffbeacon';
    expect(() => npmReviewInvocation(bin, ['--version'], { ComSpec: comSpec })).toThrow(/review/);
  });

  it('runs the installed review through the shim rather than through node dist/index.js', () => {
    const source = readFileSync('scripts/package-smoke.mjs', 'utf8');
    expect(source).toContain('npmReviewInvocation');
    expect(source).not.toMatch(/execPath,\s*\[entrypoint,\s*'review'/);
  });
});
