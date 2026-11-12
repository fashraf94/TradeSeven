// The two-view shell — THE FOLD AND THE STRIP, MEASURED IN A HEADLESS BROWSER
// (spec docs/specs/RESEARCH_MODAL_SHELL_SPEC_V1.md §7; round 5 A's "seen on
// open" line). Replaces Build C's sheetFold.browser.test.js, whose drawer and
// Layer-0-with-chart geometry the shell removed (R-28).
//
// jsdom lays nothing out, so these rows drive the REAL modal on the shell's
// fixture page (the smoke branch's `?sheetFixture=` loader: Build C's committed
// battle fixtures, a canned SMOKE ONLY Ask) in a real browser and measure it.
// They run only when pointed at that page:
//
//   SHELL_FOLD_URL=https://<smoke preview>  (or a local harness)
//   SHELL_FOLD_CHANNEL=msedge               (optional; empty → Playwright's own Chromium)
//   npx vitest run src/components/Research/Sheet/shellFold.browser.test.js
//
// Without SHELL_FOLD_URL every row is skipped (CI has neither the page nor a
// browser). The build report records a run against the smoke preview.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const BASE = process.env.SHELL_FOLD_URL || '';
const CHANNEL = process.env.SHELL_FOLD_CHANNEL ?? 'msedge';
const OPEN_ON_ANALYSIS = ['held_tf', 'held_cp', 'held_legacy', 'unexamined', 'budget_out'];
const ROW_TIMEOUT = 120_000;

let browser;
const open = async (w, h, query, wait = '[data-shell-view]') => {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: w < 768, hasTouch: w < 768 });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    const st = document.createElement('style');
    st.textContent = '*{animation:none!important;transition:none!important}';
    document.addEventListener('DOMContentLoaded', () => document.head.appendChild(st));
  });
  await page.goto(`${BASE.replace(/\/$/, '')}/?${query}`, { waitUntil: 'domcontentloaded', timeout: ROW_TIMEOUT });
  await page.waitForSelector(wait, { timeout: ROW_TIMEOUT });
  await page.waitForTimeout(1500);
  return { ctx, page };
};
/** Round 5 A's fold: the holding line, What it decided and the three question rows above the pinned action row. */
const fold = (page) => page.evaluate(() => {
  const box = (sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return { top: b.top, bottom: b.bottom }; };
  const qs = [...document.querySelectorAll('[data-sheet-questions] [data-sheet-question]')];
  return {
    vh: innerHeight, view: document.querySelector('[data-shell-view]')?.dataset.shellView,
    stance: box('[data-shell-block="stance"]'), decided: box('[data-shell-block="decided"]'),
    lastQuestion: qs.length ? qs[qs.length - 1].getBoundingClientRect().bottom : null, questions: qs.length,
    actions: box('[data-sheet-actions]'),
    pageScrollWidth: document.documentElement.scrollWidth,
  };
});

describe.skipIf(!BASE)('the shell measured in a real browser', () => {
  beforeAll(async () => {
    const { chromium } = await import('playwright-core');
    browser = await chromium.launch({ headless: true, ...(CHANNEL ? { channel: CHANNEL } : {}) });
  }, ROW_TIMEOUT);
  afterAll(async () => { await browser?.close(); });

  for (const [w, h] of [[375, 812], [375, 844], [390, 844], [430, 932]]) {
    it(`${w}×${h}: the holding line, What it decided and the three questions sit above the pinned action row, inside the viewport`, async () => {
      for (const f of OPEN_ON_ANALYSIS) {
        const { ctx, page } = await open(w, h, `sheetFixture=${f}`, '[data-sheet-root]');
        try {
          const g = await fold(page);
          expect(g.view, f).toBe('analysis');
          expect(g.questions, f).toBe(3);
          expect(g.stance.bottom, f).toBeLessThanOrEqual(g.actions.top);
          expect(g.decided.bottom, f).toBeLessThanOrEqual(g.actions.top);
          expect(g.lastQuestion, f).toBeLessThanOrEqual(g.actions.top + 0.5);
          expect(g.actions.bottom, f).toBeLessThanOrEqual(g.vh + 0.5);
          expect(g.pageScrollWidth, f).toBeLessThanOrEqual(w + 1);
        } finally { await ctx.close(); }
      }
    }, ROW_TIMEOUT * 6);
  }

  it('the strip sticks under the header: scrolled to Smart Money, the strip\'s top is the scroll box\'s top', async () => {
    const { ctx, page } = await open(375, 812, 'sheetFixture=held_tf', '[data-sheet-root]');
    try {
      await page.click('[data-shell-tab="smartMoney"]');
      await page.waitForTimeout(800);
      const s = await page.evaluate(() => {
        const box = document.querySelector('[data-shell-scroll="analysis"]');
        box.scrollTop = box.scrollHeight;
        const strip = document.querySelector('[data-shell-strip]').getBoundingClientRect();
        return { scrolled: box.scrollTop, boxTop: box.getBoundingClientRect().top, stripTop: strip.top };
      });
      expect(s.scrolled).toBeGreaterThan(0);
      expect(Math.abs(s.stripTop - s.boxTop)).toBeLessThanOrEqual(1);
    } finally { await ctx.close(); }
  }, ROW_TIMEOUT);

  it('the four tabs fit the strip at 320 and 375 — no tab clipped, nothing hidden behind a scroll (review D1)', async () => {
    for (const [w, h] of [[320, 568], [375, 812]]) {
      const { ctx, page } = await open(w, h, 'sheetFixture=held_tf', '[data-sheet-root]');
      try {
        const s = await page.evaluate(() => {
          const strip = document.querySelector('[data-shell-strip]');
          const r = strip.getBoundingClientRect();
          const tabs = [...strip.querySelectorAll('[data-shell-tab]')].map((b) => b.getBoundingClientRect());
          return { scroll: strip.scrollWidth - strip.clientWidth, left: r.left, right: r.right, tabs: tabs.map((t) => [t.left, t.right]) };
        });
        expect(s.scroll, `${w}`).toBeLessThanOrEqual(1);
        for (const [l, rgt] of s.tabs) { expect(l, `${w}`).toBeGreaterThanOrEqual(s.left - 0.5); expect(rgt, `${w}`).toBeLessThanOrEqual(s.right + 0.5); }
      } finally { await ctx.close(); }
    }
  }, ROW_TIMEOUT * 2);

  it('a tab changed while the strip is stuck keeps it stuck, the new tab from its top (review D3)', async () => {
    const { ctx, page } = await open(375, 812, 'sheetFixture=held_tf', '[data-sheet-root]');
    try {
      await page.click('[data-shell-tab="ranks"]');
      await page.waitForTimeout(3000);
      await page.evaluate(() => { const b = document.querySelector('[data-shell-scroll="analysis"]'); b.scrollTop = b.scrollHeight; });
      await page.waitForTimeout(300);
      await page.click('[data-shell-tab="moving"]');
      await page.waitForTimeout(600);
      const s = await page.evaluate(() => {
        const box = document.querySelector('[data-shell-scroll="analysis"]').getBoundingClientRect();
        const strip = document.querySelector('[data-shell-strip]').getBoundingClientRect();
        const body = document.querySelector('[data-shell-tab-body]').getBoundingClientRect();
        return { boxTop: box.top, stripTop: strip.top, stripBottom: strip.bottom, bodyTop: body.top };
      });
      expect(Math.abs(s.stripTop - s.boxTop)).toBeLessThanOrEqual(1);
      expect(Math.abs(s.bodyTop - s.stripBottom)).toBeLessThanOrEqual(1);
    } finally { await ctx.close(); }
  }, ROW_TIMEOUT);

  it('390×664 (Safari with its bars): the whole action row sits inside the visible viewport (FQ-6, kept by SB-10)', async () => {
    for (const f of OPEN_ON_ANALYSIS) {
      const { ctx, page } = await open(390, 664, `sheetFixture=${f}`, '[data-sheet-root]');
      try {
        const a = await page.evaluate(() => {
          const row = document.querySelector('[data-sheet-actions]').getBoundingClientRect();
          const vv = window.visualViewport;
          return { top: row.top, bottom: row.bottom, vTop: vv ? vv.offsetTop : 0, vBottom: vv ? vv.offsetTop + vv.height : innerHeight };
        });
        expect(a.top, f).toBeGreaterThanOrEqual(a.vTop);
        expect(a.bottom, f).toBeLessThanOrEqual(a.vBottom + 0.5);
      } finally { await ctx.close(); }
    }
  }, ROW_TIMEOUT * 5);

  it('320×568: no sideways scroll on any view, battle or browse', async () => {
    for (const f of [...OPEN_ON_ANALYSIS, 'browse_ceg']) {
      const { ctx, page } = await open(320, 568, `sheetFixture=${f}`);
      try {
        for (const v of ['analysis', 'chart', ...(f === 'browse_ceg' ? [] : ['bomb'])]) {
          if (v !== 'analysis') { await page.click(`[data-shell-pill="${v}"]`); await page.waitForTimeout(1200); }
          const sw = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, scroll: (() => { const s = document.querySelector('[data-shell-view] > [data-shell-scroll]:not([style*="display: none"])'); return s ? s.scrollWidth - s.clientWidth : 0; })() }));
          expect(sw.page, `${f} ${v}`).toBeLessThanOrEqual(321);
          expect(sw.scroll, `${f} ${v}`).toBeLessThanOrEqual(1);
        }
      } finally { await ctx.close(); }
    }
  }, ROW_TIMEOUT * 8);

  it('FQ-9: a measured held stock in the red zone at open opens on 💣; browse opens on Analysis with two pills', async () => {
    const red = await open(375, 812, 'sheetFixture=held_redzone', '[data-bomb-plot]');
    try {
      expect(await red.page.$eval('[data-shell-view]', (e) => e.dataset.shellView)).toBe('bomb');
    } finally { await red.ctx.close(); }
    const ceg = await open(375, 812, 'sheetFixture=browse_ceg');
    try {
      expect(await ceg.page.$eval('[data-shell-view]', (e) => e.dataset.shellView)).toBe('analysis');
      expect(await ceg.page.$$eval('[data-shell-pill]', (els) => els.map((e) => e.dataset.shellPill))).toEqual(['analysis', 'chart']);
    } finally { await ceg.ctx.close(); }
  }, ROW_TIMEOUT * 2);
});
