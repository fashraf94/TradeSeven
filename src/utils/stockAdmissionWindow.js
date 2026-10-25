// BaggerBomb's full-day creation window. One module holds the tiered full-day
// target (BR-2, Flash, Oct 25, 2026: late-day starts play the next trading day;
// read by the fenced createAgentBattle, api/_utils/agentBattleService.js), the
// collector's publication wait (api/_utils/stockThresholdMeasurementProvider.js)
// and the player's reopening time (src/services/agentDeploy.js), so the three
// cannot drift. Pure and Node-clean: the calendar of record only, no clock read
// and no process time zone. api/ imports it under BUILD_RULES §4;
// stockThresholdBroadRelease.test.js and stockThresholdV2.test.js import it
// unmocked.
import { getSessionForDate, etWallClockToMs } from './marketCalendar.js';
import { instantMs } from './stockThresholdModel.js';

// The collector's publication window: a source session is measurable from 15
// minutes after its calendar close (stockThresholdMeasurementProvider.js reads
// this constant).
export const STOCK_PUBLICATION_DELAY_MINUTES = 15;
// The crypto "Night Game" close that a tiered battle's expiry carries on a
// regular trading day (none on an early-close day): the rule of
// api/_utils/marketSchedule.js getNextMarketClose with cryptoExtended, which
// the tournament path keeps. stockThresholdBroadRelease.test.js pins the two
// together outside the late-day window.
export const NIGHT_GAME_CLOSE = Object.freeze({ hour: 20, minute: 0 });
// BR-2: a tiered full-day battle created from this many minutes before a
// trading day's calendar close (15:15 ET; 12:15 ET on early-close days) plays
// the next session. A code constant recorded in the approval document, not hashed.
export const LATE_DAY_START_MINUTES = 45;

const ET_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
const ET_HOUR = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', hourCycle: 'h23' });
export const etDateOf = ms => {
  const parts = ET_DATE.formatToParts(ms);
  const part = type => parts.find(p => p.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
};
const etHourOf = ms => Number(ET_HOUR.format(ms));
// The calendar's tables are constants, so each ET date's session is looked up
// once per process (the sessions are frozen; a date outside the tables stays null).
const SESSIONS = new Map();
const sessionOn = etDate => {
  if (!SESSIONS.has(etDate)) { const s = getSessionForDate(etDate); SESSIONS.set(etDate, s && Object.freeze(s)); }
  return SESSIONS.get(etDate);
};
// The first trading session after an ET date, walking the calendar's tables.
// Null when the walk leaves the maintained horizon.
function nextSessionAfter(etDate) {
  let cursor = Date.parse(`${etDate}T12:00:00Z`);
  for (let i = 0; i < 15; i++) {
    cursor += 86_400_000;
    const session = sessionOn(new Date(cursor).toISOString().slice(0, 10));
    if (!session) return null;
    if (session.isTradingDay) return session;
  }
  return null;
}

// BR-2: the full day a tiered battle created at `atMs` plays. On a trading day
// before the late-day start it is that session; from the late-day start, and
// on a weekend or holiday, it is the next session. The expiry is the session's
// close, or the Night Game close for a roster holding crypto on a regular day.
// Outside the late-day window this is the old getNextMarketClose rule exactly
// (stockThresholdBroadRelease.test.js sweeps the two against each other).
// { status: 'calendar_missing' } when the creation date or the next session
// lies outside the maintained tables: never a guess. `localClose` is
// `effectiveCloseHour` as 'HH:00', so expiresAt, tradingDays and localClose
// all come from one instant.
export function tieredFullDayTarget(atMs, hasCrypto) {
  if (!Number.isFinite(atMs)) return { status: 'invalid_creation_instant' };
  const current = sessionOn(etDateOf(atMs));
  if (!current) return { status: 'calendar_missing' };
  const session = current.isTradingDay && atMs < current.closeMs - LATE_DAY_START_MINUTES * 60000 ? current : nextSessionAfter(current.etDate);
  if (!session) return { status: 'calendar_missing' };
  const expiresMs = hasCrypto && !session.isEarlyClose ? etWallClockToMs(session.etDate, NIGHT_GAME_CLOSE.hour, NIGHT_GAME_CLOSE.minute) : session.closeMs;
  return { status: 'ok', expiresAt: new Date(expiresMs).toISOString(), targetDateStr: session.etDate, effectiveCloseHour: etHourOf(expiresMs) };
}

// The instant the collector's publication wait ends on the ET date of `at`:
// 15 minutes after that session's close (4:15 PM ET; 1:15 PM on early-close
// days). The player line names it when a measured creation is refused
// publication_window_not_open. Null when `at` is malformed or not on a
// trading day.
export function stockPublicationOpensAt(at) {
  const ms = instantMs(at);
  if (ms === null) return null;
  const session = sessionOn(etDateOf(ms));
  return session?.isTradingDay ? session.closeMs + STOCK_PUBLICATION_DELAY_MINUTES * 60000 : null;
}
