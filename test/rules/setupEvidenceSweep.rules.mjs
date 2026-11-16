// test/rules/setupEvidenceSweep.rules.mjs
//
// The chart's evidence, PR B (spec docs/specs/CHART_EVIDENCE_SPEC_V1.md SW-2, SW-4) — THE DAILY SWEEP
// AGAINST THE REAL FIRESTORE EMULATOR, through the Admin SDK as in production, with the real shared
// store underneath: the counter on real transactions (the 400th request is the last; two overlapping
// runs never pass the cap together; the count survives a run that died), the store's lease keeping two
// runs off one name, and a full 228-name run's time on one state document. Not a security-rules test:
// it rides the emulator runner, `npm run test:rules` (firebase emulators:exec sets
// FIRESTORE_EMULATOR_HOST), outside the default suite (no `.test.` in the name). The
// setupMenuLabelsTenant.rules.mjs precedent.
//
// The provider is injected and counted; the clock is virtual. The flag module is mocked ON. Each row
// clears the database.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the sweep, its state module and the store are imported
// unmocked; only the flag module is replaced.

import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const flag = vi.hoisted(() => ({ on: true }));
vi.mock('../../src/config/setupEvidenceSweepFlags.js', () => ({ get SETUP_EVIDENCE_SWEEP_ENABLED() { return flag.on; } }));

const { runSetupEvidenceSweep } = await import('../../api/_utils/setupEvidenceSweep/sweep.js');
const C = await import('../../api/_utils/setupEvidenceSweep/constants.js');
const { pullbackRows } = await import('../../api/_utils/setupRead/__fixtures__/readRecords.js');
const { ALL_TICKERS } = await import('../../api/_utils/rankingConfig.js');

const PROJECT = 'demo-tradeseven-rules';
const SESSION = '2026-11-16';
const T0 = Date.parse('2026-11-16T22:30:00.000Z'); // Mon 5:30 PM ET
const NAMES = [...ALL_TICKERS].sort();
const STATE = `${C.STATE_COLLECTION}/${SESSION}`;

let app;
let db;
let host;

beforeAll(() => {
  host = process.env.FIRESTORE_EMULATOR_HOST || '';
  if (!/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(host)) throw new Error(`setupEvidenceSweep needs the local Firestore emulator (FIRESTORE_EMULATOR_HOST=${host || 'unset'}) — run npm run test:rules`);
  app = initializeApp({ projectId: PROJECT }, `setup-evidence-sweep-${Date.now()}`);
  db = getFirestore(app);
});
afterAll(async () => { if (app) await deleteApp(app); });
beforeEach(async () => {
  flag.on = true;
  const res = await fetch(`http://${host}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`could not clear the emulator: ${res.status}`);
});

/** A virtual clock and a counted provider: each request takes `stepMs` of virtual time. */
function harness({ at = T0, stepMs = 200 } = {}) {
  const h = { t: at, calls: [], lines: [] };
  h.now = () => new Date(h.t);
  h.fetchPayload = async (symbol, opts) => { h.calls.push(symbol); h.t += stepMs; return pullbackRows(opts.to); };
  h.run = (over = {}) => runSetupEvidenceSweep({ db, handlerStartMs: h.t, now: h.now, fetchPayload: h.fetchPayload, log: (l) => h.lines.push(l), ...over });
  return h;
}
const seedCounter = (n) => db.collection(C.STATE_COLLECTION).doc(SESSION).set({
  schemaVersion: 1, session: SESSION, providerRequests: n, runs: 1, firstRunAt: null, lastRunAt: null, completedAt: null, runMs: 0, latest: null, updatedAt: null,
});
const counter = async () => (await db.doc(STATE).get()).data()?.providerRequests;
const finals = async () => (await db.collection('setupEvidence').count().get()).data().count;

describe('the counter on real transactions (SW-4)', () => {
  it('with 396 counted, exactly four more requests are made: the 400th is the last, and the rest wait', async () => {
    await seedCounter(396);
    const h = harness();
    const r = await h.run({ symbols: NAMES.slice(0, 12) });
    expect(h.calls).toHaveLength(4);
    expect(await counter()).toBe(400);
    expect(await finals()).toBe(4);
    expect(r.deferred.cap).toBe(8);
    const again = harness({ at: T0 + 60 * 60_000 });
    await again.run({ symbols: NAMES.slice(0, 12) });
    expect(again.calls).toEqual([]);
    expect(await counter()).toBe(400);
  });

  it('two overlapping runs never pass the cap together, and the store\'s lease keeps them off one name', async () => {
    await seedCounter(394);
    const a = harness();
    const b = harness();
    const names = NAMES.slice(0, 20);
    await Promise.all([a.run({ symbols: names }), b.run({ symbols: names })]);
    const all = [...a.calls, ...b.calls];
    expect(all).toHaveLength(6);
    expect(new Set(all).size).toBe(6); // no name fetched twice
    expect(await counter()).toBe(400);
    expect(await finals()).toBe(6);
  });

  it('the count survives a run that died part way (a programming error after its first requests)', async () => {
    const h = harness();
    let n = 0;
    const dying = () => { n += 1; return n > 40 ? new Date(Date.parse('2026-11-16T15:00:00.000Z')) : new Date(h.t); }; // the clock falls back before the close
    let caught = null;
    try { await h.run({ symbols: NAMES.slice(0, 30), now: dying }); } catch (err) { caught = err; }
    expect(caught?.name).toBe('SetupEvidenceProgrammingError');
    const counted = await counter();
    expect(counted).toBe(h.calls.length);
    expect(counted).toBeGreaterThan(0);
    const next = harness({ at: T0 + 60 * 60_000 });
    await next.run({ symbols: NAMES.slice(0, 30) });
    expect(await counter()).toBe(counted + next.calls.length);
    expect(await finals()).toBe(30);
  });
});

describe('a full run of the 228 ranked stocks on one state document', () => {
  it('every name final, 228 requests counted one transaction each, and the time it took on the emulator', async () => {
    const h = harness({ stepMs: 100 });
    const wall = Date.now();
    const r = await h.run({ symbols: NAMES });
    const ms = Date.now() - wall;
    console.log(`[setupEvidenceSweep.rules] 228 names on the emulator: ${ms} ms wall, ${r.providerRequests} requests, ${r.storeCalls} store calls`);
    expect(r).toMatchObject({ names: 228, final: { measured: 228, refused: 0 }, providerRequests: 228, stateWritten: true });
    expect(await counter()).toBe(228);
    expect(await finals()).toBe(228);
    expect((await db.doc(STATE).get()).data()).toMatchObject({ runs: 1, completedAt: expect.any(String) });
  }, 120_000);
});
