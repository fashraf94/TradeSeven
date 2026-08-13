// api/cron/mandate-evaluate.js
//
// Spec 1 — Mandate Substrate — the EVALUATION HANDLER (§3.1). New, non-fenced,
// one slot. DARK by construction: behind MANAGED_MANDATE_ENABLED (master) AND
// MANDATE_EVAL_ENABLED (§7). With either false — the standing default — the
// handler no-ops before any snapshot, model call, or write. Registration in
// vercel.json is P6; this file is an invocable endpoint that does nothing until
// the flags flip.
//
// TICK ORDER (§3.1): ensure snapshot (§3.0) → harvest → select eligible → submit.
// Snapshot construction is a PRECONDITION; if it fails the tick does not submit.
// In P2 the transport is DIRECT (submit and harvest share the tick, so the drift
// guard's submit/harvest marks coincide); batch transport + the last-tick rule +
// the drain protocol are P5.
//
// CORRECTNESS RESTS ON THE REVISION-PRECONDITIONED EXECUTION TXN (§3.5), never on
// the lease (§3.1/Q3). The owner-token lease only prevents wasted duplicate work;
// the sweep is bounded (MANDATE_SWEEP_PAGE_SIZE) with a durable cursor in
// cronState ordered by health.lastSuccessfulEvalAt ASC so no tail starves (F24).

import { FieldPath } from 'firebase-admin/firestore';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import {
  MANAGED_MANDATE_ENABLED,
  MANDATE_EVAL_ENABLED,
  MANDATE_CLOSE_ENABLED,
  MANDATE_TRANSPORT_MODE,
} from '../../src/config/featureFlags.js';
import {
  MANDATE_SWEEP_PAGE_SIZE,
  MANDATE_QUARANTINE_THRESHOLD,
  MANDATE_STALE_STREAK_ALERT,
  MANDATE_MISSED_MARKS_ALERT,
  MANDATE_REGIME_SOURCE,
  MANDATE_RESULT_MAX_AGE_MS,
} from '../_utils/mandateConfig.js';
import { activeTick, activeCloseTick, tierEligibleAt, resolveSessionSlots, isFinalSessionSlot } from '../_utils/mandateSessionSlots.js';
import { ensureUniverseSnapshot, ensureDailySnapshot, classifyBookTick, shiftDateStr, SNAPSHOT_COLLECTION } from '../_utils/mandateUniverseSnapshot.js';
import { mintOwnerToken, acquireLease, releaseLease } from '../_utils/mandateLease.js';
import { assembleMandatePrompt } from '../_utils/mandatePromptAssembly.js';
import { buildSubmissionEnvelope, callMandateModelDirect } from '../_utils/mandateModelCall.js';
import { normalizeDecisionInput, effectiveVerbs } from '../_utils/mandateDecisionTool.js';
import { evaluateGate } from '../_utils/mandateGate.js';
import { executeDecision, disposeSubmission } from '../_utils/mandateExecution.js';
import { markFor } from '../_utils/mandateUniverseSnapshot.js';
import { resolveRegime } from '../_utils/mandateRegime.js';
import { priceUsage, telemetryPatch } from '../_utils/modelPriceTable.js';
import { harvestOpenBatches, submitMandateBatch } from '../_utils/mandateBatchTransport.js';

// §6.2 telemetryPatch moved to modelPriceTable.js in P5 (the batch harvest
// bills without importing a cron entrypoint); re-exported here so existing
// consumers/tests keep their import path. Mechanical, behavior-preserving.
export { telemetryPatch };
import {
  closeBook,
  appendScoringWithRetry,
  healthAlertsAfterClose,
  runRetentionCleanup,
} from '../_utils/mandateClosePass.js';

export const config = { maxDuration: 300 };
const TIME_BUDGET_MS = 290_000; // 10s buffer under maxDuration for cleanup/response
const LOG_PREFIX = '[MandateEvaluate]';
const MANDATES_COLLECTION = 'mandates';

// ── Held-ticker union across active books (§3.0 build set input) ─────────────
export function unionHeldTickers(bookDocs) {
  const held = new Set();
  for (const b of bookDocs) {
    for (const t of Object.keys(b.portfolio?.positions || {})) held.add(t);
  }
  return [...held];
}

// ── Per-book eval (exported + model-call injected for testability) ───────────
/**
 * Run one book's tick. DIRECT transport (P2, unchanged): assemble prompt from
 * the pinned vintage → call model → normalize → gate → execute; returns a
 * terminal result. BATCH transport (P5, `transport:'batch'`): assemble prompt →
 * build envelope → return `{ outcome:'enqueue', pending }` for the sweep to
 * submit as one Message Batch — the model is NOT called here (billing happens
 * at provider batch creation) and normalize/gate/execute happen at HARVEST
 * against the then-current book. A book with an open submission never
 * double-submits (`skipped_open_batch`). `callModel` is injected so tests
 * drive the full pipeline without the network.
 *
 * @returns {Promise<{ outcome:string, status?:string, reason?:string, pending?:object }>}
 */
export async function runBookEval(db, {
  book, mandateRef, vintage, snapshot, sessionDate, slot, now = new Date(),
  callModel = callMandateModelDirect, regime = null, transport = 'direct',
}) {
  // Tier gating (§3.1): cadence tiers map to session-relative slots.
  if (!tierEligibleAt(book.cadenceTier, slot)) return { outcome: 'skipped_tier' };
  if (!vintage) return { outcome: 'skipped', reason: 'no_vintage' };

  // Double-submit gate (§3.3) — TRANSPORT-INDEPENDENT by design (F26): "a
  // mid-drain mandate cannot submit under the NEW mode until its old batch
  // reaches terminal state." Under batch, the tick's harvest normally cleared
  // it BEFORE this sweep ran; under direct it is non-null only mid-drain (a
  // mode flip with batches still open), where evaluating would double-spend
  // against an in-flight request. Inert in pure direct operation (always null).
  //
  // BOOK-LEVEL AGE-OUT, also transport-independent (§6.4 "auto-expired, not
  // merely alerted" — mode-independent language; P5 review C21-P5-2): a gate
  // past MANDATE_RESULT_MAX_AGE_MS is expired HERE, at eval granularity, so a
  // mid-drain book under 'direct' is submit-blocked for at most 4h + one slot
  // gap — not until the once-daily close pass happens to catch it (whose age
  // check provably misses same-day midday submissions). The book then
  // proceeds to a normal eval THIS fire.
  const openBatchId = book.execState?.openBatchId ?? null;
  if (openBatchId !== null) {
    const submittedAtRaw = book.execState?.openBatchSubmittedAt;
    const submittedMs = submittedAtRaw
      ? (typeof submittedAtRaw.toDate === 'function' ? submittedAtRaw.toDate().getTime() : new Date(submittedAtRaw).getTime())
      : NaN;
    const gateAge = Number.isFinite(submittedMs) ? now.getTime() - submittedMs : Infinity; // fail-closed: unparseable = infinitely old
    if (gateAge <= MANDATE_RESULT_MAX_AGE_MS) {
      return { outcome: 'skipped_open_batch' };
    }
    const expired = await disposeSubmission(db, {
      mandateRef, requestId: openBatchId, status: 'expired', failCondition: 'result_age',
    });
    console.error(
      `${LOG_PREFIX} MANDATE_GATE_EXPIRED ${mandateRef.id} — open submission ${openBatchId} aged out at the eval `
      + `sweep (${Math.round(gateAge / 60000)}m old${expired.idempotent ? ', terminal already claimed' : ''}); book returns to submit-eligibility (I1)`,
    );
    if ((expired.staleRejectStreak || 0) >= MANDATE_STALE_STREAK_ALERT) {
      console.error(`${LOG_PREFIX} MANDATE_STALE_STREAK ${mandateRef.id} — ${expired.staleRejectStreak} consecutive stale-rejected/expired submissions (I9 liveness)`);
    }
    // Both branches durably cleared the gate: a fresh disposition clears it in
    // its own txn; an idempotent replay (terminal already claimed elsewhere)
    // triggers disposeSubmission's GATE HEAL (refuter D2 — without it the
    // local-only patch left the durable gate set and every fire re-billed).
    const bumped = !expired.idempotent || expired.gateHealed;
    book = { ...book, revision: bumped ? (book.revision || 0) + 1 : book.revision, execState: { ...book.execState, openBatchId: null, openBatchSubmittedAt: null, openProviderBatchId: null } };
  }

  const positions = book.portfolio?.positions || {};
  // Per-book tick context (§3.0 freshness + §4.3/I7 gap freeze + the
  // frozen-excluded valuation view) — ONE classifier shared with the batch
  // harvest (P5 extraction; semantics unchanged from the P2/P3 inline block).
  // The candidate slate is unaffected (held symbols are excluded from it anyway).
  const { actionable, caFrozen, evalSnapshot } = classifyBookTick(book, snapshot, { now, sessionDate });

  // Quarantine (§6.4/I2): exit-only mode restricts the DECISION TOOL ITSELF to
  // SELL/TRIM/HOLD — the model cannot emit an entry; the gate and executor
  // enforce it again downstream (defense in depth). The book stays in the
  // sweep; C-21 outranks ops hygiene, so exits flow exactly as in full mode.
  const quarantined = !!book.health?.quarantined;
  const verbs = effectiveVerbs(vintage.gateConfig?.decisionVerbs, { quarantined });

  // Assemble the prompt from the pinned vintage (§3.2) and call the model.
  // Regime (§6.1) arrives as already-resolved DATA (the handler reads the
  // source doc once per fire) — the assembler stays free of live reads.
  const prompt = assembleMandatePrompt({
    vintage, book, snapshot: evalSnapshot, now,
    regime: regime?.regime ?? null, regimeAsOf: regime?.regimeAsOf ?? null,
    verbs,
  });
  const modelSeat = vintage.modelSeat;

  // Submission envelope (F1/F2) — deterministic requestId is the decisionId.
  // Built BEFORE the transport branch: it is the base-state identity of THIS
  // eval (pure book+tick state, independent of the model's answer).
  const envelope = buildSubmissionEnvelope({
    mandateId: mandateRef.id ?? book.mandateId ?? book.id,
    baseRevision: book.revision,
    quarterKey: book.quarterKey,
    vintageRef: book.vintageRef,
    snapshotTickKey: snapshot.tickKey,
    bookStatus: book.status,
    submittedAt: now.toISOString(),
    sessionDate,
    mandatePromptTemplateVersion: null, // template versioning stamped from platform machinery
  });

  // BATCH transport (§3.3, P5): enqueue — the sweep submits every enqueued book
  // as ONE Message Batch after the page loop; normalize/gate/execute happen at
  // harvest. The verbs travel with the request (normalize against the tool the
  // model SAW; gate against the book as it IS at harvest).
  if (transport === 'batch') {
    return {
      outcome: 'enqueue',
      pending: {
        mandateRef,
        envelope,
        verbs,
        modelSeat,
        content: { system: prompt.system, messages: prompt.messages, tools: prompt.tools },
      },
    };
  }

  const { decision: extracted, usage } = await callModel(modelSeat, {
    system: prompt.system, messages: prompt.messages, tools: prompt.tools,
  });
  if (!extracted?.ok) return { outcome: 'no_decision', reason: extracted?.reason || 'model_no_tool_use', usage: usage ?? extracted?.usage ?? null };

  const norm = normalizeDecisionInput(extracted.input, { verbs });
  if (!norm.ok) return { outcome: 'bad_decision', reason: norm.reason, usage: usage ?? extracted?.usage ?? null };
  const decision = norm.decision;

  // Deterministic gate (§3.4) — quarantine blocks entries (never exits); a
  // CA-frozen symbol blocks entries and defers pricing to last-good on exits.
  const gateResult = evaluateGate({
    decision, positions, cash: book.portfolio?.cash || 0, snapshot: evalSnapshot,
    gateConfig: vintage.gateConfig || {}, actionableHeld: actionable,
    quarantined, caFrozen,
  });

  // Direct transport (P2): submit mark == harvest mark (same tick), so the drift
  // guard is satisfied by construction; it bites under batch transport (P5).
  const submitMark = decision.ticker ? markFor(evalSnapshot, decision.ticker) : null;

  const res = await executeDecision(db, {
    mandateRef, decisionId: envelope.requestId, decision, gateResult, envelope,
    snapshot, submitMark, currentSessionDate: sessionDate, now, caFrozen,
  });
  return {
    outcome: 'terminal', status: res.status, decisionId: envelope.requestId,
    usage: usage ?? extracted?.usage ?? null,
    staleRejectStreak: res.staleRejectStreak ?? null,
  };
}

// ── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // 1. Auth (mirrors agent-evaluate).
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const authHeader = req.headers.authorization;
  if (!isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // 2. Master gate (§7). Dark default → no-op before any I/O or model call.
  if (!MANAGED_MANDATE_ENABLED) {
    return res.status(200).json({ ok: true, noop: true, reason: 'mandate_dark' });
  }

  const now = new Date();
  // 3. Calendar gating (§3.1): an eval slot, else the post-close duty window
  // (§3.6). The two windows are disjoint by construction (activeCloseTick).
  const tick = activeTick(now);
  if (!tick) {
    const closeTick = activeCloseTick(now);
    if (closeTick && MANDATE_CLOSE_ENABLED) {
      return runCloseSweep(req, res, { now, closeTick });
    }
    return res.status(200).json({
      ok: true, noop: true,
      reason: closeTick ? 'mandate_close_dark' : 'no_active_slot',
    });
  }
  if (!MANDATE_EVAL_ENABLED) {
    return res.status(200).json({ ok: true, noop: true, reason: 'mandate_eval_dark' });
  }

  return runEvalSweep(req, res, { now, tick });
}

// ── The eval sweep (§3.1) — the handler's model-cadence duty ──────────────────
/**
 * The bounded per-slot eval sweep, extracted from the handler as an injectable
 * seam (P4 integration harness): `db` and `now`/`tick` are parameters so the
 * handler-level tests drive the real loop (fresh-read-under-lease idempotency,
 * no_vintage→quarantine, truthful completion) against a transaction-faithful
 * fake — the P3-flagged test debt this phase pays. Production calls it with the
 * live admin db (default) and the handler-computed tick; behavior is unchanged.
 */
export async function runEvalSweep(req, res, { now, tick, db = getFirebaseAdmin(), transport = MANDATE_TRANSPORT_MODE }) {
  const startedAt = Date.now();
  const deadlineMs = startedAt + TIME_BUDGET_MS;
  const ownerToken = mintOwnerToken();
  const summary = { slot: tick.slot, tickKey: tick.tickKey, transport, evaluated: 0, enqueued: 0, executed: 0, gated: 0, rejected: 0, failed: 0, skipped: 0, errors: 0, complete: false };

  try {
    // 4–5. Ensure the tick snapshot (PRECONDITION, §3.1). The platform-wide
    // snapshot is built ONCE per slot; on the first generous fire it is absent, so
    // we scan active books for the held-ticker union (build-set input, §3.0), build
    // the daily slow layer (idempotent) and the fast layer. On later fires in the
    // same slot the snapshot already exists — skip the full scan + build entirely
    // (arch/spec review S3a: no redundant O(active-books) read every fire).
    const snapRef = db.collection(SNAPSHOT_COLLECTION).doc(tick.tickKey);
    let snapshot = (await snapRef.get()).data() || null;
    if (!snapshot) {
      const activeSnap = await db.collection(MANDATES_COLLECTION).where('status', '==', 'active').get();
      const heldTickers = unionHeldTickers(activeSnap.docs.map((d) => d.data()));
      const daily = await ensureDailySnapshot(db, { date: tick.date, heldTickers, now });
      const dailyDoc = (await daily.ref.get()).data();
      try {
        const built = await ensureUniverseSnapshot(db, {
          tickKey: tick.tickKey, sessionDate: tick.date, heldTickers, now, dailyDoc,
        });
        snapshot = built.snapshot;
      } catch (snapErr) {
        // Precondition failed — the tick HARVESTS but does NOT submit (§3.1).
        // Under batch transport the harvest still runs, against a minimal
        // context: entries fail closed at the universe/drift gates while exits
        // fill at carry-over marks (C-21 holds even degraded).
        console.error(`${LOG_PREFIX} snapshot precondition failed — harvest-only tick, no submit: ${snapErr.message}`);
        if (transport === 'batch') {
          // `degraded: true` travels on the context and lands on every receipt
          // as harvestSnapshotDegraded (refuter, MONEY-P5-7 overturn): a later
          // fire in this slot may successfully WRITE the real snapshot doc for
          // this same tickKey, and an auditor replaying these receipts against
          // it must be able to see they executed against the empty context.
          summary.harvest = await harvestOpenBatches(db, {
            currentSnapshot: { tickKey: tick.tickKey, symbols: {}, degraded: true },
            sessionDate: tick.date, ownerToken, now, deadlineMs,
          });
        }
        return res.status(200).json({ ok: true, noop: true, reason: 'snapshot_failed', ...summary });
      }
    }

    // TICK ORDER (§3.1): HARVEST BEFORE SUBMIT. Poll every open batch, run the
    // full §3.3 validation per result, execute/dispose through the §3.5
    // discipline — so a book whose submission terminates here re-enters
    // submit-eligibility in THIS tick's sweep below. (Same-TICK re-submission
    // is exact at ≤ page-size populations; above it, a harvested book's
    // advanced sweep key sorts it behind never-served books — fairness first —
    // and a later generous fire in the slot, or the next slot, picks it up.
    // Self-balancing, never starving; stated in the audit.)
    if (transport === 'batch') {
      summary.harvest = await harvestOpenBatches(db, {
        currentSnapshot: snapshot, sessionDate: tick.date, ownerToken, now, deadlineMs,
      });
    }

    // LAST-TICK RULE (§3.3 / F3): the session's final eval tick does not
    // submit — a batch submitted here could only be harvested after the close,
    // where every safety mechanism would discard it. Harvest-only tick; the
    // close pass's expiry duty backstops anything this harvest missed. (Direct
    // transport is untouched: its submit and harvest share the tick, so the
    // "later same-session harvest opportunity" is the tick itself.)
    if (transport === 'batch' && isFinalSessionSlot(tick.slot)) {
      summary.complete = true;
      summary.reason = 'last_tick_no_submit';
      console.log(`${LOG_PREFIX} ${tick.tickKey} is the session's final tick — harvest-only under batch transport (F3)`);
      return res.status(200).json({ ok: true, ...summary });
    }

    // 6. Bounded sweep (F24), ordered by health.lastEvalSweepAt ASC — the
    //    ATTEMPT marker, written on EVERY processed outcome (success, failure,
    //    tier-skip, missing vintage), so the least-recently-SERVED books go
    //    first and no tail starves. The P3 review (invariants F4 ≡ C-21 F1,
    //    HIGH) found the original key — lastSuccessfulEvalAt, advanced only on
    //    success — let ≥ page-size persistently-failing books pin the frontier
    //    and suppress every book behind them (evals, and therefore exits)
    //    indefinitely while logging "sweep complete". lastSuccessfulEvalAt
    //    remains the SUCCESS record (agencyState derivation, §6.4) — it is
    //    just no longer the sweep order. NO durable value-cursor (spec review
    //    S1): each generous fire re-queries the front; the within-slot stamps
    //    (lastEvalTickKey for attempts, lastSweepTickKey for unbilled skips)
    //    make a re-surfaced served book a no-op, so a full page with zero
    //    newly-evaluated books proves the slot complete.
    //    (Depends on health.lastEvalSweepAt being PRESENT on every book —
    //    buildHealthBlock seeds it null; an orderBy silently drops docs
    //    missing the field. No production books predate the field: flags are
    //    dark and every creation path seeds it.)
    const pageSnap = await db.collection(MANDATES_COLLECTION)
      .where('status', '==', 'active')
      .orderBy('health.lastEvalSweepAt', 'asc')
      .orderBy('__name__', 'asc')
      .limit(MANDATE_SWEEP_PAGE_SIZE)
      .get();
    const page = pageSnap.docs;

    // 6b. Regime (§6.1): ONE source read per fire, resolved to an honest stamp
    // (stale ⇒ 'unknown'), passed down as data — the assembler never reads live.
    let regime = null;
    try {
      const [regimeCol, regimeDoc] = MANDATE_REGIME_SOURCE.split('/');
      const ctxSnap = await db.collection(regimeCol).doc(regimeDoc).get();
      regime = resolveRegime(ctxSnap.exists ? ctxSnap.data() : null, now);
    } catch (err) {
      console.error(`${LOG_PREFIX} regime read failed (stamping unknown): ${err.message}`);
      regime = resolveRegime(null, now);
    }

    // 7. Per-book eval with lease + isolation.
    const vintageCache = new Map();
    const pendingSubmissions = []; // batch transport: enqueued books, submitted as ONE batch after the loop
    let newlyEvaluated = 0;
    let leaseSkips = 0;
    let deferred = false;
    for (const docSnap of page) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) { deferred = true; break; } // defer remaining to the next fire
      const mandateRef = docSnap.ref;

      // Cheap pre-filter on the PAGE COPY (may be stale — the authoritative
      // re-check happens on a fresh read under the lease, below).
      const pageCopy = docSnap.data();
      if (pageCopy.execState?.lastEvalTickKey === tick.tickKey
        || pageCopy.execState?.lastSweepTickKey === tick.tickKey) { summary.skipped++; continue; }

      const lease = await acquireLease(db, mandateRef, ownerToken, { now });
      if (!lease.acquired) { summary.skipped++; leaseSkips++; continue; }
      let book = null; // assigned from the fresh in-lease read; catch falls back to the page copy
      try {
        // Within-slot idempotency on a FRESH read UNDER THE LEASE (invariants
        // review P3 finding 3): the page copy can predate a concurrent fire's
        // commit — checking it alone double-billed the model call and let the
        // later telemetry merge erase the earlier one. Read → decide → write
        // all happen while holding the lease, so the read-modify-write below
        // (telemetry, failure counters, quarantine flip) is serialized.
        const freshSnap = await mandateRef.get();
        if (!freshSnap.exists) { summary.skipped++; continue; }
        book = { _id: docSnap.id, ...freshSnap.data() };
        if (book.execState?.lastEvalTickKey === tick.tickKey
          || book.execState?.lastSweepTickKey === tick.tickKey) { summary.skipped++; continue; }

        // Load the pinned vintage (cached per vintageRef across the page).
        let vintage = vintageCache.get(book.vintageRef);
        if (vintage === undefined) {
          const vSnap = await db.doc(book.vintageRef).get();
          vintage = vSnap.exists ? vSnap.data() : null;
          vintageCache.set(book.vintageRef, vintage);
        }

        const result = await runBookEval(db, {
          book, mandateRef, vintage, snapshot, sessionDate: tick.date, slot: tick.slot, now, regime, transport,
        });

        // §6.2: accumulate cost telemetry for any BILLED call, whatever the
        // outcome — a no_decision eval still spent tokens.
        const priced = result.usage ? priceUsage(vintage?.modelSeat?.model, result.usage) : null;
        const telemetry = priced ? telemetryPatch(book, tick.date, priced) : null;

        // §6.4: the quarantine flip patch when a failure crosses the threshold —
        // exit-only mode, loudly announced; founder action restores full mode.
        // ── Durable outcome writes (P3 review INV-4/INV-6) ──────────────────
        // Every processed book advances the sweep ordering key
        // (health.lastEvalSweepAt) whatever the outcome, so no state can pin
        // the page frontier. Writes are AWAITED and failures COUNTED — a
        // swallowed write re-bills the book next fire and can announce a
        // quarantine that never persisted, so the MANDATE_QUARANTINED alert
        // is emitted only AFTER its flip is durably committed.
        const quarantinePatchFor = (failures) => (
          failures >= MANDATE_QUARANTINE_THRESHOLD && !book.health?.quarantined
            ? { quarantined: true } : {}
        );
        const persistOutcome = async (patch, { failures = null } = {}) => {
          const flip = !!patch?.health?.quarantined;
          try {
            await mandateRef.set(patch, { merge: true });
            if (flip) {
              console.error(
                `${LOG_PREFIX} MANDATE_QUARANTINED ${book._id} — ${failures} consecutive eval failures; `
                + 'exit-only mode (tool restricted to SELL/TRIM/HOLD; still swept, still marked daily; '
                + 'founder restores by clearing BOTH health.quarantined AND health.consecutiveEvalFailures)',
              );
            }
          } catch (writeErr) {
            summary.errors++;
            console.error(`${LOG_PREFIX} ${book._id} outcome persist FAILED (will re-serve next fire): ${writeErr.message}`);
          }
        };

        if (result.outcome === 'skipped_tier') {
          // Ineligible tier this slot — routine cadence, not a failure; the
          // sweep stamp rotates the book behind the frontier without billing.
          summary.skipped++;
          await persistOutcome({
            health: { lastEvalSweepAt: now },
            execState: { lastSweepTickKey: tick.tickKey },
          });
        } else if (result.outcome === 'skipped_open_batch') {
          // An open submission still in flight (§3.3 double-submit gate — its
          // batch terminates via harvest/expiry, never a second submit). The
          // block is TRANSIENT — the next fire's harvest may clear it — so it
          // gets NO lastSweepTickKey slot stamp (P5 review C21-P5-1: stamping
          // converted a mid-slot gate clearance into a slot-long submit
          // lockout); only the frontier key advances. Counted separately, and
          // LOUD under direct transport, where a gated book means a mid-drain
          // flip left work behind (F26 visibility).
          summary.skipped++;
          summary.gatedOpenBatch = (summary.gatedOpenBatch || 0) + 1;
          if (transport !== 'batch') {
            console.error(`${LOG_PREFIX} MANDATE_OPEN_BATCH_UNDER_DIRECT ${book._id} — open submission ${book.execState?.openBatchId} gates evals under 'direct' transport; run the founder drain (api/mandate/drain) or wait for the ≤4h gate expiry`);
          }
          await persistOutcome({
            health: { lastEvalSweepAt: now },
          });
        } else if (result.outcome === 'enqueue') {
          // BATCH transport: collected for the single post-loop submission.
          // The billed-eval stamp + frontier key land NOW, UNDER THE LEASE
          // (the P3 INV-3 idiom; P5 review INV-P5-1: stamping only in the
          // post-loop gate txn left the whole page re-enqueueable by an
          // overlapping generous fire — double provider spend on routine cron
          // overlap). Accepted trade, stated: a crash between this stamp and
          // provider creation costs the stamped books THIS slot (they submit
          // fresh next slot) — a lost slot is recoverable, duplicate spend is
          // not.
          newlyEvaluated++;
          summary.enqueued++;
          await persistOutcome({
            health: { lastEvalSweepAt: now },
            execState: { lastEvalTickKey: tick.tickKey },
          });
          pendingSubmissions.push(result.pending);
        } else if (result.outcome === 'skipped') {
          // Missing/corrupt vintage: the book CANNOT evaluate — that is an
          // eval failure of the infrastructure kind (§6.4), not a quiet skip.
          // The P3 review found these books wrote NOTHING: they pinned the
          // page frontier forever, were re-processed every fire, and could
          // never alert or quarantine.
          summary.skipped++;
          const failures = (book.health?.consecutiveEvalFailures || 0) + 1;
          console.error(`${LOG_PREFIX} MANDATE_NO_VINTAGE ${book._id} — vintage ${book.vintageRef} unreadable (${failures} consecutive)`);
          await persistOutcome({
            health: { lastEvalSweepAt: now, consecutiveEvalFailures: failures, ...quarantinePatchFor(failures) },
            execState: { lastSweepTickKey: tick.tickKey },
          }, { failures });
        } else if (result.outcome === 'terminal') {
          newlyEvaluated++;
          summary.evaluated++;
          if (result.status === 'executed') summary.executed++;
          else if (result.status === 'gated') summary.gated++;
          else if (result.status && result.status.startsWith('rejected')) summary.rejected++;
          // I9: the stale-rejection streak is THE liveness wire (founder ruling)
          // and alerts independently of eval failures.
          if ((result.staleRejectStreak || 0) >= MANDATE_STALE_STREAK_ALERT) {
            console.error(
              `${LOG_PREFIX} MANDATE_STALE_STREAK ${book._id} — ${result.staleRejectStreak} consecutive `
              + 'stale-rejected/expired submissions (I9 liveness)',
            );
          }
          if (result.status === 'failed') {
            // A §3.5 invariant abort is a FAILURE (health increment, §3.5), not a
            // success — it must not reset the streak the P3 quarantine watches
            // (spec review S2). The exec txn already stamped lastEvalTickKey.
            summary.failed++;
            const failures = (book.health?.consecutiveEvalFailures || 0) + 1;
            await persistOutcome({
              health: { lastEvalSweepAt: now, consecutiveEvalFailures: failures, ...quarantinePatchFor(failures) },
              ...(telemetry || {}),
            }, { failures });
          } else {
            // The execution txn already stamped lastEvalTickKey atomically. Health is
            // bookkeeping (no revision bump): a completed eval records the success
            // (lastSuccessfulEvalAt — agencyState's 'full' evidence) and resets the
            // failure streak.
            await persistOutcome({
              health: { lastEvalSweepAt: now, lastSuccessfulEvalAt: now, consecutiveEvalFailures: 0 },
              ...(telemetry || {}),
            });
          }
        } else {
          // Soft model failure (no usable tool_use / malformed): count as a failure,
          // do NOT advance lastSuccessfulEvalAt (it retries next slot), but DO stamp
          // lastEvalTickKey so it is not re-attempted within THIS slot.
          newlyEvaluated++;
          summary.errors++;
          const failures = (book.health?.consecutiveEvalFailures || 0) + 1;
          await persistOutcome({
            health: { lastEvalSweepAt: now, consecutiveEvalFailures: failures, ...quarantinePatchFor(failures) },
            execState: { lastEvalTickKey: tick.tickKey },
            ...(telemetry || {}),
          }, { failures });
        }
      } catch (bookErr) {
        summary.errors++;
        const errBook = book ?? { _id: docSnap.id, ...pageCopy };
        console.error(`${LOG_PREFIX} book ${errBook._id} eval failed: ${bookErr.message}`);
        // Per-book isolation (§3.1/§6.4): increment the failure counter AND stamp
        // lastEvalTickKey so a persistently-throwing book is not re-attempted
        // (re-billed) on every generous fire this slot (spec review S6), and
        // advance the sweep key so it cannot pin the page frontier (INV-4).
        newlyEvaluated++;
        const failures = (errBook.health?.consecutiveEvalFailures || 0) + 1;
        const quarantine = failures >= MANDATE_QUARANTINE_THRESHOLD && !errBook.health?.quarantined
          ? { quarantined: true } : {};
        try {
          await mandateRef.set({
            health: { lastEvalSweepAt: now, consecutiveEvalFailures: failures, ...quarantine },
            execState: { lastEvalTickKey: tick.tickKey },
          }, { merge: true });
          if (quarantine.quarantined) {
            console.error(`${LOG_PREFIX} MANDATE_QUARANTINED ${errBook._id} — ${failures} consecutive eval failures; exit-only mode`);
          }
        } catch (writeErr) {
          summary.errors++;
          console.error(`${LOG_PREFIX} ${errBook._id} failure persist FAILED: ${writeErr.message}`);
        }
      } finally {
        await releaseLease(db, mandateRef, ownerToken).catch(() => {});
      }
    }

    // 7b. BATCH SUBMISSION (§3.3): one Message Batch for every enqueued book —
    // provider create first (the billing moment), the bookkeeping doc, then the
    // revision-disciplined per-book gate writes. A failure here is loud and
    // leaves nothing stamped, so the affected books retry on the next generous
    // fire in this slot.
    if (pendingSubmissions.length > 0) {
      try {
        const sub = await submitMandateBatch(db, pendingSubmissions, {
          tickKey: tick.tickKey, sessionDate: tick.date, now,
        });
        summary.batch = { providerBatchId: sub.providerBatchId, gated: sub.gated, zombies: sub.zombies.length };
        console.log(`${LOG_PREFIX} submitted batch ${sub.providerBatchId} — ${sub.gated}/${pendingSubmissions.length} gated for ${tick.tickKey}`);
      } catch (subErr) {
        summary.errors++;
        console.error(`${LOG_PREFIX} batch submission failed for ${tick.tickKey} (books unstamped — next fire retries): ${subErr.message}`);
      }
    }

    // 8. Completion (F24) — and it must be TRUE (P5 review C21-P5-7/INV-P5-8,
    //    the close sweep's INV-1 lesson applied here): errors, lease-skips, a
    //    time-budget break, or an incomplete harvest all leave books unproven,
    //    so such a fire never claims complete. A clean full page with zero
    //    newly-evaluated books means the frontier reached books already served
    //    this slot → complete.
    const harvestClean = !summary.harvest || (summary.harvest.errors === 0 && summary.harvest.leaseSkips === 0);
    if (newlyEvaluated === 0 && summary.errors === 0 && leaseSkips === 0 && !deferred && harvestClean) {
      summary.complete = true;
      console.log(`${LOG_PREFIX} sweep complete for slot ${tick.tickKey} — all active books served`);
    }

    return res.status(200).json({ ok: true, ...summary });
  } catch (err) {
    console.error(`${LOG_PREFIX} handler error: ${err.message}`);
    return res.status(500).json({ ok: false, error: err.message, ...summary });
  }
}

// ── The close sweep (§3.6) — the handler's post-close duty ───────────────────
/**
 * The daily close pass over every active book: the authoritative mark,
 * independent of model cadence — slow-tier, dormant, exit-only, and quarantined
 * books included (the sweep filters on status=='active' only). Idempotent per
 * date via execState.lastCloseKey; ordered by health.lastCloseAttemptAt ASC —
 * the ATTEMPT marker, advanced by successful closes AND by the catch path — so
 * a persistently-throwing book rotates behind the frontier instead of pinning
 * the page and starving every close behind it (P3 review INV-1/C21-1; the old
 * key, lastCloseMarkAt, advanced only on success). lastCloseMarkAt remains the
 * success record. No durable cursor (the P2 S1 lesson); depends on
 * lastCloseAttemptAt being PRESENT on every book — buildHealthBlock seeds it
 * null, and no production books predate the field (flags dark).
 * Completion — and only completion — triggers the bounded §3.7 retention
 * cleanup, and it must be TRUE: a fire that saw errors, lease-skips, or a
 * time-budget break proves nothing about the tail, so it never claims
 * complete (the old newlyClosed===0 heuristic logged "all active books
 * closed" while a thrower sat unclosed forever).
 */
export async function runCloseSweep(req, res, { now, closeTick, db = getFirebaseAdmin() }) {
  const startedAt = Date.now();
  const ownerToken = mintOwnerToken();
  const date = closeTick.date;
  const summary = {
    duty: 'close', date, closeKey: closeTick.closeKey,
    closed: 0, partial: 0, skipped: 0, errors: 0, streamDeferred: 0, complete: false,
  };

  try {
    // 1. The CLOSE SNAPSHOT: built once per date at `${date}_close`, AFTER the
    // session close, so its quotes carry the official close print — never the
    // preClose tick's intraday marks (§3.6 "the session's official close").
    const snapRef = db.collection(SNAPSHOT_COLLECTION).doc(closeTick.closeKey);
    let closeSnapshot = (await snapRef.get()).data() || null;
    if (!closeSnapshot) {
      const activeSnap = await db.collection(MANDATES_COLLECTION).where('status', '==', 'active').get();
      const heldTickers = unionHeldTickers(activeSnap.docs.map((d) => d.data()));
      // Idempotent daily slow layer — normally already built by the day's first
      // eval fire; a zero-eval day (all books slow-tier + missed slots) builds
      // it here so the close still has sector/cap/CA context.
      const daily = await ensureDailySnapshot(db, { date, heldTickers, now });
      const dailyDoc = (await daily.ref.get()).data();
      try {
        const built = await ensureUniverseSnapshot(db, {
          tickKey: closeTick.closeKey, sessionDate: date, heldTickers, now, dailyDoc,
        });
        closeSnapshot = built.snapshot;
      } catch (snapErr) {
        // No close snapshot → no marks; better to defer to the next generous
        // fire in the window than to mark from nothing. Books stay unclosed and
        // the missed-marks alert fires if the whole window passes.
        console.error(`${LOG_PREFIX} close snapshot build failed — deferring: ${snapErr.message}`);
        return res.status(200).json({ ok: true, noop: true, reason: 'close_snapshot_failed', ...summary });
      }
    }

    // 2. Regime (§6.1): one read per fire; stale ⇒ 'unknown', never silently stale.
    let regime = null;
    try {
      const [regimeCol, regimeDoc] = MANDATE_REGIME_SOURCE.split('/');
      const ctxSnap = await db.collection(regimeCol).doc(regimeDoc).get();
      regime = resolveRegime(ctxSnap.exists ? ctxSnap.data() : null, now);
    } catch (err) {
      console.error(`${LOG_PREFIX} regime read failed (stamping unknown): ${err.message}`);
      regime = resolveRegime(null, now);
    }

    // 3. Bounded page, least-recently-ATTEMPTED first (INV-1/C21-1: throwers
    //    rotate behind the frontier; healthy books get their first attempt
    //    before any thrower gets its second).
    const pageSnap = await db.collection(MANDATES_COLLECTION)
      .where('status', '==', 'active')
      .orderBy('health.lastCloseAttemptAt', 'asc')
      .orderBy('__name__', 'asc')
      .limit(MANDATE_SWEEP_PAGE_SIZE)
      .get();

    let newlyClosed = 0;
    let leaseSkips = 0;
    let deferred = false;
    for (const docSnap of pageSnap.docs) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) { deferred = true; break; } // defer to the next fire in the window
      const mandateRef = docSnap.ref;
      const book = { _id: docSnap.id, ...docSnap.data() };
      if (book.execState?.lastCloseKey === date) { summary.skipped++; continue; }

      const lease = await acquireLease(db, mandateRef, ownerToken, { now });
      if (!lease.acquired) { summary.skipped++; leaseSkips++; continue; }
      try {
        const result = await closeBook(db, mandateRef, { date, closeSnapshot, now, regime });
        for (const alert of result.alerts || []) console.error(`${LOG_PREFIX} ${book._id} ${alert}`);
        if (!result.closed) { summary.skipped++; continue; }

        newlyClosed++;
        summary.closed++;
        if (result.row?.partial) summary.partial++;

        // Dual-label stream (O-11/I14): awaited-and-checked; a failed append
        // leaves a durable marker the next close retries. Never re-runs the
        // committed close.
        const stream = await appendScoringWithRetry(db, mandateRef, result.streamRecord, { date });
        if (!stream.appended) summary.streamDeferred++;

        // Post-close health alerts (I9 ratio + D-22 run-rate).
        for (const alert of healthAlertsAfterClose({ mandateId: book._id, rows: result.rows, monthEstUsd: result.monthEstUsd })) {
          console.error(`${LOG_PREFIX} ${alert}`);
        }
      } catch (bookErr) {
        summary.errors++;
        console.error(`${LOG_PREFIX} close failed for ${book._id}: ${bookErr.message}`);
        // DURABLE failure trace (P3 review INV-1, HIGH): without it, a book
        // whose closeBook throws every fire left NOTHING — no counter, no
        // ordering-key advance, no reachable §6.4 alert — a permanent silent
        // dailyRow gap behind a false "complete". The write is awaited; its
        // own failure is counted and the book simply stays at the page front.
        const closeFailures = (book.health?.consecutiveCloseFailures || 0) + 1;
        try {
          await mandateRef.set({
            health: { lastCloseAttemptAt: now, consecutiveCloseFailures: closeFailures },
          }, { merge: true });
          if (closeFailures >= MANDATE_MISSED_MARKS_ALERT) {
            console.error(`${LOG_PREFIX} MANDATE_CLOSE_FAILED_STREAK ${book._id} — ${closeFailures} consecutive close failures (whole-close, §6.4)`);
          }
        } catch (writeErr) {
          summary.errors++;
          console.error(`${LOG_PREFIX} ${book._id} close-failure persist FAILED: ${writeErr.message}`);
        }
      } finally {
        await releaseLease(db, mandateRef, ownerToken).catch(() => {});
      }
    }

    // 4. Completion + retention (§3.7): cleanup piggybacks the completed sweep
    // (bounded; a no-op once the backlog is clear). Completion must be TRUE:
    // errors, lease-skips, and time-budget breaks all leave books unproven,
    // so such a fire never claims it (INV-1 — the false "complete" hid a
    // permanently-unclosed book and ran retention anyway).
    if (newlyClosed === 0 && summary.errors === 0 && leaseSkips === 0 && !deferred) {
      summary.complete = true;
      console.log(`${LOG_PREFIX} close sweep complete for ${date} — all active books closed`);
      await runRetentionCleanup(db, { now, documentIdPath: FieldPath.documentId() }).catch((err) => {
        console.error(`${LOG_PREFIX} retention cleanup error: ${err.message}`);
      });
      // Calendar-horizon watch (C-21 review P3 finding 7): past the maintained
      // holiday years EVERYTHING fail-closes silently — no slots, no close
      // ticks, no marks, so not even missed-marks alerts can fire. Probe 30
      // days ahead once per completed sweep and alert while there is still
      // runway to extend the calendar.
      try {
        const probe = resolveSessionSlots(shiftDateStr(date, 30));
        if (probe?.reason === 'beyond_calendar_horizon') {
          console.error(`${LOG_PREFIX} MANDATE_CALENDAR_HORIZON — trading calendar unmaintained within 30 days (probe ${shiftDateStr(date, 30)}); extend MAINTAINED_HOLIDAY_YEARS before the horizon or ALL evals+closes stop silently`);
        }
      } catch (probeErr) {
        console.error(`${LOG_PREFIX} calendar-horizon probe failed: ${probeErr.message}`);
      }
    }

    return res.status(200).json({ ok: true, ...summary });
  } catch (err) {
    console.error(`${LOG_PREFIX} close sweep error: ${err.message}`);
    return res.status(500).json({ ok: false, error: err.message, ...summary });
  }
}
