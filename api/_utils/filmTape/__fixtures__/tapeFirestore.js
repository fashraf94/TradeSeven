// api/_utils/filmTape/__fixtures__/tapeFirestore.js
//
// An in-memory Firestore for the tape suites. The shared stand-in
// (api/_utils/__fixtures__/inMemoryFirestore.js) documents that it ignores
// range operators and has no collection groups; the tape needs both, and
// real transaction semantics, so this one supports:
//
//   · doc get / set / update (dot paths) / create / delete, subcollections;
//   · queries: where(==, in, <, <=, >, >=) on dotted field paths, orderBy,
//     limit, select; collectionGroup(name);
//   · runTransaction with OPTIMISTIC concurrency: every doc read in the
//     transaction is versioned, and a commit whose read set changed retries the
//     whole function (up to 5 attempts), as Firestore does. `hooks.afterTxRead`
//     lets a test land a concurrent write between a transaction's read and its
//     commit;
//   · a write log and a read log (paths), so a suite can assert exactly what
//     was touched — zero writes, never a tickBodies read, only tape paths.

const clone = (v) => (v === undefined ? undefined : structuredClone(v));

function getPath(obj, dotted) {
  let node = obj;
  for (const part of dotted.split('.')) {
    if (node == null || typeof node !== 'object') return undefined;
    node = node[part];
  }
  return node;
}

function applyDotPathUpdate(target, updates) {
  for (const [key, value] of Object.entries(updates)) {
    const parts = key.split('.');
    let node = target;
    for (let i = 0; i < parts.length - 1; i += 1) {
      if (typeof node[parts[i]] !== 'object' || node[parts[i]] == null) node[parts[i]] = {};
      node = node[parts[i]];
    }
    node[parts[parts.length - 1]] = clone(value);
  }
}

function compare(a, b) {
  if (a === b) return 0;
  if (a === undefined || a === null) return -1;
  if (b === undefined || b === null) return 1;
  return a < b ? -1 : 1;
}

function matches(data, { field, op, value }) {
  const v = getPath(data, field);
  switch (op) {
    case '==': return v === value;
    case 'in': return Array.isArray(value) && value.includes(v);
    case '<': return v !== undefined && v !== null && v < value;
    case '<=': return v !== undefined && v !== null && v <= value;
    case '>': return v !== undefined && v !== null && v > value;
    case '>=': return v !== undefined && v !== null && v >= value;
    default: throw new Error(`tapeFirestore: unsupported operator ${op}`);
  }
}

export function makeTapeDb(initial = {}, { hooks = {} } = {}) {
  const store = new Map(Object.entries(initial).map(([k, v]) => [k, clone(v)]));
  const versions = new Map();
  const writeLog = [];
  const readLog = [];
  let failNextTx = 0;

  const bump = (path) => versions.set(path, (versions.get(path) || 0) + 1);
  const put = (path, data, op) => { store.set(path, clone(data)); bump(path); writeLog.push({ op, path }); };

  const snapOf = (path) => {
    const data = store.get(path);
    return { exists: data !== undefined, id: path.split('/').pop(), ref: docRef(path), data: () => clone(data) };
  };

  function docRef(path) {
    return {
      path,
      id: path.split('/').pop(),
      get: async () => { readLog.push(path); return snapOf(path); },
      set: async (data, opts) => {
        if (opts?.merge && store.has(path)) { const cur = clone(store.get(path)); Object.assign(cur, clone(data)); put(path, cur, 'set'); } else put(path, data, 'set');
      },
      update: async (updates) => {
        if (!store.has(path)) throw new Error(`update on missing doc ${path}`);
        const cur = clone(store.get(path)); applyDotPathUpdate(cur, updates); put(path, cur, 'update');
      },
      create: async (data) => {
        if (store.has(path)) { const e = new Error(`ALREADY_EXISTS: ${path}`); e.code = 6; throw e; }
        put(path, data, 'create');
      },
      delete: async () => { store.delete(path); bump(path); writeLog.push({ op: 'delete', path }); },
      collection: (sub) => collectionRef(`${path}/${sub}`),
    };
  }

  function childrenOf(prefix) {
    const out = [];
    for (const path of store.keys()) {
      if (!path.startsWith(`${prefix}/`)) continue;
      if (path.slice(prefix.length + 1).includes('/')) continue;
      out.push(path);
    }
    return out;
  }

  function groupMembers(name) {
    const out = [];
    for (const path of store.keys()) {
      const parts = path.split('/');
      if (parts.length >= 2 && parts.length % 2 === 0 && parts[parts.length - 2] === name) out.push(path);
    }
    return out;
  }

  function makeQuery(source, filters = [], order = [], max = null, label = source.label) {
    const run = () => {
      let paths = source.paths().filter((p) => filters.every((f) => matches(store.get(p), f)));
      if (order.length) {
        paths = [...paths].sort((pa, pb) => {
          for (const { field, dir } of order) {
            const c = compare(getPath(store.get(pa), field), getPath(store.get(pb), field));
            if (c !== 0) return dir === 'desc' ? -c : c;
          }
          return pa < pb ? -1 : 1;
        });
      }
      if (max !== null) paths = paths.slice(0, max);
      readLog.push(label);
      const docs = paths.map(snapOf);
      return { docs, empty: docs.length === 0, size: docs.length, forEach: (cb) => docs.forEach(cb) };
    };
    return {
      where: (field, op, value) => makeQuery(source, [...filters, { field, op, value }], order, max, label),
      orderBy: (field, dir = 'asc') => makeQuery(source, filters, [...order, { field, dir }], max, label),
      limit: (n) => makeQuery(source, filters, order, n, label),
      select: () => makeQuery(source, filters, order, max, label),
      get: async () => run(),
      _paths: () => { const s = run(); return s.docs.map((d) => d.ref.path); },
    };
  }

  function collectionRef(prefix) {
    const q = makeQuery({ paths: () => childrenOf(prefix), label: prefix });
    return { ...q, path: prefix, doc: (id) => docRef(`${prefix}/${id}`) };
  }

  const db = {
    batch() {
      const ops = [];
      return {
        set: (ref, data) => { ops.push(() => put(ref.path, data, 'batch.set')); },
        update: (ref, updates) => {
          ops.push(() => {
            if (!store.has(ref.path)) throw new Error(`batch.update on missing doc ${ref.path}`);
            const cur = clone(store.get(ref.path)); applyDotPathUpdate(cur, updates); put(ref.path, cur, 'batch.update');
          });
        },
        delete: (ref) => { ops.push(() => { store.delete(ref.path); bump(ref.path); writeLog.push({ op: 'batch.delete', path: ref.path }); }); },
        commit: async () => { if (hooks.failBatch) throw new Error('batch_failed_by_test'); for (const op of ops) op(); },
      };
    },
    collection: (name) => collectionRef(name),
    collectionGroup: (name) => makeQuery({ paths: () => groupMembers(name), label: `group:${name}` }),
    async runTransaction(fn) {
      for (let attempt = 1; attempt <= 5; attempt += 1) {
        const reads = new Map();
        const ops = [];
        const tx = {
          get: async (ref) => {
            readLog.push(`tx:${ref.path}`);
            reads.set(ref.path, versions.get(ref.path) || 0);
            const snap = snapOf(ref.path);
            if (hooks.afterTxRead) await hooks.afterTxRead(ref.path, db);
            return snap;
          },
          set: (ref, data) => { ops.push(() => put(ref.path, data, 'tx.set')); },
          update: (ref, updates) => {
            ops.push(() => {
              if (!store.has(ref.path)) throw new Error(`tx.update on missing doc ${ref.path}`);
              const cur = clone(store.get(ref.path)); applyDotPathUpdate(cur, updates); put(ref.path, cur, 'tx.update');
            });
          },
          create: (ref, data) => {
            ops.push(() => {
              if (store.has(ref.path)) { const e = new Error(`ALREADY_EXISTS: ${ref.path}`); e.code = 6; throw e; }
              put(ref.path, data, 'tx.create');
            });
          },
        };
        const out = await fn(tx);
        if (failNextTx > 0) { failNextTx -= 1; throw new Error('tx_failed_by_test'); }
        const conflict = [...reads.entries()].some(([p, v]) => (versions.get(p) || 0) !== v);
        if (conflict) { db.txRetries += 1; continue; }
        for (const op of ops) op();
        return out;
      }
      throw new Error('transaction contention: 5 attempts');
    },
    txRetries: 0,
    failNextTransactions(n) { failNextTx = n; },
  };

  return { db, store, writeLog, readLog, docRef };
}
