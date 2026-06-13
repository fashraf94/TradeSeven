// src/utils/flat6BattleEnrichment.js
//
// P7 — the flat6 tournament battle view's per-asset enrichment, factored into
// its OWN node-clean module so the new battle view is its own component
// (founder ruling, P7 Stage 0) and the live tiered BaggerBomb screen
// (AgentBattleScreen) stays 100% untouched.
//
// SCORING DISCIPLINE (BUILD_RULES §4): this util CALLS the canonical scorer
// `calculateAssetScoreV3` — it NEVER copies scoring math. The only logic here
// is the input-prep GLUE (open-price selection, priceChange, the activation-day
// threshold-baseline gate, the persisted-peak merge), mirrored field-for-field
// from AgentBattleScreen.enrichAsset (src/screens/AgentBattleScreen.jsx:539-644
// — the behavior of record) and locked by the co-located flat6-fixture +
// scorer-contract parity test. Pure + node-clean (imports only baggerBombUtils,
// whose transitive surface is the canonical constants) so the view's data layer
// is unit-tested in Node without a DOM — the testable seam the phase requires.
//
// flat6 facts it relies on (P4 doc shape, verified at P7 Stage 0): six assets
// in 2/2/2 star/core/support SLOT LABELS (not tiers), each stamped
// tierMultiplier:1, opponent:null, agents long-only. The scorer's per-asset
// tierMultiplier override resolves these to flat 1x by construction.

import { calculateAssetScoreV3 } from './baggerBombUtils';

// Mirrors AgentBattleScreen's DEFAULT_THRESHOLD (researchAssetBuilder.js:6) and
// calculateAssetScoreV3's own baseATR default — kept local so this module stays
// node-clean (no client-util import).
export const DEFAULT_THRESHOLD = 2.5;

// flat6 renders the star/core/support arrays as honest LINEUP SLOTS, never tier
// names (the P4 disposition: the labels survived as slot labels only). Mirrors
// AgentBattleScreen.FLAT6_TIERS so participant and the legacy stopgap read
// identically.
export const FLAT6_SLOT_ORDER = ['star', 'core', 'support'];
export const FLAT6_SLOT_LABELS = {
  star: 'Lineup 1–2',
  core: 'Lineup 3–4',
  support: 'Lineup 5–6',
};

/** ET calendar date string for an ISO/epoch/Timestamp value (defensive .toDate). */
function toEtDate(raw) {
  const d = raw?.toDate?.() ?? new Date(raw);
  return d.toLocaleDateString('en-US', { timeZone: 'America/New_York' });
}

/**
 * Activation-day gate — mirrors AgentBattleScreen:590-595 (and the server
 * boundary at agent-evaluate.js): on the activation day the threshold/badge
 * baseline is the ENTRY price, so a stock that gapped from its prior close and
 * then sat flat from entry can't fabricate a badge while the display reads
 * +0.00%. previousClose only takes over on day 2+. Wall-clock ET-date compare
 * (not timing.currentTradingDay, which can lag a skipped nightly run).
 */
export function isFlat6ActivationDay(battle, now = Date.now()) {
  const activationTs = battle?.activatedAt || battle?.createdAt;
  return activationTs ? toEtDate(now) === toEtDate(activationTs) : true;
}

/**
 * Enrich one flat6 asset to its render row. Pure; mirrors enrichAsset
 * field-for-field and CALLS calculateAssetScoreV3 for all scoring.
 *
 * @param {Object} asset  one portfolio asset (carries symbol, tierMultiplier, optional swapPrice/direction)
 * @param {Object} ctx    { startingPrices, effectivePrices, thresholds, previousClosePrices, persistedHistory, isActivationDay, slotKey }
 * @returns {Object|null} { ...asset, currentPrice, openPrice, priceChange, thresholdPriceChange, baseATR, multiplier, points, basePoints, bonusPoints, badges, history }
 */
export function enrichFlat6Asset(asset, {
  startingPrices = {},
  effectivePrices = {},
  thresholds = {},
  previousClosePrices = {},
  persistedHistory = {},
  isActivationDay: activationDay = true,
  slotKey,
} = {}) {
  if (!asset || !asset.symbol) return null;

  const openPrice = asset.swapPrice || startingPrices[asset.symbol] || asset.price || 0;
  const curPrice = effectivePrices[asset.symbol] || openPrice;
  const threshold = thresholds[asset.symbol] || {};
  const baseATR = threshold.threshold || DEFAULT_THRESHOLD;

  // Agents are LONG-ONLY at V1 (flat6 docs never carry direction:'short' on
  // agent assets — P7 Stage 0). So no pre-negation here: priceChange/
  // thresholdPriceChange are the raw long moves, and the canonical scorer owns
  // any direction sign ONCE (calculateAssetScoreV3 negates internally for a
  // short). For the only real case — long — this is byte-identical to
  // AgentBattleScreen.enrichAsset; we deliberately do NOT carry that screen's
  // dormant short double-negation (pre-negate + scorer-negate) into the new view.
  const priceChange = openPrice > 0 ? ((curPrice - openPrice) / openPrice) * 100 : 0;

  // Threshold baseline matches the asset's entry: swapPrice for swapped-in
  // names (no retroactive credit for pre-swap moves), else entry-on-activation /
  // previousClose-on-day-2+ (the original order preserved).
  const thresholdBaseline = asset.swapPrice
    || (activationDay
      ? (startingPrices[asset.symbol] || previousClosePrices[asset.symbol] || openPrice)
      : (previousClosePrices[asset.symbol] || startingPrices[asset.symbol] || openPrice));
  const thresholdPriceChange = thresholdBaseline > 0
    ? ((curPrice - thresholdBaseline) / thresholdBaseline) * 100
    : priceChange;

  const multiplier = baseATR > 0 ? thresholdPriceChange / baseATR : 0;

  // Merge server-persisted peaks (agent-evaluate cron) with the live multiplier
  // so threshold bonuses stay visible when price reverses between ticks.
  const history = {
    maxMultiplier: Math.max(persistedHistory.maxMultiplier || 0, multiplier > 0 ? multiplier : 0),
    minMultiplier: Math.min(persistedHistory.minMultiplier || 0, multiplier < 0 ? multiplier : 0),
  };

  const score = calculateAssetScoreV3(
    { ...asset, baseATR, tier: slotKey ?? asset.tier },
    priceChange,
    history,
    {},
    thresholdPriceChange,
  );

  return {
    ...asset,
    slotKey,
    openPrice,
    currentPrice: curPrice,
    priceChange,
    thresholdPriceChange,
    baseATR,
    multiplier,
    points: score.totalPoints,
    basePoints: score.basePoints,
    bonusPoints: score.bonusPoints,
    badges: score.badges,
    history,
  };
}

/** The six symbols of a flat6 battle (for price subscription). */
export function flat6BattleSymbols(battle) {
  const p = battle?.portfolio || {};
  const out = [];
  for (const key of FLAT6_SLOT_ORDER) {
    for (const a of p[key] || []) {
      if (a?.symbol) out.push(a.symbol);
    }
  }
  return out;
}

/**
 * Build the full battle view model from a flat6 doc + live prices. Pure (given
 * `now`). The 2/2/2 slots carry their LINEUP labels; the running agent score is
 * Σ enriched points + banked (closed-trade) points — the same identity the live
 * screen uses so the client never diverges from the cron's scoreState.
 */
export function buildFlat6BattleModel(battle, {
  effectivePrices = {},
  previousClosePrices = {},
  now = Date.now(),
  // The caller may pass a pre-computed activation-day flag so a memoized model
  // recomputes when the ET day flips (a stable boolean dep) rather than
  // capturing a stale `now` inside a price-keyed memo (P7 code review).
  isActivationDay,
} = {}) {
  if (!battle) return null;

  const portfolio = battle.portfolio || {};
  const startingPrices = portfolio.startingPrices || {};
  const thresholds = battle.scoring?.thresholds || {};
  const activationDay = typeof isActivationDay === 'boolean'
    ? isActivationDay
    : isFlat6ActivationDay(battle, now);

  const slots = FLAT6_SLOT_ORDER.map((key) => ({
    key,
    label: FLAT6_SLOT_LABELS[key],
    assets: (portfolio[key] || [])
      .map((a) => enrichFlat6Asset(a, {
        startingPrices,
        effectivePrices,
        thresholds,
        previousClosePrices,
        persistedHistory: battle.thresholdHistory?.[a?.symbol] || {},
        isActivationDay: activationDay,
        slotKey: key,
      }))
      .filter(Boolean),
  }));

  const enrichedAll = slots.flatMap((s) => s.assets);
  const activeScore = enrichedAll.reduce((sum, a) => sum + (a?.points || 0), 0);
  const bankedScore = (battle.trades || []).reduce(
    (sum, t) => sum + (Number.isFinite(t?.lockedPoints) ? t.lockedPoints : 0),
    0,
  );

  return {
    slots,
    holdingsCount: enrichedAll.length,
    activeScore: Math.round(activeScore),
    bankedScore: Math.round(bankedScore),
    liveAgentScore: Math.round(activeScore + bankedScore),
    persistedScore: battle.scoreState?.currentScore ?? 0,
    isComplete: battle.status === 'completed',
  };
}

/**
 * Which agent-layer score to DISPLAY (mirrors AgentBattleScreen:712-716):
 * before prices load, trust the cron's persisted score; once a completed
 * battle reloads prices post-market, freeze on the persisted final; otherwise
 * the live recompute. Pure.
 */
export function resolveDisplayScore({ pricesLoaded, isComplete, liveAgentScore, persistedScore }) {
  // Always integer for the headline (liveAgentScore is already rounded; the
  // persisted cron score is rounded here so the headline never flickers from a
  // fractional persisted value to a rounded live one).
  if (!pricesLoaded) return Math.round(persistedScore || 0);
  if (isComplete) return Math.round(persistedScore ?? liveAgentScore);
  return liveAgentScore;
}
