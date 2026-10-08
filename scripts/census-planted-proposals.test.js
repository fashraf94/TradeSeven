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
import {
  LAUNCH_GUARD_LANDED, TRADE_ROW_KEYS, MATCH_WINDOW_MS,
  isProposalExecutionBeat, isExecutedProposalRow, tradesForBeat, foreignKeysOf,
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

  it('an executed history row is approved / auto_executed — never a launch-guard clear or a failed execution', () => {
    expect(isExecutedProposalRow({ resolution: 'approved' })).toBe(true);
    expect(isExecutedProposalRow({ resolution: 'auto_executed' })).toBe(true);
    expect(isExecutedProposalRow({ resolution: 'auto_executed', systemNote: 'launch_guard_clear' })).toBe(false);
    expect(isExecutedProposalRow({ resolution: 'approved', executionFailed: true })).toBe(false);
    for (const r of ['vetoed', 'lapsed', 'auto_execution_failed', null]) expect(isExecutedProposalRow({ resolution: r })).toBe(false);
    expect(isExecutedProposalRow(null)).toBe(false);
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
});

describe('the census on the fixture', () => {
  const result = computePlantedProposalCensus(FIXTURE);

  it('§1: the planted approved and expired executions after the guard, with the forged row where it matches', () => {
    expect(result.executions.map((e) => [e.battleId, e.kind])).toEqual([
      ['b-planted-approved', 'feed beat'], ['b-planted-approved', 'history row'],
      ['b-planted-expired', 'feed beat'], ['b-planted-expired', 'history row'],
    ]);
    const approvedBeat = result.executions[0];
    expect(approvedBeat.trades).toEqual([expect.objectContaining({ symbolOut: 'FAKE', symbolIn: 'AMD', lockedPoints: 9999, entryPrice: 0.01, exitPrice: 777, evaluationId: 'forged' })]);
    // The expired row's forged time keeps it from matching — the beat still counts.
    expect(result.executions[2].trades).toEqual([]);
  });

  it('the pre-guard execution is outside the default window and inside an earlier --since', () => {
    expect(result.executions.some((e) => e.battleId === 'b-pre-guard')).toBe(false);
    const wide = computePlantedProposalCensus(FIXTURE, { sinceMs: Date.parse('2026-04-01T00:00:00Z') });
    expect(wide.executions.filter((e) => e.battleId === 'b-pre-guard').map((e) => e.kind)).toEqual(['feed beat', 'history row']);
    expect(wide.executions.find((e) => e.battleId === 'b-pre-guard').trades).toHaveLength(1);
  });

  it('§1b: a launch-guard clear is listed apart, never as an execution; a failed execution is neither', () => {
    expect(result.guardClears).toEqual([{ battleId: 'b-guard-cleared', at: '2026-09-05T15:00:00.000Z', proposalId: 'prop_z', symbolOut: 'KO', symbolIn: 'AMD' }]);
    expect(result.executions.some((e) => ['b-guard-cleared', 'b-failed'].includes(e.battleId))).toBe(false);
  });

  it('§2: the foreign key, with its battle and a sample; the clean battle has none', () => {
    expect(Object.keys(result.foreignKeys)).toEqual(['bonusPoints']);
    expect(result.foreignKeys.bonusPoints).toMatchObject({ rows: 1, battles: ['b-planted-approved'] });
    expect(result.foreignKeys.bonusPoints.samples[0]).toMatchObject({ battleId: 'b-planted-approved', index: 0, value: '50', lockedPoints: 9999 });
    const clean = computePlantedProposalCensus({ 'b-clean': FIXTURE['b-clean'] });
    expect(clean.foreignKeys).toEqual({});
    expect(clean.executions).toEqual([]);
    expect(clean.flagged).toBe(false);
  });

  it('flags the result; counts every battle and row; prints each window', () => {
    expect(result.flagged).toBe(true);
    expect(result.battles).toBe(6);
    expect(result.tradeRows).toBe(5);
    expect(result.windows.map((w) => w.battleId)).toEqual(Object.keys(FIXTURE));
    expect(result.windows.find((w) => w.battleId === 'b-planted-approved')).toMatchObject({ executionMode: 'copilot', trades: 1, beats: 1, proposalHistory: 1 });
  });

  it('renders the verdict, both reads and the windows; a clean read says so', () => {
    const md = renderPlantedProposalCensus(result, { readAt: '2026-10-08T00:00:00Z' });
    expect(md).toMatch(/\*\*Verdict:\*\* FOUND/);
    expect(md).toMatch(/## 1\. Proposals that executed after the launch guard landed/);
    expect(md).toMatch(/9999 · 0\.01 → 777 · forged/);
    expect(md).toMatch(/none matched \(forged symbol\/time, or aged out\)/);
    expect(md).toMatch(/### 1b\./);
    expect(md).toMatch(/\| bonusPoints \| 1 \| b-planted-approved \|/);
    expect(md).toMatch(/## 3\. Retained windows/);
    const clean = renderPlantedProposalCensus(computePlantedProposalCensus({ 'b-clean': FIXTURE['b-clean'] }));
    expect(clean).toMatch(/nothing found in the retained window/);
    expect(clean).toMatch(/None — every retained row carries only/);
  });

  it('accepts a Map and an empty input', () => {
    expect(computePlantedProposalCensus(new Map(Object.entries(FIXTURE))).executions).toHaveLength(4);
    expect(computePlantedProposalCensus({}).flagged).toBe(false);
    expect(computePlantedProposalCensus(null).battles).toBe(0);
  });
});

describe('the read and the arguments', () => {
  it('reads every battle through the read-only reader', async () => {
    const reader = makeReader(FIXTURE);
    const out = await runPlantedProposalCensus(reader);
    expect(reader.reads).toEqual([['list'], ['read', ...Object.keys(FIXTURE)]]);
    expect(out.executions).toHaveLength(4);
  });

  it('--since defaults to the launch guard; both spellings parse; a bad instant throws', () => {
    expect(parseArgs([])).toEqual({ outPath: null, jsonPath: null, sinceMs: Date.parse(LAUNCH_GUARD_LANDED) });
    const at = Date.parse('2026-05-01T00:00:00Z');
    expect(parseArgs(['--since=2026-05-01T00:00:00Z', '--out', 'r.md', '--json', 'd.json'])).toEqual({ outPath: 'r.md', jsonPath: 'd.json', sinceMs: at });
    expect(parseArgs(['--since', '2026-05-01T00:00:00Z']).sinceMs).toBe(at);
    expect(() => parseArgs(['--since=yesterday'])).toThrow(/ISO instant/);
    expect(() => parseArgs(['--since'])).toThrow(/ISO instant/);
  });

  it('every member call in the source is on a reviewed read-only allowlist — a write, an .add or a batch fails here', () => {
    const code = SOURCE
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
      .replace(/'[^'\n]*'|`[^`]*`/g, '""');
    const calls = [...new Set([...code.matchAll(/\.([A-Za-z_$][\w$]*)\(/g)].map((m) => m[1]))].sort();
    const ALLOWED = [
      // Firestore — reads only
      'collection', 'doc', 'select', 'get', 'getAll', 'data',
      // the read-only reader's own methods
      'listBattles', 'readBattles',
      // language
      'catch', 'endsWith', 'entries', 'error', 'filter', 'flatMap', 'forEach', 'freeze', 'has', 'includes', 'isArray', 'isFinite',
      'join', 'keys', 'log', 'map', 'max', 'min', 'parse', 'pop', 'push', 'replace', 'slice', 'some', 'split', 'startsWith', 'stringify',
      'toISOString', 'toMillis', 'abs', 'exit', 'find', 'indexOf',
      // the module's own row summary, called through a spread (`...short(trade)` reads as `.short(`)
      'short',
    ];
    expect(calls.filter((c) => !ALLOWED.includes(c))).toEqual([]);
    expect(calls.length).toBeGreaterThan(20);
    expect(code).not.toMatch(/runTransaction|bulkWriter|recursiveDelete|writeBatch|FieldValue|\.set\(|\.update\(|\.add\(|\.delete\(/);
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
