// Test #13 (S3 required test 6) — Synthetic lineage scenarios (parent §5.4).
// Five constructed PRICE SERIES, one per lineage behavior, each run through the FULL
// pipeline (bars → fractals/AVWAP → confluence → lineage). Scenarios isolate one source
// family via the builder's test hook so the geometry stays steerable; the lineage rules
// under test are always the production code path.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runLevels, registryAt } from '../02-build-levels.js';
import { synthBars, zigzag, rampTo, flat } from './_synthetic.js';

// ── (a) slow centroid drift keeps one familyId ────────────────────────────────
test('scenario a — drift: a slowly drifting zone keeps its familyId (identity, not rebirth)', () => {
  // Period-4 zigzag whose base drifts +0.005/bar (~1% over the run): two structural
  // zones (trough line ~100, peak line ~101.5) that drift upward together.
  const closes = [...flat(100, 8), ...zigzag(100, 1.4, 48, { drift: 0.005 })];
  const bars = synthBars(closes, { h: 0.1 });
  const res = runLevels(bars, { symbol: 'DRIFT', startDate: bars[25].date, enabledFamilies: ['structural'] });

  const ids = Object.keys(res.families);
  assert.equal(ids.length, 2, `expected exactly 2 families (trough + peak zone), got ${ids.length}`);
  assert.ok(ids.every((id) => res.families[id].status === 'live'), 'a drifting zone must stay live');
  assert.equal(res.events.filter((e) => e.type !== 'role_flip').length, 0,
    'slow drift must produce no merge/split/retirement');

  // Every session maps its snapshots to the SAME two families — no identity churn.
  for (const s of res.sessions) {
    assert.equal(s.snapshots.length, 2, `${s.date}: expected 2 zone snapshots`);
    for (const snap of s.snapshots) assert.ok(ids.includes(snap.familyId), `${s.date}: unexpected family`);
  }

  // The support family genuinely TRACKED the drift (anchor moved with the zone).
  const trough = res.families[ids.sort((a, b) => res.families[a].anchor - res.families[b].anchor)[0]];
  const firstCentroid = trough.matchHistory[0].centroid;
  assert.ok(trough.anchor - firstCentroid > 0.4,
    `anchor should have drifted up with the zone (start ${firstCentroid.toFixed(2)} → ${trough.anchor.toFixed(2)})`);
  assert.deepEqual(trough.roleLog.map((r) => r.role), ['support'], 'trough zone stays support throughout');
});

// ── (b) two families converging → merge, elder survives, state transfers ──────
test('scenario b — merge: converging families merge; elder id survives; state transfers', () => {
  // avwap_high carries a high-plateau bias (window from idx 25); avwap_low anchors at the
  // later trough (idx ~54). Both asymptote to the 101 consolidation → anchors converge
  // within 0.4% for 5 consecutive sessions → merge.
  const closes = [
    ...flat(100, 25),
    108,                          // swing-high anchor (H)
    ...flat(106.5, 16),           // plateau: bias exclusive to H's window
    ...rampTo(106.5, 98.7, 0.7),  // decline (crosses H's 5% significance en route)
    98.0,                         // trough: swing-low anchor (L)
    ...rampTo(98.0, 102.1, 0.6),  // recovery (crosses L's 5% significance at the top)
    ...rampTo(102.1, 101.0, 0.5),
    ...flat(101.0, 230),          // long consolidation at 101
  ];
  const bars = synthBars(closes, { h: 0.5 });
  const res = runLevels(bars, { symbol: 'MRG', startDate: bars[70].date, enabledFamilies: ['participation'] });

  const ids = Object.keys(res.families);
  assert.equal(ids.length, 2, `expected exactly 2 families, got ${ids.length}`);
  const merges = res.events.filter((e) => e.type === 'merge');
  assert.equal(merges.length, 1, 'expected exactly one merge event');
  assert.equal(res.events.filter((e) => e.type === 'retirement').length, 0,
    'the losing family must MERGE (anchor proximity), not starve to retirement');

  const survivor = res.families[merges[0].survivorId];
  const absorbed = res.families[merges[0].absorbedId];
  // Elder survival: both born the same session here → founding order (lower id) is elder.
  assert.equal(survivor.familyId, [...ids].sort()[0], 'elder family must survive the merge');
  assert.equal(absorbed.status, 'merged');
  assert.equal(absorbed.mergedInto, survivor.familyId);
  assert.equal(absorbed.mergedDate, merges[0].date);
  assert.ok(survivor.mergedFrom.some((m) => m.familyId === absorbed.familyId), 'survivor must record mergedFrom');

  // In-flight state transferred: the absorbed family's match history rides with the
  // survivor, tagged with its source familyId (S3-C15).
  assert.ok(survivor.matchHistory.some((h) => h.fromFamilyId === absorbed.familyId),
    'absorbed matchHistory must transfer to the survivor');

  // Absorbed family is dead to matching: nothing matched to it after the merge date…
  assert.ok(absorbed.matchHistory.every((h) => h.date <= absorbed.mergedDate),
    'absorbed family matched after its merge');
  // …and every post-merge snapshot belongs to the survivor.
  for (const s of res.sessions.filter((x) => x.date > merges[0].date)) {
    for (const snap of s.snapshots) assert.equal(snap.familyId, survivor.familyId, `${s.date}: post-merge snapshot not on survivor`);
  }
});

// ── (c) a family's methods separating → split with correct parentage ─────────
test('scenario c — split: separating constituent methods split; elder keeps id; branch records splitFrom', () => {
  // Fat ranges (h=2.5 → ATR≈5 → match radius ≈1.25) keep both method levels inside ONE
  // family while they separate. avwap_high has a long window (anchor idx 25); avwap_low a
  // young window (anchor idx 80): the slow drift down pulls the young AVWAP away >1.5%
  // for 5 consecutive sessions → split.
  const closes = [
    ...flat(100, 25),
    104,                          // swing-high anchor (significance immediate under h=2.5)
    ...flat(100, 54),             // long flat: avwap_high settles with a big window
    99,                           // dip bar: swing-low anchor (significance immediate)
    ...flat(100, 4),
    ...rampTo(100, 92.5, 0.1),    // slow drift: young avwap_low falls much faster
    ...flat(92.5, 15),
  ];
  const bars = synthBars(closes, { h: 2.5 });
  const res = runLevels(bars, { symbol: 'SPL', startDate: bars[30].date, enabledFamilies: ['participation'] });

  const splits = res.events.filter((e) => e.type === 'split');
  assert.equal(splits.length, 1, 'expected exactly one split event');
  assert.equal(res.events.filter((e) => e.type === 'merge').length, 0, 'no merges expected');

  const ids = Object.keys(res.families);
  assert.equal(ids.length, 2, `expected exactly 2 families (elder + branch), got ${ids.length}`);
  const elder = res.families[splits[0].familyId];
  const branchId = splits[0].branches[0];
  const branch = res.families[branchId];
  assert.equal(elder.familyId, [...ids].sort()[0], 'elder must keep its (older) id');
  assert.equal(branch.splitFrom, elder.familyId, 'branch must record splitFrom parentage');
  assert.equal(branch.bornDate, splits[0].date, 'branch is born on the split session');
  assert.equal(elder.status, 'live');
  assert.equal(branch.status, 'live');
  assert.ok(splits[0].spanPct > 1.5, 'split must fire on >1.5% constituent separation');

  // The separation was OBSERVED for 5 consecutive sessions before the trigger: the elder
  // family was matched by ≥2 snapshots with >1.5% member span on each of those sessions.
  const sessionsBefore = res.sessions.filter((s) => s.date <= splits[0].date).slice(-5);
  for (const s of sessionsBefore) {
    const famSnaps = s.snapshots.filter((x) => x.familyId === elder.familyId || x.familyId === branchId);
    assert.equal(famSnaps.length, 2, `${s.date}: family should hold 2 separating snapshots`);
    const prices = famSnaps.flatMap((x) => x.members.map((m) => m.price));
    const span = ((Math.max(...prices) - Math.min(...prices)) / ((Math.max(...prices) + Math.min(...prices)) / 2)) * 100;
    assert.ok(span > 1.5, `${s.date}: span ${span.toFixed(2)}% should exceed 1.5% in the trigger window`);
  }

  // Post-split: the two zones live under their own ids.
  const after = res.sessions.filter((s) => s.date > splits[0].date);
  assert.ok(after.length >= 5, 'need post-split sessions');
  for (const s of after.slice(0, 5)) {
    const famIds = new Set(s.snapshots.map((x) => x.familyId));
    assert.ok(famIds.has(elder.familyId) && famIds.has(branchId), `${s.date}: both split halves should be matched`);
  }
});

// ── (d) support decay → retirement; reformation is a NEW family ──────────────
test('scenario d — retirement: 20 unsupported sessions retire; reformation at the same price is a NEW family', () => {
  const closes = [
    ...flat(100, 8),
    ...zigzag(100, 1.4, 18),      // zone at ~100 forms
    ...rampTo(100, 130, 2),       // price leaves
    ...zigzag(130, 1.8, 40),      // long absence: old pivots age out of the 120-session
    ...rampTo(130, 100, 2),       //   trailing window → 20 unsupported sessions → retire
    ...zigzag(100, 1.4, 10),      // price returns: the zone re-forms
  ];
  const bars = synthBars(closes, { h: 0.1 });
  const res = runLevels(bars, { symbol: 'RET', startDate: bars[25].date, enabledFamilies: ['structural'] });

  const retirements = res.events.filter((e) => e.type === 'retirement');
  assert.ok(retirements.length >= 1, 'expected at least one retirement');

  // The original ~100 trough family retired…
  const orig = Object.values(res.families)
    .filter((f) => f.bornDate === res.sessions[0].date)
    .sort((a, b) => a.anchor - b.anchor)[0];
  assert.equal(orig.status, 'retired', 'original zone family must be retired');
  assert.ok(orig.retiredDate, 'retiredDate must be stamped');
  assert.ok(retirements.some((e) => e.familyId === orig.familyId), 'retirement event missing');

  // …cannot re-arm: no matches after retirement, and its role log is frozen.
  assert.ok(orig.matchHistory.every((h) => h.date <= orig.retiredDate), 'retired family matched after retirement');
  assert.ok(orig.roleLog.every((r) => r.date <= orig.retiredDate), 'role log grew after retirement');

  // Reformation at the same price got a NEW familyId (memory decayed — parent §5.4).
  const reformed = Object.values(res.families).find((f) =>
    f.familyId !== orig.familyId &&
    f.bornDate > orig.retiredDate &&
    Math.abs(f.anchor - orig.anchor) / orig.anchor < 0.01);
  assert.ok(reformed, 'no new family formed at the old price after retirement');
  assert.equal(reformed.status, 'live');
  assert.equal(reformed.splitFrom, null, 'reformation is a fresh family, not a branch');
  assert.ok(reformed.bornDate > orig.retiredDate, 'reformation must postdate the retirement');
});

// ── (e) break-and-hold → role flip appended; log is append-only ───────────────
test('scenario e — role flip: break-and-hold appends exactly one flip; the log never rewrites', () => {
  const closes = [
    ...flat(101, 8),
    ...zigzag(100.5, 2.0, 15),    // support zone at ~100.4 while price holds above
    ...rampTo(100.5, 98.0, 0.5),  // break below
    ...zigzag(97.0, 1.0, 10),     // hold below: the old support zone is now overhead
  ];
  const bars = synthBars(closes, { h: 0.1 });
  const full = runLevels(bars, { symbol: 'FLIP', startDate: bars[25].date, enabledFamilies: ['structural'] });

  const zone = Object.values(full.families)
    .filter((f) => f.bornDate === full.sessions[0].date)
    .sort((a, b) => a.anchor - b.anchor)[0]; // the ~100.4 trough zone
  assert.deepEqual(zone.roleLog.map((r) => r.role), ['support', 'support_turned_resistance'],
    'expected exactly one break-and-hold flip appended');
  assert.equal(full.events.filter((e) => e.type === 'role_flip' && e.familyId === zone.familyId).length, 1);

  // Append-only, no rewrites: the log at any earlier cutoff is a byte-exact PREFIX of the
  // final log (same family id resolved independently in the truncated run).
  for (const cutIdx of [68, 78]) { // one pre-flip, one just post-flip
    const partial = runLevels(bars, { symbol: 'FLIP', startDate: bars[25].date, endDate: bars[cutIdx].date, enabledFamilies: ['structural'] });
    const zonePartial = Object.values(partial.families)
      .filter((f) => f.bornDate === partial.sessions[0].date)
      .sort((a, b) => a.anchor - b.anchor)[0];
    assert.equal(zonePartial.familyId, zone.familyId, 'family identity must be stable across cutoffs');
    const prefix = zone.roleLog.slice(0, zonePartial.roleLog.length);
    assert.deepEqual(zonePartial.roleLog, prefix, `role log at cutoff ${cutIdx} is not a prefix of the final log`);
  }

  // The flip did not thrash back while price stayed below.
  const flipDate = zone.roleLog[1].date;
  assert.ok(full.sessions.filter((s) => s.date > flipDate).length >= 20, 'need sessions after the flip');
  assert.equal(zone.roleLog.length, 2, 'no further flips while price holds below');
});
