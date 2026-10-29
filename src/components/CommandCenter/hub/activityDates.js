// src/components/CommandCenter/hub/activityDates.js
//
// Command Center hub, slice S4 — Activity's absolute times and the brief's market date (and, since the DRB stale fix, the
// brief's age in sessions and its "Generated" day). They live apart from hub/hubDate.js on purpose:
// the deploy provider (App's root) imports hubDate.js, so everything in it ships in the main bundle for every player, hub on or off;
// only the hub (a lazy chunk) imports this file. Like hubDate.js it is the one place that builds an Intl formatter for these:
// the derivations (hub/activityRows.js, hub/nextAction.js) never do, and take their clock as an argument.

import { formatHubDay, formatHubTime } from './hubDate';

/** A formatter built on first use: the formatters of this file are needed only once a list or a brief is drawn. */
const once = (make) => { let value; return () => { if (value === undefined) value = make(); return value; }; };

const etDayTime = once(() => new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
}));

const etDayTimeYear = once(() => new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
}));
const etDayYear = once(() => new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
}));
const etYear = once(() => new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric' }));

/**
 * A time from another year than the clock's (both read in ET) carries its year: "Jan 5" for an equip of five years ago would read as
 * this January. Without a clock (`nowMs` absent or not finite) no year is added.
 */
const otherYear = (ms, nowMs) => typeof nowMs === 'number' && Number.isFinite(nowMs) && etYear().format(new Date(ms)) !== etYear().format(new Date(nowMs));

/** "Oct 3, 4:00 PM" for an instant in ms, read in ET (Activity's absolute time; spec §8.2); "Oct 3, 2025, 4:00 PM" from another year than `nowMs`'s. '' for anything but a finite number. */
export function formatHubDayTime(ms, nowMs) {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return '';
  return (otherYear(ms, nowMs) ? etDayTimeYear() : etDayTime()).format(new Date(ms));
}

/** "Oct 3" for an instant in ms, read in ET; "Oct 3, 2025" from another year than `nowMs`'s. '' for anything but a finite number. */
export function formatHubDayYear(ms, nowMs) {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return '';
  return otherYear(ms, nowMs) ? etDayYear().format(new Date(ms)) : formatHubDay(ms);
}

const marketDayParts = once(() => new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  weekday: 'short',
  month: 'short',
  day: 'numeric',
}));

/**
 * "Tue Oct 7" for a market date written `YYYY-MM-DD` (the brief's `forDate`, already a market-day label in ET). It is
 * formatted from the string's own parts, at noon UTC read in UTC: never converted through a time zone, which would move
 * a bare date to the evening before. '' for anything that is not a real calendar date.
 */
export function formatHubMarketDate(text) {
  const probe = marketDayNoon(text);
  if (!probe) return '';
  const parts = Object.fromEntries(marketDayParts().formatToParts(probe).map((p) => [p.type, p.value]));
  return `${parts.weekday} ${parts.month} ${parts.day}`;
}

/** Noon UTC on a market date written `YYYY-MM-DD`, or null for anything that is not a real calendar date. */
function marketDayNoon(text) {
  const m = typeof text === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(text) : null;
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(Date.UTC(year, month - 1, day, 12));
  // A day past the month's end (Feb 30, day 00) rolls the month, a month 00 or 13 rolls the year, and a year under 100 is read as 19xx:
  // each lands on a different year or month, so these two comparisons are the whole calendar check.
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1) return null;
  return probe;
}

const etDateParts = once(() => new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }));
const DAY_MS = 24 * 3600 * 1000;

/** The ET market date of an instant, `YYYY-MM-DD`, from the formatter's parts (never from a locale's written order); '' for an invalid instant. */
function etMarketDate(ms) {
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return '';
  const parts = Object.fromEntries(etDateParts().formatToParts(date).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/**
 * The brief's age in trading sessions (DRB stale fix, founder ruling Oct 29 2026): the ET weekdays after the market
 * date `forDate`, up to and including the ET date of `nowMs`. Market holidays are not known here and count as sessions.
 * 0 on the brief's own day, on the weekend after it, or for a date ahead of the clock; null without a real date or a
 * usable clock.
 */
export function marketSessionsSince(forDate, nowMs) {
  const from = marketDayNoon(forDate);
  if (!from || typeof nowMs !== 'number' || !Number.isFinite(nowMs)) return null;
  const today = marketDayNoon(etMarketDate(nowMs));
  if (!today) return null;
  const days = Math.round((today.getTime() - from.getTime()) / DAY_MS);
  if (days <= 0) return 0;
  // Every whole week holds five sessions; the remaining days are counted one by one from the brief's weekday.
  let sessions = Math.floor(days / 7) * 5;
  for (let i = 1; i <= days % 7; i += 1) {
    const weekday = (from.getUTCDay() + i) % 7;
    if (weekday !== 0 && weekday !== 6) sessions += 1;
  }
  return sessions;
}

const etWeekday = once(() => new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' }));

/** "Fri 8:30 AM" for an instant in ms, read in ET: the brief's "Generated" time carries its day. '' for anything but a finite number. */
export function formatHubWeekdayTime(ms) {
  const time = formatHubTime(ms);
  return time ? `${etWeekday().format(new Date(ms))} ${time}` : '';
}
