import React, { useState, useEffect } from 'react';

function formatTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 5) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

function formatNextOpen(nextOpenTime) {
  if (!nextOpenTime) return '';
  const now = new Date();
  const diff = nextOpenTime.getTime() - now.getTime();
  if (diff <= 0) return 'Opening soon';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `Opens in ${days}d`;
  }
  if (hours > 0) return `Opens in ${hours}h ${minutes}m`;
  return `Opens in ${minutes}m`;
}

export default function WatchlistFooter({
  wsStatus,
  symbolCount,
  marketState,
  lastUpdateTime,
  isWsEnabled,
}) {
  const [, setTick] = useState(0);

  // Tick every second for "Updated Xs ago" display
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Connection status
  let statusDot, statusText, statusColor;
  if (marketState?.isOpen && isWsEnabled) {
    if (wsStatus === 'connected') {
      statusDot = '#10b981';
      statusText = 'LIVE';
      statusColor = '#10b981';
    } else {
      statusDot = '#f59e0b';
      statusText = 'DELAYED';
      statusColor = '#f59e0b';
    }
  } else {
    statusDot = '#6e7681';
    statusText = 'CLOSED';
    statusColor = '#6e7681';
  }

  const isPulsing = marketState?.isOpen && wsStatus === 'connected' && isWsEnabled;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 12px',
      borderTop: '1px solid #21262d',
      fontSize: '10px',
      color: '#6e7681',
    }}>
      {/* Left: connection status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <span style={{
          display: 'inline-block',
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: statusDot,
          animation: isPulsing ? 'watchlist-pulse 2s infinite' : 'none',
        }} />
        <style>{`
          @keyframes watchlist-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
        `}</style>
        <span style={{ color: statusColor, fontWeight: 600, letterSpacing: '0.05em' }}>
          {statusText}
        </span>
        {!marketState?.isOpen && marketState?.nextOpenTime && (
          <span style={{ marginLeft: '4px' }}>
            {'\u00B7'} {formatNextOpen(marketState.nextOpenTime)}
          </span>
        )}
      </div>

      {/* Center: symbol count */}
      <div>
        {symbolCount} symbol{symbolCount !== 1 ? 's' : ''}
      </div>

      {/* Right: last update */}
      <div>
        Updated {formatTimeAgo(lastUpdateTime)}
      </div>
    </div>
  );
}
