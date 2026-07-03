// api/agent/log-rule-compat-event.test.js
//
// WS1 Phase 2 — endpoint coverage for the compat observe stream. This file
// mocks RULE_COMPAT_MODE to 'observe' to exercise the live surface; the
// companion log-rule-compat-event.off.test.js runs the REAL flag (currently
// 'off') and proves the defense-in-depth 404. Harness pattern:
// change-archetype.test.js (hoisted mock state, req/res helper).

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { authReturnValue, shadowLogCalls, shadowLogShouldFail } = vi.hoisted(() => ({
  authReturnValue: { current: { uid: 'test-user' } },
  shadowLogCalls: { current: [] },
  shadowLogShouldFail: { current: false },
}));

vi.mock('../_utils/security.js', () => ({
  applySecurityMiddleware: () => false,
}));
vi.mock('../_utils/authMiddleware.js', () => ({
  requireAuth: async (req, res) => {
    if (authReturnValue.current === null) {
      res.status(401).json({ error: 'auth required' });
      return null;
    }
    return authReturnValue.current;
  },
}));
vi.mock('../_utils/shadowLogger.js', () => ({
  logSignalDrops: async (record) => {
    if (shadowLogShouldFail.current) throw new Error('gcs down');
    shadowLogCalls.current.push(record);
  },
}));
vi.mock('../../src/config/featureFlags.js', () => ({
  RULE_COMPAT_MODE: 'observe',
}));

const { default: handler } = await import('./log-rule-compat-event.js');

function makeReqRes(body, method = 'POST') {
  const res = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
  return [{ method, body }, res];
}

const VALID_EVENT = {
  type: 'compat_conflict_equip',
  ruleId: 'tech-rsi-oversold',
  ruleDocId: 'doc-1',
  state: 'core_conflict',
  zone1Ref: 'TF-Z1-BUY-STRENGTH',
  hardnessRequested: 'soft',
  path: 'create_rule',
  mode: 'observe',
  blocked: false,
  ts: '2026-07-03T00:00:00.000Z',
};

beforeEach(() => {
  authReturnValue.current = { uid: 'test-user' };
  shadowLogCalls.current = [];
  shadowLogShouldFail.current = false;
});

describe('POST /api/agent/log-rule-compat-event (mode=observe)', () => {
  it('happy path: 200, one awaited stream record carrying the sanitized batch', async () => {
    const [req, res] = makeReqRes({
      agentId: 'agent-1', archetype: 'momentum_chaser', mode: 'observe', events: [VALID_EVENT],
    });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ ok: true, logged: 1 });
    expect(shadowLogCalls.current).toHaveLength(1);
    expect(shadowLogCalls.current[0]).toMatchObject({
      stage: 'rule_compat', userId: 'test-user', agentId: 'agent-1',
      archetype: 'momentum_chaser', mode: 'observe', eventCount: 1,
    });
    expect(shadowLogCalls.current[0].events[0]).toMatchObject({
      type: 'compat_conflict_equip', ruleId: 'tech-rsi-oversold', path: 'create_rule', blocked: false,
    });
  });

  it('validation: bad agentId / bad mode / empty events / oversized batch / bad event shape → 400, nothing logged', async () => {
    const cases = [
      { agentId: 'bad id!', mode: 'observe', events: [VALID_EVENT] },
      { agentId: 'agent-1', mode: 'off', events: [VALID_EVENT] },
      { agentId: 'agent-1', mode: 'observe', events: [] },
      { agentId: 'agent-1', mode: 'observe', events: Array.from({ length: 21 }, () => VALID_EVENT) },
      { agentId: 'agent-1', mode: 'observe', events: [{ ...VALID_EVENT, type: 'not_a_type' }] },
      { agentId: 'agent-1', mode: 'observe', events: [{ ...VALID_EVENT, path: 'archetype_change_rescan' }] }, // server-only path
      { agentId: 'agent-1', mode: 'observe', events: [{ ...VALID_EVENT, ruleId: '' }] },
    ];
    for (const body of cases) {
      const [req, res] = makeReqRes(body);
      await handler(req, res);
      expect(res.statusCode, JSON.stringify(body).slice(0, 80)).toBe(400);
    }
    expect(shadowLogCalls.current).toHaveLength(0);
  });

  it('shadow-log failure surfaces as 500 log_failed (never silent)', async () => {
    shadowLogShouldFail.current = true;
    const [req, res] = makeReqRes({
      agentId: 'agent-1', archetype: 'momentum_chaser', mode: 'observe', events: [VALID_EVENT],
    });
    await handler(req, res);
    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ error: 'log_failed' });
  });

  it('non-POST → 405; unauthenticated → 401', async () => {
    const [reqGet, resGet] = makeReqRes({}, 'GET');
    await handler(reqGet, resGet);
    expect(resGet.statusCode).toBe(405);

    authReturnValue.current = null;
    const [req, res] = makeReqRes({ agentId: 'agent-1', mode: 'observe', events: [VALID_EVENT] });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });
});
