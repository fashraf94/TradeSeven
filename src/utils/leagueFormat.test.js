// src/utils/leagueFormat.test.js
import { describe, it, expect } from 'vitest';
import { fmtPoints, fmtScore } from './leagueFormat';

describe('fmtPoints — signed integer badge points, no percent', () => {
  it('signs positives and keeps the minus on negatives', () => {
    expect(fmtPoints(15)).toBe('+15');
    expect(fmtPoints(-10)).toBe('-10');
  });
  it('renders zero unsigned and never appends a percent', () => {
    expect(fmtPoints(0)).toBe('0');
    expect(fmtPoints(15)).not.toContain('%');
  });
  it('collapses negative zero to "0"', () => {
    expect(fmtPoints(-0.4)).toBe('0'); // Math.round(-0.4) === -0
  });
  it('rounds fractional input to an integer', () => {
    expect(fmtPoints(14.6)).toBe('+15');
    expect(fmtPoints(-9.6)).toBe('-10');
  });
  it('non-finite → "0"', () => {
    expect(fmtPoints(NaN)).toBe('0');
    expect(fmtPoints(Infinity)).toBe('0');
    expect(fmtPoints(undefined)).toBe('0');
  });
});

describe('fmtScore — signed one-decimal composite/climb, no percent', () => {
  it('keeps one decimal (47.2 must NOT become 47) and signs it', () => {
    expect(fmtScore(47.2)).toBe('+47.2');
    expect(fmtScore(-1.2)).toBe('-1.2');
  });
  it('never appends a percent', () => {
    expect(fmtScore(47.2)).not.toContain('%');
    expect(fmtScore(-1.2)).not.toContain('%');
  });
  it('renders zero as "0.0" unsigned, including tiny values that round to zero', () => {
    expect(fmtScore(0)).toBe('0.0');
    expect(fmtScore(-0.04)).toBe('0.0'); // never "-0.0"
    expect(fmtScore(0.04)).toBe('0.0');
  });
  it('rounds to one decimal', () => {
    expect(fmtScore(47.25)).toBe('+47.3'); // half-up
    expect(fmtScore(8.74)).toBe('+8.7');
  });
  it('non-finite → "0.0"', () => {
    expect(fmtScore(NaN)).toBe('0.0');
    expect(fmtScore(-Infinity)).toBe('0.0');
    expect(fmtScore(null)).toBe('0.0');
  });
});
