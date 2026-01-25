/**
 * Expiry Selector
 * Horizontal tabs for selecting option expiry
 * Supports tournament mode with tier requirements
 */

import React from 'react';
import { STONK_OPTIONS_CONFIG, EXPIRY_TIERS } from '../services/stonkOptionsEngineV2';

const StonkOptionsExpirySelector = ({
  selectedExpiry,
  onSelectExpiry,
  tournamentMode = false,
  tierCounts = null  // { short: 0, medium: 0, long: 0 }
}) => {
  const expiries = STONK_OPTIONS_CONFIG.expiryOptions;

  // Group by tier
  const shortTerm = expiries.filter(e => [1, 3].includes(e.days));
  const mediumTerm = expiries.filter(e => e.days === 7);
  const longTerm = expiries.filter(e => [14, 21, 28].includes(e.days));

  const renderTierSection = (tierExpiries, tierKey, tierLabel, minRequired) => {
    const count = tierCounts?.[tierKey] || 0;
    const isMet = count >= minRequired;

    return (
      <div style={{ marginBottom: '12px' }}>
        {tournamentMode && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '6px',
            padding: '0 4px'
          }}>
            <span style={{
              fontSize: '11px',
              color: '#9ca3af',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              {tierLabel}
            </span>
            <span style={{
              fontSize: '11px',
              fontWeight: '600',
              color: isMet ? '#10b981' : '#f59e0b'
            }}>
              {count}/{minRequired} {isMet ? '✓' : 'needed'}
            </span>
          </div>
        )}

        <div style={{
          display: 'flex',
          gap: '8px'
        }}>
          {tierExpiries.map(expiry => {
            const isSelected = selectedExpiry === expiry.days;
            return (
              <button
                key={expiry.days}
                onClick={() => onSelectExpiry(expiry.days)}
                style={{
                  flex: 1,
                  padding: '10px 8px',
                  borderRadius: '8px',
                  border: isSelected
                    ? '2px solid #00d9ff'
                    : '1px solid #2d3748',
                  background: isSelected
                    ? 'linear-gradient(135deg, rgba(0, 217, 255, 0.2) 0%, rgba(0, 102, 255, 0.2) 100%)'
                    : '#1a1f2e',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{
                  fontSize: '14px',
                  fontWeight: '700',
                  color: isSelected ? '#00d9ff' : '#e5e7eb'
                }}>
                  {expiry.shortLabel}
                </div>
                <div style={{
                  fontSize: '10px',
                  color: '#9ca3af',
                  marginTop: '2px'
                }}>
                  {expiry.label}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={{
      background: '#12121a',
      borderRadius: '12px',
      padding: '16px',
      border: '1px solid #2d3748'
    }}>
      {tournamentMode && (
        <div style={{
          textAlign: 'center',
          marginBottom: '16px',
          padding: '8px',
          background: 'rgba(0, 217, 255, 0.1)',
          borderRadius: '8px',
          border: '1px solid rgba(0, 217, 255, 0.2)'
        }}>
          <span style={{ fontSize: '12px', color: '#00d9ff' }}>
            🏆 Tournament Mode: Meet tier requirements to submit
          </span>
        </div>
      )}

      {renderTierSection(shortTerm, 'short', 'Short-term', EXPIRY_TIERS.short.minRequired)}
      {renderTierSection(mediumTerm, 'medium', 'Medium-term', EXPIRY_TIERS.medium.minRequired)}
      {renderTierSection(longTerm, 'long', 'Long-term', EXPIRY_TIERS.long.minRequired)}
    </div>
  );
};

export default StonkOptionsExpirySelector;
