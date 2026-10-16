// src/components/Dashboard/deployCeremony/existingBattle.test.js
//
// Command Center repair R1 (ruling R-R1-2) — the owned server document behind
// an `existing_battle` result: the id the server named, owned by the signed-in
// uid, from the shell's live list (never the local-origin optimistic entry) or
// the target-scoped verifier. Anything else is unavailable, never a creation.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// The module's default readers are never used here; every row injects its own.
vi.mock('../../../services/agentBattleVerify', () => ({ findActiveBattleForAgent: vi.fn(), default: vi.fn() }));
vi.mock('../../../firebase/authService', () => ({ getIdToken: vi.fn(), getCurrentUser: () => null }));

const { ownsExistingBattle, resolveExistingBattle, openExistingBattleDirectly } = await import('./existingBattle');

const ID = 'battle-running';
const OWNED = { id: ID, ownerId: 'uid-A', status: 'active', agentId: 'casual-agent-uid-A' };

beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}); });

describe('ownsExistingBattle', () => {
  it('the named document, owned by the uid', () => { expect(ownsExistingBattle(OWNED, ID, 'uid-A')).toBe(true); });
  it.each([
    ['another owner', OWNED, ID, 'uid-B'],
    ['another battle', { ...OWNED, id: 'battle-other' }, ID, 'uid-A'],
    ['no uid', OWNED, ID, null],
    ['an empty uid', { ...OWNED, ownerId: '' }, ID, ''],
    ['no document', null, ID, 'uid-A'],
    ['no named id', OWNED, null, 'uid-A'],
    ['a padded named id', OWNED, ` ${ID} `, 'uid-A'],
    ['a document with no owner', { id: ID }, ID, 'uid-A'],
  ])('%s → false', (_label, battle, id, uid) => {
    expect(ownsExistingBattle(battle, id, uid)).toBe(false);
  });
});

describe('resolveExistingBattle', () => {
  it('the shell\'s live list first: an owned server document with the id, no read', async () => {
    const verify = vi.fn();
    expect(await resolveExistingBattle({ existingBattleId: ID, uid: 'uid-A', liveBattles: [{ id: 'x', ownerId: 'uid-A', status: 'active' }, OWNED], verify }))
      .toEqual({ status: 'found', battle: OWNED });
    expect(verify).not.toHaveBeenCalled();
  });

  it('the local-origin optimistic entry is not a server document: the verifier is asked instead', async () => {
    const verify = vi.fn(async () => ({ found: true, battle: OWNED }));
    const local = { ...OWNED, localOrigin: true, portfolio: { star: ['LOCAL'] } };
    const r = await resolveExistingBattle({ existingBattleId: ID, uid: 'uid-A', liveBattles: [local], verify });
    expect(r.battle).toBe(OWNED);
    expect(verify).toHaveBeenCalledTimes(1);
  });

  it('a listed LEAGUE battle the server named is the running game: found from the list (review L3-1)', async () => {
    const league = { ...OWNED, groupId: 'group-77', gameMode: 'baggerbomb_tournament' };
    const verify = vi.fn(async () => ({ found: false, battle: null }));
    expect(await resolveExistingBattle({ existingBattleId: ID, uid: 'uid-A', liveBattles: [league], verify })).toEqual({ status: 'found', battle: league });
    expect(verify).not.toHaveBeenCalled();
  });

  it('a listed battle that is not active is skipped', async () => {
    const verify = vi.fn(async () => ({ found: false, battle: null }));
    expect((await resolveExistingBattle({ existingBattleId: ID, uid: 'uid-A', liveBattles: [{ ...OWNED, status: 'completed' }], verify })).status).toBe('unavailable');
  });

  it('a listed battle of another owner is skipped', async () => {
    const verify = vi.fn(async () => ({ found: false, battle: null }));
    expect((await resolveExistingBattle({ existingBattleId: ID, uid: 'uid-A', liveBattles: [{ ...OWNED, ownerId: 'uid-B' }], verify })).status).toBe('unavailable');
    expect(verify).toHaveBeenCalledTimes(1);
  });

  it('the verifier\'s owned document with the id → found', async () => {
    expect(await resolveExistingBattle({ existingBattleId: ID, uid: 'uid-A', liveBattles: [], verify: async () => ({ found: true, battle: OWNED }) }))
      .toEqual({ status: 'found', battle: OWNED });
  });

  it.each([
    ['another battle', async () => ({ found: true, battle: { ...OWNED, id: 'battle-other' } })],
    ['another owner', async () => ({ found: true, battle: { ...OWNED, ownerId: 'uid-B' } })],
    ['nothing found', async () => ({ found: false, battle: null })],
    ['a broken answer', async () => null],
    ['a throw', async () => { throw new Error('offline'); }],
  ])('the verifier gives %s → unavailable', async (_label, verify) => {
    expect(await resolveExistingBattle({ existingBattleId: ID, uid: 'uid-A', liveBattles: null, verify }))
      .toEqual({ status: 'unavailable', battle: null });
  });

  it('no uid or no named id → unavailable without a read', async () => {
    const verify = vi.fn(async () => ({ found: true, battle: OWNED }));
    expect((await resolveExistingBattle({ existingBattleId: ID, uid: null, liveBattles: [OWNED], verify })).status).toBe('unavailable');
    expect((await resolveExistingBattle({ existingBattleId: '', uid: 'uid-A', liveBattles: [OWNED], verify })).status).toBe('unavailable');
    expect(verify).not.toHaveBeenCalled();
  });

  it('no verifier wired → unavailable', async () => {
    expect((await resolveExistingBattle({ existingBattleId: ID, uid: 'uid-A', liveBattles: [], verify: null })).status).toBe('unavailable');
  });
});

describe('openExistingBattleDirectly (ceremony off)', () => {
  it('opens the owned document, asking the verifier for the deploy target', async () => {
    const onOpen = vi.fn();
    const verify = vi.fn(async () => ({ found: true, battle: OWNED }));
    expect(await openExistingBattleDirectly({ existingBattleId: ID, targetAgentId: 'casual-agent-uid-A', liveBattles: [], onOpen, verify, currentUid: () => 'uid-A' })).toBe(true);
    expect(verify).toHaveBeenCalledWith('casual-agent-uid-A');
    expect(onOpen).toHaveBeenCalledWith(OWNED);
  });

  it('the owner is read again immediately before the open: a switch in between opens nothing', async () => {
    const onOpen = vi.fn();
    const uids = ['uid-A', 'uid-B'];
    expect(await openExistingBattleDirectly({
      existingBattleId: ID, targetAgentId: 't', liveBattles: [OWNED], onOpen, verify: vi.fn(), currentUid: () => uids.shift() ?? null,
    })).toBe(false);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('an unavailable document opens nothing', async () => {
    const onOpen = vi.fn();
    expect(await openExistingBattleDirectly({ existingBattleId: ID, targetAgentId: 't', liveBattles: [], onOpen, verify: async () => ({ found: false, battle: null }), currentUid: () => 'uid-A' })).toBe(false);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('an open that throws resolves false instead of rejecting', async () => {
    await expect(openExistingBattleDirectly({
      existingBattleId: ID, targetAgentId: 't', liveBattles: [OWNED], onOpen: () => { throw new Error('nav'); }, verify: vi.fn(), currentUid: () => 'uid-A',
    })).resolves.toBe(false);
  });
});
