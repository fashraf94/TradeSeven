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

// The cap/duplicate check + write run in a transaction (post-review fix:
// parallel submissions must not both pass the cap) — the harness routes
// tx.get(query) and tx.set accordingly.
function makeDb({ groupDoc = null, pendingClaims = [] } = {}) {
  const captured = { added: [] };
  const claimsQueryable = {
    where: () => claimsQueryable,
    get: async () => ({
      size: pendingClaims.length,
      forEach: (cb) => pendingClaims.forEach(c => cb({ id: c.id ?? 'cx', data: () => c })),
    }),
    doc: () => ({ id: 'new-claim-1' }),
  };
  const groupRef = {
    get: async () => ({ exists: groupDoc != null, data: () => groupDoc }),
    collection: () => claimsQueryable,
  };
  const db = {
    collection: () => ({ doc: () => groupRef }),
    runTransaction: async (fn) => fn({
      get: async (q) => q.get(),
      set: (_ref, doc) => { captured.added.push(doc); },
    }),
  };
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
    expect(missing.res.body.error).toBe('group_not_found');

    h.db = makeDb({ groupDoc: battleGroup({ status: 'forming' }) }).db;
    const forming = makeReqRes();
    await handler(forming.req, forming.res);
    expect(forming.res.statusCode).toBe(409);
    expect(forming.res.body.error).toBe('not_battle');

    const badId = makeReqRes({ groupId: 'a/b' });
    await handler(badId.req, badId.res);
    expect(badId.res.statusCode).toBe(400);
    expect(badId.res.body.error).toBe('invalid_group_id');

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

// Backfill locks added before the Phase-B1 extraction of the validation core
// into tournamentClaimPlacement.js — make the existing suite a comprehensive
// lock on every branch the extraction touches (BUILD_RULES §4 anti-copy: the
// human path's behavior must be byte-identical after the refactor).
describe('validation matrix — backfill locks (pre-B1 extraction)', () => {
  it('rejects an empty/missing symbol with invalid_symbols (the !dropSymbol arm)', async () => {
    h.db = makeDb({ groupDoc: battleGroup() }).db;
    const empty = makeReqRes({ dropSymbol: '' });
    await handler(empty.req, empty.res);
    expect(empty.res.statusCode).toBe(400);
    expect(empty.res.body.error).toBe('invalid_symbols');
  });

  it('rejects a non-POST method with 405', async () => {
    h.db = makeDb({ groupDoc: battleGroup() }).db;
    const { req, res } = makeReqRes();
    req.method = 'GET';
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it('maps an unexpected Firestore failure to 500 server_error (not a leak)', async () => {
    h.db = {
      collection: () => ({ doc: () => ({ get: async () => { throw new Error('boom'); } }) }),
    };
    const { req, res } = makeReqRes();
    await handler(req, res);
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('server_error');
  });

  it('defaults rank to 1 for invalid input and falls back username → auth name → null', async () => {
    // rank 0 → 1; no body.username, auth name present → the name
    h.user = { uid: 'u1', name: 'Bob' };
    const a = makeDb({ groupDoc: battleGroup() });
    h.db = a.db;
    const ra = makeReqRes({ rank: 0, username: undefined });
    await handler(ra.req, ra.res);
    expect(ra.res.statusCode).toBe(200);
    expect(a.captured.added[0].rank).toBe(1);
    expect(a.captured.added[0].username).toBe('Bob');

    // whitespace username + no auth name → null
    h.user = { uid: 'u1' };
    const b = makeDb({ groupDoc: battleGroup() });
    h.db = b.db;
    const rb = makeReqRes({ username: '   ' });
    await handler(rb.req, rb.res);
    expect(rb.res.statusCode).toBe(200);
    expect(b.captured.added[0].username).toBeNull();
  });
});

describe('Phase A — training-scoped pre-day-1 gate (AWAITING_OPEN)', () => {
  it('accepts a claim on a TRAINING pod in awaiting_open (the weeknight pre-day-1 window)', async () => {
    const { db, captured } = makeDb({ groupDoc: battleGroup({ status: 'awaiting_open', isTraining: true }) });
    h.db = db;
    const { req, res } = makeReqRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(captured.added).toHaveLength(1);
  });

  it('still rejects a RANKED pod in awaiting_open with not_battle (gate stays training-scoped)', async () => {
    h.db = makeDb({ groupDoc: battleGroup({ status: 'awaiting_open' }) }).db; // no isTraining
    const { req, res } = makeReqRes();
    await handler(req, res);
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('not_battle');
  });

  it('rejects a TRAINING pod still in forming or drafting with not_battle', async () => {
    for (const status of ['forming', 'drafting']) {
      h.db = makeDb({ groupDoc: battleGroup({ status, isTraining: true }) }).db;
      const { req, res } = makeReqRes();
      await handler(req, res);
      expect(res.statusCode).toBe(409);
      expect(res.body.error).toBe('not_battle');
    }
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
