import React, { useState } from 'react';
import FundamentalNews from '../Research/FundamentalNews';

/**
 * AssetResearchModal - Detailed asset research view for draft room
 *
 * Shows comprehensive asset information with AI Analysis:
 * - Stock hero section (symbol, name, price, change)
 * - AI Analysis with Fundamental/Technical/News tabs
 * - Key metrics: Market Cap, P/E Ratio, Revenue Growth, Profit Margin
 * - Strengths & Weaknesses
 * - Real-time news from EODHD API
 * - Draft-specific acquire action
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

const AssetResearchModal = ({
  asset,
  sector,
  category,
  isMyTurn = false,
  canPick = false,
  onAcquire,
  onClose,
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
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.9)',
        backdropFilter: 'blur(8px)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '500px',
          maxHeight: '90vh',
          background: '#0a0e14',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
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
            <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
              <button
                onClick={() => setActiveTab('fundamental')}
                style={{
                  flex: 1,
                  padding: '10px 8px',
                  borderRadius: '8px',
                  border: 'none',
                  background: activeTab === 'fundamental' ? '#00d9ff' : 'rgba(255, 255, 255, 0.05)',
                  color: activeTab === 'fundamental' ? '#000' : 'rgba(255, 255, 255, 0.6)',
                  fontWeight: '600',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  transition: 'all 0.2s',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M9 9h6v6H9z" />
                </svg>
                Analysis
              </button>
              <button
                onClick={() => setActiveTab('technical')}
                style={{
                  flex: 1,
                  padding: '10px 8px',
                  borderRadius: '8px',
                  border: 'none',
                  background: activeTab === 'technical' ? '#00d9ff' : 'rgba(255, 255, 255, 0.05)',
                  color: activeTab === 'technical' ? '#000' : 'rgba(255, 255, 255, 0.6)',
                  fontWeight: '600',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  transition: 'all 0.2s',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
                Technical
              </button>
              <button
                onClick={() => setActiveTab('news')}
                style={{
                  flex: 1,
                  padding: '10px 8px',
                  borderRadius: '8px',
                  border: 'none',
                  background: activeTab === 'news' ? '#00d9ff' : 'rgba(255, 255, 255, 0.05)',
                  color: activeTab === 'news' ? '#000' : 'rgba(255, 255, 255, 0.6)',
                  fontWeight: '600',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  transition: 'all 0.2s',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
              <div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '12px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: '8px',
                    }}
                  >
                    <span style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '13px' }}>52-Week Range</span>
                    <span style={{ color: '#ffffff', fontWeight: '600', fontSize: '13px' }}>
                      ${fundamentals.low52w} - ${fundamentals.high52w}
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '12px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: '8px',
                    }}
                  >
                    <span style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '13px' }}>Beta</span>
                    <span style={{ color: '#ffffff', fontWeight: '600', fontSize: '13px' }}>
                      {fundamentals.beta}
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '12px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: '8px',
                    }}
                  >
                    <span style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '13px' }}>Avg Volume</span>
                    <span style={{ color: '#ffffff', fontWeight: '600', fontSize: '13px' }}>
                      {fundamentals.avgVolume}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'news' && (
              <div style={{ marginTop: '-10px' }}>
                <FundamentalNews symbol={asset.symbol} />
              </div>
            )}
          </div>
        </div>

        {/* Action Button */}
        {isMyTurn && canPick && onAcquire && (
          <div
            style={{
              padding: '20px',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <button
              onClick={() => {
                onAcquire(asset);
                onClose();
              }}
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                background: 'linear-gradient(180deg, #00d9ff 0%, #0ea5e9 100%)',
                color: '#000',
                border: 'none',
                letterSpacing: '1px',
                textTransform: 'uppercase',
                boxShadow: '0 0 20px rgba(0, 217, 255, 0.3)',
              }}
            >
              ACQUIRE {asset.symbol}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AssetResearchModal;
