// api/_utils/hypothesisRecords/store.js
//
// Pilot P1a — the OWNER WRITES and READS of hypothesis versions (pilot spec
// §2.1, §2.2, §2.5; the build prompt's "Creation and transitions"). Every
// write is ONE transaction with fresh reads, all reads before any write
// (the api/forge/watchlists/[id]/commit.js shape). Never an overwrite: a new
// version is `tx.create`, so even a race the pointer check missed fails
// ALREADY_EXISTS instead of replacing a version.
//
// ALLOCATION (create and reaffirm): the transaction reads the parent list and
// its pointer, the opId's existing version (a query on `opId`), and the
// version(s) it builds on; then
//   1. the same opId with the same request fingerprint → that version, as an
//      IDEMPOTENT success (checked FIRST, so a replay after the pointer moved
//      is still recognised); the same opId with a different fingerprint →
//      409 op_conflict;
//   2. `expectedVersion` ≠ the current pointer → 409 version_conflict;
//   3. otherwise v{n+1} is created, the superseded current version gains
//      `successorVersion: n+1` (its status, content and clock untouched), and
//      the parent pointer moves to n+1 in the same commit.
//
// TRANSITIONS: a fresh read, a compare-and-set on the status the caller saw
// (`expectedStatus` ≠ fresh status → 409 status_conflict), then the legal-
// transition table (model.js) → 409 illegal_transition. Ready / wait act on
// the CURRENT version only; reject / cancel / retire may also close a
// superseded one. A stale concurrent transition therefore loses cleanly: its
// transaction re-reads, finds the moved status and writes nothing.
//
// The gate is the ROUTE's job (gate.js); nothing here reads the flag.

import {
  WATCHLISTS_COLLECTION, VERSIONS_SUBCOLLECTION, CLOSING_ACTIONS, STATE_REASONS,
  versionDocId, legalTransition, contentOf, buildVersionDoc,
  currentVersionOf, originOf, sessionHorizonOf, opFingerprintOf, isDialogueList, mergeEvidenceRefs,
} from './model.js';
// Pilot P2 — a version the player creates cites every research record already
// attached to its list (the research → version join runs from the version's
// evidenceRefs and from each record's subject; no record is written here).
import { readListResearch, researchRefsOf, researchSummariesOf } from '../researchRecords/store.js';

export const LIST_LIMIT = 100;

/** A typed route failure: the route answers `status` with `{ error: code, message, ...extra }`. */
export class HypothesisRouteError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message || code);
    this.status = status;
    this.code = code;
    this.extra = extra;
    this.hypothesisRoute = true;
  }
}

export const ROUTE_COPY = Object.freeze({
  not_found: 'Watchlist not found.',
  forbidden: 'Not authorized for this watchlist.',
  version_not_found: 'That version of the idea does not exist.',
  version_conflict: 'The idea changed since you loaded it. Reload and try again.',
  op_conflict: 'This request id was already used for a different change.',
  illegal_transition: 'That change is not allowed from the idea\'s current state.',
  status_conflict: 'The idea\'s state changed since you loaded it. Reload and try again.',
  origin_unresolved: 'The dialogue this list came from could not be found, so the idea\'s origin is unknown.',
  pointer_corrupt: 'This list\'s version pointer is unreadable.',
});
const fail = (status, code, extra) => new HypothesisRouteError(status, code, ROUTE_COPY[code], extra);

export const watchlistRefOf = (db, watchlistId) => db.collection(WATCHLISTS_COLLECTION).doc(watchlistId);
export const versionsColOf = (db, watchlistId) => watchlistRefOf(db, watchlistId).collection(VERSIONS_SUBCOLLECTION);
export const versionRefOf = (db, watchlistId, n) => versionsColOf(db, watchlistId).doc(versionDocId(n));

/** The parent as its owner may see it: missing or soft-deleted → not_found; another owner → forbidden. */
function ownedParent(snap, uid) {
  if (!snap?.exists) throw fail(404, 'not_found');
  const data = snap.data();
  if (data.userId !== uid) throw fail(403, 'forbidden');
  if (data.deletedAt) throw fail(404, 'not_found');
  return data;
}

function pointerOf(parent) {
  try {
    return currentVersionOf(parent);
  } catch {
    throw fail(500, 'pointer_corrupt');
  }
}

/** Step 1 of allocation: the opId's existing version, if any — the same request → it; a different one → op_conflict. */
function replayOf(opSnap, opFingerprint) {
  const doc = opSnap?.docs?.[0];
  if (!doc) return null;
  const existing = doc.data();
  if (existing.opFingerprint === opFingerprint) return existing;
  throw fail(409, 'op_conflict', { version: existing.version });
}

/** A request's content overrides on top of the content it builds on (the player's horizon pick is source 'player'). */
function applyOverrides(base, payload) {
  return {
    ...base,
    ...(payload.statement !== undefined ? { statement: payload.statement } : {}),
    ...(payload.horizonEnum !== undefined ? { horizonEnum: payload.horizonEnum, horizonSource: 'player' } : {}),
    ...(payload.activation !== undefined ? { activation: payload.activation } : {}),
    ...(payload.invalidation !== undefined ? { invalidation: payload.invalidation } : {}),
  };
}

/**
 * The content a list's FIRST player-authored version starts from: the
 * list's origin, and — for a dialogue list — the session's horizon (spec
 * §2.5; a theme session is the constant `unspecified`), else `unspecified` /
 * `default`. A dialogue list whose session is gone fails closed
 * (origin_unresolved): an origin is never guessed.
 */
function firstVersionDefaults(parent, sessionSnap) {
  const sessionDerived = isDialogueList(parent);
  const session = sessionSnap?.exists ? sessionSnap.data() : null;
  if (sessionDerived && !session) throw fail(409, 'origin_unresolved');
  const origin = originOf(parent, session);
  const horizon = sessionDerived ? sessionHorizonOf(session) : { horizonEnum: 'unspecified', horizonSource: 'default' };
  return { statement: '', ...horizon, activation: [], invalidation: [], evidenceRefs: [], publishedAt: null, origin };
}

/**
 * Pilot P2 — the research records attached to the list, read BEFORE a
 * version-creating transaction (review R2-3): records are append-only facts
 * the version only cites, so reading them inside the transaction would only
 * tie a player's save to every analysis turn that touches an open record.
 * "Attached at creation" = attached when the request was made. A missing or
 * foreign parent cites nothing here; the transaction then answers the
 * parent's own refusal (not_found / forbidden).
 */
async function attachedResearchOf(db, { uid, watchlistId }) {
  const snap = await watchlistRefOf(db, watchlistId).get();
  const parent = snap?.exists ? snap.data() : null;
  if (!parent || parent.userId !== uid) return [];
  return readListResearch(db, { uid, watchlistId, listResearchWorkId: parent.researchWorkId ?? null });
}

/**
 * Create a new player version (a manual / screener v1 in `draft`, or "save as
 * a new version" of an existing idea, also `draft` — getting a draft to
 * `researched` is P2's job). Refused while the current version is
 * `review_due`: reaffirmation is that version's way forward.
 *
 * @param {object} db
 * @param {{ uid: string, watchlistId: string, opId: string, expectedVersion: number,
 *           payload: { statement: string, horizonEnum?: string, activation?: object[], invalidation?: object[] },
 *           nowIso: string }} p
 * @returns {Promise<{ idempotent: boolean, version: object }>}
 */
export async function createPlayerVersion(db, { uid, watchlistId, opId, expectedVersion, payload, nowIso }) {
  const research = await attachedResearchOf(db, { uid, watchlistId });
  const opFingerprint = opFingerprintOf({ kind: 'create', payload: { expectedVersion, ...payload } });
  return db.runTransaction(async (tx) => {
    const parentRef = watchlistRefOf(db, watchlistId);
    const parent = ownedParent(await tx.get(parentRef), uid);
    const current = pointerOf(parent);
    const opSnap = await tx.get(versionsColOf(db, watchlistId).where('opId', '==', opId).limit(1));
    const baseSnap = current > 0 ? await tx.get(versionRefOf(db, watchlistId, current)) : null;
    const sessionSnap = current === 0 && isDialogueList(parent)
      ? await tx.get(db.collection('watchlistSessions').doc(parent.sourceSessionId))
      : null;

    const replay = replayOf(opSnap, opFingerprint);
    if (replay) return { idempotent: true, version: replay };
    if (expectedVersion !== current) throw fail(409, 'version_conflict', { currentVersion: current });
    const base = baseSnap?.exists ? baseSnap.data() : null;
    if (current > 0 && !base) throw fail(500, 'pointer_corrupt');
    if (base?.status === 'review_due') throw fail(409, 'illegal_transition', { status: base.status, use: 'reaffirm' });

    const inherited = applyOverrides(base ? contentOf(base) : firstVersionDefaults(parent, sessionSnap), payload);
    const content = { ...inherited, evidenceRefs: mergeEvidenceRefs(inherited.evidenceRefs, researchRefsOf(research)) };
    const next = current + 1;
    const doc = buildVersionDoc({
      version: next, watchlistId, userId: uid, opId, opFingerprint, createdAt: nowIso, content,
      status: 'draft', stateSource: 'player', stateReason: STATE_REASONS.playerAuthored,
    });
    tx.create(versionRefOf(db, watchlistId, next), doc);
    if (base) tx.update(versionRefOf(db, watchlistId, current), { successorVersion: next });
    tx.update(parentRef, { currentHypothesisVersion: next, hypothesisVersionCount: next });
    return { idempotent: false, version: doc };
  });
}

/**
 * Reaffirm a `review_due` version (spec §2.5 last row): creates v{n+1} in
 * `ready` with the same or edited content, sets `successorVersion` on the
 * due version and touches nothing else on it — its status, reason, content
 * and clock (firstDeployedAt, reviewDueAt) stay exactly as they were.
 */
export async function reaffirmVersion(db, { uid, watchlistId, version, opId, expectedVersion, payload, nowIso }) {
  const research = await attachedResearchOf(db, { uid, watchlistId });
  const opFingerprint = opFingerprintOf({ kind: 'reaffirm', payload: { expectedVersion, version, ...payload } });
  return db.runTransaction(async (tx) => {
    const parentRef = watchlistRefOf(db, watchlistId);
    const parent = ownedParent(await tx.get(parentRef), uid);
    const current = pointerOf(parent);
    const opSnap = await tx.get(versionsColOf(db, watchlistId).where('opId', '==', opId).limit(1));
    const dueSnap = await tx.get(versionRefOf(db, watchlistId, version));

    const replay = replayOf(opSnap, opFingerprint);
    if (replay) return { idempotent: true, version: replay };
    if (!dueSnap?.exists) throw fail(404, 'version_not_found');
    if (expectedVersion !== current) throw fail(409, 'version_conflict', { currentVersion: current });
    const due = dueSnap.data();
    if (due.status !== 'review_due' || due.successorVersion != null || version !== current) {
      throw fail(409, 'illegal_transition', { status: due.status });
    }

    const next = current + 1;
    const inherited = applyOverrides(contentOf(due), payload);
    const doc = buildVersionDoc({
      version: next, watchlistId, userId: uid, opId, opFingerprint, createdAt: nowIso,
      content: { ...inherited, evidenceRefs: mergeEvidenceRefs(inherited.evidenceRefs, researchRefsOf(research)) },
      status: 'ready', stateSource: 'player', stateReason: STATE_REASONS.reaffirmed,
    });
    tx.create(versionRefOf(db, watchlistId, next), doc);
    tx.update(versionRefOf(db, watchlistId, version), { successorVersion: next });
    tx.update(parentRef, { currentHypothesisVersion: next, hypothesisVersionCount: next });
    return { idempotent: false, version: doc };
  });
}

/**
 * One player transition (ready | wait | reject | cancel | retire |
 * mark_researched — Pilot P2, founder ruling D4) as a compare-and-set on the
 * status the caller saw.
 *
 * @returns {Promise<{ version: object }>}
 */
export async function transitionVersion(db, { uid, watchlistId, version, action, expectedStatus, missingEvidence = null, nowIso }) {
  return db.runTransaction(async (tx) => {
    const parentRef = watchlistRefOf(db, watchlistId);
    const parent = ownedParent(await tx.get(parentRef), uid);
    const current = pointerOf(parent);
    const ref = versionRefOf(db, watchlistId, version);
    const snap = await tx.get(ref);
    if (!snap?.exists) throw fail(404, 'version_not_found');
    const v = snap.data();
    if (v.status !== expectedStatus) throw fail(409, 'status_conflict', { status: v.status });
    const t = legalTransition(v.status, action);
    if (!t) throw fail(409, 'illegal_transition', { status: v.status });
    if (version !== current && !CLOSING_ACTIONS.includes(action)) throw fail(409, 'illegal_transition', { status: v.status, superseded: true });

    const patch = {
      status: t.to,
      stateChangedAt: nowIso,
      stateSource: 'player',
      stateReason: t.reason,
      missingEvidence: t.to === 'waiting_for_evidence' ? missingEvidence : null,
    };
    tx.update(ref, patch);
    return { version: { ...v, ...patch } };
  });
}

/**
 * A list's versions, newest first, with the parent pointer — read from ONE
 * consistent snapshot (a read-only transaction), so a version created
 * between the two reads can never appear beside a stale pointer (review L2-4).
 */
export async function listVersions(db, { uid, watchlistId, limit = LIST_LIMIT, withResearch = false }) {
  return db.runTransaction(async (tx) => {
    const parent = ownedParent(await tx.get(watchlistRefOf(db, watchlistId)), uid);
    const currentVersion = pointerOf(parent);
    const snap = await tx.get(versionsColOf(db, watchlistId).orderBy('version', 'desc').limit(limit));
    const out = { currentVersion, versions: snap.docs.map((d) => d.data()) };
    // Pilot P2 — the Idea panel's research line: the list's research
    // summaries (newest first), from the same snapshot.
    if (withResearch) {
      out.research = researchSummariesOf(await readListResearch(db, { uid, watchlistId, listResearchWorkId: parent.researchWorkId ?? null, tx }));
    }
    return out;
  }, { readOnly: true });
}

/** One version of a list, with the pointer from the same snapshot. */
export async function readVersion(db, { uid, watchlistId, version }) {
  return db.runTransaction(async (tx) => {
    const parent = ownedParent(await tx.get(watchlistRefOf(db, watchlistId)), uid);
    const currentVersion = pointerOf(parent);
    const snap = await tx.get(versionRefOf(db, watchlistId, version));
    if (!snap?.exists) throw fail(404, 'version_not_found');
    return { currentVersion, version: snap.data() };
  }, { readOnly: true });
}
