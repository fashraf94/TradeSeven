import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';

/**
 * useMarketContext — Fetches index intelligence data from Firestore.
 * Reads indexIntelligence/marketContext (global) and indexIntelligence/{symbol} (per-index).
 * Caches data in state to avoid re-fetching on tab switches.
 * Includes a single automatic retry on failure (handles transient network errors).
 */
export default function useMarketContext(symbol) {
  const [marketContext, setMarketContext] = useState(null);
  const [indexData, setIndexData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const loadedSymbolRef = useRef(null);

  const fetchData = useCallback(async (isRetry = false) => {
    if (!symbol) return;
    setLoading(true);
    setError(null);
    try {
      const [contextSnap, indexSnap] = await Promise.all([
        getDoc(doc(db, 'indexIntelligence', 'marketContext')),
        getDoc(doc(db, 'indexIntelligence', symbol)),
      ]);
      setMarketContext(contextSnap.exists() ? contextSnap.data() : null);
      setIndexData(indexSnap.exists() ? indexSnap.data() : null);
      loadedSymbolRef.current = symbol;
    } catch (err) {
      const errCode = err.code || 'unknown';
      console.error(
        `[useMarketContext] Firestore read failed (${isRetry ? 'retry' : 'first attempt'}):\n` +
        `  paths: indexIntelligence/marketContext, indexIntelligence/${symbol}\n` +
        `  code: ${errCode}\n` +
        `  message: ${err.message}`
      );
      if (errCode === 'permission-denied') {
        console.error('[useMarketContext] Firestore rules may not be deployed. Run: firebase deploy --only firestore:rules');
      }
      // Auto-retry once after a short delay (covers transient network errors)
      if (!isRetry) {
        await new Promise(r => setTimeout(r, 1500));
        return fetchData(true);
      }
      setError(err.message || 'Failed to load market intelligence');
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    if (symbol && symbol !== loadedSymbolRef.current) {
      fetchData();
    }
  }, [symbol, fetchData]);

  return { marketContext, indexData, loading, error, refetch: fetchData };
}
