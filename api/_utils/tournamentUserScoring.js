// api/_utils/tournamentUserScoring.js
//
// User-layer scorer for the League Tournament (P1b). Scoring math is NEVER
// copied here (BUILD_RULES §4): every leg is scored by the canonical
// calculateAssetScoreV3 from src/utils/baggerBombUtils.js (import precedent:
// api/cron/baggerbomb-v4-daily-scores.js:23; the co-located test's real
// import is the dependency-surface guard).
//
// What IS replicated, under test contract:
// - buildThresholds: the per-symbol threshold construction, a VERBATIM port
//   of the fenced math at api/agent/decide.js:584-592 (read-only source; the
//   co-located source-text tripwire breaks the suite loudly if that fenced
//   block ever drifts — the file itself is never edited).
// - resolveBaseATR: the stock-universe input enrichment formula
//   (api/agent/decide.js:794, `(atrPercentile || 0.5) * 8`) — input
//   enrichment, not scoring math.
//
// Scorer invocation contract (founder rulings, PR #484):
// - asset = {symbol, baseATR, direction} — tier absent, so the scorer's
//   CONVICTION_MULTIPLIERS.support fallback (1.0) applies
//   (baggerBombUtils.js:581).
// - priceChange measured from the LEG baseline, passed raw — the scorer
//   negates for shorts itself (baggerBombUtils.js:538-552); never pre-negate.
// - thresholdPriceChange: null ALWAYS (ruling #2) — thresholds measure from
//   the leg baseline via the verified null-fallback (baggerBombUtils.js:575-578).

import { calculateAssetScoreV3 } from '../../src/utils/baggerBombUtils.js';

/**
 * Per-symbol threshold construction — verbatim port of the fenced formula
 * (api/agent/decide.js:584-592; port-contract battery + tripwire co-located).
 *
 * @param {Array<{symbol: string, baseATR?: number, isCrypto?: boolean}>} assets
 * @returns {Object<string, {threshold: number, rallyThreshold: number, moonshotThreshold: number}>}
 */
export function buildThresholds(assets) {
  const thresholds = {};
  for (const asset of assets) {
    const baseATR = asset.baseATR || (asset.isCrypto ? 5.0 : 2.5);
    thresholds[asset.symbol] = {
      threshold: baseATR,
      rallyThreshold: baseATR * 1.5,
      moonshotThreshold: baseATR * 2.0,
    };
  }
  return thresholds;
}

/**
 * One read per banking run: indexIntelligence/stockRankings (the same doc the
 * seed pool comes from — api/admin/seed-tournament-group.js:56-65) reduced to
 * {SYMBOL: atrPercentile}. Null on any failure — callers then fall back to
 * the port-contract default (isCrypto ? 5.0 : 2.5) via resolveBaseATR.
 */
export async function loadAtrPercentiles(db) {
  try {
    const snap = await db.collection('indexIntelligence').doc('stockRankings').get();
    const stocks = snap.exists ? snap.data()?.stocks : null;
    if (!Array.isArray(stocks)) return null;
    const map = {};
    for (const stock of stocks) {
      const symbol = typeof stock?.symbol === 'string' ? stock.symbol.trim().toUpperCase() : '';
      if (symbol) map[symbol] = stock.atrPercentile;
    }
    return map;
  } catch (err) {
    console.error('[TournamentScoring] stockRankings read failed:', err.message);
    return null;
  }
}

/**
 * baseATR for one symbol — the input-enrichment formula of record
 * (api/agent/decide.js:794): `(atrPercentile || 0.5) * 8`. A symbol missing
 * from the rankings gets the formula's own default (0.5 * 8 = 4.0), exactly
 * as the fenced enrichment would produce for a stock without a percentile.
 * Rankings unavailable entirely → null, so buildThresholds' port-contract
 * fallback (2.5 stock / 5.0 crypto) applies downstream.
 *
 * @param {string} symbol
 * @param {Object<string, number>|null} atrPercentiles - from loadAtrPercentiles
 * @returns {number|null}
 */
export function resolveBaseATR(symbol, atrPercentiles) {
  if (atrPercentiles == null) return null;
  return (atrPercentiles[String(symbol || '').toUpperCase()] || 0.5) * 8;
}

/**
 * Score one leg from its baseline to `price` via the canonical scorer.
 *
 * `leg.thresholdHistory` is an append-only array whose LAST element is the
 * leg's current {maxMultiplier, minMultiplier} (the banking pass appends the
 * scorer's returned `history` once per day — see tournamentBanking.js, the
 * other side of this bridge).
 *
 * @returns {Object|null} the full calculateAssetScoreV3 result, or null when
 *   the leg has no usable baseline / price (unsettled legs score later).
 */
export function scoreLeg({ symbol, baseATR, leg, price }) {
  if (!Number.isFinite(leg?.baselinePrice) || leg.baselinePrice <= 0 || !Number.isFinite(price)) {
    return null;
  }
  const history = leg.thresholdHistory?.length > 0
    ? leg.thresholdHistory[leg.thresholdHistory.length - 1]
    : {};
  const priceChange = ((price - leg.baselinePrice) / leg.baselinePrice) * 100;
  return calculateAssetScoreV3(
    { symbol, baseATR, direction: leg.direction },
    priceChange,
    history,
    {},   // no server-side intraday extremes in the user layer
    null  // thresholdPriceChange: ALWAYS null (founder ruling #2)
  );
}

/**
 * Cumulative pick score (founder ruling #1): closed legs contribute their
 * bankedScore; the live (last) leg is scored from its baseline to
 * quote.current. Bank-pending closed legs (no bankedScore yet) and unsettled
 * live legs (null baseline) contribute 0 — the banking pass settles them
 * before calling this.
 *
 * @returns {{totalPoints: number, bankedPoints: number, livePoints: number,
 *   liveLegResult: Object|null}}
 */
export function scorePick({ pick, baseATR, quote }) {
  const legs = pick?.legs || [];
  let bankedPoints = 0;
  for (const leg of legs) {
    if (leg.closedAt !== undefined && Number.isFinite(leg.bankedScore)) {
      bankedPoints += leg.bankedScore;
    }
  }

  const liveLeg = legs.length > 0 ? legs[legs.length - 1] : null;
  let liveLegResult = null;
  if (liveLeg && liveLeg.closedAt === undefined) {
    liveLegResult = scoreLeg({ symbol: pick.symbol, baseATR, leg: liveLeg, price: quote?.current });
  }
  const livePoints = liveLegResult?.totalPoints ?? 0;

  return {
    totalPoints: bankedPoints + livePoints,
    bankedPoints,
    livePoints,
    liveLegResult,
  };
}
