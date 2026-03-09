import React from 'react';
import { HOLO_COLORS, CATEGORY_CONFIG } from '../../constants/holoTheme';

/**
 * ClaimCard - Displays a single waiver claim with status
 *
 * Shows: rank badge, drop → add symbols, category, status, cancel button
 */
const ClaimCard = ({ claim, isWindowOpen, onCancel }) => {
  const categoryConfig = CATEGORY_CONFIG[claim.category] || CATEGORY_CONFIG.steady;

  const statusColors = {
    pending: HOLO_COLORS.amber,
    approved: HOLO_COLORS.greenMuted,
    denied: HOLO_COLORS.red,
    cancelled: HOLO_COLORS.textMuted,
  };

  const statusLabels = {
    pending: 'Pending',
    approved: 'Approved',
    denied: 'Denied',
    cancelled: 'Cancelled',
  };

  const denialReasons = {
    claimed_by_higher_priority: 'Higher priority player claimed this asset',
    drop_not_on_roster: 'Drop asset was no longer on your roster',
    player_not_found: 'Player not found in draft',
  };

  const statusColor = statusColors[claim.status] || HOLO_COLORS.textMuted;
  const canCancel = isWindowOpen && claim.status === 'pending';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px 14px',
      background: HOLO_COLORS.bgCard,
      border: `1px solid ${statusColor}33`,
      borderRadius: '10px',
      position: 'relative',
    }}>
      {/* Rank badge */}
      <div style={{
        width: '28px',
        height: '28px',
        borderRadius: '50%',
        background: `${HOLO_COLORS.amber}22`,
        border: `1px solid ${HOLO_COLORS.amber}66`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '12px',
        fontWeight: 700,
        color: HOLO_COLORS.amber,
        flexShrink: 0,
      }}>
        #{claim.rank}
      </div>

      {/* Drop → Add */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontSize: '14px',
            fontWeight: 700,
            color: HOLO_COLORS.red,
          }}>
            {claim.dropSymbol}
          </span>
          <span style={{
            fontSize: '12px',
            color: HOLO_COLORS.textMuted,
          }}>
            →
          </span>
          <span style={{
            fontSize: '14px',
            fontWeight: 700,
            color: HOLO_COLORS.greenMuted,
          }}>
            {claim.addSymbol}
          </span>

          {/* Category badge */}
          <span style={{
            fontSize: '9px',
            fontWeight: 700,
            color: categoryConfig.color,
            background: `${categoryConfig.color}18`,
            border: `1px solid ${categoryConfig.color}44`,
            borderRadius: '4px',
            padding: '2px 6px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            {categoryConfig.letter}
          </span>
        </div>

        {/* Status line */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginTop: '4px',
        }}>
          {/* Status dot */}
          <div style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: statusColor,
            ...(claim.status === 'pending' ? {
              animation: 'claimPulse 2s ease-in-out infinite',
            } : {}),
          }} />

          <span style={{
            fontSize: '11px',
            color: statusColor,
            fontWeight: 600,
          }}>
            {statusLabels[claim.status]}
          </span>

          {/* Denial reason */}
          {claim.status === 'denied' && claim.denialReason && (
            <span style={{
              fontSize: '10px',
              color: HOLO_COLORS.textMuted,
            }}>
              — {denialReasons[claim.denialReason] || claim.denialReason}
            </span>
          )}
        </div>
      </div>

      {/* Cancel button */}
      {canCancel && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCancel(claim.id);
          }}
          style={{
            padding: '6px 10px',
            background: `${HOLO_COLORS.red}18`,
            border: `1px solid ${HOLO_COLORS.red}44`,
            borderRadius: '6px',
            color: HOLO_COLORS.red,
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          Cancel
        </button>
      )}

      <style>{`
        @keyframes claimPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
};

export default ClaimCard;
