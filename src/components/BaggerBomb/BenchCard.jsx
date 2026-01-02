// BenchCard - Compact card for bench assets in TD Portfolio Builder
import React from 'react';

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
 * BenchCard - Compact bench asset card
 *
 * @param {Object} asset - Asset with symbol, name, price
 * @param {Object} threshold - Threshold data
 * @param {Function} onRemove - Callback to remove asset
 * @param {boolean} isCrypto - Whether this is a crypto asset
 */
export function BenchCard({ asset, threshold, onRemove, isCrypto = false }) {
  return (
    <div style={{
      position: 'relative',
      backgroundColor: colors.cardBg,
      border: `1px solid ${isCrypto ? 'rgba(245,158,11,0.3)' : colors.border}`,
      borderRadius: '10px',
      padding: '12px',
      minWidth: '100px',
      textAlign: 'center',
      transition: 'border-color 0.2s'
    }}>
      {/* Remove button */}
      <button
        onClick={() => onRemove(asset.symbol)}
        style={{
          position: 'absolute',
          top: '4px',
          right: '4px',
          background: 'rgba(0,0,0,0.5)',
          border: 'none',
          color: colors.textMuted,
          cursor: 'pointer',
          padding: '2px 6px',
          fontSize: '14px',
          lineHeight: 1,
          borderRadius: '4px',
          transition: 'color 0.2s, background 0.2s'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = colors.red;
          e.currentTarget.style.background = 'rgba(239,68,68,0.2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = colors.textMuted;
          e.currentTarget.style.background = 'rgba(0,0,0,0.5)';
        }}
      >
        ×
      </button>

      {/* Symbol */}
      <div style={{
        fontSize: '16px',
        fontWeight: '700',
        color: isCrypto ? colors.yellow : colors.textPrimary,
        marginBottom: '4px'
      }}>
        {asset.symbol}
      </div>

      {/* Price */}
      <div style={{
        fontSize: '12px',
        color: colors.textSecondary,
        marginBottom: '8px'
      }}>
        ${asset.price?.toFixed(2) || '0.00'}
      </div>

      {/* Threshold */}
      {threshold && (
        <div style={{
          fontSize: '11px',
          color: colors.textMuted,
          padding: '4px 6px',
          backgroundColor: 'rgba(0,0,0,0.3)',
          borderRadius: '4px'
        }}>
          🎯 {threshold.threshold?.toFixed(1) || '?'}%
        </div>
      )}
    </div>
  );
}

/**
 * AddBenchCard - Placeholder card to add a new bench asset
 *
 * @param {Function} onClick - Callback when clicked
 * @param {string} type - 'stock' or 'crypto'
 */
export function AddBenchCard({ onClick, type = 'stock' }) {
  const isCrypto = type === 'crypto';

  return (
    <button
      onClick={onClick}
      style={{
        backgroundColor: 'transparent',
        border: `2px dashed ${isCrypto ? 'rgba(245,158,11,0.3)' : colors.border}`,
        borderRadius: '10px',
        padding: '12px',
        minWidth: '100px',
        minHeight: '80px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        transition: 'border-color 0.2s, background 0.2s'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = isCrypto ? colors.yellow : colors.primary;
        e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = isCrypto ? 'rgba(245,158,11,0.3)' : colors.border;
        e.currentTarget.style.background = 'transparent';
      }}
    >
      <span style={{
        fontSize: '24px',
        color: isCrypto ? colors.yellow : colors.primary
      }}>
        +
      </span>
      <span style={{
        fontSize: '11px',
        color: colors.textMuted
      }}>
        Add {isCrypto ? 'Crypto' : 'Stock'}
      </span>
    </button>
  );
}

export default BenchCard;
