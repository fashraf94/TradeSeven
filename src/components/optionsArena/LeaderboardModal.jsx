/**
 * LeaderboardModal
 * Modal displaying tournament leaderboard with rankings
 */

import React from 'react';

const LeaderboardModal = ({
  isOpen,
  onClose,
  leaderboard,
  currentUserId
}) => {
  if (!isOpen || !leaderboard) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        background: '#12121a',
        borderRadius: '16px',
        maxWidth: '500px',
        width: '100%',
        maxHeight: '80vh',
        overflow: 'hidden',
        border: '1px solid #2d3748'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px',
          borderBottom: '1px solid #2d3748'
        }}>
          <h3 style={{ margin: 0, color: '#fff', fontSize: '18px' }}>
            🏆 Leaderboard
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#9ca3af',
              fontSize: '24px',
              cursor: 'pointer'
            }}
          >
            ×
          </button>
        </div>

        <div style={{
          overflowY: 'auto',
          maxHeight: 'calc(80vh - 60px)',
          padding: '8px'
        }}>
          {leaderboard.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: '#6b7280'
            }}>
              No entries yet. Be the first!
            </div>
          ) : (
            leaderboard.map((entry, index) => {
              const isUser = entry.odUserId === currentUserId;
              const rank = entry.rank || index + 1;

              return (
                <div
                  key={entry.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px',
                    background: isUser ? 'rgba(0, 217, 255, 0.1)' : '#1a1a2e',
                    borderRadius: '8px',
                    marginBottom: '8px',
                    border: isUser ? '1px solid rgba(0, 217, 255, 0.3)' : '1px solid transparent'
                  }}
                >
                  <div style={{
                    width: '32px',
                    fontWeight: '700',
                    fontSize: '16px',
                    color: rank <= 3 ? '#fbbf24' : '#6b7280'
                  }}>
                    {rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : `#${rank}`}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <span style={{ color: '#fff', fontWeight: '600' }}>
                        {entry.username}
                      </span>
                      {entry.isBot && (
                        <span style={{
                          fontSize: '10px',
                          background: '#7c3aed',
                          color: '#fff',
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}>
                          BOT
                        </span>
                      )}
                      {isUser && (
                        <span style={{
                          fontSize: '10px',
                          background: '#00d9ff',
                          color: '#000',
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}>
                          YOU
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>
                      {entry.contractCount} contracts
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    {entry.totalValue !== null ? (
                      <>
                        <div style={{
                          fontWeight: '700',
                          color: entry.percentReturn >= 0 ? '#10b981' : '#ef4444'
                        }}>
                          {entry.percentReturn >= 0 ? '+' : ''}{entry.percentReturn?.toFixed(2)}%
                        </div>
                        <div style={{ fontSize: '11px', color: '#6b7280' }}>
                          ${entry.totalValue?.toLocaleString()}
                        </div>
                      </>
                    ) : (
                      <span style={{ color: '#6b7280', fontSize: '12px' }}>
                        Pending
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default LeaderboardModal;
