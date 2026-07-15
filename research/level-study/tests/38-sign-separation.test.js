// research/level-study/tests/38-sign-separation.test.js
//
// S7 §5 test 4 — SUPPORT AND RESISTANCE STAY SEPARATE (parent §10.2). Sides NEVER pool by default; a
// pooled view is permitted ONLY when both sides independently show SAME-DIRECTION effects with
// OVERLAPPING clustered CIs — and even then the pooled view still footnotes both sides. This pins the
// pooling decision (poolingPermitted) and confirms the per-question output is always per-side, never
// pre-pooled.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { poolingPermitted, aggregateInSample, SIDES } from '../lib/aggregate.js';
import { recs } from './_synthetic-aggregate.js';

const contrast = (diffPoints, loPct, hiPct) => ({ diffPoints, diffCI: { loPct, hiPct } });

test('opposite-direction effects ⇒ pooling FORBIDDEN', () => {
  const p = poolingPermitted(contrast(20, 5, 35), contrast(-18, -30, -4));
  assert.equal(p.permitted, false);
  assert.equal(p.sameDirection, false);
  assert.match(p.reason, /different directions/);
});

test('same-direction with OVERLAPPING CIs ⇒ pooling PERMITTED, but still footnotes both sides', () => {
  const p = poolingPermitted(contrast(20, 5, 35), contrast(25, 10, 40));
  assert.equal(p.permitted, true);
  assert.equal(p.sameDirection, true);
  assert.equal(p.overlap, true);
  assert.ok(p.footnote && p.footnote.support === 20 && p.footnote.resistance === 25, 'both sides footnoted separately');
});

test('same-direction but NON-overlapping CIs ⇒ pooling FORBIDDEN', () => {
  const p = poolingPermitted(contrast(10, 2, 8), contrast(40, 30, 50));
  assert.equal(p.permitted, false);
  assert.equal(p.overlap, false);
  assert.match(p.reason, /do not overlap/);
});

test('a side below floor (no CI) ⇒ pooling FORBIDDEN', () => {
  const p = poolingPermitted(contrast(20, 5, 35), { diffPoints: null, diffCI: null });
  assert.equal(p.permitted, false);
});

test('the aggregation output is always per-side and never carries a pre-pooled cell', () => {
  const agg = aggregateInSample(recs(120, {}));
  for (const q of ['P1', 'P3', 'P4', 'P5', 'P6', 'P2']) {
    assert.ok(agg[q].perSide.support && agg[q].perSide.resistance, `${q} renders both sides`);
    assert.ok(!('pooled' in agg[q]) && !('both' in agg[q]), `${q} carries no pre-pooled cohort`);
  }
});
