import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, ChevronRight, ChevronDown, TrendingUp, TrendingDown } from 'lucide-react';
import { SECTORS } from '../../constants/sectors';

const MONO = "'JetBrains Mono', 'SF Mono', monospace";
const CYAN = '#06b6d4';

// ── Formatting Helpers ──
function formatShares(n) {
  if (!n) return '0';
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return n.toLocaleString();
}

function formatPct(n) {
  if (n == null) return '';
  return `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;
}

function formatWeight(n) {
  if (n == null) return '0%';
  return `${n.toFixed(2)}%`;
}

// ── Constants ──
const ARCHETYPE_STYLES = {
  index_passive: { label: 'Index',     color: '#64748b', bg: 'rgba(100, 116, 139, 0.15)', border: 'rgba(100, 116, 139, 0.3)' },
  long_only:     { label: 'Long-Only', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.1)',    border: 'rgba(6, 182, 212, 0.3)' },
  quantitative:  { label: 'Quant',     color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.1)',  border: 'rgba(167, 139, 250, 0.3)' },
  transient:     { label: 'Transient', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)',   border: 'rgba(245, 158, 11, 0.3)' },
  activist:      { label: 'Activist',  color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)',    border: 'rgba(239, 68, 68, 0.3)' },
};

const STORYLINE_BORDERS = {
  cluster_buy: '#06b6d4',
  new_position: '#06b6d4',
  exit: '#ef4444',
  high_conviction: '#4ddcc6',
  trimming: '#f59e0b',
};

const STORYLINE_ICONS = {
  cluster_buy: '\u26A1',
  new_position: '\uD83C\uDFAF',
  exit: '\u26A0\uFE0F',
  high_conviction: '\uD83D\uDCC8',
  trimming: '\uD83D\uDCC9',
};

const STORYLINE_LABELS = {
  cluster_buy: 'Cluster Buy',
  new_position: 'New Position',
  exit: 'Exit Signal',
  high_conviction: 'High Conviction',
  trimming: 'Trimming',
};

const SECTOR_SHORT = {
  XLK: 'Technology', XLV: 'Healthcare', XLF: 'Financials', XLE: 'Energy',
  XLY: 'Consumer Disc.', XLP: 'Consumer Staples', XLI: 'Industrials',
  XLB: 'Materials', XLU: 'Utilities', XLRE: 'Real Estate', XLC: 'Communications',
};

// ══════════════════════════════════════
// ── Component 1: HeroHeadlineCard ──
// ══════════════════════════════════════
export const HeroHeadlineCard = ({ headline, onAnalyze, updatedAt }) => {
  if (!headline) return null;

  const dateLabel = updatedAt?.toDate
    ? updatedAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div style={{
      background: '#15171E',
      borderLeft: '4px solid #06b6d4',
      borderRadius: '0px',
      padding: '24px',
      marginBottom: '24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Radial cyan glow */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'radial-gradient(circle at top left, rgba(6, 182, 212, 0.12) 0%, transparent 60%)',
        pointerEvents: 'none',
      }} />

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{
          fontSize: '10px', fontFamily: MONO, color: CYAN,
          textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '12px',
        }}>
          {'\uD83D\uDCE1'} Quarterly Strategy Reveal
        </div>

        <div style={{
          fontSize: '20px', fontWeight: 700, color: '#ffffff',
          lineHeight: 1.3, marginBottom: '16px',
        }}>
          {headline}
        </div>

        {onAnalyze && (
          <button
            onClick={onAnalyze}
            style={{
              background: '#06b6d4', color: '#003640',
              padding: '8px 20px', fontSize: '11px', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.1em',
              border: 'none', cursor: 'pointer', borderRadius: '0px',
            }}
          >
            Analyze Sector Flows &rarr;
          </button>
        )}

        {dateLabel && (
          <div style={{
            fontSize: '10px', fontFamily: MONO, color: '#6b7280', marginTop: '12px',
          }}>
            Filed {dateLabel} &middot; 45-day SEC reporting lag
          </div>
        )}
      </div>
    </div>
  );
};

// ══════════════════════════════════════
// ── Component 2: AlphaFeed ──
// ══════════════════════════════════════
export const AlphaFeed = ({ storylines, onStockTap }) => {
  if (!storylines?.length) return null;

  return (
    <div style={{
      display: 'flex',
      gap: '12px',
      overflowX: 'auto',
      WebkitOverflowScrolling: 'touch',
      scrollSnapType: 'x mandatory',
      paddingBottom: '8px',
      scrollbarWidth: 'none',
      msOverflowStyle: 'none',
    }}>
      {storylines.map((s, i) => {
        const borderColor = STORYLINE_BORDERS[s.type] || CYAN;
        const icon = STORYLINE_ICONS[s.type] || '\u26A1';
        const label = STORYLINE_LABELS[s.type] || s.type;

        return (
          <motion.div
            key={`${s.symbol}-${i}`}
            whileTap={{ scale: 0.97 }}
            onClick={() => onStockTap && onStockTap(s.symbol)}
            style={{
              flexShrink: 0,
              width: '280px',
              height: '140px',
              background: '#15171E',
              borderLeft: `4px solid ${borderColor}`,
              borderRadius: '12px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: 'pointer',
              scrollSnapAlign: 'start',
            }}
          >
            {/* Eyebrow */}
            <div style={{
              fontSize: '10px', fontFamily: MONO, color: '#6b7280',
              textTransform: 'uppercase',
            }}>
              {icon} {label} &middot; Q Filing
            </div>

            {/* Headline */}
            <div style={{
              fontSize: '13px', fontWeight: 700, color: '#ffffff', lineHeight: 1.4,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              overflow: 'hidden', flex: 1, marginTop: '8px',
            }}>
              {s.headline}
            </div>

            {/* Bottom row */}
            <div style={{
              borderTop: '1px solid rgba(255,255,255,0.06)',
              paddingTop: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{
                fontSize: '12px', fontFamily: MONO, fontWeight: 700, color: borderColor,
              }}>
                {s.metric}
              </span>
              <span style={{ fontSize: '12px', color: borderColor }}>{'\u26A1'}</span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

// ══════════════════════════════════════
// ── Component 3: SectorRotation ──
// ══════════════════════════════════════
export const SectorRotation = ({ sectorFlows, sectorDrivers, isMobile }) => {
  if (!sectorFlows || Object.keys(sectorFlows).length === 0) return null;

  const entries = Object.entries(sectorFlows)
    .map(([etf, flow]) => ({ etf, ...flow }))
    .sort((a, b) => (b.netBuyers + b.netSellers) - (a.netBuyers + a.netSellers));

  const maxFlow = Math.max(
    ...entries.map(f => Math.max(f.netBuyers || 0, f.netSellers || 0)),
    1
  );

  return (
    <div>
      {entries.map(({ etf, netBuyers, netSellers }) => {
        const sectorName = SECTORS[etf]?.name || SECTOR_SHORT[etf] || etf;
        const drivers = sectorDrivers?.[etf] || {};
        const accTickers = drivers.accumulators || [];
        const distTickers = drivers.distributors || [];

        const buyWidth = Math.max(5, ((netBuyers || 0) / maxFlow) * 100);
        const sellWidth = Math.max(5, ((netSellers || 0) / maxFlow) * 100);

        return (
          <div key={etf} style={{ marginBottom: '16px' }}>
            {/* Sector name */}
            <div style={{
              fontSize: '11px', fontWeight: 600, color: '#9ca3af',
              textTransform: 'uppercase', textAlign: 'center',
              marginBottom: '4px', letterSpacing: '0.1em',
            }}>
              {sectorName}
            </div>

            {/* Tug-of-war bars */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 2px 1fr',
              alignItems: 'center',
              height: '28px',
            }}>
              {/* Left bar (distribution) — grows right-to-left */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{
                  width: `${sellWidth}%`,
                  height: '20px',
                  background: 'rgba(239, 68, 68, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  paddingRight: '6px',
                  borderRadius: '2px 0 0 2px',
                }}>
                  {distTickers.length > 0 && (
                    <span style={{
                      fontSize: '9px', fontFamily: MONO, color: '#ef4444',
                      fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {distTickers.slice(0, 3).join(',')}
                    </span>
                  )}
                </div>
              </div>

              {/* Center axis */}
              <div style={{ height: '100%', background: '#1C1A27', width: '2px' }} />

              {/* Right bar (accumulation) — grows left-to-right */}
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{
                  width: `${buyWidth}%`,
                  height: '20px',
                  background: 'rgba(6, 182, 212, 0.25)',
                  boxShadow: '0 0 8px rgba(6, 182, 212, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: '6px',
                  borderRadius: '0 2px 2px 0',
                }}>
                  {accTickers.length > 0 && (
                    <span style={{
                      fontSize: '9px', fontFamily: MONO, color: CYAN,
                      fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {accTickers.slice(0, 3).join(',')}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Counts */}
            <div style={{
              fontSize: '9px', fontFamily: MONO, color: '#6b7280',
              display: 'flex', justifyContent: 'space-between', marginTop: '2px',
            }}>
              <span>Distributing ({netSellers || 0})</span>
              <span>Accumulating ({netBuyers || 0})</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ══════════════════════════════════════
// ── Component 4: CapitolHillTeaser ──
// ══════════════════════════════════════
export const CapitolHillTeaser = () => {
  const [notified, setNotified] = useState(false);

  return (
    <div style={{
      background: '#15171E',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '12px',
      padding: '24px',
      textAlign: 'center',
      marginTop: '32px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Blurred background text */}
      <div style={{
        position: 'absolute',
        top: '10px', left: '10px', right: '10px',
        fontSize: '10px', fontFamily: MONO,
        color: 'rgba(255,255,255,0.06)',
        filter: 'blur(3px)',
        lineHeight: 1.8,
        pointerEvents: 'none',
      }}>
        N. Pelosi purchased $1M-$5M NVDA &middot; M. Mullin sold $50K-$100K RTX &middot; T. Tuberville purchased $15K-$50K defense ETF &middot; D. Feinstein sold $500K-$1M MSFT &middot; T. Carper purchased $100K-$250K AAPL
      </div>

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <Lock size={24} style={{ color: '#6b7280', marginBottom: '12px' }} />

        <div style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', marginBottom: '4px' }}>
          Capitol Hill Alpha
        </div>

        <div style={{
          fontSize: '11px', color: CYAN, fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px',
        }}>
          Coming Soon
        </div>

        <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '16px', lineHeight: 1.5 }}>
          Track committee-linked trades from U.S. Congress members
        </div>

        <button
          onClick={() => setNotified(!notified)}
          style={{
            background: 'transparent',
            border: `1px solid ${notified ? 'rgba(6, 182, 212, 0.2)' : 'rgba(6, 182, 212, 0.4)'}`,
            color: CYAN,
            padding: '8px 20px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            borderRadius: '4px',
          }}
        >
          {notified ? '\u2713 You\'re on the list' : 'Notify Me'}
        </button>
      </div>
    </div>
  );
};

// ══════════════════════════════════════
// ── Component 5: WhaleLeaderboard ──
// ══════════════════════════════════════
export const WhaleLeaderboard = ({ institutions, onStockTap, isMobile }) => {
  const [expandedId, setExpandedId] = useState(null);
  const [showAll, setShowAll] = useState(false);

  if (!institutions?.length) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center', color: '#6b7280', fontSize: '13px' }}>
        No institutional leaderboard data available.
      </div>
    );
  }

  const visible = showAll ? institutions : institutions.slice(0, 10);
  const hasMore = institutions.length > 10;

  return (
    <div>
      {visible.map((inst, i) => {
        const arch = ARCHETYPE_STYLES[inst.archetype];
        const isExpanded = expandedId === inst.name;
        const topBet = inst.topConviction?.[0];

        return (
          <div key={inst.name || i}>
            {/* Collapsed row */}
            <div
              onClick={() => setExpandedId(isExpanded ? null : inst.name)}
              style={{
                background: isExpanded ? '#15171E' : 'transparent',
                borderLeft: isExpanded ? '4px solid #06b6d4' : '4px solid transparent',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                padding: '14px 16px',
                cursor: 'pointer',
              }}
            >
              {/* Line 1: Rank + Name + Archetype + Chevron */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  fontSize: '14px', fontFamily: MONO, color: CYAN,
                  fontWeight: 700, marginRight: '4px', minWidth: '24px',
                }}>
                  {i + 1}.
                </span>

                <span style={{
                  fontSize: '14px', fontWeight: 600, color: '#ffffff',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                }}>
                  {inst.name}
                </span>

                {arch && (
                  <span style={{
                    fontSize: '9px', fontWeight: 600, padding: '2px 8px',
                    borderRadius: '4px', textTransform: 'uppercase', fontFamily: MONO,
                    color: arch.color, background: arch.bg,
                    border: `0.5px solid ${arch.border}`,
                    flexShrink: 0,
                  }}>
                    {arch.label}
                  </span>
                )}

                {isExpanded
                  ? <ChevronDown size={16} style={{ color: '#6b7280', flexShrink: 0 }} />
                  : <ChevronRight size={16} style={{ color: '#6b7280', flexShrink: 0 }} />
                }
              </div>

              {/* Line 2: Top Bet */}
              {topBet && (
                <div style={{
                  fontSize: '11px', color: '#6b7280', fontFamily: MONO, marginTop: '4px',
                  paddingLeft: '36px',
                }}>
                  Top Bet: {topBet.symbol} ({formatWeight(topBet.weight)})
                </div>
              )}
            </div>

            {/* Expanded section */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div style={{
                    padding: '0 16px 16px 20px',
                    borderLeft: '4px solid #06b6d4',
                    background: '#15171E',
                  }}>
                    {/* Highest Conviction */}
                    <div style={{
                      fontSize: '10px', fontFamily: MONO, color: '#6b7280',
                      textTransform: 'uppercase', letterSpacing: '0.15em',
                      marginBottom: '12px', marginTop: '8px',
                    }}>
                      Highest Conviction (By Portfolio Weight)
                    </div>

                    {(inst.topConviction || []).slice(0, 5).map((pos, j) => {
                      const maxWeight = inst.topConviction?.[0]?.weight || 1;
                      const barPct = (pos.weight / maxWeight) * 100;

                      return (
                        <div key={pos.symbol} style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          marginBottom: '8px',
                        }}>
                          <span
                            onClick={(e) => { e.stopPropagation(); onStockTap && onStockTap(pos.symbol); }}
                            style={{
                              fontSize: '13px', fontFamily: MONO, fontWeight: 700,
                              color: '#ffffff', minWidth: '48px', cursor: 'pointer',
                            }}
                          >
                            {pos.symbol}
                          </span>

                          {/* Bar */}
                          <div style={{
                            flex: 1, height: '4px', background: '#1C1A27',
                            borderRadius: '2px', overflow: 'hidden',
                          }}>
                            <div style={{
                              width: `${barPct}%`, height: '100%',
                              background: CYAN, borderRadius: '2px',
                            }} />
                          </div>

                          <span style={{
                            fontSize: '12px', fontFamily: MONO, color: CYAN,
                            fontWeight: 600, minWidth: '48px', textAlign: 'right',
                          }}>
                            {formatWeight(pos.weight)}
                          </span>
                        </div>
                      );
                    })}

                    {/* Major Moves */}
                    <div style={{
                      fontSize: '10px', fontFamily: MONO, color: '#6b7280',
                      textTransform: 'uppercase', letterSpacing: '0.15em',
                      marginBottom: '12px', marginTop: '20px',
                    }}>
                      Major Moves
                    </div>

                    {/* Biggest Add */}
                    {inst.biggestAdd ? (
                      <div style={{
                        borderLeft: '3px solid #4ddcc6', background: '#0D0E12',
                        padding: '10px', marginBottom: '8px', borderRadius: '0 4px 4px 0',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <TrendingUp size={14} style={{ color: '#4ddcc6' }} />
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
                            Added: +{formatShares(inst.biggestAdd.changeShares)} {inst.biggestAdd.symbol}
                          </span>
                        </div>
                        <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '4px', paddingLeft: '20px' }}>
                          Position increase: {formatPct(inst.biggestAdd.changePct)}
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '11px', color: '#6b7280', fontFamily: MONO, marginBottom: '8px' }}>
                        No significant additions
                      </div>
                    )}

                    {/* Biggest Cut */}
                    {inst.biggestCut ? (
                      <div style={{
                        borderLeft: '3px solid #ef4444', background: '#0D0E12',
                        padding: '10px', marginBottom: '8px', borderRadius: '0 4px 4px 0',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <TrendingDown size={14} style={{ color: '#ef4444' }} />
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
                            Cut: {formatShares(inst.biggestCut.changeShares)} {inst.biggestCut.symbol}
                          </span>
                        </div>
                        <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '4px', paddingLeft: '20px' }}>
                          Position reduction: {formatPct(inst.biggestCut.changePct)}
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '11px', color: '#6b7280', fontFamily: MONO, marginBottom: '8px' }}>
                        No significant reductions
                      </div>
                    )}

                    {/* View Full Portfolio */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onStockTap && topBet) onStockTap(topBet.symbol);
                      }}
                      style={{
                        width: '100%',
                        background: '#06b6d4',
                        color: '#003640',
                        padding: '10px',
                        fontSize: '11px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        border: 'none',
                        cursor: 'pointer',
                        marginTop: '16px',
                        borderRadius: '0px',
                      }}
                    >
                      View Full Portfolio
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}

      {/* Show more / less */}
      {hasMore && (
        <button
          onClick={() => setShowAll(!showAll)}
          style={{
            background: 'none', border: 'none', color: CYAN,
            fontSize: '11px', fontWeight: 500, cursor: 'pointer',
            padding: '10px 0', fontFamily: MONO,
          }}
        >
          {showAll ? 'Show less' : `Show all ${institutions.length} \u2192`}
        </button>
      )}
    </div>
  );
};
