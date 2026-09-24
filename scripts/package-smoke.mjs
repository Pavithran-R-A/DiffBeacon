import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { runNpmBinShim } from './npm-bin-shim.mjs';
import { runTrustedNpm } from './npm-cli.mjs';

const root = process.cwd();
const temp = mkdtempSync(path.join(tmpdir(), 'diffbeacon-package-'));
const run = (args, options = {}) =>
  execFileSync('git', args, {
    cwd: options.cwd ?? temp,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    windowsHide: true,
    ...options,
  }).trim();

try {
  const packOutput = runTrustedNpm(
    ['pack', './packages/cli', '--pack-destination', temp, '--json'],
    {
      cwd: root,
      encoding: 'utf8',
      shell: false,
      windowsHide: true,
    },
  );
  const packed = JSON.parse(packOutput);
  const tarballName = packed[0]?.filename;
  if (typeof tarballName !== 'string') throw new Error('npm pack did not return a tarball name.');
  const tarball = path.join(temp, tarballName);
  const files = (packed[0]?.files ?? []).map((entry) => entry.path);
  if (!files.includes('dist/index.js') || !files.includes('package.json'))
    throw new Error(`Tarball is missing the CLI bundle or metadata: ${files.join(', ')}`);
  if (files.some((file) => /(^|\/)(test|tests|node_modules|\.env)(\/|$)/i.test(file)))
    throw new Error(`Tarball contains source junk: ${files.join(', ')}`);

  const project = path.join(temp, 'consumer');
  mkdirSync(project, { recursive: true });
  runTrustedNpm(['init', '--yes'], {
    cwd: project,
    stdio: 'ignore',
    shell: false,
    windowsHide: true,
  });
  runTrustedNpm(['install', '--ignore-scripts', '--no-audit', '--no-fund', tarball], {
    cwd: project,
    stdio: 'ignore',
    shell: false,
    windowsHide: true,
  });
  const bin = path.join(
    project,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'diffbeacon.cmd' : 'diffbeacon',
  );
  const entrypoint = path.join(project, 'node_modules', 'diffbeacon', 'dist', 'index.js');
  const installedManifest = JSON.parse(
    readFileSync(path.join(project, 'node_modules', 'diffbeacon', 'package.json'), 'utf8'),
  );
  const version = runNpmBinShim(bin, ['--version'], {
    cwd: project,
    encoding: 'utf8',
    windowsHide: true,
  }).trim();
  const help = runNpmBinShim(bin, ['--help'], {
    cwd: project,
    encoding: 'utf8',
    windowsHide: true,
  });
  const sample =
    'diff --git a/README.md b/README.md\n--- a/README.md\n+++ b/README.md\n@@ -1 +1 @@\n-old\n+new\n';
  const review = spawnSync(
    process.execPath,
    [entrypoint, 'review', '--stdin', '--format', 'json'],
    {
      cwd: project,
      input: sample,
      encoding: 'utf8',
      shell: false,
      windowsHide: true,
    },
  );
  if (review.status !== 0) throw new Error(`Installed CLI review failed: ${review.stderr}`);
  const report = JSON.parse(review.stdout);
  if (report.summary.changedFiles !== 1)
    throw new Error('Installed CLI did not analyze the sample diff.');

  const repo = path.join(project, 'range repository');
  mkdirSync(repo, { recursive: true });
  run(['init', '-q'], { cwd: repo });
  run(['config', 'user.email', 'diffbeacon-smoke@example.invalid'], { cwd: repo });
  run(['config', 'user.name', 'DiffBeacon package smoke'], { cwd: repo });
  // The smoke repository must not run the developer's unrelated global hooks.
  const hooks = path.join(project, 'isolated-empty-hooks');
  mkdirSync(hooks, { recursive: true });
  run(['config', 'core.hooksPath', hooks], { cwd: repo });
  writeFileSync(path.join(repo, 'src.ts'), 'export const value = 1;\n');
  run(['add', '--', 'src.ts'], { cwd: repo });
  run(['commit', '-qm', 'base'], { cwd: repo });
  writeFileSync(path.join(repo, 'src.ts'), 'export const value = 2;\n');
  run(['add', '--', 'src.ts'], { cwd: repo });
  run(['commit', '-qm', 'head'], { cwd: repo });
  const rangeReview = spawnSync(
    process.execPath,
    [entrypoint, 'review', 'HEAD~1...HEAD', '--format', 'json'],
    {
      cwd: repo,
      encoding: 'utf8',
      shell: false,
      windowsHide: true,
    },
  );
  if (rangeReview.status !== 0)
    throw new Error(`Installed CLI Git range failed: ${rangeReview.stderr}`);
  const rangeReport = JSON.parse(rangeReview.stdout);
  if (rangeReport.summary.changedFiles !== 1)
    throw new Error('Installed CLI did not analyze the real Git range.');
  if (version !== installedManifest.version)
    throw new Error(
      `Installed CLI version ${version} does not match package ${installedManifest.version}.`,
    );
  if (installedManifest.engines?.node !== '>=22')
    throw new Error('Packed CLI metadata is missing engines.node >=22.');
  console.log(
    `package-smoke: ${version}; bin=${help.includes('Usage:')}; engines=${installedManifest.engines.node}; stdinFiles=${report.summary.changedFiles}; rangeFiles=${rangeReport.summary.changedFiles}; tarballFiles=${files.length}`,
  );
} finally {
  rmSync(temp, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
