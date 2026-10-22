// src/components/CommandCenter/hub/selectors/loadout.test.js
//
// Command Center hub, slice S5 — the Loadout and career selectors (spec V1.2
// §2, §7; rulings R-S5-1 … R-S5-3). Pure functions: every case is an argument.

import { describe, expect, it } from 'vitest';
import { deriveDeployGate } from '../../../../utils/commandCenterLiveBattles';
import {
  CAREER_STATUS, FORGE_DOOR, IDEA_LABEL, LISTS_STATUS, LOADOUT_STATUS, WATCHLIST_STATE,
  deriveCareer, deriveLoadout, deriveWatchlist, equipLockOf, ideaLabelKind, symbolsOf,
} from './loadout';

const archetype = { name: 'Trend Follower', approach: 'Goes where the momentum is.' };
const traitsSlot = { id: 'traits', filled: true };
const baseSlots = [{ id: 'archetype', filled: true }, { id: 'watchlist', filled: true }];
const summary = { equipped: true, count: 2, name: '2 traits', sub: 'A · B' };

const list = (over = {}) => ({ watchlistId: 'wl-1', name: 'Tech Leaders', status: 'committed', tickers: ['NVDA', { symbol: 'AAPL' }, { ticker: 'MSFT' }], ...over });
const agent = (over = {}) => ({ id: 'ag-1', name: 'Shadow', archetype: 'momentum_chaser', equippedWatchlistId: 'wl-1', equippedWatchlistName: 'Stored Name', stats: { wins: 7, losses: 3 }, ...over });

const loadoutOf = (over = {}) => deriveLoadout({
  agent: agent(),
  agentLoading: false,
  archetype,
  slots: baseSlots,
  adjustments: summary,
  committed: [list()],
  listsStatus: LISTS_STATUS.READY,
  activeAgentBattles: [],
  concurrencyEnabled: true,
  hypothesisRecordsOn: true,
  characterTab: true,
  ...over,
});

describe('deriveLoadout — the agent decides the section\'s status (spec §3: loading is not absence)', () => {
  it('loading while the ranked agent has not resolved', () => {
    expect(loadoutOf({ agent: null, agentLoading: true })).toEqual({ status: LOADOUT_STATUS.LOADING });
  });

  it('none when it resolved to no agent', () => {
    expect(loadoutOf({ agent: null, agentLoading: false })).toEqual({ status: LOADOUT_STATUS.NONE });
  });

  it('an agent that is already held shows while its hook re-subscribes (loading true, agent present)', () => {
    expect(loadoutOf({ agentLoading: true }).status).toBe(LOADOUT_STATUS.READY);
  });

  it('ready carries the identity, the archetype, the watchlist, the adjustments and the lock', () => {
    const l = loadoutOf();
    expect(l).toMatchObject({
      status: LOADOUT_STATUS.READY,
      identity: { name: 'Shadow' },
      archetype,
      lockedInGame: false,
    });
    expect(l.watchlist).toMatchObject({ state: WATCHLIST_STATE.READY, id: 'wl-1', name: 'Tech Leaders', symbols: ['NVDA', 'AAPL', 'MSFT'], count: 3 });
  });

  it('a nameless agent has a null identity name (the card draws its own fallback)', () => {
    expect(loadoutOf({ agent: agent({ name: '  ' }) }).identity).toEqual({ name: null });
    expect(loadoutOf({ agent: agent({ name: undefined }) }).identity).toEqual({ name: null });
  });

  it('a slow lists read never hides the archetype', () => {
    const l = loadoutOf({ listsStatus: LISTS_STATUS.LOADING, committed: [] });
    expect(l.status).toBe(LOADOUT_STATUS.READY);
    expect(l.archetype).toEqual(archetype);
    expect(l.watchlist.state).toBe(WATCHLIST_STATE.LOADING);
  });
});

describe('deriveWatchlist — the card\'s state (ruling R-S5-1)', () => {
  const w = (over) => deriveWatchlist({ agent: agent(), committed: [list()], listsStatus: LISTS_STATUS.READY, hypothesisRecordsOn: true, ...over });

  it('no list equipped: none, whatever the lists say (a blank id is no id)', () => {
    for (const equippedWatchlistId of [undefined, null, '', '   ']) {
      expect(w({ agent: agent({ equippedWatchlistId }) }).state, JSON.stringify(equippedWatchlistId)).toBe(WATCHLIST_STATE.NONE);
    }
  });

  it('loading: the stored name is shown before the lists arrive', () => {
    expect(w({ listsStatus: LISTS_STATUS.LOADING, committed: [] })).toMatchObject({ state: WATCHLIST_STATE.LOADING, name: 'Stored Name', symbols: [] });
  });

  it('error is not "not found": a failed read names the list from the agent document and is its own state', () => {
    expect(w({ listsStatus: LISTS_STATUS.ERROR, committed: [] })).toMatchObject({ state: WATCHLIST_STATE.ERROR, name: 'Stored Name' });
  });

  it('a list that cannot be resolved among the committed ones is unavailable, under its stored name', () => {
    expect(w({ committed: [list({ watchlistId: 'other' })] })).toMatchObject({ state: WATCHLIST_STATE.UNAVAILABLE, name: 'Stored Name', symbols: [], count: 0 });
    expect(w({ committed: [] })).toMatchObject({ state: WATCHLIST_STATE.UNAVAILABLE });
  });

  it('resolved: the list\'s own name wins over the stored one; the stored one fills in when the list has none', () => {
    expect(w().name).toBe('Tech Leaders');
    expect(w({ committed: [list({ name: '' })] }).name).toBe('Stored Name');
    expect(w({ committed: [list({ name: '' })], agent: agent({ equippedWatchlistName: undefined }) }).name).toBeNull();
  });

  it('a malformed committed argument is an empty one', () => {
    expect(w({ committed: null }).state).toBe(WATCHLIST_STATE.UNAVAILABLE);
    expect(w({ committed: [null, undefined, 5] }).state).toBe(WATCHLIST_STATE.UNAVAILABLE);
  });
});

describe('ideaLabelKind — the idea-first labels (ruling R-S5-2; the design note, appendix A)', () => {
  it.each([
    ['a positive integer pointer, records on', { currentHypothesisVersion: 1 }, true, IDEA_LABEL.UNIVERSE],
    ['a later version, records on', { currentHypothesisVersion: 12 }, true, IDEA_LABEL.UNIVERSE],
    ['an absent pointer, records on', {}, true, IDEA_LABEL.PLAIN],
    ['a null pointer, records on', { currentHypothesisVersion: null }, true, IDEA_LABEL.PLAIN],
    ['an absent pointer, records OFF', {}, false, IDEA_LABEL.NEUTRAL],
    ['a positive pointer, records OFF (the flag dominates: it names an idea the player cannot see)', { currentHypothesisVersion: 3 }, false, IDEA_LABEL.NEUTRAL],
    ['zero, records on (malformed: the server reads 0 only for absent)', { currentHypothesisVersion: 0 }, true, IDEA_LABEL.NEUTRAL],
    ['a negative pointer', { currentHypothesisVersion: -1 }, true, IDEA_LABEL.NEUTRAL],
    ['a fraction', { currentHypothesisVersion: 1.5 }, true, IDEA_LABEL.NEUTRAL],
    ['a numeric string', { currentHypothesisVersion: '2' }, true, IDEA_LABEL.NEUTRAL],
    ['a boolean', { currentHypothesisVersion: true }, true, IDEA_LABEL.NEUTRAL],
    ['NaN', { currentHypothesisVersion: Number.NaN }, true, IDEA_LABEL.NEUTRAL],
    ['an object', { currentHypothesisVersion: { n: 1 } }, true, IDEA_LABEL.NEUTRAL],
  ])('%s', (_name, doc, flag, expected) => {
    expect(ideaLabelKind(doc, flag)).toBe(expected);
  });

  it('only an exact true turns the records on (an undefined or truthy flag fails closed)', () => {
    for (const flag of [undefined, null, 1, 'true', {}]) expect(ideaLabelKind({ currentHypothesisVersion: 2 }, flag)).toBe(IDEA_LABEL.NEUTRAL);
  });

  it('no list at all is neutral-or-plain by the flag alone, never a throw', () => {
    expect(ideaLabelKind(null, true)).toBe(IDEA_LABEL.PLAIN);
    expect(ideaLabelKind(undefined, false)).toBe(IDEA_LABEL.NEUTRAL);
  });

  it('the card carries the label of the RESOLVED list only', () => {
    const w = (doc, on) => deriveWatchlist({ agent: agent(), committed: [list(doc)], listsStatus: LISTS_STATUS.READY, hypothesisRecordsOn: on });
    expect(w({ currentHypothesisVersion: 2 }, true).idea).toBe(IDEA_LABEL.UNIVERSE);
    expect(w({}, true).idea).toBe(IDEA_LABEL.PLAIN);
    expect(w({ currentHypothesisVersion: 2 }, false).idea).toBe(IDEA_LABEL.NEUTRAL);
    expect(w({ currentHypothesisVersion: 'x' }, true).idea).toBe(IDEA_LABEL.NEUTRAL);
    // unresolved states claim nothing about ideas
    expect(deriveWatchlist({ agent: agent(), committed: [], listsStatus: LISTS_STATUS.READY, hypothesisRecordsOn: true }).idea).toBe(IDEA_LABEL.NEUTRAL);
  });
});

describe('symbolsOf — the shells\' ticker normalization', () => {
  it('strings, symbol objects and ticker objects; the rest dropped', () => {
    expect(symbolsOf({ tickers: ['A', { symbol: 'B' }, { ticker: 'C' }, null, {}, 3, '', { symbol: '' }] })).toEqual(['A', 'B', 'C']);
  });
  it('an absent or malformed list is empty', () => {
    expect(symbolsOf(null)).toEqual([]);
    expect(symbolsOf({ tickers: 'AAPL' })).toEqual([]);
  });
});

describe('equipLockOf — ONE predicate for the label and every picker (BUILD_RULES §9)', () => {
  const live = (over = {}) => ({ id: 'b-1', status: 'active', ...over });
  const lock = (over) => equipLockOf({ agent: agent(), activeAgentBattles: [], concurrencyEnabled: true, ...over });

  it('unlocked with nothing live and no activeBattleId', () => {
    expect(lock()).toBe(false);
    expect(lock({ concurrencyEnabled: false })).toBe(false);
  });

  it('concurrency ON: the lock is the agent\'s activeBattleId, as the shells\' slots and label both read it', () => {
    expect(lock({ agent: agent({ activeBattleId: 'b-1' }) })).toBe(true);
    // a live casual battle runs on the clone and does NOT lock the real loadout
    expect(lock({ activeAgentBattles: [live()] })).toBe(false);
  });

  it('concurrency OFF: any live battle locks (the shells\' label), and so does the agent field (the shells\' slots)', () => {
    expect(lock({ concurrencyEnabled: false, activeAgentBattles: [live()] })).toBe(true);
    expect(lock({ concurrencyEnabled: false, agent: agent({ activeBattleId: 'b-1' }) })).toBe(true);
  });

  it('the two divergent cases are locked, so the hub is never less locked than either shell surface', () => {
    // live battle without activeBattleId (the poll saw it before the agent document did)
    expect(lock({ concurrencyEnabled: false, activeAgentBattles: [live()], agent: agent({ activeBattleId: undefined }) })).toBe(true);
    // activeBattleId without a live battle in the poll (the poll has not caught up, or the battle just closed)
    expect(lock({ concurrencyEnabled: false, activeAgentBattles: [], agent: agent({ activeBattleId: 'b-1' }) })).toBe(true);
    expect(lock({ concurrencyEnabled: true, activeAgentBattles: [], agent: agent({ activeBattleId: 'b-1' }) })).toBe(true);
  });

  it('only ACTIVE battles count, as in the shells\' filter; a null entry is ignored, not thrown on', () => {
    expect(lock({ concurrencyEnabled: false, activeAgentBattles: [live({ status: 'completed' })] })).toBe(false);
    expect(lock({ concurrencyEnabled: false, activeAgentBattles: [null, undefined, live({ status: 'completed' })] })).toBe(false);
    expect(lock({ concurrencyEnabled: false, activeAgentBattles: 'nope' })).toBe(false);
  });

  it('an anything-but-true concurrency flag is the legacy any-live gate (the deploy selector\'s rule)', () => {
    expect(lock({ concurrencyEnabled: 'yes', activeAgentBattles: [live()] })).toBe(true);
    expect(lock({ concurrencyEnabled: undefined, activeAgentBattles: [live()] })).toBe(true);
  });

  it('agrees with the shipped deriveDeployGate on the equip side, for every live list and both flag values', () => {
    for (const concurrencyEnabled of [true, false]) {
      for (const battles of [[], [live()], [live({ groupId: 'g-1' })], [live(), live({ id: 'b-2', groupId: 'g-1' })]]) {
        for (const activeBattleId of [undefined, 'b-1']) {
          const a = agent({ activeBattleId });
          const shells = deriveDeployGate({ liveBattles: battles, agent: a, concurrencyEnabled }).equipLocked;
          const hub = equipLockOf({ agent: a, activeAgentBattles: battles, concurrencyEnabled });
          // never less locked than the shells' label; and with the flag on (as shipped) exactly equal to it
          expect(hub || !shells, JSON.stringify({ concurrencyEnabled, battles: battles.length, activeBattleId })).toBe(true);
          if (concurrencyEnabled) expect(hub).toBe(shells);
        }
      }
    }
  });

  it('deriveLoadout reports it as lockedInGame', () => {
    expect(loadoutOf({ agent: agent({ activeBattleId: 'b-9' }) }).lockedInGame).toBe(true);
    expect(loadoutOf().lockedInGame).toBe(false);
  });
});

describe('the adjustments card follows getEquipSlots (the shells\' traits slot)', () => {
  it('absent without a traits slot (TRAIT_SLOT_ENABLED off, as shipped)', () => {
    expect(loadoutOf({ slots: baseSlots }).adjustments).toBeNull();
  });

  it('present with one, carrying the shared summary and the Forge door named after the tab', () => {
    expect(loadoutOf({ slots: [...baseSlots, traitsSlot], characterTab: true }).adjustments).toEqual({ equipped: true, name: '2 traits', sub: 'A · B', door: FORGE_DOOR.CHARACTER });
    expect(loadoutOf({ slots: [...baseSlots, traitsSlot], characterTab: false }).adjustments.door).toBe(FORGE_DOOR.TRAITS);
    expect(loadoutOf({ slots: [...baseSlots, traitsSlot], characterTab: undefined }).adjustments.door).toBe(FORGE_DOOR.TRAITS);
  });

  it('a missing summary or slots argument draws no card', () => {
    expect(loadoutOf({ slots: [...baseSlots, traitsSlot], adjustments: null }).adjustments).toBeNull();
    expect(loadoutOf({ slots: undefined }).adjustments).toBeNull();
  });
});

describe('deriveCareer — the stored W-L (spec §7; ruling R-S5-3)', () => {
  const career = (stats, over = {}) => deriveCareer({ agent: { id: 'a', stats }, agentLoading: false, ...over });

  it('a valid record is `${wins}W-${losses}L`, as stored', () => {
    expect(career({ wins: 7, losses: 3 })).toEqual({ status: CAREER_STATUS.READY, record: '7W-3L' });
    expect(career({ wins: 0, losses: 0 })).toEqual({ status: CAREER_STATUS.READY, record: '0W-0L' });
  });

  it('draws are excluded and there is no win rate or games-played in the answer', () => {
    const c = career({ wins: 7, losses: 3, draws: 4, gamesPlayed: 14 });
    expect(c).toEqual({ status: CAREER_STATUS.READY, record: '7W-3L' });
  });

  it.each([
    ['no stats object', undefined],
    ['wins missing', { losses: 3 }],
    ['losses missing', { wins: 3 }],
    ['wins null', { wins: null, losses: 1 }],
    ['wins a numeric string', { wins: '7', losses: 3 }],
    ['losses a numeric string', { wins: 7, losses: '3' }],
    ['negative wins', { wins: -1, losses: 3 }],
    ['a fractional loss', { wins: 7, losses: 2.5 }],
    ['NaN', { wins: Number.NaN, losses: 1 }],
    ['Infinity', { wins: Number.POSITIVE_INFINITY, losses: 1 }],
    ['an unsafe integer', { wins: 2 ** 60, losses: 1 }],
    ['booleans', { wins: true, losses: false }],
    ['arrays', { wins: [7], losses: [3] }],
  ])('malformed — %s — reads unavailable and never synthesizes zeros', (_name, stats) => {
    expect(career(stats)).toEqual({ status: CAREER_STATUS.UNAVAILABLE });
  });

  it('no agent: loading while it loads, unavailable once it resolved to none', () => {
    expect(deriveCareer({ agent: null, agentLoading: true })).toEqual({ status: CAREER_STATUS.LOADING });
    expect(deriveCareer({ agent: null, agentLoading: false })).toEqual({ status: CAREER_STATUS.UNAVAILABLE });
  });
});
