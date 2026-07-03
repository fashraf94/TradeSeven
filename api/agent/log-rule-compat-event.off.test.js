// api/agent/log-rule-compat-event.off.test.js
//
// WS1 Phase 2 — defense-in-depth: with the REAL RULE_COMPAT_MODE (no flag
// mock; currently 'off'), the endpoint 404s before auth or validation — the
// scouting-board dark-surface pattern. Kept as its own file because the flag
// is a code constant bound at module load. NOTE: this suite self-skips once
// the flag walks past 'off' (the mocked companion file covers live modes).

import { describe, it, expect, vi } from 'vitest';

vi.mock('../_utils/security.js', () => ({
  applySecurityMiddleware: () => {
    throw new Error('security middleware must not run while the endpoint is dark');
  },
}));
vi.mock('../_utils/authMiddleware.js', () => ({
  requireAuth: async () => {
    throw new Error('auth must not run while the endpoint is dark');
  },
}));
vi.mock('../_utils/shadowLogger.js', () => ({
  logSignalDrops: async () => {
    throw new Error('nothing may be logged while the endpoint is dark');
  },
}));

const { RULE_COMPAT_MODE } = await import('../../src/config/featureFlags.js');
const { default: handler } = await import('./log-rule-compat-event.js');

describe('log-rule-compat-event — dark while RULE_COMPAT_MODE is off', () => {
  it.skipIf(RULE_COMPAT_MODE !== 'off')('404s before touching security, auth, or the logger', async () => {
    const res = {
      statusCode: null,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.body = payload; return this; },
    };
    await handler({ method: 'POST', body: { agentId: 'agent-1', mode: 'observe', events: [{}] } }, res);
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: 'not_found' });
  });
});
