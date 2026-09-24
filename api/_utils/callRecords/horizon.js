// api/_utils/callRecords/horizon.js
//
// Cockpit Build 0 — the call-record horizon (spec docs/design/COCKPIT_SPEC_V1_3.md
// §3.5; contract docs/CALL_RECORD_FIELD_CONTRACT_V1_3.md §5). PURE, epoch-ms
// throughout: no clock is read, no I/O. The only calendar is the file of record
// (api/_utils/marketSchedule.js `getSessionForDate`), and an instant it cannot
// place — an unmaintained year — is `calendar_unavailable`, never a guess.
//
// THE SCHEDULE. `next_check` is the first ELIGIBLE EVALUATOR SLOT strictly
// after `promptBuiltAt`: a UTC candidate of the registered cron expression for
// /api/cron/agent-evaluate (`*/15 13,14,15,16,17,18,19,20,21 * * 1-5`, pinned
// against vercel.json by horizon.test.js so cadence drift fails a test), kept
// only when `openMs <= slot < closeMs` for that date's session — the close
// instant itself is never a slot — and only when `slot < battleExpiresAtMs`.
// Never `lastCheckedAt + interval`; a skipped slot is the sweep's to catch.
//
// Between 13:00 and 21:45 UTC the UTC calendar date IS the ET date (ET is
// UTC−4 or UTC−5), so a slot is built on the ET date's own Y-M-D and the cron's
// day-of-week field (evaluated in UTC by Vercel) is read off that same date.

import { getSessionForDate } from '../marketSchedule.js';

/** The registered evaluator entry (vercel.json) this module mirrors. */
export const EVALUATOR_SCHEDULE = Object.freeze({
  path: '/api/cron/agent-evaluate',
  schedule: '*/15 13,14,15,16,17,18,19,20,21 * * 1-5',
});

/** The schedule, expanded: UTC minutes × UTC hours × UTC days-of-week (0 = Sunday). */
export const EVALUATOR_SLOTS = Object.freeze({
  minutesUtc: Object.freeze([0, 15, 30, 45]),
  hoursUtc: Object.freeze([13, 14, 15, 16, 17, 18, 19, 20, 21]),
  weekdaysUtc: Object.freeze([1, 2, 3, 4, 5]),
});

/** The basis literals a resolved horizon carries. */
export const HORIZON_BASES = Object.freeze(['next_check', 'this_session', 'this_battle', 'explicit']);

/** The malformed reasons a horizon resolution can return (contract §5). */
export const HORIZON_FAILURES = Object.freeze(['no_slot_before_battle_end', 'calendar_unavailable', 'explicit_invalid']);

/** How far forward a walk looks before giving up (two calendar weeks). */
const MAX_WALK_DAYS = 14;
const DAY_MS = 86_400_000;

const finite = (v) => typeof v === 'number' && Number.isFinite(v);

const ET_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });

/** The ET calendar date (YYYY-MM-DD) an instant falls on. */
export function etDateOf(ms) {
  return ET_DATE.format(new Date(ms));
}

/** The ET date one calendar day after `etDate` (noon-anchored — DST-safe). */
function nextEtDate(etDate) {
  const [y, m, d] = etDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12) + DAY_MS).toISOString().slice(0, 10);
}

/** 00:00 UTC of a calendar date — earlier than any slot on it. */
function utcMidnight(etDate) {
  const [y, m, d] = etDate.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Every eligible evaluator slot on one ET date's session, ascending (or null when the calendar cannot say). */
export function eligibleSlotsOn(etDate) {
  const session = getSessionForDate(etDate);
  if (!session) return null;
  if (!session.isTradingDay) return [];
  const [y, m, d] = etDate.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
  if (!EVALUATOR_SLOTS.weekdaysUtc.includes(weekday)) return [];
  const slots = [];
  for (const h of EVALUATOR_SLOTS.hoursUtc) {
    for (const min of EVALUATOR_SLOTS.minutesUtc) {
      const slot = Date.UTC(y, m - 1, d, h, min, 0);
      // The close instant is exclusive: a slot AT the close is never scheduled.
      if (slot >= session.openMs && slot < session.closeMs) slots.push(slot);
    }
  }
  return slots;
}

/**
 * The first eligible evaluator slot strictly after `afterMs` and strictly
 * before the battle's end.
 *
 * @returns {{ slotMs: number } | { reason: 'no_slot_before_battle_end' | 'calendar_unavailable' }}
 */
export function nextEligibleSlot(afterMs, { battleExpiresAtMs } = {}) {
  if (!finite(afterMs)) return { reason: 'calendar_unavailable' };
  let etDate = etDateOf(afterMs);
  for (let i = 0; i < MAX_WALK_DAYS; i++) {
    const slots = eligibleSlotsOn(etDate);
    if (slots === null) return { reason: 'calendar_unavailable' };
    const slot = slots.find((s) => s > afterMs);
    if (slot !== undefined) {
      return finite(battleExpiresAtMs) && slot < battleExpiresAtMs ? { slotMs: slot } : { reason: 'no_slot_before_battle_end' };
    }
    etDate = nextEtDate(etDate);
    // Past the battle's end there is nothing left to find.
    if (finite(battleExpiresAtMs) && utcMidnight(etDate) > battleExpiresAtMs) {
      return { reason: 'no_slot_before_battle_end' };
    }
  }
  return { reason: 'calendar_unavailable' };
}

/**
 * The close of the regular session a call minted at `mintedAtMs` belongs to:
 * the session in progress, else the NEXT regular session (a call minted before
 * the open, after the close, on a weekend or a holiday). Early closes honored.
 *
 * @returns {{ closeMs: number } | { reason: 'calendar_unavailable' }}
 */
export function sessionCloseAfter(mintedAtMs) {
  if (!finite(mintedAtMs)) return { reason: 'calendar_unavailable' };
  let etDate = etDateOf(mintedAtMs);
  for (let i = 0; i < MAX_WALK_DAYS; i++) {
    const session = getSessionForDate(etDate);
    if (!session) return { reason: 'calendar_unavailable' };
    if (session.isTradingDay && session.closeMs > mintedAtMs) return { closeMs: session.closeMs };
    etDate = nextEtDate(etDate);
  }
  return { reason: 'calendar_unavailable' };
}

/**
 * Resolve a declared horizon phrase to a market-time instant (contract §5).
 *
 *   next_check   → the first eligible evaluator slot strictly after promptBuiltAt, before battle end
 *   this_session → the close of the session the call is minted in (or the next one)
 *   this_battle  → the battle's own expiry
 *   explicit     → the declared expiresAtMs, which must be strictly after the MINT
 *                  instant (not the prompt's — an expiry crossed between prompt
 *                  build and mint is malformed); an instant beyond the battle's
 *                  end is clamped to it, an instant in the past never is
 *
 * @returns {{ expiresAtMs: number, basis: string } | { reason: string }}
 */
export function resolveHorizon(phrase, { promptBuiltAtMs, mintedAtMs, battleExpiresAtMs, expiresAtMs } = {}) {
  switch (phrase) {
    case 'next_check': {
      const next = nextEligibleSlot(promptBuiltAtMs, { battleExpiresAtMs });
      return 'reason' in next ? next : { expiresAtMs: next.slotMs, basis: 'next_check' };
    }
    case 'this_session': {
      const close = sessionCloseAfter(mintedAtMs);
      return 'reason' in close ? close : { expiresAtMs: close.closeMs, basis: 'this_session' };
    }
    case 'this_battle':
      return finite(battleExpiresAtMs) ? { expiresAtMs: battleExpiresAtMs, basis: 'this_battle' } : { reason: 'no_slot_before_battle_end' };
    case 'explicit': {
      if (!finite(expiresAtMs) || !finite(mintedAtMs) || expiresAtMs <= mintedAtMs) return { reason: 'explicit_invalid' };
      const clamped = finite(battleExpiresAtMs) && expiresAtMs > battleExpiresAtMs ? battleExpiresAtMs : expiresAtMs;
      return { expiresAtMs: clamped, basis: 'explicit' };
    }
    default:
      return { reason: 'explicit_invalid' };
  }
}

/** The resolver bound to one check's instants — the shape validateDeclarations takes. */
export function bindHorizon({ promptBuiltAtMs, mintedAtMs, battleExpiresAtMs }) {
  return (phrase, expiresAtMs) => resolveHorizon(phrase, { promptBuiltAtMs, mintedAtMs, battleExpiresAtMs, expiresAtMs });
}

/**
 * The battle's end as epoch ms, from the stored `expiresAt` (an ISO string on
 * every battle this cron evaluates; a Timestamp-like or a number is read too).
 * NaN when it cannot be read — every horizon that needs it then fails typed.
 */
export function battleExpiryMs(battle) {
  const v = battle?.expiresAt;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return Date.parse(v);
  if (v && typeof v.toMillis === 'function') {
    try { return v.toMillis(); } catch { return Number.NaN; }
  }
  return Number.NaN;
}
