// test/rules/setupEvidenceStore.rules.mjs
//
// ID-1 Build 1 (shape note V1.4 §3) — THE STORE PROTOCOL AGAINST THE REAL FIRESTORE
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
import { getFirestore } from 'firebase-admin/firestore';
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
/** A refused-as-final payload: too few bars. */
const shortRows = () => rawRows(54);

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
  it('a final refusal: stored as refused, with the evaluator\'s refusal', async () => {
    const key = freshKey();
    const { status, snapshot } = await call(key, handClock(), provider(shortRows()));
    expect(status).toBe('final');
    expect(snapshot).toMatchObject({ status: 'refused', refusal: { reason: 'insufficient_history', detail: { required: 55, available: 54 }, expected: SESSION } });
    expect((await finalDoc(key)).data()).toEqual(snapshot);
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
    await Promise.race(calls);
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
  it('a slightly future lease, a neighbour\'s clock skew, is still live', async () => {
    const key = freshKey();
    const now = handClock();
    await seedClaim(key, { lease: { token: 'skewed', claimedAt: new Date(now.ms() + 1_000).toISOString(), host: 'x' }, observation: null, attempts: 1, lastAttemptAt: 'x' });
    expect(await call(key, now, provider(rawRows()))).toEqual({ status: 'pending' });
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
  it('a `create` that loses after a stale read reads the winner too (ALREADY_EXISTS from the real backend)', async () => {
    const key = freshKey();
    const winner = (await call(key, handClock(), provider(rawRows()))).snapshot;
    const stale = {
      collection: (name) => db.collection(name),
      runTransaction: (fn) => db.runTransaction((tx) => fn(new Proxy(tx, {
        get(target, prop) {
          if (prop !== 'get') return typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop];
          return async (ref) => { const snap = await target.get(ref); return ref.path.startsWith('setupEvidence/') ? { exists: false, data: () => undefined } : snap; };
        },
      }))),
    };
    expect(await createFinal({ db: stale, id: key.id, token: 'none', doc: { other: true } })).toEqual(winner);
    const acquired = { requestStartedAtMs: AFTER_CLOSE_MS, fetchedAt: new Date(AFTER_CLOSE_MS).toISOString() };
    await seedClaim(key, { lease: null, observation: { reason: 'missing_bar', detailHash: 'h', observedAt: new Date(AFTER_CLOSE_MS - CONFIRM_AFTER_MS).toISOString() }, attempts: 1, lastAttemptAt: 'x' });
    expect(await settleConfirmation({ db: stale, id: key.id, token: 'none', reason: 'missing_bar', detailHash: 'h', acquired, doc: { other: true } })).toEqual({ status: 'final', snapshot: winner });
    expect((await finalDoc(key)).data()).toEqual(winner);
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
  it('no call ever waits: each call returns at once, the clock never reads later than the test moved it', async () => {
    const key = freshKey();
    const now = handClock();
    const started = Date.now();
    await call(key, now, provider(gapAt()));
    await call(key, now, provider(gapAt()));
    expect(Date.now() - started).toBeLessThan(5_000);
    expect(now.ms()).toBe(AFTER_CLOSE_MS);
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
  it('a takeover counts as an attempt', async () => {
    const key = freshKey();
    const now = handClock();
    await claimSnapshot({ db, id: key.id, now, host: 'dead' });
    now.set(now.ms() + LEASE_MS);
    await call(key, now, provider(new Error('down')));
    expect((await claimDoc(key)).attempts).toBe(2);
  });
  it('the observation is carried through a takeover', async () => {
    const key = freshKey();
    const now = handClock();
    await call(key, now, provider(gapAt()));
    const first = (await claimDoc(key)).observation;
    now.set(now.ms() + MINUTE);
    await claimSnapshot({ db, id: key.id, now, host: 'x' });
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
    const before = (await db.collection('setupEvidenceClaims').get()).size;
    expect(await getOrAcquireSnapshot({ db, session: SESSION, symbol: 'BTC', now: handClock(), fetchPayload })).toEqual({ status: 'excluded', reason: 'unsupported_symbol_class' });
    expect(fetchPayload).not.toHaveBeenCalled();
    expect((await db.collection('setupEvidenceClaims').get()).size).toBe(before);
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
