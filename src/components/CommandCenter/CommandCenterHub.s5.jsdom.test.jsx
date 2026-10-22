// @vitest-environment jsdom
//
// Command Center hub, slice S5 — the owner's Loadout and the retained entry
// points, through the hub root with the `hub` prop App hands it (rulings
// R-S5-1 … R-S5-4, R-S5-6, R-S5-7, R-S5-9).
//
// The four shipped sheets are replaced by recording stand-ins
// (__fixtures__/legacySheetStubs.jsx): they are reused unchanged and keep their
// own suites; these rows need to see WHICH sheet opened and WHAT the hub handed
// it. The lists service, the equip writes and the flags are the seams.

import React, { act } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { userState, listWatchlists, equipWatchlist, unequipWatchlist, flags, slots } = vi.hoisted(() => ({
  userState: { user: { displayName: 'Flash', username: 'flash' } },
  listWatchlists: vi.fn(),
  equipWatchlist: vi.fn(),
  unequipWatchlist: vi.fn(),
  flags: { current: { concurrencyEnabled: true, hypothesisRecordsOn: true, characterTab: true } },
  slots: { current: [{ id: 'archetype', filled: true }, { id: 'watchlist', filled: true }] },
}));
vi.mock('../../contexts/UserContext', () => ({ useUser: () => userState }));
vi.mock('../../firebase/config', () => ({ db: {}, auth: {} }));
vi.mock('../../services/forgeWatchlistService', () => ({ listWatchlists }));
vi.mock('../../services/agentService', () => ({ equipWatchlist, unequipWatchlist }));
vi.mock('../../hooks/useMasteryProfile', () => ({ default: () => null }));
vi.mock('./hub/hubFlags', () => ({ hubFlags: () => flags.current }));
vi.mock('../../utils/equipSlots', () => ({ getEquipSlots: () => slots.current }));
vi.mock('../Dashboard/AgentRecordSheet', async () => ({ default: (await import('./__fixtures__/legacySheetStubs')).AgentRecordSheetStub }));
vi.mock('../Dashboard/ArchetypePicker', async () => ({ default: (await import('./__fixtures__/legacySheetStubs')).ArchetypePickerStub }));
vi.mock('../Dashboard/EquipSheet', async () => ({ default: (await import('./__fixtures__/legacySheetStubs')).EquipSheetStub }));
vi.mock('../Dashboard/TraitsSheet', async () => ({ default: (await import('./__fixtures__/legacySheetStubs')).TraitsSheetStub }));

import CommandCenterHub from './CommandCenterHub';
import { CLASHBOT_OPEN_EVENT } from '../ClashBot/ClashBotWidget';
import { readToken } from '../../theme/cssTokens';
import { HUB_COPY as COPY } from './hub/hubCopy';
import { LOADOUT_SYMBOL_LIMIT } from './hub/hubModel';
import { HUB_LAYOUT_FIXTURES } from './__fixtures__/hubLayoutFixtures';
import { resetSeen, seen } from './__fixtures__/legacySheetStubs';
import { byRole, byText, click, injectTokens, installFakeLayout, mount, mountFakeBottomNav } from './__fixtures__/hubTestKit';

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
  listWatchlists.mockResolvedValue(LISTS());
  equipWatchlist.mockResolvedValue({});
  unequipWatchlist.mockResolvedValue({});
  flags.current = { concurrencyEnabled: true, hypothesisRecordsOn: true, characterTab: true };
  slots.current = [{ id: 'archetype', filled: true }, { id: 'watchlist', filled: true }];
  resetSeen();
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
  { watchlistId: 'wl-2', name: 'Defensives', status: 'committed', tickers: [{ symbol: 'KO' }, { ticker: 'PG' }] },
  { watchlistId: 'wl-3', name: 'Draft Thing', status: 'draft', tickers: ['ZZZ'] },
];
const AGENT = (over = {}) => ({
  id: 'ag-1', ownerId: 'u-1', name: 'Nova', archetype: 'momentum_chaser',
  equippedWatchlistId: 'wl-1', equippedWatchlistName: 'Stored Tech', stats: { wins: 7, losses: 3, gamesPlayed: 12 }, ...over,
});
const HUB = (over = {}) => ({
  agent: AGENT(), agentLoading: false, activeAgentBattles: [], setScreen: vi.fn(), onOpenForge: vi.fn(), ...over,
});

const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };

async function renderHub({ site = 'desktop', hubWidth = 1280, hub = HUB(), sections = HUB_LAYOUT_FIXTURES.returning.sections } = {}) {
  layout.state.hubWidth = hubWidth;
  const m = mount(<CommandCenterHub site={site} hub={hub} sections={sections} />);
  mounted.push(m);
  await flush();
  if (site === 'mobile') {
    const tab = byRole(document, 'tab', COPY.phoneTabs.loadout)[0];
    click(tab);
  }
  return { m, hub };
}

const panel = () => document.querySelector('[data-hub-panel="loadout"]');
const card = (kind) => panel().querySelector(`[data-hub-card="${kind}"]`);
const btn = (name, scope = document) => byRole(scope, 'button', name)[0] || null;
// The identity button is named for the agent it opens (its aria-label), not by its visible words.
const recordButton = () => btn(COPY.loadout.recordLabel('Nova'));
const hubRoot = () => document.querySelector('[data-hub="shell"]');
const rowIds = () => [...document.querySelectorAll('[data-stub="equip"] [data-row]')].map((n) => n.getAttribute('data-row'));

describe('the Loadout states (ruling R-S5-1)', () => {
  it('loading: the agent has not resolved — the frame\'s loading line, every picker disabled, no identity row', async () => {
    await renderHub({ hub: HUB({ agent: null, agentLoading: true }) });
    expect(panel().getAttribute('data-hub-status-of')).toBe('loading');
    expect(byText(panel(), COPY.loadout.loading)).not.toBeNull();
    expect(btn(COPY.loadout.changeArchetype).disabled).toBe(true);
    expect(btn(COPY.loadout.changeWatchlist).disabled).toBe(true);
    expect(panel().querySelector('[data-hub-loadout-identity]')).toBeNull();
    expect(listWatchlists).not.toHaveBeenCalled();
  });

  it('no agent: "Create your agent first", no cards, nothing to open, and no lists read', async () => {
    await renderHub({ hub: HUB({ agent: null, agentLoading: false }) });
    expect(panel().getAttribute('data-hub-status-of')).toBe('none');
    expect(byText(panel(), COPY.loadout.noAgent)).not.toBeNull();
    expect(panel().querySelector('[data-hub-card]')).toBeNull();
    expect(panel().querySelector('button')).toBeNull();
    expect(listWatchlists).not.toHaveBeenCalled();
  });

  it('ready: the archetype\'s name and approach, the list\'s name and names, the stored agent name', async () => {
    await renderHub();
    expect(panel().getAttribute('data-hub-status-of')).toBe('ready');
    expect(card('archetype').textContent).toContain('Trend Follower');
    expect(card('archetype').textContent).toContain('Goes where the momentum is');
    expect(card('watchlist').textContent).toContain('Tech Leaders');
    for (const symbol of ['NVDA', 'AAPL', 'MSFT']) expect(byText(card('watchlist'), symbol)).not.toBeNull();
    expect(panel().querySelector('[data-hub-loadout-identity]').textContent).toContain('Nova');
  });

  it('a nameless agent is "Your agent"', async () => {
    await renderHub({ hub: HUB({ agent: AGENT({ name: '' }) }) });
    expect(panel().querySelector('[data-hub-loadout-identity]').textContent).toContain(COPY.loadout.agentFallback);
  });

  it('reads the lists once at mount, and the card shows the stored name until they arrive', async () => {
    let release;
    listWatchlists.mockReturnValueOnce(new Promise((resolve) => { release = resolve; }));
    await renderHub();
    expect(listWatchlists).toHaveBeenCalledTimes(1);
    expect(card('watchlist').textContent).toContain('Stored Tech');
    expect(byText(card('watchlist'), COPY.loadout.loading)).not.toBeNull();
    await act(async () => { release(LISTS()); await Promise.resolve(); });
    expect(card('watchlist').textContent).toContain('Tech Leaders');
    expect(card('watchlist').textContent).not.toContain('Stored Tech');
  });

  it('no list equipped: the plain "No watchlist equipped" card, no names, no label', async () => {
    await renderHub({ hub: HUB({ agent: AGENT({ equippedWatchlistId: null, equippedWatchlistName: null }) }) });
    expect(byText(card('watchlist'), COPY.loadout.noWatchlist)).not.toBeNull();
    expect(card('watchlist').textContent).not.toContain('NVDA');
    expect(card('watchlist').textContent).not.toContain(COPY.loadout.plainList);
  });

  it('a list that cannot be resolved: its stored name, marked unavailable, with the reason', async () => {
    listWatchlists.mockResolvedValue([LISTS()[1]]);
    await renderHub();
    expect(card('watchlist').textContent).toContain(COPY.loadout.unavailable('Stored Tech'));
    expect(byText(card('watchlist'), COPY.loadout.unavailableNote)).not.toBeNull();
  });

  it('a failed lists read is its own state with a Retry — and Retry reads again', async () => {
    listWatchlists.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(LISTS());
    await renderHub();
    expect(byText(card('watchlist'), COPY.loadout.listsError)).not.toBeNull();
    expect(card('watchlist').textContent).not.toContain(COPY.loadout.unavailable('Stored Tech'));
    click(btn(COPY.loadout.retry, card('watchlist')));
    await flush();
    expect(listWatchlists).toHaveBeenCalledTimes(2);
    expect(card('watchlist').textContent).toContain('Tech Leaders');
  });

  it('a long list shows its first names and "+N more"', async () => {
    const many = Array.from({ length: LOADOUT_SYMBOL_LIMIT + 6 }, (_, i) => `S${i}`);
    listWatchlists.mockResolvedValue([{ ...LISTS()[0], tickers: many }]);
    await renderHub();
    expect(byText(card('watchlist'), 'S0')).not.toBeNull();
    expect(byText(card('watchlist'), `S${LOADOUT_SYMBOL_LIMIT - 1}`)).not.toBeNull();
    expect(byText(card('watchlist'), `S${LOADOUT_SYMBOL_LIMIT}`)).toBeNull();
    expect(byText(card('watchlist'), COPY.loadout.more(6))).not.toBeNull();
  });

  it('the strip-and-card loadout line: archetype and list; no list; an unavailable one', async () => {
    const lineOf = async (hub, lists) => {
      if (lists) listWatchlists.mockResolvedValue(lists);
      const { m } = await renderHub({ hub, site: 'mobile' });
      const line = document.querySelector('[data-hub-strip]')?.textContent || '';
      m.unmount();
      mounted = mounted.filter((x) => x !== m);
      return line;
    };
    expect(await lineOf(HUB())).toContain('Trend Follower · Tech Leaders');
    expect(await lineOf(HUB({ agent: AGENT({ equippedWatchlistId: null }) }))).toContain(COPY.loadout.lineNoWatchlist('Trend Follower'));
    expect(await lineOf(HUB(), [LISTS()[1]])).toContain(`Trend Follower · ${COPY.loadout.unavailable('Stored Tech')}`);
  });
});

describe('the idea-first labels on the watchlist card (ruling R-S5-2; the design note)', () => {
  const labelOf = async (doc, on) => {
    flags.current = { ...flags.current, hypothesisRecordsOn: on };
    listWatchlists.mockResolvedValue([{ watchlistId: 'wl-1', name: 'Tech Leaders', status: 'committed', tickers: ['A', 'B', 'C'], ...doc }]);
    const { m } = await renderHub();
    const text = card('watchlist').textContent;
    m.unmount();
    mounted = mounted.filter((x) => x !== m);
    return text;
  };

  it('a positive pointer: "Universe · N names"', async () => {
    expect(await labelOf({ currentHypothesisVersion: 4 }, true)).toContain('Universe · 3 names');
  });

  it('an absent or null pointer with the records on: "Plain watchlist · no idea yet"', async () => {
    expect(await labelOf({}, true)).toContain('Plain watchlist · no idea yet');
    expect(await labelOf({ currentHypothesisVersion: null }, true)).toContain('Plain watchlist · no idea yet');
  });

  it('the records off, or a malformed pointer: the neutral "N names", claiming nothing about ideas', async () => {
    for (const [doc, on] of [[{}, false], [{ currentHypothesisVersion: 4 }, false], [{ currentHypothesisVersion: 0 }, true], [{ currentHypothesisVersion: '2' }, true]]) {
      const text = await labelOf(doc, on);
      expect(text, JSON.stringify([doc, on])).toContain('3 names');
      expect(text).not.toContain('Universe');
      expect(text).not.toContain('idea');
    }
  });

  it('it never shows an idea\'s statement or status — the card has no such text and the hub reads no idea record', async () => {
    const text = await labelOf({ currentHypothesisVersion: 4, statement: 'Rates fall', status: 'ready' }, true);
    expect(text).not.toContain('Rates fall');
    expect(text).not.toMatch(/\bReady\b|\bActivated\b|\bReview due\b|\bDraft\b/);
  });
});

describe('the equip lock (ruling R-S5-1): one predicate for the line and every picker', () => {
  it('locked in a live game: "Locked in battle · …", the pickers disabled; the record and the Forge doors still open', async () => {
    slots.current = [{ id: 'archetype', filled: true }, { id: 'watchlist', filled: true }, { id: 'traits', filled: true }];
    await renderHub({ hub: HUB({ agent: AGENT({ activeBattleId: 'b-1' }) }) });
    expect(panel().hasAttribute('data-hub-locked')).toBe(true);
    expect(byText(panel(), COPY.loadout.nextDeployLocked)).not.toBeNull();
    expect(btn(COPY.loadout.changeArchetype).disabled).toBe(true);
    expect(btn(COPY.loadout.changeWatchlist).disabled).toBe(true);
    expect(btn(COPY.loadout.changeAdjustments).disabled).toBe(true);
    expect(recordButton().disabled).toBe(false);
    expect(btn(COPY.loadout.forgeLists).disabled).toBe(false);
    expect(btn(COPY.loadout.changeInForge).disabled).toBe(false);
  });

  it('not locked: the line says so, and the pickers are enabled', async () => {
    await renderHub();
    expect(panel().hasAttribute('data-hub-locked')).toBe(false);
    expect(byText(panel(), COPY.loadout.nextDeploy)).not.toBeNull();
    expect(btn(COPY.loadout.changeArchetype).disabled).toBe(false);
    expect(btn(COPY.loadout.changeWatchlist).disabled).toBe(false);
  });

  it('concurrency on: a live casual battle (on its clone) does NOT lock the real loadout', async () => {
    await renderHub({ hub: HUB({ activeAgentBattles: [{ id: 'b-9', status: 'active', agentId: 'casual-agent-u-1' }] }) });
    expect(panel().hasAttribute('data-hub-locked')).toBe(false);
  });

  it('concurrency off: any live battle locks, as the shells\' label does', async () => {
    flags.current = { ...flags.current, concurrencyEnabled: false };
    await renderHub({ hub: HUB({ activeAgentBattles: [{ id: 'b-9', status: 'active' }] }) });
    expect(panel().hasAttribute('data-hub-locked')).toBe(true);
    expect(btn(COPY.loadout.changeArchetype).disabled).toBe(true);
  });

  it('a completed battle in the poll does not lock', async () => {
    flags.current = { ...flags.current, concurrencyEnabled: false };
    await renderHub({ hub: HUB({ activeAgentBattles: [{ id: 'b-9', status: 'completed' }] }) });
    expect(panel().hasAttribute('data-hub-locked')).toBe(false);
  });
});

describe('the adjustments card follows the shells\' traits slot', () => {
  it('absent without a traits slot (as shipped); no Forge Character door either', async () => {
    await renderHub();
    expect(card('adjustments')).toBeNull();
    expect(btn(COPY.loadout.forgeCharacter)).toBeNull();
    expect(btn(COPY.loadout.forgeTraits)).toBeNull();
  });

  it('present with the slot: the shared summary, its sheet, and a Forge door named after the tab', async () => {
    slots.current = [{ id: 'archetype', filled: true }, { id: 'watchlist', filled: true }, { id: 'traits', filled: false }];
    await renderHub();
    expect(card('adjustments').textContent).toContain('Add traits');
    expect(btn(COPY.loadout.forgeCharacter, card('adjustments'))).not.toBeNull();
    expect(btn(COPY.loadout.forgeTraits)).toBeNull();
  });

  it('the Forge door says "Traits" while the Character tab is off', async () => {
    flags.current = { ...flags.current, characterTab: false };
    slots.current = [{ id: 'archetype', filled: true }, { id: 'watchlist', filled: true }, { id: 'traits', filled: false }];
    await renderHub();
    expect(btn(COPY.loadout.forgeTraits, card('adjustments'))).not.toBeNull();
    expect(btn(COPY.loadout.forgeCharacter)).toBeNull();
  });

  it('shows the traits summary from the agent document', async () => {
    slots.current = [{ id: 'archetype', filled: true }, { id: 'watchlist', filled: true }, { id: 'traits', filled: true }];
    await renderHub({ hub: HUB({ agent: AGENT({ equippedTraits: [{ traitId: 'x-unknown-1' }, { traitId: 'x-unknown-2' }] }) }) });
    expect(card('adjustments').textContent).toContain('2 traits');
  });
});

describe('the entry points — each opens its real destination (ruling R-S5-4; spec §2)', () => {
  it('the phone header\'s account button opens the profile', async () => {
    const { hub } = await renderHub({ site: 'mobile' });
    const profile = document.querySelector('[data-hub-profile]');
    expect(profile.disabled).toBe(false);
    click(profile);
    expect(hub.setScreen).toHaveBeenCalledTimes(1);
    expect(hub.setScreen).toHaveBeenCalledWith('profile');
  });

  it('without a hub prop the account button stays disabled and no bug control is drawn (the S1 frame)', () => {
    layout.state.hubWidth = 390;
    const m = mount(<CommandCenterHub site="mobile" sections={HUB_LAYOUT_FIXTURES.returning.sections} />);
    mounted.push(m);
    expect(document.querySelector('[data-hub-profile]').disabled).toBe(true);
    expect(document.querySelector('[data-hub-report-bug]')).toBeNull();
  });

  it('the identity opens the agent record, handed the agent, the loading flag, the accent, the level inputs and the dock', async () => {
    await renderHub({ hub: HUB({ agentLoading: false }) });
    expect(document.querySelector('[data-stub="record"]')).toBeNull();
    click(recordButton());
    expect(document.querySelector('[data-stub="record"]')).not.toBeNull();
    expect(seen.record).toMatchObject({ open: true, loading: false, dock: 'center' });
    expect(seen.record.agent.id).toBe('ag-1');
    expect(seen.record.accent).toBe(readToken('teal'));
    expect(seen.record.levelConfig).toBeTruthy();
    expect(seen.record.nextLevelInfo).toBeTruthy();
  });

  it('the accent is the player\'s own colour when the agent has one, then the first avatar colour', async () => {
    await renderHub({ hub: HUB({ agent: AGENT({ primaryColor: 'player-colour', avatarColors: ['first-avatar'] }) }) });
    click(recordButton());
    expect(seen.record.accent).toBe('player-colour');
  });

  it('the archetype opens the existing picker, handed the agent and the dock (bottom on the phone)', async () => {
    await renderHub({ site: 'mobile', hubWidth: 390 });
    click(btn(COPY.loadout.changeArchetype));
    expect(document.querySelector('[data-stub="archetype"]')).not.toBeNull();
    expect(seen.archetype).toMatchObject({ open: true, dock: 'bottom' });
    expect(seen.archetype.agent.id).toBe('ag-1');
  });

  it('the watchlist opens its quick sheet with the shells\' rows: "No watchlist" and the committed lists, the equipped one selected', async () => {
    await renderHub();
    click(btn(COPY.loadout.changeWatchlist));
    expect(seen.equip).toMatchObject({ open: true, dock: 'center', title: COPY.watchlistSheet.title, subtitle: COPY.watchlistSheet.subtitle });
    expect(rowIds()).toEqual(['__none__', 'wl-1', 'wl-2']);
    expect(document.querySelector('[data-row="wl-1"]').hasAttribute('data-selected')).toBe(true);
    expect(document.querySelector('[data-row="__none__"]').hasAttribute('data-selected')).toBe(false);
    expect(document.querySelector('[data-row-sub="wl-2"]').textContent).toBe(COPY.watchlistSheet.tickers(2));
    expect(document.querySelector('[data-row="__none__"]').textContent).toBe(COPY.watchlistSheet.none);
  });

  it('choosing a list equips it through agentService, closes the sheet and reads the lists again', async () => {
    await renderHub();
    click(btn(COPY.loadout.changeWatchlist));
    expect(listWatchlists).toHaveBeenCalledTimes(1);
    await act(async () => { click(document.querySelector('[data-row="wl-2"]')); await Promise.resolve(); await Promise.resolve(); });
    await flush();
    expect(equipWatchlist).toHaveBeenCalledWith('ag-1', 'wl-2');
    expect(unequipWatchlist).not.toHaveBeenCalled();
    expect(document.querySelector('[data-stub="equip"]')).toBeNull();
    expect(listWatchlists).toHaveBeenCalledTimes(2);
  });

  it('"No watchlist" unequips', async () => {
    await renderHub();
    click(btn(COPY.loadout.changeWatchlist));
    await act(async () => { click(document.querySelector('[data-row="__none__"]')); await Promise.resolve(); await Promise.resolve(); });
    await flush();
    expect(unequipWatchlist).toHaveBeenCalledWith('ag-1');
    expect(equipWatchlist).not.toHaveBeenCalled();
  });

  it('a failed equip is logged and the sheet closes either way — the shells\' own write path', async () => {
    equipWatchlist.mockRejectedValueOnce(new Error('409'));
    await renderHub();
    click(btn(COPY.loadout.changeWatchlist));
    await act(async () => { click(document.querySelector('[data-row="wl-2"]')); await Promise.resolve(); await Promise.resolve(); });
    await flush();
    expect(errorSpy).toHaveBeenCalled();
    expect(document.querySelector('[data-stub="equip"]')).toBeNull();
  });

  it('closing the watchlist sheet without a choice also reads the lists again; closing the record or the picker does not', async () => {
    await renderHub();
    click(recordButton());
    act(() => { seen.record.onClose(); });
    click(btn(COPY.loadout.changeArchetype));
    act(() => { seen.archetype.onClose(); });
    await flush();
    expect(listWatchlists).toHaveBeenCalledTimes(1);
    click(btn(COPY.loadout.changeWatchlist));
    act(() => { seen.equip.onClose(); });
    await flush();
    expect(listWatchlists).toHaveBeenCalledTimes(2);
  });

  it('a failed lists read puts a Retry in the sheet instead of a lone "No watchlist" row', async () => {
    listWatchlists.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(LISTS());
    await renderHub();
    click(btn(COPY.loadout.changeWatchlist));
    expect(rowIds()).toEqual([]);
    expect(document.querySelector('[data-stub="equip"]').textContent).toContain(COPY.loadout.listsError);
    click(btn(COPY.loadout.retry, document.querySelector('[data-stub="equip"]')));
    await flush();
    expect(rowIds()).toEqual(['__none__', 'wl-1', 'wl-2']);
  });

  it('the adjustments open the traits sheet, which REMOUNTS on every open (its orphan-cleanup invariant)', async () => {
    slots.current = [{ id: 'archetype', filled: true }, { id: 'watchlist', filled: true }, { id: 'traits', filled: false }];
    await renderHub();
    expect(seen.traitsMounts).toBe(0);
    click(btn(COPY.loadout.changeAdjustments));
    expect(seen.traits).toMatchObject({ open: true, dock: 'center' });
    expect(seen.traitsMounts).toBe(1);
    act(() => { seen.traits.onClose(); });
    click(btn(COPY.loadout.changeAdjustments));
    expect(seen.traitsMounts).toBe(2);
  });
});

describe('the Forge doors (ruling R-S5-5) — each names the area it opens', () => {
  it('"Forge Lists" opens the Lists area, returning to the dashboard', async () => {
    const { hub } = await renderHub();
    click(btn(COPY.loadout.forgeLists));
    expect(hub.onOpenForge).toHaveBeenCalledTimes(1);
    expect(hub.onOpenForge).toHaveBeenCalledWith({ area: 'watchlists', returnTo: 'dashboard' });
  });

  it('"Forge Character" opens the traits area (the Character tab) — the label follows the tab', async () => {
    slots.current = [{ id: 'archetype', filled: true }, { id: 'watchlist', filled: true }, { id: 'traits', filled: false }];
    const { hub } = await renderHub();
    click(btn(COPY.loadout.forgeCharacter));
    expect(hub.onOpenForge).toHaveBeenCalledWith({ area: 'traits', returnTo: 'dashboard' });
  });

  it('"Change in the Forge" names no area: the Forge as it opens today', async () => {
    const { hub } = await renderHub();
    click(btn(COPY.loadout.changeInForge));
    expect(hub.onOpenForge).toHaveBeenCalledTimes(1);
    const [request] = hub.onOpenForge.mock.calls[0];
    expect(request).toEqual({ returnTo: 'dashboard' });
    expect(request.area).toBeUndefined();
    expect(request.watchlistId).toBeUndefined();
  });

  it('the watchlist sheet\'s footer opens the Lists area and closes the sheet', async () => {
    const { hub } = await renderHub();
    click(btn(COPY.loadout.changeWatchlist));
    click(btn(COPY.watchlistSheet.createInForge, document.querySelector('[data-stub="equip"]')));
    expect(hub.onOpenForge).toHaveBeenCalledWith({ area: 'watchlists', returnTo: 'dashboard' });
    expect(document.querySelector('[data-stub="equip"]')).toBeNull();
  });

  it('no onOpenForge handed in: no Forge door is drawn', async () => {
    await renderHub({ hub: HUB({ onOpenForge: undefined }) });
    expect(btn(COPY.loadout.forgeLists)).toBeNull();
    expect(btn(COPY.loadout.changeInForge).disabled).toBe(true);
  });
});

describe('"Report a bug" (ruling R-S5-7)', () => {
  it('the wide header dispatches the ClashBot widget\'s own open event, once', async () => {
    const heard = vi.fn();
    window.addEventListener(CLASHBOT_OPEN_EVENT, heard);
    await renderHub();
    click(btn(COPY.header.reportBug));
    window.removeEventListener(CLASHBOT_OPEN_EVENT, heard);
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it('the phone header carries it as a labelled 44 px icon button beside the account button', async () => {
    const heard = vi.fn();
    window.addEventListener(CLASHBOT_OPEN_EVENT, heard);
    await renderHub({ site: 'mobile', hubWidth: 390 });
    const bug = document.querySelector('[data-hub-report-bug]');
    expect(bug.getAttribute('aria-label')).toBe(COPY.header.reportBug);
    expect(bug.style.width).toBe('44px');
    expect(bug.style.height).toBe('44px');
    expect(bug.parentElement).toBe(document.querySelector('[data-hub-profile]').parentElement);
    click(bug);
    window.removeEventListener(CLASHBOT_OPEN_EVENT, heard);
    expect(heard).toHaveBeenCalledTimes(1);
  });
});

describe('every overlay the hub opens registers with one stack (ruling R-S5-6)', () => {
  const isInert = (node) => node.hasAttribute('inert');

  it('a legacy sheet makes the app root inert and modalOpen true; closing restores both and returns focus to the opener', async () => {
    const { m } = await renderHub();
    const opener = btn(COPY.loadout.changeArchetype);
    opener.focus();
    expect(hubRoot().hasAttribute('data-hub-modal-open')).toBe(false);
    click(opener);
    expect(isInert(m.host)).toBe(true);
    expect(hubRoot().hasAttribute('data-hub-modal-open')).toBe(true);
    act(() => { seen.archetype.onClose(); });
    expect(isInert(m.host)).toBe(false);
    expect(hubRoot().hasAttribute('data-hub-modal-open')).toBe(false);
    expect(document.activeElement).toBe(opener);
  });

  it('the History sheet (the hub\'s own) registers too, and gives focus back', async () => {
    const { m } = await renderHub({ hubWidth: 1280 });
    const opener = btn(`${COPY.games.history}`) || document.querySelector('[data-hub-history]') || byRole(document, 'button', /History/)[0];
    expect(opener).toBeTruthy();
    opener.focus();
    click(opener);
    expect(document.querySelector('[data-hub-sheet]')).not.toBeNull();
    expect(isInert(m.host)).toBe(true);
    expect(hubRoot().hasAttribute('data-hub-modal-open')).toBe(true);
    click(document.querySelector('[data-hub-sheet-close]'));
    expect(isInert(m.host)).toBe(false);
    expect(document.activeElement).toBe(opener);
  });

  it('the hub unmounting with a sheet open (the sheet\'s Forge door replaced the dashboard) leaves the app root interactive', async () => {
    const host = HUB();
    let unmount;
    host.onOpenForge = vi.fn(() => { unmount(); });
    const { m } = await renderHub({ hub: host });
    unmount = () => { m.unmount(); mounted = mounted.filter((x) => x !== m); };
    const outer = document.createElement('div');
    outer.id = 'app-root';
    document.body.appendChild(outer);
    click(btn(COPY.loadout.changeWatchlist));
    expect(isInert(outer)).toBe(true);
    click(btn(COPY.watchlistSheet.createInForge, document.querySelector('[data-stub="equip"]')));
    expect(host.onOpenForge).toHaveBeenCalled();
    expect(isInert(outer)).toBe(false);
    outer.remove();
  });
});

describe('the career (ruling R-S5-3) reaches the History sheet', () => {
  const openHistory = () => {
    const opener = byRole(document, 'button', /History/)[0];
    click(opener);
    return document.querySelector('[data-hub-sheet]');
  };

  it('a valid record: `${wins}W-${losses}L`, with the spec\'s caption', async () => {
    await renderHub();
    const sheet = openHistory();
    expect(sheet.textContent).toContain('7W-3L');
    expect(sheet.textContent).toContain(COPY.history.careerCaption);
  });

  it('a malformed record: nothing is shown — no zeros, no caption', async () => {
    await renderHub({ hub: HUB({ agent: AGENT({ stats: { wins: '7', losses: 3 } }) }) });
    const sheet = openHistory();
    expect(sheet.textContent).not.toContain('7W');
    expect(sheet.textContent).not.toContain('0W-0L');
    expect(sheet.textContent).not.toContain(COPY.history.careerCaption);
  });
});
