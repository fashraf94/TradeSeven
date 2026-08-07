// api/_utils/composition.m7e2eBudget.test.js
//
// Composition PR 4 — M7-E2E (ledger row, extends M7): the WORST-CASE
// FULL-REQUEST budget, per assembler. M7 (composition.m7Budget.test.js)
// measured the eval system+identity surface; its recorded scope boundary was
// the third message (live context) + the tool schema. This suite closes that
// gap: each fixture assembles the COMPLETE request the production call sends —
// every message, the serialized tool schema, all framing — at maximal-
// realistic load, and asserts the whole request (input estimate + the output
// ceiling) fits the model context with an EXPLICIT stated headroom, plus a
// tight named budget-of-record that catches runaway growth (a duplicated
// block, an advisory double-append at scale) long before any real limit.
//
//   EVAL request (agent-evaluate.js:1956): claude-haiku-4-5 —
//     system buildEvalSystemPrompt + messages [identity block, assistant ack,
//     live context] + TRADE_DECISION_TOOL, max_tokens EVAL_MAX_OUTPUT_TOKENS.
//   DRAFT request (decide.js:386): claude-sonnet-4-6 —
//     system buildStrategySystemPrompt(marketCSV 130 rows, stories) +
//     message buildStrategyUserPrompt + STRATEGY_TOOL, max_tokens 1500.
//
// TOKENIZER: the repo's measurement convention — chars/4 estimate,
// conservative for natural English (real BPE counts run LOWER; the M7
// disclosure). Tool schemas measured as their JSON serialization.
//
// SCOPE, stated honestly: shape-gated optional blocks that need live
// Firestore or undocumented input shapes (institutional intelligence, regime
// context, vision state, risk status) are NOT in the fixture — each is a
// bounded block (≲300 tokens); the stated headroom covers them two orders of
// magnitude over. Every block the fixture DOES feed is asserted present, so
// the measurement cannot silently go hollow.

import { describe, it, expect, vi } from 'vitest';

const flagState = { compiledIdentity: true };
vi.mock('./compositionConfig.js', () => ({
  get COMPOSITION_ENFORCEMENT_MODE() { return 'off'; },
  get COMPOSITION_EPOCH_FENCE_ENABLED() { return false; },
  get COMPOSITION_MIGRATION_FEED_ENABLED() { return false; },
  get COMPOSITION_COMPILED_IDENTITY_ENABLED() { return flagState.compiledIdentity; },
}));
vi.mock('./firebaseAdmin.js', () => ({ getFirebaseAdmin: () => ({}) }));

const { buildEvalSystemPrompt, buildAgentIdentityBlock, buildLiveContextBlock } = await import('./agentEvalPromptAssembly.js');
const { buildStrategySystemPrompt, buildStrategyUserPrompt, formatMarketCSV } = await import('./agentPromptAssembly.js');
const { TRADE_DECISION_TOOL } = await import('./agentEvalToolSchema.js');
const { STRATEGY_TOOL } = await import('./agentToolSchema.js');
const { EVAL_MAX_OUTPUT_TOKENS } = await import('./agentEvalTransport.js');

const estimateTokens = (s) => Math.ceil(String(s).length / 4);

// Both production models (claude-haiku-4-5 mid-battle, claude-sonnet-4-6
// draft) carry a 200k context window.
export const MODEL_CONTEXT_TOKENS = 200_000;
// The EXPLICIT headroom of record (ledger M7-E2E): the full request must fit
// inside contextLimit − headroom. 150k headroom ⇒ the request may never
// exceed 50k tokens — an order of magnitude above the measured worst case,
// an order of magnitude below the model limit.
export const STATED_HEADROOM_TOKENS = 150_000;
// Tight budgets-of-record, the runaway catch (M7 convention: measured worst
// case + real growth headroom, far under the ceiling above). Measured at
// authoring (chars/4 estimate): eval 8,576 — draft 3,526.
export const EVAL_FULL_REQUEST_INPUT_BUDGET = 12_000;
export const DRAFT_FULL_REQUEST_INPUT_BUDGET = 6_000;
export const DRAFT_MAX_OUTPUT_TOKENS = 1_500; // decide.js:388 max_tokens

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

function assembleDraftRequest({ lit = true } = {}) {
  flagState.compiledIdentity = lit;
  const stocks = Array.from({ length: 130 }, (_, i) => ({
    symbol: `SYM${String(i).padStart(3, '0')}`, sector: 'Technology', fundamentalScore: 71, technicalScore: 64,
    baggerBombFitScore: 58, atrPct: 4.2, archetypeScore: 66,
  }));
  const agent = {
    name: 'Fixture Agent', archetype: 'momentum_chaser', config: {},
    activeRules: maxRules(), compositionCompat: maxCompat(),
    memory: Array.from({ length: 10 }, (_, i) => `Learned lesson ${i}: strength begets strength until breadth narrows.`),
    consolidatedInsight: 'y'.repeat(1200),
  };
  const stories = Array.from({ length: 5 }, (_, i) =>
    `[${i}] Semis extend gains as hyperscaler capex guides higher; breadth narrows to leaders while laggards bleed.`).join('\n');
  const system = buildStrategySystemPrompt(formatMarketCSV(stocks), stories, 'momentum_chaser');
  const user = buildStrategyUserPrompt(agent, {
    name: 'AI Infrastructure', tickers: Array.from({ length: 12 }, (_, i) => `SYM${String(i).padStart(3, '0')}`),
    thesis: 'Accelerator demand compounds through the datacenter build-out; power and networking ride the same capex wave. '.repeat(3),
  });
  const tools = JSON.stringify([STRATEGY_TOOL]);
  return { system, user, tools };
}

describe('M7-E2E — eval assembler: the COMPLETE mid-battle request at maximal load', () => {
  it('fits the model context with the stated headroom AND the tight budget-of-record; the fixture is genuinely maximal', async () => {
    const { system, identity, ack, live, tools } = await assembleEvalRequest();
    // The fixture cannot silently go hollow: every fed block must render.
    expect(identity.split('— Advisory:').length - 1).toBe(14);
    expect(live).toContain('━━━ LIVE BATTLE STATE ━━━');
    expect(live).toContain('ACTIVE POSITIONS:');
    expect(live).toContain('BENCH');
    expect(live).toContain('TRIGGER (why you were woken up):');
    expect(live).toContain('FUNDAMENTALS (');
    expect(live).toContain('STRATEGY PRESET: Aggressive Momentum');
    expect(live.length).toBeGreaterThan(2000);

    const input = [system, identity, ack, live, tools].reduce((n, s) => n + estimateTokens(s), 0);
    // Ledger form: input + output ceiling < contextLimit − statedHeadroom.
    expect(input + EVAL_MAX_OUTPUT_TOKENS).toBeLessThan(MODEL_CONTEXT_TOKENS - STATED_HEADROOM_TOKENS);
    // Runaway catch: the tight named budget (duplicated block / double-append
    // at scale fails HERE, with margin to spare below the ceiling above).
    expect(input).toBeLessThan(EVAL_FULL_REQUEST_INPUT_BUDGET);
  });

  it('advisories ride the IDENTITY message only — zero advisory bytes in the live-context message (double-append guard)', async () => {
    const { live } = await assembleEvalRequest();
    expect(live.split('Advisory:').length - 1).toBe(0);
  });

  it('the full-request advisory delta is EXACTLY once per tension rule (lit vs dark, whole request)', async () => {
    flagState.compiledIdentity = true;
    const lit = buildAgentIdentityBlock(maximalEvalBattle());
    flagState.compiledIdentity = false;
    const dark = buildAgentIdentityBlock(maximalEvalBattle());
    const perRule = ` — Advisory: ${ADVISORY}`.length;
    expect(lit.length - dark.length).toBe(14 * perRule);
  });
});

describe('M7-E2E — draft assembler: the COMPLETE decide.js strategy request at maximal load', () => {
  it('fits the model context with the stated headroom AND the tight budget-of-record; the fixture is genuinely maximal', () => {
    const { system, user, tools } = assembleDraftRequest();
    expect(system).toContain('STOCK UNIVERSE');
    expect(system.split('\n').length).toBeGreaterThan(130); // the 130-row CSV is really in there
    expect(user.split('Advisory:').length - 1).toBeGreaterThan(0); // candidate advisories lit on the draft surface
    const input = [system, user, tools].reduce((n, s) => n + estimateTokens(s), 0);
    expect(input + DRAFT_MAX_OUTPUT_TOKENS).toBeLessThan(MODEL_CONTEXT_TOKENS - STATED_HEADROOM_TOKENS);
    expect(input).toBeLessThan(DRAFT_FULL_REQUEST_INPUT_BUDGET);
  });

  it('dark parity at full-request scope: flag off, zero advisory bytes in the draft request (the PR-4 inactive guarantee)', () => {
    const lit = assembleDraftRequest({ lit: true });
    const dark = assembleDraftRequest({ lit: false });
    expect(dark.system).toBe(lit.system); // system carries no compat surface at all
    expect(dark.user.split('Advisory:').length - 1).toBe(0);
  });
});
