import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../contexts/ThemeContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { STOCKS } from '../../data/assets';
import {
  SmartMoneyPulse,
  ConvictionCarousel,
  ClusterBuyAlert,
  BiggestMovers,
  SectorFlowsGrid,
} from './InstitutionalCards';

const MONO = "'JetBrains Mono', 'SF Mono', monospace";
const CYAN = '#06b6d4';

const ARCHETYPE_STYLES = {
  index_passive: { label: 'Index',     color: '#64748b', bg: 'rgba(100, 116, 139, 0.12)' },
  long_only:     { label: 'Long-Only', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.10)' },
  quantitative:  { label: 'Quant',     color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.10)' },
  transient:     { label: 'Transient', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.10)' },
  activist:      { label: 'Activist',  color: '#ef4444', bg: 'rgba(239, 68, 68, 0.10)' },
};

const SUB_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'leaderboard', label: 'Whale Leaderboard' },
];

// Build lookup map for stock symbol → asset info
const STOCK_MAP = {};
STOCKS.forEach(s => { STOCK_MAP[s.symbol] = s; });

// ── Whale Leaderboard ──
const WhaleLeaderboard = ({ institutions, tokens }) => {
  const [showAll, setShowAll] = useState(false);
  if (!institutions?.length) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center', color: tokens.textMuted, fontSize: '13px' }}>
        No institutional leaderboard data available.
      </div>
    );
  }

  const visible = showAll ? institutions : institutions.slice(0, 10);
  const hasMore = institutions.length > 10;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginBottom: '2px' }}>
          Top Institutional Players
        </div>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
          Ranked by coverage across {institutions.length > 0 ? 'draft' : ''} stocks
        </div>
      </div>

      {/* Rows */}
      {visible.map((inst, i) => {
        const arch = ARCHETYPE_STYLES[inst.archetype];
        const positions = inst.topPositions || [];

        return (
          <div key={inst.name || i} style={{
            padding: '12px 0',
            borderBottom: '0.5px solid rgba(255,255,255,0.06)',
            background: i % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent',
          }}>
            {/* Line 1: Rank + Name + Archetype */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
              <span style={{
                fontFamily: MONO, fontSize: '11px', fontWeight: 700,
                color: 'rgba(255,255,255,0.3)', minWidth: '20px',
              }}>
                {i + 1}.
              </span>
              <span style={{
                fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.85)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
              }}>
                {inst.name}
              </span>
              {arch && (
                <span style={{
                  padding: '2px 8px', borderRadius: '10px', fontSize: '10px',
                  fontWeight: 600, fontFamily: MONO, color: arch.color, background: arch.bg,
                  flexShrink: 0,
                }}>
                  {arch.label}
                </span>
              )}
            </div>
            {/* Line 2: Holds X stocks + top positions */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              paddingLeft: '28px', flexWrap: 'wrap',
            }}>
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontFamily: MONO }}>
                Holds {inst.stocksHeld || 0} stocks
              </span>
              {positions.slice(0, 5).map(sym => (
                <span key={sym} style={{
                  background: 'rgba(255,255,255,0.06)',
                  borderRadius: '6px',
                  padding: '1px 6px',
                  fontSize: '10px',
                  fontFamily: MONO,
                  fontWeight: 600,
                  color: 'rgba(255,255,255,0.5)',
                }}>
                  {sym}
                </span>
              ))}
            </div>
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

// ══════════════════════════════════════
// ── InstitutionalView Main Component ──
// ══════════════════════════════════════
const InstitutionalView = ({ onOpenResearch, stocksData, isMobile }) => {
  const { tokens } = useTheme();
  const [activeSubTab, setActiveSubTab] = useState('overview');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'institutionalAggregates', 'latest'));
        if (!cancelled && snap.exists()) setData(snap.data());
      } catch (err) {
        console.error('[InstitutionalView] Failed to load institutional data:', err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleStockTap = (symbol) => {
    if (!onOpenResearch) return;
    const assetInfo = STOCK_MAP[symbol];
    onOpenResearch({
      symbol,
      name: assetInfo?.name || symbol,
      sector: assetInfo?.sector || '',
      price: 0,
      percentChange: 0,
      change: 0,
    });
  };

  const subTabStyle = (isActive) => ({
    padding: '6px 14px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 500,
    background: isActive ? 'rgba(6,182,212,0.08)' : '#1a1d24',
    color: isActive ? CYAN : '#9ca3af',
    border: `0.5px solid ${isActive ? 'rgba(6,182,212,0.3)' : 'rgba(255,255,255,0.08)'}`,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.2s ease',
    flexShrink: 0,
  });

  // ── Loading state ──
  if (loading) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center', color: tokens.textMuted, fontSize: '13px' }}>
        Loading institutional data...
      </div>
    );
  }

  // ── No data state ──
  if (!data) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center', color: tokens.textMuted, fontSize: '13px' }}>
        Institutional data not available.
      </div>
    );
  }

  return (
    <div>
      {/* Sub-tab pills */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '16px',
        overflowX: 'auto',
        whiteSpace: 'nowrap',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}>
        {SUB_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            style={subTabStyle(activeSubTab === tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content with animation */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSubTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {activeSubTab === 'overview' && (
            <div>
              <SmartMoneyPulse data={data} tokens={tokens} />
              <ConvictionCarousel
                symbols={data.strongAccumulation}
                distributionSymbols={data.strongDistribution}
                onTap={handleStockTap}
                tokens={tokens}
              />
              <ClusterBuyAlert
                stocks={data.clusterBuyStocks}
                onTap={handleStockTap}
              />
              <BiggestMovers
                buys={data.biggestBuys}
                sells={data.biggestSells}
                onTap={handleStockTap}
                tokens={tokens}
                isMobile={isMobile}
              />
              <SectorFlowsGrid
                sectorFlows={data.sectorFlows}
                tokens={tokens}
                isMobile={isMobile}
              />
            </div>
          )}

          {activeSubTab === 'leaderboard' && (
            <WhaleLeaderboard
              institutions={data.topInstitutions}
              tokens={tokens}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default InstitutionalView;
