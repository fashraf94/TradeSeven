// /src/components/Research/FundamentalNews.jsx

import React, { useState, useEffect } from 'react';
import { getStockNews } from '../../services/eodhdAPI';
import StyledIcon from '../shared/StyledIcon';

/**
 * FundamentalNews - Fetches real stock news and makes articles clickable
 * Opens full articles in new tab with hover effects
 *
 * @param {Object} props
 * @param {string} props.symbol - Stock symbol to fetch news for
 * @param {Object} props.colors - Design tokens
 */
const FundamentalNews = ({ symbol, colors }) => {
  const [news, setNews] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredCard, setHoveredCard] = useState(null);

  const sentimentColors = {
    positive: { bg: 'rgba(34, 197, 94, 0.1)', border: '#22c55e', dot: '#22c55e' },
    negative: { bg: 'rgba(239, 68, 68, 0.1)', border: '#ef4444', dot: '#ef4444' },
    neutral: { bg: 'rgba(139, 92, 246, 0.1)', border: '#8b5cf6', dot: '#8b5cf6' }
  };

  // Helper to calculate time ago
  const getTimeAgo = (dateString) => {
    if (!dateString) return 'Recently';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return '1d ago';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Determine sentiment from title keywords
  const getSentiment = (title, apiSentiment) => {
    if (apiSentiment) return apiSentiment;
    const lowerTitle = (title || '').toLowerCase();
    const positiveWords = ['surge', 'rise', 'gain', 'beat', 'record', 'growth', 'rally', 'soar', 'jump', 'high'];
    const negativeWords = ['fall', 'drop', 'decline', 'miss', 'cut', 'loss', 'plunge', 'crash', 'low', 'concern'];

    if (positiveWords.some(w => lowerTitle.includes(w))) return 'positive';
    if (negativeWords.some(w => lowerTitle.includes(w))) return 'negative';
    return 'neutral';
  };

  useEffect(() => {
    const fetchNews = async () => {
      if (!symbol) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const newsData = await getStockNews(symbol, 8);
        setNews(newsData || []);
      } catch (err) {
        console.error('[FundamentalNews] Error:', err);
        setNews([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNews();
  }, [symbol]);

  const handleCardClick = (url) => {
    if (url && url !== '#') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  if (isLoading) {
    return (
      <div style={{
        background: '#161b22',
        border: '1px solid #21262d',
        borderRadius: '16px',
        padding: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <StyledIcon type="news" size="small" />
          <h3 style={{ color: '#ffffff', fontSize: '15px', fontWeight: '700', margin: 0 }}>
            LATEST NEWS
          </h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '20px', background: '#0d1117', borderRadius: '12px' }}>
          <div style={{
            width: '20px',
            height: '20px',
            border: '2px solid #8b5cf6',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <span style={{ color: '#8b949e', fontSize: '14px' }}>Loading news for {symbol}...</span>
        </div>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (news.length === 0) {
    return (
      <div style={{
        background: '#161b22',
        border: '1px solid #21262d',
        borderRadius: '16px',
        padding: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <StyledIcon type="news" size="small" />
          <h3 style={{ color: '#ffffff', fontSize: '15px', fontWeight: '700', margin: 0 }}>
            LATEST NEWS
          </h3>
        </div>
        <div style={{ padding: '20px', background: '#0d1117', borderRadius: '12px', textAlign: 'center' }}>
          <span style={{ color: '#8b949e', fontSize: '14px' }}>No recent news for {symbol}</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: '#161b22',
      border: '1px solid #21262d',
      borderRadius: '16px',
      padding: '20px'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '16px'
      }}>
        <StyledIcon type="news" size="small" />
        <h3 style={{ color: '#ffffff', fontSize: '15px', fontWeight: '700', margin: 0 }}>
          LATEST NEWS
        </h3>
        <span style={{ marginLeft: 'auto', color: '#8b949e', fontSize: '11px' }}>
          {symbol} related
        </span>
      </div>

      {/* News Items - Always show 4 articles */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {news.slice(0, 4).map((item, index) => {
          const sentiment = getSentiment(item.title, item.sentiment);
          const itemColors = sentimentColors[sentiment] || sentimentColors.neutral;
          const isHovered = hoveredCard === index;
          const hasUrl = item.url && item.url !== '#';

          return (
            <div
              key={item.id || index}
              onClick={() => handleCardClick(item.url)}
              onMouseEnter={() => setHoveredCard(index)}
              onMouseLeave={() => setHoveredCard(null)}
              style={{
                background: isHovered ? 'rgba(255, 255, 255, 0.05)' : itemColors.bg,
                borderLeft: `3px solid ${itemColors.border}`,
                borderRadius: '0 10px 10px 0',
                padding: '14px 16px',
                cursor: hasUrl ? 'pointer' : 'default',
                transition: 'all 0.2s ease',
                transform: isHovered ? 'scale(1.01)' : 'scale(1)',
                position: 'relative'
              }}
            >
              {/* External Link Icon */}
              {hasUrl && (
                <div style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  opacity: isHovered ? 1 : 0.5,
                  transition: 'opacity 0.2s ease'
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={itemColors.dot} strokeWidth="2">
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                    <polyline points="15,3 21,3 21,9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                </div>
              )}

              {/* Source & Time */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '6px'
              }}>
                <span style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: itemColors.dot
                }} />
                <span style={{
                  color: itemColors.dot,
                  fontSize: '10px',
                  fontWeight: '600',
                  textTransform: 'uppercase'
                }}>
                  {item.source || 'News'}
                </span>
                <span style={{ color: '#6b7280', fontSize: '10px' }}>
                  • {getTimeAgo(item.publishedAt)}
                </span>
              </div>

              {/* Headline */}
              <h4 style={{
                color: '#e6edf3',
                fontSize: '13px',
                fontWeight: '600',
                margin: 0,
                lineHeight: '1.4',
                paddingRight: hasUrl ? '24px' : '0'
              }}>
                {item.title}
              </h4>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FundamentalNews;
