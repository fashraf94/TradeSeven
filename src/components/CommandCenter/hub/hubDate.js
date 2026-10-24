// src/components/CommandCenter/hub/hubDate.js
//
// Command Center hub, slice S1 — the header eyebrow's date: weekday, month and
// day in US Eastern time, the market's clock (BUILD_RULES §6: Intl with
// America/New_York, never a hand-rolled offset). The design shows
// "Tuesday, October 7". Slice S3 adds the record times below.

import { toMillis } from '../../../adapters/baggerbombAdapter';

const ET_DATE = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});

/** "Thursday, October 15" for an instant, read in ET. '' for an invalid date. */
export function formatHubDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return ET_DATE.format(date);
}

const ET_TIME = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour: 'numeric',
  minute: '2-digit',
});

const MINUTE_MS = 60000;

/**
 * "10:42 AM" for an instant in ms since the epoch, read in ET (slice S2a: the
 * deploy display's as-of and cooldown times). `roundUp` reads the next whole
 * minute, so a "next deploy at" time is never earlier than the bound itself.
 * '' for anything but a finite number.
 */
export function formatHubTime(ms, { roundUp = false } = {}) {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return '';
  return ET_TIME.format(new Date(roundUp ? Math.ceil(ms / MINUTE_MS) * MINUTE_MS : ms));
}

// ── Slice S3: record times ───────────────────────────────────────────────

/**
 * ms since the epoch for a record's time — a Firestore timestamp, an ISO
 * time, a Date or a number — through the app's one normalizer
 * (adapters/baggerbombAdapter.js toMillis; spec §8.2). null for anything it
 * cannot read, never a throw.
 */
export function hubMs(raw) {
  try {
    const ms = toMillis(raw);
    return typeof ms === 'number' && Number.isFinite(ms) ? ms : null;
  } catch {
    return null;
  }
}

const ET_DAY = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  month: 'short',
  day: 'numeric',
});

/** "Oct 3" for an instant in ms, read in ET. '' for anything but a finite number. */
export function formatHubDay(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return '';
  return ET_DAY.format(new Date(ms));
}

/**
 * A recorded `lastDeployedAt` as ms for the deploy cooldown's evidence (S2a
 * review A3-9; S2b's provider feeds it to cooldownUntilFrom), or null when it
 * is not a plausible past deploy: unreadable, or further ahead of the clock
 * than one cooldown (clock skew allows a little; more would pin a bound that
 * no deploy made). A past time is always plausible — its cooldown has simply
 * run.
 */
export function lastDeployedAtMs(raw, nowMs, { aheadMs = 120000 } = {}) {
  const ms = hubMs(raw);
  if (ms === null || typeof nowMs !== 'number' || !Number.isFinite(nowMs)) return null;
  return ms <= nowMs + aheadMs ? ms : null;
}

/** The name the header shows: the display name, else the username, else none. */
export function headerName(user) {
  const pick = (v) => (typeof v === 'string' && v.trim() ? v.trim() : '');
  return pick(user?.displayName) || pick(user?.username);
}

// ── Slice S4: Activity's absolute times and the brief's market date ───────

/** A formatter built on first use: this file is in the main bundle (the deploy provider imports it), so a player with the hub off
 * pays for none of S4's at boot. */
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
  return (otherYear(ms, nowMs) ? etDayYear() : ET_DAY).format(new Date(ms));
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
