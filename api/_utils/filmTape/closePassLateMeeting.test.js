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

import { runClosePass, runBackfill, previousTapeDay, meetingKeysOn } from './closePass.js';
import { writeTapeDay } from './writeTapeDay.js';
import { runCandlePass } from './candlePass.js';
import { candleInputFingerprint } from './candleInputs.js';
import { MEETINGS_PER_DAY_MAX } from './tapeAssemble.js';
import { contentOf, stableStringify } from './tapeMerge.js';
import { makeTapeDb } from './__fixtures__/tapeFirestore.js';
import { seedDay, multiDay } from './__fixtures__/tapeFixtures.js';
import { flatRows, fetcherOf } from './__fixtures__/tapeBars.js';

// Each row builds one to three whole multi-day worlds (close pass, candle pass, close pass): the heavy tape suites' limit.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 120_000 });

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
  // the evaluator's deadline is 16:00 server time (UTC) of the creation day (agent-evaluate.js), already past: filed `expired` at D's first check
  id: 'gpm_late', createdAt: `${P}T19:50:00.000Z`, expiresAt: `${P}T16:00:00.000Z`, status: 'pending',
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
async function lateMeetingWorld({ battleId = 'b-late', filed = true, hooks = {}, prepare = null, between = null } = {}) {
  const fx = await multiDay({ battleId });
  fx.battle.portfolio = { ...fx.battle.portfolio, ...ROSTER };
  fx.battle.gameplanMeetingHistory = [];
  fx.battle.gameplanMeeting = filed ? structuredClone(PENDING) : null;
  if (prepare) prepare(fx);
  const t = makeTapeDb(seedDay({}, fx), { hooks });
  const sP = await runClosePass({ db: t.db, clock: () => P_NIGHT });
  const candles = fetcherOf(bars());
  await runCandlePass({ db: t.db, fetchCandles: candles.fetchCandles, clock: () => P_MORNING, startMs: P_MORNING });
  const before = structuredClone(t.store.get(tapePath(battleId, P)));
  // D's first check files the meeting into the history and clears it from the battle (agent-evaluate.js resolutionWrite)
  const b = t.store.get(`agentBattles/${battleId}`);
  if (filed) Object.assign(b, { gameplanMeeting: null, gameplanMeetingHistory: [structuredClone(FILED)] });
  t.store.set(`agentBattles/${battleId}`, b);
  if (between) between(t);
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
    // P is an earlier day of the five-day battle: Amendment D RD-3's earlier-day words
    expect(w.before.isFinalDay).toBe(false);
    expect(w.before.coverage.meetings.note).toBe('a meeting created this day was not yet filed when this tape was read; the next night\'s close pass copies it once it is filed');
    expect(w.before.passes.candles.status).toBe('written');
  });

  it('D is written, and P is listed `remerged`: it now holds the meeting, and its "not yet filed" note has cleared', () => {
    expect(sD.written.map((x) => x.etDate)).toEqual([D]);
    expect(sD.remerged).toEqual([{ battleId: w.battleId, etDate: P, bytes: expect.any(Number), meetingsStored: true }]);
    expect(sD.remergeUnchanged).toEqual([]);
    expect(sD.remergeFailed).toEqual([]);
    expect(sD.failed).toEqual([]);
    const after = w.t.store.get(tapePath(w.battleId, P));
    expect(after.meetings.map((m) => [m.key, m.status, m.legs])).toEqual([[`gpm_late|${PENDING.createdAt}`, 'expired', [{ symbolOut: 'KO', symbolIn: 'COST' }]]]);
    expect(after.coverage.meetings.status).toBe('complete');
    expect(after.coverage.meetings.note).toBeNull();
  });

  it('on this world, whose other sources did not grow after P\'s night, nothing else on P moved — only `meetings` and `coverage.meetings` (and the write\'s bookkeeping); a re-merge is a refresh of P (review X3-2, the row below)', () => {
    const after = w.t.store.get(tapePath(w.battleId, P));
    expect(stableStringify(without(after, ['meetings']))).toBe(stableStringify(without(w.before, ['meetings'])));
    expect(after.runCount).toBe(w.before.runCount + 1);
  });

  it('the re-merge reopens no candle pass: no candle field moves, the input fingerprint is the same, and no price provider is asked (RB-2: P\'s pass has ended, so the late leg gets no bars)', () => {
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

describe('review X3-2 — a re-merge of P IS a refresh of P at that instant (the same writer, RC-3)', () => {
  it('a call minted on P, open at P\'s night and hit by D: the re-merged P equals, byte for byte, the founder\'s refresh of P at the same instant — the call\'s observed state moves on both', async () => {
    const callId = 'b-eq:b-eq:e100:call:0';
    const callPath = `agentBattles/b-eq/calls/${callId}`;
    const call = {
      callId, kind: 'called_shot', battleId: 'b-eq', evalId: 'b-eq:e100', evalSeq: 100,
      mintedAt: Date.parse(`${P}T18:00:25.000Z`), symbol: 'KO', direction: 'exit',
      horizon: { phrase: 'this_battle', expiresAt: Date.parse(`${D}T20:00:00.000Z`), basis: 'battle_end' },
      evidence: { tickId: 'b-eq:100', availability: 'unresolved', priceAsOf: `${P}T18:00:12.000Z` },
      hypothesisRef: null, origin: 'agent_initiative', state: 'open', stateChangedAt: null, stateSource: null,
    };
    const prepare = (fx) => { fx.calls = [structuredClone(call)]; };
    const between = (t) => { t.store.set(callPath, { ...call, state: 'hit', stateChangedAt: Date.parse(`${D}T14:00:20.000Z`), stateSource: 'check' }); };
    const re = await lateMeetingWorld({ battleId: 'b-eq', prepare, between });
    expect(re.before.calls.map((c) => c.state)).toEqual(['open']);
    const sD = await runClosePass({ db: re.t.db, clock: () => D_NIGHT });
    expect(sD.remerged.map((x) => x.etDate)).toEqual([P]);
    const viaRemerge = re.t.store.get(tapePath('b-eq', P));
    expect(viaRemerge.calls.map((c) => c.state)).toEqual(['hit']);
    const rf = await lateMeetingWorld({ battleId: 'b-eq', prepare, between });
    const sR = await runBackfill({ db: rf.t.db, clock: () => D_NIGHT, startMs: D_NIGHT, dates: [P], refresh: true });
    expect(sR.refreshed.map((x) => x.etDate)).toEqual([P]);
    expect(stableStringify(viaRemerge)).toBe(stableStringify(rf.t.store.get(tapePath('b-eq', P))));
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

describe('review X3-8 — an untaped battle is never re-merged, and P is never read for it', () => {
  it('a multi-day tournament battle with a meeting filed on P: its day is skipped_mode, no re-merge row, no read of P\'s tape', async () => {
    const fx = await multiDay({ battleId: 'b-flat' });
    Object.assign(fx.battle, { gameMode: 'baggerbomb_tournament', portfolio: { ...fx.battle.portfolio, ...ROSTER }, gameplanMeeting: null, gameplanMeetingHistory: [structuredClone(FILED)] });
    const t = makeTapeDb(seedDay({}, fx));
    const sD = await runClosePass({ db: t.db, clock: () => D_NIGHT });
    expect(sD.skippedMode).toEqual(['b-flat']);
    expect([sD.remerged, sD.remergeUnchanged, sD.remergeFailed]).toEqual([[], [], []]);
    expect(t.readLog.filter((l) => String(l).includes(`/tape/${P}`))).toEqual([]);
  });
});

describe('review X3-6 — the re-merge runs only above the pass\'s time floor', () => {
  it('when D\'s own write leaves the pass below the floor, P is listed `remergeUnchanged` (time_floor) and is neither read nor written', async () => {
    const w = await lateMeetingWorld({ battleId: 'b-floor' });
    let now = D_NIGHT;
    // D's write takes the pass to its ceiling
    const write = async (...a) => { const r = await writeTapeDay(...a); now += 300_000; return r; };
    const reads = w.t.readLog.length;
    const sD = await runClosePass({ db: w.t.db, clock: () => now, startMs: D_NIGHT, budgetMs: 300_000, write });
    expect(sD.written.map((x) => x.etDate)).toEqual([D]);
    expect(sD.remergeUnchanged).toEqual([{ battleId: 'b-floor', etDate: P, reason: 'time_floor' }]);
    expect(sD.remerged).toEqual([]);
    expect(stableStringify(w.t.store.get(tapePath('b-floor', P)))).toBe(stableStringify(w.before));
    // the only read of P is D's own writer's (its day change), before the floor check
    const pReads = w.t.readLog.slice(reads).filter((l) => String(l).includes(`/tape/${P}`));
    expect(pReads.length).toBeLessThanOrEqual(1);
  });
});

describe('review X3-4 — a re-merge whose meeting the size budget drops says so', () => {
  it('P re-merged under a budget its meetings do not fit: listed `remerged` with meetingsStored false; P holds none, its section says why', async () => {
    const w = await lateMeetingWorld({ battleId: 'b-budget' });
    const pSize = JSON.stringify(w.before).length;
    // a budget P's core fits but P with the late meeting does not (tapeSize.js fitTapeToBudget drops the meetings first)
    const write = (id, d, o) => writeTapeDay(id, d, d === P ? { ...o, sizeBudget: pSize + 50 } : o);
    const sD = await runClosePass({ db: w.t.db, clock: () => D_NIGHT, write });
    expect(sD.remerged).toEqual([{ battleId: 'b-budget', etDate: P, bytes: expect.any(Number), meetingsStored: false }]);
    const after = w.t.store.get(tapePath('b-budget', P));
    expect(after.meetings).toEqual([]);
    expect(after.coverage.meetings.status).toBe('unavailable');
  });
});

describe('Build B Amendment F RF-2 (Astra\'s B1.1 review F2) — a write the writer acknowledged is a re-merge that happened', () => {
  /** A world whose ordinary reads of P fail once the re-merge's write to P has committed (Astra's `post_commit_verification_read_failed`). */
  async function postCommitFaultWorld(battleId) {
    const pPath = tapePath(battleId, P);
    const s = { armed: false, committed: false, faults: 0 };
    const w = await lateMeetingWorld({ battleId, hooks: {
      // the fixture runs this only once a commit is going through: its read set held, every write checked before any applies
      beforeWrite: (op, path) => { if (s.armed && path === pPath) s.committed = true; },
      beforeRead: (label) => { if (s.committed && label === pPath) { s.faults += 1; throw new Error('post_commit_verification_read_failed'); } },
    } });
    s.armed = true;
    return { ...w, s, pPath };
  }

  it('Astra\'s repro: the write to P commits, then a read of P would fail — P is listed `remerged` (meetingsStored true), never `remergeFailed`, and nothing reads P after its commit', async () => {
    const w = await postCommitFaultWorld('b-ack');
    const sD = await runClosePass({ db: w.t.db, clock: () => D_NIGHT });
    expect(w.s.committed).toBe(true);
    expect(sD.remerged).toEqual([{ battleId: 'b-ack', etDate: P, bytes: expect.any(Number), meetingsStored: true }]);
    expect(sD.remergeFailed).toEqual([]);
    expect(sD.failed).toEqual([]);
    expect(w.s.faults).toBe(0);
    const p = w.t.store.get(w.pPath);
    expect(p.meetings.map((m) => m.key)).toEqual([`gpm_late|${PENDING.createdAt}`]);
    expect(p.runCount).toBe(w.before.runCount + 1);
    expect(p.passes.close.status).toBe('written');
    expect(p.passes.close.lastError ?? null).toBeNull();
    // D as it is in a fault-free world
    const ok = await lateMeetingWorld({ battleId: 'b-ack' });
    await runClosePass({ db: ok.t.db, clock: () => D_NIGHT });
    expect(stableStringify(contentOf(w.t.store.get(tapePath('b-ack', D))))).toBe(stableStringify(contentOf(ok.t.store.get(tapePath('b-ack', D)))));
  });

  it('a write whose meetings the size budget drops, under the same fault: listed `remerged` with meetingsStored false — the committed document\'s keys, not the history\'s', async () => {
    const w = await postCommitFaultWorld('b-ack-budget');
    const pSize = JSON.stringify(w.before).length;
    const write = (id, d, o) => writeTapeDay(id, d, d === P ? { ...o, sizeBudget: pSize + 50 } : o);
    const sD = await runClosePass({ db: w.t.db, clock: () => D_NIGHT, write });
    expect(w.s.committed).toBe(true);
    expect(sD.remerged).toEqual([{ battleId: 'b-ack-budget', etDate: P, bytes: expect.any(Number), meetingsStored: false }]);
    expect(sD.remergeFailed).toEqual([]);
    expect(w.s.faults).toBe(0);
    expect(w.t.store.get(w.pPath).meetings).toEqual([]);
  });

  it('the writer returns the keys of the document it committed: P\'s stored meetings, and none when the size budget dropped them', async () => {
    const w = await lateMeetingWorld({ battleId: 'b-keys' });
    const r = await writeTapeDay('b-keys', P, { db: w.t.db, now: D_NIGHT });
    expect(r.status).toBe('written');
    expect(r.meetingKeys).toEqual([`gpm_late|${PENDING.createdAt}`]);
    expect(r.meetingKeys).toEqual(w.t.store.get(tapePath('b-keys', P)).meetings.map((m) => m.key));
    const b = await lateMeetingWorld({ battleId: 'b-keys' });
    const rb = await writeTapeDay('b-keys', P, { db: b.t.db, now: D_NIGHT, sizeBudget: JSON.stringify(b.before).length + 50 });
    expect(rb.status).toBe('written');
    expect(rb.meetingKeys).toEqual([]);
    expect(b.t.store.get(tapePath('b-keys', P)).meetings).toEqual([]);
  });
});

describe('review X3-3 — a late leg on a P whose candle pass is still to run gets bars as an on-time leg does', () => {
  it('P\'s first candle run never happened: the re-merge moves no candle field; P\'s own next run fetches the leg, best effort', async () => {
    const fx = await multiDay({ battleId: 'b-open' });
    fx.battle.portfolio = { ...fx.battle.portfolio, ...ROSTER };
    fx.battle.gameplanMeetingHistory = [];
    fx.battle.gameplanMeeting = structuredClone(PENDING);
    const t = makeTapeDb(seedDay({}, fx));
    await runClosePass({ db: t.db, clock: () => P_NIGHT });
    const before = structuredClone(t.store.get(tapePath('b-open', P)));
    expect(before.passes.candles.status).toBe('pending');
    const b = t.store.get('agentBattles/b-open');
    Object.assign(b, { gameplanMeeting: null, gameplanMeetingHistory: [structuredClone(FILED)] });
    t.store.set('agentBattles/b-open', b);
    await runClosePass({ db: t.db, clock: () => D_NIGHT });
    const after = t.store.get(tapePath('b-open', P));
    expect(after.passes.candles).toEqual(before.passes.candles);
    expect(candleInputFingerprint(after)).toEqual(candleInputFingerprint(before));
    const morning = Date.parse('2026-09-26T11:00:30.000Z');
    const candles = fetcherOf({ ...bars(), COST: flatRows(P, 900) });
    await runCandlePass({ db: t.db, fetchCandles: candles.fetchCandles, clock: () => morning, startMs: morning });
    expect(candles.calls.some((c) => c.symbol === 'COST')).toBe(true);
  });
});

describe('review X5-3 — P that already holds an on-time meeting still gains the late one', () => {
  it('an early meeting copied on P\'s night plus the late one filed at D: P is re-merged and holds both, in order', async () => {
    const EARLY = { id: 'gpm_early', createdAt: `${P}T15:00:00.000Z`, expiresAt: `${P}T16:00:00.000Z`, status: 'expired', resolvedAt: `${P}T16:15:20.000Z`, resolvedBy: 'system', diagnosis: 'Earlier.', suggestedSwaps: [{ symbolOut: 'PEP', symbolIn: 'COST', rationale: 'r' }] };
    const w = await lateMeetingWorld({
      battleId: 'b-two',
      prepare: (fx) => { fx.battle.gameplanMeetingHistory = [structuredClone(EARLY)]; },
      between: (t) => { const b = t.store.get('agentBattles/b-two'); b.gameplanMeetingHistory = [structuredClone(EARLY), structuredClone(FILED)]; t.store.set('agentBattles/b-two', b); },
    });
    expect(w.before.meetings.map((m) => m.key)).toEqual([`gpm_early|${EARLY.createdAt}`]);
    const sD = await runClosePass({ db: w.t.db, clock: () => D_NIGHT });
    expect(sD.remerged).toEqual([{ battleId: 'b-two', etDate: P, bytes: expect.any(Number), meetingsStored: true }]);
    expect(w.t.store.get(tapePath('b-two', P)).meetings.map((m) => m.key)).toEqual([`gpm_early|${EARLY.createdAt}`, `gpm_late|${PENDING.createdAt}`]);
  });
});

describe('review X5-8 — the first night after deploy: a P written in B1\'s shape, re-merged by B1.1', () => {
  it('moves exactly the meetings, their coverage, the v2 tag labels with the new holdingBasis, and the two new declarations — nothing else', async () => {
    const w = await lateMeetingWorld({ battleId: 'b-b1p', prepare: (fx) => { fx.battle.agentContext = { ...fx.battle.agentContext, archetype: 'momentum_chaser' }; } });
    // P as B1's writer stored it: the v1 labels, no holdingBasis, the declaration without B1.1's two entries
    const b1 = structuredClone(w.before);
    b1.tags.registryVersion = 1;
    b1.tags.situations = { ...b1.tags.situations, stalled: 1 };
    if (Array.isArray(b1.tags.items)) b1.tags.items = b1.tags.items.map((i) => ({ ...i, version: 1 }));
    if (b1.tags.inputs) delete b1.tags.inputs.holdingBasis;
    for (const k of Object.keys(b1.numberClasses)) if (k.startsWith('checks[].stagnation.')) delete b1.numberClasses[k];
    w.t.store.set(tapePath('b-b1p', P), b1);
    await runClosePass({ db: w.t.db, clock: () => D_NIGHT });
    const after = w.t.store.get(tapePath('b-b1p', P));
    expect(after.tags.registryVersion).toBe(2);
    expect(Object.values(after.tags.inputs.holdingBasis).every((b) => b === 'recomputed')).toBe(true);
    expect(after.numberClasses['checks[].stagnation.*.ticks']).toBe('recorded');
    // every other byte as B1 stored it: undo exactly the declared movements and compare
    const undone = structuredClone(after);
    undone.meetings = b1.meetings; undone.coverage = { ...undone.coverage, meetings: b1.coverage.meetings };
    undone.tags = b1.tags; undone.numberClasses = b1.numberClasses;
    for (const k of ['writtenAt', 'runCount']) undone[k] = b1[k];
    undone.passes = { ...undone.passes, close: { ...undone.passes.close, writtenAt: b1.passes.close.writtenAt } };
    expect(stableStringify(undone)).toBe(stableStringify(b1));
    expect(b1.tags.items?.length ?? 0).toBeGreaterThanOrEqual(0);
  });
});

describe('Amendment D RD-6 — a copied meeting is permanent through the late-meeting re-merge (review X3-7\'s two plants)', () => {
  // An on-time meeting copied on P's night; the late one, filed at D's first check, makes D's pass re-merge P.
  const ON_TIME = { id: 'gpm_ontime', createdAt: `${P}T15:00:00.000Z`, expiresAt: `${P}T16:00:00.000Z`, status: 'rejected', resolvedAt: `${P}T15:30:20.000Z`, resolvedBy: 'coach', diagnosis: 'On time.', suggestedSwaps: [{ symbolOut: 'PEP', symbolIn: 'COST', rationale: 'r' }] };
  const worldWith = (battleId, historyAtD) => lateMeetingWorld({
    battleId,
    prepare: (fx) => { fx.battle.gameplanMeetingHistory = [structuredClone(ON_TIME)]; },
    between: (t) => { const b = t.store.get(`agentBattles/${battleId}`); b.gameplanMeetingHistory = historyAtD(); t.store.set(`agentBattles/${battleId}`, b); },
  });

  it('the owner rewrites the copied row: P is re-merged for the late meeting, and the stored row stands exactly as stored', async () => {
    const w = await worldWith('b-rd6-rewrite', () => [{ ...structuredClone(ON_TIME), status: 'approved', resolvedBy: 'owner', diagnosis: 'Rewritten.', suggestedSwaps: [{ symbolOut: 'KO', symbolIn: 'COST', rationale: 'x' }] }, structuredClone(FILED)]);
    const stored = w.before.meetings.find((m) => m.key === `gpm_ontime|${ON_TIME.createdAt}`);
    expect(stored).toMatchObject({ status: 'rejected', diagnosis: 'On time.' });
    const sD = await runClosePass({ db: w.t.db, clock: () => D_NIGHT });
    expect(sD.remerged).toEqual([{ battleId: 'b-rd6-rewrite', etDate: P, bytes: expect.any(Number), meetingsStored: true }]);
    const after = w.t.store.get(tapePath('b-rd6-rewrite', P));
    expect(after.meetings.find((m) => m.key === stored.key)).toEqual(stored);
    expect(after.meetings.map((m) => m.key)).toEqual([stored.key, `gpm_late|${PENDING.createdAt}`]);
  });

  it('26 earlier-dated plants: P is re-merged, and the cap keeps the stored row first, exactly as stored', async () => {
    const plants = () => Array.from({ length: 26 }, (_, i) => ({ ...structuredClone(ON_TIME), id: `plant_${String(i).padStart(2, '0')}`, createdAt: `${P}T14:00:${String(i).padStart(2, '0')}.000Z`, diagnosis: 'Planted.' }));
    const w = await worldWith('b-rd6-plants', () => [...plants(), structuredClone(ON_TIME), structuredClone(FILED)]);
    const stored = w.before.meetings.find((m) => m.key === `gpm_ontime|${ON_TIME.createdAt}`);
    const sD = await runClosePass({ db: w.t.db, clock: () => D_NIGHT });
    // the plants are the candidates P lacked; the cap does not keep them all
    expect(sD.remerged).toEqual([{ battleId: 'b-rd6-plants', etDate: P, bytes: expect.any(Number), meetingsStored: false }]);
    const after = w.t.store.get(tapePath('b-rd6-plants', P));
    expect(after.meetings).toHaveLength(MEETINGS_PER_DAY_MAX);
    expect(after.meetings.find((m) => m.key === stored.key)).toEqual(stored);
  });
});
