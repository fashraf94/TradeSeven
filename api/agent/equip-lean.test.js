// api/agent/equip-lean.test.js
//
// Release 2 PR-a — the REAL-FLAGS surface proof for the lean endpoints. Run
// against the REAL feature flags: STANDING_LEANS_ENABLED is now TRUE (founder-
// intentional flip), so the surface is LIVE — both endpoints proceed PAST the
// (formerly dark) flag gate to security → auth → body validation; they no longer
// 404 not_found. The full ON behavior matrix (flag mocked ON) lives in
// equip-lean.behavior.test.js; this file pins that the REAL flag value produces
// the live surface, stopping at validation before any Firestore touch.
//
// BUILD_RULES §4 dependency-surface guard: this file's REAL import of the
// handlers pulls src/config/featureFlags + src/data/archetypeAdjustments into
// the Node test env — NEVER mock those here.

import { describe, it, expect, vi } from 'vitest';

const { infraTouches } = vi.hoisted(() => ({ infraTouches: { current: 0 } }));

vi.mock('../_utils/firebaseAdmin.js', () => ({
  getFirebaseAdmin: () => { infraTouches.current += 1; return {}; },
}));
vi.mock('../_utils/security.js', () => ({
  applySecurityMiddleware: () => { infraTouches.current += 1; return false; },
}));
vi.mock('../_utils/authMiddleware.js', () => ({
  requireAuth: async () => { infraTouches.current += 1; return { uid: 'test-user' }; },
}));
vi.mock('../_utils/shadowLogger.js', () => ({ logSignalDrops: async () => {} }));
vi.mock('@vercel/functions', () => ({ waitUntil: (p) => p }));

const { default: equipLeanHandler, STANDING_LEANS_CAP } = await import('./equip-lean.js');
const { default: unequipLeanHandler } = await import('./unequip-lean.js');

function makeReqRes(body) {
  const req = { method: 'POST', body };
  const res = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
  return { req, res };
}

describe('lean endpoints — LIVE while STANDING_LEANS_ENABLED is true (the real flag)', () => {
  it('equip-lean proceeds past the flag gate — no dark 404; runs security + auth, then validates the body', async () => {
    infraTouches.current = 0;
    const { req, res } = makeReqRes({ agentId: '../bad', adjustmentId: 'CP-04', version: 1 }); // invalid agentId
    await equipLeanHandler(req, res);
    expect(res.statusCode).not.toBe(404);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('invalid_agent_id');
    expect(infraTouches.current).toBeGreaterThan(0); // security + auth reached — the surface is live (Firestore not touched)
  });

  it('unequip-lean proceeds past the flag gate — no dark 404; runs security + auth, then validates the body', async () => {
    infraTouches.current = 0;
    const { req, res } = makeReqRes({ agentId: '../bad', adjustmentId: 'CP-04' }); // invalid agentId
    await unequipLeanHandler(req, res);
    expect(res.statusCode).not.toBe(404);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('invalid_agent_id');
    expect(infraTouches.current).toBeGreaterThan(0);
  });

  it('exports the master-spec cap of 2', () => {
    expect(STANDING_LEANS_CAP).toBe(2);
  });
});
