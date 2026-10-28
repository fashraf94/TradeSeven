// @vitest-environment jsdom
//
// Command Center hub, slice S5 — the hub with the REAL shipped sheets (AgentRecordSheet,
// ArchetypePicker, EquipSheet), and only the network seams mocked (ruling R-S5-4: "reuse
// every legacy sheet unchanged"; R-S5-6: the stack leaves a usable page).
//
// CommandCenterHub.s5.jsdom.test.jsx replaces the four sheets with stand-ins that unmount
// the instant they close, which is right for what it asks (which sheet opened, with what
// props) and blind to one thing: the real sheets portal into <body> and keep their DOM
// there while they animate out, and a sheet re-opened inside that window RE-USES that node
// (framer-motion's AnimatePresence). Registering the stack over "every child of <body>"
// then marked the very sheet being opened, and the page was left with nothing
// interactive (review E3-1 and E2-1, found independently by two lenses). These rows run
// that sequence on the real components.

import React, { act } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { userState, listWatchlists, equipWatchlist, unequipWatchlist, changeArchetype, flags, slots } = vi.hoisted(() => ({
  userState: { user: { displayName: 'Flash', username: 'flash' } },
  listWatchlists: vi.fn(),
  equipWatchlist: vi.fn(),
  unequipWatchlist: vi.fn(),
  changeArchetype: vi.fn(),
  flags: { current: { concurrencyEnabled: true, hypothesisRecordsOn: true, characterTab: true } },
  slots: { current: [{ id: 'archetype', filled: true }, { id: 'watchlist', filled: true }] },
}));
vi.mock('../../contexts/UserContext', () => ({ useUser: () => userState }));
vi.mock('../../firebase/config', () => ({ db: {}, auth: {} }));
// The S3 merge: App hands the hub no agent; the hub's own owner-tagged read does (hub/useHubReaders.js). Here the
// readers hand the hub the read HUB() names and leave the fixtures' sections as they are. The read rides on the hub
// object under a symbol, so a spread of it keeps it (review MR-7).
const { READ } = vi.hoisted(() => ({ READ: Symbol('agentRead') }));
vi.mock('./hub/useHubReaders', () => ({ default: (hub) => ({ sections: {}, actions: {}, agent: hub?.[READ] ?? null }) }));
vi.mock('../../services/forgeWatchlistService', () => ({ listWatchlists }));
vi.mock('../../services/agentService', () => ({ equipWatchlist, unequipWatchlist, changeArchetype }));
vi.mock('../../hooks/useMasteryProfile', () => ({ default: () => null }));
// Slice S7: a partial mock — the real module's other exports (PHONE_SHADOW, ruling R-S7-6) stay, only hubFlags() is stubbed.
vi.mock('./hub/hubFlags', async (importOriginal) => ({ ...(await importOriginal()), hubFlags: () => flags.current }));
vi.mock('../../utils/equipSlots', () => ({ getEquipSlots: () => slots.current }));
// The S8 fix build (ruling R-S8F-6): the traits sheet opens here too. Its two data hooks stand still on their loading
// state — what these rows read is the sheet's frame, the shared primitive's dialog semantics.
vi.mock('../../hooks/useForge', () => ({ useForge: () => ({ loading: true }) }));
vi.mock('../../hooks/useTraits', () => ({
  BATTLE_LOCK_MSG: 'locked',
  useTraits: () => ({ equippedTraits: [], equipTrait: vi.fn(), unequipTrait: vi.fn(), getGroupSlotUsage: () => ({}), canEquip: () => false, loading: true }),
}));

import CommandCenterHub from './CommandCenterHub';
import { HUB_COPY as COPY } from './hub/hubCopy';
import { HUB_LAYOUT_FIXTURES } from './__fixtures__/hubLayoutFixtures';
import { byRole, click, injectTokens, installFakeLayout, mount, mountFakeBottomNav } from './__fixtures__/hubTestKit';

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
  listWatchlists.mockReset();
  equipWatchlist.mockReset();
  unequipWatchlist.mockReset();
  changeArchetype.mockReset();
  listWatchlists.mockResolvedValue(LISTS());
  equipWatchlist.mockResolvedValue({});
  unequipWatchlist.mockResolvedValue({});
  flags.current = { concurrencyEnabled: true, hypothesisRecordsOn: true, characterTab: true };
  slots.current = [{ id: 'archetype', filled: true }, { id: 'watchlist', filled: true }];
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  for (const m of mounted) m.unmount();
  mounted = [];
  removeNav();
  layout.restore();
  errorSpy.mockRestore();
  vi.useRealTimers();
});

const LISTS = () => [
  { watchlistId: 'wl-1', name: 'Tech Leaders', status: 'committed', tickers: ['NVDA', 'AAPL', 'MSFT'], currentHypothesisVersion: 2 },
  { watchlistId: 'wl-2', name: 'Defensives', status: 'committed', tickers: ['KO', 'PG'] },
];
const AGENT = (over = {}) => ({
  id: 'ag-1', ownerId: 'u-1', name: 'Nova', archetype: 'momentum_chaser', equippedWatchlistId: 'wl-1', equippedWatchlistName: 'Stored Tech', stats: { wins: 7, losses: 3, gamesPlayed: 12 }, ...over,
});
/** App's hub object in the merged shape; `agent` and `agentLoading` become the agent read the hub's readers hand it. */
const HUB = ({ agent = AGENT(), agentLoading = false, activeAgentBattles = [], ...over } = {}) => {
  return {
    activeBattles: activeAgentBattles, setScreen: vi.fn(), onOpenForge: vi.fn(), ...over,
    [READ]: { status: agentLoading ? 'loading' : 'ready', agent, retry: vi.fn() },
  };
};
const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };

async function renderHub({ site = 'desktop', hubWidth = 1280, hub = HUB(), strict = false } = {}) {
  layout.state.hubWidth = hubWidth;
  const hubElement = <CommandCenterHub site={site} hub={hub} sections={HUB_LAYOUT_FIXTURES.returning.sections} />;
  const m = mount(strict ? <React.StrictMode>{hubElement}</React.StrictMode> : hubElement);
  mounted.push(m);
  await flush();
  if (site === 'mobile') click(byRole(document, 'tab', COPY.phoneTabs.loadout)[0]);
  return { m, hub };
}

const btn = (name, scope = document) => byRole(scope, 'button', name)[0] || null;
const isInert = (node) => node.hasAttribute('inert');
const closeButton = () => document.querySelector('button[aria-label="Close"]');
/** Every direct child of <body> that is not the hub's host or the fake BottomNav: the sheets' portals. */
const sheetRoots = (m) => [...document.body.children].filter((node) => node !== m.host && node.tagName !== 'NAV');

const SHEETS = [
  ['archetype', () => btn(COPY.loadout.changeArchetype)],
  ['watchlist', () => btn(COPY.loadout.changeWatchlist)],
  ['record', () => btn(COPY.loadout.recordLabel('Nova'))],
];

describe('the real sheets open, close and give the page back', () => {
  it.each(SHEETS)('%s: opens with the app root inert and the sheet itself live; closing restores the page and focus', async (_name, opener) => {
    const { m } = await renderHub();
    const control = opener();
    control.focus();
    click(control);
    expect(isInert(m.host)).toBe(true);
    const [sheet] = sheetRoots(m);
    expect(sheet).toBeTruthy();
    expect(sheet.closest('[inert]')).toBeNull();
    expect(closeButton().closest('[inert]')).toBeNull();
    control.blur();
    click(closeButton());
    expect(isInert(m.host)).toBe(false);
    expect(document.activeElement).toBe(control);
  }, 30000); // the file's first row pays the cold render of the real sheets: over the 5 s default under load (E5-7)
});

describe('re-opening a sheet inside its own exit animation (review E3-1, E2-1)', () => {
  it.each(SHEETS)('%s, desktop dock: the re-opened sheet is interactive and the page behind it is inert', async (_name, opener) => {
    const { m } = await renderHub();
    const control = opener();
    control.focus();
    click(control);
    control.blur();
    click(closeButton());
    // The keyboard path: the stack put focus back on the opener, and a second Enter fires inside the exit window.
    expect(document.activeElement).toBe(control);
    click(control);
    const roots = sheetRoots(m);
    expect(roots).toHaveLength(1);
    expect(roots[0].closest('[inert]')).toBeNull();
    expect(closeButton().closest('[inert]')).toBeNull();
    expect(isInert(m.host)).toBe(true);
    const live = [...document.querySelectorAll('button, [href], input, select, textarea')].filter((node) => !node.closest('[inert]') && !node.disabled);
    expect(live.length).toBeGreaterThan(0);
    // and it still closes cleanly
    click(closeButton());
    expect(isInert(m.host)).toBe(false);
  });

  it.each(SHEETS.filter(([name]) => name !== 'archetype'))('%s, phone bottom dock: the same', async (_name, opener) => {
    const { m } = await renderHub({ site: 'mobile', hubWidth: 390 });
    const control = opener();
    control.focus();
    click(control);
    control.blur();
    click(closeButton());
    click(control);
    const roots = sheetRoots(m);
    expect(roots).toHaveLength(1);
    expect(closeButton().closest('[inert]')).toBeNull();
    expect(isInert(m.host)).toBe(true);
  });

  it('a different sheet opened inside the first one\'s exit window is live too', async () => {
    const { m } = await renderHub();
    click(btn(COPY.loadout.changeArchetype));
    click(closeButton());
    click(btn(COPY.loadout.changeWatchlist));
    const rows = [...document.body.querySelectorAll('button')].filter((node) => /Defensives|No watchlist/.test(node.textContent));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((node) => !node.closest('[inert]'))).toBe(true);
    expect(isInert(m.host)).toBe(true);
  });

  it('after the exit has finished, a re-open is the ordinary one', async () => {
    const { m } = await renderHub();
    const control = btn(COPY.loadout.changeArchetype);
    click(control);
    click(closeButton());
    await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 900); }); });
    click(control);
    expect(closeButton().closest('[inert]')).toBeNull();
    expect(isInert(m.host)).toBe(true);
  });

  it('open, close, re-open and close again, three times over: nothing is left inert', async () => {
    const { m } = await renderHub();
    const control = btn(COPY.loadout.changeWatchlist);
    for (let i = 0; i < 3; i += 1) {
      click(control);
      expect(isInert(m.host)).toBe(true);
      click(closeButton());
      expect(isInert(m.host)).toBe(false);
    }
    expect([...document.body.children].some((node) => node.hasAttribute('inert'))).toBe(false);
  });
});

describe('the rest of the real flows the stack touches', () => {
  it('the watchlist sheet: pick a list, it is equipped, the sheet closes, focus returns to a CONNECTED opener and the stack is released', async () => {
    const { m } = await renderHub();
    const control = btn(COPY.loadout.changeWatchlist);
    control.focus();
    click(control);
    control.blur();
    expect(isInert(m.host)).toBe(true);
    const row = [...document.body.querySelectorAll('button')].find((node) => /Defensives/.test(node.textContent));
    expect(row).toBeTruthy();
    await act(async () => { click(row); await Promise.resolve(); await Promise.resolve(); });
    await flush();
    expect(equipWatchlist).toHaveBeenCalledWith('ag-1', 'wl-2');
    expect(isInert(m.host)).toBe(false);
    expect(document.activeElement).toBe(btn(COPY.loadout.changeWatchlist));
  });

  it('StrictMode around the hub: a real sheet opens and closes with the stack consistent', async () => {
    const { m } = await renderHub({ strict: true });
    const control = btn(COPY.loadout.changeArchetype);
    control.focus();
    click(control);
    control.blur();
    expect(isInert(m.host)).toBe(true);
    expect(document.querySelector('[data-hub="shell"]').hasAttribute('data-hub-modal-open')).toBe(true);
    click(closeButton());
    expect(isInert(m.host)).toBe(false);
    expect(document.querySelector('[data-hub="shell"]').hasAttribute('data-hub-modal-open')).toBe(false);
    expect(document.activeElement).toBe(control);
  });

  it('the hub unmounting while a sheet is still animating out leaves nothing inert', async () => {
    const { m } = await renderHub();
    click(btn(COPY.loadout.changeArchetype));
    click(closeButton());
    m.unmount();
    mounted = mounted.filter((entry) => entry !== m);
    expect([...document.body.children].some((node) => node.hasAttribute('inert'))).toBe(false);
  });

  it('the console stays quiet through all of it', async () => {
    const { m } = await renderHub();
    click(btn(COPY.loadout.changeWatchlist));
    click(closeButton());
    click(btn(COPY.loadout.changeWatchlist));
    click(closeButton());
    expect(isInert(m.host)).toBe(false);
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

// The S8 review's S8-8 (ruling R-S8F-6; spec §10): every sheet the Loadout opens is a dialog — role, aria-modal and a
// name from its title; focus on Close when it opens; Tab and Shift+Tab stay inside; Escape closes it; focus goes back to
// the control that opened it, ONCE: the hub's overlay stack returns it, and the shared sheet, finding focus already out
// of it, does not do it again. Modelled on the S8 review's real-sheets focus row (its Q6 refuter's, gone with the snapshot).
const TRAITS_SLOTS = () => [{ id: 'archetype', filled: true }, { id: 'watchlist', filled: true }, { id: 'traits', filled: false }];
const DIALOG_SHEETS = [
  ['archetype', () => btn(COPY.loadout.changeArchetype), 'Choose archetype'],
  ['watchlist', () => btn(COPY.loadout.changeWatchlist), COPY.watchlistSheet.title],
  ['record', () => btn(COPY.loadout.recordLabel('Nova')), 'Nova'],
  ['traits', () => btn(COPY.loadout.changeAdjustments), 'Traits'],
];
const TABBABLE = 'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
const liveDialogs = () => [...document.querySelectorAll('[role="dialog"]')].filter((node) => !node.closest('[inert]'));
const key = (target, name, init = {}) => {
  const event = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init });
  act(() => { target.dispatchEvent(event); });
  return event;
};

describe('the real sheets are dialogs (the S8 review S8-8; ruling R-S8F-6)', () => {
  it.each(DIALOG_SHEETS)('%s: role dialog, aria-modal, named by its title; focus on Close; Tab stays inside; Escape closes; focus returns to the opener once', async (_name, opener, title) => {
    slots.current = TRAITS_SLOTS();
    const { m } = await renderHub();
    const control = opener();
    expect(control, 'the sheet\'s opener').toBeTruthy();
    control.focus();
    click(control);
    expect(isInert(m.host)).toBe(true);
    const dialogs = liveDialogs();
    expect(dialogs).toHaveLength(1);
    const [dialog] = dialogs;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.getElementById(dialog.getAttribute('aria-labelledby'))?.textContent).toBe(title);
    expect(document.activeElement).toBe(closeButton());
    expect(dialog.contains(closeButton())).toBe(true);

    const nodes = [...dialog.querySelectorAll(TABBABLE)];
    expect(nodes.length).toBeGreaterThan(0);
    nodes[nodes.length - 1].focus();
    expect(key(document.activeElement, 'Tab').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(nodes[0]);
    expect(key(document.activeElement, 'Tab', { shiftKey: true }).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(nodes[nodes.length - 1]);

    const restores = vi.spyOn(control, 'focus');
    key(document.activeElement, 'Escape');
    expect(isInert(m.host)).toBe(false);
    expect(document.activeElement).toBe(control);
    expect(restores).toHaveBeenCalledTimes(1);
  }, 30000);
});

// The build's own review, lens L1 (L1-1, CONFIRMED by its refuter): picking an archetype swaps the cards for the confirm
// step, so the focused card unmounts and focus falls to <body>, where no key reaches the dialog's own handler. Those keys
// are still the sheet's: Escape closes it, and Tab goes back inside.
describe('review fix L1-1: focus that fell out of an open sheet', () => {
  async function pickACard() {
    const { m } = await renderHub();
    const control = btn(COPY.loadout.changeArchetype);
    control.focus();
    click(control);
    const [dialog] = liveDialogs();
    const card = dialog.querySelector('button[aria-pressed="false"]:not([disabled])');
    expect(card, 'an archetype card to pick').toBeTruthy();
    card.focus();
    click(card);
    expect(document.getElementById(dialog.getAttribute('aria-labelledby'))?.textContent).toMatch(/^Change to /);
    expect(document.activeElement).toBe(document.body);
    return { m, control, dialog };
  }

  it('Escape with focus on <body> still closes the sheet, and focus returns to the opener', async () => {
    const { m, control } = await pickACard();
    key(document.body, 'Escape');
    expect(isInert(m.host)).toBe(false);
    expect(document.activeElement).toBe(control);
  }, 30000);

  it('Tab and Shift+Tab with focus on <body> go back into the sheet, never into the page behind it', async () => {
    const { dialog } = await pickACard();
    expect(key(document.body, 'Tab').defaultPrevented).toBe(true);
    expect(dialog.contains(document.activeElement)).toBe(true);
    document.activeElement.blur();
    expect(document.activeElement).toBe(document.body);
    expect(key(document.body, 'Tab', { shiftKey: true }).defaultPrevented).toBe(true);
    expect(dialog.contains(document.activeElement)).toBe(true);
  }, 30000);

  it('a key on <body> while no sheet is open is not a sheet\'s', async () => {
    const { m } = await renderHub();
    const event = key(document.body, 'Tab');
    expect(event.defaultPrevented).toBe(false);
    expect(isInert(m.host)).toBe(false);
  });
});
