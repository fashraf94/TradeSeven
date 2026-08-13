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
//     Result-bearing terminals flow through executeDecision; result-less ones
//     through disposeSubmission — both share execStateTerminalPatch
//     (mandateExecution.js): counters + streak + the OWNERSHIP-CONDITIONAL
//     gate clear, under revision discipline. (The three LIFECYCLE disposal
//     paths — close-pass expiry, rollover cancel, escape cancel — predate P5,
//     clear the gate via the shared clearedOpenSubmissionPatch, and by P3/P4
//     reviewed design do NOT move the submitted counter; the streak remains
//     the primary liveness wire. Documented asymmetry, audit §5.)
//     From every reachable state the book returns to submit-eligibility.
//
//   batch-side (mandateBatches/{providerBatchId}):
//     open → harvested   (provider ended; every entry disposed)
//     open → expired     (aged out past MANDATE_RESULT_MAX_AGE_MS, §6.4:
//                         provider batch cancelled best-effort, every
//                         undisposed entry → decision 'expired'; the doc then
//                         WAITS for the provider to end so any pre-cancel
//                         usage is still billed, and gives up loudly at the
//                         billing-give-up horizon)
//     open → cancelled   (drain, F26: provider batch cancelled, every
//                         undisposed entry → decision 'rejected_stale')
//     A doc leaves 'open' only when every entry has a terminal decision — no
//     request is left in limbo while its siblings terminate (partial batches).
//     Finalization is a TRANSACTION conditioned on the doc still being 'open'
//     with the disposed map re-read inside it, so two racing fires cannot
//     write divergent terminal statuses or undercounted dispositions.
//
// BILLING (§6.2 — "accumulate cost telemetry for any BILLED call, whatever
// the outcome"): provider billing happens at batch creation; OUR record lands
// at harvest from each result's reported usage, at batch rates. The batch
// doc's `billed` map makes that exactly-once per request INDEPENDENTLY of the
// decision claim — so a result whose terminal was claimed elsewhere (close-
// pass expiry, rollover/escape cancel) still gets its real spend recorded
// when the result arrives (P5 review MONEY-P5-1 / INV-P5-9). Spend that can
// never be observed (a batch that never ends, an orphan with no doc) is
// counted and alerted as MANDATE_BATCH_UNBILLED_SPEND — understatement is
// loud, never silent.
//
// CRASH WINDOWS (documented, converging — the audit walks each):
//   • crash before provider create → the enqueue stamps already landed under
//     each book's lease (mandate-evaluate.js), so the slot skips those books
//     on later fires; they submit fresh next slot. No spend, no gates.
//   • crash after create, before the batch doc → provider-side orphan: no
//     doc, no gates; books (stamped) submit fresh next slot under NEW
//     requestIds. The orphan expires provider-side (24h). Bounded token
//     waste, alerted as unobservable spend only in the ops runbook — there is
//     no our-side record to alert from.
//   • crash after the doc, before/among gate writes → ZOMBIE requests: the
//     harvest still processes them (validation against the live book
//     decides); duplicate custom_ids converge on the decision-doc claim, and
//     the ownership-conditional gate clear keeps a zombie's terminal from
//     releasing the live submission's gate.
//
// HARVEST-SIDE SERIALIZATION: each entry is processed under the book's
// owner-token lease (the P3 INV-3 idiom — read → bill → merge under one
// hold); correctness never rests on it (the §3.5 claim + revision
// precondition do that). An entry whose lease is unavailable is left
// undisposed; the batch doc stays 'open' and the next fire retries it. A
// lease refusal because the BOOK DOC IS GONE (`no_such_book`) is not
// contention — the entry is disposed without a lease (there is no book state
// left to serialize) so the batch doc still converges (I1).

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
import { frictionForDecision } from './mandateFrictionModel.js';
import { acquireLease, releaseLease, mintOwnerToken } from './mandateLease.js';
import { priceUsage, telemetryPatch } from './modelPriceTable.js';
import {
  MANDATE_SCHEMA_VERSION,
  MANDATE_RESULT_MAX_AGE_MS,
  MANDATE_BATCH_POLL_PAGE,
  MANDATE_BATCH_BILLING_GIVEUP_MS,
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
 * harvest validation runs against). `disposed` accumulates terminal outcomes;
 * `billed` accumulates usage-accounting marks (independent of `disposed` —
 * see the BILLING header note); the doc leaves 'open' only at full disposed
 * coverage.
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
    disposed: {}, // { [requestId]: terminal status }
    billed: {},   // { [requestId]: true } — usage accounting settled for this request
    agedOutAt: null,       // set when the age-out disposed the entries; doc then waits for provider end (billing)
    drainRequested: false, // set by the F26 drain BEFORE cancelling — later-arriving 'canceled' rows keep the drain disposition
    endedAt: null,
    harvestedAt: null,
  };
}

// ── Submit (§3.3) ────────────────────────────────────────────────────────────

/**
 * Submit one tick's enqueued books as ONE provider batch, then bookkeep and
 * gate. ORDER IS THE CRASH-SAFETY DESIGN (header): provider create FIRST, the
 * batch doc second, per-book gate txns last. The within-slot billing stamp
 * (`execState.lastEvalTickKey`) was ALREADY written under each book's lease at
 * enqueue time (P5 review INV-P5-1: stamping only here left the whole page
 * re-enqueueable by an overlapping generous fire — double provider spend on
 * routine cron overlap); the gate txn re-asserts it atomically with the gate.
 *
 * The GATE TXN is the §3.3 "revision-disciplined write": preconditioned on the
 * book still being at the envelope's baseRevision, active, same quarter, and
 * un-gated — but NOT revision-incrementing (stated reading, audit §5): the
 * gate is submission bookkeeping, not book substance; the envelope binds
 * baseRevision to the state the model reasoned over, and every REAL mutation
 * bumps revision and thereby invalidates the submission at harvest.
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
          // Re-asserted atomically with the gate (first written at enqueue,
          // under the lease — the INV-P5-1 idempotency fix).
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

/**
 * Provider result_type → the I1 terminal disposition for a result-less entry.
 * A 'canceled' row on a DRAIN-marked batch keeps the §3.3 drain disposition
 * (rejected_stale / drained_transport_change) — a partially-drained batch's
 * stragglers must not flip to the lifecycle word and reset the I9 streak
 * (P5 review SPEC-P5-3).
 */
function dispositionForResultType(type, { drainRequested = false } = {}) {
  if (type === 'errored') return { status: 'failed', failCondition: null }; // failCondition filled with the error type
  if (type === 'canceled') {
    return drainRequested
      ? { status: 'rejected_stale', failCondition: 'drained_transport_change' }
      : { status: 'cancelled', failCondition: 'provider_canceled' };
  }
  if (type === 'expired') return { status: 'expired', failCondition: 'provider_expired' };
  return { status: 'failed', failCondition: `api_result_unknown:${type}` };
}

/**
 * Post-disposition per-book HEALTH bookkeeping. Delivered answers
 * (executed / gated / rejected_stale) are completed evals; `failed` AND
 * `expired` are UNDELIVERED cycles and count as eval failures (quarantine at
 * threshold) — a transport that never delivers must not look healthy or keep
 * `agencyState:'full'` (P5 review C21-P5-6); `cancelled` is lifecycle, touches
 * neither. Streak alerting rides the disposition result. Runs under the
 * entry's lease; callers skip it on idempotent replays.
 */
async function bookkeepHealth(mandateRef, book, outcome, { now }) {
  const status = outcome.status;
  if (status === 'failed' || status === 'expired') {
    const failures = (book.health?.consecutiveEvalFailures || 0) + 1;
    const health = { lastEvalSweepAt: now, consecutiveEvalFailures: failures };
    if (failures >= MANDATE_QUARANTINE_THRESHOLD && !book.health?.quarantined) health.quarantined = true;
    await mandateRef.set({ health }, { merge: true });
    if (health.quarantined) {
      console.error(
        `${LOG_PREFIX} MANDATE_QUARANTINED ${mandateRef.id} — ${failures} consecutive eval failures; `
        + 'exit-only mode (tool restricted to SELL/TRIM/HOLD; still swept, still marked daily; '
        + 'founder restores by clearing BOTH health.quarantined AND health.consecutiveEvalFailures)',
      );
    }
  } else if (status === 'cancelled') {
    await mandateRef.set({ health: { lastEvalSweepAt: now } }, { merge: true });
  } else {
    await mandateRef.set({ health: { lastEvalSweepAt: now, lastSuccessfulEvalAt: now, consecutiveEvalFailures: 0 } }, { merge: true });
  }
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
 * base-validation before the gate inside). Bills the result's real usage at
 * batch rates exactly once per request via the caller-held `alreadyBilled`
 * mark — INCLUDING when the terminal was already claimed by another path
 * (close-pass expiry / lifecycle cancel): the spend was real either way.
 *
 * @returns {{ …terminal | skipped:'lease', billedUsage?: true }}
 */
async function processSucceededResult(db, {
  entry, result, mandateRef, vintage, currentSnapshot, submitSnapshot, ownerToken, now, sessionDate, alreadyBilled = false,
}) {
  const requestId = entry.envelope.requestId;
  const lease = await acquireLease(db, mandateRef, ownerToken, { now });
  if (!lease.acquired) {
    if (lease.reason !== 'no_such_book') return { skipped: 'lease' };
    // Book gone (out-of-band delete): no state to serialize or bill against —
    // still claim the terminal so the batch doc converges (I1).
    const out = await disposeSubmission(db, { mandateRef, requestId, status: 'failed', failCondition: 'book_missing', envelope: entry.envelope });
    return { ...out, billedUsage: true };
  }
  try {
    const freshSnap = await mandateRef.get();
    if (!freshSnap.exists) {
      const out = await disposeSubmission(db, { mandateRef, requestId, status: 'failed', failCondition: 'book_missing', envelope: entry.envelope });
      return { ...out, billedUsage: true };
    }
    const book = freshSnap.data();
    const usage = result?.message?.usage ?? null;
    const priced = usage ? priceUsage(entry.model, usage, { batch: true }) : null;

    const billUnderLease = async (bookForPatch) => {
      if (alreadyBilled || !priced) return false;
      const patch = telemetryPatch(bookForPatch, sessionDate, priced);
      if (patch) await mandateRef.set(patch, { merge: true });
      return true;
    };

    // Vintage unreadable at harvest = the eval infrastructure failed (mirrors
    // the eval loop's no_vintage) — but under batch the submission EXISTS
    // durably, so it must still reach a terminal decision (I1), not a soft skip.
    if (!vintage) {
      const out = await disposeSubmission(db, { mandateRef, requestId, status: 'failed', failCondition: 'no_vintage', envelope: entry.envelope });
      const billedNow = await billUnderLease(book);
      if (!out.idempotent) await bookkeepHealth(mandateRef, book, out, { now });
      return { ...out, ...(billedNow ? { billedUsage: true } : {}) };
    }

    const extracted = extractDecisionInput(result.message);
    if (!extracted.ok) {
      const out = await disposeSubmission(db, { mandateRef, requestId, status: 'failed', failCondition: extracted.reason || 'model_no_tool_use', envelope: entry.envelope });
      const billedNow = await billUnderLease(book);
      if (!out.idempotent) await bookkeepHealth(mandateRef, book, out, { now });
      return { ...out, ...(billedNow ? { billedUsage: true } : {}) };
    }
    const norm = normalizeDecisionInput(extracted.input, { verbs: entry.verbs });
    if (!norm.ok) {
      const out = await disposeSubmission(db, { mandateRef, requestId, status: 'failed', failCondition: `bad_decision:${norm.reason}`, envelope: entry.envelope });
      const billedNow = await billUnderLease(book);
      if (!out.idempotent) await bookkeepHealth(mandateRef, book, out, { now });
      return { ...out, ...(billedNow ? { billedUsage: true } : {}) };
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

    // FRICTION TIER (P5 review MONEY-P5-2): market cap is split-invariant and
    // slow-moving, so when the CURRENT snapshot cannot tier the symbol (the
    // degraded/failed-snapshot harvest — symbols:{}), the SUBMIT snapshot's
    // cap does — a $3T mega-cap's carry-over exit must never pay the
    // 'unknown' 20bps tier for want of a doc the platform failed to build
    // (the exact P3 money-review finding-4 class, batch edition).
    const tickerEntry = decision.ticker ? currentSnapshot?.symbols?.[decision.ticker] : null;
    const frictionSource = tickerEntry?.marketCap != null ? currentSnapshot : (submitSnapshot ?? currentSnapshot);
    const friction = frictionForDecision(decision, frictionSource);

    const out = await executeDecision(db, {
      mandateRef, decisionId: requestId, decision, gateResult, envelope: entry.envelope,
      snapshot: currentSnapshot, submitMark, currentSessionDate: sessionDate, now, caFrozen, friction,
    });
    const billedNow = await billUnderLease(book);
    if (!out.idempotent) {
      await bookkeepHealth(mandateRef, book, out, { now });
    }
    return { ...out, ...(billedNow ? { billedUsage: true } : {}) };
  } finally {
    await releaseLease(db, mandateRef, ownerToken).catch(() => {});
  }
}

/** Merge one entry's terminal status (and/or billing mark) into the batch doc. */
async function markEntry(db, providerBatchId, requestId, { status = null, billed = false }) {
  const patch = {};
  if (status != null) patch.disposed = { [requestId]: status };
  if (billed) patch.billed = { [requestId]: true };
  if (Object.keys(patch).length === 0) return;
  await db.collection(MANDATE_BATCH_COLLECTION).doc(providerBatchId).set(patch, { merge: true });
}

/**
 * Finalize a fully-disposed batch doc: terminal status + turnaround telemetry
 * (I9 — the top-risk instrument) + the per-day stats sample (acceptance #8).
 * A TRANSACTION conditioned on the doc still being 'open', with the disposed
 * map re-read inside it — two racing fires cannot write divergent terminal
 * statuses or undercounted dispositions (P5 review INV-P5-11). The stats
 * sample is written after the txn commits (idempotent by batch-id key).
 */
async function finalizeBatch(db, providerBatchId, { status, endedAt, now, unbilledCount = 0 }) {
  const docRef = db.collection(MANDATE_BATCH_COLLECTION).doc(providerBatchId);
  const finalized = await db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    if (!snap.exists) return null;
    const doc = snap.data();
    if (doc.status !== 'open') return null; // another fire already finalized — keep its record
    const submittedAtMs = toMs(doc.submittedAt);
    const endedMs = toMs(endedAt);
    const turnaroundMs = submittedAtMs != null && endedMs != null ? endedMs - submittedAtMs : null;
    const harvestLagMs = submittedAtMs != null ? now.getTime() - submittedAtMs : null;
    tx.update(docRef, {
      status, endedAt: endedAt ?? null, harvestedAt: now, turnaroundMs, harvestLagMs,
      ...(unbilledCount > 0 ? { unbilledRequestCount: unbilledCount } : {}),
    });
    return { doc, turnaroundMs, harvestLagMs };
  });
  if (!finalized) return false;
  const { doc, turnaroundMs, harvestLagMs } = finalized;
  await db.collection(MANDATE_BATCH_STATS_COLLECTION).doc(doc.sessionDate).set({
    schemaVersion: MANDATE_SCHEMA_VERSION,
    date: doc.sessionDate,
    batches: {
      [providerBatchId]: {
        tickKey: doc.tickKey,
        status,
        submittedAt: doc.submittedAt ?? null,
        endedAt: endedAt ?? null,
        harvestedAt: now,
        turnaroundMs,
        harvestLagMs,
        requestCount: doc.requestCount ?? Object.keys(doc.entries || {}).length,
        dispositions: countDispositions(doc.disposed),
        ...(unbilledCount > 0 ? { unbilledRequestCount: unbilledCount } : {}),
      },
    },
  }, { merge: true });
  if (unbilledCount > 0) {
    console.error(
      `${LOG_PREFIX} MANDATE_BATCH_UNBILLED_SPEND ${providerBatchId} — ${unbilledCount} request(s) whose provider `
      + 'spend could not be observed (batch never ended within the billing horizon); cost telemetry understates by '
      + 'up to that many requests — reconcile against the provider console (§6.2 honesty rule)',
    );
  }
  console.log(
    `${LOG_PREFIX} batch ${providerBatchId} ${status} — turnaround ${turnaroundMs != null ? `${Math.round(turnaroundMs / 1000)}s` : 'n/a'}, `
    + `harvest lag ${harvestLagMs != null ? `${Math.round(harvestLagMs / 1000)}s` : 'n/a'} (I9)`,
  );
  return true;
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
 * @returns {Promise<{ polled:number, harvested:number, expired:number, disposed:number, billedEntries:number, leaseSkips:number, errors:number }>}
 */
export async function harvestOpenBatches(db, {
  currentSnapshot, sessionDate, ownerToken, now = new Date(), deadlineMs = Infinity,
}) {
  const summary = { polled: 0, harvested: 0, expired: 0, disposed: 0, billedEntries: 0, leaseSkips: 0, errors: 0 };
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
        currentSnapshot, sessionDate, ownerToken, now, vintageCache, deadlineMs,
      });
      summary.disposed += res.disposed;
      summary.billedEntries += res.billedEntries;
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
  currentSnapshot, sessionDate, ownerToken, now = new Date(), vintageCache = new Map(), deadlineMs = Infinity,
}) {
  const res = { disposed: 0, billedEntries: 0, leaseSkips: 0, errors: 0, finalized: null };
  const providerBatchId = batchDoc.providerBatchId;
  const disposed = { ...(batchDoc.disposed || {}) };
  const billed = { ...(batchDoc.billed || {}) };
  const entryCount = Object.keys(batchDoc.entries || {}).length;
  // FAIL-CLOSED age (P5 review C21-P5-5): a missing/unparseable submittedAt is
  // infinitely old, never freshly born — the age-out is the liveness backstop
  // and must not be defeated by a corrupt field.
  const submittedMs = toMs(batchDoc.submittedAt);
  const ageMs = submittedMs != null ? now.getTime() - submittedMs : Infinity;

  // 1. POLL FIRST (P5 review MONEY-P5-1/-3): an ended batch is harvested
  // normally whatever its age — §3.3 validation expires stale results
  // per-request (condition 4) with honest conditions AND the real usage gets
  // billed. Only a still-in-flight batch can age out.
  let provider = null;
  let retrieveFailed = false;
  try {
    provider = await retrieveMandateBatch(providerBatchId);
  } catch (err) {
    retrieveFailed = true;
    console.error(`${LOG_PREFIX} retrieve failed for ${providerBatchId} (age-out backstops): ${err.message}`);
  }

  if (provider?.processing_status !== 'ended') {
    if (ageMs <= MANDATE_RESULT_MAX_AGE_MS) {
      if (retrieveFailed) res.errors += 1;
      return res; // in flight and fresh — nothing to do this fire
    }
    // 2. AGE-OUT (§6.4 / I1): dispose every entry 'expired' NOW (books return
    // to submit-eligibility immediately); cancel provider-side (best-effort,
    // once); do NOT finalize yet — the doc waits for the provider to end so
    // pre-cancel usage is still billable, and gives up loudly at the horizon.
    if (!batchDoc.agedOutAt) {
      try { await cancelMandateBatch(providerBatchId); } catch (err) {
        console.error(`${LOG_PREFIX} provider cancel failed for aged-out ${providerBatchId} (dispositions proceed): ${err.message}`);
      }
      await db.collection(MANDATE_BATCH_COLLECTION).doc(providerBatchId).set({ agedOutAt: now }, { merge: true });
    }
    for (const [requestId, entry] of Object.entries(batchDoc.entries || {})) {
      if (disposed[requestId]) continue;
      if (Date.now() > deadlineMs) return res;
      let out;
      try {
        out = await disposeResultlessEntry(db, entry, requestId, {
          now, sessionDate, ownerToken, status: 'expired', failCondition: 'result_age',
        });
      } catch (err) {
        res.errors += 1;
        console.error(`${LOG_PREFIX} age-out disposal failed for ${requestId} (retried next fire): ${err.message}`);
        continue;
      }
      if (out.skipped === 'lease') { res.leaseSkips += 1; continue; }
      disposed[requestId] = out.status;
      await markEntry(db, providerBatchId, requestId, { status: out.status });
      res.disposed += 1;
    }
    // Billing give-up horizon: a batch that never ends cannot be billed — say
    // so loudly and finalize rather than polling forever.
    if (ageMs > MANDATE_BATCH_BILLING_GIVEUP_MS && Object.keys(disposed).length >= entryCount) {
      const unbilled = Object.keys(batchDoc.entries || {}).filter((rid) => !billed[rid]).length;
      const ok = await finalizeBatch(db, providerBatchId, { status: 'expired', endedAt: null, now, unbilledCount: unbilled });
      if (ok) res.finalized = 'expired';
    }
    return res;
  }

  // 3. ENDED — collect the results stream once.
  const resultsById = new Map();
  const stream = await mandateBatchResults(providerBatchId);
  for await (const r of stream) resultsById.set(r.custom_id, r.result);

  // The submit tick's snapshot — the I3 drift-guard basis + the degraded-tick
  // friction-tier source — read ONCE per batch. A transient READ ERROR leaves
  // the batch open for the next fire (P5 review INV-P5-7: a Firestore blip
  // must not convert a whole batch of paid results into terminal rejections);
  // a genuinely ABSENT doc proceeds null → entries fail closed.
  let submitSnapshot = null;
  try {
    const snap = await db.collection(SNAPSHOT_COLLECTION).doc(batchDoc.tickKey).get();
    submitSnapshot = snap.exists ? snap.data() : null;
  } catch (err) {
    res.errors += 1;
    console.error(`${LOG_PREFIX} submit-tick snapshot read failed for ${batchDoc.tickKey} — batch left open for retry: ${err.message}`);
    return res;
  }

  for (const [requestId, entry] of Object.entries(batchDoc.entries || {})) {
    const alreadyDisposed = !!disposed[requestId];
    const alreadyBilled = !!billed[requestId];
    if (alreadyDisposed && alreadyBilled) continue;
    if (Date.now() > deadlineMs) return res; // doc stays open; next fire resumes
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
          entry, result, mandateRef, vintage, currentSnapshot, submitSnapshot, ownerToken, now, sessionDate, alreadyBilled,
        });
      } else if (alreadyDisposed) {
        // Disposed elsewhere and the row carries no billable usage — settle
        // the billing mark so the entry stops being revisited.
        out = { status: disposed[requestId], idempotent: true, billedUsage: true };
      } else if (result == null) {
        // Provider returned no row for this request — the "missing" half of the
        // partial-batch rule (missing/expired → expired). Never left in limbo.
        out = await disposeResultlessEntry(db, entry, requestId, {
          now, sessionDate, ownerToken, status: 'expired', failCondition: 'result_missing',
        });
        if (!out.skipped) out.billedUsage = true; // no usage exists for a missing row
      } else {
        const d = dispositionForResultType(result.type, { drainRequested: !!batchDoc.drainRequested });
        const failCondition = result.type === 'errored'
          ? `api_error:${result.error?.type ?? result.error?.error?.type ?? 'unknown'}`
          : d.failCondition;
        out = await disposeResultlessEntry(db, entry, requestId, {
          now, sessionDate, ownerToken, status: d.status, failCondition,
        });
        if (!out.skipped) out.billedUsage = true; // errored/canceled/expired rows carry no usage
      }
    } catch (err) {
      res.errors += 1;
      console.error(`${LOG_PREFIX} entry ${requestId} harvest failed (retried next fire): ${err.message}`);
      continue;
    }
    if (out.skipped === 'lease') { res.leaseSkips += 1; continue; }
    const newlyDisposed = !alreadyDisposed;
    if (newlyDisposed) { disposed[requestId] = out.status; res.disposed += 1; }
    if (out.billedUsage && !alreadyBilled) { billed[requestId] = true; res.billedEntries += 1; }
    await markEntry(db, providerBatchId, requestId, {
      status: newlyDisposed ? out.status : null,
      billed: out.billedUsage && !alreadyBilled,
    });
  }

  if (Object.keys(disposed).length >= entryCount) {
    const status = batchDoc.drainRequested ? 'cancelled' : (batchDoc.agedOutAt ? 'expired' : 'harvested');
    const ok = await finalizeBatch(db, providerBatchId, { status, endedAt: provider.ended_at ?? null, now });
    if (ok) res.finalized = status === 'harvested' ? 'harvested' : 'expired';
    if (ok && status === 'cancelled') res.finalized = 'expired'; // summary bucket: non-harvested
  }
  return res;
}

/**
 * Terminal disposition for an entry with no executable result, under the
 * book's lease (the fire's minted owner token), with health bookkeeping.
 * Lease CONTENTION → { skipped:'lease' } (retried next fire); a MISSING BOOK
 * (`no_such_book`) is not contention — the terminal is claimed leaselessly so
 * the batch doc converges (I1; P5 review INV-P5-5).
 */
async function disposeResultlessEntry(db, entry, requestId, { now, sessionDate, ownerToken, status, failCondition }) {
  const mandateRef = db.collection('mandates').doc(entry.mandateId);
  const lease = await acquireLease(db, mandateRef, ownerToken, { now });
  if (!lease.acquired) {
    if (lease.reason !== 'no_such_book') return { skipped: 'lease' };
    return disposeSubmission(db, { mandateRef, requestId, status, failCondition, envelope: entry.envelope });
  }
  try {
    const freshSnap = await mandateRef.get();
    const book = freshSnap.exists ? freshSnap.data() : null;
    const out = await disposeSubmission(db, {
      mandateRef, requestId, status, failCondition, envelope: entry.envelope,
    });
    if (book && !out.idempotent) {
      await bookkeepHealth(mandateRef, book, out, { now });
    }
    return out;
  } finally {
    await releaseLease(db, mandateRef, ownerToken).catch(() => {});
  }
}

// ── Drain protocol (§3.3 / F26) — explicit, invocable, founder-gated ─────────

/**
 * Drain every open batch: mark the doc drain-requested (so stragglers keep
 * the drain disposition, SPEC-P5-3), cancel provider-side (best-effort),
 * write every undisposed entry's decision `rejected_stale` (failCondition
 * 'drained_transport_change'), mark the batch doc `cancelled`. The §3.3 drain
 * language and the I1 terminal set are reconciled EXPLICITLY here (audit):
 * the BATCH is cancelled; each undelivered request's DECISION records the
 * §3.3 drain disposition — rejected_stale — because a drain is a staleness
 * event by fiat (the mode is changing; results must not be applied), while
 * the I1 word 'cancelled' remains the ROLLOVER/ESCAPE lifecycle-disposal
 * status. Never an implicit side effect of a mode flip: this runs only when
 * invoked (founder endpoint api/mandate/drain.js).
 *
 * An incomplete drain (lease-skips/errors) leaves its docs OPEN and says so
 * loudly — re-invoke until `batches: 0`. Requests the provider may have
 * completed before the cancel are recorded as unbilled spend on finalize.
 *
 * @returns {Promise<{ batches:number, disposed:number, leaseSkips:number, errors:number, incomplete:number }>}
 */
export async function drainOpenBatches(db, { now = new Date(), ownerToken = mintOwnerToken() } = {}) {
  const summary = { batches: 0, disposed: 0, leaseSkips: 0, errors: 0, incomplete: 0 };
  const openSnap = await db.collection(MANDATE_BATCH_COLLECTION)
    .where('status', '==', 'open')
    .limit(MANDATE_BATCH_POLL_PAGE)
    .get();

  for (const docSnap of openSnap.docs || []) {
    const batchDoc = docSnap.data();
    summary.batches += 1;
    // The drain marker lands BEFORE the cancel: any 'canceled' rows a later
    // harvest streams keep the drain disposition (SPEC-P5-3).
    await db.collection(MANDATE_BATCH_COLLECTION).doc(batchDoc.providerBatchId).set({ drainRequested: true }, { merge: true });
    try { await cancelMandateBatch(batchDoc.providerBatchId); } catch (err) {
      console.error(`${LOG_PREFIX} drain: provider cancel failed for ${batchDoc.providerBatchId} (dispositions proceed): ${err.message}`);
    }
    const disposed = { ...(batchDoc.disposed || {}) };
    const billedMap = { ...(batchDoc.billed || {}) };
    let allDisposed = true;
    for (const [requestId, entry] of Object.entries(batchDoc.entries || {})) {
      if (disposed[requestId]) continue;
      let out;
      try {
        out = await disposeResultlessEntry(db, entry, requestId, {
          now, sessionDate: batchDoc.sessionDate, ownerToken,
          status: 'rejected_stale', failCondition: 'drained_transport_change',
        });
      } catch (err) {
        summary.errors += 1;
        allDisposed = false;
        console.error(`${LOG_PREFIX} drain: entry ${requestId} failed: ${err.message}`);
        continue;
      }
      if (out.skipped === 'lease') { summary.leaseSkips += 1; allDisposed = false; continue; }
      disposed[requestId] = out.status;
      await markEntry(db, batchDoc.providerBatchId, requestId, { status: out.status });
      summary.disposed += 1;
    }
    if (allDisposed) {
      const unbilled = Object.keys(batchDoc.entries || {}).filter((rid) => !billedMap[rid]).length;
      await finalizeBatch(db, batchDoc.providerBatchId, { status: 'cancelled', endedAt: null, now, unbilledCount: unbilled });
    } else {
      summary.incomplete += 1;
      console.error(`${LOG_PREFIX} drain: ${batchDoc.providerBatchId} left open (lease-skips/errors) — re-invoke to complete`);
    }
  }
  if (summary.incomplete > 0) {
    console.error(
      `${LOG_PREFIX} MANDATE_DRAIN_INCOMPLETE — ${summary.incomplete} batch(es) still open after this drain; `
      + 're-invoke api/mandate/drain until batches:0 (books self-heal via the transport-independent gate expiry, '
      + 'but the batch docs need the drain to finish)',
    );
  }
  return summary;
}
