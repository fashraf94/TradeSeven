// @vitest-environment jsdom
// src/components/Forge/Watchlist/retiredTicker.editor.jsdom.test.jsx
//
// BaggerBomb cleanup C4 (Flash, Oct 27, 2026; #998 MT3-6): the editor's line for
// a save the server refused because it would ADD a retired ticker. The REAL
// auto-save hook and the REAL save indicator run over the REAL service client;
// only fetchWithAuth is a double, so the 400 body is exactly the server's —
// error `retired_ticker` with `symbols` — and the line is read from it.
//
//   - the line names the symbol the player must remove: "KRE is no longer
//     available. Remove it to save.";
//   - it offers no Retry (a retry is refused again until the ticker is gone);
//   - removing the ticker (the edit that failed undone) clears it;
//   - every other failure keeps the generic "Couldn't save" and its Retry.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

const net = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('../../../utils/fetchWithAuth', () => ({ fetchWithAuth: (...args) => net.fetch(...args) }));

import { useWatchlistAutosave } from './useWatchlistAutosave';
import SaveStateIndicator from './SaveStateIndicator';
import { DARK_TOKENS } from '../../../theme/tokens';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const respond = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const REFUSED = respond(400, { error: 'retired_ticker', message: "KRE has left the stock universe and can't be added to a watchlist.", symbols: ['KRE'] });

let api;
function Harness() {
  const { saveState, saveError, queueSave, retry, setBaseline } = useWatchlistAutosave('wl-1');
  api = { queueSave, retry, setBaseline };
  return <SaveStateIndicator tokens={DARK_TOKENS} saveState={saveState} saveError={saveError} onRetry={retry} />;
}

let root;
let host;
const text = () => host.textContent;
const settle = async (ms = 1100) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

beforeEach(() => {
  vi.useFakeTimers();
  net.fetch.mockReset();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => { root.render(<Harness />); });
  api.setBaseline({ tickers: [{ symbol: 'AAPL' }] });
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

describe('C4 — a save refused for a retired ticker', () => {
  it('says which symbol to remove, from the payload, and offers no Retry', async () => {
    net.fetch.mockResolvedValue(REFUSED);
    act(() => api.queueSave({ tickers: [{ symbol: 'AAPL' }, { symbol: 'KRE' }] }));
    await settle();
    expect(text()).toBe('KRE is no longer available. Remove it to save.');
    expect(host.querySelector('button')).toBe(null);
    expect(host.querySelector('[role="alert"]')).not.toBe(null);
    expect(net.fetch).toHaveBeenCalledTimes(1);
  });

  it('removing the ticker (the refused edit undone) clears the line — nothing is left to save', async () => {
    net.fetch.mockResolvedValue(REFUSED);
    act(() => api.queueSave({ tickers: [{ symbol: 'AAPL' }, { symbol: 'KRE' }] }));
    await settle();
    expect(text()).toContain('KRE is no longer available');
    act(() => api.queueSave({ tickers: [{ symbol: 'AAPL' }] })); // back to the stored list
    await settle();
    expect(text()).toBe('');
    expect(net.fetch).toHaveBeenCalledTimes(1); // no PATCH for a no-op
  });

  it('a save that goes through after a refusal clears it and says Saved', async () => {
    net.fetch.mockResolvedValueOnce(REFUSED).mockResolvedValueOnce(respond(200, {}));
    act(() => api.queueSave({ tickers: [{ symbol: 'AAPL' }, { symbol: 'KRE' }] }));
    await settle();
    act(() => api.queueSave({ tickers: [{ symbol: 'AAPL' }, { symbol: 'MSFT' }] }));
    await settle();
    expect(text()).toContain('Saved');
    expect(text()).not.toContain('KRE');
  });

  it('every other failure keeps the generic Couldn\'t save with its Retry', async () => {
    net.fetch.mockResolvedValue(respond(500, { error: 'server_error', message: 'x' }));
    act(() => api.queueSave({ tickers: [{ symbol: 'AAPL' }, { symbol: 'MSFT' }] }));
    await settle();
    expect(text()).toContain("Couldn't save");
    expect(host.querySelector('button')?.textContent).toBe('Retry');
  });

  it('a refusal that names no symbol is the generic failure, never an empty line', async () => {
    net.fetch.mockResolvedValue(respond(400, { error: 'retired_ticker', message: 'x' }));
    act(() => api.queueSave({ tickers: [{ symbol: 'AAPL' }, { symbol: 'KRE' }] }));
    await settle();
    expect(text()).toContain("Couldn't save");
    expect(host.querySelector('button')?.textContent).toBe('Retry');
  });
});
