// api/_utils/filmTape/tapeResultNote.test.js
//
// Film Room B2.1 A3 — THE RESULT NOTE (the tester's FR-03; Build B Amendment
// J RJ-3): when a final score is missing and the tape day ran no check, the
// writer's note reads "no check ran this day, so no score was recorded";
// otherwise it names exactly the missing scores, as before. A declared writer
// wording change (criterion 9). The platform's own completion message stays
// quoted as its words. The fact is the day's own checks (noCheckRan: the rows
// the screen counts as checks), read by the assembly, by every merge (the
// merged rows) and by the close pass's completionRecorded — so a final day
// that ran no check is not re-written on every pass.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the REAL writer; only the writer
// flag is mocked on (spreading the real module).

import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_TAPE_WRITE_ENABLED() { return true; },
}));

import { writeTapeDay } from './writeTapeDay.js';
import { buildBattleBlock, battleResultOf, noCheckRan, NO_CHECK_RAN_NOTE } from './tapeAssemble.js';
import { completionRecorded } from './closePass.js';
import { resolveBattleResult } from './battleResult.js';
import { makeTapeDb } from './__fixtures__/tapeFirestore.js';
import { seedDay } from './__fixtures__/tapeFixtures.js';
import { emptyDay, sep23Day, SEP23_NIGHT, EMPTY_NIGHT } from './__fixtures__/screenFixtures.js';

const tapeOf = (t, fx) => t.store.get(`agentBattles/${fx.battleId}/tape/${fx.etDate}`);
const write = async (fx, now) => {
  const t = makeTapeDb(seedDay({}, fx));
  const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now });
  errSpy.mockRestore();
  return t;
};

describe('the note\'s words, as ruled', () => {
  it('RJ-3 verbatim', () => {
    expect(NO_CHECK_RAN_NOTE).toBe('no check ran this day, so no score was recorded');
  });
  it('a missing score on a day that ran no check: RJ-3\'s note; on a day that ran checks: the missing scores named, as before', () => {
    const base = { status: 'completed', final: { total: 0, opponent: null } };
    expect(battleResultOf({ ...base, noCheck: true })).toEqual({ value: null, basis: 'unavailable', note: NO_CHECK_RAN_NOTE });
    expect(battleResultOf({ ...base, noCheck: false })).toEqual({ value: null, basis: 'unavailable', note: 'opponent score never recorded' });
    expect(battleResultOf({ status: 'completed', final: {}, noCheck: false }).note).toBe('agent score and opponent score never recorded');
    expect(battleResultOf({ status: 'completed', final: {}, noCheck: true }).note).toBe(NO_CHECK_RAN_NOTE);
  });
  it('the note moves nothing else: two recorded scores still give the comparison; a stored result still wins; no opponent still says so', () => {
    expect(battleResultOf({ status: 'completed', final: { total: 3, opponent: 1 }, noCheck: true, derive: () => 'win' })).toEqual({ value: 'win', basis: 'derived' });
    expect(battleResultOf({ status: 'completed', stored: 'loss', final: {}, noCheck: true })).toEqual({ value: 'loss', basis: 'stored' });
    expect(battleResultOf({ status: 'completed', noOpponent: true, final: {}, noCheck: true }).note).toBe('no opponent: the battle was created without a CPU opponent');
    expect(battleResultOf({ status: 'active', final: null, noCheck: true })).toEqual({ value: null, basis: 'not_completed' });
  });
});

describe('noCheckRan — did any check run (a deferral is not one; a minted check with no record is)', () => {
  it('no rows, or only deferrals: no check ran', () => {
    expect(noCheckRan([])).toBe(true);
    expect(noCheckRan(undefined)).toBe(true);
    expect(noCheckRan([{ state: 'deferred' }, { state: 'deferred' }])).toBe(true);
  });
  it('review SPR-W-3 — a minted check with no record RAN (admitted, its outcome unknown): not "no check ran"', () => {
    expect(noCheckRan([{ state: 'no_record' }])).toBe(false);
    expect(noCheckRan([{ state: 'deferred' }, { state: 'no_record' }])).toBe(false);
  });
  it('any recorded check — a no-trigger check included — ran', () => {
    expect(noCheckRan([{ state: 'no_trigger' }])).toBe(false);
    expect(noCheckRan([{ state: 'deferred' }, { state: 'completed' }])).toBe(false);
  });
});

describe('through the writer', () => {
  it('the empty fixture day (no check, the opponent score absent): RJ-3\'s note; the platform\'s "Result: Draw." kept as its words', async () => {
    const fx = await emptyDay({ battleId: 'b-a3-empty' });
    const tape = tapeOf(await write(fx, EMPTY_NIGHT), fx);
    expect(tape.checks).toEqual([]);
    expect(tape.battle.result).toEqual({ value: null, basis: 'unavailable', note: NO_CHECK_RAN_NOTE });
    expect(tape.battle.completionMessage.text).toBe('Result: Draw.');
  });

  it('a day that ran its checks, a final score absent: the missing score named, exactly as before', async () => {
    const fx = await sep23Day({ battleId: 'b-a3-checks' });
    delete fx.battle.scoreState.opponentScore;
    const tape = tapeOf(await write(fx, SEP23_NIGHT), fx);
    expect(tape.checks.length).toBeGreaterThan(0);
    expect(tape.battle.result).toEqual({ value: null, basis: 'unavailable', note: 'opponent score never recorded' });
  });

  it('a tape stored with the pre-B2.1 note: the next merge (a refresh) writes RJ-3\'s — the declared movement — and nothing else of the block', async () => {
    const fx = await emptyDay({ battleId: 'b-a3-refresh' });
    const t = await write(fx, EMPTY_NIGHT);
    const now = tapeOf(t, fx);
    const old = structuredClone(now);
    old.battle.result = { ...old.battle.result, note: 'opponent score never recorded' };
    t.store.set(`agentBattles/${fx.battleId}/tape/${fx.etDate}`, old);
    const r = await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: EMPTY_NIGHT + 60_000 });
    expect(r.status).toBe('written');
    const after = tapeOf(t, fx);
    expect(after.battle).toEqual(now.battle);
  });

  it('review SPR-W-4 — the merge reads the MERGED day\'s checks: a re-write whose read holds no check at all keeps the stored rows, and the note still names the missing score (the mutant: the merge reading the new read\'s checks)', async () => {
    const fx = await sep23Day({ battleId: 'b-a3-lostread' });
    delete fx.battle.scoreState.opponentScore;
    const t = await write(fx, SEP23_NIGHT);
    expect(tapeOf(t, fx).battle.result.note).toBe('opponent score never recorded');
    // the read sees nothing of the day's checks: no tick, no evaluation entry, no minted number
    for (const k of [...t.store.keys()]) if (k.startsWith(`agentBattles/${fx.battleId}/ticks/`)) t.store.delete(k);
    const battleKey = `agentBattles/${fx.battleId}`;
    t.store.set(battleKey, { ...t.store.get(battleKey), evaluations: [], cronState: { tickSeq: 0 } });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: SEP23_NIGHT + 60_000 });
    errSpy.mockRestore();
    const after = tapeOf(t, fx);
    expect(after.checks.length).toBeGreaterThan(0);   // the stored rows stand (monotone)
    expect(noCheckRan(after.checks)).toBe(false);
    expect(after.battle.result.note).toBe('opponent score never recorded');
  });

  it('review SPR-T-4 — and the other way: a day stored with no check (RJ-3\'s note), whose re-write reads the day\'s recorded checks, names the missing score (the mutant: the merge reading the STORED checks)', async () => {
    const fx = await sep23Day({ battleId: 'b-a3-foundread' });
    delete fx.battle.scoreState.opponentScore;
    const t = makeTapeDb(seedDay({}, fx));
    const battleKey = `agentBattles/${fx.battleId}`;
    const ticks = [...t.store.entries()].filter(([k]) => k.startsWith(`${battleKey}/ticks/`));
    const battle = t.store.get(battleKey);
    for (const [k] of ticks) t.store.delete(k);
    t.store.set(battleKey, { ...battle, evaluations: [], cronState: { tickSeq: 0 } });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: SEP23_NIGHT });
    expect(tapeOf(t, fx).checks).toEqual([]);
    expect(tapeOf(t, fx).battle.result.note).toBe(NO_CHECK_RAN_NOTE);
    // the day's checks are read after all
    for (const [k, v] of ticks) t.store.set(k, v);
    t.store.set(battleKey, battle);
    await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: SEP23_NIGHT + 60_000 });
    errSpy.mockRestore();
    const after = tapeOf(t, fx);
    expect(noCheckRan(after.checks)).toBe(false);
    expect(after.battle.result.note).toBe('opponent score never recorded');
  });

  it('review SPR-W-3 — a day whose only rows are minted checks with no record (three admitted, none recorded): the missing score is named — "no check ran" would contradict "Checks · 0 of 3"', async () => {
    const fx = await emptyDay({ battleId: 'b-a3-minted' });
    fx.battle.cronState = { tickSeq: 3 };
    const tape = tapeOf(await write(fx, EMPTY_NIGHT), fx);
    expect(tape.checks.map((r) => r.state)).toEqual(['no_record', 'no_record', 'no_record']);
    expect(tape.battle.result).toEqual({ value: null, basis: 'unavailable', note: 'opponent score never recorded' });
  });
});

describe('completionRecorded reads the same fact — a final day that ran no check is not re-written on every pass', () => {
  it('the stored no-check final day records the block the battle has now', async () => {
    const fx = await emptyDay({ battleId: 'b-a3-recorded' });
    const t = await write(fx, EMPTY_NIGHT);
    const battle = t.store.get(`agentBattles/${fx.battleId}`);
    expect(completionRecorded(tapeOf(t, fx), { ...battle, id: fx.battleId })).toBe(true);
  });
  it('review SPR-W-4 — and a final day that RAN its checks, a score missing, records its block too (the mutant: completionRecorded always reading "no check")', async () => {
    const fx = await sep23Day({ battleId: 'b-a3-ran' });
    delete fx.battle.scoreState.opponentScore;
    const t = await write(fx, SEP23_NIGHT);
    const battle = t.store.get(`agentBattles/${fx.battleId}`);
    expect(battle.status).toBe('completed');
    expect(tapeOf(t, fx).battle.result.note).toBe('opponent score never recorded');
    expect(completionRecorded(tapeOf(t, fx), { ...battle, id: fx.battleId })).toBe(true);
  });
  it('the block built without the day\'s fact would not match (the mutant: completionRecorded blind to the checks)', async () => {
    const fx = await emptyDay({ battleId: 'b-a3-blind' });
    const t = await write(fx, EMPTY_NIGHT);
    const battle = t.store.get(`agentBattles/${fx.battleId}`);
    const blind = buildBattleBlock({ battle, resolveResult: resolveBattleResult });
    expect(blind.result.note).toBe('opponent score never recorded');
    expect(tapeOf(t, fx).battle.result.note).toBe(NO_CHECK_RAN_NOTE);
  });
});
