// api/tournament/slot-endpoints.test.js
//
// Competitive Live Draft — the authed, flag-gated slot-* endpoints, end to end
// over the REAL liveDraftFormation service against an in-memory Firestore.
// Covers: THE FLAG GATE (404 when LEAGUE_LIVE_DRAFT is off — the byte-identical
// defense-in-depth bar), the method guard, auth, and the happy-path
// claim → schedule → release flow (incl. delete-on-last-release).
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): this file's REAL import of the
// endpoint modules is the runtime guard for their api/ -> src/ import surface
// (liveDraftEndpoint.js -> src/config/featureFlags.js; liveDraftFormation.js ->
// src/constants/leagueTournament.js). Only the admin/auth boundary and the
// (zero-import) flags are mocked; the service graph is real.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const h = vi.hoisted(() => ({ flag: true, db: null, user: { uid: 'u1', name: 'Ada' } }));

vi.mock('../../src/config/featureFlags.js', () => ({
  get LEAGUE_LIVE_DRAFT() { return h.flag; },
  LEAGUE_CANONICAL_OPEN_CAPTURE: false,
  LEAGUE_LOBBY_ENABLED: true, // lobbyEndpoint.js (parseBody/resolveDisplayName reuse) imports it
}));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => h.db }));
vi.mock('../_utils/authMiddleware.js', () => ({
  requireAuth: async (req, res) => {
    if (h.user) return h.user;
    res.status(401).json({ error: 'Authentication required' });
    return null;
  },
}));

import claimHandler from './slot-claim.js';
import releaseHandler from './slot-release.js';
import scheduleHandler from './slot-schedule.js';
import pickHandler from './live-draft-pick.js';

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  h.flag = true;
  h.user = { uid: 'u1', name: 'Ada' };
  h.db = makeDb();
});
afterEach(() => vi.restoreAllMocks());

// ---- in-memory Firestore (get/set/update/delete in a single-pass txn) ----
function applyDotPathUpdate(target, updates) {
  for (const [key, value] of Object.entries(updates)) {
    const parts = key.split('.');
    let node = target;
    for (let i = 0; i < parts.length - 1; i++) {
      if (typeof node[parts[i]] !== 'object' || node[parts[i]] == null) node[parts[i]] = {};
      node = node[parts[i]];
    }
    node[parts[parts.length - 1]] = value;
  }
}
function makeDb(initial = {}) {
  const store = new Map(Object.entries(initial).map(([k, v]) => [k, structuredClone(v)]));
  const snap = (p) => ({ exists: store.has(p), id: p.split('/').pop(), data: () => structuredClone(store.get(p)) });
  const ref = (p) => ({ path: p, get: async () => snap(p) });
  return {
    _store: store,
    collection: (name) => ({ doc: (id) => ref(`${name}/${id}`) }),
    runTransaction: async (fn) => fn({
      get: async (r) => snap(r.path),
      set: (r, data) => store.set(r.path, structuredClone(data)),
      update: (r, patch) => { const d = store.get(r.path); if (d === undefined) throw new Error('missing'); applyDotPathUpdate(d, patch); },
      delete: (r) => store.delete(r.path),
    }),
  };
}
function mockRes() {
  return {
    statusCode: null, body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
    end() { return this; },
    setHeader() {},
  };
}
const req = (method, body = {}) => ({ method, body, headers: {} });

// ==================== FLAG GATE (byte-identical off) ====================

describe('slot-* endpoints — flag gate + method guard', () => {
  it('404s every endpoint when LEAGUE_LIVE_DRAFT is off (defense-in-depth)', async () => {
    h.flag = false;
    const cases = [
      [claimHandler, req('POST', { slotId: 'wed-1900' })],
      [releaseHandler, req('POST', { groupId: 'lds_wed-1900_2026-07-08' })],
      [scheduleHandler, req('GET')],
      [pickHandler, req('POST', { groupId: 'lds_wed-1900_2026-07-08', symbol: 'NVDA' })],
    ];
    for (const [handler, r] of cases) {
      const res = mockRes();
      await handler(r, res);
      expect(res.statusCode).toBe(404);
      expect(res.body.error).toBe('live_draft_disabled');
    }
  });

  it('405s the wrong method even while the flag is on', async () => {
    const res1 = mockRes();
    await claimHandler(req('GET'), res1); // claim is POST-only
    expect(res1.statusCode).toBe(405);

    const res2 = mockRes();
    await scheduleHandler(req('POST'), res2); // schedule is GET-only
    expect(res2.statusCode).toBe(405);
  });

  it('401s when unauthenticated (flag on, method ok)', async () => {
    h.user = null;
    const res = mockRes();
    await claimHandler(req('POST', { slotId: 'wed-1900' }), res);
    expect(res.statusCode).toBe(401);
  });
});

// ==================== HAPPY PATH (flag on, real service) ====================

describe('slot-* endpoints — claim → schedule → release', () => {
  it('claims a seat (creating the group), then a second claim joins it', async () => {
    const res1 = mockRes();
    await claimHandler(req('POST', { slotId: 'wed-1900', displayName: 'Ada' }), res1);
    expect(res1.statusCode).toBe(200);
    expect(res1.body).toMatchObject({ created: true, humanCount: 1 });
    expect(typeof res1.body.groupId).toBe('string');
    expect(typeof res1.body.scheduledDraftAt).toBe('string');

    h.user = { uid: 'u2', name: 'Bo' };
    const res2 = mockRes();
    await claimHandler(req('POST', { slotId: 'wed-1900', displayName: 'Bo' }), res2);
    expect(res2.statusCode).toBe(200);
    expect(res2.body).toMatchObject({ created: false, joined: true, humanCount: 2 });
    expect(res2.body.groupId).toBe(res1.body.groupId); // same occurrence
  });

  it('rejects an unknown slot id with 400', async () => {
    const res = mockRes();
    await claimHandler(req('POST', { slotId: 'nope' }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('unknown_slot');
  });

  it('schedule returns the week’s slots with counts', async () => {
    await claimHandler(req('POST', { slotId: 'wed-1900', displayName: 'Ada' }), mockRes());
    const res = mockRes();
    await scheduleHandler(req('GET'), res);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.slots)).toBe(true);
    const wed = res.body.slots.find((s) => s.slotId === 'wed-1900');
    expect(wed.humanCount).toBe(1);
    expect(wed.seats).toEqual([{ odUserId: 'u1', name: 'Ada' }]);
  });

  it('release frees the seat and (last human) deletes the group', async () => {
    const claimRes = mockRes();
    await claimHandler(req('POST', { slotId: 'wed-1900' }), claimRes);
    const { groupId } = claimRes.body;

    const relRes = mockRes();
    await releaseHandler(req('POST', { groupId }), relRes);
    expect(relRes.statusCode).toBe(200);
    expect(relRes.body).toMatchObject({ released: true, deleted: true, humanCount: 0 });
    expect(h.db._store.has(`tournamentGroups/${groupId}`)).toBe(false);
  });

  it('rejects a malformed groupId on release with 400', async () => {
    const res = mockRes();
    await releaseHandler(req('POST', { groupId: 'bad/slashes' }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('bad_group');
  });
});
