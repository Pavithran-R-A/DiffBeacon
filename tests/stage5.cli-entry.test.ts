import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

// Stage 5, PHASE 16: the CLI must start itself only when it IS the program being run.
// These cases execute the shipped bundle in a child process, because a start-up guard can
// only be proved by starting the thing up.

const repository = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const bundle = fileURLToPath(new URL('../packages/cli/dist/index.js', import.meta.url));
const temporary: string[] = [];

// The bundle is a build artifact and is not tracked, so a clean checkout has no
// packages/cli/dist. This suite owns that dependency and rebuilds it through the
// repository's own build script instead of depending on a gate that happens to run first.
beforeAll(() => {
  const built = spawnSync(process.execPath, ['scripts/build-cli.mjs'], {
    cwd: repository,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  });
  expect(built.status, built.stderr).toBe(0);
});

afterEach(() => {
  for (const root of temporary.splice(0))
    rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

/** Run a real Node process, inheriting only the ambient environment. */
function node(file: string, args: string[], cwd: string) {
  const result = spawnSync(process.execPath, [file, ...args], {
    cwd,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe('the bundle starts the CLI only when it is the entrypoint', () => {
  it('prints its version when the bundle is the file Node runs', () => {
    const run = node(bundle, ['--version'], process.cwd());
    expect(run.status).toBe(0);
    expect(run.stdout).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('reviews a piped diff when the bundle is the file Node runs', () => {
    const result = spawnSync(process.execPath, [bundle, 'review', '--stdin', '--format', 'json'], {
      cwd: process.cwd(),
      input:
        'diff --git a/src/a.ts b/src/a.ts\n--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1 +1 @@\n-1\n+2\n',
      encoding: 'utf8',
      shell: false,
      windowsHide: true,
    });
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout).summary.changedFiles).toBe(1);
  });

  it('stays silent when a different module named index.js imports it as a library', () => {
    const consumer = mkdtempSync(path.join(tmpdir(), 'diffbeacon-stage5-consumer-'));
    temporary.push(consumer);
    writeFileSync(path.join(consumer, 'package.json'), '{"type":"module"}\n');
    writeFileSync(
      path.join(consumer, 'index.js'),
      `await import(${JSON.stringify(pathToFileURL(bundle).href)});\n` +
        'process.stdout.write("IMPORTED_AS_LIBRARY\\n");\n',
    );

    const run = node(path.join(consumer, 'index.js'), [], consumer);
    expect(run.status, run.stderr).toBe(0);
    expect(run.stdout).toBe('IMPORTED_AS_LIBRARY\n');
  });
});
