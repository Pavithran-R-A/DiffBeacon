/**
 * Stage 7, PHASES 4, 9 and 15-23: the clipboard, the wire, and the DOM are the three
 * places where a browser demo can lie about itself. Each case here drives a real
 * Chromium and measures what actually happened rather than what the page claims.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { analyzeDiff } from '../packages/core/src/index.js';
import {
  browserEngine,
  browserSkipReason,
  buildWeb,
  claimBrowserSlot,
  fixtures,
  hostileDiff,
  hostilePayloads,
  launchBrowser,
  openApplication,
  observePage,
  pasteInto,
  repository,
  serveDirectory,
  statusLine,
  textarea,
  veryLongPathDiff,
  type PageObservation,
  type StaticSite,
} from './stage7.browser-harness.js';
import type { Browser, Page } from 'playwright-core';

/**
 * Claiming the browser slot can mean queueing behind three other real-Chromium files, so the hook
 * budget is a scheduling allowance for that queue. It is deliberately not a per-case budget: a
 * Stage 7 case that runs slow still has to fail inside its own, much smaller, test timeout.
 */
vi.setConfig({ testTimeout: 60_000, hookTimeout: 900_000 });

const describeBrowser = browserEngine ? describe : describe.skip;
if (!browserEngine) console.warn(`stage7.browser-security: ${browserSkipReason}`);

let browser: Browser;
let site: StaticSite;
let releaseSlot: (() => void) | undefined;

const copyButton = (target: Page) =>
  target.getByRole('button', { name: 'Copy current JSON report' });

const analyzeButton = (target: Page) => target.getByRole('button', { name: 'Analyze diff' });

async function reportedPage(diff: string): Promise<{ page: Page; observation: PageObservation }> {
  const opened = await openApplication(browser, site, { clipboardPermissions: true });
  await opened.page.locator(textarea).fill(diff);
  await analyzeButton(opened.page).click();
  await opened.page.waitForSelector('.result-layout');
  const requests = opened.observation.requests.length;
  // Everything after this line is analysis, and analysis must not touch the wire.
  opened.observation.requests.length = 0;
  opened.observation.notFound.length = 0;
  opened.observation.failed.length = 0;
  expect(
    requests,
    'the page should finish loading before the analysis window opens',
  ).toBeGreaterThan(0);
  return opened;
}

beforeAll(async () => {
  releaseSlot = await claimBrowserSlot('security');
  browser = await launchBrowser();
  site = await serveDirectory(buildWeb('/'));
});

afterAll(async () => {
  await browser?.close();
  await site?.close();
  releaseSlot?.();
});

describeBrowser('clipboard export is the truth, in every outcome', () => {
  it('writes the exact report JSON and only then says it was copied', async () => {
    const { page } = await reportedPage(fixtures.authWithTests);
    await copyButton(page).click();
    const written = await page.evaluate(() => navigator.clipboard.readText());
    expect(JSON.parse(written)).toEqual(analyzeDiff(fixtures.authWithTests));
    expect(await page.locator(statusLine).innerText()).toMatch(/copied/i);
    await page.context().close();
  });

  it('says the report could not be copied when the clipboard API does not exist', async () => {
    const insecure = await openApplication(browser, site, { hostname: 'non-secure' });
    const page = insecure.page;
    expect(
      await page.evaluate(() => Boolean(navigator.clipboard && 'writeText' in navigator.clipboard)),
    ).toBe(false);
    await page.locator(textarea).fill(fixtures.authWithTests);
    await analyzeButton(page).click();
    await page.waitForSelector('.result-layout');
    await copyButton(page).click();
    const notice = await page.locator(statusLine).innerText();
    expect(notice).not.toMatch(/copied|clipboard contains/i);
    expect(notice).toMatch(/could not|not available|unavailable|blocked|failed/i);
    expect(insecure.observation.pageErrors).toEqual([]);
    await page.context().close();
  });

  it('says the copy was blocked when the clipboard write is rejected', async () => {
    const opened = await openApplication(browser, site, { rejectClipboardWrite: true });
    const page = opened.page;
    expect(
      await page.evaluate(() => Boolean(navigator.clipboard && 'writeText' in navigator.clipboard)),
    ).toBe(true);
    await page.locator(textarea).fill(fixtures.authWithTests);
    await analyzeButton(page).click();
    await page.waitForSelector('.result-layout');
    await copyButton(page).click();
    await expect
      .poll(() => page.locator(statusLine).innerText(), { timeout: 10_000 })
      .toMatch(/could not|not available|unavailable|blocked|failed/i);
    const notice = await page.locator(statusLine).innerText();
    expect(notice).not.toMatch(/copied|clipboard contains/i);
    expect(await page.locator('.result-layout').count()).toBe(1);
    expect(opened.observation.pageErrors).toEqual([]);
    expect(opened.observation.consoleErrors).toEqual([]);
    await page.context().close();
  });

  it('copies without downloading a file, and offers no download control', async () => {
    const { page } = await reportedPage(fixtures.database);
    const downloads: string[] = [];
    page.on('download', (download) => downloads.push(download.suggestedFilename()));
    await copyButton(page).click();
    await page.waitForTimeout(400);
    expect(downloads).toEqual([]);
    expect(await page.getByRole('link', { name: /download/i }).count()).toBe(0);
    await page.context().close();
  });
});

describeBrowser('the analysis path stays on this machine', () => {
  const markers = ['AWS_KEY_AKIA1234567890EXAMPLE', 'sk-secret-marker-do-not-leak'];

  it('makes no request while a diff containing a secret marker is analyzed', async () => {
    const diff = `${fixtures.authWithTests}+const note = "${markers[0]}";\n`;
    const { page, observation } = await reportedPage(diff);
    expect(observation.requests).toEqual([]);
    expect(observation.failed).toEqual([]);
    expect(page.url()).toContain(site.origin);
    await page.context().close();
  });

  it('makes no request and disturbs no global across the whole interaction sweep', async () => {
    const marker = `db-leak-probe-${Math.random().toString(36).slice(2, 10)}`;
    const context = await browser.newContext();
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: site.origin });
    await context.addInitScript(() => {
      (window as unknown as Record<string, string>).__diffbeacon_sentinel__ = 'intact';
    });
    const page = await context.newPage();
    const observation = observePage(page);
    await page.goto(`${site.origin}/`, { waitUntil: 'networkidle' });
    const bootstrap = observation.requests.length;
    // Only interaction-triggered traffic is judged from here on; the page necessarily loaded itself.
    observation.requests.length = 0;
    expect(bootstrap).toBeGreaterThan(0);

    await pasteInto(page, hostileDiff(), undefined);
    await analyzeButton(page).click();
    await page.locator(textarea).fill(`${fixtures.authWithTests}+const key = "${marker}";\n`);
    await analyzeButton(page).click();
    await page.getByRole('button', { name: /Load example/ }).click();
    await copyButton(page).click();
    await page.getByRole('button', { name: /Switch to (dark|light) mode/ }).click();
    await page.getByRole('button', { name: /^Clear$/ }).click();
    await page.waitForTimeout(500);

    expect(observation.requests).toEqual([]);
    expect(observation.requests.filter((entry) => entry.includes(marker))).toEqual([]);
    expect(observation.failed).toEqual([]);
    expect(observation.notFound).toEqual([]);
    expect(observation.pageErrors).toEqual([]);
    expect(
      await page.evaluate(
        () => (window as unknown as Record<string, string>).__diffbeacon_sentinel__,
      ),
    ).toBe('intact');
    await context.close();
  });

  it('leaves no diff, report, or marker in any browser storage', async () => {
    const marker = `db-storage-probe-${Math.random().toString(36).slice(2, 10)}`;
    const { page } = await reportedPage(`${fixtures.authWithTests}+const k = "${marker}";\n`);
    await copyButton(page).click();
    const scan = await page.evaluate(async (probe: string) => {
      const traces: string[] = [];
      for (const [key, value] of Object.entries(localStorage)) traces.push(key + value);
      for (const [key, value] of Object.entries(sessionStorage)) traces.push(key + value);
      traces.push(document.cookie);
      for (const database of await indexedDB.databases()) traces.push(database.name ?? '');
      traces.push(...(await caches.keys()));
      for (const registration of await navigator.serviceWorker.getRegistrations())
        traces.push(registration.scope);
      return {
        entries: traces.filter((trace) => trace !== '').length,
        marked: traces.filter((trace) => trace.includes(probe)).length,
      };
    }, marker);
    expect(scan.entries).toBe(0);
    expect(scan.marked).toBe(0);
    await page.reload({ waitUntil: 'networkidle' });
    expect(await page.locator(textarea).inputValue()).toBe('');
    expect(await page.locator('.result-layout').count()).toBe(0);
    await page.context().close();
  });

  it('describes privacy as a local analysis boundary instead of an impossible network claim', async () => {
    const { page } = await reportedPage(fixtures.runtimeOnly);
    const body = await page.locator('.workspace').innerText();
    expect(body).toMatch(/local/i);
    expect(body).not.toMatch(/zero network|nothing was sent anywhere|no network at all/i);
    await page.context().close();
  });
});

describeBrowser('hostile diff text stays text', () => {
  it('creates no element and runs no script from hostile paths and content', async () => {
    const injected = `${hostileDiff()}\n${fixtures.binary}`;
    const { page, observation } = await reportedPage(injected);
    const result = await page.evaluate(() => ({
      pwned:
        (globalThis as Record<string, unknown>).__DIFFBEACON_PWNED__ === undefined
          ? 'absent'
          : 'SET',
      inlineScripts: document.querySelectorAll('script:not([src])').length,
      modules: [...document.querySelectorAll('script[src]')].map(
        (el) => el.getAttribute('src') ?? '',
      ),
      iframes: document.querySelectorAll('iframe').length,
      images: document.querySelectorAll('img').length,
      embeds: document.querySelectorAll('object,embed,source,link[rel=stylesheet][href*=http]')
        .length,
      hostileSvg: document.querySelectorAll('svg[onload],svg[onerror]').length,
      anchors: [...document.querySelectorAll('a')].map((a) => a.getAttribute('href') ?? ''),
      hostileSrc: [...document.querySelectorAll('[src],[href]')]
        .map((el) => el.getAttribute('src') ?? el.getAttribute('href') ?? '')
        .filter((value) =>
          /onerror|onload|DIFFBEACON_PWNED|diffbeacon\.invalid|javascript:/.test(value),
        ),
      textareaCount: document.querySelectorAll('textarea').length,
    }));
    expect(result.pwned).toBe('absent');
    expect(result.inlineScripts).toBe(0);
    expect(result.modules.every((src) => src.startsWith('/assets/'))).toBe(true);
    expect(result.iframes).toBe(0);
    expect(result.images).toBe(0);
    expect(result.embeds).toBe(0);
    expect(result.hostileSvg).toBe(0);
    expect(result.hostileSrc).toEqual([]);
    expect(result.anchors).toEqual([]);
    expect(result.textareaCount).toBe(1);
    expect(observation.pageErrors).toEqual([]);
    expect(observation.requests).toEqual([]);
    await page.context().close();
  });

  for (const [index, payload] of hostilePayloads.entries()) {
    it(`echoes hostile payload ${index + 1} as literal path text, never as a locator`, async () => {
      const file = `src/${payload}.ts`;
      const diff = `diff --git a/${file} b/${file}
index 1111111..2222222 100644
--- a/${file}
+++ b/${file}
@@ -1,1 +1,1 @@
-old
+// ${payload}
`;
      const core = analyzeDiff(diff);
      expect(core.files.map((entry) => entry.displayPath)).toEqual([file]);
      const { page, observation } = await reportedPage(diff);
      const shown = await page.locator('.file-pile code').allTextContents();
      expect(shown).toContain(file);
      const locators = await page.evaluate(() =>
        [...document.querySelectorAll('[src],[href]')]
          .map((el) => `${el.getAttribute('src') ?? ''}${el.getAttribute('href') ?? ''}`)
          .filter((value) => value !== ''),
      );
      expect(
        locators.filter((value) => /onerror|onload|javascript:|diffbeacon\.invalid/.test(value)),
      ).toEqual([]);
      expect(observation.requests).toEqual([]);
      expect(observation.pageErrors).toEqual([]);
      await page.context().close();
    });
  }

  it('keeps an extremely long path inside its column instead of widening the page', async () => {
    const { page } = await reportedPage(veryLongPathDiff());
    const overflow = await page.evaluate(() => {
      const element = document.documentElement;
      return element.scrollWidth - element.clientWidth;
    });
    expect(overflow).toBe(0);
    const widest = await page.evaluate(() =>
      Math.max(
        0,
        ...[...document.querySelectorAll('.file-pile code')].map(
          (code) => code.getBoundingClientRect().width,
        ),
      ),
    );
    const viewport = page.viewportSize();
    expect(widest).toBeLessThanOrEqual((viewport?.width ?? 1440) / 2);
    await page.context().close();
  });
});

describeBrowser('app source refuses the unsafe rendering APIs', () => {
  const forbidden: [RegExp, string][] = [
    [/dangerouslySetInnerHTML/, 'dangerouslySetInnerHTML'],
    [/\binnerHTML\s*=/, 'innerHTML assignment'],
    [/insertAdjacentHTML/, 'insertAdjacentHTML'],
    [/document\.write/, 'document.write'],
    [/\beval\s*\(/, 'eval'],
    [/new\s+Function\s*\(/, 'new Function'],
    [/document\.execCommand/, 'document.execCommand clipboard fallback'],
    [/clipboard\.readText/, 'clipboard read in production code'],
    [/\bfetch\s*\(/, 'fetch'],
    [/XMLHttpRequest/, 'XMLHttpRequest'],
    [/navigator\.sendBeacon/, 'sendBeacon'],
    [/WebSocket/, 'WebSocket'],
  ];

  it('contains none of the rendering or network APIs that would break the contract', async () => {
    const files = [
      'client/src/pages/Home.tsx',
      'client/src/main.tsx',
      'client/index.html',
      'client/src/index.css',
    ];
    for (const relative of files) {
      const source = await readFile(path.join(repository, relative), 'utf8');
      for (const [pattern, label] of forbidden) {
        expect(pattern.test(source), `${relative} must not use ${label}`).toBe(false);
      }
    }
  });
});
