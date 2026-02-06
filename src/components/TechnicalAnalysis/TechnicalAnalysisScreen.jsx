// src/components/TechnicalAnalysis/TechnicalAnalysisScreen.jsx
// Main screen for AI-powered technical analysis with conversational Explore tab

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CandlestickChart from './CandlestickChart';
import TimeframeSelector from './TimeframeSelector';
import PatternsTab from './PatternsTab';
import LevelsTab from './LevelsTab';
import ExploreTab from './ExploreTab';
import detectLevels from '../../services/levelDetection';
import {
  calculateRSI,
  calculateMACD,
  calculateSMA,
  calculateATR,
  calculateATRPercent,
  calculateRVOL,
  detectTrend,
} from '../../services/technicalIndicators';
import { analyzeExploreQuestion } from '../../services/technicalAnalysisAI';

// Conditional logging - only show debug logs in development
const DEBUG = typeof process !== 'undefined' && process.env?.NODE_ENV === 'development';
const logger = {
  log: (...args) => DEBUG && console.log(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
};

// Skeleton loading component
const Skeleton = ({ width = '100%', height = 20, style = {} }) => (
  <div
    style={{
      width,
      height,
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderRadius: '4px',
      animation: 'skeleton-pulse 1.5s ease-in-out infinite',
      ...style,
    }}
  />
);

// Chart skeleton loader
const ChartSkeleton = () => (
  <div style={{
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: '8px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
  }}>
    <div style={{
      width: '60px',
      height: '3px',
      backgroundColor: 'rgba(0, 255, 255, 0.2)',
      borderRadius: '2px',
      overflow: 'hidden',
    }}>
      <div style={{
        width: '30%',
        height: '100%',
        backgroundColor: '#00ffff',
        borderRadius: '2px',
        animation: 'skeleton-slide 1.5s ease-in-out infinite',
      }} />
    </div>
    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>
      Loading chart...
    </span>
  </div>
);

// Error state component with retry
const ErrorState = ({ message, onRetry }) => (
  <div style={{
    padding: '40px 20px',
    textAlign: 'center',
    backgroundColor: 'rgba(255, 71, 87, 0.1)',
    borderRadius: '12px',
    border: '1px solid rgba(255, 71, 87, 0.2)',
  }}>
    <span style={{ fontSize: '32px', display: 'block', marginBottom: '12px' }}>&#9888;&#65039;</span>
    <h3 style={{ color: '#ff4757', margin: '0 0 8px 0', fontSize: '16px' }}>
      Something went wrong
    </h3>
    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', margin: '0 0 16px 0' }}>
      {message || 'Failed to load data. Please try again.'}
    </p>
    {onRetry && (
      <button
        onClick={onRetry}
        style={{
          padding: '10px 24px',
          backgroundColor: 'rgba(255, 71, 87, 0.2)',
          border: '1px solid #ff4757',
          borderRadius: '8px',
          color: '#ff4757',
          fontSize: '14px',
          cursor: 'pointer',
        }}
      >
        Try Again
      </button>
    )}
  </div>
);

// CSS keyframes injection moved to useEffect in component

const TechnicalAnalysisScreen = ({
  stock,
  onBack,
  onTrackPattern,
  fetchOHLCV,
  analyzeStock,
  colors = {},
}) => {
  const [ohlcvData, setOhlcvData] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('explore');
  const [selectedTimeframe, setSelectedTimeframe] = useState('1d');
  const [isLoadingTimeframe, setIsLoadingTimeframe] = useState(false);
  const [notification, setNotification] = useState(null); // For fallback messages

  // Explore tab conversation state
  const [exploreConversation, setExploreConversation] = useState([]);
  const [isExploreLoading, setIsExploreLoading] = useState(false);
  const [calculatedIndicators, setCalculatedIndicators] = useState(null);

  // Daily anchor data for multi-timeframe confluence detection
  const [dailyAnchorData, setDailyAnchorData] = useState(null);
  const [dailyIndicators, setDailyIndicators] = useState(null);

  // Chart level overlay state (Phase 5)
  const [showLevelOverlay, setShowLevelOverlay] = useState(false);
  const [chartLevels, setChartLevels] = useState([]);

  // Track if initial load has happened
  const initialLoadRef = useRef(false);

  // Helper to handle fallback metadata notifications (M6 - consolidated)
  const handleFallbackMetadata = useCallback((data, requestedTimeframe) => {
    if (!data._meta?.fallbackMessage) return;

    setNotification(data._meta.fallbackMessage);

    // Update timeframe selector if actual timeframe differs
    if (data._meta.actualTimeframe && data._meta.actualTimeframe !== requestedTimeframe) {
      setSelectedTimeframe(data._meta.actualTimeframe);
    }

    // Auto-dismiss after 5 seconds
    setTimeout(() => setNotification(null), 5000);
  }, []);

  // Inject CSS keyframes for skeleton animations (H4 fix)
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.getElementById('skeleton-styles')) return;

    const style = document.createElement('style');
    style.id = 'skeleton-styles';
    style.textContent = `
      @keyframes skeleton-pulse {
        0%, 100% { opacity: 0.4; }
        50% { opacity: 0.8; }
      }
      @keyframes skeleton-slide {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(400%); }
      }
      @keyframes loadingSlide {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(350%); }
      }
    `;
    document.head.appendChild(style);

    return () => {
      const el = document.getElementById('skeleton-styles');
      if (el) el.remove();
    };
  }, []);

  // Initial data load when symbol changes (H3 fix - proper dependencies)
  useEffect(() => {
    if (stock?.symbol && !initialLoadRef.current) {
      initialLoadRef.current = true;
      loadStockData();
      loadDailyAnchorData();
    }
  }, [stock?.symbol]);

  // Reset initial load flag when symbol changes
  useEffect(() => {
    initialLoadRef.current = false;
  }, [stock?.symbol]);

  // Always fetch daily data as anchor for S/R levels (Phase 4)
  const loadDailyAnchorData = async () => {
    if (!stock?.symbol || !fetchOHLCV) return;

    try {
      logger.log(`[TechnicalAnalysis] Loading daily anchor data for ${stock.symbol}...`);
      const dailyData = await fetchOHLCV(stock.symbol, '1d');

      if (dailyData && dailyData.length > 0) {
        setDailyAnchorData(dailyData);

        // Calculate daily indicators for S/R levels
        const closingPrices = dailyData.map(c => c.close);
        const indicators = calculateLocalIndicators(closingPrices, dailyData);
        setDailyIndicators(indicators);

        logger.log(`[TechnicalAnalysis] Daily anchor loaded: ${dailyData.length} candles`);
      }
    } catch (error) {
      logger.warn('[TechnicalAnalysis] Failed to load daily anchor:', error);
      // Non-fatal - patterns tab will use current timeframe data as fallback
    }
  };

  const loadStockData = async (timeframe = selectedTimeframe) => {
    setIsLoadingData(true);
    setError(null);
    setAnalysis(null);
    setNotification(null);
    try {
      if (fetchOHLCV) {
        logger.log(`[TechnicalAnalysis] Fetching ${timeframe} OHLCV for ${stock.symbol}...`);
        const data = await fetchOHLCV(stock.symbol, timeframe);
        if (data && data.length > 0) {
          logger.log(`[TechnicalAnalysis] Got ${data.length} ${timeframe} candles for ${stock.symbol}`);
          setOhlcvData(data);
          handleFallbackMetadata(data, timeframe);
        } else {
          console.warn(`[TechnicalAnalysis] No data returned for ${stock.symbol}`);
          setError('No price data available for this symbol');
        }
      } else {
        // Demo mode - simulate loading with fake data
        console.log('[TechnicalAnalysis] Demo mode - using simulated data');
        await new Promise(resolve => setTimeout(resolve, 500));
        setOhlcvData(generateDemoOHLCV(stock.price || 150));
      }
    } catch (err) {
      logger.error('[TechnicalAnalysis] Failed to fetch OHLCV:', err);
      setError('Failed to load price data. Please try again.');
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleTimeframeChange = async (newTimeframe) => {
    if (newTimeframe === selectedTimeframe || isLoadingTimeframe) return;

    setIsLoadingTimeframe(true);
    setSelectedTimeframe(newTimeframe);
    setAnalysis(null); // Clear analysis when changing timeframe
    setNotification(null);

    try {
      if (fetchOHLCV) {
        logger.log(`[TechnicalAnalysis] Switching to ${newTimeframe} timeframe...`);
        const data = await fetchOHLCV(stock.symbol, newTimeframe);
        if (data && data.length > 0) {
          logger.log(`[TechnicalAnalysis] Got ${data.length} ${newTimeframe} candles`);
          setOhlcvData(data);
          handleFallbackMetadata(data, newTimeframe);
        } else {
          setError(`No ${newTimeframe} data available`);
        }
      }
    } catch (err) {
      logger.error('[TechnicalAnalysis] Failed to fetch timeframe data:', err);
      setError(`Failed to load ${newTimeframe} data`);
    } finally {
      setIsLoadingTimeframe(false);
    }
  };

  const runAnalysis = async () => {
    if (!ohlcvData || ohlcvData.length === 0) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      // Extract closing prices for indicator calculations
      const closingPrices = ohlcvData.map(c => c.close);
      const currentPrice = closingPrices[0];

      // Always calculate local indicators first (source of truth for numeric values)
      const localIndicators = calculateLocalIndicators(closingPrices, ohlcvData);

      // Try AI analysis if available
      if (analyzeStock) {
        logger.log(`[TechnicalAnalysis] Running AI analysis for ${stock.symbol}...`);
        try {
          const aiResult = await analyzeStock(stock.symbol, ohlcvData, { mode: 'quick' });
          logger.log(`[TechnicalAnalysis] AI analysis complete:`, aiResult?.summary?.substring(0, 100));

          // Merge local indicators with AI response
          // Local = source of truth for numeric values (sma50, atr, etc.)
          // AI = source of qualitative analysis (zones, trends, patterns)
          const mergedIndicators = {
            rsi: {
              value: localIndicators.rsi?.value,  // Local number
              zone: aiResult.indicators?.rsi?.zone || localIndicators.rsi?.zone,
              divergence: aiResult.indicators?.rsi?.divergence || null,
              regime: aiResult.indicators?.rsi?.regime || null,
            },
            macd: {
              histogram: localIndicators.macd?.histogram,  // Local number
              state: aiResult.indicators?.macd?.state || localIndicators.macd?.state,
              crossover: aiResult.indicators?.macd?.crossover || null,
            },
            sma50: localIndicators.sma50,   // Always from local
            atr: localIndicators.atr,       // Always from local
            sma20: localIndicators.sma20,
            sma200: localIndicators.sma200,
            trend: aiResult.indicators?.trend || localIndicators.trend,
            trendStrength: aiResult.indicators?.trendStrength || null,
          };

          setAnalysis({
            ticker: stock?.symbol,
            currentPrice,
            summary: aiResult.summary || generateFallbackSummary(stock.symbol, currentPrice),
            indicators: mergedIndicators,
            trendlines: aiResult.trendlines || {},
            confluenceZones: aiResult.confluenceZones || generateConfluenceZones(ohlcvData, localIndicators, currentPrice),
            patterns: aiResult.patterns || [],
            levels: aiResult.levels || generateLevels(ohlcvData, localIndicators),
            marketContext: aiResult.marketContext || null,
            primaryLevel: aiResult.primaryLevel || null,
            keyTakeaway: aiResult.keyTakeaway || null,
            calculatedAt: new Date().toISOString(),
            analysisMode: 'ai',
            aiGenerated: aiResult.aiGenerated !== false,
          });
          return;
        } catch (aiError) {
          logger.warn('[TechnicalAnalysis] AI analysis failed, falling back to local:', aiError);
          // Fall through to local analysis
        }
      }

      // Local analysis fallback (localIndicators already calculated above)
      logger.log(`[TechnicalAnalysis] Running local analysis for ${stock.symbol}...`);

      // Generate confluence zones based on real data
      const confluenceZones = generateConfluenceZones(ohlcvData, localIndicators, currentPrice);

      // Generate support/resistance levels
      const levels = generateLevels(ohlcvData, localIndicators);

      // Generate summary
      const summary = generateSummary(stock.symbol, currentPrice, localIndicators);

      // Simulate brief analysis time for UX
      await new Promise(resolve => setTimeout(resolve, 500));

      setAnalysis({
        ticker: stock?.symbol,
        currentPrice,
        summary,
        indicators: localIndicators,
        trendlines: {},
        confluenceZones,
        patterns: [],
        levels,
        marketContext: null,
        primaryLevel: null,
        keyTakeaway: null,
        calculatedAt: new Date().toISOString(),
        analysisMode: 'local',
        aiGenerated: false,
      });

    } catch (err) {
      logger.error('[TechnicalAnalysis] Analysis failed:', err);
      setError('Analysis failed. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Helper function to calculate local indicators
  const calculateLocalIndicators = (closingPrices, ohlcvData) => {
    const currentPrice = closingPrices[0];
    const rsiValue = calculateRSI(closingPrices, 14);
    const macdData = calculateMACD(closingPrices);
    const sma20 = calculateSMA(closingPrices, 20);
    const sma50 = calculateSMA(closingPrices, 50);
    const sma200 = calculateSMA(closingPrices, 200);
    const atrValue = calculateATR(ohlcvData, 14);
    const atrPercent = calculateATRPercent(ohlcvData, 14);
    const rvolData = calculateRVOL(ohlcvData);
    const trend = detectTrend(closingPrices);

    const sma50Distance = sma50 ? ((currentPrice - sma50) / sma50 * 100) : 0;
    const sma50Position = currentPrice > sma50 ? 'Above' : 'Below';
    const atrRegime = atrPercent > 3 ? 'High Volatility' : atrPercent > 1.5 ? 'Normal' : 'Low Volatility';

    const getRSIZone = (rsi) => {
      if (rsi >= 70) return 'Overbought';
      if (rsi >= 60) return 'Bullish';
      if (rsi >= 40) return 'Neutral';
      if (rsi >= 30) return 'Bearish';
      return 'Oversold';
    };

    const getMACDState = (macd) => {
      if (!macd) return 'N/A';
      if (macd.histogram > 0.5) return 'Bullish';
      if (macd.histogram > 0) return 'Neutral-Bullish';
      if (macd.histogram > -0.5) return 'Neutral-Bearish';
      return 'Bearish';
    };

    return {
      rsi: {
        value: rsiValue !== null ? Math.round(rsiValue * 10) / 10 : '--',
        zone: rsiValue !== null ? getRSIZone(rsiValue) : 'N/A',
      },
      macd: {
        histogram: macdData?.histogram || 0,
        state: getMACDState(macdData),
      },
      sma50: {
        value: sma50 ? Math.round(sma50 * 100) / 100 : null,
        distance: `${sma50Distance > 0 ? '+' : ''}${sma50Distance.toFixed(2)}%`,
        position: sma50Position,
      },
      atr: {
        value: atrValue ? Math.round(atrValue * 100) / 100 : null,
        percent: atrPercent,
        regime: atrRegime,
      },
      sma20: sma20 ? Math.round(sma20 * 100) / 100 : null,
      sma200: sma200 ? Math.round(sma200 * 100) / 100 : null,
      rvol: rvolData,
      trend,
    };
  };

  // Helper for fallback summary
  const generateFallbackSummary = (symbol, price) => {
    return `Technical analysis for ${symbol} at $${price?.toFixed(2)}. Using calculated indicator values.`;
  };

  // Run analysis when data loads (H3 fix - useCallback for runAnalysis)
  const runAnalysisIfNeeded = useCallback(() => {
    if (ohlcvData && ohlcvData.length > 0 && !analysis && !isAnalyzing) {
      runAnalysis();
    }
  }, [ohlcvData, analysis, isAnalyzing]);

  useEffect(() => {
    runAnalysisIfNeeded();
  }, [runAnalysisIfNeeded]);

  const handleTrackPattern = (pattern) => {
    if (onTrackPattern) {
      onTrackPattern({
        ...pattern,
        ticker: stock.symbol,
        priceAtCreation: ohlcvData?.[0]?.close || stock.price,
      });
    }
  };

  // Handle explore question click
  const handleExploreQuestion = useCallback(async (questionId) => {
    if (!ohlcvData || ohlcvData.length === 0 || !calculatedIndicators) return;

    setIsExploreLoading(true);
    try {
      const response = await analyzeExploreQuestion(
        stock.symbol,
        questionId,
        ohlcvData,
        calculatedIndicators
      );

      setExploreConversation(prev => [...prev, response]);
    } catch (err) {
      logger.error('[Explore] Question failed:', err);
      setExploreConversation(prev => [...prev, {
        questionId,
        question: 'Analysis failed',
        answer: 'Unable to complete analysis. Please try again.',
        followUps: [],
        error: true,
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setIsExploreLoading(false);
    }
  }, [ohlcvData, calculatedIndicators, stock?.symbol]);

  // Reset explore conversation
  const handleExploreReset = useCallback(() => {
    setExploreConversation([]);
  }, []);

  // Calculate and store indicators when OHLCV data loads
  useEffect(() => {
    if (ohlcvData && ohlcvData.length > 0) {
      const closingPrices = ohlcvData.map(c => c.close);
      const indicators = calculateLocalIndicators(closingPrices, ohlcvData);
      setCalculatedIndicators(indicators);
    }
  }, [ohlcvData]);

  // Calculate chart levels for overlay (Phase 5)
  useEffect(() => {
    if (dailyAnchorData && dailyIndicators) {
      const detected = detectLevels(dailyAnchorData, dailyIndicators);

      // Format levels for chart overlay
      const allLevels = [
        ...detected.support.map(l => ({
          price: l.price,
          type: 'SUPPORT',
          label: l.factors[0]?.name || 'Support',
        })),
        ...detected.resistance.map(l => ({
          price: l.price,
          type: 'RESISTANCE',
          label: l.factors[0]?.name || 'Resistance',
        })),
      ];

      setChartLevels(allLevels);
    }
  }, [dailyAnchorData, dailyIndicators]);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0a0e14',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 20px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        backgroundColor: '#0d1117',
      }}>
        <button onClick={onBack} style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 12px',
          background: 'none',
          border: 'none',
          color: '#00ffff',
          fontSize: '14px',
          cursor: 'pointer',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15,18 9,12 15,6" />
          </svg>
          Back
        </button>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#ffffff', margin: 0 }}>
            {stock?.symbol}
          </h1>
          <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)' }}>
            {stock?.name}
          </span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '18px', fontWeight: '600', color: '#ffffff' }}>
            ${ohlcvData?.[0]?.close?.toFixed(2) || stock?.price?.toFixed(2) || '--'}
          </span>
        </div>
      </div>

      {/* Timeframe Selector */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 12px',
        backgroundColor: '#0d1117',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
      }}>
        <span style={{
          fontSize: '12px',
          color: 'rgba(255,255,255,0.5)',
        }}>
          {selectedTimeframe === '1h' && '10-day hourly'}
          {selectedTimeframe === '1d' && '3-month daily'}
          {selectedTimeframe === '1w' && '3-year weekly'}
        </span>
        <TimeframeSelector
          selected={selectedTimeframe}
          onChange={handleTimeframeChange}
          disabled={isLoadingTimeframe || isLoadingData}
        />
      </div>

      {/* Notification Banner */}
      {notification && (
        <div style={{
          padding: '8px 12px',
          backgroundColor: 'rgba(255, 193, 7, 0.15)',
          borderBottom: '1px solid rgba(255, 193, 7, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
        }}>
          <span style={{ fontSize: '12px', color: '#ffc107' }}>
            ⚠️ {notification}
          </span>
          <button
            onClick={() => setNotification(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.5)',
              cursor: 'pointer',
              padding: '2px 6px',
              fontSize: '14px',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Candlestick Chart */}
      <div style={{
        height: '280px',
        backgroundColor: '#0a1628',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '8px',
        position: 'relative',
      }}>
        {isLoadingData ? (
          <ChartSkeleton />
        ) : ohlcvData && ohlcvData.length > 0 ? (
          <CandlestickChart
            ohlcvData={ohlcvData}
            height={264}
            levels={chartLevels}
            showLevelOverlay={showLevelOverlay}
          />
        ) : (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)' }}>
            No chart data available
          </div>
        )}
        {isLoadingTimeframe && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(10, 22, 40, 0.85)',
            borderRadius: '8px',
          }}>
            <span style={{ color: '#00ffff', fontSize: '14px' }}>
              Loading {selectedTimeframe.toUpperCase()} data...
            </span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Analysis sections"
        style={{
          display: 'flex',
          padding: '0 16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          backgroundColor: '#0d1117',
        }}
      >
        {['explore', 'patterns', 'levels'].map((tab, index) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls={`${tab}-panel`}
            id={`${tab}-tab`}
            tabIndex={activeTab === tab ? 0 : -1}
            onClick={() => setActiveTab(tab)}
            onKeyDown={(e) => {
              const tabs = ['explore', 'patterns', 'levels'];
              if (e.key === 'ArrowRight') {
                const nextIndex = (index + 1) % tabs.length;
                setActiveTab(tabs[nextIndex]);
              } else if (e.key === 'ArrowLeft') {
                const prevIndex = (index - 1 + tabs.length) % tabs.length;
                setActiveTab(tabs[prevIndex]);
              }
            }}
            style={{
              flex: 1,
              padding: '14px 16px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid #00ffff' : '2px solid transparent',
              color: activeTab === tab ? '#00ffff' : 'rgba(255, 255, 255, 0.5)',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'color 0.2s ease, border-color 0.2s ease',
              minHeight: '44px', // Touch target size
            }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {isLoadingData ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <p style={{ color: 'rgba(255,255,255,0.5)' }}>Loading data...</p>
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={() => loadStockData()} />
        ) : ohlcvData && calculatedIndicators ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {activeTab === 'explore' && (
                <ExploreTab
                  indicators={calculatedIndicators}
                  conversation={exploreConversation}
                  isLoading={isExploreLoading}
                  onAskQuestion={handleExploreQuestion}
                  onReset={handleExploreReset}
                />
              )}
              {activeTab === 'patterns' && (
                <PatternsTab
                  ohlcvData={ohlcvData}
                  dailyAnchorData={dailyAnchorData}
                  dailyIndicators={dailyIndicators}
                  selectedTimeframe={selectedTimeframe}
                  onTrackPattern={handleTrackPattern}
                  rvolData={calculatedIndicators?.rvol}
                />
              )}
              {activeTab === 'levels' && (
                <LevelsTab
                  dailyData={dailyAnchorData}
                  indicators={dailyIndicators}
                  chartOverlayEnabled={showLevelOverlay}
                  onToggleChartOverlay={setShowLevelOverlay}
                />
              )}
            </motion.div>
          </AnimatePresence>
        ) : null}
      </div>

      {/* Disclaimer */}
      <div style={{
        padding: '14px 20px',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
      }}>
        <span>&#8505;&#65039;</span>
        <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', lineHeight: '1.5' }}>
          This analysis identifies technical patterns for educational purposes.
          Pattern detection is not a recommendation to trade.
        </span>
      </div>
    </div>
  );
};

// Helper: Generate summary from real indicators
const generateSummary = (symbol, currentPrice, indicators) => {
  const parts = [];

  parts.push(`${symbol} is trading at $${currentPrice.toFixed(2)}.`);

  if (indicators.rsi?.value && indicators.rsi.value !== '--') {
    parts.push(`RSI at ${indicators.rsi.value} indicates ${indicators.rsi.zone.toLowerCase()} momentum.`);
  }

  if (indicators.sma50?.position) {
    parts.push(`Price is ${indicators.sma50.position.toLowerCase()} the 50-day SMA by ${indicators.sma50.distance}.`);
  }

  if (indicators.trend?.direction && indicators.trend.direction !== 'unknown') {
    const trendStrength = indicators.trend.strength > 0.5 ? 'strong' : 'moderate';
    parts.push(`The overall trend appears ${trendStrength}ly ${indicators.trend.direction}.`);
  }

  if (indicators.atr?.regime) {
    parts.push(`Volatility is ${indicators.atr.regime.toLowerCase()}.`);
  }

  return parts.join(' ');
};

// Helper: Generate confluence zones from real data
const generateConfluenceZones = (candles, indicators, currentPrice) => {
  const zones = [];

  if (!candles || candles.length < 20) return zones;

  // Get recent highs and lows
  const recentCandles = candles.slice(0, 20);
  const recentLow = Math.min(...recentCandles.map(c => c.low));
  const recentHigh = Math.max(...recentCandles.map(c => c.high));

  // Check if price is near support zone
  const sma50 = indicators.sma50?.value;
  const supportLevel = sma50 && sma50 < currentPrice ? sma50 : recentLow;

  if (currentPrice < supportLevel * 1.03) {
    const zoneIndicators = [];
    if (sma50 && Math.abs(sma50 - supportLevel) / supportLevel < 0.02) {
      zoneIndicators.push({ indicator: '50 SMA', value: sma50 });
    }
    zoneIndicators.push({ indicator: '20-Day Low', value: recentLow });

    if (zoneIndicators.length >= 1) {
      zones.push({
        zoneType: 'SUPPORT',
        strength: zoneIndicators.length >= 2 ? 'STRONG' : 'MODERATE',
        priceLow: supportLevel * 0.99,
        priceHigh: supportLevel * 1.01,
        indicators: zoneIndicators,
      });
    }
  }

  // Check if price is near resistance zone
  if (currentPrice > recentHigh * 0.97) {
    zones.push({
      zoneType: 'RESISTANCE',
      strength: 'MODERATE',
      priceLow: recentHigh * 0.99,
      priceHigh: recentHigh * 1.01,
      indicators: [
        { indicator: '20-Day High', value: recentHigh },
      ],
    });
  }

  return zones;
};

// Helper: Generate support/resistance levels from real data
const generateLevels = (candles, indicators) => {
  if (!candles || candles.length < 20) {
    return { support: [], resistance: [] };
  }

  const recentCandles = candles.slice(0, 20);
  const recentLow = Math.min(...recentCandles.map(c => c.low));
  const recentHigh = Math.max(...recentCandles.map(c => c.high));

  const support = [];
  const resistance = [];

  // Support levels
  if (indicators.sma50?.value) {
    support.push({ source: '50 SMA', price: indicators.sma50.value, strength: 'Strong' });
  }
  support.push({ source: '20-Day Low', price: recentLow, strength: 'Moderate' });
  if (indicators.sma200) {
    support.push({ source: '200 SMA', price: indicators.sma200, strength: 'Strong' });
  }

  // Resistance levels
  resistance.push({ source: '20-Day High', price: recentHigh, strength: 'Strong' });
  if (indicators.sma20) {
    const currentPrice = candles[0].close;
    if (indicators.sma20 > currentPrice) {
      resistance.push({ source: '20 SMA', price: indicators.sma20, strength: 'Moderate' });
    }
  }

  // Sort by price
  support.sort((a, b) => b.price - a.price);
  resistance.sort((a, b) => a.price - b.price);

  return { support, resistance };
};

// Helper: Generate demo OHLCV data for testing
const generateDemoOHLCV = (basePrice) => {
  const data = [];
  let price = basePrice;

  for (let i = 0; i < 90; i++) {
    const change = (Math.random() - 0.5) * 0.03 * price;
    price = price + change;
    const high = price * (1 + Math.random() * 0.02);
    const low = price * (1 - Math.random() * 0.02);
    const open = low + Math.random() * (high - low);
    const close = low + Math.random() * (high - low);

    data.push({
      date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      open,
      high,
      low,
      close,
      volume: Math.floor(1000000 + Math.random() * 5000000),
    });
  }

  return data;
};

export default TechnicalAnalysisScreen;
