// api/_utils/__fixtures__/masteryMockDb.js
// Test-only in-memory Firestore Admin mock for the Archetype Mastery P1
// acceptance tests (masterySettlement.test.js, agent-evaluate.masteryCompletion.test.js).
//
// Purpose-built to prove the spec §12 acceptance properties, so it models the
// semantics the production code actually leans on:
//   • runTransaction with OPTIMISTIC CONCURRENCY: reads record doc versions;
//     commit re-checks them and RETRIES the callback on conflict (fresh
//     reads) — the write-once guards are only proven if a lost race really
//     re-runs the guard against the winner's committed state.
//   • Buffered transaction writes (reads inside a txn never see the txn's
//     own writes — the reads-before-writes discipline is real Firestore).
//   • update() vs set(..., {merge:true}) vs set(): dotted-path field
//     updates, FieldValue.delete() sentinels, deep merge, replace.
//   • Equality/range where() filters over nested paths + limit().
//   • db.__beforeCommit — a one-shot test hook that runs a COMPETING
//     operation between a transaction's callback and its commit, forcing a
//     deterministic conflict/retry interleaving (no timing flakes).
//
// NOT modeled (unused by the code under test): orderBy, cursors, collection
// groups, snapshots listeners, server timestamps.

import { FieldValue } from 'firebase-admin/firestore';

const DELETE_SENTINEL = FieldValue.delete();
const isDeleteSentinel = (v) =>
  !!v && typeof v.isEqual === 'function' && v.isEqual(DELETE_SENTINEL);

const isPlainObject = (v) =>
  v !== null && typeof v === 'object' && !Array.isArray(v) &&
  (v.constructor === Object || v.constructor === undefined);

// Deep clone plain data; class instances (e.g. firebase Timestamp) pass by
// reference — they are immutable value objects in the code under test.
function deepClone(v) {
  if (Array.isArray(v)) return v.map(deepClone);
  if (isPlainObject(v)) {
    const out = {};
    for (const k of Object.keys(v)) out[k] = deepClone(v[k]);
    return out;
  }
  return v;
}

function getPath(obj, dotted) {
  let cur = obj;
  for (const part of dotted.split('.')) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
    cur = cur[part];
  }
  return cur;
}

function setPath(obj, dotted, value) {
  const parts = dotted.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!isPlainObject(cur[parts[i]])) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

function deletePath(obj, dotted) {
  const parts = dotted.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!isPlainObject(cur[parts[i]])) return;
    cur = cur[parts[i]];
  }
  delete cur[parts[parts.length - 1]];
}

/** Firestore update() semantics: dotted keys are field paths; delete sentinels remove. */
function applyUpdate(target, updateObj) {
  for (const [k, v] of Object.entries(updateObj)) {
    if (isDeleteSentinel(v)) deletePath(target, k);
    else setPath(target, k, deepClone(v));
  }
}

/** set(..., {merge:true}) semantics: plain objects merge recursively; everything else replaces. */
function deepMerge(target, patch) {
  for (const [k, v] of Object.entries(patch)) {
    if (isDeleteSentinel(v)) {
      delete target[k];
    } else if (isPlainObject(v) && isPlainObject(target[k])) {
      deepMerge(target[k], v);
    } else {
      target[k] = deepClone(v);
    }
  }
}

// Only the ops the code under test uses; anything else throws loudly so a
// future test can never trust silently-wrong semantics.
function matchesFilters(data, filters) {
  for (const f of filters) {
    const val = getPath(data, f.field);
    if (f.op === '==') {
      if (val !== f.value) return false;
    } else if (f.op === '>=') {
      if (!(val >= f.value)) return false;
    } else if (f.op === '<') {
      if (!(val < f.value)) return false;
    } else {
      throw new Error(`mock query: unsupported op '${f.op}'`);
    }
  }
  return true;
}

/**
 * @param {Object<string, Object>} initialDocs - path ('col/id') → doc data
 */
export function makeMockDb(initialDocs = {}) {
  const store = new Map(); // path → { data, version }
  let autoId = 0;
  // Read accounting (adversarial ruling B2: byte-identity photographs count
  // READS too, not just writes). Doc reads count per path; query executions
  // count per collection as `query:<collection>`.
  const reads = new Map();
  const countRead = (key) => reads.set(key, (reads.get(key) ?? 0) + 1);

  for (const [path, data] of Object.entries(initialDocs)) {
    store.set(path, { data: deepClone(data), version: 1 });
  }

  const versionOf = (path) => (store.has(path) ? store.get(path).version : 0);

  const snapOf = (path) => {
    const entry = store.get(path);
    const id = path.split('/').pop();
    return {
      exists: !!entry,
      id,
      data: () => (entry ? deepClone(entry.data) : undefined),
    };
  };

  const commitWrite = (w) => {
    if (w.type === 'update') {
      const entry = store.get(w.path);
      if (!entry) throw new Error(`NOT_FOUND: no document to update: ${w.path}`);
      applyUpdate(entry.data, w.data);
      entry.version += 1;
    } else if (w.type === 'set') {
      const entry = store.get(w.path);
      if (w.opts?.merge === true && entry) {
        deepMerge(entry.data, w.data);
        entry.version += 1;
      } else if (w.opts?.merge === true && !entry) {
        store.set(w.path, { data: deepClone(w.data), version: 1 });
      } else if (entry) {
        entry.data = deepClone(w.data);
        entry.version += 1;
      } else {
        store.set(w.path, { data: deepClone(w.data), version: 1 });
      }
    }
  };

  const makeDocRef = (collectionName, id) => {
    const path = `${collectionName}/${id}`;
    return {
      id,
      path,
      async get() {
        countRead(path);
        return snapOf(path);
      },
      async update(data) {
        commitWrite({ type: 'update', path, data });
      },
      async set(data, opts) {
        commitWrite({ type: 'set', path, data, opts });
      },
    };
  };

  const makeQuery = (collectionName, filters, limitN, afterId = null) => ({
    where(field, op, value) {
      return makeQuery(collectionName, [...filters, { field, op, value }], limitN, afterId);
    },
    limit(n) {
      return makeQuery(collectionName, filters, n, afterId);
    },
    // Projection is not modeled: production narrows the payload only, never
    // the semantics, so the mock returns full docs (chain no-op).
    select() {
      return makeQuery(collectionName, filters, limitN, afterId);
    },
    // Only documentId ordering is modeled (the M7 sweep cursor). The base
    // path scan is already id-sorted, so this is a validated no-op marker.
    orderBy(field) {
      const isDocId = field === '__name__' || (field && typeof field.isEqual === 'function');
      if (!isDocId) throw new Error(`mock query: unsupported orderBy '${String(field)}'`);
      return makeQuery(collectionName, filters, limitN, afterId);
    },
    startAfter(id) {
      return makeQuery(collectionName, filters, limitN, id);
    },
    async get() {
      countRead(`query:${collectionName}`);
      const prefix = `${collectionName}/`;
      const docs = [];
      // Deterministic path order — production code must not depend on it,
      // and the order-independence property test proves it doesn't.
      const paths = [...store.keys()].filter(
        (p) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/')
      ).sort();
      for (const p of paths) {
        const id = p.slice(prefix.length);
        if (afterId !== null && id <= afterId) continue;
        if (matchesFilters(store.get(p).data, filters)) {
          docs.push(snapOf(p));
          if (limitN !== null && docs.length >= limitN) break;
        }
      }
      return { docs };
    },
  });

  const makeCollection = (collectionName) => ({
    doc(id) {
      return makeDocRef(collectionName, id ?? `auto-${++autoId}`);
    },
    async add(data) {
      const id = `auto-${++autoId}`;
      commitWrite({ type: 'set', path: `${collectionName}/${id}`, data });
      return { id };
    },
    where(field, op, value) {
      return makeQuery(collectionName, [{ field, op, value }], null);
    },
  });

  const db = {
    collection(name) {
      return makeCollection(name);
    },

    // One-shot interleaving hook: runs between a transaction callback's
    // completion and its commit check — set it to a competing async op to
    // force a deterministic conflict + retry.
    __beforeCommit: null,

    async runTransaction(fn) {
      for (let attempt = 0; attempt < 6; attempt++) {
        const readVersions = new Map();
        const writes = [];
        const t = {
          async get(ref) {
            countRead(ref.path);
            readVersions.set(ref.path, versionOf(ref.path));
            return snapOf(ref.path);
          },
          update(ref, data) {
            writes.push({ type: 'update', path: ref.path, data });
            return t;
          },
          set(ref, data, opts) {
            writes.push({ type: 'set', path: ref.path, data, opts });
            return t;
          },
        };
        const result = await fn(t);

        if (db.__beforeCommit) {
          const hook = db.__beforeCommit;
          db.__beforeCommit = null;
          await hook();
        }

        let conflict = false;
        for (const [p, v] of readVersions) {
          if (versionOf(p) !== v) {
            conflict = true;
            break;
          }
        }
        if (conflict) continue;

        for (const w of writes) commitWrite(w);
        return result;
      }
      throw new Error('mock runTransaction: retry limit exceeded');
    },

    // ---- test inspection helpers ----
    __dump(path) {
      return store.has(path) ? deepClone(store.get(path).data) : undefined;
    },
    __paths(prefix = '') {
      return [...store.keys()].filter((p) => p.startsWith(prefix)).sort();
    },
    __readCounts() {
      return Object.fromEntries([...reads.entries()].sort());
    },
    __resetReads() {
      reads.clear();
    },
  };

  return db;
}
