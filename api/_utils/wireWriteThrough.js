// api/_utils/wireWriteThrough.js
// FantasyTimes Wire — the write choreography (Spec V1.5 §4.5) and the ONE
// Wire transaction shared by the inline path and the replay sweep (F2-1:
// uniform envelopes → uniform replay; one code path, no carve-outs).
//
// Steps at the story-write boundary (post-suppression), writes flag on:
//   1. validate + render in memory (agentFacts pulled into a PRIVATE local —
//      never placed on the story object; the story whitelist is never
//      widened for agentFacts)
//   2. pre-allocate the story doc ref
//   3. ATOMIC BATCH: story doc (whitelisted fields + wireValidation CLASS
//      CODES + wirePending: true; NO agentFacts at any depth) + envelope
//      fantasyTimesWireEnvelopes/{storyId}. Every outcome writes an
//      envelope — PASS, SALVAGE, QUARANTINE, REJECT, truncated (F2-1).
//      payloadHash computed ONCE here (F2-2).
//   4. Wire transaction: reread today's doc → receipt check (pre-existing
//      matching receipt → inline no-op, F2-10) → per-outcome artifacts.
//   5. cleanup: wirePending → false + delete envelope.
//   Failure at 4/5 → the sweep replays from the envelope. Failure inside 3
//   is atomic — story and envelope die together (the P3 coupling, stated
//   in the spec).
//
// Flags OFF: a plain `.add(storyDoc)` — byte-identical persistence behavior
// to the pre-Wire build. Metrics-only mode changes nothing here either.

import {
  WIRE_COLLECTION,
  WIRE_ENVELOPE_COLLECTION,
  WIRE_SCHEMA_VERSION,
  WIRE_OUTCOMES,
  ENTRY_OUTCOMES,
  EVENT_CONTRACTS,
} from './wireContracts.js';
import { validateAgentFacts, normalizeWireTicker, isInWireUniverse } from './wireValidator.js';
import { renderWireDigest } from './wireDigest.js';
import { buildIdempotencyKey, computePayloadHash } from './wireIdentity.js';
import { wireLookbackDates } from './wireCalendar.js';
import { resolveChainId } from './wireChains.js';
import { getWireFlags } from './wireFlags.js';
import { recordWireSample } from './wireMetrics.js';

const LOG_PREFIX = '[Wire]';

// Receipt reason caps: full strings are envelope-side; the receipt keeps a
// bounded server-side record that survives envelope deletion (F2-3).
const RECEIPT_REASON_CAP = 10;
const RECEIPT_REASON_CHARS = 200;

/**
 * Publish a story with the Wire write-through.
 *
 * @param {object} db
 * @param {object} o
 * @param {object} o.storyDoc — complete story document, WITHOUT agentFacts
 * @param {*}      o.rawAgentFacts — model tool-input agentFacts (private local)
 * @param {string|null} o.stopReason
 * @param {string} o.reporter — 'kai'|'alex'|'neta'|'doug'|'kim'
 * @param {string} o.seam — metrics/receipt seam id, e.g. 'kai_pulse'
 * @param {string|null} o.primaryTicker — SERVER-CANONICAL (M4): the same value
 *        the endpoint wrote on the story record, never model array order
 * @param {string} o.triggerRef — deterministic pre-call trigger identity
 * @param {string} o.marketDate — deriveMarketDate(instant) from key creation
 * @param {boolean} [o.deferTransaction=false] — poll-batch (10s budget):
 *        stamp story+envelope+wirePending only; the sweep transacts (§4.7)
 * @param {Date} [o.now]
 * @returns {Promise<{storyRef: object, wire: object|null}>}
 */
export async function publishStoryWithWire(db, {
  storyDoc,
  rawAgentFacts,
  stopReason = null,
  reporter,
  seam,
  primaryTicker = null,
  triggerRef,
  marketDate,
  deferTransaction = false,
  now = new Date(),
}) {
  const flags = getWireFlags();

  // ── Flags off: today's exact behavior ──────────────────────────────────
  if (!flags.writesEnabled) {
    const storyRef = await db.collection('fantasyTimesStories').add(storyDoc);
    return { storyRef, wire: null };
  }

  const wireStart = Date.now();

  // ── 1. Validate + render in memory ─────────────────────────────────────
  const v = validateAgentFacts({ rawAgentFacts, reporter, stopReason });
  const normalizedPrimary = primaryTicker ? normalizeWireTicker(primaryTicker) : null;

  // ── 2. Pre-allocate story ref; identity (key + hash, computed ONCE) ────
  const storyRef = db.collection('fantasyTimesStories').doc();
  const idempotencyKey = buildIdempotencyKey(seam, triggerRef, marketDate);
  const payloadHash = computePayloadHash(
    v.projectionSucceeded ? v.facts : (rawAgentFacts ?? null)
  );

  const envelope = {
    storyId: storyRef.id,
    seam,
    reporter,
    storyType: storyDoc.type || null,
    idempotencyKey,
    payloadHash,
    marketDate,
    outcome: v.outcome,
    modelAgentFacts: v.projectionSucceeded ? v.facts : null,
    validatorResult: {
      outcome: v.outcome,
      codes: v.codes,
      reasons: v.reasons,
      offUniverseTickers: v.offUniverseTickers,
      preStripTickerCount: v.preStripTickerCount,
      quarantined: v.quarantined,
      validatorVersion: v.validatorVersion,
    },
    primaryTicker: normalizedPrimary,
    headline: storyDoc.headline || '',
    publishedAt: storyDoc.publishedAt || now,
    createdAt: now,
  };

  // ── 3. Atomic batch: story (+ class codes + pending) + envelope ────────
  const envelopeRef = db.collection(WIRE_ENVELOPE_COLLECTION).doc(storyRef.id);
  const batch = db.batch();
  batch.set(storyRef, {
    ...storyDoc,
    wireValidation: {
      outcome: v.outcome,
      codes: v.codes, // class codes ONLY — never reason strings (F2-3)
      validatorVersion: v.validatorVersion,
    },
    wirePending: true,
  });
  batch.set(envelopeRef, envelope);
  await batch.commit();

  const wire = { outcome: v.outcome, codes: v.codes, idempotencyKey, txStatus: 'deferred' };

  // ── 4+5. Wire transaction + cleanup (inline unless deferred) ───────────
  if (!deferTransaction) {
    try {
      const tx = await runWireTransactionFromEnvelope(db, envelope, { now });
      // INLINE interpretation (F2-10): committed → success; any pre-existing
      // receipt for the key → no-op success. First receipt wins (B5).
      wire.txStatus = tx.status === 'receipt_exists' ? 'receipt_hit' : tx.status;
      await finalizeWireSuccess(db, storyRef, envelopeRef);
    } catch (err) {
      // P3: Wire transaction failures never block the published story; the
      // sweep replays from the envelope. wirePending stays true.
      console.error(`${LOG_PREFIX} transaction deferred to sweep for ${storyRef.id}:`, err?.message || err);
      wire.txStatus = 'failed_deferred';
    }
  }

  if (flags.metricsEnabled) {
    await recordWireSample(db, { seam, metric: 'wire_path', ms: Date.now() - wireStart, marketDate });
  }

  return { storyRef, wire };
}

/**
 * THE Wire transaction (§4.5 step 4) — the single implementation the inline
 * path and the sweep both call, so inline and replay behavior cannot drift.
 *
 * Reads the immutable prior-session docs OUTSIDE the transaction and rereads
 * TODAY'S doc inside it (B6: two concurrent same-chain stories serialize;
 * the second sees the first's entry and inherits its chainId).
 *
 * @returns {Promise<{status: 'committed'} |
 *   {status: 'receipt_exists', sameStory: boolean, sameHash: boolean}>}
 */
export async function runWireTransactionFromEnvelope(db, envelope, { now = new Date() } = {}) {
  const dayRef = db.collection(WIRE_COLLECTION).doc(envelope.marketDate);

  // Prior-session entries for chain lookback (immutable once their date has
  // closed → safe outside the transaction). Today's entries come from the
  // in-transaction reread below.
  const priorEntries = [];
  if (ENTRY_OUTCOMES.includes(envelope.outcome)) {
    const priorDates = wireLookbackDates(envelope.marketDate).slice(0, -1);
    const priorSnaps = await Promise.all(
      priorDates.map((d) => db.collection(WIRE_COLLECTION).doc(d).get())
    );
    for (const snap of priorSnaps) {
      if (snap.exists) priorEntries.push(...(snap.data().entries || []));
    }
  }

  return db.runTransaction(async (t) => {
    const snap = await t.get(dayRef);
    const data = snap.exists ? snap.data() : emptyWireDay(envelope.marketDate);
    const receipts = { ...(data.receipts || {}) };
    const stats = normalizeStats(data.validationStats);

    // Receipt check — first receipt wins (B5). The transaction only REPORTS
    // what it found; interpretation differs by path (F2-10 vs §4.7):
    //   INLINE: any pre-existing receipt for the key → no-op success — a
    //     changed payload on retry is a no-op, not a repair (B5), and the
    //     DST double-fire is a known benign case, never a counted conflict.
    //   SWEEP: same storyId+hash → post-commit race (success); different
    //     storyId or hash → idempotency conflict (class + counter), because
    //     a REPLAYED envelope disagreeing with the receipt is an anomaly.
    const existing = receipts[envelope.idempotencyKey];
    if (existing) {
      return {
        status: 'receipt_exists',
        sameStory: existing.storyId === envelope.storyId,
        sameHash: existing.payloadHash === envelope.payloadHash,
      };
    }

    // First processing of this key: count the attempt + outcome + codes.
    stats.attempted += 1;
    stats[envelope.outcome] = (stats[envelope.outcome] || 0) + 1;
    for (const code of envelope.validatorResult?.codes || []) {
      stats.byRule[code] = (stats.byRule[code] || 0) + 1;
    }

    let entries = data.entries || [];
    if (ENTRY_OUTCOMES.includes(envelope.outcome)) {
      const facts = envelope.modelAgentFacts;
      const contract = EVENT_CONTRACTS[facts.eventType] || {};
      const chainId = resolveChainId(
        [...priorEntries, ...entries],
        {
          storyId: envelope.storyId,
          reporter: envelope.reporter,
          primaryTicker: envelope.primaryTicker,
          eventType: facts.eventType,
        }
      );
      const persistedFacts = {
        ...facts,
        schemaVersion: WIRE_SCHEMA_VERSION,
        primaryTicker: envelope.primaryTicker,
        offUniverseTickers: envelope.validatorResult.offUniverseTickers,
        macroEligible:
          contract.macroEligible === true &&
          envelope.validatorResult.preStripTickerCount === 0,
        digest: renderWireDigest({ ...facts, primaryTicker: envelope.primaryTicker }),
        chainId,
        observedAt: now,
        validatorVersion: envelope.validatorResult.validatorVersion,
      };
      const entry = {
        storyId: envelope.storyId,
        reporter: envelope.reporter,
        headline: envelope.headline, // founder readability only (P7)
        publishedAt: envelope.publishedAt,
        validatorVersion: envelope.validatorResult.validatorVersion,
        quarantined: envelope.outcome === WIRE_OUTCOMES.QUARANTINED,
        agentFacts: persistedFacts,
      };
      entries = [...entries, entry]; // append-only (M9)
    }

    receipts[envelope.idempotencyKey] = {
      storyId: envelope.storyId,
      outcome: envelope.outcome,
      payloadHash: envelope.payloadHash,
      validatorVersion: envelope.validatorResult?.validatorVersion || null,
      codes: envelope.validatorResult?.codes || [],
      reasons: (envelope.validatorResult?.reasons || [])
        .slice(0, RECEIPT_REASON_CAP)
        .map((r) => String(r).slice(0, RECEIPT_REASON_CHARS)),
      createdAt: now,
    };

    // Indexes REBUILT from entries inside every transaction — never patched
    // (M9): reconciliation inserts and repairs cannot corrupt them.
    const { bySymbol, macroEntries } = rebuildIndexes(entries);

    t.set(dayRef, {
      date: envelope.marketDate,
      entries,
      bySymbol,
      macroEntries,
      receipts,
      validationStats: stats,
      updatedAt: now,
    });
    return { status: 'committed' };
  });
}

/** §4.5 step 5 — success cleanup (also the receipt-hit path). */
export async function finalizeWireSuccess(db, storyRef, envelopeRef) {
  const batch = db.batch();
  batch.update(storyRef, { wirePending: false });
  batch.delete(envelopeRef);
  await batch.commit();
}

/** Conflict termination: class code on the story, flag cleared, envelope gone. */
export async function markWireConflict(db, storyRef, envelopeRef, conflictClass) {
  const batch = db.batch();
  batch.update(storyRef, { wirePending: false, wireConflict: conflictClass });
  batch.delete(envelopeRef);
  await batch.commit();
}

/** Rebuild bySymbol + macroEntries from the full entries array (M9, B7). */
export function rebuildIndexes(entries) {
  const bySymbol = {};
  const macroEntries = [];
  for (const entry of entries) {
    if (entry.quarantined) continue; // quarantined: never in any index
    const facts = entry.agentFacts || {};
    for (const ticker of facts.tickers || []) {
      // facts.tickers are validated in-universe survivors (F1 already ran)
      if (!isInWireUniverse(ticker)) continue;
      if (!bySymbol[ticker]) bySymbol[ticker] = [];
      if (!bySymbol[ticker].includes(entry.storyId)) bySymbol[ticker].push(entry.storyId);
    }
    if (facts.macroEligible === true) macroEntries.push(entry.storyId);
  }
  return { bySymbol, macroEntries };
}

export function emptyWireDay(marketDate) {
  return {
    date: marketDate,
    entries: [],
    bySymbol: {},
    macroEntries: [],
    receipts: {},
    validationStats: normalizeStats(null),
    updatedAt: null,
  };
}

export function normalizeStats(stats) {
  return {
    attempted: stats?.attempted || 0,
    passed: stats?.passed || 0,
    salvaged: stats?.salvaged || 0,
    rejected: stats?.rejected || 0,
    quarantined: stats?.quarantined || 0,
    truncated: stats?.truncated || 0,
    byRule: { ...(stats?.byRule || {}) },
    idempotencyConflicts: stats?.idempotencyConflicts || 0,
    envelopeMissing: stats?.envelopeMissing || 0,
  };
}
