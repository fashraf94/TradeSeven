// api/_utils/filmTape/tapeMeetings.test.js
//
// Film Room B1 item 4 — T2, gameplan meetings on the tape (Build B spec §3;
// shared contract §3 T2, spec §9.4). The close pass copies the meetings
// created on the tape day from the battle's meeting history, as typed facts,
// with their own coverage; the candle pass adds every leg's symbols to its
// series set, deduplicated against the set it already has, so a rejected or
// expired leg has bars.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the real writer and candle pass;
// only the flag module is mocked, by spreading the real one.

import { describe, it, expect, vi } from 'vitest';

vi.setConfig({ testTimeout: 60_000 });

vi.mock('../../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_TAPE_WRITE_ENABLED() { return true; },
  CALL_RECORDS_MODE: 'shadow',
}));

import { writeTapeDay } from './writeTapeDay.js';
import { runCandlePass } from './candlePass.js';
import { buildMeetings, MEETING_LEGS_MAX, MEETINGS_PER_DAY_MAX, MEETING_DIAGNOSIS_MAX } from './tapeAssemble.js';
import { symbolPlan, candleInputFingerprint } from './candleInputs.js';
import { etDayBounds } from './tapeTime.js';
import { makeTapeDb } from './__fixtures__/tapeFirestore.js';
import { seedDay } from './__fixtures__/tapeFixtures.js';
import { flatRows, fetcherOf } from './__fixtures__/tapeBars.js';
import { stalledDay } from './__fixtures__/tagFixtures.js';
import { numbersWithClasses, formatNumberPath, SERIES_ROLES } from '../../../src/constants/filmTape.js';

const D = '2026-09-24';
const NIGHT = Date.parse('2026-09-25T02:15:30.000Z');
const MORNING = Date.parse('2026-09-25T11:00:30.000Z');
const bounds = etDayBounds(D);
const path = (fx) => `agentBattles/${fx.battleId}/tape/${fx.etDate}`;

/** A history row as the evaluator files it: the meeting (agent-evaluate.js buildGameplanMeeting) with its resolution. */
const meeting = (id, createdAt, status, legs, over = {}) => ({
  id, createdAt, diagnosis: '3 consecutive losing trades. Last 3 swaps all resulted in negative points.',
  opportunity: 'Technology has momentum.', proposedAction: 'rotate_sector', fromSector: null, toSectors: ['Technology'],
  suggestedSwaps: legs.map(([o, i]) => ({ symbolOut: o, symbolIn: i, rationale: `${o} down 1.2%, ${i} (Technology) has tech score 71.` })),
  status, expiresAt: `${D}T20:00:00.000Z`, resolvedAt: `${D}T15:20:00.000Z`, resolvedBy: status === 'expired' ? 'system' : 'coach',
  ...over,
});
const HISTORY = [
  meeting('gpm_0', '2026-09-23T18:00:00.000Z', 'rejected', [['ACN', 'IBM']]),           // the day before: not this tape's
  meeting('gpm_1', `${D}T15:10:00.000Z`, 'rejected', [['ACN', 'ORCL']]),
  meeting('gpm_2', `${D}T17:00:00.000Z`, 'expired', [['MSFT', 'NVDA']], { resolvedAt: `${D}T20:00:20.000Z` }),
];

async function dayWith(over, opts = {}) {
  const fx = await stalledDay({ battleId: opts.battleId ?? 'b-meet', over });
  const t = makeTapeDb(seedDay({}, fx));
  await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: opts.night ?? NIGHT });
  return { fx, t, tape: t.store.get(path(fx)) };
}
/** Bars for any symbol asked for: a flat session at 100. */
const anyBars = () => fetcherOf(new Proxy({}, { get: (_, sym) => (typeof sym === 'string' ? flatRows(D, 100) : undefined) }));

describe('the meetings created on the tape day, as typed facts', () => {
  it('copies each with its instants, status, resolver, legs\' symbols and diagnosis — and not a meeting of another day', async () => {
    const { tape } = await dayWith({ gameplanMeetingHistory: HISTORY });
    expect(tape.meetings).toEqual([
      {
        key: `gpm_1|${D}T15:10:00.000Z`, createdAt: `${D}T15:10:00.000Z`, expiresAt: `${D}T20:00:00.000Z`, resolvedAt: `${D}T15:20:00.000Z`,
        status: 'rejected', resolvedBy: 'coach', legs: [{ symbolOut: 'ACN', symbolIn: 'ORCL' }],
        diagnosis: '3 consecutive losing trades. Last 3 swaps all resulted in negative points.',
      },
      {
        key: `gpm_2|${D}T17:00:00.000Z`, createdAt: `${D}T17:00:00.000Z`, expiresAt: `${D}T20:00:00.000Z`, resolvedAt: `${D}T20:00:20.000Z`,
        status: 'expired', resolvedBy: 'system', legs: [{ symbolOut: 'MSFT', symbolIn: 'NVDA' }],
        diagnosis: '3 consecutive losing trades. Last 3 swaps all resulted in negative points.',
      },
    ]);
    expect(tape.coverage.meetings).toMatchObject({ status: 'complete', note: null, sources: ['gameplanMeetingHistory', 'gameplanMeeting'] });
  });

  it('no number in the section, so nothing to class: the diagnosis is someone\'s words, stored as text', async () => {
    const { tape } = await dayWith({ gameplanMeetingHistory: HISTORY });
    expect(numbersWithClasses(tape, tape.numberClasses).filter((n) => n.path[0] === 'meetings').map((n) => formatNumberPath(n.path))).toEqual([]);
    expect(typeof tape.meetings[0].diagnosis).toBe('string');
  });

  it('a day with no meeting: an empty section, complete', async () => {
    const { tape } = await dayWith({});
    expect(tape.meetings).toEqual([]);
    expect(tape.coverage.meetings.status).toBe('complete');
  });

  it('a meeting not yet filed when the tape is read (pending, or answered but not yet processed) is not copied — the coverage says so, and a later run of the day copies it', async () => {
    const answered = { ...meeting('gpm_4', `${D}T19:00:00.000Z`, 'approved', [['NVDA', 'AMD']]), resolvedAt: `${D}T19:10:00.000Z`, resolvedBy: 'coach' };
    const answeredDay = (await dayWith({ gameplanMeetingHistory: HISTORY, gameplanMeeting: answered }, { battleId: 'b-answered' })).tape;
    expect(answeredDay.meetings).toHaveLength(2);
    expect(answeredDay.coverage.meetings.status).toBe('partial');
    const pending = { ...meeting('gpm_3', `${D}T19:30:00.000Z`, 'pending', [['NVDA', 'AMD']]), resolvedAt: null, resolvedBy: null };
    const { fx, t, tape } = await dayWith({ gameplanMeetingHistory: HISTORY, gameplanMeeting: pending });
    expect(tape.meetings.map((m) => m.key)).toEqual([`gpm_1|${D}T15:10:00.000Z`, `gpm_2|${D}T17:00:00.000Z`]);
    expect(tape.coverage.meetings.status).toBe('partial');
    expect(tape.coverage.meetings.note).toBe('a meeting created this day was not yet filed in the meeting history when this tape was read — only a later run of this day\'s close pass (a refresh) copies it');
    // the next morning's first check expires it into the history; the refresh re-reads the day
    const battle = structuredClone(t.store.get(`agentBattles/${fx.battleId}`));
    battle.gameplanMeetingHistory = [...HISTORY, { ...pending, status: 'expired', resolvedAt: '2026-09-25T13:30:20.000Z', resolvedBy: 'system' }];
    battle.gameplanMeeting = null;
    t.store.set(`agentBattles/${fx.battleId}`, battle);
    await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: NIGHT + 86_400_000 });
    const after = t.store.get(path(fx));
    expect(after.meetings.map((m) => [m.key, m.status])).toEqual([[`gpm_1|${D}T15:10:00.000Z`, 'rejected'], [`gpm_2|${D}T17:00:00.000Z`, 'expired'], [`gpm_3|${D}T19:30:00.000Z`, 'expired']]);
    expect(after.coverage.meetings.status).toBe('complete');
  });
});

describe('merge-monotone (BA-19): a meeting the tape holds is kept when a later read lacks it', () => {
  it('the owner empties the history; the refresh keeps both rows, and the coverage says they were preserved', async () => {
    const { fx, t, tape } = await dayWith({ gameplanMeetingHistory: HISTORY });
    const battle = structuredClone(t.store.get(`agentBattles/${fx.battleId}`));
    battle.gameplanMeetingHistory = [];
    t.store.set(`agentBattles/${fx.battleId}`, battle);
    await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: NIGHT + 60_000 });
    const after = t.store.get(path(fx));
    expect(after.meetings).toEqual(tape.meetings);
    expect(after.coverage.meetings.preservedFrom).toBe(tape.writtenAt);
  });
});

describe('the history is owner-writable: every copied value is checked, and what is not copied is counted', () => {
  it('an unknown outcome, legs past the server\'s two, a symbol that is not a ticker, words past the bound, a resolver name past its bound', () => {
    const rows = [
      meeting('a', `${D}T14:00:00.000Z`, 'hacked', [['ACN', 'ORCL']]),
      meeting('b', `${D}T14:30:00.000Z`, 'rejected', [['ACN', 'ORCL'], ['MSFT', 'IBM'], ['NVDA', 'AMD'], ['XOM', 'CVX']], { resolvedBy: 'x'.repeat(41) }),
      meeting('c', `${D}T15:00:00.000Z`, 'approved', [['acn; drop', 'ORCL']], { diagnosis: 'w'.repeat(MEETING_DIAGNOSIS_MAX + 1) }),
      meeting('d', `${D}T15:30:00.000Z`, 'expired', [['ACN', 'ORCL']], { createdAt: 'not-an-instant' }),
      'not a row', null, 7,
    ];
    const { rows: out, coverage } = buildMeetings({ battle: { gameplanMeetingHistory: rows }, bounds });
    expect(out.map((m) => m.key)).toEqual([`b|${D}T14:30:00.000Z`, `c|${D}T15:00:00.000Z`]);
    expect(out[0].legs).toEqual([{ symbolOut: 'ACN', symbolIn: 'ORCL' }, { symbolOut: 'MSFT', symbolIn: 'IBM' }]);
    expect(out[0].legs).toHaveLength(MEETING_LEGS_MAX);
    expect(out[0].resolvedBy).toBeNull();
    expect(out[1].legs).toEqual([{ symbolOut: null, symbolIn: 'ORCL' }]);
    expect(out[1].diagnosis).toBeNull();
    expect(coverage.status).toBe('partial');
    expect(coverage.note).toBe('1 meeting record of this day with an outcome other than approved, rejected or expired not copied; 2 legs past the 2 a meeting proposes not copied; 1 diagnosis longer than 500 characters not copied');
  });

  it('a history that is not a list: nothing read, the section unavailable with its reason — never a throw', () => {
    for (const raw of [{ 0: HISTORY[1] }, 'gpm', 42]) {
      expect(buildMeetings({ battle: { gameplanMeetingHistory: raw }, bounds })).toEqual({ rows: [], coverage: expect.objectContaining({ status: 'unavailable', note: 'the meeting history is not a list — no meeting could be read' }) });
    }
    expect(buildMeetings({ battle: {}, bounds }).coverage.status).toBe('complete');
  });

  it('at most MEETINGS_PER_DAY_MAX a day; a duplicated id keeps every row apart', () => {
    const many = Array.from({ length: MEETINGS_PER_DAY_MAX + 3 }, (_, i) => meeting('same', new Date(Date.parse(`${D}T13:30:00.000Z`) + i * 60_000).toISOString(), 'expired', [['ACN', 'ORCL']]));
    many.push({ ...many[0] });
    const { rows, coverage } = buildMeetings({ battle: { gameplanMeetingHistory: many }, bounds });
    expect(rows).toHaveLength(MEETINGS_PER_DAY_MAX);
    expect(new Set(rows.map((r) => r.key)).size).toBe(MEETINGS_PER_DAY_MAX);
    expect(rows[1].key).toBe(`same|${D}T13:30:00.000Z#2`);
    expect(coverage.note).toBe('4 meetings past 26 in a day not copied');
  });
});

describe('the candle pass adds every leg\'s symbols to its series set — deduplicated', () => {
  it('a leg symbol the set does not hold joins it as `meeting`; one it holds keeps its roles', async () => {
    const { tape } = await dayWith({ gameplanMeetingHistory: HISTORY });
    const plan = Object.fromEntries(symbolPlan(tape).map((e) => [e.symbol, e]));
    expect(plan.ORCL).toEqual({ symbol: 'ORCL', role: 'meeting', roles: ['meeting'] });
    expect(plan.MSFT.roles).toEqual(['held']);
    expect(plan.NVDA.roles).toEqual(['held']);
    expect(plan.ACN.roles).toEqual(['held', 'sold']);
    expect(plan.IBM).toBeUndefined();                              // the other day's meeting
    expect(SERIES_ROLES).toContain('meeting');
  });

  it('legs the set already holds move nothing: the same plan and the same candle input fingerprint as with no meeting', async () => {
    const without = (await dayWith({}, { battleId: 'b-none-meet' })).tape;
    const withHeld = (await dayWith({ gameplanMeetingHistory: [HISTORY[2]] }, { battleId: 'b-none-meet' })).tape;
    expect(symbolPlan(withHeld)).toEqual(symbolPlan(without));
    expect(candleInputFingerprint(withHeld)).toEqual(candleInputFingerprint(without));
    const withNew = (await dayWith({ gameplanMeetingHistory: [HISTORY[1]] }, { battleId: 'b-none-meet' })).tape;
    expect(candleInputFingerprint(withNew).symbols).not.toBe(candleInputFingerprint(without).symbols);
  });

  describe('a refresh of a day whose candle pass already ran, now carrying a meeting with a NEW leg symbol (the founder\'s post-merge refresh)', () => {
    async function candled(history) {
      const { fx, t } = await dayWith({}, { battleId: 'b-refresh-meet' });
      await runCandlePass({ db: t.db, fetchCandles: anyBars().fetchCandles, clock: () => MORNING, startMs: MORNING });
      expect(t.store.get(path(fx)).passes.candles.status).toBe('written');
      const battle = structuredClone(t.store.get(`agentBattles/${fx.battleId}`));
      battle.gameplanMeetingHistory = history;
      t.store.set(`agentBattles/${fx.battleId}`, battle);
      return { fx, t };
    }

    it('inside the candle window: re-queued, `symbols` named — the next candle pass fetches the leg', async () => {
      const { fx, t } = await candled([HISTORY[1]]);
      await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: NIGHT + 86_400_000 });
      expect(t.store.get(path(fx)).passes.candles).toMatchObject({ status: 'pending', reason: 'inputs_changed', changedInputs: ['symbols'], attempts: 0 });
      const f = anyBars();
      await runCandlePass({ db: t.db, fetchCandles: f.fetchCandles, clock: () => MORNING + 86_400_000, startMs: MORNING + 86_400_000 });
      expect(f.calls.map((c) => c.symbol)).toContain('ORCL');
      expect(t.store.get(`${path(fx)}/series/ORCL`)?.role).toBe('meeting');
    });

    it('outside it: a written pass becomes expired (inputs_changed_outside_window), its series coverage labelled — the merge\'s own BA-25 rule, reported', async () => {
      const { fx, t } = await candled([HISTORY[1]]);
      await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: Date.parse('2026-10-17T02:15:30.000Z') });
      const tape = t.store.get(path(fx));
      expect(tape.passes.candles).toMatchObject({ status: 'expired', reason: 'inputs_changed_outside_window', changedInputs: ['symbols'] });
      expect(tape.coverage.series.note).toMatch(/built before the candle inputs changed \(symbols\) — outside its retry window, not rebuilt/);
    });

    it('a meeting whose legs the set already holds changes nothing on the candle side', async () => {
      const { fx, t } = await candled([HISTORY[2]]);
      const before = structuredClone(t.store.get(path(fx)).passes.candles);
      await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: Date.parse('2026-10-17T02:15:30.000Z') });
      expect(t.store.get(path(fx)).passes.candles).toEqual(before);
    });
  });

  it('THE ADDED EODHD CALLS, through the real candle pass: one request per new leg symbol (ORCL), none for legs already held', async () => {
    const run = async (history, battleId) => {
      const { t } = await dayWith(history ? { gameplanMeetingHistory: history } : {}, { battleId });
      const f = anyBars();
      const summary = await runCandlePass({ db: t.db, fetchCandles: f.fetchCandles, clock: () => MORNING, startMs: MORNING });
      return { summary, symbols: f.calls.map((c) => c.symbol).sort(), series: [...t.store.keys()].filter((k) => k.includes('/series/')).map((k) => k.split('/').pop()).sort() };
    };
    const base = await run(null, 'b-calls');
    const held = await run([HISTORY[2]], 'b-calls');
    const fresh = await run(HISTORY, 'b-calls');
    expect(held.summary.requests).toBe(base.summary.requests);
    expect(fresh.summary.requests).toBe(base.summary.requests + 1);
    expect(fresh.symbols.filter((s) => !base.symbols.includes(s))).toEqual(['ORCL']);
    expect(fresh.series).toContain('ORCL');
    expect(fresh.summary.units - base.summary.units).toBe(5);       // UNITS_PER_REQUEST
  });
});
