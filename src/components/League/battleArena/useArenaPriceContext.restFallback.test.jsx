// @vitest-environment jsdom
//
// Containment B1 — BEHAVIORAL proof of the shared active price-fallback idiom.
//
// useArenaPriceContext is the deliberate PARALLEL (see its header) of the inline
// price assembly used by the live agent product:
//   * AgentBattleScreen.jsx:472-530  (useWebSocketPrices + 60s stockAPI poll +
//                                      `wsPrices empty ? currentPrices : {...}`)
//   * Tournament/Flat6BattleView.jsx  (same three parts)
// All three call the SAME seam (useWebSocketPrices) and the SAME REST source
// (stockAPI.getMultipleStockPrices). Testing this hook therefore characterizes
// the fallback the whole active surface relies on, without mounting a 20-child
// screen.
//
// The claim under test: with the browser WebSocket transport disabled (B1), the
// hook must still deliver usable prices — sourced entirely from the same-origin
// REST poll — with no socket, no fabrication, and no crash. This is the intended
// B1 degradation (sub-second WS overlay → 60s REST), NOT a functional break.
//
// Real useWebSocketPrices + real wsManager are used (only fetch + the WebSocket
// ctor are stubbed); stockAPI.getMultipleStockPrices is mocked to stand in for
// the same-origin REST proxy.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

const mocks = vi.hoisted(() => ({ getMultipleStockPrices: vi.fn() }));

vi.mock('../../../services/eodhdAPI', () => ({
  stockAPI: {
    getMultipleStockPrices: mocks.getMultipleStockPrices,
    getMultipleCryptoPrices: vi.fn(async () => ({})),
  },
}));
// Deterministic, Date-free activation-day gate (irrelevant to the price path).
vi.mock('../../../utils/flat6BattleEnrichment', () => ({
  isFlat6ActivationDay: () => false,
}));

import { useArenaPriceContext } from './useArenaPriceContext';
import { wsManager } from '../../../services/websocketService';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let fetchSpy;
let wsCtorCount;
let container;
let root;
let latest;

// Stable, content-keyed symbol array (the hook documents it must be stable).
const SYMBOLS = ['AAPL', 'NVDA'];
const BATTLE = { id: 'flat6-1' };

function Probe({ symbols, battle }) {
  latest = useArenaPriceContext(symbols, battle);
  return null;
}

async function flush() {
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

async function mount(symbols = SYMBOLS, battle = BATTLE) {
  container = document.createElement('div');
  document.body.appendChild(container);
  await act(async () => {
    root = createRoot(container);
    root.render(<Probe symbols={symbols} battle={battle} />);
  });
  await flush();
}

beforeEach(() => {
  wsManager._transportDisabled = false;
  wsManager._wsUrls = null;
  wsManager._urlPromise = null;
  wsManager._stockSubscriptions = {};
  wsManager._cryptoSubscriptions = {};
  wsManager._stockStatus = 'disconnected';
  wsManager._cryptoStatus = 'disconnected';
  wsManager._priceCache.clear();

  wsCtorCount = 0;
  globalThis.WebSocket = class {
    constructor() { wsCtorCount++; }
    close() {}
    send() {}
  };
  globalThis.WebSocket.OPEN = 1;
  globalThis.WebSocket.CONNECTING = 0;

  fetchSpy = vi.fn(async () => ({
    ok: true,
    json: async () => ({ available: false, transport: 'rest' }),
  }));
  globalThis.fetch = fetchSpy;

  mocks.getMultipleStockPrices.mockReset();
  mocks.getMultipleStockPrices.mockResolvedValue({
    AAPL: { price: 150, previousClose: 149 },
    NVDA: { price: 900, previousClose: 890 },
  });

  latest = undefined;
});

afterEach(() => {
  if (root) act(() => root.unmount());
  if (container) container.remove();
  container = null;
  root = null;
  wsManager.destroy();
  vi.restoreAllMocks();
});

describe('useArenaPriceContext — REST fallback when WS transport is disabled (B1)', () => {
  it('fires the same-origin REST poll for the required symbols', async () => {
    await mount();
    expect(mocks.getMultipleStockPrices).toHaveBeenCalled();
    expect(mocks.getMultipleStockPrices.mock.calls[0][0]).toEqual(SYMBOLS);
  });

  it('effectivePrices are the REST prices (the WS overlay is empty, so it falls through)', async () => {
    await mount();
    // effectivePrices === currentPrices (REST) because wsPrices is {}.
    expect(latest.effectivePrices).toEqual({ AAPL: 150, NVDA: 900 });
    expect(latest.previousClosePrices).toEqual({ AAPL: 149, NVDA: 890 });
    expect(latest.pricesLoaded).toBe(true);
  });

  it('delivers usable prices with ZERO WebSocket connections opened', async () => {
    await mount();
    expect(wsCtorCount).toBe(0);
    // Prices still present — the screen is not blank without the socket.
    expect(Object.keys(latest.effectivePrices).length).toBe(SYMBOLS.length);
  });

  it('a REST failure degrades to empty (no crash, no fabricated price)', async () => {
    mocks.getMultipleStockPrices.mockRejectedValueOnce(new Error('EODHD 401'));
    await mount();
    // fetchPrices swallows the error; no prices, no throw, still no socket.
    expect(latest.effectivePrices).toEqual({});
    expect(latest.pricesLoaded).toBe(false);
    expect(wsCtorCount).toBe(0);
  });

  it('empty symbol list does not poll or open a socket', async () => {
    await mount([], BATTLE);
    expect(mocks.getMultipleStockPrices).not.toHaveBeenCalled();
    expect(wsCtorCount).toBe(0);
    expect(latest.effectivePrices).toEqual({});
    expect(latest.pricesLoaded).toBe(false);
  });
});
