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
//   - the phone: the armory opens in the hero's box, the hero itself shrinks and wears the preview, a cancel takes the
//     preview off at once (never a second suit-up), an equip keeps the new set on the hero until the read catches up;
//   - the listbox's roles and keys, Escape, and focus.

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
  forms: { next: 0, live: new Map(), mounts: 0, unmounts: 0 },
}));
vi.mock('../../config/agentFormFlags', async (importOriginal) => ({ ...(await importOriginal()), get AGENT_FORM_ARMORY_ENABLED() { return armory.on; } }));
vi.mock('framer-motion', async (importOriginal) => ({ ...(await importOriginal()), useReducedMotion: () => motion.reduced }));
vi.mock('../AgentForm/AgentForm', () => ({
  default: class AgentFormProbe extends Component {
    constructor(props) { super(props); this.id = ++forms.next; this.history = []; }
    componentDidMount() { forms.live.set(this.id, this); forms.mounts += 1; this.props.onStatus?.('live'); }
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
import { ARMORY_SETS, PHONE_ARMORY } from './Armory';
import { SET_ALONE, UNLIT } from '../AgentForm/agentFormSpec';
import { armoryLines } from './hub/archetypeLines';

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
  forms.next = 0; forms.live = new Map(); forms.mounts = 0; forms.unmounts = 0;
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
const HUB = (agent = AGENT()) => ({ activeBattles: [], setScreen: vi.fn(), onOpenForge: vi.fn(), [READ]: { status: 'ready', agent, retry: vi.fn() } });
const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };

async function renderHub({ site = 'desktop', hubWidth = 1280, agent = AGENT() } = {}) {
  layout.state.hubWidth = hubWidth;
  const element = (a) => <CommandCenterHub site={site} hub={HUB(a)} sections={HUB_LAYOUT_FIXTURES.returning.sections} />;
  const m = mount(element(agent));
  mounted.push(m);
  await flush();
  if (site === 'mobile') click(byRole(document, 'tab', COPY.phoneTabs.loadout)[0]);
  return { m, reread: async (next) => { m.rerender(element(next)); await flush(); } };
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
    await renderHub();
    click(btn(COPY.loadout.changeArchetype));
    expect(sets()).toHaveLength(6);
    for (const codeId of ARMORY_SETS) {
      const p = propsOf(setOf(codeId));
      expect(p.coreStage).toBe(SET_ALONE);
      expect(p.allegiance).toBe(codeId === 'momentum_chaser' ? 'player' : UNLIT);
      expect(p.label).toBeNull();
      expect(p.rate).toBe('still');
      expect(p.equipOnChange).toBeUndefined();
    }
    expect(option('momentum_chaser').hasAttribute('data-armory-equipped')).toBe(true);
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
    await renderHub();
    click(btn(COPY.loadout.changeArchetype));
    const c = centre();
    expect(propsOf(c).archetype).toBe('momentum_chaser');
    expect(propsOf(c).equipOnChange).toBe(true);
    expect(propsOf(c).size).toBe(300);
    expect(statusLine().textContent).toBe(ARMORY_COPY.equipped);
    expect(equipButton().disabled).toBe(true);
    click(option('contrarian'));
    expect(centre()).toBe(c); // the same view: a change it plays, never a remount
    expect(propsOf(c).archetype).toBe('contrarian');
    expect(option('contrarian').getAttribute('aria-selected')).toBe('true');
    expect(statusLine().textContent).toBe(ARMORY_COPY.previewingOver(nameOf('momentum_chaser')));
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

  it('a battle lock (409 battle_active) shows the hub\'s "Locked in battle" line, and the armory stays open', async () => {
    changeArchetype.mockRejectedValueOnce(Object.assign(new Error('Cannot change archetype while the agent has an active battle.'), { status: 409, code: 'battle_active' }));
    await renderHub();
    click(btn(COPY.loadout.changeArchetype));
    click(option('analyst'));
    await equipAndSettle();
    expect(dialog()).not.toBeNull();
    expect(document.querySelector('[data-armory-error]').textContent).toBe(COPY.loadout.nextDeployLocked);
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

  it('after an equip it suits up through its own change path: the read\'s new archetype, played', async () => {
    const { reread } = await renderHub();
    const h = hero();
    click(btn(COPY.loadout.changeArchetype));
    click(option('contrarian'));
    await equipAndSettle();
    await reread(AGENT({ archetype: 'contrarian' }));
    expect(hero()).toBe(h);
    expect(propsOf(h).archetype).toBe('contrarian');
    expect(propsOf(h).equipOnChange).toBe(true);
    expect(propsOf(h).paused).toBe(false);
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
    expect(propsOf(h).size).toBe(200);
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

  it('a tap previews the set on the hero itself, played; a cancel takes it off at once, never a second suit-up, and remounts nothing', async () => {
    const { reread } = await renderHub({ site: 'mobile', hubWidth: 390 });
    const h = hero();
    click(btn(COPY.loadout.changeArchetype));
    click(option('contrarian'));
    expect(propsOf(h).archetype).toBe('contrarian');
    expect(propsOf(h).equipOnChange).toBe(true);
    click(document.querySelector('[data-armory-close]'));
    expect(hero()).toBe(h);
    expect(forms.unmounts).toBe(6); // the six sets went; the hero stayed
    expect(propsOf(h).archetype).toBe('momentum_chaser');
    expect(propsOf(h).equipOnChange).toBe(false);
    expect(propsOf(h).size).toBe(200);
    // a later real change of the read is a suit-up again
    await reread(AGENT({ archetype: 'guardian' }));
    expect(propsOf(h).archetype).toBe('guardian');
    expect(propsOf(h).equipOnChange).toBe(true);
  });

  it('an equip keeps the new set on the hero while the read still has the old one, so it never steps back and suits up twice', async () => {
    const { reread } = await renderHub({ site: 'mobile', hubWidth: 390 });
    const h = hero();
    click(btn(COPY.loadout.changeArchetype));
    click(option('analyst'));
    const before = h.history.filter((p) => p.archetype === 'momentum_chaser').length;
    await equipAndSettle();
    expect(changeArchetype).toHaveBeenCalledWith('ag-1', 'analyst');
    expect(document.querySelector('[data-hub-stage="phone"]').getAttribute('data-hub-armory')).toBeNull();
    expect(propsOf(h).archetype).toBe('analyst');
    await reread(AGENT({ archetype: 'analyst' }));
    expect(propsOf(h).archetype).toBe('analyst');
    // not once back on the old set since the preview
    expect(h.history.filter((p) => p.archetype === 'momentum_chaser').length).toBe(before);
    expect(hero()).toBe(h);
  });

  it('a battle lock shows the hub\'s lock line in the stage, and the armory stays open', async () => {
    changeArchetype.mockRejectedValueOnce(Object.assign(new Error('x'), { status: 409, code: 'battle_active' }));
    await renderHub({ site: 'mobile', hubWidth: 390 });
    click(btn(COPY.loadout.changeArchetype));
    click(option('degen'));
    await equipAndSettle();
    const stage = document.querySelector('[data-hub-stage="phone"]');
    expect(stage.getAttribute('data-hub-armory')).toBe('open');
    expect(stage.querySelector('[data-armory-error]').textContent).toBe(COPY.loadout.nextDeployLocked);
  });

  it('opening focuses the equipped set; Escape closes, and focus goes back to Change archetype', async () => {
    await renderHub({ site: 'mobile', hubWidth: 390 });
    const opener = btn(COPY.loadout.changeArchetype);
    opener.focus();
    click(opener);
    expect(document.activeElement).toBe(option('momentum_chaser'));
    press(document.activeElement, 'ArrowDown');
    expect(document.activeElement).toBe(option('contrarian'));
    press(document.activeElement, 'Escape');
    expect(document.querySelector('[data-hub-stage="phone"]').getAttribute('data-hub-armory')).toBeNull();
    expect(document.activeElement).toBe(btn(COPY.loadout.changeArchetype));
  });

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
