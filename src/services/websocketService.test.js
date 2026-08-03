// @vitest-environment jsdom
// src/services/websocketService.test.js
//
// Containment B1 — the browser WebSocket client must treat `available:false`
// from /api/ws-config as a terminal, token-free, disabled-transport state:
//   * never reconstruct or receive a token / vendor URL,
//   * never open a WebSocket,
//   * never reconnect-storm or hammer /api/ws-config,
//   * fall back to REST (report symbols missing) without fabricating a price.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

import { wsManager, captureRealtimePrices } from './websocketService';

let fetchSpy;
let wsCtorCount;

beforeEach(() => {
  // Reset the singleton's transport state between tests.
  wsManager._transportDisabled = false;
  wsManager._wsUrls = null;
  wsManager._urlPromise = null;
  wsManager._stockSubscriptions = {};
  wsManager._cryptoSubscriptions = {};
  wsManager._priceCache.clear();

  wsCtorCount = 0;
  // Any attempt to open a socket is a B1 violation — count constructions.
  global.WebSocket = class {
    constructor() { wsCtorCount++; }
    close() {}
    send() {}
  };
  global.WebSocket.OPEN = 1;
  global.WebSocket.CONNECTING = 0;

  fetchSpy = vi.fn(async () => ({
    ok: true,
    json: async () => ({ available: false, transport: 'rest' }),
  }));
  global.fetch = fetchSpy;
});

afterEach(() => { vi.restoreAllMocks(); });

describe('websocketService B1 — disabled transport', () => {
  it('probeTransport() returns false and marks the transport disabled', async () => {
    const ok = await wsManager.probeTransport();
    expect(ok).toBe(false);
    expect(wsManager._transportDisabled).toBe(true);
    expect(wsManager._wsUrls).toBeNull();
  });

  it('never reconstructs a vendor URL or token from the config response', async () => {
    await wsManager.probeTransport();
    expect(wsManager._wsUrls).toBeNull();
    const received = await (await fetchSpy.mock.results[0].value).json();
    expect(received).not.toHaveProperty('stocksUrl');
    expect(received).not.toHaveProperty('cryptoUrl');
    expect(JSON.stringify(received)).not.toMatch(/api_token/i);
  });

  it('subscribe() opens no WebSocket when the transport is disabled', async () => {
    // First subscribe probes config (available:false) and must NOT open a socket.
    wsManager.subscribe(['AAPL', 'NVDA']);
    await new Promise(r => setTimeout(r, 0));
    // Subsequent subscribes short-circuit on the disabled flag.
    wsManager.subscribe(['MSFT']);
    await new Promise(r => setTimeout(r, 0));
    expect(wsCtorCount).toBe(0);
  });

  it('captureRealtimePrices falls back to REST (all missing), no fabrication, no socket', async () => {
    const { prices, missing, source } = await captureRealtimePrices(['AAPL', 'NVDA'], 5000);
    expect(prices).toEqual({});
    expect(missing.sort()).toEqual(['AAPL', 'NVDA']);
    expect(source.AAPL).toBe('ws-unavailable');
    expect(wsCtorCount).toBe(0);
  });

  it('does not storm /api/ws-config across repeated subscribes/captures', async () => {
    await wsManager.probeTransport();
    wsManager.subscribe(['AAPL']);
    wsManager.subscribe(['NVDA']);
    await captureRealtimePrices(['MSFT'], 100);
    await new Promise(r => setTimeout(r, 0));
    expect(fetchSpy.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it('websocketService.js source has no hardcoded api_token or EODHD ws URL', () => {
    const src = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), 'websocketService.js'),
      'utf-8',
    );
    expect(src).not.toMatch(/api_token=/);
    expect(src).not.toMatch(/wss:\/\/ws\.eodhistoricaldata\.com/);
  });
});

// Repository/build guard (B1 invariant): no browser-shipped source under src/**
// may contain the EODHD token param or a vendor WebSocket credential URL.
describe('B1 repo guard — no browser-visible EODHD credential surface', () => {
  function collect(dir, acc = []) {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      if (ent.name === 'node_modules' || ent.name.startsWith('.')) continue;
      const full = join(dir, ent.name);
      if (ent.isDirectory()) collect(full, acc);
      // Test files are not shipped in the browser bundle; their assertion
      // strings legitimately contain the guarded patterns.
      else if (/\.test\.(js|jsx|ts|tsx)$/.test(ent.name)) continue;
      else if (/\.(js|jsx|ts|tsx)$/.test(ent.name)) acc.push(full);
    }
    return acc;
  }

  it('no src/** file embeds `api_token=` or the EODHD WebSocket host', () => {
    const srcRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    const offenders = [];
    for (const file of collect(srcRoot)) {
      const text = readFileSync(file, 'utf-8');
      if (/api_token=/.test(text) || /wss:\/\/ws\.eodhistoricaldata\.com/.test(text)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
