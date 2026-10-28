// src/components/CommandCenter/hub/gamesDisplay.notStarted.test.js
//
// BaggerBomb cleanup C5 (Flash, Oct 27, 2026; #998 MT1-8, #995 BRC-5): the hub's
// live row for a game that has not started. A game deployed in the last 45
// minutes before a close, or overnight, plays the NEXT session; before its first
// trading day the row is waiting, not live — "Starts Tue 9:30 AM ET" in the
// place of a countdown — and its end time names the day when it is not today
// ("ends Tue 8:00 PM ET"). The predicate and the start text are the adapter's
// (the same ones the crons and the Desk use); the only clock is the `nowMs` the
// row already takes.

import { describe, expect, it } from 'vitest';
import { HUB_COPY as COPY } from './hubCopy';
import { formatHubTimeOnDay } from './hubDate';
import { liveGameRows } from './gamesDisplay';
import { etWallClockToMs } from '../../../utils/marketCalendar';

const ET = (date, h, m = 0) => etWallClockToMs(date, h, m);
const OPEN = { state: 'OPEN', isOpen: true };
const AFTER = { state: 'CLOSED_AFTERHOURS', isOpen: false };
const WEEKEND = { state: 'CLOSED_WEEKEND', isOpen: false };

/** A tiered game whose only trading day is `day`, ending 8:00 PM ET that day. */
function game(day, over = {}) {
  return {
    id: `g-${day}`, status: 'active', gameMode: 'baggerbomb_agent', duration: 'fullday',
    timing: { tradingDays: [day] }, expiresAt: new Date(ET(day, 20, 0)).toISOString(),
    scoreState: { currentScore: 0, tradeCount: 0 }, ...over,
  };
}
const rowOf = (battle, nowMs, marketState) => liveGameRows([battle], { nowMs, marketState })[0];

describe('C5 — a game before its first trading day is waiting, and says when it starts', () => {
  it('deployed Monday 3:20 PM ET, seen at 3:30 PM (market open): waiting, "Starts Tue 9:30 AM ET", ends Tuesday', () => {
    const row = rowOf(game('2026-10-27'), ET('2026-10-26', 15, 30), OPEN);
    expect(row.preOpen).toBe(true);
    expect(row.clock).toBe('Starts Tue 9:30 AM ET');
    expect(row.detail).toBe('Score 0.0 · 0 trades · ends Tue 8:00 PM ET');
    expect(row.live).toBe(true);
  });

  it('seen Monday evening (market closed): the same row', () => {
    const row = rowOf(game('2026-10-27'), ET('2026-10-26', 21, 0), AFTER);
    expect(row.preOpen).toBe(true);
    expect(row.clock).toBe('Starts Tue 9:30 AM ET');
    expect(row.detail).toContain('ends Tue 8:00 PM ET');
  });

  it('a Friday evening: "Starts Mon 9:30 AM ET", ends Monday — also over the weekend', () => {
    for (const [nowMs, ms] of [[ET('2026-10-30', 15, 30), OPEN], [ET('2026-10-30', 21, 0), AFTER], [ET('2026-10-31', 12, 0), WEEKEND]]) {
      const row = rowOf(game('2026-11-02'), nowMs, ms);
      expect(row.clock).toBe('Starts Mon 9:30 AM ET');
      expect(row.detail).toContain('ends Mon 8:00 PM ET');
    }
  });

  it('a holiday eve: "Starts Fri 9:30 AM ET", ends Friday', () => {
    const row = rowOf(game('2026-11-27'), ET('2026-11-25', 15, 30), OPEN);
    expect(row.preOpen).toBe(true);
    expect(row.clock).toBe('Starts Fri 9:30 AM ET');
    expect(row.detail).toContain('ends Fri 8:00 PM ET');
  });

  it('the strip line reads "Deployed · Starts Tue 9:30 AM ET", never "Live"', () => {
    const row = rowOf(game('2026-10-27'), ET('2026-10-26', 15, 30), OPEN);
    expect(COPY.strip.deployed(row.clock)).toBe('Deployed · Starts Tue 9:30 AM ET');
  });

  it('on its first trading day it is live with a countdown, and the end time is today\'s: no weekday', () => {
    const row = rowOf(game('2026-10-27', { scoreState: { currentScore: 1.2, tradeCount: 2, evaluationCount: 4 } }), ET('2026-10-27', 10, 0), OPEN);
    expect(row.preOpen).toBe(false);
    expect(row.clock).toBe('10h 0m left');
    expect(row.detail).toBe('Score +1.2 · 2 trades · ends 8:00 PM ET');
  });

  it('before the open on its first day: the ordinary waiting row, with no "Starts" line', () => {
    const row = rowOf(game('2026-10-27'), ET('2026-10-27', 8, 0), { state: 'PRE_MARKET', isOpen: false });
    expect(row.preOpen).toBe(true);
    expect(row.clock).toBe(COPY.games.waitingForOpen);
  });

  it('a same-day game is unchanged: live the afternoon it is deployed, "ends 8:00 PM ET"', () => {
    const row = rowOf(game('2026-10-27', { scoreState: { currentScore: 0, tradeCount: 0, evaluationCount: 1 } }), ET('2026-10-27', 11, 0), OPEN);
    expect(row.preOpen).toBe(false);
    expect(row.detail).toBe('Score 0.0 · 0 trades · ends 8:00 PM ET');
  });

  it('a tournament row is unchanged: it is not "starting", whatever its list says', () => {
    const row = rowOf(game('2026-10-27', { gameMode: 'baggerbomb_tournament', scoreState: { currentScore: 0, tradeCount: 0, evaluationCount: 1 } }), ET('2026-10-26', 15, 30), OPEN);
    expect(row.preOpen).toBe(false);
    expect(row.clock).not.toMatch(/^Starts/);
  });

  it('a game whose first day is outside the calendar is waiting, with the plain words', () => {
    const row = rowOf(game('2031-01-06'), ET('2026-10-26', 15, 30), OPEN);
    expect(row.preOpen).toBe(true);
    expect(row.clock).toBe(COPY.games.waitingForOpen);
  });

  it('a count of waiting games includes it (the hub counts preOpen rows apart from live ones)', () => {
    const rows = liveGameRows([game('2026-10-27'), game('2026-10-26', { scoreState: { evaluationCount: 2 } })], { nowMs: ET('2026-10-26', 15, 30), marketState: OPEN });
    expect(rows.filter((r) => r.preOpen)).toHaveLength(1);
    expect(rows.filter((r) => !r.preOpen)).toHaveLength(1);
  });
});

describe('formatHubTimeOnDay — the end time names the day only when it is not today', () => {
  const END = Date.parse('2026-10-28T00:00:00.000Z'); // Tue Oct 27, 8:00 PM EDT
  it('the same ET day: the bare time', () => {
    expect(formatHubTimeOnDay(END, ET('2026-10-27', 10, 0))).toBe('8:00 PM');
    expect(formatHubTimeOnDay(END, ET('2026-10-27', 23, 59))).toBe('8:00 PM');
  });
  it('another ET day: the weekday first — judged on the ET date, not the UTC date', () => {
    expect(formatHubTimeOnDay(END, ET('2026-10-26', 15, 30))).toBe('Tue 8:00 PM');
    expect(formatHubTimeOnDay(END, ET('2026-10-28', 0, 5))).toBe('Tue 8:00 PM'); // already Wednesday in ET
    expect(formatHubTimeOnDay(END, END + 3600_000)).toBe('8:00 PM'); // 9 PM ET Tuesday, though Wednesday in UTC
  });
  it('with no usable now it is the bare time, as it was; with no time it is empty', () => {
    for (const bad of [null, undefined, NaN, '2026-10-27']) expect(formatHubTimeOnDay(END, bad)).toBe('8:00 PM');
    for (const bad of [null, undefined, NaN, '2026-10-27']) expect(formatHubTimeOnDay(bad, ET('2026-10-27', 10, 0))).toBe('');
  });
});
