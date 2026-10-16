// api/_utils/filmTape/closePassLateMeeting.test.js
//
// Film Room B1.1 item 3 — LATE-FILED MEETINGS (Amendment C, RC-3). A meeting
// created after session P's last check is filed into the history at D's first
// check, after P's tape was written. D's close pass re-merges P — deciding
// from the battle document first, reading P's tape only for a candidate,
// writing only when P lacks that meeting — with the same writer.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the real close pass, writer and
// candle pass; only the flag module is mocked, by spreading the real one.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const flags = vi.hoisted(() => ({ writer: true }));
vi.mock('../../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_TAPE_WRITE_ENABLED() { return flags.writer; },
  CALL_RECORDS_MODE: 'shadow',
}));

import { runClosePass, previousTapeDay, meetingKeysOn } from './closePass.js';
import { writeTapeDay } from './writeTapeDay.js';
import { runCandlePass } from './candlePass.js';
import { candleInputFingerprint } from './candleInputs.js';
import { contentOf, stableStringify } from './tapeMerge.js';
import { makeTapeDb } from './__fixtures__/tapeFirestore.js';
import { seedDay, multiDay } from './__fixtures__/tapeFixtures.js';
import { flatRows, fetcherOf } from './__fixtures__/tapeBars.js';

const P = '2026-09-24';
const D = '2026-09-25';
const P_NIGHT = Date.parse('2026-09-25T02:15:30.000Z');     // 22:15 ET on P
const P_MORNING = Date.parse('2026-09-25T11:00:30.000Z');   // P's candle pass
const D_NIGHT = Date.parse('2026-09-26T02:15:30.000Z');     // 22:15 ET on D
const tapePath = (id, d) => `agentBattles/${id}/tape/${d}`;
const PRICES = { AAPL: 231, MSFT: 423, NVDA: 121, AMD: 144, KO: 70.5, PEP: 171, NFLX: 704, XLK: 250, XLP: 80, XLC: 95, XLY: 210, SPY: 560, RSP: 180 };
const bars = () => Object.fromEntries(Object.entries(PRICES).map(([s, p]) => [s, flatRows(P, p)]));

/** The meeting the evaluator proposed at 15:50 ET on P — after P's last check (19:21Z) — as it sits on the battle, unanswered. */
const PENDING = {
  id: 'gpm_late', createdAt: `${P}T19:50:00.000Z`, expiresAt: `${D}T16:00:00.000Z`, status: 'pending',
  diagnosis: 'Consumer Defensive is dragging.', suggestedSwaps: [{ symbolOut: 'KO', symbolIn: 'COST', rationale: 'r' }],
};
/** The same meeting as D's first check files it (expired at its deadline, filed the next morning). */
const FILED = { ...PENDING, status: 'expired', resolvedAt: `${D}T13:30:20.000Z`, resolvedBy: 'system' };
/** The book and bench the server wrote: a leg names one of these (review RF-1). COST is benched — a symbol P's tape names nowhere else. */
const ROSTER = { star: [{ symbol: 'AAPL' }, { symbol: 'MSFT' }], core: [{ symbol: 'NVDA' }, { symbol: 'AMD' }], support: [{ symbol: 'KO' }, { symbol: 'PEP' }], bench: { stocks: [{ symbol: 'COST' }], crypto: null } };

let errSpy;
beforeEach(() => { flags.writer = true; errSpy = vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { errSpy.mockRestore(); vi.unstubAllGlobals(); });

/**
 * A five-day battle; P's close pass ran with the meeting pending on the
 * battle, and P's candle pass ran the next morning. Then D's first check
 * filed it (`filed: false` leaves no meeting on P at all).
 */
async function lateMeetingWorld({ battleId = 'b-late', filed = true, hooks = {} } = {}) {
  const fx = await multiDay({ battleId });
  fx.battle.portfolio = { ...fx.battle.portfolio, ...ROSTER };
  fx.battle.gameplanMeetingHistory = [];
  fx.battle.gameplanMeeting = filed ? structuredClone(PENDING) : null;
  const t = makeTapeDb(seedDay({}, fx), { hooks });
  const sP = await runClosePass({ db: t.db, clock: () => P_NIGHT });
  const candles = fetcherOf(bars());
  await runCandlePass({ db: t.db, fetchCandles: candles.fetchCandles, clock: () => P_MORNING, startMs: P_MORNING });
  const before = structuredClone(t.store.get(tapePath(battleId, P)));
  // D's first check files the meeting into the history and clears it from the battle (agent-evaluate.js resolutionWrite)
  const b = t.store.get(`agentBattles/${battleId}`);
  if (filed) Object.assign(b, { gameplanMeeting: null, gameplanMeetingHistory: [structuredClone(FILED)] });
  t.store.set(`agentBattles/${battleId}`, b);
  return { fx, t, sP, before, candles, battleId };
}
const without = (doc, keys) => { const c = contentOf(structuredClone(doc)); for (const k of keys) delete c[k]; if (c.coverage) delete c.coverage.meetings; return c; };

describe('the rule\'s parts', () => {
  it('P is the previous session in the VALIDATED timeline; none on the first day or for a timeline that does not validate', () => {
    const battle = { timing: { tradingDays: ['2026-09-21', '2026-09-22', '2026-09-23'] } };
    expect(previousTapeDay(battle, '2026-09-23')).toBe('2026-09-22');
    expect(previousTapeDay(battle, '2026-09-21')).toBeNull();
    expect(previousTapeDay({ timing: { tradingDays: ['2026-09-21', 'not-a-date'] } }, '2026-09-22')).toBeNull();
  });

  it('the candidates come from the battle document alone, by the writer\'s own builder and keys', () => {
    const battle = { portfolio: ROSTER, gameplanMeetingHistory: [FILED] };
    expect(meetingKeysOn(battle, P)).toEqual([`gpm_late|${PENDING.createdAt}`]);
    expect(meetingKeysOn(battle, D)).toEqual([]);
  });
});

describe('a meeting created after P\'s last check and filed at D\'s first: P gains it on D\'s close pass', () => {
  let w;
  let sD;
  let fetchSpy;
  beforeEach(async () => {
    w = await lateMeetingWorld();
    fetchSpy = vi.fn(async () => { throw new Error('no network in this test'); });
    vi.stubGlobal('fetch', fetchSpy);
    sD = await runClosePass({ db: w.t.db, clock: () => D_NIGHT });
  });

  it('P\'s own pass wrote it without the meeting, saying it was not yet filed', () => {
    expect(w.sP.written.map((x) => x.etDate)).toEqual([P]);
    expect(w.before.meetings).toEqual([]);
    expect(w.before.coverage.meetings.note).toMatch(/not yet filed/);
    expect(w.before.passes.candles.status).toBe('written');
  });

  it('D is written, and P is listed `remerged`: it now holds the meeting, and its "not yet filed" note has cleared', () => {
    expect(sD.written.map((x) => x.etDate)).toEqual([D]);
    expect(sD.remerged).toEqual([{ battleId: w.battleId, etDate: P, bytes: expect.any(Number) }]);
    expect(sD.remergeUnchanged).toEqual([]);
    expect(sD.remergeFailed).toEqual([]);
    expect(sD.failed).toEqual([]);
    const after = w.t.store.get(tapePath(w.battleId, P));
    expect(after.meetings.map((m) => [m.key, m.status, m.legs])).toEqual([[`gpm_late|${PENDING.createdAt}`, 'expired', [{ symbolOut: 'KO', symbolIn: 'COST' }]]]);
    expect(after.coverage.meetings.status).toBe('complete');
    expect(after.coverage.meetings.note).toBeNull();
  });

  it('exit criterion 2: nothing else on P moved — only `meetings` and `coverage.meetings` (and the write\'s bookkeeping)', () => {
    const after = w.t.store.get(tapePath(w.battleId, P));
    expect(stableStringify(without(after, ['meetings']))).toBe(stableStringify(without(w.before, ['meetings'])));
    expect(after.runCount).toBe(w.before.runCount + 1);
  });

  it('the candle pass is not reopened: no candle field moves, the input fingerprint is the same, and no price provider is asked (RB-2: the late leg gets no bars)', () => {
    const after = w.t.store.get(tapePath(w.battleId, P));
    expect(after.passes.candles).toEqual(w.before.passes.candles);
    expect(after.coverage.replay).toEqual(w.before.coverage.replay);
    expect(after.coverage.series).toEqual(w.before.coverage.series);
    expect(after.actions.map((a) => a.replay)).toEqual(w.before.actions.map((a) => a.replay));
    expect(after.plans.map((p) => p.price)).toEqual(w.before.plans.map((p) => p.price));
    expect(candleInputFingerprint(after)).toEqual(candleInputFingerprint(w.before));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(w.candles.calls.filter((c) => c.symbol === 'COST')).toEqual([]);
    expect([...w.t.store.keys()].filter((k) => k.startsWith(`${tapePath(w.battleId, P)}/series/`)).some((k) => k.endsWith('/COST'))).toBe(false);
    expect([...w.t.store.keys()].filter((k) => k.startsWith(`${tapePath(w.battleId, P)}/series/`)).length).toBeGreaterThan(0);
  });

  it('a second run of the pass lists P under `remergeUnchanged` (already copied) and writes nothing to it', async () => {
    const writesBefore = w.t.writeLog.length;
    const again = await runClosePass({ db: w.t.db, clock: () => D_NIGHT + 60_000 });
    expect(again.remerged).toEqual([]);
    expect(again.remergeUnchanged).toEqual([{ battleId: w.battleId, etDate: P, reason: 'already_copied' }]);
    expect(w.t.writeLog.slice(writesBefore).filter((x) => x.path === tapePath(w.battleId, P))).toEqual([]);
  });
});

describe('a battle with no meeting on P', () => {
  it('causes no read of P beyond the one D\'s own write makes (its day change), and no write to P', async () => {
    const w = await lateMeetingWorld({ battleId: 'b-quiet', filed: false });
    const reads = w.t.readLog.length;
    const writes = w.t.writeLog.length;
    const sD = await runClosePass({ db: w.t.db, clock: () => D_NIGHT });
    expect(sD.written.map((x) => x.etDate)).toEqual([D]);
    expect([sD.remerged, sD.remergeUnchanged, sD.remergeFailed]).toEqual([[], [], []]);
    const pReads = w.t.readLog.slice(reads).filter((l) => String(l).includes(`/tape/${P}`));
    // the control: D's writer alone, in its own world, reads P's tape the same number of times
    const c = await lateMeetingWorld({ battleId: 'b-quiet', filed: false });
    const cReads = c.t.readLog.length;
    await writeTapeDay('b-quiet', D, { db: c.t.db, now: D_NIGHT });
    const controlReads = c.t.readLog.slice(cReads).filter((l) => String(l).includes(`/tape/${P}`));
    expect(pReads.length).toBe(controlReads.length);
    expect(w.t.writeLog.slice(writes).filter((x) => x.path === tapePath('b-quiet', P))).toEqual([]);
  });
});

describe('exit criterion 5 — a failure injected into P\'s re-merge', () => {
  it('leaves P\'s tape exactly as it was, never marks P failed, and leaves D\'s write unaffected', async () => {
    const pPath = tapePath('b-fail', P);
    let armed = false;
    const w = await lateMeetingWorld({ battleId: 'b-fail', hooks: { beforeWrite: (op, path) => { if (armed && path === pPath) throw new Error('injected re-merge failure'); } } });
    armed = true;
    const sD = await runClosePass({ db: w.t.db, clock: () => D_NIGHT });
    expect(sD.remergeFailed).toEqual([{ battleId: 'b-fail', etDate: P, reason: 'injected re-merge failure' }]);
    expect(sD.remerged).toEqual([]);
    expect(sD.failed).toEqual([]);                                        // nothing went to safeMarkFailed
    const p = w.t.store.get(pPath);
    expect(stableStringify(p)).toBe(stableStringify(w.before));          // byte for byte, bookkeeping included
    expect(p.passes.close.lastError ?? null).toBeNull();                  // no failure record beside it either
    // D: written as it is in a world where the re-merge succeeded
    expect(sD.written.map((x) => x.etDate)).toEqual([D]);
    const ok = await lateMeetingWorld({ battleId: 'b-fail' });
    await runClosePass({ db: ok.t.db, clock: () => D_NIGHT });
    expect(stableStringify(contentOf(w.t.store.get(tapePath('b-fail', D))))).toBe(stableStringify(contentOf(ok.t.store.get(tapePath('b-fail', D)))));
  });

  it('a failure of the decision itself (P\'s tape unreadable) is counted the same way, and D stands', async () => {
    const w = await lateMeetingWorld({ battleId: 'b-unread' });
    const base = w.t.db.collection.bind(w.t.db);
    let reads = 0;
    // fail only the re-merge's own read of P's tape (D's writer reads it first, for its day change)
    w.t.db.collection = (name) => {
      const col = base(name);
      return { ...col, doc: (id) => {
        const ref = col.doc(id);
        const sub = ref.collection.bind(ref);
        return { ...ref, collection: (s) => {
          const c = sub(s);
          if (s !== 'tape') return c;
          return { ...c, doc: (d) => { const r = c.doc(d); return d === P ? { ...r, get: async () => { reads += 1; if (reads > 1) throw new Error('P unreadable'); return r.get(); } } : r; } };
        } };
      } };
    };
    const sD = await runClosePass({ db: w.t.db, clock: () => D_NIGHT });
    expect(sD.written.map((x) => x.etDate)).toEqual([D]);
    expect(sD.remergeFailed).toEqual([{ battleId: 'b-unread', etDate: P, reason: 'P unreadable' }]);
    expect(sD.failed).toEqual([]);
    expect(stableStringify(w.t.store.get(tapePath('b-unread', P)))).toBe(stableStringify(w.before));
  });
});

describe('a P with no written tape is never written by a re-merge (the backfill is that day\'s path)', () => {
  it('listed `remergeUnchanged` with reason not_written; nothing is written to P', async () => {
    const w = await lateMeetingWorld({ battleId: 'b-nop' });
    w.t.store.delete(tapePath('b-nop', P));
    const sD = await runClosePass({ db: w.t.db, clock: () => D_NIGHT });
    expect(sD.remergeUnchanged).toEqual([{ battleId: 'b-nop', etDate: P, reason: 'not_written' }]);
    expect(w.t.store.has(tapePath('b-nop', P))).toBe(false);
  });
});
