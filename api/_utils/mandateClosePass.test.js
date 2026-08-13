// api/_utils/mandateClosePass.test.js
// Spec 1 §3.6 (P3) — the daily close pass: idempotency per date, sole-peak-
// writer discipline (I6), partial-close honesty (I11/F19), creation-day rows
// (I17), agencyState derivation (I10/D-17), corporate-action application +
// idempotency (§4.3), open-batch expiry (I1), the dual-label stream's durable
// retry (O-11/I14), liveness/run-rate alerts (I9/§6.2), retention (§3.7).

import { describe, it, expect, vi } from 'vitest';
import {
  closeBook, deriveAgencyState, appendScoringWithRetry,
  trailingLivenessRatio, healthAlertsAfterClose, runRetentionCleanup, etDateOf,
} from './mandateClosePass.js';
import { MANDATE_LIVENESS_FLOOR } from './mandateConfig.js';

// ── Fake Firestore: docs, subcollections, orderBy/limit/where queries, txns ──
function makeFakeDb(seed = {}) {
  const store = new Map(Object.entries(seed));

  function docRef(path) {
    const id = path.split('/').pop();
    return {
      path, id,
      collection: (sub) => colRef(`${path}/${sub}`),
      async get() { const d = store.get(path); return { exists: d !== undefined, id, data: () => d, ref: docRef(path) }; },
      async set(data, opts) {
        if (opts?.merge && store.has(path)) {
          const cur = store.get(path);
          const next = { ...cur };
          for (const [k, v] of Object.entries(data)) {
            next[k] = (v && typeof v === 'object' && !Array.isArray(v) && cur[k] && typeof cur[k] === 'object') ? { ...cur[k], ...v } : v;
          }
          store.set(path, next);
        } else store.set(path, data);
      },
      async update(patch) {
        const cur = store.get(path) || {};
        const next = { ...cur };
        for (const [k, v] of Object.entries(patch)) {
          if (k.includes('.')) {
            const segs = k.split('.');
            let o = next;
            for (let i = 0; i < segs.length - 1; i++) { o[segs[i]] = { ...(o[segs[i]] || {}) }; o = o[segs[i]]; }
            o[segs[segs.length - 1]] = v;
          } else next[k] = v;
        }
        store.set(path, next);
      },
      async delete() { store.delete(path); },
    };
  }

  function colRef(colPath, opts = {}) {
    const { orderField = null, filters = [], limitN = Infinity } = opts;
    return {
      doc: (id) => docRef(`${colPath}/${id}`),
      orderBy: (f) => colRef(colPath, { ...opts, orderField: f }),
      where: (f, op, v) => colRef(colPath, { ...opts, filters: [...filters, [f, op, v]] }),
      limit: (n) => colRef(colPath, { ...opts, limitN: n }),
      async get() {
        const depth = colPath.split('/').length + 1;
        let docs = [...store.entries()]
          .filter(([p]) => p.startsWith(`${colPath}/`) && p.split('/').length === depth)
          .map(([p, d]) => ({ id: p.split('/').pop(), data: () => d, ref: docRef(p) }));
        for (const [f, op, v] of filters) {
          docs = docs.filter((doc) => {
            const val = f === '__name__' ? doc.id : doc.data()[f];
            if (op === '<') return val < v;
            if (op === '==') return val === v;
            return true;
          });
        }
        if (orderField) docs.sort((a, b) => String(a.data()[orderField]).localeCompare(String(b.data()[orderField])));
        docs = docs.slice(0, limitN);
        return { docs };
      },
    };
  }

  return {
    _store: store,
    collection: (c) => colRef(c),
    doc: (p) => docRef(p),
    async runTransaction(fn) {
      return fn({ get: (r) => r.get(), set: (r, d) => r.set(d), update: (r, d) => r.update(d) });
    },
  };
}

// ── Fixtures ─────────────────────────────────────────────────────────────────
const DATE = '2026-08-12';
const NOW = new Date('2026-08-12T20:30:00Z'); // 16:30 ET — inside the close window
const REGIME = { regime: 'risk_on', regimeAsOf: '2026-08-12T20:00:00.000Z', regimeSource: 'indexIntelligence/marketContext' };

const CLOSE_SNAP = {
  tickKey: `${DATE}_close`,
  sessionDate: DATE,
  symbols: {
    AAPL: { complete: true, price: 210, sector: 'Technology', marketCap: 3e12, priceAsOf: '2026-08-12T20:00:00Z' },
    XOM: { complete: true, price: 105, sector: 'Energy', marketCap: 400e9, priceAsOf: '2026-08-12T20:00:00Z' },
  },
};

function bookDoc(overrides = {}) {
  return {
    status: 'active', revision: 10, quarterIndex: 1, quarterKey: 'm1:1',
    archetype: 'analyst', vintageRef: 'archetypeVintages/analyst_x',
    createdAt: new Date('2026-07-01T13:00:00Z'),
    portfolio: {
      cash: 100000,
      positions: { AAPL: { shares: 100, costBasisTotal: 20000, avgCost: 200, lastMark: 200, lastMarkAsOf: '2026-08-11T20:00:00Z', lastMarkSource: 'snapshot', sector: 'Technology', openedAt: '2026-08-01' } },
      totalValue: 120000, initialValue: 120000,
      lifetimeHighWaterMark: 121000, lifetimeDrawdownFromPeak: 0,
      quarterHighWaterMark: 121000, quarterDrawdownFromPeak: 0,
      frictionPaidCum: 3.5,
    },
    scoring: { quarter: null, lifetime: null, asOf: null },
    health: { consecutiveEvalFailures: 0, lastSuccessfulEvalAt: NOW, lastCloseMarkAt: null, missedMarks: 0, consecutiveMissedMarks: 0, quarantined: false },
    costTelemetry: { monthKey: '2026-08', tokensIn: 50000, tokensOut: 2500, estUsd: 0.08, today: { date: DATE, evalCount: 2, tokensIn: 24000, tokensOut: 1200, estUsd: 0.03, cacheHitTokens: 0 } },
    execState: { openBatchId: null, openBatchSubmittedAt: null, lastCloseKey: null, lastEvalTickKey: `${DATE}_midday`, submitted: 12, executed: 10, staleRejectStreak: 0 },
    ...overrides,
  };
}

function seed(book = bookDoc(), extra = {}) {
  return makeFakeDb({ 'mandates/m1': book, ...extra });
}

// ── deriveAgencyState (I10 / D-17) ───────────────────────────────────────────
describe('deriveAgencyState — the manager\'s alibi', () => {
  it("evaluated today with full tool → 'full'", () => {
    expect(deriveAgencyState(bookDoc(), DATE)).toBe('full');
  });
  it("quarantined → 'exit_only' whether or not it acted", () => {
    expect(deriveAgencyState(bookDoc({ health: { quarantined: true } }), DATE)).toBe('exit_only');
  });
  it("created intra-session, never evaluated → 'skipped:created_intraday' (I17)", () => {
    const b = bookDoc({ createdAt: new Date('2026-08-12T15:00:00Z'), execState: { lastEvalTickKey: null }, health: { consecutiveEvalFailures: 0, lastSuccessfulEvalAt: null, quarantined: false } });
    expect(deriveAgencyState(b, DATE)).toBe('skipped:created_intraday');
  });
  it("not evaluated + failure streak → 'skipped:eval_failure' (was NOT permitted to act)", () => {
    const b = bookDoc({ health: { consecutiveEvalFailures: 3, quarantined: false }, execState: { lastEvalTickKey: '2026-08-11_midday' } });
    expect(deriveAgencyState(b, DATE)).toBe('skipped:eval_failure');
  });
  it("not evaluated, no failures → 'skipped:not_evaluated'", () => {
    const b = bookDoc({ execState: { lastEvalTickKey: '2026-08-11_midday' }, health: { consecutiveEvalFailures: 0, lastSuccessfulEvalAt: new Date('2026-08-11T18:00:00Z'), quarantined: false } });
    expect(deriveAgencyState(b, DATE)).toBe('skipped:not_evaluated');
  });
  it('etDateOf converts instants to ET calendar dates (DST-safe)', () => {
    expect(etDateOf(new Date('2026-08-12T02:00:00Z'))).toBe('2026-08-11'); // 10pm ET prior day
    expect(etDateOf(new Date('2026-08-12T13:00:00Z'))).toBe('2026-08-12');
  });
});

// ── closeBook — the transaction ──────────────────────────────────────────────
describe('closeBook — authoritative close (§3.6)', () => {
  it('full close: marks at official close, writes the row, sets peaks (sole writer), bumps revision, idempotency key', async () => {
    const db = seed();
    const ref = db.doc('mandates/m1');
    const r = await closeBook(db, ref, { date: DATE, closeSnapshot: CLOSE_SNAP, now: NOW, regime: REGIME });
    expect(r.closed).toBe(true);

    const book = db._store.get('mandates/m1');
    // Marked at the session's official close: 100 sh × 210 + 100000 = 121000.
    expect(book.portfolio.totalValue).toBe(121000);
    expect(book.portfolio.positions.AAPL.lastMark).toBe(210);
    expect(book.portfolio.positions.AAPL.lastMarkSource).toBe('snapshot');
    // Sole peak writer (I6): HWM held at 121000 (equal), drawdown 0 on both lenses.
    expect(book.portfolio.lifetimeHighWaterMark).toBe(121000);
    expect(book.portfolio.quarterDrawdownFromPeak).toBe(0);
    expect(book.revision).toBe(11);
    expect(book.execState.lastCloseKey).toBe(DATE);
    expect(book.health.lastCloseMarkAt).toBe(NOW);

    const row = db._store.get(`mandates/m1/dailyRows/${DATE}`);
    expect(row).toMatchObject({
      date: DATE, totalValue: 121000, quarterIndex: 1, partial: false, degradedMarks: false,
      regime: 'risk_on', regimeSource: 'indexIntelligence/marketContext',
      agencyState: 'full', markSource: 'close_snapshot',
      evalCount: 2, tokensIn: 24000, tokensOut: 1200, estUsd: 0.03,
      frictionPaidCum: 3.5, submittedCum: 12, executedCum: 10,
    });
    expect(row.dayReturnPct).toBe(null); // no prior row — honest null, not a fabrication

    // Scoring recomputed both lenses; stream record carries the dual labels.
    expect(book.scoring.quarter.rowsTotal).toBe(1);
    expect(book.scoring.lifetime.rowsTotal).toBe(1);
    expect(r.streamRecord).toMatchObject({ mandateId: 'm1', agencyState: 'full', regime: 'risk_on', vintageRef: 'archetypeVintages/analyst_x' });
  });

  it('is idempotent per date: a repeat run no-ops (repeat generous fires)', async () => {
    const db = seed();
    const ref = db.doc('mandates/m1');
    await closeBook(db, ref, { date: DATE, closeSnapshot: CLOSE_SNAP, now: NOW, regime: REGIME });
    const afterFirst = db._store.get('mandates/m1');
    const r2 = await closeBook(db, ref, { date: DATE, closeSnapshot: CLOSE_SNAP, now: NOW, regime: REGIME });
    expect(r2.closed).toBe(false);
    expect(r2.skipped).toBe('already_closed');
    expect(db._store.get('mandates/m1').revision).toBe(afterFirst.revision); // no second bump
  });

  it('computes dayReturnPct from the PREVIOUS row and drawdown from the new peak', async () => {
    const db = seed(bookDoc(), {
      'mandates/m1/dailyRows/2026-08-11': { date: '2026-08-11', totalValue: 125000, dayReturnPct: 0.01, quarterIndex: 1, partial: false, frictionPaidCum: 1.5, submittedCum: 10, executedCum: 9 },
    });
    const ref = db.doc('mandates/m1');
    const r = await closeBook(db, ref, { date: DATE, closeSnapshot: CLOSE_SNAP, now: NOW, regime: REGIME });
    const row = db._store.get(`mandates/m1/dailyRows/${DATE}`);
    expect(row.dayReturnPct).toBeCloseTo((121000 - 125000) / 125000, 10);
    expect(row.dayFrictionPaid).toBeCloseTo(3.5 - 1.5, 10);
    // gross adds friction back ONCE (F14)
    expect(r.streamRecord.gross.grossDayReturnPct).toBeCloseTo(((121000 - 125000) + 2) / 125000, 10);
    const book = db._store.get('mandates/m1');
    expect(book.portfolio.quarterDrawdownFromPeak).toBeCloseTo(0, 10); // 121000 vs quarterHWM 121000
  });

  it('PARTIAL close (I11/F19): an unmarkable held symbol → carry-over mark, partial row, missedMarks++', async () => {
    const thinSnap = { ...CLOSE_SNAP, symbols: { XOM: CLOSE_SNAP.symbols.XOM } }; // AAPL missing at close
    const db = seed();
    const ref = db.doc('mandates/m1');
    const r = await closeBook(db, ref, { date: DATE, closeSnapshot: thinSnap, now: NOW, regime: REGIME });
    expect(r.closed).toBe(true);
    const row = db._store.get(`mandates/m1/dailyRows/${DATE}`);
    expect(row.partial).toBe(true);
    expect(row.degradedMarks).toBe(true);
    expect(row.markSource).toBe('carry_over');
    const book = db._store.get('mandates/m1');
    // Valued at the LAST GOOD mark (200), never a fabricated fresh one: 100×200 + 100000.
    expect(book.portfolio.totalValue).toBe(120000);
    expect(book.health.missedMarks).toBe(1);
    expect(book.health.consecutiveMissedMarks).toBe(1);
  });

  it('creation-day close (I17): partial:true row, skipped:created_intraday, null dayReturnPct', async () => {
    const db = seed(bookDoc({ createdAt: new Date('2026-08-12T15:30:00Z'), execState: { openBatchId: null, lastEvalTickKey: null, lastCloseKey: null, submitted: 0, executed: 0, staleRejectStreak: 0 }, health: { consecutiveEvalFailures: 0, lastSuccessfulEvalAt: null, lastCloseMarkAt: null, missedMarks: 0, consecutiveMissedMarks: 0, quarantined: false } }));
    const ref = db.doc('mandates/m1');
    await closeBook(db, ref, { date: DATE, closeSnapshot: CLOSE_SNAP, now: NOW, regime: REGIME });
    const row = db._store.get(`mandates/m1/dailyRows/${DATE}`);
    expect(row.partial).toBe(true);
    expect(row.agencyState).toBe('skipped:created_intraday');
    expect(row.dayReturnPct).toBe(null);
    // Creation-day partial is NOT a missed mark (all positions marked fine).
    expect(db._store.get('mandates/m1').health.missedMarks).toBe(0);
  });

  it('quarantined book still closes, with agencyState exit_only (never unmarked)', async () => {
    const db = seed(bookDoc({ health: { ...bookDoc().health, quarantined: true } }));
    await closeBook(db, db.doc('mandates/m1'), { date: DATE, closeSnapshot: CLOSE_SNAP, now: NOW, regime: REGIME });
    expect(db._store.get(`mandates/m1/dailyRows/${DATE}`).agencyState).toBe('exit_only');
  });

  it('applies a pending SPLIT before marking (§4.3): shares × ratio, basis unchanged, CA log written, idempotent next day', async () => {
    const splitSnap = {
      ...CLOSE_SNAP,
      symbols: {
        ...CLOSE_SNAP.symbols,
        AAPL: { ...CLOSE_SNAP.symbols.AAPL, price: 105, corporateActions: [{ type: 'split', ticker: 'AAPL', effectiveDate: DATE, ratio: 2, source: 'eodhd_splits' }] },
      },
    };
    const db = seed();
    const ref = db.doc('mandates/m1');
    const r = await closeBook(db, ref, { date: DATE, closeSnapshot: splitSnap, now: NOW, regime: REGIME });
    expect(r.closed).toBe(true);
    const book = db._store.get('mandates/m1');
    expect(book.portfolio.positions.AAPL.shares).toBe(200);         // × 2
    expect(book.portfolio.positions.AAPL.costBasisTotal).toBe(20000); // unchanged
    expect(book.portfolio.positions.AAPL.lastMark).toBe(105);        // marked at post-split close
    expect(book.portfolio.totalValue).toBe(121000);                  // value continuous through the split
    const log = db._store.get(`mandates/m1/corporateActions/split_AAPL_${DATE}`);
    expect(log).toMatchObject({ type: 'split', ticker: 'AAPL', ratio: 2 });
    const row = db._store.get(`mandates/m1/dailyRows/${DATE}`);
    expect(row.partial).toBe(false); // an explained, applied CA is a clean close

    // Next session: the same feed window still carries the action — the log doc
    // makes it a no-op (idempotent per {mandateId, actionId}).
    const nextSnap = { ...splitSnap, tickKey: '2026-08-13_close', symbols: { ...splitSnap.symbols, AAPL: { ...splitSnap.symbols.AAPL, price: 106 } } };
    await closeBook(db, ref, { date: '2026-08-13', closeSnapshot: nextSnap, now: new Date('2026-08-13T20:30:00Z'), regime: REGIME });
    expect(db._store.get('mandates/m1').portfolio.positions.AAPL.shares).toBe(200); // NOT re-split
  });

  it('applies a cash dividend as INCOME on the row (not trading P&L)', async () => {
    const divSnap = {
      ...CLOSE_SNAP,
      symbols: { ...CLOSE_SNAP.symbols, AAPL: { ...CLOSE_SNAP.symbols.AAPL, corporateActions: [{ type: 'cash_dividend', ticker: 'AAPL', effectiveDate: DATE, amount: 0.25, source: 'eodhd_dividends' }] } },
    };
    const db = seed();
    await closeBook(db, db.doc('mandates/m1'), { date: DATE, closeSnapshot: divSnap, now: NOW, regime: REGIME });
    const book = db._store.get('mandates/m1');
    expect(book.portfolio.cash).toBe(100025); // 100 sh × $0.25
    const row = db._store.get(`mandates/m1/dailyRows/${DATE}`);
    expect(row.dividendIncomeUsd).toBe(25);
    expect(book.portfolio.totalValue).toBe(121025);
  });

  it('a DELISTING forces close at last-good with a CORPORATE_CLOSE receipt', async () => {
    const delistSnap = {
      ...CLOSE_SNAP,
      symbols: { XOM: CLOSE_SNAP.symbols.XOM, AAPL: { complete: false, price: null, corporateActions: [{ type: 'delisting', ticker: 'AAPL', effectiveDate: DATE, source: 'founder' }] } },
    };
    const db = seed();
    await closeBook(db, db.doc('mandates/m1'), { date: DATE, closeSnapshot: delistSnap, now: NOW, regime: REGIME });
    const book = db._store.get('mandates/m1');
    expect(book.portfolio.positions.AAPL).toBeUndefined();
    expect(book.portfolio.cash).toBe(100000 + 100 * 200); // forced close at last-good 200
    const dec = db._store.get(`mandates/m1/decisions/corp_close_delisting_AAPL_${DATE}`);
    expect(dec).toMatchObject({ verb: 'CORPORATE_CLOSE', status: 'executed', fillMarkQuality: 'carry_over', realizedPnl: 0 });
  });

  it('a suspected-CA gap at close (ratio-shaped, no feed) keeps the carry-over mark and flags the row', async () => {
    const gapSnap = { ...CLOSE_SNAP, symbols: { ...CLOSE_SNAP.symbols, AAPL: { complete: true, price: 100, sector: 'Technology', marketCap: 3e12, priceAsOf: '2026-08-12T20:00:00Z' } } }; // ÷2 vs lastMark 200
    const db = seed();
    const r = await closeBook(db, db.doc('mandates/m1'), { date: DATE, closeSnapshot: gapSnap, now: NOW, regime: REGIME });
    const book = db._store.get('mandates/m1');
    expect(book.portfolio.positions.AAPL.lastMark).toBe(200); // NOT the phantom 100
    const row = db._store.get(`mandates/m1/dailyRows/${DATE}`);
    expect(row.partial).toBe(true);
    expect(r.alerts.some((a) => a.includes('MANDATE_SUSPECTED_CA'))).toBe(true);
  });

  it('an unrecognized CA type quarantines the SYMBOL (frozen mark + alert), never a silent mismark', async () => {
    const weirdSnap = {
      ...CLOSE_SNAP,
      symbols: { ...CLOSE_SNAP.symbols, AAPL: { ...CLOSE_SNAP.symbols.AAPL, corporateActions: [{ type: 'exotic_spinoff', ticker: 'AAPL', effectiveDate: DATE }] } },
    };
    const db = seed();
    const r = await closeBook(db, db.doc('mandates/m1'), { date: DATE, closeSnapshot: weirdSnap, now: NOW, regime: REGIME });
    expect(r.alerts.some((a) => a.includes('MANDATE_CA_UNRECOGNIZED'))).toBe(true);
    const book = db._store.get('mandates/m1');
    expect(book.portfolio.positions.AAPL.lastMark).toBe(200); // carry-over, not the fresh mark
    expect(db._store.get(`mandates/m1/dailyRows/${DATE}`).partial).toBe(true);
  });

  it('auto-expires a stale open batch to terminal `expired` with the gate cleared (I1)', async () => {
    const db = seed(bookDoc({
      execState: {
        openBatchId: 'stale_req_1', openBatchSubmittedAt: new Date('2026-08-12T10:00:00Z'), // >4h before NOW
        lastCloseKey: null, lastEvalTickKey: `${DATE}_midday`, submitted: 12, executed: 10, staleRejectStreak: 0,
      },
    }));
    await closeBook(db, db.doc('mandates/m1'), { date: DATE, closeSnapshot: CLOSE_SNAP, now: NOW, regime: REGIME });
    const book = db._store.get('mandates/m1');
    expect(book.execState.openBatchId).toBe(null); // submit-eligibility restored
    expect(book.execState.staleRejectStreak).toBe(1); // an age-out is a liveness event (I9)
    expect(db._store.get('mandates/m1/decisions/stale_req_1')).toMatchObject({ status: 'expired' });
  });
});

// ── Dual-label stream durable retry (O-11 / I14) ─────────────────────────────
describe('appendScoringWithRetry', () => {
  it('append ok → no marker; append failed → durable marker; next close retries and clears it', async () => {
    const db = seed();
    const ref = db.doc('mandates/m1');
    const record = { mandateId: 'm1', date: DATE };

    // Failure path: a durable marker is written.
    const failing = vi.fn(async () => false);
    const r1 = await appendScoringWithRetry(db, ref, record, { date: DATE, appendFn: failing });
    expect(r1.appended).toBe(false);
    expect(db._store.get(`mandates/m1/pendingScoringAppends/${DATE}`)).toMatchObject({ date: DATE });

    // Next close: pending marker consumed FIRST, today's appended, marker deleted.
    const succeeding = vi.fn(async () => true);
    const r2 = await appendScoringWithRetry(db, ref, { mandateId: 'm1', date: '2026-08-13' }, { date: '2026-08-13', appendFn: succeeding });
    expect(r2.retried).toBe(1);
    expect(r2.appended).toBe(true);
    expect(db._store.get(`mandates/m1/pendingScoringAppends/${DATE}`)).toBeUndefined();
    expect(succeeding).toHaveBeenCalledTimes(2); // the pending record + today's
  });
  it('a throwing appender is treated as a failed append (marker written), never a crash', async () => {
    const db = seed();
    const ref = db.doc('mandates/m1');
    const thrower = vi.fn(async () => { throw new Error('gcs down'); });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await appendScoringWithRetry(db, ref, { date: DATE }, { date: DATE, appendFn: thrower });
    expect(r.appended).toBe(false);
    expect(db._store.get(`mandates/m1/pendingScoringAppends/${DATE}`)).toBeDefined();
    spy.mockRestore();
  });
});

// ── Health alerts (I9 / §6.2) ────────────────────────────────────────────────
describe('trailing liveness + run-rate alerts', () => {
  function rowsWithCounters(pairs) {
    return pairs.map(([submitted, executed], i) => ({ date: `2026-08-${String(i + 1).padStart(2, '0')}`, submittedCum: submitted, executedCum: executed }));
  }
  it('a low executed/submitted ratio over the window alerts; a HOLD-heavy healthy book does not', () => {
    const unhealthy = rowsWithCounters([[0, 0], [10, 1], [20, 2]]);
    const a = healthAlertsAfterClose({ mandateId: 'm1', rows: unhealthy, monthEstUsd: 0.1 });
    expect(a.some((x) => x.includes('MANDATE_LIVENESS_LOW'))).toBe(true);
    const healthy = rowsWithCounters([[0, 0], [10, 10], [20, 20]]); // HOLDs count as executed
    expect(healthAlertsAfterClose({ mandateId: 'm1', rows: healthy, monthEstUsd: 0.1 })).toEqual([]);
  });
  it('too-quiet windows return null ratio (no false alerts on tiny samples)', () => {
    expect(trailingLivenessRatio(rowsWithCounters([[0, 0], [2, 0]]))).toBe(null);
  });
  it('month estUsd above the D-22 band alerts MANDATE_RUNRATE_EXCEEDED', () => {
    const a = healthAlertsAfterClose({ mandateId: 'm1', rows: [], monthEstUsd: 1.25 });
    expect(a.some((x) => x.includes('MANDATE_RUNRATE_EXCEEDED'))).toBe(true);
  });
  it(`the liveness floor consumed here is the configured ${MANDATE_LIVENESS_FLOOR} (constant is wired, not dead)`, () => {
    const border = [[0, 0], [10, Math.ceil(10 * MANDATE_LIVENESS_FLOOR)]];
    expect(healthAlertsAfterClose({ mandateId: 'm1', rows: border.map(([s, e], i) => ({ date: `2026-08-0${i + 1}`, submittedCum: s, executedCum: e })), monthEstUsd: 0 })).toEqual([]);
  });
});

// ── Retention (§3.7) ─────────────────────────────────────────────────────────
describe('runRetentionCleanup', () => {
  it('deletes snapshot docs older than 120 days, keeps recent, never touches the record families', async () => {
    const db = makeFakeDb({
      'mandateUniverseSnapshots/2026-03-01_open30': { tickKey: 'old' },
      'mandateUniverseSnapshots/2026-08-11_close': { tickKey: 'recent' },
      'mandateUniverseDaily/2026-03-01': { date: 'old' },
      'mandateUniverseDaily/2026-08-11': { date: 'recent' },
      'mandates/m1/dailyRows/2026-03-01': { date: 'the record — untouchable' },
    });
    const deleted = await runRetentionCleanup(db, { now: NOW });
    expect(deleted).toBe(2);
    expect(db._store.has('mandateUniverseSnapshots/2026-03-01_open30')).toBe(false);
    expect(db._store.has('mandateUniverseSnapshots/2026-08-11_close')).toBe(true);
    expect(db._store.has('mandateUniverseDaily/2026-03-01')).toBe(false);
    expect(db._store.has('mandates/m1/dailyRows/2026-03-01')).toBe(true);
  });

  it('P5 (§3.7): deletes TERMINAL batch docs past 30 days; an OPEN one is preserved and alerted; the I9 stats record is never swept', async () => {
    const db = makeFakeDb({
      'mandateBatches/msgbatch_old_done': { providerBatchId: 'msgbatch_old_done', sessionDate: '2026-06-01', status: 'harvested' },
      'mandateBatches/msgbatch_old_open': { providerBatchId: 'msgbatch_old_open', sessionDate: '2026-06-01', status: 'open' },
      'mandateBatches/msgbatch_recent': { providerBatchId: 'msgbatch_recent', sessionDate: '2026-08-10', status: 'harvested' },
      'mandateBatchStats/2026-06-01': { date: '2026-06-01', batches: {} }, // acceptance-#8 evidence — retained (stated reading)
    });
    const errs = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((m) => errs.push(String(m)));
    const deleted = await runRetentionCleanup(db, { now: NOW });
    spy.mockRestore();
    expect(deleted).toBe(1);
    expect(db._store.has('mandateBatches/msgbatch_old_done')).toBe(false);   // terminal + old → swept
    expect(db._store.has('mandateBatches/msgbatch_old_open')).toBe(true);    // OPEN → never deleted (I1)
    expect(errs.some((e) => e.includes('MANDATE_BATCH_STUCK_OPEN') && e.includes('msgbatch_old_open'))).toBe(true);
    expect(db._store.has('mandateBatches/msgbatch_recent')).toBe(true);      // inside the window
    expect(db._store.has('mandateBatchStats/2026-06-01')).toBe(true);        // the record side — kept
  });
});

// ── P3 verification-pass regression guards (INV-1/INV-2/SPEC-2/MONEY-6/MONEY-8 + entitlement) ─

describe('missed-session accounting + return-quality labels (P3 review)', () => {
  it('INV-2/SPEC-2: a close after a fully-missed session labels the row (sessionsSpanned) and counts the gap retroactively', async () => {
    // prev row Monday 2026-08-10; close Wednesday 2026-08-12 → Tuesday 08-11
    // was a trading session with NO row: gapSessions = 1.
    const db = seed(bookDoc(), {
      'mandates/m1/dailyRows/2026-08-10': { date: '2026-08-10', totalValue: 125000, dayReturnPct: 0.01, quarterIndex: 1, partial: false, frictionPaidCum: 1.5 },
    });
    const r = await closeBook(db, db.doc('mandates/m1'), { date: DATE, closeSnapshot: CLOSE_SNAP, now: NOW, regime: REGIME });
    const row = db._store.get(`mandates/m1/dailyRows/${DATE}`);
    expect(row.sessionsSpanned).toBe(2); // NOT a day return — spans 08-10 → 08-12
    expect(row.dayReturnPct).toBeCloseTo((121000 - 125000) / 125000, 10); // factual, labeled
    const book = db._store.get('mandates/m1');
    expect(book.health.missedMarks).toBe(1); // the fully-missed 08-11 counted
    expect(book.health.consecutiveMissedMarks).toBe(0); // today closed FULL — streak ends (already alerted retroactively if ≥ threshold)
    expect(r.row.sessionsSpanned).toBe(2);
  });
  it('INV-2: two missed sessions + today partial reaches the §6.4 alert threshold retroactively', async () => {
    // prev row Friday 2026-08-07; close Wednesday 08-12 with a partial mark:
    // gap = Mon 08-10 + Tue 08-11 = 2, today partial = +1 → streak 3, alert ≥2.
    const thinSnap = { ...CLOSE_SNAP, symbols: { XOM: CLOSE_SNAP.symbols.XOM } };
    const db = seed(bookDoc(), {
      'mandates/m1/dailyRows/2026-08-07': { date: '2026-08-07', totalValue: 125000, quarterIndex: 1, partial: false, frictionPaidCum: 0 },
    });
    const r = await closeBook(db, db.doc('mandates/m1'), { date: DATE, closeSnapshot: thinSnap, now: NOW, regime: REGIME });
    const book = db._store.get('mandates/m1');
    expect(book.health.missedMarks).toBe(3);
    expect(book.health.consecutiveMissedMarks).toBe(3);
    expect(r.alerts.some((a) => a.startsWith('MANDATE_MISSED_MARKS 3'))).toBe(true);
  });
  it('MONEY-8: the first fresh row after a carry-over row is labeled returnBaseDegraded', async () => {
    const db = seed(bookDoc(), {
      'mandates/m1/dailyRows/2026-08-11': { date: '2026-08-11', totalValue: 120000, quarterIndex: 1, partial: true, markSource: 'carry_over', degradedMarks: true, frictionPaidCum: 0 },
    });
    await closeBook(db, db.doc('mandates/m1'), { date: DATE, closeSnapshot: CLOSE_SNAP, now: NOW, regime: REGIME });
    const row = db._store.get(`mandates/m1/dailyRows/${DATE}`);
    expect(row.returnBaseDegraded).toBe(true); // baselined on a frozen value — excluded from variance
    expect(row.sessionsSpanned).toBe(1);
  });
  it('MONEY-6: the FIRST row\'s dayFrictionPaid is null (no window), never all-inception friction as one day', async () => {
    const db = seed(bookDoc()); // no prior rows; book carries frictionPaidCum 3.5
    await closeBook(db, db.doc('mandates/m1'), { date: DATE, closeSnapshot: CLOSE_SNAP, now: NOW, regime: REGIME });
    const row = db._store.get(`mandates/m1/dailyRows/${DATE}`);
    expect(row.dayFrictionPaid).toBeNull();
    expect(row.frictionPaidCum).toBe(3.5); // the cum field still carries the total
    expect(row.sessionsSpanned).toBeNull(); // no prior row — no span to label
  });
  it('INV-1 (success side): a committed close stamps lastCloseAttemptAt and clears consecutiveCloseFailures', async () => {
    const db = seed(bookDoc({ health: { ...bookDoc().health, consecutiveCloseFailures: 2 } }));
    await closeBook(db, db.doc('mandates/m1'), { date: DATE, closeSnapshot: CLOSE_SNAP, now: NOW, regime: REGIME });
    const book = db._store.get('mandates/m1');
    expect(book.health.lastCloseAttemptAt).toBe(NOW);
    expect(book.health.consecutiveCloseFailures).toBe(0);
  });
});

describe('CA entitlement through closeBook (SPEC-1 ≡ MONEY-2, CONFIRMED by independent verifier)', () => {
  it('a dividend whose ex-date precedes the position\'s openedAt is DECLINED: no phantom income, durable not_entitled claim', async () => {
    // Book bought AAPL 2026-08-01… but this dividend went ex on 2026-08-01 too?
    // No: position openedAt 2026-08-01; dividend effective 2026-08-01 → NOT
    // entitled (strict <). Use an ex-date equal to openedAt to pin strictness.
    const divSnap = {
      ...CLOSE_SNAP,
      symbols: { ...CLOSE_SNAP.symbols, AAPL: { ...CLOSE_SNAP.symbols.AAPL, corporateActions: [{ type: 'cash_dividend', ticker: 'AAPL', effectiveDate: '2026-08-01', amount: 0.25, source: 'eodhd_dividends' }] } },
    };
    const db = seed();
    await closeBook(db, db.doc('mandates/m1'), { date: DATE, closeSnapshot: divSnap, now: NOW, regime: REGIME });
    const book = db._store.get('mandates/m1');
    expect(book.portfolio.cash).toBe(100000); // NOT 100025 — no fabricated income
    const row = db._store.get(`mandates/m1/dailyRows/${DATE}`);
    expect(row.dividendIncomeUsd).toBe(0);
    const claim = db._store.get('mandates/m1/corporateActions/cash_dividend_AAPL_2026-08-01');
    expect(claim).toMatchObject({ applied: false, reason: 'not_entitled' });
  });
  it('a position with NO openedAt declines as no_entitlement_data WITH an alert (never fabricate, never silent)', async () => {
    const legacyBook = bookDoc();
    delete legacyBook.portfolio.positions.AAPL.openedAt;
    const divSnap = {
      ...CLOSE_SNAP,
      symbols: { ...CLOSE_SNAP.symbols, AAPL: { ...CLOSE_SNAP.symbols.AAPL, corporateActions: [{ type: 'cash_dividend', ticker: 'AAPL', effectiveDate: '2026-08-01', amount: 0.25, source: 'eodhd_dividends' }] } },
    };
    const db = seed(legacyBook);
    const r = await closeBook(db, db.doc('mandates/m1'), { date: DATE, closeSnapshot: divSnap, now: NOW, regime: REGIME });
    expect(db._store.get('mandates/m1').portfolio.cash).toBe(100000);
    expect(r.alerts.some((a) => a.startsWith('MANDATE_CA_NO_ENTITLEMENT_DATA'))).toBe(true);
    const claim = db._store.get('mandates/m1/corporateActions/cash_dividend_AAPL_2026-08-01');
    expect(claim).toMatchObject({ applied: false, reason: 'no_entitlement_data' });
  });
  it('an entitled dividend (openedAt strictly before ex-date) still credits income — the guard blocks fabrication, not §4.3', async () => {
    const divSnap = {
      ...CLOSE_SNAP,
      symbols: { ...CLOSE_SNAP.symbols, AAPL: { ...CLOSE_SNAP.symbols.AAPL, corporateActions: [{ type: 'cash_dividend', ticker: 'AAPL', effectiveDate: DATE, amount: 0.25, source: 'eodhd_dividends' }] } },
    };
    const db = seed(); // fixture openedAt 2026-08-01 < 2026-08-12 ex-date → entitled
    await closeBook(db, db.doc('mandates/m1'), { date: DATE, closeSnapshot: divSnap, now: NOW, regime: REGIME });
    const book = db._store.get('mandates/m1');
    expect(book.portfolio.cash).toBe(100025);
    expect(db._store.get(`mandates/m1/dailyRows/${DATE}`).dividendIncomeUsd).toBe(25);
  });
});
