import React, { useState, useEffect } from 'react';

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
import {
  HoloAssetCard,
  CommandDeckYouPanel,
  RosterGauges,
  DraftToolButtons,
  HoloTimerInline,
  PlayerPanel,
  SnakeConduit,
  SnakeConnector,
  SnakeConnectorVertical
} from '../components/draft';

const DraftRoomScreen = ({
  containerStyle,
  draftState,
  currentDraft,
  user,
  selectedDraftCategory,
  setSelectedDraftCategory,
  draftTimeRemaining,
  autopickCountdown,
  isRosterExpanded,
  setIsRosterExpanded,
  userNotes,
  colors,
  stocksData,
  setScreen,
  getStockSector,
  getSectorColor,
  setCurrentDraft,
}) => {
  // Local state for this screen only
  const [draftAssetInfoModal, setDraftAssetInfoModal] = useState(null);
  const [rosterTouchStart, setRosterTouchStart] = useState(null);
  const [rosterTouchEnd, setRosterTouchEnd] = useState(null);
  // Tool panel states - DraftAdvisor integration
  const [showDraftAdvisor, setShowDraftAdvisor] = useState(false);
  const [draftAdvisorAction, setDraftAdvisorAction] = useState('analyze');

  const roomDraft = draftState || currentDraft;

  // Handle draft completion - navigate to results
  useEffect(() => {
    if (roomDraft?.status === 'completed' || roomDraft?.status === 'battle') {
      // Draft is complete, navigate to results
      setScreen('draftResults');
    }
  }, [roomDraft?.status, setScreen]);

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
          {/* Desktop: Horizontal arc layout with SnakeConduit */}
          <div
            className="opponent-arc-desktop"
            style={{
              display: 'none', // Will show on desktop via media query
              justifyContent: 'center',
              alignItems: 'center',
              gap: '16px',
              position: 'relative',
              minHeight: '140px',
              padding: '20px 0',
            }}
          >
            {/* SnakeConduit - Curved neon connection behind players */}
            <SnakeConduit
              width={900}
              height={80}
              playerCount={3}
              activeIndex={
                otherPlayers[0]?.odUserId === roomDraft?.currentPlayerId ? 0
                : roomDraft?.currentPlayerId === currentUserId ? 1
                : otherPlayers[1]?.odUserId === roomDraft?.currentPlayerId ? 2
                : -1
              }
            />

            {/* Left opponent */}
            <PlayerPanel
              username={otherPlayers[0]?.displayName || 'Player 2'}
              isCurrentPicker={otherPlayers[0]?.odUserId === roomDraft?.currentPlayerId}
              isYou={false}
              isCPU={otherPlayers[0]?.isCPU || false}
              stats={{
                steadyPicked: otherPlayers[0]?.categories?.steady || 0,
                riskyPicked: otherPlayers[0]?.categories?.risky || 0,
                defensivePicked: otherPlayers[0]?.categories?.defensive || 0,
              }}
              lastPick={lastPick?.playerId === otherPlayers[0]?.odUserId ? lastPick?.symbol : null}
            />

            {/* Connection line */}
            <SnakeConnector glowing={otherPlayers[0]?.odUserId === roomDraft?.currentPlayerId} />

            {/* Current Picker (Center) - shows whoever is currently picking */}
            {(() => {
              const currentPicker = roomDraft?.players?.find(p => p.odUserId === roomDraft?.currentPlayerId);
              const isCurrentUserPicking = currentPicker?.odUserId === currentUserId;
              return (
                <PlayerPanel
                  username={isCurrentUserPicking ? 'YOU' : currentPicker?.displayName || 'Unknown'}
                  isCurrentPicker={true}
                  isYou={isCurrentUserPicking}
                  isCPU={currentPicker?.isCPU || false}
                  stats={{
                    steadyPicked: currentPicker?.categories?.steady || 0,
                    riskyPicked: currentPicker?.categories?.risky || 0,
                    defensivePicked: currentPicker?.categories?.defensive || 0,
                  }}
                  pickProgress={draftTimeRemaining > 0 ? 1 - (draftTimeRemaining / 120) : 0}
                />
              );
            })()}

            {/* Connection line */}
            <SnakeConnector glowing={otherPlayers[1]?.odUserId === roomDraft?.currentPlayerId} />

            {/* Right opponent */}
            <PlayerPanel
              username={otherPlayers[1]?.displayName || 'Player 3'}
              isCurrentPicker={otherPlayers[1]?.odUserId === roomDraft?.currentPlayerId}
              isYou={false}
              isCPU={otherPlayers[1]?.isCPU || false}
              stats={{
                steadyPicked: otherPlayers[1]?.categories?.steady || 0,
                riskyPicked: otherPlayers[1]?.categories?.risky || 0,
                defensivePicked: otherPlayers[1]?.categories?.defensive || 0,
              }}
              lastPick={lastPick?.playerId === otherPlayers[1]?.odUserId ? lastPick?.symbol : null}
            />
          </div>

          {/* Mobile: Vertical stack layout */}
          <div
            className="opponent-arc-mobile"
            style={{
              display: 'flex', // Will hide on desktop via media query
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {/* Top opponent */}
            <PlayerPanel
              username={otherPlayers[0]?.displayName || 'Player 2'}
              isCurrentPicker={otherPlayers[0]?.odUserId === roomDraft?.currentPlayerId}
              isYou={false}
              isCPU={otherPlayers[0]?.isCPU || false}
              stats={{
                steadyPicked: otherPlayers[0]?.categories?.steady || 0,
                riskyPicked: otherPlayers[0]?.categories?.risky || 0,
                defensivePicked: otherPlayers[0]?.categories?.defensive || 0,
              }}
              compact={true}
            />

            {/* Vertical connector */}
            <SnakeConnectorVertical glowing={otherPlayers[0]?.odUserId === roomDraft?.currentPlayerId} />

            {/* Current Picker (Center) */}
            {(() => {
              const currentPicker = roomDraft?.players?.find(p => p.odUserId === roomDraft?.currentPlayerId);
              const isCurrentUserPicking = currentPicker?.odUserId === currentUserId;
              return (
                <PlayerPanel
                  username={isCurrentUserPicking ? 'YOU' : currentPicker?.displayName || 'Unknown'}
                  isCurrentPicker={true}
                  isYou={isCurrentUserPicking}
                  isCPU={currentPicker?.isCPU || false}
                  stats={{
                    steadyPicked: currentPicker?.categories?.steady || 0,
                    riskyPicked: currentPicker?.categories?.risky || 0,
                    defensivePicked: currentPicker?.categories?.defensive || 0,
                  }}
                  compact={true}
                />
              );
            })()}

            {/* Vertical connector */}
            <SnakeConnectorVertical glowing={otherPlayers[1]?.odUserId === roomDraft?.currentPlayerId} />

            {/* Bottom opponent */}
            <PlayerPanel
              username={otherPlayers[1]?.displayName || 'Player 3'}
              isCurrentPicker={otherPlayers[1]?.odUserId === roomDraft?.currentPlayerId}
              isYou={false}
              isCPU={otherPlayers[1]?.isCPU || false}
              stats={{
                steadyPicked: otherPlayers[1]?.categories?.steady || 0,
                riskyPicked: otherPlayers[1]?.categories?.risky || 0,
                defensivePicked: otherPlayers[1]?.categories?.defensive || 0,
              }}
              compact={true}
            />
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
            onAnalyze={() => {
              setDraftAdvisorAction('analyze');
              setShowDraftAdvisor(true);
            }}
            onCompare={() => {
              setDraftAdvisorAction('compare');
              setShowDraftAdvisor(true);
            }}
            onNotes={() => {
              setDraftAdvisorAction('notes');
              setShowDraftAdvisor(true);
            }}
            disabled={false}
          />
        </footer>

        {/* Autopick Warning Banner */}
        {autopickCountdown > 0 && autopickCountdown <= 10 && isMyTurn && (
          <div
            style={{
              position: 'fixed',
              top: '80px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(255, 51, 102, 0.95)',
              border: '1px solid var(--neon-red)',
              borderRadius: '8px',
              padding: '12px 24px',
              zIndex: 200,
              textAlign: 'center',
              animation: 'pulse-warning 0.5s ease-in-out infinite',
              boxShadow: '0 0 30px rgba(255, 51, 102, 0.5)',
            }}
          >
            <div style={{
              fontSize: '14px',
              fontWeight: '700',
              color: '#ffffff',
              textTransform: 'uppercase',
              letterSpacing: '1px',
            }}>
              Auto-pick in {autopickCountdown}s
            </div>
            <div style={{
              fontSize: '11px',
              color: 'rgba(255, 255, 255, 0.8)',
              marginTop: '4px',
            }}>
              Select an asset now or one will be chosen for you
            </div>
          </div>
        )}

        {/* DraftAdvisor Modal */}
        {showDraftAdvisor && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.8)',
              backdropFilter: 'blur(4px)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
            }}
            onClick={() => setShowDraftAdvisor(false)}
          >
            <div
              style={{
                background: 'var(--holo-bg-dark, #0a0e14)',
                border: '1px solid var(--holo-border)',
                borderRadius: '12px',
                maxWidth: '600px',
                width: '100%',
                maxHeight: '80vh',
                overflow: 'auto',
                boxShadow: '0 0 40px rgba(0, 255, 255, 0.2)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <DraftAdvisor
                draftState={roomDraft}
                user={user}
                selectedCategory={selectedDraftCategory}
                action={draftAdvisorAction}
                onClose={() => setShowDraftAdvisor(false)}
                userNotes={userNotes}
              />
            </div>
          </div>
        )}

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

          /* Autopick warning pulse animation */
          @keyframes pulse-warning {
            0%, 100% {
              opacity: 1;
              transform: translateX(-50%) scale(1);
            }
            50% {
              opacity: 0.85;
              transform: translateX(-50%) scale(1.02);
            }
          }
        `}</style>
      </div>
    </div>
  );
};

export default DraftRoomScreen;
