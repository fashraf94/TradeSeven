// api/_utils/filmTape/tapeWiring.test.js
//
// The tape's WIRING pins (review L3-F3, L3-F6 / L2-F8 / L4-F9):
//
//   1. THE INDEX PINS — the queries the candle pass and the read-out ISSUE,
//      recorded from the real code, validated against firestore.indexes.json
//      (the callRecordsRulesIndex.test.js precedent). The index-drift rule
//      (FIRESTORE_INDEX_DRIFT_CLEANUP.md, "Related notes") is dual-write: the
//      entry lives in the file on the branch AND is created by hand in the
//      Console at merge prep — this build deploys nothing.
//   2. THE vercel.json PINS — the two schedules and the handlers' maxDuration
//      equal the constants the code computes its windows from (the close-pass
//      window, the candle window, the hub helper's pending window). A schedule
//      edited alone fails here (the horizon.test.js precedent).
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the REAL imports of candlePass.js,
// the export script and both handlers. Never mock them. The flag module is
// mocked by spreading the real one.

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const flags = vi.hoisted(() => ({ writer: true }));
vi.mock('../../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_TAPE_WRITE_ENABLED() { return flags.writer; },
}));

import { runCandlePass } from './candlePass.js';
import { makeFirestoreReader } from '../../../scripts/export-film-tape.js';
import { config as closeConfig } from '../../cron/film-tape-close.js';
import { config as candlesConfig } from '../../cron/film-tape-candles.js';
import {
  CLOSE_PASS_SCHEDULE_UTC, CLOSE_PASS_UTC_HOUR, CLOSE_PASS_UTC_MINUTE, CLOSE_PASS_MAX_DURATION_S,
  CANDLE_PASS_SCHEDULE_UTC, CANDLE_PASS_UTC_HOUR, CANDLE_SELECTABLE_STATUSES,
} from '../../../src/constants/filmTape.js';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const INDEXES = JSON.parse(readFileSync(resolve(REPO, 'firestore.indexes.json'), 'utf8'));
const VERCEL = JSON.parse(readFileSync(resolve(REPO, 'vercel.json'), 'utf8'));

/** A Firestore stand-in that records every query it is asked to run and returns nothing. */
function recordingDb() {
  const issued = [];
  const query = (scope, name, state = { filters: [], orders: [] }) => ({
    where: (field, op, value) => query(scope, name, { ...state, filters: [...state.filters, { field, op, value }] }),
    orderBy: (field, dir = 'asc') => query(scope, name, { ...state, orders: [...state.orders, { field, dir }] }),
    limit: () => query(scope, name, state),
    startAfter: () => query(scope, name, state),
    get: async () => { issued.push({ scope, name, ...state }); return { docs: [], empty: true, size: 0, forEach() {} }; },
  });
  const collection = (name) => ({ ...query('COLLECTION', name), doc: () => ({ collection }) });
  return { issued, db: { collectionGroup: (name) => query('COLLECTION_GROUP', name), collection } };
}

/** The composite a query needs: equality / `in` fields first, then its order fields (implicit __name__ last). */
function requiredComposite(q) {
  const eq = q.filters.filter((f) => f.op === '==' || f.op === 'in').map((f) => ({ fieldPath: f.field, order: 'ASCENDING' }));
  const orders = q.orders.map((o) => ({ fieldPath: o.field, order: o.dir === 'desc' ? 'DESCENDING' : 'ASCENDING' }));
  return { collectionGroup: q.name, queryScope: q.scope, fields: [...eq, ...orders] };
}
function servedComposite(need, indexes = INDEXES.indexes) {
  const strip = (fields) => fields.filter((f) => f.fieldPath !== '__name__').map((f) => ({ fieldPath: f.fieldPath, order: f.order }));
  return indexes.some((ix) => ix.collectionGroup === need.collectionGroup && ix.queryScope === need.queryScope
    && JSON.stringify(strip(ix.fields)) === JSON.stringify(strip(need.fields)));
}
function servedSingleField({ collectionGroup, fieldPath, order, queryScope }, overrides = INDEXES.fieldOverrides) {
  return overrides.some((o) => o.collectionGroup === collectionGroup && o.fieldPath === fieldPath
    && (o.indexes || []).some((ix) => ix.order === order && ix.queryScope === queryScope));
}

describe('THE INDEX PINS — the queries as issued, against firestore.indexes.json', () => {
  it('the candle pass\'s queries — the expiry sweep (BA-29) and the selection — all need the tape collection-group composite (status, etDate), and the file declares it', async () => {
    const { db, issued } = recordingDb();
    await runCandlePass({ db, fetchCandles: async () => [], clock: () => Date.parse('2026-09-29T11:00:30Z') });
    // the sweep behind the scan: one query per non-terminal status; then the selection
    expect(issued.map((q) => q.filters[0])).toEqual([
      { field: 'passes.candles.status', op: '==', value: 'pending' },
      { field: 'passes.candles.status', op: '==', value: 'partial' },
      { field: 'passes.candles.status', op: '==', value: 'failed' },
      { field: 'passes.candles.status', op: 'in', value: [...CANDLE_SELECTABLE_STATUSES] },
    ]);
    for (const q of issued) {
      const need = requiredComposite(q);
      expect(need).toEqual({
        collectionGroup: 'tape', queryScope: 'COLLECTION_GROUP',
        fields: [{ fieldPath: 'passes.candles.status', order: 'ASCENDING' }, { fieldPath: 'etDate', order: 'ASCENDING' }],
      });
      expect(servedComposite(need)).toBe(true);
    }
  });

  it('red without the entry: none of those queries is served by the file minus the tape composite', async () => {
    const { db, issued } = recordingDb();
    await runCandlePass({ db, fetchCandles: async () => [], clock: () => Date.parse('2026-09-29T11:00:30Z') });
    const without = INDEXES.indexes.filter((ix) => ix.collectionGroup !== 'tape');
    expect(issued.length).toBeGreaterThan(0);
    for (const q of issued) expect(servedComposite(requiredComposite(q), without)).toBe(false);
  });

  it('`export --recent <n>` without --battle orders the tape collection group by etDate descending — the file declares that single-field index at collection-group scope', async () => {
    const { db, issued } = recordingDb();
    await makeFirestoreReader(db).readRecentTapes({ battleId: null, n: 5 });
    expect(issued).toEqual([{ scope: 'COLLECTION_GROUP', name: 'tape', filters: [], orders: [{ field: 'etDate', dir: 'desc' }] }]);
    const need = { collectionGroup: 'tape', fieldPath: 'etDate', order: 'DESCENDING', queryScope: 'COLLECTION_GROUP' };
    expect(servedSingleField(need)).toBe(true);
    expect(servedSingleField(need, INDEXES.fieldOverrides.filter((o) => o.collectionGroup !== 'tape'))).toBe(false);
  });

  it('the etDate override keeps the collection-scope defaults the battle-scoped read relies on', () => {
    const o = INDEXES.fieldOverrides.find((x) => x.collectionGroup === 'tape' && x.fieldPath === 'etDate');
    expect(o.indexes).toEqual(expect.arrayContaining([
      { order: 'ASCENDING', queryScope: 'COLLECTION' },
      { order: 'DESCENDING', queryScope: 'COLLECTION' },
    ]));
  });
});

describe('THE vercel.json PINS — schedules and budgets equal the constants the windows are computed from', () => {
  const entry = (path) => VERCEL.crons.find((c) => c.path === path);

  it('the close pass: 15 2 * * 2-6 UTC, built from the hour and minute the close-pass window uses', () => {
    expect(entry('/api/cron/film-tape-close').schedule).toBe(CLOSE_PASS_SCHEDULE_UTC);
    expect(CLOSE_PASS_SCHEDULE_UTC).toBe(`${CLOSE_PASS_UTC_MINUTE} ${CLOSE_PASS_UTC_HOUR} * * 2-6`);
  });

  it('the candle pass: 0 11 * * 2-6 UTC, built from the hour the candle window uses', () => {
    expect(entry('/api/cron/film-tape-candles').schedule).toBe(CANDLE_PASS_SCHEDULE_UTC);
    expect(CANDLE_PASS_SCHEDULE_UTC).toBe(`0 ${CANDLE_PASS_UTC_HOUR} * * 2-6`);
  });

  it('both handlers\' maxDuration is the budget the pending window and the time floors assume', () => {
    expect(closeConfig.maxDuration).toBe(CLOSE_PASS_MAX_DURATION_S);
    expect(candlesConfig.maxDuration).toBe(CLOSE_PASS_MAX_DURATION_S);
  });
});
