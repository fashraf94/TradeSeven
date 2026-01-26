/**
 * PriceFreshnessIndicator
 * Shows price update status with staleness warnings and manual refresh capability
 */

import React from 'react';

const PriceFreshnessIndicator = ({
  priceStatus,
  onRefresh,
  isRefreshing = false,
  lastManualRefresh = 0
}) => {
  const { lastUpdate, isStale, usingFallback, failedSymbols = [] } = priceStatus || {};

  // Determine status color and message
  let statusColor, bgColor, borderColor, message, icon;

  if (usingFallback && failedSymbols.length > 0) {
    statusColor = '#fca5a5'; // Light red
    bgColor = 'rgba(239, 68, 68, 0.1)';
    borderColor = '#ef4444';
    icon = '⚠️';
    message = `Using estimated prices for ${failedSymbols.length} symbol${failedSymbols.length > 1 ? 's' : ''} - API unavailable`;
  } else if (isStale) {
    statusColor = '#fcd34d'; // Light yellow
    bgColor = 'rgba(245, 158, 11, 0.1)';
    borderColor = '#f59e0b';
    icon = '⏳';
    message = 'Prices may be outdated';
  } else if (lastUpdate) {
    statusColor = '#6b7280'; // Gray
    bgColor = 'rgba(16, 185, 129, 0.05)';
    borderColor = '#2d3748';
    icon = '✓';
    message = `Prices as of ${lastUpdate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short'
    })}`;
  } else {
    statusColor = '#6b7280';
    bgColor = 'transparent';
    borderColor = '#2d3748';
    icon = '○';
    message = 'Loading prices...';
  }

  const canRefresh = !isRefreshing && (Date.now() - lastManualRefresh >= 30000);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      padding: '8px 12px',
      background: bgColor,
      border: `1px solid ${borderColor}`,
      borderRadius: '8px',
      fontSize: '12px',
      marginBottom: '12px'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        color: statusColor
      }}>
        <span>{icon}</span>
        <span>{message}</span>
      </div>

      <button
        onClick={onRefresh}
        disabled={!canRefresh}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          background: 'transparent',
          border: '1px solid #3d4852',
          borderRadius: '6px',
          padding: '4px 10px',
          color: canRefresh ? '#9ca3af' : '#4b5563',
          cursor: canRefresh ? 'pointer' : 'not-allowed',
          opacity: canRefresh ? 1 : 0.5,
          fontSize: '11px',
          transition: 'all 0.2s ease'
        }}
      >
        <span style={{
          display: 'inline-block',
          animation: isRefreshing ? 'spin 1s linear infinite' : 'none'
        }}>
          ↻
        </span>
        {isRefreshing ? 'Refreshing...' : 'Refresh'}
      </button>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default PriceFreshnessIndicator;
