// api/_utils/practiceField/spend.js
//
// Practice Field T1a-2b-1 — THE MONTHLY SPEND RESERVATION (shared contract V2 §12, slot B9: $3 a month per book;
// build prompt §5). The book's model spend for the Eastern calendar month.
//
// THE $3 BOUND HOLDS AT THE CHARGE, NOT AT AN ESTIMATE (fix round of 16 Nov 2026, Astra T2B-04; the founder's Q2
// ruling). A call reserves the MOST IT CAN COST, before it is made: its model's prices (api/_utils/modelPriceTable.js,
// MODEL_PRICES_PER_MTOK) times its token ceilings — the input tokens it may send, and `max_tokens` for its output. The
// API cannot bill more output than `max_tokens`, and the caller sends no more input than its ceiling, so a reserved
// call can never take the month past $3. Each input token is reserved at the table's dearest input rate (a cache write,
// CACHE_WRITE_INPUT_MULTIPLIER × the base rate), so no way the call reports its input can cost more than was reserved.
//
// ON THE BOOK, the month's totals only — `spend: { version, month, boundUsd, reservedUsd, settledUsd, exhausted,
// exhaustedAt, exhaustedBy, calls, lastMonth }`:
//   month        'YYYY-MM', the Eastern calendar month (America/New_York, through Intl — never a hand-rolled offset);
//   reservedUsd  everything the month has COMMITTED: each open reservation at its MAXIMUM charge, each settled call at
//                what it was charged. The bound is checked against this figure, so a settled call and an outstanding
//                one both count;
//   settledUsd   what the month's settled calls were charged;
//   exhausted    DERIVED, never sticky (Q2): the month's remaining room — the bound less `reservedUsd` — is below the
//                smallest call T1b will make (constants.js PRACTICE_FIELD_MIN_CALL_MAX_CHARGE_USD, a placeholder T1b
//                sets). Re-derived at every write: a settlement that releases room can end it. `exhaustedAt` /
//                `exhaustedBy` name the write that made the month exhausted, and are cleared when it no longer is. A
//                REFUSED reservation writes nothing at all, so it never exhausts the month;
//   calls        how many reservations the month made; `lastMonth` keeps the month before's totals.
// ONE DOCUMENT PER CALL, `mandates/{bookId}/spendOps/{opId}`, create-once (review B6, B7): the operation's month,
// purpose, model, ceilings, maximum charge and the price table's version; then its state, charge and released room.
// Both calls are idempotent on it for good, and the book document never grows with the number of calls.
//
//   reserveSpend(tx, book, { modelId, maxInputTokens, maxOutputTokens, purpose, opId, nowIso })
//       BEFORE any model call. A model the table does not price is refused `model_unpriced`. A call whose maximum
//       does not fit the month's remaining room — would take `reservedUsd` strictly past $3 — is refused
//       `spend_would_exceed`; exactly $3 is allowed. Neither refusal writes anything. A replay of the same operation
//       answers what it answered (a reservation is never made twice), in any later month too.
//   settleSpend(tx, book, { opId, actualUsd } | { opId, unpriced: true }, { nowIso })
//       after the call: the ACTUAL charge is recorded as it is, against the month the call was reserved in, and the
//       unused part of the reservation is released (`releasedUsd`). A call whose usage cannot be read (a failed or
//       unreadable response) is `unpriced` and charged its reserved maximum — the most it could have cost. A charge
//       ABOVE the reserved maximum should be impossible; if one happens it is recorded as it is, never clamped or
//       hidden, flagged `charge_above_reservation` on the op and the answer, and logged. EVERY RETRY COUNTS: a retried
//       model call is another call — reserved under its own operation id (e.g. `${callId}#2`).
//
// THE PRICE TABLE'S FIGURES ARE NOT VERIFIED HERE: they are checked against Anthropic's published prices before T1b's
// first call (the build report lists them).
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
// last). T1b reserves once per transaction.
//
// NO CALLER EXISTS YET: T1b's model calls are the first. Valuation, sales and settlement never consult it — nothing on
// the money path imports this module (spend.test.js pins that). Amounts are integer micro-dollars while computed: a
// model call costs a fraction of a cent (and a price in $/MTok is exactly micro-dollars per token).

import { PRACTICE_FIELD_SLOTS } from '../../../src/data/practiceFieldSlots.js';
import {
  MODEL_PRICES_PER_MTOK, MODEL_PRICE_TABLE_VERSION, CACHE_WRITE_INPUT_MULTIPLIER, CACHE_READ_INPUT_MULTIPLIER,
} from '../modelPriceTable.js';
import { PRACTICE_FIELD_MIN_CALL_MAX_CHARGE_USD } from './constants.js';

/** The spend state's own version (its own family; 2 since the per-call documents; 3 since maximum-charge reservations). */
export const SPEND_VERSION = 3;
/** B9, the monthly bound per book, USD. */
export const MONTHLY_SPEND_BOUND_USD = PRACTICE_FIELD_SLOTS.B9_MONTHLY_SPEND_BOUND_USD;
/** The per-call documents under a book. */
export const SPEND_OPS_COLLECTION = 'spendOps';
/** The flag a settlement carries when a call cost more than its reserved maximum (it should be impossible). */
export const CHARGE_ABOVE_RESERVATION = 'charge_above_reservation';

const MICROS_PER_USD = 1_000_000;
const micros = (usd) => Math.round(Number(usd) * MICROS_PER_USD);
const usdOf = (m) => m / MICROS_PER_USD;
/** An instant with its own offset: `…Z` or `…±hh:mm` (review B10 — never read in the host's zone). */
const isInstant = (v) => typeof v === 'string' && /T.*(Z|[+-]\d\d:\d\d)$/.test(v) && Number.isFinite(Date.parse(v));
/** An operation id is a document id: a safe, bounded token that cannot be one Firestore reserves (review B11). */
const OP_ID = /^[A-Za-z0-9][A-Za-z0-9_\-:.#]{0,199}$/;
const purposeOk = (v) => typeof v === 'string' && v.length > 0 && v.length <= 100;
const tokensOk = (v) => Number.isSafeInteger(v) && v >= 1;
const ET_MONTH = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit' });

/** The Eastern calendar month (`YYYY-MM`) of an instant. */
export function spendMonthOf(nowIso) {
  const parts = Object.fromEntries(ET_MONTH.formatToParts(new Date(nowIso)).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}`;
}

/**
 * THE MOST A CALL CAN COST, in micro-dollars, or null when the table does not price its model. Every input token at the
 * table's dearest input rate (a cache write; a cache read and the base rate are cheaper), every output token up to
 * `max_tokens` at the output rate, no batch discount — so whatever usage the call reports within its ceilings,
 * modelPriceTable.js priceUsage prices it at no more than this. Rounded UP to the micro-dollar.
 */
export function maxCallChargeMicros({ modelId, maxInputTokens, maxOutputTokens }) {
  const price = Object.hasOwn(MODEL_PRICES_PER_MTOK, modelId ?? '') ? MODEL_PRICES_PER_MTOK[modelId] : null;
  if (!price) return null;
  const inputRate = price.inputPerMTok * Math.max(1, CACHE_WRITE_INPUT_MULTIPLIER, CACHE_READ_INPUT_MULTIPLIER);
  return Math.ceil(maxInputTokens * inputRate + maxOutputTokens * price.outputPerMTok);
}

/** The same, in USD (null when the model is unpriced). */
export function maxCallChargeUsd(call) {
  const m = maxCallChargeMicros(call);
  return m === null ? null : usdOf(m);
}

/** The month's remaining room under the bound, in micro-dollars (negative after a charge above its reservation). */
const roomMicros = (month) => micros(month.boundUsd ?? MONTHLY_SPEND_BOUND_USD) - micros(month.reservedUsd);

/** Is the month exhausted? DERIVED (Q2): its remaining room is below the smallest call T1b will make. */
export function spendExhausted(month) {
  return roomMicros(month) < micros(PRACTICE_FIELD_MIN_CALL_MAX_CHARGE_USD);
}

/**
 * The month with `exhausted` derived again after a write, and `exhaustedAt` / `exhaustedBy` naming the write that made
 * it so — kept while it stays exhausted, cleared when it no longer is.
 */
function withExhaustion(before, after, { nowIso, opId, purpose, reason }) {
  const exhausted = spendExhausted(after);
  if (!exhausted) return { ...after, exhausted: false, exhaustedAt: null, exhaustedBy: null };
  if (before?.exhausted === true && before.exhaustedAt) return { ...after, exhausted: true, exhaustedAt: before.exhaustedAt, exhaustedBy: before.exhaustedBy ?? null };
  return { ...after, exhausted: true, exhaustedAt: nowIso, exhaustedBy: { opId, purpose, reason, roomUsd: usdOf(roomMicros(after)) } };
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

/** The answer to a request whose op is already recorded: the same call (model, ceilings, purpose) is a replay. */
function replayOf(op, { purpose, modelId, maxInputTokens, maxOutputTokens }) {
  const same = op.purpose === purpose && op.modelId === modelId && op.maxInputTokens === maxInputTokens && op.maxOutputTokens === maxOutputTokens;
  if (!same) return { ok: false, code: 'op_id_conflict', opId: op.opId };
  return { ok: true, idempotentReplay: true, opId: op.opId, month: op.month, state: op.state, maxChargeUsd: op.maxChargeUsd };
}

/**
 * Plan a reservation. Pure. `op` is the op's document as read (null when absent).
 * @returns {{ result: object, next: object|null, opDoc: object|null }}  what to write on the book and as the op
 */
export function planReserve(stored, op, { modelId, maxInputTokens, maxOutputTokens, purpose, opId, nowIso }) {
  if (typeof modelId !== 'string' || modelId.length === 0) throw new Error('reserveSpend: modelId is required');
  if (!tokensOk(maxInputTokens) || !tokensOk(maxOutputTokens)) throw new Error('reserveSpend: maxInputTokens and maxOutputTokens must be whole numbers of tokens, at least one');
  if (!purposeOk(purpose)) throw new Error('reserveSpend: purpose is required');
  if (typeof opId !== 'string' || !OP_ID.test(opId)) throw new Error('reserveSpend: opId must be a safe document id');
  if (!isInstant(nowIso)) throw new Error('reserveSpend: nowIso must be an ISO instant with its offset');
  if (op) return { result: replayOf(op, { purpose, modelId, maxInputTokens, maxOutputTokens }), next: null, opDoc: null };
  const maxMicros = maxCallChargeMicros({ modelId, maxInputTokens, maxOutputTokens });
  if (maxMicros === null) return { result: { ok: false, code: 'model_unpriced', modelId, priceTableVersion: MODEL_PRICE_TABLE_VERSION }, next: null, opDoc: null };
  const month = spendMonthOf(nowIso);
  if (stored && typeof stored.month === 'string' && month < stored.month) {
    return { result: { ok: false, code: 'clock_behind_spend_month', month, storedMonth: stored.month }, next: null, opDoc: null };
  }
  const state = spendStateFor(stored, month);
  // "Would pass $3": the month's committed figure plus this call's MAXIMUM, strictly more than the bound. Exactly the
  // bound is allowed. Refused, nothing is written: the month is not exhausted by a refusal (Q2).
  if (micros(state.reservedUsd) + maxMicros > micros(state.boundUsd ?? MONTHLY_SPEND_BOUND_USD)) {
    return {
      result: { ok: false, code: 'spend_would_exceed', month, maxChargeUsd: usdOf(maxMicros), reservedUsd: state.reservedUsd, roomUsd: usdOf(roomMicros(state)), boundUsd: state.boundUsd },
      next: null, opDoc: null,
    };
  }
  const next = withExhaustion(state, { ...state, version: SPEND_VERSION, reservedUsd: usdOf(micros(state.reservedUsd) + maxMicros), calls: (state.calls || 0) + 1 }, { nowIso, opId, purpose, reason: 'reservation' });
  const opDoc = {
    opId, month, purpose, modelId, maxInputTokens, maxOutputTokens, maxChargeUsd: usdOf(maxMicros), priceTableVersion: MODEL_PRICE_TABLE_VERSION,
    state: 'reserved', reservedAt: nowIso, chargedUsd: null, actualUsd: null, unpriced: null, releasedUsd: null, chargeAboveReservation: null, settledAt: null,
  };
  return { result: { ok: true, idempotentReplay: false, opId, month, maxChargeUsd: opDoc.maxChargeUsd, reservedUsd: next.reservedUsd, exhausted: next.exhausted }, next, opDoc };
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
  const reservedMicros = micros(op.maxChargeUsd);
  // An unpriced call (its usage cannot be read) is charged the most it could have cost: its reserved maximum.
  const chargedMicros = unpriced === true ? reservedMicros : micros(actualUsd);
  if (op.state === 'settled') {
    const same = (op.unpriced === true) === (unpriced === true) && micros(op.chargedUsd) === chargedMicros;
    return { result: same ? { ok: true, idempotentReplay: true, opId, chargedUsd: op.chargedUsd, month: op.month } : { ok: false, code: 'op_id_conflict', opId }, next: null, opPatch: null };
  }
  // Recorded as it is, never clamped: what the call cost. Above its maximum it is flagged (and logged by settleSpend).
  const above = chargedMicros > reservedMicros;
  const releasedMicros = above ? 0 : reservedMicros - chargedMicros;
  const flag = above ? { reservedMaxUsd: usdOf(reservedMicros), chargedUsd: usdOf(chargedMicros), overUsd: usdOf(chargedMicros - reservedMicros) } : null;
  // Roll the book's month forward only with a clock that is not behind it; then charge the op's OWN month.
  const nowMonth = spendMonthOf(nowIso);
  const state = spendStateFor(stored, nowMonth);
  const opPatch = {
    state: 'settled', chargedUsd: usdOf(chargedMicros), actualUsd: unpriced === true ? null : actualUsd, unpriced: unpriced === true,
    releasedUsd: usdOf(releasedMicros), chargeAboveReservation: flag, settledAt: nowIso,
  };
  // The month's committed figure moves from the reserved maximum to the charge: the unused part is released.
  const charge = (month) => withExhaustion(month, {
    ...month,
    reservedUsd: usdOf(micros(month.reservedUsd) - reservedMicros + chargedMicros),
    settledUsd: usdOf(micros(month.settledUsd) + chargedMicros),
  }, { nowIso, opId, purpose: op.purpose, reason: above ? CHARGE_ABOVE_RESERVATION : 'settlement' });
  let next;
  let where;
  if (state.month === op.month) { next = charge(state); where = 'current'; }
  else if (state.lastMonth?.month === op.month) { next = { ...state, lastMonth: totalsOf(charge(state.lastMonth)) }; where = 'last'; }
  else {
    // Older than last month: the charge is on the op's own record only; the book changes only if this clock rolled it.
    const rolled = !stored || typeof stored.month !== 'string' || stored.month < nowMonth;
    next = rolled ? state : null;
    where = 'retired';
  }
  const monthAfter = where === 'current' ? next : (where === 'last' ? next.lastMonth : null);
  return {
    result: {
      ok: true, idempotentReplay: false, opId, chargedUsd: usdOf(chargedMicros), releasedUsd: usdOf(releasedMicros), month: op.month,
      ...(monthAfter ? { reservedUsd: monthAfter.reservedUsd, exhausted: monthAfter.exhausted === true } : { monthTotalsRetired: true }),
      ...(above ? { flags: [CHARGE_ABOVE_RESERVATION], chargeAboveReservation: flag } : {}),
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
  if (result.flags?.includes(CHARGE_ABOVE_RESERVATION)) {
    const f = result.chargeAboveReservation;
    console.error(`[PracticeFieldSpend] PRACTICE_FIELD_CHARGE_ABOVE_RESERVATION ${book.ref.id} ${opId} — charged ${f.chargedUsd} USD against a reserved maximum of ${f.reservedMaxUsd} USD (${f.overUsd} over); recorded as charged`);
  }
  return result;
}
