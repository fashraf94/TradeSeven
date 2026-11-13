// Research Modal Build C — test fixtures shaped from real agent-battle documents.
// The measured position is the REAL corrected-battle harness
// (api/_utils/__fixtures__/stockThresholdHarness.js — a stamped battle, a bound
// receipt, a committed score patch), so Build A's selector reads it exactly as
// it reads production. Field names and shapes beside it — evaluations[] with
// rationale / evidence / candidates (Phase 0 §B), cronState.stagnationTicks,
// agentContext.equippedHypothesis / equippedWatchlist, the directive slot —
// come from the writers Phase 0 cites; values are invented. No production read.

import { STOCK_TEST_NOW, correctedStockBattle, stockWriterDb, stockObservation, stockRows } from '../../../../../api/_utils/__fixtures__/stockThresholdHarness.js';
import { correctedScorePatch, scoreCorrectedPosition, bindStockReceipt } from '../../../../../api/_utils/stockThresholdAdmission.js';
import { initialRewardHistory } from '../../../../utils/stockThresholdModel.js';

/** Wed Oct 14 2026, 1:07 PM ET — after the fixture's 10:02 entry and its 12:45 check, off a slot boundary. */
export const SHEET_NOW = Date.parse('2026-10-14T17:07:00.000Z');
export const ARCHETYPES = Object.freeze(['momentum_chaser', 'contrarian', 'degen', 'guardian', 'diversifier', 'analyst']);
/** Each archetype's defaultPreset (agentArchetypeConfig.js) — the fixture battle's strategyPreset. */
export const DEFAULT_PRESET = Object.freeze({ momentum_chaser: 'aggressive', contrarian: 'balanced', degen: 'aggressive', guardian: 'defensive', diversifier: 'balanced', analyst: 'balanced' });

const RATIONALE = 'Holding the book through the midday chop. AAPL is still printing higher lows above VWAP, so the trend is intact and the position stays. ETH has gone quiet for six checks, which puts it first in line if a better name shows up.';

/**
 * A live measured battle holding AAPL (fill $100.75) with its +15 rung banked
 * at the 12:45 check, plus a quiet crypto holding ETH, a bench name NVDA and the
 * founder-shaped loop records. `over` patches the document last.
 */
export async function measuredSheetBattle({ archetype = 'momentum_chaser', preset = DEFAULT_PRESET[archetype], scoredQuote = 103.4, over = {} } = {}) {
  const env = globalThis.process.env; // a Node test fixture (the harness reads the key at collection time)
  const saved = env.EODHD_API_KEY;
  env.EODHD_API_KEY = 'isolated-key';
  try {
    const { battle } = await correctedStockBattle({ fill: 100.75 });
    const prices = { AAPL: { current: scoredQuote, timestamp: Date.parse('2026-10-14T16:45:31.000Z') / 1000 } };
    const scores = ['agent', 'cpu'].map((side) => scoreCorrectedPosition(battle, { ...(side === 'agent' ? battle.portfolio : battle.opponent.portfolio).star[0], tier: 'star' }, side, prices, '2026-10-14T16:45:40.000Z'));
    const h = stockWriterDb({ battle });
    await h.db.doc('battle').update(correctedScorePatch(battle, [scores[0]], [scores[1]], '2026-10-14T16:45:40.000Z'));
    Object.assign(battle, h.store.get('battle'));
    // A quiet second holding. Crypto, because a second STOCK would have to be part of the committed
    // score's roster (committedContextContent binds every stock position); crypto is legacy-scored on a
    // stamped battle and sits outside that binding, as in production.
    battle.portfolio.support = [{ symbol: 'ETH', name: 'Ethereum', isCrypto: true, baseATR: 2.2, positionId: 'position-eth', swappedInAt: STOCK_TEST_NOW }];
    const doc = {
      ...battle,
      status: 'active',
      strategyPreset: preset,
      expiresAt: '2026-10-20T20:00:00.000Z',
      agentContext: {
        agentName: 'Juno',
        archetype,
        equippedWatchlist: { watchlistId: 'wl-energy', name: 'Energy into earnings', tickers: [{ symbol: 'AAPL' }, { symbol: 'ETH' }, { symbol: 'MSFT' }], snapshotAt: '2026-10-13T13:30:00.000Z' },
        equippedHypothesis: {
          watchlistId: 'wl-energy', hypothesisVersion: 2, contentHash: 'h', statement: 'Big caps with clean balance sheets keep leading while rates hold; buy the leaders on quiet pullbacks.',
          horizonEnum: 'swing', horizonSource: 'player',
          activation: [{ symbol: 'AAPL', side: 'above', level: 98.5, basis: 'daily_close' }],
          invalidation: [{ symbol: 'AAPL', side: 'below', level: 96.2, basis: 'daily_close' }],
          evidenceRefs: [], publishedAt: null, origin: 'manual',
        },
      },
      cronState: { stagnationTicks: { AAPL: 1, ETH: 6 }, lastTickPrice: {}, lastTickTimestamp: {} },
      evaluations: [
        { evalId: 'e1', timestamp: '2026-10-14T15:30:00.000Z', rationale: 'Opening read: the book is balanced. NVDA is on watch.', evidence: { AAPL: { px: 101.1, chg: 0.35, atrX: 0.2, vwapDev: 0.1, bbPct: 40, nr7: false, regime: 'choppy', risk: { action: 'HOLD' } } }, candidates: [{ symbol: 'NVDA', direction: 'potential_entry', signalSummary: 'Volume 2.1× its 30-day average on a break above the 20-day high.', threshold: 1.2, signalSource: 'technical' }] },
        { evalId: 'e2', timestamp: '2026-10-14T16:45:00.000Z', rationale: RATIONALE, evidence: { AAPL: { px: 103.4, chg: 2.63, atrX: 1.05, vwapDev: 0.4, bbPct: 72, nr7: true, regime: 'directional_expansion', risk: { action: 'LOCK', reason: 'threshold_proximity' } }, ETH: { px: 2410.5, chg: 0.18, atrX: 0.08, vwapDev: -0.1, bbPct: 12, nr7: false, regime: 'choppy', risk: { action: 'HOLD' } } }, candidates: [{ symbol: 'NVDA', direction: 'potential_entry', signalSummary: 'Volume 2.1× its 30-day average on a break above the 20-day high.', threshold: 1.2, signalSource: 'technical' }] },
      ],
      directive: { text: 'Keep AAPL through the close unless it loses VWAP.', expiry: 'end_of_day', directiveThreadId: 'thread-1', createdAt: '2026-10-14T15:40:00.000Z' },
      chatBudgetUsed: 3,
      chatExchanges: [],
      // scoreState is the committed score patch's own (its stockScoreEvidence binds the context — never overwritten).
      ...over,
    };
    return doc;
  } finally {
    if (saved === undefined) delete env.EODHD_API_KEY; else env.EODHD_API_KEY = saved;
  }
}

/** The chart's daily bars for AAPL around the fixture (newest-first {date, open, high, low, close}). */
export const AAPL_DAILY = Object.freeze([
  { date: '2026-10-14', open: 101, high: 104.1, low: 100.6, close: 103.2, volume: 1 },
  { date: '2026-10-13', open: 99.4, high: 101.2, low: 99, close: 100.9, volume: 1 },
  { date: '2026-10-12', open: 98.8, high: 99.9, low: 98.1, close: 99.3, volume: 1 },
]);

/** The rankings doc, as indexIntelligence/stockRankings holds it (arch_scores per archetype). */
export const RANKINGS = Object.freeze({
  computedAt: { seconds: Date.parse('2026-10-14T12:30:00.000Z') / 1000 },
  stocks: [
    { symbol: 'AAPL', arch_scores: { momentum_chaser: 78.4, contrarian: 31.2, degen: 64.9, guardian: 70.1, diversifier: 69.5, analyst: 73.8 } },
    { symbol: 'ETH', arch_scores: { momentum_chaser: 52.2, contrarian: 58.7, degen: 41.3, guardian: 66.4, diversifier: 64.2, analyst: 61 } },
    { symbol: 'NVDA', arch_scores: { momentum_chaser: 88.9, contrarian: 12.4, degen: 91.7, guardian: 49.8, diversifier: 55.1, analyst: 68.2 } },
    // The harness's bench name (QF-3 / QF-4's bench alternative), with BS-4's ATR reading (the rankings copy).
    { symbol: 'MSFT', arch_scores: { momentum_chaser: 71.6, contrarian: 44.9, degen: 58.3, guardian: 74.2, diversifier: 67.7, analyst: 80.5 }, techRaw: { atrPercent: 1.87 } },
  ],
});

/** A row of 15 completed sessions whose true range is `rangePct` of a $100 close (the measured ATR %). */
function rangedRows(rangePct) {
  return stockRows().map((r) => ({ ...r, high: 100 + rangePct / 2, low: 100 - rangePct / 2 }));
}

/**
 * QF-2's six-stock book (build prompt of Nov 13, 2026): six measured stocks the agent holds, each with
 * its own measured rung size, scored at the 12:45 check to a chosen RUNGS FROM ENTRY, plus a crypto
 * holding (ETH, legacy-scored — never ranked). Ranked by rungs: EQIX −0.4, KO −0.3, CAT −0.1, JPM +0.2,
 * XOM +0.6, AAPL +1.3. By raw % from entry the lowest is KO (−1.2 %), not EQIX (−0.4 %) — the rung
 * size differs (KO's ATR 4 %, EQIX's 1 %). The bench: MSFT and ORCL available, NVDA cooling down.
 */
export const BOOK_STOCKS = Object.freeze([
  { symbol: 'AAPL', tier: 'star', slot: 0, fill: 100.75, range: 2, rungs: 1.32 },
  { symbol: 'XOM', tier: 'star', slot: 1, fill: 118.3, range: 2, rungs: 0.62 },
  { symbol: 'EQIX', tier: 'core', slot: 0, fill: 812.4, range: 1, rungs: -0.42 },
  { symbol: 'JPM', tier: 'core', slot: 1, fill: 240.1, range: 2.5, rungs: 0.18 },
  { symbol: 'KO', tier: 'support', slot: 0, fill: 61.2, range: 4, rungs: -0.31 },
  { symbol: 'CAT', tier: 'support', slot: 1, fill: 380, range: 3, rungs: -0.12 },
]);
export const BOOK_CHECK_AT = '2026-10-14T16:45:40.000Z';
const BOOK_QUOTE_AT = Date.parse('2026-10-14T16:45:31.000Z') / 1000;

/**
 * `checks` (optional): the checks to commit in order, each { at, quoteAt, quotes: { SYM: price } } — a
 * symbol a check does not name is quoted at its `rungs` target. Default: one check at BOOK_CHECK_AT.
 */
export async function measuredBookBattle({ archetype = 'momentum_chaser', preset = DEFAULT_PRESET[archetype], stocks = BOOK_STOCKS, quotes = {}, checks = null, over = {} } = {}) {
  const env = globalThis.process.env;
  const saved = env.EODHD_API_KEY;
  env.EODHD_API_KEY = 'isolated-key';
  try {
    const { battle } = await correctedStockBattle({ fill: 100.75, cpuSymbol: 'PEP', cpuFill: 170 });
    battle.portfolio = { star: [], core: [], support: [], bench: { stocks: [{ symbol: 'MSFT', baseATR: 3 }, { symbol: 'NVDA', baseATR: 3.5, cooldownUntil: '2026-10-15T14:00:00.000Z' }, { symbol: 'ORCL', baseATR: 2.8 }], crypto: null }, startingPrices: {} };
    battle.scoring.stockRewardHistory.agent = {};
    battle.scoring.stockRiskHistory.agent = {};
    const targets = {};
    for (const s of stocks) {
      const obs = await stockObservation(s.symbol, { price: s.fill, rows: rangedRows(s.range) });
      const positionId = `position-${s.symbol.toLowerCase()}`;
      const r = bindStockReceipt(obs, { battleId: battle.id, side: 'agent', tier: s.tier, slot: s.slot, positionId, slotVersion: 1, enteredAt: STOCK_TEST_NOW });
      battle.portfolio[s.tier][s.slot] = { symbol: s.symbol, baseATR: 2.5, positionId, slotVersion: 1, stockThresholdReceipt: r, swapPrice: r.fill, swappedInAt: STOCK_TEST_NOW };
      battle.portfolio.startingPrices[s.symbol] = r.fill;
      battle.scoring.stockRewardHistory.agent[positionId] = initialRewardHistory(r);
      battle.scoring.stockRiskHistory.agent[positionId] = { positionId, maxMultiplier: 0, minMultiplier: 0 };
      targets[s.symbol] = quotes[s.symbol] ?? Number((r.fill * (1 + (s.rungs * r.scoringPct) / 100)).toFixed(2));
    }
    for (const check of checks ?? [{ at: BOOK_CHECK_AT, quoteAt: BOOK_QUOTE_AT, quotes: {} }]) {
      const prices = { PEP: { current: 171.1, timestamp: check.quoteAt } };
      for (const s of stocks) prices[s.symbol] = { current: check.quotes?.[s.symbol] ?? targets[s.symbol], timestamp: check.quoteAt };
      const flat = ['star', 'core', 'support'].flatMap((tier) => battle.portfolio[tier].map((a) => ({ ...a, tier })));
      const agentScores = flat.map((a) => scoreCorrectedPosition(battle, a, 'agent', prices, check.at));
      const cpuScores = [scoreCorrectedPosition(battle, { ...battle.opponent.portfolio.star[0], tier: 'star' }, 'cpu', prices, check.at)];
      const h = stockWriterDb({ battle });
      await h.db.doc('battle').update(correctedScorePatch(battle, agentScores, cpuScores, check.at));
      Object.assign(battle, h.store.get('battle'));
    }
    // The crypto holding, outside the committed stock binding (as in measuredSheetBattle).
    battle.portfolio.support.push({ symbol: 'ETH', name: 'Ethereum', isCrypto: true, baseATR: 2.2, positionId: 'position-eth', swappedInAt: STOCK_TEST_NOW });
    return {
      ...battle,
      status: 'active',
      strategyPreset: preset,
      expiresAt: '2026-10-20T20:00:00.000Z',
      agentContext: { agentName: 'shadow', archetype },
      cronState: { stagnationTicks: { EQIX: 4, KO: 2, AAPL: 1, ETH: 6 }, lastTickPrice: {}, lastTickTimestamp: {} },
      evaluations: [],
      chatBudgetUsed: 2,
      chatExchanges: [],
      ...over,
    };
  } finally {
    if (saved === undefined) delete env.EODHD_API_KEY; else env.EODHD_API_KEY = saved;
  }
}

/** The rankings doc for the book (arch_scores; techRaw.atrPercent — BS-4's ATR reading, the rankings copy). */
export const BOOK_RANKINGS = Object.freeze({
  computedAt: { seconds: Date.parse('2026-10-14T16:30:00.000Z') / 1000 },
  stocks: [
    { symbol: 'NVDA', arch_scores: { momentum_chaser: 91.2, guardian: 48.1 }, techRaw: { atrPercent: 3.46 } },
    { symbol: 'ORCL', arch_scores: { momentum_chaser: 84.6, guardian: 66.2 }, techRaw: { atrPercent: 2.83 } },
    { symbol: 'MSFT', arch_scores: { momentum_chaser: 72.3, guardian: 71.9 }, techRaw: { atrPercent: 1.94 } },
    { symbol: 'AAPL', arch_scores: { momentum_chaser: 78.4, guardian: 70.1 }, techRaw: { atrPercent: 2.1 } },
    { symbol: 'EQIX', arch_scores: { momentum_chaser: 41.7, guardian: 62.3 }, techRaw: { atrPercent: 1.02 } },
  ],
});
