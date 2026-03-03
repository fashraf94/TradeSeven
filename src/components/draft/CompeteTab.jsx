import React, { useState, useEffect } from 'react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MONO_FONT = "'JetBrains Mono', 'SF Mono', monospace";

const PILLAR_CONFIG = [
  { key: 'growth',        label: 'Growth',        dims: ['growth'] },
  { key: 'profitability', label: 'Profitability',  dims: ['profitability', 'profitabilityTrend'] },
  { key: 'efficiency',    label: 'Efficiency',     dims: ['efficiency'] },
  { key: 'valuation',     label: 'Valuation',      dims: ['valuation'] },
  { key: 'health',        label: 'Health',          dims: ['healthCash', 'healthDebt'] },
  { key: 'sentiment',     label: 'Sentiment',       dims: ['sentimentPrice', 'sentimentRevisions'] },
];

const DIM_META = {
  growth:             { label: 'Revenue Growth YoY',       unit: '%',    format: v => `${(v * 100).toFixed(1)}%` },
  profitability:      { label: 'Operating Margin TTM',     unit: '%',    format: v => `${(v * 100).toFixed(1)}%` },
  profitabilityTrend: { label: 'Margin Trend (YoY)',       unit: 'pp',   format: v => {
    if (v == null) return '–';
    const arrow = v >= 0 ? '▲' : '▼';
    const word = v >= 0 ? 'Expanding' : 'Compressing';
    return `${arrow} ${word} (${v >= 0 ? '+' : ''}${v.toFixed(1)}pp)`;
  }},
  efficiency:         { label: 'Return on Assets TTM',     unit: '%',    format: v => `${(v * 100).toFixed(1)}%` },
  valuation:          { label: 'Forward P/E',              unit: 'x',    format: v => v > 0 ? `${v.toFixed(1)}x` : 'N/A' },
  healthCash:         { label: 'FCF Yield',                unit: '%',    format: v => `${v.toFixed(1)}%` },
  healthDebt:         { label: 'Interest Coverage',        unit: 'x',    format: v => `${v.toFixed(1)}x` },
  sentimentPrice:     { label: '52-Week Range Position',   unit: '%',    format: v => `${v.toFixed(0)}%` },
  sentimentRevisions: { label: 'Earnings Revisions',       unit: '%',    format: v => {
    if (v == null) return '–';
    const arrow = v >= 0 ? '▲' : '▼';
    const word = v >= 0 ? 'Positive' : 'Negative';
    return `${arrow} ${word} (${v >= 0 ? '+' : ''}${v.toFixed(1)}%)`;
  }},
};

function getTierColor(percentile) {
  if (percentile == null) return '#6e7681';
  if (percentile >= 80) return '#ffd700';
  if (percentile >= 60) return '#00d9ff';
  if (percentile >= 40) return '#8b949e';
  if (percentile >= 20) return '#f59e0b';
  return '#f85149';
}

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

function SkeletonLoader() {
  return (
    <div style={{ padding: '8px 0' }}>
      {[1, 2, 3, 4].map(i => (
        <div key={i} style={{
          height: '36px', borderRadius: '6px', marginBottom: '8px',
          background: 'rgba(255,255,255,0.04)',
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
      ))}
      <style>{`@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Not Available State
// ---------------------------------------------------------------------------

function NotAvailableCard({ error }) {
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
        {error || 'This stock is not in the ranking universe. Rankings cover ~220 S&P 500 stocks across 11 GICS sectors.'}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sector Banner
// ---------------------------------------------------------------------------

function SectorBanner({ data }) {
  const summary = data.sectorSummary;
  if (!summary) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '6px',
      padding: '6px 10px', marginBottom: '10px', borderRadius: '6px',
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.06)',
      fontSize: '11px', color: '#8b949e',
    }}>
      <span style={{
        width: '8px', height: '8px', borderRadius: '50%',
        background: summary.tier?.color || '#8b949e', flexShrink: 0,
      }} />
      <span style={{ color: '#e6edf3', fontWeight: '600' }}>{summary.name}</span>
      <span>·</span>
      <span>{data.sectorId}</span>
      <span>·</span>
      <span>Rank #{summary.rank} of {summary.totalSectors} sectors</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Composite Rank Card
// ---------------------------------------------------------------------------

function CompositeRankCard({ data }) {
  return (
    <div style={{
      textAlign: 'center', padding: '16px 12px', marginBottom: '12px',
      borderRadius: '10px', background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{
        fontSize: '36px', fontWeight: '700', lineHeight: '1',
        color: data.tier?.color || '#e6edf3',
        fontFamily: MONO_FONT,
      }}>
        {data.compositeScore}
      </div>
      <div style={{
        fontSize: '12px', fontWeight: '600', marginTop: '4px',
        color: data.tier?.color || '#8b949e',
        textTransform: 'uppercase', letterSpacing: '0.5px',
      }}>
        {data.tier?.label || 'Unranked'}
      </div>
      <div style={{ fontSize: '11px', color: '#8b949e', marginTop: '4px' }}>
        #{data.compositeRank} of {data.totalPeers} in {data.sectorName}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pillar Row (expandable)
// ---------------------------------------------------------------------------

function PillarRow({ pillar, percentile, dimensions, isExpanded, onToggle }) {
  const color = getTierColor(percentile);

  return (
    <div style={{
      marginBottom: '4px', borderRadius: '6px',
      background: isExpanded ? 'rgba(255,255,255,0.04)' : 'transparent',
      border: '1px solid rgba(255,255,255,0.06)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <button
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          width: '100%', padding: '8px 10px', cursor: 'pointer',
          background: 'none', border: 'none', textAlign: 'left',
        }}
      >
        <span style={{
          fontSize: '11px', fontWeight: '600', color: '#e6edf3',
          flex: '0 0 90px',
        }}>
          {pillar.label}
        </span>

        {/* Bullet chart */}
        <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)' }}>
          <div style={{
            height: '100%', borderRadius: '3px',
            width: percentile != null ? `${percentile}%` : '0%',
            background: color,
            transition: 'width 0.4s ease',
            boxShadow: percentile >= 60 ? `0 0 6px ${color}40` : 'none',
          }} />
        </div>

        <span style={{
          fontSize: '11px', fontWeight: '600', color,
          fontFamily: MONO_FONT, flex: '0 0 32px', textAlign: 'right',
        }}>
          {percentile != null ? percentile : '—'}
        </span>

        <span style={{
          fontSize: '9px', color: '#6e7681', flex: '0 0 12px',
          transition: 'transform 0.2s',
          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
        }}>
          ▼
        </span>
      </button>

      {/* Expanded dimensions */}
      {isExpanded && (
        <div style={{ padding: '0 10px 8px 10px' }}>
          {pillar.dims.map(dimKey => {
            const dim = dimensions?.[dimKey];
            const meta = DIM_META[dimKey];
            if (!dim || !meta) return null;

            const dimColor = getTierColor(dim.percentile);

            return (
              <div key={dimKey} style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '5px 0',
                borderTop: '1px solid rgba(255,255,255,0.04)',
              }}>
                <span style={{ fontSize: '10px', color: '#8b949e', flex: '1', minWidth: 0 }}>
                  {meta.label}
                </span>
                <span style={{
                  fontSize: '10px', fontFamily: MONO_FONT, color: '#e6edf3',
                  flexShrink: 0, textAlign: 'right', whiteSpace: 'nowrap',
                }}>
                  {meta.format(dim.value)}
                </span>
                <span style={{
                  fontSize: '9px', color: '#6e7681',
                  flex: '0 0 50px', textAlign: 'right',
                }}>
                  #{dim.rank}/{dim.totalWithData}
                </span>
                {/* Mini bar */}
                <div style={{
                  flex: '0 0 40px', height: '4px', borderRadius: '2px',
                  background: 'rgba(255,255,255,0.06)',
                }}>
                  <div style={{
                    height: '100%', borderRadius: '2px',
                    width: `${dim.percentile}%`, background: dimColor,
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sector Leaderboard
// ---------------------------------------------------------------------------

function SectorLeaderboard({ leaderboard, currentSymbol, onNavigateToStock }) {
  if (!leaderboard?.length) return null;

  const upperSymbol = currentSymbol?.toUpperCase();

  return (
    <div style={{ marginTop: '12px' }}>
      <div style={{
        fontSize: '10px', color: '#8b949e', marginBottom: '6px',
        textTransform: 'uppercase', letterSpacing: '0.5px',
      }}>
        Sector Leaderboard
      </div>
      <div style={{
        maxHeight: '220px', overflowY: 'auto',
        borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)',
        scrollbarWidth: 'thin', scrollbarColor: '#21262d transparent',
      }}>
        {leaderboard.map(entry => {
          const isMe = entry.ticker === upperSymbol;
          const isClickable = !isMe && !!onNavigateToStock;
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
              <span style={{
                fontSize: '10px', fontFamily: MONO_FONT, color: '#6e7681',
                flex: '0 0 20px', textAlign: 'right',
              }}>
                {entry.rank}
              </span>
              <span style={{
                fontSize: '11px', fontWeight: isMe ? '700' : '600',
                color: isMe ? '#00d9ff' : '#e6edf3',
                flex: '0 0 48px',
              }}>
                {entry.ticker}
              </span>
              <span style={{
                fontSize: '10px', color: '#8b949e', flex: 1,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {entry.name}
              </span>
              <span style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: entry.tierColor || '#8b949e', flexShrink: 0,
              }} />
              <span style={{
                fontSize: '11px', fontWeight: '600', fontFamily: MONO_FONT,
                color: entry.tierColor || '#8b949e',
                flex: '0 0 24px', textAlign: 'right',
              }}>
                {entry.score}
              </span>
            </div>
          );
        })}
      </div>
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
  const [expandedPillar, setExpandedPillar] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    setExpandedPillar(null);

    fetch(`/api/stocks/peer-rankings?symbol=${encodeURIComponent(symbol)}`)
      .then(r => r.json())
      .then(json => {
        if (cancelled) return;
        if (json.success) {
          setData(json.data);
        } else {
          setError(json.message || json.error || 'Peer rankings not available for this stock.');
        }
        setLoading(false);
      })
      .catch(err => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [symbol]);

  if (loading) return <SkeletonLoader />;
  if (error || !data) return <NotAvailableCard error={error} />;

  return (
    <div>
      <SectorBanner data={data} />
      <CompositeRankCard data={data} />

      {/* Pillar Rows */}
      <div style={{
        fontSize: '10px', color: '#8b949e', marginBottom: '6px',
        textTransform: 'uppercase', letterSpacing: '0.5px',
      }}>
        Pillar Breakdown
      </div>
      {PILLAR_CONFIG.map(pillar => (
        <PillarRow
          key={pillar.key}
          pillar={pillar}
          percentile={data.pillars?.[pillar.key]}
          dimensions={data.dimensions}
          isExpanded={expandedPillar === pillar.key}
          onToggle={() => setExpandedPillar(
            expandedPillar === pillar.key ? null : pillar.key
          )}
        />
      ))}

      <SectorLeaderboard leaderboard={data.leaderboard} currentSymbol={symbol} onNavigateToStock={onNavigateToStock} />
    </div>
  );
};

export default CompeteTab;
