// test/rules/setupMenuLabelsTenant.rules.mjs
//
// Measured Trend Evidence Slice 2 (spec V2 §6; the kickoff's Correction B) — THE ACQUISITION TENANT
// AGAINST THE REAL FIRESTORE EMULATOR, through the Admin SDK as in production, with the real shared
// store (setupEvidence/) underneath: the reservation protocol on real transactions, the store's own
// confirmation rule, the cap under overlapping invocations, and the shared-key double fetch. Not a
// security-rules test: it rides the emulator runner, `npm run test:rules` (firebase emulators:exec sets
// FIRESTORE_EMULATOR_HOST), outside the default suite (no `.test.` in the name). The
// activationObserver.rules.mjs precedent.
//
// The provider is injected (the store's `fetchPayload`, wrapped by the tenant's counter), the clock is
// virtual and moved by hand or by the provider (a response that takes 5 s moves it 5 s). The flag
// module is mocked ON; the allowlist is the real environment variable. Each row clears the database.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the tenant, its state module and the store are imported
// unmocked; only the flag module is replaced.

import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const flag = vi.hoisted(() => ({ on: true }));
vi.mock('../../src/config/setupMenuLabelsFlags.js', () => ({ get SETUP_MENU_LABELS_ENABLED() { return flag.on; } }));

const { runSetupMenuAcquisition } = await import('../../api/_utils/setupMenuLabels/tenant.js');
const { reserveKey, completeKey, finishRun, normalizeState } = await import('../../api/_utils/setupMenuLabels/state.js');
const C = await import('../../api/_utils/setupMenuLabels/constants.js');
const { getOrAcquireSnapshot, snapshotIdOf } = await import('../../api/_utils/setupEvidence/index.js');
const { describeRuleSet } = await import('../../api/_utils/setupEvaluator/thresholds.js');
const { upRows } = await import('../../api/_utils/setupMenuLabels/__fixtures__/menuSnapshots.js');

const PROJECT = 'demo-tradeseven-rules';
const ENV = 'COCKPIT_ALLOWLIST_UIDS';
const OWNER = 'sml-owner-1';
const SESSION = '2026-11-04'; // the last completed session at 09:00 ET on Thu 2026-11-05
const T0 = Date.parse('2026-11-05T14:00:00.000Z'); // 09:00:00 ET
const MIN = 60_000;
const RS = describeRuleSet();
const idOf = (symbol) => snapshotIdOf({ session: SESSION, symbol, ruleSet: RS });

let app;
let db;
let host;
let savedEnv;

beforeAll(() => {
  host = process.env.FIRESTORE_EMULATOR_HOST || '';
  if (!/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(host)) throw new Error(`setupMenuLabelsTenant needs the local Firestore emulator (FIRESTORE_EMULATOR_HOST=${host || 'unset'}) — run npm run test:rules`);
  app = initializeApp({ projectId: PROJECT }, `setup-menu-labels-${Date.now()}`);
  db = getFirestore(app);
  savedEnv = process.env[ENV];
});
afterAll(async () => {
  if (savedEnv === undefined) delete process.env[ENV]; else process.env[ENV] = savedEnv;
  if (app) await deleteApp(app);
});
beforeEach(async () => {
  flag.on = true;
  process.env[ENV] = OWNER;
  const res = await fetch(`http://${host}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`could not clear the emulator: ${res.status}`);
});

// ---------------------------------------------------------------- helpers

function clockAt(ms) {
  let t = ms;
  return { now: () => new Date(t), set: (v) => { t = v; }, advance: (d) => { t += d; }, ms: () => t };
}
async function seedBattle(id, hotBench) {
  await db.collection('agentBattles').doc(id).set({
    ownerId: OWNER, status: 'active', gameMode: 'baggerbomb_agent', agentId: `agent-${id}`, isCpu: false,
    agentContext: { archetype: 'momentum_chaser' }, watchlist: { hotBench },
  });
}
/** The provider: per symbol, the rows to answer with; each response takes `latencyMs` of virtual time. */
function provider(clock, bySymbol, { latencyMs = 0 } = {}) {
  const calls = [];
  const fetchPayload = async (symbol) => {
    calls.push({ symbol, at: clock.ms() });
    clock.advance(latencyMs);
    const rows = typeof bySymbol[symbol] === 'function' ? bySymbol[symbol]() : bySymbol[symbol];
    return structuredClone(rows ?? upRows(SESSION));
  };
  return { fetchPayload, calls };
}
const run = (clock, fetchPayload) => runSetupMenuAcquisition({ db, handlerStartMs: clock.ms(), now: clock.now, fetchPayload });
const stateOf = async () => normalizeState((await db.collection(C.STATE_COLLECTION).doc(C.STATE_DOC).get()).data());
const finalOf = async (symbol) => (await db.collection('setupEvidence').doc(idOf(symbol)).get()).data() ?? null;

// ---------------------------------------------------------------- rows

describe('2.1 the review\'s counterexample, with the real store', () => {
  it('09:00 request resolves 09:00:05 confirm-class; 09:15 and 09:30 refuse not_due with NO reservation; 09:45 requests ≥ 30 min after the observation and the store finalises', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await seedBattle('b1', ['IBM']);
    const clock = clockAt(T0);
    const p = provider(clock, { IBM: () => upRows(SESSION, 20) }, { latencyMs: 5_000 }); // insufficient_history: confirm-class
    const first = await run(clock, p.fetchPayload);
    expect(first).toMatchObject({ reservations: 1, storeCalls: 1, providerRequests: 1, store: { retryable: 1 } });
    const entry = (await stateOf()).attempts[idOf('IBM')];
    expect(entry).toMatchObject({ n: 1, lastOutcome: 'retryable', lastReason: 'insufficient_history', dueAt: T0 + 5_000 + 31 * MIN });
    for (const at of [T0 + 15 * MIN, T0 + 30 * MIN]) {
      clock.set(at);
      const r = await run(clock, p.fetchPayload);
      expect(r).toMatchObject({ refused: { not_due: 1 }, reservations: 0, storeCalls: 0, providerRequests: 0, reserveTransactions: 0 });
    }
    expect((await stateOf()).attempts[idOf('IBM')].n).toBe(1);
    clock.set(T0 + 45 * MIN);
    const third = await run(clock, p.fetchPayload);
    expect(third).toMatchObject({ reservations: 1, storeCalls: 1, providerRequests: 1, store: { final: 1 } });
    expect(p.calls.map((c) => c.at)).toEqual([T0, T0 + 45 * MIN]);
    expect(await finalOf('IBM')).toMatchObject({ status: 'refused', refusal: { reason: 'insufficient_history' } });
    expect((await stateOf()).attempts[idOf('IBM')]).toMatchObject({ n: 2, done: true, lastOutcome: 'final' });
    log.mockRestore();
  });
});

describe('2.3 a changed refusal detail restarts the store\'s 30 minutes; Slice 2\'s due time follows its own lastAt', () => {
  it('the second sample differs, the observation is replaced, the third at its due time finalises — a further retryable was legitimate', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await seedBattle('b1', ['IBM']);
    const clock = clockAt(T0);
    let bars = 20;
    const p = provider(clock, { IBM: () => upRows(SESSION, bars) }, { latencyMs: 1_000 });
    await run(clock, p.fetchPayload);
    const due1 = (await stateOf()).attempts[idOf('IBM')].dueAt;
    bars = 25; // a different detail of the same confirm-class reason
    clock.set(due1);
    const second = await run(clock, p.fetchPayload);
    expect(second.store).toMatchObject({ retryable: 1 });
    const e2 = (await stateOf()).attempts[idOf('IBM')];
    expect(e2.dueAt).toBe(e2.lastAt + 31 * MIN);
    expect(e2.lastAt).toBe(due1 + 1_000);
    clock.set(e2.dueAt);
    const third = await run(clock, p.fetchPayload);
    expect(third.store).toMatchObject({ final: 1 });
    expect((await stateOf()).attempts[idOf('IBM')]).toMatchObject({ n: 3, done: true });
    log.mockRestore();
  });
});

describe('2.6 / 4.2 the hard cap under overlapping invocations', () => {
  it('two concurrent runs on one state document: one reservation per key per lease window; no key ever gets a fourth reservation', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const hot = ['AAPL', 'MSFT', 'IBM'];
    await seedBattle('b1', hot);
    const clock = clockAt(T0);
    const p = provider(clock, Object.fromEntries(hot.map((s) => [s, () => upRows(SESSION, 20)]))); // all confirm-class: retried
    const [a, b] = await Promise.all([run(clock, p.fetchPayload), run(clock, p.fetchPayload)]);
    expect(a.reservations + b.reservations).toBe(hot.length);
    expect((a.refused.in_flight ?? 0) + (b.refused.in_flight ?? 0) + (a.refused.not_due ?? 0) + (b.refused.not_due ?? 0)).toBe(hot.length);
    expect(a.storeCalls).toBeLessThanOrEqual(C.MAX_ACQUISITIONS_PER_RUN);
    for (let round = 1; round <= 3; round++) { // with the first, four rounds: enough for a fourth reservation to appear if the cap leaked
      clock.advance(32 * MIN);
      await Promise.all([run(clock, p.fetchPayload), run(clock, p.fetchPayload), run(clock, p.fetchPayload)]);
    }
    const s = await stateOf();
    for (const sym of hot) expect(s.attempts[idOf(sym)].n).toBeLessThanOrEqual(C.MAX_RESERVATIONS_PER_KEY_PER_SESSION);
    log.mockRestore();
  }, 90_000);
});

describe('4.1 the shared-key double fetch', () => {
  it('the observer\'s call for K returns retryable (lease released); Slice 2\'s call for K in the same invocation reaches the fetch again — two requests, both counted', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await seedBattle('b1', ['AAPL']);
    const clock = clockAt(T0);
    const p = provider(clock, { AAPL: () => upRows(SESSION, 81).slice(1) }); // the newest session missing: retryable (transient)
    const observer = await getOrAcquireSnapshot({ db, session: SESSION, symbol: 'AAPL', now: clock.now, fetchPayload: p.fetchPayload, host: 'activation-observer' });
    expect(observer.status).toBe('retryable');
    const r = await run(clock, p.fetchPayload);
    expect(r).toMatchObject({ storeCalls: 1, providerRequests: 1, store: { retryable: 1 } });
    expect(p.calls).toHaveLength(2);
    log.mockRestore(); warn.mockRestore();
  });
});

describe('Correction B on real transactions', () => {
  it('a completed fetch whose outcome write is lost: recovered by the next run with no request; due 31 min after the recovery; never more than 3', async () => {
    const id = idOf('AAPL');
    const r1 = await reserveKey({ db, id, session: SESSION, token: 'tok-1', nowMs: T0 });
    expect(r1).toMatchObject({ status: 'reserved', n: 1 });
    // the fetch happened; the outcome transaction never ran (the invocation died)
    const seen = T0 + 15 * MIN;
    expect(await reserveKey({ db, id, session: SESSION, token: 'tok-2', nowMs: seen })).toEqual({ status: 'refused', reason: 'recovered' });
    expect((await stateOf()).attempts[id]).toMatchObject({ n: 1, lastOutcome: 'unresolved', dueAt: seen + C.RECOVERY_DUE_MS, activeToken: null });
    expect(await reserveKey({ db, id, session: SESSION, token: 'tok-3', nowMs: seen + 15 * MIN })).toEqual({ status: 'refused', reason: 'not_due' });
    expect(await completeKey({ db, id, token: 'tok-1', outcome: 'final', nowMs: seen + 16 * MIN })).toEqual({ status: 'stale' });
    expect(await reserveKey({ db, id, session: SESSION, token: 'tok-4', nowMs: seen + C.RECOVERY_DUE_MS })).toMatchObject({ status: 'reserved', n: 2 });
  });
  it('two transactions racing the same reservation token (a callback re-run): counted once', async () => {
    const id = idOf('MSFT');
    const results = await Promise.all([1, 2, 3].map(() => reserveKey({ db, id, session: SESSION, token: 'tok-same', nowMs: T0 })));
    expect(results.filter((r) => r.status === 'reserved').length).toBe(3);
    expect((await stateOf()).attempts[id].n).toBe(1);
  });
  it('overlapping session rollover: an older run\'s finish after a newer run\'s never deletes the newer session\'s counters', async () => {
    await reserveKey({ db, id: 'new-session-key', session: '2026-11-05', token: 'n', nowMs: T0 });
    await finishRun({ db, governed: { previous: '2026-11-04', current: '2026-11-05' }, ownersCursor: null, nowMs: T0 });
    await finishRun({ db, governed: { previous: '2026-11-03', current: '2026-11-04' }, ownersCursor: null, nowMs: T0 + 1 });
    const s = await stateOf();
    expect(s.governedSessions).toEqual({ previous: '2026-11-04', current: '2026-11-05' });
    expect(s.attempts['new-session-key']).toMatchObject({ n: 1 });
  });
  it('the state document\'s map keys are snapshot ids with dots, written whole by set(): they read back intact', async () => {
    await reserveKey({ db, id: idOf('AAPL'), session: SESSION, token: 't', nowMs: T0 });
    const raw = (await db.collection(C.STATE_COLLECTION).doc(C.STATE_DOC).get()).data();
    expect(Object.keys(raw.attempts)).toEqual([idOf('AAPL')]);
  });
});
