// api/_utils/shortWindowNullHonesty.test.js
//
// D-120, the null-honest half — one battery, four renderers, two windows.
//
// `calculateMACD` needs `slow + signal` = 35 candles (technicalCalculations.js:195)
// and `calculateSMA(closes, 50)` needs 50 (`:20`). Below those minimums
// `calculateAllIndicators` returns NULL for `macd`, `sma.sma50` and `ema.ema50`,
// and BUILD_RULES §9 says a displayed claim comes from what was actually
// computed — so every renderer that reads those fields must render NOTHING for
// them. Never a sign word off a `{ histogram: 0 }` default ("negative"), never
// "N/A" standing in for a value, never a bearish trend sentence derived from an
// absent SMA flag, never the literal "undefined".
//
// The two windows are the whole design: a 30-candle window (below both
// minimums) and a 60-candle window (above both). Every row runs REAL candles
// through the REAL `calculateAllIndicators` — no hand-written null fixture can
// prove the minimums, only pin an assumption about them.
//
// The last describe block is D-120's OTHER half: the window the platform
// actually requests. Rendering nothing is only honest while there is nothing to
// render — once the fetch clears MACD's minimum the same renderers must print
// the real reading, and these rows pin the fetch that makes that true.
//
// This file's un-mocked import of each module under test is also the
// BUILD_RULES §4 dependency-surface guard for those modules' import graphs.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calculateAllIndicators } from './technicalCalculations.js';
import { fetchDailyOHLCV, DAILY_WINDOW_CALENDAR_DAYS } from './marketDataCache.js';
import { composeTechnicals } from './researchCard.js';
import { buildPortfolioBriefsBlock, buildBenchBriefsBlock } from './voiceLayerPrompt.js';
import { buildPortfolioBriefs } from '../cron/voice-layer-cache.js';
import { composeTechnicalSnapshot } from '../agent/debate.js';

// A deterministic, gently trending OHLCV series, newest-first — the order
// `calculateAllIndicators` documents. The wobble keeps ATR, Bollinger and the
// volume profile non-degenerate so a short window fails ONLY on the minimums
// under test, never on flat data.
function candles(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const close = 100 + (n - i) * 0.4 + Math.sin(i / 3) * 1.5;
    out.push({
      date: new Date(Date.UTC(2026, 0, 1) + (n - i) * 86400000).toISOString().slice(0, 10),
      open: close - 0.2,
      high: close + 1.1,
      low: close - 1.1,
      close: Number(close.toFixed(4)),
      volume: 5_000_000 + (i % 7) * 250_000,
    });
  }
  return out;
}

const SHORT = calculateAllIndicators(candles(30));  // below MACD's 35 and SMA50's 50
const LONG = calculateAllIndicators(candles(60));   // above both
const QUOTE = 151.27;

describe('the two windows — what calculateAllIndicators actually returns', () => {
  it('30 candles: MACD and the SMA50/EMA50 fields are NULL, the rest computed', () => {
    expect(SHORT.dataPoints).toBe(30);
    expect(SHORT.macd).toBeNull();
    expect(SHORT.sma.sma50).toBeNull();
    expect(SHORT.sma.sma200).toBeNull();
    expect(SHORT.ema.ema50).toBeNull();
    // Not a dead series — the shorter-minimum indicators are all present, so a
    // renderer that drops MACD/SMA50 is dropping those and nothing else.
    expect(SHORT.rsi.value).toEqual(expect.any(Number));
    expect(SHORT.sma.sma20).toEqual(expect.any(Number));
    expect(SHORT.atr.percent).toEqual(expect.any(Number));
  });

  it('60 candles: MACD and SMA50 are computed', () => {
    expect(LONG.dataPoints).toBe(60);
    expect(LONG.macd.macd).toEqual(expect.any(Number));
    expect(LONG.macd.signal).toEqual(expect.any(Number));
    expect(LONG.macd.histogram).toEqual(expect.any(Number));
    expect(LONG.sma.sma50).toEqual(expect.any(Number));
    expect(LONG.ema.ema50).toEqual(expect.any(Number));
  });

  it('35 and 50 are the exact minimums — one candle either side flips each', () => {
    expect(calculateAllIndicators(candles(34)).macd).toBeNull();
    expect(calculateAllIndicators(candles(35)).macd).not.toBeNull();
    expect(calculateAllIndicators(candles(49)).sma.sma50).toBeNull();
    expect(calculateAllIndicators(candles(50)).sma.sma50).toEqual(expect.any(Number));
  });
});

describe('debate.js — composeTechnicalSnapshot', () => {
  it('30-day window: no MACD segment, no SMA50 segment, no "negative", no "N/A"', () => {
    const out = composeTechnicalSnapshot(SHORT, QUOTE);
    expect(out).not.toContain('MACD');
    expect(out).not.toContain('SMA50');
    expect(out).not.toContain('negative');
    expect(out).not.toContain('N/A');
    expect(out).not.toContain('undefined');
    // What IS computed still renders.
    expect(out).toContain('RSI(14):');
    expect(out).toContain('Above SMA20:');
    expect(out).toContain('ATR:');
  });

  it('60-day window: the MACD and SMA50 segments appear, from the real readings', () => {
    const out = composeTechnicalSnapshot(LONG, QUOTE);
    expect(out).toContain('MACD histogram:');
    expect(out).toContain('Above SMA50:');
    // §9: the sign word agrees with the number it was derived from.
    const sign = LONG.macd.histogram > 0 ? 'positive' : LONG.macd.histogram < 0 ? 'negative' : 'flat';
    expect(out).toContain(`MACD histogram: ${sign}`);
    expect(out).toContain(`Above SMA50: ${QUOTE > LONG.sma.sma50}`);
  });

  it('an exactly-flat histogram reads "flat" — zero is not negative', () => {
    const flat = { ...LONG, macd: { macd: 1.2, signal: 1.2, histogram: 0 } };
    expect(composeTechnicalSnapshot(flat, QUOTE)).toContain('MACD histogram: flat');
  });

  it('no quote ⇒ no "Above SMAn" claim at all (never one derived from a price of 0)', () => {
    const out = composeTechnicalSnapshot(LONG, null);
    expect(out).not.toContain('Above SMA');
    expect(out).toContain('RSI(14):');
  });

  it('nothing computed ⇒ null, so the caller omits the whole block', () => {
    expect(composeTechnicalSnapshot(null, QUOTE)).toBeNull();
    expect(composeTechnicalSnapshot({}, QUOTE)).toBeNull();
    expect(composeTechnicalSnapshot({ rsi: null, macd: null, sma: {}, atr: null }, null)).toBeNull();
  });
});

describe('the research card — composeTechnicals', () => {
  const price = { current: QUOTE, candleDate: '2026-09-08' };

  it('30-day window: no MACD fact, no SMA50 fact, no placeholder', () => {
    const facts = composeTechnicals(SHORT, price).facts.join('\n');
    expect(facts).not.toContain('MACD');
    expect(facts).not.toContain('SMA50');
    expect(facts).not.toContain('EMA50');
    expect(facts).not.toContain('N/A');
    expect(facts).not.toContain('negative');
    expect(facts).toMatch(/^RSI /m);
    expect(facts).toMatch(/^SMA20 /m);
  });

  it('60-day window: MACD and SMA50 facts carry the real values', () => {
    const facts = composeTechnicals(LONG, price).facts;
    expect(facts).toContain(`MACD ${LONG.macd.macd} · signal ${LONG.macd.signal} · histogram ${LONG.macd.histogram}`);
    expect(facts).toContain(`SMA50 ${LONG.sma.sma50}`);
  });
});

// The cron's own writer, then the prompt renderer that reads what it wrote —
// the pair is the point: a brief that omits a summary must produce a prompt
// with no line, not "Trend: undefined".
describe('the voice-layer cache briefs — buildPortfolioBriefs → buildPortfolioBriefsBlock', () => {
  const priceMap = { NVDA: { close: 151.27, previousClose: 149.0, change_p: 1.52 } };
  const portfolio = { core: [{ symbol: 'NVDA', tier: 'core', baseATR: 0 }] };

  // What a symbol looks like when its window never reached the SMA/MACD
  // minimums: the rankings row exists, the technical-score doc does not.
  const NO_TECH = {};
  const FULL_TECH = {
    NVDA: {
      technicalScore: 74,
      rsiContext: 9,
      macdScore: 12,
      volumeConfirmation: 12,
      factors: {
        aboveSMA20: true, aboveSMA50: true, aboveSMA200: true,
        rsPercentile: 82, upDayVolRatio: 1.8,
      },
    },
  };

  function build(techScoresMap) {
    return buildPortfolioBriefs(portfolio, priceMap, { NVDA: { technicalRank: 3 } }, techScoresMap, {}, {}, {});
  }

  it('no SMA/MACD readings ⇒ the brief carries NO trendSummary and NO momentumSummary', () => {
    const [brief] = build(NO_TECH);
    expect(brief.symbol).toBe('NVDA');
    expect('trendSummary' in brief).toBe(false);
    expect('momentumSummary' in brief).toBe(false);
    // The defect this replaces: a bearish sentence and a volume verdict
    // invented from `{}`.
    expect(JSON.stringify(brief)).not.toContain('Downtrend');
    expect(JSON.stringify(brief)).not.toContain('Volume subdued');
  });

  it('and the prompt block renders neither line — never "Trend: undefined"', () => {
    const out = buildPortfolioBriefsBlock({ portfolioBriefs: build(NO_TECH) });
    expect(out).toContain('NVDA');
    expect(out).not.toContain('Trend:');
    expect(out).not.toContain('Momentum:');
    expect(out).not.toContain('undefined');
  });

  it('with the readings present, both lines render exactly as before', () => {
    const [brief] = build(FULL_TECH);
    expect(brief.trendSummary).toBe('Strong uptrend. Above all major SMAs. RS vs SPY rising.');
    expect(brief.momentumSummary).toBe('RSI healthy, not extended. MACD expanding. Volume 1.8x avg.');

    const out = buildPortfolioBriefsBlock({ portfolioBriefs: build(FULL_TECH) });
    expect(out).toContain('Trend: Strong uptrend. Above all major SMAs. RS vs SPY rising.');
    expect(out).toContain('Momentum: RSI healthy, not extended. MACD expanding. Volume 1.8x avg.');
  });

  it('the portfolio path now matches the bench path it was diverging from', () => {
    const briefs = build(NO_TECH);
    const asPortfolio = buildPortfolioBriefsBlock({ portfolioBriefs: briefs });
    const asBench = buildBenchBriefsBlock({ benchBriefs: briefs });
    for (const out of [asPortfolio, asBench]) {
      expect(out).not.toContain('Trend:');
      expect(out).not.toContain('Momentum:');
    }
  });
});

// ============================================================================
// D-120, the fetch-widening half
// ============================================================================

// `getStockAnalysisData` reaches EODHD for `daily` through exactly one call
// site, and the technicals path computes over whatever that call returns
// (marketDataCache.js `fetchTechnicals`; api/agent/research.js and
// api/agent/debate.js call `calculateAllIndicators` on it themselves). So the
// window in this URL is the window every MACD in the product is computed over.
describe('the daily window getStockAnalysisData requests', () => {
  const ORIGINAL_KEY = process.env.EODHD_API_KEY;
  const DAY_MS = 86_400_000;

  beforeEach(() => { process.env.EODHD_API_KEY = 'test-token'; });
  afterEach(() => {
    if (ORIGINAL_KEY === undefined) delete process.env.EODHD_API_KEY;
    else process.env.EODHD_API_KEY = ORIGINAL_KEY;
    vi.unstubAllGlobals();
  });

  // Weekdays in the inclusive span [from, from + windowDays]. The NYSE closes
  // on at most 10 days in a WHOLE year, so a span with W weekdays trades on at
  // least W - 10 days no matter where in the calendar it falls — no holiday
  // table needed, and no seasonal hole for the guarantee to fall through.
  function weekdaysInWindow(startUtcMs, windowDays) {
    let n = 0;
    for (let i = 0; i <= windowDays; i++) {
      const day = new Date(startUtcMs + i * DAY_MS).getUTCDay();
      if (day !== 0 && day !== 6) n++;
    }
    return n;
  }

  const MACD_MIN_CANDLES = 35;   // technicalCalculations.js:195, slow + signal
  const MAX_MARKET_HOLIDAYS_PER_YEAR = 10;

  it('the fetch asks EODHD for DAILY_WINDOW_CALENDAR_DAYS back — the URL, not the intent', async () => {
    const fetchSpy = vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) }));
    vi.stubGlobal('fetch', fetchSpy);

    await fetchDailyOHLCV('AAPL.US', 'test-token');

    const url = fetchSpy.mock.calls[0][0];
    const from = /[?&]from=(\d{4}-\d{2}-\d{2})/.exec(url)?.[1];
    expect(from).toBeTruthy();

    const expected = new Date();
    expected.setDate(expected.getDate() - DAILY_WINDOW_CALENDAR_DAYS);
    expect(from).toBe(expected.toISOString().split('T')[0]);
    expect(url).toContain('period=d');
    expect(url).toContain('order=d');
  });

  it('that window clears MACD\'s 35-candle minimum from EVERY start date in a year', () => {
    const start = Date.UTC(2026, 0, 1);
    let worst = Infinity;
    for (let d = 0; d < 365; d++) {
      const weekdays = weekdaysInWindow(start + d * DAY_MS, DAILY_WINDOW_CALENDAR_DAYS);
      worst = Math.min(worst, weekdays - MAX_MARKET_HOLIDAYS_PER_YEAR);
    }
    expect(worst).toBeGreaterThanOrEqual(MACD_MIN_CANDLES);
    // And with room — a window that only just clears would flicker whenever a
    // holiday cluster lands inside it.
    expect(worst).toBeGreaterThanOrEqual(MACD_MIN_CANDLES + 10);
  });

  it('the SHIPPED 30-day window did not — the guarantee is this constant, not arithmetic that any value passes', () => {
    const start = Date.UTC(2026, 0, 1);
    let best = -Infinity;
    for (let d = 0; d < 365; d++) {
      best = Math.max(best, weekdaysInWindow(start + d * DAY_MS, 30));
    }
    // Even at its most generous, and even with ZERO holidays, 30 calendar days
    // never reaches 35 trading days. This is why MACD was null for everyone.
    expect(best).toBeLessThan(MACD_MIN_CANDLES);
  });

  it('MACD IS COMPUTED on what the widened fetch returns — the whole point of D-120', async () => {
    // An EODHD `/eod/` response for the requested range: every weekday from
    // `from` to today, in the newest-first order the URL asks for.
    const rows = [];
    const today = new Date();
    for (let i = 0; i <= DAILY_WINDOW_CALENDAR_DAYS; i++) {
      const d = new Date(today.getTime() - i * DAY_MS);
      if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;
      const close = 100 + i * 0.3 + Math.sin(i / 4);
      rows.push({
        date: d.toISOString().split('T')[0],
        open: close - 0.3, high: close + 1, low: close - 1,
        close, adjusted_close: close, volume: 4_000_000 + (i % 5) * 100_000,
      });
    }
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      ok: true, status: 200, json: () => Promise.resolve(rows),
    })));

    const daily = await fetchDailyOHLCV('AAPL.US', 'test-token');
    expect(daily.length).toBeGreaterThanOrEqual(MACD_MIN_CANDLES);

    const indicators = calculateAllIndicators(daily);
    expect(indicators.macd).not.toBeNull();
    expect(indicators.macd.macd).toEqual(expect.any(Number));
    expect(indicators.macd.signal).toEqual(expect.any(Number));
    expect(indicators.macd.histogram).toEqual(expect.any(Number));
    // SMA50/EMA50 clear their 50-candle minimum on this window too; SMA200
    // needs ~290 calendar days and stays honestly null.
    expect(indicators.sma.sma50).toEqual(expect.any(Number));
    expect(indicators.ema.ema50).toEqual(expect.any(Number));
    expect(indicators.sma.sma200).toBeNull();

    // And the renderers now have something true to say.
    expect(composeTechnicalSnapshot(indicators, 151.27)).toContain('MACD histogram:');
    expect(composeTechnicals(indicators, { current: 151.27, candleDate: daily[0].date }).facts.join('\n'))
      .toContain('MACD ');
  });
});
