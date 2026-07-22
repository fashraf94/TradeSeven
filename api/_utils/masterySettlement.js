// api/_utils/masterySettlement.js
// Archetype Mastery — the §5 settlement protocol (Spec V2 §3–§5; V2.1 memo
// of record: docs/ARCHETYPE_MASTERY_SPEC_V2_1_STOP_RULINGS_JUL21_2026.md).
//
// Hosts (the P1 write-host census, pinned for the follow-up fence check):
//   • eligibility stamp gate+fields  — maybeBuildEligibilityStampFields,
//     consumed inside completeBattle's completion transaction
//     (api/cron/agent-evaluate.js — NON-fence) AND by the §12 test mimic,
//     so the production gate and the acceptance battery share ONE predicate.
//   • first-eval-tick slot stamp     — stampMasterySlotFirstTick (called from
//     processAgentBattle, api/cron/agent-evaluate.js — NON-fence)
//   • award transaction (§5.2)       — runAwardTransaction (below)
//   • repair sweep (§5.3)            — runRepairSweep (below; hosted on the
//     EXISTING agent-evaluate cron cadence — no new cron entry, BUILD_RULES §6)
//   • quarantine-ledger writer       — inside the award transaction
//     (fail-closed zero receipts; server-only diagnostics)
//   • duplicate-rank audit writer    — IN-TRANSACTION with the stamp that
//     detects it (both stamp paths), to the dedicated masteryAudits
//     collection — never masteryQuarantine, whose counts gate the §9
//     backfill go/no-go and must mean "failed to award", nothing else.
// None of these files is a fence file; fence exports are read-only-consumed.
//
// CONCURRENCY (Phase 0 S11.10 load-bearing constraint, V2.1 memo §10): the
// eval lock (120s) is shorter than the run budget (290s), so a second
// invocation can steal an expired lock and race the first. EVERY write here
// is an in-transaction re-read + write-once guard (the regimeAtStart
// pattern, agent-evaluate.js): first committer wins, losers no-op. The §12
// concurrent-retry tests are the proof.
//
// V2.1 §5.1 invariant: "Every battle completed via the settlement path
// carries an eligibility stamp atomic with its completion. Fence-path expiry
// completions (decide.js) are structurally outside the mastery system and
// never earn." CPU system agents (isMasterySubject === false) are likewise
// structurally outside: no stamp, no award, no receipt — mastery attaches to
// user × archetype and a CPU seat has neither.

import { FieldValue, FieldPath } from 'firebase-admin/firestore';
// Node-clean src imports under the revised June 2026 import rule
// (BUILD_RULES §4) — zero-import schema modules, the same surface the fenced
// battle service already consumes. The co-located test's import of THIS
// module is the dependency-surface guard (it explodes in the Node test env
// if a browser dep ever enters the graph) — never mock it.
import { TOURNAMENT_GAME_MODE } from '../../src/constants/leagueTournament.js';
import { TIERED_GAME_MODE } from '../../src/constants/agentGameModes.js';
import { getGroup } from './tournamentGroupService.js';
import {
  deriveSlotDate,
  deriveSlotRank,
  buildSlotStamp,
  widenedQueryBounds,
  findDuplicateRank,
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
  MASTERY_AUDITS_COLLECTION,
  MASTERY_CONFIG_COLLECTION,
  MASTERY_SWEEP_CURSOR_DOC,
  MASTERY_BACKFILL_PENDING_DOC,
} from './masteryConfig.js';

const LOG_PREFIX = '[Mastery]';

// ==================== SUBJECT PREDICATE ====================

/**
 * The ONE "structurally outside mastery" predicate (V2.1 STOP-A.2 wording):
 * CPU system agents are not mastery subjects — no stamp, no slot, no award,
 * no receipt. Used by the completion-stamp gate, the first-tick slot-stamp
 * gate, and the award pre-check, so the exclusion can never drift between
 * sites. NOTE: computePlacementInputs' per-sibling `isCpu !== true` is a
 * DIFFERENT semantic (counting human opponents) and deliberately does not
 * share this helper.
 */
export function isMasterySubject(battle) {
  return battle?.isCpu !== true;
}

// ==================== ELIGIBILITY STAMP (§5.1) ====================

/** The §5.1 stamp fields (shape only — gate applied by the maybe- variant). */
function buildEligibilityStampFields(flagView, nowIso) {
  return {
    masteryEligibility: {
      eligible: flagView.enabled === true,
      epochId: flagView.epochId,
      stampedAt: nowIso,
    },
    masteryAwardPending: true,
  };
}

/**
 * Gate + fields in one place — the SINGLE executable statement of "what the
 * §5.1 stamp writes and when", consumed by BOTH the production completion
 * transaction and the §12 acceptance battery's settle() mimic (so the
 * battery can never certify a gate the production writer no longer has).
 *
 * Returns {} (write nothing) unless: epoch 1 has begun, the battle is a
 * mastery subject, and no stamp exists on the transaction's own fresh read.
 * `eligible` is the worker's own flag view at settlement time (§3
 * cross-boundary rule). masteryAwardPending makes the §5.3 predicate
 * ("stamped ∧ award absent") queryable — Firestore cannot query
 * field-absence; the pendingReflection queue-flag precedent (BUILD_RULES §5).
 */
export function maybeBuildEligibilityStampFields(freshBattle, flagView, nowIso) {
  if (flagView.everEnabled !== true) return {};
  if (!isMasterySubject(freshBattle)) return {};
  if (freshBattle.masteryEligibility !== undefined) return {};
  return buildEligibilityStampFields(flagView, nowIso);
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
 * Resolve the tournamentGroups doc for a tournament battle via the shared
 * getGroup helper (tournamentGroupService.js — one fetch idiom for the
 * collection), memoized in groupCache (Map: groupId → {id,...data} | null).
 * isTraining is a creation-time group fact, so the cache is
 * settlement-order-safe.
 */
export async function resolveModeGroup(db, battle, groupCache = new Map()) {
  if (battle.gameMode !== TOURNAMENT_GAME_MODE) return null;
  const groupId = battle.groupId;
  if (typeof groupId !== 'string' || groupId.length === 0) return null;
  if (groupCache.has(groupId)) return groupCache.get(groupId);
  const group = await getGroup(db, groupId);
  groupCache.set(groupId, group);
  return group;
}

// ==================== PLACEMENT (§4) ====================

/**
 * Placement inputs, pure. Competition shape reads the frozen per-battle
 * facts: tiered battles compare scoreState.currentScore vs
 * scoreState.opponentScore (both doc-local).
 *
 * Tournament battles compare against SAME-DAY sibling battles only: groups
 * keep ONE groupId across daily redeploys (tournamentOrchestrator.js —
 * "deploys a FRESH daily battle" per agent), so the group's battle set
 * accumulates across days and the day cohort — keyed by the server-authored
 * `timing.tradingDays[0]` creation fact — IS the frozen competition shape.
 * Same-owner battles are never opponents. Day-scoping also preserves the
 * §12 order-independence property for sweep-delayed settlements: a day-N
 * battle's day-N siblings have final scores (their evaluation stopped at
 * day-N close), whereas cross-day siblings' scores may still be moving.
 *
 * Ties pay strictly-outplaced only; first place must be STRICT (an
 * engineered N-way tie pays zero placement to all N). A same-day sibling
 * with a non-finite score is conservatively neither outplaced nor conceded
 * to — it blocks wonAgainstField (fails toward less XP). A battle whose own
 * day key is missing concedes placement entirely (empty cohort).
 */
/**
 * The ONE competition-cohort filter (§9 one-source; adversarial ruling M6):
 * same-day siblings, self excluded, SAME-OWNER excluded before ALL placement
 * inputs (own battles are never opponents in any respect — they neither
 * count as humans, nor as field members, nor block a field win). A battle
 * with no day key (or no expiresAt) concedes to an empty cohort.
 *
 * MEMBERSHIP FREEZE (delta-review ADV-2): membership additionally requires
 * `sib.createdAt < battle.expiresAt` — both server-authored creation facts —
 * so a same-day sibling born AFTER my battle's close (a late deploy retry:
 * the orchestrator retries all day, and a post-16:00 crypto deploy still
 * lands on today) can never join my cohort no matter when settlement or the
 * sweep runs. Deterministically asymmetric and honest: my day ended before
 * that battle existed, while ITS cohort rightly counts my frozen final
 * score. This is what keeps cohort membership order-independent — the
 * terminality gate can only wait on battles that can ever be in the cohort.
 *
 * Used by both placement math and the award's cohort-terminality gate so
 * the two can never disagree.
 */
export function sameDayCohort(battle, siblings) {
  const myDay = battle.timing?.tradingDays?.[0];
  const myClose = battle.expiresAt;
  if (myDay === undefined || typeof myClose !== 'string' || myClose.length === 0) return [];
  return (Array.isArray(siblings) ? siblings : []).filter(
    (sib) =>
      sib &&
      sib.id !== battle.id &&
      sib.ownerId !== battle.ownerId &&
      sib.timing?.tradingDays?.[0] === myDay &&
      typeof sib.createdAt === 'string' &&
      sib.createdAt < myClose
  );
}

export function computePlacementInputs({ battle, siblings }) {
  const myScore = battle.scoreState?.currentScore;
  if (battle.gameMode !== TOURNAMENT_GAME_MODE) {
    // RAW opponent score, no zero fallback (B5's rule extended per the
    // delta review): a missing/corrupt opponentScore blocks the field win
    // (fails toward less XP) instead of fabricating a beatable 0 — the same
    // conservative posture the tournament branch takes for non-finite
    // sibling scores. (The completion feed's display math keeps its legacy
    // `|| 0` — that is §9 display behavior, photographed, untouched.)
    const opponentScore = battle.scoreState?.opponentScore;
    return {
      humansOutplaced: 0,
      wonAgainstField: Number.isFinite(myScore) && Number.isFinite(opponentScore) && myScore > opponentScore,
      snapshot: {
        basis: 'tiered_opponent',
        opponentScore: Number.isFinite(opponentScore) ? opponentScore : null,
      },
    };
  }
  const cohort = sameDayCohort(battle, siblings);
  let humansOutplaced = 0;
  let strictlyAboveAll = Number.isFinite(myScore);
  const snapshotEntries = [];
  for (const sib of cohort) {
    const sibScore = sib.scoreState?.currentScore;
    const finite = Number.isFinite(sibScore);
    const outplaced = finite && sib.isCpu !== true && Number.isFinite(myScore) && sibScore < myScore;
    if (outplaced) humansOutplaced += 1;
    if (!finite || !(myScore > sibScore)) strictlyAboveAll = false;
    snapshotEntries.push({
      battleId: sib.id,
      score: finite ? sibScore : null, // NaN/absent is not Firestore-storable; null records "unusable"
      isCpu: sib.isCpu === true,
      outplaced,
    });
  }
  // Deterministic order (§12: the snapshot itself must be order-independent).
  snapshotEntries.sort((a, b) => (a.battleId < b.battleId ? -1 : 1));
  return {
    humansOutplaced,
    wonAgainstField: strictlyAboveAll && cohort.length > 0,
    // P2 auditability commit (founder-directed): the EXACT inputs placement
    // was computed from, recorded onto the award receipt. Converts the
    // ADV-1 residual (a stale stolen-lock worker mutating a completed
    // sibling's scoreState AFTER awards) from silent divergence into an
    // auditable one — diffing a receipt's snapshot against the live docs
    // exposes any post-award score mutation. §9 one-source by construction:
    // the snapshot rows are emitted by the same loop that computed the
    // components.
    snapshot: { basis: 'same_day_terminal_cohort', cohort: snapshotEntries },
  };
}

/**
 * Sibling battles of a tournament battle (same groupId), memoized per
 * groupId for the run (sibling creation facts and post-close scores are
 * settlement-order-invariant) and field-masked to what placement reads —
 * the latestTournamentBattlesByAgent query posture (single equality filter,
 * `.select` mask, gameMode re-checked in memory).
 */
export async function fetchGroupSiblings(db, battle, siblingsCache = new Map()) {
  if (battle.gameMode !== TOURNAMENT_GAME_MODE || typeof battle.groupId !== 'string') return [];
  if (siblingsCache.has(battle.groupId)) return siblingsCache.get(battle.groupId);
  const snap = await db
    .collection('agentBattles')
    .where('groupId', '==', battle.groupId)
    .select('gameMode', 'isCpu', 'ownerId', 'scoreState', 'timing', 'status', 'createdAt')
    .get();
  const siblings = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((b) => b.gameMode === TOURNAMENT_GAME_MODE);
  siblingsCache.set(battle.groupId, siblings);
  return siblings;
}

// ==================== SLOT COHORT + STAMP (§3) ====================

/**
 * Fetch the same-owner, same-archetype creation cohort around the battle's
 * NY slot date (widened createdAt range; deriveSlotRank applies the exact NY
 * filter with the same deriveSlotDate — one derivation source, BUILD_RULES
 * §9). Consumes the (ownerId, agentContext.archetype, createdAt) composite
 * index added in this P1. Fails closed to an empty cohort on unusable
 * ownerId/createdAt (the admin SDK throws on undefined filter values).
 */
export async function fetchSlotCohort(db, battle) {
  if (typeof battle.ownerId !== 'string' || battle.ownerId.length === 0) return [];
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
    .select('createdAt', 'masterySlot')
    .get();
  return snap.docs.map((d) => ({
    battleId: d.id,
    createdAt: d.data().createdAt,
    masterySlot: d.data().masterySlot,
  }));
}

/**
 * Derive this battle's slot fields from its cohort, pure. When the creation
 * data is unusable, returns a write-once SENTINEL stamp (null date/rank/
 * rateBand): it terminates per-tick retries, and the null rateBand fails
 * validateFormulaInputs at award time → quarantined receipt — the designed
 * fail-closed chain, reached exactly once.
 */
export function deriveSlotFields(battle, cohortDocs, nowIso) {
  const derived = deriveSlotRank(
    { battleId: battle.id, createdAt: battle.createdAt },
    cohortDocs
  );
  if (!derived) {
    return {
      stamp: { date: null, rank: null, rateBand: null, assignedAt: nowIso },
      duplicateOf: null,
      sentinel: true,
    };
  }
  const stamp = buildSlotStamp({ slotDate: derived.slotDate, rank: derived.rank, assignedAt: nowIso });
  const duplicateOf = findDuplicateRank({
    slotDate: derived.slotDate,
    rank: derived.rank,
    cohortDocs,
    selfBattleId: battle.id,
  });
  return { stamp, duplicateOf, sentinel: false };
}

/**
 * Duplicate-rank audit — shape + DETERMINISTIC doc id (adversarial ruling
 * M9): the id is a pure function of (date, rank, sorted pair), so retried
 * transactions and repeated diagnostic emits are IDEMPOTENT set()s on the
 * same doc — no duplicate audit rows, no contention/counter doc.
 */
function buildDuplicateRankAuditDoc({ battleId, duplicateOf, stamp, nowIso }) {
  const pair = [battleId, duplicateOf.battleId].sort();
  return {
    id: `dup_${stamp.date}_r${stamp.rank}_${pair[0]}_${pair[1]}`,
    doc: {
      kind: 'duplicate_rank_audit',
      battleId,
      collidesWith: duplicateOf.battleId,
      slot: stamp,
      at: nowIso,
    },
  };
}

/**
 * First-evaluation-tick slot stamp (§3): write-once, authoritative once
 * written. In-transaction re-read guard (regimeAtStart pattern) — under a
 * stolen eval lock only the first committer's stamp stands. A detected
 * duplicate-rank pair commits its audit doc IN THE SAME TRANSACTION as the
 * stamp that detected it (masteryAudits — awaited by construction; a crash
 * can never separate the stamp from its only detection event).
 *
 * Returns { stamped: boolean, stamp?: object }.
 */
export async function stampMasterySlotFirstTick(db, battle, { nowIso }) {
  if (battle.masterySlot !== undefined) return { stamped: false, stamp: battle.masterySlot };
  if (typeof battle.ownerId !== 'string' || battle.ownerId.length === 0) {
    return { stamped: false }; // unqueryable owner — settles as quarantined via the lazy sentinel
  }
  const cohort = await fetchSlotCohort(db, battle);
  const fields = deriveSlotFields(battle, cohort, nowIso);
  if (fields.sentinel) {
    console.error(`${LOG_PREFIX} slot derivation failed for battle ${battle.id} (unusable createdAt) — stamping terminal sentinel; award will quarantine`);
  }
  const battleRef = db.collection('agentBattles').doc(battle.id);
  const won = await db.runTransaction(async (t) => {
    const d = await t.get(battleRef);
    if (!d.exists || d.data()?.masterySlot !== undefined) return false;
    t.update(battleRef, { masterySlot: fields.stamp });
    if (fields.duplicateOf) {
      const audit = buildDuplicateRankAuditDoc({ battleId: battle.id, duplicateOf: fields.duplicateOf, stamp: fields.stamp, nowIso });
      t.set(db.collection(MASTERY_AUDITS_COLLECTION).doc(audit.id), audit.doc);
    }
    return true;
  });
  if (won && fields.duplicateOf) {
    console.error(`${LOG_PREFIX} duplicate-rank audit: battle ${battle.id} and ${fields.duplicateOf.battleId} both derive ${fields.stamp.date}#${fields.stamp.rank} — routed to corrections intake (masteryAudits)`);
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
 * ONE transaction body serves every receipt path (award, flag_disabled,
 * quarantine, pending-anomaly) so the write-once guard, receipt payload and
 * marker clearing can never diverge between paths.
 *
 * PENDING-POISON hardening: a doc carrying masteryAwardPending that reaches
 * a defensive state (not completed / not a subject / unstamped) is an
 * invariant breach — it is resolved fail-closed with a quarantined receipt
 * (clearing the marker) instead of returning silently, so the §5.3 sweep can
 * never be starved by immortal tenants. The same defensive states WITHOUT
 * the marker (e.g. fence-path expiry completions, V2.1 STOP-A.2) stay pure
 * no-ops.
 *
 * Deliberately reads NO live flag view: eligibility and epochId come from
 * the persisted masteryEligibility stamp — a settlement-time fact of record
 * (§3 cross-boundary rule) — and the epoch registry is NOT an eligibility
 * oracle (§5.4). The persisted stamp is likewise the ONE source of the rate
 * band (`slotStamp.rateBand`, never re-derived from rank — BUILD_RULES §9),
 * and the award's score input is read from the transaction's OWN fresh doc.
 *
 * I/O discipline: sibling/group/cohort reads happen OUTSIDE the transaction
 * (their inputs are creation-frozen or final-by-close, so they are
 * settlement-order-invariant); `preloadedBattle` lets callers that already
 * hold the doc (completeBattle's completion transaction, the sweep's query)
 * skip the pre-read. The transaction re-reads ONLY the battle doc and the
 * profile doc, recomputes the pure math from fresh values, and writes —
 * retry-safe by construction.
 *
 * @returns {{outcome: 'awarded'|'zero_receipt'|'quarantined'|'cohort_pending'|'already_awarded'|'missing'|'cpu_outside_mastery'|'not_completed'|'unstamped', xpFinal?: number, reasonCode?: string}}
 *   'cohort_pending' deliberately leaves masteryAwardPending SET (ruling B4):
 *   a live same-day sibling means placement inputs aren't immutable yet; the
 *   sweep retries on its own cadence until the cohort is terminal.
 */
export async function runAwardTransaction(db, battleId, { nowIso, groupCache = new Map(), siblingsCache = new Map(), preloadedBattle = null }) {
  const battleRef = db.collection('agentBattles').doc(battleId);
  let pre = preloadedBattle;
  if (!pre) {
    const preSnap = await battleRef.get();
    if (!preSnap.exists) return { outcome: 'missing' };
    pre = { id: battleId, ...preSnap.data() };
  }

  if (pre.masteryAward !== undefined) return { outcome: 'already_awarded' };

  // Defensive states: pure no-op WITHOUT the pending marker (structurally
  // outside / not ready); fail-closed quarantined receipt WITH it.
  const pendingSet = pre.masteryAwardPending === true;
  const defensiveState = !isMasterySubject(pre)
    ? 'cpu_outside_mastery'
    : pre.status !== 'completed'
      ? 'not_completed'
      : pre.masteryEligibility === undefined
        ? 'unstamped'
        : null;
  if (defensiveState && !pendingSet) return { outcome: defensiveState };

  const archetype = pre.agentContext?.archetype;
  const ownerId = pre.ownerId;
  const ownerValid = typeof ownerId === 'string' && ownerId.length > 0;
  const epochId = pre.masteryEligibility?.epochId ?? 0;
  const eligible = !defensiveState && pre.masteryEligibility.eligible === true;

  // ---- Gather settlement-order-invariant inputs outside the txn (only
  // when a real award is possible) ----
  let modeKind = null;
  let placement = { humansOutplaced: 0, wonAgainstField: false };
  let lazySlot = null;
  if (eligible && ownerValid) {
    const group = await resolveModeGroup(db, pre, groupCache);
    modeKind = classifyModeKind({ gameMode: pre.gameMode, group });
    let siblings = [];
    if (modeKind === 'league' || modeKind === 'training') {
      siblings = await fetchGroupSiblings(db, pre, siblingsCache);
      // ---- Cohort-terminality gate (adversarial ruling B4): placement is
      // computed ONLY from terminal, immutable scores. Mixed close times
      // (e.g. a crypto-extended 20:00 sibling beside a 16:00 stock battle)
      // mean a same-day sibling can still be live at my settlement — its
      // score is still moving, so awarding now would make placement depend
      // on settlement timing. Defer: leave masteryAwardPending set and let
      // the §5.3 sweep retry once the cohort is terminal (bounded delay).
      const cohort = sameDayCohort(pre, siblings);
      if (cohort.some((s) => s.status !== 'completed')) {
        return { outcome: 'cohort_pending' };
      }
    }
    // Tiered battles compare doc-local scores (siblings stays empty).
    placement = computePlacementInputs({ battle: pre, siblings });
    if (pre.masterySlot === undefined) {
      const cohort = await fetchSlotCohort(db, pre);
      lazySlot = deriveSlotFields(pre, cohort, nowIso);
    }
  }
  const isMultiDay = Array.isArray(pre.timing?.tradingDays) && pre.timing.tradingDays.length > 1;
  const profileRef = ownerValid ? db.collection(MASTERY_PROFILES_COLLECTION).doc(ownerId) : null;

  return db.runTransaction(async (t) => {
    const freshSnap = await t.get(battleRef);
    if (!freshSnap.exists) return { outcome: 'missing' };
    const fresh = freshSnap.data();
    if (fresh.masteryAward !== undefined) return { outcome: 'already_awarded' };
    const profileSnap = profileRef ? await t.get(profileRef) : null;
    // §9 seam: while the backfill-pending marker exists, live receipts
    // stamp levelProvisional (the Training Report suppresses their level
    // ceremony permanently). Read in-transaction — one doc read per award,
    // and awards only run post-epoch-1 (dark stays zero-I/O). Covers BOTH
    // award hosts (completion path and repair sweep) with one mechanism.
    const pendingSnap = await t.get(
      db.collection(MASTERY_CONFIG_COLLECTION).doc(MASTERY_BACKFILL_PENDING_DOC),
    );
    const seamProvisional = pendingSnap.exists;
    const profile = profileSnap?.exists ? profileSnap.data() : {};
    const archKey = typeof archetype === 'string' ? archetype : 'unknown';
    const arch = profile.archetypes?.[archKey] ?? { xp: 0, battlesCounted: 0 };
    const xpBefore = Number.isFinite(arch.xp) ? arch.xp : 0;
    const levelBefore = levelForXp(xpBefore);

    /** One receipt writer for every zero/quarantine path — marker always clears. */
    const commitZeroReceipt = (reasonCode, diagnostic) => {
      const receipt = buildZeroReceipt({
        archetype: archKey,
        reasonCode,
        epochId,
        settledAt: nowIso,
        level: levelBefore,
      });
      t.update(battleRef, { masteryAward: receipt, masteryAwardPending: FieldValue.delete() });
      if (diagnostic) {
        t.set(db.collection(MASTERY_QUARANTINE_COLLECTION).doc(), {
          kind: 'quarantined_award',
          battleId,
          diagnostic,
          at: nowIso,
        });
      }
      return { outcome: reasonCode === REASON_CODES.QUARANTINED ? 'quarantined' : 'zero_receipt', reasonCode };
    };

    if (defensiveState) {
      // pendingSet must be true here (gated above): invariant breach —
      // resolve fail-closed so the sweep never grinds on it forever.
      return commitZeroReceipt(REASON_CODES.QUARANTINED, `pending_state_anomaly:${defensiveState}`);
    }
    if (fresh.status !== 'completed' || fresh.masteryEligibility === undefined) {
      return { outcome: 'not_completed' }; // regressed between reads — cannot happen forward; fail closed, no write
    }
    if (!eligible) {
      return commitZeroReceipt(REASON_CODES.FLAG_DISABLED, null);
    }
    if (!ownerValid) {
      return commitZeroReceipt(REASON_CODES.QUARANTINED, 'missing_ownerId');
    }

    // Slot authority: a stamp that appeared since the pre-read wins over our
    // lazily derived one (first verified stamp is authoritative — §3), and
    // the stamp's OWN rateBand field is the one source of the band (§9).
    const applyingLazyStamp = fresh.masterySlot === undefined && lazySlot !== null;
    const slotStamp = fresh.masterySlot !== undefined
      ? fresh.masterySlot
      : (lazySlot ? lazySlot.stamp : null);
    const rateBand = slotStamp ? slotStamp.rateBand : NaN;
    // §9 one-source: the award's score input is the transaction's own fresh
    // read — the same doc state the commit is conditioned on. RAW value, no
    // zero fallback (adversarial ruling B5): a missing/corrupt score must
    // fail validateFormulaInputs into quarantine, never masquerade as 0.
    const currentScore = fresh.scoreState?.currentScore;

    const invalid = validateFormulaInputs({ modeKind, archetype, currentScore, rateBand });
    if (invalid) {
      return commitZeroReceipt(REASON_CODES.QUARANTINED, invalid);
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
      // Zero receipts carry no ceremony to suppress (levelBefore ===
      // levelAfter), so the seam flag rides paying awards only.
      levelProvisional: seamProvisional,
      epochId,
      settledAt: nowIso,
      // §4: zero receipts carry the public reasonCode ONLY — the audit
      // snapshot rides paying awards; a daily_ceiling receipt (xpFinal 0)
      // exposes no cohort internals (P2 review finding).
      ...(rateBand === 0
        ? { reasonCode: REASON_CODES.DAILY_CEILING }
        : { placementInputs: placement.snapshot }),
    });

    t.update(battleRef, {
      masteryAward: award,
      masteryAwardPending: FieldValue.delete(),
      ...(applyingLazyStamp ? { masterySlot: lazySlot.stamp } : {}),
    });
    // Lazy-path duplicate-rank audit rides the SAME transaction as the stamp
    // that detected it, and only when OUR stamp is the one landing. The
    // deterministic id makes retries/re-emits idempotent (M9).
    if (applyingLazyStamp && lazySlot.duplicateOf) {
      const audit = buildDuplicateRankAuditDoc({ battleId, duplicateOf: lazySlot.duplicateOf, stamp: lazySlot.stamp, nowIso });
      t.set(db.collection(MASTERY_AUDITS_COLLECTION).doc(audit.id), audit.doc);
    }
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
}

// ==================== REPAIR SWEEP (§5.3) ====================

/**
 * The repair sweep: battles stamped (masteryAwardPending true — the stamp's
 * queryable companion) whose award is still missing → award late. Reads
 * stamps ONLY — never flags, never timestamp-interval inference, and (ruling
 * M8) NO registry dependency at all: pre-epoch-1 there are simply no pending
 * stamps, so the query returning nothing IS its own epoch proof. That also
 * makes the sweep the recovery path for stranded pendings even in a full
 * rollback (0·0·0). Hosted on the EXISTING agent-evaluate cron cadence.
 *
 * PAGING (ruling M7): stable `__name__` ordering with a persisted cursor
 * (masteryConfig/sweepCursor) — a doc that throws, or sits in
 * 'cohort_pending', is passed over as the cursor advances and is retried on
 * the next wrap-around, so no doc can monopolize the page. The cursor
 * resets whenever a page comes up short (end of the pending set). Converts
 * any crash between completion and award into bounded delay, never loss
 * (the pending-anomaly receipt path guarantees every anomalous doc
 * RESOLVES; cohort_pending docs resolve when their cohort turns terminal).
 * Each query doc is passed as the award's pre-read (no double fetch).
 * Runs regardless of market hours.
 */
export async function runRepairSweep(db, { nowIso, limit = 25, groupCache = new Map(), siblingsCache = new Map() }) {
  const cursorRef = db.collection(MASTERY_CONFIG_COLLECTION).doc(MASTERY_SWEEP_CURSOR_DOC);
  const cursorSnap = await cursorRef.get();
  const cursorId = cursorSnap.exists ? cursorSnap.data()?.lastDocId ?? null : null;

  let query = db
    .collection('agentBattles')
    .where('masteryAwardPending', '==', true)
    .orderBy(FieldPath.documentId());
  if (typeof cursorId === 'string' && cursorId.length > 0) {
    query = query.startAfter(cursorId);
  }
  const snap = await query.limit(limit).get();

  const counts = { attempted: 0, awarded: 0, receipts: 0, deferred: 0, errors: 0 };
  let lastProcessedId = null;
  for (const doc of snap.docs) {
    counts.attempted += 1;
    lastProcessedId = doc.id;
    try {
      const r = await runAwardTransaction(db, doc.id, {
        nowIso,
        groupCache,
        siblingsCache,
        preloadedBattle: { id: doc.id, ...doc.data() },
      });
      if (r.outcome === 'awarded') counts.awarded += 1;
      else if (r.outcome === 'zero_receipt' || r.outcome === 'quarantined') counts.receipts += 1;
      else if (r.outcome === 'cohort_pending') counts.deferred += 1;
    } catch (err) {
      counts.errors += 1;
      console.error(`${LOG_PREFIX} repair sweep failed for battle ${doc.id} (cursor advances; retried after wrap-around): ${err.message}`);
    }
  }

  // Cursor bookkeeping: advance past a FULL page; reset on a short/empty
  // page (end of the pending set — next run starts from the top). No write
  // at all in the steady dark/empty state with no cursor set.
  if (snap.docs.length === limit && lastProcessedId) {
    await cursorRef.set({ lastDocId: lastProcessedId, updatedAt: nowIso });
  } else if (cursorId !== null) {
    await cursorRef.set({ lastDocId: null, updatedAt: nowIso });
  }
  return counts;
}
