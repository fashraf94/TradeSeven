// Command Center core spec V1.2, Amendment E V1.1 §8 — THE RESEARCH DOOR IN A REAL BROWSER. jsdom lets an inert node take
// focus and loads no chunk, so the door's round trip is proven here, in headless Edge, on the smoke page (the smoke branch's
// `?hubResearchDoor=` loader: the hub's own Research panel, sheet hook, actions and wrapper under HubOverlayProvider, the
// body loaded through the real lazy edge, every request it makes answered by the body's committed fixtures). At 390×844 and
// 1280×800: "Work an idea" opens the sheet, the body's chunk loads, Escape closes it, and focus is back on "Work an idea" —
// and the same for Continue, which opens the investigation it names.
//
//   HUB_DOOR_URL=https://<smoke preview> or http://127.0.0.1:<port>   (the page)
//   HUB_DOOR_CHANNEL=msedge                                         (optional; empty → Playwright's own Chromium)
//   npx vitest run src/components/CommandCenter/researchDoor.browser.test.js
//
// Without HUB_DOOR_URL every row is skipped (CI has neither the page nor a browser). The build report records the runs
// against the local harness and the smoke preview.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const BASE = process.env.HUB_DOOR_URL || '';
const CHANNEL = process.env.HUB_DOOR_CHANNEL ?? 'msedge';
const ROW_TIMEOUT = 120_000;
let browser;

/** What holds focus: the door's own marks, the sheet's, or the tag. */
const focusOf = (page) => page.evaluate(() => {
  const el = document.activeElement;
  if (!el || el === document.body) return 'body';
  if (el.hasAttribute('data-hub-research-work')) return 'work';
  if (el.closest('[data-hub-research-continue]')) return 'continue';
  if (el.closest('[role="dialog"]')) return 'in the sheet';
  return el.tagName.toLowerCase();
});

async function open(w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: w < 768, hasTouch: w < 768 });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    const st = document.createElement('style');
    st.textContent = '*{animation:none!important;transition:none!important}';
    document.addEventListener('DOMContentLoaded', () => document.head.appendChild(st));
  });
  const bodyChunk = [];
  page.on('request', (req) => { if (/SharedResearchSheetBody-[\w-]+\.js/.test(req.url())) bodyChunk.push(req.url()); });
  await page.goto(`${BASE.replace(/\/$/, '')}/?hubResearchDoor=1&delay=0`, { waitUntil: 'domcontentloaded', timeout: ROW_TIMEOUT });
  await page.waitForSelector('[data-hub-research-work]', { timeout: ROW_TIMEOUT });
  return { ctx, page, bodyChunk };
}

describe.skipIf(!BASE)('the research door in a real browser (Amendment E §8)', () => {
  beforeAll(async () => {
    const { chromium } = await import('playwright-core');
    browser = await chromium.launch({ headless: true, ...(CHANNEL ? { channel: CHANNEL } : {}) });
  }, ROW_TIMEOUT);
  afterAll(async () => { await browser?.close(); browser = null; });

  for (const [w, h] of [[390, 844], [1280, 800]]) {
    it(`${w}×${h}: "Work an idea" opens the sheet, the body loads (its own chunk, once), Escape closes it, and focus is back on "Work an idea"`, async () => {
      const { ctx, page, bodyChunk } = await open(w, h);
      try {
        // the body's chunk is not requested before the door is used
        expect(bodyChunk).toEqual([]);
        await page.click('[data-hub-research-work]');
        await page.waitForSelector('[role="dialog"] [data-shared-research-body]', { timeout: ROW_TIMEOUT });
        expect(bodyChunk).toHaveLength(1);
        const sheet = await page.evaluate(() => {
          const d = document.querySelector('[role="dialog"]');
          return { label: d.getAttribute('aria-label'), kind: d.getAttribute('data-hub-sheet'), dialogs: document.querySelectorAll('[role="dialog"]').length };
        });
        expect(sheet).toEqual({ label: 'Shared Research · work an idea', kind: w < 768 ? 'bottom' : 'dialog', dialogs: 1 });
        expect(await focusOf(page)).toBe('in the sheet');
        await page.keyboard.press('Escape');
        await page.waitForSelector('[role="dialog"]', { state: 'detached', timeout: ROW_TIMEOUT });
        expect(await focusOf(page)).toBe('work');
        // a second open uses the loaded chunk: no second request
        await page.click('[data-hub-research-work]');
        await page.waitForSelector('[role="dialog"] [data-shared-research-body]', { timeout: ROW_TIMEOUT });
        expect(bodyChunk).toHaveLength(1);
        await page.keyboard.press('Escape');
        await page.waitForSelector('[role="dialog"]', { state: 'detached', timeout: ROW_TIMEOUT });
        expect(await focusOf(page)).toBe('work');
        const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(sideways).toBeLessThanOrEqual(0);
      } finally {
        await ctx.close();
      }
    }, ROW_TIMEOUT);

    it(`${w}×${h}: Continue opens the investigation it names (the body's work view), Escape closes it, focus is back on Continue`, async () => {
      const { ctx, page } = await open(w, h);
      try {
        await page.waitForSelector('[data-hub-research-continue] button', { timeout: ROW_TIMEOUT });
        await page.click('[data-hub-research-continue] button');
        await page.waitForSelector('[role="dialog"] [data-shared-research-body]', { timeout: ROW_TIMEOUT });
        await page.waitForFunction(() => !document.querySelector('[role="dialog"] [data-shared-research-body]')?.textContent.includes('Checking'), null, { timeout: ROW_TIMEOUT });
        const text = await page.evaluate(() => document.querySelector('[role="dialog"]').textContent);
        expect(text).toContain('Faster checkout is spreading across online stores');
        await page.keyboard.press('Escape');
        await page.waitForSelector('[role="dialog"]', { state: 'detached', timeout: ROW_TIMEOUT });
        expect(await focusOf(page)).toBe('continue');
      } finally {
        await ctx.close();
      }
    }, ROW_TIMEOUT);
  }
});
