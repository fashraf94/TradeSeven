// api/agent/equip-lean.test.js
//
// Release 2 PR-a — the DARK-INERT surface proof for the lean endpoints, run
// against the REAL feature flags (STANDING_LEANS_ENABLED is false at merge):
// both endpoints 404 before auth, body parsing, or any Firestore touch — the
// scouting-board defense-in-depth pattern. The behavior matrix (flag mocked
// ON) lives in equip-lean.behavior.test.js.
//
// BUILD_RULES §4 dependency-surface guard: this file's REAL import of the
// handlers pulls src/config/featureFlags + src/data/archetypeAdjustments into
// the Node test env — NEVER mock those here.

import { describe, it, expect, vi } from 'vitest';

const { infraTouches } = vi.hoisted(() => ({ infraTouches: { current: 0 } }));

vi.mock('../_utils/firebaseAdmin.js', () => ({
  getFirebaseAdmin: () => {
    infraTouches.current += 1;
    throw new Error('firestore must not be touched while the surface is dark');
  },
}));
vi.mock('../_utils/security.js', () => ({
  applySecurityMiddleware: () => {
    infraTouches.current += 1;
    return false;
  },
}));
vi.mock('../_utils/authMiddleware.js', () => ({
  requireAuth: async () => {
    infraTouches.current += 1;
    return { uid: 'test-user' };
  },
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

describe('lean endpoints — dark-inert while STANDING_LEANS_ENABLED is false (the real flag)', () => {
  it('equip-lean 404s before touching security, auth, or Firestore', async () => {
    infraTouches.current = 0;
    const { req, res } = makeReqRes({ agentId: 'agent-1', adjustmentId: 'CP-04', version: 1 });
    await equipLeanHandler(req, res);
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: 'not_found' });
    expect(infraTouches.current).toBe(0);
  });

  it('unequip-lean 404s before touching security, auth, or Firestore', async () => {
    infraTouches.current = 0;
    const { req, res } = makeReqRes({ agentId: 'agent-1', adjustmentId: 'CP-04' });
    await unequipLeanHandler(req, res);
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: 'not_found' });
    expect(infraTouches.current).toBe(0);
  });

  it('exports the master-spec cap of 2', () => {
    expect(STANDING_LEANS_CAP).toBe(2);
  });
});
