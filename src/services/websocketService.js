// WebSocket Manager for EODHD Real-Time Price Streaming
// Singleton service managing stock + crypto WebSocket connections
// with reference counting, auto-reconnect, and symbol mapping.
//
// Market-aware: Exposes getMarketStatus() for UI indicators showing
// LIVE / CLOSED / WARMING UP / WEEKEND / HOLIDAY states.

import { isCrypto } from '../utils/stockHelpers';
import { getMarketState, isMarketOpen } from '../utils/marketSchedule';

// ==================== SYMBOL MAPPING ====================

/** Convert app symbol to EODHD WebSocket format */
function toWsSymbol(symbol, type) {
  if (type === 'crypto') return `${symbol}-USD`;
  return symbol; // EODHD WebSocket expects bare symbols (e.g., "AAPL"), not "AAPL.US"
}

/** Convert EODHD WebSocket symbol back to app format */
function fromWsSymbol(wsSymbol) {
  if (wsSymbol.endsWith('-USD')) return wsSymbol.replace('-USD', '');
  if (wsSymbol.endsWith('.US')) return wsSymbol.replace('.US', '');
  return wsSymbol;
}

// ==================== WEBSOCKET MANAGER ====================

class WebSocketManager {
  constructor() {
    this._stockWs = null;
    this._cryptoWs = null;
    this._wsUrls = null; // { stocksUrl, cryptoUrl } from proxy
    this._urlPromise = null; // dedup fetch
    this._transportDisabled = false; // B1: server disabled browser→vendor WS transport

    // Reference counting: { symbol: count }
    this._stockSubscriptions = {};
    this._cryptoSubscriptions = {};

    // Event listeners: { eventName: Set<callback> }
    this._listeners = { price: new Set(), status: new Set() };

    // Reconnect state
    this._stockReconnectDelay = 2000;
    this._cryptoReconnectDelay = 2000;
    this._stockReconnectTimer = null;
    this._cryptoReconnectTimer = null;
    this._maxReconnectDelay = 30000;

    // Grace period for closing idle connections
    this._stockCloseTimer = null;
    this._cryptoCloseTimer = null;
    this._closingGraceMs = 5000;

    // Track connection status
    this._stockStatus = 'disconnected';
    this._cryptoStatus = 'disconnected';

    // Daily high/low tracker for accurate candle display
    this._dailyHL = new Map();     // symbol → { high, low, open, date, lastUpdate }
    this._dailyHLDate = null;      // Track which trading day we're accumulating for

    // Price cache for bridge to cacheService (symbol → { price, timestamp })
    this._priceCache = new Map();

    // Extended-hours filter: log once per after-hours session
    this._extendedHoursWarned = false;

    // --- Diagnostics tracking ---
    this._messagesReceived = 0;
    this._stockLastMessageTime = null;
    this._cryptoLastMessageTime = null;
    this._connectedSince = null;
    this._lastError = null;
    this._stockReconnectAttempts = 0;
    this._cryptoReconnectAttempts = 0;
  }

  // ==================== EVENT SYSTEM ====================

  on(event, callback) {
    if (this._listeners[event]) {
      this._listeners[event].add(callback);
    }
  }

  off(event, callback) {
    if (this._listeners[event]) {
      this._listeners[event].delete(callback);
    }
  }

  _emit(event, data) {
    if (this._listeners[event]) {
      this._listeners[event].forEach(cb => {
        try { cb(data); } catch (e) { console.error('[WebSocket] Listener error:', e); }
      });
    }
  }

  _emitStatus() {
    // Overall status: connected if either channel is connected
    let status = 'disconnected';
    if (this._stockStatus === 'connected' || this._cryptoStatus === 'connected') {
      status = 'connected';
    } else if (this._stockStatus === 'connecting' || this._cryptoStatus === 'connecting') {
      status = 'connecting';
    }
    // Emit as string for backward compatibility with useWebSocketPrices hook.
    // For market state info, consumers should call getMarketStatus() directly.
    this._emit('status', status);
  }

  // ==================== URL FETCHING ====================

  async _fetchWsUrls() {
    if (this._transportDisabled) return null;
    if (this._wsUrls) return this._wsUrls;

    // Dedup concurrent fetches
    if (this._urlPromise) return this._urlPromise;

    this._urlPromise = (async () => {
      try {
        const res = await fetch('/api/ws-config');
        if (!res.ok) throw new Error(`ws-config responded ${res.status}`);
        const data = await res.json();
        // Containment B1: the server no longer provides a browser WebSocket
        // transport (it never sends the EODHD token to the client). Treat
        // `available:false` — or any response missing the vendor URLs — as a
        // TERMINAL, non-retried disabled state and fall back to REST polling.
        // This is distinct from a transient fetch/network error (caught below),
        // which may still retry on the next subscribe.
        if (!data || data.available === false || !data.stocksUrl || !data.cryptoUrl) {
          this._transportDisabled = true;
          this._wsUrls = null;
          return null;
        }
        this._wsUrls = data;
        return data;
      } catch (err) {
        console.error('[WebSocket] Failed to fetch WS config:', err);
        this._urlPromise = null;
        throw err;
      }
    })();

    return this._urlPromise;
  }

  /**
   * Probe whether a browser WebSocket transport is available this session.
   * Returns false when the server has disabled direct browser→vendor streaming
   * (containment B1) or when the config cannot be fetched — callers then use
   * the REST/EOD fallback immediately instead of waiting on a dead socket.
   * Never throws; never fabricates a price.
   */
  async probeTransport() {
    if (this._transportDisabled) return false;
    try {
      const urls = await this._fetchWsUrls();
      return !!urls && !this._transportDisabled;
    } catch {
      return false;
    }
  }

  // ==================== SUBSCRIBE / UNSUBSCRIBE ====================

  subscribe(symbols) {
    if (!symbols || symbols.length === 0) return;

    const stockSymbols = symbols.filter(s => !isCrypto(s));
    const cryptoSymbols = symbols.filter(s => isCrypto(s));

    // Increment ref counts and collect newly-added symbols
    const newStocks = this._addRefs(stockSymbols, this._stockSubscriptions);
    const newCrypto = this._addRefs(cryptoSymbols, this._cryptoSubscriptions);

    // Ensure connections are open and send subscribe messages
    if (Object.keys(this._stockSubscriptions).length > 0) {
      this._ensureStockConnection(newStocks);
    }
    if (Object.keys(this._cryptoSubscriptions).length > 0) {
      this._ensureCryptoConnection(newCrypto);
    }
  }

  unsubscribe(symbols) {
    if (!symbols || symbols.length === 0) return;

    const stockSymbols = symbols.filter(s => !isCrypto(s));
    const cryptoSymbols = symbols.filter(s => isCrypto(s));

    const removedStocks = this._removeRefs(stockSymbols, this._stockSubscriptions);
    const removedCrypto = this._removeRefs(cryptoSymbols, this._cryptoSubscriptions);

    // Send unsubscribe for removed symbols
    if (removedStocks.length > 0 && this._stockWs?.readyState === WebSocket.OPEN) {
      const wsSymbols = removedStocks.map(s => toWsSymbol(s, 'stock')).join(',');
      this._stockWs.send(JSON.stringify({ action: 'unsubscribe', symbols: wsSymbols }));
    }
    if (removedCrypto.length > 0 && this._cryptoWs?.readyState === WebSocket.OPEN) {
      const wsSymbols = removedCrypto.map(s => toWsSymbol(s, 'crypto')).join(',');
      this._cryptoWs.send(JSON.stringify({ action: 'unsubscribe', symbols: wsSymbols }));
    }

    // Close idle connections after grace period
    if (Object.keys(this._stockSubscriptions).length === 0) {
      this._scheduleClose('stock');
    }
    if (Object.keys(this._cryptoSubscriptions).length === 0) {
      this._scheduleClose('crypto');
    }
  }

  _addRefs(symbols, refMap) {
    const newSymbols = [];
    symbols.forEach(s => {
      if (!refMap[s]) {
        refMap[s] = 1;
        newSymbols.push(s);
      } else {
        refMap[s]++;
      }
    });
    return newSymbols;
  }

  _removeRefs(symbols, refMap) {
    const removed = [];
    symbols.forEach(s => {
      if (refMap[s]) {
        refMap[s]--;
        if (refMap[s] <= 0) {
          delete refMap[s];
          removed.push(s);
        }
      }
    });
    return removed;
  }

  // ==================== CONNECTION MANAGEMENT ====================

  async _ensureStockConnection(newSymbols) {
    // Containment B1: no browser WebSocket transport — stay disconnected and
    // let consumers use the REST fallback. Never open a socket or schedule a
    // reconnect.
    if (this._transportDisabled) {
      this._stockStatus = 'disconnected';
      this._emitStatus();
      return;
    }

    // Cancel any pending close
    if (this._stockCloseTimer) {
      clearTimeout(this._stockCloseTimer);
      this._stockCloseTimer = null;
    }

    if (this._stockWs?.readyState === WebSocket.OPEN) {
      // Already connected — just subscribe new symbols
      if (newSymbols.length > 0) {
        this._sendSubscribe(this._stockWs, newSymbols, 'stock');
      }
      return;
    }

    if (this._stockWs?.readyState === WebSocket.CONNECTING) {
      return; // Already connecting, onopen will subscribe all
    }

    // Need new connection
    try {
      this._stockStatus = 'connecting';
      this._emitStatus();

      const urls = await this._fetchWsUrls();
      if (!urls) {
        // Transport disabled (server returned available:false) — stay
        // disconnected; do not open a socket or reconnect.
        this._transportDisabled = true;
        this._stockStatus = 'disconnected';
        this._emitStatus();
        return;
      }
      this._stockWs = new WebSocket(urls.stocksUrl);

      this._stockWs.onopen = () => {
        console.log('[WebSocket] Connected to stocks');
        this._stockStatus = 'connected';
        this._stockReconnectDelay = 2000; // Reset backoff
        this._stockReconnectAttempts = 0;
        if (!this._connectedSince) this._connectedSince = Date.now();
        this._emitStatus();

        // Subscribe ALL tracked symbols (not just new ones)
        const allSymbols = Object.keys(this._stockSubscriptions);
        if (allSymbols.length > 0) {
          this._sendSubscribe(this._stockWs, allSymbols, 'stock');
        }

        // No application-level heartbeat needed — EODHD uses WebSocket
        // protocol-level ping/pong for keepalive. Sending unsupported
        // actions (like 'heartbeat') causes 422 errors.
      };

      this._stockWs.onmessage = (event) => {
        this._messagesReceived++;
        this._stockLastMessageTime = new Date();
        this._handleMessage(event.data, 'stock');
      };

      this._stockWs.onclose = () => {
        console.log('[WebSocket] Stock connection closed');
        this._stockStatus = 'disconnected';
        this._cleanupStock();
        this._emitStatus();

        // Reconnect if we still have subscriptions
        if (Object.keys(this._stockSubscriptions).length > 0) {
          this._stockReconnectAttempts++;
          if (this._stockReconnectAttempts >= 3) {
            console.warn(
              `[WebSocket] stock connection failed ${this._stockReconnectAttempts} times — ` +
              `may be approaching EODHD concurrent connection limit (50 max). ` +
              `Subscribed to ${Object.keys(this._stockSubscriptions).length} symbols.`
            );
          }
          this._scheduleReconnect('stock');
        }
      };

      this._stockWs.onerror = (err) => {
        this._lastError = `stock: ${err.message || 'Connection error'} at ${new Date().toISOString()}`;
        console.error('[WebSocket] Stock connection error:', err);
      };
    } catch (err) {
      console.error('[WebSocket] Failed to open stock connection:', err);
      this._stockStatus = 'disconnected';
      this._emitStatus();
      if (!this._transportDisabled && Object.keys(this._stockSubscriptions).length > 0) {
        this._scheduleReconnect('stock');
      }
    }
  }

  async _ensureCryptoConnection(newSymbols) {
    // Containment B1: no browser WebSocket transport — stay disconnected.
    if (this._transportDisabled) {
      this._cryptoStatus = 'disconnected';
      this._emitStatus();
      return;
    }

    if (this._cryptoCloseTimer) {
      clearTimeout(this._cryptoCloseTimer);
      this._cryptoCloseTimer = null;
    }

    if (this._cryptoWs?.readyState === WebSocket.OPEN) {
      if (newSymbols.length > 0) {
        this._sendSubscribe(this._cryptoWs, newSymbols, 'crypto');
      }
      return;
    }

    if (this._cryptoWs?.readyState === WebSocket.CONNECTING) {
      return;
    }

    try {
      this._cryptoStatus = 'connecting';
      this._emitStatus();

      const urls = await this._fetchWsUrls();
      if (!urls) {
        // Transport disabled (server returned available:false) — stay
        // disconnected; do not open a socket or reconnect.
        this._transportDisabled = true;
        this._cryptoStatus = 'disconnected';
        this._emitStatus();
        return;
      }
      this._cryptoWs = new WebSocket(urls.cryptoUrl);

      this._cryptoWs.onopen = () => {
        console.log('[WebSocket] Connected to crypto');
        this._cryptoStatus = 'connected';
        this._cryptoReconnectDelay = 2000;
        this._cryptoReconnectAttempts = 0;
        if (!this._connectedSince) this._connectedSince = Date.now();
        this._emitStatus();

        const allSymbols = Object.keys(this._cryptoSubscriptions);
        if (allSymbols.length > 0) {
          this._sendSubscribe(this._cryptoWs, allSymbols, 'crypto');
        }

        // No application-level heartbeat needed — EODHD uses WebSocket
        // protocol-level ping/pong for keepalive.
      };

      this._cryptoWs.onmessage = (event) => {
        this._messagesReceived++;
        this._cryptoLastMessageTime = new Date();
        this._handleMessage(event.data, 'crypto');
      };

      this._cryptoWs.onclose = () => {
        console.log('[WebSocket] Crypto connection closed');
        this._cryptoStatus = 'disconnected';
        this._cleanupCrypto();
        this._emitStatus();

        if (Object.keys(this._cryptoSubscriptions).length > 0) {
          this._cryptoReconnectAttempts++;
          if (this._cryptoReconnectAttempts >= 3) {
            console.warn(
              `[WebSocket] crypto connection failed ${this._cryptoReconnectAttempts} times — ` +
              `may be approaching EODHD concurrent connection limit (50 max). ` +
              `Subscribed to ${Object.keys(this._cryptoSubscriptions).length} symbols.`
            );
          }
          this._scheduleReconnect('crypto');
        }
      };

      this._cryptoWs.onerror = (err) => {
        this._lastError = `crypto: ${err.message || 'Connection error'} at ${new Date().toISOString()}`;
        console.error('[WebSocket] Crypto connection error:', err);
      };
    } catch (err) {
      console.error('[WebSocket] Failed to open crypto connection:', err);
      this._cryptoStatus = 'disconnected';
      this._emitStatus();
      if (!this._transportDisabled && Object.keys(this._cryptoSubscriptions).length > 0) {
        this._scheduleReconnect('crypto');
      }
    }
  }

  _sendSubscribe(ws, symbols, type) {
    if (ws?.readyState !== WebSocket.OPEN) return;
    const wsSymbols = symbols.map(s => toWsSymbol(s, type)).join(',');
    ws.send(JSON.stringify({ action: 'subscribe', symbols: wsSymbols }));
    console.log(`[WebSocket] Subscribed to ${type} (sent to EODHD):`, wsSymbols);
  }

  _handleMessage(raw, type = 'stock') {
    try {
      const data = JSON.parse(raw);

      // EODHD sends: { s: "AAPL", p: 185.42, ... } for stock trades
      // or status messages like { status_code, message }
      if (data.status_code !== undefined) {
        // Status/auth message — ignore
        return;
      }

      if (data.s && data.p !== undefined) {
        // Filter extended-hours ticks for stocks (crypto trades 24/7)
        if (type === 'stock' && data.ms === 'extended-hours') {
          if (!this._extendedHoursWarned) {
            console.log('[WebSocket] Filtering extended-hours ticks (market closed)');
            this._extendedHoursWarned = true;
          }
          return;
        }
        // Reset warning flag when regular session resumes
        if (type === 'stock' && data.ms === 'open' && this._extendedHoursWarned) {
          this._extendedHoursWarned = false;
        }

        const symbol = fromWsSymbol(data.s);
        const price = parseFloat(data.p);
        if (symbol && !isNaN(price) && price > 0) {
          this._emit('price', { symbol, price });

          // Store latest price for cache bridge
          this._priceCache.set(symbol, { price, timestamp: Date.now() });

          // --- Daily H/L Tracker ---
          // Use ET date (not UTC) for day boundary to prevent reset at 7 PM ET
          const etNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
          const etToday = `${etNow.getFullYear()}-${String(etNow.getMonth() + 1).padStart(2, '0')}-${String(etNow.getDate()).padStart(2, '0')}`;
          if (this._dailyHLDate !== etToday) {
            this._dailyHL.clear();
            this._dailyHLDate = etToday;
          }

          // Only track regular-session prices for stocks (skip pre/post-market)
          // to prevent extended-hours spikes from triggering false BaggerBomb/Bust badges.
          // Crypto tracks 24/7.
          if (type !== 'stock' || isMarketOpen()) {
            const existing = this._dailyHL.get(symbol);
            if (existing) {
              existing.high = Math.max(existing.high, price);
              existing.low = Math.min(existing.low, price);
              existing.lastUpdate = Date.now();
            } else {
              this._dailyHL.set(symbol, {
                high: price,
                low: price,
                open: price,
                date: etToday,
                lastUpdate: Date.now(),
              });
            }
          }
        }
      }
    } catch {
      // Ignore unparseable messages (heartbeat acks, etc.)
    }
  }

  // ==================== DAILY H/L GETTER ====================

  getDailyHL(symbol) {
    const etNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const etToday = `${etNow.getFullYear()}-${String(etNow.getMonth() + 1).padStart(2, '0')}-${String(etNow.getDate()).padStart(2, '0')}`;
    const data = this._dailyHL.get(symbol);
    if (data && data.date === etToday) {
      return { high: data.high, low: data.low, open: data.open };
    }
    return null;
  }

  // ==================== MARKET STATUS ====================

  /**
   * Get combined connection + market status for UI indicators.
   * @returns {{ stockStatus: string, cryptoStatus: string, marketState: string }}
   */
  getMarketStatus() {
    const { state } = getMarketState();
    return {
      stockStatus: this._stockStatus,
      cryptoStatus: this._cryptoStatus,
      marketState: state,
    };
  }

  // ==================== DIAGNOSTICS ====================

  getDiagnostics() {
    return {
      stocks: {
        connected: this._stockStatus === 'connected',
        readyState: this._stockWs?.readyState ?? null,
        subscribedSymbols: Object.keys(this._stockSubscriptions).length,
        symbolList: Object.keys(this._stockSubscriptions),
        reconnectAttempts: this._stockReconnectAttempts,
        lastMessageTime: this._stockLastMessageTime,
      },
      crypto: {
        connected: this._cryptoStatus === 'connected',
        readyState: this._cryptoWs?.readyState ?? null,
        subscribedSymbols: Object.keys(this._cryptoSubscriptions).length,
        symbolList: Object.keys(this._cryptoSubscriptions),
        reconnectAttempts: this._cryptoReconnectAttempts,
        lastMessageTime: this._cryptoLastMessageTime,
      },
      totalSubscriptions:
        Object.keys(this._stockSubscriptions).length +
        Object.keys(this._cryptoSubscriptions).length,
      messagesReceived: this._messagesReceived,
      connectionUptime: this._connectedSince ? Date.now() - this._connectedSince : 0,
      lastError: this._lastError,
    };
  }

  // ==================== RECONNECT ====================

  _scheduleReconnect(type) {
    // Containment B1: never reconnect when the browser WS transport is disabled.
    if (this._transportDisabled) return;
    if (type === 'stock') {
      if (this._stockReconnectTimer) return;
      console.log(`[WebSocket] Reconnecting stocks in ${this._stockReconnectDelay}ms`);
      this._stockReconnectTimer = setTimeout(() => {
        this._stockReconnectTimer = null;
        this._stockReconnectDelay = Math.min(this._stockReconnectDelay * 2, this._maxReconnectDelay);
        this._ensureStockConnection([]);
      }, this._stockReconnectDelay);
    } else {
      if (this._cryptoReconnectTimer) return;
      console.log(`[WebSocket] Reconnecting crypto in ${this._cryptoReconnectDelay}ms`);
      this._cryptoReconnectTimer = setTimeout(() => {
        this._cryptoReconnectTimer = null;
        this._cryptoReconnectDelay = Math.min(this._cryptoReconnectDelay * 2, this._maxReconnectDelay);
        this._ensureCryptoConnection([]);
      }, this._cryptoReconnectDelay);
    }
  }

  // ==================== CLEANUP ====================

  _cleanupStock() {
    // Reserved for future cleanup (heartbeat was removed — EODHD
    // handles keepalive at the WebSocket protocol level)
  }

  _cleanupCrypto() {
    // Reserved for future cleanup
  }

  _scheduleClose(type) {
    if (type === 'stock') {
      this._stockCloseTimer = setTimeout(() => {
        this._stockCloseTimer = null;
        if (Object.keys(this._stockSubscriptions).length === 0 && this._stockWs) {
          console.log('[WebSocket] Closing idle stock connection');
          this._stockWs.close();
          this._stockWs = null;
          this._cleanupStock();
          if (this._stockReconnectTimer) {
            clearTimeout(this._stockReconnectTimer);
            this._stockReconnectTimer = null;
          }
          this._stockStatus = 'disconnected';
          this._emitStatus();
        }
      }, this._closingGraceMs);
    } else {
      this._cryptoCloseTimer = setTimeout(() => {
        this._cryptoCloseTimer = null;
        if (Object.keys(this._cryptoSubscriptions).length === 0 && this._cryptoWs) {
          console.log('[WebSocket] Closing idle crypto connection');
          this._cryptoWs.close();
          this._cryptoWs = null;
          this._cleanupCrypto();
          if (this._cryptoReconnectTimer) {
            clearTimeout(this._cryptoReconnectTimer);
            this._cryptoReconnectTimer = null;
          }
          this._cryptoStatus = 'disconnected';
          this._emitStatus();
        }
      }, this._closingGraceMs);
    }
  }

  // ==================== PRICE CACHE (for wsCacheBridge) ====================

  getLatestPrices(symbols) {
    const prices = {};
    for (const sym of symbols) {
      const entry = this._priceCache.get(sym.toUpperCase());
      if (entry && entry.price > 0) {
        prices[sym.toUpperCase()] = entry.price;
      }
    }
    return prices;
  }

  getLatestPrice(symbol) {
    const entry = this._priceCache.get(symbol.toUpperCase());
    return entry?.price > 0 ? entry.price : null;
  }

  getAllCachedPrices() {
    const result = {};
    for (const [symbol, data] of this._priceCache) {
      result[symbol] = { ...data };
    }
    return result;
  }

  /** Force close all connections (e.g., on app unmount) */
  destroy() {
    if (this._stockWs) { this._stockWs.close(); this._stockWs = null; }
    if (this._cryptoWs) { this._cryptoWs.close(); this._cryptoWs = null; }
    this._cleanupStock();
    this._cleanupCrypto();
    if (this._stockReconnectTimer) clearTimeout(this._stockReconnectTimer);
    if (this._cryptoReconnectTimer) clearTimeout(this._cryptoReconnectTimer);
    if (this._stockCloseTimer) clearTimeout(this._stockCloseTimer);
    if (this._cryptoCloseTimer) clearTimeout(this._cryptoCloseTimer);
    this._stockSubscriptions = {};
    this._cryptoSubscriptions = {};
    this._stockStatus = 'disconnected';
    this._cryptoStatus = 'disconnected';
    this._listeners = { price: new Set(), status: new Set() };
    this._priceCache.clear();
  }
}

// ==================== SINGLETON ====================

export const wsManager = new WebSocketManager();
export function getDailyHL(symbol) { return wsManager.getDailyHL(symbol); }
export default wsManager;

// ==================== PRICE CAPTURE FOR BATTLE ENTRY ====================

/**
 * Subscribe to symbols via WebSocket and capture one real-time tick per symbol.
 * Checks WS price cache first for symbols already streaming.
 * Falls back gracefully — if WS is disconnected, all symbols end up in `missing`.
 *
 * @param {string[]} symbols - Raw symbols like ['AAPL', 'NVDA', 'BTC']
 * @param {number} timeoutMs - Max wait time (default 5000ms)
 * @returns {Promise<{ prices: Object, missing: string[], source: Object }>}
 */
export async function captureRealtimePrices(symbols, timeoutMs = 5000) {
  const prices = {};
  const source = {};
  const symbolSet = new Set(symbols.map(s => s.toUpperCase()));
  let remaining = symbolSet.size;

  // Check cache first — WS may already have recent prices from active streams
  const cached = wsManager.getAllCachedPrices();
  for (const sym of symbolSet) {
    if (cached[sym]?.price > 0) {
      prices[sym] = cached[sym].price;
      source[sym] = 'websocket-cached';
      remaining--;
    }
  }

  // If all symbols already cached, return immediately
  if (remaining <= 0) {
    return { prices, missing: [], source };
  }

  // Subscribe to get ticks for uncached symbols
  const uncachedSymbols = [...symbolSet].filter(s => !(s in prices));

  // Containment B1: if the browser WebSocket transport is disabled (server no
  // longer hands out a token-bearing vendor URL) or unreachable, skip the
  // socket wait entirely and report the remaining symbols as missing so the
  // caller's same-origin REST/EOD fallback runs immediately. No fabrication.
  const wsAvailable = await wsManager.probeTransport();
  if (!wsAvailable) {
    for (const sym of uncachedSymbols) source[sym] = 'ws-unavailable';
    return { prices, missing: uncachedSymbols, source };
  }

  wsManager.subscribe(uncachedSymbols);

  return new Promise((resolve) => {
    let resolved = false;

    const handler = ({ symbol, price }) => {
      if (resolved) return;
      const upper = symbol.toUpperCase();
      if (symbolSet.has(upper) && !(upper in prices) && price > 0) {
        prices[upper] = price;
        source[upper] = 'websocket';
        remaining--;
        if (remaining <= 0) {
          resolved = true;
          cleanup();
          resolve({ prices, missing: [], source });
        }
      }
    };

    const timer = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      cleanup();
      const missing = [...symbolSet].filter(s => !(s in prices));
      for (const sym of missing) source[sym] = 'timeout';
      resolve({ prices, missing, source });
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timer);
      wsManager.off('price', handler);
      wsManager.unsubscribe(uncachedSymbols);
    }

    wsManager.on('price', handler);
  });
}
