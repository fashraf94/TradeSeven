// The shell's STOCK ROW, MEASURED IN A HEADLESS BROWSER (BS-3; shell report
// §12.7, review D6 / NEW-D1). jsdom lays nothing out, so these rows render the
// real ShellHeader (renderToStaticMarkup) into a page with the app's body font
// stack (src/index.css) and its 16 px button rule, at phone widths, and measure
// the ✕ button's 44 px tap box against the screen's right edge.
//
// They run only when asked (CI has no browser):
//
//   SHELL_HEADER_BROWSER=1                     run them
//   SHELL_FOLD_CHANNEL=msedge                  (optional; empty → Playwright's own Chromium)
//   npx vitest run src/components/Research/Sheet/shellHeader.browser.test.js
//
// The font that draws is the machine's: Segoe UI and Consolas on Windows, SF Pro
// and SF Mono on an iPhone (unmeasured here). The always-run rows that hold the
// clamps themselves are in sheet.guards.test.js.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ShellHeader from './ShellHeader.jsx';

const RUN = process.env.SHELL_HEADER_BROWSER === '1';
const CHANNEL = process.env.SHELL_FOLD_CHANNEL ?? 'msedge';
const ROW_TIMEOUT = 120_000;
const BODY_FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif";

/**
 * The stocks the brief names, plus two worst cases. The app prints a price with no thousands
 * separator (priceFormat.priceText: "$712345.67"); the shell report's 320 px measurement
 * substituted "$712,345.67", 7.7 px wider, so `comma` draws that string too (a formatter
 * that ever adds separators). BRK.B* is the refuter's synthetic: that price AND a two-digit change.
 */
export const STOCKS = Object.freeze({
  GOOGL: { symbol: 'GOOGL', name: 'Alphabet Inc Class A', price: 1234.56, change: -12.34 },
  'BRK.A': { symbol: 'BRK.A', name: 'Berkshire Hathaway Inc', price: 712345.67, change: 1.23 },
  'BRK.A,': { symbol: 'BRK.A', name: 'Berkshire Hathaway Inc', price: 712345.67, change: 1.23, comma: true },
  'BRK.B*,': { symbol: 'BRK.B', name: 'Berkshire Hathaway Inc', price: 712345.67, change: -12.34, comma: true },
});

const html = (stock, back) => {
  const header = renderToStaticMarkup(React.createElement(ShellHeader, {
    asset: { symbol: stock.symbol, name: stock.name, price: stock.price },
    onClose: () => {},
    onBack: back ? () => {} : null,
    shell: { views: ['analysis', 'chart', 'bomb'], active: 'analysis', onView: () => {}, warm: false, change: stock.change },
  })).replace('$712345.67', stock.comma ? '$712,345.67' : '$712345.67');
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    body{margin:0;font-family:${BODY_FONT}}
    button{font-size:16px !important}
    *{animation:none!important;transition:none!important}
  </style></head><body><div id="modal" style="position:fixed;top:0;left:0;width:100vw;height:100vh;box-sizing:border-box;border:1px solid #333;overflow:hidden">${header}</div></body></html>`;
  // The phone modal's own box under the shell (AssetResearchModal v2ModalStyle): 100vw, border-box,
  // a 1 px border — so the header has the screen less 2 px (318 at 320), as on the smoke preview.
};

let browser;
export async function measureRow(stock, back, width) {
  const ctx = await browser.newContext({ viewport: { width, height: 700 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  try {
    await page.setContent(html(stock, back));
    return await page.evaluate(() => {
      const r = (sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return { left: b.left, right: b.right, width: b.width }; };
      const row = document.querySelector('[data-shell-stock-row]');
      const spans = [...row.children].filter((e) => e.tagName === 'SPAN');
      const name = spans[1];
      const price = spans[2];
      const change = row.querySelector('[data-shell-change]');
      return {
        vw: innerWidth,
        close: r('[data-shell-close]'),
        back: r('[data-shell-back]'),
        nameWidth: name.getBoundingClientRect().width,
        nameCut: name.scrollWidth > name.clientWidth,
        nameEllipsis: getComputedStyle(name).textOverflow,
        priceFont: parseFloat(getComputedStyle(price).fontSize),
        priceOneLine: price.getBoundingClientRect().height < 30,
        changeFont: parseFloat(getComputedStyle(change).fontSize),
        scrollWidth: document.documentElement.scrollWidth,
        kids: [...row.children].map((c) => `${c.textContent.slice(0, 14)}:${c.getBoundingClientRect().width.toFixed(1)}`).join(' '),
      };
    });
  } finally { await ctx.close(); }
}

describe.skipIf(!RUN)('BS-3 — the stock row at phone widths, measured in a real browser', () => {
  beforeAll(async () => {
    const { chromium } = await import('playwright-core');
    browser = await chromium.launch({ headless: true, ...(CHANNEL ? { channel: CHANNEL } : {}) });
  }, ROW_TIMEOUT);
  afterAll(async () => { await browser?.close(); });

  for (const width of [320, 375]) {
    for (const key of Object.keys(STOCKS)) {
      for (const back of [false, true]) {
        it(`${width} px · ${key} $${STOCKS[key].price} ${STOCKS[key].change}% · ${back ? 'with' : 'without'} the back arrow: ✕'s 44 px box inside the screen, the name ellipsized, nothing wraps`, async () => {
          const m = await measureRow(STOCKS[key], back, width);
          process.stdout.write(`[BS-3] ${width} ${key} back=${back} closeRight=${m.close.right.toFixed(2)} spare=${(m.vw - m.close.right).toFixed(2)} name=${m.nameWidth.toFixed(1)} priceFont=${m.priceFont} changeFont=${m.changeFont} | ${m.kids}\n`);
          expect(m.close.width).toBeCloseTo(44, 1);
          expect(m.close.right).toBeLessThanOrEqual(m.vw);
          expect(m.scrollWidth).toBeLessThanOrEqual(m.vw);
          expect(m.priceOneLine).toBe(true);
          expect(m.nameEllipsis).toBe('ellipsis');
          // Margin: the name still holds 8 px, so the row has room left before ✕ is pushed (the 2.2 px
          // the shell report measured needs margin, and SF Pro / SF Mono on an iPhone are unmeasured here).
          expect(m.nameWidth).toBeGreaterThanOrEqual(8);
          if (back) expect(m.back.width).toBeCloseTo(36, 1);
        }, ROW_TIMEOUT);
      }
    }
  }

  it('the clamp reaches its floor at 320 and its ceiling at 390 and wider (14 px price, 11.5 px change: the drawing before BS-3)', async () => {
    const at320 = await measureRow(STOCKS['BRK.A'], true, 320);
    const at390 = await measureRow(STOCKS['BRK.A'], true, 390);
    const at430 = await measureRow(STOCKS['BRK.A'], true, 430);
    expect([at320.priceFont, at320.changeFont]).toEqual([12, 10]);
    expect([at390.priceFont, at390.changeFont]).toEqual([14, 11.5]);
    expect([at430.priceFont, at430.changeFont]).toEqual([14, 11.5]);
  }, ROW_TIMEOUT);
});
