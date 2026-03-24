import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import useTechnicalScore from '../Research/useTechnicalScore';
import RanksLeaderboard from '../Research/RanksLeaderboard';

// ---------------------------------------------------------------------------
// Constants & Design Tokens
// ---------------------------------------------------------------------------

const MONO = "'JetBrains Mono', 'SF Mono', monospace";

const TIER_COLORS = {
  'Sector Leader': '#ffd700',
  'Above Average': '#00d9ff',
  'In-Line': '#8b949e',
  'Below Average': '#f59e0b',
  'Lags Sector': '#ef4444',
};

// Handle tier as object {min, label, color} or string
function getTierLabel(tier) { return tier?.label || tier || 'Unknown'; }
function getTierColor(tier) { return tier?.color || TIER_COLORS[tier?.label || tier] || '#8b949e'; }

function tierFromPercentile(p) {
  if (p == null) return 'In-Line';
  if (p >= 80) return 'Sector Leader';
  if (p >= 60) return 'Above Average';
  if (p >= 40) return 'In-Line';
  if (p >= 20) return 'Below Average';
  return 'Lags Sector';
}

const PILLAR_CONFIG = [
  { key: 'growth',        label: 'Growth',             icon: '📈' },
  { key: 'profitability', label: 'Profitability',       icon: '💰' },
  { key: 'efficiency',    label: 'Efficiency',          icon: '⚙️' },
  { key: 'valuation',     label: 'Valuation',           icon: '📊' },
  { key: 'capitalEff',    label: 'Capital Efficiency',  icon: '💎' },
  { key: 'momentum',      label: 'Momentum',            icon: '⚡' },
  { key: 'sentiment',     label: 'Sentiment',           icon: '🎯' },
];

const TECHNICAL_FACTORS = [
  { key: 'rsPercentile', label: 'Relative Strength', icon: '💪', max: 30, scoreKey: 'rsPercentile',
    format: (v) => v != null ? `P${Math.round(v)}` : '—' },
  { key: 'smaPosition', label: 'SMA Position', icon: '📐', max: 25, scoreKey: 'smaScore',
    format: (_, factors) => {
      if (!factors) return '—';
      const flags = [factors.aboveSMA20 && '20d', factors.aboveSMA50 && '50d', factors.aboveSMA200 && '200d'].filter(Boolean);
      return flags.length ? `Above ${flags.join(', ')}` : 'Below all';
    } },
  { key: 'highProximity', label: '52-Week Proximity', icon: '🎯', max: 15, scoreKey: 'highProximity',
    format: (_, factors) => factors?.distTo52wkHigh != null ? `${factors.distTo52wkHigh.toFixed(1)}% off high` : '—' },
  { key: 'volume', label: 'Volume Confirm', icon: '📊', max: 12, scoreKey: 'volumeConfirmation',
    format: (_, factors) => factors?.upDayVolRatio != null ? `${factors.upDayVolRatio.toFixed(2)}x ratio` : '—' },
  { key: 'rsi', label: 'RSI Context', icon: '⚡', max: 10, scoreKey: 'rsiContext',
    format: (_, factors) => factors?.rsi != null ? `RSI ${Math.round(factors.rsi)}` : '—' },
  { key: 'rsTrend', label: 'RS Trend', icon: '📈', max: 8, scoreKey: 'rsTrendScore',
    format: (_, factors) => factors?.rsTrendSlope != null ? `${factors.rsTrendSlope > 0 ? '+' : ''}${factors.rsTrendSlope.toFixed(3)}` : '—' },
];

// Dimension formatters — values are stored in Firestore as:
//   EODHD decimals (×100 in formatter): revenueGrowth, epsGrowth, opMargin, netMargin, grossMargin, roa, roe
//   Already ×100 in cron: fcfYield, fcfMargin, sixMonthReturn, threeMonthReturn, oneMonthReturn, earningsRevisions, avgSurprise
//   Ratios: evEbitda, trailingPE, priceSales, priceBook
//   Percentage (EODHD reports as decimal): dividendYield
const pctDec = v => v != null ? `${(v * 100).toFixed(1)}%` : '—';
const pctRaw = v => v != null ? `${v.toFixed(1)}%` : '—';
const ratio  = v => v != null ? `${v.toFixed(1)}x` : '—';

const DIM_FORMAT = {
  // Growth
  revenueGrowth:     { label: 'Revenue Growth YoY',    format: pctDec },
  epsGrowth:         { label: 'EPS Growth YoY',         format: pctDec },
  // Profitability
  opMargin:          { label: 'Operating Margin',       format: pctDec },
  netMargin:         { label: 'Net Profit Margin',      format: pctDec },
  grossMargin:       { label: 'Gross Margin',           format: pctDec },
  // Efficiency
  roa:               { label: 'Return on Assets',       format: pctDec },
  roe:               { label: 'Return on Equity',       format: pctDec },
  // Valuation (all inverted — lower is better)
  evEbitda:          { label: 'EV/EBITDA',              format: ratio, lowerIsBetter: true },
  trailingPE:        { label: 'P/E Ratio (TTM)',        format: ratio, lowerIsBetter: true },
  priceSales:        { label: 'Price/Sales',            format: ratio, lowerIsBetter: true },
  priceBook:         { label: 'Price/Book',             format: ratio, lowerIsBetter: true },
  // Capital Efficiency
  fcfYield:          { label: 'FCF Yield',              format: v => v != null ? `${v.toFixed(2)}%` : '—' },
  dividendYield:     { label: 'Dividend Yield',         format: v => v != null ? `${(v * 100).toFixed(2)}%` : '—' },
  fcfMargin:         { label: 'FCF Margin',             format: pctRaw },
  // Momentum
  sixMonthReturn:    { label: '6M Price Return',        format: pctRaw },
  threeMonthReturn:  { label: '3M Price Return',        format: pctRaw },
  oneMonthReturn:    { label: '1M Price Return',        format: pctRaw },
  // Sentiment
  earningsRevisions: { label: 'Earnings Revisions',     format: pctRaw },
  avgSurprise:       { label: 'Avg Earnings Surprise',  format: pctRaw },
};

function getMultiplierText(value, median, lowerIsBetter) {
  if (median === 0 || value == null || median == null) return '';
  const r = lowerIsBetter ? median / value : value / median;
  if (r > 1.5) return `${r.toFixed(1)}x ${lowerIsBetter ? 'cheaper than' : 'above'} sector median`;
  if (r < 0.67) return `${(1/r).toFixed(1)}x ${lowerIsBetter ? 'more expensive than' : 'below'} sector median`;
  return 'Near sector median';
}

function relativeTime(isoString) {
  if (!isoString) return null;
  const ms = Date.now() - new Date(isoString).getTime();
  const hours = Math.floor(ms / 3600000);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ---------------------------------------------------------------------------
// Skeleton Loader
// ---------------------------------------------------------------------------

function SkeletonLoader() {
  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{
        height: '110px', borderRadius: '10px', marginBottom: '12px',
        background: 'rgba(255,255,255,0.04)',
        animation: 'ranks-pulse 1.5s ease-in-out infinite',
      }} />
      {[1, 2, 3, 4, 5, 6, 7].map(i => (
        <div key={i} style={{
          height: '38px', borderRadius: '6px', marginBottom: '4px',
          background: 'rgba(255,255,255,0.04)',
          animation: 'ranks-pulse 1.5s ease-in-out infinite',
          animationDelay: `${i * 0.08}s`,
        }} />
      ))}
      <div style={{
        height: '140px', borderRadius: '8px', marginTop: '12px',
        background: 'rgba(255,255,255,0.04)',
        animation: 'ranks-pulse 1.5s ease-in-out infinite',
      }} />
      <style>{`@keyframes ranks-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error / Not Available
// ---------------------------------------------------------------------------

function NotAvailableCard({ error, statusCode }) {
  const message = statusCode === 503
    ? 'Rankings are computed daily at 6 AM ET. Check back after market close.'
    : statusCode === 404
      ? 'This stock is not in the MarketClash ranking universe (~220 S&P 500 stocks).'
      : error || 'Peer rankings are not available for this stock.';

  return (
    <div style={{
      padding: '24px 16px', textAlign: 'center',
      background: '#1c2333', borderRadius: '10px',
      border: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{ fontSize: '24px', marginBottom: '8px', opacity: 0.4 }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6e7681" strokeWidth="1.5" style={{ display: 'inline-block' }}>
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
      <div style={{ fontSize: '12px', fontWeight: '600', color: '#8b949e', marginBottom: '4px' }}>
        Peer Rankings Unavailable
      </div>
      <div style={{ fontSize: '11px', color: '#6e7681', lineHeight: '1.4' }}>
        {message}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Staleness Note
// ---------------------------------------------------------------------------

function StalenessNote({ computedAt }) {
  if (!computedAt) return null;
  const ms = Date.now() - new Date(computedAt).getTime();
  if (ms < 48 * 3600000) return null;
  return (
    <div style={{ textAlign: 'center', padding: '4px 0', fontSize: '10px', color: '#6e7681' }}>
      Last updated {relativeTime(computedAt)}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bullet Chart
// ---------------------------------------------------------------------------

function BulletChart({ percentile, color, height = 6 }) {
  return (
    <div style={{ position: 'relative', flex: 1, height: `${height}px`, borderRadius: `${height / 2}px`, background: 'rgba(255,255,255,0.06)' }}>
      <div style={{
        height: '100%', borderRadius: `${height / 2}px`,
        width: percentile != null ? `${Math.min(100, Math.max(0, percentile))}%` : '0%',
        background: color,
        transition: 'width 0.4s ease',
        boxShadow: percentile >= 60 ? `0 0 6px ${color}40` : 'none',
      }} />
      <div style={{
        position: 'absolute', left: '50%', top: '-1px', bottom: '-1px',
        width: '1px', background: 'rgba(255,255,255,0.25)',
      }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Composite Rank Card
// ---------------------------------------------------------------------------

function CompositeRankCard({ data }) {
  const color = getTierColor(data.tier);
  const tierLabel = getTierLabel(data.tier);

  return (
    <div style={{
      padding: '14px 12px', marginBottom: '12px',
      borderRadius: '10px', background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
        {/* Rank badge */}
        <div style={{
          textAlign: 'center', flexShrink: 0,
          padding: '8px 12px', borderRadius: '8px',
          background: `${color}15`, border: `1px solid ${color}30`,
        }}>
          <div style={{ fontSize: '28px', fontWeight: '700', lineHeight: '1', color, fontFamily: MONO }}>
            #{data.compositeRank}
          </div>
          <div style={{ fontSize: '10px', color: '#8b949e', marginTop: '2px' }}>
            of {data.totalPeers}
          </div>
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '12px', color: '#e6edf3', fontWeight: '600' }}>
            {data.ticker}{data.name && data.name !== data.ticker ? ` · ${data.name}` : ''}
          </div>

          {/* Score bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
            <div style={{ flex: 1, height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)' }}>
              <div style={{
                height: '100%', borderRadius: '4px',
                width: `${data.compositeScore || 0}%`,
                background: `linear-gradient(90deg, ${color}80, ${color})`,
                transition: 'width 0.4s ease',
              }} />
            </div>
            <span style={{ fontSize: '14px', fontWeight: '700', color, fontFamily: MONO, flexShrink: 0 }}>
              {data.compositeScore}
            </span>
          </div>

          {/* Tier badge */}
          <div style={{
            display: 'inline-block', marginTop: '6px',
            padding: '2px 8px', borderRadius: '4px',
            background: `${color}18`, border: `1px solid ${color}30`,
            fontSize: '10px', fontWeight: '600', color,
            textTransform: 'uppercase', letterSpacing: '0.5px',
          }}>
            {tierLabel}
          </div>
        </div>
      </div>

      {/* DNA Badge */}
      {data.dnaBadge && (
        <div style={{
          marginTop: '10px', padding: '8px 10px', borderRadius: '6px',
          background: 'rgba(255,255,255,0.03)',
          fontSize: '11px', color: '#8b949e', lineHeight: '1.4', fontStyle: 'italic',
        }}>
          "{data.dnaBadge}"
        </div>
      )}

      {/* Debt Risk Badge */}
      {data.debtRiskBadge && (
        <div style={{
          marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '4px',
          padding: '3px 8px', borderRadius: '4px',
          background: `${data.debtRiskBadge.color || '#ef4444'}18`,
          border: `1px solid ${data.debtRiskBadge.color || '#ef4444'}30`,
          fontSize: '10px', fontWeight: '600', color: data.debtRiskBadge.color || '#ef4444',
        }}>
          {data.debtRiskBadge.label || data.debtRiskBadge}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pillar Row (expandable with dimension detail)
// ---------------------------------------------------------------------------

function PillarRow({ pillar, pillarData, isExpanded, onToggle, isMobile }) {
  const percentile = pillarData?.percentile;
  const pTier = tierFromPercentile(percentile);
  const color = TIER_COLORS[pTier] || '#8b949e';

  // Get all dimensions — support both multi-dimension and legacy single-dimension shapes
  const dimensions = pillarData?.dimensions || {};
  const dimEntries = Object.entries(dimensions)
    .filter(([k, d]) => d?.percentile != null && DIM_FORMAT[k]);

  // Fallback: legacy single-dimension shape
  const legacyDim = dimEntries.length === 0 && pillarData?.dimension ? pillarData.dimension : null;

  return (
    <div style={{
      marginBottom: '3px', borderRadius: '6px',
      background: isExpanded ? 'rgba(255,255,255,0.04)' : 'transparent',
      border: '1px solid rgba(255,255,255,0.06)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <button
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          width: '100%', padding: '7px 10px', cursor: 'pointer',
          background: 'none', border: 'none', textAlign: 'left',
        }}
      >
        <span style={{ fontSize: '12px', flexShrink: 0, lineHeight: '1' }}>{pillar.icon}</span>
        <span style={{
          fontSize: '11px', fontWeight: '600', color: '#e6edf3',
          flex: isMobile ? '0 0 70px' : '0 0 105px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {pillar.label}
        </span>

        <BulletChart percentile={percentile} color={color} />

        <span style={{
          fontSize: '11px', fontWeight: '600', color,
          fontFamily: MONO, flex: '0 0 30px', textAlign: 'right',
        }}>
          {percentile != null ? `P${percentile}` : '—'}
        </span>

        {!isMobile && (
          <span style={{
            fontSize: '9px', fontWeight: '500', color,
            flex: '0 0 72px', textAlign: 'right',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {percentile != null ? pTier : ''}
          </span>
        )}

        <span style={{
          fontSize: '9px', color: '#6e7681', flex: '0 0 12px',
          transition: 'transform 0.2s',
          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
        }}>
          ▼
        </span>
      </button>

      {/* Expanded multi-dimension detail */}
      {isExpanded && dimEntries.length > 0 && (
        <div style={{ padding: '6px 10px 10px 10px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          {dimEntries.map(([dimKey, dim], idx) => {
            const meta = DIM_FORMAT[dimKey];
            const dimColor = TIER_COLORS[tierFromPercentile(dim.percentile)] || '#8b949e';
            return (
              <div key={dimKey} style={{ marginBottom: idx < dimEntries.length - 1 ? 10 : 0 }}>
                <div style={{ fontSize: '10px', fontWeight: '600', color: '#e6edf3', marginBottom: '4px' }}>
                  {meta.label}{meta.lowerIsBetter ? ' (lower is better)' : ''}
                </div>

                <div style={{ display: 'flex', gap: '12px', fontSize: '10px', marginBottom: '4px' }}>
                  <div>
                    <span style={{ color: '#6e7681' }}>Value </span>
                    <span style={{ color: '#e6edf3', fontFamily: MONO, fontWeight: '600' }}>
                      {meta.format(dim.value)}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#6e7681' }}>Rank </span>
                    <span style={{ color: '#e6edf3', fontFamily: MONO }}>
                      #{dim.rank}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#6e7681' }}>Percentile </span>
                    <span style={{ color: dimColor, fontFamily: MONO, fontWeight: '600' }}>
                      P{dim.percentile}
                    </span>
                  </div>
                </div>

                {dim.sectorMedian != null && (
                  <div style={{ fontSize: '10px', color: '#6e7681', marginBottom: '4px' }}>
                    Sector median: <span style={{ fontFamily: MONO }}>{meta.format(dim.sectorMedian)}</span>
                    {dim.value != null && dim.sectorMedian !== 0 &&
                      ` · ${getMultiplierText(dim.value, dim.sectorMedian, meta.lowerIsBetter)}`
                    }
                  </div>
                )}

                <BulletChart percentile={dim.percentile} color={dimColor} height={4} />
              </div>
            );
          })}
        </div>
      )}

      {/* Fallback: legacy single-dimension or no data */}
      {isExpanded && dimEntries.length === 0 && !legacyDim && (
        <div style={{ padding: '8px 10px', fontSize: '10px', color: '#6e7681', fontStyle: 'italic' }}>
          Dimension data not yet available. Rankings will populate after the next daily computation.
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sector Leaderboard
// ---------------------------------------------------------------------------

function SectorLeaderboard({ data, currentSymbol, onNavigateToStock, isMobile }) {
  const [showAll, setShowAll] = useState(false);
  const leaderboard = data.leaderboard;
  if (!leaderboard?.length) return null;

  const upperSymbol = currentSymbol?.toUpperCase();

  const visibleEntries = useMemo(() => {
    if (showAll || leaderboard.length <= 10) return leaderboard;

    const top5 = leaderboard.slice(0, 5);
    const bottom2 = leaderboard.slice(-2);
    const currentEntry = leaderboard.find(e => e.ticker === upperSymbol);
    const currentIdx = leaderboard.findIndex(e => e.ticker === upperSymbol);

    const isInTop5 = currentIdx >= 0 && currentIdx < 5;
    const isInBottom = currentIdx >= leaderboard.length - 2;

    if (isInTop5 || isInBottom || !currentEntry) {
      return [...top5, { _gap: true, _label: `... ${leaderboard.length - 7} more ...` }, ...bottom2];
    }

    const result = [...top5];
    result.push({ _gap: true, _label: '...' });
    result.push(currentEntry);
    if (currentIdx < leaderboard.length - 3) {
      result.push({ _gap: true, _label: '...' });
    }
    result.push(...bottom2.filter(e => e.ticker !== currentEntry.ticker));
    return result;
  }, [leaderboard, showAll, upperSymbol]);

  return (
    <div style={{ marginTop: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
        <div style={{ fontSize: '10px', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {data.sectorName} Leaderboard
        </div>
        {leaderboard.length > 10 && (
          <button
            onClick={() => setShowAll(!showAll)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '10px', color: '#00d9ff', fontWeight: '600' }}
          >
            {showAll ? 'Collapse' : 'Show All'}
          </button>
        )}
      </div>

      <div style={{
        maxHeight: showAll ? '500px' : '300px', overflowY: 'auto',
        borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)',
        scrollbarWidth: 'thin', scrollbarColor: '#21262d transparent',
      }}>
        {visibleEntries.map((entry, idx) => {
          if (entry._gap) {
            return (
              <div key={`gap-${idx}`} style={{
                padding: '4px 10px', textAlign: 'center',
                fontSize: '10px', color: '#6e7681',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
              }}>
                {entry._label}
              </div>
            );
          }

          const isMe = entry.ticker === upperSymbol;
          const isClickable = !isMe && typeof onNavigateToStock === 'function';
          const entryScore = entry.score ?? entry.compositeScore;
          const entryColor = entry.tierColor || TIER_COLORS[entry.tier] || '#8b949e';

          return (
            <div
              key={entry.ticker}
              onClick={() => isClickable && onNavigateToStock(entry.ticker, entry.name)}
              onMouseEnter={(e) => { if (isClickable) e.currentTarget.style.background = 'rgba(0, 217, 255, 0.04)'; }}
              onMouseLeave={(e) => { if (isClickable) e.currentTarget.style.background = isMe ? 'rgba(0,217,255,0.08)' : 'transparent'; }}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '6px 10px',
                background: isMe ? 'rgba(0,217,255,0.08)' : 'transparent',
                borderLeft: isMe ? '2px solid #00d9ff' : '2px solid transparent',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                cursor: isClickable ? 'pointer' : 'default',
                transition: 'background 0.15s',
              }}
            >
              <span style={{ fontSize: '10px', fontFamily: MONO, color: '#6e7681', flex: '0 0 20px', textAlign: 'right' }}>
                {entry.rank}
              </span>
              <span style={{
                fontSize: '11px', fontWeight: isMe ? '700' : '600',
                color: isMe ? '#00d9ff' : '#e6edf3', flex: '0 0 48px',
              }}>
                {entry.ticker}
              </span>
              {!isMobile && (
                <span style={{
                  fontSize: '10px', color: '#8b949e', flex: 1,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {entry.name}
                </span>
              )}
              <div style={{
                flex: isMobile ? 1 : '0 0 60px',
                height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)',
              }}>
                <div style={{
                  height: '100%', borderRadius: '2px',
                  width: `${entryScore || 0}%`,
                  background: entryColor,
                }} />
              </div>
              <span style={{
                fontSize: '11px', fontWeight: '600', fontFamily: MONO,
                color: entryColor, flex: '0 0 24px', textAlign: 'right',
              }}>
                {entryScore}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scanner Badges
// ---------------------------------------------------------------------------

function ScannerBadges({ scanner }) {
  if (!scanner) return null;
  const { coiledSpring, runningOnFumes } = scanner;
  if (!coiledSpring?.qualifies && !runningOnFumes?.qualifies) return null;

  return (
    <div style={{ marginTop: '12px' }}>
      {coiledSpring?.qualifies && (
        <div style={{
          padding: '12px', marginBottom: '8px', borderRadius: '8px',
          background: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <span style={{ fontSize: '14px' }}>🎯</span>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#10b981' }}>Coiled Spring</span>
            {coiledSpring.score != null && (
              <span style={{ fontSize: '10px', fontFamily: MONO, color: '#10b981', marginLeft: 'auto' }}>
                Score: {coiledSpring.score}
              </span>
            )}
          </div>
          {coiledSpring.narrative && (
            <div style={{ fontSize: '11px', color: '#8b949e', lineHeight: '1.5' }}>
              {coiledSpring.narrative}
            </div>
          )}
        </div>
      )}

      {runningOnFumes?.qualifies && (
        <div style={{
          padding: '12px', marginBottom: '8px', borderRadius: '8px',
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <span style={{ fontSize: '14px' }}>⚠️</span>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#f59e0b' }}>Running on Fumes</span>
            {runningOnFumes.score != null && (
              <span style={{ fontSize: '10px', fontFamily: MONO, color: '#f59e0b', marginLeft: 'auto' }}>
                Score: {runningOnFumes.score}
              </span>
            )}
          </div>
          {runningOnFumes.narrative && (
            <div style={{ fontSize: '11px', color: '#8b949e', lineHeight: '1.5' }}>
              {runningOnFumes.narrative}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Technical Factor Row
// ---------------------------------------------------------------------------

function TechnicalFactorRow({ factor, techData }) {
  const subScore = techData?.[factor.scoreKey] ?? 0;
  const pct = Math.min(100, Math.max(0, (subScore / factor.max) * 100));
  const tier = tierFromPercentile(pct);
  const color = TIER_COLORS[tier] || '#8b949e';
  const formattedValue = factor.format(subScore, techData?.factors);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '6px',
      padding: '7px 10px', marginBottom: '3px', borderRadius: '6px',
      border: '1px solid rgba(255,255,255,0.06)',
    }}>
      <span style={{ fontSize: '12px', flexShrink: 0, lineHeight: '1' }}>{factor.icon}</span>
      <span style={{
        fontSize: '11px', fontWeight: '600', color: '#e6edf3',
        flex: '0 0 100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {factor.label}
      </span>

      <BulletChart percentile={pct} color={color} />

      <span style={{
        fontSize: '11px', fontWeight: '600', color,
        fontFamily: MONO, flex: '0 0 38px', textAlign: 'right',
      }}>
        {Math.round(subScore)}/{factor.max}
      </span>

      <span style={{
        fontSize: '10px', color: '#8b949e',
        flex: '0 0 80px', textAlign: 'right',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {formattedValue}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dual Badge Header
// ---------------------------------------------------------------------------

function DualBadgeHeader({ data, techData, techLoading, selectedView, onSelectView, sectorTechRank, sectorTechTotal }) {
  const fundColor = '#f59e0b';
  const fundTier = getTierLabel(data.tier);

  const techScore = techData?.technicalScore;
  const sectorTechPercentile = (sectorTechRank != null && sectorTechTotal > 0)
    ? ((sectorTechTotal - sectorTechRank) / sectorTechTotal) * 100
    : null;
  const techTier = sectorTechPercentile != null
    ? tierFromPercentile(sectorTechPercentile)
    : (techScore != null ? tierFromPercentile(techScore) : null);
  const techColor = '#00d9ff';

  const isFundSelected = selectedView === 'fundamental';
  const isTechSelected = selectedView === 'technical';

  return (
    <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
      {/* Fundamental Badge */}
      <div
        onClick={() => onSelectView('fundamental')}
        style={{
        flex: 1, padding: '12px 10px', borderRadius: '10px', cursor: 'pointer',
        background: isFundSelected ? 'rgba(245,158,11,0.05)' : 'rgba(255,255,255,0.03)',
        border: isFundSelected ? `1px solid rgba(245,158,11,0.4)` : '1px solid rgba(255,255,255,0.1)',
        transition: 'border-color 0.2s, background 0.2s',
      }}>
        <div style={{ fontSize: '9px', color: fundColor, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', fontWeight: '600' }}>
          Fundamental
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <span style={{ fontSize: '24px', fontWeight: '700', color: fundColor, fontFamily: MONO, lineHeight: '1' }}>
            #{data.compositeRank}
          </span>
          <span style={{ fontSize: '10px', color: '#6e7681' }}>of {data.totalPeers}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
          <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)' }}>
            <div style={{
              height: '100%', borderRadius: '3px',
              width: `${data.compositeScore || 0}%`,
              background: `linear-gradient(90deg, ${fundColor}80, ${fundColor})`,
              transition: 'width 0.4s ease',
            }} />
          </div>
          <span style={{ fontSize: '12px', fontWeight: '700', color: fundColor, fontFamily: MONO, flexShrink: 0 }}>
            {data.compositeScore}
          </span>
        </div>
        <div style={{
          display: 'inline-block', marginTop: '6px',
          padding: '2px 6px', borderRadius: '4px',
          background: `${fundColor}18`, border: `1px solid rgba(245,158,11,0.3)`,
          fontSize: '9px', fontWeight: '600', color: fundColor,
          textTransform: 'uppercase', letterSpacing: '0.5px',
        }}>
          {fundTier}
        </div>
      </div>

      {/* Technical Badge */}
      {techData && (
        <div
          onClick={() => onSelectView('technical')}
          style={{
          flex: 1, padding: '12px 10px', borderRadius: '10px', cursor: 'pointer',
          background: isTechSelected ? 'rgba(0,217,255,0.05)' : 'rgba(255,255,255,0.03)',
          border: isTechSelected ? `1px solid rgba(0,217,255,0.4)` : '1px solid rgba(255,255,255,0.1)',
          transition: 'border-color 0.2s, background 0.2s',
        }}>
          <div style={{ fontSize: '9px', color: techColor, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', fontWeight: '600' }}>
            Technical
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '24px', fontWeight: '700', color: techColor, fontFamily: MONO, lineHeight: '1' }}>
              #{sectorTechRank || techData.technicalRank}
            </span>
            <span style={{ fontSize: '10px', color: '#6e7681' }}>
              {sectorTechTotal ? `of ${sectorTechTotal}` : 'rank'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
            <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)' }}>
              <div style={{
                height: '100%', borderRadius: '3px',
                width: `${techScore || 0}%`,
                background: `linear-gradient(90deg, ${techColor}80, ${techColor})`,
                transition: 'width 0.4s ease',
              }} />
            </div>
            <span style={{ fontSize: '12px', fontWeight: '700', color: techColor, fontFamily: MONO, flexShrink: 0 }}>
              {techScore}
            </span>
          </div>
          {techTier && (
            <div style={{
              display: 'inline-block', marginTop: '6px',
              padding: '2px 6px', borderRadius: '4px',
              background: `${techColor}18`, border: `1px solid rgba(0,217,255,0.3)`,
              fontSize: '9px', fontWeight: '600', color: techColor,
              textTransform: 'uppercase', letterSpacing: '0.5px',
            }}>
              {techTier}
            </div>
          )}
        </div>
      )}

      {/* Technical shimmer while loading */}
      {techLoading && !techData && (
        <div style={{
          flex: 1, padding: '12px 10px', borderRadius: '10px',
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
          animation: 'ranks-pulse 1.5s ease-in-out infinite',
        }}>
          <div style={{ height: '10px', width: '60px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', marginBottom: '8px' }} />
          <div style={{ height: '24px', width: '50px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', marginBottom: '8px' }} />
          <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)' }} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

const CompeteTab = ({ symbol, isMobile, onNavigateToStock }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorStatus, setErrorStatus] = useState(null);
  const [expandedPillar, setExpandedPillar] = useState(null);
  const [selectedRankView, setSelectedRankView] = useState('fundamental');
  const [leaderboardTab, setLeaderboardTab] = useState('fundamental');
  const [rankingsData, setRankingsData] = useState(null);
  const { data: techData, loading: techLoading } = useTechnicalScore(symbol);

  // Fetch stockRankings summary (single Firestore read, cached by SDK)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'indexIntelligence', 'stockRankings'));
        if (!cancelled && snap.exists()) setRankingsData(snap.data());
      } catch (err) {
        console.error('[CompeteTab] Failed to load stockRankings:', err.message);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!symbol) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setErrorStatus(null);
    setData(null);
    setExpandedPillar(null);

    fetch(`/api/stocks/peer-rankings?symbol=${encodeURIComponent(symbol)}`)
      .then(r => {
        if (!r.ok) {
          const status = r.status;
          return r.json().catch(() => ({})).then(body => {
            throw Object.assign(
              new Error(body.message || body.error || `Rankings not available (${status})`),
              { status }
            );
          });
        }
        return r.json();
      })
      .then(json => {
        if (cancelled) return;
        const payload = json.success !== undefined ? json.data : json;
        if (!payload || (!payload.ticker && !payload.compositeScore)) {
          throw new Error('Peer rankings not available for this stock.');
        }
        setData(payload);
        setLoading(false);
      })
      .catch(err => {
        if (!cancelled) {
          setError(err.message);
          setErrorStatus(err.status || null);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [symbol]);

  // Look up current stock's sector rankings data
  const currentStockRanking = useMemo(() => {
    if (!rankingsData?.stocks) return null;
    return rankingsData.stocks.find(s => s.symbol === symbol) || null;
  }, [rankingsData, symbol]);

  // Build the pillar list from data — show whatever pillars exist in the response
  const activePillars = useMemo(() => PILLAR_CONFIG, []);

  if (loading) return <SkeletonLoader />;
  if (error || !data) return <NotAvailableCard error={error} statusCode={errorStatus} />;

  return (
    <div>
      <StalenessNote computedAt={data.computedAt} />

      {/* Dual Badge Header — Fundamental + Technical (tappable toggle) */}
      <DualBadgeHeader
        data={data}
        techData={techData}
        techLoading={techLoading}
        selectedView={selectedRankView}
        onSelectView={setSelectedRankView}
        sectorTechRank={currentStockRanking?.sectorTechnicalRank}
        sectorTechTotal={currentStockRanking?.sectorTechnicalTotal}
      />

      {/* DNA Badge */}
      {data.dnaBadge && (
        <div style={{
          marginBottom: '12px', padding: '8px 10px', borderRadius: '6px',
          background: 'rgba(255,255,255,0.03)',
          fontSize: '11px', color: '#8b949e', lineHeight: '1.4', fontStyle: 'italic',
        }}>
          &ldquo;{data.dnaBadge}&rdquo;
        </div>
      )}

      {/* Debt Risk Badge */}
      {data.debtRiskBadge && (
        <div style={{
          marginBottom: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px',
          padding: '3px 8px', borderRadius: '4px',
          background: `${data.debtRiskBadge.color || '#ef4444'}18`,
          border: `1px solid ${data.debtRiskBadge.color || '#ef4444'}30`,
          fontSize: '10px', fontWeight: '600', color: data.debtRiskBadge.color || '#ef4444',
        }}>
          {data.debtRiskBadge.label || data.debtRiskBadge}
        </div>
      )}

      {/* Toggled Breakdown Content */}
      <AnimatePresence mode="wait">
        {selectedRankView === 'technical' && techData ? (
          <motion.div
            key="technical"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {/* Technical Score headline */}
            <div style={{
              fontSize: '13px', fontWeight: '600', color: '#00d9ff',
              marginBottom: '8px',
            }}>
              Technical Score: {techData.technicalScore}/100
            </div>
            <div style={{
              fontSize: '10px', color: '#8b949e', marginBottom: '6px',
              textTransform: 'uppercase', letterSpacing: '0.5px',
            }}>
              Technical Score Breakdown
            </div>
            {TECHNICAL_FACTORS.map(factor => (
              <TechnicalFactorRow key={factor.key} factor={factor} techData={techData} />
            ))}

          </motion.div>
        ) : selectedRankView === 'technical' && !techData && !techLoading ? (
          <motion.div
            key="technical-na"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <div style={{
              padding: '16px', borderRadius: '8px',
              background: 'rgba(255,255,255,0.03)',
              fontSize: '12px', color: '#8b949e', textAlign: 'center',
            }}>
              Technical scoring not available for this stock
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="fundamental"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {/* Pillar Breakdown */}
            <div style={{
              fontSize: '10px', color: '#8b949e', marginBottom: '6px',
              textTransform: 'uppercase', letterSpacing: '0.5px',
            }}>
              Pillar Breakdown
            </div>
            {activePillars.map(pillar => (
              <PillarRow
                key={pillar.key}
                pillar={pillar}
                pillarData={data.pillars?.[pillar.key]}
                isExpanded={expandedPillar === pillar.key}
                onToggle={() => setExpandedPillar(expandedPillar === pillar.key ? null : pillar.key)}
                isMobile={isMobile}
              />
            ))}

          </motion.div>
        )}
      </AnimatePresence>

      {/* Unified Sector Leaderboard with Fundamental | Technical toggle */}
      {(data.leaderboard?.length > 0 || (rankingsData?.stocks && currentStockRanking?.sectorId)) && (
        <div style={{ marginTop: '12px' }}>
          {/* Pill toggle row */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            marginBottom: '4px',
          }}>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                onClick={() => setLeaderboardTab('fundamental')}
                style={{
                  padding: '4px 12px',
                  borderRadius: '16px',
                  fontSize: '11px',
                  fontWeight: '600',
                  border: 'none',
                  cursor: 'pointer',
                  background: leaderboardTab === 'fundamental' ? 'rgba(94, 234, 212, 0.15)' : 'transparent',
                  color: leaderboardTab === 'fundamental' ? '#5eead4' : '#6e7681',
                  transition: 'all 0.15s',
                }}
              >
                Fundamental
              </button>
              <button
                onClick={() => setLeaderboardTab('technical')}
                style={{
                  padding: '4px 12px',
                  borderRadius: '16px',
                  fontSize: '11px',
                  fontWeight: '600',
                  border: 'none',
                  cursor: 'pointer',
                  background: leaderboardTab === 'technical' ? 'rgba(167, 139, 250, 0.15)' : 'transparent',
                  color: leaderboardTab === 'technical' ? '#a78bfa' : '#6e7681',
                  transition: 'all 0.15s',
                }}
              >
                Technical
              </button>
            </div>
          </div>

          {/* Conditional leaderboard render */}
          {leaderboardTab === 'fundamental' ? (
            data.leaderboard?.length > 0 ? (
              <SectorLeaderboard
                data={data}
                currentSymbol={symbol}
                onNavigateToStock={onNavigateToStock}
                isMobile={isMobile}
              />
            ) : (
              <div style={{
                padding: '16px', borderRadius: '8px',
                background: 'rgba(255,255,255,0.03)',
                fontSize: '12px', color: '#8b949e', textAlign: 'center',
              }}>
                Fundamental leaderboard not available
              </div>
            )
          ) : (
            rankingsData?.stocks && currentStockRanking?.sectorId ? (
              <RanksLeaderboard
                type="technical"
                stocks={rankingsData.stocks}
                currentSymbol={symbol}
                onNavigateToStock={onNavigateToStock}
                title={`${currentStockRanking.sectorName || data.sectorName || 'Sector'} Technical Leaderboard`}
                sectorFilter={currentStockRanking.sectorId}
              />
            ) : (
              <div style={{
                padding: '16px', borderRadius: '8px',
                background: 'rgba(255,255,255,0.03)',
                fontSize: '12px', color: '#8b949e', textAlign: 'center',
              }}>
                Technical rankings not available
              </div>
            )
          )}
        </div>
      )}

      <ScannerBadges scanner={data.scanner} />
    </div>
  );
};

export default CompeteTab;
