// api/_utils/filmTape/candlePass.test.js
//
// The candle pass (spec §6) end to end over the in-memory store: the close
// pass writes the tape at night, the candle pass enriches it next morning from
// fixture bars (no network). Selection and the retry policy (attempts, the
// 10-session window, `failed` after three), the symbol set (plan-only names
// included), missing symbols named and null, the series documents, the
// targeted update, and both concurrency orders with the close pass.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the REAL imports of
// candlePass.js and writeTapeDay.js are the runtime guard for their surface
// (src/constants/filmTape.js). Never mock them. The flag module is mocked by
// spreading the real one.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const flags = vi.hoisted(() => ({ writer: true }));
vi.mock('../../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_TAPE_WRITE_ENABLED() { return flags.writer; },
}));

import { runCandlePass, symbolPlan, nextCandleState, UNITS_PER_REQUEST, PLAN_PRICE_NOTE } from './candlePass.js';
import { writeTapeDay } from './writeTapeDay.js';
import { makeTapeDb } from './__fixtures__/tapeFirestore.js';
import { seedDay, capturedDay } from './__fixtures__/tapeFixtures.js';
import { flatRows, fetcherOf } from './__fixtures__/tapeBars.js';
import { numbersWithClasses, formatNumberPath, PROVENANCE_CLASSES } from '../../../src/constants/filmTape.js';
import { stableStringify } from './tapeMerge.js';

const D = '2026-09-24';
const NIGHT = Date.parse('2026-09-25T02:15:30.000Z');
const MORNING = Date.parse('2026-09-25T11:00:30.000Z');
const tapePath = (id = 'b-captured') => `agentBattles/${id}/tape/${D}`;
const PRICES = { AAPL: 231, MSFT: 423, NVDA: 121, AMD: 144, KO: 70.5, PEP: 171, TSLA: 242, NFLX: 704, SNOW: 180, XLK: 250, XLP: 80, XLC: 95, XLY: 210, SPY: 560, RSP: 180 };
const allBars = (over = {}) => {
  const out = {};
  for (const [s, p] of Object.entries(PRICES)) out[s] = flatRows(D, p);
  return { ...out, ...over };
};

async function nightThenMorning({ fx, bars = allBars(), hooks } = {}) {
  const f = fx ?? await capturedDay();
  const t = makeTapeDb(seedDay({}, f), { hooks });
  await writeTapeDay(f.battleId, f.etDate, { db: t.db, now: NIGHT });
  const fetcher = fetcherOf(bars);
  const summary = await runCandlePass({ db: t.db, fetchCandles: fetcher.fetchCandles, clock: () => MORNING, startMs: MORNING });
  return { ...t, fx: f, fetcher, summary, tape: t.store.get(tapePath(f.battleId)) };
}

/** The same capturedDay with a plan-only name: SNOW is never held, sold or bought. */
async function withPlanOnlySymbol() {
  const fx = await capturedDay();
  const e11 = fx.battle.evaluations.find((e) => e.evalId === 'b-captured:e11');
  e11.candidates.push({ symbol: 'SNOW', direction: 'potential_entry', signalSummary: 'Watching', threshold: 'Above 185.' });
  return fx;
}

beforeEach(() => { flags.writer = true; });

describe('the morning after — replay, plan prices, series', () => {
  it('replays every action, prices every plan, writes a series per symbol, and marks the pass written', async () => {
    const { tape, summary, store } = await nightThenMorning({ fx: await withPlanOnlySymbol() });
    expect(summary.written).toHaveLength(1);
    expect(tape.passes.candles).toMatchObject({ status: 'written', attempts: 1, reason: null, source: 'eodhd_1m', symbolsMissing: [] });
    for (const a of tape.actions) {
      expect(a.replay).toMatchObject({ basis: 'rebuilt_1m_at_checks', horizon: 'close', hypothetical: true });
      expect(a.replay.gapPoints).toBe(Math.round((a.lockedPoints + a.replay.bought.atClose - a.replay.ghost.atClose) * 100) / 100);
      expect(a.replay.missingInputs).toEqual([]);
    }
    expect(tape.coverage.replay.status).toBe('complete');
    expect(tape.coverage.series.status).toBe('complete');
    for (const p of tape.plans) {
      expect(p.price).toMatchObject({ note: PLAN_PRICE_NOTE, missingInputs: [] });
      expect(p.price.atPlan).toMatchObject({ value: PRICES[p.symbol], basis: 'last_completed_minute' });
      expect(p.price.atClose).toEqual({ value: PRICES[p.symbol], at: '2026-09-24T20:00:00.000Z', basis: 'last_completed_minute' });
    }
    const seriesPaths = [...store.keys()].filter((k) => k.startsWith(`${tapePath()}/series/`));
    expect(seriesPaths.map((k) => k.split('/').pop()).sort()).toEqual(tape.passes.candles.symbolsRequested);
  });

  it('a plan-only symbol is fetched and has its own series, role "plan"', async () => {
    const { store, tape } = await nightThenMorning({ fx: await withPlanOnlySymbol() });
    expect(tape.passes.candles.symbolsRequested).toContain('SNOW');
    const snow = store.get(`${tapePath()}/series/SNOW`);
    expect(snow).toMatchObject({ symbol: 'SNOW', role: 'plan', interval: '10m', provenance: 'market', ownerId: 'owner-1' });
    expect(snow.bars).toHaveLength(39);
    expect(snow.sessionOpen).toEqual({ value: 180, at: '2026-09-24T13:30:00.000Z' });
  });

  it('series atChecks read the last completed minute before each check, with barClosedAt', async () => {
    const { store, tape } = await nightThenMorning();
    const aapl = store.get(`${tapePath()}/series/AAPL`);
    const scored = tape.checks.filter((c) => c.at && !['deferred', 'no_record'].includes(c.state));
    expect(aapl.atChecks).toHaveLength(scored.length);
    expect(aapl.atChecks[0]).toEqual({ tickSeq: 1, at: '2026-09-24T13:30:20.000Z', price: null, barClosedAt: null }); // 09:30:20 — no minute completed yet
    expect(aapl.atChecks[1]).toEqual({ tickSeq: 2, at: '2026-09-24T13:45:20.000Z', price: 231, barClosedAt: '2026-09-24T13:45:00.000Z' });
  });

  it('the symbol set: held at any check ∪ sold ∪ bought ∪ planned ∪ SPY, RSP ∪ their sector ETFs; crypto excluded', async () => {
    const { tape } = await nightThenMorning({ fx: await withPlanOnlySymbol() });
    const plan = symbolPlan(tape);
    const bySym = Object.fromEntries(plan.map((p) => [p.symbol, p]));
    expect(Object.keys(bySym).sort()).toEqual(['AAPL', 'AMD', 'KO', 'MSFT', 'NFLX', 'NVDA', 'PEP', 'RSP', 'SNOW', 'SPY', 'TSLA', 'XLC', 'XLK', 'XLP', 'XLY']);
    expect(bySym.AMD.role).toBe('sold');
    expect(bySym.TSLA.role).toBe('held');
    expect(bySym.SNOW.role).toBe('plan');
    expect(bySym.SPY.role).toBe('market');
    expect(bySym.XLK.role).toBe('sector');
    expect(bySym).not.toHaveProperty('BTC');
  });

  it('fetches through the generic fetcher at 1m with a window reaching back to the session open; 5 units a request; one request per symbol per session', async () => {
    const { fetcher, summary, tape } = await nightThenMorning();
    const openMs = Date.parse('2026-09-24T13:30:00.000Z');
    expect(fetcher.calls.every((c) => c.interval === '1m' && c.hoursBack === Math.ceil((MORNING - openMs) / 3_600_000) + 1)).toBe(true);
    expect(new Set(fetcher.calls.map((c) => c.symbol)).size).toBe(fetcher.calls.length);
    expect(summary.requests).toBe(tape.passes.candles.symbolsRequested.length);
    expect(summary.units).toBe(summary.requests * UNITS_PER_REQUEST);
  });

  it('two tapes of the same session share each symbol\'s one request', async () => {
    const a = await capturedDay({ battleId: 'b-one' });
    const b = await capturedDay({ battleId: 'b-two' });
    const store = {};
    seedDay(store, a); seedDay(store, b);
    const t = makeTapeDb(store);
    await writeTapeDay('b-one', D, { db: t.db, now: NIGHT });
    await writeTapeDay('b-two', D, { db: t.db, now: NIGHT });
    const fetcher = fetcherOf(allBars());
    const s = await runCandlePass({ db: t.db, fetchCandles: fetcher.fetchCandles, clock: () => MORNING, startMs: MORNING });
    expect(s.written).toHaveLength(2);
    expect(fetcher.calls).toHaveLength(14);
  });
});

describe('never guessed — a missing symbol', () => {
  it('goes to symbolsMissing; its dependents are null with the input named; the pass is partial, and retried', async () => {
    const { tape, store } = await nightThenMorning({ bars: allBars({ TSLA: new Error('EODHD intraday responded with 500') }) });
    expect(tape.passes.candles).toMatchObject({ status: 'partial', attempts: 1, reason: 'symbols_missing', symbolsMissing: ['TSLA'] });
    const risk = tape.actions.find((a) => a.symbolIn === 'TSLA');
    expect(risk.replay.bought).toBeNull();
    expect(risk.replay.swapPath).toBeNull();
    expect(risk.replay.gapPoints).toBeNull();
    expect(risk.replay.ghost.atClose).toEqual(expect.any(Number));
    expect(risk.replay.missingInputs).toContain('bars:TSLA');
    expect(store.has(`${tapePath()}/series/TSLA`)).toBe(false);
    expect(tape.coverage.series).toMatchObject({ status: 'partial', note: 'no bars for: TSLA' });
    expect(tape.coverage.replay.status).toBe('partial');
  });

  it('a missing plan symbol prices nothing: both prices null and the dependency named', async () => {
    const { tape } = await nightThenMorning({ bars: allBars({ NFLX: [] }) });
    const nflx = tape.plans.find((p) => p.symbol === 'NFLX');
    // bars a later morning may still fetch: retryable (BA-24)
    expect(nflx.price).toEqual({ atPlan: null, atClose: null, note: PLAN_PRICE_NOTE, missingInputs: ['bars:NFLX'], retryableInputs: ['bars:NFLX'] });
  });
});

describe('retry (§6) — attempts, the 10-session window, failed after three', () => {
  it('counts each morning; the third unsuccessful attempt is terminal; a fourth morning never selects it', async () => {
    const fx = await capturedDay();
    const t = makeTapeDb(seedDay({}, fx));
    await writeTapeDay(fx.battleId, D, { db: t.db, now: NIGHT });
    const bars = allBars({ TSLA: new Error('500') });
    const mornings = ['2026-09-25T11:00:30Z', '2026-09-26T11:00:30Z', '2026-09-29T11:00:30Z', '2026-09-30T11:00:30Z'].map(Date.parse);
    const seen = [];
    for (const m of mornings) {
      const fetcher = fetcherOf(bars);
      await runCandlePass({ db: t.db, fetchCandles: fetcher.fetchCandles, clock: () => m, startMs: m });
      const c = t.store.get(tapePath()).passes.candles;
      seen.push([c.status, c.attempts, c.reason, fetcher.calls.length > 0]);
    }
    expect(seen).toEqual([
      ['partial', 1, 'symbols_missing', true],
      ['partial', 2, 'symbols_missing', true],
      ['failed', 3, 'attempts_exhausted', true],
      ['failed', 3, 'attempts_exhausted', false],
    ]);
  });

  it('a later success clears it: written, symbolsMissing empty, the replay completed', async () => {
    const fx = await capturedDay();
    const t = makeTapeDb(seedDay({}, fx));
    await writeTapeDay(fx.battleId, D, { db: t.db, now: NIGHT });
    await runCandlePass({ db: t.db, fetchCandles: fetcherOf(allBars({ TSLA: [] })).fetchCandles, clock: () => MORNING, startMs: MORNING });
    const next = Date.parse('2026-09-26T11:00:30Z');
    await runCandlePass({ db: t.db, fetchCandles: fetcherOf(allBars()).fetchCandles, clock: () => next, startMs: next });
    const tape = t.store.get(tapePath());
    expect(tape.passes.candles).toMatchObject({ status: 'written', attempts: 2, symbolsMissing: [] });
    expect(tape.actions.every((a) => a.replay.gapPoints !== null)).toBe(true);
  });

  it('every symbol failing is `failed` (fetch_failed) — still retried while attempts < 3', async () => {
    const bars = Object.fromEntries(Object.keys(PRICES).map((s) => [s, new Error('down')]));
    const { tape } = await nightThenMorning({ bars });
    expect(tape.passes.candles).toMatchObject({ status: 'failed', attempts: 1, reason: 'fetch_failed' });
    expect(tape.coverage.series.status).toBe('unavailable');
    expect(nextCandleState({ prev: { attempts: 1 }, requested: ['A'], missing: ['A'], nowIso: 'x' })).toMatchObject({ status: 'failed', reason: 'fetch_failed', attempts: 2 });
  });

  it('a tape that aged out of the 10-session window while waiting is closed out: failed, retry_window_elapsed, never fetched', async () => {
    const fx = await capturedDay();
    const t = makeTapeDb(seedDay({}, fx));
    await writeTapeDay(fx.battleId, D, { db: t.db, now: NIGHT });
    const late = Date.parse('2026-10-09T11:00:30Z'); // 11 sessions after 2026-09-24
    const fetcher = fetcherOf(allBars());
    const s = await runCandlePass({ db: t.db, fetchCandles: fetcher.fetchCandles, clock: () => late, startMs: late });
    expect(s.expired).toEqual([tapePath()]);
    expect(fetcher.calls).toEqual([]);
    expect(t.store.get(tapePath()).passes.candles).toMatchObject({ status: 'failed', reason: 'retry_window_elapsed', attempts: 0 });
  });

  it('a thrown run still counts as an attempt', async () => {
    const fx = await capturedDay();
    const t = makeTapeDb(seedDay({}, fx));
    await writeTapeDay(fx.battleId, D, { db: t.db, now: NIGHT });
    t.db.failNextTransactions(1); // the candle transaction throws; the failure record is its own transaction
    const s = await runCandlePass({ db: t.db, fetchCandles: fetcherOf(allBars()).fetchCandles, clock: () => MORNING, startMs: MORNING });
    expect(s.failed).toHaveLength(1);
    expect(t.store.get(tapePath()).passes.candles).toMatchObject({ status: 'failed', attempts: 1 });
    expect(t.store.get(tapePath()).passes.candles.reason).toMatch(/^error: tx_failed_by_test/);
    // nothing of the failed attempt landed: no series document, no replay
    expect([...t.store.keys()].some((k) => k.startsWith(`${tapePath()}/series/`))).toBe(false);
    expect(t.store.get(tapePath()).actions.every((a) => a.replay === null)).toBe(true);
  });

  it('oldest first; below the 30 s floor the rest wait for tomorrow untouched', async () => {
    const a = await capturedDay({ battleId: 'b-one' });
    const b = await capturedDay({ battleId: 'b-two' });
    const store = {};
    seedDay(store, a); seedDay(store, b);
    const t = makeTapeDb(store);
    await writeTapeDay('b-one', D, { db: t.db, now: NIGHT });
    await writeTapeDay('b-two', D, { db: t.db, now: NIGHT });
    let now = MORNING;
    const fetcher = fetcherOf(allBars());
    const fetchCandles = async (sym, opts) => { const r = await fetcher.fetchCandles(sym, opts); now = MORNING + 300_000 - 29_000; return r; };
    const s = await runCandlePass({ db: t.db, fetchCandles, clock: () => now, startMs: MORNING, budgetMs: 300_000 });
    expect(s.written.map((w) => w.path)).toEqual(['agentBattles/b-one/tape/2026-09-24']);
    expect(s.notReached).toEqual(['agentBattles/b-two/tape/2026-09-24']);
    expect(t.store.get('agentBattles/b-two/tape/2026-09-24').passes.candles).toMatchObject({ status: 'pending', attempts: 0 });
  });
});

describe('the write — targeted, and safe against the close pass in either order', () => {
  const closeOwned = (tape) => {
    const c = structuredClone(tape);
    for (const a of c.actions) delete a.replay;
    for (const p of c.plans) delete p.price;
    delete c.passes.candles; delete c.coverage.replay; delete c.coverage.series;
    return stableStringify(c);
  };

  it('rewrites only actions[].replay, plans[].price, passes.candles, coverage.replay and coverage.series', async () => {
    const fx = await capturedDay();
    const t = makeTapeDb(seedDay({}, fx));
    await writeTapeDay(fx.battleId, D, { db: t.db, now: NIGHT });
    const before = closeOwned(t.store.get(tapePath()));
    await runCandlePass({ db: t.db, fetchCandles: fetcherOf(allBars()).fetchCandles, clock: () => MORNING, startMs: MORNING });
    expect(closeOwned(t.store.get(tapePath()))).toBe(before);
  });

  it('writes only under tape/{etDate} — the tape and its series — and never reads a tick body', async () => {
    const { writeLog, readLog } = await nightThenMorning();
    for (const w of writeLog) expect(w.path).toMatch(/^agentBattles\/[^/]+\/tape\/\d{4}-\d{2}-\d{2}(\/series\/[A-Z.]+)?$/);
    expect(readLog.some((p) => p.includes('tickBodies'))).toBe(false);
  });

  it('a close pass AFTER the candle pass keeps every candle field (write candles, run the close pass, candle fields intact)', async () => {
    const fx = await capturedDay();
    const t = makeTapeDb(seedDay({}, fx));
    await writeTapeDay(fx.battleId, D, { db: t.db, now: NIGHT });
    await runCandlePass({ db: t.db, fetchCandles: fetcherOf(allBars()).fetchCandles, clock: () => MORNING, startMs: MORNING });
    const enriched = structuredClone(t.store.get(tapePath()));
    const battle = t.store.get('agentBattles/b-captured');
    battle.status = 'completed'; battle.completedAt = '2026-09-24T20:05:00.000Z';
    t.store.set('agentBattles/b-captured', battle);
    const r = await writeTapeDay(fx.battleId, D, { db: t.db, now: MORNING + 60_000 });
    const after = t.store.get(tapePath());
    expect(r.status).toBe('written');
    expect(after.battle.status).toBe('completed');
    expect(after.actions.map((a) => a.replay)).toEqual(enriched.actions.map((a) => a.replay));
    expect(after.plans.map((p) => p.price)).toEqual(enriched.plans.map((p) => p.price));
    expect(after.passes.candles).toEqual(enriched.passes.candles);
    expect(after.coverage.replay).toEqual(enriched.coverage.replay);
    expect(after.coverage.series).toEqual(enriched.coverage.series);
  });

  it('a close pass that ADDS a symbol while the candle pass is fetching: no "written" over bars it never fetched — the tape stays queued', async () => {
    const fx = await capturedDay();
    const t = makeTapeDb(seedDay({}, fx));
    await writeTapeDay(fx.battleId, D, { db: t.db, now: NIGHT });
    const inner = fetcherOf({ ...allBars(), SNOW: flatRows(D, 180) });
    let landed = false;
    const fetchCandles = async (symbol, opts) => {
      if (!landed) {
        landed = true;
        // mid-fetch: a re-run of the close pass picks up a plan on a name the pass did not plan for
        const battle = t.store.get('agentBattles/b-captured');
        battle.evaluations.find((e) => e.evalId === 'b-captured:e11').candidates.push({ symbol: 'SNOW', direction: 'potential_entry', signalSummary: 'Watching', threshold: 'Above 185.' });
        t.store.set('agentBattles/b-captured', battle);
        await writeTapeDay(fx.battleId, D, { db: t.db, now: MORNING });
      }
      return inner.fetchCandles(symbol, opts);
    };
    const s1 = await runCandlePass({ db: t.db, fetchCandles, clock: () => MORNING, startMs: MORNING });
    let tape = t.store.get(tapePath());
    expect(tape.plans.some((p) => p.symbol === 'SNOW')).toBe(true);
    // left exactly as the close pass left it: still pending, no attempt spent, nothing claimed
    expect(tape.passes.candles).toMatchObject({ status: 'pending', attempts: 0 });
    expect(tape.plans.every((p) => p.price === null)).toBe(true);
    expect(tape.actions.every((a) => a.replay === null)).toBe(true);
    expect(s1.requeued).toEqual([tapePath()]);
    expect(inner.calls.some((c) => c.symbol === 'SNOW')).toBe(false);
    // the next morning plans from the tape as it now stands and completes it
    const s2 = await runCandlePass({ db: t.db, fetchCandles: inner.fetchCandles, clock: () => MORNING + 86_400_000, startMs: MORNING + 86_400_000 });
    tape = t.store.get(tapePath());
    expect(s2.written).toHaveLength(1);
    expect(tape.passes.candles).toMatchObject({ status: 'written', attempts: 1, symbolsMissing: [] });
    expect(tape.plans.find((p) => p.symbol === 'SNOW').price.atClose.value).toBe(180);
    expect(t.store.has(`${tapePath()}/series/SNOW`)).toBe(true);
  });

  it('a close pass landing BETWEEN the candle pass\'s read and its commit: the candle transaction retries and keeps both', async () => {
    const fx = await capturedDay();
    let armed = false;
    const t = makeTapeDb(seedDay({}, fx), {
      hooks: {
        afterTxRead: async (path) => {
          if (!armed || path !== tapePath()) return;
          armed = false;
          const battle = t.store.get('agentBattles/b-captured');
          battle.status = 'completed'; battle.completedAt = '2026-09-24T20:05:00.000Z';
          t.store.set('agentBattles/b-captured', battle);
          await writeTapeDay(fx.battleId, D, { db: t.db, now: MORNING });
        },
      },
    });
    await writeTapeDay(fx.battleId, D, { db: t.db, now: NIGHT });
    armed = true;
    const retries = t.db.txRetries;
    await runCandlePass({ db: t.db, fetchCandles: fetcherOf(allBars()).fetchCandles, clock: () => MORNING, startMs: MORNING });
    const tape = t.store.get(tapePath());
    expect(t.db.txRetries).toBeGreaterThan(retries);
    expect(tape.battle.status).toBe('completed');                       // the close pass's fact
    expect(tape.actions.every((a) => a.replay && a.replay.gapPoints !== null)).toBe(true); // the candle pass's facts
    expect(tape.passes.candles.status).toBe('written');
  });
});

describe('number classes on the enriched tape and the series (BA-21)', () => {
  it('every number is classed — the tape after the candle pass, and every series document', async () => {
    const { tape, store } = await nightThenMorning({ fx: await withPlanOnlySymbol(), bars: allBars({ TSLA: new Error('x') }) });
    const docs = [tape, ...[...store.entries()].filter(([k]) => k.includes('/series/')).map(([, v]) => v)];
    for (const doc of docs) {
      const bad = numbersWithClasses(doc, doc.numberClasses).filter((n) => !PROVENANCE_CLASSES.includes(n.cls)).map((n) => formatNumberPath(n.path));
      expect(bad, doc.symbol ?? 'tape').toEqual([]);
    }
  });
});
