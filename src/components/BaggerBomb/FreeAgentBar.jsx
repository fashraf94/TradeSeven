// FreeAgentBar - Horizontal row of 4 rotating free agent tickers
// Replaces SessionHUD for V4 battles. Shows free agents, countdown, swaps remaining.
// Cards: gradient backgrounds, crypto purple tint, swap icon, research modal integration.

import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { motion } from 'framer-motion';
import { HOLO_COLORS } from '../../constants/holoTheme';
import AssetResearchModal from '../draft/AssetResearchModal';

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
 * Card tap → opens research modal. Swap icon tap → opens swap modal.
 */
function FreeAgentCard({ agent, priceChange, onTap, onSwap, canSwap }) {
  const isPositive = priceChange > 0;
  const isNegative = priceChange < 0;
  const changeColor = isPositive
    ? HOLO_COLORS.green
    : isNegative
      ? HOLO_COLORS.red
      : HOLO_COLORS.textMuted;

  const isCrypto = agent.isCrypto;

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={() => onTap && onTap(agent)}
      style={{
        flex: '1 1 0',
        minWidth: 0,
        padding: '10px 6px 8px',
        borderRadius: '8px',
        background: isCrypto
          ? `linear-gradient(135deg, rgba(139, 92, 246, 0.12), ${HOLO_COLORS.bgElevated})`
          : `linear-gradient(135deg, ${HOLO_COLORS.bgCard}, ${HOLO_COLORS.bgElevated})`,
        border: isCrypto
          ? '1px solid rgba(139, 92, 246, 0.4)'
          : `1px solid ${HOLO_COLORS.borderSubtle}`,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '3px',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Swap icon button (top-right) */}
      {canSwap && (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onSwap && onSwap(agent);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.stopPropagation();
              onSwap && onSwap(agent);
            }
          }}
          style={{
            position: 'absolute',
            top: '3px',
            right: '3px',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            background: 'rgba(0, 217, 255, 0.15)',
            border: '1px solid rgba(0, 217, 255, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '10px',
            color: HOLO_COLORS.cyan,
            cursor: 'pointer',
            zIndex: 2,
            lineHeight: 1,
          }}
        >
          ↔
        </span>
      )}

      {/* Symbol */}
      <span
        style={{
          fontSize: '13px',
          fontWeight: 700,
          color: HOLO_COLORS.textPrimary,
          lineHeight: 1,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: '100%',
        }}
      >
        {agent.symbol}
      </span>

      {/* Company name */}
      {agent.name && (
        <span
          style={{
            fontSize: '9px',
            color: HOLO_COLORS.textMuted,
            lineHeight: 1,
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {agent.name}
        </span>
      )}

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
  onSwap: PropTypes.func,
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
  const [researchAsset, setResearchAsset] = useState(null);

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

  const handleCardTap = (agent) => {
    const idx = freeAgents.findIndex(a => a.symbol === agent.symbol);
    setResearchAsset({
      symbol: agent.symbol,
      name: agent.name || agent.symbol,
      price: currentPrices[agent.symbol] || 0,
      percentChange: idx >= 0 ? agentChanges[idx] || 0 : 0,
      isCrypto: agent.isCrypto,
    });
  };

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
          overflow: 'hidden',
        }}
      >
        {freeAgents.length > 0 ? (
          freeAgents.map((agent, index) => (
            <FreeAgentCard
              key={agent.symbol}
              agent={agent}
              priceChange={agentChanges[index]}
              onTap={handleCardTap}
              onSwap={onSwapRequest}
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

      {/* Research Modal */}
      {researchAsset && (
        <AssetResearchModal
          asset={researchAsset}
          onClose={() => setResearchAsset(null)}
          showActionButton={false}
          version={2}
        />
      )}
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
