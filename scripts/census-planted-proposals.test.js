// scripts/census-planted-proposals.test.js
//
// The planted-proposal detection census (integrity build, 7 Oct 2026) on its
// fixture (scripts/__fixtures__/plantedProposalCensusBattles.json), against a
// read-only double. Importing the module runs nothing — main() is guarded
// behind the CLI entrypoint and loads its credentials lazily — and that passing
// load is the BUILD_RULES §4 dependency-surface guard for this script.

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from 'acorn';
import {
  LAUNCH_GUARD_LANDED, TRADE_ROW_KEYS, MATCH_WINDOW_MS,
  isProposalExecutionBeat, isExecutedResolution, tradesForBeat, foreignKeysOf, gainContradictsPrices,
  computePlantedProposalCensus, renderPlantedProposalCensus, runPlantedProposalCensus, parseArgs,
} from './census-planted-proposals.mjs';
import { EXECUTOR_COMPUTED_KEYS, EXECUTOR_METADATA_KEYS } from '../api/_utils/executorMetadata.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(resolve(HERE, 'census-planted-proposals.mjs'), 'utf8');
const { _about: _ignored, ...FIXTURE } = JSON.parse(readFileSync(resolve(HERE, '__fixtures__/plantedProposalCensusBattles.json'), 'utf8'));

function makeReader(battles) {
  const reads = [];
  return {
    reads,
    async listBattles() { reads.push(['list']); return Object.entries(battles).map(([id, b]) => ({ id, status: b.status })); },
    async readBattles(ids) { reads.push(['read', ...ids]); return new Map(ids.map((id) => [id, structuredClone(battles[id])])); },
  };
}

describe('the launch-guard date and the row keys', () => {
  it('LAUNCH_GUARD_LANDED is PR #421\'s merge (fcbd71c5, carrying 84254065) and the header cites both commits', () => {
    expect(LAUNCH_GUARD_LANDED).toBe('2026-05-20T17:17:29.000Z');
    expect(SOURCE).toMatch(/84254065/);
    expect(SOURCE).toMatch(/fcbd71c5/);
    expect(SOURCE).toMatch(/PR #421/);
  });

  it('a trade row may carry exactly the executor\'s computed fields plus the metadata allowlist', () => {
    expect([...TRADE_ROW_KEYS].sort()).toEqual([...EXECUTOR_COMPUTED_KEYS, ...EXECUTOR_METADATA_KEYS].sort());
    expect(foreignKeysOf(Object.fromEntries(TRADE_ROW_KEYS.map((k) => [k, 1])))).toEqual([]);
    expect(foreignKeysOf({ lockedPoints: 9999, bonusPoints: 1, scoreOverride: 2 })).toEqual(['bonusPoints', 'scoreOverride']);
    for (const v of [null, 5, 'x', []]) expect(foreignKeysOf(v)).toEqual([]);
  });
});

describe('the evidence predicates', () => {
  it('a proposal execution beat is the server\'s proposal_system swap beat — never a hold or another source', () => {
    expect(isProposalExecutionBeat({ source: 'proposal_system', action: 'swap' })).toBe(true);
    expect(isProposalExecutionBeat({ source: 'proposal_system', action: 'hold' })).toBe(false);
    expect(isProposalExecutionBeat({ source: 'haiku', action: 'swap' })).toBe(false);
    expect(isProposalExecutionBeat(null)).toBe(false);
  });

  it('an executed resolution is approved / auto_executed — whatever note or marker the row also carries (both can be planted)', () => {
    expect(isExecutedResolution({ resolution: 'approved' })).toBe(true);
    expect(isExecutedResolution({ resolution: 'auto_executed', systemNote: 'launch_guard_clear' })).toBe(true);
    expect(isExecutedResolution({ resolution: 'approved', executionFailed: true })).toBe(true);
    for (const r of ['vetoed', 'lapsed', 'auto_execution_failed', null]) expect(isExecutedResolution({ resolution: r })).toBe(false);
    expect(isExecutedResolution(null)).toBe(false);
  });

  it('a beat matches the rows with its incoming symbol swapped out within the window', () => {
    const beat = { timestamp: '2026-09-02T15:00:00.000Z', symbolIn: 'AMD' };
    const at = Date.parse(beat.timestamp);
    const rows = [
      { symbolIn: 'AMD', swappedOutAt: new Date(at + MATCH_WINDOW_MS).toISOString() },
      { symbolIn: 'AMD', swappedOutAt: new Date(at + MATCH_WINDOW_MS + 1).toISOString() },
      { symbolIn: 'JPM', swappedOutAt: beat.timestamp },
      { symbolIn: 'AMD', swappedOutAt: null },
    ];
    expect(tradesForBeat(beat, rows)).toEqual([rows[0]]);
    expect(tradesForBeat({ symbolIn: 'AMD' }, rows)).toEqual([]);
  });

  it('a gain that does not follow from the row\'s own prices (either sign; the executor rounds to 0.001)', () => {
    expect(gainContradictsPrices({ entryPrice: 62.2, exitPrice: 61.5, lockedGainPct: -1.125 })).toBe(false);
    expect(gainContradictsPrices({ entryPrice: 165.3, exitPrice: 163.6, lockedGainPct: 1.028 })).toBe(false); // a short
    expect(gainContradictsPrices({ entryPrice: 0.01, exitPrice: 777, lockedGainPct: 0 })).toBe(true);
    expect(gainContradictsPrices({ entryPrice: 62.2, exitPrice: 61.5, lockedGainPct: -1.2 })).toBe(true);
    expect(gainContradictsPrices({ entryPrice: 0, exitPrice: 5, lockedGainPct: 0 })).toBe(false); // no entry → the executor writes 0
    expect(gainContradictsPrices({ entryPrice: 10 })).toBe(false);
  });
});

describe('the census on the fixture', () => {
  const result = computePlantedProposalCensus(FIXTURE);
  const kinds = (battleId) => result.executions.filter((e) => e.battleId === battleId).map((e) => e.kind);

  it('§1: the planted approved and expired executions after the guard, with the forged row where it matches', () => {
    expect(kinds('b-planted-approved')).toEqual(['feed beat', 'history row']);
    expect(kinds('b-planted-expired')).toEqual(['feed beat', 'history row']);
    const approvedBeat = result.executions.find((e) => e.battleId === 'b-planted-approved' && e.kind === 'feed beat');
    expect(approvedBeat.trades).toEqual([expect.objectContaining({ symbolOut: 'FAKE', symbolIn: 'AMD', lockedPoints: 9999, entryPrice: 0.01, exitPrice: 777, evaluationId: 'forged' })]);
    // The expired row's forged time keeps it from matching — the beat still counts.
    expect(result.executions.find((e) => e.battleId === 'b-planted-expired' && e.kind === 'feed beat').trades).toEqual([]);
  });

  it('§1: a copied row that CLAIMS a launch-guard clear or a failure is still an execution when its same-pair trade sits beside it (review I4-5)', () => {
    expect(kinds('b-planted-note')).toEqual(['history row — claims a launch-guard clear, but a same-pair trade sits beside it']);
    expect(result.executions.find((e) => e.battleId === 'b-planted-note').trades).toEqual([expect.objectContaining({ symbolOut: 'TSLA', symbolIn: 'JPM', lockedPoints: 300 })]);
    expect(kinds('b-planted-failed')).toEqual(['history row — marked failed, but a same-pair trade sits beside it']);
  });

  it('§1: an executed row whose time cannot be read is listed (time unknown), never skipped', () => {
    expect(result.executions.filter((e) => e.battleId === 'b-bad-time')).toEqual([expect.objectContaining({ kind: 'history row', at: 'time unknown', proposalId: 'prop_t' })]);
  });

  it('the pre-guard execution is outside the default window and inside an earlier --since', () => {
    expect(result.executions.some((e) => e.battleId === 'b-pre-guard')).toBe(false);
    const wide = computePlantedProposalCensus(FIXTURE, { sinceMs: Date.parse('2026-04-01T00:00:00Z') });
    expect(wide.executions.filter((e) => e.battleId === 'b-pre-guard').map((e) => e.kind)).toEqual(['feed beat', 'history row']);
    expect(wide.executions.find((e) => e.battleId === 'b-pre-guard').trades).toHaveLength(1);
  });

  it('§1b / §1c: a clear or a failure with no trade beside it is listed apart, never as an execution', () => {
    expect(result.guardClears).toEqual([{ battleId: 'b-guard-cleared', at: '2026-09-05T15:00:00.000Z', proposalId: 'prop_z', symbolOut: 'KO', symbolIn: 'AMD' }]);
    expect(result.failedApprovals).toEqual([{ battleId: 'b-failed', at: '2026-09-06T15:00:00.000Z', proposalId: 'prop_f', symbolOut: 'KO', symbolIn: 'AMD' }]);
    expect(result.executions.some((e) => ['b-guard-cleared', 'b-failed', 'b-clean'].includes(e.battleId))).toBe(false);
  });

  it('§2: the foreign key, with its battle and a sample; the clean battle has none', () => {
    expect(Object.keys(result.foreignKeys)).toEqual(['bonusPoints']);
    expect(result.foreignKeys.bonusPoints).toMatchObject({ rows: 1, battles: ['b-planted-approved'] });
    expect(result.foreignKeys.bonusPoints.samples[0]).toMatchObject({ battleId: 'b-planted-approved', index: 0, value: '50', lockedPoints: 9999 });
  });

  it('§2b: rows that contradict themselves — a gain its prices do not imply, a row out of time order', () => {
    expect(result.contradictions.map((c) => [c.battleId, c.index, c.why])).toEqual([
      ['b-planted-approved', 0, 'gain does not follow from its prices'],
      ['b-planted-note', 1, 'swapped out before the row it follows'],
    ]);
  });

  it('a launch-guard note on a resolution the guard never writes is planted — an execution suspect even with no trade beside it (review IV4-I4-5)', () => {
    const out = computePlantedProposalCensus({ b: { proposalHistory: [{ proposalId: 'p', symbolOut: 'KO', symbolIn: 'AMD', resolution: 'approved', resolvedBy: 'owner', systemNote: 'launch_guard_clear', resolvedAt: '2026-09-09T15:00:00Z' }] } });
    expect(out.executions.map((e) => e.kind)).toEqual([expect.stringMatching(/^history row — carries the launch guard.s note on a resolution the guard never writes$/)]);
    expect(out.guardClears).toEqual([]);
  });

  it('every read sets the verdict — a lone launch-guard clear or a lone failure is still a planted proposal (review IV4-I4-5)', () => {
    expect(computePlantedProposalCensus({ 'b-guard-cleared': FIXTURE['b-guard-cleared'] }).flagged).toBe(true);
    expect(computePlantedProposalCensus({ 'b-failed': FIXTURE['b-failed'] }).flagged).toBe(true);
  });

  it('the clean battle and the pre-guard execution read clean', () => {
    const clean = computePlantedProposalCensus({ 'b-clean': FIXTURE['b-clean'], 'b-pre-guard': FIXTURE['b-pre-guard'] });
    expect(clean).toMatchObject({ executions: [], guardClears: [], failedApprovals: [], foreignKeys: {}, contradictions: [], flagged: false });
  });

  it('flags the result; counts every battle and row; prints each window', () => {
    expect(result.flagged).toBe(true);
    expect(result.battles).toBe(Object.keys(FIXTURE).length);
    expect(result.tradeRows).toBe(8);
    expect(result.windows.map((w) => w.battleId)).toEqual(Object.keys(FIXTURE));
    expect(result.windows.find((w) => w.battleId === 'b-planted-approved')).toMatchObject({ executionMode: 'copilot', trades: 1, beats: 1, proposalHistory: 1 });
  });

  it('renders the verdict, every read and the windows, with cells escaped; a clean read says so', () => {
    const md = renderPlantedProposalCensus(result, { readAt: '2026-10-08T00:00:00Z' });
    expect(md).toMatch(/\*\*Verdict:\*\* FOUND/);
    expect(md).toMatch(/## 1\. Proposals that executed after the launch guard landed/);
    expect(md).toMatch(/9999 · 0\.01 → 777 · forged/);
    expect(md).toMatch(/none matched \(forged symbol\/time, or aged out\)/);
    expect(md).toMatch(/### 1b\./);
    expect(md).toMatch(/### 1c\./);
    expect(md).toMatch(/\| bonusPoints \| 1 \| b-planted-approved \|/);
    expect(md).toMatch(/### 2b\./);
    expect(md).toMatch(/## 3\. Retained windows/);
    const piped = renderPlantedProposalCensus(computePlantedProposalCensus({ 'b|x': { proposalHistory: [{ resolution: 'approved', resolvedAt: '2026-09-01T00:00:00Z', proposalId: 'a|b\nc' }] } }));
    expect(piped).toMatch(/\| b\\\|x \| history row \|/);
    const clean = renderPlantedProposalCensus(computePlantedProposalCensus({ 'b-clean': FIXTURE['b-clean'] }));
    expect(clean).toMatch(/nothing found in the retained window/);
    expect(clean).toMatch(/None — every retained row carries only/);
  });

  it('accepts a Map and an empty input', () => {
    expect(computePlantedProposalCensus(new Map(Object.entries(FIXTURE))).executions).toHaveLength(result.executions.length);
    expect(computePlantedProposalCensus({}).flagged).toBe(false);
    expect(computePlantedProposalCensus(null).battles).toBe(0);
  });
});

describe('the read and the arguments', () => {
  it('reads every battle through the read-only reader', async () => {
    const reader = makeReader(FIXTURE);
    const out = await runPlantedProposalCensus(reader);
    expect(reader.reads).toEqual([['list'], ['read', ...Object.keys(FIXTURE)]]);
    expect(out.executions).toHaveLength(computePlantedProposalCensus(FIXTURE).executions.length);
  });

  it('--since defaults to the launch guard; both spellings parse; a bad instant throws', () => {
    expect(parseArgs([])).toEqual({ outPath: null, jsonPath: null, sinceMs: Date.parse(LAUNCH_GUARD_LANDED) });
    const at = Date.parse('2026-05-01T00:00:00Z');
    expect(parseArgs(['--since=2026-05-01T00:00:00Z', '--out', 'r.md', '--json', 'd.json'])).toEqual({ outPath: 'r.md', jsonPath: 'd.json', sinceMs: at });
    expect(parseArgs(['--since', '2026-05-01T00:00:00Z']).sinceMs).toBe(at);
    expect(() => parseArgs(['--since=yesterday'])).toThrow(/ISO instant/);
    expect(() => parseArgs(['--since'])).toThrow(/ISO instant/);
  });

  it('every member call in the source — walked on its syntax tree, template expressions and computed members included — is on a reviewed read-only allowlist (review I4-10)', () => {
    const ast = parse(SOURCE, { ecmaVersion: 'latest', sourceType: 'module' });
    const calls = new Set();
    const computed = [];
    const walk = (n) => {
      if (!n || typeof n.type !== 'string') return;
      if (n.type === 'CallExpression' && n.callee.type === 'MemberExpression') {
        if (!n.callee.computed) calls.add(n.callee.property.name);
        else if (n.callee.property.type === 'Literal') calls.add(String(n.callee.property.value));
        else computed.push(SOURCE.slice(n.start, n.end));
      }
      for (const k of Object.keys(n)) {
        const v = n[k];
        if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v);
      }
    };
    walk(ast);
    const ALLOWED = [
      // Firestore — reads only
      'collection', 'doc', 'select', 'get', 'getAll', 'data',
      // the read-only reader's own methods
      'listBattles', 'readBattles',
      // language
      'abs', 'catch', 'endsWith', 'entries', 'error', 'exit', 'filter', 'find', 'forEach', 'freeze', 'has', 'includes', 'isArray',
      'isFinite', 'join', 'keys', 'log', 'map', 'max', 'min', 'parse', 'pop', 'push', 'replace', 'slice', 'split', 'startsWith',
      'stringify', 'then', 'toISOString', 'toMillis', 'indexOf',
    ];
    expect([...calls].filter((c) => !ALLOWED.includes(c)).sort()).toEqual([]);
    expect(computed).toEqual([]);
    expect(calls.size).toBeGreaterThan(20);
    expect(SOURCE).not.toMatch(/runTransaction|bulkWriter|recursiveDelete|writeBatch|FieldValue/);
  });

  it('loads its credentials only inside main(), and importing it runs no env loader', async () => {
    const code = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
    expect(code).not.toMatch(/^import ['"]\.\/loadLocalEnv\.js['"]/m);
    expect(code).not.toMatch(/^import .*firebaseAdmin/m);
    expect(code).toMatch(/await import\('\.\/loadLocalEnv\.js'\)/);
    expect(code).toMatch(/if \(invokedDirectly\) main\(\)/);
    vi.resetModules();
    const loaded = vi.fn();
    vi.doMock('./loadLocalEnv.js', () => { loaded(); return {}; });
    try {
      await import('./census-planted-proposals.mjs');
      expect(loaded).not.toHaveBeenCalled();
    } finally {
      vi.doUnmock('./loadLocalEnv.js');
      vi.resetModules();
    }
  });
});
