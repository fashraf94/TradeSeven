// @vitest-environment node
//
// api/stocks/prices.quoteOrigin.test.js
//
// Shadow vs CPU quote integrity (spec SHADOW_CPU_PLACEHOLDER_PRICE_SPEC_V1_6.md
// §4.1, OFF-2, ON-F1a; build record
// docs/audits/20261002_SHADOW_CPU_QUOTE_INTEGRITY_BUILD_REVIEW.md).
//
// The REAL stock proxy handler, with the network and the security middleware
// as the only boundaries (the server cache is the real module, reset per test).
//
// OFF-2 — every existing key, value, type, status and header is unchanged; the
// ONLY addition is `quoteOrigin` on each price record. The references below
// were captured from the pre-build SHA by running THIS file there with
// SHADOW_OFF_CAPTURE_DIR set (the capture branch of `offReference`), then
// pasted inline. Re-running the capture at the base SHA reproduces them.
//
// ON-F1a — the origin says which branch of the UNCHANGED `||` expression
// produced each field: provider-close / provider-previous-close / missing.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

vi.mock('../_utils/security.js', () => ({ applySecurityMiddleware: () => false }));

export const OFF_REFERENCE_SHA = '44d0c63eba4e3099552d3ec3dbde6a89660a7e06';
const CAPTURE_DIR = process.env.SHADOW_OFF_CAPTURE_DIR || '';
function offReference(name, actual, expected) {
  if (CAPTURE_DIR) {
    writeFileSync(path.join(CAPTURE_DIR, `stocks-proxy.${name}.json`), JSON.stringify(actual, null, 1));
    return;
  }
  expect(actual).toEqual(expected);
}

// Special numbers and undefined survive the comparison as tags, so a NaN
// becoming null (or an undefined key appearing) is visible.
const tag = (value) => JSON.parse(JSON.stringify(value, (k, v) => {
  if (v === undefined) return '__undefined__';
  if (typeof v === 'number' && Number.isNaN(v)) return '__NaN__';
  if (v === Infinity) return '__Infinity__';
  if (v === -Infinity) return '__-Infinity__';
  if (Object.is(v, -0)) return '__-0__';
  return v;
}));

/** Remove ONLY the named metadata (OFF-2: "Only the named metadata may be added"). */
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
  code: 'AAPL.US', open: 101, change: 3, change_p: 2.9, high: 104, low: 99, volume: 1000, timestamp: 1790000000,
};

// Each fixture: one provider item (or payload) → one request. The names are
// the OFF reference keys.
const ITEM_FIXTURES = {
  genuine: { ...BASE_ITEM, close: 103, previousClose: 100 },
  closeNull: { ...BASE_ITEM, close: null, previousClose: 103 },
  closeZero: { ...BASE_ITEM, close: 0, previousClose: 103 },
  closeAbsent: { ...BASE_ITEM, previousClose: 103 },
  genuineEqual: { ...BASE_ITEM, close: 103, previousClose: 103 },
  closeNA: { ...BASE_ITEM, close: 'NA', previousClose: 103 },
  previousCloseNA: { ...BASE_ITEM, close: 103, previousClose: 'NA' },
  timestampNA: { ...BASE_ITEM, close: 103, previousClose: 100, timestamp: 'NA' },
  timestampAbsent: (() => { const { timestamp, ...i } = { ...BASE_ITEM, close: 103, previousClose: 100 }; return i; })(),
  closeNaN: { ...BASE_ITEM, close: Number.NaN, previousClose: 103 },
  closeInfinity: { ...BASE_ITEM, close: Infinity, previousClose: 103 },
  previousCloseNaN: { ...BASE_ITEM, close: 103, previousClose: Number.NaN },
  previousCloseInfinity: { ...BASE_ITEM, close: 103, previousClose: Infinity },
  closeNegative: { ...BASE_ITEM, close: -5, previousClose: 103 },
  bothMissing: { ...BASE_ITEM, close: 0, previousClose: 0 },
  previousCloseAbsent: { ...BASE_ITEM, close: 103 },
  // A genuine value that happens to equal a configured client default (100 is
  // the stock fallback for unknown symbols) — origin follows the branch, not
  // the number.
  genuineEqualsDefault: { ...BASE_ITEM, close: 100, previousClose: 100 },
};

// The OFF references (captured at OFF_REFERENCE_SHA). Filled from the capture.
// BEGIN GENERATED OFF REFERENCES — captured at the pre-build SHA 44d0c63eba4e3099552d3ec3dbde6a89660a7e06 (25 entries).
// Regenerate ONLY by re-running this file's OFF rows at that SHA with
// SHADOW_OFF_CAPTURE_DIR set; never by blessing build output.
const OFF = {
 "cacheHit": {
  "fetchCalls": [
   "https://eodhd.com/api/real-time/AAPL.US?api_token=test-key&fmt=json"
  ],
  "first": {
   "body": {
    "count": 1,
    "dataTimestamp": "2026-09-21T14:13:20.000Z",
    "fetchedAt": "2026-10-01T15:00:00.000Z",
    "prices": {
     "AAPL": {
      "change": 3,
      "changePercent": 2.9,
      "high": 104,
      "low": 99,
      "open": 101,
      "previousClose": 100,
      "price": 103,
      "timestamp": 1790000000,
      "volume": 1000
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
    "dataTimestamp": "2026-09-21T14:13:20.000Z",
    "fetchedAt": "2026-10-01T15:00:00.000Z",
    "prices": {
     "AAPL": {
      "change": 3,
      "changePercent": 2.9,
      "high": 104,
      "low": 99,
      "open": 101,
      "previousClose": 100,
      "price": 103,
      "timestamp": 1790000000,
      "volume": 1000
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
   "dataTimestamp": "2026-09-21T14:13:20.000Z",
   "fetchedAt": "2026-10-01T15:00:00.000Z",
   "prices": {
    "AAPL": {
     "change": 3,
     "changePercent": 2.9,
     "high": 104,
     "low": 99,
     "open": 101,
     "previousClose": 0,
     "price": 0,
     "timestamp": 1790000000,
     "volume": 1000
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
   "dataTimestamp": "2026-09-21T14:13:20.000Z",
   "fetchedAt": "2026-10-01T15:00:00.000Z",
   "prices": {
    "AAPL": {
     "change": 3,
     "changePercent": 2.9,
     "high": 104,
     "low": 99,
     "open": 101,
     "previousClose": 103,
     "price": 103,
     "timestamp": 1790000000,
     "volume": 1000
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
   "dataTimestamp": "2026-09-21T14:13:20.000Z",
   "fetchedAt": "2026-10-01T15:00:00.000Z",
   "prices": {
    "AAPL": {
     "change": 3,
     "changePercent": 2.9,
     "high": 104,
     "low": 99,
     "open": 101,
     "previousClose": 103,
     "price": "__Infinity__",
     "timestamp": 1790000000,
     "volume": 1000
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
   "dataTimestamp": "2026-09-21T14:13:20.000Z",
   "fetchedAt": "2026-10-01T15:00:00.000Z",
   "prices": {
    "AAPL": {
     "change": 3,
     "changePercent": 2.9,
     "high": 104,
     "low": 99,
     "open": 101,
     "previousClose": 103,
     "price": "NA",
     "timestamp": 1790000000,
     "volume": 1000
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
   "dataTimestamp": "2026-09-21T14:13:20.000Z",
   "fetchedAt": "2026-10-01T15:00:00.000Z",
   "prices": {
    "AAPL": {
     "change": 3,
     "changePercent": 2.9,
     "high": 104,
     "low": 99,
     "open": 101,
     "previousClose": 103,
     "price": 103,
     "timestamp": 1790000000,
     "volume": 1000
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
   "dataTimestamp": "2026-09-21T14:13:20.000Z",
   "fetchedAt": "2026-10-01T15:00:00.000Z",
   "prices": {
    "AAPL": {
     "change": 3,
     "changePercent": 2.9,
     "high": 104,
     "low": 99,
     "open": 101,
     "previousClose": 103,
     "price": -5,
     "timestamp": 1790000000,
     "volume": 1000
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
   "dataTimestamp": "2026-09-21T14:13:20.000Z",
   "fetchedAt": "2026-10-01T15:00:00.000Z",
   "prices": {
    "AAPL": {
     "change": 3,
     "changePercent": 2.9,
     "high": 104,
     "low": 99,
     "open": 101,
     "previousClose": 103,
     "price": 103,
     "timestamp": 1790000000,
     "volume": 1000
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
   "dataTimestamp": "2026-09-21T14:13:20.000Z",
   "fetchedAt": "2026-10-01T15:00:00.000Z",
   "prices": {
    "AAPL": {
     "change": 3,
     "changePercent": 2.9,
     "high": 104,
     "low": 99,
     "open": 101,
     "previousClose": 103,
     "price": 103,
     "timestamp": 1790000000,
     "volume": 1000
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
   "dataTimestamp": "2026-09-21T14:13:20.000Z",
   "fetchedAt": "2026-10-01T15:00:00.000Z",
   "prices": {
    "AAPL": {
     "change": 3,
     "changePercent": 2.9,
     "high": 104,
     "low": 99,
     "open": 101,
     "previousClose": 100,
     "price": 103,
     "timestamp": 1790000000,
     "volume": 1000
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
   "dataTimestamp": "2026-09-21T14:13:20.000Z",
   "fetchedAt": "2026-10-01T15:00:00.000Z",
   "prices": {
    "AAPL": {
     "change": 3,
     "changePercent": 2.9,
     "high": 104,
     "low": 99,
     "open": 101,
     "previousClose": 103,
     "price": 103,
     "timestamp": 1790000000,
     "volume": 1000
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
   "dataTimestamp": "2026-09-21T14:13:20.000Z",
   "fetchedAt": "2026-10-01T15:00:00.000Z",
   "prices": {
    "AAPL": {
     "change": 3,
     "changePercent": 2.9,
     "high": 104,
     "low": 99,
     "open": 101,
     "previousClose": 100,
     "price": 100,
     "timestamp": 1790000000,
     "volume": 1000
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
   "dataTimestamp": "2026-09-21T14:13:20.000Z",
   "fetchedAt": "2026-10-01T15:00:00.000Z",
   "prices": {
    "AAPL": {
     "change": 3,
     "changePercent": 2.9,
     "high": 104,
     "low": 99,
     "open": 101,
     "previousClose": 0,
     "price": 103,
     "timestamp": 1790000000,
     "volume": 1000
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
   "dataTimestamp": "2026-09-21T14:13:20.000Z",
   "fetchedAt": "2026-10-01T15:00:00.000Z",
   "prices": {
    "AAPL": {
     "change": 3,
     "changePercent": 2.9,
     "high": 104,
     "low": 99,
     "open": 101,
     "previousClose": "__Infinity__",
     "price": 103,
     "timestamp": 1790000000,
     "volume": 1000
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
   "dataTimestamp": "2026-09-21T14:13:20.000Z",
   "fetchedAt": "2026-10-01T15:00:00.000Z",
   "prices": {
    "AAPL": {
     "change": 3,
     "changePercent": 2.9,
     "high": 104,
     "low": 99,
     "open": 101,
     "previousClose": "NA",
     "price": 103,
     "timestamp": 1790000000,
     "volume": 1000
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
   "dataTimestamp": "2026-09-21T14:13:20.000Z",
   "fetchedAt": "2026-10-01T15:00:00.000Z",
   "prices": {
    "AAPL": {
     "change": 3,
     "changePercent": 2.9,
     "high": 104,
     "low": 99,
     "open": 101,
     "previousClose": 0,
     "price": 103,
     "timestamp": 1790000000,
     "volume": 1000
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
   "dataTimestamp": null,
   "fetchedAt": "2026-10-01T15:00:00.000Z",
   "prices": {
    "AAPL": {
     "change": 3,
     "changePercent": 2.9,
     "high": 104,
     "low": 99,
     "open": 101,
     "previousClose": 100,
     "price": 103,
     "timestamp": null,
     "volume": 1000
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
   "dataTimestamp": null,
   "fetchedAt": "2026-10-01T15:00:00.000Z",
   "prices": {
    "AAPL": {
     "change": 3,
     "changePercent": 2.9,
     "high": 104,
     "low": 99,
     "open": 101,
     "previousClose": 100,
     "price": 103,
     "timestamp": "NA",
     "volume": 1000
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
   "dataTimestamp": "2026-09-21T14:13:20.000Z",
   "fetchedAt": "2026-10-01T15:00:00.000Z",
   "prices": {
    "AAPL": {
     "change": 3,
     "changePercent": 2.9,
     "high": 104,
     "low": 99,
     "open": 101,
     "previousClose": 0,
     "price": 0,
     "timestamp": 1790000000,
     "volume": 1000
    },
    "BRK.B": {
     "change": 3,
     "changePercent": 2.9,
     "high": 104,
     "low": 99,
     "open": 101,
     "previousClose": 0,
     "price": 450,
     "timestamp": 1790000000,
     "volume": 1000
    },
    "MSFT": {
     "change": 3,
     "changePercent": 2.9,
     "high": 104,
     "low": 99,
     "open": 101,
     "previousClose": 405,
     "price": 410,
     "timestamp": 1790000100,
     "volume": 1000
    }
   },
   "success": true
  },
  "fetchCalls": [
   "https://eodhd.com/api/real-time/msft.US,BRK-B.US,AAPL.US?api_token=test-key&fmt=json"
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
   "https://eodhd.com/api/real-time/AAPL.US?api_token=test-key&fmt=json",
   "https://eodhd.com/api/real-time/AAPL.US?api_token=test-key&fmt=json"
  ],
  "first": {
   "body": {
    "count": 1,
    "dataTimestamp": "2026-09-21T14:13:20.000Z",
    "fetchedAt": "2026-10-01T15:00:00.000Z",
    "prices": {
     "AAPL": {
      "change": 3,
      "changePercent": 2.9,
      "high": 104,
      "low": 99,
      "open": 101,
      "previousClose": 100,
      "price": 103,
      "timestamp": 1790000000,
      "volume": 1000
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
    "dataTimestamp": "2026-09-21T14:13:20.000Z",
    "fetchedAt": "2026-10-01T15:00:00.000Z",
    "prices": {
     "AAPL": {
      "change": 3,
      "changePercent": 2.9,
      "high": 104,
      "low": 99,
      "open": 101,
      "previousClose": 100,
      "price": 103,
      "timestamp": 1790000000,
      "volume": 1000
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
   "https://eodhd.com/api/real-time/AAPL.US?api_token=test-key&fmt=json",
   "https://eodhd.com/api/real-time/AAPL.US?api_token=test-key&fmt=json"
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
   "dataTimestamp": null,
   "fetchedAt": "2026-10-01T14:59:30.000Z",
   "prices": {
    "AAPL": {
     "change": 0,
     "changePercent": 0,
     "high": 0,
     "low": 0,
     "open": 0,
     "previousClose": 0,
     "price": 103,
     "timestamp": null,
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
   "dataTimestamp": "2026-09-21T14:13:20.000Z",
   "fetchedAt": "2026-10-01T15:00:00.000Z",
   "prices": {
    "AAPL": {
     "change": 3,
     "changePercent": 2.9,
     "high": 104,
     "low": 99,
     "open": 101,
     "previousClose": 100,
     "price": 103,
     "timestamp": 1790000000,
     "volume": 1000
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

describe('OFF-2 — the stock proxy output is unchanged apart from quoteOrigin', () => {
  for (const [name, item] of Object.entries(ITEM_FIXTURES)) {
    it(`OFF ${name}: status, headers and every existing field match the pre-build capture`, async () => {
      respond = okJson([item]);
      const res = await call('AAPL');
      offReference(`item.${name}`, snapshotOff(res), OFF[`item.${name}`]);
    });
  }

  it('OFF multi: array response, a record without a code is skipped, .US suffix stripped, symbol order', async () => {
    respond = okJson([
      { ...BASE_ITEM, code: 'MSFT.US', close: 410, previousClose: 405, timestamp: 1790000100 },
      { close: 5 },
      { ...BASE_ITEM, code: 'BRK-B.US', close: 450, previousClose: 0 },
      { ...BASE_ITEM, code: 'AAPL.US', close: 0, previousClose: 0 },
    ]);
    const res = await call('msft,BRK.B.US,AAPL');
    offReference('multi', { ...snapshotOff(res), fetchCalls }, OFF.multi);
  });

  it('OFF single object response (not an array)', async () => {
    respond = okJson({ ...BASE_ITEM, close: 103, previousClose: 100 });
    const res = await call('AAPL');
    offReference('singleObject', snapshotOff(res), OFF.singleObject);
  });

  it('OFF non-OK provider response → 500 error body, no cache', async () => {
    respond = () => ({ ok: false, status: 502, json: async () => ({}) });
    const res = await call('AAPL');
    const again = await call('AAPL');
    offReference('nonOk', { first: snapshot(res), second: snapshot(again), fetchCalls }, OFF.nonOk);
  });

  it('OFF malformed provider response (json throws) → 500', async () => {
    respond = () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token'); } });
    const res = await call('AAPL');
    offReference('malformed', snapshot(res), OFF.malformed);
  });

  it('OFF missing symbols and missing key keep their exact errors', async () => {
    const noSymbols = await call(undefined);
    delete process.env.EODHD_API_KEY;
    const noKey = await call('AAPL');
    offReference('errors', { noSymbols: snapshot(noSymbols), noKey: snapshot(noKey) }, OFF.errors);
  });

  it('OFF cache hit: the second identical request is served from the server cache, same body, one fetch', async () => {
    respond = okJson([{ ...BASE_ITEM, close: 103, previousClose: 100 }]);
    const first = await call('AAPL');
    const second = await call('AAPL');
    offReference('cacheHit', { first: snapshotOff(first), second: snapshotOff(second), fetchCalls }, OFF.cacheHit);
  });

  it('OFF nocache=1 bypasses the cache and sets no cache headers', async () => {
    respond = okJson([{ ...BASE_ITEM, close: 103, previousClose: 100 }]);
    const first = await call('AAPL', { nocache: '1' });
    const second = await call('AAPL', { nocache: '1' });
    offReference('noCache', { first: snapshotOff(first), second: snapshotOff(second), fetchCalls }, OFF.noCache);
  });

  it('OFF an OLD (pre-upgrade) server-cache record is served exactly as stored — never decorated', async () => {
    const { setInCache } = await import('../_utils/serverCache.js');
    const old = {
      success: true,
      prices: { AAPL: { price: 103, previousClose: 0, open: 0, change: 0, changePercent: 0, high: 0, low: 0, volume: undefined, timestamp: null } },
      count: 1,
      dataTimestamp: null,
      fetchedAt: '2026-10-01T14:59:30.000Z',
    };
    setInCache('stock_prices_AAPL', old, 60);
    const res = await call('AAPL');
    // The old record carries no quoteOrigin and must come back without one.
    expect(res.body.prices.AAPL).not.toHaveProperty('quoteOrigin');
    expect(res.body).toBe(old);
    offReference('oldCacheRecord', { ...snapshot(res), fetchCalls }, OFF.oldCacheRecord);
  });
});

// ─── ON-F1a — value-specific origins at the real stock proxy ────────────────

const EXPECTED_ORIGINS = {
  genuine: ['provider-close', 'provider-previous-close'],
  closeNull: ['provider-previous-close', 'provider-previous-close'],
  closeZero: ['provider-previous-close', 'provider-previous-close'],
  closeAbsent: ['provider-previous-close', 'provider-previous-close'],
  genuineEqual: ['provider-close', 'provider-previous-close'],
  // A truthy "NA" IS what the unchanged expression selects; origin names the
  // branch, and the gate later rejects the number (it normalizes to 0).
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
  genuineEqualsDefault: ['provider-close', 'provider-previous-close'],
};

describe('ON-F1a — the stock proxy names the branch that produced each value', () => {
  for (const [name, [priceOrigin, previousCloseOrigin]] of Object.entries(EXPECTED_ORIGINS)) {
    it(`${name}: price ← ${priceOrigin}, previousClose ← ${previousCloseOrigin}`, async () => {
      respond = okJson([ITEM_FIXTURES[name]]);
      const res = await call('AAPL');
      expect(res.body.prices.AAPL.quoteOrigin).toEqual({ version: 1, price: priceOrigin, previousClose: previousCloseOrigin });
    });
  }

  it('missing close + genuine previousClose 103: the number stays 103, the current is ineligible, the close eligible', async () => {
    const { interpretQuote } = await import('../../src/screens/battleView/shadowCpuQuoteIntegrity.js');
    respond = okJson([ITEM_FIXTURES.closeNull]);
    const rec = (await call('AAPL')).body.prices.AAPL;
    expect(rec.price).toBe(103);
    const q = interpretQuote(rec, { nowMs: Date.now() });
    expect(q.current.qualified).toBe(false);
    expect(q.current.reason).toBe('previous-close-substitution');
    expect(q.previousClose).toEqual({ genuine: true, reason: 'genuine', value: 103 });
  });

  it('genuine close 103 / previousClose 103 qualifies — equality is not evidence of substitution', async () => {
    const { interpretQuote } = await import('../../src/screens/battleView/shadowCpuQuoteIntegrity.js');
    respond = okJson([ITEM_FIXTURES.genuineEqual]);
    const rec = (await call('AAPL')).body.prices.AAPL;
    const q = interpretQuote(rec, { nowMs: Date.now() });
    expect(q.current).toMatchObject({ qualified: true, price: 103 });
    expect(q.previousClose.genuine).toBe(true);
  });

  it('close: null/103 is NOT equivalent to close: 103/103', async () => {
    respond = okJson([ITEM_FIXTURES.closeNull]);
    const substituted = (await call('AAPL')).body.prices.AAPL;
    vi.resetModules();
    handler = (await import('./prices.js')).default;
    respond = okJson([ITEM_FIXTURES.genuineEqual]);
    const genuine = (await call('AAPL')).body.prices.AAPL;
    expect(substituted.price).toBe(genuine.price);
    expect(substituted.quoteOrigin).not.toEqual(genuine.quoteOrigin);
  });

  it('the metadata rides INSIDE the cached record: the cache hit returns the same origins', async () => {
    respond = okJson([ITEM_FIXTURES.closeNull]);
    const first = await call('AAPL');
    const second = await call('AAPL');
    expect(fetchCalls).toHaveLength(1);
    expect(second.body.prices.AAPL.quoteOrigin).toEqual(first.body.prices.AAPL.quoteOrigin);
    expect(second.body.prices.AAPL.quoteOrigin.price).toBe('provider-previous-close');
  });

  it('"NA", NaN, Infinity and negative closes never qualify in the gate (the number fails, not the origin)', async () => {
    const { interpretQuote } = await import('../../src/screens/battleView/shadowCpuQuoteIntegrity.js');
    for (const name of ['closeNA', 'closeInfinity', 'closeNegative']) {
      vi.resetModules();
      handler = (await import('./prices.js')).default;
      respond = okJson([ITEM_FIXTURES[name]]);
      // The client normalization is what the gate sees: parseFloat(x) || 0.
      const rec = (await call('AAPL')).body.prices.AAPL;
      const normalized = { ...rec, price: parseFloat(JSON.parse(JSON.stringify(rec)).price) || 0 };
      const q = interpretQuote(normalized, { nowMs: Date.now() });
      expect(q.current.qualified, name).toBe(false);
      expect(q.current.reason, name).toBe('invalid-number');
    }
  });
});
