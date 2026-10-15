// api/_utils/__fixtures__/cryptoSlotLiveContextCases.js
//
// Crypto Slot v2 — the synthetic live-context cases of the step 0.3
// pre-change capture (build report docs/audits/20261014_BUILD_CRYPTO_SLOT_CHECK_LINE.md
// §0). cryptoSlotLiveContextGoldens.json holds what the REAL
// buildLiveContextBlock rendered for each case at `e880592e`, before any edit,
// with the clock fixed at NOW — the flag-off text of record. Never regenerate
// it to make a test green: a flag-off render that differs from it is the bug.
//
// The case definitions below are the capture generator's, byte for byte
// (they moved here from the one-off capture file so the test renders exactly
// the inputs that were captured). ZERO product imports (the
// tickStampsHarness.js / voiceGroundingFixtures.js precedent).
//
// Coverage: held BTC with SWAP_OUT (stagnation) and bench ETH down / up / on
// cooldown; SWAP_OUT (vwap_failure); every position HOLD (no RISK STATUS
// block) and riskStatus null; BTC LOCKED; BTC EMERGENCY_SWAP; a stock's
// SWAP_OUT while BTC holds; ETH held after a crypto swap ("Unknown" sectors,
// BTC on cooldown, one closed trade); no crypto held; flat6.

export const NOW = Date.parse('2026-10-14T15:00:00.000Z');
const FUTURE = '2026-10-15T14:00:00.000Z';

const stock = (symbol, sector, baseATR = 5) => ({ symbol, sector, baseATR, isCrypto: false });
const crypto = (symbol, baseATR = 5, sector = 'Crypto') => ({ symbol, ...(sector ? { sector } : {}), baseATR, isCrypto: true });

function tieredBattle({ heldCrypto = 'BTC', benchCrypto = 'ETH', cooldown = false, unknownSectors = false, noCrypto = false, trades = [] } = {}) {
  const support2 = noCrypto ? stock('KO', 'Consumer Staples', 2.5) : crypto(heldCrypto, 5, unknownSectors ? null : 'Crypto');
  const benchC = { ...crypto(benchCrypto, 5, unknownSectors ? null : 'Crypto'), ...(cooldown ? { cooldownUntil: FUTURE } : {}) };
  return {
    id: 'battle-capture',
    gameMode: 'baggerbomb_agent',
    createdAt: '2026-10-13T13:30:00.000Z',
    timing: { tradingDays: [] },
    portfolio: {
      star: [stock('NVDA', 'Technology', 3), stock('MSFT', 'Technology', 3.5)],
      core: [stock('VLO', 'Energy', 7.4), stock('MPC', 'Energy', 7.1)],
      support: [stock('AAPL', 'Technology', 3), stock('JPM', 'Financials', 3.2), support2],
      bench: { stocks: [stock('AMD', 'Technology', 7), stock('GME', 'Consumer Discretionary', 6.9)], crypto: benchC },
      startingPrices: { NVDA: 230, MSFT: 510, VLO: 400, MPC: 420, AAPL: 220, JPM: 250, KO: 70, BTC: 84000, ETH: 2700 },
    },
    agentContext: { agentName: 'Atlas', archetype: 'momentum_chaser', activeRules: [] },
    scoring: { thresholds: {} },
    scoreState: { currentScore: 12.5, activeScore: 12.5, bankedScore: 0, tradeCount: trades.length, evaluationCount: 9 },
    trades,
    evaluations: [],
  };
}

function flat6Battle() {
  return {
    id: 'battle-capture-flat6',
    gameMode: 'baggerbomb_tournament',
    createdAt: '2026-10-13T13:30:00.000Z',
    timing: { tradingDays: [] },
    portfolio: {
      star: [], core: [],
      support: [stock('NVDA', 'Technology', 3), stock('MSFT', 'Technology', 3.5), stock('VLO', 'Energy', 7.4), stock('MPC', 'Energy', 7.1), stock('AAPL', 'Technology', 3), stock('JPM', 'Financials', 3.2)],
      bench: { stocks: [stock('AMD', 'Technology', 7), stock('GME', 'Consumer Discretionary', 6.9)], crypto: null },
      startingPrices: { NVDA: 230, MSFT: 510, VLO: 400, MPC: 420, AAPL: 220, JPM: 250 },
    },
    agentContext: { agentName: 'Atlas', archetype: 'momentum_chaser', activeRules: [] },
    scoring: { thresholds: {} },
    scoreState: { currentScore: 3.1, activeScore: 3.1, bankedScore: 0, tradeCount: 0, evaluationCount: 4 },
    trades: [],
    evaluations: [],
  };
}

export const PRICES = (ethDaily = -1.12, btcDaily = -1.41) => ({
  NVDA: { current: 232.3, changePercent: 1.01 }, MSFT: { current: 519, changePercent: 0.4 },
  VLO: { current: 412, changePercent: 3.1 }, MPC: { current: 431, changePercent: 2.7 },
  AAPL: { current: 221, changePercent: 0.2 }, JPM: { current: 248, changePercent: -0.6 },
  KO: { current: 70.5, changePercent: 0.1 },
  AMD: { current: 632.11, changePercent: -0.28 }, GME: { current: 25.5, changePercent: 3.24 },
  BTC: { current: 85257.72, changePercent: btcDaily }, ETH: { current: 2696.08, changePercent: ethDaily },
});

const score = (symbol, baseATR, priceChange = 0.5, multiplier = 0.1) => ({ symbol, baseATR, priceChange, multiplier, badges: [], totalPoints: 6, basePoints: 6, bonusPoints: 0, history: { maxMultiplier: 0 } });
export const scoresFor = (battle) => [...battle.portfolio.star, ...battle.portfolio.core, ...battle.portfolio.support].map((a) => score(a.symbol, a.baseATR));
const holdAll = (battle) => Object.fromEntries(scoresFor(battle).map((s) => [s.symbol, { action: 'HOLD', reason: null, detail: '' }]));
export const MACRO = { SPY: 0.61, QQQ: 0.63, BTC: -1.41 };
export const PRESET = { label: 'Balanced', promptGuidance: 'Balanced preset guidance.', risk: {} };
export const TRIGGERS = [{ type: 'price_move', detail: 'NVDA moved 1.0% since last eval' }];

function riskWith(battle, overrides) {
  return { ...holdAll(battle), ...overrides };
}

/** name → () => [battle, prices, riskStatus] — the capture's twelve cases, in capture order. */
export const CASES = {
  'tiered.btc-swapout-stagnation.eth-down': () => { const b = tieredBattle(); return [b, PRICES(), riskWith(b, { BTC: { action: 'SWAP_OUT', reason: 'stagnation', detail: 'BTC stagnant' } })]; },
  'tiered.btc-swapout-stagnation.eth-up': () => { const b = tieredBattle(); return [b, PRICES(2.1), riskWith(b, { BTC: { action: 'SWAP_OUT', reason: 'stagnation', detail: 'BTC stagnant' } })]; },
  'tiered.btc-swapout-vwap.eth-down': () => { const b = tieredBattle(); return [b, PRICES(), riskWith(b, { BTC: { action: 'SWAP_OUT', reason: 'vwap_failure', detail: 'BTC below VWAP' } })]; },
  'tiered.all-hold': () => { const b = tieredBattle(); return [b, PRICES(), holdAll(b)]; },
  'tiered.riskstatus-null': () => { const b = tieredBattle(); return [b, PRICES(), null]; },
  'tiered.btc-locked': () => { const b = tieredBattle(); return [b, PRICES(2.1), riskWith(b, { BTC: { action: 'LOCK', reason: 'threshold_proximity', detail: 'BTC at +0.85x ATR' } })]; },
  'tiered.stock-swapout.btc-hold': () => { const b = tieredBattle(); return [b, PRICES(), riskWith(b, { JPM: { action: 'SWAP_OUT', reason: 'vwap_failure', detail: 'JPM below VWAP' } })]; },
  'tiered.btc-swapout.eth-cooldown': () => { const b = tieredBattle({ cooldown: true }); return [b, PRICES(2.1), riskWith(b, { BTC: { action: 'SWAP_OUT', reason: 'stagnation', detail: 'BTC stagnant' } })]; },
  'tiered.btc-emergency': () => { const b = tieredBattle(); return [b, PRICES(), riskWith(b, { BTC: { action: 'EMERGENCY_SWAP', reason: 'bust_avoidance', detail: 'BTC bust' } })]; },
  'tiered.held-eth.unknown-sectors.btc-cooldown': () => {
    const trades = [{ id: 'trade_001', symbolOut: 'BTC', symbolIn: 'ETH', tier: 'support', swapDay: 1, entryPrice: 84000, exitPrice: 85100, lockedGainPct: 1.31, lockedPoints: 13.1, swappedOutAt: '2026-10-14T14:30:00.000Z', exitReason: 'haiku_decision' }];
    const b = tieredBattle({ heldCrypto: 'ETH', benchCrypto: 'BTC', cooldown: true, unknownSectors: true, trades });
    return [b, PRICES(), riskWith(b, { ETH: { action: 'SWAP_OUT', reason: 'stagnation', detail: 'ETH stagnant' } })];
  },
  'tiered.no-crypto-held': () => { const b = tieredBattle({ noCrypto: true, benchCrypto: 'BTC' }); return [b, PRICES(), riskWith(b, { JPM: { action: 'SWAP_OUT', reason: 'stagnation', detail: 'JPM stagnant' } })]; },
  'flat6.stock-swapout': () => { const b = flat6Battle(); return [b, PRICES(), riskWith(b, { JPM: { action: 'SWAP_OUT', reason: 'stagnation', detail: 'JPM stagnant' } })]; },
};

/** The momentumData the capture passed for a case (riskStatus as the case gives it). */
export const momentumFor = (riskStatus) => ({ vwap: {}, rankings: {}, riskStatus, rankingsMap: {}, techScoresMap: {}, marketPosture: 'risk_on', regimes: {} });
