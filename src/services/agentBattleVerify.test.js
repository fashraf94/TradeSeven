// src/services/agentBattleVerify.test.js
//
// PR 2 §7 row 3 — "Query keys on `targetAgentId` — assert on the key itself, not
// just the outcome." These rows read the query that was BUILT, so a query that
// happens to return the right thing for the wrong reason still fails.
//
// The keys are a contract with the server's own write at
// `agentBattleService.js:130-132` (`agentId` / `ownerId` / `status: 'active'`)
// and with the `agentBattles` read rule in `firestore.rules`
// (`resource.data.ownerId == request.auth.uid`) — which is why `ownerId` is a
// QUERY KEY and not a post-filter: without it the read is refused outright, and a
// refused read is not a "no battle" answer.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { collectionMock, queryMock, whereMock, limitMock, getDocsMock, authState } = vi.hoisted(() => ({
  collectionMock: vi.fn((_db, name) => ({ __collection: name })),
  queryMock: vi.fn((...parts) => ({ __query: parts })),
  whereMock: vi.fn((field, op, value) => ({ __where: [field, op, value] })),
  limitMock: vi.fn((n) => ({ __limit: n })),
  getDocsMock: vi.fn(),
  authState: { currentUser: { uid: 'uid-1' } },
}));

vi.mock('firebase/firestore', () => ({
  collection: collectionMock,
  query: queryMock,
  where: whereMock,
  limit: limitMock,
  getDocs: getDocsMock,
}));
vi.mock('../firebase/config', () => ({ db: { __db: true }, auth: authState }));

const { findActiveBattleForAgent } = await import('./agentBattleVerify.js');

const CLONE = 'casual-agent-uid1';
const RANKED = 'agent-ranked-1';

// Every `where(...)` clause built during the call, as [field, op, value].
const clauses = () => whereMock.mock.calls.map(([f, o, v]) => [f, o, v]);

beforeEach(() => {
  collectionMock.mockClear();
  queryMock.mockClear();
  whereMock.mockClear();
  limitMock.mockClear();
  getDocsMock.mockReset();
  authState.currentUser = { uid: 'uid-1' };
});

describe('findActiveBattleForAgent — the query keys (§7 row 3)', () => {
  it('keys agentId on the id it was HANDED (the deploy target), not on anything re-derived', async () => {
    getDocsMock.mockResolvedValue({ empty: true, docs: [] });
    await findActiveBattleForAgent(CLONE);

    // The key itself — the assertion that reds when the caller reverts to the
    // ranked agent.id, and when the field name drifts from the server's write.
    expect(clauses()).toContainEqual(['agentId', '==', CLONE]);
    expect(clauses()).not.toContainEqual(['agentId', '==', RANKED]);
    expect(collectionMock).toHaveBeenCalledWith({ __db: true }, 'agentBattles');
  });

  it('scopes by ownerId and status, matching agentBattleService.js:130-132 and the read rule', async () => {
    getDocsMock.mockResolvedValue({ empty: true, docs: [] });
    await findActiveBattleForAgent(CLONE);
    expect(clauses()).toContainEqual(['ownerId', '==', 'uid-1']);
    expect(clauses()).toContainEqual(['status', '==', 'active']);
    expect(clauses()).toHaveLength(3);
    expect(limitMock).toHaveBeenCalledWith(1);
  });

  it('returns the found battle WITH its id, so the caller never needs activeBattleId', async () => {
    getDocsMock.mockResolvedValue({
      empty: false,
      docs: [{ id: 'battle-9', data: () => ({ agentId: CLONE, status: 'active', portfolio: { star: [] } }) }],
    });
    const out = await findActiveBattleForAgent(CLONE);
    expect(out.found).toBe(true);
    expect(out.battle.id).toBe('battle-9');
    expect(out.battle.status).toBe('active');
  });

  // `status: 'active'` is not the app's own predicate for "live": decide.js:718-728
  // treats a past expiresAt as not-live and only sweeps the doc to 'completed'
  // lazily, on the next deploy. Re-reading a WEAKER predicate than the app's would
  // let this check announce a FINISHED battle as the one the deploy just created —
  // and the whole authority of the check is that it is a direct re-read.
  // DIES UNDER: removing the expiry filter.
  it('an EXPIRED battle still stamped active is not a live battle', async () => {
    getDocsMock.mockResolvedValue({
      empty: false,
      docs: [{ id: 'battle-stale', data: () => ({
        agentId: CLONE, status: 'active', expiresAt: new Date(Date.now() - 60000).toISOString(),
      }) }],
    });
    await expect(findActiveBattleForAgent(CLONE)).resolves.toEqual({ found: false, battle: null });
  });

  it('a battle whose clock has NOT run out is still live', async () => {
    getDocsMock.mockResolvedValue({
      empty: false,
      docs: [{ id: 'battle-live', data: () => ({
        agentId: CLONE, status: 'active', expiresAt: new Date(Date.now() + 3600000).toISOString(),
      }) }],
    });
    const out = await findActiveBattleForAgent(CLONE);
    expect(out.found).toBe(true);
    expect(out.battle.id).toBe('battle-live');
  });

  // An unreadable clock is not evidence of expiry. Failing closed here would
  // discard real recoveries over a field shape, which is the opposite of the
  // filter's purpose.
  it.each([
    ['no expiresAt at all', undefined],
    ['an unparseable expiresAt', 'not-a-date'],
  ])('%s does not count as expired', async (_label, expiresAt) => {
    getDocsMock.mockResolvedValue({
      empty: false,
      docs: [{ id: 'battle-noclock', data: () => ({ agentId: CLONE, status: 'active', expiresAt }) }],
    });
    expect((await findActiveBattleForAgent(CLONE)).found).toBe(true);
  });

  // Firestore Timestamps and ISO strings both reach this code path depending on
  // the SDK surface that wrote the doc.
  it('a Firestore Timestamp expiresAt is honoured too', async () => {
    const past = new Date(Date.now() - 60000);
    getDocsMock.mockResolvedValue({
      empty: false,
      docs: [{ id: 'battle-ts', data: () => ({ agentId: CLONE, status: 'active', expiresAt: { toDate: () => past } }) }],
    });
    expect((await findActiveBattleForAgent(CLONE)).found).toBe(false);
  });

  it('an empty result is a real answer: found=false, no throw', async () => {
    getDocsMock.mockResolvedValue({ empty: true, docs: [] });
    await expect(findActiveBattleForAgent(CLONE)).resolves.toEqual({ found: false, battle: null });
  });

  // The honesty boundary. Each of these prevented the check from RUNNING, so it
  // must throw — a falsy `found` here would let a check that learned nothing
  // author "no battle was created".
  it('THROWS rather than reporting "no battle" when there is no target id', async () => {
    await expect(findActiveBattleForAgent(null)).rejects.toThrow(/no deploy target/);
    expect(getDocsMock).not.toHaveBeenCalled();
  });

  it('THROWS rather than reporting "no battle" when auth has not resolved', async () => {
    authState.currentUser = null;
    await expect(findActiveBattleForAgent(CLONE)).rejects.toThrow(/no authenticated user/);
    expect(getDocsMock).not.toHaveBeenCalled();
  });

  it('propagates a read failure rather than swallowing it into found=false', async () => {
    getDocsMock.mockRejectedValue(new Error('permission-denied'));
    await expect(findActiveBattleForAgent(CLONE)).rejects.toThrow('permission-denied');
  });
});
