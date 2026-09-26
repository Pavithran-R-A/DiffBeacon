import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { actionEntrypoint, readActionMetadata } from './action-metadata.mjs';

// Stage 6, PHASE 22: the smoke test launches whatever action.yml names, from a working
// directory that is not the reviewed repository, with the same four variables a runner
// exports. A bundle that only works when the current directory happens to be the target,
// or when the metadata and the artifact disagree, must fail here rather than on a runner.

const root = process.cwd();
const repository = actionEntrypoint(readActionMetadata(readFileSync('action.yml', 'utf8')), root);
const temp = mkdtempSync(path.join(tmpdir(), 'diffbeacon-action-'));
const outside = mkdtempSync(path.join(tmpdir(), 'diffbeacon-action-outside-'));
const run = (args) => {
  const result = spawnSync('git', args, {
    cwd: temp,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  });
  if (result.status !== 0) throw new Error(`git ${args[0]} failed: ${result.stderr}`);
  return result.stdout.trim();
};

function review(eventPath, summaryPath) {
  return spawnSync(process.execPath, [repository], {
    cwd: outside,
    env: {
      ...process.env,
      GITHUB_EVENT_NAME: 'pull_request',
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_WORKSPACE: temp,
      GITHUB_STEP_SUMMARY: summaryPath,
    },
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  });
}

function fail(message) {
  throw new Error(message);
}

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

  // The event payload and both summary targets live outside the reviewed repository: anything
  // the smoke writes into the target would be indistinguishable from damage the Action did.
  const eventPath = path.join(outside, 'event.json');
  const summaryPath = path.join(outside, 'summary.md');
  writeFileSync(
    eventPath,
    JSON.stringify({ pull_request: { base: { sha: base }, head: { sha: head } } }),
  );
  const actionRun = review(eventPath, summaryPath);
  if (actionRun.status !== 0) fail(`Action successful case failed: ${actionRun.stderr}`);
  if (actionRun.stderr !== '') fail(`Action wrote unexpected stderr: ${actionRun.stderr}`);
  if (actionRun.stdout !== '')
    fail(
      `Action reported on stdout instead of the Job Summary: ${JSON.stringify(actionRun.stdout)}`,
    );
  if (
    /Usage:|diffbeacon review|Expected the review command|DiffBeacon \d+\.\d+\.\d+/.test(
      actionRun.stdout,
    )
  )
    fail(`Action leaked CLI startup output: ${actionRun.stdout}`);
  const bundle = readFileSync(repository, 'utf8');
  if (/Usage:|diffbeacon review|Expected the review command|launchedAsCli/.test(bundle))
    fail('Action bundle contains CLI executable startup code.');
  const summary = readFileSync(summaryPath, 'utf8');
  if (!summary.includes('# DiffBeacon review') || !summary.includes('Changed files'))
    fail('Action summary was not written.');
  if (!summary.includes('$(touch PWNED).ts') || !summary.includes('unicodé-文件.ts'))
    fail('Action summary omitted adversarial filenames.');
  if (!summary.endsWith('\n') || summary.endsWith('\n\n'))
    fail('Action summary does not end with exactly one newline.');
  if (existsSync(path.join(temp, 'PWNED'))) fail('Action smoke detected shell side effects.');
  if (run(['status', '--porcelain']) !== '')
    fail(`Action dirtyied the reviewed repository: ${run(['status', '--porcelain'])}`);

  // An oversize diff must fail without leaving a half-written review behind.
  const largePath = path.join(temp, 'large.txt');
  const before = `${Array.from({ length: 100_000 }, (_, index) => `before-${index.toString().padStart(6, '0')}-${'x'.repeat(90)}`).join('\n')}\n`;
  writeFileSync(largePath, before);
  run(['add', '--', 'large.txt']);
  run(['commit', '-qm', 'large-base']);
  writeFileSync(largePath, before.replaceAll('before-', 'after-'));
  run(['add', '--', 'large.txt']);
  run(['commit', '-qm', 'large-head']);
  const largeEventPath = path.join(outside, 'large-event.json');
  const largeSummaryPath = path.join(outside, 'large-summary.md');
  const largeBase = run(['rev-parse', 'HEAD~1']);
  const largeHead = run(['rev-parse', 'HEAD']);
  writeFileSync(
    largeEventPath,
    JSON.stringify({ pull_request: { base: { sha: largeBase }, head: { sha: largeHead } } }),
  );
  const largeRun = review(largeEventPath, largeSummaryPath);
  if (largeRun.status === 0) fail('Action accepted the oversize range.');
  if (!largeRun.stderr.includes('larger than'))
    fail(`Action rejected the oversize range without naming it: ${largeRun.stderr}`);
  if (existsSync(largeSummaryPath))
    fail('Action wrote a Job Summary for a review that never completed.');

  // An unsupported trigger must be refused before Git is consulted, and with it nothing
  // may be appended to a summary the workflow already owns.
  const seededSummary = path.join(temp, 'seeded-summary.md');
  writeFileSync(seededSummary, 'NOT A DIFFBEACON REVIEW\n');
  const triggeredEvent = path.join(temp, 'target-event.json');
  writeFileSync(
    triggeredEvent,
    JSON.stringify({ pull_request: { base: { sha: base }, head: { sha: head } } }),
  );
  const triggered = spawnSync(process.execPath, [repository], {
    cwd: outside,
    env: {
      ...process.env,
      GITHUB_EVENT_NAME: 'pull_request_target',
      GITHUB_EVENT_PATH: triggeredEvent,
      GITHUB_WORKSPACE: temp,
      GITHUB_STEP_SUMMARY: seededSummary,
    },
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  });
  if (triggered.status === 0) fail('Action accepted pull_request_target.');
  if (!triggered.stderr.includes('only the pull_request event'))
    fail(`Action refused the trigger without naming the event: ${triggered.stderr}`);
  if (readFileSync(seededSummary, 'utf8') !== 'NOT A DIFFBEACON REVIEW\n')
    fail('Action appended to a Job Summary for a review that never ran.');

  console.log(
    `action-smoke: ${path.relative(root, repository).split(path.sep).join('/')} wrote ${String(summary.length)} bytes to the Job Summary; stdout=${JSON.stringify(actionRun.stdout)}; stderr=${JSON.stringify(actionRun.stderr)}; cliLeak=false; hostilePaths=true; cleanWorkspace=true; oversizeRejected=true; partialSummary=false; pullRequestTargetRejected=true; range=${base.slice(0, 7)}...${head.slice(0, 7)}`,
  );
} finally {
  for (const directory of [temp, outside])
    rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
