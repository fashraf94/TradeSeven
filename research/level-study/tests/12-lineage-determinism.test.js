// Test #12 (S3 required test 5) — Lineage determinism (parent §5.4).
// (a) Identical input series → identical family histories across runs (full-state
//     canonical equality on a real committed fixture).
// (b) Processing-order independence: the fixed ascending-price rule makes the lineage
//     step's output invariant to the order snapshots arrive in.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDaily } from '../lib/normalize.js';
import { runLevels, canonical } from '../02-build-levels.js';
import { createLineageState, lineageStep } from '../lib/lineage.js';
import { loadFixture } from './_helpers.js';

test('determinism: two identical AAPL runs produce byte-identical registries + family histories', () => {
  const { bars } = normalizeDaily(loadFixture('daily/AAPL_eod_2018-01-01_2026-07-10.json'));
  const a = runLevels(bars, { symbol: 'AAPL', endDate: '2023-12-29' });
  const b = runLevels(bars, { symbol: 'AAPL', endDate: '2023-12-29' });
  assert.equal(canonical(a), canonical(b), 'two runs over the same series diverged');
  assert.ok(Object.keys(a.families).length > 0, 'no families formed — vacuous determinism');
});

test('determinism: snapshot arrival order is irrelevant (ascending-price rule)', () => {
  const mkSnap = (id, centroid, side, prices) => ({
    snapshotId: id, centroid, side,
    members: prices.map((p) => ({ price: p })),
    familyId: null,
  });
  // Three sessions; second session's snapshots contest the same families.
  const sessions = [
    { D: '2024-01-02', atr: 2, snaps: [mkSnap('s1', 100, 'support', [100]), mkSnap('s2', 103, 'resistance', [103])] },
    { D: '2024-01-03', atr: 2, snaps: [mkSnap('s3', 100.3, 'support', [100.3]), mkSnap('s4', 100.9, 'support', [100.9]), mkSnap('s5', 103.1, 'resistance', [103.1])] },
    { D: '2024-01-04', atr: 2, snaps: [mkSnap('s6', 100.2, 'support', [100.2]), mkSnap('s7', 102.8, 'resistance', [102.8])] },
  ];

  const runWith = (orderFn) => {
    const state = createLineageState('ORD');
    const assignments = [];
    for (const { D, atr, snaps } of sessions) {
      // fresh snapshot objects each run (lineageStep assigns familyId onto them)
      const copies = snaps.map((s) => ({ ...s, members: s.members.map((m) => ({ ...m })), familyId: null }));
      lineageStep(state, D, orderFn(copies), atr);
      for (const c of [...copies].sort((x, y) => (x.snapshotId < y.snapshotId ? -1 : 1))) {
        assignments.push(`${c.snapshotId}→${c.familyId}`);
      }
    }
    return { state: canonical({ families: [...state.families.values()], events: state.events, seq: state.seq }), assignments: assignments.join(',') };
  };

  const asc = runWith((s) => s);
  const desc = runWith((s) => [...s].reverse());
  const shuffled = runWith((s) => [s[s.length - 1], ...s.slice(0, -1)]);

  assert.equal(asc.assignments, desc.assignments, 'snapshot→family assignment depends on arrival order');
  assert.equal(asc.state, desc.state, 'lineage state depends on arrival order');
  assert.equal(asc.state, shuffled.state, 'lineage state depends on arrival order (rotation)');
});
