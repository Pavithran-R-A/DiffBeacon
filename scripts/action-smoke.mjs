import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = process.cwd();
const temp = mkdtempSync(path.join(tmpdir(), 'diffbeacon-action-'));
const run = (args, options = {}) =>
  execFileSync('git', args, {
    cwd: temp,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    ...options,
  }).trim();

try {
  run(['init', '-q']);
  run(['config', 'user.email', 'diffbeacon-smoke@example.invalid']);
  run(['config', 'user.name', 'DiffBeacon smoke test']);
  // The smoke repository must not run the developer's unrelated global hooks.
  const hooks = path.join(temp, 'isolated-empty-hooks');
  mkdirSync(hooks, { recursive: true });
  run(['config', 'core.hooksPath', hooks]);
  mkdirSync(path.join(temp, 'dir b'), { recursive: true });
  writeFileSync(path.join(temp, 'src.ts'), 'export const value = 1;\n');
  writeFileSync(path.join(temp, '$(touch PWNED).ts'), 'export const before = 1;\n');
  writeFileSync(path.join(temp, 'unicodé-文件.ts'), 'export const before = 1;\n');
  writeFileSync(path.join(temp, 'dir b', 'image.bin'), Buffer.from([0, 1, 2, 3, 4]));
  run(['add', '--', '.']);
  run(['commit', '-qm', 'base']);
  const base = run(['rev-parse', 'HEAD']);
  writeFileSync(path.join(temp, 'src.ts'), 'export const value = 2;\n');
  writeFileSync(path.join(temp, '$(touch PWNED).ts'), 'export const after = 2;\n');
  writeFileSync(path.join(temp, 'unicodé-文件.ts'), 'export const after = 2;\n');
  writeFileSync(path.join(temp, 'dir b', 'image.bin'), Buffer.from([0, 1, 2, 3, 255]));
  run(['add', '--', '.']);
  run(['commit', '-qm', 'head']);
  const head = run(['rev-parse', 'HEAD']);
  const eventPath = path.join(temp, 'event.json');
  const summaryPath = path.join(temp, 'summary.md');
  writeFileSync(
    eventPath,
    JSON.stringify({ pull_request: { base: { sha: base }, head: { sha: head } } }),
  );
  const actionBundlePath = path.join(root, 'packages/action/dist/index.js');
  const actionRun = spawnSync(process.execPath, [actionBundlePath], {
    cwd: temp,
    env: { ...process.env, GITHUB_EVENT_PATH: eventPath, GITHUB_STEP_SUMMARY: summaryPath },
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  });
  if (actionRun.status !== 0) throw new Error(`Action successful case failed: ${actionRun.stderr}`);
  if (actionRun.stderr !== '')
    throw new Error(`Action wrote unexpected stderr: ${actionRun.stderr}`);
  if (
    /Usage:|diffbeacon review|Expected the review command|DiffBeacon \d+\.\d+\.\d+/.test(
      actionRun.stdout,
    )
  )
    throw new Error(`Action leaked CLI startup output: ${actionRun.stdout}`);
  const bundle = readFileSync(actionBundlePath, 'utf8');
  if (/Usage:|diffbeacon review|Expected the review command|launchedAsCli/.test(bundle))
    throw new Error('Action bundle contains CLI executable startup code.');
  const summary = readFileSync(summaryPath, 'utf8');
  if (!summary.includes('# DiffBeacon review') || !summary.includes('Changed files'))
    throw new Error('Action summary was not written.');
  if (!summary.includes('$(touch PWNED).ts') || !summary.includes('unicodé-文件.ts'))
    throw new Error('Action summary omitted adversarial filenames.');
  if (existsSync(path.join(temp, 'PWNED')))
    throw new Error('Action smoke detected shell side effects.');

  const largePath = path.join(temp, 'large.txt');
  const before = `${Array.from({ length: 100_000 }, (_, index) => `before-${index.toString().padStart(6, '0')}-${'x'.repeat(90)}`).join('\n')}\n`;
  writeFileSync(largePath, before);
  run(['add', '--', 'large.txt']);
  run(['commit', '-qm', 'large-base']);
  writeFileSync(largePath, before.replaceAll('before-', 'after-'));
  run(['add', '--', 'large.txt']);
  run(['commit', '-qm', 'large-head']);
  const largeEventPath = path.join(temp, 'large-event.json');
  const largeSummaryPath = path.join(temp, 'large-summary.md');
  const largeBase = run(['rev-parse', 'HEAD~1']);
  const largeHead = run(['rev-parse', 'HEAD']);
  writeFileSync(
    largeEventPath,
    JSON.stringify({ pull_request: { base: { sha: largeBase }, head: { sha: largeHead } } }),
  );
  const largeRun = spawnSync(process.execPath, [path.join(root, 'packages/action/dist/index.js')], {
    cwd: temp,
    env: {
      ...process.env,
      GITHUB_EVENT_PATH: largeEventPath,
      GITHUB_STEP_SUMMARY: largeSummaryPath,
    },
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  });
  if (largeRun.status === 0 || !largeRun.stderr.includes('larger than'))
    throw new Error(`Action did not reject the oversize range: ${largeRun.stderr}`);
  console.log(
    `action-smoke: bundled action wrote ${summary.length} bytes; stdout=${JSON.stringify(actionRun.stdout)}; stderr=${JSON.stringify(actionRun.stderr)}; cliLeak=false; hostilePaths=true; oversizeRejected=true; range=${base.slice(0, 7)}...${head.slice(0, 7)}`,
  );
} finally {
  rmSync(temp, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
