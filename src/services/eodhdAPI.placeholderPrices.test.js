// @vitest-environment jsdom
//
// src/services/eodhdAPI.placeholderPrices.test.js
//
// Shadow vs CPU quote integrity (spec SHADOW_CPU_PLACEHOLDER_PRICE_SPEC_V1_6.md
// §4.1–§4.3, OFF-3, ON-F1b, ON-F3a–c; build record
// docs/audits/20261002_SHADOW_CPU_QUOTE_INTEGRITY_BUILD_REVIEW.md).
//
// The REAL batch service over the REAL cache service (fresh singleton per
// test, jsdom localStorage, fabricated clock), with the network as the only
// stub. A thin recorder wraps the real cache service so every get/set — its
// arguments, its order and its count — is part of the parity claim.
//
// OFF-3: everything the service returns, writes and requests is unchanged;
// the ONLY differences allowed are `quoteOrigin` (everywhere) and the added
// `isFallback` marker on STOCK fallback records. References were captured at
// the pre-build SHA by running this file there with SHADOW_OFF_CAPTURE_DIR set.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

export const OFF_REFERENCE_SHA = '44d0c63eba4e3099552d3ec3dbde6a89660a7e06';
const CAPTURE_DIR = process.env.SHADOW_OFF_CAPTURE_DIR || '';
function offReference(name, actual, expected) {
  if (CAPTURE_DIR) {
    writeFileSync(path.join(CAPTURE_DIR, `batch.${name}.json`), JSON.stringify(actual, null, 1));
    return;
  }
  expect(actual).toEqual(expected);
}

const tag = (value) => JSON.parse(JSON.stringify(value === undefined ? '__undefined__' : value, (k, v) => {
  if (v === undefined) return '__undefined__';
  if (typeof v === 'number' && Number.isNaN(v)) return '__NaN__';
  if (v === Infinity) return '__Infinity__';
  if (v === -Infinity) return '__-Infinity__';
  if (Object.is(v, -0)) return '__-0__';
  return v;
}));

// ── The recorder over the REAL cache service ────────────────────────────────
// The module's singleton is swapped for a FRESH instance of the real class per
// test (and again to simulate a page reload, which re-reads localStorage
// exactly as a cold start does). The recorder forwards everything to the
// current instance and logs get/set with their arguments and results.
const cacheLog = vi.hoisted(() => []);
const cacheBox = vi.hoisted(() => ({ Ctor: null, current: null }));
vi.mock('./cacheService.js', async (importOriginal) => {
  const real = await importOriginal();
  cacheBox.Ctor = real.default.constructor;
  cacheBox.current = real.default;
  const recorder = {
    get(type, id) {
      const value = cacheBox.current.get(type, id);
      cacheLog.push(['get', type, id, value === null ? null : JSON.parse(JSON.stringify(value))]);
      return value;
    },
    set(type, id, value, options) {
      cacheLog.push(['set', type, id, JSON.parse(JSON.stringify(value))]);
      return cacheBox.current.set(type, id, value, options);
    },
  };
  const proxy = new Proxy(recorder, {
    get(target, key) {
      if (key in target) return target[key];
      const v = cacheBox.current[key];
      return typeof v === 'function' ? v.bind(cacheBox.current) : v;
    },
  });
  return { ...real, default: proxy, cacheService: proxy };
});
/** A cold start: a new cache instance that loads whatever localStorage holds. */
const reloadCache = () => { cacheBox.current = new cacheBox.Ctor(); };
vi.mock('./apiMonitor.js', () => ({ apiMonitor: { track: () => {} } }));

// ── The network: a deferred queue, every URL recorded ───────────────────────
let fetchUrls;
let pending;
function installFetch() {
  fetchUrls = [];
  pending = [];
  globalThis.fetch = vi.fn((url) => {
    fetchUrls.push(String(url));
    return new Promise((resolve, reject) => pending.push({ url: String(url), resolve, reject }));
  });
}
const json = (payload, { ok = true, status = 200 } = {}) => ({ ok, status, json: async () => payload });
/** Resolve the oldest pending request (or the i-th) with a response object. */
async function settle(i, response) {
  const p = pending[i];
  if (response instanceof Error) p.reject(response); else p.resolve(response);
  await vi.advanceTimersByTimeAsync(0);
}

import * as api from './eodhdAPI.js';

beforeEach(() => {
  vi.useFakeTimers();
  // Thursday 2026-10-01, 11:00 AM ET — regular hours.
  vi.setSystemTime(new Date('2026-10-01T15:00:00.000Z'));
  localStorage.clear();
  reloadCache();
  cacheLog.length = 0;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  installFetch();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  delete globalThis.fetch;
});

// What a NEW proxy sends (the build adds quoteOrigin there); the pre-build
// client ignores the extra key, so the same payload drives both captures.
const stockRecord = (over = {}) => ({
  price: 103, previousClose: 100, open: 101, change: 3, changePercent: 3, high: 104, low: 99, volume: 10, timestamp: 1790000000,
  quoteOrigin: { version: 1, price: 'provider-close', previousClose: 'provider-previous-close' },
  ...over,
});
const cryptoRecord = (over = {}) => ({
  price: 61000, previousClose: 60700, open: 60500, change: 300, changePercent: 0.5, high: 61200, low: 60100, volume: 9, timestamp: 1790000000,
  quoteOrigin: { version: 1, price: 'provider-close', previousClose: 'provider-previous-close' },
  ...over,
});

/** Strip only the named metadata before comparing to the pre-build capture. */
function offView(value, { stock }) {
  const strip = (rec) => {
    if (!rec || typeof rec !== 'object' || Array.isArray(rec)) return rec;
    const { quoteOrigin, ...rest } = rec;
    if (stock) delete rest.isFallback;
    return rest;
  };
  const stripMap = (m) => (m && typeof m === 'object' ? Object.fromEntries(Object.entries(m).map(([k, v]) => [k, strip(v)])) : m);
  return {
    result: tag(stripMap(value.result)),
    cacheLog: tag(value.cacheLog.map(([op, type, id, v]) => [op, type, id, strip(v)])),
    fetchUrls: value.fetchUrls,
  };
}

async function run(fn) {
  const result = await fn();
  return { result, cacheLog: [...cacheLog], fetchUrls: [...fetchUrls] };
}

// BEGIN GENERATED OFF REFERENCES — captured at the pre-build SHA 44d0c63eba4e3099552d3ec3dbde6a89660a7e06 (18 entries).
// Regenerate ONLY by re-running this file's OFF rows at that SHA with
// SHADOW_OFF_CAPTURE_DIR set; never by blessing build output. At that SHA
// the file's ON section also imports src/screens/battleView/shadowCpuQuoteIntegrity.js,
// which does not exist there: copy it alongside (a pure module the OFF rows
// never call) so the import graph resolves, then run with -t "OFF".
const OFF = {
 "cryptoCacheHitAndMixed": {
  "cacheLog": [
   [
    "get",
    "crypto",
    "BTC",
    null
   ],
   [
    "set",
    "crypto",
    "BTC",
    {
     "change24h": 0.5,
     "high": 61200,
     "low": 60100,
     "previousClose": 60700,
     "price": 61000,
     "timestamp": 1790000000
    }
   ],
   [
    "get",
    "crypto",
    "BTC",
    {
     "change24h": 0.5,
     "high": 61200,
     "low": 60100,
     "previousClose": 60700,
     "price": 61000,
     "timestamp": 1790000000
    }
   ],
   [
    "get",
    "crypto",
    "BTC",
    {
     "change24h": 0.5,
     "high": 61200,
     "low": 60100,
     "previousClose": 60700,
     "price": 61000,
     "timestamp": 1790000000
    }
   ],
   [
    "get",
    "crypto",
    "ETH",
    null
   ],
   [
    "set",
    "crypto",
    "ETH",
    {
     "change24h": 0.5,
     "high": 61200,
     "low": 60100,
     "previousClose": 60700,
     "price": 2500,
     "timestamp": 1790000000
    }
   ]
  ],
  "fetchUrls": [
   "/api/crypto/prices?symbols=BTC",
   "/api/crypto/prices?symbols=ETH"
  ],
  "result": {
   "first": {
    "BTC": {
     "change24h": 0.5,
     "high": 61200,
     "low": 60100,
     "previousClose": 60700,
     "price": 61000,
     "timestamp": 1790000000
    }
   },
   "hit": {
    "BTC": {
     "change24h": 0.5,
     "high": 61200,
     "low": 60100,
     "previousClose": 60700,
     "price": 61000,
     "timestamp": 1790000000
    }
   },
   "mixed": {
    "BTC": {
     "change24h": 0.5,
     "high": 61200,
     "low": 60100,
     "previousClose": 60700,
     "price": 61000,
     "timestamp": 1790000000
    },
    "ETH": {
     "change24h": 0.5,
     "high": 61200,
     "low": 60100,
     "previousClose": 60700,
     "price": 2500,
     "timestamp": 1790000000
    }
   }
  }
 },
 "cryptoFresh": {
  "cacheLog": [
   [
    "get",
    "crypto",
    "BTC",
    null
   ],
   [
    "get",
    "crypto",
    "ETH",
    null
   ],
   [
    "set",
    "crypto",
    "BTC",
    {
     "change24h": 0.5,
     "high": 61200,
     "low": 60100,
     "previousClose": 60700,
     "price": 61000,
     "timestamp": 1790000000
    }
   ],
   [
    "set",
    "crypto",
    "ETH",
    {
     "change24h": 0.5,
     "high": 61200,
     "low": 60100,
     "previousClose": 2480,
     "price": 2500,
     "timestamp": 1790000000
    }
   ]
  ],
  "fetchUrls": [
   "/api/crypto/prices?symbols=BTC,ETH"
  ],
  "result": {
   "BTC": {
    "change24h": 0.5,
    "high": 61200,
    "low": 60100,
    "previousClose": 60700,
    "price": 61000,
    "timestamp": 1790000000
   },
   "ETH": {
    "change24h": 0.5,
    "high": 61200,
    "low": 60100,
    "previousClose": 2480,
    "price": 2500,
    "timestamp": 1790000000
   }
  }
 },
 "cryptoLateWrite": {
  "cacheLog": [
   [
    "get",
    "crypto",
    "BTC",
    null
   ],
   [
    "get",
    "crypto",
    "BTC",
    null
   ],
   [
    "set",
    "crypto",
    "BTC",
    {
     "change24h": 0.5,
     "high": 61200,
     "low": 60100,
     "previousClose": 60700,
     "price": 62000,
     "timestamp": 1790000200
    }
   ],
   [
    "set",
    "crypto",
    "BTC",
    {
     "change24h": 0.5,
     "high": 61200,
     "low": 60100,
     "previousClose": 60700,
     "price": 61000,
     "timestamp": 1790000100
    }
   ],
   [
    "get",
    "crypto",
    "BTC",
    {
     "change24h": 0.5,
     "high": 61200,
     "low": 60100,
     "previousClose": 60700,
     "price": 61000,
     "timestamp": 1790000100
    }
   ]
  ],
  "fetchUrls": [
   "/api/crypto/prices?symbols=BTC",
   "/api/crypto/prices?symbols=BTC"
  ],
  "result": {
   "hit": {
    "BTC": {
     "change24h": 0.5,
     "high": 61200,
     "low": 60100,
     "previousClose": 60700,
     "price": 61000,
     "timestamp": 1790000100
    }
   },
   "r1": {
    "BTC": {
     "change24h": 0.5,
     "high": 61200,
     "low": 60100,
     "previousClose": 60700,
     "price": 61000,
     "timestamp": 1790000100
    }
   },
   "r2": {
    "BTC": {
     "change24h": 0.5,
     "high": 61200,
     "low": 60100,
     "previousClose": 60700,
     "price": 62000,
     "timestamp": 1790000200
    }
   }
  }
 },
 "cryptoNetworkFailure": {
  "cacheLog": [
   [
    "get",
    "crypto",
    "BTC",
    null
   ],
   [
    "get",
    "crypto",
    "ETH",
    null
   ]
  ],
  "fetchUrls": [
   "/api/crypto/prices?symbols=BTC,ETH"
  ],
  "result": {
   "BTC": {
    "change24h": 0,
    "isFallback": true,
    "price": 95000
   },
   "ETH": {
    "change24h": 0,
    "isFallback": true,
    "price": 3400
   }
  }
 },
 "cryptoPartialAndNA": {
  "cacheLog": [
   [
    "get",
    "crypto",
    "BTC",
    null
   ],
   [
    "get",
    "crypto",
    "ETH",
    null
   ],
   [
    "get",
    "crypto",
    "SOL",
    null
   ],
   [
    "get",
    "crypto",
    "DOGE",
    null
   ],
   [
    "set",
    "crypto",
    "SOL",
    {
     "change24h": 0.5,
     "high": 61200,
     "low": 60100,
     "previousClose": 0,
     "price": 150,
     "timestamp": "NA"
    }
   ]
  ],
  "fetchUrls": [
   "/api/crypto/prices?symbols=BTC,ETH,SOL,DOGE"
  ],
  "result": {
   "BTC": {
    "change24h": 0,
    "isFallback": true,
    "price": 95000
   },
   "DOGE": {
    "change24h": 0,
    "isFallback": true,
    "price": 0.38
   },
   "ETH": {
    "change24h": 0,
    "isFallback": true,
    "price": 3400
   },
   "SOL": {
    "change24h": 0.5,
    "high": 61200,
    "low": 60100,
    "previousClose": 0,
    "price": 150,
    "timestamp": "NA"
   }
  }
 },
 "cryptoWrapper": {
  "cacheLog": [
   [
    "get",
    "crypto",
    "BTC",
    null
   ],
   [
    "set",
    "crypto",
    "BTC",
    {
     "change24h": 0.5,
     "high": 0,
     "low": 60100,
     "previousClose": 60700,
     "price": 61000,
     "timestamp": 1790000000
    }
   ],
   [
    "get",
    "crypto",
    "ETH",
    null
   ]
  ],
  "fetchUrls": [
   "/api/crypto/prices?symbols=BTC",
   "/api/crypto/prices?symbols=ETH"
  ],
  "result": {
   "fallback": {
    "change24h": 0,
    "high": 3400,
    "id": "eth",
    "low": 3400,
    "marketCap": 0,
    "price": 3400,
    "symbol": "ETH",
    "volume24h": 0
   },
   "genuine": {
    "change24h": 0.5,
    "high": 61000,
    "id": "btc",
    "low": 60100,
    "marketCap": 0,
    "price": 61000,
    "symbol": "BTC",
    "volume24h": 0
   }
  }
 },
 "stocksAfterHoursReload": {
  "cacheLog": [
   [
    "get",
    "prices",
    "AAPL",
    null
   ],
   [
    "set",
    "prices",
    "AAPL",
    {
     "change": 3,
     "high": 104,
     "low": 99,
     "open": 101,
     "percentChange": 3,
     "previousClose": 100,
     "price": 105,
     "timestamp": 1790000000
    }
   ],
   [
    "get",
    "prices",
    "AAPL",
    {
     "change": 3,
     "high": 104,
     "low": 99,
     "open": 101,
     "percentChange": 3,
     "previousClose": 100,
     "price": 105,
     "timestamp": 1790000000
    }
   ]
  ],
  "fetchUrls": [
   "/api/stocks/prices?symbols=AAPL"
  ],
  "result": {
   "reloaded": {
    "AAPL": {
     "change": 3,
     "high": 104,
     "low": 99,
     "open": 101,
     "percentChange": 3,
     "previousClose": 100,
     "price": 105,
     "timestamp": 1790000000
    }
   },
   "written": {
    "AAPL": {
     "change": 3,
     "high": 104,
     "low": 99,
     "open": 101,
     "percentChange": 3,
     "previousClose": 100,
     "price": 105,
     "timestamp": 1790000000
    }
   }
  }
 },
 "stocksCacheHitAndMixed": {
  "cacheLog": [
   [
    "get",
    "prices",
    "AAPL",
    null
   ],
   [
    "set",
    "prices",
    "AAPL",
    {
     "change": 3,
     "high": 104,
     "low": 99,
     "open": 101,
     "percentChange": 3,
     "previousClose": 100,
     "price": 103,
     "timestamp": 1790000000
    }
   ],
   [
    "get",
    "prices",
    "AAPL",
    {
     "change": 3,
     "high": 104,
     "low": 99,
     "open": 101,
     "percentChange": 3,
     "previousClose": 100,
     "price": 103,
     "timestamp": 1790000000
    }
   ],
   [
    "get",
    "prices",
    "AAPL",
    {
     "change": 3,
     "high": 104,
     "low": 99,
     "open": 101,
     "percentChange": 3,
     "previousClose": 100,
     "price": 103,
     "timestamp": 1790000000
    }
   ],
   [
    "get",
    "prices",
    "MSFT",
    null
   ],
   [
    "set",
    "prices",
    "MSFT",
    {
     "change": 3,
     "high": 104,
     "low": 99,
     "open": 101,
     "percentChange": 3,
     "previousClose": 100,
     "price": 410,
     "timestamp": 1790000000
    }
   ]
  ],
  "fetchUrls": [
   "/api/stocks/prices?symbols=AAPL",
   "/api/stocks/prices?symbols=MSFT"
  ],
  "result": {
   "first": {
    "AAPL": {
     "change": 3,
     "high": 104,
     "low": 99,
     "open": 101,
     "percentChange": 3,
     "previousClose": 100,
     "price": 103,
     "timestamp": 1790000000
    }
   },
   "hit": {
    "AAPL": {
     "change": 3,
     "high": 104,
     "low": 99,
     "open": 101,
     "percentChange": 3,
     "previousClose": 100,
     "price": 103,
     "timestamp": 1790000000
    }
   },
   "mixed": {
    "AAPL": {
     "change": 3,
     "high": 104,
     "low": 99,
     "open": 101,
     "percentChange": 3,
     "previousClose": 100,
     "price": 103,
     "timestamp": 1790000000
    },
    "MSFT": {
     "change": 3,
     "high": 104,
     "low": 99,
     "open": 101,
     "percentChange": 3,
     "previousClose": 100,
     "price": 410,
     "timestamp": 1790000000
    }
   }
  }
 },
 "stocksFailedLaterRequest": {
  "cacheLog": [
   [
    "get",
    "prices",
    "AAPL",
    null
   ],
   [
    "get",
    "prices",
    "AAPL",
    null
   ],
   [
    "set",
    "prices",
    "AAPL",
    {
     "change": 3,
     "high": 104,
     "low": 99,
     "open": 101,
     "percentChange": 3,
     "previousClose": 100,
     "price": 103,
     "timestamp": 1790000000
    }
   ],
   [
    "get",
    "prices",
    "AAPL",
    {
     "change": 3,
     "high": 104,
     "low": 99,
     "open": 101,
     "percentChange": 3,
     "previousClose": 100,
     "price": 103,
     "timestamp": 1790000000
    }
   ]
  ],
  "fetchUrls": [
   "/api/stocks/prices?symbols=AAPL",
   "/api/stocks/prices?symbols=AAPL"
  ],
  "result": {
   "hit": {
    "AAPL": {
     "change": 3,
     "high": 104,
     "low": 99,
     "open": 101,
     "percentChange": 3,
     "previousClose": 100,
     "price": 103,
     "timestamp": 1790000000
    }
   },
   "r1": {
    "AAPL": {
     "change": 3,
     "high": 104,
     "low": 99,
     "open": 101,
     "percentChange": 3,
     "previousClose": 100,
     "price": 103,
     "timestamp": 1790000000
    }
   },
   "r2": {
    "AAPL": {
     "change": 0,
     "open": 240,
     "percentChange": 0,
     "previousClose": 240,
     "price": 240
    }
   }
  }
 },
 "stocksFresh": {
  "cacheLog": [
   [
    "get",
    "prices",
    "AAPL",
    null
   ],
   [
    "get",
    "prices",
    "MSFT",
    null
   ],
   [
    "set",
    "prices",
    "AAPL",
    {
     "change": 3,
     "high": 104,
     "low": 99,
     "open": 101,
     "percentChange": 3,
     "previousClose": 100,
     "price": 103,
     "timestamp": 1790000000
    }
   ],
   [
    "set",
    "prices",
    "MSFT",
    {
     "change": 3,
     "high": 104,
     "low": 99,
     "open": 101,
     "percentChange": 3,
     "previousClose": 405,
     "price": 410,
     "timestamp": 1790000000
    }
   ]
  ],
  "fetchUrls": [
   "/api/stocks/prices?symbols=AAPL,MSFT"
  ],
  "result": {
   "AAPL": {
    "change": 3,
    "high": 104,
    "low": 99,
    "open": 101,
    "percentChange": 3,
    "previousClose": 100,
    "price": 103,
    "timestamp": 1790000000
   },
   "MSFT": {
    "change": 3,
    "high": 104,
    "low": 99,
    "open": 101,
    "percentChange": 3,
    "previousClose": 405,
    "price": 410,
    "timestamp": 1790000000
   }
  }
 },
 "stocksGenuineEqualsDefault": {
  "cacheLog": [
   [
    "get",
    "prices",
    "MSFT",
    null
   ],
   [
    "set",
    "prices",
    "MSFT",
    {
     "change": 3,
     "high": 104,
     "low": 99,
     "open": 101,
     "percentChange": 3,
     "previousClose": 430,
     "price": 430,
     "timestamp": 1790000000
    }
   ]
  ],
  "fetchUrls": [
   "/api/stocks/prices?symbols=MSFT"
  ],
  "result": {
   "MSFT": {
    "change": 3,
    "high": 104,
    "low": 99,
    "open": 101,
    "percentChange": 3,
    "previousClose": 430,
    "price": 430,
    "timestamp": 1790000000
   }
  }
 },
 "stocksLateWrite": {
  "cacheLog": [
   [
    "get",
    "prices",
    "AAPL",
    null
   ],
   [
    "get",
    "prices",
    "AAPL",
    null
   ],
   [
    "set",
    "prices",
    "AAPL",
    {
     "change": 3,
     "high": 104,
     "low": 99,
     "open": 101,
     "percentChange": 3,
     "previousClose": 100,
     "price": 110,
     "timestamp": 1790000200
    }
   ],
   [
    "set",
    "prices",
    "AAPL",
    {
     "change": 3,
     "high": 104,
     "low": 99,
     "open": 101,
     "percentChange": 3,
     "previousClose": 99,
     "price": 103,
     "timestamp": 1790000100
    }
   ],
   [
    "get",
    "prices",
    "AAPL",
    {
     "change": 3,
     "high": 104,
     "low": 99,
     "open": 101,
     "percentChange": 3,
     "previousClose": 99,
     "price": 103,
     "timestamp": 1790000100
    }
   ]
  ],
  "fetchUrls": [
   "/api/stocks/prices?symbols=AAPL",
   "/api/stocks/prices?symbols=AAPL"
  ],
  "result": {
   "hit": {
    "AAPL": {
     "change": 3,
     "high": 104,
     "low": 99,
     "open": 101,
     "percentChange": 3,
     "previousClose": 99,
     "price": 103,
     "timestamp": 1790000100
    }
   },
   "r1": {
    "AAPL": {
     "change": 3,
     "high": 104,
     "low": 99,
     "open": 101,
     "percentChange": 3,
     "previousClose": 99,
     "price": 103,
     "timestamp": 1790000100
    }
   },
   "r2": {
    "AAPL": {
     "change": 3,
     "high": 104,
     "low": 99,
     "open": 101,
     "percentChange": 3,
     "previousClose": 100,
     "price": 110,
     "timestamp": 1790000200
    }
   }
  }
 },
 "stocksMalformed": {
  "cacheLog": [
   [
    "get",
    "prices",
    "AAPL",
    null
   ]
  ],
  "fetchUrls": [
   "/api/stocks/prices?symbols=AAPL"
  ],
  "result": {
   "AAPL": {
    "change": 0,
    "open": 240,
    "percentChange": 0,
    "previousClose": 240,
    "price": 240
   }
  }
 },
 "stocksNA": {
  "cacheLog": [
   [
    "get",
    "prices",
    "AAPL",
    null
   ],
   [
    "get",
    "prices",
    "MSFT",
    null
   ],
   [
    "get",
    "prices",
    "NVDA",
    null
   ],
   [
    "set",
    "prices",
    "AAPL",
    {
     "change": 3,
     "high": 104,
     "low": 99,
     "open": 101,
     "percentChange": 3,
     "previousClose": 100,
     "price": 0,
     "timestamp": 1790000000
    }
   ],
   [
    "set",
    "prices",
    "MSFT",
    {
     "change": 3,
     "high": 104,
     "low": 99,
     "open": 101,
     "percentChange": 3,
     "previousClose": 0,
     "price": 103,
     "timestamp": 1790000000
    }
   ],
   [
    "set",
    "prices",
    "NVDA",
    {
     "change": 3,
     "high": 0,
     "low": 0,
     "open": 0,
     "percentChange": 3,
     "previousClose": 100,
     "price": 103,
     "timestamp": "NA"
    }
   ]
  ],
  "fetchUrls": [
   "/api/stocks/prices?symbols=AAPL,MSFT,NVDA"
  ],
  "result": {
   "AAPL": {
    "change": 3,
    "high": 104,
    "low": 99,
    "open": 101,
    "percentChange": 3,
    "previousClose": 100,
    "price": 0,
    "timestamp": 1790000000
   },
   "MSFT": {
    "change": 3,
    "high": 104,
    "low": 99,
    "open": 101,
    "percentChange": 3,
    "previousClose": 0,
    "price": 103,
    "timestamp": 1790000000
   },
   "NVDA": {
    "change": 3,
    "high": 0,
    "low": 0,
    "open": 0,
    "percentChange": 3,
    "previousClose": 100,
    "price": 103,
    "timestamp": "NA"
   }
  }
 },
 "stocksNetworkFailure": {
  "cacheLog": [
   [
    "get",
    "prices",
    "AAPL",
    null
   ],
   [
    "get",
    "prices",
    "MSFT",
    null
   ]
  ],
  "fetchUrls": [
   "/api/stocks/prices?symbols=AAPL,MSFT"
  ],
  "result": {
   "AAPL": {
    "change": 0,
    "open": 240,
    "percentChange": 0,
    "previousClose": 240,
    "price": 240
   },
   "MSFT": {
    "change": 0,
    "open": 430,
    "percentChange": 0,
    "previousClose": 430,
    "price": 430
   }
  }
 },
 "stocksNonOk": {
  "cacheLog": [
   [
    "get",
    "prices",
    "AAPL",
    null
   ]
  ],
  "fetchUrls": [
   "/api/stocks/prices?symbols=AAPL"
  ],
  "result": {
   "AAPL": {
    "change": 0,
    "open": 240,
    "percentChange": 0,
    "previousClose": 240,
    "price": 240
   }
  }
 },
 "stocksPartial": {
  "cacheLog": [
   [
    "get",
    "prices",
    "AAPL",
    null
   ],
   [
    "get",
    "prices",
    "MSFT",
    null
   ],
   [
    "get",
    "prices",
    "ZZZZ",
    null
   ],
   [
    "set",
    "prices",
    "AAPL",
    {
     "change": 3,
     "high": 104,
     "low": 99,
     "open": 101,
     "percentChange": 3,
     "previousClose": 100,
     "price": 103,
     "timestamp": 1790000000
    }
   ]
  ],
  "fetchUrls": [
   "/api/stocks/prices?symbols=AAPL,MSFT,ZZZZ"
  ],
  "result": {
   "AAPL": {
    "change": 3,
    "high": 104,
    "low": 99,
    "open": 101,
    "percentChange": 3,
    "previousClose": 100,
    "price": 103,
    "timestamp": 1790000000
   },
   "MSFT": {
    "change": 0,
    "open": 430,
    "percentChange": 0,
    "previousClose": 430,
    "price": 430
   },
   "ZZZZ": {
    "change": 0,
    "open": 100,
    "percentChange": 0,
    "previousClose": 100,
    "price": 100
   }
  }
 },
 "stocksWrapper": {
  "cacheLog": [
   [
    "get",
    "prices",
    "AAPL",
    null
   ],
   [
    "set",
    "prices",
    "AAPL",
    {
     "change": 3,
     "high": 0,
     "low": 0,
     "open": 0,
     "percentChange": 3,
     "previousClose": 100,
     "price": 103,
     "timestamp": 1790000000
    }
   ],
   [
    "get",
    "prices",
    "MSFT",
    null
   ]
  ],
  "fetchUrls": [
   "/api/stocks/prices?symbols=AAPL",
   "/api/stocks/prices?symbols=MSFT"
  ],
  "result": {
   "fallback": {
    "change": 0,
    "high": 430,
    "low": 430,
    "open": 430,
    "percentChange": 0,
    "previousClose": 430,
    "price": 430,
    "symbol": "MSFT",
    "week52High": 537.5,
    "week52Low": 322.5
   },
   "genuine": {
    "change": 3,
    "high": 103,
    "low": 103,
    "open": 103,
    "percentChange": 3,
    "previousClose": 100,
    "price": 103,
    "symbol": "AAPL",
    "week52High": 128.75,
    "week52Low": 77.25
   }
  }
 }
};
// END GENERATED OFF REFERENCES

describe('OFF-3 — the stock batch service', () => {
  it('OFF stocksFresh: genuine records normalized, cached per symbol, returned', async () => {
    const out = await run(async () => {
      const p = api.getMultipleStockPrices(['aapl', 'MSFT']);
      await settle(0, json({ success: true, count: 2, prices: { AAPL: stockRecord(), MSFT: stockRecord({ price: 410, previousClose: 405 }) } }));
      return p;
    });
    offReference('stocksFresh', offView(out, { stock: true }), OFF.stocksFresh);
  });

  it('OFF stocksPartial: a symbol the proxy omits gets the configured fallback (430), uncached', async () => {
    const out = await run(async () => {
      const p = api.getMultipleStockPrices(['AAPL', 'MSFT', 'ZZZZ']);
      await settle(0, json({ success: true, count: 1, prices: { AAPL: stockRecord() } }));
      return p;
    });
    offReference('stocksPartial', offView(out, { stock: true }), OFF.stocksPartial);
  });

  it('OFF stocksNetworkFailure: a rejected fetch returns fallbacks for every requested symbol', async () => {
    const out = await run(async () => {
      const p = api.getMultipleStockPrices(['AAPL', 'MSFT']);
      await settle(0, new Error('network down'));
      return p;
    });
    offReference('stocksNetworkFailure', offView(out, { stock: true }), OFF.stocksNetworkFailure);
  });

  it('OFF stocksNonOk: a non-OK proxy response returns fallbacks', async () => {
    const out = await run(async () => {
      const p = api.getMultipleStockPrices(['AAPL']);
      await settle(0, json({ error: 'x' }, { ok: false, status: 500 }));
      return p;
    });
    offReference('stocksNonOk', offView(out, { stock: true }), OFF.stocksNonOk);
  });

  it('OFF stocksMalformed: success:false returns fallbacks', async () => {
    const out = await run(async () => {
      const p = api.getMultipleStockPrices(['AAPL']);
      await settle(0, json({ success: false, error: 'bad' }));
      return p;
    });
    offReference('stocksMalformed', offView(out, { stock: true }), OFF.stocksMalformed);
  });

  it('OFF stocksNA: "NA" in price, previousClose and timestamp normalizes exactly as today', async () => {
    const out = await run(async () => {
      const p = api.getMultipleStockPrices(['AAPL', 'MSFT', 'NVDA']);
      await settle(0, json({
        success: true,
        count: 3,
        prices: {
          AAPL: stockRecord({ price: 'NA', quoteOrigin: { version: 1, price: 'provider-close', previousClose: 'provider-previous-close' } }),
          MSFT: stockRecord({ previousClose: 'NA' }),
          NVDA: stockRecord({ timestamp: 'NA', high: 'NA', low: 0, open: null }),
        },
      }));
      return p;
    });
    offReference('stocksNA', offView(out, { stock: true }), OFF.stocksNA);
  });

  it('OFF stocksGenuineEqualsDefault: a genuine 430 is cached and returned like any genuine value', async () => {
    const out = await run(async () => {
      const p = api.getMultipleStockPrices(['MSFT']);
      await settle(0, json({ success: true, count: 1, prices: { MSFT: stockRecord({ price: 430, previousClose: 430 }) } }));
      return p;
    });
    offReference('stocksGenuineEqualsDefault', offView(out, { stock: true }), OFF.stocksGenuineEqualsDefault);
  });

  it('OFF stocksCacheHitAndMixed: a cached symbol is not re-requested; the rest are', async () => {
    const out = await run(async () => {
      const p1 = api.getMultipleStockPrices(['AAPL']);
      await settle(0, json({ success: true, count: 1, prices: { AAPL: stockRecord() } }));
      const first = await p1;
      const hit = await api.getMultipleStockPrices(['AAPL']);
      const p3 = api.getMultipleStockPrices(['AAPL', 'MSFT']);
      await settle(1, json({ success: true, count: 1, prices: { MSFT: stockRecord({ price: 410 }) } }));
      const mixed = await p3;
      return { first, hit, mixed };
    });
    offReference('stocksCacheHitAndMixed', {
      ...offView({ ...out, result: {} }, { stock: true }),
      result: tag(Object.fromEntries(Object.entries(out.result).map(([k, m]) => [k, offView({ result: m, cacheLog: [], fetchUrls: [] }, { stock: true }).result]))),
    }, OFF.stocksCacheHitAndMixed);
  });

  it('OFF stocksWrapper: getStockPrice substitutes the current for a missing high/low/open (unchanged)', async () => {
    const out = await run(async () => {
      const p = api.getStockPrice('aapl');
      await settle(0, json({ success: true, count: 1, prices: { AAPL: stockRecord({ high: 0, low: 0, open: 0 }) } }));
      const genuine = await p;
      const p2 = api.getStockPrice('MSFT');
      await settle(1, new Error('down'));
      const fallback = await p2;
      return { genuine, fallback };
    });
    // The wrapper's OWN output must be byte-identical (no provenance leaks into
    // it); only the cache write it causes may carry quoteOrigin.
    offReference('stocksWrapper', {
      result: tag(out.result),
      cacheLog: offView({ result: {}, cacheLog: out.cacheLog, fetchUrls: [] }, { stock: true }).cacheLog,
      fetchUrls: out.fetchUrls,
    }, OFF.stocksWrapper);
    expect(out.result.genuine).not.toHaveProperty('quoteOrigin');
    expect(out.result.fallback).not.toHaveProperty('quoteOrigin');
    expect(out.result.fallback).not.toHaveProperty('isFallback');
  });

  it('OFF stocksLateWrite: R1 then R2 issued; R2 returns first, R1 writes last; the next cache hit returns R1', async () => {
    const out = await run(async () => {
      const r1 = api.getMultipleStockPrices(['AAPL']);
      const r2 = api.getMultipleStockPrices(['AAPL']);
      await settle(1, json({ success: true, count: 1, prices: { AAPL: stockRecord({ price: 110, previousClose: 100, timestamp: 1790000200 }) } }));
      await settle(0, json({ success: true, count: 1, prices: { AAPL: stockRecord({ price: 103, previousClose: 99, timestamp: 1790000100 }) } }));
      const [a, b] = await Promise.all([r1, r2]);
      const hit = await api.getMultipleStockPrices(['AAPL']);
      return { r1: a, r2: b, hit };
    });
    offReference('stocksLateWrite', {
      ...offView({ ...out, result: {} }, { stock: true }),
      result: tag(Object.fromEntries(Object.entries(out.result).map(([k, m]) => [k, offView({ result: m, cacheLog: [], fetchUrls: [] }, { stock: true }).result]))),
    }, OFF.stocksLateWrite);
  });

  it('OFF stocksFailedLaterRequest: R2 fails while R1 is in flight; R1 still writes; R2 gets fallbacks', async () => {
    const out = await run(async () => {
      const r1 = api.getMultipleStockPrices(['AAPL']);
      const r2 = api.getMultipleStockPrices(['AAPL']);
      await settle(1, new Error('R2 failed'));
      await settle(0, json({ success: true, count: 1, prices: { AAPL: stockRecord({ price: 103 }) } }));
      const [a, b] = await Promise.all([r1, r2]);
      const hit = await api.getMultipleStockPrices(['AAPL']);
      return { r1: a, r2: b, hit };
    });
    offReference('stocksFailedLaterRequest', {
      ...offView({ ...out, result: {} }, { stock: true }),
      result: tag(Object.fromEntries(Object.entries(out.result).map(([k, m]) => [k, offView({ result: m, cacheLog: [], fetchUrls: [] }, { stock: true }).result]))),
    }, OFF.stocksFailedLaterRequest);
  });

  it('OFF stocksAfterHoursReload: an after-hours write persists, survives a reload, and is served with no request', async () => {
    vi.setSystemTime(new Date('2026-10-01T22:00:00.000Z')); // 6 PM ET Thursday — closed
    const out = await run(async () => {
      const p = api.getMultipleStockPrices(['AAPL']);
      await settle(0, json({ success: true, count: 1, prices: { AAPL: stockRecord({ price: 105, previousClose: 100 }) } }));
      const written = await p;
      vi.setSystemTime(new Date('2026-10-02T01:00:00.000Z')); // 9 PM ET — still closed
      reloadCache(); // the reload: a new cache instance reads localStorage
      const reloaded = await api.getMultipleStockPrices(['AAPL']);
      return { written, reloaded };
    });
    offReference('stocksAfterHoursReload', {
      ...offView({ ...out, result: {} }, { stock: true }),
      result: tag(Object.fromEntries(Object.entries(out.result).map(([k, m]) => [k, offView({ result: m, cacheLog: [], fetchUrls: [] }, { stock: true }).result]))),
    }, OFF.stocksAfterHoursReload);
  });
});

describe('OFF-3 — the crypto batch service', () => {
  it('OFF cryptoFresh: genuine records normalized (no open), cached, returned', async () => {
    const out = await run(async () => {
      const p = api.getMultipleCryptoPrices(['btc', 'ETH']);
      await settle(0, json({ success: true, count: 2, prices: { BTC: cryptoRecord(), ETH: cryptoRecord({ price: 2500, previousClose: 2480 }) } }));
      return p;
    });
    offReference('cryptoFresh', offView(out, { stock: false }), OFF.cryptoFresh);
  });

  it('OFF cryptoPartialAndNA: a non-positive or "NA" price is dropped and returns the configured fallback', async () => {
    const out = await run(async () => {
      const p = api.getMultipleCryptoPrices(['BTC', 'ETH', 'SOL', 'DOGE']);
      await settle(0, json({
        success: true,
        count: 3,
        prices: {
          BTC: cryptoRecord({ price: 'NA' }),
          ETH: cryptoRecord({ price: 0 }),
          SOL: cryptoRecord({ price: 150, previousClose: 'NA', timestamp: 'NA' }),
        },
      }));
      return p;
    });
    offReference('cryptoPartialAndNA', offView(out, { stock: false }), OFF.cryptoPartialAndNA);
  });

  it('OFF cryptoNetworkFailure: a rejected fetch returns isFallback records', async () => {
    const out = await run(async () => {
      const p = api.getMultipleCryptoPrices(['BTC', 'ETH']);
      await settle(0, new Error('down'));
      return p;
    });
    offReference('cryptoNetworkFailure', offView(out, { stock: false }), OFF.cryptoNetworkFailure);
  });

  it('OFF cryptoCacheHitAndMixed', async () => {
    const out = await run(async () => {
      const p1 = api.getMultipleCryptoPrices(['BTC']);
      await settle(0, json({ success: true, count: 1, prices: { BTC: cryptoRecord() } }));
      const first = await p1;
      const hit = await api.getMultipleCryptoPrices(['BTC']);
      const p3 = api.getMultipleCryptoPrices(['BTC', 'ETH']);
      await settle(1, json({ success: true, count: 1, prices: { ETH: cryptoRecord({ price: 2500 }) } }));
      const mixed = await p3;
      return { first, hit, mixed };
    });
    offReference('cryptoCacheHitAndMixed', {
      ...offView({ ...out, result: {} }, { stock: false }),
      result: tag(Object.fromEntries(Object.entries(out.result).map(([k, m]) => [k, offView({ result: m, cacheLog: [], fetchUrls: [] }, { stock: false }).result]))),
    }, OFF.cryptoCacheHitAndMixed);
  });

  it('OFF cryptoWrapper: getCryptoPrice output unchanged for genuine and fallback', async () => {
    const out = await run(async () => {
      const p = api.getCryptoPrice('BTC');
      await settle(0, json({ success: true, count: 1, prices: { BTC: cryptoRecord({ high: 0 }) } }));
      const genuine = await p;
      const p2 = api.getCryptoPrice('ETH');
      await settle(1, new Error('down'));
      const fallback = await p2;
      return { genuine, fallback };
    });
    offReference('cryptoWrapper', {
      result: tag(out.result),
      cacheLog: offView({ result: {}, cacheLog: out.cacheLog, fetchUrls: [] }, { stock: false }).cacheLog,
      fetchUrls: out.fetchUrls,
    }, OFF.cryptoWrapper);
    expect(out.result.genuine).not.toHaveProperty('quoteOrigin');
    expect(out.result.fallback).not.toHaveProperty('quoteOrigin');
  });

  it('OFF cryptoLateWrite: R2 returns first, R1 writes last; the next cache hit returns R1', async () => {
    const out = await run(async () => {
      const r1 = api.getMultipleCryptoPrices(['BTC']);
      const r2 = api.getMultipleCryptoPrices(['BTC']);
      await settle(1, json({ success: true, count: 1, prices: { BTC: cryptoRecord({ price: 62000, timestamp: 1790000200 }) } }));
      await settle(0, json({ success: true, count: 1, prices: { BTC: cryptoRecord({ price: 61000, timestamp: 1790000100 }) } }));
      const [a, b] = await Promise.all([r1, r2]);
      const hit = await api.getMultipleCryptoPrices(['BTC']);
      return { r1: a, r2: b, hit };
    });
    offReference('cryptoLateWrite', {
      ...offView({ ...out, result: {} }, { stock: false }),
      result: tag(Object.fromEntries(Object.entries(out.result).map(([k, m]) => [k, offView({ result: m, cacheLog: [], fetchUrls: [] }, { stock: false }).result]))),
    }, OFF.cryptoLateWrite);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ON rows — the producer metadata, interpreted by the gate (ON-F1b) and the
// Option 1 ordering rule over the REAL service and cache (ON-F3a–c). The gate
// is imported dynamically so this file's static imports stay valid at the
// pre-build SHA (the OFF rows above can be re-captured there).
// ─────────────────────────────────────────────────────────────────────────────

const gate = () => import('../screens/battleView/shadowCpuQuoteIntegrity.js');
const NOW = () => Date.now();

describe('ON-F1b — provenance survives normalization and the client cache; the gate reads it', () => {
  it('stock and crypto normalization carry quoteOrigin unchanged into the cache and out of a cache hit', async () => {
    const p = api.getMultipleStockPrices(['AAPL']);
    await settle(0, json({ success: true, count: 1, prices: { AAPL: stockRecord({ quoteOrigin: { version: 1, price: 'provider-previous-close', previousClose: 'provider-previous-close' } }) } }));
    const fresh = await p;
    expect(fresh.AAPL.quoteOrigin).toEqual({ version: 1, price: 'provider-previous-close', previousClose: 'provider-previous-close' });
    expect(cacheLog.find(([op]) => op === 'set')[3].quoteOrigin).toEqual(fresh.AAPL.quoteOrigin);
    const hit = await api.getMultipleStockPrices(['AAPL']);
    expect(hit.AAPL.quoteOrigin).toEqual(fresh.AAPL.quoteOrigin);

    const c = api.getMultipleCryptoPrices(['BTC']);
    await settle(1, json({ success: true, count: 1, prices: { BTC: cryptoRecord() } }));
    expect((await c).BTC.quoteOrigin).toEqual({ version: 1, price: 'provider-close', previousClose: 'provider-previous-close' });
  });

  it('configured fallbacks are marked: stock gains isFallback + configured-fallback origins; crypto keeps its marker, previousClose missing', async () => {
    const { interpretQuote } = await gate();
    const p = api.getMultipleStockPrices(['MSFT']);
    await settle(0, new Error('down'));
    const stock = (await p).MSFT;
    expect(stock).toMatchObject({ price: 430, previousClose: 430, open: 430, isFallback: true });
    expect(stock.quoteOrigin).toEqual({ version: 1, price: 'configured-fallback', previousClose: 'configured-fallback' });
    const qs = interpretQuote(stock, { nowMs: NOW() });
    expect(qs.current).toMatchObject({ qualified: false, reason: 'configured-fallback' });
    expect(qs.previousClose.genuine).toBe(false);

    const c = api.getMultipleCryptoPrices(['ETH']);
    await settle(1, new Error('down'));
    const crypto = (await c).ETH;
    expect(crypto.quoteOrigin).toEqual({ version: 1, price: 'configured-fallback', previousClose: 'missing' });
    expect(interpretQuote(crypto, { nowMs: NOW() }).current.reason).toBe('configured-fallback');
  });

  it('a pre-upgrade cache record (no quoteOrigin) is served as an ordinary hit — no eviction, no request — and is unavailable only in the gate', async () => {
    const { interpretQuote } = await gate();
    cacheBox.current.set('prices', 'AAPL', { price: 103, previousClose: 100, open: 101, change: 3, percentChange: 3, high: 104, low: 99, timestamp: 1790000000 });
    cacheLog.length = 0;
    const hit = await api.getMultipleStockPrices(['AAPL']);
    expect(fetchUrls).toHaveLength(0);
    expect(cacheLog.filter(([op]) => op === 'set')).toHaveLength(0);
    const q = interpretQuote(hit.AAPL, { nowMs: NOW() });
    expect(q.current).toMatchObject({ qualified: false, reason: 'unproven-origin' });
    expect(q.previousClose).toMatchObject({ genuine: false, reason: 'unproven-origin' });
    // …and still there afterwards: the gate never evicts.
    expect((await api.getMultipleStockPrices(['AAPL'])).AAPL.price).toBe(103);
    expect(fetchUrls).toHaveLength(0);
  });

  it('recovery without previousClose keeps only the GENUINE close — never the configured 430', async () => {
    const { interpretQuote, adoptQuote } = await gate();
    let state = null;
    const step = async (i, response) => {
      const p = api.getMultipleStockPrices(['MSFT']);
      await settle(i, response);
      const rec = (await p).MSFT;
      state = adoptQuote(state, interpretQuote(rec, { nowMs: NOW() }));
      cacheBox.current.delete('prices', 'MSFT');
    };
    await step(0, json({ success: true, count: 1, prices: { MSFT: stockRecord({ price: 410, previousClose: 405 }) } }));
    expect(state.genuineClose).toBe(405);
    await step(1, new Error('down'));
    expect(state).toMatchObject({ status: 'stale', genuineClose: 405 });
    await step(2, json({ success: true, count: 1, prices: { MSFT: stockRecord({ price: 412, previousClose: 0, quoteOrigin: { version: 1, price: 'provider-close', previousClose: 'missing' } }) } }));
    expect(state).toMatchObject({ status: 'usable', genuineClose: 405 });
    expect(state.accepted.price).toBe(412);
  });

  it('a previous-close substitution alone cannot complete a position or earn a dated stale label', async () => {
    const { interpretQuote, adoptQuote, lastQuoteLabel } = await gate();
    const p = api.getMultipleStockPrices(['AAPL']);
    await settle(0, json({ success: true, count: 1, prices: { AAPL: stockRecord({ price: 100, previousClose: 100, quoteOrigin: { version: 1, price: 'provider-previous-close', previousClose: 'provider-previous-close' } }) } }));
    const state = adoptQuote(null, interpretQuote((await p).AAPL, { nowMs: NOW() }));
    expect(state.status).toBe('unavailable');
    expect(state.accepted).toBeNull();
    expect(state.genuineClose).toBe(100);
    expect(lastQuoteLabel(state)).toBeNull();
  });

  it('[A-8] an OLDER record whose current is unqualified still contributes its genuine previousClose', async () => {
    const { interpretQuote, adoptQuote } = await gate();
    const accepted = adoptQuote(null, interpretQuote(stockRecord({ price: 110, previousClose: 100, timestamp: 1790000200 }), { nowMs: NOW() }));
    const older = interpretQuote(stockRecord({ price: 98, previousClose: 97, timestamp: 1790000100, quoteOrigin: { version: 1, price: 'provider-previous-close', previousClose: 'provider-previous-close' } }), { nowMs: NOW() });
    const next = adoptQuote(accepted, older);
    expect(next.genuineClose).toBe(97);
    expect(next.status).toBe('stale');
    expect(next.accepted.price).toBe(110);
  });
});

/** Run R1 (issued first) and R2 against the real service, R2 answering first, then an actual later cache hit. */
async function raceThenHit(kind, r2, r1) {
  const fetchFn = kind === 'stock' ? api.getMultipleStockPrices : api.getMultipleCryptoPrices;
  const sym = kind === 'stock' ? 'AAPL' : 'BTC';
  const make = kind === 'stock' ? stockRecord : cryptoRecord;
  const a = fetchFn([sym]);
  const b = fetchFn([sym]);
  await settle(1, r2 instanceof Error ? r2 : json({ success: true, count: 1, prices: { [sym]: make(r2) } }));
  await settle(0, r1 instanceof Error ? r1 : json({ success: true, count: 1, prices: { [sym]: make(r1) } }));
  const [res1, res2] = await Promise.all([a, b]);
  const hit = await fetchFn([sym]);
  return { res1: res1[sym], res2: res2[sym], hit: hit[sym], requests: fetchUrls.length };
}

describe('ON-F3a — Option 1 over the real service: R1/R2 plus the ACTUAL later cache hit', () => {
  for (const kind of ['stock', 'crypto']) {
    const P1 = kind === 'stock' ? { price: 103, previousClose: 99 } : { price: 61000, previousClose: 60500 };
    const P2 = kind === 'stock' ? { price: 110, previousClose: 100 } : { price: 62000, previousClose: 60700 };

    it(`${kind}: R1 strictly older (both times valid) → the cache hit is rejected; R2's tuple and close stay`, async () => {
      const { interpretQuote, adoptQuote } = await gate();
      const run = await raceThenHit(kind, { ...P2, timestamp: 1790000200 }, { ...P1, timestamp: 1790000100 });
      let state = adoptQuote(null, interpretQuote(run.res2, { nowMs: NOW() }));
      // R1's own callback belongs to the same context here; it is older → rejected.
      state = adoptQuote(state, interpretQuote(run.res1, { nowMs: NOW() }));
      expect(run.hit.price).toBe(P1.price); // the late write DID reach the physical cache
      state = adoptQuote(state, interpretQuote(run.hit, { nowMs: NOW() }));
      expect(state.accepted).toMatchObject({ price: P2.price, marketTimeMs: 1790000200000 });
      expect(state.genuineClose).toBe(P2.previousClose);
      expect(run.requests).toBe(2); // no compensating request
    });

    it(`${kind}: R1 NEWER → adopted from the cache hit, with its own time`, async () => {
      const { interpretQuote, adoptQuote } = await gate();
      const run = await raceThenHit(kind, { ...P2, timestamp: 1790000100 }, { ...P1, timestamp: 1790000200 });
      let state = adoptQuote(null, interpretQuote(run.res2, { nowMs: NOW() }));
      state = adoptQuote(state, interpretQuote(run.hit, { nowMs: NOW() }));
      expect(state.accepted).toMatchObject({ price: P1.price, marketTimeMs: 1790000200000 });
      expect(state.genuineClose).toBe(P1.previousClose);
    });

    for (const [label, t2, t1] of [
      ['equal', 1790000200, 1790000200],
      ['absent on R1', 1790000200, null],
      ['absent on R2', null, 1790000100],
      ['invalid ("NA") on R1', 1790000200, 'NA'],
      ['in the future on R1 (fails as a time only)', 1790000200, 2000000000],
    ]) {
      it(`${kind}: ${label} → no strict-older proof, R1 is adopted (and its genuine previousClose)`, async () => {
        const { interpretQuote, adoptQuote } = await gate();
        const run = await raceThenHit(kind, { ...P2, timestamp: t2 }, { ...P1, timestamp: t1 });
        let state = adoptQuote(null, interpretQuote(run.res2, { nowMs: NOW() }));
        state = adoptQuote(state, interpretQuote(run.hit, { nowMs: NOW() }));
        expect(state.status).toBe('usable');
        expect(state.accepted.price).toBe(P1.price);
        expect(state.genuineClose).toBe(P1.previousClose);
        // Never borrows the earlier observation's time.
        const own = typeof t1 === 'number' && t1 * 1000 <= NOW() ? t1 * 1000 : null;
        expect(state.accepted.marketTimeMs).toBe(own);
      });
    }
  }
});

describe('ON-F3b — failures, retired callbacks, recovery and the C-3 lifetime', () => {
  it('another caller\'s later R2 fails, then R1 succeeds: R1 qualifies; R2\'s failure poisons nothing', async () => {
    const { interpretQuote, adoptQuote } = await gate();
    const run = await raceThenHit('stock', new Error('R2 failed'), { price: 103, previousClose: 99, timestamp: 1790000100 });
    expect(run.res2.isFallback).toBe(true);
    const state = adoptQuote(null, interpretQuote(run.res1, { nowMs: NOW() }));
    expect(state).toMatchObject({ status: 'usable', genuineClose: 99 });
    expect(adoptQuote(null, interpretQuote(run.hit, { nowMs: NOW() })).status).toBe('usable');
  });

  it('missing/stale → qualified recovery, and an older valid-time record never revives a stale observation', async () => {
    const { interpretQuote, adoptQuote } = await gate();
    let state = adoptQuote(null, interpretQuote(stockRecord({ price: 110, timestamp: 1790000200 }), { nowMs: NOW() }));
    state = adoptQuote(state, interpretQuote({ price: 240, previousClose: 240, open: 240, change: 0, percentChange: 0, isFallback: true, quoteOrigin: { version: 1, price: 'configured-fallback', previousClose: 'configured-fallback' } }, { nowMs: NOW() }));
    expect(state.status).toBe('stale');
    const older = adoptQuote(state, interpretQuote(stockRecord({ price: 104, timestamp: 1790000100 }), { nowMs: NOW() }));
    expect(older).toBe(state); // rejected whole; still stale, not promoted
    const recovered = adoptQuote(state, interpretQuote(stockRecord({ price: 111, timestamp: 1790000300 }), { nowMs: NOW() }));
    expect(recovered).toMatchObject({ status: 'usable', accepted: { price: 111 } });
  });

  it('[C-3] an older valid-time copy is rejected on EVERY cache hit while the entry lives, again after expiry, then a failure — no deadline asserted', async () => {
    const { interpretQuote, adoptQuote } = await gate();
    const newer = stockRecord({ price: 110, previousClose: 100, timestamp: 1790000200 });
    let state = adoptQuote(null, interpretQuote(newer, { nowMs: NOW() }));
    // The screen's own poll fails (a fallback), leaving the accepted tuple stale.
    state = adoptQuote(state, interpretQuote({ price: 240, previousClose: 240, open: 240, change: 0, percentChange: 0, isFallback: true, quoteOrigin: { version: 1, price: 'configured-fallback', previousClose: 'configured-fallback' } }, { nowMs: NOW() }));
    expect(state.status).toBe('stale');
    // A late, OLDER genuine copy lands in the browser cache.
    const p = api.getMultipleStockPrices(['AAPL']);
    await settle(0, json({ success: true, count: 1, prices: { AAPL: stockRecord({ price: 103, previousClose: 99, timestamp: 1790000100 }) } }));
    await p;
    for (let i = 0; i < 3; i++) {
      await vi.advanceTimersByTimeAsync(30000); // inside the 2-minute regular-hours lifetime
      const hit = (await api.getMultipleStockPrices(['AAPL'])).AAPL;
      state = adoptQuote(state, interpretQuote(hit, { nowMs: NOW() }));
      expect(state.status, `hit ${i}`).toBe('stale');
    }
    expect(fetchUrls).toHaveLength(1);
    // Past the lifetime the next ordinary request goes out; upstream serves the
    // same older copy again (server/CDN cache) — still rejected.
    await vi.advanceTimersByTimeAsync(60000);
    const again = api.getMultipleStockPrices(['AAPL']);
    await settle(1, json({ success: true, count: 1, prices: { AAPL: stockRecord({ price: 103, previousClose: 99, timestamp: 1790000100 }) } }));
    state = adoptQuote(state, interpretQuote((await again).AAPL, { nowMs: NOW() }));
    expect(state.status).toBe('stale');
    // …and then the request fails outright: still unavailable, still no promise of recovery.
    cacheBox.current.delete('prices', 'AAPL');
    const failing = api.getMultipleStockPrices(['AAPL']);
    await settle(2, new Error('down'));
    state = adoptQuote(state, interpretQuote((await failing).AAPL, { nowMs: NOW() }));
    expect(state.status).toBe('stale');
    expect(state.accepted.price).toBe(110);
  });
});

describe('ON-F3c — after-hours persistence through the REAL cache service', () => {
  for (const [label, writeAt, readAt, ts] of [
    ['weeknight', '2026-10-01T22:00:00.000Z', '2026-10-02T01:00:00.000Z', 1790892000],
    // Within one closed Saturday: the cache's market-aware TTL is "time until
    // the next open, from NOW" against the age since the write (marketSchedule
    // getEffectiveTTL), so a Friday-evening write is already expired by Sunday.
    // That is existing cache behaviour, untouched here (no cacheService edit).
    ['closed weekend', '2026-10-03T14:00:00.000Z', '2026-10-03T22:00:00.000Z', 1790971200],
    ['absent timestamp', '2026-10-01T22:00:00.000Z', '2026-10-02T01:00:00.000Z', null],
  ]) {
    it(`${label}: persisted genuine quote, cache recreated, the ordinary hit qualifies with no request`, async () => {
      const { interpretQuote, adoptQuote } = await gate();
      vi.setSystemTime(new Date(writeAt));
      const p = api.getMultipleStockPrices(['AAPL']);
      await settle(0, json({ success: true, count: 1, prices: { AAPL: stockRecord({ price: 105, previousClose: 100, timestamp: ts }) } }));
      await p;
      vi.setSystemTime(new Date(readAt));
      reloadCache();
      const reloaded = (await api.getMultipleStockPrices(['AAPL'])).AAPL;
      expect(fetchUrls).toHaveLength(1);
      const state = adoptQuote(null, interpretQuote(reloaded, { nowMs: NOW() }));
      expect(state).toMatchObject({ status: 'usable', accepted: { price: 105 } });
      expect(state.accepted.marketTimeMs).toBe(ts === null ? null : ts * 1000);
    });
  }

  it('an unknown-origin control persisted the same way stays unavailable', async () => {
    const { interpretQuote, adoptQuote } = await gate();
    vi.setSystemTime(new Date('2026-10-01T22:00:00.000Z'));
    const p = api.getMultipleStockPrices(['AAPL']);
    await settle(0, json({ success: true, count: 1, prices: { AAPL: (({ quoteOrigin, ...r }) => r)(stockRecord({ price: 105 })) } }));
    await p;
    vi.setSystemTime(new Date('2026-10-02T01:00:00.000Z'));
    reloadCache();
    const reloaded = (await api.getMultipleStockPrices(['AAPL'])).AAPL;
    expect(reloaded).not.toHaveProperty('quoteOrigin');
    expect(adoptQuote(null, interpretQuote(reloaded, { nowMs: NOW() })).status).toBe('unavailable');
  });

  it('a remount after a late write may accept the genuine record (no persistent ordering memory)', async () => {
    const { interpretQuote, adoptQuote } = await gate();
    const run = await raceThenHit('stock', { price: 110, previousClose: 100, timestamp: 1790000200 }, { price: 103, previousClose: 99, timestamp: 1790000100 });
    // A remount starts with no accepted observation: nothing to compare against.
    const afterRemount = adoptQuote(null, interpretQuote(run.hit, { nowMs: NOW() }));
    expect(afterRemount).toMatchObject({ status: 'usable', accepted: { price: 103 } });
  });
});
