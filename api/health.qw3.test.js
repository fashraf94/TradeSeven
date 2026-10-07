// @vitest-environment node
//
// api/health.qw3.test.js
//
// EODHD Quick Wins QW-3 (build report docs/audits/20261007_BUILD_EODHD_QUICK_WINS.md):
// the keep-warm workflow stops spending EODHD calls. NOT flagged.
//
//   • api/health.js makes its EODHD probe only on ?deep=1; the default answer
//     reports EODHD as `not_checked` and makes NO outbound vendor request;
//   • .github/workflows/main.yml no longer pings /api/stocks/prices or
//     /api/crypto/prices, and its health ping carries no ?deep=1;
//   • every other health check is still run.
//
// The REAL handler; the network and the security middleware are the only stubs.
// Firebase env vars are unset, so checkFirebase answers `missing` without I/O.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

vi.mock('./_utils/security.js', () => ({ applySecurityMiddleware: () => false }));

const { default: handler } = await import('./health.js');

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKFLOW = readFileSync(resolve(HERE, '..', '.github', 'workflows', 'main.yml'), 'utf8');

function makeRes() {
  const res = { statusCode: null, headers: {}, body: undefined };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.removeHeader = (k) => { delete res.headers[k]; };
  return res;
}

let fetchSpy;
const saved = {};
beforeEach(() => {
  for (const k of ['EODHD_API_KEY', 'FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY', 'CLAUDE_API_KEY']) saved[k] = process.env[k];
  process.env.EODHD_API_KEY = 'test-key';
  delete process.env.FIREBASE_PROJECT_ID;
  delete process.env.FIREBASE_CLIENT_EMAIL;
  delete process.env.FIREBASE_PRIVATE_KEY;
  process.env.CLAUDE_API_KEY = 'present';
  fetchSpy = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ code: 'AAPL.US', close: 200, previousClose: 199 }) }));
  globalThis.fetch = fetchSpy;
});
afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
});

describe('QW-3 — api/health.js', () => {
  it('without ?deep=1: no outbound EODHD request, EODHD reported not_checked, every other check still runs', async () => {
    const res = makeRes();
    await handler({ method: 'GET', query: {}, headers: {} }, res);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.body.checks.eodhd.status).toBe('not_checked');
    expect(res.body.checks.firebase.status).toBe('missing');
    expect(res.body.checks.claude.status).toBe('ok');
    expect(res.body.checks.cache).toHaveProperty('memoryEntries');
    // Overall status is judged on the checks that ran: firebase is missing here.
    expect(res.body.status).toBe('degraded');
  });

  it('a not-requested EODHD probe never degrades the overall status by itself', async () => {
    process.env.FIREBASE_PROJECT_ID = 'p';
    process.env.FIREBASE_CLIENT_EMAIL = 'e';
    process.env.FIREBASE_PRIVATE_KEY = 'k';
    vi.resetModules();
    vi.doMock('firebase-admin/app', () => ({ getApps: () => [{}], initializeApp: () => {}, cert: () => ({}) }));
    vi.doMock('firebase-admin/firestore', () => ({
      getFirestore: () => ({ collection: () => ({ limit: () => ({ get: async () => ({ size: 1 }) }) }) }),
    }));
    vi.doMock('./_utils/security.js', () => ({ applySecurityMiddleware: () => false }));
    const { default: fresh } = await import('./health.js');
    const res = makeRes();
    await fresh({ method: 'GET', query: {}, headers: {} }, res);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(res.body.checks.firebase.status).toBe('ok');
    expect(res.body.status).toBe('healthy');
    vi.doUnmock('firebase-admin/app');
    vi.doUnmock('firebase-admin/firestore');
  });

  it('with ?deep=1: exactly one EODHD probe (real-time AAPL), and its result counts', async () => {
    const res = makeRes();
    await handler({ method: 'GET', query: { deep: '1' }, headers: {} }, res);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0][0])).toMatch(/^https:\/\/eodhd\.com\/api\/real-time\/AAPL\.US\?/);
    expect(res.body.checks.eodhd.status).toBe('ok');
  });

  it('only the literal ?deep=1 opts in', async () => {
    for (const deep of ['true', '0', 'yes', '']) {
      const res = makeRes();
      await handler({ method: 'GET', query: { deep }, headers: {} }, res);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('QW-3 — .github/workflows/main.yml', () => {
  it('no longer references /api/stocks/prices or /api/crypto/prices', () => {
    expect(WORKFLOW).not.toContain('/api/stocks/prices');
    expect(WORKFLOW).not.toContain('/api/crypto/prices');
  });

  it('still pings /api/health, without ?deep=1', () => {
    expect(WORKFLOW).toMatch(/curl[\s\S]*"https:\/\/trade-seven-cyan\.vercel\.app\/api\/health"/);
    expect(WORKFLOW).not.toMatch(/api\/health\?[^"]*deep/);
  });

  it('the header cost comment is corrected: 216 pings a day, zero EODHD calls', () => {
    expect(WORKFLOW).not.toContain('~864');
    expect(WORKFLOW).not.toContain('< 1%');
    expect(WORKFLOW).toContain('216 pings/day');
    expect(WORKFLOW).toContain('ZERO EODHD calls');
  });
});
