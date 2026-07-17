// api/agent/set-rule-hardness.off.test.js
//
// WS1 enforce Phase 2 — defense-in-depth: with the REAL flags (no flag
// mocks!), FORGE_HARDSOFT_AUTHORING_ENABLED is currently false, so the
// endpoint must 404 before touching security, auth, or Firestore (the
// log-rule-compat-event.off.test.js pattern). When the authoring flag flips
// (Phase 5.4), the 404 case auto-skips and the live surface is covered by
// set-rule-hardness.compat.test.js.
//
// This file is ALSO the §4 dependency-surface guard for the endpoint's
// api → src imports (featureFlags, ruleCompatEvaluate → compat map +
// compatSurfaceCopy): the import below is REAL — it explodes in the Node test
// env if a browser dep ever enters the graph. NEVER mock featureFlags or the
// evaluator here.

import { describe, it, expect, vi } from 'vitest';

const infraTouches = vi.hoisted(() => ({ current: 0 }));

vi.mock('../_utils/firebaseAdmin.js', () => ({
  getFirebaseAdmin: () => {
    infraTouches.current += 1;
    throw new Error('firestore must not be touched while the surface is dark');
  },
}));
vi.mock('../_utils/security.js', () => ({
  applySecurityMiddleware: () => {
    infraTouches.current += 1;
    throw new Error('security middleware must not run while the surface is dark');
  },
}));
vi.mock('../_utils/authMiddleware.js', () => ({
  requireAuth: async () => {
    infraTouches.current += 1;
    throw new Error('auth must not run while the surface is dark');
  },
}));

// REAL flag + REAL evaluator graph — the dependency-surface guard.
const { FORGE_HARDSOFT_AUTHORING_ENABLED } = await import('../../src/config/featureFlags.js');
const { default: handler } = await import('./set-rule-hardness.js');

describe('set-rule-hardness — dark while FORGE_HARDSOFT_AUTHORING_ENABLED is false (the real flag)', () => {
  it('sanity: the real flag is a boolean', () => {
    expect(typeof FORGE_HARDSOFT_AUTHORING_ENABLED).toBe('boolean');
  });

  it.skipIf(FORGE_HARDSOFT_AUTHORING_ENABLED !== false)(
    '404s before touching security, auth, or Firestore',
    async () => {
      const res = {
        statusCode: null,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; },
      };
      await handler({ method: 'POST', body: {} }, res);
      expect(res.statusCode).toBe(404);
      expect(res.body).toMatchObject({ error: 'not_found' });
      expect(infraTouches.current).toBe(0);
    },
  );
});
