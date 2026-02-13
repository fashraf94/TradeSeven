import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { fetchHistoricalOHLCV } from '../../services/eodhdAPI';
import { calculateRollingSMA, calculateRSI, calculateMACD, calculateSMA } from '../../services/technicalIndicators';
import { detectLevels } from '../../services/levelDetection';
import { aggregateToMonthly } from './chartUtils';

/**
 * Central data hook for the redesigned Research modal.
 * Manages OHLCV data, technical indicators, and S/R levels.
 *
 * @param {string} symbol - Stock/crypto ticker
 * @returns {Object} { ohlcvData, timeframe, setTimeframe, indicators, levels, smaData, loading, error }
 */
export default function useResearchData(symbol) {
  const [rawData, setRawData] = useState(null);    // Raw API response (newest-first)
  const [timeframe, setTimeframe] = useState('1D');  // UI timeframe: '1D' | '1W' | '1M'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const abortRef = useRef(null);
  const cacheRef = useRef({});  // In-memory cache keyed by `${symbol}_${apiTimeframe}`

  // Map UI timeframe to API timeframe
  const isBomb = timeframe === 'bomb';
  const apiTimeframe = isBomb ? '1h' : (timeframe === '1D' ? '1d' : '1w');
  const bombDays = 20; // 20 trading days of hourly data (~140 candles)

  // Fetch data when symbol or API timeframe changes
  useEffect(() => {
    if (!symbol) return;

    const cacheKey = isBomb ? `${symbol}_1h_bomb` : `${symbol}_${apiTimeframe}`;

    // Check in-memory cache
    if (cacheRef.current[cacheKey]) {
      setRawData(cacheRef.current[cacheKey]);
      setError(null);
      return;
    }

    // Abort previous in-flight request
    if (abortRef.current) {
      abortRef.current.aborted = true;
    }
    const thisRequest = { aborted: false };
    abortRef.current = thisRequest;

    setLoading(true);
    setError(null);

    fetchHistoricalOHLCV(symbol, apiTimeframe, isBomb ? { days: bombDays } : undefined)
      .then(data => {
        if (thisRequest.aborted) return;
        if (!data || data.length === 0) {
          setError('No historical data available');
          setRawData(null);
        } else {
          cacheRef.current[cacheKey] = data;
          setRawData(data);
        }
      })
      .catch(err => {
        if (thisRequest.aborted) return;
        setError(err.message || 'Failed to fetch data');
        setRawData(null);
      })
      .finally(() => {
        if (thisRequest.aborted) return;
        setLoading(false);
      });

    return () => {
      thisRequest.aborted = true;
    };
  }, [symbol, apiTimeframe, isBomb]);

  // Process data based on UI timeframe
  const ohlcvData = useMemo(() => {
    if (!rawData) return null;

    // Data from API is newest-first, reverse to oldest-first for processing
    const reversed = [...rawData].reverse();

    if (timeframe === 'bomb') {
      // Bomb view: all hourly candles (~140 for 20 trading days)
      return reversed;
    }
    if (timeframe === '1W') {
      // Weekly data, slice to ~52 most recent weeks (1 year)
      return reversed.slice(-52);
    }
    if (timeframe === '1M') {
      // Aggregate weekly data into monthly
      return aggregateToMonthly(reversed);
    }
    // 1D: daily data as-is
    return reversed;
  }, [rawData, timeframe]);

  // Compute closing prices (newest-first, as expected by indicator functions)
  const closingPrices = useMemo(() => {
    if (!rawData) return [];
    // rawData is newest-first — extract close prices in that order
    return rawData.map(c => Number(c.close)).filter(p => Number.isFinite(p) && p > 0);
  }, [rawData]);

  // Compute technical indicators from daily data (only meaningful for '1D' timeframe raw data)
  const indicators = useMemo(() => {
    if (closingPrices.length < 15) return null;

    const rsi = calculateRSI(closingPrices);
    const macd = calculateMACD(closingPrices);
    const sma20 = calculateSMA(closingPrices, 20);
    const sma50 = calculateSMA(closingPrices, 50);
    const sma200 = calculateSMA(closingPrices, 200);

    return { rsi, macd, sma20, sma50, sma200 };
  }, [closingPrices]);

  // Compute SMA line data for chart overlay (newest-first input → newest-first output)
  const smaData = useMemo(() => {
    if (!rawData || rawData.length < 20) return null;

    // calculateRollingSMA expects newest-first OHLCV data
    const sma20 = calculateRollingSMA(rawData, 20);
    const sma50 = calculateRollingSMA(rawData, 50);

    return { sma20, sma50 };
  }, [rawData]);

  // Compute S/R levels using daily data (newest-first)
  const levels = useMemo(() => {
    if (!rawData || rawData.length < 20 || !indicators) return null;

    try {
      return detectLevels(rawData, indicators);
    } catch {
      return null;
    }
  }, [rawData, indicators]);

  // Retry function
  const retry = useCallback(() => {
    const cacheKey = isBomb ? `${symbol}_1h_bomb` : `${symbol}_${apiTimeframe}`;
    delete cacheRef.current[cacheKey];
    setRawData(null);
    setError(null);
    setLoading(true);
    fetchHistoricalOHLCV(symbol, apiTimeframe, isBomb ? { days: bombDays } : undefined)
      .then(data => {
        if (!data || data.length === 0) {
          setError('No historical data available');
        } else {
          cacheRef.current[cacheKey] = data;
          setRawData(data);
        }
      })
      .catch(err => setError(err.message || 'Failed to fetch data'))
      .finally(() => setLoading(false));
  }, [symbol, apiTimeframe, isBomb]);

  return {
    ohlcvData,       // Oldest-first, processed for current timeframe
    rawData,         // Newest-first, raw from API (for indicators/levels)
    timeframe,
    setTimeframe,
    indicators,
    smaData,
    levels,
    loading,
    error,
    retry,
  };
}
