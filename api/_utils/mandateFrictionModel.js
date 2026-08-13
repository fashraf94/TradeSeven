// api/_utils/mandateFrictionModel.js
//
// Spec 1 — Mandate Substrate — the FRICTION MODEL (§4.1, P3). Replaces P2's
// 'p2_zero_friction' placeholder. Commission $0 (V1); `slippageBps` and
// `spreadProxyBps` by MARKET-CAP TIER, the tier read from the daily snapshot
// layer's marketCap denormalized onto each tick-snapshot entry. Pure (no
// Firestore, no fetch) — all constants live in mandateConfig.js under
// MANDATE_FRICTION_MODEL_VERSION.
//
// HONESTY (D-15 / D-43 / O-3): the model is IDEALIZED — a spread PROXY (bid/ask
// exist in no repo payload, Q5) plus fixed-bps slippage, no market impact, no
// liquidity constraint. Every receipt carries spreadBasis:'proxy' and
// frictionBasis:'idealized_no_market_impact'; at $10M starting capital these
// numbers must never be described as realistic execution cost.
//
// FAIL-CONSERVATIVE: a symbol with no marketCap in the snapshot (daily layer
// missing / not yet enriched) prices at the WIDEST tier — degraded data must
// never buy cheaper fills.
//
// Friction enters EXACTLY ONCE, at execution, through cash (F14): this module
// only *selects* the bps; mandateExecution.executedPriceFor applies them to the
// mark, and grossPnl is later reconstructed as netPnl + Σ frictionPaid — never
// subtracted a second time.

import { MANDATE_FRICTION_TIERS } from './mandateConfig.js';

const norm = (s) => String(s || '').trim().toUpperCase();

/** The cap tier for a USD market cap. Null/absent/non-finite → 'unknown' (widest). */
export function capTierFor(marketCap) {
  const cap = Number(marketCap);
  if (!Number.isFinite(cap) || cap <= 0) return 'unknown';
  if (cap >= MANDATE_FRICTION_TIERS.mega.minMarketCap) return 'mega';
  if (cap >= MANDATE_FRICTION_TIERS.large.minMarketCap) return 'large';
  if (cap >= MANDATE_FRICTION_TIERS.mid.minMarketCap) return 'mid';
  return 'small';
}

/** Zero friction — a HOLD (no trade) pays nothing. */
export function zeroFriction() {
  return { slippageBps: 0, spreadProxyBps: 0, capTier: null };
}

/**
 * The friction bps for one symbol at one tick, from the snapshot's denormalized
 * marketCap. Symbol absent from the snapshot → 'unknown' tier (widest) — the
 * entry gates reject such symbols anyway, but an EXIT on a carry-over symbol
 * still prices here and must not price optimistically.
 *
 * @returns {{ slippageBps:number, spreadProxyBps:number, capTier:string }}
 */
export function frictionFor(ticker, snapshot) {
  const entry = snapshot?.symbols?.[norm(ticker)] || null;
  const tier = capTierFor(entry?.marketCap);
  const t = MANDATE_FRICTION_TIERS[tier];
  return { slippageBps: t.slippageBps, spreadProxyBps: t.spreadProxyBps, capTier: tier };
}

/**
 * The friction for a normalized decision: HOLD (or a ticker-less decision)
 * trades nothing and pays nothing; everything else prices by cap tier.
 */
export function frictionForDecision(decision, snapshot) {
  if (!decision?.ticker || decision.verb === 'HOLD') return zeroFriction();
  return frictionFor(decision.ticker, snapshot);
}
