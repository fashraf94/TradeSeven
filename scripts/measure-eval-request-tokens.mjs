#!/usr/bin/env node
// scripts/measure-eval-request-tokens.mjs
//
// THE REAL input-token cost of the largest mid-battle evaluation request,
// measured with Anthropic's `messages.countTokens` against the evaluator's own
// model id — once with the Cockpit Build 0 `declarations` property off, once
// with it on.
//
// WHY. Every input-size figure the Cockpit build states is a chars/4 ESTIMATE,
// and the spec amendment says so in as many words:
//
//   "additional input schema at shadow/on: +4,627 serialized chars (≈ 1,157
//    tokens at chars/4); maximal fixture input: 10,250 tokens at chars/4
//    against the 12,000 budget — a fixture estimate, not a measurement; real
//    token counts and shadow truncation observations remain pending; input
//    size says nothing about output headroom"
//   — docs/design/COCKPIT_SPEC_V1_3_AMENDMENT_A.md:15
//
// This script closes the "real token counts" half of that pending item. It
// changes no source, sends no `messages.create`, and writes no files.
// `count_tokens` is a separate endpoint: it runs no inference.
//
// WHAT IT ASSEMBLES. The request the production call actually sends
// (api/cron/agent-evaluate.js:2767-2782):
//
//     model       EVAL_MODEL_ID                     (agentEvalTransport.js:48)
//     max_tokens  EVAL_MAX_OUTPUT_TOKENS            (agentEvalTransport.js:59)
//     system      buildEvalSystemPrompt(...)
//     messages    [user identity, assistant ack, user live context]
//     tools       [buildTradeDecisionTool({ declarations })]
//     tool_choice { type: 'tool', name: 'submit_trade_decision' }
//
// loaded with the M7-E2E maximal fixture of
// api/_utils/composition.m7e2eBudget.test.js — the same worst-case battle,
// rules, compat entries, momentum map, movers and stories that suite feeds.
//
// `temperature` is omitted: count_tokens does not take it, and it costs no
// tokens. `tool_choice` IS included — it is part of the real request, and the
// fixture's chars/4 estimate never covered it, so a small part of the gap
// between estimate and measurement is coverage the estimate was missing.
//
// FIXTURE FIDELITY. The builders in section 3 are a VERBATIM copy of
// composition.m7e2eBudget.test.js lines 34-154. The copy cannot drift
// silently: step 0 hashes that region of the suite and refuses to run on a
// mismatch. The suite's two `vi.mock` calls are reproduced as ESM loader stubs
// with the same values; `vi` does not exist outside vitest.
//
// RUN (PowerShell):
//     $env:ANTHROPIC_API_KEY="sk-ant-..."; node scripts/measure-eval-request-tokens.mjs
//
// Without a key it prints every local number — char counts, the chars/4
// estimate, the fixture output blocks — states that no measurement was taken,
// prints the command above, and exits 0. It never invents a token count.

import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const fail = (msg) => { console.error(`\n  FAILED: ${msg}\n`); process.exit(1); };
const assert = (cond, msg) => { if (!cond) fail(msg); };
const n = (v) => Number(v).toLocaleString('en-US');

// ═══ 0. Fixture-drift tripwire ══════════════════════════════════════════════
// The builders in section 3 are copied from the suite. If the suite's fixture
// moves, this script must be re-synced before its numbers mean anything — so
// it refuses to run rather than measure a stale worst case.

const FIXTURE_FILE = resolve(REPO, 'api/_utils/composition.m7e2eBudget.test.js');
const REGION_START = 'const flagState = {';
const REGION_END = 'function assembleDraftRequest';
const REGION_SHA256 = 'e70410e9750ea85cabbb7c340a5042cf73d6b7f28e03e35ff49d24e5a15e8443';

const fixtureSrc = readFileSync(FIXTURE_FILE, 'utf8').replace(/\r\n/g, '\n');
const regionStart = fixtureSrc.indexOf(REGION_START);
const regionEnd = fixtureSrc.indexOf(REGION_END);
assert(regionStart >= 0 && regionEnd > regionStart,
  `could not locate the fixture region in ${FIXTURE_FILE}`);
const regionSha = createHash('sha256')
  .update(fixtureSrc.slice(regionStart, regionEnd), 'utf8').digest('hex');
if (regionSha !== REGION_SHA256) {
  fail(
    'the M7-E2E fixture has changed since this script was written.\n' +
    `    expected sha256 ${REGION_SHA256}\n` +
    `    actual   sha256 ${regionSha}\n` +
    '    Re-sync the builders in section 3 from composition.m7e2eBudget.test.js\n' +
    '    (the region from "const flagState = {" to "function assembleDraftRequest"),\n' +
    '    then update REGION_SHA256. Do not measure a stale fixture.',
  );
}

// ═══ 1. The suite's two vi.mock calls, as ESM loader stubs ══════════════════
// composition.m7e2eBudget.test.js:35-41. Same values; `vi` is unavailable
// outside vitest, so the substitution is made through a load hook instead.
//
// Live-config parity, stated rather than assumed: three of the four
// composition flags already hold the mocked value at HEAD. Only
// COMPOSITION_EPOCH_FENCE_ENABLED differs (live true, mocked false), and no
// module in the eval prompt-assembly graph reads it — its three readers are
// compositionGenerationFence.js, compositionProvisionerLease.js and
// compositionWriteEpoch.js, all write-path.

const COMPOSITION_CONFIG_STUB = [
  "export const COMPOSITION_ENFORCEMENT_MODE = 'off';",
  'export const COMPOSITION_EPOCH_FENCE_ENABLED = false;',
  'export const COMPOSITION_MIGRATION_FEED_ENABLED = false;',
  'export const COMPOSITION_COMPILED_IDENTITY_ENABLED = true;',
].join('\n');

// The suite mocks getFirebaseAdmin to `() => ({})`. The eval path DOES reach
// it — maxRules() carries institutional rules, so fetchInstitutionalContext
// runs (agentEvalPromptAssembly.js:891-896) — and the empty object makes
// `db.collection` throw inside that function's own try/catch, which returns
// null. That is exactly how the fixture ends up with no institutional block,
// as the suite header states. getFirebaseAuth is stubbed too: nothing in this
// graph imports it, and an unused export cannot move a token count.
const FIREBASE_ADMIN_STUB = [
  'export function getFirebaseAdmin() { return {}; }',
  'export function getFirebaseAuth() { return {}; }',
].join('\n');

const STUBS = [
  ['/api/_utils/compositionConfig.js', COMPOSITION_CONFIG_STUB],
  ['/api/_utils/firebaseAdmin.js', FIREBASE_ADMIN_STUB],
];

register('data:text/javascript,' + encodeURIComponent(`
const STUBS = ${JSON.stringify(STUBS)};
export async function load(url, context, nextLoad) {
  for (const [suffix, source] of STUBS) {
    if (url.endsWith(suffix)) return { format: 'module', shortCircuit: true, source };
  }
  return nextLoad(url, context);
}
`));

// ═══ 2. The production modules, imported behind the stubs ═══════════════════

const { buildEvalSystemPrompt, buildAgentIdentityBlock, buildLiveContextBlock } =
  await import('../api/_utils/agentEvalPromptAssembly.js');
const { TRADE_DECISION_TOOL, buildTradeDecisionTool } =
  await import('../api/_utils/agentEvalToolSchema.js');
const { EVAL_MODEL_ID, EVAL_MAX_OUTPUT_TOKENS } =
  await import('../api/_utils/agentEvalTransport.js');
const { makeSwapResult, makeDeclarations, makeMaximalDeclarations } =
  await import('../api/_utils/__fixtures__/tickStampsHarness.js');

// ═══ 3. The M7-E2E maximal fixture — VERBATIM from the suite ════════════════
// composition.m7e2eBudget.test.js:34-154, guarded by the step-0 hash. One
// adaptation: `flagState` is no longer read through a vi.mock getter, so the
// stub above pins COMPOSITION_COMPILED_IDENTITY_ENABLED to true and section 4
// asserts the fixture asked for the lit path.

const flagState = { compiledIdentity: true };

const estimateTokens = (s) => Math.ceil(String(s).length / 4);

// Both production models (claude-haiku-4-5 mid-battle, claude-sonnet-4-6
// draft) carry a 200k context window.
const MODEL_CONTEXT_TOKENS = 200_000;
const STATED_HEADROOM_TOKENS = 150_000;
const EVAL_FULL_REQUEST_INPUT_BUDGET = 12_000;

const ADVISORY = 'the agent is instructed that the cap limits how much a leading sector may hold, not whether leading sectors are preferred.';
const RULE_TEXT = 'Cap any single sector at 60% of portfolio with additional confirmation requirements on every swap decision';

const SYMBOLS = ['NVDA', 'TSLA', 'AMD', 'PLTR', 'JPM', 'KO'];
const BENCH = ['MSFT', 'AVGO', 'XOM'];

const maxRules = () => Array.from({ length: 14 }, (_, i) => ({
  ruleId: `rd${i}`, text: RULE_TEXT,
  category: i % 2 ? 'allocation' : 'institutional',
  hardness: i % 2 ? 'hard' : 'soft',
}));
const maxCompat = () => ({
  entries: Array.from({ length: 14 }, (_, i) => ({
    ruleId: `rd${i}`, verdict: 'tension', advisory: ADVISORY, narrowedParams: { pct: { min: 40, max: 80 } },
  })),
});

function maximalEvalBattle() {
  const tier = (syms) => syms.map((symbol) => ({ symbol, name: `${symbol} Corp`, baseATR: 2.7 }));
  return {
    id: 'battle-m7e2e', gameMode: 'clash', createdAt: '2026-08-03T13:30:00.000Z',
    timing: { tradingDays: ['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07'], localOpen: '09:30', localClose: '16:00' },
    scoreState: { currentScore: 142.5, activeScore: 96.2, bankedScore: 40.1, bankedBadgePoints: { total: 6.2 }, tradeCount: 11, evaluationCount: 23 },
    portfolio: {
      star: tier(SYMBOLS.slice(0, 2)), core: tier(SYMBOLS.slice(2, 4)),
      support: [...tier(SYMBOLS.slice(4, 6)), { symbol: 'BTC', isCrypto: true, name: 'Bitcoin' }],
      bench: { stocks: tier(BENCH), crypto: { symbol: 'ETH', isCrypto: true, name: 'Ethereum' } },
      startingPrices: Object.fromEntries([...SYMBOLS, ...BENCH].map((s) => [s, 100])),
    },
    trades: Array.from({ length: 6 }, (_, i) => ({
      symbol: SYMBOLS[i % SYMBOLS.length], action: 'swap_out', executedAt: '2026-08-05T15:00:00.000Z',
      priceAtExecution: 104.2 + i, replacedBy: BENCH[i % BENCH.length], scoreImpact: 3.1,
    })),
    evaluations: Array.from({ length: 5 }, (_, i) => ({
      decision: 'hold', rationale: `Evaluation ${i}: momentum intact across held leaders; no swap clears the hurdle after costs.`,
      timestamp: `2026-08-06T1${i}:00:00.000Z`,
    })),
    agentContext: {
      agentName: 'Fixture Agent', name: 'Fixture Agent', archetype: 'momentum_chaser',
      activeRules: maxRules(),
      memory: Array.from({ length: 10 }, (_, i) => `Learned lesson ${i}: volume expansion precedes breakouts in leading sectors most of the time.`),
      consolidatedInsight: 'x'.repeat(1200),
      standingLeans: [{ adjustmentId: 'CP-04', version: 1, text: 'Widen the stop slightly (more patience on good positions)' }],
    },
    resolvedAgentManifest: { compositionCompat: maxCompat() },
    scoring: { thresholds: {} },
  };
}

const maximalMomentum = () => ({
  vwap: {},
  riskStatus: null,
  rankingsMap: Object.fromEntries([...SYMBOLS, ...BENCH].map((s) => [s, {
    symbol: s, sectorName: 'Technology', industryName: 'Semiconductors & Semiconductor Equipment',
    fundamentals: {
      trailingPE: { value: 42.1, sectorMedian: 28 }, priceBookMRQ: 8.3, revenueGrowthPct: 11.6,
      marketCapClass: 'large', earningsRevisions30d: 2.1, beatRate: 75, surpriseMagPercentile: 82,
      computedAt: Date.parse('2026-08-07T11:01:00Z'),
    },
  }])),
  techScoresMap: Object.fromEntries([...SYMBOLS, ...BENCH].map((s) => [s, { rsi: 61.4, sma20Rel: 1.4, macdSignal: 'bullish' }])),
});

const maximalArgs = (battle) => [
  battle,
  Object.fromEntries([...SYMBOLS, ...BENCH, 'BTC', 'ETH'].map((s) => [s, { price: 123.45, changePct: 2.34 }])),
  { SPY: 0.42, QQQ: 0.77, BTC: -1.2 },
  SYMBOLS.map((symbol) => ({ symbol, badges: [], priceChange: 1.2, multiplier: 0.4, baseATR: 3.0 })),
  Array.from({ length: 5 }, (_, i) => ({ type: 'price_move', detail: `${SYMBOLS[i % SYMBOLS.length]} moved 2.4% in 30m against the sector` })),
  Array.from({ length: 8 }, (_, i) => ({
    headline: `Story ${i}: Semis extend gains as hyperscaler capex guides higher across the board`,
    tickers: [SYMBOLS[i % SYMBOLS.length]], summary: 'Capex commentary points to sustained accelerator demand into year end.',
    publishedAt: '2026-08-07T12:00:00.000Z',
  })),
  undefined, // recentEvals — the production call passes battle.evaluations; the builder reads battle.evaluations directly
  maximalMomentum(),
  { label: 'Aggressive Momentum', promptGuidance: 'Prioritize continuation setups; cut laggards fast; respect the sector cap advisories.' },
];

async function assembleEvalRequest() {
  flagState.compiledIdentity = true;
  const battle = maximalEvalBattle();
  const system = buildEvalSystemPrompt('Fixture Agent', 'Momentum Chaser', 'clash', 'momentum_chaser');
  const identity = buildAgentIdentityBlock(battle);
  const ack = 'I understand my identity and strategic context. Show me the live battle state.';
  const live = await buildLiveContextBlock(...maximalArgs(battle));
  const tools = JSON.stringify([TRADE_DECISION_TOOL]);
  return { system, identity, ack, live, tools, battle };
}

// ═══ 4. Assemble, and prove the fixture is not hollow ═══════════════════════
// The same guards the suite runs (composition.m7e2eBudget.test.js:183-190,
// :210). A measurement of a fixture that quietly stopped rendering its blocks
// is worse than no measurement, so these run BEFORE any request is made.

const { system, identity, ack, live, tools } = await assembleEvalRequest();

assert(flagState.compiledIdentity === true,
  'the fixture did not request the compiled-identity lit path');
assert(identity.split('— Advisory:').length - 1 === 14,
  `identity block carries ${identity.split('— Advisory:').length - 1} advisories, expected 14`);
for (const marker of [
  '━━━ LIVE BATTLE STATE ━━━', 'ACTIVE POSITIONS:', 'BENCH',
  'TRIGGER (why you were woken up):', 'FUNDAMENTALS (', 'STRATEGY PRESET: Aggressive Momentum',
]) assert(live.includes(marker), `live context is missing the marker ${JSON.stringify(marker)}`);
assert(live.length > 2000, `live context is only ${live.length} chars — the fixture went hollow`);
assert(live.split('Advisory:').length - 1 === 0,
  'advisory bytes leaked into the live-context message (double-append)');

const TOOL_OFF = buildTradeDecisionTool({ declarations: false });
const TOOL_ON = buildTradeDecisionTool({ declarations: true });
assert(TOOL_OFF === TRADE_DECISION_TOOL,
  'buildTradeDecisionTool({declarations:false}) is no longer the TRADE_DECISION_TOOL constant');
const toolsOff = tools;                     // the suite's own serialization (:152)
const toolsOn = JSON.stringify([TOOL_ON]);  // the suite's shadow row (:202)

const messages = [
  { role: 'user', content: identity },
  { role: 'assistant', content: ack },
  { role: 'user', content: live },
];
const toolChoice = { type: 'tool', name: 'submit_trade_decision' };

const estimateOff = [system, identity, ack, live, toolsOff].reduce((t, s) => t + estimateTokens(s), 0);
const estimateOn = [system, identity, ack, live, toolsOn].reduce((t, s) => t + estimateTokens(s), 0);

// ═══ 5. The output side — the largest output the fixtures produce at shadow ═
// Input size says nothing about output headroom, so this is measured
// separately. `declarations` is the LAST schema property, so a response that
// hits the 2,048-token ceiling cuts it before any earlier field
// (agentEvalToolSchema.declarations.test.js:239-243). OBSERVED_* is the DR-13
// production truncation baseline quoted at agentEvalTransport.js:50-58 — it is
// NOT measured here, and it predates `declarations`.

const OBSERVED_MEAN = 907;
const OBSERVED_P99 = 1240;
const OBSERVED_MAX = 1421;

const maximalDeclarations = JSON.stringify(makeMaximalDeclarations());
const typicalDeclarations = JSON.stringify(makeDeclarations());
const maximalToolInput = JSON.stringify({ ...makeSwapResult(), declarations: makeMaximalDeclarations() });

// ═══ 6. Report ══════════════════════════════════════════════════════════════

const sect = (t) => { console.log(''); console.log(`── ${t} ${'─'.repeat(Math.max(2, 74 - t.length))}`); };
const row = (cells, widths) =>
  console.log('  ' + cells.map((c, i) => (i === 0 ? String(c).padEnd(widths[i]) : String(c).padStart(widths[i]))).join('  '));

function printOutputSection(measured) {
  sect('OUTPUT SIDE — the largest output the fixtures produce at shadow');
  console.log('  Input size says nothing about output headroom, so this is the separate');
  console.log('  number. The blocks come from api/_utils/__fixtures__/tickStampsHarness.js.');
  console.log(`  \`declarations\` is the LAST schema property, so a response that hits the`);
  console.log(`  ${n(EVAL_MAX_OUTPUT_TOKENS)}-token ceiling cuts it before any earlier field.`);
  console.log('');
  const O = [40, 10, 10, 10];
  row(['fixture output block', 'chars', 'chars/4', measured ? 'REAL' : 'chars/3'], O);
  row(['maximal declarations (§3.2 caps)', n(maximalDeclarations.length), n(estimateTokens(maximalDeclarations)),
    measured ? n(measured.declMax) : n(Math.ceil(maximalDeclarations.length / 3))], O);
  row(['typical declarations (2 shots, 1 watch)', n(typicalDeclarations.length), n(estimateTokens(typicalDeclarations)),
    measured ? n(measured.declTypical) : n(Math.ceil(typicalDeclarations.length / 3))], O);
  row(['LARGEST: swap result + maximal block', n(maximalToolInput.length), n(estimateTokens(maximalToolInput)),
    measured ? n(measured.outMax) : n(Math.ceil(maximalToolInput.length / 3))], O);
  console.log('');
  console.log(`  Truncation headroom against the ${n(EVAL_MAX_OUTPUT_TOKENS)}-token ceiling, crossed with the`);
  console.log('  DR-13 production baseline (agentEvalTransport.js:50-58 — observed BEFORE');
  console.log(`  declarations existed: mean ${n(OBSERVED_MEAN)}, p99 ${n(OBSERVED_P99)}, max ${n(OBSERVED_MAX)}):`);
  console.log('');
  const blockMax = measured ? measured.declMax : estimateTokens(maximalDeclarations);
  const blockTypical = measured ? measured.declTypical : estimateTokens(typicalDeclarations);
  const H = [44, 12, 12];
  row([`response + block  (${measured ? 'REAL tokens' : 'chars/4 estimate'})`, 'headroom', 'verdict'], H);
  for (const [olabel, ov] of [['mean', OBSERVED_MEAN], ['p99', OBSERVED_P99], ['max', OBSERVED_MAX]]) {
    for (const [blabel, bv] of [['typical block', blockTypical], ['maximal block', blockMax]]) {
      const left = EVAL_MAX_OUTPUT_TOKENS - ov - bv;
      row([`${olabel} response + ${blabel}`, n(left), left >= 0 ? 'fits' : 'TRUNCATES'], H);
    }
  }
  console.log('');
  console.log('  A negative row is stated, not hidden: shadow reports each such tick as a');
  console.log("  truncation event (stop_reason === 'max_tokens'). These are fixture upper");
  console.log('  bounds crossed with a pre-declarations production distribution — the real');
  console.log('  shadow truncation RATE still has to come from shadow observation.');
}

console.log('');
console.log('═'.repeat(78));
console.log('  EVAL REQUEST — REAL INPUT TOKEN COUNT (declarations off vs on)');
console.log('═'.repeat(78));
console.log(`  model         ${EVAL_MODEL_ID}        api/_utils/agentEvalTransport.js:48`);
console.log(`  input budget  ${n(EVAL_FULL_REQUEST_INPUT_BUDGET)} tokens`.padEnd(32) + '     api/_utils/composition.m7e2eBudget.test.js:62');
console.log(`  output cap    ${n(EVAL_MAX_OUTPUT_TOKENS)} tokens`.padEnd(32) + '     api/_utils/agentEvalTransport.js:59');
console.log(`  ledger cap    ${n(MODEL_CONTEXT_TOKENS - STATED_HEADROOM_TOKENS)} tokens`.padEnd(32) + '     input + output ceiling must fit under this');
console.log(`  request       api/cron/agent-evaluate.js:2767-2782`);
console.log(`  fixture       api/_utils/composition.m7e2eBudget.test.js:34-154  (sha256 ${REGION_SHA256.slice(0, 12)}… verified)`);
console.log('');
console.log('  The "[AgentEval] Failed to fetch institutional context" warning printed');
console.log("  above is EXPECTED: it is the suite's own firebaseAdmin mock refusing a");
console.log('  Firestore read (section 1), and it is how the fixture gets its stated');
console.log('  scope. The vitest suite prints the same line.');

sect('ASSEMBLED BYTES (local, no API)');
const W = [38, 12, 12];
row(['component', 'chars', 'chars/4'], W);
row(['system  buildEvalSystemPrompt', n(system.length), n(estimateTokens(system))], W);
row(['user    identity block', n(identity.length), n(estimateTokens(identity))], W);
row(['asst    ack', n(ack.length), n(estimateTokens(ack))], W);
row(['user    live context', n(live.length), n(estimateTokens(live))], W);
row(['tools   declarations OFF', n(toolsOff.length), n(estimateTokens(toolsOff))], W);
row(['tools   declarations ON', n(toolsOn.length), n(estimateTokens(toolsOn))], W);
console.log('');
row(['TOTAL   declarations OFF', n([system, identity, ack, live, toolsOff].reduce((t, s) => t + s.length, 0)), n(estimateOff)], W);
row(['TOTAL   declarations ON', n([system, identity, ack, live, toolsOn].reduce((t, s) => t + s.length, 0)), n(estimateOn)], W);
row(['delta   the declarations cost', `+${n(toolsOn.length - toolsOff.length)}`, `+${n(estimateOn - estimateOff)}`], W);
console.log('');
console.log("  chars/4 is the repo's estimate convention, NOT a measurement");
console.log('  (composition.m7e2eBudget.test.js:21-23). It does not cover tool_choice.');

const apiKey = process.env.ANTHROPIC_API_KEY;

if (!apiKey) {
  sect('MEASUREMENT — NOT RUN');
  console.log('  ANTHROPIC_API_KEY is not set in this environment, so no token count was');
  console.log('  taken. Everything above is an estimate; this script will not print a');
  console.log('  measurement it did not make.');
  console.log('');
  console.log('  To measure, in a PowerShell window:');
  console.log('');
  console.log('      $env:ANTHROPIC_API_KEY="sk-ant-..."; node scripts/measure-eval-request-tokens.mjs');
  console.log('');
  console.log('  count_tokens runs no inference and is not billed as a model call.');
  printOutputSection(null);
  console.log('');
  process.exit(0);
}

const { default: Anthropic } = await import('@anthropic-ai/sdk');
const client = new Anthropic();

const countRequest = async (tool) => (await client.messages.countTokens({
  model: EVAL_MODEL_ID, system, messages, tools: [tool], tool_choice: toolChoice,
})).input_tokens;

// The output-side blocks are measured as a TEXT DELTA against a fixed
// one-character probe: message framing is held constant, so the difference is
// the serialized block's own cost under the same tokenizer.
const PROBE = 'x';
const countText = async (text) => (await client.messages.countTokens({
  model: EVAL_MODEL_ID, messages: [{ role: 'user', content: text }],
})).input_tokens;

let off, on, probeBase, declMax, declTypical, outMax;
try {
  off = await countRequest(TOOL_OFF);
  on = await countRequest(TOOL_ON);
  probeBase = await countText(PROBE);
  declMax = (await countText(PROBE + maximalDeclarations)) - probeBase;
  declTypical = (await countText(PROBE + typicalDeclarations)) - probeBase;
  outMax = (await countText(PROBE + maximalToolInput)) - probeBase;
} catch (err) {
  if (err instanceof Anthropic.AuthenticationError) fail(`the API key was rejected: ${err.message}`);
  if (err instanceof Anthropic.RateLimitError) fail(`rate limited — retry shortly: ${err.message}`);
  if (err instanceof Anthropic.APIError) fail(`API error ${err.status}: ${err.message}`);
  fail(`${err?.constructor?.name || 'Error'}: ${err?.message || err}`);
}

const signed = (v) => `${v >= 0 ? '+' : ''}${n(v)}`;

sect('MEASUREMENT — messages.countTokens');
const V = [38, 12, 12, 12];
row(['variant', 'REAL', 'chars/4', 'est. error'], V);
row(['declarations OFF', n(off), n(estimateOff), signed(off - estimateOff)], V);
row(['declarations ON', n(on), n(estimateOn), signed(on - estimateOn)], V);
row(['DIFFERENCE — the declarations cost', signed(on - off), signed(estimateOn - estimateOff),
  signed((on - off) - (estimateOn - estimateOff))], V);

sect(`MARGIN against the ${n(EVAL_FULL_REQUEST_INPUT_BUDGET)}-token input budget`);
const M = [38, 12, 12, 12];
row(['variant', 'REAL', 'margin', 'budget used'], M);
for (const [label, v] of [['declarations OFF', off], ['declarations ON', on]]) {
  row([label, n(v), n(EVAL_FULL_REQUEST_INPUT_BUDGET - v),
    `${((v / EVAL_FULL_REQUEST_INPUT_BUDGET) * 100).toFixed(1)}%`], M);
}
console.log('');
const ledgerCap = MODEL_CONTEXT_TOKENS - STATED_HEADROOM_TOKENS;
const VARIANTS = [['declarations OFF', off], ['declarations ON ', on]];
for (const [label, v] of VARIANTS) {
  console.log(`  budget-of-record, ${label}: ${String(n(v)).padStart(6)} < ${n(EVAL_FULL_REQUEST_INPUT_BUDGET)}  →  ${v < EVAL_FULL_REQUEST_INPUT_BUDGET ? 'PASS' : 'FAIL'}`);
}
for (const [label, v] of VARIANTS) {
  const total = v + EVAL_MAX_OUTPUT_TOKENS;
  console.log(`  ledger form,      ${label}: ${String(n(v)).padStart(6)} in + ${n(EVAL_MAX_OUTPUT_TOKENS)} out = ${String(n(total)).padStart(6)} < ${n(ledgerCap)}  →  ${total < ledgerCap ? 'PASS' : 'FAIL'}  (headroom ${n(ledgerCap - total)})`);
}

printOutputSection({ declMax, declTypical, outMax });
console.log('');
