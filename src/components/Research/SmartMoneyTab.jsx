import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  LogOut,
  Building2,
  BarChart3,
  Hammer,
  ChevronRight,
} from 'lucide-react';

const MONO = "'JetBrains Mono', 'SF Mono', monospace";

// ── Conviction level styling ──
const CONVICTION_COLORS = {
  strong_accumulation: { bg: 'rgba(6, 182, 212, 0.15)', border: 'rgba(6, 182, 212, 0.4)', text: '#06b6d4', label: 'Strong Accumulation' },
  mild_accumulation:   { bg: 'rgba(6, 182, 212, 0.08)', border: 'rgba(6, 182, 212, 0.2)', text: '#06b6d4', label: 'Mild Accumulation' },
  neutral:             { bg: 'rgba(148, 163, 184, 0.1)', border: 'rgba(148, 163, 184, 0.2)', text: '#94a3b8', label: 'Neutral' },
  mild_distribution:   { bg: 'rgba(239, 68, 68, 0.08)', border: 'rgba(239, 68, 68, 0.2)', text: '#ef4444', label: 'Mild Distribution' },
  strong_distribution: { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.4)', text: '#ef4444', label: 'Strong Distribution' },
};

// ── Archetype tag pills ──
const ARCHETYPE_STYLES = {
  index_passive: { label: 'Index',     color: '#64748b', bg: 'rgba(100, 116, 139, 0.12)' },
  long_only:     { label: 'Long-Only', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.10)' },
  quantitative:  { label: 'Quant',     color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.10)' },
  transient:     { label: 'Transient', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.10)' },
  activist:      { label: 'Activist',  color: '#ef4444', bg: 'rgba(239, 68, 68, 0.10)' },
};

// ── Signal badges ──
const SIGNAL_STYLES = {
  accumulating:  { Icon: TrendingUp,   color: '#06b6d4', label: 'Accumulating' },
  new_position:  { Icon: Sparkles,     color: '#06b6d4', label: 'New Position' },
  trimming:      { Icon: TrendingDown, color: '#f59e0b', label: 'Trimming' },
  exiting:       { Icon: LogOut,       color: '#ef4444', label: 'Exiting' },
  unchanged:     { Icon: Minus,        color: '#64748b', label: 'Unchanged' },
};

// ── Number formatting ──
function formatShares(n) {
  if (n == null) return '—';
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return n.toLocaleString();
}

function formatPct(n) {
  if (n == null) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

const INITIAL_SHOW = 5;

// ── Shimmer skeleton ──
const shimmerStyle = {
  background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s infinite',
  borderRadius: '6px',
};

const LoadingSkeleton = () => (
  <div style={{ padding: '8px 0' }}>
    <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    {/* Conviction header skeleton */}
    <div style={{ height: '72px', marginBottom: '16px', ...shimmerStyle }} />
    {/* Section header */}
    <div style={{ height: '14px', width: '55%', marginBottom: '12px', ...shimmerStyle }} />
    {/* Holder rows */}
    {[1, 2, 3, 4, 5].map(i => (
      <div key={i} style={{ height: '48px', marginBottom: '8px', ...shimmerStyle }} />
    ))}
  </div>
);

// ── Archetype Pill ──
const ArchetypePill = ({ archetype }) => {
  const style = ARCHETYPE_STYLES[archetype];
  if (!style) return null;
  return (
    <span style={{
      padding: '2px 8px',
      borderRadius: '10px',
      fontSize: '10px',
      fontWeight: 600,
      fontFamily: MONO,
      color: style.color,
      background: style.bg,
      whiteSpace: 'nowrap',
      flexShrink: 0,
    }}>
      {style.label}
    </span>
  );
};

// ── Signal Badge ──
const SignalBadge = ({ signal }) => {
  const style = SIGNAL_STYLES[signal];
  if (!style) return null;
  const { Icon, color, label } = style;
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '3px',
      padding: '2px 7px',
      borderRadius: '10px',
      fontSize: '10px',
      fontWeight: 600,
      fontFamily: MONO,
      color,
      background: `${color}15`,
      whiteSpace: 'nowrap',
      flexShrink: 0,
    }}>
      <Icon size={10} />
      {label}
    </span>
  );
};

// ── Holder Row ──
const HolderRow = ({ holder, index, showArchetype }) => {
  const changePct = holder.changePct;
  const isPositive = changePct > 0;
  const isNegative = changePct < 0;
  const changeColor = isPositive ? '#06b6d4' : isNegative ? '#ef4444' : '#64748b';

  return (
    <div style={{
      padding: '10px 0',
      borderBottom: '0.5px solid rgba(255,255,255,0.06)',
      background: index % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent',
    }}>
      {/* Line 1: Name + pills */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        marginBottom: '4px',
      }}>
        <span style={{
          color: 'rgba(255,255,255,0.85)',
          fontSize: '12px',
          fontWeight: 500,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          minWidth: 0,
          flex: 1,
        }}>
          {holder.name}
        </span>
        {showArchetype && <ArchetypePill archetype={holder.archetype} />}
        <SignalBadge signal={holder.signal} />
      </div>
      {/* Line 2: Shares · % outstanding · change% */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '11px',
        fontFamily: MONO,
        color: 'rgba(255,255,255,0.45)',
      }}>
        <span>{formatShares(holder.currentShares)} shares</span>
        <span style={{ opacity: 0.4 }}>&middot;</span>
        <span>{holder.totalSharesPct != null ? `${holder.totalSharesPct.toFixed(2)}%` : '—'}</span>
        <span style={{ opacity: 0.4 }}>&middot;</span>
        <span style={{ color: changeColor }}>
          {formatPct(changePct)}
          {isPositive ? ' \u25B2' : isNegative ? ' \u25BC' : ''}
        </span>
      </div>
    </div>
  );
};

// ── Holder Section (Institutions or Funds) ──
const HolderSection = ({ title, icon: SectionIcon, holders, showArchetype }) => {
  const [showAll, setShowAll] = useState(false);
  const visibleHolders = showAll ? holders : holders.slice(0, INITIAL_SHOW);
  const hasMore = holders.length > INITIAL_SHOW;

  return (
    <div style={{ marginTop: '20px' }}>
      {/* Section header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        marginBottom: '8px',
      }}>
        <SectionIcon size={14} style={{ color: '#06b6d4' }} />
        <span style={{
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '1px',
          color: 'rgba(255,255,255,0.4)',
          textTransform: 'uppercase',
          fontFamily: MONO,
        }}>
          {title}
        </span>
        <span style={{
          fontSize: '10px',
          color: 'rgba(255,255,255,0.25)',
          fontFamily: MONO,
        }}>
          ({holders.length})
        </span>
      </div>

      {/* Holder rows */}
      {visibleHolders.map((holder, i) => (
        <HolderRow
          key={holder.name || i}
          holder={holder}
          index={i}
          showArchetype={showArchetype}
        />
      ))}

      {/* Show more / less toggle */}
      {hasMore && (
        <button
          onClick={() => setShowAll(!showAll)}
          style={{
            background: 'none',
            border: 'none',
            color: '#06b6d4',
            fontSize: '11px',
            fontWeight: 500,
            cursor: 'pointer',
            padding: '8px 0',
            fontFamily: MONO,
          }}
        >
          {showAll ? 'Show less' : `Show all ${holders.length} \u2192`}
        </button>
      )}
    </div>
  );
};

// ── Conviction Header ──
const ConvictionHeader = ({ summary }) => {
  const conviction = CONVICTION_COLORS[summary.conviction] || CONVICTION_COLORS.neutral;
  const total = (summary.buyersCount || 0) + (summary.sellersCount || 0) + (summary.unchangedCount || 0);
  const buyerPct = total > 0 ? ((summary.buyersCount || 0) / total) * 100 : 0;
  const sellerPct = total > 0 ? ((summary.sellersCount || 0) / total) * 100 : 0;
  const unchangedPct = total > 0 ? 100 - buyerPct - sellerPct : 100;

  return (
    <div style={{
      padding: '14px',
      borderRadius: '12px',
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.06)',
    }}>
      {/* Top row: badge + score */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '10px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Conviction badge */}
          <span style={{
            padding: '3px 10px',
            borderRadius: '8px',
            fontSize: '11px',
            fontWeight: 600,
            color: conviction.text,
            background: conviction.bg,
            border: `1px solid ${conviction.border}`,
          }}>
            {conviction.label}
          </span>
          {/* Cluster Buy badge */}
          {summary.clusterBuy && (
            <span style={{
              padding: '3px 8px',
              borderRadius: '8px',
              fontSize: '10px',
              fontWeight: 700,
              fontFamily: MONO,
              color: '#06b6d4',
              background: 'rgba(6, 182, 212, 0.15)',
              border: '1px solid rgba(6, 182, 212, 0.3)',
            }}>
              <Sparkles size={10} style={{ marginRight: '3px', verticalAlign: 'middle' }} />
              Cluster Buy
            </span>
          )}
        </div>
        {/* Conviction score */}
        <span style={{
          fontFamily: MONO,
          fontSize: '18px',
          fontWeight: 700,
          color: conviction.text,
        }}>
          {summary.convictionScore != null ? summary.convictionScore.toFixed(1) : '—'}
        </span>
      </div>

      {/* Buyer / Seller ratio bar */}
      <div style={{
        height: '4px',
        borderRadius: '2px',
        overflow: 'hidden',
        display: 'flex',
        background: 'rgba(148, 163, 184, 0.15)',
        marginBottom: '10px',
      }}>
        {buyerPct > 0 && (
          <div style={{ width: `${buyerPct}%`, background: '#06b6d4', transition: 'width 0.3s' }} />
        )}
        {sellerPct > 0 && (
          <div style={{ width: `${sellerPct}%`, background: '#ef4444', transition: 'width 0.3s' }} />
        )}
        {unchangedPct > 0 && (
          <div style={{ width: `${unchangedPct}%`, background: 'rgba(148, 163, 184, 0.3)', transition: 'width 0.3s' }} />
        )}
      </div>

      {/* Stats row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        fontSize: '10px',
        fontFamily: MONO,
        color: 'rgba(255,255,255,0.45)',
        flexWrap: 'wrap',
      }}>
        <span>
          <span style={{ color: '#06b6d4', fontWeight: 600 }}>{summary.buyersCount || 0}</span> buyers
        </span>
        <span>
          <span style={{ color: '#ef4444', fontWeight: 600 }}>{summary.sellersCount || 0}</span> sellers
        </span>
        <span>
          <span style={{ fontWeight: 600 }}>{summary.activeHolders || 0}</span> active holders
        </span>
        {summary.newPositionsCount > 0 && (
          <span>
            <span style={{ color: '#06b6d4', fontWeight: 600 }}>{summary.newPositionsCount}</span> new positions
          </span>
        )}
        {summary.reportDate && (
          <span style={{ marginLeft: 'auto', opacity: 0.6 }}>
            as of {summary.reportDate}
          </span>
        )}
      </div>
    </div>
  );
};

// ── Forge Teaser CTA ──
const ForgeTeaser = () => (
  <div style={{
    background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.08) 0%, rgba(13, 14, 18, 0.95) 70%)',
    border: '0.5px solid rgba(6, 182, 212, 0.15)',
    borderRadius: '12px',
    padding: '14px',
    marginTop: '20px',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
      <Hammer size={14} style={{ color: '#06b6d4' }} />
      <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '12px', fontWeight: 600 }}>
        Turn this into a strategy
      </span>
    </div>
    <p style={{
      color: 'rgba(255,255,255,0.45)',
      fontSize: '11px',
      lineHeight: '1.5',
      margin: '0 0 8px 0',
    }}>
      Use institutional conviction signals in The Forge to power your AI agent
    </p>
    <span style={{
      color: '#06b6d4',
      fontSize: '11px',
      fontWeight: 500,
      display: 'inline-flex',
      alignItems: 'center',
      gap: '3px',
    }}>
      Explore Forge Rules <ChevronRight size={12} />
    </span>
  </div>
);

// ══════════════════════════════════════
// ── SmartMoneyTab Main Component ──
// ══════════════════════════════════════
const SmartMoneyTab = ({ symbol, isMobile }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(false);
      try {
        const snap = await getDoc(doc(db, 'institutionalHoldings', symbol));
        if (!cancelled) {
          setData(snap.exists() ? snap.data() : null);
        }
      } catch (err) {
        console.error('[SmartMoney] Error fetching institutional data:', err);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [symbol]);

  // ── Loading ──
  if (loading) return <LoadingSkeleton />;

  // ── Error ──
  if (error) {
    return (
      <div style={{
        padding: '40px 20px',
        textAlign: 'center',
        color: 'rgba(255,255,255,0.35)',
        fontSize: '12px',
      }}>
        Failed to load institutional data. Please try again.
      </div>
    );
  }

  // ── No data ──
  if (!data) {
    return (
      <div style={{
        padding: '40px 20px',
        textAlign: 'center',
        color: 'rgba(255,255,255,0.35)',
        fontSize: '12px',
      }}>
        No institutional data available for {symbol}.
      </div>
    );
  }

  const { institutions = [], funds = [], summary } = data;

  return (
    <div style={{ padding: '8px 0' }}>
      {/* Conviction Header */}
      {summary && <ConvictionHeader summary={summary} />}

      {/* Top Institutional Holders */}
      {institutions.length > 0 && (
        <HolderSection
          title="Top Institutional Holders"
          icon={Building2}
          holders={institutions}
          showArchetype
        />
      )}

      {/* Top Mutual Fund Holders */}
      {funds.length > 0 && (
        <HolderSection
          title="Top Mutual Fund Holders"
          icon={BarChart3}
          holders={funds}
          showArchetype={false}
        />
      )}

      {/* Forge Teaser */}
      <ForgeTeaser />
    </div>
  );
};

export default SmartMoneyTab;
