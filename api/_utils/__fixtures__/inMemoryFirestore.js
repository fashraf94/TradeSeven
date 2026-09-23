// api/_utils/__fixtures__/inMemoryFirestore.js
//
// The shared in-memory Firestore stand-in used by the tournament/training tests
// (extracted from trainingLifecycle.test.js so the R4 canonical-chain regression
// lock can drive the REAL training writers against the SAME store the unit tests
// use). Supports: doc get/set/update (dot-path), sub-collections, top-level
// where('==') queries — CHAINABLE since Backing Beta PR 2 (`.where().where()`,
// `.orderBy()`, `.limit()`, and `_read()` so `tx.get(query)` resolves like a doc
// ref does; the pre-existing single-`where` forms are untouched) — and
// runTransaction with tx.get/update/set. Captures writes
// in `writeLog`, reads in `readLog` (channel-tagged: 'get' for direct reads,
// 'tx.get' for transactional reads — so a suite can assert a dark path does
// ZERO reads, and that in-transaction verification reads actually ride the
// transaction; §2 pass-2 L2-1/L2-6), and exposes the raw `store` Map.

function applyDotPathUpdate(target, updates) {
  for (const [key, value] of Object.entries(updates)) {
    const parts = key.split('.');
    let node = target;
    for (let i = 0; i < parts.length - 1; i++) {
      if (typeof node[parts[i]] !== 'object' || node[parts[i]] == null) node[parts[i]] = {};
      node = node[parts[i]];
    }
    node[parts[parts.length - 1]] = value;
  }
}

export function makeInMemoryDb(initial = {}) {
  const store = new Map(Object.entries(initial).map(([k, v]) => [k, structuredClone(v)]));
  const writeLog = [];
  const readLog = [];
  let autoId = 0;

  function makeDocRef(path) {
    const readSnap = () => {
      const data = store.get(path);
      return { exists: data !== undefined, id: path.split('/').pop(), data: () => structuredClone(data) };
    };
    return {
      path,
      _read: readSnap, // channel-neutral: tx.get logs its own channel
      get: async () => { readLog.push(['get', path]); return readSnap(); },
      set: async (data) => { store.set(path, structuredClone(data)); writeLog.push(['set', path]); },
      update: async (updates) => {
        const data = store.get(path);
        if (data === undefined) throw new Error(`update on missing doc ${path}`);
        applyDotPathUpdate(data, updates);
        writeLog.push(['update', path]);
      },
      delete: async () => { store.delete(path); writeLog.push(['delete', path]); },
      collection: (sub) => makeCollection(`${path}/${sub}`),
    };
  }

  function topLevelDocs(prefix) {
    const docs = [];
    for (const [path, data] of store.entries()) {
      if (!path.startsWith(`${prefix}/`)) continue;
      const rel = path.slice(prefix.length + 1);
      if (rel.includes('/')) continue;
      docs.push({ id: rel, data: () => structuredClone(data) });
    }
    return docs;
  }

  function makeCollection(prefix) {
    return {
      path: prefix,
      doc: (id) => (id === undefined ? makeDocRef(`${prefix}/auto-${autoId += 1}`) : makeDocRef(`${prefix}/${id}`)),
      add: async (data) => {
        const ref = makeDocRef(`${prefix}/auto-${autoId += 1}`);
        store.set(ref.path, structuredClone(data));
        writeLog.push(['add', ref.path]);
        return { id: ref.path.split('/').pop(), path: ref.path };
      },
      _read: () => snapshotOf(topLevelDocs(prefix)), // channel-neutral: tx.get logs its own channel
      where: (field, op, value) => makeQuery([{ field, op, value }]),
      get: async () => { readLog.push(['get', prefix]); return snapshotOf(topLevelDocs(prefix)); },
    };

    /**
     * A CHAINABLE query: `.where()` again, `.orderBy()`, `.limit()`, `.select()`,
     * `.get()`, and `_read()` so a TRANSACTIONAL query read (`tx.get(query)` —
     * the Admin SDK shape the Backing Beta close transaction uses) resolves the
     * same way a doc ref does. Purely additive: the pre-existing single-`where`
     * `.get()` and `.where().select().get()` forms behave exactly as before.
     *
     * `==` and `in` are applied as filters (`in` since Backing Beta PR 5 — the
     * trainer-stats query's status disjunction); any other operator is
     * recorded and ignored, which is the fixture's documented limit rather
     * than a silent wrong answer — a suite needing `>=` must assert on the
     * filtered set itself.
     */
    function makeQuery(filters, order = null, max = null) {
      const run = () => {
        let docs = topLevelDocs(prefix).filter(d => filters.every((f) => {
          if (f.op === 'in') return Array.isArray(f.value) && f.value.includes(d.data()[f.field]);
          if (f.op !== '==') return true;
          return d.data()[f.field] === f.value;
        }));
        if (order) {
          const { field, dir } = order;
          docs = [...docs].sort((a, b) => {
            const av = a.data()[field];
            const bv = b.data()[field];
            if (av === bv) return 0;
            const cmp = av > bv ? 1 : -1;
            return dir === 'desc' ? -cmp : cmp;
          });
        }
        return snapshotOf(max == null ? docs : docs.slice(0, max));
      };
      return {
        path: prefix,
        where: (field, op, value) => makeQuery([...filters, { field, op, value }], order, max),
        orderBy: (field, dir = 'asc') => makeQuery(filters, { field, dir }, max),
        limit: (n) => makeQuery(filters, order, n),
        select: () => ({ get: async () => { readLog.push(['get', prefix]); return run(); } }),
        _read: run, // channel-neutral: tx.get logs its own channel
        get: async () => { readLog.push(['get', prefix]); return run(); },
      };
    }

    function snapshotOf(docs) {
      return { docs, empty: docs.length === 0, size: docs.length, forEach: (cb) => docs.forEach(cb) };
    }
  }

  const db = {
    collection: (name) => makeCollection(name),
    batch: () => {
      const ops = [];
      return {
        set: (ref, data) => { ops.push(() => { store.set(ref.path, structuredClone(data)); writeLog.push(['batch.set', ref.path]); }); },
        update: (ref, updates) => {
          ops.push(() => {
            const data = store.get(ref.path);
            if (data === undefined) throw new Error(`batch.update on missing doc ${ref.path}`);
            applyDotPathUpdate(data, updates);
            writeLog.push(['batch.update', ref.path]);
          });
        },
        delete: (ref) => { ops.push(() => { store.delete(ref.path); writeLog.push(['batch.delete', ref.path]); }); },
        commit: async () => { for (const op of ops) op(); },
      };
    },
    runTransaction: async (fn) => fn({
      get: async (ref) => { readLog.push(['tx.get', ref.path]); return ref._read ? ref._read() : ref.get(); },
      update: (ref, updates) => {
        const data = store.get(ref.path);
        if (data === undefined) throw new Error(`tx.update on missing doc ${ref.path}`);
        applyDotPathUpdate(data, updates);
        writeLog.push(['tx.update', ref.path]);
      },
      set: (ref, data) => { store.set(ref.path, structuredClone(data)); writeLog.push(['tx.set', ref.path]); },
      create: (ref, data) => {
        if (store.has(ref.path)) { const e = new Error(`ALREADY_EXISTS: ${ref.path}`); e.code = 6; throw e; }
        store.set(ref.path, structuredClone(data)); writeLog.push(['tx.create', ref.path]);
      },
    }),
  };

  return { db, store, writeLog, readLog };
}
