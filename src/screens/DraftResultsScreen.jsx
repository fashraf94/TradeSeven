import React from 'react';

const DraftResultsScreen = ({
  containerStyle,
  currentDraft,
  user,
  onBack,
  onNavigate,
  onCreateBattle,
  onChallengeDraftOpponent,
}) => {
  // Safety check - if no draft data, show fallback
  if (!currentDraft) {
    return (
      <div style={containerStyle}>
        <div style={{
          minHeight: '100vh',
          background: '#0d1117',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
          <p style={{ color: '#ffffff', fontSize: '18px', marginBottom: '16px' }}>Loading draft results...</p>
          <button
            onClick={onBack}
            style={{
              padding: '12px 24px',
              background: '#00d9ff',
              color: '#000',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const draftData = currentDraft;
  const currentUserId = user?.odUserId || user?.username;
  const myPlayer = draftData?.players?.find(p => p.odUserId === currentUserId);

  // Static confetti data (no hooks needed)
  const confettiColors = ['#10b981', '#8b5cf6', '#00d9ff', '#f59e0b', '#ffffff'];
  const confettiPieces = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    left: (i * 3.3) % 100,
    color: confettiColors[i % confettiColors.length],
    delay: (i * 0.1) % 2,
    duration: 2.5 + (i % 3),
    size: 8 + (i % 8)
  }));

  return (
    <div style={containerStyle}>
      <div style={{ minHeight: '100vh', background: '#0d1117' }}>
        {/* Animations consolidated in index.css: confetti-fall, bounce, fade-in-up, sparkle */}
        <div style={{
          position: 'relative',
          width: '100%',
          padding: '40px 20px',
          overflow: 'hidden',
          background: 'linear-gradient(180deg, #1a1a2e 0%, #0d1117 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          boxSizing: 'border-box'
        }}>
          {/* Confetti pieces - CSS animation only */}
          {confettiPieces.map(piece => (
            <div
              key={piece.id}
              style={{
                position: 'absolute',
                left: `${piece.left}%`,
                top: '-20px',
                width: `${piece.size}px`,
                height: `${piece.size}px`,
                backgroundColor: piece.color,
                borderRadius: piece.id % 2 === 0 ? '50%' : '2px',
                pointerEvents: 'none',
                animation: `confetti-fall ${piece.duration}s ease-out ${piece.delay}s infinite`
              }}
            />
          ))}

          {/* Sparkles */}
          <span style={{ position: 'absolute', left: '10%', top: '20px', fontSize: '20px', animation: 'sparkle 1.5s ease-in-out infinite', pointerEvents: 'none' }}>✨</span>
          <span style={{ position: 'absolute', left: '30%', top: '60px', fontSize: '16px', animation: 'sparkle 1.5s ease-in-out infinite 0.3s', pointerEvents: 'none' }}>⭐</span>
          <span style={{ position: 'absolute', left: '70%', top: '30px', fontSize: '18px', animation: 'sparkle 1.5s ease-in-out infinite 0.6s', pointerEvents: 'none' }}>✨</span>
          <span style={{ position: 'absolute', left: '90%', top: '50px', fontSize: '14px', animation: 'sparkle 1.5s ease-in-out infinite 0.9s', pointerEvents: 'none' }}>⭐</span>

          {/* Rocket emojis with bounce */}
          <div style={{
            fontSize: '40px',
            marginBottom: '16px',
            animation: 'bounce 1s ease-in-out infinite',
            position: 'relative',
            zIndex: 10,
            display: 'flex',
            justifyContent: 'center',
            gap: '8px'
          }}>
            🚀 🎉 🚀
          </div>

          {/* Title - Centered with flexbox */}
          <h1 style={{
            fontSize: '28px',
            fontWeight: '800',
            color: '#ffffff',
            margin: '0 0 8px 0',
            padding: 0,
            animation: 'fade-in-up 0.6s ease-out',
            position: 'relative',
            zIndex: 10,
            width: '100%',
            textAlign: 'center'
          }}>
            Draft Complete!
          </h1>
          <p style={{
            color: '#8b949e',
            fontSize: '14px',
            margin: '0',
            animation: 'fade-in-up 0.6s ease-out 0.2s both',
            position: 'relative',
            zIndex: 10,
            width: '100%',
            textAlign: 'center'
          }}>
            All players have made their picks
          </p>
        </div>

        <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px 16px' }}>
          {/* Your Portfolio */}
          <div style={{
            background: '#161b22',
            border: '2px solid #00d9ff',
            borderRadius: '16px',
            padding: '20px',
            marginBottom: '24px'
          }}>
            <h2 style={{ color: '#00d9ff', fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>
              Your Portfolio
            </h2>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {myPlayer?.picks?.map((symbol, i) => (
                <span key={i} style={{
                  padding: '8px 14px',
                  background: '#0d1117',
                  border: '1px solid #21262d',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: '600'
                }}>
                  {symbol}
                </span>
              ))}
            </div>
          </div>

          {/* Challenge an Opponent - Phase 4 */}
          {!draftData?.isTraining && (
            <div style={{
              background: '#161b22',
              border: '1px solid #21262d',
              borderRadius: '16px',
              padding: '20px',
              marginBottom: '24px'
            }}>
              <h2 style={{ color: '#ffffff', fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>
                Challenge an Opponent
              </h2>
              <p style={{ color: '#8b949e', fontSize: '13px', marginBottom: '16px' }}>
                Start a head-to-head battle using your drafted portfolios
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {draftData?.players?.filter(p => p.odUserId !== currentUserId).map((player) => {
                  return (
                    <div
                      key={player.odUserId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px',
                        background: '#0d1117',
                        borderRadius: '8px',
                        border: '1px solid #21262d'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '20px' }}>{player.isCPU ? '🤖' : '👤'}</span>
                        <div>
                          <div style={{ color: '#ffffff', fontWeight: '600' }}>
                            {player.displayName}
                          </div>
                          <div style={{ color: '#8b949e', fontSize: '12px' }}>
                            {player.picks?.length || 0} assets drafted
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => onChallengeDraftOpponent(player)}
                        disabled={player.isCPU}
                        style={{
                          padding: '8px 16px',
                          background: player.isCPU
                            ? '#21262d'
                            : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          color: player.isCPU ? '#6e7681' : '#ffffff',
                          fontWeight: '600',
                          fontSize: '13px',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: player.isCPU ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {player.isCPU ? '🤖 CPU' : 'Challenge'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* All Players Summary */}
          <div style={{
            background: '#161b22',
            border: '1px solid #21262d',
            borderRadius: '16px',
            padding: '20px',
            marginBottom: '24px'
          }}>
            <h2 style={{ color: '#ffffff', fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>
              All Portfolios
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {draftData?.players?.map((player) => {
                const isMe = player.odUserId === currentUserId;
                return (
                  <div
                    key={player.odUserId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px',
                      background: isMe ? 'rgba(0, 217, 255, 0.1)' : '#0d1117',
                      borderRadius: '8px',
                      border: isMe ? '1px solid #00d9ff' : '1px solid #21262d'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '20px' }}>{player.isCPU ? '🤖' : '👤'}</span>
                      <span style={{ color: isMe ? '#00d9ff' : '#ffffff', fontWeight: '600' }}>
                        {isMe ? 'You' : player.displayName}
                      </span>
                    </div>
                    <div style={{ color: '#8b949e', fontSize: '13px' }}>
                      {player.picks?.length || 0} picks
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Battle Status Banner - show when draft is in battle mode */}
          {draftData?.status === 'battle' && (
            <div style={{
              background: 'transparent',
              border: '2px solid #8b5cf6',
              borderRadius: '16px',
              padding: '24px',
              marginBottom: '24px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>
                {draftData.type === 'stocks' ? '📈' : '🪙'}
              </div>
              <div style={{ color: '#8b5cf6', fontWeight: 'bold', fontSize: '20px', marginBottom: '8px' }}>
                BATTLE IN PROGRESS
              </div>
              <div style={{ color: '#8b949e', fontSize: '14px', marginBottom: '12px' }}>
                {draftData.type === 'stocks'
                  ? 'Battle ends Friday at 3 PM CT'
                  : `Battle ends ${new Date(draftData.battleEndTime).toLocaleDateString()} at ${new Date(draftData.battleEndTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                }
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '16px',
                fontSize: '13px',
                color: '#8b949e'
              }}>
                <span>Free Agents: {Object.values(draftData.freeAgents || {}).flat().length}</span>
                <span>|</span>
                <span>Swaps: {draftData.swapHistory?.length || 0}</span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Battle Mode Buttons - show when in battle mode */}
            {draftData?.status === 'battle' && (
              <>
                {/* View Battle Standings - Primary CTA */}
                <button
                  onClick={() => onNavigate('draftBattle')}
                  style={{
                    width: '100%',
                    padding: '18px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#ffffff',
                    fontWeight: 'bold',
                    fontSize: '16px',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)'
                  }}
                >
                  <span>📊</span> View Battle Standings
                </button>

                {/* Free Agency Button */}
                <button
                  onClick={() => onNavigate('freeAgency')}
                  style={{
                    width: '100%',
                    padding: '16px',
                    background: 'transparent',
                    color: '#8b5cf6',
                    fontWeight: 'bold',
                    fontSize: '16px',
                    border: '2px solid #8b5cf6',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <span>🔄</span> Free Agency
                </button>
              </>
            )}

            {!draftData?.isTraining && draftData?.status !== 'battle' && (
              <button
                onClick={onCreateBattle}
                style={{
                  width: '100%',
                  padding: '18px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff',
                  fontWeight: 'bold',
                  fontSize: '16px',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer'
                }}
              >
                CREATE BATTLE WITH PORTFOLIO
              </button>
            )}

            <button
              onClick={onBack}
              style={{
                width: '100%',
                padding: '14px',
                background: 'transparent',
                border: '1px solid #21262d',
                borderRadius: '12px',
                color: '#8b949e',
                cursor: 'pointer'
              }}
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DraftResultsScreen;
