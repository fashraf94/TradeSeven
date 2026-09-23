// src/components/League/backing/backingLanding.test.jsx
//
// Backing Beta PR 4 — THE LANDING (build item A; design brief rev3 §1; the
// founder's no-bracket ruling, Sept 18). Production has no round-one bracket
// writer, so the funnel is empty today. With the flag on:
//   · NO BRACKET → the landing leads with the strip and the weekly pods, with
//     no empty funnel frame, placeholder, or reserved space;
//   · A BRACKET → the funnel renders where the design puts it and nothing
//     else moves.
// Both are proved the same way: the flag-on landing, with the strip excised
// and the Predictions label reverted, is BYTE-EQUAL to the flag-off landing.
// Any frame, placeholder or reserved element that rode in with the strip
// breaks that equality (BUILD_RULES §2 mutation check #6).
//
// The strip's data hooks are mocked to return synchronously so react-dom/server
// renders the lit strip; everything else is the real composition.

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { leagueState } from '../leagueFixtures';
import { buildLeagueState } from '../leagueAdapter';

const flag = vi.hoisted(() => ({ on: true }));
const hooked = vi.hoisted(() => ({ state: null, pods: null }));

vi.mock('../../../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  get BACKING_BETA_ENABLED() { return flag.on; },
}));
vi.mock('../../../hooks/useBackingPods', () => ({ default: () => hooked.pods }));
vi.mock('../../../hooks/useMyBacking', () => ({ default: () => ({ stakes: [], poolsById: {}, groupsById: {}, loading: false }) }));
vi.mock('../../../hooks/useLeagueState', () => ({ default: () => ({ state: hooked.state, loading: false, isFixtures: false }) }));
vi.mock('../../../contexts/UserContext', () => ({ useUser: () => ({ user: { uid: 'u1', displayName: 'Alice' } }) }));
vi.mock('../../../services/tournamentGroupService', () => ({
  subscribeMyGroup: () => () => {}, subscribeMyMostRecentVoidedGroup: () => () => {}, subscribeMyTrainingPod: () => () => {},
  subscribeGroup: () => () => {}, getGroup: async () => null, fetchDisplayNames: async () => ({}),
}));
vi.mock('../../../services/backingService', () => ({
  fetchBackingPods: vi.fn(), subscribeMyStakes: () => () => {}, subscribePool: () => () => {}, subscribeWallet: () => () => {},
  readEligibility: async () => null, subscribePitch: () => () => {}, fetchTapePod: async () => null, fetchTeamCard: vi.fn(),
  placeStake: vi.fn(), attestEligibility: vi.fn(), savePitch: vi.fn(), newRequestId: () => 'req', BackingApiError: class extends Error {},
  // PR 5: the results, the two stats readers, the telemetry sink.
  fetchBackingResults: vi.fn(async () => ({ weeks: [], nextBefore: null, weeksAvailable: 0 })), fetchMyBackingStats: vi.fn(async () => null), fetchTrainerStats: vi.fn(async () => null), postBackingEvent: vi.fn(async () => ({ recorded: true })),
}));
vi.mock('../../../utils/fetchWithAuth', () => ({ fetchWithAuth: vi.fn(async () => ({ ok: true, json: async () => ({ slots: [], battles: {} }) })) }));
vi.mock('../../../services/leagueSignals', () => ({ logLeagueSignal: () => {} }));
vi.mock('../../../services/tournamentLobbyActions', () => ({ quickPlay: () => Promise.resolve({}), quickPlayTraining: () => {}, mapLobbyError: () => 'error' }));
vi.mock('../../../services/liveDraftActions', () => ({
  fetchSlotSchedule: () => Promise.resolve({ slots: [] }), claimSlot: () => Promise.resolve({}), releaseSlot: () => Promise.resolve({}), mapSlotActionError: () => 'error',
}));
vi.mock('../LoadoutChooserSheet', () => ({ default: () => null }));

const LeagueHome = (await import('../LeagueHome')).default;
const LeagueLobbyDesktop = (await import('../LeagueLobbyDesktop')).default;

const SUNDAY_CLOSE = '2026-09-28T03:59:59.000Z';
const WED_FIRE = '2026-09-23T23:00:00.000Z';
const podsResponse = (closesAt = SUNDAY_CLOSE) => ({
  data: { baseLayerWeek: '2026-W40', backingWeekStart: '2026-09-21T04:00:00.000Z', backingWeekCloses: SUNDAY_CLOSE, viewerUid: 'u1', pods: [] },
  pods: [{
    groupId: 'g-next', formationPath: 'lobby', slotId: null, baseLayerWeek: '2026-W40', seatNames: { 'od-a': 'Mira' }, humanTeams: 1,
    teams: [{ odUserId: 'od-a', isCpu: false, isOwnSeat: false, backable: true }, { odUserId: 'cpu-1', isCpu: true, isOwnSeat: false, backable: true }],
    pool: { status: 'open', backerProgress: { count: 0, floor: 3, met: false }, teamSpread: { met: false }, closesAt, closeReason: 'clock' },
    myStakes: [],
  }],
  loading: false, error: null, refresh: () => {},
});

// A real base-layer group and NO bracket — the founder's actual production state.
const baseGroup = {
  id: 'wk-real-1', status: 'battle', roundNumber: 1, baseLayerWeek: '2026-W39',
  players: [{ odUserId: 'u1', picks: [] }, { odUserId: 'cpu-1', isCpu: true, picks: [] }, { odUserId: 'u2', picks: [] }, { odUserId: 'cpu-2', isCpu: true, picks: [] }],
  dailyScores: { day1: { closeScores: { u1: { compositePoints: 3.2 }, u2: { compositePoints: 1.1 } } } },
};
const NO_BRACKET = buildLeagueState({ fieldGroups: [baseGroup], names: { u1: 'Alice', u2: 'Bob' }, uid: 'u1' }).state;
const WITH_BRACKET = leagueState('open');

const props = { onOpenMyGame: () => {}, onOpenTrainingPod: () => {}, hasAgent: true, agentLoadout: null };
const render = (Landing) => renderToString(React.createElement(Landing, props));

/** The flag-on landing with the strip removed and the label reverted — what "nothing else moves" means. */
const excise = (html) => html
  .replace(/<div data-backing="strip-slot"[\s\S]*?<\/button><\/div>/, '')
  .split('Tap a seat · Predictions').join('Tap a seat to spectate');

const FUNNEL_MARKERS = ['Round 1 · 16', 'Round 2 · 8', 'YOUR PATH', 'width:354px', 'height:384px', 'seats TBD', '+2 below cut', 'FINAL 4'];

describe('no bracket — the strip and the weekly pods lead; no funnel frame, placeholder or reserved space', () => {
  it('mobile', () => {
    hooked.state = NO_BRACKET;
    hooked.pods = podsResponse();
    flag.on = true;
    const on = render(LeagueHome);
    flag.on = false;
    const off = render(LeagueHome);

    expect(on).toContain('data-backing="strip"');
    expect(on).toContain('data-strip-state="open"');
    for (const m of FUNNEL_MARKERS) expect(on, `funnel marker "${m}" on the no-bracket landing`).not.toContain(m);
    // The strip sits directly under the ranked-entry center, above the field.
    const center = on.indexOf('Pick a draft slot');
    const strip = on.indexOf('data-backing="strip"');
    const field = on.indexOf('The field · weekly base-layer groups');
    expect(center).toBeGreaterThan(-1);
    expect(strip).toBeGreaterThan(center);
    expect(field).toBeGreaterThan(strip);
    // No empty slot wrapper: the wrapper exists only around a rendered strip…
    expect(on).not.toMatch(/data-backing="strip-slot"[^>]*><\/div>/);
    // …and nothing rides inside the slot ahead of the strip (a placeholder
    // inside the slot would be excised with it below — mutation check 6b).
    expect(on).toMatch(/data-backing="strip-slot"[^>]*><button[^>]*data-backing="strip"/);
    // MUTATION CHECK #6 — nothing else moved: minus the strip (and the label), byte-equal to the flag-off landing.
    expect(excise(on)).toBe(off);
    expect(off).not.toContain('data-backing');
  });

  it('desktop', () => {
    hooked.state = NO_BRACKET;
    hooked.pods = podsResponse();
    flag.on = true;
    const on = render(LeagueLobbyDesktop);
    flag.on = false;
    const off = render(LeagueLobbyDesktop);
    expect(on).toContain('data-backing="strip"');
    for (const m of ['YOUR PATH TO THE TROPHY', 'Round 1 · 16', 'FINAL 4']) expect(on).not.toContain(m);
    // In the left rail, under "Open my game"'s slot and above "Your group"
    // (the class names are matched as attributes: the lobby's <style> block
    // names them first).
    const rail = on.indexOf('class="lg-scroll ld-rail-left"');
    const strip = on.indexOf('data-backing="strip"');
    const center = on.indexOf('class="lg-scroll ld-center"');
    expect(rail).toBeGreaterThan(-1);
    expect(strip).toBeGreaterThan(rail);
    expect(strip).toBeLessThan(center);
    expect(excise(on)).toBe(off);
  });
});

describe('a bracket exists — the composition is unchanged by the mount; nothing else moves', () => {
  it('mobile', () => {
    hooked.state = WITH_BRACKET;
    hooked.pods = podsResponse();
    flag.on = true;
    const on = render(LeagueHome);
    flag.on = false;
    const off = render(LeagueHome);
    expect(on).toContain('data-backing="strip"');
    expect(on).toMatch(/data-backing="strip-slot"[^>]*><button[^>]*data-backing="strip"/);
    expect(excise(on)).toBe(off);
    // The group card and the field still render, in their places, after the strip.
    const strip = on.indexOf('data-backing="strip"');
    expect(on.indexOf('Your group ·')).toBeGreaterThan(strip);
    expect(on.indexOf('The field · weekly base-layer groups')).toBeGreaterThan(strip);
  });

  it('desktop', () => {
    hooked.state = WITH_BRACKET;
    hooked.pods = podsResponse();
    flag.on = true;
    const on = render(LeagueLobbyDesktop);
    flag.on = false;
    const off = render(LeagueLobbyDesktop);
    expect(excise(on)).toBe(off);
  });
});

describe('the strip itself on the landing', () => {
  it('reads the close from each pool’s closesAt — a Wednesday fire close reads Wednesday, never Sunday', () => {
    hooked.state = NO_BRACKET;
    hooked.pods = podsResponse(WED_FIRE);
    flag.on = true;
    const on = render(LeagueHome);
    expect(on).toContain('Closes Wed 7:00 PM ET');
    expect(on).not.toContain('Sun 11:59');
  });

  it('while the pod list is still loading, no strip and no placeholder frame render — the landing is the flag-off landing', () => {
    hooked.state = NO_BRACKET;
    hooked.pods = { data: null, pods: [], loading: true, error: null, refresh: () => {} };
    flag.on = true;
    const on = render(LeagueHome);
    flag.on = false;
    const off = render(LeagueHome);
    expect(on).not.toContain('data-backing');
    expect(on.split('Tap a seat · Predictions').join('Tap a seat to spectate')).toBe(off);
  });

  it('with no pods and no stakes the strip says there is nothing to back yet — never "0 pods"', () => {
    hooked.state = NO_BRACKET;
    hooked.pods = { data: { baseLayerWeek: '2026-W40', backingWeekCloses: SUNDAY_CLOSE, pods: [] }, pods: [], loading: false, error: null, refresh: () => {} };
    flag.on = true;
    const on = render(LeagueHome);
    expect(on).toContain('data-strip-state="quiet"');
    expect(on).toContain('No pods to back yet');
    expect(on).not.toContain('0 pods');
  });
});
