// api/_utils/filmTape/tapeAstraReview.test.js
//
// THE ASTRA A1 BRANCH REVIEW ROWS (docs/audits/20260928_ASTRA_REVIEW_FILM_TAPE_A1_BRANCH.md,
// build report §8). One describe per finding, each row named by its finding id
// and, where the review gave one, its repro id (R01, R02, …). Every repro row
// was red at the reviewed tip (e7e527e7) before its fix; the rulings are spec
// V1.2 Amendment A, BA-23 … BA-30
// (docs/specs/FILM_ROOM_BUILD_A_TAPE_SPEC_V1_2_AMENDMENT_A_20260928.md).
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the REAL imports of the writer,
// the close pass and the candle pass. Never mock them. The flag module is
// mocked by spreading the real one.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const flags = vi.hoisted(() => ({ writer: true }));
vi.mock('../../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_TAPE_WRITE_ENABLED() { return flags.writer; },
}));

import { writeTapeDay } from './writeTapeDay.js';
import { runCandlePass } from './candlePass.js';
import { stableStringify } from './tapeMerge.js';
import { makeTapeDb } from './__fixtures__/tapeFirestore.js';
import { seedDay, capturedDay } from './__fixtures__/tapeFixtures.js';
import { flatRows, fetcherOf } from './__fixtures__/tapeBars.js';

const D = '2026-09-24';
const NIGHT = Date.parse('2026-09-25T02:15:30.000Z');
const MORNING = Date.parse('2026-09-25T11:00:30.000Z'); // run 2026-09-25: window from 2026-09-11, scan from 2026-09-03
const tapePath = (id, d = D) => `agentBattles/${id}/tape/${d}`;
const PRICES = { AAPL: 231, MSFT: 423, NVDA: 121, AMD: 144, KO: 70.5, PEP: 171, TSLA: 242, NFLX: 704, SNOW: 180, COST: 900, XLK: 250, XLP: 80, XLC: 95, XLY: 210, SPY: 560, RSP: 180 };
const allBars = (over = {}, days = [D]) => {
  const out = {};
  for (const [s, p] of Object.entries(PRICES)) out[s] = days.flatMap((d) => flatRows(d, p));
  return { ...out, ...over };
};

const world = (...fxs) => { const store = {}; for (const fx of fxs) seedDay(store, fx); return makeTapeDb(store); };
const write = (t, fx, now = NIGHT, d = fx.etDate ?? D) => writeTapeDay(fx.battleId, d, { db: t.db, now });
const tapeOf = (t, id, d = D) => t.store.get(tapePath(id, d));
const morning = (t, bars = allBars(), at = MORNING) => runCandlePass({ db: t.db, fetchCandles: fetcherOf(bars).fetchCandles, clock: () => at, startMs: at });
const under = (t, prefix) => t.writeLog.filter((w) => w.path === prefix || w.path.startsWith(`${prefix}/`));

let errSpy;
beforeEach(() => { flags.writer = true; errSpy = vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { errSpy.mockRestore(); });

// ── F1 — BA-23: the candle pass writes only agentBattles/{battleId}/tape/{etDate} ─────────

describe('F1 — BA-23: a collection-group result is never written on the strength of its collection name', () => {
  /** The sanctioned tape, written by the close pass, and a copy of it planted at `path` with the given etDate. */
  async function planted(paths, { etDate = D, battleId = 'b-captured' } = {}) {
    const fx = await capturedDay();
    const t = world(fx);
    await write(t, fx);
    const tape = { ...structuredClone(tapeOf(t, fx.battleId)), battleId, etDate };
    for (const p of paths) t.store.set(p, structuredClone(tape));
    return { t, fx, tape };
  }
  const FOREIGN = (d = D) => `otherRoot/otherOwner/tape/${d}`;
  const DEEP = (d = D) => `agentBattles/b-deep/archive/2026/tape/${d}`;

  it('F1 R01: an otherwise valid pending tape at otherRoot/otherOwner/tape/2026-09-24 receives zero writes — the sanctioned tape is enriched', async () => {
    const { t } = await planted([FOREIGN()]);
    const before = stableStringify(t.store.get(FOREIGN()));
    const s = await morning(t);
    expect(under(t, FOREIGN())).toEqual([]);                                   // neither the document nor series/*
    expect(stableStringify(t.store.get(FOREIGN()))).toBe(before);
    expect([...t.store.keys()].some((k) => k.startsWith(`${FOREIGN()}/series/`))).toBe(false);
    expect(s.invalid).toEqual([FOREIGN()]);                                    // skipped and counted
    expect(tapeOf(t, 'b-captured').passes.candles.status).toBe('written');     // positive control
    expect(s.written.map((w) => w.path)).toEqual([tapePath('b-captured')]);
  });

  it('F1 (enrichment): foreign-parent and wrong-depth tapes are skipped and counted; the sanctioned tape is fetched and enriched', async () => {
    const { t } = await planted([FOREIGN(), DEEP()]);
    const fetcher = fetcherOf(allBars());
    const s = await runCandlePass({ db: t.db, fetchCandles: fetcher.fetchCandles, clock: () => MORNING, startMs: MORNING });
    expect(under(t, 'otherRoot')).toEqual([]);
    expect(under(t, 'agentBattles/b-deep')).toEqual([]);
    expect([...s.invalid].sort()).toEqual([DEEP(), FOREIGN()].sort());
    expect(s.selected).toBe(1);                                                // only the sanctioned tape was processed
    expect(t.writeLog.every((w) => w.path.startsWith(tapePath('b-captured')))).toBe(true);
    expect(tapeOf(t, 'b-captured').passes.candles.status).toBe('written');
  });

  it('F1 (expiry): aged-out foreign-parent and wrong-depth tapes are never closed out; the sanctioned aged tape is', async () => {
    const aged = '2026-09-08'; // inside the scan, older than the 10-session window of 2026-09-25
    const { t } = await planted([FOREIGN(aged), DEEP(aged), tapePath('b-aged', aged)], { etDate: aged, battleId: 'b-aged' });
    const s = await morning(t);
    expect(under(t, 'otherRoot')).toEqual([]);
    expect(under(t, 'agentBattles/b-deep')).toEqual([]);
    expect(t.store.get(FOREIGN(aged)).passes.candles.status).toBe('pending');
    expect(t.store.get(DEEP(aged)).passes.candles.status).toBe('pending');
    expect([...s.invalid].sort()).toEqual([DEEP(aged), FOREIGN(aged)].sort());
    expect(s.expired).toEqual([tapePath('b-aged', aged)]);                     // positive control
    expect(t.store.get(tapePath('b-aged', aged)).passes.candles).toMatchObject({ status: 'failed', reason: 'retry_window_elapsed' });
  });

  it('F1 (failure record): foreign-parent and wrong-depth tapes whose attempt would throw get no failure record; the sanctioned one does', async () => {
    const weekend = '2026-09-19'; // a Saturday: processing throws not_a_session, which takes the failure-record path
    const { t } = await planted([FOREIGN(weekend), DEEP(weekend), tapePath('b-weekend', weekend)], { etDate: weekend, battleId: 'b-weekend' });
    const s = await morning(t);
    expect(under(t, 'otherRoot')).toEqual([]);
    expect(under(t, 'agentBattles/b-deep')).toEqual([]);
    expect(t.store.get(FOREIGN(weekend)).passes.candles).toMatchObject({ status: 'pending', attempts: 0 });
    expect([...s.invalid].sort()).toEqual([DEEP(weekend), FOREIGN(weekend)].sort());
    const control = t.store.get(tapePath('b-weekend', weekend)).passes.candles;       // positive control
    expect(control).toMatchObject({ status: 'failed', attempts: 1 });
    expect(control.reason).toMatch(/^error: not_a_session/);
  });

  it('F1: a sanctioned-looking path whose etDate is malformed, or whose document names another battle or day, is skipped', async () => {
    const bad = ['agentBattles/b-captured/tape/2026-9-24', 'agentBattles/b-captured/tape/2026-02-30', 'agentBattles/b-other/tape/2026-09-24', 'agentBattles/b-captured/tape/2026-09-23'];
    const { t } = await planted(bad);
    const s = await morning(t);
    for (const p of bad) expect(under(t, p), p).toEqual([]);
    expect([...s.invalid].sort()).toEqual([...bad].sort());
    expect(tapeOf(t, 'b-captured').passes.candles.status).toBe('written');
  });
});
