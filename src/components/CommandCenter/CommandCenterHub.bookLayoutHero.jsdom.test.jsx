// @vitest-environment jsdom
//
// src/components/CommandCenter/CommandCenterHub.bookLayoutHero.jsdom.test.jsx
//
// The portfolio hub's slice 3 (spec docs/specs/20261126_COMMAND_CENTER_PORTFOLIO_HUB_BUILD_SPEC_V1.md PH-15, PH-17; report R6; review
// S3T-4): in the book layout the phone armory opens in its own sheet, around a centre figure that wears the preview, while today's hero
// stays in the stage behind it. The hero is paused while the sheet is open, so the phone draws one live figure, as today's hero-box
// armory does. The figures are seen through a probe of the AgentForm wrapper (as CommandCenterHub.armory.jsdom.test.jsx sees them),
// which is why this is a suite of its own: the probe draws no label, and the book layout suite reads the hero's.

import React, { Component, act } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const forms = vi.hoisted(() => ({ next: 0, live: new Map() }));
vi.mock('../AgentForm/AgentForm', () => ({
  default: class AgentFormProbe extends Component {
    constructor(props) { super(props); this.id = ++forms.next; this.history = []; }
    componentDidMount() { forms.live.set(this.id, this); this.props.onStatus?.('live'); }
    componentWillUnmount() { forms.live.delete(this.id); }
    render() { this.history.push(this.props); return null; }
  },
}));
vi.mock('../../config/commandCenterPortfolioFlags', () => ({ COMMAND_CENTER_PORTFOLIO_HUB_ENABLED: true }));
vi.mock('../../config/practiceFieldScreenFlags', () => ({ PRACTICE_FIELD_SCREEN_ENABLED: true }));
vi.mock('../../config/sharedResearchFlags', () => ({ SHARED_RESEARCH_MODE: 'off', SHARED_RESEARCH_MODES: Object.freeze(['off', 'allowlist', 'on']) }));
vi.mock('framer-motion', async (importOriginal) => ({ ...(await importOriginal()), useReducedMotion: () => true }));
vi.mock('../../contexts/UserContext', () => ({ useUser: () => ({ user: { displayName: 'Flash', username: 'flash' } }) }));
vi.mock('../../firebase/config', () => ({ db: {}, auth: {}, default: {} }));
vi.mock('firebase/auth', () => ({ getAuth: () => ({ currentUser: { getIdToken: async () => 'token' } }) }));
const r = vi.hoisted(() => ({ agent: null, window: null }));
vi.mock('../../services/authIdentity', () => ({ useAuthIdentity: () => ({ resolved: true, uid: 'uid-A', authEpoch: 2 }) }));
vi.mock('../../hooks/useAgent', () => ({ default: () => r.agent }));
vi.mock('./hub/useHubCompletedBattles', () => ({ default: () => r.window }));
vi.mock('../../utils/marketSchedule', () => ({ getMarketState: () => ({ state: 'OPEN', isOpen: true }) }));
vi.mock('../../services/forgeWatchlistService', () => ({ listWatchlists: async () => [] }));
vi.mock('../../services/leagueLockService', () => ({ subscribeLeagueLock: (uid, onLock) => { onLock({ locked: false, groupId: null, status: null, endsAtMs: null }); return () => {}; } }));
vi.mock('../../services/hypothesisVersionService', () => ({ listHypothesisVersions: vi.fn(async () => ({ watchlistId: 'wl-1', currentVersion: 0, versions: [], research: [] })) }));
vi.mock('../../hooks/useDailyRegimeBrief', () => ({ default: function useDailyRegimeBrief() { return { dailyBrief: null, keyEvents: [], themes: [], forDate: null, generatedAt: null, isStale: false, loading: true, error: null, refetch: () => {} }; } }));
const net = vi.hoisted(() => ({ book: null }));
vi.mock('../../utils/fetchWithAuth', () => ({
  fetchWithAuth: async (url) => (String(url) === '/api/practice-field/book'
    ? { ok: true, status: 200, json: async () => ({ book: net.book }) }
    : { ok: false, status: 404, json: async () => ({ error: 'not_found' }) }),
}));

import CommandCenterHub from './CommandCenterHub';
import { HUB_COPY as COPY, PORTFOLIO_HUB_COPY as BOOK_COPY, ARMORY_COPY } from './hub/hubCopy';
import { LOADOUT_COPY } from '../../constants/loadoutCopy';
import { buildBookView } from '../../../api/_utils/practiceField/bookView.js';
import { hubSceneInput } from '../../../api/_utils/practiceField/__testsupport__/bookViewScenesHub.js';
import { byRole, click, injectTokens, installFakeLayout, mount, mountFakeBottomNav, press } from './__fixtures__/hubTestKit';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const NOW = Date.UTC(2026, 10, 27, 15, 0);
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
  forms.live.clear();
  net.book = JSON.parse(JSON.stringify(buildBookView(hubSceneInput('sample'))));
  r.agent = { status: 'ready', agent: { id: 'agent-a', ownerId: 'uid-A', name: 'Atlas', archetype: 'degen', stats: { gamesPlayed: 3 } }, ownerUid: 'uid-A', ownerEpoch: 2, readError: null, retry: vi.fn() };
  r.window = { battles: [], status: 'ready', error: null, ownerUid: 'uid-A', ownerEpoch: 2, lastSuccessfulAt: NOW - 60000, generation: 1, reviews: {}, checking: false, refreshing: false, nextAttemptAt: null, carried: false, refresh: vi.fn() };
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
  vi.useRealTimers();
});

const flush = () => act(async () => { for (let i = 0; i < 8; i += 1) await Promise.resolve(); });
const propsOf = (form) => form.history.at(-1);
const all = () => [...forms.live.values()];
/** The stage's hero: the one figure with a response part (HubAgentForm's). */
const hero = () => all().find((f) => 'responsePart' in propsOf(f)) ?? null;
const liveViews = () => all().filter((f) => propsOf(f).rate !== 'still' && !propsOf(f).paused);
const dialogNamed = (name) => [...document.querySelectorAll('[role="dialog"]')].find((d) => d.getAttribute('aria-label') === name) ?? null;

describe('the phone armory\'s sheet in the book layout: the hero behind it is paused (one live figure, as today)', () => {
  it('the hero is live at rest, paused while the armory sheet is open (the sheet\'s centre the one live figure), and live again after Escape', async () => {
    layout.state.hubWidth = 390;
    const x = mount(<CommandCenterHub site="mobile" hub={{ activeBattles: [], activePoll: { epoch: 2, status: 'ready', ownerUid: 'uid-A', ownerEpoch: 2, lastSuccessfulAt: NOW - 30000, error: null, refreshing: false }, refreshActiveBattles: vi.fn(), openGame: vi.fn(), openFilmRoom: vi.fn() }} />);
    mounted.push(x);
    await flush();
    expect(document.querySelector('[data-hub-layout]').getAttribute('data-hub-layout')).toBe('book');
    const h = hero();
    expect(h).not.toBeNull();
    expect(propsOf(h).paused).toBe(false);
    click(byRole(document.querySelector('[data-hub-strip]'), 'button', /Open loadout$/)[0]);
    await flush();
    click(byRole(dialogNamed(BOOK_COPY.loadoutSheet), 'button', LOADOUT_COPY.changeArmor(LOADOUT_COPY.games.baggerbomb))[0]);
    await flush();
    const armory = dialogNamed(ARMORY_COPY.title);
    expect(armory).not.toBeNull();
    expect(hero()).toBe(h);
    expect(propsOf(h).paused).toBe(true);
    expect(liveViews()).toHaveLength(1);
    expect(liveViews()[0]).not.toBe(h);
    press(armory, 'Escape');
    await flush();
    expect(dialogNamed(ARMORY_COPY.title)).toBeNull();
    expect(hero()).toBe(h);
    expect(propsOf(h).paused).toBe(false);
    expect(COPY.sheet.close).toBe('Close');
  });
});
