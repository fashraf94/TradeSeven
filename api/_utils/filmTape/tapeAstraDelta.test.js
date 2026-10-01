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
// The close handler's Firestore handle is the in-memory store (DF8's rows drive the real entry).
const admin = vi.hoisted(() => ({ db: null, taken: 0 }));
vi.mock('../firebaseAdmin.js', () => ({ getFirebaseAdmin: () => { admin.taken += 1; return admin.db; } }));

import closeHandler from '../../cron/film-tape-close.js';
import { writeTapeDay } from './writeTapeDay.js';
import { runCandlePass, markRetryWindowElapsed, nextCandleState } from './candlePass.js';
import { runClosePass, runBackfill } from './closePass.js';
import { candleInputFingerprint } from './candleInputs.js';
import { sampleAt } from './bars.js';
import { sessionFor } from './tapeTime.js';
import { stableStringify, mergeTape } from './tapeMerge.js';
import { getReviewAvailability } from '../../../src/utils/reviewAvailability.js';
import { scanProtectedStoreWrites, siteKey } from '../compositionProtectedStoresScan.js';
import { makeTapeDb } from './__fixtures__/tapeFirestore.js';
import { seedDay, capturedDay, noTriggerDay, completedDay, earlyCloseDay } from './__fixtures__/tapeFixtures.js';
import { flatRows, sessionRows, fetcherOf } from './__fixtures__/tapeBars.js';

// CI headroom: a 30 s timeout for every row in this file (a row that passes
// its own, like the 60 s rows below, keeps it). Under a two-worker full run,
// 11 rows here and in tapeAmendmentC.test.js took 5.55–8.38 s and timed out
// at vitest's 5 s default; unchanged, they pass at 30 s
// (docs/audits/20260929_ASTRA_CLOSURE_REVIEW_FILM_TAPE_A1.md §5).
vi.setConfig({ testTimeout: 30_000 });

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

/** capturedDay written WITHOUT tick `seq` and enriched (written, complete); returns the world and the withheld tick. */
async function withoutTick(seq, bars = allBars()) {
  const fx = await capturedDay();
  const tick = fx.ticks.find((tk) => tk.tickSeq === seq);
  const t = world({ ...fx, ticks: fx.ticks.filter((tk) => tk.tickSeq !== seq) });
  await write(t, fx);
  await morning(t, bars);
  expect(tapeOf(t, fx.battleId).passes.candles.status).toBe('written');
  return { t, fx, tick, tick10: tick, recover: () => t.store.set(`agentBattles/${fx.battleId}/ticks/${tick.tickId}`, tick) };
}
const withoutTick10 = (bars) => withoutTick(10, bars);

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

  it('BA-31: each value the replay consumes moves the identity on its own — the banked points alone re-queue through the real writer, and each leg value alone moves the actions part', async () => {
    // D01 changes the entry and the banked points together, and the real writer
    // moves a leg's entry and its threshold baseline together (ghostBaseline):
    // either would mask the other. Here each value moves alone (§9 mutation run).
    const fx = await capturedDay();
    const t = world(fx);
    await write(t, fx);
    await morning(t);
    const before = structuredClone(tsla(tapeOf(t, fx.battleId)));
    const tick5 = fx.ticks.find((tk) => tk.tickSeq === 5);
    const tickRef = `agentBattles/${fx.battleId}/ticks/${tick5.tickId}`;
    const rec = t.store.get(tickRef);
    rec.actions[0].lockedPoints = 20;                                       // −12.5 → 20; the entry untouched
    t.store.set(tickRef, rec);
    await write(t, fx, MORNING + 3_600_000);
    let tape = tapeOf(t, fx.battleId);
    expect([tsla(tape).lockedPoints, tsla(tape).replayInputs]).toEqual([20, before.replayInputs]);
    expect(tape.passes.candles).toMatchObject({ status: 'pending', reason: 'inputs_changed', changedInputs: ['actions'] });
    expect(tape.coverage.replay.status).toBe('partial');
    await morning(t, allBars(), MORNING + DAY);
    tape = tapeOf(t, fx.battleId);
    expect(tsla(tape).replay.gapPoints).not.toBe(before.replay.gapPoints);
    expect(tape.passes.candles.status).toBe('written');
    // each value alone, on the stored tape: the identity's actions part moves every time
    const fp = candleInputFingerprint(tape).actions;
    const i = tape.actions.indexOf(tsla(tape));
    const edits = {
      'ghost.entryPrice': (a) => { a.replayInputs.ghost.entryPrice += 1; },
      'ghost.atr': (a) => { a.replayInputs.ghost.atr += 1; },
      'ghost.tier': (a) => { a.replayInputs.ghost.tier = 'star'; },
      'ghost.direction': (a) => { a.replayInputs.ghost.direction = a.replayInputs.ghost.direction === 'short' ? 'long' : 'short'; },
      'ghost.thresholdHistory.maxMultiplier': (a) => { a.replayInputs.ghost.thresholdHistory.maxMultiplier += 1; },
      'ghost.thresholdHistory.minMultiplier': (a) => { a.replayInputs.ghost.thresholdHistory.minMultiplier -= 1; },
      'ghost.thresholdBaseline.value': (a) => { a.replayInputs.ghost.thresholdBaseline.value += 1; },
      'bought.entryPrice': (a) => { a.replayInputs.bought.entryPrice += 1; },
      'bought.atr': (a) => { a.replayInputs.bought.atr += 1; },
      'bought.thresholdBaseline.value': (a) => { a.replayInputs.bought.thresholdBaseline.value += 1; },
      lockedPoints: (a) => { a.lockedPoints += 1; },
      subsequentTradesInSlot: (a) => { a.subsequentTradesInSlot = (a.subsequentTradesInSlot ?? 0) + 1; },
      at: (a) => { a.at = new Date(Date.parse(a.at) + 60_000).toISOString(); },
    };
    for (const [name, edit] of Object.entries(edits)) {
      const moved = structuredClone(tape);
      edit(moved.actions[i]);
      expect(candleInputFingerprint(moved).actions, name).not.toBe(fp);
    }
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

  // The §2 review of this round (build report §9.11, R1-2): coverage.series carries the plan prices,
  // so a price that lacks a sample is not "complete" there — as a replay missing one is not.
  it('BA-31 (review R1-2): a plan price missing an input holds coverage.series — which carries plan prices — at most partial and names it, even once the pass is spent', async () => {
    const fx = await capturedDay();
    const t = world(fx);
    await write(t, fx);
    const koHoled = allBars({ KO: holed(PRICES.KO, '19:54', '20:00') });      // KO's close sample is stale every morning
    for (const at of [MORNING, MORNING + DAY, MORNING + 4 * DAY]) await morning(t, koHoled, at);
    const tape = tapeOf(t, fx.battleId);
    expect(tape.plans.find((p) => p.symbol === 'KO').price.missingInputs).toEqual(['price:KO@close']);
    expect(tape.passes.candles.status).toBe('exhausted');
    expect(tape.coverage.series.status).toBe('partial');
    expect(tape.coverage.series.note).toMatch(/plan price missing inputs: KO \(price:KO@close\)/);
  });

  it('BA-31: a kept series whose builtFrom is not its inputs\' identity now is labelled and never written — even when it samples every check the tape has', async () => {
    // The real merge cannot produce this (a changed check set leaves a check unsampled, named "built
    // before N check(s)"); the rule is the identity's, so it is pinned on a planted unit (§9 mutation run).
    const fx = await capturedDay();
    const t = world(fx);
    await write(t, fx);
    await morning(t);
    const sp = seriesPath(fx.battleId, 'AAPL');
    t.store.set(sp, { ...t.store.get(sp), builtFrom: 'built-from-other-inputs' });
    const cur = tapeOf(t, fx.battleId);
    t.store.set(tapePath(fx.battleId), { ...cur, passes: { ...cur.passes, candles: { ...cur.passes.candles, status: 'pending' } } });
    await morning(t, allBars({ AAPL: new Error('EODHD 500') }), MORNING + DAY);
    const tape = tapeOf(t, fx.battleId);
    expect(tape.coverage.series.status).toBe('partial');
    expect(tape.coverage.series.note).toMatch(/AAPL: built before its inputs changed/);
    expect(tape.passes.candles).toMatchObject({ status: 'partial', symbolsIncomplete: ['AAPL'] });
  });
});

// ── DF3 — BA-26 amended: a limit preserves coverage only for unchanged dependencies ─

describe('DF3 — BA-26 amended: a read that hits a limit while the section\'s dependencies changed holds it partial with unresolved_dependency', () => {
  /**
   * noTriggerDay written with complete calls coverage, then an evaluation recovered for the day that
   * expected a declarations record — at once, or (`later`) when the row calls `recover()`. `selected`
   * is the battle document as a pass selected it before the evaluation arrived.
   */
  async function recoveredEvaluation({ later = false } = {}) {
    const fx = await noTriggerDay();
    const hooks = {};
    const t = makeTapeDb(seedDay({}, fx), { hooks });
    await write(t, fx);
    expect(tapeOf(t, fx.battleId).coverage.calls).toMatchObject({ status: 'complete' });
    const selected = { id: fx.battleId, ...structuredClone(t.store.get(`agentBattles/${fx.battleId}`)) };
    const recover = () => {
      const battle = t.store.get(`agentBattles/${fx.battleId}`);
      battle.evaluations.push({ ...structuredClone(battle.evaluations[0]), evalId: 'b-quiet:e-recovered', timestamp: '2026-09-24T17:07:00.000Z', promptBuiltAt: '2026-09-24T17:06:52.000Z', declarationsPhase: 'expected' });
      t.store.set(`agentBattles/${fx.battleId}`, battle);
    };
    if (!later) recover();
    const unreadable = (label) => label === `agentBattles/${fx.battleId}/calls` || label.startsWith(`agentBattles/${fx.battleId}/declarations/`);
    return { fx, t, hooks, unreadable, selected, recover };
  }
  const UNRESOLVED = /^unresolved_dependency: /;

  it('D03: calls and declarations unreadable on the read that brings a new evaluation expecting a declarations record — calls coverage is partial, both sources named, never the old "complete"', async () => {
    const { fx, t, hooks, unreadable } = await recoveredEvaluation();
    hooks.beforeRead = (label) => { if (unreadable(label)) throw new Error('14 UNAVAILABLE'); };
    await write(t, fx, NIGHT + 60_000);
    const tape = tapeOf(t, fx.battleId);
    expect(tape.checks.some((c) => c.evalId === 'b-quiet:e-recovered')).toBe(true);
    expect(tape.coverage.calls.status).toBe('partial');
    expect(tape.coverage.calls.caveats).toEqual(expect.arrayContaining([
      "unresolved_dependency: call records (unreadable) on a read after this section's dependencies changed",
      "unresolved_dependency: declaration records (unreadable) on a read after this section's dependencies changed",
    ]));
    expect(tape.coverage.calls.note).toMatch(/unresolved_dependency: call records \(unreadable\)/);
    expect(tape.coverage.calls.dependsOn).toEqual(expect.any(String));
  });

  it('BA-26 amended: the caveat is sticky while the source stays unreadable, and a read that observes the new dependency clears it — the section then says what that read found', async () => {
    const { fx, t, hooks, unreadable } = await recoveredEvaluation();
    hooks.beforeRead = (label) => { if (unreadable(label)) throw new Error('14 UNAVAILABLE'); };
    await write(t, fx, NIGHT + 60_000);
    await write(t, fx, NIGHT + 120_000);                                    // still unreadable, nothing new: still held
    expect(tapeOf(t, fx.battleId).coverage.calls.status).toBe('partial');
    expect(tapeOf(t, fx.battleId).coverage.calls.caveats.filter((c) => c.startsWith('unresolved_dependency'))).toHaveLength(2);
    delete hooks.beforeRead;                                                // readable again, and the expected record exists
    t.store.set(`agentBattles/${fx.battleId}/declarations/b-quiet:e-recovered`, { battleId: fx.battleId, evalId: 'b-quiet:e-recovered', calledShots: [], watching: [], playerAsk: null, fork: null, minted: [] });
    await write(t, fx, NIGHT + 180_000);
    const calls = tapeOf(t, fx.battleId).coverage.calls;
    expect(calls.caveats.some((c) => c.startsWith('unresolved_dependency'))).toBe(false);
    expect(calls.note ?? '').not.toMatch(/unresolved_dependency/);
    expect(calls.status).toBe('complete');
  });

  it('BA-26 amended: dependencies that change on a read that hits no limit are simply observed — no unresolved_dependency, the read\'s own coverage', async () => {
    const { fx, t } = await recoveredEvaluation();
    t.store.set(`agentBattles/${fx.battleId}/declarations/b-quiet:e-recovered`, { battleId: fx.battleId, evalId: 'b-quiet:e-recovered', calledShots: [], watching: [], playerAsk: null, fork: null, minted: [] });
    await write(t, fx, NIGHT + 60_000);
    const calls = tapeOf(t, fx.battleId).coverage.calls;
    expect(calls.status).toBe('complete');
    expect(calls.caveats).toEqual([]);
  });

  // The §2 review of this round (build report §9.11, R2-1): "a read with no limit" is not yet a read
  // that OBSERVED the new dependencies — an assembly older than them has no limit and never saw them.
  // Since BA-37 (Amendment C) the writer assembles from the battle it re-reads, so the next three rows
  // no longer reach that rule through the writer: the re-read brings the evaluation, and the
  // declarations lookup made before it never covered it — a limit of the read (tapeAssemble.js,
  // declarationsUnread). The rule itself is pinned by the pure-merge row after them and by the mixed
  // row (round-3 review L3-2).
  it('BA-26 amended (review R2-1; under BA-37): a write handed the battle as the pass selected it — before the evaluation arrived — assembles from the re-read battle, whose evaluation the declarations lookup never covered: unresolved_dependency stands, calls stays partial', async () => {
    const { fx, t, hooks, unreadable, selected } = await recoveredEvaluation();
    hooks.beforeRead = (label) => { if (unreadable(label)) throw new Error('14 UNAVAILABLE'); };
    await write(t, fx, NIGHT + 60_000);                                        // sees the evaluation; calls and declarations unreadable
    delete hooks.beforeRead;
    await writeTapeDay(fx.battleId, D, { db: t.db, now: NIGHT + 120_000, battle: selected });   // every source readable; the battle predates the evaluation
    let calls = tapeOf(t, fx.battleId).coverage.calls;
    expect(calls.status).toBe('partial');
    expect(calls.caveats.filter((c) => UNRESOLVED.test(c))).toHaveLength(2);
    // a read that does observe it resolves both into what it found
    await write(t, fx, NIGHT + 180_000);
    calls = tapeOf(t, fx.battleId).coverage.calls;
    expect(calls.caveats).toEqual([expect.stringMatching(/expected a declarations record that is absent/)]);
    expect(calls.status).toBe('partial');
  });

  it('BA-26 amended (review R2-1; under BA-37): the same through the writer\'s own transaction retry — the retry re-assembles from the battle that now has the evaluation, which the declarations lookup never covered, and leaves unresolved_dependency standing', async () => {
    const { fx, t, hooks, unreadable, recover } = await recoveredEvaluation({ later: true });
    let landed = false;
    hooks.afterTxRead = async (path) => {
      if (landed || path !== tapePath(fx.battleId)) return;
      landed = true;
      recover();
      hooks.beforeRead = (label) => { if (unreadable(label)) throw new Error('14 UNAVAILABLE'); };
      await write(t, fx, NIGHT + 90_000);                                      // commits inside the first write's transaction
      delete hooks.beforeRead;
      expect(tapeOf(t, fx.battleId).coverage.calls.caveats.filter((c) => UNRESOLVED.test(c))).toHaveLength(2);
    };
    const retries = t.db.txRetries;
    await write(t, fx, NIGHT + 60_000);                                        // assembled, every source readable, before the evaluation existed
    expect(t.db.txRetries).toBeGreaterThan(retries);
    const calls = tapeOf(t, fx.battleId).coverage.calls;
    expect(tapeOf(t, fx.battleId).checks.some((c) => c.evalId === 'b-quiet:e-recovered')).toBe(true);
    expect(calls.status).toBe('partial');
    expect(calls.caveats.filter((c) => UNRESOLVED.test(c))).toHaveLength(2);
  });

  it('BA-26 amended (review R2-1; under BA-37): when the limited read is the tape\'s FIRST write, a later write handed a battle that predates its evaluation assembles from the re-read one, carries the unread-declarations limit, and never lifts calls to complete', async () => {
    const fx = await noTriggerDay();
    const hooks = {};
    const t = makeTapeDb(seedDay({}, fx), { hooks });
    const selected = { id: fx.battleId, ...structuredClone(t.store.get(`agentBattles/${fx.battleId}`)) };
    const battle = t.store.get(`agentBattles/${fx.battleId}`);
    battle.evaluations.push({ ...structuredClone(battle.evaluations[0]), evalId: 'b-quiet:e-recovered', timestamp: '2026-09-24T17:07:00.000Z', promptBuiltAt: '2026-09-24T17:06:52.000Z', declarationsPhase: 'expected' });
    t.store.set(`agentBattles/${fx.battleId}`, battle);
    hooks.beforeRead = (label) => { if (label === `agentBattles/${fx.battleId}/calls` || label.startsWith(`agentBattles/${fx.battleId}/declarations/`)) throw new Error('14 UNAVAILABLE'); };
    await write(t, fx);                                                        // the first write: calls and declarations unreadable
    expect(tapeOf(t, fx.battleId).coverage.calls.status).toBe('unavailable');
    delete hooks.beforeRead;
    await writeTapeDay(fx.battleId, D, { db: t.db, now: NIGHT + 60_000, battle: selected });   // every source readable; the battle predates the evaluation
    expect(tapeOf(t, fx.battleId).coverage.calls.status).not.toBe('complete');
    // the read that observes it says what it found: the expected record is absent
    await write(t, fx, NIGHT + 120_000);
    const calls = tapeOf(t, fx.battleId).coverage.calls;
    expect(calls.caveats).toEqual([expect.stringMatching(/expected a declarations record that is absent/)]);
    expect(calls.status).not.toBe('complete');
  });

  it('BA-26 amended (review R2-1), the merge itself: a limit-free assembly that never saw a dependency the stored section has never lifts that section — the stored coverage stands (round-3 review L3-2: the rule the three rows above no longer reach through the writer)', async () => {
    const fx = await noTriggerDay();
    const hooks = {};
    const t = makeTapeDb(seedDay({}, fx), { hooks });
    const battle = t.store.get(`agentBattles/${fx.battleId}`);
    battle.evaluations.push({ ...structuredClone(battle.evaluations[0]), evalId: 'b-quiet:e-recovered', timestamp: '2026-09-24T17:07:00.000Z', promptBuiltAt: '2026-09-24T17:06:52.000Z', declarationsPhase: 'expected' });
    t.store.set(`agentBattles/${fx.battleId}`, battle);
    hooks.beforeRead = (label) => { if (label === `agentBattles/${fx.battleId}/calls` || label.startsWith(`agentBattles/${fx.battleId}/declarations/`)) throw new Error('14 UNAVAILABLE'); };
    await write(t, fx);                                                        // the stored tape: it saw the evaluation, calls and declarations unreadable
    const stored = structuredClone(tapeOf(t, fx.battleId));
    const fx2 = await noTriggerDay();                                          // the same day assembled from a battle without it, every source readable
    const t2 = world(fx2);
    await write(t2, fx2, NIGHT + 60_000);
    const assembled = structuredClone(tapeOf(t2, fx2.battleId));
    expect(assembled.coverage.calls.status).toBe('complete');
    const { doc } = mergeTape(stored, assembled, { nowIso: iso(NIGHT + 60_000), withinWindow: true, canonicalBattle: true });
    expect(doc.coverage.calls.status).toBe(stored.coverage.calls.status);
    expect(doc.coverage.calls.status).not.toBe('complete');
    expect(doc.coverage.calls.preservedFrom).toBe(stored.writtenAt);
  });

  it('BA-26 amended (review R2-1): a read that brings one new dependency but never saw another vouches for neither — unresolved_dependency, "a read assembled before", until a read observes both', async () => {
    const fx = await noTriggerDay();
    const t = world(fx);
    await write(t, fx);
    const battlePath = `agentBattles/${fx.battleId}`;
    const evaluation = (battle, evalId, minute) => ({ ...structuredClone(battle.evaluations[0]), evalId, timestamp: `2026-09-24T17:${minute}:00.000Z`, promptBuiltAt: `2026-09-24T17:${minute}:00.000Z` });
    const b1 = t.store.get(battlePath);
    b1.evaluations.push(evaluation(b1, 'b-quiet:e-first', '07'));
    t.store.set(battlePath, b1);
    await write(t, fx, NIGHT + 60_000);                                        // observed: calls complete over it
    expect(tapeOf(t, fx.battleId).coverage.calls.status).toBe('complete');
    // a read of a battle that has a second new evaluation but not the first — the battle document
    // itself, since the writer assembles from the battle it re-reads (Amendment C, BA-37)
    const mixed = structuredClone(t.store.get(battlePath));
    mixed.evaluations = mixed.evaluations.filter((e) => e.evalId !== 'b-quiet:e-first');
    mixed.evaluations.push(evaluation(mixed, 'b-quiet:e-second', '37'));
    t.store.set(battlePath, mixed);
    await write(t, fx, NIGHT + 120_000);
    let calls = tapeOf(t, fx.battleId).coverage.calls;
    expect(calls.status).toBe('partial');
    expect(calls.caveats).toEqual(["unresolved_dependency: a read assembled before this section's dependencies changed"]);
    // a read that observes both clears it
    const b2 = t.store.get(battlePath);
    b2.evaluations.splice(b2.evaluations.length - 1, 0, evaluation(b2, 'b-quiet:e-first', '07'));
    t.store.set(battlePath, b2);
    await write(t, fx, NIGHT + 180_000);
    calls = tapeOf(t, fx.battleId).coverage.calls;
    expect(calls.caveats).toEqual([]);
    expect(calls.status).toBe('complete');
  });
});

// ── DF4 — BA-32: terminal candle work leaves the queues ─────────────────────

describe('DF4 — BA-32: expired and exhausted are their own statuses, and no candle query ever returns one', () => {
  /** capturedDay written, plus `n` tapes behind the scan closed out by the code's own close-out writer. */
  async function withClosedOut(n, etDateOf = (i) => AUGUST[i % AUGUST.length]) {
    const fx = await capturedDay();
    const t = world(fx);
    await write(t, fx);
    for (let i = 0; i < n; i += 1) {
      const id = { battleId: `b-t${String(i).padStart(4, '0')}`, etDate: etDateOf(i) };
      plantOld(t, id.battleId, id.etDate);
      expect(await markRetryWindowElapsed(t.db, id, iso(MORNING - DAY))).toBe(true);
    }
    return { fx, t };
  }

  it('D04: a thousand closed-out tapes behind the scan cost the sweep nothing on two consecutive mornings — not a query result, not a transaction', async () => {
    const { t } = await withClosedOut(1000);
    for (const at of [MORNING, MORNING + DAY]) {
      const reads = t.readLog.length;
      const s = await morning(t, allBars(), at);
      expect(s.sweep, iso(at)).toMatchObject({ reads: 0, expired: 0, complete: true });
      expect(t.readLog.slice(reads).filter((r) => r.startsWith('tx:agentBattles/b-t')), iso(at)).toEqual([]);
    }
    expect(t.store.get(tapePath('b-t0000', AUGUST[0])).passes.candles).toMatchObject({ status: 'expired', reason: 'retry_window_elapsed' });
  }, 60_000);

  it('D12: a retryable failed tape behind a thousand closed-out ones on its own date is closed out the first morning — and so is one older than the old 60-session look-back', async () => {
    const { t } = await withClosedOut(1000, () => '2026-08-12');
    plantOld(t, 'b-zz-retry', '2026-08-12', { status: 'failed', attempts: 1, reason: 'fetch_failed' });   // later in the ordering
    plantOld(t, 'b-ancient', '2026-05-01', { status: 'failed', attempts: 1, reason: 'fetch_failed' });    // past the removed look-back
    const s = await morning(t);
    for (const [id, d] of [['b-zz-retry', '2026-08-12'], ['b-ancient', '2026-05-01']]) {
      expect(t.store.get(tapePath(id, d)).passes.candles, id).toMatchObject({ status: 'expired', reason: 'retry_window_elapsed', attempts: 1 });
      expect(s.expired, id).toContain(tapePath(id, d));
    }
    expect(s.sweep).toMatchObject({ reads: 2, expired: 2, complete: true });
  }, 60_000);

  it('D05 (the accepted residual): a thousand foreign pending rows ahead of a valid tape are skipped, counted in summary.invalid and never written', async () => {
    // BA-32: no sanctioned writer can create such a row (BA-35), so the sweep
    // keeps no cursor past it; a non-zero invalid count in production is an
    // alert, not a steady state. The valid tape behind them waits — documented,
    // not fixed.
    const fx = await capturedDay();
    const t = world(fx);
    await write(t, fx);
    for (let i = 0; i < 1000; i += 1) t.store.set(`otherRoot/o${String(i).padStart(4, '0')}/tape/2026-08-03`, { battleId: `o${i}`, etDate: '2026-08-03', passes: { candles: { status: 'pending', attempts: 0 } } });
    plantOld(t, 'b-valid', '2026-08-31');
    const s = await morning(t);
    expect(under(t, 'otherRoot')).toEqual([]);
    expect(s.invalid.filter((p) => p.startsWith('otherRoot/'))).toHaveLength(1000);
    expect(s.written.map((w) => w.path)).toEqual([tapePath('b-captured')]);
  }, 60_000);

  it('BA-32: the third unsuccessful attempt — fetched or thrown — ends `exhausted`, keeping its reason; `failed` is retryable only', async () => {
    const fx = await capturedDay();
    const t = world(fx);
    await write(t, fx);
    const tp = tapePath(fx.battleId);
    t.store.set(tp, { ...tapeOf(t, fx.battleId), passes: { ...tapeOf(t, fx.battleId).passes, candles: { ...tapeOf(t, fx.battleId).passes.candles, status: 'failed', attempts: 2, reason: 'fetch_failed' } } });
    t.db.failNextTransactions(1);                                           // the attempt throws: the failure record counts it
    await morning(t);
    expect(t.store.get(tp).passes.candles).toMatchObject({ status: 'exhausted', attempts: 3, reason: 'attempts_exhausted' });
    expect(nextCandleState({ prev: { attempts: 2 }, requested: ['A'], missing: ['A'], nowIso: 'x' })).toMatchObject({ status: 'exhausted', reason: 'attempts_exhausted', attempts: 3 });
    expect(nextCandleState({ prev: { attempts: 1 }, requested: ['A'], missing: ['A'], nowIso: 'x' })).toMatchObject({ status: 'failed', reason: 'fetch_failed', attempts: 2 });
  });

  it('BA-32: an exhausted tape inside its window whose inputs change keeps `exhausted` — changedInputs recorded, and the label says no candle pass will rebuild it', async () => {
    const fx = await capturedDay();
    const tick10 = fx.ticks.find((tk) => tk.tickSeq === 10);
    const t = world({ ...fx, ticks: fx.ticks.filter((tk) => tk.tickSeq !== 10) });
    await write(t, fx);
    for (const at of [MORNING, MORNING + DAY, MORNING + 4 * DAY]) await morning(t, allBars({ TSLA: new Error('EODHD 500') }), at);
    expect(tapeOf(t, fx.battleId).passes.candles).toMatchObject({ status: 'exhausted', attempts: 3 });
    t.store.set(`agentBattles/${fx.battleId}/ticks/${tick10.tickId}`, tick10);
    await write(t, fx, MORNING + 4 * DAY + 3_600_000);                     // still inside the candle window
    const tape = tapeOf(t, fx.battleId);
    expect(tape.passes.candles).toMatchObject({ status: 'exhausted', reason: 'attempts_exhausted', changedInputs: ['checks'] });
    for (const s of ['replay', 'series']) expect(tape.coverage[s].note, s).toMatch(/built before the candle inputs changed \(checks\) — its attempts are spent, not rebuilt/);
  });

  it('BA-32: the read-out says a terminal day will get no candle pass again', async () => {
    const { formatTapeMarkdown } = await import('./tapeExport.js');
    const { t } = await withClosedOut(1);
    const md = formatTapeMarkdown(t.store.get(tapePath('b-t0000', AUGUST[0])), []);
    expect(md).toMatch(/\*\*candles\*\* — expired \(`retry_window_elapsed`\).* · terminal: its retry window elapsed — no candle pass will run for this day again/);
    // and an exhausted day, its state written by the pass's own rule (review R3-4); a retryable failure gets no such words
    const spent = structuredClone(t.store.get(tapePath('b-t0000', AUGUST[0])));
    spent.passes.candles = nextCandleState({ prev: { attempts: 2 }, requested: ['AAPL'], missing: ['AAPL'], nowIso: iso(MORNING) });
    expect(formatTapeMarkdown(spent, [])).toMatch(/\*\*candles\*\* — exhausted \(`attempts_exhausted`\).* · terminal: its attempts are spent — no candle pass will run for this day again/);
    spent.passes.candles = nextCandleState({ prev: { attempts: 1 }, requested: ['AAPL'], missing: ['AAPL'], nowIso: iso(MORNING) });
    expect(spent.passes.candles.status).toBe('failed');
    expect(formatTapeMarkdown(spent, [])).not.toMatch(/terminal:/);
  });
});

// ── DF5 — BA-33: the sweep has its own clock ────────────────────────────────

describe('DF5 — BA-33: the sweep checks the time before every close-out and spends at most 60 s of the run', () => {
  /** capturedDay written, 100 pending tapes behind the scan, and a clock every close-out transaction charges 4 s. */
  async function slowCloseOuts() {
    const fx = await capturedDay();
    const hooks = {};
    const t = makeTapeDb(seedDay({}, fx), { hooks });
    await write(t, fx);
    for (let i = 0; i < 100; i += 1) plantOld(t, `b-old${String(i).padStart(3, '0')}`, AUGUST[i % AUGUST.length]);
    const clock = { now: MORNING };
    hooks.afterTxRead = async (path) => { if (/^agentBattles\/b-old\d+\/tape\//.test(path)) clock.now += 4_000; };
    const run = (startMs, at = startMs) => { clock.now = Math.max(clock.now, at); return runCandlePass({ db: t.db, fetchCandles: fetcherOf(allBars()).fetchCandles, clock: () => clock.now, startMs }); };
    return { t, clock, run };
  }
  const expiredCount = (t) => [...t.store.entries()].filter(([k, v]) => k.startsWith('agentBattles/b-old') && v.passes?.candles?.reason === 'retry_window_elapsed').length;

  it('D06: one page of 100 close-outs at 4 s each would take 400 s of a 300 s run — the sweep stops at its 60 s share, mid-page, and the day is still enriched', async () => {
    const { t, clock, run } = await slowCloseOuts();
    const s = await run(MORNING);
    expect(s.sweep).toMatchObject({ expired: 15, complete: false, stoppedBy: 'share' });
    expect(expiredCount(t)).toBe(15);
    expect(s.notReached).toEqual([]);
    expect(s.written.map((w) => w.path)).toEqual([tapePath('b-captured')]);
    expect(clock.now - MORNING).toBe(60_000);
  });

  it('BA-33: with 50 s left and a 30 s floor, the sweep stops before the close-out that would cross the floor — mid-page — reports it, and the next morning resumes', async () => {
    const { t, clock, run } = await slowCloseOuts();
    const s = await run(MORNING - 250_000, MORNING);                       // 50 s of the 300 s budget left
    expect(s.sweep).toMatchObject({ expired: 6, complete: false, stoppedBy: 'floor' });
    expect(s.notReached).toEqual([tapePath('b-captured')]);                 // the floor holds for the run's own work too
    expect(expiredCount(t)).toBe(6);
    const s2 = await run(MORNING + DAY);
    expect(s2.sweep).toMatchObject({ expired: 15, stoppedBy: 'share' });
    expect(expiredCount(t)).toBe(21);
    expect(clock.now - (MORNING + DAY)).toBe(60_000);
  });

  // The §2 review of this round (build report §9.11, R1-4): a tape that aged out INSIDE the scan is
  // closed out by the selection, not the sweep — "a deadline before every close-out" holds there too.
  it('BA-33 (review R1-4): the selection\'s own close-outs — tapes aged out inside the scan — share the sweep\'s clock: 100 at 4 s each stop at the 60 s share, the rest wait for tomorrow, and the day is still enriched', async () => {
    const fx = await capturedDay();
    const hooks = {};
    const t = makeTapeDb(seedDay({}, fx), { hooks });
    await write(t, fx);
    const BAND = ['2026-09-03', '2026-09-04', '2026-09-08', '2026-09-09', '2026-09-10'];   // the 2026-09-25 run: inside its scan, behind its window
    for (let i = 0; i < 100; i += 1) plantOld(t, `b-old${String(i).padStart(3, '0')}`, BAND[i % BAND.length]);
    const clock = { now: MORNING };
    hooks.afterTxRead = async (path) => { if (/^agentBattles\/b-old\d+\/tape\//.test(path)) clock.now += 4_000; };
    const s = await runCandlePass({ db: t.db, fetchCandles: fetcherOf(allBars()).fetchCandles, clock: () => clock.now, startMs: MORNING });
    expect(s.sweep).toMatchObject({ expired: 0, complete: true });
    expect(s.expired).toHaveLength(15);
    expect(s.closeOutsDeferred).toEqual(Array.from({ length: 85 }, () => expect.objectContaining({ bound: 'share' })));
    expect(expiredCount(t)).toBe(15);
    expect(s.notReached).toEqual([]);
    expect(s.written.map((w) => w.path)).toEqual([tapePath('b-captured')]);
    expect(clock.now - MORNING).toBe(60_000);
    // the deferred ones wait, still pending — no reader sees them closed out before they are
    expect([...t.store.entries()].filter(([k, v]) => k.startsWith('agentBattles/b-old') && v.passes.candles.status === 'pending')).toHaveLength(85);
  });
});

// ── DF6 — BA-34: a series merges fact by fact, not by count ──────────────────

describe('DF6 — BA-34: a retry merges the series bucket by bucket and check by check — an equal count never costs a saved fact', () => {
  const at = (series, instant) => series.atChecks.find((a) => a.at === instant);
  const bucket = (series, instant) => series.bars.find((b) => b.t === instant);
  /** noTriggerDay; AAPL at 100 with a six-minute hole before 11:30 ET, then (next morning) one before 12:00 ET. */
  async function twoHoleMornings() {
    const fx = await noTriggerDay();
    const t = world(fx);
    await write(t, fx);
    await morning(t, allBars({ AAPL: holed(100, '15:24', '15:30') }));
    const saved = structuredClone(t.store.get(seriesPath(fx.battleId, 'AAPL')));
    expect(tapeOf(t, fx.battleId).passes.candles).toMatchObject({ status: 'partial', symbolsIncomplete: ['AAPL'] });
    await morning(t, allBars({ AAPL: holed(100, '15:54', '16:00') }), MORNING + DAY);
    return { fx, t, saved, aapl: t.store.get(seriesPath(fx.battleId, 'AAPL')) };
  }
  /** A session rising a cent a minute, with the minutes in [fromUtc, toUtc) removed. */
  const rising = (fromUtc = null, toUtc = null) => sessionRows(D, (i) => 100 + i / 100, { extras: false })
    .filter((r) => !fromUtc || r.timestamp * 1000 < Date.parse(`${D}T${fromUtc}:00.000Z`) || r.timestamp * 1000 >= Date.parse(`${D}T${toUtc}:00.000Z`));

  it('D07: two responses of 384 minutes and 24 priced checks, holed at different times — the saved 12:00:20 ET price (100) is never replaced by null, and the other check is priced from the new one', async () => {
    const { saved, aapl } = await twoHoleMornings();
    expect(at(saved, '2026-09-24T16:00:20.000Z')).toMatchObject({ tickSeq: 11, price: 100 });
    expect(at(saved, '2026-09-24T15:30:20.000Z')).toMatchObject({ tickSeq: 9, price: null });
    expect(at(aapl, '2026-09-24T16:00:20.000Z')).toMatchObject({ tickSeq: 11, price: 100 });       // kept
    expect(at(aapl, '2026-09-24T15:30:20.000Z')).toMatchObject({ tickSeq: 9, price: 100 });        // restored by the new response
    expect(aapl.atChecks.filter((a) => a.price === 100)).toHaveLength(25);
    expect(aapl.preservedFrom).toBe(saved.writtenAt);
  });

  it('D11: bucket by bucket, the bar built from more minutes wins — the saved whole 11:50 ET bucket stays over the new 4-minute one, the new whole 11:20 ET bucket replaces the saved 4-minute one; the merged day is whole', async () => {
    const { fx, t, saved, aapl } = await twoHoleMornings();
    expect(bucket(saved, '2026-09-24T15:50:00.000Z')).toMatchObject({ n: 10 });
    expect(bucket(saved, '2026-09-24T15:20:00.000Z')).toMatchObject({ n: 4 });
    expect(bucket(aapl, '2026-09-24T15:50:00.000Z')).toMatchObject({ n: 10, m: 10 });
    expect(bucket(aapl, '2026-09-24T15:20:00.000Z')).toMatchObject({ n: 10, m: 10 });
    expect(aapl.bars).toHaveLength(39);
    expect(aapl.bars.every((b) => b.m === 10)).toBe(true);
    const tape = tapeOf(t, fx.battleId);
    expect(tape.coverage.series.status).toBe('complete');                   // coverage from the merged series
    expect(tape.passes.candles.status).toBe('written');
  });

  it('BA-34: a tie keeps the stored bar — a response with the same minutes but other values leaves the saved bars and prices, marked preservedFrom', async () => {
    const fx = await noTriggerDay();
    const t = world(fx);
    await write(t, fx);
    await morning(t, allBars({ AAPL: flatRows(D, 231), SPY: new Error('EODHD 500') }));
    const saved = structuredClone(t.store.get(seriesPath(fx.battleId, 'AAPL')));
    await morning(t, allBars({ AAPL: flatRows(D, 232) }), MORNING + DAY);
    const aapl = t.store.get(seriesPath(fx.battleId, 'AAPL'));
    expect(aapl.bars).toEqual(saved.bars);
    expect(aapl.atChecks).toEqual(saved.atChecks);
    expect(aapl.preservedFrom).toBe(saved.writtenAt);
  });

  it('BA-34: a saved price is replaced by a price whose bar completed LATER (inside the freshness rule) — and never by one whose bar completed earlier', async () => {
    const fx = await noTriggerDay();
    const t = world(fx);
    await write(t, fx);
    // morning 1: 11:57–11:59 ET missing — the 12:00:20 check reads the 11:56 bar (closed 11:57:00): fresh, not the latest
    await morning(t, allBars({ AAPL: rising('15:57', '16:00'), SPY: new Error('EODHD 500') }));
    expect(at(t.store.get(seriesPath(fx.battleId, 'AAPL')), '2026-09-24T16:00:20.000Z')).toMatchObject({ price: 101.46, barClosedAt: '2026-09-24T15:57:00.000Z' });
    // morning 2: whole — the 11:59 bar closed later (12:00:00): it replaces
    await morning(t, allBars({ AAPL: rising() }), MORNING + DAY);
    expect(at(t.store.get(seriesPath(fx.battleId, 'AAPL')), '2026-09-24T16:00:20.000Z')).toMatchObject({ price: 101.49, barClosedAt: '2026-09-24T16:00:00.000Z' });
    // and the other way round: a whole day saved, an earlier bar offered — the saved price stays
    const fx2 = await noTriggerDay({ battleId: 'b-quiet2' });
    const t2 = world(fx2);
    await write(t2, fx2);
    await morning(t2, allBars({ AAPL: rising(), SPY: new Error('EODHD 500') }));
    await morning(t2, allBars({ AAPL: rising('15:57', '16:00') }), MORNING + DAY);
    const kept = t2.store.get(seriesPath(fx2.battleId, 'AAPL'));
    expect(at(kept, '2026-09-24T16:00:20.000Z')).toMatchObject({ price: 101.49, barClosedAt: '2026-09-24T16:00:00.000Z' });
    expect(kept.preservedFrom).toEqual(expect.any(String));
  });

  it('BA-34: each 10-minute bar stores m, the number of 1-minute bars it was built from, declared market', async () => {
    const { SERIES_NUMBER_CLASSES, classOfNumber } = await import('../../../src/constants/filmTape.js');
    expect(classOfNumber(SERIES_NUMBER_CLASSES, ['bars', 0, 'm'])).toBe('market');
    const fx = await noTriggerDay();
    const t = world(fx);
    await write(t, fx);
    await morning(t, allBars({ AAPL: holed(100, '15:24', '15:30') }));
    const aapl = t.store.get(seriesPath(fx.battleId, 'AAPL'));
    expect(aapl.bars.map((b) => b.m)).toEqual(aapl.bars.map((b) => b.n));
    expect(bucket(aapl, '2026-09-24T15:20:00.000Z').m).toBe(4);
  });

  // The §2 review of this round (build report §9.11, R1-5): a saved sample whose check the tape no
  // longer has — an entry row superseded by its tick — is no fact about any check.
  it('BA-34 (review R1-5): a check known first by its entry, then by its tick, is one check — the entry-instant sample leaves with the superseded row, and a whole refetch replaces the series cleanly', async () => {
    const { t, fx, recover } = await withoutTick(11);
    const entryAt = tapeOf(t, fx.battleId).checks.find((c) => c.evalId === 'b-captured:e11').at;
    expect(t.store.get(seriesPath(fx.battleId, 'AAPL')).atChecks.find((a) => a.at === entryAt)).toMatchObject({ tickSeq: null, price: PRICES.AAPL });
    recover();
    await write(t, fx, MORNING + 3_600_000);                                   // the tick row supersedes the entry row
    await morning(t, allBars(), MORNING + DAY);                               // a whole refetch
    const tape = tapeOf(t, fx.battleId);
    const checkAts = new Set(tape.checks.filter((c) => !['deferred', 'no_record'].includes(c.state) && c.at).map((c) => c.at));
    for (const sym of ['AAPL', 'KO', 'SPY']) {
      const doc = t.store.get(seriesPath(fx.battleId, sym));
      expect(doc.atChecks.filter((a) => !checkAts.has(a.at)), sym).toEqual([]);
      expect(doc.preservedFrom ?? null, sym).toBeNull();
    }
    expect(tape.coverage.series.note ?? '').not.toMatch(/kept from an earlier attempt/);
    expect(tape.passes.candles.status).toBe('written');
  });
});

// ── DF7 — BA-27 amended: on a tie, the canonical battle wins ────────────────

describe('DF7 — BA-27 amended: on equal lifecycle rank the battle re-read in the transaction is authoritative for the whole completion block', () => {
  const stale = (fx, over) => ({ ...structuredClone(fx.battle), id: fx.battleId, ...over });

  it('D08: stored and canonical agree — completed 16:05 ET, 46–36, a win — and a stale COMPLETED assembly (15:55 ET, 9–50, a loss) handed to the writer changes nothing', async () => {
    const fx = await completedDay();
    const t = world(fx);
    await write(t, fx);
    const before = structuredClone(tapeOf(t, fx.battleId));
    expect(before.battle).toMatchObject({ status: 'completed', completedAt: '2026-09-24T20:05:00.000Z', final: { total: 46, opponent: 36 }, result: { value: 'win' } });
    const r = await writeTapeDay(fx.battleId, D, {
      db: t.db, now: NIGHT + 60_000,
      battle: stale(fx, { completedAt: '2026-09-24T19:55:00.000Z', scoreState: { ...fx.battle.scoreState, currentScore: 9, opponentScore: 50 } }),
    });
    const tape = tapeOf(t, fx.battleId);
    expect(tape.battle).toEqual(before.battle);                              // status, completedAt, final, result — one unit
    expect(tape.battleStatusAtWrite).toBe('completed');
    expect(r.status).toBe('unchanged');
  });

  it('BA-27 amended: a stored completion block the re-read contradicts is replaced by the re-read\'s, whole — and one it agrees with keeps its richer basis', async () => {
    const fx = await completedDay();
    fx.battle.result = 'win';                                                // the battle document stores its result
    const t = world(fx);
    await write(t, fx);
    const canonical = structuredClone(tapeOf(t, fx.battleId).battle);
    expect(canonical.result).toEqual({ value: 'win', basis: 'stored' });
    // a block written from a stale read, planted: the re-read on the next write contradicts it
    t.store.set(tapePath(fx.battleId), { ...tapeOf(t, fx.battleId), battle: { status: 'completed', completedAt: '2026-09-24T19:55:00.000Z', final: { total: 9, opponent: 50, at: '2026-09-24T19:55:00.000Z' }, result: { value: 'loss', basis: 'derived' } } });
    await write(t, fx, NIGHT + 60_000);
    expect(tapeOf(t, fx.battleId).battle).toEqual(canonical);
    // the battle document loses its `result` field: the re-read agrees on the completion, so the stored basis stays
    const battle = t.store.get(`agentBattles/${fx.battleId}`);
    delete battle.result;
    t.store.set(`agentBattles/${fx.battleId}`, battle);
    await write(t, fx, NIGHT + 120_000);
    expect(tapeOf(t, fx.battleId).battle).toEqual(canonical);
  });

  it('BA-27 amended: on a tie with no canonical re-read, the stored completion block stands — a stale assembly never replaces a completion the tape recorded', async () => {
    // writeTapeDay always re-reads the battle, so the merge's own rule for a tie WITHOUT one (the
    // battle document gone at the re-read) is pinned on the merge directly (§9 mutation run).
    const { assembleTape } = await import('./tapeAssemble.js');
    const { mergeTape } = await import('./tapeMerge.js');
    const { etDayBounds } = await import('./tapeTime.js');
    const fx = await completedDay();
    const t = world(fx);
    await write(t, fx);
    const stored = tapeOf(t, fx.battleId);
    const assembled = assembleTape({
      battle: stale(fx, { completedAt: '2026-09-24T19:55:00.000Z', scoreState: { ...fx.battle.scoreState, currentScore: 9, opponentScore: 50 } }),
      etDate: D, bounds: etDayBounds(D), nowMs: NIGHT + 60_000,
      ticksRead: { ok: true, ticks: fx.ticks, prevSeq: null, nextSeq: null, method: 'capturedAt_range' },
      runsRead: { ok: true, runs: fx.runs }, receiptsRead: { ok: true, receipts: fx.receipts }, callsRead: { ok: true, calls: fx.calls },
      declarationsRead: { ok: true, present: new Set(fx.declarations) },
    });
    expect(assembled.battle).toMatchObject({ status: 'completed', completedAt: '2026-09-24T19:55:00.000Z' });
    const { doc } = mergeTape(stored, assembled, { nowIso: iso(NIGHT + 60_000), withinWindow: true });
    expect(doc.battle).toEqual(stored.battle);
    expect(doc.battleStatusAtWrite).toBe(stored.battleStatusAtWrite);
  });

  it('BA-27 amended: a stored block the re-read contradicts is replaced even when it records the richer result basis — the richer basis stands only for the same completion', async () => {
    const fx = await completedDay();                                           // no stored `result` on the battle: the re-read's basis is derived
    const t = world(fx);
    await write(t, fx);
    const canonical = structuredClone(tapeOf(t, fx.battleId).battle);
    expect(canonical.result).toMatchObject({ value: 'win', basis: 'derived' });
    t.store.set(tapePath(fx.battleId), { ...tapeOf(t, fx.battleId), battle: { status: 'completed', completedAt: '2026-09-24T19:55:00.000Z', final: { total: 9, opponent: 50, at: '2026-09-24T19:55:00.000Z' }, result: { value: 'loss', basis: 'stored' } } });
    await write(t, fx, NIGHT + 60_000);
    expect(tapeOf(t, fx.battleId).battle).toEqual(canonical);
  });
});

// ── DF8 — BA-29 amended: backfill refresh is the repair path ────────────────

describe('DF8 — BA-29 amended: the admin backfill\'s refresh mode re-merges written days; the default backfill is unchanged', () => {
  const RANGE = `${D}..${D}`;
  const REFRESH_AT = Date.parse('2026-09-28T15:00:00.000Z');   // Monday 11:00 ET — inside 2026-09-24's candle window
  const saved = {};
  beforeEach(() => {
    saved.CRON_SECRET = process.env.CRON_SECRET; saved.ADMIN_SECRET = process.env.ADMIN_SECRET;
    process.env.CRON_SECRET = 'cron-secret'; process.env.ADMIN_SECRET = 'admin-secret';
  });
  afterEach(() => {
    vi.useRealTimers();
    for (const k of ['CRON_SECRET', 'ADMIN_SECRET']) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  });
  /** The real handler, as the founder calls it: both guards, the given query, at `at`. */
  async function call(t, query, at = REFRESH_AT, headers = { authorization: 'Bearer cron-secret', 'x-admin-secret': 'admin-secret' }) {
    admin.db = t.db;
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(at);
    const r = { statusCode: null, body: null };
    r.status = (c) => { r.statusCode = c; return r; };
    r.json = (b) => { r.body = b; return r; };
    await closeHandler({ headers, query }, r);
    vi.useRealTimers();
    return r;
  }
  /** capturedDay written WITHOUT tick 10, then tick 10 restored to the source (the day's sources grew). */
  async function grownDay({ candles = false } = {}) {
    const fx = await capturedDay();
    const tick10 = fx.ticks.find((tk) => tk.tickSeq === 10);
    const t = world({ ...fx, ticks: fx.ticks.filter((tk) => tk.tickSeq !== 10) });
    await write(t, fx);
    if (candles) await morning(t);
    expect(tapeOf(t, fx.battleId).passes.close.gaps).toContain(10);
    t.store.set(`agentBattles/${fx.battleId}/ticks/${tick10.tickId}`, tick10);
    return { fx, t };
  }

  it('D09: a written day whose source grew — `?backfill=…&refresh=1` re-merges it: tick 10 is on the tape, no longer a gap, and the response lists the day as refreshed', async () => {
    const { fx, t } = await grownDay();
    const r = await call(t, { backfill: RANGE, refresh: '1' });
    expect(r.statusCode).toBe(200);
    expect(r.body).toMatchObject({ mode: 'refresh', complete: true, refreshed: [{ battleId: fx.battleId, etDate: D }], unchanged: [], alreadyDone: [] });
    const tape = tapeOf(t, fx.battleId);
    expect(tape.passes.close.gaps).not.toContain(10);
    expect(tape.checks.find((c) => c.tickSeq === 10)).toMatchObject({ rowSource: 'tick' });
  });

  it('BA-29 amended: refresh is idempotent — a written day whose sources did not change writes nothing and is listed unchanged', async () => {
    const fx = await capturedDay();
    const t = world(fx);
    await write(t, fx);
    const writes = t.writeLog.length;
    const r = await call(t, { backfill: RANGE, refresh: '1' });
    expect(r.body).toMatchObject({ mode: 'refresh', complete: true, refreshed: [], unchanged: [{ battleId: fx.battleId, etDate: D }], written: [], alreadyDone: [] });
    expect(t.writeLog.length).toBe(writes);
  });

  it('BA-29 amended: the default backfill is unchanged — the same grown day is `alreadyDone` and keeps its gap', async () => {
    const { fx, t } = await grownDay();
    const writes = t.writeLog.length;
    const r = await call(t, { backfill: RANGE });
    expect(r.body).toMatchObject({ mode: 'backfill', complete: true, alreadyDone: [{ battleId: fx.battleId, etDate: D }], written: [] });
    expect(r.body).not.toHaveProperty('refreshed');
    expect(tapeOf(t, fx.battleId).passes.close.gaps).toContain(10);
    expect(t.writeLog.length).toBe(writes);
  });

  it('BA-29 amended: outside the candle window a refresh re-merges the day but reopens no candle work — a written pass is expired (Amendment C, BA-25 amended), labelled, never pending', async () => {
    const { fx, t } = await grownDay({ candles: true });
    const r = await call(t, { backfill: RANGE, refresh: '1' }, Date.parse('2026-10-26T15:00:00.000Z'));
    expect(r.body.refreshed).toEqual([expect.objectContaining({ battleId: fx.battleId, etDate: D })]);
    const tape = tapeOf(t, fx.battleId);
    expect(tape.passes.candles).toMatchObject({ status: 'expired', reason: 'inputs_changed_outside_window', changedInputs: ['checks'] });
    expect(tape.coverage.replay.note).toMatch(/built before the candle inputs changed \(checks\) — outside its retry window, not rebuilt/);
  });

  /** Fifty later trades — trades[] keeps the last 50, so the day's own leave it. */
  const evictingTrades = () => Array.from({ length: 50 }, (_, i) => ({
    symbolOut: 'KO', symbolIn: 'PEP', name: 'KO', tier: 'support', slotIndex: 0, entryPrice: 70, exitPrice: 71, lockedPoints: 1, lockedGainPct: 1,
    swappedOutAt: new Date(Date.parse('2026-09-25T14:00:00.000Z') + i * 60_000).toISOString(), swapDay: 2, isCrypto: false, id: `t${i}`, source: 'haiku', exitReason: 'haiku_decision',
  }));

  // The §2 review of this round (build report §9.11, R2-2): refresh re-merges written days, so a day
  // whose trades have since left trades[] is re-read without them — the merge must stay monotone.
  it('BA-29 amended (review R2-2): a refresh after the day\'s trades left trades[], on a read with the receipts unreadable, keeps each swap\'s later-trades count — recounted from the merged rows — and no candle input reads as changed, inside the window or outside it', async () => {
    const fx = await capturedDay();
    fx.battle.trades.find((tr) => tr.symbolOut === 'MSFT').tier = 'core';       // MSFT → NFLX joins AMD → TSLA's slot (core, 1)
    const hooks = {};
    const t = makeTapeDb(seedDay({}, fx), { hooks });
    await write(t, fx);
    await morning(t);
    const amd = () => tapeOf(t, fx.battleId).actions.find((a) => a.symbolOut === 'AMD');
    expect([amd().subsequentTradesInSlot, amd().replay.subsequentTradesInSlot, tapeOf(t, fx.battleId).passes.candles.status]).toEqual([1, 1, 'written']);
    const battle = t.store.get(`agentBattles/${fx.battleId}`);
    battle.trades = evictingTrades();
    t.store.set(`agentBattles/${fx.battleId}`, battle);
    hooks.beforeRead = (label) => { if (label.startsWith('learningReceipts/')) throw new Error('14 UNAVAILABLE'); };
    for (const at of [REFRESH_AT, Date.parse('2026-10-26T15:00:00.000Z')]) {
      const r = await call(t, { backfill: RANGE, refresh: '1' }, at);
      expect(r.statusCode, iso(at)).toBe(200);
      expect([amd().tier, amd().slotIndex, amd().subsequentTradesInSlot], iso(at)).toEqual(['core', 1, 1]);
      expect(tapeOf(t, fx.battleId).passes.candles, iso(at)).toMatchObject({ status: 'written' });
      expect(tapeOf(t, fx.battleId).passes.candles.changedInputs ?? [], iso(at)).toEqual([]);
    }
  });

  // The §2 review of this round (build report §9.11, R3-1): the flag-off pin covers the new query too.
  it('BA-29 amended (review R3-1): with the writer dark, every refresh-shaped request is 200 flag_off — nothing read, nothing written, the Firestore handle never taken', async () => {
    const fx = await capturedDay();
    const t = world(fx);
    await write(t, fx);
    flags.writer = false;
    const reads = t.readLog.length;
    const writes = t.writeLog.length;
    admin.taken = 0;
    const cronOnly = { authorization: 'Bearer cron-secret' };
    const both = { ...cronOnly, 'x-admin-secret': 'admin-secret' };
    for (const query of [{ backfill: RANGE, refresh: '1' }, { refresh: '1' }, { backfill: RANGE, refresh: 'yes' }, { backfill: 'bad', refresh: '1' }]) {
      for (const headers of [both, cronOnly]) {
        const r = await call(t, query, REFRESH_AT, headers);
        expect([r.statusCode, r.body], JSON.stringify({ query, admin: 'x-admin-secret' in headers })).toEqual([200, { skipped: true, reason: 'flag_off' }]);
      }
    }
    expect(admin.taken).toBe(0);
    expect(t.readLog.length).toBe(reads);
    expect(t.writeLog.length).toBe(writes);
  });

  it('BA-29 amended: refresh is admin-only like the rest of the entry, needs a range, and takes only `1`', async () => {
    const fx = await capturedDay();
    const t = world(fx);
    await write(t, fx);
    const writes = t.writeLog.length;
    expect((await call(t, { backfill: RANGE, refresh: '1' }, REFRESH_AT, { authorization: 'Bearer cron-secret' })).statusCode).toBe(401);
    expect((await call(t, { backfill: RANGE, refresh: '1' }, REFRESH_AT, { 'x-vercel-cron': '1' })).statusCode).toBe(401);
    expect(await call(t, { refresh: '1' })).toMatchObject({ statusCode: 400, body: { error: 'refresh_requires_backfill' } });
    expect(await call(t, { backfill: RANGE, refresh: 'yes' })).toMatchObject({ statusCode: 400, body: { error: 'invalid_refresh' } });
    expect(t.writeLog.length).toBe(writes);
  });
});

// ── BA-35 — malformed targets are rejected before any write ─────────────────

describe('BA-35 — the close pass validates the target as a calendar session before writeTapeDay or markCloseFailed', () => {
  const selected = (id, tradingDays) => ({
    id, ownerId: 'owner-1', agentId: 'agent-1', gameMode: 'baggerbomb_agent', status: 'completed', timing: { tradingDays },
    activatedAt: '2026-09-24T12:00:00.000Z', completedAt: '2026-09-28T20:05:00.000Z', dailyReviews: [], evaluations: [], trades: [], chatExchanges: [], scoreState: { currentScore: 12, opponentScore: 8 },
  });

  it('C13 (inverted by BA-35): a selected battle whose final day is impossible (2026-02-30) or no session (a Saturday) is counted in summary.invalid — and nothing is written, not even a failure record', async () => {
    const t = makeTapeDb({ 'agentBattles/b-feb30': selected('b-feb30', ['2026-02-30']), 'agentBattles/b-sat': selected('b-sat', ['2026-09-26']) });
    const s = await runClosePass({ db: t.db, clock: () => Date.parse('2026-09-29T02:15:30.000Z') });   // Monday's pass
    expect(t.writeLog).toEqual([]);
    expect(s.failed).toEqual([]);
    expect(s.written).toEqual([]);
    expect(s.invalid).toEqual([{ battleId: 'b-feb30', etDate: '2026-02-30' }, { battleId: 'b-sat', etDate: '2026-09-26' }]);
    expect(t.readLog.some((r) => r.includes('/tape/'))).toBe(false);           // not even read
  });
});
