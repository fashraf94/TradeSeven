// api/_utils/huddle/spoken.js
//
// Huddle S1.1 — DATES AS SHADOW SAYS THEM (Amendment E §E3 d; docs/design/SHADOW_VOICE_RULES_V1.md §1.4): a weekday or a
// month and day ("Friday", "November 6"), never ISO. Every date the script's input carries goes through here, so the model
// is never handed "2026-11-06" to repeat (the Nov 9 smoke: "The prior session, 2026-11-06, …"). Pure: Intl only, ET
// (America/New_York) for instants, the calendar date itself for an ET date.

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const SPOKEN_DAY = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric' });
const SPOKEN_INSTANT_DAY = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric' });
const SPOKEN_INSTANT_TIME = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true });

/** "2026-11-06" → "Friday, November 6"; anything else → null. */
export function spokenDateOf(etDate) {
  const m = DATE_ONLY.exec(typeof etDate === 'string' ? etDate : '');
  if (!m) return null;
  return SPOKEN_DAY.format(new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12)));
}

/**
 * When a fact is from, as said aloud: an ET date → "Friday, November 6"; an instant → its ET day and clock, "Sunday,
 * November 8, 5:00 PM ET"; nothing readable → null.
 */
export function spokenWhenOf(value) {
  if (typeof value !== 'string' || !value) return null;
  if (DATE_ONLY.test(value)) return spokenDateOf(value);
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  return `${SPOKEN_INSTANT_DAY.format(new Date(ms))}, ${SPOKEN_INSTANT_TIME.format(new Date(ms))} ET`;
}
