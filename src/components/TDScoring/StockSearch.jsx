// StockSearch - Search/filter component for adding stocks in TD Portfolio Builder
import React, { useState, useMemo } from 'react';

const colors = {
  background: '#0a0a0f',
  cardBg: 'rgba(255,255,255,0.03)',
  cardBgHover: 'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.1)',
  primary: '#00d9ff',
  green: '#10b981',
  yellow: '#f59e0b',
  red: '#ef4444',
  textPrimary: '#ffffff',
  textSecondary: 'rgba(255,255,255,0.6)',
  textMuted: 'rgba(255,255,255,0.4)'
};

/**
 * Get difficulty label and color from threshold
 */
const getDifficultyFromThreshold = (threshold) => {
  if (!threshold) return null;
  if (threshold <= 2) return { label: 'Easy', color: colors.green };
  if (threshold <= 4) return { label: 'Medium', color: colors.yellow };
  return { label: 'Hard', color: colors.red };
};

/**
 * StockSearch - Search and filter stocks for roster/bench selection
 *
 * @param {Function} onSelect - Callback when stock is selected
 * @param {Array} excludeSymbols - Symbols to exclude from results
 * @param {Array} stocks - Available stocks array
 * @param {Object} stockPrices - Price data by symbol
 * @param {Object} thresholds - Threshold data by symbol
 * @param {string} placeholder - Search placeholder text
 * @param {number} maxResults - Maximum results to show
 */
export default function StockSearch({
  onSelect,
  excludeSymbols = [],
  stocks = [],
  stockPrices = {},
  thresholds = {},
  placeholder = 'Search stocks...',
  maxResults = 10
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all'); // 'all', 'easy', 'medium', 'hard'
  const [showResults, setShowResults] = useState(false);

  const filteredStocks = useMemo(() => {
    const excludeSet = new Set(excludeSymbols);

    return stocks.filter(stock => {
      // Exclude already selected
      if (excludeSet.has(stock.symbol)) return false;

      // Search query match
      if (query) {
        const q = query.toLowerCase();
        const matchesSymbol = stock.symbol.toLowerCase().includes(q);
        const matchesName = stock.name?.toLowerCase().includes(q);
        if (!matchesSymbol && !matchesName) return false;
      }

      // Difficulty filter
      if (filter !== 'all') {
        const threshold = thresholds[stock.symbol]?.threshold;
        if (!threshold) return false;

        switch (filter) {
          case 'easy':
            if (threshold > 2) return false;
            break;
          case 'medium':
            if (threshold <= 2 || threshold > 4) return false;
            break;
          case 'hard':
            if (threshold <= 4) return false;
            break;
        }
      }

      return true;
    }).slice(0, maxResults);
  }, [stocks, excludeSymbols, query, filter, thresholds, maxResults]);

  const handleSelect = (stock) => {
    onSelect(stock);
    setQuery('');
    setShowResults(false);
  };

  return (
    <div style={{
      position: 'relative',
      marginTop: '12px'
    }}>
      {/* Search Row */}
      <div style={{
        display: 'flex',
        gap: '8px'
      }}>
        <div style={{
          flex: 1,
          position: 'relative'
        }}>
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowResults(true);
            }}
            onFocus={() => setShowResults(true)}
            placeholder={placeholder}
            style={{
              width: '100%',
              padding: '12px 16px',
              paddingLeft: '40px',
              borderRadius: '10px',
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.cardBg,
              color: colors.textPrimary,
              fontSize: '14px',
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
          />
          <span style={{
            position: 'absolute',
            left: '14px',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '16px',
            color: colors.textMuted
          }}>
            🔍
          </span>
        </div>

        {/* Filter Dropdown */}
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            padding: '12px 16px',
            borderRadius: '10px',
            border: `1px solid ${colors.border}`,
            backgroundColor: colors.cardBg,
            color: colors.textPrimary,
            fontSize: '14px',
            cursor: 'pointer',
            outline: 'none',
            minWidth: '100px'
          }}
        >
          <option value="all">All</option>
          <option value="easy">Easy TD</option>
          <option value="medium">Medium TD</option>
          <option value="hard">Hard TD</option>
        </select>
      </div>

      {/* Results Dropdown */}
      {showResults && filteredStocks.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: '4px',
          maxHeight: '240px',
          overflowY: 'auto',
          borderRadius: '10px',
          border: `1px solid ${colors.border}`,
          backgroundColor: '#12121a',
          boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
          zIndex: 50
        }}>
          {filteredStocks.map((stock) => {
            const price = stockPrices[stock.symbol]?.price || 0;
            const threshold = thresholds[stock.symbol];
            const difficulty = getDifficultyFromThreshold(threshold?.threshold);

            return (
              <button
                key={stock.symbol}
                onClick={() => handleSelect(stock)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: `1px solid ${colors.border}`,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = colors.cardBgHover}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: colors.textPrimary
                    }}>
                      {stock.symbol}
                    </span>
                    {difficulty && (
                      <span style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: `${difficulty.color}20`,
                        color: difficulty.color,
                        fontWeight: '500'
                      }}>
                        {difficulty.label}
                      </span>
                    )}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: colors.textMuted,
                    marginTop: '2px',
                    maxWidth: '200px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {stock.name}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    fontSize: '14px',
                    color: colors.textSecondary
                  }}>
                    ${price.toFixed(2)}
                  </div>
                  {threshold && (
                    <div style={{
                      fontSize: '11px',
                      color: colors.textMuted
                    }}>
                      🎯 {threshold.threshold?.toFixed(1)}%
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Click outside to close */}
      {showResults && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 40
          }}
          onClick={() => setShowResults(false)}
        />
      )}
    </div>
  );
}
