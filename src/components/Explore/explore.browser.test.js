// Explore Build 1 and Build 2 — THE PAGE IN A REAL BROWSER (Build 1 spec §3.9, §9 checks 1–5; Build 2 spec
// docs/specs/20261125_EXPLORE_BUILD_2_SPEC_AMENDMENT_B.md §8 checks 1, 2, 5, 15, 16; build prompt Tests). jsdom lays out
// nothing, so these are measured on the smoke page (the smoke branch's `?exploreFixture=` loader: the real Search page
// at 'on', every read answered from the committed fixtures, the real sheet body answered from the sheet's own) at
// 1280×900, 393×852 and 320×700:
//   - no element on an Explore screen has its own vertical scroll, nothing scrolls sideways, every tap target is 44 px;
//   - on both kinds of story, the primary action is inside the viewport — the panel's button or the pinned bar's,
//     once — at the top, the middle and the bottom of the page;
//   - Tab follows the visual order, and no focused control hides under the bar or the pinned jump row;
//   - inside a story the page draws no heading and no tab row (B-12), and back brings both back at the scroll and the
//     focus the player left;
//   - one list of connections at every size, a branch opening in place; a door into the deep story and back, at the
//     same scroll with the same branch open and focus on the door; the way up landing on the overview at that branch;
//   - below 1000 px the jump row pins, marks the section in view, and its back arrow works mid-page; the bar's
//     question jumps to the chooser;
//   - a company lead outside the game's 54 (CRWV) opens the stock research page;
//   - the walk: the front page → the overview → its door → the deep story → Work this idea → the sheet → close
//     (scrollY kept, focus back) → Continue research → back to the overview at the branch left.
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
const OV = 'ai-buildout';
const DEEP = 'dominion-data-centers';
let browser;

async function sceneAt(scene, [w, h], delay = 0, extra = '') {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: w < 768, hasTouch: w < 768 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/?exploreFixture=${scene}&delay=${delay}${extra}`, { waitUntil: 'domcontentloaded', timeout: ROW });
  await page.waitForSelector('[data-explore-tab]', { timeout: ROW });
  // never measure an empty page: every scene here draws the hero, cards or a story's panel (any one DRAWN: under a
  // story, the front page is mounted but hidden)
  await page.waitForFunction(() => [...document.querySelectorAll('[data-explore-hero], [data-explore-card], [data-explore-panel]')].some((el) => el.getBoundingClientRect().height > 0), null, { timeout: ROW });
  await page.waitForTimeout(700); // the page's own entrance animation (framer, 0.3 s) settles
  return { ctx, page };
}
const inStory = (page) => page.waitForSelector('[data-explore-screen="story"] [data-explore-panel]', { timeout: ROW });

/** Every element under the Explore roots that scrolls on its own, and whether the document scrolls sideways. */
const scrollersOf = (page) => page.evaluate(() => {
  const roots = [...document.querySelectorAll('[data-explore-tab], [data-explore-pinned-bar], [data-explore-jump="pinned"]')];
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
  const wide = [...document.querySelectorAll('[data-explore-tab] *, [data-explore-jump="pinned"] *')].filter((el) => !el.closest('[hidden]') && el.getBoundingClientRect().right > innerWidth + 1).map((el) => `${el.tagName.toLowerCase()}:${(el.textContent || '').trim().slice(0, 20)}`);
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

/** Every visible tap target under the Explore roots under 44 px tall. */
const smallTargetsOf = (page) => page.evaluate(() => [...document.querySelectorAll('[data-explore-tab] button, [data-explore-tab] input, [data-explore-tab] a, [data-explore-pinned-bar] button, [data-explore-jump="pinned"] button')]
  .filter((el) => !el.closest('[hidden]') && el.getBoundingClientRect().width > 0)
  .map((el) => ({ h: el.getBoundingClientRect().height, t: (el.textContent || el.getAttribute('placeholder') || el.tagName).trim().slice(0, 30) }))
  .filter((x) => x.h < 43.5));

/** Opens every branch of the story on screen (so its leads and doors are measured too). */
const openAllBranches = (page) => page.evaluate(() => { for (const b of document.querySelectorAll('[data-explore-screen="story"] [data-explore-branch-toggle][aria-expanded="false"]')) b.click(); });
/** The back control on screen: the jump row's arrow below 1000 px (in the flow at the top), the back link above. */
const backOf = (w) => (w < 1000 ? '[data-explore-screen="story"] [data-explore-jump="flow"] [data-explore-jump-back]' : '[data-explore-screen="story"] [data-explore-back]');
const tabRowOf = (page) => page.evaluate(() => [...document.querySelectorAll('button')].filter((b) => b.style.borderRadius === '24px' && b.getBoundingClientRect().height > 0).map((b) => b.textContent.trim()));

describe.skipIf(!BASE)('Explore in a real browser (Build 1 §9 checks 1–5; Build 2 §8 checks 1, 2, 5, 15, 16)', () => {
  beforeAll(async () => {
    const { chromium } = await import('playwright-core');
    browser = await chromium.launch({ headless: true, ...(CHANNEL ? { channel: CHANNEL } : {}) });
  }, ROW);
  afterAll(async () => { await browser?.close(); browser = null; });

  for (const size of SIZES) {
    const [w, h] = size;
    it(`${w}×${h}: every scene — no inner scroll, nothing sideways, 44 px targets, every branch open`, async () => {
      for (const scene of ['home', 'home-returning', 'home-empty-rows', 'overview', 'overview-no-door', 'deep', 'deep-no-parent', 'broad-question', 'gated', 'limit', 'read-failed', 'old-shape', 'compare-on']) {
        const { ctx, page } = await sceneAt(scene, size);
        try {
          await openAllBranches(page);
          await page.waitForTimeout(150);
          for (const y of [0, 'mid', 'end']) {
            await page.evaluate((to) => { const max = document.scrollingElement.scrollHeight - innerHeight; window.scrollTo(0, to === 'mid' ? max / 2 : to === 'end' ? max : 0); }, y);
            await page.waitForTimeout(200);
            const s = await scrollersOf(page);
            expect(s, `${scene} at ${y}`).toEqual({ own: [], sideways: false, wide: [] });
          }
          expect(await smallTargetsOf(page), scene).toEqual([]);
        } finally {
          await ctx.close();
        }
      }
    }, ROW * 6);

    it(`${w}×${h}: on both kinds of story the primary action is on screen at the top, the middle and the bottom — once`, async () => {
      for (const scene of ['overview', 'deep', 'broad-question']) {
        const { ctx, page } = await sceneAt(scene, size);
        try {
          await inStory(page);
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

    it(`${w}×${h}: Tab follows the page's visual order, and no focused control is ever hidden under the bar or the pinned row`, async () => {
      for (const scene of ['overview', 'deep', 'home-returning']) {
        const { ctx, page } = await sceneAt(scene, size);
        try {
          await page.evaluate(() => { window.scrollTo(0, 0); document.querySelector('[data-explore-tab]').querySelector('[tabindex="-1"]')?.focus({ preventScroll: true }); });
          const seen = [];
          for (let i = 0; i < 60; i += 1) {
            await page.keyboard.press('Tab');
            await page.waitForTimeout(60);
            const at = await page.evaluate(() => {
              const el = document.activeElement;
              if (!el || !el.closest('[data-explore-tab]')) return null;
              const r = el.getBoundingClientRect();
              const bar = document.querySelector('[data-explore-pinned-bar]')?.getBoundingClientRect() ?? null;
              const row = document.querySelector('[data-explore-jump="pinned"]')?.getBoundingClientRect() ?? null;
              // anything over the control at its centre — the bar, the pinned row, or the app's bottom nav (review P-2)
              const cx = r.left + r.width / 2;
              const cy = r.top + Math.min(r.height / 2, 20);
              const top = cy >= 0 && cy < innerHeight ? document.elementFromPoint(cx, cy) : el;
              const covered = (bar ? r.bottom > bar.top + 1 && r.top < bar.bottom : false) || (row ? r.top < row.bottom - 1 && r.bottom > row.top : false) || !(top === el || el.contains(top));
              return { y: Math.round(r.top + window.scrollY), x: Math.round(r.left), covered, what: (el.textContent || el.tagName).trim().slice(0, 30) };
            });
            if (!at) break; // left the Explore tab
            seen.push(at);
          }
          expect(seen.length, scene).toBeGreaterThan(3);
          expect(seen.filter((s) => s.covered), `${scene}: focused under the bar or the row`).toEqual([]);
          if (w < 1000) {
            // one column: each next control sits at or below the last one (a row of tickers: at the same height)
            const back = seen.filter((s, i) => i > 0 && s.y < seen[i - 1].y - 4);
            expect(back, `${scene}: ${JSON.stringify(seen.map((s) => [s.y, s.what]))}`).toEqual([]);
          }
        } finally {
          await ctx.close();
        }
      }
    }, ROW * 3);

    it(`${w}×${h}: inside a story no heading and no tab row; back brings both back — top and title on opening, the scroll left and the opener on return`, async () => {
      const { ctx, page } = await sceneAt('home', size);
      try {
        await page.addStyleTag({ content: '* { overflow-anchor: none !important; }' }); // as Safari: no scroll anchoring
        const shown = await tabRowOf(page);
        expect(shown.slice(0, 2)).toEqual(['Explore', 'Markets']);
        await page.evaluate(() => {
          const b = [...document.querySelectorAll('[data-explore-card] [data-explore-card-primary="read"]')].filter((x) => x.getBoundingClientRect().height > 0).at(-1);
          b.setAttribute('data-probe-opener', '');
          b.scrollIntoView({ block: 'center' });
        });
        await page.waitForTimeout(300);
        const before = await page.evaluate(() => ({ y: Math.round(window.scrollY), top: Math.round(document.querySelector('[data-probe-opener]').getBoundingClientRect().top) }));
        await page.click('[data-probe-opener]');
        await inStory(page);
        await page.waitForTimeout(400);
        expect(await tabRowOf(page)).toEqual([]);
        expect(await page.evaluate(() => ({ y: Math.round(window.scrollY), title: document.activeElement?.hasAttribute('data-explore-story-title') ?? false, heading: document.querySelector('h1')?.textContent.trim() ?? null }))).toEqual({ y: 0, title: true, heading: null });
        await page.click(backOf(w));
        await page.waitForFunction(() => { const x = document.querySelector('[data-explore-home-holder]'); return x && !x.hidden; }, null, { timeout: ROW });
        await page.waitForTimeout(400);
        expect(await tabRowOf(page)).toEqual(shown);
        const after = await page.evaluate(() => ({ y: Math.round(window.scrollY), top: Math.round(document.querySelector('[data-probe-opener]').getBoundingClientRect().top), focus: document.activeElement?.hasAttribute('data-probe-opener') ?? false }));
        expect({ ...after, y: Math.abs(after.y - before.y) <= 1 ? before.y : after.y, top: Math.abs(after.top - before.top) <= 1 ? before.top : after.top }).toEqual({ ...before, focus: true });
      } finally {
        await ctx.close();
      }
    }, ROW * 2);

    it(`${w}×${h}: one list of connections, a branch opening in place; its door to the deep story and back — the same scroll, the branch open, focus on the door; the way up lands at the branch`, async () => {
      const { ctx, page } = await sceneAt('overview', size);
      try {
        await inStory(page);
        expect(await page.evaluate(() => [...document.querySelectorAll('[data-explore-screen="story"] [data-explore-chain]')].map((c) => c.dataset.exploreChain))).toEqual(['story']);
        expect(await page.evaluate(() => document.querySelectorAll('[data-explore-screen="story"] [data-explore-connection]').length)).toBe(5);
        await page.click('[data-explore-screen="story"] [data-explore-branch-toggle="power"]');
        const opened = await page.evaluate(() => {
          const d = document.querySelector('[data-explore-branch-detail="power"]');
          const li = document.querySelector('[data-explore-screen="story"] [data-explore-branch="power"]');
          return { inside: li.contains(d), tall: Math.round(d.getBoundingClientRect().height) > 100, lists: document.querySelectorAll('[data-explore-screen="story"] [data-explore-chain]').length };
        });
        expect(opened).toEqual({ inside: true, tall: true, lists: 1 });
        // scoped to the story: the front page (hidden under it) has the hero's door too
        await page.evaluate(() => document.querySelector('[data-explore-screen="story"] [data-explore-door="dominion-data-centers"]').scrollIntoView({ block: 'center' }));
        await page.waitForTimeout(300);
        const before = await page.evaluate(() => Math.round(window.scrollY));
        await page.click(`[data-explore-screen="story"] [data-explore-door="${DEEP}"]`);
        await page.waitForFunction(() => document.querySelector('[data-explore-screen="story"]')?.dataset.exploreStoryKind === 'deep', null, { timeout: ROW });
        await page.waitForTimeout(400);
        expect(await page.evaluate(() => ({ y: Math.round(window.scrollY), title: document.activeElement?.hasAttribute('data-explore-story-title') ?? false }))).toEqual({ y: 0, title: true });
        await page.click(backOf(w));
        await page.waitForFunction(() => document.querySelector('[data-explore-screen="story"]')?.dataset.exploreStoryKind === 'overview', null, { timeout: ROW });
        await page.waitForTimeout(400);
        const back = await page.evaluate(() => ({ y: Math.round(window.scrollY), open: document.querySelector('[data-explore-branch-toggle="power"]').getAttribute('aria-expanded'), focus: document.activeElement?.dataset?.exploreDoor ?? null }));
        expect({ ...back, y: Math.abs(back.y - before) <= 1 ? before : back.y }).toEqual({ y: before, open: 'true', focus: DEEP });
        // the way up: from the deep story to the overview at its branch, open and on screen below any pinned row
        await page.click(`[data-explore-screen="story"] [data-explore-door="${DEEP}"]`);
        await page.waitForFunction(() => document.querySelector('[data-explore-screen="story"]')?.dataset.exploreStoryKind === 'deep', null, { timeout: ROW });
        await page.waitForTimeout(300);
        await page.click('[data-explore-way-up]');
        await page.waitForFunction(() => document.querySelector('[data-explore-screen="story"]')?.dataset.exploreStoryKind === 'overview', null, { timeout: ROW });
        await page.waitForTimeout(500);
        const landed = await page.evaluate(() => {
          const t = document.querySelector('[data-explore-branch-toggle="power"]');
          const r = t.getBoundingClientRect();
          const row = document.querySelector('[data-explore-jump="pinned"]')?.getBoundingClientRect() ?? null;
          return { open: t.getAttribute('aria-expanded'), focus: document.activeElement === t, onScreen: r.top >= (row ? row.bottom - 1 : 0) && r.bottom <= innerHeight };
        });
        expect(landed).toEqual({ open: 'true', focus: true, onScreen: true });
      } finally {
        await ctx.close();
      }
    }, ROW * 2);

    if (w < 1000) {
      it(`${w}×${h}: the jump row pins once scrolled past, marks the section in view, jumps, and its back arrow works mid-page; the bar's question jumps to the chooser`, async () => {
        const { ctx, page } = await sceneAt('overview', size);
        try {
          await inStory(page);
          expect(await page.evaluate(() => document.querySelector('[data-explore-jump="pinned"]'))).toBeNull();
          // review P-1: no label spills into the next, and a tap at the end of each label lands on its own section
          const fit = await page.evaluate(() => {
            const btns = [...document.querySelectorAll('[data-explore-screen="story"] [data-explore-jump="flow"] [data-explore-jump-to]')];
            const bad = [];
            btns.forEach((b, i) => {
              const r = b.getBoundingClientRect();
              // the words DRAWN (F-3: below 360 px a count is not drawn — display none, no box — and is not measured)
              const words = [...b.querySelectorAll('span')].filter((s) => s.textContent.trim() && s.getClientRects().length > 0).map((s) => s.getBoundingClientRect());
              if (words.some((w) => w.right > r.right + 0.5 || w.left < r.left - 0.5)) bad.push(`${b.dataset.exploreJumpTo}: words outside the button`);
              if (i + 1 < btns.length && r.right > btns[i + 1].getBoundingClientRect().left + 0.5) bad.push(`${b.dataset.exploreJumpTo}: overlaps the next`);
              const hit = document.elementFromPoint(r.right - 2, r.top + r.height / 2);
              if (!(hit === b || b.contains(hit))) bad.push(`${b.dataset.exploreJumpTo}: its end hits ${hit?.closest('[data-explore-jump-to]')?.dataset.exploreJumpTo ?? hit?.tagName}`);
            });
            const row = document.querySelector('[data-explore-screen="story"] [data-explore-jump="flow"]').getBoundingClientRect();
            if (btns.length && btns.at(-1).getBoundingClientRect().right > row.right + 0.5) bad.push('the last label leaves the row');
            return bad;
          });
          expect(fit).toEqual([]);
          const marked = () => page.evaluate(() => document.querySelector('[data-explore-jump="pinned"] [aria-current="location"]')?.dataset.exploreJumpTo ?? null);
          for (const [section, sel] of [['connections', '[data-explore-connections] h3'], ['questions', '[data-explore-questions] h3']]) {
            await page.evaluate((s) => { const el = document.querySelector(`[data-explore-screen="story"] ${s}`); window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 60); }, sel);
            await page.waitForTimeout(400);
            const pinned = await page.evaluate(() => { const r = document.querySelector('[data-explore-jump="pinned"]')?.getBoundingClientRect(); return r ? { top: Math.round(r.top), h: Math.round(r.height) } : null; });
            expect(pinned, section).toEqual({ top: 0, h: expect.any(Number) });
            expect(await marked(), section).toBe(section);
          }
          await page.click('[data-explore-jump="pinned"] [data-explore-jump-to="connections"]');
          await page.waitForTimeout(300);
          const jumped = await page.evaluate(() => {
            const head = document.querySelector('[data-explore-screen="story"] [data-explore-connections] h3');
            const row = document.querySelector('[data-explore-jump="pinned"]').getBoundingClientRect();
            return { focus: document.activeElement === head, below: head.getBoundingClientRect().top >= row.bottom - 1 };
          });
          expect(jumped).toEqual({ focus: true, below: true });
          expect(await marked()).toBe('connections');
          // the bar's question: one line, beside the action; a tap jumps to the chooser
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.waitForTimeout(300);
          await page.waitForSelector('[data-explore-bar-question]', { timeout: ROW });
          const bar = await page.evaluate(() => {
            const q = document.querySelector('[data-explore-bar-question] span');
            const a = document.querySelector('[data-explore-bar-action]').getBoundingClientRect();
            const qr = q.getBoundingClientRect();
            return { oneLine: qr.height < 24, beside: Math.abs((qr.top + qr.bottom) / 2 - (a.top + a.bottom) / 2) < 12 };
          });
          expect(bar).toEqual({ oneLine: true, beside: true });
          await page.click('[data-explore-bar-question]');
          await page.waitForTimeout(300);
          expect(await page.evaluate(() => document.activeElement === document.querySelector('[data-explore-screen="story"] [data-explore-questions] h3'))).toBe(true);
          // the back arrow, mid-page, from the pinned row
          await page.evaluate(() => window.scrollTo(0, document.scrollingElement.scrollHeight / 2));
          await page.waitForTimeout(400);
          await page.click('[data-explore-jump="pinned"] [data-explore-jump-back]');
          await page.waitForFunction(() => { const x = document.querySelector('[data-explore-home-holder]'); return x && !x.hidden; }, null, { timeout: ROW });
        } finally {
          await ctx.close();
        }
      }, ROW * 2);
    }

    it(`${w}×${h}: a company lead outside the game's 54 (CRWV) opens the stock research page`, async () => {
      const { ctx, page } = await sceneAt('overview', size);
      try {
        await inStory(page);
        await page.click('[data-explore-screen="story"] [data-explore-branch-toggle="cloud"]');
        await page.click('[data-explore-branch-detail="cloud"] [data-explore-lead="CRWV"]');
        await page.waitForFunction(() => [...document.body.querySelectorAll('*')].some((el) => !el.closest('[data-explore-tab]') && el.children.length === 0 && el.textContent.trim() === 'CRWV'), null, { timeout: ROW });
      } finally {
        await ctx.close();
      }
    }, ROW);

    it(`${w}×${h}: the walk — the overview's door, the deep story, Work this idea, the sheet, close (scrollY kept, focus back), Continue research, then back to the overview at the branch left`, async () => {
      const { ctx, page } = await sceneAt('walk', size, 600);
      try {
        await page.click(`[data-explore-hero="${OV}"] [data-explore-hero-read]`);
        await inStory(page);
        await page.click('[data-explore-screen="story"] [data-explore-branch-toggle="power"]');
        await page.evaluate(() => document.querySelector('[data-explore-screen="story"] [data-explore-door="dominion-data-centers"]').scrollIntoView({ block: 'center' }));
        await page.waitForTimeout(250);
        const doorY = await page.evaluate(() => Math.round(window.scrollY));
        await page.click(`[data-explore-screen="story"] [data-explore-door="${DEEP}"]`);
        await page.waitForFunction(() => document.querySelector('[data-explore-screen="story"]')?.dataset.exploreStoryKind === 'deep', null, { timeout: ROW });
        await page.click('[data-explore-screen="story"] [data-explore-question="minimums"]');
        await page.evaluate(() => document.querySelector('[data-explore-primary]').scrollIntoView({ block: 'center' }));
        await page.waitForTimeout(250);
        const before = await page.evaluate(() => ({ y: window.scrollY, top: Math.round(document.querySelector('[data-explore-primary]').getBoundingClientRect().top) }));
        await page.click('[data-explore-primary]');
        await page.waitForSelector('[data-shared-research-body]', { timeout: ROW });
        await page.waitForTimeout(800);
        expect(await page.evaluate(() => window.scrollY)).toBe(before.y);
        await page.click('[data-explore-sheet-close]');
        await page.waitForSelector('[data-explore-sheet-overlay]', { state: 'detached', timeout: ROW });
        const atClose = await page.evaluate(() => ({ y: window.scrollY, focus: document.activeElement?.hasAttribute('data-explore-primary') ?? false }));
        expect(atClose).toEqual({ y: before.y, focus: true });
        await page.waitForFunction(() => document.querySelector('[data-explore-panel]')?.dataset.explorePanel === 'B', null, { timeout: ROW });
        await page.waitForTimeout(100);
        const after = await page.evaluate(() => ({ top: Math.round(document.querySelector('[data-explore-primary]').getBoundingClientRect().top), focus: document.activeElement?.dataset?.explorePrimary ?? null }));
        expect({ ...after, top: Math.abs(after.top - before.top) <= 1 ? before.top : after.top }).toEqual({ top: before.top, focus: 'continue' });
        await page.click('[data-explore-primary]');
        await page.waitForSelector('[data-shared-research-body]', { timeout: ROW });
        await page.keyboard.press('Escape');
        await page.waitForSelector('[data-explore-sheet-overlay]', { state: 'detached', timeout: ROW });
        await page.waitForTimeout(800);
        expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(300);
        await page.click(backOf(w));
        await page.waitForFunction(() => document.querySelector('[data-explore-screen="story"]')?.dataset.exploreStoryKind === 'overview', null, { timeout: ROW });
        await page.waitForTimeout(400);
        const home = await page.evaluate(() => ({ y: Math.round(window.scrollY), open: document.querySelector('[data-explore-branch-toggle="power"]').getAttribute('aria-expanded'), focus: document.activeElement?.dataset?.exploreDoor ?? null }));
        expect({ ...home, y: Math.abs(home.y - doorY) <= 1 ? doorY : home.y }).toEqual({ y: doorY, open: 'true', focus: DEEP });
      } finally {
        await ctx.close();
      }
    }, ROW * 3);
  }

  // F-3 (the fix prompt of Nov 27): the smoke page's `jump-row-long` story lists 12 sources and asks 10 questions.
  it('F-3: two-digit counts — below 360 px the jump row draws the sections without their counts and every label sits inside the row (in flow and pinned), nothing sideways; from 360 px the counts are drawn; each button\'s name is what it draws', async () => {
    const FLOW = '[data-explore-screen="story"] [data-explore-jump="flow"]';
    const PINNED = '[data-explore-jump="pinned"]';
    const measure = (page, sel) => page.evaluate((s) => {
      const row = document.querySelector(s);
      const r = row.getBoundingClientRect();
      const btns = [...row.querySelectorAll('[data-explore-jump-to]')];
      const bad = [];
      // the page clips sideways overflow (index.css), so the row itself is measured against the screen (review D-7)
      if (r.right > innerWidth + 0.5 || r.left < -0.5) bad.push('the row runs past the screen');
      for (const b of btns) {
        const br = b.getBoundingClientRect();
        if (br.right > r.right + 0.5 || br.left < r.left - 0.5) bad.push(`${b.dataset.exploreJumpTo}: past the row's edge`);
        for (const w of b.querySelectorAll('span')) {
          const wr = w.getBoundingClientRect();
          if (w.textContent.trim() && wr.width > 0 && (wr.right > br.right + 0.5 || wr.left < br.left - 0.5)) bad.push(`${b.dataset.exploreJumpTo}: words outside the button`);
        }
      }
      return { bad, drawn: btns.map((b) => b.innerText.replace(/\s+/g, ' ').trim()), sideways: document.scrollingElement.scrollWidth > innerWidth };
    }, sel);
    /** Each jump button's accessible name, as the browser computes it (the aria snapshot), spaces dropped. */
    const namesOf = async (page, sel) => [...(await page.locator(sel).ariaSnapshot()).matchAll(/- button "([^"]*)"/g)].map((m) => m[1]).filter((n) => !n.startsWith('Back')).map((n) => n.replace(/\s+/g, ''));
    for (const size of [[320, 700], [359, 700], [360, 700], [393, 852]]) {
      const [w] = size;
      const { ctx, page } = await sceneAt('jump-row-long', size);
      try {
        await inStory(page);
        const want = w < 360 ? ['Story', 'Connections', 'Questions', 'Sources'] : ['Story', 'Connections 3', 'Questions 10', 'Sources 12'];
        const flow = await measure(page, FLOW);
        expect(flow, `${w}: in flow`).toEqual({ bad: [], drawn: want, sideways: false });
        expect(await namesOf(page, FLOW), `${w}: the names`).toEqual(want.map((n) => n.replace(/\s+/g, '')));
        await page.evaluate(() => { const el = document.querySelector('[data-explore-screen="story"] [data-explore-questions] h3'); window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 60); });
        await page.waitForSelector(PINNED, { timeout: ROW });
        await page.waitForTimeout(300);
        expect(await measure(page, PINNED), `${w}: pinned`).toEqual({ bad: [], drawn: want, sideways: false });
        expect(await namesOf(page, PINNED), `${w}: the pinned copy's names`).toEqual(want.map((n) => n.replace(/\s+/g, '')));
      } finally {
        await ctx.close();
      }
    }
  }, ROW * 4);
});
