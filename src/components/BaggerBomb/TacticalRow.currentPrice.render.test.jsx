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
