/**
 * EarningsGameScreen.jsx
 *
 * Main screen for EarningsGame mode with parlay system.
 * Users select outcome (beat/miss) + magnitude (up big, up, flat, down, down big)
 *
 * Phase 1 Refactor: Integrated useEarningsGame hook, Framer Motion, and new shared components
 * Phase 2 Refactor: Integrated EarningsCalendar component for calendar view
 * Phase 3 Refactor: Integrated ParlayArchitectModal with BeatMissToggle, MagnitudePillars, PredictionSummary
 * Phase 4 Refactor: Integrated PortfolioWarRoom with PowerMeter, RiskProfile, PredictionCard
 * Phase 5 Refactor: Integrated LiveMatchArena with MagnitudeGauge, PositionBanner, LeaderboardModal
 * Phase 6 Refactor: Integrated TournamentResults with ResultCard for end-of-week results display
 */

import React, { useState, useEffect, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEarningsGame } from '../hooks/useEarningsGame';
import { useTournament } from '../hooks/useTournament';
import { getHybridEarningsCalendar } from '../services/earningsCalendarService';
import {
  designColors,
  fontMono,
  BUDGET,
  MIN_PREDICTIONS,
  MAX_PREDICTIONS,
  BRACKETS,
  EarningsCalendar,
  ParlayArchitectModal,
  PortfolioWarRoom,
  LiveMatchArena,
  LeaderboardModal,
  TournamentResults,
  EntrySelector
} from '../components/earningsGame';

const EarningsGameScreen = ({
  user,
  onBack,
  setScreen,
  colors = {},
  isDesktop = false
}) => {
  console.log('[EarningsGame] ====== COMPONENT MOUNTING ======');
  console.log('[EarningsGame] user:', user?.odUserId);

  // Track mount/unmount
  useEffect(() => {
    console.log('[EarningsGame] *** MOUNTED (effect cleanup registered) ***');
    return () => {
      console.log('[EarningsGame] *** UNMOUNTING ***');
    };
  }, []);

  // Use the hook for portfolio state management
  const {
    predictions,
    addPrediction,
    removePrediction,
    lockPortfolio,
    isLocked,
    totalSpent,
    budgetRemaining,
    totalPotentialPoints,
    isValid,
    validationMessage,
    reset,
    clearPortfolio,
  } = useEarningsGame(user?.odUserId);

  // Tournament state from Firebase (with multi-entry support)
  const {
    tournament,
    userEntry,           // Best entry (backward compat)
    userEntries,         // All entries array
    activeEntry,         // Currently selected entry
    activeEntryId,
    leaderboard: tournamentLeaderboard,
    isLoading: tournamentLoading,
    isDeadlinePassed,
    userRank,
    userBracket,
    hasEntered,
    canCreateEntry,
    entriesCount,
    deadlineFormatted,
    entryCount,
    MAX_ENTRIES_PER_USER,
    // Actions
    createEntry,
    selectEntry,
    enterTournament,
    refreshLeaderboard,
    refreshUserEntries,
  } = useTournament(user?.odUserId);

  // View state for navigation between screens
  const [view, setView] = useState('tournament'); // 'tournament' | 'calendar' | 'portfolio' | 'arena' | 'results'

  // Events and loading state
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal state
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedOutcome, setSelectedOutcome] = useState(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  // User position from tournament data (real from Firebase)
  const userPosition = useMemo(() => ({
    rank: userRank || 0,
    points: userEntry?.totalPoints || totalPotentialPoints,
    bracket: userBracket?.tier || 'participant',
    movement: 0, // TODO: Calculate from previous rank
  }), [userRank, userEntry, totalPotentialPoints, userBracket]);

  // Leaderboard data (real from Firebase, with current user highlighted)
  const leaderboardData = useMemo(() => {
    if (!tournamentLeaderboard || tournamentLeaderboard.length === 0) {
      // Fallback empty state
      return [];
    }
    return tournamentLeaderboard.map((entry, index) => ({
      odId: entry.odUserId,
      rank: entry.rank || index + 1,
      bracket: entry.bracket || 'participant',
      username: entry.username || 'Anonymous',
      points: entry.totalPoints || 0,
    }));
  }, [tournamentLeaderboard]);


  // Load earnings data
  console.log('[EarningsGame] Registering useEffect for data load...');
  useEffect(() => {
    console.log('[EarningsGame] >>>>>>> useEffect FIRED! <<<<<<<');
    const loadData = async () => {
      console.log('[EarningsGame] loadData() called');
      console.log('[EarningsGame] About to call getHybridEarningsCalendar...');
      try {
        const data = await getHybridEarningsCalendar(14);
        console.log('[EarningsGame] getHybridEarningsCalendar returned');
        console.log('[EarningsGame] Received', data?.length || 0, 'events');
        if (data?.length > 0) {
          console.log('[EarningsGame] First event:', data[0]);
          console.log('[EarningsGame] Data source:', data[0]?.dataSource);
        } else {
          console.log('[EarningsGame] WARNING: No events returned!');
        }
        setEvents(data);
      } catch (err) {
        console.error('[EarningsGame] Load error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Get tournament info for UI components
  const tournamentInfo = useMemo(() => ({
    id: tournament?.id,
    week: tournament?.weekNumber || 1,
    name: tournament?.name || 'Weekly Tournament',
    lockDeadline: tournament?.lockDeadline ? new Date(tournament.lockDeadline) : new Date(),
    status: hasEntered ? 'entered' : (isDeadlinePassed ? 'locked' : 'open'),
    participantCount: entryCount || 0,
    deadlineFormatted,
  }), [tournament, hasEntered, isDeadlinePassed, entryCount, deadlineFormatted]);

  // Handlers
  const handleSelectEvent = (event) => {
    if (predictions.find(p => p.eventId === event.id)) return;
    setSelectedEvent(event);
    setSelectedOutcome(null);
  };

  const handleSelectOutcome = (outcome) => {
    setSelectedOutcome(outcome);
  };

  const handleAddParlay = (prediction) => {
    // Use hook's addPrediction - it handles all validation
    // The prediction object comes from ParlayArchitectModal with all required fields
    const success = addPrediction(
      { id: prediction.eventId, symbol: prediction.symbol, companyName: prediction.companyName },
      prediction
    );

    if (success) {
      setSelectedEvent(null);
      setSelectedOutcome(null);
    }
  };

  const handleRemove = (eventId) => {
    removePrediction(eventId);
  };

  const handleLock = async () => {
    const success = await lockPortfolio();
    if (success) {
      // Create a new tournament entry with current predictions
      const username = user?.username || user?.odId || 'Anonymous';
      const result = await createEntry(predictions, username);
      if (result.success) {
        console.log('[EarningsGameScreen] Successfully created entry:', result.entry?.entryId);
        await refreshUserEntries();
      } else {
        console.warn('[EarningsGameScreen] Failed to create entry:', result.error);
      }
      setView('arena');
    }
  };

  const handleReset = () => {
    reset();
    setSelectedEvent(null);
    setSelectedOutcome(null);
    setView('calendar');
  };

  const handlePlayNext = () => {
    reset();
    setSelectedEvent(null);
    setSelectedOutcome(null);
    setShowLeaderboard(false);
    setView('calendar');
  };

  const closeModal = () => {
    setSelectedEvent(null);
    setSelectedOutcome(null);
  };

  // Format helpers
  const formatDate = (date) => new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  // Helper function for deadline countdown
  const getTimeUntilDeadline = (deadline) => {
    if (!deadline) return '';
    const now = new Date();
    const dl = new Date(deadline);
    const diff = dl - now;

    if (diff <= 0) return 'Deadline passed';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    return `${hours}h ${minutes}m`;
  };

  // ========================================
  // Player Portfolio Modal Component
  // ========================================
  const PlayerPortfolioModal = ({ player, onClose }) => {
    if (!player) return null;

    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: '#161b22',
            borderRadius: '16px',
            maxWidth: '600px',
            width: '100%',
            maxHeight: '80vh',
            overflow: 'auto',
            border: '1px solid #21262d'
          }}
        >
          {/* Header */}
          <div style={{
            padding: '20px',
            borderBottom: '1px solid #21262d',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'sticky',
            top: 0,
            background: '#161b22',
            zIndex: 1
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '24px' }}>{player.avatar || '🎮'}</span>
                <h2 style={{ margin: 0, color: '#ffffff', fontSize: '20px' }}>
                  {player.username}
                </h2>
                {player.isBot && (
                  <span style={{
                    fontSize: '10px',
                    background: 'rgba(139, 92, 246, 0.2)',
                    color: '#8b5cf6',
                    padding: '2px 6px',
                    borderRadius: '4px'
                  }}>BOT</span>
                )}
              </div>
              <div style={{ color: '#8b949e', fontSize: '14px', marginTop: '4px' }}>
                {player.predictionCount || player.predictions?.length || 0} picks · ${(player.totalSpent || 0).toLocaleString()} spent
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#8b949e',
                fontSize: '24px',
                cursor: 'pointer',
                padding: '8px'
              }}
            >×</button>
          </div>

          {/* Stats */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-around',
            padding: '16px 20px',
            borderBottom: '1px solid #21262d',
            background: 'rgba(0, 217, 255, 0.05)'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#00d9ff' }}>
                {(player.results?.totalPoints || 0).toLocaleString()}
              </div>
              <div style={{ fontSize: '12px', color: '#8b949e' }}>Points</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#10b981' }}>
                {player.results?.correctPredictions || 0}
              </div>
              <div style={{ fontSize: '12px', color: '#8b949e' }}>Correct</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#ef4444' }}>
                {player.results?.incorrectPredictions || 0}
              </div>
              <div style={{ fontSize: '12px', color: '#8b949e' }}>Wrong</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#f59e0b' }}>
                {player.results?.pendingPredictions || 0}
              </div>
              <div style={{ fontSize: '12px', color: '#8b949e' }}>Pending</div>
            </div>
          </div>

          {/* Predictions List */}
          <div style={{ padding: '20px' }}>
            <h3 style={{ color: '#ffffff', margin: '0 0 16px 0', fontSize: '16px' }}>
              Predictions
            </h3>

            {player.predictions && player.predictions.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {player.predictions.map((pred, index) => (
                  <div
                    key={index}
                    style={{
                      background: '#0d1117',
                      borderRadius: '8px',
                      padding: '12px 16px',
                      border: pred.resolved
                        ? pred.isCorrect
                          ? '1px solid #10b981'
                          : '1px solid #ef4444'
                        : '1px solid #21262d'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '8px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          fontWeight: '700',
                          color: '#ffffff',
                          fontSize: '16px'
                        }}>
                          {pred.symbol}
                        </span>
                        <span style={{
                          fontSize: '12px',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: pred.outcome === 'beat'
                            ? 'rgba(16, 185, 129, 0.2)'
                            : 'rgba(239, 68, 68, 0.2)',
                          color: pred.outcome === 'beat' ? '#10b981' : '#ef4444'
                        }}>
                          {pred.outcomeLabel || pred.outcome?.toUpperCase()}
                        </span>
                      </div>

                      {pred.resolved && (
                        <span style={{
                          fontSize: '12px',
                          fontWeight: '600',
                          color: pred.isCorrect ? '#10b981' : '#ef4444'
                        }}>
                          {pred.isCorrect ? '✓ CORRECT' : '✗ WRONG'}
                        </span>
                      )}
                    </div>

                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '13px',
                      color: '#8b949e'
                    }}>
                      <span>
                        {pred.magnitudeLabel || pred.magnitude} {pred.magnitudeEmoji || ''} · {pred.precisionLabel || 'Standard'}
                      </span>
                      <span>
                        {pred.priceDisplay || `$${pred.price}`} → <span style={{ color: '#00d9ff' }}>
                          ${(pred.potentialPayout || 0).toLocaleString()}
                        </span>
                      </span>
                    </div>

                    {pred.resolved && pred.isCorrect && (
                      <div style={{
                        marginTop: '8px',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#10b981'
                      }}>
                        +{(pred.pointsEarned || 0).toLocaleString()} pts
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: '#8b949e', textAlign: 'center' }}>
                No predictions available
              </div>
            )}
          </div>
        </motion.div>
      </div>
    );
  };

  // ========================================
  // Navigation Tabs Component
  // ========================================
  const NavigationTabs = () => (
    <div style={{
      display: 'flex',
      gap: '8px',
      padding: '12px 20px',
      borderBottom: '1px solid #21262d',
      background: '#0d1117',
      overflowX: 'auto',
      WebkitOverflowScrolling: 'touch'
    }}>
      {[
        { id: 'tournament', label: '🏆 Tournament', show: true },
        { id: 'calendar', label: '📅 Earnings', show: true },
        { id: 'portfolio', label: '📊 Portfolio', show: predictions.length > 0 || hasEntered },
        { id: 'arena', label: '🎯 Live Results', show: hasEntered }
      ].filter(tab => tab.show).map(tab => (
        <button
          key={tab.id}
          onClick={() => setView(tab.id)}
          style={{
            padding: '8px 16px',
            background: view === tab.id ? 'rgba(0, 217, 255, 0.15)' : 'transparent',
            border: view === tab.id ? '1px solid #00d9ff' : '1px solid #21262d',
            borderRadius: '8px',
            color: view === tab.id ? '#00d9ff' : '#8b949e',
            fontWeight: '600',
            cursor: 'pointer',
            fontSize: '13px',
            whiteSpace: 'nowrap',
            flexShrink: 0
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );

  // ========================================
  // VIEW: TOURNAMENT HUB
  // ========================================
  if (view === 'tournament') {
    return (
      <div style={{ minHeight: '100vh', background: '#0d1117' }}>
        <NavigationTabs />
        <div style={{ padding: '20px' }}>
          {/* Tournament Header */}
          <div style={{
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '24px',
            border: '1px solid #21262d'
          }}>
            <h2 style={{ color: '#00d9ff', margin: '0 0 8px 0', fontSize: '24px' }}>
              🏆 {tournament?.name || 'Current Tournament'}
            </h2>
            <div style={{ color: '#8b949e', fontSize: '14px' }}>
              {tournament?.status === 'open' && !isDeadlinePassed && (
                <span>Locks in: {getTimeUntilDeadline(tournament?.lockDeadline)}</span>
              )}
              {isDeadlinePassed && <span style={{ color: '#f59e0b' }}>Tournament In Progress</span>}
              {!tournament && !tournamentLoading && (
                <span>No active tournament</span>
              )}
            </div>
          </div>

          {/* Your Entries - Multi-entry display */}
          {hasEntered && userEntries && userEntries.length > 0 ? (
            <div style={{
              background: '#161b22',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '24px',
              border: '1px solid #21262d'
            }}>
              {/* Best Entry Summary */}
              <div style={{ marginBottom: '16px' }}>
                <h3 style={{ color: '#ffffff', margin: '0 0 12px 0' }}>
                  Your Best Entry {userEntries.length > 1 && `(${userEntries.length} total)`}
                </h3>
                <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
                  <div>
                    <div style={{ fontSize: '24px', fontWeight: '700', color: '#00d9ff' }}>
                      #{userRank || '-'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#8b949e' }}>Best Rank</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '24px', fontWeight: '700', color: '#10b981' }}>
                      {userEntry?.results?.totalPoints?.toLocaleString() || 0}
                    </div>
                    <div style={{ fontSize: '11px', color: '#8b949e' }}>Top Points</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '24px' }}>
                      {userBracket?.emoji || '🎮'}
                    </div>
                    <div style={{ fontSize: '11px', color: userBracket?.color || '#8b949e' }}>
                      {userBracket?.name || 'Bracket'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Entry Selector */}
              <EntrySelector
                entries={userEntries}
                maxEntries={MAX_ENTRIES_PER_USER || 3}
                activeEntryId={activeEntryId}
                isDeadlinePassed={isDeadlinePassed}
                onSelectEntry={(entry) => {
                  selectEntry(entry.entryId);
                  setView('arena');
                }}
                onViewEntry={() => setView('arena')}
                onEditEntry={(entry) => {
                  selectEntry(entry.entryId);
                  setView('calendar');
                }}
                onCreateEntry={() => {
                  if (!canCreateEntry) {
                    alert(`Maximum ${MAX_ENTRIES_PER_USER || 3} entries allowed`);
                    return;
                  }
                  reset();
                  setView('calendar');
                }}
                isDesktop={isDesktop}
              />
            </div>
          ) : (
            <div style={{
              background: '#161b22',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '24px',
              border: '1px solid #21262d',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>📋</div>
              <h3 style={{ color: '#ffffff', margin: '0 0 8px 0' }}>No Entry Yet</h3>
              <p style={{ color: '#8b949e', margin: '0 0 16px 0' }}>
                Build a portfolio to enter this week's tournament
              </p>
              <button
                onClick={() => setView('calendar')}
                style={{
                  padding: '12px 24px',
                  background: 'linear-gradient(90deg, #00d9ff 0%, #0099cc 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#0d1117',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Browse Earnings
              </button>
            </div>
          )}

          {/* Leaderboard */}
          <div style={{
            background: '#161b22',
            borderRadius: '12px',
            padding: '20px',
            border: '1px solid #21262d'
          }}>
            <h3 style={{ color: '#ffffff', margin: '0 0 16px 0' }}>
              Leaderboard ({tournamentLeaderboard?.length || 0} entries)
            </h3>

            {tournamentLeaderboard && tournamentLeaderboard.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {tournamentLeaderboard.slice(0, 20).map((entry, index) => {
                  // Get bracket config for colors
                  const bracketConfig = BRACKETS[entry.bracket] || BRACKETS.participant;

                  return (
                    <div
                      key={entry.odUserId || index}
                      onClick={() => setSelectedPlayer(entry)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px',
                        background: entry.odUserId === user?.odUserId
                          ? 'rgba(0, 217, 255, 0.1)'
                          : index % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                        borderRadius: '8px',
                        borderLeft: entry.odUserId === user?.odUserId ? '3px solid #00d9ff' : 'none',
                        cursor: 'pointer',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        if (entry.odUserId !== user?.odUserId) {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = entry.odUserId === user?.odUserId
                          ? 'rgba(0, 217, 255, 0.1)'
                          : index % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {/* Rank with medal for top 3 */}
                        <span style={{
                          fontWeight: '700',
                          color: index === 0 ? '#ffd700' : index < 3 ? '#c0c0c0' : '#8b949e',
                          width: '30px'
                        }}>
                          {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
                        </span>

                        {/* Bracket badge */}
                        <span style={{
                          fontSize: '14px',
                          width: '24px',
                          textAlign: 'center',
                        }}>
                          {bracketConfig.emoji}
                        </span>

                        {/* Username */}
                        <span style={{ color: '#ffffff' }}>{entry.username || 'Anonymous'}</span>

                        {/* Entry number if multi-entry */}
                        {entry.entryNumber && entry.entryNumber > 1 && (
                          <span style={{
                            fontSize: '9px',
                            color: '#8b949e',
                            background: 'rgba(255, 255, 255, 0.1)',
                            padding: '2px 4px',
                            borderRadius: '3px',
                          }}>
                            #{entry.entryNumber}
                          </span>
                        )}

                        {/* Bot badge */}
                        {entry.isBot && (
                          <span style={{
                            fontSize: '10px',
                            color: '#8b5cf6',
                            background: 'rgba(139, 92, 246, 0.2)',
                            padding: '2px 6px',
                            borderRadius: '4px'
                          }}>BOT</span>
                        )}

                        {/* Current user badge */}
                        {entry.odUserId === user?.odUserId && (
                          <span style={{
                            fontSize: '10px',
                            color: '#00d9ff',
                            background: 'rgba(0, 217, 255, 0.2)',
                            padding: '2px 6px',
                            borderRadius: '4px'
                          }}>YOU</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {/* Points with bracket color */}
                        <span style={{
                          fontWeight: '700',
                          color: bracketConfig.color || '#00d9ff'
                        }}>
                          {(entry.results?.totalPoints || 0).toLocaleString()} pts
                        </span>
                        <span style={{ color: '#8b949e', fontSize: '12px' }}>›</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ color: '#8b949e', textAlign: 'center', padding: '20px' }}>
                No entries yet. Be the first!
              </div>
            )}
          </div>

          {/* TESTING ONLY - Bot Population Button */}
          {tournament && (
            <button
              onClick={async () => {
                try {
                  // Import bot service and firebase
                  const botService = await import('../services/earningsBotService');
                  const fb = await import('../firebase/firebaseService');
                  const { enhanceEventWithParlays } = await import('../services/earningsReactionsService');

                  // Generate parlays for each event
                  const parlaysByEvent = {};
                  for (const event of events.slice(0, 20)) { // Limit to first 20 events
                    try {
                      const enhanced = enhanceEventWithParlays(event);
                      parlaysByEvent[event.symbol] = enhanced.parlays || [];
                    } catch (e) {
                      console.warn(`Could not generate parlays for ${event.symbol}:`, e);
                    }
                  }

                  console.log('Generated parlays for', Object.keys(parlaysByEvent).length, 'events');

                  // Generate bot entries
                  const botEntries = botService.generateBotEntries(
                    events.slice(0, 20),
                    parlaysByEvent,
                    12 // Number of bots
                  );

                  console.log('Generated bot entries:', botEntries);

                  if (botEntries.length === 0) {
                    alert('Could not generate bot entries. Make sure there are events with parlays.');
                    return;
                  }

                  // Save to Firebase
                  const results = await fb.createBotTournamentEntries(tournament.id, botEntries);
                  console.log('Bot creation results:', results);

                  // Refresh leaderboard
                  await refreshLeaderboard();

                  alert(`Created ${results.filter(r => r.success).length} bot entries!`);
                } catch (error) {
                  console.error('Error creating bots:', error);
                  alert('Error creating bots: ' + error.message);
                }
              }}
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(90deg, #8b5cf6 0%, #6d28d9 100%)',
                border: 'none',
                borderRadius: '8px',
                color: '#ffffff',
                fontWeight: '600',
                cursor: 'pointer',
                marginTop: '16px',
                width: '100%'
              }}
            >
              🤖 Populate Tournament with Bots (Testing)
            </button>
          )}
        </div>

        {/* Player Portfolio Modal */}
        <AnimatePresence>
          {selectedPlayer && (
            <PlayerPortfolioModal
              player={selectedPlayer}
              onClose={() => setSelectedPlayer(null)}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ========================================
  // VIEW: CALENDAR (New EarningsCalendar component)
  // ========================================
  if (view === 'calendar') {
    return (
      <div style={{ minHeight: '100vh', background: '#0d1117' }}>
        <NavigationTabs />
        <EarningsCalendar
          events={events}
          predictions={predictions}
          tournament={tournamentInfo}
          loading={loading || tournamentLoading}
          error={error}
          onBack={onBack}
          onOpenArchitect={(event) => {
            setSelectedEvent(event);
            setSelectedOutcome(null);
          }}
          onViewPortfolio={() => setView('portfolio')}
          isDesktop={isDesktop}
        />

        {/* Parlay Architect Modal - Phase 3 */}
        <ParlayArchitectModal
          event={selectedEvent}
          isOpen={!!selectedEvent}
          onClose={closeModal}
          onAddPrediction={handleAddParlay}
          currentBudget={budgetRemaining}
          isDesktop={isDesktop}
        />
      </div>
    );
  }

  // ========================================
  // VIEW: PORTFOLIO (Phase 4 - PortfolioWarRoom)
  // ========================================
  if (view === 'portfolio') {
    return (
      <div style={{ minHeight: '100vh', background: '#0d1117' }}>
        <NavigationTabs />

        {/* Multi-Entry Manager - Show entries when user has tournament entries */}
        {hasEntered && userEntries && userEntries.length > 0 && (
          <div style={{ padding: '20px 20px 0 20px' }}>
            <EntrySelector
              entries={userEntries}
              maxEntries={MAX_ENTRIES_PER_USER || 3}
              activeEntryId={activeEntryId}
              isDeadlinePassed={isDeadlinePassed}
              onSelectEntry={(entry) => {
                selectEntry(entry.entryId);
                if (entry.status === 'locked' || entry.status === 'complete') {
                  setView('arena');
                }
              }}
              onViewEntry={() => setView('arena')}
              onEditEntry={(entry) => {
                selectEntry(entry.entryId);
                setView('calendar');
              }}
              onCreateEntry={async () => {
                if (!canCreateEntry) {
                  alert(`Maximum ${MAX_ENTRIES_PER_USER || 3} entries allowed per tournament`);
                  return;
                }
                reset(); // Clear local predictions only (doesn't affect Firebase entries!)
                setView('calendar');
              }}
              isDesktop={isDesktop}
            />
          </div>
        )}

        {/* Tournament Entry button - show when portfolio is locked but NOT yet entered */}
        {isLocked && !hasEntered && tournament && (
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              onClick={async () => {
                const username = user?.username || user?.odId || 'Anonymous';
                const success = await enterTournament(predictions, username);
                if (success) {
                  await refreshUserEntries();
                  setView('tournament');
                }
              }}
              style={{
                padding: '16px 32px',
                background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
                border: 'none',
                borderRadius: '12px',
                color: '#ffffff',
                fontWeight: '700',
                fontSize: '16px',
                cursor: 'pointer'
              }}
            >
              🏆 Enter Tournament
            </button>
          </div>
        )}

        {/* Create Additional Entry button - show when user has entries but can create more */}
        {hasEntered && canCreateEntry && !isDeadlinePassed && (
          <div style={{ padding: '0 20px 20px 20px' }}>
            <button
              onClick={() => {
                reset(); // Clear local predictions only (doesn't affect Firebase entries!)
                setView('calendar');
              }}
              style={{
                width: '100%',
                padding: '12px 24px',
                background: 'transparent',
                border: '2px dashed #21262d',
                borderRadius: '8px',
                color: '#8b949e',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <span style={{ fontSize: '18px' }}>+</span>
              Create Entry {(entriesCount || 0) + 1}
            </button>
          </div>
        )}

        <PortfolioWarRoom
          predictions={predictions}
          totalSpent={totalSpent}
          budgetRemaining={budgetRemaining}
          totalPotentialPoints={totalPotentialPoints}
          isLocked={isLocked}
          isValid={isValid}
          validationMessage={validationMessage}
          onBack={() => setView('calendar')}
          onRemove={removePrediction}
          onLock={async () => {
            // First lock the local portfolio state
            const locked = await lockPortfolio();
            if (!locked) return;

            // Then create/enter tournament entry
            const username = user?.username || user?.odId || 'Anonymous';
            const result = await createEntry(predictions, username);

            if (result.success) {
              // Refresh entries list and navigate to arena
              await refreshUserEntries();
              setView('arena');
            } else {
              console.error('[EarningsGame] Failed to create entry:', result.error);
              // Still go to arena if local lock succeeded
              setView('arena');
            }
          }}
          isDesktop={isDesktop}
        />
      </div>
    );
  }

  // ========================================
  // VIEW: ARENA (Phase 5 - LiveMatchArena)
  // ========================================
  if (view === 'arena') {
    // Use predictions from Firebase entry if available, otherwise local predictions
    const arenaPredictions = activeEntry?.predictions || predictions;

    return (
      <div style={{ minHeight: '100vh', background: '#0d1117' }}>
        <NavigationTabs />
        <LiveMatchArena
          predictions={arenaPredictions}
          userPosition={userPosition}
          resultsData={{}}
          onBack={() => setView('portfolio')}
          onViewLeaderboard={() => setShowLeaderboard(true)}
          leaderboard={isDesktop ? leaderboardData : null}
          currentUserId={user?.odId || 'current'}
          tournament={{
            week: tournamentInfo.week,
            participantCount: tournamentInfo.participantCount,
          }}
          isDesktop={isDesktop}
        />

        {/* Leaderboard Modal (mobile) */}
        <AnimatePresence>
          {showLeaderboard && (
            <LeaderboardModal
              leaderboard={leaderboardData}
              currentUserId={user?.odId || 'current'}
              tournament={{
                week: tournamentInfo.week,
                participantCount: tournamentInfo.participantCount,
              }}
              onClose={() => setShowLeaderboard(false)}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ========================================
  // VIEW: RESULTS (Phase 6 - TournamentResults)
  // ========================================
  if (view === 'results') {
    // Use predictions from Firebase entry if available, otherwise local predictions
    const resultsPredictions = activeEntry?.predictions || predictions;

    return (
      <div style={{ minHeight: '100vh', background: '#0d1117' }}>
        <NavigationTabs />
        <TournamentResults
          predictions={resultsPredictions}
          resultsData={{}}
          userPosition={userPosition}
          tournament={{
            week: tournamentInfo.week,
            participantCount: tournamentInfo.participantCount,
          }}
          onPlayNext={handlePlayNext}
          onViewLeaderboard={() => setShowLeaderboard(true)}
          isDesktop={isDesktop}
        />

        {/* Leaderboard Modal */}
        <AnimatePresence>
          {showLeaderboard && (
            <LeaderboardModal
              leaderboard={leaderboardData}
              currentUserId={user?.odId || 'current'}
              tournament={{
                week: tournamentInfo.week,
                participantCount: tournamentInfo.participantCount,
              }}
              onClose={() => setShowLeaderboard(false)}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Fallback - should never reach here
  return null;
};

// Wrap in memo to prevent re-renders from parent state changes (e.g., Firestore battle updates)
// Custom comparison ignores callback props that are recreated on every render
export default memo(EarningsGameScreen, (prevProps, nextProps) => {
  // Only re-render if meaningful props change
  return (
    prevProps.user?.odUserId === nextProps.user?.odUserId &&
    prevProps.isDesktop === nextProps.isDesktop &&
    prevProps.colors === nextProps.colors
    // Ignore onBack, setScreen as they're callbacks that change reference but not behavior
  );
});
