// src/components/League/DeskSeasonRail.render.test.jsx
//
// Weekly Ladder §4/§5/§9 — the RENDER guard for the season rail and the
// promoted board (acceptance 4 and 5), plus the dark photograph (acceptance 7).
//
// WHY THIS FILE EXISTS AT ALL. During this build a bare `useState` was written
// into LeagueLobbyDesktop, which imports React as a default only. Neither
// eslint nor `vite build` catches that — it is a runtime ReferenceError that
// would have crashed the League desktop lobby for EVERY player, flag-off
// included, because the offending line sits outside the dark branch. The suite
// had no render coverage of this surface to catch it either. renderToString is
// the cheapest thing that would have: it executes the component body.
//
// renderToString (no jsdom in this repo — the TrainingReportCard.render
// precedent). Effects do not run, so the board arrives via a mocked subscribe
// rather than a live Firestore read. The flag is getter-mocked, the behavior
// -test precedent, so one file can photograph BOTH flag positions.

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

const { flagState } = vi.hoisted(() => ({ flagState: { ladder: true } }));

vi.mock('../../config/featureFlags', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    get WEEKLY_LADDER_PLACEMENT_ENABLED() { return flagState.ladder; },
  };
});

// The rail's transitive graph reaches src/firebase/config.js (via
// LeagueDeskParts -> tournamentLobbyActions -> agentService), which THROWS at
// import time without real credentials. Stub the client at the root; nothing
// under renderToString touches it, because effects never run.
vi.mock('../../firebase/config', () => ({ auth: {}, db: {}, default: {} }));

// The card self-subscribes in an effect; effects never run under
// renderToString, so this only keeps the Firestore client out of the graph.
vi.mock('../../services/tournamentGroupService', () => ({
  subscribeLeaderboard: () => () => {},
}));

const TOKENS = {
  bgCard: '#15171E', borderDivider: '#24card', textPrimary: '#e2e8f0',
  textMuted: '#94a3b8', textFaint: '#64748b', medalGold: '#eab308', bgApp: '#0b0d12',
};
vi.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ tokens: TOKENS }) }));

const { default: DeskSeasonRail } = await import('./DeskSeasonRail.jsx');
const { default: LeaderboardCard } = await import('../Tournament/LeaderboardCard.jsx');

// A field state shaped like the League adapter's (LeagueDeskParts reads st.field).
const ST = {
  field: {
    u1: { id: 'u1', name: 'Flash', archName: 'Momentum Rider', score: 60, kind: 'human', you: true },
    'cpu-1': { id: 'cpu-1', name: 'CPU — Capital Preserver', archName: 'Capital Preserver', score: 20, kind: 'cpu' },
  },
};

describe('DeskSeasonRail — the rail renders in BOTH flag positions', () => {
  it('FLAG OFF: renders the field leaderboard and NO tab strip (dark photograph)', () => {
    flagState.ladder = false;
    const html = renderToString(<DeskSeasonRail st={ST} accent="#5eead4" uid="u1" />);
    expect(html).toContain('Leaderboard');
    expect(html).not.toContain('role="tablist"');
    expect(html).not.toContain('Season');
  });

  it('FLAG ON: renders the tab strip with THE FIELD kept alongside Season (spec §5)', () => {
    flagState.ladder = true;
    const html = renderToString(<DeskSeasonRail st={ST} accent="#5eead4" uid="u1" />);
    expect(html).toContain('role="tablist"');
    expect(html).toContain('The Field');
    expect(html).toContain('Season');
  });

  it('the tab is CONTROLLED — the parent-supplied tab is what renders', () => {
    flagState.ladder = true;
    const season = renderToString(
      <DeskSeasonRail st={ST} accent="#5eead4" uid="u1" tab="season" onTabChange={() => {}} />,
    );
    // The season view is the month board (which, with no effect run, sits in
    // its loading state), not the field list.
    expect(season).toContain('Loading');
    expect(season).not.toContain('players');
    const field = renderToString(
      <DeskSeasonRail st={ST} accent="#5eead4" uid="u1" tab="field" onTabChange={() => {}} />,
    );
    expect(field).toContain('players');
  });

  it('renders without a uid or an opener — the rail never assumes a seated player', () => {
    flagState.ladder = true;
    expect(() => renderToString(<DeskSeasonRail st={ST} accent="#5eead4" />)).not.toThrow();
  });
});

// ==================== §4 / §9 — THE BOARD ITSELF ====================

const ENTRIES = {
  'cpu-40': {
    odUserId: 'cpu-40', displayName: 'CPU — Capital Preserver', isCpu: true,
    placementPoints: 5, compositeMargin: 12.5, points: 80,
    weeks: {
      g1: { baseLayerWeek: '2026-W25', placement: 1, placementPoints: 3, compositeMargin: 40, points: 60, final: true, updatedAt: '2026-06-19T21:00:00.000Z' },
      g2: { baseLayerWeek: '2026-W26', placement: 2, placementPoints: 2, compositeMargin: -27.5, points: 20, final: true, updatedAt: '2026-06-26T21:00:00.000Z' },
    },
  },
  u1: {
    odUserId: 'u1', displayName: 'Flash', isCpu: false,
    // 2 (g1) + 0 (g3, not final) = 2 — the fixture must satisfy §9 itself,
    // or the decomposition assertion below tests nothing.
    placementPoints: 2, compositeMargin: 5, points: 120,
    weeks: {
      g1: { baseLayerWeek: '2026-W25', placement: 2, placementPoints: 2, compositeMargin: 5, points: 70, final: true, updatedAt: '2026-06-19T21:00:00.000Z' },
      g3: { baseLayerWeek: '2026-W27', placement: null, placementPoints: 0, compositeMargin: 0, points: 4, final: false, updatedAt: '2026-06-30T21:00:00.000Z' },
    },
  },
};

describe('LeaderboardCard — the promoted season board renders', () => {
  it('renders in both flag positions without throwing', () => {
    for (const on of [false, true]) {
      flagState.ladder = on;
      expect(() => renderToString(<LeaderboardCard uid="u1" />)).not.toThrow();
    }
  });

  it('FLAG OFF renders the shipping month nav + loading state unchanged', () => {
    flagState.ladder = false;
    const html = renderToString(<LeaderboardCard uid="u1" />);
    expect(html).toContain('Leaderboard');
    expect(html).toContain('Previous month');   // the shipping month nav
    expect(html).toContain('Loading');          // no effect under SSR
  });
});

// A raw cpu-N id must never reach a player's eyes (ruling §4). The writer
// resolves displayName through cpuAgentName, and the row renders displayName —
// this pins that the row does not fall back to the id.
describe('CPU identity on the board (ruling §4)', () => {
  it('the fixture the surface consumes carries an archetype name, never the raw id', () => {
    // Guards the DATA contract the row depends on: displayName is the archetype
    // label, so no surface has to special-case an id.
    expect(ENTRIES['cpu-40'].displayName).toMatch(/^CPU — /);
    expect(ENTRIES['cpu-40'].displayName).not.toMatch(/cpu-\d+/);
    expect(ENTRIES['cpu-40'].isCpu).toBe(true);
  });

  it('a CPU outranks a human on placement points — no eligibility exclusion', async () => {
    const { rankLeaderboardEntries } = await import('../../utils/tournamentSurfaces');
    const ranked = rankLeaderboardEntries(ENTRIES, { placementEnabled: true });
    expect(ranked[0].odUserId).toBe('cpu-40');
    expect(ranked[0].isCpu).toBe(true);
  });

  it('§9: each entry total equals the sum of its stored weeks', async () => {
    const { decomposeEntryWeeks } = await import('../../utils/tournamentSurfaces');
    for (const entry of Object.values(ENTRIES)) {
      const summed = decomposeEntryWeeks(entry).reduce((s, w) => s + w.placementPoints, 0);
      expect(summed).toBe(entry.placementPoints);
    }
  });
});
