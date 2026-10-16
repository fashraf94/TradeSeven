// @vitest-environment jsdom
//
// Research modal wiring follow-up, W-1 (build report
// docs/audits/20261015_BUILD_RESEARCH_MODAL_WIRING.md): the modal learns the
// chart's S/R state from the onToggleSR prop alone — not from a click on a
// button that reads "S/R". Here StockChart is a test double whose pill reads
// "Levels"; turning it on still asks for the daily series, once.
//
// The REAL modal and hook; StockChart is the double. Stubbed: the network, the
// company profile, the dormant WebSocket daily high/low and the drawer's tabs.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';

const net = vi.hoisted(() => ({ calls: [] }));
vi.mock('../../services/eodhdAPI', () => ({
  fetchHistoricalOHLCV: (symbol, timeframe, opts) => {
    net.calls.push(['fetchHistoricalOHLCV', symbol, timeframe, opts ?? null]);
    if (timeframe === '1w') {
      return Promise.resolve([
        { date: '2026-10-12', open: 199, high: 202, low: 198, close: 200, volume: 5e6 },
        { date: '2026-10-05', open: 200, high: 202, low: 197, close: 199, volume: 5e6 },
      ]);
    }
    return Promise.resolve([]);
  },
  getStockPrice: (symbol) => {
    net.calls.push(['getStockPrice', symbol]);
    return Promise.resolve({ symbol, price: 0 });
  },
}));
vi.mock('../Research/StockChart', () => ({
  default: function StockChartDouble({ onToggleSR }) {
    const [on, setOn] = useState(false);
    return <button type="button" onClick={() => { setOn(!on); onToggleSR?.(!on); }}>Levels</button>;
  },
}));
vi.mock('../../services/fundamentalsService', () => ({ getCompanyProfile: () => Promise.resolve(null) }));
vi.mock('../../services/websocketService', () => ({ getDailyHL: () => null }));
vi.mock('../Research/AnalysisDrawer', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('./ResearchTabs/BaggerBombTab', () => ({ default: () => null }));
vi.mock('../Research/TechnicalTabV2', () => ({ default: () => null }));
vi.mock('../Research/AnalysisQATab', () => ({ default: () => null }));
vi.mock('../../firebase/config', () => ({ db: {}, auth: { currentUser: null }, default: {} }));

import AssetResearchModal from './AssetResearchModal';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} };
}

let container;
let root;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-15T17:00:00.000Z'));
  net.calls.length = 0;
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
  vi.useRealTimers();
});

const flush = async () => {
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
};
const daily400 = ['fetchHistoricalOHLCV', 'AAPL', '1d', { days: 400 }];
const dailyRequests = () => net.calls.filter((c) => c[2] === '1d' && c[3]?.days === 400);

describe('W-1 — the S/R request is wired through onToggleSR, not the pill\'s text', () => {
  it('a chart whose pill reads "Levels": turning it on asks for the daily series once', async () => {
    await act(async () => {
      root.render(<AssetResearchModal onClose={() => {}} asset={{ symbol: 'AAPL', name: 'AAPL', price: 200 }}
        version={2} showActionButton={false} isGameContext defaultTab="baggerbomb" defaultTimeframe="1W" />);
    });
    await flush();
    const pill = [...document.body.querySelectorAll('button')].find((b) => b.textContent === 'Levels');
    expect(pill).toBeTruthy();
    expect(dailyRequests()).toEqual([]);
    await act(async () => { pill.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await flush();
    expect(dailyRequests()).toEqual([daily400]);
  });
});
