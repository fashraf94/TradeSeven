import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HOLO_COLORS } from '../../constants/holoTheme';

// ─── Color tokens ────────────────────────────────────────────
const C = {
  bgCard: HOLO_COLORS.bgCard || '#161b22',
  bgElevated: HOLO_COLORS.bgElevated || '#1c2128',
  cyan: '#00d9ff',
  green: '#00ff88',
  red: '#ff4757',
  amber: '#f59e0b',
  purple: '#a78bfa',
  white: '#e6edf3',
  textSecondary: '#8b949e',
  textMuted: '#484f58',
  border: 'rgba(0,217,255,0.08)',
};

const SENTIMENT_COLORS = {
  bullish: C.green,
  bearish: C.red,
  neutral: C.textSecondary,
};

const CATEGORY_COLORS = {
  macro: C.amber,
  earnings: C.purple,
  sector: C.cyan,
  geopolitical: C.red,
  crypto: '#fbbf24',
  commodities: '#f97316',
};

// ─── Loading skeleton ────────────────────────────────────────
const SkeletonRow = ({ width }) => (
  <div style={{
    height: '14px',
    width,
    borderRadius: '6px',
    background: 'rgba(255,255,255,0.04)',
    animation: 'pulseShimmer 1.5s ease-in-out infinite',
  }} />
);

// ─── Time ago helper ─────────────────────────────────────────
const timeAgo = (ts) => {
  if (!ts) return '';
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return '';
};

// =============================================================================
// MarketPulseCard
// =============================================================================

const MarketPulseCard = ({ headlines = [], citations = [], loading, error, onRetry, onStockTap, cachedAt }) => {
  const [expandedId, setExpandedId] = useState(null);

  const toggleHeadline = (id) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  // ─── Loading state ───────────────────────────────────────
  if (loading && headlines.length === 0) {
    return (
      <div style={{
        background: C.bgCard,
        borderRadius: '14px',
        padding: '16px',
        border: `1px solid ${C.border}`,
      }}>
        <div style={{
          fontSize: '9px',
          fontWeight: 700,
          letterSpacing: '2px',
          textTransform: 'uppercase',
          color: C.textMuted,
          marginBottom: '14px',
        }}>
          MARKET PULSE
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <SkeletonRow width="90%" />
          <SkeletonRow width="75%" />
          <SkeletonRow width="85%" />
          <SkeletonRow width="60%" />
          <SkeletonRow width="80%" />
          <SkeletonRow width="70%" />
        </div>
        <style>{`
          @keyframes pulseShimmer {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 0.7; }
          }
        `}</style>
      </div>
    );
  }

  // ─── Error state ─────────────────────────────────────────
  if (error && headlines.length === 0) {
    return (
      <div style={{
        background: C.bgCard,
        borderRadius: '14px',
        padding: '16px',
        border: `1px solid ${C.border}`,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '13px', color: C.textSecondary, marginBottom: '8px' }}>
          Couldn't load market news.
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              background: 'rgba(0,217,255,0.1)',
              border: '1px solid rgba(0,217,255,0.2)',
              borderRadius: '8px',
              color: C.cyan,
              fontSize: '12px',
              fontWeight: 600,
              padding: '6px 16px',
              cursor: 'pointer',
            }}
          >
            Tap to retry
          </button>
        )}
      </div>
    );
  }

  // ─── Empty state ─────────────────────────────────────────
  if (!headlines.length) return null;

  // ─── Sources footer ──────────────────────────────────────
  const uniqueSources = [];
  if (citations?.length > 0) {
    const seen = new Set();
    for (const url of citations) {
      try {
        const host = new URL(url).hostname.replace('www.', '');
        if (!seen.has(host)) {
          seen.add(host);
          uniqueSources.push(host);
        }
      } catch { /* skip invalid URLs */ }
      if (uniqueSources.length >= 5) break;
    }
  }

  return (
    <div style={{
      background: C.bgCard,
      borderRadius: '14px',
      padding: '16px',
      border: `1px solid ${C.border}`,
    }}>
      {/* ─── Header ─────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            fontSize: '9px',
            fontWeight: 700,
            letterSpacing: '2px',
            textTransform: 'uppercase',
            color: C.textMuted,
          }}>
            MARKET PULSE
          </div>
          <div style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: C.green,
            boxShadow: `0 0 6px ${C.green}60`,
            animation: 'livePulse 2s ease-in-out infinite',
          }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {cachedAt && (
            <span style={{ fontSize: '10px', color: C.textMuted }}>
              {timeAgo(cachedAt)}
            </span>
          )}
          {onRetry && (
            <button
              onClick={(e) => { e.stopPropagation(); onRetry(); }}
              style={{
                background: 'none',
                border: 'none',
                color: C.textMuted,
                fontSize: '14px',
                cursor: 'pointer',
                padding: '2px 4px',
                lineHeight: 1,
              }}
              title="Refresh"
            >
              ↻
            </button>
          )}
        </div>
      </div>

      {/* ─── Headlines ──────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {headlines.map((h) => {
          const id = h.id || h.headline;
          const isExpanded = expandedId === id;
          const sentimentColor = SENTIMENT_COLORS[h.sentiment] || C.textSecondary;
          const categoryColor = CATEGORY_COLORS[h.category] || C.textMuted;

          return (
            <div
              key={id}
              onClick={() => toggleHeadline(id)}
              style={{
                padding: '10px 8px',
                borderRadius: '8px',
                cursor: 'pointer',
                background: isExpanded ? 'rgba(0,217,255,0.04)' : 'transparent',
                transition: 'background 0.15s ease',
              }}
            >
              {/* Collapsed header row */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                {/* Sentiment dot */}
                <div style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: sentimentColor,
                  flexShrink: 0,
                }} />

                {/* Headline text */}
                <span style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: C.white,
                  flex: 1,
                  lineHeight: 1.3,
                }}>
                  {h.headline}
                </span>

                {/* Category badge */}
                <span style={{
                  fontSize: '8px',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  padding: '2px 5px',
                  borderRadius: '4px',
                  background: `${categoryColor}15`,
                  color: categoryColor,
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}>
                  {h.category}
                </span>

                {/* Chevron */}
                <span style={{
                  fontSize: '10px',
                  color: C.textMuted,
                  transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease',
                  flexShrink: 0,
                }}>
                  {'\u25BC'}
                </span>
              </div>

              {/* Expanded content */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{ padding: '10px 0 4px 15px' }}
                    >
                      {/* Summary */}
                      <p style={{
                        fontSize: '12px',
                        color: C.textSecondary,
                        lineHeight: 1.6,
                        margin: 0,
                      }}>
                        {h.summary}
                      </p>

                      {/* Ticker pills */}
                      {h.tickers?.length > 0 && (
                        <div style={{
                          display: 'flex',
                          gap: '6px',
                          marginTop: '10px',
                          flexWrap: 'wrap',
                        }}>
                          {h.tickers.map(ticker => (
                            <button
                              key={ticker}
                              onClick={() => onStockTap?.(ticker)}
                              style={{
                                fontFamily: 'monospace',
                                fontSize: '11px',
                                fontWeight: 600,
                                color: C.cyan,
                                background: 'rgba(0,217,255,0.08)',
                                border: '1px solid rgba(0,217,255,0.15)',
                                borderRadius: '6px',
                                padding: '3px 8px',
                                cursor: 'pointer',
                              }}
                            >
                              {ticker}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* ─── Sources footer ─────────────────────────────── */}
      {uniqueSources.length > 0 && (
        <div style={{
          marginTop: '12px',
          paddingTop: '8px',
          borderTop: `1px solid ${C.border}`,
          fontSize: '10px',
          color: C.textMuted,
        }}>
          Sources: {uniqueSources.join(', ')}
        </div>
      )}

      <style>{`
        @keyframes livePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes pulseShimmer {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
};

export default MarketPulseCard;
