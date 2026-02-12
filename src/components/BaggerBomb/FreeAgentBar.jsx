// FreeAgentBar - Horizontal row of 4 rotating free agent tickers
// V4 multi-step swap mode: Swap pill → select agent → select roster target → confirm
// Cards: gradient backgrounds, crypto purple tint, research modal integration.

import React, { useState, useMemo, useEffect } from 'react';
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
 * Format price change percentage — returns null when unavailable
 */
const formatPriceChange = (pct) => {
  if (pct === null || pct === undefined || isNaN(pct)) return null;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
};

/**
 * Format absolute price as fallback when percentage unavailable
 */
const formatPrice = (price) => {
  if (!price || isNaN(price)) return '--';
  if (price >= 1000) return `$${Math.round(price).toLocaleString()}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  return `$${price.toFixed(4)}`;
};

/**
 * FreeAgentCard - Single free agent ticker card
 * Normal mode: tap → research modal
 * Swap selectAgent step: tap → select this agent (green glow)
 */
function FreeAgentCard({ agent, priceChange, currentPrice, onTap, selectable, selected, onSelect }) {
  const pctText = formatPriceChange(priceChange);
  const isPositive = priceChange > 0;
  const isNegative = priceChange < 0;
  const changeColor = pctText
    ? (isPositive ? HOLO_COLORS.green : isNegative ? HOLO_COLORS.red : HOLO_COLORS.textMuted)
    : HOLO_COLORS.textSecondary;

  const isCrypto = agent.isCrypto;

  // Border color depends on state
  let borderColor = isCrypto
    ? `${HOLO_COLORS.purple}66`
    : HOLO_COLORS.borderSubtle;
  let boxShadow = 'none';

  if (selected) {
    borderColor = HOLO_COLORS.greenBright;
    boxShadow = `0 0 8px ${HOLO_COLORS.greenBright}66`;
  } else if (selectable) {
    borderColor = HOLO_COLORS.borderBright;
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
      whileHover={{ scale: 1.05, y: -2 }}
      whileTap={{ scale: 0.95 }}
      onClick={handleClick}
      style={{
        flex: '1 1 0',
        minWidth: 0,
        padding: '10px 6px 8px',
        borderRadius: '10px',
        background: `linear-gradient(145deg, ${HOLO_COLORS.bgElevated} 0%, ${HOLO_COLORS.bgCard} 50%, #1a1025 100%)`,
        border: `2px solid ${borderColor}`,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '3px',
        position: 'relative',
        overflow: 'hidden',
        animation: (!selected && !selectable) ? 'holoShimmer 4s ease-in-out infinite' : undefined,
        boxShadow: selected
          ? `0 0 8px ${HOLO_COLORS.greenBright}66`
          : `0 4px 16px rgba(0, 0, 0, 0.4), 0 0 12px rgba(0, 217, 255, 0.15)`,
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
    >
      {/* Shine sweep overlay */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: '-100%',
        width: '60%',
        height: '100%',
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)',
        transform: 'skewX(-20deg)',
        animation: 'shineSweep 5s ease-in-out infinite',
        pointerEvents: 'none',
      }} />

      {/* Symbol */}
      <span
        style={{
          fontSize: '13px',
          fontWeight: 700,
          background: 'linear-gradient(135deg, #00d9ff, #8b5cf6, #ffd700)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
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

      {/* Price Change or Current Price fallback */}
      <span
        style={{
          fontSize: '11px',
          fontWeight: 600,
          color: changeColor,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
        }}
      >
        {pctText || formatPrice(currentPrice)}
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
  currentPrice: PropTypes.number,
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
  freeAgentDailyOpens = {},
  swapsRemaining = 0,
  currentDay = 1,
  totalDays = 3,
  rotationCountdown = 0,
  // Swap mode props
  swapMode = null,
  onEnterSwapMode,
  onSelectFreeAgent,
  onCancelSwapMode,
  hideSwapButton = false,
}) {
  const [researchAsset, setResearchAsset] = useState(null);

  // Inject holographic CSS keyframes once
  useEffect(() => {
    const id = 'holo-free-agent-styles';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      @keyframes holoShimmer {
        0%, 100% { border-color: rgba(0, 217, 255, 0.5); }
        33% { border-color: rgba(139, 92, 246, 0.5); }
        66% { border-color: rgba(255, 215, 0, 0.5); }
      }
      @keyframes shineSweep {
        0%, 75%, 100% { left: -100%; }
        35% { left: 150%; }
      }
    `;
    document.head.appendChild(style);
  }, []);

  // Calculate daily price changes for each free agent (from market open, not battle start)
  const agentChanges = useMemo(() => {
    return freeAgents.map((agent) => {
      const current = currentPrices[agent.symbol];
      const dailyOpen = freeAgentDailyOpens[agent.symbol];
      if (current && dailyOpen && dailyOpen > 0) {
        return ((current - dailyOpen) / dailyOpen) * 100;
      }
      return null;
    });
  }, [freeAgents, currentPrices, freeAgentDailyOpens]);

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

        {/* Swap pill button or Cancel — hidden when parent manages swap button */}
        {!hideSwapButton && (
          isSwapActive ? (
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
          )
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
            background: `${HOLO_COLORS.greenBright}1A`,
            borderRadius: '6px',
            textAlign: 'center',
            fontSize: '11px',
            fontWeight: 600,
            color: HOLO_COLORS.greenBright,
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
              currentPrice={currentPrices[agent.symbol]}
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
  freeAgentDailyOpens: PropTypes.object,
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
  hideSwapButton: PropTypes.bool,
};
