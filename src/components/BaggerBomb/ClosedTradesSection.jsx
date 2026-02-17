// ClosedTradesSection - Collapsible section showing swapped-out assets with locked points
// Replaces BenchSection for V4 battles.

import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { HOLO_COLORS } from '../../constants/holoTheme';

/**
 * Format price for display
 */
const formatPrice = (price) => {
  if (!price && price !== 0) return '--';
  return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Format time for display
 */
const formatSwapTime = (isoString) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

/**
 * ClosedTradeRow - Single closed trade entry
 */
function ClosedTradeRow({ trade }) {
  const {
    symbol,
    tier,
    entryPrice,
    exitPrice,
    lockedPoints = 0,
    lockedGainPct = 0,
    swappedOutAt,
  } = trade;

  // Guard against NaN/null (destructuring default only catches undefined)
  const safeLockedPoints = Number.isFinite(lockedPoints) ? lockedPoints : 0;
  const safeLockedGainPct = Number.isFinite(lockedGainPct) ? lockedGainPct : 0;

  const isPositive = safeLockedPoints >= 0;
  const pointColor = isPositive ? HOLO_COLORS.green : HOLO_COLORS.red;

  // Tier label
  const tierLabels = { star: '⭐', core: '💎', support: '📊' };
  const tierIcon = tierLabels[tier] || '📊';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 16px',
        borderBottom: `1px solid ${HOLO_COLORS.borderSubtle}50`,
      }}
    >
      {/* Tier + Symbol */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '12px' }}>{tierIcon}</span>
          <span
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: HOLO_COLORS.textPrimary,
            }}
          >
            {symbol}
          </span>
          <span
            style={{
              fontSize: '10px',
              color: HOLO_COLORS.textMuted,
              padding: '1px 4px',
              backgroundColor: HOLO_COLORS.bgElevated,
              borderRadius: '3px',
            }}
          >
            CLOSED
          </span>
        </div>

        {/* Entry -> Exit price */}
        <div
          style={{
            fontSize: '11px',
            color: HOLO_COLORS.textMuted,
            marginTop: '2px',
          }}
        >
          {formatPrice(entryPrice)} → {formatPrice(exitPrice)}
          {swappedOutAt && (
            <span style={{ marginLeft: '6px', opacity: 0.7 }}>
              {formatSwapTime(swappedOutAt)}
            </span>
          )}
        </div>
      </div>

      {/* P&L */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div
          style={{
            fontSize: '14px',
            fontWeight: 700,
            color: pointColor,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {isPositive ? '+' : ''}{safeLockedPoints.toFixed(1)}
        </div>
        <div
          style={{
            fontSize: '10px',
            color: pointColor,
            opacity: 0.8,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {safeLockedGainPct >= 0 ? '+' : ''}{safeLockedGainPct.toFixed(2)}%
        </div>
      </div>
    </div>
  );
}

ClosedTradeRow.propTypes = {
  trade: PropTypes.shape({
    symbol: PropTypes.string.isRequired,
    name: PropTypes.string,
    tier: PropTypes.string,
    slotIndex: PropTypes.number,
    entryPrice: PropTypes.number,
    exitPrice: PropTypes.number,
    lockedPoints: PropTypes.number,
    lockedGainPct: PropTypes.number,
    swappedOutAt: PropTypes.string,
  }).isRequired,
};

/**
 * ClosedTradesSection - Collapsible section
 */
export default function ClosedTradesSection({
  closedTrades = [],
  defaultExpanded = false,
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Total locked points
  const totalLocked = closedTrades.reduce(
    (sum, t) => sum + (t.lockedPoints || 0),
    0
  );

  return (
    <div
      style={{
        marginTop: '8px',
        backgroundColor: HOLO_COLORS.bgCard,
        borderTop: `1px solid ${HOLO_COLORS.borderSubtle}`,
      }}
    >
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          width: '100%',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: HOLO_COLORS.bgElevated,
          border: 'none',
          borderBottom: isExpanded
            ? `1px solid ${HOLO_COLORS.borderSubtle}`
            : 'none',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px' }}>{'📋'}</span>
          <span
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: HOLO_COLORS.textMuted,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Closed Trades
          </span>
          <span
            style={{
              fontSize: '11px',
              color: HOLO_COLORS.textMuted,
              padding: '2px 6px',
              backgroundColor: HOLO_COLORS.bgCard,
              borderRadius: '4px',
            }}
          >
            {closedTrades.length}
          </span>
          {closedTrades.length > 0 && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color:
                  totalLocked >= 0 ? HOLO_COLORS.green : HOLO_COLORS.red,
              }}
            >
              {totalLocked >= 0 ? '+' : ''}
              {totalLocked.toFixed(1)} pts
            </span>
          )}
        </div>

        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown size={20} color={HOLO_COLORS.textMuted} />
        </motion.div>
      </button>

      {/* Collapsible Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            {closedTrades.length === 0 ? (
              <div
                style={{
                  padding: '24px 16px',
                  textAlign: 'center',
                  color: HOLO_COLORS.textMuted,
                  fontSize: '12px',
                }}
              >
                No closed trades yet
              </div>
            ) : (
              closedTrades.map((trade, index) => (
                <ClosedTradeRow
                  key={`${trade.symbol}-${trade.swappedOutAt || index}`}
                  trade={trade}
                />
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

ClosedTradesSection.propTypes = {
  /** Array of closed trade records */
  closedTrades: PropTypes.arrayOf(
    PropTypes.shape({
      symbol: PropTypes.string.isRequired,
      name: PropTypes.string,
      tier: PropTypes.string,
      slotIndex: PropTypes.number,
      entryPrice: PropTypes.number,
      exitPrice: PropTypes.number,
      lockedPoints: PropTypes.number,
      lockedGainPct: PropTypes.number,
      swappedOutAt: PropTypes.string,
    })
  ),
  /** Whether section is expanded by default */
  defaultExpanded: PropTypes.bool,
};

ClosedTradesSection.defaultProps = {
  closedTrades: [],
  defaultExpanded: false,
};
