// api/admin/expire-stuck-training-pods.test.js
//
// Training-Pod P0 R3 — the founder-gated cleanup endpoint's SAFETY contract:
// method gate, admin-secret gate, DRY-RUN-BY-DEFAULT (a bare call never writes),
// explicit apply:true to run live, and input validation. The expiry CORE
// (expireStaleTrainingPods — staleness rules, training-only predicate, cutoff,
// idempotency) is exhaustively tested in trainingLifecycle.test.js; here it is
// spied so this suite isolates the endpoint's own gating.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const expireSpy = vi.fn(async () => ({
  dryRun: true, scanned: 0, matched: 0, expired: 0, skipped: 0, errors: 0,
  byStatus: { forming: 0, drafting: 0, awaiting_open: 0 },
}));
vi.mock('../_utils/trainingLifecycle.js', () => ({ expireStaleTrainingPods: (...a) => expireSpy(...a) }));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => ({}) }));
let authOk = true;
vi.mock('../_utils/adminSecretAuth.js', () => ({
  requireAdminSecret: (_req, res) => { if (!authOk) { res.status(401).json({ error: 'unauthorized' }); return false; } return true; },
}));

const handler = (await import('./expire-stuck-training-pods.js')).default;

function mockRes() {
  return {
    statusCode: null, body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

describe('POST /api/admin/expire-stuck-training-pods — the cleanup safety contract', () => {
  beforeEach(() => { authOk = true; expireSpy.mockClear(); });

  it('rejects a non-POST method with 405 and never runs', async () => {
    const res = mockRes();
    await handler({ method: 'GET' }, res);
    expect(res.statusCode).toBe(405);
    expect(expireSpy).not.toHaveBeenCalled();
  });

  it('requires the admin secret — unauthed calls never run', async () => {
    authOk = false;
    const res = mockRes();
    await handler({ method: 'POST', body: {} }, res);
    expect(res.statusCode).toBe(401);
    expect(expireSpy).not.toHaveBeenCalled();
  });

  it('DEFAULTS to a dry-run (apply omitted): dryRun:true, by=one_time_cleanup, apply:false in the response', async () => {
    const res = mockRes();
    await handler({ method: 'POST', body: {} }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.apply).toBe(false);
    expect(expireSpy).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ dryRun: true, by: 'one_time_cleanup' }));
  });

  it('apply:true runs live (dryRun:false)', async () => {
    const res = mockRes();
    await handler({ method: 'POST', body: { apply: true } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.apply).toBe(true);
    expect(expireSpy).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ dryRun: false }));
  });

  it('a non-true apply (e.g. the string "true") stays a dry-run — apply must be an EXPLICIT boolean true', async () => {
    const res = mockRes();
    await handler({ method: 'POST', body: { apply: 'true' } }, res);
    expect(expireSpy).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ dryRun: true }));
  });

  it('validates cutoffIso and thresholdHours (400 on malformed) and threads good values through', async () => {
    const bad1 = mockRes();
    await handler({ method: 'POST', body: { cutoffIso: 'not-a-date' } }, bad1);
    expect(bad1.statusCode).toBe(400);

    const bad2 = mockRes();
    await handler({ method: 'POST', body: { thresholdHours: -5 } }, bad2);
    expect(bad2.statusCode).toBe(400);
    expect(expireSpy).not.toHaveBeenCalled();

    const ok = mockRes();
    await handler({ method: 'POST', body: { cutoffIso: '2026-07-22T00:00:00.000Z', thresholdHours: 24 } }, ok);
    expect(ok.statusCode).toBe(200);
    expect(expireSpy).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      cutoffIso: '2026-07-22T00:00:00.000Z', thresholdMs: 24 * 60 * 60 * 1000,
    }));
  });

  it('canonicalizes an offset-bearing cutoffIso to UTC-Z before the chronological compare (F1)', async () => {
    const res = mockRes();
    await handler({ method: 'POST', body: { cutoffIso: '2026-07-21T00:00:00+05:00' } }, res);
    expect(res.statusCode).toBe(200);
    expect(expireSpy).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      cutoffIso: '2026-07-20T19:00:00.000Z', // +05:00 folded into UTC-Z
    }));
    expect(res.body.cutoffIso).toBe('2026-07-20T19:00:00.000Z');
  });

  it('a malformed JSON string body → 400 (never a 500) and never runs (F4)', async () => {
    const res = mockRes();
    await handler({ method: 'POST', body: '{ not json' }, res);
    expect(res.statusCode).toBe(400);
    expect(expireSpy).not.toHaveBeenCalled();
  });
});
