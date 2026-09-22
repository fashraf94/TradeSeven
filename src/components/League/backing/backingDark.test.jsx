// @vitest-environment jsdom
// src/components/League/backing/backingDark.test.jsx
//
// Backing Beta PR 4 — THE DARK PIN (build item I; spec V1.3 §12 "PR 1–5
// behind BACKING_BETA_ENABLED = false"). With the flag false the League
// renders BYTE-IDENTICALLY to today: no strip, no backing element, the
// "Spectate" label unchanged, no new network call, no new subscription, no
// layout shift. With the flag true the same mounts fetch the pod list and
// render the strip and the "Predictions" label — the row that proves the pin
// is not vacuous (BUILD_RULES §2 mutation check #3: the strip rendering with
// the flag false reds the dark rows below).
//
// THE FLAG IS A GETTER HERE so one file exercises both values; the shipped
// value is pinned by src/config/backingBetaFlags.test.js and nothing here
// asserts it.
//
// Two render modes: react-dom/server for the byte-level composition rows
// (no effects), and a jsdom mount with act() for the "opens no read" rows
// (effects run, so a subscription or a fetch would be counted).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { leagueState } from '../leagueFixtures';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..', '..');

const flag = vi.hoisted(() => ({ on: false }));
const svc = vi.hoisted(() => ({ calls: [] }));
const fetchSpy = vi.hoisted(() => vi.fn(async () => ({ ok: true, json: async () => ({ slots: [], battles: {} }) })));

vi.mock('../../../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  get BACKING_BETA_ENABLED() { return flag.on; },
}));
vi.mock('../../../services/backingService', () => ({
  fetchBackingPods: vi.fn(async () => {
    svc.calls.push('fetchBackingPods');
    return {
      baseLayerWeek: '2026-W40', backingWeekStart: '2026-09-21T04:00:00.000Z', backingWeekCloses: '2026-09-28T03:59:59.000Z', viewerUid: 'viewer-1',
      pods: [{
        groupId: 'g1', formationPath: 'lobby', slotId: null, baseLayerWeek: '2026-W40', seatNames: { 'od-a': 'Mira' }, humanTeams: 1,
        teams: [{ odUserId: 'od-a', isCpu: false, isOwnSeat: false, backable: true }, { odUserId: 'cpu-1', isCpu: true, isOwnSeat: false, backable: true }],
        pool: { status: 'open', backerProgress: { count: 0, floor: 3, met: false }, teamSpread: { met: false }, closesAt: '2026-09-28T03:59:59.000Z', closeReason: 'clock' },
        myStakes: [],
      }],
    };
  }),
  subscribeMyStakes: vi.fn((uid, weekKey, cb) => { svc.calls.push('subscribeMyStakes'); cb([]); return () => {}; }),
  subscribePool: vi.fn(() => { svc.calls.push('subscribePool'); return () => {}; }),
  subscribeWallet: vi.fn(() => { svc.calls.push('subscribeWallet'); return () => {}; }),
  readEligibility: vi.fn(async () => { svc.calls.push('readEligibility'); return null; }),
  subscribePitch: vi.fn(() => { svc.calls.push('subscribePitch'); return () => {}; }),
  fetchTapePod: vi.fn(async () => { svc.calls.push('fetchTapePod'); return null; }),
  fetchTeamCard: vi.fn(async () => { svc.calls.push('fetchTeamCard'); return null; }),
  placeStake: vi.fn(), attestEligibility: vi.fn(), savePitch: vi.fn(), newRequestId: () => 'req',
  BackingApiError: class BackingApiError extends Error {},
}));
vi.mock('../../../utils/fetchWithAuth', () => ({ fetchWithAuth: fetchSpy }));
vi.mock('../../../hooks/useLeagueState', () => ({ default: () => ({ state: leagueState('open'), loading: false, isFixtures: true }) }));
vi.mock('../../../contexts/UserContext', () => ({ useUser: () => ({ user: { uid: 'viewer-1', displayName: 'Viewer' } }) }));
vi.mock('../../../services/tournamentGroupService', () => ({
  subscribeMyGroup: () => () => {}, subscribeMyMostRecentVoidedGroup: () => () => {}, subscribeMyTrainingPod: () => () => {},
  subscribeGroup: () => () => {}, getGroup: async () => null, fetchDisplayNames: async () => ({}),
}));
vi.mock('../../../services/leagueSignals', () => ({ logLeagueSignal: () => {} }));
vi.mock('../../../services/tournamentLobbyActions', () => ({ quickPlay: () => Promise.resolve({}), quickPlayTraining: () => {}, mapLobbyError: () => 'error' }));
vi.mock('../../../services/liveDraftActions', () => ({
  fetchSlotSchedule: () => Promise.resolve({ slots: [] }), claimSlot: () => Promise.resolve({}), releaseSlot: () => Promise.resolve({}), mapSlotActionError: () => 'error',
}));
vi.mock('../LoadoutChooserSheet', () => ({ default: () => null }));

const LeagueHome = (await import('../LeagueHome')).default;
const LeagueLobbyDesktop = (await import('../LeagueLobbyDesktop')).default;
const { PodCard } = await import('../LeaguePod');
const ScoutingLine = (await import('./ScoutingLine')).default;
const IdentityPanel = (await import('../../Dashboard/desktop/IdentityPanel')).default;

const homeProps = { onOpenMyGame: () => {}, onOpenTrainingPod: () => {}, hasAgent: true, agentLoadout: null };
const ssr = (el) => renderToString(el);
const backingCalls = () => fetchSpy.mock.calls.map((c) => String(c[0])).filter((u) => /backing|team-card|team\/pitch|eligibility/.test(u));

let roots = [];
async function mount(el) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(el); });
  // let the mocked promises settle and effects re-run
  for (let i = 0; i < 4; i += 1) await act(async () => { await Promise.resolve(); });
  roots.push({ root, container });
  return container;
}

beforeEach(() => { flag.on = false; svc.calls.length = 0; fetchSpy.mockClear(); });
afterEach(async () => {
  for (const { root, container } of roots) { await act(async () => root.unmount()); container.remove(); }
  roots = [];
});

describe('flag OFF — the League renders as it does today', () => {
  it('mobile: no backing element, no strip, the spectate label unchanged, no "Predictions"', () => {
    const html = ssr(<LeagueHome {...homeProps} />);
    expect(html).not.toContain('data-backing');
    expect(html).toContain('Tap a seat to spectate');
    expect(html).not.toContain('Predictions');
    expect(html).not.toContain('Backing open');
  });

  it('desktop: no backing element in the rail, no overlay, the spectate label unchanged', () => {
    const html = ssr(<LeagueLobbyDesktop {...homeProps} />);
    expect(html).not.toContain('data-backing');
    expect(html).not.toContain('Predictions');
    expect(html).not.toContain('Backing');
  });

  it('the pod row footer is the shipped string, byte for byte', () => {
    const pod = leagueState('open').baseGames[0];
    const html = ssr(<PodCard pod={pod} accent="#5EEAD4" onSpectate={() => {}} />);
    expect(html).toContain('>Tap a seat to spectate<');
  });

  it('the profile homes render nothing: ScoutingLine is empty and the identity panel carries no backing element', () => {
    expect(ssr(<ScoutingLine uid="viewer-1" agentName="Prime" />)).toBe('');
    const html = ssr(<IdentityPanel agent={{ ownerId: 'viewer-1', name: 'Prime', archetype: 'momentum_chaser', stats: {} }} accent="#5EEAD4" live={false} record="0-0" winRate={0} levelConfig={{ label: 'Rookie' }} nextLevelInfo={null} onOpenRecord={() => {}} />);
    expect(html).not.toContain('data-backing');
    expect(html).toContain('Prime');
  });

  it('a mounted landing (effects running) opens NO backing read and makes NO backing request', async () => {
    const container = await mount(<LeagueHome {...homeProps} />);
    expect(container.querySelector('[data-backing]')).toBeNull();
    expect(svc.calls).toEqual([]);
    expect(backingCalls()).toEqual([]);
    expect(container.textContent).toContain('Tap a seat to spectate');
  });
});

describe('flag ON — the same mounts light up (the pin is not vacuous)', () => {
  it('mobile: the strip renders from the pod list, the label reads Predictions, and the pod list was fetched exactly once', async () => {
    flag.on = true;
    const container = await mount(<LeagueHome {...homeProps} />);
    expect(svc.calls.filter((c) => c === 'fetchBackingPods')).toHaveLength(1);
    expect(svc.calls).toContain('subscribeMyStakes');
    const strip = container.querySelector('[data-backing="strip"]');
    expect(strip).not.toBeNull();
    expect(strip.getAttribute('data-strip-state')).toBe('open');
    expect(strip.textContent).toContain('Backing open · 1 pod');
    expect(strip.textContent).toContain('Closes Sun 11:59 PM ET');
    expect(container.textContent).toContain('Tap a seat · Predictions');
    expect(container.textContent).not.toContain('Tap a seat to spectate');
  });

  it('desktop: the strip renders in the left rail', async () => {
    flag.on = true;
    const container = await mount(<LeagueLobbyDesktop {...homeProps} />);
    const strip = container.querySelector('.ld-rail-left [data-backing="strip"]');
    expect(strip).not.toBeNull();
    expect(strip.textContent).toContain('Backing open · 1 pod');
  });

  it('the profile home renders the scouting line', () => {
    flag.on = true;
    expect(ssr(<ScoutingLine uid="viewer-1" agentName="Prime" />)).toContain('data-backing="scouting-line"');
  });
});

describe('the flag is read at CALL time in every host — never captured at module scope', () => {
  for (const rel of [
    'src/components/League/LeaguePod.jsx',
    'src/components/League/backing/BackingLandingStrip.jsx',
    'src/components/League/backing/ScoutingLine.jsx',
  ]) {
    it(`${rel} has no module-level derivation of BACKING_BETA_ENABLED`, () => {
      const src = readFileSync(path.join(REPO, rel), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      expect(src).toContain('BACKING_BETA_ENABLED');
      // A top-level `const X = … BACKING_BETA_ENABLED …` would freeze the read
      // at import time (the LEAGUE_REDESIGN idiom is deliberate elsewhere; here
      // the contract is call-time).
      expect(src).not.toMatch(/^const [^\n]*BACKING_BETA_ENABLED/m);
    });
  }

  it('the hosts mount the strip through a component that returns null while dark — no wrapper, no reserved space', () => {
    const lobby = readFileSync(path.join(REPO, 'src/components/League/LeagueLobbyRedesign.jsx'), 'utf8');
    expect(lobby).toContain('{backingSlot}');
    expect(lobby).not.toMatch(/backingSlot && <div/);
    const strip = readFileSync(path.join(REPO, 'src/components/League/backing/BackingLandingStrip.jsx'), 'utf8');
    expect(strip).toContain('if (!BACKING_BETA_ENABLED) return null;');
  });
});
