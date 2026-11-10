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
// A ranked game deployed and waiting for the open, and a multi-day BaggerBomb game already scored. Before the open the scored
// game is LIVE_CLOSED — deployed and waiting, below "Huddle ready" (Amendment E §E6, ruling L3-11); with the market open it is
// in session, above it.
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
    // E6 re-pinned this row: a game is in session only with its market OPEN; the ranked game starts on a later day (PRE_OPEN)
    r.market = { state: 'OPEN', isOpen: true };
    const hub = hubOf({ activeBattles: [{ ...RANKED_PREOPEN, timing: { tradingDays: ['2026-10-26'] } }, BB_SCORED] });
    await render('desktop', hub);
    expect(nextCard().getAttribute('data-hub-next-action')).toBe('openGame');
    click(byRole(nextCard(), 'button', COPY.nextAction.openGame)[0]);
    expect(hub.openGame).toHaveBeenCalledTimes(1);
    expect(hub.openGame.mock.calls[0][0].id).toBe('bb_live');
  });

  it('E6 (L3-11): BEFORE the open, a multi-day game already scored (LIVE_CLOSED) waits below "Huddle ready"; Later on the Huddle shows that game', async () => {
    await render('desktop', hubOf({ activeBattles: [BB_SCORED] }));
    expect(nextCard().getAttribute('data-hub-next-action')).toBe('huddle');
    await act(async () => { click(byRole(nextCard(), 'button', COPY.nextAction.later)[0]); await Promise.resolve(); });
    expect(nextCard().getAttribute('data-hub-next-action')).toBe('openGame');
  });

  it('Partnership\'s summary beside Shadow says today\'s plan, not "Not in this release"', async () => {
    await render('desktop', hubOf());
    const stage = document.querySelector('[data-hub-slot="stage"]');
    expect(stage.textContent).toContain(COPY.huddle.planState.proposed);
    expect(stage.textContent).not.toContain(COPY.partnership.summary);
  });
});

// Huddle S1.1 — Amendment E §E8: the Deploy card's Reconfirm line through the LIVE layout. Main ships per-game loadouts and
// the armory on (src/config/perGameLoadoutFlags.js, agentFormFlags.js), so the hub renders the PerGameLoadoutScope arm
// (CommandCenterHub.jsx ConnectedHub) and the wide shell's live Deploy copy (the `reconfirm` prop in WideHub's
// PER_GAME_LOADOUT_ENABLED && AGENT_FORM_ARMORY_ENABLED arm) and, on a phone, PhoneTabs' Deploy card under the Loadout tab.
// Before these rows, removing either prop failed nothing (S1 merge, the mutant that survived). The door shows only when the
// status answer says an archetype in play has no confirmation (E1: the server's own acceptance predicate).
describe('E8: the Deploy card\'s Reconfirm line, through the live layout (per-game loadouts and the armory on)', () => {
  const confirmedWith = (missing) => ({
    ...HUDDLE,
    plan: { ...HUDDLE.plan, status: 'confirmed', confirmed: { revision: 'r1', archetype: 'contrarian', confirmedAt: iso(NOW - HOUR) }, confirmations: [{ revision: 'r1', archetype: 'contrarian', confirmedAt: iso(NOW - HOUR) }], reconfirm: { inPlay: ['contrarian', ...missing], missing } },
  });
  const deployCard = () => document.querySelector('[data-hub-section="deploy"]');

  it('desktop: an archetype in play with no confirmation puts the line and its Reconfirm door on the Deploy card; the door opens the Huddle sheet', async () => {
    service.fetchHuddleToday.mockResolvedValue({ asOf: iso(NOW), huddle: confirmedWith(['degen']) });
    await render('desktop', hubOf());
    const line = deployCard().querySelector('[data-hub-huddle-reconfirm]');
    expect(line).not.toBeNull();
    expect(line.textContent).toContain(COPY.huddle.deployReconfirm);
    await act(async () => { click(byRole(line, 'button', COPY.huddle.deployReconfirmDoor)[0] ?? line.querySelector('button')); await Promise.resolve(); });
    expect(dialog()).not.toBeNull();
    expect(dialog().querySelector('[data-huddle-reconfirm]')).not.toBeNull();
  });

  it('desktop: nothing missing — no line, no door (no door that does nothing)', async () => {
    service.fetchHuddleToday.mockResolvedValue({ asOf: iso(NOW), huddle: confirmedWith([]) });
    await render('desktop', hubOf());
    expect(deployCard()).not.toBeNull();
    expect(document.querySelector('[data-hub-huddle-reconfirm]')).toBeNull();
  });

  it('phone: the Loadout tab\'s Deploy card carries the same line, only while a confirmation is missing', async () => {
    service.fetchHuddleToday.mockResolvedValue({ asOf: iso(NOW), huddle: confirmedWith(['degen']) });
    await render('mobile', hubOf());
    await act(async () => { click(byRole(document, 'tab', COPY.phoneTabs.loadout)[0]); await Promise.resolve(); });
    const card = document.querySelector('[data-hub-deploy-card="phone"]');
    expect(card).not.toBeNull();
    expect(card.querySelector('[data-hub-huddle-reconfirm]')).not.toBeNull();
  });
});
