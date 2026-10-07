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

/**
 * A list's research is read in ONE bounded equality query (reviews R2-1 /
 * R4-5): every analysis view opened on a list is a session and so a record,
 * and an unbounded read would grow with each open. Past this many attached
 * records the read is a deterministic subset (document-id order; the list's
 * own record is always read by its id) — a bound the Command Center arc can
 * lift with a (watchlistId, createdAt) composite if lists ever get there.
 */
export const LIST_RESEARCH_READ_MAX = 200;
/** The Forge is given at most this many research summaries. */
export const RESEARCH_SUMMARIES_MAX = 20;

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
 * How long a failed turn waits for its record write (review R2-2). The write
 * runs after the model call — on the timeout path, in the last seconds of a
 * 30 s function — so it is awaited (BUILD_RULES §5) but BOUNDED: one
 * transaction attempt, at most this long. Past it the turn answers exactly as
 * it would have, and the record write is reported as unconfirmed (logged) —
 * never left to replace the turn's answer with the platform's timeout.
 */
export const TURN_OUTCOME_DEADLINE_MS = 1500;

/**
 * Fold one failed or discarded turn into its record's telemetry: a fresh read,
 * the owner check, one update — one attempt, within TURN_OUTCOME_DEADLINE_MS.
 * Never throws — a failure (or an unconfirmed write) is logged and the turn's
 * own answer stands exactly as it was.
 *
 * @param {{ researchWorkId: string, uid: string, kind: 'failure'|'cancellation', elapsedMs: number|null, usage?: object|null, atIso: string, label: string }} p
 * @returns {Promise<'recorded'|'skipped'|'unconfirmed'|'failed'>}
 */
export async function recordTurnOutcome(db, { researchWorkId, uid, kind, elapsedMs, usage = null, atIso, label, deadlineMs = TURN_OUTCOME_DEADLINE_MS }) {
  let timer = null;
  try {
    if (!isResearchWorkId(researchWorkId)) return 'skipped';
    const ref = researchWorkRefOf(db, researchWorkId);
    const write = db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const record = snap.exists ? snap.data() : null;
      if (!isOwnedRecord(record, uid)) return 'skipped';
      const patch = turnPatch(record, { kind, elapsedMs, usage, atIso });
      if (!patch) return 'skipped'; // a closed record never moves
      tx.update(ref, patch);
      return 'recorded';
    }, { maxAttempts: 1 });
    const deadline = new Promise((resolve) => { timer = setTimeout(() => resolve('unconfirmed'), deadlineMs); });
    const outcome = await Promise.race([write, deadline]);
    if (outcome === 'unconfirmed') {
      // The write may still land; the turn does not wait for it. Its eventual failure is logged, never thrown.
      write.catch((err) => console.error(`[researchRecords:${label}] late turn-outcome write failed:`, err?.message || err));
      console.error(`[researchRecords:${label}] turn outcome unconfirmed after ${deadlineMs} ms (the turn's answer is unchanged)`);
    }
    return outcome;
  } catch (err) {
    console.error(`[researchRecords:${label}] turn outcome not recorded (the turn's answer is unchanged):`, err?.message || err);
    return 'failed';
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const byCreated = (a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : (a.researchWorkId < b.researchWorkId ? -1 : 1));

/**
 * The research records ATTACHED to a list, oldest first. A record is attached
 * to a list when its subject is that list: the dialogue or screener record the
 * list was saved from, its manual record, every analysis session run on it.
 * The record the list itself names (`researchWorkId`) is always one of them —
 * read by its id too, in case the bounded query left it out. The caller's own
 * records only. Reads through `tx` when given (a transaction's reads come
 * before its writes).
 *
 * @returns {Promise<object[]>} stored records, at most LIST_RESEARCH_READ_MAX + 1
 */
export async function readListResearch(db, { uid, watchlistId, listResearchWorkId = null, tx = null }) {
  const get = (refOrQuery) => (tx ? tx.get(refOrQuery) : refOrQuery.get());
  const attached = (r) => isOwnedRecord(r, uid) && isResearchWorkId(r.researchWorkId) && r.watchlistId === watchlistId;
  const snap = await get(db.collection(RESEARCH_WORK_COLLECTION).where('watchlistId', '==', watchlistId).limit(LIST_RESEARCH_READ_MAX));
  const byId = new Map();
  for (const d of snap.docs) {
    const r = d.data();
    if (attached(r)) byId.set(r.researchWorkId, r);
  }
  if (isResearchWorkId(listResearchWorkId) && !byId.has(listResearchWorkId)) {
    const own = await get(researchWorkRefOf(db, listResearchWorkId));
    const r = own.exists ? own.data() : null;
    if (attached(r) && r.researchWorkId === listResearchWorkId) byId.set(r.researchWorkId, r);
  }
  return [...byId.values()].sort(byCreated);
}

/** The evidence refs a new version cites: every record read for the list, oldest first (the list's own research leads). */
export const researchRefsOf = (records) => records.map((r) => researchRefOf(r.researchWorkId));

/**
 * What the Forge's Idea panel is given: the list's OWN research first (the
 * dialogue / screener / manual record it was saved from), then its analysis
 * sessions the agent worked on (a completed model turn), newest first, then
 * the ones opened and left — so neither analysis opens nor the cap can push
 * the research behind the idea, or the newest worked analysis, out of view
 * (reviews R4-1 / R1-4; mutation lens R5). At most RESEARCH_SUMMARIES_MAX.
 */
export function researchSummariesOf(records) {
  const newestFirst = [...records].reverse().map(recordSummaryOf);
  const analysis = newestFirst.filter((s) => s.origin === 'analysis');
  return [
    ...newestFirst.filter((s) => s.origin !== 'analysis'),
    ...analysis.filter((s) => s.completions > 0),
    ...analysis.filter((s) => !(s.completions > 0)),
  ].slice(0, RESEARCH_SUMMARIES_MAX);
}
