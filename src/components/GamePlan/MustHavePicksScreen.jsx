import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, Search, X, Check, TrendingUp, TrendingDown, Info } from 'lucide-react';
import { SECTORS } from '../../constants/sectors';
import { stockAPI } from '../../services/eodhdAPI';

// Sector tags for stocks
const getSectorTag = (sectorId) => {
  const sectorTags = {
    XLK: 'TECHNOLOGY',
    XLV: 'HEALTHCARE',
    XLF: 'FINANCIALS',
    XLE: 'ENERGY',
    XLY: 'CONSUMER',
    XLP: 'STAPLES',
    XLI: 'INDUSTRIAL',
    XLB: 'MATERIALS',
    XLU: 'UTILITIES',
    XLRE: 'REAL ESTATE',
    XLC: 'COMMUNICATION'
  };
  return sectorTags[sectorId] || SECTORS[sectorId]?.name?.toUpperCase() || 'STOCK';
};

// Get initials for stock logo
const getInitials = (symbol) => {
  return symbol.substring(0, 2).toUpperCase();
};

// All searchable stocks - memoized outside component
const getAllStocks = () => {
  const allStocks = [];
  Object.entries(SECTORS).forEach(([sectorId, sector]) => {
    sector.topHoldings?.forEach(symbol => {
      if (!allStocks.find(s => s.symbol === symbol)) {
        allStocks.push({
          symbol,
          sector: sectorId,
          tag: getSectorTag(sectorId)
        });
      }
    });
  });
  return allStocks;
};

// Popular stocks fallback when no sectors selected
const POPULAR_STOCKS = [
  { symbol: 'AAPL', sector: 'XLK', tag: 'TECHNOLOGY' },
  { symbol: 'MSFT', sector: 'XLK', tag: 'TECHNOLOGY' },
  { symbol: 'GOOGL', sector: 'XLC', tag: 'COMMUNICATION' },
  { symbol: 'AMZN', sector: 'XLY', tag: 'CONSUMER' },
  { symbol: 'NVDA', sector: 'XLK', tag: 'TECHNOLOGY' },
  { symbol: 'TSLA', sector: 'XLY', tag: 'CONSUMER' },
  { symbol: 'META', sector: 'XLC', tag: 'COMMUNICATION' },
  { symbol: 'JPM', sector: 'XLF', tag: 'FINANCIALS' },
  { symbol: 'V', sector: 'XLF', tag: 'FINANCIALS' },
  { symbol: 'UNH', sector: 'XLV', tag: 'HEALTHCARE' },
  { symbol: 'XOM', sector: 'XLE', tag: 'ENERGY' },
  { symbol: 'HD', sector: 'XLY', tag: 'CONSUMER' }
];

// Stock Card Component - defined outside to prevent recreation
const StockCard = ({ stock, selected, onSelect, disabled, stockData, size = 'normal' }) => {
  const data = stockData[stock.symbol] || {};
  const changePercent = data.changePercent || 0;

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      onSelect(stock);
    }
  };

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyPress={(e) => e.key === 'Enter' && handleClick(e)}
      style={{
        backgroundColor: selected ? '#00d9ff15' : '#161b22',
        border: selected ? '2px solid #00d9ff' : '1px solid #21262d',
        borderRadius: '12px',
        padding: size === 'compact' ? '12px' : '16px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        transition: 'all 0.2s ease',
        position: 'relative',
        minWidth: size === 'compact' ? '100px' : '110px',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent'
      }}
    >
      {/* Selection indicator */}
      {selected && (
        <div style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          backgroundColor: '#00d9ff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Check size={12} color="#000" />
        </div>
      )}

      {/* Logo Circle */}
      <div style={{
        width: size === 'compact' ? '48px' : '56px',
        height: size === 'compact' ? '48px' : '56px',
        borderRadius: '50%',
        backgroundColor: '#21262d',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size === 'compact' ? '14px' : '16px',
        fontWeight: '700',
        color: '#8b949e',
        pointerEvents: 'none'
      }}>
        {getInitials(stock.symbol)}
      </div>

      {/* Stock Name */}
      <div style={{
        fontWeight: '600',
        fontSize: size === 'compact' ? '13px' : '14px',
        color: '#ffffff',
        textAlign: 'center',
        pointerEvents: 'none'
      }}>
        {stock.symbol}
      </div>

      {/* Performance Badge */}
      <div style={{
        padding: '3px 8px',
        backgroundColor: changePercent >= 0 ? '#10b98120' : '#ef444420',
        borderRadius: '10px',
        display: 'flex',
        alignItems: 'center',
        gap: '3px',
        pointerEvents: 'none'
      }}>
        {changePercent >= 0 ? (
          <TrendingUp size={10} color="#10b981" />
        ) : (
          <TrendingDown size={10} color="#ef4444" />
        )}
        <span style={{
          fontSize: '11px',
          fontWeight: '600',
          color: changePercent >= 0 ? '#10b981' : '#ef4444'
        }}>
          {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(1)}%
        </span>
      </div>

      {/* Sector Tag */}
      <div style={{
        fontSize: '9px',
        fontWeight: '600',
        color: '#8b949e',
        letterSpacing: '0.5px',
        pointerEvents: 'none'
      }}>
        {stock.tag}
      </div>
    </div>
  );
};

const MustHavePicksScreen = ({
  onBack,
  onNext,
  selectedSectors = [],
  riskStyle,
  initialPicks = []
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPicks, setSelectedPicks] = useState(initialPicks);
  const [stockData, setStockData] = useState({});
  const [showSearch, setShowSearch] = useState(false);

  // Memoize allStocks
  const allStocks = useMemo(() => getAllStocks(), []);
  const MAX_PICKS = 5;

  // Fetch prices for displayed stocks
  useEffect(() => {
    const fetchPrices = async () => {
      // Fetch prices for selected picks and suggested stocks
      const stocksToFetch = new Set([
        ...selectedPicks.map(p => p.symbol),
        ...suggestedStocks.map(s => s.symbol)
      ]);

      if (stocksToFetch.size === 0) return;

      try {
        const symbols = Array.from(stocksToFetch);
        const prices = await stockAPI.getMultipleStockPrices(symbols);
        setStockData(prev => ({ ...prev, ...prices }));
      } catch (error) {
        console.error('Error fetching prices:', error);
      }
    };

    fetchPrices();
  }, [selectedPicks.length]); // Only refetch when picks change

  // Get suggested stocks from selected sectors (or use popular stocks as fallback)
  const suggestedStocks = useMemo(() => {
    if (selectedSectors.length === 0) {
      // No sectors selected - show popular stocks
      return POPULAR_STOCKS;
    }

    return selectedSectors
      .flatMap(sectorId => {
        const sector = SECTORS[sectorId];
        return sector?.topHoldings?.slice(0, 8).map(symbol => ({
          symbol,
          sector: sectorId,
          tag: getSectorTag(sectorId)
        })) || [];
      })
      .filter((stock, index, arr) => arr.findIndex(s => s.symbol === stock.symbol) === index)
      .slice(0, 12);
  }, [selectedSectors]);

  // Search handler with debounce
  const searchTimeoutRef = React.useRef(null);

  const handleSearchChange = useCallback((query) => {
    setSearchQuery(query);
    setShowSearch(true);

    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Debounce search
    searchTimeoutRef.current = setTimeout(() => {
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }

      const queryLower = query.toLowerCase();
      const results = allStocks.filter(stock =>
        stock.symbol.toLowerCase().includes(queryLower)
      ).slice(0, 8);

      setSearchResults(results);
    }, 200);
  }, [allStocks]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const handleSelectStock = useCallback((stock) => {
    console.log('[MustHaves] Selecting stock:', stock.symbol);
    setSelectedPicks(prev => {
      const exists = prev.find(p => p.symbol === stock.symbol);
      if (exists) {
        console.log('[MustHaves] Deselecting:', stock.symbol);
        return prev.filter(p => p.symbol !== stock.symbol);
      } else if (prev.length < MAX_PICKS) {
        console.log('[MustHaves] Adding:', stock.symbol, 'Count:', prev.length + 1);
        return [...prev, stock];
      }
      return prev;
    });
    setSearchQuery('');
    setSearchResults([]);
    setShowSearch(false);
  }, []);

  const isSelected = useCallback((symbol) => {
    return selectedPicks.some(p => p.symbol === symbol);
  }, [selectedPicks]);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0d1117', color: '#ffffff' }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid #21262d',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <button
          onClick={onBack}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'transparent',
            border: 'none',
            color: '#00d9ff',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          <ArrowLeft size={18} /> Back
        </button>

        <div style={{ fontSize: '14px', color: '#8b949e' }}>
          Step 4 of 5
        </div>

        <div style={{ width: '60px' }} />
      </div>

      {/* Progress Dots */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', padding: '16px' }}>
        {[1, 2, 3, 4, 5].map((step) => (
          <div
            key={step}
            style={{
              width: step === 4 ? '24px' : '8px',
              height: '8px',
              borderRadius: step === 4 ? '4px' : '50%',
              backgroundColor: step <= 4 ? '#00d9ff' : '#21262d'
            }}
          />
        ))}
      </div>

      {/* Title */}
      <div style={{ textAlign: 'center', padding: '0 20px 24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px' }}>
          Pick Your Must-Haves
        </h1>
        <p style={{ color: '#8b949e', fontSize: '15px' }}>
          Select up to {MAX_PICKS} stocks you definitely want in your portfolio
        </p>
      </div>

      {/* Selected Counter */}
      <div style={{
        margin: '0 20px 20px',
        padding: '12px 16px',
        backgroundColor: '#161b22',
        borderRadius: '10px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span style={{ color: '#8b949e', fontWeight: '500' }}>Selected</span>
        <span style={{
          fontWeight: '700',
          fontSize: '18px',
          color: selectedPicks.length === MAX_PICKS ? '#10b981' : '#00d9ff'
        }}>
          {selectedPicks.length} / {MAX_PICKS}
        </span>
      </div>

      {/* Selected Picks Display */}
      {selectedPicks.length > 0 && (
        <div style={{ padding: '0 20px', marginBottom: '24px' }}>
          <div style={{
            fontSize: '12px',
            color: '#8b949e',
            marginBottom: '12px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ fontSize: '14px' }}>⭐</span>
            YOUR PICKS
          </div>
          <div style={{
            display: 'flex',
            gap: '12px',
            overflowX: 'auto',
            paddingBottom: '8px'
          }}>
            {selectedPicks.map(pick => (
              <StockCard
                key={pick.symbol}
                stock={pick}
                selected={true}
                onSelect={handleSelectStock}
                disabled={false}
                stockData={stockData}
                size="compact"
              />
            ))}
          </div>
        </div>
      )}

      {/* Search Box */}
      <div style={{ padding: '0 20px', marginBottom: '24px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '14px 16px',
          backgroundColor: '#161b22',
          borderRadius: '12px',
          border: '1px solid #21262d'
        }}>
          <Search size={20} color="#8b949e" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={() => setShowSearch(true)}
            placeholder="Search stocks (e.g., AAPL, MSFT)..."
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#ffffff',
              fontSize: '15px'
            }}
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSearchResults([]);
              }}
              style={{
                backgroundColor: '#21262d',
                border: 'none',
                borderRadius: '50%',
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <X size={14} color="#8b949e" />
            </button>
          )}
        </div>

        {/* Search Results */}
        {showSearch && searchResults.length > 0 && (
          <div style={{
            marginTop: '12px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
            gap: '12px'
          }}>
            {searchResults.map(stock => (
              <StockCard
                key={stock.symbol}
                stock={stock}
                selected={isSelected(stock.symbol)}
                onSelect={handleSelectStock}
                disabled={selectedPicks.length >= MAX_PICKS && !isSelected(stock.symbol)}
                stockData={stockData}
                size="compact"
              />
            ))}
          </div>
        )}
      </div>

      {/* Suggested From Sectors */}
      {suggestedStocks.length > 0 && (
        <div style={{ padding: '0 20px', marginBottom: '24px' }}>
          <div style={{
            fontSize: '12px',
            color: '#8b949e',
            marginBottom: '12px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ fontSize: '14px' }}>🎯</span>
            {selectedSectors.length > 0 ? 'SUGGESTED FROM YOUR SECTORS' : 'POPULAR STOCKS'}
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
            gap: '12px'
          }}>
            {suggestedStocks.map(stock => (
              <StockCard
                key={stock.symbol}
                stock={stock}
                selected={isSelected(stock.symbol)}
                onSelect={handleSelectStock}
                disabled={selectedPicks.length >= MAX_PICKS && !isSelected(stock.symbol)}
                stockData={stockData}
              />
            ))}
          </div>
        </div>
      )}

      {/* Info Banner */}
      <div style={{
        margin: '0 20px 100px',
        padding: '14px 16px',
        backgroundColor: 'rgba(0, 217, 255, 0.1)',
        border: '1px solid rgba(0, 217, 255, 0.3)',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <Info size={20} color="#00d9ff" />
        <span style={{ fontSize: '13px', color: '#c9d1d9', lineHeight: '1.4' }}>
          AI will pick 4 more stocks (2 wildcards + 2 session-optimized) to complete your 9-stock lineup
        </span>
      </div>

      {/* Bottom Action Bar */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '16px 20px',
        backgroundColor: '#161b22',
        borderTop: '1px solid #21262d',
        display: 'flex',
        gap: '12px'
      }}>
        <button
          onClick={onBack}
          style={{
            flex: 1,
            padding: '14px',
            backgroundColor: '#21262d',
            border: 'none',
            borderRadius: '10px',
            color: '#ffffff',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          Back
        </button>
        <button
          onClick={() => onNext(selectedPicks)}
          style={{
            flex: 2,
            padding: '14px',
            backgroundColor: '#00d9ff',
            border: 'none',
            borderRadius: '10px',
            color: '#000000',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          {selectedPicks.length === 0 ? 'Skip (AI picks all)' : `Continue with ${selectedPicks.length} Pick${selectedPicks.length !== 1 ? 's' : ''}`} →
        </button>
      </div>
    </div>
  );
};

export default MustHavePicksScreen;
