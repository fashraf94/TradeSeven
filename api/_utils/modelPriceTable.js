// api/_utils/modelPriceTable.js
//
// Spec 1 — Mandate Substrate — the versioned $/MTok price table (§6.2, I-6).
// `usage × table → estUsd`, accumulated per book and per daily row. Pure data +
// arithmetic (Node-clean; no client, no fetch).
//
// HONESTY RULE: an UNKNOWN model id returns estUsd:null (never a silent $0) and
// alerts once per process — cost telemetry must degrade loudly, not understate.
// Prices are the Anthropic first-party API list rates at the version date below;
// a price change bumps MODEL_PRICE_TABLE_VERSION in the same commit (the daily
// rows carry only the derived estUsd, so the version is the audit trail).
//
// Direct transport (P2/P3) bills at full list rates. The Batch API halves them —
// that multiplier lands in P5 with the batch transport (do-not-build-ahead);
// cacheHitTokens is carried through now (§6.3) and stays 0 until P5 wires
// prompt caching.

export const MODEL_PRICE_TABLE_VERSION = 1;

// $ per million tokens (MTok), first-party API list rates (verified 2026-08-12).
// Keyed by exact model id as configured in the vintage's model seat.
export const MODEL_PRICES_PER_MTOK = Object.freeze({
  // Haiku 4.5 — the mandate manager's P1-pinned seat (mandateGenerationConfig).
  'claude-haiku-4-5-20251001': Object.freeze({ inputPerMTok: 1.0, outputPerMTok: 5.0 }),
  'claude-haiku-4-5': Object.freeze({ inputPerMTok: 1.0, outputPerMTok: 5.0 }),
});

const alertedUnknown = new Set();

/**
 * Price one model call's usage. Accepts the Anthropic usage shape
 * ({ input_tokens, output_tokens, cache_read_input_tokens }) and returns the
 * normalized telemetry increment. Null/absent usage → zeros with estUsd 0 (a
 * call that reported no usage costs unknown-but-unbilled; the eval still counts).
 *
 * @returns {{ tokensIn:number, tokensOut:number, cacheHitTokens:number, estUsd:number|null, priced:boolean }}
 */
export function priceUsage(modelId, usage) {
  const tokensIn = Number(usage?.input_tokens) || 0;
  const tokensOut = Number(usage?.output_tokens) || 0;
  const cacheHitTokens = Number(usage?.cache_read_input_tokens) || 0; // §6.3 — 0 until P5 wires caching

  const price = MODEL_PRICES_PER_MTOK[modelId];
  if (!price) {
    if (modelId && !alertedUnknown.has(modelId)) {
      alertedUnknown.add(modelId);
      console.error(
        `[ModelPriceTable] MODEL_PRICE_UNKNOWN — no $/MTok entry for '${modelId}' `
        + `(table v${MODEL_PRICE_TABLE_VERSION}); estUsd recorded as null, never a silent $0`,
      );
    }
    return { tokensIn, tokensOut, cacheHitTokens, estUsd: null, priced: false };
  }

  const estUsd = (tokensIn / 1e6) * price.inputPerMTok + (tokensOut / 1e6) * price.outputPerMTok;
  return { tokensIn, tokensOut, cacheHitTokens, estUsd, priced: true };
}
