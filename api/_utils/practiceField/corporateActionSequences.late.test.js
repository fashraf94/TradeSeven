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
// of 40 seeds runs in every suite. (T1a-2b-4 fix round: PF_LATE_SHAPES=1 draws the shapes Astra found missing — generateLate
// `shapes` — with the founder's decisions on late proposals, and records each history's ordered events on one id and one
// ledger; 36 shape seeds run in every suite. PF_LATE_SHAPES=2 draws the independent refuter's shapes instead — generateLate
// `refuter` — and 18 of its seeds run in every suite.)

import { describe, it, expect, afterAll } from 'vitest';
import { writeFileSync } from 'node:fs';
import { generateLate, run, installSequenceHooks, FIXED_LATE, LATE_KINDS, LATE_SOAK_SEEDS, LATE_SHAPES, REFUTER_SHAPES } from './__testsupport__/caSequences.js';

installSequenceHooks();

const FROM = Number(process.env.PF_LATE_FROM || 1911240000);
const COUNT = Number(process.env.PF_LATE_COUNT || 40);
const OUT = process.env.PF_LATE_OUT || null;
const SHAPES = process.env.PF_LATE_SHAPES === '1';
const REFUTER = process.env.PF_LATE_SHAPES === '2';
const SEEDS = Array.from({ length: COUNT }, (_, k) => FROM + k);
const stats = { from: FROM, count: COUNT, shapes: SHAPES, refuter: REFUTER, sequences: 0, closes: 0, sessions: 0, kinds: {}, pairs: {}, failures: [], i6: { checked: 0, excused: 0, waiting: 0, nothingOwed: 0, byKind: {} }, i7: 0, i7refusal: 0, adjustments: {}, sold: 0, byShape: {}, ordered: {}, orderedByShape: {}, reach: {}, decisions: {} };

/** The product paths a finished shape history reached (counted per shape). */
function reachOf(idea) {
  const L = ['ledger', 'comparisonLedger', 'spyLedger'].map((f) => idea[f]).filter(Boolean);
  const recs = L.flatMap((l) => l.corporateActionReceipts || []);
  const hit = {};
  if (recs.some((r) => r.reason === 'possible_redate' && r.closedHolding)) hit.closed_holding_redate = 1;
  if (L.some((l) => (l.closedOutsideRows || []).length > 0)) hit.outside_rows_kept = 1;
  if (recs.some((r) => (r.kinds || []).includes('same_date_share_basis'))) hit.same_date_share_basis = 1;
  if (recs.some((r) => r.recount)) hit.dated_recount = 1;
  if (L.some((l) => l.closedCoverageDoubts)) hit.closed_coverage_doubt = 1;
  const props = L.flatMap((l) => l.lateProposals || []);
  if (props.length > 0) hit.proposed = 1;
  if (props.some((p) => p.status === 'posted')) hit.posted_on_approval = 1;
  if (props.some((p) => p.status === 'declined')) hit.declined = 1;
  if (props.some((p) => (p.blockers || []).some((b) => b.startsWith('id_unresolved')))) hit.blocked_id_unresolved = 1;
  if (props.some((p) => (p.blockers || []).some((b) => b.startsWith('pairs_with')))) hit.blocked_pairs = 1;
  if (props.some((p) => (p.blockers || []).some((b) => b.startsWith('share_basis')))) hit.blocked_share_basis = 1;
  if (props.some((p) => (p.blockers || []).some((b) => b.startsWith('date_uncovered')))) hit.blocked_uncovered = 1;
  if ((idea.standingQualityReasons || []).length > 0) hit.standing_reason = 1;
  // (The refuter's: a late entitlement's proposal whose id became an ambiguity; a paid dividend's late_basis a candidate paired with.)
  if (props.some((p) => p.kind === 'late_entitlement' && recs.some((r) => r.reason === 'possible_redate' && r.actionId === p.actionId))) hit.proposal_became_ambiguity = 1;
  if (props.some((p) => p.kind === 'late_basis' && (p.blockers || []).some((b) => b.startsWith('pairs_with')))) hit.late_basis_blocked_pairs = 1;
  return hit;
}

describe('S-6 extended — Astra\'s T2D-03, 04, 05 and 12 as fixed cases, I-1 to I-6 after every close', () => {
  it.each(FIXED_LATE.map((p) => [p.seed, p]))('%s', async (_seed, plan) => {
    const { entitlement } = await run(plan);
    expect(entitlement.checked).toBeGreaterThan(0); // I-6 looked at something
  }, 60_000);
});

describe('S-6 extended — the late soak findings, kept as fixed seeds', () => {
  it.each(LATE_SOAK_SEEDS)('late soak seed %i', async (seed) => { await run(generateLate(seed)); }, 60_000);
});

describe('S-6 extended — late generated histories: I-1 to I-6 after every close', () => {
  it.each(SEEDS)('late seed %i', async (seed) => {
    const plan = generateLate(seed, { shapes: SHAPES, refuter: REFUTER });
    for (const k of plan.kinds) stats.kinds[k] = (stats.kinds[k] || 0) + 1;
    for (let a = 0; a < plan.kinds.length; a += 1) for (let b = a + 1; b < plan.kinds.length; b += 1) {
      const key = [plan.kinds[a], plan.kinds[b]].sort().join(' + ');
      stats.pairs[key] = (stats.pairs[key] || 0) + 1;
    }
    try {
      const { idea, closes, entitlement, soldAt, inputs } = await run(plan);
      stats.closes += closes;
      stats.i6.waiting += entitlement.waiting;
      stats.i7 += entitlement.authorityChecks;
      stats.i7refusal += entitlement.refusalChecks || 0;
      if (plan.shape) {
        stats.byShape[plan.shape] = (stats.byShape[plan.shape] || 0) + 1;
        const reach = reachOf(idea);
        for (const k of Object.keys(reach)) { stats.reach[plan.shape] = stats.reach[plan.shape] || {}; stats.reach[plan.shape][k] = (stats.reach[plan.shape][k] || 0) + 1; }
        const ledgerSymbols = { ledger: ['AAPL'], comparisonLedger: plan.comparison?.type === 'sector_fund' ? [] : ['AAPL'], spyLedger: ['SPY'] };
        const pairs = inputs.orderedPairs(ledgerSymbols);
        stats.orderedByShape[plan.shape] = stats.orderedByShape[plan.shape] || {};
        for (const [k, v] of Object.entries(pairs)) { stats.ordered[k] = (stats.ordered[k] || 0) + v; stats.orderedByShape[plan.shape][k] = (stats.orderedByShape[plan.shape][k] || 0) + v; }
        for (const r of inputs.rulings) if (r.body?.kind === 'late_adjustment') { const k = `${r.body.decision}:${r.status}`; stats.decisions[k] = (stats.decisions[k] || 0) + 1; }
      }
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
    if (SHAPES) for (const sh of LATE_SHAPES) expect(stats.byShape[sh] ?? 0, sh).toBeGreaterThan(0);
    if (REFUTER) for (const sh of REFUTER_SHAPES) expect(stats.byShape[sh] ?? 0, sh).toBeGreaterThan(0);
    // Without a range: the fixed seeds reach every chain kind (so the classes are exercised in every suite).
    if (!process.env.PF_LATE_FROM) for (const k of ['sale', 'late_after_sale', 'late_split', 'settled_revision_split', 'settled_revision_dividend', 'ruled_correction', 'parse_rejection', 'parse_missing']) expect(stats.kinds[k] ?? 0, k).toBeGreaterThan(0);
    expect(LATE_KINDS.length).toBeGreaterThan(10);
  });
});

// T1a-2b-4 fix round: 36 shape histories in every suite (each of the six shapes Astra found missing is drawn), with the
// founder's decisions on late proposals, I-1 to I-7 after every close.
const SHAPE_SEEDS = Array.from({ length: 36 }, (_, k) => 2119990000 + k);
describe('S-6 extended — the shapes Astra found missing (T2E-01 to T2E-08), every close checked I-1 to I-7', () => {
  const seen = {};
  it.each(SHAPE_SEEDS)('shape seed %i', async (seed) => {
    const plan = generateLate(seed, { shapes: true });
    seen[plan.shape] = (seen[plan.shape] || 0) + 1;
    await run(plan);
  }, 120_000);
  afterAll(() => { for (const sh of LATE_SHAPES) expect(seen[sh] ?? 0, sh).toBeGreaterThan(0); });
});

// T1a-2b-4 fix round: 18 histories of the independent refuter's shapes in every suite (each drawn), the founder's approval
// asked for after the close that made the proposal, I-1 to I-7 — I-7 with L-2 at posting — after every close.
const REFUTER_SEEDS = Array.from({ length: 18 }, (_, k) => 2120990000 + k);
// (The refuter-shape probe's findings, kept: a ruling covers only the ledgers whose record it covers — the comparison, still
// holding the stock, keeps a dividend it was paid before the idea's sold holding found the id ambiguous — T2D-09.)
const REFUTER_SOAK_SEEDS = [2121900008, 2121900051, 2121900062, 2121900069, 2121900154, 2121900278];
describe('S-6 extended — the independent refuter\'s shapes (R-1, R-1b, R-3), every close checked I-1 to I-7', () => {
  const seen = {};
  it.each(REFUTER_SEEDS)('refuter shape seed %i', async (seed) => {
    const plan = generateLate(seed, { refuter: true });
    seen[plan.shape] = (seen[plan.shape] || 0) + 1;
    await run(plan);
  }, 120_000);
  it.each(REFUTER_SOAK_SEEDS)('refuter probe seed %i', async (seed) => { await run(generateLate(seed, { refuter: true })); }, 120_000);
  afterAll(() => { for (const sh of REFUTER_SHAPES) expect(seen[sh] ?? 0, sh).toBeGreaterThan(0); });
});
