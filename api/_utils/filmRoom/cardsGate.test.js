// api/_utils/filmRoom/cardsGate.test.js
//
// Film Room B2 item 8 — the server gate for the two card routes (Build B
// spec §7; Amendment G RG-2): the mode read at call time and failing closed,
// per-owner admission through the cockpit's server-side allowlist (the real
// reader, driven through the environment variable exactly as production sets
// it), and the gate's fixed order: middleware → mode → auth → admission →
// method, 404 { error: 'disabled' } before any read.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const state = vi.hoisted(() => ({ mode: 'off', throws: false, uid: 'owner-1', authFails: false, middlewareHandles: false }));
vi.mock('../../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_ROOM_CARDS_MODE() { if (state.throws) throw new Error('hermetic mock omitted the name'); return state.mode; },
}));
vi.mock('../security.js', () => ({ applySecurityMiddleware: () => state.middlewareHandles }));
vi.mock('../authMiddleware.js', () => ({
  requireAuth: async (_req, res) => {
    if (state.authFails) { res.status(401).json({ error: 'Authentication required' }); return null; }
    return { uid: state.uid };
  },
}));

const { filmRoomCardsMode, filmRoomCardsFlagOn, filmRoomCardsOnFor, gateFilmRoomCardsRoute, DISABLED_BODY } = await import('./cardsGate.js');

const ENV_BEFORE = process.env.COCKPIT_ALLOWLIST_UIDS;
const mkRes = () => ({
  statusCode: null, body: null, headers: {},
  setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
  status(c) { this.statusCode = c; return this; },
  json(b) { this.body = b; return this; },
});
const gate = async (method = 'POST', methods = ['POST']) => { const res = mkRes(); const out = await gateFilmRoomCardsRoute({ method, headers: {} }, res, { methods, rateLimit: { limit: 10, windowMs: 60_000 } }); return { res, out }; };

beforeEach(() => {
  state.mode = 'off'; state.throws = false; state.uid = 'owner-1'; state.authFails = false; state.middlewareHandles = false;
  process.env.COCKPIT_ALLOWLIST_UIDS = 'owner-1';
});
afterEach(() => { if (ENV_BEFORE === undefined) delete process.env.COCKPIT_ALLOWLIST_UIDS; else process.env.COCKPIT_ALLOWLIST_UIDS = ENV_BEFORE; });

describe('the mode — read at call time, unknown or unreadable → off', () => {
  it.each([['off', 'off'], ['allowlist', 'allowlist'], ['on', 'on'], ['ON', 'off'], ['', 'off'], [true, 'off'], [undefined, 'off']])('%s → %s', (value, want) => {
    state.mode = value;
    expect(filmRoomCardsMode()).toBe(want);
    expect(filmRoomCardsFlagOn()).toBe(want !== 'off');
  });
  it('a mock that throws on the name reads off', () => {
    state.throws = true;
    expect(filmRoomCardsMode()).toBe('off');
    expect(filmRoomCardsOnFor('owner-1')).toBe(false);
  });
});

describe('per-owner admission', () => {
  it("'on': every verified uid; a malformed uid never", () => {
    state.mode = 'on';
    process.env.COCKPIT_ALLOWLIST_UIDS = '';
    expect(filmRoomCardsOnFor('owner-1')).toBe(true);
    expect(filmRoomCardsOnFor('someone-else')).toBe(true);
    expect(filmRoomCardsOnFor('')).toBe(false);
    expect(filmRoomCardsOnFor(null)).toBe(false);
  });
  it("'allowlist': the cockpit's server-side list, read now — listed yes, unlisted no, empty list nobody", () => {
    state.mode = 'allowlist';
    expect(filmRoomCardsOnFor('owner-1')).toBe(true);
    expect(filmRoomCardsOnFor('someone-else')).toBe(false);
    process.env.COCKPIT_ALLOWLIST_UIDS = ' owner-1 , owner-2 ';
    expect(filmRoomCardsOnFor('owner-2')).toBe(true);
    process.env.COCKPIT_ALLOWLIST_UIDS = '';
    expect(filmRoomCardsOnFor('owner-1')).toBe(false);
  });
  it("'off': nobody, listed or not", () => {
    expect(filmRoomCardsOnFor('owner-1')).toBe(false);
  });
});

describe('the gate order: middleware → mode → auth → admission → method', () => {
  it('the middleware answered (preflight, a 429): nothing else runs', async () => {
    state.middlewareHandles = true;
    state.mode = 'on';
    const { res, out } = await gate();
    expect(out).toBeNull();
    expect(res.statusCode).toBeNull();
  });
  it("'off': 404 { error: 'disabled' } BEFORE auth — an unauthenticated caller learns nothing more, with no-store", async () => {
    state.authFails = true;
    const { res, out } = await gate();
    expect(out).toBeNull();
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: 'disabled' });
    expect(res.body).toEqual(DISABLED_BODY);
    expect(res.headers['cache-control']).toBe('no-store');
  });
  it("'on' with no verified token: 401 from the auth middleware", async () => {
    state.mode = 'on'; state.authFails = true;
    const { res, out } = await gate();
    expect(out).toBeNull();
    expect(res.statusCode).toBe(401);
  });
  it("'allowlist', a verified caller the list does not admit: the same 404 disabled, whatever the method", async () => {
    state.mode = 'allowlist'; state.uid = 'someone-else';
    for (const method of ['POST', 'GET', 'DELETE']) {
      const { res, out } = await gate(method);
      expect(out, method).toBeNull();
      expect(res.statusCode, method).toBe(404);
      expect(res.body, method).toEqual({ error: 'disabled' });
    }
  });
  it('admitted, wrong method → 405; admitted and right method → the user', async () => {
    state.mode = 'allowlist';
    const wrong = await gate('GET');
    expect(wrong.out).toBeNull();
    expect(wrong.res.statusCode).toBe(405);
    const right = await gate('POST');
    expect(right.out).toEqual({ user: { uid: 'owner-1' } });
    expect(right.res.statusCode).toBeNull();
    expect(right.res.headers['cache-control']).toBe('no-store');
  });
});
