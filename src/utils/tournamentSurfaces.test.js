// src/utils/tournamentSurfaces.test.js
//
// P6b — the node-clean surface view-model helpers. DEPENDENCY-SURFACE GUARD
// (BUILD_RULES §4): this real import of tournamentSurfaces.js is the runtime
// guard that the file (and its transitive import of the schema module) stays
// Node-clean — it would explode here if a browser-only dep ever entered.

import { describe, it, expect } from 'vitest';
import {
  etMonthKey,
  monthNavState,
  feedEventText,
  spectatorBattleSummary,
} from './tournamentSurfaces.js';

describe('etMonthKey — America/New_York month identity (ruling A-3)', () => {
  it('formats YYYY-MM in ET, respecting the date-line at the month boundary', () => {
    // 2026-07-01 00:30 UTC is still 2026-06-30 20:30 ET → June.
    expect(etMonthKey(new Date('2026-07-01T00:30:00Z'))).toBe('2026-06');
    expect(etMonthKey(new Date('2026-07-01T05:00:00Z'))).toBe('2026-07'); // 01:00 ET → July
  });
});

describe('monthNavState — the chevron boundaries', () => {
  it('cannot browse past the current ET month; older stops at the first empty month', () => {
    // At the current month with data: older yes, newer no.
    expect(monthNavState({ monthKey: '2026-06', currentMonthKey: '2026-06', docExists: true }))
      .toEqual({ canNewer: false, canOlder: true });
    // A past month with data: both directions.
    expect(monthNavState({ monthKey: '2026-05', currentMonthKey: '2026-06', docExists: true }))
      .toEqual({ canNewer: true, canOlder: true });
    // Landed on an empty older month: older disabled (you've gone too far back).
    expect(monthNavState({ monthKey: '2026-03', currentMonthKey: '2026-06', docExists: false }))
      .toEqual({ canNewer: true, canOlder: false });
  });
});

describe('feedEventText — the renderer core (both double-down sides)', () => {
  const uid = 'me';
  it('flip + board_auto_commit', () => {
    expect(feedEventText({ type: 'flip', odUserId: 'me', symbol: 'NVDA', from: 'long', to: 'short' }, uid))
      .toBe('You flipped NVDA long→short');
    expect(feedEventText({ type: 'board_auto_commit', odUserId: 'rival', boardLength: 15 }, uid))
      .toBe("rival's board auto-committed at the deadline (15 names)");
  });
  it('double_down: user side names the player; ABSENT side reads as agent', () => {
    expect(feedEventText({ type: 'double_down', side: 'user', kind: 'flipped', odUserId: 'me', symbol: 'NVDA' }, uid))
      .toBe('You flipped the double-down on NVDA');
    expect(feedEventText({ type: 'double_down', side: 'user', kind: 'formed', odUserId: 'rival', symbol: 'AMD' }, uid))
      .toBe('rival doubled down on AMD');
    // No `side` → agent phrasing.
    expect(feedEventText({ type: 'double_down', kind: 'formed', odUserId: 'me', symbol: 'COIN' }, uid))
      .toBe('Your agent doubled down on COIN');
  });
});

describe('spectatorBattleSummary — the honest P7 degrade (Proposal C)', () => {
  const group = {
    players: [
      { odUserId: 'a', picks: [{ symbol: 'NVDA', legs: [{ direction: 'long' }, { direction: 'short' }] }] },
      { odUserId: 'cpu-1', isCpu: true, picks: [] },
    ],
    dailyScores: { day1: { recordedDate: '2026-06-15', closeScores: {
      a: { totalPoints: 20, agentPoints: 30, compositePoints: 60 },
      'cpu-1': { totalPoints: 0, agentPoints: -5, compositePoints: -5 },
    } } },
  };
  it('per-player composite/user/agent + live pick direction, ranked by composite, marked degraded', () => {
    const { players, degraded } = spectatorBattleSummary(group, { uid: 'a' });
    expect(degraded).toBe(true);
    expect(players[0]).toMatchObject({ odUserId: 'a', isYou: true, composite: 60, userPoints: 20, agentPoints: 30 });
    expect(players[0].picks).toEqual([{ symbol: 'NVDA', direction: 'short' }]); // live leg = last
    expect(players[1]).toMatchObject({ odUserId: 'cpu-1', isCpu: true, composite: -5, agentPoints: -5 });
  });
});
