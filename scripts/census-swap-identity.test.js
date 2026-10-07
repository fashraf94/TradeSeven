// scripts/census-swap-identity.test.js
//
// Pilot P6 — the census script, on a FIXTURE (scripts/__fixtures__/
// swapIdentityCensusBattles.json), against a read-only double. Importing the
// module runs nothing: main() is guarded behind the CLI entrypoint and loads
// its credentials lazily, so no environment file, admin SDK or network is
// touched here — and that passing load is itself the BUILD_RULES §4
// dependency-surface guard for this script.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  beliefFromEvaluationId, beliefOfTrade, computeSwapIdentityCensus, renderCensus, runCensus, parseArgs, CALLERS,
} from './census-swap-identity.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(resolve(HERE, 'census-swap-identity.mjs'), 'utf8');
const { _about: _ignored, ...FIXTURE } = JSON.parse(readFileSync(resolve(HERE, '__fixtures__/swapIdentityCensusBattles.json'), 'utf8'));

/** A read-only double: no write method exists to call. */
function makeReader(battles) {
  const reads = [];
  return {
    reads,
    async listBattles() { reads.push(['list']); return Object.entries(battles).map(([id, b]) => ({ id, status: b.status, expiresAt: b.expiresAt })); },
    async readBattles(ids) { reads.push(['read', ...ids]); return new Map(ids.map((id) => [id, structuredClone(battles[id])])); },
  };
}

describe('the belief each retained row carries (Phase 0 §6.3)', () => {
  it.each([
    ['risk_stop_loss_KO_1791385200000', { caller: 'risk', belief: 'KO' }],
    ['risk_vwap_failure_PG_1791385260000', { caller: 'risk', belief: 'PG' }], // a reason with an underscore
    ['risk_bust_avoidance_BRK.B_1790000000000', { caller: 'risk', belief: 'BRK.B' }],
    ['guardrail_stopLoss_TSLA_1791386400000', { caller: 'suppression', belief: 'TSLA' }],
    ['gameplan_KO_AMD_1791386100000', { caller: 'meeting', belief: 'KO' }],
  ])('%s → %j', (id, expected) => {
    expect(beliefFromEvaluationId(id)).toEqual(expected);
  });

  it('an evaluation id carries no belief of its own', () => {
    expect(beliefFromEvaluationId('eval_004')).toBeNull();
    expect(beliefFromEvaluationId(undefined)).toBeNull();
  });

  it('model and proposal rows join the evaluation (then the proposal history); an aged-out join is UNKNOWN, never a match', () => {
    const b = FIXTURE['b-shadow'];
    expect(beliefOfTrade(b.trades[2], b)).toEqual({ caller: 'model', belief: 'MSFT' });
    expect(beliefOfTrade(b.trades[3], b)).toEqual({ caller: 'model', belief: null });
    expect(beliefOfTrade(b.trades[6], b)).toEqual({ caller: 'proposal', belief: 'AMZN' });
  });
});

describe('the census on the fixture', () => {
  const result = computeSwapIdentityCensus(FIXTURE);

  it('counts every caller: rows, joined beliefs, unknowns, and believed ≠ committed', () => {
    const shape = Object.fromEntries(CALLERS.map((c) => [c, [result.byCaller[c].trades, result.byCaller[c].beliefKnown, result.byCaller[c].beliefUnknown, result.byCaller[c].mismatches]]));
    expect(shape).toEqual({
      risk: [3, 3, 0, 1],
      model: [2, 1, 1, 0],
      proposal: [1, 1, 0, 0],
      suppression: [1, 1, 0, 1],
      meeting: [2, 2, 0, 1],
      unknown: [0, 0, 0, 0],
    });
    expect(result.tradeRows).toBe(9);
    expect(result.mismatches.map((m) => `${m.caller}:${m.believed}->${m.committed}`)).toEqual([
      'risk:PG->XOM', 'suppression:TSLA->NVDA', 'meeting:TSLA->MSFT',
    ]);
  });

  it('counts trades[].verification by caller × verdict × basis, and the modes seen', () => {
    expect(result.byCaller.risk.verification).toMatchObject({ present: 2, match: 1, mismatch: 1, symbol_and_entry: 2 });
    expect(result.byCaller.meeting.verification).toMatchObject({ present: 1, match: 1, symbol_only: 1 });
    expect(result.byCaller.proposal.verification).toMatchObject({ present: 1, not_checked: 1, symbol_and_entry: 0, symbol_only: 0 });
    expect(result.modesSeen).toEqual({ shadow: 5, enforce: 1 });
    expect(result.verificationMismatches).toHaveLength(1);
  });

  it('surfaces a verdict that disagrees with the symbol comparison (a bug signal, must be 0 in production)', () => {
    expect(result.disagreements).toEqual([
      expect.objectContaining({ caller: 'suppression', believed: 'TSLA', committed: 'NVDA', verdict: 'match' }),
    ]);
  });

  it('counts the refusals each channel recorded, and the honest-record markers', () => {
    expect(result.refusals).toEqual({
      entries: { outgoing_identity_mismatch: 1 },
      proposalHistory: { battle_not_active: 1 },
      meetingLegs: { 'outgoing_identity_mismatch (departed)': 1, outgoing_identity_mismatch: 1 },
      feedBeats: { 'risk_manager:outgoing_identity_mismatch': 1 },
    });
    expect(result.honest).toEqual({ proposalExecutionFailed: 2, autoExecutionFailed: 1 });
  });

  it('prints the retained window of every battle', () => {
    expect(result.windows).toEqual([
      { battleId: 'b-shadow', rows: 7, from: '2026-10-06T15:00:00.000Z', to: '2026-10-08T15:30:00.000Z' },
      { battleId: 'b-off', rows: 2, from: '2026-10-01T15:00:00.000Z', to: '2026-10-01T15:01:00.000Z' },
    ]);
  });

  it('renders a report that leads with the comparison and states the disagreement count', () => {
    const md = renderCensus(result, { readAt: '2026-10-09T12:00:00.000Z' });
    expect(md).toMatch(/^# Swap identity census/);
    expect(md).toContain('| risk | 3 | 3 | 0 | 1 |');
    expect(md).toContain('Verdict disagrees with the symbol comparison (must be 0): **1**');
    expect(md).toContain('shadow 5, enforce 1');
  });
});

describe('the read — scoped, read-only', () => {
  it('--since counts only rows committed at/after it, and never reads a battle that expired before it', async () => {
    const reader = makeReader(FIXTURE);
    const result = await runCensus(reader, { sinceMs: Date.parse('2026-10-07T00:00:00.000Z') });
    expect(reader.reads).toEqual([['list'], ['read', 'b-shadow']]);
    expect(result.battles).toBe(1);
    expect(result.tradeRows).toBe(6);
    expect(result.byCaller.model.beliefUnknown).toBe(0); // the 6 Oct row is outside the window
  });

  it('without --since every battle and every retained row is read', async () => {
    const reader = makeReader(FIXTURE);
    const result = await runCensus(reader);
    expect(reader.reads).toEqual([['list'], ['read', 'b-shadow', 'b-off']]);
    expect(result.tradeRows).toBe(9);
  });

  it('parses its arguments; a malformed --since fails loudly', () => {
    expect(parseArgs(['--since=2026-10-08T13:30:00Z', '--out', 'r.md', '--json', 'r.json'])).toEqual({ outPath: 'r.md', jsonPath: 'r.json', sinceMs: Date.parse('2026-10-08T13:30:00Z') });
    expect(parseArgs([])).toEqual({ outPath: null, jsonPath: null, sinceMs: null });
    expect(() => parseArgs(['--since=yesterday'])).toThrow(/ISO instant/);
  });

  it('the source holds no Firestore write and loads its credentials only inside main()', () => {
    const code = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
    expect(code).not.toMatch(/\.(set|update|delete|create)\(|runTransaction|\.batch\(|bulkWriter|FieldValue/);
    expect(code).not.toMatch(/^import ['"]\.\/loadLocalEnv\.js['"]/m);
    expect(code).not.toMatch(/^import .*firebaseAdmin/m);
    expect(code).toMatch(/await import\('\.\/loadLocalEnv\.js'\)/);
    expect(code).toMatch(/if \(invokedDirectly\) main\(\)/);
  });
});
