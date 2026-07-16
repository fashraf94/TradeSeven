// research/level-study/tests/36-stats-bootstrap.test.js
//
// S7 §5 test 2 — THE DATE-CLUSTERED BOOTSTRAP. Events on the same date resample TOGETHER (parent §11.1:
// five names rejecting support during one reversal ≈ one economic observation). On identical data,
// clustering by date must produce MATERIALLY WIDER CIs than the naive per-event resample — because a
// resample either takes a whole correlated date-block or none of it. Also determinism (fixed seed).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clusteredBootstrap, siblingDiffCI, mulberry32 } from '../lib/stats.js';

// 40 observations on 4 dates (10 per date); each date's block is perfectly correlated (all 1 or all 0).
// Two dates all-ones, two dates all-zeros ⇒ true rate 0.5, but the correlation lives entirely in dates.
function correlatedByDate() {
  const obs = [];
  const dates = ['2024-01-01', '2024-01-02', '2024-01-03', '2024-01-04'];
  dates.forEach((date, di) => {
    for (let k = 0; k < 10; k++) obs.push({ id: `${date}_${k}`, date, y: di < 2 ? 1 : 0 });
  });
  return obs;
}
const meanY = (s) => s.reduce((a, o) => a + o.y, 0) / s.length;

test('clustering by date widens the CI vs the naive per-observation resample (same data)', () => {
  const obs = correlatedByDate();
  // Naive: each observation is its own cluster (clusterKeyFn = unique id).
  const naive = clusteredBootstrap(obs, meanY, { clusterKeyFn: (o) => o.id });
  // Clustered: the date is the cluster (production default).
  const clustered = clusteredBootstrap(obs, meanY, { clusterKeyFn: (o) => o.date });

  assert.ok(Math.abs(naive.point - 0.5) < 1e-9 && Math.abs(clustered.point - 0.5) < 1e-9, 'both point at 0.5');
  assert.equal(clustered.nClusters, 4, 'four date clusters');
  assert.equal(naive.nClusters, 40, 'forty per-observation clusters');
  assert.ok(
    clustered.width > naive.width * 2,
    `date clustering must materially widen the CI (naive ${naive.width.toFixed(3)} vs clustered ${clustered.width.toFixed(3)})`,
  );
});

test('the bootstrap is deterministic: same data ⇒ byte-identical CI, twice', () => {
  const obs = correlatedByDate();
  const a = clusteredBootstrap(obs, meanY);
  const b = clusteredBootstrap(obs, meanY);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  // And the seeded PRNG itself is reproducible.
  const r1 = mulberry32(42), r2 = mulberry32(42);
  assert.equal(r1(), r2());
  assert.equal(r1(), r2());
});

test('the sibling difference resamples BOTH cells by the same dates (shared-date clustering)', () => {
  // Cell A ones on dates 1–2; Cell B zeros on dates 1–2. Every date carries both siblings ⇒ a resample
  // moves both together; the difference CI reflects the 2-date clustering, not the 20-event naive n.
  const A = [], B = [];
  for (const d of ['2024-02-01', '2024-02-02']) for (let k = 0; k < 10; k++) {
    A.push({ date: d, symbol: 'S', sector: 'X', y: 1 });
    B.push({ date: d, symbol: 'S', sector: 'X', y: 0 });
  }
  const sib = siblingDiffCI(A, B);
  assert.ok(Math.abs(sib.point - 1) < 1e-9, 'point difference is +1 (A all ones, B all zeros)');
  assert.equal(sib.nClusters, 2, 'only two date clusters despite 40 events');
});
