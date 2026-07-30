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
  isImplausibleDelta,
  PLAUSIBILITY_BANDS,
} from './econPrintVerifier.js';

// ── R2 fixture ───────────────────────────────────────────────────────────
// PROVENANCE: SYNTHETIC (shape-accurate placeholder). The R2 row requires
// this fixture be built from a CAPTURED real EODHD /economic-events
// response with a provenance comment (spec V1.1 §5 R2; ruling R-B1). The
// capture is a FOUNDER deliverable: run
//   node api/scripts/capture-econ-events-eodhd.js
// and replace ROWS below with rows from the captured payload, updating this
// comment to carry the capture's endpoint/params/capturedAt. Until then the
// battery runs on this synthetic sample and the provenance requirement is
// explicitly OPEN (named in the build report + PR checklist).
const SYNTHETIC_EODHD_ECON_ROWS = [
  { type: 'GDP Growth Rate QoQ Adv', comparison: 'qoq', country: 'US', date: '2026-07-30 12:30:00', actual: 3.0, previous: 2.4, estimate: 2.5 },
  { type: 'Inflation Rate MoM', comparison: 'mom', country: 'US', date: '2026-07-14 12:30:00', actual: '0.3%', previous: '0.2%', estimate: '0.2%' },
  { type: 'Non Farm Payrolls', comparison: null, country: 'US', date: '2026-07-06 12:30:00', actual: '187K', previous: '150K', estimate: '190K' },
  { type: 'Initial Jobless Claims', comparison: null, country: 'US', date: '2026-07-30 12:30:00', actual: 218000, previous: 224000, estimate: null },
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

describe('R2 battery — verifyEconPrint over the fixture', () => {
  it('number-typed operands → VERIFIED (GDP row)', () => {
    const row = SYNTHETIC_EODHD_ECON_ROWS[0];
    const v = verifyEconPrint({ actual: row.actual, estimate: row.estimate });
    expect(v.status).toBe('VERIFIED');
    expect(v.actualValue).toBe(3.0);
    expect(v.estimateValue).toBe(2.5);
    expect(v.surprise).toBeCloseTo(0.5);
  });
  it('string-typed operands → VERIFIED (CPI row)', () => {
    const row = SYNTHETIC_EODHD_ECON_ROWS[1];
    const v = verifyEconPrint({ actual: row.actual, estimate: row.estimate });
    expect(v.status).toBe('VERIFIED');
    expect(v.actualValue).toBeCloseTo(0.3);
    expect(v.estimateValue).toBeCloseTo(0.2);
  });
  it('estimate:null → NOT_VERIFIABLE(missing_operand), actual retained — never rejected wholesale', () => {
    const row = SYNTHETIC_EODHD_ECON_ROWS[3];
    const v = verifyEconPrint({ actual: row.actual, estimate: row.estimate });
    expect(v.status).toBe('NOT_VERIFIABLE');
    expect(v.reason).toBe('missing_operand');
    expect(v.actualValue).toBe(218000);
  });
  it("scaled representation — '187K' rendered vs 187000 stored → still VERIFIED via unit normalization", () => {
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
  it('every macroCalendar category carries a band', () => {
    for (const category of ['FOMC', 'CPI', 'PPI', 'PCE', 'Retail Sales', 'GDP', 'Productivity',
      'NFP', 'JOLTS', 'ISM Manufacturing', 'ISM Services', 'Consumer Confidence', 'Jobless Claims']) {
      expect(PLAUSIBILITY_BANDS[category], category).toBeGreaterThan(0);
    }
  });
  it('normal surprises pass', () => {
    expect(assessEconPlausibility('GDP', { actual: 3.0, estimate: 2.5 })).toEqual({ hold: false });
    expect(assessEconPlausibility('CPI', { actual: '0.3%', estimate: '0.2%' })).toEqual({ hold: false });
  });
  it('shared-unit surprises pass even in unexpected units (relative arm)', () => {
    // NFP as raw jobs instead of thousands: both operands share the unit.
    expect(assessEconPlausibility('NFP', { actual: 187000, estimate: 190000 })).toEqual({ hold: false });
  });
  it('review M1: recession-class legitimate surprises are NOT held (bands in raw units)', () => {
    // Claims spike 510K vs 225K expected; NFP −300K vs +150K expected —
    // exactly the most newsworthy prints, which must publish.
    expect(assessEconPlausibility('Jobless Claims', { actual: '510K', estimate: '225K' })).toEqual({ hold: false });
    expect(assessEconPlausibility('NFP', { actual: -300000, estimate: 150000 })).toEqual({ hold: false });
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
