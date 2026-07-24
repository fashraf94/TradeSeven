// api/_utils/__fixtures__/wireFirestoreFake.js
// In-memory Firestore Admin fake for the Wire test suites.
//
// Supports exactly what the Wire modules use: collection/doc refs, get/set/
// update/delete/add, batch, runTransaction (with OPTIMISTIC RETRY — a
// concurrent commit between a transaction's read and its write forces a
// re-run, which is how the §9 chain-serialization test exercises B6), and
// equality/orderBy/limit queries incl. the '<' operator the orphan drain
// uses. NOT a general emulator — just enough surface, kept honest.

export function createFirestoreFake() {
  // path 'collection/docId' → plain-object data
  const store = new Map();
  let idCounter = 0;
  let txVersion = 0; // bumped on every committed write; transactions verify

  const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

  function docRef(collectionName, docId) {
    const path = `${collectionName}/${docId}`;
    return {
      id: docId,
      path,
      async get() {
        return snapOf(collectionName, docId);
      },
      async set(data) {
        commitWrite(path, clone(data));
      },
      async update(patch) {
        applyUpdate(path, patch);
      },
      async delete() {
        commitDelete(path);
      },
    };
  }

  function snapOf(collectionName, docId) {
    const path = `${collectionName}/${docId}`;
    const exists = store.has(path);
    return {
      id: docId,
      exists,
      ref: docRef(collectionName, docId),
      data: () => (exists ? clone(store.get(path)) : undefined),
    };
  }

  function commitWrite(path, data) {
    store.set(path, data);
    txVersion += 1;
  }

  function commitDelete(path) {
    store.delete(path);
    txVersion += 1;
  }

  function applyUpdate(path, patch) {
    if (!store.has(path)) throw new Error(`update() on missing doc ${path}`);
    const next = { ...store.get(path) };
    for (const [k, v] of Object.entries(clone(patch))) next[k] = v;
    commitWrite(path, next);
  }

  function query(collectionName) {
    const filters = [];
    let orderField = null;
    let orderDir = 'asc';
    let limitN = Infinity;
    const q = {
      where(field, op, value) { filters.push({ field, op, value }); return q; },
      orderBy(field, dir = 'asc') { orderField = field; orderDir = dir; return q; },
      limit(n) { limitN = n; return q; },
      async get() {
        const docs = [];
        for (const [path, data] of store.entries()) {
          const [col, id] = splitPath(path);
          if (col !== collectionName) continue;
          if (!filters.every((f) => matches(data[f.field], f.op, f.value))) continue;
          docs.push({ id, data });
        }
        if (orderField) {
          docs.sort((a, b) => cmp(a.data[orderField], b.data[orderField]) * (orderDir === 'desc' ? -1 : 1));
        }
        const limited = docs.slice(0, limitN).map(({ id }) => snapOf(collectionName, id));
        return { empty: limited.length === 0, size: limited.length, docs: limited };
      },
    };
    return q;
  }

  function matches(actual, op, expected) {
    switch (op) {
      case '==': return valueOf(actual) === valueOf(expected);
      case '<': return cmp(actual, expected) < 0;
      case '>': return cmp(actual, expected) > 0;
      default: throw new Error(`fake: unsupported operator ${op}`);
    }
  }

  function valueOf(v) {
    if (v instanceof Date) return v.getTime();
    return v;
  }

  function cmp(a, b) {
    const av = normalizeForCompare(a);
    const bv = normalizeForCompare(b);
    if (av < bv) return -1;
    if (av > bv) return 1;
    return 0;
  }

  function normalizeForCompare(v) {
    if (v instanceof Date) return v.getTime();
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return new Date(v).getTime();
    return v;
  }

  function splitPath(path) {
    const idx = path.indexOf('/');
    return [path.slice(0, idx), path.slice(idx + 1)];
  }

  const db = {
    _store: store,
    _dump() {
      const out = {};
      for (const [k, v] of store.entries()) out[k] = clone(v);
      return out;
    },
    collection(name) {
      return {
        doc(id) {
          if (id === undefined) {
            idCounter += 1;
            return docRef(name, `auto-${String(idCounter).padStart(4, '0')}`);
          }
          return docRef(name, id);
        },
        async add(data) {
          const ref = this.doc();
          await ref.set(data);
          return ref;
        },
        where(field, op, value) { return query(name).where(field, op, value); },
        orderBy(field, dir) { return query(name).orderBy(field, dir); },
        limit(n) { return query(name).limit(n); },
      };
    },
    batch() {
      const ops = [];
      return {
        set(ref, data) { ops.push(() => commitWrite(ref.path, clone(data))); },
        update(ref, patch) { ops.push(() => applyUpdate(ref.path, patch)); },
        delete(ref) { ops.push(() => commitDelete(ref.path)); },
        async commit() { for (const op of ops) op(); },
      };
    },
    /**
     * Optimistic-retry transaction: reads record the store version; if a
     * concurrent commit (e.g. from `interleave`) bumped it before this
     * transaction commits, the attempt is discarded and re-run — mirroring
     * Firestore's serialization guarantee the chain tests rely on.
     */
    async runTransaction(fn) {
      for (let attempt = 0; attempt < 5; attempt++) {
        const readVersion = txVersion;
        const staged = [];
        const t = {
          async get(refOrQuery) {
            if (typeof refOrQuery.get === 'function') return refOrQuery.get();
            throw new Error('fake txn: unsupported get target');
          },
          set(ref, data) { staged.push(() => commitWrite(ref.path, clone(data))); },
          update(ref, patch) { staged.push(() => applyUpdate(ref.path, patch)); },
          delete(ref) { staged.push(() => commitDelete(ref.path)); },
        };
        const result = await fn(t);
        if (txVersion !== readVersion) continue; // contention → retry
        for (const op of staged) op();
        return result;
      }
      throw new Error('fake txn: too much contention');
    },
  };

  return db;
}
