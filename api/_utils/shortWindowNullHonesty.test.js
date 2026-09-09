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
// This file's un-mocked import of each module under test is also the
// BUILD_RULES §4 dependency-surface guard for those modules' import graphs.

import { describe, it, expect } from 'vitest';
import { calculateAllIndicators } from './technicalCalculations.js';
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
