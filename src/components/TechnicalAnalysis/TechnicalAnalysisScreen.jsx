// src/components/TechnicalAnalysis/TechnicalAnalysisScreen.jsx
// Main screen for AI-powered technical analysis with conversational Explore tab

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CandlestickChart from './CandlestickChart';
import TimeframeSelector from './TimeframeSelector';
import PatternsTab from './PatternsTab';
import LevelsTab from './LevelsTab';
import detectLevels from '../../services/levelDetection';
import {
  calculateRSI,
  getRSISignal,
  calculateMACD,
  getMACDSignal,
  calculateSMA,
  calculateATR,
  calculateATRPercent,
  detectTrend,
} from '../../services/technicalIndicators';
import { getExploreQuestions, analyzeExploreQuestion } from '../../services/technicalAnalysisAI';

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
  const [trackedPatterns, setTrackedPatterns] = useState([]);

  // Chart level overlay state (Phase 5)
  const [showLevelOverlay, setShowLevelOverlay] = useState(false);
  const [chartLevels, setChartLevels] = useState([]);

  useEffect(() => {
    if (stock?.symbol) {
      loadStockData();
      loadDailyAnchorData(); // Always load daily data as anchor
    }
  }, [stock?.symbol]);

  // Always fetch daily data as anchor for S/R levels (Phase 4)
  const loadDailyAnchorData = async () => {
    if (!stock?.symbol || !fetchOHLCV) return;

    try {
      console.log(`[TechnicalAnalysis] Loading daily anchor data for ${stock.symbol}...`);
      const dailyData = await fetchOHLCV(stock.symbol, '1d');

      if (dailyData && dailyData.length > 0) {
        setDailyAnchorData(dailyData);

        // Calculate daily indicators for S/R levels
        const closingPrices = dailyData.map(c => c.close);
        const indicators = calculateLocalIndicators(closingPrices, dailyData);
        setDailyIndicators(indicators);

        console.log(`[TechnicalAnalysis] Daily anchor loaded: ${dailyData.length} candles`);
      }
    } catch (error) {
      console.warn('[TechnicalAnalysis] Failed to load daily anchor:', error);
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
        console.log(`[TechnicalAnalysis] Fetching ${timeframe} OHLCV for ${stock.symbol}...`);
        const data = await fetchOHLCV(stock.symbol, timeframe);
        if (data && data.length > 0) {
          console.log(`[TechnicalAnalysis] Got ${data.length} ${timeframe} candles for ${stock.symbol}`);
          setOhlcvData(data);

          // Check for fallback metadata
          if (data._meta?.fallbackMessage) {
            setNotification(data._meta.fallbackMessage);
            // Update timeframe selector to reflect actual timeframe
            if (data._meta.actualTimeframe && data._meta.actualTimeframe !== timeframe) {
              setSelectedTimeframe(data._meta.actualTimeframe);
            }
            // Auto-dismiss notification after 5 seconds
            setTimeout(() => setNotification(null), 5000);
          }
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
      console.error('Failed to fetch OHLCV:', err);
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
        console.log(`[TechnicalAnalysis] Switching to ${newTimeframe} timeframe...`);
        const data = await fetchOHLCV(stock.symbol, newTimeframe);
        if (data && data.length > 0) {
          console.log(`[TechnicalAnalysis] Got ${data.length} ${newTimeframe} candles`);
          setOhlcvData(data);

          // Check for fallback metadata
          if (data._meta?.fallbackMessage) {
            setNotification(data._meta.fallbackMessage);
            // Update timeframe selector to reflect actual timeframe
            if (data._meta.actualTimeframe && data._meta.actualTimeframe !== newTimeframe) {
              setSelectedTimeframe(data._meta.actualTimeframe);
            }
            // Auto-dismiss notification after 5 seconds
            setTimeout(() => setNotification(null), 5000);
          }
        } else {
          setError(`No ${newTimeframe} data available`);
        }
      }
    } catch (err) {
      console.error('Failed to fetch timeframe data:', err);
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
        console.log(`[TechnicalAnalysis] Running AI analysis for ${stock.symbol}...`);
        try {
          const aiResult = await analyzeStock(stock.symbol, ohlcvData, { mode: 'quick' });
          console.log(`[TechnicalAnalysis] AI analysis complete:`, aiResult?.summary?.substring(0, 100));

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
          console.warn('[TechnicalAnalysis] AI analysis failed, falling back to local:', aiError);
          // Fall through to local analysis
        }
      }

      // Local analysis fallback (localIndicators already calculated above)
      console.log(`[TechnicalAnalysis] Running local analysis for ${stock.symbol}...`);

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
        primaryLevel: null,   // Quick mode field
        keyTakeaway: null,    // Quick mode field
        calculatedAt: new Date().toISOString(),
        analysisMode: 'local',
        aiGenerated: false,
      });

    } catch (err) {
      console.error('Analysis failed:', err);
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
      trend,
    };
  };

  // Helper for fallback summary
  const generateFallbackSummary = (symbol, price) => {
    return `Technical analysis for ${symbol} at $${price?.toFixed(2)}. Using calculated indicator values.`;
  };

  useEffect(() => {
    if (ohlcvData && ohlcvData.length > 0 && !analysis && !isAnalyzing) {
      runAnalysis();
    }
  }, [ohlcvData]);

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
      console.error('[Explore] Question failed:', err);
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
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)' }}>
            Loading chart data...
          </div>
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
      <div style={{
        display: 'flex',
        padding: '0 16px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        backgroundColor: '#0d1117',
      }}>
        {['explore', 'patterns', 'levels'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
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
          <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.6)' }}>
            <p>&#9888;&#65039; {error}</p>
            <button onClick={loadStockData} style={{
              marginTop: '16px',
              padding: '10px 20px',
              backgroundColor: 'rgba(0, 255, 255, 0.1)',
              border: '1px solid rgba(0, 255, 255, 0.3)',
              borderRadius: '8px',
              color: '#00ffff',
              cursor: 'pointer',
            }}>
              Try Again
            </button>
          </div>
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
                  trackedPatterns={trackedPatterns}
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

// Mini Price Chart Component
const MiniPriceChart = ({ data }) => {
  if (!data || data.length === 0) return null;

  const closes = data.map(d => d.close).reverse(); // oldest to newest for chart
  const minPrice = Math.min(...closes);
  const maxPrice = Math.max(...closes);
  const priceRange = maxPrice - minPrice || 1;

  const width = 100;
  const height = 100;

  const points = closes.map((price, i) => {
    const x = (i / (closes.length - 1)) * width;
    const y = height - ((price - minPrice) / priceRange) * height;
    return `${x},${y}`;
  }).join(' ');

  const isPositive = closes[closes.length - 1] >= closes[0];
  const color = isPositive ? '#10b981' : '#ef4444';

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '100%' }} preserveAspectRatio="none">
        <defs>
          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon
          points={`0,${height} ${points} ${width},${height}`}
          fill="url(#chartGradient)"
        />
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div style={{
        position: 'absolute',
        bottom: '8px',
        left: '8px',
        fontSize: '10px',
        color: 'rgba(255,255,255,0.4)',
      }}>
        30-day price
      </div>
      <div style={{
        position: 'absolute',
        top: '8px',
        right: '8px',
        fontSize: '11px',
        color: color,
        fontWeight: '600',
      }}>
        {isPositive ? '+' : ''}{((closes[closes.length - 1] - closes[0]) / closes[0] * 100).toFixed(1)}%
      </div>
    </div>
  );
};

// Explore Tab - Conversational Q&A
const ExploreTab = ({ indicators, conversation, isLoading, onAskQuestion, onReset }) => {
  const questions = getExploreQuestions();

  return (
    <div>
      {/* Indicator Summary Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '8px',
        marginBottom: '20px',
        padding: '12px',
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        borderRadius: '8px',
        border: '1px solid rgba(255,255,255,0.05)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>RSI</div>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>
            {typeof indicators?.rsi?.value === 'number' ? indicators.rsi.value.toFixed(0) : '--'}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>MACD</div>
          <div style={{ fontSize: '14px', fontWeight: '600', color: indicators?.macd?.histogram > 0 ? '#00ff88' : '#ff4757' }}>
            {indicators?.macd?.histogram > 0 ? '+' : ''}{typeof indicators?.macd?.histogram === 'number' ? indicators.macd.histogram.toFixed(2) : '--'}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>50 SMA</div>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>
            {indicators?.sma50?.position || '--'}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>ATR</div>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>
            {indicators?.atr?.percent ? `${indicators.atr.percent.toFixed(1)}%` : '--'}
          </div>
        </div>
      </div>

      {/* Conversation Display */}
      {conversation.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          {conversation.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                marginBottom: '16px',
                padding: '16px',
                backgroundColor: 'rgba(0, 255, 255, 0.05)',
                border: '1px solid rgba(0, 255, 255, 0.2)',
                borderRadius: '12px',
              }}
            >
              <div style={{ fontSize: '12px', color: '#00ffff', marginBottom: '8px', fontWeight: '600' }}>
                Q: {item.question}
              </div>
              <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.85)', lineHeight: '1.6' }}>
                {item.answer}
              </div>

              {/* Follow-up Suggestions */}
              {item.followUps && item.followUps.length > 0 && (
                <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {item.followUps.map((followUp, j) => {
                    // Find the question ID that matches this follow-up
                    const matchingQ = questions.find(q =>
                      q.question.toLowerCase().includes(followUp.toLowerCase().slice(0, 20)) ||
                      followUp.toLowerCase().includes(q.shortLabel.toLowerCase())
                    );
                    return (
                      <button
                        key={j}
                        onClick={() => matchingQ && onAskQuestion(matchingQ.id)}
                        disabled={isLoading || !matchingQ}
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          backgroundColor: 'rgba(0, 255, 255, 0.1)',
                          border: '1px solid rgba(0, 255, 255, 0.3)',
                          borderRadius: '16px',
                          color: '#00ffff',
                          cursor: matchingQ ? 'pointer' : 'default',
                          opacity: matchingQ ? 1 : 0.5,
                        }}
                      >
                        {followUp}
                      </button>
                    );
                  })}
                </div>
              )}
            </motion.div>
          ))}

          {/* Reset Button */}
          <button
            onClick={onReset}
            style={{
              width: '100%',
              padding: '10px',
              fontSize: '13px',
              backgroundColor: 'transparent',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '8px',
              color: 'rgba(255,255,255,0.5)',
              cursor: 'pointer',
              marginBottom: '16px',
            }}
          >
            Start Over
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div style={{
          padding: '24px',
          textAlign: 'center',
          backgroundColor: 'rgba(0, 255, 255, 0.05)',
          borderRadius: '12px',
          marginBottom: '16px',
        }}>
          <motion.div
            style={{
              width: '100px',
              height: '3px',
              backgroundColor: 'rgba(0, 255, 255, 0.2)',
              borderRadius: '2px',
              margin: '0 auto',
              overflow: 'hidden',
            }}
          >
            <motion.div
              style={{ height: '100%', backgroundColor: '#00ffff', borderRadius: '2px' }}
              initial={{ width: 0 }}
              animate={{ width: '100%' }}
              transition={{ duration: 1.5, ease: 'linear', repeat: Infinity }}
            />
          </motion.div>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', margin: '12px 0 0' }}>
            Analyzing...
          </p>
        </div>
      )}

      {/* Question Buttons (2x3 grid) */}
      {!isLoading && (
        <>
          <h3 style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '12px', textTransform: 'uppercase' }}>
            {conversation.length > 0 ? 'Ask Another Question' : 'Ask a Question'}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
            {questions.map((q) => (
              <button
                key={q.id}
                onClick={() => onAskQuestion(q.id)}
                style={{
                  padding: '14px 12px',
                  fontSize: '13px',
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '10px',
                  color: 'rgba(255,255,255,0.8)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s ease',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(0, 255, 255, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(0, 255, 255, 0.3)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                }}
              >
                {q.question}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// Overview Tab (kept for reference, now replaced by ExploreTab)
const OverviewTab = ({ analysis }) => (
  <div>
    <h3 style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '12px', textTransform: 'uppercase' }}>
      Indicator Readings
    </h3>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '24px' }}>
      <IndicatorCard
        name="RSI (14)"
        value={typeof analysis.indicators?.rsi?.value === 'number' ? analysis.indicators.rsi.value.toFixed(1) : '--'}
        status={analysis.indicators?.rsi?.zone || 'N/A'}
      />
      <IndicatorCard
        name="MACD"
        value={typeof analysis.indicators?.macd?.histogram === 'number' ? analysis.indicators.macd.histogram.toFixed(2) : '--'}
        status={analysis.indicators?.macd?.state || 'N/A'}
      />
      <IndicatorCard
        name="vs 50 SMA"
        value={analysis.indicators?.sma50?.distance || '--'}
        status={analysis.indicators?.sma50?.position || 'N/A'}
      />
      <IndicatorCard
        name="ATR (14)"
        value={analysis.indicators?.atr?.value ? `$${analysis.indicators.atr.value.toFixed(2)}` : '--'}
        status={analysis.indicators?.atr?.regime || 'N/A'}
      />
    </div>

    {/* Quick mode: Primary Level */}
    {analysis.primaryLevel && analysis.primaryLevel.type !== 'NONE' && (
      <>
        <h3 style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '12px', textTransform: 'uppercase' }}>
          Key Level
        </h3>
        <div style={{
          padding: '12px 16px',
          backgroundColor: analysis.primaryLevel.type === 'SUPPORT' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${analysis.primaryLevel.type === 'SUPPORT' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
          borderRadius: '8px',
          marginBottom: '16px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: analysis.primaryLevel.type === 'SUPPORT' ? '#22c55e' : '#ef4444', fontWeight: '600' }}>
              {analysis.primaryLevel.type}
            </span>
            <span style={{ color: '#fff', fontWeight: '600' }}>
              ${typeof analysis.primaryLevel.price === 'number' ? analysis.primaryLevel.price.toFixed(2) : analysis.primaryLevel.price}
            </span>
          </div>
          {analysis.primaryLevel.source && (
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>
              {analysis.primaryLevel.source}
            </div>
          )}
        </div>
      </>
    )}

    {/* Quick mode: Key Takeaway */}
    {analysis.keyTakeaway && (
      <>
        <h3 style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '12px', textTransform: 'uppercase' }}>
          Key Takeaway
        </h3>
        <div style={{
          padding: '12px 16px',
          backgroundColor: 'rgba(0, 255, 255, 0.05)',
          border: '1px solid rgba(0, 255, 255, 0.2)',
          borderRadius: '8px',
          marginBottom: '16px',
        }}>
          <p style={{ fontSize: '14px', color: '#00ffff', margin: 0, lineHeight: '1.5' }}>
            {analysis.keyTakeaway}
          </p>
        </div>
      </>
    )}

    {/* Summary (both modes) */}
    {analysis.summary && (
      <>
        <h3 style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '12px', textTransform: 'uppercase' }}>
          Technical Context
        </h3>
        <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)', lineHeight: '1.6' }}>{analysis.summary}</p>
      </>
    )}
  </div>
);

// Indicator Card
const IndicatorCard = ({ name, value, status }) => (
  <div style={{
    padding: '14px',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.08)',
  }}>
    <span style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>{name}</span>
    <span style={{ display: 'block', fontSize: '18px', fontWeight: '600', color: '#fff', marginBottom: '4px' }}>{value}</span>
    <span style={{ fontSize: '12px', color: '#00ffff' }}>{status}</span>
  </div>
);

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
