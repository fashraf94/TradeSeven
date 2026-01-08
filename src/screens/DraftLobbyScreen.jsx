import React, { useState } from 'react';

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

const DraftLobbyScreen = ({
  user,
  currentDraft,
  draftState,
  onBack,
  onStartDraft,
  onLeaveLobby
}) => {
  const [draftCopied, setDraftCopied] = useState(false);

  const lobbyDraft = draftState || currentDraft;
  const isHost = lobbyDraft?.hostId === (user.odUserId || user.username);
  const playerCount = lobbyDraft?.players?.length || 0;
  const canStart = playerCount === 4;

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
      if (isHost) {
        await draftService.cancelDraft(lobbyDraft.id);
      } else {
        await draftService.leaveDraft(lobbyDraft.id, user.odUserId || user.username);
      }
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
          {/* Draft Type Badge */}
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
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
            {isHost ? (
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
                {canStart ? 'START DRAFT' : `Waiting for ${4 - playerCount} more player${4 - playerCount !== 1 ? 's' : ''}...`}
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
                padding: '14px',
                background: 'transparent',
                border: '1px solid #21262d',
                borderRadius: '12px',
                color: '#8b949e',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              {isHost ? 'Cancel Draft' : '← Leave Lobby'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DraftLobbyScreen;
