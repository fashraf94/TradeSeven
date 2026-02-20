import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { fetchHistoricalOHLCV, fetchTodayOHLC } from '../../services/eodhdAPI';
import { calculateRollingSMA, calculateRSI, calculateMACD, calculateSMA } from '../../services/technicalIndicators';
import { detectLevels } from '../../services/levelDetection';
import { aggregateToMonthly } from './chartUtils';

/**
 * Central data hook for the redesigned Research modal.
 * Manages OHLCV data, technical indicators, and S/R levels.
 *
 * @param {string} symbol - Stock/crypto ticker
 * @param {Object} options - Optional configuration
 * @param {number} options.currentPrice - Live price for synthetic candle (from header)
 * @param {boolean} options.isCrypto - Whether the asset is crypto (trades 24/7)
 * @returns {Object} { ohlcvData, timeframe, setTimeframe, indicators, levels, smaData, loading, error }
 */
export default function useResearchData(symbol, { currentPrice, isCrypto, initialTimeframe } = {}) {
  const [rawData, setRawData] = useState(null);    // Raw API response (newest-first)
  const [timeframe, setTimeframe] = useState(initialTimeframe || '1D');  // UI timeframe: '1D' | '1W' | '1M' | 'bomb' | 'spectate'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const abortRef = useRef(null);
  const cacheRef = useRef({});  // In-memory cache keyed by `${symbol}_${apiTimeframe}`

  // Map UI timeframe to API timeframe
  const isBomb = timeframe === 'bomb';
  const isSpectate = timeframe === 'spectate';
  const apiTimeframe = isSpectate ? '1m' : isBomb ? '1h' : (timeframe === '1D' ? '1d' : '1w');
  const bombDays = 20; // 20 trading days of hourly data (~140 candles)
  const spectateRefreshRef = useRef(null);

  // Fetch data when symbol or API timeframe changes
  useEffect(() => {
    if (!symbol) return;

    const cacheKey = isBomb ? `${symbol}_1h_bomb` : `${symbol}_${apiTimeframe}`;

    // Check in-memory cache (skip cache for spectate — always fetch fresh)
    if (!isSpectate && cacheRef.current[cacheKey]) {
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

    const cryptoOpt = isCrypto ? { type: 'crypto' } : {};
    const fetchOpts = isSpectate ? { days: 1, ...cryptoOpt } : isBomb ? { days: bombDays, ...cryptoOpt } : isCrypto ? cryptoOpt : undefined;
    fetchHistoricalOHLCV(symbol, apiTimeframe, fetchOpts)
      .then(data => {
        if (thisRequest.aborted) return;
        if (!data || data.length === 0) {
          if (isSpectate) {
            // Spectate fallback: use cached 1h bomb data if available
            const bombCacheKey = `${symbol}_1h_bomb`;
            const cachedBomb = cacheRef.current[bombCacheKey];
            if (cachedBomb && cachedBomb.length > 0) {
              console.log('[useResearchData] Spectate 1m empty, falling back to cached 1h bomb data');
              setRawData(cachedBomb);
              setError(null);
            } else {
              setError('1-minute data not available — try during market hours (9:30 AM – 4:00 PM ET)');
              setRawData(null);
            }
          } else {
            setError('No historical data available');
            setRawData(null);
          }
        } else {
          if (!isSpectate) cacheRef.current[cacheKey] = data;
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
  }, [symbol, apiTimeframe, isBomb, isSpectate]);

  // Auto-refresh spectate mode every 15 seconds
  // Guard: stop polling after 3 consecutive empty responses (EODHD has no 1m data)
  const emptyCountRef = useRef(0);
  useEffect(() => {
    if (spectateRefreshRef.current) {
      clearInterval(spectateRefreshRef.current);
      spectateRefreshRef.current = null;
    }
    if (!isSpectate || !symbol) {
      emptyCountRef.current = 0;
      return;
    }

    emptyCountRef.current = 0; // Reset on fresh spectate entry
    spectateRefreshRef.current = setInterval(() => {
      if (emptyCountRef.current >= 3) {
        console.log('[useResearchData] Spectate: stopped polling after 3 empty responses');
        clearInterval(spectateRefreshRef.current);
        spectateRefreshRef.current = null;
        return;
      }
      fetchHistoricalOHLCV(symbol, '1m', { days: 1, ...(isCrypto ? { type: 'crypto' } : {}) })
        .then(data => {
          if (data && data.length > 0) {
            emptyCountRef.current = 0;
            setRawData(data);
          } else {
            emptyCountRef.current++;
          }
        })
        .catch(() => {
          emptyCountRef.current++;
        });
    }, 15000);

    return () => {
      if (spectateRefreshRef.current) {
        clearInterval(spectateRefreshRef.current);
        spectateRefreshRef.current = null;
      }
    };
  }, [isSpectate, symbol]);

  // Fetch today's intraday OHLC for accurate daily candle patching
  const [todayIntraday, setTodayIntraday] = useState(null);
  useEffect(() => {
    if (!symbol || isCrypto || (timeframe !== '1D' && timeframe !== '1W')) {
      setTodayIntraday(null);
      return;
    }

    let cancelled = false;
    fetchTodayOHLC(symbol).then(data => {
      if (!cancelled && data) setTodayIntraday(data);
    });

    return () => { cancelled = true; };
  }, [symbol, timeframe, isCrypto]);

  // Process data based on UI timeframe
  const ohlcvData = useMemo(() => {
    if (!rawData) return null;

    // Data from API is newest-first, reverse to oldest-first for processing
    const reversed = [...rawData].reverse();

    let result;
    if (timeframe === 'spectate') {
      // Detect if data is 1-minute (real) or 1-hour (fallback from bomb cache)
      // 1m data has >20 candles in a single day; 1h has ~7
      const sample = reversed[0];
      const sampleDate = sample?.date || sample?.datetime || '';
      const isHourlyFallback = reversed.length > 10 && (() => {
        // If two adjacent candles are ~1 hour apart, it's hourly data
        if (reversed.length < 2) return false;
        const t0 = reversed[0]?.timestamp || Math.floor(new Date(reversed[0]?.date || reversed[0]?.datetime || 0).getTime() / 1000);
        const t1 = reversed[1]?.timestamp || Math.floor(new Date(reversed[1]?.date || reversed[1]?.datetime || 0).getTime() / 1000);
        return Math.abs(t1 - t0) >= 1800; // >30 min gap = hourly data
      })();

      if (isHourlyFallback) {
        // Hourly fallback: filter to only the most recent trading day
        // Use ET date to determine "today" — not the server's local timezone
        const nowET = new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York' });
        const lastTrading = new Date(nowET); // parsed as local date
        const dow = lastTrading.getDay();
        if (dow === 0) lastTrading.setDate(lastTrading.getDate() - 2); // Sun → Fri
        if (dow === 6) lastTrading.setDate(lastTrading.getDate() - 1); // Sat → Fri

        // Get the ET date string (YYYY-MM-DD) for matching
        const etDateStr = lastTrading.toISOString().slice(0, 10);

        // Helper: get the ET date of a unix timestamp as YYYY-MM-DD
        const getETDate = (unixTs) => {
          const d = new Date(unixTs * 1000);
          return d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); // en-CA → YYYY-MM-DD
        };

        // Helper: check if a candle falls within US market hours (9:30-16:00 ET)
        const isMarketHours = (unixTs) => {
          const d = new Date(unixTs * 1000);
          const etStr = d.toLocaleString('en-US', {
            timeZone: 'America/New_York',
            hour: 'numeric', minute: 'numeric', hour12: false
          });
          const [h, m] = etStr.split(':').map(Number);
          const mins = h * 60 + m;
          return mins >= 570 && mins <= 960; // 9:30 AM (570) to 4:00 PM (960)
        };

        let todayCandles = reversed.filter(c => {
          const t = c.timestamp || Math.floor(new Date(c.date || c.datetime || 0).getTime() / 1000);
          return getETDate(t) === etDateStr && isMarketHours(t);
        });

        // If empty (holiday/multi-day weekend/no data yet), find the most recent
        // trading day from the actual candle data instead of guessing calendar dates
        if (todayCandles.length === 0) {
          const mostRecentDate = (() => {
            for (let i = reversed.length - 1; i >= 0; i--) {
              const t = reversed[i].timestamp || Math.floor(new Date(reversed[i].date || reversed[i].datetime || 0).getTime() / 1000);
              if (isMarketHours(t)) return getETDate(t);
            }
            return null;
          })();
          if (mostRecentDate) {
            todayCandles = reversed.filter(c => {
              const t = c.timestamp || Math.floor(new Date(c.date || c.datetime || 0).getTime() / 1000);
              return getETDate(t) === mostRecentDate && isMarketHours(t);
            });
          }
        }

        // Final fallback: if still empty (e.g., all candles outside market hours), use last 24
        if (todayCandles.length === 0) {
          todayCandles = reversed.slice(-24);
        }

        console.log('[Spectate] Hourly fallback — target ET date:', etDateStr,
          'candles found:', todayCandles.length,
          todayCandles.map(c => {
            const t = c.timestamp || Math.floor(new Date(c.date || c.datetime || 0).getTime() / 1000);
            return new Date(t * 1000).toLocaleString('en-US', { timeZone: 'America/New_York' });
          }));

        result = todayCandles;
      } else {
        // Real 1m data: last ~60 candles
        result = reversed.slice(-60);
      }
    } else if (timeframe === 'bomb') {
      // Bomb view: all hourly candles (~140 for 20 trading days)
      result = reversed;
    } else if (timeframe === '1W') {
      // Weekly data, slice to ~52 most recent weeks (1 year)
      result = reversed.slice(-52);
    } else if (timeframe === '1M') {
      // Aggregate weekly data into monthly
      result = aggregateToMonthly(reversed);
    } else {
      // 1D: daily data as-is
      result = reversed;
    }

    // Append synthetic "live" candle if the last candle is stale and we have a live price.
    // This bridges the gap between EODHD historical data (which only includes completed
    // periods) and the live price shown in the header.
    if (currentPrice && currentPrice > 0 && result && result.length > 0) {
      const lastCandle = result[result.length - 1];
      const lastDateStr = lastCandle.date || lastCandle.datetime || '';

      if (timeframe === 'bomb' || timeframe === 'spectate') {
        // Hourly (bomb or spectate fallback): append if last candle is >1 hour old
        const lastTime = lastCandle.timestamp
          ? lastCandle.timestamp * 1000
          : new Date(lastDateStr).getTime();
        const hourMs = 60 * 60 * 1000;
        if (lastTime && (Date.now() - lastTime) > hourMs) {
          const nowHour = new Date();
          nowHour.setMinutes(0, 0, 0);
          result = [...result, {
            date: nowHour.toISOString(),
            datetime: nowHour.toISOString(),
            timestamp: Math.floor(nowHour.getTime() / 1000),
            open: lastCandle.close,
            high: Math.max(currentPrice, lastCandle.close),
            low: Math.min(currentPrice, lastCandle.close),
            close: currentPrice,
            volume: 0,
          }];
        } else if (lastTime) {
          // Latest candle is within the current hour — patch H/L/C with live price
          const patched = { ...lastCandle };
          patched.high = Math.max(Number(patched.high), currentPrice);
          patched.low = Math.min(Number(patched.low), currentPrice);
          patched.close = currentPrice;
          result = [...result.slice(0, -1), patched];
        }
      } else if (timeframe === '1W') {
        // Weekly: append if last candle is from a previous week
        // Parse as local date to avoid UTC-midnight shift (same fix as 1D)
        const [wy, wm, wd] = lastDateStr.substring(0, 10).split('-').map(Number);
        const lastDate = new Date(wy, wm - 1, wd);
        const monday = new Date();
        monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7)); // This Monday
        monday.setHours(0, 0, 0, 0);
        if (lastDate < monday) {
          const mondayStr = monday.toISOString().split('T')[0];
          const synHigh = todayIntraday
            ? Math.max(todayIntraday.high, currentPrice, lastCandle.close)
            : Math.max(currentPrice, lastCandle.close);
          const synLow = todayIntraday
            ? Math.min(todayIntraday.low, currentPrice, lastCandle.close)
            : Math.min(currentPrice, lastCandle.close);
          result = [...result, {
            date: mondayStr,
            open: lastCandle.close,
            high: synHigh,
            low: synLow,
            close: currentPrice,
            volume: todayIntraday?.volume || 0,
          }];
        } else {
          // Current week's candle exists — patch H/L/C with intraday + live price
          const patched = { ...lastCandle };
          patched.close = currentPrice;
          if (todayIntraday) {
            patched.high = Math.max(Number(patched.high), todayIntraday.high, currentPrice);
            patched.low = Math.min(Number(patched.low), todayIntraday.low, currentPrice);
            if (todayIntraday.volume > 0) patched.volume = (Number(patched.volume) || 0) + todayIntraday.volume;
          } else {
            patched.high = Math.max(Number(patched.high), currentPrice);
            patched.low = Math.min(Number(patched.low), currentPrice);
          }
          result = [...result.slice(0, -1), patched];
        }
      } else if (timeframe === '1D') {
        // Daily: append if last candle is from a previous day
        // Parse as local date to avoid UTC-midnight shift
        // new Date("YYYY-MM-DD") parses as UTC → setHours(0,0,0,0) shifts back a day in US timezones
        const [ly, lm, ld] = lastDateStr.substring(0, 10).split('-').map(Number);
        const lastDate = new Date(ly, lm - 1, ld);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // For stocks, skip weekends (Sat=6, Sun=0); crypto trades 24/7
        const dayOfWeek = today.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const shouldAppend = isCrypto ? true : !isWeekend;

        if (lastDate < today && shouldAppend) {
          const todayStr = today.toISOString().split('T')[0];
          const synOpen = todayIntraday?.open || lastCandle.close;
          const synHigh = todayIntraday
            ? Math.max(todayIntraday.high, currentPrice)
            : Math.max(currentPrice, lastCandle.close);
          const synLow = todayIntraday
            ? Math.min(todayIntraday.low, currentPrice)
            : Math.min(currentPrice, lastCandle.close);
          result = [...result, {
            date: todayStr,
            open: synOpen,
            high: synHigh,
            low: synLow,
            close: currentPrice,
            volume: todayIntraday?.volume || 0,
          }];
        } else if (lastDate.getTime() === today.getTime()) {
          // Today's candle exists but may have stale H/L/C — patch with intraday + live price
          const patched = { ...lastCandle };
          patched.close = currentPrice;
          if (todayIntraday) {
            patched.open = todayIntraday.open || patched.open;
            patched.high = Math.max(Number(patched.high), todayIntraday.high, currentPrice);
            patched.low = Math.min(Number(patched.low), todayIntraday.low, currentPrice);
            if (todayIntraday.volume > 0) patched.volume = todayIntraday.volume;
          } else {
            patched.high = Math.max(Number(patched.high), currentPrice);
            patched.low = Math.min(Number(patched.low), currentPrice);
          }
          result = [...result.slice(0, -1), patched];
        }
      }
    }

    return result;
  }, [rawData, timeframe, currentPrice, isCrypto, todayIntraday]);

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
    const retryOpts = isBomb ? { days: bombDays } : {};
    if (isCrypto) retryOpts.type = 'crypto';
    fetchHistoricalOHLCV(symbol, apiTimeframe, Object.keys(retryOpts).length > 0 ? retryOpts : undefined)
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
  }, [symbol, apiTimeframe, isBomb, isCrypto]);

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
