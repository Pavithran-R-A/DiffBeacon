import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import process from 'node:process';
import { runTrustedNpm } from './npm-cli.mjs';
import { renderSourceManifest } from './source-manifest.mjs';

const root = process.cwd();
const node = process.execPath;

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: 'inherit',
    shell: false,
    windowsHide: true,
    ...options,
  });
}

function runNpm(script, args = []) {
  return runTrustedNpm(['run', script, ...args], { cwd: root, stdio: 'inherit' });
}

function assertExists(file) {
  if (!existsSync(file)) throw new Error(`Required source/artifact is missing: ${file}`);
}

function assertNoObsoleteSurface() {
  const obsolete = [
    'server',
    'shared',
    'template.json',
    'components.json',
    'pnpm-workspace.yaml',
    'patches',
    'client/src/components',
    'client/src/contexts',
    'client/src/hooks',
    'client/src/lib',
    'client/public/__manus__',
  ];
  const present = obsolete.filter((file) => existsSync(file));
  if (present.length > 0)
    throw new Error(`Obsolete template surface remains: ${present.join(', ')}`);
}

function assertSourceCompleteness() {
  const required = [
    'README.md',
    'LICENSE',
    'SECURITY.md',
    'CONTRIBUTING.md',
    'action.yml',
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'eslint.config.mjs',
    'SOURCE_MANIFEST.txt',
    'packages/core/src/model.ts',
    'packages/core/src/parser.ts',
    'packages/core/src/analyze.ts',
    'packages/core/src/render.ts',
    'packages/core/package.json',
    'packages/core/schema/review-attention-map.schema.json',
    'packages/cli/src/index.ts',
    'packages/cli/src/errors.ts',
    'packages/cli/src/git.ts',
    'packages/cli/src/revisions.ts',
    'packages/cli/package.json',
    'packages/action/src/index.ts',
    'packages/action/dist/index.js',
    'packages/core/schema/review-attention-map.schema.json',
    'scripts/build.mjs',
    'scripts/build-cli.mjs',
    'scripts/build-action.mjs',
    'scripts/package-smoke.mjs',
    'scripts/action-smoke.mjs',
    'scripts/verify.mjs',
    'scripts/npm-cli.mjs',
    'scripts/npm-bin-shim.mjs',
    'scripts/npm-bin-shim.d.mts',
    'scripts/source-manifest.mjs',
    'client/index.html',
    'client/src/App.tsx',
    'client/src/main.tsx',
    'client/src/pages/Home.tsx',
    'client/src/index.css',
    'tests/core.test.ts',
    'tests/cli.integration.test.ts',
    'tests/stage3b.real-git.test.ts',
    'tests/npm-helper.test.ts',
    'tests/stage3b.static.test.ts',
    'tests/stage3c.release.test.ts',
    'tests/stage4.release.test.ts',
    'tests/stage5.git-determinism.test.ts',
  ];
  required.forEach(assertExists);
  assertNoObsoleteSurface();
  const posixMkdir = ['mkdir', '-p'].join(' ');
  const posixTmp = ['/', 'tmp/'].join('');
  const text = [
    readFileSync('client/src/index.css', 'utf8'),
    readFileSync('client/index.html', 'utf8'),
    readFileSync('client/src/main.tsx', 'utf8'),
    readFileSync('client/src/App.tsx', 'utf8'),
    readFileSync('client/src/pages/Home.tsx', 'utf8'),
  ].join('\n');
  const browserForbidden =
    /manus-storage|BUILT_IN_FORGE|debug-collector|analytics|sendBeacon|XMLHttpRequest|WebSocket/i;
  if (browserForbidden.test(text))
    throw new Error('Static app source references Manus/Forge/storage/telemetry infrastructure.');
  if (/\bserver\b|\bshared\b|wouter|tailwindcss/i.test(readFileSync('package.json', 'utf8')))
    throw new Error('Root package still references removed template runtime surface.');
  if (readFileSync('vite.config.ts', 'utf8').includes('.manus.computer'))
    throw new Error('Vite configuration still references the builder-specific preview host.');
  if (/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|umami|google-analytics/i.test(text))
    throw new Error('Static app source contains a network or telemetry API.');
  for (const script of [
    'scripts/build.mjs',
    'scripts/build-cli.mjs',
    'scripts/build-action.mjs',
    'scripts/package-smoke.mjs',
    'scripts/action-smoke.mjs',
    'scripts/verify.mjs',
  ]) {
    const source = readFileSync(script, 'utf8');
    if (source.includes(posixMkdir) || source.includes(posixTmp))
      throw new Error(`POSIX-only path/process detected in ${script}`);
  }
}

function productionFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = `${directory}/${entry.name}`;
    return entry.isDirectory() ? productionFiles(file) : [file];
  });
}

function assertProductionWebOutput() {
  const files = productionFiles('dist').filter((file) => /\.(html|css|js)$/i.test(file));
  const forbidden =
    /manus-storage|BUILT_IN_FORGE|debug-collector|analytics|sendBeacon|XMLHttpRequest|WebSocket/i;
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    if (forbidden.test(text)) throw new Error(`Forbidden web infrastructure reference in ${file}`);
  }
  if (!files.some((file) => file.endsWith('index.html')))
    throw new Error('Production web output is missing index.html.');
}

function assertFreshArtifacts() {
  const required = [
    'packages/action/dist/index.js',
    'packages/cli/dist/index.js',
    'dist/index.html',
    'action.yml',
  ];
  required.forEach(assertExists);
  if (statSync('packages/action/dist/index.js').size < 10_000)
    throw new Error('Action bundle is unexpectedly small.');
  if (statSync('packages/cli/dist/index.js').size < 10_000)
    throw new Error('CLI bundle is unexpectedly small.');
  assertProductionWebOutput();
  const actionMetadata = readFileSync('action.yml', 'utf8');
  if (!actionMetadata.includes('using: node24')) throw new Error('Action runtime is not node24.');
  if (!actionMetadata.includes('packages/action/dist/index.js'))
    throw new Error('Action metadata does not point to the bundled artifact.');
  if (!readFileSync('packages/action/dist/index.js', 'utf8').includes('DiffBeacon Action error'))
    throw new Error('Action bundle is stale or missing runtime code.');
  const cliPackage = JSON.parse(readFileSync('packages/cli/package.json', 'utf8'));
  if (cliPackage.bin?.diffbeacon !== 'dist/index.js')
    throw new Error('CLI bin shim metadata is wrong.');
  if (!readFileSync('packages/cli/dist/index.js', 'utf8').includes('DiffSizeLimitError'))
    throw new Error('CLI bundle is stale or missing bounded collector code.');
}

function assertManifestCurrent() {
  const expected = renderSourceManifest(root);
  const actual = existsSync('SOURCE_MANIFEST.txt')
    ? readFileSync('SOURCE_MANIFEST.txt', 'utf8')
    : '';
  if (expected !== actual)
    throw new Error(
      'SOURCE_MANIFEST.txt does not match the tracked source. Run `npm run manifest` and commit the result; verify never rewrites the source tree.',
    );
}

assertSourceCompleteness();
runNpm('format:check');
runNpm('lint');
runNpm('typecheck');
runNpm('test');
runNpm('build');
assertFreshArtifacts();
assertManifestCurrent();
run(node, ['packages/cli/dist/index.js', '--version']);
run(node, ['packages/cli/dist/index.js', '--help']);
runNpm('package-smoke');
runNpm('action-smoke');
console.log('DiffBeacon source-first verification passed.');
