// api/_utils/researchRecords/store.js
//
// Pilot P2 — the research record's WRITES and READS outside a host's own
// transaction (the hosts fold their in-transaction writes in themselves, with
// the pure patches in model.js). The gate is the caller's job
// (api/_utils/hypothesisRecords/gate.js); nothing here reads the flag.
//
//   mintWithHost        the host document and its record in ONE transaction —
//                       the record is created in the same commit that creates
//                       the host; a retry finds the record its id names and
//                       writes nothing (never two records, never an overwrite)
//   recordTurnOutcome   a failed or discarded turn, as a SEPARATE AWAITED
//                       write (BUILD_RULES §5 — never fire-and-forget) that
//                       NEVER throws, so it can never change the turn's
//                       response or error
//   readListResearch    the records attached to a list (the Forge's line, and
//                       the refs a new hypothesis version cites)

import {
  RESEARCH_WORK_COLLECTION, isOwnedRecord, isResearchWorkId, researchRefOf, turnPatch, recordSummaryOf,
} from './model.js';

/** A list cites at most this many research records (the earliest first: the list's own research leads). */
export const LIST_RESEARCH_MAX = 100;

export const researchWorkRefOf = (db, researchWorkId) => db.collection(RESEARCH_WORK_COLLECTION).doc(researchWorkId);

/**
 * Build a record or a patch without ever failing the host's turn: a defect in
 * the record's own arithmetic is logged and the host proceeds exactly as it
 * would with no record (no stamp, no record write).
 */
export function safely(label, build) {
  try {
    return build();
  } catch (err) {
    console.error(`[researchRecords:${label}] record skipped (the host's write is unchanged):`, err?.message || err);
    return null;
  }
}

/**
 * Create a host document and its research record together. The record's id is
 * derived from the host (model.js researchWorkIdFor), so a transaction retry
 * that finds the record already committed writes nothing and answers the
 * same id.
 *
 * @returns {Promise<{ researchWorkId: string, minted: boolean }>}
 */
export async function mintWithHost(db, { hostRef, hostDoc, record }) {
  const recordRef = researchWorkRefOf(db, record.researchWorkId);
  return db.runTransaction(async (tx) => {
    const existing = await tx.get(recordRef);
    if (existing.exists) return { researchWorkId: record.researchWorkId, minted: false };
    tx.set(hostRef, hostDoc);
    tx.create(recordRef, record);
    return { researchWorkId: record.researchWorkId, minted: true };
  });
}

/**
 * Fold one failed or discarded turn into its record's telemetry: a fresh read,
 * the owner check, one update. Never throws — a failure is logged and the
 * turn's own answer stands exactly as it was.
 *
 * @param {{ researchWorkId: string, uid: string, kind: 'failure'|'cancellation', elapsedMs: number|null, usage?: object|null, atIso: string, label: string }} p
 * @returns {Promise<boolean>} whether the record was updated
 */
export async function recordTurnOutcome(db, { researchWorkId, uid, kind, elapsedMs, usage = null, atIso, label }) {
  try {
    if (!isResearchWorkId(researchWorkId)) return false;
    const ref = researchWorkRefOf(db, researchWorkId);
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const record = snap.exists ? snap.data() : null;
      if (!isOwnedRecord(record, uid)) return false;
      tx.update(ref, turnPatch(record, { kind, elapsedMs, usage, atIso }));
      return true;
    });
  } catch (err) {
    console.error(`[researchRecords:${label}] turn outcome not recorded (the turn's answer is unchanged):`, err?.message || err);
    return false;
  }
}

const byCreated = (a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : (a.researchWorkId < b.researchWorkId ? -1 : 1));

/**
 * The research records attached to a list, oldest first: those whose subject is
 * the list (a dialogue or screener record it was saved from, its manual
 * record, every analysis session run on it) plus the record the list itself
 * names (`researchWorkId` — a second list saved from one screener session
 * names a record whose subject is the first). The caller's own records only.
 * Reads through `tx` when given (a transaction's reads come before its writes).
 *
 * @returns {Promise<object[]>} stored records, at most LIST_RESEARCH_MAX
 */
export async function readListResearch(db, { uid, watchlistId, listResearchWorkId = null, tx = null }) {
  const get = (refOrQuery) => (tx ? tx.get(refOrQuery) : refOrQuery.get());
  const snap = await get(db.collection(RESEARCH_WORK_COLLECTION).where('watchlistId', '==', watchlistId));
  const byId = new Map();
  for (const d of snap.docs) {
    const r = d.data();
    if (isOwnedRecord(r, uid) && isResearchWorkId(r.researchWorkId)) byId.set(r.researchWorkId, r);
  }
  if (isResearchWorkId(listResearchWorkId) && !byId.has(listResearchWorkId)) {
    const own = await get(researchWorkRefOf(db, listResearchWorkId));
    const r = own.exists ? own.data() : null;
    if (isOwnedRecord(r, uid) && r.researchWorkId === listResearchWorkId) byId.set(r.researchWorkId, r);
  }
  return [...byId.values()].sort(byCreated).slice(0, LIST_RESEARCH_MAX);
}

/** The evidence refs for a list's research, in the order readListResearch returns them. */
export const researchRefsOf = (records) => records.map((r) => researchRefOf(r.researchWorkId));

/** What the Forge's Idea panel is given: the list's research summaries, newest first. */
export const researchSummariesOf = (records) => records.map(recordSummaryOf).reverse();
