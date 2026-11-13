// api/cron/practiceFieldIsolation.test.js
//
// Practice Field T1a-1 — KIND ISOLATION ACROSS THE ENGINE and THE SWEEPS' IDEA-BOOK WIRING (build prompt §3, §5,
// §7a requirement 3, §9 "Isolation" and "The snapshot union"). Drives the REAL sweep drivers (runEvalSweep,
// runCloseSweep, runRolloverSweep), the REAL snapshot builders and the REAL quarterly cores against the
// transaction-faithful fake, with only the network edges mocked (the two market-fetch clients, the corporate
// actions' global fetch, the model seat).
//
//   • a populated idea book never reaches the quarterly eval, rollover, escape, batch, creation or accelerated
//     paths, WHATEVER PRACTICE_FIELD_MODE says (the guards do not read the flag);
//   • the close sweep dispatches both kinds correctly;
//   • T0c's idle check is defeated by an active idea book;
//   • the shared snapshot's build set: idea books only → no default candidate universe; a quarterly book present →
//     today's set beside the coverage symbols; funds skip the fundamentals lookup; the candidate floor is not read
//     when the default universe is absent;
//   • with the mode 'off' no Practice Field code path runs in either sweep.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const modelSpy = vi.fn(async () => { throw new Error('the model seat was called'); });
const batchApi = { create: vi.fn(), retrieve: vi.fn(), results: vi.fn(), cancel: vi.fn(async () => ({})) };
vi.mock('../_utils/mandateModelCall.js', async (importActual) => {
  const actual = await importActual();
  return {
    ...actual,
    callMandateModelDirect: (...a) => modelSpy(...a),
    createMandateBatch: (...a) => batchApi.create(...a),
    retrieveMandateBatch: (...a) => batchApi.retrieve(...a),
    mandateBatchResults: (...a) => batchApi.results(...a),
    cancelMandateBatch: (...a) => batchApi.cancel(...a),
  };
});

let quoteBook = {};
let quoteTs = 0;
const quotesSpy = vi.fn(async (symbols) => Object.fromEntries(symbols.filter((s) => quoteBook[s] !== undefined).map((s) => [s, { close: quoteBook[s], timestamp: quoteTs }])));
const fundamentalsSpy = vi.fn(async () => ({ fundamentals: { sector: 'Vendor Sector', industry: 'Vendor Industry', marketCap: 5e11 }, cacheStatus: { fundamentals: 'fresh' } }));
vi.mock('../_utils/tournamentPrices.js', async (importActual) => ({ ...(await importActual()), fetchBatchQuotes: (...a) => quotesSpy(...a) }));
vi.mock('../_utils/marketDataCache.js', async (importActual) => ({ ...(await importActual()), getStockAnalysisData: (...a) => fundamentalsSpy(...a) }));

import { runEvalSweep, runCloseSweep, runBookEval, idleAcquisitionCheck, snapshotBuildInputs } from './mandate-evaluate.js';
import { runRolloverSweep } from './mandate-rollover.js';
import { makeMandateFakeDb } from '../_utils/__testsupport__/mandateFakeFirestore.js';
import { buildNewMandateDoc } from '../_utils/mandateSchema.js';
import { executeDecision, disposeSubmission } from '../_utils/mandateExecution.js';
import { closeBook } from '../_utils/mandateClosePass.js';
import { rollOneBoundary, catchUpBook } from '../_utils/mandateRollover.js';
import { escapeMandate } from '../_utils/mandateEscape.js';
import { createMandate } from '../_utils/mandateCreationService.js';
import { drainOpenBatches, buildBatchDoc, MANDATE_BATCH_COLLECTION } from '../_utils/mandateBatchTransport.js';
import { simulateFullRollover } from '../_utils/mandateAcceleratedClock.js';
import { CANDIDATE_UNIVERSE } from '../_utils/mandateCandidateUniverse.js';
import { splitActiveBooks } from '../_utils/mandateBookKind.js';
import { setPracticeFieldModeForTests } from '../_utils/practiceField/mode.js';
import { admitIdea } from '../_utils/practiceField/admission.js';
import { PRACTICE_FIELD_FUNDS } from '../../src/data/practiceFieldFunds.js';
import {
  seedBook as seedIdeaBook, admitAndEnter, contractOf, getBook, getIdea, getRow, etIso, etMs, tickOf, DAYS, ADMIT_ISO, countDocs,
} from '../_utils/practiceField/__testsupport__/fixtures.js';

const PRICES = { AAPL: 231.47, MSFT: 418.13, LLY: 803.17, SPY: 597.31, XLK: 233.59, JPM: 241.37 };
const entryQuotes = { AAPL: { price: PRICES.AAPL, marketCap: 3.4e12 }, MSFT: { price: PRICES.MSFT, marketCap: 3.1e12 }, SPY: PRICES.SPY, XLK: PRICES.XLK };

function fakeReqRes() {
  const captured = {};
  const res = { status(code) { captured.code = code; return this; }, json(body) { captured.body = body; return this; } };
  return { req: { headers: { 'x-vercel-cron': '1' }, method: 'POST' }, res, captured };
}

function quarterlyBook(overrides = {}) {
  const doc = buildNewMandateDoc({
    mandateId: overrides.mandateId || 'q1', userId: overrides.userId || 'owner-q', archetype: 'analyst', managerAgentId: 'mgr_analyst_x',
    vintageRef: 'archetypeVintages/analyst_x', cadenceTier: 'fast',
    createdAt: new Date('2026-09-01T13:00:00Z'), quarterStartAt: new Date('2026-09-01T13:00:00Z'),
    nextRolloverAt: new Date('2026-12-01T21:00:00Z'), escapeHatchEligibleUntil: new Date('2026-09-15T13:00:00Z'),
  });
  return { ...doc, ...overrides, health: { ...doc.health, ...(overrides.health || {}) }, execState: { ...doc.execState, ...(overrides.execState || {}) }, portfolio: { ...doc.portfolio, ...(overrides.portfolio || {}) } };
}

/** A read log over the fake: every doc get and every query, in order. */
function withReadLog(db) {
  const reads = [];
  const wrapDoc = (ref) => ({ ...ref, get: async () => { reads.push(`get ${ref.path}`); return ref.get(); }, collection: (c) => wrapCol(ref.collection(c), `${ref.path}/${c}`) });
  const wrapCol = (col, path) => ({
    doc: (id) => wrapDoc(col.doc(id)),
    where: (...a) => wrapCol(col.where(...a), `${path}?${a.join('')}`),
    orderBy: (...a) => wrapCol(col.orderBy(...a), path),
    limit: (n) => wrapCol(col.limit(n), path),
    startAfter: (...a) => wrapCol(col.startAfter(...a), path),
    get: async () => { reads.push(`query ${path}`); return col.get(); },
  });
  return { reads, db: { ...db, collection: (c) => wrapCol(db.collection(c), c), doc: (p) => wrapDoc(db.doc(p)) } };
}

/** One idea book with a held idea (AAPL + MSFT against XLK), entered on D1. */
async function populatedIdeaBook(db, { uid = 'owner-1', opId = 'c1' } = {}) {
  const book = await seedIdeaBook({ db, uid, opId });
  const idea = await admitAndEnter(db, book.bookId, {
    contract: contractOf({ names: ['AAPL', 'MSFT'], comparison: { type: 'sector_fund', symbols: ['XLK'] } }), quotes: entryQuotes,
  });
  expect(idea.entry.outcome).toBe('entered');
  return { ...book, ideaId: idea.ideaId };
}

/** The stored documents under a prefix, without the engine's lease field (a lease is taken and released around every served book; it is not the book's state). */
const snapshotOfStore = (db, prefix) => JSON.stringify([...db._store.entries()].filter(([p]) => p.startsWith(prefix)).map(([p, e]) => {
  const { lease: _lease, ...data } = e.data;
  return [p, data];
}));
const closeTickOf = (date) => ({ date, closeKey: `${date}_close` });
const closeNow = (date) => new Date(etMs(date, 16, 30));
const evalNow = (date, slot) => new Date(etMs(date, slot === 'open30' ? 10 : slot === 'midday' ? 12 : 15, slot === 'midday' ? 46 : slot === 'preClose' ? 31 : 2));

let restoreMode;
let errors;
let logs;
let fetchCalls;
beforeEach(() => {
  restoreMode = setPracticeFieldModeForTests('on');
  modelSpy.mockClear(); quotesSpy.mockClear(); fundamentalsSpy.mockClear();
  quoteBook = { ...PRICES };
  for (const s of CANDIDATE_UNIVERSE) if (quoteBook[s] === undefined) quoteBook[s] = 100.01;
  quoteTs = Math.floor(etMs(DAYS.d1, 9, 45) / 1000);
  errors = []; logs = []; fetchCalls = [];
  vi.spyOn(console, 'error').mockImplementation((m) => errors.push(String(m)));
  vi.spyOn(console, 'log').mockImplementation((m) => logs.push(String(m)));
  process.env.EODHD_API_KEY = 'test-key';
  vi.stubGlobal('fetch', vi.fn(async (url) => { fetchCalls.push(String(url).replace(/api_token=[^&]+/, 'api_token=X')); return { ok: true, json: async () => [] }; }));
});
afterEach(() => { restoreMode(); vi.restoreAllMocks(); vi.unstubAllGlobals(); delete process.env.EODHD_API_KEY; });

// ─────────────────────────────────────────────────────────────────────────────
describe('kind isolation on every quarterly core — unconditional (run at mode on AND at the shipped mode off)', () => {
  for (const mode of ['on', null]) {
    const label = mode === null ? "mode 'off' (shipped)" : "mode 'on'";

    it(`${label}: runBookEval never evaluates an idea book — no model call, nothing written`, async () => {
      const db = makeMandateFakeDb();
      const { bookId, bookRef } = await populatedIdeaBook(db);
      setPracticeFieldModeForTests(mode);
      const before = snapshotOfStore(db, 'mandates/');
      const out = await runBookEval(db, { book: getBook(db, bookId), mandateRef: bookRef, vintage: { gateConfig: {}, modelSeat: {} }, snapshot: { tickKey: 't', symbols: {} }, sessionDate: DAYS.d2, slot: 'open30' });
      expect(out).toEqual({ outcome: 'skipped_kind' });
      expect(modelSpy).not.toHaveBeenCalled();
      expect(snapshotOfStore(db, 'mandates/')).toBe(before);
    });

    it(`${label}: executeDecision and disposeSubmission refuse an idea book before any write`, async () => {
      const db = makeMandateFakeDb();
      const { bookRef } = await populatedIdeaBook(db);
      setPracticeFieldModeForTests(mode);
      const before = snapshotOfStore(db, 'mandates/');
      const envelope = { baseRevision: 2, quarterKey: undefined, submittedAt: new Date().toISOString(), sessionDate: DAYS.d2, requestId: 'req-1' };
      await expect(executeDecision(db, {
        mandateRef: bookRef, decisionId: 'req-1', decision: { verb: 'SELL', ticker: 'AAPL', sizeUsd: 0 }, gateResult: { passed: true },
        envelope, snapshot: { tickKey: 't', symbols: {} }, submitMark: null, currentSessionDate: DAYS.d2,
      })).rejects.toThrow(/not_quarterly/);
      await expect(disposeSubmission(db, { mandateRef: bookRef, requestId: 'req-2', status: 'expired', failCondition: 'result_age' })).rejects.toThrow(/not_quarterly/);
      expect(snapshotOfStore(db, 'mandates/')).toBe(before);
    });

    it(`${label}: closeBook (the quarterly close) skips an idea book: not_quarterly, nothing written`, async () => {
      const db = makeMandateFakeDb();
      const { bookRef } = await populatedIdeaBook(db);
      setPracticeFieldModeForTests(mode);
      const before = snapshotOfStore(db, 'mandates/');
      const out = await closeBook(db, bookRef, { date: DAYS.d1, closeSnapshot: { tickKey: `${DAYS.d1}_close`, symbols: { AAPL: { price: 250, complete: true } } }, now: closeNow(DAYS.d1) });
      expect(out).toEqual({ closed: false, skipped: 'not_quarterly', alerts: [] });
      expect(snapshotOfStore(db, 'mandates/')).toBe(before);
    });

    it(`${label}: rollover never rolls an idea book — the core, the catch-up and the sweep (whose query the fake, unlike Firestore, lets it into)`, async () => {
      const db = makeMandateFakeDb({ 'mandates/q-due': quarterlyBook({ mandateId: 'q-due', nextRolloverAt: new Date('2026-11-01T21:00:00Z') }) });
      const { bookRef, bookId } = await populatedIdeaBook(db);
      setPracticeFieldModeForTests(mode);
      const before = snapshotOfStore(db, `mandates/${bookId}`);
      const vintagesBefore = countDocs(db, 'archetypeVintages/');
      expect(await rollOneBoundary(db, bookRef, { now: new Date('2027-06-01T12:00:00Z') })).toEqual({ rolled: false, skipped: 'not_quarterly' });
      expect(await catchUpBook(db, bookRef, { now: new Date('2027-06-01T12:00:00Z') })).toEqual({ processed: [], boundaries: 0, cappedOut: false });
      expect(countDocs(db, 'archetypeVintages/')).toBe(vintagesBefore); // answered before the vintage publish
      // The fake returns a doc with NO nextRolloverAt for `<= now` (real Firestore would not): the sweep must step over it itself.
      const page = await db.collection('mandates').where('status', '==', 'active').where('nextRolloverAt', '<=', new Date('2026-11-17T12:00:00Z')).get();
      expect(page.docs.map((d) => d.id)).toContain(bookId);
      const { req, res, captured } = fakeReqRes();
      await runRolloverSweep(req, res, { now: new Date('2026-11-17T12:00:00Z'), rolloverTick: { date: DAYS.d2, rolloverKey: `${DAYS.d2}_rollover` }, db });
      expect(captured.body).toMatchObject({ ok: true, rolledBooks: 1 }); // the due quarterly book rolled
      expect(db._get('mandates/q-due').quarterIndex).toBe(2);
      expect(snapshotOfStore(db, `mandates/${bookId}`).replace(/"lease[^}]*}/g, '')).toBe(before.replace(/"lease[^}]*}/g, ''));
      expect(getBook(db, bookId)).not.toHaveProperty('quarterIndex');
      expect(getBook(db, bookId)).not.toHaveProperty('vintageRef');
    });

    it(`${label}: the escape hatch refuses an idea book even if the quarterly pointer were mis-set at it`, async () => {
      const db = makeMandateFakeDb();
      const { bookId } = await populatedIdeaBook(db);
      await db.collection('userMeta').doc('owner-1').set({ activeMandateId: bookId, mandateEscapeHatchUsed: false });
      setPracticeFieldModeForTests(mode);
      const before = snapshotOfStore(db, 'mandates/');
      expect(await escapeMandate(db, { userId: 'owner-1', archetype: 'analyst', now: new Date(etIso(DAYS.d2, 12, 0)) })).toEqual({ ok: false, code: 'not_quarterly' });
      expect(snapshotOfStore(db, 'mandates/')).toBe(before);
      expect(db._get('userMeta/owner-1')).toEqual({ activeMandateId: bookId, mandateEscapeHatchUsed: false });
    });

    it(`${label}: a batch entry that named an idea book is never disposed against it (drain) — the book is untouched and the batch stays open`, async () => {
      const db = makeMandateFakeDb();
      const { bookId } = await populatedIdeaBook(db);
      await db.collection(MANDATE_BATCH_COLLECTION).doc('batch-1').set(buildBatchDoc({
        providerBatchId: 'batch-1', tickKey: `${DAYS.d1}_open30`, sessionDate: DAYS.d1, submittedAt: new Date(etIso(DAYS.d1, 10, 1)),
        entries: { 'req-1': { mandateId: bookId, envelope: { requestId: 'req-1', baseRevision: 2 }, model: 'm' } },
      }));
      setPracticeFieldModeForTests(mode);
      const before = snapshotOfStore(db, 'mandates/').replace(/"lease[^}]*}/g, '');
      const out = await drainOpenBatches(db, { now: new Date(etIso(DAYS.d1, 11, 0)) });
      expect(out).toMatchObject({ batches: 1, disposed: 0, leaseSkips: 1, incomplete: 1 });
      expect(snapshotOfStore(db, 'mandates/').replace(/"lease[^}]*}/g, '')).toBe(before);
      expect(countDocs(db, `mandates/${bookId}/decisions/req-1`)).toBe(0);
      expect(db._get(`${MANDATE_BATCH_COLLECTION}/batch-1`).status).toBe('open');
    });

    it(`${label}: quarterly creation and the accelerated clock never act on the owner's idea book`, async () => {
      const db = makeMandateFakeDb();
      const { bookId } = await populatedIdeaBook(db);
      setPracticeFieldModeForTests(mode);
      const before = snapshotOfStore(db, `mandates/${bookId}`);
      const claimBefore = JSON.stringify(db._get('practiceFieldBooks/owner-1'));
      const created = await createMandate(db, { userId: 'owner-1', archetype: 'analyst', now: new Date(etIso(DAYS.d2, 12, 0)) });
      expect(created.ok).toBe(true);
      expect(created.mandateId).not.toBe(bookId);
      expect(db._get('userMeta/owner-1').activeMandateId).toBe(created.mandateId); // the quarterly product's own claim
      expect(db._get(`mandates/${created.mandateId}`)).not.toHaveProperty('kind');
      const sim = await simulateFullRollover(db, { userId: 'owner-accel', now: new Date(etIso(DAYS.d2, 12, 0)) });
      expect(sim).toBeTruthy();
      expect(snapshotOfStore(db, `mandates/${bookId}`)).toBe(before);
      expect(JSON.stringify(db._get('practiceFieldBooks/owner-1'))).toBe(claimBefore);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
describe('the shared snapshot\'s build set, by book kind (build prompt §5)', () => {
  const evalOnce = async (db, date = DAYS.d2, slot = 'open30') => {
    quoteTs = Math.floor(etMs(date, 9, 45) / 1000);
    const { req, res, captured } = fakeReqRes();
    await runEvalSweep(req, res, { now: evalNow(date, slot), tick: tickOf(date, slot), db });
    return captured.body;
  };

  it('idea books only: NO default candidate universe is fetched; the build is the held tickers and the reserved coverage; it is not "degraded"', async () => {
    const db = makeMandateFakeDb();
    await populatedIdeaBook(db);
    const body = await evalOnce(db);
    expect(body.ok).toBe(true);
    const fetched = quotesSpy.mock.calls.flatMap((c) => c[0]).sort();
    expect(fetched).toEqual(['AAPL', 'MSFT', 'SPY', 'XLK']);
    const snap = db._get(`mandateUniverseSnapshots/${DAYS.d2}_open30`);
    expect(Object.keys(snap.symbols).sort()).toEqual(['AAPL', 'MSFT', 'SPY', 'XLK']);
    expect(snap).toMatchObject({ degraded: false, completeCandidateCount: 0, heldCount: 4, symbolCount: 4 });
    expect(errors.filter((e) => /MANDATE_UNIVERSE_DEGRADED/.test(e))).toEqual([]);
    const daily = db._get(`mandateUniverseDaily/${DAYS.d2}`);
    expect(Object.keys(daily.symbols).sort()).toEqual(['AAPL', 'MSFT', 'SPY', 'XLK']);
  });

  it('funds skip the fundamentals lookup — their classification is the map — and still get quotes, splits and dividends', async () => {
    const db = makeMandateFakeDb();
    await populatedIdeaBook(db);
    await evalOnce(db);
    const looked = fundamentalsSpy.mock.calls.map((c) => c[0]).sort();
    expect(looked).toEqual(['AAPL', 'MSFT']); // never SPY or XLK
    const daily = db._get(`mandateUniverseDaily/${DAYS.d2}`).symbols;
    expect(daily.XLK).toMatchObject({ sector: 'Technology', industry: 'etf', marketCap: null, complete: true });
    expect(daily.SPY).toMatchObject({ sector: 'broad_market', industry: 'etf', marketCap: null, complete: true });
    expect(daily.AAPL).toMatchObject({ sector: 'Vendor Sector', marketCap: 5e11 });
    for (const fund of ['SPY', 'XLK']) {
      expect(fetchCalls.some((u) => u.includes(`/splits/${fund}.US`))).toBe(true);
      expect(fetchCalls.some((u) => u.includes(`/div/${fund}.US`))).toBe(true);
    }
    expect(db._get(`mandateUniverseSnapshots/${DAYS.d2}_open30`).symbols.SPY).toMatchObject({ price: PRICES.SPY, complete: true });
  });

  it('a pending idea\'s symbols are covered before it holds anything (the session-before-entry rule has data to enter on)', async () => {
    const db = makeMandateFakeDb();
    const { bookId } = await seedIdeaBook({ db });
    const a = await admitIdea(db, { bookId, contract: contractOf({ names: ['LLY'] }), opId: 'p', nowIso: ADMIT_ISO });
    expect(a.ok).toBe(true);
    quoteTs = Math.floor(etMs(DAYS.d1, 9, 45) / 1000);
    const { req, res, captured } = fakeReqRes();
    await runEvalSweep(req, res, { now: evalNow(DAYS.d1, 'open30'), tick: tickOf(DAYS.d1, 'open30'), db });
    expect(Object.keys(db._get(`mandateUniverseSnapshots/${DAYS.d1}_open30`).symbols).sort()).toEqual(['LLY', 'SPY']);
    // …and the same fire's idea-book pass entered it from that snapshot.
    expect(captured.body.ideaBooks).toMatchObject({ books: 1, served: 1, entered: 1, errors: 0 });
    expect(getIdea(db, bookId, a.ideaId).status).toBe('holding');
    expect(getIdea(db, bookId, a.ideaId).entry.snapshotKey).toBe(`${DAYS.d1}_open30`);
  });

  it('one quarterly book present: TODAY\'S set (the default universe ∪ held) beside the coverage symbols, with the candidate floor read as today', async () => {
    const db = makeMandateFakeDb({
      'mandates/q1': quarterlyBook({ portfolio: { positions: { JPM: { shares: 10, costBasisTotal: 2400, lastMark: 240 } } }, execState: { lastEvalTickKey: `${DAYS.d2}_open30` } }),
    });
    await populatedIdeaBook(db);
    await evalOnce(db);
    const snap = db._get(`mandateUniverseSnapshots/${DAYS.d2}_open30`);
    const expected = [...new Set([...CANDIDATE_UNIVERSE, 'JPM', 'AAPL', 'MSFT', 'SPY', 'XLK'])].sort();
    expect(Object.keys(snap.symbols).sort()).toEqual(expected);
    expect(snap.degraded).toBe(false);
    expect(snap.completeCandidateCount).toBeGreaterThanOrEqual(100);
    // The quote outage that degrades a build WITH the default universe still does: the floor is read as today.
    for (const s of CANDIDATE_UNIVERSE) delete quoteBook[s];
    await evalOnce(db, DAYS.d2, 'midday');
    expect(db._get(`mandateUniverseSnapshots/${DAYS.d2}_midday`).degraded).toBe(true);
    expect(errors.some((e) => /MANDATE_UNIVERSE_DEGRADED/.test(e))).toBe(true);
  });

  it('quarterly books only: exactly today\'s build — no builder option, and the coverage document is never read', async () => {
    const seeded = makeMandateFakeDb({ 'mandates/q1': quarterlyBook({ execState: { lastEvalTickKey: `${DAYS.d2}_open30` } }) });
    const { db, reads } = withReadLog(seeded);
    await evalOnce(db);
    expect(reads.filter((r) => /practiceField/.test(r))).toEqual([]);
    expect(Object.keys(seeded._get(`mandateUniverseSnapshots/${DAYS.d2}_open30`).symbols).sort()).toEqual([...CANDIDATE_UNIVERSE].sort());
    const view = splitActiveBooks([{ data: () => quarterlyBook() }], { ideaBooksLive: true });
    expect(await snapshotBuildInputs({ collection: () => { throw new Error('read'); } }, view)).toEqual({ heldTickers: [], daily: {}, tick: {} });
  });

  it('the union never exceeds the cap: with the reserved universe at its budget, the build beside a quarterly book is exactly the cap', async () => {
    const db = makeMandateFakeDb({ 'mandates/q1': quarterlyBook({ execState: { lastEvalTickKey: `${DAYS.d2}_open30` } }) });
    const { bookId } = await populatedIdeaBook(db);
    // Fill the coverage document up to the admission budget (300 − the default universe), then try one more symbol.
    const cov = db._get('practiceFieldCoverage/current');
    const inDefault = Object.keys(cov.symbols).filter((s) => CANDIDATE_UNIVERSE.includes(s)).length;
    const room = 300 - CANDIDATE_UNIVERSE.length - (Object.keys(cov.symbols).length - inDefault);
    const symbols = { ...cov.symbols };
    for (let i = 0; i < room; i += 1) { const s = `ZZ${String(i).padStart(3, '0')}`; symbols[s] = { roles: ['held'], refs: ['x/y'], byRef: { 'x/y': ['held'] } }; quoteBook[s] = 10.01; }
    await db.collection('practiceFieldCoverage').doc('current').set({ ...cov, symbols });
    const refused = await admitIdea(db, { bookId, contract: contractOf({ slot: 'medium', names: ['LLY'], comparison: { type: 'sector_fund', symbols: ['XLV'] }, capitalUsd: 25000 }), opId: 'over', nowIso: etIso(DAYS.d1, 11, 0) });
    expect(refused.refusals.map((r) => r.code)).toEqual(['coverage_unavailable']); // XLV would be symbol 301
    await evalOnce(db);
    const snap = db._get(`mandateUniverseSnapshots/${DAYS.d2}_open30`);
    expect(Object.keys(snap.symbols).length).toBe(300);
    expect(snap.droppedCandidatesForCap).toBe(0); // nothing gave way: neither held nor reserved coverage nor a candidate
    for (const s of ['AAPL', 'MSFT', 'SPY', 'XLK', 'ZZ000']) expect(snap.symbols[s]).toBeTruthy();
  });

  it("mode 'off': an idea book is invisible to the build — alone it is an idle skip; beside a quarterly book the build is the quarterly book's own", async () => {
    const db = makeMandateFakeDb();
    const { bookId } = await populatedIdeaBook(db);
    setPracticeFieldModeForTests(null);
    const before = snapshotOfStore(db, '');
    const body = await evalOnce(db);
    expect(body).toMatchObject({ noop: true, reason: 'mandate_idle_skip' });
    expect(quotesSpy).not.toHaveBeenCalled();
    expect(snapshotOfStore(db, '')).toBe(before); // an idle skip writes nothing
    expect(logs.map((l) => { try { return JSON.parse(l).event; } catch { return null; } })).toContain('mandate_idle_skip');

    await db.collection('mandates').doc('q1').set(quarterlyBook({ execState: { lastEvalTickKey: `${DAYS.d2}_open30` } }));
    const logged = withReadLog(db);
    const second = await (async () => { const { req, res, captured } = fakeReqRes(); await runEvalSweep(req, res, { now: evalNow(DAYS.d2, 'open30'), tick: tickOf(DAYS.d2, 'open30'), db: logged.db }); return captured.body; })();
    expect(second.ok).toBe(true);
    expect(second).not.toHaveProperty('ideaBooks');
    expect(logged.reads.filter((r) => /practiceField/.test(r))).toEqual([]);
    expect(Object.keys(db._get(`mandateUniverseSnapshots/${DAYS.d2}_open30`).symbols).sort()).toEqual([...CANDIDATE_UNIVERSE].sort()); // no SPY, no XLK
    // The quarterly loop stepped over the idea book and rotated it; nothing else about it moved.
    const idea = getBook(db, bookId);
    expect(idea.execState).toMatchObject({ lastSweepTickKey: `${DAYS.d2}_open30` });
    expect(idea.execState).not.toHaveProperty('lastEvalTickKey'); // never evaluated
    expect(idea.execState).not.toHaveProperty('lastIdeaTickKey'); // its own pass never ran
    expect(idea.revision).toBe(2);
    expect(modelSpy).not.toHaveBeenCalled();
  });

  it('every fund in the map has a static classification and none is in the default candidate universe', () => {
    for (const fund of Object.keys(PRACTICE_FIELD_FUNDS)) expect(CANDIDATE_UNIVERSE).not.toContain(fund);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('T0c\'s idle check and an active idea book', () => {
  it('an active idea book defeats the idle skip while the Practice Field is live — with no extra read', async () => {
    const db = makeMandateFakeDb();
    await populatedIdeaBook(db);
    const active = await db.collection('mandates').where('status', '==', 'active').get();
    const view = splitActiveBooks(active.docs, { ideaBooksLive: true });
    const untouched = { collection: () => { throw new Error('a read was made'); } };
    expect(await idleAcquisitionCheck(untouched, { docs: view.visibleDocs })).toEqual({ skip: false, activeBooks: 1, outstandingDuty: null });
    // …and with the mode off it is not counted: the check falls through to the open-batch read and skips.
    const hidden = splitActiveBooks(active.docs, { ideaBooksLive: false });
    expect(await idleAcquisitionCheck(db, { docs: hidden.visibleDocs })).toEqual({ skip: true, activeBooks: 0, outstandingDuty: false });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('the eval sweep: the idea-book pass beside the quarterly loop', () => {
  it('enters a pending idea at its start session\'s slot, makes no model call for it, stamps it, and does not serve it twice in one slot', async () => {
    const db = makeMandateFakeDb();
    const { bookId } = await seedIdeaBook({ db });
    const a = await admitIdea(db, { bookId, contract: contractOf({ names: ['AAPL', 'MSFT'], comparison: { type: 'sector_fund', symbols: ['XLK'] } }), opId: 'i', nowIso: ADMIT_ISO });
    quoteTs = Math.floor(etMs(DAYS.d1, 9, 45) / 1000);
    const fire = async (slot = 'open30') => { const { req, res, captured } = fakeReqRes(); await runEvalSweep(req, res, { now: evalNow(DAYS.d1, slot), tick: tickOf(DAYS.d1, slot), db }); return captured.body; };
    const first = await fire();
    expect(first.ideaBooks).toEqual({ books: 1, served: 1, entered: 1, waiting: 0, cancelled: 0, errors: 0, leaseSkips: 0 });
    expect(first).toMatchObject({ ok: true, evaluated: 0, executed: 0, skipped: 1 }); // the quarterly loop stepped over it
    expect(modelSpy).not.toHaveBeenCalled();
    const book = getBook(db, bookId);
    expect(book.execState).toMatchObject({ lastIdeaTickKey: `${DAYS.d1}_open30`, lastSweepTickKey: `${DAYS.d1}_open30`, submitted: 0, executed: 0 });
    expect(book.execState).not.toHaveProperty('lastEvalTickKey'); // the model eval's stamp: never written on an idea book
    expect(book.health.lastEvalSweepAt).toBeInstanceOf(Date);
    expect(book.health.consecutiveEvalFailures).toBe(0);
    expect(getIdea(db, bookId, a.ideaId).status).toBe('holding');
    // A second generous fire in the same slot: the book is not served again, and nothing about it moves.
    const before = snapshotOfStore(db, `mandates/${bookId}`);
    const second = await fire();
    expect(second.ideaBooks).toMatchObject({ books: 1, served: 0, entered: 0 });
    expect(second.complete).toBe(true);
    expect(snapshotOfStore(db, `mandates/${bookId}`).replace(/"lease[^}]*}/g, '')).toBe(before.replace(/"lease[^}]*}/g, ''));
  });

  it('under BATCH transport the session\'s last slot still runs the idea-book pass (the last-tick rule is about submissions)', async () => {
    const db = makeMandateFakeDb();
    const { bookId } = await seedIdeaBook({ db });
    const a = await admitIdea(db, { bookId, contract: contractOf(), opId: 'i', nowIso: ADMIT_ISO });
    quoteTs = Math.floor(etMs(DAYS.d1, 15, 15) / 1000);
    const { req, res, captured } = fakeReqRes();
    await runEvalSweep(req, res, { now: evalNow(DAYS.d1, 'preClose'), tick: tickOf(DAYS.d1, 'preClose'), db, transport: 'batch' });
    expect(captured.body).toMatchObject({ ok: true, reason: 'last_tick_no_submit', ideaBooks: { books: 1, entered: 1 } });
    expect(getIdea(db, bookId, a.ideaId).entry.slot).toBe('preClose');
  });

  it('a quarterly book beside it is evaluated exactly as before, by the model seat, and the two never share a path', async () => {
    const db = makeMandateFakeDb({ 'mandates/q1': quarterlyBook(), 'archetypeVintages/analyst_x': { gateConfig: { sectorCapConversionVersion: 1, decisionVerbs: ['BUY', 'SELL', 'TRIM', 'ADD', 'HOLD'] }, modelSeat: { model: 'm' } } });
    const { bookId } = await populatedIdeaBook(db);
    modelSpy.mockImplementationOnce(async () => ({ decision: { ok: true, input: { verb: 'HOLD', rationale: 'Holding. Nothing to do.', conviction: 50 } }, usage: null }));
    quoteTs = Math.floor(etMs(DAYS.d2, 9, 45) / 1000);
    const { req, res, captured } = fakeReqRes();
    await runEvalSweep(req, res, { now: evalNow(DAYS.d2, 'open30'), tick: tickOf(DAYS.d2, 'open30'), db });
    expect(modelSpy).toHaveBeenCalledTimes(1); // the quarterly book only
    expect(captured.body).toMatchObject({ ok: true, evaluated: 1, executed: 1, skipped: 1, ideaBooks: { books: 1, served: 1 } });
    expect(db._get('mandates/q1').execState).toMatchObject({ submitted: 1, executed: 1, lastEvalTickKey: `${DAYS.d2}_open30` });
    expect(getBook(db, bookId).execState).toMatchObject({ submitted: 0, executed: 0 });
    expect(getBook(db, bookId).execState).not.toHaveProperty('lastEvalTickKey');
    expect(countDocs(db, `mandates/${bookId}/decisions/`)).toBe(2); // its two basket-entry receipts, nothing else
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('the close sweep: dispatch by kind, and one snapshot per date (B-STAMP)', () => {
  const closeOnce = async (db, date) => {
    quoteTs = Math.floor(etMs(date, 16, 0) / 1000);
    const { req, res, captured } = fakeReqRes();
    await runCloseSweep(req, res, { now: closeNow(date), closeTick: closeTickOf(date), db });
    return captured.body;
  };

  it('an idea book goes to the idea-book close and a quarterly book to closeBook, in one sweep', async () => {
    const db = makeMandateFakeDb({ 'mandates/q1': quarterlyBook({ portfolio: { positions: { JPM: { shares: 10, costBasisTotal: 2400, lastMark: 240, openedAt: '2026-09-02' } } } }) });
    const { bookId, ideaId } = await populatedIdeaBook(db);
    const body = await closeOnce(db, DAYS.d1);
    expect(body).toMatchObject({ ok: true, closed: 2, errors: 0, ideaBooksClosed: 1 });
    // The quarterly book: its own row shape, its scoring, its quarter lens — unchanged.
    const qRow = db._get(`mandates/q1/dailyRows/${DAYS.d1}`);
    expect(qRow).toMatchObject({ date: DAYS.d1, quarterIndex: 1, markSource: 'close_snapshot' });
    expect(qRow).not.toHaveProperty('kind');
    expect(db._get('mandates/q1').scoring).toBeTruthy();
    // The idea book: its own row, its idea's row, no scoring stream.
    const iRow = db._get(`mandates/${bookId}/dailyRows/${DAYS.d1}`);
    expect(iRow).toMatchObject({ kind: 'idea_book', basis: 'mark', closeSnapshotKey: `${DAYS.d1}_close`, fullQuality: true });
    expect(iRow).not.toHaveProperty('quarterIndex');
    expect(getRow(db, bookId, ideaId, DAYS.d1)).toMatchObject({ basis: 'mark', closeSnapshotKey: `${DAYS.d1}_close` });
    expect(getBook(db, bookId)).not.toHaveProperty('scoring');
    expect(countDocs(db, `mandates/${bookId}/pendingScoringAppends/`)).toBe(0);
    expect(getBook(db, bookId).execState.lastCloseKey).toBe(DAYS.d1);
    expect(db._get('mandates/q1').execState.lastCloseKey).toBe(DAYS.d1);
  });

  it('B-STAMP — two idea books closed in two SEPARATE fires for one date carry the same snapshot key and the same mark per shared symbol; the snapshot is built once; a planted second snapshot is never read', async () => {
    const seeded = makeMandateFakeDb();
    const one = await populatedIdeaBook(seeded, { uid: 'owner-1', opId: 'c1' });
    const two = await populatedIdeaBook(seeded, { uid: 'owner-2', opId: 'c2' });
    // A second, different snapshot for the same date, planted beside the real key.
    await seeded.collection('mandateUniverseSnapshots').doc(`${DAYS.d1}_close_v2`).set({ tickKey: `${DAYS.d1}_close_v2`, sessionDate: DAYS.d1, builtAt: new Date(), symbols: { AAPL: { price: 1, complete: true, quoteTs: 1 } } });
    const { db, reads } = withReadLog(seeded);

    // Fire 1 closes book one only: book two's lease is held by another invocation.
    await seeded.collection('mandates').doc(two.bookId).set({ lease: { ownerToken: 'someone-else', expiresAt: new Date(closeNow(DAYS.d1).getTime() + 200_000) } }, { merge: true });
    const first = await closeOnce(db, DAYS.d1);
    expect(first).toMatchObject({ closed: 1, ideaBooksClosed: 1, complete: false }); // book two was lease-skipped: a second fire must serve it
    expect(getRow(seeded, two.bookId, two.ideaId, DAYS.d1)).toBeUndefined();
    const builds = quotesSpy.mock.calls.length;
    expect(builds).toBeGreaterThan(0);

    // Fire 2, later, with different live prices at the vendor: it must NOT rebuild.
    await seeded.collection('mandates').doc(two.bookId).set({ lease: null }, { merge: true });
    quoteBook.AAPL = 999.99;
    const { req, res, captured } = fakeReqRes();
    await runCloseSweep(req, res, { now: new Date(closeNow(DAYS.d1).getTime() + 20 * 60_000), closeTick: closeTickOf(DAYS.d1), db });
    expect(captured.body.ok).toBe(true);
    expect(quotesSpy.mock.calls.length).toBe(builds); // read by key, never rebuilt

    const rowOne = getRow(seeded, one.bookId, one.ideaId, DAYS.d1);
    const rowTwo = getRow(seeded, two.bookId, two.ideaId, DAYS.d1);
    expect(rowOne.closeSnapshotKey).toBe(`${DAYS.d1}_close`);
    expect(rowTwo.closeSnapshotKey).toBe(`${DAYS.d1}_close`);
    expect(rowTwo.closeSnapshotBuiltAt).toBe(rowOne.closeSnapshotBuiltAt);
    expect(rowTwo.marks).toEqual(rowOne.marks);
    expect(rowTwo.marks.AAPL.mark).toBe(PRICES.AAPL);
    expect(rowTwo.spyMarks).toEqual(rowOne.spyMarks);
    expect(reads.filter((r) => r.includes('_close_v2'))).toEqual([]);
    expect(reads.filter((r) => r === `get mandateUniverseSnapshots/${DAYS.d1}_close`).length).toBeGreaterThanOrEqual(2);

    // Fire 3: a replay. Nothing new is written for either book.
    const before = snapshotOfStore(seeded, 'mandates/').replace(/"lease[^}]*}/g, '').replace(/"lastCloseAttemptAt":"[^"]*"/g, '');
    const { req: r3, res: s3, captured: c3 } = fakeReqRes();
    await runCloseSweep(r3, s3, { now: new Date(closeNow(DAYS.d1).getTime() + 40 * 60_000), closeTick: closeTickOf(DAYS.d1), db });
    expect(c3.body).toMatchObject({ ok: true, closed: 0, complete: true });
    expect(snapshotOfStore(seeded, 'mandates/').replace(/"lease[^}]*}/g, '').replace(/"lastCloseAttemptAt":"[^"]*"/g, '')).toBe(before);
  });

  it("mode 'off': the idea book is NOT closed — not by its own close, and never by closeBook — and the sweep still completes", async () => {
    const db = makeMandateFakeDb({ 'mandates/q1': quarterlyBook() });
    const { bookId, ideaId } = await populatedIdeaBook(db);
    setPracticeFieldModeForTests(null);
    const ideaBefore = JSON.stringify(getIdea(db, bookId, ideaId));
    const positionsBefore = JSON.stringify(getBook(db, bookId).portfolio);
    const first = await closeOnce(db, DAYS.d1);
    expect(first).toMatchObject({ ok: true, closed: 1, errors: 0 }); // the quarterly book
    expect(first).not.toHaveProperty('ideaBooksClosed');
    const second = await closeOnce(db, DAYS.d1);
    expect(second).toMatchObject({ ok: true, closed: 0, complete: true });
    const book = getBook(db, bookId);
    expect(JSON.stringify(book.portfolio)).toBe(positionsBefore);
    expect(JSON.stringify(getIdea(db, bookId, ideaId))).toBe(ideaBefore);
    expect(book.execState.lastCloseKey).toBeNull();
    expect(book.revision).toBe(2);
    expect(book.health.lastCloseAttemptAt).toBeInstanceOf(Date); // rotated behind the frontier
    expect(countDocs(db, `mandates/${bookId}/dailyRows/`)).toBe(0);
    expect(Object.keys(db._get(`mandateUniverseSnapshots/${DAYS.d1}_close`).symbols)).not.toContain('XLK'); // its coverage was not built
  });

  it("mode 'off' with an idea book ALONE: an idle skip, completion and retention as with no book at all — the hidden book is not \"a book that appeared\"", async () => {
    const db = makeMandateFakeDb();
    const { bookId } = await populatedIdeaBook(db);
    setPracticeFieldModeForTests(null);
    const body = await closeOnce(db, DAYS.d1);
    expect(body).toMatchObject({ ok: true, reason: 'mandate_idle_skip', closed: 0, complete: true });
    expect(quotesSpy).not.toHaveBeenCalled();
    expect(db._get(`mandateUniverseSnapshots/${DAYS.d1}_close`)).toBeUndefined();
    expect(countDocs(db, `mandates/${bookId}/dailyRows/`)).toBe(0);
  });
});
