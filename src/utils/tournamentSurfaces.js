// src/utils/tournamentSurfaces.js
//
// P6b — pure, NODE-CLEAN view-model helpers for the competitive surfaces
// (leaderboard month nav, the spectator hierarchy's honest battle degrade).
// No React, no client SDK: the React components stay thin presentation and
// the logic is unit-tested in the Node test environment (the codebase's
// posture — there is no React DOM test harness). Imports only the zero-import
// schema module, so this file is safe in both the browser and api/ graphs.

import {
  getWeeklyComposite,
  getWeeklyScore,
  round2,
  TOURNAMENT_TUNING,
  LEG_DIRECTION,
} from '../constants/leagueTournament';

const DD_VERB = {
  formed: 'doubled down on',
  flipped: 'flipped the double-down on',
  broken: 'broke the double-down on',
};

// P7 (B) — the claim-placement window, DISPLAY-ONLY mirror of the server's
// getTournamentClaimWindow (api/_utils/tournamentTime.js:114-125). This drives
// the countdown ONLY; it NEVER gates a submit — the server's 403 window_closed
// is the sole authority on every claim. The minute boundaries and the
// weekend/Friday-evening logic are reproduced here (the server helper can't be
// imported client-side without pulling marketSchedule.js into the browser
// bundle), and a parity test asserts this mirror matches the server across a
// time grid incl. a DST boundary, a Friday evening, and a weekend.
const CLAIM_WINDOW_OPEN_MIN = 16 * 60;       // 4:00 PM ET
const CLAIM_WINDOW_CLOSE_MIN = 9 * 60 + 24;  // 9:24 AM ET (inclusive)
const WEEKEND_DAYS = new Set(['Sat', 'Sun']);
const CLAIM_WINDOW_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hourCycle: 'h23',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

function claimWindowEtParts(now) {
  const parts = CLAIM_WINDOW_FORMATTER.formatToParts(now);
  const get = (type) => parts.find(p => p.type === type).value;
  const hour = Number(get('hour'));
  const minute = Number(get('minute'));
  return {
    weekday: get('weekday'),
    minutes: hour * 60 + minute,
    etTime: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
  };
}

/**
 * Display state for the claim window. `{ isOpen, etTime, reason }` mirrors the
 * server byte-for-byte (parity-locked); `countdownMinutes` + `countdownTo` are
 * display sugar (wall-clock ET minutes to the next boundary — to the 09:24
 * close when open, to the 16:00 open when in market hours). Pure.
 */
export function getClaimWindowDisplay(now = new Date()) {
  const { weekday, minutes, etTime } = claimWindowEtParts(now);
  if (WEEKEND_DAYS.has(weekday)) {
    return { isOpen: false, etTime, reason: 'weekend', countdownMinutes: null, countdownTo: null };
  }
  if (weekday === 'Fri' && minutes >= CLAIM_WINDOW_OPEN_MIN) {
    return { isOpen: false, etTime, reason: 'friday_evening', countdownMinutes: null, countdownTo: null };
  }
  const isOpen = minutes >= CLAIM_WINDOW_OPEN_MIN || minutes <= CLAIM_WINDOW_CLOSE_MIN;
  let countdownTo = null;
  let countdownMinutes = null;
  if (isOpen) {
    countdownTo = 'close';
    countdownMinutes = minutes <= CLAIM_WINDOW_CLOSE_MIN
      ? CLAIM_WINDOW_CLOSE_MIN - minutes              // morning: close is later today
      : (24 * 60 - minutes) + CLAIM_WINDOW_CLOSE_MIN; // evening: close is tomorrow 09:24
  } else {
    countdownTo = 'open';                              // market_hours: open is today 16:00
    countdownMinutes = CLAIM_WINDOW_OPEN_MIN - minutes;
  }
  return { isOpen, etTime, reason: isOpen ? null : 'market_hours', countdownMinutes, countdownTo };
}

/**
 * The one-line text for a group-feed event (the GroupFeed renderer's pure
 * core — kept node-clean so it is unit-tested without a DOM). Cases: flip,
 * board_auto_commit, and the P6b double_down, where an ABSENT `side` reads as
 * agent (the agent-side sibling carries no `side`).
 */
export function feedEventText(event, uid) {
  const mine = event.odUserId === uid;
  const who = mine ? 'You' : event.odUserId;
  const whose = mine ? 'Your' : `${event.odUserId}'s`;
  switch (event.type) {
    case 'flip':
      return `${who} flipped ${event.symbol} ${event.from}→${event.to}`;
    case 'board_auto_commit':
      return `${whose} board auto-committed at the deadline (${event.boardLength} names)`;
    case 'double_down': {
      const verb = DD_VERB[event.kind] || 'doubled down on';
      return event.side === 'user'
        ? `${who} ${verb} ${event.symbol}`
        : `${whose} agent ${verb} ${event.symbol}`;
    }
    default:
      return event.type;
  }
}

/** 'YYYY-MM' in America/New_York — the leaderboard's month identity (ruling
 * A-3), via Intl (never a hand-rolled offset; the formatEtDate precedent). */
export function etMonthKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit',
  }).formatToParts(date);
  const y = parts.find(p => p.type === 'year').value;
  const m = parts.find(p => p.type === 'month').value;
  return `${y}-${m}`;
}

/**
 * The chevron boundary state for the leaderboard month nav (founder-ruled
 * boundaries): you can never browse PAST the current ET month (no future
 * boards), and "older" stops once you reach an empty month — so the prev
 * chevron disables when the current doc doesn't exist. Pure.
 */
export function monthNavState({ monthKey, currentMonthKey, docExists }) {
  return {
    canNewer: typeof monthKey === 'string'
      && typeof currentMonthKey === 'string'
      && monthKey < currentMonthKey,
    canOlder: docExists === true,
  };
}

/**
 * The spectator hierarchy's TIER-3 honest degrade (Proposal C): the full
 * battle view is P7, so this builds the player strip ENTIRELY from the group
 * doc in hand — per-player composite (the score of record), the user-layer
 * total, the derived agent-layer total (composite − k × user, exact under the
 * one-k identity), and the live user picks with their current direction. No
 * fake screen, no dead button — the caller labels it "full battle view
 * arrives with the tournament battle screen." Ranked by composite. Pure.
 */
export function spectatorBattleSummary(group, { uid = null } = {}) {
  const players = (group?.players || []).map(p => {
    const composite = getWeeklyComposite(group, p.odUserId);
    const userPoints = getWeeklyScore(group, p.odUserId);
    return {
      odUserId: p.odUserId,
      isCpu: p.isCpu === true,
      isYou: uid != null && p.odUserId === uid,
      composite: round2(composite),
      userPoints: round2(userPoints),
      // Exact under composite = agentPoints + k × userPoints (the one-k home).
      agentPoints: round2(composite - TOURNAMENT_TUNING.USER_LAYER_K * userPoints),
      picks: (p.picks || []).map(pick => ({
        symbol: pick.symbol,
        direction: pick.legs?.[pick.legs.length - 1]?.direction || LEG_DIRECTION.LONG,
      })),
    };
  });
  players.sort((a, b) => b.composite - a.composite);
  return { players, degraded: true };
}
