// api/tournament/place-claim.test.js
//
// Claim placement matrix — the legacy submitClaim validation order minus
// categories, server-side: window (with the admin-gated preview bypass),
// membership, drop-on-roster, flat-pool membership, day-5, pending cap (3),
// duplicate — and the rider #5 "placed" awaited write shape.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the import of the REAL endpoint
// module below is the runtime guard for its api/ -> src/ import of
// src/constants/leagueTournament.js — it explodes in this Node test
// environment if a browser-only dependency ever enters that transitive
// graph. Never mock that part of the graph.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const h = vi.hoisted(() => ({ db: null, user: { uid: 'u1' } }));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => h.db }));
vi.mock('../_utils/authMiddleware.js', () => ({
  requireAuth: async (req, res) => {
    if (h.user) return h.user;
    res.status(401).json({ error: 'Authentication required' });
    return null;
  },
}));

import handler from './place-claim.js';

const SECRET = 'test-admin-secret';
const WINDOW_OPEN = new Date('2026-06-10T21:00:00Z');   // Wed 17:00 ET — window open
const WINDOW_CLOSED = new Date('2026-06-10T18:00:00Z'); // Wed 14:00 ET — market hours
const FRIDAY_EVENING = new Date('2026-06-12T21:00:00Z');

function pickState(symbol) {
  return {
    symbol,
    legs: [{ direction: 'long', baselinePrice: 100, baselineSource: 'draft_resolution', openedAt: 'T0', thresholdHistory: [] }],
    flipCountToday: 0,
  };
}

function battleGroup(overrides = {}) {
  return {
    status: 'battle',
    groupMembers: ['u1', 'u2', 'u3', 'u4'],
    players: [
      { odUserId: 'u1', picks: [pickState('NVDA'), pickState('AMD'), pickState('TSLA')] },
      { odUserId: 'u2', picks: [] },
      { odUserId: 'u3', picks: [] },
      { odUserId: 'u4', picks: [] },
    ],
    userPool: ['COIN', 'PLTR', 'SHOP'],
    dailyScores: {},
    claimSystem: { enabled: true, currentWaiverPriority: [], processingLog: [] },
    ...overrides,
  };
}

function makeDb({ groupDoc = null, pendingClaims = [] } = {}) {
  const captured = { added: [] };
  const claimsQueryable = {
    where: () => claimsQueryable,
    get: async () => ({
      size: pendingClaims.length,
      forEach: (cb) => pendingClaims.forEach(c => cb({ id: c.id ?? 'cx', data: () => c })),
    }),
    add: async (doc) => { captured.added.push(doc); return { id: 'new-claim-1' }; },
  };
  const groupRef = {
    get: async () => ({ exists: groupDoc != null, data: () => groupDoc }),
    collection: () => claimsQueryable,
  };
  const db = { collection: () => ({ doc: () => groupRef }) };
  return { db, captured };
}

function makeReqRes(body = {}, headers = {}) {
  const req = { method: 'POST', headers, body: { groupId: 'group-1', dropSymbol: 'NVDA', addSymbol: 'COIN', rank: 1, ...body } };
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  return { req, res };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(WINDOW_OPEN);
  vi.stubEnv('ADMIN_SECRET', SECRET);
  h.user = { uid: 'u1' };
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('window rules (overnight, legacy semantics)', () => {
  it('rejects during market hours and on Friday evenings', async () => {
    h.db = makeDb({ groupDoc: battleGroup() }).db;

    vi.setSystemTime(WINDOW_CLOSED);
    const closed = makeReqRes();
    await handler(closed.req, closed.res);
    expect(closed.res.statusCode).toBe(403);
    expect(closed.res.body.error).toBe('window_closed');

    vi.setSystemTime(FRIDAY_EVENING);
    const friday = makeReqRes();
    await handler(friday.req, friday.res);
    expect(friday.res.statusCode).toBe(403);
    expect(friday.res.body.message).toMatch(/friday_evening/);
  });

  it('devBypassWindow is honored ONLY with a valid admin secret — silently ignored otherwise', async () => {
    vi.setSystemTime(WINDOW_CLOSED);
    const { db, captured } = makeDb({ groupDoc: battleGroup() });
    h.db = db;

    const noSecret = makeReqRes({ devBypassWindow: true });
    await handler(noSecret.req, noSecret.res);
    expect(noSecret.res.statusCode).toBe(403);

    const wrongSecret = makeReqRes({ devBypassWindow: true }, { 'x-admin-secret': 'nope' });
    await handler(wrongSecret.req, wrongSecret.res);
    expect(wrongSecret.res.statusCode).toBe(403);

    const withSecret = makeReqRes({ devBypassWindow: true }, { 'x-admin-secret': SECRET });
    await handler(withSecret.req, withSecret.res);
    expect(withSecret.res.statusCode).toBe(200);
    expect(captured.added).toHaveLength(1);
  });
});

describe('validation matrix (legacy order, minus categories)', () => {
  it('membership, roster, and pool checks', async () => {
    h.db = makeDb({ groupDoc: battleGroup() }).db;

    h.user = { uid: 'outsider' };
    const member = makeReqRes();
    await handler(member.req, member.res);
    expect(member.res.statusCode).toBe(403);
    expect(member.res.body.error).toBe('not_member');

    h.user = { uid: 'u1' };
    const drop = makeReqRes({ dropSymbol: 'META' }); // not on u1's roster
    await handler(drop.req, drop.res);
    expect(drop.res.statusCode).toBe(409);
    expect(drop.res.body.error).toBe('drop_not_on_roster');

    const pool = makeReqRes({ addSymbol: 'GOOG' }); // not in userPool
    await handler(pool.req, pool.res);
    expect(pool.res.statusCode).toBe(409);
    expect(pool.res.body.error).toBe('not_in_pool');
  });

  it('group existence, status, and id/symbol shape', async () => {
    h.db = makeDb().db;
    const missing = makeReqRes();
    await handler(missing.req, missing.res);
    expect(missing.res.statusCode).toBe(404);

    h.db = makeDb({ groupDoc: battleGroup({ status: 'forming' }) }).db;
    const forming = makeReqRes();
    await handler(forming.req, forming.res);
    expect(forming.res.statusCode).toBe(409);
    expect(forming.res.body.error).toBe('not_battle');

    const badId = makeReqRes({ groupId: 'a/b' });
    await handler(badId.req, badId.res);
    expect(badId.res.statusCode).toBe(400);

    const sameSym = makeReqRes({ addSymbol: 'NVDA' });
    await handler(sameSym.req, sameSym.res);
    expect(sameSym.res.statusCode).toBe(400);
    expect(sameSym.res.body.error).toBe('invalid_symbols');
  });

  it('day-5 rule from the banking-derived day clock (not bypassed by devBypassWindow)', async () => {
    // day4 banked yesterday → today is derived day 5 → no new claims.
    const lastDay = battleGroup({
      dailyScores: { day4: { closeScores: {}, recordedDate: '2026-06-09' } },
    });
    h.db = makeDb({ groupDoc: lastDay }).db;
    const blocked = makeReqRes({ devBypassWindow: true }, { 'x-admin-secret': SECRET });
    await handler(blocked.req, blocked.res);
    expect(blocked.res.statusCode).toBe(409);
    expect(blocked.res.body.error).toBe('battle_last_day');

    // day3 banked yesterday → derived day 4 → fine.
    const day4 = battleGroup({
      dailyScores: { day3: { closeScores: {}, recordedDate: '2026-06-09' } },
    });
    h.db = makeDb({ groupDoc: day4 }).db;
    const ok = makeReqRes();
    await handler(ok.req, ok.res);
    expect(ok.res.statusCode).toBe(200);
  });

  it('pending cap 3 (TOURNAMENT_TUNING) and exact-duplicate rejection', async () => {
    const three = [
      { dropSymbol: 'NVDA', addSymbol: 'PLTR' },
      { dropSymbol: 'AMD', addSymbol: 'SHOP' },
      { dropSymbol: 'TSLA', addSymbol: 'COIN' },
    ];
    h.db = makeDb({ groupDoc: battleGroup(), pendingClaims: three }).db;
    const capped = makeReqRes();
    await handler(capped.req, capped.res);
    expect(capped.res.statusCode).toBe(409);
    expect(capped.res.body.error).toBe('claim_cap_reached');

    h.db = makeDb({
      groupDoc: battleGroup(),
      pendingClaims: [{ dropSymbol: 'NVDA', addSymbol: 'COIN' }],
    }).db;
    const dup = makeReqRes();
    await handler(dup.req, dup.res);
    expect(dup.res.statusCode).toBe(409);
    expect(dup.res.body.error).toBe('duplicate_claim');
  });
});

describe('rider #5 "placed"', () => {
  it('the awaited claim-doc write carries the writer fields; response echoes the doc', async () => {
    const { db, captured } = makeDb({ groupDoc: battleGroup() });
    h.db = db;
    const { req, res } = makeReqRes({ dropSymbol: 'nvda ', addSymbol: 'coin', rank: 2, username: 'Fai' });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(captured.added).toHaveLength(1);
    expect(captured.added[0]).toEqual({
      odUserId: 'u1',
      username: 'Fai',
      dropSymbol: 'NVDA', // normalized
      addSymbol: 'COIN',
      rank: 2,
      status: 'pending',
      denialReason: null,
      processedAt: null,
      submittedAt: WINDOW_OPEN.toISOString(),
      createdAt: WINDOW_OPEN.toISOString(),
    });
    expect(res.body.claimId).toBe('new-claim-1');
  });
});
