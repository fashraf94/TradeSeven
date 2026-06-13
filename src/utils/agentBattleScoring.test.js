// src/utils/agentBattleScoring.test.js
//
// P8 hygiene item 1 — the AgentBattleScreen short double-negation.
//
// AgentBattleScreen.enrichAsset (and its V4-training sibling) apply the
// direction sign to priceChange/thresholdPriceChange/multiplier/history in the
// glue, THEN historically passed `direction` into calculateAssetScoreV3 too —
// which negates priceChange/thresholdPriceChange a SECOND time. Net for a
// short: the sign cancels and the position scores like a long (a silent
// sign-flip). It was dormant on AgentBattleScreen (agents are long-only) but
// load-bearing for any short.
//
// SCOPE: P8 fixes AgentBattleScreen ONLY. BaggerBombTrainingBattleViewV4.jsx
// still carries the SAME double-negation and IS reachable (users can short
// crypto there) — it is tracked as a SEPARATE ticket (a shipped-game bug, out
// of P8/tournament scope; see docs/LAUNCH_READINESS_WATCH_LEDGER.md X1).
//
// This battery locks the contract the corrected glue relies on:
//   1. the canonical scorer negates direction EXACTLY ONCE (the source of
//      truth for the sign), and
//   2. the enrichAsset glue convention — caller adjusts the sign once, then
//      calls the scorer WITHOUT direction — produces correct, sign-consistent
//      scores for both long and short, and is byte-identical to the old call
//      on the long path (so the fix is provably safe for the live tiered game).
//
// Node-clean: imports only the canonical scorer (BUILD_RULES §4 — the scorer is
// CALLED, never copied).

import { describe, it, expect } from 'vitest';
import { calculateAssetScoreV3 } from './baggerBombUtils';

const ASSET = { symbol: 'TST', tierMultiplier: 1 }; // tierMultiplier:1 isolates the direction sign from tier scaling

// ── The corrected enrichAsset glue (matches AgentBattleScreen.jsx AFTER the P8
//    fix): the caller owns the direction sign ONCE; the scorer is called
//    WITHOUT `direction`. (BaggerBombTrainingBattleViewV4.jsx still uses the
//    `scoreBuggy` shape below — its fix is the separate ticket noted above.) ──
function scoreCorrected({ direction, openPrice, curPrice, baseATR = 5 }) {
  let priceChange = openPrice > 0 ? ((curPrice - openPrice) / openPrice) * 100 : 0;
  if (direction === 'short') priceChange = -priceChange;
  let thresholdPriceChange = priceChange; // entry-baseline case
  const multiplier = baseATR > 0 ? thresholdPriceChange / baseATR : 0;
  const history = {
    maxMultiplier: multiplier > 0 ? multiplier : 0,
    minMultiplier: multiplier < 0 ? multiplier : 0,
  };
  // direction intentionally omitted — the fix.
  return calculateAssetScoreV3(
    { ...ASSET, baseATR, tier: 'support', direction: undefined },
    priceChange, history, {}, thresholdPriceChange,
  );
}

// ── The OLD buggy glue: same single caller-adjustment, but ALSO forwards
//    `direction` to the scorer (the double-negation). Kept only to prove the
//    fix changes the short path and leaves the long path untouched. ──
function scoreBuggy({ direction, openPrice, curPrice, baseATR = 5 }) {
  let priceChange = openPrice > 0 ? ((curPrice - openPrice) / openPrice) * 100 : 0;
  if (direction === 'short') priceChange = -priceChange;
  let thresholdPriceChange = priceChange;
  if (direction === 'short') thresholdPriceChange = -thresholdPriceChange; // the old extra block too
  const multiplier = baseATR > 0 ? thresholdPriceChange / baseATR : 0;
  const history = {
    maxMultiplier: multiplier > 0 ? multiplier : 0,
    minMultiplier: multiplier < 0 ? multiplier : 0,
  };
  return calculateAssetScoreV3(
    { ...ASSET, baseATR, tier: 'support', direction }, // bug: forwards direction
    priceChange, history, {}, thresholdPriceChange,
  );
}

describe('calculateAssetScoreV3 — direction is negated EXACTLY ONCE (the contract)', () => {
  it('long: a +2% raw move scores positive base points', () => {
    const s = calculateAssetScoreV3({ ...ASSET, baseATR: 5, direction: 'long' }, 2, {}, {}, 2);
    expect(s.basePoints).toBe(20); // 2 * 10 * tierMultiplier(1)
  });

  it('short: a RAW negative move (price fell — the short wins) scores POSITIVE', () => {
    // The flat6/scorer-owns convention: pass the raw long-move (-2) + direction.
    const s = calculateAssetScoreV3({ ...ASSET, baseATR: 5, direction: 'short' }, -2, {}, {}, -2);
    expect(s.basePoints).toBe(20); // scorer negates once: -(-2) * 10 = +20
  });

  it('short: a RAW positive move (price rose — the short loses) scores NEGATIVE', () => {
    const s = calculateAssetScoreV3({ ...ASSET, baseATR: 5, direction: 'short' }, 2, {}, {}, 2);
    expect(s.basePoints).toBe(-20);
  });

  it('regression: pre-negating AND forwarding direction double-negates (the bug)', () => {
    // An already-position-adjusted +2 (winning short) + direction → -20 (WRONG).
    const s = calculateAssetScoreV3({ ...ASSET, baseATR: 5, direction: 'short' }, 2, {}, {}, 2);
    expect(s.basePoints).toBe(-20); // documents exactly why the glue must not forward direction
  });
});

describe('AgentBattleScreen.enrichAsset glue — corrected sign behavior', () => {
  it('LONG path locked: a winning long is positive, a losing long is negative', () => {
    expect(scoreCorrected({ direction: 'long', openPrice: 100, curPrice: 102 }).basePoints).toBe(20);
    expect(scoreCorrected({ direction: 'long', openPrice: 100, curPrice: 98 }).basePoints).toBe(-20);
  });

  it('SHORT path corrected: a winning short (price fell) is POSITIVE', () => {
    const s = scoreCorrected({ direction: 'short', openPrice: 100, curPrice: 98 });
    expect(s.basePoints).toBe(20);
    expect(s.totalPoints).toBeGreaterThan(0);
  });

  it('SHORT path corrected: a losing short (price rose) is NEGATIVE', () => {
    expect(scoreCorrected({ direction: 'short', openPrice: 100, curPrice: 102 }).basePoints).toBe(-20);
  });

  it('the fix changes the SHORT path (winning short: corrected +, buggy −)', () => {
    const corrected = scoreCorrected({ direction: 'short', openPrice: 100, curPrice: 98 });
    const buggy = scoreBuggy({ direction: 'short', openPrice: 100, curPrice: 98 });
    expect(corrected.basePoints).toBe(20);
    expect(buggy.basePoints).toBe(-20); // the silent sign-flip the fix removes
    expect(Math.sign(corrected.basePoints)).not.toBe(Math.sign(buggy.basePoints));
  });

  it('the fix is BYTE-IDENTICAL on the LONG path (forwarding direction is a no-op for longs)', () => {
    for (const curPrice of [102, 98, 100, 110, 90]) {
      const corrected = scoreCorrected({ direction: 'long', openPrice: 100, curPrice });
      const buggy = scoreBuggy({ direction: 'long', openPrice: 100, curPrice });
      expect(corrected).toEqual(buggy);
    }
  });
});
