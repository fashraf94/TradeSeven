import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Search, X, Check, TrendingUp, TrendingDown, Info } from 'lucide-react';
import { SECTORS } from '../../constants/sectors';
import { stockAPI } from '../../services/eodhdAPI';

// Custom debounce function
const debounce = (func, wait) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

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

// All searchable stocks
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

  const allStocks = getAllStocks();
  const MAX_PICKS = 5;

  // Fetch prices for selected stocks
  useEffect(() => {
    const fetchPrices = async () => {
      if (selectedPicks.length === 0) return;

      try {
        const symbols = selectedPicks.map(p => p.symbol);
        const prices = await stockAPI.getMultipleStockPrices(symbols);
        setStockData(prices);
      } catch (error) {
        console.error('Error fetching prices:', error);
      }
    };

    fetchPrices();
  }, [selectedPicks]);

  // Get suggested stocks from selected sectors
  const suggestedStocks = selectedSectors
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

  // Debounced search
  const debouncedSearch = useCallback(
    debounce((query) => {
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }

      const queryLower = query.toLowerCase();
      const results = allStocks.filter(stock =>
        stock.symbol.toLowerCase().includes(queryLower)
      ).slice(0, 8);

      setSearchResults(results);
    }, 300),
    [allStocks]
  );

  useEffect(() => {
    debouncedSearch(searchQuery);
  }, [searchQuery, debouncedSearch]);

  const handleSelectStock = (stock) => {
    if (selectedPicks.find(p => p.symbol === stock.symbol)) {
      setSelectedPicks(prev => prev.filter(p => p.symbol !== stock.symbol));
    } else if (selectedPicks.length < MAX_PICKS) {
      setSelectedPicks(prev => [...prev, stock]);
      setSearchQuery('');
      setSearchResults([]);
      setShowSearch(false);
    }
  };

  const isSelected = (symbol) => selectedPicks.some(p => p.symbol === symbol);

  // Stock Card Component
  const StockCard = ({ stock, size = 'normal' }) => {
    const selected = isSelected(stock.symbol);
    const data = stockData[stock.symbol] || {};
    const changePercent = data.changePercent || 0;

    return (
      <div
        onClick={() => handleSelectStock(stock)}
        style={{
          backgroundColor: selected ? '#00d9ff15' : '#161b22',
          border: selected ? '2px solid #00d9ff' : '1px solid #21262d',
          borderRadius: '12px',
          padding: size === 'compact' ? '12px' : '16px',
          cursor: selectedPicks.length >= MAX_PICKS && !selected ? 'not-allowed' : 'pointer',
          opacity: selectedPicks.length >= MAX_PICKS && !selected ? 0.5 : 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
          transition: 'all 0.2s ease',
          position: 'relative',
          minWidth: size === 'compact' ? '100px' : '110px'
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
          color: '#8b949e'
        }}>
          {getInitials(stock.symbol)}
        </div>

        {/* Stock Name */}
        <div style={{
          fontWeight: '600',
          fontSize: size === 'compact' ? '13px' : '14px',
          color: '#ffffff',
          textAlign: 'center'
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
          gap: '3px'
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
          letterSpacing: '0.5px'
        }}>
          {stock.tag}
        </div>
      </div>
    );
  };

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
              <StockCard key={pick.symbol} stock={pick} size="compact" />
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
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSearch(true);
            }}
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
              <StockCard key={stock.symbol} stock={stock} size="compact" />
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
            SUGGESTED FROM YOUR SECTORS
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
            gap: '12px'
          }}>
            {suggestedStocks.map(stock => (
              <StockCard key={stock.symbol} stock={stock} />
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
