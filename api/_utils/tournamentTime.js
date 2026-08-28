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
// BUILD_RULES §4 api/ -> src/ import: leagueTournament.js is a ZERO-import
// constants module (verified), so this adds nothing to the transitive graph.
// The guard is tournamentTime.test.js's real import of THIS module — never mock it.
import { GROUP_STATUS } from '../../src/constants/leagueTournament.js';

const MARKET_OPEN_MIN = 9 * 60 + 30;   // 9:30 AM ET
const MARKET_CLOSE_MIN = 16 * 60;      // 4:00 PM ET
const EARLY_CLOSE_MIN = 13 * 60;       // 1:00 PM ET

// Claim placement window — VERBATIM legacy semantics
// (src/services/claimFreeAgencyService.js:49-82): opens at the close, shuts
// one minute before the 9:25 processing pass; spans overnight.
const CLAIM_WINDOW_OPEN_MIN = 16 * 60;       // 4:00 PM ET
const CLAIM_WINDOW_CLOSE_MIN = 9 * 60 + 24;  // 9:24 AM ET (inclusive)

const WEEKEND = new Set(['Sat', 'Sun']);

// Module-level: formatter construction is ~100x the cost of formatToParts,
// and every P1b surface funnels through here (twice per flip/place-claim
// request, once per group in both cron branches).
const ET_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hourCycle: 'h23', // not hour12:false — h24 ICU locales render midnight as "24"
  weekday: 'short',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * ET wall-clock parts for a UTC instant.
 * @returns {{ weekday: string, date: string, minutes: number, etTime: string }}
 *   weekday 'Mon'..'Sun'; date 'YYYY-MM-DD' ET; minutes since ET midnight.
 */
export function getEtParts(now = new Date()) {
  const parts = ET_FORMATTER.formatToParts(now);
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
 * Date|string → ISO string (the injectable-`now` normalization). ONE home —
 * P6a code review found this inlined in six tournament modules; new code
 * imports it from here (retrofitting the four pre-P6a private copies is
 * docketed for the P8 hygiene pass, BUILD_RULES §3 report-don't-fix).
 */
export function toIso(now) {
  return now instanceof Date ? now.toISOString() : new Date(now).toISOString();
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
 * PRE-OPEN PHASE — is this group on its battle day, but before the bell?
 *
 * True iff the group is BATTLE and the market has not yet opened on the group's
 * own anchor date (`startAnchor.anchorEtDate`). This is the ONE shared derivation
 * behind pre-open display routing; every routing site consumes it through
 * `usePreOpenPhase` (src/hooks/usePreOpenPhase.js), which binds it to a ticker so
 * no site can consume the derivation without the clock that makes it flip.
 *
 * WHY NOT `isMarketOpenAt`: it answers "is the market open RIGHT NOW", which is a
 * different question. It ignores the anchor entirely (at 10:00 it reports open for
 * a pod anchored next Monday, which would read as live days early) and it goes
 * false again after the 16:00 close and on early-close days, which would flip a
 * long-running battle day back to "pre-open" in the afternoon. So this compares the
 * (date, minutes) tuple against (anchorEtDate, MARKET_OPEN_MIN) instead.
 *
 * The four cases (spec V2 §2), in the order they are decided:
 *   - status is not BATTLE          -> false (a genuine AWAITING_OPEN pod is not
 *                                      "pre-open on its battle day"; it routes on
 *                                      its own status, unchanged)
 *   - anchor date in the FUTURE     -> false
 *   - anchor date in the PAST       -> false (stale / late-fire: the battle day has
 *                                      been and gone, so it reads live and can never
 *                                      strand on the awaiting surface)
 *   - anchor date is TODAY          -> true iff ET minutes < 09:30
 *
 * A missing or malformed anchor returns false — the fail-safe direction, since
 * false is exactly today's (pre-flag) routing.
 *
 * DST-immune: the only instant -> ET conversion is getEtParts (Intl), never an
 * offset assumption. Pure and injectable; the React binding lives in the hook.
 *
 * @param {{status?: string, startAnchor?: {anchorEtDate?: string}}} group
 * @param {Date} now
 * @returns {boolean}
 */
export function isPreOpenOnBattleDay(group, now = new Date()) {
  if (group?.status !== GROUP_STATUS.BATTLE) return false;
  const anchorEtDate = group?.startAnchor?.anchorEtDate;
  if (typeof anchorEtDate !== 'string' || anchorEtDate === '') return false;
  const { date: nowEtDate, minutes } = getEtParts(now);
  if (nowEtDate !== anchorEtDate) return false;
  return minutes < MARKET_OPEN_MIN;
}

/**
 * Admin time-control parsing (P3b — the P1b injectable-now idiom given one
 * consumer contract: run-duty and bank-daily-scores both accept a
 * `simulatedNow` ISO instant, admin-gated by construction). Strings only —
 * a bare JSON number would silently resolve to a 1970-adjacent instant and
 * pollute per-ET-date keys. Returns { now: Date } (real clock when absent)
 * or { error } for the endpoint's 400.
 */
export function parseSimulatedNow(value) {
  if (value == null) return { now: new Date() };
  if (typeof value !== 'string') {
    return { error: 'simulatedNow must be an ISO-8601 instant string.' };
  }
  const now = new Date(value);
  if (Number.isNaN(now.getTime())) {
    return { error: 'simulatedNow must be an ISO-8601 instant string.' };
  }
  return { now };
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
