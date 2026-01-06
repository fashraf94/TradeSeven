/**
 * Stonk Options Position Card
 * Displays an active or settled contract with live P/L
 */

import React, { useMemo } from 'react';
import {
  calculateLiveValue
} from '../services/stonkOptionsEngineV2';
import { TrendingUp, TrendingDown, Clock, Target, Zap } from 'lucide-react';

const StonkOptionsPosition = ({
  contract,
  currentPrice,
  onClose, // Optional: for closing positions early
  compact = false
}) => {
  // Calculate current value
  const valuation = useMemo(() => {
    if (!contract || !currentPrice) return null;
    return calculateLiveValue(contract, currentPrice);
  }, [contract, currentPrice]);

  if (!contract || !valuation) return null;

  const isCall = contract.direction === 'call';
  const directionColor = isCall ? '#10b981' : '#ef4444';
  const DirectionIcon = isCall ? TrendingUp : TrendingDown;

  // Determine status styling
  const getStatusStyle = () => {
    if (valuation.isExpired) {
      return valuation.status === 'won'
        ? { bg: '#10b98120', border: '#10b981', label: '🎉 WON', color: '#10b981' }
        : { bg: '#ef444420', border: '#ef4444', label: '💀 LOST', color: '#ef4444' };
    }
    if (valuation.isITM) {
      return { bg: '#10b98110', border: '#10b98150', label: 'ITM', color: '#10b981' };
    }
    return { bg: '#1a1f2e', border: '#2d3748', label: 'OTM', color: '#fbbf24' };
  };

  const statusStyle = getStatusStyle();

  // Progress to strike (0% = at entry, 100% = at strike)
  const progressToStrike = useMemo(() => {
    const totalDistance = Math.abs(contract.strike - contract.entryPrice);
    const currentDistance = isCall
      ? currentPrice - contract.entryPrice
      : contract.entryPrice - currentPrice;

    if (totalDistance === 0) return 100;
    return Math.min(150, Math.max(-50, (currentDistance / totalDistance) * 100));
  }, [contract, currentPrice, isCall]);

  // Compact view for lists
  if (compact) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        background: statusStyle.bg,
        borderRadius: 10,
        border: `1px solid ${statusStyle.border}`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <DirectionIcon size={20} color={directionColor} />
          <div>
            <div style={{
              color: 'white',
              fontWeight: '600',
              fontSize: 14
            }}>
              {contract.symbol} ${contract.strike} {contract.direction.toUpperCase()}
            </div>
            <div style={{ color: '#6b7280', fontSize: 12 }}>
              {valuation.timeDisplay}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            color: valuation.isWinning ? '#10b981' : '#ef4444',
            fontWeight: 'bold',
            fontSize: 16
          }}>
            {valuation.percentReturn >= 0 ? '+' : ''}{valuation.percentReturn}%
          </div>
          <div style={{ color: '#9ca3af', fontSize: 12 }}>
            ${valuation.currentValue.toFixed(0)}
          </div>
        </div>
      </div>
    );
  }

  // Full card view
  return (
    <div style={{
      background: '#0d1117',
      borderRadius: 16,
      overflow: 'hidden',
      border: `1px solid ${statusStyle.border}`
    }}>
      {/* Header */}
      <div style={{
        background: statusStyle.bg,
        padding: '16px 20px',
        borderBottom: `1px solid ${statusStyle.border}`
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: directionColor + '20',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <DirectionIcon size={22} color={directionColor} />
            </div>
            <div>
              <div style={{
                color: 'white',
                fontWeight: 'bold',
                fontSize: 18
              }}>
                {contract.symbol} ${contract.strike}
              </div>
              <div style={{
                color: directionColor,
                fontSize: 13,
                fontWeight: '600'
              }}>
                {contract.direction.toUpperCase()} • {contract.daysToExpiry}D
              </div>
            </div>
          </div>

          {/* Status Badge */}
          <div style={{
            padding: '6px 12px',
            borderRadius: 20,
            background: statusStyle.color + '20',
            color: statusStyle.color,
            fontSize: 12,
            fontWeight: '600'
          }}>
            {statusStyle.label}
          </div>
        </div>
      </div>

      {/* P/L Display */}
      <div style={{
        padding: '20px',
        textAlign: 'center',
        borderBottom: '1px solid #1f2937'
      }}>
        <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 4 }}>
          {valuation.isExpired ? 'Final Value' : 'Current Value'}
        </div>
        <div style={{
          fontSize: 32,
          fontWeight: 'bold',
          color: valuation.isWinning ? '#10b981' : '#ef4444'
        }}>
          ${valuation.currentValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </div>
        <div style={{
          fontSize: 16,
          color: valuation.isWinning ? '#10b981' : '#ef4444',
          marginTop: 4
        }}>
          {valuation.profitLoss >= 0 ? '+' : ''}${valuation.profitLoss.toFixed(2)}
          ({valuation.percentReturn >= 0 ? '+' : ''}{valuation.percentReturn}%)
        </div>
      </div>

      {/* Strike Progress */}
      {!valuation.isExpired && (
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #1f2937' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 8,
            fontSize: 12
          }}>
            <span style={{ color: '#6b7280' }}>Progress to Strike</span>
            <span style={{
              color: valuation.isITM ? '#10b981' : '#fbbf24',
              fontWeight: '600'
            }}>
              {valuation.isITM ? 'In the Money!' : `${Math.max(0, progressToStrike).toFixed(0)}%`}
            </span>
          </div>

          {/* Progress Bar */}
          <div style={{
            height: 8,
            background: '#1f2937',
            borderRadius: 4,
            overflow: 'hidden',
            position: 'relative'
          }}>
            {/* Strike marker at 100% */}
            <div style={{
              position: 'absolute',
              left: '100%',
              top: 0,
              bottom: 0,
              width: 2,
              background: '#fff',
              transform: 'translateX(-1px)',
              zIndex: 2
            }} />

            {/* Progress fill */}
            <div style={{
              height: '100%',
              width: `${Math.min(100, Math.max(0, progressToStrike))}%`,
              background: valuation.isITM
                ? 'linear-gradient(90deg, #10b981, #34d399)'
                : `linear-gradient(90deg, ${directionColor}80, ${directionColor})`,
              borderRadius: 4,
              transition: 'width 0.3s ease'
            }} />
          </div>

          {/* Price labels */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 8,
            fontSize: 11,
            color: '#6b7280'
          }}>
            <span>Entry: ${contract.entryPrice.toFixed(2)}</span>
            <span>Current: ${currentPrice.toFixed(2)}</span>
            <span style={{ color: directionColor }}>Strike: ${contract.strike.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 1,
        background: '#1f2937'
      }}>
        <div style={{ background: '#0d1117', padding: '12px', textAlign: 'center' }}>
          <div style={{ color: '#6b7280', fontSize: 10, marginBottom: 4 }}>
            <Clock size={12} style={{ display: 'inline', marginRight: 4 }} />
            TIME
          </div>
          <div style={{
            color: valuation.daysRemaining < 1 ? '#ef4444' : 'white',
            fontWeight: '600',
            fontSize: 14
          }}>
            {valuation.timeDisplay}
          </div>
        </div>

        <div style={{ background: '#0d1117', padding: '12px', textAlign: 'center' }}>
          <div style={{ color: '#6b7280', fontSize: 10, marginBottom: 4 }}>
            <Target size={12} style={{ display: 'inline', marginRight: 4 }} />
            WIN PROB
          </div>
          <div style={{
            color: valuation.winProbability > 50 ? '#10b981' : '#fbbf24',
            fontWeight: '600',
            fontSize: 14
          }}>
            {valuation.winProbability}%
          </div>
        </div>

        <div style={{ background: '#0d1117', padding: '12px', textAlign: 'center' }}>
          <div style={{ color: '#6b7280', fontSize: 10, marginBottom: 4 }}>
            <Zap size={12} style={{ display: 'inline', marginRight: 4 }} />
            PAYOUT
          </div>
          <div style={{ color: '#00d9ff', fontWeight: '600', fontSize: 14 }}>
            {contract.payoutMultiplier}x
          </div>
        </div>
      </div>

      {/* Entry Info */}
      <div style={{
        padding: '12px 20px',
        background: '#0a0a12',
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 12
      }}>
        <span style={{ color: '#6b7280' }}>
          Entry: ${contract.entryAmount.toFixed(2)}
        </span>
        <span style={{ color: '#6b7280' }}>
          Max Payout: ${contract.potentialPayout.toFixed(2)}
        </span>
      </div>

      {/* Result Banner (for expired contracts) */}
      {valuation.isExpired && (
        <div style={{
          padding: '16px 20px',
          background: valuation.status === 'won' ? '#10b98120' : '#ef444420',
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: 18,
            fontWeight: 'bold',
            color: valuation.status === 'won' ? '#10b981' : '#ef4444',
            marginBottom: 4
          }}>
            {valuation.status === 'won' ? '🎉 Contract Won!' : '💀 Contract Expired Worthless'}
          </div>
          <div style={{ color: '#9ca3af', fontSize: 13 }}>
            {contract.symbol} closed at ${currentPrice.toFixed(2)}
            {valuation.status === 'won'
              ? ` (${isCall ? 'above' : 'below'} $${contract.strike} strike)`
              : ` (${isCall ? 'below' : 'above'} $${contract.strike} strike)`
            }
          </div>
        </div>
      )}

      {/* Close Early Button (optional, for active contracts) */}
      {onClose && !valuation.isExpired && (
        <div style={{ padding: '12px 20px' }}>
          <button
            onClick={() => onClose(contract, valuation)}
            style={{
              width: '100%',
              padding: '12px',
              background: '#1f2937',
              border: '1px solid #374151',
              borderRadius: 8,
              color: '#9ca3af',
              fontSize: 13,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#374151';
              e.currentTarget.style.color = 'white';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#1f2937';
              e.currentTarget.style.color = '#9ca3af';
            }}
          >
            Sell Position (${valuation.currentValue.toFixed(2)})
          </button>
        </div>
      )}
    </div>
  );
};

export default StonkOptionsPosition;
