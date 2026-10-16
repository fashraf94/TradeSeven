// src/components/CommandCenter/hub/hubDate.js
//
// Command Center hub, slice S1 — the header eyebrow's date: weekday, month and
// day in US Eastern time, the market's clock (BUILD_RULES §6: Intl with
// America/New_York, never a hand-rolled offset). The design shows
// "Tuesday, October 7".

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

/** The name the header shows: the display name, else the username, else none. */
export function headerName(user) {
  const pick = (v) => (typeof v === 'string' && v.trim() ? v.trim() : '');
  return pick(user?.displayName) || pick(user?.username);
}
