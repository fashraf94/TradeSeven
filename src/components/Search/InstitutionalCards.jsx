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

function formatAUM(n) {
  if (!n) return null;
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${(n / 1e3).toFixed(0)}K`;
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

// ── Helper: Render text with tappable ticker symbols ──
function renderTextWithTickers(text, tickers, onStockTap) {
  if (!tickers.length || !onStockTap) return text;

  let parts = [text];
  for (const ticker of tickers) {
    const newParts = [];
    for (const part of parts) {
      if (typeof part === 'string') {
        const idx = part.indexOf(ticker);
        if (idx !== -1) {
          if (idx > 0) newParts.push(part.slice(0, idx));
          newParts.push(
            <span
              key={`${ticker}-${idx}`}
              onClick={(e) => { e.stopPropagation(); onStockTap(ticker); }}
              style={{
                color: CYAN,
                fontWeight: 700,
                fontFamily: MONO,
                cursor: 'pointer',
                textDecoration: 'underline',
                textDecorationColor: 'rgba(6, 182, 212, 0.3)',
                textUnderlineOffset: '2px',
              }}
            >
              {ticker}
            </span>
          );
          newParts.push(part.slice(idx + ticker.length));
        } else {
          newParts.push(part);
        }
      } else {
        newParts.push(part);
      }
    }
    parts = newParts;
  }

  return <>{parts}</>;
}

// ══════════════════════════════════════
// ── Component 1: HeroHeadlineCard ──
// ══════════════════════════════════════
export const HeroHeadlineCard = ({ headline, heroInsights, onStockTap, updatedAt }) => {
  if (!headline && !heroInsights?.length) return null;

  const dateLabel = updatedAt?.toDate
    ? updatedAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  const insights = heroInsights?.length ? heroInsights : null;

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

        {insights ? (
          <div style={{ marginBottom: '16px' }}>
            {insights.map((insight, idx) => {
              const isObj = typeof insight === 'object' && insight !== null;
              const text = isObj ? insight.text : insight;
              const tickers = isObj ? (insight.tickers || []) : [];
              const isFirst = idx === 0;

              return (
                <div key={idx} style={{
                  fontSize: isFirst ? '15px' : '13px',
                  fontWeight: isFirst ? 600 : 400,
                  color: isFirst ? '#ffffff' : '#c8ccd0',
                  lineHeight: 1.6,
                  paddingLeft: '12px',
                  borderLeft: isFirst
                    ? '2px solid #06b6d4'
                    : '2px solid rgba(6, 182, 212, 0.25)',
                  marginBottom: '10px',
                }}>
                  {tickers.length > 0 ? renderTextWithTickers(text, tickers, onStockTap) : text}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{
            fontSize: '20px', fontWeight: 700, color: '#ffffff',
            lineHeight: 1.3, marginBottom: '16px',
          }}>
            {headline}
          </div>
        )}

        {dateLabel && (
          <div style={{
            fontSize: '10px', fontFamily: MONO, color: '#6b7280', marginTop: '4px',
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {storylines.map((s, i) => {
        const borderColor = STORYLINE_BORDERS[s.type] || CYAN;
        const icon = STORYLINE_ICONS[s.type] || '\u26A1';
        const label = STORYLINE_LABELS[s.type] || s.type;

        // Split headline around the ticker symbol for highlighting
        const tickerIdx = s.headline.indexOf(s.symbol);
        const beforeTicker = tickerIdx >= 0 ? s.headline.slice(0, tickerIdx) : s.headline;
        const afterTicker = tickerIdx >= 0 ? s.headline.slice(tickerIdx + s.symbol.length) : '';

        return (
          <div
            key={`${s.symbol}-${i}`}
            onClick={() => onStockTap && onStockTap(s.symbol)}
            style={{
              padding: '12px 14px',
              borderLeft: `3px solid ${borderColor}`,
              background: i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <span style={{ fontSize: '14px', lineHeight: '20px', flexShrink: 0 }}>
                {icon}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Headline with highlighted ticker */}
                <div style={{
                  fontSize: '13px', fontWeight: 600, color: '#e3e2e7',
                  lineHeight: 1.4, marginBottom: '4px',
                }}>
                  {tickerIdx >= 0 ? (
                    <>
                      {beforeTicker}
                      <span style={{
                        color: borderColor, fontWeight: 700, fontFamily: MONO,
                      }}>
                        {s.symbol}
                      </span>
                      {afterTicker}
                    </>
                  ) : s.headline}
                </div>

                {/* Detail line */}
                {s.detail && (
                  <div style={{
                    fontSize: '11px', color: '#6b7280', lineHeight: 1.3,
                  }}>
                    {s.detail}
                  </div>
                )}

                {/* Metric pill */}
                <div style={{
                  display: 'inline-block', marginTop: '6px',
                  padding: '2px 8px', borderRadius: '4px',
                  fontSize: '10px', fontFamily: MONO, fontWeight: 600,
                  color: borderColor,
                  background: `${borderColor}15`,
                  border: `1px solid ${borderColor}30`,
                }}>
                  {s.metric}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ══════════════════════════════════════
// ── Component: UnderTheRadar ──
// ══════════════════════════════════════
export const UnderTheRadar = ({ stocks, onStockTap }) => {
  if (!stocks?.length) return null;

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
      {stocks.map((stock, i) => {
        const arch = ARCHETYPE_STYLES[stock.archetype];
        const signalLabel = stock.signal === 'new_position' ? 'New Position'
          : stock.signal === 'accumulating' ? 'Accumulating'
          : stock.signal === 'unchanged' ? 'Unchanged' : stock.signal;

        return (
          <motion.div
            key={`${stock.symbol}-${i}`}
            whileTap={{ scale: 0.97 }}
            onClick={() => onStockTap && onStockTap(stock.symbol)}
            style={{
              flexShrink: 0,
              width: '240px',
              height: '120px',
              background: '#15171E',
              borderLeft: '4px solid #a78bfa',
              borderRadius: '12px',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: 'pointer',
              scrollSnapAlign: 'start',
            }}
          >
            {/* Eyebrow */}
            <div style={{
              fontSize: '9px', fontFamily: MONO, color: '#a78bfa',
              textTransform: 'uppercase', letterSpacing: '0.1em',
            }}>
              {'\uD83D\uDD0D'} Quiet Conviction
            </div>

            {/* Ticker + Institution */}
            <div>
              <div style={{
                fontSize: '16px', fontWeight: 700, color: '#ffffff', marginBottom: '2px',
              }}>
                {stock.symbol}
              </div>
              <div style={{
                fontSize: '11px', color: '#9ca3af',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {stock.institution}
                {arch && (
                  <span style={{
                    fontSize: '9px', fontFamily: MONO, color: arch.color,
                    background: arch.bg, border: `0.5px solid ${arch.border}`,
                    padding: '1px 5px', borderRadius: '3px', marginLeft: '6px',
                  }}>
                    {arch.label}
                  </span>
                )}
              </div>
            </div>

            {/* Bottom row */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '6px',
            }}>
              <span style={{
                fontSize: '10px', fontFamily: MONO, color: '#a78bfa', fontWeight: 600,
              }}>
                {formatWeight(stock.weight)} &middot; {signalLabel}
              </span>
              <span style={{
                fontSize: '10px', fontFamily: MONO, color: '#6b7280',
              }}>
                {stock.activeHolderCount} holders
              </span>
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
export const SectorRotation = ({ sectorFlows, sectorDrivers, sectorAnalysis, isMobile }) => {
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
              fontSize: '12px', fontWeight: 600, color: '#e3e2e7',
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
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.08)',
                  borderRight: 'none',
                  boxShadow: '0 0 8px rgba(239, 68, 68, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  paddingRight: '6px',
                  borderRadius: '2px 0 0 2px',
                }}>
                  {distTickers.length > 0 && (
                    <span style={{
                      fontSize: '10px', fontFamily: MONO, color: '#ef4444',
                      fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden',
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
                  boxShadow: '0 0 8px rgba(6, 182, 212, 0.15), inset 0 0 8px rgba(6, 182, 212, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: '6px',
                  borderRadius: '0 2px 2px 0',
                }}>
                  {accTickers.length > 0 && (
                    <span style={{
                      fontSize: '10px', fontFamily: MONO, color: CYAN,
                      fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden',
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
              paddingBottom: '16px',
              borderBottom: '1px solid rgba(255,255,255,0.03)',
            }}>
              <span>Distributing ({netSellers || 0})</span>
              <span>Accumulating ({netBuyers || 0})</span>
            </div>
          </div>
        );
      })}

      {sectorAnalysis && (
        <div style={{
          marginTop: '20px',
          padding: '12px 14px',
          background: 'rgba(6, 182, 212, 0.04)',
          borderLeft: '3px solid rgba(6, 182, 212, 0.3)',
          borderRadius: '0 8px 8px 0',
        }}>
          <p style={{
            fontSize: '12px',
            color: '#9ca3af',
            lineHeight: 1.5,
            margin: 0,
            fontStyle: 'italic',
          }}>
            {sectorAnalysis}
          </p>
        </div>
      )}
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
export const WhaleLeaderboard = ({ institutions, institutionPortfolios, onStockTap, isMobile }) => {
  const [expandedId, setExpandedId] = useState(null);
  const [portfolioExpandedId, setPortfolioExpandedId] = useState(null);
  const [showAllWhales, setShowAllWhales] = useState(false);
  const [showFullPortfolio, setShowFullPortfolio] = useState(false);

  if (!institutions?.length) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center', color: '#6b7280', fontSize: '13px' }}>
        No institutional leaderboard data available.
      </div>
    );
  }

  const visible = showAllWhales ? institutions : institutions.slice(0, 10);
  const hasMore = institutions.length > 10;

  const SIGNAL_COLORS = {
    accumulating: CYAN,
    new_position: CYAN,
    trimming: '#f59e0b',
    exiting: '#ef4444',
    unchanged: '#64748b',
  };

  return (
    <div>
      {visible.map((inst, i) => {
        const arch = ARCHETYPE_STYLES[inst.archetype];
        const isExpanded = expandedId === inst.name;
        const topBet = inst.topConviction?.[0];
        const portfolio = institutionPortfolios?.[inst.name];
        const isPortfolioOpen = portfolioExpandedId === inst.name;

        return (
          <div key={inst.name || i}>
            {/* Collapsed row */}
            <div
              onClick={() => {
                if (isExpanded) {
                  setExpandedId(null);
                  setPortfolioExpandedId(null);
                  setShowFullPortfolio(false);
                } else {
                  setExpandedId(inst.name);
                }
              }}
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

                {inst.topSector && SECTORS[inst.topSector] && (
                  <span style={{
                    fontSize: '9px', fontWeight: 600, padding: '2px 8px',
                    borderRadius: '4px', fontFamily: MONO,
                    color: SECTORS[inst.topSector].color,
                    background: `${SECTORS[inst.topSector].color}15`,
                    border: `0.5px solid ${SECTORS[inst.topSector].color}40`,
                    flexShrink: 0,
                  }}>
                    {SECTORS[inst.topSector].name}
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

              {/* Line 3: AUM */}
              {inst.aum > 0 && (
                <div style={{
                  fontSize: '11px', color: '#8B8D97', fontFamily: MONO, marginTop: '2px',
                  paddingLeft: '36px',
                }}>
                  AUM: {formatAUM(inst.aum)}
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
                            {/* New position: show share count (or just symbol if stale data) */}
                            {!inst.biggestAdd.changeShares && inst.biggestAdd.changePct > 100
                              ? inst.biggestAdd.currentShares
                                ? `New Position: ${formatShares(inst.biggestAdd.currentShares)} shares of ${inst.biggestAdd.symbol}`
                                : `New Position: ${inst.biggestAdd.symbol}`
                              : `Added: +${formatShares(inst.biggestAdd.changeShares)} ${inst.biggestAdd.symbol}`
                            }
                          </span>
                        </div>
                        <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '4px', paddingLeft: '20px' }}>
                          {!inst.biggestAdd.changeShares && inst.biggestAdd.changePct > 100
                            ? 'New position this quarter'
                            : `Position increase: ${formatPct(inst.biggestAdd.changePct)}`
                          }
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
                            {!inst.biggestCut.changeShares && !inst.biggestCut.change
                              ? `Reduced: ${inst.biggestCut.symbol}`
                              : `Cut: ${formatShares(Math.abs(inst.biggestCut.changeShares || inst.biggestCut.change))} ${inst.biggestCut.symbol}`
                            }
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

                    {/* Full Portfolio (inline expandable) */}
                    {portfolio?.positions?.length > 0 && (
                      <div style={{ marginTop: '16px' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isPortfolioOpen) {
                              setPortfolioExpandedId(null);
                              setShowFullPortfolio(false);
                            } else {
                              setPortfolioExpandedId(inst.name);
                              setShowFullPortfolio(false);
                            }
                          }}
                          style={{
                            width: '100%',
                            background: isPortfolioOpen ? 'rgba(6, 182, 212, 0.12)' : 'rgba(6, 182, 212, 0.08)',
                            color: CYAN,
                            padding: '10px',
                            fontSize: '11px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                            border: `1px solid rgba(6, 182, 212, ${isPortfolioOpen ? '0.3' : '0.2'})`,
                            cursor: 'pointer',
                            borderRadius: '4px',
                            fontFamily: MONO,
                          }}
                        >
                          {isPortfolioOpen ? 'Hide Portfolio' : `View Full Portfolio (${portfolio.stocksHeld})`}
                        </button>

                        <AnimatePresence>
                          {isPortfolioOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              style={{ overflow: 'hidden' }}
                            >
                              <div style={{
                                fontSize: '10px', fontFamily: MONO, color: '#6b7280',
                                textTransform: 'uppercase', letterSpacing: '0.15em',
                                marginBottom: '10px', marginTop: '16px',
                              }}>
                                Full Portfolio ({portfolio.stocksHeld} positions)
                              </div>

                              {(() => {
                                const positions = showFullPortfolio
                                  ? portfolio.positions
                                  : portfolio.positions.slice(0, 10);
                                const maxW = portfolio.positions[0]?.weight || 1;

                                return (
                                  <>
                                    {positions.map(pos => {
                                      const sigColor = SIGNAL_COLORS[pos.signal] || '#64748b';
                                      const sigLabel = pos.signal === 'new_position' ? 'New'
                                        : pos.signal === 'accumulating' ? 'Acc'
                                        : pos.signal === 'trimming' ? 'Trim'
                                        : pos.signal === 'exiting' ? 'Exit'
                                        : pos.signal === 'unchanged' ? '—' : pos.signal;

                                      return (
                                        <div
                                          key={pos.symbol}
                                          onClick={(e) => { e.stopPropagation(); onStockTap && onStockTap(pos.symbol); }}
                                          style={{
                                            display: 'flex', alignItems: 'center', gap: '8px',
                                            padding: '6px 0',
                                            borderBottom: '1px solid rgba(255,255,255,0.03)',
                                            cursor: 'pointer',
                                          }}
                                        >
                                          <span style={{
                                            fontSize: '12px', fontFamily: MONO, fontWeight: 700,
                                            color: '#ffffff', width: '50px', flexShrink: 0,
                                          }}>
                                            {pos.symbol}
                                          </span>

                                          <div style={{
                                            flex: 1, height: '3px', background: '#1C1A27',
                                            borderRadius: '2px', overflow: 'hidden',
                                          }}>
                                            <div style={{
                                              width: `${(pos.weight / maxW) * 100}%`,
                                              height: '100%', background: CYAN,
                                              borderRadius: '2px',
                                            }} />
                                          </div>

                                          <span style={{
                                            fontSize: '11px', fontFamily: MONO, color: CYAN,
                                            width: '50px', textAlign: 'right', flexShrink: 0,
                                          }}>
                                            {pos.weight.toFixed(2)}%
                                          </span>

                                          <span style={{
                                            fontSize: '8px', fontFamily: MONO, fontWeight: 600,
                                            color: sigColor, background: `${sigColor}15`,
                                            padding: '1px 5px', borderRadius: '3px',
                                            flexShrink: 0, minWidth: '28px', textAlign: 'center',
                                          }}>
                                            {sigLabel}
                                          </span>
                                        </div>
                                      );
                                    })}

                                    {portfolio.positions.length > 10 && (
                                      <div
                                        onClick={(e) => { e.stopPropagation(); setShowFullPortfolio(!showFullPortfolio); }}
                                        style={{
                                          fontSize: '11px', fontFamily: MONO, color: CYAN,
                                          cursor: 'pointer', padding: '10px 0', fontWeight: 600,
                                        }}
                                      >
                                        {showFullPortfolio ? 'Show less' : `Show all ${portfolio.positions.length} \u2192`}
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
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
          onClick={() => setShowAllWhales(!showAllWhales)}
          style={{
            background: 'none', border: 'none', color: CYAN,
            fontSize: '11px', fontWeight: 500, cursor: 'pointer',
            padding: '10px 0', fontFamily: MONO,
          }}
        >
          {showAllWhales ? 'Show less' : `Show all ${institutions.length} \u2192`}
        </button>
      )}
    </div>
  );
};
