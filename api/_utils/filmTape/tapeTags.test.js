// api/_utils/filmTape/tapeTags.test.js
//
// Film Room B1 item 2 — the `stalled` tags in the close pass (Build B spec §2;
// shared contract §2, §9 A/B).
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): this file's REAL import of
// tapeTags.js — and through writeTapeDay.js — is the runtime guard for the
// tagger's transitive surface: src/data/situationRegistry.js (api/ imports it
// under the §4 rule), the registry adapter, the tempo clamp and the fenced risk
// manager it CALLS (never copies). Never mock that import. (The flag module is
// mocked by spreading the real one, so its graph still loads.)

import { describe, it, expect, vi, beforeEach } from 'vitest';

const flags = vi.hoisted(() => ({ writer: true }));
vi.mock('../../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_TAPE_WRITE_ENABLED() { return flags.writer; },
  CALL_RECORDS_MODE: 'shadow',
}));

import { tagInputs, tagDay, tagTapeDay, tagChecks, listExits, WINNER_BASIS, DIAL_BASES } from './tapeTags.js';
import { writeTapeDay } from './writeTapeDay.js';
import { runBackfill } from './closePass.js';
import { makeTapeDb } from './__fixtures__/tapeFirestore.js';
import { seedDay, capturedDay } from './__fixtures__/tapeFixtures.js';
import { stalledDay, epochEntry } from './__fixtures__/tagFixtures.js';
import { getArchetypeDefinition } from '../archetypeRegistry.js';
import { getArchetypeConfig, resolveHftConfig, VALID_ARCHETYPES } from '../agentArchetypeConfig.js';
import { SITUATIONS } from '../../../src/data/situationRegistry.js';
import { numbersWithClasses, formatNumberPath } from '../../../src/constants/filmTape.js';
import { stableStringify } from './tapeMerge.js';

const NOW = Date.parse('2026-09-25T02:15:30.000Z');
const tapePath = (battleId, etDate) => `agentBattles/${battleId}/tape/${etDate}`;
beforeEach(() => { flags.writer = true; });

async function writeFor(fx, { now = NOW } = {}) {
  const t = makeTapeDb(seedDay({}, fx));
  const r = await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now });
  return { ...t, r, tape: t.store.get(tapePath(fx.battleId, fx.etDate)) };
}

// ── synthetic check rows in the tape's own shape, for the arithmetic rows ────
const T0 = Date.parse('2026-09-24T13:30:20.000Z');
const atOf = (min) => new Date(T0 + min * 60_000).toISOString();
/** A check row at `min` minutes after 13:30:20Z: risk verdicts for `held`, evidence for the symbols in `px`. */
function row(seq, min, { px = {}, chg = {}, held = Object.keys(px), risk = {}, state = 'completed' } = {}) {
  const syms = Object.keys(px);
  return {
    key: `seq:${seq}`, rowSource: 'tick', tickSeq: seq, at: atOf(min), state,
    risk: held.length ? Object.fromEntries(held.map((s) => [s, risk[s] ?? { action: 'HOLD', reason: null }])) : null,
    evidence: syms.length ? Object.fromEntries(syms.map((s) => [s, { px: px[s], chg: chg[s] ?? -0.4 }])) : null,
    evidenceAt: syms.length ? atOf(min) : null,
  };
}
const flat = (i) => 300 + (i % 2) * 0.01;          // moves 0.003% a check — under every move threshold
const battleOf = (archetype, extra = {}) => ({ agentContext: { archetype, ...extra } });
function run(checks, { archetype = 'momentum_chaser', actions = [], ticks = [], dialEnabled = true, battle = battleOf(archetype) } = {}) {
  const r = tagInputs({ battle, checks, ticks, dialEnabled });
  expect(r.ok).toBe(true);
  return { inputs: r.inputs, ...tagDay({ inputs: r.inputs, checks, actions }) };
}
const seqsOf = (items, sym = 'ACN') => items.filter((i) => i.symbol === sym).map((i) => i.tickSeq);

describe('the thresholds come from the registry adapter — the source the live rule reads', () => {
  it('for every archetype, inputs.forcedRotation is getArchetypeDefinition(id).physics.hftConfig.forcedRotation, and that is the live rule\'s mode-resolved config', () => {
    for (const id of VALID_ARCHETYPES) {
      const fr = getArchetypeDefinition(id).physics.hftConfig.forcedRotation;
      const r = tagInputs({ battle: battleOf(id), checks: [] });
      expect(r.ok, id).toBe(true);
      expect(r.inputs.forcedRotation, id).toEqual({ enabled: fr.enabled, pctThreshold: fr.pctThreshold, ticksThreshold: fr.ticksThreshold, winnerThreshold: fr.winnerThreshold, maxTickAgeMinutes: fr.maxTickAgeMinutes });
      // agent-evaluate.js: clampHftConfig({ hftConfig: resolveHftConfig(getArchetypeConfig(ctx.archetype), battle.gameMode), … })
      for (const mode of ['baggerbomb_agent', 'baggerbomb_tournament']) expect(resolveHftConfig(getArchetypeConfig(id), mode), `${id} ${mode}`).toEqual(getArchetypeDefinition(id).physics.hftConfig);
    }
  });

  it('an archetype the registry does not know cannot be tagged — never a guessed config (the live rule would fall back to the analyst\'s)', () => {
    expect(tagInputs({ battle: battleOf('speculator'), checks: [] })).toEqual({ ok: false, reason: 'unknown archetype (speculator)', archetypeCodeId: 'speculator' });
    expect(tagInputs({ battle: {}, checks: [] })).toEqual({ ok: false, reason: 'no archetype recorded on the battle', archetypeCodeId: null });
  });

  it('the slots are the registry\'s S1 and S2, and the winner test names its basis', () => {
    const { inputs } = run([]);
    expect(inputs.slots).toEqual({ S1: { checksBeforeRule: SITUATIONS.stalled.slots.S1.checksBeforeRule }, S2: { checks: 6, pctThreshold: 0.003 } });
    expect(inputs.winnerBasis).toBe(WINNER_BASIS);
    expect(WINNER_BASIS).toBe('change_since_entry');
  });
});

describe('the count is the platform\'s (updateStagnationCounter), over the price the agent was shown', () => {
  // momentum_chaser: pctThreshold 0.0015, ticksThreshold 5, winnerThreshold 0.0015, 20-minute age guard.
  // Stalled at count ≥ 5 − S1 = 3. The first check initialises; each later flat check adds one.
  const day = (n, over = {}) => Array.from({ length: n }, (_, i) => row(i + 1, i * 15, { px: { ACN: flat(i) }, ...(over[i + 1] || {}) }));

  it('ACN is stalled at the 4th and 5th checks (counts 3 and 4) — not before — and the rule\'s fire at the 6th ends it', () => {
    const checks = day(7, { 6: { px: { ACN: flat(5) }, risk: { ACN: { action: 'SWAP_OUT', reason: 'stagnation' } } } });
    const { items } = run(checks);
    expect(items.map((i) => [i.tickSeq, i.count, i.effectiveTicksThreshold])).toEqual([[4, 3, 5], [5, 4, 5]]);
    expect(items[0]).toEqual({ situationId: 'stalled', version: 1, symbol: 'ACN', tickSeq: 4, at: atOf(45), count: 3, effectiveTicksThreshold: 5 });
  });

  it('a move at or above the threshold resets the count', () => {
    const px = [300, 300.01, 301, 301.01, 301, 301.01, 301];
    const checks = px.map((p, i) => row(i + 1, i * 15, { px: { ACN: p } }));
    // 1 init, 2 → 1, 3 moves 0.33% → 0, 4 → 1, 5 → 2, 6 → 3 (stalled), 7 → 4
    expect(seqsOf(run(checks).items)).toEqual([6, 7]);
  });

  it('THE AGE GUARD — a gap over 20 minutes pauses the count (and refreshes the price), as the live rule does', () => {
    const checks = [0, 15, 30, 55, 70, 85].map((min, i) => row(i + 1, min, { px: { ACN: flat(i) } }));
    // 1 init, 2 → 1, 3 → 2, 4 (25 min after 3) paused at 2, 5 → 3 (stalled), 6 → 4
    const { items } = run(checks);
    expect(items.map((i) => [i.tickSeq, i.count])).toEqual([[5, 3], [6, 4]]);
  });

  it('A CHECK WITH NO PRICE pauses the count — and the next priced check is then outside the age guard', () => {
    const checks = day(7, { 3: { px: {}, held: ['ACN'] } });
    // 1 init, 2 → 1, 3 no price (paused), 4 is 30 min after 2: paused, refreshed, 5 → 2, 6 → 3 (stalled), 7 → 4
    expect(run(checks).items.map((i) => [i.tickSeq, i.count])).toEqual([[6, 3], [7, 4]]);
  });

  it('a winner is never stalled: NVDA does not move but is up from entry', () => {
    const checks = Array.from({ length: 6 }, (_, i) => row(i + 1, i * 15, { px: { NVDA: 120 }, chg: { NVDA: 0.8 } }));
    expect(run(checks).items).toEqual([]);
    // the same prices, down from entry
    const down = Array.from({ length: 6 }, (_, i) => row(i + 1, i * 15, { px: { NVDA: 120 }, chg: { NVDA: -0.1 } }));
    expect(seqsOf(run(down).items, 'NVDA')).toEqual([4, 5, 6]);
  });

  it('a holding the check does not record has left the book: its count is dropped (the live counter prunes it)', () => {
    const checks = day(7, { 3: { px: { MSFT: 420 } } });
    // ACN absent at 3: dropped; 4 re-initialises, 5 → 1, 6 → 2, 7 → 3 (stalled)
    expect(seqsOf(run(checks).items)).toEqual([7]);
  });

  it('a check that records no holdings at all (degraded quotes) pauses everything and drops nothing', () => {
    const checks = day(6, { 3: { px: {}, held: [], state: 'degraded_quotes' } });
    // 3 records nothing: paused; 4 is 30 min after 2: paused; 5 → 2; 6 → 3
    expect(seqsOf(run(checks).items)).toEqual([6]);
  });
});

describe('the dial at each check, with its basis (spec §2; §9.1 — the tick records no tempo)', () => {
  const checks = Array.from({ length: 6 }, (_, i) => row(i + 1, i * 15, { px: { ACN: flat(i) } }));
  const aggressive = { dials: { tempo: 'aggressive' } };

  it('no tempo on the battle: archetype_default, multiplier 1, threshold 5', () => {
    const { inputs, items } = run(checks);
    expect(inputs.perCheck.every((p) => p.basis === 'archetype_default' && p.tempoMultiplier === 1 && p.effectiveTicksThreshold === 5)).toBe(true);
    expect(seqsOf(items)).toEqual([4, 5, 6]);
    expect(inputs.tempoDesired).toBeNull();
  });

  it('tick_controls: the tick\'s control epoch says the dial was ON — aggressive scales 5 ticks to round(5 ÷ 1.3) = 4, so stalled from count 2', () => {
    const battle = battleOf('momentum_chaser', { ...aggressive });
    battle.controlEpochLog = [epochEntry(true)];
    const ticks = checks.map((c) => ({ tickSeq: c.tickSeq, controls: { controlEpoch: 1 } }));
    const { inputs, items } = run(checks, { battle, ticks, dialEnabled: false });
    expect(inputs.perCheck.map((p) => [p.basis, p.tempoMultiplier, p.effectiveTicksThreshold])).toEqual(Array(6).fill(['tick_controls', 1.3, 4]));
    expect(seqsOf(items)).toEqual([3, 4, 5, 6]);
    expect(items.every((i) => i.effectiveTicksThreshold === 4)).toBe(true);
  });

  it('tick_controls: the epoch says the dial was OFF — the desired tempo is suppressed to standard, whatever the flag reads now', () => {
    const battle = battleOf('momentum_chaser', { ...aggressive });
    battle.controlEpochLog = [epochEntry(false)];
    const ticks = checks.map((c) => ({ tickSeq: c.tickSeq, controls: { controlEpoch: 1 } }));
    const { inputs } = run(checks, { battle, ticks, dialEnabled: true });
    expect(inputs.perCheck.map((p) => [p.basis, p.tempoMultiplier, p.effectiveTicksThreshold])).toEqual(Array(6).fill(['tick_controls', 1, 5]));
  });

  it('battle_frozen: no epoch on the tick — the frozen tempo under the dial flag the tagger runs with (recorded in inputs)', () => {
    const battle = battleOf('momentum_chaser', { ...aggressive });
    const on = run(checks, { battle, dialEnabled: true });
    expect(on.inputs.perCheck.map((p) => [p.basis, p.tempoMultiplier])).toEqual(Array(6).fill(['battle_frozen', 1.3]));
    expect(on.inputs.dialEnabledAtTagTime).toBe(true);
    const off = run(checks, { battle, dialEnabled: false });
    expect(off.inputs.perCheck.map((p) => [p.basis, p.tempoMultiplier])).toEqual(Array(6).fill(['battle_frozen', 1]));
    expect(off.inputs.dialEnabledAtTagTime).toBe(false);
  });

  it('measured scales the other way: round(5 ÷ 0.7) = 7, so stalled from count 5', () => {
    const battle = battleOf('momentum_chaser', { dials: { tempo: 'measured' } });
    const long = Array.from({ length: 8 }, (_, i) => row(i + 1, i * 15, { px: { ACN: flat(i) } }));
    const { items } = run(long, { battle, dialEnabled: true });
    expect(items.map((i) => [i.tickSeq, i.count, i.effectiveTicksThreshold])).toEqual([[6, 5, 7], [7, 6, 7], [8, 7, 7]]);
  });

  it('the bases are the spec\'s three', () => {
    expect(DIAL_BASES).toEqual(['tick_controls', 'battle_frozen', 'archetype_default']);
  });
});

describe('S2 — an archetype with forced rotation switched off (guardian)', () => {
  it('the count runs at S2\'s 0.30% and the holding is stalled at S2\'s 6 checks, whatever the dial', () => {
    const fr = getArchetypeDefinition('guardian').physics.hftConfig.forcedRotation;
    expect(fr.enabled).toBe(false);
    // a 0.2% move a check: under S2's 0.30% (it counts), over momentum_chaser's 0.15% (it would not)
    const px = (i) => Math.round(300 * (1 + 0.002 * i) * 100) / 100;
    const checks = Array.from({ length: 9 }, (_, i) => row(i + 1, i * 15, { px: { ACN: px(i) }, chg: { ACN: -0.5 } }));
    const battle = battleOf('guardian', { dials: { tempo: 'aggressive' } });
    const { inputs, items } = run(checks, { battle, archetype: 'guardian' });
    expect(inputs.perCheck.every((p) => p.effectiveTicksThreshold === 6)).toBe(true);
    expect(items.map((i) => [i.tickSeq, i.count])).toEqual([[7, 6], [8, 7], [9, 8]]);
  });

  it('S2\'s move threshold, not the switched-off rule\'s own (guardian\'s happens to equal it; stored inputs where it does not)', () => {
    const px = (i) => Math.round(300 * (1 + 0.002 * i) * 100) / 100;
    const checks = Array.from({ length: 8 }, (_, i) => row(i + 1, i * 15, { px: { ACN: px(i) }, chg: { ACN: -0.5 } }));
    const inputs = {
      archetypeCodeId: 'x', forcedRotation: { enabled: false, pctThreshold: 0.0005, ticksThreshold: 3, winnerThreshold: 0, maxTickAgeMinutes: 20 },
      slots: { S1: { checksBeforeRule: 2 }, S2: { checks: 6, pctThreshold: 0.003 } }, tempoDesired: null, dialEnabledAtTagTime: true, winnerBasis: WINNER_BASIS,
      perCheck: checks.map((c) => ({ tickSeq: c.tickSeq, at: c.at, tempoMultiplier: 1, effectiveTicksThreshold: 6, basis: 'archetype_default' })),
    };
    // a 0.2% move counts under S2's 0.30% (and would reset under the rule's own 0.05%)
    expect(tagDay({ inputs, checks, actions: [] }).items.map((i) => [i.tickSeq, i.count])).toEqual([[7, 6], [8, 7]]);
  });
});

describe('every recorded stagnation exit, and whether a tag preceded it (contract §9 B)', () => {
  const checks = Array.from({ length: 7 }, (_, i) => row(i + 1, i * 15, { px: { ACN: flat(i), KO: 50 + i } }));
  const exit = (sym, min, extra = {}) => ({ key: `swap:${sym}`, at: atOf(min - 0.2), symbolOut: sym, symbolIn: 'XOM', exitReason: 'stagnation', tickSeq: null, ...extra });

  it('a stagnation exit after a tag of its holding is preceded; one with no tag is not; other exits are not listed', () => {
    const actions = [exit('ACN', 90, { tickSeq: 7 }), exit('KO', 90), { ...exit('MSFT', 60), exitReason: 'vwap_failure' }];
    const { exits } = run(checks, { actions });
    expect(exits).toEqual([
      { symbol: 'ACN', tickSeq: 7, at: atOf(89.8), precededByTag: true },
      { symbol: 'KO', tickSeq: null, at: atOf(89.8), precededByTag: false },
    ]);
  });

  it('a tag from before the holding last came in does not precede its exit (one stint)', () => {
    const actions = [{ key: 'swap:in', at: atOf(80), symbolOut: 'PEP', symbolIn: 'ACN', exitReason: 'haiku_decision' }, exit('ACN', 90)];
    expect(run(checks, { actions }).exits.find((x) => x.symbol === 'ACN').precededByTag).toBe(false);
  });

  it('listExits alone (no items): every stagnation exit, precededByTag null — unknown, never false', () => {
    expect(listExits([exit('ACN', 90), { exitReason: 'vwap_failure' }])).toEqual([{ symbol: 'ACN', tickSeq: null, at: atOf(89.8), precededByTag: null }]);
  });
});

describe('reproducible from the stored tape alone (exit criterion 3)', () => {
  it('perCheck walks in step with the checks; a stored section that does not fits nothing, and says so', () => {
    const checks = Array.from({ length: 3 }, (_, i) => row(i + 1, i * 15, { px: { ACN: flat(i) } }));
    const { inputs } = run(checks);
    expect(() => tagDay({ inputs, checks: checks.slice(1), actions: [] })).toThrow(/tags_inputs_mismatch/);
    expect(() => tagDay({ inputs: { ...inputs, perCheck: [...inputs.perCheck].reverse() }, checks, actions: [] })).toThrow(/tags_inputs_mismatch/);
  });

  it('the close pass\'s stored tags: re-running tagDay on the stored inputs, checks and actions gives the stored items and exits, byte for byte', async () => {
    for (const fx of [await stalledDay(), await stalledDay({ battleId: 'b-dial', exitSeq: 5, dials: { tempo: 'aggressive' }, controlEpochLog: [epochEntry(true)], controlEpoch: 1 }), await stalledDay({ battleId: 'b-quiet-mid', noTriggerSeqs: [2, 12, 13], exitSeq: 8 })]) {
      const { tape } = await writeFor(fx);
      const stored = JSON.parse(JSON.stringify(tape));            // the Firestore round trip
      expect(stored.tags.items.length, fx.battleId).toBeGreaterThan(0);
      const again = tagDay({ inputs: stored.tags.inputs, checks: stored.checks, actions: stored.actions });
      expect(stableStringify(again.items), fx.battleId).toBe(stableStringify(stored.tags.items));
      expect(stableStringify(again.exits), fx.battleId).toBe(stableStringify(stored.tags.exits));
    }
  });
});

describe('the close pass writes the section (writeTapeDay → the merge → tagTapeDay)', () => {
  it('the stalled day: ACN tagged at checks 4 and 5, the rule\'s exit at 6 preceded; NVDA (a winner) and MSFT (moving) never', async () => {
    const fx = await stalledDay();
    const { tape, r } = await writeFor(fx);
    expect(r.status).toBe('written');
    expect(Object.keys(tape.tags).sort()).toEqual(['exits', 'inputs', 'items', 'registryVersion', 'situations']);
    expect(tape.tags.registryVersion).toBe(1);
    expect(tape.tags.situations).toEqual({ stalled: 1 });
    expect(tape.tags.items.map((i) => [i.symbol, i.tickSeq, i.count])).toEqual([['ACN', 4, 3], ['ACN', 5, 4]]);
    expect(tape.tags.exits).toEqual([{ symbol: 'ACN', tickSeq: 6, at: fx.swapAt, precededByTag: true }]);
    expect(tape.tags.inputs.archetypeCodeId).toBe('momentum_chaser');
    expect(tape.tags.inputs.perCheck).toHaveLength(tape.checks.length);
    expect(tape.coverage.tags.status).toBe(tape.coverage.checks.status === 'complete' && tape.coverage.evidence.status === 'complete' ? 'complete' : 'unavailable');
  });

  it('a no-trigger check before the exit pauses the count: the exit is listed NOT preceded — a mismatch the tape states, never hides', async () => {
    const { tape } = await writeFor(await stalledDay({ battleId: 'b-paused', noTriggerSeqs: [3] }));
    // 1 init, 2 → 1, 3 no price, 4 is 30 min after 2 (paused), 5 → 2, 6 the rule fires
    expect(tape.tags.items).toEqual([]);
    expect(tape.tags.exits).toEqual([{ symbol: 'ACN', tickSeq: 6, at: expect.any(String), precededByTag: false }]);
  });

  it('every number in the section has exactly one declared class', async () => {
    const { tape } = await writeFor(await stalledDay({ battleId: 'b-dial', exitSeq: 5, dials: { tempo: 'aggressive' }, controlEpochLog: [epochEntry(true)], controlEpoch: 1 }));
    const tagNums = numbersWithClasses(tape, tape.numberClasses).filter((n) => n.path[0] === 'tags');
    expect(tagNums.length).toBeGreaterThan(20);
    expect(tagNums.filter((n) => !n.cls).map((n) => formatNumberPath(n.path))).toEqual([]);
  });

  it('an unknown archetype: coverage.tags unavailable with the reason, no items, and the exits still listed (precededByTag unknown)', async () => {
    const { tape } = await writeFor(await stalledDay({ archetype: 'speculator' }));
    expect(tape.coverage.tags.status).toBe('unavailable');
    expect(tape.coverage.tags.note).toBe('stalled unavailable: unknown archetype (speculator)');
    expect(tape.tags.items).toBeNull();
    expect(tape.tags.inputs).toEqual({ archetypeCodeId: 'speculator' });
    expect(tape.tags.exits).toEqual([{ symbol: 'ACN', tickSeq: 6, at: expect.any(String), precededByTag: null }]);
  });

  it('coverage follows the checks and the evidence: a partial checks section lists stalled unavailable, naming it; the items are still stored', async () => {
    const { tape } = await writeFor(await capturedDay());          // a partial day (a gap, a deferral) of an unknown archetype
    expect(tape.coverage.checks.status).toBe('partial');
    const fx = await stalledDay({ battleId: 'b-gappy' });
    fx.ticks = fx.ticks.filter((t) => t.tickSeq !== 12);          // minted, never captured: the checks section is partial
    const gappy = await writeFor(fx);
    expect(gappy.tape.coverage.checks.status).toBe('partial');
    expect(gappy.tape.coverage.tags.status).toBe('unavailable');
    expect(gappy.tape.coverage.tags.note).toMatch(/^stalled unavailable: the checks section is partial/);
    expect(gappy.tape.tags.items.map((i) => i.tickSeq)).toEqual([4, 5]);
  });

  it('the pause note counts the checks with no price for a held stock, singular and plural', async () => {
    const one = await writeFor(await stalledDay({ battleId: 'b-one', noTriggerSeqs: [9] }));
    expect(one.tape.coverage.tags.note).toMatch(/the count pauses at 1 check that carries no price for a held stock/);
    const two = await writeFor(await stalledDay({ battleId: 'b-two', noTriggerSeqs: [9, 11] }));
    expect(two.tape.coverage.tags.note).toMatch(/the count pauses at 2 checks that carry no price for a held stock/);
  });

  it('idempotent: a second run over the same sources writes nothing', async () => {
    const fx = await stalledDay();
    const t = makeTapeDb(seedDay({}, fx));
    expect((await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: NOW })).status).toBe('written');
    expect((await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: NOW + 60_000 })).status).toBe('unchanged');
  });

  it('EVERY REFRESH RE-TAGS: a tape written before B1 (no tags) gains them through the backfill\'s refresh=1 path', async () => {
    const fx = await stalledDay();
    const t = makeTapeDb(seedDay({}, fx));
    await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: NOW });
    const path = tapePath(fx.battleId, fx.etDate);
    const pre = structuredClone(t.store.get(path));
    delete pre.tags;
    delete pre.coverage.tags;
    t.store.set(path, pre);                                        // as a pre-B1 close pass left it
    const plain = await runBackfill({ db: t.db, clock: () => NOW + 120_000, dates: [fx.etDate] });
    expect(plain.alreadyDone).toEqual([{ battleId: fx.battleId, etDate: fx.etDate }]);
    expect(t.store.get(path).tags).toBeUndefined();               // the default backfill skips a written day
    const r = await runBackfill({ db: t.db, clock: () => NOW + 180_000, dates: [fx.etDate], refresh: true });
    expect(r.refreshed).toEqual([{ battleId: fx.battleId, etDate: fx.etDate, bytes: expect.any(Number) }]);
    expect(t.store.get(path).tags.items.map((i) => i.tickSeq)).toEqual([4, 5]);
    expect(t.store.get(path).coverage.tags.status).toEqual(expect.any(String));
  });

  it('the refresh re-tags from the MERGED rows: a check the new read lacks but the tape kept is still walked', async () => {
    const fx = await stalledDay();
    const t = makeTapeDb(seedDay({}, fx));
    await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: NOW });
    const before = t.store.get(tapePath(fx.battleId, fx.etDate)).tags;
    // the evaluations entries of checks 2–5 evicted from the battle: the tick rows keep their evidence (BA-19)
    const battle = structuredClone(t.store.get(`agentBattles/${fx.battleId}`));
    battle.evaluations = battle.evaluations.filter((e) => !/:e[2-5]$/.test(e.evalId));
    t.store.set(`agentBattles/${fx.battleId}`, battle);
    await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: NOW + 60_000 });
    const after = t.store.get(tapePath(fx.battleId, fx.etDate)).tags;
    expect(after.items).toEqual(before.items);
    expect(after.exits).toEqual(before.exits);
  });
});

describe('tagChecks — the rows the tagger walks are the candle pass\'s checks', () => {
  it('deferrals and minted-but-missing rows are not checks the battle ran', () => {
    const rows = [row(1, 0, { px: { ACN: 1 } }), { key: 'run:x', state: 'deferred', at: atOf(5) }, { key: 'seq:3', state: 'no_record', tickSeq: 3, at: null }];
    expect(tagChecks(rows).map((r) => r.key)).toEqual(['seq:1']);
  });
});

describe('coverage.tags follows the checks AND the evidence sections (spec §2)', () => {
  const checks = Array.from({ length: 5 }, (_, i) => row(i + 1, i * 15, { px: { ACN: flat(i) } }));
  const cov = (checksStatus, evidenceStatus) => tagTapeDay({
    battle: battleOf('momentum_chaser'),
    doc: { checks, actions: [], coverage: { checks: { status: checksStatus }, evidence: { status: evidenceStatus } } },
  }).coverage;

  it('both complete: complete', () => { expect(cov('complete', 'complete').status).toBe('complete'); });
  it('evidence partial, checks complete: unavailable, naming the evidence', () => {
    expect(cov('complete', 'partial')).toMatchObject({ status: 'unavailable', note: 'stalled unavailable: the evidence section is partial' });
  });
  it('checks partial, evidence complete: unavailable, naming the checks', () => {
    expect(cov('partial', 'complete')).toMatchObject({ status: 'unavailable', note: 'stalled unavailable: the checks section is partial' });
  });
  it('the items are the same either way — coverage labels them, never removes them', () => {
    const a = tagTapeDay({ battle: battleOf('momentum_chaser'), doc: { checks, actions: [], coverage: { checks: { status: 'complete' }, evidence: { status: 'complete' } } } });
    const b = tagTapeDay({ battle: battleOf('momentum_chaser'), doc: { checks, actions: [], coverage: { checks: { status: 'partial' }, evidence: { status: 'partial' } } } });
    expect(b.tags).toEqual(a.tags);
    expect(seqsOf(a.tags.items)).toEqual([4, 5]);
  });
});

describe('tagTapeDay never throws', () => {
  it('a doc with no rows at all: the section, empty, and its coverage', () => {
    const r = tagTapeDay({ battle: battleOf('momentum_chaser'), doc: {} });
    expect(r.tags.items).toEqual([]);
    expect(r.tags.exits).toEqual([]);
    expect(r.coverage.status).toBe('unavailable');
  });
});
