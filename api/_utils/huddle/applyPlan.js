// api/_utils/huddle/applyPlan.js
//
// Huddle S1 — THE APPLY MODULE (spec V1.1 §6.1; Amendment B §B1, §B3; A §A4; C §C15).
// One module, three callers: the confirm route, the check-start sweep (sweep.js) and the
// reconcile pass (status route, worker, settle tenant). There is no `apply` route (C7).
//
// FILING AND RECEIPT ARE ONE TRANSACTION (B §B1). Every application of a plan to a
// battle is one Firestore transaction spanning two documents — the battle (the slot,
// through the shared writer fileDirectiveTransactional with the transaction handle,
// directiveWriter.js:81-82) and the huddle record (the `plan.applications[]` receipt):
//   1. read the huddle record and the battle (all reads first);
//   2. decide (applyRules.js): a `written` receipt for (battleId, revision) already
//      present → abort with no writes (at most once); the §6.1 checks; C15's matching
//      confirmation;
//   3. write the slot and append the receipt in the same commit.
// The receipt is therefore durable exactly when the filing is; recovery reads the
// RECEIPT, never the slot (receipt-from-slot recovery is withdrawn, B1).
//
// RECONCILE (V1.1 §6.5; A §A4; B §B3) runs over a confirmed record: it retries every
// non-terminal disposition and applies to the owner's active battles that lack a
// receipt; for each `written` receipt it stamps `heardAt` from the battle's own tick
// capture (rendered, same thread id, same text hash, not suppressed), `replacedAt` when
// the slot's thread is no longer the plan's ("no longer current", with `replacedSince`
// only when a newer directive is in the slot), and, once the session has closed, retires
// the plan by compare-and-clear of the slot (only when the slot still holds the plan's
// thread; a newer directive is never touched) and stamps `retiredAt`. Expiry at the
// close stamps `expiredAt` on every receipt still waiting.
//
// Existing battle keys only (`directive`, `chatExchanges`): the battle document's shape
// is fenced as a concept (BUILD_RULES §1; file-directive.js:65-68). No fenced file is
// edited; none is called but through the shared writer.

import { FieldValue } from 'firebase-admin/firestore';
import { fileDirectiveTransactional } from '../directiveWriter.js';
import { resolveCallRecordsMode } from '../callRecords/mode.js';
import { ARCHETYPE_INTEGRITY_MODE } from '../../../src/config/featureFlags.js';
import { TICKS_SUBCOLLECTION } from '../tickCapture/captureConfig.js';
import { huddleDayRef, battleRefOf, PLAN_STATUS } from './records.js';
import { planThreadIdOf } from './planTemplates.js';
import {
  DISPOSITIONS, decideApplication, buildPlanSlot, buildPlanExchange, upsertReceipt, receiptOf,
  latestReceiptOf, isTerminal, battleKindOf,
} from './applyRules.js';

/** How many of a battle's ticks reconcile reads, from the filing instant on, to find the first heard check. */
export const HEARD_SCAN_LIMIT = 40;

const iso = (nowMs) => new Date(nowMs).toISOString();
const nonEmpty = (v) => typeof v === 'string' && v.length > 0;

/**
 * Apply the confirmed plan to ONE battle — the B1 transaction.
 *
 * @param {object} db
 * @param {{ uid: string, etDate: string, battleId: string, writtenBy: 'confirm'|'sweep'|'reconcile', nowMs?: number, integrityMode?: string }} p
 * @returns {Promise<{ outcome: string, disposition: string|null, receipt?: object, slot?: object }>}
 */
export async function applyPlanToBattle(db, { uid, etDate, battleId, writtenBy, nowMs = Date.now(), integrityMode = ARCHETYPE_INTEGRITY_MODE }) {
  const dayRef = huddleDayRef(db, uid, etDate);
  const battleRef = battleRefOf(db, battleId);
  return db.runTransaction(async (tx) => {
    const recordSnap = await tx.get(dayRef);
    const battleSnap = await tx.get(battleRef);
    const record = recordSnap.exists ? recordSnap.data() : null;
    const battle = battleSnap.exists ? { id: battleSnap.id, ...battleSnap.data() } : null;
    const decision = decideApplication({ battle, uid, record, nowMs, integrityMode });
    if (!decision.disposition) return { outcome: decision.outcome, disposition: null };

    const at = iso(nowMs);
    const revision = decision.confirmation?.revision ?? null;
    const base = { battleId, battleKind: battleKindOf(battle), revision, archetype: decision.archetype ?? null, at };

    if (decision.disposition !== DISPOSITIONS.WRITTEN) {
      const prior = receiptOf(record.plan.applications, battleId, revision);
      // a repeat of the same waiting state writes nothing (no churn on every check)
      if (prior && prior.disposition === decision.disposition) return { outcome: 'unchanged', disposition: decision.disposition, receipt: prior };
      const receipt = { ...base, disposition: decision.disposition, writtenBy };
      tx.update(dayRef, { 'plan.applications': upsertReceipt(record.plan.applications, receipt), updatedAt: at });
      return { outcome: 'recorded', disposition: decision.disposition, receipt };
    }

    const slot = buildPlanSlot({ uid, etDate, confirmation: decision.confirmation, createdAt: at });
    const exchange = buildPlanExchange({ slot, battle });
    await fileDirectiveTransactional(tx, battleRef, {
      db,
      battleId,
      arrayUnion: FieldValue.arrayUnion,
      exchange,
      filed: true,
      priorSlot: battle.directive ?? null,
      callsMode: resolveCallRecordsMode(battle),
      fields: { directive: slot },
    });
    const receipt = { ...base, disposition: DISPOSITIONS.WRITTEN, directiveThreadId: slot.directiveThreadId, writtenBy };
    tx.update(dayRef, { 'plan.applications': upsertReceipt(record.plan.applications, receipt), updatedAt: at });
    return { outcome: 'written', disposition: DISPOSITIONS.WRITTEN, receipt, slot };
  });
}

/** The owner's active battles (equality filters only: no composite index, huddle-s1-queries.md Q-A1). */
export async function activeBattleIdsOf(db, uid) {
  const snap = await db.collection('agentBattles').where('ownerId', '==', uid).where('status', '==', 'active').get();
  return snap.docs.map((d) => d.id);
}

/**
 * Apply the confirmed plan to every battle the player owns this session (V1.1 §6.1;
 * R-3/R-7/R-15) and to any battle already holding a waiting receipt. Each battle is its
 * own B1 transaction; one battle's failure is recorded as `retry_error` and never stops
 * the others.
 */
export async function applyConfirmedPlan(db, { uid, etDate, writtenBy, nowMs = Date.now(), record = null, integrityMode } = {}) {
  const ids = new Set(await activeBattleIdsOf(db, uid));
  for (const r of Array.isArray(record?.plan?.applications) ? record.plan.applications : []) {
    if (r && nonEmpty(r.battleId) && !isTerminal(r.disposition)) ids.add(r.battleId);
  }
  const results = [];
  for (const battleId of [...ids].sort()) {
    try {
      results.push({ battleId, ...(await applyPlanToBattle(db, { uid, etDate, battleId, writtenBy, nowMs, integrityMode })) });
    } catch (err) {
      results.push({ battleId, outcome: 'error', disposition: DISPOSITIONS.RETRY_ERROR, error: err?.message || String(err) });
      await recordRetryError(db, { uid, etDate, battleId, nowMs, writtenBy }).catch(() => {});
    }
  }
  return results;
}

/** A thrown application leaves a `retry_error` receipt when nothing better is on record (best effort, its own transaction). */
async function recordRetryError(db, { uid, etDate, battleId, nowMs, writtenBy }) {
  const dayRef = huddleDayRef(db, uid, etDate);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(dayRef);
    const plan = snap.exists ? snap.data()?.plan : null;
    if (!plan || plan.status !== PLAN_STATUS.CONFIRMED) return;
    const newest = plan.confirmations?.[plan.confirmations.length - 1];
    const revision = newest?.revision ?? null;
    const prior = receiptOf(plan.applications, battleId, revision);
    if (prior && isTerminal(prior.disposition)) return;
    if (prior && prior.disposition === DISPOSITIONS.RETRY_ERROR) return;
    tx.update(dayRef, {
      'plan.applications': upsertReceipt(plan.applications, { battleId, battleKind: null, revision, archetype: null, at: iso(nowMs), disposition: DISPOSITIONS.RETRY_ERROR, writtenBy }),
      updatedAt: iso(nowMs),
    });
  });
}

// ─────────────────────────────── reconcile ───────────────────────────────

/** Is this tick the plan heard (V1.1 §6.4)? Rendered into the prompt, same thread, same text, not suppressed. */
export function tickHeardPlan(tick, { threadId, textHash }) {
  const c = tick?.controls;
  return !!c && c.rendered === 'resolved' && c.directiveThreadId === threadId && c.directiveTextHash === textHash
    && (c.directiveSuppressed === null || c.directiveSuppressed === undefined);
}

/** The first heard tick at or after the filing (single-field capturedAt range: no composite; Q-R2). */
export async function findHeardTick(db, { battleId, sinceIso, threadId, textHash }) {
  const snap = await battleRefOf(db, battleId).collection(TICKS_SUBCOLLECTION)
    .where('capturedAt', '>=', sinceIso).orderBy('capturedAt', 'asc').limit(HEARD_SCAN_LIMIT).get();
  for (const doc of snap.docs) {
    const tick = doc.data();
    if (tickHeardPlan(tick, { threadId, textHash })) return { heardAt: tick.capturedAt, heardTickId: doc.id };
  }
  return null;
}

/** The stamp fields a written receipt gains from what the battle shows now (pure; A §A4). */
export function observeWrittenReceipt(receipt, battle, { nowMs }) {
  const stamps = {};
  const slot = battle?.directive ?? null;
  const slotThread = nonEmpty(slot?.directiveThreadId) ? slot.directiveThreadId : null;
  if (!receipt.replacedAt && slotThread !== receipt.directiveThreadId) {
    stamps.replacedAt = iso(nowMs);
    stamps.replacedThreadId = slotThread;
    const slotAt = typeof slot?.createdAt === 'string' ? Date.parse(slot.createdAt) : NaN;
    const writtenAt = Date.parse(receipt.at);
    // "since {time}" only when the slot holds a directive newer than the filing (A §A4), never otherwise
    stamps.replacedSince = slotThread && Number.isFinite(slotAt) && Number.isFinite(writtenAt) && slotAt > writtenAt ? slot.createdAt : null;
  }
  return stamps;
}

/**
 * Retire the plan at the close (A §A9 timing as replaced by B §B3): compare-and-clear the
 * slot ONLY while it still holds the plan's thread, and stamp `retiredAt`, in one
 * transaction over the battle and the record. A newer directive is never touched.
 */
export async function retireAtClose(db, { uid, etDate, battleId, directiveThreadId, revision, nowMs }) {
  const dayRef = huddleDayRef(db, uid, etDate);
  const battleRef = battleRefOf(db, battleId);
  return db.runTransaction(async (tx) => {
    const recordSnap = await tx.get(dayRef);
    const battleSnap = await tx.get(battleRef);
    const plan = recordSnap.exists ? recordSnap.data()?.plan : null;
    const receipt = receiptOf(plan?.applications, battleId, revision);
    if (!receipt || receipt.disposition !== DISPOSITIONS.WRITTEN || receipt.retiredAt) return { outcome: 'nothing_to_retire' };
    const slot = battleSnap.exists ? battleSnap.data()?.directive : null;
    const cleared = !!slot && slot.directiveThreadId === directiveThreadId;
    if (cleared) tx.update(battleRef, { directive: null });
    const next = plan.applications.map((r) => (r === receipt ? { ...r, retiredAt: iso(nowMs), retiredSlot: cleared } : r));
    tx.update(dayRef, { 'plan.applications': next, updatedAt: iso(nowMs) });
    return { outcome: cleared ? 'retired' : 'retired_slot_not_held' };
  });
}

/** Stamp heard / replaced fields on one written receipt (its own small transaction on the record). */
async function stampReceipt(db, { uid, etDate, battleId, revision, stamps, nowMs }) {
  if (Object.keys(stamps).length === 0) return;
  const dayRef = huddleDayRef(db, uid, etDate);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(dayRef);
    const plan = snap.exists ? snap.data()?.plan : null;
    const receipt = receiptOf(plan?.applications, battleId, revision);
    if (!receipt || receipt.disposition !== DISPOSITIONS.WRITTEN) return;
    const merged = { ...receipt };
    for (const [k, v] of Object.entries(stamps)) if (merged[k] === undefined || merged[k] === null) merged[k] = v;
    tx.update(dayRef, { 'plan.applications': plan.applications.map((r) => (r === receipt ? merged : r)), updatedAt: iso(nowMs) });
  });
}

/**
 * The reconcile pass over one player's record (V1.1 §6.5; B §B3). Never throws: every
 * step's failure is counted and left for the next pass.
 *
 * @returns {Promise<{ outcome: string, applied: number, heard: number, replaced: number, retired: number, expired: number, errors: number }>}
 */
export async function reconcileHuddle(db, { uid, etDate, nowMs = Date.now(), integrityMode } = {}) {
  const tally = { outcome: 'reconciled', applied: 0, heard: 0, replaced: 0, retired: 0, expired: 0, errors: 0 };
  let record;
  try {
    const snap = await huddleDayRef(db, uid, etDate).get();
    record = snap.exists ? snap.data() : null;
  } catch {
    return { ...tally, outcome: 'read_failed', errors: 1 };
  }
  if (!record) return { ...tally, outcome: 'no_record' };
  const plan = record.plan;
  const closeMs = record.session?.closeMs;
  const closed = typeof closeMs === 'number' && Number.isFinite(closeMs) && nowMs >= closeMs;

  // A proposed plan past the close expires (confirm would answer 410 now).
  if (plan?.status === PLAN_STATUS.PROPOSED && closed) {
    try {
      await expireProposed(db, { uid, etDate, nowMs });
      tally.expired += 1;
    } catch { tally.errors += 1; }
    return { ...tally, outcome: 'expired_proposed' };
  }
  if (plan?.status !== PLAN_STATUS.CONFIRMED) return { ...tally, outcome: 'not_confirmed' };

  // 1. retries and battles still lacking a receipt — only while the session is open.
  if (!closed) {
    try {
      const results = await applyConfirmedPlan(db, { uid, etDate, writtenBy: 'reconcile', nowMs, record, integrityMode });
      tally.applied += results.filter((r) => r.outcome === 'written').length;
      tally.errors += results.filter((r) => r.outcome === 'error').length;
    } catch { tally.errors += 1; }
  }

  // 2. the written receipts: heard, replaced, retired.
  let fresh = record;
  try {
    const snap = await huddleDayRef(db, uid, etDate).get();
    if (snap.exists) fresh = snap.data();
  } catch { tally.errors += 1; }
  const written = (fresh.plan?.applications || []).filter((r) => r && r.disposition === DISPOSITIONS.WRITTEN && !r.retiredAt);
  const confirmation = (rev) => (fresh.plan?.confirmations || []).find((c) => c && c.revision === rev) || null;
  for (const receipt of written) {
    try {
      const battleSnap = await battleRefOf(db, receipt.battleId).get();
      const battle = battleSnap.exists ? battleSnap.data() : null;
      const stamps = observeWrittenReceipt(receipt, battle, { nowMs });
      if (!receipt.heardAt) {
        const conf = confirmation(receipt.revision);
        const heard = conf ? await findHeardTick(db, { battleId: receipt.battleId, sinceIso: receipt.at, threadId: receipt.directiveThreadId, textHash: conf.renderedTextHash }) : null;
        if (heard) { Object.assign(stamps, heard); tally.heard += 1; }
      }
      if (stamps.replacedAt) tally.replaced += 1;
      await stampReceipt(db, { uid, etDate, battleId: receipt.battleId, revision: receipt.revision, stamps, nowMs });
      if (closed) {
        const r = await retireAtClose(db, { uid, etDate, battleId: receipt.battleId, directiveThreadId: receipt.directiveThreadId, revision: receipt.revision, nowMs });
        if (r.outcome === 'retired' || r.outcome === 'retired_slot_not_held') tally.retired += 1;
      }
    } catch {
      tally.errors += 1;
    }
  }

  // 3. at the close, every receipt still waiting expires.
  if (closed) {
    try {
      tally.expired += await expireWaiting(db, { uid, etDate, nowMs });
    } catch { tally.errors += 1; }
  }
  return tally;
}

async function expireProposed(db, { uid, etDate, nowMs }) {
  const dayRef = huddleDayRef(db, uid, etDate);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(dayRef);
    const plan = snap.exists ? snap.data()?.plan : null;
    if (!plan || plan.status !== PLAN_STATUS.PROPOSED) return;
    tx.update(dayRef, { 'plan.status': PLAN_STATUS.EXPIRED, 'plan.expiredAt': iso(nowMs), updatedAt: iso(nowMs) });
  });
}

async function expireWaiting(db, { uid, etDate, nowMs }) {
  const dayRef = huddleDayRef(db, uid, etDate);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(dayRef);
    const plan = snap.exists ? snap.data()?.plan : null;
    if (!plan || !Array.isArray(plan.applications)) return 0;
    let n = 0;
    const next = plan.applications.map((r) => {
      if (!r || isTerminal(r.disposition) || r.expiredAt) return r;
      n += 1;
      return { ...r, expiredAt: iso(nowMs) };
    });
    if (n > 0) tx.update(dayRef, { 'plan.applications': next, updatedAt: iso(nowMs) });
    return n;
  });
}

/** Per-battle status for the status route (§6.4 vocabulary, from receipts only). */
export function statusOfBattles(plan) {
  const ids = [...new Set((plan?.applications || []).map((r) => r?.battleId).filter(nonEmpty))].sort();
  return ids.map((battleId) => {
    const r = latestReceiptOf(plan.applications, battleId);
    return {
      battleId,
      battleKind: r.battleKind ?? null,
      revision: r.revision ?? null,
      disposition: r.disposition,
      at: r.at ?? null,
      heardAt: r.heardAt ?? null,
      replacedAt: r.replacedAt ?? null,
      replacedSince: r.replacedSince ?? null,
      retiredAt: r.retiredAt ?? null,
      expiredAt: r.expiredAt ?? null,
    };
  });
}

export { planThreadIdOf };
