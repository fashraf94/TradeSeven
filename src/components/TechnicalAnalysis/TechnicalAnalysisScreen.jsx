// src/components/TechnicalAnalysis/TechnicalAnalysisScreen.jsx
// Main screen for AI-powered technical analysis

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (stock?.symbol) {
      loadStockData();
    }
  }, [stock?.symbol]);

  const loadStockData = async () => {
    setIsLoadingData(true);
    setError(null);
    setAnalysis(null);
    try {
      if (fetchOHLCV) {
        console.log(`[TechnicalAnalysis] Fetching OHLCV for ${stock.symbol}...`);
        const data = await fetchOHLCV(stock.symbol, 90);
        if (data && data.length > 0) {
          console.log(`[TechnicalAnalysis] Got ${data.length} candles for ${stock.symbol}`);
          setOhlcvData(data);
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

  const runAnalysis = async () => {
    if (!ohlcvData || ohlcvData.length === 0) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      // Extract closing prices for indicator calculations
      const closingPrices = ohlcvData.map(c => c.close);
      const currentPrice = closingPrices[0];

      // Calculate real technical indicators
      const rsiValue = calculateRSI(closingPrices, 14);
      const rsiSignal = getRSISignal(rsiValue);
      const macdData = calculateMACD(closingPrices);
      const macdSignal = getMACDSignal(macdData);
      const sma20 = calculateSMA(closingPrices, 20);
      const sma50 = calculateSMA(closingPrices, 50);
      const sma200 = calculateSMA(closingPrices, 200);
      const atrValue = calculateATR(ohlcvData, 14);
      const atrPercent = calculateATRPercent(ohlcvData, 14);
      const trend = detectTrend(closingPrices);

      // Calculate SMA50 distance
      const sma50Distance = sma50 ? ((currentPrice - sma50) / sma50 * 100) : 0;
      const sma50Position = currentPrice > sma50 ? 'Above' : 'Below';

      // Determine ATR regime
      const atrRegime = atrPercent > 3 ? 'High Volatility' : atrPercent > 1.5 ? 'Normal' : 'Low Volatility';

      // Get RSI zone description
      const getRSIZone = (rsi) => {
        if (rsi >= 70) return 'Overbought';
        if (rsi >= 60) return 'Bullish';
        if (rsi >= 40) return 'Neutral';
        if (rsi >= 30) return 'Bearish';
        return 'Oversold';
      };

      // Get MACD state description
      const getMACDState = (macd) => {
        if (!macd) return 'N/A';
        if (macd.histogram > 0.5) return 'Bullish';
        if (macd.histogram > 0) return 'Neutral-Bullish';
        if (macd.histogram > -0.5) return 'Neutral-Bearish';
        return 'Bearish';
      };

      // Build indicators object
      const realIndicators = {
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

      // Generate confluence zones based on real data
      const confluenceZones = generateConfluenceZones(ohlcvData, realIndicators, currentPrice);

      // Generate support/resistance levels
      const levels = generateLevels(ohlcvData, realIndicators);

      // Generate summary
      const summary = generateSummary(stock.symbol, currentPrice, realIndicators);

      // Simulate brief analysis time for UX
      await new Promise(resolve => setTimeout(resolve, 1000));

      setAnalysis({
        ticker: stock?.symbol,
        currentPrice,
        summary,
        indicators: realIndicators,
        confluenceZones,
        levels,
        calculatedAt: new Date().toISOString(),
      });

    } catch (err) {
      console.error('Analysis failed:', err);
      setError('Analysis failed. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
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

      {/* Mini Price Chart */}
      <div style={{
        height: '200px',
        backgroundColor: '#0d1117',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '16px',
      }}>
        {isLoadingData ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)' }}>
            Loading chart data...
          </div>
        ) : ohlcvData && ohlcvData.length > 0 ? (
          <MiniPriceChart data={ohlcvData.slice(0, 30)} />
        ) : (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)' }}>
            No chart data available
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
        {['overview', 'patterns', 'levels'].map(tab => (
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
        {isAnalyzing ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>&#128300;</div>
            <h3 style={{ color: '#fff', margin: '0 0 8px' }}>Analyzing {stock?.symbol}...</h3>
            <p style={{ color: 'rgba(255,255,255,0.5)', margin: '0 0 20px' }}>
              Calculating technical indicators
            </p>
            <div style={{
              width: '200px',
              height: '4px',
              backgroundColor: 'rgba(0, 255, 255, 0.2)',
              borderRadius: '2px',
              margin: '0 auto',
              overflow: 'hidden',
            }}>
              <motion.div
                style={{ height: '100%', backgroundColor: '#00ffff', borderRadius: '2px' }}
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ duration: 1.5, ease: 'linear' }}
              />
            </div>
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
        ) : analysis ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {activeTab === 'overview' && (
                <OverviewTab analysis={analysis} />
              )}
              {activeTab === 'patterns' && (
                <PatternsTab analysis={analysis} onTrack={handleTrackPattern} />
              )}
              {activeTab === 'levels' && (
                <LevelsTab analysis={analysis} />
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

// Overview Tab
const OverviewTab = ({ analysis }) => (
  <div>
    <h3 style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '12px', textTransform: 'uppercase' }}>
      Indicator Readings
    </h3>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '24px' }}>
      <IndicatorCard
        name="RSI (14)"
        value={analysis.indicators?.rsi?.value || '--'}
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

// Patterns Tab
const PatternsTab = ({ analysis, onTrack }) => (
  <div>
    {analysis.confluenceZones?.length > 0 ? (
      <>
        <h3 style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '12px', textTransform: 'uppercase' }}>
          Confluence Zones Detected
        </h3>
        {analysis.confluenceZones.map((zone, i) => (
          <div key={i} style={{
            padding: '16px',
            backgroundColor: 'rgba(255,255,255,0.03)',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.1)',
            marginBottom: '12px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ color: '#fff', fontWeight: '600' }}>
                {zone.zoneType === 'SUPPORT' ? '&#128994;' : '&#128308;'} {zone.zoneType}
              </span>
              <span style={{ color: '#fff', fontWeight: '600' }}>
                ${zone.priceLow?.toFixed(2)} - ${zone.priceHigh?.toFixed(2)}
              </span>
            </div>
            <div style={{ marginBottom: '14px' }}>
              {zone.indicators?.map((ind, j) => (
                <div key={j} style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>
                  <span style={{ color: '#00ffff' }}>&bull;</span> {ind.indicator}: ${ind.value?.toFixed(2)}
                </div>
              ))}
            </div>
            <button onClick={() => onTrack(zone)} style={{
              width: '100%',
              padding: '12px',
              backgroundColor: 'rgba(0, 255, 255, 0.1)',
              border: '1px solid rgba(0, 255, 255, 0.3)',
              borderRadius: '8px',
              color: '#00ffff',
              fontWeight: '600',
              cursor: 'pointer',
            }}>
              &#128300; Track This Pattern
            </button>
          </div>
        ))}
      </>
    ) : (
      <div style={{ textAlign: 'center', padding: '40px 20px', color: 'rgba(255,255,255,0.5)' }}>
        <p>No significant confluence zones detected at current price levels.</p>
        <p style={{ fontSize: '12px', marginTop: '8px' }}>
          Check the Levels tab for individual support and resistance points.
        </p>
      </div>
    )}
  </div>
);

// Levels Tab
const LevelsTab = ({ analysis }) => (
  <div>
    <h3 style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '12px', textTransform: 'uppercase' }}>
      Support Zones
    </h3>
    {(analysis.levels?.support || []).length > 0 ? (
      (analysis.levels?.support || []).map((level, i) => (
        <div key={i} style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '12px',
          backgroundColor: 'rgba(255,255,255,0.03)',
          borderRadius: '8px',
          marginBottom: '8px',
        }}>
          <span style={{ color: 'rgba(255,255,255,0.6)' }}>{level.source}</span>
          <span style={{ color: '#10b981', fontWeight: '600' }}>${level.price?.toFixed(2)}</span>
        </div>
      ))
    ) : (
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>No support levels identified</p>
    )}

    <h3 style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '12px', marginTop: '20px', textTransform: 'uppercase' }}>
      Resistance Zones
    </h3>
    {(analysis.levels?.resistance || []).length > 0 ? (
      (analysis.levels?.resistance || []).map((level, i) => (
        <div key={i} style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '12px',
          backgroundColor: 'rgba(255,255,255,0.03)',
          borderRadius: '8px',
          marginBottom: '8px',
        }}>
          <span style={{ color: 'rgba(255,255,255,0.6)' }}>{level.source}</span>
          <span style={{ color: '#ef4444', fontWeight: '600' }}>${level.price?.toFixed(2)}</span>
        </div>
      ))
    ) : (
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>No resistance levels identified</p>
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
