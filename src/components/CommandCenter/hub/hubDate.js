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

const ET_WEEKDAY = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' });
const ET_DATE_KEY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });

/**
 * "8:00 PM" when `ms` is on the same ET day as `nowMs`, "Tue 8:00 PM" on any
 * other (BaggerBomb cleanup C5: a game that ends tomorrow says so). With no
 * usable `nowMs` it is the bare time, as it was. '' for anything but a finite ms.
 */
export function formatHubTimeOnDay(ms, nowMs) {
  const time = formatHubTime(ms);
  if (!time || typeof nowMs !== 'number' || !Number.isFinite(nowMs)) return time;
  if (ET_DATE_KEY.format(new Date(ms)) === ET_DATE_KEY.format(new Date(nowMs))) return time;
  return `${ET_WEEKDAY.format(new Date(ms))} ${time}`;
}

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
