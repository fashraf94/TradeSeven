// api/_utils/__fixtures__/tickCaptureHarness.js
//
// Tick capture — the doc-store EXTENSION the capture suites drive.
//
// `makeTickDb` (tickStampsHarness.js) knows only `agentBattles/{id}` get/update:
// it has no subcollections and no `batch()`. Rather than widen the shared
// fixture that four golden suites depend on, this module WRAPS it — the
// agent-evaluate.intradayViews.test.js precedent, lifted out of that one test
// file so every capture suite drives the same double.
//
// What it adds:
//   · doc(id).collection(sub).doc(tickId)  → a ref a batch can set()
//   · db.batch()                           → set() + commit(), ATOMIC: a
//     commit that throws applies NEITHER document, which is what proves the
//     C-1 "both exist or neither" guarantee rather than assuming it
//   · db.__captureWrites  — every committed batch, in order
//   · db.__failCapture    — 'throw' | 'hang' | null, the injected failure
//
// ZERO product imports beyond the base harness (the same rule the base file
// states about itself).

import { makeTickDb, deepClone } from './tickStampsHarness.js';

/**
 * @param {object} base a db from makeTickDb
 * @param {object} [opts]
 * @param {number|null} [opts.abortFirstTransactionWithSeq] Astra round 1, blind
 *   spot 4: the base harness calls a transaction callback exactly ONCE, so a
 *   defect that used a callback-local side effect as the tick's identity would
 *   survive every row. With this set, the FIRST attempt runs against a battle
 *   carrying this sequence and its writes are DISCARDED (an aborted attempt),
 *   then the callback runs again against the real store and only that attempt
 *   commits. The record must carry the COMMITTED sequence, not the aborted one.
 * @returns the same db, with subcollection refs and an atomic batch
 */
export function withCaptureStore(base, { abortFirstTransactionWithSeq = null } = {}) {
  const captureWrites = [];
  const subStore = new Map(); // 'agentBattles/b/ticks/t' → data

  let transactionAttempts = 0;
  const db = {
    ...base,
    __captureWrites: captureWrites,
    __subStore: subStore,
    __failCapture: null,
    get __transactionAttempts() { return transactionAttempts; },
    async runTransaction(cb) {
      transactionAttempts += 1;
      if (abortFirstTransactionWithSeq !== null && transactionAttempts === 1) {
        // The aborted attempt: it READS a different battle and its writes go
        // nowhere. Whatever it computed must not reach the tick.
        const phantom = deepClone(base.__store.battle);
        phantom.cronState = { ...(phantom.cronState || {}), tickSeq: abortFirstTransactionWithSeq };
        await cb({
          get: async () => ({ exists: true, id: 'battle', data: () => deepClone(phantom) }),
          update: () => {},                      // discarded — the attempt aborts
        });
        transactionAttempts += 1;
      }
      return base.runTransaction(cb);
    },
    collection(col) {
      const c = base.collection(col);
      return {
        ...c,
        doc: (id) => {
          const ref = c.doc(id);
          return {
            ...ref,
            collection: (sub) => ({
              doc: (docId) => ({ path: `${col}/${id}/${sub}/${docId}`, id: docId }),
            }),
          };
        },
      };
    },
    batch() {
      const staged = [];
      return {
        set(ref, data) { staged.push({ path: ref.path, data: deepClone(data) }); },
        async commit() {
          if (db.__failCapture === 'throw') throw new Error('capture batch write failed (injected)');
          if (db.__failCapture === 'hang') await new Promise(() => {});
          // ATOMIC: nothing is applied until every staged write is accepted.
          for (const w of staged) subStore.set(w.path, w.data);
          captureWrites.push(staged);
          return staged;
        },
      };
    },
  };
  return db;
}

/** The base harness db plus the capture store, in one call. */
export function makeCaptureDb({ abortFirstTransactionWithSeq = null, ...args } = {}) {
  return withCaptureStore(makeTickDb(args), { abortFirstTransactionWithSeq });
}

/** The permanent document a run wrote, or null. */
export function permanentDoc(db, battleId, tickId) {
  return db.__subStore.get(`agentBattles/${battleId}/ticks/${tickId}`) ?? null;
}

/** The TTL body document a run wrote, or null. */
export function bodyDoc(db, battleId, tickId) {
  return db.__subStore.get(`agentBattles/${battleId}/tickBodies/${tickId}`) ?? null;
}

/** Every recorded update payload that carries the given dotted field path. */
export function updatesWithKey(db, key) {
  return db.__updates.filter((u) => Object.hasOwn(u, key));
}

/**
 * Every string leaf in a value, with its path — the sentinel sweep's primitive.
 * A sentinel test asserts on the VALUES, so a field renamed later cannot make
 * the row pass vacuously.
 */
export function stringLeaves(value, prefix = '') {
  const out = [];
  const walk = (v, path) => {
    if (typeof v === 'string') { out.push({ path, value: v }); return; }
    if (Array.isArray(v)) { v.forEach((x, i) => walk(x, `${path}[${i}]`)); return; }
    if (v && typeof v === 'object') { for (const [k, x] of Object.entries(v)) walk(x, path ? `${path}.${k}` : k); }
  };
  walk(value, prefix);
  return out;
}

/** true when `needle` appears anywhere inside any string leaf of `value`. */
export function containsText(value, needle) {
  return stringLeaves(value).some((leaf) => leaf.value.includes(needle));
}
