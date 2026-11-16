// api/_utils/practiceField/spend.js
//
// Practice Field T1a-2b-1 — THE MONTHLY SPEND RESERVATION (shared contract V2 §12, slot B9: $3 a month per book;
// build prompt §5). The book's model spend for the Eastern calendar month.
//
// ON THE BOOK, the month's totals only — `spend: { month, boundUsd, reservedUsd, settledUsd, exhausted, exhaustedAt,
// exhaustedBy, calls, lastMonth }`:
//   month        'YYYY-MM', the Eastern calendar month (America/New_York, through Intl — never a hand-rolled offset);
//   reservedUsd  everything the month has COMMITTED: each open reservation at its estimate, each settled call at what
//                it was charged. The bound is checked against this figure, so a settled call and an outstanding one
//                both count;
//   settledUsd   what the month's settled calls were charged;
//   exhausted    set when a reservation is refused for the bound, or a settlement takes the month past it. It stays
//                set for the rest of the month (contract §12: an exhausted budget stops drafting and management calls
//                and sets an honest state on the book); a new month starts empty;
//   calls        how many reservations the month made; `lastMonth` keeps the month before's totals.
// ONE DOCUMENT PER CALL, `mandates/{bookId}/spendOps/{opId}`, create-once (review B6, B7): the operation's month,
// purpose, estimate, state and charge. Both calls are idempotent on it for good, and the book document never grows
// with the number of calls (a month of sub-cent calls held on the book could pass Firestore's 1 MiB document limit
// and block every write of the book, valuation's included).
//
//   reserveSpend(tx, book, { estimateUsd, purpose, opId, nowIso })
//       BEFORE any model call. If the month's reserved amount plus the estimate would pass the bound — strictly more
//       than $3 — it refuses `spend_exhausted` and sets `exhausted`; exactly $3 is allowed. A replay of the same
//       operation answers what it answered (a reservation is never made twice), in any later month too.
//   settleSpend(tx, book, { opId, actualUsd } | { opId, unpriced: true }, { nowIso })
//       after the call: an UNPRICED call (no price-table entry, a failed or unreadable response) is charged its
//       estimate; a priced one its actual cost — against the month the call was reserved in. EVERY RETRY COUNTS: a
//       retried model call is another call — the caller reserves it under its own operation id (e.g. `${callId}#2`) —
//       so each attempt is reserved and charged; the same operation id is one reservation, however often its request
//       is replayed.
//
// A CLOCK BEHIND THE BOOK (review B5). A `nowIso` in an EARLIER month than the book's stored one (a clock read before a
// contended transaction re-ran after another call had rolled the month) is not a new month: a reservation is refused
// `clock_behind_spend_month` (the caller retries with a fresh clock) and a settlement settles against the op's own
// month without rolling anything.
//
// THE CALLER'S TRANSACTION. `book` is the book's DocumentSnapshot as the caller's transaction read it
// (`tx.get(bookRef)`). Both functions then READ the op's document in that transaction, so they must be called before
// the transaction writes anything (Firestore refuses a read after a write). They write `spend` on the book with
// `tx.update(book.ref, { spend })` and the op's document; a caller that also updates the book in the same transaction
// must not write `spend` itself (in the in-memory harness two updates of one document in one transaction keep only the
// last).
//
// NO CALLER EXISTS YET: T1b's model calls are the first. Valuation, sales and settlement never consult it — nothing on
// the money path imports this module (spend.test.js pins that). Amounts are integer micro-dollars while computed: a
// model call costs a fraction of a cent.

import { PRACTICE_FIELD_SLOTS } from '../../../src/data/practiceFieldSlots.js';

/** The spend state's own version (its own family; starts at 1; 2 since the per-call documents). */
export const SPEND_VERSION = 2;
/** B9, the monthly bound per book, USD. */
export const MONTHLY_SPEND_BOUND_USD = PRACTICE_FIELD_SLOTS.B9_MONTHLY_SPEND_BOUND_USD;
/** The per-call documents under a book. */
export const SPEND_OPS_COLLECTION = 'spendOps';

const MICROS_PER_USD = 1_000_000;
const micros = (usd) => Math.round(Number(usd) * MICROS_PER_USD);
const usdOf = (m) => m / MICROS_PER_USD;
/** An instant with its own offset: `…Z` or `…±hh:mm` (review B10 — never read in the host's zone). */
const isInstant = (v) => typeof v === 'string' && /T.*(Z|[+-]\d\d:\d\d)$/.test(v) && Number.isFinite(Date.parse(v));
/** An operation id is a document id: a safe, bounded token that cannot be one Firestore reserves (review B11). */
const OP_ID = /^[A-Za-z0-9][A-Za-z0-9_\-:.#]{0,199}$/;
const purposeOk = (v) => typeof v === 'string' && v.length > 0 && v.length <= 100;
const ET_MONTH = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit' });

/** The Eastern calendar month (`YYYY-MM`) of an instant. */
export function spendMonthOf(nowIso) {
  const parts = Object.fromEntries(ET_MONTH.formatToParts(new Date(nowIso)).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}`;
}

/** An empty month. */
export function emptySpendMonth(month) {
  return {
    version: SPEND_VERSION, month, boundUsd: MONTHLY_SPEND_BOUND_USD, reservedUsd: 0, settledUsd: 0,
    exhausted: false, exhaustedAt: null, exhaustedBy: null, calls: 0,
  };
}

const totalsOf = (s) => ({
  month: s.month, reservedUsd: s.reservedUsd ?? 0, settledUsd: s.settledUsd ?? 0, exhausted: s.exhausted === true, calls: s.calls ?? 0,
});

/**
 * The book's spend state at `month`: as stored if it is that month's (or a LATER one — the clock is behind; the caller
 * decides), else a new, empty month with the stored one's totals kept as last month.
 */
export function spendStateFor(stored, month) {
  if (stored && typeof stored.month === 'string' && stored.month >= month) return { ...stored };
  const next = emptySpendMonth(month);
  next.lastMonth = stored && typeof stored.month === 'string' ? totalsOf(stored) : null;
  return next;
}

/** The answer to a request whose op is already recorded. */
function replayOf(op, { purpose, estimateUsd }) {
  if (op.purpose !== purpose || micros(op.estimateUsd) !== micros(estimateUsd)) return { ok: false, code: 'op_id_conflict', opId: op.opId };
  return { ok: true, idempotentReplay: true, opId: op.opId, month: op.month, state: op.state };
}

/**
 * Plan a reservation. Pure. `op` is the op's document as read (null when absent).
 * @returns {{ result: object, next: object|null, opDoc: object|null }}  what to write on the book and as the op
 */
export function planReserve(stored, op, { estimateUsd, purpose, opId, nowIso }) {
  if (!(typeof estimateUsd === 'number' && Number.isFinite(estimateUsd) && micros(estimateUsd) >= 1)) throw new Error('reserveSpend: estimateUsd must be a positive number of at least one micro-dollar');
  if (!purposeOk(purpose)) throw new Error('reserveSpend: purpose is required');
  if (typeof opId !== 'string' || !OP_ID.test(opId)) throw new Error('reserveSpend: opId must be a safe document id');
  if (!isInstant(nowIso)) throw new Error('reserveSpend: nowIso must be an ISO instant with its offset');
  if (op) return { result: replayOf(op, { purpose, estimateUsd }), next: null, opDoc: null };
  const month = spendMonthOf(nowIso);
  if (stored && typeof stored.month === 'string' && month < stored.month) {
    return { result: { ok: false, code: 'clock_behind_spend_month', month, storedMonth: stored.month }, next: null, opDoc: null };
  }
  const state = spendStateFor(stored, month);
  if (state.exhausted) {
    return { result: { ok: false, code: 'spend_exhausted', month, reservedUsd: state.reservedUsd, boundUsd: state.boundUsd }, next: null, opDoc: null };
  }
  const reservedMicros = micros(state.reservedUsd);
  const boundMicros = micros(state.boundUsd ?? MONTHLY_SPEND_BOUND_USD);
  // "Would pass $3": strictly more than the bound. Exactly the bound is allowed.
  if (reservedMicros + micros(estimateUsd) > boundMicros) {
    const next = {
      ...state, exhausted: true, exhaustedAt: nowIso,
      exhaustedBy: { opId, purpose, estimateUsd, reservedUsd: state.reservedUsd, reason: 'reservation_refused' },
    };
    return { result: { ok: false, code: 'spend_exhausted', month, reservedUsd: state.reservedUsd, boundUsd: state.boundUsd }, next, opDoc: null };
  }
  const next = { ...state, reservedUsd: usdOf(reservedMicros + micros(estimateUsd)), calls: (state.calls || 0) + 1 };
  const opDoc = {
    opId, month, purpose, estimateUsd, state: 'reserved', reservedAt: nowIso, chargedUsd: null, actualUsd: null, unpriced: null, settledAt: null,
  };
  return { result: { ok: true, idempotentReplay: false, opId, month, reservedUsd: next.reservedUsd, exhausted: false }, next, opDoc };
}

/**
 * Plan a settlement. Pure. `op` is the op's document as read (null when absent).
 * @returns {{ result: object, next: object|null, opPatch: object|null }}
 */
export function planSettle(stored, op, { opId, actualUsd, unpriced = false, nowIso }) {
  if (typeof opId !== 'string' || !OP_ID.test(opId)) throw new Error('settleSpend: opId must be a safe document id');
  if (!isInstant(nowIso)) throw new Error('settleSpend: nowIso must be an ISO instant with its offset');
  const priced = actualUsd !== undefined && actualUsd !== null;
  if (unpriced === true ? priced : !(priced && typeof actualUsd === 'number' && Number.isFinite(actualUsd) && actualUsd >= 0)) {
    throw new Error('settleSpend: exactly one of actualUsd (a number ≥ 0) or unpriced: true');
  }
  if (!op) return { result: { ok: false, code: 'reservation_not_found', opId }, next: null, opPatch: null };
  const chargedMicros = unpriced === true ? micros(op.estimateUsd) : micros(actualUsd);
  if (op.state === 'settled') {
    const same = (op.unpriced === true) === (unpriced === true) && micros(op.chargedUsd) === chargedMicros;
    return { result: same ? { ok: true, idempotentReplay: true, opId, chargedUsd: op.chargedUsd, month: op.month } : { ok: false, code: 'op_id_conflict', opId }, next: null, opPatch: null };
  }
  // Roll the book's month forward only with a clock that is not behind it; then charge the op's OWN month.
  const nowMonth = spendMonthOf(nowIso);
  const state = spendStateFor(stored, nowMonth);
  const opPatch = { state: 'settled', chargedUsd: usdOf(chargedMicros), actualUsd: unpriced === true ? null : actualUsd, unpriced: unpriced === true, settledAt: nowIso };
  const charge = (month) => {
    const reservedMicros = micros(month.reservedUsd) - micros(op.estimateUsd) + chargedMicros;
    const boundMicros = micros(month.boundUsd ?? MONTHLY_SPEND_BOUND_USD);
    // A call that cost more than its estimate cannot be refused — it happened. Past the bound, the month is exhausted.
    const overrun = reservedMicros > boundMicros && !month.exhausted;
    return {
      ...month,
      reservedUsd: usdOf(reservedMicros),
      settledUsd: usdOf(micros(month.settledUsd) + chargedMicros),
      ...(overrun ? { exhausted: true, exhaustedAt: nowIso, exhaustedBy: { opId, purpose: op.purpose, chargedUsd: usdOf(chargedMicros), reservedUsd: usdOf(reservedMicros), reason: 'settlement_overrun' } } : {}),
    };
  };
  let next;
  let where;
  if (state.month === op.month) { next = charge(state); where = 'current'; }
  else if (state.lastMonth?.month === op.month) { next = { ...state, lastMonth: charge(state.lastMonth) }; where = 'last'; }
  else {
    // Older than last month: the charge is on the op's own record only; the book changes only if this clock rolled it.
    const rolled = !stored || typeof stored.month !== 'string' || stored.month < nowMonth;
    next = rolled ? state : null;
    where = 'retired';
  }
  const monthAfter = where === 'current' ? next : (where === 'last' ? next.lastMonth : null);
  return {
    result: {
      ok: true, idempotentReplay: false, opId, chargedUsd: usdOf(chargedMicros), month: op.month,
      ...(monthAfter ? { reservedUsd: monthAfter.reservedUsd, exhausted: monthAfter.exhausted === true } : { monthTotalsRetired: true }),
    },
    next,
    opPatch,
  };
}

const snapshotOf = (book) => {
  if (!book || typeof book.data !== 'function' || !book.ref) throw new Error('spend: book must be the DocumentSnapshot the caller\'s transaction read');
  return book.exists ? book.data() : null;
};
const opRefOf = (book, opId) => book.ref.collection(SPEND_OPS_COLLECTION).doc(opId);

/** Reserve before a model call (see the header). Reads the op, then writes the op and `spend`, in the caller's transaction. */
export async function reserveSpend(tx, book, args) {
  const data = snapshotOf(book);
  if (data === null) return { ok: false, code: 'book_not_found' };
  if (typeof args?.opId !== 'string' || !OP_ID.test(args.opId)) throw new Error('reserveSpend: opId must be a safe document id');
  const opRef = opRefOf(book, args.opId);
  const opSnap = await tx.get(opRef);
  const { result, next, opDoc } = planReserve(data.spend ?? null, opSnap.exists ? opSnap.data() : null, args);
  if (opDoc) tx.create(opRef, opDoc);
  if (next) tx.update(book.ref, { spend: next });
  return result;
}

/** Settle a reservation after the call (see the header). Reads the op, then writes it and `spend`, in the caller's transaction. */
export async function settleSpend(tx, book, { opId, actualUsd, unpriced } = {}, { nowIso } = {}) {
  const data = snapshotOf(book);
  if (data === null) return { ok: false, code: 'book_not_found' };
  if (typeof opId !== 'string' || !OP_ID.test(opId)) throw new Error('settleSpend: opId must be a safe document id');
  const opRef = opRefOf(book, opId);
  const opSnap = await tx.get(opRef);
  const { result, next, opPatch } = planSettle(data.spend ?? null, opSnap.exists ? opSnap.data() : null, { opId, actualUsd, unpriced, nowIso });
  if (opPatch) tx.update(opRef, opPatch);
  if (next) tx.update(book.ref, { spend: next });
  return result;
}
