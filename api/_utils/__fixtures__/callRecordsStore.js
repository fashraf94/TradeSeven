// api/_utils/__fixtures__/callRecordsStore.js
//
// Cockpit Build 0 — the doc-store EXTENSION the call-records suites drive.
//
// `makeTickDb` (tickStampsHarness.js) knows `agentBattles/{id}` get/update and
// a single-pass transaction; `withCaptureStore` (tickCaptureHarness.js) adds the
// capture batch. This module WRAPS both — the two shared fixtures stay exactly
// as the golden suites know them — and adds what the call records need:
//
//   · agentBattles/{id}/{calls,declarations,callObservations}/{docId} and the
//     top-level callSweepQueue/{battleId}: get / create / set(merge) / update
//   · the `calls` query the flip scan issues — where('state','==',…),
//     orderBy(field | '__name__'), startAfter / endAt cursors, limit — served
//     in index order (field value, then document id)
//   · an OPTIMISTIC transaction: reads record each document's version, writes
//     buffer until commit, a changed read retries the callback (≤ 5 attempts),
//     `create` on an existing document fails ALREADY_EXISTS and applies nothing,
//     and a read after a buffered write throws as the Admin SDK does. KNOWN GAP
//     (review D-7): the SDK backs off ~1 s (± 0.5 s) before retrying a
//     contended attempt; this double retries at once — a production flip that
//     is contended past its 800 ms ceiling is therefore `unconfirmed` where the
//     double resolves it. No assertion depends on the retry timing.
//     Every transactional write to the battle document still lands through the
//     base harness's own update, so `__updates` records exactly what it always
//     recorded (the frozen fixtures depend on that).
//   · `__callsAccess` — every read and write against the four call-record
//     collections, so a mode-off row can assert ZERO of each
//   · `__hooks` — the race and latency injections the publication and flip
//     rows need (a completion that commits between a transaction's reads and
//     its commit; a commit that lands late; a commit whose acknowledgement is
//     late; a failing query)
//   · a RUNAWAY GUARD: more than MAX_CALLS_QUERIES queries on one store throws.
//     The double resolves every query on microtasks, and the flip rows freeze
//     Date — so a scan whose cursor never advances would spin forever with no
//     timer able to fire. The guard makes such a defect fail its row instead
//     of hanging the worker (the Build 0 mutation battery hit exactly this).
//
// ZERO product imports beyond the two base fixtures (their own rule).

import { makeTickDb, deepClone } from './tickStampsHarness.js';
import { withCaptureStore } from './tickCaptureHarness.js';

/** The battle subcollections the call records own. */
export const CALL_SUBCOLLECTIONS = Object.freeze(['calls', 'declarations', 'callObservations']);
/** The top-level sweep queue. */
export const QUEUE_COLLECTION = 'callSweepQueue';

const NAME = '__name__';
/** No legitimate row issues more than a handful of queries; a runaway scan issues thousands. */
export const MAX_CALLS_QUERIES = 400;
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
  && (v.constructor === Object || v.constructor === undefined);

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
    out[k] = isPlainObject(v) && isPlainObject(out[k]) ? mergeDeep(out[k], v) : deepClone(v);
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
  if (bad.length) throw new Error(`calls store: ${what} carries undefined (Firestore rejects it) at ${bad.join(', ')}`);
}

/** Firestore's own error shape for a create on an existing document. */
function alreadyExists(path) {
  const err = new Error(`6 ALREADY_EXISTS: Document already exists: ${path}`);
  err.code = 6;
  return err;
}

/** Compare two cursor tuples in index order. */
function compareValues(a, b) {
  if (a === b) return 0;
  if (typeof a === 'number' && typeof b === 'number') return a < b ? -1 : 1;
  return String(a) < String(b) ? -1 : 1;
}

/**
 * @param {object} args  everything makeTickDb takes, plus
 * @param {object} [args.seed] pre-existing call-record documents:
 *   { calls: {id: data}, declarations: {id: data}, callObservations: {id: data}, queue: data|null }
 */
export function makeCallsDb({ seed = {}, abortFirstTransactionWithSeq = null, ...tickArgs } = {}) {
  const base = withCaptureStore(makeTickDb(tickArgs), { abortFirstTransactionWithSeq });
  const battleId = base.__store.battle.id;
  const docs = new Map();        // path → data (call-record collections only)
  const versions = new Map();    // path → integer (battle doc + call-record docs)
  const access = { reads: [], writes: [], queries: [] };
  const hooks = {
    /** async ({ attempt, readPaths, writes }) → void — runs after the body, before the conflict check. */
    afterTxBody: null,
    /** async ({ writes }) → void — runs after the conflict check, before the writes apply (a slow commit). */
    beforeCommit: null,
    /** async ({ writes }) → void — runs after the writes APPLIED, before the call returns (a late acknowledgement). */
    afterCommit: null,
    /** Error | null — the next calls query rejects with it. */
    failQuery: null,
    /** async ({ collectionPath, rows }) → void — runs after a calls query resolved its page, before it returns (a slow read). */
    afterQuery: null,
    /** number of transaction attempts seen (read-only for tests). */
  };
  let txAttempts = 0;

  const bump = (path) => versions.set(path, (versions.get(path) || 0) + 1);
  const versionOf = (path) => versions.get(path) || 0;
  const battlePath = `agentBattles/${battleId}`;

  for (const sub of CALL_SUBCOLLECTIONS) {
    for (const [id, data] of Object.entries(seed[sub] || {})) docs.set(`${battlePath}/${sub}/${id}`, deepClone(data));
  }
  if (seed.queue) docs.set(`${QUEUE_COLLECTION}/${battleId}`, deepClone(seed.queue));

  const snap = (path, id) => {
    const data = docs.get(path);
    return { exists: data !== undefined, id, ref: null, data: () => (data === undefined ? undefined : deepClone(data)) };
  };

  // ---- raw appliers (used by direct writes and by a committing transaction) --
  const applyWrite = (w) => {
    const { op, path, data, opts } = w;
    if (op === 'create') {
      if (docs.has(path)) throw alreadyExists(path);
      docs.set(path, deepClone(data));
    } else if (op === 'set') {
      docs.set(path, opts?.merge ? mergeDeep(docs.get(path), data) : deepClone(data));
    } else if (op === 'update') {
      if (!docs.has(path)) { const err = new Error(`5 NOT_FOUND: No document to update: ${path}`); err.code = 5; throw err; }
      const next = deepClone(docs.get(path));
      for (const [k, v] of Object.entries(data)) setPath(next, k, deepClone(v));
      docs.set(path, next);
    }
    bump(path);
    access.writes.push({ op, path, data: deepClone(data), merge: opts?.merge === true });
  };

  const makeCallsRef = (path, id) => {
    const ref = {
      path, id, __callsStore: true,
      async get() { access.reads.push(path); const s = snap(path, id); s.ref = ref; return s; },
      async create(data) { assertNoUndefined(data, `create(${path})`); applyWrite({ op: 'create', path, data }); },
      async set(data, opts) { assertNoUndefined(data, `set(${path})`); applyWrite({ op: 'set', path, data, opts }); },
      async update(data) { assertNoUndefined(data, `update(${path})`); applyWrite({ op: 'update', path, data }); },
    };
    return ref;
  };

  // ---- the calls query -------------------------------------------------------
  const makeQuery = (collectionPath, state = { filters: [], orders: [], startAfter: null, endAt: null, limit: null }) => ({
    __queryShape: () => deepClone({ collectionPath, ...state }),
    where(field, op, value) { return makeQuery(collectionPath, { ...state, filters: [...state.filters, { field, op, value }] }); },
    orderBy(field, dir = 'asc') {
      const name = typeof field === 'string' ? field : String(field);
      return makeQuery(collectionPath, { ...state, orders: [...state.orders, { field: name, dir }] });
    },
    startAfter(...values) { return makeQuery(collectionPath, { ...state, startAfter: values }); },
    endAt(...values) { return makeQuery(collectionPath, { ...state, endAt: values }); },
    limit(n) { return makeQuery(collectionPath, { ...state, limit: n }); },
    async get() {
      access.queries.push(deepClone({ collectionPath, ...state }));
      if (access.queries.length > MAX_CALLS_QUERIES) {
        throw new Error(`calls store: runaway scan — more than ${MAX_CALLS_QUERIES} queries on one store (a cursor that never advances)`);
      }
      if (hooks.failQuery) { const err = hooks.failQuery; throw err; }
      const prefix = `${collectionPath}/`;
      let rows = [...docs.entries()]
        .filter(([p]) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'))
        .map(([p, d]) => ({ path: p, id: p.slice(prefix.length), data: d }));
      for (const f of state.filters) {
        if (f.op !== '==') throw new Error(`calls store: unsupported filter op ${f.op}`);
        rows = rows.filter((r) => getPath(r.data, f.field) === f.value);
      }
      // Firestore serves an ordered query from its index: a document missing an
      // order-by field is not in it, so it is never returned (review D-7).
      rows = rows.filter((r) => state.orders.every((o) => o.field === NAME || getPath(r.data, o.field) !== undefined));
      const keyOf = (r) => state.orders.map((o) => (o.field === NAME ? r.id : getPath(r.data, o.field)));
      rows.sort((a, b) => {
        const ka = keyOf(a); const kb = keyOf(b);
        for (let i = 0; i < ka.length; i++) {
          const c = compareValues(ka[i], kb[i]);
          if (c !== 0) return state.orders[i].dir === 'desc' ? -c : c;
        }
        return 0;
      });
      const cmpCursor = (r, cursor) => {
        const k = keyOf(r);
        for (let i = 0; i < cursor.length; i++) {
          const c = compareValues(k[i], cursor[i]);
          if (c !== 0) return c;
        }
        return 0;
      };
      if (state.startAfter) rows = rows.filter((r) => cmpCursor(r, state.startAfter) > 0);
      if (state.endAt) rows = rows.filter((r) => cmpCursor(r, state.endAt) <= 0);
      if (Number.isFinite(state.limit)) rows = rows.slice(0, state.limit);
      for (const r of rows) access.reads.push(r.path);
      if (hooks.afterQuery) await hooks.afterQuery({ collectionPath, rows: rows.length });
      const docsOut = rows.map((r) => {
        const ref = makeCallsRef(r.path, r.id);
        return { id: r.id, ref, exists: true, data: () => deepClone(r.data) };
      });
      return { docs: docsOut, size: docsOut.length, empty: docsOut.length === 0 };
    },
  });

  // ---- collection() ----------------------------------------------------------
  const db = {
    ...base,
    __callDocs: docs,
    __callsAccess: access,
    __hooks: hooks,
    get __txAttempts() { return txAttempts; },
    /** Battle-document version (bumps on every write that lands on it). */
    __battleVersion: () => versionOf(battlePath),
    collection(col) {
      if (col === QUEUE_COLLECTION) {
        return { doc: (id) => makeCallsRef(`${QUEUE_COLLECTION}/${id}`, id) };
      }
      const c = base.collection(col);
      if (col !== 'agentBattles') return c;
      return {
        ...c,
        doc: (id) => {
          const ref = c.doc(id);
          const path = `agentBattles/${id}`;
          return {
            ...ref,
            async update(payload) { await ref.update(payload); bump(path); },
            collection: (sub) => {
              if (!CALL_SUBCOLLECTIONS.includes(sub)) return ref.collection(sub);
              const collectionPath = `${path}/${sub}`;
              const q = makeQuery(collectionPath);
              return { ...q, doc: (docId) => makeCallsRef(`${collectionPath}/${docId}`, docId) };
            },
          };
        },
      };
    },
    async getAll(...refs) {
      return Promise.all(refs.map((r) => r.get()));
    },
    async runTransaction(cb) {
      // A capture-harness "aborted first attempt" row keeps its semantics: hand
      // the whole transaction to the capture store's implementation.
      if (abortFirstTransactionWithSeq !== null) return base.runTransaction(cb);
      for (let attempt = 1; attempt <= 5; attempt++) {
        txAttempts += 1;
        const reads = new Map();
        const writes = [];
        // The Admin SDK's own rule (transaction.js): every read precedes every
        // write in one attempt — a read after a buffered write throws (review D-5).
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
            const path = refOrQuery.path;
            reads.set(path, versionOf(path));
            return refOrQuery.get();
          },
          async getAll(...refs) { readsBeforeWrites(); return Promise.all(refs.map((r) => tx.get(r))); },
          create(ref, data) { assertNoUndefined(data, `tx.create(${ref.path})`); writes.push({ op: 'create', ref, path: ref.path, data: deepClone(data) }); return tx; },
          set(ref, data, opts) { assertNoUndefined(data, `tx.set(${ref.path})`); writes.push({ op: 'set', ref, path: ref.path, data: deepClone(data), opts }); return tx; },
          update(ref, data) { assertNoUndefined(data, `tx.update(${ref.path})`); writes.push({ op: 'update', ref, path: ref.path, data: deepClone(data) }); return tx; },
        };
        const result = await cb(tx);
        if (hooks.afterTxBody) await hooks.afterTxBody({ attempt, readPaths: [...reads.keys()], writes });
        let conflict = false;
        for (const [path, v] of reads) if (versionOf(path) !== v) conflict = true;
        if (conflict) continue;
        if (hooks.beforeCommit) await hooks.beforeCommit({ attempt, writes });
        // ATOMIC: every create is checked before anything applies.
        for (const w of writes) if (w.op === 'create' && docs.has(w.path)) throw alreadyExists(w.path);
        for (const w of writes) {
          if (w.ref?.__callsStore) applyWrite(w);
          else {
            // The battle document (or any base-harness ref): through its own update.
            if (w.op !== 'update') throw new Error(`calls store: unsupported tx.${w.op} on ${w.path}`);
            await w.ref.update(w.data);
          }
        }
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

/** A stored call-record document (or null). */
export function storedDoc(db, sub, id) {
  const battleId = db.__store.battle.id;
  const path = sub === QUEUE_COLLECTION ? `${QUEUE_COLLECTION}/${id ?? battleId}` : `agentBattles/${battleId}/${sub}/${id}`;
  const d = db.__callDocs.get(path);
  return d === undefined ? null : deepClone(d);
}

/** Every stored doc of one subcollection, keyed by id. */
export function storedCollection(db, sub) {
  const battleId = db.__store.battle.id;
  const prefix = `agentBattles/${battleId}/${sub}/`;
  const out = {};
  for (const [p, d] of db.__callDocs) if (p.startsWith(prefix)) out[p.slice(prefix.length)] = deepClone(d);
  return out;
}

/** Reads + writes + queries against the four call-record collections. */
export function callsTouches(db) {
  const a = db.__callsAccess;
  return { reads: a.reads.length, writes: a.writes.length, queries: a.queries.length };
}
