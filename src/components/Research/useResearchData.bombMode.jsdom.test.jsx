// @vitest-environment jsdom
//
// Research Modal Build A — NO SYNTHESIZED CANDLE in Bomb mode (spec §3.4, §6
// "Honesty"). The real hook, a recording network. The weekend fixture is the
// Oct 17, 2026 shape: the 30-minute cache ends Thursday, it is Saturday
// 11:00 ET, and the synthesizer stamps a Saturday bar opening at Thursday's
// close — reproduced with the mode off, refused with it on, in the legacy and
// the controlled path. The 1D synthesizer and every request are unchanged.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.hoisted(() => { process.env.TZ = 'UTC'; });
const net = vi.hoisted(() => ({ data: {}, calls: [] }));
vi.mock('../../services/eodhdAPI', () => ({
  fetchHistoricalOHLCV: (symbol, timeframe, opts) => { net.calls.push([symbol, timeframe, opts ?? null]); return Promise.resolve(net.data[timeframe] ?? []); },
  getStockPrice: () => Promise.resolve({ price: 0 }),
}));
vi.mock('../../services/websocketService', () => ({ getDailyHL: () => null }));

import useResearchData from './useResearchData.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let container, root, out;
function Probe(props) { out = useResearchData('AAPL', props); return null; }
beforeEach(() => { container = document.createElement('div'); root = createRoot(container); net.calls.length = 0; out = null; vi.spyOn(console, 'log').mockImplementation(() => {}); });
afterEach(() => { act(() => root.unmount()); vi.restoreAllMocks(); vi.useRealTimers(); });
const bar = (iso, o, hi, lo, c) => ({ date: iso, datetime: iso, timestamp: Math.floor(Date.parse(iso) / 1000), open: o, high: hi, low: lo, close: c, volume: 100 });
const flush = async () => { for (let i = 0; i < 6; i++) await act(async () => { await vi.advanceTimersByTimeAsync(0); }); };
const run = async (props) => { await act(async () => { root.render(<Probe currentPrice={153.4} isCrypto={false} {...props} />); }); await flush(); return out; };
const lastBar = () => out.ohlcvData[out.ohlcvData.length - 1];

function weekend() {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-17T15:00:00.000Z')); // Sat 11:00 ET
  net.data = {
    '30m': [bar('2026-10-15T19:30:00.000Z', 152.4, 152.7, 152.3, 152.62), bar('2026-10-15T19:00:00.000Z', 152.2, 152.5, 152.1, 152.4)],
    '1m': [bar('2026-10-15T19:59:00.000Z', 152.6, 152.65, 152.55, 152.62), bar('2026-10-15T19:58:00.000Z', 152.5, 152.6, 152.5, 152.6)],
    '1d': [{ date: '2026-10-16', open: 152, high: 154.1, low: 151.2, close: 153.4, volume: 1 }, { date: '2026-10-15', open: 151, high: 152.9, low: 150.5, close: 152.62, volume: 1 }],
  };
}
const SAT_BAR = Math.floor(Date.parse('2026-10-17T15:00:00.000Z') / 1000);
const THU_LAST = Math.floor(Date.parse('2026-10-15T19:30:00.000Z') / 1000);

describe('the Oct 17 Saturday bar', () => {
  it('mode off: reproduced — a bar stamped Saturday 11:00 ET, opening at Thursday\'s close', async () => {
    weekend(); await run({ initialTimeframe: 'bomb' });
    expect(lastBar()).toMatchObject({ timestamp: SAT_BAR, open: 152.62, close: 153.4 });
  });
  it('mode on: refused — the series ends at Thursday\'s last closed bar', async () => {
    weekend(); await run({ initialTimeframe: 'bomb', bombMode: true });
    expect(lastBar().timestamp).toBe(THU_LAST);
    expect(out.ohlcvData).toHaveLength(2);
  });
  it('mode on, controlled (held) path: refused too', async () => {
    weekend(); await run({ initialTimeframe: 'bomb', bombMode: true, controlled: { extremes: null } });
    expect(lastBar().timestamp).toBe(THU_LAST);
    weekend(); await run({ initialTimeframe: 'bomb', controlled: { extremes: null } });
    expect(lastBar().timestamp).toBe(SAT_BAR); // off: the controlled scaffold bar
  });
  it('the same requests either way', async () => {
    weekend(); await run({ initialTimeframe: 'bomb' }); const off = [...net.calls];
    act(() => root.unmount()); container = document.createElement('div'); root = createRoot(container); net.calls.length = 0;
    weekend(); await run({ initialTimeframe: 'bomb', bombMode: true });
    expect(net.calls).toEqual(off);
  });
});

describe('the spectate (red-zone) series in hours', () => {
  function weekday() {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-14T17:00:00.000Z')); // Wed 1:00 PM ET
    net.data = {
      '1m': [bar('2026-10-14T16:20:00.000Z', 101, 101.1, 100.9, 101.05), bar('2026-10-14T16:19:00.000Z', 100.9, 101, 100.8, 101)],
      '1d': [{ date: '2026-10-14', open: 100, high: 102, low: 99, close: 101, volume: 1 }, { date: '2026-10-13', open: 99, high: 99.5, low: 98.5, close: 99, volume: 1 }],
    };
  }
  it('mode off: a stale minute series gets a synthesized bar with the day\'s range patched in', async () => {
    weekday(); await run({ initialTimeframe: 'spectate', currentPrice: 101.4 });
    expect(out.ohlcvData.length).toBe(3);
    expect(lastBar().close).toBe(101.4);
  });
  it('mode on: closed bars only — the live price stays a separate observation', async () => {
    weekday(); await run({ initialTimeframe: 'spectate', currentPrice: 101.4, bombMode: true });
    expect(out.ohlcvData.length).toBe(2);
    expect(lastBar().close).toBe(101.05);
  });
  it('a fresh last bar is not patched with the live price either', async () => {
    weekday(); net.data['1m'] = [bar('2026-10-14T16:59:00.000Z', 101, 101.1, 100.9, 101.05)];
    await run({ initialTimeframe: 'spectate', currentPrice: 101.4, bombMode: true });
    expect(lastBar()).toMatchObject({ close: 101.05, high: 101.1 });
  });
});

describe('the 1D synthesizer is untouched by the mode', () => {
  it('1D keeps today\'s live candle with or without bombMode', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-14T17:00:00.000Z'));
    net.data = { '1d': [{ date: '2026-10-13', open: 99, high: 99.5, low: 98.5, close: 99, volume: 1 }, { date: '2026-10-12', open: 98, high: 99, low: 97, close: 98, volume: 1 }] };
    await run({ initialTimeframe: '1D', currentPrice: 101.4, bombMode: true });
    const on = out.ohlcvData.map((c) => [c.date, c.close]);
    act(() => root.unmount()); container = document.createElement('div'); root = createRoot(container);
    await run({ initialTimeframe: '1D', currentPrice: 101.4 });
    expect(out.ohlcvData.map((c) => [c.date, c.close])).toEqual(on);
    expect(on.at(-1)[1]).toBe(101.4);
  });
});
