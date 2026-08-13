// api/_utils/__testsupport__/mandateFakeFirestore.js
//
// Spec 1 — Mandate Substrate — TEST SUPPORT (never imported by a production
// path; lives under __testsupport__ so the §3.0 sole-fetch scan and the
// protected-store AST scan skip it — both scan only non-test .js under api/ +
// scripts/, and this directory is test-only).
//
// A TRANSACTION-FAITHFUL in-memory Firestore fake (Phase 4). The existing
// per-file fakes run `runTransaction(fn)` single-pass, writes-through-immediate,
// with zero retry and zero read-set validation — so none can express the one
// property the P4 lifecycle (three revision writers on one book) and the P3
// harness debt both need to assert: "two writers, revision precondition,
// exactly one winner." This fake models the real Admin-SDK contract:
//
//   • VERSIONED store: every committed write bumps the target doc's version.
//   • OPTIMISTIC CONCURRENCY: `tx.get` records the read doc's version; at commit
//     the fake re-checks every read version and, on any change, throws ABORTED
//     and RE-INVOKES the callback — exactly the loser-recomputes-over-winner
//     behavior closeBook's header and executeDecision's base-revision check
//     assume. The revision precondition is EMERGENT (both writers tx.get the
//     book, so it lands in the read set automatically) — never special-cased.
//   • BUFFERED WRITES applied atomically at commit: a callback that throws
//     mid-way commits nothing (true atomicity).
//   • CREATE-IF-ABSENT: `tx.create`/`ref.create` records an absence precondition
//     validated at commit → ALREADY_EXISTS (grpc code 6) if the doc now exists,
//     so two concurrent creators yield one winner + one ALREADY_EXISTS.
//   • A test-controlled INTERLEAVING BARRIER (`setBarrier`) that runs once after
//     the callback resolves and before the commit-check — the deterministic way
//     to force "A reads, B commits, A aborts-and-retries" in single-threaded JS.
//
// Faithful merge semantics: `set({merge:true})` deep-merges nested maps (keeps
// siblings); `update` applies dotted field-paths as leaf writes (keeps siblings)
// and replaces a non-dotted map value wholesale — the exact real-Firestore
// distinction the mandate book writes depend on. `update`/`set` are BLIND writes
// (they do NOT add a read dependency); only `get` and `create` create
// preconditions — matching real Firestore, where a blind write never aborts on
// its own target.

const ABORTED = () => { const e = new Error('ABORTED: transaction contention (too many retries)'); e.code = 10; return e; };
const ALREADY_EXISTS = (path) => { const e = new Error(`ALREADY_EXISTS: ${path}`); e.code = 6; return e; };

function clone(v) {
  // structuredClone preserves Date instances and nested objects (mandate docs
  // carry Dates, never Maps/Sets). Fall back for exotic values.
  try { return structuredClone(v); } catch { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
}

/** Firestore-order comparator: null first, then Dates/numbers numerically, strings lexically. */
function cmp(a, b) {
  const na = a == null, nb = b == null;
  if (na && nb) return 0;
  if (na) return -1;
  if (nb) return 1;
  const va = a instanceof Date ? a.getTime() : a;
  const vb = b instanceof Date ? b.getTime() : b;
  if (typeof va === 'number' && typeof vb === 'number') return va - vb;
  return String(va).localeCompare(String(vb));
}

/** Read a possibly-dotted field path off a doc ('__name__' is handled by the caller). */
function fieldOf(data, path) {
  if (!data) return undefined;
  if (!path.includes('.')) return data[path];
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), data);
}

/** Deep-merge `source` into `target` (set-merge semantics: nested maps merge, leaves replace). */
function deepMerge(target, source) {
  const out = clone(target) || {};
  for (const [k, v] of Object.entries(source)) {
    const isMap = v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date);
    const curIsMap = out[k] && typeof out[k] === 'object' && !Array.isArray(out[k]) && !(out[k] instanceof Date);
    out[k] = (isMap && curIsMap) ? deepMerge(out[k], v) : clone(v);
  }
  return out;
}

/** Apply an `update` patch: dotted keys write leaves (keep siblings); plain keys replace. */
function applyUpdate(base, patch) {
  const out = clone(base) || {};
  for (const [k, v] of Object.entries(patch)) {
    if (k.includes('.')) {
      const segs = k.split('.');
      let o = out;
      for (let i = 0; i < segs.length - 1; i++) {
        o[segs[i]] = (o[segs[i]] && typeof o[segs[i]] === 'object') ? { ...o[segs[i]] } : {};
        o = o[segs[i]];
      }
      o[segs[segs.length - 1]] = clone(v);
    } else {
      out[k] = clone(v);
    }
  }
  return out;
}

export function makeMandateFakeDb(seed = {}) {
  // path -> { data, version }. Version bumps on every committed write.
  const store = new Map();
  for (const [p, d] of Object.entries(seed)) store.set(p, { data: clone(d), version: 1 });

  let barrier = null;      // async fn, run ONCE after a txn callback resolves, before commit-check
  let txAttempts = 0;      // total callback invocations across all runTransaction calls (contention observability)
  let autoSeq = 0;         // monotonic counter for db.collection(x).doc() auto-ids
  const failCommitPaths = new Map(); // path -> remaining transient non-txn write failures to inject

  const collator = { store };

  function versionOf(path) { const e = store.get(path); return e ? e.version : 0; }

  function applyWrite(path, w) {
    const cur = store.get(path);
    if (w.op === 'delete') { store.delete(path); return; }
    if (w.op === 'create') { store.set(path, { data: clone(w.data), version: (cur?.version || 0) + 1 }); return; }
    if (w.op === 'set') {
      const data = (w.opts?.merge && cur) ? deepMerge(cur.data, w.data) : clone(w.data);
      store.set(path, { data, version: (cur?.version || 0) + 1 });
      return;
    }
    if (w.op === 'update') {
      store.set(path, { data: applyUpdate(cur?.data, w.data), version: (cur?.version || 0) + 1 });
      return;
    }
  }

  // ── Non-transactional doc ref ──────────────────────────────────────────────
  function docRef(path) {
    return {
      path,
      id: path.split('/').pop(),
      collection: (sub) => colRef(`${path}/${sub}`),
      async get() {
        const e = store.get(path);
        return { exists: !!e, id: path.split('/').pop(), data: () => (e ? clone(e.data) : undefined), ref: docRef(path) };
      },
      async set(data, opts) {
        maybeFail(path);
        applyWrite(path, { op: 'set', data, opts });
      },
      async update(patch) {
        maybeFail(path);
        applyWrite(path, { op: 'update', data: patch });
      },
      async create(data) {
        maybeFail(path);
        if (store.has(path)) throw ALREADY_EXISTS(path);
        applyWrite(path, { op: 'create', data });
      },
      async delete() {
        maybeFail(path);
        applyWrite(path, { op: 'delete' });
      },
    };
  }

  function maybeFail(path) {
    const n = failCommitPaths.get(path);
    if (n && n > 0) {
      failCommitPaths.set(path, n - 1);
      const e = new Error(`INJECTED write failure: ${path}`);
      e.code = 13;
      throw e;
    }
  }

  // ── Collection ref + query builder ─────────────────────────────────────────
  function colRef(colPath, q = { filters: [], orders: [], limitN: Infinity, after: null }) {
    const api = {
      doc: (id) => docRef(`${colPath}/${id || `auto_${++autoSeq}`}`),
      where: (field, op, value) => colRef(colPath, { ...q, filters: [...q.filters, [field, op, value]] }),
      orderBy: (field, dir = 'asc') => colRef(colPath, { ...q, orders: [...q.orders, [field, dir]] }),
      limit: (n) => colRef(colPath, { ...q, limitN: n }),
      startAfter: (...vals) => colRef(colPath, { ...q, after: vals }),
      async get() {
        const depth = colPath.split('/').length + 1;
        let rows = [];
        for (const [p, e] of store.entries()) {
          if (!p.startsWith(`${colPath}/`)) continue;
          if (p.split('/').length !== depth) continue; // direct children only
          rows.push({ id: p.split('/').pop(), path: p, data: e.data });
        }
        // filters
        for (const [field, op, value] of q.filters) {
          rows = rows.filter((r) => {
            const val = field === '__name__' ? r.id : fieldOf(r.data, field);
            const c = cmp(val, value);
            if (op === '==') return c === 0;
            if (op === '<') return c < 0;
            if (op === '<=') return c <= 0;
            if (op === '>') return c > 0;
            if (op === '>=') return c >= 0;
            return true;
          });
        }
        // order
        if (q.orders.length) {
          rows.sort((a, b) => {
            for (const [field, dir] of q.orders) {
              const va = field === '__name__' ? a.id : fieldOf(a.data, field);
              const vb = field === '__name__' ? b.id : fieldOf(b.data, field);
              const c = cmp(va, vb);
              if (c !== 0) return dir === 'desc' ? -c : c;
            }
            return 0;
          });
        }
        // startAfter cursor (positional against the orderBy fields)
        if (q.after && q.orders.length) {
          const afterVals = q.after;
          rows = rows.filter((r) => {
            for (let i = 0; i < q.orders.length; i++) {
              const [field, dir] = q.orders[i];
              const rv = field === '__name__' ? r.id : fieldOf(r.data, field);
              const c = cmp(rv, afterVals[i]);
              if (c !== 0) return dir === 'desc' ? c < 0 : c > 0;
            }
            return false; // exactly equal on all keys → excluded (strictly after)
          });
        }
        if (Number.isFinite(q.limitN)) rows = rows.slice(0, q.limitN);
        return {
          empty: rows.length === 0,
          size: rows.length,
          docs: rows.map((r) => ({
            id: r.id,
            exists: true,
            data: () => clone(r.data),
            ref: docRef(r.path),
          })),
        };
      },
    };
    return api;
  }

  // ── Transaction: read-set validation + retry + create precondition ─────────
  async function runTransaction(fn, { maxAttempts = 8 } = {}) {
    for (let attempt = 1; ; attempt++) {
      txAttempts += 1;
      const readVersions = new Map(); // path -> version observed at read (0 == absent)
      const createChecks = new Set(); // paths that must be ABSENT at commit
      const writes = new Map();       // path -> { op, data, opts } (last write wins within a txn)

      const tx = {
        async get(ref) {
          const path = ref.path;
          const e = store.get(path);
          readVersions.set(path, e ? e.version : 0);
          return { exists: !!e, id: path.split('/').pop(), data: () => (e ? clone(e.data) : undefined), ref };
        },
        set(ref, data, opts) { writes.set(ref.path, { op: 'set', data, opts }); },
        update(ref, patch) { writes.set(ref.path, { op: 'update', data: patch }); },
        create(ref, data) { createChecks.add(ref.path); writes.set(ref.path, { op: 'create', data }); },
        delete(ref) { writes.set(ref.path, { op: 'delete' }); },
      };

      let result;
      try {
        result = await fn(tx);
      } catch (err) {
        // A callback throw commits NOTHING (atomicity). Propagate — the caller's
        // own try/catch owns it (rollover/escape treat a thrown boundary as a
        // deferred, uncommitted attempt).
        throw err;
      }

      // Deterministic interleaving: let the test commit a rival write here, so a
      // read this callback depends on becomes stale and forces a retry.
      if (barrier) { const b = barrier; barrier = null; await b(); }

      // Commit critical section (synchronous in single-threaded JS).
      let conflict = null;
      for (const [path, seen] of readVersions) {
        if (versionOf(path) !== seen) { conflict = 'ABORTED'; break; }
      }
      if (!conflict) {
        for (const path of createChecks) {
          if (store.has(path)) { conflict = ['ALREADY_EXISTS', path]; break; }
        }
      }
      if (!conflict) {
        for (const [path, w] of writes) applyWrite(path, w);
        return result;
      }
      if (Array.isArray(conflict) && conflict[0] === 'ALREADY_EXISTS') throw ALREADY_EXISTS(conflict[1]);
      if (attempt >= maxAttempts) throw ABORTED();
      // else loop: re-invoke fn against the winner's committed state
    }
  }

  return {
    _store: store,
    _get: (path) => { const e = store.get(path); return e ? e.data : undefined; },
    _versionOf: versionOf,
    _txAttempts: () => txAttempts,
    /** Run `fn` once after the NEXT transaction's callback resolves, before its commit-check. */
    setBarrier: (fn) => { barrier = fn; },
    /** Inject `n` transient failures for the next `n` non-txn writes to `path`. */
    failNextWrites: (path, n = 1) => { failCommitPaths.set(path, n); },
    collection: (c) => colRef(c),
    doc: (p) => docRef(p),
    runTransaction,
    collator,
  };
}
