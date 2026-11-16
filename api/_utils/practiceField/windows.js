// api/_utils/practiceField/windows.js
//
// Practice Field T1a-1 — WHEN the idea book's code acts, in one place (build prompt §3). T1a-1 enters ideas at the
// engine's existing session slots; the founder's five windows (direction note ruling 13; Amendment C §3) arrive in
// T1b, which moves entry to the 11:00, 13:00 and 15:30 windows BY CHANGING THIS MODULE ALONE:
//   • ideaEntrySlots()        — the slots the idea-book pass enters at;
//   • ideaEntryNotBefore(...) — the first moment an admitted idea may enter.
// Nothing else in the idea book names a slot or a clock time. No engine slot is added, moved or renamed here.
//
// The calendar of record is src/utils/marketCalendar.js (through api/_utils/marketSchedule.js): a date outside
// MAINTAINED_HOLIDAY_YEARS is never guessed — every walk here answers null and admission refuses
// `calendar_unsupported`. Pure: no clock is read.

import { getSessionForDate } from '../marketSchedule.js';
import { SLOT_NAMES, resolveSessionSlots } from '../mandateSessionSlots.js';
import { HORIZON_WINDOW_SESSIONS } from '../../../src/constants/hypothesisRecords.js';
import { PRACTICE_FIELD_SLOT_HORIZON } from '../../../src/data/practiceFieldSlots.js';

const DAY_MS = 86_400_000;
/** Calendar days one session step may cover (a long weekend plus a holiday is five). */
const MAX_STEP_DAYS = 12;
const ET_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });

/** The ET calendar date (YYYY-MM-DD) of an epoch-ms instant. */
export function etDateOfMs(ms) {
  return ET_DATE.format(new Date(ms));
}

const nextCalendarDate = (etDate) => {
  const [y, m, d] = etDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12) + DAY_MS).toISOString().slice(0, 10);
};

/** The first trading session strictly after `etDate`, or null when the walk leaves the maintained calendar. */
export function nextSessionDate(etDate) {
  let cursor = etDate;
  for (let i = 0; i < MAX_STEP_DAYS; i += 1) {
    cursor = nextCalendarDate(cursor);
    const s = getSessionForDate(cursor);
    if (!s) return null;
    if (s.isTradingDay) return cursor;
  }
  return null;
}

/** The session `n` trading sessions after `etDate` (itself session 0), or null off the maintained calendar. */
export function sessionAfter(etDate, n) {
  let cursor = etDate;
  for (let i = 0; i < n; i += 1) {
    cursor = nextSessionDate(cursor);
    if (cursor === null) return null;
  }
  return cursor;
}

/** A slot's length in trading sessions, read from the idea record's own window table (Amendment A F2). */
export function slotSessions(slot) {
  const horizon = PRACTICE_FIELD_SLOT_HORIZON[slot];
  const n = horizon ? HORIZON_WINDOW_SESSIONS[horizon] : undefined;
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** The engine slots the idea-book pass enters at. T1b replaces this with the three intraday windows. */
export function ideaEntrySlots() {
  return [...SLOT_NAMES];
}

/** Is `slotName` the LAST entry slot of a session? After it, an idea that has not filled has timed out. */
export function isLastIdeaEntrySlot(slotName) {
  const slots = ideaEntrySlots();
  return slots.length > 0 && slots[slots.length - 1] === slotName;
}

/** The engine slots code sells at: the same windows it enters at (sales first — Amendment E8). */
export function ideaSaleSlots() {
  return ideaEntrySlots();
}

/** The instant a slot opens on a session date (epoch ms), or null when the date is not a session or has no such slot. */
function slotInstantMs(sessionDate, slotName) {
  const session = getSessionForDate(sessionDate);
  const geometry = resolveSessionSlots(sessionDate);
  const slot = geometry?.trading ? geometry.slots.find((s) => s.name === slotName) : null;
  if (!session?.isTradingDay || !slot) return null;
  return session.openMs + (slot.atMin - geometry.openMin) * 60_000;
}

/**
 * THE FIRST ELIGIBLE WINDOW of a sale decided at `decidedAtIso` (Amendment E1: "sold by code at the next eligible
 * observation"; E15: "filled at its first eligible window"): the first sale slot that opens strictly after the
 * decision. A slot's quotes are observed before it opens, so an earlier slot can hold nothing observed after the
 * decision. Returns `{ date, slot, tickKey }`, or null when the instant is unreadable or the walk leaves the calendar.
 */
export function firstWindowAfter(decidedAtIso) {
  const decidedMs = typeof decidedAtIso === 'string' ? Date.parse(decidedAtIso) : NaN;
  if (!Number.isFinite(decidedMs)) return null;
  let date = etDateOfMs(decidedMs);
  for (let i = 0; i <= MAX_STEP_DAYS; i += 1) {
    const session = getSessionForDate(date);
    if (!session) return null;
    if (session.isTradingDay) {
      for (const slot of ideaSaleSlots()) {
        const at = slotInstantMs(date, slot);
        if (at !== null && at > decidedMs) return { date, slot, tickKey: `${date}_${slot}` };
      }
    }
    date = nextCalendarDate(date);
  }
  return null;
}

/** The first sale window that opens strictly after window `w` (`{ date, slot }`) opens, or null. */
export function nextWindowAfter(w) {
  const at = slotInstantMs(w?.date, w?.slot);
  return at === null ? null : firstWindowAfter(new Date(at).toISOString());
}

/** Is window `a` strictly before (−1), the same as (0) or after (1) window `b`? Windows are `{ date, slot }`. */
export function compareWindows(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  const slots = ideaSaleSlots();
  return Math.sign(slots.indexOf(a.slot) - slots.indexOf(b.slot));
}

/**
 * The first moment an idea admitted at `admittedAtIso` may enter: the first entry slot of the first session whose
 * ET date is strictly after the admission's ET date (the session-before-entry rule — Astra V5 B4: the admission
 * day's daily and slot documents may predate the idea's symbols, and an existing shared snapshot is never
 * rebuilt). Returns `{ sessionDate, slot, iso }`, or null when the admission instant is unreadable or that
 * session is off the maintained calendar.
 */
export function ideaEntryNotBefore(admittedAtIso) {
  const admittedMs = typeof admittedAtIso === 'string' ? Date.parse(admittedAtIso) : NaN;
  if (!Number.isFinite(admittedMs)) return null;
  const sessionDate = nextSessionDate(etDateOfMs(admittedMs));
  if (sessionDate === null) return null;
  const session = getSessionForDate(sessionDate);
  const geometry = resolveSessionSlots(sessionDate);
  const slot = ideaEntrySlots()[0];
  const slotGeometry = geometry?.trading ? geometry.slots.find((s) => s.name === slot) : null;
  if (!session?.isTradingDay || !slotGeometry) return null;
  const iso = new Date(session.openMs + (slotGeometry.atMin - geometry.openMin) * 60_000).toISOString();
  return { sessionDate, slot, iso };
}

/**
 * The idea's fixed clock (contract §4.1): `startSession` is the session it may enter in; `dueSession` is the
 * start plus the slot's length in trading sessions (the start is session 0 — the idea record's review-clock
 * convention); `liquidationSession` is the session after the due one, where the settlement sale fills (Amendment
 * E17). Null when any of the three is off the maintained calendar.
 */
export function ideaSchedule(admittedAtIso, slot) {
  const notBefore = ideaEntryNotBefore(admittedAtIso);
  const sessions = slotSessions(slot);
  if (!notBefore || sessions === null) return null;
  const dueSession = sessionAfter(notBefore.sessionDate, sessions);
  if (dueSession === null) return null;
  // E17: the settlement sale fills in the session AFTER the due session, so that one must be on the calendar too.
  const liquidationSession = nextSessionDate(dueSession);
  if (liquidationSession === null) return null;
  return { startSession: notBefore.sessionDate, dueSession, liquidationSession, sessions, entryNotBefore: notBefore };
}
