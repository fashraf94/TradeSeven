// BaggerBomb stock thresholds v2: the measured pilot's creation window (build
// report §6b, option (a), Flash's ruling P2). One module holds the server
// refusal (api/_utils/stockThresholdAdmission.js prepareStockCreation) and the
// player's retry time (src/services/agentDeploy.js), so the two cannot drift.
// Pure and Node-clean: the calendar of record only, no clock read. api/ imports
// it under BUILD_RULES §4; stockThresholdV2.test.js imports it unmocked.
import { getSessionForDate, etWallClockToMs } from './marketCalendar.js';
import { instantMs } from './stockThresholdModel.js';

// The collector's publication window: a source session is measurable from 15
// minutes after its calendar close (stockThresholdMeasurementProvider.js reads
// this constant).
export const STOCK_PUBLICATION_DELAY_MINUTES = 15;
// The crypto "Night Game" close that a tiered battle's expiry carries on a
// regular trading day (api/_utils/marketSchedule.js getNextMarketClose with
// cryptoExtended, read by the fenced computeFullDayExpiry; there is none on an
// early-close day). Only the retry time reads it; the refusal reads the
// battle's own expiresAt. stockThresholdV2.test.js pins the two together
// through the real creation path.
export const NIGHT_GAME_CLOSE = Object.freeze({ hour: 20, minute: 0 });

export const etDateOf = ms => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(ms);
  const part = type => parts.find(p => p.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
};
// The first trading session after an ET date, walking the calendar's tables.
// Null when the walk leaves the maintained horizon.
function nextSessionAfter(etDate) {
  let cursor = Date.parse(`${etDate}T12:00:00Z`);
  for (let i = 0; i < 15; i++) {
    cursor += 86_400_000;
    const session = getSessionForDate(new Date(cursor).toISOString().slice(0, 10));
    if (!session) return null;
    if (session.isTradingDay) return session;
  }
  return null;
}

// A selected creation outside a trading session (after the current session's
// close, or on a weekend or holiday) is refused when the battle's own expiry
// falls before the next session opens: no evaluating tick could ever score it.
// Before or during the current session the battle plays that session, so the
// expiry is not read. The 45-minute late-start refusal ends at the close, where
// this one begins, so the two leave no gap.
export function eveningWindowRefusal(began, expiresAt) {
  const ms = instantMs(began);
  if (ms === null) return 'invalid_creation_instant';
  const current = getSessionForDate(etDateOf(ms));
  if (!current) return 'calendar_missing';
  if (current.isTradingDay && ms < current.closeMs) return null;
  const expiry = instantMs(expiresAt);
  if (expiry === null) return 'invalid_battle_expiry';
  const next = nextSessionAfter(current.etDate);
  if (!next) return 'calendar_missing';
  return expiry < next.openMs ? 'evening_window' : null;
}

// The retry time named to a player refused with late_start_cutoff or
// evening_window: the first instant on that ET date at which a tiered pilot
// creation is accepted again. A tiered roster always holds crypto (the
// mandatory crypto slot, api/_utils/gameModePolicy.js), so on a regular day it
// is the Night Game close the refused battle would have expired at; on an
// early-close day there is no Night Game and it is the end of the publication
// window. Null when `at` is malformed or not on a trading day.
export function stockAdmissionRetryAt(at) {
  const ms = instantMs(at);
  if (ms === null) return null;
  const session = getSessionForDate(etDateOf(ms));
  if (!session?.isTradingDay) return null;
  const published = session.closeMs + STOCK_PUBLICATION_DELAY_MINUTES * 60000;
  return session.isEarlyClose ? published : Math.max(published, etWallClockToMs(session.etDate, NIGHT_GAME_CLOSE.hour, NIGHT_GAME_CLOSE.minute));
}
