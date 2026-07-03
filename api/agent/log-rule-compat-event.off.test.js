// api/agent/log-rule-compat-event.off.test.js
//
// WS1 Phase 2 — defense-in-depth: with the REAL RULE_COMPAT_MODE (no flag
// mock; currently 'off'), the endpoint 404s before auth or validation — the
// scouting-board dark-surface pattern. Kept as its own file because the flag
// is a code constant bound at module load. NOTE: the 404 test self-skips once
// the flag walks past 'off' (the mocked companion file covers live modes).
//
// This file's REAL imports of featureFlags + the handler (whose graph pulls
// src/data/archetypeRuleCompatibility) ARE the BUILD_RULES §4
// dependency-surface guard for the endpoint's api → src edges — they run in
// the Node env and must NEVER be mocked here (the companion .test.js mocks the
// flag by design; THIS file is the guard).

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

// REAL imports — the §4 dependency-surface guard (see header). Never mock.
const { RULE_COMPAT_MODE } = await import('../../src/config/featureFlags.js');
const { default: handler } = await import('./log-rule-compat-event.js');
const compatMap = await import('../../src/data/archetypeRuleCompatibility.js');

describe('BUILD_RULES §4 dependency-surface guard (Node-clean api → src edges)', () => {
  it('featureFlags + the compat map load un-mocked in the Node env', () => {
    expect(typeof RULE_COMPAT_MODE).toBe('string');
    expect(Array.isArray(compatMap.ARCHETYPE_KEYS)).toBe(true);
  });
});

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
