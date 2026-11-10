// src/constants/perGameLoadout.test.js
//
// Build A2 — the per-game loadout model (rulings D1, FD-2, FD-3, FD-11): the `loadout` field, the book, the BaggerBomb
// slot and its default, both loadouts' archetypes, and the League lock with its end. Pure, so every case is a value.

import { describe, expect, it } from 'vitest';
import {
  LOADOUT_KINDS,
  LEAGUE_LOCK_STATUSES,
  baggerbombLoadoutOf,
  baggerbombSlotOf,
  battleAnchorEtDateOf,
  bookFrom,
  bookIdOf,
  formatLockDay,
  formatLockDayIso,
  leagueLoadoutOf,
  leagueLockOf,
  leagueLockOfGroup,
  leagueWeekEndMsOf,
  loadoutArchetypesOf,
  loadoutKindOf,
  materializeBaggerbombSlot,
} from './perGameLoadout.js';
import { GROUP_STATUS, selectMyGroup } from './leagueTournament.js';

const RANKED = Object.freeze({ archetype: 'contrarian', equippedWatchlistId: 'wl-ind', equippedWatchlistName: 'Industrials' });
const SLOT = Object.freeze({ archetype: 'degen', book: { ref: { watchlistId: 'wl-energy' }, name: 'Energy Movers', pin: null } });

describe('the `loadout` field', () => {
  it('absent is the League loadout (today\'s behaviour); the two words are themselves; anything else is refused', () => {
    expect(loadoutKindOf(undefined)).toBe(LOADOUT_KINDS.LEAGUE);
    expect(loadoutKindOf(null)).toBe(LOADOUT_KINDS.LEAGUE);
    expect(loadoutKindOf('baggerbomb')).toBe('baggerbomb');
    expect(loadoutKindOf('league')).toBe('league');
    for (const bad of ['', 'BaggerBomb', 'training', 1, {}, ['league']]) expect(loadoutKindOf(bad)).toBeNull();
  });
});

describe('the book: a reference and its name, never the names inside it', () => {
  it('a list is { ref: { watchlistId }, name, pin: null }; no list is the open market', () => {
    expect(bookFrom('wl-1', 'Tech')).toEqual({ ref: { watchlistId: 'wl-1' }, name: 'Tech', pin: null });
    expect(bookFrom(null, 'ignored')).toEqual({ ref: null, name: null, pin: null });
    expect(bookFrom('  ', 'x')).toEqual({ ref: null, name: null, pin: null });
    expect(bookIdOf(bookFrom('wl-1', 'Tech'))).toBe('wl-1');
    expect(bookIdOf(bookFrom(null))).toBeNull();
  });
});

describe('the two loadouts (FD-2, FD-11)', () => {
  it('League is the ranked record\'s own fields', () => {
    expect(leagueLoadoutOf(RANKED)).toEqual({ archetype: 'contrarian', book: bookFrom('wl-ind', 'Industrials') });
  });

  it('BaggerBomb is the default (the same fields) while the slot is absent, and says so', () => {
    expect(baggerbombSlotOf(RANKED)).toBeNull();
    expect(baggerbombLoadoutOf(RANKED)).toEqual({ ...leagueLoadoutOf(RANKED), isDefault: true });
    expect(materializeBaggerbombSlot(RANKED)).toEqual(leagueLoadoutOf(RANKED));
  });

  it('with a slot, BaggerBomb is the slot and League is untouched by it', () => {
    const agent = { ...RANKED, loadouts: { baggerbomb: SLOT } };
    expect(baggerbombLoadoutOf(agent)).toEqual({ archetype: 'degen', book: bookFrom('wl-energy', 'Energy Movers'), isDefault: false });
    expect(leagueLoadoutOf(agent)).toEqual(leagueLoadoutOf(RANKED));
  });

  it('a slot with no book is "No book · open market", not the default', () => {
    const agent = { ...RANKED, loadouts: { baggerbomb: { archetype: 'degen', book: { ref: null, name: null, pin: null } } } };
    expect(baggerbombLoadoutOf(agent)).toEqual({ archetype: 'degen', book: bookFrom(null), isDefault: false });
  });

  it('an unreadable slot reads as absent (the default), never as a half loadout', () => {
    for (const slot of [null, 'degen', {}, { archetype: '' }, { archetype: 7 }]) {
      expect(baggerbombLoadoutOf({ ...RANKED, loadouts: { baggerbomb: slot } }).isDefault).toBe(true);
    }
  });

  it('both loadouts\' archetypes, each once (the ledger\'s active set)', () => {
    expect(loadoutArchetypesOf(RANKED)).toEqual(['contrarian']);
    expect(loadoutArchetypesOf({ ...RANKED, loadouts: { baggerbomb: SLOT } })).toEqual(['contrarian', 'degen']);
    expect(loadoutArchetypesOf({})).toEqual([]);
  });
});

// ── The League lock (FD-3) ──────────────────────────────────────────────────────────────────────────────────────────

const group = (status, extra = {}) => ({ id: `g-${status}`, status, groupMembers: ['u1'], updatedAt: '2026-11-04T12:00:00.000Z', ...extra });

describe('the League lock: a ranked group in any state before COMPLETE, EXPIRED or VOIDED', () => {
  it('is exactly selectMyGroup\'s allowlist', () => {
    expect(LEAGUE_LOCK_STATUSES).toEqual([GROUP_STATUS.FORMING, GROUP_STATUS.DRAFTING, GROUP_STATUS.AWAITING_OPEN, GROUP_STATUS.BATTLE]);
    for (const status of Object.values(GROUP_STATUS)) {
      expect(leagueLockOf([group(status)]).locked, status).toBe(selectMyGroup([group(status)]) !== null);
    }
  });

  it.each([
    ['registered (forming)', GROUP_STATUS.FORMING, true],
    ['drafting', GROUP_STATUS.DRAFTING, true],
    ['awaiting the open', GROUP_STATUS.AWAITING_OPEN, true],
    ['in battle', GROUP_STATUS.BATTLE, true],
    ['complete', GROUP_STATUS.COMPLETE, false],
    ['expired', GROUP_STATUS.EXPIRED, false],
    ['voided', GROUP_STATUS.VOIDED, false],
  ])('%s → locked %s', (_label, status, locked) => {
    const lock = leagueLockOf([group(status)]);
    expect(lock.locked).toBe(locked);
    expect(lock.groupId).toBe(locked ? `g-${status}` : null);
  });

  it('a training pod never locks it, in any state (its clone copied the loadout once)', () => {
    for (const status of LEAGUE_LOCK_STATUSES) {
      expect(leagueLockOf([group(status, { isTraining: true })]).locked).toBe(false);
    }
  });

  it('no group, or only finished ones, is open; a new registration beside an old week locks it again', () => {
    expect(leagueLockOf([])).toEqual({ locked: false, groupId: null, status: null, endsAtMs: null });
    expect(leagueLockOf(null).locked).toBe(false);
    expect(leagueLockOf([group(GROUP_STATUS.COMPLETE), group(GROUP_STATUS.FORMING)]).groupId).toBe('g-forming');
  });

  it('leagueLockOfGroup is the same rule over subscribeMyGroup\'s answer', () => {
    const docs = [group(GROUP_STATUS.BATTLE, { startAnchor: { anchorEtDate: '2026-11-02' } })];
    expect(leagueLockOfGroup(selectMyGroup(docs))).toEqual(leagueLockOf(docs));
    expect(leagueLockOfGroup(null).locked).toBe(false);
  });
});

describe('when the League week ends: the close of the fifth trading day from the pod\'s first battle day', () => {
  it('an ordinary week: Monday Nov 2 → Friday Nov 6, 4:00 PM ET (EST: 21:00 UTC)', () => {
    const g = group(GROUP_STATUS.BATTLE, { startAnchor: { anchorEtDate: '2026-11-02' } });
    expect(new Date(leagueWeekEndMsOf(g)).toISOString()).toBe('2026-11-06T21:00:00.000Z');
    expect(leagueLockOf([g]).endsAtMs).toBe(leagueWeekEndMsOf(g));
  });

  it('a holiday Monday (Labor Day, Sep 7) walks past it: Tue Sep 8 → the fifth trading day, Mon Sep 14 at the close (EDT)', () => {
    const g = group(GROUP_STATUS.FORMING, { battleStartWeek: { mondayEtDate: '2026-09-07', anchorEtDate: '2026-09-08' } });
    expect(new Date(leagueWeekEndMsOf(g)).toISOString()).toBe('2026-09-14T20:00:00.000Z');
  });

  it('an early close on the last day ends at 1:00 PM ET (the day after Thanksgiving)', () => {
    const g = group(GROUP_STATUS.BATTLE, { startAnchor: { anchorEtDate: '2026-11-20' } });
    expect(new Date(leagueWeekEndMsOf(g)).toISOString()).toBe('2026-11-27T18:00:00.000Z');
  });

  it('the anchor is read from the BATTLE handoff, then the first banked day, then the claim, then the formation instant', () => {
    expect(battleAnchorEtDateOf({ startAnchor: { anchorEtDate: '2026-11-02' }, dailyScores: { day1: { recordedDate: '2026-11-09' } } })).toBe('2026-11-02');
    expect(battleAnchorEtDateOf({ dailyScores: { day1: { recordedDate: '2026-11-09' } }, battleStartWeek: { anchorEtDate: '2026-11-16' } })).toBe('2026-11-09');
    expect(battleAnchorEtDateOf({ battleStartWeek: { anchorEtDate: '2026-11-16' }, createdAt: '2026-11-04T15:00:00.000Z' })).toBe('2026-11-16');
    // A lobby pod formed Wednesday Nov 4 battles the upcoming Monday, Nov 9.
    expect(battleAnchorEtDateOf({ createdAt: '2026-11-04T15:00:00.000Z' })).toBe('2026-11-09');
    // A Firestore timestamp reads the same.
    expect(battleAnchorEtDateOf({ createdAt: { seconds: Date.parse('2026-11-04T15:00:00.000Z') / 1000, nanoseconds: 0 } })).toBe('2026-11-09');
  });

  it('nothing readable, or a week outside the calendar\'s maintained years, names no end (the lock still holds)', () => {
    expect(leagueWeekEndMsOf({})).toBeNull();
    expect(leagueWeekEndMsOf({ startAnchor: { anchorEtDate: '2031-01-06' } })).toBeNull();
    const lock = leagueLockOf([group(GROUP_STATUS.FORMING)]);
    expect(lock.locked).toBe(true);
    expect(lock.endsAtMs).toBeNull();
  });
});

describe("the lock's day in words (ruling Q3): the date only, read in ET", () => {
  it("the week's last close, its day: 'Fri Nov 6', the server's ISO end the same", () => {
    expect(formatLockDay(Date.parse('2026-11-06T21:00:00.000Z'))).toBe('Fri Nov 6');
    expect(formatLockDayIso('2026-11-06T21:00:00.000Z')).toBe('Fri Nov 6');
    // the early close (1:00 PM ET) names its day too; nothing here says a time
    expect(formatLockDay(Date.parse('2026-11-27T18:00:00.000Z'))).toBe('Fri Nov 27');
    expect(formatLockDay(leagueWeekEndMsOf(group(GROUP_STATUS.BATTLE, { startAnchor: { anchorEtDate: '2026-11-02' } })))).not.toMatch(/:|PM|AM/);
  });

  it('no end, no day', () => {
    for (const v of [null, undefined, Number.NaN, '2026-11-06']) expect(formatLockDay(v)).toBeNull();
    for (const v of [null, 'not a date', 0]) expect(formatLockDayIso(v)).toBeNull();
  });
});
