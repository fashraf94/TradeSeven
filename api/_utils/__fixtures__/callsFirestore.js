// api/_utils/__fixtures__/callsFirestore.js
//
// Cockpit Build 1a — a GENERAL in-memory Firestore double for the answer
// endpoint, the heard writer, the chat calls block and the sweep: many
// battles, nested subcollections, top-level collections, ordered queries with
// cursors, batches and OPTIMISTIC transactions with a conflict set. Build 0's
// single-battle double (callRecordsStore.js) is untouched for its frozen
// suites; this one is path-keyed from the start.
//
//   · docs: a Map path → data; `collection(name).doc(id).collection(sub)…`
//   · queries: where (==, in, >, >=, <, <=), orderBy (field | '__name__',
//     asc | desc, several), startAfter(values…), limit — served in index
//     order; a document missing an order-by field is not in the index
//     (Firestore's rule); `__name__` is the document id
//   · transactions: reads record versions; writes buffer until commit; a read
//     whose document moved retries the body (≤ 5); `create` on an existing
//     document fails ALREADY_EXISTS and applies nothing; a read after a
//     buffered write throws as the Admin SDK does; hooks between body and
//     commit let a row land a competing write
//   · batches: buffered update / set / create / delete, committed together
//   · access: every read, write and query is logged with its path, so a row
//     can assert ZERO calls-store I/O, or that a 404 came before a call read
//   · a runaway guard: more than MAX_QUERIES queries on one store throws
//
// ZERO product imports.

export const MAX_QUERIES = 2_000;
const NAME = '__name__';

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
  && (v.constructor === Object || v.constructor === undefined);
const clone = (v) => (v === undefined ? undefined : structuredClone(v));

function setPath(obj, dotted, value) {
  const parts = dotted.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!isPlainObject(cur[parts[i]])) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}
function getPath(obj, dotted) {
  let cur = obj;
  for (const part of dotted.split('.')) {
    if (cur == null) return undefined;
    cur = cur[part];
  }
  return cur;
}
function mergeDeep(target, source) {
  const out = isPlainObject(target) ? { ...target } : {};
  for (const [k, v] of Object.entries(source)) {
    out[k] = isPlainObject(v) && isPlainObject(out[k]) ? mergeDeep(out[k], v) : clone(v);
  }
  return out;
}
function assertNoUndefined(payload, what) {
  const bad = [];
  const walk = (v, path) => {
    if (v === undefined) { bad.push(path || '<root>'); return; }
    if (v === null || typeof v !== 'object') return;
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
    else for (const [k, x] of Object.entries(v)) walk(x, path ? `${path}.${k}` : k);
  };
  walk(payload, '');
  if (bad.length) throw new Error(`callsFirestore: ${what} carries undefined (Firestore rejects it) at ${bad.join(', ')}`);
}
/** The FieldValue sentinels the routes use (firebase-admin/firestore is mocked to these in the suites). */
export const FieldValueDouble = Object.freeze({
  arrayUnion: (...items) => ({ __op: 'arrayUnion', items }),
  increment: (n) => ({ __op: 'increment', n }),
});
function applyUpdateValue(existing, v) {
  if (v && typeof v === 'object' && v.__op === 'arrayUnion') return [...(Array.isArray(existing) ? existing : []), ...v.items.map(clone)];
  if (v && typeof v === 'object' && v.__op === 'increment') return (typeof existing === 'number' ? existing : 0) + v.n;
  return clone(v);
}
function alreadyExists(path) { const e = new Error(`6 ALREADY_EXISTS: Document already exists: ${path}`); e.code = 6; return e; }
/** The Admin SDK's rule (write-batch.js): an update must name at least one field. */
function assertNonEmptyUpdate(data, what) {
  if (!data || typeof data !== 'object' || Object.keys(data).length === 0) throw new Error(`${what}: At least one field must be updated.`);
}
function notFound(path) { const e = new Error(`5 NOT_FOUND: No document to update: ${path}`); e.code = 5; return e; }
function compareValues(a, b) {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a < b ? -1 : 1;
  return String(a) < String(b) ? -1 : 1;
}

/**
 * @param {{ docs?: Record<string, object> }} [init]  initial documents by path
 */
export function makeCallsFirestore({ docs: initial = {} } = {}) {
  const docs = new Map();
  const versions = new Map();
  const access = { reads: [], writes: [], queries: [] };
  const hooks = { afterTxBody: null, beforeCommit: null, afterCommit: null, failQuery: null, afterQuery: null };
  let txAttempts = 0;
  for (const [path, data] of Object.entries(initial)) docs.set(path, clone(data));

  const bump = (path) => versions.set(path, (versions.get(path) || 0) + 1);
  const versionOf = (path) => versions.get(path) || 0;
  const snapOf = (path, ref) => {
    const data = docs.get(path);
    return { exists: data !== undefined, id: path.split('/').pop(), ref, data: () => clone(data) };
  };

  const applyWrite = (w) => {
    const { op, path, data, opts } = w;
    if (op === 'create') {
      if (docs.has(path)) throw alreadyExists(path);
      docs.set(path, clone(data));
    } else if (op === 'set') {
      docs.set(path, opts?.merge ? mergeDeep(docs.get(path), data) : clone(data));
    } else if (op === 'update') {
      if (!docs.has(path)) throw notFound(path);
      const next = clone(docs.get(path));
      for (const [k, v] of Object.entries(data)) setPath(next, k, applyUpdateValue(getPath(next, k), v));
      docs.set(path, next);
    } else if (op === 'delete') {
      docs.delete(path);
    }
    bump(path);
    access.writes.push({ op, path, data: clone(data), merge: opts?.merge === true });
  };

  function makeDocRef(path) {
    const id = path.split('/').pop();
    const ref = {
      path, id, __callsStore: true,
      async get() { access.reads.push(path); return snapOf(path, ref); },
      async create(data) { assertNoUndefined(data, `create(${path})`); applyWrite({ op: 'create', path, data }); },
      async set(data, opts) { assertNoUndefined(data, `set(${path})`); applyWrite({ op: 'set', path, data, opts }); },
      async update(data) { assertNoUndefined(data, `update(${path})`); assertNonEmptyUpdate(data, `update(${path})`); applyWrite({ op: 'update', path, data }); },
      async delete() { applyWrite({ op: 'delete', path, data: null }); },
      collection: (sub) => makeCollection(`${path}/${sub}`),
    };
    return ref;
  }

  function makeQuery(collectionPath, state = { filters: [], orders: [], startAfter: null, endAt: null, limit: null }) {
    return {
      __queryShape: () => clone({ collectionPath, ...state }),
      where(field, op, value) { return makeQuery(collectionPath, { ...state, filters: [...state.filters, { field, op, value }] }); },
      orderBy(field, dir = 'asc') { return makeQuery(collectionPath, { ...state, orders: [...state.orders, { field: String(field), dir }] }); },
      startAfter(...values) { return makeQuery(collectionPath, { ...state, startAfter: values }); },
      endAt(...values) { return makeQuery(collectionPath, { ...state, endAt: values }); },
      limit(n) { return makeQuery(collectionPath, { ...state, limit: n }); },
      async get() {
        access.queries.push(clone({ collectionPath, ...state }));
        if (access.queries.length > MAX_QUERIES) throw new Error(`callsFirestore: runaway — more than ${MAX_QUERIES} queries on one store`);
        if (hooks.failQuery) { const err = typeof hooks.failQuery === 'function' ? hooks.failQuery({ collectionPath, ...clone(state) }) : hooks.failQuery; if (err) throw err; }
        const prefix = `${collectionPath}/`;
        let rows = [...docs.entries()]
          .filter(([p]) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'))
          .map(([p, d]) => ({ path: p, id: p.slice(prefix.length), data: d }));
        for (const f of state.filters) {
          rows = rows.filter((r) => {
            const v = getPath(r.data, f.field);
            switch (f.op) {
              case '==': return v === f.value;
              case '!=': return v !== f.value;
              case 'in': return Array.isArray(f.value) && f.value.includes(v);
              case '>': return v !== undefined && v !== null && compareValues(v, f.value) > 0;
              case '>=': return v !== undefined && v !== null && compareValues(v, f.value) >= 0;
              case '<': return v !== undefined && v !== null && compareValues(v, f.value) < 0;
              case '<=': return v !== undefined && v !== null && compareValues(v, f.value) <= 0;
              default: throw new Error(`callsFirestore: unsupported filter op ${f.op}`);
            }
          });
        }
        // Firestore serves an ordered query from its index: a document missing an order-by field is not in it.
        rows = rows.filter((r) => state.orders.every((o) => o.field === NAME || getPath(r.data, o.field) !== undefined));
        const keyOf = (r) => state.orders.map((o) => (o.field === NAME ? r.id : getPath(r.data, o.field)));
        if (state.orders.length === 0) rows.sort((a, b) => compareValues(a.id, b.id));
        rows.sort((a, b) => {
          const ka = keyOf(a); const kb = keyOf(b);
          for (let i = 0; i < ka.length; i++) {
            const c = compareValues(ka[i], kb[i]);
            if (c !== 0) return state.orders[i].dir === 'desc' ? -c : c;
          }
          return compareValues(a.id, b.id);
        });
        const cmpCursor = (r, cursor) => {
          const k = keyOf(r);
          for (let i = 0; i < cursor.length; i++) {
            const c = compareValues(k[i], cursor[i]);
            if (c !== 0) return state.orders[i]?.dir === 'desc' ? -c : c;
          }
          return 0;
        };
        if (state.startAfter) rows = rows.filter((r) => cmpCursor(r, state.startAfter) > 0);
        if (state.endAt) rows = rows.filter((r) => cmpCursor(r, state.endAt) <= 0);
        if (Number.isFinite(state.limit)) rows = rows.slice(0, state.limit);
        for (const r of rows) access.reads.push(r.path);
        if (hooks.afterQuery) await hooks.afterQuery({ collectionPath, rows: rows.length });
        const out = rows.map((r) => { const ref = makeDocRef(r.path); return { id: r.id, ref, exists: true, data: () => clone(r.data) }; });
        return { docs: out, size: out.length, empty: out.length === 0, forEach: (cb) => out.forEach(cb) };
      },
      count() {
        const self = this;
        return { get: async () => { const res = await self.get(); return { data: () => ({ count: res.size }) }; } };
      },
    };
  }
  function makeCollection(collectionPath) {
    const q = makeQuery(collectionPath);
    return { ...q, path: collectionPath, doc: (id) => makeDocRef(`${collectionPath}/${id}`) };
  }

  const db = {
    __docs: docs,
    __access: access,
    __hooks: hooks,
    get __txAttempts() { return txAttempts; },
    __versionOf: versionOf,
    collection: (name) => makeCollection(name),
    doc: (path) => makeDocRef(path),
    async getAll(...refs) { return Promise.all(refs.map((r) => r.get())); },
    batch() {
      const writes = [];
      return {
        update(ref, data) { assertNoUndefined(data, `batch.update(${ref.path})`); assertNonEmptyUpdate(data, `batch.update(${ref.path})`); writes.push({ op: 'update', path: ref.path, data: clone(data) }); return this; },
        set(ref, data, opts) { assertNoUndefined(data, `batch.set(${ref.path})`); writes.push({ op: 'set', path: ref.path, data: clone(data), opts }); return this; },
        create(ref, data) { assertNoUndefined(data, `batch.create(${ref.path})`); writes.push({ op: 'create', path: ref.path, data: clone(data) }); return this; },
        delete(ref) { writes.push({ op: 'delete', path: ref.path, data: null }); return this; },
        async commit() {
          for (const w of writes) if (w.op === 'create' && docs.has(w.path)) throw alreadyExists(w.path);
          for (const w of writes) applyWrite(w);
          access.writes.push({ op: 'batchCommit', path: null, data: null, merge: false });
        },
      };
    },
    async runTransaction(cb) {
      for (let attempt = 1; attempt <= 5; attempt++) {
        txAttempts += 1;
        const reads = new Map();
        const writes = [];
        const readsBeforeWrites = () => {
          if (writes.length > 0) throw new Error('Firestore transactions require all reads to be executed before all writes.');
        };
        const tx = {
          async get(refOrQuery) {
            readsBeforeWrites();
            if (typeof refOrQuery?.__queryShape === 'function') {
              const res = await refOrQuery.get();
              for (const d of res.docs) reads.set(d.ref.path, versionOf(d.ref.path));
              return res;
            }
            reads.set(refOrQuery.path, versionOf(refOrQuery.path));
            return refOrQuery.get();
          },
          async getAll(...refs) { readsBeforeWrites(); return Promise.all(refs.map((r) => tx.get(r))); },
          create(ref, data) { assertNoUndefined(data, `tx.create(${ref.path})`); writes.push({ op: 'create', path: ref.path, data: clone(data) }); return tx; },
          set(ref, data, opts) { assertNoUndefined(data, `tx.set(${ref.path})`); writes.push({ op: 'set', path: ref.path, data: clone(data), opts }); return tx; },
          update(ref, data) { assertNoUndefined(data, `tx.update(${ref.path})`); assertNonEmptyUpdate(data, `tx.update(${ref.path})`); writes.push({ op: 'update', path: ref.path, data: clone(data) }); return tx; },
          delete(ref) { writes.push({ op: 'delete', path: ref.path, data: null }); return tx; },
        };
        const result = await cb(tx);
        if (hooks.afterTxBody) await hooks.afterTxBody({ attempt, readPaths: [...reads.keys()], writes });
        let conflict = false;
        for (const [path, v] of reads) if (versionOf(path) !== v) conflict = true;
        if (conflict) continue;
        if (hooks.beforeCommit) await hooks.beforeCommit({ attempt, writes });
        for (const w of writes) if (w.op === 'create' && docs.has(w.path)) throw alreadyExists(w.path);
        for (const w of writes) applyWrite(w);
        if (hooks.afterCommit) await hooks.afterCommit({ attempt, writes });
        return result;
      }
      const err = new Error('10 ABORTED: Too much contention on these documents.');
      err.code = 10;
      throw err;
    },
  };
  return db;
}

/** A stored document (deep copy) or null. */
export function stored(db, path) {
  const d = db.__docs.get(path);
  return d === undefined ? null : clone(d);
}
/** Every stored document under a collection path, keyed by id. */
export function storedUnder(db, collectionPath) {
  const prefix = `${collectionPath}/`;
  const out = {};
  for (const [p, d] of db.__docs) if (p.startsWith(prefix) && !p.slice(prefix.length).includes('/')) out[p.slice(prefix.length)] = clone(d);
  return out;
}
/** Reads / writes / queries whose path matches a predicate (default: every call-record path). */
export function touches(db, pred = (p) => /\/calls\/|\/declarations\/|\/callObservations\/|\/callEvents\/|^callSweepQueue\/|^callSweepState\//.test(p)) {
  const a = db.__access;
  return {
    reads: a.reads.filter(pred).length,
    writes: a.writes.filter((w) => w.path && pred(w.path)).length,
    queries: a.queries.filter((q) => pred(`${q.collectionPath}/`)).length,
  };
}
/** Reset the access log (keeps the documents). */
export function resetAccess(db) {
  db.__access.reads.length = 0;
  db.__access.writes.length = 0;
  db.__access.queries.length = 0;
}
