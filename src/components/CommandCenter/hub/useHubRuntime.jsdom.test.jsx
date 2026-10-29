// @vitest-environment jsdom
//
// Command Center hub, slice S5 — the runtime's CONTRACT (hub/useHubRuntime.js):
// which actions the hub hands its panels in each state. The panel also guards
// its own buttons (it draws a Forge door only inside the card it belongs to, and
// disables a picker while `lockedInGame`), so a hub-root row cannot see the
// runtime's layer; these rows read the actions themselves. Every consumer that
// later opens a sheet from somewhere else (S2b's strip, S6's Research) takes
// the same object, and a locked loadout must not open the picker for any of them.

import React, { act, useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';

const { listWatchlists, flags, slots } = vi.hoisted(() => ({
  listWatchlists: vi.fn(),
  flags: { current: { concurrencyEnabled: true, hypothesisRecordsOn: true, characterTab: true } },
  slots: { current: [{ id: 'archetype', filled: true }, { id: 'watchlist', filled: true }] },
}));
vi.mock('../../../firebase/config', () => ({ db: {}, auth: {} }));
vi.mock('../../../services/forgeWatchlistService', () => ({ listWatchlists }));
vi.mock('../../../hooks/useMasteryProfile', () => ({ default: () => null }));
vi.mock('./hubFlags', () => ({ hubFlags: () => flags.current }));
vi.mock('../../../utils/equipSlots', () => ({ getEquipSlots: () => slots.current }));

import { HubOverlayProvider } from './HubOverlays';
import { HUB_S1_SECTIONS } from './hubModel';
import { unreadCountOf, useHubRuntime } from './useHubRuntime';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const ALL = ['openRecord', 'changeArchetype', 'changeWatchlist', 'changeAdjustments', 'openLoadoutForge', 'openForgeLists', 'openForgeCharacter', 'retryLists', 'openProfile', 'reportBug'];
const LISTS = () => [{ watchlistId: 'wl-1', name: 'Tech Leaders', status: 'committed', tickers: ['NVDA'] }];
const AGENT = (over = {}) => ({ id: 'ag-1', ownerId: 'u-1', name: 'Nova', archetype: 'momentum_chaser', equippedWatchlistId: 'wl-1', stats: { wins: 1, losses: 0 }, ...over });
/**
 * The S3 merge: App hands the hub no agent; the readers hand the runtime the hub's own owner-tagged read
 * (`agentRead`). The rows keep S5's terms: `agent` and `agentLoading` become that read, `agentError` its failure.
 */
const READS = new WeakMap();
const HUB = ({ agent = AGENT(), agentLoading = false, agentError = false, activeAgentBattles = [], ...over } = {}) => {
  const hub = { activeBattles: activeAgentBattles, setScreen: vi.fn(), onOpenForge: vi.fn(), ...over };
  READS.set(hub, { status: agentError ? 'error' : agentLoading ? 'loading' : 'ready', agent, retry: vi.fn() });
  return hub;
};

let host;
let root;
let api;

function Probe({ hub, sections }) {
  const rootRef = useRef(null);
  api = useHubRuntime({ hub, agentRead: hub ? READS.get(hub) ?? null : null, sections, rootRef });
  return null;
}
/** A shell handed `hub` and no read at all. */
function ProbeWithout({ hub, sections = HUB_S1_SECTIONS }) {
  const rootRef = useRef(null);
  api = useHubRuntime({ hub, sections, rootRef });
  return null;
}
const render = (hub, sections = HUB_S1_SECTIONS) => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => { root.render(<HubOverlayProvider><Probe hub={hub} sections={sections} /></HubOverlayProvider>); });
};
const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };
const defined = () => ALL.filter((name) => typeof api.actions[name] === 'function');

beforeEach(() => {
  listWatchlists.mockReset();
  listWatchlists.mockResolvedValue(LISTS());
  flags.current = { concurrencyEnabled: true, hypothesisRecordsOn: true, characterTab: true };
  slots.current = [{ id: 'archetype', filled: true }, { id: 'watchlist', filled: true }];
});
afterEach(() => {
  if (root) act(() => { root.unmount(); });
  host?.remove();
  host = null;
  root = null;
  api = null;
});

describe('useHubRuntime — no hub prop: the S1 frame', () => {
  it('derives nothing and offers nothing: the sections pass through untouched and no action exists', async () => {
    const sections = { ...HUB_S1_SECTIONS };
    render(null, sections);
    await flush();
    expect(api.live).toBe(false);
    expect(api.sections).toBe(sections);
    expect(defined()).toEqual([]);
    expect(listWatchlists).not.toHaveBeenCalled();
  });
});

describe('useHubRuntime — the actions in each state', () => {
  it('the agent is loading: nothing opens (there is nothing to open yet) but the header\'s two still work', async () => {
    render(HUB({ agent: null, agentLoading: true }));
    await flush();
    expect(api.sections.loadout.status).toBe('loading');
    expect(defined()).toEqual(['openProfile', 'reportBug']);
  });

  it('no agent: the same — the identity, the pickers and the Forge doors need an agent', async () => {
    render(HUB({ agent: null, agentLoading: false }));
    await flush();
    expect(api.sections.loadout.status).toBe('none');
    expect(defined()).toEqual(['openProfile', 'reportBug']);
    expect(api.actions.retryAgent).toBeUndefined();
  });

  // The S3 merge (N-S5-6): the agent is the hub's owner-tagged read; its failure is the Loadout's error, with a Retry.
  it('the agent\'s read failed: the error state, the read\'s own Retry and nothing else of the Loadout\'s', async () => {
    const hub = HUB({ agent: null, agentError: true });
    render(hub);
    await flush();
    expect(api.sections.loadout.status).toBe('error');
    expect(api.sections.career.status).toBe('unavailable');
    expect(api.actions.retryAgent).toBe(READS.get(hub).retry);
    expect(defined()).toEqual(['openProfile', 'reportBug']);
    expect(listWatchlists).not.toHaveBeenCalled();
  });

  it('the Retry exists only for a failed read: never while loading, for absence, or for a ready agent', async () => {
    for (const hub of [HUB({ agent: null, agentLoading: true }), HUB({ agent: null }), HUB(), HUB({ agentError: true })]) {
      render(hub);
      await flush();
      expect(api.actions.retryAgent).toBeUndefined();
      act(() => { root.unmount(); });
      host.remove();
    }
  });

  it('a hub with no read handed (agentRead absent) is a read not yet answered: loading, never absence', async () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => { root.render(<HubOverlayProvider><ProbeWithout hub={{ activeBattles: [] }} /></HubOverlayProvider>); });
    await flush();
    expect(api.sections.loadout.status).toBe('loading');
    expect(api.agent).toBeNull();
  });

  it('the equip lock reads the poll\'s one live-games key, `activeBattles` (the shells\' own filter: status active)', async () => {
    // With concurrency on the lock is the agent's own field; the list decides it with concurrency off.
    flags.current = { ...flags.current, concurrencyEnabled: false };
    render(HUB({ activeAgentBattles: [{ id: 'b-9', status: 'active', agentId: 'casual-agent-u-1' }] }));
    await flush();
    expect(api.sections.loadout.lockedInGame).toBe(true);
    act(() => { root.unmount(); });
    host.remove();
    const old = HUB();
    old.activeBattles = undefined;
    old.activeAgentBattles = [{ id: 'b-9', status: 'active', agentId: 'casual-agent-u-1' }];
    render(old);
    await flush();
    expect(api.sections.loadout.lockedInGame, 'the old key is not read').toBe(false);
  });

  it('ready and unlocked, without a traits slot: every door but the adjustments\' two', async () => {
    render(HUB());
    await flush();
    expect(defined()).toEqual(ALL.filter((name) => name !== 'changeAdjustments' && name !== 'openForgeCharacter'));
  });

  it('ready and unlocked, with a traits slot: every action', async () => {
    slots.current = [...slots.current, { id: 'traits', filled: false }];
    render(HUB());
    await flush();
    expect(defined()).toEqual(ALL);
  });

  it('LOCKED in a live game: no picker opens for ANY consumer — the record and the Forge doors still do', async () => {
    slots.current = [...slots.current, { id: 'traits', filled: true }];
    render(HUB({ agent: AGENT({ activeBattleId: 'b-1' }) }));
    await flush();
    expect(api.sections.loadout.lockedInGame).toBe(true);
    expect(defined()).toEqual(['openRecord', 'openLoadoutForge', 'openForgeLists', 'openForgeCharacter', 'retryLists', 'openProfile', 'reportBug']);
  });

  it('without App\'s onOpenForge there is no Forge door; without setScreen there is no profile', async () => {
    slots.current = [...slots.current, { id: 'traits', filled: true }];
    render(HUB({ onOpenForge: undefined, setScreen: undefined }));
    await flush();
    expect(defined()).toEqual(['openRecord', 'changeArchetype', 'changeWatchlist', 'changeAdjustments', 'retryLists', 'reportBug']);
  });
});

describe('useHubRuntime — the phone menu (founder ruling Q-S5-1)', () => {
  it('openMenu opens the app drawer: it exists only with setSidebarOpen from App, and calls it with exactly true', async () => {
    const hub = HUB({ setSidebarOpen: vi.fn() });
    render(hub);
    await flush();
    expect(typeof api.actions.openMenu).toBe('function');
    api.actions.openMenu();
    expect(hub.setSidebarOpen).toHaveBeenCalledTimes(1);
    expect(hub.setSidebarOpen).toHaveBeenCalledWith(true);
    expect(hub.setScreen).not.toHaveBeenCalled();
  });

  it('it needs nothing but the drawer: with no agent, while the agent loads, and locked in a game it is still offered', async () => {
    for (const hub of [HUB({ agent: null, agentLoading: true }), HUB({ agent: null }), HUB({ agent: AGENT({ activeBattleId: 'b-1' }) })]) {
      render({ ...hub, setSidebarOpen: vi.fn() });
      await flush();
      expect(typeof api.actions.openMenu).toBe('function');
      act(() => { root.unmount(); });
      host.remove();
      root = null;
    }
  });

  it('no setSidebarOpen (or one that is not a function), or no hub at all: no menu action', async () => {
    for (const hub of [HUB(), HUB({ setSidebarOpen: 'open' }), HUB({ setSidebarOpen: null }), null]) {
      render(hub);
      await flush();
      expect(api.actions.openMenu, String(hub && hub.setSidebarOpen)).toBeUndefined();
      act(() => { root.unmount(); });
      host.remove();
      root = null;
    }
  });

  it('unreadCount is the count the hub was handed when it is a positive whole number, else 0', async () => {
    for (const [given, expected] of [[3, 3], [1, 1], [0, 0], [-2, 0], [2.5, 0], [Number.NaN, 0], [Infinity, 0], ['4', 0], [null, 0], [undefined, 0], [{}, 0]]) {
      render(HUB({ setSidebarOpen: vi.fn(), unreadCount: given }));
      await flush();
      expect(api.unreadCount, String(given)).toBe(expected);
      act(() => { root.unmount(); });
      host.remove();
      root = null;
    }
    render(null);
    await flush();
    expect(api.unreadCount).toBe(0);
  });

  it('unreadCountOf is the same rule on its own', () => {
    expect(unreadCountOf(5)).toBe(5);
    expect(unreadCountOf(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER);
    for (const bad of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 2, '5', null, undefined, NaN, true]) expect(unreadCountOf(bad), String(bad)).toBe(0);
  });
});

describe('useHubRuntime — ideaAccess (founder ruling Q-S5-4a)', () => {
  const pointerList = () => [{ watchlistId: 'wl-1', name: 'Tech Leaders', status: 'committed', tickers: ['NVDA', 'AAPL'], currentHypothesisVersion: 3 }];
  const ideaFor = async (hub) => {
    listWatchlists.mockResolvedValue(pointerList());
    render(hub);
    await flush();
    const idea = api.sections.loadout.watchlist.idea;
    act(() => { root.unmount(); });
    host.remove();
    root = null;
    return idea;
  };

  it('S5 passes no answer: the label is neutral for everyone, with the records flag on and an idea pointer on the list', async () => {
    expect(flags.current.hypothesisRecordsOn).toBe(true);
    expect(await ideaFor(HUB())).toBe('neutral');
  });

  it('only the word admitted lights the idea labels; not_admitted, unknown and anything else do not', async () => {
    expect(await ideaFor(HUB({ ideaAccess: 'admitted' }))).toBe('universe');
    for (const ideaAccess of ['not_admitted', 'unknown', 'Admitted', true, 1, null, '']) {
      expect(await ideaFor(HUB({ ideaAccess })), String(ideaAccess)).toBe('neutral');
    }
  });

  it('"admitted" does not outrank the records flag: flag off, the label is neutral', async () => {
    flags.current = { ...flags.current, hypothesisRecordsOn: false };
    expect(await ideaFor(HUB({ ideaAccess: 'admitted' }))).toBe('neutral');
  });
});

describe('useHubRuntime — the sections it merges', () => {
  it('the ready loadout carries the one-line summary the area control and the stage show', async () => {
    render(HUB());
    await flush();
    expect(api.sections.loadout.status).toBe('ready');
    expect(api.sections.loadout.summary).toBe('Trend Follower · Tech Leaders');
  });

  it('the career comes from the agent, not from the sections it was given', async () => {
    render(HUB(), { ...HUB_S1_SECTIONS, career: { status: 'ready', record: '99W-99L' } });
    await flush();
    expect(api.sections.career).toEqual({ status: 'ready', record: '1W-0L' });
  });

  it('every other section passes through as given', async () => {
    const research = { status: 'ready', summary: 'x' };
    render(HUB(), { ...HUB_S1_SECTIONS, research });
    await flush();
    expect(api.sections.research).toBe(research);
  });
});

describe('useHubRuntime — the same account signing in again (the S8 review S8-11; ruling R-S8F-2)', () => {
  it("the earlier sign-in's list document is not on the watchlist card under the new one, and a failed new read says so", async () => {
    const EPOCH_ONE = { watchlistId: 'wl-epoch-1', name: 'Epoch one', status: 'committed', tickers: ['NVDA'] };
    listWatchlists.mockReset();
    listWatchlists.mockResolvedValueOnce([EPOCH_ONE]).mockRejectedValueOnce(new Error('offline'));
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const rerender = (hub) => act(() => { root.render(<HubOverlayProvider><Probe hub={hub} sections={HUB_S1_SECTIONS} /></HubOverlayProvider>); });
    render(HUB({ agent: AGENT({ equippedWatchlistId: 'wl-epoch-1' }) }));
    await flush();
    expect(api.sections.loadout.watchlist).toMatchObject({ state: 'ready', name: 'Epoch one' });
    // Another tab signs out (no agent), then the same account signs in again: the same uid, a new epoch.
    rerender(HUB({ agent: null }));
    rerender(HUB({ agent: AGENT({ equippedWatchlistId: 'wl-epoch-1' }) }));
    expect(api.sections.loadout.watchlist?.name).not.toBe('Epoch one');
    await flush();
    expect(listWatchlists).toHaveBeenCalledTimes(2);
    expect(api.sections.loadout.watchlist?.name).not.toBe('Epoch one');
    expect(api.sections.loadout.watchlist?.state).toBe('error');
    errors.mockRestore();
  });
});
