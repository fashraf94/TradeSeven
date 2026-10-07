// api/_utils/hypothesisRecords/reviewPass.test.js
//
// Pilot P1a — THE REVIEW PASS (founder decision D2; acceptance rows 1 and 9):
// a due row, an unspecified row with a completed battle, an unspecified row
// with a live battle (skipped), a stale row (deleted, no transition), the
// budget cut-off, a failure counted and not thrown — plus the gate (flag off
// → zero reads; an owner off the allowlist → nothing but the row is read),
// the persisted cursor, and judged-once under a concurrent change.
//
// The store is the general optimistic double (api/_utils/__fixtures__/callsFirestore.js):
// every read, write and query is logged, transactions re-run on a moved read.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeCallsFirestore, stored } from '../__fixtures__/callsFirestore.js';

const flag = vi.hoisted(() => ({ on: true }));
vi.mock('../../../src/config/featureFlags.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, get HYPOTHESIS_RECORDS_ENABLED() { return flag.on; } };
});

const {
  runHypothesisReviewPass, armReviewRow, decideReview, reviewDeadline, normalizeReviewRow,
  REVIEW_PAGE, REVIEW_QUEUE_COLLECTION, REVIEW_STARVATION_MS,
} = await import('./reviewPass.js');

const OWNER = 'owner-1';
const NOW = Date.parse('2026-10-21T21:00:00Z');
const ENV = 'COCKPIT_ALLOWLIST_UIDS';
let savedEnv;

const versionPath = (wl, n = 1) => `watchlists/${wl}/hypothesisVersions/v${n}`;
const rowPath = (wl, n = 1) => `${REVIEW_QUEUE_COLLECTION}/${wl}:${n}`;
const version = (wl, over = {}) => ({
  version: 1, watchlistId: wl, userId: OWNER, statement: 'idea', horizonEnum: 'swing', contentHash: 'c'.repeat(64),
  status: 'activated', stateChangedAt: '2026-10-07T14:00:00.000Z', stateSource: 'deploy', stateReason: 'deployed',
  firstDeployedAt: '2026-10-07T14:00:00.000Z', reviewDueAt: '2026-10-21T20:00:00.000Z', successorVersion: null, ...over,
});
const row = (wl, over = {}) => ({ userId: OWNER, watchlistId: wl, version: 1, battleId: `b-${wl}`, dueAtMs: NOW - 60_000, armedAt: NOW - 86_400_000, ...over });

/** Seed versions, rows and battles by path. */
function store(docs) {
  return makeCallsFirestore({ docs });
}
const run = (db, over = {}) => runHypothesisReviewPass({ db, handlerStartMs: Date.now(), nowMs: NOW, ...over });
const hypothesisReads = (db) => db.__access.reads.filter((p) => /hypothesis|^watchlists\/|^agentBattles\//.test(p)).length;

beforeEach(() => {
  // The pass budgets against Date.now(); pin the wall clock to the pass's own instant.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  flag.on = true;
  savedEnv = process.env[ENV];
  process.env[ENV] = `${OWNER},owner-2`;
});
afterEach(() => {
  if (savedEnv === undefined) delete process.env[ENV]; else process.env[ENV] = savedEnv;
  vi.useRealTimers();
});

describe('the gate', () => {
  it('flag OFF → returns before ANY read: no query, no get, no write; the summary says so', async () => {
    flag.on = false;
    const db = store({ [rowPath('wl-a')]: row('wl-a'), [versionPath('wl-a')]: version('wl-a') });
    const res = await run(db);
    expect(res).toEqual({ skipped: 'disabled', reads: 0 });
    expect(db.__access.reads).toEqual([]);
    expect(db.__access.queries).toEqual([]);
    expect(db.__access.writes).toEqual([]);
    expect(stored(db, versionPath('wl-a')).status).toBe('activated');
  });
  it('an owner OFF the allowlist → the row is read and counted skippedOff; its version, battle and cursor are never touched', async () => {
    process.env[ENV] = 'someone-else';
    const db = store({ [rowPath('wl-a')]: row('wl-a'), [versionPath('wl-a')]: version('wl-a') });
    const res = await run(db);
    expect(res.skippedOff).toBe(1);
    expect(db.__access.reads).not.toContain(versionPath('wl-a'));
    expect(db.__access.writes).toEqual([]);
    expect(stored(db, rowPath('wl-a'))).not.toBeNull();
  });
  it('flag ON but NOBODY admitted (empty allowlist) → the gate is off for every owner: return before ANY read (review L2-2)', async () => {
    for (const v of ['', '  ,  ']) {
      process.env[ENV] = v;
      const db = store({ [rowPath('wl-a')]: row('wl-a'), [versionPath('wl-a')]: version('wl-a') });
      expect(await run(db)).toEqual({ skipped: 'disabled', reads: 0 });
      expect(db.__access).toEqual({ reads: [], writes: [], queries: [] });
    }
  });
  it('starved (less than the floor left in the handler) → no read at all', async () => {
    const db = store({ [rowPath('wl-a')]: row('wl-a'), [versionPath('wl-a')]: version('wl-a') });
    const res = await run(db, { handlerStartMs: Date.now() - 50_000 + REVIEW_STARVATION_MS - 500 });
    expect(res.starved).toBe(true);
    expect(db.__access.queries).toEqual([]);
    expect(db.__access.reads).toEqual([]);
  });
  it('the deadline is min(now + 8 s, handlerStart + 50 s) — never past the cron\'s own budget', () => {
    expect(reviewDeadline({ nowMs: 1_000, handlerStartMs: 0 })).toBe(9_000);
    expect(reviewDeadline({ nowMs: 45_000, handlerStartMs: 0 })).toBe(50_000);
  });
});

describe('the transitions (acceptance row 9)', () => {
  it('a DUE row (dueAtMs <= now) on an activated version → review_due / horizon_elapsed / review_pass, row deleted, content untouched', async () => {
    const db = store({ [rowPath('wl-a')]: row('wl-a'), [versionPath('wl-a')]: version('wl-a') });
    const before = stored(db, versionPath('wl-a'));
    const res = await run(db);
    expect(res).toMatchObject({ horizonElapsed: 1, battleEnded: 0, failed: 0 });
    const after = stored(db, versionPath('wl-a'));
    expect(after).toEqual({ ...before, status: 'review_due', stateChangedAt: new Date(NOW).toISOString(), stateSource: 'review_pass', stateReason: 'horizon_elapsed' });
    expect(stored(db, rowPath('wl-a'))).toBeNull();
  });
  it('a row NOT yet due is never returned by the due query and stays armed', async () => {
    const db = store({ [rowPath('wl-a')]: row('wl-a', { dueAtMs: NOW + 60_000 }), [versionPath('wl-a')]: version('wl-a') });
    await run(db);
    expect(stored(db, versionPath('wl-a')).status).toBe('activated');
    expect(stored(db, rowPath('wl-a'))).not.toBeNull();
  });
  it('an UNSPECIFIED row whose battle COMPLETED → review_due / battle_ended, row deleted', async () => {
    const db = store({
      [rowPath('wl-u')]: row('wl-u', { dueAtMs: null }),
      [versionPath('wl-u')]: version('wl-u', { horizonEnum: 'unspecified', reviewDueAt: null }),
      'agentBattles/b-wl-u': { status: 'completed', ownerId: OWNER },
    });
    const res = await run(db);
    expect(res.battleEnded).toBe(1);
    expect(stored(db, versionPath('wl-u'))).toMatchObject({ status: 'review_due', stateReason: 'battle_ended', stateSource: 'review_pass' });
    expect(stored(db, rowPath('wl-u'))).toBeNull();
  });
  it('an UNSPECIFIED row whose battle is LIVE → skipped (battleLive), nothing written, row kept', async () => {
    const db = store({
      [rowPath('wl-u')]: row('wl-u', { dueAtMs: null }),
      [versionPath('wl-u')]: version('wl-u', { horizonEnum: 'unspecified' }),
      'agentBattles/b-wl-u': { status: 'active', ownerId: OWNER },
    });
    const res = await run(db);
    expect(res).toMatchObject({ battleLive: 1, battleEnded: 0 });
    expect(stored(db, versionPath('wl-u')).status).toBe('activated');
    expect(stored(db, rowPath('wl-u'))).not.toBeNull();
    expect(db.__access.writes).toEqual([]);
  });
  it('an UNSPECIFIED row whose battle document is MISSING → skipped (battleMissing): an ended battle is never assumed', async () => {
    const db = store({ [rowPath('wl-u')]: row('wl-u', { dueAtMs: null }), [versionPath('wl-u')]: version('wl-u') });
    const res = await run(db);
    expect(res.battleMissing).toBe(1);
    expect(stored(db, versionPath('wl-u')).status).toBe('activated');
  });
  it('a STALE row (the version is no longer activated) → deleted with NO transition — each non-activated status', async () => {
    for (const status of ['ready', 'review_due', 'invalidated', 'retired', 'cancelled']) {
      const db = store({ [rowPath('wl-s')]: row('wl-s'), [versionPath('wl-s')]: version('wl-s', { status, stateReason: 'x' }) });
      const before = stored(db, versionPath('wl-s'));
      const res = await run(db);
      expect(res).toMatchObject({ staleDeleted: 1, horizonElapsed: 0 });
      expect(stored(db, versionPath('wl-s'))).toEqual(before);
      expect(stored(db, rowPath('wl-s'))).toBeNull();
    }
  });
  it('a row whose version is GONE → deleted, nothing else written', async () => {
    const db = store({ [rowPath('wl-g')]: row('wl-g') });
    const res = await run(db);
    expect(res.staleDeleted).toBe(1);
    expect(db.__access.writes.map((w) => [w.op, w.path])).toEqual([['delete', rowPath('wl-g')]]);
  });
  it('a malformed row is counted and left alone (never acted on)', async () => {
    const db = store({ [rowPath('wl-m')]: { userId: OWNER, watchlistId: 'wl-m', version: 'one', battleId: 'b', dueAtMs: NOW - 1 } });
    const res = await run(db);
    expect(res.malformed).toBe(1);
    expect(db.__access.writes).toEqual([]);
  });
});

describe('judged once — fresh reads, compare-and-set on `activated`', () => {
  it('the version moved between the query and the transaction (a concurrent retire) → stale delete, no review_due', async () => {
    const db = store({ [rowPath('wl-a')]: row('wl-a'), [versionPath('wl-a')]: version('wl-a') });
    db.__hooks.afterQuery = async ({ collectionPath }) => {
      if (collectionPath !== REVIEW_QUEUE_COLLECTION) return;
      db.__docs.set(versionPath('wl-a'), { ...version('wl-a'), status: 'retired', stateReason: 'player_retired' });
      db.__hooks.afterQuery = null;
    };
    const res = await run(db);
    expect(res).toMatchObject({ staleDeleted: 1, horizonElapsed: 0 });
    expect(stored(db, versionPath('wl-a')).status).toBe('retired');
  });
  it('a competing commit between body and commit re-runs the body; the re-read decides', async () => {
    const db = store({ [rowPath('wl-a')]: row('wl-a'), [versionPath('wl-a')]: version('wl-a') });
    let fired = false;
    db.__hooks.afterTxBody = async () => {
      if (fired) return;
      fired = true;
      // A player retires the version after the pass read it — the pass's read set moved.
      await db.doc(versionPath('wl-a')).update({ status: 'retired', stateReason: 'player_retired' });
    };
    const res = await run(db);
    expect(db.__txAttempts).toBeGreaterThanOrEqual(2);
    expect(res).toMatchObject({ staleDeleted: 1, horizonElapsed: 0 });
    expect(stored(db, versionPath('wl-a')).status).toBe('retired');
  });
  it('two passes never transition twice: the second finds no row and writes nothing', async () => {
    const db = store({ [rowPath('wl-a')]: row('wl-a'), [versionPath('wl-a')]: version('wl-a') });
    await run(db);
    const writes = db.__access.writes.length;
    const second = await run(db);
    expect(second).toMatchObject({ rows: 0, horizonElapsed: 0 });
    expect(db.__access.writes.length).toBe(writes);
  });
});

describe('the due boundary and the ROW\'s fresh re-read (review L5-4, L5-5)', () => {
  it('dueAtMs === now is due — at the decision and at the query', async () => {
    const r = normalizeReviewRow(row('wl-a'));
    expect(decideReview({ row: r, version: { status: 'activated' }, nowMs: r.dueAtMs })).toEqual({ act: 'transition', reason: 'horizon_elapsed' });
    const db = store({ [rowPath('wl-a')]: row('wl-a', { dueAtMs: NOW }), [versionPath('wl-a')]: version('wl-a') });
    expect((await run(db)).horizonElapsed).toBe(1);
    expect(stored(db, versionPath('wl-a')).status).toBe('review_due');
  });
  it('a row RE-ARMED later between the query and the transaction is judged from its fresh read: not due, nothing written', async () => {
    const db = store({ [rowPath('wl-a')]: row('wl-a'), [versionPath('wl-a')]: version('wl-a') });
    db.__hooks.afterQuery = async ({ collectionPath }) => {
      if (collectionPath !== REVIEW_QUEUE_COLLECTION) return;
      db.__hooks.afterQuery = null;
      db.__docs.set(rowPath('wl-a'), row('wl-a', { dueAtMs: NOW + 3_600_000 }));
    };
    const res = await run(db);
    expect(res).toMatchObject({ notDue: 1, horizonElapsed: 0 });
    expect(stored(db, versionPath('wl-a')).status).toBe('activated');
    expect(stored(db, rowPath('wl-a'))).not.toBeNull();
  });
  it('a row CONSUMED between the query and the transaction is passed over silently — not counted malformed, nothing written', async () => {
    const db = store({ [rowPath('wl-a')]: row('wl-a'), [versionPath('wl-a')]: version('wl-a') });
    db.__hooks.afterQuery = async ({ collectionPath }) => {
      if (collectionPath !== REVIEW_QUEUE_COLLECTION) return;
      db.__hooks.afterQuery = null;
      db.__docs.delete(rowPath('wl-a'));
    };
    const res = await run(db);
    expect(res).toMatchObject({ malformed: 0, horizonElapsed: 0, staleDeleted: 0 });
    expect(db.__access.writes.filter((w) => w.path !== 'hypothesisReviewState/cursor')).toEqual([]);
  });
});

describe('the in-attempt deadline — UNCONFIRMED, never a late write (review L5-6)', () => {
  it('an attempt whose reads overran its slice writes nothing and is counted unconfirmed', async () => {
    const db = store({ [rowPath('wl-a')]: row('wl-a'), [versionPath('wl-a')]: version('wl-a') });
    const orig = db.runTransaction.bind(db);
    db.runTransaction = (cb) => orig(async (tx) => {
      const getAll = tx.getAll;
      tx.getAll = async (...refs) => { const out = await getAll(...refs); vi.setSystemTime(Date.now() + 2_000); return out; };
      return cb(tx);
    });
    const res = await run(db);
    expect(res).toMatchObject({ unconfirmed: 1, horizonElapsed: 0 });
    expect(stored(db, versionPath('wl-a')).status).toBe('activated');
    expect(stored(db, rowPath('wl-a'))).not.toBeNull();
  });
  it('an attempt that STARTS past its deadline reads nothing of the version', async () => {
    const db = store({ [rowPath('wl-a')]: row('wl-a'), [versionPath('wl-a')]: version('wl-a') });
    const orig = db.runTransaction.bind(db);
    db.runTransaction = (cb) => { vi.setSystemTime(Date.now() + 2_000); return orig(cb); };
    const res = await run(db);
    expect(res).toMatchObject({ unconfirmed: 1, horizonElapsed: 0 });
    expect(db.__access.reads).not.toContain(versionPath('wl-a'));
  });
});

describe('budget, failures and the cursor', () => {
  it('a FAILED transaction is counted, never thrown; the rest of the queue still runs and the failed row stays for the next tick', async () => {
    const db = store({
      [rowPath('wl-a')]: row('wl-a', { dueAtMs: NOW - 2 }), [versionPath('wl-a')]: version('wl-a'),
      [rowPath('wl-b')]: row('wl-b', { dueAtMs: NOW - 1 }), [versionPath('wl-b')]: version('wl-b'),
    });
    db.__hooks.beforeCommit = ({ writes }) => {
      if (writes.some((w) => w.path.includes('wl-a'))) throw new Error('injected commit failure');
    };
    const res = await run(db);
    expect(res).toMatchObject({ failed: 1, horizonElapsed: 1 });
    expect(stored(db, versionPath('wl-a')).status).toBe('activated');
    expect(stored(db, rowPath('wl-a'))).not.toBeNull();
    expect(stored(db, versionPath('wl-b')).status).toBe('review_due');
  });
  it('a query that throws ends the pass with `stopped`, never a throw', async () => {
    const db = store({ [rowPath('wl-a')]: row('wl-a') });
    db.__hooks.failQuery = new Error('index missing');
    const res = await run(db);
    expect(res.stopped).toBe('threw');
    expect(res.error).toContain('index missing');
  });
  it('BUDGET CUT-OFF: past the deadline mid-walk the pass stops; the rows after it are untouched and served next tick', async () => {
    const docs = {};
    for (const wl of ['wl-1', 'wl-2', 'wl-3']) {
      docs[rowPath(wl)] = row(wl, { dueAtMs: NOW - 10 + Number(wl.slice(-1)) });
      docs[versionPath(wl)] = version(wl);
    }
    const db = store(docs);
    db.__hooks.afterCommit = async ({ writes }) => {
      if (writes.some((w) => w.path === versionPath('wl-1'))) vi.setSystemTime(NOW + 60_000); // the deadline passes
    };
    const res = await run(db, { handlerStartMs: NOW });
    expect(res.cut).toBe(true);
    expect(res.horizonElapsed).toBe(1);
    expect(stored(db, versionPath('wl-2')).status).toBe('activated');
    expect(stored(db, rowPath('wl-2'))).not.toBeNull();
    expect(stored(db, rowPath('wl-3'))).not.toBeNull();
    // Next tick, with budget: the rest is served.
    vi.setSystemTime(NOW + 120_000);
    const next = await run(db, { handlerStartMs: Date.now(), nowMs: Date.now() });
    expect(next.horizonElapsed).toBe(2);
  });
  it('the unspecified phase pages from a PERSISTED { lastDocId } cursor: a cut run records where it stopped; the next resumes after it, then wraps', async () => {
    const docs = {};
    for (const wl of ['wl-a', 'wl-b', 'wl-c']) {
      docs[rowPath(wl)] = row(wl, { dueAtMs: null });
      docs[versionPath(wl)] = version(wl, { horizonEnum: 'unspecified' });
      docs[`agentBattles/b-${wl}`] = { status: 'active', ownerId: OWNER };
    }
    const db = store(docs);
    let seen = 0;
    db.__hooks.afterTxBody = async () => { seen += 1; if (seen === 2) vi.setSystemTime(NOW + 60_000); };
    const first = await run(db, { handlerStartMs: NOW });
    expect(first).toMatchObject({ cut: true, battleLive: 2, cursorAfter: 'wl-b:1' });
    expect(stored(db, 'hypothesisReviewState/cursor')).toMatchObject({ lastDocId: 'wl-b:1' });

    db.__hooks.afterTxBody = null;
    vi.setSystemTime(NOW + 120_000);
    const second = await run(db, { handlerStartMs: Date.now(), nowMs: Date.now() });
    expect(second).toMatchObject({ cursorBefore: 'wl-b:1', battleLive: 1, cursorAfter: null, cut: false });
    expect(stored(db, 'hypothesisReviewState/cursor')).toMatchObject({ lastDocId: null });
  });
  it('rows the pass never consumes (an owner off the allowlist) do not starve the rows behind them: the DUE cursor persists and the next tick resumes after them (review L2-2)', async () => {
    const docs = {};
    for (let i = 0; i < REVIEW_PAGE + 5; i++) {
      const wl = `wl-off-${String(i).padStart(2, '0')}`;
      docs[rowPath(wl)] = row(wl, { userId: 'delisted-owner', dueAtMs: NOW - 100_000 + i });
    }
    docs[rowPath('wl-live')] = row('wl-live', { dueAtMs: NOW - 1 });
    docs[versionPath('wl-live')] = version('wl-live');
    const db = store(docs);
    // Tick 1: the budget runs out after the first page of de-listed rows.
    let pages = 0;
    db.__hooks.afterQuery = async ({ collectionPath }) => {
      if (collectionPath === REVIEW_QUEUE_COLLECTION && ++pages === 2) vi.setSystemTime(NOW + 60_000);
    };
    const first = await run(db, { handlerStartMs: NOW });
    expect(first).toMatchObject({ cut: true, skippedOff: REVIEW_PAGE, horizonElapsed: 0 });
    expect(first.dueCursorAfter).toEqual({ dueAtMs: NOW - 100_000 + REVIEW_PAGE - 1, id: `wl-off-${String(REVIEW_PAGE - 1).padStart(2, '0')}:1` });
    expect(stored(db, 'hypothesisReviewState/cursor')).toMatchObject({ dueLastDocId: first.dueCursorAfter.id });
    // Tick 2: resumes AFTER them — the allowlisted row is reached and judged; the cursor wraps.
    db.__hooks.afterQuery = null;
    vi.setSystemTime(NOW + 900_000);
    const second = await run(db, { handlerStartMs: Date.now(), nowMs: Date.now() });
    expect(second).toMatchObject({ horizonElapsed: 1, skippedOff: 5, cut: false, dueCursorAfter: null });
    expect(stored(db, versionPath('wl-live')).status).toBe('review_due');
    // The de-listed rows are kept: re-listing the owner resumes their judged-once reviews.
    expect(Object.keys(Object.fromEntries([...db.__docs].filter(([p]) => p.startsWith(`${REVIEW_QUEUE_COLLECTION}/wl-off-`))))).toHaveLength(REVIEW_PAGE + 5);
  });
  it('the steady empty state writes nothing (no cursor churn)', async () => {
    const db = store({});
    const res = await run(db);
    expect(res).toMatchObject({ rows: 0, cut: false });
    expect(db.__access.writes).toEqual([]);
  });
  it('more than one page of due rows is walked within one invocation', async () => {
    const docs = {};
    for (let i = 0; i < REVIEW_PAGE + 5; i++) {
      const wl = `wl-${String(i).padStart(2, '0')}`;
      docs[rowPath(wl)] = row(wl, { dueAtMs: NOW - 1000 + i });
      docs[versionPath(wl)] = version(wl);
    }
    const db = store(docs);
    const res = await run(db);
    expect(res.horizonElapsed).toBe(REVIEW_PAGE + 5);
  });
});

describe('armReviewRow and the pure decision', () => {
  it('armReviewRow buffers ONE set of the queue shape on the caller\'s transaction; a malformed row throws', async () => {
    const db = store({});
    await db.runTransaction(async (tx) => {
      armReviewRow(tx, db, { userId: OWNER, watchlistId: 'wl-a', version: 2, battleId: 'b-1', dueAtMs: null, armedAt: NOW });
    });
    expect(stored(db, `${REVIEW_QUEUE_COLLECTION}/wl-a:2`)).toEqual({ userId: OWNER, watchlistId: 'wl-a', version: 2, battleId: 'b-1', dueAtMs: null, armedAt: NOW });
    await expect(db.runTransaction(async (tx) => {
      armReviewRow(tx, db, { userId: OWNER, watchlistId: 'wl-a', version: 0, battleId: 'b-1', dueAtMs: null, armedAt: NOW });
    })).rejects.toThrow(/armReviewRow/);
    await expect(db.runTransaction(async (tx) => {
      armReviewRow(tx, db, { userId: OWNER, watchlistId: 'wl-a', version: 1, battleId: 'b-1', dueAtMs: 'soon', armedAt: NOW });
    })).rejects.toThrow(/armReviewRow/);
  });
  it('normalizeReviewRow rejects an unusable identity', () => {
    expect(normalizeReviewRow(row('wl-a'))).not.toBeNull();
    for (const bad of [null, {}, { ...row('wl-a'), userId: '' }, { ...row('wl-a'), version: 1.5 }, { ...row('wl-a'), dueAtMs: NaN }, { ...row('wl-a'), battleId: null }]) {
      expect(normalizeReviewRow(bad)).toBeNull();
    }
  });
  it('decideReview: activated + due → horizon_elapsed; activated + unspecified + terminal battle → battle_ended; else skip or stale', () => {
    const r = normalizeReviewRow(row('wl-a'));
    const u = normalizeReviewRow(row('wl-a', { dueAtMs: null }));
    expect(decideReview({ row: r, version: { status: 'activated' }, nowMs: NOW })).toEqual({ act: 'transition', reason: 'horizon_elapsed' });
    expect(decideReview({ row: r, version: { status: 'activated' }, nowMs: r.dueAtMs - 1 })).toEqual({ act: 'skip', why: 'not_due' });
    expect(decideReview({ row: u, version: { status: 'activated' }, battle: { status: 'completed' }, nowMs: NOW })).toEqual({ act: 'transition', reason: 'battle_ended' });
    expect(decideReview({ row: u, version: { status: 'activated' }, battle: { status: 'expired' }, nowMs: NOW })).toEqual({ act: 'transition', reason: 'battle_ended' });
    expect(decideReview({ row: u, version: { status: 'activated' }, battle: { status: 'active' }, nowMs: NOW })).toEqual({ act: 'skip', why: 'battle_live' });
    expect(decideReview({ row: u, version: { status: 'activated' }, battle: null, nowMs: NOW })).toEqual({ act: 'skip', why: 'battle_missing' });
    expect(decideReview({ row: r, version: { status: 'ready' }, nowMs: NOW })).toEqual({ act: 'delete_stale' });
    expect(decideReview({ row: r, version: null, nowMs: NOW })).toEqual({ act: 'delete_stale' });
  });
});
