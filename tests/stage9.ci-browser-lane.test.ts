import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { browserEngine } from './stage7.browser-harness';

vi.setConfig({ testTimeout: 180_000, hookTimeout: 60_000 });

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vitestCli = path.join(repository, 'node_modules', 'vitest', 'vitest.mjs');
const browserFile = 'tests/stage7.browser-contract.test.ts';

/**
 * Runs the browser lane in a real Vitest process. `unreachableEngine` points the override at a
 * path that does not exist, so the "no engine" cases do not depend on what the host happens to
 * have installed. `node_modules/vitest` is a development dependency, absent from a production
 * install, so the whole helper reports nothing there.
 *
 * The inherited lane flags are cleared before the caller's are applied. Each case has to be judged
 * on the combination it asks for: `npm run check` and the CI source matrix both export
 * `DIFFBEACON_SKIP_BROWSER=1` for the whole process, and a child that kept it would answer the
 * "required but no engine" case with the both-flags error rather than the no-engine error.
 */
function runBrowserLane(extraEnv: Record<string, string>, unreachableEngine = true) {
  if (!existsSync(vitestCli)) return undefined;
  const env = { ...process.env };
  delete env.DIFFBEACON_REQUIRE_BROWSER;
  delete env.DIFFBEACON_SKIP_BROWSER;
  delete env.DIFFBEACON_BROWSER_EXECUTABLE;
  const result = spawnSync(
    process.execPath,
    [vitestCli, 'run', '--project', 'browser', browserFile],
    {
      cwd: repository,
      encoding: 'utf8',
      env: {
        ...env,
        ...(unreachableEngine ? { DIFFBEACON_BROWSER_EXECUTABLE: 'no/such/engine' } : {}),
        ...extraEnv,
      },
    },
  );
  return `${result.stdout ?? ''}${result.stderr ?? ''}`;
}

describe('Stage 9 browser lane CI contract', () => {
  it('fails closed when the lane is required but no engine exists', () => {
    const output = runBrowserLane({ DIFFBEACON_REQUIRE_BROWSER: '1' });
    if (output === undefined) return;
    expect(output).toMatch(/DIFFBEACON_REQUIRE_BROWSER=1/);
    expect(output).toMatch(/no Chromium-class browser engine is installed/);
  });

  it('keeps skipping honestly when the lane is not required', () => {
    const output = runBrowserLane({});
    if (output === undefined) return;
    expect(output).toMatch(/skip/i);
    expect(output).not.toMatch(/DIFFBEACON_REQUIRE_BROWSER=1/);
  });

  it('keeps a source matrix cell out of the Chromium cases when told to', () => {
    // Suppressing a lane that could not have run anyway proves nothing, so this case is only
    // meaningful on a host that owns an engine.
    if (browserEngine === null) return;
    const output = runBrowserLane({ DIFFBEACON_SKIP_BROWSER: '1' }, false);
    if (output === undefined) return;
    expect(output).toMatch(/DIFFBEACON_SKIP_BROWSER=1/);
    expect(output).toMatch(/skipped/);
  });

  it('refuses a lane that both demands and forbids a browser engine', () => {
    const output = runBrowserLane({
      DIFFBEACON_REQUIRE_BROWSER: '1',
      DIFFBEACON_SKIP_BROWSER: '1',
    });
    if (output === undefined) return;
    expect(output).toMatch(/cannot both be set/);
  });

  it('schedules the Chromium files one at a time, so no beforeAll queues behind five peers', () => {
    // Measured on this host with all six files eligible in one process: the lane completed in 933 s,
    // five files passed, and the last file's `beforeAll` spent its whole 900 s hook budget waiting
    // for the cross-process slot, so 39 real Chromium cases were reported skipped. The slot already
    // serialises the work; parallel file scheduling only turns that serialisation into a queue that
    // can outlive the hook budget. One file at a time acquires the slot immediately instead.
    const config = readFileSync(path.join(repository, 'vitest.config.ts'), 'utf8');
    const marker = config.indexOf("name: 'browser'");
    expect(marker, 'vitest.config.ts must keep a dedicated browser project').toBeGreaterThan(-1);
    expect(config.slice(marker)).toMatch(/fileParallelism: false/);
  });
});
