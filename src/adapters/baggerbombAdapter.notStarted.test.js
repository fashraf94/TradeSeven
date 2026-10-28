// src/adapters/baggerbombAdapter.notStarted.test.js
//
// BaggerBomb cleanup C5 (Flash, Oct 27, 2026; #998 MT1-8, #995 BRC-5): honest
// status for a battle that has not started. A tiered battle created in the last
// 45 minutes before a close, or overnight, plays the NEXT session (BR-2): until
// the ET date reaches `timing.tradingDays[0]` the client no longer calls it LIVE
// during the creation afternoon. Its phase is PRE_OPEN and ONE adapter field,
// `startsAtEt`, says when it starts — "Tue 9:30 AM ET", read from the calendar
// of record (never from getMarketState's wall-clock Dates) — and the Desk
// posture and the Battle View turn line both read that field.
//
// Every case injects its own `now` and `marketState` (the adapter's rule); the
// predicate is the one the crons use (src/utils/tieredFirstTradingDay.js).

import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildBaggerbombAdapter, deriveStartsAtEt, derivePhase, notStartedYet, PHASE } from './baggerbombAdapter.js';
import { deriveTurnLine, TURN_STATE } from '../screens/battleView/deriveTurnLine.js';
import { DESK_COPY } from '../components/Dashboard/desk/deskCopy.js';
import { etWallClockToMs } from '../utils/marketCalendar.js';

const ET = (date, h, m = 0) => etWallClockToMs(date, h, m);
const OPEN = { isOpen: true, state: 'OPEN' };
const AFTER = { isOpen: false, state: 'CLOSED_AFTERHOURS' };
const WEEKEND = { isOpen: false, state: 'CLOSED_WEEKEND' };
const PRE = { isOpen: false, state: 'PRE_MARKET' };

function battle(tradingDays, over = {}) {
  return {
    id: 'b-1', status: 'active', gameMode: 'baggerbomb_agent', duration: 'fullday',
    activatedAt: '2026-10-26T19:20:00.000Z',
    agentContext: { agentName: 'Aurora' },
    timing: { tradingDays },
    scoreState: {},
    portfolio: { star: [{ symbol: 'SLB' }], core: [], support: [], startingPrices: { SLB: 34 } },
    ...over,
  };
}

describe('C5 — a battle before its first trading day is not LIVE', () => {
  it('a weekday afternoon (market OPEN): PRE_OPEN, "Starts Tue 9:30 AM ET"', () => {
    const b = battle(['2026-10-27']); // created Mon 15:20 ET
    const now = ET('2026-10-26', 15, 30);
    expect(derivePhase(b, OPEN, now)).toBe(PHASE.PRE_OPEN);
    expect(deriveStartsAtEt(b, now)).toBe('Tue 9:30 AM ET');
    const sync = buildBaggerbombAdapter(b, null, null, now, OPEN);
    expect(sync.phase).toBe(PHASE.PRE_OPEN);
    expect(sync.startsAtEt).toBe('Tue 9:30 AM ET');
    expect(sync.nextDecisionAt).toBe(null); // LIVE only
  });

  it('a weekday evening (market closed): the same, with no "first check" claim for today', () => {
    const b = battle(['2026-10-27']);
    const now = ET('2026-10-26', 19, 0);
    expect(derivePhase(b, AFTER, now)).toBe(PHASE.PRE_OPEN);
    expect(deriveStartsAtEt(b, now)).toBe('Tue 9:30 AM ET');
  });

  it('a Friday evening: "Starts Mon 9:30 AM ET" — across the Nov 1 clock change', () => {
    const b = battle(['2026-11-02']); // created Fri Oct 30 15:20 ET
    for (const [now, ms] of [[ET('2026-10-30', 15, 30), OPEN], [ET('2026-10-30', 21, 0), AFTER], [ET('2026-10-31', 12, 0), WEEKEND], [ET('2026-11-01', 12, 0), WEEKEND]]) {
      expect(derivePhase(b, ms, now), String(now)).toBe(PHASE.PRE_OPEN);
      expect(deriveStartsAtEt(b, now), String(now)).toBe('Mon 9:30 AM ET');
    }
  });

  it('a holiday eve: the session after Thanksgiving — "Starts Fri 9:30 AM ET"', () => {
    const b = battle(['2026-11-27']); // created Wed Nov 25 15:20 ET; Thu Nov 26 is closed
    const now = ET('2026-11-25', 15, 30);
    expect(derivePhase(b, OPEN, now)).toBe(PHASE.PRE_OPEN);
    expect(deriveStartsAtEt(b, now)).toBe('Fri 9:30 AM ET');
    expect(deriveStartsAtEt(b, ET('2026-11-26', 12, 0))).toBe('Fri 9:30 AM ET'); // the holiday itself
  });

  it('the line comes from the calendar of record, not from getMarketState: a wrong nextOpenTime changes nothing', () => {
    const b = battle(['2026-10-27']);
    const now = ET('2026-10-26', 15, 30);
    const skewed = { ...OPEN, nextOpenTime: new Date(2026, 9, 29, 9, 30) }; // Thu — a lie
    expect(buildBaggerbombAdapter(b, null, null, now, skewed).startsAtEt).toBe('Tue 9:30 AM ET');
  });

  it('on its first trading day it is LIVE again (evaluated) and says nothing about a start', () => {
    const b = battle(['2026-10-27'], { scoreState: { evaluationCount: 3, lastScoredAt: '2026-10-27T14:00:00.000Z' } });
    const now = ET('2026-10-27', 10, 30);
    expect(derivePhase(b, OPEN, now)).toBe(PHASE.LIVE);
    expect(deriveStartsAtEt(b, now)).toBe(null);
    expect(buildBaggerbombAdapter(b, null, null, now, OPEN).startsAtEt).toBe(null);
  });

  it('before the open on its first day: the ordinary PRE_OPEN, no "Starts" line (it starts today)', () => {
    const b = battle(['2026-10-27']);
    const now = ET('2026-10-27', 8, 0);
    expect(notStartedYet(b, now)).toBe(false);
    expect(derivePhase(b, PRE, now)).toBe(PHASE.PRE_OPEN);
    expect(deriveStartsAtEt(b, now)).toBe(null);
  });

  it('a same-day battle is unchanged: LIVE the afternoon it is created', () => {
    const b = battle(['2026-10-27'], { scoreState: { evaluationCount: 1, lastScoredAt: '2026-10-27T14:00:00.000Z' } });
    expect(derivePhase(b, OPEN, ET('2026-10-27', 11, 0))).toBe(PHASE.LIVE);
  });

  // Review CL3-6: the real clock is faked to Oct 26, BEFORE the battle's first day, so a derivePhase that fell back
  // to Date.now() when given no clock would read PRE_OPEN here — and this row would go red.
  afterEach(() => { vi.useRealTimers(); });
  it('with no clock the phase is exactly what it was — nothing is read', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(ET('2026-10-26', 15, 30)));
    const b = battle(['2026-10-27']);
    expect(derivePhase(b, OPEN)).toBe(PHASE.LIVE);
    expect(derivePhase(b, OPEN, null)).toBe(PHASE.LIVE);
    expect(derivePhase(b, OPEN, NaN)).toBe(PHASE.LIVE);
    expect(deriveStartsAtEt(b, undefined)).toBe(null);
  });

  it('a tournament battle and a battle with no list are never "not started"', () => {
    const now = ET('2026-10-26', 15, 30);
    const tournament = battle(['2026-10-27'], { gameMode: 'baggerbomb_tournament' });
    expect(derivePhase(tournament, OPEN, now)).toBe(PHASE.LIVE);
    expect(deriveStartsAtEt(tournament, now)).toBe(null);
    for (const tradingDays of [undefined, [], ['Oct 27']]) {
      const b = battle(tradingDays);
      expect(derivePhase(b, OPEN, now), JSON.stringify(tradingDays)).toBe(PHASE.LIVE);
    }
  });

  it('a completed battle is POST_CLOSE whatever its list says, and starts nothing (review CL3-7)', () => {
    const done = battle(['2026-10-27'], { status: 'completed' });
    expect(derivePhase(done, OPEN, ET('2026-10-26', 15, 30))).toBe(PHASE.POST_CLOSE);
    expect(deriveStartsAtEt(done, ET('2026-10-26', 15, 30))).toBe(null);
    expect(buildBaggerbombAdapter(done, null, null, ET('2026-10-26', 15, 30), OPEN).startsAtEt).toBe(null);
  });

  it('a day outside the maintained calendar is still not LIVE, but names no time', () => {
    const b = battle(['2031-01-06']);
    const now = ET('2026-10-26', 15, 30);
    expect(derivePhase(b, OPEN, now)).toBe(PHASE.PRE_OPEN);
    expect(deriveStartsAtEt(b, now)).toBe(null);
  });
});

describe('C5 — the Desk and the Battle View turn line say the same "Starts" sentence', () => {
  it('the turn line: preOpen state, "Starts Tue 9:30 AM ET"', () => {
    const t = deriveTurnLine(battle(['2026-10-27']), ET('2026-10-26', 15, 30), OPEN);
    expect(t.state).toBe(TURN_STATE.PRE_OPEN);
    expect(t.phase).toBe(PHASE.PRE_OPEN);
    expect(t.text).toBe('Starts Tue 9:30 AM ET');
    expect(t.text).toBe(DESK_COPY.postureStarts('Tue 9:30 AM ET'));
  });

  it('a same-day pre-open battle keeps "First check at 9:30 AM ET"', () => {
    const t = deriveTurnLine(battle(['2026-10-27']), ET('2026-10-27', 8, 0), PRE);
    expect(t.state).toBe(TURN_STATE.PRE_OPEN);
    expect(t.text).toBe(DESK_COPY.posturePreOpen);
  });

  it('postureStarts degrades to the same-day line when no time is known', () => {
    for (const none of [null, undefined, '']) expect(DESK_COPY.postureStarts(none)).toBe(DESK_COPY.posturePreOpen);
  });
});
