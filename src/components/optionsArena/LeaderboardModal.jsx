/**
 * LeaderboardModal
 * Modal displaying tournament leaderboard with rankings and real-time updates
 */

import React, { useEffect } from 'react';

const LeaderboardModal = ({
  isOpen,
  onClose,
  leaderboard,
  currentUserId,
  tournament
}) => {
  // Add CSS animations for rank changes
  useEffect(() => {
    if (!document.getElementById('leaderboard-animations')) {
      const style = document.createElement('style');
      style.id = 'leaderboard-animations';
      style.textContent = `
        @keyframes leaderboardFadeIn {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes leaderboardSlideIn {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes leaderboardPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes leaderboardGlow {
          0%, 100% { box-shadow: 0 0 5px rgba(0, 217, 255, 0.3); }
          50% { box-shadow: 0 0 15px rgba(0, 217, 255, 0.5); }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  if (!isOpen || !leaderboard) return null;

  const isLive = tournament?.status === 'in_progress';

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h3 style={{ margin: 0, color: '#fff', fontSize: '18px' }}>
              Leaderboard
            </h3>

            {/* LIVE indicator for active tournaments */}
            {isLive && (
              <span style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(16, 185, 129, 0.2)',
                border: '1px solid #10b981',
                borderRadius: '12px',
                padding: '4px 10px',
                fontSize: '11px',
                color: '#10b981',
                fontWeight: '600'
              }}>
                <span style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#10b981',
                  animation: 'leaderboardPulse 2s infinite'
                }} />
                LIVE
              </span>
            )}
          </div>
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
              const hasRankChange = entry.rankChange !== 0;
              const isNewEntry = entry.isNew;

              return (
                <div
                  key={entry.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px',
                    background: isUser
                      ? 'rgba(0, 217, 255, 0.1)'
                      : hasRankChange || isNewEntry
                        ? 'rgba(0, 217, 255, 0.05)'
                        : '#1a1a2e',
                    borderRadius: '8px',
                    marginBottom: '8px',
                    border: isUser
                      ? '1px solid rgba(0, 217, 255, 0.3)'
                      : '1px solid transparent',
                    transition: 'all 0.3s ease',
                    animation: isNewEntry ? 'leaderboardSlideIn 0.3s ease-out' : 'none'
                  }}
                >
                  {/* Rank with change indicator */}
                  <div style={{
                    minWidth: '55px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <span style={{
                      fontWeight: '700',
                      fontSize: '16px',
                      color: rank <= 3 ? '#fbbf24' : '#6b7280',
                      minWidth: '32px'
                    }}>
                      {rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : `#${rank}`}
                    </span>

                    {/* Rank change indicator */}
                    {entry.rankChange > 0 && (
                      <span style={{
                        color: '#10b981',
                        fontSize: '11px',
                        fontWeight: '600',
                        animation: 'leaderboardFadeIn 0.3s ease-in',
                        display: 'flex',
                        alignItems: 'center'
                      }}>
                        ▲{entry.rankChange}
                      </span>
                    )}
                    {entry.rankChange < 0 && (
                      <span style={{
                        color: '#ef4444',
                        fontSize: '11px',
                        fontWeight: '600',
                        animation: 'leaderboardFadeIn 0.3s ease-in',
                        display: 'flex',
                        alignItems: 'center'
                      }}>
                        ▼{Math.abs(entry.rankChange)}
                      </span>
                    )}
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
                      {isNewEntry && (
                        <span style={{
                          fontSize: '10px',
                          background: 'rgba(0, 217, 255, 0.2)',
                          color: '#00d9ff',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          animation: 'leaderboardFadeIn 0.3s ease-in'
                        }}>
                          NEW
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
