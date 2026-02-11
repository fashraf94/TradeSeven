// SwapModal - Modal for executing a free agent swap
// Triggered when player taps a free agent in FreeAgentBar.
// Shows incoming asset, lists roster positions, confirms swap.

import React, { useState, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight } from 'lucide-react';
import { HOLO_COLORS } from '../../constants/holoTheme';
import { CONVICTION_MULTIPLIERS } from '../../constants/baggerBombScoring';

// Tier display config
const TIER_CONFIG = {
  star: { label: 'Star Picks', icon: '⭐', multiplier: CONVICTION_MULTIPLIERS?.star || 2.0 },
  core: { label: 'Core Holds', icon: '💎', multiplier: CONVICTION_MULTIPLIERS?.core || 1.5 },
  support: { label: 'Support Plays', icon: '📊', multiplier: CONVICTION_MULTIPLIERS?.support || 1.0 },
};

/**
 * Format price change percentage
 */
const formatPct = (pct) => {
  if (pct === null || pct === undefined || isNaN(pct)) return '--';
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
};

/**
 * RosterSlotRow - A single roster asset that can be swapped out
 */
function RosterSlotRow({ asset, tier, slotIndex, isSelected, onSelect, isCryptoSlot, incomingIsCrypto }) {
  // Type restriction: stocks only replace stocks, crypto only replaces crypto
  const isTypeMatch = isCryptoSlot === incomingIsCrypto;
  const isDisabled = !isTypeMatch;

  const tierConfig = TIER_CONFIG[tier] || TIER_CONFIG.support;
  const changeColor = (asset.priceChange || 0) >= 0 ? HOLO_COLORS.green : HOLO_COLORS.red;

  return (
    <motion.button
      whileTap={!isDisabled ? { scale: 0.98 } : {}}
      onClick={() => !isDisabled && onSelect(tier, slotIndex)}
      disabled={isDisabled}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '12px 16px',
        backgroundColor: isSelected
          ? `${HOLO_COLORS.cyan}15`
          : 'transparent',
        border: 'none',
        borderBottom: `1px solid ${HOLO_COLORS.borderSubtle}50`,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.35 : 1,
        textAlign: 'left',
        transition: 'background-color 0.15s',
      }}
    >
      {/* Selection radio */}
      <div
        style={{
          width: '18px',
          height: '18px',
          borderRadius: '50%',
          border: `2px solid ${isSelected ? HOLO_COLORS.cyan : HOLO_COLORS.borderSubtle}`,
          backgroundColor: isSelected ? HOLO_COLORS.cyan : 'transparent',
          flexShrink: 0,
          transition: 'all 0.15s',
        }}
      />

      {/* Tier icon */}
      <span style={{ fontSize: '14px', flexShrink: 0 }}>{tierConfig.icon}</span>

      {/* Asset info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: HOLO_COLORS.textPrimary,
            }}
          >
            {asset.symbol}
          </span>
          {isCryptoSlot && <span style={{ fontSize: '11px' }}>{'🔮'}</span>}
          {isDisabled && (
            <span
              style={{
                fontSize: '9px',
                color: HOLO_COLORS.textMuted,
                padding: '1px 4px',
                backgroundColor: HOLO_COLORS.bgElevated,
                borderRadius: '3px',
              }}
            >
              {isCryptoSlot ? 'Crypto slot' : 'Stock slot'}
            </span>
          )}
        </div>
        <span
          style={{
            fontSize: '11px',
            color: HOLO_COLORS.textMuted,
          }}
        >
          {tierConfig.multiplier}x multiplier
        </span>
      </div>

      {/* Current performance */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: changeColor,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {formatPct(asset.priceChange)}
        </div>
        {asset.points !== undefined && (
          <div
            style={{
              fontSize: '10px',
              color: HOLO_COLORS.textMuted,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {asset.points >= 0 ? '+' : ''}{asset.points?.toFixed(1)} pts
          </div>
        )}
      </div>
    </motion.button>
  );
}

RosterSlotRow.propTypes = {
  asset: PropTypes.shape({
    symbol: PropTypes.string.isRequired,
    priceChange: PropTypes.number,
    points: PropTypes.number,
  }).isRequired,
  tier: PropTypes.string.isRequired,
  slotIndex: PropTypes.number.isRequired,
  isSelected: PropTypes.bool,
  onSelect: PropTypes.func.isRequired,
  isCryptoSlot: PropTypes.bool,
  incomingIsCrypto: PropTypes.bool,
};

/**
 * SwapModal - Main component
 */
export default function SwapModal({
  isOpen,
  onClose,
  incomingSymbol,
  incomingName,
  incomingIsCrypto = false,
  portfolio = {},
  currentPrices = {},
  startingPrices = {},
  swapsRemaining = 0,
  onConfirmSwap,
  isExecuting = false,
}) {
  const [selectedSlot, setSelectedSlot] = useState(null); // { tier, slotIndex }

  // Build flat list of roster assets with their current performance
  const rosterAssets = useMemo(() => {
    const assets = [];
    const tiers = ['star', 'core', 'support'];

    tiers.forEach((tier) => {
      const slots = portfolio[tier] || [];
      slots.forEach((asset, index) => {
        if (!asset) return;
        const current = currentPrices[asset.symbol];
        const start = startingPrices[asset.symbol] || asset.swapPrice;
        const priceChange =
          current && start && start > 0
            ? ((current - start) / start) * 100
            : 0;

        // Determine if this is a crypto slot (support slot index 2)
        const isCryptoSlot = tier === 'support' && index === 2;

        assets.push({
          ...asset,
          tier,
          slotIndex: index,
          priceChange,
          isCryptoSlot,
        });
      });
    });

    return assets;
  }, [portfolio, currentPrices, startingPrices]);

  // Handle slot selection
  const handleSelect = useCallback((tier, slotIndex) => {
    setSelectedSlot((prev) => {
      if (prev && prev.tier === tier && prev.slotIndex === slotIndex) {
        return null; // Deselect
      }
      return { tier, slotIndex };
    });
  }, []);

  // Handle confirm
  const handleConfirm = useCallback(() => {
    if (!selectedSlot || !onConfirmSwap) return;
    onConfirmSwap({
      outTier: selectedSlot.tier,
      outSlotIndex: selectedSlot.slotIndex,
      inSymbol: incomingSymbol,
    });
  }, [selectedSlot, onConfirmSwap, incomingSymbol]);

  // Get selected asset for confirmation display
  const selectedAsset = useMemo(() => {
    if (!selectedSlot) return null;
    return rosterAssets.find(
      (a) => a.tier === selectedSlot.tier && a.slotIndex === selectedSlot.slotIndex
    );
  }, [selectedSlot, rosterAssets]);

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e) => {
      if (e.target === e.currentTarget) {
        setSelectedSlot(null);
        onClose();
      }
    },
    [onClose]
  );

  // Handle close
  const handleClose = useCallback(() => {
    setSelectedSlot(null);
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleBackdropClick}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{
              width: '100%',
              maxWidth: '420px',
              maxHeight: '80vh',
              backgroundColor: HOLO_COLORS.bgCard,
              borderRadius: '16px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px',
                borderBottom: `1px solid ${HOLO_COLORS.borderSubtle}`,
              }}
            >
              <h2
                style={{
                  fontSize: '16px',
                  fontWeight: 700,
                  color: HOLO_COLORS.textPrimary,
                  margin: 0,
                }}
              >
                Swap In: {incomingSymbol}
              </h2>
              <button
                onClick={handleClose}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: HOLO_COLORS.bgElevated,
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={18} color={HOLO_COLORS.textMuted} />
              </button>
            </div>

            {/* Incoming Asset Info */}
            <div
              style={{
                padding: '12px 16px',
                backgroundColor: `${HOLO_COLORS.cyan}08`,
                borderBottom: `1px solid ${HOLO_COLORS.borderSubtle}`,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span
                  style={{
                    fontSize: '16px',
                    fontWeight: 700,
                    color: HOLO_COLORS.cyan,
                  }}
                >
                  {incomingSymbol}
                </span>
                {incomingIsCrypto && <span style={{ fontSize: '12px' }}>{'🔮'}</span>}
                {incomingName && (
                  <span
                    style={{
                      fontSize: '12px',
                      color: HOLO_COLORS.textMuted,
                    }}
                  >
                    {incomingName}
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: HOLO_COLORS.textMuted,
                  marginTop: '4px',
                }}
              >
                {incomingIsCrypto
                  ? 'Can replace crypto slot (Support #3) only'
                  : 'Can replace any stock slot'}
              </div>
            </div>

            {/* Section label */}
            <div
              style={{
                padding: '10px 16px 6px',
                fontSize: '11px',
                fontWeight: 600,
                color: HOLO_COLORS.textMuted,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Select asset to swap out
            </div>

            {/* Roster List */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                minHeight: 0,
              }}
            >
              {rosterAssets.map((asset) => (
                <RosterSlotRow
                  key={`${asset.tier}-${asset.slotIndex}`}
                  asset={asset}
                  tier={asset.tier}
                  slotIndex={asset.slotIndex}
                  isSelected={
                    selectedSlot?.tier === asset.tier &&
                    selectedSlot?.slotIndex === asset.slotIndex
                  }
                  onSelect={handleSelect}
                  isCryptoSlot={asset.isCryptoSlot}
                  incomingIsCrypto={incomingIsCrypto}
                />
              ))}
            </div>

            {/* Confirmation Footer */}
            <div
              style={{
                padding: '12px 16px',
                borderTop: `1px solid ${HOLO_COLORS.borderSubtle}`,
                backgroundColor: HOLO_COLORS.bgElevated,
              }}
            >
              {/* Confirmation text */}
              {selectedAsset && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    marginBottom: '10px',
                    fontSize: '12px',
                    color: HOLO_COLORS.textSecondary,
                  }}
                >
                  <span style={{ fontWeight: 600, color: HOLO_COLORS.red }}>
                    {selectedAsset.symbol}
                  </span>
                  <ArrowRight size={14} color={HOLO_COLORS.textMuted} />
                  <span style={{ fontWeight: 600, color: HOLO_COLORS.cyan }}>
                    {incomingSymbol}
                  </span>
                  <span style={{ color: HOLO_COLORS.textMuted }}>
                    ({TIER_CONFIG[selectedAsset.tier]?.multiplier || 1}x)
                  </span>
                </div>
              )}

              {/* Confirm button */}
              <motion.button
                whileHover={selectedSlot && !isExecuting ? { scale: 1.01 } : {}}
                whileTap={selectedSlot && !isExecuting ? { scale: 0.98 } : {}}
                onClick={handleConfirm}
                disabled={!selectedSlot || isExecuting}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: selectedSlot
                    ? HOLO_COLORS.cyan
                    : HOLO_COLORS.bgCard,
                  color: selectedSlot
                    ? HOLO_COLORS.bgDeep
                    : HOLO_COLORS.textMuted,
                  fontSize: '15px',
                  fontWeight: 700,
                  cursor:
                    selectedSlot && !isExecuting ? 'pointer' : 'not-allowed',
                  opacity: selectedSlot ? 1 : 0.5,
                  transition: 'all 0.2s',
                }}
              >
                {isExecuting
                  ? 'Swapping...'
                  : selectedSlot
                    ? `Confirm Swap (${swapsRemaining} left after)`
                    : 'Select an asset to swap out'}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

SwapModal.propTypes = {
  /** Whether modal is open */
  isOpen: PropTypes.bool.isRequired,
  /** Callback to close modal */
  onClose: PropTypes.func.isRequired,
  /** Symbol of incoming free agent */
  incomingSymbol: PropTypes.string,
  /** Name of incoming free agent */
  incomingName: PropTypes.string,
  /** Whether incoming asset is crypto */
  incomingIsCrypto: PropTypes.bool,
  /** Current portfolio { star: [...], core: [...], support: [...] } */
  portfolio: PropTypes.object,
  /** Current prices { symbol: price } */
  currentPrices: PropTypes.object,
  /** Starting/open prices { symbol: price } */
  startingPrices: PropTypes.object,
  /** Swaps remaining for today */
  swapsRemaining: PropTypes.number,
  /** Callback on confirm: ({ outTier, outSlotIndex, inSymbol }) => void */
  onConfirmSwap: PropTypes.func,
  /** Whether swap is currently executing */
  isExecuting: PropTypes.bool,
};

SwapModal.defaultProps = {
  incomingSymbol: '',
  incomingName: '',
  incomingIsCrypto: false,
  portfolio: {},
  currentPrices: {},
  startingPrices: {},
  swapsRemaining: 0,
  onConfirmSwap: null,
  isExecuting: false,
};
