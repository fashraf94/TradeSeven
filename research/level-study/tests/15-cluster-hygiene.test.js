// Test #15 (S3 required test 8) — Cluster hygiene (parent §5.1).
// (a) Identical-math double-counting REJECTED: daily and weekly pivots constructed to
//     produce numerically identical levels land in one snapshot that still counts ONE
//     family (calendar) → F1, never F2.
// (b) Family counting vs method counting DISTINGUISHED: a structural cluster and the
//     AVWAPs anchored on that same structure align into one snapshot → 3 methods but
//     2 families → F2 (not F3, not per-method).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runLevels } from '../02-build-levels.js';
import { synthBars, zigzag, rampTo, flat } from './_synthetic.js';

test('hygiene a — identical math: daily PP/S/R == weekly PP/S/R counts ONE calendar family (F1)', () => {
  // A perfectly flat series: every D−1 bar equals the prior-week aggregate, so all five
  // daily pivot values are numerically identical to the five weekly pivot values.
  const bars = synthBars(flat(100, 40), { h: 0.4 });
  const res = runLevels(bars, { symbol: 'IDEM', startDate: bars[15].date }); // default families: flat series → calendar only

  assert.ok(res.sessions.length >= 20, 'window too small');
  let sawBothMethods = 0;
  for (const s of res.sessions) {
    assert.ok(s.snapshots.length > 0, `${s.date}: no snapshots`);
    for (const snap of s.snapshots) {
      assert.deepEqual(snap.families, ['calendar'], `${s.date}: identical-math snapshot counted extra families`);
      assert.equal(snap.tier, 'F1', `${s.date}: identical daily+weekly math double-counted into ${snap.tier}`);
      if (snap.methods.includes('daily_pivots') && snap.methods.includes('weekly_pivots')) sawBothMethods++;
    }
  }
  assert.ok(sawBothMethods > 20, 'the constructed case never actually co-located daily and weekly pivots');
});

test('hygiene b — family vs method counting: structural + AVWAPs sharing the swing anchor = F2', () => {
  // Rise to a swing high (idx 31), 5% decline (making it significant + anchoring
  // avwap_high), trough (anchoring avwap_low), then a long tight zigzag whose trough
  // pivot line (~103.8) sits where both AVWAPs settle → one snapshot holding
  // {swing_sr_clusters, avwap_high, avwap_low}: 3 methods, 2 families.
  const closes = [
    ...flat(100, 26),
    ...rampTo(100, 105.4, 0.9),   // 26..31 rise; swing high at 31 (high 105.6)
    ...rampTo(105.4, 99.9, 0.9),  // decline through the 5% threshold (low ≤ 100.32)
    ...rampTo(99.9, 104.3, 0.9),  // recovery (trough swing low behind it)
    ...zigzag(104.0, 0.6, 30),    // tight channel: trough pivots 103.8, peak pivots 104.8
  ];
  const bars = synthBars(closes, { h: 0.2 });
  const res = runLevels(bars, { symbol: 'FAMC', startDate: bars[30].date, enabledFamilies: ['structural', 'participation'] });

  const hits = [];
  for (const s of res.sessions) {
    for (const snap of s.snapshots) {
      if (snap.methods.includes('swing_sr_clusters') && (snap.methods.includes('avwap_high') || snap.methods.includes('avwap_low'))) {
        hits.push({ date: s.date, snap });
      }
    }
  }
  assert.ok(hits.length >= 10, 'structural+participation alignment never happened — construction failed');
  for (const { date, snap } of hits) {
    assert.deepEqual(snap.families, ['participation', 'structural'], `${date}: unexpected family set`);
    assert.equal(snap.tier, 'F2', `${date}: tier must count FAMILIES (2), got ${snap.tier}`);
  }

  // The strong form — tier counts families, NEVER methods: a snapshot carrying ≥3 distinct
  // methods that resolve to exactly 2 families must be F2, not F3. A structural cluster
  // aligned with BOTH calendar methods (daily + weekly pivots) is the reliably-constructed
  // instance under the config unit (the two AVWAPs group together, so the participation
  // scenario above only reaches 2 methods once its cluster co-locates).
  const fcCloses = [...flat(100, 8), ...zigzag(100, 0.6, 40)];
  const fcBars = synthBars(fcCloses, { h: 0.15 });
  const fc = runLevels(fcBars, { symbol: 'FAMC2', startDate: fcBars[30].date, enabledFamilies: ['structural', 'calendar'] });
  let strongForm = null;
  for (const s of fc.sessions) {
    for (const snap of s.snapshots) {
      if (snap.methods.length >= 3 && snap.families.length === 2) { strongForm = { date: s.date, snap }; break; }
    }
    if (strongForm) break;
  }
  assert.ok(strongForm, 'expected a ≥3-method snapshot spanning exactly 2 families (structural + daily + weekly)');
  assert.equal(strongForm.snap.tier, 'F2',
    `${strongForm.date}: ${strongForm.snap.methods.length} methods (${strongForm.snap.methods}) across 2 families must still be F2`);
});
