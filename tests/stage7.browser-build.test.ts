/**
 * Stage 7, PHASES 23-27: the shipped artifact, not the dev server. Each case loads a
 * real production build of this repository in a real browser, at the root path and at
 * the documented sub-path, and audits the files the build produced.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { analyzeDiff, MAX_DIFF_BYTES } from '../packages/core/src/index.js';
import {
  browserEngine,
  browserSkipReason,
  buildWeb,
  claimBrowserSlot,
  fixtures,
  launchBrowser,
  openApplication,
  pasteInto,
  repository,
  serveDirectory,
  statusLine,
  textarea,
  timePressToReport,
  utf8Length,
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

/** Compares paths the way the build wrote them, so separator style cannot hide a leak. */
function toPosix(value: string): string {
  return value.replaceAll('\\', '/');
}

/* ---------------------------------------------------------------------------
 * HARNESS TIMEOUTS — NOT PRODUCT BUDGETS
 *
 * Stage 7 defines no performance requirement, and its own brief says milliseconds
 * may not be claimed as a hard SLA unless product requirements define one. So every
 * duration below is a watchdog whose only job is to fail a run whose page has hung
 * instead of hanging the run, and nothing in this file compares a measurement with
 * a threshold. Each scenario is judged on whether the report appeared, whether it
 * carries the counts the engine produces for the same bytes, and whether the page
 * still answers its controls afterwards. Timings that get recorded are labelled
 * observations, and the report keeps them as non-normative notes about one machine.
 *
 * Measured on this host with the paste route the scenarios use (see
 * ../stage7/closure-paste-measurements.txt; press-to-paint is the page's own clock):
 *   sample 562 B          109 ms paste,  63.7 ms press-to-paint, unthrottled
 *   200 KB                205 ms paste,  54.1 ms press-to-paint, unthrottled
 *   8 MiB near-limit   4 605 ms paste, 135.8 ms press-to-paint, unthrottled
 *   200 KB, renderer 20x 5 439 ms paste, 4 585 ms press-to-paint
 * `heavy` is therefore about 26x the slowest heavy thing this machine has measured,
 * and `report` about 1 000x the unthrottled sample — deliberately slack, because a
 * watchdog has to be reachable only by a hang, not by a busy host.
 * ------------------------------------------------------------------------- */
const harness = {
  /** page-load, paste-settle and paint ceilings for small and 200 KB drafts. */
  report: 60_000,
  /** the same ceilings for the near-limit draft and for a renderer throttled 20x. */
  heavy: 120_000,
  /** vitest's own outer watchdog for a heavy scenario, above its harness ceiling. */
  heavyTest: 180_000,
} as const;

/**
 * A diff with a bounded file count and a lot of content per file. A real large diff is many
 * changed lines rather than thousands of renamed files, and the report renders one row per file,
 * so this stresses the analysis instead of the node count — which is what "a large diff was
 * handled" has to mean before it can be read as evidence.
 */
function largeDiff(bytes: number, files = 12): string {
  const line = '+export const padded = "a long line of added source text for measurement";\n';
  const repeats = Math.max(1, Math.floor(bytes / files / utf8Length(line)));
  let text = '';
  for (let index = 0; index < files; index += 1) {
    text +=
      `diff --git a/src/module-${index}/index.ts b/src/module-${index}/index.ts
index 111111${index}..222222${index} 100644
--- a/src/module-${index}/index.ts
+++ b/src/module-${index}/index.ts
@@ -1,2 +1,3 @@
-export const value = ${index};
+export const value = ${index + 1};
` + line.repeat(repeats);
  }
  return text.slice(0, bytes);
}

/**
 * Loads a draft through the browser's own clipboard and keystroke, the route a real visitor uses,
 * and then proves it landed. `ceilingMs` is the HARNESS TIMEOUT for the paste settling.
 * `fill()` is not used here: measured on this host it took 179 s for 200 KB, which is a cost of the
 * driver typing into a textarea, not of the application, and a scenario gated on it would be
 * measuring Playwright.
 */
async function loadDraft(page: Page, diff: string, ceilingMs: number): Promise<void> {
  await pasteInto(page, diff, diff, ceilingMs);
  const stored = await page.locator(textarea).inputValue();
  expect(
    utf8Length(stored),
    `the built page must hold the ${utf8Length(diff)}-byte draft it was given`,
  ).toBe(utf8Length(diff));
}

/** The three counts the built page shows in its summary bar, as numbers. */
async function shownCounts(
  page: Page,
): Promise<{ files: number; additions: number; deletions: number }> {
  const cells = await page.locator('.summary-stat').allInnerTexts();
  const read = (label: string): number => {
    const cell = cells.find((text) => text.startsWith(label));
    expect(cell, `the built page must show a ${label} count`).toBeDefined();
    return Number((cell ?? '').replace(/\D+/g, ''));
  };
  return { files: read('FILES'), additions: read('ADDITIONS'), deletions: read('DELETIONS') };
}

/** A cheap, comparable identity for what is painted, used by the settle check. */
function paintedReport(page: Page): Promise<string | null> {
  return page.evaluate(() => document.querySelector('.result-layout')?.outerHTML ?? null);
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
    // Recorded, never gated: Stage 7 has no product performance budget to compare it with.
    console.info(
      `OBSERVATION (non-normative, not an SLA): ${browserEngine?.name ?? 'browser'} painted the ` +
        `${fixtures.authWithTests.length}-character report ${paintedIn.toFixed(1)} ms after the press`,
    );
    expect(opened.observation.pageErrors).toEqual([]);
    expect(opened.observation.consoleErrors).toEqual([]);
    await opened.context.close();
  });
});

/**
 * Stage-7 closure, PHASE 1: the browser health check the stage actually requires, in place of the
 * invented 1 000 ms SLA. Every scenario here answers one of seven questions — does a sample
 * analysis complete (the scenario just above), does a reasonably large one, does a near-limit one,
 * does the page stay interactive, does it stop working once it has painted, does it survive without
 * crashing or hanging, and does it still work with its renderer throttled 20x? The over-limit case
 * is refused in stage7.browser-contract.test.ts, which owns the input boundary.
 *
 * None of them compares a duration with a threshold. Where a number is measured it is logged as an
 * observation, and the only timeouts are the labelled HARNESS TIMEOUTs above.
 */
describeBrowser('the built page completes large work and stays usable', () => {
  let site: StaticSite;

  beforeAll(async () => {
    site = await serveDirectory(buildWeb('/'));
  });

  afterAll(async () => {
    await site?.close();
  });

  it('completes a reasonably large analysis with the counts the engine gives', async () => {
    const diff = largeDiff(200 * 1024);
    const core = analyzeDiff(diff);
    expect(core.summary.changedFiles).toBe(12);
    const opened = await openApplication(browser, site, { clipboardPermissions: true });
    const page = opened.page;
    await page.setDefaultTimeout(harness.report);
    await loadDraft(page, diff, harness.report);
    const paintedIn = await timePressToReport(page, 'Analyze diff', harness.report);
    expect(await page.locator('.result-layout').count(), 'the report never painted').toBe(1);
    expect(await shownCounts(page)).toEqual({
      files: core.summary.changedFiles,
      additions: core.summary.additions,
      deletions: core.summary.deletions,
    });
    expect(opened.observation.pageErrors).toEqual([]);
    expect(opened.observation.consoleErrors).toEqual([]);
    console.info(
      `OBSERVATION (non-normative, not an SLA): the ${utf8Length(diff)}-byte report painted ` +
        `${paintedIn.toFixed(1)} ms after the press on this machine`,
    );
    await opened.context.close();
  });

  describe('after a near-limit diff has been analyzed', () => {
    const nearLimit = largeDiff(MAX_DIFF_BYTES - 1024);
    const core = analyzeDiff(nearLimit);
    let opened: Awaited<ReturnType<typeof openApplication>> | undefined;
    let page: Page;
    /** Captured while the report is settled; the scenarios below must not disturb it. */
    let settled: string;
    let settledRequests: number;

    beforeAll(async () => {
      opened = await openApplication(browser, site, { clipboardPermissions: true });
      page = opened.page;
      await page.setDefaultTimeout(harness.heavy);
      expect(core.summary.changedFiles).toBe(12);
      await loadDraft(page, nearLimit, harness.heavy);
      await timePressToReport(page, 'Analyze diff', harness.heavy);
      settled = (await paintedReport(page)) ?? '';
      settledRequests = opened.observation.requests.length;
    }, harness.heavyTest);

    afterAll(async () => {
      await opened?.context.close();
    });

    it('completes: the report is on screen for 8 MiB minus 1 KiB of diff', async () => {
      expect(utf8Length(nearLimit)).toBe(MAX_DIFF_BYTES - 1024);
      expect(await page.locator('.result-layout').count()).toBe(1);
      expect(settled.length, 'a painted report has markup').toBeGreaterThan(100);
    });

    it('agrees with the engine about those exact bytes', async () => {
      expect(await shownCounts(page)).toEqual({
        files: core.summary.changedFiles,
        additions: core.summary.additions,
        deletions: core.summary.deletions,
      });
    });

    it('stops working once the report is painted instead of re-rendering or re-analyzing', async () => {
      // Nothing drives the page in this window: no keystroke, no click, no network. A page that
      // kept analyzing, or that re-painted its own report on a timer, changes one of these.
      await page.waitForTimeout(2_000);
      expect(await paintedReport(page)).toBe(settled);
      expect(opened?.observation.requests.length, 'a settled page asks for nothing more').toBe(
        settledRequests,
      );
      expect(await page.locator('.result-layout').count()).toBe(1);
    });

    it('renders a different report for different bytes, which is what makes the check above real', async () => {
      // An instrument that cannot move proves nothing, so the settle check is validated against a
      // page that is definitely still able to repaint: clear, load another diff, analyze again.
      await page.getByRole('button', { name: /^Clear$/ }).click();
      await loadDraft(page, fixtures.runtimeOnly, harness.report);
      await timePressToReport(page, 'Analyze diff', harness.report);
      const sample = analyzeDiff(fixtures.runtimeOnly);
      expect(await paintedReport(page)).not.toBe(settled);
      expect(await shownCounts(page)).toEqual({
        files: sample.summary.changedFiles,
        additions: sample.summary.additions,
        deletions: sample.summary.deletions,
      });
    });

    it('stays interactive: its own Clear control still closes the report at the end of all of it', async () => {
      await page.getByRole('button', { name: /^Clear$/ }).click();
      expect(await page.locator(textarea).inputValue()).toBe('');
      expect(await page.locator('.result-layout').count()).toBe(0);
      expect(await page.locator('.empty-map').isVisible()).toBe(true);
      expect(await page.locator(statusLine).innerText()).toMatch(/cleared/i);
      expect(opened?.observation.pageErrors).toEqual([]);
      expect(opened?.observation.consoleErrors).toEqual([]);
    });
  });

  it(
    'completes, matches the engine and stays usable with the renderer throttled 20x',
    async () => {
      const diff = largeDiff(200 * 1024);
      const core = analyzeDiff(diff);
      const opened = await openApplication(browser, site, { clipboardPermissions: true });
      const page = opened.page;
      await page.setDefaultTimeout(harness.heavy);
      const client = await opened.context.newCDPSession(page);
      await client.send('Emulation.setCPUThrottlingRate', { rate: 20 });
      await loadDraft(page, diff, harness.heavy);
      const paintedIn = await timePressToReport(page, 'Analyze diff', harness.heavy);
      expect(await page.locator('.result-layout').count(), 'the report never painted').toBe(1);
      expect(await shownCounts(page)).toEqual({
        files: core.summary.changedFiles,
        additions: core.summary.additions,
        deletions: core.summary.deletions,
      });
      // Throttling is a way to prove the page still finishes and still answers, and nothing more:
      // this number is not compared with a threshold, because Stage 7 has no budget to compare it to.
      console.info(
        `OBSERVATION (non-normative, not an SLA): at 20x renderer throttling the report painted ` +
          `${paintedIn.toFixed(1)} ms after the press on this machine`,
      );
      await page.getByRole('button', { name: /^Clear$/ }).click();
      expect(await page.locator(textarea).inputValue()).toBe('');
      expect(await page.locator('.result-layout').count()).toBe(0);
      expect(opened.observation.pageErrors).toEqual([]);
      expect(opened.observation.consoleErrors).toEqual([]);
      await opened.context.close();
    },
    harness.heavyTest,
  );
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
    // Vite writes POSIX separators into the artifact even on Windows, where USERPROFILE uses
    // backslashes, so a literal compare would let the same leak pass here and fail on Linux.
    const needles = [home, repository].filter((needle) => needle !== '').map(toPosix);
    for (const file of files) {
      const content = toPosix(readFileSync(file, 'utf8'));
      for (const needle of needles) {
        expect(content.includes(needle), `${path.basename(file)}: ${needle}`).toBe(false);
      }
      expect(/AKIA[0-9A-Z]{16}/.test(content), path.basename(file)).toBe(false);
      expect(/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(content), path.basename(file)).toBe(false);
    }
  });

  it('ships a production build whose sourcemaps point inside the project', async () => {
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      if (file.endsWith('.js')) {
        for (const marker of ['jsxDEV', 'jsx-dev-runtime', 'react.development.js']) {
          expect(content.includes(marker), `${path.basename(file)}: ${marker}`).toBe(false);
        }
      }
      if (file.endsWith('.map')) {
        const map = JSON.parse(content) as { sources?: unknown };
        expect(Array.isArray(map.sources), path.basename(file)).toBe(true);
        for (const source of map.sources as string[]) {
          expect(path.posix.isAbsolute(source), `${path.basename(file)}: ${source}`).toBe(false);
          expect(/^[A-Za-z]:\//.test(source), `${path.basename(file)}: ${source}`).toBe(false);
          expect(source.startsWith('../'), `${path.basename(file)}: ${source}`).toBe(false);
        }
      }
    }
  });

  it('stays a bounded download for a first visit', async () => {
    const bytes = files
      .filter((file) => !file.endsWith('.map'))
      .reduce((total, file) => total + statSync(file).size, 0);
    expect(bytes).toBeLessThan(3 * 1024 * 1024);
  });
});
