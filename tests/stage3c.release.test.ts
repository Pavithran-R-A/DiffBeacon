import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyzeDiff, compareCanonicalText, renderJson } from '../packages/core/src/index.js';
import { runNpmBinShim, windowsCmdInvocation } from '../scripts/npm-bin-shim.mjs';

const corpus = ['A.ts', 'a.ts', 'z.ts', 'ä.ts', 'é.ts', '文件.ts', '😀.ts'];

function corpusDiff() {
  return corpus
    .map(
      (path) =>
        `diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n@@ -1 +1 @@\n-old\n+new`,
    )
    .join('\n');
}

describe('Stage 3C release invariants', () => {
  it('uses explicit code-unit ordering for the Unicode corpus', () => {
    expect([...corpus].sort(compareCanonicalText)).toEqual([
      'A.ts',
      'a.ts',
      'z.ts',
      'ä.ts',
      'é.ts',
      '文件.ts',
      '😀.ts',
    ]);
  });

  it('keeps canonical JSON byte-identical across locale environment labels', () => {
    const input = corpusDiff();
    const originalLocale = process.env.LC_ALL;
    const reports = ['en_US.UTF-8', 'sv_SE.UTF-8'].map((locale) => {
      process.env.LC_ALL = locale;
      return renderJson(analyzeDiff(input));
    });
    if (originalLocale === undefined) delete process.env.LC_ALL;
    else process.env.LC_ALL = originalLocale;
    expect(reports[0]).toBe(reports[1]);
    expect(analyzeDiff(input).files.map((file) => file.displayPath)).toEqual([
      'A.ts',
      'a.ts',
      'z.ts',
      'ä.ts',
      'é.ts',
      '文件.ts',
      '😀.ts',
    ]);
  });

  it('does not retain locale-sensitive canonical ordering APIs', () => {
    const source = readFileSync('packages/core/src/analyze.ts', 'utf8');
    expect(source).not.toContain('localeCompare');
    expect(source).not.toContain('Intl.Collator');
  });

  it('routes the real Windows npm shim through ComSpec without shell interpolation', () => {
    const invocation = windowsCmdInvocation(
      'C:\\Windows\\System32\\cmd.exe',
      'C:\\workspace\\node_modules\\.bin\\diffbeacon.cmd',
      ['--version'],
    );
    expect(invocation).toEqual({
      file: 'C:\\Windows\\System32\\cmd.exe',
      args: ['/d', '/s', '/c', '""C:\\workspace\\node_modules\\.bin\\diffbeacon.cmd" "--version""'],
      windowsVerbatimArguments: true,
    });
    const smoke = readFileSync('scripts/package-smoke.mjs', 'utf8');
    const helper = readFileSync('scripts/npm-bin-shim.mjs', 'utf8');
    expect(smoke).toContain('runNpmBinShim');
    expect(smoke).not.toMatch(/execFileSync\(bin/);
    expect(helper).toContain('process.env');
    expect(helper).toContain('ComSpec');
    expect(helper).toContain('shell: false');
    expect(helper).not.toContain('shell: true');
  });

  it('accepts only the trusted shim path and internal long-form arguments', () => {
    const comSpec = 'C:\\Windows\\System32\\cmd.exe';
    const shim = 'C:\\workspace\\node_modules\\.bin\\diffbeacon.cmd';
    expect(() => windowsCmdInvocation(comSpec, shim, ['-v'])).toThrow(
      'npm bin shim arguments must be internal long-form flags.',
    );
    expect(() => windowsCmdInvocation(comSpec, shim, ['--version; calc.exe'])).toThrow(
      'npm bin shim arguments must be internal long-form flags.',
    );
    expect(() => windowsCmdInvocation(comSpec, shim, ['--version', 'extra path'])).toThrow(
      'npm bin shim arguments must be internal long-form flags.',
    );
    expect(() =>
      windowsCmdInvocation(comSpec, 'C:\\workspace\\node_modules\\.bin\\other.cmd', ['--version']),
    ).toThrow('Windows npm bin shim helper requires a .cmd path.');
    expect(() =>
      windowsCmdInvocation(comSpec, 'C:\\Users\\%USERNAME%\\diffbeacon.cmd', ['--version']),
    ).toThrow('characters cmd.exe would reinterpret');
    expect(() =>
      windowsCmdInvocation(comSpec, 'C:\\workspace\\node_modules\\run & calc \\diffbeacon.cmd', [
        '--version',
      ]),
    ).toThrow('characters cmd.exe would reinterpret');
    expect(() => windowsCmdInvocation(undefined, shim, ['--version'])).toThrow(
      'Windows command interpreter path is unavailable.',
    );
  });

  it('preserves spaces inside the quoted shim path and argument list', () => {
    const invocation = windowsCmdInvocation(
      'C:\\Windows\\System32\\cmd.exe',
      'C:\\Program Files\\diff beacon\\node_modules\\.bin\\diffbeacon.cmd',
      ['--version', '--help'],
    );
    expect(invocation.args).toEqual([
      '/d',
      '/s',
      '/c',
      '""C:\\Program Files\\diff beacon\\node_modules\\.bin\\diffbeacon.cmd" "--version" "--help""',
    ]);
  });

  it.runIf(process.platform === 'win32')(
    'executes a real spaced .cmd shim through the generated cmd.exe invocation',
    () => {
      const root = mkdtempSync(path.join(tmpdir(), 'diffbeacon shim '));
      try {
        const bin = path.join(root, 'node_modules', '.bin');
        mkdirSync(bin, { recursive: true });
        const shim = path.join(bin, 'diffbeacon.cmd');
        writeFileSync(shim, '@echo off\r\necho shim-invoked-ok\r\n');
        const output = runNpmBinShim(shim, ['--version'], { encoding: 'utf8' });
        expect(String(output)).toContain('shim-invoked-ok');
        expect(existsSync(path.join(root, 'PWNED'))).toBe(false);
      } finally {
        rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
      }
    },
  );

  it('publishes Node >=22 in the actual packed CLI manifest', () => {
    const packageJson = JSON.parse(readFileSync('packages/cli/package.json', 'utf8'));
    expect(packageJson.engines).toEqual({ node: '>=22' });
    const packed = execFileSync(
      process.execPath,
      [
        '-e',
        "import fs from 'node:fs'; const p=JSON.parse(fs.readFileSync('packages/cli/package.json','utf8')); if (p.engines?.node !== '>=22') process.exit(1);",
      ],
      { encoding: 'utf8', shell: false },
    );
    expect(packed).toBe('');
  });

  it('removes the builder-specific preview host from active Vite configuration', () => {
    const vite = readFileSync('vite.config.ts', 'utf8');
    expect(vite).not.toContain('.manus.computer');
    expect(vite).not.toContain('allowedHosts: true');
  });
});
