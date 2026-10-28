// src/components/CommandCenter/hub/activityDates.js
//
// Command Center hub, slice S4 — Activity's absolute times and the brief's market date. They live apart from hub/hubDate.js on purpose:
// the deploy provider (App's root) imports hubDate.js, so everything in it ships in the main bundle for every player, hub on or off;
// only the hub (a lazy chunk) imports this file. Like hubDate.js it is the one place that builds an Intl formatter for these:
// the derivations (hub/activityRows.js, hub/nextAction.js) never do, and take their clock as an argument.

import { formatHubDay } from './hubDate';

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
  const m = typeof text === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(text) : null;
  if (!m) return '';
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(Date.UTC(year, month - 1, day, 12));
  // A day past the month's end (Feb 30, day 00) rolls the month, a month 00 or 13 rolls the year, and a year under 100 is read as 19xx:
  // each lands on a different year or month, so these two comparisons are the whole calendar check.
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1) return '';
  const parts = Object.fromEntries(marketDayParts().formatToParts(probe).map((p) => [p.type, p.value]));
  return `${parts.weekday} ${parts.month} ${parts.day}`;
}
