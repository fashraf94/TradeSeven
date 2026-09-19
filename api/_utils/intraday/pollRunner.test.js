// api/_utils/intraday/pollRunner.test.js — contract §5.1, §5.3, §6.2 (deadline), §6.6 (seeding), §7.1 (log provenance).
import { describe, it, expect } from 'vitest';
import { makeInMemoryDb } from '../__fixtures__/inMemoryFirestore.js';
import { calendar, sessionOf, makeVendor, barsForDate, battleWith } from '../__fixtures__/intradayPollHarness.js';
import { runPoll, applyDeadlineForSession, planSeeds, applySeedToDoc } from './pollRunner.js';
import { acquireLease, loadActionableDocs, loadSnapshot, budgetRef, calcStateRef, definitionsRef } from './intradayStore.js';
import { sessionKeys } from './buckets.js';
import * as CONFIG from '../intradayConfig.js';

const S17 = sessionOf('2026-09-17');
const S16 = sessionOf('2026-09-16');
const UNIVERSE = ['AAPL', 'MSFT', 'NVDA', 'AMD', 'JPM', 'KO', 'XOM'];
const HELD = ['AAPL', 'MSFT', 'NVDA'];

function harness({ barsByDate = { '2026-09-16': barsForDate('2026-09-16') }, battles = [battleWith(HELD, ['AMD'], 'BTC')], omit = [], onRequest = null } = {}) {
  const mem = makeInMemoryDb();
  const vendor = makeVendor({ barsByDate, omit, onRequest });
  let t = S17.openMs;
  const now = () => t;
  vendor.now = now;
  const listActiveBattles = async () => battles;
  const poll = (atMs, over = {}) => { t = atMs; return runPoll({ db: mem.db, now, fetchImpl: vendor, apiKey: 'k', collectEnabled: true, calendar, listActiveBattles, universeStocks: UNIVERSE, owner: 'owner-A', log: { error: () => {} }, ...over }); };
  return { ...mem, vendor, poll, setTime: (ms) => { t = ms; } };
}
const minute = (session, m) => session.openMs + m * 60_000;

describe('§5.1 invocation order and guards', () => {
  it('flag off → skipped before any read', async () => {
    const h = harness();
    const r = await h.poll(minute(S17, 1), { collectEnabled: false });
    expect(r).toEqual({ skipped: true, reason: 'flag_off' });
    expect(h.readLog).toEqual([]);
  });
  it('missing calendar entry → calendar_missing, never a guess', async () => {
    const h = harness();
    const r = await h.poll(Date.UTC(2028, 0, 5, 15, 0, 0));
    expect(r).toMatchObject({ skipped: true, reason: 'calendar_missing' });
    expect(h.vendor.calls).toEqual([]);
  });
  it('non-trading day and outside the window are skipped; before the open the previous session\'s deadline is checked first', async () => {
    const h = harness();
    expect(await h.poll(Date.UTC(2026, 8, 19, 15, 0, 0))).toMatchObject({ skipped: true, reason: 'not_trading_day' });
    const pre = await h.poll(S17.openMs - 60_000);
    expect(pre).toMatchObject({ skipped: true, reason: 'outside_session_window' });
    expect(pre.deadline).toEqual([{ etDate: '2026-09-16', applied: false, reason: 'already_applied' }].map((d) => expect.objectContaining({ etDate: '2026-09-16' })));
    expect(await h.poll(S17.closeMs + 30 * 60_000)).toMatchObject({ skipped: true, reason: 'outside_session_window' });
    expect(await h.poll(S17.closeMs + 29 * 60_000 + 59_000)).toMatchObject({ published: true });
  });
  it('lease busy → skipped, nothing fetched', async () => {
    const h = harness();
    await acquireLease(h.db, { owner: 'someone-else', now: () => minute(S17, 1), leaseMs: 90_000 });
    const r = await h.poll(minute(S17, 1));
    expect(r).toMatchObject({ skipped: true, reason: 'lease_busy' });
    expect(h.vendor.calls).toEqual([]);
  });
});

describe('§5.3 the sweep', () => {
  it('publishes snapshot + state + actionable docs with one generation; units recorded per ticker requested + 5 per seed request; log entries carry provenance', async () => {
    const h = harness();
    const r = await h.poll(minute(S17, 1)); // 09:31 — not a universe minute (1 % 5)
    expect(r).toMatchObject({ published: true, generation: 1, universeSweep: false, actionable: 5 });
    // Requested: 4 actionable stocks + 1 crypto; seeds: 4 stocks × 1 session × 5 units.
    expect(r.requested).toBe(5);
    expect(r.unitsRecorded).toBe(5 + 4 * 5);
    const budget = h.store.get('intradayBudget/2026-09-17');
    expect(budget).toMatchObject({ unitsRequested: 25, sweeps: 1, unitsBySource: { live_v2: 4, live_v1_crypto: 1, intraday_1m_seed: 20 } });
    const snap = await loadSnapshot(h.db);
    expect(snap.generation).toBe(1);
    expect(snap.lease).toBeNull();
    expect(Object.keys(snap.symbols).sort()).toEqual(['AAPL', 'AMD', 'BTC', 'MSFT', 'NVDA']);
    expect(snap.symbols.BTC.indicators.vwap.reason).toBe('no_session_anchor');
    expect(snap.calcVersion).toBe(1);
    const docs = await loadActionableDocs(h.db, '2026-09-17', ['AAPL']);
    expect(docs.AAPL.seedStatus).toBe('seeded');
    expect(docs.AAPL.seededBuckets).toBe(60);
    expect(docs.AAPL.log).toHaveLength(1);
    expect(Object.keys(docs.AAPL.log[0])).toEqual(['sweepAt', 'priceAsOf', 'snapshotTs', 'price', 'estimate', 'experimental', 'estimateCutoff', 'volumeCutoffAsOf', 'calcVersion', 'strikeKey', 'generation']);
    expect(docs.AAPL.log[0]).toMatchObject({ sweepAt: minute(S17, 1), experimental: true, estimateCutoff: null, volumeCutoffAsOf: null, calcVersion: 1, generation: 1 });
    expect(docs.AAPL.log[0].strikeKey).toMatch(/^[0-9a-f]{16}$/);
    expect(docs.AAPL.generation).toBe(1);
    expect(h.store.get('intradayCalcState/2026-09-17').generation).toBe(1);
    expect((await definitionsRef(h.db, 1).get()).exists).toBe(true);
  });
  it('a universe minute sweeps the universe ∪ actionable, each symbol once; a missing symbol is anomalies.missing with no update', async () => {
    const h = harness({ omit: ['XOM'] });
    const r = await h.poll(minute(S17, 5));
    expect(r.universeSweep).toBe(true);
    expect(r.requested).toBe(UNIVERSE.length + 1); // 7 universe (∪ 4 actionable, deduped) + BTC
    expect(r.anomalies.missing).toBe(1);
    const snap = await loadSnapshot(h.db);
    expect(snap.symbols.XOM).toBeUndefined();
    expect(snap.symbols.KO).toBeDefined();
    expect(h.store.get('intradayBudget/2026-09-17').unitsRequested).toBe(8 + 20);
  });
  it('units are recorded even when the publish transaction fails (lease lost during the fetch)', async () => {
    let stolen = false;
    const h = harness({
      onRequest: async (url) => {
        if (!stolen && url.includes('/us-quote-delayed')) {
          stolen = true;
          // Another owner takes the lease while this sweep is fetching.
          await acquireLease(h.db, { owner: 'owner-B', now: () => minute(S17, 1) + 200_000, leaseMs: 90_000 });
        }
        return null;
      },
    });
    const r = await h.poll(minute(S17, 1));
    expect(r).toMatchObject({ published: false, reason: 'lease_lost', unitsRecorded: 25 });
    expect(h.store.get('intradayBudget/2026-09-17').unitsRequested).toBe(25);
    expect(h.store.has('intradayCalcState/2026-09-17')).toBe(false);
    expect(h.store.get('intradaySnapshots/latest').lease.owner).toBe('owner-B'); // never released B's lease
  });
  it('the vintage of the estimate grows sweep by sweep; unchanged quotes are not anomalies', async () => {
    const h = harness();
    await h.poll(minute(S17, 1));
    const r2 = await h.poll(minute(S17, 1) + 20_000); // same minute: the vendor returns the same trade
    expect(r2.counters.unchangedCount).toBeGreaterThan(0);
    expect(r2.anomalies.held).toBe(0);
    expect(r2.anomalies.rejected).toBe(0);
    const r3 = await h.poll(minute(S17, 2));
    expect(r3.counters.accepted + r3.counters.resumed).toBeGreaterThan(0);
    const docs = await loadActionableDocs(h.db, '2026-09-17', ['AAPL']);
    expect(docs.AAPL.log).toHaveLength(3);
    expect(docs.AAPL.log[2].generation).toBe(3);
  });
});

describe('§6.2 deadline — missed invocation finalised by the next one', () => {
  it('a last bucket left open at close is marked incomplete by the first invocation after close + 30 min, before the guard, idempotently', async () => {
    const h = harness();
    // Minutes are offsets from the 09:30 open (390 = 16:00). The 15-minute
    // delayed feed reaches the last bucket at 16:10 (400); stop at 16:12 (402)
    // — no exact-close observation (405) and no passage (410) arrive.
    for (const m of [380, 395, 400, 402]) await h.poll(minute(S17, m));
    let docs = await loadActionableDocs(h.db, '2026-09-17', ['AAPL']);
    const { lastKey } = sessionKeys(S17);
    const openLast = docs.AAPL.ring.buckets.find((b) => b.key === lastKey);
    expect(openLast?.status).toBe('open');
    // The deadline invocations (16:30 …) were "skipped"; the next invocation is at 17:15 ET.
    const late = await h.poll(S17.closeMs + 75 * 60_000);
    expect(late).toMatchObject({ skipped: true, reason: 'outside_session_window' });
    expect(late.deadline[0]).toMatchObject({ etDate: '2026-09-17', applied: true, marked: expect.any(Number) });
    expect(late.deadline[0].marked).toBeGreaterThanOrEqual(1);
    docs = await loadActionableDocs(h.db, '2026-09-17', ['AAPL']);
    expect(docs.AAPL.ring.buckets.find((b) => b.key === lastKey)).toMatchObject({ status: 'incomplete', reason: 'deadline', closeQualified: false });
    const again = await applyDeadlineForSession({ db: h.db, session: S17, nowMs: S17.closeMs + 76 * 60_000 });
    expect(again).toEqual({ applied: false, reason: 'already_applied' });
    // Before the deadline: nothing happens.
    expect(await applyDeadlineForSession({ db: h.db, session: S16, nowMs: S16.closeMs + 10 * 60_000 })).toEqual({ applied: false, reason: 'before_deadline' });
  });
});

describe('§6.6 seeding', () => {
  it('seeds 60 contiguous buckets from the previous session at the first sweep; MACD is ready from the seed', async () => {
    const h = harness();
    await h.poll(minute(S17, 1));
    const docs = await loadActionableDocs(h.db, '2026-09-17', ['AAPL']);
    expect(docs.AAPL.ring.buckets.filter((b) => b.seeded)).toHaveLength(60);
    expect(docs.AAPL.state.segmentLen).toBe(60);
    expect(docs.AAPL.state.macd).not.toBeNull();
    expect(h.vendor.calls.filter((u) => u.includes('/intraday/'))).toHaveLength(4);
  });
  it('fewer than 35 available → one further prior session is fetched (5 more units), at most two sessions; it connects only through a complete newer tail', async () => {
    // Sep 16 is gapped: only its last 20 minutes exist (4 buckets); Sep 15 is full.
    // The contract's second fetch happens (10 units); adjacency is session-
    // relative (last → first), so an older session can connect only when the
    // newer tail reaches the newer session's FIRST bucket — a gapped newer
    // session keeps its own 4. Literal §6.6; stated in the build report.
    const h = harness({ barsByDate: { '2026-09-16': barsForDate('2026-09-16', { sparseFromMinute: 371 }), '2026-09-15': barsForDate('2026-09-15') } });
    const r = await h.poll(minute(S17, 1));
    const intradayCalls = h.vendor.calls.filter((u) => u.includes('/intraday/AAPL'));
    expect(intradayCalls).toHaveLength(2);
    expect(r.unitsRecorded).toBe(5 + 4 * 10);
    const docs = await loadActionableDocs(h.db, '2026-09-17', ['AAPL']);
    expect(docs.AAPL.seedStatus).toBe('seeded');
    expect(docs.AAPL.seedSessions).toBe(2);
    expect(docs.AAPL.seededBuckets).toBe(4);
    expect(docs.AAPL.ring.buckets.filter((b) => b.sessionEtDate === '2026-09-16')).toHaveLength(4);
    expect(docs.AAPL.ring.buckets.filter((b) => b.sessionEtDate === '2026-09-15')).toHaveLength(0);
    // A COMPLETE short newer session (an early close, 42 buckets) needs no second fetch (42 ≥ 35);
    // the pure combiner proves the connecting case in seed.test.js.
  });

  it('vendor unpublished → the attempt is recorded, retried every 15 min, and marked unavailable after 2 h; today\'s buckets warm up on their own', async () => {
    const h = harness({ barsByDate: { '2026-09-16': null, '2026-09-15': null } });
    await h.poll(minute(S17, 1));
    let docs = await loadActionableDocs(h.db, '2026-09-17', ['AAPL']);
    expect(docs.AAPL).toMatchObject({ seedStatus: 'pending', seedAttempts: 1, seedFirstAttemptAt: minute(S17, 1), seedLastAttemptAt: minute(S17, 1) });
    const calls0 = h.vendor.calls.filter((u) => u.includes('/intraday/AAPL')).length;
    await h.poll(minute(S17, 2));
    expect(h.vendor.calls.filter((u) => u.includes('/intraday/AAPL')).length).toBe(calls0); // inside the 15-min interval: no retry
    await h.poll(minute(S17, 16));
    expect(h.vendor.calls.filter((u) => u.includes('/intraday/AAPL')).length).toBe(calls0 + 1);
    docs = await loadActionableDocs(h.db, '2026-09-17', ['AAPL']);
    expect(docs.AAPL.seedAttempts).toBe(2);
    // planSeeds expires after the window.
    const plan = planSeeds({ symbols: ['AAPL'], docs: { AAPL: { seedStatus: 'pending', seedFirstAttemptAt: minute(S17, 1), seedLastAttemptAt: minute(S17, 100) } }, nowMs: minute(S17, 1) + CONFIG.SEED_RETRY_WINDOW_MS + 1 });
    expect(plan).toEqual({ attempt: [], expire: ['AAPL'] });
    await h.poll(minute(S17, 1) + CONFIG.SEED_RETRY_WINDOW_MS + 60_000);
    docs = await loadActionableDocs(h.db, '2026-09-17', ['AAPL']);
    expect(docs.AAPL.seedStatus).toBe('unavailable');
    expect(docs.AAPL.ring.buckets.some((b) => b.seeded)).toBe(false);
  });
  it('a corporate action across the seed boundary is refused: seedStatus corporate_action, today\'s buckets untouched', () => {
    const today = { ring: { buckets: [{ key: 5, sessionEtDate: '2026-09-17', close: 40, status: 'completed', closeQualified: true, isFirst: true, isLast: false }] }, state: null, log: [], seedStatus: null };
    const seed = { ok: true, buckets: [{ key: 1, sessionEtDate: '2026-09-16', close: 100, status: 'completed', closeQualified: true, isFirst: false, isLast: true }], sessionsFetched: 1 };
    const out = applySeedToDoc({ doc: today, seed, sessionOf, nowMs: 1 });
    expect(out.seedStatus).toBe('corporate_action');
    expect(out.ring).toBe(today.ring);
  });
  it('mid-session join: a symbol that becomes actionable later is seeded on its first sweep', async () => {
    const battles = [battleWith(HELD, ['AMD'])];
    const h = harness({ battles });
    await h.poll(minute(S17, 1));
    battles[0].portfolio.bench.stocks.push({ symbol: 'JPM' });
    const r = await h.poll(minute(S17, 120));
    expect(r.seeds.JPM).toBe('fetched');
    const docs = await loadActionableDocs(h.db, '2026-09-17', ['JPM']);
    expect(docs.JPM.seedStatus).toBe('seeded');
  });
});
