// @vitest-environment jsdom
//
// src/components/CommandCenter/CommandCenterHub.huddleCohort.jsdom.test.jsx
//
// Huddle S1.1 — THE HUB OUTSIDE THE COHORT IS THE FLAG-OFF HUB, BYTE FOR BYTE (Amendment E §E7; build prompt hard
// rule 2). With DRB_HUDDLE_ENABLED on, a player the hub's two readers do not show inside HUDDLE_PLAYER_UIDS — the status
// route's 404, any failed read, no record today and none in history, or reads still out — must see exactly what the flag
// off renders: the reserved Partnership text and summary, no chip, no Huddle next action, no Reconfirm line. Membership
// comes from the readers the hub already has (hub/huddleView.js huddleMemberOf); no new reader.
//
// Each row renders the connected hub with the flag held OFF, then with it ON under the reader answers named, and compares
// the whole document body (React useId values renumbered: two mounts number their ids apart). The control row shows the
// comparison bites: a player inside the cohort renders differently.

import React, { act } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { userState } = vi.hoisted(() => ({ userState: { user: { displayName: 'Flash', username: 'flash' } } }));
vi.mock('../../contexts/UserContext', () => ({ useUser: () => userState }));
vi.mock('../../firebase/config', () => ({ db: {}, auth: {}, default: {} }));
const r = vi.hoisted(() => ({ identity: null, agent: null, window: null, market: null, brief: null }));
vi.mock('../../services/authIdentity', () => ({ useAuthIdentity: () => r.identity }));
vi.mock('../../hooks/useAgent', () => ({ default: () => r.agent }));
vi.mock('./hub/useHubCompletedBattles', () => ({ default: () => r.window }));
vi.mock('../../utils/marketSchedule', () => ({ getMarketState: () => r.market }));
vi.mock('../../services/forgeWatchlistService', () => ({ listWatchlists: async () => [] }));
vi.mock('../../hooks/useDailyRegimeBrief', () => ({ default: function useDailyRegimeBrief() { return r.brief; } }));
const flag = vi.hoisted(() => ({ on: false }));
vi.mock('../../config/huddleFlags', () => ({ get DRB_HUDDLE_ENABLED() { return flag.on; } }));
const service = vi.hoisted(() => ({
  fetchHuddleToday: vi.fn(), confirmHuddlePlan: vi.fn(), skipHuddlePlan: vi.fn(),
  issueHuddlePlayback: vi.fn(), sendHuddleEvent: vi.fn(async () => ({ ok: true })), fetchHuddleHistory: vi.fn(async () => []),
}));
vi.mock('../../services/huddleService', () => service);

import CommandCenterHub from './CommandCenterHub';
import { HUB_COPY as COPY } from './hub/hubCopy';
import { injectTokens, installFakeLayout, mount, mountFakeBottomNav } from './__fixtures__/hubTestKit';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// Each row mounts the hub twice and lets both renders come to rest (about 2 s alone): room under a wide parallel suite.
vi.setConfig({ testTimeout: 20000 });

// Fri Oct 23 2026, 9:00 AM ET: before the open.
const NOW = Date.UTC(2026, 9, 23, 13, 0);
const UID = 'uid-A';
const iso = (ms) => new Date(ms).toISOString();
const HOUR = 3600 * 1000;
const RANKED_PREOPEN = { id: 'rk_wait', ownerId: UID, agentId: 'agent-a', groupId: 'g1', status: 'active', activatedAt: iso(NOW - HOUR), expiresAt: iso(NOW + 8 * HOUR), scoreState: { currentScore: 0, tradeCount: 0, evaluationCount: 0, lastScoredAt: null } };
const HUDDLE = {
  etDate: '2026-10-23', status: 'ready', session: { etDate: '2026-10-23', openMs: Date.UTC(2026, 9, 23, 13, 30), closeMs: Date.UTC(2026, 9, 23, 20, 0) },
  audio: null, script: { beats: [{ id: 'tape', text: 'The tape was firm.', source: 'model' }] }, cards: [], evidence: [], names: [],
  plan: { status: 'confirmed', revision: 'r1', current: { stances: [{ kind: 'HOLD', ticker: 'AAA' }], lines: [] }, confirmations: [{ revision: 'r1', archetype: 'contrarian', confirmedAt: iso(NOW - HOUR) }], battles: [], eventLabels: {}, reconfirm: { missing: ['degen'] } },
};
const HISTORY = [{ etDate: '2026-10-22', status: 'ready', planStatus: 'confirmed', confirmedAt: iso(NOW - 24 * HOUR), skippedAt: null, stances: ['HOLD AAA'] }];
const notFound = () => Object.assign(new Error('not_found'), { status: 404 });
const serverError = () => Object.assign(new Error('status_failed'), { status: 500 });

const agentReady = () => ({ status: 'ready', agent: { id: 'agent-a', archetype: 'degen', stats: { gamesPlayed: 3 } }, ownerUid: UID, ownerEpoch: 2, readError: null, retry: vi.fn() });
const windowOf = (battles) => ({ battles, status: 'ready', error: null, ownerUid: UID, ownerEpoch: 2, lastSuccessfulAt: NOW - 60000, generation: 1, reviews: {}, checking: false, refreshing: false, nextAttemptAt: null, carried: false, refresh: vi.fn() });
const pollMeta = () => ({ epoch: 2, status: 'ready', ownerUid: UID, ownerEpoch: 2, lastSuccessfulAt: NOW - 30000, error: null, refreshing: false });
const hubOf = () => ({ activeBattles: [RANKED_PREOPEN], activePoll: pollMeta(), refreshActiveBattles: vi.fn(), openGame: vi.fn(), openFilmRoom: vi.fn() });

let layout;
let removeTokens;
let removeNav;
let mounted = [];
beforeAll(() => { removeTokens = injectTokens(); });
afterAll(() => { removeTokens(); });
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  sessionStorage.clear();
  r.identity = { resolved: true, uid: UID, authEpoch: 2 };
  r.agent = agentReady();
  r.window = windowOf([]);
  r.market = { state: 'CLOSED_PREMARKET', isOpen: false };
  r.brief = { dailyBrief: null, keyEvents: [], themes: [], forDate: null, generatedAt: null, isStale: false, loading: false, error: null, refetch: vi.fn() };
  layout = installFakeLayout();
  removeNav = mountFakeBottomNav();
});
afterEach(() => {
  for (const m of mounted) m.unmount();
  mounted = [];
  sessionStorage.clear();
  removeNav();
  layout.restore();
  vi.clearAllMocks();
  vi.useRealTimers();
  flag.on = false;
});

/** Where two bodies first differ, with context (null when identical): a readable failure for a byte comparison. */
const firstDiff = (a, b) => { if (a === b) return null; let i = 0; while (i < a.length && a[i] === b[i]) i += 1; return { at: i, on: a.slice(Math.max(0, i - 160), i + 160), off: b.slice(Math.max(0, i - 160), i + 160) }; };

/** React's useId values, renumbered in order of appearance (two mounts number their ids apart). */
const stableIds = (html) => { const seen = new Map(); return html.replace(/_r_[0-9a-z]+_/g, (id) => { if (!seen.has(id)) seen.set(id, `_r_${seen.size}_`); return seen.get(id); }); };

async function bodyOf(site, { on, settle = true }) {
  flag.on = on;
  layout.state.hubWidth = site === 'mobile' ? 390 : 1216;
  const m = mount(<CommandCenterHub site={site} hub={hubOf()} />);
  if (settle) await act(async () => { for (let i = 0; i < 6; i += 1) await Promise.resolve(); });
  // Let every entrance animation finish (motion runs on the real clock): both renders are compared at rest.
  await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 900); }); });
  const html = stableIds(document.body.innerHTML);
  m.unmount();
  return html;
}

const OUTSIDE = {
  'the status route\'s 404 (outside the cohort), empty history': () => {
    service.fetchHuddleToday.mockRejectedValue(notFound());
    service.fetchHuddleHistory.mockResolvedValue([]);
  },
  'a 404 even with a history (a player since removed from the cohort)': () => {
    service.fetchHuddleToday.mockRejectedValue(notFound());
    service.fetchHuddleHistory.mockResolvedValue(HISTORY);
  },
  'answered with no record today and no history': () => {
    service.fetchHuddleToday.mockResolvedValue({ asOf: iso(NOW), huddle: null });
    service.fetchHuddleHistory.mockResolvedValue([]);
  },
  'a failed read (any error) even with a history': () => {
    service.fetchHuddleToday.mockRejectedValue(serverError());
    service.fetchHuddleHistory.mockResolvedValue(HISTORY);
  },
  'both reads failed': () => {
    service.fetchHuddleToday.mockRejectedValue(serverError());
    service.fetchHuddleHistory.mockRejectedValue(new Error('permission-denied'));
  },
};

describe('E7: flag ON, the player outside the cohort — the hub is byte-identical to the flag-off hub', () => {
  for (const site of ['desktop', 'mobile']) {
    it.each(Object.keys(OUTSIDE))(`${site}: %s`, async (name) => {
      OUTSIDE[name]();
      const off = await bodyOf(site, { on: false });
      const on = await bodyOf(site, { on: true });
      expect(service.fetchHuddleToday).toHaveBeenCalled(); // the flag-on render did read (the comparison is not vacuous)
      expect(firstDiff(on, off)).toBeNull();
      expect(on).toContain(COPY.partnership.summary);
      expect(on).not.toContain('data-hub-huddle-chip');
    });

    it(`${site}: while both reads are still out (loading) — byte-identical too`, async () => {
      service.fetchHuddleToday.mockReturnValue(new Promise(() => {}));
      service.fetchHuddleHistory.mockReturnValue(new Promise(() => {}));
      const off = await bodyOf(site, { on: false, settle: false });
      const on = await bodyOf(site, { on: true, settle: false });
      expect(firstDiff(on, off)).toBeNull();
    });
  }
});

describe('control: a player INSIDE the cohort renders the Huddle (the comparison bites)', () => {
  it.each(['desktop', 'mobile'])('%s: a record today puts the chip and the Partnership plan line on the hub', async (site) => {
    service.fetchHuddleToday.mockResolvedValue({ asOf: iso(NOW), huddle: HUDDLE });
    service.fetchHuddleHistory.mockResolvedValue([]);
    const off = await bodyOf(site, { on: false });
    const on = await bodyOf(site, { on: true });
    expect(on).not.toBe(off);
    expect(on).toContain('data-hub-huddle-chip');
  });

  it('desktop: no record today but a history is inside too (the Partnership panel shows the plans)', async () => {
    service.fetchHuddleToday.mockResolvedValue({ asOf: iso(NOW), huddle: null });
    service.fetchHuddleHistory.mockResolvedValue(HISTORY);
    const off = await bodyOf('desktop', { on: false });
    const on = await bodyOf('desktop', { on: true });
    expect(on).not.toBe(off);
    expect(on).not.toContain(COPY.partnership.summary);
  });
});
