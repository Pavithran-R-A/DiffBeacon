/**
 * Stage 8, PHASES 23 and 24: the shared hostile corpus driven through the real browser build. Stage 7
 * proved the browser's own security behaviours one payload at a time; this suite asks the
 * cross-surface question instead — does the single corpus that the parser, terminal, Markdown
 * and JSON tests use survive a real Chromium render without becoming markup, without reordering
 * the page's own text, without touching the wire, and without losing its raw value in the
 * clipboard export? Where no engine is found the suite skips with a recorded reason.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  browserEngine,
  browserSkipReason,
  buildWeb,
  claimBrowserSlot,
  launchBrowser,
  openApplication,
  serveDirectory,
  statusLine,
  textarea,
  type StaticSite,
} from './stage7.browser-harness.js';
import {
  BIDI_CONTROL_PATHS,
  CONTROL_CHAR_PATHS,
  diffForPath,
  diffForPaths,
  HOSTILE_PATHS,
} from './stage8.hostile-corpus.js';
import { analyzeDiff, neutralizeDisplayControls } from '../packages/core/src/index.js';
import type { Browser, Page } from 'playwright-core';

vi.setConfig({ testTimeout: 120_000, hookTimeout: 900_000 });

const describeBrowser = browserEngine ? describe : describe.skip;
if (!browserEngine) console.warn(`stage8.browser-corpus: ${browserSkipReason}`);

let browser: Browser;
let site: StaticSite;
let releaseSlot: (() => void) | undefined;

const corpus = diffForPaths(HOSTILE_PATHS);

/** C0 and C1 controls (tab, newline and carriage return included) must not reach the paint. */
const EXECUTABLE_LOOKING = /\p{Cc}/u;
/** Explicit bidi formatting controls: the class the paint helper removes. */
const REORDERING = /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u;

const markupCapableSelectors =
  'script, iframe, object, embed, link[rel=import], [onerror], [onclick]';

async function reportedPage(
  diff: string,
  clipboard = false,
): Promise<{ page: Page; requests: string[]; errors: string[]; dialogs: string[] }> {
  const opened = await openApplication(browser, site, { clipboardPermissions: clipboard });
  await opened.page.locator(textarea).fill(diff);
  await opened.page.getByRole('button', { name: 'Analyze diff' }).click();
  await opened.page.waitForSelector('.result-layout');
  opened.observation.requests.length = 0;
  opened.observation.notFound.length = 0;
  opened.observation.failed.length = 0;
  const { observation } = opened;
  return {
    page: opened.page,
    requests: observation.requests,
    errors: [...observation.consoleErrors, ...observation.pageErrors],
    dialogs: observation.dialogs,
  };
}

/** Every `<code>` the report paints, in document order. */
async function paintedCodes(page: Page): Promise<string[]> {
  return page.$$eval('code', (nodes) => nodes.map((node) => node.textContent ?? ''));
}

/**
 * A report shows at most three names per attention row (Home.tsx slices the pile), and the row
 * orders them by path, so four filler names pushed every control-bearing name that sorts after
 * `src/b1.ts` off screen — the case passed without looking at anything dangerous. With two
 * fillers the whole pile fits, so the hostile name is painted whichever way it ranks.
 */
function pileDiff(hostile: string): string {
  return diffForPaths([hostile, 'src/b1.ts', 'src/b2.ts']);
}

const PAINT_SENSITIVE = [...CONTROL_CHAR_PATHS, ...BIDI_CONTROL_PATHS];

/** The zero-width formatters: kept verbatim because they carry meaning in Persian, Arabic,
 * and Indic names, and they cannot move a cursor, execute in a terminal, or reorder a line. */
const ZERO_WIDTH_FORMATTERS = /[\u200b-\u200d]/;

describeBrowser('each control-bearing corpus name in a real Chromium', () => {
  for (const [index, entry] of PAINT_SENSITIVE.entries()) {
    it(`paints name ${index + 1} exactly as the display policy decides`, async () => {
      const { page } = await reportedPage(pileDiff(entry));
      const codes = await paintedCodes(page);
      const painted = neutralizeDisplayControls(entry, '\uFFFD');
      // The name is on screen, and what is on screen is the helper's own output for it.
      expect(codes, JSON.stringify(codes)).toContain(painted);
      if (painted === entry) {
        // Nothing to strip: record *why* this one survives, so the case cannot silently
        // become a no-op if the policy ever grows a fourth class.
        expect(entry, `a display control was painted verbatim: ${JSON.stringify(entry)}`).toMatch(
          ZERO_WIDTH_FORMATTERS,
        );
        expect(entry).not.toMatch(EXECUTABLE_LOOKING);
        expect(entry).not.toMatch(REORDERING);
      } else {
        expect(codes, `the raw control characters reached the paint`).not.toContain(entry);
      }
      await page.context().close();
    });
  }
});

beforeAll(async () => {
  releaseSlot = await claimBrowserSlot('stage8-corpus');
  browser = await launchBrowser();
  site = await serveDirectory(buildWeb('/'));
});

afterAll(async () => {
  await browser?.close();
  await site?.close();
  releaseSlot?.();
});

describeBrowser('the hostile corpus in a real Chromium', () => {
  it('paints no control character and no bidi formatting control in any code element', async () => {
    const blank = await openApplication(browser, site);
    const baseline = new Set(await paintedCodes(blank.page));
    await blank.context.close();

    const { page } = await reportedPage(corpus);
    const codes = await paintedCodes(page);
    expect(codes.length).toBeGreaterThan(baseline.size);
    const expected = new Set(
      HOSTILE_PATHS.map((name) => neutralizeDisplayControls(name, '\uFFFD')),
    );
    for (const painted of codes) {
      expect(
        painted,
        `control character reached the paint: ${JSON.stringify(painted)}`,
      ).not.toMatch(EXECUTABLE_LOOKING);
      expect(painted, `bidi control reached the paint: ${JSON.stringify(painted)}`).not.toMatch(
        REORDERING,
      );
      // Whatever is painted is either the page's own text or the shared display helper's output
      // for a corpus name — never a mixture of the two.
      const fromCorpus = [...expected].some((name) => painted.includes(name));
      expect(fromCorpus || baseline.has(painted), JSON.stringify(painted)).toBe(true);
    }
    await page.context().close();
  });

  it('creates no scriptable element and no new attribute from the corpus', async () => {
    const blank = await openApplication(browser, site);
    const baseline = await blank.page.locator(markupCapableSelectors).count();
    await blank.context.close();

    const { page } = await reportedPage(corpus);
    expect(await page.locator(markupCapableSelectors).count()).toBe(baseline);
    expect(await page.locator('img').count()).toBe(0);
    expect(
      await page
        .locator('a[href]')
        .evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).href)),
    ).toEqual([]);
    await page.context().close();
  });

  it('analyzes the whole corpus without asking for anything off the page origin', async () => {
    const { page, requests } = await reportedPage(corpus);
    expect(requests).toEqual([]);
    await page.context().close();
  });

  it('analyzes the whole corpus without a console error, page error, or dialog', async () => {
    const { page, errors, dialogs } = await reportedPage(corpus);
    expect(errors).toEqual([]);
    expect(dialogs).toEqual([]);
    await page.context().close();
  });

  it('renders repeated blocks for the same path without duplicate-key console errors', async () => {
    const duplicate = `${diffForPath('src/app.ts')}${diffForPath('src/app.ts')}`;
    const { page, errors } = await reportedPage(duplicate);
    expect(analyzeDiff(duplicate).files.map((file) => file.displayPath)).toEqual([
      'src/app.ts',
      'src/app.ts',
    ]);
    expect(errors).toEqual([]);
    expect(
      (await paintedCodes(page)).filter((value) => value === 'src/app.ts').length,
    ).toBeGreaterThan(1);
    await page.context().close();
  });

  it('exports the corpus report byte-for-byte as the same analysis the CLI would print', async () => {
    const { page } = await reportedPage(corpus, true);
    await page.getByRole('button', { name: 'Copy current JSON report' }).click();
    await expect.poll(() => page.locator(statusLine).innerText()).toMatch(/copied/i);
    const written = await page.evaluate(() => navigator.clipboard.readText());
    // The data stays factual: neutralisation happens where text is painted, never in the report,
    // so a lone surrogate survives to the clipboard as the replacement mark UTF-8 forces.
    expect(JSON.parse(written)).toEqual(analyzeDiff(corpus));
    expect(written).toContain('\\u001b');
    await page.context().close();
  });
});

/**
 * PHASE 24: the display repair must not need a layout repair. A long name carrying a reordering
 * control is the worst case for the report's geometry — it is the widest text the corpus can
 * produce and the one a browser is most tempted to push outside its column.
 */
const LONG_REORDERED = `src/${'a'.repeat(400)}\u202e${'b'.repeat(400)}.ts`;

describeBrowser('hostile display text stays inside the CSS that already contains it', () => {
  it('keeps an 800-character reordered name inside its own pile and the page unwidened', async () => {
    const { page } = await reportedPage(diffForPaths([LONG_REORDERED, 'src/b1.ts', 'src/b2.ts']));
    const geometry = await page.evaluate(() => {
      const root = document.documentElement;
      const piles = [...document.querySelectorAll('.file-pile, .ledger-item__paths')];
      const escapees = piles.filter((pile) => {
        const box = pile.getBoundingClientRect();
        return [...pile.querySelectorAll('code')].some((code) => {
          const child = code.getBoundingClientRect();
          return child.right - box.right > 1 || box.left - child.left > 1;
        });
      }).length;
      return {
        pageOverflow: root.scrollWidth - root.clientWidth,
        piles: piles.length,
        painted: [...document.querySelectorAll('code')].some((code) =>
          (code.textContent ?? '').includes('aaaa'),
        ),
        escapees,
      };
    });
    // The name really is on screen, so the geometry below describes it rather than an empty page.
    expect(geometry.painted).toBe(true);
    expect(geometry.piles).toBeGreaterThan(0);
    expect(geometry.escapees, 'a code element left its pile box').toBe(0);
    expect(geometry.pageOverflow, 'the report widened the page').toBe(0);
    await page.context().close();
  });
});
