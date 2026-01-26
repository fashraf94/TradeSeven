/**
 * EntryPortfolioCard
 * Displays individual tournament entry with live P/L and position cards
 */

import React from 'react';

const EntryPortfolioCard = ({
  entry,
  entryIndex,
  prices,
  tournamentStatus,
  onPositionClick,
  onLockPosition
}) => {
  // Calculate live values for each contract
  const contractsWithLiveValues = entry.contracts.map(contract => {
    const currentPrice = prices[contract.symbol] || contract.entryPrice;

    // If already locked, use locked value
    if (contract.lockedValue !== null) {
      return {
        ...contract,
        currentValue: contract.lockedValue,
        profitLoss: contract.lockedValue - contract.entryAmount,
        percentReturn: ((contract.lockedValue - contract.entryAmount) / contract.entryAmount) * 100,
        isLocked: true
      };
    }

    // Calculate live value using engine
    // For now, simple calculation (you may want to use calculateLiveValue from engine)
    const priceMove = (currentPrice - contract.entryPrice) / contract.entryPrice;
    const isWinning = contract.direction === 'call'
      ? currentPrice >= contract.strike
      : currentPrice <= contract.strike;

    // Simplified value calculation
    let currentValue = contract.entryAmount;
    if (isWinning) {
      currentValue = contract.potentialPayout * 0.7; // Partial value if in the money
    } else {
      // Out of the money - decaying value
      const distanceToStrike = Math.abs(currentPrice - contract.strike) / contract.strike;
      currentValue = contract.entryAmount * Math.max(0.1, 1 - distanceToStrike * 3);
    }

    return {
      ...contract,
      currentPrice,
      currentValue,
      profitLoss: currentValue - contract.entryAmount,
      percentReturn: ((currentValue - contract.entryAmount) / contract.entryAmount) * 100,
      isLocked: false,
      isWinning
    };
  });

  const totalEntry = contractsWithLiveValues.reduce((sum, c) => sum + c.entryAmount, 0);
  const totalCurrent = contractsWithLiveValues.reduce((sum, c) => sum + c.currentValue, 0);
  const totalPL = totalCurrent - totalEntry;
  const totalReturn = (totalPL / totalEntry) * 100;

  return (
    <div style={{
      background: '#0d0d12',
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '12px',
      border: '1px solid #2d3748'
    }}>
      {/* Entry Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
        paddingBottom: '12px',
        borderBottom: '1px solid #2d3748'
      }}>
        <div>
          <span style={{ color: '#9ca3af', fontSize: '12px' }}>Entry #{entry.entryNumber}</span>
          <div style={{
            fontSize: '24px',
            fontWeight: '700',
            color: totalPL >= 0 ? '#10b981' : '#ef4444'
          }}>
            {totalPL >= 0 ? '+' : ''}{totalReturn.toFixed(2)}%
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: '#9ca3af', fontSize: '11px' }}>Portfolio Value</div>
          <div style={{
            fontSize: '20px',
            fontWeight: '700',
            color: totalPL >= 0 ? '#10b981' : '#ef4444'
          }}>
            ${totalCurrent.toFixed(2)}
          </div>
          <div style={{
            fontSize: '12px',
            color: totalPL >= 0 ? '#10b981' : '#ef4444'
          }}>
            {totalPL >= 0 ? '+' : ''}${totalPL.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Contracts Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: '8px'
      }}>
        {contractsWithLiveValues.map((contract, i) => (
          <div
            key={contract.id || i}
            onClick={() => onPositionClick({ ...contract, entryId: entry.id })}
            style={{
              background: '#1a1a2e',
              borderRadius: '8px',
              padding: '12px',
              border: contract.isLocked
                ? '1px solid #10b981'
                : contract.isWinning
                  ? '1px solid rgba(16, 185, 129, 0.3)'
                  : '1px solid #2d3748',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px'
            }}>
              <span style={{
                color: '#fff',
                fontWeight: '600',
                fontSize: '14px'
              }}>
                {contract.symbol}
              </span>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                {contract.isLocked && (
                  <span style={{
                    fontSize: '10px',
                    background: '#10b981',
                    color: '#000',
                    padding: '2px 4px',
                    borderRadius: '3px'
                  }}>
                    🔒
                  </span>
                )}
                <span style={{
                  fontSize: '10px',
                  background: contract.direction === 'call' ? '#10b981' : '#ef4444',
                  color: '#fff',
                  padding: '2px 6px',
                  borderRadius: '3px'
                }}>
                  {contract.direction?.toUpperCase()}
                </span>
              </div>
            </div>

            <div style={{
              fontSize: '11px',
              color: '#6b7280',
              marginBottom: '4px'
            }}>
              Strike: ${contract.strike} • {contract.daysToExpiry}D
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline'
            }}>
              <span style={{
                fontSize: '16px',
                fontWeight: '700',
                color: contract.profitLoss >= 0 ? '#10b981' : '#ef4444'
              }}>
                ${contract.currentValue.toFixed(0)}
              </span>
              <span style={{
                fontSize: '12px',
                color: contract.profitLoss >= 0 ? '#10b981' : '#ef4444'
              }}>
                {contract.percentReturn >= 0 ? '+' : ''}{contract.percentReturn.toFixed(1)}%
              </span>
            </div>

            {/* Quick Lock Button (only if not locked and tournament in progress) */}
            {!contract.isLocked && tournamentStatus === 'in_progress' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onLockPosition(entry.id, contract);
                }}
                style={{
                  width: '100%',
                  marginTop: '8px',
                  padding: '8px',
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid #f59e0b',
                  borderRadius: '6px',
                  color: '#f59e0b',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                🔒 Lock @ ${contract.currentValue.toFixed(0)}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default EntryPortfolioCard;
