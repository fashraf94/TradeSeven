// src/services/fantasyTimesDetector.js
// Client-side ATR trigger detection for FantasyTimes.
// Subscribes to WebSocket price stream, fires story generation
// when stocks move beyond 1.5x their 14-day ATR.

import { wsManager } from './websocketService.js';
import { fetchHistoricalOHLCV } from './eodhdAPI.js';

const LOG_PREFIX = '[FantasyTimesDetector]';
const ATR_THRESHOLD = 1.5; // Trigger at 1.5x ATR
const DEFAULT_THRESHOLD_PCT = 3; // Fallback if ATR unavailable
const MACRO_TRIGGER_COUNT = 5; // Triggers needed for macro alert
const MACRO_WINDOW_MS = 2 * 60 * 1000; // 2-minute macro aggregation window
const DEDUP_WINDOW_MS = 4 * 60 * 60 * 1000; // 4-hour dedup (client-side mirror)

/**
 * Calculate ATR from OHLCV data (14-period).
 * Expects data sorted newest-first.
 */
function calculateATR(ohlcvData, period = 14) {
  if (!ohlcvData || ohlcvData.length < period + 1) return null;

  // Need period+1 data points to calculate period true ranges
  const data = ohlcvData.slice(0, period + 1);

  let trSum = 0;
  for (let i = 0; i < period; i++) {
    const high = data[i].high || data[i].h;
    const low = data[i].low || data[i].l;
    const prevClose = data[i + 1].close || data[i + 1].c || data[i + 1].adjusted_close;

    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trSum += tr;
  }

  return trSum / period;
}

export class FantasyTimesDetector {
  constructor() {
    this._atrCache = new Map(); // symbol -> { atr, loadedAt }
    this._prevCloses = new Map(); // symbol -> prevClose
    this._triggerQueue = []; // { symbol, price, percentChange, atr, atrMultiple, direction, timestamp }
    this._recentTriggers = new Map(); // symbol -> timestamp (dedup)
    this._macroTimer = null;
    this._priceHandler = null;
    this._active = false;
  }

  /**
   * Start listening to WebSocket price stream.
   * @param {string[]} symbols - Symbols to monitor
   * @param {Object} prevCloses - Map of symbol -> previous close price
   */
  start(symbols, prevCloses = {}) {
    if (this._active) return;
    this._active = true;

    // Store previous closes
    for (const [sym, price] of Object.entries(prevCloses)) {
      this._prevCloses.set(sym.toUpperCase(), price);
    }

    // Prefetch ATR data
    this.loadATRData(symbols);

    // Subscribe to price events
    this._priceHandler = ({ symbol, price }) => {
      this.processPrice(symbol, price);
    };
    wsManager.on('price', this._priceHandler);

    console.log(`${LOG_PREFIX} Started monitoring ${symbols.length} symbols`);
  }

  /** Stop listening. */
  stop() {
    if (!this._active) return;
    this._active = false;

    if (this._priceHandler) {
      wsManager.off('price', this._priceHandler);
      this._priceHandler = null;
    }
    if (this._macroTimer) {
      clearTimeout(this._macroTimer);
      this._macroTimer = null;
    }

    console.log(`${LOG_PREFIX} Stopped`);
  }

  /**
   * Process a price tick and check against ATR threshold.
   */
  processPrice(symbol, price) {
    const upperSymbol = symbol.toUpperCase();
    const prevClose = this._prevCloses.get(upperSymbol);
    if (!prevClose || prevClose <= 0) return;

    const priceChange = price - prevClose;
    const percentChange = (priceChange / prevClose) * 100;

    // Look up ATR
    const atrEntry = this._atrCache.get(upperSymbol);
    let threshold;
    let atrMultiple;

    if (atrEntry && atrEntry.atr > 0) {
      threshold = atrEntry.atr * ATR_THRESHOLD;
      atrMultiple = Math.abs(priceChange) / atrEntry.atr;
    } else {
      // Fallback: 3% threshold
      threshold = prevClose * (DEFAULT_THRESHOLD_PCT / 100);
      atrMultiple = Math.abs(percentChange) / DEFAULT_THRESHOLD_PCT;
    }

    // Check if move exceeds threshold
    if (Math.abs(priceChange) < threshold) return;

    // Client-side dedup: skip if same symbol triggered recently
    const lastTrigger = this._recentTriggers.get(upperSymbol);
    if (lastTrigger && Date.now() - lastTrigger < DEDUP_WINDOW_MS) return;

    // Mark triggered
    this._recentTriggers.set(upperSymbol, Date.now());

    const trigger = {
      symbol: upperSymbol,
      currentPrice: price,
      priceChange: Number(priceChange.toFixed(2)),
      percentChange: Number(percentChange.toFixed(2)),
      atr14: atrEntry?.atr || 0,
      atrMultiple: Number(atrMultiple.toFixed(1)),
      direction: priceChange >= 0 ? 'up' : 'down',
      triggerType: atrEntry ? 'atr' : 'fallback',
      timestamp: Date.now(),
    };

    console.log(`${LOG_PREFIX} Trigger: ${upperSymbol} ${trigger.direction} ${trigger.percentChange}% (${trigger.atrMultiple}x ATR)`);

    this._triggerQueue.push(trigger);
    this._scheduleMacroCheck();
  }

  /**
   * After 2-minute buffer, decide: individual stories or macro alert.
   */
  _scheduleMacroCheck() {
    if (this._macroTimer) return; // Already scheduled

    this._macroTimer = setTimeout(() => {
      this._macroTimer = null;
      this._flushTriggers();
    }, MACRO_WINDOW_MS);
  }

  /**
   * Flush trigger queue: <5 → individual mover calls, >=5 → macro call.
   */
  async _flushTriggers() {
    const triggers = this._triggerQueue.splice(0);
    if (triggers.length === 0) return;

    if (triggers.length >= MACRO_TRIGGER_COUNT) {
      // Macro alert
      await this._fireMacroAlert(triggers);
    } else {
      // Individual mover stories
      for (const trigger of triggers) {
        await this._fireMoverStory(trigger);
      }
    }
  }

  async _fireMoverStory(trigger) {
    try {
      const response = await fetch('/api/fantasytimes/generate-mover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trigger),
      });
      const result = await response.json();
      if (result.success) {
        console.log(`${LOG_PREFIX} Story published for ${trigger.symbol}: ${result.storyId}`);
      } else {
        console.log(`${LOG_PREFIX} Story skipped for ${trigger.symbol}: ${result.reason || result.error}`);
      }
    } catch (error) {
      console.error(`${LOG_PREFIX} Failed to generate story for ${trigger.symbol}:`, error.message);
    }
  }

  async _fireMacroAlert(triggers) {
    try {
      // Compute market context
      const directions = triggers.map((t) => t.direction);
      const upCount = directions.filter((d) => d === 'up').length;
      const dominantDirection = upCount > triggers.length / 2 ? 'up' : upCount < triggers.length / 2 ? 'down' : 'mixed';
      const avgChange = triggers.reduce((sum, t) => sum + t.percentChange, 0) / triggers.length;

      // Sector breakdown (if sector data available on triggers)
      const sectorBreakdown = {};
      for (const t of triggers) {
        const sector = t.sector || 'Unknown';
        sectorBreakdown[sector] = (sectorBreakdown[sector] || 0) + 1;
      }

      const response = await fetch('/api/fantasytimes/generate-macro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          triggers: triggers.map((t) => ({
            symbol: t.symbol,
            percentChange: t.percentChange,
            direction: t.direction,
          })),
          marketContext: {
            dominantDirection,
            avgChange: Number(avgChange.toFixed(2)),
            sectorBreakdown,
          },
        }),
      });
      const result = await response.json();
      if (result.success) {
        console.log(`${LOG_PREFIX} Macro alert published: ${result.storyId}`);
      }
    } catch (error) {
      console.error(`${LOG_PREFIX} Failed to generate macro alert:`, error.message);
    }
  }

  /**
   * Prefetch ATR values for monitored symbols.
   * Uses EODHD historical data to compute 14-day ATR.
   */
  async loadATRData(symbols) {
    const staleThreshold = 24 * 60 * 60 * 1000; // Refresh daily
    const symbolsToLoad = symbols.filter((s) => {
      const cached = this._atrCache.get(s.toUpperCase());
      return !cached || Date.now() - cached.loadedAt > staleThreshold;
    });

    if (symbolsToLoad.length === 0) return;

    console.log(`${LOG_PREFIX} Loading ATR data for ${symbolsToLoad.length} symbols`);

    // Batch with small delay to avoid rate limits
    for (const symbol of symbolsToLoad) {
      try {
        const ohlcv = await fetchHistoricalOHLCV(symbol, '1d', { days: 30 });
        if (ohlcv && Array.isArray(ohlcv) && ohlcv.length >= 15) {
          const atr = calculateATR(ohlcv);
          if (atr && atr > 0) {
            this._atrCache.set(symbol.toUpperCase(), { atr, loadedAt: Date.now() });
          }
        }
      } catch (error) {
        console.warn(`${LOG_PREFIX} Failed to load ATR for ${symbol}:`, error.message);
      }
    }

    console.log(`${LOG_PREFIX} ATR cache: ${this._atrCache.size} symbols loaded`);
  }

  /** Get current trigger queue size (for diagnostics). */
  getDiagnostics() {
    return {
      active: this._active,
      atrCacheSize: this._atrCache.size,
      triggerQueueSize: this._triggerQueue.length,
      recentTriggers: this._recentTriggers.size,
      prevClosesLoaded: this._prevCloses.size,
    };
  }
}

// Singleton instance
export const fantasyTimesDetector = new FantasyTimesDetector();
export default fantasyTimesDetector;
