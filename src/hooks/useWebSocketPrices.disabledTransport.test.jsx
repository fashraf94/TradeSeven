// @vitest-environment jsdom
//
// Containment B1 — CONSUMER-SEAM characterization for the active product.
//
// Every live price consumer (AgentBattleScreen:472, useArenaPriceContext:31,
// WatchlistContainer:154, Flat6BattleView) reads its real-time overlay through
// this one hook: `const { prices, status } = useWebSocketPrices(symbols)`. After
// B1 the server (/api/ws-config) no longer hands the browser a token-bearing
// vendor URL, so the transport is permanently disabled. This suite pins the
// contract those consumers depend on when that happens:
//
//   * `prices` stays an empty overlay ({}) — never a fabricated/partial price,
//   * `status` settles to an HONEST 'disconnected' (never a false 'connected'),
//   * ZERO browser WebSockets are constructed,
//   * no reconnect storm and no /api/ws-config storm across symbol churn,
//   * mount → symbol-change → unmount never throws,
//   * the returned value carries no token / vendor URL.
//
// Because each consumer merges this overlay OVER a same-origin REST source
// (`wsPrices empty ? currentPrices : {...}`), an always-empty overlay means the
// screen simply shows REST prices — the intended B1 display degradation, proven
// end-to-end for the shared idiom in useArenaPriceContext.restFallback.test.jsx.
//
// Uses the REAL wsManager + REAL websocketService (no service mock) so this is a
// true integration of the seam; only fetch + the WebSocket constructor are
// stubbed (the house idiom from websocketService.test.js).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

import { useWebSocketPrices } from './useWebSocketPrices';
import { wsManager } from '../services/websocketService';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let fetchSpy;
let wsCtorCount;
let container;
let root;

// A probe component that surfaces the hook's return value to the test.
let latest;
function Probe({ symbols, enabled = true }) {
  latest = useWebSocketPrices(symbols, { enabled });
  return null;
}

async function flush() {
  // Let the mocked ws-config fetch (2 microtask hops) resolve and the resulting
  // status setState re-render, all inside act so React warnings don't fire.
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

async function mount(props) {
  container = document.createElement('div');
  document.body.appendChild(container);
  await act(async () => {
    root = createRoot(container);
    root.render(<Probe {...props} />);
  });
  await flush();
}

async function rerender(props) {
  await act(async () => { root.render(<Probe {...props} />); });
  await flush();
}

beforeEach(() => {
  // Reset the singleton's transport state between tests (websocketService.test
  // idiom) so each case starts from "transport not yet probed".
  wsManager._transportDisabled = false;
  wsManager._wsUrls = null;
  wsManager._urlPromise = null;
  wsManager._stockSubscriptions = {};
  wsManager._cryptoSubscriptions = {};
  wsManager._stockStatus = 'disconnected';
  wsManager._cryptoStatus = 'disconnected';
  wsManager._priceCache.clear();

  wsCtorCount = 0;
  // ANY socket construction is a B1 violation — count them.
  globalThis.WebSocket = class {
    constructor() { wsCtorCount++; }
    close() {}
    send() {}
  };
  globalThis.WebSocket.OPEN = 1;
  globalThis.WebSocket.CONNECTING = 0;

  // /api/ws-config returns the disabled-transport contract (no token, no URLs).
  fetchSpy = vi.fn(async () => ({
    ok: true,
    json: async () => ({ available: false, transport: 'rest' }),
  }));
  globalThis.fetch = fetchSpy;

  latest = undefined;
});

afterEach(() => {
  if (root) act(() => root.unmount());
  if (container) container.remove();
  container = null;
  root = null;
  // destroy() clears every pending timer (close/reconnect) so no dangling
  // handles leak across tests.
  wsManager.destroy();
  vi.restoreAllMocks();
});

describe('useWebSocketPrices — disabled transport (B1 consumer seam)', () => {
  it('mounting with symbols yields an empty overlay and never opens a socket', async () => {
    await mount({ symbols: ['AAPL', 'NVDA'] });

    expect(latest.prices).toEqual({});
    expect(wsCtorCount).toBe(0);
  });

  it('status settles to an honest "disconnected" — never a false "connected"', async () => {
    await mount({ symbols: ['AAPL', 'NVDA'] });

    expect(latest.status).toBe('disconnected');
    expect(latest.status).not.toBe('connected');
  });

  it('mixed stock + crypto symbols still open no socket and stay disconnected', async () => {
    await mount({ symbols: ['AAPL', 'BTC'] });

    expect(latest.prices).toEqual({});
    expect(latest.status).toBe('disconnected');
    expect(wsCtorCount).toBe(0);
  });

  it('does not storm /api/ws-config across symbol churn (terminal disabled state)', async () => {
    await mount({ symbols: ['AAPL'] });
    await rerender({ symbols: ['AAPL', 'NVDA'] });
    await rerender({ symbols: ['MSFT', 'TSLA'] });

    // The first probe latches _transportDisabled; every later subscribe
    // short-circuits before fetching. One config fetch total, still no socket.
    expect(fetchSpy.mock.calls.length).toBeLessThanOrEqual(1);
    expect(wsCtorCount).toBe(0);
    expect(latest.prices).toEqual({});
    expect(latest.status).toBe('disconnected');
  });

  it('schedules no reconnect timer when the transport is disabled', async () => {
    await mount({ symbols: ['AAPL', 'NVDA'] });

    // No socket was opened, so onclose never fires and no backoff is armed.
    expect(wsManager._stockReconnectTimer).toBeNull();
    expect(wsManager._cryptoReconnectTimer).toBeNull();
    expect(wsManager._transportDisabled).toBe(true);
  });

  it('mount → symbol change → unmount never throws and constructs no socket', async () => {
    await mount({ symbols: ['AAPL'] });
    await rerender({ symbols: ['AAPL', 'NVDA', 'GOOG'] });
    await act(async () => { root.unmount(); });
    root = null;

    expect(wsCtorCount).toBe(0);
  });

  it('the value handed to consumers carries no token or vendor URL', async () => {
    await mount({ symbols: ['AAPL', 'NVDA'] });

    const serialized = JSON.stringify(latest);
    expect(serialized).not.toMatch(/api_token/i);
    expect(serialized).not.toMatch(/wss:\/\//i);
    expect(serialized).not.toMatch(/eodhistoricaldata/i);
  });

  it('disabled hook (enabled:false) is inert — no fetch, no socket, empty prices', async () => {
    await mount({ symbols: ['AAPL', 'NVDA'], enabled: false });

    expect(fetchSpy.mock.calls.length).toBe(0);
    expect(wsCtorCount).toBe(0);
    expect(latest.prices).toEqual({});
    expect(latest.status).toBe('disconnected');
  });
});
