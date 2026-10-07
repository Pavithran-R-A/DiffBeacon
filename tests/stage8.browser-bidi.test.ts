/**
 * Stage 8, PHASES 6 and 24: the browser demo paints repository names inside `<code>`
 * elements. React makes that text inert as markup, but Unicode bidi is a rendering
 * feature rather than an escaping one, so these cases measure what a real Chromium
 * engine actually paints — the left-to-right order of each character's own box — instead
 * of trusting what the DOM string says.
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
  textarea,
  type StaticSite,
} from './stage7.browser-harness.js';
import { diffForPaths } from './stage8.hostile-corpus.js';
import type { Browser, Page } from 'playwright-core';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 900_000 });

const describeBrowser = browserEngine ? describe : describe.skip;
if (!browserEngine) console.warn(`stage8.browser-bidi: ${browserSkipReason}`);

// Written as escapes on purpose: a literal U+202E in a test file is invisible to the
// next reader, which is the opposite of what a display test should be.
const RLO = '\u202e';
const LRI = '\u2066';
const PDI = '\u2069';
const C1_CSI = '\u009b';
const HEBREW = '\u05e9\u05dc\u05d5\u05dd';
const REPLACEMENT_MARK = '\ufffd';

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

let browser: Browser;
let site: StaticSite;
let releaseSlot: (() => void) | undefined;

/**
 * Five runtime files, so the attention row paints three names and the trusted `+2 more`
 * label beside them. The hostile character follows an `a` because a bare U+202E compares
 * above every ASCII letter and would be sorted out of sight rather than painted.
 */
function pileDiff(hostile: string): string {
  return diffForPaths([hostile, 'src/b1.ts', 'src/b2.ts', 'src/b3.ts', 'src/b4.ts']);
}

interface PaintedCharacter {
  ch: string;
  x: number;
}

interface PileProbe {
  found: boolean;
  codeText: string | null;
  codeUnicodeBidi: string;
  pileDisplay: string;
  trustedText: string | null;
  trustedChars: PaintedCharacter[];
  nameChars: PaintedCharacter[];
  pileTags: string[];
}

/** Paint positions, per character, taken from Chromium's own layout. */
async function probePile(page: Page, marker: string): Promise<PileProbe> {
  return page.evaluate((target: string) => {
    const characterPositions = (element: Element | null): { ch: string; x: number }[] => {
      const positions: { ch: string; x: number }[] = [];
      if (element === null) return positions;
      for (const node of Array.from(element.childNodes)) {
        if (node.nodeType !== Node.TEXT_NODE) continue;
        const text = node.textContent ?? '';
        for (let index = 0; index < text.length; index += 1) {
          const range = document.createRange();
          range.setStart(node, index);
          range.setEnd(node, index + 1);
          const rect = range.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) continue;
          positions.push({ ch: text[index] as string, x: rect.left });
        }
      }
      return positions;
    };
    const codes = Array.from(document.querySelectorAll<HTMLElement>('.file-pile code'));
    const code = codes.find((element) => (element.textContent ?? '').includes(target));
    const pile = code?.parentElement ?? null;
    const trusted = pile?.querySelector('span') ?? null;
    return {
      found: code !== undefined,
      codeText: code?.textContent ?? null,
      codeUnicodeBidi: code === undefined ? '' : getComputedStyle(code).unicodeBidi,
      pileDisplay: pile === null ? '' : getComputedStyle(pile).display,
      trustedText: trusted?.textContent ?? null,
      trustedChars: characterPositions(trusted),
      nameChars: characterPositions(code ?? null),
      pileTags: Array.from(pile?.children ?? []).map((child) => child.tagName.toLowerCase()),
    };
  }, marker);
}

const xs = (chars: PaintedCharacter[]): number[] => chars.map((entry) => entry.x);

/** Left-to-right as painted: each character starts further right than the one before. */
const paintedLeftToRight = (chars: PaintedCharacter[]): boolean =>
  xs(chars).every((x, index) => index === 0 || x > (xs(chars)[index - 1] as number));

const paintedRightToLeft = (chars: PaintedCharacter[]): boolean =>
  xs(chars).every((x, index) => index === 0 || x < (xs(chars)[index - 1] as number));

const isHebrew = (character: string): boolean => /\p{Script=Hebrew}/u.test(character);

async function pageWithReport(
  diff: string,
  viewport = DESKTOP,
  clipboardPermissions = false,
): Promise<{ page: Page; requests: string[] }> {
  const opened = await openApplication(browser, site, { viewport, clipboardPermissions });
  await opened.page.locator(textarea).fill(diff);
  await opened.page.getByRole('button', { name: 'Analyze diff' }).click();
  await opened.page.waitForSelector('.result-layout');
  opened.observation.requests.length = 0;
  opened.observation.failed.length = 0;
  opened.observation.notFound.length = 0;
  return { page: opened.page, requests: opened.observation.requests };
}

beforeAll(async () => {
  releaseSlot = await claimBrowserSlot('stage8-bidi');
  browser = await launchBrowser();
  site = await serveDirectory(buildWeb('/'));
});

afterAll(async () => {
  await browser?.close();
  await site?.close();
  releaseSlot?.();
});

describeBrowser('hostile display text in a real Chromium', () => {
  it('paints a bidi override name in the order the repository spelled it', async () => {
    const { page } = await pageWithReport(pileDiff(`src/a${RLO}RLO.ts`));
    const probe = await probePile(page, 'RLO');
    expect(probe.found, 'the hostile name should be painted').toBe(true);
    expect(probe.codeText).toBe('src/aRLO.ts');
    expect(paintedLeftToRight(probe.nameChars), JSON.stringify(probe.nameChars)).toBe(true);
    await page.context().close();
  });

  it('paints a bidi isolate name in the order the repository spelled it', async () => {
    const { page } = await pageWithReport(pileDiff(`src/a${LRI}hidden${PDI}.ts`));
    const probe = await probePile(page, 'hidden');
    expect(probe.found, 'the hostile name should be painted').toBe(true);
    expect(probe.codeText).toBe('src/ahidden.ts');
    expect(paintedLeftToRight(probe.nameChars), JSON.stringify(probe.nameChars)).toBe(true);
    await page.context().close();
  });

  for (const [label, viewport] of [
    ['desktop', DESKTOP],
    ['phone', PHONE],
  ] as const) {
    it(`keeps the trusted label beside a hostile name painted left to right on ${label}`, async () => {
      const { page } = await pageWithReport(pileDiff(`src/a${RLO}RLO.ts`), viewport);
      const probe = await probePile(page, 'RLO');
      expect(probe.pileDisplay).toBe(viewport === DESKTOP ? 'flex' : 'block');
      expect(probe.trustedText).toBe('+2 more');
      expect(paintedLeftToRight(probe.trustedChars), JSON.stringify(probe.trustedChars)).toBe(true);
      await page.context().close();
    });
  }

  it('leaves an ordinary Hebrew name reading the way Hebrew reads', async () => {
    const { page } = await pageWithReport(pileDiff(`src/a${HEBREW}.ts`));
    const probe = await probePile(page, HEBREW);
    // Nothing about the name is rewritten: the letters the repository used are the
    // letters painted, in their own right-to-left order, while the Latin run around
    // them stays left-to-right. An override control is the case above, not this one.
    expect(probe.codeText).toBe(`src/a${HEBREW}.ts`);
    const letters = probe.nameChars.filter((entry) => isHebrew(entry.ch));
    expect(letters.map((entry) => entry.ch)).toEqual([...HEBREW]);
    expect(paintedRightToLeft(letters), JSON.stringify(letters)).toBe(true);
    expect(paintedLeftToRight(probe.nameChars.slice(0, 5))).toBe(true);
    expect(paintedLeftToRight(probe.trustedChars)).toBe(true);
    await page.context().close();
  });

  it('keeps the raw name factual in the report the page exports', async () => {
    const { page } = await pageWithReport(pileDiff(`src/a${RLO}RLO.ts`), DESKTOP, true);
    const probe = await probePile(page, 'RLO');
    expect(probe.codeText).toBe('src/aRLO.ts');
    await page.getByRole('button', { name: 'Copy current JSON report' }).click();
    const exported = await page.evaluate(() => navigator.clipboard.readText());
    expect(exported).not.toContain(RLO);
    expect(exported).toContain('\\u202e');
    expect(JSON.parse(exported).files[0].displayPath).toBe(`src/a${RLO}RLO.ts`);
    await page.context().close();
  });

  it('paints an 8-bit control as a marked gap that cannot reach the wire', async () => {
    const { page, requests } = await pageWithReport(pileDiff(`src/a${C1_CSI}csi.ts`));
    const probe = await probePile(page, 'csi.ts');
    expect(probe.codeText).toBe(`src/a${REPLACEMENT_MARK}csi.ts`);
    expect(probe.codeText).not.toContain(C1_CSI);
    expect(await page.evaluate(() => window.__DIFFBEACON_PWNED__)).toBeUndefined();
    expect(requests).toEqual([]);
    await page.context().close();
  });

  it('gives each name its own element and opens none of its own', async () => {
    const { page } = await pageWithReport(pileDiff(`src/a${RLO}RLO.ts`));
    const probe = await probePile(page, 'RLO');
    expect(probe.pileTags).toEqual(['code', 'code', 'code', 'span']);
    expect(probe.codeUnicodeBidi).toBe('normal');
    await page.context().close();
  });
});

declare global {
  interface Window {
    __DIFFBEACON_PWNED__?: unknown;
  }
}
