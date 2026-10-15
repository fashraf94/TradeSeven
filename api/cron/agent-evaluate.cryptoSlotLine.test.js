// api/cron/agent-evaluate.cryptoSlotLine.test.js
//
// Crypto Slot v2 — "verdict = gate", end to end (build report
// docs/audits/20261014_BUILD_CRYPTO_SLOT_CHECK_LINE.md §5). The REAL
// processAgentBattle runs one tick on the tick-stamps harness book (BTC in
// the crypto slot), with ETH added as the bench crypto and the model scripted
// to propose exactly the crypto slot's one swap, BTC → ETH, at conviction 90.
// Each row reads TWO things off the same tick and requires them to agree:
//
//   - what the model was TOLD: the CRYPTO SLOT THIS CHECK line in the request
//     the cron actually sent (the verdict, computed before the prompt build);
//   - what the GATES then DID with that very proposal: executed it, or held
//     it at a named gate (LOCK, the validator's cooldown, the hurdle floor's
//     bench-positive step or margin, the swap cap).
//
// "You can swap" ⇒ the swap executed; "you cannot swap — <reason>" ⇒ held at
// exactly that gate. Conviction is the one stated exception (the model's own
// field — here always 90). Plus: the RISK STATUS annotation on a real
// stagnation SWAP_OUT; the verdict seeing a forced rotation that ran earlier
// in the same tick (computed after the rebuild); and the flag-off tick, whose
// momentumData never carries the key.
//
// The executor is DOUBLED (it commits to the in-memory doc the way the real
// one commits to Firestore — the agent-evaluate.guardrailErrorFailClosed.test.js
// precedent); every gate, the risk manager, the validator and the assembler
// are real. The double is bound by reference to a `…Mock` name so the
// repo-level executor call-site census still reads this file as a non-consumer.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  FROZEN_NOW,
  makeTickBattle, makePriceTable, makeRankingsDoc, makeTechDocs, makeIntradayCandles,
  makeSwapResult, makeToolUseResponse, makeTickDb,
} from '../_utils/__fixtures__/tickStampsHarness.js';

const mocks = vi.hoisted(() => ({
  getStockAnalysisData: vi.fn(), fetchIntradayBatch: vi.fn(), create: vi.fn(),
}));
const { flagState, seen } = vi.hoisted(() => ({ flagState: { crypto: true }, seen: { momentum: [] } }));
const { executeSwapServerMock } = vi.hoisted(() => ({ executeSwapServerMock: vi.fn() }));

vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get CRYPTO_SLOT_PROMPT_ENABLED() { return flagState.crypto; },
}));
// The real assembler, observed: the momentumData each build was handed.
vi.mock('../_utils/agentEvalPromptAssembly.js', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    buildLiveContextBlock: (...args) => {
      seen.momentum.push(args[7]);
      return real.buildLiveContextBlock(...args);
    },
  };
});
vi.mock('@anthropic-ai/sdk', () => ({ default: class AnthropicMock { constructor() { this.messages = { create: (...args) => mocks.create(...args) }; } } }));
vi.mock('../_utils/marketDataCache.js', () => ({
  getStockAnalysisData: mocks.getStockAnalysisData, fetchIntradayBatch: mocks.fetchIntradayBatch,
  fetchIntradayCandles: vi.fn(async () => []), filterToLatestSession: vi.fn((candles) => ({ candles: candles || [], sessionDate: '2026-09-09' })),
}));
vi.mock('../_utils/agentSwapExecution.js', async (importOriginal) => ({
  ...(await importOriginal()),
  executeSwapServer: executeSwapServerMock,
}));
vi.mock('../_utils/tournamentAgentLedger.js', () => ({ resolveTournamentContext: vi.fn(async () => null), excludeHeldByOthers: vi.fn(), excludeHeldSymbols: vi.fn(), reserveSymbol: vi.fn(), confirmSwap: vi.fn(), releaseReservation: vi.fn() }));
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

const NOW_MS = Date.parse(FROZEN_NOW);
const isoIn = (minutes) => new Date(NOW_MS + minutes * 60000).toISOString();
const LEAD = 'CRYPTO SLOT THIS CHECK: ';
const ANNOTATION = ' — you cannot swap it this check; hold';
const CANNOT = (held, reason) => `${LEAD}you cannot swap ${held} this check — ${reason}. Hold it.`;
const CAN = (held, bench, daily) => `${LEAD}you can swap ${held} for ${bench} (${bench} ${daily}% on the day, clears the hurdle). It needs conviction 70 or higher. Whether to do it is your call.`;

/** The harness book (analyst, balanced, BTC in support[2]) with ETH as the bench crypto. */
function cryptoBattle({ eth = {}, trades = [], cronState = {} } = {}) {
  const base = makeTickBattle();
  return {
    ...base,
    trades,
    scoreState: { ...base.scoreState, tradeCount: trades.length },
    cronState: { ...base.cronState, ...cronState },
    portfolio: {
      ...base.portfolio,
      bench: { ...base.portfolio.bench, crypto: { symbol: 'ETH', name: 'Ethereum', baseATR: 5, isCrypto: true, sector: 'Crypto', ...eth } },
      startingPrices: { ...base.portfolio.startingPrices, ETH: 2600 },
    },
  };
}
function pricesWith({ eth = 1.0, btc = 0.97, btcCurrent = 67450 } = {}) {
  const p = makePriceTable();
  p.ETH = { current: 2650, previousClose: 2600, changePercent: eth };
  p.BTC = { ...p.BTC, current: btcCurrent, changePercent: btc };
  p['BTC-USD.CC'] = { ...p['BTC-USD.CC'], current: btcCurrent, changePercent: btc };
  return p;
}
const recentSwap = (id, minutesAgo) => ({ id, symbolOut: 'KO', symbolIn: 'JPM', tier: 'support', swapDay: 1, entryPrice: 62.2, exitPrice: 62.0, lockedGainPct: -0.32, lockedPoints: -1, swappedOutAt: isoIn(-minutesAgo), exitReason: 'haiku_decision' });
/** BTC's stagnation counter already over the analyst's threshold, last ticked 5 minutes ago at today's price. */
const stagnantBtc = (price) => ({ stagnationTicks: { BTC: 10 }, lastTickPrice: { BTC: price }, lastTickTimestamp: { BTC: NOW_MS - 5 * 60000 } });
const BTC_TO_ETH = makeSwapResult({ symbolOut: 'BTC', symbolIn: 'ETH', tier: 'support', conviction: 90, status_feed_update: 'Rotating BTC → ETH.' });

async function runTick(battle, toolInput, prices) {
  const callsBefore = mocks.create.mock.calls.length;
  mocks.getStockAnalysisData.mockImplementation(async (symbol) => (prices[symbol] ? { price: prices[symbol], daily: [] } : {}));
  mocks.fetchIntradayBatch.mockImplementation(async () => ({ NVDA: makeIntradayCandles() }));
  mocks.create.mockImplementation(async () => makeToolUseResponse(toolInput));
  const db = makeTickDb({ battle, rankingsDoc: makeRankingsDoc(), techDocs: makeTechDocs() });
  const summary = { evaluated: 0, held: 0, triggered: 0, skipped: 0, swapped: 0 };
  await processAgentBattle(db, battle, summary, Date.now(), new Map(), { everEnabled: false });
  const finalUpdate = db.__updates.find((u) => Array.isArray(u.evaluations)) || null;
  const request = mocks.create.mock.calls[callsBefore]?.[0] ?? null;
  return {
    entry: finalUpdate ? finalUpdate.evaluations.at(-1) : null,
    request,
    live: request?.messages?.[2]?.content ?? '',
    momentum: seen.momentum.at(-1) ?? null,
    stored: db.__store.battle,
  };
}
const linesOf = (live) => live.split('\n').filter((l) => l.startsWith(LEAD));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(FROZEN_NOW));
  flagState.crypto = true;
  seen.momentum = [];
  mocks.getStockAnalysisData.mockReset(); mocks.fetchIntradayBatch.mockReset(); mocks.create.mockReset();
  executeSwapServerMock.mockReset();
  // Commits to the stored doc as the real executor does: the slot's occupant
  // replaced, the outgoing asset to the bench under a 24 h cooldown (a crypto
  // to bench.crypto), the trade appended with its exitReason.
  executeSwapServerMock.mockImplementation(async (dbArg, _id, _battle, tier, slotIndex, incoming, _day, _prices, metadata) => {
    const stored = dbArg.__store.battle;
    const outgoing = stored.portfolio[tier][slotIndex];
    const swapPrice = 2650;
    stored.portfolio[tier] = stored.portfolio[tier].map((a, i) => (i === slotIndex ? { ...incoming, swapPrice, swappedInAt: FROZEN_NOW, swappedInDay: 1 } : a));
    const benchOut = { ...outgoing, cooldownUntil: isoIn(24 * 60) };
    stored.portfolio.bench = outgoing.isCrypto
      ? { ...stored.portfolio.bench, crypto: benchOut }
      : { ...stored.portfolio.bench, stocks: [...(stored.portfolio.bench.stocks || []).filter((a) => a.symbol !== incoming.symbol), benchOut] };
    const closedTrade = { id: `trade_${(stored.trades || []).length + 1}`, symbolIn: incoming.symbol, symbolOut: outgoing.symbol, tier, swapDay: 1, swappedOutAt: FROZEN_NOW, entryPrice: 67000, exitPrice: 67450, lockedGainPct: 0.67, lockedPoints: 0, exitReason: metadata?.exitReason ?? null };
    stored.trades = [...(stored.trades || []), closedTrade];
    stored.scoreState = { ...stored.scoreState, tradeCount: (stored.scoreState?.tradeCount || 0) + 1 };
    return { closedTrade, incomingAsset: { ...incoming, swapPrice } };
  });
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('verdict = gate — the line the model is shown, and what the gates do with BTC → ETH on the same tick', () => {
  // [name, battle, prices, the line, the gate's own record of the hold (null: the swap executed)]
  const ROWS = [
    ['can swap', () => cryptoBattle(), pricesWith({ eth: 6.0 }), CAN('BTC', 'ETH', '+6.00'), null],
    ['LOCK', () => cryptoBattle(), pricesWith({ eth: 6.0, btcCurrent: 70015 }), CANNOT('BTC', 'BTC is LOCKED'), 'BTC is LOCKED (near bonus threshold) — swap blocked'],
    ['cooldown', () => cryptoBattle({ eth: { cooldownUntil: isoIn(12 * 60) } }), pricesWith({ eth: 6.0 }), CANNOT('BTC', 'ETH was swapped out less than 24 hours ago and is on cooldown'), 'symbolIn "ETH" is on 24h cooldown until'],
    ['not up', () => cryptoBattle(), pricesWith({ eth: -1.0 }), CANNOT('BTC', 'ETH is -1.00% on the day, and an incoming crypto must be up on the day'), 'ETH below haiku_decision hurdle floor (bench_not_positive)'],
    ['margin', () => cryptoBattle(), pricesWith({ eth: 1.0 }), CANNOT('BTC', 'ETH is up +1.00% on the day but does not clear BTC by the hurdle margin'), 'ETH below haiku_decision hurdle floor (below_floor)'],
    ['swap cap', () => cryptoBattle({ trades: [recentSwap('t1', 5), recentSwap('t2', 15), recentSwap('t3', 25), recentSwap('t4', 40)] }), pricesWith({ eth: 6.0 }), CANNOT('BTC', 'you have reached the swap limit for this window'), 'Swap cap reached (4/60min) — swap blocked'],
  ];

  it.each(ROWS)('%s: the request carries exactly that line, and the gates agree', async (_name, battle, prices, line, heldBy) => {
    const { entry, live, request } = await runTick(battle(), BTC_TO_ETH, prices);
    expect(request, 'the model was called').not.toBeNull();
    expect(linesOf(live)).toEqual([line]);
    expect(JSON.stringify(request.messages.slice(0, 2))).not.toContain(LEAD);
    expect(request.system).toContain('━━━ YOUR CRYPTO SLOT ━━━');
    if (heldBy === null) {
      expect(executeSwapServerMock).toHaveBeenCalledTimes(1);
      const [, , , tier, slotIndex, incoming] = executeSwapServerMock.mock.calls[0];
      expect([tier, slotIndex, incoming.symbol]).toEqual(['support', 2, 'ETH']);
      expect(entry.decision).toBe('SWAP');
      expect(entry.downgraded).toBe(false);
    } else {
      expect(executeSwapServerMock).not.toHaveBeenCalled();
      expect(entry.decision).toBe('HOLD');
      expect(entry.downgraded).toBe(true);
      expect(entry.validationErrors.join(' | ')).toContain(heldBy);
      expect(entry.validationErrors).toHaveLength(1); // the FIRST failing gate, and only it, is what production records
    }
  });

  it('the tempo dial: at "measured" the cap is 3 per 60 min — the verdict uses the clamped config the gate uses, and they agree', async () => {
    const measured = () => {
      const b = cryptoBattle({ trades: [recentSwap('t1', 5), recentSwap('t2', 15), recentSwap('t3', 25)] });
      return { ...b, agentContext: { ...b.agentContext, dials: { tempo: 'measured' } } };
    };
    const { entry, live } = await runTick(measured(), BTC_TO_ETH, pricesWith({ eth: 6.0 }));
    expect(linesOf(live)).toEqual([CANNOT('BTC', 'you have reached the swap limit for this window')]);
    expect(executeSwapServerMock).not.toHaveBeenCalled();
    expect(entry.validationErrors).toEqual([expect.stringContaining('Swap cap reached (3/60min)')]);
    // Control: the same three swaps at the standard tempo (cap 4) — you can swap, and it executes.
    executeSwapServerMock.mockClear();
    const standard = await runTick(cryptoBattle({ trades: [recentSwap('t1', 5), recentSwap('t2', 15), recentSwap('t3', 25)] }), BTC_TO_ETH, pricesWith({ eth: 6.0 }));
    expect(linesOf(standard.live)).toEqual([CAN('BTC', 'ETH', '+6.00')]);
    expect(executeSwapServerMock).toHaveBeenCalledTimes(1);
  });

  it('the line sits immediately before RISK STATUS when that block renders', async () => {
    const { live } = await runTick(cryptoBattle(), BTC_TO_ETH, pricesWith({ eth: 6.0, btcCurrent: 70015 }));
    expect(live).toContain(`${CANNOT('BTC', 'BTC is LOCKED')}\n\nRISK STATUS:\n`);
  });
});

describe('the RISK STATUS annotation on a real stagnation SWAP_OUT', () => {
  it('BTC stagnant, ETH down: the forced rotation finds no replacement, the line says you cannot swap, and BTC\'s SWAP_OUT line says so too', async () => {
    const { live, entry } = await runTick(cryptoBattle({ cronState: stagnantBtc(67450) }), BTC_TO_ETH, pricesWith({ eth: -1.0, btc: -0.5 }));
    expect(linesOf(live)).toEqual([CANNOT('BTC', 'ETH is -1.00% on the day, and an incoming crypto must be up on the day')]);
    expect(live).toContain(`\nBTC: SWAP_OUT (stagnation)${ANNOTATION}`);
    expect(live.split(ANNOTATION)).toHaveLength(2);
    expect(executeSwapServerMock).not.toHaveBeenCalled();
    expect(entry.validationErrors.join(' | ')).toContain('bench_not_positive');
  });

  it('a "can swap" verdict never annotates: BTC stagnant but ETH clears the model\'s floor (0.4) and not the rotation\'s (0.5) — and the gate agrees: the model\'s swap executes', async () => {
    // BTC −0.5, ATR 5: the rotation needs ETH ≥ +2.00; the model's swap needs ≥ +1.50.
    // The rotation is vetoed before the prompt; the model's own BTC → ETH then
    // clears the gate's haiku_decision floor — a gate run at the rotation's
    // reason would refuse it (review RV-23, refuter E8(d)).
    const { live, entry } = await runTick(cryptoBattle({ cronState: stagnantBtc(67450) }), BTC_TO_ETH, pricesWith({ eth: 1.8, btc: -0.5 }));
    expect(linesOf(live)).toEqual([CAN('BTC', 'ETH', '+1.80')]);
    expect(live).toContain('\nBTC: SWAP_OUT (stagnation)\n');
    expect(live).not.toContain(ANNOTATION);
    expect(executeSwapServerMock).toHaveBeenCalledTimes(1);
    expect(executeSwapServerMock.mock.calls[0][5].symbol).toBe('ETH');
    expect(entry.decision).toBe('SWAP');
    expect(entry.downgraded).toBe(false);
  });
});

describe('the verdict sees what the tick already did — computed after the forced-exit rebuild', () => {
  it('a stagnation rotation that EXECUTES BTC → ETH before the prompt: the line is about ETH, with BTC on cooldown — and the gate agrees', async () => {
    const { live, entry } = await runTick(
      cryptoBattle({ cronState: stagnantBtc(67450) }),
      makeSwapResult({ symbolOut: 'ETH', symbolIn: 'BTC', tier: 'support', conviction: 90 }),
      pricesWith({ eth: 6.0, btc: -0.5 }),
    );
    expect(executeSwapServerMock).toHaveBeenCalledTimes(1); // the rotation, before the model
    expect(linesOf(live)).toEqual([CANNOT('ETH', 'BTC was swapped out less than 24 hours ago and is on cooldown')]);
    expect(entry.decision).toBe('HOLD');
    expect(entry.validationErrors.join(' | ')).toContain('symbolIn "BTC" is on 24h cooldown until');
  });
});

describe('flag off — nothing reaches the model and momentumData never carries the key', () => {
  it.each([
    ['not up', () => cryptoBattle(), pricesWith({ eth: -1.0 })],
    ['can swap', () => cryptoBattle(), pricesWith({ eth: 6.0 })],
    ['stagnation SWAP_OUT', () => cryptoBattle({ cronState: stagnantBtc(67450) }), pricesWith({ eth: -1.0, btc: -0.5 })],
  ])('%s', async (_name, battle, prices) => {
    flagState.crypto = false;
    const { live, momentum, request } = await runTick(battle(), BTC_TO_ETH, prices);
    expect(request).not.toBeNull();
    expect(momentum).not.toBeNull();
    expect(Object.prototype.hasOwnProperty.call(momentum, 'cryptoSlotVerdict')).toBe(false);
    expect(live).not.toContain('CRYPTO SLOT');
    expect(live).not.toContain(ANNOTATION);
    expect(request.system).not.toContain('YOUR CRYPTO SLOT');
  });

  it('flag on, the same tick: the key is there and holds the verdict the line printed', async () => {
    const { momentum } = await runTick(cryptoBattle(), BTC_TO_ETH, pricesWith({ eth: -1.0 }));
    expect(momentum.cryptoSlotVerdict).toEqual({ held: 'BTC', bench: 'ETH', canSwap: false, reason: 'not_up', benchDailyPct: -1.0 });
  });

  it('flag on, no bench crypto (the harness book as shipped): no verdict, no key, no line', async () => {
    const base = makeTickBattle();
    const { live, momentum } = await runTick(base, makeSwapResult(), makePriceTable());
    expect(Object.prototype.hasOwnProperty.call(momentum, 'cryptoSlotVerdict')).toBe(false);
    expect(live).not.toContain(LEAD);
  });
});
