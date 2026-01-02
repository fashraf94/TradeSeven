// StockSelector - Sector-tabbed grid for selecting stocks in TD Portfolio Builder
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

// Sector definitions with icons
const SECTORS = [
  { id: 'Technology', label: 'Tech', icon: '💻' },
  { id: 'Finance', label: 'Finance', icon: '🏦' },
  { id: 'Healthcare', label: 'Health', icon: '🏥' },
  { id: 'Consumer Discretionary', label: 'Consumer', icon: '🛍️' },
  { id: 'Consumer Staples', label: 'Staples', icon: '🛒' },
  { id: 'Energy', label: 'Energy', icon: '⚡' },
  { id: 'Industrials', label: 'Industrial', icon: '🏭' },
  { id: 'Utilities', label: 'Utilities', icon: '💡' },
  { id: 'Real Estate', label: 'Real Estate', icon: '🏢' },
  { id: 'Telecom', label: 'Telecom', icon: '📡' }
];

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
 * StockSearch (StockSelector) - Sector-tabbed grid for stock selection
 *
 * @param {Function} onSelect - Callback when stock is selected
 * @param {Array} excludeSymbols - Symbols to exclude from results
 * @param {Array} stocks - Available stocks array
 * @param {Object} stockPrices - Price data by symbol
 * @param {Object} thresholds - Threshold data by symbol
 * @param {string} placeholder - Unused (kept for compatibility)
 * @param {number} maxResults - Unused (kept for compatibility)
 */
export default function StockSearch({
  onSelect,
  excludeSymbols = [],
  stocks = [],
  stockPrices = {},
  thresholds = {}
}) {
  const [activeTab, setActiveTab] = useState('Technology');

  // Filter stocks by active sector and exclude already selected
  const filteredStocks = useMemo(() => {
    const excludeSet = new Set(excludeSymbols);
    return stocks.filter(stock =>
      stock.sector === activeTab && !excludeSet.has(stock.symbol)
    );
  }, [stocks, activeTab, excludeSymbols]);

  // Get count of available stocks per sector
  const sectorCounts = useMemo(() => {
    const excludeSet = new Set(excludeSymbols);
    const counts = {};
    SECTORS.forEach(sector => {
      counts[sector.id] = stocks.filter(
        s => s.sector === sector.id && !excludeSet.has(s.symbol)
      ).length;
    });
    return counts;
  }, [stocks, excludeSymbols]);

  const handleSelect = (stock) => {
    onSelect(stock);
  };

  return (
    <div style={{ marginTop: '12px' }}>
      {/* Sector Tabs - Horizontal scrollable */}
      <div style={{
        display: 'flex',
        gap: '8px',
        overflowX: 'auto',
        paddingBottom: '12px',
        marginBottom: '12px',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }}>
        {SECTORS.map(sector => {
          const isActive = activeTab === sector.id;
          const count = sectorCounts[sector.id] || 0;

          return (
            <button
              key={sector.id}
              onClick={() => setActiveTab(sector.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '8px 14px',
                borderRadius: '10px',
                background: isActive ? 'rgba(0,217,255,0.15)' : colors.cardBg,
                border: `1px solid ${isActive ? colors.primary : colors.border}`,
                color: isActive ? colors.primary : colors.textSecondary,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                minWidth: '70px',
                opacity: count === 0 ? 0.5 : 1
              }}
            >
              <span style={{ fontSize: '18px', marginBottom: '4px' }}>
                {sector.icon}
              </span>
              <span style={{ fontSize: '11px', fontWeight: '500' }}>
                {sector.label}
              </span>
              <span style={{
                fontSize: '10px',
                color: isActive ? colors.primary : colors.textMuted,
                marginTop: '2px'
              }}>
                ({count})
              </span>
            </button>
          );
        })}
      </div>

      {/* Stock Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(95px, 1fr))',
        gap: '10px',
        maxHeight: '280px',
        overflowY: 'auto',
        padding: '4px'
      }}>
        {filteredStocks.length === 0 ? (
          <div style={{
            gridColumn: '1 / -1',
            textAlign: 'center',
            padding: '24px',
            color: colors.textMuted
          }}>
            No stocks available in this sector
          </div>
        ) : (
          filteredStocks.map((stock) => {
            const price = stockPrices[stock.symbol]?.price || 0;
            const threshold = thresholds[stock.symbol];
            const difficulty = getDifficultyFromThreshold(threshold?.threshold);

            return (
              <button
                key={stock.symbol}
                onClick={() => handleSelect(stock)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '10px 6px',
                  borderRadius: '10px',
                  background: colors.cardBg,
                  border: `1px solid ${colors.border}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  textAlign: 'center'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = colors.cardBgHover;
                  e.currentTarget.style.borderColor = colors.primary;
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = colors.cardBg;
                  e.currentTarget.style.borderColor = colors.border;
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {/* Symbol */}
                <div style={{
                  fontSize: '14px',
                  fontWeight: '700',
                  color: colors.primary,
                  marginBottom: '2px'
                }}>
                  {stock.symbol}
                </div>

                {/* Name */}
                <div style={{
                  fontSize: '10px',
                  color: colors.textMuted,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '100%',
                  marginBottom: '4px'
                }}>
                  {stock.name}
                </div>

                {/* Price */}
                <div style={{
                  fontSize: '12px',
                  color: colors.textSecondary,
                  marginBottom: '4px'
                }}>
                  ${price.toFixed(2)}
                </div>

                {/* Difficulty Badge */}
                {difficulty && (
                  <div style={{
                    fontSize: '9px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: `${difficulty.color}20`,
                    color: difficulty.color,
                    fontWeight: '600'
                  }}>
                    {difficulty.label}
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Hide scrollbar styles */}
      <style>{`
        div::-webkit-scrollbar {
          height: 0;
          width: 0;
        }
      `}</style>
    </div>
  );
}
