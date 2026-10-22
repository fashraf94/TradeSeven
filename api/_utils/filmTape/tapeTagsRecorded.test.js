// api/_utils/filmTape/tapeTagsRecorded.test.js
//
// Film Room B1.1 item 2 — `stalled` v2 reads the rule's own count
// (Amendment C, RC-1). Per holding, per day, the tagger picks a basis:
//
//   recorded    — every check that holds the symbol carries the live rule's
//                 record (`checks[].stagnation[sym]`): the count, its age
//                 verdict and the daily change the winner test read are those
//                 records; nothing is recomputed. A reset is
//                 `withinAge && ticks === 0`.
//   recomputed  — any check that holds it lacks the record: the holding is
//                 walked exactly as B1 walks it.
//
// ACCEPTANCE B AGAIN, on a day built like the census's three mismatches
// (docs/audits/20261012_BUILD_FILM_ROOM_B1.md §4): no-trigger and meeting
// checks between the stall and the exit, where B1's recomputed count pauses.
// With the records on every tick, the exit is preceded by a tag; without them
// the same day gives B1's result BYTE FOR BYTE — compared against B1's own
// output, frozen before this build touched the tagger
// (__fixtures__/tagsB1Golden.json; regenerate ONLY from a tree whose tagger
// is B1's, never to make this suite green):
//   GENERATE_TAGS_B1_GOLDEN=1 npx vitest run api/_utils/filmTape/tapeTagsRecorded.test.js
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the real tagger and writer
// imports; only the flag module is mocked, by spreading the real one.

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

vi.mock('../../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_TAPE_WRITE_ENABLED() { return true; },
  CALL_RECORDS_MODE: 'shadow',
}));

import { writeTapeDay } from './writeTapeDay.js';
import * as tagger from './tapeTags.js';
import { makeTapeDb } from './__fixtures__/tapeFirestore.js';
import { seedDay } from './__fixtures__/tapeFixtures.js';
import { stalledDay, epochEntry, quoteOf } from './__fixtures__/tagFixtures.js';
import { SITUATIONS, SITUATION_REGISTRY_VERSION } from '../../../src/data/situationRegistry.js';
import { computeB1Census } from '../../../scripts/census-film-room-b1.mjs';
import { stableStringify } from './tapeMerge.js';
import { ABSENT_ENTRY_REASON } from './tapeNotes.js';

// Rows write whole fixture days through the real writer (the heavy tape suites' limit).
vi.setConfig({ testTimeout: 30_000, hookTimeout: 60_000 });

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN_PATH = resolve(HERE, '__fixtures__/tagsB1Golden.json');
const ENV = globalThis.process?.env ?? {};
const GENERATE = ENV.GENERATE_TAGS_B1_GOLDEN === '1';
if (GENERATE && ENV.CI) throw new Error('GENERATE_TAGS_B1_GOLDEN is a local, deliberate act — never on CI');
/** The golden's SHA-256 as captured from B1's tagger (the review C-9 pattern: the label inside the file proves nothing by itself). */
const GOLDEN_SHA256 = '1349e07bff6c93a080a4ceaceca62e739f53a1483d5c3661a300b539efa145c8';

const NOW = Date.parse('2026-09-25T02:15:30.000Z');
const tapePath = (fx) => `agentBattles/${fx.battleId}/tape/${fx.etDate}`;
async function writeFor(fx) {
  const t = makeTapeDb(seedDay({}, fx));
  await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: NOW });
  return t.store.get(tapePath(fx));
}

// The census's mismatch shape: ACN stalls from check 2; checks 3 and 4 are
// no-trigger checks and 5 a meeting check — none carries a price, so B1's
// recomputed count pauses there; the live rule kept counting and fired at 6
// (whose stamp, written after the swap, no longer carries ACN).
const ACCEPTANCE = { noTriggerSeqs: [3, 4], meetingSeqs: [5], exitSeq: 6 };
/** The fixture days, each as a function of whether its ticks carry the record. */
const DAYS = {
  acceptance: (recorded) => stalledDay({ battleId: 'b-accB', ...ACCEPTANCE, recordStagnation: recorded }),
  standard: (recorded) => stalledDay({ battleId: 'b-std', recordStagnation: recorded }),
  // ACN's record missing at ONE check (3): ACN alone is recomputed for the day
  oneMissing: async (recorded) => {
    const fx = await stalledDay({ battleId: 'b-one', ...ACCEPTANCE, recordStagnation: recorded });
    if (recorded) delete fx.ticks.find((tk) => tk.tickSeq === 3).risk.stagnation.ACN;
    return fx;
  },
};
const sectionOf = (tape) => ({ tags: tape.tags, coverage: tape.coverage.tags });

describe('the frozen B1 result (generated once, from B1\'s tagger)', () => {
  it('GENERATE (local only) or load', async () => {
    if (!GENERATE) {
      expect(existsSync(GOLDEN_PATH), 'frozen fixture missing — it is captured once, from B1\'s tagger').toBe(true);
      return;
    }
    const days = {};
    for (const [name, make] of Object.entries(DAYS)) {
      days[name] = {
        withoutRecords: sectionOf(await writeFor(await make(false))),
        withRecords: sectionOf(await writeFor(await make(true))),
      };
    }
    writeFileSync(GOLDEN_PATH, `${JSON.stringify({
      capturedFrom: 'claude/film-room-b1-1 @ 0fdd9039 — api/_utils/filmTape/tapeTags.js and src/data/situationRegistry.js byte-identical to main @ 495ee07b (B1); the tagger then had no recorded basis, so B1 recomputes whether or not the ticks carry the record',
      days,
    }, null, 2)}\n`);
    throw new Error(`frozen fixture written to ${GOLDEN_PATH} — this generating run fails on purpose; pin its SHA-256 and re-run WITHOUT GENERATE_TAGS_B1_GOLDEN`);
  });

  it('the fixture file is exactly the one captured from B1\'s tagger (SHA-256 pinned), LF only', () => {
    expect(createHash('sha256').update(readFileSync(GOLDEN_PATH)).digest('hex')).toBe(GOLDEN_SHA256);
    expect(readFileSync(GOLDEN_PATH).includes(0x0d)).toBe(false);
  });
});

const golden = existsSync(GOLDEN_PATH) ? JSON.parse(readFileSync(GOLDEN_PATH, 'utf8')) : null;
/**
 * v2's section as B1 would label it: the version labels back to 1 and the new
 * `inputs.holdingBasis` removed — every other byte compared. With
 * `recordsRead`, also the one source a day with a recorded holding names
 * (`checks.stagnation`), so a mixed day's RECOMPUTED holding is compared alone.
 */
function asB1(section, { recordsRead = false } = {}) {
  const s = structuredClone(section);
  if (recordsRead) s.coverage.sources = s.coverage.sources.filter((x) => x !== 'checks.stagnation');
  s.tags.registryVersion = 1;
  s.tags.situations = { ...s.tags.situations, stalled: 1 };
  if (Array.isArray(s.tags.items)) s.tags.items = s.tags.items.map((i) => ({ ...i, version: 1 }));
  if (s.tags.inputs) {
    delete s.tags.inputs.holdingBasis;
    // Amendment D RD-7 (X2-7b): v2 names each basis's input; B1 stored the recomputed one alone. Only the exact map is relabelled.
    if (stableStringify(s.tags.inputs.winnerBasis) === stableStringify(tagger.WINNER_BASIS)) s.tags.inputs.winnerBasis = tagger.WINNER_BASIS.recomputed;
  }
  return s;
}
const census = (tape, battle) => computeB1Census({ tapes: [{ path: `agentBattles/${battle.id}/tape/${tape.etDate}`, data: tape }], battles: { [battle.id]: battle }, dialEnabled: true, nowMs: NOW }).B;

describe('the frozen B1 result is record-blind (the precondition of the comparisons below)', () => {
  it.each(Object.keys(DAYS))('%s: B1 tags the day the same with or without the records on its ticks', (name) => {
    expect(stableStringify(golden.days[name].withRecords)).toBe(stableStringify(golden.days[name].withoutRecords));
  });
  it('the acceptance day reproduces the census\'s mismatch under B1: the exit is not preceded, and the count pauses at its three priceless checks', () => {
    const b1 = golden.days.acceptance.withoutRecords;
    expect(b1.tags.exits).toEqual([{ symbol: 'ACN', tickSeq: 6, at: expect.any(String), precededByTag: false }]);
    expect(b1.tags.items).toEqual([]);
    expect(b1.coverage.note).toBe('the count pauses at 3 checks that carry no price for a held stock');
  });
});

describe('ACCEPTANCE B again — the census\'s shape with the live rule\'s count recorded on every tick', () => {
  let fx;
  let tape;
  beforeAll(async () => { fx = await DAYS.acceptance(true); tape = await writeFor(fx); });

  it('every holding is on the recorded basis, stored in tags.inputs', () => {
    expect(tape.tags.inputs.holdingBasis).toEqual({ ACN: 'recorded', MSFT: 'recorded', NVDA: 'recorded', XOM: 'recorded' });
  });

  it('the stagnation exit is preceded: ACN is tagged at the no-trigger check 4 and the meeting check 5 with the live counts 3 and 4', () => {
    expect(tape.checks.find((c) => c.tickSeq === 4).state).toBe('no_trigger');
    expect(tape.checks.find((c) => c.tickSeq === 5).state).toBe('gameplan_pending');
    expect(tape.tags.items.map((i) => [i.symbol, i.tickSeq, i.count, i.effectiveTicksThreshold, i.version])).toEqual([['ACN', 4, 3, 5, 2], ['ACN', 5, 4, 5, 2]]);
    expect(tape.tags.exits).toEqual([{ symbol: 'ACN', tickSeq: 6, at: expect.any(String), precededByTag: true }]);
  });

  it('the census counts it: every recorded stagnation exit preceded, no mismatch to class', () => {
    const B = census(tape, fx.battle);
    expect(B).toMatchObject({ exits: 1, preceded: 1, notPreceded: 0, unknown: 0 });
    expect(B.mismatchClass).toEqual({});
  });

  it('the coverage: no recorded count pauses, and the records are named as a source', () => {
    expect(tape.coverage.tags.status).toBe('complete');
    expect(tape.coverage.tags.note).toBeNull();
    expect(tape.coverage.tags.sources).toContain('checks.stagnation');
  });
});

describe('the same days WITHOUT the records give B1\'s result, byte for byte (the version labels apart)', () => {
  it.each(Object.keys(DAYS))('%s', async (name) => {
    const tape = await writeFor(await DAYS[name](false));
    expect(Object.values(tape.tags.inputs.holdingBasis).every((b) => b === 'recomputed')).toBe(true);
    expect(stableStringify(asB1(sectionOf(tape)))).toBe(stableStringify(golden.days[name].withoutRecords));
    // only the labels moved: registry 2, stalled 2 (RC-1)
    expect(tape.tags.registryVersion).toBe(SITUATION_REGISTRY_VERSION);
    expect(tape.tags.situations.stalled).toBe(SITUATIONS.stalled.version);
  });
});

describe('ONE check lacks the record — that holding alone is recomputed, exactly as B1', () => {
  let fx;
  let tape;
  beforeAll(async () => { fx = await DAYS.oneMissing(true); tape = await writeFor(fx); });

  it('ACN recomputed (its record is missing at check 3); every other holding recorded', () => {
    expect(tape.tags.inputs.holdingBasis).toEqual({ ACN: 'recomputed', MSFT: 'recorded', NVDA: 'recorded', XOM: 'recorded' });
  });

  it('ACN\'s items and exit are B1\'s — byte for byte — and the census reports the mismatch with its class', () => {
    expect(tape.coverage.tags.sources).toContain('checks.stagnation');
    expect(stableStringify(asB1(sectionOf(tape), { recordsRead: true }))).toBe(stableStringify(golden.days.oneMissing.withRecords));
    const B = census(tape, fx.battle);
    expect(B).toMatchObject({ exits: 1, preceded: 0, notPreceded: 1 });
    expect(B.mismatchClass).toEqual({ no_price_pause: 1 });
  });
});

describe('the standard day: where every check carries a price, the recorded count is the recomputed one', () => {
  it('the same items and exits as B1 — the two bases agree when nothing pauses', async () => {
    const tape = await writeFor(await DAYS.standard(true));
    expect(Object.values(tape.tags.inputs.holdingBasis).every((b) => b === 'recorded')).toBe(true);
    const b1 = golden.days.standard.withRecords.tags;
    expect(asB1(sectionOf(tape)).tags.items).toEqual(b1.items);
    expect(asB1(sectionOf(tape)).tags.exits).toEqual(b1.exits);
  });
});

describe('exit criterion 3 — the section is reproducible from tags.inputs and checks[] under both bases', () => {
  it.each([['recorded', 'acceptance', true], ['recomputed', 'acceptance', false], ['mixed', 'oneMissing', true]])('%s (%s): a JSON round trip of the stored inputs, checks and actions gives the stored items and exits', async (_, name, recorded) => {
    const tape = JSON.parse(JSON.stringify(await writeFor(await DAYS[name](recorded))));
    const again = tagger.tagDay({ inputs: tape.tags.inputs, checks: tape.checks, actions: tape.actions });
    expect(again.items).toEqual(tape.tags.items);
    expect(again.exits).toEqual(tape.tags.exits);
  });

  it('stored inputs that name another basis than the checks\' own are out of step — the tagger says so, never tags on them', async () => {
    const tape = JSON.parse(JSON.stringify(await writeFor(await DAYS.acceptance(true))));
    const tampered = { ...tape.tags.inputs, holdingBasis: { ...tape.tags.inputs.holdingBasis, ACN: 'recomputed' } };
    expect(() => tagger.tagDay({ inputs: tampered, checks: tape.checks, actions: tape.actions })).toThrow('tags_inputs_mismatch');
  });

  it('a B1 tape\'s stored v1 inputs (no holdingBasis) still reproduce its section', async () => {
    const tape = JSON.parse(JSON.stringify(await writeFor(await DAYS.acceptance(false))));
    const { holdingBasis: _gone, ...v1 } = tape.tags.inputs;
    const again = tagger.tagDay({ inputs: v1, checks: tape.checks, actions: tape.actions });
    expect(again.items).toEqual(tape.tags.items);
    expect(again.exits).toEqual(tape.tags.exits);
  });

  it.each(Object.keys(DAYS))('Amendment D RD-7 (X2-7b): B1\'s OWN stored inputs (frozen; winnerBasis the string it stored) still reproduce B1\'s items and exits — %s', async (name) => {
    const b1 = golden.days[name].withoutRecords.tags;
    expect(b1.inputs.winnerBasis).toBe('change_since_entry');
    const tape = JSON.parse(JSON.stringify(await writeFor(await DAYS[name](false))));
    const again = tagger.tagDay({ inputs: b1.inputs, checks: tape.checks, actions: tape.actions });
    expect(again.items.map((i) => ({ ...i, version: 1 }))).toEqual(b1.items);
    expect(again.exits).toEqual(b1.exits);
  });
});

// ── the recorded walk, check by check (synthetic rows in the tape's own shape) ──
const T0 = Date.parse('2026-09-24T13:30:20.000Z');
const atOf = (min) => new Date(T0 + min * 60_000).toISOString();
/** A tick-backed check at `min` minutes: risk verdicts for `held`, a record per symbol in `rec`, evidence for the symbols in `px`. */
function rrow(seq, min, { held = ['ACN'], rec = {}, px = {}, chg = {}, risk = {} } = {}) {
  const priced = Object.keys(px);
  return {
    key: `seq:${seq}`, rowSource: 'tick', tickSeq: seq, at: atOf(min), state: 'completed',
    risk: Object.fromEntries(held.map((s) => [s, risk[s] ?? { action: 'HOLD', reason: null }])),
    evidence: priced.length ? Object.fromEntries(priced.map((s) => [s, { px: px[s], chg: chg[s] ?? -0.4 }])) : null,
    evidenceAt: priced.length ? atOf(min) : null,
    ...(Object.keys(rec).length ? { stagnation: rec } : {}),
  };
}
/** A record as the evaluator writes it: the count, the age verdict, the daily change (a fraction). */
const R = (ticks, withinAge = true, dailyPct = -0.004) => ({ ticks, withinAge, dailyPct });
function walk(checks, { archetype = 'momentum_chaser', actions = [] } = {}) {
  const r = tagger.tagInputs({ battle: { agentContext: { archetype } }, checks, dialEnabled: true });
  expect(r.ok).toBe(true);
  return { inputs: r.inputs, ...tagger.tagDay({ inputs: r.inputs, checks, actions }) };
}
const exitAt = (seq, min, sym = 'ACN') => ({ key: `swap:${seq}`, at: atOf(min - 0.2), tickSeq: seq, symbolOut: sym, symbolIn: 'XOM', exitReason: 'stagnation' });
const tagged = (r, sym = 'ACN') => r.items.filter((i) => i.symbol === sym).map((i) => [i.tickSeq, i.count]);

describe('the recorded walk — the record is the count, the age verdict and the winner input; nothing is recomputed', () => {
  // momentum_chaser: ticksThreshold 5, S1 2 → live at count 3; winnerThreshold 0.0015.
  it('the count carries over the night: a first check whose recorded count is already 4 is stalled at once (the recomputed count would start at zero)', () => {
    const r = walk([rrow(1, 0, { rec: { ACN: R(4) } }), rrow(2, 15, { rec: { ACN: R(5, true) }, risk: { ACN: { action: 'SWAP_OUT', reason: 'stagnation' } } })], { actions: [exitAt(2, 15)] });
    expect(r.inputs.holdingBasis).toEqual({ ACN: 'recorded' });
    expect(tagged(r)).toEqual([[1, 4]]);
    expect(r.exits.map((x) => x.precededByTag)).toEqual([true]);
  });

  it('no price is needed: checks with no evidence at all are tagged on their records', () => {
    const r = walk([1, 2, 3, 4].map((seq) => rrow(seq, (seq - 1) * 15, { rec: { ACN: R(seq) } })));
    expect(tagged(r)).toEqual([[3, 3], [4, 4]]);
  });

  it('a reset is `withinAge && ticks === 0`: a tag before it does not precede an exit after it', () => {
    const checks = [
      rrow(1, 0, { rec: { ACN: R(3) } }),
      rrow(2, 15, { rec: { ACN: R(0, true) } }),
      rrow(3, 30, { rec: { ACN: R(1) } }),
      rrow(4, 45, { rec: { ACN: R(2) }, risk: { ACN: { action: 'SWAP_OUT', reason: 'stagnation' } } }),
    ];
    expect(walk(checks, { actions: [exitAt(4, 45)] }).exits.map((x) => x.precededByTag)).toEqual([false]);
    // a zero that was NOT timely (withinAge false) is a pause at zero, not a reset: the run, and its tag, stand
    checks[1] = rrow(2, 15, { rec: { ACN: R(0, false) } });
    expect(walk(checks, { actions: [exitAt(4, 45)] }).exits.map((x) => x.precededByTag)).toEqual([true]);
  });

  it('the winner test reads the RECORDED daily change, never the change from entry', () => {
    // up 1% on the day, down from entry: a winner — no tag
    expect(tagged(walk([rrow(1, 0, { rec: { ACN: R(4, true, 0.01) }, px: { ACN: 300 }, chg: { ACN: -0.4 } })]))).toEqual([]);
    // down on the day, up 5% from entry: stalled
    expect(tagged(walk([rrow(1, 0, { rec: { ACN: R(4, true, -0.01) }, px: { ACN: 300 }, chg: { ACN: 5 } })]))).toEqual([[1, 4]]);
    // exactly at the threshold is not below it (the live rule's `<`)
    expect(tagged(walk([rrow(1, 0, { rec: { ACN: R(4, true, 0.0015) } })]))).toEqual([]);
  });

  it('the rule having fired ends the run for tagging, as on the recomputed basis', () => {
    const r = walk([
      rrow(1, 0, { rec: { ACN: R(5) }, risk: { ACN: { action: 'HOLD', reason: 'stagnation' } } }),
      rrow(2, 15, { rec: { ACN: R(6) } }),
    ]);
    expect(tagged(r)).toEqual([]);
  });

  it('an INCOMPLETE record at one check (a null count) puts the holding on the recomputed basis for the day', () => {
    const r = walk([rrow(1, 0, { rec: { ACN: R(4) } }), rrow(2, 15, { rec: { ACN: { ticks: null, withinAge: true, dailyPct: -0.004 } } })]);
    expect(r.inputs.holdingBasis).toEqual({ ACN: 'recomputed' });
    expect(tagged(r)).toEqual([]);           // no evidence: the recomputed count never steps
  });

  it('only the checks that HOLD a symbol need its record: a check where it is not held does not demote it', () => {
    const r = walk([
      rrow(1, 0, { held: ['ACN', 'MSFT'], rec: { ACN: R(1), MSFT: R(3) } }),
      rrow(2, 15, { held: ['ACN'], rec: { ACN: R(2) } }),
    ]);
    expect(r.inputs.holdingBasis).toEqual({ ACN: 'recorded', MSFT: 'recorded' });
    expect(tagged(r, 'MSFT')).toEqual([[1, 3]]);
  });

  it('forced rotation switched off (guardian): stalled at S2\'s check count, on the recorded count', () => {
    const checks = [5, 6].map((n, i) => rrow(i + 1, i * 15, { rec: { ACN: R(n, true, -0.004) } }));
    expect(tagged(walk(checks, { archetype: 'guardian' }))).toEqual([[2, 6]]);
  });
});

describe('RC-1\'s "the count runs at S2\'s move threshold" holds for the recorded count by value', () => {
  it('every archetype whose forced rotation is off counts at S2\'s move threshold in the live rule (its own pctThreshold) — a tripwire for the day they part', async () => {
    const { VALID_ARCHETYPES } = await import('../agentArchetypeConfig.js');
    const { getArchetypeDefinition } = await import('../archetypeRegistry.js');
    const off = VALID_ARCHETYPES.filter((id) => getArchetypeDefinition(id).physics.hftConfig.forcedRotation.enabled === false);
    expect(off.length).toBeGreaterThan(0);
    for (const id of off) expect(getArchetypeDefinition(id).physics.hftConfig.forcedRotation.pctThreshold, id).toBe(SITUATIONS.stalled.slots.S2.pctThreshold);
  });
});

describe('review X2-1 — a recorded holding\'s mismatch is reported with its own class', () => {
  it('a recorded day whose tagger threshold is not the live one (the tape\'s dial reads `measured`, the fixture\'s live counter fired at the archetype\'s own 5): not preceded, class `recorded_basis`', async () => {
    const fx = await stalledDay({ battleId: 'b-rec-miss', recordStagnation: true, dials: { tempo: 'measured' }, controlEpochLog: [epochEntry(true)], controlEpoch: 1 });
    const tape = await writeFor(fx);
    expect(tape.tags.inputs.holdingBasis.ACN).toBe('recorded');
    expect(tape.tags.inputs.perCheck[0].effectiveTicksThreshold).toBeGreaterThan(5);
    expect(tape.tags.exits).toEqual([{ symbol: 'ACN', tickSeq: 6, at: expect.any(String), precededByTag: false }]);
    const B = census(tape, fx.battle);
    expect(B).toMatchObject({ exits: 1, preceded: 0, notPreceded: 1 });
    expect(B.mismatchClass).toEqual({ recorded_basis: 1 });
    expect(B.mismatchFlags).toEqual({ recorded_basis: 1 });
  });
});

describe('review X2-1 (refuter rf5, P2) — the class on a shape reachable with no dial at all', () => {
  it('a recorded holding hovering at the winner threshold — above it at every stall check, below it only at the fire: not preceded, class `recorded_basis`', () => {
    // momentum_chaser: live at count 3, winner threshold 0.0015
    const checks = [
      rrow(1, 0, { rec: { ACN: R(1, true, -0.001) } }),
      rrow(2, 15, { rec: { ACN: R(2, true, -0.001) } }),
      rrow(3, 30, { rec: { ACN: R(3, true, 0.0016) } }),
      rrow(4, 45, { rec: { ACN: R(4, true, 0.0016) } }),
      rrow(5, 60, { rec: { ACN: R(5, true, 0.0014) }, risk: { ACN: { action: 'SWAP_OUT', reason: 'stagnation' } } }),
    ];
    const tape = {
      etDate: '2026-09-24', ownerId: 'o-1', passes: { close: { status: 'written' }, candles: { status: 'written' } }, checks, actions: [exitAt(5, 60)],
      coverage: { checks: { status: 'complete' }, evidence: { status: 'complete' } }, meetings: [], comparables: { sectors: {} },
    };
    const battle = { id: 'b-hover', agentContext: { archetype: 'momentum_chaser' } };
    const B = census(tape, battle);
    expect(B).toMatchObject({ exits: 1, preceded: 0, notPreceded: 1 });
    expect(B.mismatchClass).toEqual({ recorded_basis: 1 });
  });
});

describe('review X5-2 / X5-4 — the basis rule\'s remaining branches', () => {
  it('a check rebuilt from its entry (capture missed the tick) carries no record: every holding it holds is recomputed for the day', async () => {
    const fx = await stalledDay({ battleId: 'b-entry-row', recordStagnation: true });
    fx.ticks = fx.ticks.filter((tk) => tk.tickSeq !== 7);
    const tape = await writeFor(fx);
    const entry = tape.checks.find((c) => c.rowSource === 'entry');
    expect(entry).toBeTruthy();
    const heldThere = Object.keys(entry.evidence).sort();
    expect(heldThere.length).toBeGreaterThan(0);
    for (const sym of heldThere) expect(tape.tags.inputs.holdingBasis[sym], sym).toBe('recomputed');
  });

  it.each([
    ['an age verdict that is not a boolean', { ticks: 5, withinAge: null, dailyPct: -0.004 }],
    ['a daily change that is not a number', { ticks: 5, withinAge: true, dailyPct: null }],
  ])('an incomplete record — %s — at one check puts the holding on the recomputed basis', (_, rec) => {
    const r = walk([rrow(1, 0, { rec: { ACN: R(4) } }), rrow(2, 15, { rec: { ACN: rec } })]);
    expect(r.inputs.holdingBasis).toEqual({ ACN: 'recomputed' });
  });

  it('stored inputs naming an EXTRA holding the checks do not hold are out of step too', async () => {
    const tape = JSON.parse(JSON.stringify(await writeFor(await DAYS.acceptance(true))));
    const tampered = { ...tape.tags.inputs, holdingBasis: { ...tape.tags.inputs.holdingBasis, ZZZ: 'recorded' } };
    expect(() => tagger.tagDay({ inputs: tampered, checks: tape.checks, actions: tape.actions })).toThrow('tags_inputs_mismatch');
  });
});

// ── Amendment D RD-5 — coverage on a recorded day ──────────────────────────
// The evidence section's status counts toward coverage.tags (and
// `checks.evidence` is a source) only when some holding of the day is on the
// recomputed basis. The checks section always counts. Within one assembly an
// evidence reason always comes with a checks reason (tapeAssemble.js: the
// "tickMs unavailable where the entry is absent" reason), so these rows set the
// two sections' statuses directly, as B1's own coverage rows do (tapeTags.test.js).
describe('Amendment D RD-5 — the evidence counts only when some holding is recomputed', () => {
  const DAY = {
    recorded: [1, 2, 3, 4].map((seq) => rrow(seq, (seq - 1) * 15, { rec: { ACN: R(seq) }, px: { ACN: 300 } })),
    // MSFT carries no record: it alone is recomputed
    mixed: [1, 2, 3, 4].map((seq) => rrow(seq, (seq - 1) * 15, { held: ['ACN', 'MSFT'], rec: { ACN: R(seq) }, px: { ACN: 300, MSFT: 420 } })),
    recomputed: [1, 2, 3, 4].map((seq) => rrow(seq, (seq - 1) * 15, { px: { ACN: 300 + (seq % 2) * 0.01 } })),
  };
  const tagsFor = (checks, checksStatus, evidenceStatus) => tagger.tagTapeDay({
    battle: { agentContext: { archetype: 'momentum_chaser' } }, dialEnabled: true,
    doc: { checks, actions: [], coverage: { checks: { status: checksStatus }, evidence: { status: evidenceStatus } } },
  });

  it('a FULLY RECORDED day with partial evidence: complete — no longer unavailable — and the evidence is not a source', () => {
    const r = tagsFor(DAY.recorded, 'complete', 'partial');
    expect(r.tags.inputs.holdingBasis).toEqual({ ACN: 'recorded' });
    expect(r.coverage).toMatchObject({ status: 'complete', note: null, sources: ['checks', 'checks.risk', 'actions', 'checks.stagnation'] });
    expect(r.tags.items.map((i) => i.tickSeq)).toEqual([3, 4]);
  });

  it('a MIXED day (MSFT recomputed) with partial evidence: unavailable, naming the evidence, which is a source', () => {
    const r = tagsFor(DAY.mixed, 'complete', 'partial');
    expect(r.tags.inputs.holdingBasis).toEqual({ ACN: 'recorded', MSFT: 'recomputed' });
    expect(r.coverage).toMatchObject({
      status: 'unavailable', note: 'stalled unavailable: the evidence section is partial',
      sources: ['checks', 'checks.evidence', 'checks.risk', 'actions', 'checks.stagnation'],
    });
  });

  it('a FULLY RECOMPUTED day with partial evidence: unavailable, exactly as B1.1 wrote it', () => {
    const r = tagsFor(DAY.recomputed, 'complete', 'partial');
    expect(r.tags.inputs.holdingBasis).toEqual({ ACN: 'recomputed' });
    expect(r.coverage).toEqual({
      status: 'unavailable', span: { from: atOf(0), to: atOf(45) },
      sources: ['checks', 'checks.evidence', 'checks.risk', 'actions'], preservedFrom: null, note: 'stalled unavailable: the evidence section is partial',
    });
  });

  it('a fully recorded day whose CHECKS are partial: still unavailable, naming the checks alone', () => {
    const r = tagsFor(DAY.recorded, 'partial', 'partial');
    expect(r.coverage).toMatchObject({ status: 'unavailable', note: 'stalled unavailable: the checks section is partial' });
    expect(r.coverage.sources).not.toContain('checks.evidence');
  });

  it('a day that holds nothing has no recomputed holding: only the checks count', () => {
    const r = tagsFor([{ key: 'seq:1', rowSource: 'tick', tickSeq: 1, at: atOf(0), state: 'completed', risk: null, evidence: null }], 'complete', 'unavailable');
    expect(r.tags.inputs.holdingBasis).toEqual({});
    expect(r.coverage).toMatchObject({ status: 'complete', sources: ['checks', 'checks.risk', 'actions'] });
  });

  it('review Y2-4 — the failure paths keep B1\'s source list on a fully recorded day: inputs that do not resolve, and a throw inside the walk', () => {
    const B1_SOURCES = ['checks', 'checks.evidence', 'checks.risk', 'actions'];
    const doc = { checks: DAY.recorded, actions: [], coverage: { checks: { status: 'complete' }, evidence: { status: 'partial' } } };
    const unresolved = tagger.tagTapeDay({ battle: { agentContext: { archetype: 'speculator' } }, dialEnabled: true, doc });
    expect(unresolved.coverage).toMatchObject({ status: 'unavailable', note: 'stalled unavailable: unknown archetype (speculator)', sources: B1_SOURCES });
    const throwing = { ...doc, get actions() { throw new Error('planted'); } };
    const failed = tagger.tagTapeDay({ battle: { agentContext: { archetype: 'momentum_chaser' } }, dialEnabled: true, doc: throwing });
    expect(failed.coverage).toMatchObject({ status: 'unavailable', note: 'stalled unavailable: the tagger failed (Error)', sources: B1_SOURCES });
  });

  it('on a real tape: the fully recorded acceptance day names no evidence source; the same day without records does', async () => {
    expect((await writeFor(await DAYS.acceptance(true))).coverage.tags.sources).toEqual(['checks', 'checks.risk', 'actions', 'checks.stagnation']);
    expect((await writeFor(await DAYS.acceptance(false))).coverage.tags.sources).toEqual(['checks', 'checks.evidence', 'checks.risk', 'actions']);
  });
});

// ── Amendment D RD-7 (review X2-6) — a day whose daily change is not its change since entry ──
// Every other fixture day records the daily change AS the change since entry,
// so a winner test that read the wrong one went unseen there. Here ACN is up on
// the day (+0.5%, a winner) but down since entry (−0.4%); NVDA is down on the
// day (−0.2%) but up since entry (+0.8%). No stagnation fire (exitSeq null).
describe('Amendment D RD-7 (review X2-6) — the daily change and the change since entry differ', () => {
  const DAILY = { ACN: 0.5, NVDA: -0.2 };
  const day = (recorded) => stalledDay({ battleId: 'b-x26', exitSeq: null, recordStagnation: recorded, dailyChangeOf: (sym, seq) => DAILY[sym] ?? quoteOf(sym, seq).priceChange });
  const taggedSyms = (tape) => [...new Set(tape.tags.items.map((i) => i.symbol))].sort();

  it('the fixture records the two changes apart (the precondition)', async () => {
    const fx = await day(true);
    const t4 = fx.ticks.find((tk) => tk.tickSeq === 4);
    expect(t4.risk.stagnation.ACN.dailyPct).toBe(0.005);
    expect(quoteOf('ACN', 4).priceChange / 100).toBe(-0.004);
    expect(t4.risk.stagnation.NVDA.dailyPct).toBe(-0.002);
  });

  it('RECORDED: the winner test reads the daily change — NVDA (down on the day) is stalled, ACN (up on the day) never', async () => {
    const tape = await writeFor(await day(true));
    expect(tape.tags.inputs.holdingBasis).toEqual({ ACN: 'recorded', MSFT: 'recorded', NVDA: 'recorded' });
    expect(tape.tags.inputs.winnerBasis).toEqual({ recorded: 'daily_change', recomputed: 'change_since_entry' });
    expect(taggedSyms(tape)).toEqual(['NVDA']);
  });

  it('RECOMPUTED (the same day without the records): the winner test reads the change since entry — ACN is stalled, NVDA never', async () => {
    const tape = await writeFor(await day(false));
    expect(Object.values(tape.tags.inputs.holdingBasis).every((b) => b === 'recomputed')).toBe(true);
    expect(taggedSyms(tape)).toEqual(['ACN']);
  });

  it('review Y2-2 — MIXED (ACN\'s record missing at one check): recomputed ACN reads the change since entry even where its other checks carry a daily change; recorded NVDA reads the daily change', async () => {
    const fx = await day(true);
    delete fx.ticks.find((tk) => tk.tickSeq === 3).risk.stagnation.ACN;
    const tape = await writeFor(fx);
    expect(tape.tags.inputs.holdingBasis).toEqual({ ACN: 'recomputed', MSFT: 'recorded', NVDA: 'recorded' });
    // ACN's records (+0.5% on the day) would make it a winner; its basis is recomputed, so −0.4% since entry stalls it
    expect(taggedSyms(tape)).toEqual(['ACN', 'NVDA']);
  });
});

// ── Film Room B2, Amendment E RE-1 — coverage on a recorded day ───────────
// RD-5 reads no evidence on a day with no recomputed holding; RE-1 adds that
// such a day sets aside the checks section's ABSENT-ENTRY reason too ("tickMs
// unavailable where the entry is absent", tapeNotes.js ABSENT_ENTRY_REASON):
// every reason that lowers the evidence section also lowers the checks section
// through that one reason, which is about a field the tagger never reads. Every
// other checks reason still counts; a mixed or a fully recomputed day is
// unchanged. The stored checks section itself never moves.
describe('Amendment E RE-1 — a recorded day sets aside the checks section\'s absent-entry reason', () => {
  const DAY = {
    recorded: [1, 2, 3, 4].map((seq) => rrow(seq, (seq - 1) * 15, { rec: { ACN: R(seq) }, px: { ACN: 300 } })),
    mixed: [1, 2, 3, 4].map((seq) => rrow(seq, (seq - 1) * 15, { held: ['ACN', 'MSFT'], rec: { ACN: R(seq) }, px: { ACN: 300, MSFT: 420 } })),
    recomputed: [1, 2, 3, 4].map((seq) => rrow(seq, (seq - 1) * 15, { px: { ACN: 300 + (seq % 2) * 0.01 } })),
  };
  const GAP = '1 minted check of this day has no tick record (minted but not captured): tickSeq 2';
  /** The checks section as tapeAssemble.js writes it for a lost entry: the reason is its note AND its caveat. */
  const lost = { status: 'partial', note: ABSENT_ENTRY_REASON, caveats: [ABSENT_ENTRY_REASON] };
  /** …and for an entry the cap may have evicted: a limit — in the note, not a caveat. */
  const evicted = { status: 'partial', note: ABSENT_ENTRY_REASON, caveats: [] };
  const tagsFor = (checks, checksSection, evidenceStatus) => tagger.tagTapeDay({
    battle: { agentContext: { archetype: 'momentum_chaser' } }, dialEnabled: true,
    doc: { checks, actions: [], coverage: { checks: checksSection, evidence: { status: evidenceStatus } } },
  });

  it('a FULLY RECORDED day whose checks are partial by the absent-entry reason alone (a lost entry) reads complete, no note, no evidence source', () => {
    const r = tagsFor(DAY.recorded, lost, 'partial');
    expect(r.tags.inputs.holdingBasis).toEqual({ ACN: 'recorded' });
    expect(r.coverage).toMatchObject({ status: 'complete', note: null, sources: ['checks', 'checks.risk', 'actions', 'checks.stagnation'] });
    expect(r.tags.items.map((i) => i.tickSeq)).toEqual([3, 4]);
  });

  it('…and by the same reason as a LIMIT (an entry the cap may have evicted): complete too', () => {
    expect(tagsFor(DAY.recorded, evicted, 'partial').coverage).toMatchObject({ status: 'complete', note: null });
  });

  it('a MIXED day (MSFT recomputed) with the same sections is unchanged: unavailable, naming the checks and the evidence', () => {
    const r = tagsFor(DAY.mixed, lost, 'partial');
    expect(r.tags.inputs.holdingBasis).toEqual({ ACN: 'recorded', MSFT: 'recomputed' });
    expect(r.coverage).toMatchObject({
      status: 'unavailable', note: 'stalled unavailable: the checks section is partial; the evidence section is partial',
      sources: ['checks', 'checks.evidence', 'checks.risk', 'actions', 'checks.stagnation'],
    });
  });

  it('a FULLY RECOMPUTED day with the same sections is unchanged: unavailable, naming both', () => {
    const r = tagsFor(DAY.recomputed, lost, 'partial');
    expect(r.tags.inputs.holdingBasis).toEqual({ ACN: 'recomputed' });
    expect(r.coverage).toMatchObject({ status: 'unavailable', note: 'stalled unavailable: the checks section is partial; the evidence section is partial' });
  });

  it('any OTHER checks reason still counts on a recorded day: a gap beside the absent-entry reason, or alone, keeps stalled unavailable', () => {
    const beside = { status: 'partial', note: `${GAP}; ${ABSENT_ENTRY_REASON}`, caveats: [GAP, ABSENT_ENTRY_REASON] };
    expect(tagsFor(DAY.recorded, beside, 'partial').coverage).toMatchObject({ status: 'unavailable', note: 'stalled unavailable: the checks section is partial' });
    const alone = { status: 'partial', note: GAP, caveats: [GAP] };
    expect(tagsFor(DAY.recorded, alone, 'complete').coverage).toMatchObject({ status: 'unavailable', note: 'stalled unavailable: the checks section is partial' });
    // a merged section whose caveat is not in its note still counts
    const caveatOnly = { status: 'partial', note: ABSENT_ENTRY_REASON, caveats: [ABSENT_ENTRY_REASON, GAP] };
    expect(tagsFor(DAY.recorded, caveatOnly, 'partial').coverage).toMatchObject({ status: 'unavailable', note: 'stalled unavailable: the checks section is partial' });
  });

  it('nothing is set aside from silence, or from a section that is not partial', () => {
    expect(tagsFor(DAY.recorded, { status: 'partial', note: null, caveats: [] }, 'complete').coverage).toMatchObject({ status: 'unavailable', note: 'stalled unavailable: the checks section is partial' });
    expect(tagsFor(DAY.recorded, { status: 'unavailable', note: ABSENT_ENTRY_REASON }, 'partial').coverage).toMatchObject({ status: 'unavailable', note: 'stalled unavailable: the checks section is unavailable' });
    expect(tagsFor(DAY.recorded, { status: 'complete', note: null, caveats: [] }, 'partial').coverage).toMatchObject({ status: 'complete' });
  });

  it('statusSettingAside — the reader alone: partial by the set-aside reason(s) only → complete; anything else is the section\'s own status', () => {
    const A = ABSENT_ENTRY_REASON;
    expect(tagger.statusSettingAside({ status: 'partial', note: A, caveats: [A] }, [A])).toBe('complete');
    expect(tagger.statusSettingAside({ status: 'partial', note: A }, [A])).toBe('complete');
    expect(tagger.statusSettingAside({ status: 'partial', note: `${GAP}; ${A}` }, [A])).toBe('partial');
    expect(tagger.statusSettingAside({ status: 'partial', note: A, caveats: [GAP] }, [A])).toBe('partial');
    expect(tagger.statusSettingAside({ status: 'partial', note: null }, [A])).toBe('partial');
    expect(tagger.statusSettingAside({ status: 'partial', note: A }, [])).toBe('partial');
    expect(tagger.statusSettingAside({ status: 'complete', note: null }, [A])).toBe('complete');
    expect(tagger.statusSettingAside({ status: 'unavailable', note: A }, [A])).toBe('unavailable');
    expect(tagger.statusSettingAside(undefined, [A])).toBeUndefined();
  });

  describe('through the real close pass — a recorded day whose tick names an evaluation entry the battle no longer holds', () => {
    /** The day with the live rule's records on every tick, and check 3's evaluation entry lost (not evicted: the array is under its cap). */
    const lostEntryDay = async (over = {}) => {
      const fx = await stalledDay({ battleId: 'b-re1', recordStagnation: true, ...over });
      fx.battle.evaluations = fx.battle.evaluations.filter((e) => e.evalId !== 'b-re1:e3');
      return fx;
    };

    it('the precondition: the checks section is partial by the absent-entry reason ALONE, the evidence section partial, every holding recorded', async () => {
      const tape = await writeFor(await lostEntryDay());
      expect(tape.coverage.checks).toMatchObject({ status: 'partial', note: ABSENT_ENTRY_REASON, caveats: [ABSENT_ENTRY_REASON] });
      expect(tape.coverage.evidence.status).toBe('partial');
      expect(Object.values(tape.tags.inputs.holdingBasis).every((b) => b === 'recorded')).toBe(true);
    });

    it('RE-1: stalled reads complete — the items stand, no evidence source, and the stored checks section itself is untouched', async () => {
      const tape = await writeFor(await lostEntryDay());
      expect(tape.coverage.tags).toMatchObject({ status: 'complete', note: null, sources: ['checks', 'checks.risk', 'actions', 'checks.stagnation'] });
      expect(tape.tags.items.length).toBeGreaterThan(0);
      expect(tape.coverage.checks.status).toBe('partial');
    });

    it('the same day MIXED (ACN\'s record missing at one check): unchanged — unavailable, naming the checks and the evidence', async () => {
      const fx = await lostEntryDay();
      delete fx.ticks.find((tk) => tk.tickSeq === 4).risk.stagnation.ACN;
      const tape = await writeFor(fx);
      expect(tape.tags.inputs.holdingBasis.ACN).toBe('recomputed');
      // the recomputed holding's count pauses at the priceless check too: the note says so after the two sections
      expect(tape.coverage.tags.status).toBe('unavailable');
      expect(tape.coverage.tags.note).toMatch(/^stalled unavailable: the checks section is partial; the evidence section is partial(; the count pauses at 1 check that carries no price for a held stock)?$/);
    });

    it('the same day with a SECOND checks reason (no evaluation-run records, so deferrals cannot be listed): still unavailable, naming the checks', async () => {
      const fx = await lostEntryDay();
      fx.runs = [];
      const tape = await writeFor(fx);
      expect(Object.values(tape.tags.inputs.holdingBasis).every((b) => b === 'recorded')).toBe(true);
      expect(tape.coverage.checks.note).toContain(ABSENT_ENTRY_REASON);
      expect(tape.coverage.checks.note).not.toBe(ABSENT_ENTRY_REASON);
      expect(tape.coverage.tags).toMatchObject({ status: 'unavailable', note: 'stalled unavailable: the checks section is partial' });
    });

    it('a refresh of a day stored before RE-1 moves coverage.tags from unavailable to complete and nothing else (Amendment G RG-10, criterion 9)', async () => {
      const fx = await lostEntryDay();
      const t = makeTapeDb(seedDay({}, fx));
      await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: NOW });
      const path = tapePath(fx);
      const before = structuredClone(t.store.get(path));
      // the "stored before RE-1" day is the CURRENT writer's output with coverage.tags overridden to what B1.1 stored
      // (the checks' partial status counted) — a movement check of the refresh, not a pre-RE-1 fixture (review L4-12)
      before.coverage.tags = { ...before.coverage.tags, status: 'unavailable', note: 'stalled unavailable: the checks section is partial' };
      t.store.set(path, before);
      const r = await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: NOW + 60_000 });
      expect(r.status).toBe('written');
      const after = t.store.get(path);
      expect(after.coverage.tags).toMatchObject({ status: 'complete', note: null });
      const strip = (d) => { const c = structuredClone(d); delete c.coverage.tags; delete c.writtenAt; delete c.runCount; delete c.passes.close.writtenAt; return c; };
      expect(stableStringify(strip(after))).toBe(stableStringify(strip(before)));
    });
  });
});
