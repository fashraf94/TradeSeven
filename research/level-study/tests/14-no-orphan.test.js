// Test #14 (S3 required test 7; S3.5 §9.8 ownership-aware rework) — No-orphan closure.
// Beyond "the id exists somewhere": every snapshot's OWNER is coherent with the
// merge-timing rule; every match-history entry maps to a session snapshot actually owned
// by that family (or by its merge successor on the merge date itself); transferred
// entries walk a valid mergedInto chain; and the full hard-invariant battery holds.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDaily } from '../lib/normalize.js';
import { runLevels, assertRegistryInvariants } from '../02-build-levels.js';
import { loadFixture } from './_helpers.js';

test('ownership-aware closure: KO registry (fixture) — invariants + ownership + transfer chains', () => {
  const { bars } = normalizeDaily(loadFixture('daily/KO_eod_2018-01-01_2026-07-10.json'));
  const res = runLevels(bars, { symbol: 'KO', endDate: '2024-02-29' });
  assert.ok(res.sessions.length >= 100, 'window too small to be meaningful');

  // The hard-invariant battery (S3.5 §7c) must pass on a real registry.
  assertRegistryInvariants(res);

  // Index every session's snapshots by id → owner.
  const ownerOf = new Map(); // snapshotId -> {date, familyId}
  for (const s of res.sessions) {
    for (const snap of s.snapshots) {
      assert.ok(!ownerOf.has(snap.snapshotId), `duplicate snapshotId ${snap.snapshotId}`);
      ownerOf.set(snap.snapshotId, { date: s.date, familyId: snap.familyId });
      assert.ok(res.families[snap.familyId], `${s.date}: unknown family ${snap.familyId}`);
    }
  }

  const walkMergeChain = (fromId, toId) => {
    // fromId's mergedInto chain must reach toId.
    let cur = res.families[fromId];
    for (let hops = 0; cur && cur.mergedInto && hops < 50; hops++) {
      if (cur.mergedInto === toId) return true;
      cur = res.families[cur.mergedInto];
    }
    return false;
  };

  for (const [fid, fam] of Object.entries(res.families)) {
    for (const h of fam.matchHistory) {
      const owner = ownerOf.get(h.snapshotId);
      assert.ok(owner, `${fid}: matchHistory references unknown snapshot ${h.snapshotId}`);
      assert.equal(owner.date, h.date, `${fid}: matchHistory date disagrees with the session`);
      if (!h.fromFamilyId) {
        // Own entry: the snapshot must be owned by this family — except on this family's
        // own merge date, where ownership was rewritten to the survivor (S3.5 §5).
        if (owner.familyId !== fid) {
          assert.equal(fam.status, 'merged', `${fid}: lost ownership of ${h.snapshotId} without merging`);
          assert.equal(h.date, fam.mergedDate, `${fid}: ownership rewrite outside the merge date`);
          assert.equal(owner.familyId, fam.mergedInto, `${fid}: merge-date snapshot must belong to the survivor`);
        }
      } else {
        // Transferred entry: the source family's merge chain must reach this family, the
        // entry must predate (or equal) the source's merge date, and the snapshot's owner
        // must be the source (pre-merge sessions) or a chain successor (merge-date rewrite).
        const src = res.families[h.fromFamilyId];
        assert.ok(src, `${fid}: transferred entry from unknown family ${h.fromFamilyId}`);
        assert.equal(src.status, 'merged', `${fid}: transfer source ${h.fromFamilyId} never merged`);
        assert.ok(walkMergeChain(h.fromFamilyId, fid), `${fid}: no mergedInto chain from ${h.fromFamilyId}`);
        assert.ok(h.date <= src.mergedDate, `${fid}: transferred entry postdates the source's merge`);
        assert.ok(owner.familyId === h.fromFamilyId || walkMergeChain(h.fromFamilyId, owner.familyId) || owner.familyId === fid,
          `${fid}: transferred snapshot ${h.snapshotId} owned by unrelated family ${owner.familyId}`);
      }
    }
    // Terminal-state coherence.
    if (fam.status === 'merged') {
      assert.ok(fam.mergedInto && fam.mergedDate, `${fid}: merged without mergedInto/mergedDate`);
      assert.ok(res.families[fam.mergedInto], `${fid}: mergedInto ${fam.mergedInto} missing`);
    }
    if (fam.splitFrom) assert.ok(res.families[fam.splitFrom], `${fid}: splitFrom ${fam.splitFrom} missing`);
    for (const m of fam.mergedFrom) assert.ok(res.families[m.familyId], `${fid}: mergedFrom ${m.familyId} missing`);
  }

  // Every snapshot-referenced family exists and was live when it owned the snapshot
  // (a family founded in-study is referenced from its bornDate on; warmup genealogy
  // families may legitimately be study-unreferenced).
  for (const [snapId, owner] of ownerOf) {
    const f = res.families[owner.familyId];
    assert.ok(owner.date >= f.bornDate || f.preStudy, `${snapId}: owned before its family was born`);
  }
});
