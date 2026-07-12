// Test #16 (S3.5 §9.2) — EXHAUSTIVE equivalence on one short fixture window.
// The sampled harness (test 09) spot-checks; this one compares EVERY registry date of a
// real committed-fixture subrange: for each emitted session D, the incremental engine
// stopped at D must byte-match the from-scratch truncated rebuild at D — full state:
// sessions, family store, events, checkpoint, internal counters.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDaily } from '../lib/normalize.js';
import { runLevels, runTruncated, canonical } from '../02-build-levels.js';
import { loadFixture } from './_helpers.js';

test('exhaustive equivalence: every registry date of a KO fixture slice (no sampling)', () => {
  const { bars: all } = normalizeDaily(loadFixture('daily/KO_eod_2018-01-01_2026-07-10.json'));
  // A 260-bar committed-fixture subrange: 180 bars of warmup replay + ~80 emitted days.
  const bars = all.slice(1300, 1560);
  const startDate = bars[180].date;
  const opts = { symbol: 'KOX', startDate };

  const timeline = runLevels(bars, opts);
  assert.ok(timeline.sessions.length >= 60, `window too small (${timeline.sessions.length})`);

  let compared = 0;
  for (const s of timeline.sessions) {
    const inc = runLevels(bars, { ...opts, endDate: s.date });
    const tru = runTruncated(bars, s.date, opts);
    assert.equal(canonical(inc), canonical(tru), `divergence at ${s.date} — the truncated rebuild is correct by definition`);
    compared += 1;
  }
  assert.equal(compared, timeline.sessions.length, 'every registry date must be compared');
});
