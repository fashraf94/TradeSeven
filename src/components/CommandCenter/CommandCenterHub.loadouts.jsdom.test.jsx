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
}));
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
vi.mock('./hub/useHubReaders', () => ({ default: (hub) => ({ sections: {}, actions: {}, agent: hub?.[READ] ?? null }) }));
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
import { PHONE_ARMORY } from './Armory';
import { SET_ALONE } from '../AgentForm/agentFormSpec';
import { armoryLines } from './hub/archetypeLines';

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
    expect(lineText('league')).toBe('Locked until the week ends · Fri Nov 6, 4:00 PM. Set when you registered.');
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
    expect(context().textContent).toContain('locked until Fri Nov 6, 4:00 PM');
    click(option('guardian'));
    expect(document.querySelector('[data-armory-status]').textContent).toContain('Previewing');
    expect(equipButton().textContent).toBe('Locked until the week ends');
    expect(equipButton().hasAttribute('data-armory-equip-locked')).toBe(true);
    expect(document.querySelector('[data-armory-footnote]').textContent).toBe('Fri Nov 6, 4:00 PM. Try sets on; nothing changes until then.');
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
    expect(document.querySelector('[data-armory-error]').textContent).toBe('Locked until the week ends · Fri Nov 6, 4:00 PM. Set when you registered.');
    expect(dialog()).not.toBeNull();
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
    click(row('baggerbomb', 'book'));
    await flush();
    expect(document.body.textContent).toContain('Choose a book for BaggerBomb');
    click(byRole(document, 'button', /Industrials/)[0] || [...document.querySelectorAll('*')].find((el) => el.textContent === 'Industrials' && el.closest('button')));
    await flush();
    expect(h.writers.equipLoadoutBook).toHaveBeenCalledWith('ag-1', 'wl-ind', 'baggerbomb');
    click(row('baggerbomb', 'book'));
    await flush();
    const none = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('No book · open market'));
    click(none);
    await flush();
    expect(h.writers.unequipLoadoutBook).toHaveBeenCalledWith('ag-1', 'baggerbomb');
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
