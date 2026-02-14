// TechnicalAnalysisTab — Comprehensive technical analysis display
// Extracted from AssetResearchModal for modularity.

import React from 'react';
import { safeToFixed } from '../../../utils/formatters';

// Mock technical data (in production, fetch from API)
const getMockTechnicalData = (symbol, price) => {
  const safePrice = price || 100;
  const defaults = {
    rsi: 50,
    macdSignal: 'neutral',
    vs50DayMA: 0,
    volumeRatio: 1.0,
    support: safePrice * 0.95,
    resistance: safePrice * 1.05,
    currentPrice: safePrice,
    trend7Day: 0,
    todayChange: 0,
    momentum: 'neutral',
    quickTake: 'Consolidating around current levels. Monitor for clearer signal.'
  };

  const stockTechnical = {
    'AAPL': { rsi: 58, macdSignal: 'bullish', vs50DayMA: 2.3, volumeRatio: 1.2, trend7Day: 1.8, todayChange: 0.45, momentum: 'bullish', quickTake: 'Strong momentum with support from services growth. Watch for breakout above resistance.' },
    'MSFT': { rsi: 62, macdSignal: 'bullish', vs50DayMA: 3.1, volumeRatio: 0.9, trend7Day: 2.1, todayChange: 0.72, momentum: 'bullish', quickTake: 'AI tailwinds driving positive sentiment. Consolidating near highs.' },
    'GOOGL': { rsi: 45, macdSignal: 'neutral', vs50DayMA: -1.2, volumeRatio: 1.1, trend7Day: -0.8, todayChange: -0.35, momentum: 'neutral', quickTake: 'Trading sideways amid regulatory concerns. Wait for clearer direction.' },
    'AMZN': { rsi: 55, macdSignal: 'bullish', vs50DayMA: 1.8, volumeRatio: 1.3, trend7Day: 1.5, todayChange: 0.28, momentum: 'bullish', quickTake: 'AWS growth supporting price. Breaking out of consolidation pattern.' },
    'NVDA': { rsi: 72, macdSignal: 'bullish', vs50DayMA: 8.5, volumeRatio: 1.8, trend7Day: 5.2, todayChange: 2.1, momentum: 'bullish', quickTake: 'Overbought but momentum strong. AI demand continues to drive gains.' },
    'TSLA': { rsi: 38, macdSignal: 'bearish', vs50DayMA: -4.2, volumeRatio: 1.5, trend7Day: -3.8, todayChange: -1.2, momentum: 'bearish', quickTake: 'Testing support levels. High volatility expected around earnings.' },
    'META': { rsi: 65, macdSignal: 'bullish', vs50DayMA: 4.1, volumeRatio: 1.0, trend7Day: 2.8, todayChange: 0.95, momentum: 'bullish', quickTake: 'Strong ad revenue driving gains. Approaching resistance levels.' },
    'JPM': { rsi: 52, macdSignal: 'neutral', vs50DayMA: 0.5, volumeRatio: 0.8, trend7Day: 0.3, todayChange: -0.15, momentum: 'neutral', quickTake: 'Stable trading range. Interest rate expectations driving sentiment.' }
  };

  const data = { ...defaults, ...(stockTechnical[symbol] || {}) };

  if (price) {
    data.currentPrice = price;
    data.support = price * (1 - Math.abs(data.vs50DayMA || 5) / 100);
    data.resistance = price * (1 + Math.abs(data.vs50DayMA || 5) / 100);
  }

  return data;
};

const TechnicalAnalysisTab = ({ asset, fundamentals }) => {
  const tech = getMockTechnicalData(asset.symbol, asset.price);

  const getStatus = () => {
    if (tech.rsi > 70) return { text: 'Overbought', color: '#ef4444', icon: '\u2191' };
    if (tech.rsi < 30) return { text: 'Oversold', color: '#22c55e', icon: '\u2193' };
    if (tech.macdSignal === 'bullish') return { text: 'Bullish', color: '#22c55e', icon: '\u2191' };
    if (tech.macdSignal === 'bearish') return { text: 'Bearish', color: '#ef4444', icon: '\u2193' };
    return { text: 'Consolidating', color: '#f59e0b', icon: '\u2192' };
  };

  const status = getStatus();

  const generateSparkline = () => {
    const isPositive = tech.trend7Day >= 0;
    const points = [];
    const baseY = 40;
    const variance = Math.abs(tech.trend7Day) * 3;

    for (let i = 0; i <= 6; i++) {
      const x = (i / 6) * 100;
      const randomVariance = (Math.random() - 0.5) * variance;
      const trendOffset = isPositive ? -((i / 6) * variance) : ((i / 6) * variance);
      const y = baseY + trendOffset + randomVariance;
      points.push(`${x},${Math.max(10, Math.min(70, y))}`);
    }

    return points.join(' ');
  };

  return (
    <div>
      {/* Status Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: `${status.color}20`,
            color: status.color,
            padding: '6px 12px',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: '600',
          }}
        >
          <span>{status.icon}</span>
          <span>{status.text}</span>
        </div>
        <span style={{
          color: tech.todayChange >= 0 ? '#22c55e' : '#ef4444',
          fontSize: '13px',
          fontWeight: '600'
        }}>
          Today: {tech.todayChange >= 0 ? '+' : ''}{safeToFixed(tech.todayChange, 2)}%
        </span>
      </div>

      {/* RSI Gauge */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '13px' }}>RSI (14)</span>
          <span style={{ color: '#fff', fontWeight: '700', fontSize: '14px' }}>{Math.round(tech.rsi)}</span>
        </div>
        <div
          style={{
            height: '10px',
            borderRadius: '5px',
            background: 'linear-gradient(to right, #22c55e 0%, #22c55e 30%, #f59e0b 30%, #f59e0b 70%, #ef4444 70%, #ef4444 100%)',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: `${tech.rsi}%`,
              top: '-3px',
              width: '6px',
              height: '16px',
              background: '#fff',
              borderRadius: '3px',
              transform: 'translateX(-50%)',
              boxShadow: '0 0 8px rgba(255, 255, 255, 0.8)',
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          <span style={{ color: '#22c55e' }}>Oversold</span>
          <span style={{ color: '#f59e0b' }}>Neutral</span>
          <span style={{ color: '#ef4444' }}>Overbought</span>
        </div>
      </div>

      {/* Technical Indicators */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px', overflow: 'hidden', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(255, 255, 255, 0.02)' }}>
          <span style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '13px' }}>MACD Signal</span>
          <span style={{
            color: tech.macdSignal === 'bullish' ? '#22c55e' : tech.macdSignal === 'bearish' ? '#ef4444' : 'rgba(255, 255, 255, 0.5)',
            fontSize: '13px',
            fontWeight: '600'
          }}>
            {tech.macdSignal === 'bullish' ? '\u25B2 Bullish Cross' : tech.macdSignal === 'bearish' ? '\u25BC Bearish Cross' : '\u2014 Neutral'}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(255, 255, 255, 0.02)' }}>
          <span style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '13px' }}>vs 50-Day MA</span>
          <span style={{
            color: tech.vs50DayMA >= 0 ? '#22c55e' : '#ef4444',
            fontSize: '13px',
            fontWeight: '600'
          }}>
            {tech.vs50DayMA >= 0 ? 'Above' : 'Below'} ({tech.vs50DayMA >= 0 ? '+' : ''}{safeToFixed(tech.vs50DayMA, 1)}%)
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(255, 255, 255, 0.02)' }}>
          <span style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '13px' }}>Volume</span>
          <span style={{ color: '#fff', fontSize: '13px', fontWeight: '600' }}>
            {safeToFixed(tech.volumeRatio, 1)}x avg
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(255, 255, 255, 0.02)' }}>
          <span style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '13px' }}>52-Week Range</span>
          <span style={{ color: '#fff', fontSize: '13px', fontWeight: '600' }}>
            ${fundamentals.low52w} - ${fundamentals.high52w}
          </span>
        </div>
      </div>

      {/* Support / Current / Resistance */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '16px' }}>
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', borderRadius: '10px', padding: '12px', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          <div style={{ color: '#ef4444', fontSize: '10px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Support</div>
          <div style={{ color: '#fff', fontSize: '16px', fontWeight: '700', fontFamily: 'monospace' }}>${safeToFixed(tech.support, 2)}</div>
        </div>
        <div style={{ background: 'rgba(0, 217, 255, 0.1)', borderRadius: '10px', padding: '12px', textAlign: 'center', border: '1px solid rgba(0, 217, 255, 0.2)' }}>
          <div style={{ color: '#00d9ff', fontSize: '10px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Current</div>
          <div style={{ color: '#fff', fontSize: '16px', fontWeight: '700', fontFamily: 'monospace' }}>${safeToFixed(tech.currentPrice, 2)}</div>
        </div>
        <div style={{ background: 'rgba(34, 197, 94, 0.1)', borderRadius: '10px', padding: '12px', textAlign: 'center', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
          <div style={{ color: '#22c55e', fontSize: '10px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Resistance</div>
          <div style={{ color: '#fff', fontSize: '16px', fontWeight: '700', fontFamily: 'monospace' }}>${safeToFixed(tech.resistance, 2)}</div>
        </div>
      </div>

      {/* Trading Signals Section */}
      <div style={{ marginTop: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <div style={{ background: 'rgba(0, 217, 255, 0.15)', padding: '6px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00d9ff" strokeWidth="2">
              <path d="M3 3v18h18" />
              <path d="M18 17V9" />
              <path d="M13 17V5" />
              <path d="M8 17v-3" />
            </svg>
          </div>
          <span style={{ fontWeight: '700', color: '#fff', fontSize: '12px', letterSpacing: '0.5px' }}>TRADING SIGNALS</span>
        </div>

        {/* 7-Day Trend Chart */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '10px',
            padding: '14px',
            marginBottom: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '12px' }}>7-Day Trend</span>
            <span style={{ color: tech.trend7Day >= 0 ? '#22c55e' : '#ef4444', fontWeight: '700', fontSize: '13px' }}>
              {tech.trend7Day >= 0 ? '+' : ''}{safeToFixed(tech.trend7Day, 2)}%
            </span>
          </div>
          <svg width="100%" height="50" viewBox="0 0 100 80" preserveAspectRatio="none">
            <defs>
              <linearGradient id="sparklineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={tech.trend7Day >= 0 ? '#22c55e' : '#ef4444'} stopOpacity="0.3" />
                <stop offset="100%" stopColor={tech.trend7Day >= 0 ? '#22c55e' : '#ef4444'} stopOpacity="0" />
              </linearGradient>
            </defs>
            <polygon
              points={`0,80 ${generateSparkline()} 100,80`}
              fill="url(#sparklineGradient)"
            />
            <polyline
              points={generateSparkline()}
              fill="none"
              stroke={tech.trend7Day >= 0 ? '#22c55e' : '#ef4444'}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Today / Volume / Momentum boxes */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
            <div style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '10px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>TODAY</div>
            <div style={{ color: tech.todayChange >= 0 ? '#22c55e' : '#ef4444', fontSize: '15px', fontWeight: '700' }}>
              {tech.todayChange >= 0 ? '+' : ''}{safeToFixed(tech.todayChange, 2)}%
            </div>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
            <div style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '10px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>VOLUME</div>
            <div style={{ color: '#fff', fontSize: '15px', fontWeight: '700' }}>{safeToFixed(tech.volumeRatio, 1)}x</div>
            <div style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '10px' }}>
              {tech.volumeRatio > 1.3 ? 'High' : tech.volumeRatio < 0.7 ? 'Low' : 'Normal'}
            </div>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
            <div style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '10px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>MOMENTUM</div>
            <div style={{
              color: tech.momentum === 'bullish' ? '#22c55e' : tech.momentum === 'bearish' ? '#ef4444' : 'rgba(255, 255, 255, 0.5)',
              fontSize: '15px',
              fontWeight: '700'
            }}>
              {tech.momentum === 'bullish' ? '\u25B2' : tech.momentum === 'bearish' ? '\u25BC' : '\u2014'}
            </div>
            <div style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '10px', textTransform: 'capitalize' }}>{tech.momentum}</div>
          </div>
        </div>
      </div>

      {/* Quick Take */}
      {tech.quickTake && (
        <div
          style={{
            marginTop: '16px',
            background: 'rgba(245, 158, 11, 0.08)',
            borderLeft: '3px solid #f59e0b',
            borderRadius: '0 10px 10px 0',
            padding: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <span style={{ fontSize: '14px' }}>&#x1F916;</span>
            <span style={{ color: '#f59e0b', fontWeight: '700', fontSize: '11px', letterSpacing: '0.5px' }}>QUICK TAKE</span>
          </div>
          <p style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: '13px', margin: 0, lineHeight: '1.5' }}>{tech.quickTake}</p>
        </div>
      )}
    </div>
  );
};

export default TechnicalAnalysisTab;
