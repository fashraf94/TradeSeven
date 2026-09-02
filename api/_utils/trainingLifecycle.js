// api/_utils/trainingLifecycle.js
//
// League Next-Arc — League Training: the lifecycle plumbing for the no-stakes,
// ON-DEMAND training pod (Spec V1.1 + Addendum A, dark behind
// LEAGUE_NEXT_ARC_ENABLED). All non-fenced, all training-only:
//
//   (a) FORM (formTrainingDraft) — Slice 2 split of the old form-and-launch
//       seam: on tap, form the CPU-padded isTraining pod (reusing quickPlay),
//       initialize the live-draft state (the canonical generateSnakeOrder, the
//       ranked pool as the universal board source) and transition FORMING ->
//       DRAFTING, then advance any leading CPU seats up to the human's first
//       turn. The human then drafts INTERACTIVELY (applyTrainingPick) instead
//       of the Slice 1 auto-commit. NO synchronous resolve here.
//   (b) LIVE PICK (applyTrainingPick) — one human pick (or autopick on the
//       per-pick clock) under the snake turn guard, then the CPU run-up to the
//       next human turn; picks are written LIVE via createPickState (the same
//       factory the resolver uses) into the draft/state sibling doc. The 12th
//       pick triggers the transition-only completion handoff inline.
//   (c) COMPLETION HANDOFF (completeTrainingDraft) — transition-only: it does
//       NOT re-run resolveSnakeDraft. It materializes players[].picks + the
//       streams/userDraft playback stream, stamps the start anchor, and lands
//       AWAITING_OPEN — OR flips straight to BATTLE inline when the anchor date
//       is already today (the R1 inline completion-flip, shared predicate with
//       the morning sweep). Idempotent via assertTransition.
//   (d) AWAITING-OPEN FLIP (flipAwaitingOpenPods) — an orchestrator weekday-
//       MORNING sweep flips a pod to BATTLE once its anchor DATE has arrived.
//       DATE-based, never timestamp-based: the orchestrator morning window is
//       pre-open in EST (UTC 11-14 = 06:00-09:00 ET), so a timestamp compare
//       would never trip in winter and the pod would start a day late.
//   (e) IDLE SWEEP (sweepIdleDraftingPods) — the SAME morning tick: a DRAFTING
//       pod idle past TRAINING_TUNING.DRAFT_IDLE_STALE_MS is auto-completed
//       (autopick the human's remaining turns + CPU run-up), then handed off —
//       a today-anchor pod flips to BATTLE within the sweep (R1). The
//       lastActivityAt guard means an active draft is never interrupted.
//   (f) ROLLING-COMPLETION (completeBankedTrainingPods) — the nightly daily-
//       scores host completes a training pod the night its 5th day banks.
//
// SHARED-HOST SAFETY: DRAFTING and AWAITING_OPEN carry training pods and —
// behind LEAGUE_LIVE_DRAFT — competitive slot pods; a regular ranked/legacy
// group NEVER enters them (ranked formation is single-shot FORMING→BATTLE). The
// two morning sweeps treat the modes DELIBERATELY differently:
//   • the IDLE DRAFTING sweep (e) is isTraining-scoped — a competitive DRAFTING
//     pod has its OWN completion driver (the live-draft-fire cron's
//     driveSlotDraftAutopick), so it must NOT be double-driven here;
//   • the AWAITING-OPEN flip (d) is SHARED — it flips BOTH training and
//     competitive pods to BATTLE on their anchor date (a slot pod reaches BATTLE
//     ONLY via this flip). Do NOT add an isTraining filter to it.
// The banker (tournamentBanking.js) is UNTOUCHED — a DRAFTING/AWAITING_OPEN pod
// is not 'battle', so it is invisible to banking until the open. Zero new cron:
// (d)/(e) ride the orchestrator tick, (f) rides the daily-scores cron.
//
// Anchor rule mirrors the client getBattleStartDate (src/constants/battleTiming
// .js) — reproduced server-side here. The NYSE calendar is REUSED from
// marketSchedule.js (never a third copy of the holiday list).
//
// Imports the zero-import schema module from src/ under the revised June 2026
// import rule (BUILD_RULES §4); the co-located test's real import of THIS
// module is the dependency-surface guard. That guard also covers the pure,
// zero-import generateSnakeOrder (src/services/draftAssets.js) and the pure,
// zero-import computeArchetypeRankings (archetypeScoring.js) — NEVER mock those.

import { quickPlay } from './tournamentLobbyService.js';
import {
  transitionStatus,
  fetchEligibleGroupsByStatus,
  getGroup,
  assertTransition,
  expireGroup,
} from './tournamentGroupService.js';
import { computeArchetypeRankings } from './archetypeScoring.js';
import { getEtParts, toIso } from './tournamentTime.js';
import { isMarketHoliday } from './marketSchedule.js';
import { generateSnakeOrder } from '../../src/services/draftAssets.js';
import {
  GROUP_STATUS,
  isWeekBanked,
  PICKS_PER_PLAYER,
  TOURNAMENT_GROUPS_COLLECTION,
  TRAINING_TUNING,
  BASELINE_SOURCE,
  DRAFT_SUBCOLLECTION,
  DRAFT_STATE_DOC_ID,
  createPickState,
  buildCpuUserBoard,
  cpuNFromUserId,
} from '../../src/constants/leagueTournament.js';

const LOG_PREFIX = '[TrainingLifecycle]';

// 9:30 AM ET market open, minutes since ET midnight — mirrors
// tournamentTime.js:13 (MARKET_OPEN_MIN, module-private there).
const MARKET_OPEN_MIN = 9 * 60 + 30;

// Sentinel prefix for the live-pick errors the endpoint maps to HTTP.
export const TRAINING_PICK_SENTINEL_PREFIX = '__training_pick:';
function pickError(code, detail) {
  const err = new Error(TRAINING_PICK_SENTINEL_PREFIX + code);
  if (detail) err.detail = detail;
  return err;
}

// ==================== ANCHOR (pure, DST-immune) ====================
//
// The date helpers operate on 'YYYY-MM-DD' ET-calendar strings via UTC-noon
// arithmetic, so they never touch a wall-clock instant and are immune to DST.
// `getEtParts` (Intl) owns the only instant→ET conversion (reading `now`).

/** Is this ET calendar date a trading day (Mon–Fri, not a NYSE holiday)? */
function etDateIsTradingDay(etDate) {
  const [y, m, d] = etDate.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun..6=Sat
  if (dow === 0 || dow === 6) return false;
  return !isMarketHoliday(etDate);
}

/** The next ET calendar date ('YYYY-MM-DD'), pure string math. */
function nextEtCalendarDate(etDate) {
  const [y, m, d] = etDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

/** The next trading ET date strictly after `etDate` (skips weekends/holidays). */
function nextTradingEtDate(etDate) {
  let next = nextEtCalendarDate(etDate);
  while (!etDateIsTradingDay(next)) next = nextEtCalendarDate(next);
  return next;
}

/**
 * The UTC instant (ISO) of 09:30 ET on an ET date — DISPLAY ONLY (the flip is
 * date-based). Tries both DST offsets and keeps the one that round-trips to
 * 09:30 ET on that date through getEtParts — no offset math, no tz library.
 */
function etOpenInstantIso(etDate) {
  for (const offset of ['-04:00', '-05:00']) {
    const candidate = new Date(`${etDate}T09:30:00.000${offset}`);
    const p = getEtParts(candidate);
    if (p.date === etDate && p.minutes === MARKET_OPEN_MIN) return candidate.toISOString();
  }
  // Unreachable for real NYSE dates; honest fallback rather than a throw.
  return new Date(`${etDate}T09:30:00.000-05:00`).toISOString();
}

/**
 * The next market open relative to `now`, mirroring getBattleStartDate's rule:
 * before 09:30 ET on a trading day → today's open; otherwise → the next trading
 * day's open (weekends/holidays skipped). Returns
 * `{ anchorEtDate: 'YYYY-MM-DD', anchorIso }` — anchorEtDate drives the flip,
 * anchorIso is for display.
 */
export function nextMarketOpenAnchor(now = new Date()) {
  const { date, minutes } = getEtParts(now);
  const anchorEtDate = (etDateIsTradingDay(date) && minutes < MARKET_OPEN_MIN)
    ? date
    : nextTradingEtDate(date);
  return { anchorEtDate, anchorIso: etOpenInstantIso(anchorEtDate) };
}

/**
 * The SHARED date-based flip predicate (R1): has the start anchor's date
 * arrived by `nowEtDate` ('YYYY-MM-DD' strings compare lexicographically in
 * date order; flip on or after the anchor date, catch-up safe). The morning
 * AWAITING_OPEN sweep AND the inline completion-flip both read this — one copy.
 */
function anchorDateReached(startAnchor, nowEtDate) {
  const anchorEtDate = startAnchor?.anchorEtDate;
  return typeof anchorEtDate === 'string' && nowEtDate >= anchorEtDate;
}

// ==================== LIVE-DRAFT STATE (sibling doc) ====================
//
// The live draft lives at tournamentGroups/{id}/draft/state — off the group
// doc (12 rapid writes never touch updatedAt's transition-only contract) and
// client-readable under the existing {document=**} rule. Shape:
//   { status:'drafting'|'complete', snakeOrder:[seatIdx...], currentPickIndex,
//     pool:[ranked symbols, immutable], taken:[symbols], picksByUser:{id:[...]},
//     events:[...], humanArchetype, humanId, lastActivityAt, startedAt }

function draftStateRef(db, groupId) {
  return db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(groupId).collection(DRAFT_SUBCOLLECTION).doc(DRAFT_STATE_DOC_ID);
}

async function readDraftState(db, groupId) {
  const snap = await draftStateRef(db, groupId).get();
  return snap.exists ? snap.data() : null;
}

/** The user's agent archetype (the overlay + autopick key on it); 'analyst'
 *  default — the same source deriveServerBoardPrefill uses. */
export async function resolveHumanArchetype(db, odUserId) {
  try {
    // EXCLUDE training clones (Slice 3): the user-layer overlay keys on the
    // player's RANKED archetype. (Runs at draft time, before any clone exists,
    // but the filter keeps it deterministic for a returning player.)
    const snap = await db.collection('agents').where('ownerId', '==', odUserId).get();
    const arch = snap.docs.find(d => d.data().isTrainingClone !== true && d.data().isCasualClone !== true)?.data()?.archetype;
    return (typeof arch === 'string' && arch.length > 0) ? arch : 'analyst';
  } catch (err) {
    console.warn(`${LOG_PREFIX} archetype read failed for ${odUserId}, default analyst:`, err?.message);
    return 'analyst';
  }
}

/** The ranked universe (stock objects) for the human archetype autopick.
 *  Degrades to null (autopick falls back to best-available) on any failure. */
export async function readStockUniverse(db) {
  return (await readStockUniverseContext(db)).stocks;
}

/** The ranked universe PLUS the doc-level context a SUBSET caller must hand the
 *  V2 scorer (Archetype Rank V2, P-8 / P-13): `axes_universe_size` and
 *  `universe_median_return1W`. Each is `undefined` when the doc predates Phase A
 *  (the scorer then derives over the input and logs), `null` when the doc
 *  carries the field with no value. Degrades to all-null stocks on any failure
 *  (autopick falls back to best-available). */
export async function readStockUniverseContext(db) {
  const empty = { stocks: null, universeSize: undefined, universeMedianReturn1W: undefined };
  try {
    const snap = await db.collection('indexIntelligence').doc('stockRankings').get();
    if (!snap.exists) return empty;
    const data = snap.data() || {};
    const num = (v) => (Number.isFinite(v) ? v : null);
    return {
      stocks: data.stocks ?? null,
      universeSize: 'axes_universe_size' in data ? num(data.axes_universe_size) : undefined,
      universeMedianReturn1W: 'universe_median_return1W' in data ? num(data.universe_median_return1W) : undefined,
    };
  } catch (err) {
    console.warn(`${LOG_PREFIX} stockRankings read failed — autopick degrades to best-available:`, err?.message);
    return empty;
  }
}

// ---- pure pick choosers ----
//
// SHARED DRAFT CORE: these pick-choosers + the handoff builder are the
// drift-prone draft MATH, reused BY VALUE (not copied) by the Competitive Live
// Draft lifecycle (api/_utils/liveDraftLifecycle.js) so there is ONE snake/pick
// engine for both modes — the "one draft, both modes" discovery mandate, and
// the anti-byte-copy rule the arena price paths already paid for. Exported here
// rather than moved to a draftCore.js (a future hygiene extraction is ledgered)
// to keep the training path's diff byte-identical. resolveHumanArchetype /
// readStockUniverse (above) are exported for the same reuse.

/** A CPU seat's pick: highest still-available name on its deterministic board
 *  (buildCpuUserBoard), falling back to the highest-ranked remaining pool name
 *  — the resolver's board→pool fallback, sequenced live. */
export function chooseCpuPick({ player, pool, taken, ownPicks }) {
  const n = cpuNFromUserId(player.odUserId);
  const board = (n != null) ? buildCpuUserBoard(pool, n) : [];
  const passedOver = [];
  for (let rank = 0; rank < board.length; rank++) {
    const sym = board[rank];
    if (taken.has(sym)) {
      // Only names taken by OTHERS are snipes; the seat's own earlier picks
      // advance its board pointer silently (resolver semantics).
      if (!ownPicks.includes(sym)) passedOver.push(sym);
      continue;
    }
    return { symbol: sym, boardRank: rank, fallback: false, passedOver };
  }
  const sym = pool.find(s => !taken.has(s)) ?? null;
  return sym == null ? null : { symbol: sym, boardRank: null, fallback: true, passedOver };
}

/** The human's pick: an explicit free choice from the universal board, OR an
 *  autopick (timeout / sweep) = top archetype-fit available; R3 fallback to the
 *  best-available (composite-ranked pool head) if the archetype ranking is
 *  unusable. */
export function chooseHumanPick({ symbol, autopick, pool, taken, universe, archetype, gameMode, universeSize, universeMedianReturn1W }) {
  if (!autopick && symbol != null) {
    const norm = String(symbol).trim().toUpperCase();
    if (!pool.includes(norm)) return null;   // must be on the universal board
    if (taken.has(norm)) return null;        // already drafted
    return { symbol: norm, boardRank: null, fallback: false, passedOver: [] };
  }
  const fit = topArchetypeFit({ universe, archetype, taken, pool, gameMode, universeSize, universeMedianReturn1W });
  if (fit != null) return { symbol: fit, boardRank: null, fallback: false, passedOver: [] };
  const best = pool.find(s => !taken.has(s)) ?? null;
  return best == null ? null : { symbol: best, boardRank: null, fallback: true, passedOver: [] };
}

// Archetype Rank V2 (P-4 / P-8): `gameMode` is the calling mode ('training' for
// pods, 'tournament' for the competitive live draft — both share this core);
// `universeSize` + `universeMedianReturn1W` are the doc-level fields the V2
// scorer needs from a SUBSET caller (this is one of the two). V1 ignores opts.
function topArchetypeFit({ universe, archetype, taken, pool, gameMode, universeSize, universeMedianReturn1W }) {
  if (!Array.isArray(universe) || universe.length === 0) return null;
  const poolSet = new Set(pool);
  const available = universe.filter(s => {
    const sym = typeof s?.symbol === 'string' ? s.symbol.trim().toUpperCase() : '';
    return sym && poolSet.has(sym) && !taken.has(sym);
  });
  if (available.length === 0) return null;
  const ranked = computeArchetypeRankings(available, archetype, { gameMode, universeSize, universeMedianReturn1W, minCandidates: 1 });
  const sym = typeof ranked?.[0]?.symbol === 'string' ? ranked[0].symbol.trim().toUpperCase() : null;
  return sym && !taken.has(sym) ? sym : null;
}

/** Append a pick to the working accumulator (mutates taken/picksByUser/events). */
export function appendPick(acc, members, { seatIdx, pickIndex, symbol, boardRank, fallback, passedOver, liveSource }) {
  const odUserId = members[seatIdx];
  acc.taken.add(symbol);
  acc.picksByUser[odUserId].push(symbol);
  acc.events.push({
    pickNumber: pickIndex + 1,
    round: Math.floor(pickIndex / members.length) + 1,
    odUserId,
    symbol,
    boardRank: boardRank ?? null,
    fallback: !!fallback,
    passedOver: passedOver ?? [],
    liveSource,
  });
}

/** Advance consecutive CPU seats from `fromIndex` (mutates acc); stops at the
 *  next human turn or the draft end. Returns the new pick index. */
export function advanceCpuSeats(acc, { group, state, fromIndex }) {
  const members = group.groupMembers || [];
  const total = members.length * PICKS_PER_PLAYER;
  let idx = fromIndex;
  while (idx < total) {
    const seatIdx = state.snakeOrder[idx];
    const player = (group.players || []).find(p => p.odUserId === members[seatIdx]);
    if (!player || player.isCpu !== true) break;
    const pick = chooseCpuPick({ player, pool: state.pool, taken: acc.taken, ownPicks: acc.picksByUser[player.odUserId] });
    if (pick == null) throw pickError('pool_exhausted');
    appendPick(acc, members, { seatIdx, pickIndex: idx, ...pick, liveSource: 'cpu' });
    idx++;
  }
  return idx;
}

/** Build the transition-only handoff writes from a completed live state. Pure;
 *  picks are materialized via the SAME createPickState the resolver uses, so the
 *  resulting pod is byte-identical downstream to a Slice 1 resolved pod. */
export function computeHandoffWrites(group, state, now, { startAnchor: startAnchorOverride = null } = {}) {
  const nowIso = toIso(now);
  const nowEtDate = getEtParts(now).date;
  const picksByUser = state.picksByUser || {};
  const players = (group.players || []).map(p => ({
    ...p,
    picks: (picksByUser[p.odUserId] || []).map(symbol => createPickState({
      symbol,
      baselineSource: BASELINE_SOURCE.DRAFT_RESOLUTION,
      baselinePrice: null,
      openedAt: nowIso,
    })),
  }));
  const taken = new Set(state.taken || []);
  const remainingPool = (state.pool || []).filter(s => !taken.has(s));
  // Competitive live-draft pods pass their pre-computed Monday anchor
  // (group.battleStartWeek → { anchorEtDate, anchorIso }) so completion honors
  // "battle starts the next Monday-open"; training passes nothing → the
  // next-market-open-any-day anchor (byte-identical to before).
  const startAnchor = startAnchorOverride || nextMarketOpenAnchor(now);
  // R1 inline completion-flip: a today-anchor draft lands straight in BATTLE
  // (DRAFTING→BATTLE is legal); a future-anchor draft waits in AWAITING_OPEN.
  const target = anchorDateReached(startAnchor, nowEtDate) ? GROUP_STATUS.BATTLE : GROUP_STATUS.AWAITING_OPEN;
  return {
    target,
    startAnchor,
    groupUpdate: { players, userPool: remainingPool, status: target, updatedAt: nowIso, startAnchor },
    streamDoc: { events: state.events || [], roundNumber: group.roundNumber, resolvedAt: nowIso },
  };
}

// ==================== (a) FORM ====================

/**
 * Form a training pod on demand and open the INTERACTIVE draft. Reuses
 * quickPlay (1 human + 3 CPU, isTraining, CPU boards committed), then
 * initializes the live-draft state and transitions FORMING → DRAFTING, and
 * advances any leading CPU seats to the human's first turn. Returns
 * `{ lobbyId, groupId, humanCount, cpuNs, status, humanArchetype, draftState }`.
 * Idempotent re-entry: a pod that already left FORMING resumes (DRAFTING →
 * returns live state) or returns as-is (terminal).
 */
export async function formTrainingDraft(db, { odUserId, displayName = null, loadoutSpec = null, now = new Date() } = {}) {
  const nowIso = toIso(now);
  const formed = await quickPlay(db, { odUserId, displayName, now, isTraining: true });
  const groupId = formed.groupId;

  const group = await getGroup(db, groupId);
  if (group && group.status !== GROUP_STATUS.FORMING) {
    const draftState = group.status === GROUP_STATUS.DRAFTING ? await readDraftState(db, groupId) : null;
    return { ...formed, status: group.status, humanArchetype: draftState?.humanArchetype ?? null, draftState };
  }
  if (!group) return { ...formed, status: null, humanArchetype: null, draftState: null };

  const humanArchetype = await resolveHumanArchetype(db, odUserId);
  const members = group.groupMembers || [];
  const groupRef = db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(groupId);
  const stateRef = draftStateRef(db, groupId);

  // Initialize the live state, advance any leading CPU seats to the human's
  // first turn, and transition FORMING → DRAFTING — ALL in one transaction, so
  // the pod is atomically DRAFTING with the pointer resting on the human (no
  // partial-write window, no pointer-on-CPU stranding even if seating changed).
  const draftState = await db.runTransaction(async (tx) => {
    const gSnap = await tx.get(groupRef);
    if (!gSnap.exists) throw pickError('draft_not_found');
    const g = { id: groupId, ...gSnap.data() };
    if (g.status !== GROUP_STATUS.FORMING) {
      // Lost a race (a concurrent form already advanced it) — resume from the
      // state the winner wrote rather than wiping it.
      const sSnap = await tx.get(stateRef);
      return sSnap.exists ? sSnap.data() : null;
    }
    const baseState = {
      status: 'drafting',
      snakeOrder: generateSnakeOrder(members.length, PICKS_PER_PLAYER),
      currentPickIndex: 0,
      pool: [...(g.userPool || [])],
      taken: [],
      picksByUser: Object.fromEntries(members.map(id => [id, []])),
      events: [],
      humanArchetype,
      humanId: odUserId,
      startedAt: nowIso,
      lastActivityAt: nowIso,
    };
    const acc = {
      taken: new Set(),
      picksByUser: Object.fromEntries(members.map(id => [id, []])),
      events: [],
    };
    const newIndex = advanceCpuSeats(acc, { group: g, state: baseState, fromIndex: 0 });
    const finalState = {
      ...baseState,
      taken: [...acc.taken],
      picksByUser: acc.picksByUser,
      events: acc.events,
      currentPickIndex: newIndex,
    };
    assertTransition(g.status, GROUP_STATUS.DRAFTING);
    tx.set(stateRef, finalState);
    // Slice 5b-ii: persist the loadout-chooser override as the group-level carrier
    // (odUserId → spec) that ensureTrainingClones reads at activation. Written ONLY
    // on a fresh form (this FORMING→DRAFTING tx); omitted when there's no override,
    // so a fast-start pod's doc stays clean and the clone pure-inherits (Slice 3).
    // B2: every draft mutation bumps the parent progressVersion so the expiry
    // sweep's expireGroup precondition fails if any draft activity lands after
    // classification — an active draft can never be expired. This is the FIRST
    // mutation (FORMING → DRAFTING), so it seeds the counter.
    const groupUpdate = { status: GROUP_STATUS.DRAFTING, updatedAt: nowIso, progressVersion: (g.progressVersion || 0) + 1 };
    if (loadoutSpec) groupUpdate.loadoutSpecByUser = { [odUserId]: loadoutSpec };
    tx.update(groupRef, groupUpdate);
    return finalState;
  });

  console.log(`${LOG_PREFIX} formed training pod ${groupId} → drafting (human ${odUserId}, archetype ${humanArchetype})`);
  return { ...formed, status: GROUP_STATUS.DRAFTING, humanArchetype, draftState };
}

// ==================== (b) LIVE PICK ====================

/**
 * Apply one human pick (explicit `symbol`, or `autopick` on the per-pick clock
 * / sweep) under the snake turn guard, then run the CPU seats up to the next
 * human turn. The 12th pick triggers the transition-only completion handoff
 * inline (atomic with the final pick). Throws TRAINING_PICK_SENTINEL_PREFIX
 * errors (draft_not_found / draft_not_active / not_your_turn / no_pick_available
 * / pool_exhausted). Returns `{ groupId, status, currentPickIndex, complete }`.
 */
export async function applyTrainingPick(db, groupId, { odUserId, symbol = null, autopick = false, now = new Date(), stocks, universeSize, universeMedianReturn1W } = {}) {
  const nowIso = toIso(now);
  const groupRef = db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(groupId);
  const stateRef = draftStateRef(db, groupId);

  // A human autopick needs the ranked universe for the archetype-fit pick; read
  // it once, before the transaction (a static reference doc). The read also
  // carries the doc-level V2 axis context (Archetype Rank V2, P-8).
  let universe = stocks;
  if ((autopick || symbol == null) && universe === undefined) {
    const ctx = await readStockUniverseContext(db);
    universe = ctx.stocks;
    universeSize = ctx.universeSize;
    universeMedianReturn1W = ctx.universeMedianReturn1W;
  }

  return db.runTransaction(async (tx) => {
    const groupSnap = await tx.get(groupRef);
    const stateSnap = await tx.get(stateRef);
    if (!groupSnap.exists || !stateSnap.exists) throw pickError('draft_not_found');
    const group = { id: groupId, ...groupSnap.data() };
    const state = stateSnap.data();
    if (group.status !== GROUP_STATUS.DRAFTING || state.status !== 'drafting') {
      throw pickError('draft_not_active');
    }

    const members = group.groupMembers || [];
    const seatIdx = state.snakeOrder[state.currentPickIndex];
    if (members[seatIdx] !== odUserId) throw pickError('not_your_turn');

    const acc = {
      taken: new Set(state.taken || []),
      picksByUser: { ...(state.picksByUser || {}) },
      events: [...(state.events || [])],
    };
    for (const id of members) if (!acc.picksByUser[id]) acc.picksByUser[id] = [];

    // The human's own pick.
    const human = chooseHumanPick({
      symbol, autopick, pool: state.pool, taken: acc.taken, universe, archetype: state.humanArchetype || 'analyst',
      gameMode: 'training', universeSize, universeMedianReturn1W, // Archetype Rank V2 (P-4): training pods pass 'training'
    });
    if (human == null) throw pickError(autopick ? 'no_pick_available' : 'invalid_pick');
    appendPick(acc, members, { seatIdx, pickIndex: state.currentPickIndex, ...human, liveSource: 'human' });

    // The CPU run-up to the next human turn (or the draft end).
    const newIndex = advanceCpuSeats(acc, { group, state, fromIndex: state.currentPickIndex + 1 });

    const total = members.length * PICKS_PER_PLAYER;
    const baseState = {
      ...state,
      taken: [...acc.taken],
      picksByUser: acc.picksByUser,
      events: acc.events,
      currentPickIndex: newIndex,
      lastActivityAt: nowIso,
    };

    if (newIndex >= total) {
      const completeState = { ...baseState, status: 'complete' };
      const { target, groupUpdate, streamDoc } = computeHandoffWrites(group, completeState, now);
      assertTransition(group.status, target); // DRAFTING → BATTLE | AWAITING_OPEN
      tx.update(groupRef, { ...groupUpdate, progressVersion: (group.progressVersion || 0) + 1 }); // B2
      tx.set(groupRef.collection('streams').doc('userDraft'), streamDoc);
      tx.set(stateRef, completeState);
      console.log(`${LOG_PREFIX} training pod ${groupId} draft complete → ${target} (anchor ${groupUpdate.startAnchor.anchorEtDate})`);
      return { groupId, status: target, currentPickIndex: newIndex, complete: true };
    }

    tx.set(stateRef, baseState);
    // B2: a mid-draft pick writes only the draft/state sibling, so without this
    // the parent's version never moves during a live draft and the expiry
    // precondition could not see a resume. Bump it on every pick.
    tx.update(groupRef, { progressVersion: (group.progressVersion || 0) + 1 });
    return { groupId, status: GROUP_STATUS.DRAFTING, currentPickIndex: newIndex, complete: false };
  });
}

// ==================== (c) COMPLETION HANDOFF (transition-only) ====================

/**
 * The standalone transition-only handoff (resume / crash-recovery + the sweep's
 * terminal): given a DRAFTING pod whose live state holds all 12 picks,
 * materialize players[].picks + the playback stream, stamp the anchor, and land
 * AWAITING_OPEN (or flip straight to BATTLE inline, R1). Idempotent: a pod that
 * already left DRAFTING throws `illegal transition` and is reported as skipped
 * — the exact pattern completeBankedTrainingPods uses. Returns
 * `{ groupId, status, skipped }`.
 */
export async function completeTrainingDraft(db, groupId, { now = new Date() } = {}) {
  const groupRef = db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(groupId);
  const stateRef = draftStateRef(db, groupId);
  return db.runTransaction(async (tx) => {
    const groupSnap = await tx.get(groupRef);
    const stateSnap = await tx.get(stateRef);
    if (!groupSnap.exists || !stateSnap.exists) throw pickError('draft_not_found');
    const group = { id: groupId, ...groupSnap.data() };
    const state = stateSnap.data();

    const total = (group.groupMembers || []).length * PICKS_PER_PLAYER;
    const picksDone = (state.events || []).length;
    if (picksDone < total) throw pickError('draft_incomplete', `${picksDone}/${total} picks`);

    const completeState = { ...state, status: 'complete' };
    const { target, groupUpdate, streamDoc } = computeHandoffWrites(group, completeState, now);
    try {
      assertTransition(group.status, target);
    } catch (err) {
      if (typeof err?.message === 'string' && err.message.includes('illegal transition')) {
        return { groupId, status: group.status, skipped: true };
      }
      throw err;
    }
    tx.update(groupRef, { ...groupUpdate, progressVersion: (group.progressVersion || 0) + 1 }); // B2
    tx.set(groupRef.collection('streams').doc('userDraft'), streamDoc);
    tx.set(stateRef, completeState);
    return { groupId, status: target, skipped: false };
  });
}

// ==================== (d) AWAITING-OPEN FLIP ====================

/**
 * Flip AWAITING_OPEN pods to BATTLE once their anchor DATE has arrived (current
 * ET date ≥ pod.startAnchor.anchorEtDate). SHARED across modes BY DESIGN: it does
 * NOT filter isTraining, so it flips BOTH training pods AND — behind
 * LEAGUE_LIVE_DRAFT — competitive slot pods, which reach BATTLE ONLY via this
 * flip (do NOT add an isTraining filter, or slot pods would strand in
 * AWAITING_OPEN forever). Runs from the orchestrator morning tick. DATE-based by
 * design (see header). Idempotent: a flipped pod leaves the AWAITING_OPEN query,
 * so re-runs write nothing. Returns `{ swept, flipped, pending, errors }`.
 */
export async function flipAwaitingOpenPods(db, { now = new Date(), includeDev = false } = {}) {
  const nowEtDate = getEtParts(now).date;
  const nowIso = toIso(now);
  const pods = await fetchEligibleGroupsByStatus(db, GROUP_STATUS.AWAITING_OPEN, { includeDev });
  const summary = { swept: pods.length, flipped: 0, pending: 0, errors: 0 };

  for (const pod of pods) {
    if (anchorDateReached(pod.startAnchor, nowEtDate)) {
      try {
        await transitionStatus(db, pod.id, GROUP_STATUS.BATTLE, nowIso);
        summary.flipped++;
        console.log(`${LOG_PREFIX} flipped ${pod.isLiveDraft === true ? 'competitive' : 'training'} pod ${pod.id} awaiting_open → battle (anchor ${pod.startAnchor?.anchorEtDate}, now ${nowEtDate})`);
      } catch (err) {
        summary.errors++;
        console.error(`${LOG_PREFIX} flip failed for ${pod.id}: ${err.message}`);
      }
    } else {
      summary.pending++;
    }
  }
  return summary;
}

// ==================== (e) IDLE SWEEP ====================

/**
 * Auto-complete abandoned interactive drafts. A DRAFTING training pod idle past
 * TRAINING_TUNING.DRAFT_IDLE_STALE_MS has its remaining picks autopicked (the
 * human's turns via the archetype-fit autopick, CPU seats via their board) and
 * is handed off — a today-anchor pod flips to BATTLE within the sweep (R1). The
 * lastActivityAt guard guarantees an ACTIVE draft is never interrupted. Runs
 * from the orchestrator morning tick, BEFORE flipAwaitingOpenPods. Returns
 * `{ swept, completed, active, errors }`.
 */
export async function sweepIdleDraftingPods(db, { now = new Date(), includeDev = false } = {}) {
  const nowMs = now.getTime();
  const pods = await fetchEligibleGroupsByStatus(db, GROUP_STATUS.DRAFTING, { includeDev });
  // isTraining-scoped BY DESIGN — do NOT widen to competitive DRAFTING pods.
  // Competitive Live Draft (LEAGUE_LIVE_DRAFT) pods have their OWN completion
  // guarantee (the dedicated live-draft-fire cron's driveSlotDraftAutopick, which
  // completes an abandoned draft in one pass and honors battleStartWeek). Sweeping
  // them here would double-drive them AND resolve with the wrong (next-market-open)
  // anchor. The "a DRAFTING group without isTraining is never swept" test locks
  // this exclusion.
  const training = pods.filter(p => p.isTraining === true);
  const summary = { swept: training.length, completed: 0, active: 0, errors: 0 };

  let universe; // read lazily, once, shared across swept pods
  for (const pod of training) {
    try {
      const state = await readDraftState(db, pod.id);
      if (!state || state.status !== 'drafting') { summary.active++; continue; }
      const lastMs = Date.parse(state.lastActivityAt || state.startedAt || '');
      if (Number.isFinite(lastMs) && (nowMs - lastMs) < TRAINING_TUNING.DRAFT_IDLE_STALE_MS) {
        summary.active++; // an active draft — never interrupt
        continue;
      }
      if (universe === undefined) universe = await readStockUniverseContext(db);
      // The lone human seat — derived from the pod's players (the one non-CPU
      // seat), with the state's humanId as a fallback. Deriving from players
      // means a missing/corrupt state.humanId cannot strand the pod.
      const humanId = (pod.players || []).find(p => p.isCpu !== true)?.odUserId || state.humanId;
      if (!humanId) {
        summary.errors++;
        console.error(`${LOG_PREFIX} idle sweep: pod ${pod.id} has no human seat — cannot auto-complete`);
        continue;
      }
      // Drive the human's remaining turns via autopick; each call runs the CPU
      // run-up and the 12th pick triggers the inline handoff.
      let guard = 0;
      let done = false;
      while (!done && guard++ < 16) {
        const res = await applyTrainingPick(db, pod.id, {
          odUserId: humanId, autopick: true, now, stocks: universe.stocks ?? null,
          universeSize: universe.universeSize, universeMedianReturn1W: universe.universeMedianReturn1W,
        });
        done = res.complete;
      }
      if (!done) {
        // The loop hit its ceiling without completing (a wedged pod) — report it
        // honestly as an error, never a phantom completion.
        summary.errors++;
        console.error(`${LOG_PREFIX} idle sweep: pod ${pod.id} did not complete after ${guard} autopick rounds`);
        continue;
      }
      summary.completed++;
      console.log(`${LOG_PREFIX} swept idle training draft ${pod.id} → completed (autopicked remaining)`);
    } catch (err) {
      summary.errors++;
      console.error(`${LOG_PREFIX} idle sweep failed for ${pod.id}: ${err.message}`);
    }
  }
  return summary;
}

// ==================== (f) ROLLING-COMPLETION ====================

/**
 * Complete training pods whose week has banked (isWeekBanked → dayN ≥ 5),
 * ANY weekday — homed in the nightly daily-scores host, AFTER banking, so the
 * 5th day's close lands first. Dev-inclusive, matching the nightly banking
 * posture. An already-COMPLETE pod (Friday-advancement backstop ran first) is
 * an idempotent skip, not an error. Returns `{ groups, completed, skipped,
 * errors }` (`groups` = training BATTLE pods considered).
 */
export async function completeBankedTrainingPods(db, { now = new Date() } = {}) {
  const nowIso = toIso(now);
  const battleGroups = await fetchEligibleGroupsByStatus(db, GROUP_STATUS.BATTLE, { includeDev: true });
  const training = battleGroups.filter(g => g.isTraining === true);
  const summary = { groups: training.length, completed: 0, skipped: 0, errors: 0 };

  for (const pod of training) {
    if (!isWeekBanked(pod)) { summary.skipped++; continue; }
    try {
      await transitionStatus(db, pod.id, GROUP_STATUS.COMPLETE, nowIso);
      summary.completed++;
      console.log(`${LOG_PREFIX} rolling-completed training pod ${pod.id} (week banked) → complete`);
    } catch (err) {
      if (typeof err?.message === 'string' && err.message.includes('illegal transition')) {
        summary.skipped++;
      } else {
        summary.errors++;
        console.error(`${LOG_PREFIX} completion failed for ${pod.id}: ${err.message}`);
      }
    }
  }
  return summary;
}

// ==================== (g) STALE-POD EXPIRY (Training-Pod P0 R3) ====================

// A real anchor open instant is never more than a few days out (the next market
// open, at most across a long holiday close). A far-future value is corruption,
// not a legitimate wait — cap the "pending" horizon so a corrupt anchor cannot
// shield a pod from cleanup forever (review Q4).
const SANE_ANCHOR_HORIZON_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Is `anchorEtDate` a GENUINE, in-range calendar date ('YYYY-MM-DD')? Format-only
 * checks pass corruption like '2026-13-01' (month 13) or '9999-01-01'; this
 * round-trips through Date.UTC so an out-of-range month/day is rejected. The
 * far-future / absurd-year case is handled separately by the horizon cap.
 */
function anchorEtDateValid(anchorEtDate) {
  if (typeof anchorEtDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(anchorEtDate)) return false;
  const [y, m, d] = anchorEtDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/**
 * Per-state staleness ruling for a pre-BATTLE training pod. Returns
 * `{ stale, reason }`. The AWAITING_OPEN branch is the delicate one: a pod whose
 * anchor DATE has NOT arrived is legitimately pending (a Friday draft waiting for
 * Monday's open) and is NEVER stale, regardless of age — the anchor-arrived guard,
 * not the age threshold, is what protects a legitimately slow multi-day pod.
 */
async function evaluatePodStaleness(db, pod, { nowMs, nowEtDate, thresholdMs, cutoffIso }) {
  // One-time-cleanup cutoff: only touch pods created strictly before the cutoff
  // (ISO strings sort chronologically). Omitted → no cutoff (the rolling sweep).
  if (cutoffIso && !(typeof pod.createdAt === 'string' && pod.createdAt < cutoffIso)) {
    return { stale: false, reason: 'after_cutoff' };
  }
  if (pod.status === GROUP_STATUS.AWAITING_OPEN) {
    const anchorEtDate = pod.startAnchor?.anchorEtDate;
    const anchorOpenMs = Date.parse(pod.startAnchor?.anchorIso || '');
    // A USABLE anchor is a genuine calendar date whose open instant is within a
    // sane horizon of now. A missing / malformed / out-of-range / absurdly-far-
    // future anchor (Q4) is NOT protected — corruption cannot shield a pod from
    // cleanup forever, so an unusable anchor falls through to the age test with
    // reason `awaiting_open_malformed_anchor`.
    const anchorUsable = anchorEtDateValid(anchorEtDate)
      && Number.isFinite(anchorOpenMs)
      && (anchorOpenMs - nowMs) <= SANE_ANCHOR_HORIZON_MS;
    // A usable anchor still in the future → legitimately waiting for its open.
    if (anchorUsable && nowEtDate < anchorEtDate) return { stale: false, reason: 'pending_future_anchor' };
    // Anchor arrived (or unusable): the flip has been failing past the threshold.
    // Expire (a days-late flip would capture a corrupt baseline — D1: a stuck pod
    // beats a garbage one). Grace runs from when the pod SHOULD have flipped — the
    // LATER of its AWAITING_OPEN entry and the anchor's own open instant (a usable
    // anchor) — NOT merely from entry, so a weekend/holiday-spanning pod (drafted
    // Fri, anchor Mon) gets its full threshold of flip chances AFTER the anchor
    // arrives ("a legitimately slow multi-day pod must never qualify").
    const entryMs = Date.parse(pod.updatedAt || pod.createdAt || '');
    const baselineMs = Math.max(
      Number.isFinite(entryMs) ? entryMs : -Infinity,
      anchorUsable ? anchorOpenMs : -Infinity,
    );
    if (Number.isFinite(baselineMs) && (nowMs - baselineMs) >= thresholdMs) {
      return { stale: true, reason: anchorUsable ? 'awaiting_open_flip_failed' : 'awaiting_open_malformed_anchor' };
    }
    return { stale: false, reason: 'within_threshold' };
  }
  if (pod.status === GROUP_STATUS.DRAFTING) {
    // The finer progress signal is the live draft's own activity; a pod the idle
    // sweep keeps failing to complete (wedged / pool-exhausted) strands here.
    const state = await readDraftState(db, pod.id);
    if (state && state.status !== 'drafting') return { stale: false, reason: 'draft_not_active' };
    const lastMs = Date.parse((state && (state.lastActivityAt || state.startedAt)) || pod.updatedAt || pod.createdAt || '');
    if (Number.isFinite(lastMs) && (nowMs - lastMs) >= thresholdMs) return { stale: true, reason: 'drafting_wedged' };
    return { stale: false, reason: 'active_draft' };
  }
  // FORMING — the one strandable state with no other driver (form tx interrupted,
  // or the user abandoned at the lobby before opening the draft).
  const lastMs = Date.parse(pod.updatedAt || pod.createdAt || '');
  if (Number.isFinite(lastMs) && (nowMs - lastMs) >= thresholdMs) return { stale: true, reason: 'forming_orphan' };
  return { stale: false, reason: 'within_threshold' };
}

/**
 * Expire training pods stranded pre-BATTLE past the staleness threshold — the
 * unified core BOTH R3 callers use (the rolling orchestrator backstop and the
 * founder-gated one-time cleanup), so their training-only predicate + staleness
 * rules can never drift. TRAINING-ONLY BY CONSTRUCTION: `isTraining === true`
 * AND `isLiveDraft !== true`, so it can never touch a ranked group (no isTraining)
 * or a competitive slot pod (isLiveDraft). Retires via expireGroup (transactional,
 * state+version precondition), NEVER retro-advances (D1 ruling) and NEVER hard-
 * deletes. `dryRun` returns the would-expire census without any write (the
 * mandatory cleanup pre-count). `cutoffIso` bounds the cleanup to pods created
 * before a founder-chosen instant. `onlyIds` (a Set), when provided, restricts the
 * run to that exact allowlist — the apply path passes the preview token's ids so a
 * live apply can only ever touch the population its dry-run previewed (review B1).
 * Idempotent: an already-EXPIRED pod is out of the pre-BATTLE queries entirely, and
 * a pod that advanced since the read is held by expireGroup's precondition (counted
 * as a skip, never an error). Returns `{ dryRun, scanned, matched, expired, skipped,
 * errors, byStatus, matchedIds }`.
 */
export async function expireStaleTrainingPods(db, {
  now = new Date(), includeDev = false,
  thresholdMs = TRAINING_TUNING.POD_EXPIRY_STALE_MS,
  cutoffIso = null, dryRun = false, by = 'rolling_sweep', onlyIds = null,
} = {}) {
  const nowMs = now.getTime();
  const nowIso = toIso(now);
  const nowEtDate = getEtParts(now).date;
  const summary = {
    dryRun, scanned: 0, matched: 0, expired: 0, skipped: 0, errors: 0,
    byStatus: { forming: 0, drafting: 0, awaiting_open: 0 }, matchedIds: [],
  };
  const PRE_BATTLE = [GROUP_STATUS.FORMING, GROUP_STATUS.DRAFTING, GROUP_STATUS.AWAITING_OPEN];
  for (const status of PRE_BATTLE) {
    const pods = await fetchEligibleGroupsByStatus(db, status, { includeDev });
    for (const pod of pods) {
      // Training-only guard — the D1 predicate. isTraining is necessary AND
      // sufficient (training and competitive-slot are mutually exclusive), but the
      // explicit isLiveDraft exclusion is defense-in-depth against a future doc
      // that violates the invariant.
      if (pod.isTraining !== true || pod.isLiveDraft === true) continue;
      // Apply-with-token allowlist (B1): only the previewed pods are eligible.
      if (onlyIds && !onlyIds.has(pod.id)) continue;
      summary.scanned++;
      let ruling;
      try {
        ruling = await evaluatePodStaleness(db, pod, { nowMs, nowEtDate, thresholdMs, cutoffIso });
      } catch (err) {
        summary.errors++;
        console.error(`${LOG_PREFIX} staleness eval failed for ${pod.id}: ${err.message}`);
        continue;
      }
      if (!ruling.stale) { summary.skipped++; continue; }
      summary.matched++;
      summary.byStatus[status]++;
      summary.matchedIds.push(pod.id);
      if (dryRun) continue;
      try {
        const res = await expireGroup(db, pod.id, {
          reason: ruling.reason, by, now: nowIso,
          expectedStatus: pod.status,
          expectedUpdatedAt: pod.updatedAt ?? null,
          expectedProgressVersion: pod.progressVersion ?? 0, // B2: a pick after classification fails this → active draft never expires
        });
        if (res.expired) {
          summary.expired++;
          console.log(`${LOG_PREFIX} expired stale training pod ${pod.id} (${status} → expired, ${ruling.reason}, by ${by})`);
        } else {
          // Raced: the pod advanced or was already expired since the read — the
          // precondition held the line. A skip, never an error.
          summary.skipped++;
        }
      } catch (err) {
        summary.errors++;
        console.error(`${LOG_PREFIX} expire failed for ${pod.id}: ${err.message}`);
      }
    }
  }
  return summary;
}
