// research/level-study/tests/35-aggregate-floors.test.js
//
// S7 §5 test 1 — THE TWO FLOORS, BOTH BOUNDARIES (S5-A2). A cell at n=29 OR uniqueDates=14 prints
// `UNCONFIRMED — insufficient` and NO rate; a cell at n=30 AND uniqueDates=15 prints a rate. Floors are
// n ≥ 30 (parent §15.1) AND uniqueDates ≥ 15 (S5-A2) — a cell must clear BOTH.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeCell, MIN_N, MIN_UD } from '../lib/aggregate.js';

// n records over `ud` distinct dates: the first `ud` get distinct dates, the rest wrap onto them.
function records(n, ud) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = `2024-01-${String((i % ud) + 1).padStart(2, '0')}`;
    out.push({ eventId: `e${i}`, eventDate: d, symbol: `S${i % 5}`, sector: `X${i % 2}` });
  }
  return out;
}
const allOnes = (r) => 1; // a non-null endpoint for every row (the rate value is irrelevant to the floor)

test('floors: n=30 AND uniqueDates=15 clears both floors and PRINTS a rate', () => {
  assert.equal(MIN_N, 30);
  assert.equal(MIN_UD, 15);
  const c = describeCell(records(30, 15), allOnes, 'ok');
  assert.equal(c.n, 30);
  assert.equal(c.uniqueDates, 15);
  assert.equal(c.floorOk, true);
  assert.equal(c.insufficient, null);
  assert.equal(c.ratePct, 100, 'a floor-clearing cell shows its 2dp rate');
  assert.ok(c.rateCI && c.rateCI.loPct != null, 'and a clustered CI');
});

test('floors: n=29 (uniqueDates=15) FAILS the n floor — no rate, insufficient marker', () => {
  const c = describeCell(records(29, 15), allOnes, 'lowN');
  assert.equal(c.n, 29);
  assert.equal(c.uniqueDates, 15);
  assert.equal(c.floorOk, false);
  assert.equal(c.ratePct, null, 'no rate below the n floor');
  assert.equal(c.rateCI, null);
  assert.match(c.insufficient, /UNCONFIRMED — insufficient \(n=29, ud=15\)/);
});

test('floors: n=30 but uniqueDates=14 FAILS the unique-dates floor — no rate, insufficient marker', () => {
  const c = describeCell(records(30, 14), allOnes, 'lowUD');
  assert.equal(c.n, 30);
  assert.equal(c.uniqueDates, 14);
  assert.equal(c.floorOk, false);
  assert.equal(c.ratePct, null, 'no rate below the unique-dates floor (S5-A2)');
  assert.match(c.insufficient, /UNCONFIRMED — insufficient \(n=30, ud=14\)/);
});

test('floors: n=30 AND uniqueDates=15 is the exact passing boundary (both at the minimum)', () => {
  const pass = describeCell(records(30, 15), allOnes, 'boundary');
  assert.equal(pass.floorOk, true);
  // One event fewer OR one date fewer must fail.
  assert.equal(describeCell(records(29, 15), allOnes, 'a').floorOk, false);
  assert.equal(describeCell(records(30, 14), allOnes, 'b').floorOk, false);
});
