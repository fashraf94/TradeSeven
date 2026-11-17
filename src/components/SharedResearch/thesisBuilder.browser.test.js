// Shared Research B4 — THE THESIS BUILDER, MEASURED IN A REAL BROWSER (build prompt
// Tests: "Real browser"). jsdom lays nothing out, so these are measured in headless
// Edge on the smoke page (the smoke branch's `?srFixture=` loader: the body inside a
// real HubSheet under HubOverlayProvider, every request answered by the committed
// fixtures, the builder mode on for its builder scenarios only):
//   - the fold: at 390×844 the foot's first choice is on screen and is the element under
//     a tap at its centre, on T4 (mid-way) and T5 (ready), with no scrolling;
//   - the card folds to its strip when the sheet scrolls, and comes back at the top;
//   - focus stays inside the sheet through a step, a free tap, a Change confirm and a save;
//   - a tapped part's panel is in view and its Change is the element under its own tap,
//     at 320, 390 and 1280.
//
//   SR_LAYER_URL=https://<smoke preview> or http://127.0.0.1:<port>   (the page)
//   SR_LAYER_CHANNEL=msedge                                         (optional; empty → Playwright's own Chromium)
//   npx vitest run src/components/SharedResearch/thesisBuilder.browser.test.js
//
// Without SR_LAYER_URL every row is skipped (CI has neither the page nor a browser).

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const BASE = process.env.SR_LAYER_URL || '';
const CHANNEL = process.env.SR_LAYER_CHANNEL ?? 'msedge';
const ROW_TIMEOUT = 240_000;
let browser;

async function pageAt(w, h, scenario, delay = 0) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: w < 768, hasTouch: w < 768, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    const st = document.createElement('style');
    st.textContent = '*{animation:none!important;transition:none!important}';
    document.addEventListener('DOMContentLoaded', () => document.head.appendChild(st));
  });
  await page.goto(`${BASE.replace(/\/$/, '')}/?srFixture=${scenario}&delay=${delay}`, { waitUntil: 'domcontentloaded', timeout: ROW_TIMEOUT });
  await page.waitForSelector('[data-sr-builder], [data-sr-ready]', { timeout: ROW_TIMEOUT });
  await page.waitForTimeout(400);
  return { ctx, page };
}

/** Is the first element matching `selector` on screen, and the element under a tap at its centre? */
const hitOf = (page, selector) => page.evaluate((sel) => {
  const el = [...document.querySelectorAll(sel)].find((e) => e.getBoundingClientRect().width > 0) ?? null;
  if (!el) return { found: false };
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  const top = document.elementFromPoint(x, y);
  return {
    found: true, inViewport: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth,
    tapped: Boolean(top && (top === el || el.contains(top))), topIs: top ? `${top.tagName.toLowerCase()}${top.closest('[data-sr-foot]') ? ' in the foot' : ''}` : null,
  };
}, selector);
const scrollSheet = (page, y) => page.evaluate((yy) => { document.querySelector('[role="dialog"]').scrollTop = yy; }, y);
const focusIn = (page) => page.evaluate(() => {
  const a = document.activeElement;
  return { inSheet: Boolean(a && a !== document.body && a.closest('[role="dialog"]')), is: a ? a.tagName.toLowerCase() : null };
});

describe.skipIf(!BASE)('the thesis builder in a real browser (B4)', () => {
  beforeAll(async () => {
    const { chromium } = await import('playwright-core');
    browser = await chromium.launch({ headless: true, ...(CHANNEL ? { channel: CHANNEL } : {}) });
  }, ROW_TIMEOUT);
  afterAll(async () => { await browser?.close(); browser = null; }, ROW_TIMEOUT);

  for (const [scenario, label, first] of [
    ['builder-midway', 'T4 (mid-way)', '[data-sr-foot] [data-sr-free]'],
    ['builder-ready', 'T5 (ready)', '[data-sr-save-thesis]'],
  ]) {
    it(`390×844 ${label}: the foot's first choice is on screen and under its own tap, without scrolling`, async () => {
      const { ctx, page } = await pageAt(390, 844, scenario);
      try {
        expect(await page.evaluate(() => document.querySelector('[role="dialog"]').scrollTop)).toBe(0);
        const hit = await hitOf(page, first);
        expect(hit, JSON.stringify(hit)).toMatchObject({ found: true, inViewport: true, tapped: true });
      } finally { await ctx.close(); }
    }, ROW_TIMEOUT);
  }

  it('390×844: the card folds to its strip as the sheet scrolls, and comes back at the top', async () => {
    const { ctx, page } = await pageAt(390, 844, 'builder-midway');
    try {
      expect(await page.$('[data-sr-strip]')).toBeNull();
      await scrollSheet(page, 900);
      await page.waitForTimeout(300);
      const strip = await hitOf(page, '[data-sr-strip]');
      expect(strip, JSON.stringify(strip)).toMatchObject({ found: true, inViewport: true, tapped: true });
      await page.click('[data-sr-strip]');
      await page.waitForTimeout(400);
      expect(await page.$('[data-sr-strip]')).toBeNull();
      const card = await hitOf(page, '[data-sr-card] [data-sr-filled]');
      expect(card.inViewport).toBe(true);
    } finally { await ctx.close(); }
  }, ROW_TIMEOUT);

  it('390×844: focus stays in the sheet through a step and a free tap', async () => {
    const { ctx, page } = await pageAt(390, 844, 'builder-midway', 300);
    try {
      await page.click('[data-sr-research="pick:wrongIf"]');
      await page.waitForTimeout(1200);
      expect(await focusIn(page)).toMatchObject({ inSheet: true });
      await page.click('[data-sr-foot] [data-sr-free]');
      await page.waitForTimeout(1200);
      expect(await focusIn(page)).toMatchObject({ inSheet: true });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      expect(await page.$('[role="dialog"]')).toBeNull(); // Escape still reaches the sheet: focus never fell to <body>
    } finally { await ctx.close(); }
  }, ROW_TIMEOUT);

  it('390×844: focus stays in the sheet through a Change confirm and a save', async () => {
    const { ctx, page } = await pageAt(390, 844, 'builder-ready', 300);
    try {
      await page.click('[data-sr-slot="segment"]');
      await page.click('[data-sr-change="segment"]');
      await page.click('[data-sr-clear-yes]');
      await page.waitForTimeout(1200);
      expect(await focusIn(page)).toMatchObject({ inSheet: true });
      const { ctx: c2, page: p2 } = await pageAt(390, 844, 'builder-ready', 300);
      try {
        await p2.click('[data-sr-save-thesis]');
        await p2.waitForSelector('[data-sr-thesis-saved]', { timeout: ROW_TIMEOUT });
        await p2.waitForTimeout(400);
        expect(await focusIn(p2)).toMatchObject({ inSheet: true });
      } finally { await c2.close(); }
    } finally { await ctx.close(); }
  }, ROW_TIMEOUT);

  for (const [w, h] of [[320, 700], [390, 844], [1280, 800]]) {
    it(`${w}×${h}: a tapped part's panel is in view, and its Change is the element under its own tap`, async () => {
      const { ctx, page } = await pageAt(w, h, 'builder-midway');
      try {
        const slot = await hitOf(page, '[data-sr-slot="segment"]');
        expect(slot, JSON.stringify(slot)).toMatchObject({ found: true, tapped: true });
        await page.click('[data-sr-slot="segment"]');
        await page.waitForTimeout(400);
        expect(await page.getAttribute('[data-sr-slot="segment"]', 'aria-expanded')).toBe('true');
        const change = await hitOf(page, '[data-sr-panel="segment"] [data-sr-change="segment"]');
        expect(change, JSON.stringify(change)).toMatchObject({ found: true, inViewport: true, tapped: true });
        const research = await hitOf(page, '[data-sr-panel="segment"] [data-sr-research]');
        expect(research, JSON.stringify(research)).toMatchObject({ found: true, inViewport: true, tapped: true });
      } finally { await ctx.close(); }
    }, ROW_TIMEOUT);
  }
});

describe.skipIf(!BASE)('the review\'s fixes in a real browser (4C)', () => {
  beforeAll(async () => {
    if (browser) return;
    const { chromium } = await import('playwright-core');
    browser = await chromium.launch({ headless: true, ...(CHANNEL ? { channel: CHANNEL } : {}) });
  }, ROW_TIMEOUT);
  afterAll(async () => { await browser?.close(); browser = null; }, ROW_TIMEOUT);
  const escapeCloses = async (page) => { await page.keyboard.press('Escape'); await page.waitForTimeout(300); return (await page.$('[role="dialog"]')) === null; };

  it('4C-1: 390×844 — a part opened and closed by keyboard, then Escape: the sheet closes (focus never fell to <body>)', async () => {
    const { ctx, page } = await pageAt(390, 844, 'builder-midway');
    try {
      await page.focus('[data-sr-slot="segment"]');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(200);
      await page.focus('[data-sr-panel-close="segment"]');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(200);
      expect(await page.evaluate(() => document.activeElement?.getAttribute('data-sr-slot'))).toBe('segment');
      expect(await escapeCloses(page)).toBe(true);
    } finally { await ctx.close(); }
  }, ROW_TIMEOUT);
  it('4C-1: 390×844 — Change, then Keep it, then Escape: the sheet closes', async () => {
    const { ctx, page } = await pageAt(390, 844, 'builder-ready');
    try {
      await page.click('[data-sr-slot="segment"]');
      await page.click('[data-sr-change="segment"]');
      await page.click('[data-sr-clear-no]');
      await page.waitForTimeout(200);
      expect(await focusIn(page)).toMatchObject({ inSheet: true });
      expect(await escapeCloses(page)).toBe(true);
    } finally { await ctx.close(); }
  }, ROW_TIMEOUT);
  it('4C-2: 390×844 — the foot\'s Change on a stale part: its confirm is on screen, under its own tap, and holds focus', async () => {
    const { ctx, page } = await pageAt(390, 844, 'builder-stale-part');
    try {
      await scrollSheet(page, 99999);
      await page.click('[data-sr-foot] [data-sr-free="clear:segment"]');
      await page.waitForTimeout(300);
      const keep = await hitOf(page, '[data-sr-clear-no]');
      expect(keep, JSON.stringify(keep)).toMatchObject({ found: true, inViewport: true, tapped: true });
      expect(await page.evaluate(() => document.activeElement?.hasAttribute('data-sr-clear-no'))).toBe(true);
    } finally { await ctx.close(); }
  }, ROW_TIMEOUT);
  it('4C-3: 390×844 — a link that takes focus is never left under the foot', async () => {
    const { ctx, page } = await pageAt(390, 844, 'builder-midway');
    try {
      for (const sel of ['[data-sr-all-evidence-open]', '[data-sr-why-block] button']) {
        await page.focus(sel);
        await page.waitForTimeout(200);
        const r = await page.evaluate((s) => {
          const el = document.querySelector(s).getBoundingClientRect();
          const foot = document.querySelector('[data-sr-foot]').getBoundingClientRect();
          return { bottom: el.bottom, footTop: foot.top };
        }, sel);
        expect(r.bottom, `${sel} ${JSON.stringify(r)}`).toBeLessThanOrEqual(r.footTop);
      }
    } finally { await ctx.close(); }
  }, ROW_TIMEOUT);
  it('4C-4: 320×700 — another part\'s panel: its choices are on screen and under their own taps', async () => {
    const { ctx, page } = await pageAt(320, 700, 'builder-midway');
    try {
      await page.click('[data-sr-slot="timeFrame"]');
      await page.waitForTimeout(400);
      for (const sel of ['[data-sr-panel="timeFrame"] [data-sr-free="set:timeFrame"]', '[data-sr-panel="timeFrame"] [data-sr-research]']) {
        const hit = await hitOf(page, sel);
        expect(hit, `${sel} ${JSON.stringify(hit)}`).toMatchObject({ found: true, inViewport: true, tapped: true });
      }
    } finally { await ctx.close(); }
  }, ROW_TIMEOUT);
  it('4C-5: 390×844 — a wheel over the foot\'s choices (not overflowing) scrolls the sheet', async () => {
    const { ctx, page } = await pageAt(390, 844, 'builder-why');
    try {
      expect(await page.evaluate(() => { const c = document.querySelector('[data-sr-foot-choices]'); return c.scrollHeight <= c.clientHeight; })).toBe(true);
      const box = await page.evaluate(() => { const r = document.querySelector('[data-sr-foot] [data-sr-free]').getBoundingClientRect(); return { x: r.left + 20, y: r.top + 10 }; });
      await page.mouse.move(box.x, box.y);
      await page.mouse.wheel(0, 300);
      await page.waitForTimeout(300);
      expect(await page.evaluate(() => document.querySelector('[role="dialog"]').scrollTop)).toBeGreaterThan(0);
    } finally { await ctx.close(); }
  }, ROW_TIMEOUT);
  it('4C-6: 320×700 — a long unbroken token in a choice wraps; the cost marks stay on screen', async () => {
    const { ctx, page } = await pageAt(320, 700, 'builder-map');
    try {
      await page.evaluate(() => {
        const span = document.querySelector('[data-sr-foot] [data-sr-free] span span:nth-of-type(2)') ?? document.querySelector('[data-sr-foot] [data-sr-free] span');
        span.textContent = `https://example.com/${'a'.repeat(120)}`;
      });
      await page.waitForTimeout(200);
      const m = await page.evaluate(() => {
        const choices = document.querySelector('[data-sr-foot-choices]');
        const marks = [...document.querySelectorAll('[data-sr-foot] [data-sr-cost]')].map((x) => x.getBoundingClientRect().right);
        return { scroll: choices.scrollWidth, client: choices.clientWidth, maxRight: Math.max(...marks), vw: innerWidth };
      });
      expect(m.scroll, JSON.stringify(m)).toBeLessThanOrEqual(m.client);
      expect(m.maxRight, JSON.stringify(m)).toBeLessThanOrEqual(m.vw);
    } finally { await ctx.close(); }
  }, ROW_TIMEOUT);

  // ── the refuter's round ──────────────────────────────────────────────────────
  it('refuter: 390×844 — the strip opened by keyboard puts focus on the card; Escape then closes the sheet', async () => {
    const { ctx, page } = await pageAt(390, 844, 'builder-midway');
    try {
      await scrollSheet(page, 900);
      await page.waitForTimeout(300);
      await page.focus('[data-sr-strip]');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      expect(await page.$('[data-sr-strip]')).toBeNull();
      expect(await page.evaluate(() => document.activeElement?.hasAttribute('data-sr-card'))).toBe(true);
      expect(await escapeCloses(page)).toBe(true);
    } finally { await ctx.close(); }
  }, ROW_TIMEOUT);
  for (const [w, h, scenario] of [[320, 568, 'builder-midway'], [320, 568, 'builder-names'], [390, 844, 'builder-midway'], [390, 844, 'builder-names'], [390, 844, 'builder-why']]) {
    it(`refuter: ${w}×${h} ${scenario} — the whole foot (its choices, the composer, its lines) keeps within about half the sheet`, async () => {
      const { ctx, page } = await pageAt(w, h, scenario);
      try {
        const m = await page.evaluate(() => {
          const sheet = document.querySelector('[role="dialog"]');
          const foot = document.querySelector('[data-sr-foot]');
          return { foot: foot.getBoundingClientRect().height, sheet: sheet.clientHeight };
        });
        expect(m.foot / m.sheet, JSON.stringify(m)).toBeLessThanOrEqual(0.5);
      } finally { await ctx.close(); }
    }, ROW_TIMEOUT);
  }
});
