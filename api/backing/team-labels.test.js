// api/backing/team-labels.test.js
//
// GET /api/backing/team-labels — the Your Backing data's names (Amendment C
// §C1, D-af): the server's label for every team of the pods the viewer has
// BACKED, from the one resolver; nothing for a pod they have not; never a raw
// account id. The darkness rows live in backing-routes.dark.test.js.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the route's real import below is
// the runtime guard for its api/ -> src/ imports. Never mock the constants.

import { describe, it, expect, beforeEach, vi } from 'vitest';

const state = vi.hoisted(() => ({ flag: true, uid: 'viewer-1' }));

vi.mock('../_utils/security.js', () => ({ applySecurityMiddleware: () => false }));
vi.mock('../_utils/authMiddleware.js', () => ({
  requireAuth: async (_req, res) => {
    if (!state.uid) { res.status(401).json({ error: 'Authentication required' }); return null; }
    return { uid: state.uid, firebase: { sign_in_provider: 'password' } };
  },
}));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get BACKING_BETA_ENABLED() { return state.flag; },
}));

let DB = null;
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => DB.db }));

const { makeInMemoryDb } = await import('../_utils/__fixtures__/inMemoryFirestore.js');
const { default: handler, MAX_GROUP_IDS, parseGroupIds } = await import('./team-labels.js');
const { BACKING_POOLS_COLLECTION, BACKING_STAKES_COLLECTION, POOL_STATUS, STAKE_STATUS } = await import('../_utils/backingPools.js');
const { UNNAMED_TEAM_LABEL } = await import('../../src/constants/backing.js');

const UID = 'viewer-1';
// Firebase-uid-shaped seats: the production id shape.
const ADA = 'AdaLovelace0000000000000001a';
const CY = 'CyHarrison000000000000003ccc';
const GONE = 'GoneAway00000000000000004ddd';

const players = () => [{ odUserId: ADA }, { odUserId: CY }, { odUserId: 'cpu-3', isCpu: true }];
function world() {
  return {
    // In play: a lobby pod, NO seatNames (the HON-17 shape).
    'tournamentGroups/g-play': { status: 'battle', baseLayerWeek: '2026-W39', players: players() },
    [`${BACKING_POOLS_COLLECTION}/g-play`]: { groupId: 'g-play', status: POOL_STATUS.CLOSED, teams: players().map((p) => ({ odUserId: p.odUserId, isCpu: p.isCpu === true })) },
    // Settled: the teams carry settlement's recorded agents.
    'tournamentGroups/g-done': { status: 'complete', baseLayerWeek: '2026-W38', players: players() },
    [`${BACKING_POOLS_COLLECTION}/g-done`]: {
      groupId: 'g-done', status: POOL_STATUS.RESOLVED,
      teams: [{ odUserId: ADA, isCpu: false, agentId: 'agt-played' }, { odUserId: CY, isCpu: false, agentId: 'agt-gone' }],
    },
    // A pod the viewer has NOT backed.
    'tournamentGroups/g-other': { status: 'battle', baseLayerWeek: '2026-W39', players: players() },
    // The viewer's stakes — one on a seat that has since LEFT g-play.
    [`${BACKING_STAKES_COLLECTION}/s1`]: { userId: UID, groupId: 'g-play', teamOdUserId: ADA, amount: 250, weekKey: '2026-W39', status: STAKE_STATUS.LIVE },
    [`${BACKING_STAKES_COLLECTION}/s2`]: { userId: UID, groupId: 'g-play', teamOdUserId: GONE, amount: 100, weekKey: '2026-W39', status: STAKE_STATUS.VOIDED, voidReason: 'seat_left' },
    [`${BACKING_STAKES_COLLECTION}/s3`]: { userId: UID, groupId: 'g-done', teamOdUserId: ADA, amount: 100, weekKey: '2026-W38', status: STAKE_STATUS.WON, payout: 140 },
    // Someone else's stake on g-other — it does not make g-other the viewer's.
    [`${BACKING_STAKES_COLLECTION}/x1`]: { userId: 'someone-else', groupId: 'g-other', teamOdUserId: ADA, amount: 500, weekKey: '2026-W39', status: STAKE_STATUS.LIVE },
    // Names on file.
    'agents/agt-ada': { ownerId: ADA, name: 'Shadow' },
    'agents/agt-played': { ownerId: 'someone', name: 'Played The Week' },
    // `users/{uid}` as its one writer writes it — the names NESTED under
    // `profile` (src/firebase/authService.js; this build's review record, RAWID-1).
    [`users/${ADA}`]: { _v: 1, auth: { uid: ADA, email: 'ada@example.com' }, profile: { username: 'ada', displayName: 'ada', avatarUrl: null, bio: null } },
    [`users/${GONE}`]: { _v: 1, auth: { uid: GONE, email: 'gone@example.com' }, profile: { username: 'gone', displayName: 'Gone Away', avatarUrl: null, bio: null } },
  };
}

const mkRes = () => ({ statusCode: null, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } });
async function get(query = {}, method = 'GET') {
  const res = mkRes();
  await handler({ method, headers: {}, query }, res);
  return res;
}

beforeEach(() => {
  state.flag = true;
  state.uid = UID;
  DB = makeInMemoryDb(world());
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('the pipeline, in order', () => {
  it('405s anything but GET, 401s without a caller, 404s while dark', async () => {
    expect((await get({ groupIds: 'g-play' }, 'POST')).statusCode).toBe(405);
    state.uid = null;
    expect((await get({ groupIds: 'g-play' })).statusCode).toBe(401);
    state.uid = UID;
    state.flag = false;
    expect((await get({ groupIds: 'g-play' })).statusCode).toBe(404);
    expect(DB.readLog).toEqual([]);
  });

  it('400s a missing, empty, malformed or oversized groupIds before any read', async () => {
    for (const groupIds of [undefined, '', ',', 'g/x', 'ok,bad id', Array.from({ length: MAX_GROUP_IDS + 1 }, (_, i) => `g${i}`).join(',')]) {
      const res = await get({ groupIds });
      expect(res.statusCode, String(groupIds)).toBe(400);
      expect(res.body.error).toBe('invalid_group_ids');
    }
    expect(DB.readLog).toEqual([]);
    expect(parseGroupIds(' a, b ,a ')).toEqual(['a', 'b']);
  });

  it('writes nothing, ever', async () => {
    await get({ groupIds: 'g-play,g-done' });
    expect(DB.writeLog).toEqual([]);
  });
});

describe('the names — the server\'s, for the viewer\'s own backed pods (D-af)', () => {
  it('in play: every seat by its PRIMARY AGENT, then its player, then "Unnamed team" — and a departed seat the viewer backed', async () => {
    const res = await get({ groupIds: 'g-play' });
    expect(res.statusCode).toBe(200);
    // Each team: its label and secondary, AND its two layers named apart
    // (`player`, `agent` — RAWID-R-2: the reveal must never guess which layer
    // a lone label is).
    const cpu = expect.stringMatching(/^CPU — /);
    expect(res.body.pods['g-play']).toEqual({
      [ADA]: { label: 'Shadow', secondary: 'ada', player: 'ada', agent: 'Shadow' },
      [CY]: { label: UNNAMED_TEAM_LABEL, secondary: null, player: null, agent: null },
      'cpu-3': { label: cpu, secondary: null, player: cpu, agent: cpu },
      [GONE]: { label: 'Gone Away', secondary: null, player: 'Gone Away', agent: null },
    });
  });

  it('settled: the agent settlement RECORDED names the team; a recorded agent that is gone falls to the player', async () => {
    const res = await get({ groupIds: 'g-done' });
    expect(res.body.pods['g-done'][ADA]).toEqual({ label: 'Played The Week', secondary: 'ada', player: 'ada', agent: 'Played The Week' });
    expect(res.body.pods['g-done'][CY]).toEqual({ label: UNNAMED_TEAM_LABEL, secondary: null, player: null, agent: null });
  });

  it('a pod the viewer has NOT backed is not answered — another backer\'s stake does not make it theirs', async () => {
    const res = await get({ groupIds: 'g-play,g-other,g-nowhere' });
    expect(Object.keys(res.body.pods)).toEqual(['g-play']);
  });

  it('NEVER A RAW ACCOUNT ID in any label or secondary', async () => {
    const res = await get({ groupIds: 'g-play,g-done' });
    for (const teams of Object.values(res.body.pods)) {
      for (const [id, { label, secondary }] of Object.entries(teams)) {
        for (const text of [label, secondary].filter((t) => t != null)) {
          expect(text).not.toBe(id);
          expect(text).not.toMatch(/^[A-Za-z0-9]{28}$/);
          expect(text).not.toMatch(/\bcpu-\d/);
        }
      }
    }
  });

  it('BATCHED — one stake query, one owner lookup, however many pods are asked for', async () => {
    await get({ groupIds: 'g-play,g-done' });
    expect(DB.readLog.filter(([, p]) => p === BACKING_STAKES_COLLECTION)).toHaveLength(1);
    expect(DB.readLog.filter(([, p]) => p === 'agents')).toHaveLength(1);
  });

  it('a failed read answers 500 with a generic body — no internal detail', async () => {
    DB.db.collection = () => { throw new Error('backend exploded'); };
    const res = await get({ groupIds: 'g-play' });
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'server_error', message: 'Could not load the team names.' });
  });
});
