// Shared Research B4 — THE THESIS BUILDER, MEASURED IN A REAL BROWSER (build prompt
// Tests: "Real browser"). jsdom lays nothing out, so these are measured in headless
// Edge on the smoke page (the smoke branch's `?srFixture=` loader: the body inside a
// real HubSheet under HubOverlayProvider, every request answered by the committed
// fixtures, the builder mode on for its builder scenarios only):
//   - the phone round (P-1 to P-4): one column unless the sheet itself is 880 px wide,
//     following a resize; no word broken inside itself; one scroll — every choice reachable
//     by the sheet's scroll and under its own tap, no element with a scroll of its own;
//     the names step's build button under its tap right after the list;
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
      await page.click('[data-sr-choices] [data-sr-free]');
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
  it('4C-2: 390×844 — the choices\' Change on a stale part: its confirm is on screen, under its own tap, and holds focus', async () => {
    const { ctx, page } = await pageAt(390, 844, 'builder-stale-part');
    try {
      await scrollSheet(page, 99999);
      await page.click('[data-sr-choices] [data-sr-free="clear:segment"]');
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
  it('4C-6: 320×700 — a long unbroken token in a choice wraps; the cost marks stay on screen', async () => {
    const { ctx, page } = await pageAt(320, 700, 'builder-map');
    try {
      await page.evaluate(() => {
        const span = document.querySelector('[data-sr-choices] [data-sr-free] span span:nth-of-type(2)') ?? document.querySelector('[data-sr-choices] [data-sr-free] span');
        span.textContent = `https://example.com/${'a'.repeat(120)}`;
      });
      await page.waitForTimeout(200);
      const m = await page.evaluate(() => {
        const choices = document.querySelector('[data-sr-choices]');
        const marks = [...document.querySelectorAll('[data-sr-choices] [data-sr-cost]')].map((x) => x.getBoundingClientRect().right);
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
    it(`P-2: ${w}×${h} ${scenario} — the pinned foot holds only the composer: at most a quarter of the sheet`, async () => {
      const { ctx, page } = await pageAt(w, h, scenario);
      try {
        const m = await page.evaluate(() => {
          const sheet = document.querySelector('[role="dialog"]');
          const foot = document.querySelector('[data-sr-foot]');
          return { foot: foot.getBoundingClientRect().height, sheet: sheet.clientHeight };
        });
        expect(m.foot / m.sheet, JSON.stringify(m)).toBeLessThanOrEqual(0.25);
      } finally { await ctx.close(); }
    }, ROW_TIMEOUT);
  }
});

// ── the phone round (P-1 to P-4) ─────────────────────────────────────────────────────────────────────────────────
/** Words inside the body's buttons that break across lines (a word with rects on two lines). */
const brokenWords = (page) => page.evaluate(() => {
  const out = [];
  for (const btn of document.querySelectorAll('[data-shared-research-body] button, [data-shared-research-body] [role="button"]')) {
    if (btn.getBoundingClientRect().width === 0) continue;
    const walker = document.createTreeWalker(btn, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const re = /[^\s\-–—]+/g; // a hyphen or a dash is a wrap point of its own: a word is what lies between
      for (let m = re.exec(n.data); m; m = re.exec(n.data)) {
        const r = document.createRange();
        r.setStart(n, m.index);
        r.setEnd(n, m.index + m[0].length);
        const tops = new Set([...r.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top)));
        if (tops.size > 1) out.push(m[0]);
      }
    }
  }
  return out;
});
/** Elements inside the body with a scroll of their own (text fields aside). */
const innerScrollers = (page) => page.evaluate(() => [...document.querySelectorAll('[data-shared-research-body] *')].filter((el) => {
  if (['TEXTAREA', 'INPUT'].includes(el.tagName)) return false;
  const cs = getComputedStyle(el);
  return (['auto', 'scroll'].includes(cs.overflowY) && el.scrollHeight > el.clientHeight + 1) || (['auto', 'scroll'].includes(cs.overflowX) && el.scrollWidth > el.clientWidth + 1);
}).map((el) => `${el.tagName.toLowerCase()}${[...el.attributes].filter((a) => a.name.startsWith('data-sr')).map((a) => `[${a.name}]`).join('')}`));
/** Every choice under the conversation: brought into view by the sheet's own scroll, then the element under its own tap. */
const unreachable = (page) => page.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll('[data-sr-choices] button, [data-sr-choices] [data-sr-name-row]')) {
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    if (r.width === 0) continue;
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(r.height / 2, 20));
    if (!(top && (top === el || el.contains(top)))) out.push(`${el.getAttribute('data-sr-free') ?? el.getAttribute('data-sr-research') ?? el.getAttribute('data-sr-name-row') ?? el.textContent.slice(0, 30)} under ${top?.tagName.toLowerCase()}${top?.closest('[data-sr-foot]') ? ' in the foot' : ''}`);
  }
  return out;
});
/** Is the element's top in the sheet's view (below the strip's room, above the lower half)? */
const topInView = (page, sel) => page.evaluate((q) => {
  const els = document.querySelectorAll(q);
  const el = els[els.length - 1];
  const box = document.querySelector('[role="dialog"]').getBoundingClientRect();
  const top = el.getBoundingClientRect().top;
  return { ok: top >= box.top - 1 && top <= box.top + box.height * 0.5, top: Math.round(top), sheetTop: Math.round(box.top), sheetHeight: Math.round(box.height) };
}, sel);
const layoutOf = (page) => page.evaluate(() => document.querySelector('[data-sr-builder]')?.getAttribute('data-sr-builder') ?? null);

describe.skipIf(!BASE)('the phone round in a real browser (P-1 to P-4)', () => {
  beforeAll(async () => {
    if (browser) return;
    const { chromium } = await import('playwright-core');
    browser = await chromium.launch({ headless: true, ...(CHANNEL ? { channel: CHANNEL } : {}) });
  }, ROW_TIMEOUT);
  afterAll(async () => { await browser?.close(); browser = null; }, ROW_TIMEOUT);

  for (const [w, h] of [[393, 852], [600, 900], [720, 900], [1280, 800]]) {
    it(`P-1: ${w}×${h}, a fresh load — one column (the hub's sheet is at most 720 px wide), no word broken inside itself`, async () => {
      const { ctx, page } = await pageAt(w, h, 'builder-midway');
      try {
        expect(await layoutOf(page)).toBe('one-column');
        expect(await brokenWords(page)).toEqual([]);
      } finally { await ctx.close(); }
    }, ROW_TIMEOUT);
  }
  it('P-1: opened at 1280, then narrowed to 393 with the sheet open — one column, the phone sheet, no word broken (screenshot 1)', async () => {
    const { ctx, page } = await pageAt(1280, 800, 'builder-names');
    try {
      await page.setViewportSize({ width: 393, height: 852 });
      await page.waitForTimeout(600);
      expect(await layoutOf(page)).toBe('one-column');
      const sheet = await page.evaluate(() => document.querySelector('[role="dialog"]').getBoundingClientRect().width);
      expect(sheet).toBeGreaterThan(380);
      expect(await brokenWords(page)).toEqual([]);
    } finally { await ctx.close(); }
  }, ROW_TIMEOUT);
  for (const scenario of ['builder-names', 'builder-map', 'builder-midway', 'builder-why', 'builder-ready']) {
    it(`P-1: 320×568 ${scenario} — no button's text breaks inside a word`, async () => {
      const { ctx, page } = await pageAt(320, 568, scenario);
      try {
        expect(await brokenWords(page)).toEqual([]);
      } finally { await ctx.close(); }
    }, ROW_TIMEOUT);
  }
  for (const [w, h] of [[393, 852], [320, 568]]) {
    it(`P-2: ${w}×${h} — the walk to "Thesis saved" (AMD and AVGO): at every point every choice is reachable by the sheet's one scroll and under its own tap; nothing scrolls on its own`, async () => {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
      const page = await ctx.newPage();
      const check = async (label) => {
        expect(await innerScrollers(page), label).toEqual([]);
        expect(await unreachable(page), label).toEqual([]);
        expect(await brokenWords(page), label).toEqual([]);
      };
      try {
        await page.goto(`${BASE.replace(/\/$/, '')}/?srFixture=walk&delay=0`, { waitUntil: 'domcontentloaded', timeout: ROW_TIMEOUT });
        await page.waitForSelector('#sr-own', { timeout: ROW_TIMEOUT });
        await page.fill('#sr-own', 'I want to play AI');
        await page.click('[data-sr-start-thesis]');
        await page.waitForSelector('[data-sr-research="map_segments"]');
        await check('start');
        await page.click('[data-sr-research="map_segments"]');
        await page.waitForSelector('[data-sr-free="confirm:segment"]');
        await page.waitForTimeout(300);
        const said = await topInView(page, '[data-sr-said]');
        expect(said, `the new reply's top is in view: ${JSON.stringify(said)}`).toMatchObject({ ok: true });
        await check('segments');
        await page.click('[data-sr-free="confirm:segment"]');
        await page.waitForSelector('[data-sr-research="find_names"]');
        await page.click('[data-sr-research="find_names"]');
        await page.waitForSelector('[data-sr-names-pick]');
        await check('names');
        await page.click('[data-sr-name-row="AMD"] input');
        await page.click('[data-sr-name-row="AVGO"] input');
        await page.click('[data-sr-free="set:names"]');
        await page.waitForSelector('[data-sr-research="build_why"]');
        await check('names set');
        await page.click('[data-sr-research="build_why"]');
        await page.waitForSelector('[data-sr-free="confirm:why"]');
        await check('why');
        await page.click('[data-sr-free="confirm:why"]');
        await page.waitForSelector('[data-sr-lead="wrongIf"]');
        await check('wrong if');
        await page.click('[data-sr-choices] [data-sr-free="set:wrongIf"]');
        await page.waitForSelector('[data-sr-lead="timeFrame"]');
        await check('time frame');
        await page.click('[data-sr-choices] [data-sr-free="set:timeFrame"][data-sr-free-value="longterm"]');
        await page.waitForSelector('[data-sr-save-thesis]');
        await page.waitForTimeout(300);
        const ready = await topInView(page, '[data-sr-ready]');
        expect(ready, `the ready card arrives at its top: ${JSON.stringify(ready)}`).toMatchObject({ ok: true });
        expect(await innerScrollers(page), 'ready').toEqual([]);
        expect(await brokenWords(page), 'ready').toEqual([]);
        await page.click('[data-sr-save-thesis]');
        await page.waitForSelector('[data-sr-thesis-saved]', { timeout: ROW_TIMEOUT });
        expect(await page.textContent('[data-sr-saved-line]')).toContain('AMD, AVGO');
      } finally { await ctx.close(); }
    }, ROW_TIMEOUT);
  }
  it('P-4: 393×852 — after a name is ticked, the build button is the element under its tap, right after the list, with no inner scroll', async () => {
    const { ctx, page } = await pageAt(393, 852, 'builder-names');
    try {
      await page.click('[data-sr-name-row="AMD"] input');
      await page.evaluate(() => document.querySelector('[data-sr-free="set:names"]').scrollIntoView({ block: 'center' }));
      const hit = await hitOf(page, '[data-sr-free="set:names"]');
      expect(hit, JSON.stringify(hit)).toMatchObject({ found: true, inViewport: true, tapped: true });
      expect(await page.textContent('[data-sr-free="set:names"]')).toContain('Build it on AMD');
      expect(await innerScrollers(page)).toEqual([]);
    } finally { await ctx.close(); }
  }, ROW_TIMEOUT);
  it('P-3: 393×852 — the strip carries "⋯" beside its unfold; it reveals Discard, under its own tap', async () => {
    const { ctx, page } = await pageAt(393, 852, 'builder-midway');
    try {
      await scrollSheet(page, 900);
      await page.waitForTimeout(300);
      const more = await hitOf(page, '[data-sr-more="strip"]');
      expect(more, JSON.stringify(more)).toMatchObject({ found: true, inViewport: true, tapped: true });
      await page.click('[data-sr-more="strip"]');
      const discard = await hitOf(page, '[data-sr-discard="strip"]');
      expect(discard, JSON.stringify(discard)).toMatchObject({ found: true, inViewport: true, tapped: true });
    } finally { await ctx.close(); }
  }, ROW_TIMEOUT);
});

describe.skipIf(!BASE)('lens (c) on the phone round, in a real browser', () => {
  beforeAll(async () => {
    if (browser) return;
    const { chromium } = await import('playwright-core');
    browser = await chromium.launch({ headless: true, ...(CHANNEL ? { channel: CHANNEL } : {}) });
  }, ROW_TIMEOUT);
  afterAll(async () => { await browser?.close(); browser = null; }, ROW_TIMEOUT);

  it('5C-3: 320×568 — a 20-character agent name: the pick\'s tag stays on the symbol\'s line and never runs over the count', async () => {
    const ctx = await browser.newContext({ viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    try {
      await page.goto(`${BASE.replace(/\/$/, '')}/?srFixture=builder-names&delay=0&name=${encodeURIComponent('Bartholomew Quinnell')}`, { waitUntil: 'domcontentloaded', timeout: ROW_TIMEOUT });
      await page.waitForSelector('[data-sr-names-pick]', { timeout: ROW_TIMEOUT });
      const m = await page.evaluate(() => ['NVDA', 'AMD'].map((sym) => {
        const row = document.querySelector(`[data-sr-name-row="${sym}"]`);
        const tag = row.querySelector('[data-sr-name-pick]').parentElement.getBoundingClientRect();
        const symbol = row.querySelector('[data-sr-name-line] > span').getBoundingClientRect();
        const count = row.lastElementChild.getBoundingClientRect();
        return { sym, overlap: Math.max(0, tag.right - count.left), sameLine: Math.abs(tag.top + tag.height / 2 - (symbol.top + symbol.height / 2)) < 4 };
      }));
      for (const r of m) expect(r, JSON.stringify(r)).toMatchObject({ overlap: 0, sameLine: true });
    } finally { await ctx.close(); }
  }, ROW_TIMEOUT);
  it('5C-4: 393×852 — focus inside the strip ("⋯", Discard) when the strip goes away on a scroll to the top: focus goes to the card; Escape still closes', async () => {
    const { ctx, page } = await pageAt(393, 852, 'builder-midway');
    try {
      await scrollSheet(page, 900);
      await page.waitForTimeout(300);
      await page.focus('[data-sr-more="strip"]');
      await page.keyboard.press('Enter');
      await page.waitForSelector('[data-sr-discard="strip"]');
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => document.activeElement?.getAttribute('data-sr-discard'))).toBe('strip');
      await scrollSheet(page, 0);
      await page.waitForTimeout(400);
      expect(await page.$('[data-sr-strip]')).toBeNull();
      expect(await page.evaluate(() => document.activeElement?.hasAttribute('data-sr-card'))).toBe(true);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      expect(await page.$('[role="dialog"]')).toBeNull();
    } finally { await ctx.close(); }
  }, ROW_TIMEOUT);
  for (const [w, h] of [[393, 852], [1280, 800]]) {
    it(`R-1 (refuter): ${w}×${h} — a sheet opened on a ready card keeps its header and Close in view (no arrival scroll)`, async () => {
      const { ctx, page } = await pageAt(w, h, 'builder-ready');
      try {
        const m = await page.evaluate(() => {
          const box = document.querySelector('[role="dialog"]');
          const close = [...box.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === 'Close' || x.textContent.trim() === '×');
          const r = close?.getBoundingClientRect();
          return { scrollTop: box.scrollTop, closeTop: r ? r.top : null, boxTop: box.getBoundingClientRect().top };
        });
        expect(m.scrollTop, JSON.stringify(m)).toBe(0);
        expect(m.closeTop, JSON.stringify(m)).toBeGreaterThanOrEqual(m.boxTop);
      } finally { await ctx.close(); }
    }, ROW_TIMEOUT);
  }
  it('the strip\'s own controls ("⋯", Discard, the unfold) never scroll the sheet when focused — Tab reaches Discard (found while fixing 5C-4)', async () => {
    const { ctx, page } = await pageAt(393, 852, 'builder-midway');
    try {
      await scrollSheet(page, 900);
      await page.waitForTimeout(300);
      const top = () => page.evaluate(() => document.querySelector('[role="dialog"]').scrollTop);
      const before = await top();
      await page.focus('[data-sr-strip]');
      await page.waitForTimeout(150);
      expect(await top()).toBe(before);
      await page.focus('[data-sr-more="strip"]');
      await page.waitForTimeout(150);
      expect(await top()).toBe(before);
      await page.keyboard.press('Enter');
      await page.waitForSelector('[data-sr-discard="strip"]');
      await page.keyboard.press('Tab');
      await page.waitForTimeout(150);
      expect(await top()).toBe(before);
      expect(await page.evaluate(() => document.activeElement?.getAttribute('data-sr-discard'))).toBe('strip');
    } finally { await ctx.close(); }
  }, ROW_TIMEOUT);
  it('5C-6: 393×852 — More is at least 44 × 44', async () => {
    const { ctx, page } = await pageAt(393, 852, 'builder-midway');
    try {
      const r = await page.evaluate(() => { const b = [...document.querySelectorAll('[data-sr-said-more]')].find((x) => !x.closest('[hidden]')).getBoundingClientRect(); return { w: b.width, h: b.height }; });
      expect(r.w, JSON.stringify(r)).toBeGreaterThanOrEqual(44);
      expect(r.h, JSON.stringify(r)).toBeGreaterThanOrEqual(44);
    } finally { await ctx.close(); }
  }, ROW_TIMEOUT);
});
