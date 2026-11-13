// Shared Research B2 — THE DROP MODAL OVER THE SHEET, MEASURED IN A REAL BROWSER
// (founder ruling P-1, Nov 13, 2026). jsdom paints nothing, so the layer is proven
// here: on the smoke page (the smoke branch's `?srFixture=` loader — the body inside
// a real HubSheet under HubOverlayProvider, every request answered by fixtures), the
// SignalDrop modal opened from the sheet must be the element under a tap on its own
// buttons, at 320, 390 and 1280 px — not the hub sheet (layer 1000) beneath it.
//
//   SR_LAYER_URL=https://<smoke preview> or http://127.0.0.1:<port>   (the page)
//   SR_LAYER_CHANNEL=msedge                                         (optional; empty → Playwright's own Chromium)
//   npx vitest run src/components/SharedResearch/sheetLayer.browser.test.js
//
// Without SR_LAYER_URL every row is skipped (CI has neither the page nor a browser).
// The build report records a run against the local harness and the smoke preview.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const BASE = process.env.SR_LAYER_URL || '';
const CHANNEL = process.env.SR_LAYER_CHANNEL ?? 'msedge';
const ROW_TIMEOUT = 120_000;
let browser;

/**
 * Is `selector` the element PAINTED on top at its own centre — and does a tap reach it? Chromium leaves inert
 * elements out of hit-testing, so with the sheet inert a tap falls through to whatever lies beneath it, even a modal
 * the sheet covers. `painted` therefore asks with every inert mark lifted for the instant of the measurement (then
 * put back exactly): what the eye sees on top. `tapped` asks as the page is: where a tap lands.
 */
const hitOf = (page, selector) => page.evaluate((sel) => {
  const el = [...document.querySelectorAll(sel)].find((e) => e.getBoundingClientRect().width > 0) ?? null;
  if (!el) return { found: false };
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  const isIt = (top) => Boolean(top && (top === el || el.contains(top)));
  const tapped = isIt(document.elementFromPoint(x, y));
  const marked = [...document.querySelectorAll('[inert]')];
  for (const m of marked) m.removeAttribute('inert');
  const top = document.elementFromPoint(x, y);
  for (const m of marked) m.setAttribute('inert', '');
  return {
    found: true, painted: isIt(top), tapped, inViewport: x >= 0 && y >= 0 && x <= innerWidth && y <= innerHeight,
    topIs: top ? `${top.tagName.toLowerCase()}${top.closest('[data-hub-sheet-overlay]') ? ' in the sheet' : ''}` : null,
  };
}, selector);

describe.skipIf(!BASE)('the SignalDrop modal over the hub sheet, in a real browser (P-1)', () => {
  beforeAll(async () => {
    const { chromium } = await import('playwright-core');
    browser = await chromium.launch({ headless: true, ...(CHANNEL ? { channel: CHANNEL } : {}) });
  }, ROW_TIMEOUT);
  afterAll(async () => { await browser?.close(); browser = null; });

  for (const [w, h] of [[320, 700], [390, 844], [1280, 800]]) {
    it(`${w}×${h}: "Read this signal" and then "Investigate this" are the elements under a tap — the modal paints above the sheet`, async () => {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: w < 768, hasTouch: w < 768 });
      const page = await ctx.newPage();
      try {
        await page.addInitScript(() => {
          const st = document.createElement('style');
          st.textContent = '*{animation:none!important;transition:none!important}';
          document.addEventListener('DOMContentLoaded', () => document.head.appendChild(st));
        });
        await page.goto(`${BASE.replace(/\/$/, '')}/?srFixture=drop&delay=0`, { waitUntil: 'domcontentloaded', timeout: ROW_TIMEOUT });
        await page.waitForSelector('[data-sr-use-drop]', { timeout: ROW_TIMEOUT });
        await page.click('[data-sr-use-drop]');
        await page.waitForSelector('[aria-labelledby="signal-drop-title"] textarea', { timeout: ROW_TIMEOUT });
        await page.waitForTimeout(400);
        const layers = await page.evaluate(() => ({
          sheet: Number(document.querySelector('[data-hub-sheet-overlay]')?.style.zIndex),
          modal: Number(document.querySelector('[aria-labelledby="signal-drop-title"]')?.parentElement?.style.zIndex),
          sheetInert: document.querySelector('[data-hub-sheet-overlay]')?.hasAttribute('inert') ?? null,
        }));
        // the tap first: a modal painted under the sheet fails HERE, whatever the numbers say
        const textarea = await hitOf(page, '[aria-labelledby="signal-drop-title"] textarea');
        expect(textarea, JSON.stringify(textarea)).toMatchObject({ found: true, painted: true, tapped: true });
        expect(layers.modal).toBeGreaterThan(layers.sheet);
        expect(layers.sheetInert).toBe(true);
        await page.fill('[aria-labelledby="signal-drop-title"] textarea', 'Utilities say gas turbines for new data centers are sold out into 2028.');
        const marked = await page.evaluate(() => {
          const b = [...document.querySelectorAll('[aria-labelledby="signal-drop-title"] button')].find((x) => x.textContent.trim() === 'Read this signal');
          if (b) b.setAttribute('data-probe', 'read');
          return Boolean(b);
        });
        expect(marked).toBe(true);
        const readHit = await hitOf(page, '[data-probe="read"]');
        expect(readHit, JSON.stringify(readHit)).toMatchObject({ found: true, painted: true, tapped: true });
        await page.click('[data-probe="read"]');
        await page.waitForFunction(() => [...document.querySelectorAll('[aria-labelledby="signal-drop-title"] button')].some((b) => b.textContent.trim() === 'Investigate this'), null, { timeout: ROW_TIMEOUT });
        await page.evaluate(() => [...document.querySelectorAll('[aria-labelledby="signal-drop-title"] button')].find((b) => b.textContent.trim() === 'Investigate this').setAttribute('data-probe', 'investigate'));
        const cta = await hitOf(page, '[data-probe="investigate"]');
        expect(cta, JSON.stringify(cta)).toMatchObject({ found: true, painted: true, tapped: true, inViewport: true });
        await page.click('[data-probe="investigate"]');
        await page.waitForSelector('[data-screen-label="Drop preview"]', { timeout: ROW_TIMEOUT });
        expect(await page.evaluate(() => document.querySelector('[data-hub-sheet-overlay]')?.hasAttribute('inert'))).toBe(false);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(w + 1);
      } finally { await ctx.close(); }
    }, ROW_TIMEOUT * 2);
  }
});

// Focus, in a real browser (review c1, c2): jsdom lets an inert element take focus, Chromium does not — so these two
// rows can only be measured here.
describe.skipIf(!BASE)('focus stays in the sheet, in a real browser (review c1, c2)', () => {
  beforeAll(async () => {
    const { chromium } = await import('playwright-core');
    browser = browser ?? await chromium.launch({ headless: true, ...(CHANNEL ? { channel: CHANNEL } : {}) });
  }, ROW_TIMEOUT);
  afterAll(async () => { await browser?.close(); browser = null; });
  const where = (page) => page.evaluate(() => ({
    body: document.activeElement === document.body,
    inSheet: Boolean(document.activeElement?.closest('[data-hub-sheet-overlay]')),
    sheetOpen: Boolean(document.querySelector('[data-hub-sheet-overlay]')),
  }));
  for (const [w, h] of [[390, 844], [1280, 800]]) {
    it(`${w}×${h}: the modal opened at once (mode signaldrop), Escape: focus is in the sheet, and a second Escape closes the sheet (c2)`, async () => {
      const ctx = await browser.newContext({ viewport: { width: w, height: h } });
      const page = await ctx.newPage();
      try {
        await page.goto(`${BASE.replace(/\/$/, '')}/?srFixture=drop-now&delay=0`, { waitUntil: 'domcontentloaded', timeout: ROW_TIMEOUT });
        await page.waitForSelector('[aria-labelledby="signal-drop-title"] textarea', { timeout: ROW_TIMEOUT });
        await page.waitForTimeout(500);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
        const after = await where(page);
        expect(after, JSON.stringify(after)).toMatchObject({ body: false, inSheet: true, sheetOpen: true });
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
        expect((await where(page)).sheetOpen).toBe(false);
      } finally { await ctx.close(); }
    }, ROW_TIMEOUT * 2);
    it(`${w}×${h}: Investigate replaces the preview; focus stays in the sheet, and Escape still closes it (c1)`, async () => {
      const ctx = await browser.newContext({ viewport: { width: w, height: h } });
      const page = await ctx.newPage();
      try {
        await page.goto(`${BASE.replace(/\/$/, '')}/?srFixture=story&delay=300`, { waitUntil: 'domcontentloaded', timeout: ROW_TIMEOUT });
        await page.waitForSelector('[data-sr-investigate]', { timeout: ROW_TIMEOUT });
        await page.focus('[data-sr-investigate]');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(100);
        const pending = await where(page);
        expect(pending, `while the open is in flight: ${JSON.stringify(pending)}`).toMatchObject({ body: false, inSheet: true });
        await page.waitForSelector('[data-screen-label="Opening · no answer yet"]', { timeout: ROW_TIMEOUT });
        await page.waitForTimeout(200);
        const opened = await where(page);
        expect(opened, JSON.stringify(opened)).toMatchObject({ body: false, inSheet: true });
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
        expect((await where(page)).sheetOpen).toBe(false);
      } finally { await ctx.close(); }
    }, ROW_TIMEOUT * 2);
  }
});
