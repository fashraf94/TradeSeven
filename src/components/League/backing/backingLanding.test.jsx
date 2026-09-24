// @vitest-environment jsdom
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
//
// THE DESKTOP PLACEMENT (Backing desktop layouts — founder rulings): on the
// desktop landing the strip sits in the CENTRE column, directly under the
// draft-slot picker and the Auto-draft card (unseated) or directly under the
// waiting room's headline and hero (seated) — never below "Watch a live game"
// or the bracket line, never in a side rail. The seated rows mount the lobby
// (jsdom, the group subscription answering) — a seat only exists once the
// subscription answers. MUTATION CHECK (the build's #2): the strip mounted
// below "Watch a live game" reds the seated placement row.
//
// THE MOBILE PLACEMENT (Backing pre-flip fixes 2 — N3, the desktop review
// record; the desktop brief's "resolve it on both"): the mobile strip rides
// the same centre slot — directly under the draft-slot picker and the
// Auto-draft card (unseated) or directly under the waiting room's hero
// (seated) — never below "Watch a live game" or the bracket line, and it
// mounts once the seat subscription has answered (the desktop's WIRE-7 rule),
// so the mobile rows MOUNT the landing too. MUTATION CHECK (the build's B):
// the strip mounted back below "Watch a live game" reds the mobile seated row.

import { describe, it, expect, vi, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { leagueState } from '../leagueFixtures';
import { buildLeagueState } from '../leagueAdapter';

const flag = vi.hoisted(() => ({ on: true }));
const hooked = vi.hoisted(() => ({ state: null, pods: null, myGroup: null }));

vi.mock('../../../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  get BACKING_BETA_ENABLED() { return flag.on; },
}));
vi.mock('../../../hooks/useBackingPods', () => ({ default: () => hooked.pods }));
vi.mock('../../../hooks/useMyBacking', () => ({ default: () => ({ stakes: [], poolsById: {}, groupsById: {}, loading: false }) }));
vi.mock('../../../hooks/useLeagueState', () => ({ default: () => ({ state: hooked.state, loading: false, isFixtures: false }) }));
vi.mock('../../../contexts/UserContext', () => ({ useUser: () => ({ user: { uid: 'u1', displayName: 'Alice' } }) }));
vi.mock('../../../services/tournamentGroupService', () => ({
  // The real subscription ALWAYS answers — the viewer's group, or null.
  subscribeMyGroup: (_uid, cb) => { cb(hooked.myGroup ?? null); return () => {}; }, subscribeMyMostRecentVoidedGroup: () => () => {}, subscribeMyTrainingPod: () => () => {},
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

/**
 * The flag-on landing with the strip removed and the label reverted — what
 * "nothing else moves" means. The desktop slot is the strip's card and the
 * lobby rule it brings (a <style>, last); the mobile slot, the strip button.
 */
const excise = (html) => html
  .replace(/<div data-backing="strip-slot"><div data-backing="strip-card"[\s\S]*?<\/style><\/div>/, '')
  .replace(/<div data-backing="strip-slot"[^>]*><button[\s\S]*?<\/button><\/div>/, '')
  .split('Tap a seat · Predictions').join('Tap a seat to spectate');

const FUNNEL_MARKERS = ['Round 1 · 16', 'Round 2 · 8', 'YOUR PATH', 'width:354px', 'height:384px', 'seats TBD', '+2 below cut', 'FINAL 4'];

// The desktop centre's landmarks, in the order the rulings fix (the class
// names are matched as attributes: the lobby's <style> block names them first).
const CENTRE = 'class="lg-scroll ld-center"';
const RIGHT_RAIL = 'class="ld-rail-right"';
const LEFT_RAIL = 'class="lg-scroll ld-rail-left"';
const STRIP_MARK = 'data-backing="strip"';
const PICKER = 'Pick a draft slot';
const AUTO_DRAFT = 'Can’t make a slot?';
const BRACKET_LINE = 'The monthly bracket opens when the season locks';
const WATCH = 'Watch a live game';
const HERO = 'Solo · Training Pod';
/** The index of `mark` in `html`, asserted present. */
const at = (html, mark) => { const i = html.indexOf(mark); expect(i, `"${mark}" is on the landing`).toBeGreaterThan(-1); return i; };
/** The strip is in the centre column: after the centre opens, before the right rail opens, never in the left rail. */
function expectInCentre(html) {
  const strip = at(html, STRIP_MARK);
  expect(strip, 'the strip is inside the centre column').toBeGreaterThan(at(html, CENTRE));
  expect(strip, 'the strip is inside the centre column').toBeLessThan(at(html, RIGHT_RAIL));
  expect(html.slice(at(html, LEFT_RAIL), at(html, CENTRE)), 'no strip in the left rail').not.toContain(STRIP_MARK);
  return strip;
}

let roots = [];
async function mount(el) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(el); });
  for (let i = 0; i < 6; i += 1) await act(async () => { await Promise.resolve(); });
  roots.push({ root, container });
  return container;
}
afterEach(async () => {
  for (const { root, container } of roots) { await act(async () => root.unmount()); container.remove(); }
  roots = [];
  hooked.myGroup = null;
});

describe('no bracket — the strip and the weekly pods lead; no funnel frame, placeholder or reserved space', () => {
  it('mobile — unseated: directly under the draft-slot picker and the Auto-draft card, above the bracket line and the field (N3)', async () => {
    hooked.state = NO_BRACKET;
    hooked.pods = podsResponse();
    // Mounted: the strip mounts once the seat subscription has answered (N3 /
    // WIRE-7), so a server render, which runs no effect, has no strip to show.
    flag.on = true;
    const on = (await mount(React.createElement(LeagueHome, props))).innerHTML;
    flag.on = false;
    const off = (await mount(React.createElement(LeagueHome, props))).innerHTML;

    expect(on).toContain('data-strip-state="open"');
    for (const m of FUNNEL_MARKERS) expect(on, `funnel marker "${m}" on the no-bracket landing`).not.toContain(m);
    const strip = at(on, STRIP_MARK);
    expect(strip, 'under the draft-slot picker').toBeGreaterThan(at(on, PICKER));
    expect(strip, 'under the Auto-draft card').toBeGreaterThan(at(on, AUTO_DRAFT));
    expect(strip, 'above the bracket line').toBeLessThan(at(on, BRACKET_LINE));
    expect(strip, 'above the field').toBeLessThan(at(on, 'The field · weekly base-layer groups'));
    // Directly under: nothing of the landing's own sits between the Auto-draft card's close and the strip's slot.
    expect(on).toMatch(/Auto-draft<\/button><\/div><\/div><div data-backing="strip-slot"[^>]*><button[^>]*data-backing="strip"/);
    // No empty slot wrapper: the wrapper exists only around a rendered strip…
    expect(on).not.toMatch(/data-backing="strip-slot"[^>]*><\/div>/);
    // …and nothing rides inside the slot ahead of the strip (a placeholder
    // inside the slot would be excised with it below — mutation check 6b).
    expect(on).toMatch(/data-backing="strip-slot"[^>]*><button[^>]*data-backing="strip"/);
    // MUTATION CHECK #6 — nothing else moved: minus the strip (and the label), byte-equal to the flag-off landing.
    expect(excise(on)).toBe(off);
    expect(off).not.toContain('data-backing');
  });

  it('mobile — seated: directly under the waiting room\'s hero, above "Watch a live game" and the bracket line (N3)', async () => {
    hooked.state = NO_BRACKET;
    hooked.pods = podsResponse();
    hooked.myGroup = { id: 'wk-real-1', status: 'battle' };
    flag.on = true;
    const on = (await mount(React.createElement(LeagueHome, props))).innerHTML;
    flag.on = false;
    const off = (await mount(React.createElement(LeagueHome, props))).innerHTML;
    const strip = at(on, STRIP_MARK);
    expect(on, 'the seated centre is the waiting room').not.toContain(PICKER);
    expect(strip, 'under the waiting room\'s hero').toBeGreaterThan(at(on, HERO));
    expect(strip, 'above "Watch a live game"').toBeLessThan(at(on, WATCH));
    expect(strip, 'above the bracket line').toBeLessThan(at(on, BRACKET_LINE));
    // Directly under the hero and its one honesty line.
    expect(on).toMatch(/Practice runs never touch the leaderboard\.<\/span><div data-backing="strip-slot"[^>]*><button[^>]*data-backing="strip"/);
    expect(on.match(/data-backing="strip"/g), 'one strip').toHaveLength(1);
    expect(excise(on)).toBe(off);
  });

  it('desktop — unseated: in the centre, directly under the draft-slot picker and the Auto-draft card, above the bracket line', async () => {
    hooked.state = NO_BRACKET;
    hooked.pods = podsResponse();
    // Mounted: the strip mounts once the seat subscription has answered (the
    // slot picker's centre or the waiting room's — WIRE-7), so a server render,
    // which runs no effect, has no strip to show.
    flag.on = true;
    const on = (await mount(React.createElement(LeagueLobbyDesktop, props))).innerHTML;
    flag.on = false;
    const off = (await mount(React.createElement(LeagueLobbyDesktop, props))).innerHTML;
    expect(on).toContain('data-backing="strip"');
    for (const m of ['YOUR PATH TO THE TROPHY', 'Round 1 · 16', 'FINAL 4']) expect(on).not.toContain(m);
    const strip = expectInCentre(on);
    expect(strip, 'under the draft-slot picker').toBeGreaterThan(at(on, PICKER));
    expect(strip, 'under the Auto-draft card').toBeGreaterThan(at(on, AUTO_DRAFT));
    expect(strip, 'above the bracket line').toBeLessThan(at(on, BRACKET_LINE));
    // Directly under: nothing of the landing's own sits between the Auto-draft card's close and the strip's slot.
    expect(on).toMatch(/Auto-draft<\/button><\/div><\/div><div data-backing="strip-slot"><div data-backing="strip-card"[^>]*><div data-backing="strip-edge"[^>]*><\/div><button[^>]*data-backing="strip"/);
    // The desktop door, not the mobile strip: the accent edge and — the window open — the primary action.
    expect(on).toContain('data-strip-layout="desktop"');
    expect(on).toContain('data-backing="strip-edge"');
    expect(on).toContain('data-backing="strip-back"');
    // No reserved space: the slot carries no margin of its own (the column's gap spaces it).
    expect(on).toMatch(/<div data-backing="strip-slot"><div data-backing="strip-card"/);
    // The lobby rule the strip brings (PLACE-2): at the ≤1180px layouts the lobby's grid items
    // size to their content, so the taller centre never paints over the rail reflowed beneath
    // it — riding the lit slot, so the flag-off lobby (its LD_STYLE) is today's.
    expect(on).toMatch(/@media \(max-width: 1180px\) \{ \.ld-grid > \.ld-center, \.ld-grid > \.ld-rail-left \{ min-height: auto; \} \}/);
    // …never the right rail: its leaderboard would unroll and push "Open my game" below the fold.
    expect(on).not.toMatch(/\.ld-rail-right \{ min-height: auto/);
    expect(off).not.toContain('min-height: auto');
    expect(excise(on)).toBe(off);
  });

  it('desktop — seated: in the centre, directly under the waiting room\'s headline and hero, above "Watch a live game" and the bracket line', async () => {
    hooked.state = NO_BRACKET;
    hooked.pods = podsResponse();
    hooked.myGroup = { id: 'wk-real-1', status: 'battle' };
    flag.on = true;
    const on = (await mount(React.createElement(LeagueLobbyDesktop, props))).innerHTML;
    flag.on = false;
    const off = (await mount(React.createElement(LeagueLobbyDesktop, props))).innerHTML;
    const strip = expectInCentre(on);
    expect(on, 'the seated centre is the waiting room').not.toContain(PICKER);
    expect(strip, 'under the waiting room\'s hero').toBeGreaterThan(at(on, HERO));
    expect(strip, 'above "Watch a live game"').toBeLessThan(at(on, WATCH));
    expect(strip, 'above the bracket line').toBeLessThan(at(on, BRACKET_LINE));
    expect(excise(on)).toBe(off);
  });
});

describe('a bracket exists — the composition is unchanged by the mount; nothing else moves', () => {
  it('mobile — unseated and seated: the strip in the centre\'s own slot, and nothing else moves', async () => {
    hooked.state = WITH_BRACKET;
    hooked.pods = podsResponse();
    flag.on = true;
    const on = (await mount(React.createElement(LeagueHome, props))).innerHTML;
    flag.on = false;
    const off = (await mount(React.createElement(LeagueHome, props))).innerHTML;
    expect(on).toMatch(/data-backing="strip-slot"[^>]*><button[^>]*data-backing="strip"/);
    expect(excise(on)).toBe(off);
    // Under the Auto-draft card, above the bracket line; the group card and the field still render, in their places, after it.
    const strip = at(on, STRIP_MARK);
    expect(strip).toBeGreaterThan(at(on, AUTO_DRAFT));
    expect(strip).toBeLessThan(at(on, BRACKET_LINE));
    expect(at(on, 'Your group ·')).toBeGreaterThan(strip);
    expect(at(on, 'The field · weekly base-layer groups')).toBeGreaterThan(strip);
    hooked.myGroup = { id: 'wk-real-1', status: 'battle' };
    flag.on = true;
    const seatedOn = (await mount(React.createElement(LeagueHome, props))).innerHTML;
    flag.on = false;
    const seatedOff = (await mount(React.createElement(LeagueHome, props))).innerHTML;
    expect(excise(seatedOn)).toBe(seatedOff);
    const seated = at(seatedOn, STRIP_MARK);
    expect(seated).toBeGreaterThan(at(seatedOn, HERO));
    expect(seated).toBeLessThan(at(seatedOn, WATCH));
    expect(seated).toBeLessThan(at(seatedOn, BRACKET_LINE));
  });

  it('desktop — unseated and seated: the strip in the same centre position, and nothing else moves', async () => {
    hooked.state = WITH_BRACKET;
    hooked.pods = podsResponse();
    flag.on = true;
    const on = (await mount(React.createElement(LeagueLobbyDesktop, props))).innerHTML;
    flag.on = false;
    const off = (await mount(React.createElement(LeagueLobbyDesktop, props))).innerHTML;
    expect(excise(on)).toBe(off);
    const strip = expectInCentre(on);
    expect(strip).toBeGreaterThan(at(on, AUTO_DRAFT));
    expect(strip).toBeLessThan(at(on, BRACKET_LINE));
    hooked.myGroup = { id: 'wk-real-1', status: 'battle' };
    flag.on = true;
    const seatedOn = (await mount(React.createElement(LeagueLobbyDesktop, props))).innerHTML;
    flag.on = false;
    const seatedOff = (await mount(React.createElement(LeagueLobbyDesktop, props))).innerHTML;
    expect(excise(seatedOn)).toBe(seatedOff);
    const seated = expectInCentre(seatedOn);
    expect(seated).toBeGreaterThan(at(seatedOn, HERO));
    expect(seated).toBeLessThan(at(seatedOn, WATCH));
    expect(seated).toBeLessThan(at(seatedOn, BRACKET_LINE));
  });
});

describe('the strip itself on the landing', () => {
  it('reads the close from each pool’s closesAt — a Wednesday fire close reads Wednesday, never Sunday', async () => {
    hooked.state = NO_BRACKET;
    hooked.pods = podsResponse(WED_FIRE);
    flag.on = true;
    const on = (await mount(React.createElement(LeagueHome, props))).innerHTML;
    expect(on).toContain('Closes Wed 7:00 PM ET');
    expect(on).not.toContain('Sun 11:59');
  });

  it('while the pod list is still loading, no strip and no placeholder frame render — the landing is the flag-off landing', async () => {
    hooked.state = NO_BRACKET;
    hooked.pods = { data: null, pods: [], loading: true, error: null, refresh: () => {} };
    flag.on = true;
    const on = (await mount(React.createElement(LeagueHome, props))).innerHTML;
    flag.on = false;
    const off = (await mount(React.createElement(LeagueHome, props))).innerHTML;
    expect(on).not.toContain('data-backing');
    expect(on.split('Tap a seat · Predictions').join('Tap a seat to spectate')).toBe(off);
  });

  it('with no pods and no stakes the strip says there is nothing to back yet — never "0 pods"', async () => {
    hooked.state = NO_BRACKET;
    hooked.pods = { data: { baseLayerWeek: '2026-W40', backingWeekCloses: SUNDAY_CLOSE, pods: [] }, pods: [], loading: false, error: null, refresh: () => {} };
    flag.on = true;
    const on = (await mount(React.createElement(LeagueHome, props))).innerHTML;
    expect(on).toContain('data-strip-state="quiet"');
    expect(on).toContain('No pods to back yet');
    expect(on).not.toContain('0 pods');
  });

  it('a server render of the mobile landing carries no strip: it mounts once the seat subscription has answered (N3 / WIRE-7)', () => {
    hooked.state = NO_BRACKET;
    hooked.pods = podsResponse();
    flag.on = true;
    expect(render(LeagueHome)).not.toContain('data-backing="strip"');
  });
});
