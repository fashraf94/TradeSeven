// api/_utils/setupEvidenceSweep/sweep.test.js
//
// The chart's evidence, PR B — THE DAILY SWEEP (spec docs/specs/CHART_EVIDENCE_SPEC_V1.md SW-1 – SW-9),
// with the REAL shared store (getOrAcquireSnapshot, readSnapshot, its claims, its confirmation rule)
// running over an in-memory db whose transactions run one at a time (__fixtures__/sweepDb.js). The
// provider is injected and counted; the clock is virtual. Rows: the flag off, a full run on fixtures
// (finals cost nothing, four at a time, the deadline, a second and a third run), the dispositions
// (retryable, confirm, pending, a programming error), the cap, the unpublished brake, a weekend and a
// holiday, counts only, and the one provider path. The emulator suite proves the cap on real
// transactions (test/rules/setupEvidenceSweep.rules.mjs).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { makeSweepDb } from './__fixtures__/sweepDb.js';
import { noAdjustmentRows, pullbackRows, recordFor, splitRows } from '../setupRead/__fixtures__/readRecords.js';
import { tradingDates } from '../setupEvaluator/__fixtures__/syntheticBars.js';
import { describeRuleSet } from '../setupEvaluator/thresholds.js';
import { snapshotIdOf } from '../setupEvidence/key.js';
import { ALL_TICKERS } from '../rankingConfig.js';

const flag = vi.hoisted(() => ({ on: true }));
vi.mock('../../../src/config/setupEvidenceSweepFlags.js', () => ({ get SETUP_EVIDENCE_SWEEP_ENABLED() { return flag.on; } }));

const { runSetupEvidenceSweep, healthLineOf } = await import('./sweep.js');
const C = await import('./constants.js');

const MIN = 60_000;
const MON = '2026-11-16';
const FRI = '2026-11-13';
const T_RUN1 = Date.parse('2026-11-16T22:30:00.000Z'); // Mon 5:30 PM ET
const T_RUN2 = Date.parse('2026-11-16T23:30:00.000Z'); // Mon 6:30 PM ET
const T_MORNING = Date.parse('2026-11-17T12:30:00.000Z'); // Tue 7:30 AM ET: Monday's session still
const RS = describeRuleSet();
const NAMES = [...ALL_TICKERS].sort().slice(0, 10);
const idOf = (session, symbol) => snapshotIdOf({ session, symbol, ruleSet: RS });
const finalPath = (session, symbol) => `setupEvidence/${idOf(session, symbol)}`;
const statePath = (session) => `${C.STATE_COLLECTION}/${session}`;
const SRC = readFileSync(fileURLToPath(new URL('./sweep.js', import.meta.url)), 'utf8');

/** Rows missing the session's own bar: the provider has not published it yet. */
const unpublishedRows = (session) => pullbackRows(tradingDates(2, session)[1]);

/**
 * A virtual clock and a counted provider. Each request takes `stepMs` of virtual time; `rowsFor(symbol)`
 * says what the provider answers. Tracks the most requests in flight at once.
 */
function harness({ at, stepMs = 1_000, rowsFor = (s, session) => pullbackRows(session) } = {}) {
  const h = { nowMs: at, calls: [], inFlight: 0, maxInFlight: 0, lines: [] };
  h.now = () => new Date(h.nowMs);
  h.fetchPayload = async (symbol, opts) => {
    h.calls.push({ symbol, opts });
    h.inFlight += 1;
    h.maxInFlight = Math.max(h.maxInFlight, h.inFlight);
    await new Promise((r) => setTimeout(r, 0));
    h.nowMs += stepMs;
    h.inFlight -= 1;
    return structuredClone(rowsFor(symbol, opts.to));
  };
  h.log = (line) => h.lines.push(line);
  h.run = (db, over = {}) => runSetupEvidenceSweep({ db, handlerStartMs: h.nowMs, now: h.now, fetchPayload: h.fetchPayload, symbols: NAMES, log: h.log, ...over });
  return h;
}

beforeEach(() => {
  flag.on = true;
  vi.spyOn(console, 'warn').mockImplementation(() => {}); // the store's own fetch-failed lines
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('a real provider call — the sweep\'s tests never make one'); }));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('the flag off (SW-6)', () => {
  it('{ skipped: true } before any read: no db access, no request, no line', async () => {
    flag.on = false;
    const h = harness({ at: T_RUN1 });
    const db = new Proxy({}, { get: (_t, k) => { throw new Error(`db touched: ${String(k)}`); } });
    await expect(h.run(db)).resolves.toEqual({ skipped: true });
    expect(h.calls).toEqual([]);
    expect(h.lines).toEqual([]);
  });
});

describe('a full run on fixtures (SW-2)', () => {
  it('existing finals cost no request; the absent are acquired, at most four at once, in a fixed order', async () => {
    const db = makeSweepDb();
    for (const symbol of NAMES.slice(0, 3)) {
      const { record } = await recordFor({ session: MON, symbol, fetchedAt: '2026-11-16T22:00:00.000Z', rows: pullbackRows(MON) });
      db.write(finalPath(MON, symbol), record);
    }
    const h = harness({ at: T_RUN1 });
    const r = await h.run(db);
    expect(h.calls.map((c) => c.symbol)).toEqual(NAMES.slice(3)); // sorted, the finals skipped
    expect(h.maxInFlight).toBeLessThanOrEqual(C.SWEEP_CONCURRENCY);
    expect(h.maxInFlight).toBe(4);
    expect(r).toMatchObject({ session: MON, names: 10, final: { measured: 10, refused: 0 }, acquired: 7, storeCalls: 7, providerRequests: 7, providerRequestsTotal: 7, pending: 0, programmingErrors: 0, stateWritten: true });
    for (const symbol of NAMES) expect(db.read(finalPath(MON, symbol))).toBeTruthy();
    const state = db.read(statePath(MON));
    expect(Object.keys(state)).toEqual([...C.STATE_FIELDS]);
    expect(state).toMatchObject({ schemaVersion: 1, session: MON, providerRequests: 7, runs: 1, firstRunAt: '2026-11-16T22:30:00.000Z', lastRunAt: '2026-11-16T22:30:00.000Z' });
    expect(state.completedAt).toEqual(expect.any(String));
    expect(Object.keys(state.latest)).toEqual([...C.LATEST_FIELDS]);
    expect(state.latest).toMatchObject({ names: 10, final: { measured: 10, refused: 0 }, acquired: 7, pending: 0 });
    for (const c of h.calls) expect(c.opts).toEqual({ from: '2026-07-09', to: MON, order: 'd', timeoutMs: C.STORE_ACQUIRE_TIMEOUT_MS });
  });

  it('past the admission deadline nothing more is read: the names not reached are deferred, unread', async () => {
    const db = makeSweepDb();
    const names = [...ALL_TICKERS].sort().slice(0, 40);
    const h = harness({ at: T_RUN1, stepMs: 50_000 }); // each request takes 50 s of virtual time: the window passes mid-run
    const r = await h.run(db, { symbols: names });
    expect(h.nowMs - T_RUN1).toBeGreaterThanOrEqual(C.SWEEP_ADMISSION_WINDOW_MS);
    expect(r.names).toBeLessThan(40);
    expect(r.deferred.deadline).toBe(40 - r.names + (r.names - r.storeCalls));
    expect(db.__log.gets.filter((p) => p.startsWith('setupEvidence/'))).toHaveLength(r.names);
  });

  it('a refused record is final: counted as refused, never retried', async () => {
    const db = makeSweepDb();
    const h = harness({ at: T_RUN1, rowsFor: (s, session) => (s === NAMES[0] ? splitRows(session) : pullbackRows(session)) });
    const r = await h.run(db);
    expect(r.final).toEqual({ measured: 9, refused: 1 });
    expect(db.read(finalPath(MON, NAMES[0])).status).toBe('refused');
    h.calls.length = 0;
    const again = await h.run(db);
    expect(h.calls).toEqual([]);
    expect(again.final).toEqual({ measured: 9, refused: 1 });
  });

  it('228 names: the run stops admitting at the deadline, the second finishes the rest, the third does nothing', async () => {
    const db = makeSweepDb();
    const h = harness({ at: T_RUN1, stepMs: 1_500 }); // 228 × 1.5 s of virtual time is past the 240 s window
    const all = [...ALL_TICKERS];
    const first = await h.run(db, { symbols: all });
    expect(first.deferred.deadline).toBeGreaterThan(0);
    expect(first.providerRequests).toBeLessThan(228);
    expect(first.providerRequests).toBeGreaterThan(100);
    expect(h.nowMs - T_RUN1).toBeLessThan(C.SWEEP_ADMISSION_WINDOW_MS + 4 * 1_500 + 1); // nothing started past the window
    const firstCount = first.providerRequests;
    h.nowMs = T_RUN2;
    const second = await h.run(db, { symbols: all });
    expect(second.final.measured).toBe(228);
    expect(second.providerRequests).toBe(228 - firstCount);
    expect(second.deferred).toEqual({});
    h.nowMs = T_MORNING;
    h.calls.length = 0;
    const third = await h.run(db, { symbols: all });
    expect(h.calls).toEqual([]);
    expect(third).toMatchObject({ session: MON, names: 228, storeCalls: 0, providerRequests: 0, final: { measured: 228, refused: 0 } });
    expect(db.read(statePath(MON))).toMatchObject({ providerRequests: 228, runs: 3 });
    expect(db.paths('setupEvidence/')).toHaveLength(228);
  }, 30_000); // three runs over 228 names: ~2.6 s here, ~5 s on a loaded host (review lens 2)
});

describe('dispositions', () => {
  it('a retryable result (the session\'s bar not yet published) writes nothing final and is retried next run', async () => {
    const db = makeSweepDb();
    let published = false;
    const h = harness({ at: T_RUN1, rowsFor: (s, session) => (s === NAMES[2] && !published ? unpublishedRows(session) : pullbackRows(session)) });
    const first = await h.run(db);
    expect(first.retryable).toEqual({ missing_bar: 1 });
    expect(db.read(finalPath(MON, NAMES[2]))).toBeUndefined();
    published = true;
    h.nowMs = T_RUN2;
    h.calls.length = 0;
    const second = await h.run(db);
    expect(h.calls.map((c) => c.symbol)).toEqual([NAMES[2]]);
    expect(second.final.measured).toBe(10);
    expect(db.read(finalPath(MON, NAMES[2])).status).toBe('ok');
  });

  it('a confirm-class result (no adjusted close) is final only after a fetch that started at least 30 minutes after the first', async () => {
    const db = makeSweepDb();
    const h = harness({ at: T_RUN1, rowsFor: (s, session) => (s === NAMES[0] ? noAdjustmentRows(session) : pullbackRows(session)) });
    expect((await h.run(db)).retryable).toEqual({ adjusted_close_missing: 1 });
    expect(db.read(finalPath(MON, NAMES[0]))).toBeUndefined();
    h.nowMs = T_RUN1 + 15 * MIN; // a fetch 15 minutes on reproduces it, but is too soon
    expect((await h.run(db)).retryable).toEqual({ adjusted_close_missing: 1 });
    expect(db.read(finalPath(MON, NAMES[0]))).toBeUndefined();
    h.nowMs = T_RUN2; // the second post-close run: an hour after the first sample
    const third = await h.run(db);
    expect(third.retryable).toEqual({});
    expect(db.read(finalPath(MON, NAMES[0]))).toMatchObject({ status: 'ok', entry: { evidence: { adjustment: { metadata: 'absent' } } } });
    expect(h.calls.filter((c) => c.symbol === NAMES[0])).toHaveLength(3);
  });

  it('a live lease elsewhere is `pending`: no request, counted, retried next run', async () => {
    const db = makeSweepDb();
    db.write(`setupEvidenceClaims/${idOf(MON, NAMES[1])}`, { lease: { token: 'other', claimedAt: new Date(T_RUN1).toISOString(), host: 'x' }, observation: null, attempts: 1, lastAttemptAt: new Date(T_RUN1).toISOString() });
    const h = harness({ at: T_RUN1 });
    const r = await h.run(db);
    expect(r.pending).toBe(1);
    expect(h.calls.map((c) => c.symbol)).not.toContain(NAMES[1]);
  });

  it('a programming error (a symbol the store\'s key refuses) is counted, logged, recorded and THROWN — never swallowed; admission closes', async () => {
    const db = makeSweepDb();
    const h = harness({ at: T_RUN1 });
    const symbols = [...NAMES, 'A.B']; // '.' sorts before every letter: the first name of the fixed order
    let caught = null;
    try { await h.run(db, { symbols }); } catch (err) { caught = err; }
    expect(caught).toBeInstanceOf(TypeError);
    expect(caught.message).toMatch(/malformed symbol/);
    expect(h.lines).toHaveLength(1);
    const line = JSON.parse(h.lines[0].slice(C.HEALTH_LINE_PREFIX.length + 1));
    expect(line.programmingErrors).toBe(1);
    expect(line.deferred.programming_error).toBeGreaterThan(0);
    expect(db.read(statePath(MON)).latest.programmingErrors).toBe(1);
    expect(h.calls.length).toBeLessThan(10);
  });

  it('a programming error from the store itself (SetupEvidenceProgrammingError: a session that has not closed) is thrown', async () => {
    const db = makeSweepDb();
    const h = harness({ at: T_RUN1 });
    let reads = 0;
    const jump = () => { reads += 1; return new Date(reads > 3 ? Date.parse('2026-11-16T15:00:00.000Z') : h.nowMs); }; // the clock jumps back before Monday's close
    let caught = null;
    try { await h.run(db, { now: jump }); } catch (err) { caught = err; }
    expect(caught?.name).toBe('SetupEvidenceProgrammingError');
    expect(caught.reason).toBe('session_incomplete');
  });
});

describe('the allocation (SW-4): the hard stop, counted inside a transaction', () => {
  it('the cap\'s last place is the last request: the rest of the run is deferred, and the next run makes none', async () => {
    const db = makeSweepDb();
    const h = harness({ at: T_RUN1 });
    const r = await h.run(db, { cap: 5 });
    expect(h.calls).toHaveLength(5);
    expect(r.providerRequests).toBe(5);
    expect(r.providerRequestsTotal).toBe(5);
    expect(r.deferred.cap).toBeGreaterThan(0);
    expect(db.read(statePath(MON)).providerRequests).toBe(5);
    h.nowMs = T_RUN2;
    h.calls.length = 0;
    const claimsBefore = db.paths('setupEvidenceClaims/').map((p) => JSON.stringify(db.read(p)));
    const again = await h.run(db, { cap: 5 });
    expect(h.calls).toEqual([]);
    expect(again.deferred.cap).toBe(5);
    expect(again.storeCalls).toBe(0); // at the cap the run makes no store call at all: no claim, no attempt counted
    expect(db.paths('setupEvidenceClaims/').map((p) => JSON.stringify(db.read(p)))).toEqual(claimsBefore);
  });

  it('the production cap: with 398 counted, exactly two more requests are made — the 400th is the last', async () => {
    expect(C.SWEEP_DAILY_PROVIDER_CAP).toBe(400);
    const db = makeSweepDb();
    db.write(statePath(MON), { schemaVersion: 1, session: MON, providerRequests: 398, runs: 2, firstRunAt: null, lastRunAt: null, completedAt: null, runMs: 0, latest: null, updatedAt: null });
    const h = harness({ at: T_RUN1 });
    const r = await h.run(db);
    expect(h.calls).toHaveLength(2);
    expect(db.read(statePath(MON)).providerRequests).toBe(400);
    expect(r.deferred.cap).toBe(8);
  });

  it('the count survives a failed run, and the next trading day starts at zero', async () => {
    const db = makeSweepDb();
    db.failTransactions(({ writes }) => writes.includes(statePath(MON)) && db.read(statePath(MON))?.providerRequests >= 4); // the end-of-run record fails
    const h = harness({ at: T_RUN1 });
    const r = await h.run(db, { cap: 6 });
    expect(r.stateWritten).toBe(false);
    expect(r.failures).toEqual({ 'record:14': 1, 'reserve:14': expect.any(Number) });
    db.failTransactions(null);
    const counted = db.read(statePath(MON)).providerRequests;
    expect(counted).toBe(h.calls.length); // every request made is counted, though the run's record failed
    expect(db.read(statePath(MON)).runs).toBe(0);
    h.nowMs = T_RUN2;
    h.calls.length = 0;
    await h.run(db, { cap: 6 });
    expect(db.read(statePath(MON)).providerRequests).toBe(Math.min(6, counted + h.calls.length));
    // Tuesday after the close: Tuesday's document, from zero.
    h.nowMs = Date.parse('2026-11-17T22:30:00.000Z');
    h.calls.length = 0;
    const tue = await h.run(db, { cap: 6 });
    expect(tue.session).toBe('2026-11-17');
    expect(h.calls).toHaveLength(6);
    expect(db.read(statePath('2026-11-17')).providerRequests).toBe(6);
  });

  it('an unreadable state document is never read as zero: no read, no request, nothing written over it', async () => {
    const db = makeSweepDb();
    const bad = { schemaVersion: 1, session: MON, providerRequests: '12', runs: 0 };
    db.write(statePath(MON), bad);
    const h = harness({ at: T_RUN1 });
    const r = await h.run(db);
    expect(r).toMatchObject({ state: 'unreadable', names: 0, storeCalls: 0, deferred: { state_unreadable: 1 } });
    expect(h.calls).toEqual([]);
    expect(db.read(statePath(MON))).toEqual(bad);
  });
});

describe('the unpublished-session brake (a reading, spec §5.4)', () => {
  it('eight missing_bar retryables in a row from this run\'s own requests close admission; the rest wait for the next run', async () => {
    const db = makeSweepDb();
    const names = [...ALL_TICKERS].sort().slice(0, 40);
    const h = harness({ at: T_RUN1, rowsFor: (s, session) => unpublishedRows(session) });
    const r = await h.run(db, { symbols: names });
    expect(h.calls.length).toBeGreaterThanOrEqual(C.BRAKE_STREAK_STOP);
    expect(h.calls.length).toBeLessThanOrEqual(C.BRAKE_STREAK_STOP + C.SWEEP_CONCURRENCY - 1);
    expect(r.deferred.unpublished).toBe(40 - h.calls.length);
    expect(r.retryable).toEqual({ missing_bar: h.calls.length });
  });
  it('any other outcome resets the streak', async () => {
    const db = makeSweepDb();
    const names = [...ALL_TICKERS].sort().slice(0, 40);
    const h = harness({ at: T_RUN1, rowsFor: (s, session) => (names.indexOf(s) % 5 === 4 ? pullbackRows(session) : unpublishedRows(session)) });
    const r = await h.run(db, { symbols: names });
    expect(h.calls).toHaveLength(40);
    expect(r.deferred).toEqual({});
  });
});

describe('a weekend and a holiday (SW-3): no read and no provider request', () => {
  const seedOpenWork = (db, session) => {
    // A name of the previous session still waiting: without the non-session rule the run WOULD fetch it.
    db.write(`setupEvidenceClaims/${idOf(session, NAMES[0])}`, { lease: null, observation: null, attempts: 1, lastAttemptAt: '2026-11-13T22:30:00.000Z' });
  };
  it('Saturday', async () => {
    const db = makeSweepDb();
    seedOpenWork(db, FRI);
    const h = harness({ at: Date.parse('2026-11-14T22:30:00.000Z') });
    const r = await h.run(db);
    expect(r).toMatchObject({ session: FRI, names: 0, storeCalls: 0, providerRequests: 0, deferred: { non_session: 1 } });
    expect(h.calls).toEqual([]);
    expect(db.__log.gets).toEqual([]);
    expect(db.__log.transactions).toBe(0);
  });
  it('Thanksgiving (Thu 26 Nov 2026), after the close hour', async () => {
    const db = makeSweepDb();
    seedOpenWork(db, '2026-11-25');
    const h = harness({ at: Date.parse('2026-11-26T22:30:00.000Z') });
    const r = await h.run(db);
    expect(r).toMatchObject({ session: '2026-11-25', providerRequests: 0, deferred: { non_session: 1 } });
    expect(h.calls).toEqual([]);
  });
  it('the next trading morning does catch up the holiday\'s session', async () => {
    const db = makeSweepDb();
    const h = harness({ at: Date.parse('2026-11-27T12:30:00.000Z') }); // Fri 7:30 AM ET, before the early close
    const r = await h.run(db);
    expect(r.session).toBe('2026-11-25');
    expect(h.calls).toHaveLength(10);
  });
});

describe('counts only (SW-8)', () => {
  it('the health line and the state document carry no symbol, no price and no free string', async () => {
    const db = makeSweepDb();
    const h = harness({ at: T_RUN1, rowsFor: (s, session) => (s === NAMES[3] ? unpublishedRows(session) : s === NAMES[4] ? splitRows(session) : pullbackRows(session)) });
    await h.run(db);
    const texts = [...h.lines, JSON.stringify(db.read(statePath(MON)))];
    for (const text of texts) {
      for (const symbol of NAMES) expect(text).not.toMatch(new RegExp(`\\b${symbol}\\b`));
      expect(text).not.toMatch(/200\.37|194\.61|\d+\.\d{2}\b/);
      expect(text).not.toMatch(/setupEvidenceClaims|token|host/);
    }
    expect(h.lines).toHaveLength(1);
    expect(h.lines[0].startsWith(`${C.HEALTH_LINE_PREFIX} {`)).toBe(true);
  });
  it('healthLineOf maps an unknown key or code to `other`, never prints it', () => {
    const line = healthLineOf({ final: {}, retryable: { 'AAPL 200.37': 1 }, deferred: { MSFT: 2 }, failures: { 'read:AAPL at 12.5': 1, 'x:y': 1 }, session: 'AAPL' });
    expect(line).not.toMatch(/AAPL|MSFT|12\.5|200\.37/);
    expect(line).toContain('"other":1');
  });
});

describe('the one provider path (SW-2, SW-4): the store\'s own fetchDailyPayload, through the counter; zero model calls', () => {
  it('with no fetchPayload injected, every request is the store\'s /eod/ read, each one counted first', async () => {
    vi.stubEnv('EODHD_API_KEY', 'test-key-not-real');
    const urls = [];
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      urls.push(String(url));
      const symbol = /\/eod\/([^?]+)\.US\?/.exec(String(url))[1];
      return { ok: true, json: async () => pullbackRows(MON), symbol };
    }));
    const db = makeSweepDb();
    const h = harness({ at: T_RUN1 });
    const r = await runSetupEvidenceSweep({ db, handlerStartMs: T_RUN1, now: h.now, symbols: NAMES.slice(0, 3), log: h.log });
    expect(urls).toHaveLength(3);
    for (const url of urls) expect(url).toMatch(/^https:\/\/eodhd\.com\/api\/eod\/[A-Z-]+\.US\?api_token=test-key-not-real&fmt=json&period=d&order=d&from=2026-07-09&to=2026-11-16$/);
    expect(r.providerRequests).toBe(3);
    expect(db.read(statePath(MON)).providerRequests).toBe(3);
  });
  it('the module imports no model client, and its only provider import is the store\'s fetchDailyPayload', () => {
    const specifiers = [...SRC.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);
    for (const s of specifiers) expect(s).not.toMatch(/anthropic|gemma|gemini|openai|claude|llm|voice|model|eodhdAPI/i);
    // The one marketDataCache import is the store's own pure mapper, used to read the session's row as the store would.
    expect([...SRC.matchAll(/import \{([^}]*)\} from '\.\.\/marketDataCache\.js';/g)].map((m) => m[1].trim())).toEqual(['mapDailyRows']);
    expect(SRC).toMatch(/import \{ fetchDailyPayload \} from '\.\.\/eodhdDailyWindow\.js';/);
    expect(SRC.replace(/\/\/.*$/gm, '')).not.toMatch(/\bfetch\s*\(/);
  });
});

describe('review lens 1 (docs/audits/20261116_BUILD_CHART_EVIDENCE.md §4): the brake and the programming errors', () => {
  /** The session's own bar IS published; one bar inside the window (ten sessions back) is missing: confirm class. */
  const interiorGapRows = (session) => { const rows = pullbackRows(session); rows.splice(10, 1); return rows; };

  it('L1-1: a gap INSIDE the window shared by every name is braked as shared_refusal, never as unpublished; a second run confirms at most a streak of them', async () => {
    const db = makeSweepDb();
    const names = [...ALL_TICKERS].sort().slice(0, 40);
    const h = harness({ at: T_RUN1, rowsFor: (s, session) => interiorGapRows(session) });
    expect(interiorGapRows(MON)[0].date).toBe(MON);
    const first = await h.run(db, { symbols: names });
    const most = C.BRAKE_STREAK_STOP + C.SWEEP_CONCURRENCY - 1;
    expect(h.calls.length).toBeLessThanOrEqual(most);
    expect(first.deferred).toEqual({ shared_refusal: 40 - h.calls.length });
    expect(first.retryable).toEqual({ missing_bar: h.calls.length });
    h.nowMs = T_RUN2;
    const before = h.calls.length;
    const second = await h.run(db, { symbols: names });
    expect(h.calls.length - before).toBeLessThanOrEqual(most);
    expect(second.final.refused).toBeLessThanOrEqual(most); // each confirmation is permanent: the brake bounds them per run
    expect(second.deferred.shared_refusal).toBeGreaterThan(0);
    expect(second.deferred.unpublished).toBeUndefined();
  });

  it('L1-1: one stock\'s own gap among usable names is no streak: it is observed, then confirmed by the second run', async () => {
    const db = makeSweepDb();
    const h = harness({ at: T_RUN1, rowsFor: (s, session) => (s === NAMES[3] ? interiorGapRows(session) : pullbackRows(session)) });
    const first = await h.run(db);
    expect(first).toMatchObject({ final: { measured: 9, refused: 0 }, retryable: { missing_bar: 1 }, deferred: {} });
    h.nowMs = T_RUN2;
    const second = await h.run(db);
    expect(second.final).toEqual({ measured: 9, refused: 1 });
  });

  it('L1-1: a session row the store\'s mapper drops (a null high) is unpublished, not a gap: the brake reads the row as the store does', async () => {
    const db = makeSweepDb();
    const names = [...ALL_TICKERS].sort().slice(0, 40);
    const brokenNewest = (session) => { const rows = pullbackRows(session); rows[0] = { ...rows[0], high: null }; return rows; };
    const h = harness({ at: T_RUN1, rowsFor: (s, session) => brokenNewest(session) });
    const r = await h.run(db, { symbols: names });
    expect(h.calls.length).toBeLessThanOrEqual(C.BRAKE_STREAK_STOP + C.SWEEP_CONCURRENCY - 1);
    expect(r.deferred).toEqual({ unpublished: 40 - h.calls.length });
  });

  it('L1-2 (as ruled after its refuter): a record merely read does not break a streak, so late names between finals still stop a too-early run', async () => {
    const db = makeSweepDb();
    const names = [...ALL_TICKERS].sort().slice(0, 30);
    for (const symbol of names.filter((_, i) => i % 2 === 1)) {
      const { record } = await recordFor({ session: MON, symbol, fetchedAt: '2026-11-16T22:00:00.000Z', rows: pullbackRows(MON) });
      db.write(finalPath(MON, symbol), record);
    }
    const h = harness({ at: T_RUN1, rowsFor: (s, session) => unpublishedRows(session) });
    const r = await h.run(db, { symbols: names });
    expect(h.calls.length).toBeLessThanOrEqual(C.BRAKE_STREAK_STOP + C.SWEEP_CONCURRENCY - 1);
    expect(r.deferred.unpublished).toBe(15 - h.calls.length);
  });

  it('outcomes of different kinds in a row are no streak: alternating unpublished and failing names never stop the run', async () => {
    const db = makeSweepDb();
    const names = [...ALL_TICKERS].sort().slice(0, 32);
    const h = harness({ at: T_RUN1, rowsFor: (s, session) => unpublishedRows(session) });
    const late = h.fetchPayload;
    h.fetchPayload = async (symbol, opts) => { if (names.indexOf(symbol) % 2 === 1) { h.calls.push({ symbol, opts }); await new Promise((r) => setTimeout(r, 0)); throw new Error('EODHD daily request failed'); } return late(symbol, opts); };
    const r = await h.run(db, { symbols: names });
    expect(h.calls).toHaveLength(32);
    expect(r.deferred).toEqual({});
  });

  it('any other outcome of a request breaks a streak: late names alternating with confirm-class ones (no adjusted close) never stop the run', async () => {
    const db = makeSweepDb();
    const names = [...ALL_TICKERS].sort().slice(0, 40);
    const h = harness({ at: T_RUN1, rowsFor: (s, session) => (names.indexOf(s) % 2 === 1 ? noAdjustmentRows(session) : unpublishedRows(session)) });
    const r = await h.run(db, { symbols: names });
    expect(h.calls).toHaveLength(40);
    expect(r.retryable).toEqual({ missing_bar: 20, adjusted_close_missing: 20 });
    expect(r.deferred).toEqual({});
  });

  it('confirmations of a shared gap in a row are braked too: each is a permanent refused record', async () => {
    const db = makeSweepDb();
    const names = [...ALL_TICKERS].sort().slice(0, 40);
    const gapped = names.filter((_, i) => i % 2 === 0);
    // Run 1: the gapped names between usable ones, so no streak forms: each gapped name is observed once.
    const h = harness({ at: T_RUN1, rowsFor: (s, session) => (gapped.includes(s) ? interiorGapRows(session) : pullbackRows(session)) });
    const first = await h.run(db, { symbols: names });
    expect(first.retryable).toEqual({ missing_bar: 20 });
    // Run 2, the gapped names only: twenty confirmations in a row. The brake stops them at a streak.
    h.nowMs = T_RUN2;
    const second = await h.run(db, { symbols: gapped });
    expect(second.final.refused).toBeLessThanOrEqual(C.BRAKE_STREAK_STOP + C.SWEEP_CONCURRENCY - 1);
    expect(second.deferred.shared_refusal).toBe(20 - second.storeCalls);
  });

  it('a truncated answer for every name (a short history, confirm class) is braked as shared_refusal, never confirmed in bulk', async () => {
    const db = makeSweepDb();
    const names = [...ALL_TICKERS].sort().slice(0, 40);
    const h = harness({ at: T_RUN1, rowsFor: (s, session) => pullbackRows(session, 30) }); // 30 bars: under the 55 the rule needs
    const first = await h.run(db, { symbols: names });
    expect(h.calls.length).toBeLessThanOrEqual(C.BRAKE_STREAK_STOP + C.SWEEP_CONCURRENCY - 1);
    expect(first.retryable).toEqual({ insufficient_history: h.calls.length });
    expect(first.deferred).toEqual({ shared_refusal: 40 - h.calls.length });
    h.nowMs = T_RUN2;
    const second = await h.run(db, { symbols: names });
    expect(second.final.refused).toBeLessThanOrEqual(C.BRAKE_STREAK_STOP + C.SWEEP_CONCURRENCY - 1);
  });

  it('a transient counter failure closes admission for the run: no further name takes a claim only to fail the same way', async () => {
    const db = makeSweepDb();
    db.failTransactions(({ writes }) => writes.includes(statePath(MON)) && !db.read(statePath(MON))?.runs);
    const h = harness({ at: T_RUN1 });
    const r = await h.run(db);
    expect(h.calls).toEqual([]);
    expect(r.storeCalls).toBeLessThanOrEqual(C.SWEEP_CONCURRENCY);
    expect(r.deferred.counter_failed).toBe(10 - r.storeCalls);
    expect(r.failures['reserve:14']).toBe(r.storeCalls);
  });

  it('a bug in the plain state read is thrown, never read as an unreadable document', async () => {
    const db = makeSweepDb();
    const real = db.collection;
    db.collection = (col) => (col === C.STATE_COLLECTION ? { doc: () => ({ get: async () => { throw new TypeError('a bug in the read'); } }) } : real(col));
    const h = harness({ at: T_RUN1 });
    let caught = null;
    try { await h.run(db); } catch (err) { caught = err; }
    expect(caught?.message).toBe('a bug in the read');
    expect(h.calls).toEqual([]);
  });
  it('L1-3a: an error with no gRPC code from the store (a plain Error after the request) is a programming error: surfaced and thrown, the run stops', async () => {
    const db = makeSweepDb();
    db.failTransactions(({ writes }) => writes.some((p) => p.startsWith('setupEvidence/')), () => new Error('a bug in the final transaction'));
    const h = harness({ at: T_RUN1 });
    let caught = null;
    try { await h.run(db); } catch (err) { caught = err; }
    expect(caught?.message).toBe('a bug in the final transaction');
    expect(h.calls.length).toBeLessThanOrEqual(C.SWEEP_CONCURRENCY);
    expect(JSON.parse(h.lines[0].slice(C.HEALTH_LINE_PREFIX.length + 1)).programmingErrors).toBeGreaterThan(0);
  });

  it('L1-3a: a transient Firestore error (a numeric gRPC code) is counted and the run goes on', async () => {
    const db = makeSweepDb();
    db.failTransactions(({ writes }) => writes.includes(finalPath(MON, NAMES[0])), () => Object.assign(new Error('unavailable'), { code: 14 }));
    const h = harness({ at: T_RUN1 });
    const r = await h.run(db);
    expect(r.failures).toEqual({ 'acquire:14': 1 });
    expect(r.final.measured).toBe(9);
    expect(r.programmingErrors).toBe(0);
  });

  it('L1-3b: a TypeError in the sweep\'s own counter transaction is surfaced and thrown, not read as a failed fetch', async () => {
    const db = makeSweepDb();
    let stateTx = 0;
    db.failTransactions(({ writes }) => writes.includes(statePath(MON)) && stateTx++ === 0, () => new TypeError('a bug in the counter')); // the first reservation only
    const h = harness({ at: T_RUN1 });
    let caught = null;
    try { await h.run(db); } catch (err) { caught = err; }
    expect(caught).toBeInstanceOf(TypeError);
    expect(caught.message).toBe('a bug in the counter');
    const line = JSON.parse(h.lines[0].slice(C.HEALTH_LINE_PREFIX.length + 1));
    expect(line.programmingErrors).toBe(1);
    expect(line.storeCalls).toBeLessThanOrEqual(C.SWEEP_CONCURRENCY); // the run stopped: no further name took a claim
    expect(line.stateWritten).toBe(true); // the record, a later transaction, landed
  });

  it('L1-3b: a TypeError in the end-of-run record is surfaced and thrown', async () => {
    const db = makeSweepDb();
    db.failTransactions(({ writes }) => writes.includes(statePath(MON)) && db.read(statePath(MON))?.providerRequests >= 10, () => new TypeError('a bug in the record'));
    const h = harness({ at: T_RUN1 });
    let caught = null;
    try { await h.run(db); } catch (err) { caught = err; }
    expect(caught?.message).toBe('a bug in the record');
    expect(h.calls).toHaveLength(10);
  });
});

describe('review lens 2 (docs/audits/20261116_BUILD_CHART_EVIDENCE.md §4): the provider-failure brake, the last place under the cap, the reserve', () => {
  it('L2-1: a provider outage stops the run after eight failed requests in a row; the session keeps its allowance, and the next run measures every name', async () => {
    const db = makeSweepDb();
    const names = [...ALL_TICKERS].sort().slice(0, 40);
    let down = true;
    const h = harness({ at: T_RUN1 });
    const healthy = h.fetchPayload;
    h.fetchPayload = async (symbol, opts) => { if (down) { h.calls.push({ symbol, opts, failed: true }); throw new Error('EODHD daily responded with 503'); } return healthy(symbol, opts); };
    const first = await h.run(db, { symbols: names });
    expect(h.calls.length).toBeGreaterThanOrEqual(C.BRAKE_STREAK_STOP);
    expect(h.calls.length).toBeLessThanOrEqual(C.BRAKE_STREAK_STOP + C.SWEEP_CONCURRENCY - 1);
    expect(first.deferred.provider_failing).toBe(40 - h.calls.length);
    expect(first.retryable).toEqual({ fetch_failed: h.calls.length });
    down = false;
    h.nowMs = T_RUN2;
    const second = await h.run(db, { symbols: names });
    expect(second.final.measured).toBe(40);
    expect(db.read(statePath(MON)).providerRequests).toBeLessThanOrEqual(40 + C.BRAKE_STREAK_STOP + C.SWEEP_CONCURRENCY - 1);
  });
  it('L2-1: a missing provider key (it fails before the network) stops the run the same way', async () => {
    vi.stubEnv('EODHD_API_KEY', '');
    const db = makeSweepDb();
    const names = [...ALL_TICKERS].sort().slice(0, 40);
    const h = harness({ at: T_RUN1 });
    const r = await runSetupEvidenceSweep({ db, handlerStartMs: T_RUN1, now: h.now, symbols: names, log: h.log });
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(r.providerRequests).toBeLessThanOrEqual(C.BRAKE_STREAK_STOP + C.SWEEP_CONCURRENCY - 1);
    expect(r.deferred.provider_failing).toBe(40 - r.providerRequests);
  });
  it('L2-1: failures broken up by usable answers never trip it', async () => {
    const db = makeSweepDb();
    const names = [...ALL_TICKERS].sort().slice(0, 40);
    const h = harness({ at: T_RUN1 });
    const healthy = h.fetchPayload;
    h.fetchPayload = async (symbol, opts) => { if (names.indexOf(symbol) % 4 !== 3) { h.calls.push({ symbol, opts }); await new Promise((r) => setTimeout(r, 0)); throw new Error('EODHD daily request failed'); } return healthy(symbol, opts); }; // a failed request takes as long as a good one
    const r = await h.run(db, { symbols: names });
    expect(h.calls).toHaveLength(40);
    expect(r.deferred).toEqual({});
  });
  it('L2-6: the request that takes the last place under the cap closes admission at once: no store call is refused at the counter', async () => {
    const db = makeSweepDb();
    db.write(statePath(MON), { schemaVersion: 1, session: MON, providerRequests: 396, runs: 1, firstRunAt: null, lastRunAt: null, completedAt: null, runMs: 0, latest: null, updatedAt: null });
    const h = harness({ at: T_RUN1 });
    const r = await h.run(db, { symbols: [...ALL_TICKERS].sort().slice(0, 12) });
    expect(h.calls).toHaveLength(4);
    expect(r.storeCalls).toBe(4); // no fifth claim taken only to be refused
    expect(r.deferred.cap).toBe(8);
    expect(db.read(statePath(MON)).providerRequests).toBe(400);
  });
  it('L2-8: with less than the reserve of one acquisition before the deadline, a run reads but starts no store call', async () => {
    const db = makeSweepDb();
    const h = harness({ at: T_RUN1 });
    const startedLongAgo = T_RUN1 - (C.SWEEP_ADMISSION_WINDOW_MS - C.SWEEP_ADMISSION_RESERVE_MS + 1_000); // 11 s before the deadline
    const r = await runSetupEvidenceSweep({ db, handlerStartMs: startedLongAgo, now: h.now, fetchPayload: h.fetchPayload, symbols: NAMES, log: h.log });
    expect(r.names).toBe(10);
    expect(r.storeCalls).toBe(0);
    expect(r.deferred.deadline).toBe(10);
    expect(h.calls).toEqual([]);
  });
});
