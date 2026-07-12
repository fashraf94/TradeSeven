// Test #11 (S3 required test 4) — AVWAP significance availability (parent §5.3).
// An anchor swing that is fractal-CONFIRMED early but whose move reaches the 5%
// significance threshold only at session D+m is UNAVAILABLE before D+m — the 5% test is
// evaluated ONLY on data available through the evaluation date, never on the move's
// eventual extent. SYNTHETIC: constructed price series; participation family isolated.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runLevels, registryAt } from '../02-build-levels.js';
import { synthBars, flat } from './_synthetic.js';

test('avwap availability: confirmed-but-not-yet-5% anchor unavailable until the crossing session', () => {
  // Swing high at index 20 (close 102, h=0.3 → high 102.3). Significance threshold:
  // decline to low ≤ 102.3 × 0.95 = 97.185, i.e. close ≤ 97.485 — first reached by the
  // c=97.4 bar at index 30 (low 97.1). Confirmation closes at index 23; the crossing at 30.
  const closes = [
    ...flat(100, 20),                    // 0..19
    102,                                 // 20: the anchor swing
    100, 100, 100,                       // 21..23: k=3 confirmation (fractal known at 23)
    99.3, 98.9, 98.5, 98.1, 97.9, 97.7,  // 24..29: monotone decline, still above threshold
    97.4,                                // 30: low 97.1 ≤ 97.185 — ≥5% move first observable
    97.3, 97.2, 97.1,                    // 31..33: tail (monotone → no new fractal lows confirmed)
  ];
  const bars = synthBars(closes, { h: 0.3 });
  const dates = bars.map((b) => b.date);

  const res = runLevels(bars, { symbol: 'AVW', startDate: dates[15], enabledFamilies: ['participation'] });

  // Fractal-confirmed from index 23's close — but NOT significant until index 30's bar:
  // registries for dates[24..30] (built through D−1 = 23..29) must contain no avwap.
  for (let d = 16; d <= 30; d++) {
    const day = registryAt(res, dates[d]);
    assert.equal(day.snapshots.length, 0,
      `${dates[d]}: avwap_high appeared before its ≥5% move was observable (confirmed ≠ significant)`);
  }

  // First present in the registry of dates[31] (built through index 30 close).
  const firstDay = registryAt(res, dates[31]);
  assert.equal(firstDay.snapshots.length, 1, 'avwap_high missing once its move became observable');
  const member = firstDay.snapshots[0].members.find((m) => m.method === 'avwap_high');
  assert.ok(member, 'avwap_high member missing');
  assert.equal(member.anchorDate, dates[20], 'anchor must be the swing bar');
  assert.equal(member.formationDate, dates[20]);
  assert.equal(member.firstKnownDate, dates[30], 'firstKnown must be the 5%-crossing session, not the confirmation session');
  assert.equal(member.firstTradableDate, dates[31], 'firstTradable must be firstKnown + 1 session');
});
