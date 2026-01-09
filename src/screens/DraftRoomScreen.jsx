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
// Import Holographic components
import { HoloAssetCard, CommandDeckYouPanel, RosterGauges, DraftToolButtons, HoloTimerInline } from '../components/draft';

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
  // Tool panel states
  const [showAnalyzePanel, setShowAnalyzePanel] = useState(false);
  const [showComparePanel, setShowComparePanel] = useState(false);
  const [showNotesPanel, setShowNotesPanel] = useState(false);

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

  // Check if user can pick from a category (not full)
  const canPickFromCategory = (cat) => (myPlayer?.categories?.[cat] || 0) < 3;

  // Handle making a pick
  const handlePick = async (asset) => {
    if (!isMyTurn || !canPickFromCategory(selectedDraftCategory)) return;
    try {
      const draftService = await import('../services/draftService');
      await draftService.makePick(roomDraft.id, currentUserId, {
        ...asset,
        category: selectedDraftCategory
      });
    } catch (error) {
      console.error('Pick failed:', error);
      alert(error.message || 'Failed to make pick');
    }
  };

  // Get picked assets to determine locked status
  const getPickedAssets = () => {
    const picked = new Map();
    roomDraft?.players?.forEach(player => {
      if (player.odUserId !== currentUserId && player.picks) {
        player.picks.forEach((symbol, idx) => {
          picked.set(symbol, {
            pickedBy: player.displayName || 'Opponent',
            category: player.pickCategories?.[idx] || 'unknown'
          });
        });
      }
    });
    return picked;
  };

  const pickedAssets = getPickedAssets();

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
          <HoloTimerInline seconds={draftTimeRemaining} />
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
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: '16px',
              maxWidth: '1200px',
              margin: '0 auto',
              justifyItems: 'center',
            }}>
              {availableAssets.map((asset) => {
                // Check if this asset was picked by another player
                const pickedInfo = pickedAssets.get(asset.symbol);
                const isLocked = !!pickedInfo;
                const canPick = isMyTurn && canPickFromCategory(selectedDraftCategory);

                return (
                  <HoloAssetCard
                    key={asset.symbol}
                    symbol={asset.symbol}
                    name={asset.name}
                    price={asset.price}
                    change={asset.percentChange || asset.change || 0}
                    dataChange={asset.percentChange || 1.2}
                    volumeChange={asset.volumeChange || 1.2}
                    status={isLocked ? 'locked' : 'available'}
                    lockedBy={pickedInfo?.pickedBy}
                    category={selectedDraftCategory}
                    disabled={!canPick}
                    onAcquire={() => handlePick(asset)}
                  />
                );
              })}

              {/* Empty state when no assets */}
              {availableAssets.length === 0 && (
                <div style={{
                  gridColumn: '1 / -1',
                  textAlign: 'center',
                  padding: '40px',
                  color: '#6e7681',
                }}>
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>
                    No assets available in this category
                  </div>
                  <div style={{ fontSize: '14px' }}>
                    Try selecting a different category
                  </div>
                </div>
              )}
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
          <RosterGauges
            steady={{
              picked: myPlayer?.categories?.steady || 0,
              required: 3,
            }}
            risky={{
              picked: myPlayer?.categories?.risky || 0,
              required: 3,
            }}
            defensive={{
              picked: myPlayer?.categories?.defensive || 0,
              required: 3,
            }}
            onGaugeClick={(category) => {
              // Switch to that category tab
              if (canPickFromCategory(category)) {
                setSelectedDraftCategory(category);
              }
            }}
          />

          {/* Center: YOU Info */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            <CommandDeckYouPanel
              username="YOU"
              stats={{
                steadyPicked: myPlayer?.categories?.steady || 0,
                riskyPicked: myPlayer?.categories?.risky || 0,
                defensivePicked: myPlayer?.categories?.defensive || 0,
              }}
              isYourTurn={isMyTurn}
              totalValue={0}
            />
          </div>

          {/* Right: Integrated Tool Buttons */}
          <DraftToolButtons
            onAnalyze={() => setShowAnalyzePanel(true)}
            onCompare={() => setShowComparePanel(true)}
            onNotes={() => setShowNotesPanel(true)}
            disabled={false}
          />
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
