// Test #9 (S3 required test 2) — The equivalence harness (parent §5.2; S3 prompt §3.1).
// The incremental day-by-day forward computation is PERMITTED only because this test
// exists: for sampled (symbol, day) pairs, a from-scratch truncated rebuild must produce
// a registry IDENTICAL to the incremental result — full state: every registry session up
// to D, the entire family store, lineage events, and internal counters. If these ever
// disagree, the truncated rebuild is the definition of correct.
// FIXTURE-BASED: no fetched data required.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDaily } from '../lib/normalize.js';
import { runLevels, runTruncated, canonical } from '../02-build-levels.js';
import { loadFixture } from './_helpers.js';
import { sampleDistinct } from './_synthetic.js';

const CASES = [
  { sym: 'AAPL', end: '2024-03-28' },
  { sym: 'TSLA', end: '2024-03-28' },
];
const DAYS_PER_SYMBOL = 3;

for (const { sym, end } of CASES) {
  test(`equivalence: ${sym} incremental ≡ truncated rebuild on sampled days (full state)`, () => {
    const { bars } = normalizeDaily(loadFixture(`daily/${sym}_eod_2018-01-01_2026-07-10.json`));
    const timeline = runLevels(bars, { symbol: sym, endDate: end });
    const sampledDays = sampleDistinct(timeline.sessions.map((s) => s.date), DAYS_PER_SYMBOL, 0xE9 + sym.length);

    for (const D of sampledDays) {
      // Incremental result at D: the forward engine over the FULL array, stopped at D.
      // (Identical prefix computation to the production run — the full future is in
      // memory, so any accidental lookahead would surface here.)
      const inc = runLevels(bars, { symbol: sym, endDate: D });
      // From-scratch truncated rebuild: bars physically sliced to date < D.
      const tru = runTruncated(bars, D, { symbol: sym });
      assert.equal(canonical(inc), canonical(tru),
        `${sym} @ ${D}: incremental and truncated rebuild disagree — truncated is correct by definition; the incremental engine is leaking future data`);
    }
  });
}
