import React from 'react';
import { HOLO_COLORS, GLOW_EFFECTS } from '../../constants/holoTheme';

/**
 * WaiverPriorityBar - Shows all 4 players' waiver positions
 *
 * Lowest daily scorer gets first pick (index 0).
 * Current user's badge is highlighted with green glow.
 */
const WaiverPriorityBar = ({ waiverPriority, players, currentUserId }) => {
  if (!waiverPriority || waiverPriority.length === 0) {
    return (
      <div style={{
        padding: '10px 14px',
        background: HOLO_COLORS.bgCard,
        border: `1px solid ${HOLO_COLORS.textMuted}33`,
        borderRadius: '8px',
      }}>
        <div style={{
          fontSize: '11px',
          fontWeight: 700,
          color: HOLO_COLORS.textMuted,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: '4px',
        }}>
          Waiver Priority
        </div>
        <div style={{
          fontSize: '12px',
          color: HOLO_COLORS.textSecondary,
        }}>
          Priority not yet determined
        </div>
      </div>
    );
  }

  // Resolve player names from odUserIds
  const getPlayerName = (odUserId) => {
    const player = (players || []).find(p => p.odUserId === odUserId);
    if (!player) return 'Unknown';
    if (odUserId === currentUserId) return 'You';
    return player.displayName || player.odUsername || 'Player';
  };

  const userPosition = waiverPriority.indexOf(currentUserId);
  const userPickNumber = userPosition >= 0 ? userPosition + 1 : null;

  return (
    <div style={{
      padding: '10px 14px',
      background: HOLO_COLORS.bgCard,
      border: `1px solid ${HOLO_COLORS.greenMuted}33`,
      borderRadius: '8px',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '8px',
      }}>
        <span style={{
          fontSize: '11px',
          fontWeight: 700,
          color: HOLO_COLORS.textMuted,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          Waiver Priority
        </span>
        {userPickNumber && (
          <span style={{
            fontSize: '11px',
            fontWeight: 700,
            color: HOLO_COLORS.greenMuted,
          }}>
            You pick #{userPickNumber}
          </span>
        )}
      </div>

      {/* Player badges */}
      <div style={{
        display: 'flex',
        gap: '6px',
      }}>
        {waiverPriority.map((odUserId, index) => {
          const isCurrentUser = odUserId === currentUserId;
          const name = getPlayerName(odUserId);
          const truncatedName = name.length > 8 ? name.substring(0, 7) + '…' : name;

          return (
            <div
              key={odUserId}
              style={{
                flex: 1,
                padding: '6px 8px',
                background: isCurrentUser
                  ? `${HOLO_COLORS.greenMuted}18`
                  : `${HOLO_COLORS.textMuted}0a`,
                border: `1px solid ${isCurrentUser ? HOLO_COLORS.greenMuted : HOLO_COLORS.textMuted}44`,
                borderRadius: '6px',
                textAlign: 'center',
                ...(isCurrentUser ? {
                  boxShadow: `0 0 8px ${HOLO_COLORS.greenMuted}33`,
                } : {}),
              }}
            >
              <div style={{
                fontSize: '10px',
                fontWeight: 700,
                color: isCurrentUser ? HOLO_COLORS.greenMuted : HOLO_COLORS.amber,
              }}>
                #{index + 1}
              </div>
              <div style={{
                fontSize: '11px',
                fontWeight: isCurrentUser ? 700 : 500,
                color: isCurrentUser ? HOLO_COLORS.textPrimary : HOLO_COLORS.textSecondary,
                marginTop: '2px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {truncatedName}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WaiverPriorityBar;
