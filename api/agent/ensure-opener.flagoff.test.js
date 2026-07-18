import { describe, it, expect, vi } from 'vitest';

// Kill-switch proof: with OPENER_LAZY_FALLBACK_ENABLED off, the endpoint is a
// hard no-op — no auth, no DB — so the dark-launched build is byte-identical to
// today (the client also won't call it when off).
vi.mock('../_utils/security.js', () => ({ applySecurityMiddleware: () => false }));
vi.mock('../_utils/authMiddleware.js', () => ({ requireAuth: vi.fn(async () => ({ uid: 'x' })) }));

// Real featureFlags module (Node-clean guard), flag forced OFF (its default).
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  OPENER_LAZY_FALLBACK_ENABLED: false,
}));

// getFirebaseAdmin must never be reached on the flag-off path.
const fb = vi.hoisted(() => ({
  getFirebaseAdmin: vi.fn(() => { throw new Error('DB touched while flag OFF'); }),
}));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: fb.getFirebaseAdmin }));

const { default: handler } = await import('./ensure-opener.js');

const mkRes = () => ({
  statusCode: null, body: null,
  status(c) { this.statusCode = c; return this; },
  json(b) { this.body = b; return this; },
});

describe('ensure-opener — flag OFF', () => {
  it('returns disabled without touching auth or the DB', async () => {
    const res = mkRes();
    await handler({ method: 'POST', body: { battleId: 'b1', agentId: 'a1' } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('disabled');
    expect(fb.getFirebaseAdmin).not.toHaveBeenCalled();
  });
});
