/**
 * Stage 7 browser harness. Everything here is test infrastructure: it drives a real
 * Chromium-class engine against a real production build served from loopback, and it
 * never stands in for one. When no engine can be found the suites that use it skip
 * with a recorded reason, so a skipped browser case can never be read as a pass.
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  rmdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright-core';

export const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * A browser engine is located rather than downloaded: Playwright's own browser
 * download is never invoked, so these tests can only run where a real Chromium-class
 * engine already exists. `DIFFBEACON_BROWSER_EXECUTABLE` overrides the search.
 */
function candidateEngines(): { name: string; executablePath: string }[] {
  const override = process.env.DIFFBEACON_BROWSER_EXECUTABLE;
  if (override) return [{ name: 'override', executablePath: override }];
  const local = process.env.LOCALAPPDATA ?? '';
  const home = process.env.HOME ?? '';
  const found: { name: string; executablePath: string }[] = [];
  const playwrightRoots = [
    local ? path.join(local, 'ms-playwright') : '',
    home ? path.join(home, '.cache/ms-playwright') : '',
  ].filter((root) => root !== '');
  for (const root of playwrightRoots) {
    if (!existsSync(root)) continue;
    for (const entry of readdirSync(root)) {
      if (!entry.startsWith('chromium-')) continue;
      for (const binary of ['chrome-win64/chrome.exe', 'chrome-linux/chrome']) {
        const executablePath = path.join(root, entry, binary);
        if (existsSync(executablePath)) found.push({ name: `chromium (${entry})`, executablePath });
      }
    }
  }
  const hosts = [
    ['google chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe'],
    ['microsoft edge', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'],
    ['/usr/bin/google-chrome', '/usr/bin/google-chrome'],
    ['/usr/bin/chromium', '/usr/bin/chromium'],
  ] as const;
  for (const [name, executablePath] of hosts) {
    if (existsSync(executablePath)) found.push({ name, executablePath });
  }
  return found;
}

const locatedEngine = candidateEngines().find((engine) => existsSync(engine.executablePath));

/**
 * Two CI-only switches, both inert when unset so a local run keeps its honest skip:
 * `DIFFBEACON_REQUIRE_BROWSER=1` fails the lane when no engine exists, and
 * `DIFFBEACON_SKIP_BROWSER=1` keeps the expensive Chromium cases out of a matrix cell that is there
 * to qualify source and package behaviour rather than a browser.
 */
const engineRequired = process.env.DIFFBEACON_REQUIRE_BROWSER === '1';
const engineSuppressed = process.env.DIFFBEACON_SKIP_BROWSER === '1';

export const browserSkipReason = engineSuppressed
  ? 'this lane sets DIFFBEACON_SKIP_BROWSER=1, so the Chromium suites are deliberately not run here; the dedicated browser lane owns them'
  : 'no Chromium-class browser engine is installed on this host; Stage 7 refuses to present a DOM simulation as browser E2E';

if (engineRequired && engineSuppressed)
  throw new Error(
    'DIFFBEACON_REQUIRE_BROWSER=1 and DIFFBEACON_SKIP_BROWSER=1 cannot both be set: the lane would demand a browser engine and forbid one.',
  );

if (engineRequired && !locatedEngine)
  throw new Error(
    `DIFFBEACON_REQUIRE_BROWSER=1 but ${browserSkipReason}. Install a Chromium-class engine or clear the flag.`,
  );

const selected = engineSuppressed ? undefined : locatedEngine;

export const browserEngine: { name: string; executablePath: string } | null = selected ?? null;

let engineReported = false;

/**
 * A non-secure origin is the only honest way to observe a missing clipboard API, so the
 * loopback server is also reachable under a name that can never be a secure context.
 */
const resolverArgs = ['--host-resolver-rules=MAP diffbeacon.invalid 127.0.0.1'];

export async function launchBrowser(
  options: { args?: string[]; viewport?: { width: number; height: number } } = {},
): Promise<Browser> {
  if (!browserEngine) throw new Error(browserSkipReason);
  const browser = await chromium.launch({
    executablePath: browserEngine.executablePath,
    args: [...resolverArgs, ...(options.args ?? [])],
  });
  if (!engineReported) {
    engineReported = true;
    console.log(`browser engine: ${browserEngine.name}; version=${browser.version()}`);
  }
  return browser;
}

const contentTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

export interface StaticSite {
  readonly port: number;
  readonly origin: string;
  url(pathname: string): string;
  close(): Promise<void>;
}

/** Serves one directory, optionally mounted under a path prefix, on loopback only. */
export async function serveDirectory(directory: string, prefix = ''): Promise<StaticSite> {
  const root = path.resolve(directory);
  const server = createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://127.0.0.1').pathname);
    let relative = prefix && pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname;
    if (relative === '' || relative === '/') relative = '/index.html';
    const file = path.resolve(root, `.${relative}`);
    if (!file.startsWith(root)) {
      response.writeHead(403).end();
      return;
    }
    if (!existsSync(file)) {
      response.writeHead(404, { 'content-type': 'text/plain' });
      response.end('not found');
      return;
    }
    response.writeHead(200, {
      'content-type': contentTypes[path.extname(file)] ?? 'application/octet-stream',
    });
    response.end(readFileSync(file));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('no loopback port');
  const port = address.port;
  return {
    port,
    origin: `http://localhost:${port}`,
    url: (pathname: string) => `http://localhost:${port}${pathname}`,
    close: () => {
      server.closeAllConnections();
      return new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}

function sleepSync(milliseconds: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

const staleLockAfter = 20 * 60_000;

/** Vitest gives each test file its own process, so builds are serialized on the filesystem. */
function acquireLock(lockFile: string): boolean {
  try {
    closeSync(openSync(lockFile, 'wx'));
    return true;
  } catch {
    return false;
  }
}

/** A lock left behind by a crashed process is older than any live build; reclaim only that exact path. */
function clearStaleLock(lockFile: string): void {
  try {
    if (Date.now() - statSync(lockFile).mtimeMs < staleLockAfter) return;
    if (statSync(lockFile).isDirectory()) rmdirSync(lockFile);
    else unlinkSync(lockFile);
  } catch {
    // Another process already released or reclaimed it.
  }
}

function withLock<T>(lockFile: string, work: () => T): T {
  const deadline = Date.now() + 300_000;
  for (;;) {
    if (acquireLock(lockFile)) break;
    clearStaleLock(lockFile);
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${lockFile}`);
    sleepSync(250);
  }
  try {
    return work();
  } finally {
    unlinkSync(lockFile);
  }
}

function buildFingerprint(): string {
  const hash = createHash('sha256');
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(file);
      else hash.update(entry.name).update(readFileSync(file));
    }
  };
  walk(path.join(repository, 'client'));
  walk(path.join(repository, 'packages/core/src'));
  hash.update(readFileSync(path.join(repository, 'vite.config.ts')));
  return hash.digest('hex').slice(0, 16);
}

/**
 * Builds the real production bundle into a disposable directory outside the repository
 * and returns it. `base` exercises the same `BASE_PATH` mechanism documented for static
 * hosting, so the repository's own `dist/` is never rewritten by a test.
 */
export function buildWeb(base: '/' | '/DiffBeacon/'): string {
  const label = base === '/' ? 'root' : 'subpath';
  const cacheRoot = path.join(tmpdir(), 'diffbeacon-stage7-browser');
  mkdirSync(cacheRoot, { recursive: true });
  const directory = path.join(cacheRoot, `${label}-${buildFingerprint()}`);
  const marker = path.join(directory, 'READY');
  if (existsSync(marker)) return directory;
  withLock(path.join(cacheRoot, `${label}.lock`), () => {
    if (existsSync(marker)) return;
    const result = spawnSync(
      process.execPath,
      [
        path.join(repository, 'node_modules/vite/bin/vite.js'),
        'build',
        '--outDir',
        directory,
        '--emptyOutDir',
      ],
      {
        cwd: repository,
        encoding: 'utf8',
        env: { ...process.env, BASE_PATH: base },
        windowsHide: true,
        maxBuffer: 8 * 1024 * 1024,
      },
    );
    if (result.status !== 0)
      throw new Error(`production build failed: ${result.stderr.slice(0, 500)}`);
    writeFileSync(marker, base, 'utf8');
  });
  return directory;
}

const browserSlotStaleAfter = 45_000;

/**
 * Four Chromium suites starve each other on a loaded machine: `npm test` measured six
 * 30-second `page.goto` timeouts plus a 60-second case timeout, while this same batch runs
 * clean at one file at a time. Instead of depending on a flag nobody remembers, every Stage 7
 * browser file claims a single cross-process slot for its whole lifetime, so the browser
 * suites serialize while the source suites keep their parallel scheduling. The holder rewrites
 * the slot file as a heartbeat, so a killed worker leaves a stale file rather than a wedge.
 */
export async function claimBrowserSlot(name: string): Promise<() => void> {
  const directory = path.join(tmpdir(), 'diffbeacon-stage7-browser');
  mkdirSync(directory, { recursive: true });
  const slot = path.join(directory, 'BROWSER_SLOT');
  const deadline = Date.now() + 20 * 60_000;
  for (;;) {
    try {
      closeSync(openSync(slot, 'wx'));
      break;
    } catch {
      try {
        if (Date.now() - statSync(slot).mtimeMs > browserSlotStaleAfter) unlinkSync(slot);
      } catch {
        // Another process released or reclaimed it between the check and this one.
      }
      if (Date.now() > deadline) throw new Error(`timed out waiting for the browser slot: ${slot}`);
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  const beat = () => {
    try {
      writeFileSync(slot, name);
    } catch {
      // Paused long enough to be reclaimed; closing must not throw over a lost lock file.
    }
  };
  beat();
  const timer = setInterval(beat, 10_000);
  return () => {
    clearInterval(timer);
    try {
      unlinkSync(slot);
    } catch {
      // Already gone.
    }
  };
}

export interface PageObservation {
  requests: string[];
  failed: string[];
  notFound: string[];
  consoleErrors: string[];
  pageErrors: string[];
  dialogs: string[];
}

/**
 * Records everything a page does on the wire and on the console. The request list is
 * how the privacy claim is measured: page delivery is expected, diff analysis is not.
 */
export function observePage(page: Page): PageObservation {
  const observation: PageObservation = {
    requests: [],
    failed: [],
    notFound: [],
    consoleErrors: [],
    pageErrors: [],
    dialogs: [],
  };
  page.on('request', (request) =>
    observation.requests.push(`${request.method()} ${request.url()}`),
  );
  page.on('requestfailed', (request) =>
    observation.failed.push(`${request.url()} ${request.failure()?.errorText ?? ''}`.trim()),
  );
  page.on('response', (response) => {
    if (response.status() >= 400)
      observation.notFound.push(`${response.status()} ${response.url()}`);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') observation.consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => observation.pageErrors.push(String(error).split('\n')[0] ?? ''));
  page.on('dialog', (dialog) => {
    observation.dialogs.push(`${dialog.type()} ${dialog.message()}`);
    void dialog.dismiss().catch(() => undefined);
  });
  return observation;
}

export const textarea = '#diff-textarea';
export const statusLine = '.input-status';

export async function openApplication(
  browser: Browser,
  site: StaticSite,
  options: {
    viewport?: { width: number; height: number };
    prefix?: string;
    clipboardPermissions?: boolean;
    hostname?: 'localhost' | 'non-secure';
    reducedMotion?: boolean;
    rejectClipboardWrite?: boolean;
  } = {},
): Promise<{ context: BrowserContext; page: Page; observation: PageObservation }> {
  const context = await browser.newContext({
    viewport: options.viewport ?? { width: 1440, height: 900 },
    ...(options.reducedMotion === undefined
      ? {}
      : { reducedMotion: options.reducedMotion ? 'reduce' : 'no-preference' }),
  });
  if (options.clipboardPermissions === true)
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: site.origin,
    });
  if (options.rejectClipboardWrite === true) {
    // Headless Chromium lets a focused document write to the clipboard without prompting, so a
    // real denial cannot be provoked by permissions alone. The rejection is modelled before any
    // page script runs, which is what the product's catch branch has to survive.
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: () => Promise.reject(new DOMException('Not allowed', 'NotAllowedError')),
        },
      });
    });
  }
  const page = await context.newPage();
  const observation = observePage(page);
  const url =
    options.hostname === 'non-secure'
      ? `http://diffbeacon.invalid:${site.port}${options.prefix ?? ''}/`
      : `${site.origin}${options.prefix ?? ''}/`;
  await page.goto(url, { waitUntil: 'networkidle' });
  return { context, page, observation };
}

/**
 * Types through the browser's own clipboard and paste keystroke, not by setting value.
 * `expected` is the value the draft should hold once React has committed the paste,
 * which for a rejected multi-megabyte paste is the previous draft, not the pasted text.
 */
export async function pasteInto(
  page: Page,
  text: string,
  expected?: string,
  timeoutMs = 60_000,
): Promise<void> {
  await page.locator(textarea).click();
  await page.evaluate(() => {
    const box = document.querySelector<HTMLTextAreaElement>('#diff-textarea');
    box?.setSelectionRange(box.value.length, box.value.length);
  });
  await page.evaluate((value) => navigator.clipboard.writeText(value), text);
  await page.keyboard.press('Control+v');
  if (expected === undefined) {
    await page.waitForTimeout(150);
    return;
  }
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if ((await page.locator(textarea).inputValue()) === expected) return;
    if (Date.now() > deadline) return;
    await page.waitForTimeout(250);
  }
}

export function utf8Length(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** Stamps live on `document`, not `window`, so page-realm checks over globals stay unaffected. */
interface PaintStamps {
  __diffbeaconPress?: number;
  __diffbeaconPaint?: number;
}

/**
 * Presses the named control and reports, in milliseconds, how long the page itself took from the
 * moment the click landed to the moment the report was painted.
 *
 * The number is an OBSERVATION, and Stage 7 gates nothing on it: no DiffBeacon product requirement
 * defines a browser performance budget, so a scenario that compared this against a threshold would
 * be inventing one. It is still the right way to record what a machine did, because the alternative
 * — a `Date.now()` window in the test process — measures something else entirely. Measured on this
 * host the application's own work was 27-50 ms and did not move when the machine was saturated with
 * 14 CPU-bound processes, while the round-trip window went from 127-160 ms idle to 258-426 ms under
 * that load, because it also contains the loopback trips of the click and of the selector wait.
 *
 * `hangCeilingMs` is a HARNESS TIMEOUT: it exists so a page that never paints fails the run instead
 * of hanging it, and says nothing about acceptable product speed.
 */
export async function timePressToReport(
  page: Page,
  buttonName: string,
  hangCeilingMs = 60_000,
): Promise<number> {
  await page.evaluate(() => {
    const stamps = document as Document & PaintStamps;
    document.addEventListener(
      'click',
      () => {
        stamps.__diffbeaconPress = performance.now();
      },
      { once: true, capture: true },
    );
    const watch = () => {
      if (stamps.__diffbeaconPress !== undefined && document.querySelector('.result-layout')) {
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            stamps.__diffbeaconPaint = performance.now();
          }),
        );
        return;
      }
      requestAnimationFrame(watch);
    };
    requestAnimationFrame(watch);
  });
  await page.getByRole('button', { name: buttonName }).click();
  await page.waitForFunction(
    () => (document as Document & PaintStamps).__diffbeaconPaint !== undefined,
    undefined,
    { timeout: hangCeilingMs },
  );
  return page.evaluate(() => {
    const stamps = document as Document & PaintStamps;
    return (stamps.__diffbeaconPaint ?? 0) - (stamps.__diffbeaconPress ?? 0);
  });
}

/** The unified-diff fixtures the browser and the core engine are both shown. */
export const fixtures = {
  runtimeOnly: `diff --git a/src/app/index.ts b/src/app/index.ts
index 1111111..2222222 100644
--- a/src/app/index.ts
+++ b/src/app/index.ts
@@ -1,1 +1,2 @@
-export const a = 1;
+export const a = 1;
+export const b = 2;
`,
  authWithTests: `diff --git a/src/auth/session.ts b/src/auth/session.ts
index 1111111..2222222 100644
--- a/src/auth/session.ts
+++ b/src/auth/session.ts
@@ -1,1 +1,2 @@
-export const read = () => null;
+export const read = (t: string) => decode(t);
+export const expired = (s: { at: number }) => s.at < Date.now();
diff --git a/src/auth/session.test.ts b/src/auth/session.test.ts
new file mode 100644
--- /dev/null
+++ b/src/auth/session.test.ts
@@ -0,0 +1,3 @@
+import { describe, it, expect } from 'vitest';
+describe('session', () => it('expires', () => expect(1).toBe(1)));
`,
  database: `diff --git a/db/migrations/20260412_sessions.sql b/db/migrations/20260412_sessions.sql
new file mode 100644
--- /dev/null
+++ b/db/migrations/20260412_sessions.sql
@@ -0,0 +1,3 @@
+create table sessions (
+  id text primary key
+);
`,
  dependency: `diff --git a/package.json b/package.json
index 1111111..2222222 100644
--- a/package.json
+++ b/package.json
@@ -1,1 +1,2 @@
-  "name": "x"
+  "name": "x",
+  "dependencies": { "jose": "^5.9.0" }
`,
  binary: `diff --git a/assets/logo.png b/assets/logo.png
index 1111111..2222222 100644
Binary files a/assets/logo.png and b/assets/logo.png differ
`,
  modeOnly: `diff --git a/scripts/run.sh b/scripts/run.sh
old mode 100644
new mode 100755
`,
  rename: `diff --git a/src/old/name.ts b/src/new/name.ts
similarity index 90%
rename from src/old/name.ts
rename to src/new/name.ts
index 1111111..2222222 100644
--- a/src/old/name.ts
+++ b/src/new/name.ts
@@ -1 +1 @@
-export const a = 1;
+export const a = 2;
`,
  unicode: `diff --git a/src/émojis/🚀launch.ts b/src/émojis/🚀launch.ts
index 1111111..2222222 100644
--- a/src/émojis/🚀launch.ts
+++ b/src/émojis/🚀launch.ts
@@ -1 +1 @@
-export const a = 1;
+export const a = 2;
`,
  malformed: `diff --git a/src/broken.ts b/src/broken.ts
index 1111111..2222222 100644
--- a/src/broken.ts
+++ b/src/broken.ts
@@ -1,2 +1,5 @@ this hunk lies about its size
-old
`,
  generated: `diff --git a/dist/bundle.js b/dist/bundle.js
new file mode 100644
--- /dev/null
+++ b/dist/bundle.js
@@ -0,0 +1,2 @@
+// generated
+console.log(1);
+diff --git a/dist/other.js b/dist/other.js
+new file mode 100644
+--- /dev/null
++++ b/dist/other.js
+@@ -0,0 +1,1 @@
+// generated
`,
} as const;

/** Hostile display text: it must stay text in every place the diff is echoed. */
export const hostilePayloads = [
  '<script>window.__DIFFBEACON_PWNED__=true</script>',
  '<img src=x onerror="window.__DIFFBEACON_PWNED__=true">',
  '<svg onload="window.__DIFFBEACON_PWNED__=1">',
  '</textarea>',
  '"><iframe src=//diffbeacon.invalid/x></iframe>',
  '[markdown](javascript:window.__DIFFBEACON_PWNED__=1)',
  '`backticks` | table | <details open>',
];

export function hostileDiff(): string {
  const marker = hostilePayloads[0] ?? '<script>';
  const path = `src/${hostilePayloads[2] ?? '<svg>'}auth.ts`;
  return `diff --git a/${path} b/${path}
index 1111111..2222222 100644
--- a/${path}
+++ b/${path}
@@ -1,1 +1,2 @@
-export const a = 1;
+export const a = 1;
+// ${marker}
`;
}

export function veryLongPathDiff(): string {
  const long = `src/${'deep-'.repeat(20)}${'x'.repeat(60)}.ts`;
  return `diff --git a/${long} b/${long}
index 1111111..2222222 100644
--- a/${long}
+++ b/${long}
@@ -1,1 +1,2 @@
-export const a = 1;
+export const a = 1;
+export const b = 2;
`;
}
