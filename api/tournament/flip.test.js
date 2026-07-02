// api/tournament/flip.test.js
//
// Flip endpoint — both market branches, the per-ET-day cap with the
// flipCountDate reset, the omitted-not-null bank-pending convention, the
// rider #4 atomic feed event with writer fields, and the admin-gated
// forceMarketState preview time-control.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the import of the REAL endpoint
// module below is the runtime guard for its api/ -> src/ import chain
// (leagueTournament.js, baggerBombUtils.js) — it explodes in this Node test
// environment if a browser-only dependency ever enters the graph. Never mock
// that part of the graph.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { calculateAssetScoreV3 } from '../../src/utils/baggerBombUtils.js';
import { scorePick } from '../_utils/tournamentUserScoring.js';

const h = vi.hoisted(() => ({ db: null, user: { uid: 'u1' } }));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => h.db }));
vi.mock('../_utils/authMiddleware.js', () => ({
  requireAuth: async (req, res) => {
    if (h.user) return h.user;
    res.status(401).json({ error: 'Authentication required' });
    return null;
  },
}));

import handler from './flip.js';

const SECRET = 'test-admin-secret';
const MARKET_OPEN_T = new Date('2026-06-10T14:00:00Z');   // Wed 10:00 ET
const MARKET_CLOSED_T = new Date('2026-06-10T22:00:00Z'); // Wed 18:00 ET
const ET_DATE = '2026-06-10';

function leg(overrides = {}) {
  return {
    direction: 'long',
    baselinePrice: 100,
    baselineSource: 'draft_resolution',
    openedAt: 'T0',
    thresholdHistory: [],
    ...overrides,
  };
}

function battleGroup(overrides = {}) {
  return {
    status: 'battle',
    groupMembers: ['u1', 'u2', 'u3', 'u4'],
    players: [
      { odUserId: 'u1', picks: [{ symbol: 'NVDA', legs: [leg()], flipCountToday: 0 }] },
      { odUserId: 'u2', picks: [] },
      { odUserId: 'u3', picks: [] },
      { odUserId: 'u4', picks: [] },
    ],
    userPool: [],
    dailyScores: {},
    claimSystem: { enabled: true, currentWaiverPriority: [], processingLog: [] },
    ...overrides,
  };
}

function makeDb({ groupDoc = null, stream = null, ledger = null } = {}) {
  const captured = { updates: [], sets: [] };
  // P6b: the user-side double-down reads the agent-draft stream (before the
  // tx) and the agent ledger (inside it). Both default to non-existent, so
  // tests that don't opt in see detection degrade to no events.
  const streamRef = { get: async () => ({ exists: stream != null, data: () => stream }) };
  const ledgerRef = { __ledger: true, get: async () => ({ exists: ledger != null, data: () => ledger }) };
  const groupRef = {
    get: async () => ({ exists: groupDoc != null, data: () => groupDoc }),
    collection: (sub) => ({ doc: () => (sub === 'streams' ? streamRef : ledgerRef) }),
  };
  const db = {
    collection: (name) => ({
      doc: () => (name === 'indexIntelligence'
        ? { get: async () => ({ exists: false, data: () => null }) }
        : groupRef),
    }),
    runTransaction: async (fn) => fn({
      get: async (ref) => ref.get(),
      update: (_ref, data) => { captured.updates.push(data); },
      set: (ref, data) => { captured.sets.push({ ledger: ref.__ledger === true, data }); },
    }),
  };
  return { db, captured };
}

function makeReqRes(body = {}, headers = {}) {
  const req = { method: 'POST', headers, body: { groupId: 'group-1', symbol: 'NVDA', ...body } };
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  return { req, res };
}

function stubQuote({ open = 100, close = 103 } = {}) {
  vi.stubEnv('EODHD_API_KEY', 'test-key');
  vi.stubGlobal('fetch', async () => ({
    ok: true,
    status: 200,
    json: async () => [{ code: 'NVDA.US', open, close, previousClose: 99, timestamp: 1 }],
  }));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv('ADMIN_SECRET', SECRET);
  h.user = { uid: 'u1' };
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('market-open branch', () => {
  it('closes the live leg banked at the flip price and opens the new leg there (FLIP_MARKET_OPEN)', async () => {
    vi.setSystemTime(MARKET_OPEN_T);
    stubQuote({ close: 103 });
    const { db, captured } = makeDb({ groupDoc: battleGroup() });
    h.db = db;
    const { req, res } = makeReqRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const expectedBanked = calculateAssetScoreV3(
      { symbol: 'NVDA', baseATR: 2.5, direction: 'long' }, 3.0000000000000004, {}, {}, null
    ).totalPoints;
    expect(res.body).toMatchObject({
      from: 'long', to: 'short', marketState: 'open',
      flipCountToday: 1, flipPrice: 103,
      legIndexClosed: 0, legIndexOpened: 1,
    });
    expect(res.body.bankedLegScore).toBe(expectedBanked);

    const pick = captured.updates[0].players[0].picks[0];
    expect(pick.legs[0]).toMatchObject({ closedAt: MARKET_OPEN_T.toISOString(), bankedScore: expectedBanked });
    expect(pick.legs[1]).toEqual({
      direction: 'short',
      baselinePrice: 103,
      baselineSource: 'flip_market_open',
      openedAt: MARKET_OPEN_T.toISOString(),
      thresholdHistory: [], // fresh per-leg thresholds
      // canonical-open capture provenance — present-null on a fresh leg
      baselineCapturedAt: null,
      baselinePriceTimestamp: null,
      captureJobId: null,
      baselineSession: null,
      instrumentId: null,
      captureState: null,
    });
    expect(pick.flipCountDate).toBe(ET_DATE);
  });

  it('an intraday flip before first banking settles the null baseline from the quote open', async () => {
    vi.setSystemTime(MARKET_OPEN_T);
    stubQuote({ open: 100, close: 103 });
    const group = battleGroup();
    group.players[0].picks[0].legs[0].baselinePrice = null;
    const { db, captured } = makeDb({ groupDoc: group });
    h.db = db;
    const { req, res } = makeReqRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const closedLeg = captured.updates[0].players[0].picks[0].legs[0];
    expect(closedLeg.baselinePrice).toBe(100);
    expect(closedLeg.bankedScore).toBe(res.body.bankedLegScore);
  });

  it('502 price_unavailable when the feed is dead', async () => {
    vi.setSystemTime(MARKET_OPEN_T);
    vi.stubEnv('EODHD_API_KEY', '');
    h.db = makeDb({ groupDoc: battleGroup() }).db;
    const { req, res } = makeReqRes();
    await handler(req, res);
    expect(res.statusCode).toBe(502);
    expect(res.body.error).toBe('price_unavailable');
  });

  it('502 when only previousClose is available — a flip never executes at the prior session\'s price', async () => {
    vi.setSystemTime(MARKET_OPEN_T);
    vi.stubEnv('EODHD_API_KEY', 'test-key');
    vi.stubGlobal('fetch', async () => ({
      ok: true,
      status: 200,
      json: async () => [{ code: 'NVDA.US', open: 100, close: 'NA', previousClose: 148.2, timestamp: 1 }],
    }));
    h.db = makeDb({ groupDoc: battleGroup() }).db;
    const { req, res } = makeReqRes();
    await handler(req, res);
    expect(res.statusCode).toBe(502);
    expect(res.body.error).toBe('price_unavailable');
  });
});

describe('Phase 4 — realized P&L preservation across a flip (a flip cannot erase a loss)', () => {
  it('an in-hours flip AFTER A LOSS banks the negative realized P&L and sums it into the pick score', async () => {
    // Long from 100, flipped in-hours at 95 → a realized −5% loss. flip.js
    // (:168-171) banks it on the closed leg; scorePick (:149-153) sums banked
    // closed legs into the cumulative standing — the loss is NOT zeroed by the
    // flip, and the new short leg's live P&L is ADDED to it, never replaces it.
    vi.setSystemTime(MARKET_OPEN_T);
    stubQuote({ open: 100, close: 95 }); // flipPrice = current = 95, a loss on the long
    const { db, captured } = makeDb({ groupDoc: battleGroup() });
    h.db = db;
    const { req, res } = makeReqRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);

    const pick = captured.updates[0].players[0].picks[0];
    const closedLeg = pick.legs[0];

    // The realized loss is banked (negative), not discarded.
    const expectedLoss = calculateAssetScoreV3(
      { symbol: 'NVDA', baseATR: 2.5, direction: 'long' }, ((95 - 100) / 100) * 100, {}, {}, null
    ).totalPoints;
    expect(expectedLoss).toBeLessThan(0);
    expect(closedLeg.bankedScore).toBe(expectedLoss);
    expect(res.body.bankedLegScore).toBe(expectedLoss);

    // scorePick sums the banked loss + the new short leg's live P&L; the total
    // is realized-loss + new-live, and the banked component still carries the
    // full loss (a flip cannot launder it away).
    const scored = scorePick({ pick, baseATR: 2.5, quote: { current: 90 } }); // short 95→90 gains
    expect(scored.bankedPoints).toBe(expectedLoss);           // loss preserved in the standing
    expect(scored.livePoints).toBeGreaterThan(0);             // new short leg accrues its own P&L
    expect(scored.totalPoints).toBe(scored.bankedPoints + scored.livePoints); // realized + live, summed
    expect(scored.totalPoints).toBeLessThan(scored.livePoints); // the loss drags the total down — not erased
  });
});

describe('market-closed branch', () => {
  it('closes bank-pending (bankedScore key ABSENT, not null); new leg has a null baseline (FLIP_MARKET_CLOSED)', async () => {
    vi.setSystemTime(MARKET_CLOSED_T);
    const { db, captured } = makeDb({ groupDoc: battleGroup() });
    h.db = db;
    const { req, res } = makeReqRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      from: 'long', to: 'short', marketState: 'closed',
      flipPrice: null, bankedLegScore: null,
    });

    const pick = captured.updates[0].players[0].picks[0];
    expect(pick.legs[0].closedAt).toBe(MARKET_CLOSED_T.toISOString());
    expect('bankedScore' in pick.legs[0]).toBe(false); // omitted-not-null
    expect(pick.legs[1]).toMatchObject({
      direction: 'short',
      baselinePrice: null,
      baselineSource: 'flip_market_closed',
    });
  });

  it('holidays take the closed branch even mid-day', async () => {
    vi.setSystemTime(new Date('2026-06-19T14:00:00Z')); // Juneteenth, 10:00 ET
    const { db, captured } = makeDb({ groupDoc: battleGroup() });
    h.db = db;
    const { req, res } = makeReqRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.marketState).toBe('closed');
    expect('bankedScore' in captured.updates[0].players[0].picks[0].legs[0]).toBe(false);
  });
});

describe('daily cap + flipCountDate reset', () => {
  it('rejects the 6th flip of the ET day; a stale flipCountDate resets the counter', async () => {
    vi.setSystemTime(MARKET_CLOSED_T);

    const atCap = battleGroup();
    atCap.players[0].picks[0].flipCountToday = 5;
    atCap.players[0].picks[0].flipCountDate = ET_DATE;
    h.db = makeDb({ groupDoc: atCap }).db;
    const blocked = makeReqRes();
    await handler(blocked.req, blocked.res);
    expect(blocked.res.statusCode).toBe(409);
    expect(blocked.res.body.error).toBe('flip_cap_reached');

    // Same count from YESTERDAY resets across ET midnight.
    const stale = battleGroup();
    stale.players[0].picks[0].flipCountToday = 5;
    stale.players[0].picks[0].flipCountDate = '2026-06-09';
    const { db, captured } = makeDb({ groupDoc: stale });
    h.db = db;
    const ok = makeReqRes();
    await handler(ok.req, ok.res);
    expect(ok.res.statusCode).toBe(200);
    expect(ok.res.body.flipCountToday).toBe(1);
    expect(captured.updates[0].players[0].picks[0].flipCountDate).toBe(ET_DATE);
  });

  it('legacy picks without flipCountDate count from their stored flipCountToday only when dated today', async () => {
    vi.setSystemTime(MARKET_CLOSED_T);
    const undated = battleGroup(); // flipCountToday: 0, no flipCountDate
    undated.players[0].picks[0].flipCountToday = 5;
    h.db = makeDb({ groupDoc: undated }).db;
    const { req, res } = makeReqRes();
    await handler(req, res);
    // No flipCountDate → treated as a fresh day, not capped.
    expect(res.statusCode).toBe(200);
    expect(res.body.flipCountToday).toBe(1);
  });
});

describe('rider #4 — one atomic update with writer fields', () => {
  it('appends the feed event in the SAME update as the leg mutation, capped at 50', async () => {
    vi.setSystemTime(MARKET_CLOSED_T);
    const full = battleGroup({
      feed: Array.from({ length: 50 }, (_, i) => ({ type: 'flip', symbol: `OLD${i}`, timestamp: `T${i}` })),
    });
    const { db, captured } = makeDb({ groupDoc: full });
    h.db = db;
    const { req, res } = makeReqRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(captured.updates).toHaveLength(1); // leg mutation + feed: one write
    const { feed, players, updatedAt } = captured.updates[0];
    expect(players).toBeDefined();
    expect(updatedAt).toBe(MARKET_CLOSED_T.toISOString());
    expect(feed).toHaveLength(50); // capped
    expect(feed[0].symbol).toBe('OLD1'); // oldest dropped
    expect(feed.at(-1)).toEqual({
      type: 'flip',
      symbol: 'NVDA',
      odUserId: 'u1',
      from: 'long',
      to: 'short',
      timestamp: MARKET_CLOSED_T.toISOString(),
      flipPrice: null,
      bankedLegScore: null,
      legIndexClosed: 0,
      legIndexOpened: 1,
    });
  });

  it('first flip creates the feed field', async () => {
    vi.setSystemTime(MARKET_CLOSED_T);
    const { db, captured } = makeDb({ groupDoc: battleGroup() });
    h.db = db;
    const { req, res } = makeReqRes();
    await handler(req, res);
    expect(captured.updates[0].feed).toHaveLength(1);
  });
});

describe('D-1 user-side double-down (atomic with the flip)', () => {
  it('a flip on a symbol the OWN agent holds writes a flipped event to BOTH the ledger and the group feed', async () => {
    vi.setSystemTime(MARKET_CLOSED_T);
    const { db, captured } = makeDb({
      groupDoc: battleGroup(),
      stream: { events: [{ odUserId: 'u1', agentId: 'agent-mine', symbol: 'NVDA' }] },
      ledger: { held: { NVDA: { heldBy: 'agent-mine' } }, doubleDowns: [] },
    });
    h.db = db;
    const { req, res } = makeReqRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.doubledDown).toBe(true);
    // The ledger doubleDowns sibling got the side:'user' flipped event.
    const ledgerSet = captured.sets.find(s => s.ledger);
    expect(ledgerSet.data.doubleDowns).toEqual([{
      kind: 'flipped', side: 'user', symbol: 'NVDA', agentId: 'agent-mine',
      odUserId: 'u1', userDirection: 'short', from: 'long', to: 'short',
      at: MARKET_CLOSED_T.toISOString(),
    }]);
    // The group feed got BOTH the flip and the double_down entry — one update.
    expect(captured.updates).toHaveLength(1);
    const feed = captured.updates[0].feed;
    expect(feed.map(e => e.type)).toEqual(['flip', 'double_down']);
    expect(feed[1]).toMatchObject({ type: 'double_down', kind: 'flipped', side: 'user', symbol: 'NVDA', odUserId: 'u1' });
  });

  it('a flip on a symbol held by a RIVAL agent is no double-down — nothing written to the ledger', async () => {
    vi.setSystemTime(MARKET_CLOSED_T);
    const { db, captured } = makeDb({
      groupDoc: battleGroup(),
      stream: { events: [{ odUserId: 'u1', agentId: 'agent-mine', symbol: 'NVDA' }] },
      ledger: { held: { NVDA: { heldBy: 'agent-rival' } }, doubleDowns: [] },
    });
    h.db = db;
    const { req, res } = makeReqRes();
    await handler(req, res);

    expect(res.body.doubledDown).toBe(false);
    expect(captured.sets.filter(s => s.ledger)).toHaveLength(0); // contention near zero
    expect(captured.updates[0].feed.map(e => e.type)).toEqual(['flip']);
  });
});

describe('forceMarketState — admin-gated preview time-control', () => {
  it('forces the open branch off-hours WITH the secret; silently ignored without it', async () => {
    vi.setSystemTime(MARKET_CLOSED_T); // 18:00 ET — really closed
    stubQuote({ close: 103 });

    const withSecret = makeDb({ groupDoc: battleGroup() });
    h.db = withSecret.db;
    const forced = makeReqRes({ forceMarketState: 'open' }, { 'x-admin-secret': SECRET });
    await handler(forced.req, forced.res);
    expect(forced.res.statusCode).toBe(200);
    expect(forced.res.body.marketState).toBe('open');
    expect(forced.res.body.flipPrice).toBe(103);

    const noSecret = makeDb({ groupDoc: battleGroup() });
    h.db = noSecret.db;
    const ignored = makeReqRes({ forceMarketState: 'open' });
    await handler(ignored.req, ignored.res);
    expect(ignored.res.statusCode).toBe(200);
    expect(ignored.res.body.marketState).toBe('closed'); // real clock decided

    const wrongSecret = makeDb({ groupDoc: battleGroup() });
    h.db = wrongSecret.db;
    const bad = makeReqRes({ forceMarketState: 'open' }, { 'x-admin-secret': 'nope' });
    await handler(bad.req, bad.res);
    expect(bad.res.body.marketState).toBe('closed');
  });

  it('forces the closed branch during market hours with the secret', async () => {
    vi.setSystemTime(MARKET_OPEN_T); // 10:00 ET — really open
    h.db = makeDb({ groupDoc: battleGroup() }).db;
    const { req, res } = makeReqRes({ forceMarketState: 'closed' }, { 'x-admin-secret': SECRET });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.marketState).toBe('closed');
    expect(res.body.flipPrice).toBeNull();
  });
});

describe('ownership and shape guards', () => {
  it('non-members, unknown picks, and already-closed legs are rejected', async () => {
    vi.setSystemTime(MARKET_CLOSED_T);

    h.user = { uid: 'outsider' };
    h.db = makeDb({ groupDoc: battleGroup() }).db;
    const member = makeReqRes();
    await handler(member.req, member.res);
    expect(member.res.statusCode).toBe(403);
    expect(member.res.body.error).toBe('not_member');

    h.user = { uid: 'u1' };
    const unknown = makeReqRes({ symbol: 'GHOST' });
    await handler(unknown.req, unknown.res);
    expect(unknown.res.statusCode).toBe(404);
    expect(unknown.res.body.error).toBe('pick_not_found');

    const closedLegGroup = battleGroup();
    closedLegGroup.players[0].picks[0].legs[0].closedAt = 'T1';
    h.db = makeDb({ groupDoc: closedLegGroup }).db;
    const closed = makeReqRes();
    await handler(closed.req, closed.res);
    expect(closed.res.statusCode).toBe(409);
    expect(closed.res.body.error).toBe('leg_already_closed');
  });

  it('404 group_not_found / 409 not_battle / 400 shape errors', async () => {
    vi.setSystemTime(MARKET_CLOSED_T);

    h.db = makeDb().db;
    const missing = makeReqRes();
    await handler(missing.req, missing.res);
    expect(missing.res.statusCode).toBe(404);

    h.db = makeDb({ groupDoc: battleGroup({ status: 'forming' }) }).db;
    const forming = makeReqRes();
    await handler(forming.req, forming.res);
    expect(forming.res.statusCode).toBe(409);

    const badId = makeReqRes({ groupId: 'a/b' });
    await handler(badId.req, badId.res);
    expect(badId.res.statusCode).toBe(400);

    const noSymbol = makeReqRes({ symbol: '' });
    await handler(noSymbol.req, noSymbol.res);
    expect(noSymbol.res.statusCode).toBe(400);
  });
});
