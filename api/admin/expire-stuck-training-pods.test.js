// api/admin/expire-stuck-training-pods.test.js
//
// Training-Pod P0 R3 — the founder-gated cleanup endpoint's SAFETY contract:
// method gate, admin-secret gate, DRY-RUN-BY-DEFAULT, the B1 dry-run→apply token
// boundary (apply refused without a valid, matching, unexpired preview token),
// mandatory cutoff for apply, threshold floor, and input validation. The expiry
// CORE is exhaustively tested in trainingLifecycle.test.js and the token in
// expiryPreviewToken.test.js; here they are real (token) / spied (core) so this
// suite isolates the endpoint's own gating.

import { describe, it, expect, vi, beforeEach } from 'vitest';

let lastSummary = { dryRun: true, scanned: 2, matched: 2, expired: 0, skipped: 0, errors: 0, byStatus: { forming: 1, drafting: 0, awaiting_open: 1 }, matchedIds: ['g1', 'g2'] };
const expireSpy = vi.fn(async (_db, opts) => ({ ...lastSummary, dryRun: opts.dryRun === true }));
vi.mock('../_utils/trainingLifecycle.js', () => ({ expireStaleTrainingPods: (...a) => expireSpy(...a) }));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => ({}) }));
let authOk = true;
vi.mock('../_utils/adminSecretAuth.js', () => ({
  requireAdminSecret: (_req, res) => { if (!authOk) { res.status(401).json({ error: 'unauthorized' }); return false; } return true; },
  getAdminSecret: () => 'test-secret',
}));

const handler = (await import('./expire-stuck-training-pods.js')).default;

function mockRes() {
  return { statusCode: null, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
}
const CUTOFF = '2026-07-22T00:00:00.000Z';

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

  it('a malformed JSON string body → 400, never a 500, never runs', async () => {
    const res = mockRes();
    await handler({ method: 'POST', body: '{ not json' }, res);
    expect(res.statusCode).toBe(400);
    expect(expireSpy).not.toHaveBeenCalled();
  });

  it('DEFAULTS to a dry-run and mints a preview token; the core is called with dryRun:true', async () => {
    const res = mockRes();
    await handler({ method: 'POST', body: { cutoffIso: CUTOFF } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.apply).toBe(false);
    expect(typeof res.body.previewToken).toBe('string');
    expect(expireSpy).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ dryRun: true, by: 'one_time_cleanup', cutoffIso: CUTOFF }));
  });

  it('rejects a below-floor thresholdHours with 400 (never runs)', async () => {
    const res = mockRes();
    await handler({ method: 'POST', body: { thresholdHours: 6 } }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('threshold_below_floor');
    expect(expireSpy).not.toHaveBeenCalled();
  });

  it('apply WITHOUT a cutoff → 400 cutoff_required (never runs)', async () => {
    const res = mockRes();
    await handler({ method: 'POST', body: { apply: true, previewToken: 'x.y' } }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('cutoff_required');
    expect(expireSpy).not.toHaveBeenCalled();
  });

  it('apply WITHOUT a valid token → 400 invalid_preview_token (never writes)', async () => {
    const res = mockRes();
    await handler({ method: 'POST', body: { apply: true, cutoffIso: CUTOFF, previewToken: 'bogus.token' } }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('invalid_preview_token');
    expect(expireSpy).not.toHaveBeenCalled();
  });

  it('a non-true apply (string "true") stays a dry-run', async () => {
    const res = mockRes();
    await handler({ method: 'POST', body: { apply: 'true', cutoffIso: CUTOFF } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.apply).toBe(false);
  });

  it('FULL BOUNDARY: dry-run → its token → apply runs LIVE, bound to the previewed ids', async () => {
    // 1. dry-run mints a token for matchedIds ['g1','g2'].
    const dry = mockRes();
    await handler({ method: 'POST', body: { cutoffIso: CUTOFF } }, dry);
    const token = dry.body.previewToken;
    expect(token).toBeTruthy();

    // 2. apply with that token + the SAME params runs live, restricted to the ids.
    expireSpy.mockClear();
    const applied = mockRes();
    await handler({ method: 'POST', body: { apply: true, cutoffIso: CUTOFF, previewToken: token } }, applied);
    expect(applied.statusCode).toBe(200);
    expect(applied.body.apply).toBe(true);
    const call = expireSpy.mock.calls[0][1];
    expect(call.dryRun).toBe(false);
    expect(call.onlyIds instanceof Set).toBe(true);
    expect([...call.onlyIds].sort()).toEqual(['g1', 'g2']);
  });

  it('apply with a token minted for DIFFERENT params (threshold) → 400 param_mismatch, no write', async () => {
    const dry = mockRes();
    await handler({ method: 'POST', body: { cutoffIso: CUTOFF, thresholdHours: 48 } }, dry);
    const token = dry.body.previewToken;
    expireSpy.mockClear();
    const applied = mockRes();
    await handler({ method: 'POST', body: { apply: true, cutoffIso: CUTOFF, thresholdHours: 24, previewToken: token } }, applied);
    expect(applied.statusCode).toBe(400);
    expect(applied.body.error).toBe('invalid_preview_token');
    expect(applied.body.reason).toBe('param_mismatch');
    expect(expireSpy).not.toHaveBeenCalled();
  });
});
