// @vitest-environment node
//
// api/crypto/prices.quoteOrigin.test.js
//
// Shadow vs CPU quote integrity (spec SHADOW_CPU_PLACEHOLDER_PRICE_SPEC_V1_6.md
// §4.1, OFF-2, ON-F1a; build record
// docs/audits/20261002_SHADOW_CPU_QUOTE_INTEGRITY_BUILD_REVIEW.md).
//
// The crypto twin of api/stocks/prices.quoteOrigin.test.js: the REAL crypto
// proxy handler, network and security middleware stubbed, the real server
// cache reset per test. OFF references were captured at the pre-build SHA by
// running this file there with SHADOW_OFF_CAPTURE_DIR set.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

vi.mock('../_utils/security.js', () => ({ applySecurityMiddleware: () => false }));

export const OFF_REFERENCE_SHA = '44d0c63eba4e3099552d3ec3dbde6a89660a7e06';
const CAPTURE_DIR = process.env.SHADOW_OFF_CAPTURE_DIR || '';
function offReference(name, actual, expected) {
  if (CAPTURE_DIR) {
    writeFileSync(path.join(CAPTURE_DIR, `crypto-proxy.${name}.json`), JSON.stringify(actual, null, 1));
    return;
  }
  expect(actual).toEqual(expected);
}

const tag = (value) => JSON.parse(JSON.stringify(value, (k, v) => {
  if (v === undefined) return '__undefined__';
  if (typeof v === 'number' && Number.isNaN(v)) return '__NaN__';
  if (v === Infinity) return '__Infinity__';
  if (v === -Infinity) return '__-Infinity__';
  if (Object.is(v, -0)) return '__-0__';
  return v;
}));

const withoutOrigins = (body) => {
  if (!body || typeof body !== 'object' || !body.prices) return body;
  const prices = {};
  for (const [sym, rec] of Object.entries(body.prices)) {
    const { quoteOrigin, ...rest } = rec;
    prices[sym] = rest;
  }
  return { ...body, prices };
};

function makeRes() {
  const res = { statusCode: null, headers: {}, removed: [], body: undefined };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.removeHeader = (k) => { res.removed.push(k); delete res.headers[k]; };
  return res;
}

let handler;
let fetchCalls;
let respond;
beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-01T15:00:00.000Z'));
  process.env.EODHD_API_KEY = 'test-key';
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  fetchCalls = [];
  respond = null;
  globalThis.fetch = vi.fn(async (url) => {
    fetchCalls.push(String(url));
    return respond(url);
  });
  handler = (await import('./prices.js')).default;
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  delete globalThis.fetch;
});

const okJson = (payload) => () => ({ ok: true, status: 200, json: async () => payload });

async function call(symbols, extra = {}) {
  const res = makeRes();
  await handler({ query: { symbols, ...extra }, method: 'GET', headers: {} }, res);
  return res;
}
const snapshot = (res) => tag({ status: res.statusCode, headers: res.headers, removed: res.removed, body: res.body });
const snapshotOff = (res) => tag({ status: res.statusCode, headers: res.headers, removed: res.removed, body: withoutOrigins(res.body) });

const BASE_ITEM = {
  code: 'BTC-USD.CC', open: 60500, change: 300, change_p: 0.5, high: 61200, low: 60100, volume: 99, timestamp: 1790000000,
};

const ITEM_FIXTURES = {
  genuine: { ...BASE_ITEM, close: 61000, previousClose: 60700 },
  closeNull: { ...BASE_ITEM, close: null, previousClose: 60700 },
  closeZero: { ...BASE_ITEM, close: 0, previousClose: 60700 },
  closeAbsent: { ...BASE_ITEM, previousClose: 60700 },
  genuineEqual: { ...BASE_ITEM, close: 60700, previousClose: 60700 },
  closeNA: { ...BASE_ITEM, close: 'NA', previousClose: 60700 },
  previousCloseNA: { ...BASE_ITEM, close: 61000, previousClose: 'NA' },
  timestampNA: { ...BASE_ITEM, close: 61000, previousClose: 60700, timestamp: 'NA' },
  timestampAbsent: (() => { const { timestamp, ...i } = { ...BASE_ITEM, close: 61000, previousClose: 60700 }; return i; })(),
  closeNaN: { ...BASE_ITEM, close: Number.NaN, previousClose: 60700 },
  closeInfinity: { ...BASE_ITEM, close: Infinity, previousClose: 60700 },
  previousCloseNaN: { ...BASE_ITEM, close: 61000, previousClose: Number.NaN },
  previousCloseInfinity: { ...BASE_ITEM, close: 61000, previousClose: Infinity },
  closeNegative: { ...BASE_ITEM, close: -5, previousClose: 60700 },
  bothMissing: { ...BASE_ITEM, close: 0, previousClose: 0 },
  previousCloseAbsent: { ...BASE_ITEM, close: 61000 },
  // high/low pass through raw on this proxy (no `|| 0`), so an absent one stays absent.
  extremesAbsent: (() => { const { high, low, ...i } = { ...BASE_ITEM, close: 61000, previousClose: 60700 }; return i; })(),
  genuineEqualsDefault: { ...BASE_ITEM, close: 1, previousClose: 1 },
};

// BEGIN GENERATED OFF REFERENCES — captured at the pre-build SHA 44d0c63eba4e3099552d3ec3dbde6a89660a7e06 (26 entries).
// Regenerate ONLY by re-running this file's OFF rows at that SHA with
// SHADOW_OFF_CAPTURE_DIR set; never by blessing build output.
const OFF = {
 "cacheHit": {
  "fetchCalls": [
   "https://eodhd.com/api/real-time/BTC-USD.CC?api_token=test-key&fmt=json"
  ],
  "first": {
   "body": {
    "count": 1,
    "prices": {
     "BTC": {
      "change": 300,
      "changePercent": 0.5,
      "high": 61200,
      "low": 60100,
      "open": 60500,
      "previousClose": 60700,
      "price": 61000,
      "timestamp": 1790000000,
      "volume": 99
     }
    },
    "success": true
   },
   "headers": {
    "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30"
   },
   "removed": [
    "Pragma",
    "Expires"
   ],
   "status": 200
  },
  "second": {
   "body": {
    "count": 1,
    "prices": {
     "BTC": {
      "change": 300,
      "changePercent": 0.5,
      "high": 61200,
      "low": 60100,
      "open": 60500,
      "previousClose": 60700,
      "price": 61000,
      "timestamp": 1790000000,
      "volume": 99
     }
    },
    "success": true
   },
   "headers": {
    "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30"
   },
   "removed": [
    "Pragma",
    "Expires"
   ],
   "status": 200
  }
 },
 "errors": {
  "noKey": {
   "body": {
    "error": "API not configured"
   },
   "headers": {},
   "removed": [],
   "status": 500
  },
  "noSymbols": {
   "body": {
    "error": "Missing symbols parameter"
   },
   "headers": {},
   "removed": [],
   "status": 400
  }
 },
 "item.bothMissing": {
  "body": {
   "count": 1,
   "prices": {
    "BTC": {
     "change": 300,
     "changePercent": 0.5,
     "high": 61200,
     "low": 60100,
     "open": 60500,
     "previousClose": 0,
     "price": 0,
     "timestamp": 1790000000,
     "volume": 99
    }
   },
   "success": true
  },
  "headers": {
   "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30"
  },
  "removed": [
   "Pragma",
   "Expires"
  ],
  "status": 200
 },
 "item.closeAbsent": {
  "body": {
   "count": 1,
   "prices": {
    "BTC": {
     "change": 300,
     "changePercent": 0.5,
     "high": 61200,
     "low": 60100,
     "open": 60500,
     "previousClose": 60700,
     "price": 60700,
     "timestamp": 1790000000,
     "volume": 99
    }
   },
   "success": true
  },
  "headers": {
   "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30"
  },
  "removed": [
   "Pragma",
   "Expires"
  ],
  "status": 200
 },
 "item.closeInfinity": {
  "body": {
   "count": 1,
   "prices": {
    "BTC": {
     "change": 300,
     "changePercent": 0.5,
     "high": 61200,
     "low": 60100,
     "open": 60500,
     "previousClose": 60700,
     "price": "__Infinity__",
     "timestamp": 1790000000,
     "volume": 99
    }
   },
   "success": true
  },
  "headers": {
   "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30"
  },
  "removed": [
   "Pragma",
   "Expires"
  ],
  "status": 200
 },
 "item.closeNA": {
  "body": {
   "count": 1,
   "prices": {
    "BTC": {
     "change": 300,
     "changePercent": 0.5,
     "high": 61200,
     "low": 60100,
     "open": 60500,
     "previousClose": 60700,
     "price": "NA",
     "timestamp": 1790000000,
     "volume": 99
    }
   },
   "success": true
  },
  "headers": {
   "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30"
  },
  "removed": [
   "Pragma",
   "Expires"
  ],
  "status": 200
 },
 "item.closeNaN": {
  "body": {
   "count": 1,
   "prices": {
    "BTC": {
     "change": 300,
     "changePercent": 0.5,
     "high": 61200,
     "low": 60100,
     "open": 60500,
     "previousClose": 60700,
     "price": 60700,
     "timestamp": 1790000000,
     "volume": 99
    }
   },
   "success": true
  },
  "headers": {
   "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30"
  },
  "removed": [
   "Pragma",
   "Expires"
  ],
  "status": 200
 },
 "item.closeNegative": {
  "body": {
   "count": 1,
   "prices": {
    "BTC": {
     "change": 300,
     "changePercent": 0.5,
     "high": 61200,
     "low": 60100,
     "open": 60500,
     "previousClose": 60700,
     "price": -5,
     "timestamp": 1790000000,
     "volume": 99
    }
   },
   "success": true
  },
  "headers": {
   "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30"
  },
  "removed": [
   "Pragma",
   "Expires"
  ],
  "status": 200
 },
 "item.closeNull": {
  "body": {
   "count": 1,
   "prices": {
    "BTC": {
     "change": 300,
     "changePercent": 0.5,
     "high": 61200,
     "low": 60100,
     "open": 60500,
     "previousClose": 60700,
     "price": 60700,
     "timestamp": 1790000000,
     "volume": 99
    }
   },
   "success": true
  },
  "headers": {
   "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30"
  },
  "removed": [
   "Pragma",
   "Expires"
  ],
  "status": 200
 },
 "item.closeZero": {
  "body": {
   "count": 1,
   "prices": {
    "BTC": {
     "change": 300,
     "changePercent": 0.5,
     "high": 61200,
     "low": 60100,
     "open": 60500,
     "previousClose": 60700,
     "price": 60700,
     "timestamp": 1790000000,
     "volume": 99
    }
   },
   "success": true
  },
  "headers": {
   "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30"
  },
  "removed": [
   "Pragma",
   "Expires"
  ],
  "status": 200
 },
 "item.extremesAbsent": {
  "body": {
   "count": 1,
   "prices": {
    "BTC": {
     "change": 300,
     "changePercent": 0.5,
     "high": "__undefined__",
     "low": "__undefined__",
     "open": 60500,
     "previousClose": 60700,
     "price": 61000,
     "timestamp": 1790000000,
     "volume": 99
    }
   },
   "success": true
  },
  "headers": {
   "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30"
  },
  "removed": [
   "Pragma",
   "Expires"
  ],
  "status": 200
 },
 "item.genuine": {
  "body": {
   "count": 1,
   "prices": {
    "BTC": {
     "change": 300,
     "changePercent": 0.5,
     "high": 61200,
     "low": 60100,
     "open": 60500,
     "previousClose": 60700,
     "price": 61000,
     "timestamp": 1790000000,
     "volume": 99
    }
   },
   "success": true
  },
  "headers": {
   "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30"
  },
  "removed": [
   "Pragma",
   "Expires"
  ],
  "status": 200
 },
 "item.genuineEqual": {
  "body": {
   "count": 1,
   "prices": {
    "BTC": {
     "change": 300,
     "changePercent": 0.5,
     "high": 61200,
     "low": 60100,
     "open": 60500,
     "previousClose": 60700,
     "price": 60700,
     "timestamp": 1790000000,
     "volume": 99
    }
   },
   "success": true
  },
  "headers": {
   "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30"
  },
  "removed": [
   "Pragma",
   "Expires"
  ],
  "status": 200
 },
 "item.genuineEqualsDefault": {
  "body": {
   "count": 1,
   "prices": {
    "BTC": {
     "change": 300,
     "changePercent": 0.5,
     "high": 61200,
     "low": 60100,
     "open": 60500,
     "previousClose": 1,
     "price": 1,
     "timestamp": 1790000000,
     "volume": 99
    }
   },
   "success": true
  },
  "headers": {
   "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30"
  },
  "removed": [
   "Pragma",
   "Expires"
  ],
  "status": 200
 },
 "item.previousCloseAbsent": {
  "body": {
   "count": 1,
   "prices": {
    "BTC": {
     "change": 300,
     "changePercent": 0.5,
     "high": 61200,
     "low": 60100,
     "open": 60500,
     "previousClose": 0,
     "price": 61000,
     "timestamp": 1790000000,
     "volume": 99
    }
   },
   "success": true
  },
  "headers": {
   "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30"
  },
  "removed": [
   "Pragma",
   "Expires"
  ],
  "status": 200
 },
 "item.previousCloseInfinity": {
  "body": {
   "count": 1,
   "prices": {
    "BTC": {
     "change": 300,
     "changePercent": 0.5,
     "high": 61200,
     "low": 60100,
     "open": 60500,
     "previousClose": "__Infinity__",
     "price": 61000,
     "timestamp": 1790000000,
     "volume": 99
    }
   },
   "success": true
  },
  "headers": {
   "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30"
  },
  "removed": [
   "Pragma",
   "Expires"
  ],
  "status": 200
 },
 "item.previousCloseNA": {
  "body": {
   "count": 1,
   "prices": {
    "BTC": {
     "change": 300,
     "changePercent": 0.5,
     "high": 61200,
     "low": 60100,
     "open": 60500,
     "previousClose": "NA",
     "price": 61000,
     "timestamp": 1790000000,
     "volume": 99
    }
   },
   "success": true
  },
  "headers": {
   "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30"
  },
  "removed": [
   "Pragma",
   "Expires"
  ],
  "status": 200
 },
 "item.previousCloseNaN": {
  "body": {
   "count": 1,
   "prices": {
    "BTC": {
     "change": 300,
     "changePercent": 0.5,
     "high": 61200,
     "low": 60100,
     "open": 60500,
     "previousClose": 0,
     "price": 61000,
     "timestamp": 1790000000,
     "volume": 99
    }
   },
   "success": true
  },
  "headers": {
   "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30"
  },
  "removed": [
   "Pragma",
   "Expires"
  ],
  "status": 200
 },
 "item.timestampAbsent": {
  "body": {
   "count": 1,
   "prices": {
    "BTC": {
     "change": 300,
     "changePercent": 0.5,
     "high": 61200,
     "low": 60100,
     "open": 60500,
     "previousClose": 60700,
     "price": 61000,
     "timestamp": "__undefined__",
     "volume": 99
    }
   },
   "success": true
  },
  "headers": {
   "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30"
  },
  "removed": [
   "Pragma",
   "Expires"
  ],
  "status": 200
 },
 "item.timestampNA": {
  "body": {
   "count": 1,
   "prices": {
    "BTC": {
     "change": 300,
     "changePercent": 0.5,
     "high": 61200,
     "low": 60100,
     "open": 60500,
     "previousClose": 60700,
     "price": 61000,
     "timestamp": "NA",
     "volume": 99
    }
   },
   "success": true
  },
  "headers": {
   "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30"
  },
  "removed": [
   "Pragma",
   "Expires"
  ],
  "status": 200
 },
 "malformed": {
  "body": {
   "error": "Failed to fetch prices",
   "message": "Unexpected token"
  },
  "headers": {},
  "removed": [],
  "status": 500
 },
 "multi": {
  "body": {
   "count": 3,
   "prices": {
    "BTC": {
     "change": 300,
     "changePercent": 0.5,
     "high": 61200,
     "low": 60100,
     "open": 60500,
     "previousClose": 60700,
     "price": 61000,
     "timestamp": 1790000000,
     "volume": 99
    },
    "ETH": {
     "change": 300,
     "changePercent": 0.5,
     "high": 61200,
     "low": 60100,
     "open": 60500,
     "previousClose": 2480,
     "price": 2500,
     "timestamp": 1790000000,
     "volume": 99
    },
    "SOL": {
     "change": 300,
     "changePercent": 0.5,
     "high": 61200,
     "low": 60100,
     "open": 60500,
     "previousClose": 150,
     "price": 150,
     "timestamp": 1790000000,
     "volume": 99
    }
   },
   "success": true
  },
  "fetchCalls": [
   "https://eodhd.com/api/real-time/eth-USD.CC,SOL-USD.CC,BTC-USD.CC?api_token=test-key&fmt=json"
  ],
  "headers": {
   "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30"
  },
  "removed": [
   "Pragma",
   "Expires"
  ],
  "status": 200
 },
 "noCache": {
  "fetchCalls": [
   "https://eodhd.com/api/real-time/BTC-USD.CC?api_token=test-key&fmt=json",
   "https://eodhd.com/api/real-time/BTC-USD.CC?api_token=test-key&fmt=json"
  ],
  "first": {
   "body": {
    "count": 1,
    "prices": {
     "BTC": {
      "change": 300,
      "changePercent": 0.5,
      "high": 61200,
      "low": 60100,
      "open": 60500,
      "previousClose": 60700,
      "price": 61000,
      "timestamp": 1790000000,
      "volume": 99
     }
    },
    "success": true
   },
   "headers": {},
   "removed": [],
   "status": 200
  },
  "second": {
   "body": {
    "count": 1,
    "prices": {
     "BTC": {
      "change": 300,
      "changePercent": 0.5,
      "high": 61200,
      "low": 60100,
      "open": 60500,
      "previousClose": 60700,
      "price": 61000,
      "timestamp": 1790000000,
      "volume": 99
     }
    },
    "success": true
   },
   "headers": {},
   "removed": [],
   "status": 200
  }
 },
 "nonOk": {
  "fetchCalls": [
   "https://eodhd.com/api/real-time/BTC-USD.CC?api_token=test-key&fmt=json",
   "https://eodhd.com/api/real-time/BTC-USD.CC?api_token=test-key&fmt=json"
  ],
  "first": {
   "body": {
    "error": "Failed to fetch prices",
    "message": "EODHD responded with 502"
   },
   "headers": {},
   "removed": [],
   "status": 500
  },
  "second": {
   "body": {
    "error": "Failed to fetch prices",
    "message": "EODHD responded with 502"
   },
   "headers": {},
   "removed": [],
   "status": 500
  }
 },
 "oldCacheRecord": {
  "body": {
   "count": 1,
   "prices": {
    "BTC": {
     "change": 0,
     "changePercent": 0,
     "high": "__undefined__",
     "low": "__undefined__",
     "open": 0,
     "previousClose": 0,
     "price": 61000,
     "timestamp": "__undefined__",
     "volume": "__undefined__"
    }
   },
   "success": true
  },
  "fetchCalls": [],
  "headers": {
   "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30"
  },
  "removed": [
   "Pragma",
   "Expires"
  ],
  "status": 200
 },
 "singleObject": {
  "body": {
   "count": 1,
   "prices": {
    "BTC": {
     "change": 300,
     "changePercent": 0.5,
     "high": 61200,
     "low": 60100,
     "open": 60500,
     "previousClose": 60700,
     "price": 61000,
     "timestamp": 1790000000,
     "volume": 99
    }
   },
   "success": true
  },
  "headers": {
   "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30"
  },
  "removed": [
   "Pragma",
   "Expires"
  ],
  "status": 200
 }
};
// END GENERATED OFF REFERENCES

describe('OFF-2 — the crypto proxy output is unchanged apart from quoteOrigin', () => {
  for (const [name, item] of Object.entries(ITEM_FIXTURES)) {
    it(`OFF ${name}: status, headers and every existing field match the pre-build capture`, async () => {
      respond = okJson([item]);
      const res = await call('BTC');
      offReference(`item.${name}`, snapshotOff(res), OFF[`item.${name}`]);
    });
  }

  it('OFF multi: array response, record without a code skipped, symbol order preserved', async () => {
    respond = okJson([
      { ...BASE_ITEM, code: 'ETH-USD.CC', close: 2500, previousClose: 2480 },
      { close: 5 },
      { ...BASE_ITEM, code: 'SOL-USD.CC', close: 0, previousClose: 150 },
      { ...BASE_ITEM, code: 'BTC-USD.CC', close: 61000, previousClose: 60700 },
    ]);
    const res = await call('eth,SOL,BTC');
    offReference('multi', { ...snapshotOff(res), fetchCalls }, OFF.multi);
  });

  it('OFF single object response (not an array)', async () => {
    respond = okJson({ ...BASE_ITEM, close: 61000, previousClose: 60700 });
    const res = await call('BTC');
    offReference('singleObject', snapshotOff(res), OFF.singleObject);
  });

  it('OFF non-OK provider response → 500 error body', async () => {
    respond = () => ({ ok: false, status: 502, json: async () => ({}) });
    const res = await call('BTC');
    const again = await call('BTC');
    offReference('nonOk', { first: snapshot(res), second: snapshot(again), fetchCalls }, OFF.nonOk);
  });

  it('OFF malformed provider response (json throws) → 500', async () => {
    respond = () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token'); } });
    const res = await call('BTC');
    offReference('malformed', snapshot(res), OFF.malformed);
  });

  it('OFF missing symbols and missing key keep their exact errors', async () => {
    const noSymbols = await call(undefined);
    delete process.env.EODHD_API_KEY;
    const noKey = await call('BTC');
    offReference('errors', { noSymbols: snapshot(noSymbols), noKey: snapshot(noKey) }, OFF.errors);
  });

  it('OFF cache hit: the second identical request is served from the server cache, one fetch', async () => {
    respond = okJson([{ ...BASE_ITEM, close: 61000, previousClose: 60700 }]);
    const first = await call('BTC');
    const second = await call('BTC');
    offReference('cacheHit', { first: snapshotOff(first), second: snapshotOff(second), fetchCalls }, OFF.cacheHit);
  });

  it('OFF nocache=1 bypasses the cache and sets no cache headers', async () => {
    respond = okJson([{ ...BASE_ITEM, close: 61000, previousClose: 60700 }]);
    const first = await call('BTC', { nocache: '1' });
    const second = await call('BTC', { nocache: '1' });
    offReference('noCache', { first: snapshotOff(first), second: snapshotOff(second), fetchCalls }, OFF.noCache);
  });

  it('OFF an OLD (pre-upgrade) server-cache record is served exactly as stored — never decorated', async () => {
    const { setInCache } = await import('../_utils/serverCache.js');
    const old = {
      success: true,
      prices: { BTC: { price: 61000, previousClose: 0, open: 0, change: 0, changePercent: 0, high: undefined, low: undefined, volume: undefined, timestamp: undefined } },
      count: 1,
    };
    setInCache('crypto_prices_BTC', old, 60);
    const res = await call('BTC');
    expect(res.body.prices.BTC).not.toHaveProperty('quoteOrigin');
    expect(res.body).toBe(old);
    offReference('oldCacheRecord', { ...snapshot(res), fetchCalls }, OFF.oldCacheRecord);
  });
});

// ─── ON-F1a — value-specific origins at the real crypto proxy ───────────────

const EXPECTED_ORIGINS = {
  genuine: ['provider-close', 'provider-previous-close'],
  closeNull: ['provider-previous-close', 'provider-previous-close'],
  closeZero: ['provider-previous-close', 'provider-previous-close'],
  closeAbsent: ['provider-previous-close', 'provider-previous-close'],
  genuineEqual: ['provider-close', 'provider-previous-close'],
  closeNA: ['provider-close', 'provider-previous-close'],
  previousCloseNA: ['provider-close', 'provider-previous-close'],
  timestampNA: ['provider-close', 'provider-previous-close'],
  timestampAbsent: ['provider-close', 'provider-previous-close'],
  closeNaN: ['provider-previous-close', 'provider-previous-close'],
  closeInfinity: ['provider-close', 'provider-previous-close'],
  previousCloseNaN: ['provider-close', 'missing'],
  previousCloseInfinity: ['provider-close', 'provider-previous-close'],
  closeNegative: ['provider-close', 'provider-previous-close'],
  bothMissing: ['missing', 'missing'],
  previousCloseAbsent: ['provider-close', 'missing'],
  extremesAbsent: ['provider-close', 'provider-previous-close'],
  genuineEqualsDefault: ['provider-close', 'provider-previous-close'],
};

describe('ON-F1a — the crypto proxy names the branch that produced each value', () => {
  for (const [name, [priceOrigin, previousCloseOrigin]] of Object.entries(EXPECTED_ORIGINS)) {
    it(`${name}: price ← ${priceOrigin}, previousClose ← ${previousCloseOrigin}`, async () => {
      respond = okJson([ITEM_FIXTURES[name]]);
      const res = await call('BTC');
      expect(res.body.prices.BTC.quoteOrigin).toEqual({ version: 1, price: priceOrigin, previousClose: previousCloseOrigin });
    });
  }

  it('missing close + genuine previousClose: the number is unchanged, current ineligible, close eligible', async () => {
    const { interpretQuote } = await import('../../src/screens/battleView/shadowCpuQuoteIntegrity.js');
    respond = okJson([ITEM_FIXTURES.closeNull]);
    const rec = (await call('BTC')).body.prices.BTC;
    expect(rec.price).toBe(60700);
    const q = interpretQuote(rec, { nowMs: Date.now() });
    expect(q.current).toMatchObject({ qualified: false, reason: 'previous-close-substitution' });
    expect(q.previousClose).toEqual({ genuine: true, reason: 'genuine', value: 60700 });
  });

  it('the metadata rides inside the cached record (cache hit, one fetch)', async () => {
    respond = okJson([ITEM_FIXTURES.genuine]);
    const first = await call('BTC');
    const second = await call('BTC');
    expect(fetchCalls).toHaveLength(1);
    expect(second.body.prices.BTC.quoteOrigin).toEqual({ version: 1, price: 'provider-close', previousClose: 'provider-previous-close' });
    expect(second.body).toBe(first.body);
  });
});
