// api/ws-config.test.js
// Containment B1 — /api/ws-config must NEVER disclose the EODHD token.
//
// These assertions pin the security invariant: no response field, no serialized
// body, and no line of the route source may contain the EODHD token, a vendor
// WebSocket URL, or an `api_token` parameter. The route must also not read the
// EODHD env var at all.

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Security middleware is exercised elsewhere; here we let the handler proceed.
vi.mock('./_utils/security.js', () => ({ applySecurityMiddleware: () => false }));

const { default: handler } = await import('./ws-config.js');

function makeRes() {
  return {
    statusCode: null,
    body: null,
    headers: {},
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
    end() { this.ended = true; return this; },
  };
}

describe('ws-config B1 — no token disclosure', () => {
  it('returns the stable disabled-transport contract, no token-bearing fields', async () => {
    const res = makeRes();
    await handler({ method: 'GET', headers: {} }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ available: false, transport: 'rest' });
    expect(res.body).not.toHaveProperty('stocksUrl');
    expect(res.body).not.toHaveProperty('cryptoUrl');
    expect(res.body).not.toHaveProperty('api_token');
  });

  it('serialized response body contains no api_token, wss URL, or vendor host', async () => {
    const res = makeRes();
    await handler({ method: 'GET', headers: {} }, res);

    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toMatch(/api_token/i);
    expect(serialized).not.toMatch(/eodhistoricaldata/i);
    expect(serialized).not.toMatch(/wss:\/\//i);
  });

  it('sets a no-store, private cache-control header', async () => {
    const res = makeRes();
    await handler({ method: 'GET', headers: {} }, res);
    expect(res.headers['cache-control']).toBe('no-store, private, max-age=0');
  });

  it('rejects non-GET methods', async () => {
    const res = makeRes();
    await handler({ method: 'POST', headers: {} }, res);
    expect(res.statusCode).toBe(405);
  });

  it('the route source never references the EODHD env var, token param, or vendor WS URL', () => {
    const src = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), 'ws-config.js'),
      'utf-8',
    );
    // The comment block may mention "EODHD"; assert the *code* never reads the key.
    expect(src).not.toMatch(/process\.env\.EODHD_API_KEY/);
    expect(src).not.toMatch(/api_token/);
    expect(src).not.toMatch(/ws\.eodhistoricaldata\.com/);
  });
});
