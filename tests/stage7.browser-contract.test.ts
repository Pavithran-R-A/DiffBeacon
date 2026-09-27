/**
 * Stage 7, PHASES 5-8 and 10-14: the browser must behave like the engine it shows.
 * Every case runs a real Chromium against a real production build, so a pass is
 * evidence about the shipped page rather than about a component in a simulated DOM.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { analyzeDiff, MAX_DIFF_BYTES } from '../packages/core/src/index.js';
import type { ReviewAttentionMap } from '../packages/core/src/model.js';
import {
  browserEngine,
  browserSkipReason,
  buildWeb,
  claimBrowserSlot,
  fixtures,
  hostileDiff,
  launchBrowser,
  openApplication,
  pasteInto,
  serveDirectory,
  statusLine,
  textarea,
  utf8Length,
  type StaticSite,
} from './stage7.browser-harness.js';
import type { Browser, Page } from 'playwright-core';

/**
 * Claiming the browser slot can mean queueing behind three other real-Chromium files, so the hook
 * budget is a scheduling allowance for that queue. It is deliberately not a per-case budget: a
 * Stage 7 case that runs slow still has to fail inside its own, much smaller, test timeout.
 */
vi.setConfig({ testTimeout: 120_000, hookTimeout: 900_000 });

const describeBrowser = browserEngine ? describe : describe.skip;
if (!browserEngine) console.warn(`stage7.browser-contract: ${browserSkipReason}`);

let browser: Browser;
let site: StaticSite;
let page: Page;
let releaseSlot: (() => void) | undefined;

const copyButton = (target: Page) =>
  target.getByRole('button', { name: 'Copy current JSON report' });

async function expectCount(target: Page, selector: string, expected: number): Promise<void> {
  await expect.poll(() => target.locator(selector).count(), { timeout: 20_000 }).toBe(expected);
}

async function expectVisible(target: Page, selector: string, expected = true): Promise<void> {
  await expect
    .poll(() => target.locator(selector).first().isVisible(), { timeout: 20_000 })
    .toBe(expected);
}

async function documentOverflow(target: Page): Promise<number> {
  return target.evaluate(() => {
    const element = document.documentElement;
    return element.scrollWidth - element.clientWidth;
  });
}

const byteLabel = (target: Page) => target.locator('.textarea-wrap__rail span').first();

const reportBytes = async (target: Page): Promise<string> => {
  await copyButton(target).click();
  return target.evaluate(() => navigator.clipboard.readText());
};

async function clickAndCopy(target: Page): Promise<ReviewAttentionMap> {
  return JSON.parse(await reportBytes(target)) as ReviewAttentionMap;
}

const analyze = async (target: Page): Promise<void> => {
  await target.getByRole('button', { name: 'Analyze diff' }).click();
};

const loadExample = async (target: Page): Promise<void> => {
  await target.getByRole('button', { name: /Load example/ }).click();
};

const draft = async (target: Page, diff: string): Promise<void> => {
  await target.locator(textarea).fill(diff);
};

/** Puts the caret after the last character without clicking into the middle of the draft. */
const caretAtEnd = async (target: Page): Promise<void> => {
  await target.locator(textarea).evaluate((element) => {
    const box = element as HTMLTextAreaElement;
    box.setSelectionRange(box.value.length, box.value.length);
  });
};

const clearDraft = async (target: Page): Promise<void> => {
  await target.getByRole('button', { name: /^Clear$/ }).click();
};

beforeAll(async () => {
  releaseSlot = await claimBrowserSlot('contract');
  browser = await launchBrowser();
  site = await serveDirectory(buildWeb('/'));
  page = (await openApplication(browser, site, { clipboardPermissions: true })).page;
});

afterAll(async () => {
  await browser?.close();
  await site?.close();
  releaseSlot?.();
});

describeBrowser('input instrument', () => {
  it('renders the local input and the empty map before any diff is given', async () => {
    await expectVisible(page, textarea);
    await expectVisible(page, '.empty-map');
    await expectCount(page, '.result-layout', 0);
  });

  it('reports an empty analysis without inventing a report', async () => {
    await analyze(page);
    expect(await page.locator(statusLine).innerText()).toMatch(/paste|diff/i);
    await expectCount(page, '.result-layout', 0);
  });

  it('loads the synthetic example into the textarea and maps it', async () => {
    await loadExample(page);
    expect(utf8Length(await page.locator(textarea).inputValue())).toBeGreaterThan(500);
    await expectVisible(page, '.attention-row');
    expect(await page.locator(statusLine).innerText()).toMatch(/browser|local/i);
  });

  it('produces the identical report when the example is loaded twice', async () => {
    const first = await clickAndCopy(page);
    await loadExample(page);
    const second = await clickAndCopy(page);
    expect(second).toEqual(first);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it('describes local analysis without claiming the page never used the network', async () => {
    const body = await page.locator('.workspace').innerText();
    expect(body).not.toMatch(/zero network/i);
    expect(body).not.toMatch(/nothing was sent anywhere/i);
    // A page fetched over HTTPS does something over a network, so a chip must scope itself to the
    // analysis rather than assert that the whole product is local-only.
    expect(body).not.toMatch(/local only|local by default/i);
  });

  it('keeps the copy control disabled until a report exists', async () => {
    await clearDraft(page);
    expect(await copyButton(page).isDisabled()).toBe(true);
    await draft(page, fixtures.runtimeOnly);
    await analyze(page);
    expect(await copyButton(page).isDisabled()).toBe(false);
  });

  it('clears input, report, and byte count', async () => {
    await clearDraft(page);
    expect(await page.locator(textarea).inputValue()).toBe('');
    expect(await byteLabel(page).innerText()).toMatch(/^0+\s*B$/);
    await expectCount(page, '.result-layout', 0);
    await expectVisible(page, '.empty-map');
    expect(await page.locator(statusLine).innerText()).toMatch(/cleared/i);
  });

  it('stores pasted text exactly and counts it in UTF-8 bytes', async () => {
    await pasteInto(page, fixtures.unicode, fixtures.unicode);
    expect(await page.locator(textarea).inputValue()).toBe(fixtures.unicode);
    expect(await byteLabel(page).innerText()).toContain(String(utf8Length(fixtures.unicode)));
  });

  it('invalidates a report as soon as the draft changes', async () => {
    await analyze(page);
    await expectCount(page, '.result-layout', 1);
    await page.locator(textarea).press('End');
    await page.keyboard.type('// local edit');
    await expectCount(page, '.result-layout', 0);
    expect(await page.locator(statusLine).innerText()).toMatch(/analyze when ready/i);
  });

  it('treats Ctrl+Enter as the Analyze button and navigates nowhere', async () => {
    await draft(page, fixtures.authWithTests);
    await page.locator(textarea).press('Control+Enter');
    await expectCount(page, '.result-layout', 1);
    const byShortcut = await clickAndCopy(page);
    await draft(page, fixtures.authWithTests);
    await analyze(page);
    expect(page.url()).toContain(site.origin);
    expect(byShortcut).toEqual(await clickAndCopy(page));
  });
});

describeBrowser('core/browser parity', () => {
  const cases: [string, string][] = [
    ['runtime file', fixtures.runtimeOnly],
    ['auth with tests', fixtures.authWithTests],
    ['database migration', fixtures.database],
    ['dependency manifest', fixtures.dependency],
    ['binary file', fixtures.binary],
    ['mode-only change', fixtures.modeOnly],
    ['rename', fixtures.rename],
    ['unicode path', fixtures.unicode],
    ['malformed hunk', fixtures.malformed],
  ];

  for (const [name, diff] of cases) {
    it(`shows exactly the engine's ${name} report`, async () => {
      const core = analyzeDiff(diff);
      await draft(page, diff);
      await analyze(page);
      const shown = await clickAndCopy(page);
      expect(shown).toEqual(core);
      expect(shown.summary.changedFiles).toBe(core.summary.changedFiles);
      expect(shown.attention.map((item) => item.surface)).toEqual(
        core.attention.map((item) => item.surface),
      );
      expect(shown.reviewOrder.map((item) => item.position)).toEqual(
        core.reviewOrder.map((item) => item.position),
      );
    });
  }

  it('maps the synthetic example to the same bytes the textarea holds', async () => {
    await loadExample(page);
    const value = await page.locator(textarea).inputValue();
    expect(await clickAndCopy(page)).toEqual(analyzeDiff(value));
  });
});

describeBrowser('review order explanation', () => {
  beforeAll(async () => {
    await loadExample(page);
  });

  it('lists every review-order entry instead of truncating the sequence', async () => {
    const core = analyzeDiff(await page.locator(textarea).inputValue());
    await expectCount(page, '.order-list > li', core.reviewOrder.length);
    expect(await page.locator('.order-strip').innerText()).not.toMatch(/\+\d/);
  });

  it('pairs each position and title with the engine reason, in engine order', async () => {
    const core = analyzeDiff(await page.locator(textarea).inputValue());
    const shown = await page.evaluate(() =>
      [...document.querySelectorAll('.order-list > li')].map((item) => ({
        position: item.querySelector('.order-list__position')?.textContent?.trim() ?? '',
        title: item.querySelector('.order-list__title')?.textContent?.trim() ?? '',
        reason: item.querySelector('.order-list__reason')?.textContent?.trim() ?? '',
      })),
    );
    expect(shown.map((item) => item.title)).toEqual(core.reviewOrder.map((item) => item.title));
    expect(shown.map((item) => item.position)).toEqual(
      core.reviewOrder.map((item) => String(item.position)),
    );
    expect(shown.map((item) => item.reason)).toEqual(core.reviewOrder.map((item) => item.reason));
  });

  it('keeps the whole sequence readable at a phone viewport', async () => {
    await page.setViewportSize({ width: 375, height: 812 });
    const core = analyzeDiff(await page.locator(textarea).inputValue());
    const entries = page.locator('.order-list > li');
    await expectCount(page, '.order-list > li', core.reviewOrder.length);
    for (let index = 0; index < core.reviewOrder.length; index += 1) {
      expect(await entries.nth(index).isVisible()).toBe(true);
    }
    expect(await documentOverflow(page)).toBe(0);
    await page.setViewportSize({ width: 1440, height: 900 });
  });
});

describeBrowser('attention copy', () => {
  it('uses review-navigation language rather than risk language', async () => {
    await loadExample(page);
    const body = await page.locator('.workspace').innerText();
    expect(body).not.toMatch(/structurally sensitive/i);
    expect(body).not.toMatch(/dangerous|severe|severity|risk|vulnerab|confidence|priority score/i);
    expect(body).toMatch(/review/i);
  });

  it('declines to state a merge verdict', async () => {
    expect(await page.locator('.bottom-note').innerText()).toMatch(
      /does not determine whether a pull request is safe to merge/i,
    );
  });

  it('counts files with the grammar the count calls for', async () => {
    await loadExample(page);
    const core = analyzeDiff(await page.locator(textarea).inputValue());
    const counts = await page.locator('.attention-row__count').allInnerTexts();
    expect(counts).toHaveLength(core.attention.length);
    core.attention.forEach((item, index) => {
      expect(counts[index]).toBe(
        `${new Intl.NumberFormat('en-US').format(item.fileCount)} ${
          item.fileCount === 1 ? 'file' : 'files'
        }`,
      );
    });
    expect(counts.some((count) => /^1 files$/.test(count.trim()))).toBe(false);
  });

  it('reports the parser diagnostic count it actually has, and no more', async () => {
    const core = analyzeDiff(fixtures.malformed);
    expect(core.summary.diagnostics).toBeGreaterThan(0);
    await draft(page, fixtures.malformed);
    await analyze(page);
    const body = await page.locator('.summary-bar').innerText();
    expect(body).toContain(String(core.summary.diagnostics));
    expect(body.toLowerCase()).toMatch(/parser diagnostic/);
    expect(body).not.toMatch(/malformed line|truncated hunk at line|ambiguous path/i);
  });

  it('says nothing about diagnostics when the parser recorded none', async () => {
    expect(analyzeDiff(fixtures.runtimeOnly).summary.diagnostics).toBe(0);
    await draft(page, fixtures.runtimeOnly);
    await analyze(page);
    expect(await page.locator('.summary-bar').innerText()).not.toMatch(/diagnostic/i);
  });

  it('uses singular grammar for one diagnostic and plural for several', async () => {
    const several = `${fixtures.malformed}\n${fixtures.malformed.replace(
      'src/broken.ts',
      'src/broken-2.ts',
    )}`;
    const expected: [string, RegExp][] = [
      [fixtures.malformed, /1 parser diagnostic was recorded/i],
      [several, /parser diagnostics were recorded/i],
    ];
    for (const [diff, pattern] of expected) {
      expect(analyzeDiff(diff).summary.diagnostics).toBeGreaterThan(0);
      await draft(page, diff);
      await analyze(page);
      expect(await page.locator('.summary-bar').innerText()).toMatch(pattern);
    }
  });
});

describeBrowser('input boundary', () => {
  it('shares the engine byte limit', async () => {
    expect(MAX_DIFF_BYTES).toBe(8 * 1024 * 1024);
  });

  it('refuses an over-limit paste before it reaches the draft', async () => {
    const valid = fixtures.runtimeOnly;
    await draft(page, valid);
    await analyze(page);
    const over = 'x'.repeat(MAX_DIFF_BYTES - utf8Length(valid) + 1);
    await pasteInto(page, over, valid, 45_000);
    expect(utf8Length(await page.locator(textarea).inputValue())).toBe(utf8Length(valid));
    expect(await byteLabel(page).innerText()).toContain(String(utf8Length(valid)));
    expect(await page.locator(statusLine).innerText()).toMatch(/limit|too large|not added/i);
    await expectCount(page, '.result-layout', 1);
  });

  it('accepts input at exactly the limit and rejects one byte more', async () => {
    const header = `diff --git a/src/x.ts b/src/x.ts
index 1111111..2222222 100644
--- a/src/x.ts
+++ b/src/x.ts
@@ -1,1 +1,1 @@
-old
+new
`;
    const atLimit = header + 'a'.repeat(MAX_DIFF_BYTES - utf8Length(header));
    await draft(page, '');
    await pasteInto(page, atLimit, atLimit, 45_000);
    expect(utf8Length(await page.locator(textarea).inputValue())).toBe(MAX_DIFF_BYTES);
    await pasteInto(page, 'b', atLimit, 45_000);
    expect(utf8Length(await page.locator(textarea).inputValue())).toBe(MAX_DIFF_BYTES);
    expect(await page.locator(statusLine).innerText()).toMatch(/limit|too large|not added/i);
  });

  it('fails closed when typing on a full draft would cross the limit', async () => {
    await caretAtEnd(page);
    await page.keyboard.type('typing');
    expect(utf8Length(await page.locator(textarea).inputValue())).toBe(MAX_DIFF_BYTES);
    expect(await byteLabel(page).innerText()).toContain(String(MAX_DIFF_BYTES));
    expect(await page.locator(statusLine).innerText()).toMatch(/limit|too large|not added/i);
  });

  it('never stores a draft above the limit even when the value is replaced directly', async () => {
    const valid = fixtures.runtimeOnly;
    await draft(page, valid);
    await page.locator(textarea).fill('y'.repeat(MAX_DIFF_BYTES + 1));
    const stored = await page.locator(textarea).inputValue();
    expect(utf8Length(stored)).toBeLessThanOrEqual(MAX_DIFF_BYTES);
    expect(utf8Length(stored)).toBe(utf8Length(valid));
    expect(await byteLabel(page).innerText()).toContain(String(utf8Length(valid)));
  });

  it('counts a multi-byte paste in UTF-8 bytes, not code units', async () => {
    /**
     * Every expected length is written out as a literal, and checked against the browser's own
     * TextEncoder before the paste happens, so a mislabelled fixture cannot pass. The 2-byte slot is
     * 'é' (U+00E9, C3 A9): the euro sign people reach for here, '€' (U+20AC, E2 82 AC), is 3 bytes and
     * would silently leave 2-byte coverage missing.
     */
    const samples = [
      { glyph: 'é', bytes: 2 },
      { glyph: '€', bytes: 3 },
      { glyph: '中', bytes: 3 },
      { glyph: '🚀', bytes: 4 },
    ] as const;
    for (const { glyph, bytes } of samples) {
      const encoded = await page.evaluate((text) => new TextEncoder().encode(text).length, glyph);
      expect(encoded, `the browser must encode ${glyph} as ${bytes} UTF-8 bytes`).toBe(bytes);
      expect(utf8Length(glyph), `the harness must agree that ${glyph} is ${bytes} bytes`).toBe(
        bytes,
      );
      await draft(page, '');
      await pasteInto(page, glyph, glyph);
      const shown = /\d+/.exec(await byteLabel(page).innerText());
      expect(Number(shown?.[0]), `${glyph} must be counted as ${bytes} bytes on screen`).toBe(
        bytes,
      );
    }
  });

  it('keeps ordinary typing inside the limit working as expected', async () => {
    const valid = fixtures.runtimeOnly;
    await draft(page, valid);
    await caretAtEnd(page);
    await page.keyboard.type('// local edit');
    expect(await page.locator(textarea).inputValue()).toBe(`${valid}// local edit`);
  });
});

describeBrowser('clipboard export truth', () => {
  it('copies exactly the JSON of the report on screen, after the write resolves', async () => {
    await draft(page, fixtures.dependency);
    await analyze(page);
    expect(await clickAndCopy(page)).toEqual(analyzeDiff(fixtures.dependency));
    expect(await page.locator(statusLine).innerText()).toMatch(/copied/i);
  });
});

describeBrowser('report reading', () => {
  it('reads a diff that maps to no recognized surface', async () => {
    const unmapped = `diff --git a/notes/hello.txt b/notes/hello.txt
index 1111111..2222222 100644
--- a/notes/hello.txt
+++ b/notes/hello.txt
@@ -1 +1 @@
-hi
+hi there
`;
    const core = analyzeDiff(unmapped);
    expect(core.attention).toHaveLength(0);
    await draft(page, unmapped);
    await analyze(page);
    expect(await clickAndCopy(page)).toEqual(core);
    await expectVisible(page, '.map-notice');
  });

  it('lists changed-file paths as text, including a hostile one', async () => {
    const core = analyzeDiff(hostileDiff());
    await draft(page, hostileDiff());
    await analyze(page);
    expect(await clickAndCopy(page)).toEqual(core);
    const shown = await page.locator('.file-pile code').allTextContents();
    expect(shown.join('\n')).toContain('<svg onload');
    expect(shown).toContain(core.attention[0]?.files[0]);
  });
});
