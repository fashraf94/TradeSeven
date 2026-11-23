// api/_utils/practiceField/spend.test.js
//
// Practice Field T1a-2b-1 §5 — THE MONTHLY SPEND RESERVATION (contract V2 §12; B9: $3 a month per book), as the fix round
// of 16 Nov 2026 rebuilt it (Astra T2B-04; the founder's Q2 ruling). A call reserves the MOST IT CAN COST — its model's
// prices (modelPriceTable.js) times its token ceilings — before it is made: an unpriced model is refused, a call whose
// maximum does not fit the month's room is refused, and a refusal writes nothing (the month is not exhausted by it).
// `exhausted` is derived: the room is below the smallest call T1b will make. At settlement the actual charge is recorded
// as it is and the unused part released; a charge above the reserved maximum is recorded, flagged and logged. The
// Eastern calendar month; idempotent on the operation id — each call its own create-once document, so the book keeps
// only the month's totals. No caller exists yet — and nothing on the money path imports the module.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { setPracticeFieldModeForTests } from './mode.js';
import {
  reserveSpend, settleSpend, planReserve, planSettle, spendMonthOf, maxCallChargeUsd, maxCallChargeMicros, spendExhausted,
  incurredChargeNanos, MONTHLY_SPEND_BOUND_USD, CHARGE_ABOVE_RESERVATION,
} from './spend.js';
import { PRACTICE_FIELD_MIN_CALL_MAX_CHARGE_USD } from './constants.js';
import { MODEL_PRICES_PER_MTOK, MODEL_PRICE_TABLE_VERSION, priceUsage } from '../modelPriceTable.js';
import { PRACTICE_FIELD_SLOTS } from '../../../src/data/practiceFieldSlots.js';
import { seedBook, getBook, countDocs } from './__testsupport__/fixtures.js';

const NOV = '2026-11-17T15:00:00.000Z';
const HAIKU = 'claude-haiku-4-5';
/**
 * A call on the priced model with these ceilings, a 5-minute cache at most and no server tool. At $1 / $5 per MTok, the
 * most it can cost is in × 1.25 + out × 5 µ$.
 */
const call = (maxInputTokens, maxOutputTokens, over = {}) => ({ modelId: HAIKU, maxInputTokens, maxOutputTokens, cacheTtl: '5m', serverTools: [], ...over });
/** The calls the rows use, by the most each can cost. */
const C015 = call(8_000, 1_000); //          $0.015
const C010 = call(72_000, 2_000); //         $0.10
const C050 = call(320_000, 20_000); //       $0.50
const C150 = call(80_000, 10_000); //        $0.15
const C020 = call(80_000, 20_000); //        $0.20
const C030 = call(160_000, 20_000); //       $0.30
const C270 = call(2_000_000, 40_000); //     $2.70
const C290 = call(2_000_000, 80_000); //     $2.90
const C300 = call(2_000_000, 100_000); //    $3.00
const C310 = call(2_000_000, 120_000); //    $3.10

let restore;
beforeEach(() => { restore = setPracticeFieldModeForTests('on'); });
afterEach(() => restore());

/** Reserve or settle in a real transaction on the book, as a caller would: the book read first, nothing written before. */
const reserveAt = (ctx, nowIso, args) => ctx.db.runTransaction(async (tx) => reserveSpend(tx, await tx.get(ctx.bookRef), { nowIso, purpose: 'manager_window', ...args }));
const reserve = (ctx, args) => reserveAt(ctx, NOV, args);
const settle = (ctx, args, nowIso = NOV) => ctx.db.runTransaction(async (tx) => settleSpend(tx, await tx.get(ctx.bookRef), args, { nowIso }));
const spendOf = (ctx) => getBook(ctx.db, ctx.bookId).spend;
const opOf = (ctx, opId) => ctx.db._get(`mandates/${ctx.bookId}/spendOps/${opId}`);
const bookBytes = (ctx) => JSON.stringify(getBook(ctx.db, ctx.bookId));

describe('the bound, the month, and the most a call can cost', () => {
  it('B9 is $3, read from the slots module; the month is the EASTERN calendar month', () => {
    expect(MONTHLY_SPEND_BOUND_USD).toBe(3);
    expect(MONTHLY_SPEND_BOUND_USD).toBe(PRACTICE_FIELD_SLOTS.B9_MONTHLY_SPEND_BOUND_USD);
    expect(spendMonthOf('2026-11-30T23:59:59.000Z')).toBe('2026-11'); // 18:59 ET, still November
    expect(spendMonthOf('2026-12-01T04:59:59.000Z')).toBe('2026-11'); // 23:59:59 ET on 30 Nov
    expect(spendMonthOf('2026-12-01T05:00:00.000Z')).toBe('2026-12'); // midnight ET
    expect(spendMonthOf('2027-03-01T04:30:00.000Z')).toBe('2027-02'); // EST
    expect(spendMonthOf('2026-07-01T03:59:59.000Z')).toBe('2026-06'); // EDT
  });

  it('the maximum is the table\'s prices times the ceilings — every input token at the dearest input rate (a cache write) — and no usage within the ceilings prices above it', () => {
    expect(MODEL_PRICES_PER_MTOK[HAIKU]).toEqual({ inputPerMTok: 1, outputPerMTok: 5 });
    expect(maxCallChargeUsd(C015)).toBe(0.015);
    expect(maxCallChargeUsd(C310)).toBe(3.1);
    expect(maxCallChargeMicros(call(1, 1))).toBe(7); // 1.25 + 5 µ$, rounded UP to the micro-dollar
    expect(maxCallChargeUsd(call(1, 1))).toBe(0.000007);
    // Whatever the call reports within its ceilings — plain input, cache reads, cache writes, any mix — the table prices
    // it at no more than the reservation; all input written to the cache, and every output token, is exactly it.
    const [inMax, outMax] = [C050.maxInputTokens, C050.maxOutputTokens];
    const microsOf = (usd) => Math.round(usd * 1e6);
    for (const [input, read, write] of [[inMax, 0, 0], [0, inMax, 0], [0, 0, inMax], [inMax / 2, inMax / 4, inMax / 4], [1, 0, inMax - 1]]) {
      const est = priceUsage(HAIKU, { input_tokens: input, cache_read_input_tokens: read, cache_creation_input_tokens: write, output_tokens: outMax }).estUsd;
      expect(microsOf(est), `${input}/${read}/${write}`).toBeLessThanOrEqual(maxCallChargeMicros(C050));
    }
    expect(microsOf(priceUsage(HAIKU, { input_tokens: 0, cache_creation_input_tokens: inMax, output_tokens: outMax }).estUsd)).toBe(maxCallChargeMicros(C050));
    // A model the table does not price has no maximum.
    expect(maxCallChargeUsd(call(1000, 1000, { modelId: 'claude-model-not-in-the-table' }))).toBeNull();
    expect(maxCallChargeUsd(call(1000, 1000, { modelId: 'toString' }))).toBeNull(); // the table's own keys only
  });
});

describe('reserveSpend — the maximum is reserved, and must fit', () => {
  it('Astra T2B-04 — a call whose ceilings allow a $3.10 charge cannot be reserved when $2.90 remains; nothing is written and the month is not exhausted', async () => {
    const ctx = await seedBook();
    expect(await reserve(ctx, { ...C010, opId: 'first' })).toMatchObject({ ok: true, maxChargeUsd: 0.1, reservedUsd: 0.1 });
    expect(await settle(ctx, { opId: 'first', actualUsd: 0.1 })).toMatchObject({ ok: true, chargedUsd: 0.1, releasedUsd: 0 });
    const before = bookBytes(ctx);
    expect(await reserve(ctx, { ...C310, opId: 'overrun' })).toEqual({
      ok: false, code: 'spend_would_exceed', month: '2026-11', maxChargeUsd: 3.1, reservedUsd: 0.1, roomUsd: 2.9, boundUsd: 3,
    });
    expect(opOf(ctx, 'overrun')).toBeUndefined();
    expect(bookBytes(ctx)).toBe(before);
    expect(spendOf(ctx)).toMatchObject({ reservedUsd: 0.1, settledUsd: 0.1, exhausted: false, calls: 1 });
    // The call that does fit the $2.90 left is reserved: the month is then at $3 exactly, and can fit no call more.
    expect(await reserve(ctx, { ...C290, opId: 'fits' })).toMatchObject({ ok: true, maxChargeUsd: 2.9, reservedUsd: 3, exhausted: true });
  });

  it('EXACTLY $3 fits; then nothing more does, and the month reads exhausted (derived: no room for the smallest call)', async () => {
    const ctx = await seedBook();
    expect(await reserve(ctx, { ...C300, opId: 'all-of-it' })).toMatchObject({ ok: true, maxChargeUsd: 3, reservedUsd: 3, exhausted: true });
    expect(spendOf(ctx)).toMatchObject({ month: '2026-11', reservedUsd: 3, exhausted: true, exhaustedAt: NOV, exhaustedBy: { opId: 'all-of-it', reason: 'reservation', roomUsd: 0 } });
    expect(await reserve(ctx, { ...call(1, 1), opId: 'one-more' })).toMatchObject({ ok: false, code: 'spend_exhausted', roomUsd: 0 });
    // …and fifteen calls of $0.20 make $3 exactly, too (B2: each leaves at least the smallest call's $0.1625 until the last).
    const many = await seedBook({ uid: 'owner-2', opId: 'c2' });
    for (let i = 0; i < 15; i += 1) expect((await reserve(many, { ...C020, opId: `call-${i}` })).ok, String(i)).toBe(true);
    expect(spendOf(many)).toMatchObject({ reservedUsd: 3, calls: 15, exhausted: true });
    expect(await reserve(many, { ...call(1, 1), opId: 'one-more' })).toMatchObject({ ok: false, code: 'spend_exhausted' });
  });

  it('a model the price table does not price is refused `model_unpriced`, writing nothing', async () => {
    const ctx = await seedBook();
    const before = bookBytes(ctx);
    expect(await reserve(ctx, { ...C015, modelId: 'claude-model-not-in-the-table', opId: 'x' })).toEqual({ ok: false, code: 'model_unpriced', modelId: 'claude-model-not-in-the-table', priceTableVersion: MODEL_PRICE_TABLE_VERSION });
    expect(opOf(ctx, 'x')).toBeUndefined();
    expect(bookBytes(ctx)).toBe(before);
  });

  it('the founder\'s Q2 ruling — a refused call does NOT exhaust the month: a smaller call that fits is still reserved', async () => {
    const ctx = await seedBook();
    await reserve(ctx, { ...C270, opId: 'big' });
    // (B2: the smallest call is the agent's $0.1625 — constants.js — so the room left here is $0.30.)
    expect(spendOf(ctx)).toMatchObject({ reservedUsd: 2.7, exhausted: false }); // $0.30 of room ≥ the smallest call's $0.1625
    expect(await reserve(ctx, { ...C050, opId: 'too-big' })).toMatchObject({ ok: false, code: 'spend_would_exceed' });
    expect(spendOf(ctx)).toMatchObject({ reservedUsd: 2.7, exhausted: false, exhaustedAt: null, exhaustedBy: null });
    expect(await reserve(ctx, { ...C015, opId: 'small' })).toMatchObject({ ok: true, reservedUsd: 2.715, exhausted: false });
    expect(spendOf(ctx).calls).toBe(2);
  });

  it('`exhausted` is derived from the room against PRACTICE_FIELD_MIN_CALL_MAX_CHARGE_USD (set by B2 from the agent call)', () => {
    expect(PRACTICE_FIELD_MIN_CALL_MAX_CHARGE_USD).toBe(0.1625);
    expect(spendExhausted({ boundUsd: 3, reservedUsd: 2.8375 })).toBe(false); // exactly the smallest call's room
    expect(spendExhausted({ boundUsd: 3, reservedUsd: 2.837501 })).toBe(true);
    expect(spendExhausted({ boundUsd: 3, reservedUsd: 3.2 })).toBe(true);
    expect(spendExhausted({ reservedUsd: 0 })).toBe(false);
  });

  it('the book keeps the month\'s TOTALS only: each call is its own document, so the book does not grow with the calls (review B6)', async () => {
    const ctx = await seedBook();
    const sizeBefore = JSON.stringify(spendOf(ctx) ?? null).length;
    const tiny = call(400, 100); // 500 + 500 = 1,000 µ$
    for (let i = 0; i < 50; i += 1) await reserve(ctx, { ...tiny, opId: `c-${i}` });
    const after50 = JSON.stringify(spendOf(ctx)).length;
    for (let i = 50; i < 500; i += 1) await reserve(ctx, { ...tiny, opId: `c-${i}` });
    expect(JSON.stringify(spendOf(ctx)).length).toBeLessThanOrEqual(after50 + 2); // only the figures' digits move
    expect(sizeBefore).toBeLessThan(after50);
    expect(countDocs(ctx.db, `mandates/${ctx.bookId}/spendOps/`)).toBe(500);
    expect(opOf(ctx, 'c-7')).toEqual({
      opId: 'c-7', month: '2026-11', purpose: 'manager_window', modelId: HAIKU, maxInputTokens: 400, maxOutputTokens: 100, cacheTtl: '5m', serverTools: [], maxChargeUsd: 0.001,
      priceTableVersion: MODEL_PRICE_TABLE_VERSION, state: 'reserved', reservedAt: NOV, chargedUsd: null, actualUsd: null, unpriced: null,
      releasedUsd: null, chargeAboveReservation: null, settledAt: null,
    });
  });

  it('a settled call and an outstanding reservation BOTH count against the bound — the outstanding one at its maximum', async () => {
    const ctx = await seedBook();
    await reserve(ctx, { ...call(1_200_000, 0 + 1), opId: 'a' }); // 1,500,005 µ$
    expect(await settle(ctx, { opId: 'a', actualUsd: 1.4 })).toMatchObject({ ok: true, chargedUsd: 1.4 });
    await reserve(ctx, { ...C050, opId: 'b' }); // outstanding at $0.50
    expect(spendOf(ctx)).toMatchObject({ reservedUsd: 1.9, settledUsd: 1.4 });
    expect(await reserve(ctx, { ...call(600_000, 1), opId: 'c' })).toMatchObject({ ok: true, reservedUsd: 2.650005, exhausted: false });
    expect(await reserve(ctx, { ...C050, opId: 'd' })).toMatchObject({ ok: false, code: 'spend_would_exceed' });
  });

  it('a replay of the same operation reserves once — in a later month too; the same id with another model, ceiling or purpose is a conflict', async () => {
    const ctx = await seedBook();
    expect(await reserve(ctx, { ...C015, opId: 'x' })).toMatchObject({ ok: true, idempotentReplay: false, reservedUsd: 0.015 });
    const bytes = JSON.stringify([spendOf(ctx), opOf(ctx, 'x')]);
    expect(await reserve(ctx, { ...C015, opId: 'x' })).toMatchObject({ ok: true, idempotentReplay: true, month: '2026-11', maxChargeUsd: 0.015 });
    expect(JSON.stringify([spendOf(ctx), opOf(ctx, 'x')])).toBe(bytes);
    for (const other of [call(8_001, 1_000), call(8_000, 1_001), call(8_000, 1_000, { modelId: 'claude-haiku-4-5-20251001' }), call(8_000, 1_000, { cacheTtl: 'none' }), call(8_000, 1_000, { serverTools: ['web_search'] })]) {
      expect(await reserve(ctx, { ...other, opId: 'x' })).toEqual({ ok: false, code: 'op_id_conflict', opId: 'x' });
    }
    expect(await reserve(ctx, { ...C015, opId: 'x', purpose: 'drafting' })).toEqual({ ok: false, code: 'op_id_conflict', opId: 'x' });
    expect(JSON.stringify([spendOf(ctx), opOf(ctx, 'x')])).toBe(bytes);
    // Two months later the same request is still a replay, never a second reservation (review B7).
    expect(await reserveAt(ctx, '2027-01-20T15:00:00.000Z', { ...C015, opId: 'x' })).toMatchObject({ ok: true, idempotentReplay: true, month: '2026-11' });
    expect(JSON.stringify([spendOf(ctx), opOf(ctx, 'x')])).toBe(bytes);
  });

  it('EVERY RETRY COUNTS: a retried model call is reserved under its own operation id, and each attempt is charged', async () => {
    const ctx = await seedBook();
    await reserve(ctx, { ...C015, opId: 'call-7#1' });
    await settle(ctx, { opId: 'call-7#1', unpriced: true }); // the first attempt failed, its usage unreadable: its maximum
    await reserve(ctx, { ...C015, opId: 'call-7#2' });
    await settle(ctx, { opId: 'call-7#2', actualUsd: 0.012 });
    expect(spendOf(ctx)).toMatchObject({ reservedUsd: 0.027, settledUsd: 0.027, calls: 2 });
  });

  it('refuses a missing model, ceilings that are not whole tokens, an unstated cache lifetime or tool list, an unsafe operation id, a missing purpose, and a clock without its offset', () => {
    const ok = { ...C015, purpose: 'p', opId: 'o', nowIso: NOV };
    expect(planReserve(null, null, ok).result.ok).toBe(true);
    for (const modelId of ['', null, undefined, 7]) expect(() => planReserve(null, null, { ...ok, modelId }), String(modelId)).toThrow(/modelId/);
    for (const cacheTtl of [undefined, null, '', '1d', 5]) expect(() => planReserve(null, null, { ...ok, cacheTtl }), String(cacheTtl)).toThrow(/cacheTtl/);
    for (const serverTools of [undefined, null, 'web_search', [''], [7]]) expect(() => planReserve(null, null, { ...ok, serverTools }), String(serverTools)).toThrow(/serverTools/);
    for (const v of [0, -1, 1.5, NaN, Infinity, '100', null, undefined]) {
      expect(() => planReserve(null, null, { ...ok, maxInputTokens: v }), `in ${v}`).toThrow(/tokens/);
      expect(() => planReserve(null, null, { ...ok, maxOutputTokens: v }), `out ${v}`).toThrow(/tokens/);
    }
    for (const opId of ['', '__call__', 'a/b', '.', 'x'.repeat(201), 7]) expect(() => planReserve(null, null, { ...ok, opId }), String(opId)).toThrow(/opId/);
    expect(() => planReserve(null, null, { ...ok, purpose: '' })).toThrow(/purpose/);
    for (const nowIso of ['2026-11-17', '2026-12-01T03:00:00', 'soon']) expect(() => planReserve(null, null, { ...ok, nowIso }), nowIso).toThrow(/instant/);
    expect(planReserve(null, null, { ...ok, nowIso: '2026-12-01T00:30:00-05:00' }).result).toMatchObject({ ok: true, month: '2026-12' });
  });
});

describe('the review of this fix round — what the table cannot price, an exhausted month, a record with no maximum', () => {
  it("review S-1 — a 1-hour cache write (2× the base input at Anthropic's list) or a server tool (a fee per use) is refused `pricing_unsupported`: the table prices neither; nothing is written", async () => {
    const ctx = await seedBook();
    const before = bookBytes(ctx);
    expect(await reserve(ctx, { ...C015, cacheTtl: '1h', opId: 'hour' })).toEqual({ ok: false, code: 'pricing_unsupported', unsupported: ['cache_write_1h'], modelId: HAIKU, priceTableVersion: MODEL_PRICE_TABLE_VERSION });
    expect(await reserve(ctx, { ...C015, serverTools: ['web_search'], opId: 'search' })).toMatchObject({ ok: false, code: 'pricing_unsupported', unsupported: ['server_tools'] });
    expect(await reserve(ctx, { ...C015, cacheTtl: '1h', serverTools: ['web_search'], opId: 'both' })).toMatchObject({ ok: false, code: 'pricing_unsupported', unsupported: ['cache_write_1h', 'server_tools'] });
    for (const opId of ['hour', 'search', 'both']) expect(opOf(ctx, opId), opId).toBeUndefined();
    expect(bookBytes(ctx)).toBe(before);
    // No cache, or a 5-minute one, with no server tool: reserved, at the same maximum.
    expect(await reserve(ctx, { ...C015, cacheTtl: 'none', opId: 'plain' })).toMatchObject({ ok: true, maxChargeUsd: 0.015 });
    expect(opOf(ctx, 'plain')).toMatchObject({ cacheTtl: 'none', serverTools: [] });
  });

  it('review S-2 — an EXHAUSTED month runs no model call (contract §17 B-SPEND): a call small enough to fit is refused `spend_exhausted`, writing nothing', async () => {
    const ctx = await seedBook();
    await reserve(ctx, { ...call(2_000_000, 93_000), opId: 'most' }); // 2.5 + 0.465 = $2.965
    expect(spendOf(ctx)).toMatchObject({ reservedUsd: 2.965, exhausted: true }); // $0.035 of room, below the smallest call
    const before = bookBytes(ctx);
    expect(await reserve(ctx, { ...C015, opId: 'small' })).toEqual({ ok: false, code: 'spend_exhausted', month: '2026-11', reservedUsd: 2.965, roomUsd: 0.035, minCallUsd: PRACTICE_FIELD_MIN_CALL_MAX_CHARGE_USD });
    expect(opOf(ctx, 'small')).toBeUndefined();
    expect(bookBytes(ctx)).toBe(before);
  });

  it('review S-4 — fails closed: an op with no numeric maximum settles nothing; a month whose figures are not numbers reserves nothing', async () => {
    const ctx = await seedBook();
    await ctx.db.collection('mandates').doc(ctx.bookId).collection('spendOps').doc('old').set({ opId: 'old', month: '2026-11', purpose: 'p', estimateUsd: 0.02, state: 'reserved' });
    const before = bookBytes(ctx);
    expect(await settle(ctx, { opId: 'old', actualUsd: 0.01 })).toEqual({ ok: false, code: 'reservation_without_maximum', opId: 'old' });
    expect(bookBytes(ctx)).toBe(before);
    expect(planReserve({ month: '2026-11', boundUsd: 3, reservedUsd: NaN }, null, { ...C015, purpose: 'p', opId: 'o', nowIso: NOV }).result).toEqual({ ok: false, code: 'spend_state_invalid', month: '2026-11' });
  });

  it('T-1 — a settlement AT the maximum (an unreadable call, or one that cost exactly that) is not flagged above it, and nothing is logged', async () => {
    const ctx = await seedBook();
    await reserve(ctx, { ...C050, opId: 'u' });
    await reserve(ctx, { ...C050, opId: 'x' });
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const u = await settle(ctx, { opId: 'u', unpriced: true });
      const x = await settle(ctx, { opId: 'x', actualUsd: 0.5 });
      for (const r of [u, x]) { expect(r).toMatchObject({ ok: true, chargedUsd: 0.5, releasedUsd: 0 }); expect(r).not.toHaveProperty('flags'); }
      expect(errors).not.toHaveBeenCalled();
    } finally { errors.mockRestore(); }
    expect(opOf(ctx, 'u').chargeAboveReservation).toBeNull();
  });

  it('T-2 — while the month stays exhausted a later write keeps the first `exhaustedAt` / `exhaustedBy`', async () => {
    const ctx = await seedBook();
    await reserve(ctx, { ...C300, opId: 'all-of-it' });
    const first = spendOf(ctx);
    expect(first).toMatchObject({ exhausted: true, exhaustedAt: NOV, exhaustedBy: { opId: 'all-of-it', reason: 'reservation' } });
    const later = '2026-11-18T15:00:00.000Z';
    expect(await settle(ctx, { opId: 'all-of-it', actualUsd: 2.98 }, later)).toMatchObject({ ok: true, releasedUsd: 0.02, exhausted: true }); // $0.02 of room
    expect(spendOf(ctx)).toMatchObject({ reservedUsd: 2.98, exhausted: true, exhaustedAt: NOV, exhaustedBy: first.exhaustedBy });
  });
});

describe('settleSpend — the charge as it is, the unused part released', () => {
  it('the actual charge is recorded and the rest of the reservation released; an unreadable call is charged its maximum', async () => {
    const ctx = await seedBook();
    await reserve(ctx, { ...C050, opId: 'p' });
    await reserve(ctx, { ...C050, opId: 'u' });
    expect(spendOf(ctx)).toMatchObject({ reservedUsd: 1 });
    expect(await settle(ctx, { opId: 'p', actualUsd: 0.012 })).toMatchObject({ ok: true, chargedUsd: 0.012, releasedUsd: 0.488, reservedUsd: 0.512 });
    expect(await settle(ctx, { opId: 'u', unpriced: true })).toMatchObject({ ok: true, chargedUsd: 0.5, releasedUsd: 0 });
    expect(spendOf(ctx)).toMatchObject({ reservedUsd: 0.512, settledUsd: 0.512 });
    expect(opOf(ctx, 'p')).toMatchObject({ state: 'settled', chargedUsd: 0.012, actualUsd: 0.012, unpriced: false, releasedUsd: 0.488, chargeAboveReservation: null, settledAt: NOV });
    expect(opOf(ctx, 'u')).toMatchObject({ state: 'settled', unpriced: true, chargedUsd: 0.5, actualUsd: null, releasedUsd: 0 });
  });

  it('released room ends a derived exhaustion: the month at $3 by its reservations reads exhausted until a settlement gives room back', async () => {
    const ctx = await seedBook();
    await reserve(ctx, { ...C270, opId: 'big' });
    await reserve(ctx, { ...C030, opId: 'last' });
    expect(spendOf(ctx)).toMatchObject({ reservedUsd: 3, exhausted: true, exhaustedBy: { opId: 'last', reason: 'reservation' } });
    expect(await settle(ctx, { opId: 'big', actualUsd: 0.31 })).toMatchObject({ ok: true, releasedUsd: 2.39, reservedUsd: 0.61, exhausted: false });
    expect(spendOf(ctx)).toMatchObject({ exhausted: false, exhaustedAt: null, exhaustedBy: null });
    expect(await reserve(ctx, { ...C290, opId: 'again' })).toMatchObject({ ok: false, code: 'spend_would_exceed' }); // 0.61 + 2.90 > 3
    expect(await reserve(ctx, { ...C050, opId: 'fits' })).toMatchObject({ ok: true, reservedUsd: 1.11 });
  });

  it('a charge ABOVE the reserved maximum should be impossible: if it happens it is recorded as it is — never clamped — flagged `charge_above_reservation`, and logged', async () => {
    const ctx = await seedBook();
    await reserve(ctx, { ...C270, opId: 'big' });
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const out = await settle(ctx, { opId: 'big', actualUsd: 3.2 });
      expect(out).toMatchObject({
        ok: true, chargedUsd: 3.2, releasedUsd: 0, reservedUsd: 3.2, exhausted: true,
        flags: [CHARGE_ABOVE_RESERVATION], chargeAboveReservation: { reservedMaxUsd: 2.7, chargedUsd: 3.2, overUsd: 0.5 },
      });
      expect(errors.mock.calls.map((c) => c[0]).filter((m) => /PRACTICE_FIELD_CHARGE_ABOVE_RESERVATION/.test(m))).toHaveLength(1);
    } finally { errors.mockRestore(); }
    expect(opOf(ctx, 'big')).toMatchObject({ chargedUsd: 3.2, actualUsd: 3.2, chargeAboveReservation: { reservedMaxUsd: 2.7, chargedUsd: 3.2, overUsd: 0.5 } });
    expect(spendOf(ctx)).toMatchObject({ reservedUsd: 3.2, settledUsd: 3.2, exhausted: true, exhaustedBy: { opId: 'big', reason: CHARGE_ABOVE_RESERVATION } });
    expect(await reserve(ctx, { ...call(1, 1), opId: 'next' })).toMatchObject({ ok: false, code: 'spend_exhausted' });
  });

  it('idempotent: a replayed settlement changes nothing and counts nothing twice; another charge for the same id is a conflict; an unknown id is refused', async () => {
    const ctx = await seedBook();
    await reserve(ctx, { ...C050, opId: 'p' });
    await settle(ctx, { opId: 'p', actualUsd: 0.02 });
    const bytes = JSON.stringify([spendOf(ctx), opOf(ctx, 'p')]);
    expect(await settle(ctx, { opId: 'p', actualUsd: 0.02 })).toMatchObject({ ok: true, idempotentReplay: true });
    expect(await settle(ctx, { opId: 'p', actualUsd: 0.03 })).toEqual({ ok: false, code: 'op_id_conflict', opId: 'p' });
    expect(await settle(ctx, { opId: 'p', unpriced: true })).toEqual({ ok: false, code: 'op_id_conflict', opId: 'p' });
    expect(JSON.stringify([spendOf(ctx), opOf(ctx, 'p')])).toBe(bytes);
    expect(spendOf(ctx)).toMatchObject({ reservedUsd: 0.02, settledUsd: 0.02, calls: 1 });
    expect(await settle(ctx, { opId: 'never', actualUsd: 0.01 })).toEqual({ ok: false, code: 'reservation_not_found', opId: 'never' });
    expect(() => planSettle(null, null, { opId: 'p', actualUsd: 0.01, unpriced: true, nowIso: NOV })).toThrow(/exactly one/);
    expect(() => planSettle(null, null, { opId: 'p', nowIso: NOV })).toThrow(/exactly one/);
  });
});

describe('Astra T2B-C01 — a fraction of a micro-dollar is never released (the month is kept in whole nano-dollars)', () => {
  // The tariff as exact integers, nano-dollars a token at Haiku's $1 / $5 per MTok: plain input 1,000, a 5-minute cache
  // write 1,250, a cache read 100, output 5,000. The test's own arithmetic — independent of priceUsage's doubles.
  const nanosOfUsage = (u) => (u.input_tokens ?? 0) * 1_000 + (u.cache_creation_input_tokens ?? 0) * 1_250 + (u.cache_read_input_tokens ?? 0) * 100 + (u.output_tokens ?? 0) * 5_000;
  /** Astra's thirteen honest calls: each within its declared ceilings, each charge within its own maximum. */
  const CALLS = [
    { opId: 'cached', maxIn: 1_001, maxOut: 1_000, usage: { input_tokens: 0, cache_read_input_tokens: 1_001, cache_creation_input_tokens: 0, output_tokens: 1_000 } },
    ...Array.from({ length: 11 }, (_, i) => ({ opId: `bulk-${i}`, maxIn: 199_000, maxOut: 100, usage: { input_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 199_000, output_tokens: 100 } })),
    { opId: 'last', maxIn: 199_000, maxOut: 880, usage: { input_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 199_000, output_tokens: 880 } },
  ];

  it('Astra\'s regression — after twelve honest settlements (the first $0.0051001) the thirteenth call\'s $0.25315 maximum is refused `spend_would_exceed`: the room is $0.2531499, and the book records the exact sum of the charges', async () => {
    const ctx = await seedBook();
    let chargedNanos = 0;
    for (const c of CALLS.slice(0, 12)) {
      const actualUsd = priceUsage(HAIKU, c.usage).estUsd; // what a caller would settle with: the table's double
      const r = await reserve(ctx, { ...call(c.maxIn, c.maxOut), opId: c.opId });
      expect(r, c.opId).toMatchObject({ ok: true });
      expect(nanosOfUsage(c.usage), c.opId).toBeLessThanOrEqual(Math.round(r.maxChargeUsd * 1e9)); // honest: within its maximum
      const s = await settle(ctx, { opId: c.opId, actualUsd });
      expect(s, c.opId).toMatchObject({ ok: true, chargedUsd: nanosOfUsage(c.usage) / 1e9 });
      expect(s, c.opId).not.toHaveProperty('flags');
      expect(opOf(ctx, c.opId), c.opId).toMatchObject({ actualUsd, chargeAboveReservation: null }); // the raw charge, as given
      chargedNanos += nanosOfUsage(c.usage);
    }
    expect(nanosOfUsage(CALLS[0].usage)).toBe(5_100_100); // $0.0051001 — not a whole micro-dollar
    expect(opOf(ctx, 'cached')).toMatchObject({ chargedUsd: 0.0051001, releasedUsd: 0.0011519 }); // 6,252,000 − 5,100,100 n$
    expect(chargedNanos).toBe(2_746_850_100);
    expect(spendOf(ctx)).toMatchObject({ reservedUsd: chargedNanos / 1e9, settledUsd: chargedNanos / 1e9, calls: 12, exhausted: false });
    // The last call's maximum is $0.25315 = 253,150,000 n$; the room is 3,000,000,000 − 2,746,850,100 = 253,149,900 n$.
    const last = CALLS[12];
    expect(maxCallChargeMicros(call(last.maxIn, last.maxOut)) * 1_000).toBe(253_150_000);
    const before = bookBytes(ctx);
    expect(await reserve(ctx, { ...call(last.maxIn, last.maxOut), opId: last.opId })).toEqual({
      ok: false, code: 'spend_would_exceed', month: '2026-11', maxChargeUsd: 0.25315, reservedUsd: 2.7468501, roomUsd: 0.2531499, boundUsd: 3,
    });
    expect(opOf(ctx, last.opId)).toBeUndefined();
    expect(bookBytes(ctx)).toBe(before);
  });

  it('control — one cache read fewer in the first call (a whole $0.0051): the room is then exactly the thirteenth call\'s maximum, and it fits — the month reaches $3 exactly, never past it', async () => {
    const ctx = await seedBook();
    const first = { ...CALLS[0], usage: { ...CALLS[0].usage, cache_read_input_tokens: 1_000 } }; // 100,000 + 5,000,000 n$
    for (const c of [first, ...CALLS.slice(1, 12)]) {
      await reserve(ctx, { ...call(c.maxIn, c.maxOut), opId: c.opId });
      expect(await settle(ctx, { opId: c.opId, actualUsd: priceUsage(HAIKU, c.usage).estUsd }), c.opId).not.toHaveProperty('flags');
    }
    expect(spendOf(ctx).reservedUsd).toBe(2.74685); // 5,100,000 + 11 × 249,250,000 n$
    const last = CALLS[12];
    expect(await reserve(ctx, { ...call(last.maxIn, last.maxOut), opId: last.opId })).toMatchObject({ ok: true, maxChargeUsd: 0.25315, reservedUsd: 3 });
  });

  it('an incurred charge is never rounded down: a genuine fraction of a nano-dollar rounds UP; only the double\'s own error snaps to the whole nano-dollar', () => {
    expect(incurredChargeNanos(0)).toBe(0);
    expect(incurredChargeNanos(0.0051001)).toBe(5_100_100);
    expect(incurredChargeNanos(0.24925000000000003)).toBe(249_250_000); // priceUsage's double for 249,250,000 n$
    expect(incurredChargeNanos(priceUsage(HAIKU, CALLS[12].usage).estUsd)).toBe(253_150_000);
    expect(incurredChargeNanos(3.0000001)).toBe(3_000_000_100);
    // A real fraction, either side of the half: up, never to the nearest.
    expect(incurredChargeNanos(5_100_100.01 / 1e9)).toBe(5_100_101);
    expect(incurredChargeNanos(5_100_100.6 / 1e9)).toBe(5_100_101);
    expect(incurredChargeNanos(0.4e-9)).toBe(1);
    // Noise of a few units in the last place, either side of a whole number: that whole number.
    // (Stepped through the double's bits, so each step is exactly one unit in the last place.)
    const stepUlps = (v, n) => { const f = new Float64Array([v]); const b = new BigInt64Array(f.buffer); b[0] += BigInt(n); return f[0]; };
    for (const ulps of [-4, -1, 1, 4]) {
      const v = stepUlps(2_746_850_100 / 1e9, ulps);
      expect(v, String(ulps)).not.toBe(2_746_850_100 / 1e9);
      expect(incurredChargeNanos(v), String(ulps)).toBe(2_746_850_100);
    }
    // Every usage mix within a call's ceilings settles to the test's own integer arithmetic, exactly.
    for (const u of [{ input_tokens: 12_345, cache_read_input_tokens: 777, cache_creation_input_tokens: 3_333, output_tokens: 4_321 }, { input_tokens: 1, cache_read_input_tokens: 1, cache_creation_input_tokens: 1, output_tokens: 1 }, { input_tokens: 1_999_999, cache_read_input_tokens: 1_999_999, cache_creation_input_tokens: 1_999_999, output_tokens: 199_999 }]) {
      expect(incurredChargeNanos(priceUsage(HAIKU, u).estUsd), JSON.stringify(u)).toBe(nanosOfUsage(u));
    }
  });
});

describe('a new month starts empty', () => {
  it('the first reservation of December finds November\'s exhausted state gone, kept beside it as last month\'s totals', async () => {
    const ctx = await seedBook();
    await reserve(ctx, { ...C300, opId: 'all-of-it' });
    expect(await reserve(ctx, { ...C015, opId: 'nov-late' })).toMatchObject({ ok: false, code: 'spend_exhausted' });
    expect(spendOf(ctx)).toMatchObject({ month: '2026-11', exhausted: true });
    const dec = '2026-12-01T05:00:00.000Z'; // midnight Eastern
    expect(await reserveAt(ctx, dec, { ...C015, opId: 'dec-1' })).toMatchObject({ ok: true, month: '2026-12', reservedUsd: 0.015, exhausted: false });
    expect(spendOf(ctx)).toMatchObject({ month: '2026-12', reservedUsd: 0.015, settledUsd: 0, exhausted: false, calls: 1, lastMonth: { month: '2026-11', reservedUsd: 3, exhausted: true, calls: 1 } });
  });

  it('a call reserved before midnight and settled after it settles against ITS month, releasing there', async () => {
    const ctx = await seedBook();
    await reserveAt(ctx, '2026-12-01T04:59:00.000Z', { ...C050, opId: 'midnight' });
    expect(await settle(ctx, { opId: 'midnight', actualUsd: 0.04 }, '2026-12-01T05:01:00.000Z')).toMatchObject({ ok: true, chargedUsd: 0.04, releasedUsd: 0.46, month: '2026-11', reservedUsd: 0.04 });
    expect(spendOf(ctx)).toMatchObject({ month: '2026-12', reservedUsd: 0, settledUsd: 0, lastMonth: { month: '2026-11', reservedUsd: 0.04, settledUsd: 0.04 } });
    // One reserved two stored months back (September; October is the book's last month by then): charged on its own
    // record; no month's totals are rewritten.
    const old = await seedBook({ uid: 'owner-3', opId: 'c3' });
    await reserveAt(old, '2026-09-10T15:00:00.000Z', { ...C050, opId: 'sept' });
    await reserveAt(old, '2026-10-10T15:00:00.000Z', { ...C010, opId: 'oct' });
    await reserveAt(old, '2026-12-02T15:00:00.000Z', { ...C010, opId: 'dec' });
    const before = JSON.stringify(spendOf(old));
    expect(await settle(old, { opId: 'sept', unpriced: true }, '2026-12-03T15:00:00.000Z')).toMatchObject({ ok: true, chargedUsd: 0.5, month: '2026-09', monthTotalsRetired: true });
    expect(JSON.stringify(spendOf(old))).toBe(before);
    expect(opOf(old, 'sept')).toMatchObject({ state: 'settled', chargedUsd: 0.5 });
  });

  it('a clock BEHIND the book\'s month is refused for a reservation and rolls nothing back (review B5)', async () => {
    const ctx = await seedBook();
    await reserveAt(ctx, '2026-11-30T20:00:00.000Z', { ...C290, opId: 'nov-big' });
    await reserveAt(ctx, '2026-12-01T05:00:30.000Z', { ...call(1_600_000, 100_000), opId: 'dec-big' }); // $2.50
    const before = JSON.stringify(spendOf(ctx));
    expect(await reserveAt(ctx, '2026-12-01T04:59:50.000Z', { ...C010, opId: 'stale-clock' })).toEqual({ ok: false, code: 'clock_behind_spend_month', month: '2026-11', storedMonth: '2026-12' });
    expect(JSON.stringify(spendOf(ctx))).toBe(before);
    expect(spendOf(ctx)).toMatchObject({ month: '2026-12', reservedUsd: 2.5, lastMonth: { month: '2026-11', reservedUsd: 2.9 } });
    // A settlement with that clock charges its op's month and rolls nothing.
    expect(await settle(ctx, { opId: 'dec-big', actualUsd: 2.4 }, '2026-12-01T04:59:55.000Z')).toMatchObject({ ok: true, month: '2026-12', reservedUsd: 2.4 });
    expect(spendOf(ctx)).toMatchObject({ month: '2026-12', reservedUsd: 2.4, lastMonth: { month: '2026-11', reservedUsd: 2.9 } });
  });
});

describe('nothing on the money path consults it', () => {
  it('one product module imports spend.js — the agent\'s desk check (B2), its first caller — and nothing on the money path does', () => {
    const dir = new URL('.', import.meta.url);
    const importers = readdirSync(dir).filter((f) => f.endsWith('.js') && !f.includes('.test.') && f !== 'spend.js')
      .filter((f) => /from '\.\/spend\.js'/.test(readFileSync(new URL(f, dir), 'utf8')));
    expect(importers).toEqual(['agentRun.js']);
    for (const f of ['close.js', 'exits.js', 'entry.js', 'settlement.js', 'sweep.js', 'fills.js', 'ledger.js', 'marks.js']) {
      expect(readFileSync(new URL(f, dir), 'utf8'), f).not.toMatch(/reserveSpend|settleSpend|spend\.js|\.spend\b|spendOps/);
    }
  });

  it('reserveSpend needs the book as the caller\'s transaction read it, and refuses a missing book', async () => {
    const ctx = await seedBook();
    await expect(ctx.db.runTransaction(async (tx) => reserveSpend(tx, getBook(ctx.db, ctx.bookId), { ...C015, purpose: 'p', opId: 'o', nowIso: NOV }))).rejects.toThrow(/DocumentSnapshot/);
    const missing = ctx.db.collection('mandates').doc('no-such-book');
    expect(await ctx.db.runTransaction(async (tx) => reserveSpend(tx, await tx.get(missing), { ...C015, purpose: 'p', opId: 'o', nowIso: NOV }))).toEqual({ ok: false, code: 'book_not_found' });
  });
});
