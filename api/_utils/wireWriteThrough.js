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
  WIRE_DIGEST_RENDERER_VERSION,
  WIRE_OUTCOMES,
  WIRE_CODES,
  ENTRY_OUTCOMES,
  EVENT_CONTRACTS,
  TICKER_MAX_LENGTH,
} from './wireContracts.js';
import { validateAgentFacts, normalizeWireTicker, isInWireUniverse } from './wireValidator.js';
import { renderWireDigest } from './wireDigest.js';
import { buildIdempotencyKey, computePayloadHash } from './wireIdentity.js';
import { wireLookbackDates } from './wireCalendar.js';
import { resolveChainId } from './wireChains.js';
import { getWireFlags } from './wireFlags.js';
import { classifyWireEntry, isRenderableState, warnSkippedWireEntry } from './wireEntryGuard.js';

const LOG_PREFIX = '[Wire]';

// Receipt reason caps: full strings are envelope-side; the receipt keeps a
// bounded server-side record that survives envelope deletion (F2-3).
const RECEIPT_REASON_CAP = 10;
const RECEIPT_REASON_CHARS = 200;

// ~60% of Firestore's 1 MiB document ceiling — warn with room to act.
const DAY_DOC_WARN_BYTES = 600 * 1024;

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
 * @param {string|null} [o.serverSubjectRef] — Neta seams only (V1.6 A2):
 *        the SERVER-STAMPED subject slug resolved pre-call from the trigger's
 *        event name; the model never sees this field on those seams
 * @param {boolean} [o.deferTransaction=false] — poll-batch (10s budget):
 *        stamp story+envelope+wirePending only; the sweep transacts (§4.7)
 * @param {object|null} [o.generationConfig] — N0 provenance (Phase 2 V1.3):
 *        the D-P2-7 tuple `{ generationVersion, continuityEnabled }` returned
 *        by wireModelCall/wireBatchSubmit — derived from the SAME frozen
 *        execution object the request was built from (P11). On the batch
 *        seam this is the SUBMIT-time value carried on the batch doc
 *        (R4-B1), never poll-time state.
 * @param {string|null} [o.generationSchemaVersion] — companion ruling: the
 *        schema version in force at GENERATION time. Inline seams omit it
 *        (generation time == publish time → current constant); poll-batch
 *        passes the submit-time value from the batch doc when present.
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
  serverSubjectRef = null,
  deferTransaction = false,
  generationConfig = null,
  generationSchemaVersion = null,
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
  // primaryTickerRaw feeds ONLY the A2 index_move consistency remap.
  const v = validateAgentFacts({ rawAgentFacts, reporter, stopReason, primaryTickerRaw: primaryTicker });

  // primaryTicker gets the SAME F1/D8 battery as tickers[]. It is only
  // "server-canonical" in the sense that it comes off the story record —
  // and at the Kai seam that record's value is itself MODEL-emitted
  // (generate-pulse takes storyData.primaryTicker verbatim). Unvalidated, it
  // becomes the digest SUBJECT and a chain-key component, so a model string
  // like "Fed's hawkish pivot" would render into an agent-facing digest and
  // fork the chain — defeating P2's "the model does not write the digest".
  // Off-universe or oversize → dropped to null; the digest then falls back
  // to a validated ticker or the contract's own subject noun.
  const codes = [...v.codes];
  const candidatePrimary = primaryTicker ? normalizeWireTicker(primaryTicker) : null;
  let normalizedPrimary = null;
  if (candidatePrimary) {
    if (candidatePrimary.length <= TICKER_MAX_LENGTH && isInWireUniverse(candidatePrimary)) {
      normalizedPrimary = candidatePrimary;
    } else {
      codes.push(WIRE_CODES.F1_PRIMARY_DROPPED);
      v.reasons.push('primaryTicker off-universe or oversize; dropped from facts, digest and chain key');
    }
  }

  // ── 2. Pre-allocate story ref; identity (key + hash, computed ONCE) ────
  const storyRef = db.collection('fantasyTimesStories').doc();
  const idempotencyKey = buildIdempotencyKey(seam, triggerRef, marketDate);
  // F2-2: hash the NORMALIZED facts when they exist, else the raw projected
  // input. `v.facts` is null on every REJECT — including post-projection
  // rejects — so keying off projectionSucceeded alone collapsed every
  // rejected payload onto sha256("null").
  const payloadHash = computePayloadHash(v.facts ?? rawAgentFacts ?? null);

  const envelope = {
    storyId: storyRef.id,
    seam,
    reporter,
    storyType: storyDoc.type || null,
    idempotencyKey,
    payloadHash,
    // ── N0 provenance (F-B1 + companion ruling) ──────────────────────────
    // Captured at generation time, stored ONCE, read from the envelope by
    // BOTH the inline transaction and the replay sweep — never re-derived
    // at replay. Additive fields: provably hash-safe (payloadHash is
    // computed above, over the facts) and schema-bump-free by the F-B1
    // ruling. Null generationConfig = the caller had no wrapper stamp
    // (legacy callers, tests) — persisted as explicit null, never omitted.
    schemaVersion: generationSchemaVersion ?? WIRE_SCHEMA_VERSION,
    generationConfig: generationConfig ?? null,
    marketDate,
    outcome: v.outcome,
    modelAgentFacts: v.projectionSucceeded ? v.facts : null,
    validatorResult: {
      outcome: v.outcome,
      codes,
      reasons: v.reasons,
      offUniverseTickers: v.offUniverseTickers,
      preStripTickerCount: v.preStripTickerCount,
      quarantined: v.quarantined,
      validatorVersion: v.validatorVersion,
    },
    primaryTicker: normalizedPrimary,
    // A2: server-owned for Neta's rows; the model-emitted (validated/
    // remapped) value for index_move rides inside modelAgentFacts.
    serverSubjectRef,
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
      codes, // class codes ONLY — never reason strings (F2-3)
      validatorVersion: v.validatorVersion,
    },
    wirePending: true,
  });
  batch.set(envelopeRef, envelope);
  await batch.commit();

  const wire = { outcome: v.outcome, codes, idempotencyKey, txStatus: 'deferred' };

  // ── 4+5. Wire transaction + cleanup (inline unless deferred) ───────────
  if (!deferTransaction) {
    try {
      const tx = await runWireTransactionFromEnvelope(db, envelope, { now });
      // D9 (V1.6 A1) — identical handling on both paths: committed and
      // completed finalize as success; a superseded attempt gets its OWN
      // benign stamp (wireSuperseded — never wireConflict) and cleans up.
      if (tx.status === 'superseded') {
        wire.txStatus = 'superseded';
        await finalizeWireSuperseded(db, storyRef, envelopeRef);
      } else {
        wire.txStatus = tx.status === 'completed' ? 'receipt_hit' : tx.status;
        await finalizeWireSuccess(db, storyRef, envelopeRef);
      }
    } catch (err) {
      // P3: Wire transaction failures never block the published story; the
      // sweep replays from the envelope. wirePending stays true.
      console.error(`${LOG_PREFIX} transaction deferred to sweep for ${storyRef.id}:`, err?.message || err);
      wire.txStatus = 'failed_deferred';
    }
  }

  // NO metrics I/O here: this function runs INSIDE the caller's
  // generate_publish measurement window, so a metrics transaction here would
  // charge the instrument's own Firestore round-trip to the thing it
  // measures — and the §6.1 p95 gate reads exactly that number. The duration
  // is returned instead; the caller emits both samples after its window
  // closes.
  wire.wireMs = Date.now() - wireStart;

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
    // DEGRADES, never throws: a failed lookback (walker horizon guard, a
    // malformed bucket, a read error) must not kill the Wire write for a
    // story that is already published. Losing the window costs chain
    // CONTINUATION — the entry self-roots — which is strictly better than
    // an entry that never lands and retries until the attempt cap burns.
    try {
      const priorDates = wireLookbackDates(envelope.marketDate).slice(0, -1);
      const priorSnaps = await Promise.all(
        priorDates.map((d) => db.collection(WIRE_COLLECTION).doc(d).get())
      );
      for (const snap of priorSnaps) {
        if (snap.exists) priorEntries.push(...(snap.data().entries || []));
      }
    } catch (err) {
      console.warn(
        `${LOG_PREFIX} chain lookback unavailable for ${envelope.marketDate} ` +
        `(story ${envelope.storyId} will self-root):`, err?.message || err
      );
    }
  }

  return db.runTransaction(async (t) => {
    const snap = await t.get(dayRef);
    const data = snap.exists ? snap.data() : emptyWireDay(envelope.marketDate);
    const receipts = { ...(data.receipts || {}) };
    const stats = normalizeStats(data.validationStats);

    // Receipt check — D9 semantics, UNIFIED across inline and sweep (V1.6
    // A1/M1). First receipt wins (B5: no second entry, no receipt
    // overwrite). The hash carries NO classification: retries regenerate
    // (the DST double-fire re-runs the model), so a legitimate retry hashes
    // differently and a same-key mismatch is unclassifiable by content.
    //   • same storyId → completed (the post-commit race; the hash
    //     necessarily matches — one hash per story, computed once).
    //   • different storyId → SUPERSEDED ATTEMPT: append the attempt's
    //     storyId to receipt.supersededAttempts[] if absent, counting
    //     validationStats.superseded ONLY on first append — exactly-once by
    //     construction (the membership check IS the counter guard). The
    //     straggler revisit (already in the list) is a pure no-op: no
    //     write, no count. No event can be counted twice or labeled two
    //     ways, on either path.
    const existing = receipts[envelope.idempotencyKey];
    if (existing) {
      if (existing.storyId === envelope.storyId) {
        return { status: 'completed' };
      }
      const attempts = existing.supersededAttempts || [];
      if (attempts.includes(envelope.storyId)) {
        return { status: 'superseded', firstAppend: false };
      }
      stats.superseded += 1;
      receipts[envelope.idempotencyKey] = {
        ...existing,
        supersededAttempts: [...attempts, envelope.storyId],
      };
      t.set(dayRef, { ...data, receipts, validationStats: stats, updatedAt: now });
      return { status: 'superseded', firstAppend: true };
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
      // N1.4 (P2-29): chain candidates pass the fail-closed version guard —
      // a day doc legitimately spans deploys (morning entries under old
      // code, afternoon under new), so BOTH prior-day and today's entries
      // are classified. An entry this build can't trust cannot anchor a
      // chain; losing a candidate costs chain CONTINUATION only (the new
      // entry self-roots), same degrade contract as the lookback above.
      const chainCandidates = [...priorEntries, ...entries].filter((e) => {
        const cls = classifyWireEntry(e);
        if (isRenderableState(cls.state)) return true;
        warnSkippedWireEntry('WireChains', e, cls);
        return false;
      });
      const chainId = resolveChainId(
        chainCandidates,
        {
          storyId: envelope.storyId,
          reporter: envelope.reporter,
          primaryTicker: envelope.primaryTicker,
          eventType: facts.eventType,
        }
      );
      // subjectRef resolution by row ownership (V1.6 A2): 'server' rows
      // carry the pre-call server stamp (the model never sees the field
      // there); 'model_required' rows carry the validated/remapped model
      // value already inside facts; every other row is null. Resolved ONCE
      // so the digest head and the persisted field can never disagree.
      const resolvedSubjectRef = contract.subjectRef === 'server'
        ? (envelope.serverSubjectRef ?? null)
        : (facts.subjectRef ?? null);
      const persistedFacts = {
        ...facts,
        // N0 (companion ruling): schemaVersion is ENVELOPE-BORNE — the
        // version in force at generation time, like its sibling
        // validatorVersion below. A replay straddling a deploy can no
        // longer stamp an entry with a schema its facts were never
        // validated against. Legacy envelopes (pre-N0, no field) fall back
        // to the current constant (Amendment J: absent = legacy).
        schemaVersion: envelope.schemaVersion ?? WIRE_SCHEMA_VERSION,
        subjectRef: resolvedSubjectRef,
        primaryTicker: envelope.primaryTicker,
        offUniverseTickers: envelope.validatorResult.offUniverseTickers,
        macroEligible:
          contract.macroEligible === true &&
          envelope.validatorResult.preStripTickerCount === 0,
        digest: renderWireDigest({ ...facts, subjectRef: resolvedSubjectRef, primaryTicker: envelope.primaryTicker }),
        // R4-B1: digestRendererVersion governs RENDER EXECUTION and is
        // stamped here — where renderWireDigest actually just ran —
        // truthfully, never carried from submit. A renderer deploy landing
        // mid-batch correctly places those entries in the new renderer
        // epoch (the declared-migration path).
        digestRendererVersion: WIRE_DIGEST_RENDERER_VERSION,
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
        // N0 (D-P2-7 tuple, entry wrapper per discovery D7: provenance is
        // not a fact about the market, so it rides beside validatorVersion,
        // never inside agentFacts). Guarded read: a pre-N0 envelope yields
        // explicit null = LEGACY (renderable, Amendment J) — never a throw,
        // never replay_exhausted with the facts deleted (P2-30).
        generationConfig: envelope.generationConfig ?? null,
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

    const dayDoc = {
      date: envelope.marketDate,
      entries,
      bySymbol,
      macroEntries,
      receipts,
      validationStats: stats,
      updatedAt: now,
    };

    // Soft size guard. The daily doc aggregates entries + receipts and is
    // subject to Firestore's hard 1 MiB per-document limit; past it the
    // transaction fails and EVERY remaining story that day defers to the
    // sweep and then exhausts. Warn early and loudly so the §4.3 shard
    // escape hatch can be taken before that happens, rather than after.
    const approxBytes = JSON.stringify(dayDoc).length;
    if (approxBytes > DAY_DOC_WARN_BYTES) {
      console.warn(
        `${LOG_PREFIX} day doc ${envelope.marketDate} is ~${Math.round(approxBytes / 1024)}KB ` +
        `(${entries.length} entries, ${Object.keys(receipts).length} receipts) — ` +
        'approaching the 1MiB document ceiling; consider the §4.3 shard escape hatch.'
      );
    }

    t.set(dayRef, dayDoc);
    return { status: 'committed' };
  });
}

/** §4.5 step 5 — success cleanup (also the completed/post-commit-race path). */
export async function finalizeWireSuccess(db, storyRef, envelopeRef) {
  const batch = db.batch();
  batch.update(storyRef, { wirePending: false });
  batch.delete(envelopeRef);
  await batch.commit();
}

/** D9 superseded-attempt cleanup (V1.6 A1): benign own-field stamp — never
 *  wireConflict — plus the standard clear + envelope delete. Idempotent:
 *  a straggler revisit restamps harmlessly. */
export async function finalizeWireSuperseded(db, storyRef, envelopeRef) {
  const batch = db.batch();
  batch.update(storyRef, { wirePending: false, wireSuperseded: true });
  batch.delete(envelopeRef);
  await batch.commit();
}

/** Rebuild bySymbol + macroEntries from the full entries array (M9, B7).
 *  N1.4 (P2-29): entries the guard fails are excluded from BOTH indexes —
 *  read-side consumers resolve through bySymbol/macroEntries, so an
 *  untrusted entry must not be reachable through them. The entry itself
 *  stays in entries[] untouched (append-only M9; the guard is a serving
 *  filter, never a destroyer). */
export function rebuildIndexes(entries) {
  const bySymbol = {};
  const macroEntries = [];
  for (const entry of entries) {
    if (entry.quarantined) continue; // quarantined: never in any index
    const cls = classifyWireEntry(entry);
    if (!isRenderableState(cls.state)) {
      warnSkippedWireEntry('WireIndexes', entry, cls);
      continue;
    }
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
    // V1.6 A1/D9: `superseded` replaces the retired `idempotencyConflicts`.
    // §6.1 gate line: superseded reviewed; nonzero on DST transition days
    // expected; nonzero otherwise requires explanation.
    superseded: stats?.superseded || 0,
    envelopeMissing: stats?.envelopeMissing || 0,
    replayExhausted: stats?.replayExhausted || 0,
  };
}
