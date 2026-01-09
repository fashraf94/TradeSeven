import React, { useState } from 'react';

/**
 * DraftRoomScreen - Holographic War Room Redesign
 *
 * A cyberpunk-themed draft room with 4 responsive zones:
 * - Zone A: Header Bar (round info, timer, code)
 * - Zone B: Opponent Arc (player positions, turn indicator)
 * - Zone C: Asset Grid (category tabs + scrollable asset cards)
 * - Zone D: Command Deck (roster summary, user info, tools)
 */

// Import DraftAdvisor - will be passed or imported
import DraftAdvisor from '../components/DraftAdvisor';

const DraftRoomScreen = ({
  containerStyle,
  draftState,
  currentDraft,
  user,
  selectedDraftCategory,
  setSelectedDraftCategory,
  draftTimeRemaining,
  autopickCountdown,
  userNotes,
  colors,
  stocksData,
  setScreen,
  getStockSector,
  getSectorColor,
}) => {
  // Local state for this screen only
  const [draftAssetInfoModal, setDraftAssetInfoModal] = useState(null);
  const [rosterTouchStart, setRosterTouchStart] = useState(null);
  const [rosterTouchEnd, setRosterTouchEnd] = useState(null);
  const [isRosterExpanded, setIsRosterExpanded] = useState(false);

  const roomDraft = draftState || currentDraft;

  // Loading state
  if (!roomDraft) {
    return (
      <div style={containerStyle}>
        <div style={{
          minHeight: '100vh',
          background: 'var(--holo-bg-dark, #0a0e14)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '48px',
              height: '48px',
              border: '4px solid #21262d',
              borderTop: '4px solid var(--neon-cyan, #00ffff)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px',
              boxShadow: 'var(--neon-cyan-glow)'
            }} />
            <div style={{
              color: 'var(--neon-cyan, #00ffff)',
              textShadow: '0 0 10px rgba(0, 255, 255, 0.5)'
            }}>
              Initializing War Room...
            </div>
          </div>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  const currentUserId = user.odUserId || user.username;
  const isMyTurn = roomDraft?.currentPlayerId === currentUserId;
  const myPlayer = roomDraft?.players?.find(p => p.odUserId === currentUserId);
  const currentRound = Math.floor((roomDraft?.currentPickIndex || 0) / 4) + 1;
  const totalRounds = 9;

  // Get other players for the opponent arc
  const otherPlayers = roomDraft?.players?.filter(p => p.odUserId !== currentUserId) || [];

  // Timer formatting and states
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimerState = () => {
    if (draftTimeRemaining > 60) return 'safe';
    if (draftTimeRemaining > 30) return 'warning';
    return 'critical';
  };

  // Last pick info
  const lastPick = draftState?.lastPick;

  // Available assets for current category
  const availableAssets = roomDraft?.availableAssets?.[selectedDraftCategory] || [];

  // Category counts
  const getCategoryCount = (cat) => roomDraft?.availableAssets?.[cat]?.length || 0;

  return (
    <div style={containerStyle}>
      {/* Main War Room Container */}
      <div
        className="scanlines"
        style={{
          minHeight: '100vh',
          background: `
            radial-gradient(ellipse at 50% 0%, rgba(0, 255, 255, 0.08) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 20%, rgba(0, 255, 136, 0.05) 0%, transparent 40%),
            radial-gradient(ellipse at 20% 80%, rgba(0, 255, 255, 0.03) 0%, transparent 40%),
            var(--holo-bg-dark, #0a0e14)
          `,
          display: 'grid',
          gridTemplateRows: 'auto auto 1fr auto',
          gridTemplateAreas: `
            "header"
            "opponents"
            "assets"
            "command"
          `,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* ============================================
            ZONE A: Header Bar
            Round info, draft code, timer
            ============================================ */}
        <header
          style={{
            gridArea: 'header',
            padding: '12px 16px',
            paddingTop: 'max(12px, env(safe-area-inset-top))',
            borderBottom: '1px solid var(--holo-border, rgba(0, 255, 255, 0.3))',
            background: 'rgba(10, 14, 20, 0.9)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            zIndex: 100,
          }}
        >
          {/* Left: Exit + Round Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={() => {
                if (window.confirm('Leave draft? Your turns will be auto-picked while you\'re away.')) {
                  setScreen('dashboard');
                }
              }}
              style={{
                background: 'transparent',
                border: '1px solid var(--holo-border)',
                color: '#8b949e',
                padding: '6px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                transition: 'all 0.2s',
              }}
            >
              ← EXIT
            </button>
            <div style={{
              color: '#e6edf3',
              fontSize: '14px',
              fontWeight: '500',
            }}>
              Round {currentRound}/{totalRounds}
              <span style={{
                color: '#6e7681',
                marginLeft: '12px',
                fontSize: '12px'
              }}>
                Code: {roomDraft?.code}
              </span>
            </div>
          </div>

          {/* Right: Timer */}
          <div
            className={`timer-${getTimerState()}`}
            style={{
              fontSize: '32px',
              fontWeight: '700',
              fontFamily: "'SF Mono', 'Monaco', monospace",
              letterSpacing: '2px',
            }}
          >
            {formatTime(draftTimeRemaining)}
          </div>
        </header>

        {/* ============================================
            ZONE B: Opponent Arc
            Shows all players in arc formation with picking indicator
            ============================================ */}
        <section
          style={{
            gridArea: 'opponents',
            padding: '20px 16px',
            borderBottom: '1px solid var(--holo-border)',
            background: 'rgba(10, 14, 20, 0.5)',
          }}
        >
          {/* Desktop: Horizontal arc layout */}
          <div
            className="opponent-arc-desktop"
            style={{
              display: 'none', // Will show on desktop via media query
              justifyContent: 'center',
              alignItems: 'center',
              gap: '24px',
            }}
          >
            {/* Left opponent */}
            <div style={{
              padding: '12px 20px',
              background: 'var(--holo-bg-card)',
              border: '1px solid var(--holo-border)',
              borderRadius: '8px',
              textAlign: 'center',
              minWidth: '120px',
            }}>
              <div style={{ color: '#e6edf3', fontWeight: '600', fontSize: '14px' }}>
                {otherPlayers[0]?.displayName || 'Player 2'}
              </div>
              <div style={{ color: '#6e7681', fontSize: '12px', marginTop: '4px' }}>
                $0 R0 D0
              </div>
            </div>

            {/* Connection line */}
            <div style={{
              width: '60px',
              height: '2px',
              background: 'linear-gradient(90deg, var(--neon-green) 0%, var(--neon-cyan) 100%)',
              boxShadow: 'var(--neon-green-glow)',
            }} />

            {/* Current Picker (Center) */}
            <div
              className="pulse-glow"
              style={{
                padding: '16px 32px',
                background: 'rgba(0, 255, 255, 0.1)',
                border: '2px solid var(--neon-cyan)',
                borderRadius: '8px',
                textAlign: 'center',
                boxShadow: 'var(--neon-cyan-glow)',
              }}
            >
              <div style={{
                color: 'var(--neon-cyan)',
                fontSize: '10px',
                fontWeight: '700',
                letterSpacing: '2px',
                marginBottom: '4px',
              }}>
                PICKING
              </div>
              <div style={{
                color: '#fff',
                fontWeight: '700',
                fontSize: '16px',
              }}>
                {roomDraft?.players?.find(p => p.odUserId === roomDraft?.currentPlayerId)?.displayName || 'Unknown'}
                <span style={{ marginLeft: '8px' }}>★</span>
              </div>
              <div style={{ color: '#6e7681', fontSize: '12px', marginTop: '4px' }}>
                $0 R0 D0
              </div>
            </div>

            {/* Connection line */}
            <div style={{
              width: '60px',
              height: '2px',
              background: 'linear-gradient(90deg, var(--neon-cyan) 0%, var(--neon-green) 100%)',
              boxShadow: 'var(--neon-green-glow)',
            }} />

            {/* Right opponent */}
            <div style={{
              padding: '12px 20px',
              background: 'var(--holo-bg-card)',
              border: '1px solid var(--holo-border)',
              borderRadius: '8px',
              textAlign: 'center',
              minWidth: '120px',
            }}>
              <div style={{ color: '#e6edf3', fontWeight: '600', fontSize: '14px' }}>
                {otherPlayers[1]?.displayName || 'Player 3'}
              </div>
              <div style={{ color: '#6e7681', fontSize: '12px', marginTop: '4px' }}>
                $0 R0 D0
              </div>
            </div>
          </div>

          {/* Mobile: Vertical stack layout */}
          <div
            className="opponent-arc-mobile"
            style={{
              display: 'flex', // Will hide on desktop via media query
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {/* Top opponent */}
            <div style={{
              padding: '8px 16px',
              background: 'var(--holo-bg-card)',
              border: '1px solid var(--holo-border)',
              borderRadius: '6px',
              textAlign: 'center',
              minWidth: '100px',
            }}>
              <div style={{ color: '#e6edf3', fontWeight: '600', fontSize: '13px' }}>
                {otherPlayers[0]?.displayName || 'Player 2'}
              </div>
            </div>

            {/* Vertical connector */}
            <div style={{
              width: '2px',
              height: '16px',
              background: 'var(--neon-green)',
              boxShadow: 'var(--neon-green-glow)',
            }} />

            {/* Current Picker (Center) */}
            <div
              className="pulse-glow"
              style={{
                padding: '12px 24px',
                background: 'rgba(0, 255, 255, 0.1)',
                border: '2px solid var(--neon-cyan)',
                borderRadius: '6px',
                textAlign: 'center',
                boxShadow: 'var(--neon-cyan-glow)',
              }}
            >
              <div style={{
                color: 'var(--neon-cyan)',
                fontSize: '9px',
                fontWeight: '700',
                letterSpacing: '2px',
              }}>
                PICKING
              </div>
              <div style={{
                color: '#fff',
                fontWeight: '700',
                fontSize: '14px',
                marginTop: '2px',
              }}>
                {roomDraft?.players?.find(p => p.odUserId === roomDraft?.currentPlayerId)?.displayName || 'Unknown'}
                <span style={{ marginLeft: '6px' }}>★</span>
              </div>
            </div>

            {/* Vertical connector */}
            <div style={{
              width: '2px',
              height: '16px',
              background: 'var(--neon-green)',
              boxShadow: 'var(--neon-green-glow)',
            }} />

            {/* Bottom opponent */}
            <div style={{
              padding: '8px 16px',
              background: 'var(--holo-bg-card)',
              border: '1px solid var(--holo-border)',
              borderRadius: '6px',
              textAlign: 'center',
              minWidth: '100px',
            }}>
              <div style={{ color: '#e6edf3', fontWeight: '600', fontSize: '13px' }}>
                {otherPlayers[1]?.displayName || 'Player 3'}
              </div>
            </div>
          </div>

          {/* Last Pick Info */}
          {lastPick && (
            <div style={{
              textAlign: 'center',
              marginTop: '16px',
              padding: '8px 16px',
              background: 'rgba(0, 255, 255, 0.05)',
              borderRadius: '4px',
              fontSize: '13px',
              color: '#8b949e',
            }}>
              Last Pick: <span style={{ color: '#e6edf3', fontWeight: '600' }}>{lastPick.displayName}</span>
              {' picked '}
              <span style={{
                color: lastPick.category === 'steady' ? '#10b981'
                     : lastPick.category === 'risky' ? '#f59e0b'
                     : '#3b82f6',
                fontWeight: '700'
              }}>
                {lastPick.symbol}
              </span>
              <span style={{ color: '#6e7681', marginLeft: '4px' }}>
                ({lastPick.category})
              </span>
            </div>
          )}
        </section>

        {/* ============================================
            ZONE C: Asset Grid
            Category tabs + scrollable asset cards
            ============================================ */}
        <section
          style={{
            gridArea: 'assets',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Category Tabs */}
          <div style={{
            display: 'flex',
            gap: '8px',
            padding: '12px 16px',
            background: 'rgba(10, 14, 20, 0.7)',
            borderBottom: '1px solid var(--holo-border)',
          }}>
            {['steady', 'risky', 'defensive'].map(cat => {
              const isActive = selectedDraftCategory === cat;
              const count = getCategoryCount(cat);
              const catColors = {
                steady: { color: '#10b981', label: 'Steady' },
                risky: { color: '#f59e0b', label: 'Risky' },
                defensive: { color: '#3b82f6', label: 'Defensive' },
              };
              const { color, label } = catColors[cat];
              const userCount = myPlayer?.categories?.[cat] || 0;
              const isFull = userCount >= 3;

              return (
                <button
                  key={cat}
                  onClick={() => !isFull && setSelectedDraftCategory(cat)}
                  disabled={isFull}
                  className={isActive ? 'category-tab-active' : 'category-tab'}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: isActive ? `1px solid ${color}` : '1px solid var(--holo-border)',
                    background: isActive ? `${color}15` : 'transparent',
                    color: isFull ? '#6e7681' : isActive ? color : '#8b949e',
                    fontWeight: '600',
                    fontSize: '13px',
                    cursor: isFull ? 'not-allowed' : 'pointer',
                    opacity: isFull ? 0.5 : 1,
                    transition: 'all 0.2s',
                    boxShadow: isActive ? `inset 0 0 20px ${color}15` : 'none',
                  }}
                >
                  {label} ({count})
                  {isFull && ' ✓'}
                </button>
              );
            })}
          </div>

          {/* Asset Cards Grid - Scrollable */}
          <div style={{
            flex: 1,
            overflow: 'auto',
            padding: '16px',
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: '12px',
              maxWidth: '1200px',
              margin: '0 auto',
            }}>
              {/* Placeholder Asset Cards */}
              {availableAssets.slice(0, 10).map((asset, idx) => {
                const isLocked = idx === 2; // Demo: 3rd card is locked

                return (
                  <div
                    key={asset.symbol}
                    className={`holo-card ${isLocked ? 'holo-locked' : 'holo-card-hover'}`}
                    style={{
                      padding: '16px',
                      borderRadius: '8px',
                      background: isLocked ? 'rgba(255, 51, 102, 0.05)' : 'var(--holo-bg-card)',
                      border: isLocked
                        ? '1px solid rgba(255, 51, 102, 0.4)'
                        : '1px solid var(--holo-border)',
                      position: 'relative',
                      cursor: isLocked ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {/* Status Badge */}
                    <div style={{
                      position: 'absolute',
                      top: '-8px',
                      left: '12px',
                      padding: '2px 8px',
                      background: isLocked ? 'var(--neon-red)' : 'var(--neon-cyan)',
                      color: '#000',
                      fontSize: '9px',
                      fontWeight: '700',
                      letterSpacing: '1px',
                      borderRadius: '2px',
                    }}>
                      {isLocked ? 'LOCKED' : 'AVAILABLE'}
                    </div>

                    {/* Symbol */}
                    <div style={{
                      fontSize: '18px',
                      fontWeight: '700',
                      color: '#ffffff',
                      marginTop: '8px',
                    }}>
                      {asset.symbol}
                    </div>

                    {/* Company Name */}
                    <div style={{
                      fontSize: '11px',
                      color: '#6e7681',
                      marginTop: '2px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {asset.name}
                    </div>

                    {/* Price */}
                    <div style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#e6edf3',
                      marginTop: '8px',
                    }}>
                      ${asset.price?.toFixed(2) || '0.00'}
                    </div>

                    {/* Data/Volume (placeholder) */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginTop: '8px',
                      fontSize: '10px',
                      color: '#6e7681',
                    }}>
                      <span>Data <span style={{ color: '#10b981' }}>+1.2%</span></span>
                      <span>Volume <span style={{ color: '#10b981' }}>+1.2%</span></span>
                    </div>

                    {/* Acquire Button */}
                    {!isLocked && (
                      <button
                        className="btn-acquire"
                        style={{
                          width: '100%',
                          marginTop: '12px',
                          padding: '8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '700',
                          letterSpacing: '1px',
                          cursor: 'pointer',
                        }}
                      >
                        ACQUIRE
                      </button>
                    )}

                    {/* Locked Overlay */}
                    {isLocked && (
                      <div style={{
                        marginTop: '12px',
                        padding: '8px',
                        background: 'rgba(255, 51, 102, 0.1)',
                        border: '1px solid rgba(255, 51, 102, 0.3)',
                        borderRadius: '4px',
                        textAlign: 'center',
                        fontSize: '10px',
                        color: 'var(--neon-red)',
                        fontWeight: '600',
                        letterSpacing: '1px',
                      }}>
                        SYSTEM LOCKED<br/>BY BEARHUNTER
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ============================================
            ZONE D: Command Deck
            Roster power cores, user info, tools
            ============================================ */}
        <footer
          style={{
            gridArea: 'command',
            padding: '12px 16px',
            paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
            borderTop: '1px solid var(--holo-border-bright)',
            background: 'rgba(10, 14, 20, 0.95)',
            backdropFilter: 'blur(10px)',
            display: 'grid',
            gridTemplateColumns: 'auto 1fr auto',
            gap: '16px',
            alignItems: 'center',
          }}
        >
          {/* Left: Roster Power Cores */}
          <div style={{
            display: 'flex',
            gap: '8px',
          }}>
            {['S', 'R', 'D'].map((cat, idx) => {
              const colors = ['#10b981', '#f59e0b', '#3b82f6'];
              const fullCat = ['steady', 'risky', 'defensive'][idx];
              const count = myPlayer?.categories?.[fullCat] || 0;

              return (
                <div
                  key={cat}
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '8px',
                    background: `${colors[idx]}15`,
                    border: `1px solid ${colors[idx]}50`,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: '600',
                    color: colors[idx],
                  }}
                >
                  <span>{cat}:</span>
                  <span>{count}/3</span>
                </div>
              );
            })}
            <div style={{
              fontSize: '10px',
              color: '#6e7681',
              alignSelf: 'flex-end',
              marginLeft: '4px',
            }}>
              Roster Power Cores [cite: 4]
            </div>
          </div>

          {/* Center: YOU Info */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '8px 24px',
            background: 'rgba(0, 255, 255, 0.1)',
            border: '1px solid var(--holo-border-bright)',
            borderRadius: '8px',
          }}>
            <div style={{
              fontSize: '10px',
              color: 'var(--neon-cyan)',
              fontWeight: '700',
              letterSpacing: '1px',
              marginBottom: '2px',
            }}>
              D
            </div>
            <div style={{
              fontSize: '18px',
              fontWeight: '700',
              color: '#ffffff',
            }}>
              YOU
            </div>
            <div style={{
              fontSize: '12px',
              color: '#8b949e',
              marginTop: '2px',
            }}>
              $0 R0 D0
            </div>
            <div style={{
              fontSize: '10px',
              color: '#6e7681',
              marginTop: '4px',
            }}>
              Command Deck [cite: 4]
            </div>
          </div>

          {/* Right: Integrated Tool Buttons */}
          <div style={{
            display: 'flex',
            gap: '8px',
          }}>
            {[
              { icon: '🔍', label: 'Analyze Draft' },
              { icon: '⚖️', label: 'Compare Picks' },
              { icon: '📝', label: 'My Notes' },
            ].map(({ icon, label }) => (
              <button
                key={label}
                style={{
                  padding: '8px 12px',
                  background: 'var(--holo-bg-card)',
                  border: '1px solid var(--holo-border)',
                  borderRadius: '6px',
                  color: '#8b949e',
                  fontSize: '11px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.2s',
                }}
              >
                <span style={{ fontSize: '16px' }}>{icon}</span>
                <span>{label}</span>
              </button>
            ))}
            <div style={{
              fontSize: '10px',
              color: '#6e7681',
              alignSelf: 'flex-end',
            }}>
              Integrated Tool Button [cite: 4]
            </div>
          </div>
        </footer>

        {/* Responsive Styles */}
        <style>{`
          /* Desktop: Show horizontal arc, hide vertical */
          @media (min-width: 1024px) {
            .opponent-arc-desktop {
              display: flex !important;
            }
            .opponent-arc-mobile {
              display: none !important;
            }
          }

          /* Mobile: Show vertical stack, hide horizontal */
          @media (max-width: 1023px) {
            .opponent-arc-desktop {
              display: none !important;
            }
            .opponent-arc-mobile {
              display: flex !important;
            }
          }
        `}</style>
      </div>
    </div>
  );
};

export default DraftRoomScreen;
