// src/utils/filmRoomGate.test.js
//
// Amendment E BA-40 — the Film Room v2 gate, per battle owner: the mode read
// at call time and failing closed, the one cached verdict per battle, and the
// server answer it reads (the existing cockpit-status route's `allowlisted`
// field — no new endpoint, no uid in the client).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const flags = vi.hoisted(() => ({ mode: 'off', throws: false }));
vi.mock('../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_ROOM_V2_MODE() { if (flags.throws) throw new Error('hermetic mock omitted the name'); return flags.mode; },
}));
const auth = vi.hoisted(() => ({ user: { getIdToken: async () => 'token-1' } }));
vi.mock('firebase/auth', () => ({ getAuth: () => ({ currentUser: auth.user }) }));

import {
  resolveFilmRoomV2Mode, filmRoomV2On, readFilmRoomVerdict, requestFilmRoomVerdict, resetFilmRoomVerdicts,
  cachedFilmRoomVerdict, resolveFilmRoomV2ForBattle, filmRoomBattleId, FILM_ROOM_VERDICT_PATH,
} from './filmRoomGate';

const realFetch = globalThis.fetch;
beforeEach(() => { flags.mode = 'off'; flags.throws = false; auth.user = { getIdToken: async () => 'token-1' }; resetFilmRoomVerdicts(); });
afterEach(() => { globalThis.fetch = realFetch; });

const respond = (status, body) => vi.fn(async () => ({ ok: status >= 200 && status < 300, status, json: async () => body }));

describe('the mode — read at call time, unknown or unreadable → off', () => {
  it.each([['off', 'off'], ['allowlist', 'allowlist'], ['on', 'on'], ['ON', 'off'], ['', 'off'], [true, 'off'], [undefined, 'off']])('%s → %s', (value, want) => {
    flags.mode = value;
    expect(resolveFilmRoomV2Mode()).toBe(want);
  });

  it('a mock that throws on the name reads off', () => {
    flags.throws = true;
    expect(resolveFilmRoomV2Mode()).toBe('off');
  });

  it('per-owner resolution: on for every owner only in on; in allowlist only with a definite yes', () => {
    expect(filmRoomV2On('off', true)).toBe(false);
    expect(filmRoomV2On('on', undefined)).toBe(true);
    expect(filmRoomV2On('allowlist', true)).toBe(true);
    expect(filmRoomV2On('allowlist', false)).toBe(false);
    expect(filmRoomV2On('allowlist', undefined)).toBe(false);
  });
});

describe('the verdict — the existing cockpit-status answer, asked once per battle', () => {
  it('asks GET /api/agent/cockpit-status for the battle, with the bearer token, never cached by the browser', async () => {
    globalThis.fetch = respond(200, { on: false, allowlisted: true });
    expect(await requestFilmRoomVerdict('b 1')).toEqual({ ok: true, allowlisted: true });
    expect(FILM_ROOM_VERDICT_PATH).toBe('/api/agent/cockpit-status');
    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(url).toBe('/api/agent/cockpit-status?battleId=b%201');
    expect(init.headers.Authorization).toBe('Bearer token-1');
    expect(init.cache).toBe('no-store');
  });

  it('reads the allowlist verdict alone — `on` (the calls mode) never stands in for it', async () => {
    globalThis.fetch = respond(200, { on: true, allowlisted: false });
    expect(await requestFilmRoomVerdict('b1')).toEqual({ ok: true, allowlisted: false });
    globalThis.fetch = respond(200, { on: true });
    expect(await requestFilmRoomVerdict('b1')).toEqual({ ok: false, allowlisted: false });
  });

  it('every refusal, failure and malformed body reads false', async () => {
    for (const f of [respond(403, { error: 'forbidden' }), respond(404, {}), respond(500, {}), respond(200, null), respond(200, { allowlisted: 'yes' }), vi.fn(async () => { throw new Error('down'); })]) {
      globalThis.fetch = f;
      expect(await requestFilmRoomVerdict('b1')).toEqual({ ok: false, allowlisted: false });
    }
    auth.user = null;
    globalThis.fetch = respond(200, { allowlisted: true });
    expect(await requestFilmRoomVerdict('b1')).toEqual({ ok: false, allowlisted: false });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('one request per battle: a definite answer is cached and concurrent callers share the request', async () => {
    let n = 0;
    const request = vi.fn(async () => { n += 1; return { ok: true, allowlisted: true }; });
    const [a, b] = await Promise.all([readFilmRoomVerdict('b1', { request }), readFilmRoomVerdict('b1', { request })]);
    expect([a, b]).toEqual([true, true]);
    expect(await readFilmRoomVerdict('b1', { request })).toBe(true);
    expect(n).toBe(1);
    expect(cachedFilmRoomVerdict('b1')).toBe(true);
    expect(cachedFilmRoomVerdict('b2')).toBeUndefined();
  });

  it('a failed ask is not cached — the next open asks again; a definite no is cached', async () => {
    const fail = vi.fn(async () => ({ ok: false, allowlisted: false }));
    expect(await readFilmRoomVerdict('b1', { request: fail })).toBe(false);
    expect(cachedFilmRoomVerdict('b1')).toBeUndefined();
    const no = vi.fn(async () => ({ ok: true, allowlisted: false }));
    expect(await readFilmRoomVerdict('b1', { request: no })).toBe(false);
    expect(cachedFilmRoomVerdict('b1')).toBe(false);
    expect(await readFilmRoomVerdict('b1', { request: no })).toBe(false);
    expect(no).toHaveBeenCalledTimes(1);
  });

  it('no battle id → false without a request', async () => {
    const request = vi.fn();
    expect(await readFilmRoomVerdict(null, { request })).toBe(false);
    expect(await readFilmRoomVerdict('', { request })).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });
});

describe('resolveFilmRoomV2ForBattle — per battle owner', () => {
  it("'off' and 'on' resolve without a request; 'allowlist' asks for the battle's id", async () => {
    const readVerdict = vi.fn(async () => true);
    flags.mode = 'off';
    expect(await resolveFilmRoomV2ForBattle({ id: 'b1' }, { readVerdict })).toBe(false);
    flags.mode = 'on';
    expect(await resolveFilmRoomV2ForBattle({ id: 'b1' }, { readVerdict })).toBe(true);
    expect(readVerdict).not.toHaveBeenCalled();
    flags.mode = 'allowlist';
    expect(await resolveFilmRoomV2ForBattle({ id: 'b1', agentBattleId: 'ab1' }, { readVerdict })).toBe(true);
    expect(readVerdict).toHaveBeenCalledWith('ab1', { ownerId: null });
    expect(await resolveFilmRoomV2ForBattle({ id: 'b2' }, { readVerdict: async () => false })).toBe(false);
    expect(await resolveFilmRoomV2ForBattle({}, { readVerdict })).toBe(false);
  });

  it('the battle id is the legacy screen\'s own rule (agentBattleId, else id)', () => {
    expect(filmRoomBattleId({ agentBattleId: 'a', id: 'b' })).toBe('a');
    expect(filmRoomBattleId({ id: 'b' })).toBe('b');
    expect(filmRoomBattleId({})).toBeNull();
    expect(filmRoomBattleId(null)).toBeNull();
  });
});

// ── the §2 review's rows (docs/audits/20261008_BUILD_FILM_ROOM_A2.md §3) ─────

describe('review A2L2-6 / A2L2-10 — one verdict per OWNER; the bound covers the whole ask', () => {
  it('A2L2-6: two battles of one owner ask the server once; another owner is asked separately; no owner → per battle', async () => {
    const request = vi.fn(async () => ({ ok: true, allowlisted: true }));
    expect(await readFilmRoomVerdict('b1', { ownerId: 'u1', request })).toBe(true);
    expect(await readFilmRoomVerdict('b2', { ownerId: 'u1', request })).toBe(true);
    expect(request).toHaveBeenCalledTimes(1);
    expect(cachedFilmRoomVerdict('b9', { ownerId: 'u1' })).toBe(true);
    expect(await readFilmRoomVerdict('b3', { ownerId: 'u2', request })).toBe(true);
    expect(request).toHaveBeenCalledTimes(2);
    expect(await readFilmRoomVerdict('b4', { request })).toBe(true);
    expect(await readFilmRoomVerdict('b5', { request })).toBe(true);
    expect(request).toHaveBeenCalledTimes(4);
  });

  it('A2L2-10: a token that never arrives reads false at the bound — the bound covers the token, not only the fetch', async () => {
    vi.useFakeTimers();
    try {
      auth.user = { getIdToken: () => new Promise(() => {}) };
      globalThis.fetch = vi.fn();
      const p = requestFilmRoomVerdict('b1');
      await vi.advanceTimersByTimeAsync(8_001);
      await expect(p).resolves.toEqual({ ok: false, allowlisted: false });
      expect(globalThis.fetch).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
