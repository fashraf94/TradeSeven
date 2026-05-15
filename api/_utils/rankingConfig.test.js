// api/_utils/rankingConfig.test.js
//
// Sprint 6 Phase 4.5a — universe expansion coverage. The original universe
// (239 stocks across 11 GICS sectors) gains 11 Tier 1 sector ETFs and 28
// Tier 2 industry ETFs in this phase. Total TICKER_TO_SECTOR size: 278.
//
// Tests are grouped per the audit's verification matrix V-1 through V-12.

import { describe, it, expect } from 'vitest';
import {
  STOCK_UNIVERSE,
  ALL_TICKERS,
  TICKER_TO_SECTOR,
  TICKER_TO_TYPE,
  TICKER_TO_INDUSTRY,
  SECTOR_ETFS,
  INDUSTRY_ETFS,
  INDUSTRY_ETF_THEMES,
} from './rankingConfig.js';

describe('rankingConfig — Phase 4.5a universe expansion', () => {
  it('V-1: preserves all 239 original stocks in TICKER_TO_SECTOR', () => {
    expect(ALL_TICKERS).toHaveLength(239);
    const spotChecks = {
      AAPL: 'XLK', MSFT: 'XLK', NVDA: 'XLK',
      JPM: 'XLF', 'BRK-B': 'XLF',
      XOM: 'XLE', CVX: 'XLE',
      LLY: 'XLV', UNH: 'XLV',
      META: 'XLC', GOOG: 'XLC', GOOGL: 'XLC',
      AMZN: 'XLY', TSLA: 'XLY',
      PG: 'XLP', COST: 'XLP',
      GE: 'XLI',
      LIN: 'XLB',
      NEE: 'XLU',
      PLD: 'XLRE',
    };
    for (const [ticker, sector] of Object.entries(spotChecks)) {
      expect(TICKER_TO_SECTOR[ticker]).toBe(sector);
    }
  });

  it('V-2: includes all 11 Tier 1 sector ETFs mapping to themselves as sectorId', () => {
    const sectorEtfs = ['XLK', 'XLV', 'XLF', 'XLE', 'XLY', 'XLP', 'XLI', 'XLB', 'XLU', 'XLRE', 'XLC'];
    for (const etf of sectorEtfs) {
      expect(TICKER_TO_SECTOR[etf]).toBe(etf);
    }
  });

  it('V-3: includes all 28 Tier 2 ETFs with correct per-sector mapping', () => {
    const expectedTier2 = {
      XLK: ['SMH', 'SOXX', 'IGV', 'CIBR', 'SKYY'],
      XLV: ['IBB', 'XBI', 'IHI', 'IHF'],
      XLF: ['KRE', 'KBE', 'KIE'],
      XLE: ['XOP', 'OIH', 'ICLN', 'TAN', 'URA', 'URNM'],
      XLY: ['XRT'],
      XLI: ['ITA', 'JETS'],
      XLB: ['GDX', 'GDXJ', 'SIL', 'COPX'],
      XLU: ['GRID'],
      XLRE: ['VNQ', 'REM'],
    };
    let total = 0;
    for (const [sectorId, etfs] of Object.entries(expectedTier2)) {
      for (const etf of etfs) {
        expect(TICKER_TO_SECTOR[etf]).toBe(sectorId);
        total++;
      }
    }
    expect(total).toBe(28);
  });

  it('V-3 (dropped tickers): HACK, IAI, PEJ NOT in universe (audit floors)', () => {
    expect(TICKER_TO_SECTOR.HACK).toBeUndefined();
    expect(TICKER_TO_SECTOR.IAI).toBeUndefined();
    expect(TICKER_TO_SECTOR.PEJ).toBeUndefined();
    expect(TICKER_TO_TYPE.HACK).toBeUndefined();
    expect(TICKER_TO_TYPE.IAI).toBeUndefined();
    expect(TICKER_TO_TYPE.PEJ).toBeUndefined();
  });

  it('V-4 (stocks): TICKER_TO_TYPE has "stock" for known equities', () => {
    const spots = ['AAPL', 'MSFT', 'JPM', 'XOM', 'GOOGL', 'BRK-B'];
    for (const sym of spots) {
      expect(TICKER_TO_TYPE[sym]).toBe('stock');
    }
  });

  it('V-4 (sector_etf): TICKER_TO_TYPE has "sector_etf" for all 11 sector ETFs', () => {
    const sectorEtfs = ['XLK', 'XLV', 'XLF', 'XLE', 'XLY', 'XLP', 'XLI', 'XLB', 'XLU', 'XLRE', 'XLC'];
    for (const etf of sectorEtfs) {
      expect(TICKER_TO_TYPE[etf]).toBe('sector_etf');
    }
  });

  it('V-4 (industry_etf): TICKER_TO_TYPE has "industry_etf" for all 28 Tier 2 ETFs', () => {
    const tier2 = ['SMH', 'SOXX', 'IGV', 'CIBR', 'SKYY', 'IBB', 'XBI', 'IHI', 'IHF',
                   'KRE', 'KBE', 'KIE', 'XOP', 'OIH', 'ICLN', 'TAN', 'URA', 'URNM',
                   'XRT', 'ITA', 'JETS', 'GDX', 'GDXJ', 'SIL', 'COPX', 'GRID', 'VNQ', 'REM'];
    expect(tier2).toHaveLength(28);
    for (const etf of tier2) {
      expect(TICKER_TO_TYPE[etf]).toBe('industry_etf');
    }
  });

  it('V-5: INDUSTRY_ETFS is frozen and has 11 sector keys', () => {
    expect(Object.isFrozen(INDUSTRY_ETFS)).toBe(true);
    expect(Object.keys(INDUSTRY_ETFS)).toHaveLength(11);
    const expectedKeys = ['XLK', 'XLV', 'XLF', 'XLE', 'XLY', 'XLP', 'XLI', 'XLB', 'XLU', 'XLRE', 'XLC'];
    for (const k of expectedKeys) {
      expect(INDUSTRY_ETFS).toHaveProperty(k);
      expect(Array.isArray(INDUSTRY_ETFS[k])).toBe(true);
    }
  });

  it('V-6: coverage-gap sectors XLP and XLC are empty arrays (intentional)', () => {
    expect(INDUSTRY_ETFS.XLP).toEqual([]);
    expect(INDUSTRY_ETFS.XLC).toEqual([]);
  });

  it('V-7: no naming collisions between ETF and stock symbols', () => {
    const stockSet = new Set(ALL_TICKERS);
    const allEtfs = [
      ...SECTOR_ETFS,
      ...Object.values(INDUSTRY_ETFS).flat(),
    ];
    for (const etf of allEtfs) {
      expect(stockSet.has(etf)).toBe(false);
    }
  });

  it('V-8: SECTOR_ETFS array unchanged (back-compat with cron consumers)', () => {
    expect(SECTOR_ETFS).toEqual([
      'XLK', 'XLV', 'XLF', 'XLE', 'XLY', 'XLP', 'XLI', 'XLB', 'XLU', 'XLRE', 'XLC',
    ]);
  });

  it('V-9: total TICKER_TO_SECTOR size = 278 (239 + 11 + 28)', () => {
    expect(Object.keys(TICKER_TO_SECTOR)).toHaveLength(278);
    expect(Object.keys(TICKER_TO_TYPE)).toHaveLength(278);
  });

  it('V-9 (parity): every TICKER_TO_SECTOR entry has a matching TICKER_TO_TYPE entry', () => {
    for (const sym of Object.keys(TICKER_TO_SECTOR)) {
      expect(TICKER_TO_TYPE[sym]).toBeDefined();
    }
    for (const sym of Object.keys(TICKER_TO_TYPE)) {
      expect(TICKER_TO_SECTOR[sym]).toBeDefined();
    }
  });

  it('STOCK_UNIVERSE shape unchanged (regression guard for cron consumers)', () => {
    expect(Object.keys(STOCK_UNIVERSE)).toHaveLength(11);
    for (const sector of Object.values(STOCK_UNIVERSE)) {
      expect(sector).toHaveProperty('name');
      expect(sector).toHaveProperty('etf');
      expect(sector).toHaveProperty('color');
      expect(sector).toHaveProperty('stocks');
      expect(Array.isArray(sector.stocks)).toBe(true);
    }
  });

  // ── Phase 4.6 — Industry taxonomy (V-10 through V-18) ───────────────────

  it('V-10: TICKER_TO_INDUSTRY spot-checks for 10 known stocks', () => {
    const spotChecks = {
      AAPL: 'Technology Hardware, Storage & Peripherals',
      NVDA: 'Semiconductors & Semiconductor Equipment',
      MSFT: 'Software',
      JPM: 'Banks',
      XOM: 'Oil, Gas & Consumable Fuels',
      LLY: 'Pharmaceuticals',
      JNJ: 'Pharmaceuticals',
      KO: 'Beverages',
      AMZN: 'Broadline Retail',
      BA: 'Aerospace & Defense',
    };
    for (const [ticker, industry] of Object.entries(spotChecks)) {
      expect(TICKER_TO_INDUSTRY[ticker]).toBe(industry);
    }
  });

  it('V-11: all 239 stocks have a non-empty string industry', () => {
    expect(ALL_TICKERS).toHaveLength(239);
    for (const ticker of ALL_TICKERS) {
      expect(typeof TICKER_TO_INDUSTRY[ticker]).toBe('string');
      expect(TICKER_TO_INDUSTRY[ticker].length).toBeGreaterThan(0);
    }
  });

  it('V-12: all 11 sector ETFs have null industry (Phase 4.6 Q3)', () => {
    const sectorEtfs = ['XLK', 'XLV', 'XLF', 'XLE', 'XLY', 'XLP', 'XLI', 'XLB', 'XLU', 'XLRE', 'XLC'];
    for (const etf of sectorEtfs) {
      expect(TICKER_TO_INDUSTRY[etf]).toBeNull();
    }
  });

  it('V-13: all 28 industry ETFs have a non-empty string industry', () => {
    const industryEtfs = Object.values(INDUSTRY_ETFS).flat();
    expect(industryEtfs).toHaveLength(28);
    for (const etf of industryEtfs) {
      expect(typeof TICKER_TO_INDUSTRY[etf]).toBe('string');
      expect(TICKER_TO_INDUSTRY[etf].length).toBeGreaterThan(0);
    }
  });

  it('V-14: industry ETF assignments match INDUSTRY_ETF_THEMES (spot-check 6)', () => {
    const spotChecks = {
      SMH: 'Semiconductors & Semiconductor Equipment',
      IBB: 'Biotechnology',
      KRE: 'Banks',
      TAN: 'Solar',
      GDX: 'Gold Mining',
      REM: 'Mortgage REITs',
    };
    for (const [etf, industry] of Object.entries(spotChecks)) {
      expect(INDUSTRY_ETF_THEMES[etf]).toBe(industry);
      expect(TICKER_TO_INDUSTRY[etf]).toBe(industry);
    }
  });

  it('V-15: TICKER_TO_INDUSTRY size = 278 (parity with TICKER_TO_SECTOR)', () => {
    expect(Object.keys(TICKER_TO_INDUSTRY)).toHaveLength(278);
    expect(Object.keys(TICKER_TO_INDUSTRY)).toHaveLength(Object.keys(TICKER_TO_SECTOR).length);
  });

  it('V-16 (parity): every TICKER_TO_SECTOR key has a TICKER_TO_INDUSTRY entry', () => {
    for (const sym of Object.keys(TICKER_TO_SECTOR)) {
      expect(sym in TICKER_TO_INDUSTRY).toBe(true);
    }
    for (const sym of Object.keys(TICKER_TO_INDUSTRY)) {
      expect(sym in TICKER_TO_SECTOR).toBe(true);
    }
  });

  it('V-17: industry names contain only expected characters', () => {
    const validPattern = /^[A-Za-z0-9 &,-]+$/;
    const offenders = [];
    for (const [sym, industry] of Object.entries(TICKER_TO_INDUSTRY)) {
      if (industry === null) continue;
      if (!validPattern.test(industry)) offenders.push(`${sym}: "${industry}"`);
    }
    expect(offenders).toEqual([]);
  });

  it('V-18: INDUSTRY_ETF_THEMES is frozen with 28 entries', () => {
    expect(Object.isFrozen(INDUSTRY_ETF_THEMES)).toBe(true);
    expect(Object.keys(INDUSTRY_ETF_THEMES)).toHaveLength(28);
  });
});
