// api/_utils/liveDraftLifecycle.js
//
// League — Competitive Live Draft, Phase 2 (the FIRE + the completion guarantee).
// Behind LEAGUE_LIVE_DRAFT (the fire cron 404s / no-ops flag-off). This is the
// COMPETITIVE WRITER the discovery named — "point competitive formation at the
// SAME draft-init formTrainingDraft uses, minus the training flag." Two entry
// points, both driven by the dedicated fire cron (api/cron/live-draft-fire.js):
//
//   (1) fireCompetitiveSlotDraft — a FORMING slot group whose scheduledDraftAt
//       has arrived: CPU-fill the empty seats (the reserved-number pad, so a
//       slot-fired CPU can never collide with a lobby-formed one — the SHARED
//       tournamentLobby/__cpuSequence counter), stamp the fresh ranked userPool
//       (deferred from claim), initialize the live-draft state, advance leading
//       CPU seats to the first human turn, and transition FORMING → DRAFTING.
//       Idempotent + crash-safe: each step resumes (the flip.js / formGroupFromLobby
//       precedent). Reuses the shared draft core (advanceCpuSeats) so there is ONE
//       snake engine for both modes.
//
//   (2) driveSlotDraftAutopick — THE COMPLETION GUARANTEE. Each pass resolves
//       every OVERDUE human turn IN SEQUENCE (an abandoned draft completes in ONE
//       pass, never one-pick-per-pass — the founder's S3 ruling), so a Mon-8:45am
//       pre-open slot completes before the 9:30 open by construction. Overdue-ness
//       rides an ANCHORED per-turn deadline: autopicking a turn sets the next
//       deadline to prevDeadline + PICK_CLOCK (NOT wall-time), so once a draft has
//       been idle past its clock every remaining turn is already overdue and the
//       whole draft finishes in the pass; a human picking on time keeps pushing the
//       deadline forward, so the driver never touches an active draft. On completion
//       the handoff writes startAnchor = the pod's pre-computed battleStartWeek
//       (the Monday anchor) → the EXISTING flipAwaitingOpenPods carries it to BATTLE,
//       or the inline today-anchor flip lands a pre-open Monday draft straight in
//       BATTLE. No new flip code.
//
// FIREWALL: a slot pod is competitive (never isTraining) and only ever FORMING →
// DRAFTING → AWAITING_OPEN/BATTLE here. It is invisible to the status==='battle'
// score-of-record surface (sweep / banking / scorers) until the open — byte-
// identical to any other pod from BATTLE onward (baselineSource DRAFT_RESOLUTION,
// baselinePrice null, settled at the open by the canonical-open sweep).
//
// Imports the zero-import schema module from src/ under the revised June 2026
// import rule (BUILD_RULES §4); the co-located test's real import is the
// dependency-surface guard.

import {
  getGroup,
  fetchRankedUserPool,
  assertTransition,
} from './tournamentGroupService.js';
import { effectiveBattleAnchor, deriveBaseLayerWeek } from './liveDraftFormation.js';
import {
  advanceCpuSeats,
  chooseHumanPick,
  appendPick,
  computeHandoffWrites,
  resolveHumanArchetype,
  readStockUniverse,
} from './trainingLifecycle.js';
import { padGamesWithCpus, ensureCpuAgents, commitCpuUserBoards } from './tournamentCpu.js';
import { CPU_SEQUENCE_DOC_ID } from './tournamentLobbyService.js';
import { toIso } from './tournamentTime.js';
import { generateSnakeOrder } from '../../src/services/draftAssets.js';
import {
  GROUP_STATUS,
  GROUP_SIZE,
  PICKS_PER_PLAYER,
  TOURNAMENT_GROUPS_COLLECTION,
  TOURNAMENT_LOBBY_COLLECTION,
  TOURNAMENT_TUNING,
  TRAINING_TUNING,
  DRAFT_SUBCOLLECTION,
  DRAFT_STATE_DOC_ID,
} from '../../src/constants/leagueTournament.js';

const LOG_PREFIX = '[LiveDraftLifecycle]';

// The per-turn clock — the same 20s the training draft uses (spec: "the existing
// 20s per-pick clock"). Reused, not re-defined, so a founder tune moves both.
const PICK_CLOCK_MS = TRAINING_TUNING.PICK_CLOCK_MS;

// Sentinel prefix for the fire/drive errors the cron maps to a log line.
export const LIVE_DRAFT_SENTINEL_PREFIX = '__live_draft:';
function liveDraftError(code, detail) {
  const err = new Error(LIVE_DRAFT_SENTINEL_PREFIX + code);
  if (detail) err.detail = detail;
  return err;
}

function draftStateRef(db, groupId) {
  return db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(groupId).collection(DRAFT_SUBCOLLECTION).doc(DRAFT_STATE_DOC_ID);
}

// The battle anchor (with the stale-anchor re-derivation guard) lives in
// liveDraftFormation.effectiveBattleAnchor — re-derived at fire AND completion so
// a fired-late pod never anchors to a past Monday.

// ==================== QUERIES (fire-cron feed) ====================
//
// Raw status queries + in-memory filter — NOT fetchEligibleGroupsByStatus, which
// drops players.length !== GROUP_SIZE and so would hide a 1–3-human slot group.
// Single-equality `.where` (no composite index — the tournamentLobbyService
// precedent); the isLiveDraft + scheduledDraftAt filter runs in memory.

/** FORMING slot groups whose scheduled fire instant has arrived (ISO strings
 *  compare chronologically). These are the pods to fire this pass. */
export async function findDueSlotGroups(db, now = new Date()) {
  const nowIso = toIso(now);
  const snap = await db.collection(TOURNAMENT_GROUPS_COLLECTION).where('status', '==', GROUP_STATUS.FORMING).get();
  const due = [];
  snap.forEach((d) => {
    const data = d.data();
    if (data.isLiveDraft === true && typeof data.scheduledDraftAt === 'string' && data.scheduledDraftAt <= nowIso) {
      due.push({ id: d.id, ...data });
    }
  });
  return due;
}

/** DRAFTING slot groups — the pods whose overdue turns this pass may autopick. */
export async function findDraftingSlotGroups(db) {
  const snap = await db.collection(TOURNAMENT_GROUPS_COLLECTION).where('status', '==', GROUP_STATUS.DRAFTING).get();
  const groups = [];
  snap.forEach((d) => { const data = d.data(); if (data.isLiveDraft === true) groups.push({ id: d.id, ...data }); });
  return groups;
}

// ==================== (1) FIRE ====================

/**
 * CPU-fill + stamp the userPool onto a FORMING slot group, idempotently. Reserves
 * CPU numbers from the SHARED tournamentLobby/__cpuSequence counter (the
 * claimLobbyForFormation precedent) so no two formations seat the same cpu-agent.
 * One transaction (reads before writes). Returns { group, cpuNs }.
 */
async function padAndStampPool(db, groupId, { humanIds, userPool, nowIso }) {
  const groupRef = db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(groupId);
  const seqRef = db.collection(TOURNAMENT_LOBBY_COLLECTION).doc(CPU_SEQUENCE_DOC_ID);
  return db.runTransaction(async (tx) => {
    const gSnap = await tx.get(groupRef);
    if (!gSnap.exists) throw liveDraftError('group_not_found');
    const group = { id: groupId, ...gSnap.data() };
    if (group.status !== GROUP_STATUS.FORMING) return { group, cpuNs: [] }; // already advanced — resume

    const needsPad = (group.players?.length ?? 0) < GROUP_SIZE;
    const needsPool = !(Array.isArray(group.userPool) && group.userPool.length > 0);
    if (!needsPad && !needsPool) return { group, cpuNs: [] }; // idempotent re-entry

    let players = group.players || [];
    let members = group.groupMembers || [];
    let cpuNs = [];
    if (needsPad) {
      const cpuCount = GROUP_SIZE - humanIds.length;
      // Reserve the CPU number range (read BEFORE any write — Firestore tx contract).
      const seqSnap = await tx.get(seqRef);
      const raw = seqSnap.exists ? seqSnap.data().next : null;
      const startN = Number.isInteger(raw) && raw >= 1 ? raw : 1;
      const { seatsByGame, cpuNs: ns } = padGamesWithCpus([humanIds], { startN });
      cpuNs = ns;
      players = seatsByGame[0].map((s) => ({ odUserId: s.odUserId, picks: [], ...(s.isCpu === true ? { isCpu: true } : {}) }));
      members = seatsByGame[0].map((s) => s.odUserId);
      tx.set(seqRef, { next: startN + cpuCount, updatedAt: nowIso });
    }

    const update = { updatedAt: nowIso };
    if (needsPad) { update.players = players; update.groupMembers = members; }
    if (needsPool) { update.userPool = userPool; }
    tx.update(groupRef, update);
    return { group: { ...group, ...update }, cpuNs };
  });
}

/**
 * Fire a FORMING slot group into DRAFTING: resolve human archetypes, CPU-fill,
 * stamp the fresh userPool, initialize the live-draft state, advance leading CPUs
 * to the first human, transition FORMING → DRAFTING. Idempotent (a DRAFTING pod
 * resumes; a non-FORMING/non-slot pod is skipped). Returns
 * `{ groupId, status, fired, draftState }`.
 */
export async function fireCompetitiveSlotDraft(db, groupId, { now = new Date() } = {}) {
  const nowIso = toIso(now);
  const group0 = await getGroup(db, groupId);
  if (!group0 || group0.isLiveDraft !== true) return { groupId, status: group0?.status ?? null, fired: false, reason: 'not_a_slot_group' };
  if (group0.status === GROUP_STATUS.DRAFTING) return { groupId, status: GROUP_STATUS.DRAFTING, fired: false, reason: 'already_drafting' };
  if (group0.status !== GROUP_STATUS.FORMING) return { groupId, status: group0.status, fired: false, reason: 'not_forming' };

  const humanIds = group0.groupMembers || [];
  if (humanIds.length < 1) return { groupId, status: group0.status, fired: false, reason: 'no_humans' }; // structurally impossible (a claim exists)

  // Per-human archetype for the autopick fit (competitive can seat up to four
  // humans — one map, resolved from each seat's RANKED archetype).
  const archetypeByUser = {};
  for (const h of humanIds) archetypeByUser[h] = await resolveHumanArchetype(db, h);

  // Fresh board universe (deferred from claim). Fail-CLOSED if rankings aren't
  // ready — never fire a boardless draft.
  const userPool = await fetchRankedUserPool(db);
  if (userPool.length < TOURNAMENT_TUNING.BOARD_DEPTH_MIN) {
    throw liveDraftError('universe_unavailable', `stockRankings yielded ${userPool.length} (< ${TOURNAMENT_TUNING.BOARD_DEPTH_MIN})`);
  }

  // Pad + stamp pool (idempotent), then the CPU side-effects (idempotent).
  const { group, cpuNs } = await padAndStampPool(db, groupId, { humanIds, userPool, nowIso });
  if (cpuNs.length > 0) await ensureCpuAgents(db, cpuNs, nowIso);
  const boards = await commitCpuUserBoards(db, group, nowIso);
  if (boards.failed.length > 0) throw liveDraftError('cpu_board_commit_failed', boards.failed.join(', '));

  // Init the live state + FORMING → DRAFTING, one transaction.
  const groupRef = db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(groupId);
  const stateRef = draftStateRef(db, groupId);
  const draftState = await db.runTransaction(async (tx) => {
    const gSnap = await tx.get(groupRef);
    if (!gSnap.exists) throw liveDraftError('group_not_found');
    const g = { id: groupId, ...gSnap.data() };
    if (g.status === GROUP_STATUS.DRAFTING) {
      const sSnap = await tx.get(stateRef);
      return sSnap.exists ? sSnap.data() : null; // resume — the winner already inited
    }
    if (g.status !== GROUP_STATUS.FORMING) return null;

    const members = g.groupMembers || [];
    const baseState = {
      status: 'drafting',
      snakeOrder: generateSnakeOrder(members.length, PICKS_PER_PLAYER),
      currentPickIndex: 0,
      pool: [...(g.userPool || [])],
      taken: [],
      picksByUser: Object.fromEntries(members.map((id) => [id, []])),
      events: [],
      archetypeByUser,
      humanIds,
      startedAt: nowIso,
      lastActivityAt: nowIso,
    };
    const acc = { taken: new Set(), picksByUser: Object.fromEntries(members.map((id) => [id, []])), events: [] };
    const firstHuman = advanceCpuSeats(acc, { group: g, state: baseState, fromIndex: 0 });
    // Deadline anchored to the fire instant: the first human has PICK_CLOCK to act.
    const finalState = {
      ...baseState,
      taken: [...acc.taken],
      picksByUser: acc.picksByUser,
      events: acc.events,
      currentPickIndex: firstHuman,
      turnDeadline: new Date(now.getTime() + PICK_CLOCK_MS).toISOString(),
    };
    assertTransition(g.status, GROUP_STATUS.DRAFTING);
    tx.set(stateRef, finalState);
    // Stale-anchor guard: a pod firing LATE (its stamped Monday already past) gets
    // battleStartWeek re-derived here, so DRAFTING already carries the correct
    // anchor (completion re-checks independently).
    const anchor = effectiveBattleAnchor(g, now);
    const groupUpdate = { status: GROUP_STATUS.DRAFTING, updatedAt: nowIso };
    if (anchor.restamped) {
      groupUpdate.battleStartWeek = anchor.battleStartWeek;
      groupUpdate.baseLayerWeek = deriveBaseLayerWeek(anchor.battleStartWeek); // keep the cohort week with the anchor
    }
    tx.update(groupRef, groupUpdate);
    return finalState;
  });

  console.log(`${LOG_PREFIX} fired competitive slot draft ${groupId} → drafting (${humanIds.length} human(s) + ${cpuNs.length} CPU)`);
  return { groupId, status: GROUP_STATUS.DRAFTING, fired: true, draftState };
}

// ==================== (2) AUTOPICK DRIVER (completion guarantee) ====================

/**
 * Resolve every OVERDUE human turn of a DRAFTING slot group, in sequence, in ONE
 * transaction. An abandoned draft (idle past its per-turn clock) completes in this
 * single pass; an active draft (a human picking on time) is untouched (its
 * deadline is always ahead of `now`). On completion the handoff honors the pod's
 * battleStartWeek anchor. Returns `{ groupId, status, complete, autopicked }`.
 */
export async function driveSlotDraftAutopick(db, groupId, { now = new Date() } = {}) {
  const nowMs = now.getTime();
  const nowIso = toIso(now);
  const universe = await readStockUniverse(db); // stock objects for the archetype fit (before the tx)
  const groupRef = db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(groupId);
  const stateRef = draftStateRef(db, groupId);

  return db.runTransaction(async (tx) => {
    const gSnap = await tx.get(groupRef);
    const sSnap = await tx.get(stateRef);
    if (!gSnap.exists || !sSnap.exists) return { groupId, status: null, complete: false, autopicked: 0, reason: 'not_found' };
    const group = { id: groupId, ...gSnap.data() };
    const state = sSnap.data();
    if (group.isLiveDraft !== true) return { groupId, status: group.status, complete: false, autopicked: 0, reason: 'not_a_slot_group' };
    if (group.status !== GROUP_STATUS.DRAFTING || state.status !== 'drafting') {
      return { groupId, status: group.status, complete: false, autopicked: 0, reason: 'not_drafting' };
    }

    const members = group.groupMembers || [];
    const total = members.length * PICKS_PER_PLAYER;
    const acc = {
      taken: new Set(state.taken || []),
      picksByUser: { ...(state.picksByUser || {}) },
      events: [...(state.events || [])],
    };
    for (const id of members) if (!acc.picksByUser[id]) acc.picksByUser[id] = [];

    let idx = state.currentPickIndex;
    let deadlineMs = Date.parse(state.turnDeadline || state.lastActivityAt || state.startedAt || '');
    if (!Number.isFinite(deadlineMs)) deadlineMs = nowMs; // corrupt/absent → treat current turn as due now
    let autopicked = 0;

    while (idx < total) {
      // Advance any CPU seats first — the pointer must rest on a human turn.
      idx = advanceCpuSeats(acc, { group, state, fromIndex: idx });
      if (idx >= total) break;
      // A human turn: overdue only if its ANCHORED deadline has passed.
      if (nowMs < deadlineMs) break; // active/ within-clock — never interrupt
      const seatIdx = state.snakeOrder[idx];
      const currentId = members[seatIdx];
      const pick = chooseHumanPick({
        symbol: null, autopick: true, pool: state.pool, taken: acc.taken,
        universe, archetype: state.archetypeByUser?.[currentId] || 'analyst',
      });
      if (pick == null) throw liveDraftError('no_pick_available', `pool exhausted at pick ${idx + 1}`);
      appendPick(acc, members, { seatIdx, pickIndex: idx, ...pick, liveSource: 'autopick' });
      autopicked++;
      idx++;
      deadlineMs += PICK_CLOCK_MS; // anchored: the next turn's clock started when this one expired
    }

    if (idx >= total) {
      // COMPLETE → handoff with the Monday anchor.
      const completeState = {
        ...state, taken: [...acc.taken], picksByUser: acc.picksByUser, events: acc.events,
        currentPickIndex: idx, status: 'complete', lastActivityAt: nowIso,
      };
      // Stale-anchor guard at completion (the authoritative point): re-derive the
      // next Monday-open if the stamped anchor is past; the inline today-anchor
      // Monday path is unchanged (today is not stale).
      const anchor = effectiveBattleAnchor(group, now);
      const { target, groupUpdate, streamDoc } = computeHandoffWrites(group, completeState, now, {
        startAnchor: { anchorEtDate: anchor.anchorEtDate, anchorIso: anchor.anchorIso },
      });
      if (anchor.restamped) {
        groupUpdate.battleStartWeek = anchor.battleStartWeek;
        groupUpdate.baseLayerWeek = deriveBaseLayerWeek(anchor.battleStartWeek); // keep the cohort week with the anchor
      }
      assertTransition(group.status, target); // DRAFTING → BATTLE | AWAITING_OPEN
      tx.update(groupRef, groupUpdate);
      tx.set(groupRef.collection('streams').doc('userDraft'), streamDoc);
      tx.set(stateRef, completeState);
      console.log(`${LOG_PREFIX} slot draft ${groupId} complete → ${target} (autopicked ${autopicked}, anchor ${anchor.anchorEtDate})`);
      return { groupId, status: target, complete: true, autopicked };
    }

    if (autopicked === 0) return { groupId, status: GROUP_STATUS.DRAFTING, complete: false, autopicked: 0, reason: 'within_clock' };

    // Progress persisted; the pointer rests on a not-yet-overdue human turn.
    tx.set(stateRef, {
      ...state, taken: [...acc.taken], picksByUser: acc.picksByUser, events: acc.events,
      currentPickIndex: idx, turnDeadline: new Date(deadlineMs).toISOString(), lastActivityAt: nowIso,
    });
    return { groupId, status: GROUP_STATUS.DRAFTING, complete: false, autopicked };
  });
}

// ==================== (3) HUMAN PICK (the genericized room's submit target) ====================

/**
 * Apply ONE competitive human pick (an explicit `symbol`, or `autopick`) under
 * the snake turn guard, then run the CPU seats up to the next human turn. The
 * final pick triggers the completion handoff inline (with the stale-anchor
 * guard). On a non-final pick the NEXT human turn gets a FRESH clock
 * (turnDeadline = now + PICK_CLOCK) — a human who acted resets the timeline, so
 * the autopick driver never fires on an active draft. Reuses the shared pick
 * core (chooseHumanPick / advanceCpuSeats / appendPick / computeHandoffWrites)
 * so training and competitive share one snake engine. Throws
 * LIVE_DRAFT_SENTINEL_PREFIX errors (draft_not_found / draft_not_active /
 * not_your_turn / no_pick_available / invalid_pick). Returns
 * `{ groupId, status, currentPickIndex, complete }`.
 */
export async function applyCompetitivePick(db, groupId, { odUserId, symbol = null, autopick = false, now = new Date(), stocks } = {}) {
  const nowIso = toIso(now);
  const groupRef = db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(groupId);
  const stateRef = draftStateRef(db, groupId);

  let universe = stocks;
  if ((autopick || symbol == null) && universe === undefined) universe = await readStockUniverse(db);

  return db.runTransaction(async (tx) => {
    const groupSnap = await tx.get(groupRef);
    const stateSnap = await tx.get(stateRef);
    if (!groupSnap.exists || !stateSnap.exists) throw liveDraftError('draft_not_found');
    const group = { id: groupId, ...groupSnap.data() };
    const state = stateSnap.data();
    if (group.isLiveDraft !== true) throw liveDraftError('not_a_slot_group');
    if (group.status !== GROUP_STATUS.DRAFTING || state.status !== 'drafting') throw liveDraftError('draft_not_active');

    const members = group.groupMembers || [];
    const seatIdx = state.snakeOrder[state.currentPickIndex];
    if (members[seatIdx] !== odUserId) throw liveDraftError('not_your_turn');

    const acc = {
      taken: new Set(state.taken || []),
      picksByUser: { ...(state.picksByUser || {}) },
      events: [...(state.events || [])],
    };
    for (const id of members) if (!acc.picksByUser[id]) acc.picksByUser[id] = [];

    const human = chooseHumanPick({
      symbol, autopick, pool: state.pool, taken: acc.taken,
      universe, archetype: state.archetypeByUser?.[odUserId] || 'analyst',
    });
    if (human == null) throw liveDraftError(autopick ? 'no_pick_available' : 'invalid_pick');
    appendPick(acc, members, { seatIdx, pickIndex: state.currentPickIndex, ...human, liveSource: autopick ? 'autopick' : 'human' });

    const newIndex = advanceCpuSeats(acc, { group, state, fromIndex: state.currentPickIndex + 1 });
    const total = members.length * PICKS_PER_PLAYER;
    const baseState = {
      ...state, taken: [...acc.taken], picksByUser: acc.picksByUser, events: acc.events,
      currentPickIndex: newIndex, lastActivityAt: nowIso,
    };

    if (newIndex >= total) {
      const completeState = { ...baseState, status: 'complete' };
      const anchor = effectiveBattleAnchor(group, now);
      const { target, groupUpdate, streamDoc } = computeHandoffWrites(group, completeState, now, {
        startAnchor: { anchorEtDate: anchor.anchorEtDate, anchorIso: anchor.anchorIso },
      });
      if (anchor.restamped) {
        groupUpdate.battleStartWeek = anchor.battleStartWeek;
        groupUpdate.baseLayerWeek = deriveBaseLayerWeek(anchor.battleStartWeek); // keep the cohort week with the anchor
      }
      assertTransition(group.status, target);
      tx.update(groupRef, groupUpdate);
      tx.set(groupRef.collection('streams').doc('userDraft'), streamDoc);
      tx.set(stateRef, completeState);
      return { groupId, status: target, currentPickIndex: newIndex, complete: true };
    }

    // A human acted → the next human turn gets a FRESH clock from now.
    tx.set(stateRef, { ...baseState, turnDeadline: new Date(now.getTime() + PICK_CLOCK_MS).toISOString() });
    return { groupId, status: GROUP_STATUS.DRAFTING, currentPickIndex: newIndex, complete: false };
  });
}
