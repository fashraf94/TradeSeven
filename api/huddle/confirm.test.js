// api/huddle/confirm.test.js
//
// Huddle S1 — the confirm route (spec V1.1 §6; Amendment A §A1; Amendment C V1.2 §C15). Review L2-12: when the confirm
// had committed but the immediate apply threw (its battle query, for instance), the route answered 500 `confirm_failed`
// for a confirmed plan. The apply is retried by the check-start sweep and the reconcile pass, so the answer is the
// confirm's own: 200.

import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/config/huddleFlags.js', () => ({ DRB_HUDDLE_ENABLED: true }));
const record = { etDate: '2026-11-09', status: 'ready', plan: { status: 'confirmed', revision: 'r2' } };
vi.mock('../_utils/firebaseAdmin.js', () => ({
  getFirebaseAdmin: () => ({ collection: () => ({ doc: () => ({ collection: () => ({ doc: () => ({ get: async () => ({ exists: true, data: () => record }) }) }) }) }) }),
  getFirebaseAuth: () => ({}),
}));
vi.mock('../_utils/huddle/routeKit.js', async (importOriginal) => ({ ...(await importOriginal()), admitHuddleRoute: async () => ({ uid: 'u1' }) }));
const confirmCalls = vi.hoisted(() => []);
vi.mock('../_utils/huddle/confirmPlan.js', () => ({ confirmPlan: async (_db, args) => { confirmCalls.push(args); return { kind: 'confirmed', body: { revision: 'r2' } }; } }));
const apply = vi.hoisted(() => ({ applyConfirmedPlan: vi.fn() }));
vi.mock('../_utils/huddle/applyPlan.js', async (importOriginal) => ({ ...(await importOriginal()), applyConfirmedPlan: apply.applyConfirmedPlan }));

const { default: handler } = await import('./confirm.js');
function resOf() {
  const res = { statusCode: null, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

describe('the confirm route (review L2-12)', () => {
  it('a committed confirm answers 200 even when the immediate apply throws (the sweep and reconcile apply it)', async () => {
    apply.applyConfirmedPlan.mockRejectedValueOnce(new Error('DEADLINE_EXCEEDED'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = resOf();
    await handler({ method: 'POST', body: { etDate: '2026-11-09', baseRevision: 'r1', replacement: { stances: [], lines: [] } } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.result).toBe('confirmed');
    expect(res.body.huddle.plan.status).toBe('confirmed');
    expect(apply.applyConfirmedPlan).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('E1: the body\'s acknowledgements reach the confirm (null when absent)', async () => {
    confirmCalls.length = 0;
    apply.applyConfirmedPlan.mockResolvedValue([]);
    await handler({ method: 'POST', body: { etDate: '2026-11-09', baseRevision: 'r1', replacement: { stances: [], lines: [] }, acknowledged: { diversifier: 'rv' } } }, resOf());
    await handler({ method: 'POST', body: { etDate: '2026-11-09', baseRevision: 'r1', replacement: { stances: [], lines: [] } } }, resOf());
    expect(confirmCalls.map((c) => c.acknowledged)).toEqual([{ diversifier: 'rv' }, null]);
  });
});
