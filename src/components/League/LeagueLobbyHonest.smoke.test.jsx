// src/components/League/LeagueLobbyHonest.smoke.test.jsx
//
// Render smoke for the DISPLAY-HONESTY fix (League lobby fixture leak). Proves
// that under the real adapter, a base-layer-only / cold-start session shows the
// TRUTH — real counts, real base-layer standings, and an honest forthcoming
// bracket — and NEVER the 16 fixture demo players (Atlas/Vela/Orion…) or the
// fixture "16 → 8 → 4" bracket copy. Mirrors the LeagueLobbyDesktop.smoke setup
// (react-dom/server, all data/auth/signal deps stubbed), but drives the real
// adapter output through the useLeagueState seam instead of the fixture world.

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { buildLeagueState } from './leagueAdapter';

// A real base-layer group: 2 humans + 2 CPUs, with banked composites — the exact
// shape subscribeBaseLayerGroups hands the adapter.
const baseGroup = {
  id: 'wk-real-1',
  status: 'battle',
  roundNumber: 1,
  baseLayerWeek: '2026-W27',
  players: [
    { odUserId: 'u1', picks: [] },
    { odUserId: 'cpu-1', isCpu: true, picks: [] },
    { odUserId: 'u2', picks: [] },
    { odUserId: 'cpu-2', isCpu: true, picks: [] },
  ],
  dailyScores: {
    day1: { closeScores: { u1: { compositePoints: 3.2 }, u2: { compositePoints: 1.1 } } },
  },
};

// base-layer-only (the founder's actual state): real field, NO bracket doc.
const baseLayerOnly = buildLeagueState({
  fieldGroups: [baseGroup], names: { u1: 'Alice', u2: 'Bob' }, uid: 'u1',
}).state;

// cold start: real adapter on, but nothing exists yet.
const coldStart = buildLeagueState({}).state;

const hooked = vi.hoisted(() => ({ ret: null }));
vi.mock('../../hooks/useLeagueState', () => ({ default: () => hooked.ret }));
vi.mock('../../contexts/UserContext', () => ({ useUser: () => ({ user: null }) }));
vi.mock('../../services/tournamentGroupService', () => ({ subscribeMyGroup: () => () => {}, subscribeMyTrainingPod: () => () => {} }));
vi.mock('../../services/leagueSignals', () => ({ logLeagueSignal: () => {} }));
vi.mock('../../services/tournamentLobbyActions', () => ({ quickPlay: () => Promise.resolve({}), quickPlayTraining: () => {}, mapLobbyError: () => 'error' }));
// SlotCenter (the no-game center) transitively imports the slot actions, whose
// fetchWithAuth pulls the env-gated Firebase client — stub like liveDraft.smoke.
vi.mock('../../services/liveDraftActions', () => ({
  fetchSlotSchedule: () => Promise.resolve({ slots: [] }),
  claimSlot: () => Promise.resolve({}),
  releaseSlot: () => Promise.resolve({}),
  mapSlotActionError: () => 'error',
}));
vi.mock('./LoadoutChooserSheet', () => ({ default: () => null }));

const LeagueLobbyDesktop = (await import('./LeagueLobbyDesktop')).default;
const LeagueHome = (await import('./LeagueHome')).default;

const FIXTURE_NAMES = ['Atlas', 'Vela', 'Orion', 'Lyra', 'Cygnus', 'Draco', 'Mira', 'Rigel'];
const render = (el) => renderToString(el);

describe('League lobby — honest display under the real adapter (fixture-leak fix)', () => {
  it('desktop base-layer-only: forthcoming bracket, real standings, NO demo players', () => {
    hooked.ret = { state: baseLayerOnly, loading: false, isFixtures: false };
    const html = render(<LeagueLobbyDesktop onOpenMyGame={() => {}} onOpenTrainingPod={() => {}} hasAgent agentLoadout={null} />);
    // the honest forthcoming bracket replaces the funnel
    expect(html).toContain('opens when the season locks'); // the demoted footnote (copy preserved)
    expect(html).toContain('Pick a draft slot');            // the no-game center is the slot picker
    expect(html).not.toContain('YOUR PATH TO THE TROPHY'); // funnel (and its hero eyebrow) is gone
    // the leaderboard shows REAL members, not the 16 demo players
    expect(html).toContain('Alice');
    expect(html).toContain('CPU — Trend Follower');
    FIXTURE_NAMES.forEach((n) => expect(html).not.toContain(n));
  });

  it('desktop cold-start: honest empty leaderboard + forthcoming bracket, no demo', () => {
    hooked.ret = { state: coldStart, loading: false, isFixtures: true };
    const html = render(<LeagueLobbyDesktop onOpenMyGame={() => {}} onOpenTrainingPod={() => {}} hasAgent agentLoadout={null} />);
    expect(html).toContain('opens when the season locks'); // the demoted footnote (copy preserved)
    expect(html).toContain('Pick a draft slot');            // the no-game center is the slot picker
    expect(html).toContain('Standings appear once'); // the honest empty leaderboard
    FIXTURE_NAMES.forEach((n) => expect(html).not.toContain(n));
  });

  it('mobile base-layer-only: forthcoming bracket + real field, no demo players', () => {
    hooked.ret = { state: baseLayerOnly, loading: false, isFixtures: false };
    const html = render(<LeagueHome onOpenMyGame={() => {}} onOpenTrainingPod={() => {}} hasAgent agentLoadout={null} />);
    expect(html).toContain('opens when the season locks'); // the demoted footnote (copy preserved)
    expect(html).toContain('Pick a draft slot');            // the no-game center is the slot picker
    expect(html).not.toContain('16 → 8 → 4'); // no fixture bracket-count copy
    FIXTURE_NAMES.forEach((n) => expect(html).not.toContain(n));
  });

  it('mobile cold-start: honest empty field, no demo groups', () => {
    hooked.ret = { state: coldStart, loading: false, isFixtures: true };
    const html = render(<LeagueHome onOpenMyGame={() => {}} onOpenTrainingPod={() => {}} hasAgent agentLoadout={null} />);
    expect(html).toContain('opens when the season locks'); // the demoted footnote (copy preserved)
    expect(html).toContain('Pick a draft slot');            // the no-game center is the slot picker
    expect(html).toContain('Weekly groups appear here'); // the honest empty field state
    FIXTURE_NAMES.forEach((n) => expect(html).not.toContain(n));
  });
});
