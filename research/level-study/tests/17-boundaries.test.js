// Test #17 (S3.5 §9.3, §9.4, §9.5) — Exact-count boundary + compound-event assertions,
// driven at the lineage-engine grain with fabricated snapshot streams (precise session
// control; the production code path is exercised unchanged).
//
// Geometry under unit = 1: match radius = kMatch·1 = 1, merge distance = kMerge = 0.8,
// split span = kSplit = 1.6, retire = 20 unsupported, merge/split runs = 5, role
// confirm = 3 with zone half 0.25 + margin 0.25.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import CONFIG from '../config.js';
import { createLineageState, lineageStep } from '../lib/lineage.js';

const LIN = CONFIG.levels.lineage;

const snap = (id, centroid, side = 'support', prices = [centroid]) => ({
  snapshotId: id, centroid, side,
  members: prices.map((p) => ({ price: p })),
  familyId: null,
});

function day(state, D, snaps, refClose = 100.4, unit = 1) {
  lineageStep(state, D, snaps, { unit, refClose });
  return snaps;
}

const dates = (n) => [...Array(n).keys()].map((i) => `2024-03-${String(i + 1).padStart(2, '0')}`);

// Founding trick used below: the founding session runs under a SMALL unit (radius
// kMatch·0.3 = 0.3) so two nearby snapshots found two distinct families; later sessions
// run under unit 1, where the pair sits inside the merge distance (kMerge·1 = 0.8) —
// giving exact, countable merge-run sessions.
function foundPair(state, D, aPrice = 100, bPrice = 100.6) {
  day(state, D, [snap('a_found', aPrice), snap('b_found', bPrice)], 100.4, 0.3);
  const fams = [...state.families.values()];
  assert.equal(fams.length, 2, 'founding-unit trick must create two families');
  return fams;
}

test('merge boundary: does NOT fire on the 4th consecutive session, DOES on the 5th', () => {
  const state = createLineageState('MB');
  const D = dates(10);
  foundPair(state, D[0]); // founding day: gap 0.6 > kMerge·0.3 → no run yet
  for (let i = 1; i <= 5; i++) {
    day(state, D[i], [snap(`a${i}`, 100), snap(`b${i}`, 100.6)]); // both matched, gap ≤ 0.8
    const merges = state.events.filter((e) => e.type === 'merge');
    if (i < 5) assert.equal(merges.length, 0, `merge fired early on run session ${i}`);
    else assert.equal(merges.length, 1, 'merge must fire on the 5th consecutive session');
  }
  assert.equal(state.events.find((e) => e.type === 'merge').date, D[5]);
});

test('merge run resets on a miss and restarts from 1 (live support)', () => {
  const state = createLineageState('MR');
  const D = dates(12);
  foundPair(state, D[0]);
  // 3 both-matched in-range sessions…
  for (let i = 1; i <= 3; i++) day(state, D[i], [snap(`a${i}`, 100), snap(`b${i}`, 100.6)]);
  // …then one session where family B receives NO matching snapshot (no live support →
  // the pair run cannot advance and is deleted).
  day(state, D[4], [snap('a4', 100)]);
  assert.equal(state.events.filter((e) => e.type === 'merge').length, 0);
  // 4 more both-matched sessions: still no merge (run restarted from 1)…
  for (let i = 5; i <= 8; i++) {
    day(state, D[i], [snap(`a${i}`, 100), snap(`b${i}`, 100.6)]);
    assert.equal(state.events.filter((e) => e.type === 'merge').length, 0, `run did not restart from 1 (session ${i})`);
  }
  // …the 5th after the miss fires.
  day(state, D[9], [snap('a9', 100), snap('b9', 100.6)]);
  assert.equal(state.events.filter((e) => e.type === 'merge').length, 1);
  assert.equal(state.events.find((e) => e.type === 'merge').date, D[9]);
});

test('merge-date ownership (LS3-03): on the merge session, no snapshot references the absorbed id', () => {
  const state = createLineageState('MO');
  const D = dates(7);
  foundPair(state, D[0]);
  let last;
  for (let i = 1; i <= 5; i++) last = day(state, D[i], [snap(`a${i}`, 100), snap(`b${i}`, 100.6)]);
  const m = state.events.find((e) => e.type === 'merge');
  assert.ok(m, 'merge expected');
  for (const s of last) {
    assert.notEqual(s.familyId, m.absorbedId, 'merge must be effective in the D registry');
    assert.equal(s.familyId, m.survivorId);
  }
  // The absorbed family's transferred match history carries the merge-date entry.
  const survivor = state.families.get(m.survivorId);
  assert.ok(survivor.matchHistory.some((h) => h.fromFamilyId === m.absorbedId && h.date === m.date));
});

test('retirement boundary: survives 19 unsupported sessions, retires exactly on the 20th', () => {
  const state = createLineageState('RB');
  const all = [...Array(25).keys()].map((i) => `2024-04-${String(i + 1).padStart(2, '0')}`);
  day(state, all[0], [snap('s0', 100)]); // founding (matched)
  const fam = [...state.families.values()][0];
  for (let i = 1; i <= LIN.retireZeroSupportSessions; i++) {
    day(state, all[i], []); // unsupported
    if (i < LIN.retireZeroSupportSessions) {
      assert.equal(fam.status, 'live', `retired early after ${i} unsupported sessions`);
      assert.equal(fam.zeroSupportRun, i);
    } else {
      assert.equal(fam.status, 'retired', 'must retire exactly on the 20th unsupported session');
      assert.equal(fam.retiredDate, all[i]);
    }
  }
});

test('compound retire-vs-merge (§7a dissolution): 19 unsupported sessions, then a matched in-range session → support resets, pair run starts at 1, no immediate merge', () => {
  const state = createLineageState('RM');
  const all = [...Array(30).keys()].map((i) => `2024-05-${String(i + 1).padStart(2, '0')}`);
  // Found A and B 0.6 apart under a small unit (two distinct families, anchors fixed).
  const [famA, famB] = foundPair(state, all[0]);
  // A starves 19 sessions while B stays supported; the small unit keeps the pair outside
  // merge distance so no run can accrue while A is unsupported (live-support dissolution:
  // it could not accrue ANYWAY — that is the point being tested next).
  for (let i = 1; i <= 19; i++) {
    day(state, all[i], [snap(`b${i}`, 100.6)], 100.4, 0.3);
    assert.equal(state.pairRuns.size, 0, `pair run advanced while A was unsupported (session ${i})`);
  }
  assert.equal(famA.status, 'live');
  assert.equal(famA.zeroSupportRun, 19);
  // Session 20: A receives support again AND (unit 1) the pair is now inside merge range.
  day(state, all[20], [snap('a20', 100), snap('b20', 100.6)]);
  assert.equal(famA.status, 'live', 'support on session 20 must cancel the retirement path');
  assert.equal(famA.zeroSupportRun, 0);
  assert.equal(state.events.filter((e) => e.type === 'merge').length, 0, 'a family cannot complete a merge run on its first supported session');
  assert.equal(famB.status, 'live');
  // Merge completes only after 5 consecutive both-supported in-range sessions.
  for (let i = 21; i <= 24; i++) day(state, all[i], [snap(`a${i}`, 100), snap(`b${i}`, 100.6)]);
  assert.equal(state.events.filter((e) => e.type === 'merge').length, 1);
  assert.equal(state.events.find((e) => e.type === 'merge').date, all[24]);
});

test('compound split-then-merge: the branch later merges with a pre-existing neighbor; split and merge never co-fire', () => {
  const state = createLineageState('SM');
  const all = [...Array(20).keys()].map((i) => `2024-06-${String(i + 1).padStart(2, '0')}`);
  // Session 1 (unit 1): family F at 100.85 and neighbor H at 102.55 (gap 1.7 > radius 1).
  day(state, all[0], [snap('f0', 100.85, 'support', [100.85]), snap('h0', 102.55)]);
  const [famF, famH] = [...state.families.values()];
  // Sessions 2–6 (unit 1): F holds two separating snapshots — lo (members 100.0/100.1)
  // and hi (members 101.6/101.7; centroid 101.65 is 0.8 from F, 0.9 from H → F's) —
  // span 1.7 > kSplit·1; H stays supported by its own line at 102.55.
  for (let i = 1; i <= 5; i++) {
    day(state, all[i], [
      snap(`lo${i}`, 100.05, 'support', [100.0, 100.1]),
      snap(`hi${i}`, 101.65, 'support', [101.6, 101.7]),
      snap(`h${i}`, 102.55),
    ]);
  }
  const splits = state.events.filter((e) => e.type === 'split');
  assert.equal(splits.length, 1, 'split must fire on the 5th consecutive supported separation');
  assert.equal(splits[0].familyId, famF.familyId);
  assert.equal(splits[0].date, all[5]);
  const branch = state.families.get(splits[0].branches[0]);
  assert.equal(branch.splitFrom, famF.familyId);
  // No same-session split+merge (residual precedence table: they cannot co-fire).
  assert.equal(state.events.filter((e) => e.type === 'merge' && e.date === splits[0].date).length, 0);

  // Sessions 7–11 (unit 1.2 → merge distance 0.96, radius 1.2): the branch (anchor
  // 101.65) and H (anchor 102.55) sit 0.9 apart — a live-supported merge pair — while
  // F's own line walks DOWN to 99.7 so the F–branch gap exits merge range immediately.
  for (let i = 6; i <= 10; i++) {
    day(state, all[i], [
      snap(`lo${i}`, 99.7, 'support', [99.7]),
      snap(`hi${i}`, 101.65, 'support', [101.65]),
      snap(`h${i}`, 102.55),
    ], 100.4, 1.2);
  }
  const merge = state.events.find((e) => e.type === 'merge');
  assert.ok(merge, 'sequential split→merge compound must complete');
  assert.equal(merge.date, all[10], 'merge fires on the 5th both-supported in-range session after the split');
  assert.ok(merge.date > splits[0].date, 'merge follows the split, never co-fires');
  // Elder of (H: session 1) vs (branch: session 6) — H survives, branch absorbed.
  assert.equal(merge.survivorId, famH.familyId, 'the pre-existing neighbor is elder and survives');
  assert.equal(merge.absorbedId, branch.familyId);
  assert.equal(famF.status, 'live', 'the split elder is untouched by the branch merge');
});

test('role boundary: 2 confirming closes do not flip; the 3rd does; a gray-band session resets the run', () => {
  const state = createLineageState('RO');
  const all = [...Array(15).keys()].map((i) => `2024-07-${String(i + 1).padStart(2, '0')}`);
  // Support family at anchor 100 (unit 1 → zone ±0.25, flip margin 0.25 → flip evidence
  // needs refClose ≤ 99.5).
  day(state, all[0], [snap('s0', 100, 'support')], 100.4);
  const fam = [...state.families.values()][0];
  // Two confirming closes (99.4) → pending builds, no flip.
  day(state, all[1], [snap('s1', 100, 'support')], 99.4);
  day(state, all[2], [snap('s2', 100, 'support')], 99.4);
  assert.equal(fam.roleLog.length, 1, 'flip must wait for the third confirming close');
  assert.equal(fam.pendingRun, 2);
  // Gray band (outside the zone but short of the margin: 99.6 ∈ (99.5, 99.75)) → reset.
  day(state, all[3], [snap('s3', 100, 'support')], 99.6);
  assert.equal(fam.pendingRun, 0, 'gray-band close must reset the consecutive-evidence run');
  // Three fresh confirming closes → flip on the third.
  day(state, all[4], [snap('s4', 100, 'support')], 99.4);
  day(state, all[5], [snap('s5', 100, 'support')], 99.4);
  assert.equal(fam.roleLog.length, 1);
  day(state, all[6], [snap('s6', 100, 'support')], 99.4);
  assert.deepEqual(fam.roleLog.map((r) => r.role), ['support', 'support_turned_resistance']);
  assert.equal(fam.roleLog[1].date, all[6], 'flip is recorded on the session after the 3rd confirming D−1 close');
  assert.equal(fam.pendingRun, 0);
});
