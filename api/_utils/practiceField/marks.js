// api/_utils/practiceField/marks.js
//
// Practice Field T1a-1 — THE ELIGIBLE-MARK RULE (build prompt §6 and §7a requirement 1; concept V6.1 §8 "fills
// follow the information"; acceptance cases B-FILL and B-NOFILL).
//
// `eligibleMark` is the ONLY source of a fill price for an idea book. A price qualifies when ALL of these hold:
//   1. the shared slot snapshot holds a complete, positive quote for the symbol;
//   2. the quote carries the VENDOR's own observation time (`quoteTs`) — the snapshot builder substitutes the fetch
//      instant into `priceAsOf` when the vendor omits it (mandateUniverseSnapshot.js assembleFastEntries), so
//      `priceAsOf` alone can never certify a quote; this rule reads `quoteTs`;
//   3. it was observed in the SESSION the fill belongs to — a quote the vendor last printed in an earlier session
//      is a carried-forward mark, and so is anything from a snapshot built for another session;
//   4. it was observed inside that session's regular hours;
//   5. it was observed strictly AFTER the decision it fills (`notBeforeIso` — for a basket entry, the idea's
//      admission time).
// Anything else is a typed refusal and NO FILL of any kind happens on the symbol: not an entry, a trim, a line
// exit or a settlement sale. The quarterly engine's exit fallback to a carried mark or to average cost
// (mandateExecution.js computeExecution's exit lane — the quarterly product's own ruling, untouched) never applies
// to an idea book: executeIdeaFill (fills.js) asks this function first for every leg.
//
// `closeMarkQuality` labels a VALUATION mark from the close snapshot (never a fill): only `vendor_time` supports a
// full-quality row.
//
// Pure: reads no clock and no store.

import { getSessionForDate } from '../marketSchedule.js';
import { MARK_QUALITY } from './constants.js';
import { etDateOfMs } from './windows.js';
import { normSymbol } from './symbols.js';

/** The typed refusals, in the order they are tested. */
export const MARK_REFUSAL = Object.freeze({
  NO_QUOTE: 'no_quote',
  RECEIPT_TIME_ONLY: 'receipt_time_only',
  CARRIED_FORWARD: 'carried_forward',
  OUTSIDE_SESSION: 'outside_session',
  BEFORE_DECISION: 'before_decision',
});

const refuse = (symbol, refusal) => ({ ok: false, symbol, refusal });

/** A quote's price, only when it is a real positive number (never a string, a boolean or Infinity). */
const priceOf = (entry) => (entry && typeof entry.price === 'number' && Number.isFinite(entry.price) && entry.price > 0 ? entry.price : NaN);
/** A vendor observation time in epoch SECONDS, only when it is one (not zero, negative, or milliseconds). */
const vendorSecondsOf = (entry) => (entry && typeof entry.quoteTs === 'number' && Number.isFinite(entry.quoteTs) && entry.quoteTs > 0 && entry.quoteTs < 1e11 ? entry.quoteTs : null);

/**
 * The eligible mark for `symbol` in `snapshot`, or a typed refusal.
 *
 * @param {object} snapshot  a shared slot snapshot (`{ sessionDate, symbols: { SYM: { price, complete, quoteTs } } }`)
 * @param {string} symbol
 * @param {{ notBeforeIso: string, sessionDate: string }} opts  the decision's instant and the fill's session (ET date)
 * @returns {{ ok: true, symbol: string, price: number, quoteTs: number, vendorTimeIso: string }
 *          | { ok: false, symbol: string|null, refusal: string }}
 */
export function eligibleMark(snapshot, symbol, { notBeforeIso, sessionDate } = {}) {
  const sym = normSymbol(symbol);
  const notBeforeMs = typeof notBeforeIso === 'string' ? Date.parse(notBeforeIso) : NaN;
  if (!Number.isFinite(notBeforeMs)) throw new TypeError('eligibleMark: notBeforeIso must be an instant');
  const session = getSessionForDate(sessionDate);
  if (!session || !session.isTradingDay) throw new TypeError(`eligibleMark: ${String(sessionDate)} is not a trading session on the maintained calendar`);

  const entry = sym === null ? null : (snapshot?.symbols?.[sym] ?? null);
  const price = priceOf(entry);
  if (!entry || entry.complete !== true || !(price > 0)) return refuse(sym, MARK_REFUSAL.NO_QUOTE);

  const vendorSeconds = vendorSecondsOf(entry);
  if (vendorSeconds === null) return refuse(sym, MARK_REFUSAL.RECEIPT_TIME_ONLY);
  const vendorMs = vendorSeconds * 1000;

  if (entry.carriedForward === true || snapshot?.sessionDate !== sessionDate || etDateOfMs(vendorMs) < sessionDate) {
    return refuse(sym, MARK_REFUSAL.CARRIED_FORWARD);
  }
  if (vendorMs < session.openMs || vendorMs > session.closeMs) return refuse(sym, MARK_REFUSAL.OUTSIDE_SESSION);
  if (vendorMs <= notBeforeMs) return refuse(sym, MARK_REFUSAL.BEFORE_DECISION);

  return { ok: true, symbol: sym, price, quoteTs: vendorSeconds, vendorTimeIso: new Date(vendorMs).toISOString() };
}

/**
 * The quality of a close-snapshot mark for VALUATION on `sessionDate`:
 *   vendor_time            — a complete quote carrying the vendor's own time, observed on that session's date;
 *   receipt_time_fallback  — a complete quote with no vendor time (the builder stamped its fetch instant);
 *   carried_forward        — no complete quote, or one the vendor last printed on an earlier date.
 *
 * @returns {{ quality: string, vendorTimeIso: string|null }}
 */
export function closeMarkQuality(entry, sessionDate) {
  const price = priceOf(entry);
  if (!entry || entry.complete !== true || !(price > 0)) return { quality: MARK_QUALITY.CARRIED_FORWARD, vendorTimeIso: null };
  const vendorSeconds = vendorSecondsOf(entry);
  if (vendorSeconds === null) return { quality: MARK_QUALITY.RECEIPT_TIME_FALLBACK, vendorTimeIso: null };
  const vendorMs = vendorSeconds * 1000;
  const vendorTimeIso = new Date(vendorMs).toISOString();
  if (entry.carriedForward === true || etDateOfMs(vendorMs) !== sessionDate) return { quality: MARK_QUALITY.CARRIED_FORWARD, vendorTimeIso };
  return { quality: MARK_QUALITY.VENDOR_TIME, vendorTimeIso };
}
