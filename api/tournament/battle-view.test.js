// api/tournament/battle-view.test.js
//
// P7 — GET /api/tournament/battle-view. Locks: method + auth gates, group-id
// validation, that ONLY tournament battles surface (tiered docs excluded),
// per-owner "current battle" selection, and the per-viewer WHY projection —
// founder ruling R-F (15 Nov 2026, security pack): the viewer's own seat full;
// every other seat the allowlist at EVERY status (completion opens nothing
// more); battles keyed by SEAT (the owner's index in the group's `players`),
// never by account id, and no account id anywhere in a rival's seat.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): importing the real handler is the
// runtime guard for its api/ -> src/ imports (leagueTournament,
// tournamentBattleView). Never mock that graph.

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Synthetic, uid-shaped ids (no real account id): the value scans look for them.
const VIEWER = 'PLANTEDviewerUid0000000000AA';
const RIVAL = 'PLANTEDrivalUid00000000000BB';

const h = vi.hoisted(() => ({ db: null, user: null }));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => h.db }));
vi.mock('../_utils/authMiddleware.js', () => ({
  requireAuth: async (req, res) => {
    if (h.user) return h.user;
    res.status(401).json({ error: 'Authentication required' });
    return null;
  },
}));

import handler from './battle-view.js';

const SEATED = { g1: { players: [{ odUserId: VIEWER, picks: [] }, { odUserId: RIVAL, picks: [] }, { odUserId: 'cpu-2', isCpu: true, picks: [] }] } };

function makeDb(battleDocs, groups = SEATED) {
  return {
    collection: (name) => (name === 'tournamentGroups'
      ? {
        doc: (id) => ({ get: async () => ({ exists: id in groups, data: () => groups[id] }) }),
      }
      : {
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

// Battle ids are auto-ids in production (never built from the owner), so the
// fixture's ids name the seat's role, not its account.
const LABEL = { [VIEWER]: 'viewer', [RIVAL]: 'rival' };
function tournamentBattle(ownerId, overrides = {}) {
  return {
    id: `b-${LABEL[ownerId] ?? ownerId}`,
    ownerId,
    groupId: 'g1',
    status: 'active',
    gameMode: 'baggerbomb_tournament',
    createdAt: '2026-06-13T13:30:00Z',
    portfolio: { star: [{ symbol: 'NVDA', tierMultiplier: 1 }], core: [], support: [] },
    scoreState: { currentScore: 5 },
    statusFeed: [{ message: 'live', trade_reasoning: 'secret' }],
    agentContext: { agentName: 'A', innerMonologue: { strategy: 'secret plan' }, activeRules: [{ id: 'r1' }], deployedGuardrails: [{ type: 'stop' }], equippedWatchlist: { tickers: ['COIN'] } },
    evaluations: [{ rationale: 'secret' }],
    chatExchanges: [{ q: 'q', a: 'secret' }],
    directive: { text: 'secret instruction' },
    pendingProposal: { symbolIn: 'COIN' },
    watchlist: { hotBench: ['COIN'] },
    ...overrides,
  };
}

beforeEach(() => {
  h.user = { uid: VIEWER };
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
  it('returns ONLY tournament battles for the group (tiered docs excluded), keyed by SEAT', async () => {
    h.db = makeDb([
      tournamentBattle(VIEWER),
      tournamentBattle(RIVAL),
      // a tiered battle that happens to carry the same (impossible) groupId
      { id: 'tiered', ownerId: 'cpu-2', groupId: 'g1', status: 'active', gameMode: 'baggerbomb_agent' },
      // a tournament battle in a DIFFERENT group
      tournamentBattle(VIEWER, { id: 'other', groupId: 'g2' }),
    ]);
    const { req, res } = makeReqRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(Object.keys(res.body.battles).sort()).toEqual(['0', '1']);
    expect(res.body.battles['0'].id).toBe('b-viewer');
    expect(res.body.battles['1'].id).toBe('b-rival');
    expect(res.body.viewerUid).toBe(VIEWER);
  });

  it('projects the viewer\'s OWN seat full, a rival\'s active seat WHAT-only', async () => {
    h.db = makeDb([tournamentBattle(VIEWER), tournamentBattle(RIVAL)]);
    const { req, res } = makeReqRes();
    await handler(req, res);

    const mine = res.body.battles['0'];
    expect(mine.agentContext.innerMonologue).toBeDefined(); // full WHY for me
    expect(mine.evaluations).toBeDefined();
    expect(mine.ownerId).toBe(VIEWER); // the owner's own view is unchanged
    expect(mine._whyConcealed).toBeUndefined();

    const rival = res.body.battles['1'];
    expect(rival.agentContext.innerMonologue).toBeUndefined(); // concealed
    expect(rival.evaluations).toBeUndefined();
    expect(rival.statusFeed[0].message).toBe('live');         // WHAT kept
    expect(rival.statusFeed[0].trade_reasoning).toBeUndefined();
    expect(rival._whyConcealed).toBe(true);
  });

  it('R-F: a COMPLETED rival battle opens nothing more — WHAT-only, no frozen idea; the viewer\'s own completed seat keeps everything', async () => {
    const sibling = {
      watchlistId: 'wl-1', hypothesisVersion: 2, contentHash: 'c'.repeat(64), statement: 'PLANTED-IDEA: AI capex compounds',
      horizonEnum: 'swing', horizonSource: 'player', activation: [{ symbol: 'NVDA', side: 'above', level: 100, basis: 'daily_close' }],
      invalidation: [], evidenceRefs: [{ kind: 'researchWork', id: 'ws_planted' }], publishedAt: null, origin: 'signaldrop',
    };
    h.db = makeDb([
      tournamentBattle(RIVAL, { status: 'completed', agentContext: { agentName: 'B', innerMonologue: { strategy: 'plan' }, equippedHypothesis: sibling } }),
      tournamentBattle(VIEWER, { status: 'completed', agentContext: { agentName: 'A', innerMonologue: { strategy: 'mine' }, equippedHypothesis: sibling } }),
    ]);
    const { req, res } = makeReqRes();
    await handler(req, res);
    const rival = res.body.battles['1'];
    expect(rival.agentContext).toEqual({ agentName: 'B' });
    expect(rival.evaluations).toBeUndefined();
    expect(rival.chatExchanges).toBeUndefined();
    expect(rival._whyConcealed).toBe(true);
    expect(JSON.stringify(rival)).not.toContain('PLANTED-IDEA');
    const mine = res.body.battles['0'];
    expect(mine.agentContext.equippedHypothesis).toEqual(sibling);
    expect(mine.agentContext.innerMonologue).toEqual({ strategy: 'mine' });
    expect(mine.chatExchanges).toBeDefined();
  });

  it('R-F: no rival account id anywhere in the reply — not as a key, not as a value; no private key in any rival seat', async () => {
    for (const status of ['active', 'completed']) {
      h.db = makeDb([tournamentBattle(VIEWER, { status }), tournamentBattle(RIVAL, { status }), tournamentBattle('cpu-2', { status, isCpu: true, id: 'b-cpu' })]);
      const { req, res } = makeReqRes();
      await handler(req, res);
      const wire = JSON.stringify(res.body);
      expect(wire, status).not.toContain(RIVAL);
      expect(wire, status).not.toContain('cpu-2');
      for (const seat of ['1', '2']) {
        const s = JSON.stringify(res.body.battles[seat]);
        for (const k of ['"ownerId"', '"chatExchanges"', '"directive"', '"equippedWatchlist"', '"hotBench"', '"pendingProposal"', '"deployedGuardrails"', '"activeRules"']) {
          expect(s, `${status} seat ${seat}: ${k}`).not.toContain(k);
        }
      }
    }
  });

  it('a signed-in spectator who holds no seat sees every seat WHAT-only and no account id (spectating stays possible)', async () => {
    h.user = { uid: 'spectator-x' };
    h.db = makeDb([tournamentBattle(VIEWER, { status: 'completed' }), tournamentBattle(RIVAL)]);
    const { req, res } = makeReqRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.battles['0']._whyConcealed).toBe(true);
    expect(res.body.battles['1']._whyConcealed).toBe(true);
    const wire = JSON.stringify(res.body.battles);
    expect(wire).not.toContain(VIEWER);
    expect(wire).not.toContain(RIVAL);
  });

  it('a battle whose owner holds no seat is left out, and a missing group seats nobody', async () => {
    h.db = makeDb([tournamentBattle(RIVAL), tournamentBattle('left-the-group')]);
    let { req, res } = makeReqRes();
    await handler(req, res);
    expect(Object.keys(res.body.battles)).toEqual(['1']);

    h.db = makeDb([tournamentBattle(RIVAL)], {});
    ({ req, res } = makeReqRes());
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.battles).toEqual({});
  });
});
