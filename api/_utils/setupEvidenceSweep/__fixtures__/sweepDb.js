// api/_utils/setupEvidenceSweep/__fixtures__/sweepDb.js
//
// An in-memory document store for the sweep's unit rows, with the real store running on top of it:
// plain gets and TRANSACTIONS that run one at a time (a global lock, so two transactions never
// interleave), whose `create` fails with ALREADY_EXISTS (gRPC 6) at commit when the document exists,
// and whose writes land only when the callback resolves. A row may fail chosen transactions by a
// predicate over the paths they wrote. The emulator suite (test/rules/setupEvidenceSweep.rules.mjs)
// proves the same rows on real Firestore transactions; this double is for speed and fault injection.
//
// No product imports. Values are deep-copied in and out, as Firestore does.

const clone = (v) => (v === undefined ? undefined : structuredClone(v));

export function makeSweepDb({ docs = {} } = {}) {
  const store = new Map(Object.entries(docs).map(([p, d]) => [p, clone(d)]));
  const log = { gets: [], transactions: 0, commits: [], failedTransactions: 0 };
  let failWhen = null; // ({ writes }) => boolean
  let lock = Promise.resolve();

  const snapOf = (path) => {
    const data = store.get(path);
    return { exists: data !== undefined, id: path.split('/').pop(), data: () => clone(data) };
  };
  const refOf = (col, id) => ({
    id,
    path: `${col}/${id}`,
    async get() { log.gets.push(`${col}/${id}`); return snapOf(`${col}/${id}`); },
  });

  const db = {
    collection: (col) => ({ doc: (id) => refOf(col, id) }),
    runTransaction(cb) {
      const run = lock.then(async () => {
        log.transactions += 1;
        const writes = [];
        const tx = {
          get: async (ref) => snapOf(ref.path),
          set: (ref, data) => { writes.push(['set', ref.path, clone(data)]); },
          create: (ref, data) => { writes.push(['create', ref.path, clone(data)]); },
          update: (ref, data) => { writes.push(['set', ref.path, { ...(store.get(ref.path) ?? {}), ...clone(data) }]); },
        };
        const result = await cb(tx);
        if (failWhen && failWhen({ writes: writes.map(([, p]) => p) })) {
          log.failedTransactions += 1;
          throw Object.assign(new Error('transaction failed (injected)'), { code: 14 });
        }
        for (const [kind, path] of writes) {
          if (kind === 'create' && store.has(path)) throw Object.assign(new Error('ALREADY_EXISTS'), { code: 6 });
        }
        for (const [, path, data] of writes) { store.set(path, data); log.commits.push(path); }
        return result;
      });
      lock = run.then(() => {}, () => {});
      return run;
    },
    /** Fail every transaction whose writes match: `db.failTransactions(({ writes }) => …)`; null clears it. */
    failTransactions: (pred) => { failWhen = pred; },
    read: (path) => clone(store.get(path)),
    write: (path, data) => { store.set(path, clone(data)); },
    paths: (prefix) => [...store.keys()].filter((p) => p.startsWith(prefix)).sort(),
    __log: log,
  };
  return db;
}
