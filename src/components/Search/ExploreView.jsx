import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, Flame, ChevronDown, ChevronUp } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { STOCKS } from '../../data/assets';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import SectorPerformanceTable from './SectorPerformanceTable';
import { INDEX_REGISTRY } from '../../constants/indexRegistry';
import { getMultipleStockPrices } from '../../services/eodhdAPI';

const CATEGORIES = [
  {
    id: 'gainers',
    title: 'Top Gainers',
    subtitle: 'Biggest daily movers up',
    accent: '#10b981',
    icon: TrendingUp,
  },
  {
    id: 'losers',
    title: 'Top Losers',
    subtitle: 'Biggest daily decliners',
    accent: '#ef4444',
    icon: TrendingDown,
  },
  {
    id: 'trending',
    title: 'Trending',
    subtitle: 'Popular in the community',
    accent: '#5eead4',
    icon: Flame,
  },
];

// Build a sector lookup from STOCKS
const SECTOR_MAP = {};
STOCKS.forEach(s => { SECTOR_MAP[s.symbol] = s.sector; });

const ExploreView = ({ stocksData, onOpenResearch, isMobile }) => {
  const { tokens } = useTheme();
  const [expandedCard, setExpandedCard] = useState(null);
  const [marketContext, setMarketContext] = useState(null);
  const [freshPrices, setFreshPrices] = useState(null);
  const [recentSearches, setRecentSearches] = useState([]);

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('ft_recent_searches') || '[]');
      setRecentSearches(stored);
    } catch {}
  }, []);

  // Fetch market context for sector data and indices
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'indexIntelligence', 'marketContext'));
        if (!cancelled && snap.exists()) setMarketContext(snap.data());
      } catch (err) {
        console.error('[ExploreView] Failed to load marketContext:', err.message);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Fetch fresh prices for indices + sector ETFs after marketContext loads
  useEffect(() => {
    if (!marketContext) return;
    let cancelled = false;
    const symbols = [
      'SPY', 'QQQ', 'DIA', 'IWM',
      'XLK', 'XLF', 'XLY', 'XLP', 'XLE', 'XLI', 'XLB', 'XLU', 'XLRE', 'XLC', 'XLV',
    ];
    getMultipleStockPrices(symbols)
      .then(prices => { if (!cancelled) setFreshPrices(prices); })
      .catch(() => console.warn('[ExploreView] Fresh price fetch failed, using cached data'));
    return () => { cancelled = true; };
  }, [marketContext]);

  // Compute category data
  const gainers = useMemo(() => {
    if (!stocksData?.length) return [];
    return [...stocksData]
      .filter(s => typeof s.percentChange === 'number')
      .sort((a, b) => b.percentChange - a.percentChange);
  }, [stocksData]);

  const losers = useMemo(() => {
    if (!stocksData?.length) return [];
    return [...stocksData]
      .filter(s => typeof s.percentChange === 'number')
      .sort((a, b) => a.percentChange - b.percentChange);
  }, [stocksData]);

  const trendingStocks = useMemo(() => {
    if (!stocksData?.length) return [];
    return [...stocksData]
      .filter(s => typeof s.percentChange === 'number')
      .sort((a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange))
      .slice(0, 10);
  }, [stocksData]);

  const getPreviewItems = (catId) => {
    switch (catId) {
      case 'gainers':
        return gainers.slice(0, 3).map(s => ({
          label: s.symbol,
          value: `+${s.percentChange.toFixed(2)}%`,
          color: '#10b981',
        }));
      case 'losers':
        return losers.slice(0, 3).map(s => ({
          label: s.symbol,
          value: `${s.percentChange.toFixed(2)}%`,
          color: '#ef4444',
        }));
      case 'trending':
        return trendingStocks.slice(0, 3).map(s => ({
          label: s.symbol,
          value: `${s.percentChange >= 0 ? '+' : ''}${s.percentChange.toFixed(2)}%`,
          color: s.percentChange >= 0 ? '#10b981' : '#ef4444',
        }));
      default:
        return [];
    }
  };

  const getExpandedList = (catId) => {
    switch (catId) {
      case 'gainers': return gainers.slice(0, 15);
      case 'losers': return losers.slice(0, 15);
      case 'trending': return trendingStocks;
      default: return [];
    }
  };

  const handleRecentTap = (symbol) => {
    const stockInfo = stocksData?.find(s => s.symbol === symbol);
    const assetInfo = STOCKS.find(s => s.symbol === symbol);
    onOpenResearch({
      symbol,
      name: assetInfo?.name || symbol,
      sector: assetInfo?.sector || '',
      price: stockInfo?.price || 0,
      percentChange: stockInfo?.percentChange || 0,
      change: stockInfo?.change || 0,
    });
  };

  const handleStockTap = (stock) => {
    onOpenResearch({
      symbol: stock.symbol,
      name: stock.name || STOCKS.find(s => s.symbol === stock.symbol)?.name || stock.symbol,
      sector: stock.sector || SECTOR_MAP[stock.symbol] || '',
      price: stock.price || 0,
      percentChange: stock.percentChange || 0,
      change: stock.change || 0,
    });
  };

  // Market indices (prefer fresh prices over stale Firestore data)
  const indices = useMemo(() => {
    const indexSymbols = ['SPY', 'QQQ', 'DIA', 'IWM'];
    if (!marketContext) return [];
    return indexSymbols.map(sym => {
      const data = marketContext[sym.toLowerCase()];
      if (!data) return null;
      const fresh = freshPrices?.[sym];
      return {
        symbol: sym,
        name: INDEX_REGISTRY[sym]?.name || sym,
        change: fresh?.percentChange ?? data.changePercent ?? 0,
        price: fresh?.price ?? data.price ?? 0,
      };
    }).filter(Boolean);
  }, [marketContext, freshPrices]);

  return (
    <div>
      {/* Recent Searches */}
      {recentSearches.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{
            fontSize: '11px',
            fontWeight: 600,
            color: tokens.textMuted,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '8px',
          }}>
            Recent
          </div>
          <div style={{
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            paddingBottom: '4px',
            WebkitOverflowScrolling: 'touch',
          }}>
            {recentSearches.map(symbol => (
              <button
                key={symbol}
                onClick={() => handleRecentTap(symbol)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  background: tokens.bgCard,
                  border: `0.5px solid ${tokens.borderDefault}`,
                  color: tokens.textPrimary,
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  fontFamily: 'inherit',
                }}
              >
                {symbol}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Category Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
        gap: '12px',
        marginBottom: '16px',
      }}>
        {CATEGORIES.map((cat, i) => {
          const preview = getPreviewItems(cat.id);
          const isExpanded = expandedCard === cat.id;
          const Icon = cat.icon;
          // On mobile, trending (3rd card, alone in 2nd row) spans full width
          const spanFull = isMobile && i === 2 && !isExpanded;

          return (
            <motion.div
              key={cat.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
              style={{ gridColumn: isExpanded || spanFull ? 'span 2' : undefined }}
            >
              <motion.div
                whileTap={{ scale: 0.98 }}
                onClick={() => setExpandedCard(isExpanded ? null : cat.id)}
                style={{
                  borderRadius: '14px',
                  background: tokens.bgCard,
                  backgroundImage: `linear-gradient(135deg, ${cat.accent}1F 0%, transparent 40%)`,
                  border: `0.5px solid ${cat.accent}26`,
                  boxShadow: tokens.obsidianShadow,
                  padding: '14px',
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Glossy top */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '40%',
                  backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 100%)',
                  pointerEvents: 'none',
                }} />

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <Icon size={14} color={cat.accent} />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: cat.accent }}>
                    {cat.title}
                  </span>
                  {isExpanded
                    ? <ChevronUp size={14} color={tokens.textMuted} style={{ marginLeft: 'auto' }} />
                    : <ChevronDown size={14} color={tokens.textMuted} style={{ marginLeft: 'auto' }} />
                  }
                </div>
                <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '10px' }}>
                  {cat.subtitle}
                </div>

                {/* Preview items */}
                {preview.map((item, j) => (
                  <div
                    key={j}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '12px',
                      padding: '2px 0',
                    }}
                  >
                    <span style={{ color: tokens.textPrimary, fontWeight: 500 }}>{item.label}</span>
                    <span style={{ color: item.color, fontWeight: 600 }}>{item.value}</span>
                  </div>
                ))}

                {/* Expanded list */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      style={{ overflow: 'hidden', marginTop: '8px', borderTop: `0.5px solid ${tokens.borderDefault}`, paddingTop: '8px' }}
                    >
                      {getExpandedList(cat.id).slice(3).map((stock) => (
                        <button
                          key={stock.symbol}
                          onClick={(e) => { e.stopPropagation(); handleStockTap(stock); }}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            width: '100%',
                            padding: '6px 0',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontFamily: 'inherit',
                          }}
                        >
                          <span style={{ color: tokens.textPrimary, fontWeight: 500 }}>{stock.symbol}</span>
                          <span style={{
                            color: stock.percentChange >= 0 ? '#10b981' : '#ef4444',
                            fontWeight: 600,
                          }}>
                            {stock.percentChange >= 0 ? '+' : ''}{stock.percentChange.toFixed(2)}%
                          </span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </motion.div>
          );
        })}
      </div>

      {/* Market Indices Strip */}
      {indices.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.3 }}
          style={{
            borderRadius: '14px',
            background: tokens.bgCard,
            boxShadow: tokens.obsidianShadow,
            padding: '14px',
            display: 'grid',
            gridTemplateColumns: `repeat(${indices.length}, 1fr)`,
            gap: '8px',
            border: `0.5px solid ${tokens.borderDefault}`,
            marginBottom: '16px',
          }}
        >
          {indices.map(idx => (
            <div
              key={idx.symbol}
              onClick={() => onOpenResearch({
                symbol: idx.symbol,
                name: idx.name,
                isIndex: true,
                price: idx.price,
                percentChange: idx.change,
              })}
              style={{ textAlign: 'center', cursor: 'pointer' }}
            >
              <div style={{ fontSize: '11px', fontWeight: 600, color: tokens.textSecondary }}>
                {idx.name}
              </div>
              {idx.price > 0 && (
                <div style={{ fontSize: '11px', color: tokens.textMuted }}>
                  ${idx.price.toFixed(0)}
                </div>
              )}
              <div style={{
                fontSize: '13px',
                fontWeight: 700,
                color: idx.change >= 0 ? '#10b981' : '#ef4444',
              }}>
                {idx.change >= 0 ? '+' : ''}{idx.change.toFixed(2)}%
              </div>
            </div>
          ))}
        </motion.div>
      )}

      {/* Sector Performance Table */}
      <SectorPerformanceTable
        marketContext={marketContext}
        freshPrices={freshPrices}
        onOpenResearch={onOpenResearch}
        isMobile={isMobile}
        tokens={tokens}
      />
    </div>
  );
};

export default ExploreView;
