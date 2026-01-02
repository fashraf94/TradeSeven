// RosterAssetCard - Individual stock card with allocation slider for TD Portfolio Builder
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
 * Get difficulty badge based on threshold percentage
 */
const getDifficulty = (threshold) => {
  if (!threshold) return { label: 'N/A', color: colors.textMuted };
  if (threshold <= 2) return { label: 'Easy', color: colors.green };
  if (threshold <= 4) return { label: 'Medium', color: colors.yellow };
  return { label: 'Hard', color: colors.red };
};

/**
 * RosterAssetCard - Stock card with inline allocation slider and threshold display
 *
 * @param {Object} asset - Stock asset with symbol, name, price, allocation
 * @param {Object} threshold - Threshold data { threshold, rallyThreshold, moonshotThreshold }
 * @param {Function} onRemove - Callback to remove asset
 * @param {Function} onAllocationChange - Callback to update allocation
 */
export default function RosterAssetCard({
  asset,
  threshold,
  onRemove,
  onAllocationChange
}) {
  const difficulty = getDifficulty(threshold?.threshold);

  return (
    <div style={{
      backgroundColor: colors.cardBg,
      border: `1px solid ${colors.border}`,
      borderRadius: '12px',
      padding: '12px',
      marginBottom: '8px',
      transition: 'border-color 0.2s',
    }}>
      {/* Header Row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div>
            <div style={{
              fontSize: '16px',
              fontWeight: '700',
              color: colors.textPrimary
            }}>
              {asset.symbol}
            </div>
            <div style={{
              fontSize: '12px',
              color: colors.textSecondary,
              maxWidth: '150px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {asset.name}
            </div>
          </div>
          <div style={{
            fontSize: '14px',
            color: colors.textSecondary,
            backgroundColor: 'rgba(255,255,255,0.05)',
            padding: '4px 8px',
            borderRadius: '6px'
          }}>
            ${asset.price?.toFixed(2) || '0.00'}
          </div>
        </div>

        <button
          onClick={() => onRemove(asset.symbol)}
          style={{
            background: 'transparent',
            border: 'none',
            color: colors.textMuted,
            cursor: 'pointer',
            padding: '4px',
            fontSize: '18px',
            lineHeight: 1,
            transition: 'color 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = colors.red}
          onMouseLeave={(e) => e.currentTarget.style.color = colors.textMuted}
        >
          ×
        </button>
      </div>

      {/* Allocation Slider */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '12px'
      }}>
        <span style={{
          fontSize: '12px',
          color: colors.textMuted,
          minWidth: '60px'
        }}>
          Allocation
        </span>
        <input
          type="range"
          min={7.5}
          max={20}
          step={0.5}
          value={asset.amount || asset.allocation || 10}
          onChange={(e) => onAllocationChange(asset.symbol, parseFloat(e.target.value))}
          style={{
            flex: 1,
            height: '6px',
            borderRadius: '3px',
            background: `linear-gradient(to right, ${colors.primary} 0%, ${colors.primary} ${((asset.amount || asset.allocation || 10) - 7.5) / 12.5 * 100}%, ${colors.border} ${((asset.amount || asset.allocation || 10) - 7.5) / 12.5 * 100}%, ${colors.border} 100%)`,
            WebkitAppearance: 'none',
            cursor: 'pointer'
          }}
        />
        <span style={{
          fontSize: '14px',
          fontWeight: '600',
          color: colors.primary,
          minWidth: '45px',
          textAlign: 'right'
        }}>
          {(asset.amount || asset.allocation || 10).toFixed(1)}%
        </span>
      </div>

      {/* Threshold Display */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px',
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderRadius: '8px',
        fontSize: '12px'
      }}>
        <div style={{ display: 'flex', gap: '16px' }}>
          <span style={{ color: colors.textSecondary }}>
            🎯 {threshold?.threshold?.toFixed(1) || '?'}%
          </span>
          <span style={{ color: colors.textSecondary }}>
            🚀 {threshold?.rallyThreshold?.toFixed(1) || '?'}%
          </span>
          <span style={{ color: colors.textSecondary }}>
            🌙 {threshold?.moonshotThreshold?.toFixed(1) || '?'}%
          </span>
        </div>
        <span style={{
          padding: '2px 8px',
          borderRadius: '4px',
          backgroundColor: `${difficulty.color}20`,
          color: difficulty.color,
          fontWeight: '600',
          fontSize: '11px'
        }}>
          {difficulty.label}
        </span>
      </div>
    </div>
  );
}
