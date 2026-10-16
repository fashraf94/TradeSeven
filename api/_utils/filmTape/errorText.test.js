// api/_utils/filmTape/errorText.test.js
//
// Build B Amendment D RD-7 — review X4-3: where a read note or a
// `passes.*.reason` printed an error's message, an error with an EMPTY message
// printed its bare name (`String(err?.message || err)` falls back to
// `String(err)`, which is the name) — past RC-4's class list. errorTextOf
// prints the message when there is one and otherwise the class from the list.
//
// Every site that reaches a tape field, through the real writer and passes:
//   · the source reads (tapeSources.js attempt) → the read notes, and
//     `ticks_unreadable` → `passes.close.reason`;
//   · the close pass's failure record (closePass.js safeMarkFailed) →
//     `passes.close.reason` / `lastError`;
//   · the candle pass's failure record (candlePass.js) → `passes.candles.reason`.
// The plant is Astra's N1 token as the name, with an empty message.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the real modules; only the flag
// module is mocked, by spreading the real one.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_TAPE_WRITE_ENABLED() { return true; },
  CALL_RECORDS_MODE: 'shadow',
}));

import { errorTextOf, errorClassOf } from './errorClass.js';
import { writeTapeDay } from './writeTapeDay.js';
import { runClosePass } from './closePass.js';
import { runCandlePass } from './candlePass.js';
import { makeTapeDb } from './__fixtures__/tapeFirestore.js';
import { seedDay } from './__fixtures__/tapeFixtures.js';
import { stalledDay } from './__fixtures__/tagFixtures.js';
import { flatRows, fetcherOf } from './__fixtures__/tapeBars.js';

vi.setConfig({ testTimeout: 30_000 });

const D = '2026-09-24';
const NIGHT = Date.parse('2026-09-25T02:15:30.000Z');      // 22:15 ET on D
const MORNING = Date.parse('2026-09-25T11:00:30.000Z');
const REGISTERED = 'FakeOwner31Error';
/** An error whose message is empty and whose name is a registered value (Astra's N1 token). */
const planted = () => Object.assign(new Error(''), { name: REGISTERED });
const tapePath = (fx) => `agentBattles/${fx.battleId}/tape/${fx.etDate}`;

let errSpy;
let logSpy;
beforeEach(() => { errSpy = vi.spyOn(console, 'error').mockImplementation(() => {}); logSpy = vi.spyOn(console, 'log').mockImplementation(() => {}); });
afterEach(() => { errSpy.mockRestore(); logSpy.mockRestore(); });

describe('errorTextOf', () => {
  it('the precondition: the old text of an empty-message error is its bare name', () => {
    expect(String(planted()?.message || planted())).toBe(REGISTERED);
  });

  it('a message is printed as before', () => {
    expect(errorTextOf(new Error('14 UNAVAILABLE'))).toBe('14 UNAVAILABLE');
    expect(errorTextOf(Object.assign(new Error('safe reason'), { name: REGISTERED }))).toBe('safe reason');
  });

  it('an EMPTY message prints the class from the list, never the name', () => {
    expect(errorTextOf(planted())).toBe('Error');
    const C = { [REGISTERED]: class extends Error {} }[REGISTERED];
    expect(errorTextOf(new C())).toBe('Error');
    expect(errorTextOf(new TypeError())).toBe('TypeError');
    expect(errorTextOf(Object.assign(new RangeError(''), { message: '' }))).toBe('RangeError');
    expect(errorTextOf({ name: REGISTERED })).toBe(errorClassOf({ name: REGISTERED }));
  });

  it('a thrown value that is not an object keeps its own text; nothing throws', () => {
    expect(errorTextOf('tx_failed')).toBe('tx_failed');
    expect(errorTextOf(undefined)).toBe('undefined');
    const hostile = { get message() { throw new Error('getter'); }, name: REGISTERED };
    expect(errorTextOf(hostile)).toBe('Error');
  });

  it('review Y3-1 — a message with no usable text (no toString, a throwing toString, text that is empty) prints the class; the helper never throws', () => {
    // each of these makes `String(message)` throw or come back empty
    const noToString = Object.assign(new TypeError('x'), { message: Object.create(null) });
    expect(() => String(noToString.message)).toThrow();
    expect(errorTextOf(noToString)).toBe('TypeError');
    expect(errorTextOf({ message: Object.create(null), name: REGISTERED })).toBe('Error');
    expect(errorTextOf({ message: { toString() { throw new Error('ts'); } } })).toBe('Error');
    expect(errorTextOf({ message: [], name: REGISTERED })).toBe('Error');
  });

  it('review Y3-2 — a thrown function or class prints its listed class or `Error`, never its source text', () => {
    const C = class FakeOwner31Error {};
    expect(String(C)).toBe('class FakeOwner31Error {}');          // what String(err) would print
    expect(errorTextOf(C)).toBe('Error');
    expect(errorTextOf(function FakeOwner31Error() {})).toBe('Error');
    expect(errorTextOf(() => 0)).toBe('Error');
    expect(errorTextOf(TypeError)).toBe('TypeError');             // the constructor itself: its `name` is a listed class
  });
});

describe('every tape field an error\'s text reaches prints the class, not the name', () => {
  it('a read note: the receipts read fails with an empty message → "learning receipts unreadable (Error)"', async () => {
    const fx = await stalledDay({ battleId: 'b-x43-read' });
    const hooks = {};
    const t = makeTapeDb(seedDay({}, fx), { hooks });
    hooks.beforeRead = (label) => { if (label.startsWith('learningReceipts/')) throw planted(); };
    await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: NIGHT });
    const note = t.store.get(tapePath(fx)).coverage.actions.note;
    expect(note).toMatch(/learning receipts unreadable \(Error\)/);
    expect(JSON.stringify(t.store.get(tapePath(fx)))).not.toContain(REGISTERED);
  });

  it('passes.close.reason through `ticks_unreadable`: both tick reads fail with an empty message', async () => {
    const fx = await stalledDay({ battleId: 'b-x43-ticks' });
    const hooks = {};
    const t = makeTapeDb(seedDay({}, fx), { hooks });
    hooks.beforeRead = (label) => { if (label.includes(`agentBattles/${fx.battleId}/ticks`)) throw planted(); };
    const s = await runClosePass({ db: t.db, clock: () => NIGHT });
    expect(s.failed).toEqual([{ battleId: fx.battleId, etDate: D, reason: 'ticks_unreadable: Error | Error' }]);
    const tape = t.store.get(tapePath(fx));
    expect(tape.passes.close).toMatchObject({ status: 'failed', reason: 'ticks_unreadable: Error | Error' });
    expect(JSON.stringify(tape)).not.toContain(REGISTERED);
  });

  it('passes.close.reason through the close pass\'s failure record: the write throws with an empty message', async () => {
    const fx = await stalledDay({ battleId: 'b-x43-close' });
    const t = makeTapeDb(seedDay({}, fx));
    const s = await runClosePass({ db: t.db, clock: () => NIGHT, write: async () => { throw planted(); } });
    expect(s.failed).toEqual([{ battleId: fx.battleId, etDate: D, reason: 'Error' }]);
    const close = t.store.get(tapePath(fx)).passes.close;
    expect(close).toMatchObject({ status: 'failed', reason: 'Error', lastError: { reason: 'Error' } });
  });

  it('passes.candles.reason through the candle pass\'s failure record: its run throws with an empty message', async () => {
    const fx = await stalledDay({ battleId: 'b-x43-candles' });
    const hooks = {};
    const t = makeTapeDb(seedDay({}, fx), { hooks });
    await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: NIGHT });
    let first = true;
    hooks.beforeRead = (label) => { if (label === `tx:${tapePath(fx)}` && first) { first = false; throw planted(); } };
    const bars = fetcherOf(new Proxy({}, { get: (_, sym) => (typeof sym === 'string' ? flatRows(D, 100) : undefined) }));
    const s = await runCandlePass({ db: t.db, fetchCandles: bars.fetchCandles, clock: () => MORNING, startMs: MORNING });
    expect(s.failed).toEqual([{ path: tapePath(fx), error: 'Error' }]);
    const candles = t.store.get(tapePath(fx)).passes.candles;
    expect(candles).toMatchObject({ status: 'failed', attempts: 1, reason: 'error: Error' });
    expect(JSON.stringify(candles)).not.toContain(REGISTERED);
  });
});
