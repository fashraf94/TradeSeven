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
const svc = vi.hoisted(() => ({ calls: [], reply: null }));
const fetchSpy = vi.hoisted(() => vi.fn(async () => ({ ok: true, json: async () => ({ slots: [], battles: {} }) })));

vi.mock('../../../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  get BACKING_BETA_ENABLED() { return flag.on; },
}));
vi.mock('../../../services/backingService', () => ({
  fetchBackingPods: vi.fn(async () => {
    svc.calls.push('fetchBackingPods');
    if (svc.reply) return svc.reply;
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
  // PR 5: the results reader (one pod, or weeks), the two private stats
  // readers and the telemetry sink — every one counted, none reaching the wire.
  fetchBackingResults: vi.fn(async ({ groupId = null } = {}) => {
    svc.calls.push('fetchBackingResults');
    if (groupId) {
      return { viewerUid: 'viewer-1', pod: {
        groupId, poolId: groupId, weekKey: '2026-W39', status: 'resolved', outcome: 'settled', formationPath: 'lobby', slotId: null,
        seatNames: { 'od-a': 'Mira' }, humanTeams: 1, potTotal: 300, uniqueBackers: 3, winners: ['od-a'], winningStakes: 300, paysX: 1,
        closedAt: '2026-09-21T04:00:00.000Z', settledAt: '2026-09-25T22:30:00.000Z', refundedAt: null, refundReason: null, holdReason: null, monthKey: '2026-09',
        teams: [{ odUserId: 'od-a', isCpu: false, backerCount: 3, stakeTotal: 300, sharePct: 100, paysX: 1, won: true }],
        myStakes: [], myNet: null, myWon: null,
      } };
    }
    return { viewerUid: 'viewer-1', weeks: [], nextBefore: null, weeksAvailable: 0 };
  }),
  fetchMyBackingStats: vi.fn(async () => {
    svc.calls.push('fetchMyBackingStats');
    const zero = { poolsBacked: 0, poolsWon: 0, weeksPlayed: 0, pending: 0, net: 0 };
    const acc = { pools: 0, youWon: 0, baselineWon: 0, both: 0, excluded: 0 };
    return { label: 'beta stats', seasonKey: '2026-09', net: { career: 0, season: 0 }, career: zero, season: { monthKey: '2026-09', ...zero }, seasons: {}, accuracy: { career: acc, season: acc, seasons: {} } };
  }),
  fetchTrainerStats: vi.fn(async () => {
    svc.calls.push('fetchTrainerStats');
    const zero = { uniqueBackers: 0, bpBacked: 0, backersNet: 0, pending: 0, poolsBackedOn: 0, stakes: 0, decidedStakes: 0 };
    return { label: 'beta stats', seasonKey: '2026-09', career: zero, season: { monthKey: '2026-09', ...zero }, seasons: {}, excludedStakes: 0 };
  }),
  postBackingEvent: vi.fn(async () => { svc.calls.push('postBackingEvent'); return { recorded: true }; }),
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
// EquipStation's collaborators (the mobile pitch home) — stubbed the way
// MobilePresenceIdentity.smoke.test.jsx stubs them, so the station renders in
// isolation without its sheets' transitive Firestore graph.
vi.mock('../../../hooks/useForge', () => ({
  useForge: () => ({ forgedBundles: [], equippedBundles: [], equipBundleFn: vi.fn(), unequipBundleFn: vi.fn(), equippingBundleId: null, loading: false }),
}));
vi.mock('../../../services/forgeWatchlistService', () => ({ listWatchlists: () => Promise.resolve([]) }));
vi.mock('../../../services/agentService', () => ({ equipWatchlist: vi.fn(), unequipWatchlist: vi.fn(), changeArchetype: vi.fn() }));
vi.mock('../../Dashboard/EquipSheet', () => ({ default: () => null }));
vi.mock('../../Dashboard/RuleBundlePicker', () => ({ default: () => null }));
vi.mock('../../Dashboard/TraitsSheet', () => ({ default: () => null }));
vi.mock('../../Dashboard/ArchetypePicker', () => ({ default: () => null }));
vi.mock('../../Dashboard/EvolutionPreviewCard', () => ({ default: () => null }));

// The emitter's per-session dedup is reset before every row: a dark emit of a
// key a lit row already sent would otherwise be swallowed and the "opens NO
// read / makes NO request" rows could not see it (DARK-2, the PR 5 record).
const { __resetBackingTelemetry } = await import('../../../services/backingTelemetry');
const LeagueHome = (await import('../LeagueHome')).default;
const LeagueLobbyDesktop = (await import('../LeagueLobbyDesktop')).default;
const { PodCard, PodSheet } = await import('../LeaguePod');
const ScoutingLine = (await import('./ScoutingLine')).default;
const IdentityPanel = (await import('../../Dashboard/desktop/IdentityPanel')).default;
const EquipStation = (await import('../../Dashboard/EquipStation')).default;
const BackingScreen = (await import('./BackingScreen')).default;
const Spectate = (await import('../LeagueSpectate')).default;
const BackingStatsEntry = (await import('./BackingStatsEntry')).default;

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

beforeEach(() => { flag.on = false; svc.calls.length = 0; svc.reply = null; fetchSpy.mockClear(); __resetBackingTelemetry(); });
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

  it('the mobile pitch home (EquipStation) carries no backing element and NO EMPTY WRAPPER where the line sits', () => {
    const props = { agent: { id: 'a1', ownerId: 'viewer-1', name: 'Prime', archetype: 'momentum_chaser', stats: {} }, accent: '#5EEAD4', onOpenAgentRecord: () => {}, setShowForge: () => {} };
    const html = ssr(<EquipStation {...props} />);
    expect(html).not.toContain('data-backing');
    expect(html).toContain('Prime');
    // The DARK-1 class (multi-lens review, docs/audits/20260922_BACKING_PR4_MULTILENS_REVIEW.md):
    // a host-side wrapper that survives the null render as an empty element.
    expect(html).not.toMatch(/<div style="margin-top:12px"><\/div>/);
    flag.on = true;
    expect(ssr(<EquipStation {...props} />)).toContain('data-backing="scouting-line"');
  });

  it('the backing screen mounted DIRECTLY while dark renders nothing and opens NO read — its own gate, not the hosts’ (DARK-5; mutation check 8)', async () => {
    const container = await mount(<BackingScreen uid="viewer-1" onBack={() => {}} onOpenTape={() => {}} />);
    expect(container.innerHTML).toBe('');
    expect(svc.calls).toEqual([]);
    expect(backingCalls()).toEqual([]);
    // …and lit, the same mount fetches the pod list — the row is not vacuous.
    flag.on = true;
    const lit = await mount(<BackingScreen uid="viewer-1" onBack={() => {}} onOpenTape={() => {}} />);
    expect(lit.querySelector('[data-backing]')).not.toBeNull();
    expect(svc.calls).toContain('fetchBackingPods');
  });

  it('the Spectate FINAL state carries no backing element and opens NO read while dark; lit, the same mount fetches THIS pod\'s result once and renders the card — and a LIVE pod never does (PR 5, Surface E)', async () => {
    const finalPod = leagueState('open').baseGames.find((p) => p.base && p.status === 'final');
    const livePod = leagueState('open').baseGames.find((p) => p.base && p.status === 'live');
    expect(finalPod?.id).toBeTruthy();
    const props = { accent: '#5EEAD4', onBack: () => {}, onEnter: () => {} };
    expect(ssr(<Spectate pod={finalPod} {...props} />)).not.toContain('data-backing');
    const dark = await mount(<Spectate pod={finalPod} {...props} />);
    expect(dark.querySelector('[data-backing]')).toBeNull();
    expect(svc.calls).toEqual([]);
    expect(backingCalls()).toEqual([]);
    flag.on = true;
    const lit = await mount(<Spectate pod={finalPod} {...props} />);
    expect(svc.calls.filter((c) => c === 'fetchBackingResults')).toHaveLength(1);
    const { fetchBackingResults } = await import('../../../services/backingService');
    expect(fetchBackingResults.mock.calls.at(-1)[0]).toMatchObject({ groupId: finalPod.id });
    expect(lit.querySelector('[data-backing="spectate-results"]')).not.toBeNull();
    expect(lit.querySelector('[data-backing="results-card"]')).not.toBeNull();
    // The card is the FINAL state's: a live pod, lit, opens no result read.
    svc.calls.length = 0;
    const live = await mount(<Spectate pod={livePod} {...props} />);
    expect(live.querySelector('[data-backing="spectate-results"]')).toBeNull();
    expect(svc.calls).toEqual([]);
  });

  it('the stats home (BackingStatsEntry) mounted DIRECTLY while dark renders nothing and opens NO read; lit, it reads both stats once and the pitch home carries it (PR 5, D-v/D-w)', async () => {
    const dark = await mount(<BackingStatsEntry uid="viewer-1" />);
    expect(dark.innerHTML).toBe('');
    expect(svc.calls).toEqual([]);
    flag.on = true;
    const lit = await mount(<BackingStatsEntry uid="viewer-1" />);
    expect(lit.querySelector('[data-backing="stats-entry"]')).not.toBeNull();
    expect(svc.calls.filter((c) => c === 'fetchMyBackingStats')).toHaveLength(1);
    expect(svc.calls.filter((c) => c === 'fetchTrainerStats')).toHaveLength(1);
    expect(lit.textContent).toContain('beta stats');
    const props = { agent: { id: 'a1', ownerId: 'viewer-1', name: 'Prime', archetype: 'momentum_chaser', stats: {} }, accent: '#5EEAD4', onOpenAgentRecord: () => {}, setShowForge: () => {} };
    expect(ssr(<EquipStation {...props} />)).toContain('data-backing="stats-entry"');
    flag.on = false;
    expect(ssr(<EquipStation {...props} />)).not.toContain('data-backing');
  });

  it('EVERY other enumerated host, MOUNTED dark with effects running — the pitch home, the desktop lobby, the identity panel, the pod sheet — opens NO backing read and makes NO request (DARK-3 / DARK-R-1)', async () => {
    const agent = { id: 'a1', ownerId: 'viewer-1', name: 'Prime', archetype: 'momentum_chaser', stats: {} };
    const hosts = [
      ['EquipStation', <EquipStation agent={agent} accent="#5EEAD4" onOpenAgentRecord={() => {}} setShowForge={() => {}} />],
      ['LeagueLobbyDesktop', <LeagueLobbyDesktop {...homeProps} />],
      ['IdentityPanel', <IdentityPanel agent={{ ownerId: 'viewer-1', name: 'Prime', archetype: 'momentum_chaser', stats: {} }} accent="#5EEAD4" live={false} record="0-0" winRate={0} levelConfig={{ label: 'Rookie' }} nextLevelInfo={null} onOpenRecord={() => {}} />],
      ['PodSheet', <PodSheet pod={leagueState('open').baseGames[0]} accent="#5EEAD4" onClose={() => {}} onSpectate={() => {}} />],
    ];
    for (const [name, el] of hosts) {
      svc.calls.length = 0; fetchSpy.mockClear(); __resetBackingTelemetry();
      const container = await mount(el);
      expect(container.querySelector('[data-backing]'), `${name}: a backing element while dark`).toBeNull();
      expect(svc.calls, `${name}: a backing read while dark`).toEqual([]);
      expect(backingCalls(), `${name}: a backing request while dark`).toEqual([]);
    }
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
    // The viewer's backing is read under LAST week's key, this week's and the
    // window's (R-A-1 in the PR 4 review record) — one stake subscription each.
    const { subscribeMyStakes } = await import('../../../services/backingService');
    const keys = new Set(subscribeMyStakes.mock.calls.map((c) => c[1]));
    const { backingWeekKeys } = await import('./backingStripState');
    for (const k of backingWeekKeys(new Date(), '2026-W40')) expect(keys.has(k), `week key ${k} is read`).toBe(true);
    expect(keys.size).toBe(backingWeekKeys(new Date(), '2026-W40').length);
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

  it('the screen header says what the strip says — one mapping (R-B-1): a window whose pool closed at its fire reads "Closed · plays Monday"', async () => {
    flag.on = true;
    svc.reply = {
      baseLayerWeek: '2026-W40', backingWeekStart: '2026-09-21T04:00:00.000Z', backingWeekCloses: '2026-09-28T03:59:59.000Z', viewerUid: 'viewer-1',
      pods: [{
        groupId: 'lds-wed', formationPath: 'slot', slotId: 'wed-1900', baseLayerWeek: '2026-W40', seatNames: { 'od-a': 'Mira' }, humanTeams: 1, groupStatus: 'drafting',
        teams: [{ odUserId: 'od-a', isCpu: false, isOwnSeat: false, backable: false }],
        pool: { status: 'closed', backerProgress: { count: 1, floor: 3, met: false }, teamSpread: { met: false }, closesAt: '2026-09-23T23:00:00.000Z', closeReason: 'fire' },
        myStakes: [{ stakeId: 's1', teamOdUserId: 'od-a', amount: 250, status: 'live' }],
      }],
    };
    const container = await mount(<BackingScreen uid="viewer-1" onBack={() => {}} onOpenTape={() => {}} />);
    expect(container.querySelector('[data-backing="screen-state"]').textContent).toBe('Your backing · 1 pod · Closed · plays Monday');
    expect(container.textContent).not.toContain('Close pending');
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
    'src/components/League/backing/BackingScreen.jsx',
    // PR 5: the Spectate final state's card and the private stats' home.
    'src/components/League/backing/SpectateBackingResults.jsx',
    'src/components/League/backing/BackingStatsEntry.jsx',
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

  // A host that wraps a dark-gated mount in an element of its own leaves that
  // element behind while dark — the one defect class the flag-on-minus-strip
  // equality in backingLanding.test.jsx cannot see, because the wrapper is
  // present in both states (DARK-1/DARK-2 in the PR 4 multi-lens review).
  // Every mount of a gated backing component in a host is therefore held BARE
  // at the source: nothing opens right before it that closes right after it.
  const HOST_MOUNTS = [
    ['src/components/Dashboard/EquipStation.jsx', '<ScoutingLine'],
    ['src/components/Dashboard/desktop/IdentityPanel.jsx', '<ScoutingLine'],
    ['src/components/League/LeagueHome.jsx', '<BackingLandingStrip'],
    ['src/components/League/LeagueLobbyDesktop.jsx', '<BackingLandingStrip'],
    ['src/components/League/LeagueLobbyRedesign.jsx', '{backingSlot}'],
    // PR 5: the results card under the film room, the stats under the line.
    ['src/components/League/LeagueSpectate.jsx', '<SpectateBackingResults'],
    ['src/components/Dashboard/EquipStation.jsx', '<BackingStatsEntry'],
  ];
  const stripComments = (src) => src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  /**
   * JSX ATTRIBUTE-VALUE brace expressions removed (`={…}`, balanced) — and
   * ONLY those, so an attribute like `onClick={() => open()}` cannot hide an
   * opener's `>` (R-B-7) while a component's function body SURVIVES. The
   * previous stripper dropped every character at brace depth ≥ 1, and every
   * host mounts inside a block-bodied function, so `before` always ended at
   * the function signature and no wrapper could ever be seen — the guard was
   * vacuous on every real host (DARK-1, the PR 5 review record). The
   * positive-control row below wraps every REAL host's mount in memory and
   * demands the guard say so, so it cannot go vacuous again.
   */
  function stripAttributeBraces(src) {
    let out = '';
    let lastNonBlank = '';
    let i = 0;
    while (i < src.length) {
      const ch = src[i];
      if (ch === '{' && lastNonBlank === '=') {
        let depth = 1;
        i += 1;
        while (i < src.length && depth > 0) {
          if (src[i] === '{') depth += 1;
          else if (src[i] === '}') depth -= 1;
          i += 1;
        }
        lastNonBlank = '}';
        continue;
      }
      out += ch;
      if (!/\s/.test(ch)) lastNonBlank = ch;
      i += 1;
    }
    return out;
  }
  /** Every occurrence of `marker`, with the trimmed text right before (attribute braces stripped) and right after it. */
  function mountsOf(src, marker) {
    const out = [];
    for (let i = src.indexOf(marker); i >= 0; i = src.indexOf(marker, i + marker.length)) {
      const end = marker.startsWith('{') ? src.indexOf('}', i) + 1 : src.indexOf('/>', i) + 2;
      out.push({ before: stripAttributeBraces(src.slice(0, i)).trimEnd(), after: src.slice(end).trimStart() });
    }
    return out;
  }
  /** The real host file with its FIRST mount of `marker` wrapped in a sole-child element — the DARK-1 defect, planted in memory. */
  function wrappedInMemory(rel, marker) {
    const src = readFileSync(path.join(REPO, rel), 'utf8');
    const i = src.indexOf(marker);
    const end = marker.startsWith('{') ? src.indexOf('}', i) + 1 : src.indexOf('/>', i) + 2;
    return `${src.slice(0, i)}<div style={{ marginTop: 12 }}>\n${src.slice(i, end)}\n</div>${src.slice(end)}`;
  }
  /** True when the mount is the sole child of an element opened right before it and closed right after it. */
  function soleChildWrapped({ before, after }) {
    const opened = /<([a-z][\w-]*)(\s[^<>]*[^/<>])?>$/.exec(before);
    return opened != null && after.startsWith(`</${opened[1]}>`);
  }
  it('the mount guard sees a wrapper whose attributes carry a ">" (R-B-7), and passes a bare mount — inside a function body too', () => {
    const wrapped = mountsOf(stripComments('<div onClick={() => open()}>\n  <ScoutingLine uid={u} />\n</div>'), '<ScoutingLine');
    expect(wrapped.map(soleChildWrapped)).toEqual([true]);
    const bare = mountsOf(stripComments('{locked && (<div>x</div>)}\n<ScoutingLine uid={u} />\n<Other />'), '<ScoutingLine');
    expect(bare.map(soleChildWrapped)).toEqual([false]);
    // The DARK-1 shape: the same two cases inside `function Host() { return (…) }`.
    const inBody = (jsx) => `export default function Host({ u }) {\n  const locked = false;\n  return (\n    <section>\n      ${jsx}\n    </section>\n  );\n}`;
    expect(mountsOf(stripComments(inBody('<div onClick={() => open()}>\n  <ScoutingLine uid={u} />\n</div>')), '<ScoutingLine').map(soleChildWrapped)).toEqual([true]);
    expect(mountsOf(stripComments(inBody('{locked && (<div>x</div>)}\n<ScoutingLine uid={u} />\n<Other />')), '<ScoutingLine').map(soleChildWrapped)).toEqual([false]);
  });

  // THE POSITIVE CONTROL, on the real files: every host's mount, wrapped in
  // memory, must be SEEN as wrapped — the row that reds the day the guard's
  // pre-processing goes vacuous again (DARK-1, the PR 5 review record).
  for (const [rel, marker] of HOST_MOUNTS) {
    it(`the guard SEES a wrapper planted around ${marker} in ${rel} (positive control)`, () => {
      const mounts = mountsOf(stripComments(wrappedInMemory(rel, marker)), marker);
      expect(mounts.length).toBeGreaterThan(0);
      expect(soleChildWrapped(mounts[0]), `${rel}: the guard cannot see a wrapper around ${marker}`).toBe(true);
    });
  }
  for (const [rel, marker] of HOST_MOUNTS) {
    it(`${rel} mounts ${marker} bare — no host element of its own around it`, () => {
      const mounts = mountsOf(stripComments(readFileSync(path.join(REPO, rel), 'utf8')), marker);
      expect(mounts.length, `${marker} is mounted in ${rel}`).toBeGreaterThan(0);
      for (const mount of mounts) {
        expect(soleChildWrapped(mount), `${rel}: ${marker} is the sole child of a host element — that element survives the null render while dark`).toBe(false);
      }
    });
  }

  it('the hosts mount the strip through a component that returns null while dark — no wrapper, no reserved space', () => {
    const lobby = readFileSync(path.join(REPO, 'src/components/League/LeagueLobbyRedesign.jsx'), 'utf8');
    expect(lobby).toContain('{backingSlot}');
    expect(lobby).not.toMatch(/backingSlot && <div/);
    for (const rel of ['src/components/League/backing/BackingLandingStrip.jsx', 'src/components/League/backing/ScoutingLine.jsx', 'src/components/League/backing/BackingScreen.jsx', 'src/components/League/backing/SpectateBackingResults.jsx', 'src/components/League/backing/BackingStatsEntry.jsx']) {
      expect(readFileSync(path.join(REPO, rel), 'utf8'), `${rel} returns null while dark`).toContain('if (!BACKING_BETA_ENABLED) return null;');
    }
  });
});
