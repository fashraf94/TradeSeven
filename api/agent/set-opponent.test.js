// api/agent/set-opponent.test.js
//
// Security pack, fix 2 (founder ruling R-F, 15 Nov 2026): POST
// /api/agent/set-opponent is closed. Every request — any method, signed in or
// not, well-formed or not, aimed at a battle the caller owns — gets HTTP 410
// before any read or write. The Firestore admin, the token check and the
// security middleware are mocked as spies so a row can prove none of them is
// ever reached; before the fix a well-formed owner request reached all three
// and wrote client-supplied prices and thresholds onto the battle.

import { describe, it, expect, beforeEach, vi } from 'vitest';

const spy = vi.hoisted(() => ({
  getFirebaseAdmin: vi.fn(),
  requireAuth: vi.fn(),
  applySecurityMiddleware: vi.fn(),
  update: vi.fn(),
  get: vi.fn(),
}));

vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: spy.getFirebaseAdmin }));
// A regression that reached Firestore through firebase-admin directly (the old
// cron files' pattern) would call these instead (security-pack review, rules lens).
vi.mock('firebase-admin/app', () => ({ initializeApp: spy.getFirebaseAdmin, getApps: spy.getFirebaseAdmin, cert: spy.getFirebaseAdmin }));
vi.mock('firebase-admin/firestore', () => ({ getFirestore: spy.getFirebaseAdmin }));
vi.mock('../_utils/authMiddleware.js', () => ({ requireAuth: spy.requireAuth }));
vi.mock('../_utils/security.js', () => ({ applySecurityMiddleware: spy.applySecurityMiddleware }));

import handler from './set-opponent.js';

function makeReqRes(method, body) {
  const req = { method, body, headers: { authorization: 'Bearer test-token' }, query: {} };
  const res = { statusCode: null, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return { req, res };
}

// A fresh league battle the caller owns: under five minutes old, no opponent —
// exactly the shape the old handler would have written onto.
const FRESH = { ownerId: 'caller', status: 'active', createdAt: new Date().toISOString(), opponent: null, portfolio: { startingPrices: {} }, scoring: { thresholds: {} } };
const WRITE_BODY = {
  agentBattleId: 'b-fresh',
  opponent: { portfolio: { star: [{ symbol: 'NVDA', baseATR: 0.0001 }], core: [], support: [] } },
  startingPrices: { NVDA: 0.01 },
};

beforeEach(() => {
  for (const f of Object.values(spy)) f.mockReset();
  spy.applySecurityMiddleware.mockReturnValue(false);
  spy.requireAuth.mockResolvedValue({ uid: 'caller' });
  spy.get.mockResolvedValue({ exists: true, data: () => FRESH });
  spy.getFirebaseAdmin.mockReturnValue({ collection: () => ({ doc: () => ({ get: spy.get, update: spy.update }) }) });
});

describe('set-opponent is gone (R-F fix 2)', () => {
  it.each([
    ['POST', WRITE_BODY],
    ['POST', {}],
    ['POST', undefined],
    ['GET', undefined],
    ['PUT', WRITE_BODY],
    ['DELETE', undefined],
    ['OPTIONS', undefined],
  ])('%s → 410, and no security middleware, no token check, no Firestore call', async (method, body) => {
    const { req, res } = makeReqRes(method, body);
    await handler(req, res);
    expect(res.statusCode).toBe(410);
    expect(res.body).toEqual({ error: 'gone', message: 'This endpoint has been removed.' });
    expect(spy.applySecurityMiddleware).not.toHaveBeenCalled();
    expect(spy.requireAuth).not.toHaveBeenCalled();
    expect(spy.getFirebaseAdmin).not.toHaveBeenCalled();
    expect(spy.get).not.toHaveBeenCalled();
    expect(spy.update).not.toHaveBeenCalled();
  });

  it('an unauthenticated caller gets the same 410 (the refusal precedes any identity question)', async () => {
    spy.requireAuth.mockImplementation(async (_req, res) => { res.status(401).json({ error: 'Authentication required' }); return null; });
    const { req, res } = makeReqRes('POST', WRITE_BODY);
    await handler(req, res);
    expect(res.statusCode).toBe(410);
    expect(spy.requireAuth).not.toHaveBeenCalled();
  });
});
