// @vitest-environment jsdom
//
// Build A2 — the per-game loadout surfaces in the connected hub (boards 1–5), with PER_GAME_LOADOUT_ENABLED and
// AGENT_FORM_ARMORY_ENABLED held on here (both dark on main), on the A1 armory suite's harness: the agent form wrapper is
// a recording stand-in, the network seams are mocked (the loadout writers and the League lock's client read included),
// and HubSheet, the overlay stack, the shells and the sheets are the real ones.
//
//   - board 1: the two cards, BaggerBomb then League — the set's 48 px still, the book and its count, one tag, a door on
//     each half; the running strip in the armor the game deployed with; League checking, open and locked (with the
//     week's end), the locked rows; "No book · open market";
//   - board 2: the Deploy card's line — "Next deploy carries", the still, the book and its count; split by a running
//     game; no book, and Deploy unchanged; its door;
//   - the stage's summary and the strip's line name the loadouts;
//   - board 4: the armory opened from a card has that loadout's context line, Equip names the game and writes that
//     `loadout`, the equipped set is that loadout's; a locked League previews and refuses; the server's lock answer;
//   - the book door: today's watchlist sheet with the loadout's context, writing that loadout's book;
//   - board 5 on the phone: the armory opens in the hero's box from the card, Equip closes it, the hero is bare again;
//   - N1: no figure outside a game wears a loadout's archetype but the cards' and lines' stills and the armory's preview;
//   - A1 carries: AR-5 (focus back to the row that opened the dialog), AR-6 (the 3 × 2 grid under 315 px).

import React, { Component, act } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  userState: { user: { displayName: 'Flash', username: 'flash' } },
  listWatchlists: null,
  writers: null,
  lockSubs: [],
  flags: { current: { concurrencyEnabled: true, hypothesisRecordsOn: true, characterTab: true } },
  slots: { current: [{ id: 'archetype', filled: true }, { id: 'watchlist', filled: true }] },
  perGame: { on: true },
  forms: { next: 0, live: new Map(), mounts: 0, unmounts: 0 },
  invalidations: 0,
  // E-2's connected row (the last describe)
  connected: false,
  connectedAgent: null,
  authListeners: [],
}));
const { CONNECTED_UID } = vi.hoisted(() => ({ CONNECTED_UID: 'u-1' }));
// The armory flip review, AF-8: the idea reader runs real; only its invalidate() is counted (and still called through), so
// the book sheet's return re-read is visible here.
vi.mock('./hub/useHubResearch', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    default: function useHubResearch(args) {
      const read = real.default(args);
      return { ...read, invalidate: () => { h.invalidations += 1; read.invalidate(); } };
    },
  };
});
vi.mock('../../config/agentFormFlags', async (importOriginal) => ({ ...(await importOriginal()), AGENT_FORM_ARMORY_ENABLED: true }));
vi.mock('../../config/perGameLoadoutFlags', () => ({ get PER_GAME_LOADOUT_ENABLED() { return h.perGame.on; } }));
vi.mock('framer-motion', async (importOriginal) => ({ ...(await importOriginal()), useReducedMotion: () => false }));
vi.mock('../AgentForm/AgentForm', () => ({
  default: class AgentFormProbe extends Component {
    constructor(props) { super(props); this.id = ++h.forms.next; this.history = []; }
    componentDidMount() { h.forms.live.set(this.id, this); h.forms.mounts += 1; this.props.onStatus?.('live'); }
    componentWillUnmount() { h.forms.live.delete(this.id); h.forms.unmounts += 1; }
    render() { this.history.push(this.props); return null; }
  },
}));
vi.mock('../../contexts/UserContext', () => ({ useUser: () => h.userState }));
vi.mock('../../firebase/config', () => ({ db: {}, auth: {} }));
const { READ } = vi.hoisted(() => ({ READ: Symbol('agentRead') }));
// Every row but E-2's (the last describe) reads the agent from the hub object. E-2's row sets `h.connected` and runs the
// real readers inside App's deploy provider, on the seams the S7 suite's connected hub mocks (below, each inert unless
// `h.connected`).
vi.mock('./hub/useHubReaders', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    default: function useHubReaders(hub, ...rest) {
      return h.connected ? real.default(hub, ...rest) : { sections: {}, actions: {}, agent: hub?.[READ] ?? null };
    },
  };
});
vi.mock('firebase/auth', async (importOriginal) => ({ ...(await importOriginal()), onAuthStateChanged: (_auth, cb) => { h.authListeners.push(cb); return () => {}; } }));
vi.mock('../../firebase/authService', async (importOriginal) => ({
  ...(await importOriginal()),
  getIdToken: async () => (h.connected ? 'tok' : null),
  getCurrentUser: () => (h.connected ? { uid: CONNECTED_UID } : null),
}));
vi.mock('../../hooks/useAgent', () => ({
  default: (uid, options) => ({
    status: uid ? 'ready' : 'loading', agent: uid ? h.connectedAgent : null, ownerUid: uid ?? null, ownerEpoch: options?.ownerEpoch ?? null,
    readError: null, retry: () => {}, activeDirectives: [],
  }),
}));
vi.mock('./hub/useHubCompletedBattles', async () => {
  const { readAuthIdentity } = await import('../../services/authIdentity');
  return {
    default: function useHubCompletedBattles() {
      const id = readAuthIdentity();
      return {
        battles: [], status: 'ready', error: null, ownerUid: id.uid, ownerEpoch: id.authEpoch, lastSuccessfulAt: Date.now(), generation: 1,
        reviews: {}, checking: false, refreshing: false, nextAttemptAt: null, refresh: () => {},
      };
    },
  };
});
vi.mock('../../hooks/useDailyRegimeBrief', () => ({
  default: function useDailyRegimeBrief() {
    return { dailyBrief: null, forDate: null, generatedAt: null, isStale: false, loading: true, error: null, refetch: () => {} };
  },
}));
vi.mock('../../utils/marketSchedule', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, getMarketState: (...a) => (h.connected ? { state: 'OPEN', isOpen: true } : real.getMarketState(...a)) };
});
vi.mock('../../services/dueIdeaCheck', () => ({ checkDueIdea: async () => null }));
vi.mock('../../services/agentBattleVerify', () => ({ findActiveBattleForAgent: async () => ({ found: false, battle: null }) }));
vi.mock('../../services/ownedBattleRead', () => ({ readOwnedBattle: async () => null }));
vi.mock('../../hooks/useDeployTargetProgress', () => ({ default: () => ({ deployProgress: null, lastDeployedAt: null, lastDecision: null, targetKnown: false }) }));
vi.mock('../Dashboard/deployCeremony/DeployCeremony', () => ({ default: (props) => <div data-ceremony={props.attemptId} /> }));
vi.mock('../../config/featureFlags', async (importOriginal) => ({ ...(await importOriginal()), isDeployCeremonyOn: () => false }));
vi.mock('../../services/forgeWatchlistService', () => ({ listWatchlists: (...a) => h.listWatchlists(...a) }));
vi.mock('../../services/agentService', () => ({ equipWatchlist: vi.fn(), unequipWatchlist: vi.fn(), changeArchetype: vi.fn() }));
vi.mock('../../services/loadoutService', async (importOriginal) => {
  const real = await importOriginal();
  return {
    isLeagueLock: real.isLeagueLock,
    changeLoadoutArchetype: (...a) => h.writers.changeLoadoutArchetype(...a),
    equipLoadoutBook: (...a) => h.writers.equipLoadoutBook(...a),
    unequipLoadoutBook: (...a) => h.writers.unequipLoadoutBook(...a),
  };
});
vi.mock('../../services/leagueLockService', () => ({
  subscribeLeagueLock: (uid, onLock, onError) => { const sub = { uid, onLock, onError, live: true }; h.lockSubs.push(sub); return () => { sub.live = false; }; },
}));
vi.mock('../../hooks/useMasteryProfile', () => ({ default: () => null }));
vi.mock('./hub/hubFlags', async (importOriginal) => ({ ...(await importOriginal()), hubFlags: () => h.flags.current }));
vi.mock('../../utils/equipSlots', () => ({ getEquipSlots: () => h.slots.current }));

import CommandCenterHub from './CommandCenterHub';
import { HUB_COPY as COPY } from './hub/hubCopy';
import { LOADOUT_COPY } from '../../constants/loadoutCopy';
import { HUB_LAYOUT_FIXTURES } from './__fixtures__/hubLayoutFixtures';
import { byRole, click, injectTokens, installFakeLayout, mount, mountFakeBottomNav, press } from './__fixtures__/hubTestKit';
import { PHONE_ARMORY, useArmoryEquip } from './Armory';
import { SET_ALONE } from '../AgentForm/agentFormSpec';
import { armoryLines } from './hub/archetypeLines';
import DeploySection from './sections/DeploySection';
import { PerGameLoadoutContext } from './hub/perGameLoadoutContext';
import { DeployAttemptProvider } from '../../contexts/DeployAttemptContext';
import { resetAuthIdentityForTests } from '../../services/authIdentity';
import { __resetHoldClaim } from '../../hooks/holdClaim';
import { installFakeCanvas } from './__fixtures__/shadowCanvasKit';
import { LeagueLoadoutLine } from '../League/LeagueLoadoutLine';
import { openCommandCenterOnLoadout, takeLoadoutEntry } from '../../utils/hubEntryIntent';
import { HUB_AREAS, PHONE_TABS } from './hub/composition';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let layout;
let removeTokens;
let removeNav;
let mounted = [];
let errorSpy;

const LISTS = [
  { watchlistId: 'wl-energy', name: 'Energy Movers', status: 'committed', tickers: ['XOM', 'CVX', 'OXY'] },
  { watchlistId: 'wl-ind', name: 'Industrials', status: 'committed', tickers: ['CAT', 'DE'] },
];
const SLOT = (over = {}) => ({ archetype: 'degen', book: { ref: { watchlistId: 'wl-energy' }, name: 'Energy Movers', pin: null }, ...over });
const AGENT = (over = {}) => ({ id: 'ag-1', ownerId: 'u-1', name: 'Nova', archetype: 'contrarian', equippedWatchlistId: 'wl-ind', equippedWatchlistName: 'Industrials', stats: { gamesPlayed: 12 }, loadouts: { baggerbomb: SLOT() }, ...over });
const LIVE_BB = (archetype = 'analyst') => ({ id: 'b-live', status: 'active', agentId: 'casual-agent-u-1', ownerId: 'u-1', agentContext: { archetype } });
const LOCKED = { locked: true, groupId: 'g-1', status: 'battle', endsAtMs: Date.parse('2026-11-06T21:00:00.000Z') };
const OPEN = { locked: false, groupId: null, status: null, endsAtMs: null };
const HUB = (agent, activeBattles = []) => ({ activeBattles, setScreen: vi.fn(), onOpenForge: vi.fn(), [READ]: { status: 'ready', agent, retry: vi.fn() } });
const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }); };
const name = (codeId) => armoryLines(codeId).name;

beforeAll(() => { removeTokens = injectTokens(); });
afterAll(() => { removeTokens(); });
beforeEach(() => {
  layout = installFakeLayout();
  removeNav = mountFakeBottomNav();
  h.listWatchlists = vi.fn().mockResolvedValue(LISTS);
  h.writers = {
    changeLoadoutArchetype: vi.fn().mockResolvedValue({ ok: true }),
    equipLoadoutBook: vi.fn().mockResolvedValue({ ok: true }),
    unequipLoadoutBook: vi.fn().mockResolvedValue({ ok: true }),
  };
  h.lockSubs = [];
  h.perGame.on = true;
  h.forms.next = 0; h.forms.live = new Map(); h.forms.mounts = 0; h.forms.unmounts = 0;
  h.invalidations = 0;
  h.connected = false;
  h.connectedAgent = null;
  h.authListeners = [];
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  for (const m of mounted) m.unmount();
  mounted = [];
  removeNav();
  layout.restore();
  errorSpy.mockRestore();
});

/** The League read answers (or fails) for the owner's live subscription. */
function answerLock(lock) { act(() => { for (const s of h.lockSubs.filter((x) => x.live)) s.onLock(lock); }); }
function failLock() { act(() => { for (const s of h.lockSubs.filter((x) => x.live)) s.onError(new Error('denied')); }); }

async function renderHub({ site = 'desktop', hubWidth = 1280, agent = AGENT(), activeBattles = [], lock = OPEN } = {}) {
  layout.state.hubWidth = hubWidth;
  const m = mount(<CommandCenterHub site={site} hub={HUB(agent, activeBattles)} sections={HUB_LAYOUT_FIXTURES.returning.sections} />);
  mounted.push(m);
  await flush();
  if (lock) answerLock(lock);
  if (site === 'mobile') click(byRole(document, 'tab', COPY.phoneTabs.loadout)[0]);
  await flush();
  return m;
}

const card = (kind) => document.querySelector(`[data-loadout-card="${kind}"]`);
const row = (kind, which) => card(kind).querySelector(`[data-loadout-row="${which}"]`);
const tagText = (kind) => card(kind).querySelector('[data-hub-tag]').textContent;
const lineText = (kind) => card(kind).querySelector('[data-loadout-line]').textContent;
const dialog = () => document.querySelector('[role="dialog"][aria-label="Armory"]');
const option = (codeId) => document.querySelector(`[role="option"][data-armory-set="${codeId}"]`);
const equipButton = () => document.querySelector('[data-armory-equip]');
const context = () => document.querySelector('[data-armory-context]');
const all = () => [...h.forms.live.values()];
const propsOf = (form) => form.history.at(-1);
const hero = () => all().find((f) => 'responsePart' in propsOf(f)) ?? null;
const stills = () => all().filter((f) => propsOf(f).rate === 'still' && propsOf(f).coreStage !== SET_ALONE);

describe('board 1: the two cards', () => {
  it('BaggerBomb first, League second; each its set as a 48 px still, its book with its count, one tag, a door on each half', async () => {
    await renderHub();
    expect([...document.querySelectorAll('[data-loadout-card]')].map((c) => c.getAttribute('data-loadout-card'))).toEqual(['baggerbomb', 'league']);
    expect(card('baggerbomb').getAttribute('aria-label')).toBe('BaggerBomb loadout');
    expect(card('baggerbomb').textContent).toContain(name('degen'));
    expect(card('baggerbomb').textContent).toContain('Energy Movers');
    expect(card('baggerbomb').textContent).toContain('Book · 3 names');
    expect(tagText('baggerbomb')).toBe('Next deploy');
    expect(lineText('baggerbomb')).toBe('The next deploy wears this.');
    expect(card('league').textContent).toContain(name('contrarian'));
    expect(card('league').textContent).toContain('Industrials');
    expect(card('league').textContent).toContain('Book · 2 names');
    expect(tagText('league')).toBe('Open');
    for (const kind of ['baggerbomb', 'league']) {
      for (const which of ['armor', 'book']) {
        expect(row(kind, which).tagName, `${kind} ${which}`).toBe('BUTTON');
        expect(row(kind, which).style.minHeight).toBe('60px');
      }
    }
    expect(row('baggerbomb', 'armor').getAttribute('aria-label')).toBe('Change BaggerBomb armor');
    // the stills: Shadow wearing each set, 48 px, never live
    const cardStills = stills().filter((f) => propsOf(f).size === 48).map((f) => propsOf(f).archetype);
    expect(cardStills.sort()).toEqual(['contrarian', 'degen']);
    // the old archetype and watchlist cards are gone; the record slot is not rendered
    expect(document.querySelector('[data-hub-card="archetype"]')).toBeNull();
    expect(document.body.textContent).not.toMatch(/record facts/i);
    expect(document.body.textContent).toContain(LOADOUT_COPY.forgeLine);
  });

  it('League: checking until the lock read answers, open, then locked with the week\'s end; a failed read stays checking', async () => {
    await renderHub({ lock: null });
    expect(tagText('league')).toBe('Checking');
    expect(row('league', 'book').tagName).toBe('DIV');
    answerLock(OPEN);
    expect(tagText('league')).toBe('Open');
    expect(lineText('league')).toBe('Open until you register for next week. It locks then.');
    answerLock(LOCKED);
    expect(tagText('league')).toBe('Locked');
    expect(lineText('league')).toBe('Locked until the week is scored, after the close on Fri Nov 6.');
    // the armor row still opens the armory to look; the book row is no door
    expect(row('league', 'armor').tagName).toBe('BUTTON');
    expect(row('league', 'armor').getAttribute('aria-label')).toBe('League armor, locked. Open the armory to look.');
    expect(row('league', 'book').tagName).toBe('DIV');
    expect(row('league', 'book').getAttribute('aria-label')).toBe('League book, locked');
    failLock();
    expect(tagText('league')).toBe('Checking');
    // BaggerBomb is never locked by the League week
    expect(tagText('baggerbomb')).toBe('Next deploy');
    expect(row('baggerbomb', 'book').tagName).toBe('BUTTON');
  });

  it('A2R-3 (a): a game on the ranked record locks League, undated, in A1\'s words; the armory\'s Equip refuses it', async () => {
    // no ranked group (the week read answers open), but the ranked record holds a game: a BaggerBomb deploy that fell
    // back to the ranked agent, or a League game; every League write answers 409 battle_active then
    await renderHub({ agent: AGENT({ activeBattleId: 'b-ranked' }), lock: OPEN });
    expect(tagText('league')).toBe('Locked');
    expect(lineText('league')).toBe('Locked while a game is running.');
    expect(row('league', 'book').tagName).toBe('DIV');
    expect(row('league', 'armor').getAttribute('aria-label')).toBe('League armor, locked. Open the armory to look.');
    // BaggerBomb runs on the clone: the ranked record's game never locks it
    expect(tagText('baggerbomb')).toBe('Next deploy');
    click(row('league', 'armor'));
    expect(context().textContent).toContain('locked while a game is running');
    click(option('guardian'));
    expect(equipButton().textContent).toBe('Locked while a game is running');
    expect(document.querySelector('[data-armory-footnote]').textContent).toBe('Try sets on; nothing changes until the game ends.');
    click(equipButton());
    await flush();
    expect(h.writers.changeLoadoutArchetype).not.toHaveBeenCalled();
  });

  it('the lock read is the owner\'s: one subscription, for the agent\'s owner', async () => {
    await renderHub();
    expect(h.lockSubs.filter((s) => s.live).map((s) => s.uid)).toEqual(['u-1']);
  });

  it('a running BaggerBomb game: the strip in the armor it deployed with; the card keeps what the next deploy wears', async () => {
    await renderHub({ activeBattles: [LIVE_BB('analyst')] });
    expect(tagText('baggerbomb')).toBe('Game running');
    const strip = card('baggerbomb').querySelector('[data-loadout-running]');
    expect(strip.getAttribute('data-loadout-running')).toBe('analyst');
    expect(strip.textContent).toContain(name('analyst'));
    expect(lineText('baggerbomb')).toBe(`The running game keeps the ${name('analyst')}. The next deploy wears what you set here.`);
    expect(card('baggerbomb').querySelector('[data-loadout-row="armor"]').textContent).toContain(name('degen'));
  });

  it('No book: "No book · open market", the book row the door to choose one', async () => {
    await renderHub({ agent: AGENT({ loadouts: { baggerbomb: SLOT({ book: { ref: null, name: null, pin: null } }) } }) });
    expect(tagText('baggerbomb')).toBe('No book');
    expect(row('baggerbomb', 'book').textContent).toContain('No book · open market');
    expect(row('baggerbomb', 'book').textContent).toContain('Choose a list');
    expect(lineText('baggerbomb')).toBe('No book · open market. Deploy works without one.');
  });

  it('no slot yet: BaggerBomb wears the default, the League loadout\'s set and book', async () => {
    await renderHub({ agent: AGENT({ loadouts: undefined }) });
    expect(card('baggerbomb').textContent).toContain(name('contrarian'));
    expect(card('baggerbomb').textContent).toContain('Industrials');
  });
});

describe('board 2: the Deploy card\'s line, and the stage\'s words', () => {
  const deployLine = () => document.querySelector('[data-loadout-deploy-line]');

  it('desktop: "Next deploy carries" with the still, the book and its count; the door selects the Loadout area', async () => {
    await renderHub();
    const line = deployLine();
    expect(line.textContent).toContain(LOADOUT_COPY.nextCarries);
    expect(line.textContent).toContain(`${name('degen')} · Energy Movers · 3 names`);
    expect(stills().some((f) => propsOf(f).size === 40 && propsOf(f).archetype === 'degen')).toBe(true);
    click(line.querySelector('[data-loadout-deploy-next]'));
    await flush();
    expect(card('baggerbomb')).not.toBeNull();
  });

  it('a running game splits it: "Running now" in its armor, then what the next deploy carries', async () => {
    await renderHub({ activeBattles: [LIVE_BB('analyst')] });
    expect(deployLine().querySelector('[data-loadout-deploy-running]').getAttribute('data-loadout-deploy-running')).toBe('analyst');
    expect(deployLine().querySelector('[data-loadout-deploy-next]').getAttribute('data-loadout-deploy-next')).toBe('degen');
  });

  it('no book reads "No book · open market", and the Deploy card is exactly as with a book (Deploy keeps working)', async () => {
    await renderHub();
    const withBook = document.querySelector('[data-hub-section="deploy"] [data-hub-deploy]');
    const stateWith = withBook.getAttribute('data-hub-deploy');
    const holdWith = [...withBook.querySelectorAll('button')].filter((b) => !b.closest('[data-loadout-deploy-line]')).map((b) => b.disabled);
    for (const m of mounted) m.unmount();
    mounted = [];
    await renderHub({ agent: AGENT({ loadouts: { baggerbomb: SLOT({ book: { ref: null, name: null, pin: null } }) } }) });
    expect(deployLine().textContent).toContain(`${name('degen')} · No book · open market`);
    const without = document.querySelector('[data-hub-section="deploy"] [data-hub-deploy]');
    expect(without.getAttribute('data-hub-deploy')).toBe(stateWith);
    expect([...without.querySelectorAll('button')].filter((b) => !b.closest('[data-loadout-deploy-line]')).map((b) => b.disabled)).toEqual(holdWith);
  });

  it('no book never stops the Deploy card\'s Hold: a ready deploy with a live wiring holds with a book and without one', async () => {
    // (the hub above has no deploy provider here, so its Hold is disabled either way; this row gives the card one)
    const ready = HUB_LAYOUT_FIXTURES.returning.sections.deploy;
    const wiring = { controlId: 'card', onComplete: vi.fn() };
    const scope = (agent) => ({ agent, lock: OPEN, lockFailed: false, activeBattles: [], lists: { committed: LISTS }, armoryKind: 'baggerbomb', setArmoryKind: vi.fn(), bookKind: 'baggerbomb', setBookKind: vi.fn() });
    const hold = () => [...document.querySelectorAll('[data-hub-deploy] button')].find((b) => !b.closest('[data-loadout-deploy-line]'));
    for (const agent of [AGENT(), AGENT({ loadouts: { baggerbomb: SLOT({ book: { ref: null, name: null, pin: null } }) } })]) {
      const m = mount(<PerGameLoadoutContext.Provider value={scope(agent)}><DeploySection deploy={ready} holdWiring={wiring} onOpenLoadout={vi.fn()} onAction={vi.fn()} /></PerGameLoadoutContext.Provider>);
      mounted.push(m); // a failed expect below still unmounts it (afterEach), so no card leaks into a later row
      expect(document.querySelector('[data-hub-deploy]').getAttribute('data-hub-deploy')).toBe('ready');
      expect(hold().disabled).toBe(false);
      m.unmount();
      mounted = mounted.filter((x) => x !== m);
    }
    expect(document.querySelector('[data-hub-deploy]')).toBeNull();
  });

  it('the stage\'s loadout summary names both loadouts', async () => {
    await renderHub();
    expect(document.body.textContent).toContain(`BaggerBomb · ${name('degen')} · League · ${name('contrarian')}`);
  });
});

describe('board 4: the armory with a loadout context', () => {
  it('from the BaggerBomb card: its context line, its equipped set, "Equip X for BaggerBomb", the BaggerBomb write', async () => {
    await renderHub();
    click(row('baggerbomb', 'armor'));
    expect(dialog()).not.toBeNull();
    expect(context().getAttribute('data-armory-context')).toBe('baggerbomb');
    // the eyebrow, then the line under it
    expect(context().textContent).toBe('Choosing armor for BaggerBombapplies to the next deploy');
    expect(option('degen').hasAttribute('data-armory-equipped')).toBe(true);
    click(option('analyst'));
    expect(equipButton().textContent).toBe(`Equip ${name('analyst')} for BaggerBomb`);
    expect(document.querySelector('[data-armory-footnote]').textContent).toBe('Applies to the next deploy · a game already running keeps the armor it deployed with.');
    click(equipButton());
    await flush();
    expect(h.writers.changeLoadoutArchetype).toHaveBeenCalledTimes(1);
    expect(h.writers.changeLoadoutArchetype).toHaveBeenCalledWith('ag-1', 'analyst', 'baggerbomb');
    expect(dialog()).toBeNull();
  });

  it('from the League card, open: "Choosing armor for League", its own set, the League write', async () => {
    await renderHub();
    click(row('league', 'armor'));
    expect(context().getAttribute('data-armory-context')).toBe('league');
    expect(context().textContent).toContain('Choosing armor for League');
    expect(context().textContent).toContain('open · locks when you register');
    expect(option('contrarian').hasAttribute('data-armory-equipped')).toBe(true);
    click(option('guardian'));
    expect(equipButton().textContent).toBe(`Equip ${name('guardian')} for League`);
    click(equipButton());
    await flush();
    expect(h.writers.changeLoadoutArchetype).toHaveBeenCalledWith('ag-1', 'guardian', 'league');
  });

  it('League locked: previewing still works; Equip is the lock line and does nothing', async () => {
    await renderHub({ lock: LOCKED });
    click(row('league', 'armor'));
    expect(context().hasAttribute('data-armory-context-locked')).toBe(true);
    expect(context().textContent).toContain('locked until the week is scored, after the close on Fri Nov 6');
    click(option('guardian'));
    expect(document.querySelector('[data-armory-status]').textContent).toContain('Previewing');
    expect(equipButton().textContent).toBe('Locked until the week is scored');
    expect(equipButton().hasAttribute('data-armory-equip-locked')).toBe(true);
    expect(document.querySelector('[data-armory-footnote]').textContent).toBe('After the close on Fri Nov 6. Try sets on; nothing changes until then.');
    click(equipButton());
    await flush();
    expect(h.writers.changeLoadoutArchetype).not.toHaveBeenCalled();
    expect(dialog()).not.toBeNull();
  });

  it('the server refuses a League equip with the lock (its answer raced the card): the lock line, nothing changed', async () => {
    const refused = Object.assign(new Error('locked'), { status: 409, code: 'league_locked', payload: { lock: { endsAt: '2026-11-06T21:00:00.000Z' } } });
    h.writers.changeLoadoutArchetype.mockRejectedValue(refused);
    await renderHub();
    click(row('league', 'armor'));
    click(option('guardian'));
    click(equipButton());
    await flush();
    expect(document.querySelector('[data-armory-error]').textContent).toBe('Locked until the week is scored, after the close on Fri Nov 6.');
    expect(dialog()).not.toBeNull();
  });

  it('the equip itself refuses a locked League card, whatever calls it (the button is not the only gate)', async () => {
    const seen = {};
    function EquipProbe({ card }) {
      seen.equip = useArmoryEquip({ agent: AGENT(), card, onEquipped: vi.fn() }).equip;
      return null;
    }
    const league = (locked) => ({ kind: 'league', game: 'League', archetype: 'contrarian', locked });
    const m = mount(<EquipProbe card={league(true)} />);
    mounted.push(m);
    await act(async () => { await seen.equip('guardian'); });
    expect(h.writers.changeLoadoutArchetype).not.toHaveBeenCalled();
    m.unmount();
    mounted = mounted.filter((x) => x !== m);
    // the control: the same call on an open League card writes the League loadout
    mounted.push(mount(<EquipProbe card={league(false)} />));
    await act(async () => { await seen.equip('guardian'); });
    expect(h.writers.changeLoadoutArchetype).toHaveBeenCalledWith('ag-1', 'guardian', 'league');
  });

  it('a BaggerBomb change while a BaggerBomb game runs is offered (no battle lock: the next deploy wears it)', async () => {
    await renderHub({ activeBattles: [LIVE_BB('analyst')] });
    click(row('baggerbomb', 'armor'));
    click(option('guardian'));
    expect(equipButton().hasAttribute('data-armory-equip-locked')).toBe(false);
    click(equipButton());
    await flush();
    expect(h.writers.changeLoadoutArchetype).toHaveBeenCalledWith('ag-1', 'guardian', 'baggerbomb');
  });

  it('AR-5: closing gives focus back to the row that opened it', async () => {
    await renderHub();
    const opener = row('baggerbomb', 'armor');
    opener.focus();
    click(opener);
    expect(dialog()).not.toBeNull();
    press(dialog(), 'Escape');
    await flush();
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});

describe('the book door: today\'s watchlist sheet with the loadout\'s context', () => {
  it('BaggerBomb: titled for BaggerBomb, its book selected; a list equips it, "No book · open market" clears it', async () => {
    await renderHub();
    // AF-8: the book sheet sits under the watchlist sheet's id, so its return reads the lists and the idea once more
    // (useHubRuntime.js closeSheet), with the flags on as with them off.
    const listReads = h.listWatchlists.mock.calls.length;
    click(row('baggerbomb', 'book'));
    await flush();
    expect(document.body.textContent).toContain('Choose a book for BaggerBomb');
    expect(h.listWatchlists).toHaveBeenCalledTimes(listReads);
    expect(h.invalidations).toBe(0);
    click(byRole(document, 'button', /Industrials/)[0] || [...document.querySelectorAll('*')].find((el) => el.textContent === 'Industrials' && el.closest('button')));
    await flush();
    expect(h.writers.equipLoadoutBook).toHaveBeenCalledWith('ag-1', 'wl-ind', 'baggerbomb');
    expect(h.listWatchlists).toHaveBeenCalledTimes(listReads + 1);
    expect(h.invalidations).toBe(1);
    click(row('baggerbomb', 'book'));
    await flush();
    const none = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('No book · open market'));
    click(none);
    await flush();
    expect(h.writers.unequipLoadoutBook).toHaveBeenCalledWith('ag-1', 'baggerbomb');
    expect(h.listWatchlists).toHaveBeenCalledTimes(listReads + 2);
    expect(h.invalidations).toBe(2);
  });

  it('League, open: titled for League, writing the League book', async () => {
    await renderHub();
    click(row('league', 'book'));
    await flush();
    expect(document.body.textContent).toContain('Choose a book for League');
    const energy = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Energy Movers') && !b.closest('[data-loadout-card]') && !b.closest('[data-loadout-deploy-line]'));
    click(energy);
    await flush();
    expect(h.writers.equipLoadoutBook).toHaveBeenCalledWith('ag-1', 'wl-energy', 'league');
  });
});

describe('board 5, the phone: the armory in the hero\'s box, from a card', () => {
  for (const width of [320, 360, 390]) {
    it(`at ${width}: the Deploy card's line and both cards on the Loadout tab; the armor row opens the armory in the hero's box with the card's context`, async () => {
      await renderHub({ site: 'mobile', hubWidth: width });
      expect(document.querySelector('[data-loadout-deploy-line]')).not.toBeNull();
      expect([...document.querySelectorAll('[data-loadout-card]')].map((c) => c.getAttribute('data-loadout-card'))).toEqual(['baggerbomb', 'league']);
      const h0 = hero();
      expect(propsOf(h0).archetype).toBeUndefined();
      click(row('baggerbomb', 'armor'));
      const stage = document.querySelector('[data-hub-stage="phone"]');
      expect(stage.getAttribute('data-hub-armory')).toBe('open');
      expect(hero()).toBe(h0);
      expect(propsOf(h0).size).toBe(PHONE_ARMORY.centre);
      expect(propsOf(h0).archetype).toBe('degen');
      expect(stage.querySelector('[data-armory-context]').getAttribute('data-armory-context')).toBe('baggerbomb');
      expect(stage.querySelector('[data-armory-listbox]').getAttribute('data-armory-layout')).toBe('ring');
    });
  }

  it('Equip writes the BaggerBomb set, closes the armory, and the hero is bare again (N1)', async () => {
    await renderHub({ site: 'mobile', hubWidth: 390 });
    const h0 = hero();
    click(row('baggerbomb', 'armor'));
    click(option('guardian'));
    expect(propsOf(h0).archetype).toBe('guardian');
    click(equipButton());
    await flush();
    expect(h.writers.changeLoadoutArchetype).toHaveBeenCalledWith('ag-1', 'guardian', 'baggerbomb');
    expect(document.querySelector('[data-hub-stage="phone"]').getAttribute('data-hub-armory')).toBeNull();
    expect(propsOf(h0).archetype).toBeUndefined();
  });

  it('AR-6: under 315 px of hub width the sets sit in a 3 × 2 grid under the hero, inside its box', async () => {
    await renderHub({ site: 'mobile', hubWidth: 310 });
    click(row('baggerbomb', 'armor'));
    const list = document.querySelector('[data-armory-listbox]');
    expect(list.getAttribute('data-armory-layout')).toBe('grid');
    expect(list.style.gridTemplateColumns).toBe(`repeat(3, ${PHONE_ARMORY.slot}px)`);
    expect(document.querySelector('[data-armory-ring-line]')).toBeNull();
    expect(document.querySelectorAll('[role="option"]')).toHaveLength(6);
  });
});

describe('N1: outside a game, no figure wears a loadout\'s archetype but the stills and the armory\'s preview', () => {
  it('desktop and phone: every live form is bare (the hero); every dressed form is a still', async () => {
    for (const site of ['desktop', 'mobile']) {
      await renderHub({ site, hubWidth: site === 'mobile' ? 390 : 1280, activeBattles: [LIVE_BB('analyst')] });
      for (const f of all()) {
        const p = propsOf(f);
        if (p.archetype) expect(p.rate, `${site}: ${p.archetype} at ${p.size}`).toBe('still');
      }
      expect(propsOf(hero()).archetype).toBeUndefined();
      for (const m of mounted) m.unmount();
      mounted = [];
    }
  });
});

// The armory flip review §3.9, E-2: the clone-specific refusal (A2R-3 (b)) on the screen. The real deployAgent, the
// clone ensure answering 500, with both flags on: the deploy is refused before any POST, and the phone's Deploy card
// says "Couldn’t start the BaggerBomb game · try again" with the strip offering its Retry. The connected hub is the S7
// suite's (App's deploy provider, the real readers, the hold the player uses), with the per-game scope of this file.
describe('E-2: a clone ensure that fails refuses the deploy on the screen, with the retry line and the strip\'s Retry', () => {
  const T0 = Date.UTC(2026, 10, 9, 15, 0);
  let kit;
  let nowSpy;
  afterEach(() => {
    nowSpy?.mockRestore();
    nowSpy = null;
    kit?.restore();
    kit = null;
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('the phone at 390: refused before any POST; the card carries the clone line, the strip its Retry', async () => {
    resetAuthIdentityForTests();
    __resetHoldClaim();
    h.connected = true;
    h.connectedAgent = AGENT({ ownerId: CONNECTED_UID });
    kit = installFakeCanvas();
    const calls = [];
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      calls.push(url);
      if (url === '/api/agent/ensure-casual-clone') return { ok: false, status: 500, text: async () => JSON.stringify({ error: 'server_error' }) };
      return { ok: true, status: 200, text: async () => JSON.stringify({ success: true, agentBattleId: 'b-should-not-exist', portfolio: {}, bench: [] }) };
    }));
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    vi.setSystemTime(T0);
    nowSpy = vi.spyOn(performance, 'now').mockImplementation(() => kit.state.now);
    layout.state.hubWidth = 390;
    const hub = {
      activeBattles: [],
      activePoll: { epoch: 1, status: 'ready', ownerUid: CONNECTED_UID, ownerEpoch: 1, lastSuccessfulAt: T0 - 30000, error: null, refreshing: false },
      refreshActiveBattles: vi.fn(async () => true),
      openGame: vi.fn(), openFilmRoom: vi.fn(), setScreen: vi.fn(), onOpenForge: vi.fn(),
    };
    mounted.push(mount(
      <DeployAttemptProvider hubEnabled userName="flash" onCreateAgentBattle={vi.fn()} onEnterBattle={vi.fn()} onOpenBattle={vi.fn()} refreshActiveBattles={hub.refreshActiveBattles} clearCeremonyStash={vi.fn()}>
        <CommandCenterHub site="mobile" hub={hub} />
      </DeployAttemptProvider>,
    ));
    act(() => { for (const cb of [...h.authListeners]) cb({ uid: CONNECTED_UID }); });
    await flush();
    answerLock(OPEN);
    click(byRole(document, 'tab', COPY.phoneTabs.loadout)[0]);
    await flush();
    const strip = () => document.querySelector('[data-hub-strip]');
    const phoneCard = () => document.querySelector('[data-hub-deploy-card="phone"]');
    expect(card('baggerbomb')).not.toBeNull();   // the per-game scope is on: the flags-on hub
    // the player's hold on the strip: press, the 1.3 s charge, the locked beat, the request out
    const holdControl = byRole(strip(), 'button', COPY.deploy.holdLabel)[0] ?? strip().querySelector('button[aria-label]');
    act(() => {
      const e = new Event('pointerdown', { bubbles: true, cancelable: true });
      Object.defineProperty(e, 'pointerId', { value: 1 });
      holdControl.dispatchEvent(e);
    });
    kit.tick(650);
    kit.tick(650);
    await act(async () => { vi.advanceTimersByTime(450); });
    await flush();
    await flush();
    // refused before any POST: the ensure was the one deploy request (the idea reader's own read is the hub's, not the deploy's)
    expect(calls.filter((url) => url.startsWith('/api/agent/'))).toEqual(['/api/agent/ensure-casual-clone']);
    expect(phoneCard().textContent).toContain(LOADOUT_COPY.deployCloneFailed);
    expect(LOADOUT_COPY.deployCloneFailed).toBe('Couldn’t start the BaggerBomb game · try again');
    expect(strip().getAttribute('data-hub-strip')).toBe('failed');
    expect(byRole(strip(), 'button', COPY.deploy.retry)).toHaveLength(1);
  });
});

describe('flag off (A1 alone): the hub is A1\'s', () => {
  it('no loadout cards, no Deploy line; the Archetype card and Change archetype as A1 shows them', async () => {
    h.perGame.on = false;
    await renderHub();
    expect(document.querySelector('[data-loadout-card]')).toBeNull();
    expect(document.querySelector('[data-loadout-deploy-line]')).toBeNull();
    expect(document.querySelector('[data-hub-card="archetype"]')).not.toBeNull();
    expect(h.lockSubs).toEqual([]);
  });
});

// The armory flip's LD-1 (founder ruling, Nov 8, 2026): from the League section, the loadout door opens the Command Center
// on its Loadout tab, not the Overview; desktop on the Loadout area (where it already opens). One-shot: only the visit the
// door starts. The door is the real League line's, wired as App's flag-on arm wires it (`openLoadout: () =>
// openCommandCenterOnLoadout(setScreen)`; the two flag censuses pin App's line); App's screen change is the hub mounting.
describe('LD-1: the League door opens the Command Center on its Loadout tab, once', () => {
  beforeEach(() => { takeLoadoutEntry(); });
  afterEach(() => { takeLoadoutEntry(); });

  /** Tap the League tab's door (an open week); returns App's setScreen as the door called it. */
  function tapLeagueDoor() {
    const setScreen = vi.fn();
    const agent = AGENT();
    const line = mount(<LeagueLoadoutLine agentLoadout={{ name: agent.name, archetype: agent.archetype, equippedWatchlistId: agent.equippedWatchlistId, equippedWatchlistName: agent.equippedWatchlistName, openLoadout: () => openCommandCenterOnLoadout(setScreen) }} group={null} groupKnown accent="#5EEAD4" />);
    click(line.host.querySelector('button[data-league-loadout]'));
    line.unmount();
    return setScreen;
  }
  /** The dashboard screen mounting the hub, with no tab tapped. */
  async function enter(site) {
    layout.state.hubWidth = site === 'mobile' ? 390 : 1280;
    const m = mount(<CommandCenterHub site={site} hub={HUB(AGENT())} sections={HUB_LAYOUT_FIXTURES.returning.sections} />);
    mounted.push(m);
    await flush();
    answerLock(OPEN);
    await flush();
    return m;
  }
  const phoneTab = () => document.querySelector('[data-hub-phone-tab][aria-selected="true"]').getAttribute('data-hub-phone-tab');
  const desktopArea = () => document.querySelector('[data-hub-area][aria-selected="true"]').getAttribute('data-hub-area');
  const leave = () => { for (const m of mounted) m.unmount(); mounted = []; };

  it('phone: tapping the League door lands the hub on the Loadout tab, the League card on it', async () => {
    const setScreen = tapLeagueDoor();
    expect(setScreen.mock.calls).toEqual([['dashboard']]);
    await enter('mobile');
    expect(phoneTab()).toBe(PHONE_TABS.LOADOUT);
    expect(card('league')).not.toBeNull();
    expect(card('league').textContent).toContain(name('contrarian'));
  });

  it('desktop: the same door lands on the Loadout area (Equipped Archetype), and the visit takes the intent', async () => {
    tapLeagueDoor();
    await enter('desktop');
    expect(desktopArea()).toBe(String(HUB_AREAS.ARCHETYPE));
    expect(card('league')).not.toBeNull();
    // taken: a phone-width entry after it is an ordinary one
    leave();
    await enter('mobile');
    expect(phoneTab()).toBe(PHONE_TABS.OVERVIEW);
  });

  it('one-shot: the next ordinary entry into the Command Center opens on the Overview', async () => {
    // an ordinary entry, no door: the Overview
    await enter('mobile');
    expect(phoneTab()).toBe(PHONE_TABS.OVERVIEW);
    leave();
    tapLeagueDoor();
    await enter('mobile');
    expect(phoneTab()).toBe(PHONE_TABS.LOADOUT);
    // the player leaves and comes back by any other way: the Overview again
    leave();
    await enter('mobile');
    expect(phoneTab()).toBe(PHONE_TABS.OVERVIEW);
    expect(card('league')).toBeNull();
  });

  it('kill switch: with the flags held off the hub never reads the intent, and opens on the Overview', async () => {
    h.perGame.on = false;
    openCommandCenterOnLoadout(() => {});
    await enter('mobile');
    expect(phoneTab()).toBe(PHONE_TABS.OVERVIEW);
    // untouched: the flag-off arm is main's `useState(DEFAULT_PHONE_TAB)`
    expect(takeLoadoutEntry()).toBe(true);
  });
});
