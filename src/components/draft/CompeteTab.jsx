import React, { useState, useEffect, useMemo, useCallback } from 'react';

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
  // Backward compat: old 4-pillar keys rendered if present in data
  { key: 'quality',       label: 'Quality',             icon: '💎', legacy: true },
];

// Dimension formatters — values are stored in Firestore as:
//   revenueGrowthYOY, opMarginTTM, roaTTM: EODHD decimals (0.157 = 15.7%)
//   sixMonthReturn, earningsRevisions: already *100 (15.3 = 15.3%)
//   fcfYield: already *100 (3.5 = 3.5%)
//   evEbitda: ratio (15.2 = 15.2x)
const DIM_FORMAT = {
  revenueGrowth:     { label: 'Revenue Growth YoY',  format: v => v != null ? `${(v * 100).toFixed(1)}%` : '—' },
  opMargin:          { label: 'Operating Margin',     format: v => v != null ? `${(v * 100).toFixed(1)}%` : '—' },
  roa:               { label: 'Return on Assets',     format: v => v != null ? `${(v * 100).toFixed(1)}%` : '—' },
  evEbitda:          { label: 'EV/EBITDA',            format: v => v != null ? `${v.toFixed(1)}x` : '—', lowerIsBetter: true },
  fcfYield:          { label: 'FCF Yield',            format: v => v != null ? `${v.toFixed(2)}%` : '—' },
  sixMonthReturn:    { label: '6M Price Return',      format: v => v != null ? `${v.toFixed(1)}%` : '—' },
  earningsRevisions: { label: 'Earnings Revisions',   format: v => v != null ? `${v.toFixed(1)}%` : '—' },
};

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

  // Get the single dimension — support both new (dimension) and old (dimensions) shapes
  const dim = pillarData?.dimension || (pillarData?.dimensions ? Object.values(pillarData.dimensions)[0] : null);
  const dimKey = pillarData?.dimensions ? Object.keys(pillarData.dimensions)[0] : null;
  const meta = dimKey ? DIM_FORMAT[dimKey] : null;

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

      {/* Expanded dimension detail */}
      {isExpanded && dim && meta && (
        <div style={{ padding: '6px 10px 10px 10px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ fontSize: '10px', fontWeight: '600', color: '#e6edf3', marginBottom: '6px' }}>
            {meta.label}{meta.lowerIsBetter ? ' (lower is better)' : ''}
          </div>

          <div style={{ display: 'flex', gap: '12px', fontSize: '10px', marginBottom: '6px' }}>
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
              <span style={{ color, fontFamily: MONO, fontWeight: '600' }}>
                P{dim.percentile}
              </span>
            </div>
          </div>

          {dim.sectorMedian != null && (
            <div style={{ fontSize: '10px', color: '#6e7681' }}>
              Sector median: <span style={{ fontFamily: MONO }}>{meta.format(dim.sectorMedian)}</span>
              {dim.value != null && dim.sectorMedian != null && dim.sectorMedian !== 0 && (() => {
                const ratio = meta.lowerIsBetter
                  ? dim.sectorMedian / dim.value
                  : dim.value / dim.sectorMedian;
                if (ratio > 1.5) return ` · ${ratio.toFixed(1)}x sector median`;
                if (ratio < 0.67) return ` · ${ratio.toFixed(1)}x sector median`;
                return ' · Near sector median';
              })()}
            </div>
          )}
        </div>
      )}

      {/* Show placeholder when expanded but no dimension data */}
      {isExpanded && !dim && (
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
// Main Component
// ---------------------------------------------------------------------------

const CompeteTab = ({ symbol, isMobile, onNavigateToStock }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorStatus, setErrorStatus] = useState(null);
  const [expandedPillar, setExpandedPillar] = useState(null);

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

  // Build the pillar list from data — show whatever pillars exist in the response
  const activePillars = useMemo(() => {
    if (!data?.pillars) return PILLAR_CONFIG.filter(p => !p.legacy);
    return PILLAR_CONFIG.filter(p => {
      if (p.legacy) return !!data.pillars[p.key]; // only show legacy keys if data has them
      return true; // always show new 7-pillar keys
    });
  }, [data]);

  if (loading) return <SkeletonLoader />;
  if (error || !data) return <NotAvailableCard error={error} statusCode={errorStatus} />;

  return (
    <div>
      <StalenessNote computedAt={data.computedAt} />
      <CompositeRankCard data={data} />

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

      <SectorLeaderboard
        data={data}
        currentSymbol={symbol}
        onNavigateToStock={onNavigateToStock}
        isMobile={isMobile}
      />

      <ScannerBadges scanner={data.scanner} />
    </div>
  );
};

export default CompeteTab;
