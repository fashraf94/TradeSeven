// api/_utils/compositionWriteEpoch.js
//
// Composition PR 2 — the write-epoch fence (R5-B2/R7-B2; design note §3).
//
// THE MECHANISM (A41): the epoch control doc is read INSIDE each writer's
// transaction, in the read phase. Firestore transactions are serializable over
// their read set, so a §8 runbook close that lands between a writer's read and
// its commit forces the transaction to retry, re-read the closed epoch, and
// REJECT — an old-epoch write cannot commit after the watermark. Rejection is
// the guarantee; the scan watermark is the backstop.
//
// DARK POSTURE (A23): with COMPOSITION_EPOCH_FENCE_ENABLED=false every helper
// returns before ANY read — zero added I/O, byte-identical behavior (the
// MASTERY_ENFORCEMENT_ENABLED zero-I/O-while-dark precedent,
// equip-bundle.js:112-115). The doc-absent state is also OPEN (fail-open):
// the fence only bites once the §8 runbook writes {state:'closed'}.
//
// Client-SDK writers are fenced at the RULES LAYER (epochWriteOpen() in
// firestore.rules — inert until Console deploy); background loops call
// assertWriteEpochOpen per batch. See the design note's writer-class table
// and compositionWriterCensus.json (test A46).

import { COMPOSITION_EPOCH_FENCE_ENABLED } from './compositionConfig.js';
import { ACTIVATION_COLLECTION, ACTIVATION_DOC_ID } from './compositionProductionLoader.js';

/** The epoch control doc (design note §2). Absent ⇒ open — PRE-ACTIVATION ONLY (B1). */
export const WRITE_EPOCH_COLLECTION = 'composition';
export const WRITE_EPOCH_DOC_ID = 'writeEpoch';

// A34 (PR 4, founder Q1 ruling): the per-boundary compile-time declaration of
// which boundary-state versions THIS code supports. Every enforcement
// boundary compares the activation record's boundaryStateVersion against this
// set per request and FAILS CLOSED when unsupported — a warm instance whose
// code predates the current boundary configuration cannot serve old
// enforcement. Version 1 = the first activation's boundary-state set (the
// closure sheet §IV boundary census as deployed by this PR).
export const SUPPORTED_BOUNDARY_STATE_VERSIONS = Object.freeze([1]);

export class UnsupportedBoundaryStateError extends Error {
  constructor(boundaryStateVersion) {
    super('boundary_state_unsupported');
    this.name = 'UnsupportedBoundaryStateError';
    this.code = 'boundary_state_unsupported';
    this.boundaryStateVersion = boundaryStateVersion;
  }
}

/** A34: throws unless this code supports the record's boundaryStateVersion. */
export function assertBoundaryStateSupported(boundaryStateVersion, { sentinel = null } = {}) {
  if (!SUPPORTED_BOUNDARY_STATE_VERSIONS.includes(boundaryStateVersion)) {
    if (sentinel) throw new Error(sentinel + 'boundary_state_unsupported');
    throw new UnsupportedBoundaryStateError(boundaryStateVersion);
  }
  return null;
}

export class EpochClosedError extends Error {
  constructor(epochId = null, state = 'closed') {
    super('epoch_closed');
    this.name = 'EpochClosedError';
    this.code = 'epoch_closed';
    this.epochId = epochId;
    this.state = state;
  }
}

export function writeEpochRef(db) {
  return db.collection(WRITE_EPOCH_COLLECTION).doc(WRITE_EPOCH_DOC_ID);
}

/**
 * Transactional commit-time validation — call in the READ PHASE of a writer's
 * existing transaction (Firestore requires reads before writes). Throws
 * EpochClosedError when the epoch is closed; endpoints map it to a 409 with
 * nothing written.
 *
 * When `sentinel` is provided (the endpoints' `SENTINEL_PREFIX` pattern), a
 * closed epoch throws `Error(sentinel + 'epoch_closed')` so the endpoint's
 * existing catch maps it through SENTINEL_TO_HTTP (409, nothing written).
 *
 * B1 (PR 4) — two completions:
 *   ABSENT-DOC POSTURE: an absent epoch doc is fail-OPEN only while NO
 *     activation record exists (the pre-activation dark world, byte-identical
 *     today). Once the record exists, an absent epoch doc FAILS CLOSED — the
 *     activated world never runs unfenced.
 *   EPOCH PINNING: pass `epochPin` (a caller-scoped object created OUTSIDE
 *     runTransaction, one per logical write) and the FIRST-OBSERVED epoch id
 *     is pinned across transaction retries — a retry that observes a
 *     DIFFERENT epoch REJECTS instead of silently revalidating against the
 *     new epoch.
 *
 * @returns {null | {state:string, epochId:string|null}} null while dark.
 */
export async function validateWriteEpochInTx(tx, db, { enabled = COMPOSITION_EPOCH_FENCE_ENABLED, sentinel = null, epochPin = null, actor = null } = {}) {
  if (!enabled) return null; // dark: zero reads, zero behavior change (A23)
  const reject = (code, epochId = null, state = 'closed') => {
    if (sentinel) throw new Error(sentinel + code);
    throw new EpochClosedError(epochId, state);
  };
  const pinOrReject = (observedEpochId) => {
    if (!epochPin) return;
    if (!('epochId' in epochPin)) { epochPin.epochId = observedEpochId; return; }
    if (epochPin.epochId !== observedEpochId) reject('epoch_closed', observedEpochId, 'epoch_changed_across_retry');
  };
  const snap = await tx.get(writeEpochRef(db));
  if (!snap.exists) {
    const act = await tx.get(db.collection(ACTIVATION_COLLECTION).doc(ACTIVATION_DOC_ID));
    if (act.exists) reject('epoch_closed', null, 'absent_epoch_doc_post_activation'); // B1: fail closed once activated
    pinOrReject(null);
    return { state: 'open', epochId: null };
  }
  const data = snap.data();
  // Sol re-review #4: the PROBE-ONLY gate, mechanically enforced. During the
  // 8B / Rollback-B verification windows the runbook sets state 'probe' with
  // an explicit identity allowlist — ONLY a caller that names a listed actor
  // is admitted; every unthreaded or unlisted writer rejects (fail closed;
  // 'probe' is present-but-not-open to everything that predates this arm).
  if (data.state === 'probe') {
    if (typeof actor === 'string' && actor.length > 0
      && Array.isArray(data.probeIdentities) && data.probeIdentities.includes(actor)) {
      pinOrReject(data.epochId ?? null);
      return { state: 'probe', epochId: data.epochId ?? null };
    }
    reject('epoch_closed', data.epochId ?? null, 'probe_only');
  }
  // B8 (PR 3): a PRESENT doc admits ONLY state === 'open' — 'closed' and any
  // unrecognized/mid-transition state reject. The rules layer was already
  // fail-closed on a present doc (`data.state == 'open'`, firestore.rules:14);
  // this aligns the server helpers with it.
  if (data.state !== 'open') reject('epoch_closed', data.epochId ?? null, data.state ?? 'unrecognized');
  pinOrReject(data.epochId ?? null);
  return { state: 'open', epochId: data.epochId ?? null };
}

/** Sol review #5: the closed-epoch candidate window's refusal. */
export class CandidateWindowError extends Error {
  constructor(detail) {
    super(`candidate_window_not_closed: ${detail}`);
    this.name = 'CandidateWindowError';
    this.code = 'candidate_window_not_closed';
  }
}

/**
 * Sol pre-activation review #5: the CLOSED-EPOCH CANDIDATE-APPLY WINDOW —
 * a DEDICATED authorization for the runbook's step-3 `--apply --during-close`
 * (writes ONLY compositionCandidateState/*, while the live epoch is frozen).
 * The general open-epoch guard (assertWriteEpochOpen, below) is UNTOUCHED —
 * this helper asserts the INVERSE posture: the epoch doc must EXIST and be
 * 'closed' (the post-watermark freeze). An OPEN epoch refuses (the claimed
 * window is not real — run without --during-close); 'closing' refuses (the
 * drain has not reached its watermark); an absent doc refuses (pre-genesis
 * there is no sanctioned closed window to claim).
 */
export async function assertClosedEpochCandidateWindow(db) {
  const snap = await writeEpochRef(db).get();
  if (!snap.exists) throw new CandidateWindowError('no epoch doc — the sanctioned window opens at the runbook close, never before genesis');
  const { state, epochId } = snap.data();
  if (state !== 'closed') throw new CandidateWindowError(`epoch state '${state}' — the candidate window exists only at the post-watermark freeze`);
  return { state: 'closed', epochId: epochId ?? null };
}

/**
 * Non-transactional guard for background loops and admin scripts — called at
 * entry AND per batch/agent iteration (bounded conformance: a loop straddling
 * the close stops at the next boundary; the runbook pause is the second belt).
 */
export async function assertWriteEpochOpen(db, { enabled = COMPOSITION_EPOCH_FENCE_ENABLED } = {}) {
  if (!enabled) return null;
  const snap = await writeEpochRef(db).get();
  // B8 (PR 3): present-but-not-open rejects (aligned with the rules layer and
  // validateWriteEpochInTx above); absent stays fail-open pre-activation.
  if (snap.exists && snap.data().state !== 'open') {
    throw new EpochClosedError(snap.data().epochId ?? null, snap.data().state ?? 'unrecognized');
  }
  return null;
}
