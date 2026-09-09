// api/_utils/researchCard.test.js
//
// Phase C §2 / §3 (D-117, D-119) — the code-composed card.
//
// The rules under test are the honesty rules: null-honest indicators (hazard 1
// — the MACD constant is never a line here), a DATE on every section and never
// a cadence word (hazard 13), the platform-data label carried BY THE CARD (Sol
// C-4), and nothing forward-looking anywhere in the output.
//
// This file's import of the module under test is the BUILD_RULES §4
// dependency-surface guard for its api → src imports. Never mock it.

import { describe, it, expect } from 'vitest';
import {
  composeResearchCard,
  composeTechnicals,
  composeFundamentals,
  composeStanding,
} from './researchCard.js';
import { UNIVERSE_PLACE } from '../../src/data/battleUniverse.js';
import { PLATFORM_DATA_LABEL, RESEARCH_EYEBROW } from '../../src/data/decisionRecord.js';

// The shape `calculateAllIndicators` returns on a 30-calendar-day window: RSI,
// SMA20, EMA12/26, Bollinger, ATR and volume present; MACD, SMA50, SMA200 and
// EMA50 NULL, because the window never reaches their minimums.
const SHORT_WINDOW = {
  calculatedAt: '2026-09-09T13:00:00.000Z',
  dataPoints: 21,
  rsi: { value: 62.4, zone: 'neutral' },
  macd: null,
  sma: { sma20: 148.2, sma50: null, sma200: null },
  ema: { ema12: 149.1, ema26: 146.7, ema50: null },
  bollingerBands: { upper: 155.1, middle: 148.2, lower: 141.3, bandwidth: 9.3, percentB: 0.61 },
  atr: { value: 3.2, percent: 2.14, regime: 'normal' },
  volumeProfile: { ratio: 1.32, currentVolume: 9e6, avgVolume: 68e5, tier: 'elevated' },
};

// The ROUTE's composed quote: the cache brief's 15-minute price at the cache
// doc's vintage. The close-fallback shape carries `fromClose` instead.
const QUOTE = { current: 151.27, asOf: '2026-09-11T20:00:00.000Z', candleDate: '2026-09-08' };

const MIRROR = {
  trailingPE: { value: 14.2, sectorMedian: 19.6 },
  priceBookMRQ: 1.83,
  revenueGrowthPct: 7.4,
  marketCapClass: 'large',
  earningsRevisions30d: 2.1,
  beatRate: 75,
  surpriseMagPercentile: 68,
  computedAt: Date.UTC(2026, 8, 5, 15, 0, 0),
};

describe('technicals — null-honest (hazard 1 / C-20)', () => {
  const section = composeTechnicals(SHORT_WINDOW, QUOTE);

  it('renders the indicators the platform actually computed', () => {
    expect(section.facts).toContain('RSI 62.4 · neutral');
    expect(section.facts).toContain('Last $151.27');
    expect(section.facts).toContain('SMA20 148.2');
    expect(section.facts).toContain('ATR 2.14% · normal');
    expect(section.facts).toContain('Volume 1.32× · ELEVATED');
    expect(section.facts).toContain('Bollinger 141.3–155.1 · %B 0.61');
  });

  it('renders NOTHING for a null indicator — no line, no placeholder, no N/A', () => {
    const joined = section.facts.join(' | ');
    expect(joined).not.toMatch(/MACD/);
    expect(joined).not.toMatch(/SMA50|SMA200|EMA50/);
    expect(joined).not.toMatch(/N\/A|null|undefined|negative/);
  });

  it('the quote time carries a WEEKDAY and a zone, not a bare hour (review A-3)', () => {
    // Persisted in the tape and re-read days later: a Friday close must never
    // read as "this afternoon" on a Sunday.
    expect(section.label).toBe('Technicals · last quote Fri 4:00 PM ET · daily indicators as of Sep 8');
    expect(section.label).not.toMatch(/last quote \d{1,2}:\d{2} [AP]M ·/);
  });

  it('a close-derived quote says so and drops the quote time it does not have', () => {
    const s = composeTechnicals(SHORT_WINDOW, { current: 149.5, fromClose: true, candleDate: '2026-09-08' });
    expect(s.facts).toContain('Last $149.50 · daily close');
    expect(s.label).toBe('Technicals · daily indicators as of Sep 8');
  });

  it('a ZERO price is the cache’s no-data sentinel, not a quote (review A-7a)', () => {
    const s = composeTechnicals(SHORT_WINDOW, { current: 0, candleDate: '2026-09-08' });
    expect(s.facts.join(' ')).not.toMatch(/Last/);
    expect(s.facts.join(' ')).not.toMatch(/\$0\.00/);
  });

  it('the ZONE WORD is derived from the number the card PRINTS (BUILD_RULES §9, review A-5)', () => {
    // calculateRSI rounds `value` to 2dp but derives `zone` from the RAW value,
    // so a raw 69.9997 arrives as { value: 70, zone: 'neutral' } — the card
    // would print the overbought threshold beside the neutral word.
    const boundary = { ...SHORT_WINDOW, rsi: { value: 70, zone: 'neutral' } };
    expect(composeTechnicals(boundary, QUOTE).facts).toContain('RSI 70 · overbought');
    // Same class, the other two indicators: `calculateATR` derives `regime` and
    // `calculateVolumeProfile` derives `tier` from their raw values too.
    const atr = { ...SHORT_WINDOW, atr: { value: 3, percent: 3.01, regime: 'normal' } };
    expect(composeTechnicals(atr, QUOTE).facts).toContain('ATR 3.01% · high');
    const vol = { ...SHORT_WINDOW, volumeProfile: { ratio: 1.25, tier: 'NORMAL' } };
    expect(composeTechnicals(vol, QUOTE).facts).toContain('Volume 1.25× · ELEVATED');
  });

  it('prints the CANDLE DATE the row says it is — a bare date is not shifted into the previous day', () => {
    // `new Date('2026-09-08')` is UTC midnight, which is Sep 7 in ET. The card's
    // one job is to be trusted about its dates.
    expect(composeTechnicals(SHORT_WINDOW, { current: 1, candleDate: '2026-09-08' }).label)
      .toContain('daily indicators as of Sep 8');
    expect(composeTechnicals(SHORT_WINDOW, { current: 1, candleDate: '2026-01-01' }).label)
      .toContain('daily indicators as of Jan 1');
  });

  it('is NULL WHOLE when nothing was computed and there is no quote', () => {
    expect(composeTechnicals(null, null)).toBeNull();
    expect(composeTechnicals({}, {})).toBeNull();
    expect(composeTechnicals({ rsi: null, macd: null, sma: {}, ema: {} }, { current: null })).toBeNull();
  });
});

describe('fundamentals — a DATE, never a cadence word (hazard 13)', () => {
  const section = composeFundamentals(MIRROR);

  it('renders the mirror’s fields, P/E beside its sector median', () => {
    expect(section.facts).toEqual([
      'P/E 14.2 · sector median 19.6',
      'P/B 1.83',
      'Revenue growth 7.4%',
      'large-cap',
      'EPS revisions 30d +2.1%',
      'Beat rate 75%',
      'Surprise magnitude 68th pctile',
    ]);
  });

  it('labels with the mirror’s computedAt as a date', () => {
    expect(section.label).toBe('Fundamentals · as of Sep 5');
    expect(section.label).not.toMatch(/weekly|daily|nightly|hourly/i);
  });

  it('EPS revisions carries its UNIT and SIGN, as both other renderers do (review A-6)', () => {
    expect(composeFundamentals({ earningsRevisions30d: 47.2, computedAt: MIRROR.computedAt }).facts)
      .toEqual(['EPS revisions 30d +47.2%']);
    expect(composeFundamentals({ earningsRevisions30d: -8, computedAt: MIRROR.computedAt }).facts)
      .toEqual(['EPS revisions 30d -8%']);
  });

  it('omits a missing metric rather than guessing it', () => {
    const s = composeFundamentals({ trailingPE: { value: 14.2 }, computedAt: MIRROR.computedAt });
    expect(s.facts).toEqual(['P/E 14.2']);
  });

  it('is NULL WHOLE without a computedAt — an undated fundamentals number is not printed', () => {
    expect(composeFundamentals({ trailingPE: { value: 14.2 } })).toBeNull();
    expect(composeFundamentals({ computedAt: MIRROR.computedAt })).toBeNull();
    expect(composeFundamentals(null)).toBeNull();
  });
});

describe('the standing', () => {
  it('reads a SWAPPED-IN position’s real persisted fields (review A-2)', () => {
    // The shape agentSwapExecution.js actually writes: `swapPrice` +
    // `swappedInAt`. NOT `openPrice`, which is a client-side derivation and
    // appears on no persisted asset — reading it printed no entry price at all,
    // for any name, and the old fixture invented the field so nothing failed.
    const s = composeStanding(UNIVERSE_PLACE.BOOK, {
      tier: 'star', swapPrice: 141.02, swappedInAt: '2026-09-11T19:15:00.000Z',
    });
    expect(s.facts[0]).toBe('star');
    expect(s.facts).toContain('Entry $141.02');
    expect(s.facts).toContain('Held since Fri 3:15 PM ET');
  });

  it('an ORIGINAL (never-swapped) position takes the battle’s starting price', () => {
    // The canonical server derivation: `asset.swapPrice ||
    // battle.portfolio.startingPrices[symbol]`. An original asset carries
    // neither field, so without the second half the card printed no entry.
    const s = composeStanding(UNIVERSE_PLACE.BOOK, { tier: 'core' }, '2026-09-11T17:30:00.000Z', 118.44);
    expect(s.facts).toContain('Entry $118.44');
    expect(s.facts.some((f) => f.startsWith('Held since'))).toBe(true);
  });

  it('carries its OWN provenance — the record’s, not the platform’s (review B-4)', () => {
    const s = composeStanding(UNIVERSE_PLACE.BOOK, { tier: 'star', swapPrice: 141.02 });
    expect(s.provenance).toBe('From the record · the board’s own numbers');
    // A standing with no facts claims nothing and so labels nothing.
    expect(composeStanding(UNIVERSE_PLACE.BOOK, {}).provenance).toBeNull();
  });

  it('is the ruled absence line for a bench or watchlist name, with no facts', () => {
    expect(composeStanding(UNIVERSE_PLACE.BENCH, null)).toEqual({ place: 'bench', line: 'On the bench', facts: [], provenance: null });
    expect(composeStanding(UNIVERSE_PLACE.WATCHLIST, null)).toEqual({ place: 'watchlist', line: 'On the watchlist', facts: [], provenance: null });
    expect(composeStanding(null, null)).toBeNull();
  });
});

describe('the whole card', () => {
  const card = composeResearchCard({
    symbol: 'MPC',
    place: UNIVERSE_PLACE.BENCH,
    indicators: SHORT_WINDOW,
    price: QUOTE,
    fundamentals: MIRROR,
  });

  it('carries the platform-data label AS A FIELD OF THE CARD (Sol C-4)', () => {
    expect(card.platformDataLabel).toBe(PLATFORM_DATA_LABEL);
    expect(card.platformDataLabel).toBe('Platform data · not what the check saw');
  });

  it('carries the Research eyebrow and is scoped to its symbol', () => {
    expect(card.eyebrow).toBe(RESEARCH_EYEBROW);
    expect(card.symbol).toBe('MPC');
  });

  it('gives the two data classes their OWN sections and their OWN provenance (D-119)', () => {
    expect(card.technicals.label).toMatch(/^Technicals · /);
    expect(card.fundamentals.label).toMatch(/^Fundamentals · /);
    expect(card.technicals.facts).not.toEqual(expect.arrayContaining(card.fundamentals.facts));
  });

  it('never carries a lens, a verdict, a forecast or a suggested action', () => {
    const json = JSON.stringify(card);
    expect(card).not.toHaveProperty('archetype');
    expect(card).not.toHaveProperty('lens');
    expect(card).not.toHaveProperty('conviction');
    expect(card).not.toHaveProperty('suggestedAction');
    expect(card).not.toHaveProperty('recommendation');
    expect(json).not.toMatch(/\b(buy|sell|hold|exit|should|will|consider_exit|What this check saw)\b/i);
  });

  it('is still a card when the platform holds nothing on the name', () => {
    const bare = composeResearchCard({ symbol: 'ZZZ', place: UNIVERSE_PLACE.WATCHLIST });
    expect(bare.technicals).toBeNull();
    expect(bare.fundamentals).toBeNull();
    expect(bare.standing.line).toBe('On the watchlist');
    expect(bare.platformDataLabel).toBe(PLATFORM_DATA_LABEL);
  });

  it('offers Equip only where the route established the name is available (hazard 7)', () => {
    expect(composeResearchCard({ symbol: 'X', place: UNIVERSE_PLACE.WATCHLIST, equipAvailable: true }).equip).toBe(true);
    expect(composeResearchCard({ symbol: 'X', place: UNIVERSE_PLACE.BOOK }).equip).toBe(false);
  });
});
