// api/_utils/practiceField/spend.js
//
// Practice Field T1a-2b-1 — THE MONTHLY SPEND RESERVATION (shared contract V2 §12, slot B9: $3 a month per book;
// build prompt §5). The book's model spend for the Eastern calendar month, held on the book document as
//
//   spend: { month, boundUsd, reservedUsd, settledUsd, exhausted, exhaustedAt, exhaustedBy, ops, lastMonth }
//
//   month        'YYYY-MM', the Eastern calendar month (America/New_York, through Intl — never a hand-rolled offset);
//   reservedUsd  everything the month has COMMITTED: each open reservation at its estimate, each settled call at what
//                it was charged. The bound is checked against this figure, so a settled call and an outstanding one
//                both count;
//   settledUsd   what the month's settled calls were charged;
//   exhausted    set when a reservation is refused for the bound, or a settlement takes the month past it. It stays
//                set for the rest of the month (contract §12: an exhausted budget stops drafting and management calls
//                and sets an honest state on the book); a new month starts empty;
//   ops          one record per operation id, so both calls are idempotent; `lastMonth` keeps the month before, whole,
//                so a call reserved before midnight and settled after it settles against its own month.
//
//   reserveSpend(tx, book, { estimateUsd, purpose, opId, nowIso })
//       BEFORE any model call. If the month's reserved amount plus the estimate would pass the bound — strictly more
//       than $3 — it refuses `spend_exhausted` and sets `exhausted`; exactly $3 is allowed. A replay of the same
//       operation answers what it answered (a reservation is never made twice).
//   settleSpend(tx, book, { opId, actualUsd } | { opId, unpriced: true }, { nowIso })
//       after the call: an UNPRICED call (no price-table entry, a failed or unreadable response) is charged its
//       estimate; a priced one its actual cost. EVERY RETRY COUNTS: a retried model call is another call — the caller
//       reserves it under its own operation id (e.g. `${callId}#2`) — so each attempt is reserved and charged; the
//       same operation id is one reservation, however often its request is replayed.
//
// `book` is the book's DocumentSnapshot as THE CALLER'S transaction read it (`tx.get(bookRef)`); the write is
// `tx.update(book.ref, { spend })`. A caller that also updates the book in the same transaction must not write
// `spend` itself (and, in the in-memory harness, two updates of one document in one transaction keep only the last —
// write once, or use planReserve / planSettle and fold the patch into one update).
//
// NO CALLER EXISTS YET: T1b's model calls are the first. Valuation, sales and settlement never consult it — nothing
// in the money path imports this module (spend.test.js pins that). Amounts are held in integer micro-dollars while
// computed: a model call costs a fraction of a cent.
//
// Pure planning (`planReserve`, `planSettle`) plus the two transactional wrappers.

import { PRACTICE_FIELD_SLOTS } from '../../../src/data/practiceFieldSlots.js';

/** The spend state's own version (its own family; starts at 1). */
export const SPEND_VERSION = 1;
/** B9, the monthly bound per book, USD. */
export const MONTHLY_SPEND_BOUND_USD = PRACTICE_FIELD_SLOTS.B9_MONTHLY_SPEND_BOUND_USD;

const MICROS_PER_USD = 1_000_000;
const micros = (usd) => Math.round(Number(usd) * MICROS_PER_USD);
const usdOf = (m) => m / MICROS_PER_USD;
const isInstant = (v) => typeof v === 'string' && Number.isFinite(Date.parse(v)) && /T/.test(v);
const idOk = (v) => typeof v === 'string' && v.length > 0 && v.length <= 200;
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
    exhausted: false, exhaustedAt: null, exhaustedBy: null, ops: {},
  };
}

/** The book's spend state for `month`: as stored if it is that month's, else a new, empty month (the old one kept). */
export function spendStateFor(stored, month) {
  if (stored && stored.month === month) return { ...stored, ops: { ...(stored.ops || {}) } };
  const next = emptySpendMonth(month);
  if (stored && typeof stored.month === 'string') {
    const { lastMonth: _older, ...previous } = stored;
    next.lastMonth = previous;
  } else {
    next.lastMonth = null;
  }
  return next;
}

/**
 * Plan a reservation. Pure.
 * @returns {{ result: object, next: object|null }}  `next` is the spend state to write, or null when nothing changes
 */
export function planReserve(stored, { estimateUsd, purpose, opId, nowIso }) {
  if (!(typeof estimateUsd === 'number' && Number.isFinite(estimateUsd) && estimateUsd > 0)) throw new Error('reserveSpend: estimateUsd must be a positive number');
  if (!idOk(purpose) || !idOk(opId)) throw new Error('reserveSpend: purpose and opId are required');
  if (!isInstant(nowIso)) throw new Error('reserveSpend: nowIso must be an ISO instant');
  const month = spendMonthOf(nowIso);
  const state = spendStateFor(stored, month);
  // Idempotent on opId — this month's, or the month before's (a replay across midnight is still a replay).
  const prior = state.ops[opId] ?? (state.lastMonth?.ops?.[opId] ? { ...state.lastMonth.ops[opId], month: state.lastMonth.month } : null);
  if (prior) {
    if (prior.purpose !== purpose || micros(prior.estimateUsd) !== micros(estimateUsd)) return { result: { ok: false, code: 'op_id_conflict', opId }, next: null };
    return { result: { ok: true, idempotentReplay: true, opId, month: prior.month ?? state.month, reservedUsd: state.reservedUsd, exhausted: state.exhausted }, next: null };
  }
  const reservedMicros = micros(state.reservedUsd);
  const boundMicros = micros(state.boundUsd ?? MONTHLY_SPEND_BOUND_USD);
  const rolled = !stored || stored.month !== month;
  if (state.exhausted) {
    return { result: { ok: false, code: 'spend_exhausted', month, reservedUsd: state.reservedUsd, boundUsd: state.boundUsd }, next: rolled ? state : null };
  }
  // "Would pass $3": strictly more than the bound. Exactly the bound is allowed.
  if (reservedMicros + micros(estimateUsd) > boundMicros) {
    const next = {
      ...state, exhausted: true, exhaustedAt: nowIso,
      exhaustedBy: { opId, purpose, estimateUsd, reservedUsd: state.reservedUsd, reason: 'reservation_refused' },
    };
    return { result: { ok: false, code: 'spend_exhausted', month, reservedUsd: state.reservedUsd, boundUsd: state.boundUsd }, next };
  }
  const next = {
    ...state,
    reservedUsd: usdOf(reservedMicros + micros(estimateUsd)),
    ops: { ...state.ops, [opId]: { purpose, estimateUsd, reservedAt: nowIso, state: 'reserved', chargedUsd: null, actualUsd: null, unpriced: null, settledAt: null } },
  };
  return { result: { ok: true, idempotentReplay: false, opId, month, reservedUsd: next.reservedUsd, exhausted: false }, next };
}

/**
 * Plan a settlement. Pure.
 * @returns {{ result: object, next: object|null }}
 */
export function planSettle(stored, { opId, actualUsd, unpriced = false, nowIso }) {
  if (!idOk(opId)) throw new Error('settleSpend: opId is required');
  if (!isInstant(nowIso)) throw new Error('settleSpend: nowIso must be an ISO instant');
  const priced = actualUsd !== undefined && actualUsd !== null;
  if (unpriced === true ? priced : !(priced && typeof actualUsd === 'number' && Number.isFinite(actualUsd) && actualUsd >= 0)) {
    throw new Error('settleSpend: exactly one of actualUsd (a number ≥ 0) or unpriced: true');
  }
  const state = spendStateFor(stored, spendMonthOf(nowIso));
  // The reservation's own month: this one, or (reserved before midnight) the month before.
  let where = null;
  if (state.ops[opId]) where = 'current';
  else if (state.lastMonth?.ops?.[opId]) where = 'last';
  if (where === null) return { result: { ok: false, code: 'reservation_not_found', opId }, next: null };
  const month = where === 'current' ? state : { ...state.lastMonth, ops: { ...state.lastMonth.ops } };
  const op = month.ops[opId];
  const chargedMicros = unpriced === true ? micros(op.estimateUsd) : micros(actualUsd);
  if (op.state === 'settled') {
    const same = (op.unpriced === true) === (unpriced === true) && micros(op.chargedUsd) === chargedMicros;
    return { result: same ? { ok: true, idempotentReplay: true, opId, chargedUsd: op.chargedUsd } : { ok: false, code: 'op_id_conflict', opId }, next: null };
  }
  const reservedMicros = micros(month.reservedUsd) - micros(op.estimateUsd) + chargedMicros;
  const settledMicros = micros(month.settledUsd) + chargedMicros;
  const boundMicros = micros(month.boundUsd ?? MONTHLY_SPEND_BOUND_USD);
  // A call that cost more than its estimate cannot be refused — it happened. If it takes the month past the bound,
  // the month is exhausted from now on.
  const overrun = reservedMicros > boundMicros && !month.exhausted;
  const settledMonth = {
    ...month,
    reservedUsd: usdOf(reservedMicros),
    settledUsd: usdOf(settledMicros),
    ...(overrun ? { exhausted: true, exhaustedAt: nowIso, exhaustedBy: { opId, purpose: op.purpose, chargedUsd: usdOf(chargedMicros), reservedUsd: usdOf(reservedMicros), reason: 'settlement_overrun' } } : {}),
    ops: {
      ...month.ops,
      [opId]: { ...op, state: 'settled', chargedUsd: usdOf(chargedMicros), actualUsd: unpriced === true ? null : actualUsd, unpriced: unpriced === true, settledAt: nowIso },
    },
  };
  const next = where === 'current' ? settledMonth : { ...state, lastMonth: settledMonth };
  return { result: { ok: true, idempotentReplay: false, opId, chargedUsd: usdOf(chargedMicros), month: settledMonth.month, reservedUsd: settledMonth.reservedUsd, exhausted: settledMonth.exhausted === true }, next };
}

const snapshotOf = (book) => {
  if (!book || typeof book.data !== 'function' || !book.ref) throw new Error('spend: book must be the DocumentSnapshot the caller\'s transaction read');
  return book.exists ? book.data() : null;
};

/** Reserve before a model call (see the header). Writes `spend` on the book in the caller's transaction. */
export function reserveSpend(tx, book, args) {
  const data = snapshotOf(book);
  if (data === null) return { ok: false, code: 'book_not_found' };
  const { result, next } = planReserve(data.spend ?? null, args);
  if (next) tx.update(book.ref, { spend: next });
  return result;
}

/** Settle a reservation after the call (see the header). Writes `spend` on the book in the caller's transaction. */
export function settleSpend(tx, book, { opId, actualUsd, unpriced } = {}, { nowIso } = {}) {
  const data = snapshotOf(book);
  if (data === null) return { ok: false, code: 'book_not_found' };
  const { result, next } = planSettle(data.spend ?? null, { opId, actualUsd, unpriced, nowIso });
  if (next) tx.update(book.ref, { spend: next });
  return result;
}
