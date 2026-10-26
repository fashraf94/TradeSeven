// api/agent/decide.rankedEquip.test.js
//
// BaggerBomb measured thresholds — broad-release follow-up, ruling F2 (Flash,
// Oct 25, 2026; approved fence contact on the foldEquippedTickers call path).
// For a BaggerBomb (tiered) creation, an equipped watchlist ticker outside the
// ranked stock universe (an ETF such as KRE) is never folded into the battle's
// candidates; the agent still watches it. Tournament (and the League pods that
// ride it) never reach the fold, so their deploys are byte-identical.
//
// THE REAL DEPLOY (decide.js, createAgentBattle, the prompt assemblers, the
// creation path) on the P1b deploy harness; doubles at the edges only — the
// model SDK, the voice model, pricing, auth, the shadow logger and the store
// (the decide.carriageOffGolden.test.js precedent). The equip helper is the
// real one, wrapped in a call counter. The refresh half of F2 lives in
// api/cron/agent-evaluate.measuredFollowup.test.js.
//
// Dependency-surface guard (BUILD_RULES §4): decide.js and the battle writer
// are imported for real here — never mock them away.

process.env.TZ = 'UTC';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';

const state = vi.hoisted(() => ({ db: null, anthropic: null, gemmaCalls: [], shadow: { decisions: [], firstMessages: [] } }));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class AnthropicDouble {
    constructor() { this.messages = { create: (args) => state.anthropic.create(args) }; }
  },
}));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => state.db }));
vi.mock('../_utils/security.js', async (importOriginal) => ({ ...(await importOriginal()), applySecurityMiddleware: () => false }));
vi.mock('../_utils/authMiddleware.js', async (importOriginal) => ({ ...(await importOriginal()), requireAuth: async () => ({ uid: 'p1b-owner-1' }) }));
vi.mock('../_utils/marketDataCache.js', async (importOriginal) => {
  const { priceAnswer } = await import('../_utils/__fixtures__/deployHarness.js');
  return { ...(await importOriginal()), getStockAnalysisData: (symbol) => priceAnswer(symbol) };
});
vi.mock('../_utils/shadowLogger.js', () => ({
  logDecision: async (args) => { state.shadow.decisions.push(JSON.parse(JSON.stringify(args))); },
  logFirstMessage: async (args) => { state.shadow.firstMessages.push(JSON.parse(JSON.stringify(args))); },
}));
vi.mock('../_utils/gemmaClient.js', () => ({
  callGemmaVoice: async ({ systemPrompt, conversationHistory, userMessage }) => {
    state.gemmaCalls.push({ systemPrompt, conversationHistory, userMessage });
    return '{"response":"Opening line."}';
  },
  parseVoiceLayerResponse: () => ({ response: 'Opening line.', _scratchpad: null }),
}));
vi.mock('firebase-admin/firestore', async () => {
  const { FieldValueDouble } = await import('../_utils/__fixtures__/callsFirestore.js');
  return { FieldValue: FieldValueDouble };
});
// The real equip helper, its F2 predicate counted.
vi.mock('../_utils/watchlistEquip.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, rankedEquippedTickers: vi.fn(real.rankedEquippedTickers) };
});

const H = await import('../_utils/__fixtures__/deployHarness.js');
const { SCENARIOS } = await import('../_utils/__fixtures__/deployScenarios.js');
const { OFF_LIST_EQUIPPED } = await import('../_utils/__fixtures__/rankedEquipGolden.js');
const equip = await import('../_utils/watchlistEquip.js');
const { default: handler } = await import('./decide.js');

const STRATEGY = 'submit_strategy';
const PORTFOLIO = 'submit_portfolio';
const UNIVERSE_SYMBOLS = new Set(H.UNIVERSE.map((s) => s.symbol));

/** A model double whose portfolio answer the row chooses (first call and retry alike). */
function anthropicPicking(portfolioInput = H.PORTFOLIO_INPUT) {
  const calls = [];
  const create = async (args) => {
    calls.push(JSON.parse(JSON.stringify(args)));
    const tool = args.tool_choice?.name;
    const input = tool === STRATEGY ? H.STRATEGY_INPUT : portfolioInput;
    return { content: [{ type: 'tool_use', id: `toolu_${calls.length}`, name: tool, input: JSON.parse(JSON.stringify(input)) }], usage: { input_tokens: 1000, output_tokens: 100 } };
  };
  return { calls, create };
}

async function deploy({ tickers, req = H.clientRequest(), anthropic = anthropicPicking() }) {
  const docs = H.seedDeploy({ watchlist: H.watchlistDoc({ tickers }) });
  state.db = H.makeDeployDb(docs);
  state.anthropic = anthropic;
  state.gemmaCalls = [];
  state.shadow = { decisions: [], firstMessages: [] };
  Math.random.mockImplementation(H.seededRandom());
  const res = H.makeRes();
  await handler(req, res);
  await H.settle();
  const docsAfter = H.finalDocs(state.db);
  const battle = res.body?.agentBattleId ? docsAfter[`agentBattles/${res.body.agentBattleId}`] : null;
  const agent = docsAfter[`agents/${H.AGENT_ID}`];
  const haiku = anthropic.calls.filter((c) => c.tool_choice?.name === PORTFOLIO);
  const sonnet = anthropic.calls.find((c) => c.tool_choice?.name === STRATEGY);
  return { res, battle, agent, haiku, sonnet };
}
const rosterOf = (battle) => [
  ...battle.portfolio.star, ...battle.portfolio.core, ...battle.portfolio.support, ...battle.portfolio.bench.stocks,
  ...(battle.portfolio.bench.crypto ? [battle.portfolio.bench.crypto] : []),
].map((a) => a.symbol);
/** The AVAILABLE STOCKS rows of a Haiku system prompt (first CSV field). */
const availableRows = (system) => system.split('AVAILABLE STOCKS')[1].split('AVAILABLE CRYPTO')[0]
  .split('\n').map((l) => l.split('|')[0]).filter((s) => /^[A-Z.-]{1,12}$/.test(s));

let savedCron;
beforeEach(() => {
  savedCron = process.env.CRON_SECRET;
  process.env.CRON_SECRET = H.CRON_SECRET;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(H.FROZEN_NOW));
  vi.spyOn(Math, 'random').mockImplementation(H.seededRandom());
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  equip.rankedEquippedTickers.mockClear();
});
afterEach(() => {
  if (savedCron === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = savedCron;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('F2 — the pure rule (watchlistEquip.js rankedEquippedTickers)', () => {
  it('keeps the equipped tickers in the ranked universe, in order; drops the rest', () => {
    const ranked = new Set(['NVDA', 'WMT', 'AMD']);
    expect(equip.rankedEquippedTickers(['NVDA', 'KRE', 'WMT', 'SMH'], ranked)).toEqual(['NVDA', 'WMT']);
    expect(equip.rankedEquippedTickers([], ranked)).toEqual([]);
    expect(equip.rankedEquippedTickers(undefined, ranked)).toEqual([]);
  });
  it('the fold helper itself is unchanged: any caller handing it the full list gets the Option 8C output, byte for byte', () => {
    const validSymbols = new Set(['AAPL', 'NVDA']);
    const out = equip.foldEquippedTickers({ shortlist: ['AAPL', 'ZZZZ'], equippedSymbols: ['NVDA', 'KRE'], validSymbols });
    expect(JSON.stringify({ ...out, augmentedValidSymbols: [...out.augmentedValidSymbols] })).toBe(JSON.stringify({
      shortlist: ['AAPL', 'NVDA', 'KRE'], elevatedTickers: ['NVDA', 'KRE'], offUniverseTickers: ['KRE'], augmentedValidSymbols: ['AAPL', 'NVDA', 'KRE'],
    }));
  });
});

describe('F2 — a tiered creation through the real deploy', () => {
  it('the harness universe is what the rows assume: KRE off it, WMT on it but outside the model\'s shortlist and portfolio', () => {
    expect(UNIVERSE_SYMBOLS.has('KRE')).toBe(false);
    expect(UNIVERSE_SYMBOLS.has('WMT')).toBe(true);
    expect(H.STRATEGY_INPUT.shortlist).not.toContain('WMT');
    expect(Object.values(H.PORTFOLIO_INPUT).flat()).not.toContain('WMT');
  });

  it('an equipped ETF never enters the candidates: no Haiku row or note, no shortlist, no hotBench — while the agent still watches it', async () => {
    const { res, battle, agent, haiku, sonnet } = await deploy({ tickers: ['NVDA', 'KRE', 'WMT'] });
    expect(res.statusCode).toBe(200);
    expect(res.body.battleCreated).toBe(true);
    // Watched: the strategy prompt's equipped block and the frozen snapshot keep it.
    expect(JSON.stringify(sonnet.messages)).toContain('NVDA, KRE, WMT');
    expect(battle.agentContext.equippedWatchlist.tickers).toEqual(['NVDA', 'KRE', 'WMT']);
    // Not folded: the portfolio call never offers it, and no candidate list holds it.
    expect(haiku).toHaveLength(1);
    expect(availableRows(haiku[0].system)).not.toContain('KRE');
    expect(haiku[0].system).toContain('watchlist: NVDA, WMT.');
    expect(haiku[0].system).not.toContain('KRE');
    expect(agent.lastDecision.shortlist).not.toContain('KRE');
    expect(battle.watchlist.hotBench).not.toContain('KRE');
    expect(battle.watchlist.monitoring).not.toContain('KRE');
    expect(rosterOf(battle)).not.toContain('KRE');
    expect(equip.rankedEquippedTickers).toHaveBeenCalledTimes(1);
  });

  it('an equipped ranked stock still does: WMT is elevated into the shortlist, offered to Haiku with its ranked row, and kept on the hotBench', async () => {
    const { battle, agent, haiku } = await deploy({ tickers: ['NVDA', 'KRE', 'WMT'] });
    expect(agent.lastDecision.shortlist.at(-1)).toBe('WMT');
    expect(availableRows(haiku[0].system)).toContain('WMT');
    expect(haiku[0].system).not.toMatch(/\nWMT\|Unknown\|/);
    expect(battle.watchlist.hotBench).toContain('WMT');
  });

  it('an ETF the model picks anyway is refused by the portfolio check: the roster never holds it', async () => {
    const pickingKre = { ...H.PORTFOLIO_INPUT, star: ['KRE', 'MSFT'], bench_stocks: ['COST', 'LLY', 'WMT'] };
    const { res, battle, haiku } = await deploy({ tickers: ['NVDA', 'KRE', 'WMT'], anthropic: anthropicPicking(pickingKre) });
    expect(res.statusCode).toBe(200);
    expect(haiku).toHaveLength(2); // the first answer failed validation; the retry was told why
    expect(JSON.stringify(haiku[1].messages)).toContain('Unknown stock: KRE');
    expect(rosterOf(battle)).not.toContain('KRE');
    expect(battle.watchlist.hotBench).not.toContain('KRE');
  });

  it('a ranked equipped stock the model picks is accepted as before', async () => {
    const pickingWmt = { ...H.PORTFOLIO_INPUT, bench_stocks: ['COST', 'LLY', 'WMT'] };
    const { battle, haiku } = await deploy({ tickers: ['NVDA', 'KRE', 'WMT'], anthropic: anthropicPicking(pickingWmt) });
    expect(haiku).toHaveLength(1);
    expect(battle.portfolio.bench.stocks.map((a) => a.symbol)).toEqual(['COST', 'LLY', 'WMT']);
  });

  it('the frozen main capture really folded the off-list ticker, so the golden comparison sees F2 (not vacuous)', () => {
    const golden = JSON.parse(readFileSync(new URL('../_utils/__fixtures__/deployCarriageOffGolden.json', import.meta.url), 'utf8').replace(/\r\n/g, '\n'));
    const cap = golden.scenarios.self_select_ready_over_activated;
    expect(UNIVERSE_SYMBOLS.has(OFF_LIST_EQUIPPED)).toBe(false);
    expect(cap.modelRequests[1].system).toContain(`\n${OFF_LIST_EQUIPPED}|Unknown|`);
    expect(cap.docs[`agentBattles/${cap.response.body.agentBattleId}`].watchlist.hotBench).toContain(OFF_LIST_EQUIPPED);
  });
});

describe('F2 — tournament deploys never reach the rule', () => {
  it('the prescribed tournament branch returns before the fold: the predicate is never called and the battle carries no equip', async () => {
    const { req } = SCENARIOS.tournament_prescribed_with_ready_idea();
    const { res, battle } = await deploy({ tickers: ['NVDA', 'KRE', 'WMT'], req });
    expect(res.statusCode).toBe(200);
    expect(res.body.battleCreated).toBe(true);
    expect(equip.rankedEquippedTickers).not.toHaveBeenCalled();
    expect(battle.agentContext.equippedWatchlist).toBeNull();
  });

  it('in decide.js the narrowing sits after the tournament return and inside the fold hunk, before every consumer of the narrowed list', () => {
    const src = readFileSync(new URL('./decide.js', import.meta.url), 'utf8');
    const tournamentReturn = src.indexOf('return await runPrescribedTournamentDeploy(');
    const narrowing = src.indexOf('equippedSymbols = rankedEquipped;');
    const strategyPrompt = src.indexOf('const strategyUser = buildStrategyUserPrompt(');
    const fold = src.indexOf('const fold = foldEquippedTickers({');
    const haikuNote = src.indexOf('equippedWatchlistData ? { tickers: equippedSymbols } : null');
    const hotBenchUnion = src.indexOf('equippedTickers: equippedSymbols,');
    for (const at of [tournamentReturn, narrowing, strategyPrompt, fold, haikuNote, hotBenchUnion]) expect(at).toBeGreaterThan(0);
    expect(tournamentReturn).toBeLessThan(strategyPrompt);
    expect(strategyPrompt).toBeLessThan(narrowing); // the Sonnet prompt keeps the full (watched) list
    expect(narrowing).toBeLessThan(fold);
    expect(fold).toBeLessThan(haikuNote);
    expect(haikuNote).toBeLessThan(hotBenchUnion);
    expect(src.split('rankedEquippedTickers(').length - 1).toBe(1); // one call site in decide.js
  });
});
