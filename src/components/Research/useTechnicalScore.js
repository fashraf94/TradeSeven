import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';

/**
 * useTechnicalScore — Fetches technical score data from Firestore.
 * Reads stockTechnicalScores/{symbol} for technical rank, score, and factor breakdown.
 * Includes a single automatic retry on failure (handles transient network errors).
 */
export default function useTechnicalScore(symbol) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const loadedRef = useRef(null);

  const fetchData = useCallback(async (isRetry = false) => {
    if (!symbol) return;
    setLoading(true);
    setError(null);
    try {
      const snap = await getDoc(doc(db, 'stockTechnicalScores', symbol));
      setData(snap.exists() ? snap.data() : null);
      loadedRef.current = symbol;
    } catch (err) {
      console.error(
        `[useTechnicalScore] Firestore read failed (${isRetry ? 'retry' : 'first attempt'}):\n` +
        `  path: stockTechnicalScores/${symbol}\n` +
        `  code: ${err.code || 'unknown'}\n` +
        `  message: ${err.message}`
      );
      if (!isRetry) {
        await new Promise(r => setTimeout(r, 1500));
        return fetchData(true);
      }
      setError(err.message || 'Failed to load technical score');
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    if (symbol && symbol !== loadedRef.current) {
      fetchData();
    }
  }, [symbol, fetchData]);

  return { data, loading, error };
}
