// Research Modal Build C — THE FOLD, MEASURED IN A HEADLESS BROWSER (spec §6
// "the fold at 390×844 and 430×932, measured in a headless browser"; BC-2;
// review D1, D2, D3, D6, D7).
//
// jsdom lays nothing out, so these rows drive the REAL modal on the sheet
// fixture page (the smoke branch's `?sheetFixture=` loader: committed JSON
// fixtures, no production read, the Ask answered by a canned SMOKE ONLY reply)
// in a real browser and measure it. They need that page, so they run only when
// pointed at one:
//
//   SHEET_FOLD_URL=https://<smoke preview>  (or a local harness, e.g. http://127.0.0.1:5193)
//   SHEET_FOLD_CHANNEL=msedge               (optional: a Playwright browser channel;
//                                            empty → Playwright's own Chromium)
//   npx vitest run src/components/Research/Sheet/sheetFold.browser.test.js
//
// Without SHEET_FOLD_URL every row is skipped (CI has neither the page nor a
// browser). The build report records a run against the smoke preview.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const BASE = process.env.SHEET_FOLD_URL || '';
const CHANNEL = process.env.SHEET_FOLD_CHANNEL ?? 'msedge';
const LAYER0 = ['held_tf', 'held_cp', 'held_legacy', 'unexamined', 'budget_out'];
const FOLD_SIZES = [[390, 844], [430, 932]];
const ROW_TIMEOUT = 120_000;

let browser;
const open = async (w, h, query) => {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: w < 768, hasTouch: w < 768 });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    const st = document.createElement('style');
    st.textContent = '*{animation:none!important;transition:none!important}';
    document.addEventListener('DOMContentLoaded', () => document.head.appendChild(st));
  });
  await page.goto(`${BASE.replace(/\/$/, '')}/?${query}`, { waitUntil: 'domcontentloaded', timeout: ROW_TIMEOUT });
  await page.waitForSelector('[data-sheet-root]', { timeout: ROW_TIMEOUT });
  return { ctx, page };
};
const settle = async (page) => { await page.waitForSelector('.tv-lightweight-charts', { timeout: ROW_TIMEOUT }); await page.waitForTimeout(1200); };
/** Layer 0's geometry: the sheet, the action row, the drawer's scroll area, and any sideways overflow. */
const geometry = (page) => page.evaluate(() => {
  const box = (sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right }; };
  const root = document.querySelector('[data-sheet-root]');
  const area = root?.parentElement;
  const voice = document.querySelector('[data-sheet-voice]');
  return {
    vw: innerWidth, vh: innerHeight, layer: root?.dataset.sheetLayer,
    sheet: box('[data-sheet-root]'), actions: box('[data-sheet-actions]'),
    area: area ? { scrollHeight: area.scrollHeight, clientHeight: area.clientHeight, scrollWidth: area.scrollWidth, clientWidth: area.clientWidth, top: area.getBoundingClientRect().top, bottom: area.getBoundingClientRect().bottom } : null,
    voiceOverflow: voice ? voice.scrollWidth - voice.clientWidth : null,
    pageScrollWidth: document.documentElement.scrollWidth,
  };
});

describe.skipIf(!BASE)('BC-2 — Layer 0 above the action row, measured in a real browser', () => {
  beforeAll(async () => {
    const { chromium } = await import('playwright-core');
    browser = await chromium.launch({ headless: true, ...(CHANNEL ? { channel: CHANNEL } : {}) });
  }, ROW_TIMEOUT);
  afterAll(async () => { await browser?.close(); });

  for (const [w, h] of FOLD_SIZES) {
    for (const f of LAYER0) {
      it(`${f} at ${w}×${h}: the whole of Layer 0 sits above the action row, no inner scroll, no sideways scroll`, async () => {
        const { ctx, page } = await open(w, h, `sheetFixture=${f}`);
        try {
          await settle(page);
          const g = await geometry(page);
          expect(g.layer).toBe('0');
          expect(g.sheet.bottom).toBeLessThanOrEqual(g.actions.top + 0.5);
          expect(g.actions.bottom).toBeLessThanOrEqual(g.vh + 2);
          expect(g.area.scrollHeight).toBeLessThanOrEqual(g.area.clientHeight + 1);
          expect(g.pageScrollWidth).toBeLessThanOrEqual(w + 1);
          expect(g.area.scrollWidth).toBeLessThanOrEqual(g.area.clientWidth + 1);
        } finally { await ctx.close(); }
      }, ROW_TIMEOUT);
    }
  }

  it('the worst cases at 390×844 (review D3): a long sentence, a 20-character name, Fundamental Investor — still above the action row', async () => {
    for (const q of ['long=1', 'name=The%20Momentum%20Machine&arch=analyst', 'long=1&name=The%20Momentum%20Machine&arch=analyst']) {
      const { ctx, page } = await open(390, 844, `sheetFixture=held_tf&${q}`);
      try {
        await settle(page);
        const g = await geometry(page);
        expect(g.sheet.bottom, q).toBeLessThanOrEqual(g.actions.top + 0.5);
        expect(g.area.scrollHeight, q).toBeLessThanOrEqual(g.area.clientHeight + 1);
        expect(g.voiceOverflow, q).toBeLessThanOrEqual(0);
      } finally { await ctx.close(); }
    }
  }, ROW_TIMEOUT * 3);

  it('320×568: no sideways scroll for any fixture, nor with a 20-character name on Fundamental Investor (BC-2; review D3)', async () => {
    for (const q of [...LAYER0.map((f) => `sheetFixture=${f}`), 'sheetFixture=held_tf&name=The%20Momentum%20Machine&arch=analyst', 'sheetFixture=held_cp&name=The%20Momentum%20Machine']) {
      const { ctx, page } = await open(320, 568, q);
      try {
        await settle(page);
        const g = await geometry(page);
        expect(g.pageScrollWidth, q).toBeLessThanOrEqual(321);
        expect(g.area.scrollWidth, q).toBeLessThanOrEqual(g.area.clientWidth + 1);
        expect(g.voiceOverflow, q).toBeLessThanOrEqual(0);
      } finally { await ctx.close(); }
    }
  }, ROW_TIMEOUT * 8);

  it('the answer is in view when it lands, and the asked question is not offered again (review D1)', async () => {
    const { ctx, page } = await open(390, 844, 'sheetFixture=held_tf');
    try {
      await settle(page);
      await page.click('[data-sheet-question="catch_up"]');
      await page.click('[data-sheet-ask]');
      await page.waitForSelector('[data-sheet-reply="answered"]', { timeout: ROW_TIMEOUT });
      await page.waitForTimeout(400);
      const seen = await page.evaluate(() => {
        const card = document.querySelector('[data-sheet-reply-slot]').getBoundingClientRect();
        const area = document.querySelector('[data-sheet-root]').parentElement.getBoundingClientRect();
        const ask = document.querySelector('[data-sheet-ask]');
        return { cardTop: card.top, cardBottom: card.bottom, areaTop: area.top, areaBottom: area.bottom, ask: ask.dataset.sheetAsk, disabled: ask.disabled };
      });
      expect(seen.cardTop).toBeGreaterThanOrEqual(seen.areaTop - 1);
      expect(seen.cardBottom).toBeLessThanOrEqual(seen.areaBottom + 1);
      expect([seen.ask, seen.disabled]).toEqual(['asked', true]);
    } finally { await ctx.close(); }
  }, ROW_TIMEOUT);

  it('the open pin\'s label is never clipped by the chart pane (review D6)', async () => {
    for (const [w, h] of [[320, 568], [390, 844], [430, 932]]) {
      const { ctx, page } = await open(w, h, 'sheetFixture=held_tf');
      try {
        await settle(page);
        const c = await page.evaluate(() => {
          const cap = document.querySelector('[data-pin-caption]');
          const pane = document.querySelector('.tv-lightweight-charts');
          if (!cap || !pane) return null;
          const a = cap.getBoundingClientRect(); const p = pane.getBoundingClientRect();
          return { left: a.left, right: a.right, paneLeft: p.left, paneRight: p.right, clipped: cap.scrollWidth > cap.clientWidth + 1 };
        });
        expect(c, `${w}`).not.toBeNull();
        expect(c.left).toBeGreaterThanOrEqual(c.paneLeft);
        expect(c.right).toBeLessThanOrEqual(c.paneRight);
        expect(c.clipped).toBe(false);
      } finally { await ctx.close(); }
    }
  }, ROW_TIMEOUT * 3);

  it('the drawer opens where it stays: no jump when a slow chart lands, and the same place when it fails (review D7)', async () => {
    const top = (page) => page.evaluate(() => document.querySelector('[data-sheet-root]').parentElement.getBoundingClientRect().top);
    const { ctx, page } = await open(390, 844, 'sheetFixture=held_tf&delay=4000');
    let loading;
    try {
      await page.waitForTimeout(800);
      loading = await top(page);
      await settle(page);
      expect(Math.abs((await top(page)) - loading)).toBeLessThanOrEqual(1);
    } finally { await ctx.close(); }
    const failed = await open(390, 844, 'sheetFixture=held_tf&fail=1');
    try {
      await failed.page.waitForTimeout(2500);
      expect(Math.abs((await top(failed.page)) - loading)).toBeLessThanOrEqual(1);
    } finally { await failed.ctx.close(); }
  }, ROW_TIMEOUT);

  it('Bomb mode with the sheet on: the 💣 Fuse is never under the drawer (review D2)', async () => {
    for (const [w, h] of [[390, 844], [320, 568]]) {
      const { ctx, page } = await open(w, h, 'sheetFixture=held_tf&bomb=1');
      try {
        await settle(page);
        await page.click('button:has-text("💣")');
        await page.waitForSelector('[data-bomb-plot]', { timeout: ROW_TIMEOUT });
        await page.waitForTimeout(1200);
        const b = await page.evaluate(() => ({
          plot: document.querySelector('[data-bomb-plot]').getBoundingClientRect().bottom,
          drawer: document.querySelector('[data-sheet-root]').parentElement.getBoundingClientRect().top,
        }));
        expect(b.plot, `${w}`).toBeLessThanOrEqual(b.drawer + 1);
      } finally { await ctx.close(); }
    }
  }, ROW_TIMEOUT * 2);
});
