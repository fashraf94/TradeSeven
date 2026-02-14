// useWebSocketPrices - React hook for real-time WebSocket price streaming
// Wraps the singleton WebSocketManager with throttled React state updates.
// Max 1 re-render per second regardless of WebSocket message frequency.

import { useState, useEffect, useRef, useCallback } from 'react';
import { wsManager } from '../services/websocketService';

const FLUSH_INTERVAL_MS = 1000;

/**
 * Subscribe to real-time WebSocket prices for the given symbols.
 *
 * @param {string[]} symbols - Array of symbols to subscribe to (e.g. ['AAPL', 'BTC'])
 * @param {object} options
 * @param {boolean} options.enabled - Set to false to skip subscription (default: true)
 * @returns {{ prices: Record<string, number>, status: 'connecting'|'connected'|'disconnected' }}
 */
export function useWebSocketPrices(symbols, options = {}) {
  const { enabled = true } = options;

  console.log('[WebSocket Debug]', 'useWebSocketPrices called with symbols:', symbols, 'enabled:', enabled);

  const [prices, setPrices] = useState({});
  const [status, setStatus] = useState('disconnected');

  // Accumulator buffer — collects prices between flushes
  const bufferRef = useRef({});
  const hasBufferedRef = useRef(false);

  // Track previous symbols for cleanup
  const prevSymbolsRef = useRef([]);

  // Price callback — accumulates into buffer (no React setState)
  const onPrice = useCallback(({ symbol, price }) => {
    bufferRef.current[symbol] = price;
    hasBufferedRef.current = true;
  }, []);

  // Status callback
  const onStatus = useCallback((newStatus) => {
    setStatus(newStatus);
  }, []);

  // Subscribe/unsubscribe when symbols change
  useEffect(() => {
    if (!enabled || !symbols || symbols.length === 0) {
      // Unsubscribe previous if any
      if (prevSymbolsRef.current.length > 0) {
        wsManager.unsubscribe(prevSymbolsRef.current);
        prevSymbolsRef.current = [];
      }
      return;
    }

    const sorted = [...symbols].sort();
    const prevSorted = [...prevSymbolsRef.current].sort();

    // Skip if symbols haven't actually changed
    if (sorted.length === prevSorted.length && sorted.every((s, i) => s === prevSorted[i])) {
      return;
    }

    // Unsubscribe old, subscribe new
    if (prevSymbolsRef.current.length > 0) {
      wsManager.unsubscribe(prevSymbolsRef.current);
    }

    wsManager.subscribe(sorted);
    prevSymbolsRef.current = sorted;

    return () => {
      wsManager.unsubscribe(sorted);
      prevSymbolsRef.current = [];
    };
  }, [symbols, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // Attach event listeners
  useEffect(() => {
    if (!enabled) return;

    wsManager.on('price', onPrice);
    wsManager.on('status', onStatus);

    return () => {
      wsManager.off('price', onPrice);
      wsManager.off('status', onStatus);
    };
  }, [enabled, onPrice, onStatus]);

  // Flush buffer into React state at fixed interval
  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      if (hasBufferedRef.current) {
        const buffered = bufferRef.current;
        bufferRef.current = {};
        hasBufferedRef.current = false;

        setPrices(prev => {
          // Only update if something actually changed
          let changed = false;
          for (const sym in buffered) {
            if (prev[sym] !== buffered[sym]) {
              changed = true;
              break;
            }
          }
          if (!changed) return prev;
          return { ...prev, ...buffered };
        });
      }
    }, FLUSH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [enabled]);

  return { prices, status };
}

export default useWebSocketPrices;
