// src/utils/leagueStarMeter.js
//
// League Battle View V2 — the per-holding METER-DATA READER (Phase 1, pure +
// node-clean). Produces the locked design star contract for every holding:
//   { tk, tier, dir, mult, banked, points, badge, state, justIn }
// for the agent's six (teal, watch-only) and the user's three (blue, controls).
//
// SCORING DISCIPLINE (BUILD_RULES §4): no scoring math lives here. The agent
// stars REUSE buildFlat6BattleModel (which calls calculateAssetScoreV3); the
// user stars REUSE scorePick from the non-fenced user scorer. The only logic is
// the field map from those results to the design contract.
//
// CROSS-TREE IMPORT (founder item 1, confirmed 2026-06-24): this module imports
// api/_utils/tournamentUserScoring.js into the client bundle. That direction is
// established precedent (tickerSearchMatch.js, SignalDropEntry.jsx,
// useTrainingDraft.js, fantasyTimesDetector.js, SeasonReview.jsx all import
// api/_utils/*), Vite/ESLint carry no boundary rule, and that module's
// transitive surface (→ calculateAssetScoreV3 → baggerBombScoring) is node-clean
// (no firebase-admin, no node builtins; loadAtrPercentiles, the only db fn, is
// not on this path). The co-located test loading clean in Node is the HARD
// dependency-surface guard. Copying the scorer stays off the table (§4).
//
// PREVIEW vs AUTHORITY (founder item 2): the user-pick live multiplier here is a
// PREVIEW. Lacking the rankings doc client-side, user picks default to the
// port-contract ATR (2.5 stock / 5.0 crypto) unless the caller supplies a real
// per-symbol ATR; the nightly banking pass (precise percentile ATR) is
// AUTHORITATIVE for what actually banks. We validate display-vs-bank drift on
// real data in the component phase. If it ever drifts far enough to mislead
// "will it hit", the fix is feeding the client the real ATR for display —
// NEVER loosening the thresholds.

import { buildFlat6BattleModel } from './flat6BattleEnrichment';
import { scorePick } from '../../api/_utils/tournamentUserScoring.js';
import { deriveStarState } from './leagueStarState';
import { BAGGER_TIERS, BUST_TIERS } from '../constants/baggerBombScoring';

// User picks have no conviction tier — the scorer's `support` fallback (1.0x)
// applies (tournamentUserScoring.js:21-24). Default ATR is the port-contract
// fallback when the caller can't supply a per-symbol value.
const USER_TIER = 'support';
const DEFAULT_USER_ATR_STOCK = 2.5;
const DEFAULT_USER_ATR_CRYPTO = 5.0;

const num = (x) => (Number.isFinite(x) ? x : 0);

/** The headline badge LABEL for a star, aligned with its state (or null). */
function topBadgeLabel(badges, state) {
  const list = Array.isArray(badges) ? badges : [];
  if (state === 'busted') {
    for (let i = BUST_TIERS.length - 1; i >= 0; i--) {
      if (list.includes(BUST_TIERS[i].key)) return BUST_TIERS[i].label;
    }
  }
  if (state === 'hit') {
    for (let i = BAGGER_TIERS.length - 1; i >= 0; i--) {
      if (list.includes(BAGGER_TIERS[i].key)) return BAGGER_TIERS[i].label;
    }
  }
  return null; // edge / danger / heating / quiet carry no crossed badge
}

/**
 * Map one enriched flat6 (agent) asset → the star contract. `banked` is the
 * stuck badge bonus (bonusPoints) of the LIVE position; `points` is its total.
 * @param {Object} enriched - a buildFlat6BattleModel slot asset
 * @param {{ justIn?: boolean }} [opts]
 * @returns {Object} StarRow
 */
export function readAgentStar(enriched, { justIn = false } = {}) {
  const mult = num(enriched?.multiplier);
  const badges = Array.isArray(enriched?.badges) ? enriched.badges : [];
  const dir = enriched?.direction || 'long';
  const state = deriveStarState({ multiplier: mult, badges, direction: dir });
  return {
    tk: enriched?.symbol ?? null,
    tier: enriched?.slotKey ?? enriched?.tier ?? USER_TIER,
    dir,
    mult,
    banked: num(enriched?.bonusPoints),
    points: num(enriched?.points),
    badge: topBadgeLabel(badges, state),
    state,
    justIn: justIn === true,
  };
}

/**
 * The agent's six stars from a flat6 battle doc + live prices. `justIn` flags a
 * holding swapped IN on the most recent swap day (the design's JUST IN chip),
 * derived from battle.trades[] (a heuristic the component phase can window).
 * @param {Object} battle
 * @param {Object} priceCtx - { effectivePrices, previousClosePrices, now, isActivationDay }
 * @returns {Object[]} StarRow[]
 */
export function readAgentStars(battle, priceCtx = {}) {
  const model = buildFlat6BattleModel(battle, priceCtx);
  if (!model) return [];
  const trades = Array.isArray(battle?.trades) ? battle.trades : [];
  const latestSwapDay = trades.reduce(
    (m, t) => (Number.isFinite(t?.swapDay) ? Math.max(m, t.swapDay) : m),
    0,
  );
  const justInSet = new Set(
    trades
      .filter((t) => t?.symbolIn && latestSwapDay > 0 && t.swapDay === latestSwapDay)
      .map((t) => t.symbolIn),
  );
  const rows = [];
  for (const slot of model.slots) {
    for (const asset of slot.assets) {
      rows.push(readAgentStar(asset, { justIn: justInSet.has(asset.symbol) }));
    }
  }
  return rows;
}

/**
 * Map one user pick (players[].picks[]) → the star contract via scorePick.
 * `banked` is the closed-leg banked points; `points` is banked + live.
 *
 * `mult`/`badge`/`state` describe the LIVE (open) leg — the meter's drama is the
 * open position riding toward its next threshold. A fully-SETTLED pick (no open
 * leg, e.g. the complete state) has `liveLegResult: null`, so it reports its
 * banked `points` with `mult: 0` and `state: 'quiet'` (no live movement). The
 * complete-state final badge is rendered from the banked snapshot in the
 * component phase, not here — Phase 1 is the live data layer.
 *
 * @param {Object} pick - { symbol, legs[] }
 * @param {{ quote?: {current:number}, baseATR?: number, justIn?: boolean }} opts
 * @returns {Object} StarRow
 */
export function readUserStar(pick, { quote, baseATR, justIn = false } = {}) {
  const result = scorePick({ pick, baseATR, quote });
  const live = result?.liveLegResult;
  const mult = num(live?.multiplier);
  const badges = Array.isArray(live?.badges) ? live.badges : [];
  const legs = pick?.legs || [];
  const dir = legs[legs.length - 1]?.direction || 'long';
  const state = deriveStarState({ multiplier: mult, badges, direction: dir });
  return {
    tk: pick?.symbol ?? null,
    tier: USER_TIER,
    dir,
    mult,
    banked: num(result?.bankedPoints),
    points: num(result?.totalPoints),
    badge: topBadgeLabel(badges, state),
    state,
    justIn: justIn === true,
  };
}

/**
 * The user's three stars from a group player + live quotes (keyed by symbol).
 * @param {Object} player - a group players[] entry with picks[]
 * @param {Object<string,{current:number}>} quotesBySymbol
 * @param {{ atrBySymbol?: Object<string,number>, cryptoSymbols?: Set<string> }} [opts]
 *   - atrBySymbol: real per-symbol ATR (preferred); else the port-contract default.
 *   - cryptoSymbols: optional set so unknown crypto picks default to 5.0 not 2.5.
 * @returns {Object[]} StarRow[]
 */
export function readUserStars(player, quotesBySymbol = {}, { atrBySymbol = {}, cryptoSymbols = null } = {}) {
  const picks = player?.picks || [];
  return picks.map((pick) => {
    const sym = pick?.symbol;
    const baseATR = Number.isFinite(atrBySymbol[sym])
      ? atrBySymbol[sym]
      : (cryptoSymbols?.has?.(sym) ? DEFAULT_USER_ATR_CRYPTO : DEFAULT_USER_ATR_STOCK);
    return readUserStar(pick, { quote: quotesBySymbol[sym], baseATR });
  });
}
