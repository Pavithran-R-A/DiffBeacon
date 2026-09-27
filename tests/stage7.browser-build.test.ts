/**
 * Stage 7, PHASES 23-27: the shipped artifact, not the dev server. Each case loads a
 * real production build of this repository in a real browser, at the root path and at
 * the documented sub-path, and audits the files the build produced.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { analyzeDiff } from '../packages/core/src/index.js';
import {
  browserEngine,
  browserSkipReason,
  buildWeb,
  claimBrowserSlot,
  fixtures,
  launchBrowser,
  openApplication,
  repository,
  serveDirectory,
  textarea,
  timePressToReport,
  type StaticSite,
} from './stage7.browser-harness.js';
import type { Browser } from 'playwright-core';

/**
 * Claiming the browser slot can mean queueing behind three other real-Chromium files, so the hook
 * budget is a scheduling allowance for that queue. It is deliberately not a per-case budget: a
 * Stage 7 case that runs slow still has to fail inside its own, much smaller, test timeout.
 */
vi.setConfig({ testTimeout: 60_000, hookTimeout: 900_000 });

const describeBrowser = browserEngine ? describe : describe.skip;
if (!browserEngine) console.warn(`stage7.browser-build: ${browserSkipReason}`);

let browser: Browser;
let releaseSlot: (() => void) | undefined;

function filesIn(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory)) {
    const file = path.join(directory, entry);
    if (statSync(file).isDirectory()) found.push(...filesIn(file));
    else found.push(file);
  }
  return found;
}

beforeAll(async () => {
  releaseSlot = await claimBrowserSlot('build');
  browser = await launchBrowser();
});

afterAll(async () => {
  await browser?.close();
  releaseSlot?.();
});

describeBrowser('the production build runs at the root path', () => {
  let site: StaticSite;

  beforeAll(async () => {
    site = await serveDirectory(buildWeb('/'));
  });

  afterAll(async () => {
    await site?.close();
  });

  it('loads with no console error, no failed request, and no missing file', async () => {
    const opened = await openApplication(browser, site);
    expect(opened.observation.consoleErrors).toEqual([]);
    expect(opened.observation.pageErrors).toEqual([]);
    expect(opened.observation.notFound).toEqual([]);
    expect(opened.observation.failed).toEqual([]);
    await opened.context.close();
  });

  it('only ever asks its own origin for files', async () => {
    const opened = await openApplication(browser, site, { clipboardPermissions: true });
    const origins = new Set(
      opened.observation.requests.map((entry) => new URL(entry.split(' ')[1] ?? '').origin),
    );
    expect([...origins]).toEqual([site.origin]);
    await opened.context.close();
  });

  it('loads its own favicon over the network, with no remote icon behind it', async () => {
    const opened = await openApplication(browser, site);
    const href = await opened.page.locator('link[rel="icon"]').first().getAttribute('href');
    expect(href, 'the built document must declare an icon').not.toBeNull();
    const iconUrl = new URL(href ?? '/', site.origin);
    expect(iconUrl.origin, iconUrl.origin).toBe(site.origin);
    expect(iconUrl.pathname.startsWith('/assets/'), iconUrl.pathname).toBe(true);
    const response = await opened.page.request.get(iconUrl.toString());
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('image/');
    await opened.context.close();
  });

  it('analyzes in the built page exactly like the engine', async () => {
    const opened = await openApplication(browser, site, { clipboardPermissions: true });
    const page = opened.page;
    await page.locator(textarea).fill(fixtures.authWithTests);
    const paintedIn = await timePressToReport(page, 'Analyze diff');
    await page.getByRole('button', { name: 'Copy current JSON report' }).click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(JSON.parse(copied)).toEqual(analyzeDiff(fixtures.authWithTests));
    expect(paintedIn, `the report painted ${paintedIn}ms after the press`).toBeLessThan(1_000);
    await opened.context.close();
  });

  it('refuses to call a slow report prompt', async () => {
    const opened = await openApplication(browser, site);
    await opened.page.locator(textarea).fill(fixtures.authWithTests);
    const client = await opened.context.newCDPSession(opened.page);
    await client.send('Emulation.setCPUThrottlingRate', { rate: 20 });
    const paintedIn = await timePressToReport(opened.page, 'Analyze diff');
    expect(paintedIn, `${paintedIn}ms on a 20x throttled renderer must not pass`).toBeGreaterThan(
      1_000,
    );
    await opened.context.close();
  });
});

describeBrowser('the same build runs under a documented sub-path', () => {
  let site: StaticSite;

  beforeAll(async () => {
    site = await serveDirectory(buildWeb('/DiffBeacon/'), '/DiffBeacon');
  });

  afterAll(async () => {
    await site?.close();
  });

  it('serves the app at /DiffBeacon/ with no missing asset', async () => {
    const opened = await openApplication(browser, site, { prefix: '/DiffBeacon' });
    expect(opened.page.url()).toContain('/DiffBeacon/');
    expect(opened.observation.notFound).toEqual([]);
    expect(opened.observation.failed).toEqual([]);
    expect(opened.observation.consoleErrors).toEqual([]);
    expect(await opened.page.locator(textarea).isVisible()).toBe(true);
    await opened.context.close();
  });

  it('loads its favicon from the sub-path, not from the server root', async () => {
    const opened = await openApplication(browser, site, { prefix: '/DiffBeacon' });
    const href = await opened.page.locator('link[rel="icon"]').first().getAttribute('href');
    expect(href?.startsWith('/DiffBeacon/'), href ?? 'none').toBe(true);
    const response = await opened.page.request.get(`${site.origin}${href ?? ''}`);
    expect(response.status()).toBe(200);
    expect(opened.observation.notFound).toEqual([]);
    await opened.context.close();
  });

  it('produces the same report under the sub-path as the engine', async () => {
    const opened = await openApplication(browser, site, {
      prefix: '/DiffBeacon',
      clipboardPermissions: true,
    });
    const page = opened.page;
    await page.locator(textarea).fill(fixtures.database);
    await page.getByRole('button', { name: 'Analyze diff' }).click();
    await page.waitForSelector('.result-layout');
    await page.getByRole('button', { name: 'Copy current JSON report' }).click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(JSON.parse(copied)).toEqual(analyzeDiff(fixtures.database));
    await opened.context.close();
  });

  it('references only its own sub-path for every built asset', async () => {
    const directory = buildWeb('/DiffBeacon/');
    const html = readFileSync(path.join(directory, 'index.html'), 'utf8');
    const references = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1] ?? '');
    expect(references.length).toBeGreaterThan(0);
    for (const reference of references) {
      expect(reference.startsWith('/DiffBeacon/')).toBe(true);
    }
  });
});

describeBrowser('the built artifact contains nothing it should not', () => {
  const directory = buildWeb('/');
  const files = filesIn(directory).filter((file) => !file.endsWith('READY'));

  it('ships script, style, html, sourcemaps, and the local favicon only', async () => {
    const extensions = [...new Set(files.map((file) => path.extname(file)))].sort();
    expect(extensions).toEqual(['.css', '.html', '.js', '.map', '.svg']);
    expect(files.some((file) => file.endsWith('.gitkeep'))).toBe(false);
  });

  it('loads nothing external from its own document', async () => {
    const html = readFileSync(path.join(directory, 'index.html'), 'utf8');
    const references = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1] ?? '');
    expect(references.length).toBeGreaterThan(0);
    for (const reference of references) {
      expect(reference, reference).not.toMatch(/^https?:\/\//);
      expect(reference, reference).not.toMatch(/^\/\//);
      expect(reference.startsWith('/'), reference).toBe(true);
    }
  });

  it('leaks no local machine path and no credential-shaped string', async () => {
    const home = process.env.USERPROFILE ?? process.env.HOME ?? '';
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      if (home !== '') expect(content.includes(home), path.basename(file)).toBe(false);
      expect(content.includes(repository), path.basename(file)).toBe(false);
      expect(/AKIA[0-9A-Z]{16}/.test(content), path.basename(file)).toBe(false);
      expect(/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(content), path.basename(file)).toBe(false);
    }
  });

  it('stays a bounded download for a first visit', async () => {
    const bytes = files
      .filter((file) => !file.endsWith('.map'))
      .reduce((total, file) => total + statSync(file).size, 0);
    expect(bytes).toBeLessThan(3 * 1024 * 1024);
  });
});
