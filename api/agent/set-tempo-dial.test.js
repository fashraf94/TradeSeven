// api/agent/set-tempo-dial.test.js
//
// Release 2 PR-b — the DARK-INERT surface proof for the tempo-dial endpoint
// against the REAL flags (TEMPO_DIAL_ENABLED false at merge): 404 before any
// infra touch. Behavior matrix (flag mocked ON) in
// set-tempo-dial.behavior.test.js.
//
// BUILD_RULES §4 dependency-surface guard: the REAL handler import pulls
// src/config/featureFlags + tempoDialBands — never mock those here.

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

const { default: setTempoDialHandler } = await import('./set-tempo-dial.js');

describe('set-tempo-dial — dark-inert while TEMPO_DIAL_ENABLED is false (the real flag)', () => {
  it('404s before touching security, auth, or Firestore', async () => {
    infraTouches.current = 0;
    const req = { method: 'POST', body: { agentId: 'agent-1', tempo: 'aggressive' } };
    const res = {
      statusCode: null,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.body = payload; return this; },
    };
    await setTempoDialHandler(req, res);
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: 'not_found' });
    expect(infraTouches.current).toBe(0);
  });
});
