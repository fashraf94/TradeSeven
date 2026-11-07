// api/_utils/evidence/earnings.test.js
//
// Huddle S1 — the evidence fetcher's earnings parsing, run against the COMMITTED
// capture (Amendment C V1.2 §C11: "A unit test runs the evidence fetcher's earnings
// parsing against the capture fixture"). Only keys the capture shows are read; the
// event's day is report_date, never date; a missing BMO/AMC label is untimed; a null
// estimate stays null.

import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { CAPTURED_TRACKED_ROWS, NONTRACKED_SHAPE_FILLERS, TRACKED_UNRELEASED_FILLER } from '../__fixtures__/earningsCalendarCapture.js';
import { parseEarningsRow, parseEarningsRows, usSymbolOfCode } from './earnings.js';
import { earningsEventOf } from '../huddle/events.js';

const SOURCE = readFileSync(new URL('./earnings.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('earnings parsing against the committed capture (C §C11)', () => {
  it('the captured tracked rows parse: report_date is the announcement day, date the period, AfterMarket is amc', () => {
    expect(parseEarningsRows(CAPTURED_TRACKED_ROWS)).toEqual([
      { symbol: 'AAPL', period: '2026-06-30', reportDate: '2026-07-30', timing: 'amc', currency: 'USD', epsActual: 1.57, epsEstimate: 1.88 },
      { symbol: 'AMZN', period: '2026-06-30', reportDate: '2026-07-30', timing: 'amc', currency: 'USD', epsActual: 1.68, epsEstimate: 1.83 },
    ]);
  });

  it('the event id and day come from report_date, never from date (the fiscal period end)', () => {
    const rec = parseEarningsRow(CAPTURED_TRACKED_ROWS[0]);
    expect(earningsEventOf(rec).eventId).toBe('earn:AAPL:2026-07-30:amc');
    expect(earningsEventOf(rec).eventId).not.toContain('2026-06-30');
  });

  it('a non-US code is no US symbol; a US non-tracked code parses (the universe filter is the validator\'s)', () => {
    const parsed = parseEarningsRows(NONTRACKED_SHAPE_FILLERS);
    expect(parsed.map((r) => r.symbol)).toEqual(['CAPMF']);
    expect(parseEarningsRow(NONTRACKED_SHAPE_FILLERS[1])).toBeNull(); // CAP.PA, BeforeMarket
    expect(usSymbolOfCode('BRK-B.US')).toBe('BRK.B');
  });

  it('an unreleased row keeps actual null; a null estimate is null, never 0', () => {
    expect(parseEarningsRow(TRACKED_UNRELEASED_FILLER)).toMatchObject({ epsActual: null, epsEstimate: 3.55, timing: 'amc' });
    expect(parseEarningsRow({ ...TRACKED_UNRELEASED_FILLER, estimate: null }).epsEstimate).toBeNull();
  });

  it('a row with no BMO/AMC label is untimed (timing null), and so has no event id', () => {
    for (const label of [undefined, null, '', 'DuringMarket', 'unknown']) {
      const rec = parseEarningsRow({ ...CAPTURED_TRACKED_ROWS[0], before_after_market: label });
      expect(rec.timing, String(label)).toBeNull();
      expect(earningsEventOf(rec).eventId).toBeNull();
    }
    expect(parseEarningsRow({ ...CAPTURED_TRACKED_ROWS[0], before_after_market: 'BeforeMarket' }).timing).toBe('bmo');
  });

  it('reads no phantom key (C §C11): none of the names the payload does not carry appear in the code', () => {
    for (const phantom of ['actual_eps', 'eps_estimate', 'actual_revenue', 'revenue_estimate', 'report_time', 'market_cap']) {
      expect(CODE, phantom).not.toContain(phantom);
    }
    // ...and it reads only capture keys: every `row.<key>` it names is one of the nine
    const read = [...new Set([...CODE.matchAll(/\brow\.(\w+)/g)].map((m) => m[1]))].sort();
    expect(read).toEqual(['actual', 'before_after_market', 'code', 'currency', 'date', 'estimate', 'report_date']);
    // mutation lens O1: no other way to reach a key — no bracket access, destructuring, spreading or enumerating a row
    expect(CODE).not.toMatch(/\brow\s*(?:\?\.)?\s*\[/);
    expect(CODE).not.toMatch(/\}\s*=\s*row\b/);
    expect(CODE).not.toMatch(/\.\.\.\s*row\b/);
    expect(CODE).not.toMatch(/Object\.(?:keys|values|entries|assign)\(\s*row\b/);
  });
});
