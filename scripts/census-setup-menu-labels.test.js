// scripts/census-setup-menu-labels.test.js
//
// Measured Trend Evidence Slice 2 — the census (spec V2 §5.5; rows 6.2–6.5; the kickoff's Correction
// D): denominators kept apart, joins scoped to one record, the export's coverage for a timed-out
// capture, aggregates only on every channel, and the static imports pinned (the store, the tenant and
// the state writer are never imported).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { aggregateSetupMenu, formatReport, runCensus, inCohort } from './census-setup-menu-labels.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(HERE, 'census-setup-menu-labels.mjs'), 'utf8');

const cand = (symbol, over = {}) => ({
  symbol, source: 'hotbench', inBenchAtFreeze: true, heldAtFreeze: false, status: 'absent',
  verdict: null, reason: null, pattern: null, regime: null, asOf: null, barsClass: null, capturedAt: null, capturedBeforeFreeze: null, snapshotStatus: null,
  s2Entry: false, s2Reservations: null, s2LastOutcome: null, s2LastAt: null, s2Exhausted: null, ...over,
});
const rec = ({ battleId = 'b1', tickSeq = 1, evalId = 'eval_001', model = { dispatched: true, attempted: true, outcome: 'ok' }, candidates = [], decision = {}, actions = [], blockStatus = 'ok' } = {}) => ({
  tickId: `${battleId}:${tickSeq}`, battleId, tickSeq, evalId, exitReason: 'completed', capturedAt: '2026-09-09T15:00:05.000Z', model, decision, actions,
  setupMenu: { blockStatus, omittedCount: 0, truncatedCount: 0, unrecordableCount: 0, candidates },
});

describe('denominators kept apart (row 6.5; Correction D.2–D.3)', () => {
  it('model-visible needs dispatch AND bench membership; attempted-not-dispatched and dispatched failures are their own tick classes', () => {
    const c = aggregateSetupMenu([
      rec({ candidates: [cand('A'), cand('B', { inBenchAtFreeze: false })] }),
      rec({ tickSeq: 2, model: { dispatched: false, attempted: true, outcome: 'failed' }, candidates: [cand('A')] }),
      rec({ tickSeq: 3, model: { dispatched: true, attempted: true, outcome: 'failed' }, candidates: [cand('A')] }),
      rec({ tickSeq: 4, model: { dispatched: false, attempted: false }, candidates: [cand('A')] }),
    ]);
    expect(c.tickClass).toEqual({ modelDispatched: 2, attemptedNotDispatched: 1, dispatchedFailed: 1, notAttempted: 1 });
    expect(c.cohorts.modelVisible.total).toBe(2);
    expect(c.cohorts.benchAtFreezeNotDispatched.total).toBe(2);
  });
  it('the acquisition population is the persisted hot bench; catalysts are their own cohort; a hot-bench name outside the bench is still acquisition-eligible', () => {
    const c = aggregateSetupMenu([rec({ candidates: [
      cand('H1'), cand('H2', { inBenchAtFreeze: false }), cand('C1', { source: 'catalyst' }), cand('X', { status: 'excluded' }), cand('BRK.B', { status: 'symbol_form' }),
    ] })]);
    expect(c.cohorts.acquisitionPopulation.total).toBe(2);
    expect(c.cohorts.catalyst.total).toBe(1);
    expect(c.absent.bySource).toEqual({ hotbench: 2, catalyst: 1 });
  });
  it('Slice 2 history: unreadable, no entry and an entry at zero are three rows; reservations are never called requests or failures', () => {
    const c = aggregateSetupMenu([rec({ candidates: [
      cand('U', { s2Entry: null }), cand('N', { s2Entry: false }), cand('Z', { s2Entry: true, s2Reservations: 0, s2LastOutcome: 'pending' }),
      cand('R', { s2Entry: true, s2Reservations: 3, s2Exhausted: true, s2LastOutcome: 'retryable' }),
    ] })]);
    expect(c.absent.slice2History).toEqual({ stateUnread: 1, noEntry: 1, entryZeroReservations: 1, entryWithReservations: 1, exhausted: 1 });
    expect(c.absent.lastOutcome).toEqual({ pending: 1, retryable: 1 });
    const report = formatReport(c);
    expect(report).toMatch(/reservations and recorded outcomes only/);
    expect(report).not.toMatch(/provider (failure|failed)/i);
  });
  it('D-1 capture before the freeze is reported as provider capture time, never as availability', () => {
    const c = aggregateSetupMenu([rec({ candidates: [cand('L', { status: 'labelled', capturedBeforeFreeze: true }), cand('M', { status: 'refused', capturedBeforeFreeze: false })] })]);
    expect(c.providerCapture).toEqual({ beforeFreeze: 1, notBeforeFreeze: 1, unknown: 0 });
    expect(formatReport(c)).toMatch(/NOT availability at the decision/);
    expect(Object.keys(c).some((k) => /avail/i.test(k))).toBe(false);
  });
  it('omitted, truncated and unrecordable counts are carried into coverage', () => {
    const r = rec({ candidates: [cand('A')] });
    r.setupMenu.omittedCount = 17; r.setupMenu.truncatedCount = 2; r.setupMenu.unrecordableCount = 1;
    expect(aggregateSetupMenu([r]).candidates).toMatchObject({ omitted: 17, truncated: 2, unrecordable: 1 });
  });
});

describe('joins (rows 6.2, 6.3)', () => {
  it('6.2 joins are scoped to one record: two battles with the same evalId never join', () => {
    const c = aggregateSetupMenu([
      rec({ battleId: 'b1', evalId: 'eval_012', candidates: [cand('AAA', { status: 'labelled' })], decision: { originalSymbolIn: 'AAA' } }),
      rec({ battleId: 'b2', evalId: 'eval_012', candidates: [cand('BBB', { status: 'absent' })], decision: { originalSymbolIn: 'AAA' } }),
    ]);
    expect(c.joins.pick).toEqual({ 'same_tick:labelled': 1, ambiguous: 1 });
  });
  it('6.3 same_tick by source; an executed proposal is proposal_tick_unevaluated (never same_tick, never ambiguous); no match is ambiguous', () => {
    const c = aggregateSetupMenu([rec({
      candidates: [cand('NEW', { status: 'labelled' }), cand('DET', { status: 'absent' })],
      decision: { originalSymbolIn: 'NEW', finalSymbolIn: 'NEW' },
      actions: [
        { source: 'haiku', symbolIn: 'NEW', committed: true },
        { source: 'risk_manager', symbolIn: 'DET', committed: true },
        { source: 'haiku', symbolIn: 'PROP', committed: true },
        { source: 'archetype', symbolIn: 'NOPE', committed: true },
        { source: 'haiku', symbolIn: 'NEW', committed: false },
      ],
    })]);
    expect(c.joins.actions).toEqual({ 'same_tick:haiku:labelled': 1, 'same_tick:risk_manager:absent': 1, proposal_tick_unevaluated: 1, ambiguous: 1 });
  });
});

describe('the runner: the export\'s read path and coverage (row 6.4)', () => {
  const reader = ({ ticks, minted, state = null, stateThrows = false }) => ({
    findBattleIds: async () => ['b1', 'b-other'],
    readBattle: async (id) => (id === 'b1' ? { inCohort: true, mintedTickSeq: minted } : { inCohort: false, mintedTickSeq: 9 }),
    readTicks: async () => ticks,
    readBodyIds: async () => ticks.map((t) => t.tickId),
    readState: async () => { if (stateThrows) throw new Error('denied'); return state; },
  });
  it('a timed-out capture is resolved by presence: a landed record counts, a missing one is a counted gap — never assumed absent', async () => {
    const landed = await runCensus(reader({ ticks: [rec({ tickSeq: 1 }), rec({ tickSeq: 2 })], minted: 2 }), {});
    expect(landed.coverage).toMatchObject({ minted: 2, captured: 2 });
    const gap = await runCensus(reader({ ticks: [rec({ tickSeq: 1 })], minted: 2 }), {});
    expect(gap.coverage).toMatchObject({ minted: 2, captured: 1 });
    expect(gap.ticks.records).toBe(1);
  });
  it('only cohort battles are read past their battle document; an unreadable state is reported as such', async () => {
    const c = await runCensus(reader({ ticks: [rec()], minted: 1, stateThrows: true }), {});
    expect(c.coverage.battles).toBe(1);
    expect(c.state.status).toBe('unreadable');
  });
  it('the state\'s typed reasons and outcomes are reported from what the state stores', async () => {
    const state = { attempts: { k1: { n: 2, lastOutcome: 'retryable', lastReason: 'insufficient_history' }, k2: { n: 1, lastOutcome: 'final', lastReason: null }, k3: { n: 1, lastOutcome: 'retryable', lastReason: 'SENTINEL-free-text' } } };
    const c = await runCensus(reader({ ticks: [], minted: 0, state }), {});
    expect(c.state).toMatchObject({ status: 'read', entries: 3, reservations: 4, lastReason: { insufficient_history: 1, other: 1 }, lastOutcome: { retryable: 2, final: 1 } });
  });
  it('the cohort: an allowlisted owner\'s Trend Follower battle, never a CPU side', () => {
    expect(inCohort({ ownerId: 'o', agentContext: { archetype: 'momentum_chaser' } }, ['o'])).toBe(true);
    expect(inCohort({ ownerId: 'o', isCpu: true, agentContext: { archetype: 'momentum_chaser' } }, ['o'])).toBe(false);
    expect(inCohort({ ownerId: 'x', agentContext: { archetype: 'momentum_chaser' } }, ['o'])).toBe(false);
  });
});

describe('aggregates only (every channel)', () => {
  it('no sentinel owner, battle, tick, snapshot id or symbol reaches the report or the JSON; off-list labels print as `other`', async () => {
    const c = aggregateSetupMenu([rec({
      battleId: 'battle-SENTINEL', evalId: 'eval_SENTINEL',
      candidates: [cand('SENTL', { status: 'SENTINEL-status', source: 'SENTINEL-source', s2Entry: true, s2LastOutcome: 'SENTINEL-outcome' })],
      decision: { originalSymbolIn: 'SENTL' }, actions: [{ source: 'SENTINEL source', symbolIn: 'SENTL', committed: true }],
      blockStatus: 'SENTINEL-block',
    })], { state: { attempts: { 'snap-SENTINEL': { n: 1, lastOutcome: 'SENTINEL', lastReason: 'SENTINEL' } } }, stateStatus: 'read' });
    for (const out of [formatReport(c, { scope: 'window' }), JSON.stringify(c)]) {
      expect(out).not.toMatch(/SENTINEL|SENTL/);
    }
  });
});

describe('the static imports (read-only by construction)', () => {
  const specifiers = [...SRC.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*)['"`]([^'"`]+)['"`]/g)].map((m) => m[1]);
  it('only pure modules statically; credentials and the database only lazily, inside main()', () => {
    expect(specifiers.sort()).toEqual([
      '../api/_utils/callRecords/allowlist.js', '../api/_utils/firebaseAdmin.js', '../api/_utils/setupMenuLabels/constants.js',
      '../api/_utils/tickCapture/captureConfig.js', '../api/_utils/tickCapture/captureCoverage.js', './export-tick-capture.js', './loadLocalEnv.js',
      'node:fs', 'node:url',
    ].sort());
  });
  it('the store, the tenant, the reader and the state writer are never imported; nothing writes', () => {
    for (const s of specifiers) expect(s).not.toMatch(/setupEvidence\/|setupMenuLabels\/(tenant|state|reads)\.js/);
    const code = SRC.split(/\r?\n/).filter((l) => !l.trim().startsWith('//')).join('\n');
    expect(code).not.toMatch(/\.(set|update|create|delete|commit|runTransaction|batch)\(/);
    expect(code).not.toMatch(/getOrAcquireSnapshot/);
  });
});
