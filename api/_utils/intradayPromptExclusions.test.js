// api/_utils/intradayPromptExclusions.test.js — contract §9.2 (a), (b), (c):
// the four prompt-feeding readers and the two summary paths do not read the
// intraday pointer fields, `intradayViews` or `shadowLines`.
//
// Dependency-surface guard (BUILD_RULES §4): the fenced assembler is CALLED
// here (formatRecentEvals — key-explicit by construction, asserted), never
// edited; the non-fenced readers carry the explicit allowlists the build adds.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatRecentEvals } from './agentEvalPromptAssembly.js';
import { buildYourRecordBlock, RECORD_ENTRY_FIELDS, pickRecordEntry } from './voiceLayerGrounding.js';
import { truncateBattleHistory, buildReflectionUserMessage, REFLECTION_EVALUATION_FIELDS } from './agentReflectionUtils.js';
import { pickAnticipationEntry, ANTICIPATION_ENTRY_FIELDS } from './voiceLayerAnticipation.js';
import { INTRADAY_ENTRY_FIELDS } from './intraday/view.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const POINTERS = {
  intradaySnapshotId: '2026-09-17-0042', intradayGeneration: 42, intradayViewRef: 'eval_3', intradayViewStatus: 'written',
  intradayEvaluatedAt: '2026-09-17T15:00:00.000Z', intradayPolicyVersion: 1, decisionStartedAt: '2026-09-17T14:59:58.000Z', decisionCompletedAt: '2026-09-17T15:00:01.000Z',
};
const DIAGNOSTIC_MARKERS = ['intradayViews', 'shadowLines', 'intradaySnapshotId', 'intradayGeneration', 'intradayViewRef', 'intradayViewStatus', 'intradayEvaluatedAt', 'intradayPolicyVersion', 'decisionStartedAt', 'decisionCompletedAt', 'VWAP est.', 'Diagnostic · recorded', '493.12'];
const entry = (i, over = {}) => ({
  evalId: `eval_${i}`, timestamp: `2026-09-17T1${i}:00:00.000Z`, day: 1, battlePhase: 'active', decision: i === 2 ? 'SWAP' : 'HOLD',
  symbolOut: i === 2 ? 'MU' : null, symbolIn: i === 2 ? 'SLB' : null, tier: i === 2 ? 'core' : null,
  rationale: `Rationale ${i}: NVDA leads.`, hypothesis: `Hypothesis: NVDA continues ${i}`, conviction: 70 + i, scores: { active: 1, banked: 2, total: 3 + i },
  triggers: ['scheduled'], evidence: { NVDA: { px: 100 + i, chg: 1, atrX: 0.5, vwapDev: 0.2, bbPct: 10, nr7: false, regime: 'directional_expansion', risk: { action: 'HOLD' } } },
  vintages: { quote: 'tick', vwap: 'diagnostic', techAt: null, fundAsOf: null, rankingsAt: null, intradaySnapshotId: '2026-09-17-0042', intradayGeneration: 42 },
  heard: { directiveThreadId: 't1', suppressed: null },
  ...over,
});
const WITHOUT = [entry(1), entry(2), entry(3)];
const WITH = WITHOUT.map((e) => ({ ...e, ...POINTERS }));
const battle = (evaluations) => ({ id: 'b1', agentContext: { agentName: 'Nova', archetype: 'analyst' }, scoreState: { currentScore: 5, opponentScore: 3 }, gameMode: 'baggerbomb_agent', evaluations, trades: [], statusFeed: [], intradayViews: [{ evalId: 'eval_3', shadowLines: ['NVDA: VWAP est. 493.12 · cutoff unconfirmed'] }] });

describe('§9.2 (b) — the fenced formatRecentEvals is key-explicit', () => {
  it('is byte-identical with and without the eight pointer fields', () => {
    expect(formatRecentEvals(WITH, 3)).toBe(formatRecentEvals(WITHOUT, 3));
    for (const m of DIAGNOSTIC_MARKERS) expect(formatRecentEvals(WITH, 3)).not.toContain(m);
  });
});

describe('§9.2 (c) — the narrator record block reads through an explicit allowlist', () => {
  it('is byte-identical with and without the pointer fields; the allowlist excludes every intraday key', () => {
    const on = buildYourRecordBlock({ evaluations: WITH, directive: null });
    const off = buildYourRecordBlock({ evaluations: WITHOUT, directive: null });
    expect(on).toBe(off);
    for (const m of DIAGNOSTIC_MARKERS) expect(on).not.toContain(m);
    for (const k of INTRADAY_ENTRY_FIELDS) expect(RECORD_ENTRY_FIELDS).not.toContain(k);
    expect(Object.keys(pickRecordEntry(WITH[0])).every((k) => RECORD_ENTRY_FIELDS.includes(k))).toBe(true);
    expect(pickRecordEntry(WITH[0])).not.toHaveProperty('intradayViewRef');
  });
  it('the anticipation note reads only evalId and timestamp', () => {
    expect(ANTICIPATION_ENTRY_FIELDS).toEqual(['evalId', 'timestamp']);
    expect(pickAnticipationEntry(WITH[2])).toEqual({ evalId: 'eval_3', timestamp: WITH[2].timestamp });
    expect(pickAnticipationEntry(null)).toBeNull();
    // Source pin: the module's ONE read of battle.evaluations goes through the pick.
    const src = readFileSync(path.join(HERE, 'voiceLayerAnticipation.js'), 'utf8');
    const lookup = /const found = Array\.isArray\(battle\.evaluations\) && evalId\n\s*\? battle\.evaluations\.find\(\(e\) => e && e\.evalId === evalId\) \|\| null\n\s*: null;\n\s*const evaluation = pickAnticipationEntry\(found\);/;
    expect(src).toMatch(lookup);
    expect(src.replace(lookup, '').match(/battle\.evaluations/g)).toBeNull();
  });
});

describe('§9.2 (a) — the reflection input contains no diagnostic key', () => {
  it('truncateBattleHistory keeps only the allowlisted entry fields; the reflection prompt from a battle with a populated subcollection carries no diagnostic key', () => {
    const truncated = truncateBattleHistory(battle(WITH));
    for (const e of truncated.evaluations) expect(Object.keys(e).every((k) => REFLECTION_EVALUATION_FIELDS.includes(k))).toBe(true);
    for (const k of INTRADAY_ENTRY_FIELDS) expect(REFLECTION_EVALUATION_FIELDS).not.toContain(k);
    const prompt = buildReflectionUserMessage(battle(WITH), { name: 'Nova', archetype: 'analyst' });
    const text = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);
    for (const m of DIAGNOSTIC_MARKERS) expect(text, m).not.toContain(m);
    const promptOff = buildReflectionUserMessage(battle(WITHOUT), { name: 'Nova', archetype: 'analyst' });
    expect(JSON.stringify(prompt)).toBe(JSON.stringify(promptOff));
  });
});

// ---------------------------------------------------------------------------
// Addendum A9 — GOLDEN PINS for the three non-fenced prompt readers.
// Review finding R-4 (docs/audits/20260919_BUILD1_INTRADAY_REVIEW.md).
//
// The build narrowed three prompt readers behind explicit allowlists, and did
// it UNCONDITIONALLY — on the flags-off path. Every §9.2 test compares
// post-build WITH-pointers against post-build WITHOUT-pointers, so an
// allowlist entry that is simply MISSING is missing identically on both arms
// and no differential can see it. The review removed 'vintages' from
// RECORD_ENTRY_FIELDS: the whole provenance line vanished from the prompt
// sent to the narrator model, with every flag off, and the full suite still
// reported 720 files / 13,836 tests passing.
//
// These rows pin the allowlists themselves and the text they produce, so a
// future edit that drops a real field goes red.
// ---------------------------------------------------------------------------
describe('A9 §9.2 — the allowlists are pinned against their renderers', () => {
  /** Every field the evaluator writes on an entry, including the pointers. */
  const MAXIMAL = {
    evalId: 'eval_1', timestamp: '2026-09-17T14:30:00.000Z', day: 1, battlePhase: 'active', decision: 'SWAP',
    symbolOut: 'MU', symbolIn: 'SLB', tier: 'core', rationale: 'Rotated into energy.', hypothesis: 'SLB continues.',
    conviction: 72, scores: { active: 1, banked: 2, total: 6 },
    triggers: ['scheduled'], haikuError: null, downgraded: false, validationErrors: [], guardrailOverrides: [],
    guardrailSourceNote: 'note', directiveThreadId: 't1', ignoredDirectiveIds: [],
    evidence: { NVDA: { px: 100, chg: 1, atrX: 0.5, vwapDev: 0.2, bbPct: 10, nr7: false, regime: 'directional_expansion', risk: { action: 'HOLD' } } },
    vintages: { quote: 'tick', vwap: 'diagnostic', techAt: '2026-09-17T14:30:00.000Z', fundAsOf: '2026-09-12', rankingsAt: '2026-09-17T11:00:00.000Z', intradaySnapshotId: '2026-09-17-0042', intradayGeneration: 42 },
    heard: { directiveThreadId: 't1', suppressed: null },
    ...POINTERS,
  };

  it('RECORD_ENTRY_FIELDS is exactly this list, and pickRecordEntry preserves exactly it', () => {
    const expected = [
      'evalId', 'timestamp', 'decision', 'symbolOut', 'symbolIn', 'tier', 'rationale', 'hypothesis',
      'triggers', 'haikuError', 'downgraded', 'validationErrors', 'guardrailOverrides', 'guardrailSourceNote',
      'directiveThreadId', 'ignoredDirectiveIds', 'evidence', 'vintages', 'heard',
    ];
    expect([...RECORD_ENTRY_FIELDS]).toEqual(expected);
    expect(Object.keys(pickRecordEntry(MAXIMAL))).toEqual(expected);
    // No pointer field survives the pick.
    for (const k of INTRADAY_ENTRY_FIELDS) expect(pickRecordEntry(MAXIMAL)).not.toHaveProperty(k);
  });

  it('the narrator record block renders EXACTLY this — dropping an allowlist entry changes it', () => {
    // The provenance line is the one the review demonstrated: it is rendered
    // from `vintages`, so removing 'vintages' from the allowlist deletes it
    // and this pin goes red.
    expect(buildYourRecordBlock({ evaluations: [MAXIMAL], directive: null })).toBe(
      'YOUR RECORD (the last 3 checks, newest first — history, not a plan)\n'
      + '\n'
      + "[10:30 AM check] · Swapped · MU → SLB (Core)\n"
      + "  Rationale — The agent's own words: Rotated into energy.\n"
      + '  Hypothesis recorded at this check (graded after the battle): SLB continues.\n'
      + '  What this check saw:\n'
      + '    NVDA — Price $100.00 · Gain since entry +1.00% · ATR multiple 0.50× · VWAP deviation +0.20% · Bollinger width 10th %ile · Regime directional_expansion\n'
      + '    Fundamentals block as of Sep 12 · Latest held technical stamp · 10:30 AM · Rankings as of 7:00 AM\n'
      + '\n'
      + 'RATIONALE RULE: Rationale is historical decider text. It may contain forward-looking language produced by the decision prompt. When explaining a completed decision, quote only the part describing the completed decision and its observed reason. Never repeat a hypothesis, future action, action condition, intended trade, or plan from inside rationale.\n'
      + '\n'
      + 'CURRENT DIRECTIVE: none filed.',
    );
  });

  it('REFLECTION_EVALUATION_FIELDS is exactly this list, and every one of them still reaches the reflection prompt', () => {
    expect([...REFLECTION_EVALUATION_FIELDS]).toEqual(['evalId', 'timestamp', 'decision', 'conviction', 'scores', 'hypothesis']);
    const truncated = truncateBattleHistory(battle([MAXIMAL]));
    expect(Object.keys(truncated.evaluations[0])).toEqual([...REFLECTION_EVALUATION_FIELDS]);
    const prompt = JSON.stringify(buildReflectionUserMessage(truncated));
    // The renderer reads timestamp, decision, conviction, scores.total and
    // hypothesis; each must survive the pick and appear.
    expect(prompt).toContain('SWAP');
    expect(prompt).toContain('72');
    expect(prompt).toContain('SLB continues.');
    for (const m of DIAGNOSTIC_MARKERS) expect(prompt).not.toContain(m);
  });

  it('ANTICIPATION_ENTRY_FIELDS is exactly this list and the pick returns exactly it', () => {
    expect([...ANTICIPATION_ENTRY_FIELDS]).toEqual(['evalId', 'timestamp']);
    expect(pickAnticipationEntry(MAXIMAL)).toEqual({ evalId: 'eval_1', timestamp: '2026-09-17T14:30:00.000Z' });
  });
});

// ---------------------------------------------------------------------------
// Cockpit Build 0 (docs/design/COCKPIT_SPEC_V1_3.md §3.11 "intradayPromptExclusions
// (+ row)"; contract §9 "shadow: … nothing rendered, chat unchanged"). The
// entry's `declarationsPhase` and the battle's call-record state
// (cronState.declarationsPhase / callFlips / callsDiag) are READER data — the
// four prompt-feeding readers never see them, so shadow changes no prompt.
// ---------------------------------------------------------------------------
describe('Cockpit Build 0 — the calls entry key and call-record state never reach a prompt reader', () => {
  const CALLS_MARKERS = ['declarationsPhase', 'expected', 'callFlips', 'callsDiag', 'phaseResult'];
  const WITH_PHASE = WITHOUT.map((e) => ({ ...e, declarationsPhase: 'expected' }));
  const withCallsState = (b) => ({
    ...b,
    cronState: {
      declarationsPhase: { evalId: 'eval_3', phase: 'written' },
      callFlips: { evalId: 'eval_3', cursor: { mintedAt: 1789664000000, callId: 'b1:eval_2:call:0' }, scanned: 4, total: 4, complete: true },
      callsDiag: { evalId: 'eval_3', exit: 'model_result', phaseResult: 'written', perId: [], removed: [], flips: null, truncated: false, faults: [], ms: 12 },
    },
  });

  it('formatRecentEvals (fenced, key-explicit) is byte-identical with and without declarationsPhase', () => {
    expect(formatRecentEvals(WITH_PHASE, 3)).toBe(formatRecentEvals(WITHOUT, 3));
    for (const m of CALLS_MARKERS) expect(formatRecentEvals(WITH_PHASE, 3)).not.toContain(m);
  });

  it('the narrator record block and every allowlist exclude it', () => {
    expect(buildYourRecordBlock({ evaluations: WITH_PHASE, directive: null })).toBe(buildYourRecordBlock({ evaluations: WITHOUT, directive: null }));
    for (const list of [RECORD_ENTRY_FIELDS, REFLECTION_EVALUATION_FIELDS, ANTICIPATION_ENTRY_FIELDS]) expect(list).not.toContain('declarationsPhase');
    expect(pickRecordEntry(WITH_PHASE[0])).not.toHaveProperty('declarationsPhase');
  });

  it('the reflection prompt is byte-identical with the entry key AND the battle-level call state present', () => {
    const on = buildReflectionUserMessage(withCallsState(battle(WITH_PHASE)), { name: 'Nova', archetype: 'analyst' });
    const off = buildReflectionUserMessage(battle(WITHOUT), { name: 'Nova', archetype: 'analyst' });
    expect(JSON.stringify(on)).toBe(JSON.stringify(off));
    for (const m of CALLS_MARKERS) expect(JSON.stringify(on)).not.toContain(m);
  });
});
