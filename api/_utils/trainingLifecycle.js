// api/_utils/trainingLifecycle.js
//
// League Next-Arc — League Training Slice 1: the lifecycle plumbing for the
// no-stakes, ON-DEMAND training pod (Spec V1.1 §3/§10, dark behind
// LEAGUE_NEXT_ARC_ENABLED). Three concerns, all non-fenced, all training-only:
//
//   (a) FORM-AND-LAUNCH (formAndLaunchTrainingPod): on tap, form the CPU-padded
//       isTraining pod (reusing quickPlay), seat the solo human's board via the
//       SAME orchestrator deadline fallback (autoCommitMissingBoards — the
//       interactive draft is Slice 2), then resolve the snake to AWAITING_OPEN
//       (not BATTLE) stamped with the next-market-open anchor.
//   (b) AWAITING-OPEN FLIP (flipAwaitingOpenPods): an orchestrator weekday-
//       MORNING sweep flips a pod to BATTLE once its anchor DATE has arrived.
//       DATE-based, never timestamp-based: the orchestrator morning window is
//       pre-open in EST (UTC 11–14 = 06:00–09:00 ET), so a timestamp compare
//       would never trip in winter and the pod would start a day late. The
//       day-1 baseline is captured at the nightly close (banking settles to
//       today's open), so flipping before 09:30 changes nothing about scoring.
//   (c) ROLLING-COMPLETION (completeBankedTrainingPods): the nightly daily-
//       scores host completes a training pod the night its 5th day banks, any
//       weekday — Friday advancement (tournamentAdvancement.js) stays the
//       idempotent backstop.
//
// SHARED-HOST SAFETY: AWAITING_OPEN is a training-only state and every sweep
// filters isTraining, so ranked/legacy groups are never seen or moved. The
// banker (tournamentBanking.js) is UNTOUCHED — an AWAITING_OPEN pod is not
// 'battle', so it is invisible to banking until the open. Zero new cron: (b)
// rides the orchestrator tick, (c) rides the daily-scores cron.
//
// Anchor rule mirrors the client getBattleStartDate (src/constants/battleTiming
// .js) — reproduced server-side here for Slice 1 (backlog: extract a shared
// Node-clean helper to retire the client/server twin). The NYSE calendar is
// REUSED from marketSchedule.js (never a third copy of the holiday list).
//
// Imports the zero-import schema module from src/ under the revised June 2026
// import rule (BUILD_RULES §4); the co-located test's real import of THIS
// module is the dependency-surface guard.

import { quickPlay } from './tournamentLobbyService.js';
import { resolveUserDraftForGroup } from '../tournament/resolve-user-draft.js';
import { autoCommitMissingBoards } from './tournamentBoardAutoCommit.js';
import {
  transitionStatus,
  fetchEligibleGroupsByStatus,
  getGroup,
} from './tournamentGroupService.js';
import { getEtParts, toIso } from './tournamentTime.js';
import { isMarketHoliday } from './marketSchedule.js';
import { GROUP_STATUS, isWeekBanked } from '../../src/constants/leagueTournament.js';

const LOG_PREFIX = '[TrainingLifecycle]';

// 9:30 AM ET market open, minutes since ET midnight — mirrors
// tournamentTime.js:13 (MARKET_OPEN_MIN, module-private there).
const MARKET_OPEN_MIN = 9 * 60 + 30;

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

// ==================== (a) FORM-AND-LAUNCH ====================

/**
 * Form a training pod on demand and resolve it to AWAITING_OPEN. Reuses
 * quickPlay (1 human + 3 CPU, isTraining, CPU boards committed), seats the solo
 * human's board through the orchestrator's deadline fallback
 * (autoCommitMissingBoards — Slice 2 replaces this with the interactive draft),
 * then resolves the snake to AWAITING_OPEN with the start anchor. Returns
 * `{ lobbyId, groupId, humanCount, cpuNs, status, startAnchor }`.
 */
export async function formAndLaunchTrainingPod(db, { odUserId, displayName = null, now = new Date() } = {}) {
  const formed = await quickPlay(db, { odUserId, displayName, now, isTraining: true });
  const groupId = formed.groupId;

  // Idempotent re-entry: a resumed/already-formed pod that already left FORMING
  // is returned as-is — never re-resolved.
  const group = await getGroup(db, groupId);
  if (group && group.status !== GROUP_STATUS.FORMING) {
    return { ...formed, status: group.status, startAnchor: group.startAnchor ?? null };
  }

  // Slice 1 has no interactive human draft (Slice 2): auto-commit the solo
  // human's board via the SAME deadline fallback the Monday pipeline uses. The
  // CPU boards already exist from formation, so this fills only the human seat.
  if (group) await autoCommitMissingBoards(db, group, { now });

  // Resolve the snake to AWAITING_OPEN (NOT battle) + stamp the start anchor.
  const startAnchor = nextMarketOpenAnchor(now);
  await resolveUserDraftForGroup(db, groupId, {
    now,
    targetStatus: GROUP_STATUS.AWAITING_OPEN,
    startAnchor,
  });

  console.log(`${LOG_PREFIX} formed+launched training pod ${groupId} → awaiting_open (anchor ${startAnchor.anchorEtDate})`);
  return { ...formed, status: GROUP_STATUS.AWAITING_OPEN, startAnchor };
}

// ==================== (b) AWAITING-OPEN FLIP ====================

/**
 * Flip AWAITING_OPEN training pods to BATTLE once their anchor DATE has arrived
 * (current ET date ≥ pod.startAnchor.anchorEtDate). Runs from the orchestrator
 * morning tick. DATE-based by design (see header). Idempotent: a flipped pod
 * leaves the AWAITING_OPEN query, so re-runs write nothing. Returns
 * `{ swept, flipped, pending, errors }`.
 */
export async function flipAwaitingOpenPods(db, { now = new Date(), includeDev = false } = {}) {
  const nowEtDate = getEtParts(now).date;
  const nowIso = toIso(now);
  const pods = await fetchEligibleGroupsByStatus(db, GROUP_STATUS.AWAITING_OPEN, { includeDev });
  const summary = { swept: pods.length, flipped: 0, pending: 0, errors: 0 };

  for (const pod of pods) {
    const anchorEtDate = pod.startAnchor?.anchorEtDate;
    // YYYY-MM-DD strings compare lexicographically in date order. Flip on or
    // after the anchor date (catch-up safe); otherwise still waiting.
    if (typeof anchorEtDate === 'string' && nowEtDate >= anchorEtDate) {
      try {
        await transitionStatus(db, pod.id, GROUP_STATUS.BATTLE, nowIso);
        summary.flipped++;
        console.log(`${LOG_PREFIX} flipped training pod ${pod.id} awaiting_open → battle (anchor ${anchorEtDate}, now ${nowEtDate})`);
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

// ==================== (c) ROLLING-COMPLETION ====================

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
  // Dev-inclusive like the nightly banking/leaderboard mirrors; isTraining
  // filter keeps ranked base groups out (they complete via Friday advancement).
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
      // BATTLE→COMPLETE already taken (backstop) → illegal transition → skip.
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
