// /src/components/Research/FundamentalNews.jsx

import React, { useState, useEffect } from 'react';
import { getStockNews } from '../../services/eodhdAPI';
import StyledIcon from '../shared/StyledIcon';

/**
 * FundamentalNews - Fetches real stock news and makes articles clickable
 * Opens full articles in new tab with hover effects
 * Includes AI-powered sentiment gauge and summary
 *
 * @param {Object} props
 * @param {string} props.symbol - Stock symbol to fetch news for
 * @param {Object} props.colors - Design tokens
 */
const FundamentalNews = ({ symbol, colors }) => {
  const [news, setNews] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredCard, setHoveredCard] = useState(null);

  // Sentiment analysis state
  const [sentimentScore, setSentimentScore] = useState(null);
  const [sentimentSummary, setSentimentSummary] = useState(null);
  const [sentimentLoading, setSentimentLoading] = useState(false);
  const [sentimentError, setSentimentError] = useState(null);

  const SENTIMENT_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

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

  // Get sentiment label + color from score
  const getSentimentLabel = (score) => {
    if (score >= 75) return { text: 'Very Bullish', color: '#22c55e' };
    if (score >= 60) return { text: 'Bullish', color: '#4ade80' };
    if (score >= 45) return { text: 'Neutral', color: '#f59e0b' };
    if (score >= 30) return { text: 'Bearish', color: '#f87171' };
    return { text: 'Very Bearish', color: '#ef4444' };
  };

  // Analyze news sentiment via AI
  const handleAnalyzeSentiment = async () => {
    if (!news || news.length === 0) return;

    setSentimentLoading(true);
    setSentimentError(null);

    try {
      const response = await fetch('/api/ai-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'news-sentiment',
          symbol: symbol,
          articles: news.slice(0, 8).map(item => ({
            title: item.title,
            summary: item.summary || '',
            source: item.source,
            publishedAt: item.publishedAt,
            sentiment: getSentiment(item.title, item.sentiment)
          }))
        })
      });

      if (!response.ok) throw new Error('API request failed');

      const data = await response.json();

      if (data.success && data.score != null) {
        setSentimentScore(data.score);
        setSentimentSummary(data.summary);

        // Cache to localStorage
        try {
          localStorage.setItem(`news_sentiment_${symbol}`, JSON.stringify({
            score: data.score,
            summary: data.summary,
            timestamp: Date.now()
          }));
        } catch (e) {
          console.warn('[NewsSentiment] Cache write error:', e);
        }
      } else {
        setSentimentError(data.error || 'Failed to analyze sentiment');
      }
    } catch (err) {
      console.error('[NewsSentiment] Error:', err);
      setSentimentError('Failed to analyze sentiment. Please try again.');
    } finally {
      setSentimentLoading(false);
    }
  };

  useEffect(() => {
    const fetchNews = async () => {
      if (!symbol) {
        setIsLoading(false);
        return;
      }

      // Reset sentiment state on symbol change
      setSentimentScore(null);
      setSentimentSummary(null);
      setSentimentError(null);

      setIsLoading(true);
      try {
        const newsData = await getStockNews(symbol, 8);
        setNews(newsData || []);

        // Check localStorage for cached sentiment
        try {
          const cached = localStorage.getItem(`news_sentiment_${symbol}`);
          if (cached) {
            const { score, summary, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp < SENTIMENT_CACHE_DURATION && score != null) {
              setSentimentScore(score);
              setSentimentSummary(summary);
            }
          }
        } catch (e) {
          console.warn('[NewsSentiment] Cache read error:', e);
        }
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

      {/* Sentiment Gauge Section */}
      {news.length > 0 && (
        <div style={{
          marginBottom: '16px',
          background: '#1a2332',
          borderRadius: '12px',
          borderLeft: '3px solid #8b5cf6',
          padding: '16px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '12px'
          }}>
            <span style={{ fontSize: '16px' }}>📊</span>
            <h4 style={{
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: '700',
              margin: 0,
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              NEWS SENTIMENT
            </h4>
            <span style={{
              background: 'rgba(139, 92, 246, 0.2)',
              color: '#a78bfa',
              fontSize: '9px',
              fontWeight: '600',
              padding: '2px 8px',
              borderRadius: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              AI-Powered
            </span>
          </div>

          {sentimentLoading ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '16px',
              background: 'rgba(139, 92, 246, 0.1)',
              borderRadius: '8px'
            }}>
              <div style={{
                width: '18px',
                height: '18px',
                border: '2px solid #8b5cf6',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              <span style={{ color: '#a78bfa', fontSize: '13px' }}>
                Analyzing news sentiment...
              </span>
            </div>
          ) : sentimentError ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                padding: '16px',
                background: 'rgba(239, 68, 68, 0.1)',
                borderRadius: '8px',
                marginBottom: '12px'
              }}>
                <span style={{ color: '#f87171', fontSize: '13px' }}>
                  {sentimentError}
                </span>
              </div>
              <button
                onClick={handleAnalyzeSentiment}
                style={{
                  padding: '10px 20px',
                  background: '#374151',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Try Again
              </button>
            </div>
          ) : sentimentScore !== null ? (
            <div>
              {/* Score + Label Row */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px'
              }}>
                <span style={{
                  color: '#ffffff',
                  fontSize: '24px',
                  fontWeight: '700'
                }}>
                  {sentimentScore}
                </span>
                <span style={{
                  color: getSentimentLabel(sentimentScore).color,
                  fontSize: '13px',
                  fontWeight: '600'
                }}>
                  {getSentimentLabel(sentimentScore).text}
                </span>
              </div>

              {/* Gradient Bar */}
              <div style={{
                position: 'relative',
                height: '8px',
                borderRadius: '4px',
                background: 'linear-gradient(to right, #ef4444, #f59e0b, #22c55e)',
                marginBottom: '12px'
              }}>
                <div style={{
                  position: 'absolute',
                  left: `${sentimentScore}%`,
                  top: '-3px',
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  background: '#ffffff',
                  border: '2px solid #0d1117',
                  transform: 'translateX(-50%)',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                }} />
              </div>

              {/* Scale Labels */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '12px'
              }}>
                <span style={{ color: '#ef4444', fontSize: '10px' }}>Bearish</span>
                <span style={{ color: '#f59e0b', fontSize: '10px' }}>Neutral</span>
                <span style={{ color: '#22c55e', fontSize: '10px' }}>Bullish</span>
              </div>

              {/* Summary */}
              {sentimentSummary && (
                <div style={{
                  padding: '10px 12px',
                  background: '#0d1117',
                  borderRadius: '8px',
                  color: '#e6edf3',
                  fontSize: '12px',
                  lineHeight: '1.5'
                }}>
                  {sentimentSummary}
                </div>
              )}

              <div style={{
                marginTop: '10px',
                fontSize: '10px',
                color: '#6b7280',
                textAlign: 'right'
              }}>
                Powered by AI Analysis
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <button
                onClick={handleAnalyzeSentiment}
                style={{
                  width: '100%',
                  padding: '16px',
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                  border: 'none',
                  borderRadius: '10px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)'
                }}
              >
                <span>✨</span>
                Analyze News Sentiment
              </button>
              <p style={{
                fontSize: '11px',
                color: '#6b7280',
                marginTop: '10px',
                marginBottom: 0
              }}>
                AI analyzes {news.length} recent articles to gauge sentiment
              </p>
            </div>
          )}
        </div>
      )}

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

      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default FundamentalNews;
