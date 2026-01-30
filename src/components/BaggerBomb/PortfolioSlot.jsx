// PortfolioSlot - Individual slot for portfolio builder
// Shows empty state with add button or filled state with asset info

import React from 'react';
import PropTypes from 'prop-types';
import { motion } from 'framer-motion';
import { Plus, X } from 'lucide-react';
import { HOLO_COLORS } from '../../constants/holoTheme';

/**
 * ThresholdPreview - Shows threshold levels for an asset
 */
function ThresholdPreview({ baseATR, compact = false }) {
  if (!baseATR) return null;

  const thresholds = [
    { icon: '💣', value: baseATR * 1.0, label: 'Bagger' },
    { icon: '💣💣', value: baseATR * 1.5, label: 'Double' },
    { icon: '🚀', value: baseATR * 2.0, label: 'TenBagger' },
  ];

  if (compact) {
    return (
      <div
        style={{
          display: 'flex',
          gap: '8px',
          fontSize: '10px',
          color: HOLO_COLORS.textMuted,
        }}
      >
        {thresholds.map((t) => (
          <span key={t.label}>
            {t.icon} {t.value.toFixed(1)}%
          </span>
        ))}
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '10px',
        color: HOLO_COLORS.textMuted,
        marginTop: '8px',
        padding: '6px 8px',
        backgroundColor: HOLO_COLORS.bgCard,
        borderRadius: '4px',
      }}
    >
      {thresholds.map((t) => (
        <span key={t.label} style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          <span>{t.icon}</span>
          <span>{t.value.toFixed(1)}%</span>
        </span>
      ))}
    </div>
  );
}

ThresholdPreview.propTypes = {
  baseATR: PropTypes.number,
  compact: PropTypes.bool,
};

/**
 * PortfolioSlot - Empty or filled slot
 */
export default function PortfolioSlot({
  asset,
  tier,
  allocation,
  isCrypto = false,
  onSelect,
  onRemove,
  disabled = false,
}) {
  const isEmpty = !asset;

  // Colors based on crypto vs stock
  const accentColor = isCrypto ? HOLO_COLORS.purple : HOLO_COLORS.cyan;
  const accentBg = isCrypto ? `${HOLO_COLORS.purple}15` : `${HOLO_COLORS.cyan}10`;

  // Empty slot
  if (isEmpty) {
    return (
      <motion.button
        whileHover={!disabled ? { scale: 1.02, borderColor: accentColor } : {}}
        whileTap={!disabled ? { scale: 0.98 } : {}}
        onClick={!disabled ? onSelect : undefined}
        disabled={disabled}
        style={{
          width: '100%',
          height: '100px',
          borderRadius: '12px',
          border: `2px dashed ${isCrypto ? HOLO_COLORS.purple + '50' : HOLO_COLORS.borderSubtle}`,
          backgroundColor: 'transparent',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          transition: 'all 0.2s ease',
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: accentBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Plus size={18} color={accentColor} />
        </div>
        <span
          style={{
            fontSize: '12px',
            color: HOLO_COLORS.textMuted,
            fontWeight: 500,
          }}
        >
          {isCrypto ? 'Add Crypto' : 'Add Stock'}
        </span>
        <span
          style={{
            fontSize: '10px',
            color: HOLO_COLORS.textMuted,
            opacity: 0.7,
          }}
        >
          {allocation}
        </span>
      </motion.button>
    );
  }

  // Filled slot
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{
        position: 'relative',
        width: '100%',
        height: '100px',
        borderRadius: '12px',
        backgroundColor: HOLO_COLORS.bgElevated,
        border: `1px solid ${isCrypto ? HOLO_COLORS.purple + '40' : HOLO_COLORS.borderSubtle}`,
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Remove Button */}
      <button
        onClick={onRemove}
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          backgroundColor: HOLO_COLORS.bgCard,
          border: `1px solid ${HOLO_COLORS.borderSubtle}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = HOLO_COLORS.red + '20';
          e.currentTarget.style.borderColor = HOLO_COLORS.red;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = HOLO_COLORS.bgCard;
          e.currentTarget.style.borderColor = HOLO_COLORS.borderSubtle;
        }}
      >
        <X size={12} color={HOLO_COLORS.textMuted} />
      </button>

      {/* Asset Info */}
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              fontSize: '16px',
              fontWeight: 700,
              color: HOLO_COLORS.textPrimary,
            }}
          >
            {asset.symbol}
          </span>
          {isCrypto && (
            <span style={{ fontSize: '12px' }}>🔮</span>
          )}
        </div>
        <div
          style={{
            fontSize: '11px',
            color: HOLO_COLORS.textMuted,
            marginTop: '2px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '90%',
          }}
        >
          {asset.name || asset.symbol}
        </div>
        <div
          style={{
            fontSize: '11px',
            color: accentColor,
            marginTop: '4px',
            fontWeight: 500,
          }}
        >
          {allocation} allocation
        </div>
      </div>

      {/* Threshold Preview */}
      <ThresholdPreview baseATR={asset.baseATR} compact />
    </motion.div>
  );
}

PortfolioSlot.propTypes = {
  /** Asset data if filled */
  asset: PropTypes.shape({
    symbol: PropTypes.string.isRequired,
    name: PropTypes.string,
    baseATR: PropTypes.number,
    isCrypto: PropTypes.bool,
  }),
  /** Tier this slot belongs to */
  tier: PropTypes.oneOf(['star', 'core', 'support', 'bench']),
  /** Allocation label (e.g., "20%") */
  allocation: PropTypes.string,
  /** Whether this is a crypto-only slot */
  isCrypto: PropTypes.bool,
  /** Callback when empty slot is clicked */
  onSelect: PropTypes.func,
  /** Callback when remove button is clicked */
  onRemove: PropTypes.func,
  /** Whether slot is disabled */
  disabled: PropTypes.bool,
};

PortfolioSlot.defaultProps = {
  asset: null,
  tier: 'support',
  allocation: '10%',
  isCrypto: false,
  onSelect: () => {},
  onRemove: () => {},
  disabled: false,
};

// Export ThresholdPreview for use elsewhere
export { ThresholdPreview };
