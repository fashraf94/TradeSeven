// research/level-study/tests/40-incremental-lift.test.js
//
// S7 §5 test 6 — INCREMENTAL LIFT IS A DIRECTIONAL FLAG, NEVER A DISPLAYED RATE (parent §11.3 guard).
// The pre-registered logistic model's only reported output is whether the focal predictor retained
// significance after controls — a yes/no + a direction word. No coefficient, no probability, no rate
// ever leaks out (that guard is the whole point of §11.3). The output object's keys are exactly the
// flag fields, and none of them is a numeric rate.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { incrementalLift } from '../lib/stats.js';
import { liftFor, aggregateInSample } from '../lib/aggregate.js';
import { recs } from './_synthetic-aggregate.js';

const ALLOWED = new Set(['retainedSignificance', 'direction', 'note']);

test('incrementalLift returns ONLY a flag object — no rate, no coefficient, no probability', () => {
  // Enough rows, two focal levels, a real (if weak) association.
  const rows = [];
  for (let i = 0; i < 120; i++) {
    rows.push({
      y: (i % 3 === 0) ? 1 : 0,
      focal: i % 2 ? 'A' : 'B',
      controls: { tod: 'midday', vol: 0.5, spy: 'up', symbol: `S${i % 6}` },
      date: `2024-0${(i % 6) + 1}-${String((i % 20) + 1).padStart(2, '0')}`,
    });
  }
  const flag = incrementalLift(rows, 'hourly_class');
  for (const k of Object.keys(flag)) assert.ok(ALLOWED.has(k), `lift output field '${k}' is not part of the flag contract`);
  assert.ok(typeof flag.retainedSignificance === 'boolean' || flag.retainedSignificance === null, 'a boolean flag or null — never a number');
  assert.ok(flag.direction === null || typeof flag.direction === 'string');
  assert.equal(typeof flag.note, 'string');
  // No key or value smuggles a percentage/rate.
  for (const v of Object.values(flag)) assert.ok(typeof v !== 'number', 'no numeric rate/coefficient may appear');
});

test('an underpowered / single-level focal degrades to a null flag, never a fabricated yes', () => {
  const few = incrementalLift([{ y: 1, focal: 'A', controls: {}, date: '2024-01-01' }], 'x');
  assert.equal(few.retainedSignificance, null);
  const oneLevel = [];
  for (let i = 0; i < 60; i++) oneLevel.push({ y: i % 2, focal: 'ONLY', controls: {}, date: `2024-01-${String((i % 20) + 1).padStart(2, '0')}` });
  assert.equal(incrementalLift(oneLevel, 'x').retainedSignificance, null);
});

test('every question surfaces its lift as a flag on the comparative view (never a rate)', () => {
  const agg = aggregateInSample(recs(200, {}));
  for (const q of ['P1', 'P3', 'P4', 'P5', 'P6']) {
    const lift = agg[q].perSide.support.incrementalLift;
    assert.ok(lift && ('retainedSignificance' in lift), `${q} carries a lift flag`);
    for (const k of Object.keys(lift)) assert.ok(ALLOWED.has(k), `${q} lift field '${k}' violates the flag contract`);
  }
});
