// src/utils/tieredFirstTradingDay.test.js
//
// BaggerBomb cleanup C1 / C5 (Oct 27, 2026). The shared first-trading-day
// predicate and the first session's open.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): api/cron/agent-evaluate.js and
// api/cron/agent-daily-scores.js import ../../src/utils/tieredFirstTradingDay.js,
// and the browser surfaces import it too. This file imports it for real —
// never mocked — so a browser-only dependency entering its import graph
// explodes here, in the Node test environment.

import { describe, expect, it } from 'vitest';
import {
  beforeFirstTradingDay, etDateOf, firstSessionOpenMs, firstTradingDayOf, isTieredBattle,
} from './tieredFirstTradingDay.js';

const SEP9 = '2026-09-09';
const SEP10 = '2026-09-10';
const tiered = (days, extra = {}) => ({ gameMode: 'baggerbomb_agent', timing: { tradingDays: days }, ...extra });

describe('isTieredBattle / firstTradingDayOf', () => {
  it('a document with no gameMode is the original tiered game', () => {
    expect(isTieredBattle({})).toBe(true);
    expect(isTieredBattle({ gameMode: null })).toBe(true);
    expect(isTieredBattle({ gameMode: 'baggerbomb_agent' })).toBe(true);
    expect(firstTradingDayOf({ timing: { tradingDays: [SEP10] } })).toBe(SEP10);
  });

  it('another mode has no first trading day, even with a list', () => {
    for (const gameMode of ['baggerbomb_tournament', 'league', 'snake_draft']) {
      expect(isTieredBattle({ gameMode })).toBe(false);
      expect(firstTradingDayOf({ gameMode, timing: { tradingDays: [SEP10] } })).toBe(null);
    }
  });

  it('a missing or malformed list names none', () => {
    for (const tradingDays of [[], undefined, null, [null], ['Sep 10'], [20260910], ['2026-9-10']]) {
      expect(firstTradingDayOf(tiered(tradingDays))).toBe(null);
    }
    expect(firstTradingDayOf(tiered(undefined, { timing: undefined }))).toBe(null);
    expect(firstTradingDayOf(null)).toBe(null);
  });
});

describe('beforeFirstTradingDay', () => {
  it('is true only on an ET date before the first day', () => {
    const b = tiered([SEP10]);
    expect(beforeFirstTradingDay(b, SEP9)).toBe(true);
    expect(beforeFirstTradingDay(b, SEP10)).toBe(false);
    expect(beforeFirstTradingDay(b, '2026-09-11')).toBe(false);
  });

  it('holds back a measured and a legacy battle alike, and one with no gameMode', () => {
    expect(beforeFirstTradingDay(tiered([SEP10], { scoring: { stockThresholdModel: { version: 'v2' } } }), SEP9)).toBe(true);
    expect(beforeFirstTradingDay(tiered([SEP10]), SEP9)).toBe(true);
    expect(beforeFirstTradingDay({ timing: { tradingDays: [SEP10] } }, SEP9)).toBe(true);
  });

  it('never holds back a tournament or another mode', () => {
    for (const gameMode of ['baggerbomb_tournament', 'league']) {
      expect(beforeFirstTradingDay({ gameMode, timing: { tradingDays: [SEP10] } }, SEP9)).toBe(false);
    }
  });

  it('never holds back on a missing list or an unreadable date', () => {
    for (const tradingDays of [[], undefined, [null], ['Sep 10']]) expect(beforeFirstTradingDay(tiered(tradingDays), SEP9)).toBe(false);
    for (const today of [undefined, null, '', 'Sep 9', 20260909]) expect(beforeFirstTradingDay(tiered([SEP10]), today)).toBe(false);
    expect(beforeFirstTradingDay(null, SEP9)).toBe(false);
  });
});

describe('etDateOf', () => {
  it('reads the ET calendar date of an instant, across the UTC date line and DST', () => {
    expect(etDateOf(Date.parse('2026-09-10T03:30:00.000Z'))).toBe(SEP9); // 11:30 PM EDT
    expect(etDateOf(Date.parse('2026-09-10T04:00:00.000Z'))).toBe(SEP10); // midnight EDT
    expect(etDateOf(Date.parse('2026-11-02T04:59:00.000Z'))).toBe('2026-11-01'); // 11:59 PM EST after the fall-back
    expect(etDateOf(Date.parse('2026-11-02T05:00:00.000Z'))).toBe('2026-11-02');
  });

  it('is null for anything but a finite number', () => {
    for (const bad of [null, undefined, '2026-09-10', NaN, Infinity, 1e20, -1e20, 8.64e15 + 1]) expect(etDateOf(bad)).toBe(null);
  });
});

describe('firstSessionOpenMs', () => {
  // The next session's open from the calendar of record, as a true instant.
  it('a weekday evening: the next day\'s 9:30 AM EDT', () => {
    expect(firstSessionOpenMs(tiered(['2026-10-27']))).toBe(Date.parse('2026-10-27T13:30:00.000Z'));
  });

  it('a Friday evening: Monday\'s 9:30 AM, across the Nov 1 fall-back (EST)', () => {
    expect(firstSessionOpenMs(tiered(['2026-11-02']))).toBe(Date.parse('2026-11-02T14:30:00.000Z'));
  });

  it('a holiday eve: the session after the holiday', () => {
    // Wed Nov 25 evening -> Thanksgiving Nov 26 is closed -> Fri Nov 27 (early close, still a 9:30 AM open).
    expect(firstSessionOpenMs(tiered(['2026-11-27']))).toBe(Date.parse('2026-11-27T14:30:00.000Z'));
  });

  it('is null when there is nothing honest to say', () => {
    expect(firstSessionOpenMs(tiered(['2026-11-26']))).toBe(null); // not a session (Thanksgiving)
    expect(firstSessionOpenMs(tiered(['2026-11-28']))).toBe(null); // a Saturday
    expect(firstSessionOpenMs(tiered(['2031-01-06']))).toBe(null); // outside the maintained calendar
    expect(firstSessionOpenMs(tiered([]))).toBe(null);
    expect(firstSessionOpenMs({ gameMode: 'baggerbomb_tournament', timing: { tradingDays: ['2026-10-27'] } })).toBe(null);
  });
});
