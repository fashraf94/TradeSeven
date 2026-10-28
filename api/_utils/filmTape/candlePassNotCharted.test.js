// api/_utils/filmTape/candlePassNotCharted.test.js
//
// Film Room B2.1 C2 — W5, per-symbol series coverage (Build B Amendment A
// RB-4): the candle pass records each held, traded or planned symbol it did
// not chart, with its reason in the writer's own words, at
// `coverage.series.notCharted`. A declared new field: it moves no bar and no
// price, asks the provider for nothing more, stays candle-owned through every
// close-pass merge, and is no candle input.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the REAL close and candle passes;
// only the writer flag is mocked on (spreading the real module).

import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_TAPE_WRITE_ENABLED() { return true; },
}));

import { writeTapeDay } from './writeTapeDay.js';
import { runCandlePass } from './candlePass.js';
import { notChartedOf, symbolPlan, candleInputFingerprint } from './candleInputs.js';
import { makeTapeDb } from './__fixtures__/tapeFirestore.js';
import { seedDay } from './__fixtures__/tapeFixtures.js';
import { fetcherOf } from './__fixtures__/tapeBars.js';
import { sep23Day, sep23Bars, SEP23, SEP23_NIGHT, SEP23_MORNING } from './__fixtures__/screenFixtures.js';
import { SERIES_NOT_CHARTED_REASONS } from '../../../src/constants/filmTape.js';

vi.setConfig({ testTimeout: 60_000 });

const tapePath = (fx) => `agentBattles/${fx.battleId}/tape/${fx.etDate}`;

/** The Sep-23 fixture day through the real passes, with the bars `drop` names withheld; the fetcher's calls kept. */
async function day({ drop = [], battleId = 'b-w5' } = {}) {
  const fx = await sep23Day({ battleId });
  const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const t = makeTapeDb(seedDay({}, fx));
  await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: SEP23_NIGHT });
  const bars = Object.fromEntries(Object.entries(sep23Bars(SEP23)).filter(([sym]) => !drop.includes(sym)));
  const f = fetcherOf(bars);
  await runCandlePass({ db: t.db, fetchCandles: f.fetchCandles, clock: () => SEP23_MORNING, startMs: SEP23_MORNING });
  errSpy.mockRestore();
  return { fx, t, f, tape: t.store.get(tapePath(fx)) };
}

describe('notChartedOf — the held, traded or planned symbols not charted, with their reasons', () => {
  const tape = {
    checks: [{ risk: { ACN: {}, BTC: {} }, evidence: { MSFT: {} } }, { risk: { ACN: {} } }],
    actions: [{ symbolOut: 'MSFT', symbolIn: 'ETH' }],
    plans: [{ symbol: 'NFLX' }],
    comparables: { sectors: { IBM: 'XLK' } },
    meetings: [{ legs: [{ symbolOut: 'ZZZQ', symbolIn: 'DOGE' }] }],
  };
  it('crypto is never charted; a requested symbol with no series has no bars; a charted one is not listed; sorted by symbol', () => {
    expect(notChartedOf(tape, { missing: ['NFLX', 'SPY', 'XLK', 'ZZZQ'] })).toEqual([
      { symbol: 'BTC', reason: 'crypto_not_supported' },
      { symbol: 'ETH', reason: 'crypto_not_supported' },
      { symbol: 'NFLX', reason: 'no_bars' },
    ]);
  });
  it('the market and sector lines and a meeting-only leg are not held, traded or planned: never listed, missing or not', () => {
    const listed = notChartedOf(tape, { missing: ['SPY', 'XLK', 'ZZZQ', 'DOGE'] }).map((e) => e.symbol);
    for (const s of ['SPY', 'XLK', 'ZZZQ', 'DOGE']) expect(listed).not.toContain(s);
  });
  it('nothing missing and no crypto: an empty list', () => {
    expect(notChartedOf({ checks: [{ risk: { ACN: {} } }] }, { missing: [] })).toEqual([]);
    expect(notChartedOf({}, {})).toEqual([]);
  });
  it('every reason it writes is a declared one (src/constants/filmTape.js)', () => {
    for (const e of notChartedOf(tape, { missing: ['NFLX'] })) expect(SERIES_NOT_CHARTED_REASONS).toContain(e.reason);
    expect(SERIES_NOT_CHARTED_REASONS).toEqual(['crypto_not_supported', 'no_bars']);
  });
});

describe('the candle pass writes it, at coverage.series.notCharted', () => {
  it('the fixture day: BTC is held and never charted — crypto_not_supported; every other held name charted', async () => {
    const { tape } = await day();
    expect(tape.coverage.series.notCharted).toEqual([{ symbol: 'BTC', reason: 'crypto_not_supported' }]);
    expect(tape.coverage.series.status).toBe('complete');   // the section's own status is unchanged: crypto was never requested
  });

  it('a held name the provider returned no bars for: no_bars, beside the section\'s own note naming it', async () => {
    const { tape } = await day({ drop: ['DE'], battleId: 'b-w5-nobars' });
    expect(tape.coverage.series.notCharted).toEqual([{ symbol: 'BTC', reason: 'crypto_not_supported' }, { symbol: 'DE', reason: 'no_bars' }]);
    expect(tape.coverage.series.note).toContain('no bars for: DE');
  });

  it('no new provider request: the pass asks for exactly the symbols it planned before W5 — never a crypto or an uncharted name again', async () => {
    const { f, tape } = await day({ drop: ['DE'], battleId: 'b-w5-calls' });
    const asked = [...new Set(f.calls.map((c) => c.symbol))].sort();
    expect(asked).toEqual(symbolPlan(tape).map((e) => e.symbol).sort());
    expect(asked).not.toContain('BTC');
    expect(f.calls.filter((c) => c.symbol === 'DE')).toHaveLength(1);
  });

  // That it moves nothing else is the screen fixtures' own row (screenFixtures.test.js rebuilds both days through these
  // passes and pins every byte): regenerated for W5, they differ from B2's only by `coverage.series.notCharted`.
  it('the series section\'s keys: the six it had, and notCharted', async () => {
    const { tape } = await day({ battleId: 'b-w5-keys' });
    expect(Object.keys(tape.coverage.series).sort()).toEqual(['notCharted', 'note', 'preservedFrom', 'sources', 'span', 'status']);
  });

  it('it is no candle input: the input fingerprint is the same with or without it', async () => {
    const { tape } = await day({ battleId: 'b-w5-fp' });
    const without = structuredClone(tape);
    delete without.coverage.series.notCharted;
    expect(candleInputFingerprint(tape)).toEqual(candleInputFingerprint(without));
  });

  it('candle-owned: a close-pass re-merge (a refresh) keeps it exactly as the candle pass wrote it', async () => {
    const { fx, t, tape } = await day({ drop: ['DE'], battleId: 'b-w5-merge' });
    await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: SEP23_NIGHT + 86_400_000, refresh: true });
    expect(t.store.get(tapePath(fx)).coverage.series.notCharted).toEqual(tape.coverage.series.notCharted);
  });

  it('before any candle pass the close pass writes none: the series section says it awaits the candle pass, and no symbol is named', async () => {
    const fx = await sep23Day({ battleId: 'b-w5-close' });
    const t = makeTapeDb(seedDay({}, fx));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: SEP23_NIGHT });
    errSpy.mockRestore();
    const tape = t.store.get(tapePath(fx));
    expect(tape.coverage.series.status).toBe('unavailable');
    expect(tape.coverage.series).not.toHaveProperty('notCharted');
  });
});
