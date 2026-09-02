// api/_utils/rankingSnapshots.test.js
//
// Archetype Rank Interface V2 — the P-11 snapshot writer's contracts against a
// fake db: the ops-doc gate (absent ⇒ off), run-label resolution (premarket +
// last intraday only), the document shape, expire-on-write, and a source-text
// tripwire on the two firestore.rules deny blocks (the emulator suite in
// test/rules/rankingSnapshotDenials.rules.mjs proves them against the emulator;
// this row keeps the text from silently disappearing in the default run).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  normalizeSnapshotOps,
  readRankingSnapshotOps,
  resolveSnapshotRunLabel,
  snapshotDocId,
  buildRankingSnapshotDoc,
  writeRankingSnapshot,
  expireRankingSnapshots,
  RANKING_SNAPSHOTS_COLLECTION,
  RANKING_SNAPSHOTS_DEFAULT_RETAIN_DAYS,
  LAST_INTRADAY_RUN_HOUR_UTC,
} from './rankingSnapshots.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function fakeDb({ opsDoc, opsThrows = false, snapshots = [] } = {}) {
  const writes = [];
  const deleted = [];
  const db = {
    collection(name) {
      return {
        doc(id) {
          return {
            async get() {
              if (name === 'ops' && id === 'rankingSnapshots') {
                if (opsThrows) throw new Error('boom');
                return { exists: opsDoc !== undefined, data: () => opsDoc };
              }
              return { exists: false, data: () => undefined };
            },
            async set(data) { writes.push({ collection: name, id, data }); },
            async delete() { deleted.push(id); },
          };
        },
        where(field, op, value) {
          return {
            limit(n) {
              return {
                async get() {
                  const docs = snapshots
                    .filter((s) => name === RANKING_SNAPSHOTS_COLLECTION && op === '<=' && s[field] <= value)
                    .slice(0, n)
                    .map((s) => ({ id: s.id, ref: { id: s.id }, data: () => s }));
                  return { empty: docs.length === 0, docs };
                },
              };
            },
          };
        },
      };
    },
    batch() {
      throw new Error('rankingSnapshots must not use a batch handle (B3 scan resolution — see rankingSnapshots.js)');
    },
  };
  return { db, writes, deleted };
}

describe('ops/rankingSnapshots gate (P-11: an ops toggle, not a feature flag)', () => {
  it('normalizes: absent/malformed ⇒ off with the default retention; only `enabled === true` turns it on', () => {
    expect(normalizeSnapshotOps(undefined)).toEqual({ enabled: false, retainDays: 30 });
    expect(normalizeSnapshotOps({})).toEqual({ enabled: false, retainDays: 30 });
    expect(normalizeSnapshotOps({ enabled: 'true' })).toEqual({ enabled: false, retainDays: 30 });
    expect(normalizeSnapshotOps({ enabled: true })).toEqual({ enabled: true, retainDays: 30 });
    expect(normalizeSnapshotOps({ enabled: true, retainDays: 7 })).toEqual({ enabled: true, retainDays: 7 });
    expect(normalizeSnapshotOps({ enabled: true, retainDays: 0 })).toEqual({ enabled: true, retainDays: 30 });
    expect(normalizeSnapshotOps({ enabled: true, retainDays: '7' })).toEqual({ enabled: true, retainDays: 30 });
    expect(RANKING_SNAPSHOTS_DEFAULT_RETAIN_DAYS).toBe(30);
  });

  it('absent doc ⇒ off; present doc ⇒ its values; a read error ⇒ off and logged', async () => {
    expect(await readRankingSnapshotOps(fakeDb().db)).toEqual({ enabled: false, retainDays: 30, source: 'absent' });
    expect(await readRankingSnapshotOps(fakeDb({ opsDoc: { enabled: true, retainDays: 10 } }).db))
      .toEqual({ enabled: true, retainDays: 10, source: 'doc' });
    const logs = [];
    expect(await readRankingSnapshotOps(fakeDb({ opsThrows: true }).db, { log: (m) => logs.push(m) }))
      .toEqual({ enabled: false, retainDays: 30, source: 'error' });
    expect(logs[0]).toMatch(/ops\/rankingSnapshots read failed/);
  });
});

describe('run label — premarket + the last intraday run only', () => {
  it('premarket always snapshots; intraday only at the last scheduled UTC hour', () => {
    expect(LAST_INTRADAY_RUN_HOUR_UTC).toBe(20);
    expect(resolveSnapshotRunLabel({ intraday: false, now: new Date('2026-09-02T10:31:00Z') })).toBe('premarket');
    expect(resolveSnapshotRunLabel({ intraday: true, now: new Date('2026-09-02T20:00:30Z') })).toBe('intraday-last');
    expect(resolveSnapshotRunLabel({ intraday: true, now: new Date('2026-09-02T15:00:00Z') })).toBeNull();
    expect(resolveSnapshotRunLabel({ intraday: true, now: new Date('2026-09-02T19:59:59Z') })).toBeNull();
  });
  it('honours a safe manual override label and rejects an unsafe one', () => {
    expect(resolveSnapshotRunLabel({ intraday: true, now: new Date('2026-09-02T15:00:00Z'), override: 'smoke-1' })).toBe('smoke-1');
    expect(resolveSnapshotRunLabel({ intraday: true, now: new Date('2026-09-02T15:00:00Z'), override: 'Bad/Label' })).toBeNull();
    expect(resolveSnapshotRunLabel({ intraday: false, override: '../x' })).toBe('premarket');
  });
  it('doc id = {etDate}_{runLabel}', () => {
    expect(snapshotDocId('2026-09-02', 'premarket')).toBe('2026-09-02_premarket');
  });
});

describe('snapshot document shape', () => {
  const now = new Date('2026-09-02T10:31:12.000Z');
  const universe = [
    { symbol: 'AAPL', axes: { quality: 70 }, arch_scores: { analyst: 61.2 }, arch_scores_v2: { analyst: 58 } },
    { symbol: 'MSFT', axes: { quality: 80 }, arch_scores: { analyst: 66 } },
    { notASymbol: true },
  ];

  it('keys the per-symbol payload by symbol and carries the window fields', () => {
    const docData = buildRankingSnapshotDoc({
      etDate: '2026-09-02', runLabel: 'premarket', mode: 'premarket', now, codeHead: 'abc123',
      universe, axesFormulaVersion: 1, universeMedianReturn1W: -0.42,
      axisNullCounts: { quality: 0 }, archetypePostFilterCounts: { analyst: 2 },
      events: [{ type: 'x' }], elapsedSeconds: 41.3, stageTimings: { axes: 12 }, retainDays: 10,
    });
    expect(docData.schemaVersion).toBe(1);
    expect(docData.etDate).toBe('2026-09-02');
    expect(docData.runLabel).toBe('premarket');
    expect(docData.mode).toBe('premarket');
    expect(docData.asOf).toBe('2026-09-02T10:31:12.000Z');
    expect(docData.asOfMs).toBe(now.getTime());
    expect(docData.codeHead).toBe('abc123');
    expect(docData.universeCount).toBe(2);
    expect(docData.axesFormulaVersion).toBe(1);
    expect(docData.universeMedianReturn1W).toBe(-0.42);
    expect(docData.axisNullCounts).toEqual({ quality: 0 });
    expect(docData.archetypePostFilterCounts).toEqual({ analyst: 2 });
    expect(docData.events).toEqual([{ type: 'x' }]);
    expect(docData.elapsedSeconds).toBe(41.3);
    expect(docData.stageTimings).toEqual({ axes: 12 });
    expect(docData.retainDays).toBe(10);
    expect(docData.expiresAtMs).toBe(now.getTime() + 10 * 24 * 60 * 60 * 1000);
    expect(docData.stocks).toEqual({
      AAPL: { axes: { quality: 70 }, arch_scores: { analyst: 61.2 }, arch_scores_v2: { analyst: 58 } },
      MSFT: { axes: { quality: 80 }, arch_scores: { analyst: 66 }, arch_scores_v2: null },
    });
  });

  it('defaults: null optionals, empty events, default retention', () => {
    const docData = buildRankingSnapshotDoc({ etDate: 'd', runLabel: 'l', mode: 'm', now, universe: [], axesFormulaVersion: 1 });
    expect(docData.codeHead).toBeNull();
    expect(docData.events).toEqual([]);
    expect(docData.archetypePostFilterCounts).toBeNull();
    expect(docData.retainDays).toBe(30);
    expect(docData.stocks).toEqual({});
  });

  it('writes into the rankingSnapshots collection under the given id', async () => {
    const { db, writes } = fakeDb();
    await writeRankingSnapshot(db, '2026-09-02_premarket', { a: 1 });
    expect(writes).toEqual([{ collection: 'rankingSnapshots', id: '2026-09-02_premarket', data: { a: 1 } }]);
  });
});

describe('expire-on-write (P-11: no cron slot)', () => {
  it('deletes only snapshots older than retainDays, measured from the current setting', async () => {
    const DAY = 24 * 60 * 60 * 1000;
    const nowMs = Date.parse('2026-09-02T10:31:00Z');
    const { db, deleted } = fakeDb({ snapshots: [
      { id: 'old-31', asOfMs: nowMs - 31 * DAY },
      { id: 'edge-30', asOfMs: nowMs - 30 * DAY },
      { id: 'fresh-29', asOfMs: nowMs - 29 * DAY },
      { id: 'today', asOfMs: nowMs },
    ] });
    const res = await expireRankingSnapshots(db, { nowMs, retainDays: 30 });
    expect(res.deleted).toBe(2);
    expect(deleted.sort()).toEqual(['edge-30', 'old-31']);
  });
  it('is a no-op when nothing is old enough', async () => {
    const { db, deleted } = fakeDb({ snapshots: [{ id: 'a', asOfMs: Date.now() }] });
    expect((await expireRankingSnapshots(db, { nowMs: Date.now(), retainDays: 30 })).deleted).toBe(0);
    expect(deleted).toEqual([]);
  });
});

describe('firestore.rules — the two V2 paths deny every client verb (source tripwire)', () => {
  const rules = readFileSync(path.join(REPO_ROOT, 'firestore.rules'), 'utf8');
  it('rankingSnapshots/{snapshotId} and ops/rankingSnapshots are explicit `if false` blocks', () => {
    expect(rules).toMatch(/match \/rankingSnapshots\/\{snapshotId\} \{\s*allow read, write: if false;/);
    expect(rules).toMatch(/match \/ops\/rankingSnapshots \{\s*allow read, write: if false;/);
  });
});
