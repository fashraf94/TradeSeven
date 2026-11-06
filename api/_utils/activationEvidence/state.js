// api/_utils/activationEvidence/state.js
//
// ID-1 Build 2 — THE OBSERVER STATE (contract §4.4). One mutable document,
// activationObserverState/main, server-only, never read by any reader of
// evidence:
//   { schemaVersion: 1,
//     cursors: { dueBattles, ordinaryBattles, dueKeys, ordinaryKeys },
//     battles: { [battleId]: { cutoffAt, expiresAt, finished, excludedBy } },
//     outstandingKeys: [ { snapshotId, session, symbol, dueAt } ],   (bounded)
//     updatedAt }
// It exists for fair progress across runs, so finished or excluded battles are
// not re-read, and so acquisition can continue when a run's preparation is cut
// short. `cutoffAt`, `expiresAt` and `dueAt` are epoch milliseconds (or null).
//
// A LOST, STALE OR UNWRITABLE STATE NEVER CHANGES WHAT A POINTER SAYS: pointers
// depend only on contract §4.2. A state that cannot be read reads as empty; it
// costs fairness and reads, never correctness. The last write wins.
//
// INDEXING (contract V1.8 §4.4): nothing queries this collection, so `battles`
// and `outstandingKeys` are exempt from single-field indexing in
// firestore.indexes.json (`fieldOverrides`, `indexes: []`; a map's subfields
// inherit its exemption), keeping the document far from the per-document
// index-entry limit as the allowlist widens.

import { MAX_CARRIED_KEYS, OBSERVER_STATE_COLLECTION, OBSERVER_STATE_DOC, STATE_SCHEMA_VERSION } from './constants.js';

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const finiteOrNull = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const stringOrNull = (v) => (typeof v === 'string' && v.length > 0 ? v : null);

export const stateRefOf = (db) => db.collection(OBSERVER_STATE_COLLECTION).doc(OBSERVER_STATE_DOC);

/** An empty state: what a first run, a lost document or an unreadable one starts from. */
export function emptyState() {
  return { schemaVersion: STATE_SCHEMA_VERSION, cursors: { dueBattles: null, ordinaryBattles: null, dueKeys: null, ordinaryKeys: null }, battles: {}, outstandingKeys: [], updatedAt: null };
}

/** The stored document, normalised: anything malformed is dropped, never trusted. Pure. */
export function normalizeState(raw) {
  const out = emptyState();
  if (!isPlainObject(raw) || raw.schemaVersion !== STATE_SCHEMA_VERSION) return out;
  const c = isPlainObject(raw.cursors) ? raw.cursors : {};
  for (const k of Object.keys(out.cursors)) out.cursors[k] = stringOrNull(c[k]);
  if (isPlainObject(raw.battles)) {
    for (const [id, b] of Object.entries(raw.battles)) {
      if (!id || !isPlainObject(b)) continue;
      out.battles[id] = { cutoffAt: finiteOrNull(b.cutoffAt), expiresAt: finiteOrNull(b.expiresAt), finished: b.finished === true, excludedBy: stringOrNull(b.excludedBy) };
    }
  }
  if (Array.isArray(raw.outstandingKeys)) {
    const seen = new Set();
    for (const k of raw.outstandingKeys) {
      if (!isPlainObject(k) || !stringOrNull(k.snapshotId) || !stringOrNull(k.session) || !stringOrNull(k.symbol) || seen.has(k.snapshotId)) continue;
      seen.add(k.snapshotId);
      out.outstandingKeys.push({ snapshotId: k.snapshotId, session: k.session, symbol: k.symbol, dueAt: finiteOrNull(k.dueAt) });
      if (out.outstandingKeys.length >= MAX_CARRIED_KEYS) break;
    }
  }
  out.updatedAt = stringOrNull(raw.updatedAt);
  return out;
}

/**
 * Read the state. Absent → empty; unreadable → empty, counted.
 * @returns {Promise<{ state: object, status: 'read' | 'absent' | 'unreadable' }>}
 */
export async function readObserverState(db) {
  try {
    const snap = await stateRefOf(db).get();
    if (!snap.exists) return { state: emptyState(), status: 'absent' };
    return { state: normalizeState(snap.data()), status: 'read' };
  } catch {
    return { state: emptyState(), status: 'unreadable' };
  }
}

/** Write the whole state in one write (the last write wins). Throws on a Firestore failure; the caller counts it. */
export async function writeObserverState(db, state) {
  await stateRefOf(db).set(state);
}
