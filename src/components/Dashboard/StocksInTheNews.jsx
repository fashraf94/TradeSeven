// /src/components/Dashboard/StocksInTheNews.jsx

import React, { useState } from 'react';

/**
 * StocksInTheNews - Top movers with news-driven context
 * Replaces plain top movers with "why it's moving" explanations
 *
 * @param {Object} props
 * @param {Object} props.moversData - Object containing gainers and losers arrays
 * @param {boolean} props.isLoading - Loading state
 * @param {Object} props.colors - Design tokens
 */
const StocksInTheNews = ({ moversData, isLoading, colors }) => {
  const c = colors || { green: '#00ff88', red: '#ff4757', cyan: '#00d9ff' };
  const [hoveredCard, setHoveredCard] = useState(null);

  if (isLoading) {
    return (
      <div style={{
        background: '#1a1f2e',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '16px',
        border: '1px solid #2d3548',
      }}>
        <h3 style={{ color: '#8b949e', fontSize: '12px', textTransform: 'uppercase', marginBottom: '12px' }}>
          Stocks in the News
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{
              background: '#161b22',
              borderRadius: '8px',
              padding: '12px',
              animation: 'pulse 1.5s ease-in-out infinite',
            }}>
              <div style={{ height: '14px', background: '#2d3548', borderRadius: '4px', width: '60%' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!moversData || (!moversData.gainers?.length && !moversData.losers?.length)) {
    return null;
  }

  // Get the news URL for a stock
  const getNewsUrl = (stock) => {
    if (stock.news && stock.news.length > 0 && stock.news[0].url) {
      return stock.news[0].url;
    }
    return null;
  };

  // Get full headline (no truncation)
  const getFullHeadline = (stock) => {
    if (stock.news && stock.news.length > 0 && stock.news[0].title) {
      return stock.news[0].title;
    }
    return stock.reason || null;
  };

  const renderMover = (stock, isGainer, index) => {
    const newsUrl = getNewsUrl(stock);
    const fullHeadline = getFullHeadline(stock);
    const cardKey = `${stock.symbol}-${isGainer ? 'gain' : 'lose'}`;
    const isHovered = hoveredCard === cardKey;

    return (
      <div
        key={stock.symbol}
        onClick={() => newsUrl && window.open(newsUrl, '_blank')}
        onMouseEnter={() => setHoveredCard(cardKey)}
        onMouseLeave={() => setHoveredCard(null)}
        style={{
          position: 'relative',
          background: isHovered ? '#1e242f' : '#161b22',
          borderRadius: '8px',
          padding: '12px',
          borderLeft: `3px solid ${isGainer ? c.green : c.red}`,
          cursor: newsUrl ? 'pointer' : 'default',
          transition: 'all 0.2s ease',
          transform: isHovered && newsUrl ? 'translateX(2px)' : 'none',
        }}
      >
        {/* External link icon */}
        {newsUrl && (
          <div style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            opacity: isHovered ? 1 : 0.4,
            transition: 'opacity 0.2s',
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6e7681" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px', paddingRight: newsUrl ? '20px' : '0' }}>
          <div>
            <span style={{ color: '#e6edf3', fontWeight: '600', fontSize: '14px' }}>{stock.symbol}</span>
            <span style={{ color: '#6e7681', fontSize: '12px', marginLeft: '8px' }}>{stock.name}</span>
          </div>
          <span style={{
            color: isGainer ? c.green : c.red,
            fontWeight: '600',
            fontSize: '14px',
          }}>
            {isGainer ? '+' : ''}{stock.percentChange?.toFixed(2)}%
          </span>
        </div>
        {fullHeadline && (
          <div style={{
            color: isHovered ? '#e6edf3' : '#8b949e',
            fontSize: '12px',
            lineHeight: '1.5',
            transition: 'color 0.2s',
          }}>
            {fullHeadline}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{
      background: '#1a1f2e',
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '16px',
      border: '1px solid #2d3548',
    }}>
      <h3 style={{ color: '#8b949e', fontSize: '12px', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '14px' }}>📈</span> Stocks in the News
      </h3>

      {/* Gainers Section */}
      {moversData.gainers?.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ color: c.green, fontSize: '11px', textTransform: 'uppercase', marginBottom: '8px', fontWeight: '600' }}>
            Top Gainers
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {moversData.gainers.slice(0, 3).map((stock, idx) => renderMover(stock, true, idx))}
          </div>
        </div>
      )}

      {/* Losers Section */}
      {moversData.losers?.length > 0 && (
        <div>
          <div style={{ color: c.red, fontSize: '11px', textTransform: 'uppercase', marginBottom: '8px', fontWeight: '600' }}>
            Biggest Decliners
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {moversData.losers.slice(0, 3).map((stock, idx) => renderMover(stock, false, idx))}
          </div>
        </div>
      )}
    </div>
  );
};

export default StocksInTheNews;
