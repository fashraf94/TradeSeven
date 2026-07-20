// api/_utils/masterySettlement.js
// Archetype Mastery — the §5 settlement protocol (Spec V2 §3–§5; V2.1 memo
// of record: docs/ARCHETYPE_MASTERY_SPEC_V2_1_STOP_RULINGS_JUL21_2026.md).
//
// Hosts (the P1 write-host census, pinned for the follow-up fence check):
//   • eligibility stamp builder    — consumed inside completeBattle's
//     completion transaction (api/cron/agent-evaluate.js — NON-fence)
//   • first-eval-tick slot stamp   — stampMasterySlotFirstTick (called from
//     processAgentBattle, api/cron/agent-evaluate.js — NON-fence)
//   • award transaction (§5.2)     — runAwardTransaction (below)
//   • repair sweep (§5.3)          — runRepairSweep (below; hosted on the
//     EXISTING agent-evaluate cron cadence — no new cron entry, BUILD_RULES §6)
//   • quarantine ledger writer     — inside runAwardTransaction (fail-closed
//     zero receipts) and the duplicate-rank audit in the slot stamp
// None of these files is a fence file; fence exports are read-only-consumed.
//
// CONCURRENCY (Phase 0 S11.10 load-bearing constraint, V2.1 memo §10): the
// eval lock (120s) is shorter than the run budget (290s), so a second
// invocation can steal an expired lock and race the first. EVERY write here
// is therefore an in-transaction re-read + write-once guard (the
// regimeAtStart pattern, agent-evaluate.js:991): first committer wins,
// losers no-op. The §12 concurrent-retry tests are the proof.
//
// V2.1 §5.1 invariant: "Every battle completed via the settlement path
// carries an eligibility stamp atomic with its completion. Fence-path expiry
// completions (decide.js) are structurally outside the mastery system and
// never earn." CPU system agents (battle.isCpu === true) are likewise
// structurally outside: no stamp, no award, no receipt — mastery attaches to
// user × archetype and a CPU seat has neither.

import { FieldValue } from 'firebase-admin/firestore';
// Node-clean src imports under the revised June 2026 import rule
// (BUILD_RULES §4) — zero-import schema modules, the same surface the fenced
// battle service already consumes. The co-located test's import of THIS
// module is the dependency-surface guard (it explodes in the Node test env
// if a browser dep ever enters the graph) — never mock it.
import { TOURNAMENT_GAME_MODE, TOURNAMENT_GROUPS_COLLECTION } from '../../src/constants/leagueTournament.js';
import { TIERED_GAME_MODE } from '../../src/constants/agentGameModes.js';
import {
  deriveSlotDate,
  deriveSlotRank,
  buildSlotStamp,
  widenedQueryBounds,
  findDuplicateRank,
  rateBandForRank,
} from './masterySlot.js';
import {
  validateFormulaInputs,
  computeXp,
  buildAwardDoc,
  buildZeroReceipt,
  levelForXp,
  REASON_CODES,
} from './masteryFormula.js';
import {
  MASTERY_PROFILES_COLLECTION,
  MASTERY_QUARANTINE_COLLECTION,
} from './masteryConfig.js';

const LOG_PREFIX = '[Mastery]';

// ==================== ELIGIBILITY STAMP (§5.1) ====================

/**
 * The fields the completion transaction merges into its update payload —
 * ONLY when flagView.everEnabled (pre-epoch-1 settlement writes nothing
 * mastery-related; dark byte-identity). eligible is the worker's own flag
 * view at settlement time (§3 cross-boundary rule: eligibility is a
 * settlement-time fact). masteryAwardPending makes the §5.3 repair sweep's
 * "stamped eligible, award missing" predicate queryable; the award
 * transaction clears it. Both fields are absent from the agentBattles client
 * update allowlist — client writes are denied by construction (S11.7).
 */
export function buildEligibilityStampFields(flagView, nowIso) {
  return {
    masteryEligibility: {
      eligible: flagView.enabled === true,
      epochId: flagView.epochId,
      stampedAt: nowIso,
    },
    masteryAwardPending: true,
  };
}

// ==================== MODE CLASSIFICATION ====================

/**
 * Battle → mode kind ('ranked' | 'league' | 'training' | null).
 * Fail-closed (spec §4): a missing/unknown gameMode, or a tournament battle
 * whose group doc cannot be resolved, returns null → quarantine. NEVER
 * defaults to 1.0 mode (deliberately unlike the engine's resolveModeConfig,
 * whose tiered default is a P4 behavior invariant — different contract).
 */
export function classifyModeKind({ gameMode, group }) {
  if (gameMode === TIERED_GAME_MODE) return 'ranked';
  if (gameMode === TOURNAMENT_GAME_MODE) {
    if (!group || typeof group !== 'object') return null; // group unresolvable → quarantine
    return group.isTraining === true ? 'training' : 'league';
  }
  return null;
}

/**
 * Resolve the tournamentGroups doc for a tournament battle, memoized in
 * groupCache (Map: groupId → group data | null). isTraining is a
 * creation-time group fact, so the cache is settlement-order-safe.
 */
export async function resolveModeGroup(db, battle, groupCache = new Map()) {
  if (battle.gameMode !== TOURNAMENT_GAME_MODE) return null;
  const groupId = battle.groupId;
  if (typeof groupId !== 'string' || groupId.length === 0) return null;
  if (groupCache.has(groupId)) return groupCache.get(groupId);
  const snap = await db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(groupId).get();
  const group = snap.exists ? snap.data() : null;
  groupCache.set(groupId, group);
  return group;
}

// ==================== PLACEMENT (§4) ====================

/**
 * Placement inputs, pure. Competition shape reads the frozen per-battle
 * facts: tiered battles compare scoreState.currentScore vs
 * scoreState.opponentScore (both doc-local); tournament battles compare
 * against sibling battles' scoreState.currentScore — final by construction
 * at settlement (scores are written by evaluation ticks, which stop at
 * market close; completion never recomputes them — Discovery A2), so the
 * result is independent of sibling SETTLEMENT order (§12 property).
 *
 * Ties pay strictly-outplaced only; first place must be STRICT (an
 * engineered N-way tie pays zero placement to all N). A sibling with a
 * non-finite score is conservatively neither outplaced nor conceded to —
 * it blocks wonAgainstField (fail toward less XP, never more).
 */
export function computePlacementInputs({ battle, siblings }) {
  const myScore = battle.scoreState?.currentScore;
  if (battle.gameMode !== TOURNAMENT_GAME_MODE) {
    const opponentScore = battle.scoreState?.opponentScore ?? 0;
    return {
      humansOutplaced: 0,
      wonAgainstField: Number.isFinite(myScore) && Number.isFinite(opponentScore) && myScore > opponentScore,
    };
  }
  let humansOutplaced = 0;
  let strictlyAboveAll = Number.isFinite(myScore);
  for (const sib of Array.isArray(siblings) ? siblings : []) {
    if (!sib || sib.id === battle.id) continue;
    const sibScore = sib.scoreState?.currentScore;
    const finite = Number.isFinite(sibScore);
    if (finite && sib.isCpu !== true && Number.isFinite(myScore) && sibScore < myScore) {
      humansOutplaced += 1;
    }
    if (!finite || !(myScore > sibScore)) strictlyAboveAll = false;
  }
  return { humansOutplaced, wonAgainstField: strictlyAboveAll && (Array.isArray(siblings) ? siblings.filter(s => s && s.id !== battle.id).length : 0) > 0 };
}

/** Sibling battles of a tournament battle (same groupId, tournament mode), by group. */
export async function fetchGroupSiblings(db, battle) {
  if (battle.gameMode !== TOURNAMENT_GAME_MODE || typeof battle.groupId !== 'string') return [];
  const snap = await db
    .collection('agentBattles')
    .where('groupId', '==', battle.groupId)
    .get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((b) => b.gameMode === TOURNAMENT_GAME_MODE);
}

// ==================== SLOT COHORT + STAMP (§3) ====================

/**
 * Fetch the same-owner, same-archetype creation cohort around the battle's
 * slot date (widened createdAt range; deriveSlotRank applies the exact NY
 * filter). Consumes the (ownerId, agentContext.archetype, createdAt)
 * composite index added in this P1 (firestore.indexes.json).
 */
export async function fetchSlotCohort(db, battle) {
  // Widen around the battle's NY slot date — NOT the UTC date prefix, which
  // is one day ahead for late-evening NY creations. deriveSlotRank then
  // applies the exact NY filter with the same deriveSlotDate — one
  // derivation source by construction (BUILD_RULES §9).
  // widenedQueryBounds(D) = [D 00:00Z, D+2 00:00Z), a strict superset of NY
  // day D's UTC span ([D 04:00Z, D+1 05:00Z] at the EST/EDT extremes).
  const nySlotDate = deriveSlotDate(battle.createdAt);
  const slotDateBounds = nySlotDate === null ? null : widenedQueryBounds(nySlotDate);
  if (!slotDateBounds) return [];
  const snap = await db
    .collection('agentBattles')
    .where('ownerId', '==', battle.ownerId)
    .where('agentContext.archetype', '==', battle.agentContext?.archetype ?? null)
    .where('createdAt', '>=', slotDateBounds.startIso)
    .where('createdAt', '<', slotDateBounds.endIso)
    .get();
  return snap.docs.map((d) => ({
    battleId: d.id,
    createdAt: d.data().createdAt,
    masterySlot: d.data().masterySlot,
  }));
}

/**
 * Derive this battle's slot fields from its cohort, pure. Returns
 * { stamp, duplicateOf } or null (unusable creation data → caller
 * quarantines at award time).
 */
export function deriveSlotFields(battle, cohortDocs, nowIso) {
  const derived = deriveSlotRank(
    { battleId: battle.id, createdAt: battle.createdAt },
    cohortDocs
  );
  if (!derived) return null;
  const stamp = buildSlotStamp({ slotDate: derived.slotDate, rank: derived.rank, assignedAt: nowIso });
  const duplicateOf = findDuplicateRank({
    slotDate: derived.slotDate,
    rank: derived.rank,
    cohortDocs,
    selfBattleId: battle.id,
  });
  return { stamp, duplicateOf };
}

/**
 * First-evaluation-tick slot stamp (§3): write-once, authoritative once
 * written. In-transaction re-read guard (regimeAtStart pattern) — under a
 * stolen eval lock only the first committer's stamp stands. A detected
 * duplicate-rank pair is an audit event routed to the corrections ledger
 * (spec §3) via the server-only quarantine/audit ledger — awaited, never
 * fire-and-forget (Signal Capture Rider).
 *
 * Returns { stamped: boolean, stamp?: object }.
 */
export async function stampMasterySlotFirstTick(db, battle, { nowIso }) {
  if (battle.masterySlot !== undefined) return { stamped: false, stamp: battle.masterySlot };
  const cohort = await fetchSlotCohort(db, battle);
  const fields = deriveSlotFields(battle, cohort, nowIso);
  if (!fields) {
    console.error(`${LOG_PREFIX} slot derivation failed for battle ${battle.id} (unusable createdAt) — left unstamped; settlement will quarantine`);
    return { stamped: false };
  }
  const battleRef = db.collection('agentBattles').doc(battle.id);
  const won = await db.runTransaction(async (t) => {
    const d = await t.get(battleRef);
    if (!d.exists || d.data()?.masterySlot !== undefined) return false;
    t.update(battleRef, { masterySlot: fields.stamp });
    return true;
  });
  if (won && fields.duplicateOf) {
    // Audit event, awaited in-request (Signal Capture Rider — no .catch(()=>{}) discard).
    await db.collection(MASTERY_QUARANTINE_COLLECTION).add({
      kind: 'duplicate_rank_audit',
      battleId: battle.id,
      collidesWith: fields.duplicateOf.battleId,
      slot: fields.stamp,
      at: nowIso,
    });
    console.error(`${LOG_PREFIX} duplicate-rank audit: battle ${battle.id} and ${fields.duplicateOf.battleId} both derive ${fields.stamp.date}#${fields.stamp.rank} — routed to corrections ledger input`);
  }
  return won ? { stamped: true, stamp: fields.stamp } : { stamped: false };
}

// ==================== AWARD TRANSACTION (§5.2) ====================

/**
 * The award transaction: masteryAward (write-once, guarded on absence in the
 * SAME transaction that reads it) + masteryProfiles increment, together.
 * Award only if stamped eligible; a stamped-INELIGIBLE battle receives a
 * zero receipt (reasonCode 'flag_disabled', §4) so the pending marker always
 * resolves. Fail-closed inputs produce a zero receipt (reasonCode
 * 'quarantined') + a server-only quarantine-ledger entry in the same
 * transaction. rank 7+ (rateBand 0) produces a real award with xpFinal 0 and
 * reasonCode 'daily_ceiling'.
 *
 * I/O discipline: sibling/group/cohort reads happen OUTSIDE the transaction
 * (their inputs are creation-frozen or final-by-close, so they are
 * settlement-order-invariant); the transaction re-reads ONLY the battle doc
 * and the profile doc, recomputes the pure math from fresh values, and
 * writes both docs — retry-safe by construction.
 *
 * Deliberately reads NO live flag view: eligibility and epochId come from
 * the persisted masteryEligibility stamp — a settlement-time fact of record
 * (§3 cross-boundary rule) — and the epoch registry is NOT an eligibility
 * oracle (§5.4). Callers may pass extra option keys; they are ignored.
 *
 * @returns {{outcome: string, xpFinal?: number, reasonCode?: string}}
 */
export async function runAwardTransaction(db, battleId, { nowIso, groupCache = new Map() }) {
  const battleRef = db.collection('agentBattles').doc(battleId);
  const preSnap = await battleRef.get();
  if (!preSnap.exists) return { outcome: 'missing' };
  const pre = { id: battleId, ...preSnap.data() };

  if (pre.isCpu === true) return { outcome: 'cpu_outside_mastery' };
  if (pre.status !== 'completed') return { outcome: 'not_completed' };
  if (pre.masteryEligibility === undefined) return { outcome: 'unstamped' };
  if (pre.masteryAward !== undefined) return { outcome: 'already_awarded' };

  const archetype = pre.agentContext?.archetype;
  const ownerId = pre.ownerId;
  if (typeof ownerId !== 'string' || ownerId.length === 0) {
    // No profile to attach to — ledger the anomaly, receipt as quarantined.
    return await commitReceipt(db, battleRef, pre, {
      reasonCode: REASON_CODES.QUARANTINED,
      diagnostic: 'missing_ownerId',
      nowIso,
      flagViewEpochId: pre.masteryEligibility.epochId,
    });
  }

  // ---- Stamped ineligible → zero receipt, profile untouched (§4/§5.2) ----
  if (pre.masteryEligibility.eligible !== true) {
    return await commitReceipt(db, battleRef, pre, {
      reasonCode: REASON_CODES.FLAG_DISABLED,
      diagnostic: null,
      nowIso,
      flagViewEpochId: pre.masteryEligibility.epochId,
    });
  }

  // ---- Gather settlement-order-invariant inputs outside the txn ----
  const group = await resolveModeGroup(db, pre, groupCache);
  const modeKind = classifyModeKind({ gameMode: pre.gameMode, group });
  const siblings = modeKind === 'league' || modeKind === 'training'
    ? await fetchGroupSiblings(db, pre)
    : [];
  const placement = computePlacementInputs({ battle: pre, siblings });
  const isMultiDay = Array.isArray(pre.timing?.tradingDays) && pre.timing.tradingDays.length > 1;
  // Slot: stamp is authoritative if present; otherwise derive lazily at
  // settlement from the cohort (§3 pre-tick terminal battles) and stamp in
  // the same award transaction.
  const cohort = pre.masterySlot === undefined ? await fetchSlotCohort(db, pre) : null;
  const lazySlot = pre.masterySlot === undefined ? deriveSlotFields(pre, cohort, nowIso) : null;

  const profileRef = db.collection(MASTERY_PROFILES_COLLECTION).doc(ownerId);
  const currentScore = pre.scoreState?.currentScore ?? 0;
  const epochId = pre.masteryEligibility.epochId;

  const result = await db.runTransaction(async (t) => {
    const freshSnap = await t.get(battleRef);
    if (!freshSnap.exists) return { outcome: 'missing' };
    const fresh = freshSnap.data();
    if (fresh.masteryAward !== undefined) return { outcome: 'already_awarded' };
    if (fresh.status !== 'completed' || fresh.masteryEligibility === undefined) {
      return { outcome: 'state_regressed' }; // cannot happen forward; fail closed
    }
    const profileSnap = await t.get(profileRef);
    const profile = profileSnap.exists ? profileSnap.data() : {};
    const arch = profile.archetypes?.[archetype] ?? { xp: 0, battlesCounted: 0 };
    const xpBefore = Number.isFinite(arch.xp) ? arch.xp : 0;
    const levelBefore = levelForXp(xpBefore);

    // Slot authority: a stamp that appeared since the pre-read wins over our
    // lazily derived one (first verified stamp is authoritative — §3).
    const slotStamp = fresh.masterySlot !== undefined
      ? fresh.masterySlot
      : (lazySlot ? lazySlot.stamp : null);
    const rateBand = slotStamp ? rateBandForRank(slotStamp.rank) : NaN;

    const invalid = validateFormulaInputs({ modeKind, archetype, currentScore, rateBand });
    if (invalid) {
      const receipt = buildZeroReceipt({
        archetype: typeof archetype === 'string' ? archetype : 'unknown',
        reasonCode: REASON_CODES.QUARANTINED,
        epochId,
        settledAt: nowIso,
        level: levelBefore,
      });
      t.update(battleRef, { masteryAward: receipt, masteryAwardPending: FieldValue.delete() });
      t.set(db.collection(MASTERY_QUARANTINE_COLLECTION).doc(), {
        kind: 'quarantined_award',
        battleId,
        diagnostic: invalid,
        at: nowIso,
      });
      return { outcome: 'quarantined', reasonCode: REASON_CODES.QUARANTINED };
    }

    const xp = computeXp({
      modeKind,
      currentScore,
      humansOutplaced: placement.humansOutplaced,
      wonAgainstField: placement.wonAgainstField,
      isMultiDay,
      rateBand,
    });
    const xpAfter = xpBefore + xp.xpFinal;
    const levelAfter = levelForXp(xpAfter);
    const award = buildAwardDoc({
      archetype,
      components: xp.components,
      modeMult: xp.modeMult,
      rateBand,
      xpFinal: xp.xpFinal,
      levelBefore,
      levelAfter,
      epochId,
      settledAt: nowIso,
      ...(rateBand === 0 ? { reasonCode: REASON_CODES.DAILY_CEILING } : {}),
    });

    const battleWrite = {
      masteryAward: award,
      masteryAwardPending: FieldValue.delete(),
      ...(fresh.masterySlot === undefined && lazySlot ? { masterySlot: lazySlot.stamp } : {}),
    };
    t.update(battleRef, battleWrite);
    t.set(
      profileRef,
      {
        archetypes: {
          [archetype]: {
            xp: xpAfter,
            level: levelAfter,
            battlesCounted: (Number.isFinite(arch.battlesCounted) ? arch.battlesCounted : 0) + 1,
            lastAwardAt: nowIso,
          },
        },
        updatedAt: nowIso,
      },
      { merge: true }
    );
    return { outcome: 'awarded', xpFinal: xp.xpFinal, reasonCode: award.reasonCode };
  });

  // Duplicate-rank audit for the lazy-stamp path (same rule as first tick),
  // only when OUR lazy stamp actually landed.
  if (result.outcome === 'awarded' && lazySlot?.duplicateOf) {
    await db.collection(MASTERY_QUARANTINE_COLLECTION).add({
      kind: 'duplicate_rank_audit',
      battleId,
      collidesWith: lazySlot.duplicateOf.battleId,
      slot: lazySlot.stamp,
      at: nowIso,
    });
  }
  return result;
}

/** Zero-receipt commit path shared by flag_disabled / anomaly quarantine (profile untouched). */
async function commitReceipt(db, battleRef, pre, { reasonCode, diagnostic, nowIso, flagViewEpochId }) {
  const archetype = typeof pre.agentContext?.archetype === 'string' ? pre.agentContext.archetype : 'unknown';
  const profileRef = typeof pre.ownerId === 'string' && pre.ownerId.length > 0
    ? db.collection(MASTERY_PROFILES_COLLECTION).doc(pre.ownerId)
    : null;
  const outcome = await db.runTransaction(async (t) => {
    const freshSnap = await t.get(battleRef);
    if (!freshSnap.exists) return { outcome: 'missing' };
    const fresh = freshSnap.data();
    if (fresh.masteryAward !== undefined) return { outcome: 'already_awarded' };
    // Truthful levelBefore/After on the receipt (levels never move on zero
    // receipts, but the receipt records the REAL level, not a floor).
    let level = 1;
    if (profileRef) {
      const profSnap = await t.get(profileRef);
      const archXp = profSnap.exists ? profSnap.data()?.archetypes?.[archetype]?.xp : 0;
      level = levelForXp(Number.isFinite(archXp) ? archXp : 0);
    }
    const receipt = buildZeroReceipt({
      archetype,
      reasonCode,
      epochId: flagViewEpochId,
      settledAt: nowIso,
      level,
    });
    t.update(battleRef, { masteryAward: receipt, masteryAwardPending: FieldValue.delete() });
    if (diagnostic) {
      t.set(db.collection(MASTERY_QUARANTINE_COLLECTION).doc(), {
        kind: 'quarantined_award',
        battleId: pre.id,
        diagnostic,
        at: nowIso,
      });
    }
    return { outcome: 'zero_receipt', reasonCode };
  });
  return outcome;
}

// ==================== REPAIR SWEEP (§5.3) ====================

/**
 * The repair sweep: battles stamped (masteryAwardPending true — the stamp's
 * queryable companion) whose award is still missing → award late. Reads
 * stamps ONLY — never flags, never timestamp-interval inference. Hosted on
 * the EXISTING agent-evaluate cron cadence (no new cron entry). Converts any
 * crash between completion and award into bounded delay, never loss.
 * Runs regardless of market hours; skips entirely pre-epoch-1.
 */
export async function runRepairSweep(db, { flagView, nowIso, limit = 25, groupCache = new Map() }) {
  if (!flagView.everEnabled) return { attempted: 0, awarded: 0, receipts: 0, errors: 0 };
  const snap = await db
    .collection('agentBattles')
    .where('masteryAwardPending', '==', true)
    .limit(limit)
    .get();
  const counts = { attempted: 0, awarded: 0, receipts: 0, errors: 0 };
  for (const doc of snap.docs) {
    counts.attempted += 1;
    try {
      const r = await runAwardTransaction(db, doc.id, { flagView, nowIso, groupCache });
      if (r.outcome === 'awarded') counts.awarded += 1;
      else if (r.outcome === 'zero_receipt' || r.outcome === 'quarantined') counts.receipts += 1;
    } catch (err) {
      counts.errors += 1;
      console.error(`${LOG_PREFIX} repair sweep failed for battle ${doc.id} (will retry next run): ${err.message}`);
    }
  }
  return counts;
}
