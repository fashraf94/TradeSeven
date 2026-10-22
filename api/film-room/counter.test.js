// api/film-room/counter.test.js
//
// Film Room B2 item 6 — GET /api/film-room/counter through the handler (Build
// B spec §5; Amendment G RG-4): the gate as for the card endpoint, the agent
// from the query, the window, and the answer's shape over the in-memory
// Firestore. The counting itself is proven in api/_utils/filmRoom/cardCounter.test.js.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the handler imports cardCounter.js, which imports src/utils/filmRoomMoments.js
// and src/utils/tapeSchedule.js; this Node-environment import of the handler, unmocked, is the runtime proof that the
// route's src/ imports are plain modules (no browser or React dependency).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const state = vi.hoisted(() => ({ mode: 'on', uid: 'owner-1', authFails: false, middlewareHandles: false, db: null, middlewareCalls: [] }));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_ROOM_CARDS_MODE() { return state.mode; },
}));
vi.mock('../_utils/security.js', () => ({ applySecurityMiddleware: (_req, _res, opts) => { state.middlewareCalls.push(opts); return state.middlewareHandles; } }));
vi.mock('../_utils/authMiddleware.js', () => ({
  requireAuth: async (_req, res) => {
    if (state.authFails) { res.status(401).json({ error: 'Authentication required' }); return null; }
    return { uid: state.uid };
  },
}));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => state.db }));

const { default: handler, COUNTER_RATE_LIMIT } = await import('./counter.js');
const { makeTapeDb } = await import('../_utils/filmTape/__fixtures__/tapeFirestore.js');
const { createCard } = await import('../_utils/filmRoom/cardStore.js');

const UID = 'owner-1';
const AGENT = 'agent-1';
const ENV_BEFORE = process.env.COCKPIT_ALLOWLIST_UIDS;
const at = (date, seq) => new Date(Date.parse(`${date}T13:30:20.000Z`) + (seq - 1) * 15 * 60_000).toISOString();
const item = (date, symbol, seq) => ({ situationId: 'stalled', version: 2, symbol, tickSeq: seq, at: at(date, seq), count: 3, effectiveTicksThreshold: 5 });
const tapeDoc = (battleId, etDate, items, over = {}) => ({ tapeVersion: 2, battleId, ownerId: UID, agentId: AGENT, etDate, passes: { close: { status: 'written' } }, checks: [{ scores: { total: 1 } }], tags: { inputs: { archetypeCodeId: 'momentum_chaser' }, items, exits: [] }, ...over });

const mkRes = () => ({
  statusCode: null, body: null, headers: {},
  setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
  status(c) { this.statusCode = c; return this; },
  json(b) { this.body = b; return this; },
});
const get = async (query = { agentId: AGENT }, method = 'GET') => { const res = mkRes(); await handler({ method, headers: {}, query }, res); return res; };

let t;
beforeEach(() => {
  state.mode = 'on'; state.uid = UID; state.authFails = false; state.middlewareHandles = false; state.middlewareCalls = [];
  process.env.COCKPIT_ALLOWLIST_UIDS = UID;
  t = makeTapeDb({
    [`agents/${AGENT}`]: { ownerId: UID, archetype: 'momentum_chaser' },
    'agentBattles/b-1/tape/2026-10-19': tapeDoc('b-1', '2026-10-19', [item('2026-10-19', 'ACN', 4), item('2026-10-19', 'ACN', 5)]),
    'agentBattles/b-1/tape/2026-10-21': tapeDoc('b-1', '2026-10-21', [item('2026-10-21', 'MSFT', 2)]),
    'agentBattles/b-x/tape/2026-10-20': tapeDoc('b-x', '2026-10-20', [item('2026-10-20', 'XOM', 2)], { ownerId: 'someone-else' }),
  });
  state.db = t.db;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-28T23:00:00.000Z'));
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  if (ENV_BEFORE === undefined) delete process.env.COCKPIT_ALLOWLIST_UIDS; else process.env.COCKPIT_ALLOWLIST_UIDS = ENV_BEFORE;
});

describe('the gate — exactly as the card endpoint\'s', () => {
  it("mode 'off': 404 disabled before auth and before any read", async () => {
    state.mode = 'off'; state.authFails = true;
    const res = await get();
    expect(res.statusCode).toBe(404); expect(res.body).toEqual({ error: 'disabled' });
    expect(t.readLog).toEqual([]);
  });
  it("mode 'allowlist': an owner the list does not admit → 404; admitted → 200", async () => {
    state.mode = 'allowlist'; process.env.COCKPIT_ALLOWLIST_UIDS = 'someone-else';
    expect((await get()).statusCode).toBe(404);
    process.env.COCKPIT_ALLOWLIST_UIDS = UID;
    expect((await get()).statusCode).toBe(200);
  });
  it('no token → 401; POST → 405; the rate limit rides the shared middleware with the route\'s window', async () => {
    state.authFails = true;
    expect((await get()).statusCode).toBe(401);
    state.authFails = false;
    expect((await get({ agentId: AGENT }, 'POST')).statusCode).toBe(405);
    expect(state.middlewareCalls.every((o) => o.rateLimit === COUNTER_RATE_LIMIT)).toBe(true);
    expect(COUNTER_RATE_LIMIT).toEqual({ limit: 30, windowMs: 60_000 });
  });
});

describe('the answer', () => {
  it('the owner\'s days in the default window through the collection group, the weekly counts, the cards, and each open Watch card\'s recurrences; no-store', async () => {
    await createCard(t.db, { uid: UID, agentId: AGENT, opId: 'w1', payload: { archetypeCodeId: 'momentum_chaser', situationId: 'stalled', situationVersion: 2, battleId: 'b-1', etDate: '2026-10-19', symbol: 'ACN', fromTickSeq: 4, toTickSeq: 5, questionId: 'stalled.want', questionVersion: 1, note: 'Let it go.', route: 'watch' }, nowIso: '2026-10-20T02:00:00.000Z' });
    const res = await get();
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body).toMatchObject({ agentId: AGENT, archetypeCodeId: 'momentum_chaser', window: { from: '2026-06-30', to: '2026-10-28' }, open: 1, cap: 5 });
    expect(res.body.weekly).toEqual({ [AGENT]: { stalled: { '2026-10-19': { tags: 3, moments: 2 } } } });
    expect(res.body.cards.map((c) => [c.entryId, c.shelved])).toEqual([['w1', false]]);
    expect(res.body.recurrences).toEqual({ w1: [{ battleId: 'b-1', etDate: '2026-10-21', situationId: 'stalled', symbol: 'MSFT', fromTickSeq: 2, toTickSeq: 2, from: at('2026-10-21', 2), to: at('2026-10-21', 2), checks: 1 }] });
    expect(t.readLog).toContain('group:tape');
    expect(t.writeLog.filter((w) => w.path.includes('/tape/'))).toEqual([]);
    expect(JSON.stringify(res.body)).not.toContain('someone-else');
  });
  it('the caller\'s window is honoured; a malformed one → 400; agentId required → 400; another owner\'s agent → 403', async () => {
    expect((await get({ agentId: AGENT, from: '2026-10-20', to: '2026-10-31' })).body.weekly).toEqual({ [AGENT]: { stalled: { '2026-10-19': { tags: 1, moments: 1 } } } });
    expect((await get({ agentId: AGENT, from: 'x', to: 'y' })).body).toMatchObject({ error: 'invalid_window' });
    expect((await get({ agentId: AGENT, from: '2025-01-01', to: '2026-10-28' })).body).toMatchObject({ error: 'window_too_long' });
    expect((await get({})).body).toMatchObject({ error: 'invalid_agent_id' });
    expect((await get({ agentId: 'a/b' })).body).toMatchObject({ error: 'invalid_agent_id' });
    state.uid = 'someone-else';
    const res = await get();
    expect(res.statusCode).toBe(403);
    expect(Object.keys(res.body).sort()).toEqual(['error', 'message']);
  });
  it('an array-valued query (Vercel\'s ?agentId=a&agentId=b) takes the first', async () => {
    expect((await get({ agentId: [AGENT, 'other'] })).statusCode).toBe(200);
  });
});
