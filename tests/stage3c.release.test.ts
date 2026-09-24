import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { analyzeDiff, compareCanonicalText, renderJson } from '../packages/core/src/index.js';
import { windowsCmdInvocation } from '../scripts/npm-bin-shim.mjs';

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
      args: ['/d', '/s', '/c', '"C:\\workspace\\node_modules\\.bin\\diffbeacon.cmd" "--version"'],
    });
    const smoke = readFileSync('scripts/package-smoke.mjs', 'utf8');
    const helper = readFileSync('scripts/npm-bin-shim.mjs', 'utf8');
    expect(smoke).toContain('runNpmBinShim');
    expect(smoke).not.toMatch(/execFileSync\(bin/);
    expect(helper).toContain('process.env');
    expect(helper).toContain('ComSpec');
    expect(helper).toContain('shell: false');
  });

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
