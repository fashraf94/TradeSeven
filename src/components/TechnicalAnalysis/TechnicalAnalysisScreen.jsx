// src/components/TechnicalAnalysis/TechnicalAnalysisScreen.jsx
// Main screen for AI-powered technical analysis

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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
    try {
      if (fetchOHLCV) {
        const data = await fetchOHLCV(stock.symbol, 90);
        setOhlcvData(data);
      } else {
        // Demo mode - simulate loading
        await new Promise(resolve => setTimeout(resolve, 500));
        setOhlcvData([{ close: stock.price || 150 }]);
      }
    } catch (err) {
      console.error('Failed to fetch OHLCV:', err);
      setError('Failed to load price data');
    } finally {
      setIsLoadingData(false);
    }
  };

  const runAnalysis = async () => {
    setIsAnalyzing(true);
    setError(null);
    try {
      if (analyzeStock) {
        const result = await analyzeStock(stock.symbol, ohlcvData, 'Classic');
        setAnalysis(result);
      } else {
        // Demo mode
        await new Promise(resolve => setTimeout(resolve, 2000));
        setAnalysis(getDemoAnalysis(stock));
      }
    } catch (err) {
      console.error('Analysis failed:', err);
      setError('Analysis failed. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    if (ohlcvData && !analysis && !isAnalyzing) {
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

      {/* Chart Placeholder */}
      <div style={{
        height: '200px',
        backgroundColor: '#0d1117',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {isLoadingData ? (
          <div style={{ color: 'rgba(255,255,255,0.5)' }}>Loading chart...</div>
        ) : (
          <div style={{
            width: '100%',
            height: '100%',
            background: 'linear-gradient(180deg, rgba(0,255,255,0.05) 0%, transparent 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>
              Chart visualization coming soon
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
              AI is detecting patterns and confluence zones
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
                transition={{ duration: 2, ease: 'linear' }}
              />
            </div>
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.6)' }}>
            <p>&#9888;&#65039; {error}</p>
            <button onClick={runAnalysis} style={{
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

// Overview Tab
const OverviewTab = ({ analysis }) => (
  <div>
    <h3 style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '12px', textTransform: 'uppercase' }}>
      Indicator Readings
    </h3>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '24px' }}>
      <IndicatorCard name="RSI (14)" value={analysis.indicators?.rsi?.value || 52} status={analysis.indicators?.rsi?.zone || 'Neutral'} />
      <IndicatorCard name="MACD" value={analysis.indicators?.macd?.histogram?.toFixed(2) || '0.00'} status={analysis.indicators?.macd?.state || 'Neutral'} />
      <IndicatorCard name="vs 50 SMA" value={analysis.indicators?.sma50?.distance || '+1.2%'} status={analysis.indicators?.sma50?.position || 'Above'} />
      <IndicatorCard name="ATR (14)" value={`$${analysis.indicators?.atr?.value?.toFixed(2) || '5.00'}`} status={analysis.indicators?.atr?.regime || 'Normal'} />
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
    {analysis.confluenceZones?.length > 0 && (
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
    )}
  </div>
);

// Levels Tab
const LevelsTab = ({ analysis }) => (
  <div>
    <h3 style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '12px', textTransform: 'uppercase' }}>
      Support Zones
    </h3>
    {(analysis.levels?.support || []).map((level, i) => (
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
    ))}

    <h3 style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '12px', marginTop: '20px', textTransform: 'uppercase' }}>
      Resistance Zones
    </h3>
    {(analysis.levels?.resistance || []).map((level, i) => (
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
    ))}
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

// Demo Analysis Data
const getDemoAnalysis = (stock) => ({
  ticker: stock?.symbol,
  summary: `${stock?.symbol} is showing mixed signals with RSI in neutral territory and price above key moving averages. The recent price action suggests consolidation with potential for movement in either direction.`,
  indicators: {
    rsi: { value: 52, zone: 'Neutral' },
    macd: { histogram: 0.45, state: 'Neutral' },
    sma50: { distance: '+1.2%', position: 'Above' },
    atr: { value: 5.20, regime: 'Normal' },
  },
  confluenceZones: [
    {
      zoneType: 'SUPPORT',
      strength: 'STRONG',
      priceLow: (stock?.price || 150) * 0.95,
      priceHigh: (stock?.price || 150) * 0.97,
      indicators: [
        { indicator: 'Fibonacci 61.8%', value: (stock?.price || 150) * 0.955 },
        { indicator: '50 SMA', value: (stock?.price || 150) * 0.96 },
        { indicator: 'AVWAP', value: (stock?.price || 150) * 0.958 },
      ],
    },
  ],
  levels: {
    support: [
      { source: 'Fibonacci 61.8%', price: (stock?.price || 150) * 0.955, strength: 'Strong' },
      { source: '50 SMA', price: (stock?.price || 150) * 0.96, strength: 'Moderate' },
    ],
    resistance: [
      { source: 'Prior High', price: (stock?.price || 150) * 1.05, strength: 'Strong' },
      { source: 'Pivot R1', price: (stock?.price || 150) * 1.03, strength: 'Moderate' },
    ],
  },
});

export default TechnicalAnalysisScreen;
