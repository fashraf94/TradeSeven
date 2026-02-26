// SwapMarketModal - V5 bottom-sheet modal for all swap actions
// Sections: Cash (top), Stock Free Agents (middle), Crypto Pool (bottom)
// Replaces the inline FreeAgentBar from V4

import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import { HOLO_COLORS } from '../../constants/holoTheme';
import { BAGGERBOMB_CRYPTO_POOL } from '../../constants/cryptoPool';

// ============================================
// HELPERS
// ============================================

const formatCountdown = (seconds) => {
  if (!seconds || seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const formatPrice = (price) => {
  if (!price || isNaN(price)) return '--';
  if (price >= 10000) return `$${Math.round(price).toLocaleString()}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(6)}`;
};

const formatPctChange = (pct) => {
  if (pct === null || pct === undefined || isNaN(pct)) return null;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
};

// ============================================
// CASH SECTION
// ============================================

function CashSection({ onGoToCash, disabled }) {
  return (
    <motion.button
      whileHover={!disabled ? { scale: 1.01 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
      onClick={onGoToCash}
      disabled={disabled}
      style={{
        width: '100%',
        padding: '14px 16px',
        borderRadius: '12px',
        border: `1px solid ${disabled ? HOLO_COLORS.borderSubtle : 'rgba(16, 185, 129, 0.3)'}`,
        background: disabled
          ? HOLO_COLORS.bgCard
          : 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(16, 185, 129, 0.02))',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        textAlign: 'left',
      }}
    >
      <span style={{ fontSize: '24px' }}>💵</span>
      <div style={{ flex: 1 }}>
        <div style={{
          fontSize: '14px',
          fontWeight: 700,
          color: HOLO_COLORS.textPrimary,
          letterSpacing: '0.5px',
        }}>
          GO TO CASH
        </div>
        <div style={{
          fontSize: '11px',
          color: HOLO_COLORS.textMuted,
          marginTop: '2px',
        }}>
          Close a position. Earns 0 pts until you swap back in.
        </div>
      </div>
      <span style={{
        fontSize: '16px',
        color: disabled ? HOLO_COLORS.textMuted : HOLO_COLORS.green,
      }}>
        ▶
      </span>
    </motion.button>
  );
}

// ============================================
// STOCK FREE AGENT CARD
// ============================================

function StockCard({ agent, currentPrice, dailyChange, onSelect, disabled }) {
  const pctText = formatPctChange(dailyChange);
  const isPositive = dailyChange > 0;
  const changeColor = pctText
    ? (isPositive ? HOLO_COLORS.green : dailyChange < 0 ? HOLO_COLORS.red : HOLO_COLORS.textMuted)
    : HOLO_COLORS.textSecondary;

  return (
    <motion.button
      whileHover={!disabled ? { scale: 1.05, y: -2 } : {}}
      whileTap={!disabled ? { scale: 0.95 } : {}}
      onClick={() => !disabled && onSelect(agent)}
      disabled={disabled}
      style={{
        width: '80px',
        flexShrink: 0,
        padding: '10px 6px 8px',
        borderRadius: '10px',
        background: `linear-gradient(145deg, ${HOLO_COLORS.bgElevated} 0%, ${HOLO_COLORS.bgCard} 50%, #1a1025 100%)`,
        border: `2px solid ${HOLO_COLORS.borderSubtle}`,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '3px',
        boxShadow: `0 4px 16px rgba(0, 0, 0, 0.4), 0 0 12px rgba(0, 217, 255, 0.15)`,
      }}
    >
      <div style={{
        fontSize: '14px',
        fontWeight: 800,
        color: HOLO_COLORS.cyan,
        letterSpacing: '0.5px',
      }}>
        {agent.symbol}
      </div>
      <div style={{
        fontSize: '9px',
        color: HOLO_COLORS.textMuted,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        maxWidth: '100%',
      }}>
        {agent.name}
      </div>
      <div style={{
        fontSize: '11px',
        fontWeight: 600,
        color: HOLO_COLORS.textSecondary,
      }}>
        {formatPrice(currentPrice)}
      </div>
      {pctText && (
        <div style={{
          fontSize: '10px',
          fontWeight: 700,
          color: changeColor,
        }}>
          {pctText}
        </div>
      )}
    </motion.button>
  );
}

// ============================================
// CRYPTO POOL CARD
// ============================================

function CryptoCard({ crypto, currentPrice, dailyChange, onSelectLong, onSelectShort, inRoster, rosterDirection, disabled }) {
  const pctText = formatPctChange(dailyChange);
  const isPositive = dailyChange > 0;
  const changeColor = pctText
    ? (isPositive ? HOLO_COLORS.green : dailyChange < 0 ? HOLO_COLORS.red : HOLO_COLORS.textMuted)
    : HOLO_COLORS.textSecondary;

  return (
    <div
      style={{
        padding: '12px',
        borderRadius: '12px',
        background: `linear-gradient(145deg, ${HOLO_COLORS.bgElevated} 0%, ${HOLO_COLORS.bgCard} 100%)`,
        border: `1px solid ${inRoster ? 'rgba(251, 191, 36, 0.3)' : 'rgba(139, 92, 246, 0.25)'}`,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      {/* Symbol + Price */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{
            fontSize: '15px',
            fontWeight: 800,
            color: HOLO_COLORS.purple,
          }}>
            {crypto.symbol}
          </div>
          <div style={{
            fontSize: '10px',
            color: HOLO_COLORS.textMuted,
          }}>
            {crypto.name}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: '12px',
            fontWeight: 600,
            color: HOLO_COLORS.textSecondary,
          }}>
            {formatPrice(currentPrice)}
          </div>
          {pctText && (
            <div style={{
              fontSize: '10px',
              fontWeight: 700,
              color: changeColor,
            }}>
              {pctText}
            </div>
          )}
        </div>
      </div>

      {/* In Roster Badge */}
      {inRoster && (
        <div style={{
          fontSize: '9px',
          fontWeight: 700,
          color: '#fbbf24',
          textTransform: 'uppercase',
          letterSpacing: '1px',
        }}>
          In Roster ({rosterDirection === 'short' ? 'SHORT' : 'LONG'})
        </div>
      )}

      {/* Long / Short Buttons */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <motion.button
          whileHover={!disabled ? { scale: 1.05 } : {}}
          whileTap={!disabled ? { scale: 0.95 } : {}}
          onClick={() => !disabled && onSelectLong(crypto)}
          disabled={disabled}
          style={{
            flex: 1,
            padding: '8px 4px',
            borderRadius: '8px',
            border: `1px solid ${HOLO_COLORS.green}40`,
            background: `rgba(16, 185, 129, 0.08)`,
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.4 : 1,
            fontSize: '11px',
            fontWeight: 700,
            color: HOLO_COLORS.green,
            letterSpacing: '0.5px',
          }}
        >
          LONG ↑
        </motion.button>
        <motion.button
          whileHover={!disabled ? { scale: 1.05 } : {}}
          whileTap={!disabled ? { scale: 0.95 } : {}}
          onClick={() => !disabled && onSelectShort(crypto)}
          disabled={disabled}
          style={{
            flex: 1,
            padding: '8px 4px',
            borderRadius: '8px',
            border: `1px solid ${HOLO_COLORS.red}40`,
            background: `rgba(239, 68, 68, 0.08)`,
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.4 : 1,
            fontSize: '11px',
            fontWeight: 700,
            color: HOLO_COLORS.red,
            letterSpacing: '0.5px',
          }}
        >
          SHORT ↓
        </motion.button>
      </div>
    </div>
  );
}

// ============================================
// SECTION DIVIDER
// ============================================

function SectionDivider({ icon, title, subtitle }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '4px 0',
    }}>
      <span style={{ fontSize: '13px' }}>{icon}</span>
      <span style={{
        fontSize: '11px',
        fontWeight: 700,
        color: HOLO_COLORS.textMuted,
        textTransform: 'uppercase',
        letterSpacing: '1px',
      }}>
        {title}
      </span>
      <div style={{
        flex: 1,
        height: '1px',
        background: HOLO_COLORS.borderSubtle,
      }} />
      {subtitle && (
        <span style={{
          fontSize: '10px',
          color: HOLO_COLORS.textMuted,
          fontWeight: 600,
        }}>
          {subtitle}
        </span>
      )}
    </div>
  );
}

// ============================================
// SWAP MARKET MODAL
// ============================================

export default function SwapMarketModal({
  isOpen,
  onClose,
  stockFreeAgents,
  currentPrices,
  dailyOpens,
  swapsRemaining,
  onSwapStock,
  onSwapCryptoLong,
  onSwapCryptoShort,
  onGoToCash,
  rotationTimer,
  rosterAssets,
}) {
  const disabled = swapsRemaining <= 0;

  // Calculate daily % change for each free agent
  const stockChanges = useMemo(() => {
    const changes = {};
    (stockFreeAgents || []).forEach(agent => {
      const current = currentPrices?.[agent.symbol];
      const open = dailyOpens?.[agent.symbol];
      if (current && open && open > 0) {
        changes[agent.symbol] = ((current - open) / open) * 100;
      }
    });
    return changes;
  }, [stockFreeAgents, currentPrices, dailyOpens]);

  // Calculate daily % change for crypto pool
  const cryptoChanges = useMemo(() => {
    const changes = {};
    BAGGERBOMB_CRYPTO_POOL.forEach(crypto => {
      const current = currentPrices?.[crypto.symbol];
      const open = dailyOpens?.[crypto.symbol];
      if (current && open && open > 0) {
        changes[crypto.symbol] = ((current - open) / open) * 100;
      }
    });
    return changes;
  }, [currentPrices, dailyOpens]);

  // Build roster crypto lookup
  const rosterCryptoMap = useMemo(() => {
    const map = {};
    (rosterAssets || []).forEach(a => {
      if (a?.isCrypto && !a?.isCash) {
        map[a.symbol] = a.direction || 'long';
      }
    });
    return map;
  }, [rosterAssets]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              zIndex: 90,
            }}
          />

          {/* Bottom Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              maxHeight: '85vh',
              backgroundColor: HOLO_COLORS.bgDeep,
              borderTopLeftRadius: '20px',
              borderTopRightRadius: '20px',
              border: `1px solid ${HOLO_COLORS.borderSubtle}`,
              borderBottom: 'none',
              zIndex: 91,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Drag Handle */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              padding: '10px 0 4px',
            }}>
              <div style={{
                width: '36px',
                height: '4px',
                borderRadius: '2px',
                backgroundColor: HOLO_COLORS.textMuted,
                opacity: 0.4,
              }} />
            </div>

            {/* Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '4px 20px 12px',
            }}>
              <div style={{
                fontSize: '16px',
                fontWeight: 800,
                color: HOLO_COLORS.textPrimary,
                letterSpacing: '1px',
              }}>
                SWAP MARKET
              </div>
              <div style={{
                fontSize: '12px',
                fontWeight: 700,
                color: disabled ? HOLO_COLORS.red : HOLO_COLORS.cyan,
                padding: '4px 10px',
                borderRadius: '12px',
                background: disabled
                  ? `${HOLO_COLORS.red}15`
                  : `${HOLO_COLORS.cyan}15`,
              }}>
                {swapsRemaining} swap{swapsRemaining !== 1 ? 's' : ''} left
              </div>
            </div>

            {/* Scrollable Content */}
            <div style={{
              overflowY: 'auto',
              padding: '0 16px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              WebkitOverflowScrolling: 'touch',
            }}>
              {/* Section 1: Cash */}
              <CashSection onGoToCash={onGoToCash} disabled={disabled} />

              {/* Section 2: Stock Free Agents */}
              <SectionDivider
                icon="📊"
                title="Stock Free Agents"
                subtitle={rotationTimer > 0 ? `Rotates in ${formatCountdown(rotationTimer)}` : 'Rotating...'}
              />
              <div style={{
                display: 'flex',
                gap: '8px',
                overflowX: 'auto',
                paddingBottom: '4px',
                minHeight: '80px',
                WebkitOverflowScrolling: 'touch',
              }}>
                {(stockFreeAgents || []).map(agent => (
                  <StockCard
                    key={agent.symbol}
                    agent={agent}
                    currentPrice={currentPrices?.[agent.symbol]}
                    dailyChange={stockChanges[agent.symbol]}
                    onSelect={onSwapStock}
                    disabled={disabled}
                  />
                ))}
                {(!stockFreeAgents || stockFreeAgents.length === 0) && (
                  <div style={{
                    width: '100%',
                    padding: '20px',
                    textAlign: 'center',
                    fontSize: '12px',
                    color: HOLO_COLORS.textMuted,
                  }}>
                    No stock free agents available
                  </div>
                )}
              </div>

              {/* Section 3: Crypto Pool */}
              <SectionDivider
                icon="🪙"
                title="Crypto Pool"
                subtitle="Always Available"
              />
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '10px',
              }}>
                {BAGGERBOMB_CRYPTO_POOL.map(crypto => (
                  <CryptoCard
                    key={crypto.symbol}
                    crypto={crypto}
                    currentPrice={currentPrices?.[crypto.symbol]}
                    dailyChange={cryptoChanges[crypto.symbol]}
                    onSelectLong={onSwapCryptoLong}
                    onSelectShort={onSwapCryptoShort}
                    inRoster={Boolean(rosterCryptoMap[crypto.symbol])}
                    rosterDirection={rosterCryptoMap[crypto.symbol]}
                    disabled={disabled}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

SwapMarketModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  stockFreeAgents: PropTypes.array,
  currentPrices: PropTypes.object,
  dailyOpens: PropTypes.object,
  swapsRemaining: PropTypes.number,
  onSwapStock: PropTypes.func.isRequired,
  onSwapCryptoLong: PropTypes.func.isRequired,
  onSwapCryptoShort: PropTypes.func.isRequired,
  onGoToCash: PropTypes.func.isRequired,
  rotationTimer: PropTypes.number,
  rosterAssets: PropTypes.array,
};

SwapMarketModal.defaultProps = {
  stockFreeAgents: [],
  currentPrices: {},
  dailyOpens: {},
  swapsRemaining: 0,
  rotationTimer: 0,
  rosterAssets: [],
};
