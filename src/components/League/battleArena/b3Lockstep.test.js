// src/components/League/battleArena/b3Lockstep.test.js
//
// B3 LOCKSTEP (Option X) — the single-seat live scalar (youLiveScore) is now a
// per-seat live MAP (rivals from the endpoint), and it must be honored in BOTH
// consumers TOGETHER:
//   • ClimbArena's `at()` — the orb altitude / rank / cut / gap, and
//   • buildArenaModel's scoresAtLast → youRank — the crown/standing/ask.
// If only one is generalized, your rank (model) and the climb (view) disagree —
// the §9 contradiction. This suite fails if they ever drift apart:
//   1. behavioral (real buildArenaModel): a rival's endpoint composite that
//      overtakes you DEMOTES youRank;
//   2. behavioral (real ClimbArena render): the SAME map drives the rival's
//      rendered altitude via at();
//   3. a source tripwire: BOTH sites resolve through the ONE seatAltitude ruler —
//      generalize one alone and it breaks.

import { readFileSync } from 'node:fs';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { buildArenaModel } from './buildArenaModel';
import { ClimbArena } from './ClimbArena';

// The rival-live path (rivalLive) is gated on LEAGUE_LIVE_ORB_ENABLED inside
// buildArenaModel — force it ON. Vitest HOISTS vi.mock above the imports above, so
// buildArenaModel/ClimbArena load with the flag on; importOriginal keeps every OTHER
// flag real (incl. isAgentPresenceOn → its real off, so ClimbArena renders the ORB
// path) — the same idiom buildArenaModel.test.js uses for the chat flag.
vi.mock('../../../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  LEAGUE_LIVE_ORB_ENABLED: true,
}));

const NOW = Date.parse('2026-06-16T20:30:00.000Z');

// Banked climb has YOU leading (day2: you 10 > u-riv 5 > cpu-1 3). No your-seat
// battle → youLiveScore null (your seat stays banked), so ONLY the rival's live
// value can move the ranking — isolating the per-seat map's effect on BOTH sides.
// A rival endpoint composite of 246.3 vaults u-riv above you.
function scenario(liveComposites) {
  const group = {
    id: 'g1', status: 'battle',
    players: [
      { odUserId: 'u-you' }, { odUserId: 'u-riv' }, { odUserId: 'cpu-1', isCpu: true },
    ],
    dailyScores: {
      day1: { closeScores: { 'u-you': { compositePoints: 4 }, 'u-riv': { compositePoints: 2 }, 'cpu-1': { compositePoints: 1 } } },
      day2: { closeScores: { 'u-you': { compositePoints: 10 }, 'u-riv': { compositePoints: 5 }, 'cpu-1': { compositePoints: 3 } } },
    },
  };
  return {
    group, battle: null, uid: 'u-you', mode: 'ranked',
    priceCtx: { now: NOW }, liveComposites,
  };
}

const climbArenaProps = (m) => ({
  state: 'live', mode: 'ranked', seats: m.seats, climb: m.climb, youId: 'u-you',
  w: 600, h: 300, dayIdx: 1, youLiveScore: m.youLiveScore, liveComposites: m.liveComposites,
});

describe('B3 lockstep — rival live map honored in youRank AND at() together', () => {
  it('1) buildArenaModel: a rival endpoint composite that overtakes you demotes youRank (banked → you lead)', () => {
    expect(buildArenaModel(scenario(null)).youRank).toBe(1);              // no live map → banked → you lead
    expect(buildArenaModel(scenario({ 'u-riv': 246.3 })).youRank).toBe(2); // rival live 246.3 > you 10 → you 2nd
  });

  it('2) ClimbArena.at(): the SAME map drives the rival’s rendered altitude (real render)', () => {
    const live = buildArenaModel(scenario({ 'u-riv': 246.3 }));
    const banked = buildArenaModel(scenario(null));
    const liveHtml = renderToString(React.createElement(ClimbArena, climbArenaProps(live)));
    const bankedHtml = renderToString(React.createElement(ClimbArena, climbArenaProps(banked)));
    // The rival's live composite is on the climb ONLY when at() consumed the map.
    expect(liveHtml).toContain('246.3');
    expect(bankedHtml).not.toContain('246.3'); // banked render shows u-riv at 5.0, never the live value
  });

  it('3) LOCKSTEP tripwire: BOTH at() and scoresAtLast resolve through the ONE seatAltitude ruler', () => {
    const climbSrc = readFileSync(new URL('./ClimbArena.jsx', import.meta.url), 'utf8');
    const modelSrc = readFileSync(new URL('./buildArenaModel.js', import.meta.url), 'utf8');
    // Generalize one call site alone and one of these fails — that is the guard.
    expect(climbSrc).toMatch(/const at = \(s\) => seatAltitude\(s\.id, \{/);
    expect(modelSrc).toMatch(/scoresAtLast\[id\] = seatAltitude\(id, \{/);
    expect(climbSrc).toMatch(/from '\.\/seatAltitude'/);
    expect(modelSrc).toMatch(/from '\.\/seatAltitude'/);
  });

  it('4) the rival seat.score is swapped to the live composite too (surfaces agree with the climb)', () => {
    const live = buildArenaModel(scenario({ 'u-riv': 246.3 }));
    expect(live.seats.find((s) => s.id === 'u-riv').score).toBe(246.3); // rival live
    expect(live.seats.find((s) => s.id === 'u-you').score).not.toBe(246.3); // your seat untouched (banked)
    expect(live.liveComposites).toEqual({ 'u-riv': 246.3 }); // surfaced to ClimbArena (flag on)
  });
});
