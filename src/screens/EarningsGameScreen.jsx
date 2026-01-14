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

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEarningsGame } from '../hooks/useEarningsGame';
import { useTournament } from '../hooks/useTournament';
import { getUpcomingEarnings } from '../services/polymarketService';
import {
  designColors,
  fontMono,
  BUDGET,
  MIN_PREDICTIONS,
  MAX_PREDICTIONS,
  EarningsCalendar,
  ParlayArchitectModal,
  PortfolioWarRoom,
  LiveMatchArena,
  LeaderboardModal,
  TournamentResults
} from '../components/earningsGame';

const EarningsGameScreen = ({
  user,
  onBack,
  setScreen,
  colors = {},
  isDesktop = false
}) => {
  // Use the hook for portfolio state management
  // Pass userId to enable Firebase persistence
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
  } = useEarningsGame(user?.odId);

  // Tournament state from Firebase
  const {
    tournament,
    userEntry,
    leaderboard: tournamentLeaderboard,
    isLoading: tournamentLoading,
    isDeadlinePassed,
    userRank,
    userBracket,
    hasEntered,
    deadlineFormatted,
    entryCount,
    enterTournament,
    refreshLeaderboard,
  } = useTournament(user?.odId);

  // View state for navigation between screens
  const [view, setView] = useState('calendar'); // 'calendar' | 'portfolio' | 'arena' | 'results'

  // Events and loading state
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal state
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedOutcome, setSelectedOutcome] = useState(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

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

  // Mock results data - simulates completed predictions
  const mockResultsData = useMemo(() => {
    const results = {};
    predictions.forEach((pred, index) => {
      // Simulate some wins and losses for demo
      const isCorrect = index % 3 !== 2; // 2/3 correct rate
      results[pred.eventId] = {
        isCorrect,
        pointsEarned: isCorrect ? pred.potentialPoints : 0,
        actualMove: isCorrect ? 3.5 : -1.2,
        outcomeCorrect: isCorrect,
      };
    });
    return results;
  }, [predictions]);

  // Load earnings data
  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await getUpcomingEarnings(45);
        setEvents(data);
      } catch (err) {
        console.error('Load error:', err);
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
    const success = lockPortfolio();
    if (success) {
      // Enter the tournament with current predictions
      const username = user?.username || user?.odId || 'Anonymous';
      const entered = await enterTournament(predictions, username);
      if (entered) {
        console.log('[EarningsGameScreen] Successfully entered tournament');
      } else {
        console.warn('[EarningsGameScreen] Failed to enter tournament, but portfolio is locked');
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

  // ========================================
  // VIEW: CALENDAR (New EarningsCalendar component)
  // ========================================
  if (view === 'calendar') {
    return (
      <>
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
      </>
    );
  }

  // ========================================
  // VIEW: PORTFOLIO (Phase 4 - PortfolioWarRoom)
  // ========================================
  if (view === 'portfolio') {
    return (
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
        onLock={() => {
          lockPortfolio();
          setView('arena');
        }}
        isDesktop={isDesktop}
      />
    );
  }

  // ========================================
  // VIEW: ARENA (Phase 5 - LiveMatchArena)
  // ========================================
  if (view === 'arena') {
    return (
      <>
        <LiveMatchArena
          predictions={predictions}
          userPosition={userPosition}
          resultsData={mockResultsData}
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
      </>
    );
  }

  // ========================================
  // VIEW: RESULTS (Phase 6 - TournamentResults)
  // ========================================
  if (view === 'results') {
    return (
      <>
        <TournamentResults
          predictions={predictions}
          resultsData={mockResultsData}
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
      </>
    );
  }

  // Fallback - should never reach here
  return null;
};

export default EarningsGameScreen;
