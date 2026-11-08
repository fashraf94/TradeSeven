// api/_utils/setupMenuLabels/tenant.test.js
//
// Slice 2 — the acquisition tenant (spec V2 §6; Correction B), with the shared store's
// getOrAcquireSnapshot doubled (its own protocol is proven by its own suites and, with this tenant on
// top, in test/rules/setupMenuLabelsTenant.rules.mjs). The state document is an in-memory
// transactional store whose commits can be lost, refused or delayed. A manual clock moves only when a
// row moves it, through the tenant's own `instrument.before` seam.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const flag = vi.hoisted(() => ({ on: true }));
const store = vi.hoisted(() => ({ impl: null, calls: [] }));
vi.mock('../../../src/config/setupMenuLabelsFlags.js', () => ({ get SETUP_MENU_LABELS_ENABLED() { return flag.on; } }));
vi.mock('../setupEvidence/index.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getOrAcquireSnapshot: async (args) => { store.calls.push(args); return store.impl(args); },
}));

const { runSetupMenuAcquisition, healthLineOf, HEALTH_LINE_PREFIX, previousSessionOf } = await import('./tenant.js');
const { makeMemoryDb } = await import('./__fixtures__/memoryDb.js');
const { normalizeState } = await import('./state.js');
const { snapshotIdOf } = await import('../setupEvidence/index.js');
const { describeRuleSet } = await import('../setupEvaluator/thresholds.js');
const C = await import('./constants.js');

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../../..');
const STATE_PATH = 'setupMenuLabelState/main';
const T0 = Date.parse('2026-09-09T13:00:00.000Z'); // 09:00 ET Wed → session Tue 2026-09-08
const SESSION = '2026-09-08';
const MIN = 60_000;
const ruleSet = describeRuleSet();
const idOf = (s) => snapshotIdOf({ session: SESSION, symbol: s, ruleSet });

const tf = (id, ownerId, hotBench, over = {}) => [`agentBattles/${id}`, {
  ownerId, status: 'active', gameMode: 'baggerbomb_agent', agentId: `agent-${id}`, agentContext: { archetype: 'momentum_chaser' }, watchlist: { hotBench }, ...over,
}];

const prevAllowlist = process.env.COCKPIT_ALLOWLIST_UIDS;
let logSpy;
beforeEach(() => {
  flag.on = true;
  process.env.COCKPIT_ALLOWLIST_UIDS = 'owner-1';
  store.calls = [];
  store.impl = async () => ({ status: 'final', snapshot: {} });
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  logSpy.mockRestore();
  if (prevAllowlist === undefined) delete process.env.COCKPIT_ALLOWLIST_UIDS; else process.env.COCKPIT_ALLOWLIST_UIDS = prevAllowlist;
});

/** One run on a manual clock. `at` is the tenant's start; `before(kind, clock)` may move the clock. */
async function run(db, { at = T0, handlerStartMs = at, before = null, fetchPayload } = {}) {
  const clock = { ms: at };
  const now = () => new Date(clock.ms);
  const r = await runSetupMenuAcquisition({ db, handlerStartMs, now, fetchPayload, instrument: { before: async (kind) => { if (before) await before(kind, clock); } } });
  return r;
}
const stateOf = (db) => normalizeState(db.read(STATE_PATH));

describe('the gate and the deadline', () => {
  it('flag off: skipped before any read; no health line', async () => {
    flag.on = false;
    const db = makeMemoryDb();
    expect(await run(db)).toEqual({ skipped: true });
    expect(db.__log.gets).toEqual([]);
    expect(db.__log.queries).toEqual([]);
    expect(logSpy).not.toHaveBeenCalled();
  });
  it('an empty allowlist: skipped', async () => {
    process.env.COCKPIT_ALLOWLIST_UIDS = ' , ';
    expect(await run(makeMemoryDb())).toEqual({ skipped: true });
  });
  it('4.5 14,999 ms to the deadline → no_budget, zero reads; 15,000 → it runs', async () => {
    const db = makeMemoryDb();
    expect(await run(db, { at: T0, handlerStartMs: T0 - (C.TENANT_ADMISSION_CEILING_MS - 14_999) })).toEqual({ deferred: 'no_budget' });
    expect(db.__log.gets).toEqual([]);
    const r = await run(db, { at: T0, handlerStartMs: T0 - (C.TENANT_ADMISSION_CEILING_MS - 15_000) });
    expect(r.state).toBe('absent');
  });
});

describe('a key\'s whole unit: reserve → recheck → store → complete', () => {
  it('a final with no fetch is a cache hit: one reservation, one store call, ZERO provider requests (B-12)', async () => {
    const db = makeMemoryDb({ docs: Object.fromEntries([tf('b1', 'owner-1', ['AAPL'])]) });
    const r = await run(db);
    expect(r).toMatchObject({ reservations: 1, storeCalls: 1, providerRequests: 0, finalHits: 1, store: { final: 1 } });
    expect(stateOf(db).attempts[idOf('AAPL')]).toMatchObject({ n: 1, done: true, lastOutcome: 'final', activeToken: null });
  });
  it('a store call that reaches the fetch counts one provider request; the store gets the tenant\'s host and the injected clock', async () => {
    const db = makeMemoryDb({ docs: Object.fromEntries([tf('b1', 'owner-1', ['AAPL'])]) });
    store.impl = async ({ fetchPayload }) => { await fetchPayload('AAPL', {}); return { status: 'retryable', reason: 'insufficient_history' }; };
    const fetchPayload = vi.fn(async () => []);
    const r = await run(db, { fetchPayload });
    expect(r).toMatchObject({ reservations: 1, storeCalls: 1, providerRequests: 1, finalHits: 0, store: { retryable: 1 } });
    expect(fetchPayload).toHaveBeenCalledWith('AAPL', {});
    expect(store.calls[0]).toMatchObject({ session: SESSION, symbol: 'AAPL', host: C.TENANT_HOST });
    expect(stateOf(db).attempts[idOf('AAPL')]).toMatchObject({ n: 1, lastOutcome: 'retryable', lastReason: 'insufficient_history', dueAt: T0 + 31 * MIN });
  });
  it('pending (a live lease elsewhere) refunds the reservation and is due next run', async () => {
    const db = makeMemoryDb({ docs: Object.fromEntries([tf('b1', 'owner-1', ['AAPL'])]) });
    store.impl = async () => ({ status: 'pending' });
    const r = await run(db);
    expect(r.store.pending).toBe(1);
    expect(stateOf(db).attempts[idOf('AAPL')]).toMatchObject({ n: 0, lastOutcome: 'pending', dueAt: T0 + C.NEXT_RUN_MS });
  });
  it('a store throw is an outcome: counted, due next run, the reservation kept', async () => {
    const db = makeMemoryDb({ docs: Object.fromEntries([tf('b1', 'owner-1', ['AAPL'])]) });
    store.impl = async () => { throw Object.assign(new Error('x'), { code: 10 }); };
    const r = await run(db);
    expect(r.store.threw).toEqual({ 10: 1 });
    expect(stateOf(db).attempts[idOf('AAPL')]).toMatchObject({ n: 1, lastOutcome: 'threw', dueAt: T0 + C.NEXT_RUN_MS });
  });
});

describe('the review\'s counterexample, by schedule (rows 2.1–2.2)', () => {
  it('09:00:00 → resolves 09:00:05 confirm-class; 09:15 and 09:30 refuse not_due WITHOUT a reservation; 09:45 reserves and requests', async () => {
    const db = makeMemoryDb({ docs: Object.fromEntries([tf('b1', 'owner-1', ['AAPL'])]) });
    store.impl = async () => ({ status: 'retryable', reason: 'missing_fact' });
    await run(db, { before: async (kind, clock) => { if (kind === 'complete') clock.ms = T0 + 5_000; } });
    expect(stateOf(db).attempts[idOf('AAPL')].dueAt).toBe(T0 + 5_000 + 31 * MIN);
    for (const at of [T0 + 15 * MIN, T0 + 30 * MIN]) {
      const tx = db.__log.transactions;
      const r = await run(db, { at });
      expect(r.refused).toEqual({ not_due: 1 });
      expect(r.reserveTransactions).toBe(0);
      expect(db.__log.transactions - tx).toBe(1); // the end-of-run write only
    }
    const r = await run(db, { at: T0 + 45 * MIN });
    expect(r).toMatchObject({ reservations: 1, storeCalls: 1, retries: 1 });
    expect(store.calls.at(-1)).toMatchObject({ symbol: 'AAPL' });
  });
});

describe('Correction B — failed outcome writes and lost acknowledgements', () => {
  const oneKey = () => makeMemoryDb({ docs: Object.fromEntries([tf('b1', 'owner-1', ['AAPL'])]) });

  it('2.8 state unreadable: NO request, no reservation, no battle read', async () => {
    const db = oneKey();
    db.onGet(STATE_PATH, async () => { throw new Error('unavailable'); });
    const r = await run(db);
    expect(r).toMatchObject({ state: 'unreadable', deferred: { state_unreadable: 1 }, reservations: 0, storeCalls: 0 });
    expect(store.calls).toEqual([]);
    expect(db.__log.queries).toEqual([]);
  });
  it('SM1-1 a state document of another schema: NO request, no reservation, nothing written over it', async () => {
    const doc = { schemaVersion: 2, attempts: { [idOf('AAPL')]: { session: SESSION, n: 3 } } };
    const db = makeMemoryDb({ docs: Object.fromEntries([tf('b1', 'owner-1', ['AAPL']), [STATE_PATH, doc]]) });
    const r = await run(db);
    expect(r).toMatchObject({ state: 'unreadable', deferred: { state_unreadable: 1 }, reservations: 0, storeCalls: 0 });
    expect(store.calls).toEqual([]);
    expect(db.read(STATE_PATH)).toEqual(doc);
  });
  it('2.8 reservation refused by Firestore (commit did not land): no request; the token-checked cancel finds nothing', async () => {
    const db = oneKey();
    db.planTransactions('fail');
    const r = await run(db);
    expect(r).toMatchObject({ reserveFailed: 1, storeCalls: 0, cancelled: { uncertain_missing: 1 } });
    expect(store.calls).toEqual([]);
  });
  it('B-10 lost reservation acknowledgement (the commit landed): no request; the token-checked cancel refunds it exactly once', async () => {
    const db = oneKey();
    db.planTransactions('lost_ack');
    const r = await run(db);
    expect(r).toMatchObject({ reserveFailed: 1, storeCalls: 0, cancelled: { uncertain_applied: 1 } });
    expect(store.calls).toEqual([]);
    expect(stateOf(db).attempts[idOf('AAPL')]).toMatchObject({ n: 0, activeToken: null });
  });
  it('B-1 the SDK re-runs a reservation callback whose commit landed: counted once, the request made once', async () => {
    const db = oneKey();
    db.planTransactions('rerun');
    const r = await run(db);
    expect(r).toMatchObject({ reservations: 1, reservationReplays: 1, storeCalls: 1 });
    expect(stateOf(db).attempts[idOf('AAPL')].n).toBe(1);
  });
  it('B-9 admission lost during the reservation: a slow transaction ate the reserve → no store call, the reservation cancelled under its token', async () => {
    const db = oneKey();
    const deadline = T0 + C.TENANT_SLICE_MS;
    let clockRef = null;
    const base = db.runTransaction.bind(db);
    let first = true;
    // The reservation transaction itself is slow: it starts with time to spare and commits after the reserve is gone.
    db.runTransaction = async (cb) => { const r = await base(cb); if (first) { first = false; clockRef.ms = deadline - C.ADMISSION_RESERVE_MS + 1; } return r; };
    const r = await run(db, { before: async (_kind, clock) => { clockRef = clock; } });
    expect(r).toMatchObject({ reservations: 1, storeCalls: 0, cancelled: { admission_lost_applied: 1 } });
    expect(store.calls).toEqual([]);
    expect(stateOf(db).attempts[idOf('AAPL')]).toMatchObject({ n: 0, activeToken: null });
  });
  it('SM3-2 reservations queued behind a slow transaction never START past the reserve: refused admission_closed, no write, nothing to cancel', async () => {
    const db = makeMemoryDb({ docs: Object.fromEntries([tf('b1', 'owner-1', ['AAPL', 'MSFT', 'AMZN'])]) });
    const deadline = T0 + C.TENANT_SLICE_MS;
    let clockRef = null;
    const base = db.runTransaction.bind(db);
    let first = true;
    const starts = [];
    db.runTransaction = async (cb) => {
      starts.push(clockRef.ms - deadline);
      if (first) { first = false; const r = await base(cb); clockRef.ms = deadline + 1_000; return r; } // the first transaction is slow
      return base(cb);
    };
    const r = await run(db, { before: async (_kind, clock) => { clockRef = clock; } });
    expect(r.refused).toEqual({ admission_closed: 2 });
    expect(r).toMatchObject({ reservations: 1, storeCalls: 0, cancelled: { admission_lost_applied: 1 } });
    expect(starts.filter((d) => d > 0)).toHaveLength(1); // only the first unit's own cancel starts past the deadline
    expect(store.calls).toEqual([]);
    expect(Object.keys(stateOf(db).attempts)).toEqual([idOf('AAPL')]);
  });
  it('B-6 / 2.10 completed fetch, LOST outcome write: the reservation stands; +15 min recovers it with no request; +31 min after that it is requested again; the cap holds at 3', async () => {
    const db = oneKey();
    store.impl = async ({ fetchPayload }) => { await fetchPayload('AAPL', {}); return { status: 'retryable', reason: 'fetch_failed' }; };
    const fetchPayload = vi.fn(async () => { throw new Error('down'); });
    let at = T0;
    let fetches = 0;
    for (let round = 0; round < 6; round++) {
      db.planTransactions('commit', 'fail'); // the reservation commits; the outcome write fails
      const r = await run(db, { at, fetchPayload });
      fetches += r.providerRequests;
      at += 15 * MIN;
      const recovery = await run(db, { at, fetchPayload }); // the next run: recovery, no request
      expect(recovery.storeCalls).toBe(0);
      if (recovery.refused.recovered) expect(stateOf(db).attempts[idOf('AAPL')]).toMatchObject({ lastOutcome: 'unresolved', dueAt: at + C.RECOVERY_DUE_MS });
      at += C.RECOVERY_DUE_MS;
    }
    expect(stateOf(db).attempts[idOf('AAPL')].n).toBe(3);
    expect(fetches).toBe(3);
  });
  it('B-5 crash after reservation (the run dies before any outcome): the next run inside 120 s sees it in flight; after, recovery — never an immediate retry', async () => {
    const db = oneKey();
    store.impl = () => new Promise(() => {}); // the call never returns: the invocation is killed
    void run(db);
    await new Promise((r) => setTimeout(r, 20));
    store.impl = async () => ({ status: 'final', snapshot: {} });
    const soon = await run(db, { at: T0 + 60_000 });
    expect(soon.refused).toEqual({ in_flight: 1 });
    const later = await run(db, { at: T0 + 15 * MIN });
    expect(later.refused).toEqual({ recovered: 1 });
    expect(later.storeCalls).toBe(0);
    expect(store.calls).toHaveLength(1);
  });
});

describe('the run\'s limits (rows 4.3, 4.4, 4.6, 4.7)', () => {
  it('≤ 12 store calls a run, ≤ 3 at once; the rest not reached', async () => {
    const hot = Array.from({ length: 20 }, (_, i) => `K${i}`);
    const db = makeMemoryDb({ docs: Object.fromEntries([tf('b1', 'owner-1', hot)]) });
    let live = 0; let peak = 0;
    store.impl = async () => { live += 1; peak = Math.max(peak, live); await new Promise((r) => setTimeout(r, 2)); live -= 1; return { status: 'final', snapshot: {} }; };
    const r = await run(db);
    expect(r.storeCalls).toBe(C.MAX_ACQUISITIONS_PER_RUN);
    expect(peak).toBeLessThanOrEqual(C.ACQUISITION_CONCURRENCY);
    expect(r.deferred.not_reached).toBe(20 - C.MAX_ACQUISITIONS_PER_RUN);
  });
  it('slow reservations: units still deciding count toward the call cap — exactly 12 reservations, none reserved and then cancelled for the cap (mutant SMX-B11)', async () => {
    const hot = Array.from({ length: 20 }, (_, i) => `K${i}`);
    const db = makeMemoryDb({ docs: Object.fromEntries([tf('b1', 'owner-1', hot)]) });
    const base = db.runTransaction.bind(db);
    db.runTransaction = async (cb) => { await new Promise((r) => setTimeout(r, 3)); return base(cb); }; // every transaction is slow
    // One long store call breaks the three slots' lock-step, so units are still deciding when the cap is near.
    store.impl = async ({ symbol }) => { if (symbol === 'K0') await new Promise((r) => setTimeout(r, 40)); return { status: 'final', snapshot: {} }; };
    const r = await run(db);
    expect(r.storeCalls).toBe(C.MAX_ACQUISITIONS_PER_RUN);
    expect(r.reserveTransactions).toBe(C.MAX_ACQUISITIONS_PER_RUN);
    expect(r.cancelled).toEqual({});
    expect(r.deferred.not_reached).toBe(20 - C.MAX_ACQUISITIONS_PER_RUN);
  });
  it('4.6 keys are taken in turn across battles: a battle with 40 names cannot take the whole run', async () => {
    const big = Array.from({ length: 40 }, (_, i) => `B${i}`);
    const db = makeMemoryDb({ docs: Object.fromEntries([tf('b1', 'owner-1', big), tf('b2', 'owner-1', ['X1', 'X2', 'X3'])]) });
    await run(db);
    const asked = store.calls.map((c) => c.symbol);
    expect(asked.slice(0, 6).sort()).toEqual(['B0', 'B1', 'B2', 'X1', 'X2', 'X3']);
  });
  it('4.6 owners rotate from the cursor; ≤ 10 battles per owner; other owners\' and out-of-scope battles are never kept', async () => {
    process.env.COCKPIT_ALLOWLIST_UIDS = 'owner-1,owner-2';
    const docs = [];
    for (let i = 0; i < 12; i++) docs.push(tf(`a${i}`, 'owner-1', [`A${i}`]));
    docs.push(tf('c0', 'owner-2', ['C0']), tf('x0', 'owner-2', ['X0'], { agentContext: { archetype: 'analyst' } }), tf('t0', 'owner-2', ['T0'], { gameMode: 'baggerbomb_tournament' }));
    const db = makeMemoryDb({ docs: Object.fromEntries(docs) });
    const r = await run(db);
    expect(r.battles).toMatchObject({ kept: 11 });
    expect(r.excluded).toEqual({ archetype: 1, game_mode: 1 });
    expect(stateOf(db).cursors.owners).toBe('owner-2');
    expect(db.__log.queries.map((q) => q.max)).toEqual([C.MAX_BATTLES_PER_OWNER_PER_RUN, C.MAX_BATTLES_PER_OWNER_PER_RUN]);
    expect(db.__log.queries[0].fields).toEqual([...C.BATTLE_FIELDS]);
    await run(db, { at: T0 + 15 * MIN });
    expect(db.__log.queries[2].filters).toContainEqual(['ownerId', '==', 'owner-1']); // rotated past owner-2
  });
  it('4.3 a battle query resolving at 7 s cuts preparation at 6 s; acquisition proceeds with the battles already read', async () => {
    process.env.COCKPIT_ALLOWLIST_UIDS = 'owner-1,owner-2';
    const db = makeMemoryDb({ docs: Object.fromEntries([tf('a', 'owner-1', ['AAPL']), tf('b', 'owner-2', ['MSFT'])]) });
    const r = await run(db, { before: async (kind, clock) => { if (kind === 'battles' && clock.ms === T0) clock.ms = T0 + 7_000; } });
    expect(r.deferred.prep_cut).toBe(1);
    expect(r.owners).toEqual({ queried: 1, unread: 1 });
    expect(store.calls.map((c) => c.symbol)).toEqual(['AAPL']);
  });
  it('4.4 a store call admitted with the reserve left runs 20 s: awaited to its end, counted, no race', async () => {
    const db = makeMemoryDb({ docs: Object.fromEntries([tf('b1', 'owner-1', ['AAPL'])]) });
    const deadline = T0 + C.TENANT_SLICE_MS;
    let ended = false;
    store.impl = async () => { await new Promise((r) => setTimeout(r, 5)); ended = true; return { status: 'final', snapshot: {} }; };
    const r = await run(db, {
      before: async (kind, clock) => {
        if (kind === 'reserve') clock.ms = deadline - C.ADMISSION_RESERVE_MS;
        if (kind === 'complete') clock.ms = deadline - C.ADMISSION_RESERVE_MS + 20_000;
      },
    });
    expect(ended).toBe(true);
    expect(r).toMatchObject({ storeCalls: 1, completion: { applied: 1 } });
    expect(r.deferred.state_write_skipped).toBe(1); // past the deadline: the end-of-run write waits for a later run
  });
  it('4.7 crypto and key-form names are counted and never requested; the counts keep reservations, store calls and provider requests apart', async () => {
    const db = makeMemoryDb({ docs: Object.fromEntries([tf('b1', 'owner-1', ['BTC', 'BRK.B', 'AAPL'])]) });
    const r = await run(db);
    expect(r.keys).toEqual({ wanted: 1, crypto: 1, symbolForm: 1 });
    for (const k of ['reservations', 'storeCalls', 'providerRequests', 'finalHits', 'retries', 'reserveFailed', 'reserveTransactions']) expect(r).toHaveProperty(k);
    expect(store.calls.map((c) => c.symbol)).toEqual(['AAPL']);
  });
});

describe('isolation, the health line, the callers (rows 4.8, A1.1, A4.1)', () => {
  it('4.8 the health line carries literal keys only: no owner, battle, symbol or snapshot id', async () => {
    const db = makeMemoryDb({ docs: Object.fromEntries([tf('battle-SENTINEL', 'owner-1', ['ZZSENT'])]) });
    store.impl = async () => { throw Object.assign(new Error('ZZSENT owner-1'), { code: 'ZZSENT-CODE' }); };
    await run(db);
    const line = logSpy.mock.calls.map((c) => c.join(' ')).find((l) => l.startsWith(HEALTH_LINE_PREFIX));
    expect(line).toBeTruthy();
    for (const needle of ['SENTINEL', 'ZZSENT', 'owner-1', SESSION, 'tf-setup']) expect(line).not.toContain(needle);
    expect(healthLineOf({ deferred: 'no_budget' })).toContain('"no_budget":1');
  });
  it('A4.1 never touches the observer\'s state', async () => {
    const db = makeMemoryDb({ docs: Object.fromEntries([tf('b1', 'owner-1', ['AAPL'])]) });
    db.onGet('activationObserverState/main', async () => { throw new Error('the observer state was read'); });
    await run(db);
    expect([...db.__log.gets, ...db.__log.sets].some((p) => p.startsWith('activationObserverState'))).toBe(false);
  });
  it('Correction B: the store call is never inside a transaction callback — every serialised transaction is a state.js transition, and state.js never names the store', () => {
    const src = readFileSync(join(HERE, 'tenant.js'), 'utf8').replace(/\r\n/g, '\n');
    const closures = [...src.matchAll(/serial\(\(\) => ([^\n]*)\)\);/g)].map((m) => m[1]);
    expect(closures.length).toBeGreaterThanOrEqual(4);
    for (const c of closures) {
      expect(c).toMatch(/^\(?(?:admissionHolds\(\) \? )?(reserveKey|completeKey|cancelKey|finishRun)\(/);
      expect(c).not.toMatch(/getOrAcquireSnapshot|fetchPayload|provider/);
    }
    expect(src).toMatch(/r = await getOrAcquireSnapshot\(\{ db, session, symbol, now, fetchPayload: countingFetch, host: TENANT_HOST \}\);/);
    const state = readFileSync(join(HERE, 'state.js'), 'utf8');
    expect(state).not.toMatch(/getOrAcquireSnapshot|setupEvidence\/|fetchPayload/);
  });
  it('previousSessionOf: the calendar\'s own previous session', () => {
    expect(previousSessionOf('2026-09-08')).toBe('2026-09-04'); // Mon 09-07 is Labor Day
    expect(previousSessionOf('nonsense')).toBeNull();
  });
  it('A1.1 the callers of getOrAcquireSnapshot (tests aside) are exactly the observer\'s tenant and this one; no script names it', () => {
    const walk = (rel, out = []) => {
      for (const e of readdirSync(join(REPO, rel), { withFileTypes: true })) {
        const p = `${rel}/${e.name}`;
        if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p, out); } else if (/\.(m?js|cjs|jsx|ts)$/.test(e.name)) out.push(p);
      }
      return out;
    };
    // Code only: block comments and whole-line comments stripped (a mention in prose is not a caller).
    const code = (f) => readFileSync(join(REPO, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).filter((l) => !l.trim().startsWith('//')).join('\n');
    const files = ['api', 'src', 'scripts', 'test'].flatMap((r) => walk(r));
    const named = files.filter((f) => /\bgetOrAcquireSnapshot\b/.test(code(f)));
    const callers = named.filter((f) => !/\.test\.|(^|\/)test\/|__fixtures__/.test(f) && !f.startsWith('api/_utils/setupEvidence/'));
    expect(callers.sort()).toEqual(['api/_utils/activationEvidence/tenant.js', 'api/_utils/setupMenuLabels/tenant.js']);
    expect(named.filter((f) => f.startsWith('scripts/') && !/\.test\./.test(f))).toEqual([]); // a census test's import pin names it; no script does
    expect(code('api/_utils/setupMenuLabels/reads.js')).not.toMatch(/getOrAcquireSnapshot/);
    // The row bites: a planted call in prose-free code is found.
    expect(/\bgetOrAcquireSnapshot\b/.test('const x = await getOrAcquireSnapshot({});')).toBe(true);
  });
});

// ---------------------------------------------------------------- correction round F2 (Astra's review of 4e99b1f8)
// MAX_BATTLES_PER_RUN is a READ allowance: every document a battle query returns counts, kept or excluded, and each
// owner's query asks only for min(10, what remains). The rows count the documents the queries actually RETURNED
// (a wrapper around the in-memory store), independently of the tenant's own `battles.read`, and check the two agree.
// "F2-excluded", "F2-eligible" and the two-owner control are Astra's supplied regression file
// (evidence/tenant.regression.test.js, SHA-256 ab7fbd40…), adapted; the rotation and short-page rows are this round's.
describe('F2 — the battle read allowance counts every returned document', () => {
  /** The memory store, with every agentBattles query's returned page counted. */
  function countingDb(base) {
    const pages = [];
    const wrap = (q) => ({
      where: (...a) => wrap(q.where(...a)),
      select: (...a) => wrap(q.select(...a)),
      limit: (n) => wrap(q.limit(n)),
      get: async () => { const page = await q.get(); pages.push(page.docs.length); return page; },
    });
    const db = { ...base, collection: (name) => (name === 'agentBattles' ? wrap(base.collection(name)) : base.collection(name)) };
    return { db, pages, returned: () => pages.reduce((a, b) => a + b, 0) };
  }
  function ownersWith(perOwner, archetype = 'momentum_chaser') {
    const docs = {};
    for (const [owner, n] of Object.entries(perOwner)) {
      for (let i = 0; i < n; i++) docs[`agentBattles/${owner}-${i}`] = { ownerId: `owner-${owner}`, status: 'active', gameMode: 'baggerbomb_agent', agentId: `agent-${owner}-${i}`, agentContext: { archetype }, watchlist: { hotBench: [] } };
    }
    return makeMemoryDb({ docs });
  }
  const queriedOwners = (base) => base.__log.queries.filter((q) => q.col === 'agentBattles').map((q) => q.filters.find((f) => f[0] === 'ownerId')[2]);
  const maxes = (base) => base.__log.queries.filter((q) => q.col === 'agentBattles').map((q) => q.max);

  it('F2-excluded (Astra): four owners x ten EXCLUDED battles read 25 documents, not 40; the last query asks for 5', async () => {
    process.env.COCKPIT_ALLOWLIST_UIDS = 'owner-a,owner-b,owner-c,owner-d';
    const base = ownersWith({ a: 10, b: 10, c: 10, d: 10 }, 'analyst');
    const c = countingDb(base);
    const r = await run(c.db);
    expect(c.returned()).toBe(C.MAX_BATTLES_PER_RUN);
    expect(r.battles).toMatchObject({ read: C.MAX_BATTLES_PER_RUN, kept: 0 });
    expect(r.battles.read).toBe(c.returned()); // the reported count IS the documents returned
    expect(r.excluded).toEqual({ archetype: 25 });
    expect(maxes(base)).toEqual([10, 10, 5]);
    expect(r.owners).toEqual({ queried: 3, unread: 0 }); // owner-d: no query once the allowance is spent
  });
  it('F2-eligible (Astra): four owners x ten ELIGIBLE battles read 25 documents, not 30; the final query limit is 5', async () => {
    process.env.COCKPIT_ALLOWLIST_UIDS = 'owner-a,owner-b,owner-c,owner-d';
    const base = ownersWith({ a: 10, b: 10, c: 10, d: 10 });
    const c = countingDb(base);
    const r = await run(c.db);
    expect(c.returned()).toBe(C.MAX_BATTLES_PER_RUN);
    expect(r.battles).toMatchObject({ read: 25, kept: 25 });
    expect(maxes(base)).toEqual([10, 10, 5]);
    expect(c.pages).toEqual([10, 10, 5]);
  });
  it('control (Astra): two eligible owners fit the allowance: 20 read, 20 kept, both queries at 10', async () => {
    process.env.COCKPIT_ALLOWLIST_UIDS = 'owner-a,owner-b';
    const base = ownersWith({ a: 10, b: 10 });
    const c = countingDb(base);
    const r = await run(c.db);
    expect(c.returned()).toBe(20);
    expect(r.battles).toMatchObject({ read: 20, kept: 20 });
    expect(maxes(base)).toEqual([10, 10]);
  });
  it('a short page leaves its remainder to later owners: 3 + 10 + 10 + 2 = 25 read', async () => {
    process.env.COCKPIT_ALLOWLIST_UIDS = 'owner-a,owner-b,owner-c,owner-d';
    const base = ownersWith({ a: 3, b: 10, c: 10, d: 10 });
    const c = countingDb(base);
    const r = await run(c.db);
    expect(maxes(base)).toEqual([10, 10, 10, 2]);
    expect(c.pages).toEqual([3, 10, 10, 2]);
    expect(r.battles).toMatchObject({ read: 25, kept: 25 });
  });
  it('owner rotation is kept: the cursor stops at the last owner queried and the next run starts after it', async () => {
    process.env.COCKPIT_ALLOWLIST_UIDS = 'owner-a,owner-b,owner-c,owner-d';
    const base = ownersWith({ a: 10, b: 10, c: 10, d: 10 }, 'analyst');
    await run(base);
    expect(queriedOwners(base)).toEqual(['owner-a', 'owner-b', 'owner-c']);
    expect(stateOf(base).cursors.owners).toBe('owner-c');
    await run(base, { at: T0 + 15 * MIN });
    expect(queriedOwners(base).slice(3)).toEqual(['owner-d', 'owner-a', 'owner-b']);
    expect(maxes(base).slice(3)).toEqual([10, 10, 5]);
  });
});
