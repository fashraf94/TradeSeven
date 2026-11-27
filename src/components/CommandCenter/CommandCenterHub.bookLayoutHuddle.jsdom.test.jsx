// @vitest-environment jsdom
//
// src/components/CommandCenter/CommandCenterHub.bookLayoutHuddle.jsdom.test.jsx
//
// The portfolio hub's slice 3 (build prompt: "the Huddle chip stays by the hero"; review S3T-11): a Huddle member who owns a book.
// In the book layout the Huddle chip keeps its place beside the hero, above the four tabs, on the phone and on the desktop, and it
// still opens the Huddle sheet. A suite of its own because the Huddle's reader is mocked here (the flag on, the service stubbed, as
// CommandCenterHub.huddle.jsdom.test.jsx does); the book layout suite has no Huddle member.

import React, { act } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/commandCenterPortfolioFlags', () => ({ COMMAND_CENTER_PORTFOLIO_HUB_ENABLED: true }));
vi.mock('../../config/practiceFieldScreenFlags', () => ({ PRACTICE_FIELD_SCREEN_ENABLED: true }));
vi.mock('../../config/sharedResearchFlags', () => ({ SHARED_RESEARCH_MODE: 'off', SHARED_RESEARCH_MODES: Object.freeze(['off', 'allowlist', 'on']) }));
vi.mock('../../config/huddleFlags', () => ({ DRB_HUDDLE_ENABLED: true }));
vi.mock('framer-motion', async (importOriginal) => ({ ...(await importOriginal()), useReducedMotion: () => true }));
vi.mock('../../contexts/UserContext', () => ({ useUser: () => ({ user: { displayName: 'Flash', username: 'flash' } }) }));
vi.mock('../../firebase/config', () => ({ db: {}, auth: {}, default: {} }));
vi.mock('firebase/auth', () => ({ getAuth: () => ({ currentUser: { getIdToken: async () => 'token' } }) }));
const r = vi.hoisted(() => ({ agent: null, window: null }));
vi.mock('../../services/authIdentity', () => ({ useAuthIdentity: () => ({ resolved: true, uid: 'uid-A', authEpoch: 2 }) }));
vi.mock('../../hooks/useAgent', () => ({ default: () => r.agent }));
vi.mock('./hub/useHubCompletedBattles', () => ({ default: () => r.window }));
vi.mock('../../utils/marketSchedule', () => ({ getMarketState: () => ({ state: 'CLOSED_PREMARKET', isOpen: false }) }));
vi.mock('../../services/forgeWatchlistService', () => ({ listWatchlists: async () => [] }));
vi.mock('../../services/leagueLockService', () => ({ subscribeLeagueLock: (uid, onLock) => { onLock({ locked: false, groupId: null, status: null, endsAtMs: null }); return () => {}; } }));
vi.mock('../../services/hypothesisVersionService', () => ({ listHypothesisVersions: vi.fn(async () => ({ watchlistId: 'wl-1', currentVersion: 0, versions: [], research: [] })) }));
vi.mock('../../hooks/useDailyRegimeBrief', () => ({ default: function useDailyRegimeBrief() { return { dailyBrief: null, keyEvents: [], themes: [], forDate: null, generatedAt: null, isStale: false, loading: true, error: null, refetch: () => {} }; } }));
const service = vi.hoisted(() => ({
  fetchHuddleToday: vi.fn(), confirmHuddlePlan: vi.fn(), skipHuddlePlan: vi.fn(),
  issueHuddlePlayback: vi.fn(), sendHuddleEvent: vi.fn(async () => ({ ok: true })), fetchHuddleHistory: vi.fn(async () => []),
}));
vi.mock('../../services/huddleService', () => service);
const net = vi.hoisted(() => ({ book: null }));
vi.mock('../../utils/fetchWithAuth', () => ({
  fetchWithAuth: async (url) => (String(url) === '/api/practice-field/book'
    ? { ok: true, status: 200, json: async () => ({ book: net.book }) }
    : { ok: false, status: 404, json: async () => ({ error: 'not_found' }) }),
}));

import CommandCenterHub from './CommandCenterHub';
import { HUB_COPY as COPY } from './hub/hubCopy';
import { buildBookView } from '../../../api/_utils/practiceField/bookView.js';
import { hubSceneInput } from '../../../api/_utils/practiceField/__testsupport__/bookViewScenesHub.js';
import { click, injectTokens, installFakeLayout, mount, mountFakeBottomNav } from './__fixtures__/hubTestKit';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Fri Nov 27 2026, 9:00 AM ET: before the open, the day's Huddle ready.
const NOW = Date.UTC(2026, 10, 27, 14, 0);
const iso = (ms) => new Date(ms).toISOString();
const HUDDLE = {
  etDate: '2026-11-27', status: 'ready', session: { etDate: '2026-11-27', openMs: Date.UTC(2026, 10, 27, 14, 30), closeMs: Date.UTC(2026, 10, 27, 21, 0) },
  audio: null, script: { beats: [{ id: 'tape', text: 'The tape was firm.', source: 'model' }] }, cards: [], evidence: [], names: [],
  plan: { status: 'proposed', revision: 'r1', current: { stances: [{ kind: 'HOLD', ticker: 'AAA' }], lines: [] }, confirmations: [], battles: [], eventLabels: {} },
};

let layout;
let removeTokens;
let removeNav;
let mounted = [];
let errorSpy;
beforeAll(() => { removeTokens = injectTokens(); });
afterAll(() => { removeTokens(); });
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  sessionStorage.clear();
  net.book = JSON.parse(JSON.stringify(buildBookView(hubSceneInput('sample'))));
  r.agent = { status: 'ready', agent: { id: 'agent-a', ownerId: 'uid-A', name: 'Atlas', archetype: 'degen', stats: { gamesPlayed: 3 } }, ownerUid: 'uid-A', ownerEpoch: 2, readError: null, retry: vi.fn() };
  r.window = { battles: [], status: 'ready', error: null, ownerUid: 'uid-A', ownerEpoch: 2, lastSuccessfulAt: NOW - 60000, generation: 1, reviews: {}, checking: false, refreshing: false, nextAttemptAt: null, carried: false, refresh: vi.fn() };
  service.fetchHuddleToday.mockResolvedValue({ asOf: iso(NOW), huddle: HUDDLE });
  service.fetchHuddleHistory.mockResolvedValue([]);
  layout = installFakeLayout();
  removeNav = mountFakeBottomNav();
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  for (const x of mounted) x.unmount();
  mounted = [];
  sessionStorage.clear();
  removeNav();
  layout.restore();
  errorSpy.mockRestore();
  vi.clearAllMocks();
  vi.useRealTimers();
});

const flush = () => act(async () => { for (let i = 0; i < 8; i += 1) await Promise.resolve(); });
async function render(site) {
  layout.state.hubWidth = site === 'mobile' ? 390 : 1216;
  const x = mount(<CommandCenterHub site={site} hub={{ activeBattles: [], activePoll: { epoch: 2, status: 'ready', ownerUid: 'uid-A', ownerEpoch: 2, lastSuccessfulAt: NOW - 30000, error: null, refreshing: false }, refreshActiveBattles: vi.fn(), openGame: vi.fn(), openFilmRoom: vi.fn() }} />);
  mounted.push(x);
  await flush();
  return x;
}
const precedes = (a, b) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe('a Huddle member\'s book layout: the Huddle chip stays by the hero (review S3T-11)', () => {
  it.each(['mobile', 'desktop'])('%s: the chip sits after the hero and before the four tabs, and opens the Huddle sheet', async (site) => {
    await render(site);
    expect(document.querySelector('[data-hub-layout]').getAttribute('data-hub-layout')).toBe('book');
    expect(service.fetchHuddleToday).toHaveBeenCalledTimes(1);
    const chips = [...document.querySelectorAll('[data-hub-huddle-chip] button')];
    expect(chips).toHaveLength(1);
    const [chip] = chips;
    expect(chip.textContent).toBe(COPY.huddle.chip(null));
    const hero = document.querySelector('[data-hub-stage]');
    const tabs = document.querySelector('[data-hub-book-tabs]');
    expect(hero).not.toBeNull();
    expect(tabs).not.toBeNull();
    expect(precedes(hero, chip)).toBe(true);
    expect(precedes(chip, tabs)).toBe(true);
    if (site === 'desktop') expect(chip.closest('[data-hub-slot="stage"]')).not.toBeNull();
    // Not drawn again inside the tabs' panel, the Overview included.
    expect(document.querySelector('[data-hub-book-panel] [data-hub-huddle-chip]')).toBeNull();
    await act(async () => { click(chip); await Promise.resolve(); });
    const dialog = [...document.querySelectorAll('[role="dialog"]')].find((d) => d.textContent.includes('The tape was firm.'));
    expect(dialog).toBeTruthy();
  });
});
