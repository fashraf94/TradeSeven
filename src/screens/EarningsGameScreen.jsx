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
  } = useEarningsGame();

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

  // Mock data for arena (to be replaced with real data later)
  const mockUserPosition = {
    rank: 42,
    points: totalPotentialPoints,
    bracket: 'gold',
    movement: 3,
  };

  const mockLeaderboard = [
    { odId: '1', rank: 1, bracket: 'diamond', username: 'TradeMaster', points: 15420 },
    { odId: '2', rank: 2, bracket: 'diamond', username: 'EarningsKing', points: 14890 },
    { odId: '3', rank: 3, bracket: 'gold', username: 'BullRunner', points: 12350 },
    { odId: user?.odId || 'current', rank: 42, bracket: 'gold', username: 'You', points: totalPotentialPoints },
    { odId: '5', rank: 43, bracket: 'silver', username: 'StockPicker', points: 8200 },
  ];

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

  // Calculate tournament week number based on current date
  const getTournamentWeek = () => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const weekNum = Math.ceil(((now - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
    return weekNum;
  };

  // Get lock deadline (next Monday 9am)
  const getLockDeadline = () => {
    const now = new Date();
    const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
    const nextMonday = new Date(now);
    nextMonday.setDate(now.getDate() + daysUntilMonday);
    nextMonday.setHours(9, 0, 0, 0);
    return nextMonday;
  };

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

  const handleLock = () => {
    const success = lockPortfolio();
    if (success) {
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
          tournament={{
            week: getTournamentWeek(),
            lockDeadline: getLockDeadline(),
            status: isLocked ? 'locked' : 'open',
          }}
          loading={loading}
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
          userPosition={mockUserPosition}
          resultsData={mockResultsData}
          onBack={() => setView('portfolio')}
          onViewLeaderboard={() => setShowLeaderboard(true)}
          leaderboard={isDesktop ? mockLeaderboard : null}
          currentUserId={user?.odId || 'current'}
          tournament={{
            week: getTournamentWeek(),
            participantCount: 1247,
          }}
          isDesktop={isDesktop}
        />

        {/* Leaderboard Modal (mobile) */}
        <AnimatePresence>
          {showLeaderboard && (
            <LeaderboardModal
              leaderboard={mockLeaderboard}
              currentUserId={user?.odId || 'current'}
              tournament={{
                week: getTournamentWeek(),
                participantCount: 1247,
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
          userPosition={mockUserPosition}
          tournament={{
            week: getTournamentWeek(),
            participantCount: 1247,
          }}
          onPlayNext={handlePlayNext}
          onViewLeaderboard={() => setShowLeaderboard(true)}
          isDesktop={isDesktop}
        />

        {/* Leaderboard Modal */}
        <AnimatePresence>
          {showLeaderboard && (
            <LeaderboardModal
              leaderboard={mockLeaderboard}
              currentUserId={user?.odId || 'current'}
              tournament={{
                week: getTournamentWeek(),
                participantCount: 1247,
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
