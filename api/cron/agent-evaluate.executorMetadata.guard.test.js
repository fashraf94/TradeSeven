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
//      executeSwapServer call: its metadata is an `executorMetadata({…})` object
//      whose keys are all allowlisted and whose spreads are the three known
//      builders; no argument that lands on the row (the metadata, the day, the
//      prices, the snapshot, the incoming asset) reads an owner-writable field
//      except through a named sanitizer — and an id, the day or a number never
//      even through the text sanitizers. Owner-writable names are traced through
//      `const` declarations and for-of loops to a fixpoint.
//   2. BEHAVIOURAL — the six callers driven through the REAL processAgentBattle
//      with every owner-writable field planted with sentinels: no planted
//      number, id or symbol reaches an executor argument or a written trade
//      row, every row key is computed or allowlisted, descriptive text is capped.
//
// DOCUMENTED EXCEPTIONS (each pinned below, so a new one fails CI):
//   - the two DORMANT proposal sites pass `proposal.tier` / `proposal.slotIndex`:
//     the slot the executor then READS from the live book (the row records the
//     slot actually traded). Which slot a revived proposal may name is the
//     authority arc's (P6 D6); F1 makes the paths unreachable today.
//   - the P6 options (the spread after the snapshot) carry the caller's BELIEF,
//     stored on a proposal or meeting leg at creation; the executor compares it
//     with the live slot and records it as `verification.expected` — it never
//     sets a computed field (the P6 identity suite owns it).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
import {
  FROZEN_NOW, makeTickBattle, makePriceTable, makeRankingsDoc, makeTechDocs, makeIntradayCandles,
  makeHoldResult, makeSwapResult, makeToolUseResponse, deepClone,
} from '../_utils/__fixtures__/tickStampsHarness.js';
import { makeCallsDb } from '../_utils/__fixtures__/callRecordsStore.js';

const mocks = vi.hoisted(() => ({ getStockAnalysisData: vi.fn(), fetchIntradayBatch: vi.fn(), create: vi.fn() }));
const authority = vi.hoisted(() => ({ mode: 'autopilot' }));
const exec = vi.hoisted(() => ({ calls: [] }));
const guardrailHook = vi.hoisted(() => ({ result: null }));

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
  return { ...real, executeSwapServer: async (...args) => { exec.calls.push(deepClone(args.slice(3))); return runReal(...args); } };
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
 * Names whose argument is laundered: lookups / verifiers against server state
 * (`getPresetConfig` maps the owner's preset string onto one of the server's
 * three preset tables, so what flows on — risk verdicts, triggers — is the
 * server's), and the text sanitizers.
 */
const SERVER_LOOKUPS = ['findPortfolioSlot', 'findBenchAsset', 'fetchPricesForProposal', 'serverProposalEvaluationId', 'serverTradeId', 'getPresetConfig'];
const TEXT_SANITIZERS = ['clientText', 'clientToken', 'proposalDescriptiveMetadata'];
/** Metadata keys that must hold the server's own value — never text from an owner-writable record, not even capped. */
const SERVER_ONLY_KEYS = ['id', 'action', 'evaluationId', 'tradingDay', 'entryConviction', 'exitReason', 'source', 'archetype', 'hftKnobsSource', 'swapProvenance'];
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
const unwrap = (n) => (n && (n.type === 'AwaitExpression' || n.type === 'ChainExpression') ? unwrap(n.argument ?? n.expression) : n);
/** `battle.<field>…` → field, else null. */
function battleField(n) {
  let cur = n;
  while (cur && (cur.type === 'MemberExpression' || cur.type === 'ChainExpression')) {
    if (cur.type === 'ChainExpression') { cur = cur.expression; continue; }
    if (cur.object.type === 'Identifier' && cur.object.name === 'battle' && !cur.computed) return cur.property.name;
    cur = cur.object;
  }
  return null;
}

/**
 * Every reference in `node` to an owner-writable value that is not laundered by
 * one of `sanitizers`. `tainted` is the function's set of tainted local names.
 */
function taintedRefs(node, { clientFields, tainted, sanitizers }) {
  const out = [];
  const visit = (n) => {
    if (!n || typeof n.type !== 'string') return;
    if (n.type === 'CallExpression' && sanitizers.includes(calleeName(n))) return; // laundered
    if (n.type === 'MemberExpression') {
      const field = battleField(n);
      if (field && clientFields.includes(field)) { out.push(`battle.${field}`); return; }
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

/** The function's tainted local names, to a fixpoint: `const x = <tainted>` and `for (const x of <tainted>)`. */
function taintedNames(fnNode, clientFields, sanitizers) {
  const tainted = new Set();
  let grew = true;
  while (grew) {
    grew = false;
    walk(fnNode.body, (n) => {
      if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && n.init && !tainted.has(n.id.name)) {
        if (taintedRefs(n.init, { clientFields, tainted, sanitizers }).length) { tainted.add(n.id.name); grew = true; }
      }
      if (n.type === 'ForOfStatement' && n.left.type === 'VariableDeclaration') {
        const id = n.left.declarations[0].id;
        if (id.type === 'Identifier' && !tainted.has(id.name) && taintedRefs(n.right, { clientFields, tainted, sanitizers }).length) { tainted.add(id.name); grew = true; }
      }
    });
  }
  return tainted;
}

function declaratorInit(fnNode, name) {
  let init = null;
  walk(fnNode.body, (n) => { if (!init && n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && n.id.name === name) init = n.init; });
  return init;
}

const CRON_SOURCE = readFileSync(CRON_PATH, 'utf8');
const CRON_AST = parse(CRON_SOURCE, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
const CLIENT_FIELDS = ownerWritableBattleFields();

/** Every executeSwapServer call in the cron, with its enclosing function. */
const CALLS = [];
walk(CRON_AST, (n, parents) => {
  if (n.type === 'CallExpression' && calleeName(n) === 'executeSwapServer') CALLS.push({ call: n, fn: [...parents].reverse().find(isFn), line: n.loc.start.line });
});

/** The metadata object of one call: the ObjectExpression handed to executorMetadata(…). */
function metadataObject({ call, fn }) {
  let arg = unwrap(call.arguments[8]);
  if (arg?.type === 'Identifier') arg = unwrap(declaratorInit(fn, arg.name));
  if (!arg || arg.type !== 'CallExpression' || calleeName(arg) !== 'executorMetadata') return null;
  return arg.arguments[0]?.type === 'ObjectExpression' ? arg.arguments[0] : null;
}

describe('STATIC — every production executor call builds its metadata from the allowlist and the server\'s own values', () => {
  it('the owner-writable battle fields are read from firestore.rules (non-vacuous)', () => {
    expect(CLIENT_FIELDS).toEqual(expect.arrayContaining(['executionMode', 'pendingProposal', 'strategyPreset', 'gameplanMeeting', 'gameplanMeetingHistory']));
    expect(CLIENT_FIELDS).not.toContain('trades');
    expect(CLIENT_FIELDS).not.toContain('scoreState');
  });

  it('the cron is the only production caller, with exactly six calls', () => {
    expect(CALLS.map((c) => c.line)).toHaveLength(6);
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

  for (const [i] of [0, 1, 2, 3, 4, 5].entries()) {
    it(`call #${i + 1}: metadata through executorMetadata — allowlisted keys, known spreads, no owner-writable value (ids and numbers: not even capped)`, () => {
      const site = CALLS[i];
      const obj = metadataObject(site);
      expect(obj, `line ${site.line}: the ninth argument is not executorMetadata({…})`).not.toBeNull();
      const anyTaint = taintedNames(site.fn, CLIENT_FIELDS, [...SERVER_LOOKUPS, ...TEXT_SANITIZERS]);
      const strictTaint = taintedNames(site.fn, CLIENT_FIELDS, SERVER_LOOKUPS);
      for (const p of obj.properties) {
        if (p.type === 'SpreadElement') {
          const name = p.argument.type === 'CallExpression' ? calleeName(p.argument) : null;
          expect(METADATA_SPREADS, `line ${site.line}: spread of ${name}`).toContain(name);
          expect(taintedRefs(p.argument, { clientFields: CLIENT_FIELDS, tainted: anyTaint, sanitizers: [...SERVER_LOOKUPS, ...TEXT_SANITIZERS] }), `line ${site.line}: spread`).toEqual([]);
          continue;
        }
        const key = p.key.type === 'Identifier' ? p.key.name : p.key.value;
        expect(EXECUTOR_METADATA_KEYS, `line ${site.line}: key ${key}`).toContain(key);
        const serverOnly = SERVER_ONLY_KEYS.includes(key);
        const refs = taintedRefs(p.value, serverOnly
          ? { clientFields: CLIENT_FIELDS, tainted: strictTaint, sanitizers: SERVER_LOOKUPS }
          : { clientFields: CLIENT_FIELDS, tainted: anyTaint, sanitizers: [...SERVER_LOOKUPS, ...TEXT_SANITIZERS] });
        expect(refs, `line ${site.line}: ${key} reads an owner-writable value`).toEqual([]);
      }
    });

    it(`call #${i + 1}: the day, the incoming asset, the prices and the snapshot never read an owner-writable value; the slot only at the two dormant proposal sites`, () => {
      const site = CALLS[i];
      const strictTaint = taintedNames(site.fn, CLIENT_FIELDS, SERVER_LOOKUPS);
      const ctx = { clientFields: CLIENT_FIELDS, tainted: strictTaint, sanitizers: SERVER_LOOKUPS };
      for (const at of [5, 6, 7, 9]) {
        const arg = site.call.arguments[at];
        if (!arg || arg.type === 'SpreadElement') continue; // the meeting leg passes nine arguments (+ the P6 options)
        expect(taintedRefs(arg, ctx), `line ${site.line}: argument ${at + 1}`).toEqual([]);
      }
      const slotRefs = [3, 4].flatMap((at) => taintedRefs(site.call.arguments[at], ctx));
      const src = (n) => CRON_SOURCE.slice(n.start, n.end);
      if (slotRefs.length) {
        // The documented exception (header): exactly the dormant proposal sites, exactly these reads.
        expect(site.fn.id?.name, `line ${site.line}`).toBe('handlePendingProposal');
        expect([src(site.call.arguments[3]), src(site.call.arguments[4])]).toEqual(['proposal.tier', 'proposal.slotIndex']);
      }
    });
  }

  it('the guard bites: a planted read in a metadata value, a raw spread, a stray key and an id through clientText are each caught', () => {
    const fn = parse(`async function f(battle) {
      const proposal = battle.pendingProposal;
      for (const leg of proposal.legs) { const x = leg.rationale; }
      return executorMetadata({ id: clientText(proposal.id), rationale: clientText(proposal.why), lockedPoints: 1, entryPreset: battle.strategyPreset, ...(proposal.evaluationMetadata || {}) });
    }`, { ecmaVersion: 'latest' }).body[0];
    const anyTaint = taintedNames(fn, CLIENT_FIELDS, [...SERVER_LOOKUPS, ...TEXT_SANITIZERS]);
    expect([...anyTaint].sort()).toEqual(['leg', 'proposal', 'x']);
    const obj = fn.body.body[2].argument.arguments[0];
    const byKey = Object.fromEntries(obj.properties.filter((p) => p.type === 'Property').map((p) => [p.key.name, p.value]));
    expect(EXECUTOR_METADATA_KEYS).not.toContain('lockedPoints');
    expect(taintedRefs(byKey.entryPreset, { clientFields: CLIENT_FIELDS, tainted: anyTaint, sanitizers: TEXT_SANITIZERS })).toEqual(['battle.strategyPreset']);
    expect(taintedRefs(byKey.rationale, { clientFields: CLIENT_FIELDS, tainted: anyTaint, sanitizers: TEXT_SANITIZERS })).toEqual([]);
    const strict = taintedNames(fn, CLIENT_FIELDS, SERVER_LOOKUPS);
    expect(taintedRefs(byKey.id, { clientFields: CLIENT_FIELDS, tainted: strict, sanitizers: SERVER_LOOKUPS })).toEqual(['proposal']);
    const spread = obj.properties.find((p) => p.type === 'SpreadElement');
    expect(spread.argument.type).not.toBe('CallExpression'); // a raw spread is not one of METADATA_SPREADS
  });
});

// ───────────────────────────────────────────────────────── behavioural half

const N = 424242;              // a planted number
const ID = 'PLNTID';           // a planted id
const SYM = 'PLNTSYM';         // a planted symbol
const DESC = 'DESC';           // planted descriptive text — may ride, capped

/** Every owner-writable battle field, planted (shapes the tick can still read). */
function plantedBattle(overrides = {}) {
  return makeTickBattle({
    executionMode: N,
    strategyPreset: DESC.repeat(40),
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
  swappedOutAt: ID, evaluationId: ID, id: ID, entryConviction: N, source: ID, exitReason: ID, archetype: ID, hftKnobsSource: ID,
  swapProvenance: { dialBandVersion: N }, verification: { verificationId: ID, mode: 'shadow' }, snapshot: { n: N },
  rationale: DESC.repeat(600), hypothesis: DESC, trigger: DESC, entryRegime: DESC.repeat(40), swapMotive: DESC,
  trade_reasoning: { thesis: DESC, conviction: N, indicators: [DESC, N], id: ID },
});
const plantedProposal = (extra = {}) => ({
  proposalId: ID, evalId: ID, symbolOut: 'KO', symbolIn: 'AMD', tier: 'support', slotIndex: 0, mode: 'copilot',
  conviction: N, scoreAtProposal: N, createdAt: '2026-09-09T14:40:00.000Z', expiresAt: '2026-09-09T14:50:00.000Z',
  resolvedAt: '2026-09-09T14:45:00.000Z', resolution: 'approved', resolvedBy: ID,
  evaluationMetadata: plantedMetadata(), snapshot: { symbolOut: { rsi: N }, symbolIn: { rsi: N } }, ...extra,
});
const plantedLeg = (symbolOut, symbolIn) => ({ symbolOut, symbolIn, rationale: DESC.repeat(600), tier: N, slotIndex: N, id: ID, evaluationId: ID, lockedPoints: N, tradingDay: N });

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
  exec.calls = [];
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

const CALLERS = [
  { name: 'C1 risk loop', source: 'risk_manager', run: () => runTick({ battle: plantedBattle(), prices: bustingPrices() }) },
  { name: 'C2 model route', source: 'haiku', run: () => runTick({ battle: plantedBattle(), result: makeSwapResult() }) },
  { name: 'C3 approved proposal (dormant, mode mocked copilot)', source: 'haiku', dormant: true, run: () => runTick({ battle: plantedBattle({ pendingProposal: plantedProposal() }) }) },
  { name: 'C4 expired co-pilot proposal (dormant, mode mocked copilot)', source: 'haiku', dormant: true, run: () => runTick({ battle: plantedBattle({ pendingProposal: plantedProposal({ resolvedAt: null, resolution: null }) }) }) },
  {
    name: 'C5 suppression pass', source: 'guardrail',
    run: () => {
      guardrailHook.result = { decision: 'SWAP', symbolOut: 'KO', symbolIn: 'AMD', sourceNote: 'guardrail_stopLoss', statusMessage: 'Stop hit on KO.', overrides: [] };
      return runTick({ battle: plantedBattle({
        gameplanMeeting: { id: ID, status: 'pending', diagnosis: DESC, expiresAt: '2026-09-09T23:00:00.000Z', suggestedSwaps: [plantedLeg('KO', 'AMD')] },
        agentContext: { ...makeTickBattle().agentContext, deployedGuardrails: [{ type: 'stopLoss', value: 1, unit: '%', enforcement: 'hard' }] },
      }) });
    },
  },
  { name: 'C6 approved meeting', source: 'gameplan_meeting', run: () => runTick({ battle: plantedBattle({ gameplanMeeting: { id: ID, status: 'approved', diagnosis: DESC, expiresAt: '2026-09-09T20:00:00.000Z', suggestedSwaps: [plantedLeg('KO', 'AMD')] } }) }) },
];

describe('BEHAVIOURAL — every owner-writable field planted; the six callers through processAgentBattle', () => {
  for (const caller of CALLERS) {
    it(`${caller.name}: no planted number, id or symbol reaches the executor or the trade row; keys allowlisted; text capped`, async () => {
      if (caller.dormant) authority.mode = 'copilot';
      const { stored } = await caller.run();
      const calls = exec.calls.filter((args) => args[5]?.source === caller.source);
      expect(calls.length, `${caller.name} made no executor call (vacuous)`).toBeGreaterThan(0);
      for (const args of calls) {
        // args = [tier, slotIndex, benchAsset, currentDay, prices, metadata, snapshot, opts?]
        const [, , benchAsset, day, prices, meta, snapshot] = args;
        for (const key of Object.keys(meta)) expect(EXECUTOR_METADATA_KEYS, `${caller.name}: key ${key}`).toContain(key);
        expect(plantedIn({ benchAsset, day, prices, meta, snapshot }), caller.name).toEqual([]);
        expect(day).toBe(1);
        expect(overlong(meta), caller.name).toEqual([]);
      }
      expect(stored.trades.length).toBeGreaterThan(0);
      for (const row of stored.trades) {
        for (const key of Object.keys(row)) expect([...EXECUTOR_COMPUTED_KEYS, ...EXECUTOR_METADATA_KEYS], `${caller.name}: row key ${key}`).toContain(key);
        expect(plantedIn(row), caller.name).toEqual([]);
        expect(overlong(row), caller.name).toEqual([]);
      }
    });
  }

  it('at the launch mode the planted proposal never reaches the executor at all (F1)', async () => {
    await runTick({ battle: plantedBattle({ pendingProposal: plantedProposal() }) });
    expect(exec.calls).toEqual([]);
  });
});
