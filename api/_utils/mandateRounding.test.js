// api/_utils/mandateRounding.test.js
//
// Money reviewer P3 finding 3 (CONFIRMED): the old 1e-9-relative half
// tolerance exceeded 0.5 above $5M scaled, sending EVERY value to the
// half-to-even branch — odd cents unrepresentable at the $10M capital base.
// These pins are mutation guards on the ULP-relative tolerance: if the
// tolerance ever widens again, the large-magnitude block fails first.

import { describe, it, expect } from 'vitest';
import { bankersRound, roundUsd, roundShares } from './mandateRounding.js';

describe('bankersRound — half-to-even with ULP-relative half detection', () => {
  it('classic small-magnitude banker\'s behavior holds', () => {
    expect(bankersRound(2.5, 0)).toBe(2);
    expect(bankersRound(3.5, 0)).toBe(4);
    expect(bankersRound(0.625, 2)).toBe(0.62);  // exact binary half → even
    expect(bankersRound(0.635, 2)).toBe(0.64);  // ≈half (binary noise) → even
    expect(bankersRound(1.005, 2)).toBeCloseTo(1.0, 10); // decimal half-ish → even
    expect(bankersRound(2.675, 2)).toBe(2.68);  // decimal-intent half → even (268)
  });

  it('LARGE MAGNITUDE (the $10M regression): exact odd cents are representable', () => {
    // Old behavior: 10000000.01 → 10000000.02 (floor-parity). One cent per
    // trade minted/destroyed inside the §3.5 conservation tolerance.
    expect(bankersRound(10000000.01, 2)).toBe(10000000.01);
    expect(bankersRound(10000000.03, 2)).toBe(10000000.03);
    expect(bankersRound(9499992.87, 2)).toBe(9499992.87);
    // Non-half fractions round normally (old behavior: swallowed into even).
    expect(bankersRound(1000000.0055, 2)).toBe(1000000.01);
    // Sweep: every exact-cent input in [$5,000,000, $5,000,010) is a fixed point.
    let changed = 0;
    for (let c = 0; c < 1000; c++) {
      const v = 5000000 + c / 100;
      if (Math.abs(bankersRound(v, 2) - v) > 1e-9) changed++;
    }
    expect(changed).toBe(0); // old tolerance mangled 500 of these
  });

  it('true decimal halves at large magnitude still go to even', () => {
    expect(bankersRound(5000000.005, 2)).toBe(5000000.0);   // 500000000.5 → even 500000000
    expect(bankersRound(5000000.015, 2)).toBe(5000000.02);  // 500000001.5 → even 500000002
  });

  it('non-finite → 0; roundUsd/roundShares are null-safe 2dp/6dp banker\'s', () => {
    expect(bankersRound(NaN, 2)).toBe(0);
    expect(bankersRound(Infinity, 2)).toBe(0);
    expect(roundUsd(null)).toBe(0);
    expect(roundUsd(0.625)).toBe(0.62);        // banker's, NOT Math.round's 0.63
    expect(roundUsd(10000000.01)).toBe(10000000.01);
    expect(roundShares(1.0000005)).toBe(1.0);  // 6dp half → even
    expect(roundShares(123.4567891)).toBe(123.456789);
  });
});
