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
} from '../../src/config/featureFlags.js';
import {
  MANDATE_SWEEP_PAGE_SIZE,
  MANDATE_MARK_MAX_AGE_MS,
  MANDATE_QUARANTINE_THRESHOLD,
  MANDATE_STALE_STREAK_ALERT,
  MANDATE_REGIME_SOURCE,
} from '../_utils/mandateConfig.js';
import { activeTick, activeCloseTick, tierEligibleAt } from '../_utils/mandateSessionSlots.js';
import { ensureUniverseSnapshot, ensureDailySnapshot, classifyHeldFreshness, caActionsBySymbol, snapshotExcluding, SNAPSHOT_COLLECTION } from '../_utils/mandateUniverseSnapshot.js';
import { mintOwnerToken, acquireLease, releaseLease } from '../_utils/mandateLease.js';
import { assembleMandatePrompt } from '../_utils/mandatePromptAssembly.js';
import { buildSubmissionEnvelope, callMandateModelDirect } from '../_utils/mandateModelCall.js';
import { normalizeDecisionInput, effectiveVerbs } from '../_utils/mandateDecisionTool.js';
import { evaluateGate } from '../_utils/mandateGate.js';
import { executeDecision } from '../_utils/mandateExecution.js';
import { markFor } from '../_utils/mandateUniverseSnapshot.js';
import { classifyOvernightGaps } from '../_utils/mandateCorporateActions.js';
import { resolveRegime } from '../_utils/mandateRegime.js';
import { priceUsage } from '../_utils/modelPriceTable.js';
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
 * Run one book's tick: assemble prompt from the pinned vintage → call model →
 * normalize → gate → execute. Returns a terminal result. `callModel` is injected
 * so tests drive the full pipeline without the network.
 *
 * @returns {Promise<{ outcome:string, status?:string, reason?:string }>}
 */
export async function runBookEval(db, {
  book, mandateRef, vintage, snapshot, sessionDate, slot, now = new Date(),
  callModel = callMandateModelDirect, regime = null,
}) {
  // Tier gating (§3.1): cadence tiers map to session-relative slots.
  if (!tierEligibleAt(book.cadenceTier, slot)) return { outcome: 'skipped_tier' };
  if (!vintage) return { outcome: 'skipped', reason: 'no_vintage' };

  const positions = book.portfolio?.positions || {};
  const { actionable: freshActionable } = classifyHeldFreshness(snapshot, Object.keys(positions), { now, maxAgeMs: MANDATE_MARK_MAX_AGE_MS });

  // Gap detector (§4.3/I7): a held symbol whose overnight move is CA-shaped is
  // FROZEN this tick — its (already-adjusted) fresh mark prices nothing, so the
  // manager can't act on a phantom while the position is still unadjusted.
  // Ephemeral per tick: once the close pass applies the action (or the price
  // normalizes), the symbol stops classifying. News-shaped gaps pass untouched.
  const gaps = classifyOvernightGaps(positions, snapshot, caActionsBySymbol(snapshot));
  const caFrozen = gaps.frozen;
  const actionable = new Set([...freshActionable].filter((s) => !caFrozen.has(s)));
  // The frozen-excluded view is THE valuation basis this tick (§3.5/§4.3): the
  // prompt's book context, the gate's exposure math, the submit mark, and the
  // execution boundary all price frozen symbols at last-good — the manager
  // never reasons over, and never fills at, a phantom mark. The candidate
  // slate is unaffected (held symbols are excluded from it anyway).
  const evalSnapshot = snapshotExcluding(snapshot, caFrozen);

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
  const { decision: extracted, usage } = await callModel(modelSeat, {
    system: prompt.system, messages: prompt.messages, tools: prompt.tools,
  });
  if (!extracted?.ok) return { outcome: 'no_decision', reason: extracted?.reason || 'model_no_tool_use', usage: usage ?? extracted?.usage ?? null };

  const norm = normalizeDecisionInput(extracted.input, { verbs });
  if (!norm.ok) return { outcome: 'bad_decision', reason: norm.reason, usage: usage ?? extracted?.usage ?? null };
  const decision = norm.decision;

  // Submission envelope (F1/F2) — deterministic requestId is the decisionId.
  const envelope = buildSubmissionEnvelope({
    mandateId: mandateRef.id ?? book.mandateId ?? book.id,
    baseRevision: book.revision,
    quarterKey: book.quarterKey,
    vintageRef: book.vintageRef,
    snapshotTickKey: snapshot.tickKey,
    bookStatus: book.status,
    submittedAt: now.toISOString(),
    sessionDate,
    mandatePromptTemplateVersion: null, // template versioning stamped from platform machinery (P5)
  });

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

// ── Cost-telemetry accumulation (§6.2/§6.3, I-6) ─────────────────────────────
/**
 * Build the costTelemetry merge patch for one billed eval: current-month
 * accumulators (reset on month rollover; monthKey = YYYY-MM) plus the intra-day
 * block the close pass folds into the daily row. Computed client-side from the
 * page-read book — safe because within a slot a book evals at most once
 * (lastEvalTickKey stamp) and slots are sequential. An unpriced model id
 * accumulates tokens with `unpricedCalls` incremented — estUsd must degrade
 * loudly, never silently understate (modelPriceTable alerts once per id).
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
      estUsd: (prev.estUsd || 0) + (priced.estUsd || 0),
      unpricedCalls: (prev.unpricedCalls || 0) + (priced.priced ? 0 : 1),
      today: {
        date: sessionDate,
        evalCount: (today.evalCount || 0) + 1,
        tokensIn: (today.tokensIn || 0) + priced.tokensIn,
        tokensOut: (today.tokensOut || 0) + priced.tokensOut,
        cacheHitTokens: (today.cacheHitTokens || 0) + priced.cacheHitTokens,
        estUsd: (today.estUsd || 0) + (priced.estUsd || 0),
      },
    },
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

  const db = getFirebaseAdmin();
  const startedAt = Date.now();
  const ownerToken = mintOwnerToken();
  const summary = { slot: tick.slot, tickKey: tick.tickKey, evaluated: 0, executed: 0, gated: 0, rejected: 0, failed: 0, skipped: 0, errors: 0, complete: false };

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
        // Precondition failed — a tick harvests but does NOT submit (§3.1).
        console.error(`${LOG_PREFIX} snapshot precondition failed — harvest-only tick, no submit: ${snapErr.message}`);
        return res.status(200).json({ ok: true, noop: true, reason: 'snapshot_failed', ...summary });
      }
    }

    // 6. Bounded sweep (F24), ordered by health.lastSuccessfulEvalAt ASC so the
    //    least-recently-served books go first and no tail starves. NO durable
    //    value-cursor: the ordering key is MUTATED on every eval (bumped to `now`),
    //    which would make a persisted coordinate stale and could skip a prefix at a
    //    slot boundary (spec review S1). Instead each generous fire re-queries the
    //    front and evaluates the page; an evaluated book jumps to the back
    //    (lastSuccessfulEvalAt=now) and the within-slot `lastEvalTickKey` stamp
    //    makes a re-surfaced already-served book a no-op. Completion this slot is
    //    proven when a full page yields zero newly-evaluated books.
    //    (Depends on health.lastSuccessfulEvalAt being PRESENT on every book —
    //    Phase 1's buildHealthBlock seeds it to null; an orderBy silently drops
    //    docs missing the field.)
    const pageSnap = await db.collection(MANDATES_COLLECTION)
      .where('status', '==', 'active')
      .orderBy('health.lastSuccessfulEvalAt', 'asc')
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
    let newlyEvaluated = 0;
    for (const docSnap of page) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) break; // defer remaining to the next fire
      const mandateRef = docSnap.ref;
      const book = { _id: docSnap.id, ...docSnap.data() };

      // Within-slot idempotency (§3.1 "the cron fires generously"): a book already
      // stamped with THIS tickKey was evaluated this slot — never re-evaluate it in
      // the same slot (the stamp is written atomically with the decision commit).
      if (book.execState?.lastEvalTickKey === tick.tickKey) { summary.skipped++; continue; }

      const lease = await acquireLease(db, mandateRef, ownerToken, { now });
      if (!lease.acquired) { summary.skipped++; continue; }
      try {
        // Load the pinned vintage (cached per vintageRef across the page).
        let vintage = vintageCache.get(book.vintageRef);
        if (vintage === undefined) {
          const vSnap = await db.doc(book.vintageRef).get();
          vintage = vSnap.exists ? vSnap.data() : null;
          vintageCache.set(book.vintageRef, vintage);
        }

        const result = await runBookEval(db, {
          book, mandateRef, vintage, snapshot, sessionDate: tick.date, slot: tick.slot, now, regime,
        });

        // §6.2: accumulate cost telemetry for any BILLED call, whatever the
        // outcome — a no_decision eval still spent tokens.
        const priced = result.usage ? priceUsage(vintage?.modelSeat?.model, result.usage) : null;
        const telemetry = priced ? telemetryPatch(book, tick.date, priced) : null;

        // §6.4: the quarantine flip patch when a failure crosses the threshold —
        // exit-only mode, loudly announced; founder action restores full mode.
        const quarantinePatchFor = (failures) => {
          if (failures >= MANDATE_QUARANTINE_THRESHOLD && !book.health?.quarantined) {
            console.error(
              `${LOG_PREFIX} MANDATE_QUARANTINED ${book._id} — ${failures} consecutive eval failures; `
              + 'exit-only mode (tool restricted to SELL/TRIM/HOLD; still swept, still marked daily; founder action restores)',
            );
            return { quarantined: true };
          }
          return {};
        };

        if (result.outcome === 'skipped_tier' || result.outcome === 'skipped') {
          summary.skipped++; // ineligible tier / no vintage — not an attempt, no stamp
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
            await mandateRef.set({
              health: { consecutiveEvalFailures: failures, ...quarantinePatchFor(failures) },
              ...(telemetry || {}),
            }, { merge: true }).catch(() => {});
          } else {
            // The execution txn already stamped lastEvalTickKey atomically. Health is
            // bookkeeping (no revision bump): a completed eval advances the sweep
            // ordering key and resets the failure streak.
            await mandateRef.set({
              health: { lastSuccessfulEvalAt: now, consecutiveEvalFailures: 0 },
              ...(telemetry || {}),
            }, { merge: true }).catch(() => {});
          }
        } else {
          // Soft model failure (no usable tool_use / malformed): count as a failure,
          // do NOT advance lastSuccessfulEvalAt (it retries next slot), but DO stamp
          // lastEvalTickKey so it is not re-attempted within THIS slot.
          newlyEvaluated++;
          summary.errors++;
          const failures = (book.health?.consecutiveEvalFailures || 0) + 1;
          await mandateRef.set({
            health: { consecutiveEvalFailures: failures, ...quarantinePatchFor(failures) },
            execState: { lastEvalTickKey: tick.tickKey },
            ...(telemetry || {}),
          }, { merge: true }).catch(() => {});
        }
      } catch (bookErr) {
        summary.errors++;
        console.error(`${LOG_PREFIX} book ${book._id} eval failed: ${bookErr.message}`);
        // Per-book isolation (§3.1/§6.4): increment the failure counter AND stamp
        // lastEvalTickKey so a persistently-throwing book is not re-attempted
        // (re-billed) on every generous fire this slot (spec review S6).
        newlyEvaluated++;
        const failures = (book.health?.consecutiveEvalFailures || 0) + 1;
        const quarantine = failures >= MANDATE_QUARANTINE_THRESHOLD && !book.health?.quarantined
          ? { quarantined: true } : {};
        if (quarantine.quarantined) {
          console.error(`${LOG_PREFIX} MANDATE_QUARANTINED ${book._id} — ${failures} consecutive eval failures; exit-only mode`);
        }
        await mandateRef.set({
          health: { consecutiveEvalFailures: failures, ...quarantine },
          execState: { lastEvalTickKey: tick.tickKey },
        }, { merge: true }).catch(() => {});
      } finally {
        await releaseLease(db, mandateRef, ownerToken).catch(() => {});
      }
    }

    // 8. Completion (F24): a full page with zero newly-evaluated books means the
    //    frontier has reached books already served this slot → sweep complete.
    if (newlyEvaluated === 0) {
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
 * date via execState.lastCloseKey; ordered by health.lastCloseMarkAt ASC so the
 * least-recently-closed books go first (the mutated key advances the frontier —
 * no durable cursor, the P2 S1 lesson; depends on lastCloseMarkAt being PRESENT
 * on every book — Phase 1's buildHealthBlock seeds it null). Completion = a
 * full page with zero newly-closed books, which also triggers the bounded §3.7
 * retention cleanup.
 */
async function runCloseSweep(req, res, { now, closeTick }) {
  const db = getFirebaseAdmin();
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

    // 3. Bounded page, least-recently-closed first.
    const pageSnap = await db.collection(MANDATES_COLLECTION)
      .where('status', '==', 'active')
      .orderBy('health.lastCloseMarkAt', 'asc')
      .orderBy('__name__', 'asc')
      .limit(MANDATE_SWEEP_PAGE_SIZE)
      .get();

    let newlyClosed = 0;
    for (const docSnap of pageSnap.docs) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) break; // defer to the next fire in the window
      const mandateRef = docSnap.ref;
      const book = { _id: docSnap.id, ...docSnap.data() };
      if (book.execState?.lastCloseKey === date) { summary.skipped++; continue; }

      const lease = await acquireLease(db, mandateRef, ownerToken, { now });
      if (!lease.acquired) { summary.skipped++; continue; }
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
      } finally {
        await releaseLease(db, mandateRef, ownerToken).catch(() => {});
      }
    }

    // 4. Completion + retention (§3.7): cleanup piggybacks the completed sweep
    // (bounded; a no-op once the backlog is clear).
    if (newlyClosed === 0) {
      summary.complete = true;
      console.log(`${LOG_PREFIX} close sweep complete for ${date} — all active books closed`);
      await runRetentionCleanup(db, { now, documentIdPath: FieldPath.documentId() }).catch((err) => {
        console.error(`${LOG_PREFIX} retention cleanup error: ${err.message}`);
      });
    }

    return res.status(200).json({ ok: true, ...summary });
  } catch (err) {
    console.error(`${LOG_PREFIX} close sweep error: ${err.message}`);
    return res.status(500).json({ ok: false, error: err.message, ...summary });
  }
}
