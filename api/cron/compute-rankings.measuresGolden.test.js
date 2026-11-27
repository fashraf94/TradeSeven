// api/cron/compute-rankings.measuresGolden.test.js
//
// Research universe Build 2 (PR B), build prompt section 4: THE GOLDEN FOR THE PER-STOCK MATH. Committed BEFORE the
// per-stock math moved out of this file into api/_utils/stockMeasures.js, with the exact output of the unmoved code
// for each made-up fundamentals response (api/_utils/__fixtures__/stockMeasuresGoldenInputs.js), captured into
// stockMeasures.golden.json. The rankings job's own path runs here: fetchSingleFundamental with `fetch` stubbed, then
// extractMetrics. This file does not change across the move; it passes before and after.
//
// The encoding keeps NaN, Infinity, -0, undefined and key order (a JSON round trip would hide all five), and the log
// lines are compared with their timestamp cut.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchSingleFundamental, extractMetrics } from './compute-rankings.js';
import {
  GOLDEN_CASES, GOLDEN_FAILURE, runGoldenCase, runGoldenFailure,
} from '../_utils/__fixtures__/stockMeasuresGoldenInputs.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GOLDEN = JSON.parse(readFileSync(path.join(HERE, '..', '_utils', '__fixtures__', 'stockMeasures.golden.json'), 'utf8'));
const decode = (v) => {
  if (Array.isArray(v)) return v.map(decode);
  if (v && typeof v === 'object') {
    if ('$' in v) return { undefined, NaN, Infinity, '-Infinity': -Infinity, '-0': -0 }[v.$];
    return Object.fromEntries(v.$keys.map((k) => [k, decode(v[`=${k}`])]));
  }
  return v;
};

describe('the golden holds every case, and they reach the branches it claims', () => {
  it('one golden entry per case, nothing extra', () => {
    expect(Object.keys(GOLDEN.cases)).toEqual(GOLDEN_CASES.map((c) => c.id));
  });
  const m = Object.fromEntries(Object.entries(GOLDEN.cases).map(([id, c]) => [id, decode(c).metrics]));
  it.each([
    ['net cash: interest coverage 100 and net debt / EBITDA -1', () => m['net-cash-no-interest'].interestCoverage === 100 && m['net-cash-no-interest'].netDebtEbitda === -1],
    ['negative earnings: coverage, net debt / EBITDA, debt / equity, P/E, EV/EBITDA null', () => ['interestCoverage', 'netDebtEbitda', 'debtToEquity', 'trailingPE', 'evEbitda', 'priceSalesTTM', 'priceBookMRQ', 'currentRatio'].every((k) => m['negative-earnings'][k] === null)],
    ['fewer than four quarters: no FCF, a sector-default beat rate with a partial surprise magnitude', () => m['research-stock-short-history'].fcfYield === null && m['research-stock-short-history'].beatRateSource === 'sector_default' && m['research-stock-short-history'].avgSurpriseMag !== null],
    ['a symbol outside the 228: the 0.68 default', () => m['research-stock-short-history'].beatRate === 68],
    ['a financial-sector stock with no history: the XLF default and a gross margin of 1', () => m['financial-no-history'].beatRate === 70 && m['financial-no-history'].grossMargin === 1],
    ['an empty response: the name is the ticker and the measures are null', () => decode(GOLDEN.cases['empty-response']).shaped.name === 'BRK-B' && m['empty-response'].revenueGrowthYOY === null],
    ['computed beat rates, all beats and all misses', () => m['squeeze-and-odd-debt'].beatRate === 100 && m['misses-only'].beatRate === 0 && m['misses-only'].avgSurpriseMag === 0],
    ['squeeze watch above 15% short interest', () => m['squeeze-and-odd-debt'].squeezeWatch === true],
    ['a debt field that is not a number with positive equity: debt / equity 0', () => m['squeeze-and-odd-debt'].debtToEquity === 0],
    ['valuation outliers null', () => m['valuation-outliers'].evEbitda === null && m['valuation-outliers'].trailingPE === null],
    ['a gap in the last four quarters of cash flow: no FCF', () => m['cash-flow-gap'].fcfYield === null && m['cash-flow-gap'].fcfMargin === null],
    ['the +1q fallback for the revision score', () => typeof m['net-cash-no-interest'].earningsRevisions === 'number'],
    // Added after the review (L1-2, L1-3); the cases were captured from the unmoved code at 0f0cbd0e.
    ['no debt field: debt / equity 0', () => m['fallback-fields'].debtToEquity === 0],
    ['ebit beside a balance sheet: coverage and net debt / EBITDA computed from it', () => m['fallback-fields'].interestCoverage > 0 && m['fallback-fields'].netDebtEbitda > 0],
    ['boundaries kept: EV/EBITDA 200, P/E 500, short interest 15 is no squeeze; P/B 0 is null', () => m['fallback-fields'].evEbitda === 200 && m['fallback-fields'].trailingPE === 500 && m['fallback-fields'].squeezeWatch === false && m['fallback-fields'].priceBookMRQ === null],
    ['exactly two usable quarters: a partial magnitude and an average surprise', () => m['fallback-fields'].avgSurpriseMag !== null && m['fallback-fields'].avgEarningsSurprise !== null],
    ['operating income not a number: coverage, net debt / EBITDA and the debt badge EBIT null', () => m['odd-income'].interestCoverage === null && m['odd-income'].netDebtEbitda === null && m['odd-income'].ebit === null],
    ['equity exactly 0: debt / equity null; exactly one usable quarter: no average surprise', () => m['odd-income'].debtToEquity === null && m['odd-income'].avgEarningsSurprise === null && m['odd-income'].avgSurpriseMag === null],
    ['no earnings and no sector: the 0.68 default from the no-history branch', () => m['no-history-unknown-sector'].beatRate === 68 && m['no-history-unknown-sector'].beatRateSource === 'sector_default'],
    ['EBIT exactly 0 with interest: coverage null', () => m['no-history-unknown-sector'].interestCoverage === null && m['no-history-unknown-sector'].ebit === 0],
  ])('%s', (_t, holds) => { expect(holds()).toBe(true); });
});

describe('the rankings job computes exactly the golden', () => {
  it.each(GOLDEN_CASES.map((c) => [c.id, c]))('%s', async (id, c) => {
    expect(await runGoldenCase(c, { fetchSingleFundamental, extractMetrics })).toEqual(GOLDEN.cases[id]);
  });
  it(`a failed request throws the same error (HTTP ${GOLDEN_FAILURE.status})`, async () => {
    expect(await runGoldenFailure({ fetchSingleFundamental })).toEqual(GOLDEN.failure);
  });
});
