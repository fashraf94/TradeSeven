// api/_utils/tournamentOrchestrator.js
//
// P3b — the Tournament Orchestrator (Spec §1.3; founder Ruling A, verbatim).
// One cron entry (vercel.json: */10 over the morning + Friday-evening UTC
// hour set, Mon–Fri) feeds this ET-aware dispatcher, which routes every tick
// through the ruled duty table:
//
//   Mon morning   → advancement catch-up check, then the per-group Monday
//                   pipeline: resolve user draft (committed boards required;
//                   else DEFER + LOUD LOG — finding #5: the deadline
//                   auto-commit is P5's, pre-launch required) → produce
//                   boards (REFUSE on synthetic > 0 — the P3a contract) →
//                   resolve agent draft → verify 24 held → deploy fan-out
//                   [P4-GATED].
//   Tue–Fri morn. → incumbent fan-out [P4-GATED]: the latest tournament
//                   battle's six via the FENCED-EXPORTED
//                   flattenPortfolioServer (read-only call, never edited).
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
// nothing deferred. Zero groups is a clean no-op: one quiet log line, ZERO
// writes (test-locked, the house pattern).
//
// TIME BUDGET (ruled): sequential with ≥20s pacing between REAL deploy
// calls (prices the 3/min rate limit until P4's exemption — no pacing burned
// while the gate holds); the remainder defers to the next tick at ~270s of
// the handler's 300s; a failed deploy defers that agent ≥10 min (the
// cooldown is consumed even on failure — priced in).
//
// DEPLOY STEP — BUILT COMPLETE, P4-GATED: the call plumbing targets
// `https://${VERCEL_PROJECT_PRODUCTION_URL}` (TOURNAMENT_DEPLOY_BASE_URL
// overrides) and sends `Authorization: Bearer CRON_SECRET` + the ownership
// assertion on every call from day one. Until P4 lands the prescribed-
// portfolio entry path in the fenced deploy, TOURNAMENT_DEPLOY_ENABLED stays
// false and every would-be call logs a loud "P4 pending" line instead —
// tournament battles (CPU and human alike) simply don't exist yet, as ruled.
// The payload fields below are the fence entry's shopping list (see the PR's
// P4 contract section).
//
// Imports the zero-import schema module from src/ under the revised June
// 2026 import rule (BUILD_RULES §4); the co-located test's real import of
// THIS module is the dependency-surface guard.

import {
  TOURNAMENT_GROUPS_COLLECTION,
  GROUP_STATUS,
  GROUP_SIZE,
  AGENT_MARKET_SIZE,
  TOURNAMENT_GAME_MODE,
  STREAMS_SUBCOLLECTION,
  AGENT_DRAFT_STREAM_DOC_ID,
} from '../../src/constants/leagueTournament.js';
import { getEtParts, formatEtDate } from './tournamentTime.js';
import { produceGroupBoards } from './tournamentAgentBoards.js';
import { resolveAgentDraftForGroup } from './tournamentAgentDraft.js';
// Endpoint-module import, the tournamentClaims.js precedent (hoisted
// function declarations both sides; no cycle — the endpoint never imports
// this module).
import { resolveUserDraftForGroup, USER_DRAFT_SENTINEL_PREFIX } from '../tournament/resolve-user-draft.js';
import { runFridayAdvancement } from './tournamentAdvancement.js';
// Fenced module EXPORT, called read-only — never edited (BUILD_RULES §1).
import { flattenPortfolioServer } from './agentScoring.js';

const LOG_PREFIX = '[Orchestrator]';

export const ORCHESTRATOR_COLLECTION = 'tournamentOrchestrator';
export const ORCHESTRATOR_STATE_DOC_ID = 'state';

// THE P4 GATE. P4 flips this to true in the same PR that lands the
// prescribed-portfolio entry path inside the fence — never earlier.
export const TOURNAMENT_DEPLOY_ENABLED = false;

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

export function dutyMarkerKey(etDate, duty) {
  return `${etDate}:${duty}`;
}

// ==================== STATE DOC ====================

function stateRef(db) {
  return db.collection(ORCHESTRATOR_COLLECTION).doc(ORCHESTRATOR_STATE_DOC_ID);
}

export async function readOrchestratorState(db) {
  const snap = await stateRef(db).get();
  return snap.exists ? snap.data() : { duties: {}, deployCooldowns: {} };
}

export function isDutyComplete(state, etDate, duty) {
  return state?.duties?.[dutyMarkerKey(etDate, duty)] != null;
}

/**
 * Set the per-duty/per-ET-date marker (grain one of the two-grain design),
 * pruning entries older than the retention window so the doc never grows
 * unbounded (YYYY-MM-DD prefixes compare lexicographically).
 */
export async function markDutyComplete(db, state, etDate, duty, summary, nowIso) {
  const cutoffMs = new Date(`${etDate}T00:00:00Z`).getTime() - STATE_RETENTION_DAYS * 86_400_000;
  const cutoffDate = new Date(cutoffMs).toISOString().slice(0, 10);
  const duties = {};
  for (const [key, value] of Object.entries(state?.duties || {})) {
    if (key.slice(0, 10) >= cutoffDate) duties[key] = value;
  }
  duties[dutyMarkerKey(etDate, duty)] = { completedAt: nowIso, ...summary };
  await stateRef(db).set({
    duties,
    deployCooldowns: state?.deployCooldowns || {},
    updatedAt: nowIso,
  });
}

async function setDeployCooldown(db, state, agentId, untilIso, nowIso) {
  const deployCooldowns = { ...(state?.deployCooldowns || {}), [agentId]: untilIso };
  state.deployCooldowns = deployCooldowns;
  await stateRef(db).set({
    duties: state?.duties || {},
    deployCooldowns,
    updatedAt: nowIso,
  });
}

// ==================== DEPLOY PLUMBING (built complete, P4-gated) ====================

export function deployBaseUrl() {
  if (process.env.TOURNAMENT_DEPLOY_BASE_URL) return process.env.TOURNAMENT_DEPLOY_BASE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return null;
}

/**
 * The deploy call, fully formed: internal-caller credentials
 * (Bearer CRON_SECRET — Spec §0.3) and the ownership assertion
 * (`ownerOdUserId`: the deploy must verify agent.ownerId matches) on every
 * call from day one. `prescribedPortfolio` + `gameMode` + `groupId` + the
 * CPU/passive marker are the P4 fence entry's intake (contract items #1/#5).
 */
export function buildDeployRequest({ agentId, odUserId, isCpu = false, groupId, symbols }) {
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
      ...(isCpu ? { isCpu: true } : {}),
    },
  };
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
 * incumbents the caller passes). Sequential, ≥20s pacing between REAL calls,
 * budget-deferred, per-agent natural guard (today's battle exists) and the
 * ≥10-min failure cooldown. While the P4 gate holds, every would-be call is
 * one loud "P4 pending" line and nothing is sent (and no pacing is burned).
 *
 * `seats` = [{agentId, odUserId, isCpu, symbols}] in groupMembers order.
 * Returns {deployed, gated, skippedExisting, cooled, failed, deferred}.
 */
export async function fanOutDeploys(db, { groupId, seats, now, state, budget, fetchImpl = fetch }) {
  const nowIso = now.toISOString();
  const etDate = formatEtDate(now);
  const out = { deployed: 0, gated: 0, skippedExisting: 0, cooled: 0, failed: 0, deferred: 0 };

  const latest = await latestTournamentBattlesByAgent(db, groupId, ['agentId', 'createdAt', 'gameMode']);

  let sentAny = false;
  for (const seat of seats) {
    const { agentId, odUserId, isCpu, symbols } = seat;

    // Natural guard: today's battle already exists for this agent.
    const battle = latest.get(agentId);
    if (battle && formatEtDate(new Date(battle.createdAt)) === etDate) {
      console.log(`${LOG_PREFIX} group ${groupId} agent ${agentId}: today's battle exists — deploy skipped (idempotent)`);
      out.skippedExisting++;
      continue;
    }

    const request = buildDeployRequest({ agentId, odUserId, isCpu, groupId, symbols });

    if (!TOURNAMENT_DEPLOY_ENABLED) {
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
    if (budget && Date.now() - budget.startMs > budget.deadlineMs - DEPLOY_PACING_MS) {
      console.log(`${LOG_PREFIX} group ${groupId}: time budget reached — ${seats.length - seats.indexOf(seat)} deploy(s) deferred to next tick`);
      out.deferred += seats.length - seats.indexOf(seat);
      break;
    }
    if (sentAny) await sleep(DEPLOY_PACING_MS);

    try {
      const response = await fetchImpl(request.url, {
        method: 'POST',
        headers: request.headers,
        body: JSON.stringify(request.body),
      });
      sentAny = true;
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status} ${text.slice(0, 200)}`);
      }
      console.log(`${LOG_PREFIX} group ${groupId} agent ${agentId}: deployed [${symbols.join(', ')}]`);
      out.deployed++;
    } catch (err) {
      sentAny = true;
      const untilIso = new Date(now.getTime() + DEPLOY_FAILURE_COOLDOWN_MS).toISOString();
      console.error(`${LOG_PREFIX} group ${groupId} agent ${agentId}: deploy FAILED (${err.message}) — cooldown until ${untilIso}`);
      await setDeployCooldown(db, state, agentId, untilIso, nowIso);
      out.failed++;
    }
  }
  return out;
}

// ==================== GROUP QUERIES ====================

async function fetchGroupsByStatus(db, status) {
  const snap = await db.collection(TOURNAMENT_GROUPS_COLLECTION)
    .where('status', '==', status)
    .get();
  const groups = [];
  snap.forEach(doc => {
    const data = doc.data();
    if (data.players?.length === GROUP_SIZE) groups.push({ id: doc.id, ...data });
  });
  return groups;
}

// ==================== MONDAY PIPELINE ====================

/**
 * Per-group Monday sequence. Each step is individually resumable: re-runs
 * skip resolved drafts (status), existing boards (per-member), existing
 * streams (already_resolved), existing battles (today's-battle guard).
 */
export async function runMondayPipeline(db, { now = new Date(), anthropic = null, fetchImpl = fetch, budget = null } = {}) {
  // Advancement catch-up (ruled): a Friday that crashed or stayed
  // banking-pending finishes here — idempotent, no-op when complete. Its
  // pending/error counts are logged, not folded into the Monday marker.
  const catchUp = await runFridayAdvancement(db, { now });
  if (catchUp.groups > 0) {
    console.log(`${LOG_PREFIX} Monday advancement catch-up: ${catchUp.gamesLocked} game(s) locked, ${catchUp.composedGroups.length} group(s) composed, ${catchUp.bankingPending} banking-pending, ${catchUp.errors} error(s)`);
  }

  const [forming, battle] = await Promise.all([
    fetchGroupsByStatus(db, GROUP_STATUS.FORMING),
    fetchGroupsByStatus(db, GROUP_STATUS.BATTLE),
  ]);
  const groups = [...forming, ...battle];

  const summary = {
    groups: groups.length,
    resolved: 0,
    deferredBoards: 0,   // finding #5: committed user boards missing
    refusedSynthetic: 0, // P3a contract: synthetic > 0 on a real group
    drafted: 0,
    deploys: { deployed: 0, gated: 0, skippedExisting: 0, cooled: 0, failed: 0, deferred: 0 },
    deferredToNextTick: 0,
    errors: 0,
  };
  if (groups.length === 0) return summary;

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
          await resolveUserDraftForGroup(db, group.id, { now });
          summary.resolved++;
          const fresh = await db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(group.id).get();
          group = { id: group.id, ...fresh.data() };
          console.log(`${LOG_PREFIX} group ${group.id}: user draft resolved → battle`);
        } catch (err) {
          if (err?.message === `${USER_DRAFT_SENTINEL_PREFIX}boards_missing`) {
            // Finding #5 (ruled): defer + LOUD log. The deadline
            // auto-commit is P5's, pre-launch required.
            console.error(`${LOG_PREFIX} group ${group.id}: USER BOARDS NOT COMMITTED — Monday pipeline DEFERRED for this group (finding #5; auto-commit lands at P5). ${err.detail ?? ''}`);
            summary.deferredBoards++;
            continue;
          }
          throw err;
        }
      }
      if (group.status !== GROUP_STATUS.BATTLE) continue;

      // ---- Step 2: agent boards (refuse synthetic on a real group) ----
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
      // The stream doc is THE resolution record (P3a): picksByAgent for the
      // prescribed six, events for the agentId→owner mapping.
      const streamSnap = await db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(group.id)
        .collection(STREAMS_SUBCOLLECTION).doc(AGENT_DRAFT_STREAM_DOC_ID).get();
      if (!streamSnap.exists) {
        console.error(`${LOG_PREFIX} group ${group.id}: agent-draft stream missing after resolution — retrying next tick`);
        summary.errors++;
        continue;
      }
      const stream = streamSnap.data();
      const ownerByAgent = {};
      for (const event of stream.events || []) ownerByAgent[event.agentId] = event.odUserId;
      const cpuByUser = new Map((group.players || []).map(p => [p.odUserId, p.isCpu === true]));
      const memberOrder = group.groupMembers || [];
      const seats = Object.entries(stream.picksByAgent || {})
        .map(([agentId, symbols]) => ({
          agentId,
          odUserId: ownerByAgent[agentId],
          isCpu: cpuByUser.get(ownerByAgent[agentId]) === true,
          symbols,
        }))
        .sort((a, b) => memberOrder.indexOf(a.odUserId) - memberOrder.indexOf(b.odUserId));

      const state = await readOrchestratorState(db);
      const fanout = await fanOutDeploys(db, { groupId: group.id, seats, now, state, budget, fetchImpl });
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

export async function runWeekdayFanout(db, { now = new Date(), fetchImpl = fetch, budget = null } = {}) {
  const groups = await fetchGroupsByStatus(db, GROUP_STATUS.BATTLE);
  const summary = {
    groups: groups.length,
    noBattles: 0,
    deploys: { deployed: 0, gated: 0, skippedExisting: 0, cooled: 0, failed: 0, deferred: 0 },
    deferredToNextTick: 0,
    errors: 0,
  };
  if (groups.length === 0) return summary;

  for (let i = 0; i < groups.length; i++) {
    if (budget && Date.now() - budget.startMs > budget.deadlineMs) {
      summary.deferredToNextTick = groups.length - i;
      console.log(`${LOG_PREFIX} time budget reached — ${summary.deferredToNextTick} group(s) deferred to next tick`);
      break;
    }
    const group = groups[i];
    try {
      const latest = await latestTournamentBattlesByAgent(db, group.id);
      if (latest.size === 0) {
        // Pre-P4 steady state: tournament battles don't exist yet (ruled).
        console.log(`${LOG_PREFIX} group ${group.id}: no tournament battles yet (P4 pending) — nothing to fan out`);
        summary.noBattles++;
        continue;
      }
      const cpuByUser = new Map((group.players || []).map(p => [p.odUserId, p.isCpu === true]));
      const memberOrder = group.groupMembers || [];
      const seats = [...latest.values()]
        .map(battle => ({
          agentId: battle.agentId,
          odUserId: battle.ownerId,
          isCpu: cpuByUser.get(battle.ownerId) === true,
          // The incumbent six — fenced flattenPortfolioServer, read-only.
          symbols: flattenPortfolioServer(battle.portfolio).map(a => a.symbol).filter(Boolean),
        }))
        .filter(seat => seat.symbols.length > 0)
        .sort((a, b) => memberOrder.indexOf(a.odUserId) - memberOrder.indexOf(b.odUserId));

      const state = await readOrchestratorState(db);
      const fanout = await fanOutDeploys(db, { groupId: group.id, seats, now, state, budget, fetchImpl });
      for (const key of Object.keys(summary.deploys)) summary.deploys[key] += fanout[key];
    } catch (err) {
      console.error(`${LOG_PREFIX} group ${group.id}: incumbent fan-out FAILED:`, err.message);
      summary.errors++;
    }
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
    return summary.bankingPending === 0;
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
    };
  }
  return {
    groups: summary.groups,
    deployed: summary.deploys?.deployed ?? 0,
    gated: summary.deploys?.gated ?? 0,
  };
}

/**
 * One cron tick: route by ET, honor the duty marker, run the duty, set the
 * marker when satisfied. `forceDuty` + an injected `now` are the dev
 * surface's time controls (the P1b idiom) — production ticks pass neither.
 */
export async function runOrchestratorTick(db, { now = new Date(), anthropic = null, fetchImpl = fetch, forceDuty = null } = {}) {
  const routed = getDutyForInstant(now);
  const duty = forceDuty || routed.duty;
  const tag = `${LOG_PREFIX} ${routed.etDate} ${routed.etTime}`;

  if (duty === DUTY.SKIP) {
    console.log(`${tag} duty=skip — outside the duty table (quiet tick)`);
    return { duty, etDate: routed.etDate, etTime: routed.etTime };
  }

  const state = await readOrchestratorState(db);
  if (isDutyComplete(state, routed.etDate, duty)) {
    console.log(`${tag} duty=${duty} — already complete for ${routed.etDate} (idempotent no-op)`);
    return { duty, etDate: routed.etDate, etTime: routed.etTime, status: 'already_complete' };
  }

  console.log(`${tag} duty=${duty} — dispatching`);
  const budget = { startMs: Date.now(), deadlineMs: DUTY_DEADLINE_MS };

  let summary;
  if (duty === DUTY.MONDAY_PIPELINE) {
    summary = await runMondayPipeline(db, { now, anthropic, fetchImpl, budget });
  } else if (duty === DUTY.WEEKDAY_FANOUT) {
    summary = await runWeekdayFanout(db, { now, fetchImpl, budget });
  } else if (duty === DUTY.FRIDAY_ADVANCEMENT) {
    summary = await runFridayAdvancement(db, { now });
  } else {
    console.error(`${tag} unknown duty '${duty}' — skipped`);
    return { duty: DUTY.SKIP, etDate: routed.etDate, etTime: routed.etTime };
  }

  if (summary.groups === 0) {
    // Production inertness: zero groups, zero writes, one quiet line.
    console.log(`${tag} duty=${duty} — zero groups (quiet skip)`);
    return { duty, etDate: routed.etDate, etTime: routed.etTime, ...summary };
  }

  const satisfied = isDutySatisfied(duty, summary);
  if (satisfied) {
    await markDutyComplete(db, state, routed.etDate, duty, markerSummary(duty, summary), now.toISOString());
  }
  console.log(`${tag} duty=${duty} — ${satisfied ? 'COMPLETE (marker set)' : 'incomplete (resumes next tick)'}: ${JSON.stringify(markerSummary(duty, summary))}`);
  return { duty, etDate: routed.etDate, etTime: routed.etTime, complete: satisfied, ...summary };
}
