// src/components/CommandCenter/hub/hubDate.s4.test.js
//
// Command Center hub, slice S4 — the two formatters Activity and the brief add (hub/activityDates.js, apart from hub/hubDate.js, which the main bundle carries): Activity's absolute ET time, and
// the brief's market date, which is formatted from the string's own parts and never moved by a time zone.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { formatHubDayTime, formatHubMarketDate } from './activityDates';
import { formatHubTimeOnDay } from './hubDate';

describe('formatHubDayTime — Activity\'s absolute time, read in ET', () => {
  it('writes the month, the day and the clock in Eastern time', () => {
    // 20:00 UTC on Oct 3 is 4:00 PM EDT.
    expect(formatHubDayTime(Date.UTC(2026, 9, 3, 20, 0))).toMatch(/^Oct 3, 4:00\s?PM$/);
    // ...and across the evening boundary the ET day, not the UTC one: 02:30 UTC on Oct 4 is 10:30 PM on Oct 3.
    expect(formatHubDayTime(Date.UTC(2026, 9, 4, 2, 30))).toMatch(/^Oct 3, 10:30\s?PM$/);
  });

  it('is empty for anything but a finite number', () => {
    for (const bad of [null, undefined, NaN, Infinity, '2026-10-03', {}, []]) expect(formatHubDayTime(bad), String(bad)).toBe('');
  });
});

describe('formatHubMarketDate — the brief\'s forDate, a market-day label', () => {
  it('writes the weekday, the month and the day of the date it was given', () => {
    expect(formatHubMarketDate('2026-10-07')).toBe('Wed Oct 7');
    expect(formatHubMarketDate('2026-10-23')).toBe('Fri Oct 23');
    expect(formatHubMarketDate('2026-01-01')).toBe('Thu Jan 1');
  });

  // The day is the string's own: a formatter that read it as UTC midnight and wrote it in ET would say Oct 6.
  it('never moves a bare date through a time zone: the evening-before answer is a defect', () => {
    expect(formatHubMarketDate('2026-10-07')).not.toMatch(/Oct 6$/);
    expect(formatHubMarketDate('2026-01-01')).toBe('Thu Jan 1');
    expect(formatHubMarketDate('2026-03-08')).toBe('Sun Mar 8');
    expect(formatHubMarketDate('2026-11-01')).toBe('Sun Nov 1');
  });

  it('is empty for anything that is not a real calendar date written YYYY-MM-DD', () => {
    for (const bad of ['', null, undefined, 20261007, '2026-10-7', '2026-13-01', '2026-02-30', '2026-00-10', 'Oct 7', '2026-10-07T00:00:00Z', ' 2026-10-07', '0050-01-01', '0099-12-31']) {
      expect(formatHubMarketDate(bad), String(bad)).toBe('');
    }
  });

  it('knows leap day', () => {
    expect(formatHubMarketDate('2028-02-29')).toBe('Tue Feb 29');
    expect(formatHubMarketDate('2027-02-29')).toBe('');
  });
});

describe('S4\'s helpers stay out of the main bundle (merge round: the deploy provider imports hub/hubDate.js)', () => {
  const src = (name) => readFileSync(fileURLToPath(new URL(`./${name}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');

  it('hub/hubDate.js — which App\'s root reaches — names none of them and imports nothing from the module that holds them', () => {
    const main = src('hubDate.js');
    expect(main).not.toMatch(/formatHubDayTime|formatHubDayYear|formatHubMarketDate|activityDates/);
    expect(src('activityDates.js')).toMatch(/export function formatHubDayTime/);
    expect(src('activityDates.js')).toMatch(/export function formatHubMarketDate/);
  });

  it('and builds no Intl formatter of S4\'s at module load: each is made on first use', () => {
    const code = src('activityDates.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const topLevel = code.split('\n').filter((line) => /^const \w+ = new Intl\./.test(line));
    expect(topLevel).toEqual([]);
    expect((code.match(/new Intl\.DateTimeFormat/g) || []).length).toBe(5);
  });
});

// The S8 fix build's rows for ruling R-S8F-9, re-pointed at main's one helper when #999 (BaggerBomb cleanup C5) brought the same
// rule: hub/hubDate.js formatHubTimeOnDay. Its outputs and S8's own helper's were compared over 283,178 pairs: no difference.
describe("formatHubTimeOnDay — a live game's end on another ET day (ruling R-S8F-9; one helper since the #999 merge)", () => {
  // Tue Oct 27, 2026, 11:00 AM ET.
  const NOW9 = Date.UTC(2026, 9, 27, 15, 0);
  it('another ET calendar day: its short weekday before the time; the same day: the time alone', () => {
    expect(formatHubTimeOnDay(Date.UTC(2026, 9, 28, 20, 0), NOW9)).toMatch(/^Wed 4:00\sPM$/);
    expect(formatHubTimeOnDay(Date.UTC(2026, 9, 27, 20, 0), NOW9)).toMatch(/^4:00\sPM$/);
    expect(formatHubTimeOnDay(Date.UTC(2026, 9, 28, 3, 59), NOW9)).toMatch(/^11:59\sPM$/);
    expect(formatHubTimeOnDay(Date.UTC(2026, 9, 28, 4, 0), NOW9)).toMatch(/^Wed 12:00\sAM$/);
    // A year back is another day too: the weekday, as before.
    expect(formatHubTimeOnDay(Date.UTC(2025, 9, 27, 15, 0), NOW9)).toMatch(/^Mon 11:00\sAM$/);
  });

  it('no time: nothing; no clock: the time alone', () => {
    expect(formatHubTimeOnDay(null, NOW9)).toBe('');
    expect(formatHubTimeOnDay(NOW9, null)).toMatch(/^11:00\sAM$/);
    expect(formatHubTimeOnDay(Number.NaN, NOW9)).toBe('');
  });
});
