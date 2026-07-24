// api/_utils/wireDigest.test.js
// FantasyTimes Wire — renderer fixtures, one per eventType template (§9),
// anchored on the §4.1 exemplar which must render EXACTLY.

import { describe, it, expect } from 'vitest';
import { renderWireDigest } from './wireDigest.js';
import { EVENT_TYPES } from './wireContracts.js';

describe('wireDigest — the §4.1 exemplar (locked)', () => {
  it('renders the earnings_recap exemplar byte-exactly', () => {
    const digest = renderWireDigest({
      eventType: 'earnings_recap',
      primaryTicker: 'NVDA',
      tickers: ['NVDA'],
      direction: 'up',
      magnitude: { value: 8.2, unit: 'pct', basis: 'eps_vs_consensus' },
      qualifiers: ['guidance_raised'],
      figures: [{ value: 5.2, unit: 'pct', basis: 'gap_vs_prior_close' }],
      keyLevel: { price: 148.5, type: 'prior_high' },
    });
    expect(digest).toBe(
      'NVDA earnings: EPS +8.2% vs consensus; guidance raised; gap +5.2% vs prior close; above prior high 148.50.'
    );
  });
});

describe('wireDigest — per-eventType fixtures', () => {
  const FIXTURES = {
    technical_break: {
      facts: { primaryTicker: 'AAPL', direction: 'up', magnitude: { value: 2.1, unit: 'pct', basis: 'price_vs_level' }, keyLevel: { price: 230, type: 'resistance' } },
      expected: 'AAPL technical break: price +2.1% vs level; above resistance 230.00.',
    },
    volume_surge: {
      facts: { primaryTicker: 'TSLA', direction: 'up', magnitude: { value: 3.5, unit: 'x', basis: 'volume_vs_avg' } },
      expected: 'TSLA volume surge: volume +3.5x vs avg.',
    },
    volatility_event: {
      facts: { primaryTicker: 'AMD', direction: 'down', magnitude: { value: -1.8, unit: 'x', basis: 'range_vs_atr' } },
      expected: 'AMD volatility: range -1.8x vs ATR.',
    },
    index_move: {
      facts: { tickers: [], direction: 'down', magnitude: { value: -1.4, unit: 'pct', basis: 'index_vs_prior_close' } },
      expected: 'Index move: -1.4% vs prior close.',
    },
    market_mover: {
      facts: { primaryTicker: 'META', direction: 'up', magnitude: { value: 4.9, unit: 'pct', basis: 'price_vs_prior_close' } },
      expected: 'META move: +4.9% vs prior close.',
    },
    gap_event: {
      facts: { primaryTicker: 'NFLX', direction: 'down', magnitude: { value: -6, unit: 'pct', basis: 'gap_vs_prior_close' } },
      expected: 'NFLX gap: gap -6% vs prior close.',
    },
    econ_print: {
      facts: { tickers: [], direction: 'up', magnitude: { value: 0.2, unit: 'pp', basis: 'print_vs_expected' }, qualifiers: ['prior_revised_down'] },
      expected: 'Econ print: +0.2pp vs expected; prior revised down.',
    },
    econ_preview: {
      facts: { tickers: [], direction: null, magnitude: { value: 245, unit: 'count', basis: 'consensus_estimate' } },
      expected: 'Econ preview: consensus 245.',
    },
    earnings_preview: {
      facts: { primaryTicker: 'COST', direction: null, magnitude: { value: 3.71, unit: 'usd', basis: 'consensus_estimate' } },
      expected: 'COST earnings preview: consensus $3.71.',
    },
    sector_rotation: {
      facts: { tickers: [], direction: 'down', magnitude: { value: -1.2, unit: 'pct', basis: 'sector_vs_spy' } },
      expected: 'Sector rotation: -1.2% vs SPY.',
    },
    leadership_shift: {
      facts: { primaryTicker: 'NVDA', direction: 'up', magnitude: { value: 4.1, unit: 'pct', basis: 'rs_vs_peers' } },
      expected: 'NVDA leadership shift: RS +4.1% vs peers.',
    },
    earnings_recap: {
      facts: { primaryTicker: 'NVDA', direction: 'up', magnitude: { value: 8.2, unit: 'pct', basis: 'eps_vs_consensus' } },
      expected: 'NVDA earnings: EPS +8.2% vs consensus.',
    },
  };

  it('covers every contract eventType with a fixture', () => {
    expect(Object.keys(FIXTURES).sort()).toEqual([...EVENT_TYPES].sort());
  });

  for (const [eventType, { facts, expected }] of Object.entries(FIXTURES)) {
    it(`${eventType} renders its template`, () => {
      expect(renderWireDigest({ eventType, ...facts })).toBe(expected);
    });
  }
});

describe('wireDigest — SALVAGE and degenerate shapes', () => {
  it('a SALVAGE survivor set renders a valid shorter digest', () => {
    const digest = renderWireDigest({
      eventType: 'earnings_recap',
      primaryTicker: 'NVDA',
      direction: 'up',
      magnitude: null, // salvage-dropped
      keyLevel: null,
      figures: [],
      qualifiers: ['guidance_raised'],
    });
    expect(digest).toBe('NVDA earnings: guidance raised.');
  });

  it('facts with nothing optional render the minimal form', () => {
    expect(renderWireDigest({ eventType: 'market_mover', primaryTicker: 'NVDA' }))
      .toBe('NVDA move.');
  });

  it('null direction renders keyLevel with "near"', () => {
    expect(renderWireDigest({
      eventType: 'earnings_preview',
      primaryTicker: 'COST',
      direction: null,
      keyLevel: { price: 900, type: 'prior_high' },
    })).toBe('COST earnings preview: near prior high 900.00.');
  });

  it('returns null for unknown/missing eventType', () => {
    expect(renderWireDigest(null)).toBeNull();
    expect(renderWireDigest({ eventType: 'macro_alert' })).toBeNull();
  });
});
