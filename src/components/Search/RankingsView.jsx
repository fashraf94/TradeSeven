import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../contexts/ThemeContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { STOCKS } from '../../data/assets';
import RankRow from './RankRow';
import SectorConcentration from './SectorConcentration';

const SUB_TABS = [
  { id: 'composite', label: 'Composite', group: 'rankings' },
  { id: 'fundamental', label: 'Fundamental', group: 'rankings' },
  { id: 'technical', label: 'Technical', group: 'rankings' },
  { id: 'baggerBomb', label: 'BaggerBomb', group: 'gamefit' },
  { id: 'snakeDraft', label: 'Snake Draft', group: 'gamefit' },
  { id: 'earningsGame', label: 'Earnings', group: 'gamefit' },
];

const RankingsView = ({ onOpenResearch, isMobile }) => {
  const { tokens } = useTheme();
  const [activeSubTab, setActiveSubTab] = useState('composite');
  const [rankingsData, setRankingsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  // Fetch rankings from Firestore (same source as CompeteTab)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'indexIntelligence', 'stockRankings'));
        if (!cancelled && snap.exists()) setRankingsData(snap.data());
      } catch (err) {
        console.error('[RankingsView] Failed to load stockRankings:', err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Map sub-tab IDs to score/rank keys
  const TAB_KEYS = {
    composite:    { scoreKey: 'compositeScore',    rankKey: null },
    fundamental:  { scoreKey: 'fundamentalScore',  rankKey: 'fundamentalRank' },
    technical:    { scoreKey: 'technicalScore',     rankKey: 'technicalRank' },
    baggerBomb:   { scoreKey: 'baggerBombFit',      rankKey: 'baggerBombRank' },
    snakeDraft:   { scoreKey: 'snakeDraftFit',      rankKey: 'snakeDraftRank' },
    earningsGame: { scoreKey: 'earningsGameFit',    rankKey: 'earningsGameRank' },
  };

  // Sort stocks based on active sub-tab
  const sortedStocks = useMemo(() => {
    if (!rankingsData?.stocks) return [];
    const stocks = [...rankingsData.stocks];
    const { scoreKey, rankKey } = TAB_KEYS[activeSubTab] || TAB_KEYS.composite;

    const filtered = stocks.filter(s => s[scoreKey] != null);
    if (rankKey) {
      return filtered.sort((a, b) => (a[rankKey] || 999) - (b[rankKey] || 999));
    }
    return filtered.sort((a, b) => (b[scoreKey] || 0) - (a[scoreKey] || 0));
  }, [rankingsData, activeSubTab]);

  // Max score for progress bar normalization
  const maxScore = useMemo(() => {
    if (!sortedStocks.length) return 100;
    const { scoreKey } = TAB_KEYS[activeSubTab] || TAB_KEYS.composite;
    return Math.max(...sortedStocks.map(s => s[scoreKey] || 0), 1);
  }, [sortedStocks, activeSubTab]);

  const displayedStocks = showAll ? sortedStocks : sortedStocks.slice(0, 10);

  const handleStockTap = (stock) => {
    const assetInfo = STOCKS.find(s => s.symbol === stock.symbol);
    onOpenResearch({
      symbol: stock.symbol,
      name: assetInfo?.name || stock.symbol,
      sector: assetInfo?.sector || stock.sectorName || '',
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
    background: isActive ? 'rgba(94,234,212,0.08)' : '#1a1d24',
    color: isActive ? '#5eead4' : '#9ca3af',
    border: `0.5px solid ${isActive ? 'rgba(94,234,212,0.3)' : 'rgba(255,255,255,0.08)'}`,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.2s ease',
  });

  if (loading) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center', color: tokens.textMuted, fontSize: '13px' }}>
        Loading rankings...
      </div>
    );
  }

  if (!rankingsData?.stocks?.length) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center', color: tokens.textMuted, fontSize: '13px' }}>
        Rankings data not available.
      </div>
    );
  }

  return (
    <div>
      {/* Sub-tab pills */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {SUB_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveSubTab(tab.id); setShowAll(false); }}
            style={subTabStyle(activeSubTab === tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sector Concentration Card */}
      <SectorConcentration
        stocks={sortedStocks}
        type={activeSubTab}
        count={20}
      />

      {/* Ranking List */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSubTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          style={{
            borderRadius: '14px',
            background: tokens.bgCard,
            boxShadow: tokens.obsidianShadow,
            border: `0.5px solid ${tokens.borderDefault}`,
            overflow: 'hidden',
          }}
        >
          {/* List header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 8px 8px',
            fontSize: '10px',
            color: tokens.textMuted,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            <span style={{ width: '24px', textAlign: 'right' }}>#</span>
            <span style={{ width: '48px' }}>Ticker</span>
            <span>Sector</span>
            <span style={{ flex: 1 }} />
            <span style={{ width: '28px', textAlign: 'right' }}>Score</span>
          </div>

          {displayedStocks.map((stock, i) => (
            <RankRow
              key={stock.symbol}
              stock={stock}
              rank={i + 1}
              type={activeSubTab}
              maxScore={maxScore}
              onTap={handleStockTap}
            />
          ))}

          {/* Show more / less */}
          {sortedStocks.length > 10 && (
            <button
              onClick={() => setShowAll(!showAll)}
              style={{
                display: 'block',
                width: '100%',
                padding: '12px',
                background: 'none',
                border: 'none',
                borderTop: `0.5px solid ${tokens.borderDefault}`,
                color: tokens.teal,
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {showAll ? 'Show top 10' : `Show all ${sortedStocks.length} stocks`}
            </button>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default RankingsView;
