// api/_utils/activationEvidence/__fixtures__/activationBattles.js
//
// Battle documents in the shapes the writers of record produce, for the
// observer's tests. Field names are copied from those writers, cited per field:
//   creation  agentBattleService.js:140-262 (createAgentBattle), decide.js:1262-1290 (assets)
//   legacy    agentSwapExecution.js:395-433 (the row and the incoming asset), :499 (slice), :508 (count)
//   corrected stockThresholdAdmission.js:94-104 (qualify: positionId, swappedInAt, receipt),
//             :252-283 (the row, the incoming asset, the receipts)
// The corrected route's real writer is also driven end to end in lifetimes.test.js
// (the stockThresholdHarness), so these hand-built shapes are checked against it.

export const DAY = '2026-11-05'; // a Thursday, EST (DST ended 1 Nov 2026); close 21:00 UTC
export const CREATED_AT = '2026-11-05T14:30:02.118Z';
export const ADMITTED_AT = '2026-11-05T14:30:02.377Z'; // the creation transaction's clock, ms after createdAt
export const EXPIRES_AT = '2026-11-06T01:00:00.000Z'; // the Night Game close, 20:00 EST (stockAdmissionWindow.js:72)

const clone = (v) => structuredClone(v);
export const stock = (symbol, extra = {}) => ({ symbol, name: symbol, baseATR: 2.5, isCrypto: false, sector: 'Technology', ...extra });
export const crypto = (symbol, extra = {}) => ({ symbol, name: symbol, baseATR: 5, isCrypto: true, sector: 'Crypto', ...extra });

/** The roster a deploy produces: 2 star, 2 core, 2 support stocks and support[2] crypto (decide.js:1290). */
export function roster() {
  return { star: [stock('NVDA'), stock('AMD')], core: [stock('MSFT'), stock('AAPL')], support: [stock('KO'), stock('XOM'), crypto('BTC')] };
}

/** A legacy-route battle as createAgentBattle writes it (no positionId, no swappedInAt on positions). */
export function legacyBattle(over = {}) {
  const r = roster();
  return {
    agentId: 'agent-1', ownerId: 'owner-1', status: 'active', gameMode: 'baggerbomb_agent', duration: 'fullday',
    createdAt: CREATED_AT, activatedAt: CREATED_AT, completedAt: null, expiresAt: EXPIRES_AT, updatedAt: CREATED_AT,
    timing: { tradingDays: [DAY], currentTradingDay: 1, timezone: 'America/New_York', localOpen: '09:30', localClose: '20:00', lastDailyResetAt: null },
    portfolio: {
      star: clone(r.star), core: clone(r.core), support: clone(r.support),
      bench: { stocks: [stock('JPM'), stock('BRK-B'), stock('CVX')], crypto: crypto('ETH') },
      startingPrices: { NVDA: 140, AMD: 160, MSFT: 420, AAPL: 230, KO: 61, XOM: 110, BTC: 70000 },
    },
    opponent: null,
    scoring: { thresholds: {} },
    agentContext: { agentName: 'Agent', archetype: 'momentum_chaser', equippedWatchlist: null, initialPortfolio: clone(r) },
    trades: [],
    scoreState: { tradeCount: 0 },
    ...over,
  };
}

/** Apply one legacy swap, as agentSwapExecution.js commits it. Returns the row. */
export function legacySwap(battle, { tier, slot, symbolIn, at, cryptoIn = false, evaluationId = 'risk_stop_X_1', battleId = 'b-legacy' }) {
  const out = battle.portfolio[tier][slot];
  const row = {
    symbolOut: out.symbol, symbolIn, name: out.name || out.symbol, tier, slotIndex: slot,
    entryPrice: 100, exitPrice: 101, lockedPoints: 0, lockedGainPct: 1, swappedOutAt: at, swapDay: 1,
    isCrypto: out.isCrypto || false, direction: out.direction || null,
    evaluationId, source: 'risk_manager', exitReason: 'stop_loss',
    snapshot: null,
    verification: { verificationId: `${battleId}:${evaluationId}:verify`, mode: 'enforce', expected: null, found: { symbol: out.symbol, swappedInAt: out.swappedInAt ?? null }, verdict: 'not_checked', basis: null, battleStatus: 'active', slot: { tier, slotIndex: slot }, tradeSeq: battle.scoreState.tradeCount, checkedAt: at },
  };
  battle.portfolio[tier][slot] = { symbol: symbolIn, name: symbolIn, isCrypto: cryptoIn, baseATR: cryptoIn ? 5 : 2.5, swapPrice: 100, swappedInAt: at, swappedInDay: 1 };
  battle.trades = [...battle.trades, row].slice(-50);
  battle.scoreState.tradeCount += 1;
  return row;
}

const receipt = (symbol, { tier, slot, positionId, enteredAt, slotVersion = 1 }) => ({
  model: 'stock-threshold-v2', battleId: 'b-corrected', side: 'agent', tier, slot, positionId, slotVersion, symbol, fill: 100, enteredAt, receiptHash: `h-${positionId}`,
});

/** A corrected-route battle after qualify (stockThresholdAdmission.js:94-104): every position has a positionId, stocks a receipt and swappedInAt. */
export function correctedBattle(over = {}) {
  const b = legacyBattle({ agentId: 'agent-2' });
  b.scoring = { thresholds: {}, stockThresholdModel: { model: 'stock-threshold-v2', admittedAt: ADMITTED_AT }, stockRosterVersion: 1, stockScoreVersion: 0 };
  b.opponent = { portfolio: { star: [stock('TSLA')], core: [], support: [] } };
  for (const tier of ['star', 'core', 'support']) {
    b.portfolio[tier].forEach((a, slot) => {
      a.positionId = `pos-${tier}-${slot}`;
      a.slotVersion = 1;
      if (!a.isCrypto) Object.assign(a, { stockThresholdReceipt: receipt(a.symbol, { tier, slot, positionId: a.positionId, enteredAt: ADMITTED_AT }), swapPrice: 100, swappedInAt: ADMITTED_AT });
    });
  }
  return Object.assign(b, over);
}

/** Apply one corrected swap, as executeCorrectedStockSwap commits it. Returns the row. */
export function correctedSwap(battle, { tier, slot, symbolIn, at, cryptoIn = false, positionId, evaluationId = 'eval_012' }) {
  const out = battle.portfolio[tier][slot];
  const inReceipt = cryptoIn ? null : receipt(symbolIn, { tier, slot, positionId, enteredAt: at, slotVersion: out.slotVersion + 1 });
  const incoming = { symbol: symbolIn, name: symbolIn, isCrypto: cryptoIn, baseATR: cryptoIn ? 5 : 2.5, swapPrice: 100, swappedInAt: at, swappedInDay: 1, positionId, slotVersion: out.slotVersion + 1, ...(inReceipt ? { stockThresholdReceipt: inReceipt } : {}) };
  const row = {
    evaluationId, source: 'haiku', exitReason: 'haiku_decision',
    symbolOut: out.symbol, symbolIn, name: out.name || out.symbol, tier, slotIndex: slot, entryPrice: 100, exitPrice: 101, lockedPoints: 0, lockedGainPct: 1,
    swappedOutAt: at, swapDay: 1, isCrypto: out.isCrypto || false, direction: out.direction || null, snapshot: null,
    stockThresholdModel: battle.scoring.stockThresholdModel, outgoingPositionId: out.positionId, incomingPositionId: positionId,
    outgoingReceipt: out.stockThresholdReceipt || null, incomingReceipt: inReceipt, rewardContext: null, outgoingRiskHistory: null,
  };
  battle.portfolio[tier][slot] = incoming;
  battle.trades = [...battle.trades, row].slice(-50);
  battle.scoreState.tradeCount += 1;
  return row;
}

/** A permanent tick record (captureWriter.js:243-308), with one committed swap action per row given. */
export function tickOf(tickSeq, capturedAt, rows = []) {
  return {
    schemaVersion: 2, tickId: `b:${tickSeq}`, battleId: 'b', tickSeq, evalId: `eval_${String(tickSeq).padStart(3, '0')}`, capturedAt,
    actions: rows.map((r, i) => ({ actionId: `b:${tickSeq}:${i + 1}`, n: i + 1, kind: 'swap', source: 'haiku', exitReason: 'haiku_decision', symbolOut: r.symbolOut, symbolIn: r.symbolIn, swappedOutAt: r.swappedOutAt, lockedPoints: 0, entryPrice: 100, committed: true })),
  };
}
