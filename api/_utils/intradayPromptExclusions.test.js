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
