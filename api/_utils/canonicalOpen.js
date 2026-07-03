// api/_utils/canonicalOpen.js
//
// User-layer CANONICAL-OPEN capture primitives (Spec §1.1 canonical-open
// policy). Phase 1: INERT primitives only — the pinned-source fetch util and
// the Admin-SDK snapshot write helper. Nothing here is wired to a cron or read
// by banking/scoring yet (that is Phase 2/3).
//
// PINNED SOURCE (hard constraint): the canonical open MUST come from
// fetchBatchQuotes(...).open — EODHD /real-time/ item.open (tournamentPrices.js)
// — the EXACT source the nightly banking pass settles null baselines from
// (tournamentBanking.js:174). It MUST NOT come from getStockAnalysisData (a
// different /eod/ feed whose live price object carries no `open`); using that
// recreates the intraday-vs-banked divergence the reframe kills. The co-located
// test is the tripwire: it asserts getStockAnalysisData is never called here.
//
// FAIL-CLOSED: when item.open is absent/non-positive (fetchBatchQuotes already
// normalizes zero/NA to null via toPositiveOrNull: pre-first-print, late open,
// halt, thin/illiquid, bad symbol) the symbol returns null — NO last-close
// substitution, NO fallback. Null is the honest "no eligible open yet" signal
// that a later phase turns into PENDING_OPEN and retries.
//
// Imports the zero-import schema factory from src/ under the revised June 2026
// import rule (BUILD_RULES §4); the co-located test's real import of THIS module
// is the dependency-surface guard (it loads clean in Node — never mocked away).

import { fetchBatchQuotes } from './tournamentPrices.js';
import {
  createCanonicalOpenEntry,
  TOURNAMENT_GROUPS_COLLECTION,
} from '../../src/constants/leagueTournament.js';

/**
 * The dot-safe key a symbol takes inside any symbol-keyed Firestore MAP (the
 * `canonicalOpens` snapshot map). Firestore field paths use '.' as a separator,
 * so `canonicalOpens.{sym}` for a dot-class ticker (e.g. `BRK.B`) would nest
 * `canonicalOpens.BRK.B` instead of keying the literal `"BRK.B"`, and every
 * literal-bracket reader would then miss it (fail-invisible + broken
 * immutability). We normalize to the system's hyphen form — the SAME
 * convention as symbolNormalize.js / tickerValidation.js / marketDataCache.js
 * (`.replace(/\./g, '-')`) — so writes and all reads always agree. A no-op for
 * every current (dot-free) ticker → byte-identical for today's data.
 *
 * MUST be applied at every `canonicalOpens` write AND read (this file, the
 * sweep's settle/idempotency reads, and banking's Case-2 read).
 */
export function canonicalOpenKey(symbol) {
  return String(symbol || '').trim().toUpperCase().replace(/\./g, '-');
}

/**
 * Fetch the canonical (official session) open for a set of symbols from the
 * PINNED source (fetchBatchQuotes → /real-time/ item.open). Returns, per
 * requested (uppercased) symbol, either
 *   { open: number, priceTimestamp: number|null, instrumentId: null }   (open > 0)
 * or null (no eligible open — fail-closed). Never throws on price loss:
 * fetchBatchQuotes returns {} on transport failure, so every symbol degrades to
 * null.
 *
 * @param {string[]} symbols
 * @param {Object} [opts] forwarded to fetchBatchQuotes (fetchImpl/apiKey for tests)
 */
export async function fetchCanonicalOpens(symbols, opts = {}) {
  const uniq = [...new Set((symbols || []).map(s => String(s || '').trim().toUpperCase()).filter(Boolean))];
  const out = {};
  if (uniq.length === 0) return out;

  // Pinned source — the SAME batch quote the banking pass reads item.open from.
  const quotes = await fetchBatchQuotes(uniq, opts);

  for (const symbol of uniq) {
    const q = quotes?.[symbol];
    // fetchBatchQuotes already maps a bad/zero/NA open to null (toPositiveOrNull);
    // belt-and-suspenders re-check keeps the fail-closed contract explicit.
    const open = q && Number.isFinite(q.open) && q.open > 0 ? q.open : null;
    out[symbol] = open == null
      ? null // fail-closed: no eligible open yet
      : {
        open,
        priceTimestamp: Number.isFinite(q.timestamp) ? q.timestamp : null,
        // fetchBatchQuotes drops exchange/currency/vendor-symbol; no richer
        // instrument identity is available without a new vendor call (out of
        // scope for Phase 1). Present-null for later corporate-action work.
        instrumentId: null,
      };
  }
  return out;
}

/**
 * Admin-SDK write helper: persist canonical-open snapshot entries under a round
 * doc's `canonicalOpens` map, IDEMPOTENTLY. Server-write-only (client writes are
 * denied by firestore.rules). Defined here for a later phase's sweep to call —
 * Phase 1 does NOT invoke it from any cron.
 *
 * Idempotent by construction: runs in a transaction that re-reads the group and
 * writes an entry ONLY where one is not already present, so a re-fired or
 * concurrent capture no-ops (the group-doc read-set is the concurrency
 * precondition — the flip.js:163 in-transaction conditional-write pattern).
 *
 * @param {Object} db Firestore Admin instance
 * @param {string} groupId
 * @param {Object<string,{open:number,priceTimestamp?:number|null,instrumentId?:*}>} opensBySymbol
 *   the fetchCanonicalOpens result (null entries are ignored)
 * @param {Object} meta { capturedAt (ISO, required), captureJobId, session }
 * @returns {Promise<{written:string[], skipped:string[]}>}
 */
export async function writeCanonicalOpenSnapshot(db, groupId, opensBySymbol, { capturedAt, captureJobId = null, session = null } = {}) {
  const symbols = Object.keys(opensBySymbol || {}).filter(sym => opensBySymbol[sym] != null);
  if (symbols.length === 0) return { written: [], skipped: [] };

  const groupRef = db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(groupId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(groupRef);
    if (!snap.exists) return { written: [], skipped: symbols };
    const existing = snap.data()?.canonicalOpens || {};
    const written = [];
    const skipped = [];
    const update = {};
    for (const sym of symbols) {
      const key = canonicalOpenKey(sym); // dot-safe Firestore map key (BRK.B → BRK-B)
      if (existing[key] != null) { skipped.push(sym); continue; } // already captured — no-op
      const src = opensBySymbol[sym];
      // Build + validate the frozen entry via the canonical factory.
      update[`canonicalOpens.${key}`] = createCanonicalOpenEntry({
        open: src.open,
        capturedAt,
        priceTimestamp: src.priceTimestamp ?? null,
        captureJobId,
        session,
        instrumentId: src.instrumentId ?? null,
      });
      written.push(sym);
    }
    if (written.length > 0) {
      update.updatedAt = capturedAt;
      tx.update(groupRef, update);
    }
    return { written, skipped };
  });
}
