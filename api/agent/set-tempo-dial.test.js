// api/agent/set-tempo-dial.test.js
//
// Release 2 PR-b — the REAL-FLAGS surface proof for the tempo-dial endpoint.
// Run against the REAL flags: TEMPO_DIAL_ENABLED is now TRUE (founder-intentional
// flip), so the surface is LIVE — the endpoint proceeds PAST the (formerly dark)
// flag gate to security → auth → body validation; it no longer 404s not_found.
// The full ON behavior matrix (flag mocked ON) lives in
// set-tempo-dial.behavior.test.js; this file pins that the REAL flag value
// produces the live surface, stopping at validation before any Firestore touch.
//
// BUILD_RULES §4 dependency-surface guard: the REAL handler import pulls
// src/config/featureFlags + tempoDialBands — never mock those here.

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

const { default: setTempoDialHandler } = await import('./set-tempo-dial.js');

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

describe('set-tempo-dial — LIVE while TEMPO_DIAL_ENABLED is true (the real flag)', () => {
  it('proceeds past the flag gate — no dark 404; runs security + auth, then validates the body', async () => {
    infraTouches.current = 0;
    const { req, res } = makeReqRes({ agentId: '../bad', tempo: 'aggressive' }); // invalid agentId
    await setTempoDialHandler(req, res);
    expect(res.statusCode).not.toBe(404);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('invalid_agent_id');
    expect(infraTouches.current).toBeGreaterThan(0); // security + auth reached — the surface is live (Firestore not touched)
  });
});
