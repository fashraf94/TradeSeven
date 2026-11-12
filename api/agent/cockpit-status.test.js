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

// `control` is the release cohort's control document (cockpitConfig/release): undefined = absent, the dark state.
const state = vi.hoisted(() => ({ uid: 'owner-uid-1', authFails: false, callsMode: 'on', middlewareHandles: false, battles: {}, reads: [], throwOnRead: false, control: undefined, controlThrows: false, controlFailFirst: false }));
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
          if (name === 'cockpitConfig' && state.controlThrows) throw new Error('control read down');
          if (name === 'cockpitConfig' && state.controlFailFirst) { state.controlFailFirst = false; throw new Error('cold start'); }
          if (state.throwOnRead && name !== 'cockpitConfig') throw new Error('firestore down');
          const data = name === 'cockpitConfig' ? state.control : state.battles[id];
          return { exists: data !== undefined, data: () => data };
        },
      }),
    }),
  }),
}));

const { default: handler, resetCockpitStatusRateLimit, COCKPIT_STATUS_USER_RATE_LIMIT } = await import('./cockpit-status.js');
// The release cohort's cached view, reset per row (the real module — never mocked; BUILD_RULES §4 runtime guard).
const { resetReleaseView, bucketOf, RELEASE_VIEW_TTL_MS } = await import('../_utils/callRecords/release.js');

const BATTLE = 'battle-1';
// Cockpit Build 2b (spec S-9): the 200 body carries the server's own clock — frozen here so it is exact.
const NOW = Date.parse('2026-10-15T16:00:00.000Z');
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
  state.control = undefined;
  state.controlThrows = false;
  state.controlFailFirst = false;
  resetReleaseView();
  process.env.COCKPIT_ALLOWLIST_UIDS = 'owner-uid-1';
  resetCockpitStatusRateLimit();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
  if (ENV_BEFORE === undefined) delete process.env.COCKPIT_ALLOWLIST_UIDS; else process.env.COCKPIT_ALLOWLIST_UIDS = ENV_BEFORE;
});

describe('the answer — the server\'s own resolution, for the owner alone', () => {
  it('on: CALL_RECORDS_MODE on and the owner allowlisted → 200 { on: true, allowlisted: true }, Cache-Control: no-store, one read', async () => {
    const res = await get();
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ on: true, allowlisted: true, serverNowMs: NOW });
    expect(res.headers['cache-control']).toBe('no-store');
    // One battle read, and (release switch) the control document's view, read once and then cached for 60 s.
    expect(state.reads.filter((r) => r.startsWith('agentBattles/'))).toEqual([`agentBattles/${BATTLE}`]);
    expect(state.reads.filter((r) => r.startsWith('cockpitConfig/'))).toEqual(['cockpitConfig/release']);
    expect(state.reads).toHaveLength(2);
  });

  it('off: global off, global shadow, or an owner not on the allowlist → 200 { on: false } — `allowlisted` is the allowlist alone, never the calls mode', async () => {
    for (const [mode, allow, allowlisted] of [['off', 'owner-uid-1', true], ['shadow', 'owner-uid-1', true], ['on', 'someone-else', false], ['on', '', false]]) {
      state.callsMode = mode;
      process.env.COCKPIT_ALLOWLIST_UIDS = allow;
      resetCockpitStatusRateLimit();
      const res = await get();
      expect(res.statusCode, `${mode}/${allow}`).toBe(200);
      expect(res.body, `${mode}/${allow}`).toEqual({ on: false, allowlisted, serverNowMs: NOW });
      expect(res.headers['cache-control']).toBe('no-store');
    }
  });

  it('a rollback (the uid removed from the environment the instance sees) is visible on the very next ask — no cache', async () => {
    expect((await get()).body).toEqual({ on: true, allowlisted: true, serverNowMs: NOW });
    process.env.COCKPIT_ALLOWLIST_UIDS = '';
    expect((await get()).body).toEqual({ on: false, allowlisted: false, serverNowMs: NOW });
  });

  it('BA-40: the one added field — exactly `on` and `allowlisted`, both booleans (plus 2b S-9\'s serverNowMs); a malformed owner reads not allowlisted', async () => {
    const res = await get();
    expect(Object.keys(res.body).sort()).toEqual(['allowlisted', 'on', 'serverNowMs']);
    state.battles[BATTLE] = { ownerId: 42, status: 'active' };
    state.uid = 42;
    resetCockpitStatusRateLimit();
    expect((await get()).body).toEqual({ on: false, allowlisted: false, serverNowMs: NOW });
  });
});

describe('Cockpit Build 2b — S-9: the server\'s clock', () => {
  it('the 200 body carries serverNowMs = the server\'s own Date.now() at the answer, and Cache-Control stays no-store', async () => {
    const res = await get();
    expect(res.statusCode).toBe(200);
    expect(res.body.serverNowMs).toBe(NOW);
    vi.setSystemTime(NOW + 61_000);
    resetCockpitStatusRateLimit();
    expect((await get()).body.serverNowMs).toBe(NOW + 61_000);
    expect(res.headers['cache-control']).toBe('no-store');
  });
  it('no refusal carries it: a 403 or a 404 says only its error', async () => {
    state.uid = 'someone-else';
    expect((await get()).body).toEqual({ error: 'forbidden' });
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
    expect(res.body).not.toHaveProperty('allowlisted');
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
    expect((await get({ battleId: [BATTLE] })).body).toEqual({ on: true, allowlisted: true, serverNowMs: NOW });
  });

  it('404 for a battle that does not exist; 500 when the read fails (the client reads both as off)', async () => {
    expect((await get({ battleId: 'nope' })).statusCode).toBe(404);
    state.throwOnRead = true;
    const res = await get();
    expect(res.statusCode).toBe(500);
    expect(res.body).not.toHaveProperty('on');
    expect(res.body).not.toHaveProperty('allowlisted');
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
    expect(src).toContain('allowlisted: isCockpitOwnerAllowlisted(battle?.ownerId)');
    expect(src).toMatch(/requireAuth\(req, res\)/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The cockpit's own release switch (build prompt BUILD_PROMPT_COCKPIT_RELEASE_SWITCH):
// `on` follows the resolver (the allowlist OR the release cohort); `allowlisted`
// stays the allowlist verdict ALONE — Film Room cards, Bomb mode, the sheet and Ask
// read it as their pilot cohort, so it must not move with the cockpit's release.

/** The first synthetic owner id whose bucket under `salt` is in [lo, hi). */
function ownerInBuckets(salt, lo, hi) {
  for (let i = 0; i < 200000; i += 1) {
    const id = `cohort-owner-${i}`;
    const b = bucketOf(id, salt);
    if (b >= lo && b < hi) return id;
  }
  throw new Error('no owner found');
}
const SALT = 'salt-a';
const asOwner = (id, battle = {}) => {
  state.uid = id;
  state.battles = { [BATTLE]: { ownerId: id, status: 'active', gameMode: 'baggerbomb_agent', ...battle } };
};

describe('the release cohort — `on` follows the resolver, `allowlisted` stays the allowlist alone', () => {
  it('a non-allowlisted agent-mode owner under the share → on: true, allowlisted: false', async () => {
    state.control = { shareBp: 5000, disabled: false, salt: SALT };
    asOwner(ownerInBuckets(SALT, 0, 5000));
    expect((await get()).body).toEqual({ on: true, allowlisted: false, serverNowMs: NOW });
  });

  it('an owner at or over the share, a disabled document, a missing one and a malformed one → on: false (allowlisted false in every case)', async () => {
    const over = ownerInBuckets(SALT, 5000, 10000);
    const under = ownerInBuckets(SALT, 0, 5000);
    for (const [control, owner, why] of [
      [{ shareBp: 5000, disabled: false, salt: SALT }, over, 'over the share'],
      [{ shareBp: 5000, disabled: true, salt: SALT }, under, 'disabled'],
      [undefined, under, 'no document'],
      [{ shareBp: '5000', disabled: false, salt: SALT }, under, 'malformed shareBp'],
      [{ shareBp: 5000, disabled: false }, under, 'no salt'],
      [{ shareBp: 0, disabled: false, salt: SALT }, under, 'share 0'],
    ]) {
      resetReleaseView();
      resetCockpitStatusRateLimit();
      state.control = control;
      asOwner(owner);
      expect((await get()).body, why).toEqual({ on: false, allowlisted: false, serverNowMs: NOW });
    }
  });

  it('League, a CPU seat and an ownerless battle are never in the cohort, even at share 10000', async () => {
    state.control = { shareBp: 10000, disabled: false, salt: SALT };
    const owner = ownerInBuckets(SALT, 0, 10000);
    for (const [battle, why] of [[{ gameMode: 'baggerbomb_tournament' }, 'League'], [{ isCpu: true }, 'CPU seat'], [{ gameMode: undefined }, 'no game mode']]) {
      resetReleaseView();
      resetCockpitStatusRateLimit();
      asOwner(owner, battle);
      expect((await get()).body.on, why).toBe(false);
    }
  });

  it('an allowlisted owner is unchanged: on in League and in agent mode, with the control document absent or disabled (the allowlist path is not touched)', async () => {
    for (const control of [undefined, { shareBp: 0, disabled: true, salt: SALT }]) {
      for (const gameMode of ['baggerbomb_tournament', 'baggerbomb_agent']) {
        resetReleaseView();
        resetCockpitStatusRateLimit();
        state.control = control;
        asOwner('owner-uid-1', { gameMode });
        expect((await get()).body, `${gameMode}`).toEqual({ on: true, allowlisted: true, serverNowMs: NOW });
      }
    }
  });

  it('the kill switch: the view is cached for 60 s, so `disabled: true` shows on the first ask after the TTL — and not before', async () => {
    const owner = ownerInBuckets(SALT, 0, 10000);
    state.control = { shareBp: 10000, disabled: false, salt: SALT };
    asOwner(owner);
    expect((await get()).body.on).toBe(true);
    state.control = { shareBp: 10000, disabled: true, salt: SALT };
    vi.setSystemTime(NOW + RELEASE_VIEW_TTL_MS - 1);
    resetCockpitStatusRateLimit();
    expect((await get()).body.on).toBe(true);
    expect(state.reads.filter((r) => r === 'cockpitConfig/release')).toHaveLength(1);
    vi.setSystemTime(NOW + RELEASE_VIEW_TTL_MS + 1);
    resetCockpitStatusRateLimit();
    expect((await get()).body).toEqual({ on: false, allowlisted: false, serverNowMs: NOW + RELEASE_VIEW_TTL_MS + 1 });
    expect(state.reads.filter((r) => r === 'cockpitConfig/release')).toHaveLength(2);
  });

  it('a control-document read that FAILS cannot fail the route: the cohort is empty and the allowlist alone decides (a read that never answers is the default-bound row in release.test.js)', async () => {
    const owner = ownerInBuckets(SALT, 0, 10000);
    asOwner(owner);
    state.control = { shareBp: 10000, disabled: false, salt: SALT };
    // a read error on the control document only
    state.controlThrows = true;
    const res = await get();
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ on: false, allowlisted: false, serverNowMs: NOW });
  });
});

// RS-L2-2: the control read ran alongside the first RPC of a possibly cold instance. If it fails, the channel is warm by the
// time the battle read lands, so the route asks ONCE more rather than answer `on: false` for a cohort player (the client
// re-asks only on a status change).
describe('a failed control read is retried once after the battle read', () => {
  it('an error on the first control read, then a good one → the cohort player is answered on: true', async () => {
    const owner = ownerInBuckets('salt-a', 0, 10000);
    asOwner(owner);
    state.control = { shareBp: 10000, disabled: false, salt: 'salt-a' };
    state.controlFailFirst = true;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect((await get()).body).toEqual({ on: true, allowlisted: false, serverNowMs: NOW });
    expect(state.reads.filter((r) => r === 'cockpitConfig/release')).toHaveLength(2);
  });
  it('a control read that keeps failing answers off (fail closed), after exactly one retry', async () => {
    const owner = ownerInBuckets('salt-a', 0, 10000);
    asOwner(owner);
    state.control = { shareBp: 10000, disabled: false, salt: 'salt-a' };
    state.controlThrows = true;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect((await get()).body).toEqual({ on: false, allowlisted: false, serverNowMs: NOW });
    expect(state.reads.filter((r) => r === 'cockpitConfig/release')).toHaveLength(2);
  });
});
