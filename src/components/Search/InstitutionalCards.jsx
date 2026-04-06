import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Zap } from 'lucide-react';
import { SECTORS } from '../../constants/sectors';

const MONO = "'JetBrains Mono', 'SF Mono', monospace";
const CYAN = '#06b6d4';

const SECTOR_NAMES = {
  XLK: 'Tech', XLF: 'Finance', XLV: 'Health', XLE: 'Energy',
  XLI: 'Industrial', XLY: 'Consumer', XLP: 'Staples', XLU: 'Utilities',
  XLRE: 'Real Estate', XLC: 'Comms', XLB: 'Materials',
};

const ARCHETYPE_STYLES = {
  index_passive: { label: 'Index',     color: '#64748b', bg: 'rgba(100, 116, 139, 0.12)' },
  long_only:     { label: 'Long-Only', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.10)' },
  quantitative:  { label: 'Quant',     color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.10)' },
  transient:     { label: 'Transient', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.10)' },
  activist:      { label: 'Activist',  color: '#ef4444', bg: 'rgba(239, 68, 68, 0.10)' },
};

// ── Smart Money Pulse ──
export const SmartMoneyPulse = ({ data, tokens }) => {
  const total = data.stocksProcessed || 1;
  const acc = data.strongAccumulation?.length || 0;
  const dist = data.strongDistribution?.length || 0;
  const rest = Math.max(0, total - acc - dist);
  const accPct = (acc / total) * 100;
  const distPct = (dist / total) * 100;
  const restPct = Math.max(0, 100 - accPct - distPct);

  const updatedLabel = data.updatedAt?.toDate
    ? data.updatedAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  return (
    <div style={{
      padding: '14px',
      borderRadius: '14px',
      background: 'rgba(255,255,255,0.03)',
      border: '0.5px solid rgba(255,255,255,0.06)',
      marginBottom: '16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
          Smart Money Pulse
        </span>
        <span style={{ fontFamily: MONO, fontSize: '16px', fontWeight: 700, color: CYAN }}>
          {Math.round(accPct)}%
        </span>
      </div>

      {/* Ratio bar */}
      <div style={{
        height: '6px', borderRadius: '3px', overflow: 'hidden',
        display: 'flex', background: 'rgba(148, 163, 184, 0.15)', marginBottom: '8px',
      }}>
        {accPct > 0 && <div style={{ width: `${accPct}%`, background: CYAN, transition: 'width 0.3s' }} />}
        {distPct > 0 && <div style={{ width: `${distPct}%`, background: '#ef4444', transition: 'width 0.3s' }} />}
        {restPct > 0 && <div style={{ width: `${restPct}%`, background: 'rgba(148,163,184,0.3)', transition: 'width 0.3s' }} />}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '10px', fontFamily: MONO, color: 'rgba(255,255,255,0.4)' }}>
        <span><span style={{ color: CYAN, fontWeight: 600 }}>{acc}</span> accumulating</span>
        <span><span style={{ color: '#ef4444', fontWeight: 600 }}>{dist}</span> distributing</span>
        <span>{rest} neutral</span>
        {updatedLabel && <span style={{ marginLeft: 'auto', opacity: 0.6 }}>Updated {updatedLabel}</span>}
      </div>
    </div>
  );
};

// ── Conviction Carousel ──
export const ConvictionCarousel = ({ symbols, distributionSymbols, onTap, tokens }) => {
  const showAccumulation = symbols?.length > 0;
  const items = showAccumulation ? symbols : (distributionSymbols || []);
  if (!items.length) return null;

  const accent = showAccumulation ? CYAN : '#ef4444';
  const label = showAccumulation ? 'Strong Accumulation' : 'Strong Distribution';

  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px',
      }}>
        <TrendingUp size={13} style={{ color: accent }} />
        <span style={{
          fontSize: '10px', fontWeight: 700, letterSpacing: '1px',
          color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontFamily: MONO,
        }}>
          {label}
        </span>
        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', fontFamily: MONO }}>
          ({items.length})
        </span>
      </div>

      <div style={{
        display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px',
        WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none',
      }}>
        <style>{`.conviction-scroll::-webkit-scrollbar { display: none; }`}</style>
        {items.map(sym => (
          <motion.button
            key={sym}
            whileTap={{ scale: 0.95 }}
            onClick={() => onTap(sym)}
            style={{
              background: `${accent}10`,
              border: `0.5px solid ${accent}40`,
              borderRadius: '12px',
              padding: '10px 16px',
              minWidth: '90px',
              textAlign: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,0.9)', fontFamily: MONO }}>
              {sym}
            </div>
            <div style={{ fontSize: '9px', fontWeight: 600, color: accent, marginTop: '2px', fontFamily: MONO }}>
              {label}
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

// ── Cluster Buy Alert ──
export const ClusterBuyAlert = ({ stocks, onTap }) => {
  if (!stocks?.length) return null;

  return (
    <div style={{
      background: 'rgba(6, 182, 212, 0.08)',
      border: '1px solid rgba(6, 182, 212, 0.2)',
      borderRadius: '10px',
      padding: '10px 14px',
      marginBottom: '16px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '8px',
    }}>
      <Zap size={14} style={{ color: CYAN, flexShrink: 0, marginTop: '1px' }} />
      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.4 }}>
        <span style={{ fontWeight: 600, color: CYAN }}>Cluster Buy Alert: </span>
        {stocks.map((sym, i) => (
          <span key={sym}>
            <span
              onClick={() => onTap(sym)}
              style={{ color: CYAN, fontWeight: 600, cursor: 'pointer', fontFamily: MONO }}
            >
              {sym}
            </span>
            {i < stocks.length - 1 && ', '}
          </span>
        ))}
        <span style={{ color: 'rgba(255,255,255,0.45)' }}> — 3+ institutions opened new positions</span>
      </div>
    </div>
  );
};

// ── Biggest Movers ──
export const BiggestMovers = ({ buys, sells, onTap, tokens, isMobile }) => {
  if (!buys?.length && !sells?.length) return null;

  const MoverSection = ({ items, title, icon: Icon, accentColor }) => (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
        <Icon size={13} style={{ color: accentColor }} />
        <span style={{
          fontSize: '10px', fontWeight: 700, letterSpacing: '1px',
          color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontFamily: MONO,
        }}>
          {title}
        </span>
      </div>
      {(items || []).slice(0, 5).map((m, i) => {
        const arch = ARCHETYPE_STYLES[m.archetype];
        return (
          <div key={m.symbol + i} style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 0',
            borderBottom: '0.5px solid rgba(255,255,255,0.06)',
          }}>
            <span
              onClick={() => onTap(m.symbol)}
              style={{ fontFamily: MONO, fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.9)', cursor: 'pointer', minWidth: '48px' }}
            >
              {m.symbol}
            </span>
            <span style={{ fontFamily: MONO, fontSize: '11px', color: accentColor, fontWeight: 600, minWidth: '52px' }}>
              {m.changePct > 0 ? '+' : ''}{m.changePct?.toFixed(1)}%
            </span>
            <span style={{
              fontSize: '11px', color: 'rgba(255,255,255,0.4)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
            }}>
              {m.institution}
            </span>
            {arch && (
              <span style={{
                padding: '2px 6px', borderRadius: '10px', fontSize: '9px',
                fontWeight: 600, fontFamily: MONO, color: arch.color, background: arch.bg,
                flexShrink: 0,
              }}>
                {arch.label}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
      gap: '16px',
      marginBottom: '16px',
    }}>
      {buys?.length > 0 && (
        <MoverSection items={buys} title="Smart Money Buying" icon={TrendingUp} accentColor={CYAN} />
      )}
      {sells?.length > 0 && (
        <MoverSection items={sells} title="Smart Money Selling" icon={TrendingDown} accentColor="#ef4444" />
      )}
    </div>
  );
};

// ── Sector Flows Grid ──
export const SectorFlowsGrid = ({ sectorFlows, tokens, isMobile }) => {
  if (!sectorFlows || Object.keys(sectorFlows).length === 0) return null;

  const SENTIMENT_COLORS = {
    bullish: { bg: 'rgba(6,182,212,0.08)', border: 'rgba(6,182,212,0.2)', text: CYAN },
    bearish: { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)', text: '#ef4444' },
    neutral: { bg: 'rgba(148,163,184,0.06)', border: 'rgba(148,163,184,0.15)', text: '#94a3b8' },
  };

  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px',
      }}>
        <span style={{
          fontSize: '10px', fontWeight: 700, letterSpacing: '1px',
          color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontFamily: MONO,
        }}>
          Sector Flows
        </span>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
        gap: '8px',
      }}>
        {Object.entries(sectorFlows).map(([etf, flow]) => {
          const sentiment = flow.sentiment || 'neutral';
          const sc = SENTIMENT_COLORS[sentiment] || SENTIMENT_COLORS.neutral;
          const sectorColor = SECTORS[etf]?.color || '#64748b';
          const name = SECTOR_NAMES[etf] || etf;

          return (
            <div key={etf} style={{
              background: sc.bg,
              border: `0.5px solid ${sc.border}`,
              borderRadius: '10px',
              padding: '10px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: sectorColor, marginBottom: '3px' }}>
                {name}
              </div>
              <div style={{
                fontSize: '10px', fontWeight: 600, color: sc.text,
                textTransform: 'capitalize', marginBottom: '3px',
              }}>
                {sentiment}
              </div>
              <div style={{ fontSize: '9px', fontFamily: MONO, color: 'rgba(255,255,255,0.35)' }}>
                B:{flow.netBuyers || 0} S:{flow.netSellers || 0}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
