// api/_utils/practiceField/corporateActionSequences.late.test.js
//
// Practice Field T1a-2b-4 — S-6 EXTENDED: LATE AND CORRECTED DATA (the build prompt, §6). The late generator
// (__testsupport__/caSequences.js generateLate) writes histories with late listings after a sale, late splits before paid
// dividends, settled-id revisions and parse rejections, on one id and one ledger, through the real close, sales, catch-up
// and founder action — I-1 to I-5 after every close and its re-run, and I-6 (caOracle.js EntitlementOracle): every ledger's
// received cash for an unambiguous id, its adjustments included, equals what the inputs and its holding history say it
// was owed. Astra's four reproductions run as fixed cases.
//
// PF_LATE_FROM, PF_LATE_COUNT, PF_LATE_OUT run a seed range (the soak) and write its coverage; without them a fixed range
// of 40 seeds runs in every suite.

import { describe, it, expect, afterAll } from 'vitest';
import { writeFileSync } from 'node:fs';
import { generateLate, run, installSequenceHooks, FIXED_LATE, LATE_KINDS } from './__testsupport__/caSequences.js';

installSequenceHooks();

const FROM = Number(process.env.PF_LATE_FROM || 1911240000);
const COUNT = Number(process.env.PF_LATE_COUNT || 40);
const OUT = process.env.PF_LATE_OUT || null;
const SEEDS = Array.from({ length: COUNT }, (_, k) => FROM + k);
const stats = { from: FROM, count: COUNT, sequences: 0, closes: 0, sessions: 0, kinds: {}, pairs: {}, failures: [], i6: { checked: 0, excused: 0, nothingOwed: 0, byKind: {} }, adjustments: {}, sold: 0 };

describe('S-6 extended — Astra\'s T2D-03, 04, 05 and 12 as fixed cases, I-1 to I-6 after every close', () => {
  it.each(FIXED_LATE.map((p) => [p.seed, p]))('%s', async (_seed, plan) => {
    const { entitlement } = await run(plan);
    expect(entitlement.checked).toBeGreaterThan(0); // I-6 looked at something
  }, 60_000);
});

describe('S-6 extended — late generated histories: I-1 to I-6 after every close', () => {
  it.each(SEEDS)('late seed %i', async (seed) => {
    const plan = generateLate(seed);
    for (const k of plan.kinds) stats.kinds[k] = (stats.kinds[k] || 0) + 1;
    for (let a = 0; a < plan.kinds.length; a += 1) for (let b = a + 1; b < plan.kinds.length; b += 1) {
      const key = [plan.kinds[a], plan.kinds[b]].sort().join(' + ');
      stats.pairs[key] = (stats.pairs[key] || 0) + 1;
    }
    try {
      const { idea, closes, entitlement, soldAt } = await run(plan);
      stats.closes += closes;
      if (soldAt !== null) stats.sold += 1;
      stats.i6.checked += entitlement.checked;
      stats.i6.excused += entitlement.excused;
      stats.i6.nothingOwed += entitlement.nothingOwed;
      for (const [k, v] of Object.entries(entitlement.byKind)) stats.i6.byKind[k] = (stats.i6.byKind[k] || 0) + v;
      for (const f of ['ledger', 'comparisonLedger', 'spyLedger']) {
        for (const a of idea[f]?.adjustments || []) { const k = `${f}:${a.kind}${a.held ? ':held' : ''}`; stats.adjustments[k] = (stats.adjustments[k] || 0) + 1; }
      }
    } catch (e) {
      stats.failures.push({ seed, message: String(e?.message || e).slice(0, 400) });
      throw e;
    } finally {
      stats.sequences += 1;
      stats.sessions += plan.steps.filter((s) => s.kind === 'close').length;
    }
  }, 120_000);

  afterAll(() => {
    if (OUT) writeFileSync(OUT, JSON.stringify(stats, null, 1));
    // Without a range: the fixed seeds reach every chain kind (so the classes are exercised in every suite).
    if (!process.env.PF_LATE_FROM) for (const k of ['sale', 'late_after_sale', 'late_split', 'settled_revision_split', 'settled_revision_dividend', 'ruled_correction', 'parse_rejection', 'parse_missing']) expect(stats.kinds[k] ?? 0, k).toBeGreaterThan(0);
    expect(LATE_KINDS.length).toBeGreaterThan(10);
  });
});
