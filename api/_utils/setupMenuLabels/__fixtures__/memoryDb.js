// api/_utils/setupMenuLabels/__fixtures__/memoryDb.js
//
// An in-memory document store for Slice 2's unit rows: plain gets, field-masked equality queries, and
// TRANSACTIONS whose failure modes a row can choose, one transaction at a time, by the order they run:
//
//   'commit'          apply the writes (the default)
//   'fail'            reject before applying anything (a commit that did not land)
//   'lost_ack'        apply the writes, then reject (the commit landed; its acknowledgement was lost)
//   'rerun'           apply the writes, then run the callback AGAIN on the committed state and resolve
//                     with the re-run's result (the SDK re-running a callback whose commit had landed)
//   'abort_once'      discard the first attempt's writes and run the callback again (contention)
//   'hang'            never settle
//
// No product imports. Values are deep-copied in and out, as Firestore does.

const clone = (v) => (v === undefined ? undefined : structuredClone(v));

export function makeMemoryDb({ docs = {}, queries = {} } = {}) {
  const store = new Map(Object.entries(docs).map(([p, d]) => [p, clone(d)]));
  const txPlan = [];
  const log = { gets: [], sets: [], transactions: 0, queries: [] };
  const getHooks = new Map(); // path → async () => void (a delay or a throw before the read)

  const snapOf = (path) => {
    const data = store.get(path);
    return { exists: data !== undefined, id: path.split('/').pop(), data: () => clone(data) };
  };
  const refOf = (col, id) => ({
    id, path: `${col}/${id}`,
    async get() {
      log.gets.push(`${col}/${id}`);
      const hook = getHooks.get(`${col}/${id}`) ?? getHooks.get(`${col}/*`);
      if (hook) await hook();
      return snapOf(`${col}/${id}`);
    },
    async set(data) { log.sets.push(`${col}/${id}`); store.set(`${col}/${id}`, clone(data)); },
  });
  const query = (col, filters = [], fields = null, max = Infinity) => ({
    where: (f, op, v) => query(col, [...filters, [f, op, v]], fields, max),
    select: (...fs) => query(col, filters, fs, max),
    limit: (n) => query(col, filters, fields, n),
    async get() {
      log.queries.push({ col, filters, fields, max });
      const hook = queries[col];
      if (typeof hook === 'function') await hook({ filters });
      const prefix = `${col}/`;
      const out = [];
      for (const [path, data] of store) {
        if (!path.startsWith(prefix) || path.slice(prefix.length).includes('/')) continue;
        if (!filters.every(([f, op, v]) => op === '==' && data?.[f] === v)) continue;
        out.push({ id: path.slice(prefix.length), data: () => clone(data) });
        if (out.length >= max) break;
      }
      return { docs: out, empty: out.length === 0, size: out.length };
    },
  });

  const db = {
    collection: (col) => ({ doc: (id) => refOf(col, id), where: (...a) => query(col).where(...a) }),
    async runTransaction(cb) {
      log.transactions += 1;
      const mode = txPlan.length ? txPlan.shift() : 'commit';
      const attempt = async () => {
        const writes = [];
        const tx = {
          get: async (ref) => snapOf(ref.path),
          set: (ref, data) => { writes.push([ref.path, clone(data)]); },
          update: (ref, data) => { writes.push([ref.path, { ...(store.get(ref.path) ?? {}), ...clone(data) }]); },
          create: (ref, data) => { writes.push([ref.path, clone(data)]); },
        };
        const result = await cb(tx);
        return { result, writes };
      };
      const apply = (writes) => { for (const [p, d] of writes) { store.set(p, d); log.sets.push(p); } };
      if (mode === 'hang') return new Promise(() => {});
      if (mode === 'abort_once') { await attempt(); const second = await attempt(); apply(second.writes); return second.result; }
      const first = await attempt();
      if (mode === 'fail') throw Object.assign(new Error('transaction failed (injected)'), { code: 14 });
      apply(first.writes);
      if (mode === 'lost_ack') throw Object.assign(new Error('deadline exceeded after commit (injected)'), { code: 4 });
      if (mode === 'rerun') { const again = await attempt(); apply(again.writes); return again.result; }
      return first.result;
    },
    /** Queue the next transactions' modes, in order. */
    planTransactions: (...modes) => { txPlan.push(...modes); },
    /** Delay or fail a document read: `onGet('setupEvidence/*', async () => { … })`. */
    onGet: (path, hook) => { getHooks.set(path, hook); },
    read: (path) => clone(store.get(path)),
    write: (path, data) => { store.set(path, clone(data)); },
    __store: store,
    __log: log,
  };
  return db;
}
