// research/level-study/tests/37-stability-review.test.js
//
// S7 §5 test 3 — THE STABILITY REVIEW. A result FAILS if any single removal flips the sibling-difference
// sign (parent §11.2). Construct a difference driven by ONE top-contributing symbol so that removing it
// reverses the sign; assert FAIL. A difference that survives every single removal PASSES. And in
// buildContrast, a significant-but-fragile result is the provisional DEAD verdict (S7-C1).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stabilityReview } from '../lib/stats.js';
import { buildContrast } from '../lib/aggregate.js';

// Cell A: 'DOM' contributes 20 wins (y=1); five small symbols contribute 20 losses (y=0) ⇒ rate 0.5.
// Cell B: a flat 0.30 rate. Full diff = +0.20 (A>B). Remove DOM from A ⇒ A rate 0 ⇒ diff = −0.30 (flip).
function flipCells() {
  const A = [], B = [];
  const dates = (i) => `2024-0${(i % 6) + 1}-${String((i % 20) + 1).padStart(2, '0')}`;
  for (let i = 0; i < 20; i++) A.push({ date: dates(i), symbol: 'DOM', sector: 'X0', y: 1 });
  for (let i = 0; i < 20; i++) A.push({ date: dates(i + 3), symbol: `S${i % 5}`, sector: `X${i % 2}`, y: 0 });
  for (let i = 0; i < 40; i++) B.push({ date: dates(i), symbol: `T${i % 6}`, sector: `X${i % 2}`, y: i % 10 < 3 ? 1 : 0 });
  return { A, B };
}

test('a sibling difference driven by one top-contributor FAILS the stability review (sign flip)', () => {
  const { A, B } = flipCells();
  const rev = stabilityReview(A, B);
  assert.equal(rev.pass, false, 'removing the dominant symbol flips the sign ⇒ FAIL');
  assert.ok(rev.flips.some((f) => f.type === 'symbol' && f.key === 'DOM'), 'the flip is attributed to DOM (leave-one-symbol-out)');
});

test('a broadly-supported difference survives every single removal ⇒ PASS', () => {
  // A ~0.8 across many symbols/dates; B ~0.2. No single removal can flip a wide, diffuse gap.
  const A = [], B = [];
  for (let i = 0; i < 60; i++) {
    A.push({ date: `2024-0${(i % 6) + 1}-${String((i % 20) + 1).padStart(2, '0')}`, symbol: `S${i % 8}`, sector: `X${i % 4}`, y: i % 5 === 0 ? 0 : 1 });
    B.push({ date: `2024-0${(i % 6) + 1}-${String((i % 20) + 1).padStart(2, '0')}`, symbol: `T${i % 8}`, sector: `X${i % 4}`, y: i % 5 === 0 ? 1 : 0 });
  }
  const rev = stabilityReview(A, B);
  assert.equal(rev.pass, true, 'a diffuse difference is stable under all single removals');
  assert.equal(rev.flips.length, 0);
});

test('buildContrast: a significant-but-fragile contrast is provisional DEAD (S7-C1), not CONFIRMED', () => {
  const { A, B } = flipCells();
  const toRec = (c, side) => c.map((r, i) => ({
    eventId: `${side}${i}`, eventDate: r.date, symbol: r.symbol, sector: r.sector, side: 'support',
    __y: r.y,
  }));
  const contrast = buildContrast({
    aRecords: toRec(A, 'a'), bRecords: toRec(B, 'b'), endpointFn: (r) => r.__y,
    labelA: 'A', labelB: 'B', confirmationTime: false, minDiffPoints: 15,
  });
  // Both cells clear the floor (n=40 each, ud≥15), so a difference is computed and stability is run.
  assert.equal(contrast.stability.pass, false, 'stability fails on the fragile contrast');
  // If the difference is significant (|diff| ≥ 15pts and CI excludes zero), the verdict is DEAD; if the
  // clustered CI happens to include zero it is UNCONFIRMED. It must NEVER be CONFIRMED-pending-holdout.
  assert.notEqual(contrast.verdict, 'CONFIRMED-pending-holdout', 'a stability-fragile result never graduates');
  assert.ok(['DEAD', 'UNCONFIRMED'].includes(contrast.verdict));
});
