// Test #13 (S3 required test 6; S3.5-reworked) — Synthetic lineage scenarios (parent §5.4).
// Five constructed PRICE SERIES, one per lineage behavior, each run through the FULL
// pipeline (bars → fractals/AVWAP → bounded-diameter confluence → lineage) under the
// unified distance scale, live-support rule, warmup replay, and role state machine.
// Each scenario ALSO asserts incremental ≡ truncated-rebuild equivalence at its key
// event date (S3.5 §9.6 — S3 claimed this ran implicitly; now it actually runs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import CONFIG from '../config.js';
import { runLevels, runTruncated, canonical } from '../02-build-levels.js';
import { synthBars, zigzag, rampTo, flat } from './_synthetic.js';

const GEO = CONFIG.levels.geometry.multiples;
const START = '2024-02-05'; // synthetic study start (bars index ≥ 25 under the 2024-01-01 weekday calendar)

function studyEvents(res) {
  return res.events.filter((e) => e.date >= res.actualFirstSession);
}

function assertTruncatedEquivalent(bars, D, opts, label) {
  const inc = runLevels(bars, { ...opts, endDate: D });
  const tru = runTruncated(bars, D, opts);
  assert.equal(canonical(inc), canonical(tru), `${label}: incremental ≠ truncated rebuild @ ${D}`);
}

// ── (a) slow centroid drift keeps one familyId ────────────────────────────────
test('scenario a — drift: a slowly drifting zone keeps its familyId (identity, not rebirth)', () => {
  const closes = [...flat(100, 8), ...zigzag(100, 1.4, 48, { drift: 0.005 })];
  const bars = synthBars(closes, { h: 0.1 });
  const opts = { symbol: 'DRIFT', startDate: START, enabledFamilies: ['structural'] };
  const res = runLevels(bars, opts);

  const ids = Object.keys(res.families);
  assert.equal(ids.length, 2, `expected exactly 2 families (trough + peak zone), got ${ids.length}`);
  assert.ok(ids.every((id) => res.families[id].status === 'live'), 'a drifting zone must stay live');
  assert.equal(studyEvents(res).length, 0, 'slow drift must produce no lineage events at all');

  // Warmup replay: both zones formed before the study window and carry true provenance.
  for (const id of ids) {
    const f = res.families[id];
    assert.equal(f.preStudy, true, `${id} formed in warmup — preStudy must be true`);
    assert.ok(f.bornDate < START, 'true bornDate must predate the study window');
    assert.ok(f.preStudyAgeSessions > 0, 'preStudyAgeSessions must be stamped');
  }

  // Every session maps its snapshots to the SAME two families — no identity churn.
  for (const s of res.sessions) {
    assert.ok(s.snapshots.length >= 1, `${s.date}: no snapshots`);
    for (const snap of s.snapshots) assert.ok(ids.includes(snap.familyId), `${s.date}: unexpected family`);
  }

  // The support family genuinely TRACKED the drift and never flipped role.
  const trough = res.families[ids.sort((a, b) => res.families[a].anchor - res.families[b].anchor)[0]];
  const firstCentroid = trough.matchHistory[0].centroid;
  assert.ok(trough.anchor - firstCentroid > 0.3,
    `anchor should have drifted up with the zone (start ${firstCentroid.toFixed(2)} → ${trough.anchor.toFixed(2)})`);
  assert.deepEqual(trough.roleLog.map((r) => r.role), ['support'], 'no role thrash under the state machine');

  assertTruncatedEquivalent(bars, res.sessions[Math.floor(res.sessions.length / 2)].date, opts, 'drift');
});

// ── (b) two families converging → merge, elder survives, state transfers ──────
test('scenario b — merge: converging zones merge under live support; elder survives; merge is effective in the D registry', () => {
  // Two structural pivot lines converge, then HOLD at a gap of ~0.7 distance units —
  // wide enough for two snapshots (> kConfluence·u), close enough for the anchors to sit
  // within kMerge·u — with BOTH families matched every session (live support). The hold
  // outlasts the 120-session trailing window so old wide pivots age out.
  const closes = [
    ...flat(100.7, 8),
    ...zigzag(100, 1.4, 15),
    ...Array.from({ length: 25 }, (_, cy) => {
      const amp = 1.4 - (1.25 * (cy + 1)) / 25;
      const base = 100 + (0.55 * (cy + 1)) / 25;
      return [base, base + amp / 2, base + amp, base + amp / 2];
    }).flat(),
    ...zigzag(100.55, 0.15, 38),
  ];
  const bars = synthBars(closes, { h: 0.1 });
  const opts = { symbol: 'MRG', startDate: START, enabledFamilies: ['structural'] };
  const res = runLevels(bars, opts);

  const merges = studyEvents(res).filter((e) => e.type === 'merge');
  assert.equal(merges.length, 1, `expected exactly one merge event, got ${merges.length}`);
  assert.equal(studyEvents(res).filter((e) => e.type === 'retirement').length, 0,
    'the converging pair must MERGE, not starve to retirement');

  const m = merges[0];
  const survivor = res.families[m.survivorId];
  const absorbed = res.families[m.absorbedId];
  // Elder survival: same bornDate here → founding order (lower id) is elder.
  assert.equal(survivor.familyId, [survivor.familyId, absorbed.familyId].sort()[0], 'elder family must survive');
  assert.equal(absorbed.status, 'merged');
  assert.equal(absorbed.mergedInto, survivor.familyId);
  assert.equal(absorbed.mergedDate, m.date);
  assert.ok(survivor.mergedFrom.some((x) => x.familyId === absorbed.familyId && x.date === m.date), 'mergedFrom provenance');
  assert.equal(typeof m.absorbedAnchor, 'number', 'absorbed anchor must be audited on the merge event');

  // LS3-03 regression: the merge is EFFECTIVE ON ITS OWN DATE — no snapshot on the merge
  // date (or any later session) references the absorbed id.
  for (const s of res.sessions.filter((x) => x.date >= m.date)) {
    for (const snap of s.snapshots) {
      assert.notEqual(snap.familyId, absorbed.familyId, `${s.date}: snapshot still owned by the absorbed family`);
    }
  }

  // State transfer: absorbed match history rides with the survivor, tagged and SORTED.
  const transferred = survivor.matchHistory.filter((h) => h.fromFamilyId === absorbed.familyId);
  assert.ok(transferred.length > 0, 'absorbed matchHistory must transfer to the survivor');
  for (let i = 1; i < survivor.matchHistory.length; i++) {
    assert.ok(survivor.matchHistory[i - 1].date <= survivor.matchHistory[i].date, 'merged matchHistory must be chronologically sorted');
  }
  assert.ok(transferred.every((h) => h.date <= m.date), 'absorbed family cannot be matched after its merge');
  // Pending role state: discarded on the absorbed record (survivor-only rule).
  assert.equal(absorbed.pendingSide, null);
  assert.equal(absorbed.pendingRun, 0);
  // sequenceIndex operator: recompute-from-merged-touchHistory (empty in S3.5 → 0).
  assert.equal(survivor.sequenceIndex, survivor.touchHistory.length);

  assertTruncatedEquivalent(bars, m.date, opts, 'merge');
});

// ── (c) a family's methods separating → split with correct parentage ─────────
test('scenario c — split: constituents separating past kSplit·u split; elder keeps id; branch records splitFrom', () => {
  // Volume-pinned avwap_high (heavy flat window ≈ 100) + young light-volume avwap_low
  // tracking a slow drift down: their span crosses kSplit·u and HOLDS ≥5 supported
  // sessions while both stay inside the kMatch·u radius.
  const heavy = (c) => ({ c, v: 5000 });
  const light = (c) => ({ c, v: 200 });
  const closes = [
    ...flat(100, 25).map(heavy),
    { c: 104, v: 5000 },
    ...flat(100, 54).map(heavy),
    { c: 99, v: 200 },
    ...flat(100, 4).map(light),
    ...rampTo(100, 98.4, 0.06).map(light),
    ...rampTo(98.4, 96, 0.02).map(light),
    ...flat(96, 10).map(light),
  ];
  const bars = synthBars(closes, { h: 2.5 });
  const opts = { symbol: 'SPL', startDate: '2024-02-14', enabledFamilies: ['participation'] };
  const res = runLevels(bars, opts);

  const splits = studyEvents(res).filter((e) => e.type === 'split');
  assert.equal(splits.length, 1, `expected exactly one split event, got ${splits.length}`);
  assert.equal(studyEvents(res).filter((e) => e.type === 'merge').length, 0, 'no merges expected');

  const sp = splits[0];
  const ids = Object.keys(res.families);
  assert.equal(ids.length, 2, `expected exactly 2 families (elder + branch), got ${ids.length}`);
  const elder = res.families[sp.familyId];
  const branch = res.families[sp.branches[0]];
  assert.equal(elder.familyId, [...ids].sort()[0], 'elder must keep its (older) id');
  assert.equal(branch.splitFrom, elder.familyId, 'branch must record splitFrom parentage');
  assert.equal(branch.bornDate, sp.date, 'branch is born on the split session');
  assert.equal(elder.status, 'live');
  assert.equal(branch.status, 'live');
  assert.ok(sp.spanUnits > GEO.kSplit, `split must fire above kSplit units (got ${sp.spanUnits})`);

  // The separation was OBSERVED (live-supported, ≥2 snapshots, > kSplit·u) on each of
  // the 5 consecutive sessions ending at the trigger.
  const upTo = res.sessions.filter((s) => s.date <= sp.date);
  for (const s of upTo.slice(-CONFIG.levels.lineage.splitConsecutiveSessions)) {
    const famSnaps = s.snapshots.filter((x) => x.familyId === elder.familyId || x.familyId === branch.familyId);
    assert.equal(famSnaps.length, 2, `${s.date}: the family should hold 2 separating snapshots`);
    const prices = famSnaps.flatMap((x) => x.members.map((mm) => mm.price));
    const span = Math.max(...prices) - Math.min(...prices);
    assert.ok(span > GEO.kSplit * s.unit, `${s.date}: span ${span.toFixed(2)} must exceed kSplit·u = ${(GEO.kSplit * s.unit).toFixed(2)}`);
  }

  // Post-split: the two zones live under their own ids.
  const after = res.sessions.filter((s) => s.date > sp.date);
  assert.ok(after.length >= 5, 'need post-split sessions');
  for (const s of after.slice(0, 5)) {
    const famIds = new Set(s.snapshots.map((x) => x.familyId));
    assert.ok(famIds.has(elder.familyId) && famIds.has(branch.familyId), `${s.date}: both split halves should be matched`);
  }

  assertTruncatedEquivalent(bars, sp.date, opts, 'split');
});

// ── (d) support decay → retirement; reformation is a NEW family ──────────────
test('scenario d — retirement: 20 unsupported sessions retire; reformation at the same price is a NEW family', () => {
  const closes = [
    ...flat(100, 8),
    ...zigzag(100, 1.4, 18),
    ...rampTo(100, 130, 2),
    ...zigzag(130, 1.8, 40),
    ...rampTo(130, 100, 2),
    ...zigzag(100, 1.4, 10),
  ];
  const bars = synthBars(closes, { h: 0.1 });
  const opts = { symbol: 'RET', startDate: START, enabledFamilies: ['structural'] };
  const res = runLevels(bars, opts);

  const retirements = studyEvents(res).filter((e) => e.type === 'retirement');
  assert.ok(retirements.length >= 1, 'expected at least one retirement');

  // The original ~100 trough family (a warmup inheritance) retired…
  const orig = Object.values(res.families)
    .filter((f) => f.preStudy)
    .sort((a, b) => a.anchor - b.anchor)[0];
  assert.equal(orig.status, 'retired', 'original zone family must be retired');
  assert.ok(orig.retiredDate, 'retiredDate must be stamped');
  assert.ok(retirements.some((e) => e.familyId === orig.familyId), 'retirement event missing');

  // …cannot re-arm: no matches after retirement, and its role log is frozen.
  assert.ok(orig.matchHistory.every((h) => h.date <= orig.retiredDate), 'retired family matched after retirement');
  assert.ok(orig.roleLog.every((r) => r.date <= orig.retiredDate), 'role log grew after retirement');
  assert.equal(orig.pendingSide, null, 'pending role state must be cleared at retirement');

  // Reformation at the same price got a NEW familyId (memory decayed — parent §5.4).
  const reformed = Object.values(res.families).find((f) =>
    f.familyId !== orig.familyId &&
    f.bornDate > orig.retiredDate &&
    Math.abs(f.anchor - orig.anchor) / orig.anchor < 0.01);
  assert.ok(reformed, 'no new family formed at the old price after retirement');
  assert.equal(reformed.status, 'live');
  assert.equal(reformed.splitFrom, null, 'reformation is a fresh family, not a branch');
  assert.equal(reformed.preStudy, false, 'reformation is founded in-study');

  assertTruncatedEquivalent(bars, orig.retiredDate, opts, 'retirement');
});

// ── (e) break-and-hold → confirmed role flip; the log is append-only ─────────
test('scenario e — role flip: break-and-hold appends exactly one confirmed flip; no thrash; log never rewrites', () => {
  const closes = [
    ...flat(101, 8),
    ...zigzag(100.5, 2.0, 15),    // support zone (troughs ~100.4) while price holds above
    ...rampTo(100.5, 98.0, 0.5),  // break below
    ...zigzag(97.0, 1.0, 10),     // hold below: three confirming D−1 closes → flip
  ];
  const bars = synthBars(closes, { h: 0.1 });
  const opts = { symbol: 'FLIP', startDate: START, enabledFamilies: ['structural'] };
  const full = runLevels(bars, opts);

  const zone = Object.values(full.families)
    .filter((f) => f.preStudy)
    .sort((a, b) => a.anchor - b.anchor)[0]; // the ~100.4 trough zone
  assert.deepEqual(zone.roleLog.map((r) => r.role), ['support', 'support_turned_resistance'],
    'expected exactly one confirmed break-and-hold flip');
  const flips = studyEvents(full).filter((e) => e.type === 'role_flip' && e.familyId === zone.familyId);
  assert.equal(flips.length, 1);
  assert.ok(flips[0].pendingStartDate < flips[0].date, 'the flip confirms a pending run started earlier');
  assert.equal(zone.pendingRun, 0, 'pending state resets after the flip');

  // Hysteresis boundary: at the session BEFORE the flip, the pending run existed but the
  // role had not flipped (2 confirming closes are not 3).
  const flipDate = flips[0].date;
  const preFlipCut = full.sessions[full.sessions.findIndex((s) => s.date === flipDate) - 1].date;
  const partial = runLevels(bars, { ...opts, endDate: preFlipCut });
  const zonePartial = Object.values(partial.families).find((f) => f.familyId === zone.familyId);
  assert.deepEqual(zonePartial.roleLog.map((r) => r.role), ['support'], 'no flip before the third confirming close');
  assert.equal(zonePartial.pendingSide, 'resistance', 'pending evidence must be accumulating');
  assert.ok(zonePartial.pendingRun >= 1 && zonePartial.pendingRun < 3);

  // Append-only, no rewrites: the log at any earlier cutoff is a byte-exact PREFIX.
  for (const cutIdx of [60, 74]) {
    const cut = runLevels(bars, { ...opts, endDate: bars[cutIdx].date });
    const zoneCut = Object.values(cut.families).find((f) => f.familyId === zone.familyId);
    assert.ok(zoneCut, 'family identity must be stable across cutoffs');
    assert.deepEqual(zoneCut.roleLog, zone.roleLog.slice(0, zoneCut.roleLog.length),
      `role log at cutoff ${cutIdx} is not a prefix of the final log`);
  }

  // The flip did not thrash back while price stayed below.
  assert.ok(full.sessions.filter((s) => s.date > flipDate).length >= 20, 'need sessions after the flip');
  assert.equal(zone.roleLog.length, 2, 'no further flips while price holds below');

  assertTruncatedEquivalent(bars, flipDate, opts, 'role-flip');
});
