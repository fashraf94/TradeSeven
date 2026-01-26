/**
 * TournamentHeader
 * Displays tournament status, countdown timers, and entry stats
 */

import React from 'react';

const TournamentHeader = ({
  tournament,
  onShowLeaderboard
}) => {
  if (!tournament?.tournament) return null;

  const { tournament: t, timeUntilLock, timeUntilEnd, userEntries, canEnter } = tournament;

  const formatTime = (ms) => {
    if (!ms || ms <= 0) return 'Closed';
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
    return `${hours}h ${minutes}m`;
  };

  const statusColors = {
    open: '#10b981',
    in_progress: '#00d9ff',
    completed: '#6b7280'
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1a1a2e 0%, #12121a 100%)',
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '16px',
      border: '1px solid #2d3748'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px'
      }}>
        <div>
          <h2 style={{
            fontSize: '18px',
            fontWeight: '700',
            color: '#fff',
            margin: 0
          }}>
            🏆 {t.name}
          </h2>
          <span style={{
            fontSize: '12px',
            fontWeight: '600',
            color: statusColors[t.status] || '#fff',
            textTransform: 'uppercase'
          }}>
            {t.status.replace('_', ' ')}
          </span>
        </div>

        <div style={{ textAlign: 'right' }}>
          {t.status === 'open' && (
            <>
              <div style={{ fontSize: '11px', color: '#9ca3af' }}>Lock Deadline</div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#f59e0b' }}>
                {formatTime(timeUntilLock)}
              </div>
            </>
          )}
          {t.status === 'in_progress' && (
            <>
              <div style={{ fontSize: '11px', color: '#9ca3af' }}>Ends In</div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#00d9ff' }}>
                {formatTime(timeUntilEnd)}
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{
        display: 'flex',
        gap: '12px',
        flexWrap: 'wrap'
      }}>
        <div style={{
          flex: 1,
          minWidth: '120px',
          background: '#0d0d12',
          borderRadius: '8px',
          padding: '10px'
        }}>
          <div style={{ fontSize: '11px', color: '#9ca3af' }}>Your Entries</div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#fff' }}>
            {userEntries.length}/3
          </div>
        </div>

        <div style={{
          flex: 1,
          minWidth: '120px',
          background: '#0d0d12',
          borderRadius: '8px',
          padding: '10px'
        }}>
          <div style={{ fontSize: '11px', color: '#9ca3af' }}>Participants</div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#fff' }}>
            {t.entryCount || 0}
          </div>
        </div>

        <button
          onClick={onShowLeaderboard}
          style={{
            flex: 1,
            minWidth: '120px',
            background: 'linear-gradient(135deg, #00d9ff 0%, #0066ff 100%)',
            border: 'none',
            borderRadius: '8px',
            padding: '10px',
            cursor: 'pointer',
            color: '#fff',
            fontWeight: '600',
            fontSize: '14px'
          }}
        >
          View Leaderboard
        </button>
      </div>

      {canEnter.canEnter && t.status === 'open' && (
        <div style={{
          marginTop: '12px',
          padding: '8px',
          background: 'rgba(16, 185, 129, 0.1)',
          borderRadius: '8px',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          textAlign: 'center'
        }}>
          <span style={{ fontSize: '12px', color: '#10b981' }}>
            ✨ Build your portfolio below and submit to compete!
          </span>
        </div>
      )}
    </div>
  );
};

export default TournamentHeader;
