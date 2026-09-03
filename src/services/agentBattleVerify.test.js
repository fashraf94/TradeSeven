// src/services/agentBattleVerify.test.js
//
// PR 2 §7 row 3 — "Query keys on `targetAgentId` — assert on the key itself, not
// just the outcome." These rows read the query that was BUILT, so a query that
// happens to return the right thing for the wrong reason still fails.
//
// The keys are a contract with the server's own write at
// `agentBattleService.js:129-132` (`agentId` / `ownerId` / `status: 'active'`)
// and with the `agentBattles` read rule in `firestore.rules`
// (`resource.data.ownerId == request.auth.uid`) — which is why `ownerId` is a
// QUERY KEY and not a post-filter: without it the read is refused outright, and a
// refused read is not a "no battle" answer.
//
// Three properties added at pre-merge remediation, each with the mutation it dies
// under named on the row: the league filter (R1), the server-only read (R2), and
// the scan window that lets the client-side filters see past a stale sibling (R4).

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  collectionMock, queryMock, whereMock, limitMock, getDocsMock, getDocsFromServerMock, authState,
} = vi.hoisted(() => ({
  collectionMock: vi.fn((_db, name) => ({ __collection: name })),
  queryMock: vi.fn((...parts) => ({ __query: parts })),
  whereMock: vi.fn((field, op, value) => ({ __where: [field, op, value] })),
  limitMock: vi.fn((n) => ({ __limit: n })),
  getDocsMock: vi.fn(),
  getDocsFromServerMock: vi.fn(),
  authState: { currentUser: { uid: 'uid-1' } },
}));

vi.mock('firebase/firestore', () => ({
  collection: collectionMock,
  query: queryMock,
  where: whereMock,
  limit: limitMock,
  getDocs: getDocsMock,
  getDocsFromServer: getDocsFromServerMock,
}));
vi.mock('../firebase/config', () => ({ db: { __db: true }, auth: authState }));

const { findActiveBattleForAgent } = await import('./agentBattleVerify.js');

const CLONE = 'casual-agent-uid1';
const RANKED = 'agent-ranked-1';

// Every `where(...)` clause built during the call, as [field, op, value].
const clauses = () => whereMock.mock.calls.map(([f, o, v]) => [f, o, v]);
// A doc snapshot shaped the way the SDK hands them over.
const snap = (id, data) => ({ id, data: () => data });
const serverReturns = (...docs) => {
  getDocsFromServerMock.mockResolvedValue({ empty: docs.length === 0, docs });
};
const hourFromNow = () => new Date(Date.now() + 3600000).toISOString();
const hourAgo = () => new Date(Date.now() - 3600000).toISOString();

beforeEach(() => {
  collectionMock.mockClear();
  queryMock.mockClear();
  whereMock.mockClear();
  limitMock.mockClear();
  getDocsMock.mockReset();
  getDocsFromServerMock.mockReset();
  // The cache's default answer, everywhere. Not decoration: it is what makes a
  // revert to `getDocs` fail SEMANTICALLY across this file — "the cache answered
  // empty and we believed it" — rather than exploding on an unconfigured mock.
  // A guard that reds only because its stub is missing is not guarding anything.
  getDocsMock.mockResolvedValue({ empty: true, docs: [], metadata: { fromCache: true } });
  authState.currentUser = { uid: 'uid-1' };
});

describe('findActiveBattleForAgent — the query keys (§7 row 3)', () => {
  it('keys agentId on the id it was HANDED (the deploy target), not on anything re-derived', async () => {
    serverReturns();
    await findActiveBattleForAgent(CLONE);

    // The key itself — the assertion that reds when the caller reverts to the
    // ranked agent.id, and when the field name drifts from the server's write.
    expect(clauses()).toContainEqual(['agentId', '==', CLONE]);
    expect(clauses()).not.toContainEqual(['agentId', '==', RANKED]);
    expect(collectionMock).toHaveBeenCalledWith({ __db: true }, 'agentBattles');
  });

  it('scopes by ownerId and status, matching agentBattleService.js:129-132 and the read rule', async () => {
    serverReturns();
    await findActiveBattleForAgent(CLONE);
    expect(clauses()).toContainEqual(['ownerId', '==', 'uid-1']);
    expect(clauses()).toContainEqual(['status', '==', 'active']);
    expect(clauses()).toHaveLength(3);
  });

  it('returns the found battle WITH its id, so the caller never needs activeBattleId', async () => {
    serverReturns(snap('battle-9', { agentId: CLONE, status: 'active', portfolio: { star: [] } }));
    const out = await findActiveBattleForAgent(CLONE);
    expect(out.found).toBe(true);
    expect(out.battle.id).toBe('battle-9');
    expect(out.battle.status).toBe('active');
  });

  it('an empty result is a real answer: found=false, no throw', async () => {
    serverReturns();
    await expect(findActiveBattleForAgent(CLONE)).resolves.toEqual({ found: false, battle: null });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// R2 — the read must come FROM THE SERVER
//
// Plain `getDocs` resolves from the local cache when the server cannot be
// reached, WITHOUT throwing. An empty cache-served snapshot would then become a
// definitive `found: false`, and beside a server error signal the machine has
// already latched that licenses "no battle was created" — the founding defect,
// regenerated by a read that verified nothing.
// ═══════════════════════════════════════════════════════════════════════════
describe('findActiveBattleForAgent — the read is server-authoritative (R2)', () => {
  // DIES UNDER: reverting `getDocsFromServer` to `getDocs`. The cache answers
  // empty and confidently; the server has the battle.
  it('reads from the server, never from the cache that would answer empty', async () => {
    getDocsMock.mockResolvedValue({ empty: true, docs: [], metadata: { fromCache: true } });
    serverReturns(snap('battle-live', { agentId: CLONE, status: 'active', expiresAt: hourFromNow() }));

    const out = await findActiveBattleForAgent(CLONE);
    expect(out.found).toBe(true);
    expect(out.battle.id).toBe('battle-live');
    // The mechanism, not just the outcome: the cache-capable reader is not used.
    expect(getDocsMock).not.toHaveBeenCalled();
    expect(getDocsFromServerMock).toHaveBeenCalledTimes(1);
  });

  // Offline, `getDocsFromServer` errors rather than resolving from cache. That
  // throw IS the honest answer — the caller routes it to "lost contact".
  it('propagates the unavailable-network error rather than resolving it as "no battle"', async () => {
    getDocsFromServerMock.mockRejectedValue(new Error('Failed to get document because the client is offline.'));
    await expect(findActiveBattleForAgent(CLONE)).rejects.toThrow(/offline/);
  });

  it('propagates a read failure rather than swallowing it into found=false', async () => {
    getDocsFromServerMock.mockRejectedValue(new Error('permission-denied'));
    await expect(findActiveBattleForAgent(CLONE)).rejects.toThrow('permission-denied');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// R1 — a league battle is never a Command Center recovery
//
// SCOPE NARROWING, not attribution: this answers "is this a league battle", and
// it closes the false reveal because a `groupId`-bearing doc is definitionally
// not from a Command Center deploy (BaggerBomb-only, Framework §3.1).
// ═══════════════════════════════════════════════════════════════════════════
describe('findActiveBattleForAgent — league battles are out of scope (R1)', () => {
  // The clone-fallback path: the deploy target IS the ranked agent, and the only
  // live battle on it is the user's league game. Revealing it announces
  // "Deployment complete" and walks the user into a competitive battle they did
  // not just deploy.
  // DIES UNDER: removing the league filter.
  it('a live ranked battle on the target is NOT a recoverable battle', async () => {
    serverReturns(snap('battle-league', {
      agentId: RANKED, status: 'active', groupId: 'group-77', gameMode: 'flat6', expiresAt: hourFromNow(),
    }));
    await expect(findActiveBattleForAgent(RANKED)).resolves.toEqual({ found: false, battle: null });
  });

  // The filter must not swallow the battles it exists to find. `groupId` absent
  // and `groupId: null` are both BaggerBomb — agentBattleService.js:137 spreads
  // the key in for tournament docs only.
  it.each([
    ['no groupId key at all', {}],
    ['an explicit null groupId', { groupId: null }],
  ])('a casual battle with %s is still found', async (_label, extra) => {
    serverReturns(snap('battle-casual', {
      agentId: CLONE, status: 'active', expiresAt: hourFromNow(), ...extra,
    }));
    const out = await findActiveBattleForAgent(CLONE);
    expect(out.found).toBe(true);
    expect(out.battle.id).toBe('battle-casual');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// R4 — the scan window
//
// Both filters run client-side on the docs already fetched, so reading ONE doc
// lets a stale sibling be the one the query returns, get filtered out, and report
// a definitive "no battle" while a live one sits in the collection. The query has
// no orderBy: which doc comes back is not ours to choose.
// ═══════════════════════════════════════════════════════════════════════════
describe('findActiveBattleForAgent — a stale sibling cannot suppress a live battle (R4)', () => {
  // DIES UNDER: restoring limit(1) — the assertion is on the constant itself, so
  // it reds without depending on which doc a mock happens to order first.
  it('asks for a scan window, not a single document', async () => {
    serverReturns();
    await findActiveBattleForAgent(CLONE);
    expect(limitMock).toHaveBeenCalledTimes(1);
    expect(limitMock.mock.calls[0][0]).toBeGreaterThan(1);
  });

  // DIES UNDER: restoring `snapshot.docs[0]` in place of the scan.
  it('an EXPIRED sibling ordered first does not hide the live battle behind it', async () => {
    serverReturns(
      snap('battle-stale', { agentId: CLONE, status: 'active', expiresAt: hourAgo() }),
      snap('battle-live', { agentId: CLONE, status: 'active', expiresAt: hourFromNow() }),
    );
    const out = await findActiveBattleForAgent(CLONE);
    expect(out.found).toBe(true);
    expect(out.battle.id).toBe('battle-live');
  });

  // R1 × R4: on the clone-fallback path a league battle can sit beside the
  // BaggerBomb one this deploy created. Filtering the league doc must not cost us
  // the recovery.
  it('a league sibling ordered first does not hide the casual battle behind it', async () => {
    serverReturns(
      snap('battle-league', { agentId: RANKED, status: 'active', groupId: 'group-77', expiresAt: hourFromNow() }),
      snap('battle-casual', { agentId: RANKED, status: 'active', expiresAt: hourFromNow() }),
    );
    const out = await findActiveBattleForAgent(RANKED);
    expect(out.found).toBe(true);
    expect(out.battle.id).toBe('battle-casual');
  });

  it('a window of nothing but filtered docs is a real "no", not a throw', async () => {
    serverReturns(
      snap('battle-stale', { agentId: CLONE, status: 'active', expiresAt: hourAgo() }),
      snap('battle-league', { agentId: CLONE, status: 'active', groupId: 'g1', expiresAt: hourFromNow() }),
    );
    await expect(findActiveBattleForAgent(CLONE)).resolves.toEqual({ found: false, battle: null });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The expiry predicate (PR 2, unchanged)
// ═══════════════════════════════════════════════════════════════════════════
describe('findActiveBattleForAgent — "active" is not the same predicate as "live"', () => {
  // decide.js:718-728 treats a past expiresAt as not-live and only sweeps the doc
  // lazily, so an expired battle sits in the collection still stamped 'active'.
  // Re-reading a WEAKER predicate than the app's own would let this check announce
  // a FINISHED battle as the one the deploy just created.
  // DIES UNDER: removing the expiry filter.
  it('an EXPIRED battle still stamped active is not a live battle', async () => {
    serverReturns(snap('battle-stale', { agentId: CLONE, status: 'active', expiresAt: hourAgo() }));
    await expect(findActiveBattleForAgent(CLONE)).resolves.toEqual({ found: false, battle: null });
  });

  it('a battle whose clock has NOT run out is still live', async () => {
    serverReturns(snap('battle-live', { agentId: CLONE, status: 'active', expiresAt: hourFromNow() }));
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
    serverReturns(snap('battle-noclock', { agentId: CLONE, status: 'active', expiresAt }));
    expect((await findActiveBattleForAgent(CLONE)).found).toBe(true);
  });

  // Firestore Timestamps and ISO strings both reach this code path depending on
  // the SDK surface that wrote the doc.
  it('a Firestore Timestamp expiresAt is honoured too', async () => {
    const past = new Date(Date.now() - 60000);
    serverReturns(snap('battle-ts', { agentId: CLONE, status: 'active', expiresAt: { toDate: () => past } }));
    expect((await findActiveBattleForAgent(CLONE)).found).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The honesty boundary
// ═══════════════════════════════════════════════════════════════════════════
describe('findActiveBattleForAgent — a check that could not run must throw', () => {
  // Each of these prevented the check from RUNNING, so it must throw — a falsy
  // `found` here would let a check that learned nothing author "no battle was
  // created".
  it('THROWS rather than reporting "no battle" when there is no target id', async () => {
    await expect(findActiveBattleForAgent(null)).rejects.toThrow(/no deploy target/);
    expect(getDocsFromServerMock).not.toHaveBeenCalled();
  });

  it('THROWS rather than reporting "no battle" when auth has not resolved', async () => {
    authState.currentUser = null;
    await expect(findActiveBattleForAgent(CLONE)).rejects.toThrow(/no authenticated user/);
    expect(getDocsFromServerMock).not.toHaveBeenCalled();
  });
});
