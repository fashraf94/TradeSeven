// api/_utils/__fixtures__/versionedFirestore.js
//
// THE VERSIONED HARNESS — an optimistic-concurrency SIMULATOR for the Backing
// Beta transaction suites (the api/tournament/backing-stake.test.js shape,
// PR 3's one-transaction-object refinement): every document is versioned, a
// transaction remembers what it READ, and on commit it discards the buffered
// writes and re-runs the body if any of them moved — which is what Firestore
// does, and the only way a "two writers racing on one pool" row can mean
// anything. It refuses a read after a write, and re-runs the body on ONE
// transaction object across attempts, as the SDK does (@google-cloud/firestore
// transaction.js runs `updateFunction(this)` and only resets its write batch
// between attempts) — so anything the code under test remembers PER
// TRANSACTION OBJECT (backingWallet.js's per-tx wallet memo, reset by
// readWallet's forgetWallet) is exercised the way production exercises it.
//
// ONE WAY IT IS LOOSER THAN THE SERVER: reads are LIVE, so a body can read one
// document before a competing commit and the next document after it (a MIXED
// read) — the conflict is caught at commit, not at the read. Firestore's
// server client libraries take pessimistic read locks and never hand a body
// that mix. The code under test must therefore TOLERATE a mixed read — buffer
// a write the commit will discard and let the re-run answer — and never THROW
// on two documents disagreeing in its read phase, or a race row on this
// harness turns into a hard error the server would never raise (MONEY-R-1,
// the PR 5 review record; the refund's `corrupt_book` refusal is RETURNED for
// exactly this reason).
//
// Shared since PR 5 (the refund suite is the third copy's worth); PR 2's and
// PR 3's own copies stay where they are, untouched.
//
// DOCUMENTED LIMIT, inherited: a query's read set is the documents it MATCHED
// — narrower than Firestore's, which also guards the range — so this harness
// misses conflicts Firestore would catch and never invents ones it would not;
// every "safe" conclusion drawn on it holds a fortiori. Only `==` filters are
// applied; `orderBy` / `limit` / `select` never change which documents match.
//
// `beforeCommit({ attempt, store, versions, commitWrites })`, when given, runs
// after the body and before the conflict check — a seam for a suite to land a
// competing write "between" read and commit.
//
// `slotWriters: true` (Backing Amendment D, safety fix 1) — OPT-IN, so every
// backing suite keeps the "whole documents or nothing" guard on `tx.update`.
// It lets the REAL live-draft slot writers (liveDraftFormation.js
// `claimSlotSeat` / `releaseSlotSeat`) run on this harness, for the rows that
// interleave a slot claim with a stake: `tx.update` (a SHALLOW top-level
// merge — the only shape those writers use — applied at commit onto the
// document as the transaction read it, which the conflict check guarantees is
// the stored one), `tx.delete`, a plain `ref.update` / `ref.delete`, and the
// `array-contains` filter (`findActiveGroupInBattleWeek`). Off, all four
// behave exactly as before.

const tick = () => new Promise((r) => setImmediate(r));

// A buffered field update, applied at commit (`slotWriters` only).
const UPDATE = Symbol('update');
// A buffered delete (`slotWriters` only).
const DELETE = Symbol('delete');

export function makeVersionedDb(initial = {}, { beforeCommit = null, slotWriters = false } = {}) {
  const store = new Map(Object.entries(initial).map(([k, v]) => [k, structuredClone(v)]));
  const versions = new Map();
  const writeLog = [];
  const stats = { attempts: 0, commits: 0, conflicts: 0 };
  const snapOf = (path) => {
    const data = store.get(path);
    return { exists: data !== undefined, id: path.split('/').pop(), data: () => structuredClone(data) };
  };
  const docsUnder = (prefix) => [...store.entries()]
    .filter(([p]) => p.startsWith(`${prefix}/`) && !p.slice(prefix.length + 1).includes('/'))
    .map(([p, d]) => ({ __path: p, id: p.slice(prefix.length + 1), data: () => structuredClone(d) }));
  const snapshotOf = (docs) => ({ docs, empty: docs.length === 0, size: docs.length, forEach: (cb) => docs.forEach(cb) });
  const matches = (d, f) => {
    if (f.op === '==') return d.data()[f.field] === f.value;
    if (slotWriters && f.op === 'array-contains') {
      const v = d.data()[f.field];
      return Array.isArray(v) && v.includes(f.value);
    }
    return true;
  };
  function makeQuery(prefix, filters) {
    const run = () => docsUnder(prefix).filter((d) => filters.every((f) => matches(d, f)));
    const self = {
      path: prefix, _run: run,
      where: (field, op, value) => makeQuery(prefix, [...filters, { field, op, value }]),
      orderBy: () => makeQuery(prefix, filters), limit: () => makeQuery(prefix, filters),
      select: () => self,   // a field mask never changes WHICH docs come back
      get: async () => { await tick(); return snapshotOf(run()); },
    };
    return self;
  }
  function makeDocRef(path) {
    return {
      path, _isDoc: true,
      get: async () => { await tick(); return snapOf(path); },
      // A PLAIN (non-transactional) write, for the hosts that write outside
      // their transaction (the stake endpoint's telemetry record, PR 5).
      set: async (data) => { await tick(); store.set(path, structuredClone(data)); versions.set(path, (versions.get(path) ?? 0) + 1); writeLog.push(['set', path]); },
      ...(slotWriters ? {
        update: async (fields) => {
          await tick();
          if (!store.has(path)) throw new Error(`update on missing doc ${path}`);
          store.set(path, { ...store.get(path), ...structuredClone(fields) });
          versions.set(path, (versions.get(path) ?? 0) + 1);
          writeLog.push(['update', path]);
        },
        delete: async () => { await tick(); store.delete(path); versions.set(path, (versions.get(path) ?? 0) + 1); writeLog.push(['delete', path]); },
      } : {}),
      collection: (sub) => makeCollection(`${path}/${sub}`),
    };
  }
  function makeCollection(prefix) {
    return {
      path: prefix,
      doc: (id) => makeDocRef(`${prefix}/${id}`),
      where: (field, op, value) => makeQuery(prefix, [{ field, op, value }]),
      get: async () => { await tick(); return snapshotOf(docsUnder(prefix)); },
    };
  }
  const commitWrites = (buffer) => {
    for (const [p, d] of buffer) {
      if (d === DELETE) {
        store.delete(p);
        writeLog.push(['tx.delete', p]);
      } else if (d?.[UPDATE]) {
        if (!store.has(p)) throw new Error(`tx.update on missing doc ${p}`);
        store.set(p, { ...store.get(p), ...d[UPDATE] });
        writeLog.push(['tx.update', p]);
      } else {
        store.set(p, d);
        writeLog.push(['tx.set', p]);
      }
      versions.set(p, (versions.get(p) ?? 0) + 1);
    }
  };
  const db = {
    collection: makeCollection,
    runTransaction: async (fn) => {
      let reads = new Map();
      let buffer = [];
      let wrote = false;
      const remember = (path) => reads.set(path, versions.get(path) ?? 0);
      const tx = {
        get: async (ref) => {
          if (wrote) throw new Error('transaction read after write');
          await tick();
          if (ref._isDoc) { remember(ref.path); return snapOf(ref.path); }
          const docs = ref._run();
          for (const d of docs) remember(d.__path);
          return snapshotOf(docs);
        },
        set: (ref, data) => { wrote = true; buffer.push([ref.path, structuredClone(data)]); },
        update: slotWriters
          ? (ref, fields) => { wrote = true; buffer.push([ref.path, { [UPDATE]: structuredClone(fields) }]); }
          : () => { throw new Error('the backing transactions write whole documents or nothing'); },
        ...(slotWriters ? { delete: (ref) => { wrote = true; buffer.push([ref.path, DELETE]); } } : {}),
      };
      for (let attempt = 1; attempt <= 6; attempt += 1) {
        stats.attempts += 1;
        reads = new Map();
        buffer = [];
        wrote = false;
        const result = await fn(tx);
        await tick();
        if (beforeCommit) beforeCommit({ attempt, store, versions, commitWrites });
        const conflict = [...reads].some(([p, v]) => (versions.get(p) ?? 0) !== v);
        if (conflict) { stats.conflicts += 1; continue; }
        commitWrites(buffer);
        stats.commits += 1;
        return result;
      }
      throw new Error('transaction contention exhausted');
    },
  };
  return { db, store, writeLog, stats };
}
