// Test #14 (S3 required test 7) — No-orphan invariant.
// Every snapshot maps to EXACTLY ONE family; every family referenced by a snapshot
// exists in the family store; every match-history entry points at a snapshot that
// exists in the session registry. Run on a real committed fixture (full default source
// families) — the highest-churn surface available in Phase A.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDaily } from '../lib/normalize.js';
import { runLevels } from '../02-build-levels.js';
import { loadFixture } from './_helpers.js';

test('no-orphan: KO registry — snapshot↔family closure holds on every session', () => {
  const { bars } = normalizeDaily(loadFixture('daily/KO_eod_2018-01-01_2026-07-10.json'));
  const res = runLevels(bars, { symbol: 'KO', endDate: '2024-02-29' });
  assert.ok(res.sessions.length >= 100, 'window too small to be meaningful');

  const allSnapshotIds = new Set();
  for (const s of res.sessions) {
    for (const snap of s.snapshots) {
      assert.equal(typeof snap.familyId, 'string', `${s.date} ${snap.snapshotId}: snapshot without a family`);
      const fam = res.families[snap.familyId];
      assert.ok(fam, `${s.date} ${snap.snapshotId}: familyId ${snap.familyId} missing from the family store`);
      assert.ok(fam.bornDate <= s.date, `${s.date}: family ${snap.familyId} referenced before its bornDate`);
      assert.ok(!allSnapshotIds.has(snap.snapshotId), `duplicate snapshotId ${snap.snapshotId}`);
      allSnapshotIds.add(snap.snapshotId);
    }
  }

  for (const [fid, fam] of Object.entries(res.families)) {
    for (const h of fam.matchHistory) {
      assert.ok(allSnapshotIds.has(h.snapshotId), `${fid}: matchHistory references unknown snapshot ${h.snapshotId}`);
    }
    // Lineage cross-references resolve.
    if (fam.mergedInto) assert.ok(res.families[fam.mergedInto], `${fid}: mergedInto ${fam.mergedInto} missing`);
    if (fam.splitFrom) assert.ok(res.families[fam.splitFrom], `${fid}: splitFrom ${fam.splitFrom} missing`);
    for (const m of fam.mergedFrom) assert.ok(res.families[m.familyId], `${fid}: mergedFrom ${m.familyId} missing`);
  }

  // Every family in the store was referenced by at least one snapshot (its founding one).
  const referenced = new Set(res.sessions.flatMap((s) => s.snapshots.map((x) => x.familyId)));
  for (const fid of Object.keys(res.families)) {
    assert.ok(referenced.has(fid), `family ${fid} exists but no snapshot ever referenced it`);
  }
});
