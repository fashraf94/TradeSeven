// api/_utils/__fixtures__/inMemoryFirestore.js
//
// The shared in-memory Firestore stand-in used by the tournament/training tests
// (extracted from trainingLifecycle.test.js so the R4 canonical-chain regression
// lock can drive the REAL training writers against the SAME store the unit tests
// use). Supports: doc get/set/update (dot-path), sub-collections, top-level
// where('==') queries, and runTransaction with tx.get/update/set. Captures writes
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
      where: (field, op, value) => ({
        select: () => ({ get: async () => { readLog.push(['get', prefix]); return snapshotOf(filterDocs(field, value)); } }),
        get: async () => { readLog.push(['get', prefix]); return snapshotOf(filterDocs(field, value)); },
      }),
      get: async () => { readLog.push(['get', prefix]); return snapshotOf(topLevelDocs(prefix)); },
    };
    function filterDocs(field, value) {
      return topLevelDocs(prefix).filter(d => d.data()[field] === value);
    }
    function snapshotOf(docs) {
      return { docs, empty: docs.length === 0, size: docs.length, forEach: (cb) => docs.forEach(cb) };
    }
  }

  const db = {
    collection: (name) => makeCollection(name),
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
