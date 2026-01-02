import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Search, X, Plus, Check, Info } from 'lucide-react';
import { SECTORS } from '../../constants/sectors';
import { fetchStockPrices } from '../../services/eodhdAPI';
import debounce from 'lodash/debounce';

// Popular stocks for quick selection
const POPULAR_STOCKS = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'MSFT', name: 'Microsoft' },
  { symbol: 'GOOGL', name: 'Alphabet' },
  { symbol: 'AMZN', name: 'Amazon' },
  { symbol: 'NVDA', name: 'NVIDIA' },
  { symbol: 'TSLA', name: 'Tesla' },
  { symbol: 'META', name: 'Meta Platforms' },
  { symbol: 'JPM', name: 'JPMorgan Chase' },
  { symbol: 'V', name: 'Visa' },
  { symbol: 'JNJ', name: 'Johnson & Johnson' },
  { symbol: 'XOM', name: 'Exxon Mobil' },
  { symbol: 'UNH', name: 'UnitedHealth' },
  { symbol: 'HD', name: 'Home Depot' },
  { symbol: 'PG', name: 'Procter & Gamble' },
  { symbol: 'DIS', name: 'Disney' }
];

// All searchable stocks (combine from all sectors)
const getAllStocks = () => {
  const allStocks = [];
  Object.values(SECTORS).forEach(sector => {
    sector.topHoldings?.forEach(symbol => {
      if (!allStocks.find(s => s.symbol === symbol)) {
        allStocks.push({ symbol, sector: sector.id });
      }
    });
  });
  return allStocks;
};

const MustHavePicksScreen = ({
  onBack,
  onNext,
  selectedSectors,
  riskStyle,
  initialPicks = []
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPicks, setSelectedPicks] = useState(initialPicks);
  const [stockPrices, setStockPrices] = useState({});
  const [showSearch, setShowSearch] = useState(false);

  const allStocks = getAllStocks();
  const MAX_PICKS = 5;

  // Fetch prices for selected stocks
  useEffect(() => {
    const fetchPrices = async () => {
      if (selectedPicks.length === 0) return;

      try {
        const symbols = selectedPicks.map(p => p.symbol);
        const prices = await fetchStockPrices(symbols);
        setStockPrices(prices);
      } catch (error) {
        console.error('Error fetching prices:', error);
      }
    };

    fetchPrices();
  }, [selectedPicks]);

  // Debounced search
  const debouncedSearch = useCallback(
    debounce((query) => {
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }

      const queryLower = query.toLowerCase();
      const results = allStocks.filter(stock =>
        stock.symbol.toLowerCase().includes(queryLower) ||
        SECTORS[stock.sector]?.name?.toLowerCase().includes(queryLower)
      ).slice(0, 15);

      setSearchResults(results);
    }, 300),
    [allStocks]
  );

  useEffect(() => {
    debouncedSearch(searchQuery);
  }, [searchQuery, debouncedSearch]);

  const handleSelectStock = (stock) => {
    if (selectedPicks.find(p => p.symbol === stock.symbol)) {
      // Remove if already selected
      setSelectedPicks(prev => prev.filter(p => p.symbol !== stock.symbol));
    } else if (selectedPicks.length < MAX_PICKS) {
      // Add if under limit
      setSelectedPicks(prev => [...prev, stock]);
      setSearchQuery('');
      setSearchResults([]);
      setShowSearch(false);
    }
  };

  const handleRemovePick = (symbol) => {
    setSelectedPicks(prev => prev.filter(p => p.symbol !== symbol));
  };

  const handleNext = () => {
    onNext(selectedPicks);
  };

  const isSelected = (symbol) => selectedPicks.some(p => p.symbol === symbol);

  // Get suggested stocks from selected sectors
  const suggestedStocks = selectedSectors
    .flatMap(sectorId => SECTORS[sectorId]?.topHoldings?.slice(0, 5) || [])
    .filter((symbol, index, arr) => arr.indexOf(symbol) === index)
    .slice(0, 10)
    .map(symbol => ({ symbol, sector: selectedSectors.find(s => SECTORS[s]?.topHoldings?.includes(symbol)) }));

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
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#00d9ff' }} />
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#00d9ff' }} />
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#00d9ff' }} />
        <div style={{ width: '24px', height: '8px', borderRadius: '4px', backgroundColor: '#00d9ff' }} />
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#21262d' }} />
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

      {/* Selection Counter */}
      <div style={{
        margin: '0 20px 16px',
        padding: '12px 16px',
        backgroundColor: '#161b22',
        borderRadius: '10px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span style={{ color: '#8b949e' }}>Selected</span>
        <span style={{
          fontWeight: '600',
          color: selectedPicks.length === MAX_PICKS ? '#10b981' : '#00d9ff'
        }}>
          {selectedPicks.length} / {MAX_PICKS}
        </span>
      </div>

      {/* Selected Picks */}
      {selectedPicks.length > 0 && (
        <div style={{ padding: '0 20px', marginBottom: '20px' }}>
          <div style={{ fontSize: '12px', color: '#8b949e', marginBottom: '10px' }}>YOUR PICKS</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {selectedPicks.map(pick => (
              <div
                key={pick.symbol}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  backgroundColor: '#00d9ff20',
                  border: '1px solid #00d9ff',
                  borderRadius: '20px'
                }}
              >
                <span style={{ fontWeight: '600' }}>{pick.symbol}</span>
                {stockPrices[pick.symbol]?.changePercent !== undefined && (
                  <span style={{
                    fontSize: '12px',
                    color: stockPrices[pick.symbol].changePercent >= 0 ? '#10b981' : '#ef4444'
                  }}>
                    {stockPrices[pick.symbol].changePercent >= 0 ? '+' : ''}
                    {stockPrices[pick.symbol].changePercent.toFixed(1)}%
                  </span>
                )}
                <button
                  onClick={() => handleRemovePick(pick.symbol)}
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: '#8b949e',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex'
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search Box */}
      <div style={{ padding: '0 20px', marginBottom: '20px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '12px 16px',
          backgroundColor: '#161b22',
          borderRadius: '10px',
          border: '1px solid #21262d'
        }}>
          <Search size={18} color="#8b949e" />
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
                backgroundColor: 'transparent',
                border: 'none',
                color: '#8b949e',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Search Results */}
        {showSearch && searchResults.length > 0 && (
          <div style={{
            marginTop: '8px',
            backgroundColor: '#161b22',
            borderRadius: '10px',
            border: '1px solid #21262d',
            maxHeight: '250px',
            overflow: 'auto'
          }}>
            {searchResults.map(stock => (
              <div
                key={stock.symbol}
                onClick={() => handleSelectStock(stock)}
                style={{
                  padding: '12px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: selectedPicks.length >= MAX_PICKS && !isSelected(stock.symbol) ? 'not-allowed' : 'pointer',
                  opacity: selectedPicks.length >= MAX_PICKS && !isSelected(stock.symbol) ? 0.5 : 1,
                  borderBottom: '1px solid #21262d',
                  backgroundColor: isSelected(stock.symbol) ? '#00d9ff15' : 'transparent'
                }}
              >
                <div>
                  <div style={{ fontWeight: '600' }}>{stock.symbol}</div>
                  <div style={{ fontSize: '12px', color: '#8b949e' }}>
                    {SECTORS[stock.sector]?.name}
                  </div>
                </div>
                {isSelected(stock.symbol) ? (
                  <Check size={18} color="#00d9ff" />
                ) : (
                  <Plus size={18} color="#8b949e" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Suggested From Your Sectors */}
      <div style={{ padding: '0 20px', marginBottom: '20px' }}>
        <div style={{ fontSize: '12px', color: '#8b949e', marginBottom: '10px' }}>
          SUGGESTED FROM YOUR SECTORS
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {suggestedStocks.map(stock => (
            <button
              key={stock.symbol}
              onClick={() => handleSelectStock(stock)}
              disabled={selectedPicks.length >= MAX_PICKS && !isSelected(stock.symbol)}
              style={{
                padding: '8px 14px',
                backgroundColor: isSelected(stock.symbol) ? '#00d9ff' : '#21262d',
                border: 'none',
                borderRadius: '16px',
                color: isSelected(stock.symbol) ? '#000' : '#fff',
                fontSize: '13px',
                fontWeight: '500',
                cursor: selectedPicks.length >= MAX_PICKS && !isSelected(stock.symbol) ? 'not-allowed' : 'pointer',
                opacity: selectedPicks.length >= MAX_PICKS && !isSelected(stock.symbol) ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {stock.symbol}
              {isSelected(stock.symbol) && <Check size={14} />}
            </button>
          ))}
        </div>
      </div>

      {/* Popular Stocks */}
      <div style={{ padding: '0 20px', marginBottom: '100px' }}>
        <div style={{ fontSize: '12px', color: '#8b949e', marginBottom: '10px' }}>
          POPULAR STOCKS
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {POPULAR_STOCKS.map(stock => (
            <button
              key={stock.symbol}
              onClick={() => handleSelectStock(stock)}
              disabled={selectedPicks.length >= MAX_PICKS && !isSelected(stock.symbol)}
              style={{
                padding: '8px 14px',
                backgroundColor: isSelected(stock.symbol) ? '#00d9ff' : '#161b22',
                border: '1px solid #21262d',
                borderRadius: '16px',
                color: isSelected(stock.symbol) ? '#000' : '#fff',
                fontSize: '13px',
                fontWeight: '500',
                cursor: selectedPicks.length >= MAX_PICKS && !isSelected(stock.symbol) ? 'not-allowed' : 'pointer',
                opacity: selectedPicks.length >= MAX_PICKS && !isSelected(stock.symbol) ? 0.5 : 1
              }}
            >
              {stock.symbol}
            </button>
          ))}
        </div>
      </div>

      {/* Info Banner */}
      <div style={{
        position: 'fixed',
        bottom: '80px',
        left: '20px',
        right: '20px',
        padding: '12px 16px',
        backgroundColor: 'rgba(0, 217, 255, 0.1)',
        border: '1px solid rgba(0, 217, 255, 0.3)',
        borderRadius: '10px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}>
        <Info size={18} color="#00d9ff" />
        <span style={{ fontSize: '13px', color: '#c9d1d9' }}>
          AI will pick 4 more stocks (2 wildcards + 2 session-optimized) to complete your lineup
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
          onClick={handleNext}
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
