// api/_utils/econPrintVerifier.test.js
// The R2 acceptance battery (Recap Restoration spec V1.1 §5) + the R-B1a
// plausibility-gate rows. R2's contract: assert VERIFIED status, not
// "parses"; variants — number-typed · string-typed · estimate:null
// (degrade to NOT_VERIFIABLE(missing_operand), never reject wholesale) ·
// scaled representation ('187K' vs 187000 → still VERIFIED via unit
// normalization).

import { describe, it, expect } from 'vitest';
import {
  parseEconOperand,
  operandsEquivalent,
  verifyEconPrint,
  assessEconPlausibility,
  assessEpsPlausibility,
  assessEpsCrossSource,
  isImplausibleDelta,
  PLAUSIBILITY_BANDS,
  EPS_CROSS_SOURCE_REL_TOLERANCE,
} from './econPrintVerifier.js';

// ── R2 fixture ───────────────────────────────────────────────────────────
// PROVENANCE: CAPTURED — econ-capture-20260730.json (EODHD /economic-events,
// country=US, window 2026-07-23 → 2026-07-30, captured 2026-07-30T20:06:35Z
// by the founder via api/scripts/capture-econ-events-eodhd.js; the full
// artifact is committed at api/_utils/__fixtures__/econCapture20260730.json,
// governed by docs/ECON_CAPTURE_FINDINGS_AND_MATCHER_RULINGS_JUL30_2026.md).
// Feed facts of record (memo §0): every observed actual/estimate is
// NUMERIC — never a string (the Sonar-era string/K-M-B world does not exist
// on this path; do not reintroduce string assumptions from the defensive
// parser variants further down); estimates are absent on ~57% of rows, so
// the NOT_VERIFIABLE(missing_operand) degrade is ROUTINE, not an edge case;
// timestamps are timezone-naive UTC; count categories arrive in THOUSANDS.
const CAPTURED_EODHD_ECON_ROWS = [
  // The FOMC row — review M5 closed: a plain numeric rate, not a range string.
  { type: 'Fed Interest Rate Decision', comparison: null, period: null, country: 'US', date: '2026-07-29 18:00:00', actual: 3.75, previous: 3.75, estimate: 3.75, change: null, change_percentage: null },
  { type: 'Initial Jobless Claims', comparison: null, period: 'Jul/18', country: 'US', date: '2026-07-23 12:30:00', actual: 187, previous: 209, estimate: 212, change: -22, change_percentage: -10.526 },
  { type: 'CB Consumer Confidence', comparison: null, period: 'Jul', country: 'US', date: '2026-07-28 14:00:00', actual: 90.8, previous: 92.2, estimate: 92.4, change: -1.4, change_percentage: -1.518 },
  // Estimate-null row: the routine consensus gap (R2's degrade variant).
  { type: 'Baker Hughes Oil Rig Count', comparison: null, period: 'Jul/24', country: 'US', date: '2026-07-24 17:00:00', actual: 450, previous: 452, estimate: null, change: -2, change_percentage: -0.442 },
];

describe('parseEconOperand — strict parse with %, K/M/B, comma strip', () => {
  it('passes finite numbers through', () => {
    expect(parseEconOperand(187)).toEqual({ ok: true, value: 187 });
    expect(parseEconOperand(-0.4)).toEqual({ ok: true, value: -0.4 });
  });
  it('normalizes scale suffixes', () => {
    expect(parseEconOperand('187K').value).toBe(187000);
    expect(parseEconOperand('1.5M').value).toBe(1500000);
    expect(parseEconOperand('2B').value).toBe(2000000000);
  });
  it('treats % as unit annotation, not scale', () => {
    expect(parseEconOperand('3.2%').value).toBe(3.2);
    expect(parseEconOperand('-0.4%').value).toBe(-0.4);
  });
  it('strips digit-grouping commas', () => {
    expect(parseEconOperand('1,234').value).toBe(1234);
    expect(parseEconOperand('7,700,000').value).toBe(7700000);
  });
  it('classifies aggregator no-value markers as missing (degrade path)', () => {
    for (const marker of [null, undefined, '', '-', 'N/A', 'n/a', 'TBD']) {
      expect(parseEconOperand(marker)).toEqual({ ok: false, reason: 'missing_operand' });
    }
  });
  it('classifies genuine garbage as unparseable (hold path)', () => {
    for (const garbage of ['abc', '1.2.3', '187KK', {}, true, NaN]) {
      expect(parseEconOperand(garbage)).toEqual({ ok: false, reason: 'unparseable_operand' });
    }
  });
  it('review H2: digitless comma strings never fabricate a 0.0 print', () => {
    for (const commaJunk of [',', ',,,', '-,', '+,']) {
      expect(parseEconOperand(commaJunk)).toEqual({ ok: false, reason: 'unparseable_operand' });
    }
  });
  it('review L3: a scale suffix and % may not combine', () => {
    expect(parseEconOperand('3.2K%')).toEqual({ ok: false, reason: 'unparseable_operand' });
  });
});

describe('R2 battery — verifyEconPrint over the CAPTURED fixture', () => {
  it('number-typed operands → VERIFIED (captured claims row: 187 vs 212, feed thousands)', () => {
    const row = CAPTURED_EODHD_ECON_ROWS[1];
    const v = verifyEconPrint({ actual: row.actual, estimate: row.estimate });
    expect(v.status).toBe('VERIFIED');
    expect(v.actualValue).toBe(187);
    expect(v.estimateValue).toBe(212);
    expect(v.surprise).toBeCloseTo(-25);
  });
  it('the captured FOMC row → VERIFIED, surprise 0 (M5 closed: numeric 3.75, not a range string)', () => {
    const row = CAPTURED_EODHD_ECON_ROWS[0];
    const v = verifyEconPrint({ actual: row.actual, estimate: row.estimate });
    expect(v.status).toBe('VERIFIED');
    expect(v.actualValue).toBe(3.75);
    expect(v.surprise).toBe(0);
  });
  it('string-typed operands → VERIFIED (DEFENSIVE variant — the captured feed is numeric-only per provenance)', () => {
    const v = verifyEconPrint({ actual: '0.3%', estimate: '0.2%' });
    expect(v.status).toBe('VERIFIED');
    expect(v.actualValue).toBeCloseTo(0.3);
    expect(v.estimateValue).toBeCloseTo(0.2);
  });
  it('estimate:null → NOT_VERIFIABLE(missing_operand), actual retained — the ROUTINE consensus gap (~57% of captured rows)', () => {
    const row = CAPTURED_EODHD_ECON_ROWS[3];
    const v = verifyEconPrint({ actual: row.actual, estimate: row.estimate });
    expect(v.status).toBe('NOT_VERIFIABLE');
    expect(v.reason).toBe('missing_operand');
    expect(v.actualValue).toBe(450);
  });
  it("scaled representation — '187K' rendered vs 187000 stored → still VERIFIED via unit normalization (DEFENSIVE)", () => {
    expect(operandsEquivalent('187K', 187000)).toBe(true);
    expect(operandsEquivalent('3.2%', 3.2)).toBe(true);
    expect(operandsEquivalent('1,234', 1234)).toBe(true);
  });
  it('distinct prints stay distinct under the tolerance (no false VERIFIED)', () => {
    expect(operandsEquivalent('50.9', '51.2')).toBe(false);
    expect(operandsEquivalent(187000, 190000)).toBe(false);
    expect(operandsEquivalent(2.5, 3.0)).toBe(false);
  });
  it('unparseable operand → NOT_VERIFIABLE(unparseable_operand)', () => {
    expect(verifyEconPrint({ actual: 'garbage', estimate: 2.5 }))
      .toMatchObject({ status: 'NOT_VERIFIABLE', reason: 'unparseable_operand' });
    expect(verifyEconPrint({ actual: 3.0, estimate: '1.2.3' }))
      .toMatchObject({ status: 'NOT_VERIFIABLE', reason: 'unparseable_operand' });
  });
});

describe('R-B1a plausibility gate — loose two-arm bands', () => {
  it('every live macroCalendar category carries a band (JOLTS dropped per the capture rulings §2)', () => {
    for (const category of ['FOMC', 'CPI', 'PPI', 'PCE', 'Retail Sales', 'GDP', 'Productivity',
      'NFP', 'ISM Manufacturing', 'ISM Services', 'Consumer Confidence', 'Jobless Claims']) {
      expect(PLAUSIBILITY_BANDS[category], category).toBeGreaterThan(0);
    }
    expect(PLAUSIBILITY_BANDS.JOLTS).toBeUndefined();
  });
  it('normal surprises pass', () => {
    expect(assessEconPlausibility('GDP', { actual: 3.0, estimate: 2.5 })).toEqual({ hold: false });
    expect(assessEconPlausibility('CPI', { actual: '0.3%', estimate: '0.2%' })).toEqual({ hold: false });
  });
  it('feed-unit prints pass: the captured claims (187 vs 212) and NFP (57 vs 110) rows', () => {
    expect(assessEconPlausibility('Jobless Claims', { actual: 187, estimate: 212 })).toEqual({ hold: false });
    expect(assessEconPlausibility('NFP', { actual: 57, estimate: 110 })).toEqual({ hold: false });
  });
  it('review M1 (recalibrated to the captured feed units — thousands): recession-class legitimate surprises are NOT held', () => {
    // Claims spike 510K vs 225K expected; NFP −300K vs +150K — the most
    // newsworthy prints, which must publish. Feed speaks thousands.
    expect(assessEconPlausibility('Jobless Claims', { actual: 510, estimate: 225 })).toEqual({ hold: false });
    expect(assessEconPlausibility('NFP', { actual: -300, estimate: 150 })).toEqual({ hold: false });
  });
  it('a raw-unit row in a thousands feed (operand-pair unit disagreement) is held', () => {
    // 187000 raw claims against a 212-thousands estimate: the mis-mapping
    // class the bands exist for.
    expect(assessEconPlausibility('Jobless Claims', { actual: 187000, estimate: 212 }).hold).toBe(true);
  });
  it('unit mis-mapping (100× spread) is held', () => {
    const verdict = assessEconPlausibility('CPI', { actual: 250, estimate: 2.5 });
    expect(verdict.hold).toBe(true);
    expect(verdict.reason).toBe('band_exceeded');
  });
  it('series mis-mapping (claims value in a CPI row) is held', () => {
    expect(assessEconPlausibility('CPI', { actual: 218000, estimate: 0.2 }).hold).toBe(true);
  });
  it('unparseable operand is held loudly', () => {
    const verdict = assessEconPlausibility('GDP', { actual: 'abc', estimate: 2.5 });
    expect(verdict).toMatchObject({ hold: true, reason: 'unparseable_operand' });
  });
  it('missing actual is held (not a released print); missing estimate is NOT held (degrade)', () => {
    expect(assessEconPlausibility('GDP', { actual: null, estimate: 2.5 }).hold).toBe(true);
    expect(assessEconPlausibility('GDP', { actual: 3.0, estimate: null })).toEqual({ hold: false });
  });
  it('isImplausibleDelta: both arms must be exceeded', () => {
    expect(isImplausibleDelta(3.0, 2.5, 5.0)).toBe(false);      // within absolute
    expect(isImplausibleDelta(187000, 190000, 500)).toBe(false); // within relative
    expect(isImplausibleDelta(250, 2.5, 2.0)).toBe(true);        // exceeds both
  });
});

describe('R-B1a earnings surprise gate', () => {
  it('normal beats/misses pass', () => {
    expect(assessEpsPlausibility(3.1, 2.9)).toEqual({ hold: false });
    expect(assessEpsPlausibility(-0.5, -0.2)).toEqual({ hold: false });
  });
  it('mega-EPS names pass via the relative arm (BRK.A class)', () => {
    expect(assessEpsPlausibility(12000, 11500)).toEqual({ hold: false });
  });
  it('review M2: GAAP mega-beats against operating estimates pass (band 20)', () => {
    expect(assessEpsPlausibility(8.0, 1.5)).toEqual({ hold: false });
  });
  it('cents-for-dollars mis-scaling is held', () => {
    expect(assessEpsPlausibility(310, 3.1).hold).toBe(true);
  });
  it('missing estimate is not held (existing beat/miss logic governs)', () => {
    expect(assessEpsPlausibility(3.1, null)).toEqual({ hold: false });
    expect(assessEpsPlausibility(3.1, undefined)).toEqual({ hold: false });
  });
  it('unparseable actual is held', () => {
    expect(assessEpsPlausibility('garbage', 3.1).hold).toBe(true);
  });
});

// ── Cross-source EPS integrity — the NVDA operand-truth gate ────────────────
// The defect the plausibility band CANNOT see: NVDA printed a calendar actual
// of 0.99 vs a correct 2.09 estimate (a clean, self-consistent −52.6% "miss")
// while the true actual (~2.22) was a beat. |0.99−2.09|=1.10 clears the $20
// band, and the STRICT adapter recomputes −52.6% from the same operand → both
// score it correct. Only an INDEPENDENT feed disagreeing catches it.
describe('assessEpsCrossSource — primary operand-truth gate', () => {
  const SAME_Q = { calendarReportDate: '2026-07-30', fundamentalsResolved: true, fundamentalsReportDate: '2026-07-30' };

  it('HOLDS the NVDA case: calendar 0.99 vs fundamentals 2.22 (same quarter)', () => {
    const v = assessEpsCrossSource({ ...SAME_Q, calendarActual: 0.99, fundamentalsActual: 2.22 });
    expect(v.hold).toBe(true);
    expect(v.reason).toBe('cross_source_disagreement');
    expect(v.relDiff).toBeCloseTo(0.5541, 3); // |0.99−2.22| / 2.22
    expect(v.ratio).toBeCloseTo(0.4459, 3);    // 0.99 / 2.22
    expect(v.calendarActual).toBe(0.99);
    expect(v.fundamentalsActual).toBe(2.22);
  });

  it('does NOT hold when the two feeds agree within tolerance (rounding / GAAP noise)', () => {
    expect(assessEpsCrossSource({ ...SAME_Q, calendarActual: 2.22, fundamentalsActual: 2.22 }).hold).toBe(false);
    expect(assessEpsCrossSource({ ...SAME_Q, calendarActual: 1.57, fundamentalsActual: 1.60 }).hold).toBe(false); // ~1.9%
  });

  it('boundary: relDiff just past the tolerance holds; just inside does not', () => {
    // ref=1.00 → a=0.60 gives relDiff 0.40 > 0.35 (hold); a=0.70 gives 0.30 < 0.35 (pass).
    expect(assessEpsCrossSource({ ...SAME_Q, calendarActual: 0.60, fundamentalsActual: 1.00 }).hold).toBe(true);
    expect(assessEpsCrossSource({ ...SAME_Q, calendarActual: 0.70, fundamentalsActual: 1.00 }).hold).toBe(false);
    // exactly at the tolerance (0.35) does not hold — the comparison is strict >.
    expect(assessEpsCrossSource({ ...SAME_Q, calendarActual: 0.65, fundamentalsActual: 1.00 }).hold).toBe(false);
    expect(EPS_CROSS_SOURCE_REL_TOLERANCE).toBe(0.35);
  });

  it('sign disagreement (a loss vs a profit) is a hold', () => {
    const v = assessEpsCrossSource({ ...SAME_Q, calendarActual: -0.50, fundamentalsActual: 2.00 });
    expect(v.hold).toBe(true);
    expect(v.relDiff).toBeCloseTo(1.25, 3);
  });

  it('FAIL-OPEN when fundamentals is unresolved (a silent second feed never holds a real story)', () => {
    const v = assessEpsCrossSource({ calendarActual: 0.99, calendarReportDate: '2026-07-30', fundamentalsResolved: false });
    expect(v.hold).toBe(false);
    expect(v.reason).toBe('fundamentals_unresolved');
  });

  it('FAIL-OPEN when the fundamentals actual is absent/unparseable (resolved but no epsActual)', () => {
    const v = assessEpsCrossSource({ ...SAME_Q, calendarActual: 0.99, fundamentalsActual: undefined });
    expect(v.hold).toBe(false);
    expect(v.reason).toBe('operand_unparseable');
  });

  it('FAIL-OPEN on a quarter mismatch (matcher fell back to a different report — split confound removed)', () => {
    const v = assessEpsCrossSource({
      calendarActual: 0.99, calendarReportDate: '2026-07-30',
      fundamentalsResolved: true, fundamentalsActual: 2.22, fundamentalsReportDate: '2026-04-30',
    });
    expect(v.hold).toBe(false);
    expect(v.reason).toBe('quarter_mismatch');
    expect(v.dayGap).toBeGreaterThan(7);
  });

  it('FAIL-OPEN near break-even: both operands below the magnitude floor (ratio meaningless)', () => {
    const v = assessEpsCrossSource({ ...SAME_Q, calendarActual: 0.01, fundamentalsActual: 0.05 });
    expect(v.hold).toBe(false);
    expect(v.reason).toBe('below_magnitude_floor');
  });
});
