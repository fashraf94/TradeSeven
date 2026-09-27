// api/_utils/filmTape/bars.test.js
//
// The session cut (target date → the existing clamp → the closing-row
// policy), the last-completed-minute price (BA-11), the 10-minute series
// (BA-12). Fixture rows are EODHD-shaped and read from files; no network.

import { describe, it, expect } from 'vitest';
import { sessionBars, priceAt, sessionOpenOf, aggregate10m, pctChange, barStartMs, BAR_MS } from './bars.js';
import { sessionFor } from './tapeTime.js';
import { edgeRows, sessionRows, stepRows } from './__fixtures__/tapeBars.js';

const D = '2026-09-24';
const S = sessionFor(D);
const utc = (hhmmss) => Date.parse(`${D}T${hhmmss}.000Z`);

describe('the regular session — date, then the existing clamp, then the closing-row policy', () => {
  it('drops pre-market, the 16:00 closing-auction row, after-hours and the next day\'s rows', () => {
    const bars = sessionBars(edgeRows(), D, S);
    expect(bars.map((b) => new Date(b.t).toISOString().slice(11, 16))).toEqual(['13:30', '13:31', '13:46', '13:47', '19:59']);
    // the 16:00 row (233.4, the auction print) is not the day's last regular bar
    expect(bars.at(-1).c).toBe(232.9);
  });

  it('a full session is 390 one-minute bars, 09:30 through 15:59 ET', () => {
    const bars = sessionBars(sessionRows(D, () => 100), D, S);
    expect(bars).toHaveLength(390);
    expect(bars[0].t).toBe(S.openMs);
    expect(bars.at(-1).t).toBe(S.closeMs - BAR_MS);
  });

  it('a window that holds only a later session yields nothing for the target date', () => {
    expect(sessionBars(sessionRows('2026-09-25', () => 1), D, S)).toEqual([]);
  });

  it('an early-close session ends at 13:00 ET', () => {
    const early = sessionFor('2026-11-27');
    expect(early.isEarlyClose).toBe(true);
    const rows = sessionRows('2026-11-27', () => 50, { openUtc: '14:30' }); // EST: 09:30 ET = 14:30Z
    const bars = sessionBars(rows, '2026-11-27', early);
    expect(bars).toHaveLength(210);
    expect(bars.at(-1).t).toBe(early.closeMs - BAR_MS);
  });

  it('parses both EODHD datetime forms as UTC', () => {
    expect(barStartMs('2026-09-24 13:30:00')).toBe(utc('13:30:00'));
    expect(barStartMs('2026-09-24T13:30:00.000Z')).toBe(utc('13:30:00'));
    expect(barStartMs('bad')).toBeNull();
  });
});

describe('price at an instant = the close of the last minute COMPLETED at or before it (BA-11)', () => {
  const bars = sessionBars(stepRows(D, 10, 20, '14:07', { extras: false }), D, S);

  it('a check at 10:07:30 ET reads the 10:06 bar (completed 10:07:00), never the 10:07 bar that contains it', () => {
    // 10:07:30 EDT = 14:07:30Z. The 14:07 bar is the first at 20 and completes at 14:08:00.
    const p = priceAt(bars, utc('14:07:30'));
    expect(p).toEqual({ price: 10, barClosedAt: utc('14:07:00') });
  });

  it('exactly at a minute boundary the bar that just completed is used', () => {
    expect(priceAt(bars, utc('14:08:00'))).toEqual({ price: 20, barClosedAt: utc('14:08:00') });
    expect(priceAt(bars, utc('14:07:59'))).toEqual({ price: 10, barClosedAt: utc('14:07:00') });
  });

  it('before the first bar completes there is no price — never the prior session, never a guess', () => {
    expect(priceAt(bars, utc('13:30:40'))).toBeNull();
    expect(priceAt(bars, utc('13:31:00'))).toEqual({ price: 10, barClosedAt: utc('13:31:00') });
  });

  it('the day\'s close is the same rule at the session close: the 15:59 bar', () => {
    const edge = sessionBars(edgeRows(), D, S);
    expect(priceAt(edge, S.closeMs)).toEqual({ price: 232.9, barClosedAt: S.closeMs });
  });
});

describe('the 10-minute series (BA-12)', () => {
  it('39 bars for a full session, anchored on the open; o/h/l/c/v/n from the minutes inside', () => {
    const bars = sessionBars(sessionRows(D, (i) => 100 + i, { volume: 10, extras: false }), D, S);
    const ten = aggregate10m(bars, S);
    expect(ten).toHaveLength(39);
    expect(ten[0]).toMatchObject({ t: '2026-09-24T13:30:00.000Z', o: 100, c: 109, n: 10, v: 100 });
    expect(ten[0].h).toBeCloseTo(109.01, 6);
    expect(ten[0].l).toBeCloseTo(99.99, 6);
    expect(ten.at(-1)).toMatchObject({ t: '2026-09-24T19:50:00.000Z', c: 489, n: 10 });
  });

  it('a thin window aggregates what exists and says how many minutes it holds', () => {
    const ten = aggregate10m(sessionBars(edgeRows(), D, S), S);
    expect(ten.map((b) => [b.t.slice(11, 16), b.n])).toEqual([['13:30', 2], ['13:40', 2], ['19:50', 1]]);
  });

  it('the session open is the 09:30 bar\'s open, or null when that bar is missing', () => {
    expect(sessionOpenOf(sessionBars(edgeRows(), D, S), S)).toEqual({ value: 230, at: '2026-09-24T13:30:00.000Z' });
    expect(sessionOpenOf(sessionBars(edgeRows().filter((r) => r.datetime !== '2026-09-24 13:30:00'), D, S), S)).toBeNull();
  });

  it('pctChange is null when either end is missing', () => {
    expect(pctChange(100, 101.5)).toBe(1.5);
    expect(pctChange(null, 1)).toBeNull();
    expect(pctChange(0, 1)).toBeNull();
  });
});
