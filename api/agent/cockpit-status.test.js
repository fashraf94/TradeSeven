// api/agent/cockpit-status.test.js
//
// GET /api/agent/cockpit-status — IS THIS BATTLE COCKPIT-ON? (Cockpit Build 2a
// spec docs/COCKPIT_BUILD2A_SPEC_V1_0.md S-6, §11 "the status endpoint (401 /
// 403 / on / off / no-store)"). The server resolves the mode — the client
// never does — and answers the battle's owner alone.
//
// Dependency-surface guard (BUILD_RULES §4): the import of the route and of the
// real resolver (mode.js → allowlist.js) is never mocked; the allowlist is
// driven through the environment variable exactly as production sets it.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const state = vi.hoisted(() => ({ uid: 'owner-uid-1', authFails: false, callsMode: 'on', middlewareHandles: false, battles: {}, reads: [], throwOnRead: false }));
vi.mock('../_utils/security.js', () => ({ applySecurityMiddleware: () => state.middlewareHandles }));
vi.mock('../_utils/authMiddleware.js', () => ({
  requireAuth: async (_req, res) => {
    if (state.authFails) { res.status(401).json({ error: 'Unauthorized' }); return null; }
    return { uid: state.uid };
  },
}));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get CALL_RECORDS_MODE() { return state.callsMode; },
}));
vi.mock('../_utils/firebaseAdmin.js', () => ({
  getFirebaseAdmin: () => ({
    collection: (name) => ({
      doc: (id) => ({
        get: async () => {
          state.reads.push(`${name}/${id}`);
          if (state.throwOnRead) throw new Error('firestore down');
          const data = state.battles[id];
          return { exists: data !== undefined, data: () => data };
        },
      }),
    }),
  }),
}));

const { default: handler, resetCockpitStatusRateLimit, COCKPIT_STATUS_USER_RATE_LIMIT } = await import('./cockpit-status.js');

const BATTLE = 'battle-1';
const ENV_BEFORE = process.env.COCKPIT_ALLOWLIST_UIDS;
const mkRes = () => ({
  statusCode: null, body: null, headers: {},
  setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
  status(c) { this.statusCode = c; return this; },
  json(b) { this.body = b; return this; },
});
const get = async (query = { battleId: BATTLE }, method = 'GET') => { const res = mkRes(); await handler({ method, query }, res); return res; };

beforeEach(() => {
  state.uid = 'owner-uid-1';
  state.authFails = false;
  state.callsMode = 'on';
  state.middlewareHandles = false;
  state.battles = { [BATTLE]: { ownerId: 'owner-uid-1', status: 'active' } };
  state.reads = [];
  state.throwOnRead = false;
  process.env.COCKPIT_ALLOWLIST_UIDS = 'owner-uid-1';
  resetCockpitStatusRateLimit();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  if (ENV_BEFORE === undefined) delete process.env.COCKPIT_ALLOWLIST_UIDS; else process.env.COCKPIT_ALLOWLIST_UIDS = ENV_BEFORE;
});

describe('the answer — the server\'s own resolution, for the owner alone', () => {
  it('on: CALL_RECORDS_MODE on and the owner allowlisted → 200 { on: true }, Cache-Control: no-store, one read', async () => {
    const res = await get();
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ on: true });
    expect(res.headers['cache-control']).toBe('no-store');
    expect(state.reads).toEqual([`agentBattles/${BATTLE}`]);
  });

  it('off: global off, global shadow, or an owner not on the allowlist → 200 { on: false }', async () => {
    for (const [mode, allow] of [['off', 'owner-uid-1'], ['shadow', 'owner-uid-1'], ['on', 'someone-else'], ['on', '']]) {
      state.callsMode = mode;
      process.env.COCKPIT_ALLOWLIST_UIDS = allow;
      resetCockpitStatusRateLimit();
      const res = await get();
      expect(res.statusCode, `${mode}/${allow}`).toBe(200);
      expect(res.body, `${mode}/${allow}`).toEqual({ on: false });
      expect(res.headers['cache-control']).toBe('no-store');
    }
  });

  it('a rollback (the uid removed from the environment) is visible on the very next ask', async () => {
    expect((await get()).body).toEqual({ on: true });
    process.env.COCKPIT_ALLOWLIST_UIDS = '';
    expect((await get()).body).toEqual({ on: false });
  });
});

describe('the refusals, in order', () => {
  it('401 when the token does not verify — nothing read', async () => {
    state.authFails = true;
    const res = await get();
    expect(res.statusCode).toBe(401);
    expect(state.reads).toEqual([]);
  });

  it('403 for a signed-in caller who does not own the battle — even when the owner IS cockpit-on (no oracle on the allowlist)', async () => {
    state.uid = 'intruder';
    const res = await get();
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'forbidden' });
    expect(res.body).not.toHaveProperty('on');
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('405 for anything but GET; 400 without a battleId (string or first of an array) — before any read', async () => {
    expect((await get({ battleId: BATTLE }, 'POST')).statusCode).toBe(405);
    for (const query of [{}, { battleId: '' }, { battleId: '   ' }, { battleId: [] }, null]) {
      expect((await get(query)).statusCode, JSON.stringify(query)).toBe(400);
    }
    const bare = mkRes();
    await handler({ method: 'GET' }, bare);
    expect(bare.statusCode).toBe(400);
    expect(state.reads).toEqual([]);
    expect((await get({ battleId: [BATTLE] })).body).toEqual({ on: true });
  });

  it('404 for a battle that does not exist; 500 when the read fails (the client reads both as off)', async () => {
    expect((await get({ battleId: 'nope' })).statusCode).toBe(404);
    state.throwOnRead = true;
    const res = await get();
    expect(res.statusCode).toBe(500);
    expect(res.body).not.toHaveProperty('on');
  });

  it('the per-user window: the limit-th + 1 ask in a minute → 429, before any read', async () => {
    for (let i = 0; i < COCKPIT_STATUS_USER_RATE_LIMIT.limit; i += 1) expect((await get()).statusCode).toBe(200);
    const reads = state.reads.length;
    const res = await get();
    expect(res.statusCode).toBe(429);
    expect(res.body).toEqual({ error: 'rate_limited' });
    expect(state.reads.length).toBe(reads);
  });

  it('the IP limiter (the shared middleware) answers first: when it handles the request the route does nothing', async () => {
    state.middlewareHandles = true;
    const res = await get();
    expect(res.statusCode).toBeNull();
    expect(state.reads).toEqual([]);
  });
});

describe('the route is read-only and never decides on the client\'s word', () => {
  it('no write call, no body read, and the mode comes from resolveCallRecordsMode', () => {
    const src = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'cockpit-status.js'), 'utf8');
    // The one `.set(` is the in-process rate window's Map; no Firestore write exists.
    expect(src.replace(/windows\.set\(/g, '')).not.toMatch(/\.(set|update|create|delete|add)\(|runTransaction|batch\(/);
    expect(src.match(/\.get\(\)/g)).toHaveLength(1);
    expect(src).not.toMatch(/req\.body/);
    expect(src).toContain("resolveCallRecordsMode(battle) === 'on'");
    expect(src).toMatch(/requireAuth\(req, res\)/);
  });
});
