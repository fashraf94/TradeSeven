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
  it('the state\'s typed reasons and outcomes are reported from what the state stores; an off-list reason makes its entry malformed, never `other` (F3)', async () => {
    const state = { schemaVersion: 1, attempts: { k1: { n: 2, lastOutcome: 'retryable', lastReason: 'insufficient_history' }, k2: { n: 1, lastOutcome: 'final', lastReason: null }, k3: { n: 1, lastOutcome: 'retryable', lastReason: 'SENTINEL-free-text' } } };
    const c = await runCensus(reader({ ticks: [], minted: 0, state }), {});
    expect(c.state).toMatchObject({ status: 'partial', entries: 3, validEntries: 2, malformedEntries: 1, totals: 'partial valid-entry subtotals', reservations: 3, lastReason: { insufficient_history: 1 }, lastOutcome: { retryable: 1, final: 1 } });
  });
  it('the cohort is the slice\'s own scope (scopeOf): an allowlisted owner\'s tiered Trend Follower battle — never a CPU side, a training clone or a tournament (review SM3 aside)', () => {
    const tf = { ownerId: 'o', gameMode: 'baggerbomb_agent', agentId: 'agent-1', agentContext: { archetype: 'momentum_chaser' } };
    expect(inCohort(tf, ['o'])).toBe(true);
    expect(inCohort({ ...tf, gameMode: undefined }, ['o'])).toBe(true);
    expect(inCohort({ ...tf, isCpu: true }, ['o'])).toBe(false);
    expect(inCohort({ ...tf, agentId: 'training-agent-1' }, ['o'])).toBe(false);
    expect(inCohort({ ...tf, gameMode: 'baggerbomb_tournament' }, ['o'])).toBe(false);
    expect(inCohort({ ...tf, agentContext: { archetype: 'analyst' } }, ['o'])).toBe(false);
    expect(inCohort({ ...tf, ownerId: 'x' }, ['o'])).toBe(false);
  });
});

describe('aggregates only (every channel)', () => {
  it('no sentinel owner, battle, tick, snapshot id or symbol reaches the report or the JSON; off-list labels print as `other`', async () => {
    const c = aggregateSetupMenu([rec({
      battleId: 'battle-SENTINEL', evalId: 'eval_SENTINEL',
      candidates: [cand('SENTL', { status: 'SENTINEL-status', source: 'SENTINEL-source', s2Entry: true, s2LastOutcome: 'SENTINEL-outcome' })],
      decision: { originalSymbolIn: 'SENTL' }, actions: [{ source: 'SENTINEL source', symbolIn: 'SENTL', committed: true }],
      blockStatus: 'SENTINEL-block',
    })], { state: { schemaVersion: 1, attempts: { 'snap-SENTINEL': { n: 1, lastOutcome: 'SENTINEL', lastReason: 'SENTINEL' }, 'snap2-SENTINEL': { n: 2, lastOutcome: 'final' } } }, stateStatus: 'read', range: { from: 'SENTINEL', to: '2026-09-09' } });
    expect(c.state).toMatchObject({ status: 'partial', malformedEntries: 1, reservations: 2 });
    expect(c.meta.range).toEqual({ from: null, to: '2026-09-09' }); // a range bound that is not a date never prints
    for (const out of [formatReport(c, { scope: 'window' }), JSON.stringify(c)]) {
      expect(out).not.toMatch(/SENTINEL|SENTL/);
    }
  });
});

describe('aggregates only through the runner too (review SMV1-N1)', () => {
  it('the export\'s coverage reaches the report and the JSON as totals only — no battle id, no missing sequence list', async () => {
    const reader = {
      findBattleIds: async () => ['battle-SENTINEL'],
      readBattle: async () => ({ inCohort: true, mintedTickSeq: 3 }),
      readTicks: async () => [rec({ battleId: 'battle-SENTINEL', tickSeq: 1 })],
      readBodyIds: async () => [],
      readState: async () => null,
    };
    const c = await runCensus(reader, {});
    expect(c.coverage).toMatchObject({ battles: 1, minted: 3, captured: 1 });
    expect(Object.hasOwn(c.coverage, 'rows')).toBe(false);
    for (const out of [formatReport(c, { scope: 'window' }), JSON.stringify(c)]) expect(out).not.toMatch(/SENTINEL/);
  });
});

describe('the static imports (read-only by construction)', () => {
  // Static `import … from '…'` statements (line-anchored) and dynamic `import('…')` calls.
  const specifiers = [
    ...[...SRC.matchAll(/^\s*import\b[^'"`;]*?['"`]([^'"`]+)['"`]/gm)].map((m) => m[1]),
    ...[...SRC.matchAll(/\bimport\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g)].map((m) => m[1]),
  ];
  it('only pure modules statically; credentials and the database only lazily, inside main()', () => {
    expect(specifiers.sort()).toEqual([
      '../api/_utils/activationEvidence/scope.js', '../api/_utils/callRecords/allowlist.js', '../api/_utils/firebaseAdmin.js', '../api/_utils/setupMenuLabels/constants.js',
      '../api/_utils/setupMenuLabels/stateShape.js', // F3: the production reader's own validators — pure, no write path
      '../api/_utils/tickCapture/captureConfig.js', '../api/_utils/tickCapture/captureCoverage.js', './export-tick-capture.js', './loadLocalEnv.js',
      'node:fs', 'node:url',
    ].sort());
  });
  it('the store, the tenant, the reader and the state writer are never imported; nothing writes', () => {
    for (const s of specifiers) expect(s).not.toMatch(/setupEvidence\/|setupMenuLabels\/(tenant|state|reads)\.js/);
    // The validator module the census imports has no I/O and no write path of its own (F3).
    const shape = readFileSync(join(HERE, '../api/_utils/setupMenuLabels/stateShape.js'), 'utf8');
    const shapeCode = shape.split(/\r?\n/).filter((l) => !l.trim().startsWith('//')).join('\n');
    expect([...shapeCode.matchAll(/^\s*import\b[^'"`;]*?['"`]([^'"`]+)['"`]/gm)].map((m) => m[1])).toEqual(['./constants.js']);
    expect(shapeCode).not.toMatch(/\.(collection|doc|get|set|update|create|delete|commit|runTransaction|batch)\(/);
    const code = SRC.split(/\r?\n/).filter((l) => !l.trim().startsWith('//')).join('\n');
    expect(code).not.toMatch(/\.(set|update|create|delete|commit|runTransaction|batch)\(/);
    expect(code).not.toMatch(/getOrAcquireSnapshot/);
  });
});

// ---------------------------------------------------------------- correction round F3 and D2 (Astra's review of 4e99b1f8)
// Rows marked "(Astra)" are Astra's supplied regression file (evidence/census.regression.test.js, SHA-256 00bd2f1c…),
// adapted to this suite; its malformed-entry row asserted the defect (n:"3" printed as zero reservations with its
// outcome counted) and is rewritten to the corrected shape. The production reader runs on the in-memory store.
const { readLabelState } = await import('../api/_utils/setupMenuLabels/state.js');
const { makeMemoryDb } = await import('../api/_utils/setupMenuLabels/__fixtures__/memoryDb.js');
const { stateCensusOf, CENSUS_POPULATIONS } = await import('./census-setup-menu-labels.mjs');

const stateReader = (state, { throws = false } = {}) => ({ findBattleIds: async () => [], readState: async () => { if (throws) throw new Error('denied'); return state; } });
const live = (state) => readLabelState(makeMemoryDb({ docs: state === null ? {} : { 'setupMenuLabelState/main': state } }));
const UNKNOWN = { entries: null, validEntries: null, malformedEntries: null, totals: null, reservations: null, lastOutcome: null, lastReason: null };

describe('F3 — the census reads the state exactly as the production reader does', () => {
  it.each([
    ['an unsupported schemaVersion', { schemaVersion: 2, attempts: { k: { n: 3, lastOutcome: 'final' } } }],
    ['attempts as an array', { schemaVersion: 1, attempts: [] }],
    ['no schemaVersion at all', { attempts: { k: { n: 1 } } }],
    ['a non-object document', 'text'],
  ])('F3 (Astra) %s: unreadable, as the production reader says, every figure unknown — never a measured zero', async (_, state) => {
    expect((await live(state)).status).toBe('unreadable');
    const c = await runCensus(stateReader(state), {});
    expect(c.state).toEqual({ status: 'unreadable', cause: 'unsupported_document', ...UNKNOWN });
    expect(formatReport(c)).toMatch(/Status: unreadable \(a document this code does not read\)\. Every figure is unknown \(not zero\)\./);
  });
  it('a read failure: unreadable (read_failed), every figure unknown, in the JSON and the report', async () => {
    const c = await runCensus(stateReader(null, { throws: true }), {});
    expect(c.state).toEqual({ status: 'unreadable', cause: 'read_failed', ...UNKNOWN });
    expect(JSON.parse(JSON.stringify(c)).state.reservations).toBeNull();
    expect(formatReport(c)).toMatch(/Status: unreadable \(the read failed\)\. Every figure is unknown \(not zero\)\./);
  });
  it('control (Astra): an absent state stays absent, and its figures are unknown, not zero', async () => {
    expect((await live(null)).status).toBe('absent');
    const c = await runCensus(stateReader(null), {});
    expect(c.state).toEqual({ status: 'absent', cause: null, ...UNKNOWN });
    expect(formatReport(c)).toMatch(/Status: absent: no state document was found\. Every figure is unknown \(not zero\)\./);
    expect(formatReport(c)).not.toMatch(/Reservations counted/);
  });
  it('control (Astra): a valid empty state is read, and its zero IS measured', async () => {
    expect((await live({ schemaVersion: 1, attempts: {} })).status).toBe('read');
    const c = await runCensus(stateReader({ schemaVersion: 1, attempts: {} }), {});
    expect(c.state).toEqual({ status: 'read', cause: null, entries: 0, validEntries: 0, malformedEntries: 0, totals: 'complete', reservations: 0, lastOutcome: {}, lastReason: {} });
    expect(formatReport(c)).toMatch(/Status: read \(complete\): 0 entries\.\nReservations counted: 0/);
  });
  it('F3 (Astra, corrected) n:"3" is malformed: counted apart, its n never coerced to 0, its outcome never counted', async () => {
    const state = { schemaVersion: 1, attempts: { k: { n: '3', lastOutcome: 'retryable' } } };
    expect((await live(state)).state.attempts.k.malformed).toBe(true);
    const c = await runCensus(stateReader(state), {});
    expect(c.state).toEqual({ status: 'partial', cause: null, entries: 1, validEntries: 0, malformedEntries: 1, totals: 'partial valid-entry subtotals', reservations: 0, lastOutcome: {}, lastReason: {} });
    const report = formatReport(c);
    expect(report).toMatch(/Status: partial: 1 malformed entries counted apart and NOT aggregated; 0 valid of 1 entries\. Figures are partial valid-entry subtotals:/);
  });
  it('a mix of valid and malformed entries: only the valid ones are summed (2, never 2 + 3 or 2 + 0 for the bad one)', async () => {
    const state = { schemaVersion: 1, attempts: {
      good: { n: 2, lastOutcome: 'final', lastReason: null },
      badN: { n: '3', lastOutcome: 'retryable' },
      negative: { n: -1 },
      fraction: { n: 1.5 },
      nul: null, str: 'x', num: 5, arr: [{ n: 1 }],
    } };
    const c = await runCensus(stateReader(state), {});
    expect(c.state).toMatchObject({ status: 'partial', entries: 8, validEntries: 1, malformedEntries: 7, reservations: 2, lastOutcome: { final: 1 }, lastReason: {} });
  });
  it('agreement with the production reader over every fixture document: the same readability, the same malformed entries, the same valid sum', async () => {
    const fixtures = [
      null, { schemaVersion: 1 }, { schemaVersion: 1, attempts: {} }, { schemaVersion: 2, attempts: {} }, { schemaVersion: '1', attempts: {} },
      { schemaVersion: 1, attempts: [] }, { schemaVersion: 1, attempts: 'x' },
      { schemaVersion: 1, attempts: { a: { n: 0 }, b: { n: 3, session: '2026-09-08', done: false, lastOutcome: 'final', lastReason: 'insufficient_history', lastAt: 1 } } },
      { schemaVersion: 1, attempts: { a: { n: 1, session: '09/08/2026' }, b: { n: 1, done: 'yes' }, c: { n: 1, lastAt: 'soon' }, d: { n: 1, activeToken: '' }, e: { n: 2 } } },
      { schemaVersion: 1, attempts: { a: { n: 1, lastOutcome: 'SENTINEL' }, b: { n: 1, lastReason: 'SENTINEL' }, c: { n: 4, lastOutcome: null, lastReason: null } } },
    ];
    for (const doc of fixtures) {
      const prod = await live(doc);
      const c = await runCensus(stateReader(doc), {});
      const prodClass = prod.status; // read | absent | unreadable
      expect([prodClass, c.state.status === 'partial' ? 'read' : c.state.status]).toEqual([prodClass, prodClass]);
      if (prodClass !== 'read') { expect(c.state.reservations).toBeNull(); continue; }
      const entries = Object.values(prod.state.attempts);
      expect(c.state.entries).toBe(entries.length);
      expect(c.state.malformedEntries).toBe(entries.filter((e) => e.malformed).length);
      expect(c.state.validEntries).toBe(entries.filter((e) => !e.malformed).length);
      expect(c.state.reservations).toBe(entries.filter((e) => !e.malformed).reduce((n, e) => n + e.n, 0));
    }
  });
  it('stateCensusOf: a read that was never made is not_read, unknown', () => {
    expect(stateCensusOf(null, 'not_read')).toEqual({ status: 'not_read', cause: null, ...UNKNOWN });
  });
});

describe('D2 — three populations, each labelled with its scope, in the report and the JSON', () => {
  const tick = (tickSeq, capturedAt) => ({ battleId: 'b1', tickId: `b1:${tickSeq}`, tickSeq, capturedAt, model: { dispatched: false }, setupMenu: { blockStatus: 'ok', readsIssued: 2, readsShared: 1, candidates: [] } });
  const rangeReader = () => ({
    findBattleIds: async () => ['b1'], readBattle: async () => ({ inCohort: true, mintedTickSeq: 3 }),
    readTicks: async () => [tick(1, '2026-09-08T15:00:00Z'), tick(2, '2026-09-09T15:00:00Z')], readBodyIds: async () => [],
    readState: async () => ({ schemaVersion: 1, attempts: { currentKey: { session: '2026-11-06', n: 3 } } }), // a LATER session than any selected tick
  });
  it('range control (Astra): one selected tick, lifetime coverage of three minted, a later session\'s state: three different populations', async () => {
    const c = await runCensus(rangeReader(), { from: '2026-09-09', to: '2026-09-09' });
    expect(c.ticks.records).toBe(1);
    expect(c.coverage).toMatchObject({ minted: 3, captured: 2 });
    expect(c.state).toMatchObject({ status: 'read', reservations: 3 });
    expect(c.meta.range).toEqual({ from: '2026-09-09', to: '2026-09-09' });
  });
  it('the JSON carries the requested range and each population\'s label, scope and keys', async () => {
    const c = JSON.parse(JSON.stringify(await runCensus(rangeReader(), { from: '2026-09-09', to: '2026-09-09' })));
    expect(c.meta.populations.tickLabels.label).toBe('Tick-label aggregates selected by --from/--to');
    expect(c.meta.populations.coverage.label).toBe('Lifetime tick coverage for the selected battles');
    expect(c.meta.populations.state.label).toBe('Current global retained acquisition state');
    expect(c.meta.populations.coverage.scope).toMatch(/NOT limited to the requested range/);
    expect(c.meta.populations.state.scope).toMatch(/NOT limited to the selected battles or the requested range/);
    for (const p of Object.values(c.meta.populations)) for (const k of p.keys) expect(Object.hasOwn(c, k)).toBe(true);
    expect(c.meta.runMemo).toMatch(/up to the invocation's length older/);
  });
  it('the report prints the range and the three sections in order, each with its scope; the run memo with its shared count', async () => {
    const report = formatReport(await runCensus(rangeReader(), { from: '2026-09-09', to: '2026-09-09' }));
    expect(report).toMatch(/Requested range: --from 2026-09-09 --to 2026-09-09\./);
    const at = (s) => report.indexOf(s);
    const heads = [`## 1. ${CENSUS_POPULATIONS.tickLabels.label}`, `## 2. ${CENSUS_POPULATIONS.coverage.label}`, `## 3. ${CENSUS_POPULATIONS.state.label}`];
    for (const h of heads) expect(at(h)).toBeGreaterThan(-1);
    expect(at(heads[0])).toBeLessThan(at(heads[1]));
    expect(at(heads[1])).toBeLessThan(at(heads[2]));
    expect(at('Tick records: 1')).toBeGreaterThan(at(heads[0]));
    expect(at('Tick records: 1')).toBeLessThan(at(heads[1]));
    expect(at('Coverage (the export')).toBeGreaterThan(at(heads[1]));
    expect(at('Reservations counted: 3')).toBeGreaterThan(at(heads[2]));
    expect(report).toMatch(/Reads issued 2 · shared from an earlier tick 1\./);
    expect(report.match(/^Scope: /gm)).toHaveLength(3);
  });
  it('no range: every record, and the report says so', async () => {
    const c = await runCensus(rangeReader(), {});
    expect(c.ticks.records).toBe(2);
    expect(c.meta.range).toEqual({ from: null, to: null });
    expect(formatReport(c)).toMatch(/Requested range: --from \(none\) --to \(none\)\./);
  });
  it('the proposal join stays INFERRED (Astra): a false positive and a false negative of the heuristic, and the M1/M2 line', () => {
    const action = { source: 'haiku', symbolIn: 'PROP', committed: true };
    const candidate = { symbol: 'PROP', source: 'hotbench', status: 'absent', inBenchAtFreeze: false };
    const falsePositive = aggregateSetupMenu([{ setupMenu: { candidates: [candidate] }, decision: {}, actions: [action] }]);
    expect(falsePositive.joins.actions).toEqual({ proposal_tick_unevaluated: 1 });
    const falseNegative = aggregateSetupMenu([{ setupMenu: { candidates: [candidate] }, decision: { originalSymbolIn: 'PROP' }, actions: [action] }]);
    expect(falseNegative.joins.actions).toEqual({ 'same_tick:haiku:absent': 1 });
    expect(formatReport(falsePositive)).toContain('INFERRED');
    expect(formatReport(falsePositive)).toMatch(/M1\/M2 limits/);
  });
});
