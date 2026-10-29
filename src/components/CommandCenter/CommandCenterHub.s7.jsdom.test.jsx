// @vitest-environment jsdom
//
// Command Center hub, slice S7 — Shadow in motion, as the hub wires it (rulings
// R-S7-1 … R-S7-7; spec V1.2 §10). Part one is the hub without App's object (the
// layout fixtures): which Shadow draws where, the labels, the area selection's
// response, the status line's words. Part two is the CONNECTED hub inside App's
// deploy provider: processing only while a hub-started deployment is submitting,
// the response once per attempt and never for an existing, refused or uncertain
// terminal, and the pause while the root ceremony covers the page.
//
// jsdom has no canvas: __fixtures__/shadowCanvasKit.js records what is drawn and
// runs frames when asked. Frame rates and layout are measured in headless Edge
// (S7 report), not here.

import React from 'react';
import { act } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  authListeners: [],
  deploy: null,
  posts: [],
  ceremony: false,
  verify: null,
  reduced: false,
  phone: 'canvas',
}));

vi.mock('firebase/auth', () => ({ onAuthStateChanged: (_auth, cb) => { h.authListeners.push(cb); return () => {}; } }));
vi.mock('../../firebase/config', () => ({ db: {}, auth: {}, default: {} }));
// The Daily Regime Brief's read (hooks/useDailyRegimeBrief.js) is not under test here. Left real it reaches Firestore (`db` is `{}`),
// fails, and its 1.5 s retry can outlive this file (the PR #1003 CI flake). `loading` is the state the real read held for those 1.5 s.
vi.mock('../../hooks/useDailyRegimeBrief', () => ({
  default: function useDailyRegimeBrief() {
    return { dailyBrief: null, forDate: null, generatedAt: null, isStale: false, loading: true, error: null, refetch: () => {} };
  },
}));
vi.mock('../../contexts/UserContext', () => ({ useUser: () => ({ user: { displayName: 'Flash', username: 'flash' } }) }));
vi.mock('framer-motion', async (importOriginal) => ({ ...(await importOriginal()), useReducedMotion: () => h.reduced }));
vi.mock('./hub/hubFlags', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, get PHONE_SHADOW() { return h.phone; } };
});
vi.mock('../../hooks/useAgent', () => ({
  default: (uid, options) => ({
    status: uid ? 'ready' : 'loading',
    agent: uid ? { id: `agent-${uid}`, ownerId: uid, name: 'Nova', archetype: 'momentum_chaser', stats: { gamesPlayed: 3, wins: 1, losses: 0 } } : null,
    ownerUid: uid ?? null,
    ownerEpoch: options?.ownerEpoch ?? null,
    readError: null,
    retry: () => {},
    activeDirectives: [],
  }),
}));
vi.mock('./hub/useHubCompletedBattles', async () => {
  const { readAuthIdentity } = await import('../../services/authIdentity');
  return {
    default: () => {
      const id = readAuthIdentity();
      return {
        battles: [], status: 'ready', error: null, ownerUid: id.uid, ownerEpoch: id.authEpoch, lastSuccessfulAt: Date.now(), generation: 1,
        reviews: {}, checking: false, refreshing: false, nextAttemptAt: null, refresh: () => {},
      };
    },
  };
});
vi.mock('../../utils/marketSchedule', () => ({ getMarketState: () => ({ state: 'OPEN', isOpen: true }) }));
vi.mock('../../services/forgeWatchlistService', () => ({ listWatchlists: async () => [] }));
vi.mock('../../services/agentDeploy', () => ({ deployAgent: (...args) => h.deploy(...args) }));
vi.mock('../../services/dueIdeaCheck', () => ({ checkDueIdea: async () => null }));
vi.mock('../../services/agentBattleVerify', () => ({ findActiveBattleForAgent: (...args) => h.verify(...args) }));
vi.mock('../../services/ownedBattleRead', () => ({ readOwnedBattle: async () => null }));
vi.mock('../../hooks/useDeployTargetProgress', () => ({ default: () => ({ deployProgress: null, lastDeployedAt: null, lastDecision: null, targetKnown: false }) }));
vi.mock('../Dashboard/deployCeremony/DeployCeremony', () => ({ default: (props) => <div data-ceremony={props.attemptId} /> }));
vi.mock('../Dashboard/ScoutingBoardSheet', () => ({
  default: (props) => (props.open ? (
    <div data-board="">
      <button type="button" data-board-deploy="" disabled={props.deployDisabled || props.deploying} onClick={async () => { const r = await props.onDeploy?.(); if (r?.success) props.onClose?.(); }}>
        Deploy this agent
      </button>
    </div>
  ) : null),
}));
vi.mock('../../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  isDeploySkyCouplingOn: () => true,
  isDeployCeremonyOn: () => h.ceremony,
}));

import CommandCenterHub from './CommandCenterHub';
import { DeployAttemptProvider, useDeployAttempt } from '../../contexts/DeployAttemptContext';
import { resetAuthIdentityForTests } from '../../services/authIdentity';
import { __resetHoldClaim } from '../../hooks/holdClaim';
import { HUB_COPY as COPY } from './hub/hubCopy';
import { HUB_LAYOUT_FIXTURES } from './__fixtures__/hubLayoutFixtures';
import { byRole, click, injectTokens, installFakeLayout, mount, mountFakeBottomNav } from './__fixtures__/hubTestKit';
import { installFakeCanvas } from './__fixtures__/shadowCanvasKit';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let layout;
let removeTokens;
let removeNav;
let kit;
let mounted = [];

beforeAll(() => { removeTokens = injectTokens(); });
afterAll(() => { removeTokens(); });
beforeEach(() => {
  resetAuthIdentityForTests();
  __resetHoldClaim();
  h.authListeners = [];
  h.posts = [];
  h.ceremony = false;
  h.reduced = false;
  h.phone = 'canvas';
  h.verify = vi.fn(async () => ({ found: false, battle: null }));
  h.deploy = vi.fn((agentId, onCreate, onTarget) => {
    let answer;
    const promise = new Promise((resolve) => { answer = resolve; });
    h.posts.push({ agentId, answer });
    onTarget?.(agentId);
    return promise;
  });
  layout = installFakeLayout();
  removeNav = mountFakeBottomNav();
  kit = installFakeCanvas();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  for (const m of mounted) m.unmount();
  mounted = [];
  removeNav();
  layout.restore();
  kit.restore();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const fixture = (name) => HUB_LAYOUT_FIXTURES[name].sections;
const R = (size) => size / 2.5;
const box = () => document.querySelector('[data-shadow-box]');
const label = () => box().getAttribute('data-shadow-status');
const status = () => document.querySelector('[data-hub-status]').textContent;
const strokesOfLastFrame = () => kit.log.frames.at(-1).strokes;

function renderFrame({ site, hubWidth, sections }) {
  layout.state.hubWidth = hubWidth;
  const m = mount(<CommandCenterHub site={site} sections={sections} />);
  mounted.push(m);
  return m;
}

/** The runs of consecutive frames that draw the center bloom's glow (radius R × 0.3): one run per response. */
function bloomRuns(size) {
  const { log } = kit.contexts.at(-1);
  const glow = R(size) * 0.3;
  let offset = 0;
  const present = log.frames.map((f) => {
    const arcs = log.arcs.slice(offset, offset + f.arcs);
    offset += f.arcs;
    return arcs.some(([, , r]) => Math.abs(r - glow) < 1e-9);
  });
  return present.filter((p, i) => p && !present[i - 1]).length;
}
const tick = (n = 1) => { for (let i = 0; i < n; i += 1) kit.tick(16); };

describe('which Shadow draws where (R-S7-1, R-S7-2)', () => {
  it.each([
    ['desktop', 1216, 340, 126],
    ['desktop (tablet width)', 770, 260, 126],
    ['desktop (stacked width)', 614, 260, 126],
  ])('the wide site at %s: the canvas at %i px, tier mid (%i strokes a frame)', (_name, hubWidth, size, strokes) => {
    renderFrame({ site: 'desktop', hubWidth, sections: fixture('returning') });
    expect(box().hasAttribute('data-shadow-canvas')).toBe(true);
    expect(box().style.width).toBe(`${size}px`);
    expect(strokesOfLastFrame()).toBe(strokes);
  });

  it.each([[390, 200], [360, 196]])('the phone at %i px: the canvas at %i px, tier low (30 strokes a frame) — never high anywhere', (hubWidth, size) => {
    renderFrame({ site: 'mobile', hubWidth, sections: fixture('returning') });
    expect(box().hasAttribute('data-shadow-canvas')).toBe(true);
    expect(box().style.width).toBe(`${size}px`);
    expect(strokesOfLastFrame()).toBe(30);
  });

  it('the tier is fixed for the session: a resize within the wide site changes the size, never the tier or the loop\'s count', () => {
    const m = renderFrame({ site: 'desktop', hubWidth: 1216, sections: fixture('returning') });
    // The hub measures its width after the first render, so the canvas was built twice (260 px, then 340 px): the first torn down.
    expect(kit.observers.filter((o) => !o.disconnected)).toHaveLength(1);
    layout.resize({ hubWidth: 770 });
    expect(box().style.width).toBe('260px');
    expect(strokesOfLastFrame()).toBe(126);
    expect(kit.observers.filter((o) => !o.disconnected)).toHaveLength(1);
    expect(kit.raf.queue).toHaveLength(1);
    expect(m.host.querySelectorAll('canvas')).toHaveLength(1);
  });

  it('reduced motion (the hub\'s one source) draws the still at every composition, and no canvas context is ever asked for', () => {
    h.reduced = true;
    for (const [site, hubWidth] of [['desktop', 1216], ['desktop', 770], ['mobile', 390]]) {
      const m = renderFrame({ site, hubWidth, sections: fixture('returning') });
      expect(document.querySelector('canvas')).toBeNull();
      expect(box().querySelector('svg')).not.toBeNull();
      expect(box().getAttribute('data-shadow-reduced-motion')).toBe('true');
      expect(label()).toBe('still');
      m.unmount();
      mounted = mounted.filter((x) => x !== m);
    }
    expect(kit.contexts).toHaveLength(0);
    expect(kit.raf.requested).toBe(0);
  });

  it('no canvas context (getContext returns nothing): the still, labelled "still", on both sites', () => {
    kit.state.context = 'null';
    for (const [site, hubWidth] of [['desktop', 1216], ['mobile', 390]]) {
      const m = renderFrame({ site, hubWidth, sections: fixture('returning') });
      expect(document.querySelector('canvas')).toBeNull();
      expect(label()).toBe('still');
      m.unmount();
      mounted = mounted.filter((x) => x !== m);
    }
  });

  it('a throwing context is the same: the still, and no error out of the hub', () => {
    kit.state.context = 'throw';
    expect(() => renderFrame({ site: 'desktop', hubWidth: 1216, sections: fixture('returning') })).not.toThrow();
    expect(document.querySelector('canvas')).toBeNull();
    expect(label()).toBe('still');
  });

  it('the phone constant (hubFlags PHONE_SHADOW) set to "still" gives the phone the still — and only the phone', () => {
    h.phone = 'still';
    const phone = renderFrame({ site: 'mobile', hubWidth: 390, sections: fixture('returning') });
    expect(document.querySelector('canvas')).toBeNull();
    expect(label()).toBe('still');
    phone.unmount();
    mounted = mounted.filter((x) => x !== phone);
    renderFrame({ site: 'desktop', hubWidth: 1216, sections: fixture('returning') });
    expect(document.querySelector('canvas')).not.toBeNull();
    expect(label()).toBe('ambient');
  });

  it('the shipped constant is "canvas"', async () => {
    const actual = await vi.importActual('./hub/hubFlags');
    expect(actual.PHONE_SHADOW).toBe('canvas');
  });
});

describe('labels name the state and the selected area (R-S7-4)', () => {
  it('ambient by default, with the area: the wide hub opens on Equipped Archetype, the phone on Overview (no area)', () => {
    renderFrame({ site: 'desktop', hubWidth: 1216, sections: fixture('returning') });
    expect(document.querySelector('canvas').getAttribute('aria-label')).toBe('Shadow — ambient; Equipped Archetype selected');
    expect(label()).toBe('ambient');
  });

  it('the phone: Overview names no area; the Research tab names Shared Research; labels follow the tab', () => {
    renderFrame({ site: 'mobile', hubWidth: 390, sections: fixture('returning') });
    expect(document.querySelector('canvas').getAttribute('aria-label')).toBe('Shadow — ambient');
    click(byRole(document, 'tab', COPY.phoneTabs.research)[0]);
    expect(document.querySelector('canvas').getAttribute('aria-label')).toBe('Shadow — ambient; Shared Research selected');
  });

  it('the label is not a live region: the status line stays the one', () => {
    renderFrame({ site: 'desktop', hubWidth: 1216, sections: fixture('returning') });
    expect(document.querySelectorAll('[aria-live]')).toHaveLength(1);
    expect(document.querySelector('canvas').closest('[aria-live]')).toBeNull();
  });

  it.each([
    ['ready', 'ambient'], ['checking', 'ambient'], ['verifying', 'ambient'], ['finishing', 'ambient'], ['confirmed', 'ambient'],
    ['existing', 'ambient'], ['failed', 'ambient'], ['uncertain', 'ambient'], ['blocked', 'ambient'], ['cooldown', 'ambient'],
    ['submitting', 'processing'],
  ])('a deploy display of "%s" draws %s: processing only while a hub-started deployment is submitting (R-S7-3)', (displayState, expected) => {
    renderFrame({ site: 'desktop', hubWidth: 1216, sections: { ...fixture('returning'), deploy: { displayState, canStart: false, cooldownUntil: Date.now() + 600000, reason: 'x' } } });
    expect(label()).toBe(expected);
    expect(document.querySelector('canvas').getAttribute('aria-label')).toBe(`Shadow — ${expected}; Equipped Archetype selected`);
  });

  it('a submitting deployment under reduced motion reads "still", not "processing" (the still has no processing to show)', () => {
    h.reduced = true;
    renderFrame({ site: 'desktop', hubWidth: 1216, sections: { ...fixture('returning'), deploy: { displayState: 'submitting', canStart: false } } });
    expect(label()).toBe('still');
    expect(status()).toBe(COPY.shadow.statusSubmitting);
  });
});

describe('the status line (R-S7-7)', () => {
  it('while the owned live read is not known (the default loading sections) it says "Idle", claiming nothing', () => {
    renderFrame({ site: 'desktop', hubWidth: 1216 });
    expect(status()).toBe('Idle');
  });

  it('with the read known and nothing live: "Idle · nothing running"', () => {
    renderFrame({ site: 'desktop', hubWidth: 1216, sections: fixture('returning') });
    expect(status()).toBe('Idle · nothing running');
  });

  it('an owned live game with no attempt shown: "Live game in progress"', () => {
    renderFrame({ site: 'desktop', hubWidth: 1216, sections: fixture('active') });
    expect(status()).toBe('Live game in progress');
  });

  it('two live games: "2 live games in progress"', () => {
    const active = fixture('active');
    const second = { ...active.games.rows.find((r) => r.live), id: 'game_other' };
    const games = { ...active.games, rows: [...active.games.rows, second] };
    renderFrame({ site: 'desktop', hubWidth: 1216, sections: { ...active, games } });
    expect(status()).toBe('2 live games in progress');
  });

  it('a game deployed after hours says what the strip and the Games row say, not "in progress" (review C-1)', () => {
    const active = fixture('active');
    const waiting = (r) => (r.live ? { ...r, preOpen: true, clock: COPY.games.waitingForOpen } : r);
    const sections = { ...active, games: { ...active.games, rows: active.games.rows.map(waiting) } };
    renderFrame({ site: 'desktop', hubWidth: 1216, sections });
    expect(status()).toBe('Deployed · waiting for the open');
    expect(status()).toBe(COPY.strip.deployed(COPY.games.waitingForOpen));
    const phone = renderFrame({ site: 'mobile', hubWidth: 390, sections });
    expect(document.querySelector('[data-hub-strip-line]').textContent).toBe(status());
    phone.unmount();
    mounted = mounted.filter((x) => x !== phone);
    // One that has opened beside one still waiting: the opened one is what is "in progress".
    const mixed = { ...active, games: { ...active.games, rows: [...active.games.rows, { ...waiting(active.games.rows.find((r) => r.live)), id: 'game_waiting' }] } };
    mixed.games.rows = mixed.games.rows.map((r, i) => (i === 0 ? active.games.rows[0] : r));
    renderFrame({ site: 'desktop', hubWidth: 1216, sections: mixed });
    expect([...document.querySelectorAll('[data-hub-status]')].at(-1).textContent).toBe('Live game in progress');
  });

  it('the checking fixture (games resolved, the live poll not): "Idle", not "nothing running" (review C-2)', () => {
    renderFrame({ site: 'desktop', hubWidth: 1216, sections: fixture('checking') });
    expect(status()).toBe('Idle');
  });

  it.each([
    ['verifying', 'Verifying deployment…'], ['finishing', 'Finishing deployment'], ['confirmed', 'Deployed'], ['existing', 'Already running'],
    ['failed', 'Deployment refused'], ['uncertain', 'Couldn’t confirm the deploy'], ['submitting', 'Submitting your deployment'],
  ])('an attempt shown ("%s") beats a live game: the Deploy card\'s own word, "%s"', (displayState, words) => {
    renderFrame({ site: 'desktop', hubWidth: 1216, sections: { ...fixture('active'), deploy: { displayState, canStart: false } } });
    expect(status()).toBe(words);
  });

  it('the phone says the same words, and its line wraps rather than truncates', () => {
    renderFrame({ site: 'mobile', hubWidth: 360, sections: { ...fixture('active'), deploy: { displayState: 'uncertain', canStart: false } } });
    expect(status()).toBe('Couldn’t confirm the deploy');
    const words = document.querySelector('[data-hub-status] span:last-child');
    expect(words.style.whiteSpace).toBe('normal');
    expect(words.style.textOverflow).toBe('');
  });
});

describe('the response to an area selection (R-S7-3)', () => {
  const areaTabs = () => [...document.querySelectorAll('[data-hub-slot="stage"] [role="tab"]')];

  it('a new area on the wide site blooms once; selecting the current area again does not', () => {
    renderFrame({ site: 'desktop', hubWidth: 1216, sections: fixture('returning') });
    tick(3);
    expect(bloomRuns(340)).toBe(0);
    const other = areaTabs().find((t) => t.getAttribute('aria-selected') === 'false');
    click(other);
    tick(5);
    expect(bloomRuns(340)).toBe(1);
    tick(80);
    click(areaTabs().find((t) => t.getAttribute('aria-selected') === 'true'));
    tick(80);
    expect(bloomRuns(340)).toBe(1);
    click(areaTabs().find((t) => t.getAttribute('aria-selected') === 'false'));
    tick(5);
    expect(bloomRuns(340)).toBe(2);
  });

  it('the phone\'s tabs are tab switches: they relabel Shadow and never bloom', () => {
    renderFrame({ site: 'mobile', hubWidth: 390, sections: fixture('returning') });
    tick(3);
    for (const name of [COPY.phoneTabs.research, COPY.phoneTabs.loadout, COPY.phoneTabs.partnership, COPY.phoneTabs.overview]) {
      click(byRole(document, 'tab', name)[0]);
      tick(3);
    }
    expect(bloomRuns(200)).toBe(0);
  });

  it('a sheet opening and a resize are not responses (a poll refresh is covered in the connected rows below)', () => {
    renderFrame({ site: 'desktop', hubWidth: 1216, sections: fixture('returning') });
    tick(3);
    click(byRole(document, 'button', COPY.games.history)[0]);
    expect(document.querySelector('[data-hub-sheet-overlay]')).not.toBeNull();
    tick(3);
    layout.resize({ hubWidth: 770 });
    tick(3);
    expect(bloomRuns(260)).toBe(0);
  });

  it('under reduced motion the selection flashes the still for 420 ms instead', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    h.reduced = true;
    renderFrame({ site: 'desktop', hubWidth: 1216, sections: fixture('returning') });
    expect(box().hasAttribute('data-shadow-flash')).toBe(false);
    click(areaTabs().find((t) => t.getAttribute('aria-selected') === 'false'));
    expect(box().hasAttribute('data-shadow-flash')).toBe(true);
    act(() => { vi.advanceTimersByTime(420); });
    expect(box().hasAttribute('data-shadow-flash')).toBe(false);
  });
});

// Every wide composition answers an area selection the same way (the lens T review: only the 1216 px hub was driven).
describe.each([[1216, 340], [770, 260], [614, 260]])('the response to an area selection at a hub %i px wide (R-S7-3)', (hubWidth, size) => {
  const areaTabs = () => [...document.querySelectorAll('[data-hub-slot="stage"] [role="tab"]')];
  const labelled = () => box().querySelector('canvas').getAttribute('aria-label');

  it('each of the three areas, chosen from another, blooms once and names itself; choosing the current area again does not', () => {
    renderFrame({ site: 'desktop', hubWidth, sections: fixture('returning') });
    expect(box().style.width).toBe(`${size}px`);
    tick(3);
    expect(areaTabs()).toHaveLength(3);
    expect(labelled()).toBe('Shadow — ambient; Equipped Archetype selected');
    let runs = 0;
    for (const [index, name] of [[0, 'Partnership'], [1, 'Shared Research'], [2, 'Equipped Archetype']]) {
      click(areaTabs()[index]);
      tick(5);
      runs += 1;
      expect(labelled()).toBe(`Shadow — ambient; ${name} selected`);
      expect(bloomRuns(size)).toBe(runs);
      tick(80);
      click(areaTabs()[index]);
      tick(80);
      expect(bloomRuns(size)).toBe(runs);
    }
  });

  it('the Loadout link on the Deploy card is a selection of the Equipped Archetype: a response from another area, none from itself', () => {
    renderFrame({ site: 'desktop', hubWidth, sections: fixture('returning') });
    tick(3);
    const door = () => byRole(document, 'button', COPY.deploy.loadoutLink)[0];
    click(door());
    tick(80);
    expect(bloomRuns(size)).toBe(0);
    click(areaTabs()[0]);
    tick(80);
    expect(bloomRuns(size)).toBe(1);
    click(door());
    tick(5);
    expect(labelled()).toBe('Shadow — ambient; Equipped Archetype selected');
    expect(bloomRuns(size)).toBe(2);
  });
});

// ── The connected hub, inside App's deploy provider ────────────────────────────────────────────────────────────────
//
// With the ceremony off, App's handoff navigates at once and acknowledges the creation (provider: "that navigation
// acknowledges the terminal"), so a created terminal stays on the hub only when the ceremony is on and was closed while
// the request was out, or when a recovery found the battle. These rows drive those real paths.

const T0 = Date.UTC(2026, 9, 25, 15, 0);
const probe = { current: null };
function Probe() { probe.current = useDeployAttempt(); return null; }

const hubOf = () => ({
  activeBattles: [],
  activePoll: { epoch: 1, status: 'ready', ownerUid: 'uid-A', ownerEpoch: 1, lastSuccessfulAt: T0 - 30000, error: null, refreshing: false },
  refreshActiveBattles: vi.fn(async () => true),
  openGame: vi.fn(),
  openFilmRoom: vi.fn(),
  setScreen: vi.fn(),
  onOpenForge: vi.fn(),
});
const tree = (site, hub) => (
  <DeployAttemptProvider hubEnabled userName="flash" onCreateAgentBattle={vi.fn()} onEnterBattle={vi.fn()} onOpenBattle={vi.fn()} refreshActiveBattles={hub.refreshActiveBattles} clearCeremonyStash={vi.fn()}>
    <CommandCenterHub site={site} hub={hub} />
    <Probe />
  </DeployAttemptProvider>
);
const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };
const advance = async (ms) => { await act(async () => { vi.advanceTimersByTime(ms); }); };
const signIn = (uid) => act(() => { for (const cb of [...h.authListeners]) cb(uid ? { uid } : null); });

function renderConnected(site = 'desktop', hub = hubOf(), width = null) {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.setSystemTime(T0);
  vi.spyOn(performance, 'now').mockImplementation(() => kit.state.now);
  layout.state.hubWidth = width ?? (site === 'mobile' ? 390 : 1216);
  const m = mount(tree(site, hub));
  mounted.push(m);
  signIn('uid-A');
  return { m, hub };
}
const SIZE = { desktop: 340, mobile: 200 };
const card = () => document.querySelector('[data-hub-deploy]:not([data-hub-deploy-card="phone"])');
const strip = () => document.querySelector('[data-hub-strip]');
const pointer = (el, type) => { const e = new Event(type, { bubbles: true, cancelable: true }); Object.defineProperty(e, 'pointerId', { value: 1 }); el.dispatchEvent(e); };
const holdIn = (scope) => byRole(scope, 'button', COPY.deploy.holdLabel)[0] ?? scope.querySelector('button[aria-label]');
/** A real hub-started deployment, by the hold the player uses: press, the 1.3 s charge, the locked beat, the request out. */
async function deployViaHold(scope = card) {
  act(() => { pointer(holdIn(scope()), 'pointerdown'); });
  kit.tick(650);
  kit.tick(650);
  await advance(450);
  await flush();
}
const answer = async (result, at = 0) => { h.posts[at].answer(result); await flush(); };
/** The player closes the ceremony while the request is still out: the creation then stays on the hub. */
const closeCeremony = () => act(() => { probe.current.api.dismiss(); });
const attemptId = () => probe.current.snapshot.state.attempt.attemptId;
const reveal = async () => { act(() => { probe.current.api.phaseChanged({ attemptId: attemptId(), phase: 'reveal' }); }); await flush(); };
const CREATED = { outcome: 'created', success: true, agentBattleId: 'battle-new' };
const EXISTING = { outcome: 'existing_battle', success: false, postIssued: true, battleCreated: false, existingBattleId: 'battle-running' };
const REFUSED = { outcome: 'refused', success: false, postIssued: true, httpStatus: 429, status: 429, error: 'Deploy already in progress', reason: 'in_progress' };
const UNCERTAIN = { outcome: 'uncertain', success: false, postIssued: true, httpStatus: null, error: 'deploy_network' };

describe('connected: processing follows the attempt (R-S7-3)', () => {
  it('ambient, then processing only while the hub-started deployment is submitting — the core pulses — then ambient again', async () => {
    renderConnected('desktop');
    expect(label()).toBe('ambient');
    await deployViaHold();
    expect(h.deploy).toHaveBeenCalledTimes(1);
    expect(label()).toBe('processing');
    expect(status()).toBe('Submitting your deployment');
    tick(2);
    const { log } = kit.contexts.at(-1);
    const coreOfLast = log.arcs[log.frames.slice(0, -1).reduce((n, f) => n + f.arcs, 0)][2];
    expect(coreOfLast).not.toBeCloseTo(R(340) * 0.11, 6);
    await answer(UNCERTAIN);
    expect(label()).toBe('ambient');
    expect(status()).toBe('Couldn’t confirm the deploy');
  });

  it('a creation the ceremony-off handoff navigates away from is acknowledged at once: processing ends, nothing blooms', async () => {
    renderConnected('desktop');
    await deployViaHold();
    await answer(CREATED);
    tick(80);
    expect(label()).toBe('ambient');
    expect(status()).toBe('Idle · nothing running');
    expect(bloomRuns(340)).toBe(0);
  });

  it.each([
    ['existing', EXISTING, 'Already running'],
    ['refused', REFUSED, 'Deployment refused'],
    ['uncertain', UNCERTAIN, 'Couldn’t confirm the deploy'],
  ])('an %s terminal is not a created terminal: the card\'s word on the line, ambient, no response', async (_name, result, words) => {
    renderConnected('desktop');
    await deployViaHold();
    await answer(result);
    tick(80);
    expect(status()).toBe(words);
    expect(label()).toBe('ambient');
    expect(bloomRuns(340)).toBe(0);
  });

  it('rule 6 on the connected hub: the owned live read answers "Idle · nothing running"; before it answers, or for another owner\'s list, "Idle" (review C-5)', async () => {
    const owner = { epoch: 1, status: 'ready', ownerUid: 'uid-A', ownerEpoch: 1, lastSuccessfulAt: T0 - 30000, error: null, refreshing: false };
    const run = async (poll, battles = []) => {
      const { m } = renderConnected('desktop', { ...hubOf(), activePoll: poll, activeBattles: battles });
      await flush();
      const text = status();
      m.unmount();
      mounted = mounted.filter((x) => x !== m);
      vi.useRealTimers();
      return text;
    };
    expect(await run(owner)).toBe('Idle · nothing running');
    expect(await run({ epoch: 1, status: 'loading', ownerUid: null, ownerEpoch: null, lastSuccessfulAt: null, error: null, refreshing: false })).toBe('Idle');
    expect(await run({ ...owner, ownerUid: 'uid-B' })).toBe('Idle');
    expect(await run({ ...owner, ownerEpoch: 9 })).toBe('Idle');
  });

  it('a failed refresh: an empty retained list claims nothing ("Idle"); a retained live game is still said (review C-3)', async () => {
    const stale = { epoch: 1, status: 'error', ownerUid: 'uid-A', ownerEpoch: 1, lastSuccessfulAt: T0 - 300000, error: 'unavailable', refreshing: false };
    const game = { id: 'game_live', ownerId: 'uid-A', agentId: 'casual-agent-uid-A', status: 'active', activatedAt: '2026-10-25T14:30:00Z' };
    const run = async (battles) => {
      const { m } = renderConnected('desktop', { ...hubOf(), activePoll: stale, activeBattles: battles });
      await flush();
      const text = status();
      m.unmount();
      mounted = mounted.filter((x) => x !== m);
      vi.useRealTimers();
      return text;
    };
    expect(await run([])).toBe('Idle');
    expect(await run([game])).toBe('Live game in progress');
  });

  it('a refresh in flight over an answered, empty list does not flicker the line to "Idle"', async () => {
    const refreshing = { epoch: 1, status: 'loading', ownerUid: 'uid-A', ownerEpoch: 1, lastSuccessfulAt: T0 - 30000, error: null, refreshing: true };
    renderConnected('desktop', { ...hubOf(), activePoll: refreshing });
    await flush();
    expect(status()).toBe('Idle · nothing running');
  });

  it('a connected hub with no attempt: ambient, no response, however many frames', async () => {
    renderConnected('desktop');
    await flush();
    tick(150);
    expect(label()).toBe('ambient');
    expect(bloomRuns(340)).toBe(0);
  });
});

describe('connected: a created terminal on the hub blooms once per attempt (R-S7-3)', () => {
  beforeEach(() => { h.ceremony = true; });

  it('ceremony closed while the request is out: the creation stays, "Deployed", and Shadow answers exactly once however long it stays', async () => {
    renderConnected('desktop');
    await deployViaHold();
    closeCeremony();
    expect(probe.current.snapshot.overlayOpen).toBe(false);
    tick(3);
    expect(bloomRuns(340)).toBe(0);
    await answer(CREATED);
    expect(status()).toBe('Deployed');
    expect(label()).toBe('ambient');
    tick(120);
    expect(bloomRuns(340)).toBe(1);
    tick(200);
    expect(status()).toBe('Deployed');
    expect(bloomRuns(340)).toBe(1);
  });

  it('a second attempt\'s created terminal blooms again, once', async () => {
    renderConnected('desktop');
    await deployViaHold();
    closeCeremony();
    await answer(CREATED, 0);
    tick(100);
    expect(bloomRuns(340)).toBe(1);
    closeCeremony();
    await flush();
    await advance(180000);
    await deployViaHold();
    expect(h.posts).toHaveLength(2);
    closeCeremony();
    await answer(CREATED, 1);
    tick(100);
    expect(status()).toBe('Deployed');
    expect(bloomRuns(340)).toBe(2);
  });

  it('a poll refresh (new retained objects, no change of attempt) is not a response, with a created terminal on screen', async () => {
    const { m, hub } = renderConnected('desktop');
    await deployViaHold();
    closeCeremony();
    await answer(CREATED);
    tick(100);
    expect(bloomRuns(340)).toBe(1);
    for (let i = 0; i < 4; i += 1) {
      m.rerender(tree('desktop', { ...hub, activeBattles: [], activePoll: { ...hub.activePoll, lastSuccessfulAt: T0 + i + 1 } }));
    }
    tick(200);
    expect(status()).toBe('Deployed');
    expect(bloomRuns(340)).toBe(1);
  });

  it('the phone follows the same attempt: processing, then one response for the created terminal', async () => {
    renderConnected('mobile');
    expect(label()).toBe('ambient');
    await deployViaHold(strip);
    expect(label()).toBe('processing');
    closeCeremony();
    await answer(CREATED);
    tick(100);
    expect(label()).toBe('ambient');
    expect(status()).toBe('Deployed');
    expect(bloomRuns(SIZE.mobile)).toBe(1);
  });

  it('a hub that mounts over an unacknowledged created terminal does not bloom for it (the past is not an event)', async () => {
    const { m, hub } = renderConnected('desktop');
    await deployViaHold();
    closeCeremony();
    await answer(CREATED);
    tick(100);
    expect(bloomRuns(340)).toBe(1);
    // A site flip remounts the whole hub under the same provider: the attempt is still there, Shadow is new.
    layout.state.hubWidth = 390;
    m.rerender(tree('mobile', hub));
    tick(120);
    expect(status()).toBe('Deployed');
    expect(bloomRuns(SIZE.mobile)).toBe(0);
  });

  it('"Battle confirmed" — a creation recovered from an uncertain answer — blooms once', async () => {
    renderConnected('desktop');
    await deployViaHold();
    await answer(UNCERTAIN);
    expect(status()).toBe('Couldn’t confirm the deploy');
    h.verify = vi.fn(async () => ({ found: true, battle: { id: 'battle-running', ownerId: 'uid-A', agentId: 'agent-uid-A', status: 'active' } }));
    await reveal();
    expect(status()).toBe('Battle confirmed');
    closeCeremony();
    // The ceremony's own close acknowledged the terminal; the response behind it plays on return.
    tick(100);
    expect(bloomRuns(340)).toBe(1);
  });
});

describe('connected: the root ceremony covers the page, so Shadow pauses (R-S7-5)', () => {
  beforeEach(() => { h.ceremony = true; });

  it('the loop stops while the ceremony is open, a response that arrives behind it waits, and plays once the page is back', async () => {
    renderConnected('desktop');
    tick(3);
    await deployViaHold();
    expect(probe.current.snapshot.overlayOpen).toBe(true);
    expect(kit.raf.queue).toHaveLength(0);
    const frames = kit.contexts.at(-1).log.frames.length;
    tick(5);
    expect(kit.contexts.at(-1).log.frames).toHaveLength(frames);
    await answer(CREATED);
    await reveal();
    expect(status()).toBe('Deployed');
    tick(5);
    expect(bloomRuns(340)).toBe(0);
    closeCeremony();
    await flush();
    expect(probe.current.snapshot.overlayOpen).toBe(false);
    expect(kit.raf.queue).toHaveLength(1);
    tick(5);
    expect(bloomRuns(340)).toBe(1);
  });

  it('the phone pauses behind the ceremony too, and resumes when it closes', async () => {
    renderConnected('mobile');
    tick(3);
    await deployViaHold(strip);
    expect(probe.current.snapshot.overlayOpen).toBe(true);
    expect(kit.raf.queue).toHaveLength(0);
    closeCeremony();
    await flush();
    expect(probe.current.snapshot.overlayOpen).toBe(false);
    expect(kit.raf.queue).toHaveLength(1);
  });

  it('under reduced motion a created terminal behind the ceremony flashes the still once the page is back (the flash is owed, not spent behind it)', async () => {
    h.reduced = true;
    renderConnected('desktop');
    await deployViaHold();
    await answer(CREATED);
    await reveal();
    expect(status()).toBe('Deployed');
    expect(box().hasAttribute('data-shadow-flash')).toBe(false);
    closeCeremony();
    await flush();
    expect(box().hasAttribute('data-shadow-flash')).toBe(true);
    await advance(420);
    expect(box().hasAttribute('data-shadow-flash')).toBe(false);
  });

  it('no ceremony, no pause: the loop runs through a deployment that has none', async () => {
    h.ceremony = false;
    renderConnected('desktop');
    await deployViaHold();
    expect(probe.current.snapshot.overlayOpen).toBe(false);
    expect(kit.raf.queue).toHaveLength(1);
  });
});

// The tablet and stacked compositions mount the same Shadow under the same provider; their size is the only difference
// (the lens T review: the connected rows ran at 1216 px and 390 px alone).
describe.each([[770, 260], [614, 260]])('connected, the wide site at %i px: the same attempt, the same pause (R-S7-3, R-S7-5)', (width, size) => {
  beforeEach(() => { h.ceremony = true; });

  it('processing while submitting, one response for the created terminal however long it stays, and the line says "Deployed"', async () => {
    renderConnected('desktop', hubOf(), width);
    expect(box().style.width).toBe(`${size}px`);
    expect(label()).toBe('ambient');
    await deployViaHold();
    expect(label()).toBe('processing');
    closeCeremony();
    await answer(CREATED);
    tick(120);
    expect(label()).toBe('ambient');
    expect(status()).toBe('Deployed');
    expect(bloomRuns(size)).toBe(1);
    tick(200);
    expect(bloomRuns(size)).toBe(1);
  });

  it('the loop stops behind the ceremony, a response that arrives behind it plays once the page is back, and the box keeps its size', async () => {
    renderConnected('desktop', hubOf(), width);
    tick(3);
    await deployViaHold();
    expect(probe.current.snapshot.overlayOpen).toBe(true);
    expect(kit.raf.queue).toHaveLength(0);
    await answer(CREATED);
    await reveal();
    tick(5);
    expect(bloomRuns(size)).toBe(0);
    closeCeremony();
    await flush();
    expect(kit.raf.queue).toHaveLength(1);
    tick(5);
    expect(bloomRuns(size)).toBe(1);
    expect(box().style.width).toBe(`${size}px`);
  });
});
