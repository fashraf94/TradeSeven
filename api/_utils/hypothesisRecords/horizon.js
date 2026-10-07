// api/_utils/hypothesisRecords/horizon.js
//
// Pilot P1a — THE REVIEW CLOCK (companion docs/specs/TREND_FOLLOWER_SETUP_DEFINITION_V1.md
// §6, the only place windows are defined; pilot spec §2.5). PURE, epoch-ms:
// no clock is read, no I/O. P1b calls computeReviewDueAt at activation; this
// build ships it tested and uncalled.
//
//   anchor  = the regular session CONTAINING firstDeployedAt (open ≤ t < close),
//             else the NEXT regular session (before the open, after the close,
//             a weekend, a holiday);
//   due     = the CLOSE of the Nth trading session AFTER the anchor session
//             (the anchor is session 0), early closes honored;
//   N       = intraday 2 · swing 10 · positional 30 · longterm 60 (blessed H1–H4);
//   unspecified → null (no clock; review_due comes at battle end, spec §2.5).
//
// ONE calendar for every symbol, crypto included (companion §6): the calendar
// of record, api/_utils/marketSchedule.js `getSessionForDate` (itself the
// re-export of src/utils/marketCalendar.js). An instant or a walk the calendar
// cannot place — a year outside MAINTAINED_HOLIDAY_YEARS — THROWS
// `calendar_unavailable`: a review clock is never guessed, and a silent null
// would read as "unspecified" (the byte-identical-is-a-bug-signal rule: no
// load-bearing silent default).

import { getSessionForDate } from '../marketSchedule.js';
// Window N per enum (companion §6 slots H1–H4) — the one table the Forge also renders from.
import { HORIZON_ENUMS, HORIZON_WINDOW_SESSIONS } from '../../../src/constants/hypothesisRecords.js';

export { HORIZON_WINDOW_SESSIONS };

/** Calendar days a walk may cover before it is called runaway (60 sessions ≈ 87 days; holidays included). */
const MAX_WALK_DAYS = 200;
const DAY_MS = 86_400_000;

const ET_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });

/** A typed failure: `code` ∈ invalid_horizon | invalid_instant | calendar_unavailable. */
export class HorizonClockError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

function etDateOf(ms) {
  return ET_DATE.format(new Date(ms));
}

/** The ET date one calendar day after `etDate` (noon-anchored — DST-safe). */
function nextEtDate(etDate) {
  const [y, m, d] = etDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12) + DAY_MS).toISOString().slice(0, 10);
}

function sessionOrThrow(etDate) {
  const session = getSessionForDate(etDate);
  if (!session) throw new HorizonClockError('calendar_unavailable', `the calendar of record cannot place ${etDate}`);
  return session;
}

/**
 * The anchor session for a deploy instant.
 * @returns {{ etDate: string, openMs: number, closeMs: number }}
 */
export function anchorSessionOf(firstDeployedAtMs) {
  if (typeof firstDeployedAtMs !== 'number' || !Number.isFinite(firstDeployedAtMs)) {
    throw new HorizonClockError('invalid_instant', 'firstDeployedAtMs must be a finite epoch-ms number');
  }
  let etDate = etDateOf(firstDeployedAtMs);
  for (let i = 0; i < MAX_WALK_DAYS; i++) {
    const s = sessionOrThrow(etDate);
    // The session containing the instant, or — the instant before its open — this one is the next.
    if (s.isTradingDay && firstDeployedAtMs < s.closeMs) return { etDate, openMs: s.openMs, closeMs: s.closeMs };
    etDate = nextEtDate(etDate);
  }
  throw new HorizonClockError('calendar_unavailable', 'no regular session found after the deploy instant');
}

/**
 * The review-due instant for a version deployed at `firstDeployedAtMs`.
 *
 * @param {string} horizonEnum  one of HORIZON_ENUMS
 * @param {number} firstDeployedAtMs  the version's first deploy, epoch ms
 * @returns {number|null}  the close of the Nth session after the anchor, or null for `unspecified`
 * @throws {HorizonClockError}
 */
export function computeReviewDueAt(horizonEnum, firstDeployedAtMs) {
  if (!HORIZON_ENUMS.includes(horizonEnum)) throw new HorizonClockError('invalid_horizon', `unknown horizon ${String(horizonEnum)}`);
  if (horizonEnum === 'unspecified') return null;
  const n = HORIZON_WINDOW_SESSIONS[horizonEnum];
  const anchor = anchorSessionOf(firstDeployedAtMs);
  let etDate = anchor.etDate;
  let counted = 0;
  for (let i = 0; i < MAX_WALK_DAYS; i++) {
    etDate = nextEtDate(etDate);
    const s = sessionOrThrow(etDate);
    if (!s.isTradingDay) continue;
    counted += 1;
    if (counted === n) return s.closeMs;
  }
  throw new HorizonClockError('calendar_unavailable', `no ${n}th session within ${MAX_WALK_DAYS} days of the anchor`);
}
