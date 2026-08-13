// api/_utils/mandateRegime.js
//
// Spec 1 — Mandate Substrate — REGIME PROVENANCE (§6.1, I-7, P3). Pure resolver:
// the caller (the eval/close handler) reads `indexIntelligence/marketContext`
// once per fire and passes the doc here; this module decides what may honestly
// be stamped. A doc older than MANDATE_REGIME_MAX_AGE_MS resolves to
// regime:'unknown' — NEVER a silently stale label (§6.1). 'unknown' is a real,
// honest value, not an error.
//
// The read pattern follows the regimeStamp.js house precedent (the W3 stamp):
// same source doc, same "stale ⇒ unknown, provenance always attached" posture.
// Rows carry { regime, regimeAsOf, regimeSource } so I-7 regime-window cohorts
// can be built at query time.

import { MANDATE_REGIME_MAX_AGE_MS, MANDATE_REGIME_SOURCE } from './mandateConfig.js';

/** Normalize a Firestore Timestamp / Date / ISO string / epoch-ms to epoch ms, or null. */
function toMs(v) {
  if (v == null) return null;
  if (typeof v.toDate === 'function') return v.toDate().getTime(); // Firestore Timestamp
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * Resolve the honest regime stamp from the marketContext doc data.
 *
 * @param {object|null} ctxDoc  indexIntelligence/marketContext data (or null if absent)
 * @param {Date} [now]
 * @param {number} [maxAgeMs]
 * @returns {{ regime:string, regimeAsOf:string|null, regimeSource:string }}
 */
export function resolveRegime(ctxDoc, now = new Date(), maxAgeMs = MANDATE_REGIME_MAX_AGE_MS) {
  const source = MANDATE_REGIME_SOURCE;
  const label = typeof ctxDoc?.regime === 'string' && ctxDoc.regime.length > 0 ? ctxDoc.regime : null;
  const asOfMs = toMs(ctxDoc?.updatedAt);

  // No doc, no label, or no provenance timestamp → unknown (a label with no
  // updatedAt cannot prove freshness — the regimeStamp precedent).
  if (!label || asOfMs == null) {
    return { regime: 'unknown', regimeAsOf: null, regimeSource: source };
  }
  const age = now.getTime() - asOfMs;
  if (age > maxAgeMs) {
    // Stale — stamp unknown but keep the provenance of what was seen.
    return { regime: 'unknown', regimeAsOf: new Date(asOfMs).toISOString(), regimeSource: source };
  }
  return { regime: label, regimeAsOf: new Date(asOfMs).toISOString(), regimeSource: source };
}
