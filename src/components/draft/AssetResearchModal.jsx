import React, { useState } from 'react';
import FundamentalNews from '../Research/FundamentalNews';
import LatestEarningsReport from '../Research/LatestEarningsReport';

/**
 * AssetResearchModal - Detailed asset research view (reusable across screens)
 *
 * Shows comprehensive asset information with AI Analysis:
 * - Stock hero section (symbol, name, price, change)
 * - AI Analysis with Fundamental/Technical/News tabs
 * - Key metrics: Market Cap, P/E Ratio, Revenue Growth, Profit Margin
 * - Strengths & Weaknesses
 * - Real-time news from EODHD API
 * - Flexible action button (draft acquire, custom actions, or research-only mode)
 *
 * Props:
 * - asset: { symbol, name, price, percentChange?, change?, sector? }
 * - sector: string (for sector badge color)
 * - category: 'steady' | 'risky' | 'defensive' (optional, for draft context)
 * - isMyTurn: boolean (default: false) - shows ON THE CLOCK alert
 * - timeRemaining: number (default: 0) - seconds remaining in draft
 * - canPick: boolean (default: false) - enables acquire button in draft
 * - onAcquire: (asset) => void (optional) - acquire handler for draft
 * - onClose: () => void - close handler
 * - actionConfig: { label, onClick, variant, disabled? } (optional) - custom action button
 *   - variant: 'primary' | 'danger' | 'secondary'
 * - showActionButton: boolean (default: true) - show/hide action section
 */

// Sector color definitions
const SECTOR_COLORS = {
  'Technology': '#3b82f6',
  'Information Technology': '#3b82f6',
  'Energy': '#ef4444',
  'Healthcare': '#14b8a6',
  'Health Care': '#14b8a6',
  'Financials': '#22c55e',
  'Financial Services': '#22c55e',
  'Consumer Cyclical': '#a855f7',
  'Consumer Discretionary': '#a855f7',
  'Consumer Defensive': '#ec4899',
  'Consumer Staples': '#ec4899',
  'Industrials': '#f59e0b',
  'Basic Materials': '#f97316',
  'Materials': '#f97316',
  'Real Estate': '#6366f1',
  'Utilities': '#64748b',
  'Communication Services': '#06b6d4',
  'Cryptocurrency': '#fbbf24',
  'default': '#00d9ff'
};

// Mock fundamental data (in production, fetch from API)
const getMockFundamentals = (symbol) => {
  const defaults = {
    marketCap: '$500B',
    peRatio: '25x',
    revenueGrowth: '+15%',
    profitMargin: '20%',
    rating: 'Buy',
    strengths: ['Strong market position', 'Growing revenue', 'Solid fundamentals'],
    weaknesses: ['Valuation concerns', 'Market competition', 'Economic sensitivity'],
    low52w: 100,
    high52w: 200,
    beta: 1.2,
    avgVolume: '10M'
  };

  // Custom data for popular stocks
  const stockData = {
    'AAPL': { marketCap: '$3.0T', peRatio: '30x', revenueGrowth: '+8%', profitMargin: '25%', rating: 'Strong Buy', low52w: 164, high52w: 199, strengths: ['Strong ecosystem', 'Brand loyalty', 'Services growth'], weaknesses: ['iPhone dependency', 'China exposure', 'Premium pricing'] },
    'MSFT': { marketCap: '$2.9T', peRatio: '35x', revenueGrowth: '+15%', profitMargin: '36%', rating: 'Strong Buy', low52w: 309, high52w: 430, strengths: ['Cloud dominance', 'AI integration', 'Enterprise strength'], weaknesses: ['Gaming struggles', 'Regulatory scrutiny', 'Valuation'] },
    'GOOGL': { marketCap: '$2.0T', peRatio: '25x', revenueGrowth: '+12%', profitMargin: '24%', rating: 'Buy', low52w: 120, high52w: 180, strengths: ['Search dominance', 'YouTube growth', 'Cloud expansion'], weaknesses: ['Ad market risks', 'Antitrust concerns', 'AI competition'] },
    'AMZN': { marketCap: '$1.9T', peRatio: '60x', revenueGrowth: '+11%', profitMargin: '7%', rating: 'Buy', low52w: 118, high52w: 201, strengths: ['AWS leadership', 'E-commerce scale', 'Prime ecosystem'], weaknesses: ['Thin retail margins', 'Labor costs', 'Competition'] },
    'NVDA': { marketCap: '$1.2T', peRatio: '65x', revenueGrowth: '+122%', profitMargin: '55%', rating: 'Strong Buy', low52w: 108, high52w: 505, strengths: ['AI chip dominance', 'Data center growth', 'CUDA ecosystem'], weaknesses: ['Concentration risk', 'Competition', 'Valuation'] },
    'TSLA': { marketCap: '$800B', peRatio: '70x', revenueGrowth: '+19%', profitMargin: '11%', rating: 'Hold', low52w: 138, high52w: 299, strengths: ['EV leadership', 'Manufacturing scale', 'Energy business'], weaknesses: ['Competition growing', 'Execution risks', 'Valuation premium'] },
    'META': { marketCap: '$1.3T', peRatio: '28x', revenueGrowth: '+23%', profitMargin: '29%', rating: 'Buy', low52w: 274, high52w: 531, strengths: ['User engagement', 'Ad efficiency', 'AI investment'], weaknesses: ['Metaverse losses', 'Privacy concerns', 'Competition'] },
    'JPM': { marketCap: '$550B', peRatio: '11x', revenueGrowth: '+8%', profitMargin: '33%', rating: 'Buy', low52w: 135, high52w: 200, strengths: ['Scale advantage', 'Diverse revenue', 'Strong management'], weaknesses: ['Rate sensitivity', 'Regulatory burden', 'Credit risk'] }
  };

  return { ...defaults, ...(stockData[symbol] || {}) };
};

// Helper function for safe number formatting
const safeToFixed = (value, decimals = 2) => {
  if (value === undefined || value === null || isNaN(value)) {
    return decimals === 0 ? '0' : '0.' + '0'.repeat(decimals);
  }
  return Number(value).toFixed(decimals);
};

// Mock technical data (in production, fetch from API)
const getMockTechnicalData = (symbol, price) => {
  const safePrice = price || 100; // Default to 100 if price is undefined
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

  // Custom technical data for popular stocks
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

  // Calculate support/resistance based on current price
  if (price) {
    data.currentPrice = price;
    data.support = price * (1 - Math.abs(data.vs50DayMA || 5) / 100);
    data.resistance = price * (1 + Math.abs(data.vs50DayMA || 5) / 100);
  }

  return data;
};

/**
 * TechnicalAnalysisTab - Comprehensive technical analysis display
 */
const TechnicalAnalysisTab = ({ asset, fundamentals }) => {
  const tech = getMockTechnicalData(asset.symbol, asset.price);

  // Determine status based on RSI and MACD
  const getStatus = () => {
    if (tech.rsi > 70) return { text: 'Overbought', color: '#ef4444', icon: '↑' };
    if (tech.rsi < 30) return { text: 'Oversold', color: '#22c55e', icon: '↓' };
    if (tech.macdSignal === 'bullish') return { text: 'Bullish', color: '#22c55e', icon: '↑' };
    if (tech.macdSignal === 'bearish') return { text: 'Bearish', color: '#ef4444', icon: '↓' };
    return { text: 'Consolidating', color: '#f59e0b', icon: '→' };
  };

  const status = getStatus();

  // Generate mini sparkline for 7-day trend
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
        {/* MACD Signal */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(255, 255, 255, 0.02)' }}>
          <span style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '13px' }}>MACD Signal</span>
          <span style={{
            color: tech.macdSignal === 'bullish' ? '#22c55e' : tech.macdSignal === 'bearish' ? '#ef4444' : 'rgba(255, 255, 255, 0.5)',
            fontSize: '13px',
            fontWeight: '600'
          }}>
            {tech.macdSignal === 'bullish' ? '▲ Bullish Cross' : tech.macdSignal === 'bearish' ? '▼ Bearish Cross' : '— Neutral'}
          </span>
        </div>

        {/* vs 50-Day MA */}
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

        {/* Volume */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(255, 255, 255, 0.02)' }}>
          <span style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '13px' }}>Volume</span>
          <span style={{ color: '#fff', fontSize: '13px', fontWeight: '600' }}>
            {safeToFixed(tech.volumeRatio, 1)}x avg
          </span>
        </div>

        {/* 52-Week Range */}
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
          {/* Mini sparkline chart */}
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
              {tech.momentum === 'bullish' ? '▲' : tech.momentum === 'bearish' ? '▼' : '—'}
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
            <span style={{ fontSize: '14px' }}>🤖</span>
            <span style={{ color: '#f59e0b', fontWeight: '700', fontSize: '11px', letterSpacing: '0.5px' }}>QUICK TAKE</span>
          </div>
          <p style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: '13px', margin: 0, lineHeight: '1.5' }}>{tech.quickTake}</p>
        </div>
      )}
    </div>
  );
};

const AssetResearchModal = ({
  asset,
  sector,
  category,
  // Draft-specific props - optional with safe defaults
  isMyTurn = false,
  timeRemaining = 0,
  canPick = false,
  onAcquire = null,
  onClose,
  // Flexible action button configuration
  // actionConfig: { label: string, onClick: fn, variant: 'primary'|'danger'|'secondary', disabled?: boolean }
  actionConfig = null,
  showActionButton = true,
}) => {
  const [activeTab, setActiveTab] = useState('fundamental');

  if (!asset) return null;

  const sectorColor = SECTOR_COLORS[sector] || SECTOR_COLORS.default;
  const fundamentals = getMockFundamentals(asset.symbol);
  const priceChange = asset.percentChange || asset.change || 0;

  const ratingColor = fundamentals.rating?.includes('Strong') ? '#10b981' :
    fundamentals.rating === 'Buy' ? '#00d9ff' :
    fundamentals.rating === 'Hold' ? '#f59e0b' : '#ef4444';

  // Category colors
  const categoryColors = {
    steady: { bg: 'rgba(16, 185, 129, 0.2)', color: '#10b981', border: 'rgba(16, 185, 129, 0.4)' },
    risky: { bg: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', border: 'rgba(245, 158, 11, 0.4)' },
    defensive: { bg: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6', border: 'rgba(59, 130, 246, 0.4)' },
  };
  const catStyle = categoryColors[category] || categoryColors.steady;

  return (
    <>
      {/* Backdrop - separate fixed element */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 9998,
        }}
      />

      {/* Modal - separate fixed element, centered */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(calc(100vw - 40px), 480px)',
          maxHeight: 'calc(100vh - 40px)',
          background: '#0d1117',
          borderRadius: '16px',
          border: '1px solid rgba(0, 255, 255, 0.3)',
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5), 0 0 40px rgba(0, 255, 255, 0.15)',
          zIndex: 9999,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* ON THE CLOCK Alert - Shows when it's user's turn */}
        {isMyTurn && (
          <div
            className={timeRemaining <= 15 ? 'on-the-clock-urgent' : 'on-the-clock-alert'}
            style={{
              background: timeRemaining <= 15
                ? 'linear-gradient(90deg, #ef4444, #dc2626)'
                : 'linear-gradient(90deg, #ff9500, #ff6b00)',
              padding: '12px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px' }}>{timeRemaining <= 15 ? '🚨' : '⏰'}</span>
              <div>
                <div style={{
                  fontWeight: 'bold',
                  color: timeRemaining <= 15 ? '#fff' : '#000',
                  fontSize: '14px',
                }}>
                  {timeRemaining <= 15 ? 'HURRY! TIME ALMOST UP!' : "YOU'RE ON THE CLOCK!"}
                </div>
                <div style={{
                  color: timeRemaining <= 15 ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.7)',
                  fontSize: '12px',
                }}>
                  Make your pick before time runs out
                </div>
              </div>
            </div>

            {/* Time remaining */}
            <div style={{
              background: timeRemaining <= 15 ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.2)',
              padding: '8px 16px',
              borderRadius: '8px',
              fontWeight: 'bold',
              color: timeRemaining <= 15 ? '#fff' : '#000',
              fontSize: '18px',
              fontFamily: 'monospace',
              minWidth: '60px',
              textAlign: 'center',
            }}>
              {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, '0')}
            </div>
          </div>
        )}

        {/* CSS for ON THE CLOCK animations */}
        <style>{`
          @keyframes pulse-alert {
            0%, 100% {
              box-shadow: 0 0 0 0 rgba(255, 149, 0, 0.7);
            }
            50% {
              box-shadow: 0 0 0 8px rgba(255, 149, 0, 0);
            }
          }

          @keyframes pulse-urgent {
            0%, 100% {
              box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.8);
            }
            50% {
              box-shadow: 0 0 0 10px rgba(239, 68, 68, 0);
            }
          }

          .on-the-clock-alert {
            animation: pulse-alert 1.5s ease-in-out infinite;
          }

          .on-the-clock-urgent {
            animation: pulse-urgent 0.5s ease-in-out infinite;
          }

          @media (prefers-reduced-motion: reduce) {
            .on-the-clock-alert,
            .on-the-clock-urgent {
              animation: none !important;
            }
          }
        `}</style>

        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            flexShrink: 0,
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#00d9ff',
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Back
          </button>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.4)',
              cursor: 'pointer',
              padding: '4px',
              fontSize: '20px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable Content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Stock Hero Section */}
          <div
            style={{
              padding: '24px',
              margin: '16px',
              background: `linear-gradient(180deg, ${sectorColor}15 0%, transparent 100%)`,
              border: `1px solid ${sectorColor}40`,
              borderRadius: '16px',
              textAlign: 'center',
            }}
          >
            <h1
              style={{
                fontSize: '32px',
                fontWeight: '800',
                color: '#ffffff',
                margin: 0,
                textShadow: `0 0 20px ${sectorColor}40`,
              }}
            >
              {asset.symbol}
            </h1>
            <p
              style={{
                color: 'rgba(255, 255, 255, 0.6)',
                margin: '4px 0 0',
                fontSize: '14px',
              }}
            >
              {asset.name}
            </p>

            {/* Sector Badge */}
            {sector && (
              <div
                style={{
                  display: 'inline-block',
                  marginTop: '8px',
                  padding: '4px 12px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: '600',
                  background: `${sectorColor}20`,
                  color: sectorColor,
                  border: `1px solid ${sectorColor}40`,
                }}
              >
                {sector}
              </div>
            )}

            <div
              style={{
                fontSize: '36px',
                fontWeight: '700',
                color: '#ffffff',
                margin: '16px 0 8px',
                fontFamily: 'monospace',
              }}
            >
              ${asset.price?.toFixed(2) || '—'}
            </div>
            <div
              style={{
                display: 'inline-block',
                padding: '8px 16px',
                borderRadius: '20px',
                fontSize: '14px',
                fontWeight: '600',
                background: priceChange >= 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                color: priceChange >= 0 ? '#10b981' : '#ef4444',
              }}
            >
              {priceChange >= 0 ? '▲' : '▼'} {Math.abs(priceChange)?.toFixed(2)}% today
            </div>
          </div>

          {/* Draft Category Section */}
          {category && (
            <div
              style={{
                padding: '16px 20px',
                margin: '0 16px 16px',
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '13px' }}>Draft Category</span>
              <span
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  background: catStyle.bg,
                  color: catStyle.color,
                  border: `1px solid ${catStyle.border}`,
                }}
              >
                {category}
              </span>
            </div>
          )}

          {/* AI Analysis Section */}
          <div
            style={{
              padding: '20px',
              margin: '0 16px 16px',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '16px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '16px',
                color: '#ffffff',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3v18h18" />
                <path d="M18 17V9" />
                <path d="M13 17V5" />
                <path d="M8 17v-3" />
              </svg>
              <h2 style={{ fontSize: '14px', fontWeight: '700', letterSpacing: '0.5px', margin: 0 }}>
                AI ANALYSIS
              </h2>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
              <button
                onClick={() => setActiveTab('fundamental')}
                style={{
                  flex: 1,
                  padding: '10px 6px',
                  borderRadius: '8px',
                  border: 'none',
                  background: activeTab === 'fundamental' ? '#00d9ff' : 'rgba(255, 255, 255, 0.05)',
                  color: activeTab === 'fundamental' ? '#000' : 'rgba(255, 255, 255, 0.6)',
                  fontWeight: '600',
                  fontSize: '11px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '3px',
                  transition: 'all 0.2s',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M9 9h6v6H9z" />
                </svg>
                Analysis
              </button>
              <button
                onClick={() => setActiveTab('earnings')}
                style={{
                  flex: 1,
                  padding: '10px 6px',
                  borderRadius: '8px',
                  border: 'none',
                  background: activeTab === 'earnings' ? '#8b5cf6' : 'rgba(255, 255, 255, 0.05)',
                  color: activeTab === 'earnings' ? '#fff' : 'rgba(255, 255, 255, 0.6)',
                  fontWeight: '600',
                  fontSize: '11px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '3px',
                  transition: 'all 0.2s',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <polyline points="14,2 14,8 20,8"/>
                </svg>
                Earnings
              </button>
              <button
                onClick={() => setActiveTab('technical')}
                style={{
                  flex: 1,
                  padding: '10px 6px',
                  borderRadius: '8px',
                  border: 'none',
                  background: activeTab === 'technical' ? '#00d9ff' : 'rgba(255, 255, 255, 0.05)',
                  color: activeTab === 'technical' ? '#000' : 'rgba(255, 255, 255, 0.6)',
                  fontWeight: '600',
                  fontSize: '11px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '3px',
                  transition: 'all 0.2s',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
                Technical
              </button>
              <button
                onClick={() => setActiveTab('news')}
                style={{
                  flex: 1,
                  padding: '10px 6px',
                  borderRadius: '8px',
                  border: 'none',
                  background: activeTab === 'news' ? '#00d9ff' : 'rgba(255, 255, 255, 0.05)',
                  color: activeTab === 'news' ? '#000' : 'rgba(255, 255, 255, 0.6)',
                  fontWeight: '600',
                  fontSize: '11px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '3px',
                  transition: 'all 0.2s',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1m2 13a2 2 0 0 1-2-2V7m2 13a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2" />
                </svg>
                News
              </button>
            </div>

            {activeTab === 'fundamental' && (
              <div>
                {/* Rating */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '16px',
                  }}
                >
                  <span style={{ color: ratingColor, fontWeight: '600', fontSize: '14px' }}>
                    ● {fundamentals.rating}
                  </span>
                </div>

                {/* Metrics Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '12px',
                    marginBottom: '16px',
                  }}
                >
                  {/* Market Cap */}
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: '12px',
                      padding: '16px',
                      textAlign: 'center',
                    }}
                  >
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(59, 130, 246, 0.2)',
                        margin: '0 auto 8px',
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <path d="M9 9h6v6H9z" />
                      </svg>
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: '#ffffff' }}>
                      {fundamentals.marketCap}
                    </div>
                    <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Market Cap
                    </div>
                  </div>

                  {/* P/E Ratio */}
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: '12px',
                      padding: '16px',
                      textAlign: 'center',
                    }}
                  >
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(139, 92, 246, 0.2)',
                        margin: '0 auto 8px',
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2">
                        <path d="M3 3v18h18" />
                        <path d="M18 17V9" />
                        <path d="M13 17V5" />
                        <path d="M8 17v-3" />
                      </svg>
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: '#ffffff' }}>
                      {fundamentals.peRatio}
                    </div>
                    <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      P/E Ratio
                    </div>
                  </div>

                  {/* Revenue Growth */}
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: '12px',
                      padding: '16px',
                      textAlign: 'center',
                    }}
                  >
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(16, 185, 129, 0.2)',
                        margin: '0 auto 8px',
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                        <line x1="12" y1="1" x2="12" y2="23" />
                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                      </svg>
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: '#10b981' }}>
                      {fundamentals.revenueGrowth}
                    </div>
                    <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Revenue Growth
                    </div>
                  </div>

                  {/* Profit Margin */}
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: '12px',
                      padding: '16px',
                      textAlign: 'center',
                    }}
                  >
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(245, 158, 11, 0.2)',
                        margin: '0 auto 8px',
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
                        <line x1="19" y1="5" x2="5" y2="19" />
                        <circle cx="6.5" cy="6.5" r="2.5" />
                        <circle cx="17.5" cy="17.5" r="2.5" />
                      </svg>
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: '#f59e0b' }}>
                      {fundamentals.profitMargin}
                    </div>
                    <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Profit Margin
                    </div>
                  </div>
                </div>

                {/* Strengths & Weaknesses */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontWeight: '600',
                        fontSize: '13px',
                        marginBottom: '12px',
                        color: '#10b981',
                      }}
                    >
                      <span>✓</span>
                      STRENGTHS
                    </div>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {fundamentals.strengths.map((s, i) => (
                        <li
                          key={i}
                          style={{
                            padding: '8px 12px',
                            marginBottom: '8px',
                            borderRadius: '8px',
                            fontSize: '12px',
                            color: 'rgba(255, 255, 255, 0.8)',
                            background: 'rgba(16, 185, 129, 0.1)',
                            borderLeft: '3px solid #10b981',
                          }}
                        >
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontWeight: '600',
                        fontSize: '13px',
                        marginBottom: '12px',
                        color: '#ef4444',
                      }}
                    >
                      <span>✗</span>
                      WEAKNESSES
                    </div>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {fundamentals.weaknesses.map((w, i) => (
                        <li
                          key={i}
                          style={{
                            padding: '8px 12px',
                            marginBottom: '8px',
                            borderRadius: '8px',
                            fontSize: '12px',
                            color: 'rgba(255, 255, 255, 0.8)',
                            background: 'rgba(239, 68, 68, 0.1)',
                            borderLeft: '3px solid #ef4444',
                          }}
                        >
                          {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'technical' && (
              <TechnicalAnalysisTab asset={asset} fundamentals={fundamentals} />
            )}

            {activeTab === 'earnings' && (
              <div style={{ marginTop: '-10px' }}>
                <LatestEarningsReport symbol={asset.symbol} />
              </div>
            )}

            {activeTab === 'news' && (
              <div style={{ marginTop: '-10px' }}>
                <FundamentalNews symbol={asset.symbol} />
              </div>
            )}
          </div>
        </div>

        {/* Action Button Section - Flexible Configuration */}
        {showActionButton && (
          <div
            style={{
              padding: '16px 20px',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              background: 'rgba(0, 0, 0, 0.3)',
              flexShrink: 0,
            }}
          >
            {/* Draft Mode: ON THE CLOCK - Original behavior */}
            {isMyTurn && canPick && onAcquire && (
              <button
                onClick={() => {
                  onAcquire(asset);
                  onClose();
                }}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: 'linear-gradient(135deg, rgba(0, 255, 136, 0.3) 0%, rgba(0, 255, 136, 0.1) 100%)',
                  border: '2px solid #00ff88',
                  borderRadius: '10px',
                  color: '#e6edf3',
                  fontWeight: 700,
                  fontSize: '15px',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                }}
              >
                Acquire {asset.symbol}
              </button>
            )}

            {/* Custom Action Button - New flexible option */}
            {!isMyTurn && actionConfig && (
              <button
                onClick={actionConfig.onClick}
                disabled={actionConfig.disabled}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: actionConfig.variant === 'danger'
                    ? 'linear-gradient(135deg, rgba(255, 51, 102, 0.3) 0%, rgba(255, 51, 102, 0.1) 100%)'
                    : actionConfig.variant === 'secondary'
                    ? 'transparent'
                    : 'linear-gradient(135deg, rgba(0, 255, 136, 0.3) 0%, rgba(0, 255, 136, 0.1) 100%)',
                  border: `2px solid ${
                    actionConfig.variant === 'danger'
                      ? '#ff3366'
                      : actionConfig.variant === 'secondary'
                      ? '#374151'
                      : '#00ff88'
                  }`,
                  borderRadius: '10px',
                  color: actionConfig.variant === 'secondary'
                    ? '#8b949e'
                    : '#e6edf3',
                  fontWeight: 700,
                  fontSize: '15px',
                  cursor: actionConfig.disabled ? 'not-allowed' : 'pointer',
                  opacity: actionConfig.disabled ? 0.5 : 1,
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  transition: 'all 0.2s ease',
                }}
              >
                {actionConfig.label}
              </button>
            )}

            {/* Research Only Mode - Just close button */}
            {!isMyTurn && !actionConfig && (
              <button
                onClick={onClose}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: 'transparent',
                  border: '1px solid #374151',
                  borderRadius: '10px',
                  color: '#8b949e',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                Close
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default AssetResearchModal;
