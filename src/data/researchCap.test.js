// src/data/researchCap.test.js
//
// Phase C §4 / V1.1 ruling 2 (D-122) — the cap's ONE definition. Sol C-2: the
// spec said the door's integer came "from the same count" without saying which
// integer, and 0 persisted cards cannot literally print `1 of 3`.

import { describe, it, expect } from 'vitest';
import {
  RESEARCH_CAP,
  RESEARCH_EXHAUSTED_STATUS,
  countResearchUsed,
  researchDoorOrdinal,
  researchDoorEnabled,
  researchRemaining,
} from './researchCap';
import { RESEARCH_MESSAGE_TYPE, DIRECTIVE_FILED_MESSAGE_TYPE } from './decisionRecord';

describe('the count', () => {
  it('counts research exchanges and NOTHING else', () => {
    const exchanges = [
      { messageType: 'user_initiated', userMessage: 'hi' },
      { messageType: RESEARCH_MESSAGE_TYPE, symbol: 'MPC' },
      { messageType: DIRECTIVE_FILED_MESSAGE_TYPE },
      { messageType: 'anticipation' },
      { messageType: RESEARCH_MESSAGE_TYPE, symbol: 'NVDA' },
      { isAutoDebrief: true },
    ];
    expect(countResearchUsed(exchanges)).toBe(2);
  });

  it('is 0 for an absent, empty or malformed array', () => {
    expect(countResearchUsed(null)).toBe(0);
    expect(countResearchUsed(undefined)).toBe(0);
    expect(countResearchUsed([])).toBe(0);
    expect(countResearchUsed('research')).toBe(0);
    expect(countResearchUsed([null, 'research', 7, { messageType: 'research ' }])).toBe(0);
  });
});

describe('the door — the ordinal of the NEXT card (Sol C-2)', () => {
  it('prints 1 of 3 before the first tap, when the persisted count is ZERO', () => {
    expect(countResearchUsed([])).toBe(0);
    expect(researchDoorOrdinal(0)).toBe(1);
    expect(researchDoorEnabled(0)).toBe(true);
  });

  it('walks 1 → 2 → 3 and CLAMPS at the cap', () => {
    expect([0, 1, 2, 3, 4, 99].map(researchDoorOrdinal)).toEqual([1, 2, 3, 3, 3, 3]);
  });

  it('the last enabled door and the exhausted door share their INTEGER and differ only in `enabled`', () => {
    // Two used: one read left. Three used: none. Spec §4 writes both as `3 of 3`.
    expect(researchDoorOrdinal(2)).toBe(researchDoorOrdinal(3));
    expect(researchDoorEnabled(2)).toBe(true);
    expect(researchDoorEnabled(3)).toBe(false);
  });

  it('treats a nonsense count as zero uses rather than a negative or fractional door', () => {
    for (const junk of [null, undefined, NaN, -5, '2', {}, Infinity]) {
      expect(researchDoorOrdinal(junk)).toBeGreaterThanOrEqual(1);
      expect(researchDoorOrdinal(junk)).toBeLessThanOrEqual(RESEARCH_CAP);
      expect(Number.isInteger(researchDoorOrdinal(junk))).toBe(true);
    }
    expect(researchDoorOrdinal(-5)).toBe(1);
    expect(researchDoorOrdinal(2.7)).toBe(3);
  });
});

describe('what is left', () => {
  it('never goes below zero, whatever the doc holds', () => {
    expect([0, 1, 2, 3, 4].map(researchRemaining)).toEqual([3, 2, 1, 0, 0]);
  });
});

describe('the constants', () => {
  it('three per battle, and one status word for a fourth tap', () => {
    expect(RESEARCH_CAP).toBe(3);
    expect(RESEARCH_EXHAUSTED_STATUS).toBe('research_exhausted');
    expect(RESEARCH_MESSAGE_TYPE).toBe('research');
  });
});
