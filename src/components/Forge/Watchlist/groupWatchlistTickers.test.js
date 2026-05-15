// src/components/Forge/Watchlist/groupWatchlistTickers.test.js
//
// Sprint 6 Phase 4B — pure-logic coverage for the watchlist editor's ticker
// grouping. Uses real symbols from the ranking universe so the test
// exercises the same TICKER_TO_* maps the editor relies on.

import { describe, it, expect } from 'vitest';
import { groupWatchlistTickers } from './groupWatchlistTickers';

const t = (symbol, extra = {}) => ({ symbol, ...extra });

describe('groupWatchlistTickers', () => {
  it('groups in-universe tickers by GICS sector', () => {
    const { sectors } = groupWatchlistTickers([t('AAPL'), t('LLY')]);
    const names = sectors.map((s) => s.name);
    expect(names).toContain('Technology');
    expect(names).toContain('Healthcare');
  });

  it('orders sectors by member count descending', () => {
    const { sectors } = groupWatchlistTickers([t('AAPL'), t('MSFT'), t('NVDA'), t('LLY')]);
    expect(sectors[0].name).toBe('Technology'); // 3 members
    expect(sectors[0].count).toBe(3);
    expect(sectors[1].name).toBe('Healthcare'); // 1 member
  });

  it('breaks a count tie alphabetically by sector name', () => {
    const { sectors } = groupWatchlistTickers([t('LLY'), t('XOM')]);
    // Energy and Healthcare both have one member → alphabetical order.
    expect(sectors[0].name).toBe('Energy');
    expect(sectors[1].name).toBe('Healthcare');
  });

  it('omits sectors that have no tickers', () => {
    const { sectors } = groupWatchlistTickers([t('AAPL')]);
    expect(sectors).toHaveLength(1);
    expect(sectors[0].sectorId).toBe('XLK');
  });

  it('collects sector ETFs into etfGroup, separate from industry groups', () => {
    const { sectors } = groupWatchlistTickers([t('XLK')]);
    expect(sectors[0].etfGroup.map((x) => x.symbol)).toEqual(['XLK']);
    expect(sectors[0].industryGroups).toHaveLength(0);
  });

  it('groups stocks by industry, with industry groups sorted alphabetically', () => {
    const { sectors } = groupWatchlistTickers([t('AAPL'), t('MSFT')]);
    const industries = sectors[0].industryGroups.map((g) => g.industry);
    expect(industries).toEqual(['Software', 'Technology Hardware, Storage & Peripherals']);
  });

  it('sorts tickers alphabetically within an industry group', () => {
    const { sectors } = groupWatchlistTickers([t('MSFT'), t('ADBE')]);
    const software = sectors[0].industryGroups.find((g) => g.industry === 'Software');
    expect(software.tickers.map((x) => x.symbol)).toEqual(['ADBE', 'MSFT']);
  });

  it('folds an industry ETF into the industry group matching its theme', () => {
    const { sectors } = groupWatchlistTickers([t('NVDA'), t('SMH')]);
    const semis = sectors[0].industryGroups.find(
      (g) => g.industry === 'Semiconductors & Semiconductor Equipment',
    );
    expect(semis.tickers.map((x) => x.symbol)).toEqual(['NVDA', 'SMH']);
  });

  it('puts an industry ETF with no matching stock industry in its own group', () => {
    const { sectors } = groupWatchlistTickers([t('CIBR')]);
    expect(sectors[0].industryGroups.map((g) => g.industry)).toEqual(['Cybersecurity']);
  });

  it('separates off-universe symbols and sorts them alphabetically', () => {
    const { sectors, offUniverse } = groupWatchlistTickers([t('ZZZZ'), t('SPY'), t('AAPL')]);
    expect(offUniverse.map((x) => x.symbol)).toEqual(['SPY', 'ZZZZ']);
    expect(sectors).toHaveLength(1); // AAPL still grouped
  });

  it('returns an empty structure for an empty or invalid list', () => {
    expect(groupWatchlistTickers([])).toEqual({ sectors: [], offUniverse: [] });
    expect(groupWatchlistTickers(null)).toEqual({ sectors: [], offUniverse: [] });
  });

  it('preserves the original entry fields on grouped tickers', () => {
    const { sectors } = groupWatchlistTickers([
      t('AAPL', { reasoning: 'on-device AI', addedBy: 'agent' }),
    ]);
    const item = sectors[0].industryGroups[0].tickers[0];
    expect(item.reasoning).toBe('on-device AI');
    expect(item.addedBy).toBe('agent');
    expect(item.type).toBe('stock');
  });

  it('counts both ETF and industry-group tickers in sector.count', () => {
    const { sectors } = groupWatchlistTickers([t('XLK'), t('AAPL'), t('NVDA')]);
    expect(sectors[0].count).toBe(3);
  });
});
