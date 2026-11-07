// api/agent/perGameLoadout.writers.test.js
//
// Build A2 — the three loadout writers with PER_GAME_LOADOUT_ENABLED on (rulings D1, FD-1, FD-2, FD-3, FD-11):
// change-archetype, equip-watchlist and unequip-watchlist, each by `loadout`. The flag is mocked ON here (its pin and
// the flag-off rows live in perGameLoadoutFlags.test.js and perGameLoadout.writers.flagOff.test.js; the writers'
// own suites run flag off, unchanged).
//
//   - 'baggerbomb': the slot only — no battle lock, no League lock, the ranked record's fields, traits and settingsRev
//     untouched; the slot snapshotted from the ranked fields on its first write.
//   - 'league' (and absent): the ranked record as today, refused while a ranked group holds the week (league_locked,
//     naming the lock's end) or the ranked record has a battle (battle_active); and, while the slot is absent, the slot
//     snapshotted from the PRE-change fields in the same update, so a League change never moves BaggerBomb.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeLoadoutWriterDb, makeReqRes } from '../_utils/__fixtures__/loadoutWriterDb.js';
import { ARCHETYPE_DEFAULT_TRAITS } from '../../src/data/traitLibrary.js';
import { GROUP_STATUS } from '../../src/constants/leagueTournament.js';

const { auth, logs } = vi.hoisted(() => ({ auth: { current: { uid: 'u1' } }, logs: { current: [] } }));
let activeDb = null;

vi.mock('../../src/config/perGameLoadoutFlags.js', () => ({ PER_GAME_LOADOUT_ENABLED: true }));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => activeDb }));
vi.mock('../_utils/security.js', () => ({ applySecurityMiddleware: () => false }));
vi.mock('../_utils/authMiddleware.js', () => ({ requireAuth: async () => auth.current }));
vi.mock('../_utils/shadowLogger.js', () => ({ logSignalDrops: async (r) => { logs.current.push(r); } }));
vi.mock('@vercel/functions', () => ({ waitUntil: (p) => p }));

const { default: changeArchetype } = await import('./change-archetype.js');
const { default: equipWatchlist } = await import('./equip-watchlist.js');
const { default: unequipWatchlist } = await import('./unequip-watchlist.js');

beforeEach(() => {
  auth.current = { uid: 'u1' };
  logs.current = [];
  activeDb = null;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

const RANKED = Object.freeze({
  ownerId: 'u1',
  archetype: 'contrarian',
  equippedWatchlistId: 'wl-ind',
  equippedWatchlistName: 'Industrials',
  equippedTraits: [{ traitId: 'old-trait' }],
  activeBattleId: null,
  settingsRev: 5,
});
const SLOT = Object.freeze({ archetype: 'degen', book: { ref: { watchlistId: 'wl-energy' }, name: 'Energy Movers', pin: null } });
const LISTS = {
  'wl-energy': { userId: 'u1', status: 'committed', name: 'Energy Movers' },
  'wl-tech': { userId: 'u1', status: 'committed', name: 'Tech Leaders' },
  'wl-draft': { userId: 'u1', status: 'draft', name: 'Draft' },
};
// A2R-2: the lock's query, read THROUGH the writer's transaction (tx.get), never around it
const LOCK_READ_IN_TX = Object.freeze({ query: { collection: 'tournamentGroups', field: 'groupMembers', op: 'array-contains', value: 'u1' } });
const LOCKING = { id: 'g-week', status: GROUP_STATUS.BATTLE, groupMembers: ['u1', 'cpu-1'], updatedAt: '2026-11-04', startAnchor: { anchorEtDate: '2026-11-02' } };

function setup({ agent = RANKED, groups = [] } = {}) {
  const fx = makeLoadoutWriterDb({ agentDocs: { 'agent-1': { ...agent } }, watchlists: { ...LISTS }, groups });
  activeDb = fx.db;
  return fx;
}
async function call(handler, body) {
  const { req, res } = makeReqRes({ agentId: 'agent-1', ...body });
  await handler(req, res);
  return res;
}

describe('change-archetype, loadout: baggerbomb (FD-1)', () => {
  it('writes the slot\'s archetype only, snapshotting the slot from the ranked fields on its first write', async () => {
    const fx = setup();
    const res = await call(changeArchetype, { archetype: 'degen', loadout: 'baggerbomb' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ agentId: 'agent-1', archetype: 'degen', idempotent: false, loadout: 'baggerbomb' });
    const agent = fx.state.agentDocs['agent-1'];
    expect(agent.loadouts.baggerbomb).toEqual({ archetype: 'degen', book: { ref: { watchlistId: 'wl-ind' }, name: 'Industrials', pin: null } });
    // The ranked record — the League loadout — is untouched: archetype, traits, book, settingsRev; no trait seed.
    expect(agent.archetype).toBe('contrarian');
    expect(agent.equippedTraits).toEqual([{ traitId: 'old-trait' }]);
    expect(agent.equippedWatchlistId).toBe('wl-ind');
    expect(agent.settingsRev).toBe(5);
    expect(fx.state.subcollections['agent-1']?.rules ?? []).toEqual([]);
    expect(logs.current).toEqual([expect.objectContaining({ stage: 'archetype_change', loadout: 'baggerbomb', fromArchetype: 'contrarian', toArchetype: 'degen' })]);
  });

  it('has no battle lock and no League lock: a running game and a locked week both leave it free', async () => {
    const fx = setup({ agent: { ...RANKED, activeBattleId: 'battle-live' }, groups: [LOCKING] });
    const res = await call(changeArchetype, { archetype: 'degen', loadout: 'baggerbomb' });
    expect(res.statusCode).toBe(200);
    expect(fx.state.agentDocs['agent-1'].loadouts.baggerbomb.archetype).toBe('degen');
    expect(fx.state.queries).toEqual([]);
  });

  it('a later change keeps the slot\'s book', async () => {
    const fx = setup({ agent: { ...RANKED, loadouts: { baggerbomb: SLOT } } });
    await call(changeArchetype, { archetype: 'analyst', loadout: 'baggerbomb' });
    expect(fx.state.agentDocs['agent-1'].loadouts.baggerbomb).toEqual({ ...SLOT, archetype: 'analyst' });
  });

  it('the archetype BaggerBomb already wears (the default included) is a no-op: no write, no slot, no log', async () => {
    const fx = setup();
    const res = await call(changeArchetype, { archetype: 'contrarian', loadout: 'baggerbomb' });
    expect(res.body.idempotent).toBe(true);
    expect(fx.state.writes).toEqual([]);
    expect(fx.state.agentDocs['agent-1'].loadouts).toBeUndefined();
    expect(logs.current).toEqual([]);
  });

  it('a clone document holds no loadout (409 not_ranked_agent)', async () => {
    const fx = setup({ agent: { ...RANKED, isCasualClone: true } });
    const res = await call(changeArchetype, { archetype: 'degen', loadout: 'baggerbomb' });
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('not_ranked_agent');
    expect(fx.state.writes).toEqual([]);
  });

  it('an unknown loadout is refused before any read (400)', async () => {
    const fx = setup();
    const res = await call(changeArchetype, { archetype: 'degen', loadout: 'training' });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('invalid_loadout');
    expect(fx.state.writes).toEqual([]);
  });
});

describe('change-archetype, loadout: league (FD-2, FD-3)', () => {
  it.each([['absent', {}], ['explicit', { loadout: 'league' }]])('%s: the ranked record changes as today, and the slot is snapshotted from the PRE-change fields first', async (_l, extra) => {
    const fx = setup();
    const res = await call(changeArchetype, { archetype: 'guardian', ...extra });
    expect(res.statusCode).toBe(200);
    const agent = fx.state.agentDocs['agent-1'];
    expect(agent.archetype).toBe('guardian');
    expect(agent.equippedTraits.map((t) => t.traitId)).toEqual(ARCHETYPE_DEFAULT_TRAITS.guardian);
    // BaggerBomb keeps what it wore: the League change never reaches it.
    expect(agent.loadouts.baggerbomb).toEqual({ archetype: 'contrarian', book: { ref: { watchlistId: 'wl-ind' }, name: 'Industrials', pin: null } });
    expect(res.body.loadout).toBeUndefined();
    // A2R-2: the lock was read through the transaction, before the write
    expect(fx.state.txReads).toContainEqual(LOCK_READ_IN_TX);
  });

  it('once the slot exists a League change leaves it alone', async () => {
    const fx = setup({ agent: { ...RANKED, loadouts: { baggerbomb: SLOT } } });
    await call(changeArchetype, { archetype: 'guardian' });
    expect(fx.state.agentDocs['agent-1'].loadouts.baggerbomb).toEqual(SLOT);
  });

  it('refused while the League week holds it (409 league_locked, naming the lock and its end), nothing written', async () => {
    const fx = setup({ groups: [LOCKING] });
    const res = await call(changeArchetype, { archetype: 'guardian', loadout: 'league' });
    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({
      error: 'league_locked',
      message: expect.any(String),
      lock: { kind: 'league_week', groupId: 'g-week', status: 'battle', endsAt: '2026-11-06T21:00:00.000Z' },
    });
    expect(fx.state.writes).toEqual([]);
    expect(fx.state.agentDocs['agent-1'].archetype).toBe('contrarian');
    expect(fx.state.queries).toEqual([{ collection: 'tournamentGroups', field: 'groupMembers', op: 'array-contains', value: 'u1' }]);
    expect(fx.state.txReads).toContainEqual(LOCK_READ_IN_TX);
  });

  it.each([
    ['registered (forming)', GROUP_STATUS.FORMING, 409],
    ['drafting', GROUP_STATUS.DRAFTING, 409],
    ['in battle', GROUP_STATUS.BATTLE, 409],
    ['complete', GROUP_STATUS.COMPLETE, 200],
    ['expired', GROUP_STATUS.EXPIRED, 200],
    ['voided', GROUP_STATUS.VOIDED, 200],
  ])('the week %s → %s', async (_l, status, code) => {
    setup({ groups: [{ ...LOCKING, status }] });
    expect((await call(changeArchetype, { archetype: 'guardian' })).statusCode).toBe(code);
  });

  it('a training pod in flight does not lock it', async () => {
    setup({ groups: [{ ...LOCKING, isTraining: true }] });
    expect((await call(changeArchetype, { archetype: 'guardian' })).statusCode).toBe(200);
  });

  it('a battle on the ranked record still refuses it (battle_active), as today', async () => {
    const fx = setup({ agent: { ...RANKED, activeBattleId: 'b-1' } });
    const res = await call(changeArchetype, { archetype: 'guardian' });
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('battle_active');
    expect(fx.state.writes).toEqual([]);
  });
});

describe('equip-watchlist by loadout', () => {
  it('baggerbomb: the slot\'s book only, no battle lock, no League lock; the ranked book untouched', async () => {
    const fx = setup({ agent: { ...RANKED, activeBattleId: 'battle-live' }, groups: [LOCKING] });
    const res = await call(equipWatchlist, { watchlistId: 'wl-energy', loadout: 'baggerbomb' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ agentId: 'agent-1', equippedWatchlistId: 'wl-energy', equippedWatchlistName: 'Energy Movers', idempotent: false, loadout: 'baggerbomb' });
    const agent = fx.state.agentDocs['agent-1'];
    expect(agent.loadouts.baggerbomb).toEqual({ archetype: 'contrarian', book: { ref: { watchlistId: 'wl-energy' }, name: 'Energy Movers', pin: null } });
    expect(agent.equippedWatchlistId).toBe('wl-ind');
    expect(agent.settingsRev).toBe(5);
    expect(fx.state.queries).toEqual([]);
  });

  it('baggerbomb: the same list checks (a draft list is refused) and the same list again is a no-op', async () => {
    const fx = setup({ agent: { ...RANKED, loadouts: { baggerbomb: SLOT } } });
    expect((await call(equipWatchlist, { watchlistId: 'wl-draft', loadout: 'baggerbomb' })).body.error).toBe('not_committed');
    const res = await call(equipWatchlist, { watchlistId: 'wl-energy', loadout: 'baggerbomb' });
    expect(res.body.idempotent).toBe(true);
    expect(fx.state.writes).toEqual([]);
  });

  it('league: as today, refused while the week holds it, and snapshotting the slot first', async () => {
    let fx = setup({ groups: [LOCKING] });
    const locked = await call(equipWatchlist, { watchlistId: 'wl-tech' });
    expect(locked.statusCode).toBe(409);
    expect(locked.body.lock.endsAt).toBe('2026-11-06T21:00:00.000Z');
    expect(fx.state.writes).toEqual([]);
    expect(fx.state.txReads).toContainEqual(LOCK_READ_IN_TX); // A2R-2
    fx = setup();
    const ok = await call(equipWatchlist, { watchlistId: 'wl-tech', loadout: 'league' });
    expect(ok.statusCode).toBe(200);
    const agent = fx.state.agentDocs['agent-1'];
    expect(agent.equippedWatchlistId).toBe('wl-tech');
    expect(agent.loadouts.baggerbomb.book.ref).toEqual({ watchlistId: 'wl-ind' });
    expect(fx.state.txReads).toContainEqual(LOCK_READ_IN_TX); // A2R-2: an admitted write read it in the transaction too
  });
});

describe('unequip-watchlist by loadout', () => {
  it('baggerbomb: "No book · open market" on the slot only, no locks; no book already is a no-op', async () => {
    const fx = setup({ agent: { ...RANKED, activeBattleId: 'battle-live', loadouts: { baggerbomb: SLOT } }, groups: [LOCKING] });
    const res = await call(unequipWatchlist, { loadout: 'baggerbomb' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ agentId: 'agent-1', equippedWatchlistId: null, idempotent: false, loadout: 'baggerbomb' });
    expect(fx.state.agentDocs['agent-1'].loadouts.baggerbomb).toEqual({ archetype: 'degen', book: { ref: null, name: null, pin: null } });
    expect(fx.state.agentDocs['agent-1'].equippedWatchlistId).toBe('wl-ind');
    expect((await call(unequipWatchlist, { loadout: 'baggerbomb' })).body.idempotent).toBe(true);
  });

  it('league: refused while the week holds it; otherwise cleared as today, the slot snapshotted first', async () => {
    let fx = setup({ groups: [LOCKING] });
    expect((await call(unequipWatchlist, {})).statusCode).toBe(409);
    expect(fx.state.writes).toEqual([]);
    expect(fx.state.txReads).toContainEqual(LOCK_READ_IN_TX); // A2R-2
    fx = setup();
    expect((await call(unequipWatchlist, { loadout: 'league' })).statusCode).toBe(200);
    const agent = fx.state.agentDocs['agent-1'];
    expect(agent.equippedWatchlistId).toBeNull();
    expect(agent.loadouts.baggerbomb.book.ref).toEqual({ watchlistId: 'wl-ind' });
    expect(fx.state.txReads).toContainEqual(LOCK_READ_IN_TX); // A2R-2
  });
});
