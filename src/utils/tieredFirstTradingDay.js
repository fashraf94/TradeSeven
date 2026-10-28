// src/utils/tieredFirstTradingDay.js
//
// BaggerBomb cleanup C1 / C2 / C5 (Flash, Oct 27, 2026) — ONE answer to "has
// this tiered battle's first trading day arrived?", for the two crons that act
// on a battle (agent-evaluate, agent-daily-scores) and for the screens that say
// when it starts. BR-2 sends a battle created from 45 minutes before a close,
// or overnight, to the NEXT session: its `timing.tradingDays[0]` is that
// session, and until the ET date reaches it the battle has not started.
//
// Moved out of api/cron/agent-evaluate.js (F3, `beforeFirstTradingDay`) so the
// scoring cron does not import a cron handler. Pure: every function takes the
// ET date as an argument and reads no clock (etDateOf turns an instant the
// caller already holds into one). The only import besides the mode constant is
// the dependency-free session calendar, so the module is Node-clean and
// browser-clean — BUILD_RULES §4: api/ imports it, and the co-located test's
// real, unmocked import is the dependency-surface guard.
//
// Tiered means `gameMode` absent or 'baggerbomb_agent'. Tournaments and every
// other mode — which carry a `tradingDays` list too — are never held back and
// never re-based: they return false / null here, so their paths are untouched.

import { TIERED_GAME_MODE } from '../constants/agentGameModes.js';
import { getSessionForDate } from './marketCalendar.js';

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Is this a tiered (BaggerBomb agent) battle? A document with no gameMode is the original tiered game. */
export function isTieredBattle(battle) {
  return battle?.gameMode == null || battle.gameMode === TIERED_GAME_MODE;
}

/**
 * The battle's first trading day as an ET date string, for a tiered battle
 * whose list names one; null otherwise (another mode, no list, a malformed
 * first entry).
 */
export function firstTradingDayOf(battle) {
  if (!isTieredBattle(battle)) return null;
  const first = battle?.timing?.tradingDays?.[0];
  return typeof first === 'string' && DATE_KEY.test(first) ? first : null;
}

/**
 * Has this tiered battle not reached its first trading day? True when the ET
 * date `todayET` ('YYYY-MM-DD') is before `timing.tradingDays[0]`. False for
 * every other mode, for a battle with no usable list, and for an unreadable
 * date (never hold a battle back on a guess).
 */
export function beforeFirstTradingDay(battle, todayET) {
  const first = firstTradingDayOf(battle);
  return first !== null && typeof todayET === 'string' && DATE_KEY.test(todayET) && todayET < first;
}

const ET_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
});

/** The ET calendar date ('YYYY-MM-DD') of a true instant in epoch ms; null for anything else. */
export function etDateOf(ms) {
  // An out-of-range number (1e20) is no instant: Intl would throw on it (review CL1-5).
  if (typeof ms !== 'number' || !Number.isFinite(ms) || Number.isNaN(new Date(ms).getTime())) return null;
  const parts = ET_DAY.formatToParts(new Date(ms));
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return get('year') && get('month') && get('day') ? `${get('year')}-${get('month')}-${get('day')}` : null;
}

/**
 * The first session's open for a tiered battle, as a TRUE instant (epoch ms)
 * from the calendar of record (marketCalendar.js getSessionForDate); null when
 * the battle has no first trading day, the day is outside the maintained
 * horizon, or it is not a session. The opening is read from the calendar, never
 * from a clock, so a weekend, a holiday eve and a DST change all land on the
 * real next session.
 */
export function firstSessionOpenMs(battle) {
  const first = firstTradingDayOf(battle);
  if (first === null) return null;
  const session = getSessionForDate(first);
  return session?.isTradingDay === true && Number.isFinite(session.openMs) ? session.openMs : null;
}
