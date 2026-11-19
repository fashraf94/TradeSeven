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

import { describe, it, expect, afterAll } from 'vitest';
import { writeFileSync } from 'node:fs';
import { generateWide, run, installSequenceHooks, pathsReached, WIDE_KINDS } from './__testsupport__/caSequences.js';

installSequenceHooks();

const FROM = Number(process.env.PF_SOAK_FROM || 900001);
const COUNT = Number(process.env.PF_SOAK_COUNT || 4);
const OUT = process.env.PF_SOAK_OUT || null;
const SEEDS = Array.from({ length: COUNT }, (_, k) => FROM + k);

const stats = { from: FROM, count: COUNT, sequences: 0, closes: 0, sessions: 0, clean: 0, kinds: {}, pairs: {}, reached: {}, failures: [] };

describe('S-6 soak — wide generated histories, three ledger kinds, up to 15 sessions: I-1 to I-5 after every close', () => {
  it.each(SEEDS)('wide seed %i', async (seed) => {
    const plan = generateWide(seed);
    const base = plan.kinds.filter((k) => !k.includes(':'));
    for (const k of plan.kinds) stats.kinds[k] = (stats.kinds[k] || 0) + 1;
    for (let a = 0; a < base.length; a += 1) for (let b = a + 1; b < base.length; b += 1) {
      const key = [base[a], base[b]].sort().join(' + ');
      stats.pairs[key] = (stats.pairs[key] || 0) + 1;
    }
    try {
      const { idea, closes } = await run(plan);
      stats.closes += closes;
      pathsReached(idea, stats.reached);
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
