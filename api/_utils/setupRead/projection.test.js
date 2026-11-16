// api/_utils/setupRead/projection.test.js
//
// The chart's evidence — THE PROJECTION (spec docs/specs/CHART_EVIDENCE_SPEC_V1.md RR-5,
// RR-6), on REAL records made by the store's own acquisition (__fixtures__/readRecords.js):
// every listed field copied exactly, the keys exactly the contract's list, every
// forbidden field absent, and an unknown field planted at every level never leaving.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { answerOf, projectSetupRecord, RECORD_SCHEMA_VERSION, SetupRecordUnreadable } from './projection.js';
import { readRecordSet } from './__fixtures__/readRecords.js';
import { SNAPSHOT_SCHEMA_VERSION } from '../setupEvidence/acquire.js';
import { FACT_NAMES, PATTERN_ORDER } from '../setupEvaluator/tfSetupV1.js';
import {
  SETUP_READ_ANSWERS, SETUP_READ_CHECK_FIELDS, SETUP_READ_FACTS, SETUP_READ_FIELDS, SETUP_READ_PATTERNS, SETUP_READ_RULE_SET_FIELDS,
} from '../../../src/components/Research/Sheet/setupReadContract.js';

const SESSION = '2026-11-13';
const SYMBOL = 'BRK-B';
const FETCHED_AT = '2026-11-13T22:31:07.000Z';
const COMMIT_SENTINEL = 'commit-sentinel-7f3a9c';
const SRC = readFileSync(fileURLToPath(new URL('./projection.js', import.meta.url)), 'utf8');

let set;
let savedCommit;
beforeAll(async () => {
  savedCommit = process.env.VERCEL_GIT_COMMIT_SHA;
  process.env.VERCEL_GIT_COMMIT_SHA = COMMIT_SENTINEL; // so the writer stamp carries a string we can look for
  set = await readRecordSet({ session: SESSION, symbol: SYMBOL, fetchedAt: FETCHED_AT });
});
afterAll(() => {
  if (savedCommit === undefined) delete process.env.VERCEL_GIT_COMMIT_SHA;
  else process.env.VERCEL_GIT_COMMIT_SHA = savedCommit;
});

const project = (record, behind = false) => projectSetupRecord(record, { session: SESSION, symbol: SYMBOL, behind });

describe('the contract', () => {
  it('the facts and patterns are the evaluator\'s own lists; the schema is the store\'s', () => {
    expect(SETUP_READ_FACTS).toEqual([...FACT_NAMES]);
    expect(SETUP_READ_PATTERNS).toEqual([...PATTERN_ORDER]);
    expect(RECORD_SCHEMA_VERSION).toBe(SNAPSHOT_SCHEMA_VERSION);
    expect(SETUP_READ_ANSWERS).toEqual(['measured', 'refused', 'absent']);
  });
  it('the projection is pure: it imports only the contract and names no collection, no provider and no clock', () => {
    const imports = [...SRC.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);
    expect(imports).toEqual(['../../../src/components/Research/Sheet/setupReadContract.js']);
    const code = SRC.replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/\.collection\(|\.doc\(|fetch\(|Date\.now|new Date|eodhd/i);
  });
});

describe('every listed field is copied exactly (a valid pullback)', () => {
  it('the keys are exactly the contract\'s list, in order', () => {
    const p = project(set.VALID_PULLBACK.record);
    expect(Object.keys(p)).toEqual([...SETUP_READ_FIELDS]);
    expect(Object.keys(p.ruleSet)).toEqual([...SETUP_READ_RULE_SET_FIELDS]);
    for (const c of p.checks) expect(Object.keys(c)).toEqual([...SETUP_READ_CHECK_FIELDS]);
    expect(Object.keys(p.facts)).toEqual([...SETUP_READ_FACTS]);
    expect(Object.keys(p.patterns)).toEqual([...SETUP_READ_PATTERNS]);
  });
  it('each value is the record\'s own', () => {
    const r = set.VALID_PULLBACK.record;
    const e = r.entry;
    const p = project(r);
    expect(p.session).toBe(SESSION);
    expect(p.asOf).toBe(e.asOf);
    expect(p.asOf).toBe(SESSION);
    expect(p.capturedAt).toBe(FETCHED_AT);
    expect(p.capturedAt).toBe(r.capturedAt);
    expect(p.behind).toBe(false);
    expect(project(r, true).behind).toBe(true);
    expect(p.ruleSet).toEqual({ setupVersion: 'tf-setup-v1', thresholdsHash: '26f3f411b566', semanticsId: 'tf-setup-v1/sem-1' });
    expect(p.ruleSet).toEqual({ ...r.key.ruleSet });
    expect(p.basis).toBe('raw');
    expect(p.basis).toBe(e.basis);
    expect([p.verdict, p.reason, p.pattern, p.regime]).toEqual(['valid', null, 'pullback_resume', 'uptrend']);
    expect(p.patternsSatisfied).toEqual(['pullback_resume']);
    expect(p.patterns).toEqual({ breakout: 'failed', pullback_resume: 'satisfied' });
    expect(p.checks).toEqual(e.checks.map(({ id, lhs, op, rhs, result }) => ({ id, lhs, op, rhs, result })));
    expect(p.checks.find((c) => c.id === 'regime_stack')).toEqual({ id: 'regime_stack', lhs: [200.37, 195.62], op: '>', rhs: [195.62, 188.12], result: true });
    expect(p.checks.find((c) => c.id === 'extension')).toEqual({ id: 'extension', lhs: 200.37, op: '<=', rhs: 204.5872, result: true });
    expect(p.facts).toEqual(Object.fromEntries(FACT_NAMES.map((n) => [n, e.factsUsed[n].value])));
    expect(p.facts.C).toBe(200.37);
    expect(p.missing).toEqual([]);
    expect(p.swingHigh).toEqual({ value: e.evidence.swingHigh.value, date: e.evidence.swingHigh.date });
    expect(p.swingLow).toEqual({ value: e.evidence.swingLow.value, date: e.evidence.swingLow.date });
    expect(p.swingLow.value).toBe(188.24); // bar 20's low (200.37 − 10 − 2.13): the swing window is bars 1..20
    expect(p.pullbackLows).toHaveLength(3);
    expect(p.pullbackLows[1].low).toBe(194.61); // bar 1's dip to the 20-day average
    expect(p.pullbackLows).toEqual(e.evidence.pullbackLows.map(({ date, low }) => ({ date, low })));
    expect(p.adjustmentMetadata).toBe('present');
  });
  it('the projection is a copy: changing it changes nothing in the record', () => {
    const r = set.VALID_PULLBACK.record;
    const before = JSON.stringify(r);
    const p = project(r);
    p.checks[0].lhs[0] = -1; p.pullbackLows[0].low = -1; p.patternsSatisfied.push('x'); p.facts.C = -1; p.ruleSet.setupVersion = 'x';
    expect(JSON.stringify(r)).toBe(before);
  });
});

describe('the verdicts the next build must read', () => {
  it('invalid · extended still names the satisfied pattern (the KB method reads it)', () => {
    const p = project(set.EXTENDED.record);
    expect([answerOf(set.EXTENDED.record), p.verdict, p.reason, p.pattern]).toEqual(['measured', 'invalid', 'extended', null]);
    expect(p.patternsSatisfied).toEqual(['pullback_resume']);
    expect(p.patterns.pullback_resume).toBe('satisfied');
    expect(p.checks.find((c) => c.id === 'extension').result).toBe(false);
  });
  it('unknown · missing_fact from usable evidence is MEASURED, with what was missing', () => {
    const p = project(set.UNKNOWN_V.record);
    expect([answerOf(set.UNKNOWN_V.record), p.verdict, p.reason]).toEqual(['measured', 'unknown', 'missing_fact']);
    expect(p.missing).toEqual(['V']);
    expect(p.facts.V).toBeNull();
    expect(p.patterns).toEqual({ breakout: 'untestable', pullback_resume: 'failed' });
    expect(p.checks.find((c) => c.id === 'breakout_volume').result).toBe('unknown');
  });
  it('a confirmed record with no adjusted close is MEASURED (the store finalised it ok) and says the split check could not run', () => {
    const r = set.NO_ADJUSTMENT.record;
    expect(r.status).toBe('ok');
    const p = project(r);
    expect([answerOf(r), p.verdict, p.adjustmentMetadata]).toEqual(['measured', 'valid', 'absent']);
  });
  it('a split inside the window is REFUSED, with its reason; every fact null, every check unknown, no lows', () => {
    const r = set.SPLIT.record;
    const p = project(r);
    expect([answerOf(r), p.verdict, p.reason, p.pattern, p.regime]).toEqual(['refused', 'unknown', 'basis_discontinuity', null, 'unknown']);
    expect(Object.values(p.facts).every((v) => v === null)).toBe(true);
    expect(p.missing).toEqual([...FACT_NAMES]);
    expect(p.checks.every((c) => c.result === 'unknown')).toBe(true);
    expect(p.pullbackLows).toEqual([]);
    expect(p.swingHigh).toEqual({ value: null, date: null });
    expect(p.asOf).toBe(SESSION);
  });
});

describe('what never leaves the server', () => {
  it('no writer stamp, no claims field, no stored bar, no source meta, no refusal detail', () => {
    for (const { record } of Object.values(set)) {
      const json = JSON.stringify(project(record));
      expect(json).not.toContain(COMMIT_SENTINEL);
      expect(json).not.toContain('fixture-host');
      for (const banned of ['writer', 'commit', 'host', 'lease', 'token', 'observation', 'attempts', 'bars', 'adjustedClose', 'volumeClass', 'sourceMeta', 'fetchedAt', 'refusal', 'detail', 'requestedAsOf', 'evidenceClass', 'windows', 'factsUsed', '"facts":["']) {
        expect(json).not.toContain(banned === '"facts":["' ? banned : `"${banned}"`);
      }
    }
    // The record really holds them: the rows above are not vacuous.
    const r = set.VALID_PULLBACK.record;
    expect(r.writer).toEqual({ host: 'fixture-host', commit: COMMIT_SENTINEL });
    expect(r.evidence.bars).toHaveLength(55);
    expect(JSON.stringify(r)).toContain('"adjustedClose"');
    expect(set.SPLIT.record.refusal.detail).toBeTruthy();
  });
  it('an unknown field planted at every level of a record never leaves', () => {
    const r = structuredClone(set.VALID_PULLBACK.record);
    const S = 'planted-sentinel';
    r.extra = S;
    r.key.extra = S;
    r.key.ruleSet.extra = S;
    r.entry.extra = S;
    r.entry.checks[0].extra = S;
    r.entry.checks[0].facts = [S];
    r.entry.factsUsed.C.extra = S;
    r.entry.factsUsed.extraFact = { value: S };
    r.entry.patterns.extraPattern = S;
    r.entry.evidence.extra = S;
    r.entry.evidence.swingHigh.extra = S;
    r.entry.evidence.pullbackLows[0].extra = S;
    r.entry.evidence.adjustment.extra = S;
    const json = JSON.stringify(project(r));
    expect(json).not.toContain(S);
    expect(json).not.toContain('extra');
  });
});

describe('a record the projection cannot read is never read in part', () => {
  it.each([
    ['another schema version', (r) => ({ ...r, schemaVersion: 2 }), 'schema'],
    ['no schema version', (r) => { const { schemaVersion: _s, ...rest } = r; return rest; }, 'schema'],
    ['another session in its key', (r) => ({ ...r, key: { ...r.key, session: '2026-11-12' } }), 'key'],
    ['another symbol in its key', (r) => ({ ...r, key: { ...r.key, symbol: 'BRK-A' } }), 'key'],
    ['an unknown status', (r) => ({ ...r, status: 'pending' }), 'status'],
    ['no entry', (r) => ({ ...r, entry: null }), 'entry'],
    ['entry checks not a list', (r) => ({ ...r, entry: { ...r.entry, checks: {} } }), 'entry'],
  ])('%s', (_label, mutate, why) => {
    const r = mutate(structuredClone(set.VALID_PULLBACK.record));
    let caught = null;
    try { project(r); } catch (err) { caught = err; }
    expect(caught).toBeInstanceOf(SetupRecordUnreadable);
    expect(caught.why).toBe(why);
  });
  it('answerOf: ok → measured, refused → refused, anything else throws', () => {
    expect(answerOf({ status: 'ok' })).toBe('measured');
    expect(answerOf({ status: 'refused' })).toBe('refused');
    for (const bad of [{ status: 'absent' }, {}, null, 'ok']) expect(() => answerOf(bad)).toThrow(SetupRecordUnreadable);
  });
});
