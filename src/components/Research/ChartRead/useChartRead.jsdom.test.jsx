// @vitest-environment jsdom
//
// The Chart view's read — THE ONE REQUEST (useChartRead; RD-11, RD-12; spec docs/specs/CHART_READ_SPEC_V1.md):
// 'off' asks nothing; the server decides the audience (404 / 400 → no slot); a failure is a quiet failed state
// with a retry; one request per symbol however often the Chart view is left and re-entered.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

const FLAG = vi.hoisted(() => ({ read: 'on' }));
vi.mock('../Sheet/chartReadMode.js', () => ({ resolveChartReadMode: () => FLAG.read, chartReadModeOn: () => true }));
const net = vi.hoisted(() => ({ calls: [], next: null }));
vi.mock('../Sheet/setupRead.js', () => ({ fetchSetupRead: (s) => { net.calls.push(s); return net.next(); } }));

import { useChartRead } from './useChartRead.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let container;
let root;
let seen;
function Probe({ symbol, enabled }) { seen = useChartRead({ symbol, enabled }); return null; }
const render = async (props) => { await act(async () => { root.render(<Probe {...props} />); }); await act(async () => {}); };
beforeEach(() => { FLAG.read = 'on'; net.calls.length = 0; net.next = () => Promise.resolve({ answer: 'absent' }); container = document.createElement('div'); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); });

describe('useChartRead', () => {
  it("'off': no request, status off", async () => {
    FLAG.read = 'off';
    await render({ symbol: 'CEG', enabled: true });
    expect([seen.status, net.calls]).toEqual(['off', []]);
  });
  it('not enabled (not a stock\'s Chart view): no request', async () => {
    await render({ symbol: 'CEG', enabled: false });
    expect([seen.status, net.calls]).toEqual(['off', []]);
  });
  it('ready with the body as answered', async () => {
    await render({ symbol: 'CEG', enabled: true });
    expect([seen.status, seen.body, net.calls]).toEqual(['ready', { answer: 'absent' }, ['CEG']]);
  });
  it.each([[404, 'hidden'], [400, 'hidden'], [500, 'failed'], [429, 'failed'], [503, 'failed'], [0, 'failed'], [200, 'failed']])('a rejection with status %s → %s', async (status, want) => {
    net.next = () => Promise.reject({ status, error: 'x' });
    await render({ symbol: 'CEG', enabled: true });
    expect(seen.status).toBe(want);
    expect(seen.body).toBeNull();
  });
  it('retry asks once more', async () => {
    net.next = () => Promise.reject({ status: 500, error: 'x' });
    await render({ symbol: 'CEG', enabled: true });
    net.next = () => Promise.resolve({ answer: 'measured' });
    await act(async () => { seen.retry(); });
    await act(async () => {});
    expect([seen.status, net.calls.length]).toEqual(['ready', 2]);
  });
  it('left and re-entered: an answered read is not asked again; a new symbol is', async () => {
    await render({ symbol: 'CEG', enabled: true });
    await render({ symbol: 'CEG', enabled: false });
    await render({ symbol: 'CEG', enabled: true });
    expect([seen.status, net.calls]).toEqual(['ready', ['CEG']]);
    await render({ symbol: 'AAPL', enabled: true });
    expect(net.calls).toEqual(['CEG', 'AAPL']);
  });
  it('a request cut off before its answer is asked again next time, and its late answer is dropped', async () => {
    let resolveFirst;
    net.next = () => new Promise((r) => { resolveFirst = r; });
    await render({ symbol: 'CEG', enabled: true });
    expect(seen.status).toBe('loading');
    await render({ symbol: 'CEG', enabled: false });
    net.next = () => Promise.resolve({ answer: 'refused' });
    await render({ symbol: 'CEG', enabled: true });
    await act(async () => { resolveFirst({ answer: 'measured' }); });
    expect([seen.status, seen.body, net.calls.length]).toEqual(['ready', { answer: 'refused' }, 2]);
  });
});
