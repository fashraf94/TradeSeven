// api/_utils/sharedResearch/__fixtures__/srFirestore.js
//
// An in-memory Firestore double for the Shared Research store and route tests,
// with ATOMIC transactions: reads see the committed store, writes are buffered
// and applied only when the transaction function returns — a throw writes
// nothing (the shared inMemoryFirestore.js applies transaction writes at once,
// which would hide a partial write). Supports doc get/set/update (dot paths)/
// create/delete, sub-collections, auto ids, chainable where('=='), orderBy,
// limit, tx.get(ref | query). `writes` logs every committed write; `hooks.atTxStart`
// lets a test change the store just before a transaction's reads (after any
// pre-check outside it), `hooks.beforeCommit` between its reads and its commit.

const clone = (v) => (v === undefined ? undefined : structuredClone(v));

function applyUpdate(target, updates) {
  for (const [key, value] of Object.entries(updates)) {
    const parts = key.split('.');
    let node = target;
    for (let i = 0; i < parts.length - 1; i++) {
      if (typeof node[parts[i]] !== 'object' || node[parts[i]] === null) node[parts[i]] = {};
      node = node[parts[i]];
    }
    node[parts.at(-1)] = clone(value);
  }
}

export function makeSrFirestore(initial = {}) {
  const store = new Map(Object.entries(initial).map(([k, v]) => [k, clone(v)]));
  const writes = [];
  const reads = [];
  const hooks = { beforeCommit: null, atTxStart: null };
  let auto = 0;

  const snapOf = (path) => {
    const data = store.get(path);
    return { exists: data !== undefined, id: path.split('/').at(-1), ref: docRef(path), data: () => clone(data) };
  };
  function docRef(path) {
    return {
      path,
      id: path.split('/').at(-1),
      _read: () => snapOf(path),
      get: async () => { reads.push(['get', path]); return snapOf(path); },
      set: async (data) => { store.set(path, clone(data)); writes.push(['set', path]); },
      update: async (u) => { if (!store.has(path)) throw new Error(`update on missing ${path}`); applyUpdate(store.get(path), u); writes.push(['update', path]); },
      delete: async () => { store.delete(path); writes.push(['delete', path]); },
      collection: (sub) => collectionRef(`${path}/${sub}`),
    };
  }
  function childrenOf(prefix) {
    const out = [];
    for (const [path] of store) {
      if (!path.startsWith(`${prefix}/`)) continue;
      if (path.slice(prefix.length + 1).includes('/')) continue;
      out.push(snapOf(path));
    }
    return out;
  }
  const get = (obj, field) => field.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
  function query(prefix, filters = [], order = null, max = null) {
    const run = () => {
      let docs = childrenOf(prefix).filter((d) => filters.every((f) => {
        const v = get(d.data(), f.field);
        if (f.op === '==') return v === f.value;
        if (f.op === 'in') return f.value.includes(v);
        if (f.op === 'array-contains') return Array.isArray(v) && v.includes(f.value);
        throw new Error(`srFirestore: operator ${f.op} not supported`);
      }));
      if (order) {
        docs = [...docs].sort((a, b) => {
          const av = get(a.data(), order.field);
          const bv = get(b.data(), order.field);
          const c = av === bv ? 0 : av > bv ? 1 : -1;
          return order.dir === 'desc' ? -c : c;
        });
      }
      if (max !== null) docs = docs.slice(0, max);
      return { docs, empty: docs.length === 0, size: docs.length, forEach: (cb) => docs.forEach(cb) };
    };
    return {
      path: prefix,
      where: (field, op, value) => query(prefix, [...filters, { field, op, value }], order, max),
      orderBy: (field, dir = 'asc') => query(prefix, filters, { field, dir }, max),
      limit: (n) => query(prefix, filters, order, n),
      _read: run,
      get: async () => { reads.push(['query', prefix]); return run(); },
    };
  }
  function collectionRef(prefix) {
    const q = query(prefix);
    return {
      ...q,
      doc: (id) => docRef(`${prefix}/${id ?? `auto-${++auto}`}`),
    };
  }

  const db = {
    collection: (name) => collectionRef(name),
    runTransaction: async (fn) => {
      if (hooks.atTxStart) { const h = hooks.atTxStart; hooks.atTxStart = null; await h(store); }
      const ops = [];
      const tx = {
        get: async (refOrQuery) => { reads.push(['tx.get', refOrQuery.path]); return refOrQuery._read(); },
        set: (ref, data) => { ops.push(['set', ref.path, data]); return tx; },
        update: (ref, data) => { ops.push(['update', ref.path, data]); return tx; },
        create: (ref, data) => { ops.push(['create', ref.path, data]); return tx; },
        delete: (ref) => { ops.push(['delete', ref.path]); return tx; },
      };
      const result = await fn(tx);
      if (hooks.beforeCommit) { const h = hooks.beforeCommit; hooks.beforeCommit = null; await h(store); }
      // Validate every op before applying any: the commit is all or nothing.
      for (const [op, path] of ops) {
        if (op === 'create' && store.has(path)) { const e = new Error(`ALREADY_EXISTS: ${path}`); e.code = 6; throw e; }
        if (op === 'update' && !store.has(path)) throw new Error(`NOT_FOUND: update on missing ${path}`);
      }
      for (const [op, path, data] of ops) {
        if (op === 'delete') store.delete(path);
        else if (op === 'update') applyUpdate(store.get(path), data);
        else store.set(path, clone(data));
        writes.push([`tx.${op}`, path]);
      }
      return result;
    },
  };
  return { db, store, writes, reads, hooks, doc: (path) => clone(store.get(path)) };
}
