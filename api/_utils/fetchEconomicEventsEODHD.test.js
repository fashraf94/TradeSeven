// api/_utils/fetchEconomicEventsEODHD.test.js
// Category matcher + settle-gate battery for the R-B1 econ operand source.
// The matcher table's live validation happens against the founder's capture
// run (api/scripts/capture-econ-events-eodhd.js); these tests lock the
// selection SEMANTICS: date equality mandatory, avoid-list fails closed,
// preferred comparison wins, raw operand passthrough.

import { describe, it, expect } from 'vitest';
import {
  ECON_CATEGORY_MATCHERS,
  selectOperandRow,
  joinOperandsToEvents,
  parseEtTimeToMinutes,
  etMinutesOfDay,
  isSettled,
  SETTLE_DELAY_MINUTES,
} from './fetchEconomicEventsEODHD.js';

const gdpEvent = { date: '2026-07-30', time: '8:30 AM ET', category: 'GDP', impact: 'high', event: 'GDP Q2 2026 advance estimate' };
const cpiEvent = { date: '2026-07-14', time: '8:30 AM ET', category: 'CPI', impact: 'high', event: 'CPI (June)' };

describe('selectOperandRow — matcher semantics', () => {
  it('date equality with the array event is mandatory (R-A1: arrays own dates)', () => {
    const rows = [{ type: 'GDP Growth Rate QoQ Adv', comparison: 'qoq', date: '2026-07-29 12:30:00', actual: 3.0 }];
    expect(selectOperandRow(gdpEvent, rows).row).toBeNull();
  });
  it('selects the headline row and prefers the configured comparison', () => {
    const rows = [
      { type: 'Inflation Rate YoY', comparison: 'yoy', date: '2026-07-14 12:30:00', actual: 2.9 },
      { type: 'Inflation Rate MoM', comparison: 'mom', date: '2026-07-14 12:30:00', actual: 0.3 },
    ];
    const { row } = selectOperandRow(cpiEvent, rows);
    expect(row.comparison).toBe('mom');
  });
  it('avoid-list filters sibling series (core CPI never substitutes)', () => {
    const rows = [
      { type: 'Core Inflation Rate MoM', comparison: 'mom', date: '2026-07-14 12:30:00', actual: 0.2 },
      { type: 'Inflation Rate MoM', comparison: 'mom', date: '2026-07-14 12:30:00', actual: 0.3 },
    ];
    const { matchedType } = selectOperandRow(cpiEvent, rows);
    expect(matchedType).toBe('Inflation Rate MoM');
  });
  it('fails CLOSED when only avoid-listed siblings match (mis-mapping class)', () => {
    const rows = [{ type: 'Core Inflation Rate MoM', comparison: 'mom', date: '2026-07-14 12:30:00', actual: 0.2 }];
    expect(selectOperandRow(cpiEvent, rows).row).toBeNull();
  });
  it('ISM Manufacturing never matches the services release (non-manufacturing collision)', () => {
    const ismEvent = { date: '2026-07-01', time: '10:00 AM ET', category: 'ISM Manufacturing', impact: 'medium', event: 'ISM Manufacturing PMI (June)' };
    const rows = [{ type: 'ISM Non Manufacturing PMI', comparison: null, date: '2026-07-01 14:00:00', actual: 54.1 }];
    expect(selectOperandRow(ismEvent, rows).row).toBeNull();
  });
  it('Jobless Claims ignores continuing/4-week variants', () => {
    const claimsEvent = { date: '2026-07-30', time: '8:30 AM ET', category: 'Jobless Claims', impact: 'medium', event: 'Initial Jobless Claims' };
    const rows = [
      { type: 'Continuing Jobless Claims', comparison: null, date: '2026-07-30 12:30:00', actual: 1900000 },
      { type: 'Initial Jobless Claims', comparison: null, date: '2026-07-30 12:30:00', actual: 218000 },
    ];
    expect(selectOperandRow(claimsEvent, rows).matchedType).toBe('Initial Jobless Claims');
  });
  it('every macroCalendar category has a matcher entry', () => {
    for (const category of ['FOMC', 'CPI', 'PPI', 'PCE', 'Retail Sales', 'GDP', 'Productivity',
      'NFP', 'JOLTS', 'ISM Manufacturing', 'ISM Services', 'Consumer Confidence', 'Jobless Claims']) {
      expect(ECON_CATEGORY_MATCHERS[category], category).toBeDefined();
    }
  });
});

describe('joinOperandsToEvents — raw operand passthrough', () => {
  it('carries EODHD values untouched (parse authority is econPrintVerifier)', () => {
    const rows = [{ type: 'GDP Growth Rate QoQ Adv', comparison: 'qoq', date: '2026-07-30 12:30:00', actual: '3.0%', estimate: '2.5%', previous: 2.4 }];
    const [joined] = joinOperandsToEvents([gdpEvent], rows);
    expect(joined.operands).toEqual({ actual: '3.0%', estimate: '2.5%', previous: 2.4 });
    expect(joined.matchedType).toBe('GDP Growth Rate QoQ Adv');
  });
  it('unmatched events carry null operands', () => {
    const [joined] = joinOperandsToEvents([gdpEvent], []);
    expect(joined.operands).toBeNull();
  });
});

describe('settle gate (R-B1a ii): release time + one cron tick', () => {
  it('parses macroCalendar time strings', () => {
    expect(parseEtTimeToMinutes('8:30 AM ET')).toBe(510);
    expect(parseEtTimeToMinutes('10:00 AM ET')).toBe(600);
    expect(parseEtTimeToMinutes('2:00 PM ET')).toBe(840);
    expect(parseEtTimeToMinutes('junk')).toBeNull();
  });
  it('SETTLE_DELAY_MINUTES is one cron tick', () => {
    expect(SETTLE_DELAY_MINUTES).toBe(30);
  });
  it('same-day events settle exactly at release + delay (ET clock)', () => {
    // 2026-07-30 is EDT (UTC-4): 8:59 ET = 12:59Z, 9:00 ET = 13:00Z.
    const event = gdpEvent; // 8:30 AM ET release
    expect(isSettled(event, new Date('2026-07-30T12:59:00Z'), '2026-07-30')).toBe(false);
    expect(isSettled(event, new Date('2026-07-30T13:00:00Z'), '2026-07-30')).toBe(true);
  });
  it('prior-session events are always settled; future-dated never', () => {
    expect(isSettled(gdpEvent, new Date('2026-07-31T11:00:00Z'), '2026-07-31')).toBe(true);
    expect(isSettled(gdpEvent, new Date('2026-07-29T13:00:00Z'), '2026-07-29')).toBe(false);
  });
  it('etMinutesOfDay reads the ET clock across the UTC boundary', () => {
    // 00:30Z on Jul 31 = 20:30 ET on Jul 30 (EDT).
    expect(etMinutesOfDay(new Date('2026-07-31T00:30:00Z'))).toBe(20 * 60 + 30);
  });
});
