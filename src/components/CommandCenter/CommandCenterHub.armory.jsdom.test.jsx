// @vitest-environment jsdom
//
// Agent form build A1 — the armory in the connected hub, desktop and phone, with AGENT_FORM_ARMORY_ENABLED held on here
// (it is dark on main) and the agent form wrapper replaced by a recording stand-in (the wrapper's own rows are
// AgentForm.armory.jsdom.test.jsx). The network seams are mocked as CommandCenterHub.realSheets.jsdom.test.jsx mocks
// them; HubSheet, the overlay stack and the shells are the real ones.
//
//   - the sheet: the armory with the flag on, the picker with it off;
//   - the six sets: the set alone (no brain), pewter unless equipped, a still until hovered or touched; at most one set
//     and the centre live;
//   - a preview plays the swap on the centre; Equip calls changeArchetype once with the chosen set; a battle lock shows
//     the hub's lock line; reduced motion is stills throughout;
//   - the hero behind the wide dialog is paused while it is open, and never remounts;
//   - the phone: the armory opens in the hero's box, the hero itself shrinks and wears the preview;
//   - the listbox's roles and keys, Escape, and focus.
// The follow-up (founder ruling N1, Nov 4, 2026): outside a game Shadow is neutral. With the flag on the hero, wide and
// phone, is bare Shadow whatever the agent's archetype, under Shadow's own label; an equip never changes it; the Loadout
// card names the archetype; R19's Equipped Archetype response lights the whole bare form; the phone's close, by any path,
// is one unequip.

import React, { Component, act } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { userState, listWatchlists, equipWatchlist, unequipWatchlist, changeArchetype, flags, slots, armory, motion, forms } = vi.hoisted(() => ({
  userState: { user: { displayName: 'Flash', username: 'flash' } },
  listWatchlists: vi.fn(),
  equipWatchlist: vi.fn(),
  unequipWatchlist: vi.fn(),
  changeArchetype: vi.fn(),
  flags: { current: { concurrencyEnabled: true, hypothesisRecordsOn: true, characterTab: true } },
  slots: { current: [{ id: 'archetype', filled: true }, { id: 'watchlist', filled: true }] },
  armory: { on: true },
  motion: { reduced: false },
  forms: { next: 0, live: new Map(), mounts: 0, unmounts: 0, silent: false },
}));
vi.mock('../../config/agentFormFlags', async (importOriginal) => ({ ...(await importOriginal()), get AGENT_FORM_ARMORY_ENABLED() { return armory.on; } }));
vi.mock('framer-motion', async (importOriginal) => ({ ...(await importOriginal()), useReducedMotion: () => motion.reduced }));
vi.mock('../AgentForm/AgentForm', () => ({
  default: class AgentFormProbe extends Component {
    constructor(props) { super(props); this.id = ++forms.next; this.history = []; }
    componentDidMount() { forms.live.set(this.id, this); forms.mounts += 1; if (!forms.silent) this.props.onStatus?.('live'); }
    componentWillUnmount() { forms.live.delete(this.id); forms.unmounts += 1; }
    render() { this.history.push(this.props); return null; }
  },
}));
vi.mock('../../contexts/UserContext', () => ({ useUser: () => userState }));
vi.mock('../../firebase/config', () => ({ db: {}, auth: {} }));
const { READ } = vi.hoisted(() => ({ READ: Symbol('agentRead') }));
vi.mock('./hub/useHubReaders', () => ({ default: (hub) => ({ sections: {}, actions: {}, agent: hub?.[READ] ?? null }) }));
vi.mock('../../services/forgeWatchlistService', () => ({ listWatchlists }));
vi.mock('../../services/agentService', () => ({ equipWatchlist, unequipWatchlist, changeArchetype }));
vi.mock('../../hooks/useMasteryProfile', () => ({ default: () => null }));
vi.mock('./hub/hubFlags', async (importOriginal) => ({ ...(await importOriginal()), hubFlags: () => flags.current }));
vi.mock('../../utils/equipSlots', () => ({ getEquipSlots: () => slots.current }));

import CommandCenterHub from './CommandCenterHub';
import { ARMORY_COPY, HUB_COPY as COPY } from './hub/hubCopy';
import { HUB_LAYOUT_FIXTURES } from './__fixtures__/hubLayoutFixtures';
import { byRole, click, injectTokens, installFakeLayout, mount, mountFakeBottomNav, press } from './__fixtures__/hubTestKit';
import { ARMORY_SETS, PHONE_ARMORY, phoneHero } from './Armory';
import { SET_ALONE, UNLIT } from '../AgentForm/agentFormSpec';
import { armoryLines } from './hub/archetypeLines';
import { CLASHBOT_OPEN_EVENT } from '../ClashBot/ClashBotWidget';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let layout;
let removeTokens;
let removeNav;
let mounted = [];
let errorSpy;

beforeAll(() => { removeTokens = injectTokens(); });
afterAll(() => { removeTokens(); });
beforeEach(() => {
  layout = installFakeLayout();
  removeNav = mountFakeBottomNav();
  for (const fn of [listWatchlists, equipWatchlist, unequipWatchlist, changeArchetype]) fn.mockReset();
  listWatchlists.mockResolvedValue([{ watchlistId: 'wl-1', name: 'Tech Leaders', status: 'committed', tickers: ['NVDA', 'AAPL'] }]);
  changeArchetype.mockResolvedValue({ ok: true });
  armory.on = true;
  motion.reduced = false;
  forms.next = 0; forms.live = new Map(); forms.mounts = 0; forms.unmounts = 0; forms.silent = false;
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  for (const m of mounted) m.unmount();
  mounted = [];
  removeNav();
  layout.restore();
  errorSpy.mockRestore();
});

const AGENT = (over = {}) => ({ id: 'ag-1', ownerId: 'u-1', name: 'Nova', archetype: 'momentum_chaser', equippedWatchlistId: 'wl-1', stats: { gamesPlayed: 12 }, ...over });
// The fix pass (review AR-3): every row that says "the equipped set" gives the agent a set that is not the ring's first,
// so the equipped set and the first set can never be confused (focus on open, the lit set, the reopened preview).
const EQUIPPED = 'analyst';
const ON_EQUIPPED = () => AGENT({ archetype: EQUIPPED });
const HUB = (agent = AGENT()) => ({ activeBattles: [], setScreen: vi.fn(), onOpenForge: vi.fn(), [READ]: { status: 'ready', agent, retry: vi.fn() } });
const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };

async function renderHub({ site = 'desktop', hubWidth = 1280, agent = AGENT(), hubExtra = null } = {}) {
  layout.state.hubWidth = hubWidth;
  const hubs = [];
  const element = (a) => { hubs.push({ ...HUB(a), ...hubExtra }); return <CommandCenterHub site={site} hub={hubs.at(-1)} sections={HUB_LAYOUT_FIXTURES.returning.sections} />; };
  const m = mount(element(agent));
  mounted.push(m);
  await flush();
  if (site === 'mobile') click(byRole(document, 'tab', COPY.phoneTabs.loadout)[0]);
  return { m, hub: () => hubs.at(-1), element: () => element(agent), reread: async (next) => { m.rerender(element(next)); await flush(); } };
}

// The forms on the page, by what they are: the hero (HubAgentForm hands the response props), the wide dialog's centre
// (it plays the change), and the sets on their hooks (the set alone).
const all = () => [...forms.live.values()];
const propsOf = (form) => form.history.at(-1);
const hero = () => all().find((f) => 'responsePart' in propsOf(f)) ?? null;
const centre = () => all().find((f) => !('responsePart' in propsOf(f)) && propsOf(f).coreStage !== SET_ALONE) ?? null;
const sets = () => all().filter((f) => propsOf(f).coreStage === SET_ALONE);
const setOf = (codeId) => sets().find((f) => propsOf(f).archetype === codeId) ?? null;
const liveViews = () => all().filter((f) => propsOf(f).rate !== 'still' && !propsOf(f).paused);

const btn = (name, scope = document) => byRole(scope, 'button', name)[0] || null;
const dialog = () => document.querySelector('[role="dialog"][aria-label="Armory"]');
const option = (codeId) => document.querySelector(`[role="option"][data-armory-set="${codeId}"]`);
const statusLine = () => document.querySelector('[data-armory-status]');
const equipButton = () => document.querySelector('[data-armory-equip]');
const nameOf = (codeId) => armoryLines(codeId).name;

function pointer(el, type) {
  act(() => { el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, relatedTarget: type === 'pointerover' || type === 'pointerout' ? document.body : null })); });
}
async function equipAndSettle() {
  click(equipButton());
  await flush();
}

describe('the sheet: the armory with the flag on, the picker with it off', () => {
  it('flag on, wide: Change archetype opens the armory dialog over the hub, not the picker', async () => {
    await renderHub();
    click(btn(COPY.loadout.changeArchetype));
    expect(dialog()).not.toBeNull();
    expect(dialog().getAttribute('aria-modal')).toBe('true');
    expect(document.body.textContent).not.toContain('Choose archetype');
    expect(byRole(document, 'listbox', ARMORY_COPY.sets)).toHaveLength(1);
    expect(byRole(document, 'option').map((o) => o.getAttribute('aria-label'))).toEqual(ARMORY_SETS.map(nameOf));
  });

  it('flag off: the same control opens the shipped picker, as before', async () => {
    armory.on = false;
    await renderHub();
    click(btn(COPY.loadout.changeArchetype));
    expect(dialog()).toBeNull();
    expect(document.body.textContent).toContain('Choose archetype');
    expect(sets()).toHaveLength(0);
  });

  it('flag on, phone: nothing opens over the page; the armory is in the hero\'s box', async () => {
    await renderHub({ site: 'mobile', hubWidth: 390 });
    click(btn(COPY.loadout.changeArchetype));
    expect(dialog()).toBeNull();
    expect(document.body.textContent).not.toContain('Choose archetype');
    const stage = document.querySelector('[data-hub-stage="phone"]');
    expect(stage.getAttribute('data-hub-armory')).toBe('open');
    expect(stage.querySelector('[role="listbox"]')).not.toBeNull();
    expect(stage.querySelectorAll('[role="option"]')).toHaveLength(6);
  });
});

describe('the six sets on their hooks (board 6; FD-9)', () => {
  it('each is the set alone (no brain), pewter unless it is the equipped one, decorative, and a still', async () => {
    await renderHub({ agent: ON_EQUIPPED() });
    click(btn(COPY.loadout.changeArchetype));
    expect(sets()).toHaveLength(6);
    for (const codeId of ARMORY_SETS) {
      const p = propsOf(setOf(codeId));
      expect(p.coreStage).toBe(SET_ALONE);
      expect(p.allegiance).toBe(codeId === EQUIPPED ? 'player' : UNLIT);
      expect(p.label).toBeNull();
      expect(p.rate).toBe('still');
      expect(p.equipOnChange).toBeUndefined();
    }
    expect(ARMORY_SETS.filter((codeId) => option(codeId).hasAttribute('data-armory-equipped'))).toEqual([EQUIPPED]);
  });

  it('hovering a set makes it live; leaving makes it a still again; one set at a time, so never more than two live views in the dialog', async () => {
    await renderHub();
    click(btn(COPY.loadout.changeArchetype));
    pointer(option('contrarian'), 'pointerover');
    expect(propsOf(setOf('contrarian')).rate).toBe('live');
    expect(sets().filter((f) => propsOf(f).rate === 'live')).toHaveLength(1);
    pointer(option('degen'), 'pointerover');
    pointer(option('contrarian'), 'pointerout');
    expect(propsOf(setOf('contrarian')).rate).toBe('still');
    expect(propsOf(setOf('degen')).rate).toBe('live');
    // the hero behind is paused, so what draws is the centre and the one hovered set
    expect(liveViews()).toHaveLength(2);
    pointer(option('degen'), 'pointerout');
    expect(sets().every((f) => propsOf(f).rate === 'still')).toBe(true);
  });

  it('no flash on open: each figure stays hidden until its view has reported, so the wrapper\'s placeholder never shows', async () => {
    // jsdom has WebGL here, as a phone does: without it the wrapper's still is the figure, shown at once.
    globalThis.WebGL2RenderingContext = function WebGL2RenderingContext() {};
    try {
      forms.silent = true;
      await renderHub();
      click(btn(COPY.loadout.changeArchetype));
      const figures = [...document.querySelectorAll('[data-armory-figure]')];
      expect(figures).toHaveLength(7); // the centre and the six sets
      expect(figures.every((f) => f.style.visibility === 'hidden')).toBe(true);
      act(() => { for (const f of all()) propsOf(f).onStatus?.('live'); });
      expect(figures.every((f) => f.style.visibility === 'visible')).toBe(true);
    } finally {
      delete globalThis.WebGL2RenderingContext;
    }
  });

  it('a touch makes the set live while it is held, and a still when lifted (the phone ring)', async () => {
    await renderHub({ site: 'mobile', hubWidth: 390 });
    click(btn(COPY.loadout.changeArchetype));
    pointer(option('guardian'), 'pointerdown');
    expect(propsOf(setOf('guardian')).rate).toBe('live');
    expect(liveViews()).toHaveLength(2); // the hero (the centre) and the touched set
    pointer(option('guardian'), 'pointerup');
    expect(propsOf(setOf('guardian')).rate).toBe('still');
  });
});

describe('preview and equip (the wide dialog)', () => {
  it('selecting a set previews it: the centre plays the swap to it, the status and the button say so', async () => {
    await renderHub({ agent: ON_EQUIPPED() });
    click(btn(COPY.loadout.changeArchetype));
    const c = centre();
    expect(propsOf(c).archetype).toBe(EQUIPPED);
    expect(option(EQUIPPED).getAttribute('aria-selected')).toBe('true');
    expect(propsOf(c).equipOnChange).toBe(true);
    expect(propsOf(c).size).toBe(300);
    expect(statusLine().textContent).toBe(ARMORY_COPY.equipped);
    expect(equipButton().disabled).toBe(true);
    click(option('contrarian'));
    expect(centre()).toBe(c); // the same view: a change it plays, never a remount
    expect(propsOf(c).archetype).toBe('contrarian');
    expect(option('contrarian').getAttribute('aria-selected')).toBe('true');
    expect(statusLine().textContent).toBe(ARMORY_COPY.previewingOver(nameOf(EQUIPPED)));
    expect(equipButton().textContent).toBe(ARMORY_COPY.equip(nameOf('contrarian')));
    expect(changeArchetype).not.toHaveBeenCalled();
  });

  it('Equip calls changeArchetype once, with the agent and the chosen set, and closes the armory', async () => {
    await renderHub();
    click(btn(COPY.loadout.changeArchetype));
    click(option('diversifier'));
    await equipAndSettle();
    expect(changeArchetype).toHaveBeenCalledTimes(1);
    expect(changeArchetype).toHaveBeenCalledWith('ag-1', 'diversifier');
    expect(dialog()).toBeNull();
  });

  it('N2(a): a battle lock (409 battle_active) shows the armory\'s own line, never the Loadout card\'s, and the armory stays open', async () => {
    changeArchetype.mockRejectedValueOnce(Object.assign(new Error('Cannot change archetype while the agent has an active battle.'), { status: 409, code: 'battle_active' }));
    await renderHub();
    click(btn(COPY.loadout.changeArchetype));
    click(option('analyst'));
    await equipAndSettle();
    expect(dialog()).not.toBeNull();
    expect(document.querySelector('[data-armory-error]').textContent).toBe(ARMORY_COPY.locked);
    expect(dialog().textContent).not.toContain(COPY.loadout.nextDeployLocked);
    // another refusal keeps its own words (the route's other 409s are not battle locks)
    changeArchetype.mockRejectedValueOnce(Object.assign(new Error('Configuration writes are briefly paused.'), { status: 409, code: 'epoch_closed' }));
    await equipAndSettle();
    expect(document.querySelector('[data-armory-error]').textContent).toBe('Configuration writes are briefly paused.');
    expect(changeArchetype).toHaveBeenCalledTimes(2);
  });

  it('a tempo-dial reset is never silent: the notice shows and the armory stays open', async () => {
    changeArchetype.mockResolvedValueOnce({ dialInvalidated: true });
    await renderHub();
    click(btn(COPY.loadout.changeArchetype));
    click(option('degen'));
    await equipAndSettle();
    expect(dialog()).not.toBeNull();
    expect(document.querySelector('[data-armory-notice]').textContent).toBe(ARMORY_COPY.dialReset(nameOf('degen')));
  });

  it('a result that lands after the armory closed is dropped: it closes nothing that opened since', async () => {
    let resolve;
    changeArchetype.mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
    await renderHub();
    click(btn(COPY.loadout.changeArchetype));
    click(option('degen'));
    click(equipButton());
    click(btn(COPY.sheet.close));
    click(btn(COPY.loadout.changeArchetype));
    expect(dialog()).not.toBeNull();
    await act(async () => { resolve({ ok: true }); await Promise.resolve(); });
    expect(dialog()).not.toBeNull();
  });
});

describe('the hero behind the wide dialog', () => {
  it('is paused while the armory is open, resumes when it closes, and is the same view throughout', async () => {
    await renderHub();
    const h = hero();
    expect(propsOf(h).paused).toBe(false);
    click(btn(COPY.loadout.changeArchetype));
    expect(hero()).toBe(h);
    expect(propsOf(h).paused).toBe(true);
    click(btn(COPY.sheet.close));
    expect(hero()).toBe(h);
    expect(propsOf(h).paused).toBe(false);
  });

  it('N1: it stays bare through the open, the preview and the equip, and never suits up; the Loadout card names the new set', async () => {
    const { reread } = await renderHub();
    const h = hero();
    click(btn(COPY.loadout.changeArchetype));
    click(option('contrarian'));
    expect(propsOf(centre()).archetype).toBe('contrarian'); // the dialog's own centre wears the preview
    await equipAndSettle();
    await reread(AGENT({ archetype: 'contrarian' }));
    expect(hero()).toBe(h);
    expect(propsOf(h).paused).toBe(false);
    // not one render of the hero, from its mount to here, wore a set: no change, so no suit-up
    expect(h.history.map((p) => p.archetype)).toEqual(h.history.map(() => undefined));
    expect(loadoutArchetypeName()).toBe(nameOf('contrarian'));
  });
});

// ── Founder ruling N1 (Nov 4, 2026): outside a game Shadow is always neutral ─────────────────────────────────────────
/**
 * The phone's close, in N1's words: the armor comes off with the 700 ms unequip as the box collapses — ONE change of
 * the hero, to bare Shadow, played (equipOnChange), in the same render as its return to the stage's size — and nothing
 * after it: no step back to a set, no second suit-up. The engine plays a change to bare as the unequip, and draws it
 * at once under reduced motion (engine.js swap()).
 */
const closesOnce = (h, from, previewed) => {
  const after = h.history.slice(from);
  const at = after.findIndex((p) => p.archetype === undefined);
  expect(at, 'the hero never took the armor off').toBeGreaterThan(-1);
  // until the close it wears the previewed set, at the armory's centre; from the close on, bare Shadow at the stage's size
  expect(after.slice(0, at).every((p) => p.archetype === previewed && p.size === PHONE_ARMORY.centre)).toBe(true);
  const worn = after.slice(at).filter((p) => p.archetype !== undefined);
  expect(worn.map((p) => p.archetype), 'a set worn again after the close').toEqual([]);
  // back to the bare hero's own size (ruling D-A: 240 at the rows' 390 px), in the same render as the unequip
  expect(after[at].size).toBe(phoneHero(390).size);
  expect(after[at].equipOnChange).toBe(true);
};

const heroBox = () => document.querySelector('[data-hub-agent-form]');
const bareLabel = (areaName) => COPY.shadow.imageLabel(heroBox().getAttribute('data-shadow-status'), areaName);
const areaTabs = () => [...document.querySelectorAll('[role="tablist"][aria-label] [role="tab"]')].filter((t) => t.closest('[data-hub-stage]'));
/** The Loadout panel's Archetype card: which of the six names it shows. */
const loadoutArchetypeName = () => {
  const text = document.querySelector('[data-hub-card="archetype"]')?.textContent ?? '';
  const named = ARMORY_SETS.map(nameOf).filter((n) => text.includes(n));
  return named.length === 1 ? named[0] : named;
};

describe('N1: the hub hero is bare Shadow with the flag on, whatever the archetype', () => {
  for (const site of ['desktop', 'mobile']) {
    it(`${site}: bare for every archetype the agent may wear, under Shadow's own label; nothing on the hub reads "Shadow wearing"`, async () => {
      const width = site === 'mobile' ? 390 : 1280;
      for (const archetype of ['momentum_chaser', 'analyst', 'degen', 'unknown']) {
        await renderHub({ site, hubWidth: width, agent: AGENT({ archetype }) });
        const p = propsOf(hero());
        expect(p.archetype, archetype).toBeUndefined();
        expect(p.label, archetype).toBe(bareLabel(COPY.areas.names[2]));
        expect(document.body.innerHTML).not.toMatch(/wearing/i);
        expect(all().map((f) => propsOf(f).label).filter((l) => typeof l === 'string' && /wearing/i.test(l))).toEqual([]);
        for (const m of mounted) m.unmount();
        mounted = [];
        forms.live = new Map();
      }
    });
  }

  it('the control: with the flag off the hero wears the archetype under "Shadow wearing", exactly as main', async () => {
    armory.on = false;
    await renderHub({ agent: AGENT({ archetype: 'analyst' }) });
    expect(propsOf(hero()).archetype).toBe('analyst');
    expect(propsOf(hero()).label).toMatch(new RegExp(`^Shadow wearing ${nameOf('analyst')} — `));
  });

  it('the hero keeps its view: the same agent id, so no remount when the read is made bare or changes archetype', async () => {
    const { reread } = await renderHub({ agent: AGENT({ archetype: 'analyst' }) });
    const h = hero();
    await reread(AGENT({ archetype: 'guardian' }));
    expect(hero()).toBe(h);
    expect(forms.unmounts).toBe(0);
    expect(propsOf(h).archetype).toBeUndefined();
  });

  it('the Loadout panel\'s Archetype card still names the archetype (it reads the agent, not the hero)', async () => {
    await renderHub({ agent: AGENT({ archetype: 'analyst' }) });
    expect(loadoutArchetypeName()).toBe(nameOf('analyst'));
  });

  it('R19: a response on the Equipped Archetype area lights the whole bare form, not its armor (board 5 does not cover bare Shadow)', async () => {
    for (const on of [true, false]) {
      armory.on = on;
      await renderHub({ agent: AGENT({ archetype: 'analyst' }) });
      const [partnership, , archetypeArea] = areaTabs();
      click(partnership);
      click(archetypeArea);
      // flag on: the bare hero's archetype area brightens everything; the flag-off control keeps main's armor response
      expect(propsOf(hero()).responsePart, `flag ${on ? 'on' : 'off'}`).toBe(on ? 'all' : 'armor');
      for (const m of mounted) m.unmount();
      mounted = [];
      forms.live = new Map();
    }
  });
});

describe('reduced motion', () => {
  it('every view is told, every set stays a still even when hovered, and a preview is the same change (the wrapper draws it at once)', async () => {
    motion.reduced = true;
    await renderHub();
    click(btn(COPY.loadout.changeArchetype));
    pointer(option('contrarian'), 'pointerover');
    expect(sets().every((f) => propsOf(f).rate === 'still' && propsOf(f).reducedMotion === true)).toBe(true);
    expect(propsOf(centre()).reducedMotion).toBe(true);
    click(option('contrarian'));
    expect(propsOf(centre()).archetype).toBe('contrarian');
  });
});

describe('the listbox: roles, keys and focus', () => {
  it('the ring is a single-select listbox; the arrows, Home and End move the preview and focus with it; Escape closes', async () => {
    await renderHub();
    click(btn(COPY.loadout.changeArchetype));
    const listbox = byRole(document, 'listbox', ARMORY_COPY.sets)[0];
    expect(byRole(listbox, 'option').map((o) => o.tabIndex)).toEqual([0, -1, -1, -1, -1, -1]);
    option('momentum_chaser').focus();
    press(option('momentum_chaser'), 'ArrowRight');
    expect(document.activeElement).toBe(option('contrarian'));
    expect(propsOf(centre()).archetype).toBe('contrarian');
    press(document.activeElement, 'ArrowLeft');
    press(document.activeElement, 'ArrowLeft');
    expect(document.activeElement).toBe(option(ARMORY_SETS[5]));
    press(document.activeElement, 'Home');
    expect(document.activeElement).toBe(option(ARMORY_SETS[0]));
    press(document.activeElement, 'End');
    expect(option(ARMORY_SETS[5]).getAttribute('aria-selected')).toBe('true');
    expect(statusLine().getAttribute('role')).toBe('status');
    press(document.activeElement, 'Escape');
    expect(dialog()).toBeNull();
  });
});

describe('the phone: the armory in the hero\'s box (FD-8)', () => {
  it('the text column and the area lines fold away; the hero is the same view, shrunk to the armory\'s centre and live', async () => {
    await renderHub({ site: 'mobile', hubWidth: 390 });
    const h = hero();
    expect(propsOf(h).size).toBe(240);
    const stage = document.querySelector('[data-hub-stage="phone"]');
    expect(stage.textContent).toContain(COPY.shadow.name);
    click(btn(COPY.loadout.changeArchetype));
    expect(hero()).toBe(h);
    expect(forms.unmounts).toBe(0);
    expect(propsOf(h).size).toBe(PHONE_ARMORY.centre);
    expect(propsOf(h).paused).toBe(false);
    expect(stage.textContent).not.toContain(COPY.shadow.role);
    expect(stage.querySelector('[data-hub-summary]')).toBeNull();
    expect(stage.querySelector('[data-armory-hero]').getAttribute('aria-hidden')).toBe('true');
    expect(sets().map((f) => propsOf(f).size)).toEqual(Array(6).fill(PHONE_ARMORY.slot - 2));
  });

  it('N1: opening suits the bare hero up in the equipped set; a tap previews another on the hero itself, played', async () => {
    await renderHub({ site: 'mobile', hubWidth: 390, agent: ON_EQUIPPED() });
    const h = hero();
    expect(propsOf(h).archetype).toBeUndefined();
    click(btn(COPY.loadout.changeArchetype));
    expect(propsOf(h).archetype).toBe(EQUIPPED);
    expect(propsOf(h).equipOnChange).toBe(true);
    click(option('contrarian'));
    expect(propsOf(h).archetype).toBe('contrarian');
    expect(propsOf(h).equipOnChange).toBe(true);
  });

  for (const reduced of [false, true]) {
    it(`N1: Close takes the armor off once, as the box collapses, and remounts nothing${reduced ? ' (under Reduce Motion too)' : ''}`, async () => {
      motion.reduced = reduced;
      const { reread } = await renderHub({ site: 'mobile', hubWidth: 390 });
      const h = hero();
      click(btn(COPY.loadout.changeArchetype));
      click(option('contrarian'));
      const from = h.history.length;
      click(document.querySelector('[data-armory-close]'));
      expect(hero()).toBe(h);
      expect(forms.unmounts).toBe(6); // the six sets went; the hero stayed
      closesOnce(h, from, 'contrarian');
      expect(propsOf(h).reducedMotion).toBe(reduced);
      // a later change of the record changes nothing: the hero is bare
      await reread(AGENT({ archetype: 'guardian' }));
      closesOnce(h, from, 'contrarian');
    });
  }

  it('N1: an equip closes the armory and the hero takes the armor off once; the record catching up changes nothing, the card names the set', async () => {
    const { reread } = await renderHub({ site: 'mobile', hubWidth: 390 });
    const h = hero();
    click(btn(COPY.loadout.changeArchetype));
    click(option('analyst'));
    const from = h.history.length;
    await equipAndSettle();
    expect(changeArchetype).toHaveBeenCalledWith('ag-1', 'analyst');
    expect(document.querySelector('[data-hub-stage="phone"]').getAttribute('data-hub-armory')).toBeNull();
    closesOnce(h, from, 'analyst');
    await reread(AGENT({ archetype: 'analyst' }));
    closesOnce(h, from, 'analyst');
    expect(hero()).toBe(h);
    expect(loadoutArchetypeName()).toBe(nameOf('analyst'));
  });

  it('a result that lands after the phone armory closed some other way is dropped: it closes nothing and moves no focus', async () => {
    let resolve;
    changeArchetype.mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
    await renderHub({ site: 'mobile', hubWidth: 390 });
    click(btn(COPY.loadout.changeArchetype));
    click(option('degen'));
    click(equipButton());
    // another sheet opens over the hub's one slot: the armory closes without its own Close
    click(btn(COPY.loadout.changeWatchlist));
    expect(document.querySelector('[data-hub-stage="phone"]').getAttribute('data-hub-armory')).toBeNull();
    const sheetClose = () => document.querySelector('button[aria-label="Close"]');
    expect(sheetClose()).not.toBeNull();
    const focused = document.activeElement;
    await act(async () => { resolve({ ok: true }); await Promise.resolve(); });
    // the watchlist sheet is still open and focus has not moved to Change archetype
    expect(sheetClose()).not.toBeNull();
    expect(document.activeElement).toBe(focused);
    // and the next open starts clean: no "Equipping…" left over
    click(sheetClose());
    click(btn(COPY.loadout.changeArchetype));
    click(option('degen'));
    expect(equipButton().textContent).toBe(ARMORY_COPY.equip(nameOf('degen')));
  });

  it('N2(a): a battle lock shows the armory\'s own lock line in the stage, and the armory stays open', async () => {
    changeArchetype.mockRejectedValueOnce(Object.assign(new Error('x'), { status: 409, code: 'battle_active' }));
    await renderHub({ site: 'mobile', hubWidth: 390 });
    click(btn(COPY.loadout.changeArchetype));
    click(option('degen'));
    await equipAndSettle();
    const stage = document.querySelector('[data-hub-stage="phone"]');
    expect(stage.getAttribute('data-hub-armory')).toBe('open');
    expect(stage.querySelector('[data-armory-error]').textContent).toBe(ARMORY_COPY.locked);
    expect(stage.textContent).not.toContain(COPY.loadout.nextDeployLocked);
  });

  it('N2(b): the footnote is FD-1\'s sentence alone, on the phone and in the dialog', async () => {
    await renderHub({ site: 'mobile', hubWidth: 390 });
    click(btn(COPY.loadout.changeArchetype));
    expect(document.querySelector('[data-armory-footnote]').textContent).toBe(ARMORY_COPY.footnote);
    expect(document.body.textContent).not.toMatch(/partnership and shared research/i);
    for (const m of mounted) m.unmount();
    mounted = [];
    await renderHub();
    click(btn(COPY.loadout.changeArchetype));
    expect(dialog().querySelector('[data-armory-footnote]').textContent).toBe(ARMORY_COPY.footnote);
    expect(dialog().textContent).not.toMatch(/partnership and shared research/i);
  });

  it('opening focuses the equipped set; Escape closes, and focus goes back to Change archetype', async () => {
    await renderHub({ site: 'mobile', hubWidth: 390, agent: ON_EQUIPPED() });
    const opener = btn(COPY.loadout.changeArchetype);
    opener.focus();
    click(opener);
    // the equipped set, which is not the ring's first (review AR-3)
    expect(document.activeElement).toBe(option(EQUIPPED));
    expect(document.activeElement).not.toBe(option(ARMORY_SETS[0]));
    press(document.activeElement, 'ArrowDown');
    expect(document.activeElement).toBe(option(ARMORY_SETS[ARMORY_SETS.indexOf(EQUIPPED) + 1]));
    press(document.activeElement, 'Escape');
    expect(document.querySelector('[data-hub-stage="phone"]').getAttribute('data-hub-armory')).toBeNull();
    expect(document.activeElement).toBe(btn(COPY.loadout.changeArchetype));
  });

  // Review AR-1: the opener sits below the stage, and a focus that scrolled to it carried the hero out of view while it
  // collapsed and took the armor off (measured in a real browser: the hub's section scrolled 8 → 365 px). jsdom cannot
  // scroll, so the row is the option itself; the browser harness is the proof (the A1 report §15).
  for (const [path, closeIt] of [
    ['Close', () => click(document.querySelector('[data-armory-close]'))],
    ['Escape', () => press(document.activeElement, 'Escape')],
    ['Equip', async () => { click(option('degen')); await equipAndSettle(); }],
  ]) {
    it(`AR-1: ${path} gives focus back to Change archetype without scrolling to it`, async () => {
      await renderHub({ site: 'mobile', hubWidth: 390, agent: ON_EQUIPPED() });
      const opener = btn(COPY.loadout.changeArchetype);
      opener.focus();
      click(opener);
      const focus = vi.spyOn(opener, 'focus');
      await closeIt();
      expect(document.querySelector('[data-hub-stage="phone"]').getAttribute('data-hub-armory')).toBeNull();
      expect(focus).toHaveBeenCalledTimes(1);
      expect(focus).toHaveBeenCalledWith({ preventScroll: true });
      expect(document.activeElement).toBe(opener);
    });
  }

  it('reduced motion: the sets stay stills when touched', async () => {
    motion.reduced = true;
    await renderHub({ site: 'mobile', hubWidth: 390 });
    click(btn(COPY.loadout.changeArchetype));
    pointer(option('guardian'), 'pointerdown');
    expect(sets().every((f) => propsOf(f).rate === 'still')).toBe(true);
    expect(propsOf(hero()).reducedMotion).toBe(true);
  });

  it('the page around the phone armory is not made inert (it is part of the hub, not an overlay)', async () => {
    const { m } = await renderHub({ site: 'mobile', hubWidth: 390 });
    click(btn(COPY.loadout.changeArchetype));
    expect(m.host.closest('[inert]')).toBeNull();
    expect(m.host.hasAttribute('inert')).toBe(false);
  });
});

// ── Founder ruling N2(d) (Nov 4, 2026): the phone page stays usable while the armory is open, but the armory steps aside ──
// A tab switch, another sheet opening or the hub being left closes it, its preview discarded and nothing equipped, with
// the unequip of N1 (one change of the hero, to bare Shadow). A deploy starting is the real provider's: the hold and the
// strip's Retry rows are in CommandCenterHub.s2b.jsdom.test.jsx, the provider's suite.
describe('N2(d): the phone armory steps aside', () => {
  const stage = () => document.querySelector('[data-hub-stage="phone"]');
  const armoryOpen = () => stage()?.getAttribute('data-hub-armory') === 'open';
  async function openAndPreview() {
    click(btn(COPY.loadout.changeArchetype));
    expect(armoryOpen()).toBe(true);
    click(option('contrarian'));
    expect(propsOf(hero()).archetype).toBe('contrarian');
  }
  /** Closed, the preview discarded (the next open starts on the equipped set), and nothing equipped. */
  function steppedAside(h, from) {
    expect(armoryOpen()).toBe(false);
    closesOnce(h, from, 'contrarian');
    expect(changeArchetype).not.toHaveBeenCalled();
  }
  const reopensOnTheEquippedSet = () => {
    click(btn(COPY.loadout.changeArchetype));
    expect(option(EQUIPPED).getAttribute('aria-selected')).toBe('true');
    expect(propsOf(hero()).archetype).toBe(EQUIPPED);
  };
  /** The phone hub, its agent on a set that is not the ring's first (review AR-3). */
  const renderPhone = () => renderHub({ site: 'mobile', hubWidth: 390, agent: ON_EQUIPPED() });

  for (const name of ['overview', 'research', 'partnership']) {
    it(`switching to the ${name} tab closes it`, async () => {
      await renderPhone();
      const h = hero();
      await openAndPreview();
      const from = h.history.length;
      click(byRole(document, 'tab', COPY.phoneTabs[name])[0]);
      steppedAside(h, from);
      click(byRole(document, 'tab', COPY.phoneTabs.loadout)[0]);
      reopensOnTheEquippedSet();
    });
  }

  it('the Loadout tab itself, where the armory opens, is no switch: it stays open on its preview', async () => {
    await renderPhone();
    await openAndPreview();
    click(byRole(document, 'tab', COPY.phoneTabs.loadout)[0]);
    expect(armoryOpen()).toBe(true);
    expect(propsOf(hero()).archetype).toBe('contrarian');
  });

  for (const [name, opener] of [['the watchlist sheet', () => btn(COPY.loadout.changeWatchlist)], ['the agent record', () => btn(COPY.loadout.recordLabel('Nova'))]]) {
    it(`opening ${name} closes it (the hub's one sheet slot)`, async () => {
      await renderPhone();
      const h = hero();
      await openAndPreview();
      const from = h.history.length;
      click(opener());
      steppedAside(h, from);
      expect(document.querySelector('button[aria-label="Close"]')).not.toBeNull(); // the sheet that took its place
    });
  }

  it('leaving for the Forge closes it before the hub goes', async () => {
    const { hub } = await renderPhone();
    const h = hero();
    await openAndPreview();
    const from = h.history.length;
    const door = [...document.querySelectorAll('button, a, [role="link"]')].find((el) => el.textContent.trim() === COPY.loadout.changeInForge);
    expect(door, 'the Loadout\'s Forge door').toBeTruthy();
    click(door);
    expect(hub().onOpenForge).toHaveBeenCalledTimes(1);
    steppedAside(h, from);
  });

  it('leaving the hub (it unmounts) discards the armory: back on the hub it is closed, the hero bare, nothing equipped', async () => {
    const { m, element } = await renderPhone();
    await openAndPreview();
    m.unmount();
    mounted = mounted.filter((x) => x !== m);
    const back = mount(element());
    mounted.push(back);
    await flush();
    click(byRole(document, 'tab', COPY.phoneTabs.loadout)[0]);
    expect(armoryOpen()).toBe(false);
    expect(propsOf(hero()).archetype).toBeUndefined();
    expect(changeArchetype).not.toHaveBeenCalled();
    reopensOnTheEquippedSet();
  });

  // Founder ruling N4 (Nov 6, 2026): the app menu and "Report a bug" open over the hub without leaving it, so only N2(d)'s
  // triggers close the armory; it stays open, on its preview, under both.
  it('N4: opening the app menu or "Report a bug" leaves it open, on its preview, with nothing equipped', async () => {
    const setSidebarOpen = vi.fn();
    const bugReports = vi.fn();
    window.addEventListener(CLASHBOT_OPEN_EVENT, bugReports);
    try {
      await renderHub({ site: 'mobile', hubWidth: 390, agent: ON_EQUIPPED(), hubExtra: { setSidebarOpen } });
      const h = hero();
      await openAndPreview();
      const from = h.history.length;
      click(btn(COPY.header.menu));
      expect(setSidebarOpen).toHaveBeenCalledWith(true);
      expect(armoryOpen()).toBe(true);
      click(btn(COPY.header.reportBug));
      expect(bugReports).toHaveBeenCalledTimes(1);
      expect(armoryOpen()).toBe(true);
      // the hero still wears the preview: nothing took the armor off, nothing was equipped
      expect(h.history.slice(from).every((p) => p.archetype === 'contrarian')).toBe(true);
      expect(propsOf(hero()).archetype).toBe('contrarian');
      expect(changeArchetype).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener(CLASHBOT_OPEN_EVENT, bugReports);
    }
  });
});

// ── Founder ruling D-A (Nov 6, 2026): a bigger bare Shadow on the phone hub ───────────────────────────────────────────
// With the flag on the phone hero is bare Shadow (N1), drawn bigger than PhoneStage's 200 px box (196 under 375 px):
// Armory.jsx phoneHero, from the hub's measured width. Its name and status stack under it where beside it they would not
// keep their column (every phone width up to about 420 px); the armory still opens to its 152 px centre and closes back.
// jsdom has no layout, so these rows pin the sizes, the layout and the order; the browser harness measures the boxes.
describe('D-A: the phone hub\'s bigger bare hero', () => {
  const stage = () => document.querySelector('[data-hub-stage="phone"]');
  const layoutOf = () => stage().querySelector('[data-hub-hero-layout]')?.getAttribute('data-hub-hero-layout') ?? null;

  it.each([[320, 220], [360, 220], [390, 240]])('at %i px the hero is %i px, and its name and status stack under it', async (width, size) => {
    await renderHub({ site: 'mobile', hubWidth: width });
    expect(propsOf(hero()).size).toBe(size);
    expect(layoutOf()).toBe('stacked');
    const box = stage().querySelector('[data-hub-hero-layout]');
    expect(box.style.flexDirection).toBe('column');
    const heroBox = box.querySelector('[data-hub-agent-form]');
    const words = box.querySelector('[data-hub-hero-text]');
    // the words come after the figure in a column, so under it; they are all there, nothing cut
    expect(heroBox.compareDocumentPosition(words) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(heroBox.contains(words)).toBe(false);
    expect(words.textContent).toContain(COPY.shadow.name);
    expect(words.textContent).toContain(COPY.shadow.role);
    expect(words.querySelector('[role="status"]')).not.toBeNull();
    expect(words.style.width).toBe('100%');
  });

  it('wide enough for their column (430 px), the words go beside the hero, which keeps its size', async () => {
    await renderHub({ site: 'mobile', hubWidth: 430 });
    expect(propsOf(hero()).size).toBe(240);
    expect(layoutOf()).toBe('beside');
    expect(stage().querySelector('[data-hub-hero-text]').style.flex).toMatch(/^1/);
  });

  it('the armory opens from the bigger hero to its 152 px centre and closes back to it, one view throughout (at 320 px too)', async () => {
    for (const [width, size] of [[390, 240], [320, 220]]) {
      await renderHub({ site: 'mobile', hubWidth: width });
      const h = hero();
      expect(propsOf(h).size).toBe(size);
      click(btn(COPY.loadout.changeArchetype));
      expect(propsOf(h).size).toBe(PHONE_ARMORY.centre);
      expect(layoutOf()).toBeNull();
      click(document.querySelector('[data-armory-close]'));
      expect(hero()).toBe(h);
      expect(propsOf(h).size).toBe(size);
      expect(layoutOf()).toBe('stacked');
      for (const m of mounted) m.unmount();
      mounted = [];
      forms.live = new Map();
    }
  });

  it('the control: with the flag off the phone hero is PhoneStage\'s, 196 under 375 px and 200 from it, its words beside it', async () => {
    armory.on = false;
    for (const [width, size] of [[320, 196], [390, 200]]) {
      await renderHub({ site: 'mobile', hubWidth: width });
      expect(propsOf(hero()).size).toBe(size);
      expect(layoutOf()).toBeNull();
      for (const m of mounted) m.unmount();
      mounted = [];
      forms.live = new Map();
    }
  });
});
