// api/cron/mandate-rollover.test.js
// Spec 1 §5.3 — the rollover HANDLER + cursor-paged sweep: auth/flag/calendar
// gates (dark by default), the due-set cursor walk (a stuck book never pins the
// frontier), the durable failure trace + streak alert, and truthful completion.

import { describe, it, expect, vi } from 'vitest';

// getFirebaseAdmin is mocked so the handler's default-db path (the Flip PR #2
// live test) drives the sweep against an injected fake; the runRolloverSweep
// tests pass their own db explicitly and never reach this.
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: vi.fn() }));

import handler, { runRolloverSweep } from './mandate-rollover.js';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { makeMandateFakeDb } from '../_utils/__testsupport__/mandateFakeFirestore.js';
import { buildNewMandateDoc, buildDailyRow, deriveManagerAgentId } from '../_utils/mandateSchema.js';

function fakeReqRes(headers = { 'x-vercel-cron': '1' }) {
  const req = { headers, method: 'POST' };
  const captured = {};
  const res = { status(c) { captured.code = c; return this; }, json(b) { captured.body = b; return this; } };
  return { req, res, captured };
}

function bookFor(id, archetype, nextRolloverAt, over = {}) {
  const doc = buildNewMandateDoc({
    mandateId: id, userId: `u_${id}`, archetype,
    managerAgentId: deriveManagerAgentId(`u_${id}`, archetype),
    vintageRef: `archetypeVintages/${archetype}_OLD`, cadenceTier: 'slow',
    createdAt: new Date('2026-06-01T13:00:00Z'), quarterStartAt: new Date('2026-06-01T13:00:00Z'),
    nextRolloverAt, escapeHatchEligibleUntil: new Date('2026-06-15T13:00:00Z'),
  });
  return { ...doc, revision: 5, portfolio: { ...doc.portfolio, totalValue: 10_000_000 }, ...over };
}

const ROLLOVER_TICK = { date: '2026-09-03', rolloverKey: '2026-09-03_rollover' };
const NOW = new Date('2026-09-03T12:00:00Z');

describe('runRolloverSweep — due-set cursor walk + capital carry (FR-1)', () => {
  it('rolls every due book, carries capital, and completes cleanly; a not-due book is untouched', async () => {
    const db = makeMandateFakeDb({
      'mandates/g1': bookFor('g1', 'analyst', new Date('2026-09-01T20:00:00Z')),
      'mandates/g2': bookFor('g2', 'contrarian', new Date('2026-09-02T20:00:00Z')),
      'mandates/future': bookFor('future', 'analyst', new Date('2027-06-01T20:00:00Z')), // not due
      // one q1 row for g1 (non-empty summary); g2 has none (empty:true summary path)
      'mandates/g1/dailyRows/2026-08-01': buildDailyRow({ date: '2026-08-01', quarterIndex: 1, totalValue: 10_000_000, regime: 'risk_on', agencyState: 'full' }),
    });
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { req, res, captured } = fakeReqRes();
    await runRolloverSweep(req, res, { now: NOW, rolloverTick: ROLLOVER_TICK, db });
    spy.mockRestore();

    expect(captured.body.rolledBooks).toBe(2);
    expect(captured.body.errors).toBe(0);
    expect(captured.body.complete).toBe(true);
    // Both due books advanced, capital carried; the future book untouched.
    expect(db._get('mandates/g1').quarterIndex).toBe(2);
    expect(db._get('mandates/g1').portfolio.totalValue).toBe(10_000_000);
    expect(db._get('mandates/g2').quarterIndex).toBe(2);
    expect(db._get('mandates/future').quarterIndex).toBe(1); // not due → untouched
    // Summaries: g1 from its row (non-empty), g2 empty:true (no rows).
    expect(db._get('mandates/g1/quarterSummaries/1').empty).toBe(false);
    expect(db._get('mandates/g2/quarterSummaries/1').empty).toBe(true);
  });

  it('a failing book (oldest boundary) does NOT pin the frontier — later due books still roll', async () => {
    const db = makeMandateFakeDb({
      // The bad book has the OLDEST nextRolloverAt → the cursor hits it first; if
      // it pinned the page, g1/g2 would starve. It has an invalid archetype so
      // rollOneBoundary throws (getCadenceTier → null).
      'mandates/bad': bookFor('bad', 'bogus_archetype', new Date('2026-08-25T20:00:00Z'), { health: { consecutiveRolloverFailures: 1 } }),
      'mandates/g1': bookFor('g1', 'analyst', new Date('2026-09-01T20:00:00Z')),
      'mandates/g2': bookFor('g2', 'analyst', new Date('2026-09-02T20:00:00Z')),
    });
    const errs = [];
    const spyE = vi.spyOn(console, 'error').mockImplementation((m) => errs.push(String(m)));
    const spyL = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { req, res, captured } = fakeReqRes();
    await runRolloverSweep(req, res, { now: NOW, rolloverTick: ROLLOVER_TICK, db });
    spyE.mockRestore(); spyL.mockRestore();

    // The good books rolled despite the bad book sorting first.
    expect(db._get('mandates/g1').quarterIndex).toBe(2);
    expect(db._get('mandates/g2').quarterIndex).toBe(2);
    expect(captured.body.rolledBooks).toBe(2);
    // The bad book: durable failure trace + streak alert (1→2), never advanced.
    expect(db._get('mandates/bad').quarterIndex).toBe(1);
    expect(db._get('mandates/bad').health.consecutiveRolloverFailures).toBe(2);
    expect(db._get('mandates/bad').health.lastRolloverAttemptAt).toEqual(NOW);
    expect(errs.some((e) => e.includes('MANDATE_ROLLOVER_FAILED_STREAK') && e.includes('bad'))).toBe(true);
    // An errored sweep never claims complete.
    expect(captured.body.errors).toBe(1);
    expect(captured.body.complete).toBe(false);
  });
});

describe('mandate-rollover handler — auth gate + live sweep wiring', () => {
  it('401 without a cron header or the CRON_SECRET bearer', async () => {
    const { req, res, captured } = fakeReqRes({}); // no cron header, no auth
    await handler(req, res);
    expect(captured.code).toBe(401);
  });

  it('rollover is LIVE under Flip PR #2 → all gates pass in-window and the sweep runs', async () => {
    // Flip PR #2 lights the rollover flag. With auth + master + window + rollover
    // all green, the handler drives runRolloverSweep against the default db
    // (mocked to an empty fake) → a clean, complete sweep of zero due books,
    // never a dark no-op.
    getFirebaseAdmin.mockReturnValue(makeMandateFakeDb({}));
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-03T12:00:00Z')); // 08:00 ET, inside [7:30,9:30)
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const { req, res, captured } = fakeReqRes();
      await handler(req, res);
      expect(captured.body).toMatchObject({ complete: true, rolledBooks: 0, errors: 0 });
      expect(captured.body.noop).toBeUndefined(); // the sweep ran — not a dark no-op
    } finally {
      spy.mockRestore();
      vi.useRealTimers();
    }
  });
});
