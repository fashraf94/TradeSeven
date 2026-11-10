// @vitest-environment jsdom
//
// src/components/CommandCenter/CommandCenterHub.huddle.jsdom.test.jsx
//
// Huddle S1 — the hub WITH DRB_HUDDLE_ENABLED on (the flag module mocked; main keeps it off): ConnectedHub's Huddle block
// end to end — the record's reader, the chip beside the stage, the sheet, the next action's Huddle rule and its actions,
// and Partnership's summary (Huddle spec Amendment C V1.2 §C4, §C6, §C7, §C8; Command Center spec V1.2 Amendment D §D1,
// §D5). Review L3-6: before this suite no row ran the flag-on wiring, which is how L3-1 (the card and its Open naming
// different games) slipped through. The setup mirrors CommandCenterHub.s4.jsdom.test.jsx.

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
vi.mock('../../config/huddleFlags', () => ({ DRB_HUDDLE_ENABLED: true }));
const service = vi.hoisted(() => ({
  fetchHuddleToday: vi.fn(), confirmHuddlePlan: vi.fn(), skipHuddlePlan: vi.fn(),
  issueHuddlePlayback: vi.fn(), sendHuddleEvent: vi.fn(async () => ({ ok: true })), fetchHuddleHistory: vi.fn(async () => []),
}));
vi.mock('../../services/huddleService', () => service);

import CommandCenterHub from './CommandCenterHub';
import { HUB_COPY as COPY } from './hub/hubCopy';
import { byRole, click, injectTokens, installFakeLayout, mount, mountFakeBottomNav } from './__fixtures__/hubTestKit';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Fri Oct 23 2026, 9:00 AM ET: before the open.
const NOW = Date.UTC(2026, 9, 23, 13, 0);
const UID = 'uid-A';
const iso = (ms) => new Date(ms).toISOString();
const HOUR = 3600 * 1000;
// A ranked game deployed and waiting for the open, and a multi-day BaggerBomb game already scored (in session).
const RANKED_PREOPEN = { id: 'rk_wait', ownerId: UID, agentId: 'agent-a', groupId: 'g1', status: 'active', activatedAt: iso(NOW - HOUR), expiresAt: iso(NOW + 8 * HOUR), scoreState: { currentScore: 0, tradeCount: 0, evaluationCount: 0, lastScoredAt: null } };
const BB_SCORED = { id: 'bb_live', ownerId: UID, agentId: `casual-agent-${UID}`, status: 'active', activatedAt: iso(NOW - 20 * HOUR), expiresAt: iso(NOW + 30 * HOUR), scoreState: { currentScore: 3.1, tradeCount: 1, evaluationCount: 4, lastScoredAt: iso(NOW - 15 * HOUR) } };
const HUDDLE = {
  etDate: '2026-10-23', status: 'ready', session: { etDate: '2026-10-23', openMs: Date.UTC(2026, 9, 23, 13, 30), closeMs: Date.UTC(2026, 9, 23, 20, 0) },
  audio: null, script: { beats: [{ id: 'tape', text: 'The tape was firm.', source: 'model' }] }, cards: [], evidence: [], names: [],
  plan: { status: 'proposed', revision: 'r1', current: { stances: [{ kind: 'HOLD', ticker: 'AAA' }], lines: [] }, confirmations: [], battles: [], eventLabels: {} },
};

const agentReady = () => ({ status: 'ready', agent: { id: 'agent-a', archetype: 'degen', stats: { gamesPlayed: 3 } }, ownerUid: UID, ownerEpoch: 2, readError: null, retry: vi.fn() });
const windowOf = (battles) => ({ battles, status: 'ready', error: null, ownerUid: UID, ownerEpoch: 2, lastSuccessfulAt: NOW - 60000, generation: 1, reviews: {}, checking: false, refreshing: false, nextAttemptAt: null, carried: false, refresh: vi.fn() });
const pollMeta = () => ({ epoch: 2, status: 'ready', ownerUid: UID, ownerEpoch: 2, lastSuccessfulAt: NOW - 30000, error: null, refreshing: false });
const hubOf = (over = {}) => ({ activeBattles: [], activePoll: pollMeta(), refreshActiveBattles: vi.fn(), openGame: vi.fn(), openFilmRoom: vi.fn(), ...over });

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
  service.fetchHuddleToday.mockResolvedValue({ asOf: iso(NOW), huddle: HUDDLE });
  service.fetchHuddleHistory.mockResolvedValue([]);
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
});

async function render(site, hub) {
  layout.state.hubWidth = site === 'mobile' ? 390 : 1216;
  const m = mount(<CommandCenterHub site={site} hub={hub} />);
  mounted.push(m);
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  return m;
}
const nextCard = () => document.querySelector('[data-hub-next-action]');
const dialog = () => document.querySelector('[role="dialog"]');

describe('the hub with the Huddle on (review L3-6)', () => {
  it('reads the record once on mount; the chip sits beside the stage and opens the sheet with the transcript', async () => {
    await render('desktop', hubOf());
    expect(service.fetchHuddleToday).toHaveBeenCalledTimes(1);
    const chip = document.querySelector('[data-hub-huddle-chip] button');
    expect(chip.textContent).toBe('Huddle');
    expect(chip.closest('[data-hub-slot="stage"]')).not.toBeNull();
    await act(async () => { click(chip); await Promise.resolve(); });
    expect(dialog().textContent).toContain('The tape was firm.');
  });

  it('"Huddle ready" sits above a game waiting for the open; its Open opens the sheet', async () => {
    await render('desktop', hubOf({ activeBattles: [RANKED_PREOPEN] }));
    expect(nextCard().getAttribute('data-hub-next-action')).toBe('huddle');
    expect(nextCard().textContent).toContain(COPY.huddle.readyTitle);
    await act(async () => { click(byRole(nextCard(), 'button', COPY.huddle.open)[0]); await Promise.resolve(); });
    expect(dialog()).not.toBeNull();
  });

  it('L3-1: a game in session outranks the Huddle, and the card\'s Open opens THAT game, not the ranked game waiting for the open', async () => {
    const hub = hubOf({ activeBattles: [RANKED_PREOPEN, BB_SCORED] });
    await render('desktop', hub);
    expect(nextCard().getAttribute('data-hub-next-action')).toBe('openGame');
    click(byRole(nextCard(), 'button', COPY.nextAction.openGame)[0]);
    expect(hub.openGame).toHaveBeenCalledTimes(1);
    expect(hub.openGame.mock.calls[0][0].id).toBe('bb_live');
  });

  it('Partnership\'s summary beside Shadow says today\'s plan, not "Not in this release"', async () => {
    await render('desktop', hubOf());
    const stage = document.querySelector('[data-hub-slot="stage"]');
    expect(stage.textContent).toContain(COPY.huddle.planState.proposed);
    expect(stage.textContent).not.toContain(COPY.partnership.summary);
  });
});
