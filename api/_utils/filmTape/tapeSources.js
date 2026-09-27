// api/_utils/filmTape/tapeSources.js
//
// Film Room tape — THE READS (spec BA-2). Admin SDK, server-side, READ-ONLY:
// no function in this file writes. Every read reports whether it succeeded,
// because a failed read is "unavailable", never "empty" (BA-20).
//
// Read: agentBattles/{id}; its `ticks` for the ET day (never `tickBodies` —
// BA-2, invariant 5); learningReceipts/{id}/receipts; its `calls` and
// `declarations`; the day's agentEvalRuns (once per pass, by the caller); the
// intradayViews presence for the day; the prior day's tape.

import { TAPE_SUBCOLLECTION } from '../../../src/constants/filmTape.js';

const docData = (snap) => (snap && snap.exists ? (typeof snap.data === 'function' ? snap.data() : snap.data) : null);
const docsOf = (snap) => (snap?.docs || []).map((d) => ({ id: d.id, ...(typeof d.data === 'function' ? d.data() : d.data) }));

export const battleRef = (db, battleId) => db.collection('agentBattles').doc(battleId);
export const tapeRef = (db, battleId, etDate) => battleRef(db, battleId).collection(TAPE_SUBCOLLECTION).doc(etDate);

async function attempt(fn) {
  try { return { ok: true, value: await fn(), error: null }; } catch (err) { return { ok: false, value: null, error: String(err?.message || err).slice(0, 200) }; }
}

/** The battle document, with its id, or null. */
export async function readBattle(db, battleId) {
  const snap = await battleRef(db, battleId).get();
  const data = docData(snap);
  return data ? { id: battleId, ...data } : null;
}

/**
 * The battle's tick records for one ET day, plus the nearest captured tickSeq
 * on either side of it (for edge gaps). Primary: a single-field range on
 * `capturedAt` (auto-indexed on `ticks`; the capture build exempted only the
 * nested maps). Fallback: the whole subcollection by `tickSeq`, filtered here
 * — `evaluations[]` carry no tickSeq, so the spec's entry-range fallback is not
 * constructible (build report §1.5).
 */
export async function readDayTicks(db, battleId, bounds) {
  const ticks = battleRef(db, battleId).collection('ticks');
  const primary = await attempt(async () => {
    const [day, prev, next] = await Promise.all([
      ticks.where('capturedAt', '>=', bounds.startIso).where('capturedAt', '<', bounds.endIso).get(),
      ticks.where('capturedAt', '<', bounds.startIso).orderBy('capturedAt', 'desc').limit(1).get(),
      ticks.where('capturedAt', '>=', bounds.endIso).orderBy('capturedAt', 'asc').limit(1).get(),
    ]);
    return {
      ticks: docsOf(day),
      prevSeq: docsOf(prev)[0]?.tickSeq ?? null,
      nextSeq: docsOf(next)[0]?.tickSeq ?? null,
      method: 'capturedAt_range',
    };
  });
  if (primary.ok) return { ok: true, ...primary.value, error: null };
  const fallback = await attempt(async () => {
    const all = docsOf(await ticks.orderBy('tickSeq').get());
    const before = all.filter((t) => typeof t.capturedAt === 'string' && t.capturedAt < bounds.startIso);
    const after = all.filter((t) => typeof t.capturedAt === 'string' && t.capturedAt >= bounds.endIso);
    return {
      ticks: all.filter((t) => typeof t.capturedAt === 'string' && t.capturedAt >= bounds.startIso && t.capturedAt < bounds.endIso),
      prevSeq: before.length ? Math.max(...before.map((t) => t.tickSeq).filter(Number.isFinite)) : null,
      nextSeq: after.length ? Math.min(...after.map((t) => t.tickSeq).filter(Number.isFinite)) : null,
      method: 'full_scan',
    };
  });
  if (fallback.ok) return { ok: true, ...fallback.value, error: primary.error };
  return { ok: false, ticks: [], prevSeq: null, nextSeq: null, method: null, error: `${primary.error} | ${fallback.error}` };
}

/** Every learning receipt of the battle (create-only, uncapped). */
export async function readReceipts(db, battleId) {
  const r = await attempt(async () => docsOf(await db.collection('learningReceipts').doc(battleId).collection('receipts').get()));
  return { ok: r.ok, receipts: r.value || [], error: r.error };
}

/** Every call record of the battle (contract V1.4 §1). */
export async function readCalls(db, battleId) {
  const r = await attempt(async () => docsOf(await battleRef(db, battleId).collection('calls').get()));
  return { ok: r.ok, calls: r.value || [], error: r.error };
}

/** Which of `evalIds` have a `declarations/{evalId}` record (contract §2.1: presence proves written). */
export async function readDeclarationPresence(db, battleId, evalIds) {
  const r = await attempt(async () => {
    const present = new Set();
    const col = battleRef(db, battleId).collection('declarations');
    const snaps = await Promise.all(evalIds.map((id) => col.doc(id).get()));
    snaps.forEach((s, i) => { if (s && s.exists) present.add(evalIds[i]); });
    return present;
  });
  return { ok: r.ok, present: r.value || new Set(), error: r.error };
}

/**
 * The day's evaluation-run records, ONCE per pass (§5): a single-field range
 * on `startedAt` — the runId is the run's start instant (agent-evaluate.js).
 */
export async function readEvalRunsForDay(db, bounds) {
  const r = await attempt(async () => docsOf(await db.collection('agentEvalRuns')
    .where('startedAt', '>=', bounds.startIso).where('startedAt', '<', bounds.endIso).get()));
  return { ok: r.ok, runs: (r.value || []).map((run) => ({ runId: run.id, ...run })), error: r.error };
}

/** Does any `intradayViews/{evalId}` exist for the day (BA-14)? null when the read failed. */
export async function readIntradayViewsPresent(db, battleId, bounds) {
  const r = await attempt(async () => {
    const snap = await battleRef(db, battleId).collection('intradayViews')
      .where('evaluatedAt', '>=', bounds.startMs).where('evaluatedAt', '<', bounds.endMs).limit(1).get();
    return (snap?.docs || []).length > 0;
  });
  return r.ok ? r.value : null;
}

/** A stored tape document, or null. */
export async function readTape(db, battleId, etDate) {
  const r = await attempt(async () => docData(await tapeRef(db, battleId, etDate).get()));
  return r.ok ? r.value : null;
}
