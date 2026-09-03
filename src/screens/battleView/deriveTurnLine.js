// src/screens/battleView/deriveTurnLine.js
//
// The turn line — Phase A of the Battle View controller (A1). PURE.
//
// The player reads the game as a controller: the score header carries one
// line saying when the agent last checked the book and when it is due to
// check again. Everything here is a fact about the SCOREBOARD or the SCHEDULE,
// never a claim about what the agent is doing between checks (it does nothing
// between checks — the copy rules in deskCopy.js are the ones that bind).
//
// ONE SOURCE (BUILD_RULES §9, D-62). The phase, the last check and the next
// check all come from the same adapter the dashboard Desk renders from
// (buildBaggerbombAdapter, called with a null cache and a null agent — no
// cache read, no rules contact). `next` is the adapter's `lastScoredAt + 15
// min` everywhere; the late state's "was due" time is the adapter's exported
// deriveDueAt(), so this module never derives "+15 minutes" on its own.
//
// The five states (Phase A seed §A1) and the string each consumes:
//   live      → DESK_COPY.postureLive     `Checked 12:47 PM · next ~1:02 PM`
//   lastToday → DESK_COPY.postureLastOfSession `Checked 3:46 PM · last check today`
//   late      → DESK_COPY.postureLate     `Last check 12:47 PM · next was due ~1:02 PM`
//   preOpen   → DESK_COPY.posturePreOpen  `First check at 9:30 AM ET`
//   closed    → DESK_COPY.postureClosed   `Market closed · last check 3:45 PM · next Tue 9:30 AM ET`
//   complete  → DESK_COPY.postureComplete `Battle complete`
// plus the Desk's own LIVE-with-no-eval degrade (`First check coming up`).
//
// "DECIDED" IS NOT "CHECKED" (hazard 4, Phase 0 §2.9). `scoreState.lastScoredAt`
// advances on every tick, including the five early-return ticks that record no
// evaluation. A decision exists only when the latest `evaluations[]` entry is
// at least as new as the scoring stamp — and the join is `>=`, never `===`:
// the two are different `new Date()` calls inside one tick
// (agent-evaluate.js:881 vs :2059), so they are never equal.

import {
  buildBaggerbombAdapter,
  deriveDueAt,
  toMillis,
  PHASE,
} from '../../adapters/baggerbombAdapter';
import { DESK_COPY, etTime } from '../../components/Dashboard/desk/deskCopy';

// The adapter's normalisation is the one boundary for the Firestore-Timestamp
// / ISO / Date / number union; re-exported so the Why? selector shares it.
export { toMillis };

/**
 * The cron's slot, in milliseconds. The evaluate cron runs on the quarter
 * hour; every check belongs to one of `:00 / :15 / :30 / :45`.
 */
export const SLOT_MS = 15 * 60 * 1000;

/**
 * An instant floored to the check slot it belongs to. PRIVATE — `slotLabel`
 * below is the one thing this phase exposes, and the exact instants stay on
 * the derived object for ordering and the `>=` join.
 *
 * Floored on ABSOLUTE time, then formatted in ET, so no offset is hand-rolled
 * (BUILD_RULES §6). That is exact for America/New_York because its offset is a
 * whole number of hours in both halves of the year, which makes a 15-minute
 * absolute boundary the same instant as a 15-minute ET wall-clock boundary.
 * The assumption is not left implicit: deriveTurnLine.test.js walks both 2026
 * DST switches and asserts every label lands on `:00 / :15 / :30 / :45`.
 */
function floorToSlot(iso) {
  const ms = toMillis(iso);
  if (ms == null) return null;
  return new Date(Math.floor(ms / SLOT_MS) * SLOT_MS).toISOString();
}

/**
 * A CHECK, named by its cron slot (D-83).
 *
 * The founder's A2.2 smoke found the score header reading `Checked 12:30 PM`
 * while the tape's card read `At the 12:31 PM check` — one tick, two labels,
 * because `scoreState.lastScoredAt` and the evaluation entry's own `timestamp`
 * are two `new Date()` calls inside one cron run (agent-evaluate.js:881 vs
 * :2059) and the second one had crossed a minute boundary. Neither number was
 * wrong; naming a check by an exact instant is what was wrong, because the
 * instant is write latency and the SLOT is the thing that happened.
 *
 * So every label that names a check floors to the slot, and only labels do:
 * the exact timestamps still sort the tape and still answer the `>=` join, and
 * a TRADE keeps its exact minute (a swap executes at an instant, and
 * `1:31 PM · GILD → MOS` is that instant, not a check).
 *
 * @returns {string|null} `12:30 PM`, or null when there is no instant
 */
export function slotLabel(iso) {
  return etTime(floorToSlot(iso));
}

/**
 * How long past the due instant the turn line keeps saying "next ~" before it
 * says the check was due and has not landed. The cron is not a metronome; a
 * few minutes of write latency is normal and not late.
 */
export const LATE_GRACE_MS = 5 * 60 * 1000;

export const TURN_STATE = Object.freeze({
  LIVE: 'live',
  LAST_OF_SESSION: 'lastOfSession',
  FIRST_CHECK: 'firstCheck',
  LATE: 'late',
  PRE_OPEN: 'preOpen',
  CLOSED: 'closed',
  COMPLETE: 'complete',
});

/**
 * THE ONE JOIN. An evaluation entry belongs to the latest check when its
 * timestamp is at least as new as the scoring stamp. `>=`, never `===`
 * (hazard 21). With no scoring stamp at all the entry stands on its own.
 */
export function isDecidedAt(entryTimestamp, lastScoredAt) {
  const entryMs = toMillis(entryTimestamp);
  if (entryMs == null) return false;
  const scoredMs = toMillis(lastScoredAt);
  if (scoredMs == null) return true;
  return entryMs >= scoredMs;
}

/**
 * The latest `evaluations[]` entry that belongs to the latest check, or null
 * when the latest check recorded no decision (an early-return tick advanced
 * `lastScoredAt` with no entry — the honest absence state, hazard 4).
 *
 * Entries are appended chronologically (agent-evaluate.js:2710), so the scan
 * from the end stops at the first entry that carries a timestamp.
 */
export function selectLatestDecision(battle) {
  const evals = battle?.evaluations;
  if (!Array.isArray(evals) || evals.length === 0) return null;
  const lastScoredAt = battle?.scoreState?.lastScoredAt ?? null;
  for (let i = evals.length - 1; i >= 0; i -= 1) {
    const entry = evals[i];
    if (!entry || toMillis(entry.timestamp) == null) continue;
    return isDecidedAt(entry.timestamp, lastScoredAt) ? entry : null;
  }
  return null;
}

/**
 * Derive the turn line for a battle doc.
 *
 * @param {object|null} battle       the subscribed agentBattles doc ({id, ...data})
 * @param {Date|string|number} now   injected clock (coarse — once a minute or on
 *                                   visibilitychange; never a per-second tick)
 * @param {object|null} marketState  result of getMarketState(), injected so every
 *                                   phase is reachable from a fixture (the adapter's
 *                                   own reason for taking it as a parameter)
 * @returns {{
 *   phase: string, state: string, text: string,
 *   lastCheckedAt: string|null, nextDecisionAt: string|null, dueAt: string|null,
 *   decided: boolean, decision: object|null,
 * }|null} null when there is no battle to describe
 */
export function deriveTurnLine(battle, now, marketState) {
  const sync = buildBaggerbombAdapter(battle, null, null, now, marketState);
  if (!sync) return null;

  const { phase, lastCheckedAt, nextDecisionAt, nextOpenEt, lastCheckOfSession } = sync;
  const dueAt = phase === PHASE.LIVE ? deriveDueAt(lastCheckedAt, marketState) : null;
  const nowMs = toMillis(now);
  const dueMs = toMillis(dueAt);
  const decision = selectLatestDecision(battle);

  // THE LABELS NAME THE SLOT (D-83); the returned fields keep the exact
  // instants, because the late branch's arithmetic and every caller's ordering
  // are about real time, not about what the line says.
  const lastSlot = floorToSlot(lastCheckedAt);
  const nextSlot = floorToSlot(nextDecisionAt);
  const dueSlot = floorToSlot(dueAt);

  let state;
  let text;
  if (phase === PHASE.POST_CLOSE) {
    state = TURN_STATE.COMPLETE;
    text = DESK_COPY.postureComplete;
  } else if (phase === PHASE.PRE_OPEN) {
    state = TURN_STATE.PRE_OPEN;
    text = DESK_COPY.posturePreOpen;
  } else if (phase === PHASE.LIVE_CLOSED) {
    state = TURN_STATE.CLOSED;
    text = DESK_COPY.postureClosed(nextOpenEt, lastSlot);
  } else if (!lastCheckedAt) {
    state = TURN_STATE.FIRST_CHECK;
    text = DESK_COPY.postureLive(null, null);
  } else if (lastCheckOfSession) {
    // D-71. Ordered BEFORE the late branch for legibility only: the field is
    // true exactly when deriveDueAt() is null, and the late branch needs a
    // non-null dueAt, so the two are mutually exclusive by construction.
    state = TURN_STATE.LAST_OF_SESSION;
    text = DESK_COPY.postureLastOfSession(lastSlot);
  } else if (dueMs != null && nowMs != null && nowMs > dueMs + LATE_GRACE_MS) {
    // Strictly past the grace: at exactly dueAt + grace the line still reads
    // as live (`Checked {t}`, its next already withheld by the adapter).
    state = TURN_STATE.LATE;
    text = DESK_COPY.postureLate(lastSlot, dueSlot);
  } else {
    state = TURN_STATE.LIVE;
    text = DESK_COPY.postureLive(lastSlot, nextSlot);
  }

  return {
    phase,
    state,
    text,
    lastCheckedAt,
    nextDecisionAt,
    dueAt,
    decided: decision != null,
    decision,
  };
}

export default deriveTurnLine;
