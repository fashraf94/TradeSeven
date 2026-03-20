import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';

/**
 * useMarketContext — Fetches index intelligence data from Firestore.
 * Reads indexIntelligence/marketContext (global) and indexIntelligence/{symbol} (per-index).
 * Caches data in state to avoid re-fetching on tab switches.
 */
export default function useMarketContext(symbol) {
  const [marketContext, setMarketContext] = useState(null);
  const [indexData, setIndexData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const loadedSymbolRef = useRef(null);

  const fetchData = useCallback(async () => {
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
      console.error('[useMarketContext] Firestore read failed:', err);
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
