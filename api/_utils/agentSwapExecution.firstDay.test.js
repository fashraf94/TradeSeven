// api/_utils/agentSwapExecution.firstDay.test.js
//
// BaggerBomb cleanup C2 — the founder-sanctioned fence contact (Oct 28, 2026), limited to Guard 3's
// activation-day expression in executeSwapServer: a tiered battle's activation day is
// `timing.tradingDays[0]`, else `activatedAt`. A battle deployed in the last 45 minutes before a close plays the
// NEXT session (BR-2); on that day agent-evaluate.js scores badges from the creation price
// (`portfolio.startingPrices`). Before this change Guard 3 baselined a swapped-out, held-from-start position at
// the previous close on that day, so a swap locked fewer points than the live card showed (creation 100, Monday
// close 103, Tuesday 104: card 125, lock 80).
//
// The REAL executeSwapServer and the REAL scorer run over the same in-memory Firestore double the sibling
// executor tests use; only the daily-series fetch and the clock are doubles. Tournaments and other modes
// carry a `tradingDays` list too and must be byte-identical.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./marketDataCache.js', () => ({ getStockAnalysisData: vi.fn() }));

import { executeSwapServer } from './agentSwapExecution.js';
import { getStockAnalysisData } from './marketDataCache.js';

const TUE_10AM_ET = '2026-10-27T14:00:00.000Z';
const MON_320PM_ET = '2026-10-26T19:20:00.000Z';
const TUE_9AM_ET = '2026-10-27T13:00:00.000Z';

// Bought at 100 (a held-from-start star, ATR 2.5); Tuesday 10:00 it quotes 104 against Monday's close of 103.
const PRICES = { MU: { current: 104, previousClose: 103 }, AMD: { current: 150 } };
const BENCH = { symbol: 'AMD', name: 'AMD', baseATR: 2.5, isCrypto: false };

function battleData(over = {}) {
  return {
    status: 'active', gameMode: 'baggerbomb_agent',
    portfolio: {
      star: [{ symbol: 'MU', name: 'Micron', baseATR: 2.5, isCrypto: false }], // held from the start: no swapPrice
      core: [], support: [],
      bench: { stocks: [{ symbol: 'AMD', name: 'AMD', baseATR: 2.5, isCrypto: false }], crypto: null },
      startingPrices: { MU: 100 },
    },
    scoring: { thresholds: { MU: { threshold: 2.5 } } },
    thresholdHistory: { MU: { maxMultiplier: 0, minMultiplier: 0 } },
    trades: [], scoreState: { tradeCount: 0 },
    ...over,
  };
}

async function swapAt(liveData) {
  let updates = null;
  const ref = {};
  const tx = { get: async () => ({ exists: true, data: () => liveData }), update: (_r, u) => { updates = u; } };
  const db = { collection: () => ({ doc: () => ref }), runTransaction: async (fn) => fn(tx) };
  await executeSwapServer(db, 'battle-1', liveData, 'star', 0, BENCH, 3, PRICES, { id: 'trade_fd', action: 'SWAP' });
  return updates.trades.at(-1);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(TUE_10AM_ET));
  getStockAnalysisData.mockReset().mockResolvedValue({ daily: [{ date: '2026-10-26', rawClose: 103, close: 103, high: 104, low: 102 }] });
});
afterEach(() => { vi.useRealTimers(); });

describe('Guard 3 — the activation day follows the first trading day (tiered battles)', () => {
  it('a next-session battle (deployed Mon 3:20 PM ET) swapped on its Tuesday locks the same points as a same-day battle on the same quotes', async () => {
    const next = await swapAt(battleData({ activatedAt: MON_320PM_ET, timing: { tradingDays: ['2026-10-27'] } }));
    const sameDay = await swapAt(battleData({ activatedAt: TUE_9AM_ET, timing: { tradingDays: ['2026-10-27'] } }));
    expect(sameDay.lockedPoints).toBeGreaterThan(0); // +4% from the creation price is a scoring move
    expect(next.lockedPoints).toBe(sameDay.lockedPoints);
    expect(next.lockedGainPct).toBe(sameDay.lockedGainPct);
  });

  it('it is the creation price that scores: the lock is not the previous-close baseline\'s (the old, smaller lock)', async () => {
    const next = await swapAt(battleData({ activatedAt: MON_320PM_ET, timing: { tradingDays: ['2026-10-27'] } }));
    // The same battle read the old way: no list, so activatedAt (Monday) decides and Tuesday is "day 2".
    const old = await swapAt(battleData({ activatedAt: MON_320PM_ET }));
    expect(next.lockedPoints).toBeGreaterThan(old.lockedPoints);
  });

  it('on the first trading day the daily reference is not fetched (the creation price needs none)', async () => {
    await swapAt(battleData({ activatedAt: MON_320PM_ET, timing: { tradingDays: ['2026-10-27'] } }));
    expect(getStockAnalysisData).not.toHaveBeenCalled();
    getStockAnalysisData.mockClear();
    await swapAt(battleData({ activatedAt: MON_320PM_ET })); // no list: the previous-close path, as before
    expect(getStockAnalysisData).toHaveBeenCalledWith('MU', expect.objectContaining({ forceRefresh: true }));
  });

  it('from the second day on the baseline is the previous close, as before (a first day that is already past)', async () => {
    const second = await swapAt(battleData({ activatedAt: MON_320PM_ET, timing: { tradingDays: ['2026-10-26', '2026-10-27'] } }));
    const noList = await swapAt(battleData({ activatedAt: MON_320PM_ET }));
    expect(second.lockedPoints).toBe(noList.lockedPoints);
  });

  it('a battle with no usable list falls back to activatedAt', async () => {
    const base = await swapAt(battleData({ activatedAt: MON_320PM_ET }));
    for (const timing of [{}, { tradingDays: [] }, { tradingDays: ['Oct 27'] }, { tradingDays: [null] }]) {
      expect((await swapAt(battleData({ activatedAt: MON_320PM_ET, timing }))).lockedPoints, JSON.stringify(timing)).toBe(base.lockedPoints);
    }
  });

  it('a tournament battle is byte-identical: its list, whatever it says, changes nothing', async () => {
    const withList = await swapAt(battleData({ gameMode: 'baggerbomb_tournament', activatedAt: MON_320PM_ET, timing: { tradingDays: ['2026-10-27'] } }));
    const noList = await swapAt(battleData({ gameMode: 'baggerbomb_tournament', activatedAt: MON_320PM_ET }));
    expect(withList).toEqual(noList);
  });
});
