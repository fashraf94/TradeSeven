// api/_utils/practiceField/corporateActionSequences.soak.test.js
//
// Practice Field T1a-2b-3, fix round 2 — THE S-6 SOAK (Amendment F revision 1, S-6, as the founder specified it): thousands
// of randomly generated histories, up to 15 sessions each, across the three ledger kinds (the idea's own AAPL; its
// comparison's AAPL, same-stock or a frozen basket; the SPY line's SPY), each driven through the real close, catch-up and
// founder action with I-1 to I-5 checked after every close (the shared harness: __testsupport__/caSequences.js).
//
// It runs a seed range given by the environment — PF_SOAK_FROM, PF_SOAK_COUNT, and PF_SOAK_OUT (where it writes the
// coverage: the event kinds and pairs of kinds each history contained, the product paths it reached, the closes checked).
// Without them it runs a small fixed range, so the wide generator is exercised in every suite.
//
// Final fix (Astra's round 2): PF_SOAK_ORDERED=1 runs the ORDERED generator (generateWide with `ordered`: one chain of
// ordered events on one id per history — C03, D01, D02). Every history is also checked by the independent oracle
// (__testsupport__/caOracle.js), and the coverage now has a second table: ORDERED PAIRS OF EVENTS ON ONE ID AND ONE LEDGER
// (`orderedPairs`), beside the kind-label pairs, with the named shapes reached on one id and the oracle's carve-outs.

import { describe, it, expect, afterAll } from 'vitest';
import { writeFileSync } from 'node:fs';
import { generateWide, run, installSequenceHooks, pathsReached, WIDE_KINDS } from './__testsupport__/caSequences.js';

installSequenceHooks();

const FROM = Number(process.env.PF_SOAK_FROM || 900001);
const COUNT = Number(process.env.PF_SOAK_COUNT || 4);
const OUT = process.env.PF_SOAK_OUT || null;
const ORDERED = process.env.PF_SOAK_ORDERED === '1';
const SEEDS = Array.from({ length: COUNT }, (_, k) => FROM + k);

const stats = { from: FROM, count: COUNT, ordered: ORDERED, sequences: 0, closes: 0, sessions: 0, clean: 0, kinds: {}, pairs: {}, reached: {}, failures: [], orderedPairs: {}, shapes: { c03: 0, d01: 0, d02: 0 }, chains: {}, carveOuts: 0, carvedSeeds: [], founderExcused: 0, founderExcusedSeeds: [] };
// The ledgers' symbols the events can reach: the idea's and the comparison's AAPL (same-stock or a basket), the SPY line's SPY.
const LEDGER_SYMBOLS = { idea: ['AAPL'], comparison: ['AAPL'], spy: ['SPY'] };

describe('S-6 soak — wide generated histories, three ledger kinds, up to 15 sessions: I-1 to I-5 after every close', () => {
  it.each(SEEDS)('wide seed %i', async (seed) => {
    const plan = generateWide(seed, { ordered: ORDERED });
    if (plan.chain) { const k = plan.chain.kind + (plan.chain.variant ? '/' + plan.chain.variant : ''); stats.chains[k] = (stats.chains[k] || 0) + 1; }
    const base = plan.kinds.filter((k) => !k.includes(':'));
    for (const k of plan.kinds) stats.kinds[k] = (stats.kinds[k] || 0) + 1;
    for (let a = 0; a < base.length; a += 1) for (let b = a + 1; b < base.length; b += 1) {
      const key = [base[a], base[b]].sort().join(' + ');
      stats.pairs[key] = (stats.pairs[key] || 0) + 1;
    }
    try {
      const { idea, closes, inputs } = await run(plan);
      stats.closes += closes;
      pathsReached(idea, stats.reached);
      for (const [k, v] of Object.entries(inputs.orderedPairs(LEDGER_SYMBOLS))) stats.orderedPairs[k] = (stats.orderedPairs[k] || 0) + v;
      for (const [k, v] of Object.entries(inputs.shapes())) stats.shapes[k] += v > 0 ? 1 : 0;
      if (inputs.carveOuts > 0) { stats.carveOuts += inputs.carveOuts; stats.carvedSeeds.push(seed); }
      // (The re-dates through a founder split account that the as-built T2D-11 exception excused — counted, not hidden.)
      if (inputs.founderExcused > 0) { stats.founderExcused += inputs.founderExcused; stats.founderExcusedSeeds.push(seed); }
    } catch (e) {
      stats.failures.push({ seed, message: String(e?.message || e).slice(0, 400) });
      throw e;
    } finally {
      stats.sequences += 1;
      stats.sessions += plan.steps.filter((s) => s.kind === 'close' || s.kind === 'catchup').length;
      if (plan.clean) stats.clean += 1;
    }
  }, 120_000);

  it('the generator\'s event kinds are all its own (a coverage table can name each)', () => {
    for (const k of Object.keys(stats.kinds)) {
      const base = k.includes(':') ? k.split(':')[1] : k;
      expect([...WIDE_KINDS, 'comparison_same_stock', 'comparison_frozen_basket']).toContain(base);
    }
  });
});

afterAll(() => { if (OUT) writeFileSync(OUT, JSON.stringify(stats, null, 1)); });
