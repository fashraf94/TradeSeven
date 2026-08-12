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

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import {
  MANAGED_MANDATE_ENABLED,
  MANDATE_EVAL_ENABLED,
} from '../../src/config/featureFlags.js';
import {
  MANDATE_SWEEP_PAGE_SIZE,
  MANDATE_MARK_MAX_AGE_MS,
} from '../_utils/mandateConfig.js';
import { activeTick, tierEligibleAt } from '../_utils/mandateSessionSlots.js';
import { ensureUniverseSnapshot, ensureDailySnapshot, classifyHeldFreshness, SNAPSHOT_COLLECTION } from '../_utils/mandateUniverseSnapshot.js';
import { mintOwnerToken, acquireLease, releaseLease } from '../_utils/mandateLease.js';
import { assembleMandatePrompt } from '../_utils/mandatePromptAssembly.js';
import { buildSubmissionEnvelope, callMandateModelDirect } from '../_utils/mandateModelCall.js';
import { normalizeDecisionInput } from '../_utils/mandateDecisionTool.js';
import { evaluateGate } from '../_utils/mandateGate.js';
import { executeDecision } from '../_utils/mandateExecution.js';
import { markFor } from '../_utils/mandateUniverseSnapshot.js';

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
  callModel = callMandateModelDirect,
}) {
  // Tier gating (§3.1): cadence tiers map to session-relative slots.
  if (!tierEligibleAt(book.cadenceTier, slot)) return { outcome: 'skipped_tier' };
  if (!vintage) return { outcome: 'skipped', reason: 'no_vintage' };

  const positions = book.portfolio?.positions || {};
  const { actionable } = classifyHeldFreshness(snapshot, Object.keys(positions), { now, maxAgeMs: MANDATE_MARK_MAX_AGE_MS });

  // Assemble the prompt from the pinned vintage (§3.2) and call the model.
  const prompt = assembleMandatePrompt({ vintage, book, snapshot, now });
  const modelSeat = vintage.modelSeat;
  const { decision: extracted } = await callModel(modelSeat, {
    system: prompt.system, messages: prompt.messages, tools: prompt.tools,
  });
  if (!extracted?.ok) return { outcome: 'no_decision', reason: extracted?.reason || 'model_no_tool_use' };

  const norm = normalizeDecisionInput(extracted.input, { verbs: vintage.gateConfig?.decisionVerbs });
  if (!norm.ok) return { outcome: 'bad_decision', reason: norm.reason };
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

  // Deterministic gate (§3.4).
  const gateResult = evaluateGate({
    decision, positions, cash: book.portfolio?.cash || 0, snapshot,
    gateConfig: vintage.gateConfig || {}, actionableHeld: actionable,
  });

  // Direct transport (P2): submit mark == harvest mark (same tick), so the drift
  // guard is satisfied by construction; it bites under batch transport (P5).
  const submitMark = decision.ticker ? markFor(snapshot, decision.ticker) : null;

  const res = await executeDecision(db, {
    mandateRef, decisionId: envelope.requestId, decision, gateResult, envelope,
    snapshot, submitMark, currentSessionDate: sessionDate, now,
  });
  return { outcome: 'terminal', status: res.status, decisionId: envelope.requestId };
}

// ── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // 1. Auth (mirrors agent-evaluate).
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const authHeader = req.headers.authorization;
  if (!isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // 2. Master + eval gates (§7). Dark default → no-op before any I/O or model call.
  if (!MANAGED_MANDATE_ENABLED || !MANDATE_EVAL_ENABLED) {
    return res.status(200).json({ ok: true, noop: true, reason: 'mandate_eval_dark' });
  }

  const now = new Date();
  // 3. Calendar gating (§3.1): only fire inside a session-relative slot.
  const tick = activeTick(now);
  if (!tick) {
    return res.status(200).json({ ok: true, noop: true, reason: 'no_active_slot' });
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
          book, mandateRef, vintage, snapshot, sessionDate: tick.date, slot: tick.slot, now,
        });

        if (result.outcome === 'skipped_tier' || result.outcome === 'skipped') {
          summary.skipped++; // ineligible tier / no vintage — not an attempt, no stamp
        } else if (result.outcome === 'terminal') {
          newlyEvaluated++;
          summary.evaluated++;
          if (result.status === 'executed') summary.executed++;
          else if (result.status === 'gated') summary.gated++;
          else if (result.status && result.status.startsWith('rejected')) summary.rejected++;
          if (result.status === 'failed') {
            // A §3.5 invariant abort is a FAILURE (health increment, §3.5), not a
            // success — it must not reset the streak the P3 quarantine watches
            // (spec review S2). The exec txn already stamped lastEvalTickKey.
            summary.failed++;
            await mandateRef.set({
              health: { consecutiveEvalFailures: (book.health?.consecutiveEvalFailures || 0) + 1 },
            }, { merge: true }).catch(() => {});
          } else {
            // The execution txn already stamped lastEvalTickKey atomically. Health is
            // bookkeeping (no revision bump): a completed eval advances the sweep
            // ordering key and resets the failure streak.
            await mandateRef.set({
              health: { lastSuccessfulEvalAt: now, consecutiveEvalFailures: 0 },
            }, { merge: true }).catch(() => {});
          }
        } else {
          // Soft model failure (no usable tool_use / malformed): count as a failure,
          // do NOT advance lastSuccessfulEvalAt (it retries next slot), but DO stamp
          // lastEvalTickKey so it is not re-attempted within THIS slot.
          newlyEvaluated++;
          summary.errors++;
          await mandateRef.set({
            health: { consecutiveEvalFailures: (book.health?.consecutiveEvalFailures || 0) + 1 },
            execState: { lastEvalTickKey: tick.tickKey },
          }, { merge: true }).catch(() => {});
        }
      } catch (bookErr) {
        summary.errors++;
        console.error(`${LOG_PREFIX} book ${book._id} eval failed: ${bookErr.message}`);
        // Per-book isolation (§3.1/§6.4): increment the failure counter AND stamp
        // lastEvalTickKey so a persistently-throwing book is not re-attempted
        // (re-billed) on every generous fire this slot (spec review S6).
        newlyEvaluated++;
        await mandateRef.set({
          health: { consecutiveEvalFailures: (book.health?.consecutiveEvalFailures || 0) + 1 },
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
