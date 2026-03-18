// src/components/FantasyTimes/StoryDetail.jsx
// Expanded story view — bottom sheet on mobile, modal on desktop.

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, TrendingUp, Globe, BarChart3, Compass, ArrowRight } from 'lucide-react';
import { REPORTER_PROFILES } from '../../prompts/fantasyTimesPrompts';

const ICON_MAP = { Zap, TrendingUp, Globe, BarChart3, Compass };

// ── Tier color from composite score ──────────────────────────────
function tierColor(score) {
  if (score >= 80) return '#ffd700';
  if (score >= 60) return '#00d9ff';
  if (score >= 40) return '#8b949e';
  if (score >= 20) return '#f59e0b';
  return '#ef4444';
}

function tierLabel(score) {
  if (score >= 80) return 'Sector Leader';
  if (score >= 60) return 'Above Average';
  if (score >= 40) return 'In-Line';
  if (score >= 20) return 'Below Average';
  return 'Lags Sector';
}

// ── Simple rank data cache (5-min TTL) ───────────────────────────
const rankCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function getCached(key) {
  const entry = rankCache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}

function setCache(key, data) {
  rankCache.set(key, { data, ts: Date.now() });
}

// ── Pillar bar component ─────────────────────────────────────────
const PILLAR_LABELS = {
  growth: 'Growth',
  profitability: 'Profit',
  efficiency: 'Efficiency',
  valuation: 'Value',
  capitalEff: 'Cap Eff',
  momentum: 'Momentum',
  sentiment: 'Sentiment',
};

function PillarBar({ name, percentile }) {
  const color = tierColor(percentile);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
      <div style={{ width: '70px', fontSize: '11px', color: '#8b949e', flexShrink: 0 }}>
        {PILLAR_LABELS[name] || name}
      </div>
      <div style={{
        flex: 1,
        height: '6px',
        backgroundColor: '#21262d',
        borderRadius: '3px',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${percentile}%`,
          height: '100%',
          backgroundColor: color,
          borderRadius: '3px',
          transition: 'width 0.6s ease',
        }} />
      </div>
      <div style={{ width: '28px', fontSize: '11px', color, fontWeight: 600, textAlign: 'right' }}>
        {percentile}
      </div>
    </div>
  );
}

// ── Stock Rank Card (Alex/Doug) ──────────────────────────────────
function StockRankCard({ ticker }) {
  const [data, setData] = useState(getCached(`stock-${ticker}`));
  const [loading, setLoading] = useState(!data);

  useEffect(() => {
    if (data) return;
    let cancelled = false;
    fetch(`/api/stocks/peer-rankings?symbol=${ticker}`)
      .then((r) => r.json())
      .then((res) => {
        if (cancelled || !res.success) return;
        setCache(`stock-${ticker}`, res.data);
        setData(res.data);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ticker]);

  if (loading) {
    return (
      <div style={{
        background: '#161b22',
        borderRadius: '10px',
        padding: '16px',
        marginTop: '16px',
        textAlign: 'center',
        color: '#6e7681',
        fontSize: '12px',
      }}>
        Loading rankings...
      </div>
    );
  }
  if (!data) return null;

  const score = data.compositeScore;
  const color = tierColor(score);
  const pillars = data.pillars || {};

  return (
    <div style={{
      background: '#161b22',
      border: '1px solid #21262d',
      borderRadius: '10px',
      padding: '16px',
      marginTop: '16px',
    }}>
      <div style={{
        fontSize: '10px',
        fontWeight: 700,
        color: '#6e7681',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        marginBottom: '12px',
      }}>
        FantasyTrades Ranking
      </div>

      {/* Header row: ticker, rank, overall score */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span style={{ color: '#e6edf3', fontSize: '18px', fontWeight: 700 }}>{data.ticker}</span>
          <span style={{ color: '#8b949e', fontSize: '13px' }}>
            #{data.compositeRank} of {data.totalPeers}
          </span>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          <span style={{ color: '#8b949e', fontSize: '12px' }}>Overall:</span>
          <span style={{
            color,
            fontSize: '16px',
            fontWeight: 700,
          }}>
            {score}/100
          </span>
        </div>
      </div>

      {/* Tier badge */}
      <div style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '4px',
        backgroundColor: `${color}18`,
        color,
        fontSize: '11px',
        fontWeight: 600,
        marginBottom: '12px',
      }}>
        {tierLabel(score)}
      </div>

      {/* Pillar bars */}
      {Object.entries(pillars).map(([key, pillar]) => (
        <PillarBar key={key} name={key} percentile={pillar.percentile} />
      ))}
    </div>
  );
}

// ── Sector Rank Card (Kim) ───────────────────────────────────────
function SectorRankCard({ topSectors }) {
  const [data, setData] = useState(getCached('sector-all'));
  const [loading, setLoading] = useState(!data);

  useEffect(() => {
    if (data) return;
    let cancelled = false;
    fetch('/api/stocks/sector-rankings?symbol=SPY')
      .then((r) => r.json())
      .then((res) => {
        if (cancelled || !res.success) return;
        setCache('sector-all', res.data);
        setData(res.data);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div style={{
        background: '#161b22',
        borderRadius: '10px',
        padding: '16px',
        marginTop: '16px',
        textAlign: 'center',
        color: '#6e7681',
        fontSize: '12px',
      }}>
        Loading sector rankings...
      </div>
    );
  }
  if (!data?.sectors) return null;

  // Show top 3 sectors, prioritizing those mentioned in the story
  const topSet = new Set((topSectors || []).map((s) => s.toUpperCase()));
  const sorted = [...data.sectors].sort((a, b) => {
    const aMatch = topSet.has(a.name?.toUpperCase()) || topSet.has(a.etf?.toUpperCase()) ? 1 : 0;
    const bMatch = topSet.has(b.name?.toUpperCase()) || topSet.has(b.etf?.toUpperCase()) ? 1 : 0;
    if (bMatch !== aMatch) return bMatch - aMatch;
    return a.rank - b.rank;
  });
  const displayed = sorted.slice(0, 3);

  return (
    <div style={{
      background: '#161b22',
      border: '1px solid #21262d',
      borderRadius: '10px',
      padding: '16px',
      marginTop: '16px',
    }}>
      <div style={{
        fontSize: '10px',
        fontWeight: 700,
        color: '#6e7681',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        marginBottom: '12px',
      }}>
        Sector Ranking
      </div>

      {displayed.map((sector) => {
        const color = tierColor(sector.compositeScore);
        const breadthVal = sector.breadth?.value;
        const breadthLabel = breadthVal >= 60 ? 'Healthy' : breadthVal >= 40 ? 'Mixed' : 'Weak';
        const breadthColor = breadthVal >= 60 ? '#00ff88' : breadthVal >= 40 ? '#f59e0b' : '#ff3366';
        const isHighlight = topSet.has(sector.name?.toUpperCase()) || topSet.has(sector.etf?.toUpperCase());

        return (
          <div
            key={sector.sectorId || sector.etf}
            style={{
              padding: '10px',
              borderRadius: '8px',
              backgroundColor: isHighlight ? `${sector.color || color}0D` : 'transparent',
              border: isHighlight ? `1px solid ${sector.color || color}33` : '1px solid transparent',
              marginBottom: '8px',
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '6px',
            }}>
              <div>
                <span style={{ color: '#e6edf3', fontSize: '14px', fontWeight: 600 }}>
                  {sector.name}
                </span>
                <span style={{ color: '#6e7681', fontSize: '12px', marginLeft: '6px' }}>
                  ({sector.etf})
                </span>
              </div>
              <span style={{ color, fontSize: '14px', fontWeight: 700 }}>
                {sector.compositeScore}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '12px', fontSize: '11px' }}>
              {sector.tier && (
                <span style={{
                  padding: '2px 6px',
                  borderRadius: '3px',
                  backgroundColor: `${color}18`,
                  color,
                  fontWeight: 600,
                }}>
                  {sector.tier.label}
                </span>
              )}
              {breadthVal != null && (
                <span style={{ color: breadthColor }}>
                  Breadth: {breadthVal}% ({breadthLabel})
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Markdown renderer with pull-quote support ────────────────────
function renderMarkdownWithPullQuote(text, reporterName, reporterBeat, reporterColor) {
  if (!text) return '';

  // Extract the first **bold** block for pull-quote
  let pullQuoteHtml = '';
  let processedText = text;
  const boldMatch = text.match(/\*\*(.+?)\*\*/);
  if (boldMatch) {
    const quoteText = boldMatch[1];
    pullQuoteHtml = `<div style="border-left:3px solid ${reporterColor};background:${reporterColor}0D;padding:16px 20px;margin:20px 0;border-radius:0 8px 8px 0"><div style="font-size:16px;font-style:italic;color:#e6edf3;line-height:1.6">&ldquo;${quoteText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}&rdquo;</div><div style="font-size:12px;color:#6e7681;margin-top:8px">&mdash; ${reporterName}, ${reporterBeat}</div></div>`;
    // Replace the first bold occurrence with the pull-quote
    processedText = text.replace(boldMatch[0], `__PULLQUOTE__`);
  }

  // Run standard markdown rendering
  let html = processedText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^&gt;\s?(.+)$/gm, '<blockquote style="border-left:3px solid #30363d;padding-left:12px;color:#8b949e;margin:8px 0;font-style:italic">$1</blockquote>')
    .replace(/^## (.+)$/gm, '<h3 style="color:#e6edf3;font-size:15px;margin:16px 0 8px;font-weight:700">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#e6edf3">$1</strong>')
    .replace(/^- (.+)$/gm, '<li style="color:#8b949e;margin:2px 0;margin-left:16px">$1</li>')
    .replace(/\n\n/g, '</p><p style="margin:8px 0;line-height:1.6">')
    .replace(/\n/g, '<br/>');

  // Insert pull-quote back
  if (pullQuoteHtml) {
    html = html.replace('__PULLQUOTE__', pullQuoteHtml);
  }

  return html;
}

export default function StoryDetail({ story, isOpen, onClose, onOpenResearch, isMobile }) {
  if (!isOpen || !story) return null;

  const profile = REPORTER_PROFILES[story.reporter] || REPORTER_PROFILES.kai;
  const IconComponent = ICON_MAP[profile.icon] || Zap;
  const primaryTicker = story.primaryTicker || (story.tickers && story.tickers[0]);
  const showResearchButton = primaryTicker && onOpenResearch;
  const showStockRank = (story.reporter === 'alex' || story.reporter === 'doug') && primaryTicker;
  const showSectorRank = story.reporter === 'kim';

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [isOpen]);

  const bodyHtml = renderMarkdownWithPullQuote(story.body, profile.name, profile.beat, profile.color);

  const modalVariants = isMobile
    ? {
        initial: { y: '100%' },
        animate: { y: 0 },
        exit: { y: '100%' },
        transition: { type: 'spring', damping: 25, stiffness: 300 },
      }
    : {
        initial: { opacity: 0, scale: 0.95, x: '-50%', y: '-50%' },
        animate: { opacity: 1, scale: 1, x: '-50%', y: '-50%' },
        exit: { opacity: 0, scale: 0.95, x: '-50%', y: '-50%' },
        transition: { duration: 0.2 },
      };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.8)',
              backdropFilter: 'blur(8px)',
              zIndex: 100,
            }}
          />

          {/* Modal/Sheet */}
          <motion.div
            {...modalVariants}
            style={{
              position: 'fixed',
              zIndex: 101,
              backgroundColor: '#0d1117',
              overflowY: 'auto',
              ...(isMobile
                ? {
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '90vh',
                    borderTopLeftRadius: '16px',
                    borderTopRightRadius: '16px',
                  }
                : {
                    top: '50%',
                    left: '50%',
                    maxWidth: '640px',
                    width: '90vw',
                    maxHeight: '85vh',
                    borderRadius: '12px',
                    border: '1px solid #21262d',
                  }),
            }}
          >
            {/* Drag handle (mobile) */}
            {isMobile && (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                padding: '10px 0 4px',
              }}>
                <div style={{
                  width: 36,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: '#30363d',
                }} />
              </div>
            )}

            {/* Header */}
            <div style={{
              padding: '16px 20px 12px',
              borderBottom: '1px solid #21262d',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                backgroundColor: `${profile.color}22`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <IconComponent size={16} color={profile.color} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: profile.color, fontSize: '13px', fontWeight: 600 }}>
                  {profile.name} · {profile.beat}
                </div>
                <div style={{ color: '#6e7681', fontSize: '11px' }}>
                  {story.publishedAt
                    ? new Date(
                        story.publishedAt._seconds
                          ? story.publishedAt._seconds * 1000
                          : story.publishedAt
                      ).toLocaleString()
                    : ''}
                </div>
              </div>
              <button
                onClick={onClose}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#8b949e',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: '16px 20px' }}>
              {/* Headline */}
              <h2 style={{
                color: '#e6edf3',
                fontSize: '18px',
                fontWeight: 700,
                lineHeight: 1.3,
                margin: '0 0 8px',
              }}>
                {story.headline}
              </h2>

              {/* Subheadline */}
              <p style={{
                color: '#8b949e',
                fontSize: '14px',
                margin: '0 0 16px',
                lineHeight: 1.4,
              }}>
                {story.subheadline}
              </p>

              {/* Body */}
              <div
                style={{
                  color: '#c9d1d9',
                  fontSize: '14px',
                  lineHeight: 1.7,
                }}
                dangerouslySetInnerHTML={{ __html: `<p style="margin:8px 0;line-height:1.6">${bodyHtml}</p>` }}
              />

              {/* Ranks visual */}
              {showStockRank && <StockRankCard ticker={primaryTicker} />}
              {showSectorRank && <SectorRankCard topSectors={story.topSectors} />}

              {/* Research button (replaces old chart) */}
              {showResearchButton && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenResearch(primaryTicker);
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '16px',
                    marginTop: '16px',
                    background: `linear-gradient(135deg, ${profile.color}1A, ${profile.color}08)`,
                    border: `1px solid ${profile.color}4D`,
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'box-shadow 0.2s',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 0 20px ${profile.color}20`; }}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <BarChart3 size={22} color={profile.color} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#e6edf3', fontSize: '15px', fontWeight: 600 }}>
                      View {primaryTicker} in Research
                    </div>
                    <div style={{ color: '#6e7681', fontSize: '12px', marginTop: '2px' }}>
                      Full chart, technicals, rankings
                    </div>
                  </div>
                  <ArrowRight size={18} color="#6e7681" style={{ flexShrink: 0 }} />
                </button>
              )}

              {/* Related tickers */}
              {story.tickers && story.tickers.length > 0 && (
                <div style={{
                  display: 'flex',
                  gap: '6px',
                  flexWrap: 'wrap',
                  marginTop: '16px',
                  paddingTop: '12px',
                  borderTop: '1px solid #21262d',
                }}>
                  {story.tickers.map((ticker) => (
                    <span
                      key={ticker}
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '3px 8px',
                        borderRadius: '4px',
                        backgroundColor: '#21262d',
                        color: '#e6edf3',
                      }}
                    >
                      {ticker}
                    </span>
                  ))}
                </div>
              )}

              {/* Disclaimer */}
              <p style={{
                color: '#6e7681',
                fontSize: '11px',
                marginTop: '20px',
                paddingTop: '12px',
                borderTop: '1px solid #21262d',
                lineHeight: 1.4,
              }}>
                FantasyTimes — AI-generated for educational and entertainment purposes. Not financial advice.
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
