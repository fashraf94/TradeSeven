// api/cron/agent-evaluate.measuredFollowup.test.js
//
// BaggerBomb measured thresholds — the broad-release follow-up (Flash's
// rulings, Oct 25, 2026; report
// docs/audits/BAGGERBOMB_MEASURED_FOLLOWUP_BUILD_REPORT_20261026.md).
//
//   F1  `?mode=settle` — the weekday-evening run (vercel.json `0 2 * * 2-6`)
//       runs the expiry sweep and NEVER evaluates. The schedule is read from
//       vercel.json itself, so a schedule edit turns these rows red.
//   F2  the refresh half: a BaggerBomb (tiered) battle refolds only the
//       equipped tickers in the ranked universe; tournament and League
//       refreshes are byte-identical to before.
//   F3  a tiered battle is not evaluated before the ET date of its first
//       trading day — skipped, never an error, no lock, no write.
//
// Crons do not run on Vercel preview (BUILD_RULES §6): these unit rows on the
// mode branch, the schedule and the gate are the proof until the first
// production run. The seam is the REAL handler and the REAL processAgentBattle;
// market data, the model, the ledger, the sweeps and firebase init are doubled
// (the agent-evaluate.archetypeMenu / stockThresholds.expiry precedent).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  FROZEN_NOW, makeTickBattle, makePriceTable, makeRankingsDoc, makeTechDocs,
  makeIntradayCandles, makeHoldResult, makeToolUseResponse, makeTickDb,
} from '../_utils/__fixtures__/tickStampsHarness.js';
import { makeCandidateUniverse } from '../_utils/__fixtures__/archetypeCandidateMenu.js';
import { tieredFullDayTarget } from '../../src/utils/stockAdmissionWindow.js';
import { etWallClockToMs } from '../../src/utils/marketCalendar.js';

const mocks = vi.hoisted(() => ({
  prices: vi.fn(), intraday: vi.fn(), create: vi.fn(), tournament: null,
  repairSweep: vi.fn(), openSweep: vi.fn(), marketOpen: vi.fn(),
}));
const world = vi.hoisted(() => ({ db: null, listing: () => [] }));
const flags = vi.hoisted(() => ({ menu: true }));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get ARCHETYPE_REFRESH_MENU_ENABLED() { return flags.menu; },
}));
vi.mock('@anthropic-ai/sdk', () => ({ default: class {
  constructor() { this.messages = { create: (...args) => mocks.create(...args) }; }
} }));
vi.mock('../_utils/marketDataCache.js', () => ({
  getStockAnalysisData: mocks.prices, fetchIntradayBatch: mocks.intraday,
  fetchIntradayCandles: vi.fn(async () => []),
  filterToLatestSession: candles => ({ candles: candles || [], sessionDate: '2026-09-09' }),
}));
vi.mock('../_utils/marketSchedule.js', async (importOriginal) => ({ ...(await importOriginal()), isMarketOpen: () => mocks.marketOpen() }));
vi.mock('../_utils/agentBattleService.js', async (importOriginal) => ({ ...(await importOriginal()), findActiveAgentBattles: vi.fn(async () => world.listing()) }));
vi.mock('../_utils/canonicalOpenSweep.js', () => ({ runCanonicalOpenSweep: (...a) => mocks.openSweep(...a) }));
vi.mock('../_utils/masterySettlement.js', async (importOriginal) => ({ ...(await importOriginal()), runRepairSweep: (...a) => mocks.repairSweep(...a) }));
vi.mock('../_utils/tournamentAgentLedger.js', async original => ({
  ...(await original()), resolveTournamentContext: async () => mocks.tournament,
}));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => world.db }));
vi.mock('../_utils/battlePatternLogger.js', () => ({ logBattlePattern: vi.fn(async () => {}) }));
vi.mock('../_utils/agentTriggerGate.js', async original => ({ ...(await original()), fetchRecentNews: async () => [] }));
vi.mock('../_utils/voiceLayerAnticipation.js', async original => ({ ...(await original()), generateAnticipation: async () => null }));
vi.mock('../_utils/voiceLayerTradeNarration.js', async original => ({ ...(await original()), generateTradeNarration: async () => null }));
vi.mock('../_utils/shadowLogger.js', async original => ({
  ...(await original()), logEvaluation: async () => false, logVisionTransition: async () => false, logAnticipation: async () => false,
}));

const cron = await import('./agent-evaluate.js');
const { processAgentBattle, beforeFirstTradingDay } = cron;

const VERCEL = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
const cronEntry = (path) => {
  const hits = VERCEL.crons.filter(c => c.path === path);
  expect(hits, path).toHaveLength(1);
  return hits[0].schedule;
};
const ET = (date, h, m = 0) => etWallClockToMs(date, h, m);
const etDate = (ms) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
const wall = (ms, timeZone) => new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(ms));

/** Expand one cron field (`*`, `a-b`, `a,b`, `*\/n`) into its values. */
function expand(field, lo, hi) {
  const out = new Set();
  for (const part of field.split(',')) {
    const [range, stepText] = part.split('/');
    const step = stepText ? Number(stepText) : 1;
    const [a, b] = range === '*' ? [lo, hi] : range.includes('-') ? range.split('-').map(Number) : [Number(range), Number(range)];
    for (let v = a; v <= b; v += step) out.add(v);
  }
  return out;
}
/** The first instant at or after `fromMs` that a 5-field UTC schedule fires (minute resolution). */
function nextFire(schedule, fromMs) {
  const [mi, hr, dom, mon, dow] = schedule.split(/\s+/);
  expect([dom, mon]).toEqual(['*', '*']);
  const M = expand(mi, 0, 59), H = expand(hr, 0, 23), D = expand(dow, 0, 6);
  for (let t = Math.ceil(fromMs / 60000) * 60000; t < fromMs + 8 * 86400000; t += 60000) {
    const d = new Date(t);
    if (M.has(d.getUTCMinutes()) && H.has(d.getUTCHours()) && D.has(d.getUTCDay())) return t;
  }
  throw new Error(`no fire for ${schedule}`);
}

// ── A small multi-document store for the handler rows ────────────────────────
function makeWorldDb(docsByPath) {
  const docs = new Map(Object.entries(docsByPath).map(([p, d]) => [p, structuredClone(d)]));
  const writes = [];
  const setPath = (obj, key, value) => {
    const parts = key.split('.'); let o = obj;
    for (const k of parts.slice(0, -1)) o = (o[k] ||= {});
    o[parts.at(-1)] = value;
  };
  const apply = (path, payload) => { const d = docs.get(path); if (d) for (const [k, v] of Object.entries(payload)) setPath(d, k, v); };
  const ref = (col, id) => ({
    id, path: `${col}/${id}`,
    get: async () => { const d = docs.get(`${col}/${id}`); return { exists: !!d, id, data: () => (d ? structuredClone(d) : undefined) }; },
    update: async (payload) => { writes.push({ path: `${col}/${id}`, payload }); apply(`${col}/${id}`, payload); },
    set: async (payload) => { writes.push({ path: `${col}/${id}`, set: payload }); },
  });
  const queries = [];
  const q = { where: () => q, orderBy: () => q, limit: () => q, get: async () => ({ docs: [], empty: true, size: 0 }) };
  return {
    docs, writes, queries, transactions: 0,
    collection(col) { return { doc: id => ref(col, id), where: (...a) => { queries.push([col, ...a]); return q; }, orderBy: () => q, limit: () => q, get: q.get }; },
    async getAll(...refs) { return Promise.all(refs.map(r => r.get())); },
    async runTransaction(cb) {
      this.transactions++;
      return cb({ get: r => r.get(), update: (r, payload) => { writes.push({ path: r.path, payload }); apply(r.path, payload); }, set: (r, payload) => writes.push({ path: r.path, set: payload }) });
    },
  };
}

/** A legacy tiered battle created at `createdMs` (BR-2's own target for it). */
function tieredBattle(id, createdMs, over = {}) {
  const target = tieredFullDayTarget(createdMs, true);
  expect(target.status).toBe('ok');
  const at = new Date(createdMs).toISOString();
  return {
    id, status: 'active', gameMode: 'baggerbomb_agent', duration: 'fullday',
    createdAt: at, activatedAt: at, completedAt: null, expiresAt: target.expiresAt,
    timing: { tradingDays: [target.targetDateStr], currentTradingDay: 1, timezone: 'America/New_York' },
    scoreState: { currentScore: 4.25, opponentScore: 1.5, activeScore: 4.25, bankedScore: 0, bankedBadgePoints: { total: 0 } },
    statusFeed: [], cronState: { evaluatingAt: null }, trades: [],
    portfolio: { star: [{ symbol: 'NVDA', baseATR: 3 }], core: [], support: [], bench: { stocks: [], crypto: null }, startingPrices: { NVDA: 100 } },
    opponent: { portfolio: { star: [], core: [], support: [], bench: { stocks: [], crypto: null }, startingPrices: {} } },
    ...over,
  };
}

async function runHandler(query) {
  const r = { statusCode: null, body: null, status(c) { r.statusCode = c; return r; }, json(b) { r.body = b; return r; } };
  await cron.default({ headers: { authorization: 'Bearer followup-secret' }, ...(query ? { query } : {}) }, r);
  return r;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(FROZEN_NOW));
  process.env.CRON_SECRET = 'followup-secret';
  mocks.tournament = null;
  flags.menu = true;
  mocks.marketOpen.mockReset().mockReturnValue(true);
  mocks.repairSweep.mockReset().mockResolvedValue({ scanned: 0 });
  mocks.openSweep.mockReset().mockResolvedValue({ skipped: true });
  mocks.create.mockReset().mockResolvedValue(makeToolUseResponse(makeHoldResult()));
  const priceTable = makePriceTable();
  mocks.prices.mockReset().mockImplementation(async symbol => ({
    price: priceTable[symbol] || { current: 100, previousClose: 100, changePercent: 0 }, daily: [],
  }));
  mocks.intraday.mockReset().mockResolvedValue({ NVDA: makeIntradayCandles() });
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

// ═════════════════════════════════════════════════════════════════════════════
// F1 — the evening settlement
// ═════════════════════════════════════════════════════════════════════════════

const SETTLE_PATH = '/api/cron/agent-evaluate?mode=settle';
// One week of weekday evenings on each side of the Nov 1, 2026 DST change.
const EDT_WEEK = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30'];
const EST_WEEK = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'];

describe('F1 — the schedule: after agent-daily-scores, the same ET evening, both DST offsets', () => {
  it('exactly one settle entry, at 0 2 * * 2-6 UTC, beside the unchanged evaluator entry', () => {
    expect(cronEntry(SETTLE_PATH)).toBe('0 2 * * 2-6');
    expect(cronEntry('/api/cron/agent-evaluate')).toBe('*/15 13,14,15,16,17,18,19,20,21 * * 1-5');
    expect(VERCEL.crons).toHaveLength(44);
  });

  it.each([...EDT_WEEK, ...EST_WEEK])('a battle created %s 10:00 ET settles that ET evening, after daily-scores and before the tape close', (day) => {
    const battle = tieredBattle('b', ET(day, 10, 0));
    const expiresMs = Date.parse(battle.expiresAt);
    expect(expiresMs).toBe(ET(day, 20, 0)); // BR-2: the Night Game close
    const settle = nextFire(cronEntry(SETTLE_PATH), expiresMs);
    expect(etDate(settle)).toBe(day);
    const dailyScores = nextFire(cronEntry('/api/cron/agent-daily-scores'), expiresMs);
    const tapeClose = nextFire(cronEntry('/api/cron/film-tape-close'), expiresMs);
    expect(dailyScores).toBeLessThan(settle);
    expect(settle).toBeLessThan(tapeClose);
    expect(settle - dailyScores).toBe(15 * 60000);
  });

  it('the stated wall-clock times: 10:00 PM ET / 9:00 PM CT before Nov 1, 9:00 PM ET / 8:00 PM CT after', () => {
    const fri = (day) => nextFire(cronEntry(SETTLE_PATH), ET(day, 20, 0));
    expect(wall(fri('2026-10-30'), 'America/New_York')).toBe('Fri 10:00 PM');
    expect(wall(fri('2026-10-30'), 'America/Chicago')).toBe('Fri 9:00 PM');
    expect(wall(fri('2026-11-06'), 'America/New_York')).toBe('Fri 9:00 PM');
    expect(wall(fri('2026-11-06'), 'America/Chicago')).toBe('Fri 8:00 PM');
  });

  it('no run on a weekend evening: Saturday and Sunday ET have no settle instant', () => {
    const fires = new Set();
    for (const day of [...EDT_WEEK, ...EST_WEEK]) fires.add(etDate(nextFire(cronEntry(SETTLE_PATH), ET(day, 20, 0))));
    expect([...fires]).toEqual([...EDT_WEEK, ...EST_WEEK]);
    // From Saturday 20:00 ET the next fire is Monday evening.
    expect(etDate(nextFire(cronEntry(SETTLE_PATH), ET('2026-10-31', 20, 0)))).toBe('2026-11-02');
  });
});

describe('F1 — the mode branch runs the expiry sweep and never evaluates', () => {
  // Friday evening on each DST offset: the battle created that morning has
  // expired, a second battle (tomorrow's) is still active. The market gate is
  // doubled OPEN, so only the mode branch can keep the live battle untouched.
  it.each([['EDT', '2026-10-30', '2026-11-02'], ['EST', '2026-11-06', '2026-11-09']])('%s: a Friday-evening battle settles Friday evening; the live battle is never locked', async (_label, friday, monday) => {
    const done = tieredBattle('fri-battle', ET(friday, 10, 0));
    // A live battle that is NOT dormant (its list starts on Friday, F3 would
    // play it) and has not expired: only the mode branch keeps it untouched
    // (review MT1-3).
    const live = tieredBattle('mon-battle', ET(friday, 21, 0), { timing: { tradingDays: [friday] } });
    expect(Date.parse(live.expiresAt)).toBe(ET(monday, 20, 0));
    world.db = makeWorldDb({ 'agentBattles/fri-battle': done, 'agentBattles/mon-battle': live });
    world.listing = () => [structuredClone(done), structuredClone(live)];
    const runAt = nextFire(cronEntry(SETTLE_PATH), Date.parse(done.expiresAt));
    vi.setSystemTime(new Date(runAt));

    const r = await runHandler({ mode: 'settle' });

    expect(r.statusCode).toBe(200);
    expect(r.body).toMatchObject({ mode: 'settle', expired: 1, completionSkipped: 0, masteryDeferredCompletions: 0, errors: 0 });
    const settled = world.db.docs.get('agentBattles/fri-battle');
    expect(settled).toMatchObject({ status: 'completed', pendingReflection: true, reviewPending: true });
    expect(etDate(Date.parse(settled.completedAt))).toBe(friday);
    // Never evaluates: the live battle saw no write at all (no lock), no
    // repair sweep, no canonical sweep, no model call, no run record.
    expect(world.db.writes.filter(w => w.path === 'agentBattles/mon-battle')).toEqual([]);
    expect(world.db.docs.get('agentBattles/mon-battle')).toEqual(live);
    expect(world.db.writes.some(w => w.path.startsWith('agentEvalRuns/'))).toBe(false);
    expect(mocks.repairSweep).not.toHaveBeenCalled();
    expect(world.db.queries).toEqual([]); // no bare-GC repair query (step 2c, review MT1-4)
    expect(mocks.openSweep).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.marketOpen).not.toHaveBeenCalled();
  });

  // Review MT1-2: the settle run responds right after its loop, so the
  // non-blocking pattern log must land before the response is sent.
  it('the pattern log of a settled battle lands before the response', async () => {
    const { logBattlePattern } = await import('../_utils/battlePatternLogger.js');
    const order = [];
    logBattlePattern.mockImplementationOnce(async (_agentId, battleId) => {
      order.push(`pattern:start:${battleId}`);
      await new Promise(resolve => setImmediate(resolve));
      await new Promise(resolve => setImmediate(resolve));
      order.push(`pattern:written:${battleId}`);
    });
    const done = tieredBattle('fri-battle', ET('2026-10-30', 10, 0));
    world.db = makeWorldDb({ 'agentBattles/fri-battle': done });
    world.listing = () => [structuredClone(done)];
    vi.setSystemTime(new Date(nextFire(cronEntry(SETTLE_PATH), Date.parse(done.expiresAt))));
    const r = { statusCode: null, status(c) { r.statusCode = c; return r; }, json() { order.push('response'); return r; } };
    await cron.default({ headers: { authorization: 'Bearer followup-secret' }, query: { mode: 'settle' } }, r);
    expect(order).toEqual(['pattern:start:fri-battle', 'pattern:written:fri-battle', 'response']);
  });

  // Control: the SAME world without the mode reaches the market gate (doubled
  // open), the sweeps and the live battle's lock — so the row above can fail.
  it('control: without ?mode=settle the same run sweeps, passes the open gate and locks the live battle', async () => {
    const done = tieredBattle('fri-battle', ET('2026-10-30', 10, 0));
    const live = tieredBattle('mon-battle', ET('2026-10-30', 21, 0), { timing: { tradingDays: ['2026-10-30'] } });
    world.db = makeWorldDb({ 'agentBattles/fri-battle': done, 'agentBattles/mon-battle': live });
    world.listing = () => [structuredClone(done), structuredClone(live)];
    vi.setSystemTime(new Date(nextFire(cronEntry(SETTLE_PATH), Date.parse(done.expiresAt))));

    const r = await runHandler();

    expect(world.db.docs.get('agentBattles/fri-battle').status).toBe('completed');
    expect(mocks.repairSweep).toHaveBeenCalledTimes(1);
    expect(mocks.marketOpen).toHaveBeenCalled();
    expect(mocks.openSweep).toHaveBeenCalledTimes(1);
    expect(world.db.writes.some(w => w.path === 'agentBattles/mon-battle' && typeof w.payload?.['cronState.evaluatingAt'] === 'string')).toBe(true);
    expect(r.body.mode).toBeUndefined();
  });

  it('a settle run with nothing expired completes nothing and still never evaluates', async () => {
    // Live and NOT dormant (its list starts on Friday), so only the mode
    // branch keeps it untouched (review MTV-3).
    const live = tieredBattle('mon-battle', ET('2026-10-30', 21, 0), { timing: { tradingDays: ['2026-10-30'] } });
    world.db = makeWorldDb({ 'agentBattles/mon-battle': live });
    world.listing = () => [structuredClone(live)];
    vi.setSystemTime(new Date(Date.UTC(2026, 9, 31, 2, 0)));
    const r = await runHandler({ mode: 'settle' });
    expect(r.body).toMatchObject({ mode: 'settle', expired: 0, errors: 0 });
    expect(world.db.writes).toEqual([]);
    expect(world.db.transactions).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// F3 — a late-day battle does not play its creation day
// ═════════════════════════════════════════════════════════════════════════════

const universe = makeCandidateUniverse();
const rankings = { ...makeRankingsDoc(), stocks: [...makeRankingsDoc().stocks, ...universe] };

async function tick(battle) {
  const db = makeTickDb({ battle, rankingsDoc: rankings, techDocs: makeTechDocs() });
  const tx = vi.spyOn(db, 'runTransaction');
  const summary = { evaluated: 0, held: 0, triggered: 0, skipped: 0, swapped: 0, errors: 0 };
  await processAgentBattle(db, battle, summary, Date.now(), new Map(), { everEnabled: false });
  return { db, summary, transactions: tx.mock.calls.length };
}
const played = ({ db }) => db.__updates.some(u => typeof u['cronState.evaluatingAt'] === 'string') && db.__updates.some(u => 'scoreState.currentScore' in u);
const SEP9 = '2026-09-09', SEP10 = '2026-09-10';

describe('F3 — the gate (pure)', () => {
  it('holds a tiered battle back only before its first trading day', () => {
    const b = { gameMode: 'baggerbomb_agent', timing: { tradingDays: [SEP10] } };
    expect(beforeFirstTradingDay(b, SEP9)).toBe(true);
    expect(beforeFirstTradingDay(b, SEP10)).toBe(false);
    expect(beforeFirstTradingDay(b, '2026-09-11')).toBe(false);
    // Legacy docs without a gameMode are tiered.
    expect(beforeFirstTradingDay({ timing: { tradingDays: [SEP10] } }, SEP9)).toBe(true);
    // Measured and legacy alike: the stamp plays no part.
    expect(beforeFirstTradingDay({ ...b, scoring: { stockThresholdModel: { version: 'v2' } } }, SEP9)).toBe(true);
  });
  it('never holds back a tournament or other mode, nor a battle without a usable trading-day list', () => {
    for (const gameMode of ['baggerbomb_tournament', 'league']) expect(beforeFirstTradingDay({ gameMode, timing: { tradingDays: [SEP10] } }, SEP9)).toBe(false);
    for (const tradingDays of [[], undefined, [null], ['Sep 10'], [20260910]]) expect(beforeFirstTradingDay({ gameMode: 'baggerbomb_agent', timing: { tradingDays } }, SEP9)).toBe(false);
    expect(beforeFirstTradingDay({ gameMode: 'baggerbomb_agent' }, SEP9)).toBe(false);
  });
  it('defaults to the ET date of the clock (Intl America/New_York), not the UTC date', () => {
    const b = { gameMode: 'baggerbomb_agent', timing: { tradingDays: [SEP10] } };
    vi.setSystemTime(new Date('2026-09-10T03:30:00.000Z')); // Sep 9, 11:30 PM ET (Sep 10 in UTC)
    expect(beforeFirstTradingDay(b)).toBe(true);
    vi.setSystemTime(new Date('2026-09-10T04:00:00.000Z')); // Sep 10, 00:00 ET
    expect(beforeFirstTradingDay(b)).toBe(false);
  });
});

describe('F3 — through processAgentBattle', () => {
  const createdAt = (ms) => tieredFullDayTarget(ms, true);
  const shaped = (createdMs, over = {}) => {
    const target = createdAt(createdMs);
    const at = new Date(createdMs).toISOString();
    return makeTickBattle({ createdAt: at, activatedAt: at, expiresAt: target.expiresAt, timing: { ...makeTickBattle().timing, tradingDays: [target.targetDateStr] }, ...over });
  };

  it('a battle created at 15:20 ET is not evaluated at 15:30 or 15:45 — skipped, no lock, no capture, no write — and plays the next session', async () => {
    const battle = shaped(ET(SEP9, 15, 20));
    expect(battle.timing.tradingDays).toEqual([SEP10]);
    for (const [h, m] of [[15, 30], [15, 45]]) {
      vi.setSystemTime(new Date(ET(SEP9, h, m)));
      const r = await tick(structuredClone(battle));
      expect(r.transactions, `${h}:${m}`).toBe(0);
      expect(r.db.__updates, `${h}:${m}`).toEqual([]);
      expect(r.summary).toMatchObject({ skipped: 1, dormant: 1, errors: 0, evaluated: 0 });
      expect(mocks.prices).not.toHaveBeenCalled();
      expect(mocks.create).not.toHaveBeenCalled();
    }
    // The next session's first check plays it.
    vi.setSystemTime(new Date(ET(SEP10, 10, 0)));
    const next = await tick({ ...structuredClone(battle), cronState: { ...battle.cronState, lastGameplanDate: '9/10/2026' } });
    expect(played(next), JSON.stringify(next.summary)).toBe(true);
    expect(next.summary.dormant).toBeUndefined();
  });

  it('a battle created at 10:00 ET plays the same day', async () => {
    const battle = shaped(ET(SEP9, 10, 0));
    expect(battle.timing.tradingDays).toEqual([SEP9]);
    const r = await tick(battle); // FROZEN_NOW: Sep 9, 11:00 ET
    expect(played(r), JSON.stringify(r.summary)).toBe(true);
    expect(r.summary.dormant).toBeUndefined();
  });

  it('an overnight-created battle plays its session', async () => {
    const battle = shaped(ET('2026-09-08', 23, 30)); // Tue 11:30 PM ET
    expect(battle.timing.tradingDays).toEqual([SEP9]);
    expect(beforeFirstTradingDay(battle, '2026-09-08')).toBe(true);
    const r = await tick(battle);
    expect(played(r), JSON.stringify(r.summary)).toBe(true);
  });

  it('a measured battle is held back the same way, before any corrected-input read', async () => {
    const battle = { id: 'measured-1', gameMode: 'baggerbomb_agent', duration: 'fullday', scoring: { stockThresholdModel: { model: 'stock_measured_v2' } }, timing: { tradingDays: [SEP10] } };
    const db = { runTransaction: vi.fn(async () => { throw new Error('no transaction may run'); }), collection: vi.fn(() => { throw new Error('no read may run'); }) };
    const summary = { skipped: 0, errors: 0 };
    await processAgentBattle(db, battle, summary);
    expect(summary).toEqual({ skipped: 1, dormant: 1, errors: 0 });
    expect(db.runTransaction).not.toHaveBeenCalled();
    expect(db.collection).not.toHaveBeenCalled();
  });

  it('tournaments are unchanged: a flat6 battle whose list starts tomorrow is still evaluated', async () => {
    const battle = makeTickBattle({ gameMode: 'baggerbomb_tournament', timing: { ...makeTickBattle().timing, tradingDays: [SEP10] } });
    const r = await tick(battle);
    expect(r.transactions).toBeGreaterThan(0);
    expect(r.db.__updates.some(u => typeof u['cronState.evaluatingAt'] === 'string')).toBe(true);
    expect(r.summary.dormant).toBeUndefined();
  });

  it('the expiry sweep is unaffected: one run completes an expired battle and skips a dormant one, never an error', async () => {
    const done = tieredBattle('done', ET(SEP9, 10, 0), { expiresAt: '2026-09-09T19:00:00.000Z' });
    const dormant = tieredBattle('dormant', ET(SEP9, 15, 20));
    expect(dormant.timing.tradingDays).toEqual([SEP10]);
    world.db = makeWorldDb({ 'agentBattles/done': done, 'agentBattles/dormant': dormant });
    world.listing = () => [structuredClone(done), structuredClone(dormant)];
    vi.setSystemTime(new Date(ET(SEP9, 15, 30)));
    const r = await runHandler();
    expect(r.statusCode).toBe(200);
    expect(r.body).toMatchObject({ expired: 1, skipped: 1, dormant: 1, errors: 0, lockSkipped: 0, deferred: 0 });
    expect(world.db.docs.get('agentBattles/done').status).toBe('completed');
    expect(world.db.writes.filter(w => w.path === 'agentBattles/dormant')).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// F2 — the refresh half: off-list equipped tickers never re-enter the hotBench
// ═════════════════════════════════════════════════════════════════════════════

async function refreshTick(battle) {
  const db = makeTickDb({ battle, rankingsDoc: rankings, techDocs: makeTechDocs() });
  const summary = { evaluated: 0, held: 0, triggered: 0, skipped: 0, swapped: 0 };
  await processAgentBattle(db, battle, summary, Date.now(), new Map(), { everEnabled: false });
  const update = db.__updates.find(u => u.watchlist);
  expect(update, JSON.stringify(summary)).toBeTruthy();
  return { db, update };
}
function equippedBattle(tickers, over = {}) {
  const battle = makeTickBattle(over);
  battle.watchlist = { active: [], hotBench: ['S001'], monitoring: ['S002'] };
  battle.agentContext.equippedWatchlist = { watchlistId: 'wl-1', name: 'Banks', tickers };
  return battle;
}
const OLD_TOURNAMENT_HOTBENCH = [
  'S018', 'S027', 'S036', 'S045', 'S054', 'S063', 'S072', 'S081', 'S090',
  'S002', 'S011', 'S020', 'S029', 'S038', 'S047', 'S095',
];

describe('F2 — the refresh (agent-evaluate.js) folds only ranked equipped tickers for a tiered battle', () => {
  it.each([[true, 'archetype menu'], [false, 'legacy fit union']])('menu flag %s (%s): KRE never enters the hotBench, the ranked equipped stock still does, the snapshot keeps both', async (menu) => {
    flags.menu = menu;
    expect(rankings.stocks.some(s => s.symbol === 'KRE')).toBe(false);
    const withEtf = await refreshTick(equippedBattle(['KRE', 'S095']));
    const without = await refreshTick(equippedBattle(['S095']));
    expect(withEtf.update.watchlist.hotBench).not.toContain('KRE');
    expect(withEtf.update.watchlist.hotBench).toContain('S095');
    expect(withEtf.update.watchlist).toEqual({ ...without.update.watchlist, lastRefreshed: withEtf.update.watchlist.lastRefreshed });
    expect(withEtf.db.__store.battle.agentContext.equippedWatchlist.tickers).toEqual(['KRE', 'S095']);
  });

  it('a legacy tiered document without a gameMode follows the same rule', async () => {
    flags.menu = false;
    const battle = equippedBattle(['KRE', 'S095']);
    delete battle.gameMode;
    const { update } = await refreshTick(battle);
    expect(update.watchlist.hotBench).not.toContain('KRE');
    expect(update.watchlist.hotBench).toContain('S095');
  });

  // Review MT2-3: the gameMode half of the discriminator on its own — a flat6
  // battle whose tournament context does not resolve still refolds its whole
  // snapshot.
  it('a flat6 battle with no resolved tournament context keeps the off-list ticker (gameMode half)', async () => {
    flags.menu = false;
    expect(mocks.tournament).toBeNull();
    const { update } = await refreshTick(equippedBattle(['S095', 'KRE'], { gameMode: 'baggerbomb_tournament' }));
    expect(update.watchlist.hotBench).toContain('KRE');
    expect(update.watchlist.hotBench).toContain('S095');
  });

  it.each(['baggerbomb_tournament', 'league'])('%s is byte-identical to before: the off-list ticker is still unioned in', async (gameMode) => {
    mocks.tournament = { heldByOthers: new Set(['S009']), groupId: 'group', agentId: 'agent-1' };
    // The archetypeMenu suite's characterized old-path list, plus KRE appended
    // by the unchanged legacy union (17 ≤ the soft cap of 20).
    const { update } = await refreshTick(equippedBattle(['S009', 'NVDA', 'AMD', 'S095', 'KRE'], { gameMode }));
    expect(update.watchlist.hotBench).toEqual([...OLD_TOURNAMENT_HOTBENCH, 'KRE']);
  });
});
