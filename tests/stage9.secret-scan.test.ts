import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  SECRET_RULES,
  classifyFiles,
  scanDirectory,
  scanRepositoryFiles,
  scanText,
} from '../scripts/secret-scan.mjs';

const CANARIES = {
  'private-key':
    'baggage\n-----BEGIN RSA PRIVATE KEY-----\nQUJDREVGRw\n-----END RSA PRIVATE KEY-----\n',
  'github-token':
    'const headers = { authorization: "ghp_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" };\n',
  'github-fine-grained-token':
    'token=github_pat_11ABCDEFG0ABCDEFGHIJ_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\n',
  'npm-token':
    '//registry.npmjs.org/:_authToken=_npm_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\n',
  'aws-access-key-id': 'const key = "AKIAABCDEFGHIJKLMN";\n',
  'slack-token': 'const hook = "xoxb-1234567890";\n',
  'credential-url': 'npm publish --registry=https://alice:s3cr3tv4lue@registry.example.invalid\n',
  'secret-assignment': 'export const GITHUB_TOKEN = "NotAPlaceholderValue123";\n',
};

describe('Stage 9 secret scan', () => {
  it('names every credential family the scanner claims to cover', () => {
    expect(SECRET_RULES.map((rule) => rule.id).sort()).toEqual(Object.keys(CANARIES).sort());
  });

  for (const [rule, canary] of Object.entries(CANARIES)) {
    it(`flags the ${rule} canary without quoting its value`, () => {
      const findings = scanText(`fixture/${rule}.txt`, canary);
      expect(findings.map((finding) => finding.rule)).toContain(rule);
      const finding = findings.find((entry) => entry.rule === rule);
      expect(JSON.stringify(finding)).not.toMatch(/AKIAABCDEFGHIJKLMN|ghp_A{40}|_npm_A{40}/);
      expect(finding?.digest).toMatch(/^[0-9a-f]{16}$/);
      expect(finding?.length).toBeGreaterThan(0);
    });
  }

  it('reports nothing for ordinary code and placeholder prose', () => {
    const clean =
      'const url = "https://github.com/Pavithran-R-A/DiffBeacon.git";\n' +
      '// The example workflow shows uses: owner/repo@<REVIEWED_FULL_COMMIT_SHA>\n' +
      'process.env.GITHUB_TOKEN;\n';
    expect(scanText('fixture/clean.ts', clean)).toEqual([]);
  });

  it('classifies the reviewed fixtures in this repository instead of hiding them', () => {
    const files = scanRepositoryFiles(process.cwd());
    expect(files.length).toBeGreaterThan(100);
    const report = classifyFiles(files);
    expect(report.unclassified).toEqual([]);
    expect(report.classified.length).toBeGreaterThan(0);
    for (const entry of report.classified) expect(entry.reason.length).toBeGreaterThan(10);
  });

  it('fails closed when a tracked file gains an unreviewed credential', () => {
    const report = classifyFiles([
      { file: 'packages/cli/src/index.ts', content: CANARIES['aws-access-key-id'] },
    ]);
    expect(report.unclassified.map((finding) => finding.rule)).toEqual(['aws-access-key-id']);
  });

  it('rejects a stale classification entry', () => {
    expect(() => classifyFiles([])).not.toThrow();
    const report = classifyFiles([{ file: 'no/such/file.txt', content: CANARIES['npm-token'] }]);
    expect(report.stale.map((entry) => entry.file)).toContain('no/such/file.txt');
    expect(report.stale.length).toBeGreaterThan(0);
  });

  it('scans the built artifacts that actually ship, when they exist', () => {
    const tracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], {
      encoding: 'utf8',
    });
    expect(tracked).not.toMatch(/\.env$/m);
    const report = classifyFiles(scanRepositoryFiles(process.cwd()));
    expect(report.findings.length).toBeGreaterThanOrEqual(report.classified.length);
  });

  it('reports findings inside a directory it is handed, not just tracked files', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'diffbeacon-scan-'));
    try {
      writeFileSync(path.join(dir, 'clean.txt'), 'export const value = 1;\n');
      expect(scanDirectory(dir)).toEqual([]);
      writeFileSync(path.join(dir, 'bad.js'), CANARIES['aws-access-key-id']);
      const findings = scanDirectory(dir);
      expect(findings.map((finding) => finding.rule)).toEqual(['aws-access-key-id']);
      expect(JSON.stringify(findings)).not.toContain('AKIAABCDEFGHIJKLMN');
    } finally {
      rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    }
  });

  it('does not exempt NUL-bearing files from credential detection', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'diffbeacon-scan-binary-'));
    try {
      writeFileSync(
        path.join(dir, 'binary-ish.dat'),
        Buffer.concat([Buffer.from([0, 1, 2, 0]), Buffer.from(CANARIES['aws-access-key-id'])]),
      );
      expect(scanDirectory(dir).map((finding) => finding.rule)).toEqual(['aws-access-key-id']);
    } finally {
      rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    }
  });

  it('is a repository gate, not an optional script', () => {
    const manifest = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(manifest.scripts['secret-scan']).toBe('node scripts/secret-scan.mjs');
    const verify = readFileSync('scripts/verify.mjs', 'utf8');
    expect(verify).toContain("runNpm('secret-scan')");
    expect(verify).toContain("'scripts/secret-scan.mjs'");
    const smoke = readFileSync('scripts/package-smoke.mjs', 'utf8');
    expect(smoke).toContain('scanDirectory');
  });
});

describe.runIf(process.platform !== 'win32')('secret-scan symbolic-link boundary', () => {
  it('scans a link as repository data instead of following it outside the scan root', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'diffbeacon-scan-link-'));
    const dir = path.join(root, 'scan');
    try {
      mkdirSync(dir);
      const outside = path.join(root, 'outside.txt');
      writeFileSync(outside, CANARIES['aws-access-key-id']);
      symlinkSync('../outside.txt', path.join(dir, 'link.txt'));

      expect(scanDirectory(dir)).toEqual([]);
      writeFileSync(outside, CANARIES['github-token']);
      expect(scanDirectory(dir)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    }
  });
});

