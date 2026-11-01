// test/rules/setupEvidenceStore.rules.mjs
//
// ID-1 Build 1 (shape note V1.5 §3) — THE STORE PROTOCOL AGAINST THE REAL FIRESTORE
// EMULATOR. Not a security-rules test: the claim, create and confirmation
// transactions, run through the Admin SDK as in production, so it rides the
// emulator runner, `npm run test:rules` (firebase emulators:exec sets
// FIRESTORE_EMULATOR_HOST), outside the default suite (no `.test.` in the name).
// The filmRoomCardReplayOwner.rules.mjs precedent.
//
// The provider is injected and the clock is a hand-moved function; nothing waits.
// Each row works under its own symbol and session; afterAll deletes what it wrote.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the REAL, unmocked import of the
// library is the runtime guard for its import graph here too. Never mock it.

import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { DocumentReference, getFirestore } from 'firebase-admin/firestore';
import { getOrAcquireSnapshot, parseSnapshotId, readSnapshot, SetupEvidenceProgrammingError, snapshotIdOf } from '../../api/_utils/setupEvidence/index.js';
import { claimSnapshot, createFinal, releaseClaimLease, settleConfirmation, CONFIRM_AFTER_MS, LEASE_MS } from '../../api/_utils/setupEvidence/store.js';
import { describeRuleSet } from '../../api/_utils/setupEvaluator/thresholds.js';
import { tradingDates } from '../../api/_utils/setupEvaluator/__fixtures__/syntheticBars.js';
import { getSessionForDate } from '../../api/_utils/marketSchedule.js';

const RUN = Date.now().toString(36).toUpperCase();
const SESSION = '2026-10-28';
const AFTER_CLOSE_MS = getSessionForDate(SESSION).closeMs + 3_600_000;
const RULE_SET = describeRuleSet();
const MINUTE = 60_000;

let app;
let db;
const written = [];
let rowNumber = 0;

beforeAll(() => {
  const host = process.env.FIRESTORE_EMULATOR_HOST || '';
  // only ever the local emulator
  if (!/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(host)) throw new Error(`setupEvidenceStore needs the local Firestore emulator (FIRESTORE_EMULATOR_HOST=${host || 'unset'}) — run npm run test:rules`);
  app = initializeApp({ projectId: 'demo-tradeseven-rules' }, `setup-evidence-store-${RUN}`);
  db = getFirestore(app);
});
afterAll(async () => {
  if (db) {
    for (const id of written) {
      await db.doc(`setupEvidence/${id}`).delete();
      await db.doc(`setupEvidenceClaims/${id}`).delete();
    }
  }
  if (app) await deleteApp(app);
});

/** A fresh symbol, so each row owns its key. */
function freshKey() {
  rowNumber += 1;
  const symbol = `T${RUN}${rowNumber}`;
  const id = snapshotIdOf({ session: SESSION, symbol, ruleSet: RULE_SET });
  written.push(id);
  return { symbol, id };
}

/** Raw `/eod/` rows, newest first, on real sessions. */
function rawRows(n = 80) {
  return tradingDates(n, SESSION).map((date, i) => {
    const close = 100 - 0.25 * i;
    return { date, open: close, high: close + 1.5, low: close - 1.5, close, adjusted_close: close, volume: 1_000_000 };
  });
}
/** A gap at bar `at`: an interior missing_bar. */
const gapAt = (at = 10) => { const rows = rawRows(); rows.splice(at, 1); return rows; };
/** Too few bars: insufficient_history, a confirm outcome. */
const shortRows = () => rawRows(54);
/** The raw close doubles behind bar 6 while the adjusted close carries through: a final basis_discontinuity. */
const splitRows = () => rawRows().map((r, i) => {
  const adjusted = 100 - 0.25 * i;
  const raw = i <= 6 ? adjusted : adjusted * 2;
  return { ...r, open: raw, high: raw + 1.5, low: raw - 1.5, close: raw, adjusted_close: adjusted };
});
/** One row changed, by index. */
const rowsWith = (at, patch) => { const rows = rawRows(); rows[at] = { ...rows[at], ...patch }; return rows; };

/** A clock the test moves by hand. */
function handClock(startMs = AFTER_CLOSE_MS) {
  let current = startMs;
  const now = () => new Date(current);
  now.set = (ms) => { current = ms; };
  now.ms = () => current;
  return now;
}

/** A provider answering each call from `answers` in turn; the last repeats. An Error answer is thrown. */
function provider(...answers) {
  let n = 0;
  return vi.fn(async () => {
    const answer = answers[Math.min(n, answers.length - 1)];
    n += 1;
    if (answer instanceof Error) throw answer;
    return typeof answer === 'function' ? answer() : answer;
  });
}

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
/** The instants of a settled fetch, for a direct settleConfirmation call. */
const acquiredAt = (now) => ({ requestStartedAtMs: now.ms(), fetchedAt: now().toISOString() });
/** A db whose first transaction runs `during` after its reads and before its commit. */
const pausing = (during) => {
  let first = true;
  return {
    collection: (name) => db.collection(name),
    runTransaction: (fn) => db.runTransaction(async (tx) => {
      const out = await fn(tx);
      if (first) { first = false; await during(); }
      return out;
    }),
  };
};

const call = (key, now, fetchPayload, extra = {}) => getOrAcquireSnapshot({ db, session: SESSION, symbol: key.symbol, now, fetchPayload, host: 'test-host', ...extra });
const finalDoc = async (key) => { const s = await db.doc(`setupEvidence/${key.id}`).get(); return s.exists ? s : null; };
const claimDoc = async (key) => (await db.doc(`setupEvidenceClaims/${key.id}`).get()).data();
const seedClaim = (key, data) => db.doc(`setupEvidenceClaims/${key.id}`).set(data);

describe('a first acquisition', () => {
  it('ok evidence: the final document as the contract lists it, read back whole, no fetch the second time', async () => {
    const key = freshKey();
    const now = handClock();
    const fetchPayload = provider(rawRows());
    const first = await call(key, now, fetchPayload);
    expect(first.status).toBe('final');
    const stored = (await finalDoc(key)).data();
    expect(stored).toEqual(first.snapshot);
    expect(stored).toMatchObject({
      key: { session: SESSION, symbol: key.symbol, ruleSet: { setupVersion: 'tf-setup-v1', thresholdsHash: '26f3f411b566', semanticsId: 'tf-setup-v1/sem-1' } },
      status: 'ok', asOf: SESSION, requestedAsOf: SESSION, refusal: null, source: 'eodhd_eod', evidenceClass: { bars: 'contemporaneous' },
      capturedAt: new Date(AFTER_CLOSE_MS).toISOString(), writer: { host: 'test-host', commit: null },
    });
    expect(stored.evidence.bars).toHaveLength(55);
    expect(stored.entry.checks.find((c) => c.id === 'regime_stack').lhs).toHaveLength(2); // an array inside a map inside an array stores

    const again = await call(key, now, fetchPayload);
    expect(again).toEqual({ status: 'final', snapshot: stored });
    expect(fetchPayload).toHaveBeenCalledTimes(1);
    expect(await readSnapshot({ db, session: SESSION, symbol: key.symbol, ruleSet: RULE_SET })).toEqual(stored);
    expect(fetchPayload).toHaveBeenCalledTimes(1);
  });
  it('the key in the document and in the id agree, parsed exactly', async () => {
    const key = freshKey();
    const { snapshot } = await call(key, handClock(), provider(rawRows()));
    expect(parseSnapshotId(key.id)).toEqual(snapshot.key);
  });
  it.each([
    ['a split step', splitRows, 'basis_discontinuity'],
    ['a bad price on a row older than the session', () => rowsWith(12, { low: 0 }), 'missing_fact'],
  ])('a final refusal on the first read, %s: stored as refused, with the evaluator\'s refusal and its schemaVersion', async (_label, payload, reason) => {
    const key = freshKey();
    const { status, snapshot } = await call(key, handClock(), provider(payload()));
    expect(status).toBe('final');
    expect(snapshot).toMatchObject({ schemaVersion: 1, status: 'refused', refusal: { reason, expected: SESSION } });
    expect((await finalDoc(key)).data()).toEqual(snapshot);
  });
  it('schemaVersion 1 is stored on an ok snapshot too', async () => {
    const key = freshKey();
    await call(key, handClock(), provider(rawRows()));
    expect((await finalDoc(key)).data().schemaVersion).toBe(1);
  });
  it('the lease is released and the attempt counted: the claim stays, for the census', async () => {
    const key = freshKey();
    const now = handClock();
    await call(key, now, provider(rawRows()));
    expect(await claimDoc(key)).toEqual({ lease: null, observation: null, attempts: 1, lastAttemptAt: now().toISOString() });
  });
  it('readSnapshot is read only: nothing there is null, and nothing is written', async () => {
    const key = freshKey();
    expect(await readSnapshot({ db, session: SESSION, symbol: key.symbol, ruleSet: RULE_SET })).toBeNull();
    expect(await finalDoc(key)).toBeNull();
    expect((await db.doc(`setupEvidenceClaims/${key.id}`).get()).exists).toBe(false);
  });
  it('a read under another rule set finds nothing: the key is the whole triple', async () => {
    const key = freshKey();
    await call(key, handClock(), provider(rawRows()));
    const other = { ...RULE_SET, semanticsId: 'tf-setup-v1/sem-2' };
    expect(await readSnapshot({ db, session: SESSION, symbol: key.symbol, ruleSet: other })).toBeNull();
  });
});

describe('two concurrent callers on one key', () => {
  it('one acquisition, one pending with no fetch, one immutable final document; a later read returns the winner with no fetch', async () => {
    const key = freshKey();
    const now = handClock();
    let answer;
    const held = new Promise((resolve) => { answer = resolve; });
    const fetchPayload = vi.fn(() => held);
    const first = call(key, now, fetchPayload);
    const second = call(key, now, fetchPayload);
    // Whichever lost the claim returns while the winner's fetch is still held open.
    const loser = await Promise.race([first, second]);
    expect(loser).toEqual({ status: 'pending' });
    answer(rawRows());
    const results = await Promise.all([first, second]);
    expect(results.map((r) => r.status).sort()).toEqual(['final', 'pending']);
    expect(fetchPayload).toHaveBeenCalledTimes(1);
    const stored = await finalDoc(key);
    const winner = results.find((r) => r.status === 'final').snapshot;
    expect(stored.data()).toEqual(winner);

    const later = provider(rawRows());
    expect(await call(key, now, later)).toEqual({ status: 'final', snapshot: winner });
    expect(later).not.toHaveBeenCalled();
    expect((await finalDoc(key)).updateTime.isEqual(stored.updateTime)).toBe(true);
  });
  it('five at once: still one fetch', async () => {
    const key = freshKey();
    const now = handClock();
    let answer;
    const held = new Promise((resolve) => { answer = resolve; });
    const fetchPayload = vi.fn(() => held);
    const calls = Array.from({ length: 5 }, () => call(key, now, fetchPayload));
    // Hold the fetch until all four have answered: no final exists yet, so each must say pending. Answer sooner and a
    // loser still retrying its transaction reads the final, which is correct and would blur the row.
    const returned = [];
    for (const c of calls) c.then((r) => returned.push(r));
    await vi.waitFor(() => expect(returned).toHaveLength(4), { timeout: 20_000, interval: 25 });
    answer(rawRows());
    const results = await Promise.all(calls);
    expect(results.map((r) => r.status).sort()).toEqual(['final', 'pending', 'pending', 'pending', 'pending']);
    expect(fetchPayload).toHaveBeenCalledTimes(1);
  });
  it('a caller who finds a live lease gets pending and takes nothing: no fetch, no attempt', async () => {
    const key = freshKey();
    const now = handClock();
    await claimSnapshot({ db, id: key.id, now, host: 'other' });
    const fetchPayload = provider(rawRows());
    now.set(now.ms() + LEASE_MS - 1);
    expect(await call(key, now, fetchPayload)).toEqual({ status: 'pending' });
    expect(fetchPayload).not.toHaveBeenCalled();
    expect((await claimDoc(key)).attempts).toBe(1);
  });
});

describe('lease expiry', () => {
  it('at 120 seconds a successor takes over; an unreadable or far-future lease is no lease', async () => {
    const key = freshKey();
    const now = handClock();
    await claimSnapshot({ db, id: key.id, now, host: 'old' });
    now.set(now.ms() + LEASE_MS);
    const fetchPayload = provider(rawRows());
    expect((await call(key, now, fetchPayload)).status).toBe('final');
    expect(fetchPayload).toHaveBeenCalledTimes(1);
    expect((await claimDoc(key)).attempts).toBe(2);

    for (const claimedAt of ['not a date', new Date(AFTER_CLOSE_MS + 10 * LEASE_MS).toISOString()]) {
      const other = freshKey();
      await seedClaim(other, { lease: { token: 'stale', claimedAt, host: 'x' }, observation: null, attempts: 3, lastAttemptAt: claimedAt });
      expect((await call(other, handClock(), provider(rawRows()))).status).toBe('final');
    }
  });
  it('a future lease, a neighbour\'s clock skew, is live to just under a full lease ahead', async () => {
    for (const aheadMs of [1_000, LEASE_MS - 1]) {
      const key = freshKey();
      const now = handClock();
      await seedClaim(key, { lease: { token: 'skewed', claimedAt: new Date(now.ms() + aheadMs).toISOString(), host: 'x' }, observation: null, attempts: 1, lastAttemptAt: 'x' });
      expect(await call(key, now, provider(rawRows()))).toEqual({ status: 'pending' });
    }
  });
  it('a takeover stamps a fresh lease: the next caller is pending, with no second fetch', async () => {
    const key = freshKey();
    const now = handClock();
    await claimSnapshot({ db, id: key.id, now, host: 'dead' });
    now.set(now.ms() + LEASE_MS);
    await claimSnapshot({ db, id: key.id, now, host: 'successor' });
    expect((await claimDoc(key)).lease.claimedAt).toBe(now().toISOString());
    const fetchPayload = provider(rawRows());
    expect(await call(key, now, fetchPayload)).toEqual({ status: 'pending' });
    expect(fetchPayload).not.toHaveBeenCalled();
  });
  it('the lease names the host while the fetch runs', async () => {
    const key = freshKey();
    let during;
    await call(key, handClock(), vi.fn(async () => { during = await claimDoc(key); return rawRows(); }));
    expect(during.lease.host).toBe('test-host');
  });
  it('a caller that names no host: the lease and the writer read null, and the write goes through', async () => {
    const key = freshKey();
    const { status, snapshot } = await getOrAcquireSnapshot({ db, session: SESSION, symbol: key.symbol, now: handClock(), fetchPayload: provider(rawRows()) });
    expect(status).toBe('final');
    expect(snapshot.writer.host).toBeNull();
  });
  it('the original worker\'s late release cannot touch its successor\'s lease or observation', async () => {
    const key = freshKey();
    const now = handClock();
    const old = await claimSnapshot({ db, id: key.id, now, host: 'old' });
    now.set(now.ms() + LEASE_MS);
    const successor = await claimSnapshot({ db, id: key.id, now, host: 'successor' });
    const observation = { reason: 'missing_bar', detailHash: 'abc', observedAt: now().toISOString() };
    await db.doc(`setupEvidenceClaims/${key.id}`).update({ observation });
    const before = await claimDoc(key);

    await releaseClaimLease({ db, id: key.id, token: old.token });
    expect(await claimDoc(key)).toEqual(before);
    expect(before.lease).toMatchObject({ token: successor.token, host: 'successor' });
    expect(before.lease.token).not.toBe(old.token);

    await releaseClaimLease({ db, id: key.id, token: successor.token });
    expect(await claimDoc(key)).toEqual({ ...before, lease: null });
  });
  it('a worker slower than its lease: its retryable outcome leaves the successor alone', async () => {
    const key = freshKey();
    const now = handClock();
    let successorLease;
    const fetchPayload = vi.fn(async () => {
      now.set(now.ms() + LEASE_MS);
      await claimSnapshot({ db, id: key.id, now, host: 'successor' });
      successorLease = await claimDoc(key);
      throw new Error('late failure');
    });
    expect(await call(key, now, fetchPayload)).toEqual({ status: 'retryable', reason: 'fetch_failed' });
    expect(await claimDoc(key)).toEqual(successorLease);
    expect(successorLease.lease.host).toBe('successor');
    expect(await finalDoc(key)).toBeNull();
  });
  it('a worker slower than its lease: its `confirm` outcome neither releases the lease nor writes the observation', async () => {
    const key = freshKey();
    const now = handClock();
    let successorState;
    const fetchPayload = vi.fn(async () => {
      now.set(now.ms() + LEASE_MS);
      await claimSnapshot({ db, id: key.id, now, host: 'successor' });
      successorState = await claimDoc(key);
      return gapAt();
    });
    expect(await call(key, now, fetchPayload)).toEqual({ status: 'retryable', reason: 'missing_bar' });
    expect(await claimDoc(key)).toEqual(successorState);
    expect(successorState.observation).toBeNull();
  });
  it('a worker slower than its lease: its final `create`, getting there first, is accepted, and the successor\'s lease stands until the successor reads the winner', async () => {
    const key = freshKey();
    const now = handClock();
    let successor;
    const fetchPayload = vi.fn(async () => {
      now.set(now.ms() + LEASE_MS);
      successor = await claimSnapshot({ db, id: key.id, now, host: 'successor' });
      return rawRows();
    });
    const { status, snapshot } = await call(key, now, fetchPayload);
    expect(status).toBe('final');
    expect((await finalDoc(key)).data()).toEqual(snapshot);
    expect((await claimDoc(key)).lease).toMatchObject({ token: successor.token, host: 'successor' });

    const own = { other: 'the successor\'s evidence, never stored' };
    expect(await createFinal({ db, id: key.id, token: successor.token, doc: own })).toEqual(snapshot);
    expect((await finalDoc(key)).data()).toEqual(snapshot);
    expect((await claimDoc(key)).lease).toBeNull();
  });
  it('otherwise it reads the winner: the successor finished first, and the late worker\'s evidence is discarded', async () => {
    const key = freshKey();
    const now = handClock();
    let winner;
    const fetchPayload = vi.fn(async () => {
      now.set(now.ms() + LEASE_MS);
      winner = await call(key, now, provider(rawRows()), { host: 'successor' });
      return shortRows(); // the late worker's own, different result
    });
    const late = await call(key, now, fetchPayload);
    expect(late).toEqual({ status: 'final', snapshot: winner.snapshot });
    expect((await finalDoc(key)).data()).toMatchObject({ status: 'ok', writer: { host: 'successor' } });
  });
  it('a `create` that loses after a stale read reads the winner too (ALREADY_EXISTS from the real backend), and releases our lease, which the failed commit could not', async () => {
    const key = freshKey();
    const winner = (await call(key, handClock(), provider(rawRows()))).snapshot;
    const held = (token) => seedClaim(key, { lease: { token, claimedAt: new Date(AFTER_CLOSE_MS).toISOString(), host: 'x' }, observation: { reason: 'missing_bar', detailHash: 'h', observedAt: new Date(AFTER_CLOSE_MS - CONFIRM_AFTER_MS).toISOString() }, attempts: 1, lastAttemptAt: 'x' });
    const stale = {
      collection: (name) => db.collection(name),
      runTransaction: (fn) => db.runTransaction((tx) => fn(new Proxy(tx, {
        get(target, prop) {
          if (prop !== 'get') return typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop];
          return async (ref) => { const snap = await target.get(ref); return ref.path.startsWith('setupEvidence/') ? { exists: false, data: () => undefined } : snap; };
        },
      }))),
    };
    await held('mine');
    expect(await createFinal({ db: stale, id: key.id, token: 'mine', doc: { other: true } })).toEqual(winner);
    expect((await claimDoc(key)).lease).toBeNull();
    const acquired = { requestStartedAtMs: AFTER_CLOSE_MS, fetchedAt: new Date(AFTER_CLOSE_MS).toISOString() };
    await held('mine');
    expect(await settleConfirmation({ db: stale, id: key.id, token: 'mine', reason: 'missing_bar', detailHash: 'h', acquired, doc: { other: true } })).toEqual({ status: 'final', snapshot: winner });
    expect((await claimDoc(key)).lease).toBeNull();
    await held('a successor');
    expect(await createFinal({ db: stale, id: key.id, token: 'mine', doc: { other: true } })).toEqual(winner);
    expect((await claimDoc(key)).lease.token).toBe('a successor');
    expect((await finalDoc(key)).data()).toEqual(winner);
  });
  it('a commit whose acknowledgement was lost: the re-run finds its own lease, claims, and counts one attempt', async () => {
    const key = freshKey();
    const now = handClock();
    const rerun = { collection: (name) => db.collection(name), runTransaction: async (fn) => { await db.runTransaction(fn); return db.runTransaction(fn); } };
    const claim = await claimSnapshot({ db: rerun, id: key.id, now, host: 'x' });
    expect(claim.status).toBe('claimed');
    expect(await claimDoc(key)).toMatchObject({ lease: { token: claim.token }, attempts: 1 });
  });
});

describe('every claim mutation is a token-checked transaction', () => {
  it('no read or write of either document outside a transaction', async () => {
    const key = freshKey();
    const now = handClock();
    const get = vi.spyOn(DocumentReference.prototype, 'get');
    const set = vi.spyOn(DocumentReference.prototype, 'set');
    try {
      const first = await claimSnapshot({ db, id: key.id, now, host: 'x' });
      await releaseClaimLease({ db, id: key.id, token: first.token });
      const second = await claimSnapshot({ db, id: key.id, now, host: 'x' });
      await settleConfirmation({ db, id: key.id, token: second.token, reason: 'missing_bar', detailHash: 'h', acquired: acquiredAt(now), doc: { who: 'x' } });
      const third = await claimSnapshot({ db, id: key.id, now, host: 'x' });
      await createFinal({ db, id: key.id, token: third.token, doc: { who: 'x' } });
      expect(get.mock.calls.length + set.mock.calls.length).toBe(0);
    } finally {
      get.mockRestore();
      set.mockRestore();
    }
  });
  it('a successor arriving between the old worker\'s read and commit keeps its lease: settling', async () => {
    const key = freshKey();
    const now = handClock();
    const old = await claimSnapshot({ db, id: key.id, now, host: 'old' });
    now.set(now.ms() + LEASE_MS);
    let successor;
    const during = async () => { successor = claimSnapshot({ db, id: key.id, now, host: 'successor' }); await sleep(600); };
    await settleConfirmation({ db: pausing(during), id: key.id, token: old.token, reason: 'missing_bar', detailHash: 'h', acquired: acquiredAt(now), doc: { who: 'old' } });
    const s = await successor;
    expect(s.status).toBe('claimed');
    expect(await claimDoc(key)).toMatchObject({ lease: { token: s.token }, attempts: 2 });
  }, 60_000);
  it('a successor arriving between the old worker\'s read and commit keeps its lease: creating', async () => {
    const key = freshKey();
    const now = handClock();
    const old = await claimSnapshot({ db, id: key.id, now, host: 'old' });
    now.set(now.ms() + LEASE_MS);
    let successor;
    const during = async () => { successor = claimSnapshot({ db, id: key.id, now, host: 'successor' }); await sleep(600); };
    await createFinal({ db: pausing(during), id: key.id, token: old.token, doc: { who: 'old' } });
    const s = await successor;
    const claim = await claimDoc(key);
    if (s.status === 'claimed') expect(claim).toMatchObject({ lease: { token: s.token }, attempts: 2 });
    else { expect(s.status).toBe('final'); expect(claim.lease).toBeNull(); }
  }, 60_000);
  it('a successor arriving between the release\'s read and its write keeps its lease', async () => {
    const key = freshKey();
    const now = handClock();
    const old = await claimSnapshot({ db, id: key.id, now, host: 'old' });
    now.set(now.ms() + LEASE_MS);
    // A release that stopped being a transaction reaches the plain set; the successor claims just ahead of it there.
    const plainSet = DocumentReference.prototype.set;
    let viaPlainSet;
    let successor;
    const spy = vi.spyOn(DocumentReference.prototype, 'set').mockImplementation(async function hooked(...args) {
      viaPlainSet = await claimSnapshot({ db, id: key.id, now, host: 'successor' });
      return plainSet.apply(this, args);
    });
    const during = async () => { successor = claimSnapshot({ db, id: key.id, now, host: 'successor' }); await sleep(600); };
    try {
      await releaseClaimLease({ db: pausing(during), id: key.id, token: old.token });
    } finally {
      spy.mockRestore();
    }
    const s = viaPlainSet ?? await successor;
    expect(s.status).toBe('claimed');
    expect(await claimDoc(key)).toMatchObject({ lease: { token: s.token }, attempts: 2 });
  }, 60_000);
  it('settling after a final, a successor holding the lease: the lease stands', async () => {
    const key = freshKey();
    const now = handClock();
    const old = await claimSnapshot({ db, id: key.id, now, host: 'old' });
    now.set(now.ms() + LEASE_MS);
    const successor = await claimSnapshot({ db, id: key.id, now, host: 'successor' });
    await db.doc(`setupEvidence/${key.id}`).create({ who: 'third' });
    const out = await settleConfirmation({ db, id: key.id, token: old.token, reason: 'missing_bar', detailHash: 'h', acquired: acquiredAt(now), doc: { who: 'old' } });
    expect(out).toEqual({ status: 'final', snapshot: { who: 'third' } });
    expect((await claimDoc(key)).lease.token).toBe(successor.token);
  });
  it('settling after a final, our own lease: released', async () => {
    const key = freshKey();
    const now = handClock();
    const own = await claimSnapshot({ db, id: key.id, now, host: 'own' });
    await db.doc(`setupEvidence/${key.id}`).create({ who: 'third' });
    await settleConfirmation({ db, id: key.id, token: own.token, reason: 'missing_bar', detailHash: 'h', acquired: acquiredAt(now), doc: { who: 'own' } });
    expect((await claimDoc(key)).lease).toBeNull();
  });
  it('an error other than ALREADY_EXISTS surfaces, even with a winner there; ALREADY_EXISTS with no winner surfaces too', async () => {
    const key = freshKey();
    const now = handClock();
    // Only the FIRST transaction fails, so the release a mistaken winner path would run cannot pass for the error.
    const failOnce = (code, message) => {
      let first = true;
      return {
        collection: (name) => db.collection(name),
        runTransaction: (fn) => {
          if (!first) return db.runTransaction(fn);
          first = false;
          return Promise.reject(Object.assign(new Error(message), { code }));
        },
      };
    };
    await expect(createFinal({ db: failOnce(6, 'exists but gone'), id: key.id, token: 't', doc: { who: 'x' } })).rejects.toThrow('exists but gone');
    await expect(settleConfirmation({ db: failOnce(6, 'exists but gone'), id: key.id, token: 't', reason: 'r', detailHash: 'h', acquired: acquiredAt(now), doc: { who: 'x' } })).rejects.toThrow('exists but gone');
    await db.doc(`setupEvidence/${key.id}`).create({ who: 'winner' });
    await expect(createFinal({ db: failOnce(13, 'commit failed'), id: key.id, token: 't', doc: { who: 'x' } })).rejects.toThrow('commit failed');
    await expect(settleConfirmation({ db: failOnce(13, 'commit failed'), id: key.id, token: 't', reason: 'r', detailHash: 'h', acquired: acquiredAt(now), doc: { who: 'x' } })).rejects.toThrow('commit failed');
  });
  it('the final document is created inside the transaction, never by a plain create', async () => {
    const key = freshKey();
    const other = freshKey();
    const now = handClock();
    const create = vi.spyOn(DocumentReference.prototype, 'create');
    try {
      const one = await claimSnapshot({ db, id: key.id, now, host: 'x' });
      await createFinal({ db, id: key.id, token: one.token, doc: { who: 'x' } });
      const two = await claimSnapshot({ db, id: other.id, now, host: 'x' });
      await settleConfirmation({ db, id: other.id, token: two.token, reason: 'r', detailHash: 'h', acquired: acquiredAt(now), doc: { who: 'x' } });
      now.set(now.ms() + CONFIRM_AFTER_MS);
      const three = await claimSnapshot({ db, id: other.id, now, host: 'x' });
      await settleConfirmation({ db, id: other.id, token: three.token, reason: 'r', detailHash: 'h', acquired: acquiredAt(now), doc: { who: 'x' } });
      expect((await finalDoc(key)) && (await finalDoc(other))).toBeTruthy();
      expect(create).not.toHaveBeenCalled();
    } finally {
      create.mockRestore();
    }
  });
  it('a release of a claim that does not exist does nothing and does not throw', async () => {
    const key = freshKey();
    await expect(releaseClaimLease({ db, id: key.id, token: 't' })).resolves.toBeUndefined();
    expect((await db.doc(`setupEvidenceClaims/${key.id}`).get()).exists).toBe(false);
  });
  it('createFinal with no claim document still creates', async () => {
    const key = freshKey();
    expect(await createFinal({ db, id: key.id, token: 't', doc: { who: 'x' } })).toEqual({ who: 'x' });
    expect(await finalDoc(key)).not.toBeNull();
    expect((await db.doc(`setupEvidenceClaims/${key.id}`).get()).exists).toBe(false);
  });
  it('a transaction that is retried reads the clock again: the stamp is the attempt that committed', async () => {
    const key = freshKey();
    const now = handClock();
    const retried = {
      collection: (name) => db.collection(name),
      runTransaction: async (fn) => {
        await db.runTransaction(async (tx) => { await fn(tx); throw new Error('aborted'); }, { maxAttempts: 1 }).catch(() => {});
        now.set(now.ms() + 5_000);
        return db.runTransaction(fn);
      },
    };
    await claimSnapshot({ db: retried, id: key.id, now, host: 'x' });
    expect((await claimDoc(key)).lease.claimedAt).toBe(now().toISOString());
  });
});

describe('the confirmation record', () => {
  const observationOf = async (key) => (await claimDoc(key)).observation;

  it('a first `confirm` outcome: no final document, an observation stamped at the response, and it survives the lease\'s release', async () => {
    const key = freshKey();
    const now = handClock();
    const fetchPayload = vi.fn(async () => { now.set(now.ms() + 2_000); return gapAt(); });
    expect(await call(key, now, fetchPayload)).toEqual({ status: 'retryable', reason: 'missing_bar' });
    expect(await finalDoc(key)).toBeNull();
    const claim = await claimDoc(key);
    expect(claim.lease).toBeNull();
    expect(claim.observation).toEqual({ reason: 'missing_bar', detailHash: expect.stringMatching(/^[0-9a-f]{64}$/), observedAt: new Date(AFTER_CLOSE_MS + 2_000).toISOString() });
  });
  it('a matching result before 30 minutes keeps the original observedAt', async () => {
    const key = freshKey();
    const now = handClock();
    const fetchPayload = provider(gapAt());
    await call(key, now, fetchPayload);
    const first = await observationOf(key);
    now.set(now.ms() + CONFIRM_AFTER_MS - 1);
    expect(await call(key, now, fetchPayload)).toEqual({ status: 'retryable', reason: 'missing_bar' });
    expect(await observationOf(key)).toEqual(first);
    expect(await finalDoc(key)).toBeNull();
  });
  it('a different detail replaces it, and the 30 minutes start again', async () => {
    const key = freshKey();
    const now = handClock();
    await call(key, now, provider(gapAt(10)));
    const first = await observationOf(key);
    now.set(now.ms() + CONFIRM_AFTER_MS + MINUTE);
    const second = provider(gapAt(20));
    expect((await call(key, now, second)).status).toBe('retryable');
    const replaced = await observationOf(key);
    expect(replaced.reason).toBe('missing_bar');
    expect(replaced.detailHash).not.toBe(first.detailHash);
    expect(replaced.observedAt).toBe(now().toISOString());
    expect(await finalDoc(key)).toBeNull();
  });
  it('a different reason replaces it', async () => {
    const key = freshKey();
    const now = handClock();
    await call(key, now, provider(gapAt()));
    now.set(now.ms() + CONFIRM_AFTER_MS + MINUTE);
    const weekend = rawRows();
    const friday = weekend.findIndex((r) => r.date === '2026-10-23');
    weekend.splice(friday, 0, { ...weekend[friday], date: '2026-10-24' });
    expect(await call(key, now, provider(weekend))).toEqual({ status: 'retryable', reason: 'unordered_bars' });
    expect(await observationOf(key)).toMatchObject({ reason: 'unordered_bars', observedAt: now().toISOString() });
  });
  it('the same detail under a different reason replaces it: the reason is part of the match', async () => {
    const key = freshKey();
    const now = handClock();
    const first = await claimSnapshot({ db, id: key.id, now, host: 'x' });
    await settleConfirmation({ db, id: key.id, token: first.token, reason: 'missing_bar', detailHash: 'same', acquired: acquiredAt(now), doc: { who: 'x' } });
    now.set(now.ms() + CONFIRM_AFTER_MS + MINUTE);
    const second = await claimSnapshot({ db, id: key.id, now, host: 'x' });
    const out = await settleConfirmation({ db, id: key.id, token: second.token, reason: 'unordered_bars', detailHash: 'same', acquired: acquiredAt(now), doc: { who: 'x' } });
    expect(out).toEqual({ status: 'retryable', reason: 'unordered_bars' });
    expect(await finalDoc(key)).toBeNull();
    expect(await observationOf(key)).toMatchObject({ reason: 'unordered_bars', observedAt: now().toISOString() });
  });
  it('a matching separate fetch 30 minutes on finalises, from THAT fetch\'s evidence', async () => {
    const key = freshKey();
    const now = handClock();
    await call(key, now, provider(gapAt()));
    const observedAtMs = Date.parse((await observationOf(key)).observedAt);
    now.set(observedAtMs + CONFIRM_AFTER_MS);
    const { status, snapshot } = await call(key, now, provider(gapAt()));
    expect(status).toBe('final');
    expect(snapshot).toMatchObject({ status: 'refused', refusal: { reason: 'missing_bar' }, capturedAt: now().toISOString() });
    expect(snapshot.sourceMeta.fetchedAt).toBe(now().toISOString());
    expect(snapshot.refusal.detail.after).toBeTruthy();
    expect((await finalDoc(key)).data()).toEqual(snapshot);
    expect((await claimDoc(key)).lease).toBeNull();
  });
  it('the gap is measured from the second request\'s START: answered past 30 minutes but asked before them is no confirmation', async () => {
    const key = freshKey();
    const now = handClock();
    await call(key, now, provider(gapAt()));
    const first = await observationOf(key);
    now.set(Date.parse(first.observedAt) + CONFIRM_AFTER_MS - 1);
    const answeredLate = vi.fn(async () => { now.set(now.ms() + 2_000); return gapAt(); });
    expect(await call(key, now, answeredLate)).toEqual({ status: 'retryable', reason: 'missing_bar' });
    expect(await observationOf(key)).toEqual(first);
    expect(await finalDoc(key)).toBeNull();
  });
  it('a request begun long before the observation is no confirmation: the gap has a direction', async () => {
    const key = freshKey();
    const now = handClock();
    await call(key, now, provider(gapAt()));
    const { observedAt, detailHash, reason } = await observationOf(key);
    const claim = await claimSnapshot({ db, id: key.id, now, host: 'x' });
    const acquired = { requestStartedAtMs: Date.parse(observedAt) - CONFIRM_AFTER_MS, fetchedAt: now().toISOString() };
    expect(await settleConfirmation({ db, id: key.id, token: claim.token, reason, detailHash, acquired, doc: { who: 'x' } })).toEqual({ status: 'retryable', reason });
    expect(await finalDoc(key)).toBeNull();
  });
  it('a final keeps the observation on the claim, by either path: finalising clears the lease and nothing else', async () => {
    const key = freshKey();
    const now = handClock();
    await call(key, now, provider(gapAt()));
    const first = await observationOf(key);
    now.set(now.ms() + MINUTE);
    await call(key, now, provider(rawRows()));
    expect(await observationOf(key)).toEqual(first);

    const other = freshKey();
    const clock = handClock();
    await call(other, clock, provider(gapAt()));
    const seen = await observationOf(other);
    clock.set(Date.parse(seen.observedAt) + CONFIRM_AFTER_MS);
    expect((await call(other, clock, provider(gapAt()))).status).toBe('final');
    expect(await observationOf(other)).toEqual(seen);
  });
  it('the unordered_bars non-session line confirms the same way', async () => {
    const key = freshKey();
    const now = handClock();
    const rows = rawRows();
    const friday = rows.findIndex((r) => r.date === '2026-10-23');
    rows.splice(friday, 0, { ...rows[friday], date: '2026-10-24' });
    expect(await call(key, now, provider(rows))).toEqual({ status: 'retryable', reason: 'unordered_bars' });
    now.set(now.ms() + CONFIRM_AFTER_MS);
    expect((await call(key, now, provider(rows))).snapshot).toMatchObject({ status: 'refused', refusal: { reason: 'unordered_bars', detail: { why: 'non_session_date' } } });
  });
  it('a clean result after an observation is simply final: the first read was the provider\'s glitch', async () => {
    const key = freshKey();
    const now = handClock();
    await call(key, now, provider(gapAt()));
    now.set(now.ms() + MINUTE);
    expect((await call(key, now, provider(rawRows()))).snapshot.status).toBe('ok');
  });
  it('a retryable failure between the two samples touches nothing: the observation stands, and the later match finalises', async () => {
    const key = freshKey();
    const now = handClock();
    await call(key, now, provider(gapAt()));
    const first = await observationOf(key);
    now.set(now.ms() + 10 * MINUTE);
    expect(await call(key, now, provider(new Error('down')))).toEqual({ status: 'retryable', reason: 'fetch_failed' });
    expect(await observationOf(key)).toEqual(first);
    now.set(Date.parse(first.observedAt) + CONFIRM_AFTER_MS);
    expect((await call(key, now, provider(gapAt()))).status).toBe('final');
  });
  it('a retryable refusal between the two samples touches nothing either: "different" is read within the confirm class, and the two matching samples are still 30 minutes apart', async () => {
    const key = freshKey();
    const now = handClock();
    await call(key, now, provider(gapAt()));
    const first = await observationOf(key);
    now.set(now.ms() + 10 * MINUTE);
    expect(await call(key, now, provider(rawRows().slice(1)))).toEqual({ status: 'retryable', reason: 'missing_bar' });
    expect(await observationOf(key)).toEqual(first);
    now.set(Date.parse(first.observedAt) + CONFIRM_AFTER_MS);
    expect((await call(key, now, provider(gapAt()))).snapshot).toMatchObject({ status: 'refused', refusal: { reason: 'missing_bar', detail: { after: expect.any(String) } } });
  });
  it('an observation with an unreadable date matches nothing and is replaced, never finalising on it', async () => {
    const key = freshKey();
    const now = handClock();
    await call(key, now, provider(gapAt()));
    const { detailHash } = await observationOf(key);
    await db.doc(`setupEvidenceClaims/${key.id}`).update({ observation: { reason: 'missing_bar', detailHash, observedAt: 'never' } });
    now.set(now.ms() + 2 * CONFIRM_AFTER_MS);
    expect((await call(key, now, provider(gapAt()))).status).toBe('retryable');
    expect((await observationOf(key)).observedAt).toBe(now().toISOString());
  });
  it('a worker that lost its lease may still confirm: the `create` decides, and the successor\'s lease stands', async () => {
    const key = freshKey();
    const now = handClock();
    await call(key, now, provider(gapAt()));
    now.set(now.ms() + CONFIRM_AFTER_MS);
    let successor;
    const fetchPayload = vi.fn(async () => {
      now.set(now.ms() + LEASE_MS);
      successor = await claimSnapshot({ db, id: key.id, now, host: 'successor' });
      return gapAt();
    });
    expect((await call(key, now, fetchPayload)).status).toBe('final');
    expect((await claimDoc(key)).lease).toMatchObject({ token: successor.token });
  });
  it('no call ever waits: two calls return in seconds, both retryable, with the 30 minutes still to run', async () => {
    const key = freshKey();
    const now = handClock();
    const started = Date.now();
    expect(await call(key, now, provider(gapAt()))).toEqual({ status: 'retryable', reason: 'missing_bar' });
    expect(await call(key, now, provider(gapAt()))).toEqual({ status: 'retryable', reason: 'missing_bar' });
    expect(Date.now() - started).toBeLessThan(5_000);
  });
});

describe('the V1.5 confirm lines: passing provider states never go final on the first read', () => {
  const observationOf = async (key) => (await claimDoc(key)).observation;
  const NEWEST_ZEROS = { open: 0, high: 0, low: 0, close: 0, adjusted_close: 0 };

  describe.each([
    ['ok evidence with an adjusted close missing', () => rowsWith(8, { adjusted_close: null }), 'adjusted_close_missing', { status: 'ok', refusal: null, evidence: { ok: true, checks: { splitCheck: 'not_available' } } }],
    ['ok evidence with a zero adjusted close', () => rowsWith(8, { adjusted_close: 0 }), 'adjusted_close_nonpositive', { status: 'ok', evidence: { ok: true } }],
    ['the newest bar with no adjusted close', () => rowsWith(0, { adjusted_close: null }), 'adjusted_close_missing', { status: 'ok', evidence: { ok: true } }],
    ['insufficient_history', shortRows, 'insufficient_history', { status: 'refused', refusal: { reason: 'insufficient_history' } }],
    ['a newest row of zeros', () => rowsWith(0, NEWEST_ZEROS), 'missing_fact', { status: 'refused', refusal: { reason: 'missing_fact', detail: { date: SESSION } } }],
  ])('%s', (_label, payload, reason, stored) => {
    it('the first read writes no final; a match before 30 minutes keeps its date; a separate fetch 30 minutes on finalises', async () => {
      const key = freshKey();
      const now = handClock();
      const fetchPayload = provider(payload());
      expect(await call(key, now, fetchPayload)).toEqual({ status: 'retryable', reason });
      expect(await finalDoc(key)).toBeNull();
      const first = await observationOf(key);
      expect(first).toMatchObject({ reason, observedAt: now().toISOString() });
      now.set(now.ms() + CONFIRM_AFTER_MS - 1);
      expect(await call(key, now, fetchPayload)).toEqual({ status: 'retryable', reason });
      expect(await observationOf(key)).toEqual(first);
      expect(await finalDoc(key)).toBeNull();
      now.set(Date.parse(first.observedAt) + CONFIRM_AFTER_MS);
      const { status, snapshot } = await call(key, now, fetchPayload);
      expect(status).toBe('final');
      expect(snapshot).toMatchObject({ schemaVersion: 1, capturedAt: now().toISOString(), ...stored });
      expect((await finalDoc(key)).data()).toEqual(snapshot);
      expect(await claimDoc(key)).toMatchObject({ lease: null, attempts: 3 });
    });
    it('the provider catching up is simply final, with no wait and no trace of the refusal', async () => {
      const key = freshKey();
      const now = handClock();
      await call(key, now, provider(payload()));
      now.set(now.ms() + MINUTE);
      expect((await call(key, now, provider(rawRows()))).snapshot).toMatchObject({ status: 'ok', refusal: null, evidence: { adjustment: { metadata: 'present' } } });
    });
  });

  it('different dates missing their adjusted close are a different detail: it replaces the observation, and the 30 minutes start again', async () => {
    const key = freshKey();
    const now = handClock();
    await call(key, now, provider(rowsWith(8, { adjusted_close: null })));
    const first = await observationOf(key);
    now.set(now.ms() + CONFIRM_AFTER_MS + MINUTE);
    expect(await call(key, now, provider(rowsWith(9, { adjusted_close: null })))).toEqual({ status: 'retryable', reason: 'adjusted_close_missing' });
    const replaced = await observationOf(key);
    expect(replaced.detailHash).not.toBe(first.detailHash);
    expect(replaced.observedAt).toBe(now().toISOString());
    expect(await finalDoc(key)).toBeNull();
  });
  it('a different bar count is a different detail: a truncated array that moves is not reproduced', async () => {
    const key = freshKey();
    const now = handClock();
    await call(key, now, provider(rawRows(40)));
    now.set(now.ms() + CONFIRM_AFTER_MS + MINUTE);
    expect(await call(key, now, provider(rawRows(41)))).toEqual({ status: 'retryable', reason: 'insufficient_history' });
    expect(await finalDoc(key)).toBeNull();
  });
  it('a different confirm reason replaces it: a short history after an adjusted-close gap starts again', async () => {
    const key = freshKey();
    const now = handClock();
    await call(key, now, provider(rowsWith(8, { adjusted_close: null })));
    now.set(now.ms() + CONFIRM_AFTER_MS + MINUTE);
    expect(await call(key, now, provider(shortRows()))).toEqual({ status: 'retryable', reason: 'insufficient_history' });
    expect(await observationOf(key)).toMatchObject({ reason: 'insufficient_history', observedAt: now().toISOString() });
    expect(await finalDoc(key)).toBeNull();
  });
  it('a split step behind a newest bar with no adjusted close confirms, and goes final as the real refusal once the bar fills in', async () => {
    const key = freshKey();
    const now = handClock();
    const lagging = splitRows();
    lagging[0] = { ...lagging[0], adjusted_close: null };
    expect(await call(key, now, provider(lagging))).toEqual({ status: 'retryable', reason: 'adjusted_close_missing' });
    now.set(now.ms() + MINUTE);
    expect((await call(key, now, provider(splitRows()))).snapshot).toMatchObject({ status: 'refused', refusal: { reason: 'basis_discontinuity' } });
  });
});

describe('attempts, and what a retryable outcome leaves', () => {
  it('each fetch is an attempt, stamped; a retryable outcome leaves no final document and a free lease', async () => {
    const key = freshKey();
    const now = handClock();
    const fetchPayload = provider(new Error('down'), { errors: 'rate limited' }, rawRows().slice(1), rawRows());
    expect(await call(key, now, fetchPayload)).toEqual({ status: 'retryable', reason: 'fetch_failed' });
    expect(await claimDoc(key)).toMatchObject({ lease: null, attempts: 1, lastAttemptAt: now().toISOString() });
    now.set(now.ms() + MINUTE);
    expect(await call(key, now, fetchPayload)).toEqual({ status: 'retryable', reason: 'non_array_payload' });
    now.set(now.ms() + MINUTE);
    expect(await call(key, now, fetchPayload)).toEqual({ status: 'retryable', reason: 'missing_bar' });
    expect(await finalDoc(key)).toBeNull();
    expect(await claimDoc(key)).toMatchObject({ lease: null, observation: null, attempts: 3, lastAttemptAt: now().toISOString() });
    now.set(now.ms() + MINUTE);
    expect((await call(key, now, fetchPayload)).status).toBe('final');
    expect(await claimDoc(key)).toMatchObject({ lease: null, attempts: 4, lastAttemptAt: now().toISOString() });
    expect(fetchPayload).toHaveBeenCalledTimes(4);
  });
  it('attempts that are not an integer restart at one', async () => {
    const key = freshKey();
    await seedClaim(key, { lease: null, observation: null, attempts: 'x', lastAttemptAt: 'x' });
    await claimSnapshot({ db, id: key.id, now: handClock(), host: 'x' });
    expect((await claimDoc(key)).attempts).toBe(1);
  });
  it('a takeover counts as an attempt', async () => {
    const key = freshKey();
    const now = handClock();
    await claimSnapshot({ db, id: key.id, now, host: 'dead' });
    now.set(now.ms() + LEASE_MS);
    await call(key, now, provider(new Error('down')));
    expect((await claimDoc(key)).attempts).toBe(2);
  });
  it('the observation is carried through a takeover of an expired, non-null lease', async () => {
    const key = freshKey();
    const now = handClock();
    await call(key, now, provider(gapAt()));
    const first = (await claimDoc(key)).observation;
    await claimSnapshot({ db, id: key.id, now, host: 'dead' });
    expect((await claimDoc(key)).lease).not.toBeNull();
    now.set(now.ms() + LEASE_MS);
    expect((await claimSnapshot({ db, id: key.id, now, host: 'successor' })).status).toBe('claimed');
    expect((await claimDoc(key)).observation).toEqual(first);
  });
});

describe('a final document is never updated', () => {
  it('a second write changes no byte: not by a later fetch, not by a confirmation, not by a direct createFinal', async () => {
    const key = freshKey();
    const now = handClock();
    await call(key, now, provider(rawRows()));
    const before = await finalDoc(key);
    now.set(now.ms() + 7 * CONFIRM_AFTER_MS);
    await call(key, now, provider(shortRows()));
    await createFinal({ db, id: key.id, token: 'none', doc: { replaced: true } });
    const acquired = { requestStartedAtMs: now.ms(), fetchedAt: now().toISOString() };
    expect((await settleConfirmation({ db, id: key.id, token: 'none', reason: 'missing_bar', detailHash: 'h', acquired, doc: { replaced: true } })).snapshot).toEqual(before.data());
    const after = await finalDoc(key);
    expect(after.data()).toEqual(before.data());
    expect(after.updateTime.isEqual(before.updateTime)).toBe(true);
  });
});

describe('what the store refuses', () => {
  it('crypto makes no fetch and no write, before any other check', async () => {
    const fetchPayload = provider(rawRows());
    const id = snapshotIdOf({ session: SESSION, symbol: 'BTC', ruleSet: RULE_SET });
    expect(await getOrAcquireSnapshot({ db, session: SESSION, symbol: 'BTC', now: handClock(), fetchPayload })).toEqual({ status: 'excluded', reason: 'unsupported_symbol_class' });
    expect(fetchPayload).not.toHaveBeenCalled();
    expect((await db.doc(`setupEvidence/${id}`).get()).exists).toBe(false);
    expect((await db.doc(`setupEvidenceClaims/${id}`).get()).exists).toBe(false);
  });
  it('a dotted spelling of a class share is refused before any read: one instrument, one key', async () => {
    const fetchPayload = provider(rawRows());
    await expect(getOrAcquireSnapshot({ db, session: SESSION, symbol: 'BRK.B', now: handClock(), fetchPayload })).rejects.toThrow(TypeError);
    await expect(readSnapshot({ db, session: SESSION, symbol: 'BRK.B', ruleSet: RULE_SET })).rejects.toThrow(TypeError);
    expect(fetchPayload).not.toHaveBeenCalled();
  });
  it('the ok-result assertion throws on a forced mismatch and writes nothing: a clock that steps back across the close', async () => {
    const key = freshKey();
    const now = handClock();
    const close = getSessionForDate(SESSION).closeMs;
    // After the close at the check; before it when the response lands, so the adapter names the session before.
    const fetchPayload = vi.fn(async () => { now.set(close - 1); return rawRows(); });
    const err = await call(key, now, fetchPayload).catch((e) => e);
    expect(err).toBeInstanceOf(SetupEvidenceProgrammingError);
    expect(err).toMatchObject({ reason: 'asof_mismatch', detail: { session: SESSION, asOf: '2026-10-27', requestedAsOf: SESSION } });
    expect(await finalDoc(key)).toBeNull();
    expect(await claimDoc(key)).toMatchObject({ lease: null, attempts: 1, observation: null });
  });
  it.each([
    ['a Saturday', '2026-10-24', 'asOf_not_a_session'],
    ['Thanksgiving', '2026-11-26', 'asOf_not_a_session'],
  ])('%s is no session: throws before any read or fetch', async (_label, session, reason) => {
    const fetchPayload = provider(rawRows());
    const untouched = { collection: () => { throw new Error('touched the store'); }, runTransaction: () => { throw new Error('touched the store'); } };
    const err = await getOrAcquireSnapshot({ db: untouched, session, symbol: 'NVDA', now: handClock(Date.parse('2026-12-01T12:00:00Z')), fetchPayload }).catch((e) => e);
    expect(err).toBeInstanceOf(SetupEvidenceProgrammingError);
    expect(err.reason).toBe(reason);
    expect(fetchPayload).not.toHaveBeenCalled();
  });
  it('a session that has not closed throws before any read or fetch', async () => {
    const fetchPayload = provider(rawRows());
    const err = await getOrAcquireSnapshot({ db, session: SESSION, symbol: 'NVDA', now: handClock(getSessionForDate(SESSION).closeMs - 1), fetchPayload }).catch((e) => e);
    expect(err).toBeInstanceOf(SetupEvidenceProgrammingError);
    expect(err.reason).toBe('session_incomplete');
    expect(fetchPayload).not.toHaveBeenCalled();
  });
  it('an unmaintained year or a future date is retryable with no fetch and no write', async () => {
    const fetchPayload = provider(rawRows());
    const untouched = { collection: () => { throw new Error('touched the store'); }, runTransaction: () => { throw new Error('touched the store'); } };
    expect(await getOrAcquireSnapshot({ db: untouched, session: '2028-01-03', symbol: 'NVDA', now: handClock(Date.parse('2028-01-04T12:00:00Z')), fetchPayload })).toEqual({ status: 'retryable', reason: 'calendar_missing' });
    expect(await getOrAcquireSnapshot({ db: untouched, session: '2026-10-29', symbol: 'NVDA', now: handClock(Date.parse('2026-10-28T12:00:00Z')), fetchPayload })).toEqual({ status: 'retryable', reason: 'asOf_in_future' });
    expect(fetchPayload).not.toHaveBeenCalled();
  });
  it('a malformed key throws before any read', async () => {
    await expect(getOrAcquireSnapshot({ db, session: '2026-02-30', symbol: 'NVDA', now: handClock(), fetchPayload: provider([]) })).rejects.toThrow(TypeError);
    await expect(getOrAcquireSnapshot({ db, session: SESSION, symbol: 'nvda', now: handClock(), fetchPayload: provider([]) })).rejects.toThrow(TypeError);
    await expect(readSnapshot({ db, session: SESSION, symbol: 'NVDA', ruleSet: { setupVersion: 'x' } })).rejects.toThrow(TypeError);
  });
  it('a plain Date is refused as a clock: it could only stamp a time before the request', async () => {
    await expect(getOrAcquireSnapshot({ db, session: SESSION, symbol: 'NVDA', now: new Date(AFTER_CLOSE_MS), fetchPayload: provider([]) })).rejects.toThrow(TypeError);
  });
  it('a failed release never replaces the outcome: the first error surfaces, a retryable stays retryable, and the release failure goes to the log', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const failAfterClaim = () => {
      const failing = {
        collection: (name) => db.collection(name),
        runTransaction: vi.fn((fn) => (failing.runTransaction.mock.calls.length >= 2 ? Promise.reject(new Error(`boom ${failing.runTransaction.mock.calls.length}`)) : db.runTransaction(fn))),
      };
      return failing;
    };
    const err = await call(freshKey(), handClock(), provider(rawRows()), { db: failAfterClaim() }).catch((e) => e);
    expect(err.message).toBe('boom 2');
    expect(warn.mock.calls.flat().join(' ')).toContain('lease release failed: boom 3');
    expect(await call(freshKey(), handClock(), provider(new Error('down')), { db: failAfterClaim() })).toEqual({ status: 'retryable', reason: 'fetch_failed' });
    warn.mockRestore();
  });
  it('a write failure after the lease was taken releases the lease and surfaces', async () => {
    const key = freshKey();
    const now = handClock();
    const failing = {
      collection: (name) => db.collection(name),
      runTransaction: vi.fn((fn) => (failing.runTransaction.mock.calls.length === 2 ? Promise.reject(new Error('commit failed')) : db.runTransaction(fn))),
    };
    await expect(call(key, now, provider(rawRows()), { db: failing })).rejects.toThrow('commit failed');
    expect(await finalDoc(key)).toBeNull();
    expect((await claimDoc(key)).lease).toBeNull();
  });
});
