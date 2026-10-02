// src/components/BaggerBomb/TacticalRow.currentPrice.render.test.jsx
//
// D-85 — the player's row carries the piece's CURRENT PRICE beside the percent
// that is measured from it, under the controller flag only.
//
// Three things this file exists to hold:
//
//   1. ONE SOURCE (BUILD_RULES §9). The number is read off `asset.currentPrice`
//      — the same field the row already hands `computeProximity` — so the
//      dollar the row shows and the `Bagger $ · Bust $` the Why? panel derives
//      cannot come from two prices. The rows below prove it by CHANGING that
//      one field and watching both follow.
//   2. THE CPU SIDE IS UNCHANGED. The opponent's price is not the player's
//      business; the prop never reaches that side, and the `!isRight` conjunct
//      holds even if a caller passes it to both.
//   3. FLAG OFF IS BYTE-IDENTICAL. Without the prop the row emits exactly the
//      markup it shipped — asserted as a string comparison against a render of
//      the same asset, not as an absence of the dollar sign.
//
// renderToString: the markup is the whole claim.

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import TacticalRow, { AssetSide } from './TacticalRow';
import { computeProximity } from './computeProximity';
import { BATTLE_VIEW_COPY } from '../../screens/battleView/battleViewCopy';

const strip = (h) => h.replace(/<!-- -->/g, '');

const PLAYER = {
  symbol: 'NVDA',
  priceChange: 2.34,
  thresholdPriceChange: 2.34,
  baseATR: 2.5,
  points: 24,
  badges: [],
  history: { maxMultiplier: 0.9, minMultiplier: 0 },
  currentPrice: 264.75,
  thresholdBaseline: 258.7,
  openPrice: 258.7,
};
const CPU = { ...PLAYER, symbol: 'AMD', currentPrice: 141.2, points: 11 };

const row = (props = {}) => strip(renderToString(
  <TacticalRow leftAsset={PLAYER} rightAsset={CPU} tier="star" {...props} />,
));

describe('D-85 — the current price on the player\'s row', () => {
  it('renders `$264.75` beside the % change under the flag', () => {
    const html = row({ showCurrentPrice: true });
    expect(html).toContain('data-row-price="NVDA"');
    expect(html).toContain('$264.75');
    expect(html).toContain('▲ +2.34%');
  });

  it('uses the SAME formatter the Why? panel two lines below uses', () => {
    // `src/utils/formatters.js`'s `formatPrice` is `$${n.toFixed(2)}` — no
    // thousands separator — so it read `$1234.50` on the row beside
    // `Entry $1,234.50` in the panel (review L5-F6). One formatter now.
    expect(row({ showCurrentPrice: true })).toContain(BATTLE_VIEW_COPY.price(PLAYER.currentPrice));
    expect(BATTLE_VIEW_COPY.price(264.75)).toBe('$264.75');
    expect(BATTLE_VIEW_COPY.price(1234.5)).toBe('$1,234.50');
    expect(row({ showCurrentPrice: true, leftAsset: { ...PLAYER, currentPrice: 1234.5 } }))
      .toContain('$1,234.50');
  });

  it('ONE SOURCE — the dollar and the proximity move together off `currentPrice` (§9)', () => {
    // The same field, changed once: the row's price follows it, and so does
    // the proximity the row computes for the label and hands the Why? panel.
    const moved = { ...PLAYER, currentPrice: 271.4 };
    expect(row({ showCurrentPrice: true, leftAsset: moved })).toContain('$271.40');
    expect(row({ showCurrentPrice: true, leftAsset: moved })).not.toContain('$264.75');

    // …and the PROXIMITY moves with it. The old form of this row passed
    // `dailyLevels: undefined`, which makes `computeDollarInfo` return null and
    // the two results byte-identical — it then asserted only `toBeTruthy()` on
    // each, so no defect could fail it (review L4-F3). With levels present the
    // dollar branch runs and the two genuinely differ.
    // The cron's own level keys (computeProximity's LABEL_TO_LEVEL_KEY).
    const levels = { baggerBomb: 275, bust: 250 };
    const inputs = (asset) => ({
      priceChange: asset.thresholdPriceChange, baseATR: asset.baseATR,
      history: asset.history, dailyLevels: levels, currentPrice: asset.currentPrice,
    });
    const before = computeProximity(inputs(PLAYER));
    const after = computeProximity(inputs(moved));
    expect(before.dollarInfo).toBeTruthy();
    expect(after.dollarInfo).toBeTruthy();
    expect(after.dollarInfo).not.toEqual(before.dollarInfo);
    // The row renders the SAME field both derivations consumed.
    expect(row({ showCurrentPrice: true, leftAsset: { ...PLAYER, dailyLevels: levels } }))
      .toContain(BATTLE_VIEW_COPY.price(PLAYER.currentPrice));
  });

  it('the CPU side never shows a price, whichever way the prop arrives', () => {
    const html = row({ showCurrentPrice: true });
    expect(html).not.toContain('data-row-price="AMD"');
    expect(html).not.toContain('$141.20');
    // …and directly, on the side itself: `!isRight` is the conjunct that holds.
    const right = strip(renderToString(<AssetSide asset={CPU} isRight showCurrentPrice />));
    expect(right).not.toContain('data-row-price');
    expect(right).not.toContain('$141.20');
  });

  it('never renders `$0.00` — a missing or non-positive price shows nothing', () => {
    for (const currentPrice of [undefined, null, 0, -1, Number.NaN, '264.75']) {
      const html = strip(renderToString(
        <AssetSide asset={{ ...PLAYER, currentPrice }} showCurrentPrice />,
      ));
      expect(html).not.toContain('data-row-price');
      expect(html).not.toContain('$0.00');
    }
  });

  it('FLAG OFF — the row markup carries none of the flag path', () => {
    // The whole-string self-comparison this row used to open with compared two
    // renders down the SAME code path and could not fail (review L4-F4). The
    // byte-identity claim is discharged where it can be: the flag-off golden,
    // `AgentBattleScreen.flagOff.golden.test.jsx`, which reds when the screen
    // passes `showCurrentPrice` unconditionally. What this row proves is that
    // the wrapper the flag adds is absent, not merely the dollar.
    expect(row()).toBe(row({ showCurrentPrice: false }));
    expect(row()).not.toContain('align-items:baseline;gap:6px');
    expect(row()).not.toContain('data-row-price');
    expect(row()).not.toContain('$264.75');
  });

  it('MUTATION ROW — the flag is what gates it, not the presence of a price', () => {
    // Deleting the `showCurrentPrice` conjunct would light the price up
    // flag-off, where every asset already carries `currentPrice`.
    expect(row()).not.toContain('264.75');
    expect(row({ showCurrentPrice: true })).toContain('264.75');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Shadow vs CPU quote integrity (spec SHADOW_CPU_PLACEHOLDER_PRICE_SPEC_V1_6.md
// §7.1, OFF-6, ON-ROW; build record
// docs/audits/20261002_SHADOW_CPU_QUOTE_INTEGRITY_BUILD_REVIEW.md).
//
// OFF-6 — with none of the new optional props, the row's serialized markup is
// byte-identical to the pre-build SHA. The digests below were captured there
// by running this file with SHADOW_OFF_CAPTURE_DIR set.
// ─────────────────────────────────────────────────────────────────────────────

const OFF_REFERENCE_SHA = '44d0c63eba4e3099552d3ec3dbde6a89660a7e06';
const CAPTURE_DIR = process.env.SHADOW_OFF_CAPTURE_DIR || '';
const digest = (s) => ({ sha256: createHash('sha256').update(s).digest('hex'), length: s.length });
function offReference(name, actual, expected) {
  if (CAPTURE_DIR) {
    writeFileSync(path.join(CAPTURE_DIR, `tacticalRow.${name}.json`), JSON.stringify(actual, null, 1));
    return;
  }
  expect(actual, `OFF-6 reference ${name} (captured at ${OFF_REFERENCE_SHA})`).toEqual(expected);
}

const OFF_VARIANTS = {
  default: { leftAsset: PLAYER, rightAsset: CPU, tier: 'star' },
  currentPrice: { leftAsset: PLAYER, rightAsset: CPU, tier: 'star', showCurrentPrice: true },
  whyClosed: {
    leftAsset: PLAYER, rightAsset: CPU, tier: 'core', onWhy: () => {}, whyOpen: false,
    whyLabel: 'Why?', whyName: 'Why? NVDA', whyId: 'why-core-0', renderWhy: () => <div data-why-panel="1">panel</div>,
  },
  whyOpen: {
    leftAsset: PLAYER, rightAsset: CPU, tier: 'core', onWhy: () => {}, whyOpen: true, showCurrentPrice: true,
    whyLabel: 'Why?', whyName: 'Why? NVDA', whyId: 'why-core-0', renderWhy: () => <div data-why-panel="1">panel</div>,
  },
  cashAndEmpty: { leftAsset: { symbol: 'CASH', isCash: true, previousAsset: 'TSLA' }, rightAsset: null, tier: 'support' },
  negativeWithBadges: {
    leftAsset: { ...PLAYER, priceChange: -6.4, thresholdPriceChange: -6.4, points: -71, badges: ['bust', 'crash'], history: { maxMultiplier: 0, minMultiplier: -2.6 } },
    rightAsset: { ...CPU, priceChange: 0, thresholdPriceChange: 0, points: 0 }, tier: 'support', isCryptoSlot: true,
  },
  bagger: { leftAsset: PLAYER, rightAsset: CPU, tier: 'star', baggerBurst: true, baggerFooter: 'Bagger hit · +15 banked', reducedMotion: false },
  swapTarget: { leftAsset: PLAYER, rightAsset: CPU, tier: 'star', swapTargetMode: true, onLeftAssetSelect: () => {}, opponentDimmed: true },
  clickable: { leftAsset: PLAYER, rightAsset: CPU, tier: 'star', onSymbolClick: () => {}, onPointsClick: () => {} },
};

// BEGIN GENERATED OFF REFERENCES — captured at the pre-build SHA 44d0c63eba4e3099552d3ec3dbde6a89660a7e06 (9 entries).
// Regenerate ONLY by re-running this file's OFF rows at that SHA with
// SHADOW_OFF_CAPTURE_DIR set; never by blessing build output.
const OFF6 = {
 "bagger": {
  "length": 7802,
  "sha256": "0f783a5e23a5a51b1d4b68c0d7c43e907acc02c178fad83cf7b2eb524f533f29"
 },
 "cashAndEmpty": {
  "length": 1110,
  "sha256": "819e21e98f0dd20d3e451e2f8a53919fdb0724e58c644069fdeabb598f52c295"
 },
 "clickable": {
  "length": 7394,
  "sha256": "4ce2f18a362c75707a274fd0a5631bb7b71558c94d971910db113707e97c8655"
 },
 "currentPrice": {
  "length": 7584,
  "sha256": "9e670d208ec0d4070f3a4272936496da0627c259cf7389ff653988a04f415fdf"
 },
 "default": {
  "length": 7394,
  "sha256": "7716fd3c6deda62f0ddf2d2674af5613064debb58d39eb4390277313fea9cdb8"
 },
 "negativeWithBadges": {
  "length": 8000,
  "sha256": "1f11e5dd0b1c6cfc4f26261482c7ddc9fac16f90c25915cc469910eb868581c1"
 },
 "swapTarget": {
  "length": 7556,
  "sha256": "cee570892a6990d2f0bf55415eedcebdabf66502acef5dbc45c1151ca9040a60"
 },
 "whyClosed": {
  "length": 7718,
  "sha256": "7069667440cb079a31c697a34c387b2166b5e62dccb55531a85f2885f966b241"
 },
 "whyOpen": {
  "length": 7940,
  "sha256": "b5954aa8705ea7715e41ce68b129bdd1e7f0bf5510223ca098d4b07cb21838b3"
 }
};
// END GENERATED OFF REFERENCES

describe('OFF-6 — TacticalRow default markup is byte-identical to the pre-build SHA', () => {
  for (const [name, props] of Object.entries(OFF_VARIANTS)) {
    it(`OFF ${name}`, () => {
      offReference(name, digest(strip(renderToString(<TacticalRow {...props} />))), OFF6[name]);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ON-ROW — the optional availability contract (§7.1)
// ─────────────────────────────────────────────────────────────────────────────

const UNAVAILABLE = (symbol, over = {}) => ({
  symbol,
  baseATR: 2.5,
  openPrice: 150,
  quoteAvailability: { status: 'unavailable', reason: 'missing', label: 'Quote unavailable', lastQuoteLabel: null, entryLabel: 'Entry $150.00', ...over },
});

describe('ON-ROW — an unavailable side withholds every current-derived channel together', () => {
  it('both sides: symbol and status stay; percent, price, points, badges, fuse, proximity and radiance are absent', () => {
    const html = row({ leftAsset: UNAVAILABLE('NVDA'), rightAsset: UNAVAILABLE('AMD'), showCurrentPrice: true });
    expect(html).toContain('data-quote-unavailable="NVDA"');
    expect(html).toContain('data-quote-unavailable="AMD"');
    expect(html.match(/Quote unavailable/g)).toHaveLength(2);
    expect(html).not.toMatch(/[▲▼]/);
    expect(html).not.toContain('%');
    expect(html).not.toContain('data-row-price');
    expect(html).not.toContain('$0.00');
    expect(html).not.toMatch(/>[+-]?\d+<\/span>/); // no DataStrike points
    // The recorded entry is the player's line only.
    expect(html).toContain('data-row-entry="NVDA"');
    expect(html).not.toContain('data-row-entry="AMD"');
  });

  it('a dated stale label shows on the player side only; the CPU side keeps the plain status', () => {
    const label = 'Last quote $153.50 · as of Oct 1, 12:50 PM EDT';
    const html = row({
      leftAsset: UNAVAILABLE('NVDA', { reason: 'configured-fallback', lastQuoteLabel: label }),
      rightAsset: UNAVAILABLE('AMD', { reason: 'configured-fallback', lastQuoteLabel: label }),
    });
    expect(html.match(/Last quote \$153\.50/g)).toHaveLength(1);
    expect(html).toContain('Quote unavailable');
  });

  it('the click payload names the side only when the screen opts in (the legacy callback is untouched)', async () => {
    const { JSDOM } = await import('jsdom');
    const dom = new JSDOM('<!doctype html><div id="r"></div>');
    const prevWindow = globalThis.window;
    const prevDocument = globalThis.document;
    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
    try {
      const { createRoot } = await import('react-dom/client');
      const { act } = React;
      globalThis.IS_REACT_ACT_ENVIRONMENT = true;
      const calls = [];
      const host = dom.window.document.getElementById('r');
      const r = createRoot(host);
      const clickAll = () => {
        for (const el of host.querySelectorAll('div')) {
          if (el.firstChild && (el.firstChild.textContent === 'NVDA' || el.firstChild.textContent === 'AMD') && el.style.cursor === 'pointer') {
            act(() => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
          }
        }
      };
      act(() => { r.render(<TacticalRow leftAsset={PLAYER} rightAsset={UNAVAILABLE('AMD')} tier="star" onSymbolClick={(...a) => calls.push(a)} reportClickSide />); });
      clickAll();
      expect(calls.map((a) => [a[0].symbol, a[1]])).toEqual([['NVDA', { side: 'player' }], ['AMD', { side: 'cpu' }]]);
      calls.length = 0;
      act(() => { r.render(<TacticalRow leftAsset={PLAYER} rightAsset={CPU} tier="star" onSymbolClick={(...a) => calls.push(a)} />); });
      clickAll();
      expect(calls.map((a) => a.length)).toEqual([1, 1]);
      act(() => r.unmount());
    } finally {
      globalThis.window = prevWindow;
      globalThis.document = prevDocument;
    }
  });

  it('a usable side in the same row renders exactly as shipped next to an unavailable one', () => {
    const mixed = row({ leftAsset: PLAYER, rightAsset: UNAVAILABLE('AMD'), showCurrentPrice: true });
    expect(mixed).toContain('$264.75');
    expect(mixed).toContain('▲ +2.34%');
    expect(mixed).toContain('data-quote-unavailable="AMD"');
  });

  it('MUTATION ROW — withholding is a branch, not a zero: an unavailable side never renders +0 / +0.00%', () => {
    const html = row({ leftAsset: { ...UNAVAILABLE('NVDA'), priceChange: 0, points: 0 }, rightAsset: null });
    expect(html).not.toContain('+0.00%');
    expect(html).not.toMatch(/>\+0</);
  });
});
