// TacticalRow - Sleeper-style side-by-side asset comparison row
// Displays player and opponent assets with ChamberFuse, badges, and proximity

import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import { HOLO_COLORS } from '../../constants/holoTheme';
import { PCT_SLIDE, THRESHOLD_HEAT } from '../../constants/animationTokens';
import ChamberFuse from './ChamberFuse';
import BadgeRow from './BadgeRow';
import ProximityLabel from './ProximityLabel';
import DataStrike from '../shared/DataStrike';

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

  // V5: Cash position — dormant slot rendering
  if (asset.isCash) {
    return (
      <div
        onClick={() => {
          if (highlighted && onAssetSelect) onAssetSelect(asset);
        }}
        style={{
          flex: 1,
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          textAlign: isRight ? 'right' : 'left',
          opacity: 0.5,
          borderStyle: 'dashed',
          borderColor: HOLO_COLORS.borderSubtle,
          borderWidth: '1px',
          borderRadius: '8px',
          ...(highlighted ? {
            opacity: 0.8,
            borderColor: 'rgba(0, 217, 255, 0.4)',
            background: 'rgba(0, 217, 255, 0.05)',
            cursor: 'pointer',
          } : {}),
        }}
      >
        <div style={{ fontSize: '20px', textAlign: 'center' }}>💵</div>
        <div style={{
          fontSize: '13px',
          fontWeight: 700,
          color: HOLO_COLORS.textMuted,
          textAlign: 'center',
        }}>
          CASH
        </div>
        <div style={{
          fontSize: '11px',
          color: HOLO_COLORS.textMuted,
          textAlign: 'center',
        }}>
          0 pts
        </div>
        {asset.previousAsset && (
          <div style={{
            fontSize: '9px',
            color: HOLO_COLORS.textMuted,
            textAlign: 'center',
            fontStyle: 'italic',
          }}>
            Was: {asset.previousAsset}
          </div>
        )}
      </div>
    );
  }

  const {
    symbol,
    priceChange = 0,
    thresholdPriceChange,
    baseATR = 2.5,
    history = { maxMultiplier: 0, minMultiplier: 0 },
    points = 0,
    badges = [],
  } = asset;

  // Threshold heat: compute proximity ratio for radiance + text warming
  const thresholdHeat = useMemo(() => {
    const multiplier = baseATR > 0 ? priceChange / baseATR : 0;
    // Neutral zone: no heat when near zero
    if (Math.abs(multiplier) < THRESHOLD_HEAT.neutralZone) {
      return { proximityRatio: 1, direction: 'neutral' };
    }

    const positiveThresholds = [1.0, 1.5, 2.0];
    const negativeThresholds = [-1.0, -1.5, -2.0];
    const maxReached = history?.maxMultiplier || 0;
    const minReached = history?.minMultiplier || 0;

    if (multiplier > 0) {
      // Find nearest uncrossed positive threshold
      const target = positiveThresholds.find(t => maxReached < t);
      if (!target) return { proximityRatio: 1, direction: 'positive' }; // all crossed
      const distanceRemaining = target - multiplier;
      if (distanceRemaining <= 0) return { proximityRatio: 0, direction: 'positive' };
      const proximityRatio = distanceRemaining / target;
      return { proximityRatio, direction: 'positive' };
    } else {
      // Find nearest uncrossed negative threshold (more negative)
      const target = negativeThresholds.find(t => minReached > t);
      if (!target) return { proximityRatio: 1, direction: 'negative' }; // all crossed
      const distanceRemaining = multiplier - target; // both negative, result is positive
      if (distanceRemaining <= 0) return { proximityRatio: 0, direction: 'negative' };
      const proximityRatio = distanceRemaining / Math.abs(target);
      return { proximityRatio, direction: 'negative' };
    }
  }, [priceChange, baseATR, history]);

  // Compute radiance opacity from proximity ratio
  const radianceOpacity = useMemo(() => {
    const { proximityRatio } = thresholdHeat;
    if (proximityRatio > THRESHOLD_HEAT.triggerProximity) return 0;
    if (proximityRatio < THRESHOLD_HEAT.breathingProximity) return 1.0;
    // Linear interpolation: 0.25→0.10 maps to 0→0.8
    const range = THRESHOLD_HEAT.triggerProximity - THRESHOLD_HEAT.breathingProximity;
    return ((THRESHOLD_HEAT.triggerProximity - proximityRatio) / range) * 0.8;
  }, [thresholdHeat]);

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
            {/* V5: Direction badge for crypto */}
            {asset.isCrypto && asset.direction && (
              <span style={{
                fontSize: '9px',
                fontWeight: 700,
                color: asset.direction === 'short' ? HOLO_COLORS.red : HOLO_COLORS.green,
                backgroundColor: asset.direction === 'short'
                  ? `${HOLO_COLORS.red}15`
                  : `${HOLO_COLORS.green}15`,
                padding: '1px 5px',
                borderRadius: '4px',
                marginLeft: '4px',
                verticalAlign: 'middle',
                letterSpacing: '0.5px',
              }}>
                {asset.direction === 'short' ? 'SHORT ↓' : 'LONG ↑'}
              </span>
            )}
          </div>
          <div style={{ position: 'relative', height: '20px', overflow: 'hidden' }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={`${priceChange.toFixed(2)}`}
                initial={{ opacity: 0, y: PCT_SLIDE.enterY }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: PCT_SLIDE.exitY }}
                transition={{ duration: PCT_SLIDE.duration }}
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: priceColor,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {isPositive ? '▲' : '▼'} {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
              </motion.div>
            </AnimatePresence>
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
            <DataStrike
              value={Math.round(points)}
              showSign
              size={20}
              color={HOLO_COLORS.textPrimary}
            />
          </div>
          <BadgeRow
            badges={badges}
            size="small"
            maxDisplay={3}
            align={isRight ? 'left' : 'right'}
          />
        </div>
      </div>

      {/* ChamberFuse + Leading-Edge Radiance */}
      <div style={{ position: 'relative' }}>
        <ChamberFuse
          priceChange={thresholdPriceChange ?? priceChange}
          baseATR={baseATR}
          history={history}
          compact
          showLabels={false}
          onThresholdCross={onThresholdCross}
        />
        {/* Leading-edge radiance — glows when approaching threshold */}
        {radianceOpacity > 0 && (
          <motion.div
            animate={{ opacity: radianceOpacity }}
            transition={{ duration: 0.5 }}
            style={{
              position: 'absolute',
              top: 0,
              [thresholdHeat.direction === 'negative' ? 'left' : 'right']: 0,
              width: `${THRESHOLD_HEAT.radianceWidth}px`,
              height: '100%',
              background: thresholdHeat.direction === 'negative'
                ? THRESHOLD_HEAT.radialGradientBust
                : THRESHOLD_HEAT.radialGradientBagger,
              pointerEvents: 'none',
              zIndex: 1,
            }}
          />
        )}
      </div>

      {/* Proximity Label — uses daily-relative threshold progress */}
      <ProximityLabel
        priceChange={thresholdPriceChange ?? priceChange}
        baseATR={baseATR}
        history={history}
        dailyLevels={asset.dailyLevels}
        currentPrice={asset.currentPrice}
        size="small"
        align={isRight ? 'right' : 'left'}
        proximityRatio={thresholdHeat.proximityRatio}
        heatDirection={thresholdHeat.direction}
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

// Tier-specific badge colors
const TIER_BADGE_STYLES = {
  star:    { color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.12)', label: '2×' },
  core:    { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)', label: '1.5×' },
  support: { color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', label: '1×' },
};

/**
 * AllocationBadge - Center allocation indicator with tier-specific colors
 */
function AllocationBadge({ tier = 'support', isCrypto = false }) {
  const tierStyle = TIER_BADGE_STYLES[tier] || TIER_BADGE_STYLES.support;

  return (
    <div
      style={{
        width: '44px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          padding: '4px 8px',
          borderRadius: '8px',
          backgroundColor: tierStyle.bg,
          border: `1px solid ${tierStyle.color}40`,
          fontSize: '13px',
          fontWeight: 700,
          color: tierStyle.color,
          whiteSpace: 'nowrap',
        }}
      >
        {tierStyle.label}
      </div>
      {isCrypto && (
        <span style={{ fontSize: '10px', marginTop: '2px' }}>🔮</span>
      )}
    </div>
  );
}

AllocationBadge.propTypes = {
  tier: PropTypes.oneOf(['star', 'core', 'support']),
  isCrypto: PropTypes.bool,
};

/**
 * TacticalRow - Sleeper-style side-by-side asset comparison
 */
export default function TacticalRow({
  leftAsset,
  rightAsset,
  tier,
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
        backgroundColor: 'rgba(22, 27, 34, 0.25)',
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
        tier={tier}
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
  tier: PropTypes.oneOf(['star', 'core', 'support']),
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
  tier: 'support',
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
