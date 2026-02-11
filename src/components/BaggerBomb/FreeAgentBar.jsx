// FreeAgentBar - Horizontal row of 4 rotating free agent tickers
// V4 multi-step swap mode: Swap pill → select agent → select roster target → confirm
// Cards: gradient backgrounds, crypto purple tint, research modal integration.

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
 * Normal mode: tap → research modal
 * Swap selectAgent step: tap → select this agent (green glow)
 */
function FreeAgentCard({ agent, priceChange, onTap, selectable, selected, onSelect }) {
  const isPositive = priceChange > 0;
  const isNegative = priceChange < 0;
  const changeColor = isPositive
    ? HOLO_COLORS.green
    : isNegative
      ? HOLO_COLORS.red
      : HOLO_COLORS.textMuted;

  const isCrypto = agent.isCrypto;

  // Border color depends on state
  let borderColor = isCrypto
    ? 'rgba(139, 92, 246, 0.4)'
    : HOLO_COLORS.borderSubtle;
  let boxShadow = 'none';

  if (selected) {
    borderColor = '#22c55e';
    boxShadow = '0 0 8px rgba(34, 197, 94, 0.4)';
  } else if (selectable) {
    borderColor = 'rgba(0, 217, 255, 0.5)';
  }

  const handleClick = () => {
    if (selectable) {
      onSelect && onSelect(agent);
    } else {
      onTap && onTap(agent);
    }
  };

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={handleClick}
      style={{
        flex: '1 1 0',
        minWidth: 0,
        padding: '10px 6px 8px',
        borderRadius: '8px',
        background: isCrypto
          ? `linear-gradient(135deg, rgba(139, 92, 246, 0.12), ${HOLO_COLORS.bgElevated})`
          : `linear-gradient(135deg, ${HOLO_COLORS.bgCard}, ${HOLO_COLORS.bgElevated})`,
        border: `1px solid ${borderColor}`,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '3px',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        position: 'relative',
        overflow: 'hidden',
        boxShadow,
      }}
    >
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
  selectable: PropTypes.bool,
  selected: PropTypes.bool,
  onSelect: PropTypes.func,
};

/**
 * FreeAgentBar - Main component with swap mode support
 */
export default function FreeAgentBar({
  freeAgents = [],
  nextRotationAt,
  currentPrices = {},
  startingPrices = {},
  swapsRemaining = 0,
  currentDay = 1,
  totalDays = 3,
  rotationCountdown = 0,
  // Swap mode props
  swapMode = null,
  onEnterSwapMode,
  onSelectFreeAgent,
  onCancelSwapMode,
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
  const isSwapActive = swapMode?.active;
  const isSelectingAgent = swapMode?.step === 'selectAgent';
  const isSelectingTarget = swapMode?.step === 'selectTarget';

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
      {/* Header Row: Day label + Swap pill button */}
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

        {/* Swap pill button or Cancel */}
        {isSwapActive ? (
          <button
            onClick={onCancelSwapMode}
            style={{
              padding: '4px 12px',
              borderRadius: '12px',
              border: `1px solid ${HOLO_COLORS.red}60`,
              background: `${HOLO_COLORS.red}15`,
              color: HOLO_COLORS.red,
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        ) : canSwap ? (
          <button
            onClick={onEnterSwapMode}
            style={{
              padding: '4px 12px',
              borderRadius: '12px',
              border: `1px solid ${HOLO_COLORS.cyan}50`,
              background: `${HOLO_COLORS.cyan}15`,
              color: HOLO_COLORS.cyan,
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span style={{ fontSize: '12px' }}>&#x1F504;</span>
            Swap ({swapsRemaining} left)
          </button>
        ) : (
          <span
            style={{
              fontSize: '10px',
              fontWeight: 600,
              color: HOLO_COLORS.textMuted,
            }}
          >
            No swaps today
          </span>
        )}
      </div>

      {/* Swap Mode Banner */}
      {isSelectingAgent && (
        <div
          style={{
            padding: '6px 8px',
            marginBottom: '6px',
            background: `${HOLO_COLORS.cyan}10`,
            borderRadius: '6px',
            textAlign: 'center',
            fontSize: '11px',
            fontWeight: 600,
            color: HOLO_COLORS.cyan,
          }}
        >
          Select a free agent to add
        </div>
      )}
      {isSelectingTarget && (
        <div
          style={{
            padding: '6px 8px',
            marginBottom: '6px',
            background: 'rgba(34, 197, 94, 0.1)',
            borderRadius: '6px',
            textAlign: 'center',
            fontSize: '11px',
            fontWeight: 600,
            color: '#22c55e',
          }}
        >
          Now tap the stock you want to swap out
        </div>
      )}

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
              selectable={isSelectingAgent}
              selected={swapMode?.selectedFreeAgent?.symbol === agent.symbol}
              onSelect={onSelectFreeAgent}
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
  freeAgents: PropTypes.arrayOf(
    PropTypes.shape({
      symbol: PropTypes.string.isRequired,
      name: PropTypes.string,
      isCrypto: PropTypes.bool,
      appearedAt: PropTypes.string,
    })
  ),
  nextRotationAt: PropTypes.string,
  currentPrices: PropTypes.object,
  startingPrices: PropTypes.object,
  swapsRemaining: PropTypes.number,
  currentDay: PropTypes.number,
  totalDays: PropTypes.number,
  rotationCountdown: PropTypes.number,
  swapMode: PropTypes.shape({
    active: PropTypes.bool,
    selectedFreeAgent: PropTypes.object,
    step: PropTypes.string,
    targetAsset: PropTypes.object,
  }),
  onEnterSwapMode: PropTypes.func,
  onSelectFreeAgent: PropTypes.func,
  onCancelSwapMode: PropTypes.func,
};
