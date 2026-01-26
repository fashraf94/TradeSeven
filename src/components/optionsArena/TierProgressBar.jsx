/**
 * TierProgressBar
 * Displays tournament portfolio tier requirements progress
 */

import React from 'react';

const TierProgressBar = ({
  tournamentMode,
  showTierProgress,
  tierCounts,
  totalContracts
}) => {
  if (!tournamentMode || !showTierProgress) return null;

  // Each tier has exact count required (min = max)
  const tiers = [
    { key: 'short', label: 'Short (1-3D)', max: 2, count: tierCounts.short, color: '#ef4444' },
    { key: 'medium', label: 'Medium (7D)', max: 3, count: tierCounts.medium, color: '#f59e0b' },
    { key: 'long', label: 'Long (14-28D)', max: 2, count: tierCounts.long, color: '#10b981' }
  ];

  const allComplete = tiers.every(t => t.count === t.max);

  return (
    <div style={{
      background: allComplete ? 'rgba(16, 185, 129, 0.1)' : '#12121a',
      borderRadius: '8px',
      padding: '12px',
      marginBottom: '12px',
      border: allComplete ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #2d3748'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '8px'
      }}>
        <span style={{ fontSize: '12px', fontWeight: '600', color: '#fff' }}>
          📊 Portfolio Requirements
        </span>
        <span style={{
          fontSize: '11px',
          fontWeight: '600',
          color: allComplete ? '#10b981' : '#f59e0b'
        }}>
          {totalContracts}/7 {allComplete ? '✓ Ready!' : 'contracts'}
        </span>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        {tiers.map(tier => {
          const isComplete = tier.count === tier.max;
          return (
            <div key={tier.key} style={{ flex: 1 }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '10px',
                marginBottom: '4px'
              }}>
                <span style={{ color: '#9ca3af' }}>{tier.label}</span>
                <span style={{
                  color: isComplete ? '#10b981' : '#fff',
                  fontWeight: '600'
                }}>
                  {tier.count}/{tier.max} {isComplete ? '✓' : ''}
                </span>
              </div>
              <div style={{
                height: '4px',
                background: '#2d3748',
                borderRadius: '2px',
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(100, (tier.count / tier.max) * 100)}%`,
                  background: isComplete ? '#10b981' : tier.color,
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TierProgressBar;
