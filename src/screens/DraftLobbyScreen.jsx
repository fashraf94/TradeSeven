import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { getLobbyExpirationStatus, isLobbyFull, LOBBY_CONFIG } from '../utils/lobbyUtils';

// Style override to neutralize App.css
const containerStyle = {
  maxWidth: '100vw',
  width: '100%',
  margin: 0,
  padding: 0,
  textAlign: 'left',
  minHeight: '100vh',
  background: '#0d1117',
  overflowX: 'hidden'
};

// Helper to format countdown time
const getTimeUntilStart = (scheduledStart) => {
  if (!scheduledStart) return null;
  const start = new Date(scheduledStart);
  const now = new Date();
  const diffMs = start - now;

  if (diffMs <= 0) return 'Starting now!';

  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m`;

  const diffHours = Math.floor(diffMins / 60);
  const remainingMins = diffMins % 60;
  if (remainingMins === 0) return `${diffHours}h`;
  return `${diffHours}h ${remainingMins}m`;
};

const DraftLobbyScreen = ({
  user,
  currentDraft,
  draftState,
  onBack,
  onStartDraft,
  onLeaveLobby
}) => {
  const [draftCopied, setDraftCopied] = useState(false);
  const [countdown, setCountdown] = useState('');
  const [expirationStatus, setExpirationStatus] = useState(null);

  const lobbyDraft = draftState || currentDraft;

  // Update countdown every minute
  useEffect(() => {
    if (!lobbyDraft?.scheduledStart) return;

    const updateCountdown = () => {
      setCountdown(getTimeUntilStart(lobbyDraft.scheduledStart));
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000);
    return () => clearInterval(interval);
  }, [lobbyDraft?.scheduledStart]);

  // Update expiration status every 10 seconds (for real-time warning)
  useEffect(() => {
    if (!lobbyDraft) return;

    const updateExpirationStatus = () => {
      const isFull = isLobbyFull(lobbyDraft);
      if (!isFull) {
        setExpirationStatus(getLobbyExpirationStatus(lobbyDraft));
      } else {
        setExpirationStatus(null);
      }
    };

    updateExpirationStatus();
    const interval = setInterval(updateExpirationStatus, 10000);
    return () => clearInterval(interval);
  }, [lobbyDraft]);

  const isHost = lobbyDraft?.hostId === (user.odUserId || user.username);
  const playerCount = lobbyDraft?.players?.length || 0;
  const maxPlayers = LOBBY_CONFIG.SNAKE_DRAFT_MIN_PLAYERS;
  const canStart = playerCount === maxPlayers;
  const isExpired = expirationStatus?.status === 'expired';
  const hasWarning = expirationStatus && (expirationStatus.status === 'warning' || expirationStatus.status === 'urgent');

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(lobbyDraft.code);
      setDraftCopied(true);
      setTimeout(() => setDraftCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const handleStartDraft = async () => {
    if (!canStart) return;
    try {
      const draftService = await import('../services/draftService');
      await draftService.startDraft(lobbyDraft.id);
      if (onStartDraft) onStartDraft();
    } catch (error) {
      console.error('Failed to start draft:', error);
      alert('Failed to start draft');
    }
  };

  const handleLeaveLobby = async () => {
    try {
      const draftService = await import('../services/draftService');
      // Both host and players just leave - lobby remains active
      await draftService.leaveDraft(lobbyDraft.id, user.odUserId || user.username);
      onLeaveLobby();
    } catch (error) {
      console.error('Failed to leave:', error);
    }
  };

  return (
    <div style={containerStyle}>
      <div style={{ minHeight: '100vh', background: '#0d1117' }}>
        {/* Header */}
        <div style={{
          background: '#161b22',
          borderBottom: '2px solid #21262d',
          padding: '16px'
        }}>
          <div style={{
            maxWidth: '600px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <button
              onClick={onBack}
              style={{
                color: '#00d9ff',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              ← Back
            </button>
            <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#ffffff' }}>
              Draft Lobby
            </h1>
            <div style={{ width: '60px' }}></div>
          </div>
        </div>

        <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px 16px' }}>
          {/* Expiration Warning Banner */}
          {(isExpired || hasWarning) && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 16px',
              marginBottom: '16px',
              background: isExpired
                ? 'rgba(239, 68, 68, 0.15)'
                : expirationStatus?.status === 'urgent'
                  ? 'rgba(239, 68, 68, 0.1)'
                  : 'rgba(245, 158, 11, 0.1)',
              border: `1px solid ${isExpired ? '#ef4444' : expirationStatus?.status === 'urgent' ? '#ef4444' : '#f59e0b'}`,
              borderRadius: '12px',
            }}>
              <AlertTriangle
                size={20}
                color={isExpired || expirationStatus?.status === 'urgent' ? '#ef4444' : '#f59e0b'}
              />
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: isExpired || expirationStatus?.status === 'urgent' ? '#ef4444' : '#f59e0b',
                }}>
                  {isExpired ? 'Lobby Expired' : 'Lobby Expiring Soon'}
                </div>
                <div style={{ fontSize: '12px', color: '#8b949e' }}>
                  {isExpired
                    ? 'This lobby did not get enough players and has been disbanded.'
                    : `Need ${maxPlayers - playerCount} more player${maxPlayers - playerCount !== 1 ? 's' : ''} before expiration. ${expirationStatus?.message}`}
                </div>
              </div>
            </div>
          )}

          {/* Draft Type Badge + Countdown */}
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{
                display: 'inline-block',
                padding: '8px 16px',
                background: 'rgba(139, 92, 246, 0.2)',
                border: '1px solid #8b5cf6',
                borderRadius: '20px',
                color: '#8b5cf6',
                fontSize: '14px',
                fontWeight: '600',
                textTransform: 'capitalize'
              }}>
                {lobbyDraft?.type} Draft
              </span>
              {countdown && !isExpired && (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
                  border: '1px solid #14b8a6',
                  borderRadius: '20px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  boxShadow: '0 0 12px rgba(20, 184, 166, 0.3)'
                }}>
                  <span>⏱</span> Starts in {countdown}
                </span>
              )}
            </div>
          </div>

          {/* Code Display */}
          <div style={{
            background: '#161b22',
            border: '2px solid #8b5cf6',
            borderRadius: '16px',
            padding: '24px',
            textAlign: 'center',
            marginBottom: '24px'
          }}>
            <p style={{ color: '#8b949e', marginBottom: '12px', fontSize: '14px' }}>
              Share this code with friends:
            </p>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px'
            }}>
              <div style={{
                fontSize: '32px',
                fontWeight: 'bold',
                color: '#ffffff',
                letterSpacing: '4px',
                fontFamily: "'SF Mono', monospace"
              }}>
                {lobbyDraft?.code}
              </div>
              <button
                onClick={handleCopyCode}
                style={{
                  padding: '10px 16px',
                  background: draftCopied ? '#10b981' : 'transparent',
                  border: `2px solid ${draftCopied ? '#10b981' : '#8b5cf6'}`,
                  borderRadius: '8px',
                  color: draftCopied ? '#ffffff' : '#8b5cf6',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                {draftCopied ? '✓ Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Players Grid */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ color: '#8b949e', fontSize: '14px', marginBottom: '16px', textAlign: 'center' }}>
              Players ({playerCount}/4)
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              {[0, 1, 2, 3].map(index => {
                const player = lobbyDraft?.players?.[index];
                const isMe = player?.odUserId === (user.odUserId || user.username);
                const isPlayerHost = player?.odUserId === lobbyDraft?.hostId;

                return (
                  <div
                    key={index}
                    style={{
                      background: '#161b22',
                      border: player
                        ? isMe ? '2px solid #00d9ff' : '2px solid #10b981'
                        : '2px dashed #21262d',
                      borderRadius: '12px',
                      padding: '16px 8px',
                      textAlign: 'center'
                    }}
                  >
                    {player ? (
                      <>
                        <div style={{ fontSize: '24px', marginBottom: '8px' }}>
                          {player.isCPU ? '🤖' : '👤'}
                        </div>
                        <div style={{
                          fontSize: '12px',
                          fontWeight: '600',
                          color: isMe ? '#00d9ff' : '#ffffff',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {isMe ? 'YOU' : player.displayName}
                        </div>
                        {isPlayerHost && (
                          <div style={{ fontSize: '10px', color: '#f59e0b', marginTop: '4px' }}>
                            Host
                          </div>
                        )}
                        <div style={{ color: '#10b981', marginTop: '8px' }}>✓</div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: '24px', marginBottom: '8px', opacity: 0.3 }}>👤</div>
                        <div style={{ fontSize: '12px', color: '#6e7681' }}>Waiting...</div>
                        <div style={{ color: '#6e7681', marginTop: '8px' }}>○</div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {isExpired ? (
              <div style={{
                padding: '18px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid #ef4444',
                borderRadius: '12px',
                textAlign: 'center',
                color: '#ef4444',
                fontWeight: '600'
              }}>
                This lobby has expired due to insufficient players
              </div>
            ) : isHost ? (
              <button
                onClick={handleStartDraft}
                disabled={!canStart}
                style={{
                  width: '100%',
                  padding: '18px',
                  background: canStart
                    ? 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)'
                    : '#21262d',
                  color: canStart ? '#ffffff' : '#6e7681',
                  fontWeight: 'bold',
                  fontSize: '16px',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: canStart ? 'pointer' : 'not-allowed'
                }}
              >
                {canStart ? 'START DRAFT' : `Waiting for ${maxPlayers - playerCount} more player${maxPlayers - playerCount !== 1 ? 's' : ''}...`}
              </button>
            ) : (
              <div style={{
                padding: '18px',
                background: '#161b22',
                border: '1px solid #21262d',
                borderRadius: '12px',
                textAlign: 'center',
                color: '#8b949e'
              }}>
                Waiting for host to start the draft...
              </div>
            )}

            <button
              onClick={handleLeaveLobby}
              style={{
                width: '100%',
                padding: '14px 24px',
                background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                border: '2px solid #ef4444',
                borderRadius: '12px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold',
                boxShadow: '0 0 20px rgba(239, 68, 68, 0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.boxShadow = '0 0 30px rgba(239, 68, 68, 0.6), inset 0 1px 0 rgba(255,255,255,0.2)';
                e.currentTarget.style.transform = 'scale(1.02)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.boxShadow = '0 0 20px rgba(239, 68, 68, 0.4), inset 0 1px 0 rgba(255,255,255,0.2)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              ← Leave Lobby
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DraftLobbyScreen;
