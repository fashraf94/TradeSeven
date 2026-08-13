// api/_utils/mandateBatchTransport.js
//
// Spec 1 — Mandate Substrate — the BATCH TRANSPORT (§3.3, P5). The production
// transport for the P2–P4 pipeline: at each eval tick, eligible books' prompts
// are submitted as ONE Anthropic Message Batch (per-book custom_id = the
// deterministic requestId, F2); each tick HARVESTS BEFORE IT SUBMITS; every
// harvested result runs the full §3.3 validation and executes through the
// existing §3.5 transaction (claim-and-execute on the deterministic
// decisionId). Client calls route through mandateModelCall.js (the sole
// Anthropic-client importer — this module holds batch STATE, never the client).
//
// THE STATE MACHINE (I1 — the phase's spine; enumerated in the P5 audit):
//
//   book-side (execState.openBatchId = the open submission's requestId):
//     idle → open(submit gate txn) → terminal(exactly one of executed /
//     rejected_stale / gated / failed / cancelled / expired) → idle.
//     Every terminal transition goes through execStateTerminalPatch
//     (mandateExecution.js): counters + streak + the OWNERSHIP-CONDITIONAL
//     gate clear, under revision discipline. From every reachable state the
//     book returns to submit-eligibility.
//
//   batch-side (mandateBatches/{providerBatchId}):
//     open → harvested   (provider ended; every entry disposed)
//     open → expired     (age-out past MANDATE_RESULT_MAX_AGE_MS, §6.4:
//                         provider batch cancelled best-effort, every
//                         undisposed entry → decision 'expired')
//     open → cancelled   (drain, F26: provider batch cancelled, every
//                         undisposed entry → decision 'rejected_stale')
//     A doc leaves 'open' only when every entry has a terminal decision — no
//     request is left in limbo while its siblings terminate (partial batches).
//
// CRASH WINDOWS (documented, converging — the audit walks each):
//   • crash before provider create → nothing recorded anywhere; books retry
//     the same slot on the next generous fire (liveness-optimal; Risk 7).
//   • crash after create, before the batch doc → provider-side orphan: no doc,
//     no gates, books re-submit next tick under NEW requestIds. The orphan is
//     never harvested; it expires provider-side (24h). Bounded token waste,
//     zero dangling state OUR side.
//   • crash after the doc, before/among gate writes → ZOMBIE requests: the
//     harvest still processes them (validation against the live book decides),
//     un-gated books may legitimately re-submit; duplicate custom_ids converge
//     on the decision-doc claim, and the ownership-conditional gate clear
//     keeps a zombie's terminal from releasing the live submission's gate.
//
// HARVEST-SIDE SERIALIZATION: each entry is processed under the book's
// owner-token lease (the P3 INV-3 idiom — read → bill → merge under one hold);
// correctness never rests on it (the §3.5 claim + revision precondition do
// that) — the lease only prevents duplicate billing/bookkeeping work. An entry
// whose lease is unavailable is left undisposed; the batch doc stays 'open'
// and the next fire retries it.

import {
  createMandateBatch,
  retrieveMandateBatch,
  mandateBatchResults,
  cancelMandateBatch,
  extractDecisionInput,
} from './mandateModelCall.js';
import { executeDecision, disposeSubmission } from './mandateExecution.js';
import { evaluateGate } from './mandateGate.js';
import { normalizeDecisionInput } from './mandateDecisionTool.js';
import { markFor, classifyBookTick, SNAPSHOT_COLLECTION } from './mandateUniverseSnapshot.js';
import { acquireLease, releaseLease, mintOwnerToken } from './mandateLease.js';
import { priceUsage, telemetryPatch } from './modelPriceTable.js';
import {
  MANDATE_SCHEMA_VERSION,
  MANDATE_RESULT_MAX_AGE_MS,
  MANDATE_BATCH_POLL_PAGE,
  MANDATE_QUARANTINE_THRESHOLD,
  MANDATE_STALE_STREAK_ALERT,
} from './mandateConfig.js';

const LOG_PREFIX = '[MandateBatch]';

export const MANDATE_BATCH_COLLECTION = 'mandateBatches';
export const MANDATE_BATCH_STATS_COLLECTION = 'mandateBatchStats';
export const MANDATE_BATCH_STATUSES = Object.freeze(['open', 'harvested', 'expired', 'cancelled']);

// ── Batch bookkeeping doc (§3.3 / §3.7) ──────────────────────────────────────

/**
 * The platform-side bookkeeping doc for one provider batch. `entries` is the
 * submit-time record — per requestId: the book, the model id (for harvest
 * billing without a second vintage read), the verb set the decision tool
 * offered (normalize against what the model SAW, gate against what the book IS
 * at harvest), and the full submission envelope (F1 — the base-state identity
 * harvest validation runs against). `disposed` accumulates terminal outcomes
 * as the harvest lands them; the doc leaves 'open' only at full coverage.
 */
export function buildBatchDoc({ providerBatchId, tickKey, sessionDate, submittedAt, providerCreatedAt = null, entries }) {
  return {
    schemaVersion: MANDATE_SCHEMA_VERSION,
    providerBatchId,
    tickKey,
    sessionDate,
    status: 'open',
    submittedAt,
    providerCreatedAt,
    requestCount: Object.keys(entries).length,
    entries,   // { [requestId]: { mandateId, model, verbs, envelope } }
    disposed: {}, // { [requestId]: terminal status } — merged as the harvest lands them
    endedAt: null,
    harvestedAt: null,
  };
}

// ── Submit (§3.3) ────────────────────────────────────────────────────────────

/**
 * Submit one tick's enqueued books as ONE provider batch, then bookkeep and
 * gate. ORDER IS THE CRASH-SAFETY DESIGN (header): provider create FIRST (a
 * pre-create crash costs nothing and retries this slot), the batch doc second,
 * per-book gate txns last (a partially-gated batch converges via the claim +
 * ownership rules).
 *
 * The GATE TXN is the §3.3 "revision-disciplined write": preconditioned on the
 * book still being at the envelope's baseRevision, active, same quarter, and
 * un-gated — but NOT revision-incrementing (stated reading, PR §readings): the
 * gate is submission bookkeeping, not book substance; the envelope binds
 * baseRevision to the state the model reasoned over, and every REAL mutation
 * (execution, close, rollover, escape) bumps revision and thereby invalidates
 * the submission at harvest. It also stamps execState.lastEvalTickKey — the
 * billed-eval stamp — atomically with the gate.
 *
 * @param {object} db
 * @param {Array<{ mandateRef, envelope, verbs, modelSeat, content }>} pending
 * @returns {Promise<{ providerBatchId:string|null, gated:number, zombies:string[] }>}
 */
export async function submitMandateBatch(db, pending, { tickKey, sessionDate, now = new Date() } = {}) {
  if (!pending || pending.length === 0) return { providerBatchId: null, gated: 0, zombies: [] };

  // 1. Provider create — the billing moment.
  const batch = await createMandateBatch(pending.map((p) => ({
    customId: p.envelope.requestId,
    modelSeat: p.modelSeat,
    content: p.content,
  })));
  const providerBatchId = batch.id;

  // 2. The bookkeeping doc (create — a duplicate id is impossible provider-side).
  const entries = {};
  for (const p of pending) {
    entries[p.envelope.requestId] = {
      mandateId: p.mandateRef.id,
      model: p.modelSeat?.model ?? null,
      verbs: p.verbs,
      envelope: p.envelope,
    };
  }
  await db.collection(MANDATE_BATCH_COLLECTION).doc(providerBatchId).set(
    buildBatchDoc({ providerBatchId, tickKey, sessionDate, submittedAt: now, providerCreatedAt: batch.created_at ?? null, entries }),
  );

  // 3. Per-book gate txns.
  let gated = 0;
  const zombies = [];
  for (const p of pending) {
    try {
      const ok = await db.runTransaction(async (tx) => {
        const snap = await tx.get(p.mandateRef);
        if (!snap.exists) return false;
        const book = snap.data();
        if (
          book.revision !== p.envelope.baseRevision
          || (book.execState?.openBatchId ?? null) !== null
          || book.status !== 'active'
          || book.quarterKey !== p.envelope.quarterKey
        ) return false;
        tx.update(p.mandateRef, {
          'execState.openBatchId': p.envelope.requestId,
          'execState.openBatchSubmittedAt': now,
          'execState.openProviderBatchId': providerBatchId,
          // The billed-eval stamp (within-slot idempotency) and the sweep
          // ordering key (F24/INV-4: every served book advances the frontier)
          // — atomically with the gate, replacing the per-book persistOutcome
          // the direct path does in the loop.
          'execState.lastEvalTickKey': tickKey,
          'health.lastEvalSweepAt': now,
        });
        return true;
      });
      if (ok) gated += 1;
      else zombies.push(p.envelope.requestId);
    } catch (err) {
      zombies.push(p.envelope.requestId);
      console.error(`${LOG_PREFIX} gate write failed for ${p.mandateRef.id} (${p.envelope.requestId}) — request rides as zombie: ${err.message}`);
    }
  }
  if (zombies.length > 0) {
    console.error(
      `${LOG_PREFIX} MANDATE_BATCH_ZOMBIE ${providerBatchId} — ${zombies.length} request(s) in flight without a gate `
      + '(book moved between eval read and gate write); results converge on the decision-doc claim',
    );
  }
  return { providerBatchId, gated, zombies };
}

// ── Harvest (§3.3) — poll open batches, dispose every entry ──────────────────

/** Provider result_type → the I1 terminal disposition for a result-less entry. */
function dispositionForResultType(type) {
  if (type === 'errored') return { status: 'failed', failCondition: null }; // failCondition filled with the error type
  if (type === 'canceled') return { status: 'cancelled', failCondition: 'provider_canceled' };
  if (type === 'expired') return { status: 'expired', failCondition: 'provider_expired' };
  return { status: 'failed', failCondition: `api_result_unknown:${type}` };
}

/**
 * Post-disposition per-book bookkeeping — the SAME health semantics as the
 * direct eval loop (mandate-evaluate.js): 'failed' increments
 * consecutiveEvalFailures (quarantine at threshold, alert AFTER the durable
 * flip); every other terminal is a completed eval (lastSuccessfulEvalAt,
 * failures reset). Telemetry bills any usage the result carried, at BATCH
 * rates. Runs under the entry's lease; skipped entirely on an idempotent
 * replay (a concurrent fire already bookkept it).
 */
async function bookkeepDisposition(mandateRef, book, outcome, { now, sessionDate, priced }) {
  const patch = { health: {} };
  if (outcome.status === 'failed') {
    const failures = (book.health?.consecutiveEvalFailures || 0) + 1;
    patch.health = { lastEvalSweepAt: now, consecutiveEvalFailures: failures };
    if (failures >= MANDATE_QUARANTINE_THRESHOLD && !book.health?.quarantined) patch.health.quarantined = true;
    if (priced) Object.assign(patch, telemetryPatch(book, sessionDate, priced) || {});
    await mandateRef.set(patch, { merge: true });
    if (patch.health.quarantined) {
      console.error(
        `${LOG_PREFIX} MANDATE_QUARANTINED ${mandateRef.id} — ${failures} consecutive eval failures; `
        + 'exit-only mode (tool restricted to SELL/TRIM/HOLD; still swept, still marked daily; '
        + 'founder restores by clearing BOTH health.quarantined AND health.consecutiveEvalFailures)',
      );
    }
    return;
  }
  patch.health = { lastEvalSweepAt: now, lastSuccessfulEvalAt: now, consecutiveEvalFailures: 0 };
  if (priced) Object.assign(patch, telemetryPatch(book, sessionDate, priced) || {});
  await mandateRef.set(patch, { merge: true });
  if ((outcome.staleRejectStreak || 0) >= MANDATE_STALE_STREAK_ALERT) {
    console.error(
      `${LOG_PREFIX} MANDATE_STALE_STREAK ${mandateRef.id} — ${outcome.staleRejectStreak} consecutive `
      + 'stale-rejected/expired submissions (I9 liveness)',
    );
  }
}

/**
 * Process ONE succeeded result through the full §3.3 path: extract → normalize
 * (against the verbs the model SAW) → classify the book at the CURRENT tick →
 * gate (against the book as it IS) → executeDecision (§3.5 claim-and-execute,
 * envelope validation inside). Returns the terminal outcome, or
 * { skipped:'lease' } when the book's lease is unavailable this fire.
 */
async function processSucceededResult(db, {
  entry, result, mandateRef, vintage, currentSnapshot, submitSnapshot, ownerToken, now, sessionDate,
}) {
  const requestId = entry.envelope.requestId;
  const lease = await acquireLease(db, mandateRef, ownerToken, { now });
  if (!lease.acquired) return { skipped: 'lease' };
  try {
    const freshSnap = await mandateRef.get();
    if (!freshSnap.exists) {
      return await disposeSubmission(db, { mandateRef, requestId, status: 'failed', failCondition: 'book_missing', envelope: entry.envelope });
    }
    const book = freshSnap.data();
    const usage = result?.message?.usage ?? null;
    const priced = usage ? priceUsage(entry.model, usage, { batch: true }) : null;

    // Vintage unreadable at harvest = the eval infrastructure failed (mirrors
    // the eval loop's no_vintage) — but under batch the submission EXISTS
    // durably, so it must still reach a terminal decision (I1), not a soft skip.
    if (!vintage) {
      const out = await disposeSubmission(db, { mandateRef, requestId, status: 'failed', failCondition: 'no_vintage', envelope: entry.envelope });
      if (!out.idempotent) await bookkeepDisposition(mandateRef, book, { ...out, status: 'failed' }, { now, sessionDate, priced });
      return out;
    }

    const extracted = extractDecisionInput(result.message);
    if (!extracted.ok) {
      const out = await disposeSubmission(db, { mandateRef, requestId, status: 'failed', failCondition: extracted.reason || 'model_no_tool_use', envelope: entry.envelope });
      if (!out.idempotent) await bookkeepDisposition(mandateRef, book, { ...out, status: 'failed' }, { now, sessionDate, priced });
      return out;
    }
    const norm = normalizeDecisionInput(extracted.input, { verbs: entry.verbs });
    if (!norm.ok) {
      const out = await disposeSubmission(db, { mandateRef, requestId, status: 'failed', failCondition: `bad_decision:${norm.reason}`, envelope: entry.envelope });
      if (!out.idempotent) await bookkeepDisposition(mandateRef, book, { ...out, status: 'failed' }, { now, sessionDate, priced });
      return out;
    }
    const decision = norm.decision;

    // Current-tick context (ONE classifier with the eval path — drift-proof).
    const { actionable, caFrozen, evalSnapshot } = classifyBookTick(book, currentSnapshot, { now, sessionDate });
    const quarantined = !!book.health?.quarantined;
    const gateResult = evaluateGate({
      decision,
      positions: book.portfolio?.positions || {},
      cash: book.portfolio?.cash || 0,
      snapshot: evalSnapshot,
      gateConfig: vintage.gateConfig || {},
      actionableHeld: actionable,
      quarantined,
      caFrozen,
    });

    // I3 drift-guard basis: the mark the model reasoned over, from the SUBMIT
    // tick's (durable, 120-day-retained) snapshot. A missing submit snapshot →
    // null → entries fail closed at the drift guard; exits are never subject.
    const submitMark = decision.ticker ? markFor(submitSnapshot, decision.ticker) : null;

    const out = await executeDecision(db, {
      mandateRef, decisionId: requestId, decision, gateResult, envelope: entry.envelope,
      snapshot: currentSnapshot, submitMark, currentSessionDate: sessionDate, now, caFrozen,
    });
    if (!out.idempotent) {
      await bookkeepDisposition(mandateRef, book, out, { now, sessionDate, priced });
    }
    return out;
  } finally {
    await releaseLease(db, mandateRef, ownerToken).catch(() => {});
  }
}

/** Merge one entry's terminal status into the batch doc's disposed map. */
async function markDisposed(db, providerBatchId, requestId, status) {
  await db.collection(MANDATE_BATCH_COLLECTION).doc(providerBatchId).set(
    { disposed: { [requestId]: status } },
    { merge: true },
  );
}

/**
 * Finalize a fully-disposed batch doc: terminal status + turnaround telemetry
 * (I9 — the top-risk instrument) + the per-day stats sample (§6.4/acceptance
 * #8: submit→result distribution, persisted observably).
 */
async function finalizeBatch(db, batchDoc, { status, endedAt, now, dispositions }) {
  const submittedAtMs = toMs(batchDoc.submittedAt);
  const endedMs = toMs(endedAt);
  const turnaroundMs = submittedAtMs != null && endedMs != null ? endedMs - submittedAtMs : null;
  const harvestLagMs = submittedAtMs != null ? now.getTime() - submittedAtMs : null;
  await db.collection(MANDATE_BATCH_COLLECTION).doc(batchDoc.providerBatchId).set({
    status, endedAt: endedAt ?? null, harvestedAt: now, turnaroundMs, harvestLagMs,
  }, { merge: true });
  await db.collection(MANDATE_BATCH_STATS_COLLECTION).doc(batchDoc.sessionDate).set({
    schemaVersion: MANDATE_SCHEMA_VERSION,
    date: batchDoc.sessionDate,
    batches: {
      [batchDoc.providerBatchId]: {
        tickKey: batchDoc.tickKey,
        status,
        submittedAt: batchDoc.submittedAt ?? null,
        endedAt: endedAt ?? null,
        harvestedAt: now,
        turnaroundMs,
        harvestLagMs,
        requestCount: batchDoc.requestCount ?? Object.keys(batchDoc.entries || {}).length,
        dispositions,
      },
    },
  }, { merge: true });
  console.log(
    `${LOG_PREFIX} batch ${batchDoc.providerBatchId} ${status} — turnaround ${turnaroundMs != null ? `${Math.round(turnaroundMs / 1000)}s` : 'n/a'}, `
    + `harvest lag ${harvestLagMs != null ? `${Math.round(harvestLagMs / 1000)}s` : 'n/a'} (I9)`,
  );
}

function toMs(v) {
  if (v == null) return null;
  if (v instanceof Date) return v.getTime();
  if (typeof v?.toDate === 'function') return v.toDate().getTime();
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}

/** Count dispositions {status: n} from a disposed map. */
function countDispositions(disposed) {
  const out = {};
  for (const s of Object.values(disposed || {})) out[s] = (out[s] || 0) + 1;
  return out;
}

/**
 * The HARVEST (§3.3): poll every open batch; dispose what can be disposed.
 * Runs BEFORE submission on every batch-mode eval fire. `currentSnapshot` is
 * the tick's snapshot — or a minimal `{ tickKey, symbols:{} }` context on a
 * failed-snapshot tick (§3.1 "the tick harvests but does not submit"): entries
 * then fail closed at the universe/drift gates while exits still fill at
 * carry-over marks (C-21 holds even degraded).
 *
 * @returns {Promise<{ polled:number, harvested:number, expired:number, disposed:number, leaseSkips:number, errors:number }>}
 */
export async function harvestOpenBatches(db, {
  currentSnapshot, sessionDate, ownerToken, now = new Date(), deadlineMs = Infinity,
}) {
  const summary = { polled: 0, harvested: 0, expired: 0, disposed: 0, leaseSkips: 0, errors: 0 };
  let openSnap;
  try {
    openSnap = await db.collection(MANDATE_BATCH_COLLECTION)
      .where('status', '==', 'open')
      .limit(MANDATE_BATCH_POLL_PAGE)
      .get();
  } catch (err) {
    summary.errors += 1;
    console.error(`${LOG_PREFIX} open-batch query failed: ${err.message}`);
    return summary;
  }

  const vintageCache = new Map();
  for (const docSnap of openSnap.docs || []) {
    if (Date.now() > deadlineMs) break; // remaining batches stay open for the next fire
    const batchDoc = docSnap.data();
    summary.polled += 1;
    try {
      const res = await harvestOneBatch(db, batchDoc, {
        currentSnapshot, sessionDate, ownerToken, now, vintageCache,
      });
      summary.disposed += res.disposed;
      summary.leaseSkips += res.leaseSkips;
      summary.errors += res.errors;
      if (res.finalized === 'harvested') summary.harvested += 1;
      if (res.finalized === 'expired') summary.expired += 1;
    } catch (err) {
      summary.errors += 1;
      console.error(`${LOG_PREFIX} harvest failed for ${batchDoc.providerBatchId} (stays open, retried next fire): ${err.message}`);
    }
  }
  return summary;
}

/** Harvest one open batch doc (exported for the drain/interleaving tests). */
export async function harvestOneBatch(db, batchDoc, {
  currentSnapshot, sessionDate, ownerToken, now = new Date(), vintageCache = new Map(),
}) {
  const res = { disposed: 0, leaseSkips: 0, errors: 0, finalized: null };
  const providerBatchId = batchDoc.providerBatchId;
  const disposed = { ...(batchDoc.disposed || {}) };
  const undisposed = Object.entries(batchDoc.entries || {}).filter(([rid]) => !disposed[rid]);

  // Age-out (§6.4 / I1): a batch older than MANDATE_RESULT_MAX_AGE_MS is
  // EXPIRED as a disposition, not merely alerted — whatever the provider says.
  // Its results would fail harvest validation condition 4 anyway; expiring at
  // the batch level also stops paying for a dead batch (cancel, best-effort).
  const ageMs = now.getTime() - (toMs(batchDoc.submittedAt) ?? now.getTime());
  if (ageMs > MANDATE_RESULT_MAX_AGE_MS) {
    try { await cancelMandateBatch(providerBatchId); } catch (err) {
      console.error(`${LOG_PREFIX} provider cancel failed for aged-out ${providerBatchId} (dispositions proceed): ${err.message}`);
    }
    for (const [requestId, entry] of undisposed) {
      const out = await disposeExpiredEntry(db, entry, requestId, { now, sessionDate, ownerToken });
      if (out.skipped === 'lease') { res.leaseSkips += 1; continue; }
      disposed[requestId] = out.status;
      await markDisposed(db, providerBatchId, requestId, out.status);
      res.disposed += 1;
    }
    if (Object.keys(disposed).length >= Object.keys(batchDoc.entries || {}).length) {
      await finalizeBatch(db, batchDoc, { status: 'expired', endedAt: null, now, dispositions: countDispositions(disposed) });
      res.finalized = 'expired';
    }
    return res;
  }

  // Poll the provider.
  let provider;
  try {
    provider = await retrieveMandateBatch(providerBatchId);
  } catch (err) {
    res.errors += 1;
    console.error(`${LOG_PREFIX} retrieve failed for ${providerBatchId} (stays open; age-out backstops): ${err.message}`);
    return res;
  }
  if (provider.processing_status !== 'ended') return res; // still in flight — nothing to do this fire

  // Collect the results stream once.
  const resultsById = new Map();
  const stream = await mandateBatchResults(providerBatchId);
  for await (const r of stream) resultsById.set(r.custom_id, r.result);

  // The submit tick's snapshot — the I3 drift-guard basis — read ONCE per batch.
  let submitSnapshot = null;
  try {
    const snap = await db.collection(SNAPSHOT_COLLECTION).doc(batchDoc.tickKey).get();
    submitSnapshot = snap.exists ? snap.data() : null;
  } catch (err) {
    console.error(`${LOG_PREFIX} submit-tick snapshot read failed for ${batchDoc.tickKey} — entries fail closed at the drift guard: ${err.message}`);
  }

  for (const [requestId, entry] of undisposed) {
    const mandateRef = db.collection('mandates').doc(entry.mandateId);
    const result = resultsById.get(requestId);
    let out;
    try {
      if (result?.type === 'succeeded') {
        let vintage = vintageCache.get(entry.envelope.vintageRef);
        if (vintage === undefined) {
          try {
            const vSnap = await db.doc(entry.envelope.vintageRef).get();
            vintage = vSnap.exists ? vSnap.data() : null;
          } catch { vintage = null; }
          vintageCache.set(entry.envelope.vintageRef, vintage);
        }
        out = await processSucceededResult(db, {
          entry, result, mandateRef, vintage, currentSnapshot, submitSnapshot, ownerToken, now, sessionDate,
        });
      } else if (result == null) {
        // Provider returned no row for this request — the "missing" half of the
        // partial-batch rule (missing/expired → expired). Never left in limbo.
        out = await disposeExpiredEntry(db, entry, requestId, { now, sessionDate, ownerToken, failCondition: 'result_missing' });
      } else {
        const d = dispositionForResultType(result.type);
        const failCondition = result.type === 'errored'
          ? `api_error:${result.error?.type ?? result.error?.error?.type ?? 'unknown'}`
          : d.failCondition;
        out = await disposeWithBookkeeping(db, entry, requestId, {
          mandateRef, status: d.status, failCondition, now, sessionDate, ownerToken,
        });
      }
    } catch (err) {
      res.errors += 1;
      console.error(`${LOG_PREFIX} entry ${requestId} harvest failed (undisposed, retried next fire): ${err.message}`);
      continue;
    }
    if (out.skipped === 'lease') { res.leaseSkips += 1; continue; }
    disposed[requestId] = out.status;
    await markDisposed(db, providerBatchId, requestId, out.status);
    res.disposed += 1;
  }

  if (Object.keys(disposed).length >= Object.keys(batchDoc.entries || {}).length) {
    await finalizeBatch(db, batchDoc, {
      status: 'harvested', endedAt: provider.ended_at ?? null, now, dispositions: countDispositions(disposed),
    });
    res.finalized = 'harvested';
  }
  return res;
}

/** Dispose one entry 'expired' (age-out / provider-expired / missing result) with health bookkeeping. */
async function disposeExpiredEntry(db, entry, requestId, { now, sessionDate, ownerToken, failCondition = 'result_age' }) {
  const mandateRef = db.collection('mandates').doc(entry.mandateId);
  return disposeWithBookkeeping(db, entry, requestId, { mandateRef, status: 'expired', failCondition, now, sessionDate, ownerToken });
}

/**
 * Terminal disposition (no result to execute) under the book's lease (the
 * FIRE's minted owner token — never a synthesized one, or two concurrent fires
 * would hold "the same" lease), with the same health bookkeeping as every
 * other harvest outcome. Lease-unavailable → { skipped:'lease' } (undisposed;
 * retried next fire).
 */
async function disposeWithBookkeeping(db, entry, requestId, { mandateRef, status, failCondition, now, sessionDate, ownerToken }) {
  const lease = await acquireLease(db, mandateRef, ownerToken, { now });
  if (!lease.acquired) return { skipped: 'lease' };
  try {
    const freshSnap = await mandateRef.get();
    const book = freshSnap.exists ? freshSnap.data() : null;
    const out = await disposeSubmission(db, {
      mandateRef, requestId, status, failCondition, envelope: entry.envelope,
    });
    if (book && !out.idempotent) {
      await bookkeepDisposition(mandateRef, book, out, { now, sessionDate, priced: null });
    }
    return out;
  } finally {
    await releaseLease(db, mandateRef, ownerToken).catch(() => {});
  }
}

// ── Drain protocol (§3.3 / F26) — explicit, invocable, founder-gated ─────────

/**
 * Drain every open batch: cancel provider-side (best-effort), write every
 * undisposed entry's decision `rejected_stale` (failCondition
 * 'drained_transport_change'), mark the batch doc `cancelled`. The §3.3 drain
 * language and the I1 terminal set are reconciled EXPLICITLY here (audit §
 * drain): the BATCH is cancelled; each undelivered request's DECISION records
 * the §3.3 drain disposition — rejected_stale — because a drain is a staleness
 * event by fiat (the mode is changing; results must not be applied), while the
 * I1 word 'cancelled' remains the ROLLOVER/ESCAPE lifecycle-disposal status.
 * Never an implicit side effect of a mode flip: this runs only when invoked
 * (founder endpoint api/mandate/drain.js).
 *
 * @returns {Promise<{ batches:number, disposed:number, leaseSkips:number, errors:number }>}
 */
export async function drainOpenBatches(db, { now = new Date(), ownerToken = mintOwnerToken() } = {}) {
  const summary = { batches: 0, disposed: 0, leaseSkips: 0, errors: 0 };
  const openSnap = await db.collection(MANDATE_BATCH_COLLECTION)
    .where('status', '==', 'open')
    .limit(MANDATE_BATCH_POLL_PAGE)
    .get();

  for (const docSnap of openSnap.docs || []) {
    const batchDoc = docSnap.data();
    summary.batches += 1;
    try { await cancelMandateBatch(batchDoc.providerBatchId); } catch (err) {
      console.error(`${LOG_PREFIX} drain: provider cancel failed for ${batchDoc.providerBatchId} (dispositions proceed): ${err.message}`);
    }
    const disposed = { ...(batchDoc.disposed || {}) };
    let allDisposed = true;
    for (const [requestId, entry] of Object.entries(batchDoc.entries || {})) {
      if (disposed[requestId]) continue;
      const mandateRef = db.collection('mandates').doc(entry.mandateId);
      let out;
      try {
        out = await disposeWithBookkeeping(db, entry, requestId, {
          mandateRef, status: 'rejected_stale', failCondition: 'drained_transport_change',
          now, sessionDate: batchDoc.sessionDate, ownerToken,
        });
      } catch (err) {
        summary.errors += 1;
        allDisposed = false;
        console.error(`${LOG_PREFIX} drain: entry ${requestId} failed: ${err.message}`);
        continue;
      }
      if (out.skipped === 'lease') { summary.leaseSkips += 1; allDisposed = false; continue; }
      disposed[requestId] = out.status;
      await markDisposed(db, batchDoc.providerBatchId, requestId, out.status);
      summary.disposed += 1;
    }
    if (allDisposed) {
      await finalizeBatch(db, batchDoc, { status: 'cancelled', endedAt: null, now, dispositions: countDispositions(disposed) });
    } else {
      console.error(`${LOG_PREFIX} drain: ${batchDoc.providerBatchId} left open (lease-skips/errors) — re-invoke to complete`);
    }
  }
  return summary;
}
