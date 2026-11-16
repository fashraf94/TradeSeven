// api/_utils/practiceField/spend.test.js
//
// Practice Field T1a-2b-1 §5 — THE MONTHLY SPEND RESERVATION (contract V2 §12; B9: $3 a month per book). Reserve before
// a model call, settle after; the Eastern calendar month; refuse `spend_exhausted` past $3 and set `exhausted`; an
// unpriced call counts its estimate; every retry counts; a new month starts empty; idempotent on the operation id —
// each call its own create-once document, so the book keeps only the month's totals. No caller exists yet — and
// nothing on the money path imports the module.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { setPracticeFieldModeForTests } from './mode.js';
import {
  reserveSpend, settleSpend, planReserve, planSettle, spendMonthOf, MONTHLY_SPEND_BOUND_USD,
} from './spend.js';
import { PRACTICE_FIELD_SLOTS } from '../../../src/data/practiceFieldSlots.js';
import { seedBook, getBook, countDocs } from './__testsupport__/fixtures.js';

const NOV = '2026-11-17T15:00:00.000Z';
let restore;
beforeEach(() => { restore = setPracticeFieldModeForTests('on'); });
afterEach(() => restore());

/** Reserve or settle in a real transaction on the book, as a caller would: the book read first, nothing written before. */
const reserveAt = (ctx, nowIso, args) => ctx.db.runTransaction(async (tx) => reserveSpend(tx, await tx.get(ctx.bookRef), { nowIso, purpose: 'manager_window', ...args }));
const reserve = (ctx, args) => reserveAt(ctx, NOV, args);
const settle = (ctx, args, nowIso = NOV) => ctx.db.runTransaction(async (tx) => settleSpend(tx, await tx.get(ctx.bookRef), args, { nowIso }));
const spendOf = (ctx) => getBook(ctx.db, ctx.bookId).spend;
const opOf = (ctx, opId) => ctx.db._get(`mandates/${ctx.bookId}/spendOps/${opId}`);

describe('the bound and the month', () => {
  it('B9 is $3, read from the slots module; the month is the EASTERN calendar month', () => {
    expect(MONTHLY_SPEND_BOUND_USD).toBe(3);
    expect(MONTHLY_SPEND_BOUND_USD).toBe(PRACTICE_FIELD_SLOTS.B9_MONTHLY_SPEND_BOUND_USD);
    expect(spendMonthOf('2026-11-30T23:59:59.000Z')).toBe('2026-11'); // 18:59 ET, still November
    expect(spendMonthOf('2026-12-01T04:59:59.000Z')).toBe('2026-11'); // 23:59:59 ET on 30 Nov
    expect(spendMonthOf('2026-12-01T05:00:00.000Z')).toBe('2026-12'); // midnight ET
    expect(spendMonthOf('2027-03-01T04:30:00.000Z')).toBe('2027-02'); // EST
    expect(spendMonthOf('2026-07-01T03:59:59.000Z')).toBe('2026-06'); // EDT
  });
});

describe('reserveSpend', () => {
  it('the boundary at EXACTLY $3 is allowed; one micro-dollar more is refused `spend_exhausted` and sets `exhausted` for the rest of the month', async () => {
    const ctx = await seedBook();
    for (let i = 0; i < 200; i += 1) expect((await reserve(ctx, { estimateUsd: 0.015, opId: `call-${i}` })).ok, String(i)).toBe(true);
    expect(spendOf(ctx)).toMatchObject({ month: '2026-11', reservedUsd: 3, settledUsd: 0, exhausted: false, boundUsd: 3, calls: 200 });
    expect(await reserve(ctx, { estimateUsd: 0.000001, opId: 'one-more' })).toMatchObject({ ok: false, code: 'spend_exhausted', reservedUsd: 3 });
    expect(spendOf(ctx)).toMatchObject({ reservedUsd: 3, exhausted: true, exhaustedAt: NOV, exhaustedBy: { opId: 'one-more', reason: 'reservation_refused' } });
    expect(opOf(ctx, 'one-more')).toBeUndefined(); // a refused reservation reserves nothing
    // Exhausted is sticky: even a call that would fit is refused this month.
    const fresh = await seedBook({ uid: 'owner-2', opId: 'c2' });
    await reserve(fresh, { estimateUsd: 2.5, opId: 'big' });
    expect(await reserve(fresh, { estimateUsd: 0.6, opId: 'too-big' })).toMatchObject({ ok: false, code: 'spend_exhausted' });
    expect(await reserve(fresh, { estimateUsd: 0.1, opId: 'small' })).toMatchObject({ ok: false, code: 'spend_exhausted' });
    expect(spendOf(fresh).reservedUsd).toBe(2.5);
  });

  it('the book keeps the month\'s TOTALS only: each call is its own document, so the book does not grow with the calls (review B6)', async () => {
    const ctx = await seedBook();
    const sizeBefore = JSON.stringify(spendOf(ctx) ?? null).length;
    for (let i = 0; i < 50; i += 1) await reserve(ctx, { estimateUsd: 0.001, opId: `c-${i}` });
    const after50 = JSON.stringify(spendOf(ctx)).length;
    for (let i = 50; i < 500; i += 1) await reserve(ctx, { estimateUsd: 0.001, opId: `c-${i}` });
    expect(JSON.stringify(spendOf(ctx)).length).toBeLessThanOrEqual(after50 + 2); // only the figures' digits move
    expect(sizeBefore).toBeLessThan(after50);
    expect(countDocs(ctx.db, `mandates/${ctx.bookId}/spendOps/`)).toBe(500);
    expect(opOf(ctx, 'c-7')).toEqual({ opId: 'c-7', month: '2026-11', purpose: 'manager_window', estimateUsd: 0.001, state: 'reserved', reservedAt: NOV, chargedUsd: null, actualUsd: null, unpriced: null, settledAt: null });
  });

  it('a settled call and an outstanding reservation BOTH count against the bound', async () => {
    const ctx = await seedBook();
    await reserve(ctx, { estimateUsd: 1.5, opId: 'a' });
    expect(await settle(ctx, { opId: 'a', actualUsd: 1.4 })).toMatchObject({ ok: true, chargedUsd: 1.4 });
    await reserve(ctx, { estimateUsd: 1.5, opId: 'b' }); // outstanding
    expect(spendOf(ctx)).toMatchObject({ reservedUsd: 2.9, settledUsd: 1.4 });
    expect(await reserve(ctx, { estimateUsd: 0.1, opId: 'c' })).toMatchObject({ ok: true, reservedUsd: 3 });
    expect(await reserve(ctx, { estimateUsd: 0.01, opId: 'd' })).toMatchObject({ ok: false, code: 'spend_exhausted' });
  });

  it('a replay of the same operation reserves once — in a later month too; the same id with another estimate or purpose is a conflict', async () => {
    const ctx = await seedBook();
    expect(await reserve(ctx, { estimateUsd: 0.02, opId: 'x' })).toMatchObject({ ok: true, idempotentReplay: false, reservedUsd: 0.02 });
    const bytes = JSON.stringify([spendOf(ctx), opOf(ctx, 'x')]);
    expect(await reserve(ctx, { estimateUsd: 0.02, opId: 'x' })).toMatchObject({ ok: true, idempotentReplay: true, month: '2026-11' });
    expect(JSON.stringify([spendOf(ctx), opOf(ctx, 'x')])).toBe(bytes);
    expect(await reserve(ctx, { estimateUsd: 0.03, opId: 'x' })).toEqual({ ok: false, code: 'op_id_conflict', opId: 'x' });
    expect(await reserve(ctx, { estimateUsd: 0.02, opId: 'x', purpose: 'drafting' })).toEqual({ ok: false, code: 'op_id_conflict', opId: 'x' });
    expect(JSON.stringify([spendOf(ctx), opOf(ctx, 'x')])).toBe(bytes);
    // Two months later the same request is still a replay, never a second reservation (review B7).
    expect(await reserveAt(ctx, '2027-01-20T15:00:00.000Z', { estimateUsd: 0.02, opId: 'x' })).toMatchObject({ ok: true, idempotentReplay: true, month: '2026-11' });
    expect(JSON.stringify([spendOf(ctx), opOf(ctx, 'x')])).toBe(bytes);
  });

  it('EVERY RETRY COUNTS: a retried model call is reserved under its own operation id, and each attempt is charged', async () => {
    const ctx = await seedBook();
    await reserve(ctx, { estimateUsd: 0.02, opId: 'call-7#1' });
    await settle(ctx, { opId: 'call-7#1', unpriced: true }); // the first attempt failed: unpriced, charged its estimate
    await reserve(ctx, { estimateUsd: 0.02, opId: 'call-7#2' });
    await settle(ctx, { opId: 'call-7#2', actualUsd: 0.017 });
    expect(spendOf(ctx)).toMatchObject({ reservedUsd: 0.037, settledUsd: 0.037, calls: 2 });
  });

  it('refuses an estimate that rounds to nothing, an unsafe operation id, a missing purpose, and a clock without its offset', () => {
    for (const estimateUsd of [0, -1, NaN, Infinity, '0.02', null, 0.0000004]) expect(() => planReserve(null, null, { estimateUsd, purpose: 'p', opId: 'o', nowIso: NOV }), String(estimateUsd)).toThrow(/estimateUsd/);
    expect(planReserve(null, null, { estimateUsd: 0.000001, purpose: 'p', opId: 'o', nowIso: NOV }).result.ok).toBe(true); // one micro-dollar is a reservation
    for (const opId of ['', '__call__', 'a/b', '.', 'x'.repeat(201), 7]) expect(() => planReserve(null, null, { estimateUsd: 1, purpose: 'p', opId, nowIso: NOV }), String(opId)).toThrow(/opId/);
    expect(() => planReserve(null, null, { estimateUsd: 1, purpose: '', opId: 'o', nowIso: NOV })).toThrow(/purpose/);
    for (const nowIso of ['2026-11-17', '2026-12-01T03:00:00', 'soon']) expect(() => planReserve(null, null, { estimateUsd: 1, purpose: 'p', opId: 'o', nowIso }), nowIso).toThrow(/instant/);
    expect(planReserve(null, null, { estimateUsd: 1, purpose: 'p', opId: 'o', nowIso: '2026-12-01T00:30:00-05:00' }).result).toMatchObject({ ok: true, month: '2026-12' });
  });
});

describe('settleSpend', () => {
  it('an UNPRICED call counts its estimate; a priced one its actual; the reserved figure moves to what was charged', async () => {
    const ctx = await seedBook();
    await reserve(ctx, { estimateUsd: 0.05, opId: 'p' });
    await reserve(ctx, { estimateUsd: 0.05, opId: 'u' });
    expect(await settle(ctx, { opId: 'p', actualUsd: 0.012 })).toMatchObject({ ok: true, chargedUsd: 0.012 });
    expect(await settle(ctx, { opId: 'u', unpriced: true })).toMatchObject({ ok: true, chargedUsd: 0.05 });
    expect(spendOf(ctx)).toMatchObject({ reservedUsd: 0.062, settledUsd: 0.062 });
    expect(opOf(ctx, 'u')).toMatchObject({ state: 'settled', unpriced: true, chargedUsd: 0.05, actualUsd: null, settledAt: NOV });
  });

  it('a call that cost more than its estimate is charged in full; past the bound, the month is exhausted', async () => {
    const ctx = await seedBook();
    await reserve(ctx, { estimateUsd: 2.9, opId: 'big' });
    expect(await settle(ctx, { opId: 'big', actualUsd: 3.2 })).toMatchObject({ ok: true, chargedUsd: 3.2, exhausted: true });
    expect(spendOf(ctx)).toMatchObject({ reservedUsd: 3.2, exhausted: true, exhaustedBy: { opId: 'big', reason: 'settlement_overrun' } });
    expect(await reserve(ctx, { estimateUsd: 0.01, opId: 'next' })).toMatchObject({ ok: false, code: 'spend_exhausted' });
  });

  it('idempotent: a replayed settlement changes nothing; another charge for the same id is a conflict; an unknown id is refused', async () => {
    const ctx = await seedBook();
    await reserve(ctx, { estimateUsd: 0.05, opId: 'p' });
    await settle(ctx, { opId: 'p', actualUsd: 0.02 });
    const bytes = JSON.stringify([spendOf(ctx), opOf(ctx, 'p')]);
    expect(await settle(ctx, { opId: 'p', actualUsd: 0.02 })).toMatchObject({ ok: true, idempotentReplay: true });
    expect(await settle(ctx, { opId: 'p', actualUsd: 0.03 })).toEqual({ ok: false, code: 'op_id_conflict', opId: 'p' });
    expect(await settle(ctx, { opId: 'p', unpriced: true })).toEqual({ ok: false, code: 'op_id_conflict', opId: 'p' });
    expect(JSON.stringify([spendOf(ctx), opOf(ctx, 'p')])).toBe(bytes);
    expect(await settle(ctx, { opId: 'never', actualUsd: 0.01 })).toEqual({ ok: false, code: 'reservation_not_found', opId: 'never' });
    expect(() => planSettle(null, null, { opId: 'p', actualUsd: 0.01, unpriced: true, nowIso: NOV })).toThrow(/exactly one/);
    expect(() => planSettle(null, null, { opId: 'p', nowIso: NOV })).toThrow(/exactly one/);
  });
});

describe('a new month starts empty', () => {
  it('the first reservation of December finds November\'s exhausted state gone, kept beside it as last month\'s totals', async () => {
    const ctx = await seedBook();
    await reserve(ctx, { estimateUsd: 3, opId: 'all-of-it' });
    expect(await reserve(ctx, { estimateUsd: 0.01, opId: 'nov-late' })).toMatchObject({ ok: false, code: 'spend_exhausted' });
    expect(spendOf(ctx)).toMatchObject({ month: '2026-11', exhausted: true });
    const dec = '2026-12-01T05:00:00.000Z'; // midnight Eastern
    expect(await reserveAt(ctx, dec, { estimateUsd: 0.02, opId: 'dec-1' })).toMatchObject({ ok: true, month: '2026-12', reservedUsd: 0.02, exhausted: false });
    expect(spendOf(ctx)).toMatchObject({ month: '2026-12', reservedUsd: 0.02, settledUsd: 0, exhausted: false, calls: 1, lastMonth: { month: '2026-11', reservedUsd: 3, exhausted: true, calls: 1 } });
  });

  it('a call reserved before midnight and settled after it settles against ITS month', async () => {
    const ctx = await seedBook();
    await reserveAt(ctx, '2026-12-01T04:59:00.000Z', { estimateUsd: 0.05, opId: 'midnight' });
    expect(await settle(ctx, { opId: 'midnight', actualUsd: 0.04 }, '2026-12-01T05:01:00.000Z')).toMatchObject({ ok: true, chargedUsd: 0.04, month: '2026-11', reservedUsd: 0.04 });
    expect(spendOf(ctx)).toMatchObject({ month: '2026-12', reservedUsd: 0, settledUsd: 0, lastMonth: { month: '2026-11', reservedUsd: 0.04, settledUsd: 0.04 } });
    // One reserved two stored months back (September; October is the book's last month by then): charged on its own
    // record; no month's totals are rewritten.
    const old = await seedBook({ uid: 'owner-3', opId: 'c3' });
    await reserveAt(old, '2026-09-10T15:00:00.000Z', { estimateUsd: 0.05, opId: 'sept' });
    await reserveAt(old, '2026-10-10T15:00:00.000Z', { estimateUsd: 0.01, opId: 'oct' });
    await reserveAt(old, '2026-12-02T15:00:00.000Z', { estimateUsd: 0.01, opId: 'dec' });
    const before = JSON.stringify(spendOf(old));
    expect(await settle(old, { opId: 'sept', unpriced: true }, '2026-12-03T15:00:00.000Z')).toMatchObject({ ok: true, chargedUsd: 0.05, month: '2026-09', monthTotalsRetired: true });
    expect(JSON.stringify(spendOf(old))).toBe(before);
    expect(opOf(old, 'sept')).toMatchObject({ state: 'settled', chargedUsd: 0.05 });
  });

  it('a clock BEHIND the book\'s month is refused for a reservation and rolls nothing back (review B5)', async () => {
    const ctx = await seedBook();
    await reserveAt(ctx, '2026-11-30T20:00:00.000Z', { estimateUsd: 2.9, opId: 'nov-big' });
    await reserveAt(ctx, '2026-12-01T05:00:30.000Z', { estimateUsd: 2.5, opId: 'dec-big' });
    const before = JSON.stringify(spendOf(ctx));
    expect(await reserveAt(ctx, '2026-12-01T04:59:50.000Z', { estimateUsd: 2.9, opId: 'stale-clock' })).toEqual({ ok: false, code: 'clock_behind_spend_month', month: '2026-11', storedMonth: '2026-12' });
    expect(JSON.stringify(spendOf(ctx))).toBe(before);
    expect(spendOf(ctx)).toMatchObject({ month: '2026-12', reservedUsd: 2.5, lastMonth: { month: '2026-11', reservedUsd: 2.9 } });
    // A settlement with that clock charges its op's month and rolls nothing.
    expect(await settle(ctx, { opId: 'dec-big', actualUsd: 2.4 }, '2026-12-01T04:59:55.000Z')).toMatchObject({ ok: true, month: '2026-12', reservedUsd: 2.4 });
    expect(spendOf(ctx)).toMatchObject({ month: '2026-12', reservedUsd: 2.4, lastMonth: { month: '2026-11', reservedUsd: 2.9 } });
  });
});

describe('nothing on the money path consults it', () => {
  it('no product module imports spend.js (no caller exists yet: T1b\'s model calls are the first)', () => {
    const dir = new URL('.', import.meta.url);
    const importers = readdirSync(dir).filter((f) => f.endsWith('.js') && !f.includes('.test.') && f !== 'spend.js')
      .filter((f) => /from '\.\/spend\.js'/.test(readFileSync(new URL(f, dir), 'utf8')));
    expect(importers).toEqual([]);
    for (const f of ['close.js', 'exits.js', 'entry.js', 'settlement.js', 'sweep.js', 'fills.js', 'ledger.js', 'marks.js']) {
      expect(readFileSync(new URL(f, dir), 'utf8'), f).not.toMatch(/reserveSpend|settleSpend|spend\.js|\.spend\b|spendOps/);
    }
  });

  it('reserveSpend needs the book as the caller\'s transaction read it, and refuses a missing book', async () => {
    const ctx = await seedBook();
    await expect(ctx.db.runTransaction(async (tx) => reserveSpend(tx, getBook(ctx.db, ctx.bookId), { estimateUsd: 1, purpose: 'p', opId: 'o', nowIso: NOV }))).rejects.toThrow(/DocumentSnapshot/);
    const missing = ctx.db.collection('mandates').doc('no-such-book');
    expect(await ctx.db.runTransaction(async (tx) => reserveSpend(tx, await tx.get(missing), { estimateUsd: 1, purpose: 'p', opId: 'o', nowIso: NOV }))).toEqual({ ok: false, code: 'book_not_found' });
  });
});
