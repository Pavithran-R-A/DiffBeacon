/**
 * Stage 7, PHASES 16-22: keyboard operation, reachable controls, honest live regions,
 * reduced motion and responsive measurements. Every assertion is a measurement made in
 * a real browser at a real viewport. None of them is a WCAG or screen-reader claim.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  browserEngine,
  browserSkipReason,
  buildWeb,
  claimBrowserSlot,
  fixtures,
  launchBrowser,
  openApplication,
  serveDirectory,
  statusLine,
  textarea,
  type StaticSite,
} from './stage7.browser-harness.js';
import type { Browser, BrowserContext, Page } from 'playwright-core';

/**
 * Claiming the browser slot can mean queueing behind three other real-Chromium files, so the hook
 * budget is a scheduling allowance for that queue. It is deliberately not a per-case budget: a
 * Stage 7 case that runs slow still has to fail inside its own, much smaller, test timeout.
 */
vi.setConfig({ testTimeout: 60_000, hookTimeout: 900_000 });

const describeBrowser = browserEngine ? describe : describe.skip;
if (!browserEngine) console.warn(`stage7.browser-accessibility: ${browserSkipReason}`);

let browser: Browser;
let site: StaticSite;
let releaseSlot: (() => void) | undefined;

const mobile = { width: 375, height: 812 };

async function newPage(
  options: Parameters<typeof openApplication>[2] = {},
): Promise<{ page: Page; context: BrowserContext }> {
  const opened = await openApplication(browser, site, options);
  return { page: opened.page, context: opened.context };
}

/** The accessible name a keyboard user hears for the focused element. */
const focusedName = (target: Page) =>
  target.evaluate(() => {
    const element = document.activeElement;
    if (!(element instanceof HTMLElement)) return '';
    return (
      element.getAttribute('aria-label') ??
      element.getAttribute('id') ??
      element.textContent?.trim().slice(0, 40) ??
      element.tagName
    );
  });

/** The keyboard stops a Tab press lands on, with the class the browser actually focused. */
async function tabStops(
  target: Page,
  count: number,
): Promise<{ name: string; className: string }[]> {
  await target.locator('body').click({ position: { x: 1, y: 1 } });
  const names: { name: string; className: string }[] = [];
  for (let index = 0; index < count; index += 1) {
    await target.keyboard.press('Tab');
    names.push(
      await target.evaluate(() => {
        const element = document.activeElement;
        if (!(element instanceof HTMLElement)) return { name: '', className: '' };
        return {
          name:
            element.getAttribute('aria-label') ??
            element.getAttribute('id') ??
            element.textContent?.trim().slice(0, 40) ??
            element.tagName,
          className: element.className,
        };
      }),
    );
  }
  return names;
}

const railStops = (stops: { name: string; className: string }[]) =>
  stops.filter((stop) => stop.className.split(' ').includes('rail-item')).map((stop) => stop.name);

async function overflow(target: Page): Promise<number> {
  return target.evaluate(() => {
    const element = document.documentElement;
    return element.scrollWidth - element.clientWidth;
  });
}

const withReport = async (target: Page): Promise<void> => {
  await target.getByRole('button', { name: /Load example/ }).click();
  await target.waitForSelector('.result-layout');
};

beforeAll(async () => {
  releaseSlot = await claimBrowserSlot('accessibility');
  browser = await launchBrowser();
  site = await serveDirectory(buildWeb('/'));
});

afterAll(async () => {
  await browser?.close();
  await site?.close();
  releaseSlot?.();
});

/** Runs in the page: measures every pointer target against WCAG 2.2 SC 2.5.8. */
function measureTargets(): { measured: string[]; failures: string[] } {
  const elements = [
    ...document.querySelectorAll('.primary-button, .icon-button, .mobile-menu, .rail-item'),
  ].filter((element) => element.getClientRects().length > 0);
  const boxes = elements.map((element) => {
    const box = element.getBoundingClientRect();
    return {
      name: element.getAttribute('aria-label') ?? element.className,
      w: box.width,
      h: box.height,
      x: box.left + box.width / 2,
      y: box.top + box.height / 2,
    };
  });
  const MINIMUM = 24;
  const failures = boxes
    .map((box, index) => {
      if (box.w >= MINIMUM && box.h >= MINIMUM) return null;
      const separated = boxes.every(
        (other, otherIndex) =>
          otherIndex === index || Math.hypot(other.x - box.x, other.y - box.y) >= MINIMUM * 2,
      );
      return separated
        ? null
        : `${box.name} ${box.w.toFixed(1)}x${box.h.toFixed(1)} below 24px, not spaced`;
    })
    .filter((failure): failure is string => failure !== null);
  return {
    measured: boxes.map((box) => `${box.name}: ${box.w.toFixed(1)} x ${box.h.toFixed(1)} px`),
    failures,
  };
}

describeBrowser('focus goes where the label says', () => {
  it('moves focus into the diff textarea when the Diff input rail item is used', async () => {
    const { page, context } = await newPage();
    await page.getByRole('button', { name: 'Diff input' }).click();
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('diff-textarea');
    await context.close();
  });

  it('shows a visible focus ring on the keyboard-focused textarea', async () => {
    const { page, context } = await newPage();
    await page.locator(textarea).focus();
    const ring = await page.evaluate(() => {
      const element = document.activeElement;
      if (!(element instanceof HTMLElement)) return { width: 0, style: '' };
      const computed = getComputedStyle(element);
      return { width: parseFloat(computed.outlineWidth) || 0, style: computed.outlineStyle };
    });
    expect(ring.width).toBeGreaterThan(0);
    expect(ring.style).not.toBe('none');
    await context.close();
  });

  it('names the copy control by what it does', async () => {
    const { page, context } = await newPage();
    expect(await page.locator('.bottom-note .icon-button').last().getAttribute('aria-label')).toBe(
      'Copy current JSON report',
    );
    await context.close();
  });
});

describeBrowser('the mobile navigation drawer is honest', () => {
  it('publishes expansion state and the element it controls', async () => {
    const { page, context } = await newPage({ viewport: mobile });
    const menu = page.getByRole('button', { name: /navigation/i });
    expect(await menu.getAttribute('aria-expanded')).toBe('false');
    const controls = await menu.getAttribute('aria-controls');
    expect(controls).toBeTruthy();
    expect(await page.locator(`#${controls}`).count()).toBe(1);
    await menu.click();
    expect(await menu.getAttribute('aria-expanded')).toBe('true');
    expect(await menu.getAttribute('aria-label')).toMatch(/close/i);
    await context.close();
  });

  it('keeps a closed drawer out of the tab order and an open drawer in it', async () => {
    const { page, context } = await newPage({ viewport: mobile });
    expect(railStops(await tabStops(page, 10))).toEqual([]);
    await page.getByRole('button', { name: /navigation/i }).click();
    const opened = await tabStops(page, 12);
    expect(railStops(opened)).toEqual([
      'Attention map',
      'Diff input',
      'How it works',
      'Privacy model',
    ]);
    await context.close();
  });

  it('leaves the menu button clickable while the drawer is open', async () => {
    const { page, context } = await newPage({ viewport: mobile });
    const menu = page.getByRole('button', { name: /navigation/i });
    await menu.click();
    await menu.click();
    expect(await menu.getAttribute('aria-expanded')).toBe('false');
    await context.close();
  });

  it('returns focus to the menu button when Escape closes the drawer', async () => {
    const { page, context } = await newPage({ viewport: mobile });
    const menu = page.getByRole('button', { name: /navigation/i });
    await menu.click();
    await page.keyboard.press('Escape');
    expect(await menu.getAttribute('aria-expanded')).toBe('false');
    expect(await focusedName(page)).toMatch(/navigation/i);
    await context.close();
  });
});

describeBrowser('the whole flow works without a mouse', () => {
  it('types a diff, analyzes it with Ctrl+Enter, and reaches the copy control by Tab', async () => {
    const { page, context } = await newPage();
    await page.locator(textarea).focus();
    await page.keyboard.type(fixtures.authWithTests);
    expect(await page.locator(textarea).inputValue()).toBe(fixtures.authWithTests);
    await page.keyboard.press('Control+Enter');
    await page.waitForSelector('.result-layout');
    const copy = page.getByRole('button', { name: 'Copy current JSON report' });
    await expect
      .poll(() => copy.evaluate((element) => element.isConnected), { timeout: 10_000 })
      .toBe(true);
    await copy.focus();
    await page.keyboard.press('Enter');
    await expect
      .poll(() => page.locator(statusLine).innerText(), { timeout: 10_000 })
      .toMatch(/copied/i);
    await context.close();
  });

  it('announces state changes from exactly one live region, not from the whole result', async () => {
    const { page, context } = await newPage();
    const live = await page.evaluate(() =>
      [...document.querySelectorAll('[aria-live]')].map((element) => element.className),
    );
    expect(live).toEqual(['input-status']);
    await withReport(page);
    expect(await page.locator(statusLine).getAttribute('aria-live')).toBe('polite');
    await context.close();
  });

  it('leaves the empty state reachable and free of stale results', async () => {
    const { page, context } = await newPage();
    await page.getByRole('button', { name: 'Analyze diff' }).click();
    expect(await page.locator('.result-layout').count()).toBe(0);
    expect(await page.locator('.empty-map').isVisible()).toBe(true);
    await context.close();
  });
});

describeBrowser('motion and theme respect the user', () => {
  it('shows every result row immediately when reduced motion is requested', async () => {
    const { page, context } = await newPage({ reducedMotion: true });
    await withReport(page);
    const state = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('.attention-row, .ledger-item')];
      return {
        count: rows.length,
        hidden: rows.filter((row) => Number(getComputedStyle(row).opacity) < 0.9).length,
        duration: rows[0] ? getComputedStyle(rows[0]).animationDuration : 'missing',
      };
    });
    expect(state.count).toBeGreaterThan(4);
    expect(state.hidden).toBe(0);
    expect(state.duration).toMatch(/^0(\.0+)?s$/);
    await context.close();
  });

  it('flips both the mode attribute and the toggle label', async () => {
    const { page, context } = await newPage();
    const toggle = page.getByRole('button', { name: /Switch to (dark|light) mode/ });
    expect(await toggle.getAttribute('aria-label')).toBe('Switch to dark mode');
    await toggle.click();
    expect(await page.evaluate(() => document.documentElement.dataset.mode)).toBe('dark');
    expect(await toggle.getAttribute('aria-label')).toBe('Switch to light mode');
    const paper = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(paper).toBe('rgb(23, 27, 29)');
    await context.close();
  });
});

describeBrowser('the report fits the screen it is on', () => {
  const viewports: [string, { width: number; height: number }][] = [
    ['desktop', { width: 1440, height: 900 }],
    ['tablet', { width: 768, height: 1024 }],
    ['phone', { width: 375, height: 812 }],
    ['small phone', { width: 320, height: 568 }],
  ];

  for (const [name, viewport] of viewports) {
    it(`shows the full map without horizontal page overflow on ${name}`, async () => {
      const { page, context } = await newPage({ viewport });
      await withReport(page);
      expect(await overflow(page)).toBe(0);
      expect(await page.locator('.attention-row').first().isVisible()).toBe(true);
      expect(await page.locator('.ledger').isVisible()).toBe(true);
      expect(await page.locator('.primary-button').isVisible()).toBe(true);
      await context.close();
    });
  }

  it('stacks the ledger under the map once the rail is gone', async () => {
    const { page, context } = await newPage({ viewport: mobile });
    await withReport(page);
    const geometry = await page.evaluate(() => {
      const map = document.querySelector('.map-section')?.getBoundingClientRect();
      const ledger = document.querySelector('.ledger')?.getBoundingClientRect();
      return map && ledger ? { mapBottom: map.bottom, ledgerTop: ledger.top } : null;
    });
    expect(geometry).not.toBeNull();
    if (geometry) expect(geometry.ledgerTop).toBeGreaterThanOrEqual(geometry.mapBottom);
    await context.close();
  });

  /**
   * WCAG 2.2 AA Success Criterion 2.5.8 (Target Size (Minimum)) is 24 x 24 CSS pixels,
   * with a spacing exception when a 24-px circle centred on the target clears every other
   * target's circle. This test enforces that criterion and nothing stronger. DiffBeacon's
   * internal design target is larger (44 px) where the compact layout can carry it, but
   * Stage 7 does not pass or fail on 44 px, and 44 px is not a WCAG requirement.
   * The previous revision of this case demanded h >= 44 for every control; that demand was
   * over-constrained and is recorded as such in ../stage7/green-1.log (misnamed: it is the
   * consolidated RED baseline).
   */
  it('meets the WCAG 2.2 AA 24 x 24 target-size criterion, or the spacing exception', async () => {
    const { page, context } = await newPage({ viewport: mobile });
    await withReport(page);
    const runs: { label: string; measurement: ReturnType<typeof measureTargets> }[] = [];
    runs.push({
      label: `phone ${mobile.width}x${mobile.height}`,
      measurement: await page.evaluate(measureTargets),
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    runs.push({ label: 'desktop 1440x900', measurement: await page.evaluate(measureTargets) });
    for (const run of runs) {
      console.info(
        `target size (24 px criterion) @ ${run.label}:\n  ${run.measurement.measured.join('\n  ')}`,
      );
      expect(run.measurement.measured.length).toBeGreaterThan(3);
      expect(run.measurement.failures).toEqual([]);
    }
    await context.close();
  });
});
