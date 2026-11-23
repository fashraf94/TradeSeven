// Explore Build 1 — THE PAGE IN A REAL BROWSER (spec §3.9, §9 checks 1–5; build prompt Tests, K-14). jsdom lays out
// nothing, so these are measured on the smoke page (the smoke branch's `?exploreFixture=` loader: the real Search page
// at 'on', every read answered from the committed fixtures, the real sheet body answered from the sheet's own) at
// 1280×900, 393×852 and 320×700:
//   - no element on an Explore screen has its own vertical scroll, and nothing scrolls sideways;
//   - on the reader, the primary action is inside the viewport — the panel's button or the pinned bar's, once —
//     at the top, the middle and the bottom of the page (and every tap target is 44 px tall);
//   - opening and closing the sheet leaves scrollY unchanged and returns focus to the opener; after the walk's
//     close the panel reads Continue research, and the card In progress;
//   - inside a story the page's tab row is not drawn, and "← Explore" brings it back with the scroll and the focus
//     the player left (founder ruling F-1, Nov 22).
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
  // never measure an empty page: every scene here draws cards or a story's panel (a row once passed on a page with no stories)
  // (any one DRAWN: under a story, home's cards are mounted but hidden)
  await page.waitForFunction(() => [...document.querySelectorAll('[data-explore-card], [data-explore-panel]')].some((el) => el.getBoundingClientRect().height > 0), null, { timeout: ROW });
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

    it(`${w}×${h}: Tab follows the page's visual order, and no focused control is ever hidden under the pinned bar (review C-1, C-2)`, async () => {
      for (const scene of ['story', 'home-progress']) {
        const { ctx, page } = await sceneAt(scene, size);
        try {
          await page.evaluate(() => { window.scrollTo(0, 0); document.querySelector('[data-explore-tab]').querySelector('[tabindex="-1"]')?.focus({ preventScroll: true }); });
          const seen = [];
          for (let i = 0; i < 40; i += 1) {
            await page.keyboard.press('Tab');
            await page.waitForTimeout(60);
            const at = await page.evaluate(() => {
              const el = document.activeElement;
              if (!el || !el.closest('[data-explore-tab]')) return null;
              const r = el.getBoundingClientRect();
              const bar = document.querySelector('[data-explore-pinned-bar]')?.getBoundingClientRect() ?? null;
              const covered = bar ? r.bottom > bar.top + 1 && r.top < bar.bottom : false;
              return { y: Math.round(r.top + window.scrollY), x: Math.round(r.left), covered, what: (el.textContent || el.tagName).trim().slice(0, 30) };
            });
            if (!at) break; // left the Explore tab
            seen.push(at);
          }
          expect(seen.length, scene).toBeGreaterThan(3);
          expect(seen.filter((s) => s.covered), `${scene}: focused under the bar`).toEqual([]);
          if (w < 1000) {
            // one column: each next control sits at or below the last one
            const back = seen.filter((s, i) => i > 0 && s.y < seen[i - 1].y - 4);
            expect(back, `${scene}: ${JSON.stringify(seen.map((s) => [s.y, s.what]))}`).toEqual([]);
          }
        } finally {
          await ctx.close();
        }
      }
    }, ROW * 2);

    it(`${w}×${h}: a sheet opened from the pinned bar — after the close and the read, focus is never on <body> (review C-3)`, async () => {
      const { ctx, page } = await sceneAt('walk', size, 300);
      try {
        await page.click('[data-explore-card="sample-ai-buildout"] [data-explore-card-primary="read"]');
        await page.waitForSelector('[data-explore-primary]', { timeout: ROW });
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForSelector('[data-explore-bar-action]', { timeout: ROW });
        await page.click('[data-explore-bar-action]');
        await page.waitForSelector('[data-shared-research-body]', { timeout: ROW });
        await page.keyboard.press('Escape');
        await page.waitForSelector('[data-explore-sheet-overlay]', { state: 'detached', timeout: ROW });
        await page.waitForFunction(() => document.querySelector('[data-explore-panel]')?.dataset.explorePanel === 'B', null, { timeout: ROW });
        await page.waitForTimeout(400);
        expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true);
        await page.evaluate(() => document.querySelector('[data-explore-primary]').scrollIntoView({ block: 'center' }));
        await page.waitForTimeout(500);
        expect(await page.evaluate(() => ({ body: document.activeElement === document.body, bar: Boolean(document.querySelector('[data-explore-pinned-bar]')) }))).toEqual({ body: false, bar: false });
      } finally {
        await ctx.close();
      }
    }, ROW * 2);

    it(`${w}×${h}: inside a story the page's tab row is gone and "← Explore" brings it back — top and title on opening, the scroll left and the opener on return (F-1)`, async () => {
      const { ctx, page } = await sceneAt('home', size);
      try {
        // as Safari (no scroll anchoring): Chromium's anchoring would quietly undo a row that returns after the scroll
        await page.addStyleTag({ content: '* { overflow-anchor: none !important; }' });
        const tabRow = () => page.evaluate(() => [...document.querySelectorAll('button')].filter((b) => b.style.borderRadius === '24px' && b.getBoundingClientRect().height > 0).map((b) => b.textContent.trim()));
        const shown = await tabRow();
        expect(shown.slice(0, 2)).toEqual(['Explore', 'Markets']);
        // the last card's Read the story, brought to the middle of the screen and marked, so the return can be measured
        await page.evaluate(() => {
          const reads = [...document.querySelectorAll('[data-explore-card] [data-explore-card-read], [data-explore-card] [data-explore-card-primary="read"]')].filter((b) => b.getBoundingClientRect().height > 0);
          const b = reads.at(-1);
          b.setAttribute('data-probe-opener', '');
          b.scrollIntoView({ block: 'center' });
        });
        await page.waitForTimeout(300);
        const before = await page.evaluate(() => ({ y: Math.round(window.scrollY), top: Math.round(document.querySelector('[data-probe-opener]').getBoundingClientRect().top) }));
        console.log(`[F-1 ${w}x${h}] home scrolled to ${before.y}, the opener at ${before.top}`);
        await page.click('[data-probe-opener]');
        await page.waitForSelector('[data-explore-screen="story"]', { timeout: ROW });
        await page.waitForTimeout(400);
        const inStory = await page.evaluate(() => ({
          y: Math.round(window.scrollY),
          title: document.activeElement?.hasAttribute('data-explore-story-title') ?? false,
          heading: document.querySelector('h1')?.textContent.trim(),
          back: Boolean(document.querySelector('[data-explore-back]')),
        }));
        expect(await tabRow()).toEqual([]);
        expect(inStory).toEqual({ y: 0, title: true, heading: 'Explore', back: true });
        await page.click('[data-explore-back]');
        await page.waitForFunction(() => { const h = document.querySelector('[data-explore-home-holder]'); return h && !h.hidden; }, null, { timeout: ROW });
        await page.waitForTimeout(400);
        expect(await tabRow()).toEqual(shown);
        const after = await page.evaluate(() => ({ y: Math.round(window.scrollY), top: Math.round(document.querySelector('[data-probe-opener]').getBoundingClientRect().top), focus: document.activeElement?.hasAttribute('data-probe-opener') ?? false }));
        // the row is back BEFORE the scroll is restored: the opener sits where it was on screen (±1 px)
        expect({ ...after, y: Math.abs(after.y - before.y) <= 1 ? before.y : after.y, top: Math.abs(after.top - before.top) <= 1 ? before.top : after.top }).toEqual({ ...before, focus: true });
      } finally {
        await ctx.close();
      }
    }, ROW * 2);

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
