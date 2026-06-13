// api/tournament/battle-view.test.js
//
// P7 — GET /api/tournament/battle-view. Locks: method + auth gates, group-id
// validation, that ONLY tournament battles surface (tiered docs excluded),
// per-owner "current battle" selection, and the per-viewer WHY projection
// (the viewer's own seat full; a rival's active seat WHAT-only).
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): importing the real handler is the
// runtime guard for its api/ -> src/ imports (leagueTournament,
// tournamentBattleView). Never mock that graph.

import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => ({ db: null, user: { uid: 'owner1' } }));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => h.db }));
vi.mock('../_utils/authMiddleware.js', () => ({
  requireAuth: async (req, res) => {
    if (h.user) return h.user;
    res.status(401).json({ error: 'Authentication required' });
    return null;
  },
}));

import handler from './battle-view.js';

function makeDb(battleDocs) {
  return {
    collection: () => ({
      where: (field, _op, val) => ({
        get: async () => ({
          forEach: (cb) => battleDocs
            .filter(d => d[field] === val)
            .forEach(d => cb({ id: d.id, data: () => d })),
        }),
      }),
    }),
  };
}

function makeReqRes(query = { groupId: 'g1' }, method = 'GET') {
  const req = { method, query };
  const res = { statusCode: null, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return { req, res };
}

function tournamentBattle(ownerId, overrides = {}) {
  return {
    id: `b-${ownerId}`,
    ownerId,
    groupId: 'g1',
    status: 'active',
    gameMode: 'baggerbomb_tournament',
    createdAt: '2026-06-13T13:30:00Z',
    portfolio: { star: [{ symbol: 'NVDA', tierMultiplier: 1 }], core: [], support: [] },
    scoreState: { currentScore: 5 },
    statusFeed: [{ message: 'live', trade_reasoning: 'secret' }],
    agentContext: { agentName: 'A', innerMonologue: { strategy: 'secret plan' } },
    evaluations: [{ rationale: 'secret' }],
    ...overrides,
  };
}

beforeEach(() => {
  h.user = { uid: 'owner1' };
});

describe('gates', () => {
  it('405 on non-GET', async () => {
    const { req, res } = makeReqRes({ groupId: 'g1' }, 'POST');
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it('401 when unauthenticated', async () => {
    h.user = null;
    const { req, res } = makeReqRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('400 on an invalid groupId (path-injection shape)', async () => {
    h.db = makeDb([]);
    const { req, res } = makeReqRes({ groupId: 'bad/../id' });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('invalid_group_id');
  });
});

describe('scoping + projection', () => {
  it('returns ONLY tournament battles for the group (tiered docs excluded)', async () => {
    h.db = makeDb([
      tournamentBattle('owner1'),
      tournamentBattle('rival2'),
      // a tiered battle that happens to carry the same (impossible) groupId
      { id: 'tiered', ownerId: 'x', groupId: 'g1', status: 'active', gameMode: 'baggerbomb_agent' },
      // a tournament battle in a DIFFERENT group
      tournamentBattle('owner1', { id: 'other', groupId: 'g2' }),
    ]);
    const { req, res } = makeReqRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(Object.keys(res.body.battles).sort()).toEqual(['owner1', 'rival2']);
    expect(res.body.viewerUid).toBe('owner1');
  });

  it('projects the viewer\'s OWN seat full, a rival\'s active seat WHAT-only', async () => {
    h.db = makeDb([tournamentBattle('owner1'), tournamentBattle('rival2')]);
    const { req, res } = makeReqRes();
    await handler(req, res);

    const mine = res.body.battles.owner1;
    expect(mine.agentContext.innerMonologue).toBeDefined(); // full WHY for me
    expect(mine.evaluations).toBeDefined();
    expect(mine._whyConcealed).toBeUndefined();

    const rival = res.body.battles.rival2;
    expect(rival.agentContext.innerMonologue).toBeUndefined(); // concealed
    expect(rival.evaluations).toBeUndefined();
    expect(rival.statusFeed[0].message).toBe('live');         // WHAT kept
    expect(rival.statusFeed[0].trade_reasoning).toBeUndefined();
    expect(rival._whyConcealed).toBe(true);
  });

  it('unlocks a rival\'s WHY once the battle is completed', async () => {
    h.db = makeDb([tournamentBattle('rival2', { status: 'completed' })]);
    const { req, res } = makeReqRes();
    await handler(req, res);
    const rival = res.body.battles.rival2;
    expect(rival.agentContext.innerMonologue).toBeDefined();
    expect(rival.evaluations).toBeDefined();
    expect(rival._whyConcealed).toBeUndefined();
  });
});
