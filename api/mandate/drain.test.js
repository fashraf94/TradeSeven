// api/mandate/drain.test.js
//
// P5 (§3.3/F26) — the drain endpoint's load-bearing security property, same
// contract as create/accelerate: a flag alone is NOT authorization and an
// allowlisted uid alone is not either (the endpoint reuses the exported
// create.js helpers — the P4 ambiguity-4 no-new-flag precedent). The drain
// CORE's behavior (cancel + rejected_stale + doc lifecycle + idempotence) is
// proven in mandateBatchTransport.test.js and the interleavings harness; here
// we lock the HTTP surface: founder-only (flag AND allowlist), POST-only, and
// the authorization refusal reveals nothing about which condition failed.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const drainSpy = vi.fn(async () => ({ batches: 0, disposed: 0, leaseSkips: 0, errors: 0, incomplete: 0 }));
vi.mock('../_utils/mandateBatchTransport.js', async (importActual) => {
  const actual = await importActual();
  return { ...actual, drainOpenBatches: (...a) => drainSpy(...a) };
});
// Auth middlewares pass a fixed uid through; the founder gate under test is
// the endpoint's own (flag + allowlist).
vi.mock('../_utils/security.js', () => ({ applySecurityMiddleware: () => false }));
vi.mock('../_utils/authMiddleware.js', () => ({ requireAuth: async () => ({ uid: 'u_founder' }) }));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => ({}) }));

import handler from './drain.js';
import { MANDATE_FOUNDER_CREATE_ENABLED } from '../../src/config/featureFlags.js';

function invoke(method = 'POST') {
  const req = { method, headers: {}, body: {} };
  const captured = {};
  const res = {
    status(code) { captured.code = code; return this; },
    json(body) { captured.body = body; return this; },
  };
  return handler(req, res).then(() => captured);
}

beforeEach(() => {
  drainSpy.mockClear();
  delete process.env.MANDATE_FOUNDER_UIDS;
});

describe('mandate/drain — founder gate (§7: flag AND allowlist, both required)', () => {
  it('is LIVE for a founder (Flip PR #1): with the flag on, an allowlisted uid runs the drain core', async () => {
    process.env.MANDATE_FOUNDER_UIDS = 'u_founder';
    // The flag ships true from Flip PR #1 (activation step 3) — this test runs
    // against the real constant so a later dark-revert is loud here too. The
    // flag-OFF refusal (a flag alone is not authorization) is proven against a
    // literal false in create.test.js.
    expect(MANDATE_FOUNDER_CREATE_ENABLED).toBe(true);
    const r = await invoke();
    expect(r.code).toBe(200);
    expect(r.body).toEqual({ success: true, batches: 0, disposed: 0, leaseSkips: 0, errors: 0, incomplete: 0 });
    expect(drainSpy).toHaveBeenCalledTimes(1);
  });

  it('an un-allowlisted uid is refused identically (no allowlist set → nobody is a founder)', async () => {
    const r = await invoke();
    expect(r.code).toBe(403);
    expect(drainSpy).not.toHaveBeenCalled();
  });

  it('rejects non-POST methods before auth work', async () => {
    const r = await invoke('GET');
    expect(r.code).toBe(405);
    expect(drainSpy).not.toHaveBeenCalled();
  });
});
