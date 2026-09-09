// api/cron/agent-evaluate.tickStamps.pins.test.js
//
// Phase B — the tick stamps: THE PINS (spec §1.2 hazard 4, §1.6; discovery §5
// hazards 3 / 4). Three source tripwires plus their behavioral twins:
//
//   1. THE ARGUMENT-LIST PIN. The cron's Heard resolution must be the SAME
//      pure resolveControls call the fenced assembler ran when it rendered the
//      directive block — same modes, same isDirectiveActive pre-gate, same
//      leans / overrides / epoch log — or the stamp could name a thread the
//      prompt never carried. The two calls are compared BYTE-FOR-BYTE after
//      removing each block's own indentation (the cron's sits one level deeper,
//      inside its flag gate). The fenced source is READ to cite, never edited
//      (BUILD_RULES §1); the controlPromptRenderer.test.js single-source
//      tripwire is the precedent.
//   2. THE NO-RE-READ WINDOW. Between the prompt build and the stamp the cron
//      must not touch the doc (a re-read would name "the current directive",
//      not the rendered one — discovery A2 / hazard 3).
//   3. THE DECIDER'S WHITELIST. formatRecentEvals reads a fixed set of entry
//      keys and agentTriggerGate reads evaluations.length only, so no stamp can
//      ever leak into the decider's prompt through the record (spec §1.6).

import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
// Fenced (BUILD_RULES §1): CALLED to prove inertness, never edited.
import { formatRecentEvals } from '../_utils/agentEvalPromptAssembly.js';
import { evaluateTriggers } from '../_utils/agentTriggerGate.js';
import { TICK_STAMP_KEYS, composeTickStamps } from '../_utils/tickStamps.js';
import { resolveControls } from '../_utils/controlPromptRenderer.js';
import { EVALUATIONS, makeBattle } from '../_utils/__fixtures__/voiceGroundingFixtures.js';
import { makeDirective, OLD_THREAD } from '../_utils/__fixtures__/tickStampsHarness.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const CRON = readFileSync(resolve(HERE, 'agent-evaluate.js'), 'utf8');
const FENCED = readFileSync(resolve(HERE, '../_utils/agentEvalPromptAssembly.js'), 'utf8');
const GATE = readFileSync(resolve(HERE, '../_utils/agentTriggerGate.js'), 'utf8');

const RESOLVE_ANCHOR = 'const controlResolution = resolveControls({';

/** The resolveControls call block (anchor line through its `});`), dedented by the anchor line's own indentation. */
function extractResolveCall(source, label) {
  const idx = source.indexOf(RESOLVE_ANCHOR);
  expect(idx, `${label}: "${RESOLVE_ANCHOR}" not found`).toBeGreaterThan(-1);
  expect(source.indexOf(RESOLVE_ANCHOR, idx + 1), `${label}: the anchor must occur exactly once`).toBe(-1);
  const lineStart = source.lastIndexOf('\n', idx) + 1;
  const indent = source.slice(lineStart, idx);
  expect(indent, `${label}: the anchor line must carry only whitespace before it`).toMatch(/^\s*$/);
  const closer = `\n${indent}});`;
  const end = source.indexOf(closer, idx);
  expect(end, `${label}: the call's closer "});" at the anchor's indentation not found`).toBeGreaterThan(idx);
  const block = source.slice(lineStart, end + closer.length);
  return block.split('\n').map((line) => (line.startsWith(indent) ? line.slice(indent.length) : line)).join('\n');
}

/** A named export function's source, signature through its closing brace. */
function fnSource(source, name) {
  const start = source.indexOf(`export function ${name}(`);
  expect(start, `export function ${name} not found`).toBeGreaterThan(-1);
  const end = source.indexOf('\n}', start);
  return source.slice(start, end + 2);
}

// The fenced call, instantiated — the golden IS the fenced template, so a
// fenced edit (founder-gated) fails here and tells the builder the cron's copy
// must move with it in the same commit.
const FENCED_RESOLVE_CALL = `const controlResolution = resolveControls({
  modes: {
    archetypeIntegrityMode: ARCHETYPE_INTEGRITY_MODE,
    standingLeansEnabled: STANDING_LEANS_ENABLED,
  },
  directive: isDirectiveActive(battle?.directive, battle) ? battle.directive : null,
  standingLeans: battle.agentContext?.standingLeans,
  leanOverrides: battle.leanOverrides,
  controlEpochLog: battle.controlEpochLog,
});`;

afterEach(() => { vi.useRealTimers(); });

describe('pin 1 — the cron\'s Heard resolution IS the fenced assembler\'s resolveControls call (hazard 4)', () => {
  it('the two argument lists are byte-for-byte identical after dedent', () => {
    expect(extractResolveCall(CRON, 'agent-evaluate.js')).toBe(extractResolveCall(FENCED, 'agentEvalPromptAssembly.js'));
  });

  it('anti-vacuous: the fenced call is the known block — modes, the isDirectiveActive pre-gate, leans, overrides, the epoch log', () => {
    expect(extractResolveCall(FENCED, 'agentEvalPromptAssembly.js')).toBe(FENCED_RESOLVE_CALL);
    expect(extractResolveCall(CRON, 'agent-evaluate.js')).toBe(FENCED_RESOLVE_CALL);
  });

  it('the cron calls resolveControls exactly once (the telemetry passes the function, it does not call it), inside the TICK_STAMPS_ENABLED gate, feeding composeTickStamps onto `evaluation`', () => {
    expect(CRON.match(/resolveControls\(/g)).toHaveLength(1);
    const gate = CRON.indexOf('if (TICK_STAMPS_ENABLED) {');
    const call = CRON.indexOf(RESOLVE_ANCHOR);
    const assign = CRON.indexOf('Object.assign(evaluation, composeTickStamps({');
    expect(gate).toBeGreaterThan(-1);
    expect(call).toBeGreaterThan(gate);
    expect(assign).toBeGreaterThan(call);
    // One gate, one assign, and the flag is the shared module's — never a local const.
    expect(CRON.match(/if \(TICK_STAMPS_ENABLED\) \{/g)).toHaveLength(1);
    expect(CRON.match(/Object\.assign\(evaluation, composeTickStamps\(\{/g)).toHaveLength(1);
    expect(CRON).toMatch(/import \{[^}]*\bTICK_STAMPS_ENABLED\b[^}]*\} from '\.\.\/\.\.\/src\/config\/featureFlags\.js'/);
    expect(CRON).not.toMatch(/const TICK_STAMPS_ENABLED/);
    // The block is spliced AFTER the composed entry (the decision is already made) …
    expect(CRON.indexOf('haikuError: haikuFailure ? { ...haikuFailure, evalId } : null,')).toBeLessThan(gate);
    // … and BEFORE the entry rides into `evaluations` for the finalUpdate.
    expect(assign).toBeLessThan(CRON.indexOf('const evaluations = [...(battle.evaluations || []), evaluation].slice(-150);'));
  });

  it('the stamps feed from the same in-scope objects the prompt was built from (no recomputation, no model)', () => {
    const start = CRON.indexOf('Object.assign(evaluation, composeTickStamps({');
    const block = CRON.slice(start, CRON.indexOf('}));', start));
    for (const arg of ['haikuAttempted', 'controlResolution', 'anticipationCandidates: haikuResult?.anticipationCandidates', 'assetScores', 'prices', 'momentumData', 'stockRegimes', 'riskStatus', 'rankingsComputedAtMs']) {
      expect(block, `composeTickStamps must receive ${arg}`).toContain(arg);
    }
  });
});

describe('pin 2 — no doc re-read between the prompt build and the stamp (discovery A2 / hazard 3)', () => {
  it('the window from buildLiveContextBlock to the stamp carries no refreshBattleFromDoc / battleRef.get / transaction read', () => {
    const fnStart = CRON.indexOf('export async function processAgentBattle(');
    const promptBuild = CRON.indexOf('content: await buildLiveContextBlock(', fnStart);
    const stamp = CRON.indexOf('Object.assign(evaluation, composeTickStamps({', promptBuild);
    expect(promptBuild).toBeGreaterThan(fnStart);
    expect(stamp).toBeGreaterThan(promptBuild);
    const window = CRON.slice(promptBuild, stamp);
    expect(window).not.toMatch(/refreshBattleFromDoc\(/);
    expect(window).not.toMatch(/battleRef\.get\(/);
    expect(window).not.toMatch(/\.get\(battleRef\)/);
    expect(window).not.toMatch(/runTransaction\(/);
  });

  it('the cron never assigns battle.directive — the in-memory slot is exactly the rendered one', () => {
    expect(CRON).not.toMatch(/battle\.directive\s*=[^=]/);
  });
});

describe('pin 3 — the fenced decider is inert to the new keys (spec §1.6)', () => {
  const WHITELIST = ['decision', 'evalId', 'hypothesis', 'rationale', 'symbolIn', 'symbolOut', 'tier', 'timestamp'];

  it('formatRecentEvals reads exactly the eight whitelisted entry keys and none of the four stamp keys', () => {
    const body = fnSource(FENCED, 'formatRecentEvals');
    const reads = [...new Set([...body.matchAll(/\bev\.(\w+)/g)].map((m) => m[1]))].sort();
    expect(reads).toEqual(WHITELIST);
    for (const key of TICK_STAMP_KEYS) expect(body, `formatRecentEvals must not read "${key}"`).not.toContain(key);
  });

  it('battle.evaluations reaches the fenced assembler through that ONE call and nowhere else', () => {
    expect(FENCED.match(/battle\.evaluations/g)).toHaveLength(1);
    expect(FENCED).toMatch(/formatRecentEvals\(battle\.evaluations, 3\)/);
    // No other reader of the evaluation history exists in the fenced file: the
    // `recentEvals` parameter is received and never read, and no `ev.heard` /
    // `ev.evidence` / `ev.vintages` / `ev.candidates` access exists anywhere.
    // (The bare WORDS "candidates" / "evidence" do appear in the fenced prompt
    // prose — the ANTICIPATION CANDIDATES instruction — so the pin is on the
    // entry ACCESS, never on the vocabulary.)
    for (const key of TICK_STAMP_KEYS) {
      expect(FENCED.match(new RegExp(`\\.${key}\\b`, 'g')) || [], `no fenced code path may read .${key} off an entry`).toHaveLength(0);
      expect(FENCED.match(new RegExp(`\\[['"]${key}['"]\\]`, 'g')) || [], `no fenced code path may read ['${key}'] off an entry`).toHaveLength(0);
    }
  });

  it('behavioral twin: YOUR LAST 3 DECISIONS renders the same bytes for an entry with the stamps and without them', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-09T15:00:00.000Z'));
    const plain = EVALUATIONS.map((e) => ({ ...e }));
    const stamps = composeTickStamps({
      haikuAttempted: true,
      controlResolution: resolveControls({ modes: { archetypeIntegrityMode: 'enforce', standingLeansEnabled: true }, directive: makeDirective(), controlEpochLog: [] }),
      anticipationCandidates: [{ symbol: 'AMD', direction: 'potential_entry', signalSummary: 's', threshold: 't' }],
      assetScores: [{ symbol: 'CF', multiplier: 0.4 }],
      prices: { CF: { current: 89.2, changePercent: 1.1 } },
      momentumData: {},
      stockRegimes: { CF: 'choppy' },
      riskStatus: { CF: { action: 'HOLD' } },
    });
    const stamped = plain.map((e) => ({ ...e, ...stamps }));
    expect(Object.keys(stamped[0])).toEqual(expect.arrayContaining(['heard', 'evidence', 'vintages', 'candidates']));
    expect(formatRecentEvals(stamped, 3)).toBe(formatRecentEvals(plain, 3));
    expect(formatRecentEvals(stamped, 3)).not.toContain(OLD_THREAD);
  });

  it('agentTriggerGate reads evaluations.length only; a stamped history triggers identically', () => {
    const body = fnSource(GATE, 'evaluateTriggers');
    const reads = [...new Set([...body.matchAll(/\bevaluations\.(\w+)/g)].map((m) => m[1]))];
    expect(reads).toEqual(['length']);
    expect(body.match(/battle\.evaluations/g)).toHaveLength(1);

    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-09T15:00:00.000Z'));
    const stamps = { heard: { directiveThreadId: OLD_THREAD, suppressed: null }, evidence: {}, vintages: { quote: 'tick', vwap: 'tick', tech: 'daily', fundAsOf: null, rankingsAt: null } };
    const plainBattle = makeBattle();
    const stampedBattle = makeBattle({ evaluations: EVALUATIONS.map((e) => ({ ...e, ...stamps })) });
    const args = [[], {}, [], { vwap: {}, rankings: {} }, []];
    expect(evaluateTriggers(stampedBattle, ...args)).toEqual(evaluateTriggers(plainBattle, ...args));
    // and the empty-history case (forced_open) is unchanged too
    expect(evaluateTriggers(makeBattle({ evaluations: [] }), ...args).triggers.map((t) => t.type)).toEqual(['forced_open']);
  });
});
