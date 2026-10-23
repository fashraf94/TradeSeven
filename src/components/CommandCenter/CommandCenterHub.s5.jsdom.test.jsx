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
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { userState, listWatchlists, equipWatchlist, unequipWatchlist, flags, slots, mastery } = vi.hoisted(() => ({
  userState: { user: { displayName: 'Flash', username: 'flash' } },
  listWatchlists: vi.fn(),
  equipWatchlist: vi.fn(),
  unequipWatchlist: vi.fn(),
  flags: { current: { concurrencyEnabled: true, hypothesisRecordsOn: true, characterTab: true } },
  slots: { current: [{ id: 'archetype', filled: true }, { id: 'watchlist', filled: true }] },
  // The mastery surface is dark in production (the hook returns null); a row can light it to see what the hub reads and passes on.
  mastery: { profile: null, askedFor: [] },
}));
vi.mock('../../contexts/UserContext', () => ({ useUser: () => userState }));
vi.mock('../../firebase/config', () => ({ db: {}, auth: {} }));
// The S3 merge: App hands the hub no agent; the hub's own owner-tagged read does (hub/useHubReaders.js), and its
// owner masking has its own rows (CommandCenterHub.s3.jsdom.test.jsx, readerInputs.test.js). Here the readers hand
// the hub the read HUB() names and leave the fixtures' sections as they are. The read rides on the hub object under a
// symbol, so a row's spread of it (`{ ...hub, unreadCount }`) keeps it (review MR-7).
const { READ } = vi.hoisted(() => ({ READ: Symbol('agentRead') }));
vi.mock('./hub/useHubReaders', () => ({ default: (hub) => ({ sections: {}, actions: {}, agent: hub?.[READ] ?? null }) }));
vi.mock('../../services/forgeWatchlistService', () => ({ listWatchlists }));
vi.mock('../../services/agentService', () => ({ equipWatchlist, unequipWatchlist }));
vi.mock('../../hooks/useMasteryProfile', () => ({ default: (userId) => { mastery.askedFor.push(userId); return mastery.profile; } }));
vi.mock('./hub/hubFlags', () => ({ hubFlags: () => flags.current }));
vi.mock('../../utils/equipSlots', () => ({ getEquipSlots: () => slots.current }));
vi.mock('../Dashboard/AgentRecordSheet', async () => ({ default: (await import('./__fixtures__/legacySheetStubs')).AgentRecordSheetStub }));
vi.mock('../Dashboard/ArchetypePicker', async () => ({ default: (await import('./__fixtures__/legacySheetStubs')).ArchetypePickerStub }));
vi.mock('../Dashboard/EquipSheet', async () => ({ default: (await import('./__fixtures__/legacySheetStubs')).EquipSheetStub }));
vi.mock('../Dashboard/TraitsSheet', async () => ({ default: (await import('./__fixtures__/legacySheetStubs')).TraitsSheetStub }));

import CommandCenterHub, { areaSummaries } from './CommandCenterHub';
import LoadoutSheets from './LoadoutSheets';
import { CLASHBOT_OPEN_EVENT } from '../ClashBot/ClashBotWidget';
import { getLevelConfig, getNextLevelInfo } from '../../constants/agentProgression';
import { cssVar, readToken } from '../../theme/cssTokens';
import { HUB_COPY as COPY } from './hub/hubCopy';
import { LOADOUT_SYMBOL_LIMIT } from './hub/hubModel';
import { PHONE_TARGET } from './hub/hubStyle';
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
  mastery.profile = null;
  mastery.askedFor = [];
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
/**
 * App's hub object in the merged shape (the live games are `activeBattles`). The rows keep S5's terms: `agent` and
 * `agentLoading`, the hook's two legacy fields, become the agent read the hub's readers hand it, and `agentError`
 * is that read's failure (N-S5-6).
 */
const HUB = ({ agent = AGENT(), agentLoading = false, agentError = false, activeAgentBattles = [], ...over } = {}) => {
  return {
    activeBattles: activeAgentBattles, setScreen: vi.fn(), onOpenForge: vi.fn(), ...over,
    [READ]: { status: agentError ? 'error' : agentLoading ? 'loading' : 'ready', agent, retry: vi.fn() },
  };
};
const readOf = (hub) => hub[READ];

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

  // The S3 merge (S5 report N-S5-6): the agent is the hub's own owner-tagged read, so its failure is not absence.
  it('the agent\'s read failed: "Agent unavailable" and its Retry, the read\'s own; no cards, no picker, no lists read', async () => {
    const hub = HUB({ agent: null, agentError: true });
    await renderHub({ hub });
    expect(panel().getAttribute('data-hub-status-of')).toBe('error');
    expect(byText(panel(), COPY.loadout.agentUnavailable)).not.toBeNull();
    expect(byText(panel(), COPY.loadout.noAgent)).toBeNull();
    expect(panel().querySelector('[data-hub-card]')).toBeNull();
    expect(btn(COPY.loadout.changeArchetype)).toBeNull();
    expect(listWatchlists).not.toHaveBeenCalled();
    click(btn(COPY.loadout.retry, panel()));
    expect(readOf(hub).retry).toHaveBeenCalledTimes(1);
  });

  it('the agent\'s read failed, on the phone\'s Loadout tab: the same words and the same Retry', async () => {
    const hub = HUB({ agent: null, agentError: true });
    await renderHub({ site: 'mobile', hubWidth: 390, hub });
    expect(panel().getAttribute('data-hub-status-of')).toBe('error');
    click(btn(COPY.loadout.retry, panel()));
    expect(readOf(hub).retry).toHaveBeenCalledTimes(1);
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

  it('on an account change the previous account\'s lists are not shown while the new read is pending (spec §3)', async () => {
    const { m } = await renderHub();
    expect(card('watchlist').textContent).toContain('Tech Leaders');
    let release;
    listWatchlists.mockReturnValueOnce(new Promise((resolve) => { release = resolve; }));
    // The new account's agent has the SAME list id equipped: the old account's list of that id is on hand, and only the
    // owner tag keeps it from being shown as the new account's (a different id would be held at "checking" anyway).
    const other = AGENT({ id: 'ag-2', ownerId: 'u-2', equippedWatchlistId: 'wl-1', equippedWatchlistName: 'Other Stored' });
    m.rerender(<CommandCenterHub site="desktop" hub={HUB({ agent: other })} sections={HUB_LAYOUT_FIXTURES.returning.sections} />);
    await flush();
    expect(card('watchlist').textContent).not.toContain('Tech Leaders');
    expect(card('watchlist').textContent).toContain('Other Stored');
    await act(async () => { release([{ watchlistId: 'wl-1', name: 'Other List', status: 'committed', tickers: ['ZZZ'] }]); await Promise.resolve(); });
    expect(card('watchlist').textContent).toContain('Other List');
    expect(listWatchlists).toHaveBeenCalledTimes(2);
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

describe('the idea-first labels on the watchlist card (ruling R-S5-2; the design note), for a player KNOWN to be admitted (Q-S5-4a)', () => {
  const labelOf = async (doc, on, ideaAccess = 'admitted') => {
    flags.current = { ...flags.current, hypothesisRecordsOn: on };
    listWatchlists.mockResolvedValue([{ watchlistId: 'wl-1', name: 'Tech Leaders', status: 'committed', tickers: ['A', 'B', 'C'], ...doc }]);
    const { m } = await renderHub({ hub: HUB({ ideaAccess }) });
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

  it('S5 passes no answer, so the default is "unknown": everyone reads the neutral "N names", whatever the pointer and the records flag say (founder ruling Q-S5-4a)', async () => {
    for (const doc of [{ currentHypothesisVersion: 4 }, {}, { currentHypothesisVersion: null }]) {
      listWatchlists.mockResolvedValue([{ watchlistId: 'wl-1', name: 'Tech Leaders', status: 'committed', tickers: ['A', 'B', 'C'], ...doc }]);
      const { m } = await renderHub();
      const text = card('watchlist').textContent;
      expect(text, JSON.stringify(doc)).toContain(COPY.loadout.names(3));
      expect(text).not.toContain('Universe');
      expect(text).not.toContain('Plain watchlist');
      expect(text).not.toContain('idea');
      m.unmount();
      mounted = mounted.filter((x) => x !== m);
    }
  });

  it('"unknown", "not_admitted" and anything that is not one of the three words: the neutral label, even for an idea pointer with the records on', async () => {
    for (const access of ['unknown', 'not_admitted', null, true, 'Admitted', '']) {
      const text = await labelOf({ currentHypothesisVersion: 4 }, true, access);
      expect(text, String(access)).toContain(COPY.loadout.names(3));
      expect(text, String(access)).not.toContain('Universe');
    }
    for (const access of ['unknown', 'not_admitted']) {
      const text = await labelOf({}, true, access);
      expect(text, access).not.toContain('Plain watchlist');
    }
  });

  it('"admitted" is the only word that turns the labels on, and a change of the answer on the same mount follows', async () => {
    flags.current = { ...flags.current, hypothesisRecordsOn: true };
    listWatchlists.mockResolvedValue([{ watchlistId: 'wl-1', name: 'Tech Leaders', status: 'committed', tickers: ['A', 'B', 'C'], currentHypothesisVersion: 4 }]);
    const { m } = await renderHub();
    expect(card('watchlist').textContent).toContain(COPY.loadout.names(3));
    m.rerender(<CommandCenterHub site="desktop" hub={HUB({ ideaAccess: 'admitted' })} sections={HUB_LAYOUT_FIXTURES.returning.sections} />);
    await flush();
    expect(card('watchlist').textContent).toContain(COPY.loadout.universe(3));
    m.rerender(<CommandCenterHub site="desktop" hub={HUB({ ideaAccess: 'not_admitted' })} sections={HUB_LAYOUT_FIXTURES.returning.sections} />);
    await flush();
    expect(card('watchlist').textContent).toContain(COPY.loadout.names(3));
    expect(card('watchlist').textContent).not.toContain('Universe');
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

  it('the watchlist sheet draws its loading state while the lists are still being read, then the rows', async () => {
    let release;
    listWatchlists.mockReturnValueOnce(new Promise((resolve) => { release = resolve; }));
    await renderHub();
    click(btn(COPY.loadout.changeWatchlist));
    expect(document.querySelector('[data-stub-loading]')).not.toBeNull();
    expect(rowIds()).toEqual([]);
    await act(async () => { release(LISTS()); await Promise.resolve(); });
    expect(document.querySelector('[data-stub-loading]')).toBeNull();
    expect(rowIds()).toEqual(['__none__', 'wl-1', 'wl-2']);
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
    // A real browser drops focus when its container goes inert (jsdom does not): without this the opener
    // would "keep" focus throughout and a missing focus return could never show.
    opener.blur();
    expect(document.activeElement).not.toBe(opener);
    act(() => { seen.archetype.onClose(); });
    expect(isInert(m.host)).toBe(false);
    expect(hubRoot().hasAttribute('data-hub-modal-open')).toBe(false);
    expect(document.activeElement).toBe(opener);
  });

  it('the phone site\'s root carries modalOpen too (it is its own root, not the wide one)', async () => {
    const { m } = await renderHub({ site: 'mobile', hubWidth: 390 });
    expect(hubRoot().hasAttribute('data-hub-modal-open')).toBe(false);
    click(btn(COPY.loadout.changeArchetype));
    expect(isInert(m.host)).toBe(true);
    expect(hubRoot().hasAttribute('data-hub-modal-open')).toBe(true);
    act(() => { seen.archetype.onClose(); });
    expect(hubRoot().hasAttribute('data-hub-modal-open')).toBe(false);
  });

  it('a site switch with a sheet open (the shell remounts under the same stack) leaves the app root interactive', async () => {
    const { m } = await renderHub({ site: 'desktop' });
    click(btn(COPY.loadout.changeArchetype));
    expect(isInert(m.host)).toBe(true);
    m.rerender(<CommandCenterHub site="mobile" hub={HUB()} sections={HUB_LAYOUT_FIXTURES.returning.sections} />);
    await flush();
    expect(document.querySelector('[data-hub-site="mobile"]')).not.toBeNull();
    expect(isInert(m.host)).toBe(false);
    expect(hubRoot().hasAttribute('data-hub-modal-open')).toBe(false);
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
    click(btn(COPY.loadout.changeWatchlist));
    expect(isInert(m.host)).toBe(true);
    click(btn(COPY.watchlistSheet.createInForge, document.querySelector('[data-stub="equip"]')));
    expect(host.onOpenForge).toHaveBeenCalled();
    expect(isInert(m.host)).toBe(false);
  });
});

describe('LoadoutSheets — the sheet\'s own guard', () => {
  it('an equip with no agent does nothing: no write, no error logged, the sheet not closed — whatever row is pressed', async () => {
    const onClose = vi.fn();
    const m = mount(<LoadoutSheets sheet="watchlist" traitsEpoch={0} onClose={onClose} dock="center" agent={null} agentLoading={false} lists={{ status: 'ready', committed: LISTS(), retry: vi.fn() }} onOpenForgeLists={vi.fn()} />);
    mounted.push(m);
    click(document.querySelector('[data-row="wl-2"]'));
    click(document.querySelector('[data-row="__none__"]'));
    await flush();
    expect(equipWatchlist).not.toHaveBeenCalled();
    expect(unequipWatchlist).not.toHaveBeenCalled();
    // The early return is what keeps the null agent out of the write path: without it `agent.id` throws, the
    // catch logs it and the finally closes the sheet — the mutant that "no write happened" alone cannot see.
    expect(errorSpy).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
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

describe('review fixes — what the sheets are handed, what the card says about a list (E2-6, E4-2, E4-5, E4-7)', () => {
  const rerenderWith = (m, agentOver) => m.rerender(
    <CommandCenterHub site="desktop" hub={HUB({ agent: AGENT(agentOver) })} sections={HUB_LAYOUT_FIXTURES.returning.sections} />,
  );

  it("the watchlist sheet takes the shells' fixed teal whatever the player's colour; the other sheets take the player's", async () => {
    await renderHub({ hub: HUB({ agent: AGENT({ primaryColor: 'player-colour' }) }) });
    click(btn(COPY.loadout.changeWatchlist));
    expect(seen.equip.accent).toBe(readToken('teal'));
    expect(seen.equip.accent).not.toBe('player-colour');
    act(() => { seen.equip.onClose(); });
    click(btn(COPY.loadout.changeArchetype));
    expect(seen.archetype.accent).toBe('player-colour');
  });

  it('a list is counted once, by the card and by the sheet: duplicates and malformed entries dropped, the singular for one', async () => {
    listWatchlists.mockResolvedValue([
      { watchlistId: 'wl-1', name: 'Tech Leaders', status: 'committed', tickers: ['NVDA', { symbol: 'NVDA' }, { ticker: 'AAPL' }, {}, ''], currentHypothesisVersion: 2 },
      { watchlistId: 'wl-2', name: 'One', status: 'committed', tickers: ['KO'] },
    ]);
    await renderHub({ hub: HUB({ ideaAccess: 'admitted' }) });
    expect(card('watchlist').textContent).toContain(COPY.loadout.universe(2));
    expect(card('watchlist').textContent.split('NVDA').length - 1).toBe(1);
    click(btn(COPY.loadout.changeWatchlist));
    expect(document.querySelector('[data-row-sub="wl-1"]').textContent).toBe(COPY.watchlistSheet.tickers(2));
    expect(document.querySelector('[data-row-sub="wl-2"]').textContent).toBe(COPY.watchlistSheet.tickers(1));
    expect(COPY.watchlistSheet.tickers(1)).toBe('1 ticker');
    expect(COPY.watchlistSheet.tickers(2)).toBe('2 tickers');
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('an equip made elsewhere to a list committed after the hub read: the lists are read once more and the card shows it', async () => {
    listWatchlists.mockResolvedValueOnce(LISTS().slice(0, 1)).mockResolvedValue(LISTS());
    const { m } = await renderHub();
    expect(listWatchlists).toHaveBeenCalledTimes(1);
    rerenderWith(m, { equippedWatchlistId: 'wl-2', equippedWatchlistName: 'Defensives' });
    await flush();
    expect(listWatchlists).toHaveBeenCalledTimes(2);
    expect(card('watchlist').textContent).toContain('Defensives');
    expect(card('watchlist').textContent).not.toContain(COPY.loadout.unavailable('Defensives'));
    expect(card('watchlist').textContent).not.toContain(COPY.loadout.unavailableNote);
  });

  it('until that read answers the card is checking, not unavailable: the lists on hand were read before the equip', async () => {
    let answer;
    listWatchlists.mockResolvedValueOnce(LISTS().slice(0, 1)).mockReturnValueOnce(new Promise((resolve) => { answer = resolve; }));
    const { m } = await renderHub();
    rerenderWith(m, { equippedWatchlistId: 'wl-2', equippedWatchlistName: 'Defensives' });
    await flush();
    expect(listWatchlists).toHaveBeenCalledTimes(2);
    expect(card('watchlist').textContent).toContain('Defensives');
    expect(card('watchlist').textContent).toContain(COPY.loadout.loading);
    expect(card('watchlist').textContent).not.toContain(COPY.loadout.unavailable('Defensives'));
    expect(card('watchlist').textContent).not.toContain(COPY.loadout.unavailableNote);
    await act(async () => { answer(LISTS()); await Promise.resolve(); });
    expect(card('watchlist').textContent).not.toContain(COPY.loadout.loading);
    expect(card('watchlist').textContent).toContain(COPY.loadout.names(2));
  });

  it('a list that was gone from the start is answered by the mount read: unavailable at once, one read, and a note that claims no cause and no agent behaviour', async () => {
    listWatchlists.mockResolvedValue(LISTS().slice(0, 1));
    await renderHub({ hub: HUB({ agent: AGENT({ equippedWatchlistId: 'wl-9', equippedWatchlistName: 'Gone One' }) }) });
    expect(listWatchlists).toHaveBeenCalledTimes(1);
    expect(card('watchlist').textContent).toContain(COPY.loadout.unavailable('Gone One'));
    expect(card('watchlist').textContent).toContain(COPY.loadout.unavailableNote);
    expect(COPY.loadout.unavailableNote).not.toMatch(/no longer|not using|so your agent|deleted|removed/i);
  });

  it('a list equipped elsewhere that is gone too: one extra read, then the plain facts, and no more reads however it renders', async () => {
    listWatchlists.mockResolvedValue(LISTS().slice(0, 1));
    const { m } = await renderHub();
    rerenderWith(m, { equippedWatchlistId: 'wl-9', equippedWatchlistName: 'Gone One' });
    await flush();
    rerenderWith(m, { equippedWatchlistId: 'wl-9', equippedWatchlistName: 'Gone One' });
    await flush();
    expect(listWatchlists).toHaveBeenCalledTimes(2);
    expect(card('watchlist').textContent).toContain(COPY.loadout.unavailable('Gone One'));
    expect(card('watchlist').textContent).toContain(COPY.loadout.unavailableNote);
  });

  it('if the read for the new list fails the card says so, with Retry, and does not say unavailable', async () => {
    listWatchlists.mockResolvedValueOnce(LISTS().slice(0, 1)).mockRejectedValueOnce(new Error('offline')).mockResolvedValue(LISTS());
    const { m } = await renderHub();
    rerenderWith(m, { equippedWatchlistId: 'wl-2', equippedWatchlistName: 'Defensives' });
    await flush();
    expect(card('watchlist').textContent).toContain(COPY.loadout.listsError);
    expect(card('watchlist').textContent).not.toContain(COPY.loadout.unavailableNote);
    click(btn(COPY.loadout.retry, card('watchlist')));
    await flush();
    expect(card('watchlist').textContent).not.toContain(COPY.loadout.listsError);
    expect(card('watchlist').textContent).toContain(COPY.loadout.names(2));
  });

  describe('the career reads unavailable, never zeros (ruling R-S5-3; spec §7)', () => {
    const openHistory = () => {
      click(byRole(document, 'button', /History/)[0]);
      return document.querySelector('[data-hub-sheet]');
    };

    it('absent or malformed wins and losses say so in the History sheet: no record, no caption, no zeros', async () => {
      for (const stats of [undefined, {}, { wins: '7', losses: 3 }, { wins: -1, losses: 0 }, { wins: 1.5, losses: 0 }, { wins: 3 }]) {
        const { m } = await renderHub({ hub: HUB({ agent: AGENT({ stats }) }) });
        const sheet = openHistory();
        expect(sheet.textContent, JSON.stringify(stats)).toContain(COPY.history.careerUnavailable);
        expect(sheet.textContent).not.toContain(COPY.history.careerCaption);
        expect(sheet.textContent).not.toMatch(/0W-0L|undefined|NaN/);
        click(document.querySelector('[data-hub-sheet-close]'));
        m.unmount();
        mounted = mounted.filter((x) => x !== m);
      }
    }, 30000); // six full hub mounts in one row: over the 5 s default under load (E5-7)

    it('a record, or a career still loading, does not say unavailable', async () => {
      const { m } = await renderHub();
      expect(openHistory().textContent).not.toContain(COPY.history.careerUnavailable);
      click(document.querySelector('[data-hub-sheet-close]'));
      m.unmount();
      mounted = mounted.filter((x) => x !== m);
      await renderHub({ hub: HUB({ agent: null, agentLoading: true }) });
      const sheet = openHistory();
      expect(sheet.textContent).not.toContain(COPY.history.careerUnavailable);
      expect(sheet.textContent).not.toContain(COPY.history.careerCaption);
    });
  });
});

describe('review fixes — focus survives a site switch with a sheet open (E3-2)', () => {
  const isInert = (node) => node.hasAttribute('inert');
  it("a legacy sheet and the hub's own History sheet: focus lands on the new shell, never <body>", async () => {
    for (const opener of [() => btn(COPY.loadout.changeArchetype), () => byRole(document, 'button', /History/)[0]]) {
      const { m } = await renderHub({ site: 'desktop' });
      const control = opener();
      control.focus();
      click(control);
      // A browser drops focus the moment the opener's container goes inert; jsdom does not.
      control.blur();
      // In production a site flip remounts the whole hub, provider included (the gate's desktop frame wraps it in a
      // div the phone does not have), so the row remounts it too: a changed key.
      m.rerender(<CommandCenterHub key="mobile" site="mobile" hub={HUB()} sections={HUB_LAYOUT_FIXTURES.returning.sections} />);
      await flush();
      expect(hubRoot().getAttribute('data-hub-site')).toBe('mobile');
      expect(document.activeElement).toBe(hubRoot());
      expect(isInert(m.host)).toBe(false);
      m.unmount();
      mounted = mounted.filter((x) => x !== m);
    }
  });
});

// ── Test-integrity follow-up (lens E5): the survivors of the fix-round mutation campaign ────────────────
// What the stack does for EVERY legacy sheet on BOTH sites, what each sheet is handed, and how the watchlist
// sheet's latch behaves across more than one open. Each row names the finding it closes.

const SITES = [
  ['desktop', { site: 'desktop', hubWidth: 1280 }, 'center'],
  ['mobile', { site: 'mobile', hubWidth: 390 }, 'bottom'],
];
const TRAITS_SLOTS = () => [{ id: 'archetype', filled: true }, { id: 'watchlist', filled: true }, { id: 'traits', filled: false }];
const LEGACY_SHEETS = [
  ['record', () => recordButton(), () => seen.record],
  ['archetype', () => btn(COPY.loadout.changeArchetype), () => seen.archetype],
  ['watchlist', () => btn(COPY.loadout.changeWatchlist), () => seen.equip],
  ['traits', () => btn(COPY.loadout.changeAdjustments), () => seen.traits],
];

describe('every legacy sheet registers with the one stack, the traits sheet included, on both sites (ruling R-S5-6; E5-1)', () => {
  const isInert = (node) => node.hasAttribute('inert');
  const CASES = SITES.flatMap(([site, options]) => LEGACY_SHEETS.map(([sheet, opener, props]) => [`${sheet} on the ${site} site`, options, opener, props]));

  it.each(CASES)('%s: the app root is inert and modalOpen true while it is open; closing restores both and returns focus to its opener', async (_name, options, opener, props) => {
    slots.current = TRAITS_SLOTS();
    const { m } = await renderHub(options);
    const control = opener();
    control.focus();
    click(control);
    expect(isInert(m.host)).toBe(true);
    expect(hubRoot().hasAttribute('data-hub-modal-open')).toBe(true);
    // A real browser drops focus when the opener's container goes inert (jsdom does not): without this a missing return could not show.
    control.blur();
    act(() => { props().onClose(); });
    await flush();
    expect(isInert(m.host)).toBe(false);
    expect(hubRoot().hasAttribute('data-hub-modal-open')).toBe(false);
    expect(document.activeElement).toBe(control);
  });

  it('an opener that cannot take focus back (the equip lock disabled it while the sheet was open): the hub root gets it, never <body> (S1 review L3-3; E5-8)', async () => {
    const { m } = await renderHub();
    const opener = btn(COPY.loadout.changeArchetype);
    opener.focus();
    click(opener);
    opener.blur();
    m.rerender(<CommandCenterHub site="desktop" hub={HUB({ agent: AGENT({ activeBattleId: 'b-1' }) })} sections={HUB_LAYOUT_FIXTURES.returning.sections} />);
    await flush();
    expect(btn(COPY.loadout.changeArchetype).disabled).toBe(true);
    act(() => { seen.archetype.onClose(); });
    expect(isInert(m.host)).toBe(false);
    expect(document.activeElement).toBe(hubRoot());
  });
});

describe('what each sheet is handed, on each site (ruling R-S5-4; E5-4, E5-5, E5-8)', () => {
  it.each(SITES)('%s site: the agent, the accent, the loading flag and the site\'s dock reach every sheet, and only the sheet asked for is open', async (_name, options, dock) => {
    slots.current = TRAITS_SLOTS();
    mastery.profile = { lit: true };
    await renderHub({ ...options, hub: HUB({ agentLoading: true, agent: AGENT({ primaryColor: 'player-colour' }) }) });
    // The traits sheet first: it stays mounted once opened (keyed by the epoch), so it is the one that could stay open under the others.
    for (const [sheet, opener, props] of [...LEGACY_SHEETS].reverse()) {
      click(opener());
      const handed = props();
      expect(document.querySelectorAll('[role="dialog"]'), `${sheet}: one sheet open at a time`).toHaveLength(1);
      expect(handed.open, sheet).toBe(true);
      expect(handed.dock, sheet).toBe(dock);
      // the quick sheet (EquipSheet) is handed rows, not the agent; the other three are handed the agent
      if (sheet !== 'watchlist') expect(handed.agent?.id, sheet).toBe('ag-1');
      // the watchlist sheet takes the shells' fixed teal (EquipStation / EquipBench); the other three the player's colour
      expect(handed.accent, sheet).toBe(sheet === 'watchlist' ? readToken('teal') : 'player-colour');
      if (sheet === 'record') expect(handed.loading).toBe(true);
      act(() => { handed.onClose(); });
    }
  });

  it('the record sheet is handed the shells\' level inputs for the games PLAYED, the mastery profile read for the OWNER, and the first avatar colour when the player has none', async () => {
    mastery.profile = { lit: true };
    await renderHub({ hub: HUB({ agent: AGENT({ stats: { wins: 2, losses: 1, gamesPlayed: 9 }, avatarColors: ['first-avatar'] }) }) });
    // premise: nine games, two wins and no game at all are three different answers
    expect(getLevelConfig(9)).not.toEqual(getLevelConfig(2));
    expect(getLevelConfig(9)).not.toEqual(getLevelConfig(0));
    expect(getNextLevelInfo(9)).not.toEqual(getNextLevelInfo(0));
    click(recordButton());
    expect(seen.record.levelConfig).toEqual(getLevelConfig(9));
    expect(seen.record.nextLevelInfo).toEqual(getNextLevelInfo(9));
    expect(seen.record.masteryProfile).toBe(mastery.profile);
    expect(new Set(mastery.askedFor)).toEqual(new Set(['u-1']));
    expect(seen.record.accent).toBe('first-avatar');
  });

  it('an agent with no games-played count is a level-zero record, not a crash', async () => {
    await renderHub({ hub: HUB({ agent: AGENT({ stats: { wins: 7, losses: 3 } }) }) });
    click(recordButton());
    expect(seen.record.levelConfig).toEqual(getLevelConfig(0));
    expect(seen.record.nextLevelInfo).toEqual(getNextLevelInfo(0));
  });
});

describe('the phone site wires the same sheets the wide site does (E5-4)', () => {
  const phone = { site: 'mobile', hubWidth: 390 };

  it('the watchlist sheet: the lists the hub read are its rows, and its footer opens the Forge Lists area and closes it', async () => {
    const { hub } = await renderHub(phone);
    click(btn(COPY.loadout.changeWatchlist));
    expect(rowIds()).toEqual(['__none__', 'wl-1', 'wl-2']);
    expect(document.querySelector('[data-row="wl-1"]').hasAttribute('data-selected')).toBe(true);
    click(btn(COPY.watchlistSheet.createInForge, document.querySelector('[data-stub="equip"]')));
    expect(hub.onOpenForge).toHaveBeenCalledTimes(1);
    expect(hub.onOpenForge).toHaveBeenCalledWith({ area: 'watchlists', returnTo: 'dashboard' });
    expect(document.querySelector('[data-stub="equip"]')).toBeNull();
  });

  it('a pick equips through agentService and the lists are read again; so is a close without a pick — the record and the picker close without a re-read', async () => {
    await renderHub(phone);
    click(btn(COPY.loadout.changeWatchlist));
    await act(async () => { click(document.querySelector('[data-row="wl-2"]')); await Promise.resolve(); await Promise.resolve(); });
    await flush();
    expect(equipWatchlist).toHaveBeenCalledWith('ag-1', 'wl-2');
    expect(listWatchlists).toHaveBeenCalledTimes(2);
    click(recordButton());
    act(() => { seen.record.onClose(); });
    click(btn(COPY.loadout.changeArchetype));
    act(() => { seen.archetype.onClose(); });
    await flush();
    expect(listWatchlists).toHaveBeenCalledTimes(2);
    click(btn(COPY.loadout.changeWatchlist));
    act(() => { seen.equip.onClose(); });
    await flush();
    expect(listWatchlists).toHaveBeenCalledTimes(3);
  });

  it('a failed lists read puts the Retry into the sheet, and the Retry reads again', async () => {
    listWatchlists.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(LISTS());
    await renderHub(phone);
    click(btn(COPY.loadout.changeWatchlist));
    expect(rowIds()).toEqual([]);
    click(btn(COPY.loadout.retry, document.querySelector('[data-stub="equip"]')));
    await flush();
    expect(rowIds()).toEqual(['__none__', 'wl-1', 'wl-2']);
  });

  it('the traits sheet REMOUNTS on every open here too (its orphan-cleanup invariant: half of it is the per-open remount)', async () => {
    slots.current = TRAITS_SLOTS();
    await renderHub(phone);
    click(btn(COPY.loadout.changeAdjustments));
    expect(seen.traitsMounts).toBe(1);
    act(() => { seen.traits.onClose(); });
    click(btn(COPY.loadout.changeAdjustments));
    expect(seen.traitsMounts).toBe(2);
  });
});

describe('the watchlist sheet\'s working latch (ruling R-S5-4: the shells\' own equip handler, step for step; E5-2)', () => {
  const pressRow = async (id) => {
    await act(async () => { click(document.querySelector(`[data-row="${id}"]`)); await Promise.resolve(); await Promise.resolve(); });
    await flush();
  };

  it('a second equip in a later open of the same sheet is a second write: the latch let go after the first', async () => {
    await renderHub();
    click(btn(COPY.loadout.changeWatchlist));
    await pressRow('wl-2');
    expect(equipWatchlist).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-stub="equip"]')).toBeNull();
    // The sheet stays mounted between opens (as in the shells): a latch left set would freeze every later pick.
    click(btn(COPY.loadout.changeWatchlist));
    expect(document.querySelector('[data-row="__none__"]').disabled).toBe(false);
    await pressRow('__none__');
    expect(unequipWatchlist).toHaveBeenCalledTimes(1);
    expect(unequipWatchlist).toHaveBeenCalledWith('ag-1');
  });

  it('a FAILED equip lets the latch go too', async () => {
    equipWatchlist.mockRejectedValueOnce(new Error('409'));
    await renderHub();
    click(btn(COPY.loadout.changeWatchlist));
    await pressRow('wl-2');
    click(btn(COPY.loadout.changeWatchlist));
    expect(document.querySelector('[data-row="wl-1"]').disabled).toBe(false);
    await pressRow('wl-1');
    expect(equipWatchlist).toHaveBeenCalledTimes(2);
    expect(equipWatchlist).toHaveBeenLastCalledWith('ag-1', 'wl-1');
  });

  it('while an equip is in flight every row is disabled and a second press — even one that reaches the handler — is no second write; it closes the sheet once, when it settles', async () => {
    let settle;
    equipWatchlist.mockReturnValueOnce(new Promise((resolve) => { settle = resolve; }));
    const onClose = vi.fn();
    const m = mount(<LoadoutSheets sheet="watchlist" traitsEpoch={0} onClose={onClose} dock="center" agent={AGENT()} agentLoading={false} lists={{ status: 'ready', committed: LISTS().slice(0, 2), retry: vi.fn() }} onOpenForgeLists={vi.fn()} />);
    mounted.push(m);
    click(document.querySelector('[data-row="wl-2"]'));
    expect(equipWatchlist).toHaveBeenCalledTimes(1);
    expect(seen.equip.rows.every((row) => row.disabled)).toBe(true);
    // The handler's own guard: the disabled attribute is the sheet's, this is the equip function's.
    act(() => { seen.equip.rows.find((row) => row.id === 'wl-1').onClick(); });
    expect(equipWatchlist).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => { settle({}); await Promise.resolve(); await Promise.resolve(); });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(seen.equip.rows.some((row) => row.disabled)).toBe(false);
  });
});

describe('the watchlist sheet\'s rows agree with the shells\' (E5-9)', () => {
  it('nothing equipped: "No watchlist" is the selected row and no list row is', async () => {
    await renderHub({ hub: HUB({ agent: AGENT({ equippedWatchlistId: null, equippedWatchlistName: null }) }) });
    click(btn(COPY.loadout.changeWatchlist));
    expect(document.querySelector('[data-row="__none__"]').hasAttribute('data-selected')).toBe(true);
    expect(document.querySelector('[data-row="wl-1"]').hasAttribute('data-selected')).toBe(false);
    expect(document.querySelector('[data-row="wl-2"]').hasAttribute('data-selected')).toBe(false);
  });

  it('a list with no name is "Untitled watchlist" in the sheet, as in the shells', async () => {
    listWatchlists.mockResolvedValue([
      { watchlistId: 'wl-7', status: 'committed', tickers: ['A'] },
      { watchlistId: 'wl-8', name: '', status: 'committed', tickers: ['B', 'C'] },
    ]);
    await renderHub();
    click(btn(COPY.loadout.changeWatchlist));
    expect(document.querySelector('[data-row="wl-7"]').textContent).toBe(COPY.watchlistSheet.untitled);
    expect(document.querySelector('[data-row="wl-8"]').textContent).toBe(COPY.watchlistSheet.untitled);
  });
});

describe('whose lists these are: the account the agent document names, not the document itself (E5-11)', () => {
  const rerender = (m, agent) => m.rerender(<CommandCenterHub site="desktop" hub={HUB({ agent })} sections={HUB_LAYOUT_FIXTURES.returning.sections} />);

  it('another agent document of the SAME owner keeps the lists on hand: no blank card, no extra read', async () => {
    const { m } = await renderHub();
    expect(listWatchlists).toHaveBeenCalledTimes(1);
    rerender(m, AGENT({ id: 'ag-2' }));
    await flush();
    expect(listWatchlists).toHaveBeenCalledTimes(1);
    expect(card('watchlist').textContent).toContain('Tech Leaders');
    expect(byText(card('watchlist'), COPY.loadout.loading)).toBeNull();
  });

  it('a document with no owner id is its own key: another such document is another account\'s, and its lists are read for', async () => {
    const { m } = await renderHub({ hub: HUB({ agent: AGENT({ ownerId: undefined }) }) });
    rerender(m, AGENT({ id: 'ag-2', ownerId: undefined }));
    await flush();
    expect(listWatchlists).toHaveBeenCalledTimes(2);
  });
});

describe('the stage\'s area summaries (E5-11)', () => {
  it('a resolved absence of the agent is an answer ("Create your agent first"), a loading Loadout is the waiting words, a ready one its line', () => {
    expect(areaSummaries({ loadout: { status: 'none' } })[2]).toBe(COPY.loadout.noAgent);
    // The S3 merge (N-S5-6): a failed agent read is said as such.
    expect(areaSummaries({ loadout: { status: 'error' } })[2]).toBe(COPY.loadout.agentUnavailable);
    expect(areaSummaries({ loadout: { status: 'loading' } })[2]).toBe(COPY.loadout.summaryLoading);
    expect(areaSummaries({ loadout: { status: 'ready', summary: 'Trend Follower · Tech Leaders' } })[2]).toBe('Trend Follower · Tech Leaders');
    expect(areaSummaries({})[2]).toBe(COPY.loadout.summaryLoading);
  });

  it('the stage says so too, on the screen: the phone stage\'s Loadout line and the wide site\'s Equipped Archetype control read "Create your agent first"', async () => {
    const noAgent = HUB({ agent: null, agentLoading: false });
    const { m } = await renderHub({ site: 'mobile', hubWidth: 390, hub: noAgent });
    expect(document.querySelector('[data-hub-summary="2"]').textContent).toContain(COPY.loadout.noAgent);
    m.unmount();
    mounted = mounted.filter((x) => x !== m);
    await renderHub({ hub: noAgent });
    const control = [...document.querySelectorAll('button')].find((node) => node.textContent.startsWith(COPY.areas.names[2]));
    expect(control.textContent).toContain(COPY.loadout.noAgent);
  });
});

describe('the career reaches the History sheet on the phone site too (ruling R-S5-3; E5-N1: the career rows above run the wide site only)', () => {
  const phone = { site: 'mobile', hubWidth: 390 };
  const openPhoneHistory = () => {
    click(byRole(document, 'tab', COPY.phoneTabs.overview)[0]);
    // the "Game history" row on the Overview (its label carries the completed count of the returning fixture: 3)
    click(byRole(document, 'button', COPY.history.rowLabel(3))[0]);
    return document.querySelector('[data-hub-sheet]');
  };

  it('a valid record: `${wins}W-${losses}L`, with the spec\'s caption', async () => {
    await renderHub(phone);
    const sheet = openPhoneHistory();
    expect(sheet.textContent).toContain('7W-3L');
    expect(sheet.textContent).toContain(COPY.history.careerCaption);
  });

  it('a malformed record reads unavailable there too: no zeros, no caption', async () => {
    await renderHub({ ...phone, hub: HUB({ agent: AGENT({ stats: { wins: '7', losses: 3 } }) }) });
    const sheet = openPhoneHistory();
    expect(sheet.textContent).toContain(COPY.history.careerUnavailable);
    expect(sheet.textContent).not.toContain(COPY.history.careerCaption);
    expect(sheet.textContent).not.toMatch(/0W-0L|undefined|NaN/);
  });
});

// ── The phone menu button (founder ruling Q-S5-1) ───────────────────────────────────────────────────────
// With the hub on, a phone player had no route to the app's drawer (Battle History, Notifications, Rules &
// How to Play, Logout): it opened only from the legacy shells' hamburger. The button sits in the hub header
// before the greeting, calls App's setSidebarOpen(true), and wears the unread count as a badge.

describe('the phone menu button: App\'s drawer, where today\'s phone shell has its hamburger (founder ruling Q-S5-1)', () => {
  const phone = { site: 'mobile', hubWidth: 390 };
  const header = () => hubRoot().querySelector('header');
  const menu = () => document.querySelector('[data-hub-menu]');
  const badge = () => document.querySelector('[data-hub-menu-badge]');
  const DRAWER = (over = {}) => HUB({ setSidebarOpen: vi.fn(), unreadCount: 0, ...over });
  const rerenderPhone = (m, hub) => m.rerender(<CommandCenterHub site="mobile" hub={hub} sections={HUB_LAYOUT_FIXTURES.returning.sections} />);

  it('is drawn on the phone site, labelled for what it opens, and is the header\'s first control — before the greeting and the title', async () => {
    await renderHub({ ...phone, hub: DRAWER() });
    expect(menu()).not.toBeNull();
    expect(menu().getAttribute('aria-label')).toBe(COPY.header.menu);
    expect(header().contains(menu())).toBe(true);
    expect(header().querySelector('button')).toBe(menu());
    expect(menu().compareDocumentPosition(header().querySelector('h1')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const left = header().firstElementChild;
    expect(left.firstElementChild).toBe(menu());
    expect(left.textContent).toContain(COPY.header.title);
  });

  it('opens App\'s drawer: setSidebarOpen(true), once, and nothing else happens — no profile, no Forge, no sheet', async () => {
    const hub = DRAWER({ unreadCount: 3 });
    await renderHub({ ...phone, hub });
    click(menu());
    expect(hub.setSidebarOpen).toHaveBeenCalledTimes(1);
    expect(hub.setSidebarOpen).toHaveBeenCalledWith(true);
    expect(hub.setScreen).not.toHaveBeenCalled();
    expect(hub.onOpenForge).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.querySelector('[data-stub]')).toBeNull();
    expect(hubRoot().hasAttribute('data-hub-modal-open')).toBe(false);
  });

  it('the badge is the unread count: none at zero, the number up to nine, "9+" above, and the label carries the same text', async () => {
    const seenLabels = [];
    for (const [count, shown] of [[1, '1'], [3, '3'], [9, '9'], [10, '9+'], [250, '9+']]) {
      const { m } = await renderHub({ ...phone, hub: DRAWER({ unreadCount: count }) });
      expect(badge(), String(count)).not.toBeNull();
      expect(badge().textContent, String(count)).toBe(shown);
      expect(menu().getAttribute('aria-label'), String(count)).toBe(COPY.header.menuUnread(shown));
      // Label in Name (WCAG 2.5.3): whatever the badge shows is in the button's name
      expect(menu().getAttribute('aria-label'), String(count)).toContain(badge().textContent);
      seenLabels.push(menu().getAttribute('aria-label'));
      m.unmount();
      mounted = mounted.filter((x) => x !== m);
    }
    expect(new Set(seenLabels).size).toBe(4);
    expect(seenLabels[0]).toBe('Open menu, 1 unread notification');
    expect(seenLabels[1]).toBe('Open menu, 3 unread notifications');
    expect(seenLabels[3]).toBe('Open menu, 9+ unread notifications');
    expect(seenLabels[4]).toBe(seenLabels[3]);
    await renderHub({ ...phone, hub: DRAWER({ unreadCount: 0 }) });
    expect(badge()).toBeNull();
    expect(menu().getAttribute('aria-label')).toBe(COPY.header.menu);
  });

  it('an absent or malformed count draws no badge and no number in the label', async () => {
    for (const count of [undefined, null, 0, -3, 2.5, Number.NaN, Infinity, '4', {}, true]) {
      const { m } = await renderHub({ ...phone, hub: DRAWER({ unreadCount: count }) });
      expect(badge(), String(count)).toBeNull();
      expect(menu().getAttribute('aria-label'), String(count)).toBe(COPY.header.menu);
      m.unmount();
      mounted = mounted.filter((x) => x !== m);
    }
  });

  it('the badge follows the count on the same mount: it appears, changes and goes away', async () => {
    const hub = DRAWER({ unreadCount: 0 });
    const { m } = await renderHub({ ...phone, hub });
    expect(badge()).toBeNull();
    rerenderPhone(m, { ...hub, unreadCount: 4 });
    await flush();
    expect(badge().textContent).toBe('4');
    rerenderPhone(m, { ...hub, unreadCount: 12 });
    await flush();
    expect(badge().textContent).toBe('9+');
    rerenderPhone(m, { ...hub, unreadCount: 0 });
    await flush();
    expect(badge()).toBeNull();
    expect(menu()).not.toBeNull();
  });

  it('the account button is still the profile: it opens setScreen("profile") and does not open the drawer', async () => {
    const hub = DRAWER({ unreadCount: 2 });
    await renderHub({ ...phone, hub });
    click(document.querySelector('[data-hub-profile]'));
    expect(hub.setScreen).toHaveBeenCalledTimes(1);
    expect(hub.setScreen).toHaveBeenCalledWith('profile');
    expect(hub.setSidebarOpen).not.toHaveBeenCalled();
    expect(document.querySelector('[data-hub-report-bug]')).not.toBeNull();
  });

  it('is not drawn on the desktop site, at any width, even when App hands the hub the drawer and a count', async () => {
    for (const hubWidth of [1280, 1000, 820, 700]) {
      const { m } = await renderHub({ site: 'desktop', hubWidth, hub: DRAWER({ unreadCount: 7 }) });
      expect(menu(), String(hubWidth)).toBeNull();
      expect(badge(), String(hubWidth)).toBeNull();
      expect(document.querySelector('[data-hub-profile]'), String(hubWidth)).toBeNull();
      m.unmount();
      mounted = mounted.filter((x) => x !== m);
    }
  });

  it('without App\'s setSidebarOpen (the S1 frames, a hub with no drawer to open) the button is not drawn at all — the rest of the header is as it was', async () => {
    await renderHub({ ...phone, hub: HUB() });
    expect(menu()).toBeNull();
    expect(document.querySelector('[data-hub-profile]')).not.toBeNull();
    expect(document.querySelector('[data-hub-report-bug]')).not.toBeNull();
    await renderHub({ ...phone, hub: null });
    expect(menu()).toBeNull();
  });

  // ── The two measures a phone control is held to: its target and the badge's contrast ──────────────────
  // jsdom computes no layout, so the target is the DECLARED box (the bug button's row above reads it the same
  // way); the contrast is computed from the token values the stylesheet ships, never from a copy of them here.

  const tokensCss = () => readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'theme', 'tokens.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  /** A token's hex as tokens.css declares it, following var() aliases (depth 4, as readToken does). */
  const tokenHex = (name) => {
    const css = tokensCss();
    let value = `var(--ft-${name})`;
    for (let hop = 0; hop < 4; hop += 1) {
      const ref = /^var\(--ft-([a-z0-9-]+)\)$/.exec(value);
      if (!ref) break;
      const decl = new RegExp(`(?:^|[\\s;{])--ft-${ref[1]}\\s*:\\s*([^;]+);`).exec(css);
      if (!decl) throw new Error(`tokens.css declares no --ft-${ref[1]}`);
      value = decl[1].trim();
    }
    if (!/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`--ft-${name} does not resolve to a six-digit hex (${value})`);
    return value;
  };
  /** The token a style value names: "var(--ft-red)" reads "red". Anything else (a raw colour, a keyword) reads null. */
  const tokenNameOf = (styleValue) => { const m = /^var\(--ft-([a-z0-9-]+)\)$/.exec(String(styleValue).trim()); return m ? m[1] : null; };
  /** WCAG 2.x relative luminance and contrast ratio of two six-digit hex colours. */
  const luminance = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrastOf = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

  it('the contrast computation itself is sound: black on white is 21:1, a colour on itself 1:1, and the shipped tokens resolve to hex', () => {
    expect(contrastOf('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastOf('#ef4444', '#ef4444')).toBeCloseTo(1, 5);
    expect(tokenHex('red')).toMatch(/^#[0-9a-f]{6}$/i);
    expect(tokenHex('bg-dashboard')).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('is a 44 px target: its declared width and height equal the phone target constant, and that constant is never under 44', async () => {
    for (const unreadCount of [0, 3, 12]) {
      const { m } = await renderHub({ ...phone, hub: DRAWER({ unreadCount }) });
      expect(PHONE_TARGET, 'the phone target constant').toBeGreaterThanOrEqual(44);
      for (const side of ['width', 'height']) {
        expect(parseFloat(menu().style[side]), `${side} at ${unreadCount} unread`).toBeGreaterThanOrEqual(PHONE_TARGET);
        expect(menu().style[side], `${side} at ${unreadCount} unread`).toBe(`${PHONE_TARGET}px`);
      }
      m.unmount();
      mounted = mounted.filter((x) => x !== m);
    }
  });

  it('the badge is the dark ink on the red: the page ground token for its text, the red token behind it', async () => {
    await renderHub({ ...phone, hub: DRAWER({ unreadCount: 3 }) });
    expect(badge().style.color).toBe(cssVar('bg-dashboard'));
    expect(badge().style.background).toBe(cssVar('red'));
  });

  it('the badge text clears 4.5:1 (WCAG AA) on its ground, computed from the token values tokens.css ships', async () => {
    await renderHub({ ...phone, hub: DRAWER({ unreadCount: 12 }) });
    const textToken = tokenNameOf(badge().style.color);
    const groundToken = tokenNameOf(badge().style.background);
    expect(textToken, `badge text colour "${badge().style.color}" must be a --ft token`).not.toBeNull();
    expect(groundToken, `badge ground "${badge().style.background}" must be a --ft token`).not.toBeNull();
    const ratio = contrastOf(tokenHex(textToken), tokenHex(groundToken));
    expect(ratio, `${textToken} on ${groundToken}: ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
  });
});
