// scripts/census-setup-evidence-sweep.test.js
//
// The chart's evidence, PR B — the day-after check (spec docs/specs/CHART_EVIDENCE_SPEC_V1.md §5.7):
// READ-ONLY BY CONSTRUCTION (its imports, its reader's two members, a write-verb grep over its own
// text), every read field-masked, and AGGREGATES ONLY: seeded records carry sentinel symbols and
// sentinel labels, and none reaches the text or the JSON. A failed read is never absent.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { censusMain, parseArgs, renderText, restrictedReader, runSweepCensus } from './census-setup-evidence-sweep.mjs';
import { snapshotIdOf } from '../api/_utils/setupEvidence/key.js';
import { describeRuleSet } from '../api/_utils/setupEvaluator/thresholds.js';

const SRC = readFileSync(fileURLToPath(new URL('./census-setup-evidence-sweep.mjs', import.meta.url)), 'utf8');
const S = '2026-11-16';
const RS = describeRuleSet();
const SYMBOLS = ['ZQXA', 'ZQXB', 'ZQXC', 'ZQXD', 'ZQXE', 'ZQXF', 'ZQXG']; // sentinels: no real ticker
const path = (symbol) => `setupEvidence/${snapshotIdOf({ session: S, symbol, ruleSet: RS })}`;
const rec = (symbol, status, entry, over = {}) => ({ schemaVersion: 1, key: { session: S, symbol }, status, capturedAt: '2026-11-16T22:31:05.000Z', entry, ...over });

function fakeReader(docs, { failGetAll = false, failGet = false } = {}) {
  const calls = [];
  return {
    calls,
    get: async (p, fields) => { calls.push(['get', p, fields]); if (failGet) throw Object.assign(new Error('down'), { code: 14 }); return docs[p] ? { exists: true, data: structuredClone(docs[p]) } : { exists: false, data: null }; },
    getAll: async (ps, fields) => { calls.push(['getAll', ps.length, fields]); if (failGetAll) throw Object.assign(new Error('down'), { code: 4 }); return ps.map((p) => (docs[p] ? { exists: true, data: structuredClone(docs[p]) } : { exists: false, data: null })); },
  };
}
const seeded = () => ({
  [path('ZQXA')]: rec('ZQXA', 'ok', { verdict: 'valid', reason: null, pattern: 'pullback_resume', missing: [] }),
  [path('ZQXB')]: rec('ZQXB', 'ok', { verdict: 'invalid', reason: 'extended', pattern: null, missing: [] }),
  [path('ZQXC')]: rec('ZQXC', 'ok', { verdict: 'unknown', reason: 'missing_fact', pattern: null, missing: ['V', 'SENTINEL_FACT'] }),
  [path('ZQXD')]: rec('ZQXD', 'refused', { verdict: 'unknown', reason: 'basis_discontinuity', pattern: null, missing: [] }),
  [path('ZQXE')]: rec('ZQXE', 'ok', { verdict: 'invalid', reason: 'SENTINEL_REASON', pattern: null, missing: [] }),
  [path('ZQXF')]: rec('ZQXF', 'ok', { verdict: 'valid', pattern: 'breakout' }, { key: { session: S, symbol: 'OTHER' } }), // a key that is not its id's
  [`setupEvidenceSweepState/${S}`]: {
    schemaVersion: 1, session: S, providerRequests: 231, runs: 3, firstRunAt: '2026-11-16T22:30:00.000Z', lastRunAt: '2026-11-17T12:30:00.000Z',
    completedAt: '2026-11-16T23:31:40.000Z', runMs: 151_400,
    latest: { startedAt: '2026-11-17T12:30:00.000Z', names: 228, final: { measured: 226, refused: 2 }, pending: 0, retryable: { missing_bar: 1, SENTINEL_RETRY: 2 } },
  },
});

describe('read-only by construction', () => {
  it('imports only the store\'s pure key and session modules, the rule set, the ranked list and the sweep\'s constants', () => {
    const imports = [...SRC.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
    expect(imports).toEqual([
      'node:fs', 'node:url',
      '../api/_utils/setupEvidence/key.js', '../api/_utils/setupEvidence/sessionAt.js', '../api/_utils/setupEvaluator/thresholds.js',
      '../api/_utils/rankingConfig.js', '../api/_utils/setupEvidenceSweep/constants.js',
    ]);
    expect(SRC).not.toMatch(/setupEvidence\/(index|acquire|store|classify)\.js|setupEvidenceSweep\/(sweep|state)\.js/);
    expect([...SRC.matchAll(/await import\('([^']+)'\)/g)].map((m) => m[1])).toEqual(['./loadLocalEnv.js', '../api/_utils/firebaseAdmin.js']);
  });
  it('the write-verb grep finds nothing', () => {
    expect(SRC).not.toMatch(/\.(set|add|update|delete|create|batch|runTransaction|bulkWriter|recursiveDelete)\(|writeBatch|\.commit\(/);
  });
  it('the reader has exactly two members, both field-masked reads; runSweepCensus calls nothing else on it', async () => {
    const calls = [];
    const db = {
      doc: (p) => ({ p }),
      getAll: async (...args) => { calls.push(args); return args.slice(0, -1).map(() => ({ exists: false })); },
    };
    const reader = restrictedReader(db);
    expect(Object.keys(reader).sort()).toEqual(['get', 'getAll']);
    expect(Object.isFrozen(reader)).toBe(true);
    await reader.get('a/b', ['x']);
    await reader.getAll(['a/b', 'a/c'], ['y', 'z']);
    expect(calls.map((c) => c.at(-1))).toEqual([{ fieldMask: ['x'] }, { fieldMask: ['y', 'z'] }]);
    const member = /\breader\.(\w+)\(/g;
    expect([...new Set([...SRC.matchAll(member)].map((m) => m[1]))].sort()).toEqual(['get', 'getAll']);
  });
});

describe('the census of one session', () => {
  it('records, verdicts, refusals and the sweep\'s own counts', async () => {
    const reader = fakeReader(seeded());
    const R = await runSweepCensus(reader, { session: S, symbols: SYMBOLS, nowMs: Date.parse('2026-11-17T14:00:00.000Z') });
    expect(R.universe).toBe(7);
    expect(R.records).toEqual({ found: 5, absent: 1, readFailed: 0, unreadable: 1, measured: 4, refused: 1 });
    expect(R.verdicts).toEqual({
      valid: { total: 1, byPattern: { pullback_resume: 1 } },
      invalid: { total: 2, byReason: { extended: 1, other: 1 } },
      unknown: { total: 1, byReason: { missing_fact: 1 }, byMissingFact: { V: 1, other: 1 } },
      refused: { total: 1, byReason: { basis_discontinuity: 1 } },
    });
    expect(R.sweep).toMatchObject({ state: 'read', providerRequests: 231, runs: 3, minutesFirstRunToComplete: 62, runSeconds: 151 });
    expect(R.sweep.latest.retryable).toEqual({ missing_bar: 1, other: 2 });
    // Every read was field-masked: one get of the state, one getAll of the records.
    expect(reader.calls.map((c) => c[0])).toEqual(['get', 'getAll']);
    for (const c of reader.calls) expect(Array.isArray(c[2]) && c[2].length > 0).toBe(true);
    expect(reader.calls[1][2]).not.toContain('evidence');
  });
  it('aggregates only: no symbol, id or free label in the text or the JSON', async () => {
    const out = [];
    const files = [];
    const R = await censusMain({ argv: ['--session', S, '--json', 'x.json'], reader: fakeReader(seeded()), writeFile: (p, t) => files.push(t), log: (l) => out.push(l), nowMs: Date.parse('2026-11-17T14:00:00.000Z') });
    expect(R.session).toBe(S);
    const all = [...out, ...files].join('\n');
    for (const sentinel of ['SENTINEL', 'OTHER', 'tf-setup-v1.', '__']) expect(all).not.toContain(sentinel);
    expect(all).not.toMatch(/ZQX|AAPL|MSFT/); // the real 228 were read here too (the default universe): none named
  });
  it('a failed read is counted as failed, never as absent', async () => {
    const R = await runSweepCensus(fakeReader(seeded(), { failGetAll: true, failGet: true }), { session: S, symbols: SYMBOLS });
    expect(R.records).toMatchObject({ found: 0, absent: 0, readFailed: 7 });
    expect(R.sweep.state).toBe('read_failed');
    expect(R.errors).toEqual({ 'Error/4': 1, 'Error/14': 1 });
    expect(renderText(R)).toContain('read failed 7');
  });
  it('the default session is the last completed one; a bad --session or argument is refused', async () => {
    const R = await runSweepCensus(fakeReader({}), { symbols: SYMBOLS, nowMs: Date.parse('2026-11-17T14:00:00.000Z') });
    expect(R.session).toBe(S);
    await expect(runSweepCensus(fakeReader({}), { session: '16/11/2026', symbols: SYMBOLS })).rejects.toThrow(/YYYY-MM-DD/);
    expect(() => parseArgs(['--write'])).toThrow(/unknown argument/);
  });
});
