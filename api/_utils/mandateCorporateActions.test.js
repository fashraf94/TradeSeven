// api/_utils/mandateCorporateActions.test.js
// Spec 1 §4.3 / FR-4 / I7 (P3) — feed parsing, per-type application semantics,
// pending selection + idempotency keys, and the gap detector's DISCRIMINATION
// contract: catch split signatures both directions, pass news/earnings gaps.

import { describe, it, expect } from 'vitest';
import {
  deriveActionId, parseSplitsPayload, parseDividendsPayload,
  pendingActionsFor, applyCorporateAction, isRatioShaped, classifyOvernightGaps,
} from './mandateCorporateActions.js';
import { MANDATE_CA_GAP_THRESHOLD } from './mandateConfig.js';

describe('feed parsing (EODHD payload shapes)', () => {
  it('parses split rows N/M into shares-multiplier actions, typed by direction', () => {
    const { actions, rejects } = parseSplitsPayload('nvda', [
      { date: '2026-08-10', split: '10.000000/1.000000' },
      { date: '2026-08-11', split: '1.000000/5.000000' },
    ]);
    expect(rejects).toEqual([]);
    expect(actions[0]).toMatchObject({ type: 'split', ticker: 'NVDA', effectiveDate: '2026-08-10', ratio: 10 });
    expect(actions[1]).toMatchObject({ type: 'reverse_split', ratio: 0.2 });
  });
  it('rejects malformed split rows LOUDLY (never silently coerced)', () => {
    const { actions, rejects } = parseSplitsPayload('X', [{ date: '2026-08-10', split: 'garbage' }, { split: '2/1' }]);
    expect(actions).toEqual([]);
    expect(rejects.length).toBe(2);
  });
  it('parses dividends using the UNADJUSTED per-share amount when present', () => {
    const { actions } = parseDividendsPayload('ko', [
      { date: '2026-08-11', value: 0.47, unadjustedValue: 0.485 },
      { date: '2026-05-11', value: 0.47 },
    ]);
    expect(actions[0]).toMatchObject({ type: 'cash_dividend', ticker: 'KO', effectiveDate: '2026-08-11', amount: 0.485 });
    expect(actions[1].amount).toBe(0.47);
  });
});

describe('pending selection + idempotency (applied per {mandateId, actionId})', () => {
  const positions = { NVDA: { shares: 10, costBasisTotal: 5000, openedAt: '2026-08-01' } }; // held ACROSS the effective date
  const bySym = { NVDA: [{ type: 'split', ticker: 'NVDA', effectiveDate: '2026-08-12', ratio: 10 }] };
  it('selects held-symbol actions effective on or before the session date', () => {
    const { pending } = pendingActionsFor(positions, bySym, { onOrBefore: '2026-08-12' });
    expect(pending.length).toBe(1);
    expect(pending[0].actionId).toBe(deriveActionId(bySym.NVDA[0]));
  });

  // ENTITLEMENT (spec+money review P3 — both independently found phantom
  // dividend income credited to never-entitled post-ex-date buyers).
  it('ENTITLEMENT: a position opened ON or AFTER the effective date is NOT credited (strict <)', () => {
    const boughtOnExDate = { NVDA: { shares: 10, costBasisTotal: 5000, openedAt: '2026-08-12' } };
    const r1 = pendingActionsFor(boughtOnExDate, bySym, { onOrBefore: '2026-08-12' });
    expect(r1.pending).toEqual([]);
    expect(r1.notEntitled.length).toBe(1);
    expect(r1.notEntitled[0].actionId).toBe(deriveActionId(bySym.NVDA[0]));
    const boughtAfter = { NVDA: { shares: 10, costBasisTotal: 5000, openedAt: '2026-08-13' } };
    const r2 = pendingActionsFor(boughtAfter, bySym, { onOrBefore: '2026-08-14' });
    expect(r2.pending).toEqual([]);
    expect(r2.notEntitled.length).toBe(1);
  });
  it('ENTITLEMENT: a position with NO openedAt is declined as no_entitlement_data (never fabricate — D-15)', () => {
    const legacy = { NVDA: { shares: 10, costBasisTotal: 5000 } };
    const r = pendingActionsFor(legacy, bySym, { onOrBefore: '2026-08-12' });
    expect(r.pending).toEqual([]);
    expect(r.notEntitled).toEqual([]);
    expect(r.noEntitlementData.length).toBe(1);
  });
  it('ENTITLEMENT: ticker_change and delisting apply to ANY current holder regardless of openedAt', () => {
    const boughtAfter = { OLDCO: { shares: 10, costBasisTotal: 5000, openedAt: '2026-08-12' } };
    const events = { OLDCO: [
      { type: 'ticker_change', ticker: 'OLDCO', effectiveDate: '2026-08-10', renamedTo: 'NEWCO' },
      { type: 'delisting', ticker: 'OLDCO', effectiveDate: '2026-08-11' },
    ] };
    const r = pendingActionsFor(boughtAfter, events, { onOrBefore: '2026-08-12' });
    expect(r.pending.length).toBe(2);
    expect(r.notEntitled).toEqual([]);
    expect(r.noEntitlementData).toEqual([]);
  });
  it('future-dated and already-applied actions are not pending', () => {
    const { pending: future } = pendingActionsFor(positions, bySym, { onOrBefore: '2026-08-11' });
    expect(future).toEqual([]);
    const applied = new Set([deriveActionId(bySym.NVDA[0])]);
    const { pending: done } = pendingActionsFor(positions, bySym, { onOrBefore: '2026-08-12', appliedIds: applied });
    expect(done).toEqual([]);
  });
  it('an unrecognized action type is surfaced for symbol quarantine, never applied', () => {
    const weird = { NVDA: [{ type: 'spinoff_exotic', ticker: 'NVDA', effectiveDate: '2026-08-12' }] };
    const { pending, unrecognized } = pendingActionsFor(positions, weird, { onOrBefore: '2026-08-12' });
    expect(pending).toEqual([]);
    expect(unrecognized.length).toBe(1);
  });
});

describe('applyCorporateAction — §4.3 semantics per type', () => {
  const book = () => ({ positions: { NVDA: { shares: 10, costBasisTotal: 5000, avgCost: 500, lastMark: 1000, sector: 'Technology' } }, cash: 1000 });

  it('split: shares × ratio, basis UNCHANGED, avgCost derived, carried mark divides (value conserved)', () => {
    const r = applyCorporateAction(book(), { type: 'split', ticker: 'NVDA', effectiveDate: '2026-08-12', ratio: 10 });
    expect(r.ok).toBe(true);
    expect(r.positions.NVDA.shares).toBe(100);
    expect(r.positions.NVDA.costBasisTotal).toBe(5000);
    expect(r.positions.NVDA.avgCost).toBe(50);
    expect(r.positions.NVDA.lastMark).toBe(100); // 1000 ÷ 10 — carry-over value conserved
    expect(r.cash).toBe(1000);
    expect(r.incomeUsd).toBe(0);
  });
  it('reverse split: shares shrink, basis unchanged, mark multiplies', () => {
    const r = applyCorporateAction(book(), { type: 'reverse_split', ticker: 'NVDA', effectiveDate: '2026-08-12', ratio: 0.1 });
    expect(r.positions.NVDA.shares).toBe(1);
    expect(r.positions.NVDA.lastMark).toBe(10000);
  });
  it('cash dividend: cash += shares × amount, recorded as INCOME (not trading P&L)', () => {
    const r = applyCorporateAction(book(), { type: 'cash_dividend', ticker: 'NVDA', effectiveDate: '2026-08-12', amount: 0.25 });
    expect(r.cash).toBe(1002.5);
    expect(r.incomeUsd).toBe(2.5);
    expect(r.positions.NVDA.shares).toBe(10); // untouched
  });
  it('ticker change migrates the key; merging onto an existing position is refused', () => {
    const r = applyCorporateAction(book(), { type: 'ticker_change', ticker: 'NVDA', effectiveDate: '2026-08-12', renamedTo: 'NVDB' });
    expect(r.ok).toBe(true);
    expect(r.positions.NVDA).toBeUndefined();
    expect(r.positions.NVDB.shares).toBe(10);
    const clash = applyCorporateAction(
      { positions: { A: { shares: 1, costBasisTotal: 1 }, B: { shares: 1, costBasisTotal: 1 } }, cash: 0 },
      { type: 'ticker_change', ticker: 'A', effectiveDate: '2026-08-12', renamedTo: 'B' },
    );
    expect(clash).toMatchObject({ ok: false, reason: 'rename_target_held' });
  });
  it('delisting: forced close at the LAST GOOD mark → proceeds to cash + CORPORATE_CLOSE receipt data', () => {
    const r = applyCorporateAction(book(), { type: 'delisting', ticker: 'NVDA', effectiveDate: '2026-08-12' });
    expect(r.ok).toBe(true);
    expect(r.positions.NVDA).toBeUndefined();
    expect(r.cash).toBe(1000 + 10 * 1000);
    expect(r.forcedClose).toMatchObject({ ticker: 'NVDA', shares: 10, mark: 1000, proceeds: 10000, realizedPnl: 5000 });
  });
  it('actions on unheld symbols are not_held (skipped upstream, never fabricated)', () => {
    expect(applyCorporateAction({ positions: {}, cash: 0 }, { type: 'split', ticker: 'GONE', ratio: 2 })).toMatchObject({ ok: false, reason: 'not_held' });
  });
});

describe('the gap detector (I7) — discrimination, not suspicion', () => {
  const held = (lastMark) => ({ NVDA: { shares: 10, costBasisTotal: 5000, lastMark } });
  const snap = (price) => ({ symbols: { NVDA: { complete: true, price } } });

  it('isRatioShaped catches split signatures in BOTH directions and rejects near misses', () => {
    expect(isRatioShaped(0.5)).toBe(true);    // ÷2 forward split
    expect(isRatioShaped(0.1)).toBe(true);    // ÷10
    expect(isRatioShaped(2.0)).toBe(true);    // ×2 reverse
    expect(isRatioShaped(10.0)).toBe(true);   // ×10 reverse
    expect(isRatioShaped(0.53)).toBe(false);  // a 47% crash is news-shaped
    expect(isRatioShaped(0.47)).toBe(false);
    expect(isRatioShaped(0.7)).toBe(false);
  });

  it('a ÷10 split gap with NO feed entry → suspected_ca (frozen; useless-detector guard)', () => {
    const r = classifyOvernightGaps(held(1000), snap(100), {});
    expect(r.suspectedCA.has('NVDA')).toBe(true);
    expect(r.frozen.has('NVDA')).toBe(true);
  });
  it('a ×10 reverse-split gap with no feed entry also freezes (both directions)', () => {
    const r = classifyOvernightGaps(held(10), snap(100), {});
    expect(r.suspectedCA.has('NVDA')).toBe(true);
  });
  it('the SAME gap WITH a matching feed entry → pending_ca (applies normally at close; frozen meanwhile)', () => {
    const feed = { NVDA: [{ type: 'split', ticker: 'NVDA', effectiveDate: '2026-08-12', ratio: 10 }] };
    const r = classifyOvernightGaps(held(1000), snap(100), feed);
    expect(r.pendingCA.has('NVDA')).toBe(true);
    expect(r.suspectedCA.has('NVDA')).toBe(false);
    expect(r.frozen.has('NVDA')).toBe(true); // still frozen THIS tick — position unadjusted
  });
  it('an EARNINGS gap (−25%) passes through untouched — not an anomaly (griefer guard)', () => {
    const r = classifyOvernightGaps(held(100), snap(75), {});
    expect(r.frozen.size).toBe(0);
    expect(r.passed).toContain('NVDA');
  });
  it('a large NEWS-shaped crash (−47%, not ratio-shaped) passes through', () => {
    const r = classifyOvernightGaps(held(100), snap(53), {});
    expect(r.frozen.size).toBe(0);
  });
  it('moves below MANDATE_CA_GAP_THRESHOLD never reach the ratio test', () => {
    const justUnder = 1 - (MANDATE_CA_GAP_THRESHOLD - 0.01);
    const r = classifyOvernightGaps(held(100), snap(100 * justUnder), {});
    expect(r.frozen.size).toBe(0);
  });
  it('symbols with no prior lastMark or no fresh mark never classify (freshness machinery owns them)', () => {
    expect(classifyOvernightGaps({ NVDA: { shares: 1, costBasisTotal: 1 } }, snap(100), {}).frozen.size).toBe(0);
    expect(classifyOvernightGaps(held(100), { symbols: { NVDA: { complete: false, price: null } } }, {}).frozen.size).toBe(0);
  });
  it('a large ex-dividend drop matching the feed is pending_ca, not suspected', () => {
    // $100 → $55: a 45% special dividend of $45/share, feed-explained.
    const feed = { NVDA: [{ type: 'cash_dividend', ticker: 'NVDA', effectiveDate: '2026-08-12', amount: 45 }] };
    const r = classifyOvernightGaps(held(100), snap(55), feed);
    expect(r.pendingCA.has('NVDA')).toBe(true);
    expect(r.suspectedCA.has('NVDA')).toBe(false);
  });
});

// ── P3 verification-pass regression guards (C-21 findings 2/3/4/5, CONFIRMED) ─

describe('gap detector — feed-first, date-windowed (C-21 review P3)', () => {
  const held = (lastMark) => ({ NVDA: { shares: 10, costBasisTotal: 5000, lastMark } });
  const snap = (price, date = '2026-08-12') => ({ date, symbols: { NVDA: { complete: true, price } } });

  it('C21-2: a feed-known SUB-THRESHOLD split (3:2, −33%) freezes pending_ca — the feed check precedes the threshold', () => {
    const feed = { NVDA: [{ type: 'split', ticker: 'NVDA', effectiveDate: '2026-08-12', ratio: 1.5 }] };
    const r = classifyOvernightGaps(held(100), snap(66.67), feed, { sinceDate: '2026-08-11' });
    expect(r.pendingCA.has('NVDA')).toBe(true);
    expect(r.frozen.has('NVDA')).toBe(true);
  });
  it('C21-2 boundary: sub-threshold cash dividends stay threshold-gated (no share-basis shift)', () => {
    const feed = { NVDA: [{ type: 'cash_dividend', ticker: 'NVDA', effectiveDate: '2026-08-12', amount: 0.5 }] };
    const r = classifyOvernightGaps(held(100), snap(99.5), feed, { sinceDate: '2026-08-11' });
    expect(r.frozen.size).toBe(0);
    expect(r.passed).toContain('NVDA');
  });
  it('C21-4: an action OUTSIDE the gap window — applied days ago or future-dated — never explains a genuine crash', () => {
    // Real −50% crash; the only feed rows are a split effective BEFORE the last
    // close and one effective AFTER today. Old behavior froze this pending_ca.
    const feed = { NVDA: [
      { type: 'split', ticker: 'NVDA', effectiveDate: '2026-08-07', ratio: 2 },
      { type: 'split', ticker: 'NVDA', effectiveDate: '2026-08-14', ratio: 2 },
    ] };
    const r = classifyOvernightGaps(held(100), snap(50), feed, { sinceDate: '2026-08-11', asOfDate: '2026-08-12' });
    expect(r.pendingCA.has('NVDA')).toBe(false);
    expect(r.suspectedCA.has('NVDA')).toBe(true); // 0.5 is split-shaped with NO valid feed row — suspected, exits at last-good
  });
  it('C21-2/apply-then-scan: an action this book already settled (applied/declined) never re-freezes at close', () => {
    const action = { type: 'split', ticker: 'NVDA', effectiveDate: '2026-08-12', ratio: 1.5 };
    const feed = { NVDA: [action] };
    const settled = new Set([deriveActionId(action)]);
    // Post-application state: shares adjusted, lastMark ÷1.5, price ≈ lastMark.
    const r = classifyOvernightGaps({ NVDA: { shares: 15, costBasisTotal: 5000, lastMark: 66.67 } }, snap(66.8), feed, {
      sinceDate: '2026-08-11', excludeActionIds: settled,
    });
    expect(r.frozen.size).toBe(0);
    expect(r.passed).toContain('NVDA');
  });
  it('C21-3: integer split signatures to 50 are caught no-feed (12:1, 20:1, 50:1); odd ratios remain the documented residual', () => {
    for (const price of [100 / 12, 100 / 20, 100 / 50]) {
      const r = classifyOvernightGaps(held(100), snap(price), {});
      expect(r.suspectedCA.has('NVDA')).toBe(true);
    }
    // 5:2 (2.5) is NOT n or 1/n for integer n — accepted residual, feed-bounded.
    const odd = classifyOvernightGaps(held(100), snap(40), {});
    expect(odd.frozen.size).toBe(0);
  });
});

describe('delisting cashPerShare (C-21 review P3 finding 5)', () => {
  const book = () => ({ positions: { PINY: { shares: 100, costBasisTotal: 9000, lastMark: 100, sector: 'Industrials' } }, cash: 0 });
  it('a founder-supplied cashPerShare prices the forced close (cash-merger consideration, not the frozen mark)', () => {
    const r = applyCorporateAction(book(), { type: 'delisting', ticker: 'PINY', effectiveDate: '2026-08-12', cashPerShare: 200 });
    expect(r.ok).toBe(true);
    expect(r.cash).toBe(20000); // 100 sh × $200 deal price — not the $100 frozen mark
    expect(r.forcedClose.mark).toBe(200);
    expect(r.forcedClose.realizedPnl).toBe(11000);
  });
  it('absent cashPerShare, the spec-letter last-good behavior is unchanged', () => {
    const r = applyCorporateAction(book(), { type: 'delisting', ticker: 'PINY', effectiveDate: '2026-08-12' });
    expect(r.ok).toBe(true);
    expect(r.cash).toBe(10000);
    expect(r.forcedClose.mark).toBe(100);
  });
});
