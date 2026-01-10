import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

/**
 * DraftRoomScreen - Holographic War Room Redesign
 *
 * A cyberpunk-themed draft room with 4 responsive zones:
 * - Zone A: Header Bar (round info, timer, code)
 * - Zone B: Opponent Arc (player positions, turn indicator)
 * - Zone C: Asset Grid (category tabs + scrollable asset cards)
 * - Zone D: Command Deck (roster summary, user info, tools)
 *
 * Features Phase 6 animations: turn notifications, pick banners, timer warnings
 */

// Import DraftAdvisor - will be passed or imported
import DraftAdvisor from '../components/DraftAdvisor';
// Import EODHD API for real-time prices
import { getMultipleStockPrices } from '../services/eodhdAPI';
// Import Holographic components
import {
  HoloAssetCard,
  CommandDeckConfirmButton,
  RosterGauges,
  DraftToolButtons,
  HoloTimerInline,
  PlayerPanel,
  SnakeConduit,
  SnakeConnector,
  SnakeConnectorVertical,
  AssetResearchModal
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

  // Selection state for two-step pick flow
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [isConfirming, setIsConfirming] = useState(false);

  // Animation states
  const [showYourTurnFlash, setShowYourTurnFlash] = useState(false);
  const [showLastPickBanner, setShowLastPickBanner] = useState(false);
  const [categoryTransition, setCategoryTransition] = useState(false);
  const prevPickerRef = useRef(null);
  const prevLastPickRef = useRef(null);
  const prevCategoryRef = useRef(selectedDraftCategory);

  // Mobile roster drawer state
  const [drawerDragY, setDrawerDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Real-time price data from EODHD API
  const [livePrices, setLivePrices] = useState({});
  const [pricesLoading, setPricesLoading] = useState(true);

  const roomDraft = draftState || currentDraft;

  // Handle draft completion - navigate to results
  useEffect(() => {
    if (roomDraft?.status === 'completed' || roomDraft?.status === 'battle') {
      // Draft is complete, navigate to results
      setScreen('draftResults');
    }
  }, [roomDraft?.status, setScreen]);

  // Fetch real-time prices from EODHD API
  useEffect(() => {
    if (!roomDraft?.availableAssets) return;

    const fetchPrices = async () => {
      try {
        // Collect all unique symbols from all categories
        const allSymbols = new Set();
        Object.values(roomDraft.availableAssets).forEach(categoryAssets => {
          categoryAssets.forEach(asset => {
            if (asset.symbol) {
              allSymbols.add(asset.symbol.toUpperCase());
            }
          });
        });

        if (allSymbols.size === 0) return;

        const symbolsArray = Array.from(allSymbols);
        console.log('[DraftRoom] Fetching prices for', symbolsArray.length, 'symbols');

        const prices = await getMultipleStockPrices(symbolsArray);
        setLivePrices(prices);
        setPricesLoading(false);
      } catch (error) {
        console.error('[DraftRoom] Failed to fetch prices:', error);
        setPricesLoading(false);
      }
    };

    // Initial fetch
    fetchPrices();

    // Refresh prices every 60 seconds
    const intervalId = setInterval(fetchPrices, 60000);

    return () => clearInterval(intervalId);
  }, [roomDraft?.availableAssets]);

  // Detect when it becomes YOUR TURN - flash notification
  useEffect(() => {
    const currentUserId = user?.odUserId || user?.username;
    const currentPicker = roomDraft?.currentPlayerId;

    if (currentPicker && prevPickerRef.current !== currentPicker) {
      if (currentPicker === currentUserId && prevPickerRef.current !== null) {
        // It just became your turn!
        setShowYourTurnFlash(true);
        setTimeout(() => setShowYourTurnFlash(false), 2000);
      }
      prevPickerRef.current = currentPicker;
    }
  }, [roomDraft?.currentPlayerId, user]);

  // Detect new last pick - show animated banner
  useEffect(() => {
    const lastPick = draftState?.lastPick;
    if (lastPick && lastPick !== prevLastPickRef.current) {
      if (prevLastPickRef.current !== null) {
        setShowLastPickBanner(true);
        // Auto-hide after 5 seconds
        const timer = setTimeout(() => setShowLastPickBanner(false), 5000);
        return () => clearTimeout(timer);
      }
      prevLastPickRef.current = lastPick;
    }
  }, [draftState?.lastPick]);

  // Category tab transition effect
  useEffect(() => {
    if (selectedDraftCategory !== prevCategoryRef.current) {
      setCategoryTransition(true);
      setTimeout(() => setCategoryTransition(false), 300);
      prevCategoryRef.current = selectedDraftCategory;
    }
  }, [selectedDraftCategory]);

  // Clear selection when turn changes (no longer your turn) or category changes
  useEffect(() => {
    const currentUserId = user?.odUserId || user?.username;
    if (roomDraft?.currentPlayerId !== currentUserId) {
      setSelectedAsset(null);
    }
  }, [roomDraft?.currentPlayerId, user]);

  // Also clear selection when category changes
  useEffect(() => {
    setSelectedAsset(null);
  }, [selectedDraftCategory]);

  // Mobile drawer swipe handlers
  const handleDrawerTouchStart = useCallback((e) => {
    setIsDragging(true);
    setRosterTouchStart(e.touches[0].clientY);
  }, []);

  const handleDrawerTouchMove = useCallback((e) => {
    if (!isDragging || rosterTouchStart === null) return;
    const currentY = e.touches[0].clientY;
    const diff = rosterTouchStart - currentY;
    setDrawerDragY(Math.max(0, Math.min(diff, 200)));
  }, [isDragging, rosterTouchStart]);

  const handleDrawerTouchEnd = useCallback(() => {
    setIsDragging(false);
    if (drawerDragY > 80) {
      setIsRosterExpanded?.(true);
    } else if (drawerDragY < -30) {
      setIsRosterExpanded?.(false);
    }
    setDrawerDragY(0);
    setRosterTouchStart(null);
  }, [drawerDragY, setIsRosterExpanded]);

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

  // Get other players for the opponent arc (excluding current user)
  const otherPlayers = roomDraft?.players?.filter(p => p.odUserId !== currentUserId) || [];

  // Get players for the SIDE positions (excluding BOTH current user AND current picker)
  // The center position shows the current picker, so we don't want duplicates on the sides
  const sideOpponents = otherPlayers.filter(p => p.odUserId !== roomDraft?.currentPlayerId);

  // Determine the next picker ID from draft order
  // IMPORTANT: draftOrder contains player INDICES (0,1,2,3), not player IDs
  // We must convert the index to a player ID via the players array
  const getNextPickerId = () => {
    const draftOrder = roomDraft?.draftOrder;
    const players = roomDraft?.players;
    const currentPickIndex = roomDraft?.currentPickIndex ?? 0;

    if (!draftOrder || !players || currentPickIndex >= draftOrder.length - 1) {
      return null;
    }

    const nextPickIndex = currentPickIndex + 1;
    const nextPlayerIndex = draftOrder[nextPickIndex];  // This is 0, 1, 2, or 3
    const nextPlayer = players[nextPlayerIndex];

    return nextPlayer?.odUserId || null;
  };
  const nextPickerId = getNextPickerId();

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

  // Handle selecting an asset (first step of two-step flow)
  const handleSelectAsset = (asset) => {
    // Can only select if it's your turn and asset is available
    if (!isMyTurn) return;

    // Check if asset is locked
    const pickedInfo = pickedAssets.get(asset.symbol);
    if (pickedInfo) return;

    // Toggle selection (click again to deselect)
    if (selectedAsset?.symbol === asset.symbol) {
      setSelectedAsset(null);
    } else {
      setSelectedAsset(asset);
    }
  };

  // Handle confirming the pick (second step of two-step flow)
  const handleConfirmPick = async (asset) => {
    if (!asset || isConfirming || !isMyTurn) return;
    if (!canPickFromCategory(selectedDraftCategory)) return;

    setIsConfirming(true);

    try {
      const draftService = await import('../services/draftService');
      await draftService.makePick(roomDraft.id, currentUserId, {
        ...asset,
        category: selectedDraftCategory
      });

      // Clear selection after successful pick
      setSelectedAsset(null);
    } catch (error) {
      console.error('Pick failed:', error);
      alert(error.message || 'Failed to make pick');
    } finally {
      setIsConfirming(false);
    }
  };

  // Legacy handlePick for direct picks (backward compatibility)
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

  // Determine timer warning level for screen effects
  const timerWarningLevel = draftTimeRemaining <= 5 ? 'critical-5' : draftTimeRemaining <= 10 ? 'critical-10' : draftTimeRemaining <= 30 ? 'warning' : 'safe';

  return (
    <div style={{ ...containerStyle, height: '100vh', overflow: 'hidden' }}>
      {/* Screen Edge Warning Glow - Shows when timer is low */}
      {isMyTurn && timerWarningLevel !== 'safe' && (
        <div
          className={`screen-edge-glow ${timerWarningLevel}`}
          style={{
            position: 'fixed',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 50,
            boxShadow: timerWarningLevel === 'critical-5'
              ? 'inset 0 0 100px rgba(255, 51, 102, 0.4), inset 0 0 200px rgba(255, 51, 102, 0.2)'
              : timerWarningLevel === 'critical-10'
                ? 'inset 0 0 60px rgba(255, 51, 102, 0.3), inset 0 0 120px rgba(255, 51, 102, 0.15)'
                : 'inset 0 0 40px rgba(255, 170, 0, 0.2), inset 0 0 80px rgba(255, 170, 0, 0.1)',
            animation: timerWarningLevel === 'critical-5'
              ? 'screen-edge-pulse 0.5s ease-in-out infinite'
              : timerWarningLevel === 'critical-10'
                ? 'screen-edge-pulse 1s ease-in-out infinite'
                : 'none',
          }}
        />
      )}

      {/* YOUR TURN Flash Overlay */}
      {showYourTurnFlash && (
        <div
          className="your-turn-flash"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 255, 255, 0.15)',
            pointerEvents: 'none',
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'your-turn-flash-anim 2s ease-out forwards',
          }}
        >
          <div
            style={{
              fontSize: '48px',
              fontWeight: '800',
              color: '#00ffff',
              textShadow: '0 0 30px rgba(0, 255, 255, 0.8), 0 0 60px rgba(0, 255, 255, 0.4)',
              letterSpacing: '8px',
              animation: 'your-turn-text-anim 2s ease-out forwards',
            }}
          >
            YOUR PICK
          </div>
        </div>
      )}

      {/* Main War Room Container - height: 100vh for sticky footer */}
      <div
        className="scanlines"
        style={{
          height: '100vh',
          maxHeight: '100vh',
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
            {/* SnakeConduit - Animated wave snake flowing around players */}
            <SnakeConduit />

            {/* Left opponent - uses sideOpponents to avoid duplicate with center */}
            <PlayerPanel
              username={sideOpponents[0]?.displayName || 'Waiting...'}
              isCurrentPicker={false}
              isNextPicker={sideOpponents[0]?.odUserId === nextPickerId}
              isYou={false}
              isCPU={sideOpponents[0]?.isCPU || false}
              stats={{
                steadyPicked: sideOpponents[0]?.categories?.steady || 0,
                riskyPicked: sideOpponents[0]?.categories?.risky || 0,
                defensivePicked: sideOpponents[0]?.categories?.defensive || 0,
              }}
              lastPick={lastPick?.playerId === sideOpponents[0]?.odUserId ? lastPick?.symbol : null}
            />

            {/* Connection line */}
            <SnakeConnector glowing={false} />

            {/* Current Picker (Center) - shows whoever is currently picking */}
            {(() => {
              const currentPicker = roomDraft?.players?.find(p => p.odUserId === roomDraft?.currentPlayerId);
              const isCurrentUserPicking = currentPicker?.odUserId === currentUserId;
              return (
                <PlayerPanel
                  username={isCurrentUserPicking ? 'YOU' : currentPicker?.displayName || 'Unknown'}
                  isCurrentPicker={true}
                  isNextPicker={false}
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
            <SnakeConnector glowing={false} />

            {/* Right opponent - uses sideOpponents to avoid duplicate with center */}
            <PlayerPanel
              username={sideOpponents[1]?.displayName || 'Waiting...'}
              isCurrentPicker={false}
              isNextPicker={sideOpponents[1]?.odUserId === nextPickerId}
              isYou={false}
              isCPU={sideOpponents[1]?.isCPU || false}
              stats={{
                steadyPicked: sideOpponents[1]?.categories?.steady || 0,
                riskyPicked: sideOpponents[1]?.categories?.risky || 0,
                defensivePicked: sideOpponents[1]?.categories?.defensive || 0,
              }}
              lastPick={lastPick?.playerId === sideOpponents[1]?.odUserId ? lastPick?.symbol : null}
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
            {/* Top opponent - uses sideOpponents to avoid duplicate with center */}
            <PlayerPanel
              username={sideOpponents[0]?.displayName || 'Waiting...'}
              isCurrentPicker={false}
              isNextPicker={sideOpponents[0]?.odUserId === nextPickerId}
              isYou={false}
              isCPU={sideOpponents[0]?.isCPU || false}
              stats={{
                steadyPicked: sideOpponents[0]?.categories?.steady || 0,
                riskyPicked: sideOpponents[0]?.categories?.risky || 0,
                defensivePicked: sideOpponents[0]?.categories?.defensive || 0,
              }}
              compact={true}
            />

            {/* Vertical connector */}
            <SnakeConnectorVertical glowing={false} />

            {/* Current Picker (Center) */}
            {(() => {
              const currentPicker = roomDraft?.players?.find(p => p.odUserId === roomDraft?.currentPlayerId);
              const isCurrentUserPicking = currentPicker?.odUserId === currentUserId;
              return (
                <PlayerPanel
                  username={isCurrentUserPicking ? 'YOU' : currentPicker?.displayName || 'Unknown'}
                  isCurrentPicker={true}
                  isNextPicker={false}
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
            <SnakeConnectorVertical glowing={false} />

            {/* Bottom opponent - uses sideOpponents to avoid duplicate with center */}
            <PlayerPanel
              username={sideOpponents[1]?.displayName || 'Waiting...'}
              isCurrentPicker={false}
              isNextPicker={sideOpponents[1]?.odUserId === nextPickerId}
              isYou={false}
              isCPU={sideOpponents[1]?.isCPU || false}
              stats={{
                steadyPicked: sideOpponents[1]?.categories?.steady || 0,
                riskyPicked: sideOpponents[1]?.categories?.risky || 0,
                defensivePicked: sideOpponents[1]?.categories?.defensive || 0,
              }}
              compact={true}
            />
          </div>

          {/* Last Pick Info - Animated Banner */}
          {lastPick && (
            <div
              className={showLastPickBanner ? 'last-pick-banner-animate' : ''}
              style={{
                textAlign: 'center',
                marginTop: '16px',
                padding: '10px 20px',
                background: showLastPickBanner
                  ? 'linear-gradient(90deg, transparent, rgba(0, 255, 255, 0.15), transparent)'
                  : 'rgba(0, 255, 255, 0.05)',
                border: showLastPickBanner ? '1px solid rgba(0, 255, 255, 0.4)' : '1px solid transparent',
                borderRadius: '6px',
                fontSize: '13px',
                color: '#8b949e',
                transform: showLastPickBanner ? 'translateY(0)' : 'none',
                opacity: 1,
                transition: 'all 0.3s ease',
              }}
            >
              Last Pick: <span style={{ color: '#e6edf3', fontWeight: '600' }}>{lastPick.displayName}</span>
              {' picked '}
              <span style={{
                color: lastPick.category === 'steady' ? '#10b981'
                     : lastPick.category === 'risky' ? '#f59e0b'
                     : '#3b82f6',
                fontWeight: '700',
                textShadow: showLastPickBanner ? `0 0 10px ${lastPick.category === 'steady' ? '#10b981' : lastPick.category === 'risky' ? '#f59e0b' : '#3b82f6'}` : 'none',
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

          {/* Asset Cards Grid - Scrollable with transition */}
          <div style={{
            flex: 1,
            overflow: 'auto',
            padding: '16px',
          }}>
            <div
              className={categoryTransition ? 'category-transition' : ''}
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                gap: '16px',
                maxWidth: '1200px',
                margin: '0 auto',
                justifyItems: 'center',
                opacity: categoryTransition ? 0.5 : 1,
                transform: categoryTransition ? 'translateY(10px)' : 'translateY(0)',
                transition: 'opacity 0.2s ease, transform 0.2s ease',
              }}
            >
              {availableAssets.map((asset) => {
                // Check if this asset was picked by another player
                const pickedInfo = pickedAssets.get(asset.symbol);
                const isLocked = !!pickedInfo;
                const canPick = isMyTurn && canPickFromCategory(selectedDraftCategory);
                const isAssetSelected = selectedAsset?.symbol === asset.symbol;

                // Get sector for color theming
                const assetSector = asset.sector || getStockSector?.(asset.symbol) || 'Technology';

                // Get real-time price from EODHD API (fallback to asset data)
                const upperSymbol = asset.symbol?.toUpperCase();
                const livePrice = livePrices[upperSymbol];
                const displayPrice = livePrice?.price ?? asset.price ?? 0;
                const displayChange = livePrice?.percentChange ?? asset.percentChange ?? asset.change ?? 0;

                return (
                  <HoloAssetCard
                    key={asset.symbol}
                    symbol={asset.symbol}
                    name={asset.name}
                    price={displayPrice}
                    change={displayChange}
                    dataChange={displayChange}
                    volumeChange={displayChange}
                    sector={assetSector}
                    status={isLocked ? 'locked' : 'available'}
                    lockedBy={pickedInfo?.pickedBy}
                    category={selectedDraftCategory}
                    disabled={!canPick}
                    isSelected={isAssetSelected}
                    onSelect={() => handleSelectAsset(asset)}
                    onAcquire={() => handlePick(asset)}
                    onGetInfo={() => setDraftAssetInfoModal({
                      ...asset,
                      price: displayPrice,
                      percentChange: displayChange,
                    })}
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
            flexShrink: 0,
            padding: '12px 16px',
            paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
            borderTop: '1px solid var(--holo-border-bright)',
            background: 'rgba(10, 14, 20, 0.98)',
            backdropFilter: 'blur(10px)',
            display: 'grid',
            gridTemplateColumns: 'auto 1fr auto',
            gap: '16px',
            alignItems: 'center',
            boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.5)',
            zIndex: 10,
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

          {/* Center: Confirm Pick Button */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            <CommandDeckConfirmButton
              selectedAsset={selectedAsset}
              onConfirm={handleConfirmPick}
              isYourTurn={isMyTurn}
              isLoading={isConfirming}
              currentPickerName={
                roomDraft?.players?.find(p => p.odUserId === roomDraft?.currentPlayerId)?.displayName || 'opponent'
              }
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

        {/* Asset Research Modal - Comprehensive asset info with AI Analysis */}
        {draftAssetInfoModal && (
          <AssetResearchModal
            asset={draftAssetInfoModal}
            sector={draftAssetInfoModal.sector || getStockSector?.(draftAssetInfoModal.symbol)}
            category={selectedDraftCategory}
            isMyTurn={isMyTurn}
            timeRemaining={draftTimeRemaining}
            canPick={canPickFromCategory(selectedDraftCategory)}
            onAcquire={(asset) => handlePick(asset)}
            onClose={() => setDraftAssetInfoModal(null)}
          />
        )}

        {/* Responsive Styles & Animations */}
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

          /* Screen edge warning glow pulse */
          @keyframes screen-edge-pulse {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.6;
            }
          }

          /* YOUR TURN flash animations */
          @keyframes your-turn-flash-anim {
            0% {
              opacity: 0;
              background: rgba(0, 255, 255, 0.3);
            }
            15% {
              opacity: 1;
              background: rgba(0, 255, 255, 0.25);
            }
            85% {
              opacity: 1;
              background: rgba(0, 255, 255, 0.1);
            }
            100% {
              opacity: 0;
              background: transparent;
            }
          }

          @keyframes your-turn-text-anim {
            0% {
              opacity: 0;
              transform: scale(0.8);
            }
            20% {
              opacity: 1;
              transform: scale(1.1);
            }
            40% {
              transform: scale(1);
            }
            80% {
              opacity: 1;
              transform: scale(1);
            }
            100% {
              opacity: 0;
              transform: scale(0.9);
            }
          }

          /* Last pick banner slide-in animation */
          .last-pick-banner-animate {
            animation: last-pick-slide-in 0.4s ease-out;
          }

          @keyframes last-pick-slide-in {
            0% {
              opacity: 0;
              transform: translateY(-20px);
            }
            100% {
              opacity: 1;
              transform: translateY(0);
            }
          }

          /* Category transition animation */
          .category-transition {
            animation: category-fade 0.3s ease-out;
          }

          @keyframes category-fade {
            0% {
              opacity: 0.3;
              transform: translateY(15px);
            }
            100% {
              opacity: 1;
              transform: translateY(0);
            }
          }

          /* Mobile roster drawer animations */
          .roster-drawer {
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }

          .roster-drawer-backdrop {
            transition: opacity 0.3s ease, backdrop-filter 0.3s ease;
          }

          /* Reduced motion support */
          @media (prefers-reduced-motion: reduce) {
            .screen-edge-glow,
            .your-turn-flash,
            .last-pick-banner-animate,
            .category-transition,
            .roster-drawer {
              animation: none !important;
              transition: none !important;
            }
          }
        `}</style>
      </div>
    </div>
  );
};

export default DraftRoomScreen;
