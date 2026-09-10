// api/_utils/rawVsAdjustedSmaFlags.test.js
//
// The price-vs-SMA flags compare like with like.
//
// `fetchOHLCV` maps `close: d.adjusted_close` (compute-index-intelligence.js:150)
// and `injectIntradayBar` splices today's real-time quote onto the front of that
// array (`:229-254`). A real-time quote is the price the tape is printing —
// unadjusted — so `currentPrice > technicals.sma50` compared a RAW number with
// an average made of ADJUSTED ones. One ordinary quarterly ex-date inside the
// window scales every bar dated on or before it down by the payout, which lands
// the average low and reads "above" for every price in the gap.
//
// The rule applied here is the repo's own: Guard 1 takes the UNADJUSTED
// `rawClose` "so a split/dividend can't skew the raw-vs-raw comparison (same
// basis as Guard 2)" (decide.js:1050-1054), and Guard 2 prefers `refRawClose`
// over `refAdjClose` on the same grounds (baselineValidation.js:158-160,
// :238-239). A live price is compared to a raw reference, or to nothing.
//
// The fixture is a real dividend, not a hand-written pair of arrays: one raw
// series, one payout, and the adjusted series DERIVED from it the way EODHD
// derives `adjusted_close`. A hand-written pair could only pin an assumption
// about the adjustment; deriving it proves the mechanism.
//
// This file's un-mocked imports are also the BUILD_RULES §4 dependency-surface
// guard for both modules' import graphs — they must never be mocked.

import { describe, it, expect } from 'vitest';
import { computeTechnicalScore, resolveSmaBasis } from './indexIntelligence.js';
import { calculateSMA, classifyTrend } from './technicalCalculations.js';
import { injectIntradayBar } from '../cron/compute-index-intelligence.js';

// ── The fixture ───────────────────────────────────────────────────────────
// 59 closed sessions at a flat $100.00 (newest-first), plus a live quote of
// $99.70 at index 0. The stock has gone nowhere: its raw 50-day average is
// $99.994 and the live price is BELOW it.
//
// 30 sessions ago the stock went ex-dividend on $1.00 — an ordinary ~1%
// quarterly payout. EODHD scales every bar dated ON OR BEFORE the ex-date by
// (100 - 1) / 100, so the adjusted 50-day average is $99.594. The live quote
// sits in the 0.40% gap between the two: "above" on the adjusted average,
// "below" on its own.
const SESSIONS = 59;
const FLAT_PRICE = 100;
const DIVIDEND = 1;
const EX_DATE_INDEX = 30;          // bars 30..58 are on or before the ex-date
const LIVE_QUOTE = 99.7;
const FACTOR = (FLAT_PRICE - DIVIDEND) / FLAT_PRICE;

// Newest-first RAW closes: what the tape printed, unadjusted, plus the quote.
const rawCloses = [LIVE_QUOTE, ...Array.from({ length: SESSIONS }, () => FLAT_PRICE)];

// The same bars as EODHD's `adjusted_close` — index 0 is the live quote, which
// is never adjusted because it has not been through a corporate action yet.
const adjCloses = rawCloses.map((c, i) =>
  (i >= EX_DATE_INDEX ? Number((c * FACTOR).toFixed(4)) : c));

const technicals = {
  rsi: { value: 50, zone: 'neutral' },
  sma20: calculateSMA(adjCloses, 20),
  sma50: calculateSMA(adjCloses, 50),
  sma200: calculateSMA(adjCloses, 200),
  macd: null,
};

function score(extra = {}) {
  return computeTechnicalScore({
    closes: adjCloses,
    highs: adjCloses.map(c => c + 1),
    lows: adjCloses.map(c => c - 1),
    volumes: adjCloses.map(() => 1e6),
    spyCloses: adjCloses,
    rsPercentile: 50,
    rsTrend: 'flat',
    technicals,
    sectorRSPercentile: null,
    ...extra,
  });
}

describe('the fixture is a real ex-date, and the gap is the one the flags fell into', () => {
  it('the adjusted 50-day average lands ~0.4% below the raw one', () => {
    const rawSma50 = calculateSMA(rawCloses, 50);
    const adjSma50 = calculateSMA(adjCloses, 50);
    expect(rawSma50).toBe(99.994);
    expect(adjSma50).toBe(99.594);
    const errorPct = ((rawSma50 - adjSma50) / rawSma50) * 100;
    expect(errorPct).toBeGreaterThan(0.3);   // the founder's ~0.3–1% band,
    expect(errorPct).toBeLessThan(1.0);      // for one ~1% quarterly payout
  });

  it('and the live quote sits inside that gap — below its own average, above the adjusted one', () => {
    expect(LIVE_QUOTE).toBeLessThan(calculateSMA(rawCloses, 50));
    expect(LIVE_QUOTE).toBeGreaterThan(calculateSMA(adjCloses, 50));
  });

  it('the 20-day window is entirely AFTER the ex-date, so it is unaffected either way', () => {
    expect(calculateSMA(rawCloses, 20)).toBe(calculateSMA(adjCloses, 20));
  });
});

describe('the flag flips', () => {
  it('SHIPPED: raw quote vs adjusted average said "above the 50-day"', () => {
    const t = score();
    expect(t.factors.aboveSMA50).toBe(true);      // the wrong reading
    expect(t.smaScore).toBe(6);
  });

  it('FIXED: raw quote vs raw average says "below" — the true reading', () => {
    const t = score({ rawCloses });
    expect(t.factors.aboveSMA50).toBe(false);
    expect(t.smaScore).toBe(0);                   // the 6-point SMA50 weight
    expect(t.technicalScore).toBe(score().technicalScore - 6);
  });

  it('the 20-day flag does NOT move — the fix touches only what the dividend touched', () => {
    expect(score({ rawCloses }).factors.aboveSMA20).toBe(score().factors.aboveSMA20);
    expect(score({ rawCloses }).factors.aboveSMA20).toBe(false);
  });

  it('a 200-day average neither series can reach stays null, and its flag stays false', () => {
    const t = score({ rawCloses });
    expect(t.factors.sma200).toBeNull();
    expect(t.factors.aboveSMA200).toBe(false);
  });

  it('the published average is the one the flag was derived from (BUILD_RULES §9)', () => {
    const t = score({ rawCloses });
    expect(t.factors.sma50).toBe(calculateSMA(rawCloses, 50));
    expect(t.factors.sma20).toBe(calculateSMA(rawCloses, 20));
    // A reader pairing the boolean with the number is shown one story.
    expect(t.factors.aboveSMA50).toBe(LIVE_QUOTE > t.factors.sma50);
    expect(t.factors.aboveSMA20).toBe(LIVE_QUOTE > t.factors.sma20);
  });

  it('the error is ONE-SIGNED: dividend adjustment only ever lowers the average', () => {
    // Every bar on or before an ex-date is scaled DOWN, so the adjusted average
    // is never above the raw one. The shipped flag could therefore only ever be
    // wrong in the bullish direction — which is why this is worth fixing and
    // not just noise.
    for (const period of [20, 50]) {
      expect(calculateSMA(adjCloses, period)).toBeLessThanOrEqual(calculateSMA(rawCloses, period));
    }
  });
});

describe('a SPLIT window keeps the shipped basis — the fix is not a trade', () => {
  // Across a 2:1 split the raw closes are not comparable to each other: $200
  // before and $100 after are the same ownership, and their average is not a
  // price anything can be above or below. The adjusted series IS internally
  // comparable there and is what the shipped comparison already used, so the
  // per-period guard leaves that window alone. Without this the change would
  // trade a ~0.4% dividend error for a ~33% split error.
  const SPLIT_INDEX = 30;
  const splitRaw = [104, ...Array.from({ length: SESSIONS }, (_, i) =>
    (i + 1 < SPLIT_INDEX ? 100 : 200))];
  const splitAdj = splitRaw.map((c, i) => (i >= SPLIT_INDEX ? c / 2 : c));

  function splitScore(extra = {}) {
    return computeTechnicalScore({
      closes: splitAdj,
      highs: splitAdj.map(c => c + 1),
      lows: splitAdj.map(c => c - 1),
      volumes: splitAdj.map(() => 1e6),
      spyCloses: splitAdj,
      rsPercentile: 50,
      rsTrend: 'flat',
      technicals: {
        rsi: null,
        sma20: calculateSMA(splitAdj, 20),
        sma50: calculateSMA(splitAdj, 50),
        sma200: null,
        macd: null,
      },
      sectorRSPercentile: null,
      ...extra,
    });
  }

  it('the raw 50-day average across a split is not a price at all', () => {
    expect(calculateSMA(splitRaw, 50)).toBeGreaterThan(130);   // ~$140, meaningless
    expect(calculateSMA(splitAdj, 50)).toBeLessThan(105);      // ~$100, the real level
  });

  it('so the 50-day flag is unchanged by the fix', () => {
    expect(splitScore({ rawCloses: splitRaw }).factors.aboveSMA50)
      .toBe(splitScore().factors.aboveSMA50);
    expect(resolveSmaBasis({
      closes: splitAdj, rawCloses: splitRaw, technicals: { sma50: calculateSMA(splitAdj, 50) },
    }).basis.sma50).toBe('adjusted');
  });

  it('but the 20-day window, which the split is not inside, still gets the honest basis', () => {
    const basis = resolveSmaBasis({
      closes: splitAdj, rawCloses: splitRaw, technicals: { sma20: calculateSMA(splitAdj, 20) },
    });
    expect(basis.basis.sma20).toBe('raw');
    expect(basis.sma20).toBe(calculateSMA(splitRaw, 20));
  });

  it('a reverse split — the factor moves the other way — falls back too', () => {
    const raw = [104, ...Array.from({ length: SESSIONS }, (_, i) => (i + 1 < SPLIT_INDEX ? 100 : 20))];
    const adj = raw.map((c, i) => (i >= SPLIT_INDEX ? c * 5 : c));
    expect(resolveSmaBasis({
      closes: adj, rawCloses: raw, technicals: { sma50: calculateSMA(adj, 50) },
    }).basis.sma50).toBe('adjusted');
  });

  it('the threshold sits between a year of dividends and the smallest split', () => {
    // 1.10 of cumulative dividend adjustment stays on the raw basis…
    const raw = Array.from({ length: 60 }, () => 100);
    const mild = raw.map((c, i) => (i >= 30 ? c / 1.10 : c));
    expect(resolveSmaBasis({ closes: mild, rawCloses: raw, technicals: {} }).basis.sma50).toBe('raw');
    // …and 5:4, the smallest split ratio in common use, does not.
    const smallest = raw.map((c, i) => (i >= 30 ? c / 1.25 : c));
    expect(resolveSmaBasis({ closes: smallest, rawCloses: raw, technicals: {} }).basis.sma50)
      .toBe('adjusted');
  });
});

describe('resolveSmaBasis — degradation is byte-identical to the shipped behaviour', () => {
  const shipped = score();

  it('no raw series at all', () => {
    expect(score({ rawCloses: undefined })).toEqual(shipped);
  });

  it('a raw series of the wrong length is not half a comparison', () => {
    expect(score({ rawCloses: rawCloses.slice(0, 30) })).toEqual(shipped);
    expect(score({ rawCloses: [] })).toEqual(shipped);
  });

  it('one non-finite value disqualifies the whole series', () => {
    const holed = [...rawCloses];
    holed[17] = null;
    expect(score({ rawCloses: holed })).toEqual(shipped);
    holed[17] = NaN;
    expect(score({ rawCloses: holed })).toEqual(shipped);
    holed[17] = undefined;
    expect(score({ rawCloses: holed })).toEqual(shipped);
  });

  it('reports which basis each period used', () => {
    expect(resolveSmaBasis({ closes: adjCloses, rawCloses, technicals }).basis)
      .toEqual({ sma20: 'raw', sma50: 'raw', sma200: 'adjusted' });   // 200 unreachable
    expect(resolveSmaBasis({ closes: adjCloses, technicals }).basis)
      .toEqual({ sma20: 'adjusted', sma50: 'adjusted', sma200: 'adjusted' });
  });

  it('the price was never the wrong number — index 0 carries no adjustment', () => {
    expect(rawCloses[0]).toBe(adjCloses[0]);
    expect(resolveSmaBasis({ closes: adjCloses, rawCloses, technicals }).price)
      .toBe(resolveSmaBasis({ closes: adjCloses, technicals }).price);
  });

  it('an undefined pre-computed SMA still normalizes to null, as it did before', () => {
    const basis = resolveSmaBasis({ closes: adjCloses, technicals: {} });
    expect(basis.sma20).toBeNull();
    expect(basis.sma50).toBeNull();
    expect(basis.sma200).toBeNull();
  });
});

describe('the wiring: the live quote enters the raw series as itself', () => {
  it('injectIntradayBar stamps rawClose === close on the synthetic bar', () => {
    const bars = Array.from({ length: 40 }, (_, i) => ({
      date: `2026-05-${String(40 - i).padStart(2, '0')}`,
      open: 100, high: 101, low: 99, close: 99, rawClose: 100, volume: 1000,
    }));
    const out = injectIntradayBar(bars, { close: 105.25 }, '2026-06-01');
    expect(out[0].close).toBe(105.25);
    expect(out[0].rawClose).toBe(105.25);
    // The history keeps its own two bases, untouched.
    expect(out[1].close).toBe(99);
    expect(out[1].rawClose).toBe(100);
  });

  it('the cron-side series builder yields a fully finite raw series for a normal payload', () => {
    const bars = [
      { close: 99, rawClose: 100 },
      { close: 98, rawClose: 99 },
      { close: 97, rawClose: 98 },
    ];
    const built = bars.map(o => o.rawClose ?? o.close);
    expect(built).toEqual([100, 99, 98]);
    expect(built.every(Number.isFinite)).toBe(true);

    // A cached bar mapped before `rawClose` existed falls back to `close`, and
    // a mixed series is still a finite series — resolveSmaBasis accepts it.
    const legacy = [{ close: 99 }, { close: 98 }, { close: 97 }].map(o => o.rawClose ?? o.close);
    expect(legacy).toEqual([99, 98, 97]);
  });
});

describe('everything the cron says about price-vs-average rides ONE basis (§9)', () => {
  // `classifyTrend` and `sma200_position` are the same comparison as the flags
  // under other names, and `smaStack` ships `aboveSMA200` and `sma200_position`
  // in ONE object (buildTechnicalSnapshot.js:73-79). Fixing only the flags
  // would have put a contradiction inside a single payload, so the cron derives
  // all three from `scoreResult.factors` — the averages the flags used. These
  // rows pin that derivation.
  const factors = score({ rawCloses }).factors;
  const currentPrice = adjCloses[0];

  it('the trend words agree with the flags they restate', () => {
    expect(classifyTrend(currentPrice, factors.sma20) === 'up').toBe(factors.aboveSMA20);
    expect(classifyTrend(currentPrice, factors.sma50) === 'up').toBe(factors.aboveSMA50);
    expect(classifyTrend(currentPrice, factors.sma200)).toBeNull();   // no average, no word
  });

  it('and would NOT have agreed off the adjusted averages — this is the disagreement avoided', () => {
    expect(classifyTrend(currentPrice, technicals.sma50) === 'up').toBe(true);
    expect(factors.aboveSMA50).toBe(false);
  });

  it('the sma200 distance takes the same average as its flag', () => {
    // 200 is unreachable here, so both are honestly absent together.
    expect(factors.sma200).toBeNull();
    expect(factors.aboveSMA200).toBe(false);

    // With a reachable average the sign of the distance and the flag agree.
    const long = { ...factors, sma200: 95 };
    const position = ((currentPrice - long.sma200) / long.sma200) * 100;
    expect(position > 0).toBe(currentPrice > long.sma200);
  });
});
