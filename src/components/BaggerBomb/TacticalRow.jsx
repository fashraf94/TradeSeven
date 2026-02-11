// TacticalRow - Sleeper-style side-by-side asset comparison row
// Displays player and opponent assets with ChamberFuse, badges, and proximity

import React from 'react';
import PropTypes from 'prop-types';
import { motion } from 'framer-motion';
import { HOLO_COLORS } from '../../constants/holoTheme';
import ChamberFuse from './ChamberFuse';
import BadgeRow from './BadgeRow';
import ProximityLabel from './ProximityLabel';

/**
 * AssetSide - One side of the tactical row (player or opponent)
 */
function AssetSide({
  asset,
  isRight = false,
  onThresholdCross,
  onSymbolClick,
  onPointsClick,
  highlighted = false,
  dimmed = false,
  onAssetSelect,
}) {
  if (!asset) {
    // Empty slot placeholder
    return (
      <div
        style={{
          flex: 1,
          padding: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: HOLO_COLORS.textMuted,
          fontSize: '12px',
          opacity: dimmed ? 0.4 : 1,
        }}
      >
        —
      </div>
    );
  }

  const {
    symbol,
    priceChange = 0,
    baseATR = 2.5,
    history = { maxMultiplier: 0, minMultiplier: 0 },
    points = 0,
    badges = [],
  } = asset;

  const isPositive = priceChange >= 0;
  const priceColor = priceChange === 0
    ? HOLO_COLORS.textMuted
    : isPositive
      ? HOLO_COLORS.green
      : HOLO_COLORS.red;

  const handleAssetClick = () => {
    if (highlighted && onAssetSelect) {
      onAssetSelect(asset);
    }
  };

  return (
    <div
      onClick={handleAssetClick}
      style={{
        flex: 1,
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        textAlign: isRight ? 'right' : 'left',
        ...(highlighted ? {
          border: '1px solid rgba(0, 217, 255, 0.4)',
          borderRadius: '8px',
          background: 'rgba(0, 217, 255, 0.05)',
          cursor: 'pointer',
        } : {}),
        ...(dimmed ? {
          opacity: 0.4,
          filter: 'grayscale(30%)',
          pointerEvents: 'none',
        } : {}),
      }}
    >
      {/* Top Row: Symbol + Points */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexDirection: isRight ? 'row-reverse' : 'row',
        }}
      >
        {/* Symbol and Price Change */}
        <div>
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (onSymbolClick) onSymbolClick(asset);
            }}
            style={{
              fontWeight: 700,
              fontSize: '14px',
              color: onSymbolClick ? '#14b8a6' : HOLO_COLORS.textPrimary,
              cursor: onSymbolClick ? 'pointer' : 'default',
              display: 'inline-block',
              padding: '2px 6px',
              margin: '-2px -6px',
              borderRadius: '4px',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => {
              if (onSymbolClick) e.target.style.background = 'rgba(13, 148, 136, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'transparent';
            }}
          >
            {symbol}
          </div>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: priceColor,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {isPositive ? '▲' : '▼'} {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
          </div>
        </div>

        {/* Points and Badges */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: isRight ? 'flex-start' : 'flex-end',
            gap: '4px',
          }}
        >
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (onPointsClick) onPointsClick(asset);
            }}
            style={{
              fontSize: '20px',
              fontWeight: 700,
              color: HOLO_COLORS.textPrimary,
              fontVariantNumeric: 'tabular-nums',
              cursor: onPointsClick ? 'pointer' : 'default',
              padding: '4px 8px',
              margin: '-4px -8px',
              borderRadius: '6px',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => {
              if (onPointsClick) e.target.style.background = 'rgba(255,255,255,0.1)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'transparent';
            }}
          >
            {points >= 0 ? '+' : ''}{Math.round(points)}
          </div>
          <BadgeRow
            badges={badges}
            size="small"
            maxDisplay={3}
            align={isRight ? 'left' : 'right'}
          />
        </div>
      </div>

      {/* ChamberFuse */}
      <ChamberFuse
        priceChange={priceChange}
        baseATR={baseATR}
        history={history}
        compact
        showLabels={false}
        onThresholdCross={onThresholdCross}
      />

      {/* Proximity Label */}
      <ProximityLabel
        priceChange={priceChange}
        baseATR={baseATR}
        history={history}
        size="small"
        align={isRight ? 'right' : 'left'}
      />
    </div>
  );
}

AssetSide.propTypes = {
  asset: PropTypes.shape({
    symbol: PropTypes.string.isRequired,
    priceChange: PropTypes.number,
    baseATR: PropTypes.number,
    history: PropTypes.shape({
      maxMultiplier: PropTypes.number,
      minMultiplier: PropTypes.number,
    }),
    points: PropTypes.number,
    badges: PropTypes.arrayOf(PropTypes.string),
  }),
  isRight: PropTypes.bool,
  onThresholdCross: PropTypes.func,
  onSymbolClick: PropTypes.func,
  onPointsClick: PropTypes.func,
  highlighted: PropTypes.bool,
  dimmed: PropTypes.bool,
  onAssetSelect: PropTypes.func,
};

/**
 * AllocationBadge - Center allocation indicator
 */
function AllocationBadge({ allocation, isCrypto = false }) {
  return (
    <div
      style={{
        width: '44px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          padding: '6px 10px',
          borderRadius: '6px',
          backgroundColor: isCrypto ? `${HOLO_COLORS.purple}30` : `${HOLO_COLORS.primary}15`,
          border: `1px solid ${isCrypto ? HOLO_COLORS.purple : HOLO_COLORS.primary}`,
          fontSize: '14px',
          fontWeight: 700,
          color: isCrypto ? HOLO_COLORS.purple : HOLO_COLORS.primary,
        }}
      >
        {allocation}
      </div>
      {isCrypto && (
        <span style={{ fontSize: '10px' }}>🔮</span>
      )}
    </div>
  );
}

AllocationBadge.propTypes = {
  allocation: PropTypes.string.isRequired,
  isCrypto: PropTypes.bool,
};

/**
 * TacticalRow - Sleeper-style side-by-side asset comparison
 */
export default function TacticalRow({
  leftAsset,
  rightAsset,
  allocationLabel = '10%',
  isCryptoSlot = false,
  onLeftThresholdCross,
  onRightThresholdCross,
  onSymbolClick,
  onPointsClick,
  // Swap target mode props
  swapTargetMode = false,
  onLeftAssetSelect,
  opponentDimmed = false,
  leftDisabled = false,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        display: 'flex',
        alignItems: 'stretch',
        backgroundColor: HOLO_COLORS.bgElevated,
        borderBottom: `1px solid ${HOLO_COLORS.borderSubtle}`,
        minHeight: '120px',
      }}
    >
      {/* Left Asset (Player) */}
      <AssetSide
        asset={leftAsset}
        isRight={false}
        onThresholdCross={onLeftThresholdCross}
        onSymbolClick={onSymbolClick}
        onPointsClick={onPointsClick}
        highlighted={swapTargetMode && !leftDisabled}
        dimmed={leftDisabled}
        onAssetSelect={onLeftAssetSelect}
      />

      {/* Center Allocation Badge */}
      <AllocationBadge
        allocation={allocationLabel}
        isCrypto={isCryptoSlot}
      />

      {/* Right Asset (Opponent) */}
      <AssetSide
        asset={rightAsset}
        isRight={true}
        onThresholdCross={onRightThresholdCross}
        onSymbolClick={onSymbolClick}
        onPointsClick={onPointsClick}
        dimmed={opponentDimmed}
      />
    </motion.div>
  );
}

TacticalRow.propTypes = {
  leftAsset: PropTypes.shape({
    symbol: PropTypes.string.isRequired,
    priceChange: PropTypes.number,
    baseATR: PropTypes.number,
    history: PropTypes.shape({
      maxMultiplier: PropTypes.number,
      minMultiplier: PropTypes.number,
    }),
    points: PropTypes.number,
    badges: PropTypes.arrayOf(PropTypes.string),
  }),
  rightAsset: PropTypes.shape({
    symbol: PropTypes.string.isRequired,
    priceChange: PropTypes.number,
    baseATR: PropTypes.number,
    history: PropTypes.shape({
      maxMultiplier: PropTypes.number,
      minMultiplier: PropTypes.number,
    }),
    points: PropTypes.number,
    badges: PropTypes.arrayOf(PropTypes.string),
  }),
  allocationLabel: PropTypes.string,
  isCryptoSlot: PropTypes.bool,
  onLeftThresholdCross: PropTypes.func,
  onRightThresholdCross: PropTypes.func,
  onSymbolClick: PropTypes.func,
  onPointsClick: PropTypes.func,
  swapTargetMode: PropTypes.bool,
  onLeftAssetSelect: PropTypes.func,
  opponentDimmed: PropTypes.bool,
  leftDisabled: PropTypes.bool,
};

TacticalRow.defaultProps = {
  leftAsset: null,
  rightAsset: null,
  allocationLabel: '10%',
  isCryptoSlot: false,
  onLeftThresholdCross: null,
  onRightThresholdCross: null,
  onSymbolClick: null,
  onPointsClick: null,
  swapTargetMode: false,
  onLeftAssetSelect: null,
  opponentDimmed: false,
  leftDisabled: false,
};

// Export sub-components for flexibility
export { AssetSide, AllocationBadge };
