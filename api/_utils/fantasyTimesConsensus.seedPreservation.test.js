// api/_utils/fantasyTimesConsensus.seedPreservation.test.js
//
// Regression lock for the seedConsensus array-wipe (Phase 0 audit §5.2,
// re-verified in the Phase 2 discovery record and delegated as Step 0 of the
// Phase 2 build kickoff).
//
// THE DEFECT. `seedConsensus()` wrote the day's consensus document with
// `{ merge: true }` and a bare `economics` array in the payload. Firestore's
// merge deep-merges MAPS but REPLACES arrays wholesale, so every economic
// event `appendEconomics()` had arrayUnion'd since the previous tick was
// destroyed by the next seed. The seed's source for that field is the
// `economicCalendar` collection, which has no producer anywhere in the repo —
// so the value was always `[]`, and the write could only ever destroy events,
// never contribute one.
//
// WHY IT MATTERS MORE NOW. Phase 2 Spec V1.3 ruling D-P2-8 admits
// `fantasyTimesConsensus/{date}` as a deterministic adapter operand source for
// the weekly editorial review, whose memos are the Phase 3 gate evidence.
// `economics[].actual` / `.expected` are the two operands of Neta's
// `print_vs_expected` basis. A wipe is no longer a story-context nuisance; it
// silently removes gate evidence.
//
// A6 CONTRACT. Every assertion below fails under the defect. Restoring the
// pre-fix payload (a bare `economics,` key in the `set(..., { merge: true })`
// call) turns tests 1, 2 and 4 red. Test 3 pins the map fields that were
// always safe, so the fix cannot be "achieved" by disabling merge entirely.
//
// The fake models real Firestore merge semantics deliberately — maps merge
// recursively, arrays and scalars replace, arrayUnion appends-if-absent. If it
// merged arrays instead, the defect would be invisible and these rows would be
// theatre. This mirrors the deepMerge contract already documented at
// api/_utils/__fixtures__/masteryMockDb.js:82.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// The FieldValue sentinels live inside vi.hoisted() because the vi.mock
// factory below is hoisted above module-level consts.
const h = vi.hoisted(() => {
  const ARRAY_UNION = '__arrayUnion__';
  const SERVER_TS = '__serverTimestamp__';
  return {
    db: null,
    ARRAY_UNION,
    SERVER_TS,
    FieldValue: {
      arrayUnion: (...items) => ({ __sentinel: ARRAY_UNION, items }),
      serverTimestamp: () => ({ __sentinel: SERVER_TS }),
    },
  };
});

// ── Firestore fake: faithful merge semantics ─────────────────────────────
const ARRAY_UNION = h.ARRAY_UNION;
const SERVER_TS = h.SERVER_TS;
const FieldValueFake = h.FieldValue;

const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v) && v.__sentinel === undefined;
}

function resolveValue(existing, value) {
  if (value && value.__sentinel === ARRAY_UNION) {
    const base = Array.isArray(existing) ? clone(existing) : [];
    for (const item of value.items) {
      const dup = base.some((e) => JSON.stringify(e) === JSON.stringify(item));
      if (!dup) base.push(clone(item));
    }
    return base;
  }
  if (value && value.__sentinel === SERVER_TS) return '<server-timestamp>';
  return clone(value);
}

/** Real `set(..., {merge:true})`: plain objects merge recursively; arrays and
 *  scalars REPLACE. This asymmetry is the whole defect. */
function deepMerge(target, patch) {
  for (const [k, v] of Object.entries(patch)) {
    if (isPlainObject(v) && isPlainObject(target[k])) deepMerge(target[k], v);
    else target[k] = resolveValue(target[k], v);
  }
  return target;
}

function makeDb() {
  const store = new Map();
  return {
    store,
    read: (path) => clone(store.get(path)),
    collection: (col) => ({
      doc: (id) => {
        const path = `${col}/${id}`;
        return {
          get: async () => ({
            exists: store.has(path),
            data: () => clone(store.get(path)),
          }),
          set: async (data, opts) => {
            const base = opts?.merge === true ? (store.get(path) ?? {}) : {};
            store.set(path, deepMerge(base, data));
          },
          update: async (data) => {
            if (!store.has(path)) {
              const err = new Error('NOT_FOUND: no entity to update');
              err.code = 5;
              throw err;
            }
            store.set(path, deepMerge(store.get(path), data));
          },
        };
      },
    }),
  };
}

vi.mock('./firebaseAdmin.js', () => ({ getFirebaseAdmin: () => h.db }));
vi.mock('firebase-admin/firestore', () => ({ FieldValue: h.FieldValue }));

import {
  seedConsensus,
  appendEconomics,
  appendEarningsResult,
  appendCatalyst,
} from './fantasyTimesConsensus.js';

const DATE = '2026-07-24';
const DOC = `fantasyTimesConsensus/${DATE}`;

// Two events shaped as api/fantasytimes/generate-econ.js appends them: the
// `actual`/`expected` pair is exactly Neta's print_vs_expected operand set.
const CPI = { event: 'CPI (YoY)', actual: 3.2, expected: 3.4, impact: 'high' };
const JOBS = { event: 'Nonfarm Payrolls', actual: 187000, expected: 170000, impact: 'high' };

let savedKey;

beforeEach(() => {
  vi.clearAllMocks();
  h.db = makeDb();
  // No EODHD key -> seedConsensus skips its earnings fetch entirely
  // (fantasyTimesConsensus.js:31), so no network is touched by these tests.
  savedKey = process.env.EODHD_API_KEY;
  delete process.env.EODHD_API_KEY;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  if (savedKey === undefined) delete process.env.EODHD_API_KEY;
  else process.env.EODHD_API_KEY = savedKey;
  vi.restoreAllMocks();
});

describe('seedConsensus — same-day economic events survive a seed tick', () => {
  it('does not wipe events appended since the previous seed', async () => {
    await seedConsensus(DATE);
    await appendEconomics(DATE, CPI);
    await appendEconomics(DATE, JOBS);

    expect(h.db.read(DOC).economics).toHaveLength(2);

    // The re-seed that used to destroy them (a second pre-market firing, a
    // retry, or a manual run).
    await seedConsensus(DATE);

    const economics = h.db.read(DOC).economics;
    expect(economics).toHaveLength(2);
    expect(economics).toEqual(expect.arrayContaining([
      expect.objectContaining({ event: 'CPI (YoY)', actual: 3.2, expected: 3.4 }),
      expect.objectContaining({ event: 'Nonfarm Payrolls', actual: 187000, expected: 170000 }),
    ]));
  });

  it('survives repeated seed ticks, not merely one', async () => {
    await seedConsensus(DATE);
    await appendEconomics(DATE, CPI);
    for (let i = 0; i < 3; i++) await seedConsensus(DATE);

    expect(h.db.read(DOC).economics).toHaveLength(1);
    expect(h.db.read(DOC).economics[0].actual).toBe(3.2);
  });

  it('leaves economics untouched when the seed contributes nothing', async () => {
    // economicCalendar has no producer in the repo, so this is the real
    // steady state: the field must be absent after a first seed, never [].
    await seedConsensus(DATE);
    expect(h.db.read(DOC).economics).toBeUndefined();

    await appendEconomics(DATE, CPI);
    await seedConsensus(DATE);
    expect(h.db.read(DOC).economics).toHaveLength(1);
  });
});

describe('seedConsensus — D-P2-8 adapter operand fields survive seeding', () => {
  it('preserves every operand an editorial adapter reads', async () => {
    await seedConsensus(DATE);

    // Doug's eps/revenue operands (earnings.results — a MAP)
    await appendEarningsResult(DATE, 'AAPL', {
      epsActual: 2.4, epsEstimate: 2.1, revenueActual: 94500, revenueEstimate: 92000,
      result: 'beat',
    });
    // Alex's move operands (catalysts — a MAP)
    await appendCatalyst(DATE, 'NVDA', {
      direction: 'up', percentChange: 4.7, atrMultiple: 2.1, confidence: 'high',
    });
    // Neta's print_vs_expected operands (economics — an ARRAY, the defect site)
    await appendEconomics(DATE, CPI);

    await seedConsensus(DATE);

    const doc = h.db.read(DOC);
    expect(doc.earnings.results.AAPL).toMatchObject({
      epsActual: 2.4, epsEstimate: 2.1, revenueActual: 94500, revenueEstimate: 92000,
    });
    expect(doc.catalysts.NVDA).toMatchObject({ percentChange: 4.7, atrMultiple: 2.1 });
    expect(doc.economics[0]).toMatchObject({ actual: 3.2, expected: 3.4 });
  });

  it('still refreshes the seed-owned earnings ticker lists', async () => {
    // Guards the fix from over-correcting: reportingToday and its siblings are
    // seed-owned and SHOULD be rewritten each tick. A fix that made the whole
    // payload additive would break this.
    await seedConsensus(DATE);
    const doc = h.db.read(DOC);
    expect(doc.date).toBe(DATE);
    expect(doc.earnings.reportingToday).toEqual([]);
    expect(doc.earnings.reportedYesterdayAfterClose).toEqual([]);
    expect(doc.earnings.reportingThisWeek).toEqual([]);
    expect(doc.earnings.results).toEqual({});
  });
});

describe('the fake itself models the semantics the defect depends on', () => {
  // If this drifts, the rows above stop being evidence (A6).
  it('replaces arrays and merges maps under { merge: true }', async () => {
    const db = makeDb();
    const ref = db.collection('c').doc('d');
    await ref.set({ arr: [1, 2], map: { a: 1 } });
    await ref.set({ arr: [9], map: { b: 2 } }, { merge: true });

    expect(db.read('c/d').arr).toEqual([9]);          // arrays REPLACE
    expect(db.read('c/d').map).toEqual({ a: 1, b: 2 }); // maps MERGE
  });

  it('appends via arrayUnion without duplicating', async () => {
    const db = makeDb();
    const ref = db.collection('c').doc('d');
    await ref.set({ arr: [{ x: 1 }] });
    await ref.update({ arr: FieldValueFake.arrayUnion({ x: 2 }, { x: 1 }) });

    expect(db.read('c/d').arr).toEqual([{ x: 1 }, { x: 2 }]);
  });
});
