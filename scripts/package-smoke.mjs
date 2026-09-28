import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { npmReviewInvocation, runNpmBinShim } from './npm-bin-shim.mjs';
import { runTrustedNpm } from './npm-cli.mjs';
import { scanDirectory } from './secret-scan.mjs';

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

/**
 * Run one review through the bin npm installed for this package, exactly the way a user
 * types `diffbeacon review ...`: the platform's own shim is the process, never Node plus
 * the bundle path, and the reported status is the status the shim hands back.
 */
function reviewThroughBin(bin, args, options = {}) {
  const invocation = npmReviewInvocation(bin, args, process.env);
  const { file, args: binArgs, windowsVerbatimArguments, ...rest } = invocation;
  return spawnSync(file, binArgs, {
    cwd: options.cwd ?? temp,
    input: options.input,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
    windowsVerbatimArguments,
    ...rest,
  });
}

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
  // A package that declares `license: MIT` has to ship the text it grants under; the
  // declared field alone is not something a consumer can read after installation.
  if (!files.includes('LICENSE'))
    throw new Error(`Tarball omits the license text: ${files.join(', ')}`);

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
  const installedManifest = JSON.parse(
    readFileSync(path.join(project, 'node_modules', 'diffbeacon', 'package.json'), 'utf8'),
  );
  const installedLicense = readFileSync(
    path.join(project, 'node_modules', 'diffbeacon', 'LICENSE'),
    'utf8',
  );
  if (installedLicense !== readFileSync(path.join(root, 'LICENSE'), 'utf8'))
    throw new Error('Installed package license is not the repository license text.');
  // A consumer receives the bundle rather than the source tree, so the credential scan has to
  // run against what actually landed in node_modules.
  const packageDir = path.join(project, 'node_modules', 'diffbeacon');
  // The tarball is packed from the repository manifest, so that file - not whatever the installed
  // manifest happens to claim - is what the installed version has to agree with.
  const sourceManifest = JSON.parse(
    readFileSync(path.join(root, 'packages', 'cli', 'package.json'), 'utf8'),
  );
  if (installedManifest.version !== sourceManifest.version)
    throw new Error(
      `Installed package version ${installedManifest.version} is not the version the tarball was packed from (${sourceManifest.version}).`,
    );
  const runtimeDependencies = Object.entries(installedManifest.dependencies ?? {});
  if (runtimeDependencies.length > 0)
    throw new Error(
      `Installed package declares runtime dependencies: ${runtimeDependencies
        .map(([name, specifier]) => `${name}@${specifier}`)
        .join(', ')}`,
    );
  // `bin` is the only thing npm hands a consumer, so the file it names has to be in the package and
  // has to be executable on its own: the Windows shim runs it through Node either way, but a POSIX
  // consumer execs it directly.
  const declaredBin =
    typeof installedManifest.bin === 'string'
      ? installedManifest.bin
      : Object.values(installedManifest.bin ?? {})[0];
  if (!declaredBin || !existsSync(path.join(packageDir, declaredBin)))
    throw new Error(`Installed package bin does not point at a shipped file: ${declaredBin}`);
  if (!readFileSync(path.join(packageDir, declaredBin), 'utf8').startsWith('#!'))
    throw new Error('Installed CLI bundle has no shebang, so a POSIX consumer cannot exec it.');
  const artifactFindings = scanDirectory(packageDir);
  if (artifactFindings.length > 0)
    throw new Error(
      `Installed package carries credential-shaped content: ${artifactFindings
        .map((finding) => `${finding.file}:${finding.line} ${finding.rule}`)
        .join(', ')}`,
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
  const review = reviewThroughBin(bin, ['review', '--stdin', '--format', 'json'], {
    cwd: project,
    input: sample,
  });
  if (review.status !== 0) throw new Error(`Installed bin review failed: ${review.stderr}`);
  const report = JSON.parse(review.stdout);
  if (report.summary.changedFiles !== 1)
    throw new Error('Installed bin did not analyze the sample diff.');

  // The report file is written by the bin, so the destination contract is proved through
  // the same shim a user calls, and stdout stays empty.
  const reportFile = path.join(project, 'installed-report.json');
  const toFile = reviewThroughBin(
    bin,
    ['review', '--stdin', '--format', 'json', '--output', 'installed-report.json'],
    { cwd: project, input: sample },
  );
  if (toFile.status !== 0) throw new Error(`Installed bin report file failed: ${toFile.stderr}`);
  if (toFile.stdout !== '')
    throw new Error(`Installed bin echoed the report to stdout: ${toFile.stdout.slice(0, 60)}`);
  if (JSON.parse(readFileSync(reportFile, 'utf8')).summary.changedFiles !== 1)
    throw new Error('Installed bin report file does not contain the analysis.');

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
  const rangeReview = reviewThroughBin(bin, ['review', 'HEAD~1...HEAD', '--format', 'json'], {
    cwd: repo,
  });
  if (rangeReview.status !== 0)
    throw new Error(`Installed bin Git range failed: ${rangeReview.stderr}`);
  const rangeReport = JSON.parse(rangeReview.stdout);
  if (rangeReport.summary.changedFiles !== 1)
    throw new Error('Installed bin did not analyze the real Git range.');

  // Exit codes have to survive the shim: cmd.exe is the process, so a swallowed or
  // rewritten status would make CI and shell scripts branch on the wrong value.
  const outsideRepository = path.join(temp, 'not-a-repository');
  mkdirSync(outsideRepository, { recursive: true });
  const noRepository = reviewThroughBin(bin, ['review', 'HEAD~1...HEAD'], {
    cwd: outsideRepository,
  });
  if (noRepository.status !== 3)
    throw new Error(
      `Installed bin reported no-repository as ${noRepository.status}, expected 3: ${noRepository.stderr}`,
    );
  const usageFailure = reviewThroughBin(bin, ['review', 'HEAD'], { cwd: repo });
  if (usageFailure.status !== 2)
    throw new Error(
      `Installed bin reported a usage error as ${usageFailure.status}, expected 2: ${usageFailure.stderr}`,
    );
  if (usageFailure.stdout !== '')
    throw new Error('Installed bin wrote a report for a rejected command line.');
  if (version !== installedManifest.version)
    throw new Error(
      `Installed CLI version ${version} does not match package ${installedManifest.version}.`,
    );
  if (installedManifest.engines?.node !== '>=22')
    throw new Error('Packed CLI metadata is missing engines.node >=22.');
  console.log(
    `package-smoke: ${version}; bin=${help.includes('Usage:')}; engines=${installedManifest.engines.node}; stdinFiles=${report.summary.changedFiles}; rangeFiles=${rangeReport.summary.changedFiles}; fileStdoutBytes=${toFile.stdout.length}; noRepositoryExit=${noRepository.status}; usageExit=${usageFailure.status}; tarballFiles=${files.length}; license=${installedManifest.license}; installedLicenseBytes=${Buffer.byteLength(installedLicense)}; runtimeDependencies=${Object.keys(installedManifest.dependencies ?? {}).length}; artifactSecretFindings=${artifactFindings.length}`,
  );
} finally {
  rmSync(temp, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
