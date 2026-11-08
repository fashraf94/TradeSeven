// src/components/CommandCenter/hub/perGameLoadoutModel.test.js
//
// Build A2 — the hub's loadout cards and lines as data (boards 1–4): every card state, its tag and line, the lock's end
// in the hub's ET words, the Deploy line, the stage summary, the armory's context line and footnote. Pure.

import { describe, expect, it } from 'vitest';
import {
  CARD_STATE, LOCK_KIND, armoryContextOf, armoryFootnoteOf, bookSubOf, bookViewOf, deployLineOf, deriveLoadoutCards, lineOf,
  loadoutSummaryOf, lockWhenOf, runningBaggerbombOf, tagOf,
} from './perGameLoadoutModel';
import { LOADOUT_COPY } from '../../../constants/loadoutCopy';
import { armoryLines } from './archetypeLines';

const RANKED = Object.freeze({ id: 'ag-1', ownerId: 'u-1', archetype: 'contrarian', equippedWatchlistId: 'wl-ind', equippedWatchlistName: 'Industrials' });
const SLOT = Object.freeze({ archetype: 'degen', book: { ref: { watchlistId: 'wl-energy' }, name: 'Energy Movers', pin: null } });
const LISTS = [
  { watchlistId: 'wl-energy', name: 'Energy Movers', tickers: ['XOM', 'CVX', { symbol: 'OXY' }] },
  { watchlistId: 'wl-ind', name: 'Industrials', tickers: ['CAT', 'DE'] },
];
const OPEN = Object.freeze({ locked: false, groupId: null, status: null, endsAtMs: null });
const LOCKED = Object.freeze({ locked: true, groupId: 'g-1', status: 'battle', endsAtMs: Date.parse('2026-11-06T21:00:00.000Z') });
const LIVE_BB = (archetype = 'analyst') => ({ id: 'b-live', status: 'active', agentId: 'casual-agent-u-1', agentContext: { archetype } });
const name = (codeId) => armoryLines(codeId).name;

describe('the two cards', () => {
  it('BaggerBomb first: the slot\'s set and book, counted from the lists; League: the ranked fields', () => {
    const cards = deriveLoadoutCards({ agent: { ...RANKED, loadouts: { baggerbomb: SLOT } }, lock: OPEN, committed: LISTS });
    expect(cards.baggerbomb).toMatchObject({ kind: 'baggerbomb', game: 'BaggerBomb', archetype: 'degen', name: name('degen'), book: { id: 'wl-energy', name: 'Energy Movers', count: 3 }, state: CARD_STATE.NEXT, locked: false });
    expect(cards.league).toMatchObject({ kind: 'league', game: 'League', archetype: 'contrarian', name: name('contrarian'), book: { id: 'wl-ind', name: 'Industrials', count: 2 }, state: CARD_STATE.OPEN, locked: false });
  });

  it('no slot: BaggerBomb wears the default (the same set and book as League)', () => {
    const cards = deriveLoadoutCards({ agent: RANKED, lock: OPEN, committed: LISTS });
    expect(cards.baggerbomb.archetype).toBe('contrarian');
    expect(cards.baggerbomb.book.id).toBe('wl-ind');
  });

  it('a running BaggerBomb game: the strip wears the battle\'s own snapshot, not the slot', () => {
    const cards = deriveLoadoutCards({ agent: { ...RANKED, loadouts: { baggerbomb: SLOT } }, lock: OPEN, activeBattles: [LIVE_BB('analyst')], committed: LISTS });
    expect(cards.baggerbomb.state).toBe(CARD_STATE.RUNNING);
    expect(cards.baggerbomb.running).toEqual({ battleId: 'b-live', archetype: 'analyst', name: name('analyst') });
    expect(cards.baggerbomb.archetype).toBe('degen');
    // a League battle (it has a groupId) is not BaggerBomb's
    expect(runningBaggerbombOf([{ ...LIVE_BB(), groupId: 'g-1' }])).toBeNull();
  });

  it('no book: "No book · open market" — the only BaggerBomb state the line names before a running game', () => {
    const agent = { ...RANKED, loadouts: { baggerbomb: { archetype: 'degen', book: { ref: null, name: null, pin: null } } } };
    const cards = deriveLoadoutCards({ agent, lock: OPEN, activeBattles: [LIVE_BB()], committed: LISTS });
    expect(cards.baggerbomb.state).toBe(CARD_STATE.NOBOOK);
    expect(cards.baggerbomb.book).toEqual({ id: null, name: null, count: null });
    expect(lineOf(cards.baggerbomb)).toBe(LOADOUT_COPY.lines.nobook);
    expect(deployLineOf(cards)).toBe(`${name('degen')} · ${LOADOUT_COPY.noBook}`);
  });

  it('League locked: the lock and its end, in ET; checking until the read answers, and when it failed', () => {
    const locked = deriveLoadoutCards({ agent: RANKED, lock: LOCKED, committed: LISTS }).league;
    expect(locked).toMatchObject({ state: CARD_STATE.LOCKED, locked: true, when: 'Fri Nov 6', lockKind: LOCK_KIND.WEEK });
    expect(lineOf(locked)).toBe('Locked until the week is scored, after the close on Fri Nov 6.');
    const checking = deriveLoadoutCards({ agent: RANKED, lock: null, committed: LISTS }).league;
    expect(checking).toMatchObject({ state: CARD_STATE.CHECKING, locked: true, when: null });
    expect(deriveLoadoutCards({ agent: RANKED, lock: OPEN, lockFailed: true }).league.state).toBe(CARD_STATE.CHECKING);
    expect(lineOf(checking)).toBe(LOADOUT_COPY.lines.checking);
  });

  it('a lock with no end names none', () => {
    const league = deriveLoadoutCards({ agent: RANKED, lock: { ...LOCKED, endsAtMs: null } }).league;
    expect(league.when).toBeNull();
    expect(lineOf(league)).toBe(LOADOUT_COPY.lines.lockedUndated);
  });

  it('A2R-3 (a): a game on the ranked record locks League, undated, in its own words — whatever the week read says', () => {
    const agent = { ...RANKED, activeBattleId: 'b-ranked' };
    // the week open, still checking, or failed: the game on the ranked record holds it (the writers' `battle_active`)
    for (const [lock, lockFailed] of [[OPEN, false], [null, false], [OPEN, true]]) {
      const league = deriveLoadoutCards({ agent, lock, lockFailed, committed: LISTS }).league;
      expect(league).toMatchObject({ state: CARD_STATE.LOCKED, locked: true, when: null, lockKind: LOCK_KIND.BATTLE });
      expect(lineOf(league)).toBe('Locked while a game is running.');
      expect(tagOf(league).label).toBe(LOADOUT_COPY.tags.locked);
      expect(armoryContextOf(league)).toEqual({ title: 'Choosing armor for League', sub: 'locked while a game is running', locked: true });
    }
    // BaggerBomb never reads the ranked record's game: it runs on the clone
    expect(deriveLoadoutCards({ agent, lock: OPEN }).baggerbomb).toMatchObject({ locked: false, state: CARD_STATE.NEXT });
    // no game, no battle lock
    expect(deriveLoadoutCards({ agent: { ...RANKED, activeBattleId: null }, lock: OPEN, committed: LISTS }).league.state).toBe(CARD_STATE.OPEN);
  });

  it('A2R-3 (a): during a League game the week lock wins, so the card keeps its dated line (the writers read the week first)', () => {
    const league = deriveLoadoutCards({ agent: { ...RANKED, activeBattleId: 'b-league' }, lock: LOCKED, committed: LISTS }).league;
    expect(league).toMatchObject({ state: CARD_STATE.LOCKED, when: 'Fri Nov 6', lockKind: LOCK_KIND.WEEK });
    expect(lineOf(league)).toBe('Locked until the week is scored, after the close on Fri Nov 6.');
  });

  it('a book the lists have not answered for is named from the slot and counted later', () => {
    const view = bookViewOf(SLOT.book, null);
    expect(view).toEqual({ id: 'wl-energy', name: 'Energy Movers', count: null });
    expect(bookSubOf(view)).toBe(LOADOUT_COPY.bookUncounted);
    expect(bookSubOf({ ...view, count: 1 })).toBe('Book · 1 name');
  });

  it('no agent, no cards', () => {
    expect(deriveLoadoutCards({ agent: null })).toBeNull();
  });
});

describe('tags, lines, the Deploy line and the summary', () => {
  const cards = deriveLoadoutCards({ agent: { ...RANKED, loadouts: { baggerbomb: SLOT } }, lock: OPEN, committed: LISTS });

  it('one tag per card (board 7 #3): Locked and Checking pewter, No book gold, the rest teal', () => {
    expect(tagOf({ state: CARD_STATE.NEXT })).toEqual({ label: 'Next deploy', tone: 'teal', dim: false });
    expect(tagOf({ state: CARD_STATE.RUNNING })).toEqual({ label: 'Game running', tone: 'teal', dim: false });
    expect(tagOf({ state: CARD_STATE.OPEN })).toEqual({ label: 'Open', tone: 'teal', dim: false });
    expect(tagOf({ state: CARD_STATE.NOBOOK })).toEqual({ label: 'No book', tone: 'gold', dim: false });
    expect(tagOf({ state: CARD_STATE.LOCKED })).toEqual({ label: 'Locked', tone: 'teal', dim: true });
    expect(tagOf({ state: CARD_STATE.CHECKING }).dim).toBe(true);
  });

  it('the lines: next, running, open', () => {
    expect(lineOf(cards.baggerbomb)).toBe('The next deploy wears this.');
    expect(lineOf({ ...cards.baggerbomb, state: CARD_STATE.RUNNING, running: { name: 'Trend Follower' } })).toBe('The running game keeps the Trend Follower. The next deploy wears what you set here.');
    expect(lineOf(cards.league)).toBe('Open until you register for next week. It locks then.');
  });

  it('the Deploy line and the stage summary name what the next deploy carries and both loadouts', () => {
    expect(deployLineOf(cards)).toBe(`${name('degen')} · Energy Movers`);
    expect(loadoutSummaryOf(cards)).toBe(`BaggerBomb · ${name('degen')} · League · ${name('contrarian')}`);
  });
});

describe('the armory\'s context (board 4)', () => {
  it('BaggerBomb: "applies to the next deploy"; the footnote is FD-1\'s', () => {
    const { baggerbomb } = deriveLoadoutCards({ agent: RANKED, lock: OPEN });
    expect(armoryContextOf(baggerbomb)).toEqual({ title: 'Choosing armor for BaggerBomb', sub: 'applies to the next deploy', locked: false });
    expect(armoryFootnoteOf(baggerbomb)).toBe('Applies to the next deploy · a game already running keeps the armor it deployed with.');
  });

  it('League open, locked, and checking', () => {
    expect(armoryContextOf(deriveLoadoutCards({ agent: RANKED, lock: OPEN }).league)).toEqual({ title: 'Choosing armor for League', sub: 'open · locks when you register', locked: false });
    expect(armoryContextOf(deriveLoadoutCards({ agent: RANKED, lock: LOCKED }).league)).toEqual({ title: 'Choosing armor for League', sub: 'locked until the week is scored, after the close on Fri Nov 6', locked: true });
    expect(armoryContextOf(deriveLoadoutCards({ agent: RANKED, lock: null }).league).locked).toBe(true);
  });

  it('the context line names the game it sets, never the other one', () => {
    const cards = deriveLoadoutCards({ agent: RANKED, lock: OPEN });
    expect(armoryContextOf(cards.baggerbomb).title).not.toMatch(/League/);
    expect(armoryContextOf(cards.league).title).not.toMatch(/BaggerBomb/);
  });
});

describe('the lock\'s end, in the hub\'s ET words', () => {
  it('weekday, month and day, the date only (ruling Q3): the lock outlasts the close it names', () => {
    expect(lockWhenOf(Date.parse('2026-11-06T21:00:00.000Z'))).toBe('Fri Nov 6');
    expect(lockWhenOf(Date.parse('2026-11-27T18:00:00.000Z'))).toBe('Fri Nov 27');
    // read in ET: 01:00 UTC on Sat Nov 7 is still Fri Nov 6 in New York
    expect(lockWhenOf(Date.parse('2026-11-07T01:00:00.000Z'))).toBe('Fri Nov 6');
    expect(lockWhenOf(null)).toBeNull();
    expect(lockWhenOf(Number.NaN)).toBeNull();
  });
});
