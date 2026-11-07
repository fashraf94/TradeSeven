// @vitest-environment jsdom
//
// Research Modal Build A — useBombView's lifecycle rules (review lens C C9,
// lens B B3/B8): a new symbol starts clean (no other symbol's quotes as dots,
// no other symbol's banked times); the Fuse's ghost never takes minute bars;
// off, the hook returns nothing and starts no timer.

import { describe, it, expect, vi, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import useBombView from './useBombView.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let out;
function Probe(props) { out = useBombView(props); return null; }
const bar = (iso, c) => ({ timestamp: Date.parse(iso) / 1000, close: c });
const minute = [bar('2026-10-14T16:56:00.000Z', 101), bar('2026-10-14T16:57:00.000Z', 101.1)];
const thirty = [bar('2026-10-14T15:30:00.000Z', 100.5), bar('2026-10-14T16:00:00.000Z', 100.8), bar('2026-10-14T16:30:00.000Z', 101)];
const base = { on: true, context: { kind: 'bench' }, isOriginal: true, assetThreshold: 2, previousClose: 99, setTimeframe: () => {} };

let root;
afterEach(() => { act(() => root?.unmount()); vi.useRealTimers(); });
const render = async (props) => { await act(async () => { root.render(<Probe {...base} {...props} />); }); };

describe('useBombView lifecycle', () => {
  it('off: returns null and starts no timer', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-14T17:00:00.000Z'));
    root = createRoot(document.createElement('div'));
    await render({ on: false, symbol: 'AAPL', live: 101 });
    expect(out).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('a new symbol drops the old symbol\'s observed quotes (BA-6 dots never cross symbols)', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-14T17:00:00.000Z'));
    root = createRoot(document.createElement('div'));
    await render({ symbol: 'AAPL', live: 101.2, timeframe: 'spectate', bars: minute });
    await render({ symbol: 'AAPL', live: 101.3, timeframe: 'spectate', bars: minute });
    expect(out.trace.dots.map((o) => o.price)).toEqual([101.2, 101.3]);
    await render({ symbol: 'MSFT', live: 400.5, timeframe: 'spectate', bars: minute });
    expect(out.trace.dots.map((o) => o.price)).toEqual([400.5]);
  });
  it('the ghost keeps 30-minute bars only — minute bars left over after spectate → bomb are never drawn as the ghost', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-14T17:00:00.000Z'));
    root = createRoot(document.createElement('div'));
    await render({ symbol: 'AAPL', live: 101, timeframe: 'bomb', bars: thirty });
    expect(out.ghost).toHaveLength(3);
    await render({ symbol: 'AAPL', live: 101, timeframe: 'bomb', bars: minute }); // the hook's stale minute series for one commit
    expect(out.ghost).toHaveLength(3);
  });
});
