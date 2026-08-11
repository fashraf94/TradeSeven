// api/_utils/tournamentOrchestrator.js
//
// P3b — the Tournament Orchestrator (Spec §1.3; founder Ruling A, verbatim).
// One cron entry (vercel.json: */10 over the morning + Friday-evening UTC
// hour set, Mon–Fri) feeds this ET-aware dispatcher, which routes every tick
// through the ruled duty table:
//
//   Mon morning   → advancement catch-up check, then the per-group Monday
//                   pipeline: resolve user draft (uncommitted boards are
//                   AUTO-COMMITTED at the encounter — P5, the ratified
//                   deadline; finding #5's loud defer remains the fallback
//                   when auto-commit cannot produce a valid board) → produce
//                   boards (REFUSE on synthetic > 0 — the P3a contract,
//                   re-checked EVERY tick: pre-existing synthetic boards
//                   count) → resolve agent draft → verify 24 held → deploy
//                   fan-out [P4-GATED].
//   Tue–Fri morn. → incumbent fan-out [P4-GATED]: the latest tournament
//                   battle's six via the FENCED-EXPORTED
//                   flattenPortfolioServer (read-only call, never edited);
//                   an agent with NO battle yet falls back to Monday's
//                   drafted six from the stream record (a failed Monday
//                   deploy keeps retrying all week, never a one-week gap).
//   Fri evening   → round advancement + champion (tournamentAdvancement.js);
//                   a loud "banking pending" no-op until day-5 is banked
//                   (banking lands ~17:15 ET on the nightly handler).
//   anything else → one quiet skip line. NEVER self-reinvokes.
//
// TWO-GRAIN IDEMPOTENCY (ruled): per-duty/per-ET-date markers on
// tournamentOrchestrator/state PLUS the per-entity natural guards (today's-
// battle-exists, group status, stream exists, 24 held, bracket fields).
// Every pipeline step is individually resumable — a mid-duty crash finishes
// on the next tick; the marker is set only when a duty pass completes with
// nothing deferred. State-doc writes are TRANSACTIONAL (read-fresh inside)
// so a concurrent cron tick and dev run-duty click can never lose each
// other's marker or cooldown. SIMULATED clocks (the dev time control) write
// markers under a 'sim:' namespace — a smoke run can never pre-satisfy a
// real future duty (code-review finding, June 12, 2026). Zero groups is a
// clean no-op: one quiet log line, ZERO writes (test-locked).
//
// TIME BUDGET (ruled): sequential with ≥20s pacing between REAL deploy
// calls — enforced ACROSS group boundaries by duty-scoped pacing state
// (prices the 3/min rate limit until P4's exemption; no pacing burned while
// the gate holds); the remainder defers to the next tick at ~270s of the
// handler's 300s; a failed deploy defers that agent ≥10 min (the cooldown
// is consumed even on failure — priced in).
//
// DEPLOY STEP — BUILT COMPLETE, P4-GATED: the call plumbing targets
// `https://${VERCEL_PROJECT_PRODUCTION_URL}` (TOURNAMENT_DEPLOY_BASE_URL
// overrides; either path is apex-normalized — see `deployBaseUrl` below) and
// sends `Authorization: Bearer CRON_SECRET` + the ownership
// assertion on every call from day one. Until P4 lands the prescribed-
// portfolio entry path in the fenced deploy, TOURNAMENT_DEPLOY_ENABLED stays
// false and every would-be call logs a loud "P4 pending" line instead —
// tournament battles (CPU and human alike) simply don't exist yet, as ruled.
// The live branch is test-covered via the injectable `deployEnabled` option;
// the module const remains the only production gate. The payload fields
// below are the fence entry's shopping list (see the PR's P4 contract
// section).
//
// Imports the zero-import schema module from src/ under the revised June
// 2026 import rule (BUILD_RULES §4); the co-located test's real import of
// THIS module is the dependency-surface guard.

import {
  TOURNAMENT_GROUPS_COLLECTION,
  GROUP_STATUS,
  AGENT_MARKET_SIZE,
  TOURNAMENT_GAME_MODE,
  STREAMS_SUBCOLLECTION,
  AGENT_DRAFT_STREAM_DOC_ID,
  AGENT_BOARDS_SUBCOLLECTION,
} from '../../src/constants/leagueTournament.js';
import { getEtParts, formatEtDate } from './tournamentTime.js';
import { fetchEligibleGroupsByStatus } from './tournamentGroupService.js';
import { produceGroupBoards } from './tournamentAgentBoards.js';
import { resolveAgentDraftForGroup } from './tournamentAgentDraft.js';
// Endpoint-module import, the tournamentClaims.js precedent (hoisted
// function declarations both sides; no cycle — the endpoint never imports
// this module).
import { resolveUserDraftForGroup, USER_DRAFT_SENTINEL_PREFIX } from '../tournament/resolve-user-draft.js';
import { autoCommitMissingBoards } from './tournamentBoardAutoCommit.js';
import { runFridayAdvancement } from './tournamentAdvancement.js';
import { flipAwaitingOpenPods, sweepIdleDraftingPods, expireStaleTrainingPods } from './trainingLifecycle.js';
import { POD_EXPIRY_SWEEP_ENABLED } from '../../src/config/featureFlags.js';
import { ensureTrainingClones } from './trainingClone.js';
// Fenced module EXPORT, called read-only — never edited (BUILD_RULES §1).
import { flattenPortfolioServer } from './agentScoring.js';

const LOG_PREFIX = '[Orchestrator]';

export const ORCHESTRATOR_COLLECTION = 'tournamentOrchestrator';
export const ORCHESTRATOR_STATE_DOC_ID = 'state';

// THE P4 GATE — FLIPPED (founder-approved Fence-Edit Map, June 12, 2026), in
// the same PR that landed the prescribed-portfolio entry path inside the
// fence, exactly as contracted. This is the first merge that changes
// production behavior for real groups; the dev-group exclusion
// (fetchEligibleGroupsByStatus, companion a) is what makes that safe.
// Pinned by: p4Flips.test.js, tournamentOrchestrator.test.js (flagPinGuard: this value and the pin move together — BUILD_RULES §2).
export const TOURNAMENT_DEPLOY_ENABLED = true;

export const DEPLOY_PACING_MS = 20_000;            // ≥20s between real deploy calls (3/min limit priced)
export const DUTY_DEADLINE_MS = 270_000;           // defer remainder ~270s into the 300s budget
export const DEPLOY_FAILURE_COOLDOWN_MS = 10 * 60 * 1000; // failed deploys defer ≥10 min (ruled)
export const STATE_RETENTION_DAYS = 14;

export const DUTY = Object.freeze({
  MONDAY_PIPELINE: 'monday_pipeline',
  WEEKDAY_FANOUT: 'weekday_fanout',
  FRIDAY_ADVANCEMENT: 'friday_advancement',
  SKIP: 'skip',
});

const MORNING_END_MIN = 12 * 60; // ET noon splits morning duties from the Friday-evening duty

// ==================== DISPATCH (pure) ====================

/**
 * The ruled duty table, ET-aware (Intl via tournamentTime — the DST pattern
 * of record; the UTC schedule fires both DST arms, this guard routes them).
 */
export function getDutyForInstant(now = new Date()) {
  const { weekday, date, minutes, etTime } = getEtParts(now);
  const morning = minutes < MORNING_END_MIN;
  let duty = DUTY.SKIP;
  if (morning && weekday === 'Mon') duty = DUTY.MONDAY_PIPELINE;
  else if (morning && ['Tue', 'Wed', 'Thu', 'Fri'].includes(weekday)) duty = DUTY.WEEKDAY_FANOUT;
  else if (!morning && weekday === 'Fri') duty = DUTY.FRIDAY_ADVANCEMENT;
  return { duty, etDate: date, etTime, weekday };
}

/**
 * Marker key. A SIMULATED clock (the dev time control) namespaces its
 * markers so a smoke run on a future date can never pre-satisfy the real
 * cron when that date arrives — re-click idempotency still works inside the
 * namespace.
 */
export function dutyMarkerKey(etDate, duty, { simulated = false } = {}) {
  return `${simulated ? 'sim:' : ''}${etDate}:${duty}`;
}

const MARKER_DATE_RE = /(\d{4}-\d{2}-\d{2})/;

// ==================== STATE DOC ====================

function stateRef(db) {
  return db.collection(ORCHESTRATOR_COLLECTION).doc(ORCHESTRATOR_STATE_DOC_ID);
}

export async function readOrchestratorState(db) {
  const snap = await stateRef(db).get();
  return snap.exists ? snap.data() : { duties: {}, deployCooldowns: {} };
}

export function isDutyComplete(state, etDate, duty, { simulated = false } = {}) {
  return state?.duties?.[dutyMarkerKey(etDate, duty, { simulated })] != null;
}

/** Retention pruning for both state maps: duty markers older than the
 * window (by the date embedded in the key, real or sim) and cooldowns that
 * have expired. Pure. */
export function pruneState({ duties = {}, deployCooldowns = {} }, etDate, nowIso) {
  const cutoffMs = new Date(`${etDate}T00:00:00Z`).getTime() - STATE_RETENTION_DAYS * 86_400_000;
  const cutoffDate = new Date(cutoffMs).toISOString().slice(0, 10);
  const prunedDuties = {};
  for (const [key, value] of Object.entries(duties)) {
    const date = MARKER_DATE_RE.exec(key)?.[1];
    if (date && date >= cutoffDate) prunedDuties[key] = value;
  }
  const prunedCooldowns = {};
  for (const [agentId, untilIso] of Object.entries(deployCooldowns)) {
    if (untilIso > nowIso) prunedCooldowns[agentId] = untilIso;
  }
  return { duties: prunedDuties, deployCooldowns: prunedCooldowns };
}

/**
 * Set the per-duty/per-ET-date marker (grain one of the two-grain design).
 * TRANSACTIONAL — the doc is re-read fresh inside, so a concurrent writer's
 * marker or cooldown is never lost to a stale snapshot.
 */
export async function markDutyComplete(db, etDate, duty, summary, nowIso, { simulated = false } = {}) {
  const ref = stateRef(db);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const fresh = snap.exists ? snap.data() : { duties: {}, deployCooldowns: {} };
    const pruned = pruneState(fresh, etDate, nowIso);
    pruned.duties[dutyMarkerKey(etDate, duty, { simulated })] = { completedAt: nowIso, ...summary };
    tx.set(ref, { ...pruned, updatedAt: nowIso });
  });
}

/** Transactional cooldown write (same lost-update posture); also mirrors
 * into the caller's in-memory state so the rest of the duty run sees it. */
async function setDeployCooldown(db, state, agentId, untilIso, nowIso) {
  const ref = stateRef(db);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const fresh = snap.exists ? snap.data() : { duties: {}, deployCooldowns: {} };
    const pruned = pruneState(fresh, nowIso.slice(0, 10), nowIso);
    pruned.deployCooldowns[agentId] = untilIso;
    tx.set(ref, { ...pruned, updatedAt: nowIso });
  });
  state.deployCooldowns = { ...(state.deployCooldowns || {}), [agentId]: untilIso };
}

// ==================== DEPLOY PLUMBING (built complete, P4-gated) ====================

// The apex `fantasytrades.io` answers 307 → `https://www.fantasytrades.io`, and
// per the fetch spec the `Authorization` header is STRIPPED across that origin
// change — so an internal caller that targets the apex arrives unauthenticated
// and takes a 401 it can only report as a generic deploy failure. Measured in
// production: docs/audits/20260805_PR2_POST_FLIP_LIVE_VERIFICATION.md:148.
//
// Both resolution paths below are normalized, because both can carry the apex:
// a dashboard typo in TOURNAMENT_DEPLOY_BASE_URL, or — silently, with no human
// in the loop — VERCEL_PROJECT_PRODUCTION_URL when the apex is the project's
// assigned production domain. The rewrite is exact-host only: `fantasytrades.io`
// and nothing else, so previews, `*.vercel.app`, and any subdomain pass through
// untouched. Precedence between the two paths is unchanged.
const PRODUCTION_APEX_HOST = 'fantasytrades.io';
const PRODUCTION_CANONICAL_HOST = 'www.fantasytrades.io';

/**
 * Trailing-slash strip + apex→www rewrite. A rewrite is always logged: a silent
 * correction would mask the misconfiguration that caused it, leaving the env
 * indefinitely one code-change away from the 401 this function exists to
 * prevent. Unparseable input is returned trimmed rather than thrown on — this
 * sits in a fire path whose callers already treat a falsy base as "skip".
 */
function normalizeDeployBase(raw, source) {
  const trimmed = String(raw).trim().replace(/\/+$/, '');
  let normalized = trimmed;

  let parsed = null;
  try { parsed = new URL(trimmed); } catch { parsed = null; }
  if (parsed && parsed.hostname === PRODUCTION_APEX_HOST) {
    parsed.hostname = PRODUCTION_CANONICAL_HOST;
    normalized = parsed.toString().replace(/\/+$/, '');
  }

  if (normalized !== raw) {
    console.warn(
      `[tournament-deploy] deploy base URL normalized from ${source}: "${raw}" → "${normalized}". ` +
      `Fix the value at its source — the apex strips Authorization across its 307 to www.`,
    );
  }
  return normalized;
}

export function deployBaseUrl() {
  if (process.env.TOURNAMENT_DEPLOY_BASE_URL) {
    return normalizeDeployBase(process.env.TOURNAMENT_DEPLOY_BASE_URL, 'TOURNAMENT_DEPLOY_BASE_URL');
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return normalizeDeployBase(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`, 'VERCEL_PROJECT_PRODUCTION_URL');
  }
  return null;
}

/**
 * The deploy call, fully formed: internal-caller credentials
 * (Bearer CRON_SECRET — Spec §0.3) and the ownership assertion
 * (`ownerOdUserId`: the deploy must verify agent.ownerId matches) on every
 * call from day one. `prescribedPortfolio` + `gameMode` + `groupId` + the
 * CPU/passive marker are the P4 fence entry's intake (contract items #1/#5).
 * The rider-#6 deploy-time fields (`userPicksStance` from the agent's board,
 * `doubleDownSymbols`, `userPicks`) ride the same payload — the fence entry
 * persists them awaited on the battle doc (founder ruling D10).
 */
export function buildDeployRequest({ agentId, odUserId, isCpu = false, groupId, symbols, userPicksStance, doubleDownSymbols, userPicks }) {
  const base = deployBaseUrl();
  return {
    url: base ? `${base}/api/agent/decide` : null,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.CRON_SECRET}`,
    },
    body: {
      agentId,
      ownerOdUserId: odUserId,
      groupId,
      gameMode: TOURNAMENT_GAME_MODE,
      prescribedPortfolio: symbols,
      userPicksStance: userPicksStance || [],
      doubleDownSymbols: doubleDownSymbols || [],
      userPicks: userPicks || [],
      ...(isCpu ? { isCpu: true } : {}),
    },
  };
}

/**
 * Rider #6, deploy-time half (founder ruling D10): attach each seat's USER
 * PICKS stance (read from its agent board — the board-time record) and the
 * double-down overlap (prescribed six ∩ own player's CURRENT pick symbols,
 * from the group doc already in hand). A missing/failed board read degrades
 * to an empty stance with a loud line — capture must never block a deploy.
 * Mutates and returns `seats`.
 */
export async function attachRiderSix(db, group, seats) {
  const picksByUser = new Map(
    (group.players || []).map(p => [p.odUserId, (p.picks || []).map(pk => pk?.symbol).filter(Boolean)])
  );
  for (const seat of seats) {
    try {
      const boardSnap = await db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(group.id)
        .collection(AGENT_BOARDS_SUBCOLLECTION).doc(seat.agentId).get();
      seat.userPicksStance = boardSnap.exists ? (boardSnap.data().userPicksStance || []) : [];
      if (!boardSnap.exists) {
        console.error(`${LOG_PREFIX} group ${group.id} agent ${seat.agentId}: agent board missing at deploy — rider-#6 stance empty (capture degraded, deploy proceeds)`);
      }
    } catch (err) {
      console.error(`${LOG_PREFIX} group ${group.id} agent ${seat.agentId}: board read failed (${err.message}) — rider-#6 stance empty (capture degraded, deploy proceeds)`);
      seat.userPicksStance = [];
    }
    const ownPicks = picksByUser.get(seat.odUserId) || [];
    seat.userPicks = ownPicks;
    seat.doubleDownSymbols = (seat.symbols || []).filter(s => ownPicks.includes(s));
  }
  return seats;
}

/**
 * Latest tournament battle per agent for a group — the reconcileGroupLedger
 * query posture (single equality filter, field-mask select, gameMode
 * re-checked in memory so a stray stamp can't leak a casual battle in).
 */
export async function latestTournamentBattlesByAgent(db, groupId, fields = ['agentId', 'createdAt', 'gameMode', 'ownerId', 'portfolio']) {
  const snap = await db.collection('agentBattles')
    .where('groupId', '==', groupId)
    .select(...fields)
    .get();
  const latest = new Map();
  snap.forEach(doc => {
    const data = doc.data();
    if (data?.gameMode !== TOURNAMENT_GAME_MODE || typeof data?.agentId !== 'string') return;
    const prior = latest.get(data.agentId);
    if (!prior || String(data.createdAt) > String(prior.createdAt)) {
      latest.set(data.agentId, { id: doc.id, ...data });
    }
  });
  return latest;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * One group's deploy fan-out (Monday: draft-resolved six; Tue–Fri: the
 * incumbents the caller passes). Sequential, ≥20s pacing between REAL calls
 * — `pacing` is DUTY-scoped (one object per duty run), so the floor holds
 * across group boundaries, not just within one group. Budget-deferred,
 * per-agent natural guard (today's battle exists) and the ≥10-min failure
 * cooldown. While the P4 gate holds, every would-be call is one loud "P4
 * pending" line and nothing is sent (and no pacing is burned).
 *
 * `seats` = [{agentId, odUserId, isCpu, symbols}] in groupMembers order.
 * `latestBattles` lets the weekday caller pass its already-fetched map.
 * Returns {deployed, skipped, gated, skippedExisting, cooled, failed, deferred}.
 * `skipped` = a 200 whose body reported battleCreated:false (no battle created —
 * e.g. a casual battle already blocks the agent, G2); it is NOT a `deployed`.
 */
export async function fanOutDeploys(db, {
  groupId, seats, now, state, budget,
  fetchImpl = fetch,
  deployEnabled = TOURNAMENT_DEPLOY_ENABLED,
  pacing = { lastSentAt: 0 },
  pacingMs = DEPLOY_PACING_MS,
  latestBattles = null,
}) {
  const nowIso = now.toISOString();
  const etDate = formatEtDate(now);
  const out = { deployed: 0, skipped: 0, gated: 0, skippedExisting: 0, cooled: 0, failed: 0, deferred: 0 };

  const latest = latestBattles
    ?? await latestTournamentBattlesByAgent(db, groupId, ['agentId', 'createdAt', 'gameMode']);

  for (let i = 0; i < seats.length; i++) {
    const { agentId, odUserId, isCpu, symbols, userPicksStance, doubleDownSymbols, userPicks } = seats[i];

    // Natural guard: today's battle already exists for this agent.
    const battle = latest.get(agentId);
    if (battle && formatEtDate(new Date(battle.createdAt)) === etDate) {
      console.log(`${LOG_PREFIX} group ${groupId} agent ${agentId}: today's battle exists — deploy skipped (idempotent)`);
      out.skippedExisting++;
      continue;
    }

    const request = buildDeployRequest({ agentId, odUserId, isCpu, groupId, symbols, userPicksStance, doubleDownSymbols, userPicks });

    if (!deployEnabled) {
      console.log(`${LOG_PREFIX} group ${groupId} agent ${agentId} (owner ${odUserId}${isCpu ? ', CPU' : ''}): DEPLOY GATED — P4 pending; would send [${symbols.join(', ')}] to ${request.url ?? '(no base URL)'}`);
      out.gated++;
      continue;
    }

    // ≥10-min failure cooldown (consumed even on failure — priced in).
    const cooldownUntil = state?.deployCooldowns?.[agentId];
    if (cooldownUntil && cooldownUntil > nowIso) {
      console.log(`${LOG_PREFIX} group ${groupId} agent ${agentId}: failure cooldown until ${cooldownUntil} — deferred`);
      out.cooled++;
      continue;
    }

    // Budget: a deploy call + its pacing must fit; otherwise defer the rest.
    if (budget && Date.now() - budget.startMs > budget.deadlineMs - pacingMs) {
      console.log(`${LOG_PREFIX} group ${groupId}: time budget reached — ${seats.length - i} deploy(s) deferred to next tick`);
      out.deferred += seats.length - i;
      break;
    }
    const wait = pacing.lastSentAt + pacingMs - Date.now();
    if (wait > 0) await sleep(wait);

    try {
      pacing.lastSentAt = Date.now();
      const response = await fetchImpl(request.url, {
        method: 'POST',
        headers: request.headers,
        body: JSON.stringify(request.body),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status} ${text.slice(0, 200)}`);
      }
      // A 200 does NOT prove a battle was created. /api/agent/decide early-returns
      // { battleCreated: false } when the agent already has an active battle — e.g. a
      // casual vs-CPU battle blocking a tournament deploy (G2; see
      // docs/audits/20260720_G2_ACTIVEBATTLEID_CONFLICT_DISCOVERY.md). Counting that
      // 200 as a deploy hid the skip in the cron summary, so read the body: only score
      // an actual creation as `deployed`, and surface any battleCreated:false LOUDLY as
      // a separate `skipped` so a silent no-op can never masquerade as a success.
      let resultBody = null;
      try {
        resultBody = await response.json();
      } catch {
        // Body unreadable (non-JSON, or a mock without .json()) — cannot introspect,
        // so fall through to the deployed branch (the pre-G2 behavior for any 200).
      }
      if (resultBody && resultBody.battleCreated === false) {
        console.warn(`${LOG_PREFIX} group ${groupId} agent ${agentId} (owner ${odUserId}): deploy SKIPPED — no battle created (reason: ${resultBody.reason || 'unspecified'})`);
        out.skipped++;
      } else {
        console.log(`${LOG_PREFIX} group ${groupId} agent ${agentId}: deployed [${symbols.join(', ')}]`);
        out.deployed++;
      }
    } catch (err) {
      const untilIso = new Date(now.getTime() + DEPLOY_FAILURE_COOLDOWN_MS).toISOString();
      console.error(`${LOG_PREFIX} group ${groupId} agent ${agentId}: deploy FAILED (${err.message}) — cooldown until ${untilIso}`);
      await setDeployCooldown(db, state, agentId, untilIso, nowIso);
      out.failed++;
    }
  }
  return out;
}

// ==================== SEAT ASSEMBLY ====================

/** The agent-draft stream's prescribed six per seat, in groupMembers order.
 * The stream is THE resolution record (P3a) — picksByAgent for the six,
 * events for the agentId→owner mapping. Returns null when no stream. */
async function seatsFromDraftStream(db, group, { onlyAgentIds = null } = {}) {
  const streamSnap = await db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(group.id)
    .collection(STREAMS_SUBCOLLECTION).doc(AGENT_DRAFT_STREAM_DOC_ID).get();
  if (!streamSnap.exists) return null;
  const stream = streamSnap.data();
  const ownerByAgent = {};
  for (const event of stream.events || []) ownerByAgent[event.agentId] = event.odUserId;
  const cpuByUser = new Map((group.players || []).map(p => [p.odUserId, p.isCpu === true]));
  const memberOrder = group.groupMembers || [];
  return Object.entries(stream.picksByAgent || {})
    .filter(([agentId]) => onlyAgentIds == null || onlyAgentIds.has(agentId))
    .map(([agentId, symbols]) => ({
      agentId,
      odUserId: ownerByAgent[agentId],
      isCpu: cpuByUser.get(ownerByAgent[agentId]) === true,
      symbols,
    }))
    .sort((a, b) => memberOrder.indexOf(a.odUserId) - memberOrder.indexOf(b.odUserId));
}

// ==================== MONDAY PIPELINE ====================

/** Resolve the user draft and re-read the group (status flips to battle) —
 * the step-1 body, shared by the straight path and the post-auto-commit
 * retry so the two can never drift. */
async function resolveUserDraftAndRefresh(db, groupId, now) {
  await resolveUserDraftForGroup(db, groupId, { now });
  const fresh = await db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(groupId).get();
  return { id: groupId, ...fresh.data() };
}

/**
 * Per-group Monday sequence. Each step is individually resumable: re-runs
 * skip resolved drafts (status), existing boards (per-member), existing
 * streams (already_resolved), existing battles (today's-battle guard).
 */
export async function runMondayPipeline(db, {
  now = new Date(), anthropic = null, fetchImpl = fetch, budget = null,
  state = null, deployEnabled = TOURNAMENT_DEPLOY_ENABLED, pacingMs = DEPLOY_PACING_MS,
  includeDevGroups = false, pacing = null,
} = {}) {
  // Advancement catch-up (ruled): a Friday that crashed or stayed
  // banking-pending finishes here — idempotent, no-op when complete. Its
  // pending/error counts are logged, not folded into the Monday marker.
  const catchUp = await runFridayAdvancement(db, { now, includeDevGroups });
  if (catchUp.groups > 0 || catchUp.activeBrackets > 0) {
    console.log(`${LOG_PREFIX} Monday advancement catch-up: ${catchUp.gamesLocked} game(s) locked, ${catchUp.composedGroups.length} group(s) composed, ${catchUp.bankingPending} banking-pending, ${catchUp.frozen ?? 0} frozen, ${catchUp.errors} error(s)`);
  }

  // Slice 3: training pods are excluded from the ranked duties — their agent
  // layer is owned solely by activateTrainingPod (the flip paths + the morning
  // backstop). Without this, resolveGroupAgents here would mis-resolve a training
  // human seat to the RANKED agent and deploy it into the training groupId.
  const [formingAll, battle] = await Promise.all([
    fetchEligibleGroupsByStatus(db, GROUP_STATUS.FORMING, { includeDev: includeDevGroups, excludeTraining: true }),
    fetchEligibleGroupsByStatus(db, GROUP_STATUS.BATTLE, { includeDev: includeDevGroups, excludeTraining: true }),
  ]);
  // Competitive Live Draft (LEAGUE_LIVE_DRAFT): a slot group sits in FORMING
  // awaiting its SCHEDULED draft fire (a standalone cron), NOT this Monday
  // single-shot resolve — otherwise a Monday-morning tick would steal a
  // Mon-8:45am slot group before it fires. A 1–3-human slot group is already
  // excluded upstream (fetchEligibleGroupsByStatus drops players.length !==
  // GROUP_SIZE); this guard covers the FULL 4-human case that passes that
  // filter. Flag-INDEPENDENT (keys on the group field), and byte-identical
  // flag-off (no isLiveDraft group exists until LEAGUE_LIVE_DRAFT is on).
  const forming = formingAll.filter((g) => g.isLiveDraft !== true);
  const groups = [...forming, ...battle];

  const summary = {
    groups: groups.length,
    resolved: 0,
    autoCommitted: 0,    // P5: boards defaulted at the Monday deadline
    deferredBoards: 0,   // finding #5 fallback: auto-commit couldn't heal
    refusedSynthetic: 0, // P3a contract: synthetic > 0 on a real group
    drafted: 0,
    deploys: { deployed: 0, skipped: 0, gated: 0, skippedExisting: 0, cooled: 0, failed: 0, deferred: 0 },
    deferredToNextTick: 0,
    errors: 0,
  };
  if (groups.length === 0) return summary;

  const dutyState = state ?? await readOrchestratorState(db);
  const pacingState = pacing ?? { lastSentAt: 0 }; // shared with the tick's sweep when passed; else duty-scoped

  for (let i = 0; i < groups.length; i++) {
    if (budget && Date.now() - budget.startMs > budget.deadlineMs) {
      summary.deferredToNextTick = groups.length - i;
      console.log(`${LOG_PREFIX} time budget reached — ${summary.deferredToNextTick} group(s) deferred to next tick`);
      break;
    }
    let group = groups[i];
    try {
      // ---- Step 1: user draft (forming → battle) ----
      if (group.status === GROUP_STATUS.FORMING) {
        try {
          group = await resolveUserDraftAndRefresh(db, group.id, now);
          summary.resolved++;
          console.log(`${LOG_PREFIX} group ${group.id}: user draft resolved → battle`);
        } catch (err) {
          if (err?.message !== `${USER_DRAFT_SENTINEL_PREFIX}boards_missing`) throw err;
          // P5 (ratified deadline): encountering an uncommitted board here
          // IS the deadline — auto-commit the server-derived prefill through
          // the same commit core (rider #1, autoCommitted flag + feed entry)
          // and retry the resolution in the same tick. Finding #5's loud
          // defer remains the fallback when auto-commit cannot produce a
          // valid board (the marker stays withheld; the next tick retries).
          // A seat covered by a race-window player commit counts toward
          // coverage but never toward autoCommitted — the corpus signal
          // stays honest.
          const auto = await autoCommitMissingBoards(db, group, { now });
          summary.autoCommitted += auto.committed;
          const covered = auto.committed + auto.raced;
          if (auto.errors > 0 || covered < auto.missing) {
            console.error(`${LOG_PREFIX} group ${group.id}: USER BOARDS NOT COMMITTED and the deadline auto-commit could not heal (${covered}/${auto.missing} covered, ${auto.errors} error(s)) — Monday pipeline DEFERRED for this group (finding #5 fallback).`);
            summary.deferredBoards++;
            continue;
          }
          try {
            group = await resolveUserDraftAndRefresh(db, group.id, now);
            summary.resolved++;
            console.log(`${LOG_PREFIX} group ${group.id}: user draft resolved → battle after deadline auto-commit (${auto.committed} board(s) defaulted${auto.floored ? `, ${auto.floored} floored` : ''}${auto.raced ? `, ${auto.raced} raced` : ''})`);
          } catch (retryErr) {
            console.error(`${LOG_PREFIX} group ${group.id}: USER BOARDS NOT COMMITTED — resolution retry after auto-commit FAILED (${retryErr.message}) — Monday pipeline DEFERRED for this group.`);
            summary.deferredBoards++;
            continue;
          }
        }
      }
      if (group.status !== GROUP_STATUS.BATTLE) continue;

      // ---- Step 2: agent boards (refuse synthetic on a real group —
      // EVERY tick: produceGroupBoards counts pre-existing synthetic
      // boards on the skip path, so the refusal can never be one-shot) ----
      const boards = await produceGroupBoards(db, group, { anthropic, now });
      if (boards.synthetic > 0) {
        console.error(`${LOG_PREFIX} group ${group.id}: REFUSING PIPELINE — ${boards.synthetic} SYNTHETIC board(s) on a real group (missing agent registration; P3a contract, tournamentAgentBoards.js). Founder attention required.`);
        summary.refusedSynthetic++;
        continue;
      }
      if (boards.errors > 0) {
        console.error(`${LOG_PREFIX} group ${group.id}: ${boards.errors} board production error(s) — agent draft would refuse; retrying next tick`);
        summary.errors++;
        continue;
      }

      // ---- Step 3: agent draft + 24-held verification ----
      const draft = await resolveAgentDraftForGroup(db, group, { now });
      if (draft.status === 'acquisition_conflict') {
        console.error(`${LOG_PREFIX} group ${group.id}: ACQUISITION CONFLICT — founder attention, never blind retry:`, JSON.stringify(draft.conflicts));
        summary.errors++;
        continue;
      }
      if (draft.heldCount !== AGENT_MARKET_SIZE) {
        console.error(`${LOG_PREFIX} group ${group.id}: held-count ${draft.heldCount} ≠ ${AGENT_MARKET_SIZE} — deploy fan-out withheld`);
        summary.errors++;
        continue;
      }
      summary.drafted++;

      // ---- Step 4: deploy fan-out [P4-gated] ----
      const seats = await seatsFromDraftStream(db, group);
      if (!seats) {
        console.error(`${LOG_PREFIX} group ${group.id}: agent-draft stream missing after resolution — retrying next tick`);
        summary.errors++;
        continue;
      }
      await attachRiderSix(db, group, seats);
      const fanout = await fanOutDeploys(db, {
        groupId: group.id, seats, now, state: dutyState, budget, fetchImpl, deployEnabled, pacing: pacingState, pacingMs,
      });
      for (const key of Object.keys(summary.deploys)) summary.deploys[key] += fanout[key];
      console.log(`${LOG_PREFIX} group ${group.id}: Monday pipeline done — drafted six per agent; deploys: ${JSON.stringify(fanout)}`);
    } catch (err) {
      console.error(`${LOG_PREFIX} group ${group.id}: Monday pipeline FAILED:`, err.message);
      summary.errors++;
    }
  }
  return summary;
}

// ==================== TUE–FRI INCUMBENT FAN-OUT ====================

export async function runWeekdayFanout(db, {
  now = new Date(), fetchImpl = fetch, budget = null,
  state = null, deployEnabled = TOURNAMENT_DEPLOY_ENABLED, pacingMs = DEPLOY_PACING_MS,
  includeDevGroups = false, pacing = null,
} = {}) {
  // Slice 3: exclude training pods — activateTrainingPod owns their agent layer.
  const groups = await fetchEligibleGroupsByStatus(db, GROUP_STATUS.BATTLE, { includeDev: includeDevGroups, excludeTraining: true });
  const summary = {
    groups: groups.length,
    noBattles: 0,
    mondayCatchupSeats: 0,
    deploys: { deployed: 0, skipped: 0, gated: 0, skippedExisting: 0, cooled: 0, failed: 0, deferred: 0 },
    deferredToNextTick: 0,
    errors: 0,
  };
  if (groups.length === 0) return summary;

  const dutyState = state ?? await readOrchestratorState(db);
  // Shared with the same-tick training-activation sweep (when the tick passes
  // one) so the ≥20s deploy floor holds ACROSS both, not just within each.
  const pacingState = pacing ?? { lastSentAt: 0 };

  for (let i = 0; i < groups.length; i++) {
    if (budget && Date.now() - budget.startMs > budget.deadlineMs) {
      summary.deferredToNextTick = groups.length - i;
      console.log(`${LOG_PREFIX} time budget reached — ${summary.deferredToNextTick} group(s) deferred to next tick`);
      break;
    }
    const group = groups[i];
    try {
      const latest = await latestTournamentBattlesByAgent(db, group.id);
      if (latest.size === 0 && !deployEnabled) {
        // Pre-P4 steady state: tournament battles don't exist yet (ruled).
        console.log(`${LOG_PREFIX} group ${group.id}: no tournament battles yet (P4 pending) — nothing to fan out`);
        summary.noBattles++;
        continue;
      }

      const counters = { errors: 0, catchupSeats: 0 };
      const seats = await buildIncumbentSeats(db, group, latest, counters);
      summary.errors += counters.errors;
      summary.mondayCatchupSeats += counters.catchupSeats;
      await attachRiderSix(db, group, seats);

      const fanout = await fanOutDeploys(db, {
        groupId: group.id, seats, now, state: dutyState, budget, fetchImpl, deployEnabled, pacing: pacingState, pacingMs,
        latestBattles: latest,
      });
      for (const key of Object.keys(summary.deploys)) summary.deploys[key] += fanout[key];
    } catch (err) {
      console.error(`${LOG_PREFIX} group ${group.id}: incumbent fan-out FAILED:`, err.message);
      summary.errors++;
    }
  }
  return summary;
}

// ==================== INCUMBENT SEATS (shared) ====================

/**
 * Assemble a group's deploy seats from its incumbents (the latest flat6 battle
 * per agent — the fenced read-only flattenPortfolioServer) PLUS a draft-stream
 * catch-up for any agent with no battle yet (the first-day deploy, or a prior
 * failed deploy that keeps retrying instead of vanishing from the incumbent
 * query). Mutates `counters` ({errors, catchupSeats}); returns the member-ordered
 * seats (rider-six NOT yet attached). ONE home for the incumbent contract, shared
 * by runWeekdayFanout (ranked Tue–Fri) and activateTrainingPod (training daily).
 */
async function buildIncumbentSeats(db, group, latest, counters) {
  const cpuByUser = new Map((group.players || []).map(p => [p.odUserId, p.isCpu === true]));
  const memberOrder = group.groupMembers || [];
  const seats = [];
  for (const battle of latest.values()) {
    const symbols = flattenPortfolioServer(battle.portfolio).map(a => a.symbol).filter(Boolean);
    if (symbols.length === 0) {
      // Never a silent drop: an empty/missing portfolio on the latest battle is
      // schema drift — loud, counted, marker withheld.
      console.error(`${LOG_PREFIX} group ${group.id} agent ${battle.agentId}: latest battle ${battle.id} has an empty portfolio — seat skipped LOUDLY (founder attention)`);
      counters.errors++;
      continue;
    }
    seats.push({ agentId: battle.agentId, odUserId: battle.ownerId, isCpu: cpuByUser.get(battle.ownerId) === true, symbols });
  }
  const memberAgentIds = new Set(latest.keys());
  const draftSeats = await seatsFromDraftStream(db, group);
  if (draftSeats) {
    for (const seat of draftSeats) {
      if (!memberAgentIds.has(seat.agentId)) {
        console.log(`${LOG_PREFIX} group ${group.id} agent ${seat.agentId}: no battle yet — falling back to the drafted six (catch-up)`);
        seats.push(seat);
        counters.catchupSeats++;
      }
    }
  }
  seats.sort((a, b) => memberOrder.indexOf(a.odUserId) - memberOrder.indexOf(b.odUserId));
  return seats;
}

// ==================== TRAINING ACTIVATION (Slice 3) ====================
//
// League Training Slice 3 — the agent layer for a training pod, end to end. The
// user layer (Slices 1–2) flips a pod to BATTLE; THIS provisions the per-pod
// clone(s), produces the agent draft ONCE, and deploys a FRESH daily battle for
// each of the pod's five days — the same flat6 machinery ranked uses
// (produceGroupBoards → resolveAgentDraftForGroup → fanOutDeploys → POST
// /api/agent/decide → createAgentBattle). Lives here (not trainingLifecycle)
// because the deploy machinery is module-private — and orchestrator already
// imports trainingLifecycle, so the reverse import would be a cycle.
//
// DAILY REDEPLOY (the load-bearing bit): training pods are ROLLING (any start
// day, spanning weekends/Mondays), so they CANNOT ride the ranked Monday-draft /
// Tue–Fri-redeploy split — both ranked duties pass excludeTraining:true. Instead
// the morning backstop (sweepTrainingActivation) runs THIS every weekday tick:
// the draft is produced once (stream-exists short-circuit), and each day it
// redeploys the incumbents (buildIncumbentSeats) so the agent's composite half
// accrues across all five days, exactly like ranked. The fanOutDeploys
// today's-battle-exists guard makes same-day re-runs (multiple ticks, or the
// inline endpoint racing the sweep) a no-op — at most one fresh battle per agent
// per day; decide.js's one-active-battle check is the final serialization against
// a true double-battle, as for ranked.
//
// Called from BOTH paths: the live-pick inline endpoint
// (api/tournament/activate-training-pod.js, the prompt fast-lane) and the morning
// backstop. Idempotent throughout (provisioned clone, existing board/stream, the
// today's-battle guard).

/**
 * Provision + draft (once) + deploy TODAY's battle for ONE training BATTLE pod.
 * Idempotent and safe to call every weekday tick. Returns
 * { groupId, clones, drafted, deploys, errors }.
 */
export async function activateTrainingPod(db, group, {
  now = new Date(), anthropic = null, fetchImpl = fetch, budget = null,
  state = null, deployEnabled = TOURNAMENT_DEPLOY_ENABLED, pacingMs = DEPLOY_PACING_MS,
  pacing = null,
} = {}) {
  const summary = {
    groupId: group.id,
    clones: { created: 0, existing: 0, skipped: 0 },
    drafted: false,
    deploys: { deployed: 0, skipped: 0, gated: 0, skippedExisting: 0, cooled: 0, failed: 0, deferred: 0 },
    errors: 0,
  };
  if (group.isTraining !== true || group.status !== GROUP_STATUS.BATTLE) {
    console.warn(`${LOG_PREFIX} activateTrainingPod: group ${group.id} is not a training BATTLE pod (isTraining=${group.isTraining}, status=${group.status}) — skipped`);
    return summary;
  }

  const dutyState = state ?? await readOrchestratorState(db);
  const pacingState = pacing ?? { lastSentAt: 0 };

  try {
    // 1. Provision the per-pod human clone(s) — CPU system agents already exist
    // from formation. Idempotent (deterministic doc id). Slice 5b-ii: thread the
    // group-level loadout override (odUserId → spec, written at formation); absent
    // → ensureTrainingClones pure-inherits the ranked loadout (Slice 3).
    const clones = await ensureTrainingClones(db, group, { loadoutSpecByUser: group.loadoutSpecByUser, now });
    summary.clones = { created: clones.created.length, existing: clones.existing.length, skipped: clones.skipped.length };

    // 2. Produce the agent draft ONCE — the stream is the durable draft record.
    // Subsequent days short-circuit here and redeploy the incumbents (step 3).
    const streamRef = db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(group.id)
      .collection(STREAMS_SUBCOLLECTION).doc(AGENT_DRAFT_STREAM_DOC_ID);
    const streamSnap = await streamRef.get();
    if (!streamSnap.exists) {
      // Boards — the human clone runs the real Sonnet board (Flag 3); CPUs take
      // the deterministic fallback. Existing boards are skipped (no re-spend).
      const boards = await produceGroupBoards(db, group, { anthropic, now });
      if (boards.errors > 0) {
        console.error(`${LOG_PREFIX} training pod ${group.id}: ${boards.errors} board production error(s) — retrying next tick`);
        summary.errors++;
        return summary;
      }
      if (boards.synthetic > 0) {
        // A human seat with no ranked agent (clone skipped). Loud, but a no-stakes
        // pod still deploys what it can (CPUs + any real clones); that synthetic
        // seat simply won't create a battle.
        console.warn(`${LOG_PREFIX} training pod ${group.id}: ${boards.synthetic} synthetic board(s) — a human seat has no ranked agent and will not deploy.`);
      }
      const draft = await resolveAgentDraftForGroup(db, group, { now });
      if (draft.status === 'acquisition_conflict') {
        console.error(`${LOG_PREFIX} training pod ${group.id}: ACQUISITION CONFLICT — founder attention, never blind retry:`, JSON.stringify(draft.conflicts));
        summary.errors++;
        return summary;
      }
      if (draft.heldCount !== AGENT_MARKET_SIZE) {
        console.error(`${LOG_PREFIX} training pod ${group.id}: held-count ${draft.heldCount} ≠ ${AGENT_MARKET_SIZE} — deploy fan-out withheld`);
        summary.errors++;
        return summary;
      }
      summary.drafted = true;
    }

    // 3. Deploy TODAY's battle: incumbents (the daily redeploy) + a drafted-six
    // catch-up for any agent with no battle yet (the flip-day first deploy). The
    // today's-battle guard inside fanOutDeploys makes same-day re-runs a no-op.
    const latest = await latestTournamentBattlesByAgent(db, group.id);
    const counters = { errors: 0, catchupSeats: 0 };
    const seats = await buildIncumbentSeats(db, group, latest, counters);
    summary.errors += counters.errors;
    if (seats.length === 0) {
      console.warn(`${LOG_PREFIX} training pod ${group.id}: no deployable seats (no incumbents, no draft stream) — nothing to deploy`);
      return summary;
    }
    await attachRiderSix(db, group, seats);
    const fanout = await fanOutDeploys(db, {
      groupId: group.id, seats, now, state: dutyState, budget, fetchImpl, deployEnabled,
      pacing: pacingState, pacingMs, latestBattles: latest,
    });
    for (const key of Object.keys(summary.deploys)) summary.deploys[key] += fanout[key];
    console.log(`${LOG_PREFIX} training pod ${group.id}: activated — clones ${JSON.stringify(summary.clones)}; deploys ${JSON.stringify(fanout)}`);
  } catch (err) {
    console.error(`${LOG_PREFIX} training pod ${group.id}: activation FAILED:`, err.message);
    summary.errors++;
  }
  return summary;
}

/**
 * Morning backstop: run activateTrainingPod for EVERY training BATTLE pod, every
 * weekday tick. The first run drafts + deploys day 1; each later day redeploys
 * the incumbents so the pod's agent layer accrues all five days (training is
 * rolling, so it can't ride the ranked Mon/Tue–Fri split). Idempotent — the
 * stream short-circuit + the today's-battle guard make same-day re-runs cheap
 * no-ops; also recovers a lost inline trigger. `pacing` is shared with the duty
 * (when the tick passes one) so the ≥20s deploy floor holds across both. Returns
 * { swept, activated, deferred, errors }.
 */
export async function sweepTrainingActivation(db, {
  now = new Date(), anthropic = null, fetchImpl = fetch, budget = null,
  state = null, deployEnabled = TOURNAMENT_DEPLOY_ENABLED, pacingMs = DEPLOY_PACING_MS,
  includeDev = false, pacing = null,
} = {}) {
  const battle = await fetchEligibleGroupsByStatus(db, GROUP_STATUS.BATTLE, { includeDev });
  const training = battle.filter(g => g.isTraining === true);
  const summary = { swept: training.length, activated: 0, deferred: 0, errors: 0 };
  if (training.length === 0) return summary;

  const dutyState = state ?? await readOrchestratorState(db);
  const pacingState = pacing ?? { lastSentAt: 0 };
  for (let i = 0; i < training.length; i++) {
    if (budget && Date.now() - budget.startMs > budget.deadlineMs) {
      summary.deferred = training.length - i;
      console.log(`${LOG_PREFIX} training activation: time budget reached — ${summary.deferred} pod(s) deferred to next tick`);
      break;
    }
    const res = await activateTrainingPod(db, training[i], {
      now, anthropic, fetchImpl, budget, state: dutyState, deployEnabled, pacingMs, pacing: pacingState,
    });
    if (res.errors > 0) summary.errors += res.errors;
    else summary.activated++;
  }
  return summary;
}

// ==================== THE TICK ====================

/** Is this duty pass fully done (nothing deferred) — i.e., marker-worthy? */
export function isDutySatisfied(duty, summary) {
  if (summary.errors > 0 || summary.deferredToNextTick > 0) return false;
  if (duty === DUTY.MONDAY_PIPELINE) {
    return summary.deferredBoards === 0 && summary.refusedSynthetic === 0
      && summary.deploys.cooled === 0 && summary.deploys.deferred === 0 && summary.deploys.failed === 0;
  }
  if (duty === DUTY.WEEKDAY_FANOUT) {
    return summary.deploys.cooled === 0 && summary.deploys.deferred === 0 && summary.deploys.failed === 0;
  }
  if (duty === DUTY.FRIDAY_ADVANCEMENT) {
    // Emergency freeze (TOURNAMENT_ADVANCEMENT_FROZEN): a frozen pass withheld
    // finalization, so it is NOT done — never mark it satisfied (re-ticks
    // harmlessly until the flag lifts). Flag-off, summary.frozen is 0 → no change.
    return summary.bankingPending === 0 && (summary.frozen || 0) === 0;
  }
  return false;
}

/** One-line marker summary — the state doc stays small. */
function markerSummary(duty, summary) {
  if (duty === DUTY.FRIDAY_ADVANCEMENT) {
    return {
      groups: summary.groups,
      gamesLocked: summary.gamesLocked,
      composed: summary.composedGroups.length,
      champion: summary.champion?.odUserId ?? null,
      // Surfaced so the "incomplete (resumes next tick)" log line shows the
      // freeze explicitly (duty summaries must say what actually happened).
      frozen: summary.frozen ?? 0,
    };
  }
  return {
    groups: summary.groups,
    deployed: summary.deploys?.deployed ?? 0,
    skipped: summary.deploys?.skipped ?? 0,
    gated: summary.deploys?.gated ?? 0,
  };
}

/**
 * One cron tick: route by ET, honor the duty marker, run the duty, set the
 * marker when satisfied. `forceDuty` + an injected `now` with
 * `simulated: true` are the dev surface's time controls (the P1b idiom) —
 * production ticks pass none of them. Simulated runs read AND write markers
 * only in the 'sim:' namespace.
 */
export async function runOrchestratorTick(db, {
  now = new Date(), anthropic = null, fetchImpl = fetch, forceDuty = null, simulated = false,
  includeDevGroups = false,
  deployEnabled = TOURNAMENT_DEPLOY_ENABLED, pacingMs = DEPLOY_PACING_MS,
} = {}) {
  const routed = getDutyForInstant(now);
  const duty = forceDuty || routed.duty;
  const tag = `${LOG_PREFIX} ${routed.etDate} ${routed.etTime}${simulated ? ' [SIMULATED]' : ''}`;
  // Shared tick budget — the training-activation sweep (below) and the duty
  // dispatch draw from ONE deadline so the whole tick stays under the cron's
  // 300s ceiling (the activation sweep can run model boards + paced deploys).
  const budget = { startMs: Date.now(), deadlineMs: DUTY_DEADLINE_MS };
  // One pacing object shared by the training sweep AND the duty dispatch, so the
  // ≥20s deploy floor holds ACROSS them (both can deploy on the same WEEKDAY_FANOUT
  // tick — the sweep for training, the duty for ranked).
  const pacing = { lastSentAt: 0 };

  // League Training Slice 1 — awaiting-open flip. Training pods drafted on
  // demand wait in AWAITING_OPEN; any WEEKDAY-MORNING tick flips those whose
  // anchor DATE has arrived to BATTLE (date-based — the morning window is
  // pre-open in EST, so a timestamp compare would miss every winter). Placed
  // BEFORE the SKIP / already-complete short-circuits so duty idempotency never
  // gates it; its own catch so a flip failure never blocks the duty; AWAITING_
  // OPEN is training-only, so ranked/legacy are never seen. Zero new cron.
  if (routed.duty === DUTY.MONDAY_PIPELINE || routed.duty === DUTY.WEEKDAY_FANOUT) {
    // League Training Slice 2 — idle-draft sweep. Runs BEFORE the awaiting-open
    // flip so a pod auto-completed here (and whose anchor is today) is flipped to
    // BATTLE in this same tick by its own inline completion-flip; the flip below
    // then backstops any pod whose anchor lands on a later date. Own catch so a
    // sweep failure never blocks the duty; DRAFTING is training-only, so ranked/
    // legacy are never seen. Zero new cron.
    try {
      const sweep = await sweepIdleDraftingPods(db, { now, includeDev: includeDevGroups });
      if (sweep.completed > 0) {
        console.log(`${tag} idle-draft sweep: completed ${sweep.completed}, active ${sweep.active}`);
      }
    } catch (err) {
      console.error(`${tag} idle-draft sweep failed: ${err.message}`);
    }
    try {
      const flip = await flipAwaitingOpenPods(db, { now, includeDev: includeDevGroups });
      if (flip.flipped > 0 || flip.pending > 0) {
        console.log(`${tag} awaiting-open sweep: flipped ${flip.flipped}, pending ${flip.pending}`);
      }
    } catch (err) {
      console.error(`${tag} awaiting-open flip sweep failed: ${err.message}`);
    }
    // Training-Pod P0 R3 — rolling stale-pod backstop. Retires training pods
    // stranded pre-BATTLE past TRAINING_TUNING.POD_EXPIRY_STALE_MS (the FORMING-
    // orphan gap + idle-sweep/flip failures) to the terminal EXPIRED status —
    // never retro-advancing them. Runs AFTER the flip above so a pod that
    // legitimately advances this tick is gone before the sweep sees it; expireGroup's
    // state+version precondition closes the residual race by construction. Behind
    // POD_EXPIRY_SWEEP_ENABLED (default false → this block never runs, the tick is
    // byte-identical). Own catch so it never blocks the duty. Zero new cron.
    if (POD_EXPIRY_SWEEP_ENABLED) {
      try {
        const exp = await expireStaleTrainingPods(db, { now, includeDev: includeDevGroups });
        if (exp.expired > 0 || exp.errors > 0) {
          console.log(`${tag} pod-expiry sweep: expired ${exp.expired}, matched ${exp.matched}, skipped ${exp.skipped}, errors ${exp.errors}`);
        }
      } catch (err) {
        console.error(`${tag} pod-expiry sweep failed: ${err.message}`);
      }
    }
    // League Training Slice 3 — agent-layer activation + DAILY REDEPLOY. Once the
    // idle sweep + awaiting-open flip have landed training pods in BATTLE, this
    // drafts their agent layer once and deploys a FRESH battle every weekday tick
    // (training is rolling, so it can't ride the ranked Mon/Tue–Fri split). The
    // live-pick endpoint is the prompt fast-lane; this is the backstop + the
    // recurring redeploy. Own catch so it never blocks the duty; shares the tick
    // budget + pacing. Zero new cron.
    try {
      const act = await sweepTrainingActivation(db, { now, anthropic, fetchImpl, budget, includeDev: includeDevGroups, deployEnabled, pacingMs, pacing });
      if (act.activated > 0 || act.errors > 0) {
        console.log(`${tag} training activation sweep: activated ${act.activated}, deferred ${act.deferred}, errors ${act.errors}`);
      }
    } catch (err) {
      console.error(`${tag} training activation sweep failed: ${err.message}`);
    }
  }

  if (duty === DUTY.SKIP) {
    console.log(`${tag} duty=skip — outside the duty table (quiet tick)`);
    return { duty, etDate: routed.etDate, etTime: routed.etTime };
  }

  const state = await readOrchestratorState(db);
  if (isDutyComplete(state, routed.etDate, duty, { simulated })) {
    console.log(`${tag} duty=${duty} — already complete for ${routed.etDate} (idempotent no-op)`);
    return { duty, etDate: routed.etDate, etTime: routed.etTime, status: 'already_complete' };
  }

  console.log(`${tag} duty=${duty} — dispatching`);

  let summary;
  if (duty === DUTY.MONDAY_PIPELINE) {
    summary = await runMondayPipeline(db, { now, anthropic, fetchImpl, budget, state, includeDevGroups, deployEnabled, pacingMs, pacing });
  } else if (duty === DUTY.WEEKDAY_FANOUT) {
    summary = await runWeekdayFanout(db, { now, fetchImpl, budget, state, includeDevGroups, deployEnabled, pacingMs, pacing });
  } else if (duty === DUTY.FRIDAY_ADVANCEMENT) {
    summary = await runFridayAdvancement(db, { now, includeDevGroups });
  } else {
    console.error(`${tag} unknown duty '${duty}' — skipped`);
    return { duty: DUTY.SKIP, etDate: routed.etDate, etTime: routed.etTime };
  }

  if ((summary.groups ?? 0) === 0 && (summary.activeBrackets ?? 0) === 0) {
    // Production inertness: zero groups, zero writes, one quiet line.
    console.log(`${tag} duty=${duty} — zero groups (quiet skip)`);
    return { duty, etDate: routed.etDate, etTime: routed.etTime, ...summary };
  }

  const satisfied = isDutySatisfied(duty, summary);
  if (satisfied) {
    await markDutyComplete(db, routed.etDate, duty, markerSummary(duty, summary), now.toISOString(), { simulated });
  }
  console.log(`${tag} duty=${duty} — ${satisfied ? 'COMPLETE (marker set)' : 'incomplete (resumes next tick)'}: ${JSON.stringify(markerSummary(duty, summary))}`);
  return { duty, etDate: routed.etDate, etTime: routed.etTime, complete: satisfied, ...summary };
}
