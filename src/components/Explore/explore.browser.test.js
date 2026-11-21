// Explore Build 1 — THE PAGE IN A REAL BROWSER (spec §3.9, §9 checks 1–5; build prompt Tests, K-14). jsdom lays out
// nothing, so these are measured on the smoke page (the smoke branch's `?exploreFixture=` loader: the real Search page
// at 'on', every read answered from the committed fixtures, the real sheet body answered from the sheet's own) at
// 1280×900, 393×852 and 320×700:
//   - no element on an Explore screen has its own vertical scroll, and nothing scrolls sideways;
//   - on the reader, the primary action is inside the viewport — the panel's button or the pinned bar's, once —
//     at the top, the middle and the bottom of the page (and every tap target is 44 px tall);
//   - opening and closing the sheet leaves scrollY unchanged and returns focus to the opener; after the walk's
//     close the panel reads Continue research, and the card In progress.
//
//   EXPLORE_BROWSER_URL=http://127.0.0.1:<port> or https://<smoke preview>   (the page)
//   EXPLORE_BROWSER_CHANNEL=msedge                                          (optional; empty → Playwright's Chromium)
//   npx vitest run src/components/Explore/explore.browser.test.js
//
// Without EXPLORE_BROWSER_URL every row is skipped (CI has neither the page nor a browser). The build report records
// a run against the local smoke page.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const BASE = (process.env.EXPLORE_BROWSER_URL || '').replace(/\/$/, '');
const CHANNEL = process.env.EXPLORE_BROWSER_CHANNEL ?? 'msedge';
const ROW = 120_000;
const SIZES = [[1280, 900], [393, 852], [320, 700]];
let browser;

async function sceneAt(scene, [w, h], delay = 0) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: w < 768, hasTouch: w < 768 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/?exploreFixture=${scene}&delay=${delay}`, { waitUntil: 'domcontentloaded', timeout: ROW });
  await page.waitForSelector('[data-explore-tab]', { timeout: ROW });
  await page.waitForTimeout(700); // the page's own entrance animation (framer, 0.3 s) settles
  return { ctx, page };
}

/** Every element under the Explore roots that scrolls on its own, and whether the document scrolls sideways. */
const scrollersOf = (page) => page.evaluate(() => {
  const roots = [...document.querySelectorAll('[data-explore-tab], [data-explore-pinned-bar]')];
  const own = [];
  for (const root of roots) {
    for (const el of [root, ...root.querySelectorAll('*')]) {
      if (el.closest('[hidden]')) continue;
      const cs = getComputedStyle(el);
      const scrollsY = /(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1;
      const scrollsX = /(auto|scroll)/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 1;
      if (scrollsY || scrollsX) own.push(`${el.tagName.toLowerCase()}${el.className ? `.${String(el.className).split(' ')[0]}` : ''} ${scrollsY ? 'y' : ''}${scrollsX ? 'x' : ''}`);
    }
  }
  const doc = document.scrollingElement;
  const wide = [...document.querySelectorAll('[data-explore-tab] *')].filter((el) => !el.closest('[hidden]') && el.getBoundingClientRect().right > innerWidth + 1).map((el) => el.tagName.toLowerCase());
  return { own, sideways: doc.scrollWidth > innerWidth + 1, wide: wide.slice(0, 5) };
});

/**
 * Where the reader's primary action is: the panel's button and the pinned bar's, each with whether it lies fully
 * inside the viewport and is the element under a tap at its centre.
 */
const actionOf = (page) => page.evaluate(() => {
  const at = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const inside = r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth && r.height > 0;
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { inside, hit: Boolean(top && (top === el || el.contains(top))), text: el.textContent.trim(), h: r.height };
  };
  return { panel: at(document.querySelector('[data-explore-primary]')), bar: at(document.querySelector('[data-explore-bar-action]')) };
});

/** Every visible tap target under the Explore tab under 44 px tall. */
const smallTargetsOf = (page) => page.evaluate(() => [...document.querySelectorAll('[data-explore-tab] button, [data-explore-tab] input, [data-explore-tab] a, [data-explore-pinned-bar] button')]
  .filter((el) => !el.closest('[hidden]') && el.getBoundingClientRect().width > 0)
  .map((el) => ({ h: el.getBoundingClientRect().height, t: (el.textContent || el.getAttribute('placeholder') || el.tagName).trim().slice(0, 30) }))
  .filter((x) => x.h < 43.5));

describe.skipIf(!BASE)('Explore in a real browser (spec §9 checks 1–5)', () => {
  beforeAll(async () => {
    const { chromium } = await import('playwright-core');
    browser = await chromium.launch({ headless: true, ...(CHANNEL ? { channel: CHANNEL } : {}) });
  }, ROW);
  afterAll(async () => { await browser?.close(); browser = null; });

  for (const size of SIZES) {
    const [w, h] = size;
    it(`${w}×${h}: home, story, in progress, finished, no access, the limit — no inner scroll, nothing sideways, 44 px targets`, async () => {
      for (const scene of ['home', 'home-progress', 'story', 'story-progress', 'story-finished', 'gated', 'limit', 'read-failed']) {
        const { ctx, page } = await sceneAt(scene, size);
        try {
          for (const y of [0, 'mid', 'end']) {
            await page.evaluate((to) => { const max = document.scrollingElement.scrollHeight - innerHeight; window.scrollTo(0, to === 'mid' ? max / 2 : to === 'end' ? max : 0); }, y);
            await page.waitForTimeout(150);
            const s = await scrollersOf(page);
            expect(s, `${scene} at ${y}`).toEqual({ own: [], sideways: false, wide: [] });
          }
          expect(await smallTargetsOf(page), scene).toEqual([]);
        } finally {
          await ctx.close();
        }
      }
    }, ROW * 4);

    it(`${w}×${h}: on the reader the primary action is on screen at the top, the middle and the bottom — once`, async () => {
      for (const scene of ['story', 'story-progress', 'story-finished']) {
        const { ctx, page } = await sceneAt(scene, size);
        try {
          const max = await page.evaluate(() => document.scrollingElement.scrollHeight - innerHeight);
          expect(max, `${scene}: the page is taller than the screen`).toBeGreaterThan(0);
          for (const to of [0, Math.round(max / 3), Math.round(max / 2), Math.round((2 * max) / 3), max]) {
            await page.evaluate((y) => window.scrollTo(0, y), to);
            await page.waitForTimeout(250);
            const a = await actionOf(page);
            const shown = [a.panel?.inside && a.panel.hit ? 'panel' : null, a.bar?.inside && a.bar.hit ? 'bar' : null].filter(Boolean);
            expect(shown, `${scene} at ${to}/${max}: ${JSON.stringify(a)}`).toHaveLength(1);
          }
        } finally {
          await ctx.close();
        }
      }
    }, ROW * 3);

    it(`${w}×${h}: the walk — Work this idea opens the sheet, close leaves scrollY and returns focus; Continue research then`, async () => {
      // every answer 600 ms late, so the close can be measured before the read after it lands
      const { ctx, page } = await sceneAt('walk', size, 600);
      try {
        await page.click('[data-explore-card="sample-ai-buildout"] [data-explore-card-primary="read"]');
        await page.waitForSelector('[data-explore-primary]', { timeout: ROW });
        await page.fill('[data-explore-question-input]', 'Which chip suppliers name a data-center buyer in a filing?');
        await page.evaluate(() => document.querySelector('[data-explore-primary]').scrollIntoView({ block: 'center' }));
        await page.waitForTimeout(250);
        const before = await page.evaluate(() => ({ y: window.scrollY, top: Math.round(document.querySelector('[data-explore-primary]').getBoundingClientRect().top) }));
        await page.click('[data-explore-primary]');
        await page.waitForSelector('[data-explore-sheet-close]', { timeout: ROW });
        await page.waitForSelector('[data-shared-research-body]', { timeout: ROW });
        await page.waitForTimeout(800);
        expect(await page.evaluate(() => document.activeElement?.hasAttribute('data-explore-sheet-close') ?? false)).toBe(true);
        expect(await page.evaluate(() => window.scrollY)).toBe(before.y);
        await page.click('[data-explore-sheet-close]');
        await page.waitForSelector('[data-explore-sheet-overlay]', { state: 'detached', timeout: ROW });
        // the close itself: the page where it was, focus on the opener, the read not yet answered (form A still)
        const atClose = await page.evaluate(() => ({ y: window.scrollY, focus: document.activeElement?.hasAttribute('data-explore-primary') ?? false, form: document.querySelector('[data-explore-panel]')?.dataset.explorePanel }));
        expect(atClose).toEqual({ y: before.y, focus: true, form: 'A' });
        await page.waitForFunction(() => document.querySelector('[data-explore-panel]')?.dataset.explorePanel === 'B', null, { timeout: ROW });
        await page.waitForTimeout(100);
        // the read landed: form B above the SAME button, kept where it was on screen
        const after = await page.evaluate(() => ({ top: Math.round(document.querySelector('[data-explore-primary]').getBoundingClientRect().top), focus: document.activeElement?.dataset?.explorePrimary ?? null, label: document.querySelector('[data-explore-primary]')?.textContent.trim() }));
        expect({ ...after, top: Math.abs(after.top - before.top) <= 1 ? before.top : after.top }).toEqual({ top: before.top, focus: 'continue', label: 'Continue research' }); // sub-pixel scroll: ±1 px
        await page.click('[data-explore-back]');
        await page.waitForSelector('[data-explore-screen="home"]:not([hidden])', { timeout: ROW }).catch(() => {});
        const cardState = await page.evaluate(() => document.querySelector('[data-explore-card="sample-ai-buildout"] [data-explore-state]')?.textContent.trim());
        expect(cardState).toMatch(/^In progress/);
      } finally {
        await ctx.close();
      }
    }, ROW * 2);
  }
});
