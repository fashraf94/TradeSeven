// @vitest-environment jsdom
// src/screens/AgentBattleScreen.enrichFirstDay.test.jsx
//
// BaggerBomb cleanup C2 (review CL1-1; BUILD_RULES §9): the battle screen's held-position card mirrors the
// server's day-1 badge gate (its own comment says so). A tiered battle deployed in the last 45 minutes before a
// close plays the NEXT session (BR-2): its activation day is `timing.tradingDays[0]`, and on that day the card's
// badge baseline is the creation price, like the crons now. Before the fix the card baselined at the previous
// close and showed a phantom Bust/Crash on a position that sat flat from entry.
//
// The REAL enrichHeldPosition and the REAL scorer run; only the Firebase config import is a double.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
vi.mock('../firebase/config', () => ({ db: {}, auth: {}, default: {} }));
import { enrichHeldPosition } from './AgentBattleScreen.jsx';

const TUE_10AM_ET = '2026-10-27T14:00:00.000Z';
const MON_320PM_ET = '2026-10-26T19:20:00.000Z';
const TUE_9AM_ET = '2026-10-27T13:00:00.000Z';

// Bought at 100, ATR 2.5, star tier; Tuesday 10:00 it trades at 99 against Monday's close of 103.
const asset = () => ({ symbol: 'XYZ', baseATR: 2.5, isCrypto: false });
const input = (battle) => ({
  curPrice: 99, previousClose: 103, startingPrices: { XYZ: 100 }, thresholds: { XYZ: { threshold: 2.5 } }, thresholdHistory: {},
  activatedAt: battle.activatedAt, createdAt: battle.createdAt, stockBattle: battle,
});
const battle = (over) => ({ id: 'b-1', status: 'active', gameMode: 'baggerbomb_agent', duration: 'fullday', timing: { tradingDays: ['2026-10-27'] }, ...over });
const row = (b) => enrichHeldPosition(asset(), 'star', input(b));

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(TUE_10AM_ET)); });
afterEach(() => { vi.useRealTimers(); });

describe('C2 — the held-position card follows the first trading day', () => {
  it('a next-session battle (deployed Mon 3:20 PM ET) on its Tuesday: baselined at the creation price — no phantom Bust or Crash', () => {
    const next = row(battle({ activatedAt: MON_320PM_ET, createdAt: MON_320PM_ET }));
    expect(next.badges ?? []).toEqual([]);
    // The same position on a same-day battle (deployed Tuesday 9:00 AM ET) is the reference: identical card.
    const sameDay = row(battle({ activatedAt: TUE_9AM_ET, createdAt: TUE_9AM_ET }));
    expect(sameDay.badges ?? []).toEqual([]);
    expect(next.points).toBe(sameDay.points);
    expect(next.priceChange).toBe(sameDay.priceChange);
  });

  it('from the second day on it falls back to the previous close, as before (a first day that is already past)', () => {
    const second = row(battle({ activatedAt: MON_320PM_ET, createdAt: MON_320PM_ET, timing: { tradingDays: ['2026-10-26', '2026-10-27'] } }));
    expect(second.badges.length).toBeGreaterThan(0); // 99 against the 103 close is a deep loss
    expect(second.points).toBeLessThan(0);
  });

  it('a tournament battle is unchanged: activatedAt decides, whatever its list says', () => {
    const tournament = row(battle({ gameMode: 'baggerbomb_tournament', activatedAt: MON_320PM_ET, createdAt: MON_320PM_ET }));
    expect(tournament.badges.length).toBeGreaterThan(0); // Monday's activation, so Tuesday baselines at the previous close
    const legacyNoList = row(battle({ activatedAt: MON_320PM_ET, createdAt: MON_320PM_ET, timing: {} }));
    expect(legacyNoList.points).toBe(tournament.points); // no list: the activatedAt fallback, identical
  });
});
