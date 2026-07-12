// Test #10 (S3 required test 3) — Fractal availability (parent §5.3).
// A swing formed at session S is ABSENT from every registry until its k=3 right-side
// confirmation bars have closed, and PRESENT from the next session on, with the exact
// availability triple: formationDate = S, firstKnownDate = S+k, firstTradableDate = S+k+1.
// SYNTHETIC: constructed price series; structural family isolated.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import CONFIG from '../config.js';
import { runLevels, registryAt } from '../02-build-levels.js';
import { synthBars, flat } from './_synthetic.js';

const K = CONFIG.levels.sourceFamilies.structural.fractalK; // 3

test('fractal availability: swing absent until D+k confirmation, present after, exact triple', () => {
  // Perfectly flat series (equal highs/lows → zero fractals under the strict rule)
  // except one spike bar at index 20: the only swing high in the series.
  const SPIKE = 20;
  const closes = [...flat(100, SPIKE), 101, ...flat(100, 14)];
  const bars = synthBars(closes, { h: 0.2 });
  const dates = bars.map((b) => b.date);

  const res = runLevels(bars, { symbol: 'FRAC', startDate: dates[15], enabledFamilies: ['structural'] });

  // Registries strictly before dates[SPIKE+K+1] must not contain the swing (its right
  // side isn't closed through their D−1) — on this series that means ZERO snapshots.
  for (let d = 15; d <= SPIKE + K; d++) {
    const day = registryAt(res, dates[d]);
    assert.ok(day, `no registry for ${dates[d]}`);
    assert.equal(day.snapshots.length, 0,
      `${dates[d]}: swing formed at ${dates[SPIKE]} leaked into a registry before its ${K}-bar confirmation closed`);
  }

  // First present in the registry of dates[SPIKE+K+1] (built on data through SPIKE+K close).
  const firstDay = registryAt(res, dates[SPIKE + K + 1]);
  assert.equal(firstDay.snapshots.length, 1, 'confirmed swing missing from its firstTradable registry');
  const member = firstDay.snapshots[0].members.find((m) => m.method === 'swing_sr_clusters');
  assert.ok(member, 'structural member missing');
  assert.ok(Math.abs(member.price - 101.2) < 1e-9, `cluster price ${member.price} ≠ spike high 101.2`);
  assert.equal(member.formationDate, dates[SPIKE], 'formationDate must be the swing bar itself');
  assert.equal(member.firstKnownDate, dates[SPIKE + K], `firstKnownDate must be formation + ${K} sessions`);
  assert.equal(member.firstTradableDate, dates[SPIKE + K + 1], 'firstTradableDate must be firstKnown + 1 session');

  // And it stays present afterwards.
  const later = registryAt(res, dates[SPIKE + K + 2]);
  assert.equal(later.snapshots.length, 1, 'swing vanished after becoming tradable');
});
