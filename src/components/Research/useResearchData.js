import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { fetchHistoricalOHLCV, getStockPrice } from '../../services/eodhdAPI';
import { calculateRollingSMA, calculateRSI, calculateMACD, calculateSMA } from '../../services/technicalIndicators';
import { detectLevels } from '../../services/levelDetection';
import { aggregateToMonthly } from './chartUtils';
import { getDailyHL } from '../../services/websocketService';
import { getMarketState } from '../../utils/marketSchedule';

/**
 * Find yesterday's closing price from daily OHLCV data (newest-first).
 * EODHD's daily endpoint only includes completed trading days:
 *   - During market hours: data[0] = yesterday (today not yet included)
 *   - After market close: data[0] = today (just completed)
 * This function skips today's candle (if present) to always return the
 * previous trading day's close — the correct daily baseline.
 */
function getPreviousClose(dailyData, todayKey = null) {
  if (!dailyData || dailyData.length === 0) return null;
  const todayET = todayKey || new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const prevCandle = dailyData.find(d => {
    const candleDate = (d.date || d.datetime || '').substring(0, 10);
    return candleDate && candleDate !== todayET;
  });
  return prevCandle ? Number(prevCandle.close) : Number(dailyData[0].close);
}

// ── Controlled held-quote mode (Shadow vs CPU quote integrity) ──────────────
// Contract SHADOW_CPU_PLACEHOLDER_PRICE_SPEC_V1_6.md §7.2 items 3–4, A-3,
// V-6, V-11, B-7, B-8, B-9, B-10; build record
// docs/audits/20261002_SHADOW_CPU_QUOTE_INTEGRITY_BUILD_REVIEW.md.
// Opt-in through `options.controlled` (only the battle screen's controlled
// research view passes it); absent, every line below is unreachable and the
// hook is exactly the shipped one.

const ET_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' });
const isPos = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;
/** V-11 session date: ET for stocks, UTC for crypto. */
const sessionDateOf = (ms, crypto) => (crypto ? new Date(ms).toISOString().slice(0, 10) : ET_DATE.format(new Date(ms)));
/** A candle's session: a daily/weekly date string IS its session date; an
 *  intraday bar's is its instant's ET (stock) or UTC (crypto) date. */
function candleSessionDate(c, crypto) {
  const raw = c.date || c.datetime || '';
  if (typeof raw === 'string' && raw.length >= 10 && !raw.includes('T') && !raw.includes(':')) return raw.substring(0, 10);
  const ms = c.timestamp ? c.timestamp * 1000 : new Date(raw).getTime();
  return Number.isFinite(ms) ? sessionDateOf(ms, crypto) : '';
}
/** The Monday (YYYY-MM-DD) of the week holding a session date. */
function weekStartOf(dateKey) {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
/**
 * A synthetic live bar in controlled mode. With an OBSERVED current-session
 * open it keeps a real body; without one it is the no-body SCAFFOLD (B-10):
 * open = close = the qualified current — rendering scaffolding only, flagged
 * so the chart never shows, aggregates or sends that open. High and low are
 * the supplied session-qualified extremes when present, otherwise the current
 * (never a synthesized open folded in, never the dormant WebSocket high/low).
 */
function controlledLiveBar(base, current, extremes, observedOpen) {
  const hi = isPos(extremes?.high) ? extremes.high : current;
  const lo = isPos(extremes?.low) ? extremes.low : current;
  if (isPos(observedOpen)) {
    return { ...base, open: observedOpen, high: Math.max(hi, current, observedOpen), low: Math.min(lo, current, observedOpen), close: current, volume: 0 };
  }
  return { ...base, open: current, high: Math.max(hi, current), low: Math.min(lo, current), close: current, volume: 0, _scaffold: true };
}
/**
 * The supplied extremes if — and only if — they belong to the hook's own
 * current session (re-checked at use; the screen qualified them at its
 * render, and a view can stay open across a session boundary). Only finite
 * positive fields survive; crypto never carries an observed open (V-11).
 */
function todaysSupplied(supplied, todayKey, crypto) {
  if (!supplied || supplied.sessionDate !== todayKey) return null;
  const out = {};
  if (isPos(supplied.high)) out.high = supplied.high;
  if (isPos(supplied.low)) out.low = supplied.low;
  if (!crypto && isPos(supplied.open)) out.open = supplied.open;
  return Object.keys(out).length > 0 ? out : null;
}
/** A real candle of the CURRENT period, extended by the current and — when
 *  the candle is in their session — the supplied extremes. Its open is kept. */
function patchLive(candle, current, extremes) {
  return {
    ...candle,
    high: Math.max(Number(candle.high), current, extremes?.high ?? 0),
    low: Math.min(Number(candle.low), current, extremes?.low ?? Infinity),
    close: current,
  };
}
/**
 * Controlled-mode live candles (V-6 a–c, B-7, B-10). Same periods and the
 * same market-hours guard as the legacy synthesis, but: no WebSocket daily
 * high/low, no polled extremes (the supplied, session-checked ones instead),
 * never a synthesized open — a bar without an observed current-session open
 * is the no-body scaffold — and no prior-session bar redrawn with today's
 * extremes.
 */
function controlledCandles(processed, { timeframe, current, crypto, supplied, nowMs }) {
  const today = sessionDateOf(nowMs, crypto);
  const sup = todaysSupplied(supplied, today, crypto);
  let result = processed;
  const last = result[result.length - 1];
  const lastDateStr = last.date || last.datetime || '';
  const lastIsToday = candleSessionDate(last, crypto) === today;

  if (timeframe === 'bomb' || timeframe === 'spectate') {
    const etNow = new Date(nowMs).toLocaleString('en-US', {
      timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', hour12: false,
    });
    const [nH, nM] = etNow.split(':').map(Number);
    const inMarketHours = crypto || (nH * 60 + nM >= 570 && nH * 60 + nM < 960);
    if (!inMarketHours) return result;
    const lastTime = last.timestamp ? last.timestamp * 1000 : new Date(lastDateStr).getTime();
    if (lastTime && (nowMs - lastTime) > 30 * 60 * 1000) {
      // B-7: the last real bar takes the supplied extremes only when it
      // belongs to their session; yesterday's 15:30 bar keeps its own.
      if (sup && lastIsToday) {
        const lastReal = { ...last };
        let patchedReal = false;
        if (sup.high && sup.high > Number(lastReal.high)) { lastReal.high = sup.high; patchedReal = true; }
        if (sup.low && sup.low < Number(lastReal.low)) { lastReal.low = sup.low; patchedReal = true; }
        if (patchedReal) result = [...result.slice(0, -1), lastReal];
      }
      const nowHalf = new Date(nowMs);
      nowHalf.setMinutes(nowHalf.getMinutes() >= 30 ? 30 : 0, 0, 0);
      // A half-hour bar never has an observed open (the day's open is not
      // the bar's): always the scaffold.
      result = [...result, controlledLiveBar({
        date: nowHalf.toISOString(),
        datetime: nowHalf.toISOString(),
        timestamp: Math.floor(nowHalf.getTime() / 1000),
      }, current, sup, null)];
    } else if (lastTime) {
      result = [...result.slice(0, -1), patchLive(last, current, lastIsToday ? sup : null)];
    }
  } else if (timeframe === '1W') {
    const weekStart = weekStartOf(today);
    if (lastDateStr.substring(0, 10) < weekStart) {
      // The current week's open is never observed here: scaffold.
      result = [...result, controlledLiveBar({ date: weekStart }, current, sup, null)];
    } else {
      result = [...result.slice(0, -1), patchLive(last, current, sup)];
    }
  } else if (timeframe === '1D') {
    const lastKey = lastDateStr.substring(0, 10);
    const dow = new Date(`${today}T00:00:00Z`).getUTCDay();
    const shouldAppend = crypto || (dow !== 0 && dow !== 6);
    if (lastKey < today && shouldAppend) {
      // A supplied observed open (stocks) keeps a real body; otherwise the scaffold.
      result = [...result, controlledLiveBar({ date: today }, current, sup, sup?.open ?? null)];
    } else if (lastKey === today) {
      result = [...result.slice(0, -1), patchLive(last, current, sup)];
    }
  }
  return result;
}

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
export default function useResearchData(symbol, { currentPrice, isCrypto, initialTimeframe, controlled = null } = {}) {
  // Controlled held-quote mode: the parent's session-qualified extremes stand in
  // for the polled ones EVERYWHERE they are read (V-6 a), and nothing here
  // fetches a quote. `controlled.extremes` = { sessionDate, high?, low?, open? }
  // from the same accepted REST observation, or null.
  const controlledMode = !!controlled;
  const supplied = controlledMode ? (controlled.extremes || null) : null;
  const suppliedSession = supplied?.sessionDate ?? null;
  const suppliedHigh = supplied?.high;
  const suppliedLow = supplied?.low;
  const suppliedOpen = supplied?.open;
  // The previous close skips the CURRENT session's candle: ET for every symbol
  // in legacy; ET for stocks and UTC for crypto in controlled mode (V-11).
  const prevCloseKey = () => (controlledMode ? sessionDateOf(Date.now(), !!isCrypto) : null);
  const [rawData, setRawData] = useState(null);    // Raw API response (newest-first)
  const [timeframe, setTimeframe] = useState(initialTimeframe || '1D');  // UI timeframe: '1D' | '1W' | '1M' | 'bomb' | 'spectate'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dailyChange, setDailyChange] = useState(null); // Daily % change computed from OHLCV
  const [previousClose, setPreviousClose] = useState(null); // Yesterday's close from daily OHLCV
  const [realtimeExtremes, setRealtimeExtremes] = useState(null); // Live intraday high/low from real-time API

  const abortRef = useRef(null);
  const cacheRef = useRef({});  // In-memory cache keyed by `${symbol}_${apiTimeframe}`
  const lastFetchKeyRef = useRef(null); // Guard: skip duplicate fetches for the same symbol/timeframe
  const liveCandleThrottleRef = useRef({ price: 0, ts: 0 }); // Throttle live candle synthesis

  // Map UI timeframe to API timeframe
  const isBomb = timeframe === 'bomb';
  const isSpectate = timeframe === 'spectate';
  const apiTimeframe = isSpectate ? '1m' : isBomb ? '30m' : (timeframe === '1D' ? '1d' : '1w');
  const bombDays = 20; // 20 trading days of 30-min data (~260 candles)
  const spectateRefreshRef = useRef(null);
  const spectateSettledRef = useRef(false);

  // Fetch data when symbol or API timeframe changes
  useEffect(() => {
    if (!symbol) return;

    const cacheKey = isBomb ? `${symbol}_30m_bomb` : `${symbol}_${apiTimeframe}`;

    // Clear stale data when switching to a different symbol (prevents showing previous stock's price/chart)
    if (lastFetchKeyRef.current && !lastFetchKeyRef.current.startsWith(`${symbol}_`)) {
      setRawData(null);
      setDailyChange(null);
      setPreviousClose(null);
      setRealtimeExtremes(null);
      lastFetchKeyRef.current = null;
    }

    // Guard: skip if we already fetched this exact key (prevents edge-case duplicate fetches)
    if (lastFetchKeyRef.current === cacheKey && rawData) return;
    lastFetchKeyRef.current = cacheKey;

    // Filter intraday candles to regular market hours (9:30 AM - 4:00 PM ET).
    // Extended-hours data is sparse and volatile — omit it from the bomb chart.
    // Crypto trades 24/7 so this filter is skipped for crypto assets.
    const filterToRegularHours = (candles) => {
      if (isCrypto || !candles) return candles;
      return candles.filter(c => {
        const ts = c.timestamp || Math.floor(new Date(c.date || c.datetime || 0).getTime() / 1000);
        const d = new Date(ts * 1000);
        const etStr = d.toLocaleString('en-US', {
          timeZone: 'America/New_York',
          hour: 'numeric', minute: 'numeric', hour12: false,
        });
        const [h, m] = etStr.split(':').map(Number);
        const mins = h * 60 + m;
        return mins >= 570 && mins < 960; // 9:30 AM to 4:00 PM ET
      });
    };

    // Check in-memory cache (skip cache for spectate — always fetch fresh)
    // Bomb/intraday data expires after 5 minutes to avoid showing stale candles
    const INTRADAY_STALE_MS = 5 * 60 * 1000;
    const refEntry = cacheRef.current[cacheKey];
    const isRefStale = isBomb && refEntry?.cachedAt && (Date.now() - refEntry.cachedAt > INTRADAY_STALE_MS);
    if (!isSpectate && refEntry && !isRefStale) {
      setRawData(refEntry.data || refEntry);
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
    if (isSpectate) spectateSettledRef.current = false;

    const cryptoOpt = isCrypto ? { type: 'crypto' } : {};
    const fetchOpts = isSpectate ? { days: 1, ...cryptoOpt } : isBomb ? { days: bombDays, ...cryptoOpt } : isCrypto ? cryptoOpt : undefined;
    fetchHistoricalOHLCV(symbol, apiTimeframe, fetchOpts)
      .then(data => {
        if (thisRequest.aborted) return;
        if (!data || data.length === 0) {
          if (isSpectate) {
            // Spectate fallback: use cached 30m bomb data if available
            const bombCacheKey = `${symbol}_30m_bomb`;
            const cachedBombEntry = cacheRef.current[bombCacheKey];
            const cachedBomb = cachedBombEntry?.data || cachedBombEntry;
            if (cachedBomb && cachedBomb.length > 0) {
              console.log('[useResearchData] Spectate 1m empty, falling back to cached 30m bomb data');
              setRawData(cachedBomb);
              setError(null);
            } else {
              setError('1-minute data not available — try during market hours (9:30 AM – 4:00 PM ET)');
              setRawData(null);
            }
            spectateSettledRef.current = true;
          } else {
            setError('No historical data available');
            setRawData(null);
          }
        } else {
          const filtered = isBomb ? filterToRegularHours(data) : data;
          if (!isSpectate) cacheRef.current[cacheKey] = isBomb ? { data: filtered, cachedAt: Date.now() } : filtered;
          setRawData(filtered);
          if (isSpectate) spectateSettledRef.current = true;

          // Compute daily change from daily data (rawData is newest-first)
          if (apiTimeframe === '1d' && data.length >= 1) {
            cacheRef.current[`${symbol}_1d`] = data;
            const prevClose = getPreviousClose(data, prevCloseKey());
            if (prevClose) {
              setPreviousClose(prevClose);
              const currClose = currentPrice > 0 ? currentPrice : 0;
              if (prevClose > 0 && currClose > 0) {
                setDailyChange(((currClose - prevClose) / prevClose) * 100);
              }
            }
          }
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

  // Always compute dailyChange on mount, regardless of chart timeframe.
  // The main fetch only sets dailyChange when apiTimeframe === '1d' (i.e. the 1D tab).
  // For bomb/spectate/weekly views, this separate fetch ensures dailyChange is available
  // so the modal header always shows today's daily % change.
  useEffect(() => {
    if (!symbol) return;
    if (apiTimeframe === '1d') return; // Main fetch handles this case

    const dailyCacheKey = `${symbol}_1d_dailychange`;
    const cached = cacheRef.current[`${symbol}_1d`] || cacheRef.current[dailyCacheKey];
    if (cached && cached.length >= 1) {
      const pc = getPreviousClose(cached, prevCloseKey());
      if (pc) {
        setPreviousClose(pc);
        const curr = currentPrice > 0 ? currentPrice : 0;
        if (pc > 0 && curr > 0) setDailyChange(((curr - pc) / pc) * 100);
      }
      return;
    }

    fetchHistoricalOHLCV(symbol, '1d', { days: 5, ...(isCrypto ? { type: 'crypto' } : {}) })
      .then(data => {
        if (data && data.length >= 1) {
          cacheRef.current[dailyCacheKey] = data;
          const pc = getPreviousClose(data, prevCloseKey());
          if (pc) {
            setPreviousClose(pc);
            const curr = currentPrice > 0 ? currentPrice : 0;
            if (pc > 0 && curr > 0) setDailyChange(((curr - pc) / pc) * 100);
          }
        }
      })
      .catch(() => {}); // Silent — dailyChange stays null, enrichedAsset falls through
  }, [symbol, isCrypto]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh spectate mode every 15 seconds
  // Guards:
  //   - Stop polling after 3 consecutive empty/stale responses
  //   - Skip polling entirely when market is closed (stocks only; crypto trades 24/7)
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

    // Don't poll when market is closed — stale data causes infinite re-render loops.
    // Note: if market opens while component is mounted, user must re-enter spectate mode.
    if (!isCrypto) {
      const { isOpen } = getMarketState();
      if (!isOpen) {
        console.log('[useResearchData] Spectate: market closed, skipping auto-refresh');
        return;
      }
    }

    emptyCountRef.current = 0; // Reset on fresh spectate entry

    // Helper: get today's ET date string for freshness check
    const getTodayET = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

    spectateRefreshRef.current = setInterval(() => {
      if (emptyCountRef.current >= 3) {
        console.log('[useResearchData] Spectate: stopped polling after 3 empty/stale responses');
        clearInterval(spectateRefreshRef.current);
        spectateRefreshRef.current = null;
        return;
      }
      fetchHistoricalOHLCV(symbol, '1m', { days: 1, ...(isCrypto ? { type: 'crypto' } : {}) })
        .then(data => {
          if (data && data.length > 0) {
            // Check if data is actually fresh (from today) before accepting it.
            // Stale previous-day data resets emptyCountRef → polling never stops.
            const lastCandle = data[0]; // newest-first from API
            const lastTs = lastCandle?.timestamp || Math.floor(new Date(lastCandle?.date || lastCandle?.datetime || 0).getTime() / 1000);
            const candleDateET = new Date(lastTs * 1000).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
            const todayET = getTodayET();

            if (isCrypto || candleDateET === todayET) {
              emptyCountRef.current = 0;
              setRawData(data);
            } else {
              // Data is from a previous trading day — treat as stale
              emptyCountRef.current++;
            }
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
  }, [isSpectate, symbol, isCrypto]);

  // Update daily change when live price changes (uses cached daily data)
  useEffect(() => {
    if (!currentPrice || currentPrice <= 0) return;
    const dailyData = cacheRef.current[`${symbol}_1d`] || cacheRef.current[`${symbol}_1d_dailychange`];
    if (!dailyData || dailyData.length < 1) return;
    const prevClose = getPreviousClose(dailyData, prevCloseKey());
    if (prevClose > 0) {
      setPreviousClose(prevClose);
      setDailyChange(((currentPrice - prevClose) / prevClose) * 100);
    }
  }, [currentPrice, symbol]);

  // Process raw data into candles for the current timeframe (no live price synthesis).
  // Separated from live-candle memo so spectate hourly-fallback detection doesn't
  // re-run on every WebSocket price tick — that was causing the infinite loop.
  const processedCandles = useMemo(() => {
    if (!rawData) return null;

    // Data from API is newest-first, reverse to oldest-first for processing
    const reversed = [...rawData].reverse();

    if (timeframe === 'spectate') {
      // Detect if data is 1-minute (real) or 1-hour (fallback from bomb cache)
      // 1m data has >20 candles in a single day; 1h has ~7
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
          'candles found:', todayCandles.length);

        return todayCandles;
      } else {
        // Real 1m data: last ~60 candles
        return reversed.slice(-60);
      }
    } else if (timeframe === 'bomb') {
      // Bomb view: all hourly candles (~140 for 20 trading days)
      return reversed;
    } else if (timeframe === '1W') {
      // Weekly data, slice to ~52 most recent weeks (1 year)
      return reversed.slice(-52);
    } else if (timeframe === '1M') {
      // Aggregate weekly data into monthly
      return aggregateToMonthly(reversed);
    } else {
      // 1D: daily data as-is
      return reversed;
    }
  }, [rawData, timeframe]);

  // Throttle currentPrice updates so ohlcvData doesn't create a new array on every
  // WebSocket tick (~1s). Only update when price moves >0.05% or >3 seconds elapsed.
  // This reduces chart re-renders from ~60/min to ~20/min while keeping the live candle responsive.
  const throttledPrice = useMemo(() => {
    if (!currentPrice || currentPrice <= 0) return 0;
    // Controlled: the parent's qualified current is already a discrete
    // observation, and the live bar must carry exactly that value.
    if (controlledMode) return currentPrice;
    const now = Date.now();
    const prev = liveCandleThrottleRef.current;
    const priceDelta = prev.price > 0 ? Math.abs(currentPrice - prev.price) / prev.price : 1;
    const timeDelta = now - prev.ts;
    if (priceDelta > 0.0005 || timeDelta > 3000 || prev.price === 0) {
      liveCandleThrottleRef.current = { price: currentPrice, ts: now };
      return currentPrice;
    }
    return prev.price;
  }, [currentPrice, controlledMode]);

  // Append synthetic "live" candle if the last candle is stale and we have a live price.
  // This bridges the gap between EODHD historical data (which only includes completed
  // periods) and the live price shown in the header.
  const ohlcvData = useMemo(() => {
    if (!processedCandles || processedCandles.length === 0) return processedCandles;
    if (!throttledPrice || throttledPrice <= 0) return processedCandles;
    if (controlledMode) {
      return controlledCandles(processedCandles, {
        timeframe,
        current: throttledPrice,
        crypto: !!isCrypto,
        supplied: { sessionDate: suppliedSession, high: suppliedHigh, low: suppliedLow, open: suppliedOpen },
        nowMs: Date.now(),
      });
    }

    let result = processedCandles;
    const wsHL = getDailyHL(symbol);
    const rtHigh = realtimeExtremes?.high > 0 ? realtimeExtremes.high : 0;
    const rtLow = realtimeExtremes?.low > 0 ? realtimeExtremes.low : Infinity;
    const lastCandle = result[result.length - 1];
    const lastDateStr = lastCandle.date || lastCandle.datetime || '';

    if (timeframe === 'bomb' || timeframe === 'spectate') {
      // Guard: skip live-candle synthesis outside regular market hours (crypto trades 24/7)
      const etNow = new Date().toLocaleString('en-US', {
        timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', hour12: false,
      });
      const [nH, nM] = etNow.split(':').map(Number);
      const inMarketHours = isCrypto || (nH * 60 + nM >= 570 && nH * 60 + nM < 960);

      if (inMarketHours) {
        // 30-min (bomb or spectate fallback): append if last candle is >30 min old
        const lastTime = lastCandle.timestamp
          ? lastCandle.timestamp * 1000
          : new Date(lastDateStr).getTime();
        const halfHourMs = 30 * 60 * 1000;
        if (lastTime && (Date.now() - lastTime) > halfHourMs) {
          // Patch the last real candle with real-time extremes — the spike may have
          // occurred during that candle's interval but wasn't captured by EODHD.
          if (rtHigh > 0 || rtLow < Infinity) {
            const lastReal = { ...result[result.length - 1] };
            let patchedReal = false;
            if (rtHigh > 0 && rtHigh > Number(lastReal.high)) { lastReal.high = rtHigh; patchedReal = true; }
            if (rtLow < Infinity && rtLow < Number(lastReal.low)) { lastReal.low = rtLow; patchedReal = true; }
            if (patchedReal) result = [...result.slice(0, -1), lastReal];
          }
          const nowHalf = new Date();
          nowHalf.setMinutes(nowHalf.getMinutes() >= 30 ? 30 : 0, 0, 0);
          const synthOpen = realtimeExtremes?.open > 0 ? realtimeExtremes.open : lastCandle.close;
          result = [...result, {
            date: nowHalf.toISOString(),
            datetime: nowHalf.toISOString(),
            timestamp: Math.floor(nowHalf.getTime() / 1000),
            open: synthOpen,
            high: Math.max(wsHL?.high || 0, throttledPrice, synthOpen, rtHigh),
            low: Math.min(wsHL?.low ?? Infinity, throttledPrice, synthOpen, rtLow),
            close: throttledPrice,
            volume: 0,
          }];
        } else if (lastTime) {
          // Latest candle is within the current 30-min period — patch H/L/C with live price
          const patched = { ...lastCandle };
          patched.high = Math.max(Number(patched.high), wsHL?.high || 0, throttledPrice, rtHigh);
          patched.low = Math.min(Number(patched.low), wsHL?.low ?? Infinity, throttledPrice, rtLow);
          patched.close = throttledPrice;
          result = [...result.slice(0, -1), patched];
        }
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
        result = [...result, {
          date: mondayStr,
          open: lastCandle.close,
          high: Math.max(wsHL?.high || 0, throttledPrice, lastCandle.close, rtHigh),
          low: Math.min(wsHL?.low ?? Infinity, throttledPrice, lastCandle.close, rtLow),
          close: throttledPrice,
          volume: 0,
        }];
      } else {
        // Current week's candle exists — patch H/L/C with live price
        const patched = { ...lastCandle };
        patched.high = Math.max(Number(patched.high), wsHL?.high || 0, throttledPrice, rtHigh);
        patched.low = Math.min(Number(patched.low), wsHL?.low ?? Infinity, throttledPrice, rtLow);
        patched.close = throttledPrice;
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
        const dailySynthOpen = realtimeExtremes?.open > 0 ? realtimeExtremes.open : lastCandle.close;
        result = [...result, {
          date: todayStr,
          open: dailySynthOpen,
          high: Math.max(wsHL?.high || 0, throttledPrice, dailySynthOpen, rtHigh),
          low: Math.min(wsHL?.low ?? Infinity, throttledPrice, dailySynthOpen, rtLow),
          close: throttledPrice,
          volume: 0,
        }];
      } else if (lastDate.getTime() === today.getTime()) {
        // Today's candle exists but may have stale H/L/C — patch with live price
        const patched = { ...lastCandle };
        patched.high = Math.max(Number(patched.high), wsHL?.high || 0, throttledPrice, rtHigh);
        patched.low = Math.min(Number(patched.low), wsHL?.low ?? Infinity, throttledPrice, rtLow);
        patched.close = throttledPrice;
        result = [...result.slice(0, -1), patched];
      }
    }

    return result;
  }, [processedCandles, throttledPrice, timeframe, isCrypto, realtimeExtremes, controlledMode, suppliedSession, suppliedHigh, suppliedLow, suppliedOpen]);

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
    const cacheKey = isBomb ? `${symbol}_30m_bomb` : `${symbol}_${apiTimeframe}`;
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
          cacheRef.current[cacheKey] = isBomb ? { data, cachedAt: Date.now() } : data;
          setRawData(data);
        }
      })
      .catch(err => setError(err.message || 'Failed to fetch data'))
      .finally(() => setLoading(false));
  }, [symbol, apiTimeframe, isBomb, isCrypto]);

  // Fetch real-time intraday high/low from EODHD real-time API.
  // The daily OHLCV endpoint only finalizes after market close — during market hours
  // it returns stale/null data. The real-time API has live intraday extremes.
  useEffect(() => {
    if (!symbol) return;
    // Controlled held mode: no quote request and no interval, ever (§7.2 item
    // 4); the parent supplies the extremes.
    if (controlledMode) return;
    let currentSymbol = symbol;

    const fetchRealtimeExtremes = async () => {
      try {
        const data = await getStockPrice(currentSymbol);
        // Guard: if symbol changed while fetch was in-flight, discard result
        if (currentSymbol !== symbol) return;
        if (data && (data.high > 0 || data.low > 0)) {
          setRealtimeExtremes({ high: data.high || 0, low: data.low || 0, open: data.open || 0 });
        }
      } catch (err) {
        console.warn('[useResearchData] Failed to fetch realtime extremes:', err.message);
      }
    };

    // Clear stale data immediately on symbol change so chart doesn't flash old symbol's H/L
    setRealtimeExtremes(null);
    fetchRealtimeExtremes();
    const interval = setInterval(fetchRealtimeExtremes, 60000);
    return () => { currentSymbol = null; clearInterval(interval); };
  }, [symbol, controlledMode]);

  // Today's authoritative high/low for chart header.
  // Priority 1: Real-time API (live during market hours)
  // Priority 2: Daily OHLCV cache (works after market close)
  const todayDailyCandle = useMemo(() => {
    if (controlledMode) {
      // A-3 / V-6 (b) / B-8: Priority 1 is the supplied, session-checked
      // extremes; Priority 2 the daily candle of the CURRENT session date (ET
      // for stocks, UTC for crypto), which is observed research data. Only
      // present fields: no `close`, no zero, never a missing open filled in —
      // and no open at all for crypto (V-11).
      const today = sessionDateOf(Date.now(), !!isCrypto);
      const sup = todaysSupplied({ sessionDate: suppliedSession, high: suppliedHigh, low: suppliedLow, open: suppliedOpen }, today, !!isCrypto);
      if (sup) return { ...sup, _source: 'controlled' };
      const daily = cacheRef.current[`${symbol}_1d`] || cacheRef.current[`${symbol}_1d_dailychange`];
      const found = daily?.find(d => (d.date || d.datetime || '').substring(0, 10) === today);
      if (!found) return null;
      const out = {};
      if (isPos(Number(found.high))) out.high = Number(found.high);
      if (isPos(Number(found.low))) out.low = Number(found.low);
      if (!isCrypto && isPos(Number(found.open))) out.open = Number(found.open);
      return Object.keys(out).length > 0 ? { ...out, _source: 'daily' } : null;
    }
    if (realtimeExtremes && (realtimeExtremes.high > 0 || realtimeExtremes.low > 0)) {
      return { high: realtimeExtremes.high, low: realtimeExtremes.low, open: realtimeExtremes.open || 0, close: 0, _source: 'realtime' };
    }
    const dailyData = cacheRef.current[`${symbol}_1d`] || cacheRef.current[`${symbol}_1d_dailychange`];
    if (!dailyData || dailyData.length === 0) return null;
    const todayET = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const todayCandle = dailyData.find(d => {
      const candleDate = (d.date || d.datetime || '').substring(0, 10);
      return candleDate === todayET;
    });
    return todayCandle || null;
  }, [symbol, rawData, previousClose, realtimeExtremes, controlledMode, isCrypto, suppliedSession, suppliedHigh, suppliedLow, suppliedOpen]);

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
    dailyChange,     // Daily % change computed from OHLCV (null until data loads)
    previousClose,   // Yesterday's closing price from daily OHLCV (null until data loads)
    todayDailyCandle, // Today's daily candle with authoritative high/low (null until data loads)
    // Live intraday high/low from real-time API (null until fetched); in
    // controlled mode, the supplied extremes when they are the current session's.
    realtimeExtremes: controlledMode
      ? todaysSupplied(supplied, sessionDateOf(Date.now(), !!isCrypto), !!isCrypto)
      : realtimeExtremes,
  };
}
