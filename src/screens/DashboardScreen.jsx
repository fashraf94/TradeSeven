// /src/screens/DashboardScreen.jsx

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Plus,
  Users,
  Bot,
  Trophy,
  Clock,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  Zap,
  Target,
  Sparkles,
  Calendar,
  Settings,
  User,
  LogOut,
  Flame,
  Swords,
  GraduationCap,
  Shield,
  X,
  Rocket
} from 'lucide-react';
import { useUser } from '../contexts/UserContext';

// Import Dashboard components
import {
  SlotMachineOverlay,
  SpotlightTour,
  MarketBriefing
} from '../components/Dashboard';

/**
 * DashboardScreen - Main hub after login
 *
 * This is the main screen users see after logging in.
 * Features game mode toggle (Classic vs Draft), quick actions,
 * active battles, draft battles, training battles, and more.
 *
 * @param {Object} props
 * @param {Function} props.onNavigate - Handler to navigate to different screens
 * @param {Array} props.stocksData - Stock data array
 * @param {Array} props.cryptoData - Crypto data array
 * @param {Object} props.user - Current user object
 * @param {string} props.gameMode - Current game mode ('classic' or 'draft')
 * @param {Function} props.setGameMode - Handler to change game mode
 * @param {Object} props.colors - Design tokens
 * @param {boolean} props.isDesktop - Whether on desktop view
 * @param {Object} props.containerStyle - Container style from App
 * @param {Array} props.activeBattles - Array of active battles
 * @param {Array} props.waitingBattles - Array of waiting battles
 * @param {Array} props.completedBattles - Array of completed battles
 * @param {Array} props.activeDraftBattles - Array of active draft battles
 * @param {Array} props.activeTrainingBattles - Array of active training battles
 * @param {Object} props.battleTimer - Battle timer utility
 * @param {Function} props.setCurrentBattle - Handler to set current battle
 * @param {Function} props.setCurrentDraft - Handler to set current draft
 * @param {Function} props.setScreen - Handler to set screen
 * @param {Object} props.activeDraftBanner - Active draft banner data
 * @param {Function} props.setActiveDraftBanner - Handler for draft banner
 * @param {boolean} props.showXPModal - Whether XP modal is shown
 * @param {Function} props.setShowXPModal - Handler for XP modal
 * @param {boolean} props.sidebarOpen - Whether sidebar is open
 * @param {Function} props.setSidebarOpen - Handler for sidebar
 * @param {number} props.unreadCount - Unread notification count
 * @param {boolean} props.showSpotlightTour - Whether tour is shown
 * @param {Function} props.setShowSpotlightTour - Handler for tour
 * @param {number} props.tourStep - Current tour step
 * @param {Function} props.setTourStep - Handler for tour step
 * @param {Array} props.TOUR_STEPS - Tour steps config
 * @param {Function} props.logout - Logout handler
 * @param {Function} props.setUsername - Handler to set username
 * @param {Function} props.getUsername - Helper to get username
 * @param {boolean} props.showCreateDraftConfirm - Show create draft confirm
 * @param {Function} props.setShowCreateDraftConfirm - Handler for create draft confirm
 * @param {boolean} props.showJoinDraftConfirm - Show join draft confirm
 * @param {Function} props.setShowJoinDraftConfirm - Handler for join draft confirm
 * @param {React.Component} props.DesktopBackground - Desktop background component
 * @param {React.Component} props.ChallengeToast - Challenge toast component
 * @param {React.Component} props.MidGameChallengePopup - Mid game challenge popup
 * @param {React.Component} props.RiskChallengePopup - Risk challenge popup
 * @param {React.Component} props.RiskChallengeResultPopup - Risk challenge result popup
 * @param {React.Component} props.MarketClashLogo - Logo component
 * @param {React.Component} props.TutorialModal - Tutorial modal component
 * @param {React.Component} props.ConfirmationPopup - Confirmation popup component
 * @param {Function} props.debugBattles - Debug battles helper
 * @param {Array} props.battles - All battles array
 */
const DashboardScreen = ({
  onNavigate,
  stocksData = [],
  cryptoData = [],
  user,
  gameMode,
  setGameMode,
  colors,
  isDesktop,
  containerStyle,
  activeBattles = [],
  waitingBattles = [],
  completedBattles = [],
  activeDraftBattles = [],
  activeTrainingBattles = [],
  battleTimer,
  setCurrentBattle,
  setCurrentDraft,
  setScreen,
  activeDraftBanner,
  setActiveDraftBanner,
  showXPModal,
  setShowXPModal,
  sidebarOpen,
  setSidebarOpen,
  unreadCount = 0,
  showSpotlightTour,
  setShowSpotlightTour,
  tourStep,
  setTourStep,
  TOUR_STEPS = [],
  logout,
  setUsername,
  getUsername,
  showCreateDraftConfirm,
  setShowCreateDraftConfirm,
  showJoinDraftConfirm,
  setShowJoinDraftConfirm,
  DesktopBackground,
  ChallengeToast,
  MidGameChallengePopup,
  RiskChallengePopup,
  RiskChallengeResultPopup,
  MarketClashLogo,
  TutorialModal,
  ConfirmationPopup,
  debugBattles,
  battles = []
}) => {
  // Helper function to calculate battle preview data
  const calculateBattlePreviewData = (battle) => {
    if (!battle) return null;
    const isCreator = getUsername?.(battle.creator) === user?.username;
    const opponent = isCreator ? getUsername?.(battle.opponent) : getUsername?.(battle.creator);
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

  // Calculate preview data for all active battles
  const activeBattlesWithData = activeBattles.map(battle => ({
    battle,
    previewData: calculateBattlePreviewData(battle)
  })).filter(item => item.previewData !== null);

  const hasActiveBattle = activeBattlesWithData.length > 0;

  // XP calculation for modal
  const xpForNextLevel = 10000;
  const xpProgress = ((user?.xp || 0) / xpForNextLevel) * 100;
  const xpNeeded = xpForNextLevel - (user?.xp || 0);
  const ranks = ['Rookie', 'Apprentice', 'Trader', 'Expert', 'Master', 'Legend'];
  const currentRankIndex = ranks.indexOf(user?.rank || 'Rookie');
  const nextRank = currentRankIndex < ranks.length - 1 ? ranks[currentRankIndex + 1] : 'Max Rank';
  const currentUserId = user?.odUserId || user?.username;

  return (
    <div style={containerStyle}>
      {/* Animated Desktop Background */}
      {DesktopBackground && <DesktopBackground isDesktop={isDesktop} />}

      {/* Global Overlays */}
      {ChallengeToast && <ChallengeToast />}
      {MidGameChallengePopup && <MidGameChallengePopup />}
      {RiskChallengePopup && <RiskChallengePopup />}
      {RiskChallengeResultPopup && <RiskChallengeResultPopup />}
      <SlotMachineOverlay />

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
                  color: colors.textSecondary
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
                  {user?.rank || 'Rookie'}
                </h2>
                <p style={{ fontSize: '14px', color: colors.textSecondary, margin: 0 }}>
                  Level {user?.level || 1}
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
                  <span style={{ color: colors.cyan, fontWeight: '600' }}>{user?.xp || 0} / {xpForNextLevel} XP</span>
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

        {/* DESKTOP ONLY: Top Header */}
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
                <span className="text-sm font-medium" style={{ color: colors.textPrimary }}>{user?.username}</span>
                <button
                  onClick={() => { logout?.(); setUsername?.(''); setScreen?.('home'); }}
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

        {/* Active Draft Banner */}
        {activeDraftBanner && (
          <div
            onClick={() => {
              setCurrentDraft?.(activeDraftBanner);
              setActiveDraftBanner?.(null);
              if (activeDraftBanner.status === 'waiting') {
                setScreen?.('draftLobby');
              } else if (activeDraftBanner.status === 'active') {
                setScreen?.('draftRoom');
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
                onClick={() => setSidebarOpen?.(true)}
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
                  cursor: 'pointer'
                }}
                aria-label="Open menu"
              >
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
                    fontWeight: '700'
                  }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Get Started Button */}
              <button
                onClick={() => {
                  setTourStep?.(0);
                  setShowSpotlightTour?.(true);
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
                  whiteSpace: 'nowrap'
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
              {MarketClashLogo && <MarketClashLogo size="small" />}
            </div>

            {/* Right Side - User Info with Avatar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '4px 8px'
            }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: '#1a1f2e',
                border: '2px solid #00d9ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                fontWeight: '600',
                color: '#ffffff'
              }}>
                {(user?.username || 'P')[0].toUpperCase()}
              </div>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start'
              }}>
                <span style={{
                  color: '#ffffff',
                  fontWeight: '600',
                  fontSize: '14px'
                }}>
                  {user?.username || 'Player'}
                </span>
                <span style={{
                  color: '#8b949e',
                  fontSize: '12px',
                  fontWeight: '500'
                }}>
                  {user?.rank || 'Rookie'}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Game Mode Toggle */}
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
              onClick={() => setGameMode?.('draft')}
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
              onClick={() => setGameMode?.('classic')}
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

        {/* Main Content Area */}
        <div
          id="tour-dashboard-content"
          className="pt-4 md:pt-0 pb-28 md:pb-20 px-4 md:px-6"
          style={{
            flex: 1,
            maxWidth: '900px',
            margin: '0 auto'
          }}
        >
          {/* Active Battles Section */}
          {hasActiveBattle && (
            <div style={{ marginBottom: '24px' }}>
              {/* Section Header */}
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
                    setCurrentBattle?.(battle);
                    setScreen?.('battle');
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
                      {battle._v === 2 && (
                        <span style={{
                          background: `${colors.purple}30`,
                          color: colors.purple,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: '700'
                        }}>
                          BB
                        </span>
                      )}
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
                      {battleTimer?.formatTimeRemaining?.(battle) || '?'} left
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
                        <div style={{ fontSize: '13px', color: colors.textSecondary }}>YOU ({user?.username})</div>
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
                        cursor: 'pointer'
                      }}
                    >
                      VIEW BATTLE
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Active Draft Battles Section */}
          {activeDraftBattles.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{
                color: '#10b981',
                fontSize: '16px',
                fontWeight: 'bold',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                🐍 Active Draft Battles
              </h3>

              {activeDraftBattles.map(battle => {
                const endTime = battle.battleEndTime ? new Date(battle.battleEndTime) : null;
                const now = new Date();
                let timeRemaining = '';

                if (endTime) {
                  const diff = endTime - now;
                  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

                  if (days > 0) {
                    timeRemaining = `${days}d ${hours}h left`;
                  } else if (hours > 0) {
                    timeRemaining = `${hours}h ${minutes}m left`;
                  } else {
                    timeRemaining = `${minutes}m left`;
                  }
                }

                const playerCount = battle.players?.length || 4;
                const humanCount = battle.players?.filter(p => !p.isCPU).length || 1;
                const cpuCount = playerCount - humanCount;

                return (
                  <div
                    key={battle.id}
                    onClick={() => {
                      setCurrentDraft?.(battle);
                      setScreen?.('draftBattle');
                    }}
                    style={{
                      background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%)',
                      border: '2px solid #10b981',
                      borderRadius: '16px',
                      padding: '16px',
                      marginBottom: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {/* Header Row */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '12px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '24px' }}>🐍</span>
                        <div>
                          <div style={{ color: '#10b981', fontWeight: 'bold', fontSize: '16px' }}>
                            {battle.code || 'Draft Battle'}
                          </div>
                          <div style={{ color: '#8b949e', fontSize: '12px' }}>
                            {battle.type === 'stocks' ? '📈 Stocks' : '🪙 Crypto'} • {playerCount} Players
                          </div>
                        </div>
                      </div>
                      <div style={{
                        background: 'rgba(16, 185, 129, 0.2)',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        color: '#10b981',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}>
                        ⏱️ {timeRemaining}
                      </div>
                    </div>

                    {/* Players Row */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                      {battle.players?.slice(0, 4).map((player, idx) => {
                        const isMe = player.odUserId === currentUserId;
                        return (
                          <div
                            key={idx}
                            style={{
                              background: isMe ? 'rgba(0, 217, 255, 0.2)' : '#21262d',
                              border: isMe ? '1px solid #00d9ff' : '1px solid #30363d',
                              borderRadius: '6px',
                              padding: '4px 10px',
                              fontSize: '12px',
                              color: isMe ? '#00d9ff' : '#8b949e',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            {player.isCPU ? '🤖' : '👤'}
                            {isMe ? 'You' : (player.displayName?.slice(0, 8) || 'Player')}
                          </div>
                        );
                      })}
                    </div>

                    {/* View Battle Button */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ color: '#6e7681', fontSize: '11px' }}>
                        {humanCount} human{humanCount !== 1 ? 's' : ''} • {cpuCount} CPU{cpuCount !== 1 ? 's' : ''}
                      </div>
                      <div style={{
                        color: '#10b981',
                        fontWeight: 'bold',
                        fontSize: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        View Battle →
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Quick Action Cards - Based on Game Mode */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{
              color: colors.textPrimary,
              fontSize: '16px',
              fontWeight: 'bold',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              {gameMode === 'draft' ? '🐍 Snake Draft Actions' : '⚔️ Classic Battle Actions'}
            </h3>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '12px'
            }}>
              {gameMode === 'draft' ? (
                <>
                  <button
                    id="tour-create-draft"
                    onClick={() => setShowCreateDraftConfirm?.(true)}
                    style={{
                      padding: '20px 12px',
                      borderRadius: '12px',
                      border: 'none',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: '#fff',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <Plus size={24} />
                    <span style={{ fontSize: '12px', fontWeight: '600' }}>Create</span>
                  </button>
                  <button
                    id="tour-join-draft"
                    onClick={() => setShowJoinDraftConfirm?.(true)}
                    style={{
                      padding: '20px 12px',
                      borderRadius: '12px',
                      border: `1px solid ${colors.borderSubtle}`,
                      background: colors.cardBg,
                      color: colors.textPrimary,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <Users size={24} />
                    <span style={{ fontSize: '12px', fontWeight: '600' }}>Join</span>
                  </button>
                  <button
                    onClick={() => setScreen?.('draftTraining')}
                    style={{
                      padding: '20px 12px',
                      borderRadius: '12px',
                      border: `1px solid ${colors.borderSubtle}`,
                      background: colors.cardBg,
                      color: colors.textPrimary,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <Bot size={24} />
                    <span style={{ fontSize: '12px', fontWeight: '600' }}>Training</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    id="tour-create-battle"
                    onClick={() => setScreen?.('builder')}
                    style={{
                      padding: '20px 12px',
                      borderRadius: '12px',
                      border: 'none',
                      background: `linear-gradient(135deg, ${colors.cyan} 0%, #0099cc 100%)`,
                      color: colors.background,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <Plus size={24} />
                    <span style={{ fontSize: '12px', fontWeight: '600' }}>Create</span>
                  </button>
                  <button
                    id="tour-join-battle"
                    onClick={() => setScreen?.('join')}
                    style={{
                      padding: '20px 12px',
                      borderRadius: '12px',
                      border: `1px solid ${colors.borderSubtle}`,
                      background: colors.cardBg,
                      color: colors.textPrimary,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <Users size={24} />
                    <span style={{ fontSize: '12px', fontWeight: '600' }}>Join</span>
                  </button>
                  <button
                    onClick={() => setScreen?.('training')}
                    style={{
                      padding: '20px 12px',
                      borderRadius: '12px',
                      border: `1px solid ${colors.borderSubtle}`,
                      background: colors.cardBg,
                      color: colors.textPrimary,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <Bot size={24} />
                    <span style={{ fontSize: '12px', fontWeight: '600' }}>Training</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Market Briefing */}
          <MarketBriefing
            colors={colors}
            stocksData={stocksData}
            cryptoData={cryptoData}
          />
        </div>

        {/* Confirmation Popups */}
        {ConfirmationPopup && showCreateDraftConfirm && (
          <ConfirmationPopup
            show={showCreateDraftConfirm}
            onClose={() => setShowCreateDraftConfirm?.(false)}
            onConfirm={() => {
              setShowCreateDraftConfirm?.(false);
              setScreen?.('draftSetup');
            }}
            icon={<Plus size={32} style={{ color: '#ffffff' }} />}
            iconBgColor="#10b981"
            title="Create Snake Draft?"
            subtitle="Host a draft lobby for 4 players"
            details={[
              { label: 'Players', value: '4 players' },
              { label: 'Picks', value: '9 per player' },
              { label: 'Time per pick', value: '2 minutes' },
              { label: 'Rewards', value: '+150 XP (1st) / +100 XP (2nd)', highlight: true, highlightColor: '#f59e0b' }
            ]}
            confirmText="Create Draft"
            confirmColor="#10b981"
            tutorialModeType="draft"
          />
        )}

        {ConfirmationPopup && showJoinDraftConfirm && (
          <ConfirmationPopup
            show={showJoinDraftConfirm}
            onClose={() => setShowJoinDraftConfirm?.(false)}
            onConfirm={() => {
              setShowJoinDraftConfirm?.(false);
              setScreen?.('draftJoin');
            }}
            icon={<Users size={32} style={{ color: '#ffffff' }} />}
            iconBgColor="#10b981"
            title="Join Snake Draft?"
            subtitle="Enter a draft code to join a lobby"
            details={[
              { label: 'Players', value: '4 players' },
              { label: 'Picks', value: '9 per player' },
              { label: 'Time per pick', value: '2 minutes' },
              { label: 'Rewards', value: '+150 XP (1st) / +100 XP (2nd)', highlight: true, highlightColor: '#f59e0b' }
            ]}
            confirmText="Join Draft"
            confirmColor="#10b981"
            tutorialModeType="draft"
          />
        )}

        {/* Tutorial Modal */}
        {TutorialModal && <TutorialModal />}

        {/* Spotlight Tour */}
        <SpotlightTour />
      </div>
    </div>
  );
};

export default DashboardScreen;
