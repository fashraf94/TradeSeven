// api/_utils/wireEditorialRun.test.js
// Phase 2 N3 — the editorial run lifecycle. Matrix rows:
//   P2-9  — rerun = manifest reuse: grow the frame after deferral → the
//           resume replays the PERSISTED sample; re-derivation fails here.
//   P2-12 — aggregates recomputable from audit rows; a mutated row is
//           detected.
//   P2-13 — immutable runs: a failed run stays intact; the retry is a NEW
//           runId.
//   P2-14 — gateEligible epoch homogeneity, one fault per INJECTABLE epoch
//           input (generationVersion · continuityEnabled · schemaVersion ·
//           digestRendererVersion · validatorVersion). KNOWN HOLES,
//           recorded per F-M10: adapterVersion, reviewVersion, and
//           judgeModelId are run-level constants — they cannot vary WITHIN
//           a run, so a mixed-value fault is unconstructible; their epoch
//           discipline is carried by the run record instead (F-M3 fixes
//           them across the two qualifying periods).
//   P2-17 — judge failure isolation: a thrown judge → terminal 'failed',
//           NO partial memo, no canonical.
//   P2-34 — filing-week guard: a resume found from the NEXT week's slot
//           files under the ORIGINAL captured isoWeek.
//   P2-37 — runs-map integrity: terminal runs reject writes; pruning takes
//           failed/insufficient first and never a complete run; cap 5.
// Plus the N3.4 verdict table (threshold/floor/critical clauses) at the
// pure level.

import { describe, it, expect, beforeEach } from 'vitest';
import { createFirestoreFake } from './__fixtures__/wireFirestoreFake.js';
import {
  runEditorialReview,
  createEditorialRun,
  completeEditorialRun,
  executeEditorialRun,
  computeEditorialAggregates,
  verifyEditorialAggregates,
  computeEditorialVerdict,
  assessEpochHomogeneity,
  renderEditorialMemo,
  EDITORIAL_MIN_BUDGET_MS,
} from './wireEditorialRun.js';
import { EDITORIAL_JUDGE_TOOL } from './wireEditorialJudge.js';
import { WIRE_SCHEMA_VERSION, WIRE_DIGEST_RENDERER_VERSION } from './wireContracts.js';

// ── Week fixtures: 2026-W31 (Mon Jul 27 – Fri Jul 31), slot Sunday Aug 2 ──
const SLOT_SUNDAY = new Date('2026-08-02T18:00:00Z');
const NEXT_SUNDAY = new Date('2026-08-09T18:00:00Z');
const WEEK = '2026-W31';
const FAR_DEADLINE = () => Date.now() + 600_000;

const wireEntry = (storyId, reporter, eventType, { ticker = 'NVDA', publishedAt, epochOver = {} } = {}) => ({
  storyId, reporter, headline: `H ${storyId}`,
  publishedAt: publishedAt ?? '2026-07-28T18:00:00Z',
  validatorVersion: '1.6.0', quarantined: false,
  generationConfig: {
    generationVersion: epochOver.generationVersion ?? 8,
    continuityEnabled: epochOver.continuityEnabled ?? false,
  },
  agentFacts: {
    eventType, tickers: ticker ? [ticker] : [], primaryTicker: ticker ?? null,
    offUniverseTickers: [], subjectRef: null, direction: 'up',
    magnitude: { value: 3.1, unit: 'pct', basis: 'price_vs_prior_close' },
    figures: [], qualifiers: [], digest: `${storyId} digest.`, chainId: storyId,
    schemaVersion: epochOver.schemaVersion ?? WIRE_SCHEMA_VERSION,
    digestRendererVersion: epochOver.digestRendererVersion ?? WIRE_DIGEST_RENDERER_VERSION,
    validatorVersion: epochOver.validatorVersion ?? '1.6.0',
  },
});

const moverStory = (percentChange = 3.1) => ({
  headline: 'Mover story', body: 'Shares moved on volume.', primaryTicker: 'NVDA',
  dataSnapshot: { price: 150, change: 4.5, percentChange, atrMultiple: 2.0, direction: 'up' },
});

const printStory = () => ({
  headline: 'CPI print', body: 'Inflation came in above expectations.', primaryTicker: null,
  dataSnapshot: { eventName: 'CPI m/m', category: 'inflation', actual: '0.4%', estimate: '0.3%', previous: '0.2%', impact: 'high', spy: null, qqq: null },
});

/** Seed a healthy W31: 5 alex movers + 2 neta prints (S2+S3 → floor met). */
async function seedWeek(db, { entryTweak = (e) => e } = {}) {
  const dates = ['2026-07-27', '2026-07-28', '2026-07-29', '2026-07-30', '2026-07-31'];
  const alexIds = dates.map((d, i) => `mover-${i}`);
  const netaIds = ['print-0', 'print-1'];

  for (let i = 0; i < dates.length; i++) {
    const entries = [entryTweak(wireEntry(alexIds[i], 'alex', 'market_mover', { publishedAt: `${dates[i]}T18:00:00Z` }), i)];
    if (i < 2) {
      const neta = wireEntry(netaIds[i], 'neta', 'econ_print', { ticker: null, publishedAt: `${dates[i]}T13:00:00Z` });
      neta.agentFacts.subjectRef = 'CPI';
      neta.agentFacts.magnitude = { value: 0.1, unit: 'pct', basis: 'print_vs_expected' };
      entries.push(entryTweak(neta, 10 + i));
    }
    await db.collection('fantasyTimesWire').doc(dates[i]).set({ date: dates[i], entries });
  }
  for (const id of alexIds) await db.collection('fantasyTimesStories').doc(id).set(moverStory());
  for (const id of netaIds) await db.collection('fantasyTimesStories').doc(id).set(printStory());
  return { alexIds, netaIds };
}

/** A judge that answers every chunk correctly (empty flags). */
const okJudge = async (_execution, content) => {
  const ids = content.messages[0].content.match(/Return every id exactly once: ([^\n]*)/)[1].split(', ');
  return {
    response: {
      stop_reason: 'tool_use', usage: { input_tokens: 1, output_tokens: 1 },
      content: [{ type: 'tool_use', name: EDITORIAL_JUDGE_TOOL.name, input: { reviews: ids.map((storyId) => ({ storyId, flags: [] })) } }],
    },
  };
};

let db;
beforeEach(() => {
  db = createFirestoreFake();
});

const weekDoc = async () => (await db.collection('wireEditorial').doc(WEEK).get()).data();

// ── Happy path ─────────────────────────────────────────────────────────────
describe('the Sunday run — end to end', () => {
  it('samples the week, verifies deterministically, judges, and lands a canonical PASS run', async () => {
    await seedWeek(db);
    const out = await runEditorialReview(db, { now: SLOT_SUNDAY, deadline: FAR_DEADLINE(), callModel: okJudge });
    expect(out).toMatchObject({ action: 'ran', isoWeek: WEEK, status: 'complete', passed: true, gateEligible: true });

    const doc = await weekDoc();
    expect(doc.scheduledSlotDate).toBe('2026-08-02');
    expect(doc.canonicalRunId).toBe('run-001');
    const run = doc.runs['run-001'];
    expect(run.status).toBe('complete');
    expect(run.manifest.sample).toHaveLength(7);
    expect(run.aggregates).toMatchObject({ sampled: 7, verifiedCount: 7, verifiedWrong: 0 });
    expect(run.aggregates.contributingShapes).toEqual(['S2', 'S3']);
    expect(run.verdict).toMatchObject({ passed: true, gateEligible: true });
    expect(run.gateEpoch).toMatchObject({ generationVersion: 8, schemaVersion: WIRE_SCHEMA_VERSION });
    expect(run.memo).toContain('PASS');
    expect(run.judge.judgeModelId).toBe('claude-sonnet-4-6');
    // P2-12 (live): the stored aggregates recompute from the stored rows.
    expect(verifyEditorialAggregates(run).ok).toBe(true);
  });

  it('a VERIFIED_WRONG mover fails the 5% threshold but stays gateEligible (floor met, judge complete)', async () => {
    await seedWeek(db, {
      entryTweak: (e) => {
        if (e.storyId === 'mover-0') e.agentFacts.magnitude = { value: 4.9, unit: 'pct', basis: 'price_vs_prior_close' };
        return e;
      },
    });
    const out = await runEditorialReview(db, { now: SLOT_SUNDAY, deadline: FAR_DEADLINE(), callModel: okJudge });
    expect(out).toMatchObject({ status: 'complete', passed: false, gateEligible: true });
    const run = (await weekDoc()).runs['run-001'];
    expect(run.aggregates.verifiedWrong).toBe(1);
    expect(run.verdict.failureClauses).toContain('derivation_rate'); // 1/7 ≈ 14%
  });
});

// ── P2-9: manifest reuse across frame growth ───────────────────────────────
describe('P2-9 — a resumed run replays the persisted manifest', () => {
  it('budget deferral → frame grows → resume judges EXACTLY the original sample', async () => {
    await seedWeek(db);
    // First attempt: deadline too tight for any judge call → manifest
    // persisted, run pending, deferred mid-run.
    const first = await runEditorialReview(db, { now: SLOT_SUNDAY, deadline: Date.now() + 1_000, callModel: okJudge });
    expect(first.action).toBe('deferred_mid_run');
    const pendingRun = (await weekDoc()).runs['run-001'];
    expect(pendingRun.status).toBe('pending_judge');
    const originalSample = pendingRun.manifest.sample.map((s) => s.storyId).sort();

    // A late replay lands a NEW entry in the reviewed week (frame growth).
    const day = (await db.collection('fantasyTimesWire').doc('2026-07-29').get()).data();
    await db.collection('fantasyTimesWire').doc('2026-07-29').set({
      ...day, entries: [...day.entries, wireEntry('late-replay', 'alex', 'market_mover', { publishedAt: '2026-07-29T19:00:00Z' })],
    });
    await db.collection('fantasyTimesStories').doc('late-replay').set(moverStory());

    // Resume: the judge must see the ORIGINAL ids — never a re-derived set.
    const judgedIds = [];
    const spyJudge = async (e, content) => {
      judgedIds.push(...content.messages[0].content.match(/Return every id exactly once: ([^\n]*)/)[1].split(', '));
      return okJudge(e, content);
    };
    const second = await runEditorialReview(db, { now: SLOT_SUNDAY, deadline: FAR_DEADLINE(), callModel: spyJudge });
    expect(second).toMatchObject({ action: 'resumed', status: 'complete' });
    expect(judgedIds.sort()).toEqual(originalSample);
    expect(judgedIds).not.toContain('late-replay');
    const run = (await weekDoc()).runs['run-001'];
    expect(run.manifest.sample.map((s) => s.storyId).sort()).toEqual(originalSample);
  });
});

// ── P2-34: filing-week guard ───────────────────────────────────────────────
describe('P2-34 — a resume found from a LATER slot files under the original week', () => {
  it('W31 pending run resumed on the NEXT Sunday completes under 2026-W31, not 2026-W32', async () => {
    await seedWeek(db);
    const first = await runEditorialReview(db, { now: SLOT_SUNDAY, deadline: Date.now() + 1_000, callModel: okJudge });
    expect(first.action).toBe('deferred_mid_run');

    const out = await runEditorialReview(db, { now: NEXT_SUNDAY, deadline: FAR_DEADLINE(), callModel: okJudge });
    expect(out).toMatchObject({ action: 'resumed', isoWeek: WEEK, status: 'complete' });

    const w31 = await weekDoc();
    expect(w31.canonicalRunId).toBe('run-001');
    expect(w31.scheduledSlotDate).toBe('2026-08-02'); // the CAPTURED slot, never re-derived
    const w32 = await db.collection('wireEditorial').doc('2026-W32').get();
    expect(w32.exists).toBe(false); // nothing filed under the later week
  });
});

// ── P2-13 / P2-17: failure isolation + retry identity ─────────────────────
describe('P2-13 + P2-17 — judge failure → terminal failed run; retry is a NEW runId', () => {
  it('a thrown judge terminates the run with NO partial memo and no canonical; the next tick starts run-002; run-001 stays intact', async () => {
    await seedWeek(db);
    const boom = async () => { throw new Error('sonnet 500'); };
    const first = await runEditorialReview(db, { now: SLOT_SUNDAY, deadline: FAR_DEADLINE(), callModel: boom });
    expect(first).toMatchObject({ action: 'failed', runId: 'run-001' });

    let doc = await weekDoc();
    expect(doc.canonicalRunId).toBeNull();
    expect(doc.runs['run-001'].status).toBe('failed');
    expect(doc.runs['run-001'].failure).toMatchObject({ code: 'judge_error' });
    expect(doc.runs['run-001'].memo).toBeUndefined();      // no partial memo (P2-17)
    expect(doc.runs['run-001'].auditRows).toBeUndefined(); // no partial evidence

    const second = await runEditorialReview(db, { now: SLOT_SUNDAY, deadline: FAR_DEADLINE(), callModel: okJudge });
    expect(second).toMatchObject({ action: 'ran', runId: 'run-002', status: 'complete' });
    doc = await weekDoc();
    expect(doc.canonicalRunId).toBe('run-002');
    expect(doc.runs['run-001'].status).toBe('failed');     // prior run byte-intact (P2-13)
    expect(Object.keys(doc.runs).sort()).toEqual(['run-001', 'run-002']);

    // Canonical set → every later Sunday is a no-op.
    const third = await runEditorialReview(db, { now: SLOT_SUNDAY, deadline: FAR_DEADLINE(), callModel: okJudge });
    expect(third).toMatchObject({ action: 'done', canonicalRunId: 'run-002' });
  });
});

// ── Review fix (LOW): honest return when a concurrent tick wins ───────────
describe('concurrent-race honesty — a lost race reports superseded, not a false complete', () => {
  it('re-executing an already-terminal run returns superseded_by_concurrent_run (immutability preserved, no double-write)', async () => {
    await seedWeek(db);
    const first = await runEditorialReview(db, { now: SLOT_SUNDAY, deadline: FAR_DEADLINE(), callModel: okJudge });
    expect(first).toMatchObject({ action: 'ran', runId: 'run-001', status: 'complete' });
    const canonicalBefore = (await weekDoc()).runs['run-001'];

    // Simulate the second, slower concurrent tick: it ran its judge pass and
    // now tries to complete the SAME run, which the winner already finalized.
    const second = await executeEditorialRun(db, {
      isoWeek: WEEK, runId: 'run-001', manifest: canonicalBefore.manifest,
      now: SLOT_SUNDAY, deadline: FAR_DEADLINE(), callModel: okJudge,
    });
    expect(second).toMatchObject({ status: 'superseded_by_concurrent_run', runId: 'run-001', reason: 'immutable_run' });

    // The winner's run is byte-intact — no double-write, canonical unchanged.
    const doc = await weekDoc();
    expect(doc.canonicalRunId).toBe('run-001');
    expect(doc.runs['run-001'].completedAt).toBe(canonicalBefore.completedAt);
    expect(doc.runs['run-001'].memo).toBe(canonicalBefore.memo);
  });
});

// ── P2-37: runs-map integrity ──────────────────────────────────────────────
describe('P2-37 — immutability, cap, prune order', () => {
  const bareManifest = { seed: { isoWeek: WEEK, reviewVersion: '1.0.0' }, frameFingerprint: 'f', frameSize: 0, minimumSize: 15, ceiling: 20, targetSize: 0, strata: [], producedReporters: [], producedEventTypes: [], samplingStatus: 'ok', samplingReason: null, sample: [] };

  it('completing a terminal run is rejected (immutable_run)', async () => {
    await createEditorialRun(db, { isoWeek: WEEK, slotDate: '2026-08-02', manifest: bareManifest, status: 'insufficient' });
    const res = await completeEditorialRun(db, { isoWeek: WEEK, runId: 'run-001', patch: { status: 'complete' } });
    expect(res).toMatchObject({ completed: false, reason: 'immutable_run' });
  });

  it('cap 5: pruning removes the OLDEST failed/insufficient and never a complete run', async () => {
    // Hand-seed 5 runs: run-001 complete (not canonical), run-002..005 failed.
    const runs = {};
    runs['run-001'] = { runId: 'run-001', status: 'complete', createdAt: '2026-08-02T10:00:00.000Z' };
    for (let i = 2; i <= 5; i++) {
      runs[`run-00${i}`] = { runId: `run-00${i}`, status: 'failed', createdAt: `2026-08-02T1${i}:00:00.000Z` };
    }
    await db.collection('wireEditorial').doc(WEEK).set({
      isoWeek: WEEK, scheduledSlotDate: '2026-08-02', canonicalRunId: null, runs,
    });

    const created = await createEditorialRun(db, { isoWeek: WEEK, slotDate: '2026-08-02', manifest: bareManifest });
    expect(created).toMatchObject({ created: true, runId: 'run-006' });
    const doc = await weekDoc();
    expect(doc.runs['run-001'].status).toBe('complete');   // completes never prune
    expect(doc.runs['run-002']).toBeUndefined();           // oldest failed pruned
    expect(Object.keys(doc.runs)).toHaveLength(5);
  });

  it('cap 5 with nothing prunable → run_cap_exhausted (no silent overwrite)', async () => {
    const runs = {};
    for (let i = 1; i <= 5; i++) {
      runs[`run-00${i}`] = { runId: `run-00${i}`, status: 'complete', createdAt: `2026-08-02T1${i}:00:00.000Z` };
    }
    await db.collection('wireEditorial').doc(WEEK).set({
      isoWeek: WEEK, scheduledSlotDate: '2026-08-02', canonicalRunId: null, runs,
    });
    const created = await createEditorialRun(db, { isoWeek: WEEK, slotDate: '2026-08-02', manifest: bareManifest });
    expect(created).toMatchObject({ created: false, reason: 'run_cap_exhausted' });
  });
});

// ── P2-14: epoch homogeneity, one fault per injectable input ──────────────
describe('P2-14 — gateEligible epoch homogeneity', () => {
  const EPOCH_FAULTS = [
    ['generationVersion', { generationVersion: 7 }],
    ['continuityEnabled', { continuityEnabled: true }],
    ['schemaVersion', { schemaVersion: 'wire-1.6-b' }],
    ['digestRendererVersion', { digestRendererVersion: '1.0.1' }],
    ['validatorVersion', { validatorVersion: '1.5.0' }],
  ];

  it.each(EPOCH_FAULTS)('a sample mixed on %s → homogeneous false', (_label, over) => {
    const uniform = [wireEntry('a', 'alex', 'market_mover'), wireEntry('b', 'alex', 'market_mover')];
    expect(assessEpochHomogeneity(uniform).homogeneous).toBe(true);
    const mixed = [wireEntry('a', 'alex', 'market_mover'), wireEntry('b', 'alex', 'market_mover', { epochOver: over })];
    const result = assessEpochHomogeneity(mixed);
    expect(result.homogeneous).toBe(false);
    expect(result.epochs).toHaveLength(2);
  });

  it('end to end: one story from an older generation epoch → run completes with gateEligible FALSE (epoch_mixed)', async () => {
    // schemaVersion stays RECOGNIZED (the guard must not eat the entry —
    // this row is about epoch MIXING, not version trust), so the fault
    // rides generationVersion.
    await seedWeek(db, {
      entryTweak: (e) => {
        if (e.storyId === 'mover-3') e.generationConfig = { generationVersion: 7, continuityEnabled: false };
        return e;
      },
    });
    const out = await runEditorialReview(db, { now: SLOT_SUNDAY, deadline: FAR_DEADLINE(), callModel: okJudge });
    expect(out).toMatchObject({ status: 'complete', gateEligible: false });
    const run = (await weekDoc()).runs['run-001'];
    expect(run.verdict.failureClauses).toContain('epoch_mixed');
    expect(run.gateEpoch).toMatchObject({ mixed: true });
  });
});

// ── P2-12 (pure) + verdict table ───────────────────────────────────────────
describe('P2-12 — aggregates recompute from rows; mutation detected', () => {
  const row = (storyId, verdict, over = {}) => ({
    storyId, reporter: over.reporter ?? 'alex', eventType: 'market_mover', marketDate: '2026-07-28',
    shape: over.shape ?? 'S2', storyVerdict: verdict,
    criticalCodes: over.criticalCodes ?? [], notVerifiableReasons: over.nvReasons ?? [],
    advisoryFlags: over.advisoryFlags ?? [], judgeDiscardedFlags: 0, results: [],
  });

  it('mutating one audit row makes verifyEditorialAggregates fail', () => {
    const rows = [row('a', 'VERIFIED_CORRECT'), row('b', 'VERIFIED_WRONG'), row('c', 'NOT_VERIFIABLE', { nvReasons: ['missing_operand'] })];
    const run = { auditRows: rows, aggregates: computeEditorialAggregates(rows) };
    expect(verifyEditorialAggregates(run).ok).toBe(true);
    rows[1].storyVerdict = 'VERIFIED_CORRECT'; // the tamper
    const check = verifyEditorialAggregates(run);
    expect(check.ok).toBe(false);
    expect(check.mismatches).toContain('verifiedWrong');
  });

  it('the N3.4 clause table: floor · shapes · threshold · critical · wrong-subject', () => {
    const manifest = { samplingStatus: 'ok' };
    const epoch = { homogeneous: true, epochs: [] };
    const V = (rows) => computeEditorialVerdict({ aggregates: computeEditorialAggregates(rows), manifest, judgeComplete: true, epoch });

    // 4 verified → floor fails (count).
    const four = [1, 2, 3, 4].map((i) => row(`a${i}`, 'VERIFIED_CORRECT'));
    expect(V(four)).toMatchObject({ gateEligible: false, passed: false });
    expect(V(four).failureClauses).toContain('floor');

    // 5 verified, ONE shape → floor fails (shapes).
    const oneShape = [1, 2, 3, 4, 5].map((i) => row(`b${i}`, 'VERIFIED_CORRECT'));
    expect(V(oneShape).floor).toMatchObject({ verifiedCount: 5, contributingShapes: 1, met: false });

    // 5 verified across two shapes, zero wrong → PASS.
    const healthy = [row('c1', 'VERIFIED_CORRECT'), row('c2', 'VERIFIED_CORRECT'), row('c3', 'VERIFIED_CORRECT'), row('c4', 'VERIFIED_CORRECT'), row('c5', 'VERIFIED_CORRECT', { shape: 'S3' })];
    expect(V(healthy)).toMatchObject({ passed: true, gateEligible: true });

    // 1 wrong of 5 = 20% ≥ 5% → eligible but failing.
    const wrongOne = [...healthy.slice(0, 4), row('c5', 'VERIFIED_WRONG', { shape: 'S3' })];
    expect(V(wrongOne)).toMatchObject({ passed: false, gateEligible: true });

    // A critical contradiction fails even at 0% derivation error…
    const critical = [...healthy.slice(0, 4), row('c5', 'VERIFIED_CORRECT', { shape: 'S3', criticalCodes: ['subject_mismatch'] })];
    expect(V(critical).passed).toBe(false);
    expect(V(critical).failureClauses).toContain('critical_contradictions');

    // …and wrong-subject index_move is its own zero-tolerance clause.
    const wrongSubject = [...healthy.slice(0, 4), row('c5', 'VERIFIED_WRONG', { shape: 'S1', criticalCodes: ['wrong_subject_index_move'] })];
    expect(V(wrongSubject).failureClauses).toContain('wrong_subject_index_move');
  });

  it('the memo renders from rows + aggregates and names the failure clauses', () => {
    const rows = [row('a', 'VERIFIED_CORRECT'), row('b', 'VERIFIED_WRONG')];
    const aggregates = computeEditorialAggregates(rows);
    const verdict = computeEditorialVerdict({ aggregates, manifest: { samplingStatus: 'ok' }, judgeComplete: true, epoch: { homogeneous: true, epochs: [] } });
    const memo = renderEditorialMemo({ runId: 'run-001', manifest: { seed: { isoWeek: WEEK } }, aggregates, verdict });
    expect(memo).toContain('2026-W31');
    expect(memo).toContain('FAIL');
    expect(memo).toContain('floor');
    expect(memo).toContain('alex: sampled 2');
  });
});

// ── Budget floor export sanity (the host consumes it) ─────────────────────
describe('host budget contract', () => {
  it('EDITORIAL_MIN_BUDGET_MS is a real floor', () => {
    expect(EDITORIAL_MIN_BUDGET_MS).toBeGreaterThanOrEqual(10_000);
  });
});
