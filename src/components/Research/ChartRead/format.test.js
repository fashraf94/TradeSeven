// src/components/Research/ChartRead/format.test.js
//
// The Chart view's read — THE PRINTED NUMBERS (RD-6): a price to the cent, half up from the record's own decimal,
// never by the double's binary; the ratio to one decimal; volumes short; dates by the session's calendar date.

import { describe, it, expect } from 'vitest';
import { decimalString, formatPrice, formatPriceBare, formatRatio, formatVolume, dayLabel, weekdayShort, weekdayLong, monthDay, etTimeLabel, etDateOf } from './format.js';

// An independent half-up: shift the decimal string by an exponent, round, shift back.
const ref = (v, places) => (Math.round(Number(`${String(v)}e${places}`)) / 10 ** places).toFixed(places);

describe('decimalString / formatPrice', () => {
  it('half up from the shortest decimal (141.105 → 141.11; toFixed says 141.10)', () => {
    expect(formatPrice(141.105)).toBe('$141.11');
    expect(formatPrice(1.005)).toBe('$1.01');
    expect(formatPrice(141.1049)).toBe('$141.10');
    expect(formatPrice(195.62)).toBe('$195.62');
    expect(formatPrice(202)).toBe('$202.00');
    expect(formatPrice(99.995)).toBe('$100.00');
    expect(formatPrice(0.004)).toBe('$0.00');
    expect(formatPriceBare(147.3)).toBe('147.30');
  });
  it('agrees with an independent half-up on 4,000 four-decimal values (the record\'s SMA precision)', () => {
    let seed = 7;
    const rnd = () => { seed = (seed * 1103515245 + 12345) % 2 ** 31; return seed / 2 ** 31; };
    for (let i = 0; i < 4000; i++) {
      const v = Number((rnd() * 900 + 1).toFixed(4));
      expect(decimalString(v, 2), String(v)).toBe(ref(v, 2));
    }
  });
  it('not a number → null (never "$NaN")', () => {
    for (const v of [null, undefined, Number.NaN, Infinity, '141.1']) expect(formatPrice(v)).toBeNull();
  });
});

describe('formatRatio / formatVolume', () => {
  it('a ratio to one decimal, half up', () => {
    expect(formatRatio(2.0999870)).toBe('2.1');
    expect(formatRatio(1.55)).toBe('1.6');
    expect(formatRatio(1.549)).toBe('1.5');
  });
  it('volumes short, three significant figures at most', () => {
    expect(formatVolume(4_123_456)).toBe('4.12M');
    expect(formatVolume(7_950_000)).toBe('7.95M');
    expect(formatVolume(1_000_073.5)).toBe('1M');
    expect(formatVolume(812_000)).toBe('812K');
    expect(formatVolume(45_300)).toBe('45.3K');
    expect(formatVolume(950)).toBe('950');
    expect(formatVolume(2_100_000_000)).toBe('2.1B');
    expect(formatVolume(null)).toBeNull();
  });
});

describe('dates', () => {
  it('a session date by its own calendar date, whatever the zone', () => {
    expect(dayLabel('2026-11-17')).toBe('Tue Nov 17');
    expect(weekdayShort('2026-11-16')).toBe('Mon');
    expect(weekdayLong('2026-11-17')).toBe('Tuesday');
    expect(monthDay('2026-11-06')).toBe('Nov 6');
    expect(dayLabel('2026-13-40')).toBeNull();
    expect(dayLabel(null)).toBeNull();
  });
  it('an instant in ET, either side of the clock change', () => {
    expect(etTimeLabel(Date.parse('2026-11-18T18:44:00Z'))).toBe('Wed 1:44 PM ET');
    expect(etTimeLabel(Date.parse('2026-07-15T13:30:00Z'))).toBe('Wed 9:30 AM ET');
    expect(etTimeLabel(null)).toBeNull();
    expect(etDateOf(Date.parse('2026-11-18T03:00:00Z'))).toBe('2026-11-17');
  });
});
