// BenchSection - Collapsible bench section for battle view
// Shows bench assets (3 stocks + 1 crypto) using TacticalRow

import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { HOLO_COLORS } from '../../constants/holoTheme';
import TacticalRow from './TacticalRow';

/**
 * BenchSection - Collapsible bench display
 */
export default function BenchSection({
  playerBench,
  opponentBench,
  defaultExpanded = false,
  onSubstitute,
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Ensure bench arrays exist with proper structure
  const playerStocks = playerBench?.stocks || [];
  const playerCrypto = playerBench?.crypto || null;
  const opponentStocks = opponentBench?.stocks || [];
  const opponentCrypto = opponentBench?.crypto || null;

  // Count total bench assets
  const playerBenchCount = playerStocks.length + (playerCrypto ? 1 : 0);
  const opponentBenchCount = opponentStocks.length + (opponentCrypto ? 1 : 0);

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
          borderBottom: isExpanded ? `1px solid ${HOLO_COLORS.borderSubtle}` : 'none',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px' }}>📦</span>
          <span
            style={{
              fontSize: '15px',
              fontWeight: 800,
              color: HOLO_COLORS.textMuted,
              textTransform: 'uppercase',
              letterSpacing: '1.5px',
              textShadow: '0 0 8px rgba(0, 217, 255, 0.4)',
            }}
          >
            Bench
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
            {playerBenchCount} / {opponentBenchCount}
          </span>
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
            {/* Stock Bench Slots */}
            {Array.from({ length: 3 }).map((_, index) => (
              <TacticalRow
                key={`bench-stock-${index}`}
                leftAsset={playerStocks[index] || null}
                rightAsset={opponentStocks[index] || null}
                allocationLabel="BN"
                isCryptoSlot={false}
              />
            ))}

            {/* Crypto Bench Slot */}
            <TacticalRow
              leftAsset={playerCrypto}
              rightAsset={opponentCrypto}
              allocationLabel="BN"
              isCryptoSlot={true}
            />

            {/* Substitution Info (if available) */}
            {onSubstitute && (
              <div
                style={{
                  padding: '12px 16px',
                  textAlign: 'center',
                  borderTop: `1px solid ${HOLO_COLORS.borderSubtle}`,
                }}
              >
                <span
                  style={{
                    fontSize: '11px',
                    color: HOLO_COLORS.textMuted,
                  }}
                >
                  Tap an asset to substitute
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

BenchSection.propTypes = {
  /** Player's bench assets */
  playerBench: PropTypes.shape({
    /** Array of stock assets (up to 3) */
    stocks: PropTypes.arrayOf(
      PropTypes.shape({
        symbol: PropTypes.string.isRequired,
        priceChange: PropTypes.number,
        baseATR: PropTypes.number,
        history: PropTypes.object,
        points: PropTypes.number,
        badges: PropTypes.arrayOf(PropTypes.string),
      })
    ),
    /** Single crypto asset */
    crypto: PropTypes.shape({
      symbol: PropTypes.string.isRequired,
      priceChange: PropTypes.number,
      baseATR: PropTypes.number,
      history: PropTypes.object,
      points: PropTypes.number,
      badges: PropTypes.arrayOf(PropTypes.string),
    }),
  }),
  /** Opponent's bench assets */
  opponentBench: PropTypes.shape({
    stocks: PropTypes.arrayOf(PropTypes.object),
    crypto: PropTypes.object,
  }),
  /** Whether bench is expanded by default */
  defaultExpanded: PropTypes.bool,
  /** Callback for substitution action */
  onSubstitute: PropTypes.func,
};

BenchSection.defaultProps = {
  playerBench: { stocks: [], crypto: null },
  opponentBench: { stocks: [], crypto: null },
  defaultExpanded: false,
  onSubstitute: null,
};
