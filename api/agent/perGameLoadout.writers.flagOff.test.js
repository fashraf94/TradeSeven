// api/agent/perGameLoadout.writers.flagOff.test.js
//
// Build A2 — the three loadout writers with PER_GAME_LOADOUT_ENABLED FALSE (mocked so, explicitly, so these rows keep
// meaning "flag off" after the go-live flip; the shipped value's pin is perGameLoadoutFlags.test.js): a client that
// sends the new `loadout` field gets TODAY's behaviour exactly. The field is not read, so 'baggerbomb' writes the
// ranked record and keeps the battle lock; no slot is written; the groups collection is never queried; the response
// carries no `loadout` key. The writers' own suites (change-archetype.test.js, equip-watchlist.test.js) run flag off,
// unchanged, beside this.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeLoadoutWriterDb, makeReqRes } from '../_utils/__fixtures__/loadoutWriterDb.js';
import { GROUP_STATUS } from '../../src/constants/leagueTournament.js';

const { auth } = vi.hoisted(() => ({ auth: { current: { uid: 'u1' } } }));
let activeDb = null;

vi.mock('../../src/config/perGameLoadoutFlags.js', () => ({ PER_GAME_LOADOUT_ENABLED: false }));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => activeDb }));
vi.mock('../_utils/security.js', () => ({ applySecurityMiddleware: () => false }));
vi.mock('../_utils/authMiddleware.js', () => ({ requireAuth: async () => auth.current }));
vi.mock('../_utils/shadowLogger.js', () => ({ logSignalDrops: async () => {} }));
vi.mock('@vercel/functions', () => ({ waitUntil: (p) => p }));

const { default: changeArchetype } = await import('./change-archetype.js');
const { default: equipWatchlist } = await import('./equip-watchlist.js');
const { default: unequipWatchlist } = await import('./unequip-watchlist.js');

beforeEach(() => {
  activeDb = null;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

const RANKED = Object.freeze({ ownerId: 'u1', archetype: 'contrarian', equippedWatchlistId: 'wl-ind', equippedWatchlistName: 'Industrials', activeBattleId: null });
const LOCKING = { id: 'g-week', status: GROUP_STATUS.BATTLE, groupMembers: ['u1'], updatedAt: '2026-11-04' };

function setup(agent = RANKED) {
  const fx = makeLoadoutWriterDb({
    agentDocs: { 'agent-1': { ...agent } },
    watchlists: { 'wl-tech': { userId: 'u1', status: 'committed', name: 'Tech Leaders' } },
    groups: [LOCKING],
  });
  activeDb = fx.db;
  return fx;
}
async function call(handler, body) {
  const { req, res } = makeReqRes({ agentId: 'agent-1', ...body });
  await handler(req, res);
  return res;
}

describe('flag off: `loadout` is ignored — today\'s writers, exactly', () => {
  it.each(['baggerbomb', 'league', 'nonsense'])('change-archetype with loadout %s writes the ranked record, with no slot and no lock read', async (loadout) => {
    const fx = setup();
    const res = await call(changeArchetype, { archetype: 'guardian', loadout });
    expect(res.statusCode).toBe(200);
    expect(res.body.loadout).toBeUndefined();
    expect(fx.state.agentDocs['agent-1'].archetype).toBe('guardian');
    expect(fx.state.agentDocs['agent-1'].loadouts).toBeUndefined();
    expect(fx.state.queries).toEqual([]);
  });

  it('change-archetype with loadout baggerbomb still keeps today\'s battle lock (409 battle_active)', async () => {
    setup({ ...RANKED, activeBattleId: 'b-1' });
    const res = await call(changeArchetype, { archetype: 'guardian', loadout: 'baggerbomb' });
    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ error: 'battle_active', message: 'Cannot change archetype while the agent has an active battle.' });
  });

  it('equip-watchlist with loadout baggerbomb equips the ranked record, keeps the battle lock, writes no slot', async () => {
    let fx = setup();
    const res = await call(equipWatchlist, { watchlistId: 'wl-tech', loadout: 'baggerbomb' });
    expect(res.statusCode).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(['agentId', 'equippedAt', 'equippedWatchlistId', 'equippedWatchlistName', 'idempotent']);
    expect(fx.state.agentDocs['agent-1'].equippedWatchlistId).toBe('wl-tech');
    expect(fx.state.agentDocs['agent-1'].loadouts).toBeUndefined();
    expect(fx.state.queries).toEqual([]);
    fx = setup({ ...RANKED, activeBattleId: 'b-1' });
    expect((await call(equipWatchlist, { watchlistId: 'wl-tech', loadout: 'baggerbomb' })).body.error).toBe('battle_active');
  });

  it('unequip-watchlist with loadout baggerbomb clears the ranked record, keeps the battle lock, writes no slot', async () => {
    let fx = setup();
    const res = await call(unequipWatchlist, { loadout: 'baggerbomb' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ agentId: 'agent-1', equippedWatchlistId: null, idempotent: false });
    expect(fx.state.agentDocs['agent-1'].equippedWatchlistId).toBeNull();
    expect(fx.state.agentDocs['agent-1'].loadouts).toBeUndefined();
    expect(fx.state.queries).toEqual([]);
    fx = setup({ ...RANKED, activeBattleId: 'b-1' });
    expect((await call(unequipWatchlist, { loadout: 'baggerbomb' })).body.error).toBe('battle_active');
  });
});
