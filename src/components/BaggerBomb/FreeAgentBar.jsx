// FreeAgentBar - Horizontal row of 4 rotating free agent tickers
// Replaces SessionHUD for V4 battles. Shows free agents, countdown, swaps remaining.

import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { motion } from 'framer-motion';
import { HOLO_COLORS } from '../../constants/holoTheme';

/**
 * Format seconds to MM:SS
 */
const formatCountdown = (seconds) => {
  if (!seconds || seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

/**
 * Format price change percentage
 */
const formatPriceChange = (pct) => {
  if (pct === null || pct === undefined || isNaN(pct)) return '--';
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
};

/**
 * FreeAgentCard - Single free agent ticker card
 */
function FreeAgentCard({ agent, priceChange, onTap, canSwap }) {
  const isPositive = priceChange > 0;
  const isNegative = priceChange < 0;
  const changeColor = isPositive
    ? HOLO_COLORS.green
    : isNegative
      ? HOLO_COLORS.red
      : HOLO_COLORS.textMuted;

  return (
    <motion.button
      whileTap={canSwap ? { scale: 0.95 } : {}}
      onClick={() => canSwap && onTap && onTap(agent)}
      disabled={!canSwap}
      style={{
        flex: 1,
        minWidth: '72px',
        padding: '8px 6px',
        borderRadius: '8px',
        backgroundColor: HOLO_COLORS.bgElevated,
        border: `1px solid ${HOLO_COLORS.borderSubtle}`,
        cursor: canSwap ? 'pointer' : 'default',
        opacity: canSwap ? 1 : 0.7,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
        transition: 'border-color 0.2s',
      }}
    >
      {/* Crypto indicator */}
      {agent.isCrypto && (
        <span style={{ fontSize: '10px', lineHeight: 1 }}>
          {'🔮'}
        </span>
      )}

      {/* Symbol */}
      <span
        style={{
          fontSize: '13px',
          fontWeight: 700,
          color: HOLO_COLORS.textPrimary,
          lineHeight: 1,
        }}
      >
        {agent.symbol}
      </span>

      {/* Price Change */}
      <span
        style={{
          fontSize: '11px',
          fontWeight: 600,
          color: changeColor,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
        }}
      >
        {formatPriceChange(priceChange)}
      </span>
    </motion.button>
  );
}

FreeAgentCard.propTypes = {
  agent: PropTypes.shape({
    symbol: PropTypes.string.isRequired,
    name: PropTypes.string,
    isCrypto: PropTypes.bool,
  }).isRequired,
  priceChange: PropTypes.number,
  onTap: PropTypes.func,
  canSwap: PropTypes.bool,
};

/**
 * FreeAgentBar - Main component
 */
export default function FreeAgentBar({
  freeAgents = [],
  nextRotationAt,
  currentPrices = {},
  startingPrices = {},
  swapsRemaining = 0,
  onSwapRequest,
  currentDay = 1,
  totalDays = 3,
  rotationCountdown = 0,
}) {
  // Calculate price changes for each free agent
  const agentChanges = useMemo(() => {
    return freeAgents.map((agent) => {
      const current = currentPrices[agent.symbol];
      const start = startingPrices[agent.symbol];
      if (current && start && start > 0) {
        return ((current - start) / start) * 100;
      }
      return null;
    });
  }, [freeAgents, currentPrices, startingPrices]);

  const canSwap = swapsRemaining > 0;

  return (
    <div
      style={{
        padding: '8px 4px',
        backgroundColor: HOLO_COLORS.bgCard,
        borderRadius: '8px',
        border: `1px solid ${HOLO_COLORS.borderSubtle}`,
      }}
    >
      {/* Day + Swaps header row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 8px 6px',
        }}
      >
        <span
          style={{
            fontSize: '10px',
            fontWeight: 600,
            color: HOLO_COLORS.textMuted,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          Day {currentDay}/{totalDays}
        </span>

        <span
          style={{
            fontSize: '10px',
            fontWeight: 600,
            color: canSwap ? HOLO_COLORS.cyan : HOLO_COLORS.textMuted,
          }}
        >
          {swapsRemaining} swap{swapsRemaining !== 1 ? 's' : ''} left
        </span>
      </div>

      {/* Free Agent Cards */}
      <div
        style={{
          display: 'flex',
          gap: '6px',
          padding: '0 4px',
        }}
      >
        {freeAgents.length > 0 ? (
          freeAgents.map((agent, index) => (
            <FreeAgentCard
              key={agent.symbol}
              agent={agent}
              priceChange={agentChanges[index]}
              onTap={onSwapRequest}
              canSwap={canSwap}
            />
          ))
        ) : (
          <div
            style={{
              flex: 1,
              padding: '16px',
              textAlign: 'center',
              color: HOLO_COLORS.textMuted,
              fontSize: '12px',
            }}
          >
            Loading free agents...
          </div>
        )}
      </div>

      {/* Rotation Countdown */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '6px',
          paddingTop: '6px',
        }}
      >
        <span
          style={{
            fontSize: '10px',
            color: HOLO_COLORS.textMuted,
          }}
        >
          New agents in
        </span>
        <motion.span
          animate={rotationCountdown <= 60 ? { opacity: [1, 0.5, 1] } : {}}
          transition={rotationCountdown <= 60 ? { duration: 1.5, repeat: Infinity } : {}}
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: rotationCountdown <= 60 ? HOLO_COLORS.amber : HOLO_COLORS.cyan,
            fontFamily: 'monospace',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {formatCountdown(rotationCountdown)}
        </motion.span>
      </div>
    </div>
  );
}

FreeAgentBar.propTypes = {
  /** Array of 4 free agent objects */
  freeAgents: PropTypes.arrayOf(
    PropTypes.shape({
      symbol: PropTypes.string.isRequired,
      name: PropTypes.string,
      isCrypto: PropTypes.bool,
      appearedAt: PropTypes.string,
    })
  ),
  /** ISO timestamp of next rotation */
  nextRotationAt: PropTypes.string,
  /** Current market prices { symbol: price } */
  currentPrices: PropTypes.object,
  /** Starting/open prices for change calculation */
  startingPrices: PropTypes.object,
  /** Swaps remaining for today */
  swapsRemaining: PropTypes.number,
  /** Callback when user taps a free agent to initiate swap */
  onSwapRequest: PropTypes.func,
  /** Current trading day (1, 2, or 3) */
  currentDay: PropTypes.number,
  /** Total trading days in battle */
  totalDays: PropTypes.number,
  /** Seconds until next rotation */
  rotationCountdown: PropTypes.number,
};

FreeAgentBar.defaultProps = {
  freeAgents: [],
  nextRotationAt: null,
  currentPrices: {},
  startingPrices: {},
  swapsRemaining: 0,
  onSwapRequest: null,
  currentDay: 1,
  totalDays: 3,
  rotationCountdown: 0,
};
