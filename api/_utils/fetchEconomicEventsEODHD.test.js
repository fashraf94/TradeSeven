// api/_utils/fetchEconomicEventsEODHD.test.js
// Matcher + settle-gate battery for the R-B1 econ operand source, validated
// against the CAPTURED feed (Econ Capture rulings, Jul 30 2026):
//   • §1 positive rules — exact type (+ comparison where keyed) per category
//   • §3 negative rules — every avoid-listed sibling tested by its LITERAL
//     observed string (the strings below all appear in the capture artifacts
//     at api/_utils/__fixtures__/econCapture*.json)
//   • §3.3 ISM dual-name single-select
//   • §5.4 parse-as-UTC on `date`
//   • a full-July fixture sweep: every July Tier-1 array event resolves to
//     the expected feed row (or documented non-match) against all 425 rows.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  ECON_CATEGORY_MATCHERS,
  selectOperandRow,
  joinOperandsToEvents,
  rowDateOnly,
  parseEtTimeToMinutes,
  etMinutesOfDay,
  isSettled,
  SETTLE_DELAY_MINUTES,
} from './fetchEconomicEventsEODHD.js';
import { getMacroEventsInWindow } from './macroCalendar.js';

// The founder's full-July capture (425 rows, 200 distinct types) — the
// matcher-validation artifact of record (capture memo §0).
const JULY_CAPTURE = JSON.parse(
  readFileSync(new URL('./__fixtures__/econCaptureJulyFull.json', import.meta.url), 'utf-8'),
);
const JULY_ROWS = JULY_CAPTURE.rows;

const row = (type, comparison, date, extra = {}) => ({
  type, comparison, date, actual: 1, previous: 1, estimate: 1, ...extra,
});

describe('§1 positive rules — exact type + comparison keying', () => {
  const cases = [
    ['FOMC', { date: '2026-07-29', category: 'FOMC' }, row('Fed Interest Rate Decision', null, '2026-07-29 18:00:00')],
    ['CPI', { date: '2026-07-14', category: 'CPI' }, row('Inflation Rate', 'yoy', '2026-07-14 12:30:00')],
    ['PPI', { date: '2026-07-15', category: 'PPI' }, row('Producer Price Index', 'yoy', '2026-07-15 12:30:00')],
    ['PCE', { date: '2026-07-30', category: 'PCE' }, row('PCE Price Index', 'mom', '2026-07-30 12:30:00')],
    ['GDP', { date: '2026-07-30', category: 'GDP' }, row('GDP Growth Rate', 'qoq', '2026-07-30 12:30:00')],
    ['Retail Sales', { date: '2026-07-16', category: 'Retail Sales' }, row('Retail Sales', 'mom', '2026-07-16 12:30:00')],
    ['NFP', { date: '2026-07-02', category: 'NFP' }, row('Non Farm Payrolls', null, '2026-07-02 12:30:00')],
    ['ISM Manufacturing', { date: '2026-07-01', category: 'ISM Manufacturing' }, row('ISM Manufacturing PMI', null, '2026-07-01 14:00:00')],
    ['Consumer Confidence', { date: '2026-07-28', category: 'Consumer Confidence' }, row('CB Consumer Confidence', null, '2026-07-28 14:00:00')],
    ['Jobless Claims', { date: '2026-07-23', category: 'Jobless Claims' }, row('Initial Jobless Claims', null, '2026-07-23 12:30:00')],
  ];
  for (const [name, event, feedRow] of cases) {
    it(`${name} matches its ruled feed type`, () => {
      expect(selectOperandRow(event, [feedRow]).matchedType).toBe(feedRow.type);
    });
  }

  it('date equality with the array event is mandatory (R-A1: arrays own dates)', () => {
    const gdp = { date: '2026-07-30', category: 'GDP' };
    expect(selectOperandRow(gdp, [row('GDP Growth Rate', 'qoq', '2026-07-29 12:30:00')]).row).toBeNull();
  });

  it('comparison keying: the mom Inflation Rate row and the index-level CPI rows never stand in for the YoY headline', () => {
    const cpi = { date: '2026-07-14', category: 'CPI' };
    // All four literal observed strings from the Jul 14 CPI release:
    const observed = [
      row('Inflation Rate', 'mom', '2026-07-14 12:30:00', { actual: -0.4 }),
      row('CPI', null, '2026-07-14 12:30:00', { actual: 333.95 }),
      row('CPI s.a', null, '2026-07-14 12:30:00', { actual: 332.568 }),
      row('Inflation Rate', 'yoy', '2026-07-14 12:30:00', { actual: 3.5 }),
    ];
    const { row: chosen, matchedType } = selectOperandRow(cpi, observed);
    expect(matchedType).toBe('Inflation Rate');
    expect(chosen.comparison).toBe('yoy');
    expect(chosen.actual).toBe(3.5); // the headline %, never the ~333 index level
  });

  it('PPI keys yoy — the observed mom row carries no estimate (capture, Jul 15)', () => {
    const ppi = { date: '2026-07-15', category: 'PPI' };
    const observed = [
      row('Producer Price Index', 'mom', '2026-07-15 12:30:00', { actual: -0.3, estimate: null }),
      row('Producer Price Index', null, '2026-07-15 12:30:00', { actual: 156.566 }),
      row('Producer Price Index', 'yoy', '2026-07-15 12:30:00', { actual: 5.5, estimate: 6.2 }),
    ];
    const { row: chosen } = selectOperandRow(ppi, observed);
    expect(chosen.comparison).toBe('yoy');
    expect(chosen.estimate).toBe(6.2);
  });
});

describe('§3 negative rules — literal observed sibling strings never match', () => {
  const negatives = [
    ['CPI', '2026-07-14', ['CPI', 'CPI s.a', 'Core CPI', 'Core Inflation Rate']],
    ['PPI', '2026-07-15', ['Core PPI', 'PPI Ex Food, Energy and Trade']],
    ['PCE', '2026-07-30', ['Core PCE Price Index', 'PCE Prices', 'Core PCE Prices']],
    ['GDP', '2026-07-30', ['Gross Domestic Product', 'GDP Price Index', 'GDP Sales', 'Atlanta Fed GDPNow']],
    ['NFP', '2026-07-02', ['Nonfarm Payrolls Private', 'Government Payrolls', 'Manufacturing Payrolls', 'ADP Employment Change']],
    ['Retail Sales', '2026-07-16', ['Retail Sales Ex Autos', 'Retail Sales Ex Gas/Autos', 'Retail Inventories Ex Autos']],
    ['FOMC', '2026-07-29', ['Fed Press Conference', 'Press Conference', 'FOMC Economic Projections', 'FOMC Minutes', 'Fed Kugler Speech']],
    ['ISM Manufacturing', '2026-07-01', ['ISM Manufacturing Employment', 'ISM Manufacturing New Orders', 'ISM Manufacturing Prices', 'S&P Global Manufacturing PMI', 'ISM Non-Manufacturing PMI', 'ISM Services PMI']],
    ['ISM Services', '2026-07-06', ['ISM Services Business Activity', 'ISM Services Employment', 'ISM Services New Orders', 'ISM Services Prices', 'ISM Non-Manufacturing Business Activity', 'ISM Non-Manufacturing Employment', 'ISM Non-Manufacturing New Orders', 'ISM Non-Manufacturing Prices', 'S&P Global Services PMI']],
    ['Consumer Confidence', '2026-07-28', ['Michigan Consumer Sentiment', 'Michigan Consumer Expectations', 'Economic Optimism Index', 'NFIB Business Optimism Index']],
    ['Jobless Claims', '2026-07-23', ['Continuing Jobless Claims', 'Jobless Claims 4-Week Average']],
  ];
  for (const [category, date, siblings] of negatives) {
    it(`${category}: ${siblings.length} observed siblings all rejected`, () => {
      for (const sibling of siblings) {
        // Give the sibling every comparison variant so only the TYPE decides.
        const rows = ['mom', 'yoy', 'qoq', null].map((cmp) => row(sibling, cmp, `${date} 12:30:00`));
        expect(selectOperandRow({ date, category }, rows).row, `${category} ← ${sibling}`).toBeNull();
      }
    });
  }
});

describe('§3.3 ISM dual naming — one survey, two labels, exactly one row', () => {
  it('accepts either label; a day carrying BOTH yields exactly one selection (never a double count)', () => {
    const ismSvc = { date: '2026-07-06', category: 'ISM Services' };
    const both = [
      row('ISM Non-Manufacturing PMI', null, '2026-07-06 14:00:00', { actual: 54, estimate: 54.2 }),
      row('ISM Services PMI', null, '2026-07-06 14:00:00', { actual: 54, estimate: 54 }),
    ];
    const { row: chosen, matchedType } = selectOperandRow(ismSvc, both);
    expect(chosen).toBeTruthy();
    expect(matchedType).toBe('ISM Services PMI'); // types[] preference order
    // Either label alone also matches:
    expect(selectOperandRow(ismSvc, [both[0]]).matchedType).toBe('ISM Non-Manufacturing PMI');
    expect(selectOperandRow(ismSvc, [both[1]]).matchedType).toBe('ISM Services PMI');
  });
});

describe('§5.4 parse-as-UTC on `date`', () => {
  it('takes the UTC calendar date from the timezone-naive string itself — machine-TZ-independent', () => {
    // The captured FOMC row: '2026-07-29 18:00:00' UTC = 2:00 PM ET.
    expect(rowDateOnly({ date: '2026-07-29 18:00:00' })).toBe('2026-07-29');
    expect(rowDateOnly({ date: '2026-07-29T18:00:00' })).toBe('2026-07-29');
    expect(rowDateOnly({ date: '2026-07-29' })).toBe('2026-07-29');
    expect(rowDateOnly({ date: 'not a date' })).toBeNull();
    expect(rowDateOnly({})).toBeNull();
  });
});

describe('absent categories (memo §2)', () => {
  it('JOLTS is dropped: no matcher, and no array event emits it', () => {
    expect(ECON_CATEGORY_MATCHERS.JOLTS).toBeUndefined();
    const july = getMacroEventsInWindow({ fromDate: '2026-07-01', toDate: '2026-07-31' });
    expect(july.filter((e) => e.category === 'JOLTS')).toEqual([]);
  });
  it('Productivity keeps its array entry but is deliberately unmapped (no firings until verified)', () => {
    expect(ECON_CATEGORY_MATCHERS.Productivity).toBeUndefined();
    const aug = getMacroEventsInWindow({ fromDate: '2026-08-01', toDate: '2026-08-31' });
    const prodEvent = aug.find((e) => e.category === 'Productivity');
    expect(prodEvent).toBeTruthy(); // array entry survives
    expect(selectOperandRow(prodEvent, JULY_ROWS).row).toBeNull(); // never matches
  });
  it('every mapped matcher belongs to a live macroCalendar category and vice-versa (minus the two rulings)', () => {
    const mapped = Object.keys(ECON_CATEGORY_MATCHERS).sort();
    expect(mapped).toEqual([
      'CPI', 'Consumer Confidence', 'FOMC', 'GDP', 'ISM Manufacturing',
      'ISM Services', 'Jobless Claims', 'NFP', 'PCE', 'PPI', 'Retail Sales',
    ]);
  });
});

describe('full-July fixture sweep — every Tier-1 array event vs all 425 captured rows', () => {
  const julyEvents = getMacroEventsInWindow({ fromDate: '2026-07-01', toDate: '2026-07-31' });
  const joined = joinOperandsToEvents(julyEvents, JULY_ROWS);
  const byCategory = (cat) => joined.filter((j) => j.event.category === cat);

  it('CPI (Jul 14) → Inflation Rate yoy, actual 3.5 vs estimate 3.8', () => {
    const [cpi] = byCategory('CPI');
    expect(cpi.matchedType).toBe('Inflation Rate');
    expect(cpi.operands).toEqual({ actual: 3.5, estimate: 3.8, previous: expect.anything() });
  });
  it('PPI (Jul 15) → Producer Price Index yoy, 5.5 vs 6.2', () => {
    const [ppi] = byCategory('PPI');
    expect(ppi.matchedType).toBe('Producer Price Index');
    expect(ppi.operands.actual).toBe(5.5);
    expect(ppi.operands.estimate).toBe(6.2);
  });
  it('Retail Sales (Jul 16) → mom, 0.5 vs 0.5', () => {
    const [rs] = byCategory('Retail Sales');
    expect(rs.matchedType).toBe('Retail Sales');
    expect(rs.operands.actual).toBe(0.5);
  });
  it('FOMC (Jul 29) → Fed Interest Rate Decision, numeric 3.75 (review M5 closed: a plain number, not a range string)', () => {
    const [fomc] = byCategory('FOMC');
    expect(fomc.matchedType).toBe('Fed Interest Rate Decision');
    expect(fomc.operands).toEqual({ actual: 3.75, estimate: 3.75, previous: 3.75 });
  });
  it('ISM Manufacturing (Jul 1) → 53.3 vs 54; ISM Services (Jul 6) resolves the dual-name day to ONE row', () => {
    const [mfg] = byCategory('ISM Manufacturing');
    expect(mfg.matchedType).toBe('ISM Manufacturing PMI');
    expect(mfg.operands.actual).toBe(53.3);
    const [svc] = byCategory('ISM Services');
    expect(svc.matchedType).toBe('ISM Services PMI');
    expect(svc.operands.actual).toBe(54);
  });
  it('Consumer Confidence (Jul 28) → CB row, 90.8 vs 92.4 — Michigan never substitutes', () => {
    const [cc] = byCategory('Consumer Confidence');
    expect(cc.matchedType).toBe('CB Consumer Confidence');
    expect(cc.operands.actual).toBe(90.8);
  });
  it('Jobless Claims: five July Thursdays, four with released actuals in feed thousands (187…215)', () => {
    const claims = byCategory('Jobless Claims');
    expect(claims).toHaveLength(5);
    for (const c of claims) expect(c.matchedType).toBe('Initial Jobless Claims');
    const released = claims.filter((c) => c.operands.actual !== null);
    expect(released.map((c) => c.operands.actual).sort()).toEqual([187, 208, 215, 215]);
  });
  it('PCE + GDP (Jul 30, unreleased at capture time) match their rows with actual null — the data gate holds them, not the matcher', () => {
    const [pce] = byCategory('PCE');
    expect(pce.matchedType).toBe('PCE Price Index');
    expect(pce.operands.actual).toBeNull();
    const [gdp] = byCategory('GDP');
    expect(gdp.matchedType).toBe('GDP Growth Rate');
    expect(gdp.operands.actual).toBeNull();
  });
  it('NFP: the computed array date (Mon Jul 6, holiday forward-shift) misses the observed Thu Jul 2 release — the review-L4 divergence, now capture-confirmed (register)', () => {
    const [nfp] = byCategory('NFP');
    expect(nfp.event.date).toBe('2026-07-06');
    expect(nfp.operands).toBeNull(); // no same-date feed row: BLS shifted EARLIER
    const observedNfp = JULY_ROWS.find((r) => r.type === 'Non Farm Payrolls');
    expect(rowDateOnly(observedNfp)).toBe('2026-07-02');
  });
});

describe('joinOperandsToEvents — raw operand passthrough', () => {
  it('carries feed values untouched (parse authority is econPrintVerifier)', () => {
    const gdpEvent = { date: '2026-07-30', category: 'GDP' };
    const rows = [row('GDP Growth Rate', 'qoq', '2026-07-30 12:30:00', { actual: 3.0, estimate: 2.5, previous: 2.4 })];
    const [joinedRow] = joinOperandsToEvents([gdpEvent], rows);
    expect(joinedRow.operands).toEqual({ actual: 3.0, estimate: 2.5, previous: 2.4 });
    expect(joinedRow.matchedType).toBe('GDP Growth Rate');
  });
  it('unmatched events carry null operands', () => {
    const [joinedRow] = joinOperandsToEvents([{ date: '2026-07-30', category: 'GDP' }], []);
    expect(joinedRow.operands).toBeNull();
  });
});

describe('settle gate (R-B1a ii): release time + one cron tick', () => {
  const gdpEvent = { date: '2026-07-30', time: '8:30 AM ET', category: 'GDP' };
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
    expect(isSettled(gdpEvent, new Date('2026-07-30T12:59:00Z'), '2026-07-30')).toBe(false);
    expect(isSettled(gdpEvent, new Date('2026-07-30T13:00:00Z'), '2026-07-30')).toBe(true);
  });
  it('prior-session events are always settled; future-dated never', () => {
    expect(isSettled(gdpEvent, new Date('2026-07-31T11:00:00Z'), '2026-07-31')).toBe(true);
    expect(isSettled(gdpEvent, new Date('2026-07-29T13:00:00Z'), '2026-07-29')).toBe(false);
  });
  it('etMinutesOfDay reads the ET clock across the UTC boundary', () => {
    expect(etMinutesOfDay(new Date('2026-07-31T00:30:00Z'))).toBe(20 * 60 + 30);
  });
});
