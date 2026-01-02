// AllocationBar - Visual allocation progress bar for TD Portfolio Builder
import React from 'react';

const colors = {
  background: '#0a0a0f',
  cardBg: 'rgba(255,255,255,0.03)',
  border: 'rgba(255,255,255,0.1)',
  primary: '#00d9ff',
  green: '#10b981',
  yellow: '#f59e0b',
  red: '#ef4444',
  textPrimary: '#ffffff',
  textSecondary: 'rgba(255,255,255,0.6)',
  textMuted: 'rgba(255,255,255,0.4)'
};

// Color palette for stock segments
const STOCK_COLORS = [
  '#00d9ff', // cyan
  '#10b981', // green
  '#f59e0b', // yellow
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // teal
  '#84cc16', // lime
  '#f97316', // orange
  '#6366f1', // indigo
  '#14b8a6', // emerald
  '#eab308', // amber
  '#a855f7'  // violet
];

/**
 * Get a consistent color for a stock symbol
 */
const getStockColor = (symbol, index) => {
  return STOCK_COLORS[index % STOCK_COLORS.length];
};

/**
 * AllocationBar - Visual representation of portfolio allocation
 *
 * @param {Array} stocks - Array of stocks with { symbol, amount }
 * @param {number} remaining - Remaining allocation to reach target
 * @param {number} target - Target allocation (default 90%)
 */
export default function AllocationBar({ stocks = [], remaining = 0, target = 90 }) {
  const allocated = target - remaining;
  const isComplete = Math.abs(remaining) < 0.1;
  const isOver = remaining < 0;

  return (
    <div style={{
      marginBottom: '16px',
      padding: '12px 16px',
      backgroundColor: colors.cardBg,
      borderRadius: '12px',
      border: `1px solid ${colors.border}`
    }}>
      {/* Progress Bar */}
      <div style={{
        height: '24px',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: '12px',
        overflow: 'hidden',
        display: 'flex',
        position: 'relative'
      }}>
        {stocks.map((stock, index) => (
          <div
            key={stock.symbol}
            style={{
              width: `${((stock.amount || stock.allocation || 0) / target) * 100}%`,
              height: '100%',
              backgroundColor: getStockColor(stock.symbol, index),
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: stock.amount > 8 ? '30px' : '0',
              transition: 'width 0.3s ease'
            }}
            title={`${stock.symbol}: ${(stock.amount || stock.allocation || 0).toFixed(1)}%`}
          >
            {(stock.amount || stock.allocation || 0) >= 10 && (
              <span style={{
                fontSize: '10px',
                fontWeight: '700',
                color: '#000',
                textShadow: '0 0 2px rgba(255,255,255,0.3)'
              }}>
                {stock.symbol}
              </span>
            )}
          </div>
        ))}

        {/* Remaining space */}
        {remaining > 0 && (
          <div
            style={{
              width: `${(remaining / target) * 100}%`,
              height: '100%',
              backgroundColor: 'rgba(255,255,255,0.1)',
              borderLeft: stocks.length > 0 ? '2px dashed rgba(255,255,255,0.2)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <span style={{
              fontSize: '10px',
              color: colors.textMuted
            }}>
              +{remaining.toFixed(1)}%
            </span>
          </div>
        )}
      </div>

      {/* Label */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '8px',
        fontSize: '13px'
      }}>
        <span style={{ color: colors.textSecondary }}>
          Stock Allocation
        </span>
        <div>
          <span style={{
            fontWeight: '700',
            color: isComplete ? colors.green : isOver ? colors.red : colors.yellow
          }}>
            {allocated.toFixed(1)}%
          </span>
          <span style={{ color: colors.textMuted }}> / {target}%</span>
          {remaining > 0.1 && (
            <span style={{
              color: colors.textMuted,
              marginLeft: '8px',
              fontSize: '12px'
            }}>
              · {remaining.toFixed(1)}% remaining
            </span>
          )}
          {isOver && (
            <span style={{
              color: colors.red,
              marginLeft: '8px',
              fontSize: '12px'
            }}>
              · {Math.abs(remaining).toFixed(1)}% over!
            </span>
          )}
        </div>
      </div>

      {/* Legend - only show if there are stocks */}
      {stocks.length > 0 && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          marginTop: '10px',
          paddingTop: '10px',
          borderTop: `1px solid ${colors.border}`
        }}>
          {stocks.map((stock, index) => (
            <div
              key={stock.symbol}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px'
              }}
            >
              <div style={{
                width: '10px',
                height: '10px',
                borderRadius: '2px',
                backgroundColor: getStockColor(stock.symbol, index)
              }} />
              <span style={{ color: colors.textSecondary }}>
                {stock.symbol}: {(stock.amount || stock.allocation || 0).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
