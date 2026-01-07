/**
 * Expiry Selector
 * Horizontal tabs for selecting option expiry
 */

import React from 'react';
import { STONK_OPTIONS_CONFIG } from '../services/stonkOptionsEngineV2';

const StonkOptionsExpirySelector = ({
  selectedExpiry,
  onSelectExpiry
}) => {
  return (
    <div style={{
      display: 'flex',
      gap: 8,
      padding: '12px 16px',
      background: '#0d1117',
      borderRadius: 12,
      marginBottom: 16
    }}>
      {STONK_OPTIONS_CONFIG.expiryOptions.map(expiry => {
        const isSelected = selectedExpiry === expiry.days;
        return (
          <button
            key={expiry.days}
            onClick={() => onSelectExpiry(expiry.days)}
            style={{
              flex: 1,
              padding: '12px 8px',
              background: isSelected
                ? 'linear-gradient(135deg, #00d9ff 0%, #0066ff 100%)'
                : '#1a1f2e',
              border: isSelected ? 'none' : '1px solid #2d3748',
              borderRadius: 8,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <div style={{
              color: isSelected ? 'white' : '#9ca3af',
              fontWeight: '600',
              fontSize: 16
            }}>
              {expiry.shortLabel}
            </div>
            <div style={{
              color: isSelected ? 'rgba(255,255,255,0.8)' : '#6b7280',
              fontSize: 11,
              marginTop: 2
            }}>
              {expiry.label}
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default StonkOptionsExpirySelector;
