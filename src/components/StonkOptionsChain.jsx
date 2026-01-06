/**
 * Stonk Options Chain
 * Think or Swim-style options chain display
 *
 * Two-column layout with calls/puts, strikes in center
 * Tap to select a strike
 */

import React, { useMemo, useState } from 'react';
import {
  generateStrikes,
  calculatePremium,
  getVolatilityTier,
  STONK_OPTIONS_CONFIG
} from '../services/stonkOptionsEngineV2';

const StonkOptionsChain = ({
  symbol,
  currentPrice,
  selectedExpiry = 7,
  onSelectStrike,
  selectedStrike = null
}) => {
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'calls', 'puts'

  // Get volatility tier info
  const tierInfo = useMemo(() => getVolatilityTier(symbol), [symbol]);

  // Generate all strikes
  const strikes = useMemo(() => {
    if (!currentPrice || !symbol) return { calls: [], puts: [], all: [] };

    const { calls, puts } = generateStrikes(currentPrice, symbol);

    // Calculate premium for each strike
    const callsWithPremium = calls.map(s => ({
      ...s,
      ...calculatePremium({
        currentPrice,
        strikePrice: s.strike,
        direction: 'call',
        daysToExpiry: selectedExpiry,
        volatilityTier: tierInfo.tier
      })
    }));

    const putsWithPremium = puts.map(s => ({
      ...s,
      ...calculatePremium({
        currentPrice,
        strikePrice: s.strike,
        direction: 'put',
        daysToExpiry: selectedExpiry,
        volatilityTier: tierInfo.tier
      })
    }));

    // Create combined list for the chain view
    // Match calls and puts by distance percentage
    const all = callsWithPremium.map((call, idx) => ({
      call,
      put: putsWithPremium[idx],
      strikeCall: call.strike,
      strikePut: putsWithPremium[idx].strike,
      distancePercent: call.distancePercent
    }));

    return { calls: callsWithPremium, puts: putsWithPremium, all };
  }, [currentPrice, symbol, selectedExpiry, tierInfo]);

  // Handle strike selection
  const handleSelect = (strike, direction) => {
    onSelectStrike?.({
      symbol,
      strike,
      direction,
      currentPrice,
      daysToExpiry: selectedExpiry
    });
  };

  // Check if a strike is selected
  const isSelected = (strike, direction) => {
    return selectedStrike?.strike === strike && selectedStrike?.direction === direction;
  };

  if (!symbol || !currentPrice) {
    return (
      <div style={{
        padding: 40,
        textAlign: 'center',
        color: '#6b7280'
      }}>
        Select a stock to view options chain
      </div>
    );
  }

  return (
    <div style={{ background: '#0d1117', borderRadius: 12, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid #1f2937',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <div style={{
            fontSize: 18,
            fontWeight: 'bold',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            {symbol}
            <span style={{
              fontSize: 12,
              padding: '2px 8px',
              borderRadius: 4,
              background: tierInfo.color + '20',
              color: tierInfo.color
            }}>
              {tierInfo.label}
            </span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: '#00d9ff', marginTop: 4 }}>
            ${currentPrice.toFixed(2)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Expiry</div>
          <div style={{ fontSize: 16, fontWeight: '600', color: 'white' }}>
            {STONK_OPTIONS_CONFIG.expiryOptions.find(e => e.days === selectedExpiry)?.label || `${selectedExpiry} Days`}
          </div>
        </div>
      </div>

      {/* View Toggle */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid #1f2937'
      }}>
        {['all', 'calls', 'puts'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: '12px',
              background: activeTab === tab ? '#1a1f2e' : 'transparent',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid #00d9ff' : '2px solid transparent',
              color: activeTab === tab ? '#00d9ff' : '#6b7280',
              fontWeight: '600',
              cursor: 'pointer',
              textTransform: 'uppercase',
              fontSize: 13
            }}
          >
            {tab === 'all' ? 'All' : tab}
          </button>
        ))}
      </div>

      {/* Chain Header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: activeTab === 'all' ? '1fr auto 1fr' : '1fr',
        background: '#161b22',
        padding: '8px 12px',
        fontSize: 11,
        fontWeight: '600',
        color: '#6b7280',
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
      }}>
        {(activeTab === 'all' || activeTab === 'calls') && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
            textAlign: 'center',
            color: '#10b981'
          }}>
            <span>Payout</span>
            <span>Premium</span>
          </div>
        )}

        {activeTab === 'all' && (
          <div style={{ textAlign: 'center', padding: '0 16px', color: '#9ca3af' }}>
            Strike
          </div>
        )}

        {(activeTab === 'all' || activeTab === 'puts') && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
            textAlign: 'center',
            color: '#ef4444'
          }}>
            <span>Premium</span>
            <span>Payout</span>
          </div>
        )}
      </div>

      {/* Options Rows */}
      <div style={{ maxHeight: 400, overflowY: 'auto' }}>
        {activeTab === 'all' && strikes.all.map((row, idx) => (
          <div
            key={idx}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto 1fr',
              borderBottom: '1px solid #1f2937'
            }}
          >
            {/* Call Side */}
            <button
              onClick={() => handleSelect(row.call.strike, 'call')}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
                padding: '14px 12px',
                background: isSelected(row.call.strike, 'call')
                  ? '#10b98130'
                  : 'transparent',
                border: 'none',
                cursor: 'pointer',
                transition: 'background 0.15s'
              }}
              onMouseEnter={(e) => {
                if (!isSelected(row.call.strike, 'call')) {
                  e.currentTarget.style.background = '#10b98115';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected(row.call.strike, 'call')) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <span style={{
                color: '#10b981',
                fontWeight: '600',
                fontSize: 15
              }}>
                {row.call.payoutMultiplier.toFixed(1)}x
              </span>
              <span style={{
                color: '#9ca3af',
                fontSize: 14
              }}>
                {row.call.premiumPercent}%
              </span>
            </button>

            {/* Strike Price Center */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 12px',
              minWidth: 90,
              background: '#161b22',
              borderLeft: '1px solid #1f2937',
              borderRight: '1px solid #1f2937'
            }}>
              <span style={{
                color: 'white',
                fontWeight: 'bold',
                fontSize: 14
              }}>
                ${row.strikeCall.toFixed(0)}
              </span>
              <span style={{
                color: '#6b7280',
                fontSize: 11
              }}>
                +{row.distancePercent.toFixed(1)}%
              </span>
            </div>

            {/* Put Side */}
            <button
              onClick={() => handleSelect(row.put.strike, 'put')}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
                padding: '14px 12px',
                background: isSelected(row.put.strike, 'put')
                  ? '#ef444430'
                  : 'transparent',
                border: 'none',
                cursor: 'pointer',
                transition: 'background 0.15s'
              }}
              onMouseEnter={(e) => {
                if (!isSelected(row.put.strike, 'put')) {
                  e.currentTarget.style.background = '#ef444415';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected(row.put.strike, 'put')) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <span style={{
                color: '#9ca3af',
                fontSize: 14
              }}>
                {row.put.premiumPercent}%
              </span>
              <span style={{
                color: '#ef4444',
                fontWeight: '600',
                fontSize: 15
              }}>
                {row.put.payoutMultiplier.toFixed(1)}x
              </span>
            </button>
          </div>
        ))}

        {/* Single column view for calls only */}
        {activeTab === 'calls' && strikes.calls.map((call, idx) => (
          <button
            key={idx}
            onClick={() => handleSelect(call.strike, 'call')}
            style={{
              width: '100%',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr 1fr',
              gap: 8,
              padding: '14px 16px',
              background: isSelected(call.strike, 'call') ? '#10b98130' : 'transparent',
              border: 'none',
              borderBottom: '1px solid #1f2937',
              cursor: 'pointer',
              textAlign: 'center'
            }}
          >
            <span style={{ color: 'white', fontWeight: 'bold' }}>${call.strike.toFixed(0)}</span>
            <span style={{ color: '#6b7280' }}>+{call.distancePercent.toFixed(1)}%</span>
            <span style={{ color: '#9ca3af' }}>{call.premiumPercent}%</span>
            <span style={{ color: '#10b981', fontWeight: '600' }}>{call.payoutMultiplier.toFixed(1)}x</span>
          </button>
        ))}

        {/* Single column view for puts only */}
        {activeTab === 'puts' && strikes.puts.map((put, idx) => (
          <button
            key={idx}
            onClick={() => handleSelect(put.strike, 'put')}
            style={{
              width: '100%',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr 1fr',
              gap: 8,
              padding: '14px 16px',
              background: isSelected(put.strike, 'put') ? '#ef444430' : 'transparent',
              border: 'none',
              borderBottom: '1px solid #1f2937',
              cursor: 'pointer',
              textAlign: 'center'
            }}
          >
            <span style={{ color: 'white', fontWeight: 'bold' }}>${put.strike.toFixed(0)}</span>
            <span style={{ color: '#6b7280' }}>-{put.distancePercent.toFixed(1)}%</span>
            <span style={{ color: '#9ca3af' }}>{put.premiumPercent}%</span>
            <span style={{ color: '#ef4444', fontWeight: '600' }}>{put.payoutMultiplier.toFixed(1)}x</span>
          </button>
        ))}
      </div>

      {/* Legend */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid #1f2937',
        display: 'flex',
        justifyContent: 'center',
        gap: 24,
        fontSize: 11,
        color: '#6b7280'
      }}>
        <span><span style={{ color: '#10b981' }}>●</span> Calls (Bullish)</span>
        <span><span style={{ color: '#ef4444' }}>●</span> Puts (Bearish)</span>
      </div>
    </div>
  );
};

export default StonkOptionsChain;
