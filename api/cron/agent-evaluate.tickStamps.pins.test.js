// api/cron/agent-evaluate.tickStamps.pins.test.js
//
// Phase B — the tick stamps: THE PINS (spec §1.2 hazard 4, §1.6; discovery §5
// hazards 3 / 4; review C-5 / D-3 extensions). Source tripwires plus their
// behavioral twins:
//
//   1. THE ARGUMENT-LIST PIN. The cron's Heard resolution must be the SAME
//      pure resolveControls call the fenced assembler ran when it rendered the
//      directive block — same modes, same isDirectiveActive pre-gate, same
//      leans / overrides / epoch log — or the stamp could name a thread the
//      prompt never carried. The two calls are compared BYTE-FOR-BYTE after
//      removing each block's own indentation (the cron's sits deeper, inside
//      its fail-safe and flag gate). The fenced source is READ to cite, never
//      edited (BUILD_RULES §1); the controlPromptRenderer.test.js single-source
//      tripwire is the precedent.
//   2. THE GATE AND THE FAIL-SAFE. The resolution and the stamp are CONTAINED
//      in `if (TICK_STAMPS_ENABLED && promptBuilt) { … }` (brace-matched, not
//      just ordered), which is itself contained in the `try` whose catch is the
//      fail-safe; `promptBuilt` flips after the prompt's three parts are built
//      and before the transport call.
//   3. THE NO-RE-READ WINDOW. Between the prompt build and the stamp the cron
//      must not touch the doc (a re-read would name "the current directive",
//      not the rendered one — discovery A2 / hazard 3).
//   4. THE DECIDER'S WHITELIST. formatRecentEvals reads a fixed set of entry
//      keys and agentTriggerGate reads evaluations.length only, so no stamp can
//      ever leak into the decider's prompt through the record (spec §1.6). The
//      whitelist is the pin for EVERY additive entry field, not just the four
//      stamps: the Sep 12 2026 transport-hygiene timings (promptBuiltAt /
//      buildMs / callMs) and haikuError.timeoutKind are held to the same rule —
//      the prompt is byte-identical with them and without them.

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
const GATE_SRC = readFileSync(resolve(HERE, '../_utils/agentTriggerGate.js'), 'utf8');

const RESOLVE_ANCHOR = 'const controlResolution = resolveControls({';
const GATE = 'if (TICK_STAMPS_ENABLED && promptBuilt) {';
const ASSIGN = 'Object.assign(evaluation, composeTickStamps({';
const LIVE_BLOCK = 'const liveContextBlock = await buildLiveContextBlock(';

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

/** Index of the `}` matching the `{` at openIdx, skipping `//` comments (template `${}` pairs balance themselves). */
function matchingBrace(source, openIdx) {
  expect(source[openIdx]).toBe('{');
  let depth = 0;
  for (let i = openIdx; i < source.length; i++) {
    const ch = source[i];
    if (ch === '/' && source[i + 1] === '/') { i = source.indexOf('\n', i); if (i === -1) break; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return i; }
  }
  return -1;
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

  it('the cron calls resolveControls exactly once (the telemetry passes the function, it does not call it) and both files bind the same names from the same modules', () => {
    expect(CRON.match(/resolveControls\(/g)).toHaveLength(1);
    expect(CRON).toMatch(/import \{ resolveControls \} from '\.\.\/_utils\/controlPromptRenderer\.js'/);
    expect(FENCED).toMatch(/import \{[^}]*\bresolveControls\b[^}]*\} from '\.\/controlPromptRenderer\.js'/);
    expect(CRON).toMatch(/import \{ isDirectiveActive \} from '\.\.\/_utils\/directiveUtils\.js'/);
    expect(FENCED).toMatch(/import \{[^}]*\bisDirectiveActive\b[^}]*\} from '\.\/directiveUtils\.js'/);
    for (const flag of ['ARCHETYPE_INTEGRITY_MODE', 'STANDING_LEANS_ENABLED', 'TICK_STAMPS_ENABLED']) {
      expect(CRON).toMatch(new RegExp(`import \\{[^}]*\\b${flag}\\b[^}]*\\} from '\\.\\.\\/\\.\\.\\/src\\/config\\/featureFlags\\.js'`));
    }
    expect(FENCED).toMatch(/import \{[^}]*\bARCHETYPE_INTEGRITY_MODE\b[^}]*\} from '\.\.\/\.\.\/src\/config\/featureFlags\.js'/);
  });
});

describe('pin 2 — the gate and the fail-safe contain the resolution and the stamp; promptBuilt is the gate', () => {
  it('the resolution and the stamp are CONTAINED in `if (TICK_STAMPS_ENABLED && promptBuilt) { … }` (brace-matched), which is contained in the fail-safe\'s try; both occur exactly once; the flag is the shared module\'s', () => {
    expect(CRON.match(/if \(TICK_STAMPS_ENABLED && promptBuilt\) \{/g)).toHaveLength(1);
    expect(CRON.match(/Object\.assign\(evaluation, composeTickStamps\(\{/g)).toHaveLength(1);
    expect(CRON).not.toMatch(/const TICK_STAMPS_ENABLED|let TICK_STAMPS_ENABLED/);
    const gate = CRON.indexOf(GATE);
    const gateOpen = gate + GATE.length - 1;
    const gateEnd = matchingBrace(CRON, gateOpen);
    const call = CRON.indexOf(RESOLVE_ANCHOR);
    const assign = CRON.indexOf(ASSIGN);
    expect(gateEnd).toBeGreaterThan(gate);
    expect(call).toBeGreaterThan(gateOpen);
    expect(assign).toBeGreaterThan(call);
    expect(assign).toBeLessThan(gateEnd);
    // the gate's block holds nothing but the resolution, the rankings vintage and the stamp
    const gateBody = CRON.slice(gateOpen + 1, gateEnd);
    expect(gateBody).toContain('rankingsComputedAtMs');
    expect(gateBody).not.toMatch(/battleRef\.|await /);
    // the fail-safe wraps the whole gate: `try {` immediately before it, `} catch (stampErr) {` right after its closer
    const tryIdx = CRON.lastIndexOf('try {', gate);
    expect(CRON.slice(tryIdx + 'try {'.length, gate).trim()).toBe('');
    const catchIdx = CRON.indexOf('} catch (stampErr) {', gateEnd);
    expect(catchIdx).toBeGreaterThan(gateEnd);
    expect(CRON.slice(gateEnd + 1, catchIdx).trim()).toBe('');
    expect(CRON.slice(catchIdx, catchIdx + 600)).toContain('tick stamps failed for battle');
    // spliced AFTER the composed entry (the decision is already made) and BEFORE the entry rides into `evaluations`
    expect(CRON.indexOf('haikuError: haikuFailure ? { ...haikuFailure, evalId } : null,')).toBeLessThan(tryIdx);
    expect(catchIdx).toBeLessThan(CRON.indexOf('const evaluations = [...(battle.evaluations || []), evaluation].slice(-150);'));
  });

  it('promptBuilt is declared false beside haikuAttempted, flips exactly once — after the three prompt parts are built, before the transport call — and is what the composer receives (never haikuAttempted)', () => {
    const decl = CRON.indexOf('let promptBuilt = false;');
    const attempted = CRON.indexOf('let haikuAttempted = false;');
    const live = CRON.indexOf(LIVE_BLOCK);
    const flips = [...CRON.matchAll(/promptBuilt = true;/g)].map((m) => m.index);
    const transport = CRON.indexOf('await anthropic.messages.create(');
    expect(decl).toBeGreaterThan(attempted);
    expect(flips).toHaveLength(1);
    expect(live).toBeGreaterThan(decl);
    expect(flips[0]).toBeGreaterThan(live);
    expect(transport).toBeGreaterThan(flips[0]);
    // the three builders run in the request's order, before the flip
    const sys = CRON.indexOf('const systemPrompt = buildEvalSystemPrompt(agentName, archetype, battle.gameMode, ctx.archetype);');
    const identity = CRON.indexOf('const identityBlock = buildAgentIdentityBlock(battle);');
    expect(sys).toBeGreaterThan(decl);
    expect(identity).toBeGreaterThan(sys);
    expect(live).toBeGreaterThan(identity);
    // the composer receives promptBuilt and the in-scope objects, never haikuAttempted
    const start = CRON.indexOf(ASSIGN);
    const block = CRON.slice(start, CRON.indexOf('}));', start));
    for (const arg of ['promptBuilt,', 'controlResolution,', 'anticipationCandidates: lintedAnticipationCandidates', 'assetScores,', 'prices,', 'momentumData,', 'stockRegimes,', 'riskStatus,', 'benchAssets: flattenBenchServer(battle.portfolio?.bench)', 'rankingsComputedAtMs,']) {
      expect(block, `composeTickStamps must receive ${arg}`).toContain(arg);
    }
    expect(block).not.toContain('haikuAttempted');
    // THE THRESHOLD LINT moved this one argument (2026-09-16): the stamp is
    // fed the LINTED array rather than the raw tool output, so a threshold the
    // tick's own data could not support never becomes a fact on the record.
    // The pin moves WITH that change and keeps its meaning by binding the new
    // name to the old source in the same window: `lintedAnticipationCandidates`
    // is INITIALISED from `haikuResult?.anticipationCandidates`, and under the
    // shipped 'off' it is that same reference (the lint is never called), so
    // the stamp still receives exactly what the decider returned.
    const lintDecl = CRON.indexOf('let lintedAnticipationCandidates = haikuResult?.anticipationCandidates;');
    expect(lintDecl, 'the linted array must be initialised from the decider\'s own output').toBeGreaterThan(0);
    expect(lintDecl).toBeLessThan(start);
    expect(CRON).toMatch(/ANTICIPATION_THRESHOLD_LINT_MODE === 'on'/);
  });
});

describe('pin 3 — no doc re-read between the prompt build and the stamp (discovery A2 / hazard 3)', () => {
  it('the window from buildLiveContextBlock to the stamp carries no refreshBattleFromDoc / battleRef.get / transaction read / Object.assign(battle', () => {
    const fnStart = CRON.indexOf('export async function processAgentBattle(');
    const promptBuild = CRON.indexOf(LIVE_BLOCK, fnStart);
    const stamp = CRON.indexOf(ASSIGN, promptBuild);
    expect(promptBuild).toBeGreaterThan(fnStart);
    expect(stamp).toBeGreaterThan(promptBuild);
    const window = CRON.slice(promptBuild, stamp);
    expect(window).not.toMatch(/refreshBattleFromDoc\(/);
    expect(window).not.toMatch(/battleRef\.get\(/);
    expect(window).not.toMatch(/\.get\(battleRef\)/);
    expect(window).not.toMatch(/runTransaction\(/);
    expect(window).not.toMatch(/Object\.assign\(battle\b/);
    // the two legitimate write-backs onto `battle` (the migration fields and refreshBattleFromDoc) are the only ones in the file
    expect(CRON.match(/Object\.assign\(battle\b/g)).toHaveLength(2);
  });

  it('the cron never assigns battle.directive in any form — the in-memory slot is exactly the rendered one', () => {
    expect(CRON).not.toMatch(/battle(\.|\?\.)directive\s*(\?\?|\|\||&&)?=[^=]/);
    expect(CRON).not.toMatch(/battle\[['"]directive['"]\]\s*(\?\?|\|\||&&)?=[^=]/);
    expect(CRON).not.toMatch(/delete\s+battle(\.|\?\.)directive/);
  });
});

describe('pin 4 — the fenced decider is inert to the new keys (spec §1.6)', () => {
  const WHITELIST = ['decision', 'evalId', 'hypothesis', 'rationale', 'symbolIn', 'symbolOut', 'tier', 'timestamp'];
  // Transport hygiene (Sep 12, 2026): the three flat timing fields the cron now
  // composes on every entry, plus the timeoutKind it adds inside haikuError.
  // `haikuError` is not on the whitelist at all, so its contents are already
  // unreachable — the key is listed so the source rows below say so out loud.
  // Eval-cron instrumentation (Sep 23, 2026) adds the fourth, `tickMs` (D1).
  const TIMING_KEYS = ['promptBuiltAt', 'buildMs', 'callMs', 'tickMs'];
  const ADDITIVE_KEYS = [...TICK_STAMP_KEYS, ...TIMING_KEYS, 'timeoutKind', 'haikuError'];

  it('formatRecentEvals reads exactly the eight whitelisted entry keys by dot access and reads the entry no other way (no bracket, destructuring, spread or whole-object pass)', () => {
    const body = fnSource(FENCED, 'formatRecentEvals');
    const reads = [...new Set([...body.matchAll(/\bev\.(\w+)/g)].map((m) => m[1]))].sort();
    expect(reads).toEqual(WHITELIST);
    for (const key of ADDITIVE_KEYS) expect(body, `formatRecentEvals must not read "${key}"`).not.toContain(key);
    expect(body).not.toMatch(/\bev\s*\[/);
    expect(body).not.toMatch(/\{[^}]*\}\s*=\s*ev\b/);
    expect(body).not.toMatch(/\.\.\.ev\b|JSON\.stringify\(ev\b|Object\.(keys|values|entries)\(ev\b/);
    // anti-vacuous: the whitelist and the additive set are disjoint, so the
    // loop above is a real exclusion and not a list of words already absent
    // from any function that reads anything at all.
    for (const key of ADDITIVE_KEYS) expect(WHITELIST).not.toContain(key);
  });

  it('battle.evaluations reaches the fenced assembler through that ONE call and no other form of read', () => {
    expect(FENCED.match(/battle\??\.evaluations/g)).toHaveLength(1);
    expect(FENCED).toMatch(/formatRecentEvals\(battle\.evaluations, 3\)/);
    expect(FENCED).not.toMatch(/\[['"]evaluations['"]\]/);
    expect(FENCED).not.toMatch(/\{[^}]*\bevaluations\b[^}]*\}\s*=\s*battle/);
    // No fenced code path reads a stamp key off an entry (the bare WORDS
    // "candidates" / "evidence" do appear in the fenced prompt prose — the
    // ANTICIPATION CANDIDATES instruction — so the pin is on the ACCESS).
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
      promptBuilt: true,
      controlResolution: resolveControls({ modes: { archetypeIntegrityMode: 'enforce', standingLeansEnabled: true }, directive: makeDirective(), controlEpochLog: [] }),
      anticipationCandidates: [{ symbol: 'AMD', direction: 'potential_entry', signalSummary: 's', threshold: 't' }],
      assetScores: [{ symbol: 'CF', multiplier: 0.4, priceChange: 1.1 }],
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

  it('behavioural twin (transport hygiene): the prompt is BYTE-IDENTICAL for entries carrying promptBuiltAt / buildMs / callMs / haikuError.timeoutKind and entries without them', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-09T15:00:00.000Z'));
    const plain = EVALUATIONS.map((e) => ({ ...e }));
    // Production shapes, not placeholders: a check that built and called, a
    // check whose build blew its ceiling (no call), and a transport timeout
    // carrying the new timeoutKind inside the existing haikuError.
    // …applied to the LAST THREE entries — the window formatRecentEvals renders.
    const VARIANTS = [
      (e) => ({ ...e, promptBuiltAt: '2026-09-09T14:59:58.000Z', buildMs: 412, callMs: 6_231 }),
      (e) => ({
        ...e,
        haikuError: { failureClass: 'build_timeout', message: 'prompt build exceeded 10000 ms', timestamp: '2026-09-09T14:59:50.000Z', timeoutKind: null, evalId: e.evalId },
        promptBuiltAt: null,
        buildMs: 10_004,
        callMs: null,
      }),
      (e) => ({
        ...e,
        haikuError: { failureClass: 'timeout', message: 'Request timed out.', timestamp: '2026-09-09T14:59:40.000Z', timeoutKind: 'sdk', evalId: e.evalId },
        promptBuiltAt: '2026-09-09T14:59:19.000Z',
        buildMs: 688,
        callMs: 20_003,
      }),
    ];
    const firstVariant = plain.length - VARIANTS.length;
    expect(firstVariant, 'the fixture must carry at least the three rendered entries').toBeGreaterThanOrEqual(0);
    const timed = plain.map((e, i) => (i >= firstVariant ? VARIANTS[i - firstVariant](e) : e));
    // the fields really are on the three entries that get rendered (anti-vacuous)
    const rendered3 = timed.slice(-3);
    expect(rendered3.map((e) => e.buildMs)).toEqual([412, 10_004, 688]);
    expect(rendered3.map((e) => e.callMs)).toEqual([6_231, null, 20_003]);
    expect(rendered3.map((e) => (e.haikuError ? [e.haikuError.failureClass, e.haikuError.timeoutKind] : null)))
      .toEqual([null, ['build_timeout', null], ['timeout', 'sdk']]);
    expect(formatRecentEvals(timed, 3)).toBe(formatRecentEvals(plain, 3));
    // and nothing from the new fields appears anywhere in the rendered block
    const rendered = formatRecentEvals(timed, 3);
    // anti-vacuous: the block is real — a renderer that returned '' would pass
    // the byte-identity and every exclusion below without proving anything.
    expect(rendered.length).toBeGreaterThan(80);
    for (const e of timed.slice(-3)) expect(rendered).toContain(e.evalId);
    for (const needle of ['promptBuiltAt', 'buildMs', 'callMs', 'timeoutKind', 'build_timeout', '10004', '20003', '6231']) {
      expect(rendered, `the decider's block must not contain "${needle}"`).not.toContain(needle);
    }
  });

  it('agentTriggerGate reads evaluations.length only; a stamped history triggers identically', () => {
    const body = fnSource(GATE_SRC, 'evaluateTriggers');
    const reads = [...new Set([...body.matchAll(/\bevaluations\.(\w+)/g)].map((m) => m[1]))];
    expect(reads).toEqual(['length']);
    expect(body.match(/battle\??\.evaluations/g)).toHaveLength(1);
    expect(body).not.toMatch(/\bevaluations\s*\[/);

    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-09T15:00:00.000Z'));
    const stamps = { heard: { directiveThreadId: OLD_THREAD, suppressed: null }, evidence: {}, vintages: { quote: 'tick', vwap: 'tick', techAt: null, fundAsOf: null, rankingsAt: null } };
    const plainBattle = makeBattle();
    const stampedBattle = makeBattle({ evaluations: EVALUATIONS.map((e) => ({ ...e, ...stamps })) });
    const args = [[], {}, [], { vwap: {}, rankings: {} }, []];
    expect(evaluateTriggers(stampedBattle, ...args)).toEqual(evaluateTriggers(plainBattle, ...args));
    // and the empty-history case (forced_open) is unchanged too
    expect(evaluateTriggers(makeBattle({ evaluations: [] }), ...args).triggers.map((t) => t.type)).toEqual(['forced_open']);
  });
});
