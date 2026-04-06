import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { STOCKS } from '../../data/assets';
import {
  HeroHeadlineCard,
  AlphaFeed,
  UnderTheRadar,
  SectorRotation,
  CapitolHillTeaser,
  WhaleLeaderboard,
} from './InstitutionalCards';

const MONO = "'JetBrains Mono', 'SF Mono', monospace";
const CYAN = '#06b6d4';

const SUB_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'whales', label: 'Whale Leaderboard' },
];

// ── Section Header ──
const SectionHeader = ({ title }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: '8px',
    marginBottom: '16px', marginTop: '32px',
  }}>
    <div style={{ width: '3px', height: '16px', background: CYAN }} />
    <span style={{
      fontSize: '11px', fontFamily: MONO, fontWeight: 700,
      color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.15em',
    }}>
      {title}
    </span>
  </div>
);

// ══════════════════════════════════════
// ── InstitutionalView Main Component ──
// ══════════════════════════════════════
const InstitutionalView = ({ onOpenResearch, stocksData, isMobile }) => {
  const [activeSubTab, setActiveSubTab] = useState('overview');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Build lookup map once
  const STOCK_MAP = useMemo(() => {
    const map = {};
    STOCKS.forEach(s => { map[s.symbol] = s; });
    return map;
  }, []);

  const handleStockTap = useCallback((symbol) => {
    if (!onOpenResearch) return;
    const stock = STOCK_MAP[symbol];
    onOpenResearch(stock
      ? { symbol: stock.symbol, name: stock.name, sector: stock.sector, price: 0, percentChange: 0, change: 0 }
      : { symbol, name: symbol, price: 0, percentChange: 0, change: 0 }
    );
  }, [onOpenResearch, STOCK_MAP]);

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

  const subTabStyle = (isActive) => ({
    padding: '6px 14px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 500,
    background: isActive ? 'rgba(6, 182, 212, 0.08)' : '#1a1d24',
    color: isActive ? CYAN : '#9ca3af',
    border: `0.5px solid ${isActive ? 'rgba(6, 182, 212, 0.3)' : 'rgba(255,255,255,0.08)'}`,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'none',
    flexShrink: 0,
  });

  // ── Loading state ──
  if (loading) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center', color: '#6b7280', fontSize: '13px' }}>
        Loading institutional data...
      </div>
    );
  }

  // ── No data state ──
  if (!data) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center', color: '#6b7280', fontSize: '13px' }}>
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
              <HeroHeadlineCard
                headline={data.heroHeadline}
                heroInsights={data.heroInsights}
                updatedAt={data.updatedAt}
              />

              <SectionHeader title="Institutional Storylines" />
              <AlphaFeed
                storylines={data.storylines}
                onStockTap={handleStockTap}
              />

              {data.underTheRadar?.length > 0 && (
                <>
                  <SectionHeader title="Under the Radar" />
                  <UnderTheRadar
                    stocks={data.underTheRadar}
                    onStockTap={handleStockTap}
                  />
                </>
              )}

              <SectionHeader title="Where is Capital Moving?" />
              <SectorRotation
                sectorFlows={data.sectorFlows}
                sectorDrivers={data.sectorDrivers}
                sectorAnalysis={data.sectorAnalysis}
                isMobile={isMobile}
              />

              <CapitolHillTeaser />
            </div>
          )}

          {activeSubTab === 'whales' && (
            <WhaleLeaderboard
              institutions={data.topInstitutions}
              institutionPortfolios={data.institutionPortfolios}
              onStockTap={handleStockTap}
              isMobile={isMobile}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default InstitutionalView;
