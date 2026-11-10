// api/_utils/setupMenuLabels/pool.test.js
//
// Slice 2 — the pure freeze (spec V2 §4.1–§4.2; Corrections C and D.2): literal set membership, the
// deterministic deduplication, the candidate cap BEFORE any read, and the battle half of the gate.
// Imports pool.js unmocked: its src/ imports (through activationEvidence/scope.js) are constants
// modules, and this import is their dependency-surface guard (BUILD_RULES §4).

import { describe, it, expect } from 'vitest';
import { candidatesOf, poolScopeAdmits, RECORD_SYMBOL_RE, selectorOf } from './pool.js';
import { SYMBOL_RE } from '../tickCapture/captureSerializer.js';

const none = () => null;
const symbols = (r) => r.candidates.map((c) => c.symbol);

describe('literal set membership (Correction D.2)', () => {
  it('a hot-bench name already in the ORIGINAL bench is in P and in M, though it never enters the asset map', () => {
    // AMD: on the hot bench and in the original bench, so agent-evaluate.js keeps it out of hotBenchAssetMap.
    const r = candidatesOf({ hotBenchSymbols: ['AMD', 'CRM'], assetMapKeys: ['CRM'], benchAtFreeze: ['AMD', 'JPM', 'CRM'], heldAtFreeze: ['NVDA'], classify: none });
    expect(r.candidates).toEqual([
      { symbol: 'AMD', source: 'hotbench', inBenchAtFreeze: true, heldAtFreeze: false, status: 'read_unsettled' },
      { symbol: 'CRM', source: 'hotbench', inBenchAtFreeze: true, heldAtFreeze: false, status: 'read_unsettled' },
    ]);
  });
  it('a held hot-bench name is in P, not in M, and marked held; an original-bench name outside P is never a candidate', () => {
    const r = candidatesOf({ hotBenchSymbols: ['NVDA', 'CRM'], assetMapKeys: ['CRM'], benchAtFreeze: ['JPM', 'CRM'], heldAtFreeze: ['NVDA'], classify: none });
    expect(r.candidates.find((c) => c.symbol === 'NVDA')).toMatchObject({ inBenchAtFreeze: false, heldAtFreeze: true });
    expect(symbols(r)).not.toContain('JPM');
  });
  it('a catalyst is any asset-map key not on the hot-bench list; it is in M when the bench carries it', () => {
    const r = candidatesOf({ hotBenchSymbols: ['CRM'], assetMapKeys: ['CRM', 'PLTR'], benchAtFreeze: ['CRM', 'PLTR'], heldAtFreeze: [], classify: none });
    expect(r.candidates.find((c) => c.symbol === 'PLTR')).toMatchObject({ source: 'catalyst', inBenchAtFreeze: true });
  });
});

describe('deduplication and order (spec V2 §5.1)', () => {
  it('first occurrence in P\'s order; a hot-bench name is never re-tagged catalyst; presented counts the raw list', () => {
    const hot = ['CRM', 'AMD', 'CRM'];
    const keys = ['AMD', 'PLTR', 'CRM'];
    const r = candidatesOf({ hotBenchSymbols: hot, assetMapKeys: keys, benchAtFreeze: [], heldAtFreeze: [], classify: none });
    expect(symbols(r)).toEqual(['CRM', 'AMD', 'PLTR']);
    expect(r.candidates.map((c) => c.source)).toEqual(['hotbench', 'hotbench', 'catalyst']);
    expect([r.presentedCount, r.uniqueCount, r.omittedCount]).toEqual([6, 3, 0]);
  });
  it('the input lists are never mutated', () => {
    const hot = Object.freeze(['CRM', 'AMD']);
    const keys = Object.freeze(['AMD']);
    expect(() => candidatesOf({ hotBenchSymbols: hot, assetMapKeys: keys, benchAtFreeze: Object.freeze([]), heldAtFreeze: Object.freeze([]), classify: none })).not.toThrow();
  });
});

describe('the cap comes first (Correction C; row 5.1)', () => {
  it('60 hot-bench names + 5 catalysts → 48 candidates in presentation order, 17 omitted, and classify is never asked about an omitted name', () => {
    const hot = Array.from({ length: 60 }, (_, i) => `H${i}`);
    const cats = ['C1', 'C2', 'C3', 'C4', 'C5'];
    const asked = [];
    const r = candidatesOf({ hotBenchSymbols: hot, assetMapKeys: [...hot.slice(0, 10), ...cats], benchAtFreeze: [], heldAtFreeze: [], classify: (s) => { asked.push(s); return null; } });
    expect(r.candidates).toHaveLength(48);
    expect(symbols(r)).toEqual(hot.slice(0, 48));
    expect([r.presentedCount, r.uniqueCount, r.omittedCount]).toEqual([75, 65, 17]);
    expect(asked).toEqual(hot.slice(0, 48));
  });
});

describe('statuses decided at the freeze, without I/O', () => {
  it('classify marks crypto `excluded` and a key-refused form `symbol_form`; everything else waits for a read', () => {
    const classify = (s) => (s === 'BTC-USD' ? 'excluded' : s === 'BRK.B' ? 'symbol_form' : null);
    const r = candidatesOf({ hotBenchSymbols: ['BTC-USD', 'BRK.B', 'BRK-B'], assetMapKeys: [], benchAtFreeze: [], heldAtFreeze: [], classify });
    expect(r.candidates.map((c) => c.status)).toEqual(['excluded', 'symbol_form', 'read_unsettled']);
  });
  it('a name the record cannot carry (not the record\'s symbol syntax) is counted unrecordable and dropped; non-strings are ignored', () => {
    const r = candidatesOf({ hotBenchSymbols: ['aapl', 'TOOLONGSYMBOL1', 'AAPL', null, 7], assetMapKeys: [], benchAtFreeze: [], heldAtFreeze: [], classify: none });
    expect(symbols(r)).toEqual(['AAPL']);
    expect([r.unrecordableCount, r.uniqueCount]).toEqual([2, 3]);
  });
  it('the record syntax restated here IS the serializer\'s', () => {
    expect(RECORD_SYMBOL_RE.source).toBe(SYMBOL_RE.source);
    expect(RECORD_SYMBOL_RE.flags).toBe(SYMBOL_RE.flags);
  });
});

describe('the battle half of the gate (row G.4)', () => {
  const tf = { gameMode: 'baggerbomb_agent', agentId: 'agent-1', agentContext: { archetype: 'momentum_chaser' } };
  it.each([
    ['an in-scope Trend Follower battle', tf, false, true],
    ['gameMode absent', { ...tf, gameMode: undefined }, false, true],
    ['gameMode null', { ...tf, gameMode: null }, false, true],
    ['another archetype', { ...tf, agentContext: { archetype: 'analyst' } }, false, false],
    ['a CPU side', { ...tf, isCpu: true }, false, false],
    ['a training clone', { ...tf, agentId: 'training-agent-1' }, false, false],
    ['a tournament mode', { ...tf, gameMode: 'baggerbomb_tournament' }, false, false],
    ['a tournament context', tf, true, false],
    ['no battle', null, false, false],
  ])('%s', (_label, battle, isTournament, expected) => {
    expect(poolScopeAdmits(battle, { isTournament })).toBe(expected);
  });
  it('selectors are recorded only from the closed list', () => {
    expect(['archetype', 'legacy', 'carried', 'x', null].map(selectorOf)).toEqual(['archetype', 'legacy', 'carried', null, null]);
  });
});
