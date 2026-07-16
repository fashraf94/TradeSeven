// research/level-study/tests/41-aggregate-determinism.test.js
//
// S7 §5 test 7 — DETERMINISM, and the THROW-ON-DEFAULTED-INPUT guard (L-S56-2). Two identical
// aggregation runs are byte-identical (the seeded bootstrap makes CIs reproducible). And the layer
// refuses to silently read a defaulted/forbidden input: aggregateInSample throws on a record missing
// its clustering unit (eventDate) or with an invalid side; and the runner's date guard throws rather
// than let a post-holdout event reach the in-sample aggregation.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateInSample, assertAggregable } from '../lib/aggregate.js';
import { assertNoHoldoutLeak, assertEventDates } from '../06-aggregate.js';
import { recs, rec } from './_synthetic-aggregate.js';

test('two identical aggregateInSample runs are byte-identical (seeded bootstrap ⇒ reproducible CIs)', () => {
  const data = recs(180, {});
  const a = aggregateInSample(data);
  const b = aggregateInSample(data.map((r) => ({ ...r }))); // fresh copies, same values
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test('L-S56-2: a record missing its eventDate (the clustering unit) THROWS — never defaulted', () => {
  const bad = rec(); delete bad.eventDate;
  assert.throws(() => assertAggregable([bad]), /eventDate/, 'the date is the economic observation unit; a missing one is a hard error');
  assert.throws(() => aggregateInSample([bad]), /eventDate/);
});

test('L-S56-2: a record with an invalid side THROWS — S/R separation is mandatory', () => {
  assert.throws(() => assertAggregable([rec({ side: 'both' })]), /side/);
  assert.throws(() => assertAggregable([rec({ side: null })]), /side/);
});

test('L-S56-2: a defaulted eventDate THROWS before the holdout filter can silently drop it', () => {
  // null < "2025-12-10" is false, so a broken-date record would vanish from the in-sample filter
  // instead of aborting. The pre-filter guard makes it a hard error (reachable, not silently lost).
  const bad = rec({ eventId: 'BROKEN' }); delete bad.eventDate;
  assert.throws(() => assertEventDates([rec({ eventDate: '2024-06-01' }), bad]), /eventDate/);
  assert.equal(assertEventDates([rec({ eventDate: '2024-06-01' })]), true, 'clean records pass');
});

test('the in-sample date guard THROWS on a post-holdout event — the holdout is never silently read', () => {
  const clean = [rec({ eventDate: '2024-06-01' }), rec({ eventDate: '2025-01-15' })];
  assert.equal(assertNoHoldoutLeak(clean), true, 'purely in-sample events pass');
  const leaked = [...clean, rec({ eventId: 'LEAK', eventDate: '2025-12-10' })]; // == holdout boundary
  assert.throws(() => assertNoHoldoutLeak(leaked), /HOLDOUT LEAK/, 'an on/after-boundary event is a hard abort (parent §11.4)');
  const after = [rec({ eventId: 'AFTER', eventDate: '2026-03-01' })];
  assert.throws(() => assertNoHoldoutLeak(after), /HOLDOUT LEAK/);
});
