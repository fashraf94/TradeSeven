// src/services/ownedBattleRead.test.js
//
// Command Center slice S2b — the owned targeted read's own contract (ruling
// R-S2b-5): one server read of the battle by id; the owner is checked here, so a
// document that is not `uid`'s is no answer. The provider re-checks the owner
// too, which is why this contract had no row of its own until the independent
// review's mutating lens (M33; finding FRB-9, recorded) planted a mutant here
// and nothing failed.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({ snap: null, error: null, calls: [] }));
vi.mock('firebase/firestore', () => ({
  doc: (_db, collection, id) => ({ collection, id }),
  getDocFromServer: async (ref) => {
    h.calls.push(ref);
    if (h.error) throw h.error;
    return h.snap;
  },
}));
vi.mock('../firebase/config', () => ({ db: {} }));

import { readOwnedBattle } from './ownedBattleRead';

const snapOf = (id, data) => ({ id, exists: () => data !== null, data: () => data });

beforeEach(() => {
  h.snap = null;
  h.error = null;
  h.calls = [];
});

describe('readOwnedBattle — the owner is checked here (review M33, FRB-9)', () => {
  it('the owner\'s document comes back with its id, read from the server by that id', async () => {
    h.snap = snapOf('battle-1', { ownerId: 'uid-A', status: 'active' });
    await expect(readOwnedBattle('battle-1', 'uid-A')).resolves.toEqual({ id: 'battle-1', ownerId: 'uid-A', status: 'active' });
    expect(h.calls).toEqual([{ collection: 'agentBattles', id: 'battle-1' }]);
  });

  it('another owner\'s document is no answer: null', async () => {
    h.snap = snapOf('battle-1', { ownerId: 'uid-B', status: 'active' });
    await expect(readOwnedBattle('battle-1', 'uid-A')).resolves.toBeNull();
  });

  it('a document with no owner is no answer either', async () => {
    h.snap = snapOf('battle-1', { status: 'active' });
    await expect(readOwnedBattle('battle-1', 'uid-A')).resolves.toBeNull();
  });

  it('a missing document is null; a failed read throws (a refused read is not an absence)', async () => {
    h.snap = snapOf('battle-1', null);
    await expect(readOwnedBattle('battle-1', 'uid-A')).resolves.toBeNull();
    h.error = new Error('permission-denied');
    await expect(readOwnedBattle('battle-1', 'uid-A')).rejects.toThrow('permission-denied');
  });

  it('no real id or no uid reads nothing', async () => {
    for (const [id, uid] of [['', 'uid-A'], [' battle-1', 'uid-A'], [null, 'uid-A'], ['battle-1', ''], ['battle-1', null]]) {
      await expect(readOwnedBattle(id, uid)).resolves.toBeNull();
    }
    expect(h.calls).toEqual([]);
  });
});
