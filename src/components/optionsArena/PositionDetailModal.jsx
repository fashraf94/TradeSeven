/**
 * PositionDetailModal
 * Modal displaying detailed view of a tournament position with lock functionality
 */

import React from 'react';

const PositionDetailModal = ({
  isOpen,
  onClose,
  position,
  prices,
  tournamentStatus,
  onLockPosition
}) => {
  if (!isOpen || !position) return null;

  const currentPrice = prices[position.symbol] || position.entryPrice;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.85)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        background: '#12121a',
        borderRadius: '16px',
        maxWidth: '500px',
        width: '100%',
        maxHeight: '80vh',
        overflow: 'auto',
        border: '1px solid #2d3748'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          borderBottom: '1px solid #2d3748'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>
              {position.direction === 'call' ? '📈' : '📉'}
            </span>
            <div>
              <h3 style={{ margin: 0, color: '#fff', fontSize: '20px' }}>
                {position.symbol}
              </h3>
              <span style={{
                fontSize: '12px',
                color: position.direction === 'call' ? '#10b981' : '#ef4444'
              }}>
                {position.direction.toUpperCase()} • ${position.strike} Strike
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#6b7280',
              fontSize: '28px',
              cursor: 'pointer',
              padding: '0',
              lineHeight: '1'
            }}
          >
            ×
          </button>
        </div>

        {/* Price Info */}
        <div style={{ padding: '20px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
            marginBottom: '20px'
          }}>
            {/* Entry Premium (what they paid for the option) */}
            <div style={{
              background: '#1a1a2e',
              padding: '16px',
              borderRadius: '12px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                Entry Premium
              </div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#9ca3af' }}>
                ${position.entryAmount?.toFixed(2) || 'N/A'}
              </div>
            </div>

            {/* Current Option Value */}
            <div style={{
              background: '#1a1a2e',
              padding: '16px',
              borderRadius: '12px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                Current Value
              </div>
              <div style={{
                fontSize: '20px',
                fontWeight: '700',
                color: position.currentValue >= position.entryAmount ? '#10b981' : '#ef4444'
              }}>
                ${position.currentValue?.toFixed(2)}
              </div>
              {/* Show P/L % */}
              <div style={{
                fontSize: '11px',
                marginTop: '4px',
                color: position.profitLoss >= 0 ? '#10b981' : '#ef4444'
              }}>
                {position.profitLoss >= 0 ? '▲' : '▼'}
                {Math.abs(position.percentReturn).toFixed(1)}%
              </div>
            </div>

            {/* Strike Price */}
            <div style={{
              background: '#1a1a2e',
              padding: '16px',
              borderRadius: '12px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                Strike Price
              </div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#00d9ff' }}>
                ${position.strike}
              </div>
            </div>
          </div>

          {/* P/L Display */}
          <div style={{
            background: position.profitLoss >= 0
              ? 'rgba(16, 185, 129, 0.1)'
              : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${position.profitLoss >= 0 ? '#10b981' : '#ef4444'}`,
            borderRadius: '12px',
            padding: '20px',
            textAlign: 'center',
            marginBottom: '20px'
          }}>
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
              Current Value
            </div>
            <div style={{
              fontSize: '32px',
              fontWeight: '700',
              color: position.profitLoss >= 0 ? '#10b981' : '#ef4444'
            }}>
              ${position.currentValue.toFixed(2)}
            </div>
            <div style={{
              fontSize: '16px',
              color: position.profitLoss >= 0 ? '#10b981' : '#ef4444',
              marginTop: '4px'
            }}>
              {position.profitLoss >= 0 ? '+' : ''}${position.profitLoss.toFixed(2)}
              ({position.percentReturn.toFixed(1)}%)
            </div>
          </div>

          {/* Details */}
          <div style={{
            background: '#1a1a2e',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '20px'
          }}>
            {/* Stock Price Info */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '12px',
              paddingBottom: '12px',
              borderBottom: '1px solid #2d3748'
            }}>
              <span style={{ color: '#6b7280' }}>Stock Price</span>
              <span style={{ color: '#fff', fontWeight: '600' }}>
                ${currentPrice.toFixed(2)}
                {position.entryPrice && (
                  <span style={{
                    fontSize: '11px',
                    marginLeft: '4px',
                    color: currentPrice >= position.entryPrice ? '#10b981' : '#ef4444'
                  }}>
                    (was ${position.entryPrice?.toFixed(2)})
                  </span>
                )}
              </span>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '12px',
              paddingBottom: '12px',
              borderBottom: '1px solid #2d3748'
            }}>
              <span style={{ color: '#6b7280' }}>Max Payout</span>
              <span style={{ color: '#10b981', fontWeight: '600' }}>${position.potentialPayout}</span>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '12px',
              paddingBottom: '12px',
              borderBottom: '1px solid #2d3748'
            }}>
              <span style={{ color: '#6b7280' }}>Expiry</span>
              <span style={{ color: '#fff', fontWeight: '600' }}>{position.daysToExpiry} days</span>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between'
            }}>
              <span style={{ color: '#6b7280' }}>Status</span>
              <span style={{
                color: position.isLocked ? '#10b981' : position.isWinning ? '#10b981' : '#f59e0b',
                fontWeight: '600'
              }}>
                {position.isLocked ? '🔒 Locked' : position.isWinning ? '✅ In The Money' : '⏳ Out of Money'}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          {!position.isLocked && tournamentStatus === 'in_progress' && (
            <button
              onClick={() => onLockPosition(position.entryId, position)}
              style={{
                width: '100%',
                padding: '16px',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                border: 'none',
                borderRadius: '10px',
                color: '#000',
                fontSize: '16px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              🔒 Lock In @ ${position.currentValue.toFixed(2)}
            </button>
          )}

          {position.isLocked && (
            <div style={{
              textAlign: 'center',
              padding: '16px',
              background: 'rgba(16, 185, 129, 0.1)',
              borderRadius: '10px',
              color: '#10b981'
            }}>
              ✅ Position Locked at ${position.lockedValue?.toFixed(2) || position.currentValue.toFixed(2)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PositionDetailModal;
