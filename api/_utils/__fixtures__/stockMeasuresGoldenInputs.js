// api/_utils/__fixtures__/stockMeasuresGoldenInputs.js
//
// Research universe Build 2 (PR B), build prompt section 4: MADE-UP EODHD fundamentals responses, in the shape the
// rankings filter returns (Highlights, Valuation, Technicals, Earnings, Financials, SharesStats and the name), that
// together reach every branch of the per-stock math moved out of api/cron/compute-rankings.js into
// api/_utils/stockMeasures.js. The golden (stockMeasures.golden.json) is the exact output of the UNMOVED code for each
// case, captured before the move; api/cron/compute-rankings.measuresGolden.test.js replays it.
//
// Values are non-dyadic decimals (so a float slip shows), and strings where EODHD sends strings (statements, Trend,
// History dates). None of these numbers is a real company's.

const Q8 = ['2024-12-31', '2025-03-31', '2025-06-30', '2025-09-30', '2025-12-31', '2026-03-31', '2026-06-30', '2026-09-30'];

/** A quarterly statement keyed by date (ascending insertion, so the code's own sort is exercised). */
const quarterly = (dates, rowOf) => Object.fromEntries(dates.map((d, i) => [d, { date: d, ...rowOf(i, d) }]));

/** Earnings.History keyed by period date, newest first (EODHD's order), from [actual, estimate] pairs. */
const history = (pairs) => Object.fromEntries(pairs.map(([actual, estimate], i) => {
  const d = Q8[Q8.length - 1 - (i % Q8.length)].replace(/^(\d{4})/, (y) => String(Number(y) - Math.floor(i / Q8.length) * 2));
  return [d, { reportDate: d, date: d, beforeAfterMarket: 'AfterMarket', currency: 'USD', epsActual: actual, epsEstimate: estimate, epsDifference: null, surprisePercent: null }];
}));

const trendRow = (period, date, current, ago30) => ({ date, period, growth: '0.1730', earningsEstimateAvg: current, epsTrendCurrent: current, epsTrend30daysAgo: ago30 });

export const GOLDEN_CASES = [
  {
    id: 'full-xlk',
    note: 'every section present; 13 usable quarters of history (12 read); General.Name present; debt, interest and depreciation all present',
    ticker: 'AAPL',
    response: {
      Highlights: {
        MarketCapitalization: 3456789012345, QuarterlyRevenueGrowthYOY: 0.0773, QuarterlyEarningsGrowthYOY: 0.1093,
        OperatingMarginTTM: 0.3177, ProfitMarginTTM: 0.2431, ProfitMargin: 0.2431, GrossProfitTTM: 186543210987, RevenueTTM: 416161000000,
        ReturnOnAssetsTTM: 0.2297, ReturnOnEquityTTM: 1.5091, DividendYield: 0.0041,
      },
      Valuation: { EnterpriseValueEbitda: 27.33, TrailingPE: 37.41, PriceSalesTTM: 9.07, PriceBookMRQ: 55.47 },
      Technicals: { '52WeekHigh': 288.62, '52WeekLow': 169.21 },
      Earnings: {
        History: history([
          [1.87, 1.77], [1.57, 1.43], [1.65, 1.62], [2.4, 2.35], [1.64, 1.6], [1.4, 1.35], [1.53, 1.5], [2.18, 2.1],
          [1.46, 1.39], [1.26, 1.19], [1.52, 1.43], [1.88, 1.94], [1.29, 1.21],
        ]),
        Trend: {
          '2027-09-30': trendRow('+1y', '2027-09-30', '8.4900', '8.3100'),
          '2026-12-31': trendRow('+1q', '2026-12-31', '2.6700', '2.6300'),
          '2026-09-30': trendRow('0y', '2026-09-30', '7.3800', '7.1700'),
        },
      },
      Financials: {
        Income_Statement: {
          quarterly: quarterly(Q8, (i) => ({ totalRevenue: String(94930000000 + i * 1111111111.11), operatingIncome: String(29590000000 + i * 333333333.33) })),
          yearly: {
            '2024-09-30': { operatingIncome: '123216000000.00', interestExpense: '-1013000000.00', depreciationAndAmortization: '11445000000.00' },
            '2025-09-30': { operatingIncome: '133050000000.70', interestExpense: '-997000000.30', depreciationAndAmortization: '11698000000.10' },
          },
        },
        Cash_Flow: {
          quarterly: quarterly(Q8, (i) => ({ totalCashFromOperatingActivities: String(26810000000.17 + i * 777777777.77), capitalExpenditures: String(-2908000000.31 - i * 11111111.11) })),
        },
        Balance_Sheet: {
          quarterly: quarterly(Q8.slice(-2), () => ({ totalStockholderEquity: '73733000000.00' })),
          yearly: {
            '2024-09-30': { shortLongTermDebtTotal: '106629000000.00', totalStockholderEquity: '56950000000.00', totalCurrentAssets: '152987000000.00', totalCurrentLiabilities: '176392000000.00', netDebt: '76686000000.00' },
            '2025-09-30': { shortLongTermDebtTotal: '98657000000.41', totalStockholderEquity: '73733000000.17', totalCurrentAssets: '147957000000.93', totalCurrentLiabilities: '165631000000.29', netDebt: '62723000000.77' },
          },
        },
      },
      SharesStats: { ShortPercentOfFloat: 0.77, ShortRatio: 2.31 },
      General: { Name: 'Apple Inc' },
    },
  },
  {
    id: 'financial-no-history',
    note: 'a financial-sector stock (XLF): gross profit equals revenue, no capital expenditures, no earnings history (the XLF sector default); the name under the top-level "General::Name" key EODHD actually returns',
    ticker: 'JPM',
    response: {
      Highlights: { MarketCapitalization: 812345678901, QuarterlyRevenueGrowthYOY: 0.0907, QuarterlyEarningsGrowthYOY: 0.1239, OperatingMarginTTM: 0.4123, GrossProfitTTM: 171234567890, RevenueTTM: 171234567890, ReturnOnAssetsTTM: 0.0137, ReturnOnEquityTTM: 0.1613, DividendYield: 0.0193 },
      Valuation: { EnterpriseValueEbitda: null, TrailingPE: 14.97, PriceSalesTTM: 4.71, PriceBookMRQ: 2.43 },
      Technicals: { '52WeekHigh': 322.27, '52WeekLow': 202.16 },
      Earnings: { Trend: { '2026-12-31': trendRow('0y', '2026-12-31', '20.1300', '19.7700') } },
      Financials: {
        Income_Statement: { yearly: { '2025-12-31': { operatingIncome: '81234567890.13', interestExpense: '-91234567890.77' } } },
        Cash_Flow: { quarterly: quarterly(Q8.slice(-4), (i) => ({ totalCashFromOperatingActivities: String(-12345678901.3 + i * 9876543210.7) })) },
        Balance_Sheet: { yearly: { '2025-12-31': { shortLongTermDebtTotal: '512345678901.00', totalStockholderEquity: '362345678901.00', netDebt: '123456789012.34' } } },
      },
      SharesStats: { ShortPercentFloat: 0.0091, ShortRatio: 2.07 },
      'General::Name': 'JPMorgan Chase & Co',
    },
  },
  {
    id: 'net-cash-no-interest',
    note: 'a net-cash company: negative net debt and zero interest expense (interest coverage 100, net debt / EBITDA -1); Trend with no 0y row (the +1q fallback)',
    ticker: 'XOM',
    response: {
      Highlights: { MarketCapitalization: 498765432109, QuarterlyRevenueGrowthYOY: -0.0517, QuarterlyEarningsGrowthYOY: -0.1213, OperatingMarginTTM: 0.1419, GrossProfitTTM: 101234567890, RevenueTTM: 332109876543, ReturnOnAssetsTTM: 0.0723, ReturnOnEquityTTM: 0.1317, DividendYield: 0.0337 },
      Valuation: { EnterpriseValueEbitda: 7.13, TrailingPE: 15.73, PriceSalesTTM: 1.51, PriceBookMRQ: 1.93 },
      Technicals: { '52WeekHigh': 126.37, '52WeekLow': 97.81 },
      Earnings: {
        History: history([[1.88, 1.81], [1.64, 1.71], [1.76, 1.79], [1.67, 1.67], [1.92, 1.87]]),
        Trend: { '2027-03-31': trendRow('+1q', '2027-03-31', '1.7300', '1.7900') },
      },
      Financials: {
        Income_Statement: { yearly: { '2025-12-31': { operatingIncome: '41234567890.12', interestExpense: '0', depreciationAndAmortization: '23456789012.34' } } },
        Cash_Flow: { quarterly: quarterly(Q8.slice(-5), (i) => ({ totalCashFromOperatingActivities: String(13456789012.3 - i * 123456789.1), capitalExpenditures: String(-6543210987.6 + i * 12345678.9) })) },
        Balance_Sheet: { yearly: { '2025-12-31': { shortLongTermDebtTotal: '41234567890.00', totalStockholderEquity: '263456789012.00', totalCurrentAssets: '91234567890.00', totalCurrentLiabilities: '71234567890.00', netDebt: '-1234567890.12' } } },
      },
      SharesStats: { ShortPercentOfFloat: 1.13, ShortRatio: 3.07 },
    },
  },
  {
    id: 'research-stock-short-history',
    note: 'a symbol outside the 228 (no house sector: the 0.68 default); three usable quarters of history (sector default, partial surprise magnitude); three quarters of cash flow (no TTM); one history row with a zero estimate and one with no actual (both skipped)',
    ticker: 'GLW',
    response: {
      Highlights: { MarketCapitalization: 86346842112, QuarterlyRevenueGrowthYOY: 0.184, QuarterlyEarningsGrowthYOY: 0.56, OperatingMarginTTM: 0.1677, ProfitMargin: 0.1213, GrossProfitTTM: 6464000000, RevenueTTM: 17718999040, ReturnOnAssetsTTM: 0.058, ReturnOnEquityTTM: 0.1788, DividendYield: 0.011 },
      Valuation: { EnterpriseValueEbitda: 21.3439, TrailingPE: 40.583, PriceSalesTTM: 4.8731, PriceBookMRQ: 5.9468 },
      Technicals: { '52WeekHigh': 270.6336, '52WeekLow': 81.0498 },
      Earnings: { History: history([[0.91, 0.89], [0.78, 0.76], [0.7, 0], [0.67, 0.71], [null, 0.6]]) },
      Financials: {
        Income_Statement: { yearly: { '2025-12-31': { operatingIncome: '2412000000.37', interestExpense: '-331000000.13', depreciationAndAmortization: '1302000000.71' } } },
        Cash_Flow: { quarterly: quarterly(Q8.slice(-3), (i) => ({ totalCashFromOperatingActivities: String(712000000.11 + i * 1000000.3), capitalExpenditures: String(-311000000.17) })) },
        Balance_Sheet: { yearly: { '2025-12-31': { shortLongTermDebtTotal: '8456000000.00', totalStockholderEquity: '11234000000.00', totalCurrentAssets: '8123000000.00', totalCurrentLiabilities: '4567000000.00', netDebt: '6987000000.13' } } },
      },
      SharesStats: { ShortPercentFloat: 0.0269, ShortRatio: 1.97 },
      'General::Name': 'Corning Incorporated',
    },
  },
  {
    id: 'negative-earnings',
    note: 'negative earnings: negative EBIT (interest coverage below zero, so null), negative EBITDA with positive net debt (null), negative P/E and EV/EBITDA (null), zero price/sales and negative price/book (null), negative equity (debt/equity null), zero current liabilities (current ratio null)',
    ticker: 'INTC',
    response: {
      Highlights: { MarketCapitalization: 98765432109, QuarterlyRevenueGrowthYOY: -0.0813, QuarterlyEarningsGrowthYOY: -1.7311, OperatingMarginTTM: -0.0917, ProfitMarginTTM: -0.3343, GrossProfitTTM: 17123456789, RevenueTTM: 53123456789, ReturnOnAssetsTTM: -0.0213, ReturnOnEquityTTM: -0.1913, DividendYield: 0 },
      Valuation: { EnterpriseValueEbitda: -5.17, TrailingPE: -12.3, PriceSalesTTM: 0, PriceBookMRQ: -1.2 },
      Technicals: { '52WeekHigh': 43.17, '52WeekLow': 18.51 },
      Earnings: {
        History: history([[-0.11, 0.03], [0.02, 0.01], [-0.46, -0.03], [0.13, 0.11], [0.18, 0.13], [0.54, 0.44]]),
        Trend: { '2026-12-31': trendRow('0y', '2026-12-31', '-0.1300', '-0.0700') },
      },
      Financials: {
        Income_Statement: { yearly: { '2025-12-31': { operatingIncome: '-11678000000.31', interestExpense: '-1234000000.17', depreciationAndAmortization: '9123000000.13' } } },
        Cash_Flow: { quarterly: quarterly(Q8.slice(-4), (i) => ({ totalCashFromOperatingActivities: String(1234567890.1 - i * 987654321.3), capitalExpenditures: String(-6123456789.7) })) },
        Balance_Sheet: { yearly: { '2025-12-31': { shortLongTermDebtTotal: '50123456789.00', totalStockholderEquity: '-1234567890.00', totalCurrentAssets: '43123456789.00', totalCurrentLiabilities: '0', netDebt: '29123456789.13' } } },
      },
      SharesStats: { ShortPercentOfFloat: 3.17, ShortRatio: 1.43 },
    },
  },
  {
    id: 'empty-response',
    note: 'an empty response: every section missing (the name falls back to the ticker; the XLF sector default)',
    ticker: 'BRK-B',
    response: {},
  },
  {
    id: 'valuation-outliers',
    note: 'EV/EBITDA above 200 and P/E above 500 (null); a Trend 0y row whose 30-day-ago estimate is zero (null); every history estimate zero (no usable quarter: the XLP default, no partial magnitude)',
    ticker: 'KO',
    response: {
      Highlights: { MarketCapitalization: 301234567890, QuarterlyRevenueGrowthYOY: 0.0513, QuarterlyEarningsGrowthYOY: 0.0317, OperatingMarginTTM: 0.2973, GrossProfitTTM: 28123456789, RevenueTTM: 46123456789, ReturnOnAssetsTTM: 0.0913, ReturnOnEquityTTM: 0.4113, DividendYield: 0.0291 },
      Valuation: { EnterpriseValueEbitda: 250.13, TrailingPE: 600.7, PriceSalesTTM: 6.53, PriceBookMRQ: 11.17 },
      Technicals: { '52WeekHigh': 74.38, '52WeekLow': 60.62 },
      Earnings: {
        History: history([[0.77, 0], [0.71, 0], [0.73, 0], [0.88, 0]]),
        Trend: { '2026-12-31': trendRow('0y', '2026-12-31', '3.0100', '0') },
      },
      Financials: {
        Income_Statement: { yearly: { '2025-12-31': { operatingIncome: '13123456789.10', interestExpense: '-1612345678.90', depreciationAndAmortization: '1012345678.30' } } },
        Cash_Flow: { quarterly: quarterly(Q8.slice(-4), (i) => ({ totalCashFromOperatingActivities: String(3123456789.1 + i * 3), capitalExpenditures: String(-512345678.7) })) },
        Balance_Sheet: { yearly: { '2025-12-31': { shortLongTermDebtTotal: '45123456789.00', totalStockholderEquity: '26123456789.00', totalCurrentAssets: '29123456789.00', totalCurrentLiabilities: '25123456789.00', netDebt: '33123456789.00' } } },
      },
      SharesStats: { ShortPercentOfFloat: 0.93, ShortRatio: 2.71 },
    },
  },
  {
    id: 'squeeze-and-odd-debt',
    note: 'short interest above 15% (squeeze watch); a debt field that is not a number with positive equity (debt/equity 0); no interest expense with net cash (coverage 100); no depreciation (EBITDA is operating income); four usable quarters, all beats',
    ticker: 'NVDA',
    response: {
      Highlights: { MarketCapitalization: 4512345678901, QuarterlyRevenueGrowthYOY: 0.6213, QuarterlyEarningsGrowthYOY: 0.6517, OperatingMarginTTM: 0.6137, GrossProfitTTM: 141234567890, RevenueTTM: 187123456789, ReturnOnAssetsTTM: 0.5317, ReturnOnEquityTTM: 1.0913, DividendYield: 0.0003 },
      Valuation: { EnterpriseValueEbitda: 41.37, TrailingPE: 47.13, PriceSalesTTM: 24.17, PriceBookMRQ: 38.71 },
      Technicals: { '52WeekHigh': 212.19, '52WeekLow': 86.62 },
      Earnings: {
        History: history([[1.3, 1.23], [1.05, 1.01], [0.81, 0.73], [0.96, 0.93]]),
        Trend: { '2027-01-31': trendRow('0y', '2027-01-31', '4.6900', '4.5100'), '2028-01-31': trendRow('+1y', '2028-01-31', '7.1300', '6.8700') },
      },
      Financials: {
        Income_Statement: { yearly: { '2026-01-31': { operatingIncome: '123456789012.30' } } },
        Cash_Flow: { quarterly: quarterly(Q8.slice(-4), (i) => ({ totalCashFromOperatingActivities: String(27123456789.3 + i * 1234567.7), capitalExpenditures: String(-1612345678.9) })) },
        Balance_Sheet: { yearly: { '2026-01-31': { shortLongTermDebtTotal: 'n/a', totalStockholderEquity: '118123456789.00', totalCurrentAssets: '127123456789.00', totalCurrentLiabilities: '32123456789.00', netDebt: '-51123456789.00' } } },
      },
      SharesStats: { ShortPercentOfFloat: 15.5, ShortRatio: 0.97 },
    },
  },
  {
    id: 'long-term-debt-only',
    note: 'no total-debt field (long-term debt used); no interest expense with positive net debt (coverage null); gross profit with zero revenue (gross margin and FCF margin null); no market value (FCF yield null)',
    ticker: 'MSFT',
    response: {
      Highlights: { QuarterlyRevenueGrowthYOY: 0.1813, QuarterlyEarningsGrowthYOY: 0.1217, OperatingMarginTTM: 0.4613, GrossProfitTTM: 193123456789, RevenueTTM: 0, ReturnOnAssetsTTM: 0.1713, ReturnOnEquityTTM: 0.3317, DividendYield: 0.0071 },
      Valuation: { EnterpriseValueEbitda: 23.71, TrailingPE: 35.13, PriceSalesTTM: 13.17, PriceBookMRQ: 10.31 },
      Technicals: { '52WeekHigh': 555.45, '52WeekLow': 344.79 },
      Earnings: { History: history([[3.65, 3.67], [3.46, 3.38], [3.23, 3.21], [3.03, 2.94], [3.3, 3.11]]) },
      Financials: {
        Income_Statement: { yearly: { '2025-06-30': { operatingIncome: '128123456789.10', depreciationAndAmortization: '34123456789.70' } } },
        Cash_Flow: { quarterly: quarterly(Q8.slice(-4), (i) => ({ totalCashFromOperatingActivities: String(37123456789.3 + i * 7), capitalExpenditures: String(-19123456789.1) })) },
        Balance_Sheet: { yearly: { '2025-06-30': { longTermDebt: '40123456789.00', totalStockholderEquity: '343123456789.00', totalCurrentAssets: '191123456789.00', totalCurrentLiabilities: '141123456789.00', netDebt: '12123456789.00' } } },
      },
      SharesStats: {},
    },
  },
  {
    id: 'no-balance-sheet-ebit-field',
    note: 'no balance sheet (the four health measures null); the yearly income statement carries ebit, not operatingIncome; a Trend with neither a 0y nor a +1q row (no revision score)',
    ticker: 'PG',
    response: {
      Highlights: { MarketCapitalization: 371234567890, QuarterlyRevenueGrowthYOY: 0.0213, QuarterlyEarningsGrowthYOY: 0.1517, OperatingMarginTTM: 0.2417, GrossProfitTTM: 43123456789, RevenueTTM: 84123456789, DividendYield: 0.0271 },
      Valuation: { EnterpriseValueEbitda: 17.31, TrailingPE: 23.13, PriceSalesTTM: 4.41, PriceBookMRQ: 7.13 },
      Technicals: { '52WeekHigh': 180.43, '52WeekLow': 144.81 },
      Earnings: { History: history([[1.99, 1.9], [1.48, 1.42], [1.54, 1.54], [1.93, 1.88], [1.88, 1.86], [1.52, 1.51]]), Trend: { '2027-06-30': trendRow('+1y', '2027-06-30', '7.3100', '7.1300') } },
      Financials: {
        Income_Statement: { yearly: { '2025-06-30': { ebit: '20123456789.30', interestExpense: '-912345678.10' } } },
        Cash_Flow: { quarterly: quarterly(Q8.slice(-4), () => ({ totalCashFromOperatingActivities: '4123456789.13', capitalExpenditures: '-912345678.31' })) },
      },
      SharesStats: { ShortPercentOfFloat: 0.71 },
    },
  },
  {
    id: 'misses-only',
    note: 'every usable quarter a miss (beat rate 0, positive-surprise magnitude 0); a balance sheet with positive net debt but no yearly income statement (coverage and net debt / EBITDA null; no EBIT for the debt badge)',
    ticker: 'HD',
    response: {
      Highlights: { MarketCapitalization: 381234567890, QuarterlyRevenueGrowthYOY: 0.0613, QuarterlyEarningsGrowthYOY: -0.0213, OperatingMarginTTM: 0.1317, GrossProfitTTM: 54123456789, RevenueTTM: 162123456789, DividendYield: 0.0241 },
      Valuation: { EnterpriseValueEbitda: 19.13, TrailingPE: 26.71, PriceSalesTTM: 2.37, PriceBookMRQ: 61.3 },
      Technicals: { '52WeekHigh': 426.75, '52WeekLow': 326.31 },
      Earnings: { History: history([[3.74, 3.84], [4.58, 4.71], [3.56, 3.6], [3.13, 3.31]]) },
      Financials: { Income_Statement: { yearly: {} }, Balance_Sheet: { yearly: { '2026-02-01': { shortLongTermDebtTotal: '63123456789.00', totalStockholderEquity: '6123456789.00', totalCurrentAssets: '31123456789.00', totalCurrentLiabilities: '28123456789.00', netDebt: '61123456789.00' } } } },
    },
  },
  {
    id: 'cash-flow-gap',
    note: 'a non-numeric value inside the last four quarters of cash flow (no TTM); quarters keyed out of order',
    ticker: 'AMZN',
    response: {
      Highlights: { MarketCapitalization: 2312345678901, QuarterlyRevenueGrowthYOY: 0.1331, QuarterlyEarningsGrowthYOY: 0.3817, OperatingMarginTTM: 0.1137, GrossProfitTTM: 331234567890, RevenueTTM: 691234567890, DividendYield: null },
      Valuation: { EnterpriseValueEbitda: 17.91, TrailingPE: 33.17, PriceSalesTTM: 3.37, PriceBookMRQ: 6.71 },
      Technicals: {},
      Financials: {
        Cash_Flow: {
          quarterly: {
            '2026-06-30': { totalCashFromOperatingActivities: '32123456789.1', capitalExpenditures: '-31123456789.7' },
            '2025-12-31': { totalCashFromOperatingActivities: '45123456789.3', capitalExpenditures: '-27123456789.1' },
            '2026-09-30': { totalCashFromOperatingActivities: 'None', capitalExpenditures: '-34123456789.3' },
            '2026-03-31': { totalCashFromOperatingActivities: '17123456789.7', capitalExpenditures: '-25123456789.9' },
          },
        },
      },
    },
  },
];

/** A failed request (the fetch path throws, as the rankings job's batch loop expects). */
export const GOLDEN_FAILURE = { ticker: 'GLW', status: 404 };

/**
 * One case through the rankings job's own path: fetchSingleFundamental (with `fetch` stubbed to return the made-up
 * response) and then extractMetrics. Returns the encoded request URL, the shaped fundamentals, the metrics and the
 * log lines (their leading ISO timestamp cut). The capture before the move and the test after it both run this.
 */
export async function runGoldenCase(c, { fetchSingleFundamental, extractMetrics }) {
  const urls = [];
  const logs = [];
  const realFetch = globalThis.fetch;
  const realLog = console.log;
  globalThis.fetch = async (url) => { urls.push(String(url)); return { ok: true, status: 200, json: async () => structuredClone(c.response) }; };
  console.log = (...args) => { logs.push(args.map(String).join(' ').replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z /, '')); };
  try {
    const shaped = await fetchSingleFundamental(c.ticker, 'TESTKEY');
    const metrics = extractMetrics(c.ticker, shaped);
    return encodeGolden({ urls, shaped, metrics, logs });
  } finally {
    globalThis.fetch = realFetch;
    console.log = realLog;
  }
}

/** The failed request: the error message the rankings job's batch loop logs. */
export async function runGoldenFailure({ fetchSingleFundamental }) {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: GOLDEN_FAILURE.status, json: async () => ({}) });
  try {
    await fetchSingleFundamental(GOLDEN_FAILURE.ticker, 'TESTKEY');
    return { threw: false };
  } catch (err) {
    return { threw: true, message: err.message };
  } finally {
    globalThis.fetch = realFetch;
  }
}

/**
 * A lossless, order-keeping encoding for the golden: JSON would turn NaN, Infinity and -0 into null or 0 and drop
 * undefined, hiding exactly the slips a moved function could make. Key order is kept as the code produced it.
 */
export function encodeGolden(v) {
  if (v === undefined) return { $: 'undefined' };
  if (typeof v === 'number') {
    if (Number.isNaN(v)) return { $: 'NaN' };
    if (v === Infinity) return { $: 'Infinity' };
    if (v === -Infinity) return { $: '-Infinity' };
    if (Object.is(v, -0)) return { $: '-0' };
    return v;
  }
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(encodeGolden);
  return { $keys: Object.keys(v), ...Object.fromEntries(Object.entries(v).map(([k, x]) => [`=${k}`, encodeGolden(x)])) };
}
