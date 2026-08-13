// api/_utils/mandateSessionSlots.js
//
// Spec 1 — Mandate Substrate — market-calendar gating + session-relative slots
// (§3.1, F17). "The cron fires generously; the handler decides." Eligibility is
// governed by the single market-calendar source of record — marketSchedule
// (NYSE holidays, early closes) — evaluated in America/New_York. Cadence tiers
// map to SESSION-RELATIVE slots (open+30m, midday, pre-close), never raw UTC
// hours. Holidays and post-close half-day ticks are no-ops.
//
// Node-clean, pure. ET wall-clock is derived via Intl (DST-safe, host-TZ
// independent — the mandateCalendar precedent), not the getETDate() local-TZ
// hack. marketSchedule is a CALENDAR source, not a market-fetch client, so this
// module is clean under the §3.0 sole-fetch scan.
//
// LAST-SLOT RULE (F3): the final eligible tick of a session does not submit —
// submission needs a later same-session harvest opportunity. That NO-SUBMIT
// behavior is batch-transport machinery, wired in P5 via `isFinalSessionSlot`
// (session-scoped — the rule's subject) with `isLastSlotForTier` as the
// per-tier view; the construction property joining them (every tier keeps ≥1
// submitting slot under batch) is suite-asserted.

import { isEarlyCloseDay, MAINTAINED_HOLIDAY_YEARS } from './marketSchedule.js';
import { isTradingDayStr } from './mandateCalendar.js';
import { MANDATE_CLOSE_DELAY_MIN, MANDATE_CLOSE_WINDOW_MIN, MANDATE_ROLLOVER_PREOPEN_MIN } from './mandateConfig.js';

const MAX_MAINTAINED_YEAR = Math.max(...MAINTAINED_HOLIDAY_YEARS);

// Session wall-clock (ET). Source of record: marketSchedule.js:23-29
// (MARKET_OPEN 9:30, MARKET_CLOSE 16:00, EARLY_CLOSE 13:00) — those constants are
// module-private there, restated here with provenance (the mandateCalendar
// precedent) rather than reached through a private symbol.
const OPEN_MIN = 9 * 60 + 30;         // 570 — 9:30 ET
const REGULAR_CLOSE_MIN = 16 * 60;    // 960 — 16:00 ET
const EARLY_CLOSE_MIN = 13 * 60;      // 780 — 13:00 ET

// A slot is "active" for this many minutes from its target time. Sized to be
// caught by a generously-firing cron (≥ its interval) while keeping the three
// slots non-overlapping even on the compressed early-close session.
const SLOT_WINDOW_MIN = 30;

export const SLOT_NAMES = Object.freeze(['open30', 'midday', 'preClose']);

// Cadence tier → the session-relative slots at which that tier evaluates (D-19).
// Slow rides an EARLY slot by construction (§3.3): the last-slot rule (F3, P5)
// forbids submitting on the final eligible tick, so a once-daily book must
// evaluate early enough to leave a later harvest tick. Provisional, founder-
// tunable, orthogonal to the §6.3 user-mix assumption.
const TIER_SLOTS = Object.freeze({
  slow: Object.freeze(['open30']),
  standard: Object.freeze(['open30', 'midday']),
  fast: Object.freeze(['open30', 'midday', 'preClose']),
});

// ── ET wall-clock via Intl (DST-safe, host-TZ independent) ───────────────────

function etParts(instant) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(instant).map((x) => [x.type, x.value]),
  );
  return {
    dateStr: `${p.year}-${p.month}-${p.day}`,
    minutes: (Number(p.hour) % 24) * 60 + Number(p.minute),
  };
}

// ── Pure slot geometry ───────────────────────────────────────────────────────

/**
 * The session's slot geometry for a date string. Returns `{ trading:false }` on
 * a weekend/holiday (fail-closed — a non-session is never a slot).
 *
 * @returns {{ trading: boolean, date?, isEarlyClose?, openMin?, closeMin?,
 *             slots?: Array<{name, atMin, windowEndMin}> }}
 */
export function resolveSessionSlots(dateStr) {
  // Fail-closed past the maintained holiday horizon: beyond MAINTAINED_HOLIDAY_YEARS
  // the holiday/early-close tables are empty, so a real 2028+ holiday would read
  // as a full session and books would evaluate on a closed market (arch review F4).
  // Refuse to emit slots until the calendar is extended (the Wire-walker precedent).
  const year = Number(String(dateStr).slice(0, 4));
  if (!Number.isFinite(year) || year > MAX_MAINTAINED_YEAR) return { trading: false, reason: 'beyond_calendar_horizon' };
  if (!isTradingDayStr(dateStr)) return { trading: false };
  const isEarly = isEarlyCloseDay(dateStr);
  const closeMin = isEarly ? EARLY_CLOSE_MIN : REGULAR_CLOSE_MIN;
  const targets = {
    open30: OPEN_MIN + 30,
    midday: Math.round((OPEN_MIN + closeMin) / 2),
    preClose: closeMin - 30,
  };
  const slots = SLOT_NAMES.map((name) => ({
    name,
    atMin: targets[name],
    windowEndMin: Math.min(targets[name] + SLOT_WINDOW_MIN, closeMin),
  }));
  return { trading: true, date: dateStr, isEarlyClose: isEarly, openMin: OPEN_MIN, closeMin, slots };
}

/**
 * Which slot's activation window `minutes` (ET minutes-of-day) falls in for
 * `dateStr`, or null if outside every slot window (pre-open, between slots,
 * post-close). Slot windows are non-overlapping, so at most one matches.
 */
export function slotAtEtMinutes(minutes, dateStr) {
  const s = resolveSessionSlots(dateStr);
  if (!s.trading) return null;
  for (const slot of s.slots) {
    if (minutes >= slot.atMin && minutes < slot.windowEndMin) return slot.name;
  }
  return null;
}

/** Does cadence tier `tier` evaluate at slot `slotName`? Unknown tier → false. */
export function tierEligibleAt(tier, slotName) {
  return (TIER_SLOTS[tier] || []).includes(slotName);
}

/** The ordered slots a tier evaluates at (empty for an unknown tier). */
export function slotsForTier(tier) {
  return [...(TIER_SLOTS[tier] || [])];
}

/** Is `slotName` the LAST slot this tier evaluates at in a session? (F3 input, P5). */
export function isLastSlotForTier(tier, slotName) {
  const slots = TIER_SLOTS[tier] || [];
  return slots.length > 0 && slots[slots.length - 1] === slotName;
}

/**
 * F3 / §3.3 — is `slotName` the session's FINAL eval tick, the one with no
 * later same-session harvest fire? Under BATCH transport submission is
 * forbidden here (wired P5): a batch submitted at the final slot could only be
 * harvested after the close, and every §3.3 safety mechanism would then discard
 * it (cross-session / age-out) — pure spend for a guaranteed discard.
 *
 * SESSION-scoped by definition ("the final eligible tick of a session"): the
 * harvest runs on EVERY eval fire regardless of which tiers evaluate there, so
 * a tier riding an early slot (slow at open30) submits freely — its harvest
 * arrives on the later slots' fires. That is exactly why TIER_SLOTS seats slow
 * early ("submit on their early slot by construction"); the per-TIER view is
 * `isLastSlotForTier` above, and the construction property tying the two —
 * every tier retains at least one submitting slot under batch — is
 * suite-asserted (mandateSessionSlots.test.js, P5).
 *
 * Early-close days shift this slot's WALL CLOCK via the calendar (preClose =
 * closeMin − 30), never its identity — the rule follows automatically.
 */
export function isFinalSessionSlot(slotName) {
  return SLOT_NAMES.length > 0 && SLOT_NAMES[SLOT_NAMES.length - 1] === slotName;
}

/** The platform-wide tick key for a (date, slot): shared by every book at that tick. */
export function buildTickKey(dateStr, slotName) {
  return `${dateStr}_${slotName}`;
}

/**
 * The handler's one-call entry: resolve the evaluation context for a cadence
 * tier at instant `now`.
 *
 * @returns {{
 *   trading: boolean, date: string|null, slot: string|null, eligible: boolean,
 *   tickKey: string|null, isLastSlotForTier: boolean, isEarlyClose: boolean,
 * }}
 */
export function resolveEvalContext(tier, now = new Date()) {
  const { dateStr, minutes } = etParts(now);
  const session = resolveSessionSlots(dateStr);
  if (!session.trading) {
    return { trading: false, date: dateStr, slot: null, eligible: false, tickKey: null, isLastSlotForTier: false, isEarlyClose: false };
  }
  const slot = slotAtEtMinutes(minutes, dateStr);
  const eligible = slot != null && tierEligibleAt(tier, slot);
  return {
    trading: true,
    date: dateStr,
    slot,
    eligible,
    tickKey: slot ? buildTickKey(dateStr, slot) : null,
    isLastSlotForTier: slot ? isLastSlotForTier(tier, slot) : false,
    isEarlyClose: session.isEarlyClose,
  };
}

/**
 * The active slot at instant `now`, tier-independent (drives the platform-wide
 * snapshot tick — the snapshot is built once per active slot regardless of which
 * tiers evaluate). Returns `{ date, slot, tickKey }` or null when no slot is
 * active (non-session, or between/outside slot windows).
 */
export function activeTick(now = new Date()) {
  const { dateStr, minutes } = etParts(now);
  const slot = slotAtEtMinutes(minutes, dateStr);
  if (!slot) return null;
  return { date: dateStr, slot, tickKey: buildTickKey(dateStr, slot) };
}

/**
 * The CLOSE-DUTY window (§3.6, P3): the eval handler's post-close duty runs in
 * [close + MANDATE_CLOSE_DELAY_MIN, close + DELAY + MANDATE_CLOSE_WINDOW_MIN) ET
 * — after the official close print settles, long enough that a generously-firing
 * cron gets several idempotent attempts, and derived from the calendar's
 * closeMin so early-close days shift automatically. This is NOT an eval slot
 * (no model calls happen here); it shares the handler and its schedule (no new
 * cron slot, no vercel.json change — registration itself is P6).
 *
 * The eval slots end AT the close and the close window starts DELAY minutes
 * after it, so with the handler's 300s maxDuration an in-flight eval invocation
 * can never overlap a close invocation in wall-clock — and correctness never
 * rests on that anyway (both sides are revision-preconditioned transactions).
 *
 * Returns `{ date, closeKey }` (closeKey = `${date}_close`) or null outside the
 * window / on a non-session day.
 */
export function activeCloseTick(now = new Date()) {
  const { dateStr, minutes } = etParts(now);
  const session = resolveSessionSlots(dateStr);
  if (!session.trading) return null;
  const start = session.closeMin + MANDATE_CLOSE_DELAY_MIN;
  const end = start + MANDATE_CLOSE_WINDOW_MIN;
  if (minutes < start || minutes >= end) return null;
  return { date: dateStr, closeKey: `${dateStr}_close` };
}

/**
 * The ROLLOVER duty window (§5.3, P4): daily PRE-MARKET on a trading day, in
 * [open − MANDATE_ROLLOVER_PREOPEN_MIN, open) ET. Runs before the session opens
 * so the boundary session's close (already the old quarter's last row) is behind
 * us and the same day's close becomes the new quarter's first row (I4). Disjoint
 * from every eval slot (which start at open+30) and from the post-close window by
 * construction. Correctness never rests on the window — the rollover is
 * idempotent (nextRolloverAt / lastProcessedRolloverKey) and its sweep query
 * filters `nextRolloverAt <= now` — the window only pins WHEN the (P6-registered)
 * cron fires. Returns `{ date, rolloverKey }` or null off-window / non-session.
 */
export function activeRolloverTick(now = new Date()) {
  const { dateStr, minutes } = etParts(now);
  const session = resolveSessionSlots(dateStr);
  if (!session.trading) return null;
  const start = session.openMin - MANDATE_ROLLOVER_PREOPEN_MIN;
  const end = session.openMin; // strictly before the open
  if (minutes < start || minutes >= end) return null;
  return { date: dateStr, rolloverKey: `${dateStr}_rollover` };
}
