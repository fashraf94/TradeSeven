// scripts/census-swap-identity.test.js
//
// Pilot P6 — the census script, on a FIXTURE (scripts/__fixtures__/
// swapIdentityCensusBattles.json), against a read-only double. Importing the
// module runs nothing: main() is guarded behind the CLI entrypoint and loads
// its credentials lazily, so no environment file, admin SDK or network is
// touched here — and that passing load is itself the BUILD_RULES §4
// dependency-surface guard for this script.

import { describe, it, expect, vi as viS5 } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  beliefFromEvaluationId, beliefOfTrade, isExecutorVerification, computeSwapIdentityCensus, renderCensus, runCensus, parseArgs, CALLERS,
} from './census-swap-identity.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(resolve(HERE, 'census-swap-identity.mjs'), 'utf8');
const { _about: _ignored, ...FIXTURE } = JSON.parse(readFileSync(resolve(HERE, '__fixtures__/swapIdentityCensusBattles.json'), 'utf8'));
const SINCE_7_OCT = Date.parse('2026-10-07T00:00:00.000Z');

/** A read-only double: no write method exists to call. */
function makeReader(battles) {
  const reads = [];
  return {
    reads,
    async listBattles() { reads.push(['list']); return Object.entries(battles).map(([id, b]) => ({ id, status: b.status, expiresAt: b.expiresAt })); },
    async readBattles(ids) { reads.push(['read', ...ids]); return new Map(ids.map((id) => [id, structuredClone(battles[id])])); },
  };
}

/** Per caller: [trades, belief joined, belief unknown, belief ambiguous, believed ≠ committed]. */
const shapeOf = (result) => Object.fromEntries(CALLERS.map((c) => {
  const r = result.byCaller[c];
  return [c, [r.trades, r.beliefKnown, r.beliefUnknown, r.beliefAmbiguous, r.mismatches]];
}));

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
    expect(beliefOfTrade(b.trades[2], b)).toEqual({ caller: 'model', belief: 'MSFT', ambiguous: false });
    expect(beliefOfTrade(b.trades[3], b)).toEqual({ caller: 'model', belief: null, ambiguous: false });
    expect(beliefOfTrade(b.trades[6], b)).toEqual({ caller: 'proposal', belief: 'AMZN', ambiguous: false });
  });

  it('a repeated evaluation id (battles older than the Sep 21 counter) joins on the incoming symbol too — never the first entry by id (review S4-2)', () => {
    const b = FIXTURE['b-dup'];
    expect(beliefOfTrade(b.trades[0], b)).toEqual({ caller: 'model', belief: 'MSFT', ambiguous: false }); // the FIRST eval_151 believed AAPL
    expect(beliefOfTrade(b.trades[1], b)).toEqual({ caller: 'model', belief: 'AAPL', ambiguous: false });
  });

  it('two entries that share id AND incoming symbol with different beliefs are AMBIGUOUS — never a match, never a mismatch', () => {
    const b = FIXTURE['b-dup'];
    expect(beliefOfTrade(b.trades[2], b)).toEqual({ caller: 'model', belief: null, ambiguous: true });
  });

  it("a co-pilot battle's MODEL swap is a model row (the caller comes from the entry's decision, not the trade's entryMode)", () => {
    const b = FIXTURE['b-dup'];
    expect(b.trades[3].entryMode).toBe('copilot');
    expect(beliefOfTrade(b.trades[3], b)).toEqual({ caller: 'model', belief: 'NVDA', ambiguous: false });
  });

  it('a verification is the executor\'s only with its mode and its own derived id (review S3-3)', () => {
    const trade = { evaluationId: 'eval_7' };
    expect(isExecutorVerification({ mode: 'shadow', verificationId: 'b1:eval_7:verify' }, trade, 'b1')).toBe(true);
    expect(isExecutorVerification({ mode: 'enforce', verificationId: null }, {}, 'b1')).toBe(true); // no evaluation id → the executor writes null
    expect(isExecutorVerification({ mode: 'shadow', verificationId: 'planted' }, trade, 'b1')).toBe(false);
    expect(isExecutorVerification({ mode: 'off', verificationId: 'b1:eval_7:verify' }, trade, 'b1')).toBe(false);
    expect(isExecutorVerification({ verdict: 'match' }, trade, 'b1')).toBe(false);
  });
});

describe('the census on the fixture', () => {
  const result = computeSwapIdentityCensus(FIXTURE);

  it('counts every caller: rows, joined beliefs, unknowns, ambiguous joins, and believed ≠ committed', () => {
    expect(shapeOf(result)).toEqual({
      risk: [3, 3, 0, 0, 1],
      model: [7, 5, 1, 1, 0],
      proposal: [1, 1, 0, 0, 0],
      suppression: [1, 1, 0, 0, 1],
      meeting: [2, 2, 0, 0, 1],
      unknown: [0, 0, 0, 0, 0],
    });
    expect(result.tradeRows).toBe(14);
    expect(result.mismatches.map((m) => `${m.caller}:${m.believed}->${m.committed}`)).toEqual([
      'risk:PG->XOM', 'suppression:TSLA->NVDA', 'meeting:TSLA->MSFT',
    ]);
  });

  it('counts trades[].verification by caller × verdict × basis, and the modes seen', () => {
    expect(result.byCaller.risk.verification).toMatchObject({ present: 2, match: 1, mismatch: 1, symbol_and_entry: 2, invalid: 0 });
    expect(result.byCaller.meeting.verification).toMatchObject({ present: 1, match: 1, symbol_only: 1 });
    expect(result.byCaller.proposal.verification).toMatchObject({ present: 1, not_checked: 1, symbol_and_entry: 0, symbol_only: 0 });
    expect(result.modesSeen).toEqual({ shadow: 5, enforce: 1 });
    expect(result.verificationMismatches).toHaveLength(1);
  });

  it('a verification the executor did not write is counted apart as invalid — never as a verdict, never as a mode', () => {
    expect(result.byCaller.model.verification).toMatchObject({ present: 1, match: 1, invalid: 1 });
    expect(result.invalidVerifications).toEqual([{ battleId: 'b-dup', caller: 'model', evaluationId: 'eval_011', verificationId: 'planted', mode: 'shadow' }]);
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
      meetingLegs: { battle_not_active: 1, 'outgoing_identity_mismatch (departed)': 1, outgoing_identity_mismatch: 1 },
      feedBeats: { 'risk_manager:outgoing_identity_mismatch': 1 },
    });
    expect(result.honest).toEqual({ proposalExecutionFailed: 3, autoExecutionFailed: 2 });
  });

  it('prints the retained trade AND evaluation window of every battle', () => {
    expect(result.windows).toEqual([
      { battleId: 'b-shadow', rows: 7, from: '2026-10-06T15:00:00.000Z', to: '2026-10-08T15:30:00.000Z', evaluations: 2, evaluationsFrom: '2026-10-08T15:15:00.000Z' },
      { battleId: 'b-off', rows: 2, from: '2026-10-01T15:00:00.000Z', to: '2026-10-01T15:01:00.000Z', evaluations: 0, evaluationsFrom: null },
      { battleId: 'b-dup', rows: 5, from: '2026-10-08T16:00:00.000Z', to: '2026-10-08T16:04:00.000Z', evaluations: 7, evaluationsFrom: '2026-10-08T15:00:00.000Z' },
    ]);
  });

  it('renders a report that leads with the comparison, explains unknown/ambiguous, states the disagreement count and the caps', () => {
    const md = renderCensus(result, { readAt: '2026-10-09T12:00:00.000Z' });
    expect(md).toMatch(/^# Swap identity census/);
    expect(md).toContain('| model | 7 | 5 | 1 | 1 | 0 |');
    expect(md).toContain('*Belief unknown*');
    expect(md).toContain('*Belief ambiguous*');
    expect(md).toContain('Verdict disagrees with the symbol comparison (must be 0): **1**');
    expect(md).toContain('shadow 5, enforce 1');
    expect(md).toContain('| b-dup | model | eval_011 | planted | shadow |');
    expect(md).toContain('`evaluations[]` the last 150 entries');
    expect(md).toContain('| b-dup | 5 | 2026-10-08T16:00:00.000Z | 2026-10-08T16:04:00.000Z | 7 | 2026-10-08T15:00:00.000Z |');
  });
});

describe('the read — scoped, read-only', () => {
  it('--since counts only what happened at/after it — trades, entries, beats AND history rows — and never reads a battle that expired before it', async () => {
    const reader = makeReader(FIXTURE);
    const result = await runCensus(reader, { sinceMs: SINCE_7_OCT });
    expect(reader.reads).toEqual([['list'], ['read', 'b-shadow', 'b-dup']]);
    expect(result.battles).toBe(2);
    expect(result.tradeRows).toBe(11);
    expect(result.byCaller.model.beliefUnknown).toBe(0); // the 6 Oct row is outside the window
    // The 1 Oct proposal row and meeting row are outside it too (review S4-6).
    expect(result.honest).toEqual({ proposalExecutionFailed: 2, autoExecutionFailed: 1 });
    expect(result.refusals.meetingLegs).toEqual({ 'outgoing_identity_mismatch (departed)': 1, outgoing_identity_mismatch: 1 });
  });

  it('--since filters entry refusals and feed beats by their own timestamps', () => {
    const shifted = structuredClone(FIXTURE);
    shifted['b-shadow'].evaluations[1].timestamp = '2026-10-01T15:00:00.000Z';
    shifted['b-shadow'].statusFeed[0].timestamp = '2026-10-01T15:00:00.000Z';
    const result = computeSwapIdentityCensus(shifted, { sinceMs: SINCE_7_OCT });
    expect(result.refusals.entries).toEqual({});
    expect(result.refusals.feedBeats).toEqual({});
  });

  it('without --since every battle and every retained row is read', async () => {
    const reader = makeReader(FIXTURE);
    const result = await runCensus(reader);
    expect(reader.reads).toEqual([['list'], ['read', 'b-shadow', 'b-off', 'b-dup']]);
    expect(result.tradeRows).toBe(14);
  });

  it('parses its arguments — both --since forms; a malformed or missing instant fails loudly, never silently widens the read', () => {
    const at = Date.parse('2026-10-08T13:30:00Z');
    expect(parseArgs(['--since=2026-10-08T13:30:00Z', '--out', 'r.md', '--json', 'r.json'])).toEqual({ outPath: 'r.md', jsonPath: 'r.json', sinceMs: at });
    expect(parseArgs(['--since', '2026-10-08T13:30:00Z'])).toEqual({ outPath: null, jsonPath: null, sinceMs: at });
    expect(parseArgs([])).toEqual({ outPath: null, jsonPath: null, sinceMs: null });
    expect(() => parseArgs(['--since=yesterday'])).toThrow(/ISO instant/);
    expect(() => parseArgs(['--since', 'yesterday'])).toThrow(/ISO instant/);
    expect(() => parseArgs(['--since'])).toThrow(/ISO instant/);
  });

  it('every member call in the source is on a reviewed read-only allowlist — a new call (a write, an .add, a batch) fails here (review S4-7)', () => {
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
      'catch', 'endsWith', 'entries', 'error', 'exec', 'exit', 'filter', 'find', 'freeze', 'fromEntries', 'has',
      'includes', 'indexOf', 'isArray', 'isFinite', 'join', 'keys', 'log', 'map', 'parse', 'pop', 'push', 'replace',
      'slice', 'split', 'startsWith', 'stringify', 'toISOString', 'toMillis',
    ];
    expect(calls.filter((c) => !ALLOWED.includes(c))).toEqual([]);
    expect(calls.length).toBeGreaterThan(20); // the scan is real
    expect(code).not.toMatch(/runTransaction|bulkWriter|recursiveDelete|writeBatch|FieldValue/);
  });

  it('loads its credentials only inside main()', () => {
    const code = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
    expect(code).not.toMatch(/^import ['"]\.\/loadLocalEnv\.js['"]/m);
    expect(code).not.toMatch(/^import .*firebaseAdmin/m);
    expect(code).toMatch(/await import\('\.\/loadLocalEnv\.js'\)/);
    expect(code).toMatch(/if \(invokedDirectly\) main\(\)/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Rows the §2 mutation lens (S5) proved necessary: each fails under the named
// surviving mutant and passes on the code as built.
describe('S5 — rows the mutation lens proved', () => {
  it('S5-4: the proposal-history join keys on the incoming symbol too, and conflicting proposal beliefs are AMBIGUOUS', () => {
    const trade = { evaluationId: 'eval_151', symbolIn: 'AMD', symbolOut: 'KO', entryMode: 'copilot' };
    const filtered = { evaluations: [], proposalHistory: [
      { evaluationMetadata: { evaluationId: 'eval_151' }, symbolIn: 'AMD', symbolOut: 'KO' },
      { evaluationMetadata: { evaluationId: 'eval_151' }, symbolIn: 'JPM', symbolOut: 'XOM' }, // same repeated id, another swap
    ] };
    expect(beliefOfTrade(trade, filtered)).toEqual({ caller: 'proposal', belief: 'KO', ambiguous: false });
    const conflicting = { evaluations: [], proposalHistory: [
      { evaluationMetadata: { evaluationId: 'eval_151' }, symbolIn: 'AMD', symbolOut: 'KO' },
      { evaluationMetadata: { evaluationId: 'eval_151' }, symbolIn: 'AMD', symbolOut: 'XOM' },
    ] };
    expect(beliefOfTrade(trade, conflicting)).toEqual({ caller: 'proposal', belief: null, ambiguous: true });
  });

  it('S5-5: --since still reads an ACTIVE battle whose expiresAt has passed (its status not yet flipped — it can still trade)', async () => {
    const reader = makeReader({ 'b-overdue': { status: 'active', expiresAt: '2026-10-03T00:00:00.000Z', trades: [] } });
    await runCensus(reader, { sinceMs: SINCE_7_OCT });
    expect(reader.reads).toEqual([['list'], ['read', 'b-overdue']]);
  });

  it('S5-6: importing the module runs no env loader — it is reached only through main()', async () => {
    viS5.resetModules();
    const loaded = viS5.fn();
    viS5.doMock('./loadLocalEnv.js', () => { loaded(); return {}; });
    try {
      await import('./census-swap-identity.mjs');
      expect(loaded).not.toHaveBeenCalled();
    } finally {
      viS5.doUnmock('./loadLocalEnv.js');
      viS5.resetModules();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Integrity build, Part C item 1 (founder sign-off on PR #940): at enforce the
// executor refuses a swap on a battle that is not exactly 'active' BEFORE it
// compares the identity, so §2 counts such a verification apart — never under
// its verdict, never as a clean match.
describe('Part C — a verification on an inactive battle is "enforce would refuse: battle_not_active"', () => {
  const { _about: _statusAbout, ...STATUS_FIXTURE } = JSON.parse(readFileSync(resolve(HERE, '__fixtures__/swapIdentityCensusBattleStatus.json'), 'utf8'));
  const result = computeSwapIdentityCensus(STATUS_FIXTURE);

  it('a matching identity on a completed battle, a missing status and an absent key are each counted apart, per caller', () => {
    expect(result.byCaller.risk.verification).toMatchObject({ present: 2, match: 0, mismatch: 0, battle_not_active: 2, symbol_and_entry: 2 });
    expect(result.byCaller.meeting.verification).toMatchObject({ present: 1, mismatch: 0, battle_not_active: 1, symbol_only: 1 });
    expect(result.battleNotActive).toEqual([
      { battleId: 'b-ended', caller: 'risk', verificationId: 'b-ended:risk_stop_loss_KO_1791385200000:verify', battleStatus: 'completed', verdict: 'match' },
      { battleId: 'b-ended', caller: 'meeting', verificationId: 'b-ended:gameplan_PG_JPM_1791385300000:verify', battleStatus: null, verdict: 'mismatch' },
      { battleId: 'b-ended', caller: 'risk', verificationId: 'b-ended:risk_vwap_failure_NVDA_1791385400000:verify', battleStatus: null, verdict: 'match' },
    ]);
  });

  it('a verification on an active battle still counts under its verdict; the mismatch list holds active battles only', () => {
    expect(result.byCaller.suppression.verification).toMatchObject({ present: 1, match: 1, battle_not_active: 0 });
    expect(result.verificationMismatches).toEqual([]);
  });

  it('the executor/census cross-check still runs on every executor verification (the inactive mismatch is a symbol mismatch, not a disagreement)', () => {
    expect(result.disagreements).toEqual([]);
    const planted = structuredClone(STATUS_FIXTURE);
    planted['b-ended'].trades[1].verification.verdict = 'match'; // believed PG, committed XOM, says match
    expect(computeSwapIdentityCensus(planted).disagreements).toHaveLength(1);
  });

  it('the report carries the column and lists the rows', () => {
    const md = renderCensus(result);
    expect(md).toMatch(/\| Caller \| Rows with verification \| match \| mismatch \| not_checked \| enforce would refuse: battle_not_active \|/);
    expect(md).toMatch(/\| risk \| 2 \| 0 \| 0 \| 0 \| 2 \|/);
    expect(md).toMatch(/\| b-ended \| risk \| b-ended:risk_stop_loss_KO_1791385200000:verify \| completed \| match \|/);
    expect(md).toMatch(/a matching identity on an ended battle is not a clean match/);
  });

  it('the P6 fixture (every verification on an active battle) is unchanged: nothing counted apart', () => {
    const p6 = computeSwapIdentityCensus(FIXTURE);
    for (const caller of CALLERS) expect(p6.byCaller[caller].verification.battle_not_active, caller).toBe(0);
    expect(p6.battleNotActive).toEqual([]);
  });
});
