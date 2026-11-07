// api/_utils/perGameLoadout.test.js
//
// Build A2 — the server's half of the per-game loadout: the lock read inside a transaction, the typed refusal, the
// slot writes and the BaggerBomb loadout applied over a clone's fields; and the model's anchor rule held to the
// writer's own (deriveBattleStartWeek), so the lock's end and the pod's real week cannot drift.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): this file's real import of perGameLoadout.js (whose graph pulls
// src/constants/perGameLoadout.js → leagueTournament.js and src/utils/marketCalendar.js) IS the runtime guard that the
// api/ → src/ surface stays Node-clean. Never mock it.

import { describe, expect, it } from 'vitest';
import {
  LEAGUE_LOCKED,
  applyBaggerbombLoadout,
  baggerbombSlotWith,
  isRankedAgentDoc,
  leagueLockedBody,
  leagueLockedError,
  materializeOnLeagueWrite,
  readLeagueLockInTx,
  slotUpdate,
} from './perGameLoadout.js';
import { battleAnchorEtDateFromInstant, bookFrom } from '../../src/constants/perGameLoadout.js';
import { deriveBattleStartWeek } from './liveDraftFormation.js';
import { GROUP_STATUS, TOURNAMENT_GROUPS_COLLECTION } from '../../src/constants/leagueTournament.js';

const RANKED = Object.freeze({ ownerId: 'u1', archetype: 'contrarian', equippedWatchlistId: 'wl-ind', equippedWatchlistName: 'Industrials' });
const SLOT = Object.freeze({ archetype: 'degen', book: { ref: { watchlistId: 'wl-energy' }, name: 'Energy Movers', pin: null } });

/** A db whose groups collection answers the member-scoped query, recording every query it was asked. */
function groupsDb(groups) {
  const asked = [];
  const db = {
    collection: (name) => ({
      where: (field, op, value) => {
        asked.push({ name, field, op, value });
        return { __query: true, docs: groups.filter((g) => (g.groupMembers || []).includes(value)) };
      },
    }),
  };
  const tx = { get: async (q) => ({ docs: q.docs.map((g) => ({ id: g.id, data: () => g })) }) };
  return { db, tx, asked };
}

describe('the lock read inside a writer\'s transaction (FD-3)', () => {
  it('asks the member-scoped query on tournamentGroups (an automatic single-field index) and judges it by leagueLockOf', async () => {
    const { db, tx, asked } = groupsDb([
      { id: 'old', status: GROUP_STATUS.COMPLETE, groupMembers: ['u1'], updatedAt: '2026-10-30' },
      { id: 'now', status: GROUP_STATUS.BATTLE, groupMembers: ['u1', 'u2'], updatedAt: '2026-11-04', startAnchor: { anchorEtDate: '2026-11-02' } },
      { id: 'other', status: GROUP_STATUS.BATTLE, groupMembers: ['u9'], updatedAt: '2026-11-05' },
    ]);
    const lock = await readLeagueLockInTx(tx, db, 'u1');
    expect(asked).toEqual([{ name: TOURNAMENT_GROUPS_COLLECTION, field: 'groupMembers', op: 'array-contains', value: 'u1' }]);
    expect(lock).toEqual({ locked: true, groupId: 'now', status: GROUP_STATUS.BATTLE, endsAtMs: Date.parse('2026-11-06T21:00:00.000Z') });
  });

  it('a training pod in flight does not lock it', async () => {
    const { db, tx } = groupsDb([{ id: 'pod', status: GROUP_STATUS.BATTLE, isTraining: true, groupMembers: ['u1'] }]);
    expect((await readLeagueLockInTx(tx, db, 'u1')).locked).toBe(false);
  });

  it('the typed refusal names the lock and its end; the error carries the lock to the response', () => {
    const lock = { locked: true, groupId: 'now', status: 'battle', endsAtMs: Date.parse('2026-11-06T21:00:00.000Z') };
    const err = leagueLockedError('__x:', lock);
    expect(err.message).toBe(`__x:${LEAGUE_LOCKED}`);
    expect(err.lock).toBe(lock);
    expect(leagueLockedBody(lock)).toEqual({
      error: 'league_locked',
      message: expect.stringMatching(/League/),
      lock: { kind: 'league_week', groupId: 'now', status: 'battle', endsAt: '2026-11-06T21:00:00.000Z' },
    });
    expect(leagueLockedBody({ ...lock, endsAtMs: null }).lock.endsAt).toBeNull();
  });
});

describe('the slot writes', () => {
  it('only the ranked record holds the slot', () => {
    expect(isRankedAgentDoc(RANKED)).toBe(true);
    expect(isRankedAgentDoc({ ...RANKED, isCasualClone: true })).toBe(false);
    expect(isRankedAgentDoc({ ...RANKED, isTrainingClone: true })).toBe(false);
    expect(isRankedAgentDoc(null)).toBe(false);
  });

  it('a slot update keeps any other loadout in the map', () => {
    expect(slotUpdate({ loadouts: { future: { x: 1 } } }, SLOT)).toEqual({ loadouts: { future: { x: 1 }, baggerbomb: SLOT } });
    expect(slotUpdate(RANKED, SLOT)).toEqual({ loadouts: { baggerbomb: SLOT } });
  });

  it('a League write snapshots the slot from the PRE-change fields while it is absent, and adds nothing once it exists', () => {
    expect(materializeOnLeagueWrite(RANKED)).toEqual({ loadouts: { baggerbomb: { archetype: 'contrarian', book: bookFrom('wl-ind', 'Industrials') } } });
    expect(materializeOnLeagueWrite({ ...RANKED, loadouts: { baggerbomb: SLOT } })).toEqual({});
  });

  it('a BaggerBomb write replaces the archetype or the book, starting from the slot or its snapshot', () => {
    expect(baggerbombSlotWith(RANKED, { archetype: 'analyst' })).toEqual({ archetype: 'analyst', book: bookFrom('wl-ind', 'Industrials') });
    expect(baggerbombSlotWith({ ...RANKED, loadouts: { baggerbomb: SLOT } }, { book: bookFrom(null) })).toEqual({ archetype: 'degen', book: bookFrom(null) });
  });
});

describe('the BaggerBomb loadout over a clone\'s inherited fields', () => {
  const inherited = { archetype: 'contrarian', equippedWatchlistId: 'wl-ind', equippedWatchlistName: 'Industrials', config: { risk: 1 } };

  it('the default passes the fields unchanged (the same object)', () => {
    expect(applyBaggerbombLoadout(inherited, RANKED)).toBe(inherited);
  });

  it('a slot puts its archetype and book in place; everything else is inherited', () => {
    expect(applyBaggerbombLoadout(inherited, { ...RANKED, loadouts: { baggerbomb: SLOT } })).toEqual({
      archetype: 'degen', equippedWatchlistId: 'wl-energy', equippedWatchlistName: 'Energy Movers', config: { risk: 1 },
    });
  });

  it('a slot with no book deploys with no list (the open market: decide.js reads nothing)', () => {
    const noBook = { ...RANKED, loadouts: { baggerbomb: { archetype: 'degen', book: bookFrom(null) } } };
    expect(applyBaggerbombLoadout(inherited, noBook)).toMatchObject({ archetype: 'degen', equippedWatchlistId: null, equippedWatchlistName: null });
  });
});

describe('the lock\'s end reads the pod\'s week as its writer does', () => {
  it('battleAnchorEtDateFromInstant agrees with deriveBattleStartWeek at every half hour of three weeks (a holiday, both DST edges)', () => {
    const windows = [
      ['2026-08-31T04:00:00.000Z', 'Labor Day week'],
      ['2026-10-26T04:00:00.000Z', 'the DST change (Nov 1)'],
      ['2026-11-20T05:00:00.000Z', 'Thanksgiving week'],
    ];
    let checked = 0;
    for (const [start] of windows) {
      const t0 = Date.parse(start);
      for (let i = 0; i < 7 * 48 * 2; i++) {
        const at = t0 + i * 30 * 60 * 1000;
        expect(battleAnchorEtDateFromInstant(at), new Date(at).toISOString()).toBe(deriveBattleStartWeek(new Date(at).toISOString()).anchorEtDate);
        checked += 1;
      }
    }
    expect(checked).toBe(3 * 7 * 48 * 2);
  });
});
