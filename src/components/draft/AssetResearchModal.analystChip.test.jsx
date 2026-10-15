// @vitest-environment jsdom
//
// Research modal honesty fixes, F1 — the Analysis tab's rating is labeled
// Wall Street analyst consensus, with its analyst count, and never a fallback
// (build report docs/audits/20261015_BUILD_RESEARCH_MODAL_HONESTY_FIXES.md).
//
// The REAL modal and research hook; stubbed: the network (eodhdAPI, the
// company profile), lightweight-charts (jsdom cannot paint), the dormant
// WebSocket daily high/low, and the drawer's other tabs.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

const prof = vi.hoisted(() => ({ answers: {}, calls: [] }));
vi.mock('../../services/fundamentalsService', () => ({
  getCompanyProfile: (symbol) => {
    prof.calls.push(symbol);
    const a = prof.answers[symbol];
    return typeof a === 'function' ? a() : Promise.resolve(a ?? null);
  },
}));
vi.mock('../../services/eodhdAPI', () => ({
  fetchHistoricalOHLCV: () => Promise.resolve([]),
  getStockPrice: (symbol) => Promise.resolve({ symbol, price: 0 }),
}));
vi.mock('../../services/websocketService', () => ({ getDailyHL: () => null }));
vi.mock('../../utils/fetchWithAuth', () => ({ fetchWithAuth: () => Promise.resolve({ json: async () => ({ success: true, data: {} }) }) }));
vi.mock('lightweight-charts', () => {
  const series = () => ({ setData() {}, createPriceLine() { return { applyOptions() {} }; }, removePriceLine() {}, setMarkers() {}, priceScale() { return { applyOptions() {} }; }, applyOptions() {} });
  return {
    createChart: () => ({
      addSeries: () => series(),
      removeSeries() {},
      subscribeCrosshairMove() {},
      timeScale() { return { applyOptions() {}, fitContent() {}, scrollToRealTime() {}, setVisibleLogicalRange() {}, getVisibleLogicalRange() { return null; } }; },
      applyOptions() {},
      remove() {},
    }),
    CandlestickSeries: 'Candlestick', HistogramSeries: 'Histogram', LineSeries: 'Line', AreaSeries: 'Area',
  };
});
vi.mock('../Research/AnalysisDrawer', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('../Research/AnalysisQATab', () => ({ default: () => null }));
vi.mock('../Research/TechnicalTabV2', () => ({ default: () => null }));
vi.mock('../Research/HealthTab', () => ({ default: () => null }));
vi.mock('./ResearchTabs/TechnicalAnalysisTab', () => ({ default: () => null }));
vi.mock('./ResearchTabs/BaggerBombTab', () => ({ default: () => null }));
vi.mock('./SectorTab', () => ({ default: () => null }));
vi.mock('./CompeteTab', () => ({ default: () => null }));
vi.mock('../Research/MarketContextTab', () => ({ default: () => null }));
vi.mock('../Research/HoldingsTab', () => ({ default: () => null }));
vi.mock('../Research/SectorETFRanksTab', () => ({ default: () => null }));
vi.mock('../Research/SmartMoneyTab', () => ({ default: () => null }));
vi.mock('../../firebase/config', () => ({ db: {}, auth: { currentUser: null }, default: {} }));

import AssetResearchModal from './AssetResearchModal';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} };
}

let container;
let root;
beforeEach(() => {
  prof.answers = {};
  prof.calls.length = 0;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

const flush = async () => {
  for (let i = 0; i < 3; i++) await act(async () => { await Promise.resolve(); });
};
async function show(asset) {
  await act(async () => {
    root.render(<AssetResearchModal asset={asset} onClose={() => {}} showActionButton={false} isGameContext version={2} />);
  });
  await flush();
}
const text = () => document.body.textContent;
const profile = (symbol, ratingText, totalAnalysts, extra = {}) => ({
  symbol, sector: 'Technology', industry: 'Consumer Electronics', description: '',
  analystRating: 4, ratingText, analystConsensus: { rating: 4, totalAnalysts }, ...extra,
});
function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

describe('F1 — the Analysis tab rating is labeled Wall Street consensus', () => {
  it('(a) a covered stock: "Wall St: Buy · 24 analysts"', async () => {
    prof.answers.AAPL = profile('AAPL', 'Buy', 24);
    await show({ symbol: 'AAPL', name: 'Apple', price: 100 });
    expect(text()).toContain('Wall St: Buy · 24 analysts');
  });

  it('(a′) one analyst reads singular', async () => {
    prof.answers.AAPL = profile('AAPL', 'Strong Buy', 1);
    await show({ symbol: 'AAPL', name: 'Apple', price: 100 });
    expect(text()).toContain('Wall St: Strong Buy · 1 analyst');
    expect(text()).not.toContain('1 analysts');
  });

  it('(b) no analyst coverage: "Wall St: no coverage", never the server\'s default "Hold"', async () => {
    prof.answers.ZZZZ = profile('ZZZZ', 'Hold', 0);
    await show({ symbol: 'ZZZZ', name: 'Uncovered Co', price: 10 });
    expect(text()).toContain('Wall St: no coverage');
    expect(text()).not.toContain('Hold');
  });

  it('(c) no profile: no rating text at all, and never "Buy"', async () => {
    prof.answers.ZZZZ = null;
    await show({ symbol: 'ZZZZ', name: 'Unknown Co', price: 10 });
    expect(prof.calls).toEqual(['ZZZZ']);
    expect(text()).not.toContain('Wall St');
    expect(text()).not.toMatch(/Buy|Hold|Sell/);
    // A ticker that once had a hardcoded mock rating shows nothing either.
    await show({ symbol: 'AAPL', name: 'Apple', price: 100 });
    expect(prof.calls).toEqual(['ZZZZ', 'AAPL']);
    expect(text()).not.toMatch(/Wall St|Buy|Hold|Sell/);
  });

  it('(d) a symbol change clears the previous chip before the new profile resolves', async () => {
    prof.answers.AAPL = profile('AAPL', 'Buy', 24);
    await show({ symbol: 'AAPL', name: 'Apple', price: 100 });
    expect(text()).toContain('Wall St: Buy · 24 analysts');
    const msft = deferred();
    prof.answers.MSFT = () => msft.promise;
    await show({ symbol: 'MSFT', name: 'Microsoft', price: 400 });
    expect(text()).not.toContain('Wall St');
    await act(async () => { msft.resolve(profile('MSFT', 'Strong Buy', 40)); });
    await flush();
    expect(text()).toContain('Wall St: Strong Buy · 40 analysts');
  });

  it('(d′) a late answer for the previous symbol never lands on the new one', async () => {
    const aapl = deferred();
    prof.answers.AAPL = () => aapl.promise;
    await show({ symbol: 'AAPL', name: 'Apple', price: 100 });
    prof.answers.MSFT = () => new Promise(() => {});
    await show({ symbol: 'MSFT', name: 'Microsoft', price: 400 });
    await act(async () => { aapl.resolve(profile('AAPL', 'Buy', 24, { description: 'Apple designs phones.' })); });
    await flush();
    expect(text()).not.toContain('Wall St');
    expect(text()).not.toContain('Apple designs phones.');
  });
});
