// api/_utils/__fixtures__/loadoutWriterDb.js
//
// Build A2 — the fake Firestore the per-game loadout writer rows share (change-archetype, equip-watchlist,
// unequip-watchlist): the change-archetype suite's double (agents with their rules/bundles subcollections, one shared
// store for in-tx and post-tx reads, the composition store's pre-genesis posture), plus the two collections the A2
// paths read — `watchlists` (the equip checks) and `tournamentGroups`, whose member-scoped `array-contains` query the
// League lock reads inside the transaction (tx.get(query)). Every query asked is recorded, so a row can prove the BaggerBomb
// paths never read the lock and the flag-off paths never query it at all; and every read made THROUGH the transaction
// (`tx.get`, `tx.getAll`) is recorded apart, as `state.txReads` (the fix pass, review A2R-2), so a League row can prove the
// lock's query went through the live transaction and not around it.

import { makeCompositionStoreDouble } from './compositionStoreDouble.js';

export function makeLoadoutWriterDb({ agentDocs = {}, watchlists = {}, groups = [] } = {}) {
  const __composition = makeCompositionStoreDouble();
  const state = { agentDocs, watchlists, groups, subcollections: {}, queries: [], writes: [], txReads: [] };
  let autoSeq = 0;

  const store = (agentId, sub) => {
    state.subcollections[agentId] = state.subcollections[agentId] || {};
    state.subcollections[agentId][sub] = state.subcollections[agentId][sub] || [];
    return state.subcollections[agentId][sub];
  };

  const subDocRef = (agentId, sub, docId) => ({
    id: docId,
    get: async () => {
      const d = store(agentId, sub).find((x) => x.id === docId);
      return { exists: !!d, id: docId, data: () => d };
    },
    set: async (data) => {
      const arr = store(agentId, sub);
      const i = arr.findIndex((x) => x.id === docId);
      const doc = { id: docId, ...data };
      if (i >= 0) arr[i] = doc; else arr.push(doc);
    },
    update: async (updates) => {
      const arr = store(agentId, sub);
      const i = arr.findIndex((x) => x.id === docId);
      if (i >= 0) arr[i] = { ...arr[i], ...updates };
    },
  });

  const subCollectionRef = (agentId, sub) => ({
    get: async () => ({ docs: store(agentId, sub).map((d) => ({ id: d.id, data: () => d })) }),
    doc: (docId) => subDocRef(agentId, sub, docId ?? `seed-${++autoSeq}`),
  });

  let db;
  const agentRef = (id) => ({
    id,
    get firestore() { return db; },
    get: async () => ({ exists: !!state.agentDocs[id], data: () => state.agentDocs[id] }),
    update: async (updates) => {
      state.writes.push({ id, updates });
      state.agentDocs[id] = { ...state.agentDocs[id], ...updates };
    },
    collection: (sub) => subCollectionRef(id, sub),
  });

  const watchlistRef = (id) => ({
    id,
    get: async () => ({ exists: !!state.watchlists[id], data: () => state.watchlists[id] }),
  });

  const groupsCollection = {
    where: (field, op, value) => {
      const asked = { collection: 'tournamentGroups', field, op, value };
      state.queries.push(asked);
      return {
        __query: asked,
        get: async () => ({
          docs: state.groups
            .filter((g) => op === 'array-contains' && Array.isArray(g[field]) && g[field].includes(value))
            .map((g) => ({ id: g.id, data: () => g })),
        }),
      };
    },
  };

  const collection = (name) => {
    if (name === 'agents') return { doc: (id) => agentRef(id) };
    if (name === 'watchlists') return { doc: (id) => watchlistRef(id) };
    if (name === 'tournamentGroups') return groupsCollection;
    const c = __composition.collection(name);
    if (c) return c;
    throw new Error(`Unmocked collection: ${name}`);
  };

  const txRead = (refOrQuery) => state.txReads.push(refOrQuery?.__query ? { query: refOrQuery.__query } : { doc: refOrQuery?.id ?? null });
  const runTransaction = async (fn) => fn({
    get: async (refOrQuery) => { txRead(refOrQuery); return refOrQuery.get(); },
    getAll: async (...refs) => { refs.forEach(txRead); return Promise.all(refs.map((r) => r.get())); },
    set: async (ref, data) => ref.set(data),
    update: async (ref, updates) => ref.update(updates),
  });

  db = { collection, runTransaction };
  return { db, state };
}

/** The request/response pair the writer rows drive the handlers with. */
export function makeReqRes(body) {
  const req = { method: 'POST', body: body || {} };
  const res = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(b) { this.body = b; return this; },
  };
  return { req, res };
}
