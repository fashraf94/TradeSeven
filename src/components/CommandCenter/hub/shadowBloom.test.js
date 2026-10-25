// src/components/CommandCenter/hub/shadowBloom.test.js
//
// Command Center hub, slice S7 — when Shadow answers with the response bloom
// (hub/shadowBloom.js; spec V1.2 §10, ruling R-S7-3): a new area selection, and
// an attempt's created terminal once per attempt id. Nothing else moves it.

import { describe, expect, it } from 'vitest';
import { seedBloom, stepBloom } from './shadowBloom';

describe('seedBloom — what Shadow knew at mount is the past', () => {
  it('starts at key 0 and remembers an attempt that was already created', () => {
    expect(seedBloom({ areaEvent: 3, createdAttemptId: 'a-1' })).toEqual({ areaEvent: 3, seen: 'a-1', key: 0 });
    expect(seedBloom({})).toEqual({ areaEvent: 0, seen: null, key: 0 });
  });

  it('stepping the seed with the same inputs is no response: a remount over an unacknowledged created terminal does not bloom again', () => {
    const memo = seedBloom({ areaEvent: 2, createdAttemptId: 'a-1' });
    expect(stepBloom(memo, { areaEvent: 2, createdAttemptId: 'a-1' })).toBe(memo);
  });
});

describe('stepBloom — the two triggers', () => {
  it('a new area selection (the counter moved) is one response', () => {
    const memo = seedBloom({ areaEvent: 0 });
    const next = stepBloom(memo, { areaEvent: 1 });
    expect(next.key).toBe(1);
    expect(next.areaEvent).toBe(1);
    expect(stepBloom(next, { areaEvent: 1 })).toBe(next);
    expect(stepBloom(next, { areaEvent: 2 }).key).toBe(2);
  });

  it('a created terminal blooms once per attempt id, however long it stays on screen', () => {
    let memo = seedBloom({});
    memo = stepBloom(memo, { createdAttemptId: 'a-1' });
    expect(memo.key).toBe(1);
    for (let i = 0; i < 5; i += 1) expect(stepBloom(memo, { createdAttemptId: 'a-1' })).toBe(memo);
    // Acknowledged (no created terminal), then the same attempt reads created again: still the same attempt, still once.
    const cleared = stepBloom(memo, { createdAttemptId: null });
    expect(cleared).toBe(memo);
    expect(stepBloom(cleared, { createdAttemptId: 'a-1' })).toBe(cleared);
  });

  it('the next attempt blooms again', () => {
    let memo = stepBloom(seedBloom({}), { createdAttemptId: 'a-1' });
    memo = stepBloom(memo, { createdAttemptId: 'a-2' });
    expect(memo.key).toBe(2);
    expect(memo.seen).toBe('a-2');
  });

  it('no created terminal (null, an empty id, a non-string) is never a trigger: an existing, refused or uncertain terminal is none', () => {
    const memo = seedBloom({ areaEvent: 4 });
    for (const createdAttemptId of [null, undefined, '', 0, 7, {}, false]) {
      expect(stepBloom(memo, { areaEvent: 4, createdAttemptId }), String(createdAttemptId)).toBe(memo);
    }
  });

  it('both triggers in one step are one response, and both are remembered', () => {
    const memo = stepBloom(seedBloom({ areaEvent: 0 }), { areaEvent: 1, createdAttemptId: 'a-1' });
    expect(memo).toEqual({ areaEvent: 1, seen: 'a-1', key: 1 });
  });

  it('a selection does not forget the attempt it has seen', () => {
    let memo = stepBloom(seedBloom({}), { createdAttemptId: 'a-1' });
    memo = stepBloom(memo, { areaEvent: 1, createdAttemptId: null });
    expect(memo.seen).toBe('a-1');
    expect(stepBloom(memo, { areaEvent: 1, createdAttemptId: 'a-1' })).toBe(memo);
  });
});
