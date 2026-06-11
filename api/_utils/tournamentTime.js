// api/_utils/tournamentTime.js
//
// ET wall-clock helpers for the tournament user layer (P1b). Every function
// takes an injectable `now` (a UTC instant) and converts to ET via
// Intl.DateTimeFormat parts — the DST-safe pattern of record
// (api/cron/process-draft-claims.js:82-97): no offset math, no Date-string
// re-parsing. Holiday and early-close calendars come from the existing
// server-side schedule module (api/_utils/marketSchedule.js) — never a
// third copy of the NYSE list.

import { isMarketHoliday, isEarlyCloseDay } from './marketSchedule.js';

const MARKET_OPEN_MIN = 9 * 60 + 30;   // 9:30 AM ET
const MARKET_CLOSE_MIN = 16 * 60;      // 4:00 PM ET
const EARLY_CLOSE_MIN = 13 * 60;       // 1:00 PM ET

// Claim placement window — VERBATIM legacy semantics
// (src/services/claimFreeAgencyService.js:49-82): opens at the close, shuts
// one minute before the 9:25 processing pass; spans overnight.
const CLAIM_WINDOW_OPEN_MIN = 16 * 60;       // 4:00 PM ET
const CLAIM_WINDOW_CLOSE_MIN = 9 * 60 + 24;  // 9:24 AM ET (inclusive)

const WEEKEND = new Set(['Sat', 'Sun']);

/**
 * ET wall-clock parts for a UTC instant.
 * @returns {{ weekday: string, date: string, minutes: number, etTime: string }}
 *   weekday 'Mon'..'Sun'; date 'YYYY-MM-DD' ET; minutes since ET midnight.
 */
export function getEtParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hourCycle: 'h23', // not hour12:false — h24 ICU locales render midnight as "24"
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(now);
  const get = (type) => parts.find(p => p.type === type).value;
  const hour = Number(get('hour'));
  const minute = Number(get('minute'));
  return {
    weekday: get('weekday'),
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: hour * 60 + minute,
    etTime: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
  };
}

/** The ET calendar date ('YYYY-MM-DD') of a UTC instant. */
export function formatEtDate(now = new Date()) {
  return getEtParts(now).date;
}

/**
 * Is the stock market open at this instant? Regular session only:
 * Mon–Fri, not a NYSE holiday, 9:30 ≤ t < close (16:00, or 13:00 on
 * early-close days). Drives the flip endpoint's two branches.
 */
export function isMarketOpenAt(now = new Date()) {
  const { weekday, date, minutes } = getEtParts(now);
  if (WEEKEND.has(weekday)) return false;
  if (isMarketHoliday(date)) return false;
  const closeMin = isEarlyCloseDay(date) ? EARLY_CLOSE_MIN : MARKET_CLOSE_MIN;
  return minutes >= MARKET_OPEN_MIN && minutes < closeMin;
}

/**
 * Tournament claim placement window — server-side sibling of the legacy
 * client check (claimFreeAgencyService.js:49-82), minus the day-5 rule,
 * which needs group state and therefore lives in place-claim
 * (deriveCurrentTradingDay >= 5). Like the legacy check, holidays are not
 * window-blocking — the processing cron's isTradingDay guard owns that.
 *
 * @returns {{ isOpen: boolean, etTime: string, reason: string|null }}
 */
export function getTournamentClaimWindow(now = new Date()) {
  const { weekday, minutes, etTime } = getEtParts(now);
  if (WEEKEND.has(weekday)) {
    return { isOpen: false, etTime, reason: 'weekend' };
  }
  // Friday after the close never opens — there is no Saturday processing.
  if (weekday === 'Fri' && minutes >= CLAIM_WINDOW_OPEN_MIN) {
    return { isOpen: false, etTime, reason: 'friday_evening' };
  }
  const isOpen = minutes >= CLAIM_WINDOW_OPEN_MIN || minutes <= CLAIM_WINDOW_CLOSE_MIN;
  return { isOpen, etTime, reason: isOpen ? null : 'market_hours' };
}
