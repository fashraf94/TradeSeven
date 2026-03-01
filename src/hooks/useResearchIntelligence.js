// src/hooks/useResearchIntelligence.js
// Extracted from ResearchLandingPage — all intelligence state, handlers, and effects

import { useState, useCallback, useMemo, useEffect } from 'react';
import { SECTORS } from '../constants/sectors';

const DEFAULT_WATCHLIST = ['AAPL', 'NVDA', 'TSLA', 'GOOGL', 'MSFT', 'AMZN'];
const INTEL_CACHE_KEY = 'research_intel_cache_v2';
const INTEL_CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

const safeNumber = (val, fallback = 0) => {
  if (val === null || val === undefined) return fallback;
  const num = typeof val === 'number' ? val : parseFloat(val);
  return isNaN(num) ? fallback : num;
};

export function useResearchIntelligence({ stocksData, allAssets, marketBreadth, moversData, marketNews }) {
  // ─── Intelligence Core ──────────────────────────────────
  const [intelData, setIntelData] = useState(null);
  const [intelLoading, setIntelLoading] = useState(false);
  const [intelCacheTime, setIntelCacheTime] = useState(null);
  const [threadCache, setThreadCache] = useState({});
  const [trackerCache, setTrackerCache] = useState({});

  // ─── Weekly Report ──────────────────────────────────────
  const [weeklyReportData, setWeeklyReportData] = useState(null);
  const [weeklyReportLoading, setWeeklyReportLoading] = useState(false);
  const [showWeeklyReport, setShowWeeklyReport] = useState(false);

  // ─── Tracker ────────────────────────────────────────────
  const [expandedTracker, setExpandedTracker] = useState(null);
  const [trackerLoading, setTrackerLoading] = useState(null);

  // ─── Why Moving ─────────────────────────────────────────
  const [whyMovingTarget, setWhyMovingTarget] = useState(null);

  // ─── Market Pulse ───────────────────────────────────────
  const [marketPulse, setMarketPulse] = useState(null);
  const [marketPulseLoading, setMarketPulseLoading] = useState(true);
  const [marketPulseError, setMarketPulseError] = useState(false);

  // ─── Upcoming Events (Sonar) ────────────────────────────
  const [upcomingEconomic, setUpcomingEconomic] = useState(null);
  const [upcomingEarnings, setUpcomingEarnings] = useState(null);
  const [upcomingEconomicLoading, setUpcomingEconomicLoading] = useState(true);
  const [upcomingEarningsLoading, setUpcomingEarningsLoading] = useState(true);
  const [upcomingEconomicError, setUpcomingEconomicError] = useState(false);
  const [upcomingEarningsError, setUpcomingEarningsError] = useState(false);

  // ─── Read-Across Alerts ─────────────────────────────────
  const [readAcrossAlerts, setReadAcrossAlerts] = useState([]);
  const [dismissedAlertIds, setDismissedAlertIds] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem('mc_dismissed_alerts') || '[]'));
    } catch { return new Set(); }
  });

  const visibleAlerts = readAcrossAlerts.filter(a => !dismissedAlertIds.has(a.id));

  // ─── Watchlist ──────────────────────────────────────────
  const [watchlistVersion, setWatchlistVersion] = useState(0);

  const watchlistStocks = useMemo(() => {
    let watchlist;
    try { watchlist = JSON.parse(localStorage.getItem('user_watchlist')); } catch (e) { /* ignore */ }
    if (!watchlist?.length) watchlist = DEFAULT_WATCHLIST;
    return watchlist.map(sym => {
      const asset = allAssets.find(a => a.symbol?.toUpperCase() === sym.toUpperCase());
      return {
        symbol: sym,
        price: asset?.price || 0,
        percentChange: safeNumber(asset?.percentChange, 0),
      };
    });
  }, [allAssets, watchlistVersion]);

  // ─── Market Pulse fetch ─────────────────────────────────
  const fetchMarketPulse = useCallback(async () => {
    setMarketPulseLoading(true);
    setMarketPulseError(false);
    try {
      const res = await fetch('/api/market-pulse');
      const data = await res.json();
      if (data.success) {
        setMarketPulse(data.data);
      } else {
        setMarketPulseError(true);
      }
    } catch {
      setMarketPulseError(true);
    } finally {
      setMarketPulseLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMarketPulse();
  }, [fetchMarketPulse]);

  // ─── Read-Across Alerts ─────────────────────────────────
  const handleDismissAlert = useCallback((alertId) => {
    setDismissedAlertIds(prev => {
      const next = new Set(prev);
      next.add(alertId);
      try { localStorage.setItem('mc_dismissed_alerts', JSON.stringify([...next])); } catch {}
      return next;
    });
  }, []);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const res = await fetch('/api/read-across-alerts');
        const data = await res.json();
        if (data.success) setReadAcrossAlerts(data.alerts || []);
      } catch (err) {
        console.warn('[ReadAcross] Fetch failed:', err);
      }
    };
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // ─── Upcoming Events fetch ──────────────────────────────
  const fetchUpcomingEconomic = useCallback(async () => {
    setUpcomingEconomicLoading(true);
    setUpcomingEconomicError(false);
    try {
      const res = await fetch('/api/economic-events-sonar');
      const data = await res.json();
      if (data.success) {
        setUpcomingEconomic(data.data);
      } else {
        setUpcomingEconomicError(true);
      }
    } catch {
      setUpcomingEconomicError(true);
    } finally {
      setUpcomingEconomicLoading(false);
    }
  }, []);

  const fetchUpcomingEarnings = useCallback(async () => {
    setUpcomingEarningsLoading(true);
    setUpcomingEarningsError(false);
    try {
      const res = await fetch('/api/earnings-calendar-sonar');
      const data = await res.json();
      if (data.success) {
        setUpcomingEarnings(data.data);
      } else {
        setUpcomingEarningsError(true);
      }
    } catch {
      setUpcomingEarningsError(true);
    } finally {
      setUpcomingEarningsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUpcomingEconomic();
    fetchUpcomingEarnings();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Intelligence Context Builders ──────────────────────
  const buildIntelContext = useCallback(() => {
    let watchlist;
    try {
      const saved = localStorage.getItem('user_watchlist');
      if (saved) watchlist = JSON.parse(saved);
    } catch (e) { /* ignore */ }
    if (!watchlist?.length) watchlist = DEFAULT_WATCHLIST;

    let battleStocks = [];
    try {
      const battles = JSON.parse(localStorage.getItem('portfolioDuelBattles') || '[]');
      const symbolSet = new Set();
      battles.forEach(battle => {
        const portfolio = battle?.player1?.portfolio;
        if (Array.isArray(portfolio)) {
          portfolio.forEach(item => {
            if (typeof item === 'string') symbolSet.add(item);
            else if (item?.symbol) symbolSet.add(item.symbol);
          });
        } else if (portfolio && typeof portfolio === 'object') {
          ['star', 'core', 'support'].forEach(tier => {
            (portfolio[tier] || []).forEach(item => {
              if (typeof item === 'string') symbolSet.add(item);
              else if (item?.symbol) symbolSet.add(item.symbol);
            });
          });
        }
      });
      battleStocks = [...symbolSet];
    } catch (e) { /* ignore */ }

    return {
      stocksUp: marketBreadth.stocksUp,
      stocksDown: marketBreadth.stocksDown,
      breadthRatio: marketBreadth.ratio,
      gainers: (moversData.gainers || []).slice(0, 5).map(s => ({
        symbol: s.symbol,
        name: s.name,
        change: safeNumber(s.percentChange, 0),
      })),
      losers: (moversData.losers || []).slice(0, 5).map(s => ({
        symbol: s.symbol,
        name: s.name,
        change: safeNumber(s.percentChange, 0),
      })),
      news: (marketNews || []).slice(0, 5).map(n => ({ title: n.title })),
      watchlist,
      battleStocks,
      economicEvents: (upcomingEconomic?.thisWeek || []).slice(0, 5).map(e => ({
        date: e.date,
        name: e.event,
        impact: e.impact || 'medium',
      })),
    };
  }, [marketBreadth, moversData, marketNews, upcomingEconomic]);

  const buildMarketContextString = useCallback(() => {
    if (!stocksData?.length && !allAssets?.length) {
      return 'Market data is currently loading. Provide general educational analysis only. Do not cite specific stock prices.';
    }

    const parts = [];
    const today = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    parts.push(`Market data as of ${today}:`);

    const { stocksUp, stocksDown, ratio } = marketBreadth;
    parts.push(`\nMARKET BREADTH: ${stocksUp} stocks advancing, ${stocksDown} declining (${((ratio) * 100).toFixed(0)}% positive)`);

    const stocks = stocksData?.length ? stocksData : allAssets;
    const sectorLookup = {};
    Object.values(SECTORS).forEach(sec => {
      (sec.topHoldings || []).forEach(sym => { sectorLookup[sym] = sec.name; });
    });

    const sectorMap = {};
    stocks.forEach(stock => {
      const symbol = stock.symbol || stock.ticker;
      if (!symbol) return;
      const change = safeNumber(stock.percentChange || stock.change24h, 0);
      const price = safeNumber(stock.price, 0);
      const sector = sectorLookup[symbol.toUpperCase()] || stock.sector || 'Other';
      if (!sectorMap[sector]) sectorMap[sector] = [];
      sectorMap[sector].push({ symbol, change, price });
    });

    parts.push('\nSTOCKS BY SECTOR (sorted by daily change):');
    Object.entries(sectorMap)
      .sort(([, a], [, b]) => {
        const avgA = a.reduce((sum, s) => sum + s.change, 0) / a.length;
        const avgB = b.reduce((sum, s) => sum + s.change, 0) / b.length;
        return avgB - avgA;
      })
      .forEach(([sector, sectorStocks]) => {
        const sorted = [...sectorStocks].sort((a, b) => b.change - a.change);
        const stockList = sorted
          .map(s => `${s.symbol} ${s.change >= 0 ? '+' : ''}${s.change.toFixed(1)}%${s.price ? ` ($${s.price.toFixed(2)})` : ''}`)
          .join(', ');
        const avgChange = (sorted.reduce((sum, s) => sum + s.change, 0) / sorted.length).toFixed(1);
        parts.push(`\n${sector.toUpperCase()} (avg ${avgChange >= 0 ? '+' : ''}${avgChange}%): ${stockList}`);
      });

    const gainers = (moversData.gainers || []).slice(0, 5);
    const losers = (moversData.losers || []).slice(0, 5);
    if (gainers.length > 0) {
      parts.push(`\nTOP GAINERS: ${gainers.map(g => `${g.symbol} ${safeNumber(g.percentChange, 0) >= 0 ? '+' : ''}${safeNumber(g.percentChange, 0).toFixed(1)}%`).join(', ')}`);
    }
    if (losers.length > 0) {
      parts.push(`\nTOP DECLINERS: ${losers.map(l => `${l.symbol} ${safeNumber(l.percentChange, 0) >= 0 ? '+' : ''}${safeNumber(l.percentChange, 0).toFixed(1)}%`).join(', ')}`);
    }

    if (intelData?.scout?.hotSector) {
      parts.push(`\nHOT SECTOR: ${intelData.scout.hotSector.name} — ${intelData.scout.hotSector.why || ''}`);
    }

    if (intelData?.scout?.discoveries?.length) {
      const disc = intelData.scout.discoveries.map(d => `${d.symbol} ${safeNumber(d.change, 0) > 0 ? '+' : ''}${safeNumber(d.change, 0)}% (${d.reason})`).join('; ');
      parts.push(`\nUNUSUAL MOVERS: ${disc}`);
    }

    const sonarEvents = [
      ...(upcomingEconomic?.thisWeek || []),
      ...(upcomingEconomic?.nextWeek || []),
    ];

    if (sonarEvents.length) {
      const todayStr = new Date().toISOString().split('T')[0];
      const upcoming = sonarEvents
        .filter(e => e.date >= todayStr)
        .sort((a, b) => {
          const impactOrder = { high: 0, medium: 1, low: 2 };
          return (impactOrder[a.impact] ?? 2) - (impactOrder[b.impact] ?? 2) || a.date.localeCompare(b.date);
        })
        .slice(0, 10);

      if (upcoming.length) {
        parts.push('\nUPCOMING ECONOMIC EVENTS:');
        upcoming.forEach(e => {
          const dateStr = new Date(e.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
          let detail = `${dateStr}: ${e.event}`;
          if (e.time) detail += ` (${e.time})`;
          if (e.estimate != null) detail += ` (Estimate: ${e.estimate})`;
          if (e.previous != null) detail += ` (Previous: ${e.previous})`;
          if (e.impact === 'high') detail += ' [HIGH IMPACT]';
          else if (e.impact === 'medium') detail += ' [MEDIUM]';
          if (e.brief) detail += ` — ${e.brief}`;
          parts.push(detail);
        });
      }

      const recent = sonarEvents
        .filter(e => e.date < todayStr && e.actual != null)
        .slice(0, 5);

      if (recent.length) {
        parts.push('\nRECENT ECONOMIC RELEASES:');
        recent.forEach(e => {
          const dateStr = new Date(e.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
          let detail = `${dateStr}: ${e.event} — Actual: ${e.actual}`;
          if (e.estimate != null) detail += `, Estimate was: ${e.estimate}`;
          if (e.previous != null) detail += `, Previous: ${e.previous}`;
          parts.push(detail);
        });
      }
    }

    return parts.join('\n');
  }, [stocksData, allAssets, marketBreadth, moversData, intelData, upcomingEconomic]);

  const buildFallbackIntel = useCallback(() => {
    const gainers = (moversData.gainers || []).slice(0, 3);
    const { sentiment, stocksUp, stocksDown } = marketBreadth;

    let watchlist;
    try {
      const saved = localStorage.getItem('user_watchlist');
      if (saved) watchlist = JSON.parse(saved);
    } catch (e) { /* ignore */ }
    if (!watchlist?.length) watchlist = DEFAULT_WATCHLIST;
    const watchSet = new Set(watchlist.map(s => s.toUpperCase()));

    const allMovers = [...(moversData.gainers || []), ...(moversData.losers || [])];
    const discoveries = allMovers
      .filter(m => !watchSet.has(m.symbol?.toUpperCase()))
      .slice(0, 3)
      .map(m => ({
        symbol: m.symbol,
        name: m.name || m.symbol,
        change: safeNumber(m.percentChange, 0),
        reason: `Moving ${safeNumber(m.percentChange, 0) > 0 ? 'up' : 'down'} ${Math.abs(safeNumber(m.percentChange, 0)).toFixed(1)}% today with notable volume activity.`,
        actionTag: safeNumber(m.percentChange, 0) > 3 ? 'momentum' : 'early_signal',
        sector: m.sector || 'Unknown',
      }));

    const breadthType = sentiment === 'bullish' ? 'positive' : sentiment === 'bearish' ? 'negative' : 'signal';

    return {
      briefer: {
        headline: sentiment === 'bullish'
          ? `Markets up: ${stocksUp} stocks advancing`
          : sentiment === 'bearish'
            ? `Markets pressured: ${stocksDown} stocks declining`
            : `Mixed session: ${stocksUp} up, ${stocksDown} down`,
        sentiment,
        questions: [
          {
            id: 'market_pulse',
            icon: '\uD83D\uDCCA',
            label: 'What\'s driving the market today?',
            answer: {
              insights: [
                { text: `Market breadth: ${stocksUp} stocks advancing vs ${stocksDown} declining.`, type: breadthType },
                ...(gainers.length > 0 ? [{ text: `${gainers[0]?.symbol} leading gainers at +${safeNumber(gainers[0]?.percentChange, 0).toFixed(1)}%.`, type: 'positive' }] : []),
              ],
            },
            followUps: ['Which sectors are strongest?', 'Any volume anomalies?'],
          },
          {
            id: 'sector_watch',
            icon: '\uD83C\uDFED',
            label: 'Which sectors are leading or lagging?',
            answer: {
              insights: [
                { text: 'Sector data requires live intelligence. Tap refresh for AI analysis.', type: 'signal' },
              ],
            },
            followUps: ['Which sector has most momentum?', 'Any sectors showing weakness?'],
          },
          {
            id: 'risk_radar',
            icon: '\uD83D\uDEE1\uFE0F',
            label: 'Any risks I should watch for?',
            answer: {
              insights: [
                { text: sentiment === 'bearish' ? `Broad weakness with ${stocksDown} stocks declining — monitor positions.` : 'No major risk signals detected in current session.', type: sentiment === 'bearish' ? 'negative' : 'signal' },
              ],
            },
            followUps: ['What are biggest macro risks?', 'How should I think about sizing?'],
          },
          {
            id: 'earnings_events',
            icon: '\uD83D\uDCC5',
            label: 'Key earnings & events this week?',
            answer: {
              insights: [
                { text: upcomingEconomic?.thisWeek?.length > 0 ? `${upcomingEconomic.thisWeek[0].event} scheduled for ${upcomingEconomic.thisWeek[0].date}${upcomingEconomic.thisWeek[0].impact === 'high' ? ' (High Impact)' : ''}.` : 'No major economic events this week.', type: 'signal' },
              ],
            },
            followUps: ['Which earnings could move markets?', 'Any surprises expected?'],
          },
          {
            id: 'trade_setup',
            icon: '\uD83C\uDFAF',
            label: 'Any interesting setups forming?',
            answer: {
              insights: [
                ...(gainers.length > 1 ? [{ text: `${gainers[1]?.symbol} showing strength at +${safeNumber(gainers[1]?.percentChange, 0).toFixed(1)}% — worth monitoring.`, type: 'positive' }] : []),
                { text: 'Full setup analysis requires live intelligence. Tap refresh for AI analysis.', type: 'signal' },
              ],
            },
            followUps: ['What timeframe for these setups?', 'Any contrarian plays?'],
          },
        ],
      },
      scout: {
        discoveries,
        hotSector: null,
      },
    };
  }, [moversData, marketBreadth, upcomingEconomic]);

  // ─── Intelligence Fetch ─────────────────────────────────
  const fetchIntelligence = useCallback(async (force = false) => {
    if (!force) {
      try {
        const cached = localStorage.getItem(INTEL_CACHE_KEY);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < INTEL_CACHE_DURATION) {
            setIntelData(data);
            setIntelCacheTime(timestamp);
            return;
          }
        }
      } catch (e) { /* ignore */ }
    }

    setIntelLoading(true);
    try {
      const context = buildIntelContext();
      const response = await fetch('/api/research-intel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context }),
      });

      const result = await response.json();
      if (result.success && result.data) {
        const now = Date.now();
        setIntelData(result.data);
        setIntelCacheTime(now);
        try {
          localStorage.setItem(INTEL_CACHE_KEY, JSON.stringify({ data: result.data, timestamp: now }));
        } catch (e) { /* ignore storage errors */ }
      } else {
        const fallback = buildFallbackIntel();
        setIntelData(fallback);
        setIntelCacheTime(Date.now());
      }
    } catch (err) {
      console.warn('[ResearchLanding] Intel fetch failed:', err);
      const fallback = buildFallbackIntel();
      setIntelData(fallback);
      setIntelCacheTime(Date.now());
    } finally {
      setIntelLoading(false);
    }
  }, [buildIntelContext, buildFallbackIntel]);

  // ─── Thread & Tracker ───────────────────────────────────
  const fetchThread = useCallback(async (symbol, discoveryContext, sectorContext) => {
    if (threadCache[symbol]) return;

    try {
      const response = await fetch('/api/research-thread', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, discoveryContext, sectorContext }),
      });
      const result = await response.json();
      if (result.success && result.data) {
        setThreadCache(prev => ({ ...prev, [symbol]: result.data }));
      }
    } catch (err) {
      console.warn('[ResearchLanding] Thread fetch failed:', err);
      setThreadCache(prev => ({ ...prev, [symbol]: {
        bullets: ['Unable to load analysis. Try again in a moment.'],
        verdict: null, risk: null
      } }));
    }
  }, [threadCache]);

  const fetchTracker = useCallback(async (symbol, price, percentChange) => {
    if (trackerCache[symbol]) return;
    try {
      const response = await fetch('/api/research-tracker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, price, percentChange }),
      });
      const result = await response.json();
      if (result.success && result.data) {
        setTrackerCache(prev => ({ ...prev, [symbol]: result.data }));
      }
    } catch (err) {
      console.warn('[ResearchLanding] Tracker fetch failed:', err);
      setTrackerCache(prev => ({ ...prev, [symbol]: {
        priceAction: 'Unable to load analysis. Try again later.',
        technicalLevel: null, news: null, baggerBomb: null
      } }));
    }
  }, [trackerCache]);

  const handleToggleTracker = useCallback(async (symbol) => {
    if (expandedTracker === symbol) {
      setExpandedTracker(null);
      return;
    }
    setExpandedTracker(symbol);
    if (!trackerCache[symbol]) {
      setTrackerLoading(symbol);
      const stock = watchlistStocks.find(s => s.symbol === symbol);
      await fetchTracker(symbol, stock?.price, stock?.percentChange);
      setTrackerLoading(null);
    }
  }, [expandedTracker, trackerCache, watchlistStocks, fetchTracker]);

  // ─── Watchlist Management ───────────────────────────────
  const handleAddToWatchlist = useCallback((symbol) => {
    try {
      let currentWatchlist;
      try { currentWatchlist = JSON.parse(localStorage.getItem('user_watchlist')); } catch (e) { /* ignore */ }
      if (!currentWatchlist?.length) currentWatchlist = [...DEFAULT_WATCHLIST];
      if (currentWatchlist.map(s => s.toUpperCase()).includes(symbol.toUpperCase())) return;
      const updated = [...currentWatchlist, symbol];
      localStorage.setItem('user_watchlist', JSON.stringify(updated));
      setWatchlistVersion(prev => prev + 1);
    } catch (e) {
      console.warn('[ResearchLanding] Failed to add to watchlist:', e);
    }
  }, []);

  const handleRemoveFromWatchlist = useCallback((symbol) => {
    try {
      let currentWatchlist;
      try { currentWatchlist = JSON.parse(localStorage.getItem('user_watchlist')); } catch (e) { /* ignore */ }
      if (!currentWatchlist?.length) currentWatchlist = [...DEFAULT_WATCHLIST];
      const updated = currentWatchlist.filter(s => s.toUpperCase() !== symbol.toUpperCase());
      localStorage.setItem('user_watchlist', JSON.stringify(updated));
      if (expandedTracker === symbol) setExpandedTracker(null);
      setWatchlistVersion(prev => prev + 1);
    } catch (e) {
      console.warn('[ResearchLanding] Failed to remove from watchlist:', e);
    }
  }, [expandedTracker]);

  // ─── Weekly Report ──────────────────────────────────────
  const fetchWeeklyReport = useCallback(async () => {
    try {
      const cached = localStorage.getItem('research_weekly_report_cache');
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
          setWeeklyReportData(data);
          return;
        }
      }
    } catch (e) { /* ignore */ }

    setWeeklyReportLoading(true);
    try {
      const response = await fetch('/api/research-weekly-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          watchlist: watchlistStocks.map(s => s.symbol),
          stockData: watchlistStocks,
        }),
      });
      const result = await response.json();
      if (result.success && result.data) {
        setWeeklyReportData(result.data);
        try {
          localStorage.setItem('research_weekly_report_cache', JSON.stringify({
            data: result.data,
            timestamp: Date.now(),
          }));
        } catch (e) { /* ignore storage errors */ }
      }
    } catch (err) {
      console.warn('[ResearchLanding] Weekly report fetch failed:', err);
      setWeeklyReportData({ summary: 'Weekly report unavailable. Try again later.', stocks: [], outlook: null });
    } finally {
      setWeeklyReportLoading(false);
    }
  }, [watchlistStocks]);

  // ─── Trigger intelligence fetch ─────────────────────────
  useEffect(() => {
    if (stocksData.length > 0) {
      fetchIntelligence();
    }
  }, [stocksData.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    // Intelligence core
    intelData, intelLoading, intelCacheTime, fetchIntelligence,
    // Threads & Trackers
    threadCache, fetchThread,
    trackerCache, fetchTracker, expandedTracker, trackerLoading, handleToggleTracker,
    // Market Pulse
    marketPulse, marketPulseLoading, marketPulseError, fetchMarketPulse,
    // Upcoming Events
    upcomingEconomic, upcomingEarnings,
    upcomingEconomicLoading, upcomingEarningsLoading,
    upcomingEconomicError, upcomingEarningsError,
    fetchUpcomingEconomic, fetchUpcomingEarnings,
    // Read-Across Alerts
    visibleAlerts, handleDismissAlert,
    // Weekly Report
    weeklyReportData, weeklyReportLoading, showWeeklyReport, setShowWeeklyReport, fetchWeeklyReport,
    // Watchlist
    watchlistStocks, handleAddToWatchlist, handleRemoveFromWatchlist,
    // Why Moving
    whyMovingTarget, setWhyMovingTarget,
    // Context builders
    buildMarketContextString,
  };
}
