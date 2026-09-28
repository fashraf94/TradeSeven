// api/_utils/filmTape/tapeAstraDelta.test.js
//
// THE ASTRA DELTA REVIEW ROWS (docs/audits/20260929_ASTRA_DELTA_REVIEW_FILM_TAPE_A1.md,
// build report §9). The review's controls C01–C16 and its repros D01–D13,
// each rebuilt from the review's text — its evidence zip was not attached, so
// no probe of Astra's is copied here. The rulings are spec V1.2 Amendment B,
// BA-31 … BA-35 with BA-26, BA-27 and BA-29 amended
// (docs/specs/FILM_ROOM_BUILD_A_TAPE_SPEC_V1_2_AMENDMENT_B_20260929.md).
//
//   · A CONTROL (C…) pins what already worked at the reviewed tip (8e754eb8)
//     and must stay green through every fix. Where a ruling renamed what a
//     control names — the terminal candle statuses (BA-32) — the control
//     reaches the terminal state through the code's own writer, so it states
//     the same fact under either vocabulary.
//   · A REPRO (D…) was red at 8e754eb8 and is green after its ruling's fix.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the REAL imports of the writer,
// the close pass, the candle pass and the hub helper. Never mock them. The
// flag module is mocked by spreading the real one.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const flags = vi.hoisted(() => ({ writer: true, v2: false }));
vi.mock('../../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_TAPE_WRITE_ENABLED() { return flags.writer; },
  get FILM_ROOM_V2_ENABLED() { return flags.v2; },
}));

import { writeTapeDay } from './writeTapeDay.js';
import { runCandlePass, markRetryWindowElapsed, nextCandleState } from './candlePass.js';
import { runClosePass, runBackfill } from './closePass.js';
import { candleInputFingerprint } from './candleInputs.js';
import { sampleAt } from './bars.js';
import { sessionFor } from './tapeTime.js';
import { stableStringify } from './tapeMerge.js';
import { getReviewAvailability } from '../../../src/utils/reviewAvailability.js';
import { scanProtectedStoreWrites, siteKey } from '../compositionProtectedStoresScan.js';
import { makeTapeDb } from './__fixtures__/tapeFirestore.js';
import { seedDay, capturedDay, noTriggerDay, earlyCloseDay } from './__fixtures__/tapeFixtures.js';
import { flatRows, fetcherOf } from './__fixtures__/tapeBars.js';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const ALLOWLIST = JSON.parse(readFileSync(resolve(REPO, 'api/_utils/compositionProtectedStoresAllowlist.json'), 'utf8'));

const D = '2026-09-24';
const NIGHT = Date.parse('2026-09-25T02:15:30.000Z');
const MORNING = Date.parse('2026-09-25T11:00:30.000Z'); // run 2026-09-25: window from 2026-09-11, scan from 2026-09-03
const DAY = 86_400_000;
const iso = (ms) => new Date(ms).toISOString();
const tapePath = (id, d = D) => `agentBattles/${id}/tape/${d}`;
const seriesPath = (id, sym, d = D) => `${tapePath(id, d)}/series/${sym}`;
const PRICES = { AAPL: 231, MSFT: 423, NVDA: 121, AMD: 144, KO: 70.5, PEP: 171, TSLA: 242, NFLX: 704, SNOW: 180, COST: 900, XLK: 250, XLP: 80, XLC: 95, XLY: 210, SPY: 560, RSP: 180 };
const allBars = (over = {}) => {
  const out = {};
  for (const [s, p] of Object.entries(PRICES)) out[s] = flatRows(D, p);
  return { ...out, ...over };
};
/** A session of 1-minute rows with the minutes in [fromUtc, toUtc) removed (a trading halt, a vendor hole). */
const holed = (price, fromUtc, toUtc) => flatRows(D, price).filter((r) => r.timestamp * 1000 < Date.parse(`${D}T${fromUtc}:00.000Z`) || r.timestamp * 1000 >= Date.parse(`${D}T${toUtc}:00.000Z`));

const world = (...fxs) => { const store = {}; for (const fx of fxs) seedDay(store, fx); return makeTapeDb(store); };
const write = (t, fx, now = NIGHT, d = fx.etDate ?? D) => writeTapeDay(fx.battleId, d, { db: t.db, now });
const tapeOf = (t, id, d = D) => t.store.get(tapePath(id, d));
const morning = (t, bars = allBars(), at = MORNING, extra = {}) => runCandlePass({ db: t.db, fetchCandles: fetcherOf(bars).fetchCandles, clock: () => at, startMs: at, ...extra });
const under = (t, prefix) => t.writeLog.filter((w) => w.path === prefix || w.path.startsWith(`${prefix}/`));

/** The August 2026 sessions — all older than the scan of the 2026-09-25 morning (it starts 2026-09-03). */
const AUGUST = ['03', '04', '05', '06', '07', '10', '11', '12', '13', '14', '17', '18', '19', '20', '21', '24', '25', '26', '27', '28', '31'].map((d) => `2026-08-${d}`);
/** A tape waiting on the candle pass, planted for another battle and day behind the scan (all the sweep reads). */
const plantOld = (t, battleId, etDate, candles = {}) => t.store.set(tapePath(battleId, etDate), {
  tapeVersion: 2, battleId, etDate, ownerId: 'owner-1',
  passes: { close: { status: 'written' }, candles: { status: 'pending', attempts: 0, reason: null, ...candles } },
});

/** capturedDay written WITHOUT tick 10 and enriched (written, complete); returns the world and the withheld tick. */
async function withoutTick10(bars = allBars()) {
  const fx = await capturedDay();
  const tick10 = fx.ticks.find((tk) => tk.tickSeq === 10);
  const t = world({ ...fx, ticks: fx.ticks.filter((tk) => tk.tickSeq !== 10) });
  await write(t, fx);
  await morning(t, bars);
  expect(tapeOf(t, fx.battleId).passes.candles.status).toBe('written');
  return { t, fx, tick10, recover: () => t.store.set(`agentBattles/${fx.battleId}/ticks/${tick10.tickId}`, tick10) };
}

let errSpy;
beforeEach(() => { flags.writer = true; flags.v2 = false; errSpy = vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { errSpy.mockRestore(); });

// ── the controls: what worked at 8e754eb8 keeps working ─────────────────────

describe('THE CONTROLS (C01–C16) — green at the reviewed tip, green after every fix', () => {
  it('C01: the input identity moves with no bookkeeping — unchanged facts, preserved facts, and an add-then-remove before the close pass all leave it equal', async () => {
    const fx = await capturedDay();
    const t = world(fx);
    await write(t, fx);
    await morning(t);
    const fp = candleInputFingerprint(tapeOf(t, fx.battleId));
    // unchanged facts: a second close pass writes nothing and the identity stands
    expect((await write(t, fx, MORNING + 3_600_000)).status).toBe('unchanged');
    expect(candleInputFingerprint(tapeOf(t, fx.battleId))).toEqual(fp);
    // preserved facts: the receipts gone, the replay inputs are carried from the stored rows (preservedFrom set)
    for (const k of [...t.store.keys()].filter((key) => key.startsWith('learningReceipts/'))) t.store.delete(k);
    await write(t, fx, MORNING + 7_200_000);
    const tape = tapeOf(t, fx.battleId);
    expect(tape.coverage.actions.preservedFrom).not.toBeNull();
    expect(candleInputFingerprint(tape)).toEqual(fp);
    // bookkeeping and provenance never move it
    const moved = structuredClone(tape);
    moved.writtenAt = 'later'; moved.runCount = 99; moved.calls.forEach((c) => { c.copiedAt = 'later'; });
    for (const s of Object.keys(moved.coverage)) moved.coverage[s] = { ...moved.coverage[s], preservedFrom: 'x', note: 'y', status: 'partial' };
    expect(candleInputFingerprint(moved)).toEqual(fp);
    // a tick added to the source and removed again before the close pass runs: nothing to see
    const tick = structuredClone(fx.ticks.find((tk) => tk.tickSeq === 25));
    t.store.set(`agentBattles/${fx.battleId}/ticks/extra`, { ...tick, tickSeq: 26, tickId: `${fx.battleId}:26`, capturedAt: '2026-09-24T19:59:20.000Z' });
    t.store.delete(`agentBattles/${fx.battleId}/ticks/extra`);
    expect((await write(t, fx, MORNING + 10_800_000)).status).toBe('unchanged');
    expect(candleInputFingerprint(tapeOf(t, fx.battleId))).toEqual(fp);
  });

  it('C02: a terminal tape whose inputs change keeps its terminal status — merged twice, it records changedInputs, lowers its coverage once, and carries one label', async () => {
    const { t, fx, recover } = await withoutTick10();
    const tp = tapePath(fx.battleId);
    // closed out by the code's own close-out writer: whatever terminal state it writes is the one under test
    t.store.set(tp, { ...tapeOf(t, fx.battleId), passes: { ...tapeOf(t, fx.battleId).passes, candles: { ...tapeOf(t, fx.battleId).passes.candles, status: 'pending' } } });
    expect(await markRetryWindowElapsed(t.db, { battleId: fx.battleId, etDate: D }, iso(MORNING))).toBe(true);
    const closed = structuredClone(tapeOf(t, fx.battleId).passes.candles);
    expect(closed.reason).toBe('retry_window_elapsed');
    expect(tapeOf(t, fx.battleId).coverage.replay.status).toBe('complete');
    recover();
    const later = Date.parse('2026-10-26T02:15:30.000Z');                  // outside the window: no candle pass comes back
    await write(t, fx, later);
    await write(t, fx, later + 60_000);
    const tape = tapeOf(t, fx.battleId);
    expect(tape.passes.candles).toMatchObject({ status: closed.status, reason: 'retry_window_elapsed', changedInputs: ['checks'] });
    for (const s of ['replay', 'series']) {
      expect(tape.coverage[s].status, s).toBe('partial');
      expect(tape.coverage[s].note.match(/built before the candle inputs changed \(checks\) — outside its retry window, not rebuilt/g), s).toHaveLength(1);
    }
  });

  it('C03: an unchanged dependency set keeps its complete coverage through a read that fails — and a known caveat stays on later runs', async () => {
    const fx = await noTriggerDay();
    const hooks = {};
    const t = makeTapeDb(seedDay({}, fx), { hooks });
    await write(t, fx);
    expect(tapeOf(t, fx.battleId).coverage.calls.status).toBe('complete');
    hooks.beforeRead = (label) => { if (label === `agentBattles/${fx.battleId}/calls`) throw new Error('14 UNAVAILABLE'); };
    await write(t, fx, NIGHT + 60_000);
    const calls = tapeOf(t, fx.battleId).coverage.calls;
    expect(calls.status).toBe('complete');                                  // nothing it depends on changed
    expect(calls.preservedFrom).toBe(tapeOf(t, fx.battleId).firstWrittenAt);
    // a caveat already learned (tick 13 has no record) keeps capturedDay's calls partial through the same failure
    const cap = await capturedDay();
    const hooks2 = {};
    const t2 = makeTapeDb(seedDay({}, cap), { hooks: hooks2 });
    await write(t2, cap);
    expect(tapeOf(t2, cap.battleId).coverage.calls.status).toBe('partial');
    hooks2.beforeRead = (label) => { if (label === `agentBattles/${cap.battleId}/calls`) throw new Error('14 UNAVAILABLE'); };
    await write(t2, cap, NIGHT + 60_000);
    expect(tapeOf(t2, cap.battleId).coverage.calls).toMatchObject({ status: 'partial', unknownChecks: 1 });
  });

  it('C04: an ordinary backlog of 205 aged-out tapes closes 100 / 100 / 5 over three mornings — and the first morning still enriches the day', async () => {
    const fx = await capturedDay();
    const t = world(fx);
    await write(t, fx);
    const old = Array.from({ length: 205 }, (_, i) => ({ battleId: `b-bk${String(i).padStart(3, '0')}`, etDate: AUGUST[i % AUGUST.length] }));
    for (const o of old) plantOld(t, o.battleId, o.etDate);
    const s1 = await morning(t);
    expect(s1.sweep).toMatchObject({ expired: 100, complete: false });
    expect(s1.written.map((w) => w.path)).toEqual([tapePath('b-captured')]);
    expect((await morning(t, allBars(), MORNING + DAY)).sweep).toMatchObject({ expired: 100, complete: false });
    expect((await morning(t, allBars(), MORNING + 4 * DAY)).sweep).toMatchObject({ expired: 5, complete: true });
    for (const o of old) expect(t.store.get(tapePath(o.battleId, o.etDate)).passes.candles.reason, o.battleId).toBe('retry_window_elapsed');
  });

  it('C05: a close-out that throws mid-page costs only itself — the rest of the page is closed out, and the next morning closes that one too', async () => {
    const fx = await capturedDay();
    const hooks = {};
    const t = makeTapeDb(seedDay({}, fx), { hooks });
    await write(t, fx);
    for (const [id, d] of [['b-a', '2026-08-26'], ['b-fail', '2026-08-27'], ['b-z', '2026-08-28']]) plantOld(t, id, d);
    hooks.beforeWrite = (op, path) => { if (path === tapePath('b-fail', '2026-08-27')) throw new Error('14 UNAVAILABLE'); };
    const s1 = await morning(t);
    expect(s1.failed).toEqual([expect.objectContaining({ path: tapePath('b-fail', '2026-08-27'), error: expect.stringMatching(/^close-out: /) })]);
    for (const [id, d] of [['b-a', '2026-08-26'], ['b-z', '2026-08-28']]) expect(t.store.get(tapePath(id, d)).passes.candles.reason, id).toBe('retry_window_elapsed');
    expect(s1.written.map((w) => w.path)).toEqual([tapePath('b-captured')]);
    delete hooks.beforeWrite;
    const s2 = await morning(t, allBars(), MORNING + DAY);
    expect(s2.expired).toEqual([tapePath('b-fail', '2026-08-27')]);
  });

  it('C06: a terminal tape behind the scan never costs a transaction; a foreign one is skipped, counted and never written', async () => {
    const fx = await capturedDay();
    const t = world(fx);
    await write(t, fx);
    // one closed out by the code's own close-out writer, one given the code's own third-attempt state
    plantOld(t, 'b-elapsed', '2026-08-13');
    expect(await markRetryWindowElapsed(t.db, { battleId: 'b-elapsed', etDate: '2026-08-13' }, iso(MORNING - DAY))).toBe(true);
    plantOld(t, 'b-spent', '2026-08-12', nextCandleState({ prev: { attempts: 2 }, requested: ['AAPL'], missing: ['AAPL'], nowIso: iso(MORNING - DAY) }));
    const FOREIGN = 'otherRoot/o1/tape/2026-08-14';
    t.store.set(FOREIGN, { battleId: 'o1', etDate: '2026-08-14', passes: { candles: { status: 'pending', attempts: 0 } } });
    const reads = t.readLog.length;
    const s = await morning(t);
    expect(t.readLog.slice(reads).filter((r) => /^tx:agentBattles\/b-(spent|elapsed)\//.test(r))).toEqual([]);
    expect(s.invalid).toContain(FOREIGN);
    expect(under(t, 'otherRoot')).toEqual([]);
    expect(s.written.map((w) => w.path)).toEqual([tapePath('b-captured')]);
  });

  it('C07: a six-minute halt from 10:55 ET leaves the 11:00:20 check null beside the 10:55 bar\'s close — partial; a whole refetch prices it, writes the pass and keeps nothing preserved', async () => {
    const fx = await noTriggerDay();
    const t = world(fx);
    await write(t, fx);
    await morning(t, allBars({ AAPL: holed(PRICES.AAPL, '14:55', '15:01') }));
    let aapl = t.store.get(seriesPath(fx.battleId, 'AAPL'));
    expect(aapl.atChecks.find((a) => a.at === '2026-09-24T15:00:20.000Z')).toMatchObject({ price: null, barClosedAt: '2026-09-24T14:55:00.000Z' });
    expect(tapeOf(t, fx.battleId).passes.candles).toMatchObject({ status: 'partial', symbolsIncomplete: ['AAPL'] });
    expect(tapeOf(t, fx.battleId).coverage.series.status).toBe('partial');
    await morning(t, allBars(), MORNING + DAY);
    aapl = t.store.get(seriesPath(fx.battleId, 'AAPL'));
    expect(aapl.atChecks.find((a) => a.at === '2026-09-24T15:00:20.000Z')).toMatchObject({ price: PRICES.AAPL });
    expect(aapl.preservedFrom ?? null).toBeNull();
    expect(tapeOf(t, fx.battleId).passes.candles.status).toBe('written');
    expect(tapeOf(t, fx.battleId).coverage.series).toMatchObject({ status: 'complete', preservedFrom: null });
  });

  it('C08: a close sample may be exactly five minutes old (15:55:00 ET), never a second older (15:54:59 ET) — and an early close is whole at 21 buckets', async () => {
    const { closeMs } = sessionFor(D);
    expect(sampleAt([{ t: closeMs - 360_000, c: 1 }], closeMs)).toMatchObject({ valid: true, barClosedAt: closeMs - 300_000 });
    expect(sampleAt([{ t: closeMs - 361_000, c: 1 }], closeMs)).toMatchObject({ valid: false, barClosedAt: closeMs - 301_000 });
    const fx = await earlyCloseDay();
    const t = world(fx);
    await write(t, fx, Date.parse('2026-11-28T02:15:30.000Z'));
    const bars = {};
    for (const [sym, p] of Object.entries(PRICES)) bars[sym] = flatRows(fx.etDate, p, { openUtc: '14:30' });
    const at = Date.parse('2026-11-28T11:00:30.000Z');
    await runCandlePass({ db: t.db, fetchCandles: fetcherOf(bars).fetchCandles, clock: () => at, startMs: at });
    const series = [...t.store.entries()].filter(([k]) => k.startsWith(`${tapePath(fx.battleId, fx.etDate)}/series/`)).map(([, v]) => v);
    expect(series.length).toBeGreaterThan(5);
    for (const doc of series) expect(doc.bars, doc.symbol).toHaveLength(21);
    expect(tapeOf(t, fx.battleId, fx.etDate).passes.candles.status).toBe('written');
  });

  it('C09: a response covering as many minutes but pricing fewer checks never costs the saved series a price', async () => {
    const fx = await capturedDay();
    const t = world(fx);
    await write(t, fx);
    await morning(t, allBars({ AAPL: holed(PRICES.AAPL, '19:20', '19:26'), SPY: new Error('EODHD 500') }));
    const saved = structuredClone(t.store.get(seriesPath(fx.battleId, 'AAPL')));
    expect(saved.atChecks.find((a) => a.at === '2026-09-24T14:00:20.000Z').price).toBe(PRICES.AAPL);
    await morning(t, allBars({ AAPL: holed(PRICES.AAPL, '13:54', '14:00') }), MORNING + DAY);
    const aapl = t.store.get(seriesPath(fx.battleId, 'AAPL'));
    expect(aapl.atChecks).toEqual(saved.atChecks);
    expect(aapl.preservedFrom).toBe(saved.writtenAt);
    expect(tapeOf(t, fx.battleId).passes.candles.status).toBe('written');
  });

  it('C10: a saved series built before a recovered check, whose refetch fails, says so — "built before 1 check(s) were recorded" — and the pass stays queued', async () => {
    const { t, fx, recover } = await withoutTick10();
    recover();
    await write(t, fx, MORNING + 3_600_000);
    await morning(t, allBars({ AAPL: new Error('EODHD 500') }), MORNING + DAY);
    expect(t.store.get(seriesPath(fx.battleId, 'AAPL')).atChecks.some((a) => a.tickSeq === 10)).toBe(false);
    const tape = tapeOf(t, fx.battleId);
    expect(tape.coverage.series.note).toMatch(/AAPL: built before 1 check\(s\) were recorded/);
    expect(tape.passes.candles).toMatchObject({ status: 'partial', symbolsIncomplete: ['AAPL'] });
  });

  it('C11: two backfills overlapping a completion — the stale one retries its transaction and the tape keeps completed, 42', async () => {
    const fx = await noTriggerDay({ battleId: 'b-c11' });
    const hooks = {};
    const t = makeTapeDb(seedDay({}, fx), { hooks });
    const at = Date.parse('2026-09-28T15:00:00.000Z');
    let armed = true;
    hooks.afterTxRead = async (path) => {
      if (!armed || path !== tapePath('b-c11')) return;
      armed = false;
      const battle = t.store.get('agentBattles/b-c11');
      t.store.set('agentBattles/b-c11', { ...battle, status: 'completed', completedAt: '2026-09-24T20:05:00.000Z', scoreState: { ...battle.scoreState, currentScore: 42, opponentScore: 30 } });
      await runBackfill({ db: t.db, clock: () => at, dates: [D] });          // the second backfill lands first, completed
    };
    const retries = t.db.txRetries;
    await runBackfill({ db: t.db, clock: () => at, dates: [D] });            // the first read the battle while it was active
    expect(t.db.txRetries).toBeGreaterThan(retries);
    expect(tapeOf(t, 'b-c11').battle).toMatchObject({ status: 'completed', final: { total: 42, opponent: 30 } });
    expect(tapeOf(t, 'b-c11').battleStatusAtWrite).toBe('completed');
  });

  it('C12: the hub\'s "pending" is backed by a real close-pass write — the Tuesday follow-up, a final day two sessions before the completion, and a timeline that skips a session', async () => {
    flags.v2 = true;
    const cases = [
      { id: 'b-tue', days: ['2026-09-28'], completedAt: '2026-09-28T20:05:00.000Z', ask: '2026-09-29T02:21:00.000Z', pass: '2026-09-30T02:15:30.000Z', finalDay: '2026-09-28' },
      { id: 'b-two', days: ['2026-09-24'], completedAt: '2026-09-28T15:00:00.000Z', ask: '2026-09-28T16:00:00.000Z', pass: '2026-09-29T02:15:30.000Z', finalDay: '2026-09-24' },
      { id: 'b-skip', days: ['2026-09-24', '2026-09-28'], completedAt: '2026-09-28T20:05:00.000Z', ask: '2026-09-28T21:00:00.000Z', pass: '2026-09-29T02:15:30.000Z', finalDay: '2026-09-28' },
    ];
    for (const c of cases) {
      const battle = {
        id: c.id, ownerId: 'owner-1', agentId: 'agent-1', gameMode: 'baggerbomb_agent', status: 'completed', timing: { tradingDays: c.days },
        activatedAt: `${c.days[0]}T12:00:00.000Z`, completedAt: c.completedAt, dailyReviews: [], evaluations: [], trades: [], chatExchanges: [], scoreState: { currentScore: 12, opponentScore: 8 },
      };
      expect((await getReviewAvailability(battle, { readTape: async () => null, now: Date.parse(c.ask) })).availability, c.id).toBe('pending');
      const t = makeTapeDb({ [`agentBattles/${c.id}`]: battle });
      const s = await runClosePass({ db: t.db, clock: () => Date.parse(c.pass) });
      expect(s.written.map((w) => [w.battleId, w.etDate]), c.id).toEqual([[c.id, c.finalDay]]);
      expect(t.store.get(tapePath(c.id, c.finalDay)).battle.status, c.id).toBe('completed');
    }
  });

  it('C14: a check already saved on the tape stays after its source disappears — and the candle pass still owes the rebuild', async () => {
    const { t, fx, tick10, recover } = await withoutTick10();
    recover();
    await write(t, fx, MORNING + 3_600_000);
    t.store.delete(`agentBattles/${fx.battleId}/ticks/${tick10.tickId}`);   // the source loses it again
    await write(t, fx, MORNING + 7_200_000);
    const tape = tapeOf(t, fx.battleId);
    expect(tape.checks.some((c) => c.tickSeq === 10 && c.rowSource === 'tick')).toBe(true);
    expect(tape.passes.candles).toMatchObject({ status: 'pending', changedInputs: ['checks'] });
  });

  it('C15: the scanner sees exactly the write sites the allowlist names — seven, one each, every one with its human-review note', () => {
    const TAPE_SOURCE = /^(api\/_utils\/filmTape\/[^/]+\.js|api\/cron\/film-tape-[^/]+\.js|scripts\/export-film-tape\.js)$/;
    const counts = {};
    for (const s of scanProtectedStoreWrites(REPO).all.filter((x) => TAPE_SOURCE.test(x.file))) counts[siteKey(s)] = (counts[siteKey(s)] ?? 0) + 1;
    const allowed = Object.fromEntries(Object.entries(ALLOWLIST.allowedWriteSites).filter(([k]) => TAPE_SOURCE.test(k.split('::')[0])));
    expect(counts).toEqual(allowed);
    expect(Object.values(counts)).toEqual(Array(7).fill(1));
    expect(Object.keys(ALLOWLIST._notes_film_tape_a1).sort()).toEqual(Object.keys(allowed).sort());
  }, 60_000);

  it('C16: one calendar — the schedule module imports only the calendar and the tape constants, both import nothing, and the server re-exports the very same functions', async () => {
    const importsOf = (rel) => [...readFileSync(resolve(REPO, rel), 'utf8').matchAll(/^import[^;]*?from\s+'([^']+)'/gms)].map((m) => m[1]);
    expect(importsOf('src/utils/marketCalendar.js')).toEqual([]);
    expect(importsOf('src/constants/filmTape.js')).toEqual([]);
    expect(importsOf('src/utils/tapeSchedule.js').sort()).toEqual(['../constants/filmTape.js', './marketCalendar.js']);
    const calendar = await import('../../../src/utils/marketCalendar.js');
    const server = await import('../marketSchedule.js');
    for (const fn of ['getSessionForDate', 'getPreviousSessionDate', 'isMarketHoliday']) expect(server[fn], fn).toBe(calendar[fn]);
  });
});

// ── DF1 — BA-31: the candle input identity is value-sensitive ────────────────

describe('DF1 — BA-31: a changed input VALUE re-queues or labels the candle output, even when nothing appears or disappears', () => {
  const tsla = (tape) => tape.actions.find((a) => a.symbolIn === 'TSLA');

  it('D01: the sold position\'s entry and the banked points change, every input still present — the merge re-queues the replay built from the old values, and a rebuild gives a different gap', async () => {
    const { assembleTape } = await import('./tapeAssemble.js');
    const { mergeTape } = await import('./tapeMerge.js');
    const { replayAction } = await import('./tapeReplay.js');
    const { sessionBars } = await import('./bars.js');
    const { etDayBounds } = await import('./tapeTime.js');
    const fx = await capturedDay();
    const t = world(fx);
    await write(t, fx);
    await morning(t);
    const stored = tapeOf(t, fx.battleId);
    expect(stored.passes.candles.status).toBe('written');
    // the same day, re-read: AMD's entry 150 → 200 (the trade), the banked points −12.5 → 20 (the tick's action)
    const ticks = structuredClone(fx.ticks);
    ticks.find((tk) => tk.tickSeq === 5).actions[0].lockedPoints = 20;
    const trades = structuredClone(fx.battle.trades);
    trades[0].entryPrice = 200;
    const assembled = assembleTape({
      battle: { ...fx.battle, trades, id: fx.battleId }, etDate: D, bounds: etDayBounds(D), nowMs: MORNING + 3_600_000,
      ticksRead: { ok: true, ticks, prevSeq: null, nextSeq: null, method: 'capturedAt_range' },
      runsRead: { ok: true, runs: fx.runs }, receiptsRead: { ok: true, receipts: fx.receipts }, callsRead: { ok: true, calls: fx.calls },
      declarationsRead: { ok: true, present: new Set(fx.declarations) },
    });
    const { doc } = mergeTape(stored, assembled, { nowIso: iso(MORNING + 3_600_000), withinWindow: true });
    const row = tsla(doc);
    expect([row.entryPrice, row.lockedPoints, row.replayInputs.ghost.entryPrice]).toEqual([200, 20, 200]);
    expect(doc.passes.candles).toMatchObject({ status: 'pending', reason: 'inputs_changed', attempts: 0, changedInputs: ['actions'] });
    for (const s of ['replay', 'series']) {
      expect(doc.coverage[s].status, s).toBe('partial');
      expect(doc.coverage[s].note, s).toMatch(/built before the candle inputs changed \(actions\) — awaiting the next candle pass/);
    }
    // why it matters: the kept replay's gap is not the gap of the inputs the tape now holds
    const barsBySymbol = {};
    for (const [sym, rows] of Object.entries(allBars())) barsBySymbol[sym] = sessionBars(rows, D, sessionFor(D));
    const rebuilt = replayAction({ action: row, checks: doc.checks, barsBySymbol, session: sessionFor(D), sectors: doc.comparables.sectors });
    expect(rebuilt.gapPoints).not.toBe(row.replay.gapPoints);
  });

  it('D02: a recorded evidence price the reconciliation read changes (103 → 140) — the close pass names the evidence as changed, and the next morning reconciles against 140', async () => {
    const fx = await capturedDay();
    const t = world(fx);
    await write(t, fx);
    await morning(t);
    const before = tsla(tapeOf(t, fx.battleId)).replay.reconciliation.boughtVsEvidence;
    const e6 = fx.battle.evaluations.find((e) => e.evalId === 'b-captured:e6');
    expect(before).toMatchObject({ tickSeq: 6, recordedPx: e6.evidence.TSLA.px });
    expect(before.recordedPx).toBe(103);
    const battle = t.store.get(`agentBattles/${fx.battleId}`);
    battle.evaluations.find((e) => e.evalId === 'b-captured:e6').evidence.TSLA.px = 140;
    t.store.set(`agentBattles/${fx.battleId}`, battle);
    await write(t, fx, MORNING + 3_600_000);
    const tape = tapeOf(t, fx.battleId);
    expect(tape.checks.find((c) => c.evalId === 'b-captured:e6').evidence.TSLA.px).toBe(140);
    expect(tape.passes.candles).toMatchObject({ status: 'pending', reason: 'inputs_changed', changedInputs: ['evidence'] });
    expect(tape.coverage.replay).toMatchObject({ status: 'partial' });
    await morning(t, allBars(), MORNING + DAY);
    expect(tsla(tapeOf(t, fx.battleId)).replay.reconciliation.boughtVsEvidence).toMatchObject({ tickSeq: 6, recordedPx: 140 });
    expect(tapeOf(t, fx.battleId).passes.candles.status).toBe('written');
  });

  it('D13: through the real close writer, the sold position\'s recorded entry is corrected 150 → 300 — the tape copies it, re-queues the replay built from 150, and the next morning rebuilds from 300', async () => {
    const fx = await capturedDay();
    const t = world(fx);
    await write(t, fx);
    await morning(t);
    const before = structuredClone(tsla(tapeOf(t, fx.battleId)).replay);
    const battle = t.store.get(`agentBattles/${fx.battleId}`);
    battle.trades.find((tr) => tr.symbolOut === 'AMD').entryPrice = 300;
    t.store.set(`agentBattles/${fx.battleId}`, battle);
    await write(t, fx, MORNING + 3_600_000);
    let tape = tapeOf(t, fx.battleId);
    expect(tsla(tape).replayInputs.ghost.entryPrice).toBe(300);
    expect(tsla(tape).replay).toEqual(before);                                 // kept in place, labelled, until replaced
    expect(tape.passes.candles).toMatchObject({ status: 'pending', reason: 'inputs_changed', changedInputs: ['actions'] });
    expect(tape.coverage.replay.status).toBe('partial');
    await morning(t, allBars(), MORNING + DAY);
    tape = tapeOf(t, fx.battleId);
    expect(tsla(tape).replay.ghost.atSwap).not.toBe(before.ghost.atSwap);
    expect(tape.passes.candles.status).toBe('written');
    expect(tape.coverage.replay.status).toBe('complete');
  });
});

// ── DF2 — BA-31: every candle output unit records what it was built from ────

describe('DF2 — BA-31: a kept unit keeps its own builtFrom and its stale label; a retry that could not rebuild it never relabels it current', () => {
  const OUTAGE = Object.fromEntries(Object.keys(PRICES).map((s) => [s, new Error('EODHD 500')]));

  it('D10: tick 10 recovered, then every refetch fails — the replay kept from before tick 10 is still labelled, its coverage stays partial and the pass is not written', async () => {
    const { t, fx, recover } = await withoutTick10();
    recover();
    await write(t, fx, MORNING + 3_600_000);
    expect(tapeOf(t, fx.battleId).coverage.replay.note).toMatch(/built before the candle inputs changed \(checks\)/);
    await morning(t, OUTAGE, MORNING + DAY);
    const tape = tapeOf(t, fx.battleId);
    const amd = tape.actions.find((a) => a.symbolOut === 'AMD');
    expect(amd.replay.holdPath.some((p) => p.tickSeq === 10)).toBe(false);          // kept: built before tick 10
    expect(tape.coverage.replay.status).toBe('partial');
    expect(tape.coverage.replay.note).toMatch(/replay built before its inputs changed, kept \(not rebuilt this attempt\): AMD → TSLA/);
    expect(amd.replay.builtFrom).toEqual(expect.any(String));
    expect(tape.coverage.replay.note).not.toMatch(/MSFT → NFLX/);                   // swapped after tick 10: its inputs did not change
    expect(tape.passes.candles.status).not.toBe('written');
    // and the next morning that can rebuild it does: current, complete, written
    await morning(t, allBars(), MORNING + 2 * DAY);
    const after = tapeOf(t, fx.battleId);
    expect(after.actions.find((a) => a.symbolOut === 'AMD').replay.holdPath.some((p) => p.tickSeq === 10)).toBe(true);
    expect(after.coverage.replay).toMatchObject({ status: 'complete' });
    expect(after.passes.candles.status).toBe('written');
  });

  it('BA-31: a plan whose symbol changed under the same key keeps the price built for the old symbol only as stale — labelled, never "written", until a price for the new symbol replaces it', async () => {
    const fx = await capturedDay();
    const t = world(fx);
    await write(t, fx);
    await morning(t);
    const before = structuredClone(tapeOf(t, fx.battleId).plans);
    // the entry's candidates re-read in the other order: plan :0 is now KO, plan :1 NFLX
    const battle = t.store.get(`agentBattles/${fx.battleId}`);
    const e11 = battle.evaluations.find((e) => e.evalId === 'b-captured:e11');
    e11.candidates = [e11.candidates[1], e11.candidates[0]];
    t.store.set(`agentBattles/${fx.battleId}`, battle);
    await write(t, fx, MORNING + 3_600_000);
    const requeued = tapeOf(t, fx.battleId);
    expect(requeued.passes.candles).toMatchObject({ status: 'pending', changedInputs: ['plans'] });
    expect(requeued.plans.map((p) => [p.symbol, p.price.atClose.value])).toEqual([['KO', before[0].price.atClose.value], ['NFLX', before[1].price.atClose.value]]);
    // the plan symbols' bars fail: the old prices are kept, and they are stale
    await morning(t, allBars({ KO: new Error('EODHD 500'), NFLX: new Error('EODHD 500') }), MORNING + DAY);
    let tape = tapeOf(t, fx.battleId);
    expect(tape.coverage.series.status).toBe('partial');
    expect(tape.coverage.series.note).toMatch(/plan price built before its inputs changed, kept \(not rebuilt this attempt\): KO, NFLX/);
    expect(tape.passes.candles).toMatchObject({ status: 'partial', reason: 'built_before_inputs_changed' });
    await morning(t, allBars(), MORNING + 2 * DAY);
    tape = tapeOf(t, fx.battleId);
    expect(tape.plans.map((p) => [p.symbol, p.price.atClose.value])).toEqual([['KO', PRICES.KO], ['NFLX', PRICES.NFLX]]);
    expect(tape.coverage.series.status).toBe('complete');
    expect(tape.passes.candles.status).toBe('written');
  });

  it('BA-31: builtFrom is on every unit — each replay, each plan price, each series document — as a string with no number class; preserving a fact never changes it', async () => {
    const { replayBuiltFrom, priceBuiltFrom, seriesBuiltFrom } = await import('./candleInputs.js');
    const { numbersWithClasses } = await import('../../../src/constants/filmTape.js');
    const fx = await capturedDay();
    const t = world(fx);
    await write(t, fx);
    await morning(t);
    const tape = tapeOf(t, fx.battleId);
    const session = sessionFor(D);
    for (const a of tape.actions) expect(a.replay.builtFrom, a.key).toBe(replayBuiltFrom(tape, a, session));
    for (const p of tape.plans) expect(p.price.builtFrom, p.key).toBe(priceBuiltFrom(p));
    const series = [...t.store.entries()].filter(([k]) => k.startsWith(`${tapePath(fx.battleId)}/series/`)).map(([, v]) => v);
    for (const doc of series) expect(doc.builtFrom, doc.symbol).toBe(seriesBuiltFrom(tape, doc.symbol));
    for (const doc of [tape, ...series]) expect(numbersWithClasses(doc, doc.numberClasses).some((n) => n.path.includes('builtFrom'))).toBe(false);
    // provenance and bookkeeping never move a unit's identity
    const moved = structuredClone(tape);
    moved.writtenAt = 'later';
    for (const s of Object.keys(moved.coverage)) moved.coverage[s] = { ...moved.coverage[s], preservedFrom: 'x' };
    for (const a of moved.actions) a.replayInputs.ghost.sources = { entryPrice: 'elsewhere' };
    for (const a of moved.actions) expect(replayBuiltFrom(moved, a, session), a.key).toBe(a.replay.builtFrom);
    for (const doc of series) expect(seriesBuiltFrom(moved, doc.symbol), doc.symbol).toBe(doc.builtFrom);
  });
});
