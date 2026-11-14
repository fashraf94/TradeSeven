// src/components/Research/BattleResearch/readings.js
//
// Battle Research Slice 1 — THE READING STATES (spec
// docs/specs/BATTLE_RESEARCH_SLICE1_SPEC_V1.md §4, BRS-8, BRS-9). ONE pure
// classifier, shared by the row, the explanation and the modal's research
// blocks. PURE and NODE-CLEAN (Slice 2's server re-runs it): no React, no
// clock — every instant is an argument.
//
// CLASSIFIED ONCE, FROZEN WITH THE RESULT. Every quote is classified when its
// result is made, at `takenAt`, and the state is stored in the result
// (result.js). Refining never re-classifies; only a refresh (a new result)
// classifies again. The median is computed ONCE per result, before any
// condition removes a name, over the result's VALID REGULAR-SESSION STOCK
// QUOTES — the membership plus the incumbent, minus crypto, fallback, missing,
// earlier-session, pre-market and after-hours quotes. Fewer than three: the
// relative rule is skipped; the absolute rules still apply.
//
// `classifyMove` checks in the spec's order; the first match wins:
//   unsupported      a crypto
//   fallback         a quote marked isFallback (the client price service's placeholder, H1;
//                    the route never returns one — rejected here if it ever arrives)
//   missing          no snapshot doc; no entry; price.value or previousClose null or ≤ 0;
//                    changePercent null (NEVER derived from the price)
//   missing·no_time  priceAsOf missing, not a finite instant, or after takenAt
//   earlier_session  the quote's sessionEtDate is not the current session's date
//                    (a weekend, a holiday, or before today's first sweep)
//   pre_market       today's session date, priceAsOf before the session's open
//   after_hours      priceAsOf after the session's close (the calendar's close, early closes included)
//   stale·collector_stalled  the symbol's collectionStalled (Phase 0: the stored snapshot
//                    writes false — view.js derives a stall at evaluation; kept for a doc
//                    that ever carries true)
//   stale·old_sweep  during regular trading, the snapshot's sweepAt more than 10 minutes before takenAt
//   stale·old_quote  during regular trading, priceAsOf more than 45 minutes before takenAt
//   stale·behind_rest priceAsOf more than 15 minutes before the result's median
//   ok               otherwise
//
// "During regular trading": takenAt between the session's open and its close on a
// trading day, by the market calendar (marketCalendar.getSessionForDate, the
// calendar horizon.js and checkClock.sessionOpenAt read — 2026 and 2027).
// "Before" and "after" are strict: a quote stamped exactly 9:30:00 or 4:00:00 PM is
// in the session (readings recorded in the build report). DELAYED is not a state:
// every feed quote is delayed, shown by its own time, never called live.

import { getSessionForDate } from '../../../utils/marketCalendar.js';
import { nextSessionDate } from '../../../utils/tapeSchedule.js';
import { etDate, etClockAmPm } from '../BombMode/checkClock.js';
import { pctText } from '../../../screens/battleView/pctText.js';

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const MIN = 60 * 1000;

/** The Slice 1 thresholds (§4). None assumes the vendor's delay. */
export const READING_LIMITS = Object.freeze({
  oldSweepMs: 10 * MIN,
  oldQuoteMs: 45 * MIN,
  behindRestMs: 15 * MIN,
  medianMinQuotes: 3,
});

/** Every state, and the states that take part in move ordering and move conditions (only `ok`). */
export const MOVE_STATES = Object.freeze(['unsupported', 'fallback', 'missing', 'earlier_session', 'pre_market', 'after_hours', 'stale', 'ok']);

/** "Fri" for an ET calendar date (no clock, no zone drift: the date's own noon UTC). */
export function weekdayOfEtDate(d) {
  if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const [y, m, day] = d.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short' }).format(new Date(Date.UTC(y, m - 1, day, 12)));
}
/** "Oct 23" for an ET calendar date. */
export function monthDayOfEtDate(d) {
  if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const [y, m, day] = d.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }).format(new Date(Date.UTC(y, m - 1, day, 12)));
}
/** "Mon, Nov 16" for an ET calendar date. */
export function dayDateOfEtDate(d) {
  const wd = weekdayOfEtDate(d);
  const md = monthDayOfEtDate(d);
  return wd && md ? `${wd}, ${md}` : null;
}

/**
 * The session at an instant, from the calendar of record. `trading` false on a weekend or a
 * holiday; `known` false outside the maintained calendar (then no session is current and every
 * quote is earlier_session — the calendar never guesses).
 */
export function sessionAt(takenAt) {
  if (!finite(takenAt)) return { etDate: null, known: false, trading: false, openMs: null, closeMs: null, previousEtDate: null };
  const today = etDate(takenAt);
  const s = getSessionForDate(today);
  return {
    etDate: today,
    known: !!s,
    trading: !!s && s.isTradingDay === true,
    openMs: s?.openMs ?? null,
    closeMs: s?.closeMs ?? null,
    previousEtDate: s?.previousEtDate ?? null,
  };
}

/** takenAt between the session's open and its close on a trading day (inclusive). */
export function inRegularTrading(session, takenAt) {
  return !!session?.trading && finite(takenAt) && takenAt >= session.openMs && takenAt <= session.closeMs;
}

/** The current session's date: today's when today is a trading day, else none. */
const currentSessionDate = (session) => (session?.trading ? session.etDate : null);

/**
 * The day an earlier-session quote's move belongs to, as the row names it: the weekday for the
 * calendar's last session before today ("Fri"), else the date ("Oct 23" — a name the collector
 * has carried forward for weeks is never passed off as last Friday's).
 */
export function earlierDayLabel(quoteEtDate, session) {
  if (typeof quoteEtDate !== 'string') return null;
  return quoteEtDate === session?.previousEtDate ? weekdayOfEtDate(quoteEtDate) : monthDayOfEtDate(quoteEtDate);
}

const state = (s, cause, words) => ({ state: s, cause, words });

/**
 * The checks that do not depend on the median or the clock's staleness rules (rows 1–7):
 * a state object, or null for a valid regular-session stock quote (the median's population).
 */
export function preClassify({ quote, isCrypto = false, session, snapshot, takenAt }) {
  if (isCrypto) return state('unsupported', null, 'crypto · not compared here');
  if (quote && quote.isFallback === true) return state('fallback', null, 'No real quote yet');
  if (!snapshot || !quote || typeof quote !== 'object') return state('missing', null, 'No price yet');
  if (!(finite(quote.price) && quote.price > 0) || !(finite(quote.previousClose) && quote.previousClose > 0) || !finite(quote.changePercent)) {
    return state('missing', null, 'No price yet');
  }
  if (!finite(quote.priceAsOf) || !finite(takenAt) || quote.priceAsOf > takenAt) return state('missing', 'no_time', 'No quote time');
  const today = currentSessionDate(session);
  if (today === null || quote.sessionEtDate !== today) {
    const day = earlierDayLabel(typeof quote.sessionEtDate === 'string' ? quote.sessionEtDate : etDate(quote.priceAsOf), session);
    return state('earlier_session', null, `${pctText(quote.changePercent)} · ${day ?? 'earlier'}'s move · close`);
  }
  if (quote.priceAsOf < session.openMs) return state('pre_market', null, `Pre-market · ${etClockAmPm(quote.priceAsOf)}`);
  if (quote.priceAsOf > session.closeMs) return state('after_hours', null, `After hours · ${etClockAmPm(quote.priceAsOf)}`);
  return null;
}

/**
 * The median priceAsOf of a result's valid regular-session stock quotes — computed ONCE per
 * result over the whole membership plus the incumbent, before any condition. Null with fewer
 * than three such quotes (the relative rule is then skipped).
 * @param {Array<{ quote, isCrypto }>} entries
 */
export function medianAsOfOf(entries, { session, snapshot, takenAt }) {
  const times = [];
  for (const e of Array.isArray(entries) ? entries : []) {
    if (preClassify({ ...e, session, snapshot, takenAt }) === null) times.push(e.quote.priceAsOf);
  }
  if (times.length < READING_LIMITS.medianMinQuotes) return null;
  times.sort((a, b) => a - b);
  const mid = Math.floor(times.length / 2);
  return times.length % 2 ? times[mid] : Math.round((times[mid - 1] + times[mid]) / 2);
}

/**
 * §4 — one quote's state at `takenAt`: { state, cause, words }. Pure; first match wins.
 * @param {object} p
 * @param {object|null} p.quote      the route's quote ({ price, previousClose, changePercent, priceAsOf, sessionEtDate, collectionStalled }) or null
 * @param {boolean} p.isCrypto
 * @param {object} p.session         sessionAt(takenAt)
 * @param {number|null} p.medianAsOf the result's median (medianAsOfOf)
 * @param {object|null} p.snapshot   the route's doc-level { sweepId, sweepAt, lastSuccessfulSweepAt } or null
 * @param {number} p.takenAt
 */
export function classifyMove({ quote, isCrypto = false, session, medianAsOf = null, snapshot, takenAt }) {
  const pre = preClassify({ quote, isCrypto, session, snapshot, takenAt });
  if (pre) return pre;
  if (quote.collectionStalled === true) return state('stale', 'collector_stalled', 'Price collection stalled for this name');
  const regular = inRegularTrading(session, takenAt);
  if (regular && finite(snapshot?.sweepAt) && takenAt - snapshot.sweepAt > READING_LIMITS.oldSweepMs) {
    return state('stale', 'old_sweep', `Last price sweep at ${etClockAmPm(snapshot.sweepAt)}`);
  }
  if (regular && takenAt - quote.priceAsOf > READING_LIMITS.oldQuoteMs) {
    return state('stale', 'old_quote', `Quote from ${etClockAmPm(quote.priceAsOf)} · over 45 minutes old`);
  }
  if (finite(medianAsOf) && medianAsOf - quote.priceAsOf > READING_LIMITS.behindRestMs) {
    return state('stale', 'behind_rest', `Quote from ${etClockAmPm(quote.priceAsOf)} · older than the rest`);
  }
  return state('ok', null, `${pctText(quote.changePercent)} · ${etClockAmPm(quote.priceAsOf)}`);
}

/**
 * The session's own facts the move lines need: whether today's moves can be ranked (BRS-5,
 * BRS-12 — only once ONE frozen quote is `ok`; the clock passing 9:30 is not enough), and when
 * they cannot, which line the calendar gives:
 *   before_open   a trading day before its open: `Today's session opens at {open} ET`
 *   waiting       the session open (or just closed) with no usable quote yet
 *   closed        a weekend, a holiday, or after the close: the calendar's next session
 * @param {{ states: string[], session: object, takenAt: number }} p  states: the frozen states of the result's STOCK quotes
 */
export function moveAvailability({ states, session, takenAt }) {
  const ok = (Array.isArray(states) ? states : []).includes('ok');
  const afterClose = !!session?.trading && finite(takenAt) && takenAt > session.closeMs;
  const refDate = afterClose ? session.etDate : session?.previousEtDate ?? null;
  const refDay = weekdayOfEtDate(refDate);
  if (ok) return { on: true, reason: null, refDay };
  if (session?.trading && finite(takenAt) && takenAt < session.openMs) {
    return { on: false, reason: 'before_open', openText: etClockAmPm(session.openMs), refDay };
  }
  if (session?.trading && !afterClose) return { on: false, reason: 'waiting', refDay };
  const nextDate = session?.etDate ? nextSessionDate(session.etDate) : null;
  const next = nextDate ? getSessionForDate(nextDate) : null;
  return {
    on: false,
    reason: 'closed',
    refDay,
    next: next && next.isTradingDay ? { etDate: nextDate, dayText: dayDateOfEtDate(nextDate), openText: etClockAmPm(next.openMs) } : null,
  };
}

/**
 * §4's last paragraph: when EVERY one of today's regular-session stock quotes is stale, the board
 * says so once, naming the cause — the last sweep's time when the sweep is old, else the newest
 * quote's time. Null otherwise (any ok quote, or nothing of today's to judge).
 * @param {Array<{ state, cause, priceAsOf }>} rows  the frozen stock rows
 */
export function allStaleOf(rows, snapshot) {
  const today = (Array.isArray(rows) ? rows : []).filter((r) => r && (r.state === 'ok' || r.state === 'stale'));
  if (!today.length || today.some((r) => r.state === 'ok')) return null;
  if (today.some((r) => r.cause === 'old_sweep') && finite(snapshot?.sweepAt)) return { cause: 'old_sweep', atText: etClockAmPm(snapshot.sweepAt) };
  const newest = Math.max(...today.map((r) => (finite(r.priceAsOf) ? r.priceAsOf : -Infinity)));
  return finite(newest) ? { cause: 'no_movement', atText: etClockAmPm(newest) } : null;
}
