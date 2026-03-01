import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useWebSocketPrices } from '../../../hooks/useWebSocketPrices';
import { getMarketState } from '../../../utils/marketSchedule';
import {
  STOCKS,
  CRYPTO,
  getStocksBySector,
  getCryptoSymbols,
  findStock,
  findCrypto,
} from '../../../data/assets';

import { getCustomWatchlist, addToWatchlist, removeFromWatchlist } from '../../../services/watchlistService';
import { HoloCard } from '../../shared';
import AssetResearchModal from '../../draft/AssetResearchModal';
import WatchlistSelector from './WatchlistSelector';
import WatchlistTable from './WatchlistTable';
import WatchlistFooter from './WatchlistFooter';
import AddToWatchlistModal from './AddToWatchlistModal';

// ============================================
// WATCHLIST CATEGORY DEFINITIONS
// ============================================

const WATCHLIST_CATEGORIES = [
  // === MY LISTS (personal) ===
  {
    id: 'custom',
    label: 'My Watchlist',
    icon: '\u2B50',
    category: 'my',
    description: 'Your personal watchlist',
  },

  // === SECTORS (from STOCK_SECTORS) ===
  { id: 'sector-technology', label: 'Technology', icon: '\uD83D\uDCBB', category: 'sector', sectorId: 'Technology' },
  { id: 'sector-finance', label: 'Finance', icon: '\uD83C\uDFE6', category: 'sector', sectorId: 'Finance' },
  { id: 'sector-healthcare', label: 'Healthcare', icon: '\uD83C\uDFE5', category: 'sector', sectorId: 'Healthcare' },
  { id: 'sector-energy', label: 'Energy', icon: '\u26A1', category: 'sector', sectorId: 'Energy' },
  { id: 'sector-consumer-disc', label: 'Cons. Disc.', icon: '\uD83D\uDECD\uFE0F', category: 'sector', sectorId: 'Consumer Discretionary' },
  { id: 'sector-consumer-staples', label: 'Staples', icon: '\uD83D\uDED2', category: 'sector', sectorId: 'Consumer Staples' },
  { id: 'sector-industrials', label: 'Industrials', icon: '\uD83C\uDFED', category: 'sector', sectorId: 'Industrials' },
  { id: 'sector-utilities', label: 'Utilities', icon: '\uD83D\uDCA1', category: 'sector', sectorId: 'Utilities' },
  { id: 'sector-real-estate', label: 'Real Estate', icon: '\uD83C\uDFE2', category: 'sector', sectorId: 'Real Estate' },
  { id: 'sector-telecom', label: 'Telecom', icon: '\uD83D\uDCE1', category: 'sector', sectorId: 'Telecom' },

  // === CRYPTO ===
  { id: 'crypto-all', label: 'All Crypto', icon: '\uD83E\uDE99', category: 'crypto' },

  // === PERFORMANCE (derived) ===
  { id: 'top-movers', label: 'Top Movers', icon: '\uD83D\uDD25', category: 'performance', description: 'Biggest % movers today' },
];

// ============================================
// HELPER: Get asset name from symbol
// ============================================

function getAssetName(symbol) {
  const stock = findStock(symbol);
  if (stock) return stock.name;
  const crypto = findCrypto(symbol);
  if (crypto) return crypto.name;
  return symbol;
}

// ============================================
// COMPONENT
// ============================================

export default function WatchlistContainer({
  user,
  colors,
  stocksData = [],
  cryptoData = [],
}) {
  // --- State ---
  const [activeListId, setActiveListId] = useState(null); // set in useEffect after computing defaults
  const [sortColumn, setSortColumn] = useState('changePercent');
  const [sortDirection, setSortDirection] = useState('desc');
  const [researchAsset, setResearchAsset] = useState(null);
  const [customWatchlist, setCustomWatchlist] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState(Date.now());

  // --- Market state ---
  const marketState = useMemo(() => getMarketState(), []);

  // --- REST data → maps for O(1) lookup ---
  const stocksMap = useMemo(() => {
    const map = {};
    if (Array.isArray(stocksData)) {
      stocksData.forEach(s => { map[s.symbol] = s; });
    }
    return map;
  }, [stocksData]);

  const cryptoMap = useMemo(() => {
    const map = {};
    if (Array.isArray(cryptoData)) {
      cryptoData.forEach(c => { map[c.symbol] = c; });
    }
    return map;
  }, [cryptoData]);

  // --- Load custom watchlist from Firebase ---
  useEffect(() => {
    if (!user) return;
    const uid = user.odUserId || user.uid;
    if (!uid) return;
    getCustomWatchlist(uid).then(setCustomWatchlist).catch(() => {});
  }, [user]);

  // --- Default list selection ---
  useEffect(() => {
    if (activeListId !== null) return;
    setActiveListId(customWatchlist.length > 0 ? 'custom' : 'sector-technology');
  }, [customWatchlist, activeListId]);

  // --- Derive symbols for active list ---
  const symbols = useMemo(() => {
    if (!activeListId) return [];

    const list = WATCHLIST_CATEGORIES.find(c => c.id === activeListId);
    if (!list) return [];

    switch (list.id) {
      case 'custom':
        return customWatchlist;

      case 'crypto-all':
        return getCryptoSymbols();

      case 'top-movers': {
        // Derive from REST data — sort by |percentChange| desc, take top 15
        const allAssets = [
          ...(Array.isArray(stocksData) ? stocksData : []),
          ...(Array.isArray(cryptoData) ? cryptoData : []),
        ];
        return allAssets
          .filter(a => a.symbol && typeof a.percentChange === 'number')
          .sort((a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange))
          .slice(0, 15)
          .map(a => a.symbol);
      }

      default:
        if (list.sectorId) {
          return getStocksBySector(list.sectorId).map(s => s.symbol);
        }
        return [];
    }
  }, [activeListId, customWatchlist, stocksData, cryptoData]);

  // --- WebSocket subscription (only subscribe to visible list symbols) ---
  // For top-movers, skip WS (too many symbols) — use REST only
  const wsEnabled = activeListId !== 'top-movers' && symbols.length > 0;
  const { prices: wsPrices, status: wsStatus } = useWebSocketPrices(symbols, { enabled: wsEnabled });

  // --- Update lastUpdateTime when WS prices change ---
  useEffect(() => {
    if (Object.keys(wsPrices).length > 0) {
      setLastUpdateTime(Date.now());
    }
  }, [wsPrices]);

  // --- Merge WS prices with REST fallback ---
  const effectivePrices = useMemo(() => {
    const merged = {};
    symbols.forEach(sym => {
      const ws = wsPrices[sym];
      const rest = stocksMap[sym] || cryptoMap[sym];
      const price = ws || rest?.price || null;
      merged[sym] = {
        symbol: sym,
        price,
        change: rest?.change ?? rest?.change24h ?? 0,
        changePercent: rest?.percentChange ?? 0,
        isLive: ws !== undefined,
        name: getAssetName(sym),
      };
    });
    return merged;
  }, [symbols, wsPrices, stocksMap, cryptoMap]);

  // --- Build sorted rows ---
  const rows = useMemo(() => {
    const rowArray = symbols.map(sym => {
      const price = effectivePrices[sym] || { symbol: sym, price: null, change: 0, changePercent: 0, isLive: false, name: sym };
      return {
        ...price,
        sources: [],
      };
    });

    // Sort
    const col = sortColumn;
    const dir = sortDirection === 'asc' ? 1 : -1;
    rowArray.sort((a, b) => {
      let aVal, bVal;
      switch (col) {
        case 'symbol':
          return dir * a.symbol.localeCompare(b.symbol);
        case 'price':
          aVal = a.price || 0;
          bVal = b.price || 0;
          return dir * (aVal - bVal);
        case 'change':
          aVal = a.change || 0;
          bVal = b.change || 0;
          return dir * (aVal - bVal);
        case 'changePercent':
        default:
          aVal = a.changePercent || 0;
          bVal = b.changePercent || 0;
          return dir * (aVal - bVal);
      }
    });

    return rowArray;
  }, [symbols, effectivePrices, sortColumn, sortDirection, activeListId]);

  // --- Sort handler ---
  const handleSort = useCallback((column) => {
    setSortColumn(prev => {
      if (prev === column) {
        // Cycle direction
        setSortDirection(d => d === 'desc' ? 'asc' : 'desc');
        return column;
      }
      setSortDirection('desc');
      return column;
    });
  }, []);

  // --- Row tap → open research modal ---
  const handleRowTap = useCallback((row) => {
    setResearchAsset({
      symbol: row.symbol,
      name: row.name,
      price: row.price || 0,
      percentChange: row.changePercent || 0,
      change: row.change || 0,
    });
  }, []);

  // --- Custom watchlist handlers ---
  const handleAddToWatchlist = useCallback(async (symbol) => {
    if (customWatchlist.includes(symbol)) return;
    if (customWatchlist.length >= 30) return;

    // Optimistic update
    setCustomWatchlist(prev => [...prev, symbol]);

    const uid = user?.odUserId || user?.uid;
    if (uid) {
      try {
        await addToWatchlist(uid, symbol);
      } catch {
        // Revert on failure
        setCustomWatchlist(prev => prev.filter(s => s !== symbol));
      }
    }
  }, [customWatchlist, user]);

  const handleRemoveFromWatchlist = useCallback(async (symbol) => {
    // Optimistic update
    setCustomWatchlist(prev => prev.filter(s => s !== symbol));

    const uid = user?.odUserId || user?.uid;
    if (uid) {
      try {
        await removeFromWatchlist(uid, symbol);
      } catch {
        // Revert on failure
        setCustomWatchlist(prev => [...prev, symbol]);
      }
    }
  }, [user]);

  if (!activeListId) return null;

  return (
    <HoloCard accentColor="purple" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '12px 12px 0' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '8px',
        }}>
          <h3 style={{
            margin: 0,
            fontSize: '14px',
            fontWeight: 700,
            color: '#e6edf3',
            letterSpacing: '0.02em',
          }}>
            WATCHLIST
          </h3>
          {activeListId === 'custom' && (
            <button
              onClick={() => setShowAddModal(true)}
              style={{
                background: 'rgba(147, 51, 234, 0.2)',
                border: '1px solid #9333ea',
                color: '#c084fc',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              + Add
            </button>
          )}
        </div>

        <WatchlistSelector
          categories={WATCHLIST_CATEGORIES}
          activeListId={activeListId}
          onSelectList={setActiveListId}
          customCount={customWatchlist.length}
        />
      </div>

      <WatchlistTable
        rows={rows}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={handleSort}
        onRowTap={handleRowTap}
        activeListId={activeListId}
        onRemoveFromWatchlist={activeListId === 'custom' ? handleRemoveFromWatchlist : null}
        onAddStocks={() => setShowAddModal(true)}
        wsPrices={wsPrices}
      />

      <WatchlistFooter
        wsStatus={wsStatus}
        symbolCount={symbols.length}
        marketState={marketState}
        lastUpdateTime={lastUpdateTime}
        isWsEnabled={wsEnabled}
      />

      {/* Asset Research Modal */}
      {researchAsset && (
        <AssetResearchModal
          asset={researchAsset}
          onClose={() => setResearchAsset(null)}
          showActionButton={activeListId === 'custom' && !customWatchlist.includes(researchAsset.symbol)}
          actionConfig={
            activeListId === 'custom' && !customWatchlist.includes(researchAsset.symbol)
              ? {
                  label: 'Add to Watchlist',
                  onClick: () => {
                    handleAddToWatchlist(researchAsset.symbol);
                    setResearchAsset(null);
                  },
                  variant: 'primary',
                }
              : undefined
          }
          version={2}
        />
      )}

      {/* Add to Watchlist Modal */}
      {showAddModal && (
        <AddToWatchlistModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          currentSymbols={customWatchlist}
          onAdd={handleAddToWatchlist}
          onRemove={handleRemoveFromWatchlist}
        />
      )}
    </HoloCard>
  );
}
