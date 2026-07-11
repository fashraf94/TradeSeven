// Regression tests for the code-review fixes (F3, F4). Pure-function, no network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildHourly, crossGrainCheck, adjustmentCheck } from '../lib/normalize.js';

test('F3: a partial-null bar does not poison the hourly bucket high/low', () => {
  const bars = [
    { etMinutes: 570, open: 100, high: 101, low: 100, close: 100.5, volume: 10 },
    { etMinutes: 575, open: 100.5, high: 102, low: null, close: 101, volume: 20 }, // null low
    { etMinutes: 580, open: 101, high: 101.5, low: 99, close: 99.5, volume: 15 },
  ];
  const [b0] = buildHourly(bars);
  assert.equal(b0.high, 102, 'high should be the real max (102)');
  assert.equal(b0.low, 99, 'low should be the real min (99), NOT null-poisoned');
});

test('F3: bucket with only null highs/lows normalizes the ±Infinity sentinels to null', () => {
  const [b0] = buildHourly([{ etMinutes: 570, open: null, high: null, low: null, close: null, volume: null }]);
  assert.equal(b0.high, null);
  assert.equal(b0.low, null);
});

test('F4: crossGrainCheck skips a zero daily close (no divide-by-zero failure)', () => {
  const rows = crossGrainCheck(
    [{ etDate: '2024-01-02', auctionClose: 100 }],
    new Map([['2024-01-02', { date: '2024-01-02', close: 0 }]]),
  );
  assert.equal(rows.length, 0, 'zero denominator should be skipped like null, not reported as a failure');
});

test('F4: adjustmentCheck skips a zero adjusted close', () => {
  const rows = adjustmentCheck(
    [{ etDate: '2024-01-02', auctionCloseAdj: 100 }],
    new Map([['2024-01-02', { date: '2024-01-02', adjustedClose: 0 }]]),
  );
  assert.equal(rows.length, 0);
});
