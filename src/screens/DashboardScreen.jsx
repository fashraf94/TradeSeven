import React from 'react';
import { motion } from 'framer-motion';
import {
  X,
  Shield,
  Flame,
  LogOut,
  User,
  Rocket,
  Target,
  Copy,
  ChevronDown,
  Trophy,
  Zap,
  ArrowRight,
  Clock,
  Swords,
  GraduationCap
} from 'lucide-react';
import DesktopBackground from '../components/DesktopBackground';
import MarketClashLogo from '../components/MarketClashLogo';
import { getUsername as getPlayerUsername } from '../utils/battleHelpers';

// Helper to get username from battle participant
const getUsername = getPlayerUsername;

const DashboardScreen = ({
  // Layout
  isDesktop,
  containerStyle,
  colors,

  // User
  user,
  logout,
  setUsername,

  // Screen
  setScreen,

  // Game mode
  gameMode,
  setGameMode,

  // Battles
  battles,
  activeBattles,
  waitingBattles,
  completedBattles,
  trainingBattles,
  draftBattles,

  // Battle state
  currentBattle,
  setCurrentBattle,
  currentDraft,
  setCurrentDraft,

  // Challenges
  weeklyChallenges,
  challengeProgress,
  completedWeeklyChallenges,
  activeDailyChallenge,
  acceptChallenge,

  // Notifications
  notifications,
  unreadCount,

  // Modals
  showXPModal,
  setShowXPModal,
  showSlotMachine,
  setShowSlotMachine,
  slotMachineRevealed,
  setSlotMachineRevealed,
  markSlotMachineShown,

  // Sidebar
  sidebarOpen,
  setSidebarOpen,

  // Tour
  showSpotlightTour,
  setShowSpotlightTour,
  tourStep,
  setTourStep,

  // Portfolio reset
  setPortfolio,
  setPortfolioType,
  setPortfolioName,
  setAssetType,
  setSearchTerm,
  setSelectedCrypto,
  setBuilderMode,
  setBuilderCategory,

  // Draft banner
  activeDraftBanner,
  setActiveDraftBanner,

  // Modal visibility flags
  showCreateBattleConfirm,
  setShowCreateBattleConfirm,
  showCreateDraftConfirm,
  setShowCreateDraftConfirm,
  showTrainingConfirmModal,
  setShowTrainingConfirmModal,
  trainingConfirmType,
  setTrainingConfirmType,
  showClassicTrainingConfirm,
  setShowClassicTrainingConfirm,
  showTemplatesModal,
  setShowTemplatesModal,
  showJoinBattleConfirm,
  setShowJoinBattleConfirm,
  showJoinDraftConfirm,
  setShowJoinDraftConfirm,
  showWeeklyChallenges,
  setShowWeeklyChallenges,

  // Utility
  copyToClipboard,
  battleTimer,

  // Overlay components (passed from App.jsx)
  ChallengeToast,
  MidGameChallengePopup,
  RiskChallengePopup,
  RiskChallengeResultPopup,
  SlotMachineContent,
  TutorialModal,
  SpotlightTour
}) => {
  // ============================================
  // Helper Functions
  // ============================================

  // Calculate battle preview data for any battle
  const calculateBattlePreviewData = (battle) => {
    if (!battle) return null;
    const isCreator = getUsername(battle.creator) === user.username;
    const opponent = isCreator ? getUsername(battle.opponent) : getUsername(battle.creator);
    const myPortfolio = isCreator ? battle.creatorPortfolio : battle.opponentPortfolio;
    const theirPortfolio = isCreator ? battle.opponentPortfolio : battle.creatorPortfolio;

    if (!myPortfolio || !theirPortfolio) return null;

    let myValue = 0;
    myPortfolio.forEach(asset => {
      const shares = asset.amount / asset.price;
      myValue += shares * asset.price;
    });

    let theirValue = 0;
    theirPortfolio.forEach(asset => {
      const shares = asset.amount / asset.price;
      theirValue += shares * asset.price;
    });

    const myGain = ((myValue - 1000000) / 1000000) * 100;
    const theirGain = ((theirValue - 1000000) / 1000000) * 100;
    const isWinning = myGain > theirGain;
    const leadBy = Math.abs(myGain - theirGain);

    return { opponent, myGain, theirGain, isWinning, leadBy, myValue, theirValue };
  };

  // ============================================
  // Computed Values
  // ============================================

  // Calculate preview data for all active battles
  const activeBattlesWithData = activeBattles.map(battle => ({
    battle,
    previewData: calculateBattlePreviewData(battle)
  })).filter(item => item.previewData !== null);

  const hasActiveBattle = activeBattlesWithData.length > 0;

  // Filter active draft battles
  const activeDraftBattles = (draftBattles || []).filter(b => b.status === 'active');

  // Filter active training battles
  const activeTrainingBattles = (trainingBattles || []).filter(b => b.status === 'active');

  // XP calculation for modal
  const xpForNextLevel = 10000;
  const xpProgress = (user.xp / xpForNextLevel) * 100;
  const xpNeeded = xpForNextLevel - user.xp;
  const ranks = ['Rookie', 'Apprentice', 'Trader', 'Expert', 'Master', 'Legend'];
  const currentRankIndex = ranks.indexOf(user.rank);
  const nextRank = currentRankIndex < ranks.length - 1 ? ranks[currentRankIndex + 1] : 'Max Rank';

  // ============================================
  // Render
  // ============================================

  return (
    <div style={containerStyle}>
      {/* Animated Desktop Background */}
      <DesktopBackground isDesktop={isDesktop} />

      {/* Global Overlays */}
      {ChallengeToast && <ChallengeToast />}
      {MidGameChallengePopup && <MidGameChallengePopup />}
      {RiskChallengePopup && <RiskChallengePopup />}
      {RiskChallengeResultPopup && <RiskChallengeResultPopup />}
      {showSlotMachine && weeklyChallenges.length >= 4 && SlotMachineContent && (
        <SlotMachineContent
          challenges={weeklyChallenges}
          onClose={() => {
            setShowSlotMachine(false);
            setSlotMachineRevealed(true);
            markSlotMachineShown();
          }}
        />
      )}

      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: colors.background,
        position: 'relative',
        zIndex: 1
      }}>
        {/* XP Progress Modal */}
        {showXPModal && (
          <div
            onClick={() => setShowXPModal(false)}
            style={{
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
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)'
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: colors.cardBg,
                borderRadius: '20px',
                padding: '32px',
                width: '90%',
                maxWidth: '400px',
                border: `1px solid ${colors.border}`,
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                position: 'relative'
              }}
            >
              {/* Close button */}
              <button
                onClick={() => setShowXPModal(false)}
                aria-label="Close modal"
                style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  border: `1px solid ${colors.borderSubtle}`,
                  background: 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: colors.textSecondary,
                  transition: 'all 0.2s'
                }}
              >
                <X style={{ height: '18px', width: '18px' }} />
              </button>

              {/* Rank Icon */}
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  margin: '0 auto 16px',
                  borderRadius: '20px',
                  background: `linear-gradient(135deg, ${colors.cyan}20 0%, ${colors.green}20 100%)`,
                  border: `3px solid ${colors.cyan}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: `0 0 30px ${colors.cyan}40`
                }}>
                  <Shield style={{ height: '40px', width: '40px', color: colors.cyan }} />
                </div>
                <h2 style={{
                  fontSize: '28px',
                  fontWeight: 'bold',
                  color: colors.textPrimary,
                  margin: '0 0 4px 0',
                  textTransform: 'uppercase',
                  letterSpacing: '2px'
                }}>
                  {user.rank}
                </h2>
                <p style={{ fontSize: '14px', color: colors.textSecondary, margin: 0 }}>
                  Level {user.level}
                </p>
              </div>

              {/* XP Progress */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '8px',
                  fontSize: '14px'
                }}>
                  <span style={{ color: colors.textSecondary }}>Experience Points</span>
                  <span style={{ color: colors.cyan, fontWeight: '600' }}>{user.xp} / {xpForNextLevel} XP</span>
                </div>
                <div style={{
                  width: '100%',
                  height: '12px',
                  background: 'rgba(0, 217, 255, 0.1)',
                  borderRadius: '9999px',
                  overflow: 'hidden'
                }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${xpProgress}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    style={{
                      height: '100%',
                      borderRadius: '9999px',
                      background: `linear-gradient(90deg, ${colors.green} 0%, ${colors.cyan} 100%)`,
                      boxShadow: `0 0 10px ${colors.cyan}60`
                    }}
                  />
                </div>
              </div>

              {/* Next Rank Info */}
              <div style={{
                background: 'rgba(0, 0, 0, 0.3)',
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center'
              }}>
                <p style={{ fontSize: '14px', color: colors.textSecondary, margin: '0 0 8px 0' }}>
                  {xpNeeded} XP to next rank
                </p>
                <p style={{ fontSize: '18px', fontWeight: '600', color: colors.green, margin: 0 }}>
                  {nextRank}
                </p>
              </div>
            </motion.div>
          </div>
        )}

        {/* DESKTOP ONLY: Top Header - Static */}
        <div
          className="hidden md:block"
          style={{
            padding: '12px 24px',
            background: 'transparent',
            borderBottom: `1px solid ${colors.borderSubtle}`
          }}
        >
          <div className="max-w-5xl mx-auto">
            <div className="flex justify-between items-center">
              {/* Logo */}
              <div className="flex items-center gap-2.5">
                <Flame className="w-6 h-6" style={{ color: colors.cyan }} />
                <span className="text-xl font-bold" style={{
                  background: `linear-gradient(135deg, ${colors.cyan} 0%, ${colors.greenBright} 100%)`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}>MarketClash</span>
              </div>

              {/* User & Logout */}
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: colors.cardBg, border: `2px solid ${colors.cyan}` }}>
                  <User className="w-3.5 h-3.5" style={{ color: colors.cyan }} />
                </div>
                <span className="text-sm font-medium" style={{ color: colors.textPrimary }}>{user.username}</span>
                <button
                  onClick={() => { logout(); setUsername(''); setScreen('home'); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all"
                  style={{ background: 'transparent', border: `1px solid ${colors.borderSubtle}`, color: colors.textSecondary }}
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Active Draft Banner - Show when user has an ongoing draft */}
        {activeDraftBanner && (
          <div
            onClick={() => {
              setCurrentDraft(activeDraftBanner);
              setActiveDraftBanner(null);
              if (activeDraftBanner.status === 'waiting') {
                setScreen('draftLobby');
              } else if (activeDraftBanner.status === 'active') {
                setScreen('draftRoom');
              }
            }}
            style={{
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              padding: '16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                background: 'rgba(255,255,255,0.2)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px'
              }}>
                ⚠️
              </div>
              <div>
                <div style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '16px' }}>
                  Active Draft in Progress!
                </div>
                <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px' }}>
                  {activeDraftBanner.code} • {activeDraftBanner.type === 'stocks' ? '📈 Stocks' : '🪙 Crypto'} •
                  {activeDraftBanner.status === 'waiting' ? ' Waiting for players' : ' Draft in progress'}
                </div>
              </div>
            </div>

            <button
              style={{
                padding: '10px 20px',
                background: '#ffffff',
                color: '#d97706',
                fontWeight: 'bold',
                fontSize: '14px',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              REJOIN →
            </button>
          </div>
        )}

        {/* Dashboard Header with Hamburger Menu and Logo */}
        <header style={{
          background: 'linear-gradient(180deg, #161b22 0%, #0d1117 100%)',
          borderBottom: '2px solid #21262d',
          padding: '12px 16px',
          position: 'sticky',
          top: 0,
          zIndex: 40
        }}>
          <div style={{
            maxWidth: '900px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>

            {/* Left section with hamburger and Get Started */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Hamburger Menu Button */}
              <button
                id="tour-hamburger-menu"
                onClick={() => setSidebarOpen(true)}
                style={{
                  position: 'relative',
                  minWidth: '44px',
                  minHeight: '44px',
                  padding: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent'
                }}
                aria-label="Open menu"
              >
                {/* Three horizontal cyan lines */}
                <div style={{ width: '24px', height: '2px', backgroundColor: '#00d9ff', borderRadius: '1px' }}></div>
                <div style={{ width: '24px', height: '2px', backgroundColor: '#00d9ff', borderRadius: '1px' }}></div>
                <div style={{ width: '24px', height: '2px', backgroundColor: '#00d9ff', borderRadius: '1px' }}></div>

                {/* Unread notifications badge */}
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    minWidth: '18px',
                    height: '18px',
                    padding: '0 5px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#ef4444',
                    borderRadius: '9px',
                    color: '#ffffff',
                    fontSize: '10px',
                    fontWeight: '700',
                    lineHeight: 1,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                  }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Get Started Button - Opens Spotlight Tour */}
              <button
                onClick={() => {
                  setTourStep(0);
                  setShowSpotlightTour(true);
                }}
                aria-label="Start onboarding tour"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px',
                  padding: '3px 6px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#ffffff',
                  fontSize: '9px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  marginLeft: '6px',
                  marginRight: 'auto',
                  flexShrink: 0
                }}
              >
                <Rocket size={8} />
                <span>Get Started</span>
              </button>
            </div>

            {/* Center - Logo */}
            <div style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              alignItems: 'center'
            }}>
              <MarketClashLogo size="small" />
            </div>

            {/* Right Side - Balance Pill + User Avatar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px 8px'
            }}>
              {/* Coin Balance Pill */}
              <div
                onClick={() => setShowXPModal(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 10px',
                  background: `${colors.gold}15`,
                  border: `1px solid ${colors.gold}40`,
                  borderRadius: '20px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <span style={{ fontSize: '14px' }}>🪙</span>
                <span style={{
                  color: colors.gold,
                  fontWeight: '700',
                  fontSize: '13px',
                  fontFamily: "'SF Mono', 'Monaco', monospace"
                }}>
                  {(user?.xp || 0).toLocaleString()}
                </span>
              </div>

              {/* Avatar Circle */}
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: '#1a1f2e',
                border: `2px solid ${colors.cyan}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: '600',
                color: '#ffffff'
              }}>
                {(user?.username || 'P')[0].toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* Game Mode Toggle - Phase 1: Draft Mode Foundation */}
        <div
          id="tour-game-mode-toggle"
          style={{
            background: '#161b22',
            borderBottom: '1px solid #21262d',
            padding: '12px 16px',
            marginBottom: '16px'
          }}
        >
          <div style={{
            maxWidth: '900px',
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'center',
            gap: '8px'
          }}>
            {/* Snake Draft 4P - LEFT (default) */}
            <button
              id="tour-snake-draft-btn"
              onClick={() => setGameMode('draft')}
              style={{
                padding: '10px 20px',
                borderRadius: '10px',
                border: gameMode === 'draft' ? '2px solid #10b981' : '2px solid #21262d',
                background: gameMode === 'draft' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                color: gameMode === 'draft' ? '#10b981' : '#8b949e',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              🐍 Snake Draft 4P
            </button>
            {/* Builder 1v1 - RIGHT */}
            <button
              id="tour-builder-btn"
              onClick={() => setGameMode('classic')}
              style={{
                padding: '10px 20px',
                borderRadius: '10px',
                border: gameMode === 'classic' ? '2px solid #00d9ff' : '2px solid #21262d',
                background: gameMode === 'classic' ? 'rgba(0, 217, 255, 0.1)' : 'transparent',
                color: gameMode === 'classic' ? '#00d9ff' : '#8b949e',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              ⚔️ Builder 1v1
            </button>
          </div>
        </div>

        {/* Main Content Area - Mobile-first with responsive padding */}
        <div
          id="tour-dashboard-content"
          className="pt-4 md:pt-0 pb-28 md:pb-20 px-4 md:px-6"
          style={{
            flex: 1,
            maxWidth: '900px',
            margin: '0 auto'
          }}
        >
          {/* Active Battles Section - Shows ALL active battles */}
          {hasActiveBattle && (
            <div style={{ marginBottom: '24px' }}>
              {/* Section Header - Only show when multiple battles */}
              {activeBattlesWithData.length > 1 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: '16px'
                }}>
                  <Swords style={{ height: '18px', width: '18px', color: colors.cyan }} />
                  <span style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: colors.textPrimary,
                    textTransform: 'uppercase',
                    letterSpacing: '1px'
                  }}>
                    Active Battles
                  </span>
                  <span style={{
                    background: `${colors.cyan}30`,
                    color: colors.cyan,
                    padding: '2px 10px',
                    borderRadius: '10px',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}>
                    {activeBattlesWithData.length}
                  </span>
                </div>
              )}

              {/* Render ALL active battle cards */}
              {activeBattlesWithData.map(({ battle, previewData }, index) => (
                <motion.div
                  key={battle.id || battle.firestoreId || index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  style={{
                    background: colors.cardBg,
                    borderRadius: '16px',
                    padding: '20px 24px',
                    marginBottom: index < activeBattlesWithData.length - 1 ? '12px' : 0,
                    border: `1px solid ${battle.isTrainingBattle ? colors.purple + '60' : colors.border}`,
                    cursor: 'pointer',
                    transition: 'all 0.3s'
                  }}
                  onClick={() => {
                    setCurrentBattle(battle);
                    setScreen('battle');
                  }}
                >
                  {/* Battle Header */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '20px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {battle.isTrainingBattle && <GraduationCap style={{ height: '16px', width: '16px', color: colors.purple }} />}
                      <span style={{
                        fontSize: '13px',
                        fontWeight: '600',
                        color: colors.textSecondary,
                        textTransform: 'uppercase',
                        letterSpacing: '1px'
                      }}>
                        {battle.isTrainingBattle ? 'TRAINING' : 'BATTLE'}: vs {previewData.opponent}
                      </span>
                    </div>
                    <span style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: colors.cyan,
                      fontFamily: "'SF Mono', 'Monaco', monospace"
                    }}>
                      {battleTimer.formatTimeRemaining(battle)} left
                    </span>
                  </div>

                  {/* Player Comparison */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '16px'
                  }}>
                    {/* You */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        background: `linear-gradient(135deg, ${colors.green}30 0%, ${colors.cyan}30 100%)`,
                        border: `2px solid ${colors.green}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <User style={{ height: '20px', width: '20px', color: colors.green }} />
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', color: colors.textSecondary }}>YOU ({user.username})</div>
                        <div style={{
                          fontSize: '24px',
                          fontWeight: 'bold',
                          color: previewData.myGain >= 0 ? colors.green : colors.red
                        }}>
                          {previewData.myGain >= 0 ? '+' : ''}{previewData.myGain.toFixed(1)}%
                        </div>
                      </div>
                    </div>

                    {/* Opponent */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexDirection: 'row-reverse' }}>
                      <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        background: `linear-gradient(135deg, ${colors.red}30 0%, ${colors.purple}30 100%)`,
                        border: `2px solid ${colors.red}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Target style={{ height: '20px', width: '20px', color: colors.red }} />
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '13px', color: colors.textSecondary }}>OPPONENT</div>
                        <div style={{
                          fontSize: '24px',
                          fontWeight: 'bold',
                          color: previewData.theirGain >= 0 ? colors.green : colors.red
                        }}>
                          {previewData.theirGain >= 0 ? '+' : ''}{previewData.theirGain.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div style={{
                    position: 'relative',
                    height: '8px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '9999px',
                    overflow: 'hidden',
                    marginBottom: '12px'
                  }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(previewData.myValue / (previewData.myValue + previewData.theirValue)) * 100}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                      style={{
                        position: 'absolute',
                        height: '100%',
                        borderRadius: '9999px',
                        background: previewData.isWinning
                          ? 'linear-gradient(90deg, #4ADE80 0%, #10B981 100%)'
                          : 'linear-gradient(90deg, #EF4444 0%, #DC2626 100%)'
                      }}
                    />
                  </div>

                  {/* Status & Button */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span style={{
                      fontSize: '13px',
                      fontWeight: '600',
                      color: previewData.isWinning ? colors.green : colors.red
                    }}>
                      {previewData.isWinning ? `LEADING BY +${previewData.leadBy.toFixed(1)}%` : `TRAILING BY -${previewData.leadBy.toFixed(1)}%`}
                    </span>
                    <button
                      style={{
                        padding: '8px 16px',
                        background: battle.isTrainingBattle ? colors.purple : colors.cyan,
                        border: 'none',
                        borderRadius: '8px',
                        color: colors.background,
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      VIEW BATTLE
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Waiting Battles Section */}
          {waitingBattles.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{
                color: colors.cyan,
                fontSize: '14px',
                fontWeight: '600',
                marginBottom: '12px',
                textTransform: 'uppercase',
                letterSpacing: '1px'
              }}>
                ⏳ Waiting for Opponent
              </h3>
              {waitingBattles.map((battle, index) => (
                <div
                  key={battle.id || index}
                  style={{
                    background: colors.cardBg,
                    borderRadius: '12px',
                    padding: '16px',
                    marginBottom: '8px',
                    border: `1px solid ${colors.border}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ color: colors.textPrimary, fontWeight: '600', marginBottom: '4px' }}>
                      {battle.portfolioName || 'Battle'}
                    </div>
                    <div style={{ color: colors.textSecondary, fontSize: '13px' }}>
                      Code: <span style={{ color: colors.cyan, fontFamily: 'monospace' }}>{battle.challengeCode}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => copyToClipboard(battle.challengeCode)}
                    style={{
                      padding: '8px 12px',
                      background: 'transparent',
                      border: `1px solid ${colors.cyan}`,
                      borderRadius: '8px',
                      color: colors.cyan,
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Copy size={14} />
                    Copy
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              COMPETE SECTION - Primary game modes (more prominent)
              ═══════════════════════════════════════════════════════════════ */}
          <div style={{ marginBottom: '24px' }}>
            {/* Section Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '16px',
              paddingBottom: '12px',
              borderBottom: `1px solid ${colors.borderSubtle}`
            }}>
              <Swords style={{ height: '16px', width: '16px', color: colors.cyan }} />
              <span style={{
                fontSize: '12px',
                fontWeight: '600',
                color: colors.textMuted,
                textTransform: 'uppercase',
                letterSpacing: '1.5px'
              }}>
                Compete
              </span>
              <span style={{
                fontSize: '11px',
                color: colors.textMuted,
                fontWeight: '400'
              }}>
                — Challenge friends or rivals
              </span>
            </div>

            {/* Create/Join Battle Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            {/* Create Battle Card */}
            <div
              onClick={() => {
                setPortfolio([]);
                setPortfolioType(null);
                setPortfolioName('');
                setSelectedCrypto(null);
                setBuilderMode('create');
                setBuilderCategory('Leadership');
                if (gameMode === 'draft') {
                  setShowCreateDraftConfirm(true);
                } else {
                  setScreen('builder');
                }
              }}
              style={{
                background: 'linear-gradient(135deg, rgba(0, 217, 255, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%)',
                border: '2px solid #00d9ff',
                borderRadius: '16px',
                padding: '20px',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>⚔️</div>
              <div style={{ color: '#00d9ff', fontWeight: '700', fontSize: '16px' }}>
                Create Battle
              </div>
              <div style={{ color: '#8b949e', fontSize: '12px', marginTop: '4px' }}>
                {gameMode === 'draft' ? 'Start a Snake Draft' : 'Build your portfolio'}
              </div>
            </div>

            {/* Join Battle Card */}
            <div
              onClick={() => {
                if (gameMode === 'draft') {
                  setShowJoinDraftConfirm(true);
                } else {
                  setShowJoinBattleConfirm(true);
                }
              }}
              style={{
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%)',
                border: '2px solid #8b5cf6',
                borderRadius: '16px',
                padding: '20px',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎯</div>
              <div style={{ color: '#8b5cf6', fontWeight: '700', fontSize: '16px' }}>
                Join Battle
              </div>
              <div style={{ color: '#8b949e', fontSize: '12px', marginTop: '4px' }}>
                Enter a battle code
              </div>
            </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              EARN COINS SECTION - Low-risk ways to build balance
              ═══════════════════════════════════════════════════════════════ */}
          <div style={{ marginBottom: '24px' }}>
            {/* Section Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '16px',
              paddingBottom: '12px',
              borderBottom: `1px solid ${colors.borderSubtle}`
            }}>
              <Zap style={{ height: '16px', width: '16px', color: colors.gold }} />
              <span style={{
                fontSize: '12px',
                fontWeight: '600',
                color: colors.textMuted,
                textTransform: 'uppercase',
                letterSpacing: '1.5px'
              }}>
                Earn Coins
              </span>
              <span style={{
                fontSize: '11px',
                color: colors.textMuted,
                fontWeight: '400'
              }}>
                — Low-risk ways to build your balance
              </span>
            </div>

            {/* Training Mode Card */}
            <div
              onClick={() => {
                setTrainingConfirmType('stocks');
                setShowTrainingConfirmModal(true);
              }}
              style={{
                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.08) 0%, rgba(139, 92, 246, 0.08) 100%)',
                border: `1px solid ${colors.purple}50`,
                borderRadius: '12px',
                padding: '16px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '14px'
              }}
            >
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                background: `${colors.purple}20`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '22px',
                flexShrink: 0
              }}>
                🤖
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  color: colors.purple,
                  fontWeight: '600',
                  fontSize: '15px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <GraduationCap size={14} />
                  Training Mode
                </div>
                <div style={{ color: colors.textMuted, fontSize: '12px', marginTop: '2px' }}>
                  Practice vs CPU to hone your skills
                </div>
              </div>
              <ArrowRight style={{ height: '16px', width: '16px', color: colors.textMuted }} />
            </div>
          </div>

          {/* Weekly Challenges Section */}
          {weeklyChallenges && weeklyChallenges.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <button
                onClick={() => setShowWeeklyChallenges(!showWeeklyChallenges)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: colors.cardBg,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '12px',
                  cursor: 'pointer',
                  marginBottom: showWeeklyChallenges ? '12px' : 0
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Trophy style={{ height: '18px', width: '18px', color: '#f59e0b' }} />
                  <span style={{ color: colors.textPrimary, fontWeight: '600' }}>
                    Weekly Challenges
                  </span>
                  <span style={{
                    background: '#f59e0b30',
                    color: '#f59e0b',
                    padding: '2px 8px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}>
                    {weeklyChallenges.length}
                  </span>
                </div>
                <ChevronDown
                  style={{
                    height: '20px',
                    width: '20px',
                    color: colors.textSecondary,
                    transform: showWeeklyChallenges ? 'rotate(180deg)' : 'rotate(0)',
                    transition: 'transform 0.2s'
                  }}
                />
              </button>

              {showWeeklyChallenges && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {weeklyChallenges.map((challenge, index) => (
                    <div
                      key={challenge.id || index}
                      style={{
                        background: colors.cardBg,
                        border: `1px solid ${colors.border}`,
                        borderRadius: '12px',
                        padding: '16px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ color: colors.textPrimary, fontWeight: '600', marginBottom: '4px' }}>
                            {challenge.title}
                          </div>
                          <div style={{ color: colors.textSecondary, fontSize: '13px' }}>
                            {challenge.description}
                          </div>
                        </div>
                        <div style={{
                          background: '#f59e0b30',
                          color: '#f59e0b',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: '700'
                        }}>
                          +{challenge.xpReward} XP
                        </div>
                      </div>
                      <button
                        onClick={() => acceptChallenge && acceptChallenge(challenge)}
                        style={{
                          width: '100%',
                          padding: '10px',
                          background: '#f59e0b',
                          border: 'none',
                          borderRadius: '8px',
                          color: '#000',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        Accept Challenge
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Completed Battles Preview */}
          {completedBattles.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{
                color: colors.textSecondary,
                fontSize: '14px',
                fontWeight: '600',
                marginBottom: '12px',
                textTransform: 'uppercase',
                letterSpacing: '1px'
              }}>
                Recent Results
              </h3>
              {completedBattles.slice(0, 3).map((battle, index) => (
                <div
                  key={battle.id || index}
                  onClick={() => {
                    setCurrentBattle(battle);
                    setScreen('battle');
                  }}
                  style={{
                    background: colors.cardBg,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '12px',
                    padding: '12px 16px',
                    marginBottom: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '20px' }}>
                      {battle.winner === user.username ? '🏆' : '😤'}
                    </span>
                    <div>
                      <div style={{ color: colors.textPrimary, fontWeight: '600', fontSize: '14px' }}>
                        vs {battle.opponent || 'Opponent'}
                      </div>
                      <div style={{ color: colors.textSecondary, fontSize: '12px' }}>
                        {battle.portfolioName}
                      </div>
                    </div>
                  </div>
                  <ArrowRight style={{ height: '16px', width: '16px', color: colors.textSecondary }} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tutorial Modal */}
        {TutorialModal && <TutorialModal />}

        {/* Spotlight Tour */}
        {SpotlightTour && <SpotlightTour />}
      </div>
    </div>
  );
};

export default DashboardScreen;
