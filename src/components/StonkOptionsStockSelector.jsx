/**
 * Stock Selector
 * Grid of stocks to choose from with volatility badges
 */

import React from 'react';
import { getVolatilityTier, STONK_OPTIONS_CONFIG } from '../services/stonkOptionsEngineV2';

// Flatten all stocks from tiers
const ALL_STOCKS = Object.values(STONK_OPTIONS_CONFIG.volatilityTiers)
  .flatMap(tier => tier.stocks);

const StonkOptionsStockSelector = ({
  stocks = ALL_STOCKS,
  prices = {},
  selectedStock,
  onSelectStock
}) => {
  return (
    <div style={{
      background: '#0d1117',
      borderRadius: 12,
      padding: 16
    }}>
      <h3 style={{
        margin: '0 0 12px',
        fontSize: 14,
        color: '#9ca3af',
        fontWeight: '600'
      }}>
        Select Stock
      </h3>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
        gap: 8
      }}>
        {stocks.map(symbol => {
          const tierInfo = getVolatilityTier(symbol);
          const price = prices[symbol];
          const isSelected = selectedStock === symbol;

          return (
            <button
              key={symbol}
              onClick={() => onSelectStock(symbol)}
              style={{
                padding: '12px 8px',
                background: isSelected ? '#1a1f2e' : 'transparent',
                border: isSelected ? `2px solid ${tierInfo.color}` : '1px solid #2d3748',
                borderRadius: 8,
                cursor: 'pointer',
                transition: 'all 0.15s',
                textAlign: 'center'
              }}
            >
              <div style={{
                color: isSelected ? tierInfo.color : 'white',
                fontWeight: '600',
                fontSize: 14
              }}>
                {symbol}
              </div>
              {price && (
                <div style={{
                  color: '#6b7280',
                  fontSize: 11,
                  marginTop: 4
                }}>
                  ${price.toFixed(2)}
                </div>
              )}
              <div style={{
                marginTop: 4,
                fontSize: 9,
                padding: '2px 6px',
                borderRadius: 4,
                background: tierInfo.color + '20',
                color: tierInfo.color,
                display: 'inline-block'
              }}>
                {tierInfo.label}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default StonkOptionsStockSelector;
