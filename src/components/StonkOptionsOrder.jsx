/**
 * Stonk Options Order Entry
 * Shows selected option details and allows amount entry
 * Clear display of risk vs reward
 */

import React, { useState, useMemo } from 'react';
import {
  calculateContractPricing,
  createContract,
  validateContract,
  STONK_OPTIONS_CONFIG
} from '../services/stonkOptionsEngineV2';
import { TrendingUp, TrendingDown, AlertCircle, X } from 'lucide-react';

const StonkOptionsOrder = ({
  selection, // { symbol, strike, direction, currentPrice, daysToExpiry }
  onConfirm,
  onCancel,
  maxBudget = 5000
}) => {
  const [amount, setAmount] = useState(500);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculate pricing for current amount
  const pricing = useMemo(() => {
    if (!selection) return null;

    return calculateContractPricing({
      symbol: selection.symbol,
      currentPrice: selection.currentPrice,
      strikePrice: selection.strike,
      direction: selection.direction,
      daysToExpiry: selection.daysToExpiry,
      entryAmount: amount
    });
  }, [selection, amount]);

  // Validation
  const validation = useMemo(() => {
    if (!selection) return { isValid: false, errors: ['No selection'] };

    return validateContract({
      symbol: selection.symbol,
      strikePrice: selection.strike,
      direction: selection.direction,
      daysToExpiry: selection.daysToExpiry,
      entryAmount: amount,
      currentPrice: selection.currentPrice
    });
  }, [selection, amount]);

  // Handle confirm
  const handleConfirm = async () => {
    if (!validation.isValid || !pricing) return;

    setIsSubmitting(true);

    try {
      const contract = createContract({
        symbol: selection.symbol,
        currentPrice: selection.currentPrice,
        strikePrice: selection.strike,
        direction: selection.direction,
        daysToExpiry: selection.daysToExpiry,
        entryAmount: amount
      });

      await onConfirm?.(contract);
    } catch (error) {
      console.error('Failed to create contract:', error);
      alert('Failed to create contract. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!selection) {
    return (
      <div style={{
        padding: 40,
        textAlign: 'center',
        color: '#6b7280',
        background: '#0d1117',
        borderRadius: 12
      }}>
        Select an option from the chain to continue
      </div>
    );
  }

  const isCall = selection.direction === 'call';
  const directionColor = isCall ? '#10b981' : '#ef4444';
  const DirectionIcon = isCall ? TrendingUp : TrendingDown;

  // Calculate expiry date for display
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + selection.daysToExpiry);

  return (
    <div style={{
      background: '#0d1117',
      borderRadius: 16,
      overflow: 'hidden',
      border: `1px solid ${directionColor}40`
    }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, ${directionColor}20 0%, ${directionColor}10 100%)`,
        padding: '20px 24px',
        borderBottom: `1px solid ${directionColor}30`
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start'
        }}>
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 8
            }}>
              <DirectionIcon size={24} color={directionColor} />
              <span style={{
                fontSize: 22,
                fontWeight: 'bold',
                color: 'white'
              }}>
                {selection.symbol} ${selection.strike} {selection.direction.toUpperCase()}
              </span>
            </div>
            <div style={{ color: '#9ca3af', fontSize: 14 }}>
              Expires {expiryDate.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric'
              })} ({selection.daysToExpiry}D)
            </div>
          </div>

          {onCancel && (
            <button
              onClick={onCancel}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: 8,
                padding: 8,
                cursor: 'pointer',
                color: '#9ca3af'
              }}
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Price Info */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 1,
        background: '#1f2937'
      }}>
        <div style={{
          background: '#0d1117',
          padding: '16px 20px',
          textAlign: 'center'
        }}>
          <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 4 }}>
            Current Price
          </div>
          <div style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>
            ${selection.currentPrice.toFixed(2)}
          </div>
        </div>
        <div style={{
          background: '#0d1117',
          padding: '16px 20px',
          textAlign: 'center'
        }}>
          <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 4 }}>
            Strike Price
          </div>
          <div style={{ color: directionColor, fontSize: 20, fontWeight: 'bold' }}>
            ${selection.strike.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Distance & Premium Info */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid #1f2937'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 12
        }}>
          <span style={{ color: '#6b7280' }}>Distance to Strike</span>
          <span style={{ color: 'white', fontWeight: '600' }}>
            {isCall ? '+' : '-'}{pricing?.distanceOTM}% {pricing?.isITM ? '(ITM)' : '(OTM)'}
          </span>
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 12
        }}>
          <span style={{ color: '#6b7280' }}>Premium</span>
          <span style={{ color: '#fbbf24', fontWeight: '600' }}>
            {pricing?.premiumPercent}%
          </span>
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between'
        }}>
          <span style={{ color: '#6b7280' }}>Payout Multiplier</span>
          <span style={{ color: '#00d9ff', fontWeight: '600' }}>
            {pricing?.payoutMultiplier}x
          </span>
        </div>
      </div>

      {/* Amount Input */}
      <div style={{ padding: '20px' }}>
        <label style={{
          display: 'block',
          color: '#9ca3af',
          fontSize: 14,
          marginBottom: 8
        }}>
          Amount to Risk
        </label>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          background: '#1a1f2e',
          borderRadius: 12,
          border: '1px solid #2d3748',
          overflow: 'hidden'
        }}>
          <span style={{
            padding: '16px',
            color: '#6b7280',
            fontSize: 20,
            fontWeight: 'bold'
          }}>
            $
          </span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(Math.max(0, parseInt(e.target.value) || 0))}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: 'white',
              fontSize: 24,
              fontWeight: 'bold',
              padding: '16px 16px 16px 0',
              outline: 'none',
              width: '100%'
            }}
            min={STONK_OPTIONS_CONFIG.minPosition}
            max={Math.min(STONK_OPTIONS_CONFIG.maxPosition, maxBudget)}
          />
        </div>

        {/* Quick Amount Buttons */}
        <div style={{
          display: 'flex',
          gap: 8,
          marginTop: 12
        }}>
          {[100, 250, 500, 1000, 2500].map(preset => (
            <button
              key={preset}
              onClick={() => setAmount(Math.min(preset, maxBudget))}
              disabled={preset > maxBudget}
              style={{
                flex: 1,
                padding: '10px 8px',
                background: amount === preset ? '#00d9ff20' : '#1a1f2e',
                border: amount === preset ? '1px solid #00d9ff' : '1px solid #2d3748',
                borderRadius: 8,
                color: preset > maxBudget ? '#4b5563' : (amount === preset ? '#00d9ff' : '#9ca3af'),
                fontSize: 13,
                fontWeight: '600',
                cursor: preset > maxBudget ? 'not-allowed' : 'pointer'
              }}
            >
              ${preset}
            </button>
          ))}
        </div>

        <div style={{
          textAlign: 'right',
          marginTop: 8,
          fontSize: 12,
          color: '#6b7280'
        }}>
          Max: ${Math.min(STONK_OPTIONS_CONFIG.maxPosition, maxBudget).toLocaleString()}
        </div>
      </div>

      {/* Outcome Preview */}
      <div style={{
        margin: '0 20px 20px',
        borderRadius: 12,
        overflow: 'hidden',
        border: '1px solid #1f2937'
      }}>
        {/* Win Scenario */}
        <div style={{
          padding: '16px 20px',
          background: '#10b98115',
          borderBottom: '1px solid #1f2937'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <div style={{ color: '#10b981', fontWeight: '600', marginBottom: 4 }}>
                IF {selection.symbol} {isCall ? '≥' : '≤'} ${selection.strike}
              </div>
              <div style={{ color: '#6b7280', fontSize: 12 }}>
                You win
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{
                color: '#10b981',
                fontSize: 24,
                fontWeight: 'bold'
              }}>
                +${pricing?.potentialPayout?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <div style={{ color: '#10b981', fontSize: 12 }}>
                +{((pricing?.potentialPayout - amount) / amount * 100).toFixed(0)}% profit
              </div>
            </div>
          </div>
        </div>

        {/* Lose Scenario */}
        <div style={{
          padding: '16px 20px',
          background: '#ef444415'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <div style={{ color: '#ef4444', fontWeight: '600', marginBottom: 4 }}>
                IF {selection.symbol} {isCall ? '<' : '>'} ${selection.strike}
              </div>
              <div style={{ color: '#6b7280', fontSize: 12 }}>
                You lose
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{
                color: '#ef4444',
                fontSize: 24,
                fontWeight: 'bold'
              }}>
                -${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <div style={{ color: '#ef4444', fontSize: 12 }}>
                100% loss
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Validation Errors */}
      {!validation.isValid && validation.errors.length > 0 && (
        <div style={{
          margin: '0 20px 20px',
          padding: 12,
          background: '#ef444420',
          borderRadius: 8,
          border: '1px solid #ef444440'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: '#ef4444'
          }}>
            <AlertCircle size={16} />
            <span style={{ fontSize: 13 }}>{validation.errors[0]}</span>
          </div>
        </div>
      )}

      {/* Confirm Button */}
      <div style={{ padding: '0 20px 20px' }}>
        <button
          onClick={handleConfirm}
          disabled={!validation.isValid || isSubmitting}
          style={{
            width: '100%',
            padding: '18px 24px',
            background: validation.isValid
              ? `linear-gradient(135deg, ${directionColor} 0%, ${isCall ? '#059669' : '#dc2626'} 100%)`
              : '#374151',
            border: 'none',
            borderRadius: 12,
            color: 'white',
            fontSize: 18,
            fontWeight: 'bold',
            cursor: validation.isValid ? 'pointer' : 'not-allowed',
            opacity: isSubmitting ? 0.7 : 1,
            transition: 'all 0.2s'
          }}
        >
          {isSubmitting ? 'Creating...' : (
            <>
              {isCall ? '📈' : '📉'} BUY {selection.direction.toUpperCase()} - Risk ${amount}
            </>
          )}
        </button>

        <p style={{
          textAlign: 'center',
          color: '#6b7280',
          fontSize: 11,
          marginTop: 12
        }}>
          This is a simulated trade for entertainment only.
          <br />
          No real money is involved.
        </p>
      </div>
    </div>
  );
};

export default StonkOptionsOrder;
