// /src/components/Dashboard/EconomicNews.jsx

import React, { useState } from 'react';

/**
 * EconomicNews - Displays economic/macro news filtered by keywords
 * Shows news about GDP, Fed, inflation, jobs, etc.
 *
 * @param {Object} props
 * @param {Array} props.news - Array of news items
 * @param {boolean} props.isLoading - Loading state
 * @param {Object} props.colors - Design tokens
 */
const EconomicNews = ({ news, isLoading, colors }) => {
  const c = colors || { green: '#00ff88', red: '#ff4757', cyan: '#00d9ff' };
  const amber = '#f59e0b';
  const [hoveredCard, setHoveredCard] = useState(null);

  // Economic keywords with weights for scoring
  const ECONOMIC_KEYWORDS = [
    // Federal Reserve / Monetary Policy (high priority)
    { pattern: /\bfed\b/i, weight: 3 },
    { pattern: /federal reserve/i, weight: 3 },
    { pattern: /fomc/i, weight: 3 },
    { pattern: /interest rate/i, weight: 3 },
    { pattern: /rate cut/i, weight: 3 },
    { pattern: /rate hike/i, weight: 3 },
    { pattern: /powell/i, weight: 2 },
    // Inflation
    { pattern: /\binflation\b/i, weight: 3 },
    { pattern: /\bcpi\b/i, weight: 3 },
    { pattern: /consumer price/i, weight: 3 },
    { pattern: /\bppi\b/i, weight: 2 },
    { pattern: /producer price/i, weight: 2 },
    // Employment
    { pattern: /jobs report/i, weight: 3 },
    { pattern: /unemployment/i, weight: 3 },
    { pattern: /\bpayroll/i, weight: 2 },
    { pattern: /labor market/i, weight: 2 },
    { pattern: /jobless claims/i, weight: 3 },
    { pattern: /nonfarm/i, weight: 2 },
    // GDP / Economy
    { pattern: /\bgdp\b/i, weight: 3 },
    { pattern: /gross domestic product/i, weight: 3 },
    { pattern: /recession/i, weight: 3 },
    { pattern: /economic growth/i, weight: 2 },
    { pattern: /\beconomy\b/i, weight: 1 },
    // Treasury / Bonds
    { pattern: /treasury/i, weight: 2 },
    { pattern: /bond yield/i, weight: 2 },
    { pattern: /10-year/i, weight: 2 },
    { pattern: /yield curve/i, weight: 2 },
    // Trade
    { pattern: /trade deficit/i, weight: 2 },
    { pattern: /\btariff/i, weight: 2 },
    // Other economic indicators
    { pattern: /housing starts/i, weight: 2 },
    { pattern: /retail sales/i, weight: 2 },
    { pattern: /consumer spending/i, weight: 2 },
    { pattern: /\bpmi\b/i, weight: 2 },
    { pattern: /manufacturing/i, weight: 1 },
    { pattern: /consumer confidence/i, weight: 2 },
  ];

  // Score an article based on economic keyword matches
  const scoreArticle = (article) => {
    const title = (article.title || '').toLowerCase();
    let score = 0;
    let matchedKeywords = [];

    for (const keyword of ECONOMIC_KEYWORDS) {
      if (keyword.pattern.test(title)) {
        score += keyword.weight;
        matchedKeywords.push(keyword.pattern.source);
      }
    }

    return { ...article, economicScore: score, matchedKeywords };
  };

  // Get filtered and scored economic news
  const getEconomicNews = () => {
    if (!news || news.length === 0) return [];

    // Score all articles
    const scoredNews = news.map(scoreArticle);

    // Filter to only articles with economic relevance (score > 0)
    const economicNews = scoredNews
      .filter(article => article.economicScore > 0)
      .sort((a, b) => b.economicScore - a.economicScore)
      .slice(0, 5);

    console.log('[EconomicNews] Found', economicNews.length, 'economic articles');
    return economicNews;
  };

  // Format time ago
  const getTimeAgo = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  // Get display source
  const getDisplaySource = (item) => {
    const source = item.source;
    if (!source || source === 'Unknown' || source.toLowerCase() === 'unknown') {
      if (item.url) {
        try {
          const hostname = new URL(item.url).hostname.replace('www.', '');
          const parts = hostname.split('.');
          if (parts.length >= 2) {
            const name = parts[parts.length - 2];
            return name.charAt(0).toUpperCase() + name.slice(1);
          }
        } catch {
          return 'News';
        }
      }
      return 'News';
    }
    return source;
  };

  const economicNews = getEconomicNews();

  if (isLoading) {
    return (
      <div style={{
        background: '#1a1f2e',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '16px',
        border: '1px solid #2d3548',
      }}>
        <h3 style={{ color: '#8b949e', fontSize: '12px', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '14px' }}>🏛️</span> Economic News
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{
              background: '#161b22',
              borderRadius: '8px',
              padding: '12px',
              animation: 'pulse 1.5s ease-in-out infinite',
            }}>
              <div style={{ height: '14px', background: '#2d3548', borderRadius: '4px', width: '85%', marginBottom: '8px' }} />
              <div style={{ height: '12px', background: '#2d3548', borderRadius: '4px', width: '40%' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // No economic news found
  if (economicNews.length === 0) {
    return (
      <div style={{
        background: '#1a1f2e',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '16px',
        border: '1px solid #2d3548',
      }}>
        <h3 style={{ color: '#8b949e', fontSize: '12px', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '14px' }}>🏛️</span> Economic News
        </h3>
        <div style={{
          background: '#161b22',
          borderRadius: '8px',
          padding: '16px',
          textAlign: 'center',
        }}>
          <span style={{ color: '#8b949e', fontSize: '13px' }}>
            No major economic news at this time
          </span>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: '#1a1f2e',
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '16px',
      border: '1px solid #2d3548',
    }}>
      <h3 style={{ color: '#8b949e', fontSize: '12px', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '14px' }}>🏛️</span> Economic News
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {economicNews.map((item, idx) => {
          const isHovered = hoveredCard === idx;
          const hasUrl = item.url && item.url !== '#';

          return (
            <div
              key={item.id || idx}
              onClick={() => hasUrl && window.open(item.url, '_blank')}
              onMouseEnter={() => setHoveredCard(idx)}
              onMouseLeave={() => setHoveredCard(null)}
              style={{
                position: 'relative',
                background: isHovered ? '#1e242f' : '#161b22',
                borderRadius: '8px',
                padding: '12px',
                cursor: hasUrl ? 'pointer' : 'default',
                transition: 'all 0.2s ease',
                borderLeft: `3px solid ${idx === 0 ? amber : '#2d3548'}`,
                transform: isHovered && hasUrl ? 'translateX(2px)' : 'none',
              }}
            >
              {/* External link icon */}
              {hasUrl && (
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

              {/* Economic indicator icon and headline */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', paddingRight: hasUrl ? '20px' : '0' }}>
                <span style={{ fontSize: '12px', marginTop: '2px' }}>📊</span>
                <div style={{
                  color: isHovered ? '#e6edf3' : '#e6edf3',
                  fontSize: '13px',
                  lineHeight: '1.5',
                  fontWeight: idx === 0 ? '500' : '400',
                  flex: 1,
                }}>
                  {item.title}
                </div>
              </div>

              {/* Source and time */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', marginLeft: '20px' }}>
                <span style={{ color: amber, fontSize: '11px', fontWeight: '500' }}>{getDisplaySource(item)}</span>
                <span style={{ color: '#6e7681', fontSize: '11px' }}>•</span>
                <span style={{ color: '#6e7681', fontSize: '11px' }}>{getTimeAgo(item.publishedAt)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default EconomicNews;
