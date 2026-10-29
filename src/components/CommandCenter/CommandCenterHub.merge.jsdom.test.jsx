// @vitest-environment jsdom
//
// Command Center hub — the S3 merge with S5: the one agent read behind the
// deploy state and the Loadout, through the real hub with its real readers
// (only the reads' sources are stand-ins). The shipped sheets are S5's
// recording stand-ins (__fixtures__/legacySheetStubs.jsx), so a row can see
// what the hub hands them. Review MR-1 and MR-7 of the merge round.

import React from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { userState } = vi.hoisted(() => ({ userState: { user: { displayName: 'Flash', username: 'flash' } } }));
vi.mock('../../contexts/UserContext', () => ({ useUser: () => userState }));
vi.mock('../../firebase/config', () => ({ db: {}, auth: {}, default: {} }));
// The Daily Regime Brief's read (hooks/useDailyRegimeBrief.js) is not under test here. Left real it reaches Firestore (`db` is `{}`),
// fails, and its 1.5 s retry can outlive this file (the PR #1003 CI flake). `loading` is the state the real read held for those 1.5 s.
vi.mock('../../hooks/useDailyRegimeBrief', () => ({
  default: function useDailyRegimeBrief() {
    return { dailyBrief: null, forDate: null, generatedAt: null, isStale: false, loading: true, error: null, refetch: () => {} };
  },
}));
const r = vi.hoisted(() => ({ identity: null, makeRead: null, retries: [], window: null }));
vi.mock('../../services/authIdentity', () => ({ useAuthIdentity: () => r.identity }));
// Every call of the agent hook is a read of its own: a second read would hand out a second Retry.
vi.mock('../../hooks/useAgent', () => ({ default: () => r.makeRead() }));
vi.mock('./hub/useHubCompletedBattles', () => ({ default: () => r.window }));
vi.mock('../../utils/marketSchedule', () => ({ getMarketState: () => ({ state: 'OPEN', isOpen: true }) }));
vi.mock('../../services/forgeWatchlistService', () => ({ listWatchlists: async () => [] }));
vi.mock('../Dashboard/AgentRecordSheet', async () => ({ default: (await import('./__fixtures__/legacySheetStubs')).AgentRecordSheetStub }));
vi.mock('../Dashboard/ArchetypePicker', async () => ({ default: (await import('./__fixtures__/legacySheetStubs')).ArchetypePickerStub }));
vi.mock('../Dashboard/EquipSheet', async () => ({ default: (await import('./__fixtures__/legacySheetStubs')).EquipSheetStub }));
vi.mock('../Dashboard/TraitsSheet', async () => ({ default: (await import('./__fixtures__/legacySheetStubs')).TraitsSheetStub }));

import CommandCenterHub from './CommandCenterHub';
import { HUB_COPY as COPY } from './hub/hubCopy';
import { resetSeen, seen } from './__fixtures__/legacySheetStubs';
import { byRole, click, injectTokens, installFakeLayout, mount, mountFakeBottomNav } from './__fixtures__/hubTestKit';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const NOW = Date.UTC(2026, 9, 22, 15, 0);
const UID = 'uid-A';
const NOVA = Object.freeze({ id: 'ag-1', ownerId: UID, name: 'Nova', archetype: 'momentum_chaser', equippedWatchlistId: 'wl-1', stats: { gamesPlayed: 3, wins: 1, losses: 0 } });
const readOf = (over = {}) => () => {
  const retry = vi.fn();
  r.retries.push(retry);
  return { status: 'ready', agent: NOVA, ownerUid: UID, ownerEpoch: 2, readError: null, retry, ...over };
};
const hubOf = (epoch = 2) => ({
  activeBattles: [],
  activePoll: { epoch, status: 'ready', ownerUid: UID, ownerEpoch: epoch, lastSuccessfulAt: NOW - 30000, error: null, refreshing: false },
  refreshActiveBattles: vi.fn(),
  openGame: vi.fn(),
  openFilmRoom: vi.fn(),
  setScreen: vi.fn(),
  onOpenForge: vi.fn(),
});

let layout;
let removeTokens;
let removeNav;
let mounted = [];

beforeAll(() => { removeTokens = injectTokens(); });
afterAll(() => { removeTokens(); });
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  resetSeen();
  layout = installFakeLayout();
  removeNav = mountFakeBottomNav();
  r.identity = { resolved: true, uid: UID, authEpoch: 2 };
  r.makeRead = readOf();
  r.retries = [];
  r.window = { battles: [], status: 'ready', error: null, ownerUid: UID, ownerEpoch: 2, lastSuccessfulAt: NOW, generation: 1, reviews: {}, checking: false, refreshing: false, nextAttemptAt: null, refresh: vi.fn() };
});
afterEach(() => {
  for (const m of mounted) m.unmount();
  mounted = [];
  removeNav();
  layout.restore();
  vi.useRealTimers();
});

function render(site, hub = hubOf()) {
  layout.state.hubWidth = site === 'mobile' ? 390 : 1216;
  const m = mount(<CommandCenterHub site={site} hub={hub} />);
  mounted.push(m);
  return m;
}
/** The Retry functions the clicks reached: one read behind every Retry is one function, called once per click. */
const calledRetries = () => r.retries.filter((fn) => fn.mock.calls.length > 0);

describe('one agent read behind every Retry (the S3 merge with S5; review MR-1)', () => {
  it('desktop: the Deploy card\'s Retry and the Loadout\'s Retry are the same read\'s', () => {
    r.makeRead = readOf({ status: 'error', agent: null, readError: new Error('unavailable') });
    render('desktop');
    const retries = byRole(document, 'button', COPY.loadout.retry);
    expect(retries.length).toBeGreaterThanOrEqual(2);
    for (const button of retries) click(button);
    expect(calledRetries()).toHaveLength(1);
    expect(calledRetries()[0]).toHaveBeenCalledTimes(retries.length);
  });

  it('phone, the Loadout tab: the strip\'s, the card\'s and the Loadout\'s Retry are the same read\'s', () => {
    r.makeRead = readOf({ status: 'error', agent: null, readError: new Error('unavailable') });
    render('mobile');
    click(byRole(document, 'tab', COPY.phoneTabs.loadout)[0]);
    const retries = byRole(document, 'button', COPY.loadout.retry);
    expect(retries).toHaveLength(3);
    for (const button of retries) click(button);
    expect(calledRetries()).toHaveLength(1);
    expect(calledRetries()[0]).toHaveBeenCalledTimes(3);
  });
});

describe('the record sheet is handed the read\'s own loading flag (review MR-7: a state the real reader reaches)', () => {
  it('open, then the identity moves on (a new epoch, the old read not yet replaced): the sheet stays open, handed no agent and loading', () => {
    const m = render('desktop');
    click(byRole(document, 'button', COPY.loadout.recordLabel('Nova'))[0]);
    expect(seen.record).toMatchObject({ open: true, loading: false });
    expect(seen.record.agent.id).toBe('ag-1');
    r.identity = { resolved: true, uid: UID, authEpoch: 3 };
    m.rerender(<CommandCenterHub site="desktop" hub={hubOf(3)} />);
    expect(seen.record).toMatchObject({ open: true, loading: true, agent: null });
  });
});
