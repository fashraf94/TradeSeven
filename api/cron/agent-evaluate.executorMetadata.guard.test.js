// api/cron/agent-evaluate.executorMetadata.guard.test.js
//
// Integrity build — client-forged proposal data (7 Oct 2026; founder decision
// F2; acceptance row 2). Report: docs/audits/20261007_BUILD_INTEGRITY_PROPOSAL_FORGERY.md.
//
// THE GUARD: CI fails when a production executeSwapServer caller hands the
// executor a metadata key outside the allowlist, or a value read from a field
// the battle's owner can write (firestore.rules, the agentBattles update
// allowlist). The fenced executor spreads its `evaluationMetadata` onto the
// trade row AFTER its computed fields — before this build a planted
// `lockedPoints` became score.
//
// TWO HALVES:
//   1. STATIC — the cron is parsed (acorn, the tapeAstraReview precedent). Every
//      executeSwapServer call (however many there are): its metadata is an
//      `executorMetadata({…})` object — resolved to the declaration IN SCOPE at
//      that call, never reassigned or mutated afterwards, one object per call —
//      whose keys are all allowlisted and whose spreads are the three known
//      builders; no argument that lands on the row (the metadata, the day, the
//      prices, the snapshot, the incoming asset, P6's belief) reads an
//      owner-writable field except through a named sanitizer — and an id, the
//      day or a number never even through the text sanitizers. Owner-writable
//      values are traced through `const`/`let` declarations, destructuring,
//      aliases of `battle`, reassignments and for-of loops to a fixpoint; a call
//      that hands the whole battle to a helper the guard has not reviewed is
//      flagged in the checked expressions. KNOWN LIMIT: a value laundered through
//      an unreviewed helper into a local name before it reaches the metadata
//      (`const m = helper(battle)`) is not traced statically — the behavioural
//      half, which plants every owner-writable field, is the backstop.
//   2. BEHAVIOURAL — the six callers driven through the REAL processAgentBattle
//      at off, shadow and enforce, with every owner-writable field planted with
//      sentinels: each row reaches its own call site; no planted number, id or
//      symbol reaches an executor argument or a written trade row (its
//      `verification` included); every row key is computed or allowlisted;
//      descriptive text is capped.
//
// DOCUMENTED EXCEPTIONS (each pinned below, so a new one fails CI):
//   - the two DORMANT proposal sites pass `proposal.tier` / `proposal.slotIndex`:
//     the slot the executor then READS from the live book (the row records the
//     slot actually traded). Which slot a revived proposal may name is the
//     authority arc's (P6 D6); F1 makes the paths unreachable today.
//   - the P6 options carry the caller's BELIEF, for a proposal or a meeting leg
//     stored on the owner-writable record: it reaches the executor only through
//     `expectedOutOfStored`, which type-checks it (a symbol string ≤ 64, an
//     instant string ≤ 40 or null — anything else is dropped); the executor
//     compares it with the live slot and records it as `verification.expected`.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
import {
  FROZEN_NOW, makeTickBattle, makePriceTable, makeRankingsDoc, makeTechDocs, makeIntradayCandles,
  makeHoldResult, makeSwapResult, makeToolUseResponse, deepClone, serverMeetingOverrides,
} from '../_utils/__fixtures__/tickStampsHarness.js';
import { makeCallsDb } from '../_utils/__fixtures__/callRecordsStore.js';

const mocks = vi.hoisted(() => ({ getStockAnalysisData: vi.fn(), fetchIntradayBatch: vi.fn(), create: vi.fn() }));
const authority = vi.hoisted(() => ({ mode: 'autopilot' }));
const flags = vi.hoisted(() => ({ swapIdentity: 'off' }));
const exec = vi.hoisted(() => ({ calls: [] }));
const guardrailHook = vi.hoisted(() => ({ result: null }));

/** The cron function and line that made an executor call, read off the call's own stack. */
const callerOf = vi.hoisted(() => (stack) => {
  const frame = String(stack).split('\n').find((l) => /agent-evaluate\.js:\d+/.test(l)) || '';
  const m = /at (?:async )?([\w$.]+) \(.*agent-evaluate\.js:(\d+):\d+\)/.exec(frame);
  return m ? { fn: m[1], line: Number(m[2]) } : { fn: null, line: null };
});

vi.mock('@anthropic-ai/sdk', () => ({
  default: class AnthropicMock { constructor() { this.messages = { create: (...args) => mocks.create(...args) }; } },
}));
vi.mock('../_utils/marketDataCache.js', () => ({
  getStockAnalysisData: mocks.getStockAnalysisData,
  fetchIntradayBatch: mocks.fetchIntradayBatch,
  fetchIntradayCandles: vi.fn(async () => []),
  filterToLatestSession: vi.fn((candles) => ({ candles: candles || [], sessionDate: '2026-09-09' })),
}));
vi.mock('../_utils/agentSwapExecution.js', async (importOriginal) => {
  const real = await importOriginal();
  const runReal = real.executeSwapServer; // aliased: the census reads a literal call as a consumer
  return {
    ...real,
    executeSwapServer: async (...args) => {
      const { fn, line } = callerOf(new Error().stack);
      exec.calls.push({ site: fn, line, args: deepClone(args.slice(3)) });
      const result = await runReal(...args);
      // Enforce readiness (review ER1-1): a hook that writes the store between calls (args[0] is the db).
      if (typeof exec.afterCall === 'function') exec.afterCall(args[0]);
      return result;
    },
  };
});
vi.mock('../_utils/agentGuardrails.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, applyGuardrails: (...args) => (guardrailHook.result ? deepClone(guardrailHook.result) : real.applyGuardrails(...args)) };
});
vi.mock('../_utils/executionAuthority.js', () => ({ get LAUNCH_EXECUTION_MODE() { return authority.mode; } }));
vi.mock('../_utils/tournamentAgentLedger.js', () => ({
  resolveTournamentContext: vi.fn(async () => null), excludeHeldByOthers: vi.fn((l) => l), excludeHeldSymbols: vi.fn((l) => l),
  reserveSymbol: vi.fn(), confirmSwap: vi.fn(), releaseReservation: vi.fn(),
}));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => ({}) }));
vi.mock('../_utils/voiceLayerAnticipation.js', async (importOriginal) => ({ ...(await importOriginal()), generateAnticipation: vi.fn(async () => null) }));
vi.mock('../_utils/voiceLayerTradeNarration.js', async (importOriginal) => ({ ...(await importOriginal()), generateTradeNarration: vi.fn(async () => null) }));
vi.mock('../_utils/shadowLogger.js', async (importOriginal) => ({ ...(await importOriginal()), logEvaluation: vi.fn(async () => false), logVisionTransition: vi.fn(async () => false), logAnticipation: vi.fn(async () => false) }));
vi.mock('../_utils/learning/captureReceipt.js', () => ({
  captureSwapReceipt: vi.fn(async () => {}),
  resolveEntrySnapshot: vi.fn(async () => ({ snapshotIn: null, techDocIn: null, entrySnapshotSource: 'unavailable' })),
  classifyEntryAtrSource: vi.fn(() => 'bench_atr'),
  classifyEvidence: vi.fn(() => 'live_agent'),
}));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get SWAP_IDENTITY_MODE() { return flags.swapIdentity; },
}));

const { processAgentBattle } = await import('./agent-evaluate.js');
const { EXECUTOR_METADATA_KEYS, EXECUTOR_COMPUTED_KEYS, CLIENT_TEXT_MAX, CLIENT_TOKEN_MAX } = await import('../_utils/executorMetadata.js');

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const CRON_PATH = resolve(HERE, 'agent-evaluate.js');
const EXECUTOR_PATH = resolve(HERE, '../_utils/agentSwapExecution.js');

// ───────────────────────────────────────────────────────────── static half

/** The agentBattles keys an owner may update (firestore.rules) — read here from the rules file itself. */
function ownerWritableBattleFields() {
  const rules = readFileSync(resolve(ROOT, 'firestore.rules'), 'utf8');
  const block = rules.slice(rules.indexOf('match /agentBattles/{battleId}'));
  const m = /affectedKeys\(\)\s*\.hasOnly\(\[([^\]]*)\]\)/.exec(block);
  return m[1].split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean);
}

/**
 * Names whose arguments are laundered: lookups / verifiers against server state.
 * (`getPresetConfig` maps the owner's preset string onto the server's preset
 * table; what flows on from it — risk verdicts, trigger types — is the server's
 * own vocabulary. Since integrity follow-up 2 the cron hands it
 * `presetKeyOf(battle.strategyPreset)` — an own key of the table, else
 * 'balanced' — so an inherited name like 'constructor' no longer throws.
 * `presetKeyOf` is a lookup itself: what it returns is one of the server
 * table's own keys, never the owner's string — the value every trade row's
 * `entryPreset` carries since enforce readiness, founder Q4.)
 */
const SERVER_LOOKUPS = ['findPortfolioSlot', 'findBenchAsset', 'fetchPricesForProposal', 'serverProposalEvaluationId', 'serverProposalDecision', 'serverTradeId', 'getPresetConfig', 'presetKeyOf'];
/** The text sanitizers (a capped string, or nothing). */
const TEXT_SANITIZERS = ['clientText', 'clientToken', 'proposalDescriptiveMetadata'];
/** P6's belief sanitizers (expectedOutOfStored type-checks a stored belief). */
const BELIEF_SANITIZERS = ['expectedOutOfStored', 'expectedOutOfPosition'];
/** Reviewed helpers that may receive the whole battle (each reads server fields only). */
const BATTLE_HELPERS = ['desiredTempoOf'];
/**
 * Metadata keys that must hold the server's own value — never text from an
 * owner-writable record, not even capped. `entryPreset` joined at enforce
 * readiness (founder Q4): the preset that governed, `presetKeyOf(…)`, at every
 * call — a capped owner string (`clientToken(battle.strategyPreset)`) now fails.
 */
const SERVER_ONLY_KEYS = ['id', 'action', 'evaluationId', 'tradingDay', 'entryConviction', 'entryPreset', 'exitReason', 'source', 'archetype', 'hftKnobsSource', 'swapProvenance'];
/** The builders a metadata object may spread. */
const METADATA_SPREADS = ['buildSwapReceiptSource', 'buildSwapProvenance', 'proposalDescriptiveMetadata'];

function walk(node, visit, parents = []) {
  if (!node || typeof node.type !== 'string') return;
  visit(node, parents);
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'start' || key === 'end') continue;
    const v = node[key];
    if (Array.isArray(v)) for (const c of v) walk(c, visit, [...parents, node]);
    else if (v && typeof v.type === 'string') walk(v, visit, [...parents, node]);
  }
}
const calleeName = (call) => (call.callee.type === 'Identifier' ? call.callee.name : (call.callee.type === 'MemberExpression' && !call.callee.computed ? call.callee.property.name : null));
const isFn = (n) => n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression';
const isScope = (n) => isFn(n) || ['BlockStatement', 'Program', 'ForStatement', 'ForOfStatement', 'ForInStatement', 'SwitchCase', 'CatchClause'].includes(n.type);
const unwrap = (n) => (n && (n.type === 'AwaitExpression' || n.type === 'ChainExpression') ? unwrap(n.argument ?? n.expression) : n);
const rootIdentifier = (n) => {
  let cur = n;
  while (cur && (cur.type === 'MemberExpression' || cur.type === 'ChainExpression')) cur = cur.type === 'ChainExpression' ? cur.expression : cur.object;
  return cur?.type === 'Identifier' ? cur.name : null;
};

/**
 * `<alias>.<field>…` / `<alias>['field']…` → the field; a computed member on an
 * alias with a non-literal key → '?' (unknowable: treated as owner-writable).
 */
function aliasField(n, aliases) {
  let cur = n;
  while (cur && (cur.type === 'MemberExpression' || cur.type === 'ChainExpression')) {
    if (cur.type === 'ChainExpression') { cur = cur.expression; continue; }
    if (cur.object.type === 'Identifier' && aliases.has(cur.object.name)) {
      if (!cur.computed) return cur.property.name;
      return cur.property.type === 'Literal' ? String(cur.property.value) : '?';
    }
    cur = cur.object;
  }
  return null;
}

/**
 * Every reference in `node` to an owner-writable value that is not laundered by
 * one of `sanitizers`. With `wholeBattle`, a call that hands an alias of the
 * battle to a helper outside BATTLE_HELPERS counts as a reference too.
 */
function taintedRefs(node, { clientFields, tainted, aliases, sanitizers, wholeBattle = false }) {
  const out = [];
  const visit = (n) => {
    if (!n || typeof n.type !== 'string') return;
    if (n.type === 'CallExpression' && sanitizers.includes(calleeName(n))) return; // laundered
    if (wholeBattle && n.type === 'CallExpression' && !BATTLE_HELPERS.includes(calleeName(n))
      && n.arguments.some((a) => a.type === 'Identifier' && aliases.has(a.name))) {
      out.push(`${calleeName(n)}(battle)`);
    }
    if (n.type === 'MemberExpression') {
      const field = aliasField(n, aliases);
      if (field && (field === '?' || clientFields.includes(field))) { out.push(`battle.${field}`); return; }
    }
    if (n.type === 'Identifier' && tainted.has(n.name)) { out.push(n.name); return; }
    for (const key of Object.keys(n)) {
      if (key === 'loc' || key === 'start' || key === 'end') continue;
      if (n.type === 'MemberExpression' && key === 'property' && !n.computed) continue;
      if (n.type === 'Property' && key === 'key' && !n.computed) continue;
      const v = n[key];
      if (Array.isArray(v)) v.forEach(visit); else if (v && typeof v.type === 'string') visit(v);
    }
  };
  visit(node);
  return out;
}

/** The names a binding pattern introduces, each with the property key it reads (null when unknown). */
function boundNames(pattern) {
  if (!pattern) return [];
  if (pattern.type === 'Identifier') return [{ name: pattern.name, key: null }];
  if (pattern.type === 'AssignmentPattern') return boundNames(pattern.left);
  if (pattern.type === 'RestElement') return boundNames(pattern.argument);
  if (pattern.type === 'ArrayPattern') return pattern.elements.flatMap((e) => boundNames(e));
  if (pattern.type === 'ObjectPattern') {
    return pattern.properties.flatMap((p) => {
      if (p.type === 'RestElement') return boundNames(p.argument);
      const key = !p.computed && p.key.type === 'Identifier' ? p.key.name : (p.key.type === 'Literal' ? String(p.key.value) : '?');
      return boundNames(p.value).map((b) => ({ ...b, key: b.key ?? key }));
    });
  }
  return [];
}

/**
 * The function's aliases of `battle` and its tainted local names, to a fixpoint:
 * `const x = <tainted>`, `let x; x = <tainted>`, `for (const x of <tainted>)`,
 * `const b = battle` (an alias), `const { executionMode } = battle` and any
 * destructuring of a tainted value.
 */
function taintOf(fnNode, clientFields, sanitizers) {
  const aliases = new Set(['battle']);
  const tainted = new Set();
  let grew = true;
  const ctx = () => ({ clientFields, tainted, aliases, sanitizers });
  const bind = (pattern, valueNode) => {
    const v = unwrap(valueNode);
    for (const { name, key } of boundNames(pattern)) {
      if (tainted.has(name) || aliases.has(name)) continue;
      if (pattern.type === 'Identifier' && v?.type === 'Identifier' && aliases.has(v.name)) { aliases.add(name); grew = true; continue; }
      const fromAlias = v?.type === 'Identifier' && aliases.has(v.name);
      if ((fromAlias && (key === null || key === '?' || clientFields.includes(key))) || (!fromAlias && taintedRefs(valueNode, ctx()).length)) {
        tainted.add(name); grew = true;
      }
    }
  };
  while (grew) {
    grew = false;
    walk(fnNode.body, (n) => {
      if (n.type === 'VariableDeclarator' && n.init) bind(n.id, n.init);
      if (n.type === 'AssignmentExpression' && n.operator === '=' && (n.left.type === 'Identifier' || n.left.type === 'ObjectPattern' || n.left.type === 'ArrayPattern')) bind(n.left, n.right);
      if (n.type === 'ForOfStatement' && n.left.type === 'VariableDeclaration') {
        for (const { name } of boundNames(n.left.declarations[0].id)) {
          if (!tainted.has(name) && taintedRefs(n.right, ctx()).length) { tainted.add(name); grew = true; }
        }
      }
    });
  }
  return { tainted, aliases };
}

/** The declaration of `name` in scope at `atNode`: the nearest preceding one whose block encloses the call. */
function declaratorInScope(fnNode, name, atNode) {
  let best = null;
  walk(fnNode.body, (n, parents) => {
    if (n.type !== 'VariableDeclarator' || n.id.type !== 'Identifier' || n.id.name !== name || n.start > atNode.start) return;
    const scope = [...parents].reverse().find(isScope) ?? fnNode.body;
    if (atNode.start < scope.start || atNode.end > scope.end) return;
    if (!best || n.start > best.start) best = n;
  }, [fnNode]);
  return best;
}

/** Every write to `name` after its declaration: a reassignment, an update, a member write, Object.assign. */
function writesTo(fnNode, name) {
  const writes = [];
  walk(fnNode.body, (n) => {
    if (n.type === 'AssignmentExpression' && (rootIdentifier(n.left) === name)) writes.push(n.start);
    if (n.type === 'UpdateExpression' && rootIdentifier(n.argument) === name) writes.push(n.start);
    if (n.type === 'CallExpression' && n.callee.type === 'MemberExpression' && n.callee.object.type === 'Identifier' && n.callee.object.name === 'Object'
      && !n.callee.computed && ['assign', 'defineProperty', 'defineProperties'].includes(n.callee.property.name)
      && n.arguments[0]?.type === 'Identifier' && n.arguments[0].name === name) writes.push(n.start);
  });
  return writes;
}

const CRON_SOURCE = readFileSync(CRON_PATH, 'utf8');
const CRON_AST = parse(CRON_SOURCE, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
const CLIENT_FIELDS = ownerWritableBattleFields();

/** Every executeSwapServer call in the cron, with its enclosing function. */
const CALLS = [];
walk(CRON_AST, (n, parents) => {
  if (n.type === 'CallExpression' && calleeName(n) === 'executeSwapServer') CALLS.push({ call: n, fn: [...parents].reverse().find(isFn), line: n.loc.start.line });
});

/** The metadata object of one call: the ObjectExpression handed to executorMetadata(…), resolved in scope. */
function metadataObject({ call, fn }) {
  let arg = unwrap(call.arguments[8]);
  if (arg?.type === 'Identifier') {
    if (writesTo(fn, arg.name).length) return null; // built once, never reassigned or mutated
    arg = unwrap(declaratorInScope(fn, arg.name, call)?.init ?? null);
  }
  if (!arg || arg.type !== 'CallExpression' || calleeName(arg) !== 'executorMetadata') return null;
  return arg.arguments[0]?.type === 'ObjectExpression' ? arg.arguments[0] : null;
}

/** The P6 options spread of one call (`...swapIdentityOptions(…)`), or null. */
function optionsSpread({ call }) {
  const spreads = call.arguments.filter((a) => a.type === 'SpreadElement');
  return spreads.length === 1 && spreads[0].argument.type === 'CallExpression' && calleeName(spreads[0].argument) === 'swapIdentityOptions' ? spreads[0] : null;
}

/** The whole static check of one call: a list of problems (empty = clean). */
function problemsOf(site) {
  const problems = [];
  const obj = metadataObject(site);
  if (!obj) return [`line ${site.line}: the ninth argument is not an executorMetadata({…}) object built once in scope`];
  const loose = taintOf(site.fn, CLIENT_FIELDS, [...SERVER_LOOKUPS, ...TEXT_SANITIZERS]);
  const strict = taintOf(site.fn, CLIENT_FIELDS, SERVER_LOOKUPS);
  const looseCtx = { clientFields: CLIENT_FIELDS, ...loose, sanitizers: [...SERVER_LOOKUPS, ...TEXT_SANITIZERS], wholeBattle: true };
  const strictCtx = { clientFields: CLIENT_FIELDS, ...strict, sanitizers: SERVER_LOOKUPS, wholeBattle: true };
  for (const p of obj.properties) {
    if (p.type === 'SpreadElement') {
      const name = p.argument.type === 'CallExpression' ? calleeName(p.argument) : null;
      if (!METADATA_SPREADS.includes(name)) problems.push(`line ${site.line}: spread of ${name ?? 'a non-builder'}`);
      for (const r of taintedRefs(p.argument, looseCtx)) problems.push(`line ${site.line}: spread reads ${r}`);
      continue;
    }
    const key = p.key.type === 'Identifier' ? p.key.name : (p.key.type === 'Literal' ? p.key.value : '<computed>');
    if (p.computed || !EXECUTOR_METADATA_KEYS.includes(key)) { problems.push(`line ${site.line}: key ${key}`); continue; }
    for (const r of taintedRefs(p.value, SERVER_ONLY_KEYS.includes(key) ? strictCtx : looseCtx)) problems.push(`line ${site.line}: ${key} reads ${r}`);
  }
  for (const at of [5, 6, 7, 9]) {
    const arg = site.call.arguments[at];
    if (!arg || arg.type === 'SpreadElement') continue; // the meeting leg passes nine arguments (+ the P6 options)
    for (const r of taintedRefs(arg, strictCtx)) problems.push(`line ${site.line}: argument ${at + 1} reads ${r}`);
  }
  const opts = optionsSpread(site);
  if (!opts) problems.push(`line ${site.line}: the trailing arguments are not exactly one ...swapIdentityOptions(…)`);
  else for (const r of taintedRefs(opts.argument, { ...strictCtx, sanitizers: [...SERVER_LOOKUPS, ...BELIEF_SANITIZERS] })) problems.push(`line ${site.line}: the P6 belief reads ${r}`);
  const slotRefs = [3, 4].flatMap((at) => taintedRefs(site.call.arguments[at], strictCtx));
  const src = (n) => CRON_SOURCE.slice(n.start, n.end);
  if (slotRefs.length && !(site.fn.id?.name === 'handlePendingProposal'
    && src(site.call.arguments[3]) === 'proposal.tier' && src(site.call.arguments[4]) === 'proposal.slotIndex')) {
    problems.push(`line ${site.line}: the slot reads ${slotRefs.join(', ')} outside the documented dormant-proposal exception`);
  }
  return problems;
}

describe('STATIC — every production executor call builds its metadata from the allowlist and the server\'s own values', () => {
  it('the owner-writable battle fields are read from firestore.rules (non-vacuous)', () => {
    expect(CLIENT_FIELDS).toEqual(expect.arrayContaining(['executionMode', 'pendingProposal', 'strategyPreset', 'gameplanMeeting', 'gameplanMeetingHistory']));
    expect(CLIENT_FIELDS).not.toContain('trades');
    expect(CLIENT_FIELDS).not.toContain('scoreState');
  });

  it('the cron is the only production caller, with exactly six calls — each with its OWN metadata object (review I4-1)', () => {
    expect(CALLS.map((c) => c.line)).toHaveLength(6);
    const objects = CALLS.map(metadataObject);
    expect(objects.every(Boolean)).toBe(true);
    expect(new Set(objects).size).toBe(CALLS.length);
    for (const rel of ['api/_utils/agentRiskManager.js', 'api/_utils/tournamentAgentLedger.js', 'api/_utils/executorMetadata.js', 'api/_utils/callRecords/observe.js', 'api/_utils/shadowLogger.js']) {
      const ast = parse(readFileSync(resolve(ROOT, rel), 'utf8'), { ecmaVersion: 'latest', sourceType: 'module' });
      let calls = 0;
      walk(ast, (n) => { if (n.type === 'CallExpression' && calleeName(n) === 'executeSwapServer') calls += 1; });
      expect(calls, rel).toBe(0);
    }
  });

  it('the allowlist is disjoint from the executor\'s computed row keys, and those keys are read off the fenced closedTrade literal', () => {
    const ast = parse(readFileSync(EXECUTOR_PATH, 'utf8'), { ecmaVersion: 'latest', sourceType: 'module' });
    let literal = null;
    walk(ast, (n) => { if (!literal && n.type === 'VariableDeclarator' && n.id.name === 'closedTrade') literal = n.init; });
    const computed = [];
    for (const p of literal.properties) {
      if (p.type === 'Property') computed.push(p.key.name);
      else if (p.argument.type === 'Identifier' && p.argument.name === 'evaluationMetadata') computed.push('<metadata>');
      else walk(p.argument, (n) => { if (n.type === 'Property') computed.push(n.key.name); });
    }
    // The metadata spread sits AFTER the computed fields (the reason this guard exists) …
    expect(computed.indexOf('<metadata>')).toBeGreaterThan(computed.indexOf('lockedPoints'));
    // … and every key the executor computes is in EXECUTOR_COMPUTED_KEYS, which the allowlist never overlaps.
    expect(computed.filter((k) => k !== '<metadata>').sort()).toEqual([...EXECUTOR_COMPUTED_KEYS].sort());
    for (const key of EXECUTOR_METADATA_KEYS) expect(EXECUTOR_COMPUTED_KEYS, key).not.toContain(key);
  });

  // One row per call the cron makes — a seventh call is checked the moment it exists (review I4-3).
  for (const [i, site] of CALLS.entries()) {
    it(`call #${i + 1} (line ${site.line}, ${site.fn.id?.name ?? 'anonymous'}): allowlisted keys, known spreads, no owner-writable value in the metadata, the day, the asset, the prices, the snapshot or the belief; the slot only at the documented exception`, () => {
      expect(problemsOf(site)).toEqual([]);
    });
  }

  describe('the guard bites (each defeat a lens found, and the classic ones)', () => {
    /** The executor's name, built so no literal call appears here (the repo-level census in agent-evaluate.test.js). */
    const EXEC = ['executeSwap', 'Server'].join('');
    /** Run the static check on a synthetic function holding one executor call. */
    const check = (body) => {
      const ast = parse(`async function processAgentBattle(db, battle) {\n${body}\n}`, { ecmaVersion: 'latest', locations: true });
      const sites = [];
      walk(ast, (n, parents) => { if (n.type === 'CallExpression' && calleeName(n) === 'executeSwapServer') sites.push({ call: n, fn: [...parents].reverse().find(isFn), line: n.loc.start.line }); });
      return sites.map(problemsOf);
    };
    const CALL = (meta, rest = 'currentDay, prices, meta, snapshot, ...swapIdentityOptions(mode, expectedOutOfPosition(pos))') =>
      `await ${EXEC}(db, battle.id, battle, slot.tier, slot.slotIndex, bench, ${rest.replace('meta', meta)});`;

    it('clean: two same-named metadata objects in sibling blocks each resolve to their own (I4-1)', () => {
      const out = check(`
        if (a) { const evaluationMetadata = executorMetadata({ id: 'x', entryMode: clientToken(battle.executionMode) }); ${CALL('evaluationMetadata')} }
        else { const evaluationMetadata = executorMetadata({ id: 'y', lockedPoints: 1 }); ${CALL('evaluationMetadata')} }`);
      expect(out[0]).toEqual([]);
      expect(out[1].join()).toMatch(/key lockedPoints/);
    });

    it('a stray key, a raw read, an id through clientText, a raw spread', () => {
      const [p] = check(`const proposal = battle.pendingProposal; ${CALL(`executorMetadata({ id: clientText(proposal.id), entryPreset: battle.strategyPreset, lockedPoints: 1, ...(proposal.evaluationMetadata || {}) })`)}`);
      expect(p.join('\n')).toMatch(/id reads proposal/);
      expect(p.join('\n')).toMatch(/entryPreset reads battle\.strategyPreset/);
      expect(p.join('\n')).toMatch(/key lockedPoints/);
      expect(p.join('\n')).toMatch(/spread of a non-builder/);
    });

    it('enforce readiness (Q4): the preset is the governing key — the owner\u2019s capped string bites, presetKeyOf is clean', () => {
      const [capped, governing] = check(`
        ${CALL(`executorMetadata({ id: 'x', entryPreset: clientToken(battle.strategyPreset) || 'balanced' })`)}
        ${CALL(`executorMetadata({ id: 'y', entryPreset: presetKeyOf(battle.strategyPreset) })`)}`);
      expect(capped.join('\n')).toMatch(/entryPreset reads battle\.strategyPreset/);
      expect(governing).toEqual([]);
    });

    it('an alias, destructuring, a computed member, a let reassignment, a for-of leg, an unreviewed helper (I4-2)', () => {
      const [p] = check(`
        const b = battle;
        const { executionMode } = battle;
        let late = null; late = battle.gameplanMeeting;
        for (const leg of battle.gameplanMeeting.suggestedSwaps) { var x = leg; }
        ${CALL(`executorMetadata({ swapMotive: b.gameplanMeeting?.diagnosis ?? null, entryMode: executionMode, trigger: battle['strategyPreset'], rationale: late, hypothesis: modeOf(battle), entryRegime: battle[k] })`)}`);
      const text = p.join('\n');
      for (const re of [/swapMotive reads battle\.gameplanMeeting/, /entryMode reads executionMode/, /trigger reads battle\.strategyPreset/, /rationale reads late/, /hypothesis reads modeOf\(battle\)/, /entryRegime reads battle\.\?/]) expect(text).toMatch(re);
    });

    it('metadata mutated after construction, or declared without a value and assigned later (I4-1)', () => {
      expect(check(`const evaluationMetadata = executorMetadata({ id: 'x' }); evaluationMetadata.entryMode = battle.executionMode; ${CALL('evaluationMetadata')}`)[0].join()).toMatch(/not an executorMetadata/);
      expect(check(`let evaluationMetadata; evaluationMetadata = { lockedPoints: 1 }; ${CALL('evaluationMetadata')}`)[0].join()).toMatch(/not an executorMetadata/);
      expect(check(`const evaluationMetadata = executorMetadata({ id: 'x' }); Object.assign(evaluationMetadata, { lockedPoints: 1 }); ${CALL('evaluationMetadata')}`)[0].join()).toMatch(/not an executorMetadata/);
    });

    it('the day, the snapshot and the P6 belief: a stored day, a stored snapshot, a raw stored belief (I3-1)', () => {
      const [p] = check(`const proposal = battle.pendingProposal; ${CALL('executorMetadata({})', `proposal.evaluationMetadata.tradingDay, prices, meta, proposal.snapshot, ...swapIdentityOptions(mode, { symbol: proposal.symbolOut, swappedInAt: proposal.outgoingSwappedInAt })`)}`);
      const text = p.join('\n');
      expect(text).toMatch(/argument 7 reads proposal/);
      expect(text).toMatch(/argument 10 reads proposal/);
      expect(text).toMatch(/the P6 belief reads proposal/);
      const [clean] = check(`const proposal = battle.pendingProposal; ${CALL('executorMetadata({})', `day, prices, meta, null, ...swapIdentityOptions(mode, expectedOutOfStored(proposal.symbolOut, proposal, 'outgoingSwappedInAt'))`)}`);
      expect(clean).toEqual([]);
    });

    it('a slot read outside the documented exception', () => {
      const [p] = check(`const leg = battle.gameplanMeeting; await ${EXEC}(db, battle.id, battle, leg.tier, leg.slotIndex, bench, day, prices, executorMetadata({}), null, ...swapIdentityOptions(mode, null));`);
      expect(p.join()).toMatch(/the slot reads/);
    });
  });
});

// ───────────────────────────────────────────────────────── behavioural half

const N = 424242;              // a planted number
const ID = 'PLNTID';           // a planted id
const SYM = 'PLNTSYM';         // a planted symbol
const DESC = 'DESC';           // planted descriptive text — may ride, capped

/**
 * Every owner-writable battle field, planted (shapes the tick can still read) —
 * a pending proposal and a rejected meeting included for EVERY caller, so a
 * live path that read either (the risk loop runs before both handlers clear
 * them) would carry a sentinel onto its row (review IV4-I4-2).
 */
function plantedBattle(overrides = {}) {
  return makeTickBattle({
    // A STRING carrying the symbol sentinel (review K4-1): a number would read as 'autopilot'
    // through clientToken anyway, so a caller that stamped entryMode from the
    // battle again would pass; a sentinel string on any row fails plantedIn.
    executionMode: `${SYM}_MODE`,
    pendingProposal: plantedProposal(),
    gameplanMeeting: { id: ID, status: 'rejected', diagnosis: DESC.repeat(600), lockedPoints: N, expiresAt: '2026-09-09T20:00:00.000Z', suggestedSwaps: [plantedLeg('KO', 'AMD')] },
    // A STRING carrying the symbol sentinel (enforce readiness, founder Q4): the
    // row's preset is the one that GOVERNED — `presetKeyOf` reads an unknown
    // string as 'balanced' — so a caller that stamped the owner's capped
    // string again would carry the sentinel onto its row, and plantedIn fails.
    strategyPreset: `${SYM}_PRESET`,
    battleLedger: [{ type: 'debate', targetSymbol: SYM, lockedPoints: N, id: ID }],
    dailyGrades: { '2026-09-09': { trades: [{ tradeIndex: N, grade: 'A', symbolOut: SYM }] } },
    feedBookmarks: [ID],
    reviewDecisions: { [ID]: 'accepted' },
    gameplanMeetingHistory: [{ id: ID, lockedPoints: N, legRefusals: [{ reason: ID }] }],
    ...overrides,
  });
}
const plantedMetadata = () => ({
  lockedPoints: N, entryPrice: N, exitPrice: N, lockedGainPct: N, symbolOut: SYM, symbolIn: SYM, swapDay: N, tradingDay: N,
  entryMode: `${SYM}_MODE`, // review K4-1: the stored mode never reaches a row (proposalDescriptiveMetadata drops it)
  entryPreset: `${SYM}_PRESET`, // enforce readiness (Q4): nor the stored preset — C3 / C4 stamp the governing one
  swappedOutAt: ID, evaluationId: ID, id: ID, entryConviction: N, source: ID, exitReason: ID, archetype: ID, hftKnobsSource: ID,
  swapProvenance: { dialBandVersion: N }, verification: { verificationId: ID, mode: 'shadow' }, snapshot: { n: N },
  rationale: DESC.repeat(600), hypothesis: DESC, trigger: DESC, entryRegime: DESC.repeat(40), swapMotive: DESC,
  trade_reasoning: { thesis: DESC, conviction: N, indicators: [DESC, N], id: ID },
});
const plantedProposal = (extra = {}) => ({
  proposalId: ID, evalId: ID, symbolOut: 'KO', symbolIn: 'AMD', tier: 'support', slotIndex: 0, mode: 'copilot',
  conviction: N, scoreAtProposal: N, createdAt: '2026-09-09T14:40:00.000Z', expiresAt: '2026-09-09T14:50:00.000Z',
  resolvedAt: '2026-09-09T14:45:00.000Z', resolution: 'approved', resolvedBy: ID,
  outgoingSwappedInAt: N, // P6's stored belief, planted as a number: dropped by expectedOutOfStored (symbol only)
  evaluationMetadata: plantedMetadata(), snapshot: { symbolOut: { rsi: N }, symbolIn: { rsi: N } }, ...extra,
});
/** The legs the server stored in its copy of a meeting it created (integrity follow-up 2, Part A) — server values only. */
const SERVER_LEGS = Object.freeze([{ symbolOut: 'KO', symbolIn: 'AMD', swappedInAt: null }]);
const plantedLeg = (symbolOut, symbolIn) => ({ symbolOut, symbolIn, rationale: DESC.repeat(600), tier: N, slotIndex: N, id: ID, evaluationId: ID, lockedPoints: N, tradingDay: N, swappedInAt: N });

/** Every planted number, id or symbol found anywhere in `value` (descriptive text excepted). */
function plantedIn(value, path = '$') {
  if (value === N) return [path];
  if (typeof value === 'string') return (value.includes(ID) || value.includes(SYM)) ? [path] : [];
  if (Array.isArray(value)) return value.flatMap((v, i) => plantedIn(v, `${path}[${i}]`));
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => plantedIn(v, `${path}.${k}`));
  return [];
}
/** Every descriptive string longer than its cap. */
function overlong(meta) {
  return Object.entries(meta).filter(([k, v]) => typeof v === 'string' && v.includes(DESC)
    && v.length > (['entryPreset', 'entryMode', 'entryRegime', 'entryMarketPosture', 'swapMotive'].includes(k) ? CLIENT_TOKEN_MAX : CLIENT_TEXT_MAX)).map(([k]) => k);
}

async function runTick({ battle, result = makeHoldResult(), prices = makePriceTable() }) {
  mocks.getStockAnalysisData.mockImplementation(async (symbol) => (prices[symbol] ? { price: prices[symbol], daily: [] } : {}));
  mocks.fetchIntradayBatch.mockImplementation(async () => ({ NVDA: makeIntradayCandles() }));
  mocks.create.mockImplementation(async () => makeToolUseResponse(result));
  const db = makeCallsDb({ battle, rankingsDoc: makeRankingsDoc(), techDocs: makeTechDocs() });
  await processAgentBattle(db, battle, { evaluated: 0, held: 0, triggered: 0, skipped: 0, swapped: 0 }, Date.now(), new Map(), { everEnabled: false });
  return { stored: db.__store.battle };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(FROZEN_NOW));
  mocks.getStockAnalysisData.mockReset();
  mocks.fetchIntradayBatch.mockReset();
  mocks.create.mockReset();
  authority.mode = 'autopilot';
  flags.swapIdentity = 'off';
  exec.calls = [];
  exec.afterCall = null;
  guardrailHook.result = null;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

function bustingPrices() {
  const prices = makePriceTable();
  prices.KO = { ...prices.KO, current: 61.578 };
  prices.PG = { ...prices.PG, current: 163.647 };
  return prices;
}

/** Each caller, the cron function that must make its call, and a test that the call is that caller's. */
const CALLERS = [
  { name: 'C1 risk loop', site: 'processAgentBattle', is: (m) => /^risk_/.test(m.evaluationId), run: (extra = {}) => runTick({ battle: plantedBattle(extra), prices: bustingPrices() }) },
  { name: 'C2 model route', site: 'processAgentBattle', is: (m) => /^eval_/.test(m.evaluationId), run: (extra = {}) => runTick({ battle: plantedBattle(extra), result: makeSwapResult() }) },
  { name: 'C3 approved proposal (dormant, mode mocked copilot)', site: 'handlePendingProposal', dormant: true, is: () => true, after: (s) => s.proposalHistory.at(-1)?.resolution === 'approved', run: (extra = {}) => runTick({ battle: plantedBattle({ pendingProposal: plantedProposal(), ...extra }) }) },
  { name: 'C4 expired co-pilot proposal (dormant, mode mocked copilot)', site: 'handlePendingProposal', dormant: true, is: () => true, after: (s) => s.proposalHistory.at(-1)?.resolution === 'auto_executed', run: (extra = {}) => runTick({ battle: plantedBattle({ pendingProposal: plantedProposal({ resolvedAt: null, resolution: null }), ...extra }) }) },
  {
    name: 'C5 suppression pass', site: 'runSuppressionDeterministicPass', is: () => true,
    run: (extra = {}) => {
      guardrailHook.result = { decision: 'SWAP', symbolOut: 'KO', symbolIn: 'AMD', sourceNote: 'guardrail_stopLoss', statusMessage: 'Stop hit on KO.', overrides: [] };
      // Integrity follow-up 2 (Part A): the meeting the SERVER created (its copy
      // holds the one leg it proposed), every other field of it then planted.
      return runTick({ battle: plantedBattle({
        ...serverMeetingOverrides({ id: ID, status: 'pending', diagnosis: DESC, expiresAt: '2026-09-09T23:00:00.000Z', suggestedSwaps: [plantedLeg('KO', 'AMD')] }, { legs: SERVER_LEGS }),
        agentContext: { ...makeTickBattle().agentContext, deployedGuardrails: [{ type: 'stopLoss', value: 1, unit: '%', enforcement: 'hard' }] },
        ...extra,
      }) });
    },
  },
  { name: 'C6 approved meeting', site: 'handleGameplanMeeting', is: () => true, run: (extra = {}) => runTick({ battle: plantedBattle({ ...serverMeetingOverrides({ id: ID, status: 'approved', diagnosis: DESC, expiresAt: '2026-09-09T20:00:00.000Z', suggestedSwaps: [plantedLeg('KO', 'AMD')] }, { legs: SERVER_LEGS }), ...extra }) }) },
];

describe('BEHAVIOURAL — every owner-writable field planted; the six callers through processAgentBattle at off, shadow and enforce', () => {
  for (const mode of ['off', 'shadow', 'enforce']) {
    for (const caller of CALLERS) {
      it(`${mode} · ${caller.name}: reaches its own call site; no planted number, id or symbol reaches the executor or the trade row; keys allowlisted; text capped`, async () => {
        flags.swapIdentity = mode;
        if (caller.dormant) authority.mode = 'copilot';
        const { stored } = await caller.run();
        const calls = exec.calls.filter((c) => c.site === caller.site && caller.is(c.args[5]));
        expect(calls.length, `${caller.name} made no executor call at ${caller.site} (vacuous)`).toBeGreaterThan(0);
        for (const { args } of calls) {
          // args = [tier, slotIndex, benchAsset, currentDay, prices, metadata, snapshot, opts?]
          const [, , benchAsset, day, prices, meta, snapshot, opts] = args;
          for (const key of Object.keys(meta)) expect(EXECUTOR_METADATA_KEYS, `${caller.name}: key ${key}`).toContain(key);
          expect(plantedIn({ benchAsset, day, prices, meta, snapshot, opts }), caller.name).toEqual([]);
          expect(day).toBe(1);
          expect(overlong(meta), caller.name).toEqual([]);
        }
        expect(stored.trades.length, `${caller.name}: nothing committed`).toBeGreaterThan(0);
        if (caller.after) expect(caller.after(stored), `${caller.name}: the wrong branch ran (review IV4-I4-8)`).toBe(true);
        for (const row of stored.trades) {
          for (const key of Object.keys(row)) expect([...EXECUTOR_COMPUTED_KEYS, ...EXECUTOR_METADATA_KEYS], `${caller.name}: row key ${key}`).toContain(key);
          expect(plantedIn(row), caller.name).toEqual([]);
          expect(overlong(row), caller.name).toEqual([]);
          if (mode !== 'off') expect(row.verification?.mode, caller.name).toBe(mode);
          // Integrity follow-up 2 (Q4): the mode that GOVERNED — never the planted string (review K4-1).
          expect(row.entryMode, caller.name).toBe(caller.dormant ? 'copilot' : 'autopilot');
          // Enforce readiness (Q4): the preset that GOVERNED — the planted string is no table key, so 'balanced'.
          expect(row.entryPreset, caller.name).toBe('balanced');
        }
      });
    }
  }

  // Enforce readiness (founder Q4) — acceptance 4, the other half: a
  // well-formed preset is the one that governed, so its rows are unchanged —
  // each caller stamps exactly the battle's own preset key.
  for (const preset of ['aggressive', 'defensive']) {
    for (const caller of CALLERS) {
      it(`a well-formed preset (${preset}) · ${caller.name}: the row's entryPreset is the battle's own key, as before`, async () => {
        if (caller.dormant) authority.mode = 'copilot';
        const { stored } = await caller.run({ strategyPreset: preset });
        expect(stored.trades.length, `${caller.name}: nothing committed`).toBeGreaterThan(0);
        for (const row of stored.trades) expect(row.entryPreset, caller.name).toBe(preset);
      });
    }
  }

  it('the six callers drive every executor call site in the cron — a seventh call needs a seventh caller here (review I4-3 / IV4-I4-8)', async () => {
    expect(CALLERS).toHaveLength(CALLS.length);
    const hit = new Set();
    for (const caller of CALLERS) {
      exec.calls = [];
      guardrailHook.result = null;
      authority.mode = caller.dormant ? 'copilot' : 'autopilot';
      await caller.run();
      for (const c of exec.calls) if (c.site === caller.site && caller.is(c.args[5])) hit.add(c.line);
    }
    expect([...hit].sort((a, b) => a - b)).toEqual(CALLS.map((c) => c.line).sort((a, b) => a - b));
  });

  it('enforce readiness (review ER1-1): the preset is resolved ONCE — an owner\u2019s mid-tick change never relabels a later row', async () => {
    // Two risk exits under 'defensive' (KO, then PG); the owner switches the
    // battle to 'aggressive' as soon as the first lands. The second exit was
    // decided on defensive's verdict (the check's presetConfig), so its row
    // says so — before the fix it read the refreshed 'aggressive'.
    let flipped = false;
    exec.afterCall = (db) => { if (flipped) return; flipped = true; db.__store.battle.strategyPreset = 'aggressive'; };
    const { stored } = await runTick({ battle: plantedBattle({ strategyPreset: 'defensive' }), prices: bustingPrices() });
    expect(flipped, 'the owner\u2019s change was written (non-vacuous)').toBe(true);
    expect(stored.strategyPreset).toBe('aggressive');
    expect(stored.trades.length, 'both exits traded').toBe(2);
    expect(stored.trades.map((t) => t.entryPreset)).toEqual(['defensive', 'defensive']);
  });

  it('ER5 — the approved meeting leg stamps the governing preset after a risk exit’s refresh merged an owner change (C6, review ER1-1)', async () => {
    // One risk exit (KO busts) under 'defensive'; the owner switches the battle to
    // 'aggressive' as soon as it lands, and refreshBattleFromDoc merges that into
    // `battle`. The approved meeting's leg runs later in the SAME check, under the
    // check's presetConfig, so its row says 'defensive' too.
    let flipped = false;
    exec.afterCall = (db) => { if (flipped) return; flipped = true; db.__store.battle.strategyPreset = 'aggressive'; };
    const prices = makePriceTable();
    prices.KO = { ...prices.KO, current: 61.578 };
    const { stored } = await runTick({ prices, battle: plantedBattle({
      strategyPreset: 'defensive',
      ...serverMeetingOverrides({ id: ID, status: 'approved', diagnosis: DESC, expiresAt: '2026-09-09T20:00:00.000Z', suggestedSwaps: [plantedLeg('PG', 'JPM')] }, { legs: [{ symbolOut: 'PG', symbolIn: 'JPM', swappedInAt: null }] }),
    }) });
    expect(flipped, 'the owner’s change was written (non-vacuous)').toBe(true);
    expect(exec.calls.map((c) => `${c.site}:${c.args[2]?.symbol}`)).toEqual(['processAgentBattle:AMD', 'handleGameplanMeeting:JPM']);
    expect(stored.strategyPreset).toBe('aggressive');
    expect(stored.trades.map((t) => t.entryPreset)).toEqual(['defensive', 'defensive']);
  });

  it('enforce readiness (review ER1-1): statically — the key is resolved once beside presetConfig, and every executor call stamps that one key', () => {
    expect(CRON_SOURCE).toMatch(/const governingPreset = presetKeyOf\(battle\.strategyPreset\);\s*\n\s*const presetConfig = getPresetConfig\(governingPreset\);/);
    expect(CRON_SOURCE.match(/entryPreset: governingPreset,/g)).toHaveLength(CALLS.length);
  });

  it('at the launch mode the planted proposal never reaches the executor at all (F1)', async () => {
    await runTick({ battle: plantedBattle({ pendingProposal: plantedProposal() }) });
    expect(exec.calls).toEqual([]);
  });
});
