import React from 'react';
import { HOLO_COLORS } from '../../../constants/holoTheme';

/**
 * SwapHistory - Shows recent swaps from all players
 *
 * Features:
 * - Shows last 5 swaps
 * - Highlights current user's swaps
 * - Relative time formatting
 */
const SwapHistory = ({ history, currentUserId }) => {
  if (!history || history.length === 0) {
    return null;
  }

  // Show last 5 swaps
  const recentSwaps = history.slice(0, 5);

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <div style={{ marginTop: '20px' }}>
      {/* Header */}
      <div style={{
        fontSize: '11px',
        fontWeight: 700,
        color: HOLO_COLORS.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: '1px',
        marginBottom: '10px',
      }}>
        Recent Swaps
      </div>

      {/* Swap List */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}>
        {recentSwaps.map((swap, idx) => {
          const isMe = swap.odUserId === currentUserId;

          return (
            <div
              key={`${swap.timestamp}-${idx}`}
              style={{
                padding: '10px 12px',
                background: isMe ? 'rgba(0, 255, 255, 0.05)' : HOLO_COLORS.bgCard,
                border: `1px solid ${isMe ? HOLO_COLORS.cyan + '33' : HOLO_COLORS.borderSubtle}`,
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              {/* Player indicator */}
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: isMe ? HOLO_COLORS.cyan + '22' : HOLO_COLORS.bgElevated,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                color: isMe ? HOLO_COLORS.cyan : HOLO_COLORS.textMuted,
                fontWeight: 600,
              }}>
                {isMe ? 'You' : swap.displayName?.charAt(0) || '?'}
              </div>

              {/* Swap info */}
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '12px',
                  color: HOLO_COLORS.textPrimary,
                }}>
                  <span style={{ color: isMe ? HOLO_COLORS.cyan : HOLO_COLORS.textSecondary }}>
                    {isMe ? 'You' : swap.displayName}
                  </span>
                  {' dropped '}
                  <span style={{ color: HOLO_COLORS.red, fontWeight: 600 }}>
                    {swap.droppedAsset?.symbol}
                  </span>
                  {' for '}
                  <span style={{ color: HOLO_COLORS.green, fontWeight: 600 }}>
                    {swap.addedAsset?.symbol}
                  </span>
                </div>
                <div style={{
                  fontSize: '10px',
                  color: HOLO_COLORS.textMuted,
                  marginTop: '2px',
                }}>
                  {formatTime(swap.timestamp)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SwapHistory;
