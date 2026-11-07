// api/_utils/huddle/worker.test.js
//
// Huddle S1 — the worker's reconcile pass (spec V1.1 §6.5; Amendments A §A6, §A9, B §B3), on injected I/O and an
// in-memory query. Review L1-3: the pass walked the rows in document-id order and stopped at its budget, and nothing
// cleared a row's reconcile flag, so the same leading players took the budget every tick and the tail was never retired
// at the close. Now: least recently reconciled first, every visit stamped, a settled day leaves the set.

import { describe, it, expect } from 'vitest';
import { runReconcilePass } from './worker.js';
import { rowsToReconcile } from './queue.js';

const ET = '2026-11-09';
function memoryQueue(rows) {
  const q = { where: () => q, get: async () => ({ docs: rows.filter((r) => r.reconcile === true).map((r) => ({ data: () => ({ ...r }) })) }) };
  return { collection: () => q };
}

describe('rowsToReconcile', () => {
  it('least recently reconciled first; a row never visited before any visited one', async () => {
    const db = memoryQueue([
      { uid: 'a', etDate: ET, reconcile: true, reconciledAt: '2026-11-09T15:02:00.000Z' },
      { uid: 'b', etDate: ET, reconcile: true },
      { uid: 'c', etDate: ET, reconcile: true, reconciledAt: '2026-11-09T15:00:00.000Z' },
      { uid: 'd', etDate: ET, reconcile: false },
    ]);
    expect((await rowsToReconcile(db, { etDate: ET })).map((r) => r.uid)).toEqual(['b', 'c', 'a']);
  });
});

describe('runReconcilePass (review L1-3)', () => {
  // A store of rows the injected I/O reads and stamps, and a clock each visit advances by `costMs`.
  function harness(n, { costMs = 400, settledAfterMs = Infinity } = {}) {
    const rows = Array.from({ length: n }, (_, i) => ({ uid: `u${String(i).padStart(2, '0')}`, etDate: ET, reconcile: true }));
    let now = Date.parse('2026-11-09T19:00:00Z');
    const visits = [];
    const deps = {
      rowsToReconcile: async () => rows.filter((r) => r.reconcile).sort((a, b) => String(a.reconciledAt ?? '').localeCompare(String(b.reconciledAt ?? '')) || (a.uid < b.uid ? -1 : 1)),
      reconcileHuddle: async (db, { uid, nowMs }) => { visits.push(uid); now += costMs; return { outcome: 'reconciled', settled: nowMs >= settledAfterMs }; },
      markReconciled: async (db, { uid, settled, nowMs }) => { const r = rows.find((x) => x.uid === uid); r.reconciledAt = new Date(nowMs).toISOString(); if (settled) r.reconcile = false; },
    };
    return { rows, visits, deps, clock: () => now, tick: (ms) => { now += ms; } };
  }

  it('a pass that runs out of budget resumes on the next tick where it stopped — every row is visited within two ticks', async () => {
    const h = harness(40);
    const first = await runReconcilePass(null, { etDate: ET, clock: h.clock, deps: h.deps });
    expect(first.visited).toBeLessThan(40);
    const seenFirst = new Set(h.visits);
    h.tick(120_000);
    await runReconcilePass(null, { etDate: ET, clock: h.clock, deps: h.deps });
    const seenSecond = h.visits.slice(seenFirst.size);
    expect(seenSecond[0]).not.toBe('u00');
    expect(new Set([...seenFirst, ...seenSecond]).size).toBe(40);
  });

  it('a settled day leaves the set: after the close the passes empty it', async () => {
    const h = harness(40, { settledAfterMs: Date.parse('2026-11-09T21:00:00Z') });
    h.tick(2 * 3_600_000); // past the close
    for (let i = 0; i < 3; i += 1) { await runReconcilePass(null, { etDate: ET, clock: h.clock, deps: h.deps }); h.tick(120_000); }
    expect(h.rows.filter((r) => r.reconcile)).toEqual([]);
  });

  it('a stamp that fails does not stop the pass', async () => {
    const h = harness(3, { costMs: 1 });
    h.deps.markReconciled = async () => { throw new Error('contention'); };
    const r = await runReconcilePass(null, { etDate: ET, clock: h.clock, deps: h.deps });
    expect(r.visited).toBe(3);
  });
});
