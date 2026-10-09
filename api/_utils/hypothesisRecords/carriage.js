// api/_utils/hypothesisRecords/carriage.js
//
// Pilot P1b — DEPLOY CARRIAGE (pilot spec §2.4, §2.5 "deploy admission";
// founder rulings B1, B2, B5, B6 of 8 Oct 2026; Phase 0 report §2 rows
// #11–#13, §5.1). The logic of the fenced splice lives here; the fenced files
// (api/agent/decide.js, api/_utils/agentBattleService.js) call it and write
// the battle's shape, nothing more.
//
// TWO HALVES:
//
// 1. RESOLUTION, at deploy, before any battle work (resolveDeployCarriage):
//    which version of the equipped list's idea the battle carries, from the
//    list's SERVER-WRITTEN version documents only — never a client value and
//    never the list's pointer (ruling B2). Three outcomes:
//      carry   { equippedHypothesis }  the NEWEST version whose status is
//              `ready` or `activated` (a reaffirmed version is `ready` and
//              newer, so the fresh version deploys with no re-equip);
//      refuse  { status: 409, body }   no such version, and the idea's newest
//              DEPLOYED version is `review_due` — table C's due-deploy line,
//              verbatim;
//      none                            anything else (drafts, terminal
//              statuses, no list, gate off, no transactional creation path, a
//              read failure, a corrupt record) — the deploy runs exactly as it
//              does today.
//    THE GATE (ruling B1): the record slice's one switch, hypothesisRecordsOnFor
//    (HYPOTHESIS_RECORDS_ENABLED + the cockpit allowlist) for the battle's
//    owner. Off → `none` BEFORE ANY READ. Nothing here reads the pilot's
//    journey-mode flag (reserved for what the agent consumes — P4 — and the
//    harness — P7).
//    ONE READ: the list's versions, newest first (`orderBy('version')`, the
//    same automatic single-field index the Forge's list read uses — no new
//    index), bounded by CARRIAGE_SCAN_LIMIT; both answers ("newest carriable",
//    "newest deployed") are computed from it in memory.
//
// 2. ACTIVATION, inside the battle-creation transaction
//    (compositionGenerationFence.js commitBattleDocWithPin calls
//    readCarriedVersionInTx → tx.create → activateCarriedVersionInTx):
//    the FRESH read of the carried version is authoritative. It must still be
//    carriable and hold exactly the content the battle froze, else a typed
//    HypothesisCarriageError aborts the transaction — no battle, no version
//    change, no review row (the race; the deploy fails cleanly, retriable).
//      ready     → activated: firstDeployedAt, reviewDueAt (computeReviewDueAt,
//                  the companion §6 clock anchored at the battle's creation
//                  instant), stateChangedAt, stateSource 'deploy', stateReason
//                  'deployed', lastDeployedAt, lastDeployedBattleId; the review
//                  row armed (armReviewRow) with the due instant, or null for
//                  an `unspecified` horizon (a battle-end review).
//      activated → NO RESTAMP (ruling B6): firstDeployedAt and the due time
//                  stay anchored to the first deploy; lastDeployedAt and
//                  lastDeployedBattleId move; the row is re-armed with the SAME
//                  dueAtMs and the NEW battle id.
//    THE CLOCK FALLBACK (ruling B5): computeReviewDueAt throwing
//    `calendar_unavailable` never fails the deploy and never leaves a silent
//    null — the version records the typed marker
//    `reviewClockFault: 'calendar_unavailable'` (REVIEW_CLOCK_FAULT_FIELD),
//    keeps reviewDueAt null, and its row is armed as a battle-end review
//    (dueAtMs null). Any other clock error is a corrupt record and aborts.

import { hypothesisRecordsOnFor } from './gate.js';
import {
  WATCHLISTS_COLLECTION, VERSIONS_SUBCOLLECTION, HORIZON_ENUMS, STATE_REASONS,
  versionDocId, isVersionNumber, contentHashOf,
} from './model.js';
import { computeReviewDueAt, HorizonClockError } from './horizon.js';
import { armReviewRow } from './reviewPass.js';
import {
  CARRIABLE_STATUSES, DEPLOY_REFUSAL_CODE, DUE_DEPLOY_LINE, CARRIAGE_RACE_MESSAGE,
} from '../../../src/constants/hypothesisRecords.js';

/** The versions one resolution reads (newest first) — the Forge list read's own bound (store.js LIST_LIMIT). */
export const CARRIAGE_SCAN_LIMIT = 100;

/**
 * The frozen sibling's keys, exactly (the build prompt's list; spec §2.4:
 * "content fields + hypothesisVersion + contentHash"). The fenced battle
 * writer spells the same keys out (agentBattleService.js); this list is the
 * resolver's and the tests' copy.
 */
export const SIBLING_KEYS = Object.freeze([
  'watchlistId', 'hypothesisVersion', 'contentHash',
  'statement', 'horizonEnum', 'horizonSource', 'activation', 'invalidation', 'evidenceRefs', 'publishedAt', 'origin',
]);

/** Ruling B5's typed marker — a lifecycle field written only when the clock fell back to a battle-end review. */
export const REVIEW_CLOCK_FAULT_FIELD = 'reviewClockFault';
export const REVIEW_CLOCK_FAULTS = Object.freeze(['calendar_unavailable']);

/** The source and reason a deploy stamps on a version it activates (spec §2.5 `ready → activated`). */
export const DEPLOY_STATE_SOURCE = 'deploy';

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const nonEmpty = (v) => typeof v === 'string' && v.length > 0;
const isoOrNull = (v) => v === null || (nonEmpty(v) && Number.isFinite(Date.parse(v)));

/**
 * The race: the carried version's fresh read in the creation transaction
 * disagrees with what the deploy froze. Thrown inside the transaction, so
 * nothing commits. Its message is the player-facing sentence the deploy
 * surface shows (decide.js's catch hands `error.message` to the client as
 * `details`); `reason` names the disagreement for the logs.
 */
export class HypothesisCarriageError extends Error {
  constructor(reason) {
    super(CARRIAGE_RACE_MESSAGE);
    this.name = 'HypothesisCarriageError';
    this.code = 'hypothesis_carriage_stale';
    this.reason = reason;
    this.hypothesisCarriage = true;
  }
}

const versionRefOf = (db, watchlistId, n) => db.collection(WATCHLISTS_COLLECTION).doc(watchlistId)
  .collection(VERSIONS_SUBCOLLECTION).doc(versionDocId(n));

/**
 * May this version document ride a battle? The ONE predicate the resolver and
 * the transaction's fresh read share: the owner's own version of this list, a
 * carriable status, an intact record (its content still hashes to its
 * contentHash; a known horizon), and — when activated — the deploy stamps a
 * first deploy leaves (a first-deploy instant, a due instant or null).
 */
export function carriableVersion(v, { ownerUid, watchlistId }) {
  if (!isPlainObject(v) || !nonEmpty(ownerUid) || !nonEmpty(watchlistId)) return false;
  if (v.userId !== ownerUid || v.watchlistId !== watchlistId || !isVersionNumber(v.version)) return false;
  if (!CARRIABLE_STATUSES.includes(v.status)) return false;
  if (!HORIZON_ENUMS.includes(v.horizonEnum) || !nonEmpty(v.contentHash)) return false;
  let intact = false;
  try {
    intact = contentHashOf(v) === v.contentHash;
  } catch {
    intact = false;
  }
  if (!intact) return false;
  if (v.status === 'activated') return nonEmpty(v.firstDeployedAt) && isoOrNull(v.firstDeployedAt) && isoOrNull(v.reviewDueAt ?? null);
  return true;
}

/** The frozen sibling a battle carries for a version: SIBLING_KEYS, explicitly. */
export function siblingOf(v) {
  return {
    watchlistId: v.watchlistId,
    hypothesisVersion: v.version,
    contentHash: v.contentHash,
    statement: v.statement,
    horizonEnum: v.horizonEnum,
    horizonSource: v.horizonSource,
    activation: v.activation,
    invalidation: v.invalidation,
    evidenceRefs: v.evidenceRefs,
    publishedAt: v.publishedAt,
    origin: v.origin,
  };
}

const none = (reason) => ({ outcome: 'none', reason });

/**
 * RESOLUTION (half 1). Never throws.
 *
 * @param {object} db
 * @param {{ ownerUid: string, watchlistId: string|null, watchlist: object|null,
 *           snapshot: object|null, pin: { dark: boolean }|null }} p
 *   `watchlist` is the equipped list as the deploy resolved it (null when it
 *   degraded to no equip); `snapshot` the frozen snapshot the battle will
 *   carry; `pin` the deploy's activation pin (dark = no creation transaction).
 * @returns {Promise<{ outcome: 'carry', equippedHypothesis: object, version: number, status: string }
 *   | { outcome: 'refuse', status: 409, body: { error: string, message: string }, version: number }
 *   | { outcome: 'none', reason: string }>}
 */
export async function resolveDeployCarriage(db, { ownerUid, watchlistId, watchlist, snapshot, pin }) {
  // THE GATE — before any read (ruling B1).
  if (!hypothesisRecordsOnFor(ownerUid)) return none('gate_off');
  // Carry-forward 3: a sibling only ever rides beside a non-null frozen snapshot of the SAME list.
  if (!nonEmpty(watchlistId) || !isPlainObject(snapshot) || snapshot.watchlistId !== watchlistId) return none('no_snapshot');
  if (!isPlainObject(watchlist) || watchlist.userId !== ownerUid) return none('not_owner');

  let versions;
  try {
    const snap = await db.collection(WATCHLISTS_COLLECTION).doc(watchlistId).collection(VERSIONS_SUBCOLLECTION)
      .orderBy('version', 'desc').limit(CARRIAGE_SCAN_LIMIT).get();
    versions = (snap?.docs || []).map((d) => d.data());
  } catch (err) {
    console.warn(`[hypothesis] carriage read failed for list ${watchlistId}: ${String(err?.message || err).slice(0, 200)} — deploying without carriage`);
    return none('read_failed');
  }
  const mine = versions
    .filter((v) => isPlainObject(v) && v.userId === ownerUid && v.watchlistId === watchlistId && isVersionNumber(v.version))
    .sort((a, b) => b.version - a.version);

  // The newest version whose STATUS is carriable decides; a corrupt one carries nothing (never an older stand-in).
  const newestCarriable = mine.find((v) => CARRIABLE_STATUSES.includes(v.status));
  if (newestCarriable) {
    if (!carriableVersion(newestCarriable, { ownerUid, watchlistId })) {
      console.warn(`[hypothesis] carriage: list ${watchlistId} v${newestCarriable.version} is not intact — deploying without carriage`);
      return none('corrupt_version');
    }
    // Carriage requires the transactional creation path (the activation rides it).
    if (!pin || pin.dark) return none('no_transaction');
    console.log(`[hypothesis] carriage: list ${watchlistId} v${newestCarriable.version} (${newestCarriable.status}) rides the battle`);
    return { outcome: 'carry', equippedHypothesis: siblingOf(newestCarriable), version: newestCarriable.version, status: newestCarriable.status };
  }

  const newestDeployed = mine.find((v) => nonEmpty(v.firstDeployedAt));
  if (newestDeployed?.status === 'review_due') {
    console.log(`[hypothesis] carriage: list ${watchlistId} v${newestDeployed.version} is due for review with no ready version — deploy refused`);
    return { outcome: 'refuse', status: 409, body: { error: DEPLOY_REFUSAL_CODE, message: DUE_DEPLOY_LINE }, version: newestDeployed.version };
  }
  return none('nothing_carriable');
}

/** The sibling a battle document carries, or null (absent or null: the battle carries nothing). */
export function carriedSiblingOf(battleDoc) {
  const s = battleDoc?.agentContext?.equippedHypothesis;
  return s === undefined || s === null ? null : s;
}

/**
 * ACTIVATION, read phase (half 2): inside the creation transaction, before any
 * write. A battle carrying nothing → null with ZERO reads. Otherwise the fresh
 * read of the carried version, which must still be carriable for the battle's
 * owner and hold exactly the frozen content; any disagreement throws
 * HypothesisCarriageError (the transaction writes nothing).
 *
 * @returns {Promise<null | { ref: object, fresh: object }>}
 */
export async function readCarriedVersionInTx(tx, db, battleDoc) {
  const sibling = carriedSiblingOf(battleDoc);
  if (!sibling) return null;
  if (!isPlainObject(sibling) || !nonEmpty(sibling.watchlistId) || !isVersionNumber(sibling.hypothesisVersion)) {
    throw new HypothesisCarriageError('sibling_malformed');
  }
  const snapshot = battleDoc?.agentContext?.equippedWatchlist;
  if (!isPlainObject(snapshot) || snapshot.watchlistId !== sibling.watchlistId) throw new HypothesisCarriageError('sibling_without_snapshot');
  const ref = versionRefOf(db, sibling.watchlistId, sibling.hypothesisVersion);
  const snap = await tx.get(ref);
  const fresh = snap?.exists ? snap.data() : null;
  if (!fresh) throw new HypothesisCarriageError('version_missing');
  if (fresh.version !== sibling.hypothesisVersion || !carriableVersion(fresh, { ownerUid: battleDoc.ownerId, watchlistId: sibling.watchlistId })) {
    throw new HypothesisCarriageError('version_not_carriable');
  }
  let frozenIntact = false;
  try {
    frozenIntact = contentHashOf(sibling) === sibling.contentHash;
  } catch {
    frozenIntact = false;
  }
  if (!frozenIntact || fresh.contentHash !== sibling.contentHash) throw new HypothesisCarriageError('content_mismatch');
  return { ref, fresh };
}

/**
 * ACTIVATION, write phase (half 2): after the battle's `tx.create`, on the same
 * transaction. Buffers ONE `tx.update` of the version and ONE `tx.set` of its
 * review row (armReviewRow).
 *
 * @param {{ ref: object, fresh: object }} carried  readCarriedVersionInTx's answer
 * @param {{ battleId: string, battleDoc: object }} p
 * @returns {{ activated: boolean, dueAtMs: number|null, reviewClockFault: string|null }}
 */
export function activateCarriedVersionInTx(tx, db, carried, { battleId, battleDoc }) {
  const { ref, fresh } = carried;
  const at = battleDoc.createdAt;
  const atMs = Date.parse(at);
  if (!nonEmpty(at) || !Number.isFinite(atMs)) throw new HypothesisCarriageError('battle_instant_invalid');

  let dueAtMs;
  let fault = null;
  let patch;
  if (fresh.status === 'ready') {
    try {
      dueAtMs = computeReviewDueAt(fresh.horizonEnum, atMs);
    } catch (err) {
      if (!(err instanceof HorizonClockError) || err.code !== 'calendar_unavailable') throw err;
      // Ruling B5: never a failed deploy, never a silent null — the typed marker and a battle-end review.
      dueAtMs = null;
      fault = 'calendar_unavailable';
    }
    patch = {
      status: 'activated',
      stateChangedAt: at,
      stateSource: DEPLOY_STATE_SOURCE,
      stateReason: STATE_REASONS.deployed,
      firstDeployedAt: at,
      reviewDueAt: dueAtMs === null ? null : new Date(dueAtMs).toISOString(),
      lastDeployedAt: at,
      lastDeployedBattleId: battleId,
      ...(fault ? { [REVIEW_CLOCK_FAULT_FIELD]: fault } : {}),
    };
  } else {
    // Ruling B6: an active idea redeploys with its clock untouched.
    dueAtMs = fresh.reviewDueAt == null ? null : Date.parse(fresh.reviewDueAt);
    patch = { lastDeployedAt: at, lastDeployedBattleId: battleId };
  }
  tx.update(ref, patch);
  armReviewRow(tx, db, { userId: fresh.userId, watchlistId: fresh.watchlistId, version: fresh.version, battleId, dueAtMs, armedAt: atMs });
  return { activated: fresh.status === 'ready', dueAtMs, reviewClockFault: fault };
}

/**
 * THE FROZEN LIST a deployed version rode in (founder ruling B3 — the Forge's
 * review lines): the name and tickers of the DEPLOYING battle's own frozen
 * snapshot, found through the version's server-written lastDeployedBattleId —
 * never the live list. Null unless that battle is the owner's and really
 * carried THIS version beside a snapshot of the same list. One read.
 *
 * @param {object} db
 * @param {{ uid: string, version: object }} p  a version document as read
 * @returns {Promise<null | { battleId: string, name: string, tickers: string[] }>}
 */
export async function deployedListOf(db, { uid, version }) {
  const battleId = isPlainObject(version) ? version.lastDeployedBattleId : null;
  if (!nonEmpty(battleId) || !nonEmpty(uid)) return null;
  const snap = await db.collection('agentBattles').doc(battleId).get();
  const battle = snap?.exists ? snap.data() : null;
  const sibling = battle?.agentContext?.equippedHypothesis;
  const frozen = battle?.agentContext?.equippedWatchlist;
  if (!isPlainObject(battle) || battle.ownerId !== uid || !isPlainObject(sibling) || !isPlainObject(frozen)) return null;
  if (sibling.watchlistId !== version.watchlistId || sibling.hypothesisVersion !== version.version || frozen.watchlistId !== version.watchlistId) return null;
  if (!nonEmpty(frozen.name) || !Array.isArray(frozen.tickers)) return null;
  return { battleId, name: frozen.name, tickers: frozen.tickers.filter(nonEmpty) };
}
