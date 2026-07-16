// research/level-study/tests/44-packets-sampling.test.js
//
// S7 §8 — MANUAL-VALIDATION SAMPLING (parent §12; S56-A3 three ATR%-vol tertiles). The 100-event sample
// is stratified across LOW_VOL / MID_VOL / HIGH_VOL, deterministic (same 100 every run; a fresh draw
// requires advancing the seed), respects per-stratum availability, and redistributes any shortfall.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stratifiedSample, allocate, seededShuffle, STRATA, SAMPLE_SIZE } from '../lib/packets.js';

function events(n) { return Array.from({ length: n }, (_, i) => ({ eventId: `e${String(i).padStart(4, '0')}`, symbol: `S${i % 12}` })); }
function strata() { const m = {}; for (let i = 0; i < 12; i++) m[`S${i}`] = STRATA[i % 3]; return m; }

test('the sample is stratified across the three ATR%-vol tertiles and sums to 100', () => {
  assert.deepEqual(STRATA, ['LOW_VOL', 'MID_VOL', 'HIGH_VOL']);
  assert.equal(SAMPLE_SIZE, 100);
  const { sample, allocation } = stratifiedSample(events(600), strata(), { total: 100, seed: 7 });
  assert.equal(sample.length, 100);
  assert.equal(allocation.LOW_VOL + allocation.MID_VOL + allocation.HIGH_VOL, 100);
  // roughly even across strata (34/33/33)
  for (const s of STRATA) assert.ok(allocation[s] >= 33 && allocation[s] <= 34, `${s} allocation ~even`);
  // every sampled event carries its stratum
  for (const e of sample) assert.ok(STRATA.includes(e.stratum));
});

test('the draw is deterministic: same seed ⇒ identical 100 events; a fresh seed differs', () => {
  const a = stratifiedSample(events(600), strata(), { total: 100, seed: 7 });
  const b = stratifiedSample(events(600), strata(), { total: 100, seed: 7 });
  assert.equal(JSON.stringify(a.sample), JSON.stringify(b.sample));
  const c = stratifiedSample(events(600), strata(), { total: 100, seed: 8 });
  assert.notEqual(JSON.stringify(a.sample), JSON.stringify(c.sample), 'a fresh seed re-draws');
});

test('allocation caps at availability and redistributes the shortfall deterministically', () => {
  // LOW_VOL has only 5 available; the 28 it cannot supply spill to MID/HIGH in fixed order.
  const alloc = allocate({ LOW_VOL: 5, MID_VOL: 60, HIGH_VOL: 60 }, 100);
  assert.equal(alloc.LOW_VOL, 5, 'capped at availability');
  assert.equal(alloc.LOW_VOL + alloc.MID_VOL + alloc.HIGH_VOL, 100, 'total preserved by redistribution');
  assert.ok(alloc.MID_VOL <= 60 && alloc.HIGH_VOL <= 60, 'never exceeds availability');
});

test('total is capped at eligible availability when the pool is smaller than 100', () => {
  const { sample, allocation } = stratifiedSample(events(30), strata(), { total: 100, seed: 1 });
  assert.equal(sample.length, 30, 'cannot sample more than exist');
  assert.equal(allocation.LOW_VOL + allocation.MID_VOL + allocation.HIGH_VOL, 30);
});

test('seededShuffle is deterministic and a permutation (no drops, no dups)', () => {
  const arr = Array.from({ length: 50 }, (_, i) => i);
  const s1 = seededShuffle(arr, 123), s2 = seededShuffle(arr, 123);
  assert.deepEqual(s1, s2);
  assert.deepEqual([...s1].sort((a, b) => a - b), arr, 'a true permutation');
  assert.notDeepEqual(seededShuffle(arr, 999), s1, 'a different seed permutes differently');
});
