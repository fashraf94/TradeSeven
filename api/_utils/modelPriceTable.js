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
// P5: the Batch API multiplier (50% off list) and prompt-caching rates are live.
// Anthropic list pricing: cache WRITE = 1.25× base input (5-minute TTL tier),
// cache READ = 0.1× base input; the batch discount applies across all four
// components. Usage is priced exactly as the API REPORTS it — input_tokens
// excludes cached tokens; cache_read/cache_creation are separate components —
// so whether batch and caching actually STACK is measured (cacheHitTokens per
// call), never assumed (§3.3/§6.3, D-20).
//
// Version 2 = the P5 rate-semantics change (batch flag + cache components).
// The version is the audit trail for every derived estUsd on daily rows.

export const MODEL_PRICE_TABLE_VERSION = 2;

export const CACHE_WRITE_INPUT_MULTIPLIER = 1.25; // 5-minute-TTL cache write premium
export const CACHE_READ_INPUT_MULTIPLIER = 0.1;
export const BATCH_DISCOUNT_MULTIPLIER = 0.5;

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
 * ({ input_tokens, output_tokens, cache_read_input_tokens,
 * cache_creation_input_tokens }) and returns the normalized telemetry
 * increment. Null/absent usage → zeros with estUsd 0 (a call that reported no
 * usage costs unknown-but-unbilled; the eval still counts).
 *
 * `input_tokens` is the API's UNCACHED input component; cache reads and writes
 * are priced at their own multipliers. `batch: true` applies the Batch API
 * discount across every component (the P5 transport bills all harvested usage
 * through this flag).
 *
 * @returns {{ tokensIn:number, tokensOut:number, cacheHitTokens:number,
 *             cacheWriteTokens:number, estUsd:number|null, priced:boolean }}
 */
export function priceUsage(modelId, usage, { batch = false } = {}) {
  const tokensIn = Number(usage?.input_tokens) || 0;
  const tokensOut = Number(usage?.output_tokens) || 0;
  const cacheHitTokens = Number(usage?.cache_read_input_tokens) || 0;   // §6.3 — the D-20 stacking measurement
  const cacheWriteTokens = Number(usage?.cache_creation_input_tokens) || 0;

  const price = MODEL_PRICES_PER_MTOK[modelId];
  if (!price) {
    // A NULL/undefined id alerts too (keyed as its string form) — the header
    // rule is "degrade loudly", and a nullish id is the quietest failure of
    // all (P5 review MONEY-P5-6). Once per id per process, as before.
    const alertKey = String(modelId);
    if (!alertedUnknown.has(alertKey)) {
      alertedUnknown.add(alertKey);
      console.error(
        `[ModelPriceTable] MODEL_PRICE_UNKNOWN — no $/MTok entry for '${alertKey}' `
        + `(table v${MODEL_PRICE_TABLE_VERSION}); estUsd recorded as null, never a silent $0`,
      );
    }
    return { tokensIn, tokensOut, cacheHitTokens, cacheWriteTokens, estUsd: null, priced: false };
  }

  const listUsd = (tokensIn / 1e6) * price.inputPerMTok
    + (tokensOut / 1e6) * price.outputPerMTok
    + (cacheWriteTokens / 1e6) * price.inputPerMTok * CACHE_WRITE_INPUT_MULTIPLIER
    + (cacheHitTokens / 1e6) * price.inputPerMTok * CACHE_READ_INPUT_MULTIPLIER;
  const estUsd = batch ? listUsd * BATCH_DISCOUNT_MULTIPLIER : listUsd;
  return { tokensIn, tokensOut, cacheHitTokens, cacheWriteTokens, estUsd, priced: true };
}

/**
 * §6.2/§6.3 (I-6) — the costTelemetry merge patch for one billed eval:
 * current-month accumulators (reset on month rollover; monthKey = YYYY-MM) plus
 * the intra-day block the close pass folds into the daily row. PURE — computed
 * from a book copy read fresh under whatever serialization the caller holds
 * (the eval sweep's per-book lease, or the harvest's — P3 review INV-3: read →
 * bill → merge under one hold, so a concurrent fire cannot erase an
 * accumulation). Moved here from mandate-evaluate.js in P5 (mechanical; the
 * handler re-exports) so the batch harvest can bill without importing a cron
 * entrypoint. An unpriced model id accumulates tokens with `unpricedCalls`
 * incremented — estUsd must degrade loudly, never silently understate.
 */
export function telemetryPatch(book, sessionDate, priced) {
  if (!priced) return null;
  const monthKey = sessionDate.slice(0, 7);
  const sameMonth = book.costTelemetry?.monthKey === monthKey;
  const prev = sameMonth ? (book.costTelemetry || {}) : {};
  const today = book.costTelemetry?.today?.date === sessionDate ? book.costTelemetry.today : {};
  return {
    costTelemetry: {
      monthKey,
      tokensIn: (prev.tokensIn || 0) + priced.tokensIn,
      tokensOut: (prev.tokensOut || 0) + priced.tokensOut,
      cacheHitTokens: (prev.cacheHitTokens || 0) + priced.cacheHitTokens,
      cacheWriteTokens: (prev.cacheWriteTokens || 0) + (priced.cacheWriteTokens || 0),
      estUsd: (prev.estUsd || 0) + (priced.estUsd || 0),
      unpricedCalls: (prev.unpricedCalls || 0) + (priced.priced ? 0 : 1),
      today: {
        date: sessionDate,
        evalCount: (today.evalCount || 0) + 1,
        tokensIn: (today.tokensIn || 0) + priced.tokensIn,
        tokensOut: (today.tokensOut || 0) + priced.tokensOut,
        cacheHitTokens: (today.cacheHitTokens || 0) + priced.cacheHitTokens,
        cacheWriteTokens: (today.cacheWriteTokens || 0) + (priced.cacheWriteTokens || 0),
        estUsd: (today.estUsd || 0) + (priced.estUsd || 0),
        // P5 (review MONEY-P5-4): the unpriced count reaches the DAY block and
        // from there the daily row + close alert — a rotated/unknown model id
        // must not understate spend with one process-lifetime console line as
        // the only trace.
        unpricedCalls: (today.unpricedCalls || 0) + (priced.priced ? 0 : 1),
      },
    },
  };
}
