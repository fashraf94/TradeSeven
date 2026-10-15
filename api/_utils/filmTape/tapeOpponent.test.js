// api/_utils/filmTape/tapeOpponent.test.js
//
// Film Room B1 item 3 — T1, the opponent at each check (Build B spec §3;
// shared contract §3 T1, acceptance E). `checks[].scores.opponent` is copied
// from the permanent tick under `score.opponentBasis` `cpu_portfolio`; with
// basis `none` every opponent value on the tape is null — never 0, never a tie.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the real writeTapeDay import;
// only the flag module is mocked, by spreading the real one.

import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_TAPE_WRITE_ENABLED() { return true; },
  CALL_RECORDS_MODE: 'shadow',
}));

import { writeTapeDay } from './writeTapeDay.js';
import { opponentBasisOf, NO_OPPONENT_NOTE } from './tapeAssemble.js';
import { mergeTape } from './tapeMerge.js';
import { makeTapeDb } from './__fixtures__/tapeFirestore.js';
import { seedDay } from './__fixtures__/tapeFixtures.js';
import { stalledDay } from './__fixtures__/tagFixtures.js';
import { numbersWithClasses, formatNumberPath } from '../../../src/constants/filmTape.js';

const NOW = Date.parse('2026-09-25T02:15:30.000Z');
const path = (fx) => `agentBattles/${fx.battleId}/tape/${fx.etDate}`;
async function writeFor(fx, { now = NOW, t = makeTapeDb(seedDay({}, fx)) } = {}) {
  const r = await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now });
  return { t, r, tape: t.store.get(path(fx)) };
}
const tickBySeq = (fx) => Object.fromEntries(fx.ticks.map((tk) => [tk.tickSeq, tk]));

describe('the basis', () => {
  it('cpu_portfolio when the battle carries an opponent object; none when it carries none (null, as createAgentBattle writes it)', () => {
    expect(opponentBasisOf({ opponent: { portfolio: {} } })).toBe('cpu_portfolio');
    for (const o of [null, undefined, 0, 'cpu', []]) expect(opponentBasisOf({ opponent: o }), String(o)).toBe('none');
  });
});

describe('cpu_portfolio — the opponent copied from the permanent tick at every check', () => {
  it('every tick-backed check carries its tick\'s opponent score; the last check too; the basis is stored', async () => {
    const fx = await stalledDay();
    const { tape } = await writeFor(fx);
    const ticks = tickBySeq(fx);
    expect(tape.score.opponentBasis).toBe('cpu_portfolio');
    const tickRows = tape.checks.filter((c) => c.rowSource === 'tick');
    expect(tickRows.length).toBe(26);
    for (const c of tickRows) expect(c.scores.opponent, `seq ${c.tickSeq}`).toBe(ticks[c.tickSeq].scores.opponent);
    expect(tape.score.lastCheck.opponent).toBe(ticks[26].scores.opponent);
    expect(tape.numberClasses['checks[].scores.opponent']).toBe('recorded');
  });

  it('a check rebuilt from an evaluations entry carries null — the entry never had it', async () => {
    const fx = await stalledDay({ battleId: 'b-entry-only' });
    fx.ticks = fx.ticks.filter((tk) => tk.tickSeq !== 7);          // capture missed check 7; its entry survives
    // the evaluator's entry carries { active, banked, total } (agent-evaluate.js scores); even one that held an
    // opponent value is not the permanent tick's record, so the rebuilt check carries null
    fx.battle.evaluations.find((e) => e.evalId.endsWith(':e7')).scores.opponent = 14;
    const { tape } = await writeFor(fx);
    const rebuilt = tape.checks.filter((c) => c.rowSource === 'entry');
    expect(rebuilt).toHaveLength(1);
    expect(rebuilt[0].scores).toEqual({ active: 7, banked: 0, total: 7, opponent: null });
  });

  it('every opponent number on the tape is declared recorded', async () => {
    const { tape } = await writeFor(await stalledDay());
    const opp = numbersWithClasses(tape, tape.numberClasses).filter((n) => n.path.includes('opponent'));
    expect(opp.length).toBeGreaterThan(26);
    expect(opp.filter((n) => n.cls !== 'recorded').map((n) => formatNumberPath(n.path))).toEqual([]);
  });
});

describe('none — never 0, never a tie (contract acceptance E; exit criterion 2)', () => {
  it('the ticks record 0 (an empty portfolio\'s sum); the tape stores null at every check and on the last check', async () => {
    const fx = await stalledDay({ battleId: 'b-none', opponent: null });
    for (const tk of fx.ticks) tk.scores.opponent = 0;            // what a no-opponent tick records
    const { tape } = await writeFor(fx);
    expect(tape.score.opponentBasis).toBe('none');
    expect(tape.checks.every((c) => c.scores === null || c.scores.opponent === null)).toBe(true);
    expect(tape.score.lastCheck.opponent).toBeNull();
    // nothing anywhere on the tape at an "opponent" path is a number
    expect(numbersWithClasses(tape, tape.numberClasses).filter((n) => n.path.includes('opponent')).map((n) => formatNumberPath(n.path))).toEqual([]);
  });

  it('a completed battle with no opponent: the final opponent is null and the result says why — never a draw against 0', async () => {
    const fx = await stalledDay({
      battleId: 'b-none-done', opponent: null,
      over: { status: 'completed', completedAt: '2026-09-24T20:05:00.000Z', scoreState: { currentScore: 0, activeScore: 0, bankedScore: 0, opponentScore: 0, bankedBadgePoints: { total: 0 }, tradeCount: 1 } },
    });
    for (const tk of fx.ticks) tk.scores.opponent = 0;
    const { tape } = await writeFor(fx);
    expect(tape.battle.final).toEqual({ total: 0, opponent: null, at: '2026-09-24T20:05:00.000Z' });
    expect(tape.battle.result).toEqual({ value: null, basis: 'unavailable', note: NO_OPPONENT_NOTE });
  });

  it('a tape written before T1 (the tick\'s 0 on its last check, a draw derived from 0 – 0) is corrected by the refresh, never kept', async () => {
    const fx = await stalledDay({
      battleId: 'b-none-old', opponent: null,
      over: { status: 'completed', completedAt: '2026-09-24T20:05:00.000Z', scoreState: { currentScore: 0, activeScore: 0, bankedScore: 0, opponentScore: 0, bankedBadgePoints: { total: 0 }, tradeCount: 1 } },
    });
    for (const tk of fx.ticks) tk.scores.opponent = 0;
    const first = await writeFor(fx);
    const old = structuredClone(first.tape);
    // as the A1 writer left it: no basis, the 0s copied, a derived draw
    delete old.score.opponentBasis;
    old.score.lastCheck.opponent = 0;
    old.battle.final.opponent = 0;
    old.battle.result = { value: 'draw', basis: 'derived' };
    for (const c of old.checks) if (c.scores) delete c.scores.opponent;
    first.t.store.set(path(fx), old);
    const { tape } = await writeFor(fx, { t: first.t, now: NOW + 60_000 });
    expect(tape.score.opponentBasis).toBe('none');
    expect(tape.score.lastCheck.opponent).toBeNull();
    expect(tape.battle.final.opponent).toBeNull();
    expect(tape.battle.result).toEqual({ value: null, basis: 'unavailable', note: NO_OPPONENT_NOTE });
    expect(numbersWithClasses(tape, tape.numberClasses).filter((n) => n.path.includes('opponent'))).toEqual([]);
  });

  it('a KEPT last check (later than anything the new read sees — an entry-only check since evicted) loses its 0 too', async () => {
    const fx = await stalledDay({ battleId: 'b-none-kept', opponent: null });
    for (const tk of fx.ticks) tk.scores.opponent = 0;
    const first = await writeFor(fx);
    const old = structuredClone(first.tape);
    delete old.score.opponentBasis;
    // the A1 writer's last check: a later check known only by its entry, evicted from evaluations[] since
    old.score.lastCheck = { ...old.score.lastCheck, at: '2026-09-24T19:59:30.000Z', tickSeq: null, opponent: 0 };
    first.t.store.set(path(fx), old);
    const { tape } = await writeFor(fx, { t: first.t, now: NOW + 60_000 });
    expect(tape.score.lastCheck.at).toBe('2026-09-24T19:59:30.000Z');   // the stored unit is kept (BA-19)…
    expect(tape.score.lastCheck.opponent).toBeNull();                     // …without its 0
  });

  it('a KEPT battle block (a stored completion outranks a stale active assembly, BA-27) loses its 0 and its draw', () => {
    const stored = {
      etDate: '2026-09-24', passes: { close: { status: 'written', gaps: [] }, candles: { status: 'skipped', reason: 'outside_candle_window' } },
      score: { lastCheck: null, firstCheck: null, dayChange: null },
      battle: { status: 'completed', completedAt: '2026-09-24T20:05:00.000Z', final: { total: 0, opponent: 0, at: '2026-09-24T20:05:00.000Z' }, result: { value: 'draw', basis: 'derived' }, completionMessage: null },
      checks: [], actions: [], directives: [], plans: [], calls: [], rationale: [], coverage: {},
    };
    const assembled = {
      ...structuredClone(stored), score: { lastCheck: null, firstCheck: null, dayChange: null, opponentBasis: 'none' },
      battle: { status: 'active', completedAt: null, final: null, result: { value: null, basis: 'not_completed' }, completionMessage: null },
    };
    const { doc } = mergeTape(stored, assembled, { nowIso: '2026-09-25T02:16:00.000Z', withinWindow: false, canonicalBattle: false, resolveResult: () => 'draw' });
    expect(doc.battle.status).toBe('completed');
    expect(doc.battle.final).toEqual({ total: 0, opponent: null, at: '2026-09-24T20:05:00.000Z' });
    expect(doc.battle.result).toEqual({ value: null, basis: 'unavailable', note: NO_OPPONENT_NOTE });
  });
});

describe('Astra F1 — under none a stored win, loss or draw never stands (exit criterion 2): the one resolver, assembly and merge alike', () => {
  const DONE = '2026-09-24T20:05:00.000Z';
  const FEED = [{ action: 'battle_complete', message: 'Battle complete. Agent: 0.0 pts vs CPU: 0.0 pts. Result: Draw.', timestamp: DONE }];
  const completedNone = (battleId, result) => stalledDay({
    battleId, opponent: null,
    over: { status: 'completed', completedAt: DONE, result, statusFeed: FEED, scoreState: { currentScore: 0, activeScore: 0, bankedScore: 0, opponentScore: 0, bankedBadgePoints: { total: 0 }, tradeCount: 1 } },
  });
  const zeroTicks = (fx) => { for (const tk of fx.ticks) tk.scores.opponent = 0; return fx; };
  const UNAVAILABLE = { value: null, basis: 'unavailable', note: NO_OPPONENT_NOTE };

  it.each(['draw', 'win', 'loss'])('a fresh write of a completed battle storing %s: the result is unavailable with the no-opponent note; the platform\'s completion message is still its words', async (stored) => {
    const fx = zeroTicks(await completedNone(`b-f1-fresh-${stored}`, stored));
    const { tape } = await writeFor(fx);
    expect(tape.score.opponentBasis).toBe('none');
    expect(tape.battle.final).toEqual({ total: 0, opponent: null, at: DONE });
    expect(tape.battle.result).toEqual(UNAVAILABLE);
    expect(tape.battle.completionMessage).toEqual({ text: FEED[0].message, at: DONE });
  });

  it('a tape written before T1 (the A1 writer: no basis, the 0s copied, the stored draw) is corrected by the refresh', async () => {
    const fx = zeroTicks(await completedNone('b-f1-pre-t1', 'draw'));
    const first = await writeFor(fx);
    const old = structuredClone(first.tape);
    delete old.score.opponentBasis;
    old.score.lastCheck.opponent = 0;
    old.battle.final.opponent = 0;
    old.battle.result = { value: 'draw', basis: 'stored' };
    for (const c of old.checks) if (c.scores) delete c.scores.opponent;
    first.t.store.set(path(fx), old);
    const { r, tape } = await writeFor(fx, { t: first.t, now: NOW + 60_000 });
    expect(r.status).toBe('written');
    expect(tape.battle.final.opponent).toBeNull();
    expect(tape.battle.result).toEqual(UNAVAILABLE);
    expect(tape.battle.completionMessage).toEqual({ text: FEED[0].message, at: DONE });
  });

  it('a KEPT completed block storing a draw (as the B1 head wrote it: basis none, the final opponent null) — the stored block stands and its draw does not', async () => {
    const fx = zeroTicks(await completedNone('b-f1-kept', 'draw'));
    const first = await writeFor(fx);
    const old = structuredClone(first.tape);
    old.battle.result = { value: 'draw', basis: 'stored' };     // Astra's repro tape
    first.t.store.set(path(fx), old);
    const { tape } = await writeFor(fx, { t: first.t, now: NOW + 60_000 });
    expect(tape.battle.completedAt).toBe(DONE);
    expect(tape.battle.result).toEqual(UNAVAILABLE);
    expect(tape.battle.completionMessage).toEqual({ text: FEED[0].message, at: DONE });
  });

  it.each(['draw', 'win', 'loss'])('a KEPT completed block storing %s against a stale active assembly (BA-27: the stored block outranks it) — still unavailable (review LC-7)', (value) => {
    const stored = {
      etDate: '2026-09-24', passes: { close: { status: 'written', gaps: [] }, candles: { status: 'skipped', reason: 'outside_candle_window' } },
      score: { lastCheck: null, firstCheck: null, dayChange: null, opponentBasis: 'none' },
      battle: { status: 'completed', completedAt: DONE, final: { total: 0, opponent: null, at: DONE }, result: { value, basis: 'stored' }, completionMessage: { text: FEED[0].message, at: DONE } },
      checks: [], actions: [], directives: [], plans: [], calls: [], rationale: [], coverage: {},
    };
    const assembled = {
      ...structuredClone(stored),
      battle: { status: 'active', completedAt: null, final: null, result: { value: null, basis: 'not_completed' }, completionMessage: null },
    };
    const { doc } = mergeTape(stored, assembled, { nowIso: '2026-09-25T02:16:00.000Z', withinWindow: false, canonicalBattle: false, resolveResult: () => 'draw' });
    expect(doc.battle.status).toBe('completed');
    expect(doc.battle.result).toEqual(UNAVAILABLE);
    expect(doc.battle.completionMessage).toEqual({ text: FEED[0].message, at: DONE });
  });

  it('controls: with an opponent a stored draw still stands; with none and the battle not completed, the result is not completed', async () => {
    const withCpu = await stalledDay({
      battleId: 'b-f1-cpu',
      over: { status: 'completed', completedAt: DONE, result: 'draw', statusFeed: FEED, scoreState: { currentScore: 0, activeScore: 0, bankedScore: 0, opponentScore: 0, bankedBadgePoints: { total: 0 }, tradeCount: 1 } },
    });
    expect((await writeFor(withCpu)).tape.battle.result).toEqual({ value: 'draw', basis: 'stored' });
    const live = zeroTicks(await stalledDay({ battleId: 'b-f1-live', opponent: null, over: { result: 'draw' } }));
    expect((await writeFor(live)).tape.battle.result).toEqual({ value: null, basis: 'not_completed' });
  });
});
