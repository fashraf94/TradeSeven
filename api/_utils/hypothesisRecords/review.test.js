// api/_utils/hypothesisRecords/review.test.js
//
// Pilot P1c — THE REVIEW CARD'S EVIDENCE (founder ruling E2; build prompt
// acceptance row 3). The units (review.js) and the route
// (api/forge/watchlists/[id]/hypothesis-versions/[n]/review.js) over the
// shared path-keyed store double, with the market-data authority
// (marketDataCache.js getStockAnalysisData) replaced by a counting double:
//   · deployedBattleIds is appended at first deploy and redeploy (the real
//     creation transaction — carriage.test.js and decide.carriage.test.js pin
//     the documents);
//   · the route renders for review_due and for retired-after-deploy; 404
//     disabled with the gate off (before any read); 403 for a non-owner; 409
//     for a version that never deployed or whose window is open;
//   · the window: start = the close of the session before the anchor session;
//     end = the due close (timed) or the close of the session the last
//     carrying battle ended in (battle-end);
//   · the FROZEN tickers of the first carrying battle, never the live list;
//     names with no data are `unavailable` with a reason, never null;
//   · computed ONCE: a second request makes ZERO market-data calls; at most 11
//     calls per version per lifetime (10 names + SPY); a live claim computes
//     nothing; a dead one is finalized with no call;
//   · the honest line, verbatim, with the frozen agent name.
//
// Dependency-surface guard (BUILD_RULES §4): review.js, carriage.js and the
// shared vocabulary are imported for real.

process.env.TZ = 'UTC';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeCallsFirestore, stored } from '../__fixtures__/callsFirestore.js';

const state = vi.hoisted(() => ({ db: null, flag: true, calls: [], daily: {}, failing: new Set() }));
vi.mock('../../../src/config/featureFlags.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, get HYPOTHESIS_RECORDS_ENABLED() { return state.flag; } };
});
vi.mock('../firebaseAdmin.js', () => ({ getFirebaseAdmin: () => state.db }));
vi.mock('../security.js', async (importOriginal) => ({ ...(await importOriginal()), applySecurityMiddleware: () => false }));
vi.mock('../authMiddleware.js', async (importOriginal) => ({ ...(await importOriginal()), requireAuth: async (req) => ({ uid: req.headers?.['x-test-uid'] || 'rev-owner-1' }) }));
vi.mock('../marketDataCache.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getStockAnalysisData: async (symbol, options) => {
    state.calls.push({ symbol, options });
    if (state.failing.has(symbol)) throw new Error('EODHD daily OHLCV responded with 500');
    return { symbol, daily: state.daily[symbol] ?? [] };
  },
}));

const R = await import('./review.js');
const { REVIEW_HONEST_LINE } = await import('../../../src/constants/hypothesisRecords.js');
const { default: route } = await import('../../forge/watchlists/[id]/hypothesis-versions/[n]/review.js');

const OWNER = 'rev-owner-1';
const OTHER = 'rev-other-2';
const WL = 'wl-rev-1';
const ENV = 'COCKPIT_ALLOWLIST_UIDS';
const vPath = (n) => `watchlists/${WL}/hypothesisVersions/v${n}`;

// The founder's own case (P6 shadow read, 14 Oct 2026): an intraday idea first deployed Tue 13 Oct 13:21 ET,
// due at Thu 15 Oct's close; its window opens at Mon 12 Oct's close (Columbus Day: the exchange was open).
const FIRST = '2026-10-13T17:21:40.668Z';
const DUE = '2026-10-15T20:00:00.000Z';
const AFTER_SETTLE = Date.parse(DUE) + R.REVIEW_SETTLE_MS + 60_000;

const bar = (date, close) => ({ date, open: close, high: close, low: close, close, rawClose: close, volume: 1 });
const series = (start, end) => [bar('2026-10-15', end), bar('2026-10-14', (start + end) / 2), bar('2026-10-13', start), bar('2026-10-12', start)];

function versionDoc(over = {}) {
  return {
    version: 1, watchlistId: WL, userId: OWNER, statement: 'Inference demand broadens.', horizonEnum: 'intraday', horizonSource: 'parse',
    activation: [], invalidation: [], evidenceRefs: [], publishedAt: null, origin: 'signaldrop', contentHash: 'c'.repeat(64),
    status: 'review_due', stateChangedAt: '2026-10-15T20:15:00.000Z', stateSource: 'review_pass', stateReason: 'horizon_elapsed',
    firstDeployedAt: FIRST, reviewDueAt: DUE, lastDeployedAt: '2026-10-14T15:38:00.000Z', lastDeployedBattleId: 'b-2',
    deployedBattleIds: ['b-1', 'b-2'], successorVersion: null, missingEvidence: null, ...over,
  };
}
function battleDoc(id, over = {}) {
  return {
    ownerId: OWNER, agentId: 'casual-agent-rev', status: 'completed', createdAt: id === 'b-1' ? FIRST : '2026-10-14T15:38:00.000Z',
    expiresAt: id === 'b-1' ? '2026-10-14T00:00:00.000Z' : '2026-10-15T00:00:00.000Z', completedAt: id === 'b-1' ? '2026-10-14T00:05:00.000Z' : '2026-10-14T20:55:26.000Z',
    agentContext: {
      agentName: 'Shadow',
      equippedWatchlist: { watchlistId: WL, name: 'AI capex', tickers: ['NVDA', 'AMD', 'PLTR'] },
      equippedHypothesis: { watchlistId: WL, hypothesisVersion: 1 },
    },
    ...over,
  };
}
function seed({ version = versionDoc(), battles = { 'b-1': battleDoc('b-1'), 'b-2': battleDoc('b-2', { completionReason: 'voided' }) }, list = {} } = {}) {
  const docs = {
    [`watchlists/${WL}`]: { watchlistId: WL, userId: OWNER, name: 'Renamed live list', status: 'committed', tickers: [{ symbol: 'TSLA' }], ...list },
    [vPath(version.version)]: version,
  };
  for (const [id, b] of Object.entries(battles)) docs[`agentBattles/${id}`] = b;
  return makeCallsFirestore({ docs });
}
function res() {
  return { statusCode: null, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
}
async function get(db, { n = 1, uid = OWNER } = {}) {
  state.db = db;
  const r = res();
  await route({ method: 'GET', headers: { 'x-test-uid': uid }, query: { id: WL, n: String(n) }, body: {} }, r);
  return r;
}

let savedEnv;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(AFTER_SETTLE));
  state.flag = true;
  state.calls = [];
  state.failing = new Set();
  state.daily = { NVDA: series(100, 110), AMD: series(50, 45), PLTR: series(20, 21), SPY: series(500, 505) };
  savedEnv = process.env[ENV];
  process.env[ENV] = `${OWNER},${OTHER}`;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  if (savedEnv === undefined) delete process.env[ENV]; else process.env[ENV] = savedEnv;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ════════════════════════════════════════════════════════════════════════════
describe('the gate and the owner', () => {
  it('flag OFF → 404 disabled before ANY read (no store access, no market call)', async () => {
    state.flag = false;
    const db = seed();
    const r = await get(db);
    expect([r.statusCode, r.body]).toEqual([404, { error: 'disabled' }]);
    expect(db.__access).toEqual({ reads: [], writes: [], queries: [] });
    expect(state.calls).toEqual([]);
  });
  it('an owner OFF the allowlist → 404 disabled, no read', async () => {
    process.env[ENV] = OTHER;
    const db = seed();
    const r = await get(db);
    expect([r.statusCode, r.body]).toEqual([404, { error: 'disabled' }]);
    expect(db.__access.reads).toEqual([]);
  });
  it('another owner\'s list → 403 forbidden, no version or battle read, no market call', async () => {
    const db = seed();
    const r = await get(db, { uid: OTHER });
    expect([r.statusCode, r.body.error]).toEqual([403, 'forbidden']);
    expect(db.__access.reads.filter((p) => p.startsWith('agentBattles/') || p.includes('/hypothesisVersions/'))).toEqual([]);
    expect(state.calls).toEqual([]);
  });
  it('a malformed version number → 400; a missing version → 404', async () => {
    const db = seed();
    state.db = db;
    const r = res();
    await route({ method: 'GET', headers: {}, query: { id: WL, n: 'one' }, body: {} }, r);
    expect([r.statusCode, r.body.error]).toEqual([400, 'invalid_version']);
    expect((await get(db, { n: 7 })).statusCode).toBe(404);
  });
});

describe('when there is a card', () => {
  it('review_due (timed) → 200; ready, activated, draft, a retired version that never deployed → 409 review_unavailable', async () => {
    expect((await get(seed())).statusCode).toBe(200);
    for (const over of [
      { status: 'ready', firstDeployedAt: null }, { status: 'activated' }, { status: 'draft', firstDeployedAt: null },
      { status: 'retired', firstDeployedAt: null }, { status: 'cancelled', firstDeployedAt: null },
    ]) {
      const r = await get(seed({ version: versionDoc(over) }));
      expect([r.statusCode, r.body.error], JSON.stringify(over)).toEqual([409, 'review_unavailable']);
    }
  });
  it('RETIRED after a deploy (the founder\'s v1) → the card, from a pre-P1c record: lastDeployedBattleId alone names the carrying battle', async () => {
    const v1 = versionDoc({ status: 'retired', stateSource: 'player', stateReason: 'player_retired' });
    delete v1.deployedBattleIds;
    const r = await get(seed({ version: v1 }));
    expect(r.statusCode).toBe(200);
    expect(r.body.battles).toEqual([{ battleId: 'b-2', createdAt: '2026-10-14T15:38:00.000Z', endedAt: '2026-10-14T20:55:26.000Z', voided: true, known: true }]);
    expect(r.body.evidence.names.map((n) => n.symbol)).toEqual(['NVDA', 'AMD', 'PLTR']);
  });
  it('the window has not closed (before the due close) → 409 review_window_open, nothing read from the market', async () => {
    vi.setSystemTime(new Date(Date.parse(DUE) - 60_000));
    const r = await get(seed());
    expect([r.statusCode, r.body.error, r.body.reason]).toEqual([409, 'review_window_open', 'window_open']);
    expect(state.calls).toEqual([]);
  });
});

describe('the window (the rule as built)', () => {
  it('TIMED: start = the close of the session before the anchor session (Mon 12 Oct), end = the due close (Thu 15 Oct)', async () => {
    const r = await get(seed());
    expect(r.body.window).toEqual({
      kind: 'timed',
      start: { etDate: '2026-10-12', closeAt: '2026-10-12T20:00:00.000Z' },
      end: { etDate: '2026-10-15', closeAt: DUE },
      empty: false,
    });
  });
  it('a first deploy BEFORE the open anchors to that day\'s session; one after the close to the next — the start is the close before it', () => {
    const before = R.reviewWindowOf({ version: versionDoc({ firstDeployedAt: '2026-10-13T12:00:00.000Z' }), nowMs: AFTER_SETTLE });
    expect(before.window.start.etDate).toBe('2026-10-12');
    const evening = R.reviewWindowOf({ version: versionDoc({ firstDeployedAt: '2026-10-13T22:00:00.000Z' }), nowMs: AFTER_SETTLE });
    expect(evening.window.start.etDate).toBe('2026-10-13'); // anchored to Wed 14 Oct; the close before it is Tuesday's
  });
  it('BATTLE-END (reviewDueAt null): the end is the close of the session the LAST carrying battle ended in (the earlier of completedAt and expiresAt)', async () => {
    const v = versionDoc({ horizonEnum: 'unspecified', reviewDueAt: null, stateReason: 'battle_ended' });
    vi.setSystemTime(new Date(Date.parse('2026-10-14T20:00:00.000Z') + R.REVIEW_SETTLE_MS + 60_000));
    const r = await get(seed({ version: v }));
    expect(r.statusCode).toBe(200);
    expect(r.body.window).toMatchObject({ kind: 'battle_end', end: { etDate: '2026-10-14', closeAt: '2026-10-14T20:00:00.000Z' } });
    // A battle completed long after its expiry (the deploy path's late GC) ended at its expiry.
    const lateGc = R.battleEndMsOf({ status: 'completed', expiresAt: '2026-10-15T00:00:00.000Z', completedAt: '2026-10-19T14:00:00.000Z' }, AFTER_SETTLE);
    expect(new Date(lateGc).toISOString()).toBe('2026-10-15T00:00:00.000Z');
  });
  it('battle-end with the last battle still running → 409 (window open); past its expiry while still marked active → over', () => {
    const v = versionDoc({ reviewDueAt: null });
    expect(R.reviewWindowOf({ version: v, lastBattle: { status: 'active', expiresAt: '2026-10-30T00:00:00.000Z' }, nowMs: AFTER_SETTLE })).toEqual({ closed: false, reason: 'battle_running' });
    expect(R.reviewWindowOf({ version: v, lastBattle: null, nowMs: AFTER_SETTLE })).toEqual({ closed: false, reason: 'battle_unknown' });
    const expired = R.reviewWindowOf({ version: v, lastBattle: { status: 'active', expiresAt: '2026-10-14T00:00:00.000Z' }, nowMs: AFTER_SETTLE });
    expect(expired.window.end.etDate).toBe('2026-10-13');
  });
  it('a battle that ended before the idea\'s first session → an EMPTY window: every name unavailable, ZERO market calls', async () => {
    const v = versionDoc({ firstDeployedAt: '2026-10-13T22:00:00.000Z', reviewDueAt: null, horizonEnum: 'unspecified' });
    const battles = { 'b-1': battleDoc('b-1'), 'b-2': battleDoc('b-2', { completedAt: '2026-10-13T23:00:00.000Z', expiresAt: '2026-10-14T00:00:00.000Z' }) };
    const r = await get(seed({ version: v, battles }));
    expect(r.body.window.empty).toBe(true);
    expect(r.body.evidence.names.every((n) => n.status === 'unavailable' && n.reason === 'empty_window')).toBe(true);
    expect(r.body.evidence.market).toEqual({ symbol: 'SPY', status: 'unavailable', reason: 'empty_window' });
    expect(state.calls).toEqual([]);
  });
});

describe('the evidence', () => {
  it('per name of the FIRST carrying battle\'s frozen snapshot (never the live list): start close, end close, change %; the equal-weight list, SPY, the difference', async () => {
    const r = await get(seed());
    expect(r.statusCode).toBe(200);
    const e = r.body.evidence;
    expect(e).toMatchObject({ source: 'eodhd_daily', computedAt: new Date(AFTER_SETTLE).toISOString() });
    expect(e.names).toEqual([
      { symbol: 'NVDA', status: 'ok', startClose: 100, endClose: 110, changePct: 10 },
      { symbol: 'AMD', status: 'ok', startClose: 50, endClose: 45, changePct: -10 },
      { symbol: 'PLTR', status: 'ok', startClose: 20, endClose: 21, changePct: 5 },
    ]);
    expect(e.list).toEqual({ status: 'ok', changePct: 1.67, counted: 3, total: 3 });
    expect(e.market).toEqual({ symbol: 'SPY', status: 'ok', startClose: 500, endClose: 505, changePct: 1 });
    expect(r.body.difference).toBe(0.67);
    expect(r.body.listName).toBe('AI capex'); // the frozen name, never 'Renamed live list'
    expect(state.calls.map((c) => c.symbol)).toEqual(['NVDA', 'AMD', 'PLTR', 'SPY']);
    expect(state.calls.every((c) => c.options.fields.length === 1 && c.options.fields[0] === 'daily' && c.options.forceRefresh === true)).toBe(true);
    expect(state.calls.map((c) => c.symbol)).not.toContain('TSLA');
  });
  it('stored ONCE on the version (outside content and lifecycle) and served from there: a second request makes ZERO market calls', async () => {
    const db = seed();
    const first = await get(db);
    const before = stored(db, vPath(1));
    expect(before.reviewEvidence).toEqual(first.body.evidence);
    expect(before.reviewEvidenceClaim).toEqual({ claimedAt: new Date(AFTER_SETTLE).toISOString(), calls: 4 });
    expect(before.contentHash).toBe('c'.repeat(64));
    state.calls = [];
    vi.setSystemTime(new Date(AFTER_SETTLE + 86_400_000));
    const second = await get(db);
    expect(state.calls).toEqual([]);
    expect(second.body.evidence).toEqual(first.body.evidence);
  });
  it('names with no data are UNAVAILABLE with a reason — never null: no rows, a missing start close, a missing end close, a failed fetch', async () => {
    state.daily.NVDA = [];
    state.daily.AMD = [bar('2026-10-15', 45)];
    state.daily.PLTR = [bar('2026-10-12', 20)];
    const battles = { 'b-1': battleDoc('b-1', { agentContext: { ...battleDoc('b-1').agentContext, equippedWatchlist: { watchlistId: WL, name: 'AI capex', tickers: ['NVDA', 'AMD', 'PLTR', 'SMCI'] } } }), 'b-2': battleDoc('b-2') };
    state.failing.add('SMCI');
    const r = await get(seed({ battles }));
    expect(r.body.evidence.names).toEqual([
      { symbol: 'NVDA', status: 'unavailable', reason: 'no_data' },
      { symbol: 'AMD', status: 'unavailable', reason: 'no_start_close' },
      { symbol: 'PLTR', status: 'unavailable', reason: 'no_end_close' },
      { symbol: 'SMCI', status: 'unavailable', reason: 'fetch_failed' },
    ]);
    expect(r.body.evidence.list).toEqual({ status: 'unavailable', reason: 'no_name_priced', counted: 0, total: 4 });
    expect(r.body.difference).toBeNull();
    expect(JSON.stringify(r.body.evidence)).not.toContain('null');
  });
  it('a window starting before the daily feed reaches (90 calendar days back, one day of margin) is UNAVAILABLE outright: ZERO calls, every name and SPY outside_daily_window, stored final', async () => {
    // Opened 95 days after the window's start: no daily close that old can come back.
    vi.setSystemTime(new Date(Date.parse('2026-10-12T20:00:00.000Z') + 95 * 86_400_000));
    const db = seed();
    const r = await get(db);
    expect(state.calls).toEqual([]);
    expect(r.body.evidence.names.every((n) => n.status === 'unavailable' && n.reason === 'outside_daily_window')).toBe(true);
    expect(r.body.evidence.market).toEqual({ symbol: 'SPY', status: 'unavailable', reason: 'outside_daily_window' });
    expect(stored(db, vPath(1)).reviewEvidenceClaim.calls).toBe(0);
    // Inside the reach (89 days back), the names are priced.
    expect(R.dailyWindowFloorOf(Date.parse('2026-10-12T20:00:00.000Z') + 89 * 86_400_000)).toBe('2026-10-12');
    expect(R.plannedCallsOf({ window: { empty: false, start: { etDate: '2026-10-12' } }, names: ['A', 'B'], nowMs: Date.parse('2026-10-12T20:00:00.000Z') + 89 * 86_400_000 })).toBe(3);
  });
  it('the budget: at most 11 calls per version — a twelfth name and beyond is unavailable (budget) with no call', async () => {
    const tickers = Array.from({ length: 13 }, (_, i) => `T${String(i).padStart(2, '0')}`);
    for (const t of tickers) state.daily[t] = series(10, 11);
    const battles = { 'b-1': battleDoc('b-1', { agentContext: { ...battleDoc('b-1').agentContext, equippedWatchlist: { watchlistId: WL, name: 'Big', tickers } } }), 'b-2': battleDoc('b-2') };
    const db = seed({ battles });
    const r = await get(db);
    expect(state.calls).toHaveLength(R.REVIEW_CALL_BUDGET);
    expect(state.calls.at(-1).symbol).toBe('SPY');
    expect(r.body.evidence.names.slice(10)).toEqual(['T10', 'T11', 'T12'].map((symbol) => ({ symbol, status: 'unavailable', reason: 'budget' })));
    expect(r.body.evidence.list).toMatchObject({ status: 'ok', counted: 10, total: 13 });
    expect(stored(db, vPath(1)).reviewEvidenceClaim.calls).toBe(11);
  });
  it('the honest line, verbatim, with the agent name the FIRST carrying battle froze', async () => {
    const r = await get(seed());
    expect(r.body.agentName).toBe('Shadow');
    expect(r.body.honestLine).toBe("Shadow doesn't act on your ideas yet. This shows how the names did over the idea's time-frame — not what the agent did with it.");
    expect(r.body.honestLine).toBe(REVIEW_HONEST_LINE.replace('[AGENT]', 'Shadow'));
  });
  it('the carrying battles: ids, dates, voided marks, in deploy order; a battle that is not the owner\'s, or did not carry THIS version, is never used', async () => {
    const r = await get(seed());
    expect(r.body.battles).toEqual([
      { battleId: 'b-1', createdAt: FIRST, endedAt: '2026-10-14T00:00:00.000Z', voided: false, known: true },
      { battleId: 'b-2', createdAt: '2026-10-14T15:38:00.000Z', endedAt: '2026-10-14T20:55:26.000Z', voided: true, known: true },
    ]);
    // b-1 belongs to someone else, b-2 carried another version: neither is used — no frozen names at all.
    const battles = { 'b-1': battleDoc('b-1', { ownerId: OTHER }), 'b-2': battleDoc('b-2', { agentContext: { ...battleDoc('b-2').agentContext, equippedHypothesis: { watchlistId: WL, hypothesisVersion: 9 } } }) };
    const r2 = await get(seed({ battles }));
    expect(r2.body.battles.map((b) => b.known)).toEqual([false, false]);
    expect(r2.body.evidence.names).toEqual([]);
    expect(r2.body.evidence.list).toEqual({ status: 'unavailable', reason: 'no_frozen_list', counted: 0, total: 0 });
    expect(r2.body.agentName).toBeNull();
    expect(r2.body.honestLine).toBeNull();
  });
});

describe('computed once — the claim', () => {
  it('within REVIEW_SETTLE_MS of the window\'s last close: no evidence yet (pending awaiting_close), no claim, ZERO calls', async () => {
    vi.setSystemTime(new Date(Date.parse(DUE) + 60_000));
    const db = seed();
    const r = await get(db);
    expect(r.statusCode).toBe(200);
    expect([r.body.evidence, r.body.pending]).toEqual([null, 'awaiting_close']);
    expect(state.calls).toEqual([]);
    expect('reviewEvidenceClaim' in stored(db, vPath(1))).toBe(false);
  });
  it('a LIVE claim (another request computing) → pending computing, ZERO calls, nothing written', async () => {
    const db = seed({ version: versionDoc({ reviewEvidenceClaim: { claimedAt: new Date(AFTER_SETTLE - 10_000).toISOString(), calls: 4 } }) });
    const r = await get(db);
    expect([r.body.evidence, r.body.pending]).toEqual([null, 'computing']);
    expect(state.calls).toEqual([]);
    expect(db.__access.writes).toEqual([]);
  });
  it('a DEAD claim (older than its lease, no evidence) → finalized as interrupted with NO call — the lifetime budget holds', async () => {
    const db = seed({ version: versionDoc({ reviewEvidenceClaim: { claimedAt: new Date(AFTER_SETTLE - R.REVIEW_CLAIM_LEASE_MS - 1).toISOString(), calls: 4 } }) });
    const r = await get(db);
    expect(state.calls).toEqual([]);
    expect(r.body.evidence.names.every((n) => n.status === 'unavailable' && n.reason === 'interrupted')).toBe(true);
    expect(stored(db, vPath(1)).reviewEvidence).toEqual(r.body.evidence);
  });
  it('two requests at once: one computes, the other waits — the market is called once per symbol', async () => {
    const db = seed();
    state.db = db;
    const a = res(); const b = res();
    await Promise.all([
      route({ method: 'GET', headers: {}, query: { id: WL, n: '1' }, body: {} }, a),
      route({ method: 'GET', headers: {}, query: { id: WL, n: '1' }, body: {} }, b),
    ]);
    expect(state.calls.length).toBeLessThanOrEqual(4);
    expect([a.body.evidence ? 'evidence' : a.body.pending, b.body.evidence ? 'evidence' : b.body.pending].sort()).toEqual(['computing', 'evidence']);
  });
});
